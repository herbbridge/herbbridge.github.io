-- Private rooms, practitioner-offered invitations and versioned shared lists.
begin;
alter table public.practitioner_accounts add column is_demo boolean not null default false;
create table herbbridge_private.runtime_settings(
 singleton boolean primary key default true check(singleton),
 environment text not null default 'production' check(environment in ('development','production'))
);
insert into herbbridge_private.runtime_settings(singleton) values(true);
create table herbbridge_private.invitation_attempts(
 actor_id uuid not null references public.profiles(id),
 minute_bucket timestamptz not null,
 attempts integer not null default 1,
 primary key(actor_id,minute_bucket)
);
alter table herbbridge_private.runtime_settings enable row level security;
alter table herbbridge_private.invitation_attempts enable row level security;
revoke all on herbbridge_private.runtime_settings,herbbridge_private.invitation_attempts from public,anon,authenticated;

create function herbbridge_private.confirmed_actor() returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();
begin
 if actor is null or not exists(select 1 from auth.users where id=actor and email_confirmed_at is not null)
  or not exists(select 1 from public.profiles where id=actor) then
  raise exception 'confirmed_account_required' using errcode='42501';
 end if;
 return actor;
end$$;
create function herbbridge_private.practitioner_active(practitioner uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.practitioner_accounts p where p.id=practitioner and p.approval_status='approved'
 and (not p.is_demo or exists(select 1 from herbbridge_private.runtime_settings where environment='development')))
$$;
create or replace function herbbridge_private.can_read_room(target_room uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.care_rooms r where r.id=target_room and
 (r.patient_id=(select auth.uid()) or exists(select 1 from public.room_memberships m
 where m.room_id=r.id and m.practitioner_id=(select auth.uid()) and m.membership_status='active'
 and herbbridge_private.practitioner_active(m.practitioner_id))))
