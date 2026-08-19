from app.services import run_scenario


def test_recommended_scenario_is_model_output(db):
    result = run_scenario(db, "CNC-04 breakdown test", "Machine disruption", "CNC-04", 100, 12)
    assert result["engine"]["simulation"] == "SimPy discrete-event simulation"
    assert result["baseline"] != result["disrupted"]
    assert result["recommended"] != result["disrupted"]
    assert result["recommended"]["total_cost"] > 0
    assert result["actions"]


def test_scenario_api_requires_auth(client):
    response = client.post("/api/v1/scenarios", json={"name": "Unauthorized scenario", "event_type": "Demand shock", "magnitude": 25, "duration_hours": 48})
    assert response.status_code == 401
