-- How many people use the app: here now (seen in the last 5 minutes), today
-- (India time) and in all. Each phone makes up a random id and sends it when
-- the app opens and every few minutes while it's open. No account, no IP, no
-- location, and the id isn't linked to anything else.
create table public.visitors (
  id uuid primary key,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now()
);
create index visitors_last_seen on public.visitors (last_seen);
create index visitors_first_seen on public.visitors (first_seen);

create table public.visits (
  day date not null,
  visitor uuid not null references public.visitors (id) on delete cascade,
  primary key (day, visitor)
);

-- The counts, worked out at most every 30 seconds so a busy minute doesn't
-- mean thousands of count(*) queries.
create table public.usage_stats (
  id boolean primary key default true check (id),
  here_now integer not null default 0,
  today integer not null default 0,
  total integer not null default 0,
  at timestamptz not null default '-infinity'
);
insert into public.usage_stats default values;

alter table public.visitors enable row level security;
alter table public.visits enable row level security;
alter table public.usage_stats enable row level security;
revoke all on public.visitors, public.visits, public.usage_stats from anon, authenticated;

create or replace function public.visit(v uuid)
returns json language plpgsql security definer set search_path = '' as $$
declare
  d date := (now() at time zone 'Asia/Kolkata')::date;
  s public.usage_stats;
begin
  if v is null then raise exception 'visitor id needed'; end if;

  -- A script making up ids could inflate the count, so new visitors beyond 300
  -- a minute aren't counted. (Old ones still are.)
  if exists (select 1 from public.visitors where id = v)
     or (select count(*) from public.visitors where first_seen > now() - interval '1 minute') < 300 then
    insert into public.visitors (id) values (v)
      on conflict (id) do update set last_seen = now()
      where public.visitors.last_seen < now() - interval '1 minute';
    insert into public.visits (day, visitor) values (d, v) on conflict do nothing;
  end if;

  -- Only one caller recounts; the others see the row already fresh and skip it.
  update public.usage_stats set
    here_now = (select count(*) from public.visitors where last_seen > now() - interval '5 minutes'),
    today = (select count(*) from public.visits where day = d),
    total = (select count(*) from public.visitors),
    at = now()
  where id and at < now() - interval '30 seconds';

  select * into s from public.usage_stats where id;
  return json_build_object('now', s.here_now, 'today', s.today, 'total', s.total);
end $$;

revoke all on function public.visit(uuid) from public;
grant execute on function public.visit(uuid) to anon, authenticated;
