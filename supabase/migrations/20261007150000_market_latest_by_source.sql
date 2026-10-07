-- market_latest now keeps the newest price per item, district AND source, so
-- the app can calibrate Agmarknet estimates against VFPCK retail prices in the
-- districts that have both, and compare all 14 districts on one footing.
create or replace view public.market_latest with (security_invoker = true) as
  select distinct on (item_id, region, source) item_id, region, day, source, price
  from public.market_prices
  where day >= current_date - 7
  order by item_id, region, source, day desc;
