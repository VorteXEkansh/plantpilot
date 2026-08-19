from __future__ import annotations

import math
import random
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from .config import settings
from .models import (
    Alert,
    CustomerOrder,
    Machine,
    MachineState,
    MaintenanceEvent,
    Material,
    OrderStatus,
    Product,
    ProductionRecord,
    QualityInspection,
    Scenario,
    ScheduleAssignment,
    ScheduleRun,
    Shift,
    Supplier,
    User,
    Worker,
)
from .security import hash_password

UTC = timezone.utc
REFERENCE_NOW = datetime(2026, 8, 19, 9, 0, tzinfo=UTC)

MACHINES = [
    ("CNC-01", "Mazak Quick Turn 200", "CNC Turning Center", "Machining", 1450, 22, ["Turning", "Facing", "Threading"], "SHAFT"),
    ("CNC-02", "DMG Mori NLX 2500", "CNC Turning Center", "Machining", 1520, 24, ["Turning", "Boring", "Threading"], "HUB"),
    ("CNC-03", "Jyoti DX 200", "CNC Turning Center", "Machining", 1180, 19, ["Turning", "Facing"], "ROTOR"),
    ("CNC-04", "Doosan Puma 2600", "CNC Turning Center", "Machining", 1560, 25, ["Turning", "Boring", "Threading"], "KNUCKLE"),
    ("VMC-01", "Haas VF-4SS", "Vertical Machining Center", "Machining", 1680, 28, ["Milling", "Drilling", "Tapping"], "ALUMINIUM"),
    ("VMC-02", "Makino PS95", "Vertical Machining Center", "Machining", 1820, 31, ["Milling", "Drilling", "Boring"], "CASTING"),
    ("VMC-03", "BFW Chakra BMV60", "Vertical Machining Center", "Machining", 1390, 25, ["Milling", "Drilling", "Tapping"], "STEEL"),
    ("DRL-01", "HMT Radial Drill RD32", "Radial Drilling", "Machining", 740, 8, ["Drilling", "Deburring"], "GENERAL"),
    ("GRD-01", "Micromatic GCU 350", "Cylindrical Grinder", "Finishing", 1240, 16, ["Grinding", "Finishing"], "SHAFT"),
    ("GRD-02", "Ace Micromatic IG 150", "Internal Grinder", "Finishing", 1310, 17, ["Grinding", "Finishing"], "HUB"),
    ("HTF-01", "Ipsen Sealed Quench Furnace", "Heat Treatment Furnace", "Heat Treatment", 2080, 85, ["Heat Treatment"], "HEAT"),
    ("INS-01", "Zeiss Contura CMM", "Inspection Station", "Quality", 980, 6, ["Inspection", "CMM"], "QA"),
    ("ASM-01", "Flexible Assembly Cell 1", "Assembly Station", "Assembly", 860, 5, ["Assembly", "Press Fit"], "ASSEMBLY-A"),
    ("ASM-02", "Flexible Assembly Cell 2", "Assembly Station", "Assembly", 860, 5, ["Assembly", "Torque"], "ASSEMBLY-B"),
    ("PKG-01", "Automated Pack & Mark", "Packaging Cell", "Dispatch", 620, 4, ["Packaging", "Laser Marking"], "PACK"),
]

SUPPLIERS = [
    ("SUP-01", "Aravali Alloy Steels", 6, 6.7, .93, .96),
    ("SUP-02", "Narmada Precision Castings", 10, 11.4, .88, .94),
    ("SUP-03", "Satluj Aluminium Works", 8, 8.2, .95, .97),
    ("SUP-04", "Kaveri Bearing Systems", 12, 13.1, .91, .98),
    ("SUP-05", "Trident Industrial Fasteners", 5, 5.3, .96, .95),
    ("SUP-06", "Shivalik Cutting Tools", 4, 4.8, .92, .97),
    ("SUP-07", "Pragati Packaging Solutions", 3, 3.2, .97, .94),
    ("SUP-08", "Indus Process Chemicals", 7, 7.6, .90, .93),
]

