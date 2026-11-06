import type { Json } from "./database.types";

export type SheetKey =
  | "dashboard"
  | "materials"
  | "assets"
  | "requests"
  | "materialMovements"
  | "assetMovements"
  | "projectSites"
  | "checkSchedule"
  | "verification";

export type Material = {
  id: string; stock_record_id: string; sku: string; item_description: string; category: string; uom: string;
  location: string; bin_location: string; minimum_stock: number; opening_balance: number; total_in: number;
  total_out: number; on_hand: number; approved_pending: number; available: number; stock_status: string;
  last_movement: string | null; preferred_supplier: string; unit_cost_usd: number; stock_value_usd: number;
  remarks: string; extra_data: Json;
};
export type Asset = {
  id: string; asset_id: string; category: string; asset_name: string; make_model: string; serial_no: string; uom: string;
  ownership: string; purchase_date: string | null; original_cost_usd: number; home_location: string; current_location: string;
  project_id: string; assigned_to: string; condition: string; status: string; deployment_start: string | null;
  due_date: string | null; last_return: string | null; days_out: number; last_movement: string | null;
  inspection_due: string | null; calibration_due: string | null; availability_flag: string; remarks: string; extra_data: Json;
};
export type RequestRow = {
  id: string; request_id: string; request_date: string | null; inventory_type: string; project_id: string; project_site: string;
  requester: string; department: string; required_date: string | null; priority: string; item_asset_id: string; description: string;
  uom: string; qty_requested: number; purpose: string; approver: string; approval_status: string; approved_qty: number;
  approval_date: string | null; source_location: string; issue_status: string; qty_issued: number; balance_to_issue: number;
  due_return_date: string | null; remarks: string; extra_data: Json;
};
export type MaterialMovement = {
  id: string; movement_id: string; transaction_date: string | null; request_id: string; movement_type: string; sku: string;
  item_description: string; uom: string; quantity: number; from_location: string; to_location: string; project_id: string;
  project_site: string; handed_over_by: string; received_by: string; approval_doc_ref: string; unit_cost_usd: number;
  movement_value_usd: number; entry_check: string; remarks: string; extra_data: Json;
};
export type AssetMovement = {
  id: string; movement_id: string; movement_date: string | null; request_id: string; action: string; asset_id: string;
  asset_name: string; from_location: string; to_location: string; project_id: string; project_site: string; assigned_to: string;
  condition_out: string; condition_in: string; resulting_condition: string; due_date: string | null; return_date: string | null;
  approved_by: string; handover_ref: string; entry_check: string; remarks: string; extra_data: Json;
};
export type ProjectSite = {
  id: string; project_id: string; project_name: string; client: string; site_location: string; project_manager: string;
  start_date: string | null; end_date: string | null; status: string; site_store_location: string; notes: string; extra_data: Json;
};
export type CheckSchedule = {
  id: string; check_id: string; check_period: string; frequency: string; check_scope: string; location: string;
  planned_date: string | null; actual_date: string | null; lead_verifier: string; independent_checker: string;
  check_status: string; lines_planned: number; lines_verified: number; exceptions: number; post_freeze_movement_lines: number;
  completion_pct: number; open_actions: number; approved_by: string; approval_date: string | null; next_check_due: string | null;
  verification_outcome: string; notes: string; extra_data: Json;
};
export type VerificationLine = {
  id: string; check_line_id: string; check_id: string; check_date: string | null; frequency: string; location: string;
  inventory_type: string; item_asset_id: string; description: string; uom: string; live_system_qty: number | null;
  system_qty_cutoff: number | null; live_vs_cutoff: number | null; physical_qty: number | null; count_variance: number | null;
  variance_pct: number | null; live_system_condition: string; recorded_condition_cutoff: string; physical_condition: string;
  verification_result: string; variance_cause: string; corrective_action: string; responsible: string; target_date: string | null;
  action_status: string; verified_by: string; independent_checker: string; adjustment_approval_ref: string; evidence_notes: string; extra_data: Json;
};