$$;
create or replace function herbbridge_private.can_read_profile(target_profile uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select target_profile=(select auth.uid()) or exists(select 1 from public.care_rooms r
 join public.room_memberships m on m.room_id=r.id where m.membership_status='active'
 and herbbridge_private.practitioner_active(m.practitioner_id) and
 ((r.patient_id=(select auth.uid()) and m.practitioner_id=target_profile) or
 (m.practitioner_id=(select auth.uid()) and r.patient_id=target_profile)))
$$;
create function herbbridge_private.room_editable(target_room uuid,actor uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.care_rooms r where r.id=target_room and
 (r.patient_id=actor or exists(select 1 from public.room_memberships m where m.room_id=r.id and m.practitioner_id=actor
 and m.membership_status='active' and m.access_level='edit' and herbbridge_private.practitioner_active(actor))))
$$;
create function herbbridge_private.invitation_attempt_allowed(actor uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare attempts integer;
begin
 delete from herbbridge_private.invitation_attempts where actor_id=actor and minute_bucket<now()-interval '1 day';
 insert into herbbridge_private.invitation_attempts(actor_id,minute_bucket) values(actor,date_trunc('minute',now()))
 on conflict(actor_id,minute_bucket) do update set attempts=invitation_attempts.attempts+1
 returning invitation_attempts.attempts into attempts;
 return attempts<=10;
end$$;

create function public.ensure_care_room() returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=herbbridge_private.confirmed_actor();r public.care_rooms;
begin
 perform 1 from public.profiles where id=actor and account_role='patient' for update;
 if not found then raise exception 'patient_account_required' using errcode='42501';end if;
 insert into public.care_rooms(patient_id) values(actor) on conflict(patient_id) do nothing;
 select * into r from public.care_rooms where patient_id=actor;
 return to_jsonb(r);
end$$;

create function public.create_practitioner_invitation() returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=herbbridge_private.confirmed_actor();token text;inv herbbridge_private.connection_invitations;
begin
 perform 1 from public.profiles where id=actor for update;
 if not herbbridge_private.practitioner_active(actor) then raise exception 'practitioner_approval_required' using errcode='42501';end if;
 if (select count(*) from herbbridge_private.connection_invitations where created_by=actor and created_at>now()-interval '1 minute')>=3
 or (select count(*) from herbbridge_private.connection_invitations where created_by=actor and created_at>now()-interval '24 hours')>=40 then
  return jsonb_build_object('error','invite_rate_limit');end if;
 token:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
 insert into herbbridge_private.connection_invitations(token_hash,invitation_type,created_by,practitioner_id)
 values(sha256(convert_to(token,'UTF8')),'practitioner_offer',actor,actor) returning * into inv;
 return jsonb_build_object('id',inv.id,'token',token,'expires_at',inv.expires_at);
end$$;
create function public.cancel_connection_invitation(invitation_id uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare actor uuid:=herbbridge_private.confirmed_actor();
begin
 update herbbridge_private.connection_invitations set invitation_status='cancelled'
 where id=invitation_id and created_by=actor and invitation_status='pending';
 return found;
end$$;
create function public.preview_practitioner_invitation(invitation_token text) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=herbbridge_private.confirmed_actor();inv herbbridge_private.connection_invitations;
begin
 if not exists(select 1 from public.profiles where id=actor and account_role='patient') then
 raise exception 'patient_account_required' using errcode='42501';end if;
 -- Return normal error objects so failed-attempt counters commit rather than
 -- rolling back along with an exception. Never return a medicine list here.
 if not herbbridge_private.invitation_attempt_allowed(actor) then return jsonb_build_object('error','invite_rate_limit');end if;
 if invitation_token is null or invitation_token!~'^[0-9a-f]{64}$' then return jsonb_build_object('error','invalid_invitation');end if;
 select * into inv from herbbridge_private.connection_invitations where token_hash=sha256(convert_to(invitation_token,'UTF8'));
 if not found or inv.invitation_type<>'practitioner_offer' or inv.invitation_status<>'pending' or inv.expires_at<=now()
 or not herbbridge_private.practitioner_active(inv.practitioner_id) then return jsonb_build_object('error','invalid_invitation');end if;
 return (select jsonb_build_object('practitioner_id',p.id,'display_name',p.display_name,'category',d.category,'is_demo',d.is_demo,'expires_at',inv.expires_at)
 from public.profiles p join public.practitioner_accounts d on d.id=p.id where p.id=inv.practitioner_id);
end$$;

create function public.accept_practitioner_invitation(invitation_token text,access_level text,consent_given boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=herbbridge_private.confirmed_actor();inv herbbridge_private.connection_invitations;r public.care_rooms;m public.room_memberships;
begin
 if not exists(select 1 from public.profiles where id=actor and account_role='patient') then raise exception 'patient_account_required' using errcode='42501';end if;
 if consent_given is distinct from true or access_level is null or access_level not in ('view','edit') then
 return jsonb_build_object('error','consent_required');end if;
 if not herbbridge_private.invitation_attempt_allowed(actor) then return jsonb_build_object('error','invite_rate_limit');end if;
 if invitation_token is null or invitation_token!~'^[0-9a-f]{64}$' then return jsonb_build_object('error','invalid_invitation');end if;
 select * into inv from herbbridge_private.connection_invitations where token_hash=sha256(convert_to(invitation_token,'UTF8'));
 if not found then return jsonb_build_object('error','invalid_invitation');end if;
 perform id from public.profiles where id in(actor,inv.practitioner_id) order by id for update;
 select * into inv from herbbridge_private.connection_invitations where id=inv.id for update;
 if inv.invitation_type<>'practitioner_offer' or inv.invitation_status<>'pending' or inv.expires_at<=now()
 or not herbbridge_private.practitioner_active(inv.practitioner_id) then return jsonb_build_object('error','invalid_invitation');end if;
 perform public.ensure_care_room();select * into r from public.care_rooms where patient_id=actor for update;
 select * into m from public.room_memberships where room_id=r.id and practitioner_id=inv.practitioner_id;
 if found and m.membership_status='active' then return jsonb_build_object('error','already_connected');end if;
 if (select count(*) from public.room_memberships where room_id=r.id and membership_status='active')>=3 then return jsonb_build_object('error','patient_limit');end if;
 if (select count(*) from public.room_memberships where practitioner_id=inv.practitioner_id and membership_status='active')>=20 then return jsonb_build_object('error','practitioner_limit');end if;
 insert into public.room_memberships(room_id,practitioner_id,access_level,consented_by,consent_notice_version)
 values(r.id,inv.practitioner_id,accept_practitioner_invitation.access_level,actor,'care-room-v1')
 on conflict(room_id,practitioner_id) do update set access_level=excluded.access_level,membership_status='active',consented_by=actor,
 consent_notice_version='care-room-v1',consented_at=now(),revoked_at=null returning * into m;
 update herbbridge_private.connection_invitations set invitation_status='accepted',accepted_by=actor,accepted_at=now() where id=inv.id;
 insert into public.room_consents(room_id,practitioner_id,patient_id,access_level,notice_version,decision)
 values(r.id,inv.practitioner_id,actor,m.access_level,'care-room-v1','granted');
 insert into public.room_events(room_id,actor_id,event_type,details)
 values(r.id,actor,'connected',jsonb_build_object('practitioner_id',inv.practitioner_id,'access_level',m.access_level));
 return jsonb_build_object('room_id',r.id,'membership_id',m.id);
end$$;

create function public.list_connected_rooms() returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=herbbridge_private.confirmed_actor();
begin
 return coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'patient_id',r.patient_id,'patient_name',p.display_name,
 'list_version',r.list_version,'access_level',case when r.patient_id=actor then 'owner' else m.access_level end) order by r.created_at)
 from public.care_rooms r join public.profiles p on p.id=r.patient_id
 left join public.room_memberships m on m.room_id=r.id and m.practitioner_id=actor and m.membership_status='active'
 where r.patient_id=actor or (m.id is not null and herbbridge_private.practitioner_active(actor))),'[]'::jsonb);
