-- HerbBridge care-room foundation. Apply only to a new, dedicated environment.
-- Auth/REST runtime is supplied by Supabase, not this migration.
begin;
create schema herbbridge_private;
revoke all on schema herbbridge_private from public, anon, authenticated;
grant usage on schema herbbridge_private to authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  account_role text not null check (account_role in ('patient','practitioner')),
  display_name text not null check (length(trim(display_name)) between 1 and 120),
  created_at timestamptz not null default now(),
  unique (id, account_role)
);
create table public.practitioner_accounts (
  id uuid primary key,
  account_role text not null default 'practitioner' check (account_role = 'practitioner'),
  category text not null check (category in ('western_medicine','chinese_medicine')),
  approval_status text not null default 'pending' check (approval_status in ('pending','approved','rejected','suspended')),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete restrict,
  foreign key (id, account_role) references public.profiles(id, account_role),
  check (approval_status = 'pending' or (reviewed_at is not null and reviewed_by is not null))
);
create table herbbridge_private.practitioner_applications (
  practitioner_id uuid primary key references public.practitioner_accounts(id),
  registration_reference text not null check (length(trim(registration_reference)) between 1 and 160),
  submitted_at timestamptz not null default now()
);
create table public.care_rooms (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null unique,
  account_role text not null default 'patient' check (account_role = 'patient'),
  list_version bigint not null default 0 check (list_version >= 0),
  created_at timestamptz not null default now(),
  foreign key (patient_id, account_role) references public.profiles(id, account_role)
);
create table public.room_memberships (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.care_rooms(id),
  practitioner_id uuid not null references public.practitioner_accounts(id),
  access_level text not null default 'view' check (access_level in ('view','edit')),
  membership_status text not null default 'active' check (membership_status in ('active','revoked')),
  consented_by uuid not null references public.profiles(id),
  consent_notice_version text not null check (length(trim(consent_notice_version)) between 1 and 60),
  consented_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (room_id, practitioner_id),
  check ((membership_status = 'revoked') = (revoked_at is not null))
);
create index room_memberships_caseload on public.room_memberships(practitioner_id, membership_status);
create table public.medicine_catalog (
  kind text not null check (kind in ('herb','drug')),
  id text not null check (id ~ '^[a-z0-9_]+$'),
  name_en text not null,
  name_zh text not null,
  primary key (kind,id)
);
create table public.room_medicines (
  room_id uuid not null references public.care_rooms(id),
  kind text not null,
  medicine_id text not null,
  primary key (room_id,kind,medicine_id),
  foreign key (kind,medicine_id) references public.medicine_catalog(kind,id)
);
create table public.medicine_list_versions (
  room_id uuid not null references public.care_rooms(id),
  version bigint not null check (version > 0),
  actor_id uuid not null references public.profiles(id),
  items jsonb not null check (jsonb_typeof(items) = 'array'),
  recorded_at timestamptz not null default now(),
  primary key (room_id,version)
);
create table public.room_events (
  id bigint generated always as identity primary key,
  room_id uuid not null references public.care_rooms(id),
  actor_id uuid not null references public.profiles(id),
  event_type text not null check (event_type in ('connected','access_changed','disconnected','list_saved','tool_proposed','tool_accepted','tool_declined','tool_paused','tool_resumed','tool_removed','tool_completed','practitioner_suspended')),
  list_version bigint,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  recorded_at timestamptz not null default now(),
  foreign key (room_id,list_version) references public.medicine_list_versions(room_id,version)
);
create index room_events_history on public.room_events(room_id,id desc);
create table herbbridge_private.connection_invitations (
  id uuid primary key default gen_random_uuid(),
  token_hash bytea not null unique check (octet_length(token_hash) = 32),
  invitation_type text not null check (invitation_type in ('patient_offer','practitioner_offer')),
  created_by uuid not null references public.profiles(id),
  room_id uuid references public.care_rooms(id),
  practitioner_id uuid references public.practitioner_accounts(id),
  invitation_status text not null default 'pending' check (invitation_status in ('pending','accepted','cancelled')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  accepted_by uuid references public.profiles(id),
  accepted_at timestamptz,
  check (expires_at > created_at and expires_at <= created_at + interval '24 hours'),
  check ((invitation_type='patient_offer' and room_id is not null) or
         (invitation_type='practitioner_offer' and room_id is null and practitioner_id is not null)),
  check ((invitation_status='accepted') = (accepted_by is not null and accepted_at is not null))
);
create table public.room_consents (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.care_rooms(id),
  practitioner_id uuid not null references public.practitioner_accounts(id),
  patient_id uuid not null references public.profiles(id),
  access_level text not null check (access_level in ('view','edit')),
  notice_version text not null check (length(trim(notice_version)) between 1 and 60),
  decision text not null check (decision in ('granted','changed','withdrawn')),
  recorded_at timestamptz not null default now()
);
create table public.patient_tools (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.care_rooms(id),
  proposed_by uuid not null references public.practitioner_accounts(id),
  tool_type text not null check (tool_type in ('medicine_reminder','reminder','checklist')),
  message text not null check (length(trim(message)) between 1 and 90),
  local_time time not null,
  timezone text not null default 'Asia/Hong_Kong' check (timezone = 'Asia/Hong_Kong'),
  tool_status text not null default 'pending' check (tool_status in ('pending','active','paused','declined','withdrawn')),
  accepted_by uuid references public.profiles(id),
  accepted_at timestamptz,
  revision bigint not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  check ((accepted_by is null) = (accepted_at is null)),
  check (tool_status not in ('active','paused') or accepted_by is not null)
);
create index patient_tools_room on public.patient_tools(room_id,tool_status);
create table public.tool_completions (
  tool_id uuid not null references public.patient_tools(id),
  completed_on date not null,
  actor_id uuid not null references public.profiles(id),
  recorded_at timestamptz not null default now(),
  primary key (tool_id,completed_on)
);

-- Definer helpers are identity-bound, use fully qualified names and cannot accept
-- an arbitrary caller ID. The private schema is not exposed by the Data API.
create function herbbridge_private.can_read_room(target_room uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.care_rooms r
    where r.id=target_room and (r.patient_id=(select auth.uid()) or exists (
      select 1 from public.room_memberships m join public.practitioner_accounts p on p.id=m.practitioner_id
      where m.room_id=r.id and m.practitioner_id=(select auth.uid())
        and m.membership_status='active' and p.approval_status='approved')))
$$;
create function herbbridge_private.can_read_profile(target_profile uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select target_profile=(select auth.uid()) or exists (
    select 1 from public.care_rooms r join public.room_memberships m on m.room_id=r.id
    join public.practitioner_accounts p on p.id=m.practitioner_id
    where m.membership_status='active' and p.approval_status='approved' and
      ((r.patient_id=(select auth.uid()) and m.practitioner_id=target_profile)
       or (m.practitioner_id=(select auth.uid()) and r.patient_id=target_profile)))
$$;
revoke all on function herbbridge_private.can_read_room(uuid) from public, anon, authenticated;
revoke all on function herbbridge_private.can_read_profile(uuid) from public, anon, authenticated;
grant execute on function herbbridge_private.can_read_room(uuid) to authenticated;
grant execute on function herbbridge_private.can_read_profile(uuid) to authenticated;

-- Capacity checks serialize on BOTH participant profile rows. Database triggers
-- also protect privileged operational writes; clients cannot write memberships.
create function herbbridge_private.check_membership()
returns trigger language plpgsql security definer set search_path = '' as $$
declare patient uuid;
begin
  if tg_op='UPDATE' and (new.room_id<>old.room_id or new.practitioner_id<>old.practitioner_id) then
    raise exception 'Membership identity is immutable' using errcode='23514';
  end if;
  select patient_id into strict patient from public.care_rooms where id=new.room_id;
  perform id from public.profiles where id in (patient,new.practitioner_id) order by id for update;
  if new.consented_by<>patient then raise exception 'Patient consent required' using errcode='23514'; end if;
  if new.membership_status='active' then
    if not exists(select 1 from public.practitioner_accounts where id=new.practitioner_id and approval_status='approved') then
      raise exception 'Practitioner approval required' using errcode='23514';
    end if;
    if (select count(*) from public.room_memberships where room_id=new.room_id and membership_status='active' and id<>new.id)>=3 then
      raise exception 'Patient connection limit reached' using errcode='23514';
    end if;
    if (select count(*) from public.room_memberships where practitioner_id=new.practitioner_id and membership_status='active' and id<>new.id)>=20 then
      raise exception 'Practitioner connection limit reached' using errcode='23514';
    end if;
  end if;
  return new;
end $$;
revoke all on function herbbridge_private.check_membership() from public, anon, authenticated;
create trigger check_membership before insert or update on public.room_memberships
  for each row execute function herbbridge_private.check_membership();

create function herbbridge_private.pause_disconnected_tools()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.membership_status='revoked' and old.membership_status='active' then
    update public.patient_tools set tool_status='withdrawn', revision=revision+1
      where room_id=new.room_id and proposed_by=new.practitioner_id and tool_status in ('pending','active','paused');
  end if;
  return new;
end $$;
revoke all on function herbbridge_private.pause_disconnected_tools() from public, anon, authenticated;
create trigger pause_disconnected_tools after update on public.room_memberships
  for each row execute function herbbridge_private.pause_disconnected_tools();

-- Every application table is protected; no direct client writes at this stage.
-- Checked write RPCs will be introduced with their own tests in Steps 4–8.
do $$ declare name text; begin
  foreach name in array array['profiles','practitioner_accounts','care_rooms','room_memberships','medicine_catalog','room_medicines','medicine_list_versions','room_events','room_consents','patient_tools','tool_completions'] loop
    execute format('alter table public.%I enable row level security',name);
    execute format('revoke all on table public.%I from public, anon, authenticated',name);
    execute format('grant select on table public.%I to authenticated',name);
  end loop;
end $$;
alter table herbbridge_private.practitioner_applications enable row level security;
alter table herbbridge_private.connection_invitations enable row level security;
revoke all on all tables in schema herbbridge_private from public, anon, authenticated;
revoke all on all sequences in schema public from public, anon, authenticated;
create policy profile_visibility on public.profiles for select to authenticated using (herbbridge_private.can_read_profile(id));
create policy practitioner_visibility on public.practitioner_accounts for select to authenticated using (herbbridge_private.can_read_profile(id));
create policy room_visibility on public.care_rooms for select to authenticated using (herbbridge_private.can_read_room(id));
create policy membership_visibility on public.room_memberships for select to authenticated using (
  (practitioner_id=(select auth.uid()) and membership_status='active' and herbbridge_private.can_read_room(room_id)) or exists(select 1 from public.care_rooms r where r.id=room_id and r.patient_id=(select auth.uid()))
);
create policy catalog_visibility on public.medicine_catalog for select to authenticated, anon using (true);
grant select on public.medicine_catalog to anon;
create policy medicines_visibility on public.room_medicines for select to authenticated using (herbbridge_private.can_read_room(room_id));
create policy versions_visibility on public.medicine_list_versions for select to authenticated using (herbbridge_private.can_read_room(room_id));
create policy events_visibility on public.room_events for select to authenticated using (herbbridge_private.can_read_room(room_id));
create policy consents_visibility on public.room_consents for select to authenticated using (
  (patient_id=(select auth.uid()) or practitioner_id=(select auth.uid())) and herbbridge_private.can_read_room(room_id)
);
create policy tools_visibility on public.patient_tools for select to authenticated using (herbbridge_private.can_read_room(room_id));
create policy completions_visibility on public.tool_completions for select to authenticated using (
  exists(select 1 from public.patient_tools t where t.id=tool_id and herbbridge_private.can_read_room(t.room_id))
);
comment on schema herbbridge_private is 'Not an exposed API schema. Contains invitation hashes and professional application details.';
comment on table public.medicine_catalog is 'Identifiers and display names copied from the public HerbBridge catalogue. No patient records or clinical ratings.';
commit;
