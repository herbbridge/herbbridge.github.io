/*
 * HerbSafe tests, shared by tests/run-tests.js (Node) and tests/test.html (browser).
 * runAll(lookup, data) returns [{ group, name, pass, detail }].
 *
 * Expected values here are written out by hand from the project brief, never read
 * back from js/lookup.js, so a bug in the code cannot make its own test pass.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.HerbSafeTests = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DISPLAY_ORDER = ['high', 'moderate', 'low', 'none_reported', 'not_in_database'];

  // The ratings given in the brief. Changing a rating must be a deliberate edit here too.
  var BRIEF_RATINGS = {
    'danshen-warfarin':          { risk: 'moderate', watch: false, rating_source: 'HA' },
    'dong_quai-warfarin':        { risk: 'high',     watch: false, rating_source: 'team' },
    'american_ginseng-warfarin': { risk: 'moderate', watch: false, rating_source: 'team' },
    'asian_ginseng-warfarin':    { risk: 'low',      watch: false, rating_source: 'team' },
    'ginkgo-warfarin':           { risk: 'low',      watch: true,  rating_source: 'team' },
    'ginkgo-aspirin':            { risk: 'low',      watch: true,  rating_source: 'team' },
    'liquorice-digoxin':         { risk: 'moderate', watch: false, rating_source: 'team' },
    'liquorice-diuretic':        { risk: 'moderate', watch: false, rating_source: 'team' },
    'red_yeast_rice-statin':     { risk: 'high',     watch: false, rating_source: 'team' }
  };

  var SEARCH_CASES = [
    { query: 'Danshen', kind: 'herbs', first: 'danshen' },
    { query: '丹參', kind: 'herbs', first: 'danshen' },
    { query: '丹参', kind: 'herbs', first: 'danshen' },
    { query: 'daan sam', kind: 'herbs', first: 'danshen' },
    { query: 'daansam', kind: 'herbs', first: 'danshen' },
    { query: 'Daan1 Sam1', kind: 'herbs', first: 'danshen' },
    { query: 'Dan1 Shen1', kind: 'herbs', first: 'danshen' },
    { query: 'dān shēn', kind: 'herbs', first: 'danshen' },
    { query: 'Salvia miltiorrhiza', kind: 'herbs', first: 'danshen' },
    { query: 'dang gui', kind: 'herbs', first: 'dong_quai' },
    { query: 'Dāng guī', kind: 'herbs', first: 'dong_quai' },
    { query: 'Dong-quai', kind: 'herbs', first: 'dong_quai' },
    { query: '花旗參', kind: 'herbs', first: 'american_ginseng' },
    { query: '高麗參', kind: 'herbs', first: 'asian_ginseng' },
    { query: 'Asi', kind: 'herbs', first: 'asian_ginseng' },
    { query: 'ginseng', kind: 'herbs', includes: ['american_ginseng', 'asian_ginseng'] },
    { query: 'licorice', kind: 'herbs', first: 'liquorice' },
    { query: '甘草', kind: 'herbs', first: 'liquorice' },
    { query: 'Glycyrrhiza glabra', kind: 'herbs', first: 'liquorice' },
    { query: 'hung kuk', kind: 'herbs', first: 'red_yeast_rice' },
    { query: 'red-yeast rice', kind: 'herbs', first: 'red_yeast_rice' },
    { query: 'tin chat', kind: 'herbs', first: 'sanqi' },
    { query: 'tin4 chat', kind: 'herbs', first: 'sanqi' },
    { query: '田七', kind: 'herbs', first: 'sanqi' },
    { query: 'gau gei', kind: 'herbs', first: 'goji' },
    { query: '紅花', kind: 'herbs', first: 'safflower' },
    { query: '', kind: 'herbs', count: 10 },
    { query: 'warf', kind: 'drugs', first: 'warfarin' },
    { query: '華法林', kind: 'drugs', first: 'warfarin' },
    { query: 'frusemide', kind: 'drugs', first: 'furosemide' },
    { query: 'Lipitor', kind: 'drugs', first: 'atorvastatin' },
    { query: 'statin', kind: 'drugs', includes: ['atorvastatin', 'simvastatin', 'rosuvastatin'] },
    { query: 'zzzz', kind: 'drugs', count: 0 }
  ];

  function ids(list) { return list.map(function (x) { return x.id; }); }
  function idOf(x) { return x ? x.id : null; }

  function herb(id) { return { id: id, name_en: id, name_zh: id, aliases: [], zh_reviewed: false }; }
  function drug(id, classes) { return { id: id, name_en: id, name_zh: id, classes: classes || [], aliases: [], zh_reviewed: false }; }
  function entry(over) {
    var e = {
      id: 'e', herb_id: 'h', drug_id: 'd', risk: 'low', watch: false, rating_source: 'team',
      effect_en: 'x', effect_zh: 'x', why_en: null, why_zh: null, why_pro_en: null,
      action_en: 'x', action_zh: 'x', evidence_level: ['review'],
      sources: [{ label: 'x', url: 'https://example.org' }], zh_reviewed: false
    };
    Object.keys(over).forEach(function (k) {
      if (over[k] === undefined) delete e[k]; else e[k] = over[k];
    });
    return e;
  }

  function runAll(lookup, data) {
    var results = [];
    // Each check runs inside try/catch so one crash shows as one failed test, not a broken run.
    function check(group, name, fn) {
      var pass, detail = '';
      try {
        var out = fn();
        pass = out === true || (out && out.pass === true);
        if (!pass) detail = (out && out.detail) || '';
      } catch (err) {
        pass = false;
        detail = 'crashed: ' + (err && err.message);
      }
      results.push({ group: group, name: name, pass: pass, detail: detail });
    }

    var db = lookup.createDb(data.herbs, data.drugs, data.interactions);

    // 1. The data files themselves.
    check('Data files', 'herbs.json, drugs.json and interactions.json are valid', function () {
      var problems = lookup.validateData(db);
      return { pass: problems.length === 0, detail: problems.join('\n') };
    });
    check('Data files', 'every rating, "watch" flag and rating source matches the brief', function () {
      var wrong = [];
      Object.keys(BRIEF_RATINGS).forEach(function (id) {
        var e = db.interactions.filter(function (x) { return x.id === id; })[0], want = BRIEF_RATINGS[id];
        if (!e) wrong.push(id + ': missing');
        else ['risk', 'watch', 'rating_source'].forEach(function (f) {
          if (e[f] !== want[f]) wrong.push(id + ': ' + f + ' is ' + JSON.stringify(e[f]) + ', brief says ' + JSON.stringify(want[f]));
        });
      });
      db.interactions.forEach(function (e) {
        if (!BRIEF_RATINGS[e.id]) wrong.push(e.id + ': new entry. Add it to BRIEF_RATINGS in tests/test-suite.js once its rating is agreed');
      });
      return { pass: wrong.length === 0, detail: wrong.join('\n') };
    });

    // 2. The 10 medicine lists in tests/test-cases.md.
    data.cases.cases.forEach(function (c) {
      check('Medicine lists', c.id + ': ' + c.name, function () {
        var got = lookup.checkPairs(db, c.herbs, c.drugs).map(function (r) {
          return { herb: r.herb.id, drug: r.drug.id, status: r.status, entry: idOf(r.entry) };
        });
        return {
          pass: JSON.stringify(got) === JSON.stringify(c.expected),
          detail: 'expected ' + JSON.stringify(c.expected) + '\ngot      ' + JSON.stringify(got)
        };
      });
    });

    // 3. Search by English, Chinese, Latin, pinyin, Cantonese romanisation and aliases.
    SEARCH_CASES.forEach(function (s) {
      var want = s.first ? 'first result ' + s.first
        : s.includes ? 'includes ' + s.includes.join(', ')
        : s.count + ' results';
      check('Search', '"' + s.query + '" → ' + want, function () {
        var found = ids(lookup.search(db[s.kind], s.query));
        var pass = s.first ? found[0] === s.first
          : s.includes ? s.includes.every(function (id) { return found.indexOf(id) !== -1; })
          : found.length === s.count;
        return { pass: pass, detail: 'got [' + found.join(', ') + ']' };
      });
    });

    // 4. Safety rules, checked against every possible pair in the real data.
    var hasEntry = {};
    db.interactions.forEach(function (e) { hasEntry[e.herb_id] = true; });
    check('Safety rules', 'every herb × drug pair without an entry shows "not_in_database", never a rating', function () {
      var bad = lookup.checkPairs(db, ids(db.herbs), ids(db.drugs)).filter(function (r) {
        return r.entry ? r.status !== r.entry.risk || r.entry.herb_id !== r.herb.id : r.status !== 'not_in_database';
      });
      return { pass: bad.length === 0, detail: bad.map(function (r) { return r.herb.id + ' × ' + r.drug.id + ' → ' + r.status; }).join('\n') };
    });
    check('Safety rules', 'goji, sanqi and safflower show "not_in_database" with every drug', function () {
      var rows = lookup.checkPairs(db, ['goji', 'sanqi', 'safflower'], ids(db.drugs));
      return rows.length === 3 * db.drugs.length && rows.every(function (r) { return r.status === 'not_in_database' && r.entry === null; });
    });
    check('Safety rules', 'results are sorted High → Moderate → Low → No reported risk → Not in database', function () {
      var all = lookup.checkPairs(db, ids(db.herbs), ids(db.drugs));
      var bad = all.filter(function (r, i) {
        return DISPLAY_ORDER.indexOf(r.status) === -1 || (i > 0 && DISPLAY_ORDER.indexOf(all[i - 1].status) > DISPLAY_ORDER.indexOf(r.status));
      });
      return { pass: all.length === db.herbs.length * db.drugs.length && bad.length === 0, detail: all.map(function (r) { return r.status; }).join(', ') };
    });

    check('Edge cases', 'no herbs or no medicines → no pairs', function () {
      return lookup.checkPairs(db, [], ['warfarin']).length === 0 && lookup.checkPairs(db, ['danshen'], []).length === 0;
    });
    check('Edge cases', 'unknown ids (e.g. from an old saved list) are skipped', function () {
      var r = lookup.checkPairs(db, ['danshen', 'no_such_herb'], ['warfarin', 'no_such_drug']);
      return r.length === 1 && r[0].status === 'moderate';
    });
    check('Edge cases', 'the same item chosen twice is counted once', function () {
      return lookup.checkPairs(db, ['danshen', 'danshen'], ['warfarin', 'warfarin']).length === 1;
    });

    // 5. Lookup rules, on small made-up data (not the real database).
    function fakeDb(drugs, interactions) {
      return lookup.createDb({ herbs: [herb('h')] }, { drugs: drugs }, { interactions: interactions });
    }
    var bothOrders = [
      [entry({ id: 'by-class', drug_id: undefined, drug_class: 'c', risk: 'moderate' }), entry({ id: 'by-drug', drug_id: 'd1', risk: 'low' })],
      [entry({ id: 'by-drug', drug_id: 'd1', risk: 'low' }), entry({ id: 'by-class', drug_id: undefined, drug_class: 'c', risk: 'moderate' })]
    ];
    bothOrders.forEach(function (list, n) {
      check('Lookup rules', 'an entry for the drug itself wins over an entry for its class (file order ' + (n + 1) + ')', function () {
        var f = fakeDb([drug('d1', ['c']), drug('d2', ['c'])], list);
        return idOf(lookup.findInteraction(f, 'h', 'd1')) === 'by-drug' && idOf(lookup.findInteraction(f, 'h', 'd2')) === 'by-class';
      });
    });
    check('Lookup rules', 'a drug with several classes matches an entry for any of them', function () {
      var f = fakeDb([drug('d', ['other', 'c'])], [entry({ id: 'by-class', drug_id: undefined, drug_class: 'c', risk: 'high' })]);
      return idOf(lookup.findInteraction(f, 'h', 'd')) === 'by-class';
    });
    check('Lookup rules', 'an entry for one drug does not match a different drug', function () {
      var f = fakeDb([drug('d1'), drug('d2')], [entry({ id: 'only-d1', drug_id: 'd1' })]);
      return lookup.findInteraction(f, 'h', 'd2') === null;
    });
    check('Lookup rules', '"No reported risk" sorts after Low and before Not in database', function () {
      var f = fakeDb([drug('d1'), drug('d2'), drug('d3'), drug('d4'), drug('d5')], [
        entry({ id: 'a', drug_id: 'd3', risk: 'none_reported' }),
        entry({ id: 'b', drug_id: 'd1', risk: 'low' }),
        entry({ id: 'c', drug_id: 'd2', risk: 'moderate' }),
        entry({ id: 'd', drug_id: 'd4', risk: 'high' })
      ]);
      var order = lookup.checkPairs(f, ['h'], ['d5', 'd3', 'd1', 'd2', 'd4']).map(function (r) { return r.status; });
      return { pass: JSON.stringify(order) === JSON.stringify(DISPLAY_ORDER), detail: 'got ' + order.join(', ') };
    });

    // 6. The validator catches the mistakes a teammate is likely to make when adding pairs.
    var MISTAKES = [
      { name: 'herb_id typo', drugs: [drug('d')], entries: [entry({ herb_id: 'hh' })], expect: 'unknown herb_id' },
      { name: 'drug_id typo', drugs: [drug('d')], entries: [entry({ drug_id: 'dd' })], expect: 'unknown drug_id' },
      { name: 'drug_class nobody has', drugs: [drug('d', ['c'])], entries: [entry({ drug_id: undefined, drug_class: 'cc' })], expect: 'no drug has class' },
      { name: 'both drug_id and drug_class', drugs: [drug('d', ['c'])], entries: [entry({ drug_class: 'c' })], expect: 'exactly one of drug_id or drug_class' },
      { name: 'neither drug_id nor drug_class', drugs: [drug('d')], entries: [entry({ drug_id: undefined })], expect: 'exactly one of drug_id or drug_class' },
      { name: 'drug_class written as a list', drugs: [drug('d', ['c'])], entries: [entry({ drug_id: undefined, drug_class: ['c'] })], expect: 'must be plain text' },
      { name: 'drug_id written as a list', drugs: [drug('d')], entries: [entry({ drug_id: ['d'] })], expect: 'must be plain text' },
      { name: 'risk "Moderate" with a capital', drugs: [drug('d')], entries: [entry({ risk: 'Moderate' })], expect: 'risk must be' },
      { name: 'rating_source not HA or team', drugs: [drug('d')], entries: [entry({ rating_source: 'me' })], expect: 'rating_source' },
      { name: 'empty effect_en', drugs: [drug('d')], entries: [entry({ effect_en: '' })], expect: 'missing effect_en' },
      { name: 'why_en filled but why_zh null', drugs: [drug('d')], entries: [entry({ why_en: 'x' })], expect: 'both be filled or both be null' },
      { name: 'unknown evidence level', drugs: [drug('d')], entries: [entry({ evidence_level: ['anecdote'] })], expect: 'unknown evidence level' },
      { name: 'no sources', drugs: [drug('d')], entries: [entry({ sources: [] })], expect: 'at least one source' },
      { name: 'http (not https) source', drugs: [drug('d')], entries: [entry({ sources: [{ label: 'x', url: 'http://example.org' }] })], expect: 'must start with https' },
      { name: 'zh_reviewed not true/false', drugs: [drug('d')], entries: [entry({ zh_reviewed: 'no' })], expect: 'zh_reviewed' },
      { name: 'same pair entered twice', drugs: [drug('d')], entries: [entry({ id: 'a' }), entry({ id: 'b', risk: 'high' })], expect: 'same pair as' },
      { name: 'duplicate id', drugs: [drug('d'), drug('d2')], entries: [entry({ id: 'a' }), entry({ id: 'a', drug_id: 'd2' })], expect: 'duplicate id' },
      { name: 'drug matching two class entries', drugs: [drug('d', ['c1', 'c2'])],
        entries: [entry({ id: 'a', drug_id: undefined, drug_class: 'c1' }), entry({ id: 'b', drug_id: undefined, drug_class: 'c2', risk: 'high' })], expect: 'matches several class entries' },
      { name: 'drug class with a capital ("Statin")', drugs: [drug('d', ['Statin'])], entries: [], expect: 'must be lower-case' },
      { name: 'drug classes written as text, not a list', drugs: [{ id: 'd', name_en: 'd', name_zh: 'd', classes: 'statin', aliases: [], zh_reviewed: false }], entries: [], expect: 'classes must be a list' }
    ];
    MISTAKES.forEach(function (m) {
      check('Validator', 'catches: ' + m.name, function () {
        var problems = lookup.validateData(fakeDb(m.drugs, m.entries)).join('\n');
        return { pass: problems.indexOf(m.expect) !== -1, detail: 'expected a problem containing "' + m.expect + '", got:\n' + (problems || '(none)') };
      });
    });
    check('Validator', 'a correct made-up entry passes', function () {
      var problems = lookup.validateData(fakeDb([drug('d')], [entry({})]));
      return { pass: problems.length === 0, detail: problems.join('\n') };
    });

    return results;
  }

  return { runAll: runAll };
});
