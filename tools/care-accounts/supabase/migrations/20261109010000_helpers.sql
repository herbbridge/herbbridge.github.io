-- Helper accounts (goal 16): a patient can let a family member or carer (姑娘) help keep their medicine list.
-- Helpers are NOT verified professionals. The patient invites them with a one-time link, chooses view or
-- edit, and can remove them at any time; a helper can also leave. Helpers never see practitioners' tags or
-- the practitioner list, cannot invite anyone, and cannot propose reminders or tools.
begin;

-- 1. Accounts: a new 'helper' account type. Patient accounts can also be helpers (e.g. a spouse).
do $$declare c text;begin
 select conname into c from pg_constraint where conrelid='public.profiles'::regclass and contype='c' and pg_get_constraintdef(oid) like '%account_role%' and pg_get_constraintdef(oid) like '%patient%';
 execute format('alter table public.profiles drop constraint %I',c);
end$$;
alter table public.profiles add constraint profiles_account_role_check check (account_role in ('patient','practitioner','helper'));

create or replace function public.complete_registration(
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
 if p_account_role is null or p_account_role not in ('patient','practitioner','helper') then
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

-- 2. Who helps whom. Clients cannot read or write this table directly; everything goes through functions.
create table public.room_helpers (
 id uuid primary key default gen_random_uuid(),
 room_id uuid not null references public.care_rooms(id),
 helper_id uuid not null references public.profiles(id),
 access_level text not null default 'view' check (access_level in ('view','edit')),
 helper_status text not null default 'active' check (helper_status in ('active','revoked')),
 added_at timestamptz not null default now(),
 revoked_at timestamptz,
 unique (room_id, helper_id),
 check ((helper_status='revoked') = (revoked_at is not null))
);
create index room_helpers_by_helper on public.room_helpers(helper_id, helper_status);
alter table public.room_helpers enable row level security;
revoke all on public.room_helpers from public, anon, authenticated;

-- Database-level guard (also covers privileged writes): never the patient themself, never a practitioner,
-- at most 3 active helpers per patient and 10 patients per helper.
create function herbbridge_private.check_helper() returns trigger language plpgsql security definer set search_path='' as $$
declare patient uuid;role text;
begin
 if tg_op='UPDATE' and (new.room_id<>old.room_id or new.helper_id<>old.helper_id) then
  raise exception 'Helper identity is immutable' using errcode='23514';
 end if;
 select patient_id into strict patient from public.care_rooms where id=new.room_id;
 perform id from public.profiles where id in (patient,new.helper_id) order by id for update;
 if new.helper_id=patient then raise exception 'A patient cannot be their own helper' using errcode='23514'; end if;
 select account_role into role from public.profiles where id=new.helper_id;
 if role is null or role not in ('patient','helper') then raise exception 'Helpers must use a patient or helper account' using errcode='23514'; end if;
 if new.helper_status='active' then
  if (select count(*) from public.room_helpers where room_id=new.room_id and helper_status='active' and id<>new.id)>=3 then
   raise exception 'Helper limit reached' using errcode='23514'; end if;
  if (select count(*) from public.room_helpers where helper_id=new.helper_id and helper_status='active' and id<>new.id)>=10 then
   raise exception 'Helped patient limit reached' using errcode='23514'; end if;
 end if;
 return new;
end$$;
revoke all on function herbbridge_private.check_helper() from public,anon,authenticated;
create trigger check_helper before insert or update on public.room_helpers for each row execute function herbbridge_private.check_helper();

-- 3. Invitations: patients create 'helper_offer' links for their own room with a chosen access level.
alter table herbbridge_private.connection_invitations add column offered_access text check (offered_access in ('view','edit'));
do $$declare c record;begin
 for c in select conname,pg_get_constraintdef(oid) d from pg_constraint where conrelid='herbbridge_private.connection_invitations'::regclass and contype='c'
  and (pg_get_constraintdef(oid) like '%invitation_type%') loop
  execute format('alter table herbbridge_private.connection_invitations drop constraint %I',c.conname);
 end loop;
end$$;
alter table herbbridge_private.connection_invitations add constraint connection_invitations_type_check
 check (invitation_type in ('patient_offer','practitioner_offer','helper_offer'));
alter table herbbridge_private.connection_invitations add constraint connection_invitations_shape_check
 check ((invitation_type='patient_offer' and room_id is not null and offered_access is null) or
        (invitation_type='practitioner_offer' and room_id is null and practitioner_id is not null and offered_access is null) or
        (invitation_type='helper_offer' and room_id is not null and practitioner_id is null and offered_access is not null));

-- 4. Room events gain helper events.
do $$declare c text;begin
 select conname into c from pg_constraint where conrelid='public.room_events'::regclass and contype='c' and pg_get_constraintdef(oid) like '%event_type%';
 execute format('alter table public.room_events drop constraint %I',c);
end$$;
alter table public.room_events add constraint room_events_event_type_check check (event_type in
 ('connected','access_changed','disconnected','list_saved','tool_proposed','tool_accepted','tool_declined','tool_paused','tool_resumed','tool_removed',
  'helper_added','helper_access_changed','helper_removed'));

-- 5. Access rules now include active helpers. Same signatures, so existing policies pick them up.
create or replace function herbbridge_private.helper_active(target_room uuid,actor uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.room_helpers h where h.room_id=target_room and h.helper_id=actor and h.helper_status='active')
$$;
revoke all on function herbbridge_private.helper_active(uuid,uuid) from public,anon,authenticated;

create or replace function herbbridge_private.can_read_room(target_room uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.care_rooms r where r.id=target_room and
 (r.patient_id=(select auth.uid())
  or exists(select 1 from public.room_memberships m where m.room_id=r.id and m.practitioner_id=(select auth.uid()) and m.membership_status='active'
   and herbbridge_private.practitioner_active(m.practitioner_id))
  or herbbridge_private.helper_active(r.id,(select auth.uid()))))
$$;
-- Patients and their helpers can see each other's display names; helpers and practitioners cannot.
create or replace function herbbridge_private.can_read_profile(target_profile uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select target_profile=(select auth.uid()) or exists(select 1 from public.care_rooms r
 join public.room_memberships m on m.room_id=r.id where m.membership_status='active'
 and herbbridge_private.practitioner_active(m.practitioner_id) and
 ((r.patient_id=(select auth.uid()) and m.practitioner_id=target_profile) or
 (m.practitioner_id=(select auth.uid()) and r.patient_id=target_profile)))
 or exists(select 1 from public.care_rooms r join public.room_helpers h on h.room_id=r.id where h.helper_status='active' and
 ((r.patient_id=(select auth.uid()) and h.helper_id=target_profile) or (h.helper_id=(select auth.uid()) and r.patient_id=target_profile)))
$$;
create or replace function herbbridge_private.room_editable(target_room uuid,actor uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.care_rooms r where r.id=target_room and
 (r.patient_id=actor
  or exists(select 1 from public.room_memberships m where m.room_id=r.id and m.practitioner_id=actor
   and m.membership_status='active' and m.access_level='edit' and herbbridge_private.practitioner_active(actor))
  or exists(select 1 from public.room_helpers h where h.room_id=r.id and h.helper_id=actor and h.helper_status='active' and h.access_level='edit')))
$$;

-- 5b. Direct table reads. can_read_room now includes helpers, so the room and its medicines are readable
-- by them. Events, list versions, practitioner tools and completions stay care-team only (patient
-- and connected practitioners), so a helper cannot learn who the practitioners are by reading tables directly.
create function herbbridge_private.can_read_room_care_team(target_room uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.care_rooms r where r.id=target_room and
 (r.patient_id=(select auth.uid()) or exists(select 1 from public.room_memberships m
 where m.room_id=r.id and m.practitioner_id=(select auth.uid()) and m.membership_status='active'
 and herbbridge_private.practitioner_active(m.practitioner_id))))
$$;
revoke all on function herbbridge_private.can_read_room_care_team(uuid) from public,anon,authenticated;
grant execute on function herbbridge_private.can_read_room_care_team(uuid) to authenticated;
drop policy events_visibility on public.room_events;
create policy events_visibility on public.room_events for select to authenticated using (herbbridge_private.can_read_room_care_team(room_id));
drop policy versions_visibility on public.medicine_list_versions;
create policy versions_visibility on public.medicine_list_versions for select to authenticated using (herbbridge_private.can_read_room_care_team(room_id));
drop policy tools_visibility on public.patient_tools;
create policy tools_visibility on public.patient_tools for select to authenticated using (herbbridge_private.can_read_room_care_team(room_id));
drop policy completions_visibility on public.tool_completions;
create policy completions_visibility on public.tool_completions for select to authenticated using (
 exists(select 1 from public.patient_tools t where t.id=tool_id and herbbridge_private.can_read_room_care_team(t.room_id))
);

-- 6. Patient: create a helper link (24 hours, one use).
create function public.create_helper_invitation(access_level text) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=herbbridge_private.confirmed_actor();r public.care_rooms;token text;inv herbbridge_private.connection_invitations;
begin
 if not exists(select 1 from public.profiles where id=actor and account_role='patient') then raise exception 'patient_account_required' using errcode='42501';end if;
 if access_level is null or access_level not in ('view','edit') then raise exception 'invalid_access' using errcode='22023';end if;
 perform 1 from public.profiles where id=actor for update;
 if (select count(*) from herbbridge_private.connection_invitations where created_by=actor and created_at>now()-interval '1 minute')>=3
 or (select count(*) from herbbridge_private.connection_invitations where created_by=actor and created_at>now()-interval '24 hours')>=20 then
  return jsonb_build_object('error','invite_rate_limit');end if;
 perform public.ensure_care_room();select * into r from public.care_rooms where patient_id=actor;
 if (select count(*) from public.room_helpers where room_id=r.id and helper_status='active')>=3 then return jsonb_build_object('error','helper_limit');end if;
 token:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
 insert into herbbridge_private.connection_invitations(token_hash,invitation_type,created_by,room_id,offered_access)
 values(sha256(convert_to(token,'UTF8')),'helper_offer',actor,r.id,create_helper_invitation.access_level) returning * into inv;
 return jsonb_build_object('id',inv.id,'token',token,'expires_at',inv.expires_at,'access_level',inv.offered_access);
end$$;

-- Helper: see whose list the link is for before agreeing. Never returns the list itself.
create function public.preview_helper_invitation(invitation_token text) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=herbbridge_private.confirmed_actor();inv herbbridge_private.connection_invitations;
begin
 if not exists(select 1 from public.profiles where id=actor and account_role in ('patient','helper')) then raise exception 'helper_account_required' using errcode='42501';end if;
 if not herbbridge_private.invitation_attempt_allowed(actor) then return jsonb_build_object('error','invite_rate_limit');end if;
 if invitation_token is null or invitation_token!~'^[0-9a-f]{64}$' then return jsonb_build_object('error','invalid_invitation');end if;
 select * into inv from herbbridge_private.connection_invitations where token_hash=sha256(convert_to(invitation_token,'UTF8'));
 if not found or inv.invitation_type<>'helper_offer' or inv.invitation_status<>'pending' or inv.expires_at<=now() then return jsonb_build_object('error','invalid_invitation');end if;
 if inv.created_by=actor then return jsonb_build_object('error','own_invitation');end if;
 return (select jsonb_build_object('patient_name',p.display_name,'access_level',inv.offered_access,'expires_at',inv.expires_at) from public.profiles p where p.id=inv.created_by);
end$$;

create function public.accept_helper_invitation(invitation_token text,consent_given boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=herbbridge_private.confirmed_actor();inv herbbridge_private.connection_invitations;h public.room_helpers;
begin
 if not exists(select 1 from public.profiles where id=actor and account_role in ('patient','helper')) then raise exception 'helper_account_required' using errcode='42501';end if;
 if consent_given is distinct from true then return jsonb_build_object('error','consent_required');end if;
 if not herbbridge_private.invitation_attempt_allowed(actor) then return jsonb_build_object('error','invite_rate_limit');end if;
 if invitation_token is null or invitation_token!~'^[0-9a-f]{64}$' then return jsonb_build_object('error','invalid_invitation');end if;
 select * into inv from herbbridge_private.connection_invitations where token_hash=sha256(convert_to(invitation_token,'UTF8'));
 if not found then return jsonb_build_object('error','invalid_invitation');end if;
 perform id from public.profiles where id in(actor,inv.created_by) order by id for update;
 select * into inv from herbbridge_private.connection_invitations where id=inv.id for update;
 if inv.invitation_type<>'helper_offer' or inv.invitation_status<>'pending' or inv.expires_at<=now() then return jsonb_build_object('error','invalid_invitation');end if;
 if inv.created_by=actor then return jsonb_build_object('error','own_invitation');end if;
 perform 1 from public.care_rooms where id=inv.room_id for update;
 select * into h from public.room_helpers where room_id=inv.room_id and helper_id=actor;
 if found and h.helper_status='active' then return jsonb_build_object('error','already_helping');end if;
 if (select count(*) from public.room_helpers where room_id=inv.room_id and helper_status='active')>=3 then return jsonb_build_object('error','helper_limit');end if;
 if (select count(*) from public.room_helpers where helper_id=actor and helper_status='active')>=10 then return jsonb_build_object('error','helped_limit');end if;
 insert into public.room_helpers(room_id,helper_id,access_level) values(inv.room_id,actor,inv.offered_access)
 on conflict(room_id,helper_id) do update set access_level=excluded.access_level,helper_status='active',added_at=now(),revoked_at=null returning * into h;
 update herbbridge_private.connection_invitations set invitation_status='accepted',accepted_by=actor,accepted_at=now() where id=inv.id;
 insert into public.room_events(room_id,actor_id,event_type,details)
 values(inv.room_id,actor,'helper_added',jsonb_build_object('helper_id',actor,'access_level',h.access_level));
 return jsonb_build_object('room_id',inv.room_id,'access_level',h.access_level);
end$$;

-- Patient changes a helper between view and edit.
create function public.change_helper_access(target_room uuid,target_helper uuid,new_access text) returns boolean language plpgsql security definer set search_path='' as $$
declare actor uuid:=herbbridge_private.confirmed_actor();patient uuid;
begin
 select patient_id into patient from public.care_rooms where id=target_room;
 if patient is null or patient<>actor then raise exception 'owner_required' using errcode='42501';end if;
 if new_access is null or new_access not in ('view','edit') then raise exception 'invalid_access' using errcode='22023';end if;
 perform id from public.profiles where id in(actor,target_helper) order by id for update;
 perform 1 from public.care_rooms where id=target_room for update;
 update public.room_helpers set access_level=new_access where room_id=target_room and helper_id=target_helper and helper_status='active' and access_level<>new_access;
 if not found then return false;end if;
 insert into public.room_events(room_id,actor_id,event_type,details)
 values(target_room,actor,'helper_access_changed',jsonb_build_object('helper_id',target_helper,'access_level',new_access));
 return true;
end$$;

-- Patient removes a helper, or a helper leaves.
create function public.remove_helper(target_room uuid,target_helper uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare actor uuid:=herbbridge_private.confirmed_actor();patient uuid;
begin
 select patient_id into patient from public.care_rooms where id=target_room;
 if patient is null or (actor<>patient and actor<>target_helper) then raise exception 'room_access_denied' using errcode='42501';end if;
 if actor<>patient and not herbbridge_private.helper_active(target_room,actor) then raise exception 'room_access_denied' using errcode='42501';end if;
 perform id from public.profiles where id in(patient,target_helper) order by id for update;
 perform 1 from public.care_rooms where id=target_room for update;
 update public.room_helpers set helper_status='revoked',revoked_at=now() where room_id=target_room and helper_id=target_helper and helper_status='active';
 if not found then return false;end if;
 insert into public.room_events(room_id,actor_id,event_type,details)
 values(target_room,actor,'helper_removed',jsonb_build_object('helper_id',target_helper));
 return true;
end$$;

-- 7. Lists include helper rooms; room details include helpers for the patient (and a helper's own entry).
create or replace function public.list_connected_rooms() returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=herbbridge_private.confirmed_actor();
begin
 return coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'patient_id',r.patient_id,'patient_name',p.display_name,
 'list_version',r.list_version,
 'access_level',case when r.patient_id=actor then 'owner' when m.id is not null then m.access_level else h.access_level end,
 'relationship',case when r.patient_id=actor then 'owner' when m.id is not null then 'practitioner' else 'helper' end,
 'tags',case when m.id is not null then coalesce((select jsonb_agg(g.label order by lower(g.label)) from herbbridge_private.practitioner_room_tags g where g.practitioner_id=actor and g.room_id=r.id),'[]'::jsonb) else '[]'::jsonb end)
 order by r.created_at)
 from public.care_rooms r join public.profiles p on p.id=r.patient_id
 left join public.room_memberships m on m.room_id=r.id and m.practitioner_id=actor and m.membership_status='active' and herbbridge_private.practitioner_active(actor)
 left join public.room_helpers h on h.room_id=r.id and h.helper_id=actor and h.helper_status='active'
 where r.patient_id=actor or m.id is not null or h.id is not null),'[]'::jsonb);
end$$;

create or replace function public.read_care_room(target_room uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=herbbridge_private.confirmed_actor();r public.care_rooms;owner boolean;helper boolean;
begin
 select * into r from public.care_rooms where id=target_room for share;
 if not found or not herbbridge_private.can_read_room(target_room) then raise exception 'room_access_denied' using errcode='42501';end if;
 owner:=r.patient_id=actor;helper:=herbbridge_private.helper_active(target_room,actor);
 return jsonb_build_object('id',r.id,'patient_id',r.patient_id,'patient_name',(select display_name from public.profiles where id=r.patient_id),
 'version',r.list_version,'is_owner',owner,'is_helper',helper,'can_edit',herbbridge_private.room_editable(target_room,actor),
 'items',coalesce((select jsonb_agg(jsonb_build_object('kind',kind,'id',medicine_id) order by kind,medicine_id) from public.room_medicines where room_id=r.id),'[]'::jsonb),
 -- Helpers do not see the practitioner list; practitioners only see themselves (unchanged).
 -- Practitioners do not see the helper list; a helper sees only their own entry.
 'members',coalesce((select jsonb_agg(jsonb_build_object('id',m.practitioner_id,'name',p.display_name,'category',d.category,'is_demo',d.is_demo,'access_level',m.access_level,'approval_status',d.approval_status) order by m.consented_at)
 from public.room_memberships m join public.profiles p on p.id=m.practitioner_id join public.practitioner_accounts d on d.id=p.id
 where m.room_id=r.id and m.membership_status='active' and (owner or m.practitioner_id=actor)),'[]'::jsonb),
 'helpers',coalesce((select jsonb_agg(jsonb_build_object('id',h.helper_id,'name',p.display_name,'access_level',h.access_level,'added_at',h.added_at) order by h.added_at)
 from public.room_helpers h join public.profiles p on p.id=h.helper_id
 where h.room_id=r.id and h.helper_status='active' and (owner or h.helper_id=actor)),'[]'::jsonb),
 'history',coalesce((select jsonb_agg(x.event order by x.id desc) from (
 select e.id,jsonb_build_object('id',e.id,'actor_name',case when helper and not owner and p.account_role='practitioner' then null else p.display_name end,'actor_role',p.account_role,'actor_relation',case when e.actor_id=r.patient_id then 'patient' when p.account_role='practitioner' then 'practitioner' else 'helper' end,'event_type',e.event_type,'version',e.list_version,'details',e.details,'recorded_at',e.recorded_at) event
 from public.room_events e join public.profiles p on p.id=e.actor_id where e.room_id=r.id
 -- Helpers see list saves and their own helper events; practitioners do not see helper add/change/remove events.
 and (owner or (helper and (e.event_type='list_saved' or (e.event_type like 'helper%' and e.details->>'helper_id'=actor::text)))
  or (not helper and e.event_type not like 'helper%'))
 order by e.id desc limit 100) x),'[]'::jsonb));
end$$;

-- 8. Permissions: helper functions for signed-in users only.
do $$declare f regprocedure;begin
 foreach f in array array['public.create_helper_invitation(text)'::regprocedure,'public.preview_helper_invitation(text)'::regprocedure,
 'public.accept_helper_invitation(text,boolean)'::regprocedure,'public.change_helper_access(uuid,uuid,text)'::regprocedure,
 'public.remove_helper(uuid,uuid)'::regprocedure,'public.list_connected_rooms()'::regprocedure,'public.read_care_room(uuid)'::regprocedure] loop
 execute format('revoke all on function %s from public,anon,authenticated',f);
 execute format('grant execute on function %s to authenticated',f);
 end loop;
end$$;
revoke all on function herbbridge_private.can_read_room(uuid),herbbridge_private.can_read_profile(uuid),herbbridge_private.room_editable(uuid,uuid) from public,anon;
grant execute on function herbbridge_private.can_read_room(uuid),herbbridge_private.can_read_profile(uuid) to authenticated;
commit;
