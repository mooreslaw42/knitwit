-- A daily spend cap on the AI endpoint.
--
-- The app has no accounts, so the publishable key that reaches the Edge Function ships inside the
-- client bundle where anyone can read it. Until there is auth, that key is the only thing standing
-- between a stranger and the model bill: at the ceilings the function sets, one document parse can
-- cost €0.16, and a script making five a second would run to roughly €2,800 an hour.
--
-- So calls are counted in units rather than requests — a whole-document parse is worth ten yarn
-- photos because it costs about a hundred times as much — and counted twice over: once against the
-- caller's IP, so one person cannot drink the well, and once globally, which is the number that
-- actually bounds the bill when the IPs are many.
--
-- This is a cap, not authentication. It makes abuse tedious and bounded rather than impossible.
-- Real per-user limits belong with real users.

create table if not exists public.ai_usage (
  day date not null default current_date,
  -- Either an IP, or the literal 'global' for the all-callers total.
  bucket text not null,
  units integer not null default 0,
  primary key (day, bucket)
);

-- Read and write only through the function below, which runs as its owner. No policies are
-- created, so with RLS on, anon and authenticated can do nothing here directly — the counter is
-- not something a caller should be able to read, reset, or pad.
alter table public.ai_usage enable row level security;

-- Claims `p_units` for one call, against both the caller and the global total.
--
-- Returns 'ok', or which ceiling was hit. The two upserts are one statement each inside a single
-- function call, so two requests arriving together cannot both read an under-limit count and both
-- proceed: the row lock taken by the first upsert holds the second until it commits.
create or replace function public.claim_ai_units(
  p_bucket text,
  p_units integer,
  p_bucket_limit integer,
  p_global_limit integer
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_global integer;
  v_bucket integer;
begin
  -- Global first. A caller who is refused should not have their own allowance charged for a call
  -- that never happens.
  insert into public.ai_usage (day, bucket, units)
  values (current_date, 'global', p_units)
  on conflict (day, bucket) do update set units = public.ai_usage.units + p_units
  returning units into v_global;

  if v_global > p_global_limit then
    return 'global';
  end if;

  insert into public.ai_usage (day, bucket, units)
  values (current_date, p_bucket, p_units)
  on conflict (day, bucket) do update set units = public.ai_usage.units + p_units
  returning units into v_bucket;

  if v_bucket > p_bucket_limit then
    return 'bucket';
  end if;

  return 'ok';
end;
$$;

-- Only the service role calls this, and only from the Edge Function. Revoking the default grant
-- matters: without it any holder of the public key could spend the budget without using the app.
revoke all on function public.claim_ai_units(text, integer, integer, integer) from public;
revoke all on function public.claim_ai_units(text, integer, integer, integer) from anon;
revoke all on function public.claim_ai_units(text, integer, integer, integer) from authenticated;
grant execute on function public.claim_ai_units(text, integer, integer, integer) to service_role;

-- Yesterday's counters are of no interest once the day turns. Kept for a week so a spike can be
-- looked at after the fact, then dropped by whatever runs next.
create index if not exists ai_usage_day_idx on public.ai_usage (day);
