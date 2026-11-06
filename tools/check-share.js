/* Serve localhost:8000, then node tools/check-share.js [base URL].
 * Tests shared-list isolation, explicit saving, local QR generation and sharing payloads.
 * No WhatsApp message or system share is actually sent: those actions are inspected/stubbed.
 * Optional independent QR decoder: HERBBRIDGE_JSQR_MODULE=/path/to/jsqr.
 */
'use strict';
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }
const fs = require('fs');
const path = require('path');
const os = require('os');
const vm = require('vm');
const ready = require('./wait-ready');
const lookup = require('../js/lookup');
const BASE = process.argv[2] || 'http://localhost:8000/';
const KEY = 'herbsafe.v1';
const ROOT = path.join(__dirname, '..');
const OUT = fs.mkdtempSync(path.join(os.tmpdir(), 'herbbridge-share-'));
const readData = name => JSON.parse(fs.readFileSync(path.join(ROOT, 'data', name + '.json'), 'utf8'));
const db = lookup.createDb(readData('herbs'), readData('drugs'), readData('interactions'), readData('official'), readData('reviews'));
const B = { herbs: ['danshen'], drugs: ['warfarin', 'amlodipine'] };
const encodeRaw = value => Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
const PAYLOAD = encodeRaw({ v: 1, h: B.herbs, d: B.drugs });
const sharedURL = BASE + '#/summary?l=' + PAYLOAD;
const expectedLink = 'https://herbbridge.org/#/summary?l=' + PAYLOAD;
let failed = 0, decodedQRs = 0, decoderUnavailable = false;
const check = (ok, name) => { if (!ok) failed++; console.log(`${ok ? '✓' : '✗'} ${name}`); };
let jsQR, PNG;
try {
  jsQR = require(process.env.HERBBRIDGE_JSQR_MODULE || '/private/tmp/herbbridge-share-test-node/node_modules/jsqr');
  PNG = require('pngjs').PNG;
} catch (_) { /* A native browser BarcodeDetector is tried instead. */ }

const malformed = [
  ['bad base64', '!not-base64!'],
  ['bad JSON', Buffer.from('not JSON').toString('base64url')],
  ['wrong version', encodeRaw({ v: 2, h: B.herbs, d: B.drugs })],
  ['unexpected personal field', encodeRaw({ v: 1, h: B.herbs, d: B.drugs, name: 'not allowed' })],
  ['wrong array type', encodeRaw({ v: 1, h: 'danshen', d: B.drugs })],
  ['empty list', encodeRaw({ v: 1, h: [], d: [] })],
  ['unknown ID', encodeRaw({ v: 1, h: ['not_a_herb'], d: B.drugs })],
  ['duplicate ID', encodeRaw({ v: 1, h: ['danshen', 'danshen'], d: B.drugs })],
  ['prototype ID', encodeRaw({ v: 1, h: ['__proto__'], d: B.drugs })],
  ['constructor ID', encodeRaw({ v: 1, h: B.herbs, d: ['constructor'] })],
  ['HTML instead of ID', encodeRaw({ v: 1, h: ['<img src=x onerror=alert(1)>'], d: B.drugs })],
  ['oversized payload', 'a'.repeat(4097)]
];

