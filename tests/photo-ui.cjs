/* Run from a machine with Playwright: serve this folder at http://127.0.0.1:8013 (python3 -m http.server 8013), put test images box.jpg (a box photo showing "clopidogrel") and blank.jpg next to this file, then: node tests/photo-ui.cjs */
/* Identify-from-photo UI checks against a local copy of the public site (synthetic test images only). */
const {chromium}=require('playwright');const path=require('path');
let n=0;const check=(ok,label)=>{if(!ok)throw Error('FAIL '+label);n++;console.log('PASS '+label);};
const BASE='http://127.0.0.1:8013/';
(async()=>{const browser=await chromium.launch();try{
 const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
 const foreign=[],local=[];const uploads=[];
 await context.route('**/*',route=>{const r=route.request(),u=new URL(r.url());if(u.origin!=='http://127.0.0.1:8013'){foreign.push(u.href);return route.abort();}local.push(u.pathname);if(r.method()!=='GET')uploads.push(u.pathname);return route.continue();});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(BASE+'#/cabinet');
 check(await page.getByRole('button',{name:'Scan a medicine pack'}).count()===0,'Barcode button stays hidden while the barcode feature is on hold');
 await page.getByRole('button',{name:'Identify from a photo'}).click();
 await page.getByRole('heading',{name:'Identify from a photo'}).waitFor();
 check(!local.some(p=>p.includes('/vendor/tesseract/')),'Text reader is not downloaded until a photo is chosen');
 const t0=Date.now();
 await page.setInputFiles('#photo-file',path.join(__dirname,'box.jpg'));
 await page.getByRole('heading',{name:'Which one is on your box?'}).waitFor({timeout:120000});
 console.log('  (read in '+((Date.now()-t0)/1000).toFixed(1)+' s, first run incl. downloads)');
 const first=await page.locator('.photo-candidates .scan-option').first().innerText();
 check(/Clopidogrel/.test(first),'Photo of a box with "clopidogrel 75 mg / 氯吡格雷" → Clopidogrel is the first suggestion: '+first.replace(/\n/g,' | '));
 check(/Words found:/.test(first),'Suggestion shows which words on the box matched');
 check(local.some(p=>p.endsWith('/lang/eng.traineddata.gz'))&&local.some(p=>p.endsWith('/lang/chi_tra.traineddata.gz')),'English and Chinese reading models load from HerbBridge itself');
 check(uploads.length===0,'Photo is not uploaded anywhere (no POST/PUT requests)');
 const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('herbsafe.v1')||'{}').drugs||[]);check(!before.includes('clopidogrel'),'Nothing added before confirming');
 await page.locator('.photo-candidates .scan-option').first().click();
 await page.getByRole('heading',{name:'Is this your medicine?'}).waitFor();
 check((await page.locator('.photo-sheet').innerText()).includes('Check that this name matches'),'Confirm screen asks the person to compare with the box');
 await page.getByRole('button',{name:'Yes, add to my list'}).click();await page.locator('.photo-sheet').waitFor({state:'detached'});
 const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('herbsafe.v1')||'{}').drugs||[]);check(after.includes('clopidogrel'),'Confirming adds clopidogrel to the list');
 check(await page.evaluate(()=>!document.querySelector('#main').hasAttribute('inert')),'Page restored after closing');
 // A photo with no readable name
 await page.getByRole('button',{name:'Identify from a photo'}).click();await page.setInputFiles('#photo-file',path.join(__dirname,'blank.jpg'));
 await page.getByRole('heading',{name:'No match found'}).waitFor({timeout:60000});check(true,'A photo with no readable medicine name gives "No match found", not a guess');
 await page.getByRole('button',{name:'Search by name'}).click();await page.fill('#photo-search','ginkgo');await page.locator('.scan-option').first().click();
 await page.getByRole('heading',{name:'Is this your medicine?'}).waitFor();check(true,'Search by name is offered as the fallback');
 await page.keyboard.press('Escape');check(await page.locator('.photo-sheet').count()===0,'Escape closes');
 // Chinese + widths
 await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('herbsafe.v1'));s.lang='zh';localStorage.setItem('herbsafe.v1',JSON.stringify(s));});await page.reload();
 await page.getByRole('button',{name:'影相認藥'}).click();await page.getByRole('heading',{name:'影相認藥'}).waitFor();check(true,'Works in Traditional Chinese');
 for(const w of [320,768,1280]){await page.setViewportSize({width:w,height:900});check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Fits at '+w+'px');}
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(__dirname,'photo-zh.png')});
 check(foreign.length===0,'No requests to other sites: '+foreign.join(', '));
 check(errors.length===0,'No script errors: '+errors.join('; '));
 console.log(n+'/'+n+' photo checks passed.');
}finally{await browser.close();}})().catch(e=>{console.error(e.message);process.exitCode=1;});
