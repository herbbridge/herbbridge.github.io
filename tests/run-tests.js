#!/usr/bin/env node
/* Run all HerbSafe tests in Node:  node tests/run-tests.js */
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
  cases: load('tests/test-cases.json'),
  i18n: require('../js/i18n.js').HerbSafeI18n
};

var results = suite.runAll(lookup, data);
var group = null, failed = 0;
results.forEach(function (r) {
  if (r.group !== group) { group = r.group; console.log('\n' + group); }
  console.log((r.pass ? '  ✓ ' : '  ✗ ') + r.name);
  if (!r.pass) { failed++; if (r.detail) console.log('     ' + r.detail.split('\n').join('\n     ')); }
});
console.log('\n' + (results.length - failed) + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
