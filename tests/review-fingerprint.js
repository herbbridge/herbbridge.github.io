#!/usr/bin/env node
/* Print the fingerprint of a card, for adding a pharmacist review to data/reviews.json.
   node tests/review-fingerprint.js <herb_id> <drug_id>     (one card)
   node tests/review-fingerprint.js                          (every card) */
'use strict';
var fs = require('fs');
var path = require('path');
var L = require('../js/lookup.js');
function load(rel) { return JSON.parse(fs.readFileSync(path.join(__dirname, '..', rel), 'utf8')); }
var db = L.createDb(load('data/herbs.json'), load('data/drugs.json'), load('data/interactions.json'), load('data/official.json'), load('data/reviews.json'), load('data/uses.json'));
var herb = process.argv[2], drug = process.argv[3];
var rows = L.checkPairs(db, herb ? [herb] : db.herbs.map(function (h) { return h.id; }), drug ? [drug] : db.drugs.map(function (d) { return d.id; }));
if (!rows.length) { console.error('Unknown herb_id or drug_id.'); process.exit(1); }
rows.forEach(function (r) {
  console.log(r.herb.id + ' ' + r.drug.id + '  ' + L.cardFingerprint(db, r.herb.id, r.drug.id) + '  (' + r.status + (r.review ? ', reviewed ' + r.review.date : '') + ')');
});
