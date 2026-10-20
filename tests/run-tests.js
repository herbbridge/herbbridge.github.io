#!/usr/bin/env node
/* Run all HerbBridge tests in Node:  node tests/run-tests.js */
'use strict';
var fs = require('fs');
var path = require('path');
var lookup = require('../js/lookup.js');
var suite = require('./test-suite.js');

function load(rel) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, '..', rel), 'utf8'));
}

var data = {
  herbs: load('data/herbs.json'),
  drugs: load('data/drugs.json'),
  interactions: load('data/interactions.json'),
  official: load('data/official.json'),
  reviews: load('data/reviews.json'),
  cases: load('tests/test-cases.json'),
  i18n: require('../js/i18n.js').HerbBridgeI18n
};

var results = suite.runAll(lookup, data);

// Installable app: every file the offline copy needs must exist (Node only: reads sw.js).
var sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
var appFiles = JSON.parse(sw.match(/APP_FILES = (\[[\s\S]*?\]);/)[1].replace(/'/g, '"'));
var missingFiles = appFiles.filter(function (f) { return f !== './' && !fs.existsSync(path.join(__dirname, '..', f)); });
results.push({ group: 'Installable app', name: 'every file in sw.js APP_FILES exists', pass: missingFiles.length === 0, detail: 'missing: ' + missingFiles.join(', ') });
var manifest = load('manifest.webmanifest');
var badIcons = manifest.icons.filter(function (i) { return !fs.existsSync(path.join(__dirname, '..', i.src)); });
results.push({ group: 'Installable app', name: 'manifest icons exist', pass: badIcons.length === 0, detail: badIcons.map(function (i) { return i.src; }).join(', ') });

// Read aloud: the spoken script for every herb × drug pair is easy to listen to (Node only).
var speech = require('../js/speech.js');
var sdb = lookup.createDb(data.herbs, data.drugs, data.interactions, data.official, data.reviews);
var badSpoken = [];
data.herbs.herbs.forEach(function (h) {
  data.drugs.drugs.forEach(function (d) {
    var r = lookup.checkPairs(sdb, [h.id], [d.id])[0];
    ['en', 'zh'].forEach(function (lang) {
      data.i18n.setLang(lang);
      var name = function (x) { return lang === 'zh' ? x.name_zh : x.name_en; };
      var parts = speech.script(sdb, r, lang, data.i18n.t, name);
      var text = parts.join(' ');
      var problem = !parts.length ? 'empty' :
        /[()（）\[\]〔〕【】]/.test(text) ? 'bracket' :
        /\//.test(text) ? 'slash' :
        lang === 'zh' && /[,:;]/.test(text.replace(/\d,\d/g, '')) ? 'English punctuation in Chinese' :
        /\b[Aa]n clotting/.test(text) || parts.some(function (p) { return p.indexOf(data.i18n.t('label_what_to_do')) === 0 && /\bTCM\b/.test(p); }) ? 'wording' :
        /\bINR\b|INR/.test(text) ? 'INR' :
        /\bS\d+\b|https?:|www\.|new tab|新分頁/i.test(text) ? 'source label or link' :
        parts[0].indexOf(name(h)) !== 0 ? 'does not start with the herb name' : '';
      if (problem) badSpoken.push(h.id + '+' + d.id + ' ' + lang + ': ' + problem + ' — ' + text.slice(0, 120));
    });
  });
});
data.i18n.setLang('en');
results.push({ group: 'Read aloud', name: 'spoken script has no brackets, INR, source labels or links', pass: badSpoken.length === 0, detail: badSpoken.slice(0, 10).join('\n') });
var audioList = load('audio/manifest.json').files || [];
var badAudio = audioList.filter(function (f) {
  var m = String(f).replace(/^audio\//, '').match(/^([a-z0-9_]+)-([a-z0-9_]+)\.(en|zh)\.mp3$/);
  return !m || !sdb.herbById[m[1]] || !sdb.drugById[m[2]] || !fs.existsSync(path.join(__dirname, '..', 'audio', String(f).replace(/^audio\//, '')));
});
results.push({ group: 'Read aloud', name: 'every recording in audio/manifest.json exists and is named <herb>-<drug>.<en|zh>.mp3', pass: badAudio.length === 0, detail: badAudio.join(', ') });
var group = null, failed = 0;
results.forEach(function (r) {
  if (r.group !== group) { group = r.group; console.log('\n' + group); }
  console.log((r.pass ? '  ✓ ' : '  ✗ ') + r.name);
  if (!r.pass) { failed++; if (r.detail) console.log('     ' + r.detail.split('\n').join('\n     ')); }
});
console.log('\n' + (results.length - failed) + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
