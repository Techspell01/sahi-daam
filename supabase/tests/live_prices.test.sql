-- Live prices and fetching only what's new. Run with: npx supabase test db
begin;
select plan(11);

-- market_daily: VFPCK's retail price, else Agmarknet for Ernakulam, else Kerala.
-- (A day in 2001, so real prices already in the table can't interfere.)
insert into public.market_prices (item_id, region, day, source, price, wholesale) values
  ('tomato', 'ernakulam', '2001-01-04', 'vfpck', 50, 45), ('tomato', 'ernakulam', '2001-01-04', 'agmarknet', 44, null),
  ('garlic', 'ernakulam', '2001-01-04', 'agmarknet', 200, null), ('garlic', 'kerala', '2001-01-04', 'agmarknet', 209.2, null);
select is((select source from market_daily where item_id = 'tomato' and day = '2001-01-04'), 'vfpck', 'market_daily prefers VFPCK');
select is((select count(*)::int from market_daily where item_id = 'garlic' and day = '2001-01-04'), 2, 'one row per district and day');
select throws_ok($$ insert into public.market_prices (item_id, region, day, source, price) values ('tomato', 'atlantis', '2001-01-04', 'vfpck', 1) $$,
  '23503', null, 'unknown districts are refused');

-- The app can read live prices but not change them.
set local role anon;
select is((select count(*)::int from market_daily where day = '2001-01-04'), 3, 'anyone can read market_daily');
select is((select count(*)::int from rates where day = '2001-01-04'), 0, 'anyone can read rates');
select throws_ok($$ insert into public.rates (kind, region, day, price) values ('gold22', 'kerala', '2001-01-04', 1) $$, '42501', null, 'the app cannot write rates');
select throws_ok($$ insert into public.fuel_prices (fuel, day, price) values ('petrol', '2026-10-07', 1) $$, '42501', null, 'the app cannot write fuel prices');
select throws_ok($$ delete from public.market_prices $$, '42501', null, 'the app cannot delete mandi prices');
reset role;

-- shared_reports(after): only prices that became visible since `after`.
insert into auth.users (id, created_at) values ('00000000-0000-4000-8000-000000000001', now() - interval '1 day');
insert into public.reports (user_id, item_id, area_id, price, paid, qty_label, shop, paid_at)
values ('00000000-0000-4000-8000-000000000001', 'onion', 'thrissur', 50, 50, '1 kg', 'street', now() - interval '1 hour');
update public.reports set counts_from = now() - interval '2 hours' where item_id = 'onion';
insert into public.reports (user_id, item_id, area_id, price, paid, qty_label, shop, paid_at)
values ('00000000-0000-4000-8000-000000000001', 'onion', 'thrissur', 52, 52, '1 kg', 'street', now());

set local role anon;
select is((select count(*)::int from shared_reports() where item_id = 'onion' and area_id = 'thrissur' and price in (50, 52)), 2, 'a full fetch returns both prices');
select is((select count(*)::int from shared_reports(after => now() - interval '1 hour') where item_id = 'onion' and area_id = 'thrissur' and price in (50, 52)), 1, 'after returns only the newer price');
select is((select count(*)::int from shared_reports() where visible_at <> date_trunc('minute', visible_at)), 0,
  'visible_at is rounded to the minute');
reset role;

select * from finish();
rollback;
