from app.services import line_balance, optimize_schedule


def test_ranked_positional_weight_respects_precedence():
    tasks = [
        {"id": "A", "time": 2.5, "predecessors": []},
        {"id": "B", "time": 1.5, "predecessors": ["A"]},
        {"id": "C", "time": 2.0, "predecessors": ["A"]},
        {"id": "D", "time": 2.5, "predecessors": ["B", "C"]},
    ]
    result = line_balance(tasks, 4.5)
    flattened = [task for station in result["stations"] for task in station["tasks"]]
    assert flattened.index("A") < flattened.index("B")
    assert flattened.index("A") < flattened.index("C")
    assert flattened.index("D") > flattened.index("B")
    assert all(station["load"] <= 4.5 for station in result["stations"])


def test_cp_sat_schedule_has_precedence_and_no_machine_overlap(db):
    result = optimize_schedule(db, time_limit_seconds=3)
    assert result["status"] in {"OPTIMAL", "FEASIBLE"}
    assert result["operations_scheduled"] > result["orders_scheduled"]
    by_order = {}
    by_machine = {}
    for item in result["assignments"]:
        by_order.setdefault(item["order_id"], []).append(item)
        by_machine.setdefault(item["machine_code"], []).append(item)
    for operations in by_order.values():
        operations.sort(key=lambda row: row["operation_index"])
        assert all(a["end_minute"] <= b["start_minute"] for a, b in zip(operations, operations[1:]))
    for operations in by_machine.values():
        operations.sort(key=lambda row: row["start_minute"])
        assert all(a["end_minute"] <= b["start_minute"] for a, b in zip(operations, operations[1:]))
