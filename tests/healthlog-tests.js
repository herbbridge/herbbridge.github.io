#!/usr/bin/env node
/* Daily health log tests:  node tests/healthlog-tests.js */
'use strict';
var fs = require('fs'), path = require('path');
var H = require('../js/healthlog.js'), lookup = require('../js/lookup.js');
function load(rel) { return JSON.parse(fs.readFileSync(path.join(__dirname, '..', rel), 'utf8')); }
var db = lookup.createDb(load('data/herbs.json'), load('data/drugs.json'), load('data/interactions.json'), load('data/official.json'), load('data/reviews.json'));
var known = { herbs: db.herbById, drugs: db.drugById };
var passed = 0, failed = 0;
function check(ok, name, detail) { if (ok) { passed++; console.log('PASS ' + name); } else { failed++; console.log('FAIL ' + name + (detail ? ' — ' + detail : '')); } }
function store() { var s = {}; return { getItem: function (k) { return k in s ? s[k] : null; }, setItem: function (k, v) { s[k] = String(v); }, removeItem: function (k) { delete s[k]; }, raw: s }; }
var AT = '2026-11-08T08:30';

var ok = H.validate({ at: AT, sys: '128', dia: '82', hr: '71', sugar: '5,6', sugar_when: 'before_meal', taken: { drugs: ['warfarin', 'warfarin', 'nope'], herbs: ['danshen'] }, note: ' x ' }, known);
check(ok.entry && ok.entry.sys === 128 && ok.entry.dia === 82 && ok.entry.hr === 71, 'Blood pressure and heart rate saved as numbers');
check(ok.entry && ok.entry.sugar === 5.6 && ok.entry.sugar_when === 'before_meal', 'Blood sugar accepts a comma decimal and keeps when it was measured');
check(ok.entry && JSON.stringify(ok.entry.taken) === '{"herbs":["danshen"],"drugs":["warfarin"]}', 'Taken list keeps only known, de-duplicated medicines');
check(ok.entry && ok.entry.note === 'x', 'Note is trimmed');
check(H.validate({ at: AT, taken: { drugs: ['aspirin'] } }, known).entry, 'A medicine tick alone is a valid entry (readings optional)');
check(H.validate({ at: AT, hr: '64' }, known).entry, 'A single reading alone is a valid entry');
check(H.validate({ at: AT }, known).errors.indexOf('empty') !== -1, 'An empty entry is refused');
check(H.validate({ at: AT, sys: '130' }, known).errors.indexOf('dia') !== -1, 'Blood pressure needs both numbers');
check(H.validate({ at: AT, sys: '80', dia: '120' }, known).errors.indexOf('bp_order') !== -1, 'Swapped blood pressure numbers are caught');
check(H.validate({ at: AT, hr: '700' }, known).errors.indexOf('hr') !== -1, 'An impossible heart rate (typo) is caught');
check(H.validate({ at: AT, sugar: '56' }, known).errors.indexOf('sugar') !== -1, 'Blood sugar typed in the wrong unit (56) is caught');
check(H.validate({ at: 'not a date', hr: '70' }, known).errors.indexOf('at') !== -1, 'A missing date is caught');
check(H.validate({ at: AT, sugar_when: 'after_meal', hr: '70' }, known).entry.sugar_when === null, '"When measured" is dropped when there is no sugar reading');

var s = store();
var e1 = H.validate({ at: '2026-11-07T08:00', sys: '120', dia: '80' }, known).entry;
var e2 = H.validate({ at: '2026-11-06T08:00', sys: '125', dia: '85' }, known).entry;
H.add(s, e1, function () { return 'a'; }); H.add(s, e2, function () { return 'b'; });
var all = H.load(s);
check(all.length === 2 && all[0].id === 'b', 'Entries are saved and kept in time order');
H.remove(s, 'b'); check(H.load(s).length === 1 && H.load(s)[0].id === 'a', 'One entry can be deleted');
H.clearAll(s); check(H.load(s).length === 0, 'All entries can be deleted');
s.raw[H.KEY] = '{broken'; check(H.load(s).length === 0, 'Broken saved data is ignored safely');

var now = new Date('2026-11-08T12:00:00Z');
var recent = H.since([{ at: '2026-11-07T00:00:00Z' }, { at: '2026-10-01T00:00:00Z' }], 14, now);
check(recent.length === 1, 'Only the last 14 days go into the doctor summary');
var pts = H.series([{ at: '2026-11-01T00:00:00Z', sys: 120, dia: 80 }, { at: '2026-11-02T00:00:00Z', hr: 70 }], ['sys', 'dia']);
check(pts.length === 1 && pts[0].values.sys === 120, 'Charts use only entries that have that reading');
var ax = H.axis([120, 140]); check(ax[0] < 120 && ax[1] > 140, 'Chart axis leaves room around the readings');

['en', 'zh'].forEach(function (lang) {
  var words = JSON.stringify(H.WORDS[lang]);
  check(!/\bsafe\b|\bnormal\b|\babnormal\b|\bhealthy\b|cure|diagnos|prevent|正常|異常|安全/i.test(words), lang + ' log wording never judges a reading');
  check(Object.keys(H.WORDS.en).every(function (k) { return typeof H.WORDS[lang][k] === 'string' && H.WORDS[lang][k]; }), lang + ' log wording is complete');
});
console.log(passed + ' passed, ' + failed + ' failed');
process.exitCode = failed ? 1 : 0;
