begin;
create table herbbridge_private.verification_events (
  id bigint generated always as identity primary key,
  practitioner_id uuid not null references public.practitioner_accounts(id),
  previous_status text,
  new_status text not null,
  reviewed_by uuid not null references auth.users(id),
  recorded_at timestamptz not null default now()
);
alter table herbbridge_private.verification_events enable row level security;
revoke all on herbbridge_private.verification_events from public,anon,authenticated;
revoke all on sequence herbbridge_private.verification_events_id_seq from public,anon,authenticated;

create function herbbridge_private.check_tool()
returns trigger language plpgsql security definer set search_path = '' as $$
declare patient uuid;
begin
  select patient_id into strict patient from public.care_rooms where id=new.room_id;
  if tg_op='UPDATE' then
    if new.room_id<>old.room_id or new.proposed_by<>old.proposed_by then
      raise exception 'Tool identity is immutable' using errcode='23514';
    end if;
    if (new.tool_type,new.message,new.local_time,new.timezone) is distinct from
       (old.tool_type,old.message,old.local_time,old.timezone) and
       (new.tool_status<>'pending' or new.accepted_by is not null) then
      raise exception 'Changed tool needs fresh patient approval' using errcode='23514';
    end if;
    new.revision=old.revision+1;
  end if;
  if new.accepted_by is not null and new.accepted_by<>patient then
    raise exception 'Only the room owner can accept a tool' using errcode='23514';
  end if;
  if tg_op='INSERT' or new.tool_status not in ('withdrawn','declined') then
    if not exists(select 1 from public.room_memberships m join public.practitioner_accounts p on p.id=m.practitioner_id
      where m.room_id=new.room_id and m.practitioner_id=new.proposed_by and m.membership_status='active'
      and m.access_level='edit' and p.approval_status='approved') then
      raise exception 'Approved connected editor required for a tool' using errcode='23514';
    end if;
  end if;
  return new;
end $$;
revoke all on function herbbridge_private.check_tool() from public,anon,authenticated;
create trigger check_tool before insert or update on public.patient_tools
  for each row execute function herbbridge_private.check_tool();

create function herbbridge_private.record_verification()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.approval_status is distinct from old.approval_status then
    insert into herbbridge_private.verification_events(practitioner_id,previous_status,new_status,reviewed_by)
      values(new.id,old.approval_status,new.approval_status,new.reviewed_by);
    if new.approval_status<>'approved' then
      update public.patient_tools set tool_status='withdrawn'
        where proposed_by=new.id and tool_status in ('pending','active','paused');
    end if;
  end if;
  return new;
end $$;
revoke all on function herbbridge_private.record_verification() from public,anon,authenticated;
create trigger record_verification after update on public.practitioner_accounts
  for each row execute function herbbridge_private.record_verification();
commit;
