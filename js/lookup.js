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
  // A government health agency's own words about a pair (data/official.json). Never a rating.
  var OFFICIAL = 'official';
  var OFFICIAL_KINDS = ['official', 'disagree'];
  // Results are sorted in this order: High → Official caution → Moderate → Low → No reported risk
  // → Not in database. An official caution sorts high so a pair never looks safer than an agency says.
  var STATUS_ORDER = ['high', OFFICIAL, 'moderate', 'low', 'none_reported', NOT_IN_DATABASE];
  var EVIDENCE_LEVELS = ['case_reports', 'human_trial', 'review', 'lab_animal', 'official_guidance'];
  var RATING_SOURCES = ['HA', 'team'];

  /* Lower-case, strip accents, spaces, punctuation and Jyutping tone numbers,
     so "Daan1 Sam1", "daan sam" and "daansam" all match. */
  function normalise(text) {
    return String(text == null ? '' : text)
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[\s\-_'\u2019.,()\/\u00b7]+/g, '')
      .replace(/[0-9]/g, '');
  }

  function searchTerms(item) {
    // "Glycyrrhiza uralensis / G. glabra" is searchable as each part and as a whole.
    var latin = item.latin ? [item.latin].concat(String(item.latin).split('/')) : [];
    return [item.name_en, item.name_zh].concat(latin, item.aliases || [])
      .filter(Boolean)
      .map(normalise)
      .filter(Boolean);
  }

  function createDb(herbsJson, drugsJson, interactionsJson, officialJson, reviewsJson) {
    var db = {
      herbs: herbsJson.herbs,
      drugs: drugsJson.drugs,
      interactions: interactionsJson.interactions,
      statements: (officialJson && officialJson.statements) || [],
      cautions: (officialJson && officialJson.cautions) || [],
      // General Hospital Authority advice per medicine (leaflets for groups of heart medicines). Never a rating.
      generalAdvice: (officialJson && officialJson.general_advice) || [],
      reviews: (reviewsJson && reviewsJson.reviews) || [],
      statementById: Object.create(null),
      lastUpdated: interactionsJson.last_updated || null,
      // Plain maps (no prototype), so ids like "constructor" can never match anything.
      herbById: Object.create(null),
      drugById: Object.create(null)
    };
    db.herbs.forEach(function (h) { db.herbById[h.id] = h; });
    db.drugs.forEach(function (d) { db.drugById[d.id] = d; });
    db.statements.forEach(function (s) { db.statementById[s.id] = s; });
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
      else if (e.drug_class && Array.isArray(drug.classes) && drug.classes.indexOf(e.drug_class) !== -1 && !byClass) byClass = e;
    });
    return exact || byClass;
  }

  /* The official caution for one pair, or null. Same matching rule as findInteraction. */
  function findOfficial(db, herbId, drugId) {
    var drug = db.drugById[drugId];
    if (!drug || !db.herbById[herbId]) return null;
    var exact = null, byClass = null;
    db.cautions.forEach(function (c) {
      if (c.herb_id !== herbId) return;
      if (c.drug_id === drugId && !exact) exact = c;
      else if (c.drug_class && Array.isArray(drug.classes) && drug.classes.indexOf(c.drug_class) !== -1 && !byClass) byClass = c;
    });
    return exact || byClass;
  }

  /* The general Hospital Authority advice for a medicine, or null. */
  function findAdvice(db, drugId) {
    return db.generalAdvice.filter(function (a) { return Array.isArray(a.drug_ids) && a.drug_ids.indexOf(drugId) !== -1; })[0] || null;
  }

  /* Fingerprint of everything a card shows (team entry, official quotes, HA advice). A pharmacist
     review is tied to this, so any later change to the card hides the review until it is re-reviewed. */
  function stable(v) {
    if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
    if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map(function (k) { return JSON.stringify(k) + ':' + stable(v[k]); }).join(',') + '}';
    return JSON.stringify(v === undefined ? null : v);
  }
  function cardFingerprint(db, herbId, drugId) {
    var official = findOfficial(db, herbId, drugId);
    var text = stable({
      herb: herbId, drug: drugId,
      entry: findInteraction(db, herbId, drugId),
      official: official ? { kind: official.kind, statements: official.statements.map(function (id) { return db.statementById[id] || id; }) } : null,
      advice: findAdvice(db, drugId)
    });
    var h = 0x811c9dc5; // FNV-1a, 32-bit
    for (var i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return ('0000000' + h.toString(16)).slice(-8);
  }
  /* The pharmacist review for a pair: { review, stale }. A stale review is never shown. */
  function findReview(db, herbId, drugId) {
    var rev = db.reviews.filter(function (x) { return x.herb_id === herbId && x.drug_id === drugId; })[0] || null;
    if (!rev) return { review: null, stale: false };
    var ok = rev.fingerprint === cardFingerprint(db, herbId, drugId);
    return { review: ok ? rev : null, stale: !ok };
  }

  /* What a pair shows: the team rating, unless an official caution exists (then that, except
     when the team rating is already High, which stays). Never makes a pair look safer. */
  function statusOf(entry, official) {
    if (official && !(entry && entry.risk === 'high')) return OFFICIAL;
    return entry ? entry.risk : NOT_IN_DATABASE;
  }

  function unique(ids) {
    var seen = Object.create(null);
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
        var official = findOfficial(db, herbId, drugId);
        results.push({
          herb: db.herbById[herbId],
          drug: db.drugById[drugId],
          entry: entry,
          official: official,
          advice: findAdvice(db, drugId),
          review: findReview(db, herbId, drugId).review,
          status: statusOf(entry, official),
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
    function classesOf(d) { return Array.isArray(d.classes) ? d.classes : []; }
    var CLASS_NAME = /^[a-z][a-z0-9_]*$/;

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
        if (kind === 'drug') {
          if (!Array.isArray(item.classes)) problem(where + ': classes must be a list, e.g. ["statin"]');
          else item.classes.forEach(function (c) {
            if (typeof c !== 'string' || !CLASS_NAME.test(c)) problem(where + ': class "' + c + '" must be lower-case letters, digits and _ (e.g. "statin")');
          });
        }
      });
    });

    var classes = {};
    db.drugs.forEach(function (d) { classesOf(d).forEach(function (c) { classes[c] = true; }); });

    var ids = {}, pairKeys = {};
    db.interactions.forEach(function (e, i) {
      var where = 'interaction #' + (i + 1) + ' (' + (e.id || 'no id') + ')';
      if (!isText(e.id)) problem(where + ': missing id');
      if (ids[e.id]) problem(where + ': duplicate id');
      ids[e.id] = true;
      ['herb_id', 'drug_id', 'drug_class'].forEach(function (f) {
        if (e[f] != null && typeof e[f] !== 'string') problem(where + ': ' + f + ' must be plain text, not a list');
      });
      if (typeof e.herb_id !== 'string' || !db.herbById[e.herb_id]) problem(where + ': unknown herb_id "' + e.herb_id + '"');
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
      if (Array.isArray(e.sources) && e.sources.length &&
          !(typeof e.main_source === 'number' && e.main_source % 1 === 0 && e.main_source >= 0 && e.main_source < e.sources.length))
        problem(where + ': main_source must be the number of a source in its list (0 = first)');
      ['main_finding_en', 'main_finding_zh'].forEach(function (f) {
        if (!isText(e[f])) problem(where + ': missing ' + f);
      });
      if (!Array.isArray(e.sources) || !e.sources.length) problem(where + ': needs at least one source');
      else e.sources.forEach(function (s, si) {
        if (!isText(s.label)) problem(where + ': source ' + (si + 1) + ' has no label');
        if (!/^https:\/\/[^\s]+$/.test(s.url || '')) problem(where + ': source ' + (si + 1) + ' url must start with https://');
      });
      if (typeof e.zh_reviewed !== 'boolean') problem(where + ': zh_reviewed must be true or false');
    });

    // Official cautions: every quote has its source; every caution points at known statements.
    var stIds = {};
    db.statements.forEach(function (s, i) {
      var where = 'official statement #' + (i + 1) + ' (' + (s.id || 'no id') + ')';
      if (!isText(s.id)) problem(where + ': missing id');
      if (stIds[s.id]) problem(where + ': duplicate id');
      stIds[s.id] = true;
      ['body_en', 'body_zh', 'document_en', 'document_zh', 'date_en', 'date_zh', 'section_en', 'section_zh', 'quote_en', 'quote_zh', 'verified'].forEach(function (f) {
        if (!isText(s[f])) problem(where + ': missing ' + f);
      });
      if (!/^https:\/\/[^\s]+$/.test(s.url || '')) problem(where + ': url must start with https://');
      if (s.url_zh != null && !/^https:\/\/[^\s]+$/.test(s.url_zh)) problem(where + ': url_zh must start with https://');
      if (s.quote_zh_is_original != null && typeof s.quote_zh_is_original !== 'boolean') problem(where + ': quote_zh_is_original must be true or false');
    });
    var cIds = {}, cKeys = {};
    db.cautions.forEach(function (c, i) {
      var where = 'official caution #' + (i + 1) + ' (' + (c.id || 'no id') + ')';
      if (!isText(c.id)) problem(where + ': missing id');
      if (cIds[c.id]) problem(where + ': duplicate id');
      cIds[c.id] = true;
      if (typeof c.herb_id !== 'string' || !db.herbById[c.herb_id]) problem(where + ': unknown herb_id "' + c.herb_id + '"');
      if (!!c.drug_id === !!c.drug_class) problem(where + ': needs exactly one of drug_id or drug_class');
      if (c.drug_id && !db.drugById[c.drug_id]) problem(where + ': unknown drug_id "' + c.drug_id + '"');
      if (c.drug_class && !classes[c.drug_class]) problem(where + ': no drug has class "' + c.drug_class + '"');
      var key = c.herb_id + '|' + (c.drug_id ? 'drug:' + c.drug_id : 'class:' + c.drug_class);
      if (cKeys[key]) problem(where + ': same pair as ' + cKeys[key]);
      cKeys[key] = c.id;
      if (OFFICIAL_KINDS.indexOf(c.kind) === -1) problem(where + ': kind must be one of ' + OFFICIAL_KINDS.join(', '));
      if (!Array.isArray(c.statements) || !c.statements.length) problem(where + ': needs at least one statement');
      else c.statements.forEach(function (id) { if (!db.statementById[id]) problem(where + ': unknown statement "' + id + '"'); });
      if (c.kind === 'disagree' && !findInteraction(db, c.herb_id, c.drug_id || '')) problem(where + ': "disagree" needs a team rating for the same pair');
      if (typeof c.zh_reviewed !== 'boolean') problem(where + ': zh_reviewed must be true or false');
    });

    // General advice: one leaflet per medicine at most, all fields present, both languages as written.
    var adviceIds = {}, adviceFor = {};
    db.generalAdvice.forEach(function (a, i) {
      var where = 'general advice #' + (i + 1) + ' (' + (a.id || 'no id') + ')';
      if (!isText(a.id)) problem(where + ': missing id');
      if (adviceIds[a.id]) problem(where + ': duplicate id');
      adviceIds[a.id] = true;
      ['body_en', 'body_zh', 'document_en', 'document_zh', 'sn_en', 'sn_zh', 'date_en', 'date_zh', 'group_en', 'group_zh',
       'section_en', 'section_zh', 'quote_en', 'quote_zh', 'verified'].forEach(function (f) { if (!isText(a[f])) problem(where + ': missing ' + f); });
      ['url', 'url_zh'].forEach(function (f) { if (!/^https:\/\/[^\s]+$/.test(a[f] || '')) problem(where + ': ' + f + ' must start with https://'); });
      if (!Array.isArray(a.drug_ids) || !a.drug_ids.length) problem(where + ': drug_ids must be a non-empty list');
      else a.drug_ids.forEach(function (d) {
        if (!db.drugById[d]) problem(where + ': unknown drug "' + d + '"');
        if (adviceFor[d]) problem(where + ': ' + d + ' already has general advice (' + adviceFor[d] + ')');
        adviceFor[d] = a.id;
      });
    });

    // Pharmacist reviews: who, role, when, and the fingerprint of the card they saw.
    var reviewKeys = {};
    db.reviews.forEach(function (rv, i) {
      var where = 'review #' + (i + 1) + ' (' + rv.herb_id + ' × ' + rv.drug_id + ')';
      if (!db.herbById[rv.herb_id]) problem(where + ': unknown herb_id');
      if (!db.drugById[rv.drug_id]) problem(where + ': unknown drug_id');
      ['reviewer_en', 'reviewer_zh', 'role_en', 'role_zh', 'fingerprint'].forEach(function (f) { if (!isText(rv[f])) problem(where + ': missing ' + f); });
      if (!/^\d{4}-\d{2}-\d{2}$/.test(rv.date || '')) problem(where + ': date must be YYYY-MM-DD');
      var k = rv.herb_id + '|' + rv.drug_id;
      if (reviewKeys[k]) problem(where + ': this card already has a review');
      reviewKeys[k] = true;
    });

    // A drug matching two different class entries for the same herb would be ambiguous.
    db.herbs.forEach(function (h) {
      db.drugs.forEach(function (d) {
        var classHits = db.interactions.filter(function (e) {
          return e.herb_id === h.id && e.drug_class && classesOf(d).indexOf(e.drug_class) !== -1;
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
    OFFICIAL: OFFICIAL,
    STATUS_ORDER: STATUS_ORDER,
    EVIDENCE_LEVELS: EVIDENCE_LEVELS,
    normalise: normalise,
    createDb: createDb,
    search: search,
    findInteraction: findInteraction,
    findOfficial: findOfficial,
    findAdvice: findAdvice,
    cardFingerprint: cardFingerprint,
    findReview: findReview,
    checkPairs: checkPairs,
    validateData: validateData
  };
});
