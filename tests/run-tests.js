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
  official: load('data/official.json'),
  reviews: load('data/reviews.json'),
  cases: load('tests/test-cases.json'),
  i18n: require('../js/i18n.js').HerbSafeI18n
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
var group = null, failed = 0;
results.forEach(function (r) {
  if (r.group !== group) { group = r.group; console.log('\n' + group); }
  console.log((r.pass ? '  ✓ ' : '  ✗ ') + r.name);
  if (!r.pass) { failed++; if (r.detail) console.log('     ' + r.detail.split('\n').join('\n     ')); }
});
console.log('\n' + (results.length - failed) + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
