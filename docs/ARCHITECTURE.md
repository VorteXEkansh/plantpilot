# PlantPilot Architecture

## System context

PlantPilot is a modular monolith: one TypeScript web application and one Python API share one relational database. Optimization, simulation, analytics, and ML remain service modules inside the API because they share transaction and domain boundaries and do not yet justify independent services.

```text
User
 │
 ▼
PlantPilot web (React/vinext)
 │ HTTPS / JSON
 ▼
FastAPI application
 ├── Authentication and audit
 ├── Orders and factory master data
 ├── KPI / cost / MRP / SPC analytics
 ├── OR-Tools scheduling
 ├── SimPy scenario evaluation
 └── maintenance risk classifier
 │
 ▼
PostgreSQL (SQLite only for local native development/tests)
```

## Backend layers

- `app/models.py`: relational domain entities and indexes.
- `app/seed.py`: deterministic correlated synthetic data generator.
- `app/services.py`: pure-ish decision services for KPI, capacity, MRP, SPC, optimization, simulation, maintenance, reports, and Copilot fallback.
- `app/main.py`: versioned HTTP contracts, validation, authentication, status codes, and CORS.
- `alembic/`: controlled schema migration history.

The API returns numeric source values; currency and percentage formatting belong to the web client. All timestamps are timezone-aware in the application layer and the plant is presented in `Asia/Kolkata`.

## Data model

Core normalized entities are User, Shift, Worker, Machine, Product, Supplier, Material, CustomerOrder, ProductionRecord, ScheduleRun, ScheduleAssignment, MaintenanceEvent, QualityInspection, Scenario, Alert, and AuditLog. JSON is intentionally limited to routing/BOM structures whose operation arrays are naturally owned by a product in V1.

Indexes protect the common queries: order due date/status, machine code/type/department, production timestamp/machine, material code, and scenario/alert state.

## Important flows

### Order to schedule

1. Validate product, quantity, due date, and priority.
2. Explode the product BOM and assess planning-stage material feasibility.
3. Build CP-SAT operations with eligible machines and precedence.
4. Persist the solver run and every assignment.
5. Render the schedule and calculate bottleneck/capacity implications.

### Scenario

1. Snapshot active orders and factory parameters.
2. Simulate baseline.
3. Apply the event without correction and simulate disruption.
4. Apply eligible rerouting and queue-compression policy.
5. Simulate recommended state with the same disruption seed.
6. Persist three states, deltas, actions, and model provenance.

## Security

- PBKDF2-SHA256 passwords with unique 128-bit salts and 210,000 rounds.
- Expiring HS256 bearer tokens.
- Write endpoints require authentication and create audit records.
- Pydantic validation bounds quantities, horizons, scenario magnitude, and solver weights.
- CORS allowlist comes from environment configuration.
- Secrets are excluded from Git and represented only by `.env.example` placeholders.
- SQLAlchemy parameterization prevents hand-built SQL injection paths.

## Deployment

Docker Compose starts PostgreSQL, runs Alembic, seeds only an empty demo database, starts FastAPI, then starts the web application after the API health check. The web preview can be published independently, while the full integrated product is intended to run through Docker.

## Research extension points

- replace scalar objective weights with a Pareto frontier;
- add explicit transition matrices and batch-splitting variables;
- include material release as cumulative resources inside CP-SAT;
- add stochastic failure and supplier distributions;
- introduce robust schedules or reinforcement-learning dispatch policies;
- add energy-aware objectives and carbon accounting.
