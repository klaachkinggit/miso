-- Adds discovery facets to events: genre, vibe, festival flag, artists, and a
-- generated tsvector with a GIN index for full-text search across name, venue,
-- city, artists, and description.

do $$ begin
  create type event_genre as enum (
    'techno', 'afro_house', 'rap', 'commercial', 'live'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type event_vibe as enum (
    'club', 'festival', 'rooftop', 'student_party', 'private_event'
  );
exception when duplicate_object then null; end $$;

alter table events
  add column if not exists genre event_genre,
  add column if not exists vibe event_vibe,
  add column if not exists is_festival boolean not null default false,
  add column if not exists artists text[] not null default '{}';

alter table events
  add column if not exists search_tsv tsvector;

create or replace function update_event_search_tsv()
returns trigger
language plpgsql
as $$
begin
  new.search_tsv :=
    setweight(to_tsvector('simple', coalesce(new.name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(new.venue_name, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(new.city, '')), 'B') ||
    setweight(
      to_tsvector('simple', array_to_string(coalesce(new.artists, '{}'), ' ')),
      'B'
    ) ||
    setweight(to_tsvector('simple', coalesce(new.description, '')), 'C');
  return new;
end;
$$;

drop trigger if exists events_search_tsv_trigger on events;
create trigger events_search_tsv_trigger
before insert or update of name, venue_name, city, artists, description
on events
for each row execute function update_event_search_tsv();

update events
   set updated_at = updated_at;

create index if not exists events_search_idx on events using gin (search_tsv);
create index if not exists events_genre_idx on events(genre);
create index if not exists events_vibe_idx on events(vibe);
create index if not exists events_is_festival_idx on events(is_festival)
  where is_festival is true;

-- Cached popularity (tickets sold per event), used for "popular" sort on the
-- discovery page. Kept as a view so the count is always live.
create or replace view event_popularity
  with (security_invoker = true) as
  select event_id, coalesce(sum(sold_count), 0)::bigint as tickets_sold
    from ticket_categories
   group by event_id;
