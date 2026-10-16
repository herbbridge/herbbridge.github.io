/*
 * HerbSafe lookup logic. Pure functions, no DOM, no network.
 * Used by the app (window.HerbSafeLookup) and by the tests (require in Node).
 *
 * The app only LOOKS THINGS UP in the curated JSON. A herb × drug pair with no
 * entry is reported as "not_in_database", which must never be read as safe.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.HerbSafeLookup = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var RISKS = ['high', 'moderate', 'low', 'none_reported'];
  var NOT_IN_DATABASE = 'not_in_database';
  // Results are sorted in this order: High → Moderate → Low → No reported risk → Not in database.
  var STATUS_ORDER = RISKS.concat([NOT_IN_DATABASE]);
  var EVIDENCE_LEVELS = ['case_reports', 'human_trial', 'review', 'lab_animal', 'official_guidance'];
  var RATING_SOURCES = ['HA', 'team'];

  /* Lower-case, strip accents, spaces, punctuation and Jyutping tone numbers,
     so "Daan1 Sam1", "daan sam" and "daansam" all match. */
  function normalise(text) {
    return String(text == null ? '' : text)
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[\s\-_'’.,()\/·]+/g, '')
      .replace(/[0-9]/g, '');
  }

  function searchTerms(item) {
    return [item.name_en, item.name_zh, item.latin].concat(item.aliases || [])
      .filter(Boolean)
      .map(normalise)
      .filter(Boolean);
  }

  function createDb(herbsJson, drugsJson, interactionsJson) {
    var db = {
      herbs: herbsJson.herbs,
      drugs: drugsJson.drugs,
      interactions: interactionsJson.interactions,
      lastUpdated: interactionsJson.last_updated || null,
      herbById: {},
      drugById: {}
    };
    db.herbs.forEach(function (h) { db.herbById[h.id] = h; });
    db.drugs.forEach(function (d) { db.drugById[d.id] = d; });
    return db;
  }

  /* Search herbs or drugs by English name, Chinese name, Latin name,
     pinyin / Cantonese romanisation, or any alias. An empty query returns all items. */
  function search(items, query) {
    var q = normalise(query);
    if (!q) return items.slice();
    var scored = [];
    items.forEach(function (item, index) {
      var best = -1;
      searchTerms(item).forEach(function (term) {
        if (term === q) best = Math.max(best, 3);
        else if (term.indexOf(q) === 0) best = Math.max(best, 2);
        else if (term.indexOf(q) > 0) best = Math.max(best, 1);
      });
      if (best >= 0) scored.push({ item: item, score: best, index: index });
    });
    scored.sort(function (a, b) { return b.score - a.score || a.index - b.index; });
    return scored.map(function (s) { return s.item; });
  }

  /* The entry for one herb × drug pair, or null if we have no record.
     An entry naming the drug itself wins over one naming the drug's class. */
  function findInteraction(db, herbId, drugId) {
    var drug = db.drugById[drugId];
    if (!drug || !db.herbById[herbId]) return null;
    var exact = null, byClass = null;
    db.interactions.forEach(function (e) {
      if (e.herb_id !== herbId) return;
      if (e.drug_id === drugId && !exact) exact = e;
      else if (e.drug_class && (drug.classes || []).indexOf(e.drug_class) !== -1 && !byClass) byClass = e;
    });
    return exact || byClass;
  }

  function unique(ids) {
    var seen = {};
    return (ids || []).filter(function (id) {
      if (seen[id]) return false;
      seen[id] = true;
      return true;
    });
  }

  /* Every herb × drug pair the user selected, sorted by risk.
     Unknown ids (e.g. from an old saved list) are skipped. */
  function checkPairs(db, herbIds, drugIds) {
    var herbs = unique(herbIds).filter(function (id) { return db.herbById[id]; });
    var drugs = unique(drugIds).filter(function (id) { return db.drugById[id]; });
    var results = [];
    herbs.forEach(function (herbId, hi) {
      drugs.forEach(function (drugId, di) {
        var entry = findInteraction(db, herbId, drugId);
        results.push({
          herb: db.herbById[herbId],
          drug: db.drugById[drugId],
          entry: entry,
          status: entry ? entry.risk : NOT_IN_DATABASE,
          _order: hi * 1000 + di
        });
      });
    });
    results.sort(function (a, b) {
      return STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || a._order - b._order;
    });
    results.forEach(function (r) { delete r._order; });
    return results;
  }

  /* Checks the data files for mistakes a teammate could make when adding pairs.
     Returns a list of problems; an empty list means the data is valid. */
  function validateData(db) {
    var problems = [];
    function problem(msg) { problems.push(msg); }
    function isText(v) { return typeof v === 'string' && v.trim() !== ''; }

    [['herb', db.herbs], ['drug', db.drugs]].forEach(function (pair) {
      var kind = pair[0], seen = {};
      pair[1].forEach(function (item, i) {
        var where = kind + ' #' + (i + 1) + ' (' + (item.id || 'no id') + ')';
        if (!isText(item.id)) problem(where + ': missing id');
        if (seen[item.id]) problem(where + ': duplicate id');
        seen[item.id] = true;
        if (!isText(item.name_en)) problem(where + ': missing name_en');
        if (!isText(item.name_zh)) problem(where + ': missing name_zh');
        if (!Array.isArray(item.aliases)) problem(where + ': aliases must be a list');
        if (typeof item.zh_reviewed !== 'boolean') problem(where + ': zh_reviewed must be true or false');
        if (kind === 'drug' && !Array.isArray(item.classes)) problem(where + ': classes must be a list');
      });
    });

    var classes = {};
    db.drugs.forEach(function (d) { (d.classes || []).forEach(function (c) { classes[c] = true; }); });

    var ids = {}, pairKeys = {};
    db.interactions.forEach(function (e, i) {
      var where = 'interaction #' + (i + 1) + ' (' + (e.id || 'no id') + ')';
      if (!isText(e.id)) problem(where + ': missing id');
      if (ids[e.id]) problem(where + ': duplicate id');
      ids[e.id] = true;
      if (!db.herbById[e.herb_id]) problem(where + ': unknown herb_id "' + e.herb_id + '"');
      if (!!e.drug_id === !!e.drug_class) problem(where + ': needs exactly one of drug_id or drug_class');
      if (e.drug_id && !db.drugById[e.drug_id]) problem(where + ': unknown drug_id "' + e.drug_id + '"');
      if (e.drug_class && !classes[e.drug_class]) problem(where + ': no drug has class "' + e.drug_class + '"');
      var key = e.herb_id + '|' + (e.drug_id ? 'drug:' + e.drug_id : 'class:' + e.drug_class);
      if (pairKeys[key]) problem(where + ': same pair as ' + pairKeys[key]);
      pairKeys[key] = e.id;
      if (RISKS.indexOf(e.risk) === -1) problem(where + ': risk must be one of ' + RISKS.join(', '));
      if (typeof e.watch !== 'boolean') problem(where + ': watch must be true or false');
      if (RATING_SOURCES.indexOf(e.rating_source) === -1) problem(where + ': rating_source must be HA or team');
      ['effect_en', 'effect_zh', 'action_en', 'action_zh'].forEach(function (f) {
        if (!isText(e[f])) problem(where + ': missing ' + f);
      });
      ['why_en', 'why_zh', 'why_pro_en'].forEach(function (f) {
        if (e[f] !== null && !isText(e[f])) problem(where + ': ' + f + ' must be text or null');
      });
      if ((e.why_en === null) !== (e.why_zh === null)) problem(where + ': why_en and why_zh must both be filled or both be null');
      if (!Array.isArray(e.evidence_level) || !e.evidence_level.length) problem(where + ': evidence_level must be a non-empty list');
      else e.evidence_level.forEach(function (lvl) {
        if (EVIDENCE_LEVELS.indexOf(lvl) === -1) problem(where + ': unknown evidence level "' + lvl + '"');
      });
      if (!Array.isArray(e.sources) || !e.sources.length) problem(where + ': needs at least one source');
      else e.sources.forEach(function (s, si) {
        if (!isText(s.label)) problem(where + ': source ' + (si + 1) + ' has no label');
        if (!/^https:\/\/[^\s]+$/.test(s.url || '')) problem(where + ': source ' + (si + 1) + ' url must start with https://');
      });
      if (typeof e.zh_reviewed !== 'boolean') problem(where + ': zh_reviewed must be true or false');
    });

    // A drug matching two different class entries for the same herb would be ambiguous.
    db.herbs.forEach(function (h) {
      db.drugs.forEach(function (d) {
        var classHits = db.interactions.filter(function (e) {
          return e.herb_id === h.id && e.drug_class && (d.classes || []).indexOf(e.drug_class) !== -1;
        });
        if (classHits.length > 1) problem(h.id + ' × ' + d.id + ': matches several class entries (' +
          classHits.map(function (e) { return e.id; }).join(', ') + ')');
      });
    });
    return problems;
  }

  return {
    RISKS: RISKS,
    NOT_IN_DATABASE: NOT_IN_DATABASE,
    STATUS_ORDER: STATUS_ORDER,
    EVIDENCE_LEVELS: EVIDENCE_LEVELS,
    normalise: normalise,
    createDb: createDb,
    search: search,
    findInteraction: findInteraction,
    checkPairs: checkPairs,
    validateData: validateData
  };
});
