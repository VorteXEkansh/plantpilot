# Model Card — Machine Failure-Risk Demonstrator

## Model

Random Forest classifier with 140 trees, maximum depth 7, minimum leaf size 8, balanced class weights, and random state 20260819.

## Intended use

Rank the 15 PlantPilot work centers for educational maintenance planning and show how condition analytics can influence a production decision.

## Training data

2,200 deterministic synthetic condition examples. Failure labels are sampled from a logistic risk surface rather than observed equipment failures.

## Features

- vibration in mm/s;
- temperature in °C;
- accumulated runtime hours;
- days maintenance overdue;
- modeled current load.

## Output

A 7-day demonstration failure probability, risk band, primary drivers, and suggested maintenance window.

## Validation

The software test validates response shape, sorting, bounded probability, and integration. A real train/test accuracy metric would be misleading because both features and labels come from the same synthetic mechanism; the project therefore does not present one as evidence of industrial validity.

## Limitations and risk

- no real sensor or failure labels;
- no machine-family calibration;
- probability is not an industrial reliability estimate;
- feature importance is not causal proof;
- suggested windows require maintenance-engineering review;
- never use this model to automatically stop or operate real equipment.

## Responsible extension

Use time-aware validation, equipment-family calibration, class-imbalance review, sensor quality checks, drift monitoring, uncertainty bounds, and human approval before any real deployment.
