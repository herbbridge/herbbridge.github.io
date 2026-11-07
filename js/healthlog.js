/*
 * HerbBridge daily health log. The person records which listed medicines and herbs they took and,
 * if they wish, blood pressure, heart rate and blood sugar. HerbBridge only KEEPS the record and draws
 * it as a chart for the doctor: it never judges a reading as good, bad, normal or abnormal.
 * Everything stays in this browser (localStorage); nothing is sent anywhere.
 * Pure helpers are exported for Node tests; the screen is built only in a browser.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(null);
  else root.HerbBridgeLog = factory(root);
})(typeof self !== 'undefined' ? self : this, function (win) {
  'use strict';

  var KEY = 'herbbridge.log.v1';
  var MAX_ENTRIES = 1000;
  var SVG = 'http://www.w3.org/2000/svg';
  // Typing-mistake limits only (not medical limits): a value outside them is almost certainly a typo.
  var LIMITS = { sys: [50, 260], dia: [30, 160], hr: [30, 220], sugar: [1, 35] };
  var SUGAR_WHEN = ['before_meal', 'after_meal', 'other'];

  /* ---------- pure helpers ---------- */

  function num(v, decimals) {
    if (v === '' || v == null) return null;
    var n = Number(String(v).replace(',', '.'));
    if (!isFinite(n)) return NaN;
    var f = Math.pow(10, decimals || 0);
    return Math.round(n * f) / f;
  }

  /* Raw form values → { entry } or { errors: [field…] }. At least one reading or one medicine. */
  function validate(raw, known) {
    var errors = [], e = { at: null, sys: num(raw.sys), dia: num(raw.dia), hr: num(raw.hr), sugar: num(raw.sugar, 1),
      sugar_when: SUGAR_WHEN.indexOf(raw.sugar_when) !== -1 ? raw.sugar_when : null,
      taken: { herbs: [], drugs: [] }, note: String(raw.note || '').trim().slice(0, 200) };
    var at = raw.at ? new Date(raw.at) : null;
    if (!at || isNaN(at.getTime())) errors.push('at'); else e.at = at.toISOString();
    ['sys', 'dia', 'hr', 'sugar'].forEach(function (k) {
      if (e[k] === null) return;
      if (isNaN(e[k]) || e[k] < LIMITS[k][0] || e[k] > LIMITS[k][1]) errors.push(k);
    });
    if ((e.sys === null) !== (e.dia === null)) errors.push(e.sys === null ? 'sys' : 'dia');
    if (e.sys !== null && e.dia !== null && !isNaN(e.sys) && !isNaN(e.dia) && e.dia >= e.sys) errors.push('bp_order');
    if (e.sugar === null) e.sugar_when = null;
    ['herbs', 'drugs'].forEach(function (kind) {
      (raw.taken && raw.taken[kind] || []).forEach(function (id) {
        if (known[kind][id] && e.taken[kind].indexOf(id) === -1) e.taken[kind].push(id);
      });
    });
    var hasReading = e.sys !== null || e.hr !== null || e.sugar !== null;
    if (!hasReading && !e.taken.herbs.length && !e.taken.drugs.length) errors.push('empty');
    return errors.length ? { errors: errors.filter(function (x, i, a) { return a.indexOf(x) === i; }) } : { entry: e };
  }

  function load(storage) {
    try {
      var data = JSON.parse(storage.getItem(KEY) || 'null');
      if (!data || data.v !== 1 || !Array.isArray(data.entries)) return [];
      return data.entries.filter(function (x) { return x && typeof x.at === 'string' && !isNaN(new Date(x.at).getTime()); });
    } catch (err) { return []; }
  }
  function persist(storage, entries) {
    var sorted = entries.slice().sort(function (a, b) { return a.at < b.at ? -1 : a.at > b.at ? 1 : 0; }).slice(-MAX_ENTRIES);
    try { storage.setItem(KEY, JSON.stringify({ v: 1, entries: sorted })); return sorted; } catch (err) { return null; }
  }
  function add(storage, entry, idGen) {
    var entries = load(storage);
    entry.id = idGen ? idGen() : 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    entries.push(entry);
    return persist(storage, entries);
  }
  function remove(storage, id) { return persist(storage, load(storage).filter(function (x) { return x.id !== id; })); }
  function clearAll(storage) { try { storage.removeItem(KEY); return true; } catch (err) { return false; } }

  function since(entries, days, now) {
    var from = (now || new Date()).getTime() - days * 86400000;
    return entries.filter(function (x) { return new Date(x.at).getTime() >= from; });
  }

  /* Points for one chart: [{t, values:{k:v}}] for entries that have any of the keys. */
  function series(entries, keys) {
    return entries.filter(function (x) { return keys.some(function (k) { return typeof x[k] === 'number'; }); })
      .map(function (x) { var v = {}; keys.forEach(function (k) { v[k] = typeof x[k] === 'number' ? x[k] : null; }); return { t: new Date(x.at).getTime(), values: v }; });
  }

  // "Nice" axis range with a little room above and below; never invents a target or normal band.
  function axis(values) {
    var lo = Math.min.apply(null, values), hi = Math.max.apply(null, values);
    if (lo === hi) { lo -= 1; hi += 1; }
    var pad = (hi - lo) * 0.15;
    return [Math.floor(lo - pad), Math.ceil(hi + pad)];
  }

  var WORDS = {
    en: {
      title: 'Daily health log',
      lede: 'Record the medicines and herbs you took and, if you like, your readings. HerbBridge only keeps the record and draws it for your doctor. It does not judge whether a number is good or bad.',
      privacy: 'Saved only on this device. Nothing is sent anywhere.',
      new_entry: 'Add an entry',
      when: 'Date and time',
      taken: 'Taken',
      taken_help: 'Tick what you took. The list comes from My cabinet.',
      taken_empty: 'Your cabinet is empty. Add medicines and herbs in My cabinet to tick them here.',
      go_cabinet: 'Go to My cabinet',
      bp: 'Blood pressure',
      sys: 'Upper (systolic)', dia: 'Lower (diastolic)', mmhg: 'mmHg',
      hr: 'Heart rate', bpm: 'beats per minute',
      sugar: 'Blood sugar', mmol: 'mmol/L',
      sugar_when: 'When was it measured?', before_meal: 'Before a meal', after_meal: 'After a meal', other: 'Other time',
      note: 'Note (optional)',
      optional: 'Every reading is optional.',
      save: 'Save entry', saved: 'Entry saved.',
      err_at: 'Choose a date and time.',
      err_sys: 'Check the upper blood pressure number. Both numbers are needed.',
      err_dia: 'Check the lower blood pressure number. Both numbers are needed.',
      err_bp_order: 'The upper number should be bigger than the lower number. Please check them.',
      err_hr: 'Check the heart rate number.',
      err_sugar: 'Check the blood sugar number (mmol/L, for example 5.6).',
      err_empty: 'Tick a medicine or enter at least one reading.',
      err_storage: 'This browser could not save the entry (private browsing or storage turned off).',
      charts: 'Charts',
      range: 'Show',
      days7: '7 days', days30: '30 days', days90: '90 days',
      chart_none: 'Charts appear once there are two or more entries with a reading.',
      chart_label: '{name}: {n} readings from {from} to {to}, lowest {min}, highest {max} {unit}.',
      history: 'Entries',
      history_none: 'No entries yet.',
      delete_one: 'Delete',
      delete_confirm: 'Delete this entry?',
      clear_all: 'Delete all entries',
      clear_confirm: 'Delete every entry in this log? This cannot be undone.',
      yes_delete: 'Yes, delete', cancel: 'Cancel',
      show_more: 'Show older entries',
      summary_title: 'Health log: last 14 days',
      summary_note: 'Recorded by the patient on their own device. Readings are as entered; HerbBridge does not check or interpret them.',
      col_when: 'When', col_bp: 'Blood pressure', col_hr: 'Heart rate', col_sugar: 'Blood sugar', col_taken: 'Taken',
      doctor_tip: 'Your doctor summary includes the last 14 days of this log.',
      disclaimer: 'HerbBridge gives information, not medical advice. If you are worried about a reading, contact your doctor.'
    },
    zh: {
      title: '每日健康記錄',
      lede: '記低你食咗嘅西藥同中藥，亦可以記低你量度嘅數字。中西通只會保存記錄，畫成圖表俾醫生睇，唔會判斷數字好定唔好。',
      privacy: '只會儲存喺呢部裝置，唔會傳送去任何地方。',
      new_entry: '新增記錄',
      when: '日期同時間',
      taken: '已服用',
      taken_help: '剔選你食咗嘅藥。清單來自「我的藥櫃」。',
      taken_empty: '你嘅藥櫃未有藥物。請先喺「我的藥櫃」加入西藥同中藥，再喺呢度剔選。',
      go_cabinet: '去我的藥櫃',
      bp: '血壓',
      sys: '上壓（收縮壓）', dia: '下壓（舒張壓）', mmhg: '毫米水銀柱',
      hr: '心跳', bpm: '每分鐘心跳次數',
      sugar: '血糖', mmol: '毫摩爾／升',
      sugar_when: '幾時量度？', before_meal: '飯前', after_meal: '飯後', other: '其他時間',
      note: '備註（可選）',
      optional: '所有數字都可以唔填。',
      save: '儲存記錄', saved: '已儲存記錄。',
      err_at: '請揀日期同時間。',
      err_sys: '請檢查上壓數字。上壓同下壓都要填。',
      err_dia: '請檢查下壓數字。上壓同下壓都要填。',
      err_bp_order: '上壓應該大過下壓，請檢查一下。',
      err_hr: '請檢查心跳數字。',
      err_sugar: '請檢查血糖數字（毫摩爾／升，例如 5.6）。',
      err_empty: '請剔選一隻藥，或者最少填一個數字。',
      err_storage: '呢個瀏覽器儲存唔到記錄（可能係私密瀏覽或者關閉咗儲存）。',
      charts: '圖表',
      range: '顯示',
      days7: '7 日', days30: '30 日', days90: '90 日',
      chart_none: '有兩個或以上包含數字嘅記錄之後，就會顯示圖表。',
      chart_label: '{name}：由 {from} 至 {to} 共 {n} 個數字，最低 {min}，最高 {max} {unit}。',
      history: '記錄',
      history_none: '暫時未有記錄。',
      delete_one: '刪除',
      delete_confirm: '要刪除呢個記錄嗎？',
      clear_all: '刪除所有記錄',
      clear_confirm: '要刪除呢個健康記錄入面所有記錄嗎？刪除之後無法還原。',
      yes_delete: '確認刪除', cancel: '取消',
      show_more: '顯示較早記錄',
      summary_title: '健康記錄：最近 14 日',
      summary_note: '由病人喺自己裝置記錄。數字按輸入顯示，中西通冇檢查或者解讀。',
      col_when: '時間', col_bp: '血壓', col_hr: '心跳', col_sugar: '血糖', col_taken: '已服用',
      doctor_tip: '醫生摘要會包括呢個記錄最近 14 日嘅內容。',
      disclaimer: '中西通只提供資訊，唔係醫療建議。如果你擔心某個數字，請聯絡你嘅醫生。'
    }
  };

  var api = { KEY: KEY, LIMITS: LIMITS, WORDS: WORDS, validate: validate, load: load, add: add, remove: remove, clearAll: clearAll, since: since, series: series, axis: axis };
  if (!win) return api;

  /* ---------- browser ---------- */

  function fill(s, vars) { return String(s).replace(/\{(\w+)\}/g, function (m, k) { return vars[k] != null ? vars[k] : m; }); }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function localInput(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + 'T' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()); }
  function stamp(iso, lang) {
    return new Intl.DateTimeFormat(lang === 'zh' ? 'zh-HK' : 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
  }
  function day(ms, lang) { return new Intl.DateTimeFormat(lang === 'zh' ? 'zh-HK' : 'en-GB', { day: 'numeric', month: 'short' }).format(new Date(ms)); }
  function svgEl(tag, attrs) { var n = win.document.createElementNS(SVG, tag); Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); }); return n; }

  /* One line chart. lines: [{key, label, dash?}] */
  function chart(points, lines, title, unit, lang, w) {
    var W = 640, H = 220, L = 46, R = 14, T = 16, B = 30;
    var vals = [];
    points.forEach(function (p) { lines.forEach(function (ln) { if (p.values[ln.key] != null) vals.push(p.values[ln.key]); }); });
    var ax = axis(vals), t0 = points[0].t, t1 = points[points.length - 1].t; if (t0 === t1) { t0 -= 3600000; t1 += 3600000; }
    var x = function (t) { return L + (t - t0) / (t1 - t0) * (W - L - R); };
    var y = function (v) { return T + (ax[1] - v) / (ax[1] - ax[0]) * (H - T - B); };
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'log-chart-svg', role: 'img', focusable: 'false' });
    var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
    svg.setAttribute('aria-label', fill(w.chart_label, { name: title, n: vals.length, from: day(t0, lang), to: day(t1, lang), min: min, max: max, unit: unit }));
    [ax[0], (ax[0] + ax[1]) / 2, ax[1]].forEach(function (v) {
      svg.appendChild(svgEl('line', { x1: L, x2: W - R, y1: y(v), y2: y(v), class: 'log-grid' }));
      var tx = svgEl('text', { x: L - 6, y: y(v) + 4, 'text-anchor': 'end', class: 'log-tick' }); tx.textContent = Math.round(v * 10) / 10; svg.appendChild(tx);
    });
    [[t0, 'start'], [t1, 'end']].forEach(function (p) { var tx = svgEl('text', { x: p[1] === 'start' ? L : W - R, y: H - 8, 'text-anchor': p[1], class: 'log-tick' }); tx.textContent = day(p[0], lang); svg.appendChild(tx); });
    lines.forEach(function (ln, i) {
      var pts = points.filter(function (p) { return p.values[ln.key] != null; });
      if (pts.length > 1) svg.appendChild(svgEl('polyline', { points: pts.map(function (p) { return x(p.t).toFixed(1) + ',' + y(p.values[ln.key]).toFixed(1); }).join(' '), class: 'log-line log-line-' + i + (ln.dash ? ' log-dash' : '') }));
      pts.forEach(function (p) { svg.appendChild(svgEl('circle', { cx: x(p.t).toFixed(1), cy: y(p.values[ln.key]).toFixed(1), r: 4, class: 'log-dot log-dot-' + i })); });
    });
    return svg;
  }

  function chartBlock(el, entries, w, lang) {
    var box = el('div', { class: 'log-charts' });
    var made = 0;
    [[['sys', 'dia'], w.bp, w.mmhg, [{ key: 'sys', label: w.sys }, { key: 'dia', label: w.dia, dash: true }]],
     [['hr'], w.hr, w.bpm, [{ key: 'hr', label: w.hr }]],
     [['sugar'], w.sugar, w.mmol, [{ key: 'sugar', label: w.sugar }]]].forEach(function (c) {
      var pts = series(entries, c[0]);
      if (pts.length < 2) return;
      made++;
      box.appendChild(el('figure', { class: 'log-chart' }, [
        el('figcaption', null, [el('strong', { text: c[1] }), ' ', el('span', { class: 'muted', text: '(' + c[2] + ')' }),
          c[3].length > 1 ? el('span', { class: 'log-legend' }, c[3].map(function (ln, i) { return el('span', { class: 'log-key log-key-' + i, text: ln.label }); })) : null]),
        chart(pts, c[3], c[1], c[2], lang, w)
      ]));
    });
    return made ? box : null;
  }

  function takenNames(entry, db, lang) {
    var out = [];
    (entry.taken && entry.taken.drugs || []).forEach(function (id) { var d = db.drugById[id]; if (d) out.push(lang === 'zh' ? d.name_zh : d.name_en); });
    (entry.taken && entry.taken.herbs || []).forEach(function (id) { var h = db.herbById[id]; if (h) out.push(lang === 'zh' ? h.name_zh : h.name_en); });
    return out.join(', ');
  }
  function bpText(e) { return e.sys != null ? e.sys + '/' + e.dia : '–'; }
  function sugarText(e, w) { return e.sugar != null ? e.sugar + (e.sugar_when ? ' (' + w[e.sugar_when] + ')' : '') : '–'; }

  /* render(app, { el, lang, db, list:{herbs,drugs}, storage? }) */
  function render(app, ctx) {
    var el = ctx.el, lang = ctx.lang === 'zh' ? 'zh' : 'en', w = WORDS[lang], db = ctx.db, storage = ctx.storage || win.localStorage;
    var range = 30, shown = 30, pendingDelete = null, clearAsk = false, notice = null, errors = [];
    var page = el('article', { class: 'health-log' });
    app.appendChild(page);
    draw(true);

    function draw(first) {
      var entries = load(storage);
      page.textContent = '';
      page.appendChild(el('header', { class: 'page-head' }, [
        el('h1', { tabindex: '-1', text: w.title }),
        el('p', { class: 'lede', text: w.lede }),
        el('p', { class: 'muted', text: w.privacy })
      ]));
      page.appendChild(form());
      var charts = el('section', { class: 'log-section', 'aria-labelledby': 'log-charts-h' }, [el('h2', { id: 'log-charts-h', text: w.charts })]);
      var picker = el('div', { class: 'log-range', role: 'group', 'aria-label': w.range }, [7, 30, 90].map(function (d) {
        return el('button', { type: 'button', class: 'btn btn-small ' + (range === d ? 'btn-primary' : 'btn-secondary'), 'aria-pressed': String(range === d), onclick: function () { range = d; draw(); } }, [el('span', { text: w['days' + d] })]);
      }));
      charts.appendChild(picker);
      var block = chartBlock(el, since(entries, range), w, lang);
      charts.appendChild(block || el('p', { class: 'muted', text: w.chart_none }));
      page.appendChild(charts);
      page.appendChild(history(entries));
      page.appendChild(el('p', { class: 'where-tip', text: w.doctor_tip }));
      page.appendChild(el('p', { class: 'disclaimer-box', text: w.disclaimer }));
      if (first !== true && notice) { var n = page.querySelector('.log-notice'); if (n) n.focus(); }
    }

    function form() {
      var known = { herbs: db.herbById, drugs: db.drugById };
      var f = el('form', { class: 'log-section log-form', novalidate: '' });
      var at = el('input', { type: 'datetime-local', id: 'log-at', class: 'log-input', value: localInput(new Date()) });
      var field = function (id, label, unit, attrs) {
        var input = el('input', Object.assign({ id: id, class: 'log-input', inputmode: 'decimal', autocomplete: 'off' }, attrs || {}));
        return { input: input, node: el('div', { class: 'log-field' + (errors.indexOf(id.replace('log-', '')) !== -1 ? ' log-field-error' : '') }, [el('label', { for: id, text: label }), el('div', { class: 'log-unit-row' }, [input, el('span', { class: 'log-unit', text: unit })])]) };
      };
      var sys = field('log-sys', w.sys, w.mmhg, { inputmode: 'numeric' }), dia = field('log-dia', w.dia, w.mmhg, { inputmode: 'numeric' });
      var hr = field('log-hr', w.hr, w.bpm, { inputmode: 'numeric' }), sugar = field('log-sugar', w.sugar, w.mmol);
      var when = el('select', { id: 'log-sugar-when', class: 'log-input' }, SUGAR_WHEN.map(function (k) { return el('option', { value: k, text: w[k] }); }));
      var note = el('input', { id: 'log-note', class: 'log-input', maxlength: '200', autocomplete: 'off' });
      var listIds = [].concat(ctx.list.drugs.map(function (id) { return ['drugs', id]; }), ctx.list.herbs.map(function (id) { return ['herbs', id]; }))
        .filter(function (p) { return known[p[0]][p[1]]; });
      var checks = listIds.map(function (p) {
        var item = known[p[0]][p[1]], box = el('input', { type: 'checkbox', id: 'log-take-' + p[0] + '-' + p[1], 'data-kind': p[0], 'data-id': p[1] });
        return el('label', { class: 'log-take', for: box.id }, [box, el('span', { text: (lang === 'zh' ? item.name_zh : item.name_en) + ' · ' + (lang === 'zh' ? item.name_en : item.name_zh) })]);
      });
      f.appendChild(el('h2', { text: w.new_entry }));
      if (notice) f.appendChild(el('p', { class: 'log-notice' + (notice.error ? ' log-msg-error' : ''), role: notice.error ? 'alert' : 'status', tabindex: '-1', text: notice.text }));
      f.appendChild(el('div', { class: 'log-field' + (errors.indexOf('at') !== -1 ? ' log-field-error' : '') }, [el('label', { for: 'log-at', text: w.when }), at]));
      f.appendChild(el('fieldset', { class: 'log-fieldset' }, [el('legend', { text: w.taken }),
        checks.length ? el('p', { class: 'search-hint', text: w.taken_help }) : el('p', { class: 'search-hint', text: w.taken_empty }),
        checks.length ? el('div', { class: 'log-takes' }, checks) : el('a', { class: 'btn btn-secondary btn-small', href: '#/cabinet', text: w.go_cabinet })]));
      f.appendChild(el('p', { class: 'muted', text: w.optional }));
      f.appendChild(el('fieldset', { class: 'log-fieldset' }, [el('legend', { text: w.bp }), el('div', { class: 'log-pair' }, [sys.node, dia.node])]));
      f.appendChild(hr.node);
      f.appendChild(el('div', { class: 'log-pair' }, [sugar.node, el('div', { class: 'log-field' }, [el('label', { for: 'log-sugar-when', text: w.sugar_when }), when])]));
      f.appendChild(el('div', { class: 'log-field' }, [el('label', { for: 'log-note', text: w.note }), note]));
      f.appendChild(el('button', { type: 'submit', class: 'btn btn-primary log-save' }, [el('span', { text: w.save })]));
      f.addEventListener('submit', function (ev) {
        ev.preventDefault();
        var taken = { herbs: [], drugs: [] };
        Array.prototype.forEach.call(f.querySelectorAll('.log-take input:checked'), function (b) { taken[b.getAttribute('data-kind')].push(b.getAttribute('data-id')); });
        var res = validate({ at: at.value, sys: sys.input.value, dia: dia.input.value, hr: hr.input.value, sugar: sugar.input.value, sugar_when: when.value, note: note.value, taken: taken }, known);
        if (res.errors) { errors = res.errors; notice = { error: true, text: res.errors.map(function (k) { return w['err_' + k]; }).join(' ') }; draw(); return; }
        var ok = add(storage, res.entry);
        errors = []; notice = ok ? { text: w.saved } : { error: true, text: w.err_storage };
        draw();
      });
      return f;
    }

    function history(entries) {
      var sec = el('section', { class: 'log-section', 'aria-labelledby': 'log-history-h' }, [el('h2', { id: 'log-history-h', text: w.history })]);
      if (!entries.length) { sec.appendChild(el('p', { class: 'muted', text: w.history_none })); return sec; }
      var list = el('ul', { class: 'log-history' });
      entries.slice().reverse().slice(0, shown).forEach(function (e) {
        var parts = [];
        if (e.sys != null) parts.push(w.bp + ' ' + bpText(e) + ' ' + w.mmhg);
        if (e.hr != null) parts.push(w.hr + ' ' + e.hr);
        if (e.sugar != null) parts.push(w.sugar + ' ' + sugarText(e, w) + ' ' + w.mmol);
        var taken = takenNames(e, db, lang);
        var row = el('li', { class: 'log-entry' }, [
          el('p', { class: 'log-when', text: stamp(e.at, lang) }),
          parts.length ? el('p', { text: parts.join(' · ') }) : null,
          taken ? el('p', { class: 'muted', text: w.taken + ': ' + taken }) : null,
          e.note ? el('p', { class: 'muted', text: e.note }) : null
        ]);
        if (pendingDelete === e.id) {
          row.appendChild(el('div', { class: 'log-confirm', role: 'group' }, [el('span', { text: w.delete_confirm }),
            el('button', { type: 'button', class: 'btn btn-danger btn-small', onclick: function () { remove(storage, e.id); pendingDelete = null; notice = null; draw(); } }, [el('span', { text: w.yes_delete })]),
            el('button', { type: 'button', class: 'btn btn-secondary btn-small', onclick: function () { pendingDelete = null; draw(); } }, [el('span', { text: w.cancel })])]));
        } else {
          row.appendChild(el('button', { type: 'button', class: 'btn btn-quiet btn-small', 'aria-label': w.delete_one + ' · ' + stamp(e.at, lang), onclick: function () { pendingDelete = e.id; draw(); } }, [el('span', { text: w.delete_one })]));
        }
        list.appendChild(row);
      });
      sec.appendChild(list);
      if (entries.length > shown) sec.appendChild(el('button', { type: 'button', class: 'btn btn-secondary btn-small', onclick: function () { shown += 30; draw(); } }, [el('span', { text: w.show_more })]));
      sec.appendChild(clearAsk
        ? el('div', { class: 'log-confirm', role: 'group' }, [el('span', { text: w.clear_confirm }),
            el('button', { type: 'button', class: 'btn btn-danger btn-small', onclick: function () { clearAll(storage); clearAsk = false; notice = null; draw(); } }, [el('span', { text: w.yes_delete })]),
            el('button', { type: 'button', class: 'btn btn-secondary btn-small', onclick: function () { clearAsk = false; draw(); } }, [el('span', { text: w.cancel })])])
        : el('button', { type: 'button', class: 'btn btn-quiet', onclick: function () { clearAsk = true; draw(); } }, [el('span', { text: w.clear_all })]));
      return sec;
    }
  }

  /* Section for the printed doctor summary: last 14 days, table + charts. Null when there is nothing. */
  function summarySection(ctx) {
    var el = ctx.el, lang = ctx.lang === 'zh' ? 'zh' : 'en', w = WORDS[lang];
    var entries = since(load(ctx.storage || win.localStorage), 14);
    if (!entries.length) return null;
    var rows = entries.slice().reverse().map(function (e) {
      return el('tr', null, [el('td', { text: stamp(e.at, lang) }), el('td', { text: bpText(e) }), el('td', { text: e.hr != null ? String(e.hr) : '–' }), el('td', { text: sugarText(e, w) }), el('td', { text: takenNames(e, ctx.db, lang) || '–' })]);
    });
    return el('section', { class: 'summary-section summary-log', 'aria-labelledby': 'summary-log-h' }, [
      el('h2', { id: 'summary-log-h', text: w.summary_title }),
      el('p', { class: 'muted', text: w.summary_note }),
      chartBlock(el, entries, w, lang),
      el('div', { class: 'log-table-wrap' }, [el('table', { class: 'log-table' }, [
        el('thead', null, [el('tr', null, [w.col_when, w.col_bp + ' (' + w.mmhg + ')', w.col_hr, w.col_sugar + ' (' + w.mmol + ')', w.col_taken].map(function (h) { return el('th', { scope: 'col', text: h }); }))]),
        el('tbody', null, rows)
      ])])
    ]);
  }

  api.render = render;
  api.summarySection = summarySection;
  api.words = function (lang) { return WORDS[lang === 'zh' ? 'zh' : 'en']; };
  return api;
});
