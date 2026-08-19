# PlantPilot Interview Guide

## 30-second explanation

PlantPilot is a manufacturing decision-support platform for a realistic synthetic automotive-component factory. It combines OR-Tools finite-capacity scheduling with SimPy factory simulation, then connects delivery, inventory, maintenance, quality, and cost in one command center. The flagship scenario shows how a machine breakdown changes queues and customer promises and how a re-optimized plan trades targeted overtime for delivery recovery.

## 2-minute explanation

Most manufacturing dashboards describe what happened; PlantPilot also recommends what to do next. I created a deterministic factory with 15 machines, 60 workers, eight routed products, 24 materials, suppliers, and 180 days of correlated history. A FastAPI/PostgreSQL backend calculates OEE, capacity, MRP, SPC, cost, and risk. CP-SAT creates a precedence- and capacity-feasible schedule. SimPy then evaluates baseline, disrupted, and recommended outcomes under queues and breakdowns. The React interface gives executive summaries and engineering detail. I am careful to label all financial and maintenance results as modeled because the data is synthetic.

## 5-minute walkthrough

1. Open Command Center and explain OEE as Availability × Performance × Quality.
2. Show Critical order AM-2481 and its routing/material requirements.
3. Open Schedule and point to eligible-machine assignments, precedence, `NoOverlap`, maintenance, and weighted tardiness.
4. Open Capacity and Maintenance to show why CNC-04 is the constraint and why its condition matters.
5. Run a 12-hour CNC-04 Scenario Lab event.
6. Compare the three states and highlight the tradeoff: +9.4 modeled OTD points vs disruption, −2.4 hours lateness, −13 WIP, −₹5,435 modeled cost, and +5.5 targeted overtime hours.
7. Ask Copilot why the order is late and show grounded sources.

## Business-value explanation

The value is not the schedule alone. PlantPilot converts a feasible response into delivery, WIP, overtime, quality, and modeled financial impact so a manager can see the tradeoff.

## Why optimization and simulation are both used

Optimization searches for a strong plan under declared constraints. Simulation tests its behavior under queues and disruption. Confusing them would imply the mathematical plan automatically predicts operational variability.

## Most difficult decisions

- keeping material feasibility tractable by using a release gate instead of embedding every lot in CP-SAT;
- representing setup cost without an expensive full transition matrix;
- using the same disruption seed for fair scenario comparison;
- refusing to publish fake model accuracy from synthetic labels;
- designing management-friendly output without hiding assumptions.

## Limitations

Synthetic data, simplified calendars, no batch splitting, setup-family rather than pairwise transition time, planning-stage material constraint, and no real maintenance validation.

## 25 likely questions

1. **What problem does PlantPilot solve?** It unifies demand, capacity, inventory, maintenance, quality, and cost decisions after a schedule or disruption changes.
2. **Why CP-SAT?** It handles discrete alternatives, optional intervals, precedence, and no-overlap constraints well.
3. **What makes the schedule finite-capacity?** Every selected operation occupies one machine interval and each machine has `NoOverlap`.
4. **How does priority matter?** Critical tardiness is multiplied by 10, High by 4, Standard by 1.
5. **How are setups modeled?** Family-aligned assignments take 8 minutes; mismatches take 22 and increase the objective.
6. **Why not put material in CP-SAT?** Time-phased lots would greatly increase the model; V1 gates release through MRP and documents it.
7. **How do you prove no overlap?** Automated tests sort every machine timeline and assert each end is no later than the next start.
8. **What is OEE?** Availability × Performance × Quality, calculated from raw production numerators.
9. **Utilization vs OEE?** Utilization measures load/time use; OEE measures productive effectiveness while planned to run.
10. **What is the bottleneck method?** Rank load, overload, affected orders, delay exposure, and modeled financial exposure.
11. **What is RPW?** Task time plus all successor times ranks assembly tasks while preserving precedence and takt.
12. **How does MRP work?** Remaining open quantity explodes through BOMs, then projected inventory is compared with safety/reorder levels and lead time.
13. **What are Cp and Cpk?** Cp is potential spread capability; Cpk also reflects centering.
14. **Why SimPy?** It naturally models jobs, resources, requests, queues, and elapsed event time.
15. **How is scenario comparison fair?** Disrupted and recommended use the same event seed and order cohort.
16. **Why did overtime increase in the recommendation?** Targeted overtime is the explicit cost of restoring delivery, partly offset by lower WIP/quality loss.
17. **Is the maintenance probability real?** No. It is a synthetic educational classifier and the model card says so.
18. **Why a Random Forest?** It captures nonlinear interactions without requiring a complicated parametric form.
19. **What would real maintenance validation need?** Historical failures, time-aware holdouts, calibration, drift monitoring, and engineering approval.
20. **How is authentication stored?** PBKDF2-SHA256 with unique salts and expiring bearer tokens.
21. **Why a modular monolith?** Domain and transaction boundaries are shared; independent services would add complexity without current scale benefit.
22. **How is reproducibility achieved?** Seed 20260819, fixed reference date, deterministic input ordering, recorded simulation seed.
23. **What is your strongest result?** The integrated CNC-04 scenario recovers 9.4 modeled OTD points vs disruption and explains its overtime tradeoff.
24. **What would you build next?** Pairwise setups, split batches, material resources in CP-SAT, stochastic calibration, and ERP/MES integration.
25. **What did you learn?** A decision-support system is credible only when constraints, simulation assumptions, cost tradeoffs, and limitations remain visible.
