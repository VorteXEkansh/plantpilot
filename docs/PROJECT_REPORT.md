# PlantPilot Project Report

## Problem statement

Manufacturing decisions are often fragmented across spreadsheets for demand, machine loading, inventory, maintenance, quality, and cost. A disruption changes all of them. PlantPilot demonstrates a unified decision-support architecture in which the schedule is mathematically feasible, the factory response is simulated, and operational outcomes are translated into management impact.

## Scope

PlantPilot V1 covers customer demand, BOM/routing master data, exactly 15 work centers, a 60-worker skill matrix, three shifts, 24 materials, eight suppliers, 180 days of production and quality history, finite-capacity scheduling, MRP, capacity, line balancing, maintenance risk, SPC, cost, Scenario Lab, deterministic Copilot, reports, authentication, audit, migrations, containers, and automated tests.

## Technical approach

- React/TypeScript interface optimized for executive and operations use.
- FastAPI/Pydantic HTTP contracts and SQLAlchemy relational model.
- PostgreSQL production container with SQLite test/development option.
- OR-Tools CP-SAT for finite-capacity scheduling.
- SimPy for queue/disruption evaluation.
- scikit-learn Random Forest for a clearly limited synthetic maintenance demonstrator.
- deterministic data generator with meaningful correlations.

## Product design

The UI uses an operations-command-center language: dense but legible tables, restrained teal/coral risk colors, management summaries, explicit model labels, Gantt, capacity heatmap, SPC, Pareto, and baseline/disrupted/recommended comparison. Mobile layouts collapse navigation and convert grids without hiding core actions.

## Validation strategy

Backend tests verify login, API routes, CRUD, KPI identity, line precedence, CP-SAT precedence, machine no-overlap, SimPy state differences, and authentication. Frontend checks cover strict TypeScript, lint, production rendering, scenario interaction, order search/create, invalid login, logout, and valid login. Docker validates clean PostgreSQL migration and seed.

## Actual result

The CNC-04 case study demonstrates the integrated chain. A 12-hour outage reduced modeled OTD to 62.5%; the recommended state recovered it to 71.9%, reduced lateness by 2.4 hours and WIP by 13 units, and reduced modeled cost by ₹5,435 at the expense of 5.5 targeted overtime hours.

## Ethical framing

Every company, worker, supplier, order, sensor, and cost is synthetic. No real Tata Motors, Maruti, Bosch, Siemens, Mahindra, or other plant data is implied. The failure model is not validated for real use, and association is not called causation.

## Future work

Pairwise sequence transitions, batch splitting, time-phased materials inside CP-SAT, robust scheduling, calibrated stochastic failures, live MES/ERP connectors, energy/carbon objectives, stronger role permissions, and production LLM retrieval are deliberately left as defensible extensions.
