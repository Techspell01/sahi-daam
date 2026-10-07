-- fair_price(): which prices count and which pool it uses. Same cases as the
-- fairPrice tests in src/lib/engine.test.js. Run with: npx supabase test db
begin;
select plan(10);

-- Prices are dated around 1 Feb 2001 and fair_price is asked about that day, so
-- real reports in the table can't interfere.
-- One reporter whose account is a day old (their prices count) and one brand new.
insert into auth.users (id, created_at) values
  ('00000000-0000-4000-8000-000000000001', now() - interval '1 day'),
  ('00000000-0000-4000-8000-000000000002', now());

create function pg_temp.add(who int, item text, area text, price numeric, ago interval default '1 day')
returns void language sql as $$
  insert into public.reports (user_id, item_id, area_id, price, paid, qty_label, shop, paid_at)
  values (('00000000-0000-4000-8000-00000000000' || who)::uuid, item, area, price, price, '1 kg', 'street', '2001-02-01'::timestamptz - ago);
$$;

-- Tomato in Kakkanad: enough for an area range, with one tourist price.
select pg_temp.add(1, 'tomato', 'ernakulam', p) from unnest(array[38, 40, 41, 42, 43, 45, 120]) p;
-- The new account's prices don't count yet.
select pg_temp.add(2, 'tomato', 'ernakulam', 500);
-- Onion only in Aluva: Kakkanad falls back to the city.
select pg_temp.add(1, 'onion', 'thrissur', p) from unnest(array[40, 41, 42, 43, 44, 45]) p;
-- Shallots only 20 days ago: falls back to 30 days.
select pg_temp.add(1, 'shallots', 'thrissur', p, '20 days') from unnest(array[70, 71, 72, 73, 74, 75]) p;
-- Garlic: too few to say anything.
select pg_temp.add(1, 'garlic', 'ernakulam', p) from unnest(array[200, 210]) p;

select is((select typical from fair_price('tomato', 'ernakulam', '2001-02-01')), 41.5::float8, 'tomato: median of the kept prices');
select is((select removed from fair_price('tomato', 'ernakulam', '2001-02-01')), 1, 'tomato: the tourist price is set aside');
select is((select n from fair_price('tomato', 'ernakulam', '2001-02-01')), 6, 'tomato: the new account''s price doesn''t count');
select is((select scope from fair_price('tomato', 'ernakulam', '2001-02-01')), 'area', 'tomato: uses the area');
select is((select scope from fair_price('onion', 'ernakulam', '2001-02-01')), 'city', 'onion: widens to the city');
select is((select days from fair_price('shallots', 'ernakulam', '2001-02-01')), 30, 'shallots: widens to 30 days');
select is_empty($$ select * from fair_price('garlic', 'ernakulam', '2001-02-01') $$, 'garlic: no range from 2 prices');

-- What other people see: recent prices with amounts real data won't have.
insert into public.reports (user_id, item_id, area_id, price, paid, qty_label, shop, paid_at) values
  ('00000000-0000-4000-8000-000000000001', 'tomato', 'ernakulam', 4321, 4321, '1 kg', 'street', now() - interval '1 hour'),
  ('00000000-0000-4000-8000-000000000002', 'tomato', 'ernakulam', 4322, 4322, '1 kg', 'street', now() - interval '1 hour');
set local role anon;
select is((select count(*)::int from shared_reports() where price = 4322), 0, 'shared_reports hides prices from new accounts');
select is((select count(*)::int from shared_reports() where price = 4321), 1, 'shared_reports shows counted prices');
reset role;

-- Deleting the account deletes its prices.
delete from auth.users where id = '00000000-0000-4000-8000-000000000001';
select is((select count(*)::int from public.reports where item_id = 'onion' and paid_at < '2001-03-01'), 0, 'deleting an account deletes its prices');

select * from finish();
rollback;
