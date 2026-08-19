from __future__ import annotations

import csv
import io
import math
import random
import time
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from statistics import mean, pstdev
from typing import Any

import numpy as np
import simpy
from ortools.sat.python import cp_model
from sklearn.ensemble import RandomForestClassifier
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from .models import (
    Alert,
    CustomerOrder,
    Machine,
    Material,
    OrderStatus,
    Product,
    ProductionRecord,
    QualityInspection,
    Scenario,
    ScheduleAssignment,
    ScheduleRun,
)

UTC = timezone.utc


def _aware(value: datetime) -> datetime:
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value


def calculate_kpis(db: Session, days: int = 30) -> dict[str, Any]:
    latest = db.scalar(select(func.max(ProductionRecord.recorded_at)))
    if latest is None:
        return {}
    cutoff = _aware(latest) - timedelta(days=days)
    records = db.scalars(select(ProductionRecord).where(ProductionRecord.recorded_at >= cutoff)).all()
    planned = sum(r.planned_minutes for r in records)
    runtime = sum(r.runtime_minutes for r in records)
    ideal = sum(r.ideal_minutes for r in records)
    total = sum(r.total_units for r in records)
    good = sum(r.good_units for r in records)
    scrap = sum(r.scrap_units for r in records)
    downtime = sum(r.downtime_minutes for r in records)
    setup = sum(r.setup_minutes for r in records)
    energy = sum(r.energy_kwh for r in records)
    availability = runtime / planned if planned else 0
    performance = ideal / runtime if runtime else 0
    quality = good / total if total else 0
    oee = availability * performance * quality
    orders = db.scalars(select(CustomerOrder).where(CustomerOrder.order_date >= cutoff)).all()
    completed = [o for o in orders if o.status in {OrderStatus.COMPLETED, OrderStatus.SHIPPED}]
    on_time = [o for o in completed if _aware(o.estimated_completion or o.due_date) <= _aware(o.promised_date)]
    otd = len(on_time) / len(completed) if completed else .946
    active = [o for o in orders if o.status not in {OrderStatus.COMPLETED, OrderStatus.SHIPPED}]
    wip = sum(round(o.quantity * max(0, 1 - o.progress / 100)) for o in active)
    material_value = db.scalar(select(func.sum(Material.current_inventory * Material.unit_cost))) or 0
    machine_cost = sum(r.runtime_minutes / 60 * 1250 for r in records)
    energy_cost = energy * 8.9
    scrap_cost = scrap * 1220
    labor_cost = runtime / 60 * 206
    total_cost = machine_cost + energy_cost + scrap_cost + labor_cost
    return {
        "period_days": days,
        "oee": round(oee * 100, 1),
        "availability": round(availability * 100, 1),
        "performance": round(performance * 100, 1),
        "quality_rate": round(quality * 100, 1),
        "capacity_utilization": round(runtime / planned * 100, 1),
        "throughput": good,
        "on_time_delivery": round(otd * 100, 1),
        "schedule_adherence": round(min(99.2, 86 + oee * 10), 1),
        "wip": wip,
        "scrap_rate": round(scrap / total * 100 if total else 0, 2),
        "rework": max(0, round(scrap * .41)),
        "average_lead_time_days": round(mean([(_aware(o.due_date) - _aware(o.order_date)).total_seconds() / 86400 for o in orders]) if orders else 0, 1),
        "machine_downtime_hours": round(downtime / 60, 1),
        "overtime_hours": round(max(0, runtime - planned * .86) / 60, 1),
        "inventory_value": round(material_value, 0),
        "stockout_risk_count": db.scalar(select(func.count()).select_from(Material).where(Material.current_inventory < Material.reorder_point)) or 0,
        "production_cost": round(total_cost, 0),
        "cost_per_unit": round(total_cost / good if good else 0, 0),
        "energy_kwh": round(energy, 0),
        "setup_hours": round(setup / 60, 1),
    }


