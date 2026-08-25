# Deployment

## Live production

| Surface | Production value |
| --- | --- |
| Sites frontend | `https://planpilot-factory.vortexblaster.chatgpt.site` |
| Render API | `https://plantpilot-api.onrender.com` |
| Health | `https://plantpilot-api.onrender.com/health` |
| OpenAPI | `https://plantpilot-api.onrender.com/docs` |
| GitHub source | `https://github.com/VorteXEkansh/plantpilot` (`main`) |

The current Sites access policy is owner-only. The production topology is:

```text
Sites frontend
    └── HTTPS + CORS ──> plantpilot-api (Render free web service, Singapore)
                              └── private DATABASE_URL ──> plantpilot-db
                                                           (Render PostgreSQL 17, Singapore)
```

`NEXT_PUBLIC_API_URL` is set in the existing Sites project to `https://plantpilot-api.onrender.com`. Render's `CORS_ORIGINS` includes the exact Sites origin and local development only.

## Render resources

| Resource | Type | Plan | Region | Production state |
| --- | --- | --- | --- | --- |
| `plantpilot-api` | Python/FastAPI web service | Free | Singapore | Live |
| `plantpilot-db` | PostgreSQL 17 | Free | Singapore | Available |

The API start command applies `alembic upgrade head`, seeds only missing deterministic demo data, then binds Uvicorn to Render's assigned port. The cloud seed contains 15 machines, 60 workers, 8 products, 24 materials, 420 orders, 2,700 production records, and 720 quality inspections.

The free PostgreSQL instance expires on **2026-09-24** and has no managed backups. Upgrade it or migrate its data before expiry for an enduring production deployment. The free web service may spin down when idle and can take about a minute to cold-start.

## Production verification

The public API verification on 2026-08-25 passed:

- `/health`: HTTP 200, `status=healthy`, `database=connected`;
- `/docs`: HTTP 200;
- valid login: HTTP 200; invalid and anonymous protected requests: HTTP 401;
- dashboard, orders, inventory/MRP, maintenance, quality, and executive report endpoints: HTTP 200; the production frontend renders the inventory, maintenance, and quality responses directly;
- OR-Tools CP-SAT: `FEASIBLE`, 28 orders and 134 operations scheduled, zero weighted tardiness in the test run;
- SimPy Scenario Lab: 32 orders evaluated with seed 20260820;
- CNC-04 12-hour disruption: disrupted OTD 62.5%, recommended OTD 65.6%, average lateness 14.5→12.2 hours, WIP 123→112, modeled cost ₹2,288,893→₹2,282,706;
- CORS preflight from the Sites origin: HTTP 200 with the exact `Access-Control-Allow-Origin` value.

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

The production web application is deployed on Sites, while the Python/PostgreSQL backend runs on Render. For another environment, configure `NEXT_PUBLIC_API_URL` to its TLS API address and set CORS to the final web origin.

## Rollback and backup

Use versioned builds and database backups before migrations. Alembic contains a reversible initial schema, but production data rollback should restore a tested backup rather than rely on dropping tables. Render free PostgreSQL does not provide managed backups, so export the database before material changes or expiry.