function checkCodec() {
  const browserRoot = { btoa: s => Buffer.from(s, 'binary').toString('base64'), atob: s => Buffer.from(s, 'base64').toString('binary') };
  const sandbox = { window: browserRoot, URL, URLSearchParams, btoa: browserRoot.btoa, atob: browserRoot.atob, TextEncoder, TextDecoder };
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'js', 'share.js'), 'utf8'), sandbox, { filename: 'share.js' });
  const api = browserRoot.HerbBridgeShare;
  check(api && typeof api.read === 'function' && typeof api.encode === 'function', 'Node: share codec is available without a DOM or network');
  if (!api) return;
  const encoded = api.encode(B);
  const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  check(/^[A-Za-z0-9_-]+$/.test(encoded) && JSON.stringify(payload) === JSON.stringify({ v: 1, h: B.herbs, d: B.drugs }), 'Node: encoded payload contains only version and herb/medicine IDs');
  check(api.link(B) === expectedLink, 'Node: links use the official herbbridge.org domain and a fragment');
  const decoded = api.read('#/summary?l=' + encoded, db);
  check(decoded && decoded.valid && JSON.stringify(decoded.herbs) === JSON.stringify(B.herbs) && JSON.stringify(decoded.drugs) === JSON.stringify(B.drugs), 'Node: valid lists round-trip exactly');
  check(api.read('#/summary', db) === null, 'Node: an ordinary summary is not treated as a shared list');
  for (const hash of ['#/summary?l', '#/summary?l=', '#/summary?x=1&l=' + PAYLOAD, '#/summary?l=' + PAYLOAD + '&x=1']) {
    check(api.read(hash, db)?.valid === false, 'Node: rejects incomplete or unexpected shared-link query ' + hash.slice(0, 30));
  }
  for (const [name, raw] of malformed) {
    let result;
    try { result = api.read('#/summary?l=' + raw, db); } catch (_) { result = null; }
    check(result && result.valid === false, 'Node: rejects ' + name + ' without throwing');
  }
}

async function addShareStubs(context) {
  await context.addInitScript(() => {
    window.__sharedPayloads = [];
    window.__copiedLink = null;
    Object.defineProperty(navigator, 'share', { configurable: true, value: async payload => { window.__sharedPayloads.push(payload); } });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async value => { window.__copiedLink = value; } } });
  });
}

async function decodeActualQR(page, label) {
  let decoded = null;
  if (jsQR && PNG) {
    const bytes = await page.locator('.share-qr svg').screenshot();
    const image = PNG.sync.read(bytes);
    const qr = jsQR(new Uint8ClampedArray(image.data), image.width, image.height, { inversionAttempts: 'attemptBoth' });
    decoded = qr && qr.data;
  } else {
    const result = await page.evaluate(async () => {
      if (!window.BarcodeDetector) return { unavailable: true };
      const svg = document.querySelector('.share-qr svg');
      const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      try {
        const image = new Image(); image.src = url; await image.decode();
        const detector = new BarcodeDetector({ formats: ['qr_code'] });
        const found = await detector.detect(image);
        return { value: found[0] && found[0].rawValue };
      } finally { URL.revokeObjectURL(url); }
    });
    if (result.unavailable) {
      decoderUnavailable = true;
      console.log('· ' + label + ': no independent QR decoder; install jsqr temporarily and set HERBBRIDGE_JSQR_MODULE to verify scanning');
      return;
    }
    decoded = result.value;
  }
  decodedQRs++;
  check(decoded === expectedLink, label + ': the actual displayed QR independently decodes to the ID-only shared link');
}