MATERIALS = [
    ("RM-001", "EN8 forged steel blank Ø180", "Raw metal", "kg", 96, 7850, 1800, 2500, 410, 1),
    ("RM-002", "EN24 alloy steel bar Ø90", "Raw metal", "kg", 142, 1280, 1450, 2100, 265, 1),
    ("RM-003", "SG iron steering knuckle casting", "Casting", "pc", 1880, 920, 240, 360, 44, 2),
    ("RM-004", "FG260 bearing hub casting", "Casting", "pc", 1260, 1310, 310, 470, 61, 2),
    ("RM-005", "ADC12 gear housing casting", "Casting", "pc", 1650, 640, 180, 290, 37, 2),
    ("RM-006", "Aluminium 6061-T6 billet", "Raw metal", "kg", 298, 4120, 900, 1400, 205, 3),
    ("RM-007", "EN24 drive shaft flange blank", "Forging", "pc", 920, 286, 320, 440, 56, 1),
    ("RM-008", "IS2062 steel plate 12 mm", "Raw metal", "kg", 78, 5680, 1200, 1750, 238, 1),
    ("RM-009", "High-carbon brake rotor casting", "Casting", "pc", 1480, 760, 220, 350, 48, 2),
    ("RM-010", "Taper roller bearing 30208", "Bought-out", "pc", 540, 1100, 260, 400, 53, 4),
    ("RM-011", "Deep groove bearing 6208", "Bought-out", "pc", 330, 1550, 300, 460, 62, 4),
    ("RM-012", "M12 class 10.9 flange bolt", "Fastener", "pc", 24, 4900, 1800, 2600, 340, 5),
    ("RM-013", "M10 prevailing torque nut", "Fastener", "pc", 13, 9200, 2200, 3300, 470, 5),
    ("RM-014", "Dowel pin Ø10 h6", "Fastener", "pc", 19, 3800, 900, 1350, 180, 5),
    ("RM-015", "Carbide turning insert CNMG", "Consumable", "pc", 465, 188, 55, 85, 11, 6),
    ("RM-016", "Carbide end mill Ø16", "Consumable", "pc", 1680, 74, 24, 38, 5, 6),
    ("RM-017", "CBN grinding wheel 400 mm", "Consumable", "pc", 14800, 16, 5, 8, .8, 6),
    ("RM-018", "Quenching oil ISO VG 32", "Chemical", "L", 185, 870, 240, 380, 41, 8),
    ("RM-019", "Water-soluble cutting fluid", "Chemical", "L", 265, 630, 180, 290, 33, 8),
    ("RM-020", "Rust preventive compound", "Chemical", "L", 312, 290, 80, 125, 15, 8),
    ("RM-021", "VDA automotive carton 450 mm", "Packaging", "pc", 82, 1660, 420, 650, 91, 7),
    ("RM-022", "VCI corrosion protection bag", "Packaging", "pc", 38, 2900, 720, 1100, 150, 7),
    ("RM-023", "Returnable plastic separator", "Packaging", "pc", 96, 870, 180, 280, 34, 7),
    ("RM-024", "Product traceability label", "Packaging", "pc", 4.2, 9800, 2800, 4300, 610, 7),
]

