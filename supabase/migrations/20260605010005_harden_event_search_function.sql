-- Fix Supabase security advisor warning: keep the trigger function search path
-- immutable so object resolution cannot be influenced by caller role settings.

create or replace function update_event_search_tsv()
returns trigger
language plpgsql
set search_path = public
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
