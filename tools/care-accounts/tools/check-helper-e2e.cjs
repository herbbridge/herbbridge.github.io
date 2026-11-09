/* Goal 16 end-to-end check: the REAL accounts screens talking to the REAL database functions.
   Instead of Supabase, every request from the browser is answered by PGlite (Postgres in memory) loaded with
   supabase/migrations/* plus supabase/migrations/20261109010000_helpers.sql. Row security and the functions run exactly as written;
   only sign-in is simulated (each browser gets a fictional user ID). Nothing leaves this computer.
   Needs a build made with HERBBRIDGE_HELPERS=on served on 127.0.0.1:8012. HB_SHOTS=<folder> saves screenshots. */
const {chromium}=require('playwright');const fs=require('fs');const path=require('path');
const root=path.resolve(__dirname,'..');const SHOTS=process.env.HB_SHOTS||'';
let checks=0;const check=(ok,label)=>{if(!ok)throw Error('FAIL '+label);checks++;console.log('PASS '+label);};
const id=n=>`80000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const PAT=id(1),HELP=id(201),DOC=id(101),ADMIN=id(900);
const people={[PAT]:['patient','Fictional Mr Wong'],[HELP]:['helper','Fictional daughter Amy'],[DOC]:['practitioner','Fictional Dr Lee']};
(async()=>{
 const {PGlite}=await import('@electric-sql/pglite');const db=new PGlite();
 await db.exec(`create role anon nologin;create role authenticated nologin;create schema auth;create table auth.users(id uuid primary key,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}'::jsonb);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`);
 const dir=path.join(root,'supabase/migrations');for(const f of fs.readdirSync(dir).filter(x=>x.endsWith('.sql')).sort())await db.exec(fs.readFileSync(path.join(dir,f),'utf8'));
 for(const u of [PAT,HELP,DOC,ADMIN])await db.query('insert into auth.users(id,email_confirmed_at) values($1,now())',[u]);
 for(const [u,[r,n]] of Object.entries(people))await db.query('insert into public.profiles(id,account_role,display_name) values($1,$2,$3)',[u,r,n]);
 await db.query("insert into public.practitioner_accounts(id,category,approval_status,reviewed_at,reviewed_by) values($1,'western_medicine','approved',now(),$2)",[DOC,ADMIN]);
 // One request at a time, each as the signed-in fictional user with the API role, inside its own transaction.
 let queue=Promise.resolve();
 const asUser=(user,fn)=>{const run=queue.then(async()=>{await db.exec('begin');try{await db.query("select set_config('request.jwt.claim.sub',$1,true)",[user]);await db.exec('set local role authenticated');const out=await fn();await db.exec('commit');return out;}catch(e){await db.exec('rollback');throw e;}});queue=run.catch(()=>{});return run;};
 const argTypes={};
 async function rpc(user,name,body){
  if(!argTypes[name]){const r=(await db.query("select p.proargnames n,array(select format_type(t,null) from unnest(p.proargtypes) t) ty from pg_proc p join pg_namespace s on s.oid=p.pronamespace where s.nspname='public' and p.proname=$1",[name])).rows;if(!r.length)throw Object.assign(Error('function not found'),{code:'PGRST202'});argTypes[name]=r[0];}
  const {n=[],ty=[]}=argTypes[name];const keys=Object.keys(body||{});const params=[],parts=[];
  for(const k of keys){const i=n.indexOf(k);if(i<0)throw Object.assign(Error('unknown argument '+k),{code:'PGRST202'});params.push(ty[i]==='jsonb'?JSON.stringify(body[k]):body[k]);parts.push(`${k}=>$${params.length}::${ty[i]}`);}
  return asUser(user,async()=>(await db.query(`select public.${name}(${parts.join(',')}) result`,params)).rows[0].result);
 }
 const browser=await chromium.launch(process.env.HB_CHROME?{executablePath:process.env.HB_CHROME}:{});
 const logins={};
 async function open(user,label){
  const [role,name]=people[user];const context=await browser.newContext({viewport:{width:1280,height:1000}});const page=await context.newPage();const errors=[],foreign=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{const u=new URL(r.url());if(u.origin!=='http://127.0.0.1:8012'&&!u.hostname.endsWith('.supabase.co'))foreign.push(u.origin);});
  const authUser={id:user,aud:'authenticated',role:'authenticated',email:label+'@example.test',email_confirmed_at:new Date().toISOString(),user_metadata:{}};
  const enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url');const session={access_token:enc({alg:'HS256'})+'.'+enc({sub:user,aud:'authenticated',exp:Math.floor(Date.now()/1000)+3600})+'.ZmFrZQ',refresh_token:'fictional',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user:authUser};
  await context.route(/supabase\.co\//,async route=>{
   const req=route.request(),url=new URL(req.url());const json=(d,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(d)});
   try{
    if(url.pathname==='/auth/v1/token')return json(session);if(url.pathname==='/auth/v1/user')return json(authUser);if(url.pathname==='/auth/v1/logout')return route.fulfill({status:204,body:''});
    const single=(req.headers()['accept']||'').includes('vnd.pgrst.object');
    if(url.pathname.startsWith('/rest/v1/rpc/'))return json(await rpc(user,url.pathname.split('/').at(-1),req.postDataJSON()));
    const table=url.pathname.split('/').at(-1);const cols=(url.searchParams.get('select')||'*').split(',').map(c=>c.replace(/[^a-z_*]/g,'')).join(',');
    if(!['profiles','practitioner_accounts','medicine_catalog'].includes(table))return json({code:'42501',message:'not in test'},403);
    const eq=url.searchParams.get('id');const rows=await asUser(user,async()=>(await db.query(`select ${cols} from public.${table}${eq?' where id=$1':''} ${table==='medicine_catalog'?'order by name_en':''}`,eq?[eq.replace(/^eq\./,'')]:[])).rows);
    return json(single?rows[0]:rows);
   }catch(e){return json({code:e.code||'XX000',message:e.message},400);}
  });
  const click=n=>page.getByRole('button',{name:n,exact:true}).first().click();
  const heading=n=>page.getByRole('heading',{name:n,exact:true,level:1}).waitFor({timeout:20000});
  const text=()=>page.locator('#main').innerText();
  const shot=async n=>{if(SHOTS)await page.screenshot({path:path.join(SHOTS,`e2e-${label}-${n}.png`),fullPage:true});};
  await page.goto('http://127.0.0.1:8012/');await heading('Sign in');await page.fill('#email',label+'@example.test');await page.fill('#password','Fictional-Password-1');await click('Sign in');
  return {page,context,errors,foreign,click,heading,text,shot,nav:n=>page.getByRole('navigation').getByRole('button',{name:n,exact:true}).click()};
 }
 try{
  const P=await open(PAT,'patient');await P.heading('My medicines');
  // Patient saves a fictional list first.
  await P.click('Edit list');await P.heading('Edit medicine list');await P.page.getByText('Warfarin',{exact:true}).click();await P.click('Save changes');await P.heading('My medicines');check((await P.text()).includes('Warfarin'),'Patient saved a list in the real database');
  // Practitioner connects (view only) so we can check privacy between helpers and practitioners.
  const D=await open(DOC,'doctor');await D.heading('My patients');await D.click('Create invitation');await D.heading('New practitioner invitation');const docCode=await D.page.inputValue('#issued-code');
  await P.nav('Care team');await P.heading('Care team');await P.click('Connect a practitioner');await P.page.fill('#invitation-token',docCode);await P.click('Review invitation');await P.heading('Review practitioner access');await P.page.check('#room-consent');await P.click('Agree and connect');await P.page.getByText('Connection added.',{exact:true}).waitFor();check((await P.text()).includes('Fictional Dr Lee'),'Practitioner connected through the real functions');
  await D.click('Back to my patients');await D.heading('My patients');await D.page.reload();await D.heading('My patients');await D.click('Edit tags');await D.page.locator('input[id^="tags-"]').fill('Warfarin clinic');await D.click('Save tags');await D.page.getByText('Tags saved.',{exact:true}).waitFor();
  // Patient invites a helper with edit access.
  await P.click('Invite a helper');await P.heading('Invite a helper');await P.page.selectOption('#helper-invite-access','edit');await P.click('Create helper code');await P.heading('New helper invitation');const code=await P.page.inputValue('#issued-helper-code');check(/^[0-9a-f]{64}$/.test(code),'Real single-use helper code issued');await P.shot('code');
  await P.click('Back to Care team');await P.heading('Care team');
  // Helper joins.
  const H=await open(HELP,'helper');await H.heading('People I help');await H.click('Help someone');await H.heading('Help someone');await H.page.fill('#helper-token',code);await H.click('Review invitation');await H.heading('Review helper invitation');
  const review=await H.text();check(review.includes('Fictional Mr Wong')&&review.includes('View and edit')&&!review.includes('Warfarin'),'Helper review shows the patient and access, but no medicines');
  await H.page.check('#helper-consent');await H.click('Agree and join');await H.heading('Medicine list');check((await H.text()).includes('Warfarin'),'Helper sees the patient’s list after joining');
  // The same code cannot be used twice.
  const reuse=await rpc(HELP,'accept_helper_invitation',{invitation_token:code,consent_given:true});check(reuse.error==='invalid_invitation'||reuse.error==='already_helping','Used helper code cannot be used again ('+reuse.error+')');
  // Helper edits the list.
  await H.click('Edit list');await H.heading('Edit medicine list');await H.page.getByText('Danshen',{exact:true}).click();await H.click('Save changes');await H.heading('Medicine list');await H.page.getByText('Medicine list saved.',{exact:true}).waitFor();
  await H.page.locator('.check-row').first().waitFor();check((await H.page.locator('.check-list').innerText()).includes('Danshen × Warfarin'),'Helper sees the interaction check for the new pair');await H.shot('room');
  // Patient sees the change attributed to the helper (polling picks it up within about 5 s).
  await P.nav('My medicines');await P.heading('My medicines');await P.page.getByText('Danshen',{exact:true}).first().waitFor({timeout:15000});await P.nav('Change history');await P.heading('Change history');const ph=await P.text();check(ph.includes('Fictional daughter Amy (helper)'),'Patient history shows the helper as the author');await P.shot('history');
  // Practitioner sees who saved, but not the helper list or helper events.
  await D.click('Open care room');await D.heading('Care room');await D.nav('Change history');await D.heading('Change history');const dh=await D.text();check(dh.includes('(helper)')&&!dh.includes('Helper joined'),'Practitioner sees a helper saved the list, but not helper joining events');
  {const roomId=(await rpc(PAT,'ensure_care_room',{})).id;const r=await rpc(DOC,'read_care_room',{target_room:roomId});check(Array.isArray(r.helpers)&&r.helpers.length===0,'Practitioner room data has no helper list');}
  // Helper sees no practitioner names and no tags.
  await H.nav('Change history');await H.heading('Change history');const hh=await H.text();check(!hh.includes('Fictional Dr Lee')&&!hh.includes('Warfarin clinic'),'Helper sees no practitioner names or tags');await H.shot('history');
  // Patient lowers the helper to view only; the helper's editing switches off by itself.
  await P.nav('Care team');await P.heading('Care team');await P.page.selectOption('#helper-access-'+HELP,'view');await P.page.getByText('Access permission updated.',{exact:true}).waitFor();
  await H.nav('Medicine list');await H.heading('Medicine list');await H.page.getByText('patient must give you editing access',{exact:false}).waitFor({timeout:15000});check(!(await H.page.getByRole('button',{name:'Edit list',exact:true}).isEnabled()),'View-only change reaches the helper within one refresh');
  let refused=null;try{await rpc(HELP,'save_care_room_list',{target_room:(await rpc(PAT,'ensure_care_room',{})).id,expected_version:2,selected_items:[]});}catch(e){refused=e.message;}check(refused==='room_edit_denied','Database refuses a view-only helper’s save');
  // Patient removes the helper; the helper's screen clears.
  await P.click('Remove helper');await P.click('Confirm removal');await P.page.getByText('Helper removed.',{exact:true}).waitFor();
  await H.heading('Room access is unavailable');check(!(await H.text()).includes('Warfarin'),'Removed helper’s screen clears the list');await H.shot('removed');
  await H.click('Back to people I help');await H.heading('People I help');check((await H.text()).includes('not helping anyone yet'),'Removed helper no longer has the patient');
  check((await P.text()).includes('No helpers yet.'),'Patient’s Care team shows no helpers');
  for(const [label,x] of [['patient',P],['doctor',D],['helper',H]]){check(x.errors.length===0,label+' no page errors '+x.errors.join('; '));check(x.foreign.length===0,label+' no requests to other sites');}
  console.log(`\n${checks}/${checks} end-to-end helper checks passed (real screens + real database functions in PGlite)`);
 }finally{await browser.close();await db.close();}
})().catch(e=>{console.error(e.stack||e.message);process.exit(1);});