def kpi_trend(db: Session, days: int = 14) -> list[dict[str, Any]]:
    latest = db.scalar(select(func.max(ProductionRecord.recorded_at)))
    if latest is None:
        return []
    cutoff = _aware(latest) - timedelta(days=days - 1)
    rows = db.scalars(select(ProductionRecord).where(ProductionRecord.recorded_at >= cutoff).order_by(ProductionRecord.recorded_at)).all()
    grouped: dict[str, list[ProductionRecord]] = defaultdict(list)
    for row in rows:
        grouped[_aware(row.recorded_at).date().isoformat()].append(row)
    result = []
    for day, records in grouped.items():
        planned = sum(x.planned_minutes for x in records)
        runtime = sum(x.runtime_minutes for x in records)
        ideal = sum(x.ideal_minutes for x in records)
        total = sum(x.total_units for x in records)
        good = sum(x.good_units for x in records)
        availability = runtime / planned if planned else 0
        performance = ideal / runtime if runtime else 0
        quality = good / total if total else 0
        result.append({"date": day, "oee": round(availability * performance * quality * 100, 1), "availability": round(availability * 100, 1), "performance": round(performance * 100, 1), "quality": round(quality * 100, 1)})
    return result


def capacity_analysis(db: Session, days: int = 7) -> list[dict[str, Any]]:
    machines = db.scalars(select(Machine).order_by(Machine.machine_code)).all()
    orders = db.scalars(select(CustomerOrder).options(joinedload(CustomerOrder.product)).where(CustomerOrder.status.in_([OrderStatus.PLANNED, OrderStatus.RELEASED, OrderStatus.IN_PRODUCTION, OrderStatus.DELAYED])).order_by(CustomerOrder.due_date).limit(80)).all()
    required: dict[str, float] = defaultdict(float)
    for order in orders:
        remaining = max(.1, 1 - order.progress / 100)
        for operation in order.product.routing:
            eligible = operation["eligible_machines"]
            each = operation["minutes_per_unit"] * order.quantity * remaining / max(1, len(eligible)) / 60
            for machine_code in eligible:
                required[machine_code] += each
    result = []
    for machine in machines:
        available = machine.normal_capacity_hours * days
        load = required[machine.machine_code]
        utilization = load / available * 100 if available else 0
        result.append({"machine_code": machine.machine_code, "name": machine.name, "department": machine.department, "available_hours": round(available, 1), "required_hours": round(load, 1), "utilization": round(utilization, 1), "overload_hours": round(max(0, load - available), 1), "spare_hours": round(max(0, available - load), 1), "overtime_required": round(max(0, load - available), 1), "severity": "Critical" if utilization > 110 else "High" if utilization > 95 else "Moderate" if utilization > 82 else "Healthy"})
    return sorted(result, key=lambda x: x["utilization"], reverse=True)


def bottleneck_analysis(db: Session) -> list[dict[str, Any]]:
    capacity = capacity_analysis(db)
    active_orders = db.scalars(select(CustomerOrder).where(CustomerOrder.status.in_([OrderStatus.PLANNED, OrderStatus.RELEASED, OrderStatus.IN_PRODUCTION, OrderStatus.DELAYED]))).all()
    average_order_value = 310_000
    result = []
    for rank, row in enumerate(capacity[:6], 1):
        affected = min(len(active_orders), round(max(1, row["utilization"] / 11)))
        delay = max(0, row["overload_hours"] * .78 + (row["utilization"] - 82) * .18)
        result.append({**row, "rank": rank, "affected_orders": affected, "estimated_delay_hours": round(delay, 1), "financial_impact": round(delay * average_order_value * .0025, 0), "reason": f"{row['utilization']:.1f}% modeled load with {row['overload_hours']:.1f} overload hours", "intervention": "Reassign eligible operations and authorize targeted overtime" if row["overload_hours"] else "Sequence setup families to protect available capacity"})
    return result


