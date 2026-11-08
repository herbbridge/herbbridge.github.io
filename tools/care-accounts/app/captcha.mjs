/* Optional robot check (Cloudflare Turnstile) for sign-up, sign-in and recovery emails.
 * Off unless a site key is built in (HERBBRIDGE_CAPTCHA_SITE_KEY). Supabase checks the token
 * server-side only after CAPTCHA protection is switched on in the dashboard with the matching secret.
 * The Turnstile script is loaded from Cloudflare only when a form that needs it is shown. */
const SCRIPT='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
export function validSiteKey(key){return typeof key==='string'&&/^[0-9A-Za-z_-]{10,80}$/.test(key);}
export function createCaptcha(siteKey,{doc=globalThis.document,win=globalThis.window}={}){
 const enabled=validSiteKey(siteKey);let loading=null;
 function load(){
  if(!enabled)return Promise.resolve(null);
  if(win?.turnstile)return Promise.resolve(win.turnstile);
  if(!loading)loading=new Promise((resolve,reject)=>{const s=doc.createElement('script');s.src=SCRIPT;s.async=true;s.referrerPolicy='no-referrer';
   s.onload=()=>win.turnstile?resolve(win.turnstile):reject(new Error('captcha_unavailable'));s.onerror=()=>{loading=null;reject(new Error('captcha_unavailable'));};doc.head.appendChild(s);});
  return loading;
 }
 // Returns a box to put in a form, plus token()/reset(). Without a site key: an empty box and a null token.
 function widget(lang){
  const box=doc.createElement('div');box.className='captcha';let token=null,id=null;
  if(enabled)load().then(t=>{if(!box.isConnected&&!doc.body.contains(box))return;id=t.render(box,{sitekey:siteKey,language:lang==='zh'?'zh-tw':'en',callback:v=>{token=v;},'expired-callback':()=>{token=null;},'error-callback':()=>{token=null;}});}).catch(()=>{box.dataset.state='unavailable';});
  return {box,
   token(){if(!enabled)return null;if(!token)throw Object.assign(new Error('captcha_required'),{code:'captcha_required'});return token;},
   reset(){token=null;if(enabled&&id!==null&&win.turnstile)win.turnstile.reset(id);}};
 }
 return Object.freeze({enabled,widget});
}
