export type DailyKpi = {
  date: string;
  availability: number;
  performance: number;
  quality: number;
  oee: number;
  throughput: number;
  downtime: number;
};
export type Order = {
  id: number;
  order_code: string;
  customer: string;
  product_id?: number;
  product: string;
  sku: string;
  quantity: number;
  due_date: string;
  promised_date?: string;
  priority: "Standard" | "High" | "Critical";
  status: string;
  progress: number;
  lateness_risk: number;
  margin: number;
  production_requirements?: Array<Record<string, unknown>>;
  material_requirements?: Array<Record<string, unknown>>;
};
export type Machine = {
  code: string;
  name: string;
  type: string;
  department: string;
  state: string;
  utilization: number;
  available: number;
  required: number;
  risk: number;
  vibration: number;
  temperature: number;
  operation: string;
};
export type Material = {
  code: string;
  description: string;
  category: string;
  unit: string;
  onHand: number;
  safety: number;
  reorder: number;
  dailyUse: number;
  unitCost: number;
  supplier: string;
  lead: number;
};

const round = (value: number, digits = 1) => Number(value.toFixed(digits));

export const dailyKpis: DailyKpi[] = Array.from({ length: 14 }, (_, index) => {
  const availability = 88.3 + Math.sin(index * 0.72) * 2.5 + index * 0.18;
  const performance = 92.4 + Math.cos(index * 0.55) * 1.9 + index * 0.12;
  const quality = 97.7 + Math.sin(index * 0.43 + 1) * 0.7;
  return {
    date: `${index + 6} Aug`,
    availability: round(availability),
    performance: round(performance),
    quality: round(quality),
    oee: round((availability * performance * quality) / 10000),
    throughput: Math.round(565 + index * 8 + Math.sin(index) * 31),
    downtime: round(15.5 - index * 0.35 + Math.cos(index) * 1.9),
  };
});

export const products = [
  ["AM-SK210", "Steering Knuckle", "Chassis", 8650, 6420],
  ["AM-BH330", "Bearing Hub", "Wheel End", 6250, 4610],
  ["AM-GH410", "Gear Housing", "Powertrain", 9200, 6880],
  ["AM-TC125", "Transmission Cover", "Powertrain", 7100, 5140],
  ["AM-DF600", "Drive Shaft Flange", "Driveline", 4850, 3520],
  ["AM-SB220", "Suspension Bracket", "Chassis", 2850, 1980],
  ["AM-BR480", "Brake Rotor", "Brake", 5350, 3940],
  ["AM-EP315", "Engine Mounting Plate", "Powertrain", 3650, 2540],
];

const customers = [
  "Northstar Mobility",
  "Zenith Auto Systems",
  "VectorDrive India",
  "Altura Motors",
  "Orbit EV Technologies",
  "Kinetic Commercial Vehicles",
  "Crestline Automotive",
  "Vardhan Mobility",
];
const orderStatuses = [
  "In Production",
  "Released",
  "Planned",
  "Delayed",
  "In Production",
  "Released",
];
export const demoOrders: Order[] = Array.from({ length: 32 }, (_, index) => {
  const product = products[(index * 5 + 2) % products.length];
  const priority = (
    ["Critical", "High", "Standard", "Standard", "High", "Standard"] as const
  )[index % 6];
  const quantity = 24 + ((index * 17) % 71);
  const risk = Math.min(
    96,
    18 + ((index * 13) % 68) + (priority === "Critical" ? 12 : 0),
  );
  return {
    id: index + 1,
    order_code: `AM-${2481 + index}`,
    customer: customers[index % customers.length],
    product: String(product[1]),
    sku: String(product[0]),
    quantity,
    due_date: new Date(
      Date.UTC(2026, 7, 20 + (index % 13), 12 + (index % 6)),
    ).toISOString(),
    priority,
    status:
      index === 0 ? "Delayed" : orderStatuses[index % orderStatuses.length],
    progress: Math.min(94, 8 + ((index * 19) % 86)),
    lateness_risk: risk,
    margin: Number(product[3]) - Number(product[4]),
  };
});

