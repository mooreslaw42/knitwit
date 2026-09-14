-- The shared technique catalogue.
--
-- One row per technique, identical for every knitter. What a knitter records *about* a technique
-- — whether they want to learn it, are learning it, or have it — stays on their device against
-- the slug below. This table holds only what is true for everyone.
--
-- `id` is a slug and is a foreign key in saved patterns, projects and achievement tallies. It is
-- never renamed. Names, summaries, videos and links can be edited freely.

create table if not exists public.technique_catalogue (
  id          text primary key,
  name        text not null,
  craft       text not null check (craft in ('knit', 'crochet', 'both')),
  family      text not null check (family in (
                'cast-on', 'bind-off', 'increase', 'decrease', 'joining',
                'colourwork', 'shaping', 'texture', 'finishing', 'other')),
  summary     text not null default '',
  -- What patterns actually call it. Used to match a technique named in imported text back to this
  -- row, so two patterns that both say "grafting" land on the same entry.
  aliases     text[] not null default '{}',
  video       text not null default '',
  link        text not null default '',
  updated_at  timestamptz not null default now()
);

-- Read-only to everyone, including anonymous. The anon key ships in the client bundle, so this
-- table must be safe to read with it and impossible to write with it. Edits happen through the
-- Supabase dashboard or a migration, never from the app.
alter table public.technique_catalogue enable row level security;

drop policy if exists "technique catalogue is world readable" on public.technique_catalogue;
create policy "technique catalogue is world readable"
  on public.technique_catalogue for select
  to anon, authenticated
  using (true);

create index if not exists technique_catalogue_craft_idx on public.technique_catalogue (craft);
create index if not exists technique_catalogue_family_idx on public.technique_catalogue (family);
