-- PredictLaunch shared launch directory.
-- Run this once in Supabase SQL Editor.
create table if not exists public.predictlaunch_launches (
  network text not null check (network in ('mainnet', 'devnet', 'testnet')),
  mint text not null,
  pool text not null,
  config text not null,
  signature text not null,
  name text not null,
  symbol text not null,
  description text,
  linked_market_ids text[] not null default '{}',
  conviction_score integer not null default 0 check (conviction_score between 0 and 100),
  fee_bps integer not null default 200 check (fee_bps between 0 and 10000),
  created_at timestamptz not null,
  creator text not null,
  inserted_at timestamptz not null default now(),
  primary key (network, mint),
  unique (network, signature)
);

create index if not exists predictlaunch_launches_network_inserted_idx
  on public.predictlaunch_launches (network, inserted_at desc);

create index if not exists predictlaunch_launches_network_creator_idx
  on public.predictlaunch_launches (network, creator);

alter table public.predictlaunch_launches enable row level security;

-- No anon/authenticated policies are added. The app accesses this table only
-- through its server-side API using SUPABASE_SERVICE_ROLE_KEY.
