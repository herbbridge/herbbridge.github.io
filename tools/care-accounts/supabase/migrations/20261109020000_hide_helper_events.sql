-- Security check 9 Nov 2026, finding L1: practitioners could read helper add/change/remove events straight from the
-- room_events table through the API (not shown in the app), which revealed that a helper exists and their access level.
-- After this change only the patient (and, through read_care_room, the helper's own entries) can see helper events.
-- List saves stay visible to practitioners, so they still see who changed the list.
begin;
drop policy events_visibility on public.room_events;
create policy events_visibility on public.room_events for select to authenticated using (
 herbbridge_private.can_read_room_care_team(room_id)
 and (event_type not like 'helper%' or exists(select 1 from public.care_rooms r where r.id=room_id and r.patient_id=(select auth.uid())))
);
commit;