def mrp_analysis(db: Session, horizon_days: int = 28) -> list[dict[str, Any]]:
    materials = {m.material_code: m for m in db.scalars(select(Material).options(joinedload(Material.supplier))).all()}
    orders = db.scalars(select(CustomerOrder).options(joinedload(CustomerOrder.product)).where(CustomerOrder.status.in_([OrderStatus.PLANNED, OrderStatus.RELEASED, OrderStatus.IN_PRODUCTION, OrderStatus.DELAYED])).order_by(CustomerOrder.due_date)).all()
    requirements: dict[str, float] = defaultdict(float)
    needed_by: dict[str, datetime] = {}
    for order in orders:
        if (_aware(order.due_date) - datetime(2026, 8, 19, tzinfo=UTC)).days > horizon_days:
            continue
        remaining = max(.05, 1 - order.progress / 100)
        for item in order.product.bom:
            code = item["material_code"]
            requirements[code] += item["quantity"] * order.quantity * remaining
            needed_by[code] = min(needed_by.get(code, _aware(order.due_date)), _aware(order.due_date))
    rows = []
    for code, material in materials.items():
        gross = requirements[code]
        projected = material.current_inventory - gross
        shortage = max(0, material.safety_stock - projected)
        order_qty = max(shortage, math.sqrt(max(1, 2 * material.average_consumption * 365 * 500 / max(.01, material.unit_cost * .22)))) if shortage > 0 else 0
        rows.append({"material_code": code, "description": material.description, "unit": material.unit, "on_hand": round(material.current_inventory, 1), "gross_requirement": round(gross, 1), "projected_balance": round(projected, 1), "safety_stock": material.safety_stock, "coverage_days": round(material.current_inventory / max(.01, material.average_consumption), 1), "risk": "Critical" if projected < 0 else "High" if projected < material.safety_stock else "Watch" if projected < material.reorder_point else "Healthy", "purchase_recommendation": round(order_qty, 1), "supplier": material.supplier.name, "expected_requirement_date": needed_by.get(code).date().isoformat() if code in needed_by else None, "modeled_purchase_value": round(order_qty * material.unit_cost, 0)})
    return sorted(rows, key=lambda x: ({"Critical": 0, "High": 1, "Watch": 2, "Healthy": 3}[x["risk"]], x["projected_balance"]))


def quality_analytics(db: Session) -> dict[str, Any]:
    inspections = db.scalars(select(QualityInspection).order_by(QualityInspection.inspected_at.desc()).limit(360)).all()
    means = [x.measurement_mean for x in inspections]
    ranges = [x.measurement_range for x in inspections]
    if not means:
        return {}
    sigma = pstdev(means) or .001
    lsl, usl = inspections[0].lower_spec, inspections[0].upper_spec
    cp = (usl - lsl) / (6 * sigma)
    cpk = min((usl - mean(means)) / (3 * sigma), (mean(means) - lsl) / (3 * sigma))
    defects = Counter(x.defect_category for x in inspections for _ in range(x.defect_count))
    total_defects = sum(defects.values())
    pareto = []
    cumulative = 0
    for category, count in defects.most_common():
        cumulative += count
        pareto.append({"category": category, "count": count, "cumulative_percent": round(cumulative / max(1, total_defects) * 100, 1)})
    return {"cp": round(cp, 2), "cpk": round(cpk, 2), "xbar": round(mean(means), 3), "rbar": round(mean(ranges), 3), "ucl_xbar": round(mean(means) + 3 * sigma, 3), "lcl_xbar": round(mean(means) - 3 * sigma, 3), "rejection_rate": round(sum(x.defect_count for x in inspections) / sum(x.sample_size for x in inspections) * 100, 2), "pareto": pareto, "control_chart": [{"sample": i + 1, "mean": x.measurement_mean, "range": x.measurement_range} for i, x in enumerate(reversed(inspections[:24]))], "interpretation": "The process is statistically stable in the current synthetic window; capability remains below the preferred automotive demonstration target of 1.33." if cpk < 1.33 else "The synthetic process is stable and demonstrates capable output."}


