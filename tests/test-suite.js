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

  var DISPLAY_ORDER = ['high', 'official', 'moderate', 'low', 'none_reported', 'not_in_database'];

  // Official cautions approved by the owner on 18 Oct 2026, written out by hand.
  var OFFICIAL_CAUTIONS = {
    'ginkgo|warfarin':           { kind: 'disagree', statements: ['hc-ginkgo-contraindication', 'ema-ginkgo-4.5-warfarin-studies', 'ema-ginkgo-4.5', 'ema-ginkgo-4.5-traditional'] },
    // Hospital Authority warfarin leaflet (019Ev10 / 019Cv10, Oct 2025), verified 19 Oct 2026.
    'danshen|warfarin':          { kind: 'official', statements: ['ha-warfarin-leaflet-tcm'] },
    'dong_quai|warfarin':        { kind: 'official', statements: ['ha-warfarin-leaflet-tcm'] },
    'asian_ginseng|warfarin':    { kind: 'disagree', statements: ['ha-warfarin-leaflet-tcm'] },
    'ginkgo|aspirin':            { kind: 'disagree', statements: ['hc-ginkgo-contraindication', 'ema-ginkgo-4.5'] },
    'ginkgo|clopidogrel':        { kind: 'official', statements: ['ema-ginkgo-4.5', 'hc-ginkgo-contraindication'] },
    'ginkgo|amlodipine':         { kind: 'official', statements: ['hc-ginkgo-blood-pressure'] },
    'american_ginseng|digoxin':  { kind: 'official', statements: ['hc-american-ginseng'] },
    'asian_ginseng|digoxin':     { kind: 'official', statements: ['hc-panax-ginseng'] },
    'liquorice|amlodipine':      { kind: 'official', statements: ['ema-liquorice-blood-pressure'] },
    'liquorice|furosemide':      { kind: 'official', statements: ['ema-liquorice-electrolytes'] },
    'liquorice|digoxin':         { kind: 'official', statements: ['ema-liquorice-electrolytes'] }
  };
  // The regulators' own words, copied from the documents on 18 Oct 2026. Never paraphrase:
  // changing a quote must be a deliberate edit here too, after re-checking the document.
  var VERIFIED_QUOTES = {
    'ema-ginkgo-4.5': 'If the medicinal product is taken concomitantly with anticoagulants (e.g. phenprocoumon and warfarin) or antiplatelet drugs (e.g. clopidogrel, acetylsalicylic acid and other non-steroidal anti-inflammatory drugs), their effect may be influenced.',
    'ema-ginkgo-4.5-warfarin-studies': 'Available studies with warfarin do not indicate that there is an interaction between warfarin and G. biloba products, but adequate monitoring is advised when starting, when changing G. biloba dose, when ending G. biloba intake or if changing product.',
    'ha-warfarin-leaflet-tcm': 'Do not take any Traditional Chinese Medicines (TCM), Proprietary Chinese Medicines, herbal drinks, or food that contains TCM, such as Guilinggao. Many TCM such as ginseng, Dong quai, Danshen, Chishao can interact with warfarin.',
    'ema-ginkgo-4.5-traditional': 'Ginkgo leaf may increase the effects of anticoagulants such as coumarin derivatives.',
    'hc-ginkgo-contraindication': 'Do not use if you are taking blood thinners or other health products that affect blood coagulation (Gardner and McGuffin 2013; Brinker 2010; Bent 2005).',
    'hc-ginkgo-blood-pressure': 'Ask a health care practitioner/health care provider/health care professional/doctor/physician before use if you are taking diabetes, high blood pressure or seizure medications (Brinker 2010).',
    'hc-american-ginseng': 'Ask a health care practitioner/health care provider/health care professional/doctor/physician before use if you are taking blood thinners or digoxin (Brinker 2010; Dasgupta et al. 2007; Elmer et al. 2007; Yuan et al. 2004).',
    'hc-panax-ginseng': 'Ask a health care practitioner/health care provider/health care professional/doctor/physician before use if you are taking antidepressant medication, blood thinners or digoxin (Brinker 2010; Lee et al. 2008a; Dasgupta and Reyes 2005; Janetzki and Morreale 1997; Gonzalez-Seijo et al. 1995; Shader and Greenblatt 1988; Jones and Runikis 1987; Shader and Greenblatt 1985).',
    'ema-liquorice-blood-pressure': 'Liquorice root may counteract antihypertensive action of prescribed medications.',
    'ema-liquorice-electrolytes': 'Not to be used concomitantly with diuretics, cardiac glycosides, corticosteroids, stimulant laxatives or other medications which may aggravate electrolyte imbalance (see section with 4.4).'
  };
  // Where the agency publishes its own Chinese version, that text is locked too.
  var VERIFIED_QUOTES_ZH = {
    'ha-warfarin-leaflet-tcm': '不可隨便服用中藥材，中成藥，藥材湯或涼茶，或含中藥成份的食品如龜苓膏，因為很多中藥 ( 如人參、當歸、丹參、赤芍 )，會與「華法林」產生相互作用，影響抗凝血藥的功效。'
  };

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
    'red_yeast_rice-statin':     { risk: 'high',     watch: false, rating_source: 'team' },
    // Approved by the owner on 18 Oct 2026 (proposals/approved-pairs.json).
    // watch is true on goji and safflower + warfarin as checked; the app shows it only for Low.
    'goji-warfarin':             { risk: 'high',     watch: true,  rating_source: 'team' },
    'safflower-warfarin':        { risk: 'moderate', watch: true,  rating_source: 'team' },
    'safflower-aspirin':         { risk: 'low',      watch: false, rating_source: 'team' },
    'safflower-clopidogrel':     { risk: 'low',      watch: false, rating_source: 'team' },
    'sanqi-warfarin':            { risk: 'low',      watch: true,  rating_source: 'team' },
    'sanqi-aspirin':             { risk: 'moderate', watch: false, rating_source: 'team' },
    'sanqi-clopidogrel':         { risk: 'low',      watch: true,  rating_source: 'team' },
    'danshen-aspirin':           { risk: 'low',      watch: true,  rating_source: 'team' },
    'danshen-clopidogrel':       { risk: 'low',      watch: true,  rating_source: 'team' },
    'danshen-digoxin':           { risk: 'low',      watch: false, rating_source: 'team' },
    'danshen-rosuvastatin':      { risk: 'low',      watch: false, rating_source: 'team' },
    'danshen-atorvastatin':      { risk: 'low',      watch: false, rating_source: 'team' },
    'danshen-amlodipine':        { risk: 'low',      watch: false, rating_source: 'team' },
    'dong_quai-aspirin':         { risk: 'low',      watch: false, rating_source: 'team' },
    'dong_quai-clopidogrel':     { risk: 'low',      watch: false, rating_source: 'team' }
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
      action_en: 'x', action_zh: 'x', evidence_level: ['review'], main_source: 0, main_finding_en: 'x', main_finding_zh: 'x',
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

    var db = lookup.createDb(data.herbs, data.drugs, data.interactions, data.official);

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
          var row = { herb: r.herb.id, drug: r.drug.id, status: r.status, entry: idOf(r.entry) };
          if (r.official) row.official = r.official.id;
          return row;
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
    check('Safety rules', 'every pair shows its team rating, an official caution, or "not_in_database", never anything else', function () {
      var bad = lookup.checkPairs(db, ids(db.herbs), ids(db.drugs)).filter(function (r) {
        if (r.entry && r.entry.herb_id !== r.herb.id) return true;
        if (r.official) return r.status !== (r.entry && r.entry.risk === 'high' ? 'high' : 'official');
        return r.entry ? r.status !== r.entry.risk : r.status !== 'not_in_database';
      });
      return { pass: bad.length === 0, detail: bad.map(function (r) { return r.herb.id + ' × ' + r.drug.id + ' → ' + r.status; }).join('\n') };
    });
    // Pairs with no record yet, written out by hand. Remove a pair here only when its entry is approved.
    var STILL_UNRECORDED = {
      goji:      ['aspirin', 'clopidogrel', 'atorvastatin', 'simvastatin', 'rosuvastatin', 'digoxin', 'amlodipine', 'furosemide'],
      sanqi:     ['atorvastatin', 'simvastatin', 'rosuvastatin', 'digoxin', 'amlodipine', 'furosemide'],
      safflower: ['atorvastatin', 'simvastatin', 'rosuvastatin', 'digoxin', 'amlodipine', 'furosemide']
    };
    check('Safety rules', 'goji, sanqi and safflower show "not_in_database" with the medicines that still have no record', function () {
      var bad = [];
      Object.keys(STILL_UNRECORDED).forEach(function (h) {
        var rows = lookup.checkPairs(db, [h], STILL_UNRECORDED[h]);
        if (rows.length !== STILL_UNRECORDED[h].length) bad.push(h + ': expected ' + STILL_UNRECORDED[h].length + ' rows, got ' + rows.length);
        rows.forEach(function (r) { if (r.status !== 'not_in_database' || r.entry !== null) bad.push(h + ' × ' + r.drug.id + ' → ' + r.status); });
      });
      return { pass: bad.length === 0, detail: bad.join('\n') };
    });
    check('Safety rules', 'exactly the approved pairs show an official caution, with the approved statements', function () {
      var bad = [];
      lookup.checkPairs(db, ids(db.herbs), ids(db.drugs)).forEach(function (r) {
        var key = r.herb.id + '|' + r.drug.id, want = OFFICIAL_CAUTIONS[key];
        if (!want && r.official) bad.push(key + ': has an official caution that is not on the approved list');
        if (want && !r.official) bad.push(key + ': approved official caution is missing');
        if (want && r.official && (r.official.kind !== want.kind || JSON.stringify(r.official.statements) !== JSON.stringify(want.statements)))
          bad.push(key + ': kind or statements differ from the approved list');
      });
      return { pass: bad.length === 0, detail: bad.join('\n') };
    });
    check('Safety rules', 'every official quote is word for word what was verified in the document', function () {
      var bad = [];
      db.statements.forEach(function (s) { if (VERIFIED_QUOTES[s.id] !== s.quote_en) bad.push(s.id + ': quote differs from the verified text (or is not on the verified list)'); });
      Object.keys(VERIFIED_QUOTES).forEach(function (id) { if (!db.statementById[id]) bad.push(id + ': verified statement missing from data/official.json'); });
      db.statements.forEach(function (s) {
        if (s.quote_zh_is_original && VERIFIED_QUOTES_ZH[s.id] !== s.quote_zh) bad.push(s.id + ': official Chinese text differs from the verified text');
        if (!s.quote_zh_is_original && VERIFIED_QUOTES_ZH[s.id]) bad.push(s.id + ': has a verified official Chinese text but is not marked quote_zh_is_original');
      });
      return { pass: bad.length === 0, detail: bad.join('\n') };
    });
    check('Safety rules', 'an official caution never hides a High team rating', function () {
      var bad = lookup.checkPairs(db, ids(db.herbs), ids(db.drugs)).filter(function (r) { return r.entry && r.entry.risk === 'high' && r.status !== 'high'; });
      return { pass: bad.length === 0, detail: bad.map(function (r) { return r.herb.id + ' × ' + r.drug.id; }).join('\n') };
    });
    check('Safety rules', 'results are sorted High → Official caution → Moderate → Low → No reported risk → Not in database', function () {
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
      return r.length === 1 && r[0].entry && r[0].entry.id === 'danshen-warfarin';
    });
    check('Edge cases', 'ids like "constructor" or "__proto__" never match anything', function () {
      return lookup.checkPairs(db, ['constructor', '__proto__', 'toString'], ['warfarin', 'hasOwnProperty']).length === 0;
    });
    check('Edge cases', 'the same item chosen twice is counted once', function () {
      return lookup.checkPairs(db, ['danshen', 'danshen'], ['warfarin', 'warfarin']).length === 1;
    });

    // 5. Lookup rules, on small made-up data (not the real database).
    function fakeDb(drugs, interactions, official) {
      return lookup.createDb({ herbs: [herb('h')] }, { drugs: drugs }, { interactions: interactions }, official);
    }
    function statement(over) {
      var s = { id: 's', body_en: 'x', body_zh: 'x', document_en: 'x', document_zh: 'x', date_en: 'x', date_zh: 'x',
        section_en: 'x', section_zh: 'x', url: 'https://example.org', quote_en: 'x', quote_zh: 'x', verified: '2026-10-18' };
      Object.keys(over).forEach(function (k) { if (over[k] === undefined) delete s[k]; else s[k] = over[k]; });
      return s;
    }
    function caution(over) {
      var c = { id: 'c', herb_id: 'h', drug_id: 'd', kind: 'official', statements: ['s'], zh_reviewed: false };
      Object.keys(over).forEach(function (k) { if (over[k] === undefined) delete c[k]; else c[k] = over[k]; });
      return c;
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
      var want = DISPLAY_ORDER.filter(function (s) { return s !== 'official'; });
      return { pass: JSON.stringify(order) === JSON.stringify(want), detail: 'got ' + order.join(', ') };
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
      { name: 'main_source pointing past the list', drugs: [drug('d')], entries: [entry({ main_source: 3 })], expect: 'main_source must be' },
      { name: 'missing main finding', drugs: [drug('d')], entries: [entry({ main_finding_zh: '' })], expect: 'missing main_finding_zh' },
      { name: 'http (not https) source', drugs: [drug('d')], entries: [entry({ sources: [{ label: 'x', url: 'http://example.org' }] })], expect: 'must start with https' },
      { name: 'zh_reviewed not true/false', drugs: [drug('d')], entries: [entry({ zh_reviewed: 'no' })], expect: 'zh_reviewed' },
      { name: 'same pair entered twice', drugs: [drug('d')], entries: [entry({ id: 'a' }), entry({ id: 'b', risk: 'high' })], expect: 'same pair as' },
      { name: 'duplicate id', drugs: [drug('d'), drug('d2')], entries: [entry({ id: 'a' }), entry({ id: 'a', drug_id: 'd2' })], expect: 'duplicate id' },
      { name: 'drug matching two class entries', drugs: [drug('d', ['c1', 'c2'])],
        entries: [entry({ id: 'a', drug_id: undefined, drug_class: 'c1' }), entry({ id: 'b', drug_id: undefined, drug_class: 'c2', risk: 'high' })], expect: 'matches several class entries' },
      { name: 'drug class with a capital ("Statin")', drugs: [drug('d', ['Statin'])], entries: [], expect: 'must be lower-case' },
      { name: 'drug classes written as text, not a list', drugs: [{ id: 'd', name_en: 'd', name_zh: 'd', classes: 'statin', aliases: [], zh_reviewed: false }], entries: [], expect: 'classes must be a list' }
    ];
    var OFFICIAL_MISTAKES = [
      { name: 'official caution pointing at a missing statement', official: { statements: [statement({})], cautions: [caution({ statements: ['nope'] })] }, expect: 'unknown statement' },
      { name: 'official statement without its quote', official: { statements: [statement({ quote_en: '' })], cautions: [caution({})] }, expect: 'missing quote_en' },
      { name: 'official statement with an http link', official: { statements: [statement({ url: 'http://example.org' })], cautions: [caution({})] }, expect: 'url must start with https' },
      { name: 'official caution with an unknown kind', official: { statements: [statement({})], cautions: [caution({ kind: 'maybe' })] }, expect: 'kind must be' },
      { name: '"sources disagree" with no team rating to disagree with', official: { statements: [statement({})], cautions: [caution({ kind: 'disagree' })] }, expect: 'needs a team rating' },
      { name: 'same official pair twice', official: { statements: [statement({})], cautions: [caution({ id: 'a' }), caution({ id: 'b' })] }, expect: 'same pair as' }
    ];
    OFFICIAL_MISTAKES.forEach(function (m) {
      check('Validator', 'catches: ' + m.name, function () {
        var problems = lookup.validateData(fakeDb([drug('d')], [], m.official)).join('\n');
        return { pass: problems.indexOf(m.expect) !== -1, detail: 'expected a problem containing "' + m.expect + '", got:\n' + (problems || '(none)') };
      });
    });
    check('Lookup rules', 'an official caution shows instead of a Moderate rating, but never instead of High', function () {
      var off = { statements: [statement({})], cautions: [caution({ drug_id: 'd1' }), caution({ id: 'c2', drug_id: 'd2' })] };
      var f = fakeDb([drug('d1'), drug('d2')], [entry({ id: 'm', drug_id: 'd1', risk: 'moderate' }), entry({ id: 'h', drug_id: 'd2', risk: 'high' })], off);
      var r = lookup.checkPairs(f, ['h'], ['d1', 'd2']);
      return r[0].status === 'high' && r[0].official && r[1].status === 'official' && r[1].entry.id === 'm';
    });

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

    // 7. Every interface text exists in both languages (only when the i18n module is passed in).
    if (data.i18n) {
      var S = data.i18n.strings;
      var base = function (k) { return k.replace(/_(one|other)$/, ''); };
      check('Languages', 'every English interface text has a Chinese version', function () {
        var missing = Object.keys(S.en).map(base).filter(function (k) { return !(k in S.zh); });
        return { pass: missing.length === 0, detail: 'missing in zh: ' + missing.join(', ') };
      });
      check('Languages', 'no Chinese text without an English version', function () {
        var en = Object.keys(S.en).map(base);
        var extra = Object.keys(S.zh).filter(function (k) { return en.indexOf(k) === -1; });
        return { pass: extra.length === 0, detail: 'only in zh: ' + extra.join(', ') };
      });
      check('Languages', 'every herb, drug and rated pair has Chinese text', function () {
        var bad = [];
        db.herbs.concat(db.drugs).forEach(function (x) { if (!x.name_zh) bad.push(x.id); });
        db.interactions.forEach(function (e) {
          ['effect_zh', 'action_zh'].forEach(function (f) { if (!e[f]) bad.push(e.id + '.' + f); });
          if (e.why_en && !e.why_zh) bad.push(e.id + '.why_zh');
        });
        return { pass: bad.length === 0, detail: bad.join(', ') };
      });
      check('Languages', 'Chinese never says 同時服用 (reads as timing advice) or 中風險 (reads as "stroke risk")', function () {
        var texts = Object.keys(S.zh).map(function (k) { return S.zh[k]; });
        db.interactions.forEach(function (e) { ['effect_zh', 'why_zh', 'action_zh'].forEach(function (f) { if (e[f]) texts.push(e[f]); }); });
        var bad = texts.filter(function (x) { return /同時服用|中風險/.test(x); });
        return { pass: bad.length === 0, detail: bad.join('\n') };
      });
      check('Languages', 'the required disclaimer and "not in database" wording are exact in English', function () {
        return S.en.card_disclaimer === 'HerbSafe gives information, not medical advice. Never stop or change a medicine without talking to your doctor or pharmacist.' &&
          S.en.not_in_db_text === 'We have no record of this combination. This does not mean it is safe. Please ask your pharmacist or doctor.';
      });
    }

    // 8. Heart-disease focus (Challenge 4: cardiovascular disease). None of this may change a rating.
    var REQUIRED_GROUPS = ['blood_thinners', 'cholesterol', 'heart_rhythm', 'blood_pressure'];
    var groups = (data.drugs && data.drugs.groups) || [];
    check('Heart focus', 'every rated pair has "Why this matters for your heart" in English and Chinese', function () {
      var bad = db.interactions.filter(function (e) {
        return typeof e.heart_impact_en !== 'string' || !e.heart_impact_en.trim() ||
               typeof e.heart_impact_zh !== 'string' || !e.heart_impact_zh.trim();
      }).map(function (e) { return e.id; });
      return { pass: bad.length === 0, detail: 'missing heart_impact in: ' + bad.join(', ') };
    });
    check('Heart focus', 'medicine groups are in the agreed order, each named in English and Chinese', function () {
      var ids = groups.map(function (g) { return g.id; });
      var named = groups.every(function (g) { return g.name_en && g.name_zh && typeof g.zh_reviewed === 'boolean'; });
      return { pass: JSON.stringify(ids) === JSON.stringify(REQUIRED_GROUPS) && named, detail: 'groups: ' + ids.join(', ') };
    });
    check('Heart focus', 'every medicine belongs to one of the groups', function () {
      var bad = db.drugs.filter(function (d) { return REQUIRED_GROUPS.indexOf(d.group) === -1; }).map(function (d) { return d.id + ' (' + d.group + ')'; });
      return { pass: bad.length === 0, detail: bad.join(', ') };
    });
    check('Heart focus', 'every herb has "commonly taken for" in English and Chinese', function () {
      var bad = db.herbs.filter(function (h) { return !h.used_for_en || !h.used_for_zh; }).map(function (h) { return h.id; });
      return { pass: bad.length === 0, detail: bad.join(', ') };
    });
    check('Heart focus', 'new Chinese text avoids 同時服用 and 中風險', function () {
      var texts = [];
      db.interactions.forEach(function (e) { if (e.heart_impact_zh) texts.push(e.heart_impact_zh); });
      db.herbs.forEach(function (h) { if (h.used_for_zh) texts.push(h.used_for_zh); });
      groups.forEach(function (g) { texts.push(g.name_zh); });
      var bad = texts.filter(function (x) { return /同時服用|中風險/.test(x); });
      return { pass: bad.length === 0, detail: bad.join('\n') };
    });
    check('Data files', 'monacolin K is described with the NIH wording ("structurally identical"), never "chemically identical"', function () {
      var bad = db.interactions.filter(function (e) { return /chemically (identical|the same)/i.test(JSON.stringify(e)); }).map(function (e) { return e.id; });
      return { pass: bad.length === 0, detail: bad.join(', ') };
    });

    return results;
  }

  return { runAll: runAll };
});