export const machines: Machine[] = [
  [
    "CNC-01",
    "Mazak Quick Turn 200",
    "CNC Turning",
    "Machining",
    "Running",
    86,
    147,
    126,
    8,
    3.1,
    52,
    "Turning",
  ],
  [
    "CNC-02",
    "DMG Mori NLX 2500",
    "CNC Turning",
    "Machining",
    "Running",
    92,
    147,
    135,
    14,
    3.8,
    57,
    "Boring",
  ],
  [
    "CNC-03",
    "Jyoti DX 200",
    "CNC Turning",
    "Machining",
    "Idle",
    69,
    147,
    101,
    6,
    2.6,
    48,
    "Turning",
  ],
  [
    "CNC-04",
    "Doosan Puma 2600",
    "CNC Turning",
    "Machining",
    "Running",
    108,
    147,
    159,
    72,
    6.8,
    78,
    "Threading",
  ],
  [
    "VMC-01",
    "Haas VF-4SS",
    "Vertical Machining",
    "Machining",
    "Running",
    88,
    147,
    129,
    11,
    3.4,
    55,
    "Milling",
  ],
  [
    "VMC-02",
    "Makino PS95",
    "Vertical Machining",
    "Machining",
    "Setup",
    104,
    147,
    153,
    23,
    4.2,
    62,
    "Milling",
  ],
  [
    "VMC-03",
    "BFW Chakra BMV60",
    "Vertical Machining",
    "Machining",
    "Running",
    81,
    147,
    119,
    9,
    3.0,
    54,
    "Drilling",
  ],
  [
    "DRL-01",
    "HMT Radial Drill RD32",
    "Radial Drilling",
    "Machining",
    "Running",
    76,
    147,
    112,
    5,
    2.2,
    45,
    "Drilling",
  ],
  [
    "GRD-01",
    "Micromatic GCU 350",
    "Cylindrical Grinder",
    "Finishing",
    "Idle",
    84,
    147,
    123,
    12,
    3.7,
    56,
    "Grinding",
  ],
  [
    "GRD-02",
    "Ace Micromatic IG 150",
    "Internal Grinder",
    "Finishing",
    "Running",
    79,
    147,
    116,
    10,
    3.5,
    54,
    "Grinding",
  ],
  [
    "HTF-01",
    "Ipsen Sealed Quench",
    "Heat Treatment",
    "Heat Treatment",
    "Running",
    96,
    147,
    141,
    17,
    3.9,
    69,
    "Heat Treatment",
  ],
  [
    "INS-01",
    "Zeiss Contura CMM",
    "Inspection",
    "Quality",
    "Running",
    89,
    147,
    131,
    7,
    1.8,
    41,
    "Inspection",
  ],
  [
    "ASM-01",
    "Flexible Assembly Cell 1",
    "Assembly",
    "Assembly",
    "Running",
    72,
    147,
    106,
    5,
    1.6,
    38,
    "Assembly",
  ],
  [
    "ASM-02",
    "Flexible Assembly Cell 2",
    "Assembly",
    "Assembly",
    "Idle",
    68,
    147,
    100,
    4,
    1.5,
    37,
    "Assembly",
  ],
  [
    "PKG-01",
    "Automated Pack & Mark",
    "Packaging",
    "Dispatch",
    "Running",
    74,
    147,
    109,
    3,
    1.4,
    35,
    "Packaging",
  ],
].map(
  ([
    code,
    name,
    type,
    department,
    state,
    utilization,
    available,
    required,
    risk,
    vibration,
    temperature,
    operation,
  ]) => ({
    code: String(code),
    name: String(name),
    type: String(type),
    department: String(department),
    state: String(state),
    utilization: Number(utilization),
    available: Number(available),
    required: Number(required),
    risk: Number(risk),
    vibration: Number(vibration),
    temperature: Number(temperature),
    operation: String(operation),
  }),
);