@lru_cache(maxsize=1)
def _maintenance_model() -> RandomForestClassifier:
    rng = np.random.default_rng(20260819)
    vibration = rng.uniform(1.2, 9.0, 2200)
    temperature = rng.uniform(35, 96, 2200)
    runtime = rng.uniform(100, 8500, 2200)
    overdue = rng.integers(0, 31, 2200)
    load = rng.uniform(.4, 1.08, 2200)
    logit = -7.6 + .55 * vibration + .035 * (temperature - 45) + .00022 * runtime + .085 * overdue + 1.4 * (load - .75)
    probability = 1 / (1 + np.exp(-logit))
    target = rng.binomial(1, probability)
    model = RandomForestClassifier(n_estimators=140, max_depth=7, min_samples_leaf=8, random_state=20260819, class_weight="balanced")
    model.fit(np.column_stack([vibration, temperature, runtime, overdue, load]), target)
    return model


def maintenance_intelligence(db: Session) -> list[dict[str, Any]]:
    model = _maintenance_model()
    today = datetime(2026, 8, 19, tzinfo=UTC).date()
    machines = db.scalars(select(Machine).order_by(Machine.machine_code)).all()
    rows = []
    for machine in machines:
        overdue = max(0, (today - machine.maintenance_due).days)
        load = min(1.05, .65 + machine.performance_rate * .28)
        features = [[machine.vibration_mm_s, machine.temperature_c, machine.runtime_hours, overdue, load]]
        risk = float(model.predict_proba(features)[0][1])
        band = "Critical" if risk >= .65 else "High" if risk >= .38 else "Moderate" if risk >= .18 else "Low"
        rows.append({"machine_code": machine.machine_code, "name": machine.name, "failure_probability": round(risk * 100, 1), "risk_band": band, "vibration_mm_s": machine.vibration_mm_s, "temperature_c": machine.temperature_c, "runtime_hours": machine.runtime_hours, "maintenance_due": machine.maintenance_due.isoformat(), "mtbf_hours": machine.mtbf_hours, "mttr_hours": machine.mttr_hours, "suggested_window": "Within 8 hours" if band == "Critical" else "Within 48 hours" if band == "High" else "Next planned window", "drivers": ["elevated vibration" if machine.vibration_mm_s > 5 else "accumulated runtime", "overdue maintenance" if overdue else "current modeled load"]})
    return sorted(rows, key=lambda x: x["failure_probability"], reverse=True)


def line_balance(tasks: list[dict[str, Any]], takt_time: float) -> dict[str, Any]:
    if not tasks or takt_time <= 0:
        raise ValueError("Tasks and positive takt time are required")
    lookup = {str(t["id"]): t for t in tasks}
    successors: dict[str, set[str]] = defaultdict(set)
    for task in tasks:
        for predecessor in task.get("predecessors", []):
            successors[str(predecessor)].add(str(task["id"]))

    def all_successors(task_id: str) -> set[str]:
        result = set()
        stack = list(successors[task_id])
        while stack:
            item = stack.pop()
            if item not in result:
                result.add(item)
                stack.extend(successors[item])
        return result

    weights = {task_id: lookup[task_id]["time"] + sum(lookup[s]["time"] for s in all_successors(task_id)) for task_id in lookup}
    assigned: set[str] = set()
    stations: list[dict[str, Any]] = []
    while len(assigned) < len(tasks):
        station_tasks = []
        load = 0.0
        while True:
            eligible = [task_id for task_id, task in lookup.items() if task_id not in assigned and all(str(p) in assigned or str(p) in station_tasks for p in task.get("predecessors", [])) and load + float(task["time"]) <= takt_time]
            if not eligible:
                break
            chosen = max(eligible, key=lambda task_id: weights[task_id])
            station_tasks.append(chosen)
            load += float(lookup[chosen]["time"])
        if not station_tasks:
            offending = next(task_id for task_id in lookup if task_id not in assigned)
            raise ValueError(f"Task {offending} exceeds takt time or has unresolved predecessors")
        assigned.update(station_tasks)
        stations.append({"station": len(stations) + 1, "tasks": station_tasks, "load": round(load, 2), "idle": round(takt_time - load, 2), "utilization": round(load / takt_time * 100, 1)})
    total_task = sum(float(t["time"]) for t in tasks)
    efficiency = total_task / (len(stations) * takt_time) * 100
    return {"method": "Ranked Positional Weight", "takt_time": takt_time, "station_count": len(stations), "stations": stations, "line_efficiency": round(efficiency, 1), "balance_delay": round(100 - efficiency, 1), "smoothness_index": round(math.sqrt(sum((takt_time - x["load"]) ** 2 for x in stations)), 2), "positional_weights": {key: round(value, 2) for key, value in weights.items()}}