PRODUCTS = [
    ("AM-SK210", "Steering Knuckle", "Chassis", 8650, 6420, "KNUCKLE", [
        ("Turning", ["CNC-02", "CNC-04"], 8), ("Milling", ["VMC-02", "VMC-03"], 13), ("Drilling", ["VMC-02", "DRL-01"], 7), ("Inspection", ["INS-01"], 5), ("Packaging", ["PKG-01"], 2)], [("RM-003", 1), ("RM-012", 4), ("RM-024", 1)]),
    ("AM-BH330", "Bearing Hub", "Wheel End", 6250, 4610, "HUB", [
        ("Turning", ["CNC-01", "CNC-02"], 7), ("Grinding", ["GRD-02"], 8), ("Assembly", ["ASM-01", "ASM-02"], 5), ("Inspection", ["INS-01"], 4), ("Packaging", ["PKG-01"], 2)], [("RM-004", 1), ("RM-010", 1), ("RM-013", 4)]),
    ("AM-GH410", "Gear Housing", "Powertrain", 9200, 6880, "CASTING", [
        ("Milling", ["VMC-01", "VMC-02"], 16), ("Drilling", ["VMC-01", "DRL-01"], 9), ("Inspection", ["INS-01"], 6), ("Packaging", ["PKG-01"], 2)], [("RM-005", 1), ("RM-014", 3), ("RM-024", 1)]),
    ("AM-TC125", "Transmission Cover", "Powertrain", 7100, 5140, "ALUMINIUM", [
        ("Milling", ["VMC-01", "VMC-03"], 12), ("Drilling", ["VMC-01", "DRL-01"], 7), ("Inspection", ["INS-01"], 4), ("Packaging", ["PKG-01"], 2)], [("RM-006", 4.2), ("RM-012", 6), ("RM-024", 1)]),
    ("AM-DF600", "Drive Shaft Flange", "Driveline", 4850, 3520, "SHAFT", [
        ("Turning", ["CNC-01", "CNC-03", "CNC-04"], 9), ("Heat Treatment", ["HTF-01"], 11), ("Grinding", ["GRD-01"], 7), ("Inspection", ["INS-01"], 4), ("Packaging", ["PKG-01"], 2)], [("RM-007", 1), ("RM-018", .15), ("RM-022", 1)]),
    ("AM-SB220", "Suspension Bracket", "Chassis", 2850, 1980, "STEEL", [
        ("Milling", ["VMC-02", "VMC-03"], 8), ("Drilling", ["VMC-03", "DRL-01"], 5), ("Inspection", ["INS-01"], 3), ("Packaging", ["PKG-01"], 1)], [("RM-008", 5.8), ("RM-012", 2), ("RM-021", .25)]),
    ("AM-BR480", "Brake Rotor", "Brake", 5350, 3940, "ROTOR", [
        ("Turning", ["CNC-02", "CNC-03"], 10), ("Drilling", ["VMC-03", "DRL-01"], 5), ("Grinding", ["GRD-01", "GRD-02"], 9), ("Inspection", ["INS-01"], 4), ("Packaging", ["PKG-01"], 2)], [("RM-009", 1), ("RM-020", .08), ("RM-022", 1)]),
    ("AM-EP315", "Engine Mounting Plate", "Powertrain", 3650, 2540, "STEEL", [
        ("Milling", ["VMC-01", "VMC-03"], 9), ("Drilling", ["VMC-01", "DRL-01"], 6), ("Assembly", ["ASM-01", "ASM-02"], 4), ("Inspection", ["INS-01"], 3), ("Packaging", ["PKG-01"], 1)], [("RM-008", 4.4), ("RM-013", 4), ("RM-023", .2)]),
]


def _hashable_routing(routing: list[tuple]) -> list[dict]:
    return [{"sequence": i + 1, "operation": op, "eligible_machines": machines, "minutes_per_unit": mins} for i, (op, machines, mins) in enumerate(routing)]


