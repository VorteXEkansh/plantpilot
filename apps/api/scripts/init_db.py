from app.database import Base, SessionLocal, engine
from app.seed import seed_database


if __name__ == "__main__":
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as session:
        result = seed_database(session)
        print(f"PlantPilot demo database ready: {result}")
