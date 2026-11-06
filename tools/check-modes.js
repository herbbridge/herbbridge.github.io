/*
 * Simple vs Full check. Needs Playwright. Serve the repo first:  python3 -m http.server 8000
 * Then:  node tools/check-modes.js
 * - Pair page: Simple hides the sources list (it is behind "More details"); Full shows it.
 * - Both modes show the same rating, the same badge colour, the "information, not medical advice"
 *   line, and the grey card's exact required wording.
 * - Each screen says which mode is on (the mode strip, one slim line at 390px).
 * - First screen of a 390 x 844 phone: home heading clear of the sticky bar; results headline and
 *   first badge; pair name, badge and the Read aloud button.
 */
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }
const ready = require('./wait-ready');
const BASE = process.argv[2] || 'http://localhost:8000/';
const KEY = BASE.includes('/preview/') ? 'herbsafe.preview' : 'herbsafe';
const NOT_IN_DB = {
  en: 'We have no record of this combination. This does not mean it is safe. Please ask your pharmacist or doctor.',
  zh: '我哋冇呢個配搭嘅記錄。咁唔代表安全。請問你嘅藥劑師或者醫生。'
};
const DISCLAIMER = {
  en: 'HerbBridge gives information, not medical advice. Never stop or change a medicine without talking to your doctor or pharmacist.',
  zh: '中西通只提供資訊，唔係醫療建議。未同醫生或者藥劑師傾過之前，千祈唔好自行停藥或者改藥。'
};
const PAIRS = ['danshen-warfarin', 'danshen-amlodipine', 'american_ginseng-warfarin', 'goji-amlodipine'];

(async () => {
  const b = await chromium.launch(); let failed = 0;
  const check = (ok, name) => { if (!ok) failed++; console.log((ok ? '  ✓ ' : '  ✗ ') + name); };
  for (const lang of ['en', 'zh']) {
    const seen = {};
    for (const mode of ['simple', 'full']) {
      const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
      const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
      await p.goto(BASE);
      await p.evaluate(([k, l, m]) => { localStorage.setItem(k + '.v1', JSON.stringify({ herbs: [], drugs: [], lang: l })); localStorage.setItem(k + '.mode', m); }, [KEY, lang, mode]);
      console.log(`\n${lang} ${mode}`);
      for (const pair of PAIRS) {
        await p.goto(BASE + '#/pair/' + pair); await p.reload(); await ready(p);
        const r = await p.evaluate(() => {
          const vis = x => !!x && x.offsetParent !== null;
          const badge = [...document.querySelectorAll('#app .badge')].find(vis);
          return {
            strip: (document.querySelector('#app .mode-strip') || {}).className || '',
            sources: [...document.querySelectorAll('#app ol.sources')].some(vis),
            badge: badge ? badge.innerText.trim() : '', colour: badge ? getComputedStyle(badge).backgroundColor : '',
            text: document.querySelector('#app').innerText.replace(/\s+/g, ' ')
          };
        });
        const grey = pair === 'goji-amlodipine';
        check(r.strip.includes('mode-strip-' + mode), `${pair}: strip says ${mode}`);
        if (!grey) check(mode === 'simple' ? !r.sources : r.sources, `${pair}: sources list ${mode === 'simple' ? 'hidden' : 'shown'}`);
        check(r.text.includes(DISCLAIMER[lang]), `${pair}: "information, not medical advice" line`);
        if (grey) check(r.text.includes(NOT_IN_DB[lang]), `${pair}: grey card exact wording`);
        if (seen[pair]) check(seen[pair].badge === r.badge && seen[pair].colour === r.colour, `${pair}: same badge and colour as Simple (${r.badge}, ${r.colour})`);
        else seen[pair] = r;
      }
      // First screen of a 390 x 844 phone, no scrolling.
      const page = await ctx.newPage(); page.on('pageerror', e => errs.push(e.message));
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(BASE);
      await page.evaluate(([k, l]) => localStorage.setItem(k + '.v1', JSON.stringify({ herbs: ['danshen', 'goji'], drugs: ['warfarin', 'amlodipine'], lang: l })), [KEY, lang]);
      for (const [name, hash] of [['home', '#/cabinet'], ['results', '#/results'], ['pair', '#/pair/danshen-warfarin']]) {
        await page.goto(BASE + hash); await page.reload(); await ready(page);
        await page.evaluate(() => document.fonts.ready);
        const f = await page.evaluate(() => {
          const box = s => { const x = document.querySelector(s); return x ? x.getBoundingClientRect() : null; };
          const bar = box('.check-bar'), limit = bar && bar.height ? bar.top : innerHeight;
          const badge = [...document.querySelectorAll('#app .pair-cards .badge, #app .pair-simple .badge, #app article.card .badge')].map(x => x.getBoundingClientRect()).find(r => r.height);
          const read = box('#app .read-aloud');
          return { strip: Math.round(box('.mode-strip').height), h1: Math.round(box('#app h1').bottom), badge: badge ? Math.round(badge.bottom) : null,
                   read: read && read.height ? Math.round(read.bottom) : null, limit: Math.round(limit) };
        });
        if (name === 'pair') check(f.read !== null && f.read <= f.limit, `pair: Read aloud button on the first screen, under the badge (${f.read} <= ${f.limit})`);
        check(f.strip <= 44, `${name}: mode strip is one slim line (${f.strip}px)`);
        if (name === 'home') check(f.h1 <= f.limit, `home: heading clear of the "Check my list" bar (${f.h1} <= ${f.limit})`);
        else check(f.h1 <= f.limit && f.badge !== null && f.badge <= f.limit, `${name}: ${name === 'pair' ? 'pair name' : 'headline'} and first badge on the first screen (${f.h1}, ${f.badge} <= ${f.limit})`);
      }
      check(errs.length === 0, 'no page errors');
      await ctx.close();
    }
  }
  console.log(failed ? `\n${failed} FAILED` : '\nSimple and Full: all checks passed');
  process.exitCode = failed ? 1 : 0;
  await b.close();
})();
