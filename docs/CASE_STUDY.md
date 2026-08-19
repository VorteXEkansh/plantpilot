# Case Study — Recovering from a CNC-04 Breakdown

## Executive summary

PlantPilot evaluated a 12-hour outage of CNC-04, a highly loaded turning center supporting several product routings. A deterministic SimPy run over 32 active synthetic orders showed modeled OTD falling from 71.9% baseline to 62.5% when no corrective action was taken. The recommended routing policy recovered OTD to 71.9%, reduced mean lateness by 2.4 hours versus disruption, released 13 WIP units, and reduced modeled cost by ₹5,435 while using 5.5 additional targeted overtime hours.

All results are from the PlantPilot synthetic factory. They are simulated estimates, not realized industrial improvements.

## Business problem

CNC-04 combined four risk factors: 108% planned load, vibration of 6.8 mm/s, temperature of 78°C, and overdue preventive maintenance. A Critical customer order used an eligible turning route that included CNC-04. The decision was not merely whether to repair the machine; it was how to preserve delivery while maintenance occurred.

## Method

1. MRP checked material-release feasibility.
2. The CP-SAT model represented operation chains and eligible alternative machines.
3. SimPy evaluated baseline queues and completion.
4. The disrupted state added 12 hours at the affected machine without correction.
5. The recommended state moved eligible work, compressed setup exposure, protected Critical priority, and used targeted overtime.
6. The same disruption seed was used for disrupted and recommended states.

## Results

| KPI | Baseline | Disrupted | Recommended |
| --- | ---: | ---: | ---: |
| OTD | 71.9% | 62.5% | 71.9% |
| Modeled total cost | ₹22.86 lakh | ₹22.86 lakh | ₹22.81 lakh |
| Overtime | 19.5 h | 16.5 h | 22.0 h |
| Mean lateness | 12.9 h | 14.4 h | 12.0 h |
| WIP | 109 | 121 | 108 |
| Scrap | 1.70% | 1.70% | 1.33% |

## Recommendation

- move eligible work from CNC-04 before the maintenance window;
- preserve Critical-order tardiness weight;
- authorize 5.5 incremental targeted overtime hours instead of plant-wide overtime;
- advance condition inspection;
- group the same setup family where machine eligibility permits.

## Management interpretation

The recommended state does not claim a free improvement. It buys delivery recovery through targeted overtime and alternative capacity, while lower queue/WIP and quality loss offset that expense in the modeled cost result. That tradeoff is the main decision-support value.

## Limitations

The demonstration does not model every operator, fixture, transporter, or tool. Actual routing approval, quality qualification, labor rules, and maintenance safety requirements would control a real intervention.
