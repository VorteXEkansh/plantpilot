from functools import lru_cache

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "PlantPilot API"
    environment: str = "development"
    database_url: str = "sqlite:///./planpilot.db"
    secret_key: str = "development-only-change-me"
    access_token_minutes: int = 480
    cors_origins: str = "http://localhost:3000"
    openai_api_key: str | None = None
    synthetic_seed: int = 20260819

    model_config = SettingsConfigDict(env_file=(".env", "../../.env"), extra="ignore")

    @field_validator("database_url", mode="before")
    @classmethod
    def normalize_database_url(cls, value: object) -> object:
        """Use the declared psycopg v3 driver for Render-style Postgres URLs."""
        if not isinstance(value, str):
            return value
        if value.startswith("postgres://"):
            return value.replace("postgres://", "postgresql+psycopg://", 1)
        if value.startswith("postgresql://"):
            return value.replace("postgresql://", "postgresql+psycopg://", 1)
        return value

    @model_validator(mode="after")
    def validate_production_security(self) -> "Settings":
        if self.environment.lower() != "production":
            return self
        if len(self.secret_key) < 32 or self.secret_key in {
            "development-only-change-me",
            "plantpilot-demo-local-secret-change-me",
        }:
            raise ValueError("SECRET_KEY must be a unique value of at least 32 characters")
        if "*" in self.allowed_origins:
            raise ValueError("CORS_ORIGINS cannot contain '*' in production")
        return self

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
