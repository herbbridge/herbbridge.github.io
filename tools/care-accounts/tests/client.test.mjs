import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createBackendClient,validateConfig} from '../client.mjs';
const config={url:'https://fictional-development.supabase.co',publishableKey:'sb_publishable_fictional_test_key'};
const room='10000000-0000-4000-8000-000000000001';
test('adapter refuses privileged keys and unapproved origins',()=>{
 for(const key of ['sb_secret_never-use-this','service_role','eyJhbGciOiJIUzI1NiJ9'])assert.throws(()=>validateConfig({...config,publishableKey:key}));
 for(const url of ['http://example.com','https://attacker.test','https://fictional.supabase.co/?token=x','https://user:password@fictional.supabase.co'])assert.throws(()=>validateConfig({...config,url}));
});
test('signed-out read makes no network request',async()=>{
 let called=false;const api=createBackendClient(config,{getAccessToken:()=>null,fetchImpl:()=>{called=true;}});
 await assert.rejects(()=>api.listRooms(),/Sign in/);assert.equal(called,false);
});
test('reads request current session and never cache private responses',async()=>{
 let session='fictional-session-one';const calls=[];
 const api=createBackendClient(config,{getAccessToken:()=>session,fetchImpl:async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>[]};}});
 await api.listMedicines(room);session='fictional-session-two';await api.listRooms();
 assert.equal(calls[0].options.headers.Authorization,'Bearer fictional-session-one');assert.equal(calls[1].options.headers.Authorization,'Bearer fictional-session-two');
 for(const {options} of calls){assert.equal(options.cache,'no-store');assert.equal(options.credentials,'omit');assert.equal(options.referrerPolicy,'no-referrer');assert.equal(options.redirect,'error');}
});
test('invalid room reference cannot change endpoint or filter',()=>{
 const api=createBackendClient(config,{getAccessToken:()=>''});assert.throws(()=>api.readRoom('x&select=*'));
});
test('denial and network failure never become empty success or cached data',async()=>{
 for(const fetchImpl of [async()=>({ok:false,status:403}),async()=>{throw new Error('offline');}]){
 const api=createBackendClient(config,{getAccessToken:()=>'fictional-session',fetchImpl});await assert.rejects(()=>api.listRooms());
 }
});
test('adapter rejects unexpected response format',async()=>{
 const api=createBackendClient(config,{getAccessToken:()=>'fictional-session',fetchImpl:async()=>({ok:true,json:async()=>({unexpected:true})})});await assert.rejects(()=>api.listRooms(),/Unexpected/);
});
