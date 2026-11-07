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
data.reminders.forEach(function (r) {
  check(r.source && /^https:\/\/www3\.ha\.org\.hk\//.test(r.source.url_en) && /^https:\/\/www3\.ha\.org\.hk\//.test(r.source.url_zh), r.id + ': links point to the Hospital Authority site');
  check(/1-2 hours/.test(r.quote_en) && /cannot avoid any potential interactions/.test(r.quote_en), r.id + ': English quote keeps both the gap and its limit');
  check(/一至兩小時/.test(r.quote_zh) && /無法避免/.test(r.quote_zh), r.id + ': Chinese quote keeps both the gap and its limit');
  check(typeof r.team_checked === 'boolean', r.id + ': team check status recorded');
});
['en', 'zh'].forEach(function (l) { check(!/\bsafe\b|安全|cure|diagnos|prevent/i.test(JSON.stringify(R.WORDS[l])), l + ' reminder wording avoids safety claims'); });
console.log(passed + ' passed, ' + failed + ' failed');
process.exitCode = failed ? 1 : 0;