const materialRows = [
  [
    "RM-001",
    "EN8 forged steel blank Ø180",
    "Raw metal",
    "kg",
    7850,
    1800,
    2500,
    410,
    96,
    "Aravali Alloy Steels",
    6,
  ],
  [
    "RM-002",
    "EN24 alloy steel bar Ø90",
    "Raw metal",
    "kg",
    1280,
    1450,
    2100,
    265,
    142,
    "Aravali Alloy Steels",
    6,
  ],
  [
    "RM-003",
    "SG iron steering knuckle casting",
    "Casting",
    "pc",
    920,
    240,
    360,
    44,
    1880,
    "Narmada Precision Castings",
    10,
  ],
  [
    "RM-004",
    "FG260 bearing hub casting",
    "Casting",
    "pc",
    1310,
    310,
    470,
    61,
    1260,
    "Narmada Precision Castings",
    10,
  ],
  [
    "RM-005",
    "ADC12 gear housing casting",
    "Casting",
    "pc",
    640,
    180,
    290,
    37,
    1650,
    "Narmada Precision Castings",
    10,
  ],
  [
    "RM-006",
    "Aluminium 6061-T6 billet",
    "Raw metal",
    "kg",
    4120,
    900,
    1400,
    205,
    298,
    "Satluj Aluminium Works",
    8,
  ],
  [
    "RM-007",
    "EN24 drive shaft flange blank",
    "Forging",
    "pc",
    286,
    320,
    440,
    56,
    920,
    "Aravali Alloy Steels",
    6,
  ],
  [
    "RM-008",
    "IS2062 steel plate 12 mm",
    "Raw metal",
    "kg",
    5680,
    1200,
    1750,
    238,
    78,
    "Aravali Alloy Steels",
    6,
  ],
  [
    "RM-009",
    "High-carbon brake rotor casting",
    "Casting",
    "pc",
    760,
    220,
    350,
    48,
    1480,
    "Narmada Precision Castings",
    10,
  ],
  [
    "RM-010",
    "Taper roller bearing 30208",
    "Bought-out",
    "pc",
    1100,
    260,
    400,
    53,
    540,
    "Kaveri Bearing Systems",
    12,
  ],
  [
    "RM-011",
    "Deep groove bearing 6208",
    "Bought-out",
    "pc",
    1550,
    300,
    460,
    62,
    330,
    "Kaveri Bearing Systems",
    12,
  ],
  [
    "RM-012",
    "M12 class 10.9 flange bolt",
    "Fastener",
    "pc",
    4900,
    1800,
    2600,
    340,
    24,
    "Trident Industrial Fasteners",
    5,
  ],
  [
    "RM-013",
    "M10 prevailing torque nut",
    "Fastener",
    "pc",
    9200,
    2200,
    3300,
    470,
    13,
    "Trident Industrial Fasteners",
    5,
  ],
  [
    "RM-014",
    "Dowel pin Ø10 h6",
    "Fastener",
    "pc",
    3800,
    900,
    1350,
    180,
    19,
    "Trident Industrial Fasteners",
    5,
  ],
  [
    "RM-015",
    "Carbide turning insert CNMG",
    "Consumable",
    "pc",
    188,
    55,
    85,
    11,
    465,
    "Shivalik Cutting Tools",
    4,
  ],
  [
    "RM-016",
    "Carbide end mill Ø16",
    "Consumable",
    "pc",
    74,
    24,
    38,
    5,
    1680,
    "Shivalik Cutting Tools",
    4,
  ],
  [
    "RM-017",
    "CBN grinding wheel 400 mm",
    "Consumable",
    "pc",
    16,
    5,
    8,
    0.8,
    14800,
    "Shivalik Cutting Tools",
    4,
  ],
  [
    "RM-018",
    "Quenching oil ISO VG 32",
    "Chemical",
    "L",
    870,
    240,
    380,
    41,
    185,
    "Indus Process Chemicals",
    7,
  ],
  [
    "RM-019",
    "Water-soluble cutting fluid",
    "Chemical",
    "L",
    630,
    180,
    290,
    33,
    265,
    "Indus Process Chemicals",
    7,
  ],
  [
    "RM-020",
    "Rust preventive compound",
    "Chemical",
    "L",
    290,
    80,
    125,
    15,
    312,
    "Indus Process Chemicals",
    7,
  ],
  [
    "RM-021",
    "VDA automotive carton 450 mm",
    "Packaging",
    "pc",
    1660,
    420,
    650,
    91,
    82,
    "Pragati Packaging Solutions",
    3,
  ],
  [
    "RM-022",
    "VCI corrosion protection bag",
    "Packaging",
    "pc",
    2900,
    720,
    1100,
    150,
    38,
    "Pragati Packaging Solutions",
    3,
  ],
  [
    "RM-023",
    "Returnable plastic separator",
    "Packaging",
    "pc",
    870,
    180,
    280,
    34,
    96,
    "Pragati Packaging Solutions",
    3,
  ],
  [
    "RM-024",
    "Product traceability label",
    "Packaging",
    "pc",
    9800,
    2800,
    4300,
    610,
    4.2,
    "Pragati Packaging Solutions",
    3,
  ],
];
export const materials: Material[] = materialRows.map(
  ([
    code,
    description,
    category,
    unit,
    onHand,
    safety,
    reorder,
    dailyUse,
    unitCost,
    supplier,
    lead,
  ]) => ({
    code: String(code),
    description: String(description),
    category: String(category),
    unit: String(unit),
    onHand: Number(onHand),
    safety: Number(safety),
    reorder: Number(reorder),
    dailyUse: Number(dailyUse),
    unitCost: Number(unitCost),
    supplier: String(supplier),
    lead: Number(lead),
  }),
);

