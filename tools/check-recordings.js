/*
 * Recording check. Needs Playwright. Serve the repo first:  python3 -m http.server 8000
 * Then:  node tools/check-recordings.js
 * For every file in audio/manifest.json: open that pair in that language, tap Read aloud, and check
 * the recording really plays (the browser decodes it) and the phone voice says nothing. Also checks
 * that a pair with no recording in a language still uses the phone voice.
 */
const fs = require('fs');
const path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }
const ready = require('./wait-ready');
const BASE = process.argv[2] || 'http://localhost:8000/';
const KEY = BASE.includes('/preview/') ? 'herbsafe.preview' : 'herbsafe';
const files = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'audio', 'manifest.json'), 'utf8')).files || [];

async function read(b, pair, lang) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await ctx.addInitScript(() => {
    window.__spoken = []; window.__audio = [];
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      const a = this, rec = { src: a.src, playing: false, error: null, duration: 0 };
      window.__audio.push(rec);
      a.muted = true; // checked silently
      a.addEventListener('playing', () => { rec.playing = true; rec.duration = a.duration; });
      a.addEventListener('error', () => { rec.error = a.error && a.error.code; });
      return play.call(a);
    };
    const synth = { speaking: false, pending: false, getVoices: () => [{ name: 'Daniel', lang: 'en-GB', localService: true }, { name: 'Sinji', lang: 'zh-HK', localService: true }],
      addEventListener() {}, cancel() {}, speak(u) { window.__spoken.push(u.text); setTimeout(() => { u.onstart && u.onstart(); }, 10); } };
    Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
    window.SpeechSynthesisUtterance = function (text) { this.text = text; };
  });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE);
  await p.evaluate(([k, l]) => localStorage.setItem(k + '.v1', JSON.stringify({ herbs: [], drugs: [], lang: l })), [KEY, lang]);
  await p.goto(BASE + '#/pair/' + pair); await p.reload(); await ready(p);
  await p.click('.read-aloud'); await p.waitForTimeout(1500);
  const r = await p.evaluate(() => ({ audio: window.__audio, spoken: window.__spoken.length }));
  await ctx.close();
  return { ...r, errs };
}

(async () => {
  const b = await chromium.launch(); let failed = 0;
  const check = (ok, name) => { if (!ok) failed++; console.log((ok ? '  ✓ ' : '  ✗ ') + name); };
  if (!files.length) console.log('audio/manifest.json lists no recordings yet: every pair uses the phone voice.');
  const listed = new Set(files);
  for (const f of files) {
    const m = f.match(/^([a-z0-9_]+-[a-z0-9_]+)\.(en|zh)\.mp3$/);
    if (!m) { check(false, `${f}: name must be <herb>-<drug>.<en|zh>.mp3`); continue; }
    const r = await read(b, m[1], m[2]);
    const a = r.audio[0];
    check(a && a.playing && !a.error && r.spoken === 0 && !r.errs.length,
      `${f}: plays instead of the phone voice (${a ? (a.playing ? 'played, ' + a.duration.toFixed(1) + ' s' : 'did not play' + (a.error ? ', error ' + a.error : '')) : 'no recording used'}; phone voice pieces ${r.spoken})`);
    const other = m[2] === 'en' ? 'zh' : 'en';
    if (!listed.has(`${m[1]}.${other}.mp3`)) {
      const o = await read(b, m[1], other);
      check(o.audio.length === 0 && o.spoken > 0, `${m[1]} in ${other}: no recording, so the phone voice reads it (${o.spoken} pieces)`);
    }
  }
  const fallback = await read(b, 'sanqi-warfarin', 'en');
  if (!listed.has('sanqi-warfarin.en.mp3')) check(fallback.audio.length === 0 && fallback.spoken > 0, `a pair without recordings uses the phone voice (${fallback.spoken} pieces)`);
  console.log(failed ? `\n${failed} FAILED` : '\nRecordings: all checks passed');
  process.exitCode = failed ? 1 : 0;
  await b.close();
})();
