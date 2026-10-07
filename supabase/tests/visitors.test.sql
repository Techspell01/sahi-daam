-- The visitor count. Run with: npx supabase test db
begin;
select plan(9);

-- Counts are cached for 30 s; this clears the cache first so each visit shows.
create function pg_temp.visit(v uuid) returns json language sql as $$
  update public.usage_stats set at = '-infinity' where id;
  select public.visit(v);
$$;
do $$ begin perform pg_temp.visit('00000000-0000-4000-8000-000000000000'); end $$;
create temp table before as select today, total from public.usage_stats where id;

set local role anon;
select throws_ok($$ select public.visit(null) $$, 'P0001', 'visitor id needed', 'a visit needs an id');
select throws_ok($$ select * from public.visitors $$, '42501', null, 'the app cannot read visitors');
select throws_ok($$ select * from public.usage_stats $$, '42501', null, 'or the cached counts');
select lives_ok($$ select public.visit('00000000-0000-4000-8000-000000000001') $$, 'anyone can record a visit');
reset role;

select is((pg_temp.visit('00000000-0000-4000-8000-000000000001') ->> 'today')::int, (select today + 1 from before), 'a new visitor adds one to today');
select is((pg_temp.visit('00000000-0000-4000-8000-000000000001') ->> 'today')::int, (select today + 1 from before), 'the same visitor again does not');
select ok((pg_temp.visit('00000000-0000-4000-8000-000000000001') ->> 'now')::int >= 1, 'they count as here now');

-- 300 new ids in a minute looks like a script: the next new one isn't counted.
insert into public.visitors (id) select gen_random_uuid() from generate_series(1, 300);
select is((pg_temp.visit('00000000-0000-4000-8000-000000000002') ->> 'total')::int, (select total + 301 from before), 'past 300 new visitors a minute, new ids are ignored');
select is((pg_temp.visit('00000000-0000-4000-8000-000000000001') ->> 'today')::int, (select today + 1 from before), 'but people already counted still are');

select * from finish();
rollback;
