// UI operations depend on the official Supabase Auth client. No fake account state.
// A robot-check token is only sent when the optional CAPTCHA is turned on.
const cap=token=>token?{captchaToken:token}:{};
export function createAuthService(client,origin){
 const redirectTo=new URL('./',origin).href;
 return Object.freeze({
  session:async()=>{const {data,error}=await client.auth.getSession();if(error)throw error;return data.session;},
  user:async()=>{const {data,error}=await client.auth.getUser();if(error)throw error;return data.user;},
  signup:async({email,password,role,name,category,captchaToken})=>{
   const {data,error}=await client.auth.signUp({email:email.trim(),password,options:{emailRedirectTo:redirectTo,...cap(captchaToken),data:{registration_role:role,display_name:name.trim(),professional_category:role==='practitioner'?category:null}}});
   if(error){if(['user_already_exists','email_exists'].includes(error.code))return {user:null,session:null};throw error;}
   // The development project requires confirmation. Never enrol from unverified metadata.
   if(data.session){await client.auth.signOut({scope:'local'});throw new Error('confirmation_configuration');}
   return data;
  },
  signin:async(email,password,captchaToken)=>{const {data,error}=await client.auth.signInWithPassword({email:email.trim(),password,...(captchaToken?{options:{captchaToken}}:{})});if(error)throw error;return data;},
  resend:async(email,captchaToken)=>{const {error}=await client.auth.resend({type:'signup',email:email.trim(),options:{emailRedirectTo:redirectTo,...cap(captchaToken)}});if(error&&!['user_not_found','email_not_found','email_already_confirmed'].includes(error.code))throw error;},
  recover:async(email,captchaToken)=>{const {error}=await client.auth.resetPasswordForEmail(email.trim(),{redirectTo,...cap(captchaToken)});if(error&&!['user_not_found','email_not_found'].includes(error.code))throw error;},
  verify:async({email,token,token_hash,type})=>{
   if(!['email','recovery'].includes(type))throw new Error('invalid_confirmation');
   const payload=token_hash?{token_hash,type}:{email:email.trim(),token:token.trim(),type};
   const {data,error}=await client.auth.verifyOtp(payload);if(error)throw error;return data;
  },
  password:async password=>{const {error}=await client.auth.updateUser({password});if(error)throw error;},
  signout:async()=>{const {error}=await client.auth.signOut({scope:'local'});if(error)throw error;},
  profile:async(verifiedUser=null)=>{
   // RLS determines which profile is readable; getUser provides the verified caller ID.
   let user=verifiedUser;if(!user){const {data,error}=await client.auth.getUser();if(error)throw error;user=data.user;}
   if(!user)throw new Error('signed_out');
   const {data,error}=await client.from('profiles').select('id,account_role,display_name').eq('id',user.id).maybeSingle();if(error)throw error;
   if(!data)return null;
   if(data.account_role==='practitioner'){
    const {data:practitioner,error:problem}=await client.from('practitioner_accounts').select('category,approval_status,is_demo').eq('id',data.id).single();if(problem)throw problem;
    return {...data,...practitioner};
   }
   return data;
  },
  enrol:async({role,name,category,registration})=>{
   const {data,error}=await client.rpc('complete_registration',{p_account_role:role,p_display_name:name.trim(),p_category:role==='practitioner'?category:null,p_registration_reference:role==='practitioner'?registration.trim():null});
   if(error)throw error;return data;
  }
 });
}
export function createTabStorage(session,local){
 // Session tokens stay in this tab. Only the PKCE verifier crosses confirmation tabs.
 return {getItem:key=>(key.endsWith('-code-verifier')?local:session).getItem(key),setItem:(key,value)=>(key.endsWith('-code-verifier')?local:session).setItem(key,value),removeItem:key=>(key.endsWith('-code-verifier')?local:session).removeItem(key)};
}

// Read before creating the Auth client; token hashes never enter storage or host requests.
export function readEmailChallenge(href){
 const url=new URL(href),query=url.searchParams,hash=new URLSearchParams(url.hash.slice(1));
 const source=hash.has('token_hash')?hash:query;
 if(!source.has('token_hash'))return null;
 const token_hash=source.get('token_hash'),type=source.get('type');
 if(!token_hash||token_hash.length>512||!['email','recovery'].includes(type))return {invalid:true};
 return {token_hash,type};
}
