-- Private practitioner tags for connected patients (goal 9).
-- A practitioner labels their own connected care rooms (e.g. "warfarin clinic") to sort their caseload.
-- Tags are visible ONLY to the practitioner who wrote them: no table access for any API role,
-- read through list_connected_rooms (own tags only), written through set_room_tags.
-- Tags are deleted when the connection ends, so they never outlive the patient's consent.
begin;
create table herbbridge_private.practitioner_room_tags(
 practitioner_id uuid not null references public.practitioner_accounts(id),
 room_id uuid not null references public.care_rooms(id),
 label text not null check (length(label) between 1 and 24 and label = btrim(label) and label !~ '[[:cntrl:]]'),
 created_at timestamptz not null default now(),
 primary key (practitioner_id, room_id, label)
);
create unique index practitioner_room_tags_nocase on herbbridge_private.practitioner_room_tags(practitioner_id, room_id, lower(label));
alter table herbbridge_private.practitioner_room_tags enable row level security;
revoke all on herbbridge_private.practitioner_room_tags from public, anon, authenticated;

-- Replaces the caller's tags on one connected room. At most 8 tags, 1–24 characters each.
create function public.set_room_tags(target_room uuid, tags text[]) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=herbbridge_private.confirmed_actor(); cleaned text[]:='{}'; t text;
begin
 if not herbbridge_private.practitioner_active(actor) then raise exception 'practitioner_approval_required' using errcode='42501'; end if;
 if not exists(select 1 from public.room_memberships m where m.room_id=target_room and m.practitioner_id=actor and m.membership_status='active') then
  raise exception 'room_access_denied' using errcode='42501';
 end if;
 if tags is null or cardinality(tags) > 8 then raise exception 'invalid_tags' using errcode='22023'; end if;
 foreach t in array tags loop
  t := btrim(regexp_replace(coalesce(t,''), '\s+', ' ', 'g'));
  if t = '' then continue; end if;
  if length(t) > 24 or t ~ '[[:cntrl:]]' then raise exception 'invalid_tags' using errcode='22023'; end if;
  if not exists(select 1 from unnest(cleaned) c where lower(c)=lower(t)) then cleaned := cleaned || t; end if;
 end loop;
 delete from herbbridge_private.practitioner_room_tags where practitioner_id=actor and room_id=target_room;
 insert into herbbridge_private.practitioner_room_tags(practitioner_id, room_id, label) select actor, target_room, x from unnest(cleaned) x;
 return jsonb_build_object('tags', to_jsonb(cleaned));
end$$;

-- Same result as before, plus "tags": the CALLER's own tags for practitioner rooms (always [] for the patient's own room).
create or replace function public.list_connected_rooms() returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=herbbridge_private.confirmed_actor();
begin
 return coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'patient_id',r.patient_id,'patient_name',p.display_name,
 'list_version',r.list_version,'access_level',case when r.patient_id=actor then 'owner' else m.access_level end,
 'tags',case when r.patient_id=actor then '[]'::jsonb else coalesce((select jsonb_agg(g.label order by lower(g.label)) from herbbridge_private.practitioner_room_tags g where g.practitioner_id=actor and g.room_id=r.id),'[]'::jsonb) end) order by r.created_at)
 from public.care_rooms r join public.profiles p on p.id=r.patient_id
 left join public.room_memberships m on m.room_id=r.id and m.practitioner_id=actor and m.membership_status='active'
 where r.patient_id=actor or (m.id is not null and herbbridge_private.practitioner_active(actor))),'[]'::jsonb);
end$$;

-- Ending a connection deletes that practitioner's tags for the room.
create function herbbridge_private.drop_tags_on_revoke() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.membership_status='active' and new.membership_status<>'active' then
  delete from herbbridge_private.practitioner_room_tags where practitioner_id=new.practitioner_id and room_id=new.room_id;
 end if;
 return new;
end$$;
revoke all on function herbbridge_private.drop_tags_on_revoke() from public, anon, authenticated;
create trigger drop_tags_on_revoke after update on public.room_memberships for each row execute function herbbridge_private.drop_tags_on_revoke();

revoke all on function public.set_room_tags(uuid,text[]) from public, anon, authenticated;
grant execute on function public.set_room_tags(uuid,text[]) to authenticated;
revoke all on function public.list_connected_rooms() from public, anon, authenticated;
grant execute on function public.list_connected_rooms() to authenticated;
commit;
