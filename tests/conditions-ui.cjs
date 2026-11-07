/* Conditions (G6PD, pregnancy) UI checks against a local copy of the public site. Fictional data. */
const {chromium}=require('playwright');const path=require('path');
let n=0;const check=(ok,label)=>{if(!ok)throw Error('FAIL '+label);n++;console.log('PASS '+label);};
const B='http://127.0.0.1:8013/';
(async()=>{const b=await chromium.launch();try{const c=await b.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});const p=await c.newPage();const errors=[],posts=[],foreign=[];p.on('pageerror',e=>errors.push(e.message));
await c.route('**/*',r=>{const u=new URL(r.request().url());if(u.origin!=='http://127.0.0.1:8013'){foreign.push(u.href);return r.abort();}if(r.request().method()!=='GET')posts.push(u.pathname);return r.continue();});
await p.goto(B+'#/cabinet');await p.evaluate(()=>{localStorage.clear();localStorage.setItem('herbsafe.v1',JSON.stringify({herbs:['danshen'],drugs:['losartan','aspirin'],lang:'en'}));});
await p.goto(B+'#/results');await p.reload();await p.locator('.reminder').first().waitFor();check(await p.locator('.condition-box').count()===0,'No condition box when nothing is recorded');
await p.goto(B+'#/log');await p.locator('#cond-g6pd').waitFor();check((await p.locator('.conditions-editor').innerText()).includes('Saved only on this device'),'About-me section explains it stays on this device');
await p.check('#cond-g6pd');await p.check('#cond-preg');await p.locator('#cond-preg-since').waitFor();check(true,'Pregnancy start date offered when pregnancy is ticked');
await p.fill('#cond-preg-since','2026-09-20');await p.locator('#cond-preg-since').dispatchEvent('change');
const st=await p.evaluate(()=>JSON.parse(localStorage.getItem('herbbridge.conditions.v1')));check(st.g6pd===true&&st.pregnancy.since==='2026-09-20','Conditions saved on this device');
await p.goto(B+'#/results');await p.reload();await p.locator('.condition-box').nth(1).waitFor();
const boxes=await p.locator('.condition-box').allInnerTexts();const g=boxes.find(t=>t.includes('G6PD')),q=boxes.find(t=>t.includes('Pregnancy'));
check(g&&g.includes('Aspirin group Antipyretics if used in high dose')&&g.includes('Family Health Service'),'G6PD box quotes the Department of Health word for word');
check(g.includes('For Aspirin:')&&g.includes('not yet checked these items for G6PD deficiency: Losartan, Danshen'),'G6PD box adds the aspirin note and lists unchecked items');
check(q&&q.includes('since 2026-09-20')&&q.includes('For Losartan:')&&q.includes('discontinue losartan potassium as soon as possible')&&q.includes('written for doctors'),'Pregnancy box shows the losartan label quote, marked as written for doctors');
check(q.includes('not yet checked these items for Pregnancy: Aspirin, Danshen'),'Pregnancy box lists items not yet checked');
check(boxes.every(t=>t.includes('Do not stop or change a medicine on your own')),'Every box says not to stop medicines on your own');
await p.goto(B+'#/summary');await p.locator('.condition-box').first().waitFor();check(true,'Doctor summary shows the condition cautions');
await p.click('#lang-toggle');await p.locator('.condition-box').first().waitFor();const z=(await p.locator('.condition-box').allInnerTexts()).join('|');check(z.includes('亞士匹靈')&&z.includes('唔好自己停藥'),'Chinese view shows the Chinese Department of Health quote');
await p.goto(B+'#/log');await p.getByRole('button',{name:'我已經唔再懷孕'}).click();check(!(await p.evaluate(()=>JSON.parse(localStorage.getItem('herbbridge.conditions.v1')).pregnancy)),'"No longer pregnant" removes the pregnancy record');
for(const w of [320,1280]){await p.setViewportSize({width:w,height:900});check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Fits at '+w+'px');}
check(posts.length===0&&foreign.length===0,'Nothing sent anywhere');check(errors.length===0,'No script errors: '+errors.join('; '));
await p.setViewportSize({width:390,height:844});await p.goto(B+'#/results');await p.locator('.condition-box').first().waitFor();await p.locator('.conditions').screenshot({path:path.join(__dirname,'conditions-zh.png')});
console.log(n+'/'+n+' condition checks passed.');}finally{await b.close();}})().catch(e=>{console.error(e.message);process.exitCode=1;});
