-- Run this once in your Supabase project:
-- Dashboard → SQL Editor → New query → paste → Run

-- Table to persist room state (handles late-joiners & page refreshes)
create table if not exists cobra_rooms (
  id          text primary key,
  data        jsonb not null,
  updated_at  timestamptz default now()
);

-- Allow anyone with the anon key to read/write rooms (it's a game, no auth needed)
alter table cobra_rooms enable row level security;

create policy "public read"  on cobra_rooms for select using (true);
create policy "public write" on cobra_rooms for insert with check (true);
create policy "public update" on cobra_rooms for update using (true);

-- Auto-clean rooms older than 2 hours so the table stays small
create or replace function delete_old_rooms() returns void language sql as $$
  delete from cobra_rooms where updated_at < now() - interval '2 hours';
$$;

-- Optional: schedule cleanup every hour via pg_cron (enable extension first)
-- select cron.schedule('cleanup-cobra-rooms', '0 * * * *', 'select delete_old_rooms()');
