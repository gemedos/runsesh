-- 10: party members can see each other's profile and daily step totals.
-- Policies are permissive (OR-ed with the existing "own row" policies). Writes are unchanged:
-- everyone can still only update their own profile and steps.
-- Note: a profile row holds display_name, avatar and timezone; party members can read all three.
-- Email lives in auth.users and is never readable by other users.

create policy "profiles: read party members"
  on public.profiles for select to authenticated
  using ((select private.shares_party(id)));

create policy "daily_steps: read party members"
  on public.daily_steps for select to authenticated
  using ((select private.shares_party(user_id)));
