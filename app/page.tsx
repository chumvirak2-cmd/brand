"use client";

import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Bell,
  Boxes,
  Check,
  ChevronDown,
  CircleHelp,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Truck,
  X,
} from "lucide-react";
import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";

type Product = {
  id: string;
  name: string;
  sku: string;
  category: string;
  quantity: number;
  unit_price: number;
  supplier: string;
};

type ProductDraft = Omit<Product, "id">;
type DashboardView = "inventory" | "suppliers" | "settings" | "plans";

type SupplierSummary = {
  name: string;
  productCount: number;
  units: number;
  inventoryValue: number;
};

const EMPTY_DRAFT: ProductDraft = {
  name: "",
  sku: "",
  category: "",
  quantity: 0,
  unit_price: 0,
  supplier: "",
};

const MIN_STOCK_QUANTITY = 5;

function getSavedStockThreshold(userId: string): number {
  const savedThreshold = window.localStorage.getItem(`b2g-stock-threshold:${userId}`);
  const parsedThreshold = Number(savedThreshold);
  return savedThreshold && Number.isInteger(parsedThreshold) && parsedThreshold >= 0
    ? parsedThreshold
    : MIN_STOCK_QUANTITY;
}

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

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
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All categories");
  const [sortAscending, setSortAscending] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [draft, setDraft] = useState<ProductDraft>(EMPTY_DRAFT);
  const [savingProduct, setSavingProduct] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [activeView, setActiveView] = useState<DashboardView>("inventory");
  const [minimumStockQuantity, setMinimumStockQuantity] = useState(MIN_STOCK_QUANTITY);
  const [planNotice, setPlanNotice] = useState("");

  const loadProducts = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("products")
      .select("id, name, sku, category, quantity, unit_price, supplier")
      .order("name");

    setProductsLoading(false);
    if (error) {
      setPageError(error.message);
      setProducts([]);
    } else {
      setProducts(data ?? []);
    }
  }, [supabase]);

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data, error }) => {
      if (error) setAuthError(error.message);
      setSession(data.session);
      if (data.session) {
        setMinimumStockQuantity(getSavedStockThreshold(data.session.user.id));
      }
      if (data.session) void loadProducts();
      setAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession) {
        setMinimumStockQuantity(getSavedStockThreshold(nextSession.user.id));
      }
      setAuthError("");
      setAuthMessage("");
      if (!nextSession) setProducts([]);
    });

    return () => subscription.unsubscribe();
  }, [supabase, loadProducts]);

  async function handleAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthError("");
    setAuthMessage("");
    if (!supabase) {
      setAuthError("Add your Supabase URL and publishable key to .env.local to enable login.");
      return;
    }
    setAuthSubmitting(true);
    const result =
      authMode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    if (result.error) {
      setAuthError(result.error.message);
    } else if (authMode === "signup" && !result.data.session) {
      setAuthMessage("Check your inbox to confirm your email, then sign in.");
    }
    if (result.data.session) {
      setProductsLoading(true);
      void loadProducts();
    }
    setAuthSubmitting(false);
  }

  async function handleSignOut() {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) setPageError(error.message);
    else setProducts([]);
  }

  function openNewProduct() {
    setEditingProduct(null);
    setDraft(EMPTY_DRAFT);
    setPageError("");
    setModalOpen(true);
  }

  function openEditProduct(product: Product) {
    setEditingProduct(product);
    setDraft({
      name: product.name,
      sku: product.sku,
      category: product.category,
      quantity: product.quantity,
      unit_price: product.unit_price,
      supplier: product.supplier,
    });
    setPageError("");
    setModalOpen(true);
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setSavingProduct(true);
    setPageError("");
    const result = editingProduct
      ? await supabase
          .from("products")
          .update(draft)
          .eq("id", editingProduct.id)
          .select("id, name, sku, category, quantity, unit_price, supplier")
          .single()
      : await supabase
          .from("products")
          .insert(draft)
          .select("id, name, sku, category, quantity, unit_price, supplier")
          .single();

    if (result.error) {
      setPageError(result.error.message);
      setSavingProduct(false);
      return;
    }
    setProducts((current) =>
      editingProduct
        ? current.map((product) =>
          product.id === editingProduct.id ? result.data : product,
          )
        : [...current, result.data].sort((a, b) =>
            a.name.localeCompare(b.name),
          ),
    );
    setModalOpen(false);
    setSavingProduct(false);
  }

  async function deleteProduct(product: Product) {
    if (!supabase || !window.confirm(`Delete "${product.name}" from inventory?`)) {
      return;
    }
    setPageError("");
    const { error } = await supabase.from("products").delete().eq("id", product.id);
    if (error) {
      setPageError(error.message);
      return;
    }
    setProducts((current) => current.filter((item) => item.id !== product.id));
    setModalOpen(false);
  }

  const categories = useMemo(
    () => ["All categories", ...Array.from(new Set(products.map((p) => p.category))).sort()],
    [products],
  );
  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return products
      .filter((product) => {
        const matchesSearch =
          !query ||
          [product.name, product.sku, product.category, product.supplier]
            .join(" ")
            .toLowerCase()
            .includes(query);
        const matchesCategory =
          categoryFilter === "All categories" || product.category === categoryFilter;
        return matchesSearch && matchesCategory;
      })
      .sort((a, b) =>
        sortAscending
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name),
      );
  }, [categoryFilter, products, search, sortAscending]);

  const totalUnits = products.reduce((sum, product) => sum + product.quantity, 0);
  const inventoryValue = products.reduce(
    (sum, product) => sum + product.quantity * Number(product.unit_price),
    0,
  );
  const stockAlerts = products.filter(
    (product) => product.quantity === 0 || product.quantity < minimumStockQuantity,
  );
  const lowStock = stockAlerts.filter((product) => product.quantity > 0).length;
  const outOfStock = products.filter((product) => product.quantity === 0).length;
  const suppliers = useMemo(() => {
    const summaries = new Map<string, SupplierSummary>();
    products.forEach((product) => {
      const name = product.supplier.trim();
      if (!name) return;
      const current = summaries.get(name) ?? {
        name,
        productCount: 0,
        units: 0,
        inventoryValue: 0,
      };
      current.productCount += 1;
      current.units += product.quantity;
      current.inventoryValue += product.quantity * Number(product.unit_price);
      summaries.set(name, current);
    });
    return Array.from(summaries.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [products]);

  function navigateTo(view: DashboardView) {
    setActiveView(view);
    setMobileNavOpen(false);
    setPlanNotice("");
  }

  if (authLoading) {
    return (
      <main className="loading-screen">
        <div className="brand-mark"><Boxes size={23} /></div>
        <span>Loading your workspace</span>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="auth-page">
        <div className="auth-side">
          <div className="auth-brand"><Brand /></div>
          <div className="auth-copy">
            <div className="eyebrow"><Sparkles size={14} /> INVENTORY, IN FOCUS</div>
            <h1>Know what you have.<br /><span>Stay ready for what’s next.</span></h1>
            <p>A calmer way to keep your stock accurate, your team aligned, and your business moving.</p>
            <div className="auth-feature">
              <span className="feature-icon"><ShieldCheck size={18} /></span>
              <span><strong>Your inventory stays yours</strong><small>Private workspace, protected by Supabase.</small></span>
            </div>
          </div>
          <div className="auth-footer">B2G INVENTORY <span>·</span> BUILT FOR THE EVERYDAY</div>
        </div>
        <section className="auth-panel">
          <div className="mobile-brand"><Brand /></div>
          <div className="auth-card">
            <div className="auth-heading">
              <div className="auth-glyph"><Package size={22} /></div>
              <div className="eyebrow muted-eyebrow">WELCOME TO B2G INVENTORY</div>
              <h2>{authMode === "signin" ? "Sign in to your account" : "Create your account"}</h2>
              <p>{authMode === "signin" ? "Enter your details to pick up where you left off." : "Get your inventory workspace set up in a minute."}</p>
            </div>
            <form className="auth-form" onSubmit={handleAuth}>
              <label htmlFor="email">Email address</label>
              <input id="email" type="email" autoComplete="email" placeholder="you@company.com" value={email} onChange={(event) => setEmail(event.target.value)} required />
              <div className="label-row"><label htmlFor="password">Password</label>{authMode === "signin" && <span className="password-hint">At least 6 characters</span>}</div>
              <input id="password" type="password" autoComplete={authMode === "signin" ? "current-password" : "new-password"} placeholder="Enter your password" minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} required />
              {authError && <div className="form-alert error-alert"><AlertCircle size={16} />{authError}</div>}
              {authMessage && <div className="form-alert success-alert"><Check size={16} />{authMessage}</div>}
              {!configured && <div className="setup-note">Supabase isn’t connected yet. Add the two environment variables from <code>.env.example</code> to <code>.env.local</code>.</div>}
              <button className="button button-primary auth-submit" type="submit" disabled={authSubmitting}>
                {authSubmitting ? "Please wait…" : authMode === "signin" ? "Sign in" : "Create account"}
                {!authSubmitting && <ArrowUp size={16} className="button-arrow" />}
              </button>
            </form>
            <div className="auth-switch">
              {authMode === "signin" ? "New to B2G INVENTORY?" : "Already have an account?"}
              <button type="button" onClick={() => { setAuthMode(authMode === "signin" ? "signup" : "signin"); setAuthError(""); setAuthMessage(""); }}>
                {authMode === "signin" ? "Create an account" : "Sign in"}
              </button>
            </div>
            <div className="privacy-note"><ShieldCheck size={14} /> Secure sign-in powered by Supabase</div>
          </div>
          <div className="auth-panel-footer">© 2026 B2G INVENTORY</div>
        </section>
      </main>
    );
  }

  const firstName = session.user.email?.split("@")[0] ?? "there";

  return (
    <main className="app-shell">
      {mobileNavOpen && <button className="nav-scrim" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} />}
      <aside className={`sidebar ${mobileNavOpen ? "sidebar-open" : ""}`}>
        <Brand />
        <div className="workspace-switcher">
          <div className="workspace-avatar">S</div>
          <div className="workspace-info"><strong>My workspace</strong><span>Free plan</span></div>
          <ChevronDown size={16} />
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav className="main-nav" aria-label="Main navigation">
          <button className="nav-item" type="button" onClick={() => navigateTo("inventory")}><LayoutDashboard size={18} /> Overview</button>
          <button className={`nav-item ${activeView === "inventory" ? "active" : ""}`} type="button" onClick={() => navigateTo("inventory")}><Package size={18} /> Inventory <span className="nav-count">{products.length}</span></button>
          <button className={`nav-item ${activeView === "suppliers" ? "active" : ""}`} type="button" onClick={() => navigateTo("suppliers")}><Truck size={18} /> Suppliers</button>
        </nav>
        <div className="sidebar-bottom">
          <div className="upgrade-card">
            <div className="upgrade-icon"><Sparkles size={15} /></div>
            <strong>Make more room to grow</strong>
            <p>Keep everything organized as your business scales.</p>
            <button type="button" onClick={() => navigateTo("plans")}>Explore plans <ArrowUp size={14} /></button>
          </div>
          <button className={`nav-item ${activeView === "settings" ? "active" : ""}`} type="button" onClick={() => navigateTo("settings")}><Settings size={18} /> Settings</button>
          <span className="nav-item"><CircleHelp size={18} /> Help & support</span>
          <div className="profile-row">
            <div className="profile-avatar">{firstName.charAt(0).toUpperCase()}</div>
            <div className="profile-info"><strong>{firstName}</strong><span>{session.user.email}</span></div>
            <button className="icon-button signout-button" type="button" onClick={handleSignOut} aria-label="Sign out"><LogOut size={17} /></button>
          </div>
        </div>
      </aside>

      <section className="main-content" id="overview">
        <header className="topbar">
          <button className="mobile-menu icon-button" aria-label="Open navigation" onClick={() => setMobileNavOpen(true)}><Menu size={20} /></button>
          <div className="breadcrumbs"><span>Workspace</span><span className="breadcrumb-slash">/</span><strong>{activeView[0].toUpperCase() + activeView.slice(1)}</strong></div>
          <div className="topbar-right">
            <span className="today-label">{new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(new Date())}</span>
            <div className="notification-wrap">
              <button
                className={`icon-button notification-button ${notificationsOpen ? "notification-active" : ""}`}
                type="button"
                aria-label={`Stock alerts: ${stockAlerts.length}`}
                aria-expanded={notificationsOpen}
                onClick={() => setNotificationsOpen((open) => !open)}
              >
                <Bell size={17} />
                {stockAlerts.length > 0 && <span className="notification-count">{stockAlerts.length > 99 ? "99+" : stockAlerts.length}</span>}
              </button>
              {notificationsOpen && (
                <section className="notification-panel" aria-label="Stock notifications">
                  <div className="notification-heading">
                    <div><strong>Stock alerts</strong><span>Minimum stock: {minimumStockQuantity} units</span></div>
                    <button className="icon-button" type="button" onClick={() => setNotificationsOpen(false)} aria-label="Close stock alerts"><X size={16} /></button>
                  </div>
                  {stockAlerts.length === 0 ? (
                    <div className="notification-empty"><ShieldCheck size={19} /><span>All clear</span><small>No products are below the minimum.</small></div>
                  ) : (
                    <div className="notification-list">
                      {stockAlerts.map((product) => (
                        <button
                          className="notification-item"
                          type="button"
                          key={product.id}
                          onClick={() => { setNotificationsOpen(false); openEditProduct(product); }}
                        >
                          <span className={`notification-product-icon ${product.quantity === 0 ? "notification-out" : ""}`}><AlertCircle size={16} /></span>
                          <span className="notification-product-copy"><strong>{product.name}</strong><small>{product.sku}</small></span>
                          <span className="notification-quantity">{product.quantity === 0 ? "Out" : `${product.quantity} left`}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </section>
              )}
            </div>
            <div className="topbar-avatar">{firstName.charAt(0).toUpperCase()}</div>
          </div>
        </header>

        <div className="page-content" id={activeView}>
          {activeView === "inventory" && <>
          <div className="page-heading">
            <div>
              <div className="eyebrow muted-eyebrow">YOUR STOCK, AT A GLANCE</div>
              <h1>Inventory</h1>
              <p>Keep track of what’s in stock and what needs your attention.</p>
            </div>
            <button className="button button-primary add-button" onClick={openNewProduct}><Plus size={17} /> Add product</button>
          </div>

          {pageError && <div className="page-alert"><AlertCircle size={17} />{pageError}<button onClick={() => setPageError("")} aria-label="Dismiss error"><X size={15} /></button></div>}

          <div className="stats-grid">
            <article className="stat-card">
              <div className="stat-top"><span className="stat-icon inventory-icon"><Package size={17} /></span><span className="stat-trend neutral"><Boxes size={13} /> Items</span></div>
              <div className="stat-value">{products.length}</div><div className="stat-label">Total products</div>
              <div className="stat-foot"><span className="stat-dot blue-dot" /> Across your catalog</div>
            </article>
            <article className="stat-card">
              <div className="stat-top"><span className="stat-icon units-icon"><Boxes size={17} /></span><span className="stat-trend neutral">Units</span></div>
              <div className="stat-value">{totalUnits.toLocaleString()}</div><div className="stat-label">Units in stock</div>
              <div className="stat-foot"><span className="stat-dot green-dot" /> Ready to move</div>
            </article>
            <article className="stat-card">
              <div className="stat-top"><span className="stat-icon value-icon"><span className="currency-symbol">$</span></span><span className="stat-trend neutral">At cost</span></div>
              <div className="stat-value">{money.format(inventoryValue)}</div><div className="stat-label">Inventory value</div>
              <div className="stat-foot"><span className="stat-dot purple-dot" /> Current stock value</div>
            </article>
            <article className="stat-card">
              <div className="stat-top"><span className="stat-icon alert-icon"><AlertCircle size={17} /></span><span className={`stat-trend ${stockAlerts.length > 0 ? "warning" : "good"}`}>{stockAlerts.length > 0 ? "Needs attention" : "All clear"}</span></div>
              <div className="stat-value">{stockAlerts.length}</div><div className="stat-label">Low stock alerts</div>
              <div className="stat-foot"><span className={`stat-dot ${stockAlerts.length > 0 ? "orange-dot" : "green-dot"}`} /> {outOfStock} out of stock · {lowStock} below {minimumStockQuantity} units</div>
            </article>
          </div>

          <section className="inventory-card">
            <div className="inventory-card-heading">
              <div><h2>All products <span className="table-count">{products.length}</span></h2><p>A complete list of everything you’re keeping on hand.</p></div>
              <button className="icon-button filter-button" aria-label="Filter products" onClick={() => setCategoryFilter(categoryFilter === "All categories" ? categories[1] ?? "All categories" : "All categories")}><SlidersHorizontal size={17} /></button>
            </div>
            <div className="table-toolbar">
              <label className="search-field"><Search size={16} /><input type="search" placeholder="Search products..." value={search} onChange={(event) => setSearch(event.target.value)} /></label>
              <label className="category-select"><select aria-label="Filter by category" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>{categories.map((category) => <option key={category}>{category}</option>)}</select><ChevronDown size={15} /></label>
              <button className="toolbar-button" onClick={() => { setPageError(""); setProductsLoading(true); void loadProducts(); }} title="Refresh inventory"><ArrowUpDown size={15} /><span>Refresh</span></button>
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr>
                  <th><button className="sort-button" onClick={() => setSortAscending((current) => !current)}>PRODUCT <ArrowDown size={13} className={sortAscending ? "sort-active" : ""} /></button></th>
                  <th>SKU</th><th>CATEGORY</th><th>SUPPLIER</th><th className="align-right">UNIT PRICE</th><th className="align-right">IN STOCK</th><th>STATUS</th><th aria-label="Actions" />
                </tr></thead>
                <tbody>
                  {productsLoading ? (
                    <tr><td colSpan={8}><div className="table-message"><span className="loading-dot" />Loading your inventory…</div></td></tr>
                  ) : filteredProducts.length === 0 ? (
                    <tr><td colSpan={8}><div className="empty-state"><div className="empty-icon"><Package size={21} /></div><strong>{products.length === 0 ? "Your inventory starts here" : "No products found"}</strong><span>{products.length === 0 ? "Add your first product and keep everything in one place." : "Try another search or category."}</span>{products.length === 0 && <button className="button button-primary" onClick={openNewProduct}><Plus size={16} /> Add your first product</button>}</div></td></tr>
                  ) : filteredProducts.map((product, index) => (
                    <tr key={product.id} className="product-row" onClick={() => openEditProduct(product)}>
                      <td><div className="product-cell"><div className={`product-avatar product-color-${index % 5}`}>{product.name.charAt(0).toUpperCase()}</div><strong>{product.name}</strong></div></td>
                      <td><span className="sku-text">{product.sku}</span></td><td><span className="category-pill">{product.category}</span></td><td className="supplier-text">{product.supplier || "—"}</td>
                      <td className="align-right price-cell">{money.format(Number(product.unit_price))}</td><td className="align-right quantity-cell">{product.quantity} <span>units</span></td>
                      <td><StockStatus quantity={product.quantity} minimum={minimumStockQuantity} /></td>
                      <td><button className="row-edit" onClick={(event) => { event.stopPropagation(); openEditProduct(product); }} aria-label={`Edit ${product.name}`}><ChevronDown size={15} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="table-footer"><span>Showing <strong>{filteredProducts.length ? 1 : 0}–{filteredProducts.length}</strong> of <strong>{products.length}</strong> products</span><span>Minimum stock: <strong>{minimumStockQuantity} units</strong></span></div>
          </section>
          <footer className="page-footer"><span>B2G INVENTORY <span className="footer-dot">·</span> A little more in control.</span><span><ShieldCheck size={13} /> Your inventory is private to your account</span></footer>
          </>}

          {activeView === "suppliers" && <>
            <div className="page-heading">
              <div>
                <div className="eyebrow muted-eyebrow">YOUR SUPPLY NETWORK</div>
                <h1>Suppliers</h1>
                <p>See suppliers recorded on your products and the stock linked to each one.</p>
              </div>
              <button className="button button-primary add-button" type="button" onClick={openNewProduct}><Plus size={17} /> Add product</button>
            </div>
            {pageError && <div className="page-alert"><AlertCircle size={17} />{pageError}<button onClick={() => setPageError("")} aria-label="Dismiss error"><X size={15} /></button></div>}
            {productsLoading ? (
              <div className="section-card section-loading"><span className="loading-dot" />Loading suppliers…</div>
            ) : suppliers.length === 0 ? (
              <section className="section-card section-empty">
                <div className="empty-icon"><Truck size={21} /></div>
                <h2>No suppliers yet</h2>
                <p>Add supplier names when creating or editing products. They’ll appear here automatically.</p>
                <button className="button button-primary" type="button" onClick={openNewProduct}><Plus size={16} /> Add a product</button>
              </section>
            ) : (
              <section className="section-card">
                <div className="section-card-heading"><div><h2>All suppliers <span className="table-count">{suppliers.length}</span></h2><p>Supplier summaries are based on your product records.</p></div></div>
                <div className="supplier-list">
                  {suppliers.map((supplier) => (
                    <article className="supplier-row" key={supplier.name}>
                      <div className="supplier-avatar"><Truck size={18} /></div>
                      <div className="supplier-name"><strong>{supplier.name}</strong><span>{supplier.productCount} {supplier.productCount === 1 ? "product" : "products"}</span></div>
                      <div className="supplier-metric"><span>Units</span><strong>{supplier.units.toLocaleString()}</strong></div>
                      <div className="supplier-metric"><span>Stock value</span><strong>{money.format(supplier.inventoryValue)}</strong></div>
                      <button className="toolbar-button supplier-view-button" type="button" onClick={() => { setSearch(supplier.name); setCategoryFilter("All categories"); navigateTo("inventory"); }}>View products</button>
                    </article>
                  ))}
                </div>
              </section>
            )}
            <footer className="page-footer"><span>B2G INVENTORY <span className="footer-dot">·</span> A little more in control.</span><span>Supplier details come from your product catalog</span></footer>
          </>}

          {activeView === "settings" && <>
            <div className="page-heading">
              <div>
                <div className="eyebrow muted-eyebrow">YOUR WORKSPACE</div>
                <h1>Settings</h1>
                <p>Manage your account details and inventory preferences.</p>
              </div>
            </div>
            <div className="settings-grid">
              <section className="section-card settings-card">
                <div className="section-card-heading"><div><h2>Account</h2><p>Your signed-in account details.</p></div><span className="settings-icon"><ShieldCheck size={17} /></span></div>
                <div className="settings-detail"><span>Email address</span><strong>{session.user.email}</strong></div>
                <div className="settings-detail"><span>Workspace plan</span><strong>Free</strong></div>
              </section>
              <section className="section-card settings-card">
                <div className="section-card-heading"><div><h2>Inventory alerts</h2><p>Choose when a product is considered low stock.</p></div><span className="settings-icon"><AlertCircle size={17} /></span></div>
                <label className="field threshold-field">Low stock threshold (units)
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={minimumStockQuantity}
                    onChange={(event) => {
                      const nextThreshold = Number(event.target.value);
                      if (!Number.isInteger(nextThreshold) || nextThreshold < 0) return;
                      setMinimumStockQuantity(nextThreshold);
                      window.localStorage.setItem(`b2g-stock-threshold:${session.user.id}`, String(nextThreshold));
                    }}
                  />
                </label>
                <p className="settings-help">Products below this quantity appear in your stock alerts. This preference is saved in this browser.</p>
              </section>
            </div>
            <footer className="page-footer"><span>B2G INVENTORY <span className="footer-dot">·</span> A little more in control.</span><button className="settings-signout" type="button" onClick={() => void handleSignOut()}><LogOut size={14} /> Sign out</button></footer>
          </>}

          {activeView === "plans" && <>
            <div className="page-heading">
              <div>
                <div className="eyebrow muted-eyebrow">SIMPLE PLAN OPTIONS</div>
                <h1>Plans</h1>
                <p>Pick the level that fits your inventory workflow.</p>
              </div>
            </div>
            {planNotice && <div className="plan-notice" role="status">{planNotice}</div>}
            <div className="plan-grid">
              <article className="plan-card">
                <span className="plan-label">START HERE</span><h2>Free</h2><p className="plan-price">$0 <span>/ forever</span></p>
                <p className="plan-description">Manage your inventory and keep stock details in one place.</p>
                <button className="button button-quiet plan-action" type="button" onClick={() => navigateTo("inventory")}>Current plan</button>
              </article>
              <article className="plan-card">
                <span className="plan-label">SEE IT IN ACTION</span><h2>Demo</h2><p className="plan-price">Free <span>/ guided demo</span></p>
                <p className="plan-description">Explore the workspace and see how inventory tracking works.</p>
                <button className="button button-quiet plan-action" type="button" onClick={() => navigateTo("inventory")}>Explore the app</button>
              </article>
              <article className="plan-card plan-featured">
                <span className="plan-label">FOR GROWING TEAMS</span><h2>Basic</h2><p className="plan-price">$50 <span>/ year</span></p>
                <p className="plan-description">A straightforward annual option for your inventory workflow.</p>
                <button className="button button-primary plan-action" type="button" onClick={() => setPlanNotice("Online billing is not set up yet. Your current Free plan remains active.")}>Choose Basic</button>
              </article>
              <article className="plan-card">
                <span className="plan-label">FOR MORE CAPACITY</span><h2>Premium</h2><p className="plan-price">$345 <span>/ year</span></p>
                <p className="plan-description">An expanded annual plan for businesses ready to grow.</p>
                <button className="button button-primary plan-action" type="button" onClick={() => setPlanNotice("Online billing is not set up yet. Your current Free plan remains active.")}>Choose Premium</button>
              </article>
            </div>
            <footer className="page-footer"><span>B2G INVENTORY <span className="footer-dot">·</span> A little more in control.</span><span>Paid plan checkout is not yet available.</span></footer>
          </>}
        </div>
      </section>

      {modalOpen && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setModalOpen(false); }}>
        <section className="product-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div className="modal-heading"><div><div className="eyebrow muted-eyebrow">{editingProduct ? "UPDATE YOUR CATALOG" : "GROW YOUR CATALOG"}</div><h2 id="modal-title">{editingProduct ? "Edit product" : "Add a product"}</h2><p>Keep your stock details up to date.</p></div><button className="icon-button" onClick={() => setModalOpen(false)} aria-label="Close dialog"><X size={19} /></button></div>
          <form onSubmit={saveProduct}>
            <div className="form-grid">
              <label className="field full-field">Product name<input autoFocus required maxLength={120} placeholder="e.g. Everyday tote bag" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
              <label className="field">SKU<input required maxLength={40} placeholder="e.g. BAG-001" value={draft.sku} onChange={(event) => setDraft({ ...draft, sku: event.target.value })} /></label>
              <label className="field">Category<input required maxLength={60} placeholder="e.g. Accessories" value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} /></label>
              <label className="field">Quantity in stock<input type="number" min="0" step="1" required value={draft.quantity} onChange={(event) => setDraft({ ...draft, quantity: Number(event.target.value) })} /></label>
              <label className="field">Unit price ($)<input type="number" min="0" step="0.01" required value={draft.unit_price} onChange={(event) => setDraft({ ...draft, unit_price: Number(event.target.value) })} /></label>
              <label className="field full-field">Supplier <span className="optional-label">Optional</span><input maxLength={120} placeholder="e.g. Northstar Goods" value={draft.supplier} onChange={(event) => setDraft({ ...draft, supplier: event.target.value })} /></label>
            </div>
            <div className="modal-actions">{editingProduct && <button type="button" className="delete-button" onClick={() => void deleteProduct(editingProduct)}>Delete product</button>}<button type="button" className="button button-quiet" onClick={() => setModalOpen(false)}>Cancel</button><button type="submit" className="button button-primary" disabled={savingProduct}>{savingProduct ? "Saving…" : editingProduct ? "Save changes" : "Add product"}</button></div>
          </form>
        </section>
      </div>}
    </main>
  );
}

function Brand() {
  return <div className="brand"><div className="brand-mark"><Boxes size={19} strokeWidth={2.2} /></div><span>B2G INVENTORY</span></div>;
}

function StockStatus({ quantity, minimum }: { quantity: number; minimum: number }) {
  if (quantity === 0) return <span className="status-pill status-out"><span />Out of stock</span>;
  if (quantity < minimum) return <span className="status-pill status-low"><span />Low stock</span>;
  return <span className="status-pill status-in"><span />In stock</span>;
}