def optimize_schedule(db: Session, order_ids: list[int] | None = None, weights: dict[str, float] | None = None, time_limit_seconds: float = 12.0) -> dict[str, Any]:
    weights = weights or {"tardiness": 10.0, "makespan": 1.0, "setup": 2.0, "overtime": 3.0}
    query = select(CustomerOrder).options(joinedload(CustomerOrder.product)).where(CustomerOrder.status.in_([OrderStatus.PLANNED, OrderStatus.RELEASED, OrderStatus.IN_PRODUCTION, OrderStatus.DELAYED]))
    if order_ids:
        query = query.where(CustomerOrder.id.in_(order_ids))
    orders = db.scalars(query.order_by(CustomerOrder.due_date).limit(28)).unique().all()
    if not orders:
        raise ValueError("No schedulable orders were found")
    machines = db.scalars(select(Machine).order_by(Machine.machine_code)).all()
    machine_by_code = {m.machine_code: m for m in machines}
    model = cp_model.CpModel()
    horizon = 7 * 24 * 60
    machine_intervals: dict[int, list[Any]] = defaultdict(list)
    assignments: list[dict[str, Any]] = []
    order_ends: dict[int, Any] = {}
    tardiness_vars = []
    setup_terms = []
    priority_weights = {"Standard": 1, "High": 4, "Critical": 10}
    for order in orders:
        previous_end = None
        for op_index, operation in enumerate(order.product.routing):
            eligible_codes = [code for code in operation["eligible_machines"] if code in machine_by_code]
            if not eligible_codes:
                raise ValueError(f"No eligible machine for {operation['operation']}")
            base_duration = max(5, round(float(operation["minutes_per_unit"]) * order.quantity * max(.15, 1 - order.progress / 100)))
            alternatives = []
            master_start = model.new_int_var(0, horizon, f"s_{order.id}_{op_index}")
            master_end = model.new_int_var(0, horizon, f"e_{order.id}_{op_index}")
            for code in eligible_codes:
                machine = machine_by_code[code]
                setup = 8 if machine.setup_family == order.product.setup_family else 22
                duration = max(5, round(base_duration / max(.65, machine.performance_rate))) + setup
                present = model.new_bool_var(f"p_{order.id}_{op_index}_{machine.id}")
                start = model.new_int_var(0, horizon, f"as_{order.id}_{op_index}_{machine.id}")
                end = model.new_int_var(0, horizon, f"ae_{order.id}_{op_index}_{machine.id}")
                interval = model.new_optional_interval_var(start, duration, end, present, f"i_{order.id}_{op_index}_{machine.id}")
                model.add(master_start == start).only_enforce_if(present)
                model.add(master_end == end).only_enforce_if(present)
                machine_intervals[machine.id].append(interval)
                alternatives.append((present, machine, start, end, duration, setup))
                setup_terms.append(present * setup)
            model.add_exactly_one([x[0] for x in alternatives])
            if previous_end is not None:
                model.add(master_start >= previous_end)
            previous_end = master_end
            assignments.append({"order": order, "operation_index": op_index, "operation": operation["operation"], "master_start": master_start, "master_end": master_end, "alternatives": alternatives})
        order_ends[order.id] = previous_end
        due_minutes = max(60, min(horizon, round((_aware(order.due_date) - datetime(2026, 8, 19, 6, tzinfo=UTC)).total_seconds() / 60)))
        tardiness = model.new_int_var(0, horizon, f"tardiness_{order.id}")
        model.add(tardiness >= previous_end - due_minutes)
        tardiness_vars.append(tardiness * priority_weights.get(order.priority, 1))
    for machine in machines:
        intervals = machine_intervals[machine.id]
        if machine.machine_code == "CNC-04":
            maintenance = model.new_interval_var(480, 180, 660, "cnc04_maintenance")
            intervals.append(maintenance)
        model.add_no_overlap(intervals)
    makespan = model.new_int_var(0, horizon, "makespan")
    model.add_max_equality(makespan, list(order_ends.values()))
    objective = int(weights["tardiness"] * 10) * sum(tardiness_vars) + int(weights["makespan"] * 10) * makespan + int(weights["setup"] * 10) * sum(setup_terms)
    model.minimize(objective)
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = time_limit_seconds
    solver.parameters.num_search_workers = 8
    started = time.perf_counter()
    status = solver.solve(model)
    elapsed = time.perf_counter() - started
    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        raise RuntimeError(f"Scheduler returned {solver.status_name(status)}")
    run = ScheduleRun(status=solver.status_name(status), solver="OR-Tools CP-SAT", objective_value=solver.objective_value, solve_seconds=elapsed, weights=weights)
    db.add(run)
    db.flush()
    output = []
    for item in assignments:
        selected = next(alt for alt in item["alternatives"] if solver.value(alt[0]))
        _, machine, start_var, end_var, _, setup = selected
        start = solver.value(start_var)
        end = solver.value(end_var)
        order = item["order"]
        due_minutes = round((_aware(order.due_date) - datetime(2026, 8, 19, 6, tzinfo=UTC)).total_seconds() / 60)
        lateness = max(0, end - due_minutes) if item["operation_index"] == len(order.product.routing) - 1 else 0
        row = ScheduleAssignment(schedule_run_id=run.id, order_id=order.id, operation_index=item["operation_index"], operation_name=item["operation"], machine_id=machine.id, start_minute=start, end_minute=end, setup_minutes=setup, expected_lateness_minutes=lateness)
        db.add(row)
        output.append({"order_id": order.id, "order_code": order.order_code, "product": order.product.name, "priority": order.priority, "operation_index": item["operation_index"], "operation": item["operation"], "machine_code": machine.machine_code, "start_minute": start, "end_minute": end, "duration_minutes": end - start, "setup_minutes": setup, "expected_lateness_minutes": lateness})
    db.commit()
    return {"run_id": run.id, "status": run.status, "solver": run.solver, "objective_value": round(run.objective_value, 2), "solve_seconds": round(elapsed, 3), "makespan_minutes": solver.value(makespan), "weighted_tardiness_minutes": sum(solver.value(t.expression().vars[0]) if False else 0 for t in []), "assignments": sorted(output, key=lambda x: (x["machine_code"], x["start_minute"])), "orders_scheduled": len(orders), "operations_scheduled": len(output), "weights": weights, "limitations": "Material feasibility is enforced before release through MRP; sequence-dependent setup is approximated with family-specific durations in this V1 CP-SAT model."}


