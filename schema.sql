-- Run in your Supabase SQL editor. This creates private per-account snapshots.
create table if not exists public.kitchen_state (
 user_id uuid primary key references auth.users(id) on delete cascade,
 data jsonb not null default '{}'::jsonb,
 updated_at timestamptz not null default now()
);
alter table public.kitchen_state enable row level security;
create policy "read own kitchen state" on public.kitchen_state for select to authenticated using ((select auth.uid()) = user_id);
create policy "insert own kitchen state" on public.kitchen_state for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "update own kitchen state" on public.kitchen_state for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
