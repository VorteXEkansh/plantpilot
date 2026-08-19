# Deployment

## Local production-shaped deployment

1. Install and start Docker Desktop.
2. Copy `.env.example` to `.env`.
3. Replace `SECRET_KEY` for any non-demo environment.
4. Run `docker compose up --build`.

Compose starts PostgreSQL, waits for health, applies Alembic, seeds an empty demo database, starts FastAPI, then starts the web application.

## URLs

- web: `http://localhost:3000`
- API: `http://localhost:8000`
- OpenAPI: `http://localhost:8000/docs`

## Environment

- `DATABASE_URL`: SQLAlchemy PostgreSQL connection.
- `SECRET_KEY`: token signing secret; required outside local demo.
- `CORS_ORIGINS`: comma-separated web origins.
- `NEXT_PUBLIC_API_URL`: browser-visible API base URL.
- `SYNTHETIC_SEED`: defaults to 20260819.
- `OPENAI_API_KEY`: optional live-LLM enhancement; core Copilot fallback does not require it.

## Public demo safety

- use a separate demo database;
- keep destructive reset unavailable or authenticated;
- rotate demo secret and database password;
- allow only the published web origin in CORS;
- place TLS and rate limiting in front of API write/AI endpoints;
- do not expose Postgres publicly;
- never commit `.env`;
- state prominently that data and savings are synthetic/modeled.

## Cloud split

The web application is compatible with Sites deployment. The Python/PostgreSQL API requires a container platform such as Render, Railway, Fly.io, AWS, Azure, or GCP. Configure `NEXT_PUBLIC_API_URL` to the TLS API address and set CORS to the final web origin.

## Rollback and backup

Use versioned images and database backups before migrations. Alembic contains a reversible initial schema, but production data rollback should restore a tested backup rather than rely on dropping tables.