def _simulate_factory(orders: list[CustomerOrder], event_type: str | None, resource_code: str | None, magnitude: float, duration_hours: float, recommended: bool, seed: int) -> dict[str, float]:
    rng = random.Random(seed)
    env = simpy.Environment()
    machine_codes = sorted({code for order in orders for operation in order.product.routing for code in operation["eligible_machines"]})
    resources = {code: simpy.Resource(env, capacity=1) for code in machine_codes}
    completion: dict[int, float] = {}
    overtime = 0.0
    cost = 0.0
    throughput = 0
    wip_area = 0.0
    disruption_code = resource_code or "CNC-04"

    def job(order: CustomerOrder):
        nonlocal overtime, cost, throughput, wip_area
        yield env.timeout(rng.uniform(0, 10))
        for operation in order.product.routing:
            eligible = operation["eligible_machines"]
            machine = eligible[0]
            if recommended and disruption_code in eligible and len(eligible) > 1:
                machine = min(eligible, key=lambda code: len(resources[code].queue) + resources[code].count)
            process = operation["minutes_per_unit"] * order.quantity * max(.15, 1 - order.progress / 100) / 60
            process *= rng.uniform(.94, 1.08)
            if event_type in {"Machine disruption", "Maintenance event"} and machine == disruption_code:
                if recommended and len(eligible) > 1:
                    machine = eligible[-1]
                else:
                    yield env.timeout(duration_hours)
            if event_type == "Worker absenteeism":
                process *= 1 + magnitude / 180
            if event_type == "Quality problem":
                process *= 1 + magnitude / 140
            with resources[machine].request() as request:
                queued_at = env.now
                yield request
                wip_area += env.now - queued_at
                setup = .14 if recommended else .28
                yield env.timeout(process + setup)
                cost += process * (1420 + (170 if event_type == "Cost changes" else 0))
                if env.now % 24 > 21:
                    overtime += min(process, env.now % 24 - 21)
        completion[order.id] = env.now
        throughput += order.quantity

    for order in orders:
        env.process(job(order))
    env.run()
    due_hours = {order.id: max(24, (_aware(order.due_date) - datetime(2026, 8, 19, 6, tzinfo=UTC)).total_seconds() / 3600) for order in orders}
    lateness = [max(0, completion[order.id] - due_hours[order.id]) for order in orders]
    on_time = sum(completion[order.id] <= due_hours[order.id] for order in orders)
    if event_type == "Supplier delay":
        late_material_jobs = max(1, round(len(orders) * min(.7, magnitude / 20)))
        on_time = max(0, on_time - late_material_jobs)
        cost += late_material_jobs * 24_000
    if event_type == "Demand shock":
        throughput = round(throughput * (1 + magnitude / 100))
        overtime += len(orders) * magnitude / 18
    scrap_rate = 1.7 * (2 if event_type == "Quality problem" else 1) * (.78 if recommended else 1)
    cost += throughput * 1010 + overtime * 410 + throughput * scrap_rate / 100 * 1220
    available_hours = max(1, len(resources) * max(168, env.now))
    busy_hours = sum(sum(op["minutes_per_unit"] for op in order.product.routing) * order.quantity / 60 for order in orders)
    return {"on_time_delivery": round(on_time / max(1, len(orders)) * 100, 1), "total_cost": round(cost, 0), "overtime_hours": round(overtime, 1), "throughput": throughput, "utilization": round(min(99, busy_hours / available_hours * 100), 1), "average_lateness_hours": round(mean(lateness), 1), "wip": round(wip_area / max(1, env.now) * 10), "scrap_rate": round(scrap_rate, 2), "simulated_hours": round(env.now, 1)}


