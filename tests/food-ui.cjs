/* Food hint + reminder UI checks (local copy, fictional list). */
const {chromium}=require('playwright');let n=0;const check=(ok,l)=>{if(!ok)throw Error('FAIL '+l);n++;console.log('PASS '+l);};
(async()=>{const b=await chromium.launch();try{const c=await b.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});const p=await c.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
await p.goto('http://127.0.0.1:8013/#/cabinet');await p.evaluate(()=>{localStorage.clear();localStorage.setItem('herbsafe.v1',JSON.stringify({herbs:['danshen'],drugs:['simvastatin','amlodipine'],lang:'en'}));});
await p.goto('http://127.0.0.1:8013/#/results');await p.reload();await p.locator('.reminder-food').waitFor();
const t=await p.locator('.reminder-food').innerText();check(t.includes('Food hint: Simvastatin')&&t.includes('Avoid grapefruit juice when taking simvastatin')&&t.includes('not a ban'),'Simvastatin food hint quotes the label and says it is a hint, not a ban');
check(await p.locator('.reminder-food').count()===1,'No food hint invented for amlodipine');
check((await p.locator('.reminder').allInnerTexts()).some(x=>x.includes('at least 1-2 hours')),'General Hospital Authority reminder still shown');
await p.click('#lang-toggle');await p.locator('.reminder-food').waitFor();const z=await p.locator('.reminder-food').innerText();check(z.includes('飲食提示')&&z.includes('英文原文')&&z.includes('grapefruit'),'Chinese view labels the English original');
await p.goto('http://127.0.0.1:8013/#/summary');await p.locator('.reminder-food').waitFor();check(true,'Food hint in doctor summary');
check(errors.length===0,'No script errors: '+errors.join('; '));console.log(n+'/'+n+' food hint checks passed.');}finally{await b.close();}})().catch(e=>{console.error(e.message);process.exitCode=1;});
