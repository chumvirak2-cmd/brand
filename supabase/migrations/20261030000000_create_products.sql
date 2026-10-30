create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  sku text not null check (char_length(sku) between 1 and 40),
  category text not null check (char_length(category) between 1 and 60),
  quantity integer not null default 0 check (quantity >= 0),
  unit_price numeric(10, 2) not null default 0 check (unit_price >= 0),
  supplier text not null default '' check (char_length(supplier) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, sku)
);

create index if not exists products_user_id_name_idx
  on public.products (user_id, name);

alter table public.products enable row level security;

grant select, insert, update, delete on public.products to authenticated;

create policy "Users can view their own products"
  on public.products for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can add products to their inventory"
  on public.products for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own products"
  on public.products for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own products"
  on public.products for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.set_product_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_products_updated_at
  before update on public.products
  for each row execute function public.set_product_updated_at();
