-- B2G Engineering workbook-aligned schema
create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  stock_record_id text not null default '',
  sku text not null,
  item_description text not null default '',
  category text not null default '',
  uom text not null default 'pcs',
  location text not null default 'Central Warehouse',
  bin_location text not null default '',
  minimum_stock numeric not null default 0 check (minimum_stock >= 0),
  opening_balance numeric not null default 0,
  total_in numeric not null default 0,
  total_out numeric not null default 0,
  on_hand numeric not null default 0,
  approved_pending numeric not null default 0,
  available numeric not null default 0,
  stock_status text not null default '',
  last_movement date,
  preferred_supplier text not null default '',
  unit_cost_usd numeric(14,2) not null default 0,
  stock_value_usd numeric(14,2) not null default 0,
  remarks text not null default '',
  extra_data jsonb not null default '{}'::jsonb check (jsonb_typeof(extra_data)='object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, sku, location)
);

create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  asset_id text not null,
  category text not null default '',
  asset_name text not null default '',
  make_model text not null default '',
  serial_no text not null default '',
  uom text not null default 'unit',
  ownership text not null default 'Owned',
  purchase_date date,
  original_cost_usd numeric(14,2) not null default 0,
  home_location text not null default 'Central Warehouse',
  current_location text not null default '',
  project_id text not null default '',
  assigned_to text not null default '',
  condition text not null default 'Good',
  status text not null default 'Available',
  deployment_start date,
  due_date date,
  last_return date,
  days_out integer not null default 0,
  last_movement date,
  inspection_due date,
  calibration_due date,
  availability_flag text not null default 'AVAILABLE',
  remarks text not null default '',
  extra_data jsonb not null default '{}'::jsonb check (jsonb_typeof(extra_data)='object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, asset_id)
);

create table if not exists public.project_sites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id text not null,
  project_name text not null default '',
  client text not null default '',
  site_location text not null default '',
  project_manager text not null default '',
  start_date date,
  end_date date,
  status text not null default 'Active',
  site_store_location text not null default '',
  notes text not null default '',
  extra_data jsonb not null default '{}'::jsonb check (jsonb_typeof(extra_data)='object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, project_id)
);

create table if not exists public.requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  request_id text not null,
  request_date date,
  inventory_type text not null default 'Material',
  project_id text not null default '',
  project_site text not null default '',
  requester text not null default '',
  department text not null default '',
  required_date date,
  priority text not null default 'Normal',
  item_asset_id text not null default '',
  description text not null default '',
  uom text not null default '',
  qty_requested numeric not null default 0,
  purpose text not null default '',
  approver text not null default '',
  approval_status text not null default 'Pending',
  approved_qty numeric not null default 0,
  approval_date date,
  source_location text not null default 'Central Warehouse',
  issue_status text not null default '',
  qty_issued numeric not null default 0,
  balance_to_issue numeric not null default 0,
  due_return_date date,
  remarks text not null default '',
  extra_data jsonb not null default '{}'::jsonb check (jsonb_typeof(extra_data)='object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, request_id)
);

