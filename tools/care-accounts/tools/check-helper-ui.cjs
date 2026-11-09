/* Goal 16 helper accounts: fictional browser QA of the helper screens. Every Supabase request is intercepted;
   no real account, email or database is touched. Run against a local build of the accounts app on 127.0.0.1:8012.
   HB_SHOTS=<folder> saves screenshots. */
const {chromium}=require('playwright');const path=require('path');
const P='70000000-0000-4000-8000-000000000001',H='70000000-0000-4000-8000-000000000201',H2='70000000-0000-4000-8000-000000000202',SPOUSE='70000000-0000-4000-8000-000000000002',DOC='70000000-0000-4000-8000-000000000101';
let checks=0;const check=(ok,label)=>{if(!ok)throw Error('FAIL '+label);checks++;console.log('PASS '+label);};
const SHOTS=process.env.HB_SHOTS||'';
const items=[{kind:'herb',id:'ginkgo'},{kind:'drug',id:'warfarin'}];
(async()=>{const browser=await chromium.launch(process.env.HB_CHROME?{executablePath:process.env.HB_CHROME}:{});try{
for(const who of ['patient','helper']){
 const context=await browser.newContext({viewport:{width:1280,height:1000}}),page=await context.newPage(),errors=[],calls=[],foreign=[];
 const me=who==='patient'?P:H,myName=who==='patient'?'Fictional patient':'Fictional helper';
 // Server-side state (fictional). Own room for the patient; Mrs Fictional Spouse's room that either account can be invited to help with.
 const own={id:'room-own',patient_id:P,patient_name:'Fictional patient',version:1,is_owner:true,is_helper:false,can_edit:true,items:items.slice(),members:[{id:DOC,name:'Fictional practitioner',category:'chinese_medicine',is_demo:true,approval_status:'approved',access_level:'view'}],helpers:[{id:H2,name:'Fictional daughter',access_level:'view',added_at:new Date().toISOString()}],history:[]};
 const other={id:'room-other',patient_id:SPOUSE,patient_name:'Fictional grandmother',version:2,is_owner:false,is_helper:true,can_edit:false,items:items.slice(),members:[],helpers:[{id:me,name:myName,access_level:'view'}],history:[{id:2,event_type:'list_saved',actor_name:null,actor_relation:'practitioner',actor_role:'practitioner',version:2,details:{before:[],after:items},recorded_at:new Date().toISOString()},{id:1,event_type:'helper_added',actor_name:myName,actor_relation:'helper',details:{helper_id:me,access_level:'view'},recorded_at:new Date().toISOString()}]};
 let joined=false,revokedAccess=false;
 const user={id:me,aud:'authenticated',role:'authenticated',email:'fictional@example.test',email_confirmed_at:new Date().toISOString(),user_metadata:{}};
 const enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url');const access=enc({alg:'HS256',typ:'JWT'})+'.'+enc({sub:me,aud:'authenticated',exp:Math.floor(Date.now()/1000)+3600})+'.ZmFrZQ';
 const session={access_token:access,refresh_token:'fictional',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user};
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{const u=new URL(r.url());if(u.origin!=='http://127.0.0.1:8012'&&!u.hostname.endsWith('.supabase.co'))foreign.push(u.origin);});
 await context.route(/supabase\.co\//,async route=>{
  const req=route.request(),url=new URL(req.url()),body=req.postDataJSON(),name=url.pathname.split('/').at(-1);calls.push({name,body});
  const json=d=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(d)});
  const error=(code,message)=>route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({code,message})});
  if(url.pathname==='/auth/v1/token')return json(session);if(url.pathname==='/auth/v1/user')return json(user);if(url.pathname==='/auth/v1/logout')return route.fulfill({status:204,body:''});
  if(url.pathname==='/rest/v1/profiles')return json([{id:me,account_role:who,display_name:myName}]);
  if(url.pathname==='/rest/v1/medicine_catalog')return json([{kind:'herb',id:'ginkgo',name_en:'Ginkgo',name_zh:'銀杏'},{kind:'drug',id:'warfarin',name_en:'Warfarin',name_zh:'華法林'}]);
  if(name==='ensure_care_room'){if(who!=='patient')return error('42501','patient_account_required');return json({id:own.id});}
  if(name==='list_connected_rooms')return json([...(who==='patient'?[{id:own.id,patient_id:P,patient_name:own.patient_name,list_version:own.version,access_level:'owner',relationship:'owner',tags:[]}]:[]),...(joined?[{id:other.id,patient_id:SPOUSE,patient_name:other.patient_name,list_version:other.version,access_level:other.can_edit?'edit':'view',relationship:'helper',tags:[]}]:[])]);
  if(name==='read_care_room'){const r=body.target_room===own.id&&who==='patient'?own:body.target_room===other.id&&joined&&!revokedAccess?other:null;return r?json(r):error('42501','room_access_denied');}
  if(name==='create_helper_invitation')return json({id:'helper-invite',token:'c'.repeat(64),expires_at:new Date(Date.now()+86400000).toISOString(),access_level:body.access_level});
  if(name==='cancel_connection_invitation')return json(true);
  if(name==='change_helper_access'){own.helpers.find(h=>h.id===body.target_helper).access_level=body.new_access;return json(true);}
  if(name==='remove_helper'){if(body.target_room===own.id){own.helpers=own.helpers.filter(h=>h.id!==body.target_helper);own.history.unshift({event_type:'helper_removed',actor_name:'Fictional patient',actor_relation:'patient',details:{helper_id:body.target_helper},recorded_at:new Date().toISOString()});}else joined=false;return json(true);}
  if(name==='preview_helper_invitation')return body.invitation_token==='d'.repeat(64)?json({error:'invalid_invitation'}):json({patient_name:other.patient_name,access_level:'view',expires_at:new Date(Date.now()+86400000).toISOString()});
  if(name==='accept_helper_invitation'){if(body.consent_given!==true)return json({error:'consent_required'});joined=true;return json({room_id:other.id,access_level:'view'});}
  if(name==='save_care_room_list')return error('42501','room_edit_denied');
  throw Error('Unexpected request '+url.pathname);
 });
 const click=name=>page.getByRole('button',{name,exact:true}).first().click();
 const heading=name=>page.getByRole('heading',{name,exact:true,level:1}).waitFor();
 const text=()=>page.locator('#main').innerText();
 const shot=async n=>{if(SHOTS)await page.screenshot({path:path.join(SHOTS,`${who}-${n}.png`),fullPage:true});};
 await page.goto('http://127.0.0.1:8012/');await heading('Sign in');
 if(who==='patient'){await click('Create an account');const opts=await page.locator('#account-role option').allInnerTexts();check(opts.includes('Family member or carer (helper)'),'Sign-up offers a helper account type');await page.selectOption('#account-role','helper');check((await text()).includes('not checked professionals'),'Helper sign-up says helpers are not checked professionals');check(await page.locator('#category').count()===0,'Helper sign-up asks for no professional details');await shot('signup-helper');await click('Back to sign in');}
 await page.fill('#email','fictional@example.test');await page.fill('#password','Fictional-Password-1');await click('Sign in');
 if(who==='patient'){
  await heading('My medicines');
  await page.getByRole('navigation').getByRole('button',{name:'Care team',exact:true}).click();await heading('Care team');
  const team=await text();check(team.includes('Helpers')&&team.includes('Fictional daughter')&&team.includes('1 / 3'),'Patient sees helpers with the 3-helper limit');check(team.includes('Fictional practitioner'),'Practitioners still listed separately');await shot('team');
  await page.selectOption('#helper-access-'+H2,'edit');await page.getByText('Access permission updated.',{exact:true}).waitFor();check(await page.inputValue('#helper-access-'+H2)==='edit','Patient can give a helper editing access');
  check(calls.some(c=>c.name==='change_helper_access'&&c.body.new_access==='edit'&&c.body.target_helper===H2),'Access change sent for that helper only');
  await click('Invite a helper');await heading('Invite a helper');check(await page.inputValue('#helper-invite-access')==='view','Helper invitation defaults to view only');
  await click('Create helper code');await heading('New helper invitation');check((await page.inputValue('#issued-helper-code')).length===64,'Single-use helper code shown');check((await text()).includes('24 hours'),'Helper code expiry explained');await shot('helper-code');
  check(calls.find(c=>c.name==='create_helper_invitation').body.access_level==='view','Code created with the chosen access');
  await click('Cancel invitation');await heading('Care team');check(calls.some(c=>c.name==='cancel_connection_invitation'),'Patient can cancel an unused helper code');
  await click('Remove helper');check((await text()).includes('lose access straight away'),'Removing a helper needs confirmation');await click('Keep helper');check(own.helpers.length===1,'Keeping the helper changes nothing');
  await click('Remove helper');await click('Confirm removal');await page.getByText('Helper removed.',{exact:true}).waitFor();check(!(await text()).includes('Fictional daughter')&&(await text()).includes('No helpers yet.'),'Removed helper disappears from Care team');
  await page.getByRole('navigation').getByRole('button',{name:'Change history',exact:true}).click();await heading('Change history');check((await text()).includes('Helper removed')&&(await text()).includes('(patient)'),'History shows the helper removal and who did it');
  // A patient account can also help someone else (e.g. a spouse).
  await page.getByRole('navigation').getByRole('button',{name:'People I help',exact:true}).click();await heading('People I help');check((await text()).includes('not helping anyone yet'),'Patient sees an empty People I help page');
 }else{
  await heading('People I help');check((await text()).includes('not helping anyone yet'),'New helper lands on an empty People I help page');check(!calls.some(c=>c.name==='ensure_care_room'),'Helper account never asks for a care room of its own');await shot('helping-empty');
 }
 await click('Help someone');await heading('Help someone');
 await page.fill('#helper-token','d'.repeat(64));await click('Review invitation');await page.getByRole('alert').waitFor();check((await page.locator('#notice').innerText()).includes('Ask the patient for a new code'),'Bad helper code tells the helper to ask the patient');
 await page.fill('#helper-token','e'.repeat(64));await click('Review invitation');await heading('Review helper invitation');
 const review=await text();check(review.includes('Fictional grandmother')&&review.includes('View only')&&review.includes('not medical advice'),'Review shows whose list, the access and the not-advice notice');check(!review.includes('Warfarin'),'Review shows no medicines before joining');await shot('review');
 await click('Agree and join');check((await page.locator('#notice').innerText()).includes('confirm your permission'),'Joining needs the consent box');check(!joined,'Nothing joined without consent');
 await page.check('#helper-consent');await click('Agree and join');await heading('Medicine list');await page.getByText('You are now helping with this list.',{exact:true}).waitFor();
 const roomText=await text();check(roomText.includes('Fictional grandmother')&&roomText.includes('Warfarin'),'Helper sees the patient’s list after joining');
 check(roomText.includes('patient must give you editing access'),'View-only helper told who controls editing');check(!(await page.getByRole('button',{name:'Edit list',exact:true}).isEnabled()),'View-only helper cannot open the editor');
 check(!roomText.includes('Import my list'),'Helpers are not offered the device-list import');
 const nav=await page.getByRole('navigation').innerText();check(nav.includes('People I help')&&!nav.includes('Care team'),'Helper navigation has no Care team page');
 await page.locator('.check-row').first().waitFor();check((await page.locator('.check-list').innerText()).includes('Ginkgo'),'Helper sees the same interaction check');await shot('room');
 await page.getByRole('navigation').getByRole('button',{name:'Change history',exact:true}).click();await heading('Change history');const hist=await text();
 check(hist.includes('A practitioner (practitioner)')&&!hist.includes('Fictional practitioner'),'History hides the practitioner’s name from helpers');check(hist.includes('Helper joined'),'History shows the helper joining');await shot('history');
 await page.getByRole('navigation').getByRole('button',{name:'Medicine list',exact:true}).click();await heading('Medicine list');
 // Patient removes the helper while they are looking: the screen must clear.
 revokedAccess=true;await heading('Room access is unavailable');check(!(await text()).includes('Warfarin'),'Losing access clears the list from the helper’s screen');await click('Back to people I help');await heading('People I help');revokedAccess=false;
 await click('Open care room');await heading('Medicine list');
 await click('Stop helping');check((await text()).includes('lose access straight away'),'Stopping needs confirmation');await click('Keep helping');await heading('Medicine list');
 await click('Stop helping');await click('Confirm');await page.getByText('You have stopped helping with this list.',{exact:true}).waitFor();await heading('People I help');check(!joined&&(await text()).includes('not helping anyone yet'),'Helper can leave and the list is gone');
 if(who==='patient'){await click('Back to my medicines');await heading('My medicines');check((await text()).includes('Fictional patient'),'Patient returns to their own list');}
 // Chinese, widths, bigger text
 if(who==='helper'){await click('Help someone');await page.fill('#helper-token','e'.repeat(64));await click('Review invitation');await page.check('#helper-consent');await click('Agree and join');await heading('Medicine list');}
 await page.click('#language');await page.getByRole('heading',{level:1}).waitFor();const zh=await text();check(who==='patient'?zh.includes('我嘅藥物'):zh.includes('藥物清單')&&zh.includes('協助者'),who+' Chinese labels shown');await shot('zh');
 if(who==='patient'){await page.getByRole('navigation').getByRole('button',{name:'照護團隊',exact:true}).click();await page.getByText('協助者',{exact:true}).first().waitFor();await shot('team-zh');}
 for(const width of [320,390,1280]){await page.setViewportSize({width,height:900});check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),who+' zh '+width+'px fits');}
 await page.setViewportSize({width:390,height:844});await shot('phone-zh');await page.click('#language');await page.click('#bigger');check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),who+' bigger text fits at 390px');await shot('phone-bigger');
 check(!(await text()).split('\n').some(l=>/^(null|undefined)$/.test(l.trim())||l.includes('undefined')),who+' no empty placeholders');
 check(!calls.some(c=>c.name==='set_room_tags'||c.name==='create_practitioner_invitation'),who+' helper screens never call practitioner functions');
 check(foreign.length===0,who+' no requests to other sites');check(errors.length===0,who+' no page errors: '+errors.join('; '));
 await context.close();
}
console.log(`\n${checks}/${checks} helper UI checks passed`);}finally{await browser.close();}})().catch(e=>{console.error(e.message);process.exit(1);});
