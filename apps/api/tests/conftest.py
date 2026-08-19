import os
from pathlib import Path

TEST_DB = Path(__file__).parent / "test-planpilot.db"
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB.as_posix()}"
os.environ["SECRET_KEY"] = "test-secret-key"

import pytest
from fastapi.testclient import TestClient

from app.database import Base, SessionLocal, engine
from app.main import app
from app.seed import seed_database


@pytest.fixture(scope="session", autouse=True)
def database():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as session:
        seed_database(session)
    yield
    Base.metadata.drop_all(engine)
    engine.dispose()
    TEST_DB.unlink(missing_ok=True)


@pytest.fixture()
def db():
    with SessionLocal() as session:
        yield session


@pytest.fixture()
def client():
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture()
def auth_headers(client):
    response = client.post("/api/v1/auth/login", json={"email": "admin@plantpilot.local", "password": "PlantPilot@2026"})
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}
