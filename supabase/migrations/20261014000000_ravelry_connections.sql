-- Somewhere to keep a knitter's Ravelry refresh token, so Knitwit can read their library on their
-- behalf after sign-in is over.
--
-- Phase 0 of docs/plans/ravelry-import.md. Supabase hands the Ravelry `provider_refresh_token` to
-- the app exactly once, on the session that comes back from sign-in or linking, and stores it
-- nowhere. Anything that reads a knitter's projects or stash later — an import they run next week,
-- or on a schedule — needs the token to still exist. This is where it goes.
--
-- ## Why the client can never read this table
--
-- The refresh token is a long-lived key to someone's Ravelry account. Only the Edge Function that
-- calls Ravelry (running as the service role, which bypasses RLS) ever needs it. So RLS is enabled
-- with *no policy for `authenticated`*: the app can neither read nor write a row here, by default
-- deny. The function is also expected to store the token enveloped — this column holds ciphertext,
-- not the raw token — so a leak of the row is not a leak of the account.
--
-- One row per knitter: `user_id` is the primary key, so re-connecting overwrites rather than piles
-- up, and deleting the row (on disconnect, or when the account goes) is the whole of revocation on
-- our side.

create table if not exists public.ravelry_connections (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- Enveloped by the Edge Function before it ever reaches Postgres. Never the raw token.
  refresh_token text not null,
  -- Who this is on Ravelry, learned at connect from current_user.json. Handy for the import's API
  -- paths (which are keyed by username) without a round-trip, and for showing "connected as …".
  ravelry_user_id text not null default '',
  ravelry_username text not null default '',
  -- What the knitter actually granted. The import checks this before it tries to read something the
  -- grant does not cover, rather than discovering it in a 403.
  scopes text[] not null default '{}',
  connected_at timestamptz not null default now(),
  -- Owned by the database (see touch_updated_at in 20260916000000): bumped every time the token is
  -- refreshed and rewritten, so a stale row is visible as one that has not updated in a long time.
  updated_at timestamptz not null default now()
);

alter table public.ravelry_connections enable row level security;

-- Deliberately no policies: with RLS on and nothing granted, `authenticated` gets nothing. Only the
-- service role (the Edge Function) touches this table, and it bypasses RLS.

create trigger ravelry_connections_touch before insert or update on public.ravelry_connections
  for each row execute function public.touch_updated_at();
