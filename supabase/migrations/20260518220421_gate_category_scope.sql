-- Let controllers scope a gate session to one or more ticket categories.
-- NULL means the gate accepts every category for the event.

alter type redemption_result add value if not exists 'wrong_category';

alter table gate_sessions
  add column if not exists allowed_category_ids uuid[];

create index if not exists gate_sessions_allowed_category_ids_idx
  on gate_sessions using gin (allowed_category_ids);
