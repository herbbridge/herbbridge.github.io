/*
 * Navigation and flow check. Needs Playwright. Serve the repo first:  python3 -m http.server 8000
 * Then:  node tools/check-flow.js
 * - The HerbBridge name goes to My cabinet from every screen; results and pair pages have a Home button.
 * - Removing a herb or medicine does not move the page; focus goes to the next item (or the heading).
 * - Every pair page ends with "Next: show your doctor" (names filled in, button to the summary); it
 *   comes into view when reading aloud finishes, and the reading ends with that sentence.
 * - The summary says the "You can say" sentence once.
 * - The menu buttons and the header stay in the same place and size on every page (390, 1024, 1440 px).
 */
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }
const BASE = process.argv[2] || 'http://localhost:8000/';
const KEY = BASE.includes('/preview/') ? 'herbsafe.preview' : 'herbsafe';
const SAY = {
  en: 'You can say: ‘I take danshen and warfarin. Can you check if that’s OK for me?’',
  zh: '你可以咁講：『我有食丹參同華法林，可唔可以幫我睇吓有冇問題？』'
};
const SUMMARY_SAY = {
  en: 'You can say: ‘I take danshen, warfarin and amlodipine. Can you check if that’s OK for me?’',
  zh: '你可以咁講：『我有食丹參、華法林同氨氯地平，可唔可以幫我睇吓有冇問題？』'
};

