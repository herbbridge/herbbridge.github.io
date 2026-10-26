/*
 * One-A4-page print check: the doctor summary for the demo list must print on a single A4 page,
 * in both languages and both modes. A bigger list is printed too, for information only.
 * Needs Playwright and Python's pypdf. Serve the repo first:  python3 -m http.server 8000
 * Then:  node tools/check-print.js   (PDFs go to a temporary folder outside the repo; the path is printed)
 */
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }
const ready = require('./wait-ready');
const { execFileSync } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path');
const OUT = fs.mkdtempSync(path.join(os.tmpdir(), 'herbbridge-print-'));
const LISTS = { demo: { herbs: ['danshen'], drugs: ['warfarin', 'amlodipine'] },
  bigger: { herbs: ['danshen', 'ginkgo', 'goji'], drugs: ['warfarin', 'aspirin', 'amlodipine'] } };
(async () => { const b = await chromium.launch(); let bad = 0;
  for (const lang of ['en', 'zh']) for (const mode of ['simple', 'full']) for (const [name, l] of Object.entries(LISTS)) {
    const ctx = await b.newContext({ serviceWorkers: 'block' }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('http://localhost:8000/');
    await p.evaluate(([l, lang, mode]) => { localStorage.setItem('herbsafe.v1', JSON.stringify({ herbs: l.herbs, drugs: l.drugs, lang })); localStorage.setItem('herbsafe.mode', mode); }, [l, lang, mode]);
    await p.goto('http://localhost:8000/#/summary'); await p.reload(); await ready(p);
    await p.evaluate(() => document.fonts.ready);
    const rows = await p.$$eval('.summary tr, .summary .sum-row, .summary li', x => x.length).catch(() => 0);
    await p.emulateMedia({ media: 'print' });
    const file = path.join(OUT, `print-${lang}-${mode}-${name}.pdf`);
    await p.pdf({ path: file, format: 'A4', printBackground: true, preferCSSPageSize: true });
    const pages = parseInt(execFileSync('python3', ['-I', '-c', 'import sys,pypdf;print(len(pypdf.PdfReader(sys.argv[1]).pages))', file]).toString());
    if ((name === 'demo' && pages !== 1) || errs.length) bad++;
    console.log(`${pages === 1 ? '✓' : name === 'demo' ? '✗' : '·'} ${lang} ${mode} ${name} list: ${pages} page(s) | errors ${errs.length}`);
    await ctx.close();
  }
  console.log(bad ? `${bad} FAILED` : 'Demo list: one A4 page in every language and mode');
  console.log(`PDFs saved in ${OUT}`);
  process.exitCode = bad ? 1 : 0; await b.close(); })();
