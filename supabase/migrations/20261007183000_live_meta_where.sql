-- Supabase's API connections load pg-safeupdate, which refuses UPDATE without a
-- WHERE clause, even inside a trigger. live_meta has one row (id = true), so
-- say so: without this, any new price failed its whole upsert.
create or replace function public.touch_live() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.live_meta set changed_at = now() where id;
  return null;
end;
$$;

create or replace function public.mark_checked() returns void
language sql security definer set search_path = '' as $$
  update public.live_meta set checked_at = now() where id;
$$;