(async () => {
  checkCodec();
  const browser = await chromium.launch();
  try {
    for (const lang of ['en', 'zh']) for (const width of [390, 1280]) {
      const label = `${lang} ${width}px`;
      const context = await browser.newContext({ viewport: { width, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'block' });
      await addShareStubs(context);
      const page = await context.newPage();
      const errors = [], requests = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('request', request => requests.push(request.url()));
      const A = { herbs: ['ginkgo'], drugs: ['aspirin'], lang, demo: true, demoBackup: { herbs: ['goji'], drugs: ['warfarin'] } };
      const rawA = JSON.stringify(A);
      await page.goto(BASE);
      await page.evaluate(([key, value]) => localStorage.setItem(key, value), [KEY, rawA]);
      await page.goto(sharedURL); await page.reload(); await ready(page);
      const start = await page.evaluate(key => ({
        raw: localStorage.getItem(key),
        items: document.querySelector('.summary-lists').innerText,
        banner: !!document.querySelector('.shared-list-banner'),
        editable: !!document.querySelector('.summary-actions a[href="#/cabinet"]'),
        link: document.querySelector('.share-link').value,
        readonly: document.querySelector('.share-link').readOnly,
        notice: !!document.querySelector('.share-panel .share-notice'),
        overflow: document.documentElement.scrollWidth > innerWidth + 1
      }), KEY);
      check(start.banner && /Danshen/.test(start.items) && /Warfarin/.test(start.items) && /Amlodipine/.test(start.items) && !/Ginkgo|Aspirin/.test(start.items), label + ': the shared view shows the sender’s list and is labelled read-only');
      check(start.raw === rawA && !start.editable, label + ': opening a shared list neither replaces the cabinet nor offers an unguarded Edit action');
      check(start.link === expectedLink && start.readonly && start.notice && !start.overflow, label + ': share controls use a readonly canonical link, privacy notice and fitting layout');
      await decodeActualQR(page, label);
      const whatsapp = new URL(await page.locator('.share-panel a[href^="https://wa.me/"]').getAttribute('href'));
      const message = whatsapp.searchParams.get('text');
      check(whatsapp.origin === 'https://wa.me' && message.includes(expectedLink) && (lang === 'en' ? /Danshen/.test(message) && /Warfarin/.test(message) && /High risk/.test(message) : /丹參/.test(message) && /華法林/.test(message) && /高度風險/.test(message)), label + ': WhatsApp text includes the rated pairs and complete link (not sent)');
      await page.click('.share-copy');
      check(await page.evaluate(() => window.__copiedLink) === expectedLink, label + ': Copy link copies the shared URL only after a click');
      await page.click('.share-system');
      check(await page.evaluate(url => window.__sharedPayloads.length === 1 && JSON.stringify(window.__sharedPayloads[0]).includes(url), expectedLink), label + ': system sharing receives the same link through a stub (not sent)');
      await page.click('.summary-row .summary-toggle');
      await page.click('.summary-collapse-all');
      await page.emulateMedia({ media: 'print' });
      check(await page.locator('.share-qr-print svg').isVisible(), label + ': the QR remains visible in print');
      await page.emulateMedia({ media: 'screen' });
      await page.click('#lang-toggle');
      await page.click('#mode-full');
      await page.reload(); await ready(page);
      check(await page.evaluate(key => localStorage.getItem(key), KEY) === rawA, label + ': disclosure, print, language, mode and reload leave the saved cabinet unchanged');
      check(requests.every(url => !url.includes(PAYLOAD) && new URL(url).hash === '' && new URL(url).origin === new URL(BASE).origin), label + ': no payload in HTTP requests and no third-party QR requests');
      await page.locator('.site-nav a[href="#/cabinet"]').click(); await ready(page);
      check(await page.locator('[data-key="chip-herbs-ginkgo"]').count() === 1 && await page.locator('[data-key="chip-drugs-aspirin"]').count() === 1 && await page.locator('[data-key="chip-herbs-danshen"]').count() === 0, label + ': My cabinet returns to the recipient’s own list');
      await page.goto(sharedURL); await ready(page);
      let allowReplace = false, dialogs = 0;
      page.on('dialog', async dialog => { dialogs++; await (allowReplace ? dialog.accept() : dialog.dismiss()); });
      await page.click('.save-shared-list');
      check(dialogs === 1 && await page.evaluate(key => localStorage.getItem(key), KEY) === rawA, label + ': cancelling replacement preserves the existing list');
      allowReplace = true;
      await page.click('.save-shared-list');
      const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), KEY);
      check(dialogs === 2 && JSON.stringify(saved.herbs) === JSON.stringify(B.herbs) && JSON.stringify(saved.drugs) === JSON.stringify(B.drugs) && !saved.demo && !saved.demoBackup, label + ': explicit confirmation saves the shared list and clears stale demo state');
      await page.locator('.save-shared-list').waitFor({ state: 'hidden' });
      check(await page.locator('.shared-save-status').innerText() !== '' && await page.locator('.summary-actions .btn-primary').count() === 1, label + ': saved confirmation replaces the read-only notice and restores Print as the main action');
      check(errors.length === 0, label + ': no browser errors' + (errors.length ? ' — ' + errors.join('; ') : ''));
      if (width === 390) await page.screenshot({ path: path.join(OUT, `shared-${lang}.png`), fullPage: true });
      await context.close();
    }

    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    const page = await context.newPage();
    await page.goto(sharedURL); await ready(page);
    check(await page.evaluate(key => localStorage.getItem(key), KEY) === null, 'Empty phone: opening a shared list creates no saved cabinet');
    await page.click('.save-shared-list');
    const emptySave = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), KEY);
    check(JSON.stringify(emptySave.herbs) === JSON.stringify(B.herbs) && JSON.stringify(emptySave.drugs) === JSON.stringify(B.drugs), 'Empty phone: explicit Save stores the complete shared list');
    const preserved = JSON.stringify({ herbs: ['ginkgo'], drugs: ['aspirin'], lang: 'en' });
    await page.evaluate(([key, value]) => localStorage.setItem(key, value), [KEY, preserved]);
    for (const [name, raw] of malformed) {
      await page.goto(BASE + '#/summary?l=' + raw); await ready(page);
      check(await page.locator('.shared-list-error').isVisible() && await page.evaluate(key => localStorage.getItem(key), KEY) === preserved, 'Browser: invalid ' + name + ' shows a clear error without changing the saved cabinet');
    }
    await context.close();

    const blocked = await browser.newContext({ serviceWorkers: 'block' });
    await blocked.addInitScript(() => {
      const set = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (key === 'herbsafe.v1' && window.__blockCabinetSave) throw new DOMException('Storage blocked for this test', 'QuotaExceededError');
        return set.call(this, key, value);
      };
    });
    const blockedPage = await blocked.newPage();
    await blockedPage.goto(sharedURL); await ready(blockedPage);
    await blockedPage.evaluate(() => { window.__blockCabinetSave = true; });
    await blockedPage.click('.save-shared-list');
    await blockedPage.locator('.shared-save-status').filter({ hasText: /could not save/i }).waitFor();
    check(await blockedPage.evaluate(key => localStorage.getItem(key), KEY) === null && await blockedPage.locator('.shared-save-status').innerText() !== '' && await blockedPage.locator('.save-shared-list').isEnabled(), 'Blocked storage: failed save reports a status, leaves no saved list and permits retry');
    await blocked.close();

    const offline = await browser.newContext({ serviceWorkers: 'block' });
    const offlinePage = await offline.newPage();
    await offlinePage.goto(BASE); await ready(offlinePage);
    await offlinePage.evaluate(({ key, list }) => localStorage.setItem(key, JSON.stringify({ ...list, lang: 'en' })), { key: KEY, list: B });
    await offlinePage.reload(); await ready(offlinePage);
    await offline.setOffline(true);
    await offlinePage.goto(BASE + '#/summary'); await ready(offlinePage);
    check(await offlinePage.locator('.share-qr svg').isVisible() && await offlinePage.locator('.share-link').inputValue() === expectedLink, 'Offline: loaded app generates the QR and shared link without any network');
    await decodeActualQR(offlinePage, 'Offline');
    await offline.close();
  } finally { await browser.close(); }
  console.log(`Screenshots: ${OUT}`);
  console.log(`Independent QR decodes: ${decodedQRs}${decoderUnavailable ? ' (some decoding unverified: no decoder available)' : ''}`);
  console.log(failed ? `${failed} FAILED` : 'Shared lists: all available checks passed');
  process.exitCode = failed ? 1 : 0;
})().catch(error => { console.error(error); process.exitCode = 1; });
