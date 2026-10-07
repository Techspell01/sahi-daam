-- Today's rates: gold (22K and 24K per gram) and silver (per gram) for Kerala,
-- and the domestic LPG cylinder (14.2 kg) per district, from Goodreturns,
-- refreshed by the refresh-prices Edge Function. Fuel stays in fuel_prices.

create table public.rates (
  kind text not null check (kind in ('gold22', 'gold24', 'silver', 'lpg')),
  region text not null, -- 'kerala', or a district id
  day date not null,
  price numeric(12,2) not null check (price > 0),
  source text not null default 'goodreturns',
  fetched_at timestamptz not null default now(),
  primary key (kind, region, day)
);

create trigger check_region before insert or update on public.rates
  for each row execute function public.check_region();

alter table public.rates enable row level security;
create policy "anyone can read" on public.rates for select to anon, authenticated using (true);
revoke insert, update, delete, truncate on public.rates from anon, authenticated;
