-- Splits the single event image into purpose-specific variants so admins can
-- pick distinct artwork for cards, detail hero, ticket NFT, and resale.
-- image_url is kept as the legacy fallback consumers can use when a variant
-- has not yet been uploaded.

alter table events
  add column if not exists thumbnail_url text,
  add column if not exists hero_url text,
  add column if not exists ticket_visual_url text,
  add column if not exists marketplace_url text;

update events
   set thumbnail_url = image_url
 where thumbnail_url is null
   and image_url is not null;
