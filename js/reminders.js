/*
 * General reminders (data/reminders.json) shown under results and in the doctor summary when a list has
 * both a Chinese herb and a Western medicine. Quotes are shown word for word with their source link.
 * They are general advice from the source, never a judgement about the person's own medicines.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(null);
  else root.HerbBridgeReminders = factory(root);
})(typeof self !== 'undefined' ? self : this, function (win) {
  'use strict';
  var WORDS = {
    en: { title: 'General reminder', from: 'From the {publisher}', general: 'This is general advice, not about your particular medicines. Ask your doctor or pharmacist how to time your own medicines.', source: 'Source', food_title: 'Food hint: {name}', food_general: 'A food hint, not a ban. Ask your doctor or pharmacist what this means for you.', original: '' },
    zh: { title: '一般提示', from: '來自{publisher}', general: '呢個係一般建議，唔係針對你嘅藥物。請問你嘅醫生或者藥劑師，你自己嘅藥應該點樣安排時間。', source: '資料來源', food_title: '飲食提示：{name}', food_general: '呢個係飲食提示，唔係禁令。請問你嘅醫生或者藥劑師對你有咩影響。', original: '以下係寫俾醫生睇嘅英文原文：' }
  };
  function applicable(data, list) {
    var both = list && list.herbs && list.drugs && list.herbs.length > 0 && list.drugs.length > 0;
    return ((data && data.reminders) || []).filter(function (r) {
      if (!r || !r.quote_en || !r.source || !/^https:\/\//.test(r.source.url_en || '') || !/^https:\/\//.test(r.source.url_zh || '')) return false;
      if (r.applies === 'herb_and_drug') return both && !!r.quote_zh;
      if (r.applies === 'drug') return !!(list && list[r.kind] && list[r.kind].indexOf(r.id_item) !== -1);
      return false;
    });
  }
  var api = { WORDS: WORDS, applicable: applicable };
  if (!win) return api;

  var cache = null;
  function data() {
    if (!cache) cache = win.fetch('data/reminders.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : { reminders: [] }; }).catch(function () { cache = null; return { reminders: [] }; });
    return cache;
  }
  /* Returns an empty container at once and fills it when the reminders file has loaded. */
  function block(el, lang, list, db) {
    var zh = lang === 'zh', w = WORDS[zh ? 'zh' : 'en'];
    var box = el('div', { class: 'reminders' });
    data().then(function (d) {
      applicable(d, list).forEach(function (r) {
        var s = r.source, url = zh ? s.url_zh : s.url_en, food = r.applies === 'drug';
        var item = food && db && (r.kind === 'drugs' ? db.drugById : db.herbById)[r.id_item];
        var title = food ? w.food_title.replace('{name}', item ? (zh ? item.name_zh : item.name_en) : r.id_item) : w.title;
        var quoteZh = zh && r.quote_zh, quote = quoteZh ? r.quote_zh : r.quote_en;
        box.appendChild(el('aside', { class: 'reminder' + (food ? ' reminder-food' : ''), 'aria-label': title }, [
          el('h2', { class: 'reminder-title', text: title }),
          el('p', { class: 'reminder-from', text: w.from.replace('{publisher}', zh ? s.publisher_zh : s.publisher_en) }),
          zh && !quoteZh && w.original ? el('p', { class: 'reminder-general', text: w.original }) : null,
          el('blockquote', { class: 'reminder-quote', lang: quoteZh ? 'zh-HK' : 'en', cite: url }, [el('p', { text: quote })]),
          el('p', { class: 'reminder-source' }, [w.source + ': ', el('a', { href: url, target: '_blank', rel: 'noopener noreferrer', text: (zh ? s.title_zh : s.title_en) + ' · ' + s.publication })]),
          (zh ? r.note_zh : r.note_en) ? el('p', { class: 'reminder-note', text: zh ? r.note_zh : r.note_en }) : null,
          el('p', { class: 'reminder-general', text: food ? w.food_general : w.general })
        ]));
      });
    });
    return box;
  }
  api.block = block;
  return api;
});
