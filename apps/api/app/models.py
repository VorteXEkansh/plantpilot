from __future__ import annotations

from datetime import date, datetime, timezone
from enum import Enum
from typing import Any

from sqlalchemy import Boolean, Date, DateTime, Enum as SQLEnum, Float, ForeignKey, Index, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class MachineState(str, Enum):
    RUNNING = "Running"
    IDLE = "Idle"
    SETUP = "Setup"
    MAINTENANCE = "Maintenance"
    BREAKDOWN = "Breakdown"
    OFFLINE = "Offline"


class OrderStatus(str, Enum):
    NEW = "New"
    PLANNED = "Planned"
    RELEASED = "Released"
    IN_PRODUCTION = "In Production"
    COMPLETED = "Completed"
    SHIPPED = "Shipped"
    DELAYED = "Delayed"


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(180), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(120))
    password_hash: Mapped[str] = mapped_column(String(256))
    role: Mapped[str] = mapped_column(String(30), default="admin")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Shift(Base):
    __tablename__ = "shifts"
    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(12), unique=True)
    name: Mapped[str] = mapped_column(String(40))
    start_hour: Mapped[int]
    end_hour: Mapped[int]


class Worker(Base):
    __tablename__ = "workers"
    id: Mapped[int] = mapped_column(primary_key=True)
    worker_code: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(100))
    department: Mapped[str] = mapped_column(String(40), index=True)
    shift_id: Mapped[int] = mapped_column(ForeignKey("shifts.id"))
    skills: Mapped[list[str]] = mapped_column(JSON)
    certifications: Mapped[list[str]] = mapped_column(JSON)
    hourly_wage: Mapped[float]
    overtime_rate: Mapped[float]
    experience_level: Mapped[str] = mapped_column(String(20))
    available: Mapped[bool] = mapped_column(Boolean, default=True)
    shift: Mapped[Shift] = relationship()


class Machine(Base):
    __tablename__ = "machines"
    id: Mapped[int] = mapped_column(primary_key=True)
    machine_code: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(100))
    machine_type: Mapped[str] = mapped_column(String(60), index=True)
    department: Mapped[str] = mapped_column(String(40), index=True)
    hourly_cost: Mapped[float]
    energy_kw: Mapped[float]
    normal_capacity_hours: Mapped[float] = mapped_column(default=21.0)
    supported_operations: Mapped[list[str]] = mapped_column(JSON)
    setup_family: Mapped[str] = mapped_column(String(30))
    performance_rate: Mapped[float]
    failure_probability: Mapped[float]
    state: Mapped[MachineState] = mapped_column(SQLEnum(MachineState), index=True)
    vibration_mm_s: Mapped[float]
    temperature_c: Mapped[float]
    runtime_hours: Mapped[float]
    maintenance_due: Mapped[date] = mapped_column(Date)
    mtbf_hours: Mapped[float]
    mttr_hours: Mapped[float]


class Product(Base):
    __tablename__ = "products"
    id: Mapped[int] = mapped_column(primary_key=True)
    sku: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120))
    family: Mapped[str] = mapped_column(String(50), index=True)
    selling_price: Mapped[float]
    target_cost: Mapped[float]
    setup_family: Mapped[str] = mapped_column(String(30))
    quality_target: Mapped[float]
    routing: Mapped[list[dict[str, Any]]] = mapped_column(JSON)
    bom: Mapped[list[dict[str, Any]]] = mapped_column(JSON)


class Supplier(Base):
    __tablename__ = "suppliers"
    id: Mapped[int] = mapped_column(primary_key=True)
    supplier_code: Mapped[str] = mapped_column(String(20), unique=True)
    name: Mapped[str] = mapped_column(String(120))
    standard_lead_days: Mapped[int]
    actual_lead_days: Mapped[float]
    reliability: Mapped[float]
    quality_rating: Mapped[float]
    payment_terms: Mapped[str] = mapped_column(String(40))


class Material(Base):
    __tablename__ = "materials"
    id: Mapped[int] = mapped_column(primary_key=True)
    material_code: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    description: Mapped[str] = mapped_column(String(140))
    category: Mapped[str] = mapped_column(String(40), index=True)
    unit: Mapped[str] = mapped_column(String(20))
    unit_cost: Mapped[float]
    current_inventory: Mapped[float]
    safety_stock: Mapped[float]
    reorder_point: Mapped[float]
    average_consumption: Mapped[float]
    supplier_id: Mapped[int] = mapped_column(ForeignKey("suppliers.id"))
    lead_time_days: Mapped[int]
    lead_time_variation: Mapped[float]
    supplier: Mapped[Supplier] = relationship()


