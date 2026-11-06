/*
 * Waits until a HerbBridge page has finished loading, instead of a fixed pause, so the checks also
 * pass on the real site over a slow connection:
 * - no network requests for half a second (the app and its data files have arrived),
 * - the app has drawn its screen (the "Loading…" line is gone and #app has content),
 * - the fonts are ready.
 * Usage:  const ready = require('./wait-ready');  await p.goto(url); await ready(p);
 */
module.exports = async function ready(page, timeout = 30000) {
  await page.waitForLoadState('networkidle', { timeout });
  await page.waitForFunction(() => {
    const app = document.getElementById('app');
    return app && app.children.length > 0 && !app.querySelector('.loading');
  }, null, { timeout });
  await page.evaluate(() => document.fonts.ready);
};
