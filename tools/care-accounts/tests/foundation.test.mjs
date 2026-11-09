import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

// Real PostgreSQL SQL/RLS execution in PGlite. Supabase Auth is NOT running.
// This auth.uid shim and fictional auth.users table belong ONLY to this test.
let db;
const uid = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const room = n => `10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const membership = n => `20000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const query = (sql, params) => db.query(sql, params);
const rows = async (sql, params) => (await query(sql, params)).rows;
const count = async table => Number((await rows(`select count(*) as n from public.${table}`))[0].n);
async function rollback(fn) { await db.exec('begin'); try { return await fn(); } finally { await db.exec('rollback'); } }
async function as(role, user, fn) { return rollback(async () => {
  await db.exec(`set local role ${role}`);
  await query("select set_config('request.jwt.claim.sub',$1,true)",[user ? uid(user) : '']);
  return fn();
}); }
async function connect(patient, doctor, access='view') {
 return query(`insert into public.room_memberships(room_id,practitioner_id,access_level,consented_by,consent_notice_version)
 values ($1,$2,$3,$4,'fictional-test-v1')`,[room(patient),uid(doctor),access,uid(patient)]);
}
const denied = async fn => assert.rejects(fn, e => e.code === '42501');
const constraint = async fn => assert.rejects(fn, e => ['23514','23505','23503'].includes(e.code));
before(async () => {
 db = new PGlite();
 await db.exec(`create role anon nologin; create role authenticated nologin;
 create schema auth; create table auth.users(id uuid primary key,email_confirmed_at timestamptz);
 create function auth.uid() returns uuid language sql stable as $$
 select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;`);
 const dir = new URL('../supabase/migrations/',import.meta.url);
 for (const file of (await readdir(dir)).filter(x=>x.endsWith('.sql')).sort()) await db.exec(await readFile(new URL(file,dir),'utf8'));
 for (const n of [...Array.from({length:25},(_,i)=>i+1),101,102,103,104,105,106,900]) await query('insert into auth.users values ($1)',[uid(n)]);
 for (let i=1;i<=25;i++) {
  await query("insert into public.profiles(id,account_role,display_name) values ($1,'patient',$2)",[uid(i),`Fictional patient ${i}`]);
  await query('insert into public.care_rooms(id,patient_id) values($1,$2)',[room(i),uid(i)]);
 }
 for (let i=101;i<=106;i++) {
  await query("insert into public.profiles(id,account_role,display_name) values ($1,'practitioner',$2)",[uid(i),`Fictional practitioner ${i}`]);
  await query(`insert into public.practitioner_accounts(id,category,approval_status,reviewed_at,reviewed_by)
  values($1,'chinese_medicine',$2,now(),$3)`,[uid(i),i===105?'pending':i===106?'suspended':'approved',uid(900)]);
 }
 await query(`insert into public.room_memberships(id,room_id,practitioner_id,consented_by,consent_notice_version)
 values($1,$2,$3,$4,'fictional-test-v1')`,[membership(1),room(1),uid(101),uid(1)]);
 await db.exec(`insert into public.room_medicines values ('${room(1)}','drug','warfarin'),('${room(2)}','drug','aspirin');`);
});
after(async()=>{await db?.close();});

