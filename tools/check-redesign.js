/* Serve localhost:8000, then node tools/check-redesign.js.
 * Regression checks for the Ink design: warnings never animate, rating colours remain
 * unchanged, pickers retain keyboard access, and phone/laptop layouts do not overflow.
 */
const { chromium } = require('playwright');
const ready = require('./wait-ready');
const fs = require('fs');
const os = require('os');
const path = require('path');
const BASE = 'http://localhost:8000/';
const OUT = fs.mkdtempSync(path.join(os.tmpdir(), 'herbbridge-redesign-'));
const RISKS = {
  high: '#D92D20', moderate: '#E8890C', low: '#D9B70F', none: '#1F7A4A',
  unknown: '#EDEDEA', official: '#2E5AAC'
};

(async () => {
  const browser = await chromium.launch();
  let failed = 0;
  const check = (ok, name) => { if (!ok) failed++; console.log(`${ok ? '✓' : '✗'} ${name}`); };
  try {
    for (const lang of ['en', 'zh']) for (const mode of ['simple', 'full']) for (const width of [375, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: 844 }, serviceWorkers: 'block' });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(BASE);
      await page.evaluate(([lang, mode]) => {
        localStorage.setItem('herbsafe.v1', JSON.stringify({ herbs: ['danshen'], drugs: ['warfarin', 'amlodipine'], lang }));
        localStorage.setItem('herbsafe.mode', mode);
      }, [lang, mode]);
      for (const route of ['cabinet', 'results', 'pair/danshen-warfarin', 'pair/astragalus-warfarin', 'summary', 'about']) {
        await page.goto(BASE + '#/' + route);
        await page.reload();
        await ready(page);
        const layout = await page.evaluate(() => {
          const style = getComputedStyle(document.documentElement);
          const header = document.querySelector('.site-header');
          const h1 = document.querySelector('#app h1');
          const moving = [...document.querySelectorAll('#app, #app *, .clash-alert, .clash-alert *')].filter(n => {
            const s = getComputedStyle(n);
            return s.animationName !== 'none' || s.transitionDuration.split(',').some(x => parseFloat(x) > 0);
          });
          return {
            overflow: document.documentElement.scrollWidth > innerWidth + 1,
            h1Visible: h1.getBoundingClientRect().top >= header.getBoundingClientRect().bottom - 1,
            sticky: getComputedStyle(header).position === 'sticky',
            moving: moving.length,
            primaryCount: [...document.querySelectorAll('#app .btn-primary')].filter(n => !n.disabled && n.offsetParent !== null).length,
            risks: Object.fromEntries(['high', 'moderate', 'low', 'none', 'unknown', 'official'].map(k => [k, style.getPropertyValue('--' + k).trim()])),
            accent: style.getPropertyValue('--accent').trim()
          };
        });
        const label = `${lang} ${mode} ${width}px ${route}`;
        check(!layout.overflow && layout.h1Visible && layout.sticky, label + ': fits, heading clear, header sticky');
        check(layout.primaryCount <= 1, label + ': at most one primary action');
        check(JSON.stringify(layout.risks) === JSON.stringify(RISKS) && layout.accent === '#1E2430', label + ': original risk colours, Ink accent');
        if (route !== 'cabinet' && route !== 'about') check(layout.moving === 0, label + ': no result or summary motion');
        if (lang === 'en' && mode === 'simple' && route === 'cabinet') await page.screenshot({ path: path.join(OUT, `cabinet-${width}.png`) });
        if (lang === 'zh' && mode === 'full' && route === 'pair/danshen-warfarin') await page.screenshot({ path: path.join(OUT, `pair-zh-${width}.png`) });
      }
      await page.goto(BASE + '#/cabinet');
      await ready(page);
      await page.click('[data-key="add-herbs"]');
      await page.locator('[data-key="opt-herbs-danshen"]').focus();
      // Tab away and back ensures :focus-visible is exercised as keyboard input.
      await page.keyboard.press('Tab');
      await page.keyboard.press('Shift+Tab');
      await page.mouse.move(0, 0);
      const picker = await page.evaluate(() => {
        const selected = document.querySelector('[data-key="opt-herbs-danshen"]');
        const s = getComputedStyle(selected);
        return {
          selected: selected.getAttribute('aria-pressed') === 'true' && s.backgroundColor === 'rgb(30, 36, 48)',
          focus: document.activeElement === selected && s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2,
          targets: [...document.querySelectorAll('.option')].every(n => n.getBoundingClientRect().height >= 44 && n.getBoundingClientRect().width >= 44),
          overflow: document.querySelector('.sheet-panel').scrollWidth > innerWidth + 1
        };
      });
      check(picker.selected && picker.focus && picker.targets && !picker.overflow, `${lang} ${mode} ${width}px picker: Ink selection, keyboard focus, large targets, no overflow ${JSON.stringify(picker)}`);
      await page.keyboard.press('Escape');
      await page.click('.demo-start');
      const countPrimary = () => page.evaluate(() => [...document.querySelectorAll('#app .btn-primary')].filter(n => !n.disabled && n.offsetParent !== null).length);
      check(await countPrimary() === 1, `${lang} ${mode} ${width}px: demo has one main action before adding danshen`);
      await page.click('.demo-actions button:first-child');
      check(await countPrimary() === 1, `${lang} ${mode} ${width}px: warning and Check my list share one main action`);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(BASE + '#/about');
      await ready(page);
      check(await page.evaluate(() => [...document.querySelectorAll('#app, #app *')].every(n => {
        const s = getComputedStyle(n);
        return s.opacity !== '0' && s.animationName === 'none' && s.transitionDuration.split(',').every(x => parseFloat(x) === 0);
      })), `${lang} ${mode} ${width}px: reduced motion leaves all About content visible and still`);
      check(errors.length === 0, `${lang} ${mode} ${width}px: no page errors`);
      await context.close();
    }
  } finally { await browser.close(); }
  console.log(`Screenshots: ${OUT}`);
  console.log(failed ? `${failed} FAILED` : 'Redesign: all checks passed');
  process.exitCode = failed ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
