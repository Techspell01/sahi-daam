-- Live prices from online sources, refreshed twice a day by the refresh-prices
-- Edge Function (see supabase/functions/refresh-prices):
--   market_prices, in rupees per kg:
--     vfpck: VFPCK's daily retail price at Ernakulam (`wholesale` alongside).
--     agmarknet: mandi prices for Ernakulam district, or Kerala-wide (`scope`).
--   fuel_prices: petrol and diesel per litre in Ernakulam.
-- Everyone can read them; only the function (service role) writes.

create table public.market_prices (
  item_id text not null references public.items,
  day date not null,
  source text not null check (source in ('vfpck', 'agmarknet')),
  scope text not null check (scope in ('district', 'state')),
  price numeric(10,2) not null check (price > 0),
  wholesale numeric(10,2) check (wholesale > 0),
  fetched_at timestamptz not null default now(),
  primary key (item_id, day, source, scope)
);

create table public.fuel_prices (
  fuel text not null check (fuel in ('petrol', 'diesel')),
  day date not null,
  price numeric(8,2) not null check (price > 0),
  city text not null default 'Ernakulam',
  source text not null default 'goodreturns',
  fetched_at timestamptz not null default now(),
  primary key (fuel, day)
);

alter table public.market_prices enable row level security;
alter table public.fuel_prices enable row level security;
create policy "anyone can read" on public.market_prices for select to anon, authenticated using (true);
create policy "anyone can read" on public.fuel_prices for select to anon, authenticated using (true);
revoke insert, update, delete, truncate on public.market_prices, public.fuel_prices from anon, authenticated;

-- One price per item and day: VFPCK's retail price, else Agmarknet for
-- Ernakulam, else Agmarknet for Kerala.
create view public.market_daily with (security_invoker = true) as
  select distinct on (item_id, day) item_id, day, source, scope, price, wholesale
  from public.market_prices
  order by item_id, day, (source = 'vfpck') desc, (scope = 'district') desc;

grant select on public.market_daily to anon, authenticated;

-- Calls the Edge Function. Its URL and shared secret live in Vault (set once per
-- project, see PLAN.md); without them, as on the local stack, this does nothing.
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

create function public.refresh_prices() returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'refresh_prices_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'refresh_prices_secret';
  if v_url is null or v_secret is null then
    return;
  end if;
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-refresh-secret', v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
end;
$$;

revoke execute on function public.refresh_prices() from public, anon, authenticated;

-- 6:30 am IST (after fuel prices change at 6) and 6:30 pm IST (after the day's mandi reports).
select cron.schedule('sahidaam-refresh-prices', '0 1,13 * * *', $$select public.refresh_prices()$$);
