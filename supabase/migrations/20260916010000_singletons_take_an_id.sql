-- One shape for every synced table.
--
-- user_settings and achievements were made with `user_id` as the whole primary key, because there
-- is only ever one of each per knitter. True, and it cost more than it saved: the sync engine is
-- generic over `(user_id, id, data, updated_at, deleted_at)`, and two tables that are nearly that
-- shape mean a second code path for the sake of a column.
--
-- The id is constant. That is the point — it makes the singleton a collection of exactly one.

alter table public.user_settings add column if not exists id text not null default 'me';
alter table public.achievements add column if not exists id text not null default 'me';

alter table public.user_settings add column if not exists deleted_at timestamptz;
alter table public.achievements add column if not exists deleted_at timestamptz;

alter table public.user_settings drop constraint if exists user_settings_pkey;
alter table public.achievements drop constraint if exists achievements_pkey;

alter table public.user_settings add primary key (user_id, id);
alter table public.achievements add primary key (user_id, id);