create table if not exists public.material_movements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  movement_id text not null default '',
  transaction_date date,
  request_id text not null default '',
  movement_type text not null default 'Receipt',
  sku text not null default '',
  item_description text not null default '',
  uom text not null default '',
  quantity numeric not null default 0,
  from_location text not null default '',
  to_location text not null default '',
  project_id text not null default '',
  project_site text not null default '',
  handed_over_by text not null default '',
  received_by text not null default '',
  approval_doc_ref text not null default '',
  unit_cost_usd numeric(14,2) not null default 0,
  movement_value_usd numeric(14,2) not null default 0,
  entry_check text not null default '',
  remarks text not null default '',
  extra_data jsonb not null default '{}'::jsonb check (jsonb_typeof(extra_data)='object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.asset_movements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  movement_id text not null default '',
  movement_date date,
  request_id text not null default '',
  action text not null default '',
  asset_id text not null default '',
  asset_name text not null default '',
  from_location text not null default '',
  to_location text not null default '',
  project_id text not null default '',
  project_site text not null default '',
  assigned_to text not null default '',
  condition_out text not null default '',
  condition_in text not null default '',
  resulting_condition text not null default '',
  due_date date,
  return_date date,
  approved_by text not null default '',
  handover_ref text not null default '',
  entry_check text not null default '',
  remarks text not null default '',
  extra_data jsonb not null default '{}'::jsonb check (jsonb_typeof(extra_data)='object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.check_schedule (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  check_id text not null,
  check_period text not null default '',
  frequency text not null default 'Monthly',
  check_scope text not null default 'Full Count',
  location text not null default '',
  planned_date date,
  actual_date date,
  lead_verifier text not null default '',
  independent_checker text not null default '',
  check_status text not null default 'Planned',
  lines_planned integer not null default 0,
  lines_verified integer not null default 0,
  exceptions integer not null default 0,
  post_freeze_movement_lines integer not null default 0,
  completion_pct numeric not null default 0,
  open_actions integer not null default 0,
  approved_by text not null default '',
  approval_date date,
  next_check_due date,
  verification_outcome text not null default '',
  notes text not null default '',
  extra_data jsonb not null default '{}'::jsonb check (jsonb_typeof(extra_data)='object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, check_id)
);

create table if not exists public.verification_matrix (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  check_line_id text not null,
  check_id text not null default '',
  check_date date,
  frequency text not null default '',
  location text not null default '',
  inventory_type text not null default '',
  item_asset_id text not null default '',
  description text not null default '',
  uom text not null default '',
  live_system_qty numeric,
  system_qty_cutoff numeric,
  live_vs_cutoff numeric,
  physical_qty numeric,
  count_variance numeric,
  variance_pct numeric,
  live_system_condition text not null default '',
  recorded_condition_cutoff text not null default '',
  physical_condition text not null default '',
  verification_result text not null default 'NOT COUNTED',
  variance_cause text not null default '',
  corrective_action text not null default '',
  responsible text not null default '',
  target_date date,
  action_status text not null default 'Not Required',
  verified_by text not null default '',
  independent_checker text not null default '',
  adjustment_approval_ref text not null default '',
  evidence_notes text not null default '',
  extra_data jsonb not null default '{}'::jsonb check (jsonb_typeof(extra_data)='object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, check_line_id)
);

do $$
declare t text;
begin
  foreach t in array array['materials','assets','project_sites','requests','material_movements','asset_movements','check_schedule','verification_matrix']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('drop policy if exists "%s_select" on public.%I', t, t);
    execute format('drop policy if exists "%s_insert" on public.%I', t, t);
    execute format('drop policy if exists "%s_update" on public.%I', t, t);
    execute format('drop policy if exists "%s_delete" on public.%I', t, t);
    execute format('create policy "%s_select" on public.%I for select to authenticated using ((select auth.uid())=user_id)', t, t);
    execute format('create policy "%s_insert" on public.%I for insert to authenticated with check ((select auth.uid())=user_id)', t, t);
    execute format('create policy "%s_update" on public.%I for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id)', t, t);
    execute format('create policy "%s_delete" on public.%I for delete to authenticated using ((select auth.uid())=user_id)', t, t);
    execute format('drop trigger if exists set_%s_updated_at on public.%I', t, t);
    execute format('create trigger set_%s_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;

create index if not exists materials_user_sku_idx on public.materials(user_id, sku);
create index if not exists assets_user_asset_idx on public.assets(user_id, asset_id);
create index if not exists requests_user_date_idx on public.requests(user_id, request_date desc);
create index if not exists mat_moves_user_date_idx on public.material_movements(user_id, transaction_date desc);
create index if not exists asset_moves_user_date_idx on public.asset_movements(user_id, movement_date desc);
create index if not exists check_sched_user_idx on public.check_schedule(user_id, planned_date desc);
create index if not exists verify_user_idx on public.verification_matrix(user_id, check_date desc);
