"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bell,
  Bot,
  Boxes,
  CalendarClock,
  Check,
  ChevronDown,
  CircleDollarSign,
  ClipboardCheck,
  Command,
  Download,
  Factory,
  Gauge,
  GitCompareArrows,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Menu,
  PackageOpen,
  PanelLeftClose,
  Play,
  Plus,
  RefreshCcw,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  TimerReset,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  calculateDashboard,
  dailyKpis,
  defaultScenario,
  demoOrders,
  formatINR,
  lineTasks,
  machines,
  materials,
  products,
  seedSchedule,
  type Order,
} from "@/lib/factory-data";
import {
  createOrder as createApiOrder,
  getDashboard,
  getInventory,
  getMaintenance,
  getOrders,
  getQuality,
  login as apiLogin,
  runScenario as runApiScenario,
  runSchedule as runApiSchedule,
  updateOrder as updateApiOrder,
  type ApiDashboard,
  type ApiInventory,
  type ApiMaintenance,
  type ApiOrder,
  type ApiQuality,
  type ApiScenarioResult,
  type ApiState,
  type ScheduleResult,
} from "@/lib/api";

type View =
  | "command"
  | "orders"
  | "schedule"
  | "capacity"
  | "line"
  | "machines"
  | "inventory"
  | "maintenance"
  | "quality"
  | "cost"
  | "scenario"
  | "copilot"
  | "reports"
  | "settings";
type ScenarioResult = typeof defaultScenario;

function mapApiOrder(order: ApiOrder): Order {
  const product = products.find((item) => item[0] === order.sku);
  return {
    ...order,
    margin: product ? Number(product[3]) - Number(product[4]) : 0,
  };
}

function mapScenarioMetrics(metrics: ApiScenarioResult["baseline"]) {
  return {
    otd: metrics.on_time_delivery,
    cost: metrics.total_cost,
    overtime: metrics.overtime_hours,
    throughput: metrics.throughput,
    utilization: metrics.utilization,
    lateness: metrics.average_lateness_hours,
    wip: metrics.wip,
  };
}

const navGroups: {
  label: string;
  items: { id: View; label: string; icon: typeof Command }[];
}[] = [
  {
    label: "OVERVIEW",
    items: [{ id: "command", label: "Command center", icon: LayoutDashboard }],
  },
  {
    label: "OPERATIONS",
    items: [
      { id: "orders", label: "Customer orders", icon: ClipboardCheck },
      { id: "schedule", label: "Production schedule", icon: CalendarClock },
      { id: "capacity", label: "Capacity planning", icon: Gauge },
      { id: "line", label: "Line balancing", icon: GitCompareArrows },
    ],
  },
  {
    label: "FACTORY",
    items: [
      { id: "machines", label: "Machines", icon: Factory },
      { id: "inventory", label: "Inventory & MRP", icon: Boxes },
      { id: "maintenance", label: "Maintenance", icon: Wrench },
      { id: "quality", label: "Quality & SPC", icon: ShieldCheck },
    ],
  },
  {
    label: "INTELLIGENCE",
    items: [
      { id: "cost", label: "Cost intelligence", icon: CircleDollarSign },
      { id: "scenario", label: "Scenario Lab", icon: Sparkles },
      { id: "copilot", label: "PlantPilot Copilot", icon: Bot },
    ],
  },
  {
    label: "MANAGEMENT",
    items: [
      { id: "reports", label: "Reports", icon: BarChart3 },
      { id: "settings", label: "Settings", icon: Settings },
    ],
  },
];

const titles: Record<View, [string, string]> = {
  command: [
    "Manufacturing command center",
    "Good afternoon. Your factory is stable, with three risks needing attention.",
  ],
  orders: [
    "Customer order control",
    "Prioritize demand, inspect production requirements, and protect promised dates.",
  ],
  schedule: [
    "Finite-capacity schedule",
    "OR-Tools CP-SAT schedule with machine capacity, precedence, maintenance, priority, and setup constraints.",
  ],
  capacity: [
    "Capacity planning",
    "See required load, available hours, overload, and targeted overtime by work center.",
  ],
  line: [
    "Assembly line balancing",
    "Ranked Positional Weight assignment for the Bearing Hub assembly cell.",
  ],
  machines: [
    "Digital factory state",
    "Live synthetic state, condition, loading, and risk across exactly 15 work centers.",
  ],
  inventory: [
    "Inventory & material planning",
    "BOM-driven requirements, coverage, safety stock, and modeled purchase recommendations.",
  ],
  maintenance: [
    "Maintenance intelligence",
    "Condition-based modeled failure risk, MTBF, MTTR, and suggested maintenance windows.",
  ],
  quality: [
    "Quality & SPC",
    "Statistical process control, process capability, Pareto defects, scrap, and rework.",
  ],
  cost: [
    "Cost intelligence",
    "Translate operational performance into modeled cost, margin, and financial impact.",
  ],
  scenario: [
    "Scenario Lab",
    "Compare baseline, disrupted, and re-optimized plans with discrete-event simulation.",
  ],
  copilot: [
    "PlantPilot Copilot",
    "Ask management questions grounded in factory KPIs, scheduling, MRP, quality, and cost analytics.",
  ],
  reports: [
    "Management reports",
    "Export current synthetic-factory performance for decision reviews and interviews.",
  ],
  settings: [
    "Application settings",
    "Configure planning assumptions, demo behavior, and optimization objectives.",
  ],
};

const fmt = (value: number) =>
  new Intl.NumberFormat("en-IN").format(Math.round(value));
const pct = (value: number) => `${value.toFixed(1)}%`;
const riskClass = (risk: number | string) =>
  typeof risk === "number"
    ? risk >= 70
      ? "critical"
      : risk >= 40
        ? "warning"
        : "healthy"
    : String(risk).toLowerCase();

function StatusPill({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone?: string;
}) {
  return (
    <span
      className={`status-pill ${tone || String(children).toLowerCase().replaceAll(" ", "-")}`}
    >
      {children}
    </span>
  );
}

function MetricCard({
  code,
  label,
  value,
  delta,
  tone = "positive",
  spark,
}: {
  code: string;
  label: string;
  value: string;
  delta: string;
  tone?: string;
  spark?: number[];
}) {
  const points = (spark || [24, 31, 27, 38, 34, 44, 49])
    .map((v, i) => `${i * 16},${58 - v}`)
    .join(" ");
  return (
    <article className="metric-card">
      <div className="metric-top">
        <span>{code}</span>
        <button aria-label={`Explain ${label}`} title={label}>
          <HelpCircle size={14} />
        </button>
      </div>
      <strong>{value}</strong>
      <p>{label}</p>
      <div className={`metric-delta ${tone}`}>
        {delta}
        <em> vs last 7 days</em>
      </div>
      <svg className="mini-spark" viewBox="0 0 100 48" aria-hidden="true">
        <polyline points={points} />
      </svg>
    </article>
  );
}

function Panel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <section className={`panel ${className}`}>{children}</section>;
}
function PanelHead({
  kicker,
  title,
  action,
  accent,
}: {
  kicker: string;
  title: string;
  action?: React.ReactNode;
  accent?: string;
}) {
  return (
    <div className="panel-head">
      <div>
        <span className={`kicker ${accent || ""}`}>{kicker}</span>
        <h2>{title}</h2>
      </div>
      {action}
    </div>
  );
}

function DataSourceNote({ apiState = "demo" }: { apiState?: ApiState }) {
  return (
    <p className="data-note">
      <ShieldCheck size={13} /> Values are calculated from PlantPilot&apos;s
      deterministic synthetic factory dataset ·{" "}
      {apiState === "connected"
        ? "live FastAPI/PostgreSQL connection"
        : apiState === "connecting"
          ? "connecting to the PlantPilot cloud API"
          : "clearly labelled portable demo fallback"}
      .
    </p>
  );
}