(async () => {
  const b = await chromium.launch(); let failed = 0;
  const check = (ok, name) => { if (!ok) failed++; console.log((ok ? '  ✓ ' : '  ✗ ') + name); };
  for (const lang of ['en', 'zh']) for (const mode of ['simple', 'full']) {
    console.log(`\n${lang} ${mode}`);
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
    // A speech engine that finishes each piece at once, so "reading finished" can be checked.
    await ctx.addInitScript(() => {
      window.__spoken = [];
      const synth = { speaking: false, pending: false, getVoices: () => [{ name: 'Daniel', lang: 'en-GB', localService: true }, { name: 'Sinji', lang: 'zh-HK', localService: true }],
        addEventListener() {}, cancel() {}, speak(u) { window.__spoken.push(u.text); setTimeout(() => { u.onstart && u.onstart(); u.onend && u.onend(); }, 20); } };
      Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
      window.SpeechSynthesisUtterance = function (text) { this.text = text; };
    });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    const setList = (herbs, drugs) => p.evaluate(([k, h, d, l, m]) => { localStorage.setItem(k + '.v1', JSON.stringify({ herbs: h, drugs: d, lang: l })); localStorage.setItem(k + '.mode', m); }, [KEY, herbs, drugs, lang, mode]);
    await p.goto(BASE); await setList(['danshen'], ['warfarin', 'amlodipine']);

    // 1. Home
    for (const hash of ['#/results', '#/pair/danshen-warfarin', '#/summary', '#/about']) {
      await p.goto(BASE + hash); await p.reload(); await p.waitForTimeout(500);
      await p.click('.brand'); await p.waitForTimeout(300);
      check(new URL(p.url()).hash === '#/cabinet' && await p.$('.cab-card'), `HerbBridge name on ${hash} goes to My cabinet`);
    }
    for (const hash of ['#/results', '#/pair/danshen-warfarin']) {
      await p.goto(BASE + hash); await p.reload(); await p.waitForTimeout(500);
      const home = await p.$('#app .home-link');
      const label = home ? (await home.innerText()).trim() : '';
      if (home) { await home.click(); await p.waitForTimeout(300); }
      check(home && label === (lang === 'zh' ? '主頁' : 'Home') && new URL(p.url()).hash === '#/cabinet', `Home button on ${hash} ("${label}") goes to My cabinet`);
    }

    // 4. Next: show your doctor
    await p.goto(BASE + '#/pair/danshen-warfarin'); await p.reload(); await p.waitForTimeout(600);
    const next = await p.evaluate(() => { const n = document.getElementById('next-step'); return n ? { text: n.innerText.replace(/\s+/g, ' '), href: n.querySelector('a.btn-next').getAttribute('href') } : null; });
    check(next && next.text.includes(SAY[lang]) && next.href === '#/summary', 'pair page ends with "Next: show your doctor", names filled in, button to #/summary');
    await p.click('.read-aloud'); await p.waitForTimeout(800);
    const after = await p.evaluate(() => ({ focus: document.activeElement && document.activeElement.id, spoken: window.__spoken }));
    check(after.focus === 'next-step', 'when reading aloud finishes, the next step comes into view (focused)');
    check(after.spoken.length > 0 && after.spoken[after.spoken.length - 1].includes(SAY[lang].replace(/\s/g, lang === 'zh' ? '' : ' ')), 'reading aloud ends with the "You can say" sentence');

    // Hawthorn: the leaf-and-flower note on every hawthorn pair page
    for (const pair of ['hawthorn-digoxin', 'hawthorn-warfarin', 'hawthorn-amlodipine']) {
      await p.goto(BASE + '#/pair/' + pair); await p.waitForTimeout(400);
      const note = await p.evaluate(() => { const n = document.querySelector('#app .herb-note'); return n && n.offsetParent ? n.innerText.trim() : ''; });
      check(note.includes(lang === 'zh' ? '山楂葉同花' : 'leaf and flower extracts'), `${pair}: hawthorn note shown`);
    }

    // Summary sentence, once
    await p.goto(BASE + '#/summary'); await p.reload(); await p.waitForTimeout(500);
    const say = await p.$$eval('.summary-say', xs => xs.map(x => x.innerText.trim()));
    check(say.length === 1 && say[0] === SUMMARY_SAY[lang], `summary says it once: ${say[0] || '(missing)'}`);

    // 2. Removing a herb: no jump, focus moves on
    await setList(['danshen', 'goji', 'ginkgo'], ['warfarin', 'amlodipine']);
    await p.goto(BASE + '#/cabinet'); await p.reload(); await p.waitForTimeout(600);
    await p.evaluate(() => { const c = document.querySelector('[data-key="chip-herbs-goji"]'); window.scrollTo(0, c.getBoundingClientRect().top + scrollY - 300); });
    await p.waitForTimeout(200);
    const remove = async id => {
      const before = await p.evaluate(() => document.querySelector('.cab-card [id="h-herbs"]').getBoundingClientRect().top);
      await p.tap(`[data-key="chip-herbs-${id}"]`); await p.waitForTimeout(250);
      return p.evaluate(b => ({ moved: Math.abs(document.querySelector('.cab-card [id="h-herbs"]').getBoundingClientRect().top - b),
        focus: document.activeElement.getAttribute('data-key') || document.activeElement.id }), before);
    };
    let r = await remove('goji');
    check(r.moved <= 1 && r.focus === 'chip-herbs-ginkgo', `remove goji: list did not move (${r.moved}px), focus on the next item (${r.focus})`);
    r = await remove('ginkgo');
    check(r.moved <= 1 && r.focus === 'chip-herbs-danshen', `remove the last item in the list: no move (${r.moved}px), focus on the one before (${r.focus})`);
    r = await remove('danshen');
    check(r.moved <= 1 && r.focus === 'h-herbs', `remove the only item: no move (${r.moved}px), focus on the list heading (${r.focus})`);

    check(errs.length === 0, 'no page errors');
    await ctx.close();
  }
  // Menu and header: the same place and size on every page (390, 1024 and 1440 px wide, scrollbars shown).
  const sb = await chromium.launch({ ignoreDefaultArgs: ['--hide-scrollbars'] });
  const PAGES = ['#/cabinet', '#/summary', '#/about', '#/results', '#/pair/danshen-warfarin'];
  const PARTS = ['.site-nav a:nth-child(1)', '.site-nav a:nth-child(2)', '.site-nav a:nth-child(3)', '.brand', '.mode-toggle', '.lang-toggle'];
  for (const lang of ['en', 'zh']) for (const mode of ['simple', 'full']) {
    console.log(`\nmenu ${lang} ${mode}`);
    for (const w of [390, 1024, 1440]) {
      const ctx = await sb.newContext({ viewport: { width: w, height: 900 }, serviceWorkers: 'block' }); const p = await ctx.newPage();
      await p.goto(BASE);
      await p.evaluate(([k, l, m]) => { localStorage.setItem(k + '.v1', JSON.stringify({ herbs: ['danshen'], drugs: ['warfarin', 'amlodipine'], lang: l })); localStorage.setItem(k + '.mode', m); }, [KEY, lang, mode]);
      let first = null, worst = 0, where = '';
      for (const hash of PAGES) {
        await p.goto(BASE + hash); await p.reload(); await p.waitForTimeout(400); await p.evaluate(() => document.fonts.ready);
        const boxes = await p.evaluate(parts => parts.map(s => { const r = document.querySelector(s).getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; }), PARTS);
        if (!first) { first = boxes; continue; }
        boxes.forEach((bx, i) => bx.forEach((v, k) => { const d = Math.abs(v - first[i][k]); if (d > worst) { worst = d; where = `${PARTS[i]} on ${hash}`; } }));
      }
      check(worst <= 1, `${w}px: menu buttons and header stay put on every page (largest move ${worst.toFixed(1)}px${worst > 1 ? ', ' + where : ''})`);
      await ctx.close();
    }
  }
  await sb.close();

  console.log(failed ? `\n${failed} FAILED` : '\nFlow: all checks passed');
  process.exitCode = failed ? 1 : 0;
  await b.close();
})();
