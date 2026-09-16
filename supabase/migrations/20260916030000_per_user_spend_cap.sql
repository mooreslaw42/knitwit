-- The spend cap moves from an address to an account.
--
-- M5 of docs/plans/multi-user.md. The IP bucket was the right thing when there were no accounts and
-- the wrong thing the moment there were: it throttles a household sharing a connection as though
-- they were one person, it cannot tell a paying knitter from a stranger, and a phone that changes
-- network gets a fresh allowance for free. None of that is fixable while the only thing known about
-- a caller is where they are.
--
-- Now there is a user id, so the question becomes what that user is entitled to — and that answer
-- lives in one place, next to `plan_for`, rather than as a number in the Edge Function that
-- inevitably drifts from the one in the policy.

-- What a plan is allowed to spend in a day, in the units the Edge Function counts.
--
-- Anonymous accounts get less, deliberately. They cost nothing to make, so an allowance attached to
-- one is an allowance anybody can mint again by clearing their storage. Enough for a real day's
-- knitting, not enough to be worth farming — and signing in raises it, which is an honest reason to.
create or replace function public.ai_daily_limit(p_plan text, p_anonymous boolean)
returns integer
language sql
immutable
as $$
  select case
    when p_plan = 'pro' then 1500
    when p_anonymous then 60
    else 150
  end;
$$;

-- Claims budget for one call and says what happened.
--
-- Everything the decision needs is here rather than split between this and the caller: the plan
-- lookup, the limit, both counters. The Edge Function passes a user and a cost and is told yes or
-- no, so there is no second definition of the rules to keep in step.
create or replace function public.claim_ai_units_for_user(
  p_user uuid,
  p_units integer,
  p_anonymous boolean,
  p_global_limit integer
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan text;
  v_limit integer;
  v_global integer;
  v_used integer;
begin
  v_plan := public.plan_for(p_user);
  v_limit := public.ai_daily_limit(v_plan, p_anonymous);

  -- Global first, so a caller who is about to be refused is not charged their own allowance for a
  -- call that never happens.
  insert into public.ai_usage (day, bucket, units)
  values (current_date, 'global', p_units)
  on conflict (day, bucket) do update set units = public.ai_usage.units + p_units
  returning units into v_global;

  if v_global > p_global_limit then
    return jsonb_build_object('ok', false, 'reason', 'global', 'plan', v_plan);
  end if;

  insert into public.ai_usage (day, bucket, units)
  values (current_date, p_user::text, p_units)
  on conflict (day, bucket) do update set units = public.ai_usage.units + p_units
  returning units into v_used;

  if v_used > v_limit then
    return jsonb_build_object(
      'ok', false, 'reason', 'user', 'plan', v_plan, 'used', v_used, 'limit', v_limit
    );
  end if;

  return jsonb_build_object(
    'ok', true, 'plan', v_plan, 'used', v_used, 'limit', v_limit
  );
end;
$$;

-- As with the counter itself: only the service role, reached only from the Edge Function. A caller
-- who can grant themselves budget does not have a budget.
revoke all on function public.claim_ai_units_for_user(uuid, integer, boolean, integer) from public;
revoke all on function public.claim_ai_units_for_user(uuid, integer, boolean, integer) from anon;
revoke all on function public.claim_ai_units_for_user(uuid, integer, boolean, integer) from authenticated;
grant execute on function public.claim_ai_units_for_user(uuid, integer, boolean, integer) to service_role;

revoke all on function public.ai_daily_limit(text, boolean) from public;
revoke all on function public.ai_daily_limit(text, boolean) from anon;
grant execute on function public.ai_daily_limit(text, boolean) to service_role;
