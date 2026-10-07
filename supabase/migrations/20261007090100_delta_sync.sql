-- Ready for more users.
--
-- 1. Phones fetch only the prices that became visible since their last fetch
--    (`after`), instead of 40 days of reports every time the app opens.
--    `visible_at` is when a price started counting (the later of when it arrived
--    and when its account turned 10 minutes old), rounded down to the minute so
--    it can't link prices from the same new account. Phones pass the newest
--    visible_at they have, minus a small margin, and drop duplicates by id. A
--    full fetch once a day picks up deleted prices.
-- 2. Pages continue from the last row of the previous page (`page_at`,
--    `page_id`) instead of an offset, so each page is one index range scan. These
--    functions can't be inlined, so with offsets every page re-ran the whole query.

drop function public.shared_reports(timestamptz);
drop function public.shared_trips(timestamptz);

create index reports_paid_at_id on public.reports (paid_at, id);
create index reports_counts_from on public.reports (counts_from);
create index auto_trips_paid_at_id on public.auto_trips (paid_at, id);
create index auto_trips_counts_from on public.auto_trips (counts_from);

create function public.shared_reports(
  since timestamptz default now() - interval '40 days',
  after timestamptz default null,
  page_at timestamptz default null,
  page_id uuid default null,
  page_size int default 1000
)
returns table (id uuid, item_id text, area_id text, price numeric, shop text, paid_at timestamptz, visible_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select r.id, r.item_id, r.area_id, r.price, r.shop, r.paid_at, date_trunc('minute', r.counts_from)
  from public.reports r
  where r.paid_at >= greatest(since, now() - interval '60 days')
    and r.counts_from <= now()
    and (after is null or r.counts_from >= after)
    and (page_at is null or (r.paid_at, r.id) > (page_at, page_id))
    and r.user_id is distinct from auth.uid()
  order by r.paid_at, r.id
  limit least(greatest(page_size, 1), 1000);
$$;

create function public.shared_trips(
  since timestamptz default now() - interval '40 days',
  after timestamptz default null,
  page_at timestamptz default null,
  page_id uuid default null,
  page_size int default 1000
)
returns table (id uuid, from_place text, to_place text, km numeric, fare numeric, night boolean, paid_at timestamptz, visible_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select t.id, t.from_place, t.to_place, t.km, t.fare, t.night, t.paid_at, date_trunc('minute', t.counts_from)
  from public.auto_trips t
  where t.paid_at >= greatest(since, now() - interval '60 days')
    and t.counts_from <= now()
    and (after is null or t.counts_from >= after)
    and (page_at is null or (t.paid_at, t.id) > (page_at, page_id))
    and t.user_id is distinct from auth.uid()
  order by t.paid_at, t.id
  limit least(greatest(page_size, 1), 1000);
$$;

grant execute on function public.shared_reports(timestamptz, timestamptz, timestamptz, uuid, int),
  public.shared_trips(timestamptz, timestamptz, timestamptz, uuid, int) to anon, authenticated;
