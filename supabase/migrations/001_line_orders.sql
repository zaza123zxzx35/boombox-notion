-- BOOMBOX TH: LINE OA orders
-- Run this migration in Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.line_orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  source text not null default 'line',
  line_user_id text,
  line_message_id text,
  idempotency_key text not null unique,
  customer jsonb not null default '{}'::jsonb,
  package_code text not null check (package_code in ('A', 'B', 'C', 'D')),
  package_name text not null,
  unit_price integer not null check (unit_price >= 0),
  device_color text,
  scents jsonb not null default '[]'::jsonb,
  payment_method text not null default 'cod',
  shipping_fee integer not null default 0 check (shipping_fee >= 0),
  total integer not null check (total >= 0),
  customer_note text,
  status text not null default 'pending_confirmation' check (status in ('pending_confirmation', 'confirmed', 'packing', 'shipped', 'completed', 'cancelled')),
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists line_orders_created_at_idx on public.line_orders (created_at desc);
create index if not exists line_orders_status_idx on public.line_orders (status);
create index if not exists line_orders_line_user_id_idx on public.line_orders (line_user_id);

create or replace function public.set_line_orders_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists line_orders_updated_at on public.line_orders;
create trigger line_orders_updated_at
before update on public.line_orders
for each row execute function public.set_line_orders_updated_at();

-- The API uses the service-role key server-side. Keep RLS enabled and do not expose
-- the service-role key to the browser.
alter table public.line_orders enable row level security;
