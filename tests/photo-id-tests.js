#!/usr/bin/env node
/* Photo-text matching tests:  node tests/photo-id-tests.js  (text only; no photos or OCR needed) */
'use strict';
var fs = require('fs'), path = require('path');
var P = require('../js/photo-id.js'), lookup = require('../js/lookup.js');
function load(rel) { return JSON.parse(fs.readFileSync(path.join(__dirname, '..', rel), 'utf8')); }
var db = lookup.createDb(load('data/herbs.json'), load('data/drugs.json'), load('data/interactions.json'), load('data/official.json'), load('data/reviews.json'));
var passed = 0, failed = 0;
function check(ok, name, detail) { if (ok) { passed++; console.log('PASS ' + name); } else { failed++; console.log('FAIL ' + name + (detail ? ' — ' + detail : '')); } }
function top(text) { var r = P.matchText(db, text); return r.length ? r[0].kind + ':' + r[0].id : 'none'; }
function ids(text) { return P.matchText(db, text).map(function (r) { return r.id; }); }

check(top('PLAVIX 75 mg film-coated tablets\nclopidogrel') === 'drugs:clopidogrel', 'Brand and generic on a box → clopidogrel');
check(top('LIPITOR 20mg') === 'drugs:atorvastatin', 'Brand name only (Lipitor) → atorvastatin');
check(top('華法林 鈉片 5毫克') === 'drugs:warfarin', 'Chinese name (華法林) → warfarin');
check(top('Clopidogrol 75mg') === 'drugs:clopidogrel', 'One wrong letter from OCR is tolerated for long Latin names');
check(top('丹參 片') === 'herbs:danshen', 'Herb Chinese name (丹參) → danshen');
check(top('Salvia miltiorrhiza extract') === 'herbs:danshen', 'Herb Latin name → danshen');
check(ids('statin 他汀').length === 0, 'A class word alone (statin) never decides a match');
check(ids('Simvastatin 20 mg statin').indexOf('simvastatin') === 0, 'Class word does not outrank the actual medicine name');
check(ids('Paracetamol 500mg').length === 0, 'Medicines HerbBridge does not cover give no match (no guessing)');
check(ids('').length === 0 && ids(null).length === 0, 'Empty text gives no match');
check(P.matchText(db, 'aspirin warfarin clopidogrel danshen').length === 3, 'At most three candidates are shown');
var r = P.matchText(db, 'PLAVIX 75mg')[0];
check(r && r.words.indexOf('Plavix') !== -1, 'Each candidate lists the words that matched');
check(P.within('clopidogrel', 'clopidogrol', 1) && !P.within('clopidogrel', 'clopidxgrxl', 1), 'Near-miss check allows exactly one change');
['en', 'zh'].forEach(function (lang) {
  var words = JSON.stringify(P.WORDS[lang]);
  check(!/\bsafe\b|cure|diagnos|prevent/i.test(words), lang + ' photo wording avoids safety/diagnosis claims');
  check(Object.keys(P.WORDS.en).every(function (k) { return typeof P.WORDS[lang][k] === 'string' && P.WORDS[lang][k]; }), lang + ' photo wording is complete');
});
console.log(passed + ' passed, ' + failed + ' failed');
process.exitCode = failed ? 1 : 0;
