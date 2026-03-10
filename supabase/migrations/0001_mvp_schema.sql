-- MVP schema: tenants, customers, products, orders, payments, inventory
-- Notes:
-- - Earnings reports should be based on cash received (net of refunds), not order totals.
-- - RLS is intentionally not included here; it will be added in a dedicated follow-up migration.

create extension if not exists "pgcrypto";

-- =========================
-- Enums (MVP)
-- =========================
do $$ begin
  create type public.payment_status as enum ('unpaid', 'partial', 'paid', 'refunded');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.payment_method as enum ('cash', 'upi', 'card', 'other');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.delivery_status as enum ('created', 'out_for_delivery', 'delivered', 'cancelled', 'returned');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  -- Each payment row is a money movement; refunds reduce net cash received.
  create type public.payment_kind as enum ('payment', 'refund');
exception
  when duplicate_object then null;
end $$;

-- =========================
-- Core tables
-- =========================
create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  phone text not null,
  address text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists customers_tenant_phone_uq on public.customers(tenant_id, phone);
create index if not exists customers_tenant_name_idx on public.customers(tenant_id, name);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  description text null,
  sku text null,
  price numeric(12,2) not null check (price >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists products_tenant_sku_uq on public.products(tenant_id, sku) where sku is not null;
create index if not exists products_tenant_active_idx on public.products(tenant_id, active);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete restrict,

  payment_status public.payment_status not null default 'unpaid',
  delivery_status public.delivery_status not null default 'created',

  subtotal numeric(12,2) not null default 0 check (subtotal >= 0),
  discount numeric(12,2) not null default 0 check (discount >= 0),
  tax numeric(12,2) not null default 0 check (tax >= 0),
  total numeric(12,2) not null default 0 check (total >= 0),

  currency_code char(3) not null default 'INR',

  notes text null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  delivered_at timestamptz null
);

create index if not exists orders_tenant_created_idx on public.orders(tenant_id, created_at desc);
create index if not exists orders_tenant_delivery_status_idx on public.orders(tenant_id, delivery_status);
create index if not exists orders_tenant_payment_status_idx on public.orders(tenant_id, payment_status);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid null references public.products(id) on delete set null,

  product_name_snapshot text not null,
  quantity integer not null check (quantity > 0),
  unit_price_snapshot numeric(12,2) not null check (unit_price_snapshot >= 0),

  created_at timestamptz not null default now()
);

create index if not exists order_items_order_idx on public.order_items(order_id);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,

  kind public.payment_kind not null default 'payment',
  method public.payment_method not null default 'cash',
  amount numeric(12,2) not null check (amount >= 0),

  reference text null,
  notes text null,

  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists payments_tenant_paid_at_idx on public.payments(tenant_id, paid_at desc);
create index if not exists payments_order_paid_at_idx on public.payments(order_id, paid_at desc);
create index if not exists payments_tenant_method_idx on public.payments(tenant_id, method);

create table if not exists public.vendors (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  phone text null,
  address text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists vendors_tenant_name_idx on public.vendors(tenant_id, name);
create index if not exists vendors_tenant_phone_idx on public.vendors(tenant_id, phone) where phone is not null;

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  vendor_id uuid null references public.vendors(id) on delete set null,
  name text not null,
  quantity numeric(12,3) not null default 0,
  buying_date date null,
  buying_price numeric(12,2) null check (buying_price is null or buying_price >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists inventory_items_tenant_name_idx on public.inventory_items(tenant_id, name);
create index if not exists inventory_items_vendor_idx on public.inventory_items(vendor_id);

-- =========================
-- Reporting views (MVP)
-- =========================
-- Cash received (net) by day: payments add, refunds subtract.
create or replace view public.v_cash_received_daily as
select
  p.tenant_id,
  date_trunc('day', p.paid_at) as day,
  p.method,
  sum(case when p.kind = 'payment' then p.amount else -p.amount end) as net_amount
from public.payments p
group by 1,2,3;

-- Optional: order totals by day (NOT earnings; useful as "sales booked").
create or replace view public.v_order_total_daily as
select
  o.tenant_id,
  date_trunc('day', o.created_at) as day,
  sum(o.total) as total_amount
from public.orders o
group by 1,2;

