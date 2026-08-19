from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import Depends, FastAPI, Header, HTTPException, Query, Response, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from .config import settings
from .database import get_db
from .models import Alert, AuditLog, CustomerOrder, Machine, Material, OrderStatus, Product, Scenario, Supplier, User, Worker
from .schemas import CopilotRequest, LineBalanceRequest, LoginRequest, OrderCreate, OrderUpdate, ScenarioRequest, ScheduleRequest
from .security import create_access_token, decode_access_token, verify_password
from .services import (
    bottleneck_analysis,
    calculate_kpis,
    capacity_analysis,
    deterministic_copilot,
    kpi_trend,
    line_balance,
    maintenance_intelligence,
    mrp_analysis,
    optimize_schedule,
    orders_csv,
    quality_analytics,
    run_scenario,
)

app = FastAPI(
    title="PlantPilot API",
    description="Manufacturing operations, optimization, and simulation API for the ApexMotion synthetic factory.",
    version="1.0.0",
    contact={"name": "PlantPilot"},
    license_info={"name": "MIT"},
)
app.add_middleware(CORSMiddleware, allow_origins=settings.allowed_origins, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

Db = Annotated[Session, Depends(get_db)]


def current_user(authorization: Annotated[str | None, Header()] = None, db: Session = Depends(get_db)) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required")
    email = decode_access_token(authorization.removeprefix("Bearer "))
    user = db.scalar(select(User).where(User.email == email)) if email else None
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return user


def order_dict(order: CustomerOrder) -> dict:
    return {"id": order.id, "order_code": order.order_code, "customer": order.customer, "product_id": order.product_id, "product": order.product.name, "sku": order.product.sku, "quantity": order.quantity, "order_date": order.order_date, "due_date": order.due_date, "promised_date": order.promised_date, "priority": order.priority, "status": order.status.value, "progress": order.progress, "estimated_completion": order.estimated_completion, "lateness_risk": round(order.lateness_risk * 100, 1), "production_requirements": order.product.routing, "material_requirements": order.product.bom}


@app.get("/health", tags=["System"])
def health(db: Db) -> dict:
    return {"status": "healthy", "service": "PlantPilot API", "version": "1.0.0", "database": "connected" if db.scalar(select(func.count()).select_from(User)) is not None else "unavailable", "timezone": "Asia/Kolkata", "synthetic_data": True}


@app.post("/api/v1/auth/login", tags=["Authentication"])
def login(payload: LoginRequest, db: Db) -> dict:
    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    return {"access_token": create_access_token(user.email), "token_type": "bearer", "expires_in_minutes": settings.access_token_minutes, "user": {"id": user.id, "email": user.email, "full_name": user.full_name, "role": user.role}}


@app.get("/api/v1/dashboard", tags=["Command Center"])
def dashboard(db: Db) -> dict:
    alerts = db.scalars(select(Alert).order_by(Alert.created_at.desc()).limit(6)).all()
    machines = db.scalars(select(Machine).order_by(Machine.machine_code)).all()
    kpis = calculate_kpis(db, 30)
    return {"plant": {"name": "ApexMotion Components Pvt. Ltd.", "location": "Manesar, Haryana, India", "timezone": "Asia/Kolkata", "currency": "INR", "health_score": round((kpis.get("oee", 0) + kpis.get("on_time_delivery", 0)) / 2, 0), "status": "Stable"}, "kpis": kpis, "trend": kpi_trend(db), "bottlenecks": bottleneck_analysis(db)[:4], "alerts": [{"id": a.id, "severity": a.severity, "source": a.source, "title": a.title, "message": a.message, "is_read": a.is_read, "acknowledged": a.acknowledged, "created_at": a.created_at} for a in alerts], "machine_states": [{"machine_code": m.machine_code, "name": m.name, "department": m.department, "state": m.state.value} for m in machines], "disclaimer": "PlantPilot operates on a realistic synthetic automotive-component manufacturing dataset designed for experimentation, optimization and educational demonstration."}


@app.get("/api/v1/orders", tags=["Orders"])
def list_orders(db: Db, search: str | None = None, priority: str | None = None, order_status: str | None = Query(default=None, alias="status"), limit: int = Query(default=100, ge=1, le=500), offset: int = Query(default=0, ge=0)) -> dict:
    query = select(CustomerOrder).options(joinedload(CustomerOrder.product))
    if search:
        pattern = f"%{search}%"
        query = query.where(or_(CustomerOrder.order_code.ilike(pattern), CustomerOrder.customer.ilike(pattern)))
    if priority:
        query = query.where(CustomerOrder.priority == priority)
    if order_status:
        try:
            query = query.where(CustomerOrder.status == OrderStatus(order_status))
        except ValueError as exc:
            raise HTTPException(422, detail="Unknown order status") from exc
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    rows = db.scalars(query.order_by(CustomerOrder.due_date.desc()).offset(offset).limit(limit)).unique().all()
    return {"items": [order_dict(row) for row in rows], "total": total, "limit": limit, "offset": offset}


@app.get("/api/v1/orders/{order_id}", tags=["Orders"])
def get_order(order_id: int, db: Db) -> dict:
    order = db.scalar(select(CustomerOrder).options(joinedload(CustomerOrder.product)).where(CustomerOrder.id == order_id))
    if not order:
        raise HTTPException(404, detail="Order not found")
    return order_dict(order)


@app.post("/api/v1/orders", status_code=status.HTTP_201_CREATED, tags=["Orders"])
def create_order(payload: OrderCreate, db: Db, user: User = Depends(current_user)) -> dict:
    product = db.get(Product, payload.product_id)
    if not product:
        raise HTTPException(422, detail="Product does not exist")
    now = datetime.now(timezone.utc)
    if payload.due_date <= now:
        raise HTTPException(422, detail="Due date must be in the future")
    next_number = (db.scalar(select(func.max(CustomerOrder.id))) or 0) + 2201
    risk = min(.95, .08 + payload.quantity / 240 + (.25 if payload.priority == "Critical" else .08 if payload.priority == "High" else 0))
    order = CustomerOrder(order_code=f"AM-{next_number:04d}", customer=payload.customer, product_id=payload.product_id, quantity=payload.quantity, order_date=now, due_date=payload.due_date, promised_date=payload.due_date, priority=payload.priority, status=OrderStatus.NEW, progress=0, estimated_completion=payload.due_date + timedelta(hours=max(-12, (risk - .45) * 36)), lateness_risk=risk)
    db.add(order)
    db.flush()
    db.add(AuditLog(user_id=user.id, action="order.create", entity_type="CustomerOrder", entity_id=str(order.id), detail={"order_code": order.order_code}))
    db.commit()
    db.refresh(order)
    order.product = product
    return order_dict(order)


@app.patch("/api/v1/orders/{order_id}", tags=["Orders"])
def update_order(order_id: int, payload: OrderUpdate, db: Db, user: User = Depends(current_user)) -> dict:
    order = db.scalar(select(CustomerOrder).options(joinedload(CustomerOrder.product)).where(CustomerOrder.id == order_id))
    if not order:
        raise HTTPException(404, detail="Order not found")
    changes = payload.model_dump(exclude_unset=True)
    if "status" in changes:
        changes["status"] = OrderStatus(changes["status"])
    for key, value in changes.items():
        setattr(order, key, value)
    db.add(AuditLog(user_id=user.id, action="order.update", entity_type="CustomerOrder", entity_id=str(order.id), detail=payload.model_dump(exclude_unset=True, mode="json")))
    db.commit()
    return order_dict(order)


@app.get("/api/v1/products", tags=["Factory Master"])
def products(db: Db) -> list[dict]:
    rows = db.scalars(select(Product).order_by(Product.name)).all()
    return [{"id": p.id, "sku": p.sku, "name": p.name, "family": p.family, "selling_price": p.selling_price, "target_cost": p.target_cost, "setup_family": p.setup_family, "quality_target": p.quality_target, "routing": p.routing, "bom": p.bom} for p in rows]


@app.get("/api/v1/machines", tags=["Factory Master"])
def machines(db: Db) -> list[dict]:
    rows = db.scalars(select(Machine).order_by(Machine.machine_code)).all()
    risks = {row["machine_code"]: row for row in maintenance_intelligence(db)}
    return [{"id": m.id, "machine_code": m.machine_code, "name": m.name, "machine_type": m.machine_type, "department": m.department, "hourly_cost": m.hourly_cost, "energy_kw": m.energy_kw, "capacity_hours": m.normal_capacity_hours, "supported_operations": m.supported_operations, "state": m.state.value, "performance_rate": m.performance_rate, "vibration_mm_s": m.vibration_mm_s, "temperature_c": m.temperature_c, "maintenance": risks[m.machine_code]} for m in rows]


@app.get("/api/v1/workers", tags=["Factory Master"])
def workers(db: Db) -> list[dict]:
    rows = db.scalars(select(Worker).options(joinedload(Worker.shift)).order_by(Worker.worker_code)).all()
    return [{"id": w.id, "worker_code": w.worker_code, "name": w.name, "department": w.department, "shift": w.shift.name, "skills": w.skills, "certifications": w.certifications, "available": w.available, "hourly_wage": w.hourly_wage, "overtime_rate": w.overtime_rate, "experience_level": w.experience_level} for w in rows]


@app.get("/api/v1/inventory", tags=["Inventory & MRP"])
def inventory(db: Db) -> dict:
    materials = db.scalars(select(Material).options(joinedload(Material.supplier)).order_by(Material.material_code)).all()
    return {"items": [{"id": m.id, "material_code": m.material_code, "description": m.description, "category": m.category, "unit": m.unit, "unit_cost": m.unit_cost, "current_inventory": m.current_inventory, "safety_stock": m.safety_stock, "reorder_point": m.reorder_point, "coverage_days": round(m.current_inventory / max(.01, m.average_consumption), 1), "supplier": m.supplier.name, "lead_time_days": m.lead_time_days, "status": "Critical" if m.current_inventory < m.safety_stock else "Low" if m.current_inventory < m.reorder_point else "Healthy"} for m in materials], "mrp": mrp_analysis(db)}


@app.get("/api/v1/suppliers", tags=["Inventory & MRP"])
def suppliers(db: Db) -> list[dict]:
    rows = db.scalars(select(Supplier).order_by(Supplier.supplier_code)).all()
    return [{"id": s.id, "supplier_code": s.supplier_code, "name": s.name, "standard_lead_days": s.standard_lead_days, "actual_lead_days": s.actual_lead_days, "reliability": round(s.reliability * 100, 1), "quality_rating": round(s.quality_rating * 100, 1), "payment_terms": s.payment_terms} for s in rows]


@app.post("/api/v1/scheduling/run", tags=["Scheduling"])
def scheduling(payload: ScheduleRequest, db: Db, user: User = Depends(current_user)) -> dict:
    try:
        result = optimize_schedule(db, payload.order_ids, payload.weights, payload.time_limit_seconds)
        db.add(AuditLog(user_id=user.id, action="schedule.run", entity_type="ScheduleRun", entity_id=str(result["run_id"]), detail={"orders": result["orders_scheduled"], "objective": result["objective_value"]}))
        db.commit()
        return result
    except (ValueError, RuntimeError) as exc:
        raise HTTPException(422, detail=str(exc)) from exc


@app.get("/api/v1/capacity", tags=["Planning"])
def capacity(db: Db, days: int = Query(default=7, ge=1, le=28)) -> list[dict]:
    return capacity_analysis(db, days)


@app.get("/api/v1/bottlenecks", tags=["Planning"])
def bottlenecks(db: Db) -> list[dict]:
    return bottleneck_analysis(db)


@app.post("/api/v1/line-balancing", tags=["Planning"])
def balance(payload: LineBalanceRequest) -> dict:
    try:
        return line_balance(payload.tasks, payload.takt_time)
    except ValueError as exc:
        raise HTTPException(422, detail=str(exc)) from exc


@app.get("/api/v1/maintenance", tags=["Factory Intelligence"])
def maintenance(db: Db) -> dict:
    return {"machines": maintenance_intelligence(db), "model_card": {"model": "Random Forest classifier", "training_data": "2,200 deterministic synthetic condition examples", "features": ["vibration", "temperature", "runtime", "days overdue", "modeled load"], "intended_use": "Educational prioritization in the PlantPilot synthetic factory", "limitations": "Not validated on real equipment and must not drive industrial maintenance without engineering review."}}


@app.get("/api/v1/quality", tags=["Factory Intelligence"])
def quality(db: Db) -> dict:
    return quality_analytics(db)


@app.post("/api/v1/scenarios", status_code=201, tags=["Scenario Lab"])
def scenario(payload: ScenarioRequest, db: Db, user: User = Depends(current_user)) -> dict:
    try:
        result = run_scenario(db, payload.name, payload.event_type, payload.resource_code, payload.magnitude, payload.duration_hours)
        db.add(AuditLog(user_id=user.id, action="scenario.run", entity_type="Scenario", entity_id=str(result["id"]), detail={"event_type": payload.event_type}))
        db.commit()
        return result
    except ValueError as exc:
        raise HTTPException(422, detail=str(exc)) from exc


@app.get("/api/v1/scenarios", tags=["Scenario Lab"])
def scenarios(db: Db) -> list[dict]:
    rows = db.scalars(select(Scenario).order_by(Scenario.created_at.desc())).all()
    return [{"id": s.id, "name": s.name, "event_type": s.event_type, "resource_code": s.resource_code, "magnitude": s.magnitude, "duration_hours": s.duration_hours, "status": s.status, "created_at": s.created_at, "result": s.result} for s in rows]


@app.delete("/api/v1/scenarios/{scenario_id}", status_code=204, tags=["Scenario Lab"])
def delete_scenario(scenario_id: int, db: Db, user: User = Depends(current_user)) -> Response:
    row = db.get(Scenario, scenario_id)
    if not row:
        raise HTTPException(404, detail="Scenario not found")
    db.delete(row)
    db.commit()
    return Response(status_code=204)


@app.post("/api/v1/copilot", tags=["PlantPilot Copilot"])
def copilot(payload: CopilotRequest, db: Db) -> dict:
    # Optional external LLM mode can be added without changing the deterministic analytics contract.
    return deterministic_copilot(db, payload.question)


@app.get("/api/v1/alerts", tags=["Alerts"])
def alerts(db: Db) -> list[dict]:
    rows = db.scalars(select(Alert).order_by(Alert.created_at.desc())).all()
    return [{"id": a.id, "severity": a.severity, "source": a.source, "title": a.title, "message": a.message, "is_read": a.is_read, "acknowledged": a.acknowledged, "created_at": a.created_at} for a in rows]


@app.post("/api/v1/alerts/{alert_id}/acknowledge", tags=["Alerts"])
def acknowledge(alert_id: int, db: Db, user: User = Depends(current_user)) -> dict:
    row = db.get(Alert, alert_id)
    if not row:
        raise HTTPException(404, detail="Alert not found")
    row.is_read = True
    row.acknowledged = True
    db.commit()
    return {"id": row.id, "acknowledged": True}


@app.get("/api/v1/reports/executive", tags=["Reports"])
def executive_report(db: Db) -> dict:
    kpis = calculate_kpis(db)
    bottlenecks = bottleneck_analysis(db)
    return {"title": "PlantPilot Executive Manufacturing Summary", "generated_at": datetime.now(timezone.utc), "period": "Last 30 synthetic-factory days", "headline": f"Plant OEE is {kpis['oee']}% with {kpis['on_time_delivery']}% on-time delivery.", "kpis": kpis, "top_risks": bottlenecks[:3], "recommendations": ["Protect critical due dates at the top-ranked constraint", "Expedite materials below safety stock", "Convert broad overtime into targeted constraint overtime"], "disclaimer": "All performance and financial values are modeled or observed in the PlantPilot synthetic factory."}


@app.get("/api/v1/reports/orders.csv", tags=["Reports"])
def export_orders(db: Db) -> Response:
    return Response(content=orders_csv(db), media_type="text/csv", headers={"Content-Disposition": 'attachment; filename="plantpilot-orders.csv"'})


@app.get("/api/v1/settings", tags=["Administration"])
def application_settings() -> dict:
    return {"timezone": "Asia/Kolkata", "currency": "INR", "planning_horizon_days": 7, "capacity_horizon_days": 28, "demo_mode": True, "copilot_mode": "AI-enhanced" if settings.openai_api_key else "deterministic-fallback", "synthetic_seed": settings.synthetic_seed}
