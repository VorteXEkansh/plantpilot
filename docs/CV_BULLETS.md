# CV Bullets

Choose two or three and keep the synthetic-data qualifier in interviews.

- Built **PlantPilot**, a full-stack AI manufacturing command center integrating finite-capacity scheduling, discrete-event simulation, MRP, maintenance analytics, SPC, capacity planning, and modeled cost intelligence for a deterministic synthetic automotive factory.
- Implemented a flexible job-shop scheduler in **Google OR-Tools CP-SAT** with precedence, eligible-machine alternatives, `NoOverlap` capacity, maintenance intervals, setup-family penalties, priority-weighted tardiness, and makespan objectives.
- Developed a **SimPy** scenario engine comparing baseline, disrupted, and re-optimized factory states; an executed 12-hour CNC-04 scenario recovered **9.4 modeled OTD points** and reduced average lateness by **2.4 hours** versus disruption across 32 synthetic orders.
- Designed a reproducible manufacturing dataset spanning **15 work centers, 60 workers, 8 products, 24 materials, 420 orders, 2,700 production records, and 720 quality inspections** with correlated utilization, downtime, quality, material, and delivery behavior.
- Built database-backed manufacturing analytics for OEE, capacity, bottlenecks, BOM explosion, safety stock, EOQ-informed purchase recommendations, Cp/Cpk, Pareto defects, MTBF/MTTR, and order/product cost using FastAPI, SQLAlchemy, and PostgreSQL.
- Delivered a responsive React/TypeScript operations UI with Gantt scheduling, capacity heatmaps, SPC charts, scenario comparison, deterministic decision Copilot, authentication, audit history, exports, Docker, migrations, CI, and automated API/optimization/simulation/E2E tests.
