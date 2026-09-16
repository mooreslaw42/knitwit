-- Accounts, and somewhere for a knitter's work to live that is not one browser.
--
-- M1 of docs/plans/multi-user.md. Nothing reads or writes these tables yet: the app is still
-- entirely local. This exists first so that the sync engine has a settled shape to build against,
-- because every entity that changes shape after sync ships costs a migration on live data.
--
-- ## Why the payload is JSONB
--
-- Columns for what the *database* has to reason about — who owns it, when it changed, whether it is
-- deleted, whether it may be shared — and JSONB for everything only the *app* reasons about.
--
-- The alternative, a column per field, means a migration every time a yarn gains an attribute, and
-- this app's types are still moving. The cost is that you cannot query inside `data` without a
-- generated column, which is a fine trade while nothing needs to: sync only ever asks "what changed
-- since?", and that is answered entirely by the columns.
--
-- ## Why the primary key is composite
--
-- Ids come from the client, because a knitter makes a section on a train. They are unique *per
-- knitter*, not globally: the seed data ships the same `m1` and `proj1` to everybody, so a global
-- primary key would have the second person to sync collide with the first. `(user_id, id)` is the
-- honest key and needs no rewriting of ids that already exist on devices.

-- ---------------------------------------------------------------------------
-- updated_at belongs to the database, not the caller
--
-- A device with a wrong clock that can stamp its own timestamps wins every conflict it should lose,
-- and the symptom is a knitter's work quietly reverting. The trigger fires on insert as well as
-- update, so a client-supplied value is always overwritten rather than merely defaulted.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Who someone is

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "read own profile" on public.profiles
  for select to authenticated using (id = (select auth.uid()));

create policy "write own profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create trigger profiles_touch before insert or update on public.profiles
  for each row execute function public.touch_updated_at();

-- A profile exists from the moment an account does, including an anonymous one, so nothing has to
-- cope with a signed-in user who has no row yet.
create or replace function public.on_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  insert into public.subscriptions (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- What someone is entitled to
--
-- Readable by its owner and writable by nobody. There is deliberately no insert, update or delete
-- policy: only the service role reaches past RLS, so a plan can be granted by Stripe's webhook and
-- by nothing else. A paywall a client can write is not a paywall.

create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plan text not null default 'free',
  status text not null default 'inactive',
  current_period_end timestamptz,
  stripe_customer_id text,
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

create policy "read own subscription" on public.subscriptions
  for select to authenticated using (user_id = (select auth.uid()));

create trigger subscriptions_touch before insert or update on public.subscriptions
  for each row execute function public.touch_updated_at();

-- One definition of what somebody is entitled to, so RLS policies and Edge Functions cannot drift
-- apart about it. Returns the plan name; callers decide what a plan allows.
create or replace function public.plan_for(uid uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select plan from public.subscriptions
      where user_id = uid
        and status = 'active'
        and (current_period_end is null or current_period_end > now())),
    'free'
  );
$$;

create trigger on_auth_user_created_trigger
  after insert on auth.users
  for each row execute function public.on_auth_user_created();

-- ---------------------------------------------------------------------------
-- The knitter's own things
--
-- Every one of these has the same four columns for the same reasons, and a payload the database
-- does not look inside.

create table if not exists public.materials (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, id)
);

create table if not exists public.tools (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, id)
);

create table if not exists public.techniques (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, id)
);

-- `visibility` is a real column rather than a key in `data` because a sharing policy will have to
-- read it, and RLS cannot see inside JSONB cheaply. Nothing is public today and there is no policy
-- granting anyone else a read — that arrives with the feature, not before it.
create table if not exists public.patterns (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  data jsonb not null default '{}'::jsonb,
  visibility text not null default 'private'
    check (visibility in ('private', 'unlisted', 'public')),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, id)
);

create table if not exists public.pattern_sections (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  pattern_id text not null,
  -- Sections are ordered, and the order is the knitter's, so it travels as data rather than being
  -- inferred from anything.
  position integer not null default 0,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, id),
  foreign key (user_id, pattern_id) references public.patterns (user_id, id) on delete cascade
);

create table if not exists public.projects (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, id)
);

-- The one table whose shape was chosen rather than inherited.
--
-- A knitter taps the counter every few seconds, and that write lands here. Keeping sections out of
-- the project row means counting on a phone and editing that project's notes on a laptop touch
-- different records, so the commonest two-device situation is not a conflict at all.
create table if not exists public.project_sections (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  project_id text not null,
  position integer not null default 0,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, id),
  foreign key (user_id, project_id) references public.projects (user_id, id) on delete cascade
);

-- Time and rows per day. Additive on merge rather than last-write-wins: twenty minutes knitted on a
-- phone and ten on a laptop is thirty minutes, and replacing would throw a third of it away.
create table if not exists public.activity_days (
  user_id uuid not null references auth.users (id) on delete cascade,
  -- The date itself, 'YYYY-MM-DD', which is what makes a day idempotent to write.
  id text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, id)
);

-- One row each. Settings and awards are per knitter, not per thing, so they need no id — but they
-- keep the same columns so the sync engine can treat every table identically.
create table if not exists public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.achievements (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Owner-only, on everything, without exception
--
-- Anonymous accounts hold the `authenticated` role like anyone else, so these cover them too —
-- which is the point, since the whole migration path is that an anonymous account is a real one.
-- Where a throwaway account should be able to do *less* than a signed-in one, the policy will check
-- the `is_anonymous` claim. Nothing today needs that: reading and writing your own knitting is the
-- entire surface.
do $$
declare
  t text;
begin
  foreach t in array array[
    'materials', 'tools', 'techniques', 'patterns', 'pattern_sections',
    'projects', 'project_sections', 'activity_days', 'user_settings', 'achievements'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "own rows" on public.%I for all to authenticated
         using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    execute format(
      'create trigger %I before insert or update on public.%I
         for each row execute function public.touch_updated_at()', t || '_touch', t);
    -- The only query sync ever runs: everything of mine that changed since I last looked.
    execute format(
      'create index if not exists %I on public.%I (user_id, updated_at)', t || '_sync_idx', t);
  end loop;
end;
$$;

-- Ordering within a parent, which is how a section list is drawn.
create index if not exists pattern_sections_parent_idx
  on public.pattern_sections (user_id, pattern_id, position);
create index if not exists project_sections_parent_idx
  on public.project_sections (user_id, project_id, position);
