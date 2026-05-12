-- Add 'expired' to ticket_status enum.
-- Expiration = event date has passed and ticket is still unused.
-- Distinct from reservation timeout (lazy-released back to 'available').
alter type ticket_status add value if not exists 'expired';
