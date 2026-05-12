-- Migration 0006 — Gate sessions + customer-signed redemption.
--
-- New flow:
--   1. Controller opens a gate_session for an event.
--   2. Customer opens the redemption page via the gate's short_code.
--   3. Customer (or custodial backend) signs a Solana transaction (Memo + on-chain
--      attribute update) proving NFT ownership.
--   4. Backend confirms the transaction, links it to the gate_session, then flips
--      the ticket → used.
--
-- Adds columns required by the redemption confirmation API + reconciliation job.

-- Add new redemption_result variants for the new flow.
alter type redemption_result add value if not exists 'tx_failed';
alter type redemption_result add value if not exists 'tx_pending';
alter type redemption_result add value if not exists 'no_ticket';
alter type redemption_result add value if not exists 'no_session';

-- ===== gate_sessions ========================================================
create table if not exists gate_sessions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  controller_user_id uuid not null references profiles(id),
  gate_name text,
  short_code text not null unique,
  status text not null default 'open' check (status in ('open','closed','expired')),
  expires_at timestamptz not null,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  last_redemption_id uuid,
  last_result text,
  last_ticket_id uuid references tickets(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists gate_sessions_event_idx on gate_sessions(event_id);
create index if not exists gate_sessions_controller_idx on gate_sessions(controller_user_id);
create index if not exists gate_sessions_open_short_code_idx on gate_sessions(short_code) where status = 'open';

-- ===== tickets — new redemption columns =====================================
alter table tickets
  add column if not exists redeem_tx_signature text,
  add column if not exists redemption_pda text,
  add column if not exists redeemed_wallet_address text;

create unique index if not exists tickets_redeem_tx_signature_uniq
  on tickets(redeem_tx_signature) where redeem_tx_signature is not null;
create unique index if not exists tickets_redemption_pda_uniq
  on tickets(redemption_pda) where redemption_pda is not null;

-- ===== ticket_redemptions — gate + tx tracking ==============================
alter table ticket_redemptions
  add column if not exists gate_session_id uuid references gate_sessions(id) on delete set null,
  add column if not exists redeem_tx_signature text,
  add column if not exists redemption_pda text;

create unique index if not exists redemptions_tx_signature_uniq
  on ticket_redemptions(redeem_tx_signature) where redeem_tx_signature is not null;
create unique index if not exists redemptions_pda_uniq
  on ticket_redemptions(redemption_pda) where redemption_pda is not null;

-- ===== gate_sessions.last_redemption_id FK ==================================
alter table gate_sessions
  drop constraint if exists gate_sessions_last_redemption_fk;
alter table gate_sessions
  add constraint gate_sessions_last_redemption_fk
  foreign key (last_redemption_id) references ticket_redemptions(id) on delete set null;

-- ===== RLS for gate_sessions ================================================
alter table gate_sessions enable row level security;

drop policy if exists "gate_sessions_admin_all" on gate_sessions;
create policy "gate_sessions_admin_all" on gate_sessions
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

drop policy if exists "gate_sessions_controller_select" on gate_sessions;
create policy "gate_sessions_controller_select" on gate_sessions
  for select using (controller_user_id = auth.uid());

drop policy if exists "gate_sessions_controller_insert" on gate_sessions;
create policy "gate_sessions_controller_insert" on gate_sessions
  for insert with check (
    controller_user_id = auth.uid()
    and exists (
      select 1 from event_controllers ec
      where ec.event_id = gate_sessions.event_id and ec.user_id = auth.uid()
    )
  );

drop policy if exists "gate_sessions_controller_update" on gate_sessions;
create policy "gate_sessions_controller_update" on gate_sessions
  for update using (controller_user_id = auth.uid());

-- Customer + general read of gate_sessions happens only via server (service role)
-- using the short_code. No public RLS policy needed.
