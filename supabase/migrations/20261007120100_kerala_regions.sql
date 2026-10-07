-- All of Kerala: live prices are kept per district (`region` = an areas id), plus
-- a Kerala-wide figure (`region` = 'kerala') for districts without their own.
--   market_prices: VFPCK retail at 7 district markets (and their Kerala average),
--     Agmarknet per district and Kerala-wide.
--   fuel_prices: petrol and diesel per district; `city` is the page it came from
--     (Pathanamthitta has none, so it uses Kottayam's).

-- market_prices: `scope` becomes `region`. Rows so far were all Ernakulam or Kerala.
alter table public.market_prices add column region text;
update public.market_prices set region = case scope when 'district' then 'ernakulam' else 'kerala' end;
drop view public.market_daily;
alter table public.market_prices drop constraint market_prices_pkey;
alter table public.market_prices drop column scope;
alter table public.market_prices alter column region set not null;
alter table public.market_prices add primary key (item_id, region, day, source);

-- A check can't use a subquery, so a trigger keeps regions to real districts.
create function public.check_region() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.region <> 'kerala' and not exists (select 1 from public.areas a where a.id = new.region) then
    raise exception 'unknown region %', new.region using errcode = '23503';
  end if;
  return new;
end;
$$;
revoke execute on function public.check_region() from public, anon, authenticated;
create trigger check_region before insert or update on public.market_prices
  for each row execute function public.check_region();

-- fuel_prices: one row per fuel, district and day.
alter table public.fuel_prices add column region text not null default 'ernakulam';
alter table public.fuel_prices alter column region drop default;
alter table public.fuel_prices drop constraint fuel_prices_pkey;
alter table public.fuel_prices add primary key (fuel, region, day);
create trigger check_region before insert or update on public.fuel_prices
  for each row execute function public.check_region();

-- One price per item, district and day: VFPCK's retail price over Agmarknet.
create view public.market_daily with (security_invoker = true) as
  select distinct on (item_id, region, day) item_id, region, day, source, price, wholesale
  from public.market_prices
  order by item_id, region, day, (source = 'vfpck') desc;

-- The newest price per item and district in the last week, for "across Kerala".
create view public.market_latest with (security_invoker = true) as
  select distinct on (item_id, region) item_id, region, day, source, price
  from public.market_daily
  where day >= current_date - 7
  order by item_id, region, day desc;

grant select on public.market_daily, public.market_latest to anon, authenticated;
