# Synthetic Data Generator

## Reproducibility

The generator uses seed `20260819` and a fixed reference date of 19 August 2026. A clean database produces the same entities and correlations. Seeding is idempotent: an already-populated machine table prevents duplicate demo insertion.

## Generated entities

| Entity | Count |
| --- | ---: |
| Machines/work centers | 15 |
| Workers | 60 |
| Shifts | 3 |
| Products | 8 |
| Materials | 24 |
| Suppliers | 8 |
| Customer orders | 420 |
| Production records | 2,700 |
| Quality inspections | 720 |

The history covers 180 days. Products have realistic SKUs, prices, costs, setup families, routings, eligible machines, processing times, and BOMs. Workers span machining, assembly, maintenance, quality, material handling, and supervision.

## Distributions and relationships

- Demand has a sinusoidal wave plus a late-window uplift.
- Utilization combines that demand wave with bounded Gaussian variation.
- Downtime uses an exponential base and rises with high utilization.
- CNC-04 receives an overdue-maintenance factor late in the history.
- Performance falls under that condition factor.
- Defect rate rises with overload and the condition factor.
- Material risk comes from current balance relative to consumption, safety stock, reorder point, BOM demand, and lead time.
- Order lateness risk uses quantity/routing pressure, priority, material family, and bounded noise.
- Urgent priority changes scheduling penalty; it is not cosmetic.

## Reset

The safest full reset is `docker compose down -v` followed by `docker compose up --build`. The application settings screen also restores browser-demo state. Database reset deliberately requires an explicit operational action.

## Ethics

PlantPilot never attributes data to a real manufacturer. Names are fictional and financial improvements are described as modeled, estimated, simulated, or observed in the synthetic factory.

## Limitations

The generator provides realistic correlations, not empirical validation. Randomness does not reproduce every real distribution, supplier contract, plant calendar, inspection plan, or failure mechanism.
