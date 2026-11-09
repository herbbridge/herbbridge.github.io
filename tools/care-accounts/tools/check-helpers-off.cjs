/* Goal 16: confirms the helper screens stay hidden in a normal build (HERBBRIDGE_HELPERS not set).
   Fictional data; every Supabase request is intercepted. Run against a local build on 127.0.0.1:8012. */
const {chromium}=require('playwright');
let checks=0;const check=(ok,label)=>{if(!ok)throw Error('FAIL '+label);checks++;console.log('PASS '+label);};
(async()=>{const browser=await chromium.launch();try{const context=await browser.newContext(),page=await context.newPage(),errors=[],calls=[];page.on('pageerror',e=>errors.push(e.message));
 const P='70000000-0000-4000-8000-000000000001';const user={id:P,aud:'authenticated',role:'authenticated',email:'fictional@example.test',email_confirmed_at:new Date().toISOString(),user_metadata:{}};
 const enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url');const session={access_token:enc({alg:'HS256'})+'.'+enc({sub:P,aud:'authenticated',exp:Math.floor(Date.now()/1000)+3600})+'.ZmFrZQ',refresh_token:'f',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user};
 const room={id:'room-own',patient_id:P,patient_name:'Fictional patient',version:0,is_owner:true,can_edit:true,items:[],members:[],history:[]};
 await context.route(/supabase\.co\//,route=>{const url=new URL(route.request().url()),name=url.pathname.split('/').at(-1);calls.push(name);const json=d=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(d)});
  if(name==='token')return json(session);if(name==='user')return json(user);if(name==='profiles')return json([{id:P,account_role:'patient',display_name:'Fictional patient'}]);if(name==='medicine_catalog')return json([]);if(name==='ensure_care_room')return json({id:room.id});if(name==='read_care_room')return json(room);if(name==='list_connected_rooms')return json([]);throw Error('Unexpected '+url.pathname);});
 await page.goto('http://127.0.0.1:8012/');await page.getByRole('heading',{name:'Sign in',exact:true}).waitFor();
 await page.getByRole('button',{name:'Create an account',exact:true}).click();check(!(await page.locator('#account-role option').allInnerTexts()).some(x=>/helper/i.test(x)),'Sign-up has no helper option when switched off');await page.getByRole('button',{name:'Back to sign in',exact:true}).click();
 await page.fill('#email','fictional@example.test');await page.fill('#password','Fictional-Password-1');await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByRole('heading',{name:'My medicines',exact:true}).waitFor();
 check(!(await page.getByRole('navigation').innerText()).includes('People I help'),'No People I help tab when switched off');
 await page.getByRole('navigation').getByRole('button',{name:'Care team',exact:true}).click();await page.getByRole('heading',{name:'Care team',exact:true}).waitFor();
 check(!(await page.locator('#main').innerText()).includes('Helpers'),'No Helpers section when switched off');check(!calls.some(c=>c.includes('helper')),'No helper functions called');check(errors.length===0,'No page errors');
 console.log(`\n${checks}/${checks} helpers-off checks passed`);}finally{await browser.close();}})().catch(e=>{console.error(e.message);process.exit(1);});
