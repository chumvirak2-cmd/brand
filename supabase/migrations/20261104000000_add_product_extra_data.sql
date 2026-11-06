alter table public.products
  add column if not exists extra_data jsonb not null default '{}'::jsonb
  check (jsonb_typeof(extra_data) = 'object');
