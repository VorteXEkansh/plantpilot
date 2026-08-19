from datetime import datetime, timedelta, timezone


def test_login_rejects_invalid_password(client):
    response = client.post("/api/v1/auth/login", json={"email": "admin@plantpilot.local", "password": "wrong-password"})
    assert response.status_code == 401


def test_order_crud_and_validation(client, auth_headers):
    products = client.get("/api/v1/products").json()
    response = client.post("/api/v1/orders", headers=auth_headers, json={"customer": "Novus Vehicle Systems", "product_id": products[0]["id"], "quantity": 32, "due_date": (datetime.now(timezone.utc) + timedelta(days=9)).isoformat(), "priority": "High"})
    assert response.status_code == 201
    order = response.json()
    assert order["customer"] == "Novus Vehicle Systems"
    updated = client.patch(f"/api/v1/orders/{order['id']}", headers=auth_headers, json={"status": "Released", "progress": 12.5})
    assert updated.status_code == 200
    assert updated.json()["status"] == "Released"


def test_core_analytics_routes(client):
    for route in ["/api/v1/inventory", "/api/v1/capacity", "/api/v1/bottlenecks", "/api/v1/maintenance", "/api/v1/quality", "/api/v1/reports/executive"]:
        response = client.get(route)
        assert response.status_code == 200, route
