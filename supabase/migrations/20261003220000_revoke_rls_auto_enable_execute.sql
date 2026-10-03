-- 6: remove client access to public.rls_auto_enable(), if that function exists.
--
-- Functions in the "public" schema can be called through the Data API (as RPC) by any role
-- with EXECUTE. Postgres grants EXECUTE to PUBLIC by default, which includes anon and
-- authenticated. This helper is not meant to be called by app users, so take that away.
-- Only the privileges of these three roles change; the function itself is left untouched,
-- and nothing happens if it does not exist (safe to run on any project).

do $$
begin
  if pg_catalog.to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end;
$$;
