import pytest

from app.services import calculate_kpis


def test_oee_is_product_of_components(db):
    kpis = calculate_kpis(db, 30)
    expected = kpis["availability"] / 100 * kpis["performance"] / 100 * kpis["quality_rate"] / 100 * 100
    assert kpis["oee"] == pytest.approx(expected, abs=.2)
    assert 0 <= kpis["scrap_rate"] <= 100
    assert kpis["throughput"] > 0


def test_dashboard_uses_seeded_database(client):
    response = client.get("/api/v1/dashboard")
    assert response.status_code == 200
    payload = response.json()
    assert payload["plant"]["name"] == "ApexMotion Components Pvt. Ltd."
    assert payload["kpis"]["oee"] > 60
    assert len(payload["machine_states"]) == 15
