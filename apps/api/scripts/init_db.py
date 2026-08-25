from app.database import SessionLocal
from app.seed import seed_database


if __name__ == "__main__":
    with SessionLocal() as session:
        result = seed_database(session)
        print(f"PlantPilot demo database ready: {result}")
