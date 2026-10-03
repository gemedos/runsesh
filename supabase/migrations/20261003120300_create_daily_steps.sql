-- 4/5: daily step totals per user and day.
-- Step values are self-reported by the user's device and can be faked; see docs/security-notes.md.

create table public.daily_steps (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  steps integer not null,
  source text not null,
  updated_at timestamptz not null default now(),

  primary key (user_id, day),
  constraint daily_steps_steps_check check (steps between 0 and 100000),
  constraint daily_steps_source_check check (source in ('manual', 'health_connect', 'shortcut'))
);

comment on table public.daily_steps is 'Daily step totals. Self-reported; limits only stop casual abuse.';

-- Privileges: default deny; logged-out users (anon) get nothing.
-- Update is granted on the whole table because the client saves with an upsert
-- (INSERT ... ON CONFLICT DO UPDATE), which needs it; the trigger in the next
-- migration forbids changing user_id or day on update.
revoke all on table public.daily_steps from public, anon, authenticated;
grant select, insert, update on table public.daily_steps to authenticated;

alter table public.daily_steps enable row level security;

-- Phase 3 will extend SELECT so members of the same party can read each other's totals.
create policy "daily_steps: select own rows"
  on public.daily_steps for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "daily_steps: insert own rows"
  on public.daily_steps for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "daily_steps: update own rows"
  on public.daily_steps for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- No delete policy: clients cannot delete rows.