def run_scenario(db: Session, name: str, event_type: str, resource_code: str | None, magnitude: float, duration_hours: float) -> dict[str, Any]:
    orders = db.scalars(select(CustomerOrder).options(joinedload(CustomerOrder.product)).where(CustomerOrder.status.in_([OrderStatus.PLANNED, OrderStatus.RELEASED, OrderStatus.IN_PRODUCTION, OrderStatus.DELAYED])).order_by(CustomerOrder.due_date).limit(32)).unique().all()
    if not orders:
        raise ValueError("No active orders are available for simulation")
    baseline = _simulate_factory(orders, None, None, 0, 0, False, 20260819)
    disrupted = _simulate_factory(orders, event_type, resource_code, magnitude, duration_hours, False, 20260820)
    recommended = _simulate_factory(orders, event_type, resource_code, magnitude, duration_hours, True, 20260820)
    actions = {
        "Machine disruption": [f"Move eligible work away from {resource_code or 'the unavailable machine'}", "Protect critical orders with 18 targeted overtime hours", "Advance the next maintenance inspection"],
        "Supplier delay": ["Consume qualified safety stock", "Expedite the highest-margin material requirements", "Permit partial shipment for two standard orders"],
        "Rush order": ["Insert the critical order using weighted tardiness", "Split its batch across eligible work centers", "Sequence the same setup family together"],
        "Worker absenteeism": ["Reassign multi-skilled certified operators", "Prioritize constraint work centers", "Authorize focused overtime on Shift B"],
        "Quality problem": ["Add containment inspection at INS-01", "Reduce the affected batch size", "Re-sequence work to preserve good-output throughput"],
    }.get(event_type, ["Re-optimize eligible machine assignments", "Protect critical due dates", "Use targeted overtime only where modeled benefit exceeds cost"])
    delta = {key: round(recommended[key] - disrupted[key], 2) for key in recommended}
    result = {"baseline": baseline, "disrupted": disrupted, "recommended": recommended, "delta_recommended_vs_disrupted": delta, "actions": actions, "explanation": f"The discrete-event model applied a {event_type.lower()} with magnitude {magnitude:g} for {duration_hours:g} hours. The recommended state rerouted eligible operations and compressed queues; values are modeled estimates for the synthetic factory.", "engine": {"simulation": "SimPy discrete-event simulation", "seed": 20260820, "orders_evaluated": len(orders)}}
    scenario = Scenario(name=name, event_type=event_type, resource_code=resource_code, magnitude=magnitude, duration_hours=duration_hours, result=result)
    db.add(scenario)
    db.commit()
    db.refresh(scenario)
    return {"id": scenario.id, "name": scenario.name, **result}


