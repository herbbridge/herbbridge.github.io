/* Serve localhost:8000; node tools/check-textsize.js [base URL]. No messages sent. */
'use strict';
const { chromium } = require('playwright');
const ready = require('./wait-ready');
const fs = require('fs'), os = require('os'), path = require('path');
const BASE = process.argv[2] || 'http://localhost:8000/';
const OUT = fs.mkdtempSync(path.join(os.tmpdir(), 'herbbridge-textsize-'));
let failed = 0;
const firstScreen = [];
function check(ok, label) { console.log(`${ok ? '✓' : '✗'} ${label}`); if (!ok) failed++; }
async function metrics(p) {
  return p.evaluate(() => {
    const css = getComputedStyle(document.documentElement);
    const rect = selector => { const n = document.querySelector(selector); if (!n || !n.offsetHeight) return null; const r = n.getBoundingClientRect(); return { top: r.top, bottom: r.bottom }; };
    return { size: parseFloat(css.fontSize), line: css.getPropertyValue('--line').trim(),
      risks: ['high', 'moderate', 'low', 'none', 'unknown', 'official'].map(k => css.getPropertyValue('--' + k).trim()),
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
      badge: rect('.pair-simple .badge'), read: rect('.read-aloud'),
      header: rect('.site-header'), heading: rect('#app h1') };
  });
}
(async () => {
  const b = await chromium.launch();
  try {
    for (const lang of ['en', 'zh']) for (const mode of ['simple', 'full']) for (const width of [320, 390, 1280]) {
      const c = await b.newContext({viewport: {width, height: 844}, serviceWorkers: 'block'});
      const p = await c.newPage(), errors = [];
      p.on('pageerror', e => errors.push(e.message));
      await p.goto(BASE);
      const cabinet = JSON.stringify({herbs: ['danshen'], drugs: ['warfarin', 'amlodipine'], lang});
      await p.evaluate(([raw, mode]) => { localStorage.setItem('herbsafe.v1', raw); localStorage.setItem('herbsafe.mode', mode); }, [cabinet, mode]);
      await p.reload(); await ready(p);
      const normal = await metrics(p);
      await p.locator('#textsize-toggle').focus();
      await p.keyboard.press('Space');
      const large = await metrics(p);
      const label = `${lang} ${mode} ${width}px`;
      check(Math.abs(large.size / normal.size - 1.25) < .001 && await p.locator('#textsize-toggle').getAttribute('aria-pressed') === 'true', label + ': keyboard toggle enlarges text by 25%');
      check(large.line !== normal.line && JSON.stringify(large.risks) === JSON.stringify(normal.risks), label + ': stronger neutral borders preserve every risk colour');
      check(await p.evaluate(() => document.activeElement.id) === 'textsize-toggle', label + ': focus remains on the toggle');
      await p.reload(); await ready(p);
      check((await metrics(p)).size === large.size && await p.locator('#textsize-toggle').getAttribute('aria-pressed') === 'true', label + ': setting survives reload');
      for (const route of ['cabinet', 'results', 'pair/danshen-warfarin', 'pair/goji-amlodipine', 'summary', 'about']) {
        await p.goto(BASE + '#/' + route); await ready(p);
        const m = await metrics(p);
        check(!m.overflow && m.heading.top >= m.header.bottom - 1, label + ' ' + route + ': fits and heading clears header' + (m.overflow || m.heading.top < m.header.bottom - 1 ? ' ' + JSON.stringify(m) : ''));
        if (route === 'pair/danshen-warfarin' && mode === 'simple' && width === 390) {
          firstScreen.push({lang, badge: m.badge, read: m.read, fits: !!m.badge && m.badge.bottom <= 844 && !!m.read && m.read.bottom <= 844});
          check(firstScreen[firstScreen.length - 1].fits, label + ': badge and Read aloud fit on the first screen without shrinking text');
          await p.screenshot({path: path.join(OUT, `pair-${lang}.png`)});
        }
        if (route === 'summary') {
          const screen = await p.locator('.summary .badge').first().evaluate(n => { const s = getComputedStyle(n); return [s.color, s.backgroundColor]; });
          await p.emulateMedia({media: 'print'});
          check(Math.abs((await metrics(p)).size - 13.3333) < .02, label + ': print keeps the standard A4 text size');
          const printed = await p.locator('.summary .badge').first().evaluate(n => { const s = getComputedStyle(n); return [s.color, s.backgroundColor]; });
          check(JSON.stringify(screen) === JSON.stringify(printed), label + ': print keeps risk colours');
          await p.emulateMedia({media: 'screen'});
        }
      }
      await p.goto(BASE + '#/cabinet'); await ready(p);
      await p.click('[data-key="add-herbs"]');
      check(await p.locator('.option').evaluateAll(nodes => nodes.every(n => n.getBoundingClientRect().height >= 44)) && await p.locator('.sheet-panel').evaluate(n => n.scrollWidth <= n.clientWidth + 1), label + ': picker fits with usable tap targets');
      await p.keyboard.press('Escape');
      await p.click('#textsize-toggle');
      check(Math.abs((await metrics(p)).size - normal.size) < .01 && await p.evaluate(() => localStorage.getItem('herbsafe.v1')) === cabinet, label + ': toggle restores normal size without changing the medicine list');
      await p.emulateMedia({contrast: 'more'});
      check((await metrics(p)).line === large.line && (await metrics(p)).size === normal.size, label + ': OS high contrast works independently of text size');
      check(errors.length === 0, label + ': no browser errors');
      await c.close();
    }
    const c = await b.newContext({serviceWorkers: 'block'}), p = await c.newPage();
    await c.addInitScript(() => {
      Storage.prototype.getItem = () => {throw new Error('blocked');};
      Storage.prototype.setItem = () => {throw new Error('blocked');};
    });
    await p.goto(BASE); await ready(p); await p.click('#textsize-toggle');
    check(await p.locator('#textsize-toggle').getAttribute('aria-pressed') === 'true', 'Blocked storage: the toggle still works for the current visit');
    await c.close();
    const userFont = await chromium.launch({args: ['--blink-settings=defaultFontSize=32']});
    try {
      const c = await userFont.newContext({viewport: {width: 390, height: 844}, serviceWorkers: 'block'}), p = await c.newPage();
      await p.goto(BASE); await ready(p);
      check(Math.abs((await metrics(p)).size - 40) < .02, 'Browser 200% base font: Simple mode respects the larger browser setting');
      await p.click('#textsize-toggle');
      check(Math.abs((await metrics(p)).size - 50) < .02, 'Browser 200% base font: Bigger text adds 25% to that setting');
      for (const route of ['cabinet', 'pair/danshen-warfarin', 'summary', 'about']) {
        await p.goto(BASE + '#/' + route); await ready(p);
        check(!(await metrics(p)).overflow, 'Browser 200% base font: ' + route + ' wraps without horizontal scrolling');
      }
      await c.close();
    } finally { await userFont.close(); }
    console.log('390×844 Simple first-screen measurements (large text is never reduced to fit): ' + JSON.stringify(firstScreen));
    console.log('Screenshots: ' + OUT);
    console.log(failed ? `${failed} FAILED` : 'Bigger text: all checks passed');
    process.exitCode = failed ? 1 : 0;
  } finally { await b.close(); }
})().catch(error => {console.error(error); process.exitCode = 1;});
