/*
 * "What else can change your warfarin" (#/warfarin) check. Needs Playwright. Serve the repo first:
 *   python3 -m http.server 8000      then:  node tools/check-warfarin.js
 * - The cabinet card shows only when warfarin is on the list (and goes away when it is removed);
 *   About links to the page.
 * - Simple: one section per part, key line first; the bleeding section is on screen in full on every
 *   part (never collapsed). Full details: every section.
 * - Food search: found shows group + status; not found is grey and dashed (like "not in our
 *   database"), never green.
 * - No sideways scrolling at 390 x 844, 320 and 195 px, English and Chinese, both modes.
 */
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }
const BASE = process.argv[2] || 'http://localhost:8000/';
const KEY = BASE.includes('/preview/') ? 'herbsafe.preview' : 'herbsafe';
const NOT_FOUND = {
  en: "Not on this list. That doesn't mean it can't affect warfarin. Ask your doctor or dietitian.",
  zh: '唔喺呢張清單入面，唔代表唔會影響華法林。請問你嘅醫生或營養師。'
};
// A colour counts as green when its hue is green (about 75°–165°) and it is not a near-grey: this also
// catches pale greens such as #DFF5E6, which a simple "green channel is biggest" test would miss.
const greenish = c => {
  const m = String(c).match(/\d+(\.\d+)?/g); if (!m) return false;
  const [r, g, b] = m.slice(0, 3).map(x => Number(x) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (d * 255 < 6) return false; // grey
  const l = (max + min) / 2, s = d / (1 - Math.abs(2 * l - 1));
  let h = max === r ? 60 * (((g - b) / d) % 6) : max === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4);
  if (h < 0) h += 360;
  return h >= 75 && h <= 165 && s > 0.12;
};

