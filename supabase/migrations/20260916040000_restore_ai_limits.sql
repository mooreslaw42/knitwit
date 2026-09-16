-- Restores the real allowances after a temporary lowering used to prove the cap bites.
--
-- The proof was worth having: with the anonymous limit set to 2, the third call in a row came back
-- 429 with a message a knitter can read, and the account — not the address — was what ran out.
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
