/*
 * HerbBridge spoken script: a listening version of one pair, separate from the on-screen text.
 * Pure functions, no DOM: used by the app (window.HerbBridgeSpeech) and by the tests (Node).
 *
 * Order: names + rating → the official quote → What to do (our own advice) → why it matters → what people
 * take the herb for (Simple line, then "not a recommendation") → "Next: show your doctor and your Chinese medicine
 * practitioner" with the sentence to say. Nothing else
 * (no evidence lists, sources, S/N numbers or links). Each section is its own short utterance,
 * so the voice pauses between them. Official quotes keep their own words; only brackets,
 * citations and "INR" are made easier to listen to.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.HerbBridgeSpeech = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Short spoken names of the agencies quoted on official cautions.
  // match: how our own advice names the agency (used to avoid saying it twice).
  var BODY = {
    'Hong Kong Hospital Authority': { en: 'The Hospital Authority', zh: '醫院管理局', match: /Hospital Authority|醫院管理局/ },
    'Health Canada': { en: 'Health Canada', zh: '加拿大衞生部', match: /Health Canada|加拿大衞生部/ },
    'European Medicines Agency': { en: 'The European Medicines Agency', zh: '歐洲藥品管理局', match: /European Medicines Agency|歐洲藥品管理局/ }
  };

  // Our own English lines (not quotes): "TCM" said as "Chinese medicine", a pause before a second
  // instruction ("…danshen, and ask…"), and a small letter after the section label.
  function ownEn(s) {
    return listenEn(String(s || '').replace(/\bTCM\b/g, 'Chinese medicine'))
      .replace(/([a-z]) and (ask|tell|watch|get) /g, '$1, and $2 ')
      .replace(/^([A-Z])(?=[a-z ])/, function (c) { return c.toLowerCase(); });
  }

  function sentences(text, zh) {
    return (zh ? String(text).match(/[^。！？]+[。！？]?/g) || [] : String(text).split(/(?<=[.!?])\s+/))
      .map(function (x) { return x.trim(); }).filter(Boolean);
  }

  // Our advice without the sentences that name the agency whose words were just read out.
  function withoutBody(text, body, zh) {
    if (!body || !body.match) return text;
    return sentences(text, zh).filter(function (x) { return !body.match.test(x); }).join(zh ? '' : ' ').trim();
  }

  // English for listening: INR said as "clotting test"; citations and acronym brackets dropped;
  // any other bracket becomes a short pause.
  function listenEn(s) {
    return String(s || '')
      .replace(/\b([Aa])n INR \(clotting\) (test|check)\b/g, '$1 clotting $2')
      .replace(/\bINR \(clotting\) (test|check)\b/g, 'clotting $1')
      .replace(/\b([Aa])n INR\b( \(clotting\))?/g, '$1 clotting test')
      .replace(/\bINR\b( \(clotting\))?/g, 'clotting test')
      // Health Canada's "health care practitioner/health care provider/…/physician": only the first title.
      .replace(/health care practitioner(?:\s*\/\s*(?:health care provider|health care professional|doctor|physician|pharmacist))+/gi, 'health care practitioner')
      .replace(/\s*\/\s*/g, ', ')                    // any other "a/b" → pause, not "slash"
      .replace(/\s*\([^()]*\d{4}[^()]*\)/g, '')     // "(Brinker 2010; …)"
      .replace(/\s*\((see )?section[^()]*\)/gi, '') // "(see section with 4.4)": a reference, not advice
      .replace(/\s*\([A-Z]{2,6}\)/g, '')            // "(TCM)"
      .replace(/\s*\(([^()]*)\)/g, ', $1,')         // "(warfarin works more strongly)" → pause
      .replace(/,\s*([.,;:!?])/g, '$1')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  // Chinese for listening: INR（凝血指數）said as 凝血指數; citations and Latin-only brackets
  // dropped; other brackets become a pause (，).
  function listenZh(s) {
    return String(s || '')
      .replace(/INR\s*[（(]凝血指數[）)]/g, '凝血指數')
      .replace(/INR/g, '凝血指數')
      .replace(/〔([^〔〕]*)〕/g, '，$1，')
      .replace(/\s*[\/／]\s*/g, '、')
      .replace(/\s*[（(][^（）()]*\d{4}[^（）()]*[）)]/g, '')
      .replace(/\s*[（(]見第[^（）()]*節[）)]/g, '')
      .replace(/\s*[（(]\s*[A-Za-z][A-Za-z .,&-]*\s*[）)]/g, '')
      .replace(/\s*[（(]\s*([^（）()]*?)\s*[）)]\s*/g, '，$1，')
      .replace(/，\s*([。，、；：！？])/g, '$1')
      .replace(/([。；：！？])，/g, '$1')
      .replace(/\s+/g, '')
      .replace(/^，/, '');
  }

  // A herb or medicine name inside a sentence: "danshen", "American ginseng"; Chinese as is.
  function sentenceName(item, lang) {
    if (lang === 'zh') return item.name_zh;
    return /^(American|Asian)\b/.test(item.name_en) ? item.name_en : item.name_en.charAt(0).toLowerCase() + item.name_en.slice(1);
  }
  function listNames(names, lang) {
    if (names.length < 2) return names.join('');
    var and = lang === 'zh' ? '同' : ' and ';
    return names.slice(0, -1).join(lang === 'zh' ? '、' : ', ') + and + names[names.length - 1];
  }
  // "You can say: 'I take danshen and warfarin. Can you check if that's OK for me?'" for a list of rows.
  function youCanSay(rows, lang, t) {
    var names = [];
    rows.forEach(function (r) {
      [r.herb, r.drug].forEach(function (item) { var n = sentenceName(item, lang); if (names.indexOf(n) === -1) names.push(n); });
    });
    return t('next_say', { names: listNames(names, lang) });
  }

  // What people take the herb for (data/uses.json): the Simple line, then "This is not a recommendation to take it."
  // Rated pairs only, never on a pair with no record (same rule as the box on screen).
  function usesParts(db, r, zh, t, own, colon) {
    var u = r.status !== 'not_in_database' && db.usesByHerb && db.usesByHerb[r.herb.id];
    if (!u) return [];
    return [t('uses_title') + colon + own(zh ? u.simple_zh : u.simple_en), t('uses_not_rec')];
  }

  // The "Next" heading has no full stop on screen; spoken, it ends with one so the voice pauses before "You can say".
  function nextLine(rows, lang, t) {
    var title = t('next_title');
    return title + (/[.。！？!?]$/.test(title) ? '' : (lang === 'zh' ? '。' : '.')) + ' ' + youCanSay(rows, lang, t);
  }

  /* The spoken script for one result row r (from lookup.checkPairs) as a list of short utterances.
     t(key) and name(item) come from the app, in the current language. */
  function script(db, r, lang, t, name) {
    var zh = lang === 'zh';
    var listen = zh ? listenZh : listenEn;
    var stop = zh ? '。' : '.';
    var colon = zh ? '：' : ': ';
    var pick = function (o, base) { return (zh && o[base + '_zh']) || o[base + '_en']; };
    var parts = [];
    var own = zh ? listenZh : ownEn;
    var drugName = zh ? name(r.drug) : name(r.drug).toLowerCase(); // "Danshen and warfarin."
    var pair = name(r.herb) + (zh ? t('and_sr') : ' ' + t('and_sr') + ' ') + drugName + stop;

    if (!r.entry && !r.official) {
      parts.push(pair + ' ' + t('risk_not_in_database') + stop + ' ' + t('not_in_db_text'));
      sentences(own(t('unknown_next_text')), zh).forEach(function (x, i) { parts.push(i === 0 ? t('label_what_to_do') + colon + x : x); });
      parts.push(nextLine([r], lang, t));
      return parts.map(function (p) { return zh ? p.replace(/\s+/g, '') : p; });
    }

    var rating;
    if (r.status === 'official') rating = t(r.official.kind === 'disagree' ? 'risk_official_disagree' : 'risk_official');
    else if (r.entry.risk === 'low') rating = t('speak_low'); // every Low card: "Low risk. Keep an eye on it."
    else rating = t('risk_' + r.entry.risk);
    rating = rating.replace(/\s*·\s*/g, zh ? '，' : ', ');
    parts.push(pair + ' ' + rating + (/[.。]$/.test(rating) ? '' : stop));

    // The official quote comes straight after the rating, in the agency's own words.
    var body = null;
    if (r.official) {
      var s = db.statementById[r.official.statements[0]];
      body = BODY[s.body_en] || { en: s.body_en, zh: s.body_zh };
      // A Chinese quote that is our translation of an English original says so.
      var says = zh && !s.quote_zh_is_original ? 'speak_says_translated' : 'speak_says';
      parts.push(t(says, { body: zh ? body.zh : body.en }) + ' ' + listen(zh ? s.quote_zh : s.quote_en));
    }

    // Then only our own advice, one sentence per spoken piece: a sentence naming that agency again is
    // left out. action_spoken_* (data) replaces the on-screen advice for listening where the owner set it.
    var said = {};
    var key = function (x) { return String(x).toLowerCase().replace(/[\s.,;:!?。，、；：！？「」]/g, ''); };
    var fresh = function (list) { return list.filter(function (x) { var k = key(x); if (!k || said[k]) return false; said[k] = true; return true; }); };
    var action = r.entry ? withoutBody(pick(r.entry, 'action_spoken') || pick(r.entry, 'action'), body, zh) : '';
    fresh(sentences(own(action || t('official_action')), zh)).forEach(function (x, i) {
      parts.push(i === 0 ? t('label_what_to_do') + colon + x : x);
    });

    // Why it matters, unless those words were already said.
    if (r.entry && pick(r.entry, 'heart_impact')) {
      var heart = fresh(sentences(own(pick(r.entry, 'heart_impact')), zh));
      if (heart.length) parts.push(t('speak_why') + colon + heart.join(zh ? '' : ' '));
    }
    usesParts(db, r, zh, t, own, colon).forEach(function (x) { parts.push(x); });
    parts.push(nextLine([r], lang, t));
    return parts.map(function (p) { return zh ? p.replace(/\s+/g, '') : p; });
  }

  /* "What else can change your warfarin" (data/warfarin.json): the key line of each section, then the
     whole bleeding section, then the emergency line. Quotes keep their own words; only brackets, slashes
     and "e.g." are made easier to listen to. Returns [] when a line has no Chinese source wording yet
     (the app then offers no Read aloud in Chinese, rather than skip part of the bleeding section). */
  function warfarinScript(wf, lang, t) {
    var zh = lang === 'zh';
    var stop = zh ? '。' : '.';
    var missing = false;
    function say(item) {
      var text = zh ? item.zh : item.en;
      if (text == null) { missing = true; return ''; }
      if (zh) return listenZh((item.zh_label ? item.zh_label + '：' : '') + text);
      return listenEn(String(text).replace(/\be\.g\.\s*/g, 'for example, '));
    }
    function end(x) { return /[.。！？!?]$/.test(x) ? x : x + stop; }
    var parts = [end(t('wf_title'))];
    wf.sections.forEach(function (sec) {
      var title = t('wf_sec_' + sec.id);
      if (sec.id !== 'bleeding') { parts.push(end(title) + ' ' + end(say(sec.key))); return; }
      parts.push(end(title) + ' ' + end(say(sec.key)));
      parts.push(t('wf_signs'));
      sec.signs.forEach(function (x) { parts.push(end(say(x))); });
      sec.items.forEach(function (x) { parts.push(end(say(x))); });
    });
    parts.push(t('wf_999'));
    if (missing) return [];
    return parts.map(function (p) { return zh ? p.replace(/\s+/g, '') : p.replace(/\s{2,}/g, ' ').replace(/,\s*\./g, '.'); });
  }

  return { script: script, warfarinScript: warfarinScript, listenEn: listenEn, listenZh: listenZh, youCanSay: youCanSay, sentenceName: sentenceName };
});