end$$;

create function public.read_care_room(target_room uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=herbbridge_private.confirmed_actor();r public.care_rooms;owner boolean;
begin
 select * into r from public.care_rooms where id=target_room for share;
 if not found or not herbbridge_private.can_read_room(target_room) then raise exception 'room_access_denied' using errcode='42501';end if;
 owner:=r.patient_id=actor;
 return jsonb_build_object('id',r.id,'patient_id',r.patient_id,'patient_name',(select display_name from public.profiles where id=r.patient_id),
 'version',r.list_version,'is_owner',owner,'can_edit',herbbridge_private.room_editable(target_room,actor),
 'items',coalesce((select jsonb_agg(jsonb_build_object('kind',kind,'id',medicine_id) order by kind,medicine_id) from public.room_medicines where room_id=r.id),'[]'::jsonb),
 'members',coalesce((select jsonb_agg(jsonb_build_object('id',m.practitioner_id,'name',p.display_name,'category',d.category,'is_demo',d.is_demo,'access_level',m.access_level,'approval_status',d.approval_status) order by m.consented_at)
 from public.room_memberships m join public.profiles p on p.id=m.practitioner_id join public.practitioner_accounts d on d.id=p.id
 where m.room_id=r.id and m.membership_status='active' and (owner or m.practitioner_id=actor)),'[]'::jsonb),
 'history',coalesce((select jsonb_agg(x.event order by x.id desc) from (
 select e.id,jsonb_build_object('id',e.id,'actor_name',p.display_name,'actor_role',p.account_role,'event_type',e.event_type,'version',e.list_version,'details',e.details,'recorded_at',e.recorded_at) event
 from public.room_events e join public.profiles p on p.id=e.actor_id where e.room_id=r.id order by e.id desc limit 100) x),'[]'::jsonb));
end$$;

create function public.change_practitioner_access(target_room uuid,target_practitioner uuid,new_access text)
returns boolean language plpgsql security definer set search_path='' as $$
declare actor uuid:=herbbridge_private.confirmed_actor();patient uuid;
begin
 select patient_id into patient from public.care_rooms where id=target_room;
 if patient is null or patient<>actor then raise exception 'owner_required' using errcode='42501';end if;
 if new_access is null or new_access not in ('view','edit') then raise exception 'invalid_access' using errcode='22023';end if;
 perform id from public.profiles where id in(actor,target_practitioner) order by id for update;
 perform 1 from public.care_rooms where id=target_room for update;
 update public.room_memberships set access_level=new_access where room_id=target_room and practitioner_id=target_practitioner
 and membership_status='active' and access_level<>new_access;
 if not found then return false;end if;
 insert into public.room_consents(room_id,practitioner_id,patient_id,access_level,notice_version,decision)
 values(target_room,target_practitioner,actor,new_access,'care-room-v1','changed');
 insert into public.room_events(room_id,actor_id,event_type,details)
 values(target_room,actor,'access_changed',jsonb_build_object('practitioner_id',target_practitioner,'access_level',new_access));
 return true;
end$$;

create function public.disconnect_practitioner(target_room uuid,target_practitioner uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare actor uuid:=herbbridge_private.confirmed_actor();patient uuid;m public.room_memberships;
begin
 select patient_id into patient from public.care_rooms where id=target_room;
 if patient is null or (actor<>patient and actor<>target_practitioner) then raise exception 'room_access_denied' using errcode='42501';end if;
 if actor<>patient and not exists(select 1 from public.room_memberships where room_id=target_room and practitioner_id=actor and membership_status='active') then raise exception 'room_access_denied' using errcode='42501';end if;
 perform id from public.profiles where id in(patient,target_practitioner) order by id for update;
 perform 1 from public.care_rooms where id=target_room for update;
 update public.room_memberships set membership_status='revoked',revoked_at=now()
 where room_id=target_room and practitioner_id=target_practitioner and membership_status='active' returning * into m;
 if not found then return false;end if;
 insert into public.room_consents(room_id,practitioner_id,patient_id,access_level,notice_version,decision)
 values(target_room,target_practitioner,patient,m.access_level,'care-room-v1','withdrawn');
 insert into public.room_events(room_id,actor_id,event_type,details)
 values(target_room,actor,'disconnected',jsonb_build_object('practitioner_id',target_practitioner));
 return true;
end$$;

create function public.save_care_room_list(target_room uuid,expected_version bigint,selected_items jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=herbbridge_private.confirmed_actor();r public.care_rooms;previous jsonb;next_items jsonb;next_version bigint;
begin
 select * into r from public.care_rooms where id=target_room;
 if not found then raise exception 'room_access_denied' using errcode='42501';end if;
 perform id from public.profiles where id in(actor,r.patient_id) order by id for update;
 select * into r from public.care_rooms where id=target_room for update;
 if not herbbridge_private.room_editable(target_room,actor) then raise exception 'room_edit_denied' using errcode='42501';end if;
 if expected_version is null or r.list_version<>expected_version then raise exception 'list_conflict' using errcode='40001';end if;
 if selected_items is null or jsonb_typeof(selected_items)<>'array' then raise exception 'invalid_items' using errcode='22023';end if;
 if exists(select 1 from jsonb_array_elements(selected_items) x where jsonb_typeof(x)<>'object' or not(x ? 'kind' and x ? 'id')
 or (x-'kind'-'id')<>'{}'::jsonb or jsonb_typeof(x->'kind')<>'string' or jsonb_typeof(x->'id')<>'string'
 or not exists(select 1 from public.medicine_catalog c where c.kind=x->>'kind' and c.id=x->>'id')) then
 raise exception 'invalid_items' using errcode='22023';end if;
 if (select count(*) from jsonb_array_elements(selected_items))<>(select count(distinct (x->>'kind',x->>'id')) from jsonb_array_elements(selected_items) x) then
 raise exception 'duplicate_items' using errcode='22023';end if;
 select coalesce(jsonb_agg(jsonb_build_object('kind',kind,'id',medicine_id) order by kind,medicine_id),'[]'::jsonb) into previous from public.room_medicines where room_id=r.id;
 select coalesce(jsonb_agg(x order by x->>'kind',x->>'id'),'[]'::jsonb) into next_items from jsonb_array_elements(selected_items) x;
 if previous=next_items then return jsonb_build_object('version',r.list_version,'changed',false);end if;
 next_version:=r.list_version+1;
 delete from public.room_medicines where room_id=r.id;
 insert into public.room_medicines(room_id,kind,medicine_id) select r.id,x->>'kind',x->>'id' from jsonb_array_elements(next_items) x;
 insert into public.medicine_list_versions(room_id,version,actor_id,items) values(r.id,next_version,actor,next_items);
 update public.care_rooms set list_version=next_version where id=r.id;
 insert into public.room_events(room_id,actor_id,event_type,list_version,details)
 values(r.id,actor,'list_saved',next_version,jsonb_build_object('before',previous,'after',next_items));
 return jsonb_build_object('version',next_version,'changed',true);
end$$;

-- New function defaults are PUBLIC-executable unless explicitly revoked.
revoke all on function herbbridge_private.confirmed_actor(),herbbridge_private.practitioner_active(uuid),herbbridge_private.room_editable(uuid,uuid),herbbridge_private.invitation_attempt_allowed(uuid) from public,anon,authenticated;
-- Policies invoke practitioner_active indirectly through hardened read helpers.
do $$declare f regprocedure;begin
 foreach f in array array['public.ensure_care_room()'::regprocedure,'public.create_practitioner_invitation()'::regprocedure,
 'public.cancel_connection_invitation(uuid)'::regprocedure,'public.preview_practitioner_invitation(text)'::regprocedure,
 'public.accept_practitioner_invitation(text,text,boolean)'::regprocedure,'public.list_connected_rooms()'::regprocedure,
 'public.read_care_room(uuid)'::regprocedure,'public.change_practitioner_access(uuid,uuid,text)'::regprocedure,
 'public.disconnect_practitioner(uuid,uuid)'::regprocedure,'public.save_care_room_list(uuid,bigint,jsonb)'::regprocedure] loop
 execute format('revoke all on function %s from public,anon,authenticated',f);
 execute format('grant execute on function %s to authenticated',f);
 end loop;
end$$;
commit;
