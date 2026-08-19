const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
).replace(/\/$/, "");

export type ApiState = "connecting" | "connected" | "demo";

export type ApiKpis = {
  oee: number;
  availability: number;
  performance: number;
  quality_rate: number;
  capacity_utilization: number;
  throughput: number;
  on_time_delivery: number;
  schedule_adherence: number;
  wip: number;
  scrap_rate: number;
  rework: number;
  average_lead_time_days: number;
  machine_downtime_hours: number;
  overtime_hours: number;
  inventory_value: number;
  stockout_risk_count: number;
  production_cost: number;
  cost_per_unit: number;
  energy_kwh: number;
};

export type ApiDashboard = {
  plant: { name: string; health_score: number; status: string };
  kpis: ApiKpis;
  trend: Array<{
    date: string;
    oee: number;
    availability: number;
    performance: number;
    quality: number;
  }>;
};

export type ApiOrder = {
  id: number;
  order_code: string;
  customer: string;
  product_id: number;
  product: string;
  sku: string;
  quantity: number;
  due_date: string;
  promised_date: string;
  priority: "Standard" | "High" | "Critical";
  status: string;
  progress: number;
  estimated_completion: string;
  lateness_risk: number;
  production_requirements: Array<Record<string, unknown>>;
  material_requirements: Array<Record<string, unknown>>;
};

export type ScheduleAssignment = {
  order_id: number;
  order_code: string;
  product: string;
  priority: "Standard" | "High" | "Critical";
  operation_index: number;
  operation: string;
  machine_code: string;
  start_minute: number;
  end_minute: number;
  setup_minutes: number;
  expected_lateness_minutes: number;
};

export type ScheduleResult = {
  run_id: number;
  status: string;
  solver: string;
  objective_value: number;
  solve_seconds: number;
  makespan_minutes: number;
  weighted_tardiness_minutes: number;
  assignments: ScheduleAssignment[];
  orders_scheduled: number;
  operations_scheduled: number;
};

type ScenarioMetrics = {
  on_time_delivery: number;
  total_cost: number;
  overtime_hours: number;
  throughput: number;
  utilization: number;
  average_lateness_hours: number;
  wip: number;
};

export type ApiScenarioResult = {
  id: number;
  name: string;
  baseline: ScenarioMetrics;
  disrupted: ScenarioMetrics;
  recommended: ScenarioMetrics;
  actions: string[];
  explanation: string;
  engine: { simulation: string; seed: number; orders_evaluated: number };
};

async function request<T>(
  path: string,
  init: RequestInit = {},
  timeoutMs = 6_000,
): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        detail?: string;
      } | null;
      throw new Error(
        payload?.detail || `PlantPilot API returned ${response.status}`,
      );
    }
    return (await response.json()) as T;
  } finally {
    window.clearTimeout(timeout);
  }
}

function bearer(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

export async function login(email: string, password: string) {
  return request<{
    access_token: string;
    user: { email: string; full_name: string };
  }>("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function getDashboard() {
  return request<ApiDashboard>("/api/v1/dashboard");
}

export function getOrders() {
  return request<{ items: ApiOrder[]; total: number }>(
    "/api/v1/orders?limit=500",
  );
}

export function createOrder(
  token: string,
  input: {
    customer: string;
    product_id: number;
    quantity: number;
    due_date: string;
    priority: "Standard" | "High" | "Critical";
  },
) {
  return request<ApiOrder>("/api/v1/orders", {
    method: "POST",
    headers: bearer(token),
    body: JSON.stringify(input),
  });
}

export function updateOrder(token: string, orderId: number, status: string) {
  return request<ApiOrder>(`/api/v1/orders/${orderId}`, {
    method: "PATCH",
    headers: bearer(token),
    body: JSON.stringify({ status }),
  });
}

export function runSchedule(token: string) {
  return request<ScheduleResult>(
    "/api/v1/scheduling/run",
    {
      method: "POST",
      headers: bearer(token),
      body: JSON.stringify({
        time_limit_seconds: 5,
        weights: { tardiness: 10, makespan: 1, setup: 2, overtime: 3 },
      }),
    },
    65_000,
  );
}

export function runScenario(
  token: string,
  input: {
    name: string;
    event_type: string;
    resource_code: string;
    magnitude: number;
    duration_hours: number;
  },
) {
  return request<ApiScenarioResult>(
    "/api/v1/scenarios",
    {
      method: "POST",
      headers: bearer(token),
      body: JSON.stringify(input),
    },
    65_000,
  );
}
