-- Security hardening (quick security check, 8 Nov 2026).
-- The hosted project contains a platform-provided event-trigger function public.rls_auto_enable()
-- (auto-enables RLS on new public tables). Supabase's Security Advisor flagged it as executable by
-- anon and authenticated. Event triggers run without these grants, so revoking them changes nothing
-- for the app and removes the warning. Safe no-op where the function does not exist (local tests).
begin;
do $$
begin
 if exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='rls_auto_enable' and pg_get_function_identity_arguments(p.oid)='') then
  execute 'revoke all on function public.rls_auto_enable() from public, anon, authenticated';
 end if;
end$$;
commit;
