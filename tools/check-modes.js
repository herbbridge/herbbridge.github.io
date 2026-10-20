/*
 * Simple vs Full check. Needs Playwright. Serve the repo first:  python3 -m http.server 8000
 * Then:  node tools/check-modes.js
 * - Pair page: Simple hides the sources list (it is behind "More details"); Full shows it.
 * - Both modes show the same rating, the same badge colour, the "information, not medical advice"
 *   line, and the grey card's exact required wording.
 * - Each screen says which mode is on (the mode strip).
 */
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }
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
        await p.goto(BASE + '#/pair/' + pair); await p.reload(); await p.waitForTimeout(600);
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
      check(errs.length === 0, 'no page errors');
      await ctx.close();
    }
  }
  console.log(failed ? `\n${failed} FAILED` : '\nSimple and Full: all checks passed');
  process.exitCode = failed ? 1 : 0;
  await b.close();
})();
