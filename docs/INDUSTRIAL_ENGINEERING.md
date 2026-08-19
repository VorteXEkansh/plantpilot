# Industrial Engineering in PlantPilot

## KPI mathematics

- Availability = runtime / planned production time.
- Performance = ideal production minutes / actual runtime minutes.
- Quality = good units / total units.
- OEE = Availability × Performance × Quality.
- Utilization = required or runtime hours / available capacity hours.
- OTD = completed orders on or before promised date / completed orders.
- Scrap rate = scrap units / total units.
- Schedule adherence compares planned and achieved production timing/quantity in the selected window.

PlantPilot retains the raw numerators and denominators so cards are not cosmetic constants.

## Finite-capacity scheduling

Each customer order becomes a chain of operations. An operation selects one eligible work center and occupies it for its full duration. Precedence, capacity, maintenance, release, priority, setup, and due dates alter the mathematical schedule. Critical orders have a larger weighted-tardiness penalty.

## Capacity and bottlenecks

Required hours are allocated across eligible machines and compared with shift-derived available hours. Bottleneck rank combines modeled load, overload, affected active orders, delay exposure, and financial exposure. Because V1 uses deterministic planning data, rankings are decision signals rather than causal proof.

## Line balancing

Ranked Positional Weight assigns tasks using task time plus every transitive successor time. Tasks become eligible only after predecessors are assigned and station load cannot exceed takt time.

- line efficiency = total task time / (stations × takt time);
- balance delay = 1 − efficiency;
- station idle time = takt time − station load;
- smoothness index = square root of summed squared station idle time.

## Inventory and MRP

Open order quantity explodes through each product BOM. Gross requirement is compared with on-hand balance, safety stock, reorder point, supplier lead time, and average use. EOQ provides an economic scale reference:

`EOQ = sqrt(2 × annual demand × order cost / annual holding cost per unit)`

The purchase recommendation is at least the projected safety-stock deficit and is labeled modeled.

## SPC and capability

PlantPilot calculates sample X-bar and range histories, three-sigma control limits, rejection rate, Cp, and Cpk. Cp measures potential spread against specification width. Cpk also penalizes off-centering. The Pareto chart ranks defect frequency and cumulative contribution. Statistical association is never labeled proven causation.

## Maintenance

MTBF is operating time between failures and MTTR is mean repair duration. The demonstration classifier combines vibration, temperature, accumulated runtime, overdue maintenance, and load. The system proposes a window; it does not autonomously control equipment.

## Cost model

The cost service aggregates material, labor, machine, energy, setup, maintenance, overtime, and quality loss. Scenario comparisons expose both service improvement and its cost. This makes the tradeoff explicit: a recommended plan may spend targeted overtime to recover delivery performance.
