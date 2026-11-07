import {before,after,test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
let db;const id=n=>`30000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
before(async()=>{
 db=new PGlite();await db.exec(`create role anon nologin;create role authenticated nologin;create schema auth;
 create table auth.users(id uuid primary key,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}'::jsonb);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`);
 const dir=new URL('../supabase/migrations/',import.meta.url);
 for(const f of (await readdir(dir)).filter(x=>x.endsWith('.sql')).sort())await db.exec(await readFile(new URL(f,dir),'utf8'));
 for(let n=1;n<=3;n++)await db.query(`insert into auth.users(id,email_confirmed_at,raw_user_meta_data) values($1,$2,'{"role":"admin","approval_status":"approved"}')`,[id(n),n===3?null:new Date().toISOString()]);
});after(async()=>db?.close());
async function as(user,fn,role='authenticated'){await db.exec('begin');try{await db.exec(`set local role ${role}`);await db.query("select set_config('request.jwt.claim.sub',$1,true)",[user?id(user):'']);return await fn();}finally{await db.exec('rollback');}}
const enrol=(role='patient',name='Fictional applicant',category=null,reference=null)=>db.query('select public.complete_registration($1,$2,$3,$4) result',[role,name,category,reference]);
test('confirmed patient enrolment creates only the caller profile',()=>as(1,async()=>{const {rows}=await enrol();assert.equal(rows[0].result.id,id(1));assert.equal(rows[0].result.account_role,'patient');assert.equal((await db.query('select count(*) n from public.care_rooms')).rows[0].n,0);}));
test('practitioner starts pending despite forged approval metadata',()=>as(2,async()=>{await enrol('practitioner','Fictional practitioner','chinese_medicine','DEMO-REF');assert.equal((await db.query('select approval_status from public.practitioner_accounts')).rows[0].approval_status,'pending');assert.equal((await db.query('select count(*) n from public.care_rooms')).rows[0].n,0);}));
test('unconfirmed email cannot enrol even with authenticated role',()=>as(3,()=>assert.rejects(()=>enrol(),e=>e.code==='42501')));
test('missing identity cannot enrol',()=>as(null,()=>assert.rejects(()=>enrol(),e=>e.code==='42501')));
test('anonymous role cannot invoke enrolment',()=>as(null,()=>assert.rejects(()=>enrol(),e=>e.code==='42501'),'anon'));
test('admin and unsupported roles rejected',async()=>{for(const role of ['admin','approved','',null])await as(1,()=>assert.rejects(()=>enrol(role),e=>e.code==='22023'));});
test('professional details required before creating practitioner profile',async()=>{for(const [category,ref]of [[null,null],['invalid','test'],['chinese_medicine',' ']])await as(2,()=>assert.rejects(()=>enrol('practitioner','Applicant',category,ref),e=>e.code==='22023'));});
test('empty/oversized names rejected',async()=>{for(const name of ['', ' ', 'x'.repeat(121)])await as(1,()=>assert.rejects(()=>enrol('patient',name),e=>e.code==='22023'));});
test('retry idempotent and does not silently change profile',()=>as(1,async()=>{await enrol('patient','Original name');const result=await enrol('patient','Changed name');assert.equal(result.rows[0].result.display_name,'Original name');assert.equal((await db.query('select count(*) n from public.profiles')).rows[0].n,1);}));
test('existing account cannot change protected type',()=>as(1,async()=>{await enrol();await assert.rejects(()=>enrol('practitioner','Applicant','chinese_medicine','DEMO'),e=>e.code==='42501');}));
test('registration reference not exposed to client',()=>as(2,async()=>{await enrol('practitioner','Applicant','western_medicine','PRIVATE-DEMO-REF');await assert.rejects(()=>db.query('select * from herbbridge_private.practitioner_applications'),e=>e.code==='42501');}));
test('registration endpoint hardened and no actor/approval input',async()=>{const {rows}=await db.query(`select proconfig,prosecdef,proargnames from pg_proc where proname='complete_registration'`);assert.equal(rows[0].prosecdef,true);assert.ok(rows[0].proconfig.includes('search_path=""'));assert.deepEqual(rows[0].proargnames,['p_account_role','p_display_name','p_category','p_registration_reference']);});
