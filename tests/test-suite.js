/*
 * HerbSafe tests, shared by tests/run-tests.js (Node) and tests/test.html (browser).
 * runAll(lookup, data) returns [{ group, name, pass, detail }].
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.HerbSafeTests = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SEARCH_CASES = [
    { query: 'Danshen', kind: 'herbs', first: 'danshen' },
    { query: '丹參', kind: 'herbs', first: 'danshen' },
    { query: '丹参', kind: 'herbs', first: 'danshen' },
    { query: 'daan sam', kind: 'herbs', first: 'danshen' },
    { query: 'Daan1 Sam1', kind: 'herbs', first: 'danshen' },
    { query: 'dang gui', kind: 'herbs', first: 'dong_quai' },
    { query: '花旗參', kind: 'herbs', first: 'american_ginseng' },
    { query: '高麗參', kind: 'herbs', first: 'asian_ginseng' },
    { query: 'ginseng', kind: 'herbs', includes: ['american_ginseng', 'asian_ginseng'] },
    { query: 'licorice', kind: 'herbs', first: 'liquorice' },
    { query: '甘草', kind: 'herbs', first: 'liquorice' },
    { query: 'hung kuk', kind: 'herbs', first: 'red_yeast_rice' },
    { query: 'tin chat', kind: 'herbs', first: 'sanqi' },
    { query: '田七', kind: 'herbs', first: 'sanqi' },
    { query: 'gau gei', kind: 'herbs', first: 'goji' },
    { query: '紅花', kind: 'herbs', first: 'safflower' },
    { query: 'warf', kind: 'drugs', first: 'warfarin' },
    { query: '華法林', kind: 'drugs', first: 'warfarin' },
    { query: 'frusemide', kind: 'drugs', first: 'furosemide' },
    { query: 'Lipitor', kind: 'drugs', first: 'atorvastatin' },
    { query: 'statin', kind: 'drugs', includes: ['atorvastatin', 'simvastatin', 'rosuvastatin'] },
    { query: 'zzzz', kind: 'drugs', none: true }
  ];

  function ids(list) { return list.map(function (x) { return x.id; }); }

  function runAll(lookup, data) {
    var results = [];
    function check(group, name, pass, detail) {
      results.push({ group: group, name: name, pass: !!pass, detail: pass ? '' : (detail || '') });
    }

    var db = lookup.createDb(data.herbs, data.drugs, data.interactions);

    // 1. The data files themselves.
    var problems = lookup.validateData(db);
    check('Data files', 'herbs.json, drugs.json and interactions.json are valid', problems.length === 0, problems.join('\n'));

    // 2. The 10 medicine lists in tests/test-cases.md.
    data.cases.cases.forEach(function (c) {
      var got = lookup.checkPairs(db, c.herbs, c.drugs).map(function (r) {
        return { herb: r.herb.id, drug: r.drug.id, status: r.status, entry: r.entry ? r.entry.id : null };
      });
      var pass = JSON.stringify(got) === JSON.stringify(c.expected);
      check('Medicine lists', c.id + ': ' + c.name, pass,
        'expected ' + JSON.stringify(c.expected) + '\n     got ' + JSON.stringify(got));
    });

    // 3. Search by English, Chinese, pinyin, Cantonese romanisation and aliases.
    SEARCH_CASES.forEach(function (s) {
      var found = ids(lookup.search(db[s.kind], s.query));
      var pass, want;
      if (s.first) { pass = found[0] === s.first; want = 'first result ' + s.first; }
      else if (s.includes) { pass = s.includes.every(function (id) { return found.indexOf(id) !== -1; }); want = 'includes ' + s.includes.join(', '); }
      else { pass = found.length === 0; want = 'no results'; }
      check('Search', '"' + s.query + '" → ' + want, pass, 'got [' + found.join(', ') + ']');
    });

    // 4. Safety rules and edge cases.
    var all = lookup.checkPairs(db, ids(db.herbs), ids(db.drugs));
    check('Safety rules', 'every pair without an entry is "not_in_database", never a rating',
      all.every(function (r) { return r.entry ? r.status === r.entry.risk : r.status === lookup.NOT_IN_DATABASE; }));
    check('Safety rules', 'goji, sanqi and safflower have no records with any drug',
      all.filter(function (r) { return ['goji', 'sanqi', 'safflower'].indexOf(r.herb.id) !== -1; })
        .every(function (r) { return r.status === lookup.NOT_IN_DATABASE; }));
    check('Safety rules', 'every rated pair has at least one https source and an evidence level',
      db.interactions.every(function (e) {
        return e.sources.length > 0 && e.sources.every(function (s) { return /^https:\/\//.test(s.url); }) && e.evidence_level.length > 0;
      }));
    check('Safety rules', 'results are sorted High → Moderate → Low → No reported risk → Not in database',
      all.every(function (r, i) {
        return i === 0 || lookup.STATUS_ORDER.indexOf(all[i - 1].status) <= lookup.STATUS_ORDER.indexOf(r.status);
      }));

    check('Edge cases', 'no herbs or no medicines → no pairs',
      lookup.checkPairs(db, [], ['warfarin']).length === 0 && lookup.checkPairs(db, ['danshen'], []).length === 0);
    check('Edge cases', 'unknown ids (e.g. from an old saved list) are skipped',
      lookup.checkPairs(db, ['danshen', 'no_such_herb'], ['warfarin', 'no_such_drug']).length === 1);
    check('Edge cases', 'the same item chosen twice is counted once',
      lookup.checkPairs(db, ['danshen', 'danshen'], ['warfarin', 'warfarin']).length === 1);

    // 5. Lookup rules, on small made-up data (not the real database).
    var fake = lookup.createDb(
      { herbs: [{ id: 'h', name_en: 'H', name_zh: 'H', aliases: [], zh_reviewed: false }] },
      { drugs: [
        { id: 'd1', name_en: 'D1', name_zh: 'D1', classes: ['c'], aliases: [], zh_reviewed: false },
        { id: 'd2', name_en: 'D2', name_zh: 'D2', classes: ['c'], aliases: [], zh_reviewed: false },
        { id: 'd3', name_en: 'D3', name_zh: 'D3', classes: [], aliases: [], zh_reviewed: false },
        { id: 'd4', name_en: 'D4', name_zh: 'D4', classes: [], aliases: [], zh_reviewed: false },
        { id: 'd5', name_en: 'D5', name_zh: 'D5', classes: [], aliases: [], zh_reviewed: false }
      ] },
      { interactions: [
        { id: 'by-class', herb_id: 'h', drug_class: 'c', risk: 'moderate' },
        { id: 'by-drug', herb_id: 'h', drug_id: 'd1', risk: 'low' },
        { id: 'none', herb_id: 'h', drug_id: 'd3', risk: 'none_reported' },
        { id: 'top', herb_id: 'h', drug_id: 'd4', risk: 'high' }
      ] }
    );
    check('Lookup rules', 'an entry for the drug itself wins over an entry for its class',
      lookup.findInteraction(fake, 'h', 'd1').id === 'by-drug');
    check('Lookup rules', 'a drug with no entry of its own matches through its class',
      lookup.findInteraction(fake, 'h', 'd2').id === 'by-class');
    var order = lookup.checkPairs(fake, ['h'], ['d5', 'd3', 'd1', 'd2', 'd4']).map(function (r) { return r.status; });
    check('Lookup rules', '"No reported risk" sorts after Low and before Not in database',
      JSON.stringify(order) === JSON.stringify(['high', 'moderate', 'low', 'none_reported', 'not_in_database']),
      'got ' + order.join(', '));

    // 6. The validator catches common mistakes.
    var broken = lookup.createDb(
      { herbs: [{ id: 'h', name_en: 'H', name_zh: 'H', aliases: [], zh_reviewed: false }] },
      { drugs: [{ id: 'd', name_en: 'D', name_zh: 'D', classes: [], aliases: [], zh_reviewed: false }] },
      { interactions: [{
        id: 'bad', herb_id: 'typo', drug_id: 'd', drug_class: 'c', risk: 'safe', watch: false, rating_source: 'me',
        effect_en: '', effect_zh: 'x', why_en: 'x', why_zh: null, why_pro_en: null, action_en: 'x', action_zh: 'x',
        evidence_level: ['anecdote'], sources: [{ label: 'x', url: 'http://insecure' }], zh_reviewed: 'no'
      }] }
    );
    var found = lookup.validateData(broken).join('\n');
    ['unknown herb_id', 'exactly one of drug_id or drug_class', 'risk must be', 'rating_source', 'missing effect_en',
      'both be filled or both be null', 'unknown evidence level', 'must start with https', 'zh_reviewed']
      .forEach(function (msg) {
        check('Validator', 'catches: ' + msg, found.indexOf(msg) !== -1, found);
      });

    return results;
  }

  return { runAll: runAll };
});
