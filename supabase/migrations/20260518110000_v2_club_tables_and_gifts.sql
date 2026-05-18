-- V2: Club Tables, per-category controls, floor plan, gifts, off-platform transfers.
-- Backward compatible with V1: event-level toggle columns kept (legacy) and
-- backfilled into new per-category columns.

-- ===== 1. Category kind ====================================================
do $$ begin
  create type ticket_category_kind as enum ('standard', 'club_table');
exception when duplicate_object then null; end $$;

alter table ticket_categories
  add column if not exists kind ticket_category_kind not null default 'standard',
  -- toggles moved from events to categories
  add column if not exists sales_enabled boolean not null default true,
  add column if not exists public_sales_counter_enabled boolean not null default true,
  -- club table fields
  add column if not exists min_spending numeric(12,2)
    check (min_spending is null or min_spending >= 0),
  add column if not exists online_advance numeric(12,2)
    check (online_advance is null or online_advance >= 0),
  add column if not exists base_capacity int
    check (base_capacity is null or base_capacity > 0),
  add column if not exists extra_guests_enabled boolean not null default false,
  add column if not exists price_per_extra_guest numeric(12,2)
    check (price_per_extra_guest is null or price_per_extra_guest >= 0),
  add column if not exists max_extra_guests int
    check (max_extra_guests is null or max_extra_guests >= 0),
  add column if not exists color_hex text
    check (color_hex is null or color_hex ~ '^#[0-9A-Fa-f]{6}$');

-- Backfill per-category toggles from event-level (preserve current behavior).
update ticket_categories tc set
  sales_enabled = e.sales_enabled,
  public_sales_counter_enabled = e.public_sales_counter_enabled,
  resale_enabled = (tc.resale_enabled and e.resale_enabled)
from events e
where tc.event_id = e.id;

-- Required-when-club_table constraint.
alter table ticket_categories drop constraint if exists club_table_fields_required;
alter table ticket_categories add constraint club_table_fields_required
  check (
    kind = 'standard'
    or (
      min_spending is not null
      and online_advance is not null
      and base_capacity is not null
      and base_capacity > 0
      and color_hex is not null
    )
  );

create index if not exists categories_kind_idx on ticket_categories(kind);

-- ===== 2. Floor plan per event =============================================
alter table events
  add column if not exists floor_plan_url text;

comment on column events.sales_enabled is
  'Legacy V1 flag — V2 uses ticket_categories.sales_enabled as source of truth.';
comment on column events.resale_enabled is
  'Legacy V1 flag — V2 uses ticket_categories.resale_enabled as source of truth.';
comment on column events.public_sales_counter_enabled is
  'Legacy V1 flag — V2 uses ticket_categories.public_sales_counter_enabled as source of truth.';

-- ===== 3. Ticket headcount + off-platform tracking ========================
alter table tickets
  add column if not exists extra_guests_count int not null default 0
    check (extra_guests_count >= 0),
  add column if not exists total_headcount int,
  add column if not exists min_spending_total numeric(12,2),
  add column if not exists min_spending_remaining numeric(12,2),
  add column if not exists color_hex_snapshot text,
  add column if not exists transferred_off_platform_at timestamptz,
  add column if not exists transferred_to_address text;

-- ===== 4. Purchases: gift + extras + advance breakdown ====================
alter table purchases
  add column if not exists gift_recipient_user_id uuid references profiles(id),
  add column if not exists extra_guests_count int not null default 0
    check (extra_guests_count >= 0),
  add column if not exists online_advance_amount numeric(12,2),
  add column if not exists min_spending_total numeric(12,2);

create index if not exists purchases_gift_idx
  on purchases(gift_recipient_user_id);

-- ===== 5. Resale: cap derived in code (no schema lock).  ==================
-- ticket.* fields above provide the as-is snapshot inherited by secondary
-- buyers. Cap = original purchases total; platform fee is added on top in app
-- logic, paid by the secondary buyer.
