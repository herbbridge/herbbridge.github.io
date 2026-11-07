-- One-time, identity-bound enrolment after Supabase email confirmation.
-- User metadata is a UI hint only; it cannot set protected roles or approval.
begin;
create function public.complete_registration(
 p_account_role text,
 p_display_name text,
 p_category text default null,
 p_registration_reference text default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 caller uuid := auth.uid();
 confirmed timestamptz;
 existing public.profiles;
begin
 if caller is null then raise exception 'Sign in required' using errcode='42501'; end if;
 select email_confirmed_at into confirmed from auth.users where id=caller for update;
 if not found or confirmed is null then raise exception 'Email confirmation required' using errcode='42501'; end if;
 if p_account_role is null or p_account_role not in ('patient','practitioner') then
  raise exception 'Invalid account type' using errcode='22023';
 end if;
 select * into existing from public.profiles where id=caller;
 if found then
  if existing.account_role<>p_account_role then raise exception 'Account type is already set' using errcode='42501'; end if;
  return to_jsonb(existing);
 end if;
 if p_display_name is null or length(trim(p_display_name)) not between 1 and 120 then
  raise exception 'Display name required' using errcode='22023';
 end if;
 if p_account_role='practitioner' and (
  p_category is null or p_category not in ('western_medicine','chinese_medicine') or
  p_registration_reference is null or length(trim(p_registration_reference)) not between 1 and 160
 ) then raise exception 'Professional details required' using errcode='22023'; end if;
 insert into public.profiles(id,account_role,display_name)
  values(caller,p_account_role,trim(p_display_name)) returning * into existing;
 if p_account_role='practitioner' then
  insert into public.practitioner_accounts(id,category,approval_status) values(caller,p_category,'pending');
  insert into herbbridge_private.practitioner_applications(practitioner_id,registration_reference)
   values(caller,trim(p_registration_reference));
 end if;
 return to_jsonb(existing);
end $$;
revoke all on function public.complete_registration(text,text,text,text) from public,anon,authenticated;
grant execute on function public.complete_registration(text,text,text,text) to authenticated;
comment on function public.complete_registration(text,text,text,text) is 'Creates only the confirmed caller profile. Cannot set approval/admin status, target another account, or change an existing account type.';
commit;
