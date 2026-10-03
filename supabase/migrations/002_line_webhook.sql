-- BOOMBOX TH: LINE webhook events and conversations
-- Run in Supabase SQL Editor AFTER 001_line_orders.sql.
-- Does NOT modify tables/triggers from 001.

create extension if not exists pgcrypto;

-- 1) LINE webhook audit + dedup table
create table if not exists public.line_webhook_events (
  id               uuid primary key default gen_random_uuid(),
  webhook_event_id text not null unique,
  event_type       text not null,
  line_user_id     text,
  reply_token      text,
  body_hash        text not null default '',
  received_at      timestamptz not null default now(),
  processed        boolean not null default false,
  result           text not null check (result in (
    'processing',
    'accepted',
    'duplicate',
    'reply_failed',
    'timeout',
    'invalid_payload',
    'error'
  )),
  reply_status     text check (reply_status in ('success','failed','skipped')),
  line_reply_error text,
  created_at       timestamptz not null default now()
);

create index if not exists line_webhook_events_line_user_id_idx
  on public.line_webhook_events (line_user_id);
create index if not exists line_webhook_events_received_at_desc_idx
  on public.line_webhook_events (received_at desc);

alter table public.line_webhook_events enable row level security;

-- 2) LINE conversation state machine table
create table if not exists public.line_conversations (
  id              uuid primary key default gen_random_uuid(),
  line_user_id    text not null unique,
  state           text not null default 'new'
    check (state in (
      'new',
      'collecting_package',
      'collecting_color',
      'collecting_scents',
      'collecting_customer',
      'awaiting_confirmation',
      'confirmed',
      'cancelled'
    )),
  draft           jsonb not null default '{}'::jsonb,
  last_event_id   uuid references public.line_webhook_events(id) on delete set null,
  last_message_at timestamptz not null default now(),
  expires_at      timestamptz not null default (now() + interval '24 hours'),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists line_conversations_state_idx
  on public.line_conversations (state);
create index if not exists line_conversations_expires_at_idx
  on public.line_conversations (expires_at);

-- NEW trigger and function with unique names (don't touch line_orders ones
create or replace function public.set_line_conversations_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists line_conversations_updated_at on public.line_conversations;
create trigger line_conversations_updated_at
before update on public.line_conversations
for each row execute function public.set_line_conversations_updated_at();

alter table public.line_conversations enable row level security;
