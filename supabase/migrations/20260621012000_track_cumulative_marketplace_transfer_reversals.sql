-- Track cumulative connected-account reversal progress per marketplace transfer.
-- Partial external refunds can arrive more than once on the same Charge, so a
-- single reversal id/status cannot represent how much seller money is already
-- clawed back.
alter table marketplace_transfers
  add column if not exists reversed_amount_cents bigint not null default 0,
  add column if not exists stripe_transfer_reversal_ids text[] not null default '{}';

update marketplace_transfers
set reversed_amount_cents = amount_cents,
    stripe_transfer_reversal_ids = case
      when stripe_transfer_reversal_id is null then stripe_transfer_reversal_ids
      when stripe_transfer_reversal_id = any(stripe_transfer_reversal_ids) then stripe_transfer_reversal_ids
      else array_append(stripe_transfer_reversal_ids, stripe_transfer_reversal_id)
    end
where status = 'reversed'
  and reversed_amount_cents = 0;

alter table marketplace_transfers
  drop constraint if exists marketplace_transfers_reversed_amount_range,
  add constraint marketplace_transfers_reversed_amount_range
    check (reversed_amount_cents between 0 and amount_cents);
