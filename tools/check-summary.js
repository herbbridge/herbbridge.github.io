/* Serve localhost:8000, then node tools/check-summary.js.
 * Checks screen-only summary disclosures, exact unknown-pair warnings, keyboard access,
 * counts/order, and fully expanded print content without changing the screen state.
 */
'use strict';
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }
const fs = require('fs');
const os = require('os');
const path = require('path');
const ready = require('./wait-ready');
const lookup = require('../js/lookup');
const i18n = require('../js/i18n').HerbBridgeI18n;
const BASE = process.argv[2] || 'http://localhost:8000/';
const OUT = fs.mkdtempSync(path.join(os.tmpdir(), 'herbbridge-summary-'));
const load = file => JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', file + '.json'), 'utf8'));
const db = lookup.createDb(load('herbs'), load('drugs'), load('interactions'), load('official'), load('reviews'));
const LISTS = {
  demo: { herbs: ['danshen'], drugs: ['warfarin', 'amlodipine'] },
  bigger: { herbs: ['danshen', 'ginkgo', 'goji'], drugs: ['warfarin', 'aspirin', 'amlodipine'] }
};

(async () => {
  const browser = await chromium.launch();
  let failed = 0;
  const check = (ok, name) => { if (!ok) failed++; console.log(`${ok ? '✓' : '✗'} ${name}`); };
  try {
    for (const lang of ['en', 'zh']) for (const mode of ['simple', 'full']) for (const width of [390, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: 844 }, serviceWorkers: 'block' });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(BASE);
      for (const [name, list] of Object.entries(LISTS)) {
        const label = `${lang} ${mode} ${width}px ${name}`;
        const rows = lookup.checkPairs(db, list.herbs, list.drugs);
        const rated = rows.filter(row => row.entry || row.official);
        const unknown = rows.filter(row => row.status === 'not_in_database');
        const counts = {};
        rows.forEach(row => { counts[row.status] = (counts[row.status] || 0) + 1; });
        i18n.setLang(lang);
        const expectedCount = [i18n.tn('group_count', rows.length)].concat(lookup.STATUS_ORDER.filter(status => counts[status]).map(status => `${counts[status]} ${i18n.t('risk_' + status)}`)).join(' · ');
        const unknownText = i18n.t('not_in_db_text');
        await page.evaluate(({ list, lang, mode }) => {
          localStorage.setItem('herbsafe.v1', JSON.stringify({ ...list, lang }));
          localStorage.setItem('herbsafe.mode', mode);
        }, { list, lang, mode });
        await page.goto(BASE + '#/summary');
        await page.reload();
        await ready(page);
        const start = await page.evaluate(() => {
          const visible = n => !!n && n.getClientRects().length > 0 && getComputedStyle(n).display !== 'none';
          const cards = [...document.querySelectorAll('.summary-row')];
          const disclosures = [...document.querySelectorAll('.summary-toggle')];
          const panels = disclosures.map(button => document.getElementById(button.getAttribute('aria-controls')));
          const compactCards = [...document.querySelectorAll('.summary-row, .summary-unknown-card')];
          const rects = compactCards.map(n => n.getBoundingClientRect());
          return {
            rows: cards.length,
            statuses: cards.map(card => [...card.querySelector('.summary-row-head .badge').classList].find(c => c.startsWith('badge-')).slice(6)),
            collapsed: disclosures.length > 0 && disclosures.every((button, i) => button.getAttribute('aria-expanded') === 'false' && panels[i] && panels[i].hidden && !visible(panels[i])),
            controlsValid: panels.every(panel => panel && panel.id) && new Set(panels.map(panel => panel && panel.id)).size === panels.length,
            actions: cards.every(card => visible(card.querySelector('.summary-short-action'))),
            warningTexts: [...document.querySelectorAll('.summary-unknown-warning')].map(n => ({ text: n.textContent, visible: visible(n) })),
            sourcesHidden: [...document.querySelectorAll('.summary-row .sources')].every(n => !visible(n)),
            count: (document.querySelector('.summary-count') || {}).textContent,
            printButtons: document.querySelectorAll('.summary-actions button').length,
            bottomPrint: visible(document.querySelector('.summary-actions-bottom button')),
            say: visible(document.querySelector('.summary-say')),
            disclaimer: visible(document.querySelector('.summary-disclaimer')),
            overflow: document.documentElement.scrollWidth > innerWidth + 1,
            listHeight: rects.length ? Math.max(...rects.map(r => r.bottom)) - Math.min(...rects.map(r => r.top)) : 0
          };
        });
        check(start.rows === rated.length && JSON.stringify(start.statuses) === JSON.stringify(rated.map(row => row.status)), label + ': correct pairs and risk order');
        check(start.collapsed && start.controlsValid && start.actions && start.sourcesHidden, label + ': details start collapsed; short advice remains visible');
        check(start.warningTexts.length === unknown.length && start.warningTexts.every(x => x.visible && x.text === unknownText), label + ': each grey pair keeps the exact visible warning');
        check(start.count === expectedCount, label + ': total and category counts match lookup results');
        check(start.printButtons === 2 && start.bottomPrint && start.say && start.disclaimer && !start.overflow, label + ': top/bottom print, say line and disclaimer visible; no sideways scroll');
        console.log(`· ${label}: collapsed pairs ${Math.round(start.listHeight)}px / ${(start.listHeight / 844).toFixed(2)} phone screens${width === 390 && start.listHeight > 1688 ? ' (above the approximate two-screen target)' : ''}`);
        if (name === 'bigger' && width === 390) check(start.listHeight <= 1688, label + ': nine collapsed pairs fit within two phone screens');

        const first = page.locator('.summary-row .summary-toggle').first();
        await first.focus();
        await first.press('Enter');
        check(await first.getAttribute('aria-expanded') === 'true' && await page.locator('.summary-row .summary-dl').first().isVisible() && await page.locator('.summary-row .sources').first().isVisible(), label + ': Enter opens evidence and sources');
        await first.press('Space');
        check(await first.getAttribute('aria-expanded') === 'false' && !(await page.locator('.summary-row .summary-dl').first().isVisible()), label + ': Space closes details');
        await page.click('.summary-expand-all');
        check(await page.evaluate(() => [...document.querySelectorAll('.summary-toggle')].every(button => button.getAttribute('aria-expanded') === 'true' && !document.getElementById(button.getAttribute('aria-controls')).hidden)), label + ': Expand all opens every disclosure');
        await page.click('.summary-collapse-all');
        check(await page.evaluate(() => [...document.querySelectorAll('.summary-toggle')].every(button => button.getAttribute('aria-expanded') === 'false' && document.getElementById(button.getAttribute('aria-controls')).hidden)), label + ': Collapse all closes every disclosure');

        await page.emulateMedia({ media: 'print' });
        const print = await page.evaluate(() => {
          const visible = n => n.getClientRects().length > 0 && getComputedStyle(n).display !== 'none';
          return {
            expanded: [...document.querySelectorAll('.summary-dl, .summary-unknown-extra')].every(visible),
            sources: [...document.querySelectorAll('.summary-row .sources')].every(visible),
            controlsHidden: [...document.querySelectorAll('.summary-toggle, .summary-fold-actions, .summary-short-action, .summary-actions, .summary-unknown-cards')].every(n => !visible(n)),
            originalUnknown: [...document.querySelectorAll('.summary-print-original')].every(visible)
          };
        });
        check(print.expanded && print.sources && print.controlsHidden && print.originalUnknown, label + ': print shows all original details and sources, without screen controls or duplicate advice');
        await page.emulateMedia({ media: 'screen' });
        check(await page.evaluate(() => [...document.querySelectorAll('.summary-toggle')].every(button => button.getAttribute('aria-expanded') === 'false' && document.getElementById(button.getAttribute('aria-controls')).hidden)), label + ': returning from print preserves collapsed screen state');
        if (name === 'bigger' && width === 390) {
          await page.evaluate(() => scrollTo(0, 0));
          await page.screenshot({ path: path.join(OUT, `summary-${lang}-${mode}.png`), fullPage: true });
          await page.locator('.summary-row').first().scrollIntoViewIfNeeded();
          await page.screenshot({ path: path.join(OUT, `summary-${lang}-${mode}-cards.png`) });
        }
      }
      check(errors.length === 0, `${lang} ${mode} ${width}px: no page errors${errors.length ? ' — ' + errors.join('; ') : ''}`);
      await context.close();
    }
  } finally { await browser.close(); }
  console.log(`Screenshots: ${OUT}`);
  console.log(failed ? `${failed} FAILED` : 'Collapsible summary: all checks passed');
  process.exitCode = failed ? 1 : 0;
})().catch(error => { console.error(error); process.exitCode = 1; });
