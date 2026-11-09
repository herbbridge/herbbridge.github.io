/* Fictional browser QA: every Supabase request intercepted; no account/email created. */
const {chromium}=require('playwright');const path=require('path');
const uid='40000000-0000-4000-8000-000000000001',doctor='40000000-0000-4000-8000-000000000002';
let checks=0;const check=(ok,label)=>{if(!ok)throw Error('FAIL '+label);checks++;console.log('PASS '+label);};
const OUT=path.resolve(__dirname,'../../chatgpt update/evidence');
(async()=>{const chrome=process.env.HB_CHROME||(process.platform==='darwin'?'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome':'');const browser=await chromium.launch(chrome?{executablePath:chrome}:{});try{
for(const role of ['patient','practitioner']){
 const context=await browser.newContext({viewport:{width:1280,height:1000}}),page=await context.newPage(),errors=[],calls=[];
 let tags=[],twoRooms=false,conflict=false,failAccess=false,denied=false,room={id:'fictional-room',patient_id:uid,patient_name:'Fictional patient',version:0,is_owner:role==='patient',can_edit:role==='patient',items:[],members:[{id:doctor,name:'Fictional practitioner',category:'chinese_medicine',is_demo:true,approval_status:'approved',access_level:'view'}],history:[]};
 const user={id:role==='patient'?uid:doctor,aud:'authenticated',role:'authenticated',email:'fictional@example.test',email_confirmed_at:new Date().toISOString(),user_metadata:{}};
 const enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url');const access=enc({alg:'HS256',typ:'JWT'})+'.'+enc({sub:user.id,aud:'authenticated',exp:Math.floor(Date.now()/1000)+3600})+'.ZmFrZQ';
 const session={access_token:access,refresh_token:'fictional',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user};
 page.on('pageerror',e=>errors.push(e.message));const foreign=[];page.on('request',r=>{const u=new URL(r.url());if(u.origin!=='http://127.0.0.1:8012'&&u.hostname!=='ugmmxboczyblmzxmfrni.supabase.co')foreign.push(u.origin);});
 await context.route('https://ugmmxboczyblmzxmfrni.supabase.co/**',async route=>{
  const req=route.request(),url=new URL(req.url()),body=req.postDataJSON();calls.push({name:url.pathname.split('/').at(-1),body});
  const json=data=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  const error=(code,message)=>route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({code,message})});
  if(url.pathname==='/auth/v1/token')return json(session);
  if(url.pathname==='/auth/v1/user')return json(user);
  if(url.pathname==='/auth/v1/logout')return route.fulfill({status:204,body:''});
  if(url.pathname==='/rest/v1/profiles')return json([{id:user.id,account_role:role,display_name:role==='patient'?'Fictional patient':'Fictional practitioner'}]);
  if(url.pathname==='/rest/v1/practitioner_accounts')return json({category:'chinese_medicine',approval_status:'approved',is_demo:true});
  if(url.pathname==='/rest/v1/medicine_catalog')return json([{kind:'herb',id:'ginkgo',name_en:'Ginkgo',name_zh:'銀杏'},{kind:'drug',id:'warfarin',name_en:'Warfarin',name_zh:'華法林'}]);
  const name=url.pathname.split('/').at(-1);
  if(name==='ensure_care_room')return json({id:room.id});
  if(name==='read_care_room')return denied?error('42501','room_access_denied'):json(room);
  if(name==='list_connected_rooms')return json([{id:room.id,patient_name:room.patient_name,tags},...(twoRooms?[{id:'fictional-room-2',patient_name:'Second fictional patient',tags:[]}]:[])]);
  if(name==='set_room_tags'){if(body.tags.length>8||body.tags.some(x=>x.length>24))return error('22023','invalid_tags');tags=[...body.tags].sort((a,b)=>a.toLowerCase().localeCompare(b.toLowerCase()));return json({tags:body.tags});}
  if(name==='save_care_room_list'){
   if(conflict){conflict=false;room.version++;room.items=[{kind:'drug',id:'warfarin'}];return error('40001','list_conflict');}
   const before=room.items;room.items=body.selected_items;room.version++;room.history.unshift({event_type:'list_saved',actor_name:role==='patient'?'Fictional patient':'Fictional practitioner',recorded_at:new Date().toISOString(),details:{before,after:room.items}});return json({version:room.version,changed:true});
  }
  if(name==='change_practitioner_access'){if(failAccess)return error('42501','owner_required');room.members[0].access_level=body.new_access;return json({});}
  if(name==='preview_practitioner_invitation')return body.invitation_token==='bad'?json({error:'invalid_invitation'}):json({display_name:'Second fictional practitioner',is_demo:true,expires_at:new Date(Date.now()+86400000).toISOString()});
  if(name==='accept_practitioner_invitation')return json({error:'patient_limit'});
  if(name==='create_practitioner_invitation')return json({id:'fictional-invite',token:'a'.repeat(64),expires_at:new Date(Date.now()+86400000).toISOString()});
  if(name==='cancel_connection_invitation')return json({});
  if(name==='disconnect_practitioner'){room.members=[];return json({});}
  throw Error('Unexpected request '+url.pathname);
 });
 const click=name=>page.getByRole('button',{name,exact:true}).click();
 const heading=name=>page.getByRole('heading',{name,exact:true}).waitFor();
 await page.goto('http://127.0.0.1:8012/');await heading('Sign in');await page.fill('#email','fictional@example.test');await page.fill('#password','Fictional-Password-1');await click('Sign in');await heading(role==='patient'?'My medicines':'My patients');
 if(role==='practitioner'){
  check((await page.locator('#main').innerText()).includes('Demo practitioner'),'Demo account explicitly labelled');
  await click('Create invitation');await heading('New practitioner invitation');check((await page.inputValue('#issued-code')).length===64,'Opaque invitation code shown');
  check((await page.locator('#main').innerText()).includes('24 hours'),'Invitation expiry and single-use explained');
  await click('Cancel invitation');await heading('My patients');
  // Private practitioner tags (goal 9).
  twoRooms=true;await page.reload();await heading('My patients');check((await page.locator('#main').innerText()).includes('No tags'),'Patients start with no tags');
  await page.getByRole('button',{name:'Edit tags',exact:true}).first().click();check((await page.locator('#main').innerText()).includes('Only you can see these tags'),'Tag editor says tags are private to the practitioner');
  await page.locator('input[id^="tags-"]').fill('x'.repeat(25));await click('Save tags');await page.getByRole('alert').waitFor();check((await page.locator('#notice').innerText()).includes('Use up to 8 tags'),'Too-long tag is refused with an explanation');
  await page.locator('input[id^="tags-"]').fill('Warfarin, Demo patient，follow up');await click('Save tags');await page.getByText('Tags saved.',{exact:true}).waitFor();
  check(JSON.stringify(calls.filter(x=>x.name==='set_room_tags').at(-1).body.tags)==='["Warfarin","Demo patient","follow up"]','Tags split on English and Chinese commas and sent trimmed');
  check(await page.locator('.tag').count()===3,'Saved tags shown on the patient card');
  await page.locator('.tag-filter').getByRole('button',{name:'Warfarin',exact:true}).click();const filtered=await page.locator('#main').innerText();check(filtered.includes('Fictional patient')&&!filtered.includes('Second fictional patient'),'Filtering by a tag shows only tagged patients');
  await click('All patients');check((await page.locator('#main').innerText()).includes('Second fictional patient'),'All patients shows everyone again');
  twoRooms=false;await page.reload();await heading('My patients');
  await click('Open care room');await heading('Care room');check(!(await page.getByRole('button',{name:'Edit list',exact:true}).isEnabled()),'View-only practitioner cannot open editor');
  check((await page.locator('#main').innerText()).includes('patient must grant'),'Practitioner told who controls editing');
  room.can_edit=true;room.members[0].access_level='edit';
  await page.reload();await heading('My patients');await click('Open care room');await heading('Care room');
 }
 await click('Edit list');await heading('Edit medicine list');await page.getByText('Ginkgo',{exact:true}).click();
 await page.fill('#medicine-search','warfarin');check(await page.locator('.medicine-option:not([hidden])').count()===1,'Search filters medicine catalogue');await page.fill('#medicine-search','');
 await click('Save changes');await heading(role==='patient'?'My medicines':'Care room');
 check((await page.locator('.medicine-list').innerText()).includes('Ginkgo'),role+' saved list displayed');
 await page.getByText('You can keep a list with only Chinese herbs or only Western medicines',{exact:false}).waitFor();check(true,role+' list with one kind is allowed; interaction check asks for both a herb and a Western medicine');
 const saved=calls.find(x=>x.name==='save_care_room_list');check(saved.body.expected_version===0&&JSON.stringify(saved.body.selected_items)==='[{"kind":"herb","id":"ginkgo"}]','Save sends version and catalogue identifiers only');
 await page.getByRole('navigation').getByRole('button',{name:'Change history',exact:true}).click();await heading('Change history');check((await page.locator('.room-event').innerText()).includes(role==='patient'?'Fictional patient':'Fictional practitioner'),'History identifies author');
 check((await page.locator('.history-change').first().innerText()).includes('Added Ginkgo'),role+' history row says what changed in one line');
 check(await page.locator('details.history-lists').first().evaluate(d=>!d.open),role+' full before/after lists are hidden until asked for');
 check(await page.locator('.history-day').count()>=1,role+' history is grouped by day');
 room.history.push(...Array.from({length:11},(_,i)=>({event_type:'access_changed',actor_name:'Fictional patient',actor_relation:'patient',recorded_at:new Date(Date.now()-86400000*(i+2)).toISOString(),details:{access_level:'view'}})));
 await page.getByRole('button',{name:'Show older changes',exact:true}).waitFor({timeout:15000});check(await page.locator('.history-row').count()===10,role+' history shows the latest 10 changes first');
 await page.getByRole('button',{name:'Show older changes',exact:true}).click();check(await page.locator('.history-row').count()===12,role+' Show older changes reveals the rest');
 room.history.splice(1);
 await page.getByRole('navigation').getByRole('button',{name:role==='patient'?'My medicines':'Care room',exact:true}).click();
 await click('Edit list');await page.getByText('Warfarin',{exact:true}).click();
 if(role==='patient'){
  await page.getByRole('navigation').getByRole('button',{name:'Care team',exact:true}).click();await heading('Edit medicine list');check(await page.getByRole('heading',{name:'Leave without saving?',exact:true}).count()===1,'Unsaved edits require discard decision');await click('Keep editing');
 }
 conflict=true;await click('Save changes');await heading('A newer list has been saved');check((await page.locator('#main').innerText()).includes('Your unsaved draft'),'Version conflict retains and displays draft separately');
 await click('Load latest and edit again');await heading('Edit medicine list');check(await page.locator('[data-medicine="drug:warfarin"]').isChecked(),'Conflict reload starts from latest list');
 await context.setOffline(true);await heading('Connection lost');check(await page.locator('.medicine-options,.medicine-list').count()===0,'Offline room hides shared medicine details');
 room.can_edit=false;await context.setOffline(false);await click('Reconnect / reload');await heading(role==='patient'?'My medicines':'Care room');check(!(await page.getByRole('button',{name:'Edit list',exact:true}).isEnabled()),'Reconnect rechecks editing permission before restoring draft');room.can_edit=true;
 if(role==='patient'){
  await page.getByRole('navigation').getByRole('button',{name:'Care team',exact:true}).click();await heading('Care team');
  failAccess=true;await page.selectOption('#access-'+doctor,'edit');await page.getByRole('alert').waitFor();check(await page.inputValue('#access-'+doctor)==='view','Failed access update keeps original displayed permission');failAccess=false;
  await page.selectOption('#access-'+doctor,'edit');await page.getByText('Access permission updated.',{exact:true}).waitFor();check(await page.inputValue('#access-'+doctor)==='edit','Patient can explicitly grant editing');
  await click('Connect a practitioner');await page.fill('#invitation-token','bad');await click('Review invitation');await page.getByRole('alert').waitFor();check((await page.locator('#notice').innerText()).includes('invalid'),'Invalid invitation explains recovery');
  await page.fill('#invitation-token','b'.repeat(64));await click('Review invitation');await heading('Review practitioner access');check(await page.inputValue('#consent-access')==='view','Invitation defaults to view-only');
  await click('Agree and connect');check((await page.locator('#notice').innerText()).includes('confirm your permission'),'Connecting requires explicit consent');
  await page.check('#room-consent');await click('Agree and connect');await page.getByText('You already have 3 connected practitioners. Remove a connection in Care team before adding another.',{exact:true}).waitFor();check((await page.locator('#notice').innerText()).includes('You already have 3'),'Patient quota addresses user as you');
  await click('Cancel');await heading('Care team');await click('Remove connection');check(await page.getByRole('button',{name:'Confirm removal',exact:true}).count()===1,'Removal requires confirmation');await click('Keep connection');check(room.members.length===1,'Keeping connection preserves membership');
 }
 if(role==='patient'){
  room.items=[];room.can_edit=true;await page.getByRole('navigation').getByRole('button',{name:'My medicines',exact:true}).click();await heading('My medicines');
  await page.evaluate(()=>localStorage.setItem('herbsafe.v1',JSON.stringify({herbs:['ginkgo','not_a_real_id'],drugs:['warfarin','warfarin'],lang:'en'})));
  const before=calls.filter(x=>x.name==='save_care_room_list').length;
  await click('Import my list from this device');await heading('Import list from this device');
  const preview=await page.locator('#main').innerText();check(preview.includes('Ginkgo')&&preview.includes('Warfarin'),'Import previews the device list before saving');
  check(calls.filter(x=>x.name==='save_care_room_list').length===before,'Opening import uploads nothing');
  await click('Save to my care room');await page.getByText('List imported into your care room.',{exact:true}).waitFor();
  const imp=calls.filter(x=>x.name==='save_care_room_list').at(-1);check(JSON.stringify(imp.body.selected_items)==='[{"kind":"herb","id":"ginkgo"},{"kind":"drug","id":"warfarin"}]','Import saves only known, de-duplicated catalogue IDs after explicit confirmation');
  await page.evaluate(()=>localStorage.removeItem('herbsafe.v1'));await click('Import my list from this device');check((await page.locator('#main').innerText()).includes('No saved checker list'),'Import explains when no device list exists');await click('Back to room');
 }
 room.items=[{kind:'herb',id:'ginkgo'},{kind:'drug',id:'warfarin'}];room.version++;await page.reload();await heading(role==='patient'?'My medicines':'My patients');if(role==='practitioner'){await click('Open care room');await heading('Care room');}
 await page.locator('.check-row').first().waitFor();const rowText=await page.locator('.check-list').innerText();check(rowText.includes('Ginkgo')&&rowText.includes('Warfarin')&&/risk|caution/i.test(rowText),role+' interaction check shows the herb × medicine pair with a rating label');
 const href=await page.getByRole('link',{name:'Open full results and doctor summary'}).getAttribute('href');const enc2=href.split('#/summary?l=')[1];const decoded=JSON.parse(Buffer.from(enc2,'base64url').toString());check(href.startsWith('../#/summary?l=')&&JSON.stringify(decoded)==='{"v":1,"h":["ginkgo"],"d":["warfarin"]}','Summary link carries medicine IDs only, in the guest checker share format');
 check(await page.getByRole('link',{name:'Open full results and doctor summary'}).getAttribute('rel')==='noopener noreferrer','Summary link opens without referrer');
 check((await page.locator('#main').innerText()).includes('not medical advice'),'Interaction check shows the medical-advice disclaimer');
 if(process.env.HB_SHOT)await page.locator('.check-list').locator('xpath=..').screenshot({path:process.env.HB_SHOT+'-'+role+'.png'});
 if(role==='practitioner'){
  denied=true;await heading('Room access is unavailable');const txt=await page.locator('#main').innerText();check(!txt.includes('Warfarin')&&!/saved\./.test(await page.locator('body').innerText()),'Lost access clears the list and any earlier success message');
  await click('Back to my patients');await heading('My patients');check(true,'Practitioner can leave the denied screen back to My patients');denied=false;await click('Open care room');await heading('Care room');
 }
 for(const lang of ['en','zh']){
  if(lang==='zh')await page.click('#language');
  for(const width of [320,390,1280]){await page.setViewportSize({width,height:900});check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),role+' '+lang+' '+width+'px fits');}
 }
 await page.click('#language');await page.setViewportSize({width:390,height:844});check((await page.textContent('#bigger')).includes('Bigger'),role+' text button offers Bigger text first');await page.click('#bigger');check((await page.textContent('#bigger')).includes('Smaller text'),role+' after pressing, the button offers Smaller text');check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),role+' bigger text fits');check(!(await page.locator('#main').innerText()).split('\n').some(line=>line==='null'||line==='undefined'),'No empty placeholder text rendered');await page.screenshot({path:path.join(OUT,'account-room-'+role+'-phone.png'),fullPage:true});
 await click('Sign out');await heading('Sign in');check(!(await page.locator('#main').innerText()).includes('Fictional patient'),'Sign-out removes shared patient context');
 check(errors.length===0,'No '+role+' script errors: '+errors.join('; '));check(foreign.length===0,'No requests to other sites: '+foreign.join(', '));await context.close();
}
console.log(`${checks}/${checks} checks passed. All Supabase traffic mocked.`);
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
