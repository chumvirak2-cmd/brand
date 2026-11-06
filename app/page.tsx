"use client";

import {
  AlertCircle,
  ArrowUpDown,
  Boxes,
  CalendarClock,
  Check,
  ClipboardCheck,
  FileSpreadsheet,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Search,
  ShieldCheck,
  Truck,
  Upload,
  Wrench,
  X,
} from "lucide-react";
import type { ChangeEvent, FormEvent, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";
import type { Json } from "@/lib/database.types";
import {
  type Asset, type AssetMovement, type CheckSchedule, type Material, type MaterialMovement,
  type ProjectSite, type RequestRow, type SheetKey, type VerificationLine,
  SHEETS, dateFmt, detectDataStart, findHeader, isoDate, money, num, pillClass, sheetKind, toJson, txt,
} from "@/lib/workbook";

type DataState = {
  materials: Material[]; assets: Asset[]; requests: RequestRow[]; materialMovements: MaterialMovement[];
  assetMovements: AssetMovement[]; projectSites: ProjectSite[]; checkSchedule: CheckSchedule[]; verification: VerificationLine[];
};
const emptyData: DataState = { materials: [], assets: [], requests: [], materialMovements: [], assetMovements: [], projectSites: [], checkSchedule: [], verification: [] };

export default function Home() {
  const configured = isSupabaseConfigured();
  const supabase = getSupabaseClient();
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(configured);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [authError, setAuthError] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [data, setData] = useState<DataState>(emptyData);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState("");
  const [view, setView] = useState<SheetKey>("dashboard");
  const [search, setSearch] = useState("");
  const [mobileNav, setMobileNav] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadAll = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setPageError("");
    const [m, a, r, mm, am, p, c, v] = await Promise.all([
      supabase.from("materials").select("*").order("sku"),
      supabase.from("assets").select("*").order("asset_id"),
      supabase.from("requests").select("*").order("request_date", { ascending: false }),
      supabase.from("material_movements").select("*").order("transaction_date", { ascending: false }),
      supabase.from("asset_movements").select("*").order("movement_date", { ascending: false }),
      supabase.from("project_sites").select("*").order("project_id"),
      supabase.from("check_schedule").select("*").order("planned_date", { ascending: false }),
      supabase.from("verification_matrix").select("*").order("check_date", { ascending: false }),
    ]);
    const err = [m, a, r, mm, am, p, c, v].find((x) => x.error)?.error;
    if (err) setPageError(`${err.message}. Run the latest Supabase migration for workbook tables.`);
    setData({
      materials: (m.data ?? []) as unknown as Material[], assets: (a.data ?? []) as unknown as Asset[],
      requests: (r.data ?? []) as unknown as RequestRow[], materialMovements: (mm.data ?? []) as unknown as MaterialMovement[],
      assetMovements: (am.data ?? []) as unknown as AssetMovement[], projectSites: (p.data ?? []) as unknown as ProjectSite[],
      checkSchedule: (c.data ?? []) as unknown as CheckSchedule[], verification: (v.data ?? []) as unknown as VerificationLine[],
    });
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data: d, error }) => {
      if (error) setAuthError(error.message);
      setSession(d.session);
      if (d.session) void loadAll(); else setLoading(false);
      setAuthLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s); setAuthError(""); setAuthMessage("");
      if (s) void loadAll(); else { setData(emptyData); setLoading(false); }
    });
    return () => sub.subscription.unsubscribe();
  }, [supabase, loadAll]);

  async function handleAuth(e: FormEvent) {
    e.preventDefault(); if (!supabase) return;
    setAuthSubmitting(true); setAuthError(""); setAuthMessage("");
    const r = authMode === "signin"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });
    if (r.error) setAuthError(r.error.message);
    else if (authMode === "signup" && !r.data.session) setAuthMessage("Check your inbox to confirm your email, then sign in.");
    setAuthSubmitting(false);
  }
  async function signOut() { if (supabase) await supabase.auth.signOut(); }

  async function importWorkbook(e: ChangeEvent<HTMLInputElement>) {
    const file = e.currentTarget.files?.[0]; e.currentTarget.value = ""; if (!file || !supabase || !session) return;
    setImporting(true); setPageError(""); setImportMessage("");
    try {
      if (!file.name.toLowerCase().endsWith(".xlsx")) throw new Error("Choose an .xlsx Excel workbook.");
      const readXlsxFile = (await import("read-excel-file/browser")).default;
      const sheets = (await readXlsxFile(file)) as Array<{ sheet: string; data: unknown[][] }>;
      const mapped = sheets.map((s) => ({ name: s.sheet, data: s.data, kind: sheetKind(s.sheet) })).filter((s): s is { name: string; data: unknown[][]; kind: SheetKey } => !!s.kind);
      if (!mapped.length) throw new Error("No workbook sheets were recognized. Expected B2G sheet names like Materials Register, Assets & Tools, Requests, etc.");
      const summary: string[] = [];
      for (const sheet of mapped) {
        const rows = sheet.data ?? [];
        const headerIdx = detectDataStart(rows);
        const headers = (rows[headerIdx] ?? []).map((c, i) => txt(c) || `Column ${i + 1}`);
        const body = rows.slice(headerIdx + 1);
        const parsed = parseSheet(sheet.kind, headers, body);
        if (!parsed.table) continue;
        const table = parsed.table as "materials" | "assets" | "requests" | "material_movements" | "asset_movements" | "project_sites" | "check_schedule" | "verification_matrix";
        const del = await supabase.from(table).delete().eq("user_id", session.user.id);
        if (del.error) throw new Error(`${sheet.name}: ${del.error.message}`);
        let count = 0;
        for (let i = 0; i < parsed.rows.length; i += 200) {
          const batch = parsed.rows.slice(i, i + 200);
          const ins = await supabase.from(table).insert(batch as never[]);
          if (ins.error) throw new Error(`${sheet.name}: ${ins.error.message}`);
          count += batch.length;
        }
        summary.push(`${sheet.name}: ${count}`);
      }
      await loadAll();
      setImportMessage(`Imported workbook. ${summary.join(" · ") || "No data rows found."}`);
    } catch (err) {
      setPageError(err instanceof Error ? err.message : "Workbook import failed.");
    } finally { setImporting(false); }
  }

  const q = search.trim().toLowerCase();
  const filtered = useMemo(() => ({
    materials: data.materials.filter((r) => !q || [r.sku, r.item_description, r.category, r.location, r.preferred_supplier].join(" ").toLowerCase().includes(q)),
    assets: data.assets.filter((r) => !q || [r.asset_id, r.asset_name, r.category, r.serial_no, r.current_location, r.assigned_to, r.status].join(" ").toLowerCase().includes(q)),
    requests: data.requests.filter((r) => !q || [r.request_id, r.item_asset_id, r.description, r.project_id, r.requester, r.approval_status].join(" ").toLowerCase().includes(q)),
    materialMovements: data.materialMovements.filter((r) => !q || [r.movement_id, r.sku, r.item_description, r.movement_type, r.from_location, r.to_location, r.project_id].join(" ").toLowerCase().includes(q)),
    assetMovements: data.assetMovements.filter((r) => !q || [r.movement_id, r.asset_id, r.asset_name, r.action, r.from_location, r.to_location, r.assigned_to].join(" ").toLowerCase().includes(q)),
    projectSites: data.projectSites.filter((r) => !q || [r.project_id, r.project_name, r.client, r.site_location, r.status].join(" ").toLowerCase().includes(q)),
    checkSchedule: data.checkSchedule.filter((r) => !q || [r.check_id, r.location, r.frequency, r.check_status, r.verification_outcome].join(" ").toLowerCase().includes(q)),
    verification: data.verification.filter((r) => !q || [r.check_line_id, r.check_id, r.item_asset_id, r.description, r.location, r.verification_result].join(" ").toLowerCase().includes(q)),
  }), [data, q]);

  if (authLoading) return <main className="loading-screen"><div className="brand-mark"><Boxes size={23} /></div><span>Loading workspace</span></main>;
  if (!session) return <AuthView {...{ configured, authMode, setAuthMode, email, setEmail, password, setPassword, authError, authMessage, authSubmitting, handleAuth }} />;

  const name = session.user.email?.split("@")[0] ?? "user";
  const counts: Record<SheetKey, number> = { dashboard: 0, materials: data.materials.length, assets: data.assets.length, requests: data.requests.length, materialMovements: data.materialMovements.length, assetMovements: data.assetMovements.length, projectSites: data.projectSites.length, checkSchedule: data.checkSchedule.length, verification: data.verification.length };

  return (
    <main className="app-shell">
      {mobileNav && <button className="nav-scrim" aria-label="Close navigation" onClick={() => setMobileNav(false)} />}
      <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
        <Brand />
        <div className="nav-label">B2G WORKBOOK</div>
        <nav className="main-nav" aria-label="Workbook sheets">
          {SHEETS.map((s) => (
            <button key={s.key} type="button" className={`nav-item ${view === s.key ? "active" : ""}`} onClick={() => { setView(s.key); setMobileNav(false); }}>
              <NavIcon k={s.key} /> {s.label} {s.key !== "dashboard" && <span className="nav-count">{counts[s.key]}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="profile-row"><div className="profile-avatar">{name[0]?.toUpperCase()}</div><div className="profile-info"><strong>{name}</strong><span>{session.user.email}</span></div><button className="icon-button signout-button" onClick={signOut} aria-label="Sign out"><LogOut size={17} /></button></div>
        </div>
      </aside>
      <section className="main-content">
        <header className="topbar">
          <button className="mobile-menu icon-button" aria-label="Open navigation" onClick={() => setMobileNav(true)}><Menu size={20} /></button>
          <div className="breadcrumbs"><span>B2G Engineering</span><span className="breadcrumb-slash">/</span><strong>{SHEETS.find((s) => s.key === view)?.label}</strong></div>
          <div className="topbar-right">
            <input ref={fileRef} className="visually-hidden" type="file" accept=".xlsx" onChange={(e) => void importWorkbook(e)} />
            <button className="toolbar-button upload-button" type="button" onClick={() => fileRef.current?.click()} disabled={importing || loading}>
              {importing ? <FileSpreadsheet size={15} /> : <Upload size={15} />} <span>{importing ? "Importing…" : "Upload Workbook"}</span>
            </button>
            <button className="icon-button" type="button" onClick={() => void loadAll()} aria-label="Refresh"><ArrowUpDown size={17} /></button>
          </div>
        </header>
        <div className="page-content">
          {pageError && <div className="page-alert"><AlertCircle size={17} />{pageError}<button onClick={() => setPageError("")} aria-label="Dismiss"><X size={15} /></button></div>}
          {importMessage && <div className="import-feedback" role="status">{importMessage}</div>}
          {view !== "dashboard" && <div className="table-toolbar"><label className="search-field"><Search size={16} /><input type="search" placeholder={`Search ${SHEETS.find((s) => s.key === view)?.label ?? ""}...`} value={search} onChange={(e) => setSearch(e.target.value)} /></label></div>}
          {loading ? <div className="section-loading"><span className="loading-dot" />Loading workbook data…</div>
            : view === "dashboard" ? <Dashboard data={data} />
            : view === "materials" ? <MaterialsTable rows={filtered.materials} />
            : view === "assets" ? <AssetsTable rows={filtered.assets} />
            : view === "requests" ? <RequestsTable rows={filtered.requests} />
            : view === "materialMovements" ? <MaterialMovesTable rows={filtered.materialMovements} />
            : view === "assetMovements" ? <AssetMovesTable rows={filtered.assetMovements} />
            : view === "projectSites" ? <ProjectsTable rows={filtered.projectSites} data={data} />
            : view === "checkSchedule" ? <ChecksTable rows={filtered.checkSchedule} />
            : <VerifyTable rows={filtered.verification} />}
          <footer className="page-footer"><span>B2G Engineering <span className="footer-dot">·</span> Stock Inventory Workbook</span><span><ShieldCheck size={13} /> Private to your account</span></footer>
        </div>
      </section>
    </main>
  );
}

function NavIcon({ k }: { k: SheetKey }) {
  const map: Record<SheetKey, ReactNode> = { dashboard: <LayoutDashboard size={18} />, materials: <Boxes size={18} />, assets: <Wrench size={18} />, requests: <FileSpreadsheet size={18} />, materialMovements: <ArrowUpDown size={18} />, assetMovements: <Truck size={18} />, projectSites: <Package size={18} />, checkSchedule: <CalendarClock size={18} />, verification: <ClipboardCheck size={18} /> };
  return map[k];
}

function AuthView(p: { configured: boolean; authMode: "signin" | "signup"; setAuthMode: (m: "signin" | "signup") => void; email: string; setEmail: (v: string) => void; password: string; setPassword: (v: string) => void; authError: string; authMessage: string; authSubmitting: boolean; handleAuth: (e: FormEvent) => void }) {
  return (
    <main className="auth-page">
      <div className="auth-side"><Brand /><div className="auth-copy"><div className="eyebrow">B2G ENGINEERING</div><h1>Stock Inventory<br /><span>Workbook Dashboard</span></h1><p>Materials, returnable assets/tools, requests, project sites, movements, and verification control — aligned to the B2G workbook.</p></div></div>
      <section className="auth-panel"><div className="auth-card"><div className="auth-heading"><div className="auth-glyph"><Boxes size={22} /></div><h2>{p.authMode === "signin" ? "Sign in" : "Create account"}</h2><p>Access your private B2G inventory workspace.</p></div>
        <form className="auth-form" onSubmit={p.handleAuth}>
          <label htmlFor="email">Email</label><input id="email" type="email" required value={p.email} onChange={(e) => p.setEmail(e.target.value)} placeholder="you@company.com" />
          <label htmlFor="password">Password</label><input id="password" type="password" required minLength={6} value={p.password} onChange={(e) => p.setPassword(e.target.value)} placeholder="Password" />
          {p.authError && <div className="form-alert error-alert"><AlertCircle size={16} />{p.authError}</div>}
          {p.authMessage && <div className="form-alert success-alert"><Check size={16} />{p.authMessage}</div>}
          {!p.configured && <div className="setup-note">Add Supabase variables from <code>.env.example</code> to <code>.env.local</code>.</div>}
          <button className="button button-primary auth-submit" type="submit" disabled={p.authSubmitting}>{p.authSubmitting ? "Please wait…" : p.authMode === "signin" ? "Sign in" : "Create account"}</button>
        </form>
        <div className="auth-switch">{p.authMode === "signin" ? "New here?" : "Have an account?"}<button type="button" onClick={() => p.setAuthMode(p.authMode === "signin" ? "signup" : "signin")}>{p.authMode === "signin" ? "Create account" : "Sign in"}</button></div>
      </div></section>
    </main>
  );
}

function Brand() { return <div className="brand"><div className="brand-mark"><Boxes size={19} strokeWidth={2.2} /></div><span>B2G INVENTORY</span></div>; }

function Dashboard({ data }: { data: DataState }) {
  const inventoryValue = data.materials.reduce((s, r) => s + num(r.stock_value_usd), 0);
  const lowOut = data.materials.filter((r) => /low|no stock|out/i.test(r.stock_status)).length;
  const siteStock = data.materials.filter((r) => /site/i.test(r.stock_status)).length;
  const availableAssets = data.assets.filter((r) => /available/i.test(r.availability_flag || r.status)).length;
  const deployed = data.assets.filter((r) => /deployed|issued|in use/i.test(r.availability_flag || r.status)).length;
  const hold = data.assets.filter((r) => /hold|maintenance|repair/i.test(r.availability_flag || r.status)).length;
  const awaiting = data.requests.filter((r) => /pending|await/i.test(r.approval_status) || /await/i.test(r.issue_status)).length;
  const openIssue = data.requests.filter((r) => /approved/i.test(r.approval_status) && num(r.balance_to_issue) > 0).length;
  const overdue = data.requests.filter((r) => r.due_return_date && new Date(r.due_return_date) < new Date() && !/returned|closed|complete/i.test(r.issue_status)).length;
  const completedCycles = data.checkSchedule.filter((r) => /completed/i.test(r.check_status)).length;
  const dueSoon = data.checkSchedule.filter((r) => /due|overdue/i.test(r.check_status)).length;
  const exceptions = data.verification.filter((r) => /variance|missing|mismatch/i.test(r.verification_result)).length;
  const openActions = data.verification.filter((r) => /open|progress|escalat/i.test(r.action_status)).length;
  return (
    <>
      <div className="page-heading"><div><div className="eyebrow muted-eyebrow">LIVE WORKBOOK OVERVIEW</div><h1>Dashboard</h1><p>Materials, returnable assets/tools, requests, project sites, and control exceptions.</p></div></div>
      <div className="stats-grid">
        <Stat icon={<Boxes size={17} />} label="Material Stock Records" value={String(data.materials.length)} foot="From Materials Register" tone="blue" />
        <Stat icon={<span className="currency-symbol">$</span>} label="Inventory Value (USD)" value={money.format(inventoryValue)} foot="Calculated stock value" tone="purple" />
        <Stat icon={<AlertCircle size={17} />} label="Low / Out Stock" value={String(lowOut)} foot={`Site stock records: ${siteStock}`} tone={lowOut ? "warn" : "good"} />
        <Stat icon={<Wrench size={17} />} label="Assets / Tools" value={String(data.assets.length)} foot={`Available ${availableAssets} · Hold ${hold}`} tone="blue" />
        <Stat icon={<Truck size={17} />} label="Deployed Assets" value={String(deployed)} foot="Issued / in use" tone="neutral" />
        <Stat icon={<FileSpreadsheet size={17} />} label="Requests" value={String(data.requests.length)} foot={`Awaiting ${awaiting} · Open to issue ${openIssue}`} tone={awaiting || openIssue ? "warn" : "good"} />
        <Stat icon={<AlertCircle size={17} />} label="Overdue Returns" value={String(overdue)} foot="Returnable items past due" tone={overdue ? "warn" : "good"} />
        <Stat icon={<ClipboardCheck size={17} />} label="Check Cycles" value={String(completedCycles)} foot={`Due/overdue soon: ${dueSoon}`} tone={dueSoon ? "warn" : "good"} />
        <Stat icon={<AlertCircle size={17} />} label="Verification Exceptions" value={String(exceptions)} foot={`Open corrective actions: ${openActions}`} tone={exceptions || openActions ? "warn" : "good"} />
      </div>
      <section className="inventory-card"><div className="inventory-card-heading"><h2>Management attention</h2></div>
        <div style={{ padding: "0 19px 18px", color: "#5e6f82", fontSize: 11, lineHeight: 1.7 }}>
          Replenish low/out stock, complete approved pending issues, clear overdue returns, inspect/calibrate assets marked HOLD, complete due checks, investigate variances, confirm no post-freeze movements, and close corrective actions with approval references.
        </div>
      </section>
    </>
  );
}
function Stat({ icon, label, value, foot, tone }: { icon: ReactNode; label: string; value: string; foot: string; tone: string }) {
  return <article className="stat-card"><div className="stat-top"><span className={`stat-icon ${tone === "warn" ? "alert-icon" : tone === "good" ? "units-icon" : tone === "purple" ? "value-icon" : "inventory-icon"}`}>{icon}</span></div><div className="stat-value">{value}</div><div className="stat-label">{label}</div><div className="stat-foot"><span className={`stat-dot ${tone === "warn" ? "orange-dot" : tone === "good" ? "green-dot" : tone === "purple" ? "purple-dot" : "blue-dot"}`} /> {foot}</div></article>;
}

function TableWrap({ cols, children, count }: { cols: string[]; children: ReactNode; count: number }) {
  return <section className="inventory-card"><div className="table-wrap"><table className="inventory-sheet-table"><thead><tr>{cols.map((c) => <th key={c}>{c}</th>)}</tr></thead><tbody>{children}</tbody></table></div><div className="table-footer"><span>Showing <strong>{count}</strong> rows</span></div></section>;
}
const EmptyRow = ({ cols }: { cols: number }) => <tr><td colSpan={cols}><div className="empty-state"><div className="empty-icon"><Package size={21} /></div><strong>No records</strong><span>Upload the B2G workbook or add records to this register.</span></div></td></tr>;

function MaterialsTable({ rows }: { rows: Material[] }) {
  const cols = ["Stock Record ID","SKU","Item Description","Category","UOM","Location","Min","Opening","In","Out","On Hand","Approved Pending","Available","Stock Status","Last Movement","Supplier","Unit Cost","Stock Value","Remarks"];
  return <TableWrap cols={cols} count={rows.length}>{rows.length ? rows.map((r) => <tr key={r.id}><td>{r.stock_record_id || "—"}</td><td className="sku-text">{r.sku}</td><td>{r.item_description}</td><td>{r.category}</td><td>{r.uom}</td><td>{r.location}</td><td className="align-right">{num(r.minimum_stock)}</td><td className="align-right">{num(r.opening_balance)}</td><td className="align-right">{num(r.total_in)}</td><td className="align-right">{num(r.total_out)}</td><td className="align-right quantity-cell">{num(r.on_hand)}</td><td className="align-right">{num(r.approved_pending)}</td><td className="align-right">{num(r.available)}</td><td><span className={pillClass(r.stock_status)}>{r.stock_status || "—"}</span></td><td>{dateFmt(r.last_movement)}</td><td>{r.preferred_supplier || "—"}</td><td className="align-right">{money.format(num(r.unit_cost_usd))}</td><td className="align-right">{money.format(num(r.stock_value_usd))}</td><td>{r.remarks || "—"}</td></tr>) : <EmptyRow cols={cols.length} />}</TableWrap>;
}
function AssetsTable({ rows }: { rows: Asset[] }) {
  const cols = ["Asset ID","Category","Asset / Tool","Make / Model","Serial","Location","Project","Assigned To","Condition","Status","Due Date","Last Return","Inspection Due","Calibration Due","Flag","Remarks"];
  return <TableWrap cols={cols} count={rows.length}>{rows.length ? rows.map((r) => <tr key={r.id}><td className="sku-text">{r.asset_id}</td><td>{r.category}</td><td>{r.asset_name}</td><td>{r.make_model || "—"}</td><td>{r.serial_no || "—"}</td><td>{r.current_location || r.home_location || "—"}</td><td>{r.project_id || "—"}</td><td>{r.assigned_to || "—"}</td><td>{r.condition || "—"}</td><td><span className={pillClass(r.status)}>{r.status || "—"}</span></td><td>{dateFmt(r.due_date)}</td><td>{dateFmt(r.last_return)}</td><td>{dateFmt(r.inspection_due)}</td><td>{dateFmt(r.calibration_due)}</td><td><span className={pillClass(r.availability_flag)}>{r.availability_flag || "—"}</span></td><td>{r.remarks || "—"}</td></tr>) : <EmptyRow cols={cols.length} />}</TableWrap>;
}
function RequestsTable({ rows }: { rows: RequestRow[] }) {
  const cols = ["Request ID","Date","Type","Project","Requester","Item / Asset","Description","Qty Req","Approval","Approved Qty","Issue Status","Qty Issued","Balance","Due / Return","Remarks"];
  return <TableWrap cols={cols} count={rows.length}>{rows.length ? rows.map((r) => <tr key={r.id}><td className="sku-text">{r.request_id}</td><td>{dateFmt(r.request_date)}</td><td>{r.inventory_type}</td><td>{r.project_id || "—"}</td><td>{r.requester || "—"}</td><td>{r.item_asset_id || "—"}</td><td>{r.description || "—"}</td><td className="align-right">{num(r.qty_requested)}</td><td><span className={pillClass(r.approval_status)}>{r.approval_status || "—"}</span></td><td className="align-right">{num(r.approved_qty)}</td><td><span className={pillClass(r.issue_status)}>{r.issue_status || "—"}</span></td><td className="align-right">{num(r.qty_issued)}</td><td className="align-right">{num(r.balance_to_issue)}</td><td>{dateFmt(r.due_return_date)}</td><td>{r.remarks || "—"}</td></tr>) : <EmptyRow cols={cols.length} />}</TableWrap>;
}
function MaterialMovesTable({ rows }: { rows: MaterialMovement[] }) {
  const cols = ["Movement ID","Date","Request","Type","SKU","Description","Qty","From","To","Project","Handed Over","Received","Unit Cost","Value","Check","Remarks"];
  return <TableWrap cols={cols} count={rows.length}>{rows.length ? rows.map((r) => <tr key={r.id}><td className="sku-text">{r.movement_id || "—"}</td><td>{dateFmt(r.transaction_date)}</td><td>{r.request_id || "—"}</td><td><span className={pillClass(r.movement_type)}>{r.movement_type}</span></td><td className="sku-text">{r.sku}</td><td>{r.item_description || "—"}</td><td className="align-right">{num(r.quantity)}</td><td>{r.from_location || "—"}</td><td>{r.to_location || "—"}</td><td>{r.project_id || "—"}</td><td>{r.handed_over_by || "—"}</td><td>{r.received_by || "—"}</td><td className="align-right">{money.format(num(r.unit_cost_usd))}</td><td className="align-right">{money.format(num(r.movement_value_usd))}</td><td><span className={pillClass(r.entry_check)}>{r.entry_check || "—"}</span></td><td>{r.remarks || "—"}</td></tr>) : <EmptyRow cols={cols.length} />}</TableWrap>;
}
function AssetMovesTable({ rows }: { rows: AssetMovement[] }) {
  const cols = ["Movement ID","Date","Request","Action","Asset ID","Asset / Tool","From","To","Project","Assigned To","Condition Out/In","Due","Returned","Approved By","Remarks"];
  return <TableWrap cols={cols} count={rows.length}>{rows.length ? rows.map((r) => <tr key={r.id}><td className="sku-text">{r.movement_id || "—"}</td><td>{dateFmt(r.movement_date)}</td><td>{r.request_id || "—"}</td><td><span className={pillClass(r.action)}>{r.action}</span></td><td className="sku-text">{r.asset_id}</td><td>{r.asset_name || "—"}</td><td>{r.from_location || "—"}</td><td>{r.to_location || "—"}</td><td>{r.project_id || "—"}</td><td>{r.assigned_to || "—"}</td><td>{[r.condition_out, r.condition_in].filter(Boolean).join(" / ") || "—"}</td><td>{dateFmt(r.due_date)}</td><td>{dateFmt(r.return_date)}</td><td>{r.approved_by || "—"}</td><td>{r.remarks || "—"}</td></tr>) : <EmptyRow cols={cols.length} />}</TableWrap>;
}
function ProjectsTable({ rows, data }: { rows: ProjectSite[]; data: DataState }) {
  const cols = ["Project ID","Project Name","Client","Site Location","Manager","Start","End","Status","Site Store","Open Requests","Notes"];
  return <TableWrap cols={cols} count={rows.length}>{rows.length ? rows.map((r) => <tr key={r.id}><td className="sku-text">{r.project_id}</td><td>{r.project_name || "—"}</td><td>{r.client || "—"}</td><td>{r.site_location || "—"}</td><td>{r.project_manager || "—"}</td><td>{dateFmt(r.start_date)}</td><td>{dateFmt(r.end_date)}</td><td><span className={pillClass(r.status)}>{r.status || "—"}</span></td><td>{r.site_store_location || "—"}</td><td className="align-right">{data.requests.filter((x) => x.project_id === r.project_id && !/closed|complete|cancel/i.test(x.approval_status + " " + x.issue_status)).length}</td><td>{r.notes || "—"}</td></tr>) : <EmptyRow cols={cols.length} />}</TableWrap>;
}
function ChecksTable({ rows }: { rows: CheckSchedule[] }) {
  const cols = ["Check ID","Period","Frequency","Scope","Location","Planned","Actual","Lead","Independent","Status","Lines Planned","Verified","Exceptions","Open Actions","Next Due","Outcome"];
  return <TableWrap cols={cols} count={rows.length}>{rows.length ? rows.map((r) => <tr key={r.id}><td className="sku-text">{r.check_id}</td><td>{r.check_period || "—"}</td><td>{r.frequency || "—"}</td><td>{r.check_scope || "—"}</td><td>{r.location || "—"}</td><td>{dateFmt(r.planned_date)}</td><td>{dateFmt(r.actual_date)}</td><td>{r.lead_verifier || "—"}</td><td>{r.independent_checker || "—"}</td><td><span className={pillClass(r.check_status)}>{r.check_status || "—"}</span></td><td className="align-right">{num(r.lines_planned)}</td><td className="align-right">{num(r.lines_verified)}</td><td className="align-right">{num(r.exceptions)}</td><td className="align-right">{num(r.open_actions)}</td><td>{dateFmt(r.next_check_due)}</td><td><span className={pillClass(r.verification_outcome)}>{r.verification_outcome || "—"}</span></td></tr>) : <EmptyRow cols={cols.length} />}</TableWrap>;
}
function VerifyTable({ rows }: { rows: VerificationLine[] }) {
  const cols = ["Line","Check ID","Date","Location","Type","Item/Asset","Description","Cut-off Qty","Physical Qty","Variance","Result","Cause","Corrective Action","Responsible","Target","Action Status","Verified By"];
  return <TableWrap cols={cols} count={rows.length}>{rows.length ? rows.map((r) => <tr key={r.id}><td className="sku-text">{r.check_line_id}</td><td>{r.check_id}</td><td>{dateFmt(r.check_date)}</td><td>{r.location || "—"}</td><td>{r.inventory_type || "—"}</td><td className="sku-text">{r.item_asset_id || "—"}</td><td>{r.description || "—"}</td><td className="align-right">{r.system_qty_cutoff ?? "—"}</td><td className="align-right">{r.physical_qty ?? "—"}</td><td className="align-right">{r.count_variance ?? "—"}</td><td><span className={pillClass(r.verification_result)}>{r.verification_result || "—"}</span></td><td>{r.variance_cause || "—"}</td><td>{r.corrective_action || "—"}</td><td>{r.responsible || "—"}</td><td>{dateFmt(r.target_date)}</td><td><span className={pillClass(r.action_status)}>{r.action_status || "—"}</span></td><td>{r.verified_by || "—"}</td></tr>) : <EmptyRow cols={cols.length} />}</TableWrap>;
}

function parseSheet(kind: SheetKey, headers: string[], body: unknown[][]): { table: string | null; rows: Record<string, unknown>[] } {
  const h = headers;
  const col = (...a: string[]) => findHeader(h, a);
  const used = new Set<number>();
  const g = (r: unknown[], ...a: string[]) => { const i = col(...a); if (i >= 0) used.add(i); return i >= 0 ? r[i] : undefined; };
  const baseExtras = (r: unknown[]) => { const o: Record<string, Json> = {}; h.forEach((head, i) => { if (!used.has(i) && txt(r[i])) o[head] = toJson(r[i]); }); return o; };
  const nonEmpty = body.filter((r) => r.some((c) => txt(c)));

  if (kind === "materials") {
    return { table: "materials", rows: nonEmpty.map((r, i) => {
      used.clear();
      const sku = txt(g(r, "SKU")) || `SKU-${i + 1}`;
      const desc = txt(g(r, "Item Description", "Description", "Item"));
      const unitCost = num(g(r, "Unit Cost (USD)", "Unit Cost"));
      const onHand = num(g(r, "On Hand"));
      return {
        stock_record_id: txt(g(r, "Stock Record ID")), sku, item_description: desc, category: txt(g(r, "Category")),
        uom: txt(g(r, "UOM")) || "pcs", location: txt(g(r, "Location")) || "Central Warehouse", bin_location: txt(g(r, "Bin Location")),
        minimum_stock: num(g(r, "Minimum Stock")), opening_balance: num(g(r, "Opening Balance")), total_in: num(g(r, "Total In")),
        total_out: num(g(r, "Total Out")), on_hand: onHand, approved_pending: num(g(r, "Approved Pending")),
        available: num(g(r, "Available")), stock_status: txt(g(r, "Stock Status")), last_movement: isoDate(g(r, "Last Movement")),
        preferred_supplier: txt(g(r, "Preferred Supplier", "Supplier")), unit_cost_usd: unitCost,
        stock_value_usd: num(g(r, "Stock Value (USD)", "Stock Value")) || onHand * unitCost, remarks: txt(g(r, "Remarks", "Notes")), extra_data: baseExtras(r),
      };
    }) };
  }
  if (kind === "assets") {
    return { table: "assets", rows: nonEmpty.map((r, i) => {
      used.clear();
      return {
        asset_id: txt(g(r, "Asset ID")) || `AST-${i + 1}`, category: txt(g(r, "Category")), asset_name: txt(g(r, "Asset / Tool Name", "Asset Name", "Asset / Tool")),
        make_model: txt(g(r, "Make / Model")), serial_no: txt(g(r, "Serial No.", "Serial No")), uom: txt(g(r, "UOM")) || "unit",
        ownership: txt(g(r, "Ownership")) || "Owned", purchase_date: isoDate(g(r, "Purchase Date")), original_cost_usd: num(g(r, "Original Cost (USD)", "Original Cost")),
        home_location: txt(g(r, "Home Location")) || "Central Warehouse", current_location: txt(g(r, "Current Location")),
        project_id: txt(g(r, "Project ID")), assigned_to: txt(g(r, "Assigned To")), condition: txt(g(r, "Condition")) || "Good",
        status: txt(g(r, "Status")) || "Available", deployment_start: isoDate(g(r, "Deployment Start")), due_date: isoDate(g(r, "Due Date")),
        last_return: isoDate(g(r, "Last Return")), days_out: num(g(r, "Days Out")), last_movement: isoDate(g(r, "Last Movement")),
        inspection_due: isoDate(g(r, "Inspection Due")), calibration_due: isoDate(g(r, "Calibration Due")),
        availability_flag: txt(g(r, "Availability Flag")) || "AVAILABLE", remarks: txt(g(r, "Remarks", "Notes")), extra_data: baseExtras(r),
      };
    }) };
  }
  if (kind === "requests") {
    return { table: "requests", rows: nonEmpty.map((r, i) => {
      used.clear();
      return {
        request_id: txt(g(r, "Request ID")) || `REQ-${i + 1}`, request_date: isoDate(g(r, "Request Date")), inventory_type: txt(g(r, "Inventory Type")) || "Material",
        project_id: txt(g(r, "Project ID")), project_site: txt(g(r, "Project / Site")), requester: txt(g(r, "Requester")), department: txt(g(r, "Department")),
        required_date: isoDate(g(r, "Required Date")), priority: txt(g(r, "Priority")) || "Normal", item_asset_id: txt(g(r, "Item / Asset ID")),
        description: txt(g(r, "Description")), uom: txt(g(r, "UOM")), qty_requested: num(g(r, "Qty Requested")), purpose: txt(g(r, "Purpose / Work Package", "Purpose")),
        approver: txt(g(r, "Approver")), approval_status: txt(g(r, "Approval Status")) || "Pending", approved_qty: num(g(r, "Approved Qty")),
        approval_date: isoDate(g(r, "Approval Date")), source_location: txt(g(r, "Source Location")) || "Central Warehouse",
        issue_status: txt(g(r, "Issue Status")), qty_issued: num(g(r, "Qty Issued / Assigned", "Qty Issued")),
        balance_to_issue: num(g(r, "Balance to Issue")), due_return_date: isoDate(g(r, "Due / Return Date")), remarks: txt(g(r, "Remarks", "Notes")), extra_data: baseExtras(r),
      };
    }) };
  }
  if (kind === "materialMovements") {
    return { table: "material_movements", rows: nonEmpty.map((r) => {
      used.clear();
      const qty = num(g(r, "Quantity")); const unit = num(g(r, "Unit Cost (USD)", "Unit Cost"));
      return {
        movement_id: txt(g(r, "Movement ID")), transaction_date: isoDate(g(r, "Transaction Date")), request_id: txt(g(r, "Request ID")),
        movement_type: txt(g(r, "Movement Type")) || "Receipt", sku: txt(g(r, "SKU")), item_description: txt(g(r, "Item Description", "Description")),
        uom: txt(g(r, "UOM")), quantity: qty, from_location: txt(g(r, "From Location")), to_location: txt(g(r, "To Location")),
        project_id: txt(g(r, "Project ID")), project_site: txt(g(r, "Project / Site")), handed_over_by: txt(g(r, "Handed Over By")),
        received_by: txt(g(r, "Received By")), approval_doc_ref: txt(g(r, "Approval / Document Ref", "Approval / Doc Ref")),
        unit_cost_usd: unit, movement_value_usd: num(g(r, "Movement Value (USD)", "Movement Value")) || qty * unit,
        entry_check: txt(g(r, "Entry Check")), remarks: txt(g(r, "Remarks", "Notes")), extra_data: baseExtras(r),
      };
    }).filter((r) => r.sku || r.movement_id || r.item_description) };
  }
  if (kind === "assetMovements") {
    return { table: "asset_movements", rows: nonEmpty.map((r) => {
      used.clear();
      return {
        movement_id: txt(g(r, "Movement ID")), movement_date: isoDate(g(r, "Movement Date")), request_id: txt(g(r, "Request ID")),
        action: txt(g(r, "Action")), asset_id: txt(g(r, "Asset ID")), asset_name: txt(g(r, "Asset / Tool Name", "Asset Name")),
        from_location: txt(g(r, "From Location")), to_location: txt(g(r, "To Location")), project_id: txt(g(r, "Project ID")),
        project_site: txt(g(r, "Project / Site")), assigned_to: txt(g(r, "Assigned To")), condition_out: txt(g(r, "Condition Out")),
        condition_in: txt(g(r, "Condition In")), resulting_condition: txt(g(r, "Resulting Condition")), due_date: isoDate(g(r, "Due Date")),
        return_date: isoDate(g(r, "Return Date")), approved_by: txt(g(r, "Approved By")), handover_ref: txt(g(r, "Handover Ref")),
        entry_check: txt(g(r, "Entry Check")), remarks: txt(g(r, "Remarks", "Notes")), extra_data: baseExtras(r),
      };
    }).filter((r) => r.asset_id || r.movement_id) };
  }
  if (kind === "projectSites") {
    return { table: "project_sites", rows: nonEmpty.map((r, i) => {
      used.clear();
      return {
        project_id: txt(g(r, "Project ID")) || `PRJ-${i + 1}`, project_name: txt(g(r, "Project Name")), client: txt(g(r, "Client")),
        site_location: txt(g(r, "Site Location")), project_manager: txt(g(r, "Project Manager")), start_date: isoDate(g(r, "Start Date")),
        end_date: isoDate(g(r, "End Date")), status: txt(g(r, "Status")) || "Active", site_store_location: txt(g(r, "Site Store / Location", "Site Store")),
        notes: txt(g(r, "Notes", "Remarks")), extra_data: baseExtras(r),
      };
    }) };
  }
  if (kind === "checkSchedule") {
    return { table: "check_schedule", rows: nonEmpty.map((r, i) => {
      used.clear();
      return {
        check_id: txt(g(r, "Check ID")) || `CHK-${i + 1}`, check_period: txt(g(r, "Check Period")), frequency: txt(g(r, "Frequency")) || "Monthly",
        check_scope: txt(g(r, "Check Scope")) || "Full Count", location: txt(g(r, "Location")), planned_date: isoDate(g(r, "Planned Date")),
        actual_date: isoDate(g(r, "Actual Date")), lead_verifier: txt(g(r, "Lead Verifier")), independent_checker: txt(g(r, "Independent Checker")),
        check_status: txt(g(r, "Check Status")) || "Planned", lines_planned: num(g(r, "Lines Planned")), lines_verified: num(g(r, "Lines Verified")),
        exceptions: num(g(r, "Count / Condition Exceptions", "Exceptions")), post_freeze_movement_lines: num(g(r, "Post-freeze Movement Lines")),
        completion_pct: num(g(r, "Completion %")), open_actions: num(g(r, "Open Actions")), approved_by: txt(g(r, "Approved By")),
        approval_date: isoDate(g(r, "Approval Date")), next_check_due: isoDate(g(r, "Next Check Due")),
        verification_outcome: txt(g(r, "Verification Outcome")), notes: txt(g(r, "Notes", "Remarks")), extra_data: baseExtras(r),
      };
    }) };
  }
  if (kind === "verification") {
    return { table: "verification_matrix", rows: nonEmpty.map((r, i) => {
      used.clear();
      const cutoff = g(r, "System Qty at Cut-off"); const phys = g(r, "Physical Qty");
      return {
        check_line_id: txt(g(r, "Check Line ID")) || `VFY-${i + 1}`, check_id: txt(g(r, "Check ID")), check_date: isoDate(g(r, "Check Date")),
        frequency: txt(g(r, "Frequency")), location: txt(g(r, "Location")), inventory_type: txt(g(r, "Inventory Type")),
        item_asset_id: txt(g(r, "Item / Asset ID")), description: txt(g(r, "Description")), uom: txt(g(r, "UOM")),
        live_system_qty: cutoff == null && g(r, "Live System Qty") == null ? null : num(g(r, "Live System Qty")),
        system_qty_cutoff: cutoff == null ? null : num(cutoff), live_vs_cutoff: g(r, "Live vs Cut-off Change") == null ? null : num(g(r, "Live vs Cut-off Change")),
        physical_qty: phys == null ? null : num(phys), count_variance: g(r, "Count Variance") == null ? null : num(g(r, "Count Variance")),
        variance_pct: g(r, "Variance %") == null ? null : num(g(r, "Variance %")),
        live_system_condition: txt(g(r, "Live System Condition")), recorded_condition_cutoff: txt(g(r, "Recorded Condition at Cut-off")),
        physical_condition: txt(g(r, "Physical Condition")), verification_result: txt(g(r, "Verification Result")) || "NOT COUNTED",
        variance_cause: txt(g(r, "Variance Cause / Observation", "Variance Cause")), corrective_action: txt(g(r, "Corrective Action")),
        responsible: txt(g(r, "Responsible")), target_date: isoDate(g(r, "Target Date")), action_status: txt(g(r, "Action Status")) || "Not Required",
        verified_by: txt(g(r, "Verified By")), independent_checker: txt(g(r, "Independent Checker")),
        adjustment_approval_ref: txt(g(r, "Adjustment / Approval Ref")), evidence_notes: txt(g(r, "Evidence / Notes", "Evidence")), extra_data: baseExtras(r),
      };
    }) };
  }
  return { table: null, rows: [] };
}
