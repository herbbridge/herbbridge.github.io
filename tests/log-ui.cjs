/* Run from a machine with Playwright: serve this folder at http://127.0.0.1:8013 (python3 -m http.server 8013), then: node tests/log-ui.cjs */
/* Health log UI checks against a local copy of the public site. Fictional readings only. */
const {chromium}=require('playwright');const path=require('path');
let n=0;const check=(ok,label)=>{if(!ok)throw Error('FAIL '+label);n++;console.log('PASS '+label);};
const BASE='http://127.0.0.1:8013/';
(async()=>{const browser=await chromium.launch();try{
 const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
 const foreign=[],posts=[];
 await context.route('**/*',route=>{const r=route.request(),u=new URL(r.url());if(u.origin!=='http://127.0.0.1:8013'){foreign.push(u.href);return route.abort();}if(r.method()!=='GET')posts.push(u.pathname);return route.continue();});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(BASE+'#/cabinet');
 await page.evaluate(()=>{localStorage.setItem('herbsafe.v1',JSON.stringify({herbs:['danshen'],drugs:['warfarin','amlodipine'],lang:'en'}));localStorage.removeItem('herbbridge.log.v1');});
 await page.goto(BASE+'#/log');await page.reload();
 await page.getByRole('heading',{name:'Daily health log'}).waitFor();check(true,'Health log opens from #/log');
 check(await page.locator('.site-nav a[aria-current="page"]').innerText()==='Health log','Health log link marked as current page');
 const txt=await page.locator('#app').innerText();
 check(txt.includes('Warfarin')&&txt.includes('Amlodipine')&&txt.includes('Danshen'),'Medicines from My cabinet are offered as ticks');
 check(txt.includes('does not judge'),'Page says HerbBridge does not judge readings');
 // Empty save refused
 await page.getByRole('button',{name:'Save entry'}).click();await page.locator('.log-notice').waitFor();check((await page.locator('.log-notice').innerText()).includes('Tick a medicine'),'Empty entry refused with a clear message');
 // Typo caught
 await page.fill('#log-sys','80');await page.fill('#log-dia','120');await page.getByRole('button',{name:'Save entry'}).click();
 await page.locator('.log-notice').waitFor();check((await page.locator('.log-notice').innerText()).includes('upper number should be bigger'),'Swapped blood pressure numbers caught');
 // Three valid entries on different days
 const days=[['2026-11-05T08:00','131','84','72','6.1'],['2026-11-06T08:10','127','81','70','5.8'],['2026-11-07T08:05','124','80','68','5.5']];
 for(const d of days){
  await page.fill('#log-at',d[0]);await page.fill('#log-sys',d[1]);await page.fill('#log-dia',d[2]);await page.fill('#log-hr',d[3]);await page.fill('#log-sugar',d[4]);
  await page.check('#log-take-drugs-warfarin');await page.getByRole('button',{name:'Save entry'}).click();await page.getByText('Entry saved.',{exact:true}).waitFor();
 }
 check(await page.locator('.log-entry').count()===3,'Three entries listed');
 await page.getByRole('button',{name:'90 days'}).click();
 const charts=await page.locator('.log-chart').count();check(charts===3,'Charts drawn for blood pressure, heart rate and blood sugar ('+charts+')');
 const label=await page.locator('.log-chart-svg').first().getAttribute('aria-label');check(/lowest 80, highest 131/.test(label),'Chart has a text description for screen readers: '+label);
 check(await page.evaluate(()=>!document.querySelector('.health-log').innerHTML.match(/high-|moderate-|low-|none-/)),'No risk colours used on readings');
 const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('herbbridge.log.v1')));check(stored.entries.length===3&&stored.entries[2].taken.drugs[0]==='warfarin','Entries saved on this device with the ticked medicine');
 check(posts.length===0&&foreign.length===0,'Nothing sent anywhere');
 // Delete one with confirmation
 await page.getByRole('button',{name:/^Delete ·/}).first().click();await page.getByRole('button',{name:'Yes, delete'}).click();check(await page.locator('.log-entry').count()===2,'An entry can be deleted after confirming');
 // Doctor summary includes last 14 days (fictional dates are within 14 days of 8 Nov 2026)
 await page.goto(BASE+'#/summary');await page.getByRole('heading',{name:/Health log: last 14 days/}).waitFor({timeout:5000}).catch(()=>{});
 const sum=await page.locator('#app').innerText();
 const inWindow=await page.evaluate(()=>Date.now()-new Date('2026-11-06T08:10').getTime()<14*86400000);
 if(inWindow){check(sum.includes('Health log: last 14 days')&&sum.includes('127/81'),'Doctor summary includes the recent log entries');check(sum.includes('does not check or interpret'),'Summary says the readings are not interpreted');}
 else console.log('  (skipped summary check: fictional dates are more than 14 days before today)');
 await page.emulateMedia({media:'print'});await page.pdf({path:path.join(__dirname,'summary-log.pdf'),format:'A4'});await page.emulateMedia({media:'screen'});check(true,'Summary with log prints to PDF');
 // Chinese + widths
 await page.goto(BASE+'#/log');await page.click('#lang-toggle');await page.getByRole('heading',{name:'每日健康記錄'}).waitFor();check(true,'Works in Traditional Chinese');
 for(const w of [320,768,1280]){await page.setViewportSize({width:w,height:900});check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Fits at '+w+'px');}
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(__dirname,'log-zh.png'),fullPage:true});
 // Clear all
 await page.getByRole('button',{name:'刪除所有記錄'}).click();await page.getByRole('button',{name:'確認刪除'}).click();check(await page.evaluate(()=>!localStorage.getItem('herbbridge.log.v1')),'Delete all removes the log from this device');
 check(errors.length===0,'No script errors: '+errors.join('; '));
 console.log(n+'/'+n+' health log checks passed.');
}finally{await browser.close();}})().catch(e=>{console.error(e.message);process.exitCode=1;});