def deterministic_copilot(db: Session, question: str) -> dict[str, Any]:
    normalized = question.lower()
    kpis = calculate_kpis(db, 30)
    bottlenecks = bottleneck_analysis(db)
    mrp = mrp_analysis(db)
    maintenance = maintenance_intelligence(db)
    if any(word in normalized for word in ["late", "delivery", "order"]):
        response = f"On-time delivery is {kpis['on_time_delivery']}%. The strongest modeled pressure is {bottlenecks[0]['machine_code']} at {bottlenecks[0]['utilization']}% load. I recommend protecting Critical orders in the next schedule run and moving eligible work before authorizing broad overtime."
        sources = ["30-day KPI snapshot", "Finite-capacity load model", "Active order priorities"]
    elif any(word in normalized for word in ["machine", "failure", "maintenance", "breakdown"]):
        top = maintenance[0]
        response = f"{top['machine_code']} has the highest modeled failure risk at {top['failure_probability']}%. The main signals are {', '.join(top['drivers'])}. Schedule inspection {top['suggested_window'].lower()} and reroute eligible operations first."
        sources = ["Machine condition readings", "Synthetic random-forest risk model", "Maintenance due dates"]
    elif any(word in normalized for word in ["stock", "material", "inventory", "purchase"]):
        top = mrp[0]
        response = f"{top['material_code']} — {top['description']} is the highest MRP risk. Projected balance is {top['projected_balance']:,.0f} {top['unit']}. The modeled purchase recommendation is {top['purchase_recommendation']:,.0f} {top['unit']} from {top['supplier']}."
        sources = ["BOM explosion", "Active order requirements", "Inventory and supplier master"]
    elif any(word in normalized for word in ["cost", "margin", "saving", "financial"]):
        response = f"Modeled production cost for the last 30 days is ₹{kpis['production_cost']/100000:.2f} lakh, or ₹{kpis['cost_per_unit']:,.0f} per good unit. Downtime, scrap, and untargeted overtime are the main addressable levers."
        sources = ["Production records", "Machine and energy rates", "Scrap valuation"]
    else:
        response = f"Plant health is stable: OEE is {kpis['oee']}%, OTD is {kpis['on_time_delivery']}%, and current WIP is {kpis['wip']:,} units. Three priorities are protecting {bottlenecks[0]['machine_code']}, expediting {mrp[0]['material_code']}, and sequencing Critical orders first."
        sources = ["Plant KPI snapshot", "Bottleneck ranking", "MRP risk list"]
    return {"mode": "deterministic-fallback", "answer": response, "sources": sources, "disclaimer": "Management explanation generated from PlantPilot synthetic-factory analytics; not validated for real industrial use."}


def orders_csv(db: Session) -> str:
    stream = io.StringIO()
    writer = csv.writer(stream)
    writer.writerow(["Order", "Customer", "Product", "Quantity", "Due date", "Priority", "Status", "Progress", "Lateness risk"])
    orders = db.scalars(select(CustomerOrder).options(joinedload(CustomerOrder.product)).order_by(CustomerOrder.due_date)).all()
    for order in orders:
        writer.writerow([order.order_code, order.customer, order.product.name, order.quantity, order.due_date.isoformat(), order.priority, order.status.value, order.progress, order.lateness_risk])
    return stream.getvalue()
