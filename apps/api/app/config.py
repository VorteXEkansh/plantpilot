from functools import lru_cache
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

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
