import {createClient} from '@supabase/supabase-js';
import {createAuthService,createTabStorage} from './auth-service.mjs';
import {createRoomUI,ROOM_WORDS,roomErrorKey} from './room-ui.mjs';
import {validateConfig} from '../client.mjs';
const config=__HERBBRIDGE_CONFIG__;
let callbackPending=new URLSearchParams(location.search).has('code');
validateConfig(config);
const storageKey='herbbridge-development-auth';
const client=createClient(config.url,config.publishableKey,{auth:{flowType:'pkce',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey,storage:createTabStorage(sessionStorage,localStorage)},global:{fetch:(input,options)=>fetch(input,{...options,cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer'})}});
const service=createAuthService(client,new URL('./',location.href).href);
const main=document.querySelector('#main');
const state={lang:localStorage.getItem('herbbridge.auth.language')==='zh'?'zh':'en',large:localStorage.getItem('herbbridge.auth.large')==='true',screen:'loading',user:null,profile:null,email:'',hint:{role:'patient',name:'',category:'chinese_medicine'},notice:null,busy:false,recovery:false};
const words={
 en:{development:'Development app · Use fictional patient information only',footer:'This account app is separate from the public medicine checker and the design preview.',bigger:'A+ Bigger text',loading:'Loading your account…',signin:'Sign in',signup:'Create an account',intro:'One account for your medicines and your care team.',email:'Email',password:'Password',passwordAgain:'Confirm password',newPassword:'New password',passwordHelp:'Use at least 10 characters. Your password is sent securely to Supabase, not saved in this page.',name:'Display name',role:'I am registering as',patient:'Patient',practitioner:'Doctor / practitioner',category:'Professional category',western_medicine:'Western-medicine doctor',chinese_medicine:'Chinese-medicine practitioner',registration:'Professional registration number',forgot:'Forgot your password?',back:'Back to sign in',verify:'Check your email',verifyBody:'If registration can proceed, you will receive a confirmation link. Open it in this browser to continue. Existing accounts should sign in or use password recovery.',resend:'Resend confirmation email',resendDone:'If confirmation is available for this address, a new email has been requested.',confirmNeeded:'Please confirm your email before signing in. You can resend the confirmation below.',recovery:'Recover your account',recoveryBody:'Enter your own email address. We will not reveal whether someone else has an account.',recoverySend:'Send recovery instructions',recoveryDone:'If the account exists and recovery is available, you will receive an email with instructions.',reset:'Choose a new password',resetBody:'This recovery session lets you update your password. Keep this page open until you finish.',savePassword:'Save new password',passwordSaved:'Password updated. Sign in with your new password.',finish:'Finish your account',finishBody:'Confirm your account type and details. Practitioner applications require a separate identity check.',finishSubmit:'Save account details',pending:'Application pending',pendingBody:'Your professional identity needs to be checked before you can connect with patients. Email confirmation does not verify your professional status.',rejected:'Application not approved',rejectedBody:'Your practitioner application has not been approved. Patient-room access is unavailable.',suspended:'Practitioner access suspended',suspendedBody:'You cannot access patient rooms while your practitioner account is suspended.',ready:'Your account is ready',patientReady:'Your patient account is saved. Connecting practitioners and managing your shared list are the next development stage.',doctorReady:'Your account is approved. Connected-patient rooms are the next development stage.',signout:'Sign out',signedout:'You are signed out on this device.',signedoutLocal:'You are signed out on this device. The server could not confirm revocation; no account information is kept open here.',retry:'Try again',loadFailed:'Your account could not be loaded. Check your connection and try again.',signinFailed:'Sign-in failed. Check your email and password, or use account recovery.',failed:'That action could not be completed. Check your connection and try again.',rate:'Too many requests. Please wait before trying again.',delivery:'The confirmation email could not be sent. Development email delivery may require the project owner’s address or a configured mail service.',weak:'Choose a password with at least 10 characters.',mismatch:'The passwords do not match.',expired:'This account link is invalid, expired or was opened in a different browser. Request a new confirmation or recovery email.',offline:'You are offline. Reconnect before continuing.',confirmConfig:'Email confirmation is required for this development app. Please ask the project owner to check the settings.',roleSet:'Your account type is already set. Sign out and sign in again to load it.',testOnly:'This is a development account. Do not enter patient medicine information here yet.',account:'Account',confirmed:'Email confirmed',enrolFailed:'Account details could not be saved. Your sign-in remains active; check your details and try again.',noRecovery:'Open a valid recovery email link to change your password.'},
 zh:{development:'開發版本 · 只可以用虛構病人資料',footer:'呢個帳戶版本同公開藥物查詢、設計預覽分開運作。',bigger:'A+ 放大字體',loading:'載入緊你嘅帳戶…',signin:'登入',signup:'建立帳戶',intro:'用同一個帳戶管理藥物清單同照護團隊。',email:'電郵',password:'密碼',passwordAgain:'再次輸入密碼',newPassword:'新密碼',passwordHelp:'請用最少10個字元。密碼會安全傳送去 Supabase，唔會儲存喺呢個頁面。',name:'顯示名稱',role:'註冊身份',patient:'病人',practitioner:'醫生／中醫師',category:'專業類別',western_medicine:'西醫',chinese_medicine:'中醫師',registration:'專業註冊編號',forgot:'唔記得密碼？',back:'返回登入',verify:'請查看電郵',verifyBody:'如果可以繼續註冊，你會收到確認連結。請喺呢個瀏覽器打開連結再繼續。已有帳戶可以登入或者重設密碼。',resend:'重新寄出確認電郵',resendDone:'如果呢個電郵可以重新確認，系統已提出寄信要求。',confirmNeeded:'請先確認電郵再登入。你可以喺下面重新索取確認電郵。',recovery:'重設帳戶登入',recoveryBody:'請輸入自己嘅電郵。系統唔會透露其他人有冇帳戶。',recoverySend:'寄出重設指示',recoveryDone:'如果帳戶存在而且可以重設，你會收到載有指示嘅電郵。',reset:'設定新密碼',resetBody:'呢個重設連線可以更新你嘅密碼，完成之前請保持頁面開啟。',savePassword:'儲存新密碼',passwordSaved:'密碼已更新，請用新密碼登入。',finish:'完成帳戶設定',finishBody:'請確認帳戶身份同資料。醫護申請需要另外核實專業身份。',finishSubmit:'儲存帳戶資料',pending:'申請等待審批',pendingBody:'你嘅專業身份核實之前，唔可以連結病人。確認電郵唔代表專業身份已獲核實。',rejected:'申請未獲批准',rejectedBody:'你嘅醫護申請未獲批准，暫時無法存取病人照護室。',suspended:'醫護存取已暫停',suspendedBody:'醫護帳戶暫停期間，唔可以存取病人照護室。',ready:'你嘅帳戶已經準備好',patientReady:'病人帳戶資料已儲存。連結醫護同管理共同清單係下一個開發步驟。',doctorReady:'帳戶已獲批准，已連結病人嘅照護室功能係下一個開發步驟。',signout:'登出',signedout:'你已經喺呢部裝置登出。',signedoutLocal:'你已經喺呢部裝置登出，但伺服器未能確認撤銷登入；呢度唔會繼續顯示帳戶資料。',retry:'再試',loadFailed:'未能載入帳戶，請檢查網絡再試。',signinFailed:'未能登入，請核對電郵同密碼，或者重設帳戶登入。',failed:'未能完成，請檢查網絡再試。',rate:'要求太頻密，請稍後再試。',delivery:'未能寄出確認電郵。開發版本可能只可以寄俾專案擁有者，或者需要設定寄信服務。',weak:'請設定最少10個字元嘅密碼。',mismatch:'兩次輸入嘅密碼唔相同。',expired:'連結無效、已過期，或者喺另一個瀏覽器打開。請重新索取確認或者重設電郵。',offline:'你而家離線，請重新連線再繼續。',confirmConfig:'開發版本必須確認電郵，請專案擁有者檢查設定。',roleSet:'帳戶身份已經設定，請登出再登入以載入帳戶。',testOnly:'呢個係開發帳戶，暫時唔好輸入病人藥物資料。',account:'帳戶',confirmed:'電郵已確認',enrolFailed:'未能儲存帳戶資料。你仍然保持登入，請核對資料再試。',noRecovery:'請先打開有效嘅重設電郵連結，再更改密碼。'}
};
Object.assign(words.en,{
 verifyBody:'Open the confirmation link in this browser. If you already opened it in another browser, try signing in here with your original password. Your email may already be confirmed.',
 resendDone:'This request does not guarantee another email. If your email is already confirmed, sign in instead. Otherwise, check your inbox and spam folder.',
 emailLimit:'The development email service has reached its sending limit. Check your latest confirmation email. If you already opened it, try signing in with your original password.',
 expired:'This link could not finish signing you in. If you opened a confirmation link, try signing in with your original password. Otherwise, request a new confirmation or recovery email in this browser.'
});
Object.assign(words.zh,{
 verifyBody:'請喺呢個瀏覽器打開確認連結。如果你已經喺另一個瀏覽器打開過，試吓喺呢度用原本密碼登入；你嘅電郵可能已經確認。',
 resendDone:'提出要求唔代表一定會再寄電郵。如果電郵已經確認，請直接登入；否則請查看收件匣同垃圾郵件。',
 emailLimit:'開發版本嘅寄信服務已達發送上限。請查看最近收到嘅確認電郵。如果已經打開過連結，可以試吓用原本密碼登入。',
 expired:'呢個連結未能完成登入。如果你打開過確認連結，請試吓用原本密碼登入；否則請喺呢個瀏覽器重新索取確認或者重設電郵。'
});
Object.assign(words.en,{reviewDesign:'Review the design without signing in'});Object.assign(words.zh,{reviewDesign:'唔登入都可以查看設計'});
Object.assign(words.en,ROOM_WORDS.en);Object.assign(words.zh,ROOM_WORDS.zh);
const rooms=createRoomUI({client,getProfile:()=>state.profile,getLang:()=>state.lang,run,renderRoot:render,notify:showNotice,clearNotice:()=>{state.notice=null;},isBusy:()=>state.busy});
const t=k=>words[state.lang][k]||k;
function el(tag,attrs={},children=[]){const node=document.createElement(tag);for(const[k,v]of Object.entries(attrs)){if(k==='text')node.textContent=v;else if(k==='on')node.onclick=v;else if(v!==false&&v!=null)node.setAttribute(k,v===true?'':v);}for(const child of [].concat(children))if(child!=null)node.append(child instanceof Node?child:document.createTextNode(child));return node;}
const p=(key,cls='')=>el('p',{text:t(key),class:cls});
const button=(key,action,primary=false)=>el('button',{type:'button',text:t(key),class:'button'+(primary?' primary':''),on:action});
const actions=(...nodes)=>el('div',{class:'actions'},nodes);
const card=(...nodes)=>el('section',{class:'card'},nodes);
function field(key,id,type='text',value='',options={}){return el('div',{class:'field'},[el('label',{for:id,text:t(key)}),el('input',{id,name:id,type,value,required:true,maxlength:type==='password'?128:120,autocomplete:type==='email'?'email':type==='password'?(state.screen==='signin'?'current-password':'new-password'):'off',...options})]);}
const submit=key=>el('button',{type:'submit',class:'button primary',text:t(key)});
function showNotice(key,error=false){state.notice={key,error};document.querySelector('#notice')?.remove();const node=el('div',{id:'notice',class:'notice'+(error?' error':''),role:error?'alert':'status','aria-live':'polite',text:t(key)});main.querySelector('h1')?.after(node);}
function go(screen){if(state.busy)return;state.screen=screen;state.notice=null;render();main.querySelector('h1')?.focus();window.scrollTo(0,0);}
function preservedRender(){const fields=[...main.querySelectorAll('input,select')].map(n=>({id:n.id,value:n.value,checked:n.checked}));render();for(const f of fields){const n=document.getElementById(f.id);if(n){n.value=f.value;if(n.type==='checkbox')n.checked=f.checked;}}}
function failure(error,fallback='failed'){
 const code=error?.code||'';
 if(!navigator.onLine)return 'offline';
 const roomFailure=roomErrorKey(error);if(roomFailure)return roomFailure;
 if(code==='over_email_send_rate_limit')return 'emailLimit';
 if(code.includes('rate_limit')||error?.status===429)return 'rate';
 if(code==='email_not_confirmed')return 'confirmNeeded';
 if(code==='weak_password')return 'weak';
 if(['email_address_not_authorized','email_address_invalid','over_email_send_rate_limit'].includes(code))return 'delivery';
 if(error?.message==='confirmation_configuration')return 'confirmConfig';
 if(error?.code==='42501'&&error?.message?.includes('already set'))return 'roleSet';
 return fallback;
}
async function run(work,success,fallback='failed'){
 if(state.busy)return;const operationGeneration=generation;state.busy=true;main.setAttribute('aria-busy','true');
 const controls=[...document.querySelectorAll('button,input,select,textarea')].map(n=>[n,n.disabled]);controls.forEach(([n])=>n.disabled=true);
 try{if(!navigator.onLine)throw new Error('offline');const result=await work();state.busy=false;await success?.(result);}
 catch(error){if(operationGeneration===generation&&error?.code!=='HB_stale')showNotice(failure(error,fallback),true);}
 finally{state.busy=false;main.setAttribute('aria-busy','false');controls.forEach(([n,disabled])=>{n.disabled=disabled;});if(operationGeneration!==generation)render();}
}
function identityFields(setup=false){
 const role=el('select',{id:'account-role',name:'account-role'},['patient','practitioner'].map(k=>el('option',{value:k,selected:state.hint.role===k,text:t(k)})));
 role.onchange=()=>{state.hint.role=role.value;const name=document.querySelector('#display-name');if(name)state.hint.name=name.value;preservedRender();document.querySelector('#account-role').value=state.hint.role;};
 const fields=[el('div',{class:'field'},[el('label',{for:'account-role',text:t('role')}),role]),field('name','display-name','text',state.hint.name,{autocomplete:'nickname',maxlength:120})];
 if(state.hint.role==='practitioner')fields.push(el('div',{class:'field'},[el('label',{for:'category',text:t('category')}),el('select',{id:'category',name:'category'},['chinese_medicine','western_medicine'].map(k=>el('option',{value:k,selected:state.hint.category===k,text:t(k)})))]));
 if(setup&&state.hint.role==='practitioner')fields.push(field('registration','registration-reference','text','',{maxlength:160}));
 return fields;
}
function signin(){
 const form=el('form',{},[field('email','email','email',state.email),field('password','password','password'),submit('signin')]);
 form.onsubmit=e=>{e.preventDefault();const f=new FormData(form);state.email=f.get('email').trim();run(()=>service.signin(state.email,f.get('password')),async()=>{await refreshAccount();},'signinFailed');};
 return [p('intro','intro'),el('p',{},[el('a',{href:'./design/',text:t('reviewDesign')})]),card(form,actions(button('signup',()=>go('signup')),button('forgot',()=>go('recovery'))),el('button',{type:'button',class:'link',text:t('resend'),on:()=>go('verify')}))];
}
function signup(){
 const form=el('form',{},[...identityFields(),field('email','email','email',state.email),field('password','password','password','',{minlength:10}),field('passwordAgain','confirm-password','password','',{minlength:10}),p('passwordHelp','small muted'),submit('signup')]);
 form.onsubmit=e=>{e.preventDefault();const f=new FormData(form);if(f.get('password')!==f.get('confirm-password'))return showNotice('mismatch',true);state.email=f.get('email').trim();state.hint={role:f.get('account-role'),name:f.get('display-name').trim(),category:f.get('category')||'chinese_medicine'};run(()=>service.signup({email:state.email,password:f.get('password'),...state.hint}),()=>go('verify'));};
 return [p('intro','intro'),card(form),actions(button('back',()=>go('signin')))];
}
function emailForm(kind){
 const send=submit(kind==='verify'?'resend':'recoverySend');if(kind==='verify')send.className='button';
 const form=el('form',{},[field('email','email','email',state.email),send]);
 form.onsubmit=e=>{e.preventDefault();state.email=new FormData(form).get('email').trim();run(()=>kind==='verify'?service.resend(state.email):service.recover(state.email),()=>showNotice(kind==='verify'?'resendDone':'recoveryDone'));};
 return [p(kind==='verify'?'verifyBody':'recoveryBody','intro'),...(kind==='verify'?[actions(button('back',()=>go('signin'),true))]:[]),card(form),...(kind==='recovery'?[actions(button('back',()=>go('signin')))]:[])];
}
function finish(){
 const form=el('form',{},[...identityFields(true),submit('finishSubmit')]);
 form.onsubmit=e=>{e.preventDefault();const f=new FormData(form);run(()=>service.enrol({role:f.get('account-role'),name:f.get('display-name'),category:f.get('category'),registration:f.get('registration-reference')}),()=>refreshAccount(),'enrolFailed');};
 return [p('finishBody','intro'),p('confirmed','status'),card(form),actions(button('signout',signout))];
}
function resetPassword(){
 if(!state.recovery||!state.user)return [p('noRecovery'),actions(button('recovery',()=>go('recovery')))];
 const form=el('form',{},[field('newPassword','password','password','',{minlength:10}),field('passwordAgain','confirm-password','password','',{minlength:10}),submit('savePassword')]);
 form.onsubmit=e=>{e.preventDefault();const f=new FormData(form);if(f.get('password')!==f.get('confirm-password'))return showNotice('mismatch',true);run(()=>service.password(f.get('password')),async()=>{await signout();showNotice('passwordSaved');});};
 return [p('resetBody','intro'),card(form)];
}
function account(){
 const profile=state.profile;if(!profile)return [actions(button('retry',()=>refreshAccount()))];
 if(rooms.active)return [...(profile.is_demo?[p('demoPractitioner','notice')]:[]),...rooms.render(),actions(button('signout',signout))];
 const status=profile.account_role==='practitioner'?profile.approval_status:null;
 return [card(el('h2',{text:profile.display_name}),p(profile.account_role,'status'),p(status==='pending'?'pendingBody':status==='rejected'?'rejectedBody':status==='suspended'?'suspendedBody':status==='approved'?'doctorReady':'patientReady'),p('testOnly','small muted')),actions(button('signout',signout))];
}
function render(){
 document.documentElement.lang=state.lang==='zh'?'zh-HK':'en-GB';document.documentElement.classList.toggle('large',state.large);
 document.querySelector('#development').textContent=t('development');document.querySelector('#footer').textContent=t('footer');document.querySelector('#bigger').textContent=t('bigger');document.querySelector('#bigger').setAttribute('aria-pressed',String(state.large));document.querySelector('#language').textContent=state.lang==='en'?'繁體中文':'English';document.querySelector('#language').disabled=state.busy;document.querySelector('#bigger').disabled=state.busy;
 let title=state.screen;
 if(title==='account'){const status=state.profile?.approval_status;title=['pending','rejected','suspended'].includes(status)?status:'ready';}
 const view={signin,signup,verify:()=>emailForm('verify'),recovery:()=>emailForm('recovery'),finish,reset:resetPassword,account,loading:()=>[p('loading')],loadError:()=>[p('loadFailed'),actions(button('retry',()=>refreshAccount()),button('signout',signout))]};
 main.replaceChildren(el('p',{class:'eyebrow',text:'HerbBridge'}),el('h1',{text:state.screen==='account'&&rooms.active?rooms.title():t(title),tabindex:'-1'}),...(view[state.screen]||signin)().filter(node=>node!=null));main.setAttribute('aria-busy',String(state.busy));if(state.busy)document.querySelectorAll('button,input,select,textarea').forEach(n=>n.disabled=true);if(state.notice)showNotice(state.notice.key,state.notice.error);
}
let generation=0;
async function refreshAccount(){
 const ticket=++generation;rooms.clear();state.profile=null;state.screen='loading';state.notice=null;render();
 try{
  const session=await service.session();if(ticket!==generation)return;
  if(!session){state.user=null;state.recovery=false;state.screen='signin';if(callbackPending){callbackPending=false;state.notice={key:'expired',error:true};history.replaceState({},'',location.pathname);}render();return;}
  const user=await service.user();if(ticket!==generation)return;state.user=user;
  if(!user?.email_confirmed_at){state.email=user?.email||state.email;await service.signout();eraseLocalSession();state.user=null;state.screen='verify';state.notice={key:'confirmNeeded',error:true};render();return;}
  const profile=await service.profile(user);if(ticket!==generation)return;state.profile=profile;
  if(state.recovery)state.screen='reset';
  else if(profile)state.screen='account';
  else{const meta=user.user_metadata||{};state.hint={role:meta.registration_role==='practitioner'?'practitioner':'patient',name:typeof meta.display_name==='string'?meta.display_name.slice(0,120):'',category:meta.professional_category==='western_medicine'?'western_medicine':'chinese_medicine'};state.screen='finish';}
  callbackPending=false;history.replaceState({},'',location.pathname);render();
  if(state.screen==='account'&&(profile.account_role==='patient'||profile.approval_status==='approved')){await rooms.start(profile);if(ticket!==generation)return;}
 }catch(error){if(ticket!==generation)return;state.screen=callbackPending?'signin':'loadError';state.profile=null;state.notice={key:callbackPending?'expired':failure(error,'loadFailed'),error:true};if(callbackPending){callbackPending=false;history.replaceState({},'',location.pathname);}render();}
}
function eraseLocalSession(){sessionStorage.removeItem(storageKey);sessionStorage.removeItem(storageKey+'-user');for(const key of Object.keys(localStorage))if(key.startsWith(storageKey)&&key.endsWith('-code-verifier'))localStorage.removeItem(key);}
const signoutChannel=typeof BroadcastChannel==='function'?new BroadcastChannel('herbbridge-development-signout'):null;
let signingOut=false;
async function signout(){
 if(signingOut)return;signingOut=true;generation++;rooms.clear();state.busy=true;state.user=null;state.profile=null;state.recovery=false;state.screen='signin';state.notice=null;render();
 let notice='signedout';
 try{await service.signout();}catch{notice='signedoutLocal';}
 finally{eraseLocalSession();signingOut=false;state.busy=false;render();showNotice(notice,notice==='signedoutLocal');signoutChannel?.postMessage('signedout');}
}

signoutChannel?.addEventListener('message',event=>{if(event.data==='signedout'){generation++;rooms.clear();eraseLocalSession();state.user=null;state.profile=null;state.recovery=false;state.screen='signin';state.notice=null;render();showNotice('signedout');}});
client.auth.onAuthStateChange((event,session)=>{
 if(signingOut)return;
 if(event==='PASSWORD_RECOVERY')state.recovery=true;
 if(event==='SIGNED_OUT'){generation++;rooms.clear();eraseLocalSession();state.user=null;state.profile=null;state.recovery=false;state.screen='signin';render();}
 else if(event==='SIGNED_IN'||event==='PASSWORD_RECOVERY'){
  if(event==='SIGNED_IN'&&state.screen==='account'&&state.profile&&state.user?.id===session?.user?.id)return;
  if(state.user?.id!==session?.user?.id){rooms.clear();state.profile=null;state.user=null;}
  setTimeout(()=>{if(!state.busy)void refreshAccount();},0);
 }
});
document.querySelector('#language').onclick=()=>{if(state.busy)return;state.lang=state.lang==='en'?'zh':'en';localStorage.setItem('herbbridge.auth.language',state.lang);preservedRender();};
document.querySelector('#bigger').onclick=()=>{if(state.busy)return;state.large=!state.large;localStorage.setItem('herbbridge.auth.large',String(state.large));preservedRender();};
window.addEventListener('offline',()=>{rooms.connectionLost();showNotice('offline',true);});
const authError=new URLSearchParams(location.search).has('error')||new URLSearchParams(location.hash.slice(1)).has('error');
if(authError){history.replaceState({},'',location.pathname);state.screen='signin';state.notice={key:'expired',error:true};render();}
else void refreshAccount();
