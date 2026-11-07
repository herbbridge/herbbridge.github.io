-- Ephemeral permission checks. Fictional users and all room changes roll back.
create temporary table if not exists hb_room_results(id bigint generated always as identity,result jsonb);
create or replace function pg_temp.hb_room_assert(ok boolean,label text) returns jsonb language plpgsql as $$begin
 if ok is distinct from true then raise exception 'FAILED: %',label;end if;return jsonb_build_object('check',label,'passed',true);end$$;
do $audit$
declare checks jsonb:='[]';patient uuid:=gen_random_uuid();other_patient uuid:=gen_random_uuid();doctor uuid:=gen_random_uuid();pending uuid:=gen_random_uuid();reviewer uuid:=gen_random_uuid();rid uuid;inv jsonb;result jsonb;rejected boolean;original_users bigint:=(select count(*) from auth.users);original_profiles bigint:=(select count(*) from public.profiles);f record;
begin
 for f in select p.oid,p.proname,p.prosecdef,p.proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('ensure_care_room','create_practitioner_invitation','cancel_connection_invitation','preview_practitioner_invitation','accept_practitioner_invitation','list_connected_rooms','read_care_room','change_practitioner_access','disconnect_practitioner','save_care_room_list') loop
  checks:=checks||pg_temp.hb_room_assert(f.prosecdef and 'search_path=""'=any(f.proconfig) and not has_function_privilege('anon',f.oid,'EXECUTE') and has_function_privilege('authenticated',f.oid,'EXECUTE'),f.proname||' protected endpoint');
 end loop;
 checks:=checks||pg_temp.hb_room_assert(not has_table_privilege('authenticated','herbbridge_private.runtime_settings','UPDATE'),'Development/demo switch is operator-only');
 begin
  insert into auth.users(id,email_confirmed_at) values(patient,now()),(other_patient,now()),(doctor,now()),(pending,now()),(reviewer,now());
  insert into public.profiles(id,account_role,display_name) values(patient,'patient','Fictional patient'),(other_patient,'patient','Other fictional patient'),(doctor,'practitioner','Fictional practitioner'),(pending,'practitioner','Pending fictional practitioner');
  insert into public.practitioner_accounts(id,category,approval_status,reviewed_at,reviewed_by) values(doctor,'chinese_medicine','approved',now(),reviewer),(pending,'western_medicine','pending',null,null);
  perform set_config('request.jwt.claim.sub',patient::text,true);set local role authenticated;
  result:=public.ensure_care_room();rid:=(result->>'id')::uuid;
  checks:=checks||pg_temp.hb_room_assert((public.ensure_care_room()->>'id')::uuid=rid,'Own room creation is idempotent');reset role;
  perform set_config('request.jwt.claim.sub',other_patient::text,true);set local role authenticated;
  rejected:=false;begin perform public.read_care_room(rid);exception when insufficient_privilege then rejected:=true;end;
  checks:=checks||pg_temp.hb_room_assert(rejected,'Unrelated patient cannot read guessed room');reset role;
  perform set_config('request.jwt.claim.sub',pending::text,true);set local role authenticated;
  rejected:=false;begin perform public.create_practitioner_invitation();exception when insufficient_privilege then rejected:=true;end;
  checks:=checks||pg_temp.hb_room_assert(rejected,'Pending practitioner cannot invite');reset role;
  perform set_config('request.jwt.claim.sub',doctor::text,true);set local role authenticated;
  inv:=public.create_practitioner_invitation();checks:=checks||pg_temp.hb_room_assert(inv->>'token'~'^[0-9a-f]{64}$','Invitation uses opaque single-use token');reset role;
  perform set_config('request.jwt.claim.sub',patient::text,true);set local role authenticated;
  result:=public.preview_practitioner_invitation(inv->>'token');checks:=checks||pg_temp.hb_room_assert(not result?'items' and not result?'patient_id','Invitation preview contains no patient medicines');
  result:=public.accept_practitioner_invitation(inv->>'token','view',false);checks:=checks||pg_temp.hb_room_assert(result->>'error'='consent_required','Connection requires patient consent');
  result:=public.accept_practitioner_invitation(inv->>'token','view',true);checks:=checks||pg_temp.hb_room_assert((result->>'room_id')::uuid=rid,'Patient accepts connection into own room');
  result:=public.accept_practitioner_invitation(inv->>'token','view',true);checks:=checks||pg_temp.hb_room_assert(result->>'error'='invalid_invitation','Consumed invitation cannot be reused');reset role;
  perform set_config('request.jwt.claim.sub',doctor::text,true);set local role authenticated;
  checks:=checks||pg_temp.hb_room_assert(not (public.read_care_room(rid)->>'can_edit')::boolean,'View-only practitioner cannot edit');
  rejected:=false;begin perform public.save_care_room_list(rid,0,'[]');exception when insufficient_privilege then rejected:=true;end;
  checks:=checks||pg_temp.hb_room_assert(rejected,'Server refuses view-only save');reset role;
  perform set_config('request.jwt.claim.sub',patient::text,true);set local role authenticated;perform public.change_practitioner_access(rid,doctor,'edit');reset role;
  perform set_config('request.jwt.claim.sub',doctor::text,true);set local role authenticated;
  result:=public.save_care_room_list(rid,0,'[{"kind":"drug","id":"warfarin"}]');checks:=checks||pg_temp.hb_room_assert(result->>'version'='1','Granted practitioner saves versioned list');
  rejected:=false;begin perform public.save_care_room_list(rid,0,'[]');exception when serialization_failure then rejected:=true;end;
  checks:=checks||pg_temp.hb_room_assert(rejected,'Stale save cannot overwrite current list');reset role;
  perform set_config('request.jwt.claim.sub',patient::text,true);set local role authenticated;
  result:=public.read_care_room(rid);checks:=checks||pg_temp.hb_room_assert(result->'history'->0->>'actor_name'='Fictional practitioner','Patient sees practitioner attribution');
  perform public.disconnect_practitioner(rid,doctor);result:=public.read_care_room(rid);
  checks:=checks||pg_temp.hb_room_assert(jsonb_array_length(result->'items')=1 and jsonb_array_length(result->'members')=0,'Disconnect keeps patient list and removes membership');reset role;
  perform set_config('request.jwt.claim.sub',doctor::text,true);set local role authenticated;
  rejected:=false;begin perform public.read_care_room(rid);exception when insufficient_privilege then rejected:=true;end;
  checks:=checks||pg_temp.hb_room_assert(rejected,'Disconnected practitioner loses room access');reset role;
  raise exception using message='HB_ROLLBACK_ROOM_FIXTURES',errcode='P0001';
 exception when raise_exception then if sqlerrm<>'HB_ROLLBACK_ROOM_FIXTURES' then raise;end if;end;
 checks:=checks||pg_temp.hb_room_assert((select count(*)=original_users from auth.users),'Fictional Auth users rolled back');
 checks:=checks||pg_temp.hb_room_assert((select count(*)=original_profiles from public.profiles),'Fictional profiles rolled back');
 insert into hb_room_results(result) values(checks);
end$audit$;
select jsonb_array_length(result) checks_passed,result checks from hb_room_results order by id desc limit 1;