(async () => {
  const b = await chromium.launch(); let failed = 0;
  const check = (ok, name, detail) => { if (!ok) failed++; console.log((ok ? '  ✓ ' : '  ✗ ') + name + (ok || !detail ? '' : '\n     ' + detail)); };
  const setList = (p, drugs, lang, mode) => p.evaluate(([k, d, l, m]) => {
    localStorage.setItem(k + '.v1', JSON.stringify({ herbs: ['danshen'], drugs: d, lang: l }));
    localStorage.setItem(k + '.mode', m);
  }, [KEY, drugs, lang, mode]);

  for (const lang of ['en', 'zh']) {
    for (const mode of ['simple', 'full']) {
      console.log(`\n${lang} ${mode}`);
      const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
      const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
      await p.goto(BASE);

      // 1. Cabinet card: only with warfarin.
      await setList(p, ['amlodipine'], lang, mode);
      await p.goto(BASE + '?c=' + lang + mode + '1#/cabinet'); await p.reload(); await p.waitForSelector('#app h1');
      const without = await p.locator('.wf-card').count();
      await setList(p, ['warfarin', 'amlodipine'], lang, mode);
      await p.goto(BASE + '?c=' + lang + mode + '2#/cabinet'); await p.reload(); await p.waitForSelector('#app h1');
      const withW = await p.locator('.wf-card').isVisible().catch(() => false);
      const href = await p.locator('.wf-card').getAttribute('href').catch(() => null);
      const cardH = await p.locator('.wf-card').evaluate(e => e.getBoundingClientRect().height).catch(() => 0);
      await p.locator('[data-key="chip-drugs-warfarin"]').click();
      await p.waitForTimeout(300);
      const afterRemove = await p.locator('.wf-card').isVisible().catch(() => false);
      check(without === 0 && withW && href === '#/warfarin' && !afterRemove && cardH >= 44,
        'cabinet card shows only with warfarin (none without, shown with, gone after removing), links to #/warfarin, ≥44px',
        JSON.stringify({ without, withW, href, afterRemove, cardH }));

      // 2. About links to the page.
      await p.goto(BASE + '?a=' + lang + mode + '#/about'); await p.waitForSelector('#app h1');
      check(await p.locator('#app a[href="#/warfarin"]').count() > 0, 'About links to #/warfarin');

      // 3. The page.
      await setList(p, ['warfarin'], lang, mode);
      await p.goto(BASE + '?w=' + lang + mode + '#/warfarin'); await p.reload(); await p.waitForSelector('.wf-page');
      const parts = mode === 'simple' ? 5 : 1;
      const bleedOk = [], oneSection = [], footerOk = [], noPlaceholder = [];
      for (let i = 0; i < parts; i++) {
        const r = await p.evaluate(() => {
          const vis = x => !!x && x.offsetParent !== null && getComputedStyle(x).visibility !== 'hidden';
          const secs = [...document.querySelectorAll('.wf-section')].filter(vis).map(s => s.dataset.section);
          const bleed = document.querySelector('.wf-section[data-section="bleeding"]');
          const signs = bleed ? [...bleed.querySelectorAll('.wf-signs li')] : [];
          const firstQuote = [...document.querySelectorAll('.wf-section')].filter(vis).filter(s => s.dataset.section !== 'bleeding')
            .map(s => s.querySelector('.wf-quote')).map(q => q && q.classList.contains('wf-key'));
          return {
            secs,
            bleed: vis(bleed) && !bleed.closest('details') && !bleed.closest('[hidden]') && signs.length === 10 && signs.every(vis) && !!bleed.querySelector('.wf-999') && vis(bleed.querySelector('.wf-999')),
            keyFirst: firstQuote.every(Boolean),
            // The S-B footer: once per view, after everything else (Full: page bottom; Simple: end of each part).
            footers: [...document.querySelectorAll('.wf-footer')].filter(vis).length,
            footerLast: (() => { const f = [...document.querySelectorAll('.wf-footer')].filter(vis)[0]; const l = [...document.querySelectorAll('.wf-section')].filter(vis).pop(); return !!f && !!l && !!(l.compareDocumentPosition(f) & Node.DOCUMENT_POSITION_FOLLOWING) && !f.closest('.wf-section'); })(),
            placeholders: [...document.querySelectorAll('.wf-placeholder')].filter(vis).length
          };
        });
        bleedOk.push(r.bleed);
        footerOk.push(r.footers === 1 && r.footerLast);
        noPlaceholder.push(r.placeholders === 0);
        oneSection.push(mode === 'simple' ? r.secs.length === 2 && r.secs[1] === 'bleeding' && r.keyFirst : r.secs.length === 6 && r.keyFirst);
        if (i < parts - 1) { await p.click('.wf-nav .btn-primary'); await p.waitForTimeout(150); }
      }
      check(bleedOk.every(Boolean), `bleeding section on screen in full (all 10 signs, 999 line, never collapsed) on every ${mode === 'simple' ? 'part' : 'view'}`, JSON.stringify(bleedOk));
      check(oneSection.every(Boolean), mode === 'simple' ? 'Simple: one section per part (plus bleeding), key line first' : 'Full: every section shown, key line first', JSON.stringify(oneSection));
      if (mode === 'simple') { for (let i = 0; i < parts - 1; i++) { await p.click('.wf-nav .btn-secondary'); await p.waitForTimeout(100); } }

      check(footerOk.every(Boolean), `footer once per ${mode === 'simple' ? 'part' : 'page'}, after the sections, not inside them`, JSON.stringify(footerOk));
      check(noPlaceholder.every(Boolean), 'no "no Chinese wording yet" placeholders', JSON.stringify(noPlaceholder));
      check(await p.locator('.wf-page .read-aloud').count() === 1, 'Read aloud offered on the page (' + lang + ')');
      // 4. Search: found and not found.
      await p.fill('#wf-food-search', lang === 'zh' ? '菠菜' : 'SPINACH');
      const found = await p.evaluate(() => { const f = document.querySelector('.wf-found'); return f ? { text: f.innerText, bg: getComputedStyle(f).backgroundColor, border: getComputedStyle(f).borderTopColor } : null; });
      check(!!found && /Spinach|菠菜/.test(found.text) && /(Vegetables and Dry Beans|蔬菜及乾豆類)/.test(found.text) && !greenish(found.bg) && !greenish(found.border),
        'search finds spinach with its group and status, not green', JSON.stringify(found));
      await p.fill('#wf-food-search', lang === 'zh' ? '蘋果' : 'apple');
      const nf = await p.evaluate(() => {
        const f = document.querySelector('.wf-notfound'); if (!f) return null;
        const cs = getComputedStyle(f), icon = f.querySelector('svg');
        return { text: f.innerText.trim(), bg: cs.backgroundColor, border: cs.borderTopColor, style: cs.borderTopStyle, color: cs.color, icon: icon ? getComputedStyle(icon).color : '', found: !!document.querySelector('.wf-found') };
      });
      check(!!nf && nf.text === NOT_FOUND[lang] && nf.style === 'dashed' && !nf.found && ![nf.bg, nf.border, nf.color, nf.icon].some(greenish),
        'not found: exact wording, grey and dashed, never green', JSON.stringify(nf));
      // 杞子 / goji: grey "not on this list" box PLUS a link to goji + warfarin.
      for (const q of ['杞子', lang === 'zh' ? '枸杞子' : 'goji']) {
        await p.fill('#wf-food-search', q);
        const g = await p.evaluate(() => {
          const box = document.querySelector('.wf-notfound'), a = document.querySelector('.wf-pointer a');
          return { box: !!box && getComputedStyle(box).borderTopStyle === 'dashed', found: !!document.querySelector('.wf-found'), href: a ? a.getAttribute('href') : null, h: a ? a.getBoundingClientRect().height : 0, text: (document.querySelector('.wf-pointer') || {}).innerText || '' };
        });
        check(g.box && !g.found && g.href === '#/pair/goji-warfarin' && g.h >= 44 && /(Goji is in HerbBridge|枸杞喺中西通)/.test(g.text), `"${q}": not on the list (grey) plus a link to goji + warfarin`, JSON.stringify(g));
      }
      await p.fill('#wf-food-search', lang === 'zh' ? '蘋果' : 'apple');
      check(await p.locator('.wf-pointer').count() === 0, 'no herb link for a food that is not a herb');
      const inputH = await p.locator('#wf-food-search').evaluate(e => e.getBoundingClientRect().height);
      check(inputH >= 44, 'search box is a big tap target (≥44px)', String(inputH));

      // 5. No sideways scrolling (with a search result showing).
      const over = [];
      for (const w of [390, 320, 195]) {
        await p.setViewportSize({ width: w, height: w === 390 ? 844 : 700 });
        const o = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
        if (o > 0) over.push(w + 'px: ' + o);
      }
      await p.goto(BASE + '?o=' + lang + mode + '#/cabinet'); await p.waitForSelector('.wf-card');
      for (const w of [390, 320, 195]) {
        await p.setViewportSize({ width: w, height: w === 390 ? 844 : 700 });
        const o = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
        if (o > 0) over.push('cabinet ' + w + 'px: ' + o);
      }
      check(over.length === 0, 'no sideways scrolling at 390, 320 and 195 px (page and cabinet card)', over.join(', '));
      check(errs.length === 0, 'no page errors', errs.join('; '));
      await ctx.close();
    }
  }
  console.log(failed ? `\n${failed} FAILED` : '\nWarfarin page: all checks passed');
  process.exitCode = failed ? 1 : 0; await b.close();
})();
