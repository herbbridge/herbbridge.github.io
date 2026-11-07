import {test} from 'node:test';import assert from 'node:assert/strict';
import {createAuthService,createTabStorage} from '../app/auth-service.mjs';
const origin='http://127.0.0.1:8012';
test('signup never submits professional reference or approval metadata',async()=>{
 let payload;const api=createAuthService({auth:{signUp:async input=>{payload=input;return {data:{session:null,user:null},error:null};}}},origin);
 await api.signup({email:' fictional@example.test ',password:'Fictional-Password',role:'practitioner',name:' Applicant ',category:'chinese_medicine',approval_status:'approved',registration_reference:'PRIVATE'});
 assert.deepEqual(Object.keys(payload.options.data).sort(),['display_name','professional_category','registration_role']);assert.equal(payload.options.emailRedirectTo,origin+'/');
});
test('unexpected signup session is closed rather than treated as confirmation',async()=>{
 let closed=false;const api=createAuthService({auth:{signUp:async()=>({data:{session:{},user:{}},error:null}),signOut:async()=>{closed=true;return {error:null};}}},origin);
 await assert.rejects(()=>api.signup({email:'a@example.test',password:'Fictional-Password',role:'patient',name:'A'}),/confirmation_configuration/);assert.equal(closed,true);
});
test('duplicate signup and absent recovery account do not disclose existence',async()=>{
 const api=createAuthService({auth:{signUp:async()=>({data:null,error:{code:'user_already_exists'}}),resetPasswordForEmail:async()=>({error:{code:'user_not_found'}}),resend:async()=>({error:{code:'email_already_confirmed'}})}},origin);
 await api.signup({email:'a@example.test',password:'Fictional-Password',role:'patient',name:'A'});await api.recover('a@example.test');await api.resend('a@example.test');
});
test('storage keeps session tokens in the tab and only PKCE state shared',()=>{
 const store=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};};
 const tab=store(),shared=store(),storage=createTabStorage(tab,shared);
 storage.setItem('hb-auth','fictional-session');storage.setItem('hb-auth-flow-123-code-verifier','fictional-verifier');
 assert.equal(tab.getItem('hb-auth'),'fictional-session');assert.equal(shared.getItem('hb-auth'),null);assert.equal(shared.getItem('hb-auth-flow-123-code-verifier'),'fictional-verifier');
});
test('enrolment sends no caller identity or approval override',async()=>{
 let args;const api=createAuthService({rpc:async(name,input)=>{args={name,input};return {data:{},error:null};}},origin);
 await api.enrol({role:'patient',name:' Applicant ',category:'western_medicine',registration:'ignored',actor_id:'another-user',approval_status:'approved'});
 assert.equal(args.name,'complete_registration');assert.deepEqual(args.input,{p_account_role:'patient',p_display_name:'Applicant',p_category:null,p_registration_reference:null});
});

test('hosted account callbacks stay inside the accounts folder',async()=>{
 let options;const client={auth:{resend:async input=>{options=input;return {};}}};
 await createAuthService(client,'https://herbbridge.org/accounts/').resend('fictional@example.test');
 assert.equal(options.options.emailRedirectTo,'https://herbbridge.org/accounts/');
});

test('email codes and token links use independent-browser verification without a PKCE verifier',async()=>{
 const payloads=[];const api=createAuthService({auth:{verifyOtp:async p=>{payloads.push(p);return {data:{session:{}},error:null};}}},origin);
 await api.verify({email:' fictional@example.test ',token:' 123456 ',type:'email'});
 await api.verify({token_hash:'fictional-token-hash',type:'recovery'});
 assert.deepEqual(payloads,[{email:'fictional@example.test',token:'123456',type:'email'},{token_hash:'fictional-token-hash',type:'recovery'}]);
 await assert.rejects(()=>api.verify({token_hash:'fictional',type:'invite'}),/invalid_confirmation/);
});
test('expired code is surfaced without returning a fabricated session',async()=>{
 const expired={code:'otp_expired'};const api=createAuthService({auth:{verifyOtp:async()=>({data:null,error:expired})}},origin);
 await assert.rejects(()=>api.verify({email:'fictional@example.test',token:'123456',type:'email'}),e=>e===expired);
});
test('email callback accepts only confirmation and recovery and keeps legacy PKCE untouched',async()=>{
 const {readEmailChallenge}=await import('../app/auth-service.mjs');
 assert.deepEqual(readEmailChallenge(origin+'/#token_hash=fictional&type=email'),{token_hash:'fictional',type:'email'});
 assert.deepEqual(readEmailChallenge(origin+'/?token_hash=fictional&type=recovery'),{token_hash:'fictional',type:'recovery'});
 for(const tail of ['#token_hash=&type=email','#token_hash=fictional&type=invite','#token_hash=fictional'])assert.deepEqual(readEmailChallenge(origin+'/'+tail),{invalid:true});
 assert.equal(readEmailChallenge(origin+'/?code=legacy-code'),null);
});
