#!/usr/bin/env node
/* General reminder tests:  node tests/reminders-tests.js */
'use strict';
var fs = require('fs'), path = require('path');
var R = require('../js/reminders.js');
var data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data/reminders.json'), 'utf8'));
var passed = 0, failed = 0;
function check(ok, name) { if (ok) { passed++; console.log('PASS ' + name); } else { failed++; console.log('FAIL ' + name); } }
check(R.applicable(data, { herbs: ['danshen'], drugs: ['warfarin'] }).length === 1, 'Reminder shown when the list has a herb and a medicine');
check(R.applicable(data, { herbs: [], drugs: ['warfarin'] }).length === 0, 'Not shown for Western medicines only');
check(R.applicable(data, { herbs: ['danshen'], drugs: [] }).length === 0, 'Not shown for herbs only');
check(R.applicable(data, { herbs: [], drugs: ['simvastatin'] }).map(function (r) { return r.id; }).join() === 'food_simvastatin_grapefruit,food_simvastatin_pomelo', 'Simvastatin food hints shown only when simvastatin is listed');
check(R.applicable(data, { herbs: [], drugs: ['amlodipine'] }).length === 0, 'No food hint for a medicine without a sourced hint (amlodipine)');
data.reminders.filter(function (r) { return r.applies === 'herb_and_drug'; }).forEach(function (r) {
  check(r.source && /^https:\/\/www3\.ha\.org\.hk\//.test(r.source.url_en) && /^https:\/\/www3\.ha\.org\.hk\//.test(r.source.url_zh), r.id + ': links point to the Hospital Authority site');
  check(/1-2 hours/.test(r.quote_en) && /cannot avoid any potential interactions/.test(r.quote_en), r.id + ': English quote keeps both the gap and its limit');
  check(/一至兩小時/.test(r.quote_zh) && /無法避免/.test(r.quote_zh), r.id + ': Chinese quote keeps both the gap and its limit');
  check(typeof r.team_checked === 'boolean', r.id + ': team check status recorded');
});
data.reminders.filter(function (r) { return r.applies === 'drug'; }).forEach(function (r) {
  if (/_pomelo$/.test(r.id)) check(r.source.url_en === 'https://pmc.ncbi.nlm.nih.gov/articles/PMC3589309/' && /pomelos/.test(r.quote_en) && !!r.note_en && !!r.note_zh, r.id + ': pomelo quote links to the CMAJ review and explains itself');
  else check(/^https:\/\/dailymed\.nlm\.nih\.gov\//.test(r.source.url_en) && /grapefruit juice/i.test(r.quote_en), r.id + ': grapefruit quote links to a DailyMed label');
});
['en', 'zh'].forEach(function (l) { check(!/\bsafe\b|安全|cure|diagnos|prevent/i.test(JSON.stringify(R.WORDS[l])), l + ' reminder wording avoids safety claims'); });
console.log(passed + ' passed, ' + failed + ' failed');
process.exitCode = failed ? 1 : 0;