test('patient sees only own room, list and authorised peer profile', async()=>as('authenticated',1,async()=>{
 assert.equal(await count('care_rooms'),1);assert.equal(await count('room_medicines'),1);
 assert.deepEqual((await rows('select id from public.profiles order by id')).map(x=>x.id),[uid(1),uid(101)]);
 assert.equal((await rows('select * from public.care_rooms where id=$1',[room(2)])).length,0);
}));
test('approved connected practitioner sees own caseload, not unrelated rooms or colleagues', async()=>as('authenticated',101,async()=>{
 assert.equal(await count('care_rooms'),1);assert.equal(await count('room_medicines'),1);assert.equal(await count('room_memberships'),1);
 assert.equal((await rows('select * from public.profiles where id=$1',[uid(102)])).length,0);
 assert.equal((await rows('select * from public.care_rooms where id=$1',[room(2)])).length,0);
}));
for(const [id,label] of [[102,'unconnected'],[105,'pending'],[106,'suspended']]) test(`${label} practitioner cannot read patient data`,async()=>as('authenticated',id,async()=>{
 for(const table of ['care_rooms','room_medicines','medicine_list_versions','room_events','patient_tools','tool_completions','room_consents']) assert.equal(await count(table),0,table);
}));
test('signed-out callers can read only the public catalogue',async()=>{
 await as('anon',null,async()=>assert.ok(await count('medicine_catalog')>0));
 for(const table of ['profiles','care_rooms','room_medicines','room_memberships','patient_tools']) await as('anon',null,()=>denied(()=>count(table)));
});
test('authenticated database role without a user identity sees no private records',async()=>as('authenticated',null,async()=>{
 assert.equal(await count('profiles'),0);assert.equal(await count('care_rooms'),0);
}));
test('owner cannot alter protected role or insert an extra room directly',async()=>{
 await as('authenticated',1,()=>denied(()=>query("update public.profiles set account_role='practitioner' where id=$1",[uid(1)])));
 await as('authenticated',1,()=>denied(()=>query('insert into public.care_rooms(patient_id) values($1)',[uid(1)])));
});
test('practitioner cannot self-approve, connect or edit a medicine list directly',async()=>{
 await as('authenticated',105,()=>denied(()=>query("update public.practitioner_accounts set approval_status='approved' where id=$1",[uid(105)])));
 await as('authenticated',102,()=>denied(()=>connect(1,102)));
 await as('authenticated',101,()=>denied(()=>query('delete from public.room_medicines where room_id=$1',[room(1)])));
});
test('invitation hashes and registration references are never directly readable',async()=>{
 for(const user of [1,101,105]) for(const table of ['connection_invitations','practitioner_applications']) await as('authenticated',user,()=>denied(()=>rows(`select * from herbbridge_private.${table}`)));
});
test('revocation removes clinician data immediately and preserves patient list',async()=>rollback(async()=>{
 await query("update public.room_memberships set membership_status='revoked',revoked_at=now() where id=$1",[membership(1)]);
 await db.exec('set local role authenticated');await query("select set_config('request.jwt.claim.sub',$1,true)",[uid(101)]);
 assert.equal(await count('care_rooms'),0);assert.equal(await count('room_medicines'),0);assert.equal(await count('room_memberships'),0);
 await query("select set_config('request.jwt.claim.sub',$1,true)",[uid(1)]);assert.equal(await count('room_medicines'),1);
}));
test('suspension removes existing clinician room access',async()=>rollback(async()=>{
 await query("update public.practitioner_accounts set approval_status='suspended' where id=$1",[uid(101)]);
 await db.exec('set local role authenticated');await query("select set_config('request.jwt.claim.sub',$1,true)",[uid(101)]);
 assert.equal(await count('care_rooms'),0);assert.equal(await count('room_memberships'),0);
}));
test('fourth practitioner rejected by database integrity trigger',async()=>rollback(async()=>{
 await connect(1,102);await connect(1,103);await constraint(()=>connect(1,104));
}));
test('twenty-first patient rejected by database integrity trigger',async()=>rollback(async()=>{
 for(let i=2;i<=20;i++)await connect(i,101);
 await constraint(()=>connect(21,101));
}));
test('removing a connection frees capacity',async()=>rollback(async()=>{
 await connect(1,102);await connect(1,103);
 await query("update public.room_memberships set membership_status='revoked',revoked_at=now() where id=$1",[membership(1)]);
 await connect(1,104);
 assert.equal(Number((await rows("select count(*) n from public.room_memberships where room_id=$1 and membership_status='active'",[room(1)]))[0].n),3);
}));
test('approval and actual room-owner consent required even for operational inserts',async()=>{
 await rollback(()=>constraint(()=>connect(2,105)));
 await rollback(()=>constraint(()=>query(`insert into public.room_memberships(room_id,practitioner_id,consented_by,consent_notice_version)
 values($1,$2,$3,'test')`,[room(2),uid(102),uid(1)])));
});
test('duplicate connections and foreign catalogue identifiers are rejected',async()=>{
 await rollback(()=>constraint(()=>connect(1,101)));
 await rollback(()=>constraint(()=>query('insert into public.room_medicines values($1,$2,$3)',[room(1),'drug','invented_ai_medicine'])));
});
test('room owners must have patient accounts and each patient has one room',async()=>{
 await rollback(()=>constraint(()=>query('insert into public.care_rooms(patient_id) values($1)',[uid(101)])));
 await rollback(()=>constraint(()=>query('insert into public.care_rooms(patient_id) values($1)',[uid(1)])));
});
test('all application tables have RLS enabled and clients cannot insert/update/delete',async()=>{
 const tables=await rows(`select n.nspname schema,c.relname name,c.relrowsecurity rls from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname in ('public','herbbridge_private') and c.relkind='r'`);
 assert.equal(tables.length,18);
 for(const table of tables){assert.equal(table.rls,true,table.name);for(const permission of ['INSERT','UPDATE','DELETE']) {
 const [result]=await rows('select has_table_privilege($1,$2,$3) allowed',['authenticated',`${table.schema}.${table.name}`,permission]);assert.equal(result.allowed,false,`${table.name} ${permission}`);
 }}
});
test('private definer helpers are hardened and trigger functions cannot be invoked by clients',async()=>{
 const helpers=await rows(`select p.proname,p.prosecdef,p.proconfig,has_function_privilege('anon',p.oid,'EXECUTE') anon,
 has_function_privilege('authenticated',p.oid,'EXECUTE') client from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='herbbridge_private'`);
 for(const f of helpers){assert.equal(f.prosecdef,true);assert.ok(f.proconfig.includes('search_path=""'));assert.equal(f.anon,false);assert.equal(f.client,f.proname.startsWith('can_read_'));}
});

