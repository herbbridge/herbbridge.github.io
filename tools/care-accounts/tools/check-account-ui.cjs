/* Isolated browser QA. ALL Supabase requests mocked; no emails/accounts created. */
const {chromium}=require('playwright');const fs=require('fs'),path=require('path');
const OUT=path.resolve(__dirname,'../../chatgpt update/evidence');let checks=0,failed=0;
const check=(ok,label)=>{checks++;if(!ok)failed++;console.log(`${ok?'PASS':'FAIL'} ${label}`);};
const uid='40000000-0000-4000-8000-000000000001';
const USER={id:uid,aud:'authenticated',role:'authenticated',email:'fictional@example.test',email_confirmed_at:new Date().toISOString(),user_metadata:{registration_role:'patient',display_name:'Fictional patient'}};
const encode=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
const token=encode({alg:'HS256',typ:'JWT'})+'.'+encode({sub:uid,aud:'authenticated',role:'authenticated',exp:Math.floor(Date.now()/1000)+3600,iat:Math.floor(Date.now()/1000)})+'.ZmFrZQ';
const session={access_token:token,refresh_token:'fictional-refresh-token',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user:USER};
(async()=>{const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});try{
const context=await b.newContext({viewport:{width:1280,height:1000}}),p=await context.newPage(),errors=[],requests=[];let profile=null,role='patient',approval='pending',signinError=false,saveFailure=false,logoutFailure=false,emailLimited=false,otpError=false;
p.on('pageerror',e=>errors.push(e.message));
const mockBackend=async route=>{
 const req=route.request(),url=new URL(req.url()),body=req.postDataJSON?.();requests.push({path:url.pathname,body});
 const json=data=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
 if(url.pathname==='/auth/v1/signup')return json(USER);
 if(url.pathname==='/auth/v1/token')return signinError?route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({code:'invalid_credentials',msg:'Invalid login credentials'})}):json(session);
 if(url.pathname==='/auth/v1/verify')return otpError?route.fulfill({status:403,contentType:'application/json',headers:{'x-supabase-api-version':'2024-01-01','access-control-expose-headers':'x-supabase-api-version'},body:JSON.stringify({code:'otp_expired',msg:'Token has expired or is invalid'})}):json(session);
 if(url.pathname==='/auth/v1/user')return json(USER);
 if(url.pathname==='/auth/v1/logout')return logoutFailure?route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({code:'unexpected_failure',message:'Fictional test failure'})}):route.fulfill({status:204,body:''});
 if(['/auth/v1/recover','/auth/v1/resend'].includes(url.pathname))return emailLimited?route.fulfill({status:429,contentType:'application/json',headers:{'x-supabase-api-version':'2024-01-01','access-control-expose-headers':'x-supabase-api-version'},body:JSON.stringify({code:'over_email_send_rate_limit',msg:'Email rate limit exceeded'})}):json({});
 if(url.pathname==='/rest/v1/medicine_catalog')return json([{kind:'herb',id:'ginkgo',name_en:'Ginkgo',name_zh:'銀杏'},{kind:'drug',id:'warfarin',name_en:'Warfarin',name_zh:'華法林'}]);
 if(url.pathname==='/rest/v1/rpc/ensure_care_room')return json({id:'fictional-room'});
 if(url.pathname==='/rest/v1/rpc/read_care_room')return json({id:'fictional-room',patient_id:uid,patient_name:'Fictional patient',version:0,is_owner:true,can_edit:true,items:[],members:[],history:[]});
 if(url.pathname==='/rest/v1/profiles')return json(profile?[profile]:[]);
 if(url.pathname==='/rest/v1/practitioner_accounts')return json({category:'chinese_medicine',approval_status:approval});
 if(url.pathname==='/rest/v1/rpc/complete_registration'){
  if(saveFailure)return route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({code:'22023',message:'Professional details required'})});
  profile={id:uid,account_role:body.p_account_role,display_name:body.p_display_name};role=body.p_account_role;return json(profile);
 }
 throw new Error('Unexpected backend request '+url.pathname);
};
await context.route('https://ugmmxboczyblmzxmfrni.supabase.co/**',mockBackend);
const click=name=>p.getByRole('button',{name,exact:true}).click();
await p.goto('http://127.0.0.1:8012/');await p.getByRole('heading',{name:'Sign in',exact:true}).waitFor();
check(await p.getByRole('button',{name:'Sign in',exact:true}).count()===1,'App opens signed out without a fabricated account');
await click('Create an account');await p.fill('#display-name','Fictional patient');await p.fill('#email','fictional@example.test');await p.fill('#password','Fictional-Password-1');await p.fill('#confirm-password','Not-the-same-1');await click('Create an account');
check((await p.locator('#notice').innerText()).includes('do not match'),'Signup catches password mismatch before sending');
check(!requests.some(x=>x.path==='/auth/v1/signup'),'Mismatch does not send a signup request');
await p.fill('#confirm-password','Fictional-Password-1');await p.click('#language');check(await p.inputValue('#password')==='Fictional-Password-1'&&await p.inputValue('#display-name')==='Fictional patient','Language switch preserves entered fields without persistent password storage');await p.click('#language');
await click('Create an account');await p.getByRole('heading',{name:'Check your email',exact:true}).waitFor();
check(await p.locator('#password').count()===0,'Confirmation view clears password controls');
const signup=requests.find(x=>x.path==='/auth/v1/signup');check(signup.body.data.registration_role==='patient'&&!('approval_status'in signup.body.data)&&!('registration_reference'in signup.body.data),'Signup metadata contains hints, not approval or professional reference');
check(!!signup.body.code_challenge,'Signup uses a PKCE challenge');
await click('Resend confirmation email');check((await p.locator('#notice').innerText()).includes('does not guarantee another email'),'Resend response avoids revealing account existence');
check((await p.locator('#main').innerText()).includes('Your email may already be confirmed'),'Confirmation screen explains the cross-browser sign-in case');emailLimited=true;await click('Resend confirmation email');await p.getByRole('alert').waitFor();check((await p.locator('#notice').innerText()).includes('email service'),'Email quota error is distinguished from generic request throttling: '+await p.locator('#notice').innerText());emailLimited=false;
await click('Back to sign in');await click('Forgot your password?');await p.fill('#email','fictional@example.test');await click('Send recovery instructions');check((await p.locator('#notice').innerText()).includes('If the account exists'),'Recovery response avoids account enumeration');
await click('Back to sign in');signinError=true;await p.fill('#password','Fictional-Password-1');await click('Sign in');await p.getByRole('alert').waitFor();check((await p.locator('#notice').innerText()).includes('Sign-in failed'),'Incorrect credentials get a generic visible error');
signinError=false;await click('Sign in');await p.getByRole('heading',{name:'Finish your account',exact:true}).waitFor();
check(await p.locator('#account-role').count()===1,'Confirmed user with no profile gets one-time enrolment');
await p.selectOption('#account-role','practitioner');await p.fill('#display-name','Fictional practitioner');await p.fill('#registration-reference','DEMO-NOT-A-REAL-REGISTRATION');saveFailure=true;await click('Save account details');await p.getByRole('alert').waitFor();check(await p.inputValue('#registration-reference')==='DEMO-NOT-A-REAL-REGISTRATION','Failed enrolment retains professional form input');
saveFailure=false;await click('Save account details');await p.getByRole('heading',{name:'Application pending',exact:true}).waitFor();check(await p.getByRole('button',{name:/approve/i}).count()===0,'Pending practitioner has no self-approval button');
check(await p.getByRole('button',{name:/patient.*room/i}).count()===0,'Pending screen offers no room access');
check(await p.evaluate(()=>localStorage.getItem('herbbridge-development-auth')===null),'Session token is not stored in localStorage');
await click('Sign out');await p.getByRole('heading',{name:'Sign in',exact:true}).waitFor();
check(requests.some(x=>x.path==='/auth/v1/logout'),'Sign out contacts the provider before clearing local session');
check(await p.evaluate(()=>sessionStorage.getItem('herbbridge-development-auth')===null),'Sign out clears tab session token');
check(!(await p.locator('#main').innerText()).includes('Fictional practitioner'),'Sign out clears the previous profile');
profile={id:uid,account_role:'patient',display_name:'Fictional patient'};await p.fill('#email','fictional@example.test');await p.fill('#password','Fictional-Password-1');await click('Sign in');await p.getByRole('heading',{name:'My medicines',exact:true}).waitFor();
check(await p.getByRole('button',{name:'Edit list',exact:true}).isEnabled(),'Patient can open the real room editor');
await p.reload();await p.getByRole('heading',{name:'My medicines',exact:true}).waitFor();check((await p.locator('#main').innerText()).includes('Fictional patient'),'Reload restores tab session and loads verified profile');
await click('Sign out');
await p.fill('#email','fictional@example.test');await p.fill('#password','Fictional-Password-1');await click('Sign in');await p.getByRole('heading',{name:'My medicines',exact:true}).waitFor();
const second=await context.newPage();await second.goto('http://127.0.0.1:8012/');await second.getByRole('heading',{name:'Sign in',exact:true}).waitFor();await second.fill('#email','fictional@example.test');await second.fill('#password','Fictional-Password-1');await second.getByRole('button',{name:'Sign in',exact:true}).click();await second.getByRole('heading',{name:'My medicines',exact:true}).waitFor();
await click('Sign out');await second.getByRole('heading',{name:'Sign in',exact:true}).waitFor();check(await second.evaluate(()=>sessionStorage.getItem('herbbridge-development-auth')===null),'Sign out clears the other open app tab');await second.close();
await p.fill('#password','Fictional-Password-1');await click('Sign in');await p.getByRole('heading',{name:'My medicines',exact:true}).waitFor();logoutFailure=true;await click('Sign out');await p.getByRole('alert').waitFor();
check(await p.evaluate(()=>sessionStorage.getItem('herbbridge-development-auth')===null),'Failed server sign-out still clears the local token');check((await p.locator('#notice').innerText()).includes('server could not confirm'),'Failed server sign-out reports the limited result');logoutFailure=false;
await click('Forgot your password?');await p.fill('#email','fictional@example.test');await click('Send recovery instructions');await p.getByRole('status').waitFor();
await p.goto('http://127.0.0.1:8012/?code=fictional-recovery-code');await p.getByRole('heading',{name:'Choose a new password',exact:true}).waitFor();
check(!new URL(p.url()).searchParams.has('code'),'Recovery callback removes the code from the address bar');
await p.fill('#password','Fictional-New-Password-2');await p.fill('#confirm-password','Fictional-New-Password-2');await click('Save new password');await p.getByRole('heading',{name:'Sign in',exact:true}).waitFor();
check(requests.some(x=>x.path==='/auth/v1/user'&&x.body?.password==='Fictional-New-Password-2'),'Verified recovery uses the provider password update');
check((await p.locator('#notice').innerText()).includes('Password updated'),'Recovery finishes signed out with a clear success message');
// No PKCE verifier survives into these independent browser contexts.
await context.clearCookies();await p.evaluate(()=>{localStorage.clear();sessionStorage.clear();});
await p.goto('http://127.0.0.1:8012/#token_hash=fictional-confirm-hash&type=email');
await p.getByRole('heading',{name:'Confirm your email',exact:true}).waitFor();
check(!p.url().includes('token_hash'),'Link token is removed immediately from the address bar');
check(!requests.some(x=>x.path==='/auth/v1/verify'),'Opening a link does not consume it before explicit confirmation');
check(await p.evaluate(()=>!localStorage.getItem('herbbridge-development-auth-code-verifier')),'Cross-browser link has no PKCE verifier');
await click('Confirm and continue');await p.getByRole('heading',{name:'My medicines',exact:true}).waitFor();
check(requests.some(x=>x.path==='/auth/v1/verify'&&x.body.token_hash==='fictional-confirm-hash'&&x.body.type==='email'),'Confirmation link uses token-hash verification');
await click('Sign out');await click('Enter a confirmation email code');await p.fill('#email','fictional@example.test');await p.fill('#email-code','123456');otpError=true;
await click('Confirm email with code');await p.getByRole('alert').waitFor();
check((await p.locator('#notice').innerText()).includes('expired or already used'),'Expired code gives a visible retry route');
check(await p.inputValue('#email')==='fictional@example.test','Failed confirmation keeps email for correction');
otpError=false;await click('Confirm email with code');await p.getByRole('heading',{name:'My medicines',exact:true}).waitFor();
check(await p.locator('#email-code').count()===0,'Successful confirmation clears the code control');
check(requests.some(x=>x.path==='/auth/v1/verify'&&x.body.token==='123456'&&x.body.email==='fictional@example.test'&&x.body.type==='email'),'Manual confirmation verifies email and code');
await click('Sign out');await click('Forgot your password?');await p.fill('#email','fictional@example.test');await p.fill('#email-code','654321');await click('Continue recovery with code');await p.getByRole('heading',{name:'Choose a new password',exact:true}).waitFor();
check(requests.some(x=>x.path==='/auth/v1/verify'&&x.body.token==='654321'&&x.body.type==='recovery'),'Recovery code opens only a verified recovery session');
await p.goto('http://127.0.0.1:8012/#token_hash=fictional-recovery-hash&type=recovery');await p.getByRole('heading',{name:'Continue password recovery',exact:true}).waitFor();
await click('Confirm and continue');await p.getByRole('heading',{name:'Choose a new password',exact:true}).waitFor();
check(requests.some(x=>x.path==='/auth/v1/verify'&&x.body.token_hash==='fictional-recovery-hash'&&x.body.type==='recovery'),'Recovery link works without returning to the signup browser');
await p.goto('http://127.0.0.1:8012/#token_hash=fictional-cancel&type=email');await p.getByRole('heading',{name:'Confirm your email',exact:true}).waitFor();
const beforeCancel=requests.filter(x=>x.path==='/auth/v1/verify').length;await click('Cancel and return to sign in');
check(requests.filter(x=>x.path==='/auth/v1/verify').length===beforeCancel,'Cancelling never consumes the email token');
await p.evaluate(()=>{sessionStorage.clear();localStorage.clear();});await p.reload();await p.getByRole('heading',{name:'Sign in',exact:true}).waitFor();
const independent=await b.newContext({viewport:{width:390,height:844}});await independent.route('https://ugmmxboczyblmzxmfrni.supabase.co/**',mockBackend);
const cold=await independent.newPage(),hostRequests=[];cold.on('request',r=>{if(r.url().startsWith('http://127.0.0.1:8012/'))hostRequests.push(r.url());});
await cold.goto('http://127.0.0.1:8012/#token_hash=fictional-independent-browser&type=email');await cold.getByRole('heading',{name:'Confirm your email',exact:true}).waitFor();
check(await cold.evaluate(()=>localStorage.length===0&&sessionStorage.length===0),'A completely independent browser opens the confirmation with no saved signup state');
check(hostRequests.every(url=>!url.includes('token_hash')),'Fragment token is never sent to the static website host');
await cold.getByRole('button',{name:'Confirm and continue',exact:true}).click();await cold.getByRole('heading',{name:'My medicines',exact:true}).waitFor();
check((await cold.locator('#main').innerText()).includes('Fictional patient'),'Fresh independent browser confirms and loads the verified account');
await cold.goto('http://127.0.0.1:8012/#token_hash=fictional-next-account&type=email');await cold.getByRole('heading',{name:'Confirm your email',exact:true}).waitFor();
check(!(await cold.locator('#main').innerText()).includes('Fictional patient')&&await cold.getByRole('button',{name:'Edit list',exact:true}).count()===0,'Another email link hides the open account before asking to switch');
await cold.screenshot({path:path.join(OUT,'email-cross-browser-confirmation.png'),fullPage:true});await independent.close();
for(const lang of ['en','zh']){
 if(lang==='zh')await p.click('#language');
 for(const width of [320,390,1280]){
  await p.setViewportSize({width,height:900});
  for(const route of ['signin','signup','verify','recovery']){
   if(route==='signup')await click(lang==='en'?'Create an account':'建立帳戶');
   if(route==='verify'){
    await click(lang==='en'?'Back to sign in':'返回登入');await p.getByRole('button',{name:lang==='en'?'Enter a confirmation email code':'輸入確認電郵驗證碼',exact:true}).click();
   }
   if(route==='recovery'){await click(lang==='en'?'Back to sign in':'返回登入');await click(lang==='en'?'Forgot your password?':'唔記得密碼？');}
   check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${lang} ${width}px ${route} fits`);
   if(route==='recovery')await click(lang==='en'?'Back to sign in':'返回登入');
  }
 }
}
await p.click('#language');await p.setViewportSize({width:390,height:844});await click('Create an account');await p.click('#bigger');
check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Bigger-text signup fits phone width');await p.click('#bigger');
await p.screenshot({path:path.join(OUT,'account-registration-phone.png'),fullPage:true});
check(await p.evaluate(async()=>!(await navigator.serviceWorker.getRegistrations()).length),'Development account app has no service worker cache');
check(errors.length===0,'No account UI script errors: '+errors.join('; '));
console.log(`${checks-failed}/${checks} passed; ${failed} failed. Supabase traffic mocked; no email/account created.`);process.exitCode=failed?1:0;
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