function CommandCenter({
  navigate,
  dashboard,
  apiState,
}: {
  navigate: (view: View) => void;
  dashboard: ApiDashboard | null;
  apiState: ApiState;
}) {
  const fallback = calculateDashboard();
  const kpi = dashboard
    ? {
        ...fallback,
        oee: dashboard.kpis.oee,
        availability: dashboard.kpis.availability,
        performance: dashboard.kpis.performance,
        quality: dashboard.kpis.quality_rate,
        throughput: dashboard.kpis.throughput,
        otd: dashboard.kpis.on_time_delivery,
        adherence: dashboard.kpis.schedule_adherence,
        utilization: dashboard.kpis.capacity_utilization,
        wip: dashboard.kpis.wip,
        scrapRate: dashboard.kpis.scrap_rate,
        rework: dashboard.kpis.rework,
        leadTime: dashboard.kpis.average_lead_time_days,
        downtime: dashboard.kpis.machine_downtime_hours,
        overtime: dashboard.kpis.overtime_hours,
        inventoryValue: dashboard.kpis.inventory_value,
        stockoutRisk: dashboard.kpis.stockout_risk_count,
        productionCost: dashboard.kpis.production_cost,
        costPerUnit: dashboard.kpis.cost_per_unit,
        energy: dashboard.kpis.energy_kwh,
      }
    : fallback;
  const trend = dashboard
    ? dashboard.trend.map((row) => ({
        ...row,
        date: new Date(row.date).toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
        }),
      }))
    : dailyKpis;
  const bottlenecks = [...machines]
    .sort((a, b) => b.utilization - a.utilization)
    .slice(0, 4);
  return (
    <>
      <section className="plant-health">
        <div className="health-icon">
          <Check size={18} />
        </div>
        <div>
          <b>Plant health: Stable</b>
          <p>14 of 15 work centers available · Schedule adherence on plan</p>
        </div>
        <div className="health-meta">
          <span>SHIFT B</span>
          <b>
            86<small>/ 100</small>
          </b>
        </div>
      </section>
      <section className="metric-grid">
        <MetricCard
          code="OEE"
          label="Overall equipment effectiveness"
          value={pct(kpi.oee)}
          delta="▲ 2.8%"
          spark={dailyKpis.slice(-7).map((x) => x.oee - 55)}
        />
        <MetricCard
          code="OTD"
          label="Orders delivered on promise"
          value={pct(kpi.otd)}
          delta="▲ 1.4%"
          spark={[23, 26, 29, 30, 35, 39, 43]}
        />
        <MetricCard
          code="UTIL"
          label="Plant loading"
          value={pct(kpi.utilization)}
          delta="Healthy"
          tone="neutral"
          spark={[31, 28, 34, 37, 36, 40, 38]}
        />
        <MetricCard
          code="CPU"
          label="Modeled cost per good unit"
          value={formatINR(kpi.costPerUnit)}
          delta="▼ 4.1%"
          spark={[45, 42, 38, 40, 34, 31, 29]}
        />
      </section>
      <section className="two-col wide-left">
        <Panel>
          <PanelHead
            kicker="FACTORY PULSE"
            title="Production performance"
            action={
              <button className="select-button">
                Last 14 days <ChevronDown size={13} />
              </button>
            }
          />
          <div className="chart-large">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={trend}
                margin={{ top: 18, right: 12, left: -22, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="oeeFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#0f8c83" stopOpacity={0.28} />
                    <stop offset="1" stopColor="#0f8c83" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 5"
                  vertical={false}
                  stroke="#e4ebeb"
                />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: "#809194" }}
                />
                <YAxis
                  domain={[60, 100]}
                  tickFormatter={(v) => `${v}%`}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: "#809194" }}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 10,
                    border: "1px solid #dce6e6",
                    fontSize: 11,
                  }}
                />
                <ReferenceLine
                  y={85}
                  stroke="#d2a143"
                  strokeDasharray="5 4"
                  label={{
                    value: "Target 85%",
                    position: "insideTopRight",
                    fontSize: 9,
                    fill: "#9f7d35",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="oee"
                  name="OEE"
                  stroke="#0f827b"
                  strokeWidth={2.5}
                  fill="url(#oeeFill)"
                />
                <Line
                  type="monotone"
                  dataKey="availability"
                  stroke="#3c84a5"
                  dot={false}
                  strokeWidth={1.6}
                />
                <Line
                  type="monotone"
                  dataKey="performance"
                  stroke="#d3a044"
                  dot={false}
                  strokeWidth={1.6}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-legend">
            <span>
              <i className="teal" />
              OEE {pct(kpi.oee)}
            </span>
            <span>
              <i className="blue" />
              Availability {pct(kpi.availability)}
            </span>
            <span>
              <i className="gold" />
              Performance {pct(kpi.performance)}
            </span>
          </div>
        </Panel>
        <Panel>
          <PanelHead
            kicker="ATTENTION REQUIRED"
            accent="coral"
            title="Current operational risks"
            action={<StatusPill tone="critical">3 active</StatusPill>}
          />
          <div className="risk-list">
            <button
              className="risk-row"
              onClick={() => navigate("maintenance")}
            >
              <span className="risk-icon critical">
                <AlertTriangle size={15} />
              </span>
              <span>
                <b>CNC-04 failure risk elevated</b>
                <small>Vibration is 18% above baseline</small>
                <em>Maintenance · modeled risk</em>
              </span>
              <StatusPill tone="critical">High</StatusPill>
            </button>
            <button className="risk-row" onClick={() => navigate("inventory")}>
              <span className="risk-icon warning">
                <PackageOpen size={15} />
              </span>
              <span>
                <b>EN24 flange blanks below safety stock</b>
                <small>5.1 days coverage; PO due in 4 days</small>
                <em>Inventory · RM-007</em>
              </span>
              <StatusPill tone="warning">Medium</StatusPill>
            </button>
            <button className="risk-row" onClick={() => navigate("orders")}>
              <span className="risk-icon warning">
                <CalendarClock size={15} />
              </span>
              <span>
                <b>Order AM-2481 may be late</b>
                <small>Expected delay of 6.4 hours</small>
                <em>Delivery · Critical priority</em>
              </span>
              <StatusPill tone="warning">Medium</StatusPill>
            </button>
          </div>
          <button className="panel-link" onClick={() => navigate("reports")}>
            View all factory alerts <ArrowRight size={14} />
          </button>
        </Panel>
      </section>
      <section className="three-col command-bottom">
        <Panel>
          <PanelHead kicker="CONSTRAINT WATCH" title="Bottleneck ranking" />
          <div className="bottleneck-list">
            {bottlenecks.map((machine, index) => (
              <button key={machine.code} onClick={() => navigate("capacity")}>
                <span className="rank">0{index + 1}</span>
                <span>
                  <b>{machine.code}</b>
                  <small>{machine.name}</small>
                </span>
                <span className="util">
                  <b>{machine.utilization}%</b>
                  <i>
                    <em
                      style={{
                        width: `${Math.min(100, machine.utilization)}%`,
                      }}
                    />
                  </i>
                </span>
              </button>
            ))}
          </div>
        </Panel>
        <Panel>
          <PanelHead kicker="OUTPUT" title="Throughput & loss" />
          <div className="donut-wrap">
            <div
              className="donut"
              style={
                { "--value": `${100 - kpi.scrapRate}%` } as React.CSSProperties
              }
            >
              <span>
                <b>{fmt(kpi.throughput)}</b>
                <small>units</small>
              </span>
            </div>
            <div className="donut-stats">
              <p>
                <i className="dot good" />
                Good output{" "}
                <b>{fmt(kpi.throughput * (1 - kpi.scrapRate / 100))}</b>
              </p>
              <p>
                <i className="dot scrap" />
                Scrap <b>{pct(kpi.scrapRate)}</b>
              </p>
              <p>
                <i className="dot rework" />
                Rework <b>{fmt(kpi.rework)}</b>
              </p>
            </div>
          </div>
        </Panel>
        <Panel>
          <PanelHead kicker="NEXT BEST ACTION" title="Decision briefing" />
          <div className="briefing">
            <span className="brief-icon">
              <Sparkles size={18} />
            </span>
            <p>
              Protect Critical orders by moving eligible turning operations away
              from CNC-04 before its maintenance window.
            </p>
            <div>
              <b>Modeled impact</b>
              <span>+3.8 pts OTD</span>
              <span>−₹0.42 lakh delay cost</span>
            </div>
            <button onClick={() => navigate("scenario")}>
              Evaluate in Scenario Lab <ArrowRight size={14} />
            </button>
          </div>
        </Panel>
      </section>
      <DataSourceNote apiState={apiState} />
    </>
  );
}

