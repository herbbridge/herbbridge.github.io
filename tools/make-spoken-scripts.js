#!/usr/bin/env node
/* Writes docs/spoken-scripts.txt: the Read aloud script (js/speech.js) for every rated pair and
   every official caution, in English and Chinese, for review.  node tools/make-spoken-scripts.js */
'use strict';
var fs = require('fs');
var path = require('path');
var root = path.join(__dirname, '..');
var lookup = require('../js/lookup.js');
var speech = require('../js/speech.js');
var i18n = require('../js/i18n.js').HerbSafeI18n;
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
  'HerbSafe Read aloud: spoken scripts for review',
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
