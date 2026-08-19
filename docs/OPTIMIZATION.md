# Scheduling Optimization

## Decision model

PlantPilot uses Google OR-Tools CP-SAT for a flexible job-shop-style schedule.

For order `j`, operation `o`, and eligible machine `m`:

- `presence[j,o,m]` is a Boolean assignment decision;
- `start[j,o,m]` and `end[j,o,m]` are integer minute variables;
- an optional interval exists only when its machine is selected;
- exactly one eligible machine must be present;
- the shared operation start/end equal the selected alternative;
- the next operation starts after its predecessor ends;
- `NoOverlap` applies to every machine interval plus fixed maintenance;
- tardiness is constrained to be at least final completion minus due time;
- a makespan variable equals the maximum order completion.

## Objective

The configurable weighted objective is:

`minimize wt × weighted tardiness + wm × makespan + ws × setup minutes + wo × overtime proxy`

Priority multipliers are Standard 1, High 4, and Critical 10. The UI exposes the high-level weights and the API validates every required weight between 0 and 100.

## Setup modeling

V1 assigns 8 setup minutes when machine and product families match and 22 otherwise. That gives the solver a real setup penalty and discourages poor assignments. A complete pairwise sequence-dependent transition matrix is the next extension; the current limitation is returned in solver metadata.

## Maintenance and downtime

Known maintenance is represented as a fixed interval in the relevant machine `NoOverlap` set. Scenario disruption is evaluated in SimPy and then an eligible-machine rerouting policy represents the recommended response.

## Material feasibility

Material availability constrains order release at the planning layer: MRP explodes active orders, calculates projected balance, and flags shortages before schedule execution. Embedding time-phased lots into CP-SAT would enlarge the model substantially; PlantPilot documents this separation instead of pretending material is unconstrained.

## Safety and observability

- explicit solve time limit;
- deterministic input ordering;
- solver name, status, objective, elapsed seconds, makespan, operation count, order count, and weights returned and stored;
- infeasible or empty problems return useful HTTP 422 errors;
- assignments are persisted for audit and Gantt rendering;
- tests assert precedence and no overlap on actual CP-SAT output.

## Validation result

The automated optimization test schedules active synthetic orders, requires `FEASIBLE` or `OPTIMAL`, confirms that operation count exceeds order count, verifies every operation chain, and checks each machine timeline for overlap.

## Known limitations

- no split batches in V1;
- shift calendars are represented through available duration rather than per-worker assignment variables;
- no stochastic duration inside CP-SAT;
- setup is family-specific rather than pairwise sequence-specific;
- material is a release gate rather than a solver resource.