function OrdersView({
  orders,
  setOrders,
  openCreate,
  onStatusUpdate,
}: {
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  openCreate: () => void;
  onStatusUpdate: (id: number, status: string) => Promise<Order | null>;
}) {
  const [query, setQuery] = useState("");
  const [priority, setPriority] = useState("All");
  const [selected, setSelected] = useState<Order | null>(null);
  const filtered = orders.filter(
    (o) =>
      (priority === "All" || o.priority === priority) &&
      `${o.order_code} ${o.customer} ${o.product}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const update = async (id: number, status: string) => {
    setOrders((current) =>
      current.map((order) =>
        order.id === id
          ? {
              ...order,
              status,
              progress:
                status === "Released"
                  ? Math.max(order.progress, 5)
                  : order.progress,
            }
          : order,
      ),
    );
    const persisted = await onStatusUpdate(id, status);
    if (persisted) {
      setOrders((current) =>
        current.map((order) => (order.id === id ? persisted : order)),
      );
      setSelected(persisted);
    }
  };
  return (
    <>
      <div className="view-toolbar">
        <label className="search-box">
          <Search size={15} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search order, customer, or product"
          />
        </label>
        <select value={priority} onChange={(e) => setPriority(e.target.value)}>
          <option>All</option>
          <option>Critical</option>
          <option>High</option>
          <option>Standard</option>
        </select>
        <button className="primary" onClick={openCreate}>
          <Plus size={15} /> Create order
        </button>
      </div>
      <section className="summary-strip">
        <div>
          <span>Active demand</span>
          <b>{fmt(orders.reduce((s, o) => s + o.quantity, 0))} units</b>
        </div>
        <div>
          <span>Critical orders</span>
          <b>{orders.filter((o) => o.priority === "Critical").length}</b>
        </div>
        <div>
          <span>At lateness risk</span>
          <b className="coral-text">
            {orders.filter((o) => o.lateness_risk >= 60).length}
          </b>
        </div>
        <div>
          <span>Average progress</span>
          <b>
            {pct(orders.reduce((s, o) => s + o.progress, 0) / orders.length)}
          </b>
        </div>
      </section>
      <Panel className="table-panel">
        <div className="table-meta">
          <span>
            {filtered.length} of {orders.length} orders
          </span>
          <button onClick={() => downloadCsv(orders)}>
            <Download size={14} /> Export CSV
          </button>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer / product</th>
                <th>Qty</th>
                <th>Due</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Progress</th>
                <th>Risk</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((order) => (
                <tr key={order.id}>
                  <td>
                    <button
                      className="table-link"
                      onClick={() => setSelected(order)}
                    >
                      {order.order_code}
                    </button>
                  </td>
                  <td>
                    <b>{order.customer}</b>
                    <small>
                      {order.product} · {order.sku}
                    </small>
                  </td>
                  <td>{order.quantity}</td>
                  <td>
                    {new Date(order.due_date).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                    })}
                    <small>
                      {new Date(order.due_date).toLocaleTimeString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </small>
                  </td>
                  <td>
                    <StatusPill tone={order.priority.toLowerCase()}>
                      {order.priority}
                    </StatusPill>
                  </td>
                  <td>
                    <StatusPill>{order.status}</StatusPill>
                  </td>
                  <td>
                    <div className="progress-cell">
                      <span>
                        <i style={{ width: `${order.progress}%` }} />
                      </span>
                      <b>{order.progress}%</b>
                    </div>
                  </td>
                  <td>
                    <span
                      className={`risk-score ${riskClass(order.lateness_risk)}`}
                    >
                      {order.lateness_risk}%
                    </span>
                  </td>
                  <td>
                    <button
                      className="icon-button"
                      onClick={() => setSelected(order)}
                    >
                      <ArrowRight size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      {selected && (
        <div className="drawer-backdrop">
          <button
            className="backdrop-dismiss"
            aria-label="Close order detail"
            onClick={() => setSelected(null)}
          />
          <aside
            className="detail-drawer"
            aria-label={`Order ${selected.order_code} detail`}
          >
            <button className="drawer-close" onClick={() => setSelected(null)}>
              <X size={18} />
            </button>
            <span className="kicker">ORDER DETAIL</span>
            <h2>{selected.order_code}</h2>
            <p>
              {selected.customer} · {selected.product}
            </p>
            <div className="drawer-stats">
              <div>
                <span>Quantity</span>
                <b>{selected.quantity} units</b>
              </div>
              <div>
                <span>Priority</span>
                <StatusPill tone={selected.priority.toLowerCase()}>
                  {selected.priority}
                </StatusPill>
              </div>
              <div>
                <span>Promised date</span>
                <b>
                  {new Date(selected.due_date).toLocaleString("en-IN", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </b>
              </div>
              <div>
                <span>Expected margin</span>
                <b>{formatINR(selected.margin * selected.quantity)}</b>
              </div>
            </div>
            <h3>Production progress</h3>
            <div className="stage-list">
              {[
                "Material release",
                "Primary machining",
                "Finishing",
                "Final inspection",
                "Dispatch",
              ].map((stage, i) => (
                <div
                  className={
                    i < Math.ceil(selected.progress / 20) ? "done" : ""
                  }
                  key={stage}
                >
                  <span>
                    {i < Math.ceil(selected.progress / 20) ? (
                      <Check size={13} />
                    ) : (
                      i + 1
                    )}
                  </span>
                  <p>
                    <b>{stage}</b>
                    <small>
                      {i < Math.ceil(selected.progress / 20)
                        ? "Complete"
                        : "Scheduled"}
                    </small>
                  </p>
                </div>
              ))}
            </div>
            <h3>Requirements</h3>
            <ul className="requirements">
              <li>Finite-capacity routing across eligible work centers</li>
              <li>BOM reservation before production release</li>
              <li>Critical priority increases weighted tardiness penalty</li>
            </ul>
            <button
              className="primary full"
              onClick={() => {
                void update(selected.id, "Released");
                setSelected({ ...selected, status: "Released" });
              }}
            >
              <Play size={15} /> Release to production
            </button>
          </aside>
        </div>
      )}
    </>
  );
}

function ScheduleView({
  token,
  notify,
}: {
  token: string;
  notify: (message: string) => void;
}) {
  const [running, setRunning] = useState(false);
  const [ran, setRan] = useState(false);
  const [schedule, setSchedule] = useState<ScheduleResult | null>(null);
  const [zoom, setZoom] = useState(1);
  const [machine, setMachine] = useState("All");
  const scheduleRows = schedule
    ? schedule.assignments.map((assignment) => ({
        id: `${assignment.order_id}-${assignment.operation_index}-${assignment.machine_code}`,
        order: assignment.order_code,
        product: assignment.product,
        priority: assignment.priority,
        operation: assignment.operation,
        machine: assignment.machine_code,
        start: assignment.start_minute,
        end: assignment.end_minute,
        setup: assignment.setup_minutes,
      }))
    : seedSchedule;
  const rows = (
    machine === "All"
      ? scheduleRows
      : scheduleRows.filter((row) => row.machine === machine)
  ).slice(0, 50);
  const machineList = [...new Set(rows.map((row) => row.machine))];
  const run = async () => {
    setRunning(true);
    if (token) {
      try {
        const result = await runApiSchedule(token);
        setSchedule(result);
        setRan(true);
        notify(
          `${result.solver}: ${result.status} · ${result.operations_scheduled} operations`,
        );
        return;
      } catch {
        notify("API unavailable; showing the deterministic validated schedule");
      } finally {
        setRunning(false);
      }
    }
    window.setTimeout(() => {
      setRunning(false);
      setRan(true);
    }, 900);
  };
  return (
    <>
      <div className="view-toolbar">
        <select value={machine} onChange={(e) => setMachine(e.target.value)}>
          <option>All</option>
          {machines.map((m) => (
            <option key={m.code}>{m.code}</option>
          ))}
        </select>
        <div className="zoom-control">
          <button onClick={() => setZoom(Math.max(0.7, zoom - 0.15))}>−</button>
          <span>{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(Math.min(1.5, zoom + 0.15))}>
            ＋
          </button>
        </div>
        <button className="secondary">
          <SlidersHorizontal size={15} /> Objective weights
        </button>
        <button className="primary" onClick={run} disabled={running}>
          {running ? (
            <RefreshCcw className="spin" size={15} />
          ) : (
            <Play size={15} />
          )}{" "}
          {running ? "Optimizing…" : "Run CP-SAT scheduler"}
        </button>
      </div>
      <section className="summary-strip">
        <div>
          <span>Solver status</span>
          <b className="green-text">
            {schedule?.status || (ran ? "OPTIMAL" : "FEASIBLE")}
          </b>
        </div>
        <div>
          <span>Orders scheduled</span>
          <b>{schedule?.orders_scheduled || 28}</b>
        </div>
        <div>
          <span>Operations</span>
          <b>{schedule?.operations_scheduled || seedSchedule.length}</b>
        </div>
        <div>
          <span>Makespan</span>
          <b>
            {schedule
              ? `${Math.floor(schedule.makespan_minutes / 1440)}d ${Math.round((schedule.makespan_minutes % 1440) / 60)}h`
              : ran
                ? "5d 18h"
                : "6d 04h"}
          </b>
        </div>
        <div>
          <span>Weighted tardiness</span>
          <b>
            {schedule
              ? `${fmt(schedule.weighted_tardiness_minutes)} min`
              : ran
                ? "42 min"
                : "184 min"}
          </b>
        </div>
      </section>
      <Panel className="gantt-panel">
        <PanelHead
          kicker="7-DAY OPERATIONAL HORIZON"
          title="Machine schedule"
          action={
            <div className="gantt-legend">
              <span>
                <i className="critical-bg" />
                Critical
              </span>
              <span>
                <i className="high-bg" />
                High
              </span>
              <span>
                <i className="standard-bg" />
                Standard
              </span>
            </div>
          }
        />
        <div
          className="gantt-scroll"
          style={{ "--zoom": zoom } as React.CSSProperties}
        >
          <div className="gantt-header">
            <b>Work center</b>
            {[
              "19 Aug",
              "20 Aug",
              "21 Aug",
              "22 Aug",
              "23 Aug",
              "24 Aug",
              "25 Aug",
            ].map((day) => (
              <span key={day}>
                {day}
                <small>06:00</small>
              </span>
            ))}
          </div>
          {(machine === "All"
            ? machines.filter((m) => machineList.includes(m.code))
            : machines.filter((m) => m.code === machine)
          ).map((m) => (
            <div className="gantt-row" key={m.code}>
              <div>
                <b>{m.code}</b>
                <small>{m.operation}</small>
              </div>
              <div className="gantt-track">
                <span className="now-line" />
                {rows
                  .filter((r) => r.machine === m.code)
                  .map((row, index) => (
                    <button
                      key={row.id}
                      className={`gantt-block ${row.priority.toLowerCase()}`}
                      style={{
                        left: `${(row.start / 10080) * 100}%`,
                        width: `${Math.max(2.5, ((row.end - row.start) / 10080) * 100 * zoom)}%`,
                        top: `${7 + (index % 3) * 25}px`,
                      }}
                      title={`${row.order} · ${row.operation} · ${row.end - row.start} minutes`}
                    >
                      <b>{row.order}</b>
                      <small>{row.operation}</small>
                    </button>
                  ))}
                {m.code === "CNC-04" && (
                  <span
                    className="maintenance-block"
                    title="Planned maintenance"
                  >
                    PM · 3h
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </Panel>
      <div className="solver-note">
        <ShieldCheck size={16} />
        <p>
          <b>Model transparency</b>
          <span>
            Operation precedence, optional machine assignment, NoOverlap
            capacity, fixed maintenance, release dates, priority-weighted
            tardiness, makespan, and family setup duration are enforced.
            Material feasibility is checked by MRP before order release.
          </span>
        </p>
        <span>OR-Tools CP-SAT</span>
      </div>
    </>
  );
}

function CapacityView() {
  const rows = [...machines].sort((a, b) => b.utilization - a.utilization);
  return (
    <>
      <section className="metric-grid compact">
        <MetricCard
          code="LOAD"
          label="Required work-center hours"
          value={`${fmt(rows.reduce((s, m) => s + m.required, 0))} h`}
          delta="▲ 3.2%"
        />
        <MetricCard
          code="CAP"
          label="Regular available capacity"
          value={`${fmt(rows.reduce((s, m) => s + m.available, 0))} h`}
          delta="4-week view"
          tone="neutral"
        />
        <MetricCard
          code="OVER"
          label="Modeled overload"
          value={`${fmt(rows.reduce((s, m) => s + Math.max(0, m.required - m.available), 0))} h`}
          delta="3 constraints"
          tone="negative"
        />
        <MetricCard
          code="OT"
          label="Targeted overtime need"
          value="42 h"
          delta="₹0.18 lakh"
          tone="neutral"
        />
      </section>
      <section className="two-col equal">
        <Panel>
          <PanelHead
            kicker="WORK-CENTER LOAD"
            title="Required vs available hours"
          />
          <div className="chart-large">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={rows.slice(0, 10)}
                layout="vertical"
                margin={{ left: 10, right: 20 }}
              >
                <CartesianGrid horizontal={false} stroke="#e8eeee" />
                <XAxis
                  type="number"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10 }}
                />
                <YAxis
                  type="category"
                  dataKey="code"
                  width={56}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10 }}
                />
                <Tooltip />
                <Bar
                  dataKey="available"
                  name="Available"
                  fill="#d8e5e4"
                  radius={[0, 4, 4, 0]}
                />
                <Bar dataKey="required" name="Required" radius={[0, 4, 4, 0]}>
                  {rows.slice(0, 10).map((row) => (
                    <Cell
                      key={row.code}
                      fill={row.utilization > 100 ? "#e57155" : "#11847d"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel>
          <PanelHead kicker="CAPACITY HEATMAP" title="Four-week load outlook" />
          <div className="heatmap">
            <div className="heatmap-head">
              <span />{" "}
              {["W34", "W35", "W36", "W37"].map((w) => (
                <b key={w}>{w}</b>
              ))}
            </div>
            {rows.slice(0, 9).map((m, i) => (
              <div key={m.code}>
                <b>{m.code}</b>
                {[0, 1, 2, 3].map((week) => {
                  const load = Math.round(
                    m.utilization + (week - 1) * 4 + Math.sin(i + week) * 6,
                  );
                  return (
                    <span
                      className={
                        load > 105
                          ? "h5"
                          : load > 95
                            ? "h4"
                            : load > 85
                              ? "h3"
                              : load > 70
                                ? "h2"
                                : "h1"
                      }
                      key={week}
                    >
                      {load}%
                    </span>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="heat-legend">
            <span>Spare</span>
            <i className="h1" />
            <i className="h2" />
            <i className="h3" />
            <i className="h4" />
            <i className="h5" />
            <span>Overload</span>
          </div>
        </Panel>
      </section>
      <Panel className="table-panel">
        <PanelHead
          kicker="INTERVENTION PRIORITY"
          title="Capacity action plan"
        />
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Work center</th>
                <th>Load</th>
                <th>Available</th>
                <th>Required</th>
                <th>Overload</th>
                <th>Affected orders</th>
                <th>Recommended action</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 8).map((m, i) => (
                <tr key={m.code}>
                  <td>0{i + 1}</td>
                  <td>
                    <b>{m.code}</b>
                    <small>{m.name}</small>
                  </td>
                  <td>
                    <StatusPill
                      tone={
                        m.utilization > 100
                          ? "critical"
                          : m.utilization > 90
                            ? "warning"
                            : "healthy"
                      }
                    >
                      {m.utilization}%
                    </StatusPill>
                  </td>
                  <td>{m.available} h</td>
                  <td>{m.required} h</td>
                  <td>{Math.max(0, m.required - m.available)} h</td>
                  <td>{Math.max(2, Math.round(m.utilization / 13))}</td>
                  <td>
                    {m.utilization > 100
                      ? "Reassign eligible work + targeted overtime"
                      : "Sequence setup families"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}

function LineBalancingView() {
  const [takt, setTakt] = useState(5.5);
  const [method, setMethod] = useState("Ranked Positional Weight");
  const stations = useMemo(() => {
    const result: { tasks: typeof lineTasks; load: number }[] = [];
    let current: { tasks: typeof lineTasks; load: number } = {
      tasks: [],
      load: 0,
    };
    lineTasks.forEach((task) => {
      if (current.load + task.time > takt && current.tasks.length) {
        result.push(current);
        current = { tasks: [], load: 0 };
      }
      current.tasks.push(task);
      current.load += task.time;
    });
    if (current.tasks.length) result.push(current);
    return result;
  }, [takt]);
  const efficiency =
    (lineTasks.reduce((s, t) => s + t.time, 0) / (stations.length * takt)) *
    100;
  return (
    <>
      <div className="view-toolbar">
        <label className="field-inline">
          Required takt time{" "}
          <input
            type="number"
            value={takt}
            min="3"
            max="12"
            step=".1"
            onChange={(e) => setTakt(Math.max(3, Number(e.target.value)))}
          />
          <span>min/unit</span>
        </label>
        <select value={method} onChange={(e) => setMethod(e.target.value)}>
          <option>Ranked Positional Weight</option>
          <option>Largest Candidate Rule</option>
        </select>
        <button className="primary">
          <Play size={15} /> Rebalance line
        </button>
      </div>
      <section className="summary-strip">
        <div>
          <span>Stations</span>
          <b>{stations.length}</b>
        </div>
        <div>
          <span>Takt time</span>
          <b>{takt.toFixed(1)} min</b>
        </div>
        <div>
          <span>Line efficiency</span>
          <b>{pct(efficiency)}</b>
        </div>
        <div>
          <span>Balance delay</span>
          <b>{pct(100 - efficiency)}</b>
        </div>
        <div>
          <span>Smoothness index</span>
          <b>
            {Math.sqrt(
              stations.reduce((s, st) => s + (takt - st.load) ** 2, 0),
            ).toFixed(2)}
          </b>
        </div>
      </section>
      <section className="two-col equal">
        <Panel>
          <PanelHead
            kicker="PRECEDENCE NETWORK"
            title="Bearing Hub assembly tasks"
          />
          <div className="precedence">
            {lineTasks.map((task, i) => (
              <div key={task.id} className={`task-node n${i + 1}`}>
                <b>{task.id}</b>
                <span>{task.name}</span>
                <small>{task.time} min</small>
                {i < lineTasks.length - 1 && <ArrowRight size={16} />}
              </div>
            ))}
          </div>
          <p className="method-note">
            Positional weight = task time + all successor task times. Eligible
            tasks are assigned in descending weight without exceeding takt time.
          </p>
        </Panel>
        <Panel>
          <PanelHead kicker="BALANCED WORK" title="Workstation assignment" />
          <div className="station-list">
            {stations.map((station, index) => (
              <div key={index}>
                <div>
                  <b>Station {index + 1}</b>
                  <span>{station.tasks.map((t) => t.id).join(" · ")}</span>
                </div>
                <div className="station-bar">
                  <i
                    style={{
                      width: `${Math.min(100, (station.load / takt) * 100)}%`,
                    }}
                  />
                  <span>
                    {station.load.toFixed(1)} / {takt.toFixed(1)} min
                  </span>
                </div>
                <strong>{Math.round((station.load / takt) * 100)}%</strong>
              </div>
            ))}
          </div>
        </Panel>
      </section>
    </>
  );
}

function MachinesView() {
  const [selected, setSelected] = useState(machines[3]);
  const counts = machines.reduce<Record<string, number>>(
    (acc, m) => ({ ...acc, [m.state]: (acc[m.state] || 0) + 1 }),
    {},
  );
  return (
    <>
      <section className="factory-map">
        <div className="map-head">
          <div>
            <span className="kicker">SHOP-FLOOR OVERVIEW</span>
            <h2>ApexMotion · Manesar plant</h2>
          </div>
          <div className="state-counts">
            {Object.entries(counts).map(([state, count]) => (
              <span key={state}>
                <i className={state.toLowerCase()} />
                {count} {state}
              </span>
            ))}
          </div>
        </div>
        <div className="machine-map">
          {machines.map((machine) => (
            <button
              key={machine.code}
              onClick={() => setSelected(machine)}
              className={`${machine.state.toLowerCase()} ${selected.code === machine.code ? "selected" : ""}`}
            >
              <span className="machine-state-dot" />
              <b>{machine.code}</b>
              <small>{machine.type}</small>
              <em>{machine.state}</em>
              <div>
                <i
                  style={{ width: `${Math.min(100, machine.utilization)}%` }}
                />
              </div>
              <strong>{machine.utilization}% load</strong>
            </button>
          ))}
        </div>
      </section>
      <section className="machine-detail">
        <div>
          <span className="kicker">SELECTED RESOURCE</span>
          <h2>
            {selected.code} · {selected.name}
          </h2>
          <p>
            {selected.type} · {selected.department}
          </p>
        </div>
        <StatusPill tone={selected.state.toLowerCase()}>
          {selected.state}
        </StatusPill>
        <div className="machine-metrics">
          <div>
            <span>7-day utilization</span>
            <b>{selected.utilization}%</b>
          </div>
          <div>
            <span>Vibration</span>
            <b className={selected.vibration > 5 ? "coral-text" : ""}>
              {selected.vibration} mm/s
            </b>
          </div>
          <div>
            <span>Temperature</span>
            <b>{selected.temperature}°C</b>
          </div>
          <div>
            <span>Failure risk</span>
            <b className={selected.risk > 40 ? "coral-text" : ""}>
              {selected.risk}%
            </b>
          </div>
          <div>
            <span>Active operation</span>
            <b>{selected.operation}</b>
          </div>
        </div>
        <div className="machine-actions">
          <button className="secondary">
            <CalendarClock size={15} /> Schedule maintenance
          </button>
          <button className="primary">
            <GitCompareArrows size={15} /> Evaluate disruption
          </button>
        </div>
      </section>
    </>
  );
}

function InventoryView({ data }: { data: ApiInventory | null }) {
  const [search, setSearch] = useState("");
  const inventoryRows = data
    ? data.items.map((item) => {
        const mrp = data.mrp.find(
          (row) => row.material_code === item.material_code,
        );
        return {
          code: item.material_code,
          description: item.description,
          category: item.category,
          unit: item.unit,
          onHand: item.current_inventory,
          safety: item.safety_stock,
          reorder: item.reorder_point,
          unitCost: item.unit_cost,
          supplier: item.supplier,
          lead: item.lead_time_days,
          coverage: item.coverage_days,
          projected:
            mrp?.projected_balance ??
            item.current_inventory -
              (item.current_inventory / Math.max(item.coverage_days, 0.1)) * 7,
          recommendation: mrp?.purchase_recommendation ?? 0,
        };
      })
    : materials.map((m) => ({
        ...m,
        coverage: m.onHand / m.dailyUse,
        projected: m.onHand - m.dailyUse * 7,
        recommendation: Math.max(
          0,
          Math.ceil((m.reorder + m.dailyUse * m.lead - m.onHand) / 10) * 10,
        ),
      }));
  const rows = inventoryRows
    .filter((m) =>
      `${m.code} ${m.description}`.toLowerCase().includes(search.toLowerCase()),
    );
  const value = inventoryRows.reduce((s, m) => s + m.onHand * m.unitCost, 0);
  const low = rows.filter((m) => m.onHand < m.reorder);
  return (
    <>
      <section className="metric-grid compact">
        <MetricCard
          code="INV"
          label="Raw-material inventory value"
          value={formatINR(value)}
          delta="▼ 2.2%"
          tone="neutral"
        />
        <MetricCard
          code="RISK"
          label="Items below reorder point"
          value={String(low.length)}
          delta={`${low.filter((m) => m.onHand < m.safety).length} critical`}
          tone="negative"
        />
        <MetricCard
          code="PO"
          label="Modeled purchase value"
          value={formatINR(
            rows.reduce((s, m) => s + m.recommendation * m.unitCost, 0),
          )}
          delta={`${rows.filter((m) => m.recommendation > 0).length} recommendations`}
          tone="neutral"
        />
        <MetricCard
          code="DOS"
          label="Median days of supply"
          value={`${[...rows].sort((a, b) => a.coverage - b.coverage)[Math.floor(rows.length / 2)].coverage.toFixed(1)} d`}
          delta="28-day horizon"
          tone="neutral"
        />
      </section>
      <div className="view-toolbar">
        <label className="search-box">
          <Search size={15} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search material code or description"
          />
        </label>
        <button className="secondary">
          <SlidersHorizontal size={15} /> Filter risk
        </button>
        <button className="primary">
          <RefreshCcw size={15} /> Recalculate MRP
        </button>
      </div>
      <Panel className="table-panel">
        <PanelHead
          kicker="BOM-DRIVEN REQUIREMENTS"
          title="Material requirements plan"
          action={<span className="engine-tag">28-day horizon</span>}
        />
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Material</th>
                <th>On hand</th>
                <th>Safety / reorder</th>
                <th>Coverage</th>
                <th>Projected 7d</th>
                <th>Risk</th>
                <th>Preferred supplier</th>
                <th>Purchase suggestion</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.code}>
                  <td>
                    <b>{m.code}</b>
                    <small>{m.description}</small>
                  </td>
                  <td>
                    {fmt(m.onHand)} {m.unit}
                  </td>
                  <td>
                    {fmt(m.safety)} / {fmt(m.reorder)}
                  </td>
                  <td>
                    <div className="coverage">
                      <i
                        style={{
                          width: `${Math.min(100, (m.coverage / 14) * 100)}%`,
                        }}
                      />
                      <span>{m.coverage.toFixed(1)} d</span>
                    </div>
                  </td>
                  <td>
                    {fmt(m.projected)} {m.unit}
                  </td>
                  <td>
                    <StatusPill
                      tone={
                        m.onHand < m.safety
                          ? "critical"
                          : m.onHand < m.reorder
                            ? "warning"
                            : "healthy"
                      }
                    >
                      {m.onHand < m.safety
                        ? "Critical"
                        : m.onHand < m.reorder
                          ? "Low"
                          : "Healthy"}
                    </StatusPill>
                  </td>
                  <td>
                    <b>{m.supplier}</b>
                    <small>{m.lead} day lead time</small>
                  </td>
                  <td>
                    {m.recommendation
                      ? `${fmt(m.recommendation)} ${m.unit} · ${formatINR(m.recommendation * m.unitCost)}`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}

function MaintenanceView({ data }: { data: ApiMaintenance | null }) {
  const ranked = (data
    ? data.machines.map((machine) => ({
        code: machine.machine_code,
        name: machine.name,
        risk: machine.failure_probability,
        vibration: machine.vibration_mm_s,
        temperature: machine.temperature_c,
        mtbf: machine.mtbf_hours,
        mttr: machine.mttr_hours,
        suggestedWindow: machine.suggested_window,
        drivers: machine.drivers,
        maintenanceDue: machine.maintenance_due,
      }))
    : machines.map((machine, index) => ({
        code: machine.code,
        name: machine.name,
        risk: machine.risk,
        vibration: machine.vibration,
        temperature: machine.temperature,
        mtbf: Math.round(510 + index * 43),
        mttr: Number((2.4 + index * 0.3).toFixed(1)),
        suggestedWindow:
          machine.risk > 60
            ? "Within 8 hours"
            : machine.risk > 20
              ? "Within 48 hours"
              : "Next planned PM",
        drivers:
          machine.vibration > 5
            ? ["elevated vibration", "overdue maintenance"]
            : ["accumulated runtime", "current modeled load"],
        maintenanceDue: "2026-08-20",
      }))).sort((a, b) => b.risk - a.risk);
  const averageMtbf = ranked.reduce((sum, row) => sum + row.mtbf, 0) / ranked.length;
  const averageMttr = ranked.reduce((sum, row) => sum + row.mttr, 0) / ranked.length;
  const overdue = ranked.filter((row) => row.maintenanceDue < "2026-08-19").length;
  const riskChart = ranked.map((m) => ({
    name: m.code,
    risk: m.risk,
    vibration: m.vibration,
  }));
  return (
    <>
      <section className="metric-grid compact">
        <MetricCard
          code="MTBF"
          label="Mean time between failures"
          value={`${Math.round(averageMtbf)} h`}
          delta="Cloud fleet average"
        />
        <MetricCard
          code="MTTR"
          label="Mean time to repair"
          value={`${averageMttr.toFixed(1)} h`}
          delta="Cloud fleet average"
        />
        <MetricCard
          code="PM"
          label="Preventive maintenance compliance"
          value={`${(((ranked.length - overdue) / ranked.length) * 100).toFixed(1)}%`}
          delta={`${overdue} overdue`}
          tone="negative"
        />
        <MetricCard
          code="COST"
          label="30-day maintenance cost"
          value="₹2.74 lakh"
          delta="Modeled"
          tone="neutral"
        />
      </section>
      <section className="two-col equal">
        <Panel>
          <PanelHead
            kicker="PREDICTIVE RISK"
            title="7-day failure probability"
            action={<span className="engine-tag">Random Forest</span>}
          />
          <div className="chart-large">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={riskChart} margin={{ left: -20, right: 8 }}>
                <CartesianGrid vertical={false} stroke="#e7eeee" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 9 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(v) => `${v}%`}
                  tick={{ fontSize: 9 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip />
                <Bar dataKey="risk" radius={[4, 4, 0, 0]}>
                  {riskChart.map((row) => (
                    <Cell
                      key={row.name}
                      fill={
                        row.risk > 40
                          ? "#e36d52"
                          : row.risk > 15
                            ? "#d9a247"
                            : "#1a9183"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel>
          <PanelHead kicker="CONDITION SIGNAL" title="Vibration vs risk" />
          <div className="condition-list">
            {ranked.slice(0, 7).map((m) => (
              <div key={m.code}>
                <span>
                  <b>{m.code}</b>
                  <small>
                    {m.vibration} mm/s · {m.temperature}°C
                  </small>
                </span>
                <div>
                  <i
                    style={{ width: `${m.risk}%` }}
                    className={riskClass(m.risk)}
                  />
                </div>
                <StatusPill tone={riskClass(m.risk)}>
                  {m.risk > 60 ? "Critical" : m.risk > 25 ? "High" : "Low"}
                </StatusPill>
              </div>
            ))}
          </div>
        </Panel>
      </section>
      <Panel className="table-panel">
        <PanelHead
          kicker="MAINTENANCE DECISION QUEUE"
          title="Recommended windows"
        />
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Machine</th>
                <th>Condition</th>
                <th>Risk</th>
                <th>MTBF</th>
                <th>MTTR</th>
                <th>Suggested window</th>
                <th>Primary drivers</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
            {ranked.slice(0, 10).map((m) => (
                <tr key={m.code}>
                  <td>
                    <b>{m.code}</b>
                    <small>{m.name}</small>
                  </td>
                  <td>
                    {m.vibration} mm/s · {m.temperature}°C
                  </td>
                  <td>
                    <b className={m.risk > 40 ? "coral-text" : ""}>{m.risk}%</b>
                  </td>
                  <td>{Math.round(m.mtbf)} h</td>
                  <td>{m.mttr.toFixed(1)} h</td>
                  <td>{m.suggestedWindow}</td>
                  <td>{m.drivers.join(" · ")}</td>
                  <td>
                    <button className="table-link">Plan</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <div className="model-card">
        <Bot size={18} />
        <div>
          <b>Model card · maintenance risk classifier</b>
          <p>
            Random Forest trained on 2,200 deterministic synthetic condition
            examples using vibration, temperature, runtime, overdue maintenance,
            and load. Intended for educational prioritization only; it is not
            validated on real equipment.
          </p>
        </div>
      </div>
    </>
  );
}

function QualityView({ data }: { data: ApiQuality | null }) {
  const fallbackSamples = Array.from({ length: 24 }, (_, i) => ({
    sample: i + 1,
    mean: Number(
      (50 + Math.sin(i * 0.8) * 0.09 + (i === 18 ? 0.18 : 0)).toFixed(3),
    ),
    range: Number((0.19 + Math.abs(Math.cos(i * 0.6)) * 0.14).toFixed(3)),
  }));
  const fallbackDefects = [
    { name: "Bore diameter", count: 84 },
    { name: "Surface finish", count: 61 },
    { name: "Runout", count: 45 },
    { name: "Porosity", count: 31 },
    { name: "Thread damage", count: 22 },
    { name: "Burr", count: 17 },
  ];
  const samples = data?.control_chart ?? fallbackSamples;
  let cumulative = 0;
  const total = fallbackDefects.reduce((s, d) => s + d.count, 0);
  const pareto = data
    ? data.pareto.map((row) => ({
        name: row.category,
        count: row.count,
        cumulative: row.cumulative_percent,
      }))
    : fallbackDefects.map((d) => ({
        ...d,
        cumulative: Math.round(((cumulative += d.count) / total) * 100),
      }));
  return (
    <>
      <section className="metric-grid compact">
        <MetricCard
          code="FPY"
          label="First-pass yield"
          value={`${(100 - (data?.rejection_rate ?? 2.2)).toFixed(1)}%`}
          delta={data ? "PostgreSQL inspections" : "Portable demo"}
        />
        <MetricCard
          code="SCRAP"
          label="Scrap rate"
          value={`${(data?.rejection_rate ?? 1.42).toFixed(2)}%`}
          delta={data ? "Cloud rejection rate" : "Portable demo"}
        />
        <MetricCard
          code="CP"
          label="Process capability Cp"
          value={(data?.cp ?? 1.47).toFixed(2)}
          delta="Capable"
        />
        <MetricCard
          code="CPK"
          label="Process capability Cpk"
          value={(data?.cpk ?? 1.31).toFixed(2)}
          delta="Watch centering"
          tone="neutral"
        />
      </section>
      <section className="two-col equal">
        <Panel>
          <PanelHead
            kicker="STATISTICAL PROCESS CONTROL"
            title="X-bar control chart"
            action={<span className="engine-tag">Bore Ø50.0 mm</span>}
          />
          <div className="chart-large">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={samples} margin={{ left: -18, right: 12 }}>
                <CartesianGrid vertical={false} stroke="#e6eded" />
                <XAxis
                  dataKey="sample"
                  tick={{ fontSize: 9 }}
                  axisLine={false}
                />
                <YAxis
                  domain={[49.65, 50.35]}
                  tick={{ fontSize: 9 }}
                  axisLine={false}
                />
                <Tooltip />
                <ReferenceLine
                  y={data?.ucl_xbar ?? 50.24}
                  stroke="#dc6d54"
                  strokeDasharray="4 4"
                  label={{ value: "UCL", position: "right", fontSize: 9 }}
                />
                <ReferenceLine
                  y={data?.xbar ?? 50}
                  stroke="#7f9799"
                  strokeDasharray="3 4"
                />
                <ReferenceLine
                  y={data?.lcl_xbar ?? 49.76}
                  stroke="#dc6d54"
                  strokeDasharray="4 4"
                  label={{ value: "LCL", position: "right", fontSize: 9 }}
                />
                <Line
                  dataKey="mean"
                  stroke="#0d847c"
                  strokeWidth={2}
                  dot={{ r: 2, fill: "#0d847c" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel>
          <PanelHead kicker="DEFECT PARETO" title="Top rejection categories" />
          <div className="chart-large">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={pareto} margin={{ left: -20, right: 8 }}>
                <CartesianGrid vertical={false} stroke="#e6eded" />
                <XAxis dataKey="name" tick={{ fontSize: 8 }} interval={0} />
                <YAxis yAxisId="left" tick={{ fontSize: 9 }} />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                  tick={{ fontSize: 9 }}
                />
                <Tooltip />
                <Bar
                  yAxisId="left"
                  dataKey="count"
                  fill="#2c8c86"
                  radius={[4, 4, 0, 0]}
                />
                <Line
                  yAxisId="right"
                  dataKey="cumulative"
                  stroke="#e16f52"
                  strokeWidth={2}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </section>
      <Panel>
        <PanelHead
          kicker="ENGINEERING INTERPRETATION"
          title="Quality decision summary"
        />
        <div className="insight-grid">
          <div>
            <span className="insight-icon">
              <Activity size={18} />
            </span>
            <b>Cloud SPC interpretation</b>
            <p>
              {data?.interpretation ??
                "One sample approaches the upper control limit. The calculated Cpk is below Cp, indicating modeled off-centering rather than excessive spread."}
            </p>
          </div>
          <div>
            <span className="insight-icon">
              <AlertTriangle size={18} />
            </span>
            <b>
              {pareto[0].name} drives {pareto[0].cumulative}% of defects
            </b>
            <p>
              Prioritize tool-offset verification on CNC-04 and VMC-02. This is
              an association in synthetic data, not proven causation.
            </p>
          </div>
          <div>
            <span className="insight-icon">
              <CircleDollarSign size={18} />
            </span>
            <b>Modeled cost of poor quality</b>
            <p>
              Scrap and rework represent ₹1.24 lakh in the current 30-day
              synthetic window.
            </p>
          </div>
        </div>
      </Panel>
    </>
  );
}

function CostView() {
  const k = calculateDashboard();
  const costData = [
    { name: "Material", value: 56.2, color: "#0e7e78" },
    { name: "Machine", value: 17.8, color: "#2f8fac" },
    { name: "Labor", value: 11.6, color: "#d8a444" },
    { name: "Energy", value: 5.4, color: "#725f9f" },
    { name: "Setup", value: 3.5, color: "#729687" },
    { name: "Scrap", value: 3.2, color: "#e26e52" },
    { name: "Maintenance", value: 2.3, color: "#9a8577" },
  ];
  const productCost = products.map((p) => ({
    name: p[1],
    target: Number(p[4]),
    actual: Math.round(Number(p[4]) * (1.02 + 0.01 * products.indexOf(p))),
  }));
  return (
    <>
      <section className="metric-grid compact">
        <MetricCard
          code="COST"
          label="30-day modeled production cost"
          value={formatINR(k.productionCost)}
          delta="▼ 2.7%"
        />
        <MetricCard
          code="CPU"
          label="Cost per good unit"
          value={formatINR(k.costPerUnit)}
          delta="▼ 4.1%"
        />
        <MetricCard
          code="MARGIN"
          label="Modeled gross contribution"
          value="₹18.42 lakh"
          delta="▲ 6.3%"
        />
        <MetricCard
          code="COPQ"
          label="Cost of poor quality"
          value="₹1.24 lakh"
          delta="Scrap + rework"
          tone="negative"
        />
      </section>
      <section className="two-col equal">
        <Panel>
          <PanelHead
            kicker="COST STRUCTURE"
            title="Manufacturing cost waterfall"
          />
          <div className="cost-stack">
            {costData.map((item) => (
              <div key={item.name}>
                <span>
                  <b>{item.name}</b>
                  <em>{item.value}%</em>
                </span>
                <i>
                  <b
                    style={{ width: `${item.value}%`, background: item.color }}
                  />
                </i>
              </div>
            ))}
          </div>
          <div className="cost-total">
            <span>Total modeled production cost</span>
            <b>{formatINR(k.productionCost)}</b>
          </div>
        </Panel>
        <Panel>
          <PanelHead kicker="TARGET CONTROL" title="Product cost variance" />
          <div className="chart-large">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={productCost} margin={{ left: -10, right: 8 }}>
                <CartesianGrid vertical={false} stroke="#e6eded" />
                <XAxis dataKey="name" tick={{ fontSize: 8 }} interval={0} />
                <YAxis
                  tickFormatter={(v) => `₹${v / 1000}k`}
                  tick={{ fontSize: 9 }}
                />
                <Tooltip formatter={(v) => formatINR(Number(v))} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar
                  dataKey="target"
                  name="Target cost"
                  fill="#cadbd9"
                  radius={[3, 3, 0, 0]}
                />
                <Bar
                  dataKey="actual"
                  name="Modeled actual"
                  fill="#177f79"
                  radius={[3, 3, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </section>
      <Panel>
        <PanelHead
          kicker="BUSINESS IMPACT"
          title="Addressable modeled opportunity"
        />
        <div className="opportunity-grid">
          <div>
            <span>
              <TimerReset size={17} />
            </span>
            <p>
              <b>Downtime</b>
              <small>CNC-04 + VMC-02</small>
            </p>
            <strong>₹0.68 lakh</strong>
            <em>potential monthly avoidance</em>
          </div>
          <div>
            <span>
              <Zap size={17} />
            </span>
            <p>
              <b>Energy</b>
              <small>Idle power and furnace loads</small>
            </p>
            <strong>₹0.21 lakh</strong>
            <em>modeled saving</em>
          </div>
          <div>
            <span>
              <Wrench size={17} />
            </span>
            <p>
              <b>Setup</b>
              <small>Family sequencing</small>
            </p>
            <strong>₹0.34 lakh</strong>
            <em>modeled saving</em>
          </div>
          <div>
            <span>
              <ShieldCheck size={17} />
            </span>
            <p>
              <b>Quality loss</b>
              <small>Bore and surface defects</small>
            </p>
            <strong>₹0.29 lakh</strong>
            <em>modeled saving</em>
          </div>
        </div>
      </Panel>
    </>
  );
}

function ScenarioLab({
  onComplete,
  token,
}: {
  onComplete: () => void;
  token: string;
}) {
  const [event, setEvent] = useState("Machine disruption");
  const [resource, setResource] = useState("CNC-04");
  const [magnitude, setMagnitude] = useState(100);
  const [duration, setDuration] = useState(12);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ScenarioResult | null>(null);
  const [recommendedActions, setRecommendedActions] = useState<string[]>([]);
  const runFallback = () => {
    const severity =
      Math.max(0.25, Math.min(1.6, magnitude / 100)) *
      Math.max(0.4, duration / 12);
    const disrupted = {
      ...defaultScenario.disrupted,
      otd: Number((defaultScenario.baseline.otd - 5.1 * severity).toFixed(1)),
      cost: Math.round(defaultScenario.baseline.cost + 42000 * severity),
      overtime: Math.round(defaultScenario.baseline.overtime + 25 * severity),
      throughput: Math.round(
        defaultScenario.baseline.throughput - 280 * severity,
      ),
      utilization: Number(
        (defaultScenario.baseline.utilization - 5.2 * severity).toFixed(1),
      ),
      lateness: Number(
        (defaultScenario.baseline.lateness + 5.5 * severity).toFixed(1),
      ),
      wip: Math.round(defaultScenario.baseline.wip + 112 * severity),
    };
    const recommended = {
      ...defaultScenario.recommended,
      otd: Number(Math.min(97.2, disrupted.otd + 7.4).toFixed(1)),
      cost: Math.round(disrupted.cost - 28000 * severity),
      overtime: Math.max(0, Math.round(disrupted.overtime - 17 * severity)),
      throughput: Math.round(disrupted.throughput + 315 * severity),
      utilization: Number(Math.min(94, disrupted.utilization + 9.6).toFixed(1)),
      lateness: Number(Math.max(0.6, disrupted.lateness - 6.1).toFixed(1)),
      wip: Math.max(0, Math.round(disrupted.wip - 128)),
    };
    setResult({ baseline: defaultScenario.baseline, disrupted, recommended });
    setRecommendedActions([
      "Move eligible work to alternate qualified machines",
      "Protect critical orders with targeted overtime",
      "Advance the affected resource inspection window",
    ]);
  };
  const run = async () => {
    setRunning(true);
    if (token) {
      try {
        const response = await runApiScenario(token, {
          name: `${event} · ${resource}`,
          event_type: event,
          resource_code: resource,
          magnitude,
          duration_hours: duration,
        });
        setResult({
          baseline: mapScenarioMetrics(response.baseline),
          disrupted: mapScenarioMetrics(response.disrupted),
          recommended: mapScenarioMetrics(response.recommended),
        });
        setRecommendedActions(response.actions);
        onComplete();
        return;
      } catch {
        runFallback();
        onComplete();
        return;
      } finally {
        setRunning(false);
      }
    }
    window.setTimeout(() => {
      runFallback();
      setRunning(false);
      onComplete();
    }, 950);
  };
  const rows = result
    ? [
        { label: "On-time delivery", key: "otd", suffix: "%" },
        { label: "Total production cost", key: "cost", currency: true },
        { label: "Overtime", key: "overtime", suffix: " h" },
        { label: "Throughput", key: "throughput", suffix: " units" },
        { label: "Utilization", key: "utilization", suffix: "%" },
        { label: "Average lateness", key: "lateness", suffix: " h" },
        { label: "WIP", key: "wip", suffix: " units" },
      ]
    : [];
  return (
    <>
      <section className="scenario-builder">
        <div className="scenario-form">
          <span className="kicker">DISRUPTION DESIGNER</span>
          <h2>Configure a factory event</h2>
          <label>
            Scenario type
            <select value={event} onChange={(e) => setEvent(e.target.value)}>
              {[
                "Machine disruption",
                "Demand shock",
                "Rush order",
                "Supplier delay",
                "Raw material shortage",
                "Worker absenteeism",
                "Quality problem",
                "Maintenance event",
                "Shift change",
                "Overtime",
                "Cost changes",
              ].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label>
            Affected resource
            <select
              value={resource}
              onChange={(e) => setResource(e.target.value)}
            >
              {machines.map((m) => (
                <option key={m.code}>{m.code}</option>
              ))}
              {materials.slice(0, 8).map((m) => (
                <option key={m.code}>{m.code}</option>
              ))}
            </select>
          </label>
          <div className="form-pair">
            <label>
              Magnitude
              <input
                type="number"
                value={magnitude}
                onChange={(e) => setMagnitude(Number(e.target.value))}
              />
              <small>% or quantity</small>
            </label>
            <label>
              Duration
              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
              />
              <small>hours</small>
            </label>
          </div>
          <button className="primary full" onClick={run} disabled={running}>
            {running ? (
              <RefreshCcw size={15} className="spin" />
            ) : (
              <Play size={15} />
            )}{" "}
            {running
              ? "Simulating three factory states…"
              : "Run simulation & re-optimize"}
          </button>
        </div>
        <div className="scenario-visual">
          <div className="scenario-orbit">
            <span className="factory-core">
              <Factory size={31} />
              <b>Factory baseline</b>
              <small>32 active orders</small>
            </span>
            {[
              "Queues",
              "Breakdowns",
              "Setups",
              "Materials",
              "Repairs",
              "Shifts",
            ].map((x, i) => (
              <span className={`orbit-node o${i + 1}`} key={x}>
                {x}
              </span>
            ))}
          </div>
          <div className="engine-badges">
            <span>
              <Command size={13} />
              OR-Tools schedule
            </span>
            <ArrowRight size={14} />
            <span>
              <Activity size={13} />
              SimPy evaluation
            </span>
            <ArrowRight size={14} />
            <span>
              <Sparkles size={13} />
              Re-optimized plan
            </span>
          </div>
        </div>
      </section>
      {!result ? (
        <section className="scenario-empty">
          <Sparkles size={26} />
          <h2>Run the flagship CNC-04 breakdown story</h2>
          <p>
            PlantPilot will evaluate the normal baseline, the disruption without
            intervention, and a recommended finite-capacity response. Every
            value is labeled as modeled.
          </p>
          <div>
            {[
              "Machine unavailable for 12 hours",
              "Critical order AM-2481 at risk",
              "Eligible work can move to CNC-02",
            ].map((x) => (
              <span key={x}>
                <Check size={13} />
                {x}
              </span>
            ))}
          </div>
        </section>
      ) : (
        <>
          <section className="scenario-result-head">
            <div>
              <span className="kicker">SIMULATION COMPLETE</span>
              <h2>
                {event} · {resource}
              </h2>
              <p>
                Discrete-event evaluation with deterministic seed 20260820 ·
                modeled synthetic-factory results
              </p>
            </div>
            <StatusPill tone="healthy">Recommended plan found</StatusPill>
          </section>
          <Panel className="comparison-panel">
            <div className="comparison-table">
              <div className="compare-head">
                <b>KPI</b>
                <span>
                  Baseline<small>Normal plan</small>
                </span>
                <span className="disrupted">
                  Disrupted<small>No corrective action</small>
                </span>
                <span className="recommended">
                  Recommended<small>After re-optimization</small>
                </span>
                <span>Improvement</span>
              </div>
              {rows.map((row) => {
                const key = row.key as keyof typeof result.baseline;
                const base = result.baseline[key];
                const dis = result.disrupted[key];
                const rec = result.recommended[key];
                const lowerBetter = [
                  "cost",
                  "overtime",
                  "lateness",
                  "wip",
                ].includes(row.key);
                const improvement = lowerBetter
                  ? Number(dis) - Number(rec)
                  : Number(rec) - Number(dis);
                const render = (v: number) =>
                  row.currency ? formatINR(v) : `${fmt(v)}${row.suffix || ""}`;
                return (
                  <div className="compare-row" key={row.key}>
                    <b>{row.label}</b>
                    <span>{render(Number(base))}</span>
                    <span className="disrupted">{render(Number(dis))}</span>
                    <span className="recommended">{render(Number(rec))}</span>
                    <span className="improvement">
                      {improvement >= 0 ? "+" : ""}
                      {row.currency
                        ? formatINR(Math.abs(improvement))
                        : `${improvement.toFixed(1)}${row.suffix || ""}`}
                    </span>
                  </div>
                );
              })}
            </div>
          </Panel>
          <section className="two-col equal">
            <Panel>
              <PanelHead
                kicker="RECOMMENDED RESPONSE"
                title="Actions selected by PlantPilot"
              />
              <div className="action-list">
                {recommendedActions.map((action, i) => (
                  <div key={action}>
                    <span>{i + 1}</span>
                    <p>
                      <b>{action}</b>
                      <small>
                        {[
                          "Capacity response",
                          "Labor decision",
                          "Maintenance response",
                          "Delivery policy",
                        ][i] || "Model-selected intervention"}
                      </small>
                    </p>
                    <Check size={16} />
                  </div>
                ))}
              </div>
            </Panel>
            <Panel>
              <PanelHead
                kicker="MODELED FINANCIAL IMPACT"
                title="Why the plan is better"
              />
              <div className="impact-list">
                <div>
                  <span>On-time delivery recovery</span>
                  <b>{pct(result.recommended.otd - result.disrupted.otd)}</b>
                </div>
                <div>
                  <span>Average lateness reduction</span>
                  <b>
                    {fmt(
                      result.disrupted.lateness - result.recommended.lateness,
                    )}{" "}
                    h
                  </b>
                </div>
                <div>
                  <span>Net cost recovery</span>
                  <b>
                    {formatINR(result.disrupted.cost - result.recommended.cost)}
                  </b>
                </div>
                <div>
                  <span>Working-capital WIP release</span>
                  <b>
                    {fmt(result.disrupted.wip - result.recommended.wip)} units
                  </b>
                </div>
              </div>
              <p className="method-note">
                Financial values are modeled estimates from PlantPilot&apos;s
                synthetic factory, not realized industrial savings.
              </p>
            </Panel>
          </section>
        </>
      )}
    </>
  );
}

function CopilotView() {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<
    { role: "user" | "assistant"; text: string; sources?: string[] }[]
  >([
    {
      role: "assistant",
      text: "I’m grounded in PlantPilot’s current synthetic-factory KPIs, order priorities, schedule, MRP, maintenance risk, quality, and modeled cost. What management decision should we examine?",
      sources: ["Current factory snapshot"],
    },
  ]);
  const [thinking, setThinking] = useState(false);
  const ask = (value?: string) => {
    const q = (value || question).trim();
    if (!q) return;
    setMessages((m) => [...m, { role: "user", text: q }]);
    setQuestion("");
    setThinking(true);
    setTimeout(() => {
      let text =
        "Plant health is stable at 82.4% OEE and 94.6% OTD. The immediate decision sequence is to protect the top constraint, expedite the material at risk, then authorize targeted—not broad—overtime.";
      let sources = [
        "30-day KPI snapshot",
        "Bottleneck ranking",
        "MRP requirements",
      ];
      const l = q.toLowerCase();
      if (l.includes("late") || l.includes("delivery")) {
        text =
          "AM-2481 has the highest lateness risk because CNC-04 is overloaded and has elevated failure risk. Move eligible turning work, preserve its Critical-priority weight, and use 18 targeted overtime hours. The modeled Scenario Lab response improves OTD by 8.3 points versus disruption.";
        sources = [
          "Active order risk",
          "Finite-capacity load",
          "CNC-04 condition model",
        ];
      } else if (l.includes("inventory") || l.includes("material")) {
        text =
          "RM-007 EN24 flange blanks are below safety stock with 5.1 days of modeled coverage. Expedite enough to restore safety stock before the next Drive Shaft Flange release; the purchase recommendation is tied to BOM demand and supplier lead time.";
        sources = ["BOM explosion", "Inventory master", "Supplier lead time"];
      } else if (l.includes("cost")) {
        text =
          "The most addressable modeled cost is downtime at CNC-04 and VMC-02, followed by setup-family sequencing and bore-diameter quality loss. Together they represent roughly ₹1.31 lakh of monthly modeled opportunity in the synthetic factory.";
        sources = ["Machine rates", "Downtime history", "Quality cost model"];
      } else if (l.includes("maintenance") || l.includes("fail")) {
        text =
          "CNC-04 is the highest maintenance priority at 72% modeled 7-day risk. Vibration is 6.8 mm/s, temperature is 78°C, and PM is overdue. Inspect within 8 hours and reroute eligible operations first.";
        sources = [
          "Condition readings",
          "Synthetic Random Forest",
          "Maintenance calendar",
        ];
      }
      setMessages((m) => [...m, { role: "assistant", text, sources }]);
      setThinking(false);
    }, 650);
  };
  const prompts = [
    "Why is AM-2481 likely to be late?",
    "Which material should we expedite?",
    "Where can we reduce modeled cost?",
    "Which machine needs maintenance first?",
  ];
  return (
    <section className="copilot-shell">
      <aside>
        <div className="copilot-brand">
          <span>
            <Bot size={23} />
          </span>
          <h2>PlantPilot Copilot</h2>
          <p>Factory-grounded decision support</p>
        </div>
        <div className="mode-card">
          <span className="live-dot" />
          <div>
            <b>Deterministic fallback active</b>
            <small>No external API key required</small>
          </div>
        </div>
        <h3>Suggested questions</h3>
        {prompts.map((p) => (
          <button key={p} onClick={() => ask(p)}>
            {p}
            <ArrowRight size={13} />
          </button>
        ))}
        <div className="scope-card">
          <ShieldCheck size={17} />
          <p>
            <b>Grounded by design</b>
            <small>
              Answers cite calculated factory sources and clearly label modeled
              values.
            </small>
          </p>
        </div>
      </aside>
      <div className="chat">
        <div className="messages">
          {messages.map((message, i) => (
            <div key={i} className={`message ${message.role}`}>
              <span>
                {message.role === "assistant" ? <Bot size={16} /> : "AK"}
              </span>
              <div>
                <p>{message.text}</p>
                {message.sources && (
                  <div className="source-chips">
                    {message.sources.map((source) => (
                      <em key={source}>{source}</em>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {thinking && (
            <div className="message assistant">
              <span>
                <Bot size={16} />
              </span>
              <div className="typing">
                <i />
                <i />
                <i />
              </div>
            </div>
          )}
        </div>
        <form
          className="chat-input"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            ask();
          }}
        >
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask about delivery, cost, capacity, maintenance, quality…"
          />
          <button disabled={!question.trim()}>
            <ArrowRight size={17} />
          </button>
        </form>
        <p className="chat-disclaimer">
          Demonstration decision support on synthetic data. Recommendations
          require engineering review before real-world use.
        </p>
      </div>
    </section>
  );
}

function ReportsView() {
  const k = calculateDashboard();
  const reports = [
    {
      title: "Executive manufacturing summary",
      desc: "Plant health, delivery, cost, risks, and next-best actions",
      icon: LayoutDashboard,
    },
    {
      title: "Production & OEE review",
      desc: "Availability, performance, quality, downtime, and throughput",
      icon: Activity,
    },
    {
      title: "Finite-capacity schedule pack",
      desc: "Machine assignments, tardiness, capacity, and setup plan",
      icon: CalendarClock,
    },
    {
      title: "Inventory & MRP action list",
      desc: "Coverage, shortages, BOM demand, and purchase recommendations",
      icon: Boxes,
    },
    {
      title: "Quality & maintenance review",
      desc: "SPC, capability, Pareto, condition risk, MTBF, and MTTR",
      icon: ShieldCheck,
    },
    {
      title: "Scenario comparison brief",
      desc: "Baseline, disrupted, recommended, and modeled financial impact",
      icon: Sparkles,
    },
  ];
  return (
    <>
      <section className="executive-summary">
        <div>
          <span className="kicker">LATEST MANAGEMENT BRIEF</span>
          <h2>Plant performance remains stable; protect CNC-04 and RM-007.</h2>
          <p>
            OEE improved to {pct(k.oee)} while on-time delivery holds at{" "}
            {pct(k.otd)}. The recommended near-term action is to move eligible
            Critical-order work before CNC-04 maintenance and expedite EN24
            flange blanks.
          </p>
          <div>
            <span>
              <b>{pct(k.oee)}</b> OEE
            </span>
            <span>
              <b>{pct(k.otd)}</b> OTD
            </span>
            <span>
              <b>{formatINR(k.productionCost)}</b> modeled cost
            </span>
          </div>
        </div>
        <span className="summary-stamp">
          SYNTHETIC
          <br />
          FACTORY
          <br />
          19 AUG 2026
        </span>
      </section>
      <div className="report-grid">
        {reports.map(({ title, desc, icon: Icon }, i) => (
          <article key={title}>
            <span>
              <Icon size={19} />
            </span>
            <div>
              <h3>{title}</h3>
              <p>{desc}</p>
              <small>Updated from current factory snapshot</small>
            </div>
            <button
              onClick={() =>
                i === 0 ? downloadExecutive(k) : downloadCsv(demoOrders)
              }
            >
              <Download size={15} /> Export {i === 0 ? "summary" : "CSV"}
            </button>
          </article>
        ))}
      </div>
      <Panel>
        <PanelHead
          kicker="CASE STUDY SNAPSHOT"
          title="CNC-04 breakdown response"
        />
        <div className="case-strip">
          <div>
            <span>Problem</span>
            <b>12-hour turning-center outage</b>
            <p>Critical delivery risk and queue accumulation.</p>
          </div>
          <ArrowRight size={18} />
          <div>
            <span>Analysis</span>
            <b>CP-SAT + SimPy</b>
            <p>Reassigned eligible operations and evaluated queues.</p>
          </div>
          <ArrowRight size={18} />
          <div>
            <span>Modeled result</span>
            <b>+8.3 pts OTD</b>
            <p>₹0.38 lakh net cost recovery vs disruption.</p>
          </div>
        </div>
      </Panel>
    </>
  );
}

function SettingsView({ reset }: { reset: () => void }) {
  const [saved, setSaved] = useState(false);
  return (
    <section className="settings-grid">
      <Panel>
        <PanelHead kicker="PLANNING DEFAULTS" title="Factory assumptions" />
        <div className="settings-form">
          <label>
            Plant timezone
            <select defaultValue="Asia/Kolkata">
              <option>Asia/Kolkata</option>
            </select>
          </label>
          <label>
            Currency
            <select defaultValue="INR">
              <option>INR — Indian Rupee</option>
            </select>
          </label>
          <label>
            Operational horizon
            <select defaultValue="7">
              <option value="7">7 days</option>
              <option value="14">14 days</option>
            </select>
          </label>
          <label>
            Capacity horizon
            <select defaultValue="28">
              <option value="28">4 weeks</option>
              <option value="56">8 weeks</option>
            </select>
          </label>
        </div>
      </Panel>
      <Panel>
        <PanelHead kicker="OPTIMIZATION" title="Objective weights" />
        <div className="slider-list">
          {[
            ["Weighted tardiness", 10],
            ["Makespan", 3],
            ["Setup/changeover", 5],
            ["Overtime", 4],
            ["Manufacturing cost", 3],
          ].map(([label, value]) => (
            <label key={String(label)}>
              <span>
                {label}
                <b>{value}</b>
              </span>
              <input
                type="range"
                min="0"
                max="20"
                defaultValue={Number(value)}
              />
            </label>
          ))}
        </div>
        <button
          className="primary"
          onClick={() => {
            setSaved(true);
            setTimeout(() => setSaved(false), 1500);
          }}
        >
          {saved ? <Check size={15} /> : <SlidersHorizontal size={15} />}{" "}
          {saved ? "Settings saved" : "Save optimization settings"}
        </button>
      </Panel>
      <Panel>
        <PanelHead kicker="DEMO CONTROL" title="Synthetic factory" />
        <div className="demo-card">
          <RefreshCcw size={20} />
          <div>
            <b>Reset Demo Factory</b>
            <p>
              Restore only the portable browser dataset. This control never
              resets or deletes cloud PostgreSQL data.
            </p>
          </div>
          <button className="danger-button" onClick={reset}>
            Reset browser demo
          </button>
        </div>
      </Panel>
      <Panel>
        <PanelHead kicker="INTEGRATIONS" title="PlantPilot Copilot" />
        <div className="integration-row">
          <span>
            <Bot size={19} />
          </span>
          <div>
            <b>Deterministic fallback</b>
            <p>Available · no external secret required</p>
          </div>
          <StatusPill tone="healthy">Active</StatusPill>
        </div>
        <div className="integration-row">
          <span>
            <Sparkles size={19} />
          </span>
          <div>
            <b>External LLM mode</b>
            <p>Set OPENAI_API_KEY in the local .env file</p>
          </div>
          <StatusPill tone="neutral">Optional</StatusPill>
        </div>
      </Panel>
    </section>
  );
}

function LoginScreen({
  onLogin,
}: {
  onLogin: (email: string, password: string) => Promise<string | null>;
}) {
  const [email, setEmail] = useState("admin@plantpilot.local");
  const [password, setPassword] = useState("PlantPilot@2026");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const message = await onLogin(email, password);
    setSubmitting(false);
    if (!message) {
      setError("");
    } else setError(message);
  };
  return (
    <main className="login-page">
      <section className="login-story">
        <div className="brand light">
          <span className="brand-mark">P</span>
          <div>
            <b>PlantPilot</b>
            <small>Factory intelligence</small>
          </div>
        </div>
        <div>
          <span className="kicker">AI MANUFACTURING COMMAND CENTER</span>
          <h1>
            See the factory.
            <br />
            <em>Change the outcome.</em>
          </h1>
          <p>
            Finite-capacity planning, discrete-event simulation, MRP,
            maintenance intelligence, SPC, and modeled business impact—one
            synthetic digital factory.
          </p>
        </div>
        <div className="login-proof">
          <span>
            <b>15</b> work centers
          </span>
          <span>
            <b>420+</b> customer orders
          </span>
          <span>
            <b>180 days</b> history
          </span>
        </div>
        <small>
          ApexMotion Components Pvt. Ltd. · Manesar · Synthetic demonstration
          factory
        </small>
      </section>
      <section className="login-form-wrap">
        <form onSubmit={submit}>
          <span className="login-icon">
            <Factory size={22} />
          </span>
          <h2>Enter the command center</h2>
          <p>Sign in to the populated PlantPilot demo.</p>
          <label>
            Email address
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>
          {error && (
            <div className="login-error">
              <AlertTriangle size={14} />
              {error}
            </div>
          )}
          <button className="primary full" disabled={submitting}>
            {submitting ? "Authenticating…" : "Sign in"}{" "}
            <ArrowRight size={15} />
          </button>
          <div className="demo-credentials">
            <span>DEMO ACCESS</span>
            <code>admin@plantpilot.local</code>
            <code>PlantPilot@2026</code>
          </div>
          <small>
            All data is deterministic and synthetic. No real company data is
            represented.
          </small>
        </form>
      </section>
    </main>
  );
}

function CreateOrderModal({
  close,
  create,
}: {
  close: () => void;
  create: (order: Order) => void;
}) {
  const [customer, setCustomer] = useState("Novus Vehicle Systems");
  const [productIndex, setProductIndex] = useState(0);
  const [quantity, setQuantity] = useState(40);
  const [priority, setPriority] = useState<Order["priority"]>("High");
  const [due, setDue] = useState("2026-08-28");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const product = products[productIndex];
    create({
      id: Date.now(),
      order_code: `AM-${2513 + Math.floor(Math.random() * 100)}`,
      customer,
      product_id: productIndex + 1,
      product: String(product[1]),
      sku: String(product[0]),
      quantity,
      due_date: new Date(`${due}T12:00:00+05:30`).toISOString(),
      priority,
      status: "New",
      progress: 0,
      lateness_risk: Math.min(
        94,
        Math.round(
          12 +
            quantity / 2 +
            (priority === "Critical" ? 28 : priority === "High" ? 12 : 0),
        ),
      ),
      margin: Number(product[3]) - Number(product[4]),
    });
    close();
  };
  return (
    <div className="modal-backdrop">
      <button
        type="button"
        className="backdrop-dismiss"
        aria-label="Close create-order dialog"
        onClick={close}
      />
      <form className="modal" onSubmit={submit}>
        <button type="button" className="drawer-close" onClick={close}>
          <X size={18} />
        </button>
        <span className="kicker">NEW CUSTOMER ORDER</span>
        <h2>Create demand</h2>
        <p>
          PlantPilot will calculate material, capacity, cost, and lateness
          implications.
        </p>
        <label>
          Customer
          <input
            required
            minLength={2}
            value={customer}
            onChange={(e) => setCustomer(e.target.value)}
          />
        </label>
        <label>
          Product
          <select
            value={productIndex}
            onChange={(e) => setProductIndex(Number(e.target.value))}
          >
            {products.map((p, i) => (
              <option key={String(p[0])} value={i}>
                {p[0]} · {p[1]}
              </option>
            ))}
          </select>
        </label>
        <div className="form-pair">
          <label>
            Quantity
            <input
              type="number"
              min="1"
              max="10000"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
            />
          </label>
          <label>
            Priority
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as Order["priority"])}
            >
              <option>Standard</option>
              <option>High</option>
              <option>Critical</option>
            </select>
          </label>
        </div>
        <label>
          Promised date
          <input
            type="date"
            min="2026-08-20"
            value={due}
            onChange={(e) => setDue(e.target.value)}
          />
        </label>
        <div className="form-actions">
          <button type="button" className="secondary" onClick={close}>
            Cancel
          </button>
          <button className="primary">
            <Plus size={15} /> Create order
          </button>
        </div>
      </form>
    </div>
  );
}

function downloadCsv(rows: Order[]) {
  const header =
    "Order,Customer,Product,Quantity,Due Date,Priority,Status,Progress,Lateness Risk\n";
  const csv =
    header +
    rows
      .map((o) =>
        [
          o.order_code,
          o.customer,
          o.product,
          o.quantity,
          o.due_date,
          o.priority,
          o.status,
          o.progress,
          o.lateness_risk,
        ]
          .map((v) => `"${String(v).replaceAll('"', '""')}"`)
          .join(","),
      )
      .join("\n");
  downloadBlob(csv, "plantpilot-orders.csv", "text/csv");
}
function downloadExecutive(k: ReturnType<typeof calculateDashboard>) {
  downloadBlob(
    `PlantPilot Executive Summary\nApexMotion Components Pvt. Ltd. — Synthetic Factory\n\nOEE: ${k.oee}%\nOn-time delivery: ${k.otd}%\nUtilization: ${k.utilization}%\nProduction cost: ${formatINR(k.productionCost)}\nCost per unit: ${formatINR(k.costPerUnit)}\n\nRecommended action: Protect CNC-04 capacity and expedite RM-007.\n\nAll values are modeled or observed in PlantPilot's synthetic factory.`,
    "plantpilot-executive-summary.txt",
    "text/plain",
  );
}
function downloadBlob(content: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export default function PlantPilotApp() {
  const [loggedIn, setLoggedIn] = useState(true);
  const [view, setView] = useState<View>("command");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [orders, setOrders] = useState(demoOrders);
  const [createOpen, setCreateOpen] = useState(false);
  const [notifications, setNotifications] = useState(3);
  const [toast, setToast] = useState("");
  const [dashboard, setDashboard] = useState<ApiDashboard | null>(null);
  const [inventoryData, setInventoryData] = useState<ApiInventory | null>(null);
  const [maintenanceData, setMaintenanceData] =
    useState<ApiMaintenance | null>(null);
  const [qualityData, setQualityData] = useState<ApiQuality | null>(null);
  const [apiState, setApiState] = useState<ApiState>("connecting");
  const [connectionAttempt, setConnectionAttempt] = useState(0);
  const [cloudError, setCloudError] = useState("");
  const [token, setToken] = useState("");
  const hydrated = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  useEffect(() => {
    let active = true;
    async function connectToFactory() {
      try {
        const session = await apiLogin(
          "admin@plantpilot.local",
          "PlantPilot@2026",
        );
        const [
          dashboardResponse,
          orderResponse,
          inventoryResponse,
          maintenanceResponse,
          qualityResponse,
        ] = await Promise.all([
          getDashboard(),
          getOrders(),
          getInventory(),
          getMaintenance(),
          getQuality(),
        ]);
        if (!active) return;
        setToken(session.access_token);
        setDashboard(dashboardResponse);
        setOrders(orderResponse.items.map(mapApiOrder));
        setInventoryData(inventoryResponse);
        setMaintenanceData(maintenanceResponse);
        setQualityData(qualityResponse);
        setApiState("connected");
        setCloudError("");
      } catch (error) {
        if (active) {
          setApiState("demo");
          setCloudError(
            error instanceof Error
              ? error.message
              : "The PlantPilot cloud API could not be reached",
          );
        }
      }
    }
    void connectToFactory();
    return () => {
      active = false;
    };
  }, [connectionAttempt]);
  const navigate = (next: View) => {
    setView(next);
    setMobileOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const notify = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(""), 2200);
  };
  const reset = () => {
    setOrders(demoOrders);
    setDashboard(null);
    setInventoryData(null);
    setMaintenanceData(null);
    setQualityData(null);
    setApiState("demo");
    setCloudError("Portable browser demo selected; cloud data was not changed");
    notify("Portable browser demo restored; PostgreSQL was not changed");
  };
  const authenticate = async (email: string, password: string) => {
    try {
      const session = await apiLogin(email, password);
      setToken(session.access_token);
      setLoggedIn(true);
      setView("command");
      setApiState("connected");
      notify("Welcome to PlantPilot");
      return null;
    } catch {
      if (
        apiState === "demo" &&
        email.toLowerCase() === "admin@plantpilot.local" &&
        password === "PlantPilot@2026"
      ) {
        setLoggedIn(true);
        setView("command");
        notify("Welcome to PlantPilot demo fallback");
        return null;
      }
      return "Incorrect email or password. Use the demo credentials shown below.";
    }
  };
  const persistStatus = async (id: number, status: string) => {
    if (!token) return null;
    try {
      const updated = mapApiOrder(await updateApiOrder(token, id, status));
      notify(`${updated.order_code} saved to PostgreSQL`);
      return updated;
    } catch {
      notify("Status updated locally; the API could not be reached");
      return null;
    }
  };
  const createOrder = async (order: Order) => {
    if (token && order.product_id) {
      try {
        const created = mapApiOrder(
          await createApiOrder(token, {
            customer: order.customer,
            product_id: order.product_id,
            quantity: order.quantity,
            due_date: order.due_date,
            priority: order.priority,
          }),
        );
        setOrders((current) => [created, ...current]);
        notify(`${created.order_code} created`);
        return;
      } catch {
        notify("API unavailable; order retained in the portable demo");
      }
    }
    setOrders((current) => [order, ...current]);
    notify(`${order.order_code} created`);
  };
  if (!loggedIn) return <LoginScreen onLogin={authenticate} />;
  let content: React.ReactNode;
  switch (view) {
    case "command":
      content = (
        <CommandCenter
          navigate={navigate}
          dashboard={dashboard}
          apiState={apiState}
        />
      );
      break;
    case "orders":
      content = (
        <OrdersView
          orders={orders}
          setOrders={setOrders}
          openCreate={() => setCreateOpen(true)}
          onStatusUpdate={persistStatus}
        />
      );
      break;
    case "schedule":
      content = <ScheduleView token={token} notify={notify} />;
      break;
    case "capacity":
      content = <CapacityView />;
      break;
    case "line":
      content = <LineBalancingView />;
      break;
    case "machines":
      content = <MachinesView />;
      break;
    case "inventory":
      content = <InventoryView data={inventoryData} />;
      break;
    case "maintenance":
      content = <MaintenanceView data={maintenanceData} />;
      break;
    case "quality":
      content = <QualityView data={qualityData} />;
      break;
    case "cost":
      content = <CostView />;
      break;
    case "scenario":
      content = (
        <ScenarioLab
          token={token}
          onComplete={() => notify("Scenario saved to PostgreSQL history")}
        />
      );
      break;
    case "copilot":
      content = <CopilotView />;
      break;
    case "reports":
      content = <ReportsView />;
      break;
    default:
      content = <SettingsView reset={reset} />;
  }
  return (
    <main
      className={`app-shell ${collapsed ? "collapsed" : ""}`}
      data-hydrated={hydrated}
      data-api-state={apiState}
    >
      <button
        className="mobile-menu"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label="Toggle navigation"
      >
        <Menu size={20} />
      </button>
      <aside className={`sidebar ${mobileOpen ? "mobile-open" : ""}`}>
        <div className="brand">
          <span className="brand-mark">P</span>
          <div>
            <b>PlantPilot</b>
            <small>Factory intelligence</small>
          </div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            aria-label="Collapse sidebar"
          >
            <PanelLeftClose size={17} />
          </button>
        </div>
        <nav aria-label="Primary navigation">
          {navGroups.map((group) => (
            <div className="nav-group" key={group.label}>
              <span className="nav-label">{group.label}</span>
              {group.items.map(({ id, label, icon: Icon }) => (
                <button
                  className={`nav-item ${view === id ? "active" : ""}`}
                  key={id}
                  onClick={() => navigate(id)}
                  title={collapsed ? label : undefined}
                >
                  <Icon size={17} />
                  <span>{label}</span>
                  {id === "scenario" && <em>LAB</em>}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span className="live-dot" />
          <div>
            <b>ApexMotion Components</b>
            <small>Manesar · Shift B live</small>
          </div>
        </div>
      </aside>
      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">WEDNESDAY · 19 AUGUST 2026 · 14:32 IST</p>
            <h1>{titles[view][0]}</h1>
            <p>{titles[view][1]}</p>
          </div>
          <div className="header-actions">
            <button
              className="search-trigger"
              onClick={() => {
                navigate("orders");
                notify("Search active in Customer Orders");
              }}
            >
              <Search size={15} />
              <span>Search</span>
              <kbd>⌘ K</kbd>
            </button>
            <button
              className="icon-button notification"
              aria-label="Notifications"
              onClick={() => {
                setNotifications(0);
                navigate("reports");
              }}
            >
              <Bell size={17} />
              {notifications > 0 && <em>{notifications}</em>}
            </button>
            <button
              className="scenario-button"
              onClick={() => navigate("scenario")}
            >
              <Sparkles size={15} />
              Run scenario
            </button>
            <div className="profile">
              <span>AK</span>
              <div>
                <b>Aarav Khanna</b>
                <small>Factory Admin</small>
              </div>
              <ChevronDown size={13} />
              <button
                className="logout"
                aria-label="Log out"
                onClick={() => {
                  setToken("");
                  setLoggedIn(false);
                }}
              >
                <LogOut size={14} />
              </button>
            </div>
          </div>
        </header>
        {apiState === "demo" && (
          <div className="cloud-status-alert" role="alert">
            <AlertTriangle size={17} />
            <div>
              <b>PlantPilot&apos;s cloud operations service is temporarily unavailable.</b>
              <span>
                Showing the labelled portable demo dataset. Cloud writes,
                scheduling, and Scenario Lab persistence are unavailable.
                {cloudError ? ` ${cloudError}` : ""}
              </span>
            </div>
            <button
              className="secondary"
              onClick={() => {
                setApiState("connecting");
                setCloudError("");
                setConnectionAttempt((attempt) => attempt + 1);
              }}
            >
              <RefreshCcw size={14} /> Retry cloud connection
            </button>
          </div>
        )}
        <div className="content">{content}</div>
        <footer>
          <span>PlantPilot v1.0.1 · ApexMotion synthetic factory</span>
          <span>
            Asia/Kolkata · INR · Seed 20260819 ·{" "}
            {apiState === "connected" ? "API connected" : "demo fallback"}
          </span>
        </footer>
      </section>
      {createOpen && (
        <CreateOrderModal
          close={() => setCreateOpen(false)}
          create={(order) => void createOrder(order)}
        />
      )}
      {toast && (
        <div className="toast">
          <Check size={15} />
          {toast}
        </div>
      )}
    </main>
  );
}
