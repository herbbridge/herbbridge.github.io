#!/usr/bin/env node
/* Writes docs/spoken-scripts.txt (and audio/RECORDING-LIST.md for the demo pairs): the Read aloud script (js/speech.js) for every rated pair and
   every official caution, in English and Chinese, for review.  node tools/make-spoken-scripts.js */
'use strict';
var fs = require('fs');
var path = require('path');
var root = path.join(__dirname, '..');
var lookup = require('../js/lookup.js');
var speech = require('../js/speech.js');
var i18n = require('../js/i18n.js').HerbBridgeI18n;
function load(rel) { return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8')); }

var herbs = load('data/herbs.json'), drugs = load('data/drugs.json');
var db = lookup.createDb(herbs, drugs, load('data/interactions.json'), load('data/official.json'), load('data/reviews.json'));
var rows = [];
herbs.herbs.forEach(function (h) {
  drugs.drugs.forEach(function (d) {
    var r = lookup.checkPairs(db, [h.id], [d.id])[0];
    if (r.entry || r.official) rows.push(r);
  });
});

var out = [
  'HerbBridge Read aloud: spoken scripts for review',
  'Made by tools/make-spoken-scripts.js from js/speech.js and data/ (' + rows.length + ' pairs).',
  'Each numbered line is said as a separate piece, with a short pause between pieces.',
  'The words on screen are not changed by this script.',
  ''
];
rows.forEach(function (r, n) {
  out.push('================================================================');
  out.push((n + 1) + '. ' + r.herb.name_en + ' + ' + r.drug.name_en + '  (' + r.herb.id + '-' + r.drug.id + ', status: ' + r.status + ')');
  ['en', 'zh'].forEach(function (lang) {
    i18n.setLang(lang);
    var name = function (x) { return lang === 'zh' ? x.name_zh : x.name_en; };
    out.push('');
    out.push(lang === 'en' ? '  English' : '  中文');
    speech.script(db, r, lang, i18n.t, name).forEach(function (p, i) { out.push('  [' + (i + 1) + '] ' + p); });
  });
  out.push('');
});
fs.writeFileSync(path.join(root, 'docs', 'spoken-scripts.txt'), out.join('\n'));
console.log('wrote docs/spoken-scripts.txt (' + rows.length + ' pairs)');

// audio/RECORDING-LIST.md: what to record for the demo (Mrs Wong takes warfarin and amlodipine and adds
// danshen), with the same text as the app's Read aloud, so a recording and the phone voice say the same.
var DEMO = [['danshen', 'warfarin'], ['danshen', 'amlodipine']];
var rec = [
  '# Recording list (Read aloud)',
  '',
  'Human recordings for the demo pairs (Mrs Wong: warfarin and amlodipine, then danshen). A recording',
  'is played instead of the phone voice for that pair and language; any pair or language without one',
  'uses the phone voice. Made by `tools/make-spoken-scripts.js` from the same script as the app',
  '(`js/speech.js`, see `docs/spoken-scripts.txt`). Do not use AI-generated voices.',
  '',
  '## How to record',
  '',
  '- Read each numbered line as a short sentence, with a short pause (about 1 second) between lines.',
  '- Quiet room, phone about 20 cm from the mouth, no music. Normal, calm speed.',
  '- English: British English. Chinese: Cantonese, read as written (it is Cantonese-style written Chinese).',
  '- Format: **MP3, mono, 44.1 kHz, 64–96 kbps, under 1 MB** per file (about 1 minute or less).',
  '  The app plays `.mp3` only; if the phone records `.m4a`, convert it to MP3 first.',
  '- Save each file in `audio/` with the exact name below, then add the name to `files` in',
  '  `audio/manifest.json`, e.g. `"files": ["danshen-warfarin.en.mp3"]`. Bump the cache version in `sw.js`.',
  '- Check: `node tests/run-tests.js` (every listed file must exist and be named correctly), then open',
  '  the pair in the app and tap Read aloud: the recording plays instead of the phone voice.',
  ''
];
DEMO.forEach(function (pair) {
  var r = lookup.checkPairs(db, [pair[0]], [pair[1]])[0];
  rec.push('## ' + r.herb.name_en + ' + ' + r.drug.name_en + ' (' + r.herb.name_zh + ' + ' + r.drug.name_zh + ')', '');
  ['en', 'zh'].forEach(function (lang) {
    i18n.setLang(lang);
    var name = function (x) { return lang === 'zh' ? x.name_zh : x.name_en; };
    rec.push('**' + (lang === 'en' ? 'English' : 'Cantonese 廣東話') + '**: save as `audio/' + r.herb.id + '-' + r.drug.id + '.' + lang + '.mp3`', '');
    speech.script(db, r, lang, i18n.t, name).forEach(function (p, i) { rec.push((i + 1) + '. ' + p); });
    rec.push('');
  });
});
i18n.setLang('en');
fs.writeFileSync(path.join(root, 'audio', 'RECORDING-LIST.md'), rec.join('\n'));
console.log('wrote audio/RECORDING-LIST.md (' + DEMO.length + ' demo pairs)');
