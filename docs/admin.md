# Admin tasks (Supabase dashboard)

Things only the project owner does, in the Supabase dashboard. Players can never do them: the
database refuses these changes from the app or the public API.

## Manual step entry (typing steps in by hand)
A player may type in steps only when **both** switches are on
(migration `20261007120100_manual_entry_switches.sql`):

| Switch | Where | Default |
|---|---|---|
| Global | `app_settings.manual_entry` (one row) | on |
| Per player | `user_settings.manual_entry` (one row per player) | **no row = off** |

When it is off for a player, the Health connect screen hides the form and tells them to connect
their phone; any write they try through the API is refused. Phone syncing is never affected.

SQL editor:
```sql
-- See every player and whether they may type in steps
select p.display_name, p.id as user_id, coalesce(u.manual_entry, false) as manual_entry
from public.profiles p left join public.user_settings u on u.user_id = p.id
order by p.display_name;

-- Allow one player (replace the uid)
insert into public.user_settings (user_id, manual_entry) values ('<uid>', true)
on conflict (user_id) do update set manual_entry = true, updated_at = now();

-- Stop one player
update public.user_settings set manual_entry = false, updated_at = now() where user_id = '<uid>';

-- Global: off for everyone / back on (per-player switches then apply again)
update public.app_settings set manual_entry = false, updated_at = now();
update public.app_settings set manual_entry = true,  updated_at = now();
```
Or in the Table Editor: open `user_settings`, **Insert row** (user_id + manual_entry = true), or
tick/untick `manual_entry` on an existing row. The app picks the change up the next time the
player opens Health connect.

## Entering past days for players
The database only accepts days from 3 days ago to tomorrow (UTC). To add older days, run a
one-off import that switches the guard off **inside one transaction** and back on before
`commit` (if anything fails, everything is undone). Mark such rows with source `admin`:
players cannot write `admin` rows or overwrite them.
```sql
begin;
create temp table import_steps (user_id uuid, day date, steps integer) on commit drop;
insert into import_steps (user_id, day, steps) values
  ('<uid>', '2026-10-01', 12345);   -- one row per player and day; last row ends with ;

do $$
begin
  if exists (select 1 from import_steps i where not exists (select 1 from public.profiles p where p.id = i.user_id)) then
    raise exception 'Unknown user id in the import list';
  end if;
  if exists (select 1 from import_steps where steps is null or steps < 0 or steps > 100000 or day is null or day > current_date) then
    raise exception 'Invalid steps or day in the import list';
  end if;
  if exists (select 1 from import_steps group by user_id, day having count(*) > 1) then
    raise exception 'The same user and day appear twice';
  end if;
end $$;

alter table public.daily_steps disable trigger daily_steps_guard;
insert into public.daily_steps (user_id, day, steps, source)
select user_id, day, steps, 'admin' from import_steps
on conflict (user_id, day) do update set steps = excluded.steps, source = excluded.source, updated_at = now();
alter table public.daily_steps enable trigger daily_steps_guard;
commit;

-- Afterwards: the guard must be back on (expect 'O')
select tgenabled from pg_trigger where tgname = 'daily_steps_guard';
```
A competition only counts days from its start date, so check it starts early enough.
