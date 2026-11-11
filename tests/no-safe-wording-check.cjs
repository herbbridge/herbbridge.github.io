const {chromium}=require('playwright');const fs=require('fs');const U=process.argv[2];
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
await ctx.route('https://herbbridge.org/js/i18n.js*',r=>r.fulfill({status:200,contentType:'text/javascript',body:fs.readFileSync(U+'/03_App_Code/js/i18n.js')}));
const p=await ctx.newPage();const e=[];p.on('pageerror',x=>e.push(x.message));
const herbs=JSON.parse(await (await fetch('https://herbbridge.org/data/herbs.json')).text());const drugs=JSON.parse(await (await fetch('https://herbbridge.org/data/drugs.json')).text());const ints=JSON.parse(await (await fetch('https://herbbridge.org/data/interactions.json')).text());
const H=(herbs.herbs||herbs).map(h=>h.id),Dd=(drugs.drugs||drugs).map(d=>d.id);const list=(ints.interactions||ints);const has=(h,d)=>list.some(i=>i.herb===h&&(i.drug===d||i.drug_class));
const pair='danshen simvastatin'.split(' ');
await p.goto('https://herbbridge.org/');await p.evaluate(pr=>{localStorage.setItem('herbsafe.v1',JSON.stringify({herbs:[pr[0]],drugs:[pr[1]],lang:'en'}));},pair);
for(const lang of ['en','zh']){await p.evaluate(l=>{const s=JSON.parse(localStorage.getItem('herbsafe.v1'));s.lang=l;localStorage.setItem('herbsafe.v1',JSON.stringify(s));},lang);
 for(const route of ['#/cabinet','#/results','#/summary']){await p.goto('https://herbbridge.org/'+route);await p.reload();await p.waitForTimeout(1200);const t=await p.locator('body').innerText();console.log(lang,route,'| safe/安全 present:',/\bsafe\b/i.test(t)||t.includes('安全'),'| new wording:',/don’t know if|唔知會唔會有問題|講唔到會唔會有問題/.test(t));}}
console.log('pair used',pair,'errors',e.length);await b.close();})();
