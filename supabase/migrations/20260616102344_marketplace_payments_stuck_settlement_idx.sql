create index if not exists marketplace_payments_stuck_settlement_idx
  on marketplace_payments(last_webhook_at)
  where status in ('succeeded', 'fulfillment_pending', 'transfers_pending');
