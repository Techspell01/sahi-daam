-- Shared price reports and auto fares (phase 2).
--
-- People add prices after an anonymous sign-in, so nobody needs an account.
-- Nobody can read another person's rows directly: the app reads everyone's
-- prices through shared_reports() and shared_trips(), which never return who
-- reported what. Prices from accounts younger than 10 minutes don't count yet,
-- and each account can add 30 prices a day.

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  item_id text not null references public.items,
  area_id text not null references public.areas,
  price numeric(10,2) not null check (price > 0 and price < 100000), -- per base unit (kg, piece, litre…)
  paid numeric(10,2) not null check (paid > 0 and paid < 100000),
  qty_label text not null check (char_length(qty_label) between 1 and 20),
  shop text not null check (shop in ('street', 'shop', 'super', 'online')),
  paid_at timestamptz not null default now(),     -- when they paid (sent from the phone, may be a little earlier if added offline)
  created_at timestamptz not null default now(),  -- when it reached the server
  counts_from timestamptz not null default now()  -- fair ranges ignore it until then (new-account rule)
);

create table public.auto_trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  from_place text references public.places,
  to_place text references public.places,
  km numeric(5,1) not null check (km > 0 and km <= 200),
  fare numeric(8,2) not null check (fare > 0 and fare < 20000),
  night boolean not null default false,
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  counts_from timestamptz not null default now()
);

create index reports_item_paid_at on public.reports (item_id, paid_at desc);
create index reports_paid_at on public.reports (paid_at desc);
create index reports_user on public.reports (user_id, created_at desc);
create index auto_trips_paid_at on public.auto_trips (paid_at desc);
create index auto_trips_user on public.auto_trips (user_id, created_at desc);

-- Stamp every new row. The server sets its own time, and new accounts wait 10
-- minutes before their prices count. Requests from the app (auth.uid() is set)
-- can also only backdate a price by two days (for prices queued while offline)
-- and add 30 prices a day; loading data from SQL skips those two rules.
create function public.stamp_report() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_joined timestamptz;
  v_today int;
begin
  new.created_at := now();
  select u.created_at into v_joined from auth.users u where u.id = new.user_id;
  new.counts_from := greatest(now(), coalesce(v_joined, now()) + interval '10 minutes');

  if auth.uid() is not null then
    new.paid_at := least(now(), greatest(coalesce(new.paid_at, now()), now() - interval '2 days'));

    -- 30 a day per account, counting prices and auto fares together.
    perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));
    select (select count(*) from public.reports r where r.user_id = new.user_id and r.created_at > now() - interval '1 day')
         + (select count(*) from public.auto_trips t where t.user_id = new.user_id and t.created_at > now() - interval '1 day')
      into v_today;
    if v_today >= 30 then
      raise exception 'daily_limit' using errcode = 'P0001', hint = 'You can add up to 30 prices a day.';
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.stamp_report() from public, anon, authenticated;

create trigger stamp_report before insert on public.reports
  for each row execute function public.stamp_report();
create trigger stamp_report before insert on public.auto_trips
  for each row execute function public.stamp_report();

-- Your own rows: see, add and delete them. Rows can't be edited, only deleted.
alter table public.reports enable row level security;
alter table public.auto_trips enable row level security;

create policy "see your own" on public.reports for select to authenticated using (user_id = (select auth.uid()));
create policy "add your own" on public.reports for insert to authenticated with check (user_id = (select auth.uid()));
create policy "delete your own" on public.reports for delete to authenticated using (user_id = (select auth.uid()));

create policy "see your own" on public.auto_trips for select to authenticated using (user_id = (select auth.uid()));
create policy "add your own" on public.auto_trips for insert to authenticated with check (user_id = (select auth.uid()));
create policy "delete your own" on public.auto_trips for delete to authenticated using (user_id = (select auth.uid()));

-- The phone may only send these columns; the rest are set by defaults and the
-- trigger. `id` is sent so a retry after a dropped connection can't add a duplicate.
revoke all on public.reports, public.auto_trips from anon, authenticated;
grant select, delete on public.reports, public.auto_trips to authenticated;
grant insert (id, item_id, area_id, price, paid, qty_label, shop, paid_at) on public.reports to authenticated;
grant insert (id, from_place, to_place, km, fare, night, paid_at) on public.auto_trips to authenticated;