class CustomerOrder(Base):
    __tablename__ = "customer_orders"
    id: Mapped[int] = mapped_column(primary_key=True)
    order_code: Mapped[str] = mapped_column(String(24), unique=True, index=True)
    customer: Mapped[str] = mapped_column(String(120), index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), index=True)
    quantity: Mapped[int]
    order_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    due_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    promised_date: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    priority: Mapped[str] = mapped_column(String(20), index=True)
    status: Mapped[OrderStatus] = mapped_column(SQLEnum(OrderStatus), index=True)
    progress: Mapped[float] = mapped_column(default=0)
    estimated_completion: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    lateness_risk: Mapped[float] = mapped_column(default=0)
    product: Mapped[Product] = relationship()

    __table_args__ = (Index("ix_order_due_status", "due_date", "status"),)


class ProductionRecord(Base):
    __tablename__ = "production_records"
    id: Mapped[int] = mapped_column(primary_key=True)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    machine_id: Mapped[int] = mapped_column(ForeignKey("machines.id"), index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"))
    planned_minutes: Mapped[float]
    runtime_minutes: Mapped[float]
    ideal_minutes: Mapped[float]
    total_units: Mapped[int]
    good_units: Mapped[int]
    scrap_units: Mapped[int]
    downtime_minutes: Mapped[float]
    setup_minutes: Mapped[float]
    energy_kwh: Mapped[float]


class ScheduleRun(Base):
    __tablename__ = "schedule_runs"
    id: Mapped[int] = mapped_column(primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    status: Mapped[str] = mapped_column(String(20))
    solver: Mapped[str] = mapped_column(String(40))
    objective_value: Mapped[float]
    solve_seconds: Mapped[float]
    weights: Mapped[dict[str, float]] = mapped_column(JSON)
    assignments: Mapped[list[ScheduleAssignment]] = relationship(cascade="all, delete-orphan")


class ScheduleAssignment(Base):
    __tablename__ = "schedule_assignments"
    id: Mapped[int] = mapped_column(primary_key=True)
    schedule_run_id: Mapped[int] = mapped_column(ForeignKey("schedule_runs.id"), index=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("customer_orders.id"), index=True)
    operation_index: Mapped[int]
    operation_name: Mapped[str] = mapped_column(String(80))
    machine_id: Mapped[int] = mapped_column(ForeignKey("machines.id"), index=True)
    start_minute: Mapped[int]
    end_minute: Mapped[int]
    setup_minutes: Mapped[int]
    expected_lateness_minutes: Mapped[int]
    machine: Mapped[Machine] = relationship()
    order: Mapped[CustomerOrder] = relationship()


class MaintenanceEvent(Base):
    __tablename__ = "maintenance_events"
    id: Mapped[int] = mapped_column(primary_key=True)
    machine_id: Mapped[int] = mapped_column(ForeignKey("machines.id"), index=True)
    event_type: Mapped[str] = mapped_column(String(30))
    start_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    duration_hours: Mapped[float]
    cost: Mapped[float]
    status: Mapped[str] = mapped_column(String(20))
    notes: Mapped[str] = mapped_column(Text)


class QualityInspection(Base):
    __tablename__ = "quality_inspections"
    id: Mapped[int] = mapped_column(primary_key=True)
    inspected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    machine_id: Mapped[int] = mapped_column(ForeignKey("machines.id"))
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"))
    sample_size: Mapped[int]
    defect_count: Mapped[int]
    measurement_mean: Mapped[float]
    measurement_range: Mapped[float]
    lower_spec: Mapped[float]
    upper_spec: Mapped[float]
    defect_category: Mapped[str] = mapped_column(String(80))
    rework_units: Mapped[int]


class Scenario(Base):
    __tablename__ = "scenarios"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    event_type: Mapped[str] = mapped_column(String(40), index=True)
    resource_code: Mapped[str | None] = mapped_column(String(30))
    magnitude: Mapped[float]
    duration_hours: Mapped[float]
    status: Mapped[str] = mapped_column(String(20), default="Completed")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    result: Mapped[dict[str, Any]] = mapped_column(JSON)


class Alert(Base):
    __tablename__ = "alerts"
    id: Mapped[int] = mapped_column(primary_key=True)
    severity: Mapped[str] = mapped_column(String(20), index=True)
    source: Mapped[str] = mapped_column(String(40))
    title: Mapped[str] = mapped_column(String(160))
    message: Mapped[str] = mapped_column(Text)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    acknowledged: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(String(80), index=True)
    entity_type: Mapped[str] = mapped_column(String(50))
    entity_id: Mapped[str] = mapped_column(String(50))
    detail: Mapped[dict[str, Any]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