export const calculateDashboard = () => {
  const average = (key: keyof DailyKpi) =>
    dailyKpis.reduce((sum, row) => sum + Number(row[key]), 0) /
    dailyKpis.length;
  const throughput = dailyKpis.reduce((sum, row) => sum + row.throughput, 0);
  const scrapRate = round(1.36 + (100 - average("quality")) * 0.22, 2);
  const goodUnits = Math.round(throughput * (1 - scrapRate / 100));
  const runtimeHours = machines.reduce(
    (sum, machine) => sum + machine.required,
    0,
  );
  const inventoryValue = materials.reduce(
    (sum, material) => sum + material.onHand * material.unitCost,
    0,
  );
  const productionCost =
    runtimeHours * 1330 +
    goodUnits * 1180 +
    ((throughput * scrapRate) / 100) * 1220;
  const completed = demoOrders.filter(
    (order) => order.status === "Completed" || order.status === "Shipped",
  );
  const onTime = completed.length
    ? (completed.filter((order) => order.lateness_risk < 55).length /
        completed.length) *
      100
    : 94.6;
  return {
    oee: round(average("oee")),
    availability: round(average("availability")),
    performance: round(average("performance")),
    quality: round(average("quality")),
    throughput,
    otd: round(onTime),
    adherence: round(88.9 + average("oee") * 0.06),
    utilization: round(
      machines.reduce((sum, m) => sum + m.utilization, 0) / machines.length,
    ),
    wip: demoOrders.reduce(
      (sum, order) =>
        sum + Math.round(order.quantity * (1 - order.progress / 100)),
      0,
    ),
    scrapRate,
    rework: Math.round(((throughput * scrapRate) / 100) * 0.39),
    leadTime: round(
      demoOrders.reduce(
        (sum, order) => sum + (new Date(order.due_date).getUTCDate() - 19 + 7),
        0,
      ) / demoOrders.length,
    ),
    downtime: round(dailyKpis.reduce((sum, row) => sum + row.downtime, 0)),
    overtime: round(
      machines.reduce(
        (sum, m) => sum + Math.max(0, m.required - m.available),
        0,
      ),
    ),
    inventoryValue,
    stockoutRisk: materials.filter(
      (material) => material.onHand < material.reorder,
    ).length,
    productionCost,
    costPerUnit: Math.round(productionCost / goodUnits),
    energy: Math.round(runtimeHours * 21.4),
  };
};

export const formatINR = (value: number) =>
  value >= 100000
    ? `₹${(value / 100000).toFixed(2)} lakh`
    : new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
      }).format(value);

export const seedSchedule = demoOrders
  .slice(0, 12)
  .flatMap((order, orderIndex) => {
    const routes =
      order.product.includes("Housing") || order.product.includes("Cover")
        ? ["Milling", "Drilling", "Inspection", "Packaging"]
        : ["Turning", "Grinding", "Inspection", "Packaging"];
    let cursor = (orderIndex * 87) % 420;
    return routes.map((operation, opIndex) => {
      const eligible = machines.filter(
        (machine) =>
          machine.operation === operation ||
          (operation === "Packaging" && machine.code === "PKG-01"),
      );
      const machine =
        eligible[(orderIndex + opIndex) % Math.max(1, eligible.length)] ||
        machines[(orderIndex + opIndex) % machines.length];
      const duration = Math.round(
        42 + order.quantity * (opIndex === 0 ? 4.2 : 2.1),
      );
      const assignment = {
        id: `${order.id}-${opIndex}`,
        order: order.order_code,
        product: order.product,
        priority: order.priority,
        operation,
        machine: machine.code,
        start: cursor,
        end: cursor + duration,
        setup: opIndex === 0 ? 22 : 8,
      };
      cursor += duration + 14;
      return assignment;
    });
  });

export const defaultScenario = {
  baseline: {
    otd: 94.6,
    cost: 812000,
    overtime: 29,
    throughput: 2876,
    utilization: 80.1,
    lateness: 2.8,
    wip: 418,
  },
  disrupted: {
    otd: 87.8,
    cost: 871000,
    overtime: 61,
    throughput: 2514,
    utilization: 72.4,
    lateness: 9.6,
    wip: 563,
  },
  recommended: {
    otd: 96.1,
    cost: 833000,
    overtime: 37,
    throughput: 2942,
    utilization: 84.7,
    lateness: 1.9,
    wip: 389,
  },
};

export const lineTasks = [
  { id: "T1", name: "Load bearing", time: 1.8, predecessors: [] },
  { id: "T2", name: "Press inner race", time: 2.4, predecessors: ["T1"] },
  { id: "T3", name: "Fit seal", time: 1.5, predecessors: ["T2"] },
  { id: "T4", name: "Apply grease", time: 1.1, predecessors: ["T2"] },
  { id: "T5", name: "Mount hub", time: 2.6, predecessors: ["T3", "T4"] },
  { id: "T6", name: "Torque fasteners", time: 2.2, predecessors: ["T5"] },
  { id: "T7", name: "Runout check", time: 1.7, predecessors: ["T6"] },
  { id: "T8", name: "Mark & release", time: 1.0, predecessors: ["T7"] },
];