export const SHEETS: { key: SheetKey; label: string }[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "materials", label: "Materials Register" },
  { key: "assets", label: "Assets & Tools" },
  { key: "requests", label: "Requests" },
  { key: "materialMovements", label: "Material Movements" },
  { key: "assetMovements", label: "Asset Movements" },
  { key: "projectSites", label: "Project Sites" },
  { key: "checkSchedule", label: "Check Schedule" },
  { key: "verification", label: "Verification Matrix" },
];

export const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
export const dateFmt = (v?: string | null) => (v ? String(v).slice(0, 10) : "—");
export const num = (v: unknown, fallback = 0) => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.replace(/[$,%\s]/g, ""));
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
};
export const txt = (v: unknown) => (v == null ? "" : String(v).trim());
function excelSerialToIso(serial: number): string | null {
  if (!Number.isFinite(serial) || serial < 1 || serial > 2958465) return null;
  const whole = Math.floor(serial);
  if (whole < 1) return null;
  const utc = Date.UTC(1899, 11, 30) + whole * 86400000;
  const d = new Date(utc);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  if (y < 1900 || y > 2200) return null;
  return `${y}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}
export const isoDate = (v: unknown): string | null => {
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    const y = v.getUTCFullYear();
    if (y < 1900 || y > 2200) return null;
    return v.toISOString().slice(0, 10);
  }
  if (typeof v === "number") return excelSerialToIso(v);
  const s = txt(v);
  if (!s || /^#|1900-01-00/i.test(s)) return null;
  const n = Number(s.replace(/[$,\s]/g, ""));
  if (Number.isFinite(n) && /^[\d$,\s.]+$/.test(s) && n > 25569 && n < 2958465) {
    const ex = excelSerialToIso(n);
    if (ex) return ex;
  }
  const m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) {
    const y = Number(m[1]);
    if (y >= 1900 && y <= 2200) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
    return null;
  }
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    const y = d.getUTCFullYear();
    if (y >= 1900 && y <= 2200) return d.toISOString().slice(0, 10);
  }
  return null;
};
export function toJson(v: unknown): Json {
  if (v instanceof Date) return v.toISOString();
  if (v === null || typeof v === "string" || typeof v === "number" || typeof v === "boolean") return v;
  return String(v);
}
export function extraText(extra: Json, key: string) {
  if (!extra || typeof extra !== "object" || Array.isArray(extra)) return "—";
  const v = (extra as Record<string, Json | undefined>)[key];
  return v == null ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v);
}
export function normKey(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}
export function findHeader(headers: string[], aliases: string[]) {
  const norm = headers.map(normKey);
  for (const a of aliases) {
    const i = norm.indexOf(normKey(a));
    if (i >= 0) return i;
  }
  return -1;
}
export function detectDataStart(rows: unknown[][]) {
  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    const joined = rows[i].map(txt).join(" ").toLowerCase();
    if (joined.includes("stock record") || joined.includes("asset id") || joined.includes("request id") || joined.includes("movement id") || joined.includes("project id") || joined.includes("check id") || joined.includes("check line")) return i;
  }
  return 0;
}
export function sheetKind(name: string): SheetKey | null {
  const n = name.toLowerCase();
  if (n.includes("dashboard")) return "dashboard";
  if (n.includes("read me")) return null;
  if (n.includes("material") && n.includes("register")) return "materials";
  if (n.includes("asset") && n.includes("tool") && !n.includes("movement")) return "assets";
  if (n.includes("request")) return "requests";
  if (n.includes("material") && n.includes("movement")) return "materialMovements";
  if (n.includes("asset") && n.includes("movement")) return "assetMovements";
  if (n.includes("project") && n.includes("site")) return "projectSites";
  if (n.includes("check") && n.includes("schedule")) return "checkSchedule";
  if (n.includes("verification")) return "verification";
  if (n.includes("setup")) return null;
  return null;
}
export function pillClass(value: string) {
  const v = value.toLowerCase();
  if (/approved|verified|available|completed|closed|ok|in stock|site stock/.test(v)) return "pill pill-good";
  if (/pending|due soon|in progress|open|hold|low stock|issued|deployed/.test(v)) return "pill pill-warn";
  if (/rejected|overdue|missing|out of stock|variance|damaged|cancelled|retired/.test(v)) return "pill pill-bad";
  return "pill";
}