-- Everyone's counted prices since `since` (at most 60 days back), without who
-- sent them. The caller's own rows are left out: the app already has them.
create function public.shared_reports(since timestamptz default now() - interval '40 days')
returns table (id uuid, item_id text, area_id text, price numeric, shop text, paid_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select r.id, r.item_id, r.area_id, r.price, r.shop, r.paid_at
  from public.reports r
  where r.paid_at >= greatest(since, now() - interval '60 days')
    and r.counts_from <= now()
    and r.user_id is distinct from auth.uid()
  order by r.paid_at, r.id;
$$;

create function public.shared_trips(since timestamptz default now() - interval '40 days')
returns table (id uuid, from_place text, to_place text, km numeric, fare numeric, night boolean, paid_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select t.id, t.from_place, t.to_place, t.km, t.fare, t.night, t.paid_at
  from public.auto_trips t
  where t.paid_at >= greatest(since, now() - interval '60 days')
    and t.counts_from <= now()
    and t.user_id is distinct from auth.uid()
  order by t.paid_at, t.id;
$$;

-- The same maths as fairPrice() in src/lib/stats.js. Outliers go by the
-- modified z-score 0.6745·(x − median)/MAD with |z| > 3.5 (or more than 50% from
-- the median when MAD is 0, and never with fewer than 4 prices). Then fair is
-- P25–P75 of what's left and typical is the median.
create function public.fair_range(prices numeric[])
returns table (low double precision, typical double precision, high double precision, n int, removed int)
language sql immutable set search_path = '' as $$
  with p as (select unnest(prices)::double precision as price),
  m as (select percentile_cont(0.5) within group (order by p.price) as med, count(*) as cnt from p),
  d as (select percentile_cont(0.5) within group (order by abs(p.price - m.med)) as mad from p, m),
  f as (
    select p.price,
      case when m.cnt < 4 then false
           when d.mad = 0 then abs(p.price - m.med) > m.med * 0.5
           else abs(0.6745 * (p.price - m.med) / d.mad) > 3.5 end as outlier
    from p, m, d
  )
  select percentile_cont(0.25) within group (order by f.price) filter (where not f.outlier),
         percentile_cont(0.5) within group (order by f.price) filter (where not f.outlier),
         percentile_cont(0.75) within group (order by f.price) filter (where not f.outlier),
         (count(*) filter (where not f.outlier))::int,
         (count(*) filter (where f.outlier))::int
  from f;
$$;

-- Fair price for one item near you. Uses the area's last 7 days when it has at
-- least 6 prices, else the whole city's 7 days, else the city's 30 days.
-- Returns no row when there are fewer than 3 prices.
create function public.fair_price(p_item text, p_area text, p_at timestamptz default now())
returns table (low double precision, typical double precision, high double precision, n int, removed int, scope text, days int)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_scope text := 'area';
  v_days int := 7;
  v_prices numeric[];
begin
  select array_agg(r.price) into v_prices from public.reports r
  where r.item_id = p_item and r.area_id = p_area and r.counts_from <= now()
    and r.paid_at >= p_at - interval '7 days' and r.paid_at <= p_at;

  if coalesce(cardinality(v_prices), 0) < 6 then
    v_scope := 'city';
    select array_agg(r.price) into v_prices from public.reports r
    where r.item_id = p_item and r.counts_from <= now()
      and r.paid_at >= p_at - interval '7 days' and r.paid_at <= p_at;
  end if;

  if coalesce(cardinality(v_prices), 0) < 6 then
    v_days := 30;
    select array_agg(r.price) into v_prices from public.reports r
    where r.item_id = p_item and r.counts_from <= now()
      and r.paid_at >= p_at - interval '30 days' and r.paid_at <= p_at;
  end if;

  if coalesce(cardinality(v_prices), 0) < 3 then
    return;
  end if;

  return query
    select f.low, f.typical, f.high, f.n, f.removed, v_scope, v_days from public.fair_range(v_prices) f;
end;
$$;

grant execute on function public.shared_reports(timestamptz), public.shared_trips(timestamptz),
  public.fair_range(numeric[]), public.fair_price(text, text, timestamptz) to anon, authenticated;

-- "Delete my data": removes the anonymous account, and with it every price it added.
create function public.delete_my_data() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke execute on function public.delete_my_data() from public, anon;
grant execute on function public.delete_my_data() to authenticated;
