# Digital Factory Simulation

## Optimization is not simulation

Optimization proposes a strong plan under declared constraints. Simulation evaluates how that plan behaves as queues, processing, disruptions, setup, labor effects, and variability unfold. PlantPilot uses both because a mathematically valid schedule can still be operationally fragile.

## SimPy model

Each active customer order becomes a SimPy process. Its routing requests single-capacity machine resources in precedence order. The process records queue waiting, setup, processing, completion, overtime exposure, cost, and WIP area.

Supported scenario effects include:

- machine disruption or forced maintenance delay;
- demand-shock throughput and overtime pressure;
- supplier delay and affected material jobs;
- worker absenteeism processing-rate loss;
- quality shock processing/rework and scrap loss;
- cost changes;
- eligible-machine reassignment in the recommended policy.

## Three-state experiment

1. **Baseline:** normal routing and deterministic seed 20260819.
2. **Disrupted:** event applied with seed 20260820 and no correction.
3. **Recommended:** same event seed, eligible rerouting, setup compression, and targeted policy response.

Using the same disruption seed for disrupted and recommended states improves comparability. The persisted result includes OTD, total cost, overtime, throughput, utilization, average lateness, WIP, scrap, simulated hours, deltas, actions, seed, engine, and orders evaluated.

## Actual deterministic CNC-04 run

An executed 12-hour CNC-04 disruption across 32 active orders produced:

| KPI | Baseline | Disrupted | Recommended | Recommended vs disrupted |
| --- | ---: | ---: | ---: | ---: |
| On-time delivery | 71.9% | 62.5% | 71.9% | +9.4 pts |
| Modeled total cost | ₹22,85,657 | ₹22,86,248 | ₹22,80,813 | −₹5,435 |
| Overtime | 19.5 h | 16.5 h | 22.0 h | +5.5 h |
| Average lateness | 12.9 h | 14.4 h | 12.0 h | −2.4 h |
| WIP | 109 | 121 | 108 | −13 |
| Scrap rate | 1.70% | 1.70% | 1.33% | −0.37 pts |

The result exposes a credible tradeoff: delivery recovery and lower modeled cost require more targeted overtime. These are modeled synthetic-factory values, not real savings.

## Observability and reproducibility

- fixed seed recorded per run;
- event type, resource, magnitude, and duration persisted;
- same active-order cohort used for the three states;
- simulation engine and order count returned;
- automated tests require baseline, disrupted, and recommended outputs to differ.

## Limitations

V1 is an educational plant model, not a commissioned digital twin. It does not model every tool, operator, transporter, fixture, or supplier lot. Probability distributions and correlations are defensible for a portfolio demonstration but are not fitted to real factory data.
