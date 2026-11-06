/* Browser checks for the November source additions; does not play or send audio. */
const {chromium}=require('playwright');
const ready=require('./wait-ready');
const fs=require('fs'),path=require('path'),os=require('os');
const BASE=process.argv[2]||'http://localhost:8000/';
const OUT=fs.mkdtempSync(path.join(os.tmpdir(),'herbbridge-data-'));
let failed=0;
const check=(ok,label)=>{console.log(`${ok?'✓':'✗'} ${label}`);if(!ok)failed++;};
(async()=>{
 const b=await chromium.launch();
 try{
  for(const lang of ['en','zh'])for(const mode of ['simple','full']){
   const c=await b.newContext({viewport:{width:390,height:844},serviceWorkers:'block'}),p=await c.newPage(),errors=[];
   p.on('pageerror',e=>errors.push(e.message));
   await p.goto(BASE);
   await p.evaluate(([lang,mode])=>{localStorage.setItem('herbsafe.v1',JSON.stringify({herbs:['liquorice','ginkgo'],drugs:['warfarin','clopidogrel'],lang}));localStorage.setItem('herbsafe.mode',mode);},[lang,mode]);
   for(const pair of ['liquorice-warfarin','ginkgo-clopidogrel']){
    await p.goto(BASE+'#/pair/'+pair);await p.reload();await ready(p);
    if(mode==='simple'){
     await p.locator('.more-btn').click();
     await p.locator('.card-toggle[aria-expanded="false"]').click();
    }
    const text=await p.locator('#app').innerText();
    const label=`${lang} ${mode} ${pair}`;
    check(pair==='liquorice-warfarin'?(lang==='en'?/Moderate risk/.test(text)&&/pound/.test(text)&&/ulcer/.test(text):/中度風險/.test(text)&&/一磅/.test(text)&&/胃潰瘍/.test(text)):(lang==='en'?/sources disagree/i.test(text)&&/single-dose/.test(text)&&/abstract/.test(text):/資料講法唔一致/.test(text)&&/單次/.test(text)&&/摘要/.test(text)),label+': evidence limits are visible and the correct warning leads');
    const links=await p.locator('#app .sources a').evaluateAll(nodes=>nodes.map(n=>n.href));
    check(links.some(url=>url.includes(pair==='liquorice-warfarin'?'PMC2999197':'PMC2000722')),label+': original clinical source is linked');
    const layout=await p.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,reads:[...document.querySelectorAll('.read-aloud')].filter(n=>n.offsetHeight).length}));
    check(!layout.overflow&&layout.reads>0,label+': phone layout fits and Read aloud is available');
    if(pair==='ginkgo-clopidogrel'){
     const order=await p.evaluate(()=>{const q=document.querySelector('.official-box'),m=document.querySelector('.main-source');return !!q&&!!m&&!!(q.compareDocumentPosition(m)&Node.DOCUMENT_POSITION_FOLLOWING);});
     check(order,label+': official caution appears before the limited trial');
    }
    if(lang==='en'&&mode==='full')await p.screenshot({path:path.join(OUT,pair+'.png'),fullPage:true});
   }
   await p.goto(BASE+'#/summary');await ready(p);
   check(await p.locator('.summary-row').count()===3,`${lang} ${mode}: summary includes the new Moderate row plus existing official rows`);
   await p.emulateMedia({media:'print'});
   const printed=await p.locator('#app').innerText();
   check(lang==='en'?/pound/.test(printed)&&/ulcer/.test(printed)&&/abstract/.test(printed):/一磅/.test(printed)&&/胃潰瘍/.test(printed)&&/摘要/.test(printed),`${lang} ${mode}: print includes case-report and trial-access limits`);
   check(errors.length===0,`${lang} ${mode}: no browser errors`);
   await c.close();
  }
  console.log('Screenshots: '+OUT);console.log(failed?`${failed} FAILED`:'Source additions: all checks passed');process.exitCode=failed?1:0;
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
