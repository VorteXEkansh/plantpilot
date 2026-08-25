"""Exercise PlantPilot's hosted API without embedding credentials in source."""

from __future__ import annotations

import json
import os
import sys
import time
from datetime import datetime, timezone

import httpx


RETRYABLE_RENDER_STATUSES = {404, 502, 503, 504}


def request(client: httpx.Client, method: str, path: str, **kwargs: object) -> httpx.Response:
    """Retry transient Render edge routing misses during startup/route propagation."""
    response: httpx.Response | None = None
    for attempt in range(6):
        response = client.request(method, path, **kwargs)
        if response.status_code not in RETRYABLE_RENDER_STATUSES:
            return response
        if attempt < 5:
            response.close()
            time.sleep(min(2**attempt, 8))
    assert response is not None
    return response


def required_environment(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"{name} is required")
    return value


def main() -> int:
    base_url = required_environment("PLANTPILOT_API_URL").rstrip("/")
    email = required_environment("PLANTPILOT_DEMO_EMAIL")
    password = required_environment("PLANTPILOT_DEMO_PASSWORD")
    expected_scenario_id = os.getenv("PLANTPILOT_EXPECT_SCENARIO_ID", "").strip()

    results: dict[str, object] = {"api_url": base_url, "checked_at": datetime.now(timezone.utc).isoformat()}
    with httpx.Client(base_url=base_url, timeout=120, follow_redirects=True) as client:
        root = request(client, "GET", "/")
        root.raise_for_status()
        results["root"] = root.json()

        health = request(client, "GET", "/health")
        health.raise_for_status()
        results["health"] = health.json()

        docs = request(client, "GET", "/docs")
        docs.raise_for_status()
        results["docs"] = docs.status_code

        invalid = request(
            client,
            "POST",
            "/api/v1/auth/login",
            json={"email": email, "password": f"{password}-invalid"},
        )
        if invalid.status_code != 401:
            raise RuntimeError(f"Invalid login returned {invalid.status_code}, expected 401")

        anonymous = request(
            client, "POST", "/api/v1/scheduling/run", json={"time_limit_seconds": 1}
        )
        if anonymous.status_code != 401:
            raise RuntimeError(f"Anonymous scheduler returned {anonymous.status_code}, expected 401")

        login = request(
            client,
            "POST",
            "/api/v1/auth/login",
            json={"email": email, "password": password},
        )
        login.raise_for_status()
        token = login.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        results["authentication"] = {"valid": 200, "invalid": 401, "protected": 401}

        for label, path in {
            "dashboard": "/api/v1/dashboard",
            "orders": "/api/v1/orders?limit=10",
            "inventory_mrp": "/api/v1/inventory",
            "maintenance": "/api/v1/maintenance",
            "quality": "/api/v1/quality",
            "reports": "/api/v1/reports/executive",
        }.items():
            response = request(client, "GET", path)
            response.raise_for_status()
            payload = response.json()
            results[label] = {
                "status": response.status_code,
                "records": len(payload.get("items", [])) if isinstance(payload, dict) else len(payload),
            }

        schedule = request(
            client,
            "POST",
            "/api/v1/scheduling/run",
            headers=headers,
            json={
                "time_limit_seconds": 10,
                "weights": {"tardiness": 10, "makespan": 1, "setup": 2, "overtime": 3},
            },
        )
        schedule.raise_for_status()
        schedule_payload = schedule.json()
        results["schedule"] = {
            key: schedule_payload[key]
            for key in (
                "run_id",
                "status",
                "solver",
                "objective_value",
                "solve_seconds",
                "orders_scheduled",
                "operations_scheduled",
                "makespan_minutes",
                "weighted_tardiness_minutes",
            )
        }

        scenario = request(
            client,
            "POST",
            "/api/v1/scenarios",
            headers=headers,
            json={
                "name": f"Production smoke CNC-04 {datetime.now(timezone.utc).isoformat(timespec='seconds')}",
                "event_type": "Machine disruption",
                "resource_code": "CNC-04",
                "magnitude": 100,
                "duration_hours": 12,
            },
        )
        scenario.raise_for_status()
        scenario_payload = scenario.json()
        results["scenario"] = {
            key: scenario_payload[key]
            for key in ("id", "baseline", "disrupted", "recommended", "actions", "engine")
        }

        if expected_scenario_id:
            scenarios = request(client, "GET", "/api/v1/scenarios")
            scenarios.raise_for_status()
            persisted_ids = {str(item["id"]) for item in scenarios.json()}
            if expected_scenario_id not in persisted_ids:
                raise RuntimeError(f"Scenario {expected_scenario_id} did not persist across restart")
            results["persistence"] = {"scenario_id": expected_scenario_id, "status": "PASS"}

    print(json.dumps(results, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (httpx.HTTPError, RuntimeError, KeyError) as exc:
        print(f"production smoke test failed: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc
