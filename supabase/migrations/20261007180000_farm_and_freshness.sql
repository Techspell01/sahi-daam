-- Farm prices, and keeping every price as fresh as its source allows.
--
-- 1. rates also holds farm prices for Kerala, in rupees per kg: rubber (Rubber
--    Board, Kottayam), pepper, cardamom, nutmeg, mace and clove (Spices Board,
--    Kochi), and copra, coconut, arecanut, coffee, cocoa, cashew, paddy and
--    tapioca (Agmarknet). `source` says which.
-- 2. live_meta is one row: when the server last checked the sources
--    (checked_at) and when any price last changed (changed_at). Phones read it
--    every minute and only download prices when changed_at moves.
-- 3. The job runs in two tiers: gold and silver every 15 minutes (they change
--    during the day), and everything else every hour. The sources themselves
--    update daily (fuel at 6 am, markets once a day, LPG monthly), so fetching
--    more often wouldn't make anything more accurate.

alter table public.rates drop constraint rates_kind_check;
alter table public.rates add constraint rates_kind_check check (kind ~ '^[a-z0-9_]{2,30}$');

create table public.live_meta (
  id boolean primary key default true check (id), -- exactly one row
  checked_at timestamptz,
  changed_at timestamptz
);
insert into public.live_meta (checked_at, changed_at) values (now(), now());

alter table public.live_meta enable row level security;
create policy "anyone can read" on public.live_meta for select to anon, authenticated using (true);
revoke insert, update, delete, truncate on public.live_meta from anon, authenticated;

-- Any new price, or a changed one, moves changed_at. Row-level on purpose: an
-- upsert fires statement-level INSERT triggers even when every row already existed.
create function public.touch_live() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.live_meta set changed_at = now();
  return null;
end;
$$;
revoke execute on function public.touch_live() from public, anon, authenticated;

create trigger touch_live after insert on public.market_prices for each row execute function public.touch_live();
create trigger touch_live_update after update on public.market_prices for each row
  when (old.price is distinct from new.price or old.wholesale is distinct from new.wholesale) execute function public.touch_live();
create trigger touch_live after insert on public.fuel_prices for each row execute function public.touch_live();
create trigger touch_live_update after update on public.fuel_prices for each row
  when (old.price is distinct from new.price) execute function public.touch_live();
create trigger touch_live after insert on public.rates for each row execute function public.touch_live();
create trigger touch_live_update after update on public.rates for each row
  when (old.price is distinct from new.price) execute function public.touch_live();

-- The Edge Function calls this at the end of every run.
create function public.mark_checked() returns void
language sql security definer set search_path = '' as $$
  update public.live_meta set checked_at = now();
$$;
revoke execute on function public.mark_checked() from public, anon, authenticated;
grant execute on function public.mark_checked() to service_role;

-- refresh_prices() now takes a tier: 'fast' (gold, silver) or 'all'.
drop function public.refresh_prices();
create function public.refresh_prices(tier text default 'all') returns void
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
    body := jsonb_build_object('tier', tier),
    timeout_milliseconds := 120000
  );
end;
$$;
revoke execute on function public.refresh_prices(text) from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'sahidaam-refresh-prices';
select cron.schedule('sahidaam-refresh-fast', '*/15 * * * *', $$select public.refresh_prices('fast')$$);
select cron.schedule('sahidaam-refresh-all', '5 * * * *', $$select public.refresh_prices('all')$$);