def seed_database(db: Session, *, reset: bool = False) -> dict[str, int]:
    if reset:
        for model in [ScheduleAssignment, ScheduleRun, Scenario, QualityInspection, MaintenanceEvent, ProductionRecord, CustomerOrder, Material, Supplier, Product, Machine, Worker, Shift, Alert, User]:
            db.execute(delete(model))
        db.commit()
    existing = db.scalar(select(func.count()).select_from(Machine)) or 0
    if existing:
        return {"machines": existing, "status": 0}

    rng = random.Random(settings.synthetic_seed)
    shifts = [Shift(code="A", name="Morning", start_hour=6, end_hour=14), Shift(code="B", name="Evening", start_hour=14, end_hour=22), Shift(code="C", name="Night", start_hour=22, end_hour=6)]
    db.add_all(shifts)
    db.flush()
    db.add(User(email="admin@plantpilot.local", full_name="Aarav Khanna", password_hash=hash_password("PlantPilot@2026"), role="admin"))

    departments = (["Machining"] * 27 + ["Assembly"] * 10 + ["Maintenance"] * 7 + ["Quality"] * 6 + ["Material Handling"] * 6 + ["Supervision"] * 4)
    first_names = ["Aarav", "Vihaan", "Aditya", "Arjun", "Kabir", "Rohan", "Ishaan", "Manav", "Aditi", "Meera", "Nisha", "Kavya", "Priya", "Ananya", "Riya"]
    surnames = ["Sharma", "Yadav", "Singh", "Kumar", "Verma", "Malik", "Rao", "Kapoor", "Bhatia", "Saini"]
    for i, department in enumerate(departments):
        shift = shifts[i % 3]
        machine_certs = [MACHINES[(i + j * 3) % 15][0] for j in range(1 + (i % 3))]
        db.add(Worker(worker_code=f"W-{i+1:03d}", name=f"{first_names[i % len(first_names)]} {surnames[(i * 3) % len(surnames)]}", department=department, shift_id=shift.id, skills=[department, "5S", "Safety"] + (["CNC programming"] if department == "Machining" and i % 4 == 0 else []), certifications=machine_certs, hourly_wage=145 + (i % 7) * 18, overtime_rate=220 + (i % 7) * 28, experience_level=["Trainee", "Skilled", "Senior"][i % 3], available=i not in {17, 42}))

    machines: list[Machine] = []
    for i, row in enumerate(MACHINES):
        code, name, machine_type, department, hourly_cost, energy_kw, ops, family = row
        overdue = code == "CNC-04"
        machine = Machine(machine_code=code, name=name, machine_type=machine_type, department=department, hourly_cost=hourly_cost, energy_kw=energy_kw, supported_operations=ops, setup_family=family, performance_rate=round(.86 + rng.random() * .12, 3), failure_probability=.164 if overdue else round(.018 + rng.random() * .055, 3), state=MachineState.IDLE if i in {2, 8, 13} else MachineState.RUNNING, vibration_mm_s=6.8 if overdue else round(2.1 + rng.random() * 2.5, 2), temperature_c=78.4 if overdue else round(42 + rng.random() * 19, 1), runtime_hours=round(1800 + rng.random() * 5400, 0), maintenance_due=(REFERENCE_NOW + timedelta(days=-3 if overdue else 5 + i)).date(), mtbf_hours=round(420 + rng.random() * 680, 0), mttr_hours=round(2.2 + rng.random() * 3.4, 1))
        machines.append(machine)
        db.add(machine)
    db.flush()

    suppliers = []
    for code, name, lead, actual, reliability, quality in SUPPLIERS:
        supplier = Supplier(supplier_code=code, name=name, standard_lead_days=lead, actual_lead_days=actual, reliability=reliability, quality_rating=quality, payment_terms="Net 45 days")
        suppliers.append(supplier)
        db.add(supplier)
    db.flush()
    for code, description, category, unit, cost, inventory, safety, reorder, consumption, supplier_no in MATERIALS:
        db.add(Material(material_code=code, description=description, category=category, unit=unit, unit_cost=cost, current_inventory=inventory, safety_stock=safety, reorder_point=reorder, average_consumption=consumption, supplier_id=suppliers[supplier_no - 1].id, lead_time_days=suppliers[supplier_no - 1].standard_lead_days, lead_time_variation=round(.7 + rng.random() * 2.2, 1)))

    products = []
    for sku, name, family, price, target, setup, routing, bom in PRODUCTS:
        product = Product(sku=sku, name=name, family=family, selling_price=price, target_cost=target, setup_family=setup, quality_target=.985, routing=_hashable_routing(routing), bom=[{"material_code": code, "quantity": qty} for code, qty in bom])
        products.append(product)
        db.add(product)
    db.flush()

    customers = ["Northstar Mobility", "Zenith Auto Systems", "VectorDrive India", "Altura Motors", "Orbit EV Technologies", "Kinetic Commercial Vehicles", "Crestline Automotive", "Vardhan Mobility"]
    statuses = [OrderStatus.SHIPPED, OrderStatus.COMPLETED, OrderStatus.IN_PRODUCTION, OrderStatus.RELEASED, OrderStatus.PLANNED]
    for i in range(420):
        product = products[(i * 5 + rng.randrange(8)) % 8]
        order_date = REFERENCE_NOW - timedelta(days=179 - int(i * 179 / 419), hours=rng.randrange(20))
        quantity = rng.randrange(18, 86)
        due = order_date + timedelta(days=rng.randrange(6, 18))
        historical = due < REFERENCE_NOW - timedelta(days=3)
        status = rng.choices(statuses[:2], [.78, .22])[0] if historical else rng.choices(statuses[2:], [.45, .25, .30])[0]
        priority = rng.choices(["Standard", "High", "Critical"], [.68, .25, .07])[0]
        queue_pressure = (quantity * len(product.routing)) / 400
        shortage = .15 if any(x["material_code"] == "RM-007" for x in product.bom) else 0
        risk = min(.96, max(.02, .05 + queue_pressure + shortage + (.17 if priority == "Critical" else 0) + rng.gauss(0, .04)))
        progress = 100 if status in {OrderStatus.SHIPPED, OrderStatus.COMPLETED} else round(rng.random() * 82, 1)
        estimated = due + timedelta(hours=max(-28, (risk - .45) * 42))
        final_status = OrderStatus.DELAYED if not historical and estimated > due + timedelta(hours=4) and i % 13 == 0 else status
        db.add(CustomerOrder(order_code=f"AM-{2200+i:04d}", customer=customers[i % len(customers)], product_id=product.id, quantity=quantity, order_date=order_date, due_date=due, promised_date=due, priority=priority, status=final_status, progress=progress, estimated_completion=estimated, lateness_risk=round(risk, 3)))

    # 2,700 correlated daily production records (180 days × 15 machines).
    for day in range(180):
        date_at = REFERENCE_NOW - timedelta(days=179 - day)
        demand_wave = 1 + .09 * math.sin(day / 11) + (.08 if day > 150 else 0)
        for m_idx, machine in enumerate(machines):
            product = products[(day + m_idx * 3) % 8]
            overdue_factor = .12 if machine.machine_code == "CNC-04" and day > 166 else 0
            utilization = min(.97, max(.48, .76 * demand_wave + rng.gauss(0, .055)))
            downtime = max(0, 70 * overdue_factor + rng.expovariate(1 / (10 + 35 * utilization)))
            planned = 1260
            runtime = max(240, planned * utilization - downtime)
            performance = max(.72, min(1.03, machine.performance_rate - .05 * overdue_factor + rng.gauss(0, .025)))
            ideal = runtime * performance
            units = max(1, int(ideal / max(2, product.routing[0]["minutes_per_unit"])))
            defect_rate = max(.003, .012 + .04 * overdue_factor + .018 * max(0, utilization - .88) + rng.gauss(0, .004))
            scrap = min(units, int(units * defect_rate))
            db.add(ProductionRecord(recorded_at=date_at, machine_id=machine.id, product_id=product.id, planned_minutes=planned, runtime_minutes=runtime, ideal_minutes=ideal, total_units=units, good_units=units - scrap, scrap_units=scrap, downtime_minutes=downtime, setup_minutes=round(18 + rng.random() * 38, 1), energy_kwh=round(runtime / 60 * machine.energy_kw * (.78 + .18 * utilization), 1)))

    defect_categories = ["Bore diameter", "Surface finish", "Runout", "Porosity", "Thread damage", "Burr"]
    for i in range(720):
        machine = machines[(i * 7) % 15]
        product = products[(i * 3) % 8]
        overload = .025 if machine.machine_code == "CNC-04" and i > 650 else 0
        sample = 20 + (i % 6) * 5
        defect_rate = .011 + overload + rng.random() * .018
        defects = int(sample * defect_rate + rng.random())
        db.add(QualityInspection(inspected_at=REFERENCE_NOW - timedelta(hours=(720 - i) * 6), machine_id=machine.id, product_id=product.id, sample_size=sample, defect_count=defects, measurement_mean=round(50 + rng.gauss(0, .08 + overload), 3), measurement_range=round(abs(rng.gauss(.25, .07)), 3), lower_spec=49.5, upper_spec=50.5, defect_category=defect_categories[i % len(defect_categories)], rework_units=max(0, defects - (i % 2))))

    for i, machine in enumerate(machines):
        db.add(MaintenanceEvent(machine_id=machine.id, event_type="Preventive" if i % 3 else "Corrective", start_at=REFERENCE_NOW - timedelta(days=7 + i * 4), duration_hours=round(2.5 + rng.random() * 5, 1), cost=round(6200 + rng.random() * 32000, 0), status="Completed", notes="Synthetic maintenance event generated from correlated condition history."))
    db.add_all([
        Alert(severity="Critical", source="Maintenance", title="CNC-04 failure risk elevated", message="Vibration is 18% above its recent baseline and preventive maintenance is overdue."),
        Alert(severity="High", source="Inventory", title="EN24 flange blanks below safety stock", message="RM-007 has 5.1 days of modeled coverage; expedite the open purchase order."),
        Alert(severity="High", source="Delivery", title="Order AM-2481 may be late", message="The latest finite-capacity estimate is 6.4 hours beyond the promised date."),
        Alert(severity="Medium", source="Capacity", title="VMC-02 approaching overload", message="Four-week required load exceeds regular capacity by 7.8%."),
    ])
    db.commit()
    return {"machines": 15, "workers": 60, "products": 8, "materials": 24, "orders": 420, "production_records": 2700, "quality_inspections": 720}
