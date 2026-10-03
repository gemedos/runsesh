-- 11: competitions (one active per party), final results (hall of fame), leader-only editing.
--
-- Every member takes part automatically. Only the leader creates, edits, ends or deletes the
-- active competition; everyone in the party can read it. When a competition ends, its
-- standings are frozen into competition_results (the calendar / hall of fame).
-- The ranking rules match js/rules/ranking.js: ties share a rank; days won and points 3-2-1
-- count each day's ranking among members with more than 0 steps; total steps sums all days.

create table public.competitions (
  id uuid primary key default gen_random_uuid(),
  party_id uuid not null references public.parties (id) on delete cascade,
  name text not null,
  start_day date not null,
  end_day date,
  mode text not null,
  golden boolean not null default false,
  theme text not null default 'circus',
  background_path text, -- leader's own photo in storage bucket competition-backgrounds
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  finalized_at timestamptz, -- set when the competition has ended and results are frozen

  constraint competitions_name_check check (name = btrim(name) and char_length(name) between 1 and 40),
  constraint competitions_dates_check check (end_day is null or end_day >= start_day),
  constraint competitions_mode_check check (mode in ('days_won', 'points_321', 'total_steps')),
  constraint competitions_theme_check check (theme in ('circus', 'spring', 'summer', 'fall', 'winter')),
  constraint competitions_background_check check (
    background_path is null
    or background_path ~ ('^' || party_id::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$')
  )
);

-- Only one competition at a time per party.
create unique index competitions_one_active_per_party on public.competitions (party_id) where finalized_at is null;
create index competitions_party_idx on public.competitions (party_id, start_day);

create table public.competition_results (
  competition_id uuid not null references public.competitions (id) on delete cascade,
  -- Deleting an account also deletes that person's results.
  user_id uuid not null references auth.users (id) on delete cascade,
  display_name text, -- snapshot at the end of the competition
  avatar jsonb,      -- snapshot (validated by private.is_valid_avatar)
  rank integer not null,
  score integer not null,
  primary key (competition_id, user_id),

  constraint competition_results_avatar_check check (avatar is null or private.is_valid_avatar(avatar)),
  constraint competition_results_rank_check check (rank >= 1 and score >= 0)
);

-- Privileges: members read; the leader writes competitions (column-limited); results are
-- written only by the finalize function.
revoke all on table public.competitions from public, anon, authenticated;
revoke all on table public.competition_results from public, anon, authenticated;
grant select, delete on table public.competitions to authenticated;
grant insert (party_id, name, start_day, end_day, mode, golden, theme) on table public.competitions to authenticated;
grant update (name, start_day, end_day, mode, golden, theme, background_path) on table public.competitions to authenticated;
grant select on table public.competition_results to authenticated;

alter table public.competitions enable row level security;
alter table public.competition_results enable row level security;

create policy "competitions: members read"
  on public.competitions for select to authenticated
  using (party_id = (select private.my_party_id()));

create policy "competitions: leader creates"
  on public.competitions for insert to authenticated
  with check ((select private.is_party_leader(party_id)));

create policy "competitions: leader edits the active one"
  on public.competitions for update to authenticated
  using ((select private.is_party_leader(party_id)) and finalized_at is null)
  with check ((select private.is_party_leader(party_id)) and finalized_at is null);

create policy "competitions: leader deletes the active one"
  on public.competitions for delete to authenticated
  using ((select private.is_party_leader(party_id)) and finalized_at is null);

create policy "competition_results: members read"
  on public.competition_results for select to authenticated
  using (exists (
    select 1 from public.competitions c
    where c.id = competition_id and c.party_id = (select private.my_party_id())
  ));

-- ---------------------------------------------------------------------------
-- Freezing results. SECURITY DEFINER (writes competition_results, which clients cannot
-- write; approved under CLAUDE.md §4 on 2026-10-05). Results include the members of the
-- party at the moment the competition ends.
-- ---------------------------------------------------------------------------

create or replace function private.finalize_competition(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.competitions%rowtype;
begin
  select * into c from public.competitions where id = p_id for update;
  if not found or c.finalized_at is not null or c.end_day is null then return; end if;

  insert into public.competition_results (competition_id, user_id, display_name, avatar, rank, score)
  with days as (
    select d::date as day from pg_catalog.generate_series(c.start_day, c.end_day, interval '1 day') as d
  ),
  members as (
    select pm.user_id from public.party_members pm where pm.party_id = c.party_id
  ),
  grid as (
    select m.user_id, days.day, coalesce(ds.steps, 0) as steps
    from members m
    cross join days
    left join public.daily_steps ds on ds.user_id = m.user_id and ds.day = days.day
  ),
  day_rank as (
    select g.user_id, g.day, pg_catalog.rank() over (partition by g.day order by g.steps desc) as r
    from grid g
    where g.steps > 0
  ),
  scores as (
    select m.user_id,
      case c.mode
        when 'total_steps' then (select coalesce(sum(g.steps), 0) from grid g where g.user_id = m.user_id)
        when 'days_won' then (select count(*) from day_rank dr where dr.user_id = m.user_id and dr.r = 1)
        else (select coalesce(sum(case dr.r when 1 then 3 when 2 then 2 when 3 then 1 else 0 end), 0)
              from day_rank dr where dr.user_id = m.user_id)
      end::integer as score
    from members m
  )
  select p_id, s.user_id, pr.display_name, pr.avatar,
         (pg_catalog.rank() over (order by s.score desc))::integer, s.score
  from scores s
  left join public.profiles pr on pr.id = s.user_id;

  update public.competitions set finalized_at = pg_catalog.now() where id = p_id;
end;
$$;
revoke all on function private.finalize_competition(uuid) from public, anon, authenticated;

/** Leader only: end the active competition now (last day = today, UTC) and freeze results. */
create or replace function public.end_competition(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.competitions%rowtype;
  today_utc date := (pg_catalog.now() at time zone 'UTC')::date;
begin
  select * into c from public.competitions where id = p_id and finalized_at is null;
  if not found or not private.is_party_leader(c.party_id) then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;
  if c.start_day > today_utc then
    raise exception 'not_started' using errcode = 'P0001'; -- the leader can delete it instead
  end if;
  update public.competitions set end_day = least(coalesce(c.end_day, today_utc), today_utc) where id = p_id;
  perform private.finalize_competition(p_id);
end;
$$;

/** Any member: freeze the party's competition once its last day is over. Safe to call often. */
create or replace function public.finalize_due_competitions()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  today_utc date := (pg_catalog.now() at time zone 'UTC')::date;
  pid uuid := private.my_party_id();
  cid uuid;
  n integer := 0;
begin
  if pid is null then return 0; end if;
  for cid in
    select id from public.competitions
    where party_id = pid and finalized_at is null and end_day is not null and end_day < today_utc
  loop
    perform private.finalize_competition(cid);
    n := n + 1;
  end loop;
  return n;
end;
$$;

revoke all on function public.end_competition(uuid) from public, anon;
revoke all on function public.finalize_due_competitions() from public, anon;
grant execute on function public.end_competition(uuid) to authenticated;
grant execute on function public.finalize_due_competitions() to authenticated;
