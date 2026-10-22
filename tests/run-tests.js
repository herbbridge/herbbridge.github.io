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
  uses: load('data/uses.json'),
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
var sdb = lookup.createDb(data.herbs, data.drugs, data.interactions, data.official, data.reviews, data.uses);
var badSpoken = [];
data.herbs.herbs.forEach(function (h) {
  data.drugs.drugs.forEach(function (d) {
    var r = lookup.checkPairs(sdb, [h.id], [d.id])[0];
    ['en', 'zh'].forEach(function (lang) {
      data.i18n.setLang(lang);
      var name = function (x) { return lang === 'zh' ? x.name_zh : x.name_en; };
      var parts = speech.script(sdb, r, lang, data.i18n.t, name);
      var text = parts.join(' ').replace(/（英文原文翻譯）/g, ''); // the translation label is allowed
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
// The owner's read-aloud rules (20 Oct).
function spoken(h, d, lang) {
  data.i18n.setLang(lang);
  var out = speech.script(sdb, lookup.checkPairs(sdb, [h], [d])[0], lang, data.i18n.t, function (x) { return lang === 'zh' ? x.name_zh : x.name_en; });
  data.i18n.setLang('en');
  return out;
}
var rules = [];
var hc = spoken('american_ginseng', 'warfarin', 'zh'), ema = spoken('ginkgo', 'clopidogrel', 'zh'), ha = spoken('danshen', 'warfarin', 'zh');
rules.push(['Chinese Health Canada and EMA quotes are labelled （英文原文翻譯）; the HA original is not',
  hc[1].indexOf('加拿大衞生部話（英文原文翻譯）：') === 0 && ema[1].indexOf('歐洲藥品管理局話（英文原文翻譯）：') === 0 && ha[1].indexOf('醫院管理局話：') === 0]);
var dq = spoken('dong_quai', 'warfarin', 'en'), dqz = spoken('dong_quai', 'warfarin', 'zh');
rules.push(['dong quai + warfarin What to do is the owner\'s wording',
  dq.indexOf('What to do: tell your doctor that you take dong quai, and ask about a clotting test.') !== -1 &&
  dqz.indexOf('應該點做：話俾醫生知你有食當歸，同埋問吓需唔需要驗凝血指數。') !== -1]);
var hcEn = spoken('american_ginseng', 'warfarin', 'en')[1];
rules.push(['Health Canada list is spoken as "health care practitioner" only', /Ask a health care practitioner before use/.test(hcEn) && !/physician|provider|professional/.test(hcEn)]);
var repeats = [];
data.herbs.herbs.forEach(function (h) { data.drugs.drugs.forEach(function (d) { ['en', 'zh'].forEach(function (lang) {
  var seen = {};
  spoken(h.id, d.id, lang).forEach(function (p) {
    (lang === 'zh' ? p.match(/[^。！？]+[。！？]?/g) || [] : p.split(/(?<=[.!?])\s+/)).forEach(function (x) {
      var k = x.toLowerCase().replace(/^.*?[:：]\s*/, '').replace(/[\s.,;:!?。，、；：！？]/g, '');
      if (k.length > 8 && seen[k]) repeats.push(h.id + '+' + d.id + ' ' + lang + ': ' + x);
      seen[k] = true;
    });
  });
}); }); });
rules.push(['no sentence is spoken twice in one reading', repeats.length === 0, repeats.slice(0, 5).join('\n')]);
rules.push(['every Low card is spoken "Low risk. Keep an eye on it."', spoken('sanqi', 'warfarin', 'en')[0] === 'Sanqi and warfarin. Low risk. Keep an eye on it.' &&
  spoken('danshen', 'amlodipine', 'en')[0] === 'Danshen and amlodipine. Low risk. Keep an eye on it.' && spoken('danshen', 'amlodipine', 'zh')[0] === '丹參同氨氯地平。低度風險。要留意。']);
var goji = spoken('goji', 'warfarin', 'en'), long = [];
data.herbs.herbs.forEach(function (h) { data.drugs.drugs.forEach(function (d) { ['en', 'zh'].forEach(function (lang) {
  spoken(h.id, d.id, lang).forEach(function (p) { if (p.indexOf(lang === 'zh' ? '應該點做' : 'What to do') === 0 && (lang === 'zh' ? (p.match(/[。！？]/g) || []).length : p.split(/(?<=[.!?])\s+/).length) > 1) long.push(h.id + '+' + d.id + ' ' + lang); });
}); }); });
rules.push(['What to do is one sentence per spoken piece', long.length === 0 && goji.length > 4, long.slice(0, 5).join(', ')]);
rules.forEach(function (x) { results.push({ group: 'Read aloud', name: x[0], pass: !!x[1], detail: x[2] || '' }); });
// "What people take it for" (box and spoken lines): rated pairs only, never on a pair with no record (owner, 22 Oct).
var usesBad = [], usesSeen = { rated: 0, grey: 0 };
sdb.uses.forEach(function (u) { data.drugs.drugs.forEach(function (d) { ['en', 'zh'].forEach(function (lang) {
  var r = lookup.checkPairs(sdb, [u.herb_id], [d.id])[0], grey = r.status === 'not_in_database';
  var box = lookup.usesFor(sdb, r);
  var said = spoken(u.herb_id, d.id, lang).some(function (p) { return p.indexOf(lang === 'zh' ? '一般用嚟做咩' : 'What people take it for') === 0; });
  usesSeen[grey ? 'grey' : 'rated']++;
  if (grey && (box || said)) usesBad.push(u.herb_id + '+' + d.id + ' ' + lang + ': shown on a pair with no record');
  if (!grey && (!box || !said)) usesBad.push(u.herb_id + '+' + d.id + ' ' + lang + ': missing on a rated pair');
}); }); });
results.push({ group: 'What people take it for', name: 'box and Read aloud lines only on rated pairs, never on "not in our database"',
  pass: usesBad.length === 0 && usesSeen.grey > 0 && usesSeen.rated > 0, detail: usesBad.slice(0, 10).join('\n') + ' (rated ' + usesSeen.rated + ', no record ' + usesSeen.grey + ')' });

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
