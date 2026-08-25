import pytest
from pydantic import ValidationError

from app.config import Settings


@pytest.mark.parametrize(
    ("provided", "expected"),
    [
        (
            "postgres://user:password@db.internal/plantpilot",
            "postgresql+psycopg://user:password@db.internal/plantpilot",
        ),
        (
            "postgresql://user:password@db.internal/plantpilot",
            "postgresql+psycopg://user:password@db.internal/plantpilot",
        ),
    ],
)
def test_render_database_urls_use_psycopg(provided, expected):
    settings = Settings(_env_file=None, database_url=provided)
    assert settings.database_url == expected


def test_production_rejects_insecure_secret():
    with pytest.raises(ValidationError, match="SECRET_KEY"):
        Settings(
            _env_file=None,
            environment="production",
            secret_key="development-only-change-me",
            cors_origins="https://planpilot-factory.vortexblaster.chatgpt.site",
        )


def test_production_rejects_wildcard_cors():
    with pytest.raises(ValidationError, match="CORS_ORIGINS"):
        Settings(
            _env_file=None,
            environment="production",
            secret_key="a-unique-production-secret-with-at-least-32-characters",
            cors_origins="*",
        )