async function addTool(patient=1,doctor=101,acceptedBy=null){
 return (await rows(`insert into public.patient_tools(room_id,proposed_by,tool_type,message,local_time,tool_status,accepted_by,accepted_at)
 values($1,$2,'reminder','Fictional check-in','09:00',$3,$4,case when $4::uuid is null then null else now() end) returning id`,
 [room(patient),uid(doctor),acceptedBy?'active':'pending',acceptedBy?uid(acceptedBy):null]))[0].id;
}
test('view-only and unconnected practitioners cannot propose tools through operational writes',async()=>{
 await rollback(()=>constraint(()=>addTool()));
 await rollback(()=>constraint(()=>addTool(2,102)));
});
test('tool acceptance must identify the actual patient owner',async()=>rollback(async()=>{
 await query("update public.room_memberships set access_level='edit' where id=$1",[membership(1)]);
 await constraint(()=>addTool(1,101,2));
}));
test('changed active tool requires fresh approval and increased revision',async()=>rollback(async()=>{
 await query("update public.room_memberships set access_level='edit' where id=$1",[membership(1)]);const id=await addTool(1,101,1);
 await query("update public.patient_tools set message='A revised fictional reminder',tool_status='pending',accepted_by=null,accepted_at=null where id=$1",[id]);
 const [tool]=await rows('select tool_status,revision,accepted_by from public.patient_tools where id=$1',[id]);assert.equal(tool.tool_status,'pending');assert.equal(Number(tool.revision),2);assert.equal(tool.accepted_by,null);
}));
test('active tool cannot be silently reworded',async()=>rollback(async()=>{
 await query("update public.room_memberships set access_level='edit' where id=$1",[membership(1)]);const id=await addTool(1,101,1);
 await constraint(()=>query("update public.patient_tools set message='Unapproved replacement' where id=$1",[id]));
}));
test('revoking membership withdraws pending and active tools but preserves list/history',async()=>rollback(async()=>{
 await query("update public.room_memberships set access_level='edit' where id=$1",[membership(1)]);await addTool();await addTool(1,101,1);
 await query("update public.room_memberships set membership_status='revoked',revoked_at=now() where id=$1",[membership(1)]);
 assert.ok((await rows('select tool_status from public.patient_tools')).every(x=>x.tool_status==='withdrawn'));
 assert.equal(await count('room_medicines'),2);
}));
test('suspension withdraws tools and records protected verification history',async()=>rollback(async()=>{
 await query("update public.room_memberships set access_level='edit' where id=$1",[membership(1)]);await addTool(1,101,1);
 await query("update public.practitioner_accounts set approval_status='suspended' where id=$1",[uid(101)]);
 assert.equal((await rows('select tool_status from public.patient_tools'))[0].tool_status,'withdrawn');
 const [event]=await rows('select previous_status,new_status from herbbridge_private.verification_events');assert.equal(event.previous_status,'approved');assert.equal(event.new_status,'suspended');
}));
test('one completion per tool/calendar day',async()=>rollback(async()=>{
 await query("update public.room_memberships set access_level='edit' where id=$1",[membership(1)]);const id=await addTool(1,101,1);
 await query('insert into public.tool_completions(tool_id,completed_on,actor_id) values($1,current_date,$2)',[id,uid(1)]);
 await constraint(()=>query('insert into public.tool_completions(tool_id,completed_on,actor_id) values($1,current_date,$2)',[id,uid(1)]));
}));
