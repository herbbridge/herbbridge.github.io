const {chromium}=require('playwright');const path=require('path');
let n=0;const check=(ok,label)=>{if(!ok)throw Error('FAIL '+label);n++;console.log('PASS '+label);};
(async()=>{const b=await chromium.launch();try{const c=await b.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});const p=await c.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
await p.goto('http://127.0.0.1:8013/#/cabinet');await p.evaluate(()=>localStorage.setItem('herbsafe.v1',JSON.stringify({herbs:['danshen'],drugs:['warfarin'],lang:'en'})));
await p.goto('http://127.0.0.1:8013/#/results');await p.reload();await p.locator('.reminder').waitFor();
const t=await p.locator('.reminder').innerText();check(t.includes('at least 1-2 hours')&&t.includes('cannot avoid any potential interactions'),'Results show the Hospital Authority reminder word for word, including its limit');
check(t.includes('not about your particular medicines'),'Reminder says it is general advice');
check((await p.locator('.reminder a').getAttribute('href'))==='https://www3.ha.org.hk/ehaslink/issue132/en/feature-3.html','Reminder links to the source');
await p.goto('http://127.0.0.1:8013/#/summary');await p.locator('.reminder').waitFor();check(true,'Doctor summary shows the reminder');
await p.click('#lang-toggle');await p.locator('.reminder').waitFor();const z=await p.locator('.reminder').innerText();check(z.includes('一至兩小時')&&z.includes('醫院管理局'),'Chinese reminder shown in Chinese');
await p.evaluate(()=>localStorage.setItem('herbsafe.v1',JSON.stringify({herbs:[],drugs:['warfarin'],lang:'en'})));await p.goto('http://127.0.0.1:8013/#/summary');await p.reload();await p.waitForTimeout(800);check(await p.locator('.reminder').count()===0,'Not shown when there are no Chinese herbs');
for(const w of [320,1280]){await p.setViewportSize({width:w,height:900});check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Fits at '+w+'px');}
check(errors.length===0,'No script errors: '+errors.join('; '));console.log(n+'/'+n+' reminder checks passed.');}finally{await b.close();}})().catch(e=>{console.error(e.message);process.exitCode=1;});
