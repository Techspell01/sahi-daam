-- What people can report on. Ids match src/lib/catalog.js; the rows come from
-- scripts/catalog-sql.mjs. Read-only for the app, and handy for joins in SQL analysis.

create table public.items (
  id text primary key,
  name text not null,
  name_ml text,
  name_hi text,
  category text not null check (category in ('veg', 'fruit', 'fish', 'grocery', 'service')),
  unit text not null
);

create table public.areas (
  id text primary key,
  name text not null
);

-- Landmarks for auto fares.
create table public.places (
  id text primary key,
  name text not null,
  name_ml text,
  lat double precision not null,
  lng double precision not null
);

alter table public.items enable row level security;
alter table public.areas enable row level security;
alter table public.places enable row level security;

create policy "anyone can read" on public.items for select to anon, authenticated using (true);
create policy "anyone can read" on public.areas for select to anon, authenticated using (true);
create policy "anyone can read" on public.places for select to anon, authenticated using (true);

revoke insert, update, delete, truncate on public.items, public.areas, public.places from anon, authenticated;
