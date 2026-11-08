import {test} from 'node:test';import assert from 'node:assert/strict';
import {createCaptcha,validSiteKey} from '../app/captcha.mjs';
test('no site key: CAPTCHA stays off and loads nothing',()=>{
 let added=0;const doc={createElement:()=>({className:'',dataset:{}}),head:{appendChild:()=>{added++;}},body:{contains:()=>true}};
 const c=createCaptcha('',{doc,win:{}});assert.equal(c.enabled,false);const w=c.widget('en');assert.equal(w.token(),null);w.reset();assert.equal(added,0);
});
test('site key validation rejects secrets and junk',()=>{
 assert.equal(validSiteKey('1x00000000000000000000AA'),true);assert.equal(validSiteKey('0x4AAAA<script>'),false);assert.equal(validSiteKey('short'),false);assert.equal(validSiteKey(undefined),false);
});
test('with a site key, submitting before the check is done is refused',()=>{
 const doc={createElement:()=>({className:'',dataset:{}}),head:{appendChild:()=>{}},body:{contains:()=>true}};
 const c=createCaptcha('1x00000000000000000000AA',{doc,win:{turnstile:{render:()=>1,reset:()=>{}}}});assert.equal(c.enabled,true);
 assert.throws(()=>c.widget('zh').token(),/captcha_required/);
});
