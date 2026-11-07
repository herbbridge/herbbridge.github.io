#!/usr/bin/env node
/* Conditions tests:  node tests/conditions-tests.js */
'use strict';
var fs = require('fs'), path = require('path');
var C = require('../js/conditions.js'), lookup = require('../js/lookup.js');
function load(rel) { return JSON.parse(fs.readFileSync(path.join(__dirname, '..', rel), 'utf8')); }
var db = lookup.createDb(load('data/herbs.json'), load('data/drugs.json'), load('data/interactions.json'), load('data/official.json'), load('data/reviews.json'));
var data = load('data/conditions.json');
var passed = 0, failed = 0;
function check(ok, name, d) { if (ok) { passed++; console.log('PASS ' + name); } else { failed++; console.log('FAIL ' + name + (d ? ' — ' + d : '')); } }
function store() { var s = {}; return { getItem: function (k) { return k in s ? s[k] : null; }, setItem: function (k, v) { s[k] = String(v); }, removeItem: function (k) { delete s[k]; }, raw: s }; }

Object.keys(data.conditions).forEach(function (cid) {
  var c = data.conditions[cid];
  (c.items || []).forEach(function (it) {
    var byId = it.kind === 'drugs' ? db.drugById : db.herbById;
    check(!!byId[it.id], cid + ': ' + it.id + ' is a real catalogue item');
    if (it.quote_en) check(/^https:\/\/dailymed\.nlm\.nih\.gov\/dailymed\/drugInfo\.cfm\?setid=[0-9a-f-]{36}$/.test(it.source.url_en), cid + ': ' + it.id + ' quote links to a DailyMed label');
    check(!!(it.quote_en || it.uses === 'general'), cid + ': ' + it.id + ' has its own quote or points to the general source quote');
  });
  if (c.general) check(/^https:\/\/www\.fhs\.gov\.hk\//.test(c.general.source.url_en) && /^https:\/\/www\.fhs\.gov\.hk\//.test(c.general.source.url_zh), cid + ': general quote links to the Department of Health');
});
var r = C.evaluate(data, 'pregnancy', { herbs: ['danshen'], drugs: ['losartan', 'aspirin'] }, db);
check(r.matched.length === 1 && r.matched[0].item.id === 'losartan', 'Pregnancy caution matched for losartan');
check(r.unchecked.map(function (i) { return i.id; }).join() === 'aspirin,danshen', 'Items not yet checked for pregnancy are listed as unchecked, not as fine');
var g = C.evaluate(data, 'g6pd', { herbs: [], drugs: ['aspirin', 'warfarin'] }, db);
check(g.general && g.matched.length === 1 && g.matched[0].item.id === 'aspirin' && g.unchecked[0].id === 'warfarin', 'G6PD: general Department of Health caution, aspirin note, warfarin unchecked');
check(/Aspirin group Antipyretics if used in high dose/.test(g.general.quote_en) && /亞士匹靈/.test(g.general.quote_zh), 'G6PD quote keeps the "high dose" wording in both languages');

var s = store();
C.save(s, { g6pd: true, pregnancy: { since: '2026-10-01' } });
var st = C.load(s); check(st.g6pd === true && st.pregnancy.since === '2026-10-01', 'Conditions saved and read back on this device');
C.save(s, { g6pd: true, pregnancy: null }); check(!C.load(s).pregnancy, 'Pregnancy can be removed');
C.save(s, {}); check(!(C.KEY in s.raw), 'Removing everything deletes the record');
s.raw[C.KEY] = '{"v":1,"pregnancy":{"since":"<script>"}}'; check(!C.load(s).pregnancy, 'Malformed saved data is ignored');
['en', 'zh'].forEach(function (l) {
  var t = JSON.stringify(C.WORDS[l]);
  check(!/\bsafe\b|安全|diagnos|prevent|cure/i.test(t), l + ' wording avoids safety claims');
  check(/Do not stop|唔好自己停藥/.test(t), l + ' wording says not to stop medicines on your own');
});
console.log(passed + ' passed, ' + failed + ' failed');
process.exitCode = failed ? 1 : 0;
