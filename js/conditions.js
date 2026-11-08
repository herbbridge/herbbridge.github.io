/*
 * HerbBridge "About me" conditions (G6PD deficiency, pregnancy). Recorded only on this device.
 * When a condition is recorded, results and the doctor summary show word-for-word cautions from the
 * sources in data/conditions.json for medicines on the list, and say plainly which listed items have
 * NOT been checked for that condition. Never tells anyone to stop a medicine.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(null);
  else root.HerbBridgeConditions = factory(root);
})(typeof self !== 'undefined' ? self : this, function (win) {
  'use strict';
  var KEY = 'herbbridge.conditions.v1';
  var IDS = ['g6pd', 'pregnancy'];

  function load(storage) {
    try {
      var d = JSON.parse(storage.getItem(KEY) || 'null');
      if (!d || d.v !== 1) return {};
      var out = {};
      if (d.g6pd === true) out.g6pd = true;
      if (d.pregnancy && typeof d.pregnancy.since === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.pregnancy.since)) out.pregnancy = { since: d.pregnancy.since };
      return out;
    } catch (e) { return {}; }
  }
  function save(storage, state) {
    var d = { v: 1 };
    if (state.g6pd) d.g6pd = true;
    if (state.pregnancy && /^\d{4}-\d{2}-\d{2}$/.test(state.pregnancy.since || '')) d.pregnancy = { since: state.pregnancy.since };
    try { if (!d.g6pd && !d.pregnancy) storage.removeItem(KEY); else storage.setItem(KEY, JSON.stringify(d)); return true; } catch (e) { return false; }
  }

  /* For one recorded condition and a list → { general, matched:[{item, entry}], unchecked:[item] } */
  function evaluate(data, condId, list, db) {
    var c = data && data.conditions && data.conditions[condId];
    if (!c) return null;
    var matched = [], unchecked = [];
    [['drugs', db.drugById], ['herbs', db.herbById]].forEach(function (g) {
      (list[g[0]] || []).forEach(function (id) {
        var item = g[1][id]; if (!item) return;
        var entry = (c.items || []).filter(function (x) { return x.kind === g[0] && x.id === id; })[0];
        if (entry) matched.push({ kind: g[0], item: item, entry: entry }); else unchecked.push(item);
      });
    });
    return { condition: c, general: c.general || null, matched: matched, unchecked: unchecked };
  }

  var WORDS = {
    en: {
      about_title: 'About me (optional)',
      about_help: 'Some conditions change which medicines need extra care. Saved only on this device.',
      g6pd_label: 'I have G6PD deficiency',
      preg_label: 'I am pregnant',
      preg_since: 'Pregnancy start date (approximate)',
      preg_end: 'I am no longer pregnant',
      saved: 'Saved on this device.',
      section_title: 'Because you recorded: {name}',
      general_from: 'From the {publisher}',
      label_for: 'For {name}:',
      for_doctors: 'This is from a prescribing label written for doctors.',
      public_from: 'From {publisher}, in its own words:',
      translation: '',
      unchecked: 'HerbBridge has not yet checked these items for {name}: {items}.',
      tell_doctor: 'Tell your doctor and pharmacist about this. Do not stop or change a medicine on your own.',
      source: 'Source',
      summary_title: 'Recorded by the patient',
      since: 'since {date}'
    },
    zh: {
      about_title: '關於我（可選）',
      about_help: '有啲身體狀況會影響邊啲藥要特別小心。只會儲存喺呢部裝置。',
      g6pd_label: '我有 G6PD 缺乏症（蠶豆症）',
      preg_label: '我懷孕',
      preg_since: '懷孕開始日期（大約）',
      preg_end: '我已經唔再懷孕',
      saved: '已儲存喺呢部裝置。',
      section_title: '因為你記錄咗：{name}',
      general_from: '來自{publisher}',
      label_for: '關於{name}：',
      for_doctors: '以下內容來自寫俾醫生睇嘅處方標籤（英文原文）。',
      public_from: '以下係{publisher}嘅英文原文：',
      translation: '中文翻譯（以英文原文為準）：',
      unchecked: '中西通暫時未檢查以下項目同{name}嘅關係：{items}。',
      tell_doctor: '請話俾你嘅醫生同藥劑師知。唔好自己停藥或者改藥。',
      source: '資料來源',
      summary_title: '病人自行記錄',
      since: '由 {date} 開始'
    }
  };
  function fill(s, v) { return String(s).replace(/\{(\w+)\}/g, function (m, k) { return v[k] != null ? v[k] : m; }); }

  var api = { KEY: KEY, IDS: IDS, WORDS: WORDS, load: load, save: save, evaluate: evaluate };
  if (!win) return api;

  var cache = null;
  function data() {
    if (!cache) cache = win.fetch('data/conditions.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { cache = null; return null; });
    return cache;
  }

  /* Editor for the Health log page. */
  function editor(el, lang, onChange) {
    var w = WORDS[lang === 'zh' ? 'zh' : 'en'], storage = win.localStorage, st = load(storage);
    var box = el('section', { class: 'log-section conditions-editor', 'aria-labelledby': 'cond-h' });
    function draw(msg) {
      box.textContent = '';
      box.appendChild(el('h2', { id: 'cond-h', text: w.about_title }));
      box.appendChild(el('p', { class: 'muted', text: w.about_help }));
      var g = el('input', { type: 'checkbox', id: 'cond-g6pd', checked: !!st.g6pd });
      g.addEventListener('change', function () { st.g6pd = g.checked; save(storage, st); draw(w.saved); if (onChange) onChange(); });
      box.appendChild(el('label', { class: 'log-take', for: 'cond-g6pd' }, [g, el('span', { text: w.g6pd_label })]));
      var p = el('input', { type: 'checkbox', id: 'cond-preg', checked: !!st.pregnancy });
      p.addEventListener('change', function () { st.pregnancy = p.checked ? { since: new Date().toISOString().slice(0, 10) } : null; save(storage, st); draw(w.saved); if (onChange) onChange(); });
      box.appendChild(el('label', { class: 'log-take', for: 'cond-preg' }, [p, el('span', { text: w.preg_label })]));
      if (st.pregnancy) {
        var d = el('input', { type: 'date', id: 'cond-preg-since', class: 'log-input', value: st.pregnancy.since, max: new Date().toISOString().slice(0, 10) });
        d.addEventListener('change', function () { if (/^\d{4}-\d{2}-\d{2}$/.test(d.value)) { st.pregnancy = { since: d.value }; save(storage, st); draw(w.saved); } });
        box.appendChild(el('div', { class: 'log-field' }, [el('label', { for: 'cond-preg-since', text: w.preg_since }), d]));
        box.appendChild(el('button', { type: 'button', class: 'btn btn-secondary btn-small', onclick: function () { st.pregnancy = null; save(storage, st); draw(w.saved); if (onChange) onChange(); } }, [el('span', { text: w.preg_end })]));
      }
      if (msg) box.appendChild(el('p', { class: 'log-notice', role: 'status', text: msg }));
    }
    draw();
    return box;
  }

  /* Cautions block for results / summary. Fills asynchronously; empty when nothing is recorded. */
  function block(el, lang, list, db) {
    var zh = lang === 'zh', w = WORDS[zh ? 'zh' : 'en'], st = load(win.localStorage);
    var box = el('div', { class: 'conditions' });
    var recorded = IDS.filter(function (id) { return st[id]; });
    if (!recorded.length) return box;
    data().then(function (d) {
      if (!d) return;
      recorded.forEach(function (cid) {
        var r = evaluate(d, cid, list, db); if (!r) return;
        var name = zh ? r.condition.name_zh : r.condition.name_en;
        var title = fill(w.section_title, { name: name }) + (cid === 'pregnancy' ? ' (' + fill(w.since, { date: st.pregnancy.since }) + ')' : '');
        var parts = [el('h2', { class: 'reminder-title', text: title })];
        if (r.general) {
          var s = r.general.source, url = zh ? s.url_zh : s.url_en;
          parts.push(el('p', { class: 'reminder-from', text: fill(w.general_from, { publisher: zh ? s.publisher_zh : s.publisher_en }) }));
          parts.push(el('blockquote', { class: 'reminder-quote', lang: zh ? 'zh-HK' : 'en-GB', cite: url }, [el('p', { text: zh ? r.general.quote_zh : r.general.quote_en })]));
          parts.push(el('p', { class: 'reminder-source' }, [w.source + ': ', el('a', { href: url, target: '_blank', rel: 'noopener noreferrer', text: zh ? s.title_zh : s.title_en })]));
        }
        r.matched.forEach(function (m) {
          var nm = zh ? m.item.name_zh : m.item.name_en;
          var e = m.entry, rows = [el('h3', { class: 'condition-item', text: fill(w.label_for, { name: nm }) })];
          if (e.note_en) rows.push(el('p', { text: zh ? e.note_zh : e.note_en }));
          if (e.quote_en) {
            // Prescribing labels are written for doctors; public health pages (audience "public") are not.
            rows.push(el('p', { class: 'muted', text: e.audience === 'public' ? fill(w.public_from, { publisher: zh ? e.source.publisher_zh : e.source.publisher_en }) : w.for_doctors }));
            rows.push(el('blockquote', { class: 'reminder-quote', lang: 'en', cite: e.source.url_en }, [el('p', { text: e.quote_en })]));
            if (zh && e.translation_zh) rows.push(el('p', { class: 'condition-translation', lang: 'zh-HK', text: w.translation + e.translation_zh }));
            rows.push(el('p', { class: 'reminder-source' }, [w.source + ': ', el('a', { href: e.source.url_en, target: '_blank', rel: 'noopener noreferrer', text: (zh ? e.source.publisher_zh : e.source.publisher_en) + ' · ' + e.source.title_en })]));
          }
          parts.push(el('div', { class: 'condition-match' }, rows));
        });
        if (r.unchecked.length) parts.push(el('p', { class: 'reminder-general', text: fill(w.unchecked, { name: name, items: r.unchecked.map(function (i) { return zh ? i.name_zh : i.name_en; }).join(zh ? '、' : ', ') }) }));
        parts.push(el('p', { class: 'condition-tell', text: w.tell_doctor }));
        box.appendChild(el('aside', { class: 'reminder condition-box', 'aria-label': title }, parts));
      });
    });
    return box;
  }

  api.editor = editor;
  api.block = block;
  return api;
});
