from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class LoginRequest(BaseModel):
    email: str = Field(min_length=5, max_length=180, pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
    password: str = Field(min_length=8, max_length=128)


class OrderCreate(BaseModel):
    customer: str = Field(min_length=2, max_length=120)
    product_id: int
    quantity: int = Field(ge=1, le=10000)
    due_date: datetime
    priority: Literal["Standard", "High", "Critical"] = "Standard"


class OrderUpdate(BaseModel):
    quantity: int | None = Field(default=None, ge=1, le=10000)
    due_date: datetime | None = None
    priority: Literal["Standard", "High", "Critical"] | None = None
    status: Literal["New", "Planned", "Released", "In Production", "Completed", "Shipped", "Delayed"] | None = None
    progress: float | None = Field(default=None, ge=0, le=100)


class ScheduleRequest(BaseModel):
    order_ids: list[int] | None = None
    weights: dict[str, float] = Field(default_factory=lambda: {"tardiness": 10, "makespan": 1, "setup": 2, "overtime": 3})
    time_limit_seconds: float = Field(default=10, ge=1, le=60)

    @field_validator("weights")
    @classmethod
    def validate_weights(cls, value: dict[str, float]) -> dict[str, float]:
        required = {"tardiness", "makespan", "setup", "overtime"}
        if set(value) != required or any(number < 0 or number > 100 for number in value.values()):
            raise ValueError(f"weights must contain {sorted(required)} with values from 0 to 100")
        return value


class ScenarioRequest(BaseModel):
    name: str = Field(min_length=3, max_length=120)
    event_type: Literal["Machine disruption", "Demand shock", "Rush order", "Supplier delay", "Raw material shortage", "Worker absenteeism", "Quality problem", "Maintenance event", "Shift change", "Overtime", "Cost changes"]
    resource_code: str | None = Field(default=None, max_length=30)
    magnitude: float = Field(default=25, ge=0, le=1000)
    duration_hours: float = Field(default=12, ge=0, le=720)


class LineBalanceRequest(BaseModel):
    takt_time: float = Field(gt=0, le=600)
    tasks: list[dict[str, Any]] = Field(min_length=1, max_length=100)


class CopilotRequest(BaseModel):
    question: str = Field(min_length=3, max_length=1000)


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)
