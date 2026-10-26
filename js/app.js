/*
 * HerbBridge app: cabinet dashboard, picker sheets, results cards and routing.
 * All medical content comes from data/*.json via js/lookup.js. Nothing is generated.
 * Data text is always inserted with textContent, never as HTML.
 */
(function () {
  'use strict';

  var L = window.HerbBridgeLookup;
  var I = window.HerbBridgeI18n;
  var t = I.t;
  var STORAGE_KEY = 'herbsafe.v1';

  var db = null;
  var drugGroups = [];   // condition headings for the medicine picker, from data/drugs.json
  var state = { herbs: [], drugs: [], lang: 'en', demo: false };
  // Display mode: "simple" (default, for older users) or "full". Kept on this device only.
  var MODE_KEY = 'herbsafe.mode';
  var mode = 'simple';
  try { var savedMode = localStorage.getItem(MODE_KEY); if (savedMode === 'full' || savedMode === 'simple') mode = savedMode; } catch (e) { /* default */ }
  document.documentElement.setAttribute('data-mode', mode);
  var app = document.getElementById('app');

  /* ---------- small helpers ---------- */

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'class') node.className = v;
      else if (k === 'text') node.textContent = v;
      else if (k.indexOf('on') === 0) node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v === true ? '' : v);
    });
    (children || []).forEach(function (c) {
      if (c == null || c === false) return;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }

  // Static icon markup only (never data). aria-hidden: the text label always carries the meaning.
  var ICONS = {
    high: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 3 2 21h20L12 3z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><path d="M12 10v5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="18" r="1.3" fill="currentColor"/></svg>',
    moderate: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M12 7v6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="16.5" r="1.3" fill="currentColor"/></svg>',
    low: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="12" cy="7.6" r="1.3" fill="currentColor"/><path d="M12 11v6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
    none_reported: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M7.5 12h9" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
    not_in_database: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="3 2.6"/><path d="M9.4 9.3a2.7 2.7 0 1 1 3.8 2.5c-.8.4-1.2 1-1.2 1.8v.4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="17.2" r="1.2" fill="currentColor"/></svg>',
    official: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 2.8 4.5 5.6v5.6c0 4.6 3.1 8.6 7.5 10 4.4-1.4 7.5-5.4 7.5-10V5.6L12 2.8z" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linejoin="round"/><path d="M12 8v5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="16.2" r="1.25" fill="currentColor"/></svg>',
    speaker: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    leaf: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14M5 19l7-7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    pill: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3.5" y="8.5" width="17" height="7" rx="3.5" transform="rotate(-35 12 12)" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m9.6 8.6 4.8 6.8" stroke="currentColor" stroke-width="1.8"/></svg>',
    back: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    heart: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 20.5s-7.5-4.6-9.2-9.4C1.6 7.6 3.9 4.5 7.2 4.5c2 0 3.6 1.1 4.8 2.8 1.2-1.7 2.8-2.8 4.8-2.8 3.3 0 5.6 3.1 4.4 6.6-1.7 4.8-9.2 9.4-9.2 9.4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 7l10 10M17 7 7 17" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
    plus: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 6v12M6 12h12" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
    tick: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5.5 12.5l4 4 9-9" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    chevron: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 12h13M13 6.5 18.5 12 13 17.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    home: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3.5 11 12 4l8.5 7M6 9.5V20h4.5v-5.5h3V20H18V9.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    view_simple: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="4" y="4" width="16" height="16" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 12h8" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
    view_full: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="4" y="4" width="16" height="16" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 9h8M8 12h8M8 15h5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    external: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };
  function icon(name, cls) {
    var span = el('span', { class: 'icon ' + (cls || '') });
    span.innerHTML = ICONS[name];
    return span;
  }

  function primaryName(item) { return state.lang === 'zh' ? item.name_zh : item.name_en; }
  function secondaryName(item) { return state.lang === 'zh' ? item.name_en : item.name_zh; }
  // Medicines whose Chinese name is not yet checked (zh_name_with_en, owner 26 Oct) always show the
  // English name next to it in Chinese; the HA leaflets for the newer blood thinners use English only.
  function withEnglish(item) { return state.lang === 'zh' && item.zh_name_with_en === true; }
  function shownName(item) { return withEnglish(item) ? item.name_zh + ' ' + item.name_en : primaryName(item); }
  function nameNode(item) {
    return el('span', { class: 'name' }, [
      el('span', { class: 'name-primary', text: primaryName(item), lang: state.lang === 'zh' ? 'zh-HK' : 'en-GB' }),
      ' ',
      el('span', { class: 'name-secondary', text: secondaryName(item), lang: state.lang === 'zh' ? 'en-GB' : 'zh-HK' })
    ]);
  }
  // "Label: " in English, "標籤：" (full-width colon) in Chinese.
  function labelText(key) { return t(key) + (state.lang === 'zh' ? '：' : ': '); }
  function field(entry, base) {
    var zh = entry[base + '_zh'];
    return state.lang === 'zh' && zh ? withEnglishNames(zh) : entry[base + '_en'];
  }
  // On screen only (Read aloud keeps the Chinese): the first mention of a medicine marked
  // zh_name_with_en inside a Chinese sentence gets its English name, e.g. 利伐沙班 Rivaroxaban.
  // 達比加群酯 is EMA's "dabigatran etexilate". Never used on an agency's own Chinese original.
  var EXTRA_EN = { '達比加群酯': 'Dabigatran etexilate' };
  var namesInText = null;
  function withEnglishNames(text) {
    if (!namesInText) {
      var pairs = {};
      db.drugs.forEach(function (d) { if (d.zh_name_with_en === true) pairs[d.name_zh] = d.name_en; });
      Object.keys(EXTRA_EN).forEach(function (k) { pairs[k] = EXTRA_EN[k]; });
      var keys = Object.keys(pairs).sort(function (x, y) { return y.length - x.length; }); // 單硝酸異山梨酯 before 硝酸異山梨酯
      namesInText = { pairs: pairs, re: keys.length ? new RegExp(keys.join('|'), 'g') : null };
    }
    if (!namesInText.re || !text) return text;
    var done = {};
    return text.replace(namesInText.re, function (m, at, all) {
      var en = namesInText.pairs[m];
      if (done[m] || all.slice(at + m.length, at + m.length + en.length + 1) === ' ' + en) { done[m] = true; return m; }
      done[m] = true;
      // A space after the English too when Chinese follows (Rivaroxaban 喺, not Rivaroxaban喺).
      return m + ' ' + en + (/^[\u3400-\u9fff]/.test(all.charAt(at + m.length)) ? ' ' : '');
    });
  }
  // An official quote in Chinese: our translation gets the English names; the agency's own Chinese is word for word.
  function quoteZh(s) { return s.quote_zh_is_original ? s.quote_zh : withEnglishNames(s.quote_zh); }

  /* ---------- storage (this device only) ---------- */

  function load() {
    try {
      var saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (saved && typeof saved === 'object') {
        state.herbs = cleanIds(saved.herbs, db.herbById);
        state.drugs = cleanIds(saved.drugs, db.drugById);
        if (I.languages.indexOf(saved.lang) !== -1) state.lang = saved.lang;
        state.demo = saved.demo === true;
        if (state.demo && saved.demoBackup && typeof saved.demoBackup === 'object') {
          state.demoBackup = { herbs: cleanIds(saved.demoBackup.herbs, db.herbById), drugs: cleanIds(saved.demoBackup.drugs, db.drugById) };
        }
      }
    } catch (e) { /* private mode or blocked storage: start empty */ }
  }
  // Known ids only, each once (old or hand-edited saved lists can contain anything).
  function cleanIds(list, byId) {
    if (!Array.isArray(list)) return [];
    return list.filter(function (id, i) { return typeof id === 'string' && byId[id] && list.indexOf(id) === i; });
  }

  var storageOk = true;
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); storageOk = true; }
    catch (e) { storageOk = false; /* private mode or blocked storage: the cabinet says so */ }
    return storageOk;
  }

  function toggle(kind, id) {
    var list = state[kind];
    var i = list.indexOf(id);
    if (i === -1) list.push(id); else list.splice(i, 1);
    save();
    return i === -1;
  }

  /* Rated pairs (High, Moderate or Low) between one item and the rest of the cabinet. */
  function clashesFor(kind, id) {
    var rows = kind === 'herbs' ? L.checkPairs(db, [id], state.drugs) : L.checkPairs(db, state.herbs, [id]);
    return rows.filter(isFlagged);
  }

  // A pair to discuss: a team rating of High, Moderate or Low, or an official caution.
  function isFlagged(r) { return r.status !== 'none_reported' && r.status !== L.NOT_IN_DATABASE; }
  function badgeFor(r, tag) {
    return badge(r.status, r.entry && r.entry.watch, tag, r.official && r.official.kind === 'disagree');
  }
  function riskLabel(r) {
    if (r.status === L.OFFICIAL) return t(r.official.kind === 'disagree' ? 'risk_official_disagree' : 'risk_official');
    return t(r.status === 'low' && r.entry.watch ? 'risk_low_watch' : 'risk_' + r.status);
  }

  /* Warnings for clashes found while adding items. They build up until the user closes them,
     each pair keeps its own rating, and they are not saved. */
  var alertState = null;
  function pairKey(r) { return r.herb.id + '|' + r.drug.id; }

  function addOrRemove(kind, id, sourceEl) {
    // In the picker sheet the list never moves; on the dashboard, keep the tapped spot under the finger.
    var inSheet = !!(sourceEl && sourceEl.closest && sourceEl.closest('.sheet'));
    var anchorKey = !inSheet && sourceEl ? sourceEl.getAttribute('data-key') : null;
    var anchorTop = anchorKey ? sourceEl.getBoundingClientRect().top : null;
    // Removing a chip: the chip disappears, so the card it sat in is the anchor instead.
    var removing = !inSheet && state[kind].indexOf(id) !== -1 && cards[kind];
    var index = removing ? state[kind].indexOf(id) : -1;
    var cardTop = removing ? cards[kind].getBoundingClientRect().top : null;
    var added = toggle(kind, id);
    if (added) {
      var clashes = clashesFor(kind, id);
      if (clashes.length) {
        var rows = (alertState ? alertState.rows : []).slice();
        var known = {};
        rows.forEach(function (r) { known[pairKey(r)] = true; });
        clashes.forEach(function (r) { if (!known[pairKey(r)]) rows.push(r); });
        rows.sort(function (a, b) { return L.STATUS_ORDER.indexOf(a.status) - L.STATUS_ORDER.indexOf(b.status); });
        alertState = { rows: rows };
        announce(clashes);
      }
    } else if (alertState) {
      // Drop warnings about pairs that are no longer both in the cabinet.
      alertState.rows = alertState.rows.filter(function (r) {
        return state.herbs.indexOf(r.herb.id) !== -1 && state.drugs.indexOf(r.drug.id) !== -1;
      });
      if (!alertState.rows.length) alertState = null;
    }
    refreshCheck();
    if (removing) {
      // No jump: the card stays where it was on screen. Focus: the next item, else the one before,
      // else the list heading (screen readers then hear where they are).
      window.scrollBy(0, cards[kind].getBoundingClientRect().top - cardTop);
      var ids = state[kind];
      var nextId = ids[index] || ids[index - 1];
      var target = nextId ? findByKey('chip-' + kind + '-' + nextId) : document.getElementById('h-' + kind);
      if (target) target.focus({ preventScroll: true });
    } else if (anchorKey) {
      var again = findByKey(anchorKey);
      if (again) window.scrollBy(0, again.getBoundingClientRect().top - anchorTop);
    }
    return added;
  }

  function findByKey(key) {
    var target = document.querySelector('[data-key="' + key + '"]');
    // A removed chip disappears: use the Add button of the same card instead.
    if (!target && key.indexOf('chip-') === 0) target = document.querySelector('[data-key="add-' + key.split('-')[1] + '"]');
    return target;
  }

  /* Short spoken message for screen readers when new clashes appear (once, not on every redraw). */
  function announce(rows) {
    var live = document.getElementById('sr-alert');
    if (!live) return;
    live.textContent = '';
    rows = rows.slice().sort(function (a, b) { return L.STATUS_ORDER.indexOf(a.status) - L.STATUS_ORDER.indexOf(b.status); });
    var msg = rows.map(function (r) {
      return t('warn_sr', { herb: primaryName(r.herb), drug: shownName(r.drug), risk: riskLabel(r) });
    }).join(' ');
    window.setTimeout(function () { live.textContent = msg; }, 50);
  }

  /* ---------- Check screen: a calm dashboard ----------
     Status tile (what needs attention) → two cards (herbs, medicines) with chips and "+ Add".
     "+ Add" opens a full-screen picker sheet: search, one big list, Done. */

  var queries = { herbs: '', drugs: '' };
  var cards = {};
  var statusTile = null;
  var demoBox = null;
  var warningPanel = null;
  var checkBar = null;
  var sheet = null;

  function refreshCheck() {
    var active = document.activeElement;
    var key = active && active.getAttribute ? active.getAttribute('data-key') : null;
    renderCard('herbs');
    renderCard('drugs');
    renderDemo();
    renderStatus();
    renderWarning();
    updateCheckBar();
    renderSheet();
    if (key) {
      var target = findByKey(key);
      if (target && target !== document.activeElement) target.focus({ preventScroll: true });
    }
  }

  /* Demo for the video: Mr Wong already takes warfarin and amlodipine; danshen is added on camera.
     The user's own list is put aside and comes back when the demo ends. */
  function startDemo() {
    if (!state.demo) state.demoBackup = { herbs: state.herbs.slice(), drugs: state.drugs.slice() };
    state.herbs = []; state.drugs = ['warfarin', 'amlodipine']; state.demo = true; alertState = null;
    save(); render(true);
  }

  function endDemo() {
    var backup = state.demoBackup || { herbs: [], drugs: [] };
    state.herbs = backup.herbs; state.drugs = backup.drugs;
    state.demo = false; delete state.demoBackup; alertState = null;
    save(); render(true);
  }

  function renderDemo() {
    if (!demoBox) return;
    demoBox.textContent = '';
    demoBox.hidden = !state.demo;
    if (!state.demo) return;
    var hasDanshen = state.herbs.indexOf('danshen') !== -1;
    demoBox.appendChild(el('h2', { id: 'h-demo', text: t('demo_title') }));
    demoBox.appendChild(el('p', { text: t('demo_story') }));
    demoBox.appendChild(el('div', { class: 'demo-actions' }, [
      hasDanshen ? null : el('button', {
        type: 'button', class: 'btn btn-primary btn-small',
        onclick: function () {
          if (state.herbs.indexOf('danshen') === -1) addOrRemove('herbs', 'danshen');
          showWarning();
        }
      }, [icon('plus'), el('span', { text: t('demo_add') })]),
      el('button', { type: 'button', class: 'btn btn-quiet btn-small', onclick: endDemo }, [el('span', { text: t('demo_end') })])
    ]));
  }

  function pairText(r) {
    return el('span', { class: 'clash-pair' }, [
      el('span', { text: primaryName(r.herb) }), ' ', el('span', { class: 'pair-plus', 'aria-hidden': 'true', text: '+' }), ' ',
      el('span', { class: 'visually-hidden', text: t('and_sr') + ' ' }), el('span', { text: shownName(r.drug) })
    ]);
  }

  /* Status tile: one sentence saying what needs attention, then the pairs behind it. */
  function renderStatus() {
    if (!statusTile) return;
    statusTile.textContent = '';
    var nH = state.herbs.length, nD = state.drugs.length;
    var tone = 'neutral', title, rest = [];

    if (!nH || !nD) {
      // One step at a time, with one big button: herbs first, then medicines.
      var kind = nH ? 'drugs' : 'herbs';
      title = t(kind === 'herbs' ? 'step_herbs' : 'step_drugs');
      rest.push(el('button', {
        type: 'button', class: 'btn btn-primary btn-step', 'data-key': 'step-' + kind, 'aria-haspopup': 'dialog',
        onclick: function () { openSheet(kind, true); }
      }, [icon('plus'), el('span', { text: t(kind === 'herbs' ? 'step_add_herb' : 'step_add_drug') })]));
      rest.push(el('p', { class: 'step-then', text: t('step_then') }));
    } else {
      var rows = L.checkPairs(db, state.herbs, state.drugs);
      var flagged = rows.filter(isFlagged);
      var unknown = rows.filter(function (r) { return r.status === L.NOT_IN_DATABASE; }).length;
      if (flagged.length) {
        tone = flagged[0].status;
        title = I.tn('cabinet_clashes', flagged.length);
        var list = el('ul', { class: 'status-list' });
        flagged.forEach(function (r) {
          list.appendChild(el('li', null, [
            el('a', { class: 'status-row', href: pairHref(r) }, [
              badgeFor(r, 'span'), pairText(r), icon('chevron', 'row-go')
            ])
          ]));
        });
        rest.push(list);
      } else {
        title = t('cabinet_no_rated');
      }
      if (unknown) rest.push(el('p', { class: 'status-unknown' }, [icon('not_in_database'), el('span', { text: I.tn('cabinet_unknown', unknown) })]));
      rest.push(el('a', { class: 'btn btn-secondary btn-small status-more', href: '#/results' }, [el('span', { text: t('cabinet_see_all') }), icon('arrow')]));
    }

    // Ready (both lists filled): Simple mode hides this card, unless it warns that the list cannot be saved.
    statusTile.className = 'status status-' + tone + (nH && nD && storageOk ? ' status-ready' : '');
    statusTile.appendChild(el('div', { class: 'status-head' }, [
      tone === 'neutral' ? null : icon(tone, 'status-icon tone-' + tone),
      el('h2', { id: 'h-status', tabindex: '-1', text: title })
    ]));
    rest.forEach(function (node) { statusTile.appendChild(node); });
    if (!storageOk) statusTile.appendChild(el('p', { class: 'storage-off', role: 'status', text: t('storage_off') }));
  }

  /* One card per kind: what is in the cabinet (tap a chip to remove it) and a big "+ Add". */
  function renderCard(kind) {
    var box = cards[kind];
    if (!box) return;
    var byId = kind === 'herbs' ? db.herbById : db.drugById;
    var ids = state[kind];
    box.textContent = '';
    box.appendChild(el('div', { class: 'cab-head' }, [
      el('h2', { id: 'h-' + kind, tabindex: '-1', text: t(kind === 'herbs' ? 'summary_herbs' : 'summary_drugs') }),
      el('p', { class: 'cab-count', text: ids.length ? t('selected_count', { n: ids.length }) : t('selected_none') })
    ]));
    if (ids.length) {
      var chips = el('ul', { class: 'chips', 'aria-labelledby': 'h-' + kind });
      ids.forEach(function (id) {
        var item = byId[id];
        chips.appendChild(el('li', null, [
          el('button', {
            type: 'button', class: 'chip', 'data-key': 'chip-' + kind + '-' + id,
            'aria-label': t('remove_item', { name: primaryName(item) + ' ' + secondaryName(item) }),
            onclick: function (ev) { addOrRemove(kind, id, ev.currentTarget); }
          }, [nameNode(item), icon('close', 'chip-x')])
        ]));
      });
      box.appendChild(chips);
    }
    box.appendChild(el('button', {
      type: 'button', class: 'btn btn-add', 'data-key': 'add-' + kind, 'aria-haspopup': 'dialog',
      onclick: function () { openSheet(kind); }
    }, [icon('plus'), el('span', { text: t(kind === 'herbs' ? 'add_herbs' : 'add_drugs') })]));
  }

  /* ---------- Picker sheet (full screen on phones) ---------- */

  var skipPop = false;

  function openSheet(kind, fromStep) {
    if (sheet) closeSheet(true);
    var input = el('input', {
      id: 'sheet-search', class: 'search', type: 'search', autocomplete: 'off', autocapitalize: 'off',
      spellcheck: 'false', enterkeyhint: 'search', 'aria-controls': 'sheet-options', 'aria-describedby': 'sheet-hint'
    });
    input.value = queries[kind];
    var count = el('p', { class: 'sheet-count' });
    var list = el('ul', { class: 'options', id: 'sheet-options', 'aria-labelledby': 'sheet-title' });
    var notice = el('button', { type: 'button', class: 'bar-notice', hidden: true, onclick: function () { closeSheet(); showWarning(); } });
    var done = el('button', { type: 'button', class: 'btn btn-primary btn-done', onclick: function () { closeSheet(); } }, [el('span', { text: t('done') })]);
    var body = el('div', { class: 'sheet-body' }, [
      el('div', { class: 'sheet-head' }, [
        el('h2', { id: 'sheet-title', tabindex: '-1', text: t(kind === 'herbs' ? 'herbs_title' : 'drugs_title') }),
        count
      ]),
      el('label', { class: 'search-label', for: 'sheet-search', text: t(kind === 'herbs' ? 'search_herbs' : 'search_drugs') }),
      el('p', { class: 'search-hint', id: 'sheet-hint', text: t('search_hint') }),
      input,
      list,
      el('p', { class: 'where-tip', text: t(kind === 'herbs' ? 'where_herbs' : 'where_drugs') })
    ]);
    var root = el('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'sheet-title', lang: state.lang === 'zh' ? 'zh-HK' : 'en-GB' }, [
      el('div', { class: 'sheet-panel' }, [body, el('div', { class: 'sheet-foot' }, [notice, done])])
    ]);
    root.addEventListener('keydown', sheetKeys);
    root.addEventListener('click', function (ev) { if (ev.target === root) closeSheet(); });
    input.addEventListener('input', function () { queries[kind] = input.value; renderSheetList(); });

    sheet = { kind: kind, root: root, list: list, count: count, notice: notice, fromStep: fromStep === true };
    document.body.appendChild(root);
    setBackground(true);
    renderSheet();
    // The phone's Back button closes the sheet instead of leaving the page.
    try { history.pushState({ hsSheet: true }, ''); sheet.pushed = true; } catch (e) { /* ignore */ }
    document.getElementById('sheet-title').focus();
  }

  function closeSheet(fromHistory) {
    if (!sheet) return;
    var s = sheet;
    sheet = null;
    if (s.root.parentNode) s.root.parentNode.removeChild(s.root);
    setBackground(false);
    if (s.pushed && !fromHistory) { skipPop = true; history.back(); }
    // Opened from a step: go on to the next step, or to the result once both are chosen.
    var back = s.fromStep
      ? document.querySelector('[data-key^="step-"]') || document.getElementById('h-status')
      : document.querySelector('[data-key="add-' + s.kind + '"]');
    if (back) back.focus();
  }

  window.addEventListener('popstate', function () {
    if (skipPop) { skipPop = false; return; }
    if (sheet) closeSheet(true);
  });

  // Everything behind the sheet is out of reach for keyboard and screen readers while it is open.
  function setBackground(open) {
    ['.skip-link', '.site-header', '#main', '.site-footer'].forEach(function (sel) {
      var node = document.querySelector(sel);
      if (!node) return;
      if (open) { node.setAttribute('inert', ''); node.setAttribute('aria-hidden', 'true'); }
      else { node.removeAttribute('inert'); node.removeAttribute('aria-hidden'); }
    });
    document.documentElement.classList.toggle('sheet-open', open);
  }

  function sheetKeys(ev) {
    if (!sheet) return;
    if (ev.key === 'Escape') { ev.preventDefault(); closeSheet(); return; }
    if (ev.key !== 'Tab') return;
    var focusable = Array.prototype.filter.call(sheet.root.querySelectorAll('button, input, a[href]'), function (n) {
      return !n.disabled && n.offsetParent !== null;
    });
    if (!focusable.length) return;
    var first = focusable[0], last = focusable[focusable.length - 1], now = document.activeElement;
    if (ev.shiftKey && (now === first || now.id === 'sheet-title')) { ev.preventDefault(); last.focus(); }
    else if (!ev.shiftKey && now === last) { ev.preventDefault(); first.focus(); }
  }

  function renderSheet() {
    if (!sheet) return;
    var n = state[sheet.kind].length;
    sheet.count.textContent = n ? t('selected_count', { n: n }) : t('selected_none');
    renderSheetList();
    sheet.notice.hidden = !alertState;
    sheet.notice.textContent = '';
    if (alertState) {
      var top = alertState.rows[0];
      sheet.notice.appendChild(badgeFor(top, 'span'));
      sheet.notice.appendChild(el('span', { class: 'bar-notice-text', text: I.tn('bar_notice', alertState.rows.length) }));
    }
  }

  function groupName(id) {
    var g = drugGroups.filter(function (x) { return x.id === id; })[0];
    return g ? (state.lang === 'zh' ? g.name_zh : g.name_en) : '';
  }

  // One row in the picker: the name, an optional second line, and the Add / Added state.
  function optionButton(kind, item, sub) {
    var on = state[kind].indexOf(item.id) !== -1;
    return el('li', null, [
      el('button', {
        type: 'button', class: 'option' + (on ? ' is-on' : ''), 'aria-pressed': on ? 'true' : 'false',
        'data-key': 'opt-' + kind + '-' + item.id,
        onclick: function (ev) { addOrRemove(kind, item.id, ev.currentTarget); }
      }, [
        el('span', { class: 'option-text' }, [nameNode(item), sub ? el('span', { class: 'option-sub', text: sub }) : null]),
        el('span', { class: 'option-state', 'aria-hidden': 'true' }, [icon(on ? 'tick' : 'plus'), el('span', { text: on ? t('added') : t('add') })])
      ])
    ]);
  }

  function herbSub(item) {
    var used = state.lang === 'zh' ? item.used_for_zh : item.used_for_en;
    return used ? t('used_for', { x: used }) : '';
  }

  function renderSheetList() {
    if (!sheet) return;
    var kind = sheet.kind, query = queries[kind], list = sheet.list;
    list.textContent = '';
    var found = L.search(kind === 'herbs' ? db.herbs : db.drugs, query);
    if (!found.length) {
      list.appendChild(el('li', { class: 'no-match', text: t('no_matches', { q: query }) }));
      return;
    }
    if (kind === 'herbs') {
      found.forEach(function (item) { list.appendChild(optionButton(kind, item, herbSub(item))); });
      return;
    }
    // Medicines: grouped under condition headings when browsing; while searching, a flat list
    // (best match first) with each medicine's group shown under its name.
    if (normaliseQuery(query) || !drugGroups.length) {
      found.forEach(function (item) { list.appendChild(optionButton(kind, item, groupName(item.group))); });
      return;
    }
    drugGroups.forEach(function (g) {
      var items = found.filter(function (item) { return item.group === g.id; });
      if (!items.length) return;
      var inner = el('ul', { class: 'options option-group-list', 'aria-labelledby': 'og-' + g.id });
      items.forEach(function (item) { inner.appendChild(optionButton(kind, item, '')); });
      list.appendChild(el('li', { class: 'option-group' }, [
        el('h3', { class: 'option-group-head', id: 'og-' + g.id, text: groupName(g.id) }),
        inner
      ]));
    });
    // Anything without a known group still appears, at the end.
    var rest = found.filter(function (item) { return !drugGroups.some(function (g) { return g.id === item.group; }); });
    rest.forEach(function (item) { list.appendChild(optionButton(kind, item, '')); });
  }

  function normaliseQuery(q) { return L.normalise(q || ''); }

  /* ---------- clash warning (builds up until closed) ---------- */

  function renderWarning() {
    if (!warningPanel) return;
    warningPanel.textContent = '';
    warningPanel.hidden = !alertState;
    if (!alertState) return;
    var list = el('ul', { class: 'warning-list' });
    alertState.rows.forEach(function (r) {
      list.appendChild(el('li', { class: 'clash-row' }, [badgeFor(r, 'span'), pairText(r)]));
    });
    warningPanel.appendChild(el('h2', { id: 'h-warning', text: I.tn('warn_title', alertState.rows.length) }));
    warningPanel.appendChild(list);
    warningPanel.appendChild(el('div', { class: 'alert-actions' }, [
      el('a', { class: 'btn btn-primary btn-small', href: '#/results', text: t('alert_details') }),
      el('button', {
        type: 'button', class: 'btn btn-secondary btn-small',
        onclick: function () {
          alertState = null; renderWarning(); updateCheckBar();
          var h = document.getElementById('h-status');
          if (h) h.focus();
        }
      }, [el('span', { text: t('alert_dismiss') })])
    ]));
  }

  function showWarning() {
    if (!warningPanel || warningPanel.hidden) return;
    warningPanel.scrollIntoView({ block: 'start', behavior: 'smooth' });
    warningPanel.focus({ preventScroll: true });
  }

  function updateCheckBar() {
    if (!checkBar) return;
    checkBar.notice.hidden = !alertState;
    if (alertState) {
      var top = alertState.rows[0];
      checkBar.notice.textContent = '';
      checkBar.notice.appendChild(icon(top.status));
      checkBar.notice.appendChild(el('span', { class: 'bar-notice-text', text: I.tn('bar_notice', alertState.rows.length) }));
    }
    var ready = state.herbs.length > 0 && state.drugs.length > 0;
    if (checkBar.bar) checkBar.bar.hidden = !ready && !alertState;
    checkBar.button.disabled = !ready;
    checkBar.button.setAttribute('aria-describedby', 'check-status');
    checkBar.status.textContent = ready
      ? I.tn('count_herbs', state.herbs.length) + ' · ' + I.tn('count_drugs', state.drugs.length)
      : t('check_need_both');
    fitCheckBar();
  }

  // With very large text the sticky bar would cover too much of the screen: then it simply sits in the page.
  function fitCheckBar() {
    if (!checkBar || !checkBar.bar) return;
    var bar = checkBar.bar;
    bar.classList.remove('is-static');
    if (bar.offsetHeight > window.innerHeight * 0.28) bar.classList.add('is-static');
    // Scrolling (and focus) keeps everything clear of the bar: the bottom padding equals its height.
    var h = bar.classList.contains('is-static') || bar.hidden ? 0 : bar.offsetHeight;
    document.documentElement.style.setProperty('--check-bar-h', h + 'px');
  }
  window.addEventListener('resize', fitCheckBar);

  function renderCheck() {
    var status = el('p', { id: 'check-status', class: 'check-status' });
    var button = el('button', {
      type: 'button', class: 'btn btn-primary btn-check',
      onclick: function () { if (!button.disabled) location.hash = '#/results'; }
    }, [el('span', { text: t('check_button') }), icon('arrow')]);
    var notice = el('button', { type: 'button', class: 'bar-notice', hidden: true, onclick: showWarning });
    checkBar = { button: button, status: status, notice: notice };

    var clearBox = el('div', { class: 'clear-box' });
    function showClear(asking) {
      clearBox.textContent = '';
      if (!asking) {
        clearBox.appendChild(el('button', {
          type: 'button', class: 'btn btn-quiet',
          onclick: function () { if (state.herbs.length || state.drugs.length) showClear(true); }
        }, [el('span', { text: t('clear_all') })]));
        return;
      }
      clearBox.appendChild(el('p', { class: 'clear-question', role: 'status', text: t('clear_confirm') }));
      var yes = el('button', {
        type: 'button', class: 'btn btn-danger btn-small',
        onclick: function () {
          state.herbs = []; state.drugs = []; state.demo = false; delete state.demoBackup; alertState = null;
          queries = { herbs: '', drugs: '' };
          save(); render(true);
        }
      }, [el('span', { text: t('clear_yes') })]);
      clearBox.appendChild(el('div', { class: 'clear-actions' }, [
        yes,
        el('button', { type: 'button', class: 'btn btn-secondary btn-small', onclick: function () { showClear(false); clearBox.querySelector('button').focus(); } }, [el('span', { text: t('clear_cancel') })])
      ]));
      yes.focus();
    }
    showClear(false);
    var clear = clearBox;

    app.textContent = '';
    demoBox = el('section', { class: 'demo-banner', 'aria-labelledby': 'h-demo', hidden: true });
    warningPanel = el('section', { class: 'clash-alert', tabindex: '-1', 'aria-labelledby': 'h-warning', hidden: true });
    statusTile = el('section', { class: 'status', 'aria-labelledby': 'h-status' });
    cards = {
      herbs: el('section', { class: 'cab-card', 'aria-labelledby': 'h-herbs' }),
      drugs: el('section', { class: 'cab-card', 'aria-labelledby': 'h-drugs' })
    };
    app.appendChild(el('div', { class: 'dash' }, [
      el('div', { class: 'dash-main' }, [
        el('header', { class: 'page-head' }, [
          el('h1', { tabindex: '-1', text: t('cabinet_title') }),
          state.demo ? null : el('button', { type: 'button', class: 'btn btn-secondary btn-small demo-start demo-top', onclick: startDemo }, [el('span', { text: t('demo_button') })]),
          el('p', { class: 'subtitle', text: t('cabinet_for') }),
          el('p', { class: 'lede', text: t('cabinet_lede') })
        ]),
        demoBox, warningPanel, statusTile
      ]),
      el('div', { class: 'dash-side' }, [cards.herbs, cards.drugs])
    ]));
    checkBar.bar = el('div', { class: 'check-bar' }, [
      el('div', { class: 'check-bar-inner' }, [notice, status, button])
    ]);
    app.appendChild(checkBar.bar);
    app.appendChild(el('div', { class: 'below-bar' }, [clear]));
    renderCard('herbs');
    renderCard('drugs');
    renderDemo();
    renderStatus();
    renderWarning();
    updateCheckBar();
  }

  /* ---------- Results screen: grouped by level, each card opens for details ---------- */

  var openCards = {};     // pair key → true while that card is open (kept across language switches)

  function badge(status, watch, tag, disagree) {
    var key = status === 'low' && watch ? 'risk_low_watch'
      : status === 'official' && disagree ? 'risk_official_disagree' : 'risk_' + status;
    return el(tag || 'p', { class: 'badge badge-' + status }, [icon(status), el('span', { text: t(key) })]);
  }

  function pairTitle(r) {
    return el('h3', { class: 'pair', tabindex: '-1' }, [
      nameNode(r.herb),
      ' ', el('span', { class: 'pair-plus', 'aria-hidden': 'true', text: '+' }), ' ',
      el('span', { class: 'visually-hidden', text: ' ' + t('and_sr') + ' ' }),
      nameNode(r.drug)
    ]);
  }

  // One plain-language line explaining a level (app wording; the card's own advice is in "What to do").
  function levelMeaning(status) {
    return el('p', { class: 'level-meaning level-' + status, text: t('level_' + status) });
  }

  function sourceLink(s) {
    var zh = state.lang === 'zh';
    return el('a', { href: zh && s.url_zh ? s.url_zh : s.url, target: '_blank', rel: 'noopener noreferrer' }, [
      el('span', { text: zh && s.label_zh ? s.label_zh : s.label }), icon('external', 'ext'),
      el('span', { class: 'visually-hidden', text: ' ' + t('opens_new_tab') })
    ]);
  }

  function block(label, content, cls) {
    return el('div', { class: 'block ' + (cls || '') }, [el('h4', { class: 'block-label', text: label })].concat(content));
  }

  // The required disclaimer, word for word, then the prototype notice (owner, 18 Oct).
  // On a card a pharmacist has reviewed (and that has not changed since), the review replaces the notice.
  function disclaimerText(r) {
    var rv = r && r.review;
    if (rv) {
      var zh = state.lang === 'zh';
      return [t('card_disclaimer'), ' ', el('strong', { class: 'reviewed-note', text: t('reviewed_note', {
        name: zh ? rv.reviewer_zh : rv.reviewer_en, role: zh ? rv.role_zh : rv.role_en, date: formatDate(new Date(rv.date + 'T00:00:00')) }) })];
    }
    return [t('card_disclaimer'), ' ', el('strong', { class: 'prototype-note', text: t('prototype_note') })];
  }

  /* General Hospital Authority advice from a leaflet for a GROUP of medicines: quoted exactly (each
     language as the HA wrote it), with the leaflet's own S/N and date. Not a rating. */
  function adviceBlock(adv, drugs) {
    var zh = state.lang === 'zh';
    var names = drugs.map(shownName).join(t('list_sep'));
    return el('div', { class: 'advice-box' }, [
      el('h4', { class: 'advice-title', text: adv.single_drug ? t('advice_title_single', { drugs: names }) : t('advice_title', { group: zh ? adv.group_zh : adv.group_en, drugs: names }) }),
      el('blockquote', { class: 'advice-quote', lang: zh ? 'zh-HK' : 'en-GB', text: '“' + (zh ? adv.quote_zh : adv.quote_en) + '”' }),
      zh ? el('p', { class: 'official-original' }, [
        el('span', { text: t('official_zh_original_note') + ' ' }), el('span', { lang: 'en-GB', text: '“' + adv.quote_en + '”' })
      ]) : null,
      el('p', { class: 'official-source' }, [
        el('span', { class: 'official-body', text: zh ? adv.body_zh + '：' : adv.body_en + ': ' }),
        sourceLink({ url: zh ? adv.url_zh : adv.url, label: zh ? adv.document_zh + '，S/N ' + adv.sn_zh + '，' + adv.date_zh : adv.document_en + ', S/N ' + adv.sn_en + ', ' + adv.date_en })
      ])
    ]);
  }
  // A card's advice box, unless its official caution already quotes the same leaflet.
  function cardAdvice(r) {
    if (!r.advice) return null;
    if (r.official && r.official.statements.some(function (id) { return db.statementById[id].url === r.advice.url; })) return null;
    return adviceBlock(r.advice, [r.drug]);
  }
  // One advice block per leaflet for a set of rows (several medicines can share one leaflet).
  function adviceBlocks(rows) {
    var seen = {}, order = [];
    rows.forEach(function (r) {
      if (!r.advice) return;
      if (!seen[r.advice.id]) { seen[r.advice.id] = { adv: r.advice, drugs: [] }; order.push(r.advice.id); }
      if (seen[r.advice.id].drugs.indexOf(r.drug) === -1) seen[r.advice.id].drugs.push(r.drug);
    });
    return order.map(function (id) { return adviceBlock(seen[id].adv, seen[id].drugs); });
  }

  // Under the required grey wording: a next step, so the card is not a dead end. No medical claim.
  function unknownNext() {
    return el('div', { class: 'unknown-next' }, [
      el('h4', { class: 'block-label', text: t('unknown_next_title') }),
      el('p', { text: t('unknown_next_text') }),
      el('a', { class: 'btn btn-secondary btn-small', href: '#/summary' }, [el('span', { text: t('unknown_next_button') }), icon('arrow')])
    ]);
  }

  // All "not in our database" pairs in one grey box: same icon, the exact required wording, the disclaimer.
  function unknownGroupCard(rows) {
    var pairs = el('ul', { class: 'unknown-pairs' });
    rows.forEach(function (r) {
      pairs.appendChild(el('li', { 'data-pair': pairKey(r) }, [
        icon('not_in_database', 'unknown-mark'),
        el('span', { class: 'unknown-pair' }, [
          nameNode(r.herb), ' ', el('span', { class: 'pair-plus', 'aria-hidden': 'true', text: '+' }), ' ',
          el('span', { class: 'visually-hidden', text: t('and_sr') + ' ' }), nameNode(r.drug)
        ])
      ]));
    });
    return el('article', { class: 'card card-unknown card-unknown-group' }, [
      el('header', { class: 'card-head' }, [badge('not_in_database')]),
      el('p', { class: 'unknown-text', text: t('not_in_db_text') }),
      pairs,
      el('div', { class: 'advice-list' }, adviceBlocks(rows)),
      unknownNext(),
      el('p', { class: 'card-disclaimer' }, disclaimerText())
    ]);
  }

  // The HA warfarin leaflet names ginseng (人參, i.e. Asian ginseng), dong quai and danshen (and chishao,
  // not in HerbBridge). Its own intro line is used only on those herbs' cards.
  var HA_LEAFLET = 'ha-warfarin-leaflet-tcm';
  var HA_LEAFLET_NAMES = ['danshen', 'dong_quai', 'asian_ginseng'];

  /* An official caution: the agency's own words (never reworded), its document, date and section.
     In Chinese the translation is shown first, then the English original, which is what counts. */
  function officialBlock(r) {
    var o = r.official;
    var intro = !r.entry ? 'official_intro_none' : o.kind === 'disagree' ? 'official_intro_disagree'
      : o.statements[0] === HA_LEAFLET && HA_LEAFLET_NAMES.indexOf(r.herb.id) !== -1 ? 'official_intro_ha' : 'official_intro_rated';
    var box = el('div', { class: 'official-box' }, [el('p', { class: 'official-intro', text: t(intro) })]);
    // The first statement is always shown; any others fold away behind one big button (all print).
    var moreKey = pairKey(r) + '|official';
    var moreOpen = !!openCards[moreKey];
    var more = o.statements.length > 1 ? el('div', { class: 'official-more', id: 'more-' + r.herb.id + '-' + r.drug.id, hidden: !moreOpen }) : null;
    o.statements.forEach(function (id, i) {
      var s = db.statementById[id];
      var zh = state.lang === 'zh';
      (i === 0 ? box : more).appendChild(el('figure', { class: 'official-statement' }, [
        el('blockquote', { class: 'official-quote', lang: zh ? 'zh-HK' : 'en-GB', text: '“' + (zh ? quoteZh(s) : s.quote_en) + '”' }),
        zh ? el('p', { class: 'official-original' }, [
          el('span', { text: t(s.quote_zh_is_original ? 'official_zh_original_note' : 'official_translation_note') + ' ' }),
          el('span', { lang: 'en-GB', text: '“' + s.quote_en + '”' })
        ]) : null,
        el('figcaption', { class: 'official-source' }, [
          el('span', { class: 'official-body', text: (zh ? s.body_zh + '：' : s.body_en + ': ') }),
          sourceLink({ url: zh && s.url_zh ? s.url_zh : s.url, label: zh ? s.document_zh + '，' + s.date_zh + '，' + s.section_zh : s.document_en + ', ' + s.date_en + ', ' + s.section_en })
        ])
      ]));
    });
    if (more) {
      var n = o.statements.length - 1;
      var moreLabel = el('span', { text: moreOpen ? t('official_less') : I.tn('official_more', n) });
      var moreBtn = el('button', {
        type: 'button', class: 'official-more-toggle', 'aria-expanded': moreOpen ? 'true' : 'false', 'aria-controls': more.id,
        onclick: function () {
          var nowOpen = more.hidden;
          more.hidden = !nowOpen;
          moreBtn.setAttribute('aria-expanded', nowOpen ? 'true' : 'false');
          moreLabel.textContent = nowOpen ? t('official_less') : I.tn('official_more', n);
          if (nowOpen) openCards[moreKey] = true; else delete openCards[moreKey];
        }
      }, [moreLabel, icon('chevron', 'toggle-chev')]);
      box.appendChild(moreBtn);
      box.appendChild(more);
    }
    return box;
  }

  /* ---------- Read aloud (on-device voices only, so nothing leaves the phone) ---------- */

  var speaking = null; // the button whose card is being read
  function speechOk() { return 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function'; }

  /* The voice list loads late on iPhones (often empty until "voiceschanged", sometimes with no event
     at all). It is loaded in the background, because iOS only lets a page speak when speak() runs
     straight away in the tap: there is no waiting at tap time. */
  var voiceList = [];
  // Novelty and character voices (Apple and others): never used for health information.
  var NOVELTY = /\b(Albert|Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Deranged|Good News|Hysterical|Jester|Organ|Pipe Organ|Superstar|Trinoids|Whisper|Wobble|Zarvox|Grandma|Grandpa|Eddy|Flo|Reed|Rocko|Sandy|Shelley|Fred|Junior|Kathy|Ralph|Princess|Bruce|Agnes|Vicki|Victoria)\b/i;
  function refreshVoices() {
    try { voiceList = window.speechSynthesis.getVoices() || []; } catch (e) { voiceList = []; }
    updateVoiceAvailability();
  }
  // Which voice to use for a language: { voice, lang }, or null when Read aloud cannot be offered.
  // 1. an on-device voice for the language (Cantonese; English, British first);
  // 2. another on-device voice of the same language family (e.g. Mandarin when there is no Cantonese);
  // 3. no voice list at all (some iPhone in-app browsers): the phone's default voice, language set;
  // never an online-only voice, so the text never leaves the phone.
  function voiceFor(lang) {
    var want = lang === 'zh' ? 'zh-HK' : 'en-GB';
    var family = lang === 'zh' ? /^(zh|yue|cmn)/i : /^en/i;
    var exact = lang === 'zh' ? /^(zh[-_]HK|yue)/i : /^en/i;
    var local = voiceList.filter(function (v) { return v.localService !== false && !NOVELTY.test(v.name || ''); });
    var best = local.filter(function (v) { return exact.test(v.lang); });
    if (!best.length) best = local.filter(function (v) { return family.test(v.lang); });
    // Natural-sounding voices first ("Daniel (Enhanced)", "Sinji (Premium)"), then British English.
    best.sort(function (a, b) {
      var q = function (v) { return (/enhanced|premium/i.test(v.name || '') ? 2 : 0) + (lang === 'en' && /^en[-_]GB/i.test(v.lang) ? 1 : 0); };
      return q(b) - q(a);
    });
    if (best.length) return { voice: best[0], lang: best[0].lang || want };
    if (!voiceList.length) return { voice: null, lang: want };
    return null;
  }
  function updateVoiceAvailability() {
    document.documentElement.classList.toggle('no-voice', speechOk() && voiceList.length > 0 && voiceFor(state.lang) === null);
  }
  if (speechOk()) {
    refreshVoices();
    try {
      if (window.speechSynthesis.addEventListener) window.speechSynthesis.addEventListener('voiceschanged', refreshVoices);
      else window.speechSynthesis.onvoiceschanged = refreshVoices;
    } catch (e) { /* ignore */ }
    [250, 750, 1500, 3000].forEach(function (ms) { window.setTimeout(refreshVoices, ms); });
  }
  // The listening version of a card (js/speech.js): names + rating, What to do, official quote, heart line.
  function speechParts(r) { return window.HerbBridgeSpeech.script(db, r, state.lang, t, primaryName); }

  /* Pre-recorded audio (audio/<herb>-<drug>.<lang>.mp3), listed in audio/manifest.json. The files are
     loaded when the app opens, so a tap can start playing straight away (iPhones need that). */
  var recordings = {}; // "danshen-warfarin.en" → object URL
  function loadRecordings() {
    if (!window.fetch || !window.URL || !URL.createObjectURL) return;
    fetch('audio/manifest.json', { cache: 'no-cache' }).then(function (res) { return res.ok ? res.json() : { files: [] }; }).then(function (m) {
      (m.files || []).forEach(function (f) {
        var key = String(f).replace(/^audio\//, '').replace(/\.mp3$/, '');
        fetch('audio/' + key + '.mp3').then(function (res) { return res.ok ? res.blob() : null; }).then(function (blob) {
          if (blob && blob.size) recordings[key] = URL.createObjectURL(blob);
        }).catch(function () { /* phone voice instead */ });
      });
    }).catch(function () { /* no recordings */ });
  }
  loadRecordings();
  var playing = null; // current Audio element
  var readRun = 0;    // each tap is a new run; events from an earlier, stopped run are ignored
  function badgeText(e) { return t(e.risk === 'low' && e.watch ? 'risk_low_watch' : 'risk_' + e.risk); }
  function stopSpeaking() {
    if (!speaking) return;
    var btn = speaking; speaking = null;
    if (playing) { try { playing.pause(); } catch (e) { /* ignore */ } playing = null; }
    try { if (speechOk()) window.speechSynthesis.cancel(); } catch (e) { /* ignore */ }
    btn.setAttribute('aria-pressed', 'false');
    btn.querySelector('.read-label').textContent = t('read_aloud');
  }
  function readButton(r) {
    var recKey = r.herb.id + '-' + r.drug.id + '.' + state.lang;
    if (!speechOk() && !recordings[recKey]) return null;
    var msg = el('p', { class: 'read-msg', role: 'status', hidden: true });
    var btn = el('button', { type: 'button', class: 'read-aloud', 'aria-pressed': 'false', onclick: function () {
      if (speaking === btn) { stopSpeaking(); return; }
      stopSpeaking();
      msg.hidden = true;
      var started = false, run = ++readRun;
      function mine() { return speaking === btn && readRun === run; }
      // The message appears only when speaking actually fails.
      function fail() {
        if (readRun !== run) return;
        if (speaking === btn) stopSpeaking();
        msg.textContent = t('read_failed'); msg.hidden = false;
      }
      function begin() {
        speaking = btn;
        btn.setAttribute('aria-pressed', 'true');
        btn.querySelector('.read-label').textContent = t('read_stop');
      }
      // A recording for this pair and language: play it instead of the phone voice.
      var rec = recordings[r.herb.id + '-' + r.drug.id + '.' + state.lang];
      if (rec) {
        var audio = new Audio(rec);
        playing = audio; begin();
        audio.onended = function () { if (mine()) { stopSpeaking(); showNextStep(); } };
        audio.onplaying = function () { started = true; };
        var p = audio.play();
        if (p && p.catch) p.catch(function () { if (mine() && playing === audio) fail(); });
        return;
      }
      if (!speechOk()) return;
      refreshVoices();
      var choice = voiceFor(state.lang);
      if (!choice) return; // only online voices: the button is hidden by updateVoiceAvailability()
      // One short utterance per section, so the voice pauses naturally between them.
      var parts = speechParts(r);
      begin();
      parts.forEach(function (text, i) {
        var u = new window.SpeechSynthesisUtterance(text);
        if (choice.voice) u.voice = choice.voice;
        u.lang = choice.lang;
        u.rate = state.lang === 'zh' ? 0.85 : 0.9;
        u.pitch = 1;
        u.onstart = function () { started = true; };
        if (i === parts.length - 1) u.onend = function () { if (mine()) { stopSpeaking(); showNextStep(); } };
        u.onerror = function (ev) {
          if (ev && (ev.error === 'interrupted' || ev.error === 'canceled')) { if (mine()) stopSpeaking(); return; }
          fail();
        };
        window.speechSynthesis.speak(u);
      });
      window.setTimeout(function () {
        var busy = false;
        try { busy = window.speechSynthesis.speaking || window.speechSynthesis.pending; } catch (e) { /* ignore */ }
        if (mine() && !started && !busy) fail();
      }, 4000);
    } }, [icon('speaker'), el('span', { class: 'read-label', text: t('read_aloud') })]);
    return el('div', { class: 'read-row' }, [btn, msg]);
  }
  window.addEventListener('hashchange', stopSpeaking);

  // The heart line, plus its short note in Simple (Full details already says it in the main evidence).
  function heartLines(e) {
    var line = el('p', null, [el('strong', { text: t('label_heart_impact') + ' ' }), el('span', { text: field(e, 'heart_impact') })]);
    if (mode !== 'simple' || !e.heart_note_en) return line;
    return el('div', { class: 'heart-lines' }, [line, el('p', { class: 'heart-note', text: field(e, 'heart_note') })]);
  }
  function card(r) {
    var key = pairKey(r);
    if (r.official && !r.entry) {
      return el('article', { class: 'card card-official', 'data-pair': key }, [
        el('header', { class: 'card-head' }, [pairTitle(r), badgeFor(r)]),
        readButton(r),
        el('div', { class: 'todo' }, [el('h4', { class: 'block-label', text: t('label_what_to_do') }), el('p', { text: t('official_action') })]),
        officialBlock(r),
        cardAdvice(r),
        el('p', { class: 'card-disclaimer' }, disclaimerText(r))
      ]);
    }
    if (!r.entry) {
      return el('article', { class: 'card card-unknown', 'data-pair': key }, [
        el('header', { class: 'card-head' }, [pairTitle(r), badge('not_in_database')]),
        readButton(r),
        el('p', { class: 'unknown-text', text: t('not_in_db_text') }),
        cardAdvice(r),
        unknownNext(),
        el('p', { class: 'card-disclaimer' }, disclaimerText(r))
      ]);
    }
    var e = r.entry;
    var open = !!openCards[key];
    var detailsId = 'det-' + r.herb.id + '-' + r.drug.id;

    var evidence = el('ul', { class: 'evidence' });
    e.evidence_level.forEach(function (lvl) { evidence.appendChild(el('li', { text: t('ev_' + lvl) })); });
    var main = e.sources[e.main_source];

    var why = field(e, 'why');
    var whyBlock = [el('p', { text: why || t('why_none') })];
    if (e.why_pro_en) {
      whyBlock.push(el('details', { class: 'pro' }, [
        el('summary', { text: t('label_for_pros') }),
        el('p', { lang: 'en-GB', text: e.why_pro_en }),
        state.lang === 'zh' ? el('p', { class: 'muted', text: t('pro_english_only') }) : null
      ]));
    }

    var details = el('div', { class: 'card-details', id: detailsId, hidden: !open }, [
      levelMeaning(e.risk),
      block(t('label_main_evidence'), [el('p', { class: 'main-finding', text: field(e, 'main_finding') })]),
      block(t('label_why'), whyBlock),
      block(t('label_what_to_do'), [el('p', { class: 'action', text: field(e, 'action') })], 'block-action'),
      cardAdvice(r),
      block(t('label_rated_by'), [el('p', { text: e.rating_source === 'HA' ? t('rated_by_ha') : t('rated_by_team') })]),
      block(t('label_sources'), [sourceList(e.sources)])
    ]);

    var art;
    var label = el('span', { text: t(open ? 'details_close' : 'details_open') });
    var toggleBtn = el('button', {
      type: 'button', class: 'card-toggle', 'aria-expanded': open ? 'true' : 'false', 'aria-controls': detailsId,
      onclick: function () {
        var nowOpen = details.hidden;
        details.hidden = !nowOpen;
        toggleBtn.setAttribute('aria-expanded', nowOpen ? 'true' : 'false');
        label.textContent = t(nowOpen ? 'details_close' : 'details_open');
        art.classList.toggle('is-open', nowOpen);
        if (nowOpen) openCards[key] = true; else delete openCards[key];
      }
    }, [label, icon('chevron', 'toggle-chev')]);

    // With an official caution on top, the team's own rating and evidence follow under their own heading.
    // A High team rating keeps its own badge and colour, with the official words added under it.
    var withOfficial = !!r.official;
    var shownAsOfficial = r.status === L.OFFICIAL;
    art = el('article', { class: 'card card-' + (shownAsOfficial ? 'official' : e.risk) + (open ? ' is-open' : ''), 'data-pair': key }, [
      el('header', { class: 'card-head' }, [pairTitle(r), shownAsOfficial ? badgeFor(r) : badge(e.risk, e.watch)]),
      readButton(r),
      withOfficial ? officialBlock(r) : null,
      withOfficial ? el('div', { class: 'studies-head' }, [
        el('h4', { class: 'block-label', text: t('label_studies') }),
        el('p', { class: 'team-rating' }, [el('span', { text: labelText('label_team_rating') }), badge(e.risk, e.watch, 'span')])
      ]) : null,
      el('p', { class: 'effect', text: field(e, 'effect') }),
      field(e, 'heart_impact') ? el('div', { class: 'heart-impact' }, [
        icon('heart', 'heart-icon'),
        heartLines(e)
      ]) : null,
      el('dl', { class: 'facts' }, [
        el('div', null, [el('dt', { text: t('label_evidence') }), el('dd', null, [evidence])]),
        el('div', null, [el('dt', { text: t('label_main_evidence') }), el('dd', { class: 'main-source' }, [sourceLink(main), el('span', { class: 'print-url', text: main.url })])])
      ]),
      toggleBtn,
      details,
      el('p', { class: 'card-disclaimer' }, disclaimerText(r))
    ]);
    return art;
  }

  /* ---------- Display mode, steps and compact cards ---------- */

  function applyMode() {
    document.documentElement.setAttribute('data-mode', mode);
    ['simple', 'full'].forEach(function (m) {
      var b = document.getElementById('mode-' + m);
      if (b) b.setAttribute('aria-pressed', mode === m ? 'true' : 'false');
    });
  }
  function setMode(m) {
    if (m === mode) return;
    mode = m;
    try { localStorage.setItem(MODE_KEY, m); } catch (e) { /* stays for this visit */ }
    render(false);
  }
  // A coloured strip on every screen says which mode is on, so the two look different at a glance.
  function modeStrip() {
    var simple = mode === 'simple';
    return el('div', { class: 'mode-strip mode-strip-' + mode, role: 'note' }, [
      icon(simple ? 'view_simple' : 'view_full', 'mode-strip-icon'),
      (function () {
        var parts = t(simple ? 'mode_strip_simple' : 'mode_strip_full').split(' · ');
        return el('p', { class: 'mode-strip-text' }, [el('span', { text: parts[0] }), parts[1] ? el('span', { class: 'mode-strip-detail', text: ' · ' + parts[1] }) : null]);
      })(),
      el('button', { type: 'button', class: 'mode-strip-btn', onclick: function () { setMode(simple ? 'full' : 'simple'); } },
        [el('span', { text: t(simple ? 'mode_strip_to_full' : 'mode_strip_to_simple') })])
    ]);
  }
  // Chinese headings: the last character and the closing 。！？ stay on one line (never a lone 。).
  function keepEndTogether(root) {
    if (state.lang !== 'zh') return;
    Array.prototype.forEach.call(root.querySelectorAll('h1, h2'), function (h) {
      if (h.children.length || !/[\u3400-\u9fff][。！？]$/.test(h.textContent)) return;
      var text = h.textContent;
      h.textContent = text.slice(0, -2);
      h.appendChild(el('span', { class: 'keep-end', text: text.slice(-2) }));
    });
  }
  // A note that belongs to the herb, shown on every pair page with that herb (e.g. hawthorn: which part
  // of the plant the evidence is about).
  function herbNote(r) {
    if (!r.herb.pair_note_en) return null;
    // No icon: the Low badge's "i" icon could make a grey card look like a Low rating.
    return el('p', { class: 'herb-note', text: field(r.herb, 'pair_note') });
  }
  // "What people take it for" (Task 2): never before the risk. One line in Simple; in Full details also the
  // extra line and the sources. Always ends "This is not a recommendation to take it." Not on the summary.
  function usesBox(r) {
    var u = r.herb.uses;
    if (!u) return null;
    var full = mode === 'full';
    var srcs = [];
    if (full) u.sources.forEach(function (s, i) { if (i) srcs.push(document.createTextNode(state.lang === 'zh' ? '；' : '; ')); srcs.push(sourceLink(s)); });
    return el('section', { class: 'uses-box', 'aria-labelledby': 'uses-title' }, [
      el('h2', { id: 'uses-title', class: 'uses-title', text: t('uses_title') }),
      el('p', { class: 'uses-line', text: field(u, 'line') }),
      full && u.full_en ? el('p', { class: 'uses-more', text: field(u, 'full') }) : null,
      full ? el('p', { class: 'uses-sources' }, [el('strong', { text: t('label_sources') + (state.lang === 'zh' ? '：' : ': ') })].concat(srcs)) : null,
      el('p', { class: 'uses-not-advice', text: t('uses_not_advice') })
    ]);
  }
  function homeLink() {
    return el('a', { class: 'home-link', href: '#/cabinet' }, [icon('home'), el('span', { text: t('nav_home') })]);
  }
  // The last step on every pair page: show the doctor, with the sentence to say and the summary.
  function nextStep(rows) {
    return el('section', { class: 'next-step', id: 'next-step', tabindex: '-1', 'aria-labelledby': 'h-next' }, [
      el('h2', { id: 'h-next', text: t('next_title') }),
      el('p', { class: 'next-say', text: window.HerbBridgeSpeech.youCanSay(rows, state.lang, t, true) }),
      el('a', { class: 'btn btn-primary btn-next', href: '#/summary' }, [el('span', { text: t('next_button') }), icon('arrow')])
    ]);
  }
  // When reading aloud finishes on a pair page, bring the next step into view.
  function showNextStep() {
    var next = document.getElementById('next-step');
    if (!next) return;
    next.classList.add('is-now');
    next.scrollIntoView({ block: 'center', behavior: 'smooth' });
    next.focus({ preventScroll: true });
  }
  // Simple: one step at a time, said in words ("Step 2 of 3").
  function stepLine(n) { return el('p', { class: 'step-line', text: t('step_of', { n: n, total: 3 }) }); }
  // The herb name with the + joined to its last word by a no-break space, so the + never sits
  // alone on a line (Hawthorn 山楂 / + / Digoxin).
  function herbWithPlus(herb) {
    var node = nameNode(herb), last = node.lastElementChild;
    last.appendChild(document.createTextNode('\u00a0'));
    last.appendChild(el('span', { class: 'pair-plus', 'aria-hidden': 'true', text: '+' }));
    return node;
  }
  function pairHref(r) { return '#/pair/' + r.herb.id + '-' + r.drug.id; }
  function stepsBar(current) {
    var labels = ['nav_check', 'step_results', 'step_details'];
    return el('ol', { class: 'steps', 'aria-label': t('steps_label') }, labels.map(function (k, i) {
      var n = i + 1;
      return el('li', { class: n < current ? 'done' : n === current ? 'now' : '', 'aria-current': n === current ? 'step' : null }, [
        el('span', { class: 'step-n', 'aria-hidden': 'true', text: String(n) }), el('span', { text: t(k) })
      ]);
    }));
  }
  // The first sentence only (Simple mode cards); the full text is on the detail screen.
  function firstSentence(s) {
    // English full stop needs a space or the end after it ("e.g." safe); Chinese 。！？ end a sentence
    // directly, and a ； clause counts as one too (the English has a full stop there), closed with 。.
    var m = /^[\s\S]*?(?:[.!?](?=\s|$)|[。！？；])/.exec(s || '');
    return m ? m[0].replace(/；$/, '。') : s;
  }
  function cardName(item, kind) {
    if (mode === 'full') return el('span', { class: 'name-with-icon' }, [icon(kind === 'herb' ? 'leaf' : 'pill', 'kind-icon'), nameNode(item)]);
    if (withEnglish(item)) return nameNode(item);
    return el('span', { class: 'name' }, [el('span', { class: 'name-primary', text: primaryName(item), lang: state.lang === 'zh' ? 'zh-HK' : 'en-GB' })]);
  }
  function shortLine(r) {
    var zh = state.lang === 'zh';
    if (r.status === L.NOT_IN_DATABASE) return el('p', { class: 'pair-line pair-line-unknown', text: t('not_in_db_text') });
    if (mode === 'simple') {
      var act = r.entry ? field(r.entry, 'action') : t('official_action');
      return el('p', { class: 'pair-line' }, [el('strong', { text: labelText('label_what_to_do') }), el('span', { text: firstSentence(act) })]);
    }
    if (r.entry && field(r.entry, 'heart_impact')) return el('p', { class: 'pair-line', text: field(r.entry, 'heart_impact') });
    var s = db.statementById[r.official.statements[0]];
    return el('p', { class: 'pair-line pair-line-quote' }, [el('strong', { text: (zh ? s.body_zh + '：' : s.body_en + ': ') }), el('span', { text: '“' + (zh ? quoteZh(s) : s.quote_en) + '”' })]);
  }
  // Full details only: What to do in full, the evidence levels and how many sources, on the card itself.
  function fullFacts(r) {
    if (mode !== 'full' || r.status === L.NOT_IN_DATABASE) return null;
    var act = r.entry ? field(r.entry, 'action') : t('official_action');
    var rows = [el('p', { class: 'pair-fact' }, [el('strong', { text: labelText('label_what_to_do') }), el('span', { text: act })])];
    if (r.entry) {
      rows.push(el('p', { class: 'pair-fact pair-fact-meta' }, [
        el('strong', { text: labelText('label_evidence') }),
        el('span', { text: r.entry.evidence_level.map(function (l) { return t('ev_' + l); }).join(' · ') }),
        el('span', { class: 'pair-fact-count', text: I.tn('sources_count', r.entry.sources.length) })
      ]));
    }
    return el('span', { class: 'pair-facts' }, rows);
  }
  function compactCard(r) {
    var tag = mode === 'full' && r.official && r.status !== L.NOT_IN_DATABASE;
    return el('a', { class: 'pair-card tone-' + r.status, href: pairHref(r), 'data-pair': pairKey(r) }, [
      el('span', { class: 'pair-card-top' }, [badgeFor(r, 'span'), tag ? el('span', { class: 'tag-official', text: t('tag_official') }) : null]),
      el('span', { class: 'pair-card-names' }, [
        cardName(r.herb, 'herb'), ' ', el('span', { class: 'pair-plus', 'aria-hidden': 'true', text: '+' }), ' ',
        el('span', { class: 'visually-hidden', text: t('and_sr') + ' ' }), cardName(r.drug, 'drug')
      ]),
      shortLine(r),
      fullFacts(r),
      el('span', { class: 'pair-card-go' }, [el('span', { text: t('alert_details') }), icon('chevron')])
    ]);
  }
  // Several "not in our database" pairs: one grey card with the required wording once, each pair a link.
  function compactUnknownGroup(rows) {
    var list = el('ul', { class: 'unknown-links' });
    rows.forEach(function (r) {
      list.appendChild(el('li', null, [el('a', { href: pairHref(r), 'data-pair': pairKey(r) }, [
        icon('not_in_database', 'unknown-mark'),
        el('span', { class: 'unknown-pair' }, [primaryName(r.herb), ' + ', shownName(r.drug)]),
        icon('chevron', 'row-go')
      ])]));
    });
    return el('div', { class: 'pair-card pair-card-group tone-not_in_database' }, [
      el('span', { class: 'pair-card-top' }, [badge('not_in_database', false, 'span')]),
      el('p', { class: 'pair-line pair-line-unknown', text: t('not_in_db_text') }),
      list
    ]);
  }

  function renderResults() {
    app.textContent = '';
    var results = L.checkPairs(db, state.herbs, state.drugs);
    var full = mode === 'full';
    var head = el('header', { class: 'page-head results-head' }, [
      el('div', { class: 'page-nav' }, [homeLink()]),
      full ? stepsBar(2) : stepLine(2),
      el('p', { class: 'kicker', text: t('results_title') })
    ]);
    app.appendChild(full ? el('div', { class: 'hero' }, [head]) : head);
    if (!results.length) {
      head.appendChild(el('h1', { tabindex: '-1', text: t('results_empty') }));
      head.appendChild(el('a', { class: 'btn btn-primary head-action', href: '#/cabinet', text: t('back_to_check') }));
      return null;
    }
    var flagged = results.filter(isFlagged).length;
    var unknown = results.filter(function (r) { return r.status === L.NOT_IN_DATABASE; }).length;
    // The headline never sounds like "all clear": no record is said as no record.
    var headline = flagged ? I.tn('results_need', flagged) : unknown ? I.tn('results_norec_head', unknown) : t('level_none_reported');
    head.appendChild(el('h1', { tabindex: '-1', text: headline }));
    if (flagged && unknown) head.appendChild(el('ul', { class: 'result-chips' }, [el('li', { text: I.tn('results_norec', unknown) })]));

    var list = el('ol', { class: 'pair-cards' });
    var greys = results.filter(function (r) { return r.status === L.NOT_IN_DATABASE; });
    results.forEach(function (r) { if (r.status !== L.NOT_IN_DATABASE) list.appendChild(el('li', null, [compactCard(r)])); });
    if (greys.length === 1) list.appendChild(el('li', null, [compactCard(greys[0])]));
    else if (greys.length > 1) list.appendChild(el('li', null, [compactUnknownGroup(greys)]));
    app.appendChild(list);
    app.appendChild(el('p', { class: 'disclaimer-box' }, disclaimerText()));

    app.appendChild(el('div', { class: 'actions actions-stack' }, [
      el('a', { class: 'btn btn-primary', href: '#/summary', text: t('to_summary') }),
      el('a', { class: 'btn btn-quiet', href: '#/cabinet', text: t('edit_list') })
    ]));
    return null;
  }

  /* ---------- Pair detail screen ---------- */

  function renderPair(p) {
    app.textContent = '';
    var r = p ? L.checkPairs(db, [p.herb], [p.drug])[0] : null;
    var back = el('a', { class: 'back-link', href: '#/results' }, [icon('back'), el('span', { text: t('back_to_results') })]);
    if (!r) {
      app.appendChild(el('header', { class: 'page-head' }, [back, el('h1', { tabindex: '-1', text: t('results_empty') })]));
      return;
    }
    var full = mode === 'full';
    var key = pairKey(r);
    app.appendChild(el('header', { class: 'page-head pair-head' }, [
      el('div', { class: 'page-nav' }, [back, homeLink()]),
      full ? stepsBar(3) : stepLine(3),
      el('h1', { tabindex: '-1', class: 'pair-h1' }, [
        herbWithPlus(r.herb), ' ',
        el('span', { class: 'visually-hidden', text: t('and_sr') + ' ' }), nameNode(r.drug)
      ])
    ]));
    // The full card (its own title is the page heading above). Full details opens everything.
    if (full) openCards[key] = true;
    var whole = card(r);
    var title = whole.querySelector('h3.pair');
    if (title) title.parentNode.removeChild(title);
    if (full) {
      Array.prototype.forEach.call(whole.querySelectorAll('details'), function (d) { d.open = true; });
      var note = herbNote(r);
      if (note) {
        var after = whole.querySelector('.todo') || whole.querySelector('.unknown-text') || whole.querySelector('.effect') || whole.querySelector('.read-row');
        if (after) after.parentNode.insertBefore(note, after.nextSibling); else whole.appendChild(note);
      }
      app.appendChild(whole);
      var usesFull = usesBox(r);
      if (usesFull) app.appendChild(usesFull);
      app.appendChild(nextStep([r]));
      return;
    }

    // Simple: badge, What to do, the required grey wording, disclaimer; everything else behind one button.
    var grey = r.status === L.NOT_IN_DATABASE;
    var todo = grey ? t('unknown_next_text') : r.entry ? field(r.entry, 'action') : t('official_action');
    ['.read-row', '.official-box', '.todo'].forEach(function (sel) {
      var node = whole.querySelector(sel);
      if (node) node.parentNode.removeChild(node);
    });
    var more = el('div', { class: 'more-box', id: 'more-' + key.replace('|', '-'), hidden: true }, [whole]);
    var moreLabel = el('span', { text: t('more_details') });
    var moreBtn = el('button', { type: 'button', class: 'btn btn-secondary more-btn', 'aria-expanded': 'false', 'aria-controls': more.id, onclick: function () {
      var open = more.hidden;
      more.hidden = !open;
      moreBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      moreLabel.textContent = t(open ? 'fewer_details' : 'more_details');
    } }, [moreLabel, icon('chevron', 'toggle-chev')]);
    app.appendChild(el('article', { class: 'pair-simple tone-' + r.status }, [
      el('div', { class: 'pair-simple-badge' }, [badgeFor(r)]),
      readButton(r),
      grey ? el('p', { class: 'unknown-text', text: t('not_in_db_text') }) : null,
      el('div', { class: 'todo' }, [el('h2', { text: t('label_what_to_do') }), el('p', { text: todo })]),
      herbNote(r),
      r.official ? officialBlock(r) : null,
      grey ? el('a', { class: 'btn btn-primary', href: '#/summary' }, [el('span', { text: t('unknown_next_button') }), icon('arrow')]) : null,
      usesBox(r),
      el('p', { class: 'disclaimer-box' }, disclaimerText(r))
    ]));
    app.appendChild(moreBtn);
    app.appendChild(more);
    app.appendChild(nextStep([r]));
  }

  /* ---------- Doctor summary (printable) ---------- */

  function formatDate(d) {
    try {
      return d.toLocaleDateString(state.lang === 'zh' ? 'zh-HK' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch (e) { return d.toISOString().slice(0, 10); }
  }

  function sourceList(sources) {
    var ol = el('ol', { class: 'sources' });
    sources.forEach(function (s) {
      ol.appendChild(el('li', null, [sourceLink(s), el('span', { class: 'print-url', text: state.lang === 'zh' && s.url_zh ? s.url_zh : s.url })]));
    });
    return ol;
  }

  function itemList(items) {
    if (!items.length) return el('p', { class: 'muted', text: t('summary_none_listed') });
    var ul = el('ul', { class: 'summary-items' });
    items.forEach(function (item) {
      ul.appendChild(el('li', null, [
        el('span', { class: 'si-en', lang: 'en-GB', text: item.name_en }), ' ',
        el('span', { class: 'si-zh', lang: 'zh-HK', text: item.name_zh }),
        item.latin ? el('span', { class: 'si-latin', lang: 'la', text: item.latin }) : null
      ]));
    });
    return ul;
  }

  function bilingualPair(r) {
    return el('h4', { class: 'summary-pair' }, [
      el('span', { lang: 'en-GB', text: r.herb.name_en + ' ' }), el('span', { lang: 'zh-HK', text: r.herb.name_zh }),
      ' ', el('span', { class: 'pair-plus', 'aria-hidden': 'true', text: '+' }), ' ',
      el('span', { class: 'visually-hidden', text: ' ' + t('and_sr') + ' ' }),
      el('span', { lang: 'en-GB', text: r.drug.name_en + ' ' }), el('span', { lang: 'zh-HK', text: r.drug.name_zh })
    ]);
  }

  function renderSummary() {
    app.textContent = '';
    var page = el('article', { class: 'summary' });
    app.appendChild(page);
    page.appendChild(el('header', { class: 'summary-head' }, [
      el('p', { class: 'summary-kicker', text: 'HerbBridge 中西通 · ' + t('summary_title') }),
      el('h1', { tabindex: '-1', text: t('summary_headline') }),
      el('p', { class: 'muted', text: t('summary_generated', { date: formatDate(new Date()) }) })
    ]));

    if (!state.herbs.length && !state.drugs.length) {
      page.appendChild(el('p', { class: 'lede', text: t('summary_empty') }));
      page.appendChild(el('a', { class: 'btn btn-primary no-print', href: '#/cabinet', text: t('back_to_check') }));
      return;
    }

    // The sentence to say to the doctor, once, for the pairs that need attention (all pairs if none do).
    var sayRows = L.checkPairs(db, state.herbs, state.drugs);
    if (sayRows.length) {
      var needs = sayRows.filter(isFlagged);
      page.appendChild(el('p', { class: 'summary-say' }, [window.HerbBridgeSpeech.youCanSay(needs.length ? needs : sayRows, state.lang, t, true)]));
    }

    page.appendChild(el('div', { class: 'no-print summary-actions' }, [
      el('button', { type: 'button', class: 'btn btn-primary', onclick: function () { window.print(); } }, [el('span', { text: t('summary_print') })]),
      el('a', { class: 'btn btn-secondary', href: '#/cabinet', text: t('edit_list') })
    ]));

    page.appendChild(el('section', { class: 'summary-lists' }, [
      el('div', null, [el('h2', { text: t('summary_herbs') }), itemList(state.herbs.map(function (id) { return db.herbById[id]; }))]),
      el('div', null, [el('h2', { text: t('summary_drugs') }), itemList(state.drugs.map(function (id) { return db.drugById[id]; }))])
    ]));

    var rows = L.checkPairs(db, state.herbs, state.drugs);
    var rated = rows.filter(function (r) { return r.entry || r.official; });
    var unknown = rows.filter(function (r) { return r.status === L.NOT_IN_DATABASE; });

    var flaggedSection = el('section', { class: 'summary-section' }, [el('h2', { text: t('summary_flagged') })]);
    if (!rated.length) flaggedSection.appendChild(el('p', { text: state.herbs.length && state.drugs.length ? t('summary_flagged_none') : t('cabinet_need_both') }));
    rated.forEach(function (r) {
      var e = r.entry;
      // Official cautions: each agency's own words with document and date, before any team rating.
      var officialRows = [];
      if (r.official) {
        r.official.statements.forEach(function (id) {
          var s = db.statementById[id], zh = state.lang === 'zh';
          officialRows.push(el('dt', { text: t('label_official') }));
          officialRows.push(el('dd', null, [
            el('span', { text: '“' + (zh ? quoteZh(s) : s.quote_en) + '” ' }),
            el('span', { class: 'muted', text: zh ? '（' + s.body_zh + '，' + s.document_zh + '，' + s.date_zh + '）' : '(' + s.body_en + ', ' + s.document_en + ', ' + s.date_en + ')' })
          ]));
        });
      }
      if (!e) {
        flaggedSection.appendChild(el('div', { class: 'summary-row summary-official' }, [
          el('div', { class: 'summary-row-head' }, [badgeFor(r), bilingualPair(r)]),
          el('dl', { class: 'summary-dl' }, officialRows.concat([
            el('dt', { text: t('label_what_to_do') }), el('dd', { text: t('official_action') })
          ]))
        ]));
        return;
      }
      var evidence = e.evidence_level.map(function (l) { return t('ev_' + l); }).join(' · ');
      flaggedSection.appendChild(el('div', { class: 'summary-row summary-' + (r.status === L.OFFICIAL ? 'official' : e.risk) }, [
        el('div', { class: 'summary-row-head' }, [r.status === L.OFFICIAL ? badgeFor(r) : badge(e.risk, e.watch), bilingualPair(r)]),
        el('dl', { class: 'summary-dl' }, officialRows.concat([
          el('dt', { text: t('label_rated_by') }),
          // Under an official caution, the database rating goes on this same line (saves print space).
          el('dd', null, [
            r.status === L.OFFICIAL ? badge(e.risk, e.watch, 'span') : null, r.status === L.OFFICIAL ? ' ' : null,
            el('span', { text: e.rating_source === 'HA' ? t('rated_by_ha') : t('rated_by_team') })
          ]),
          el('dt', { text: t('label_main_evidence') }), el('dd', { text: field(e, 'main_finding') + ' (' + e.sources[e.main_source].label + ')' }),
          field(e, 'heart_impact') ? el('dt', { text: t('label_heart_impact_short') }) : null,
          field(e, 'heart_impact') ? el('dd', { text: field(e, 'heart_impact') }) : null,
          el('dt', { text: t('col_effect') }), el('dd', { text: field(e, 'effect') }),
          el('dt', { text: t('label_what_to_do') }), el('dd', { text: field(e, 'action') }),
          el('dt', { text: t('label_evidence') }), el('dd', { text: evidence }),
          el('dt', { text: t('label_sources') }), el('dd', null, [sourceList(e.sources)])
        ]))
      ]));
    });
    page.appendChild(flaggedSection);

    if (unknown.length) {
      var ul = el('ul', { class: 'summary-unknown-list' });
      unknown.forEach(function (r) { ul.appendChild(el('li', null, [bilingualPair(r)])); });
      page.appendChild(el('section', { class: 'summary-section summary-unknown' }, [
        el('h2', null, [icon('not_in_database'), el('span', { text: ' ' + t('summary_unknown') })]),
        el('p', { text: t('summary_unknown_text') }),
        ul
      ].concat(adviceBlocks(unknown))));
    }

    page.appendChild(el('p', { class: 'disclaimer-box summary-disclaimer' }, disclaimerText()));
    if (state.lang === 'zh' && zhUnreviewed()) page.appendChild(el('p', { class: 'muted zh-note', text: t('zh_unreviewed_note') }));
  }

  /* ---------- About ---------- */

  function pairLabel(e) {
    var herb = db.herbById[e.herb_id];
    var other = e.drug_id ? shownName(db.drugById[e.drug_id]) : t('class_' + e.drug_class);
    return primaryName(herb) + ' + ' + other;
  }

  // Background facts on the About page (not used for any rating).
  var BACKGROUND_SOURCES = [
    { label: 'Hong Kong Government press release (Department of Health), 2024: deaths from cardiovascular diseases in 2023', url: 'https://www.info.gov.hk/gia/general/202409/29/P2024092700490.htm' },
    { label: 'Lam et al. Hong Kong Med J 2020: INR control in warfarin patients in Hong Kong', url: 'https://www.hkmj.org/node/10340' }
  ];

  function sourceLinkInline(src, text) {
    return el('a', { href: src.url, target: '_blank', rel: 'noopener noreferrer', class: 'inline-source' }, [
      el('span', { text: state.lang === 'zh' ? '（' + text + '）' : '(' + text + ')' }), el('span', { class: 'visually-hidden', text: ' ' + t('opens_new_tab') })
    ]);
  }

  function renderAbout() {
    app.textContent = '';
    var page = el('article', { class: 'about' });
    app.appendChild(page);
    function section(titleKey, children) {
      return el('section', { class: 'about-section' }, [el('h2', { text: t(titleKey) })].concat(children));
    }

    page.appendChild(el('header', { class: 'page-head results-head' }, [
      el('h1', { tabindex: '-1', text: t('about_title') }),
      el('p', { class: 'lede', text: t('about_intro') })
    ]));

    // Why HerbBridge focuses on heart patients (Challenge 4: cardiovascular disease).
    var why = el('ul', { class: 'about-heart' });
    why.appendChild(el('li', { text: t('about_heart_1') }));
    why.appendChild(el('li', { text: t('about_heart_2') }));
    why.appendChild(el('li', null, [el('span', { text: t('about_heart_3') + ' ' }), sourceLinkInline(BACKGROUND_SOURCES[0], t('about_heart_3_src'))]));
    why.appendChild(el('li', null, [el('span', { text: t('about_heart_4') + ' ' }), sourceLinkInline(BACKGROUND_SOURCES[1], t('about_heart_4_src'))]));
    page.appendChild(section('about_heart_title', [why]));

    page.appendChild(section('about_how_title', [el('p', { text: t('about_how') })]));

    var scale = el('ol', { class: 'scale' });
    L.RISKS.forEach(function (risk) { scale.appendChild(el('li', null, [badge(risk), levelMeaning(risk)])); });
    page.appendChild(section('about_ratings_title', [
      el('p', { text: t('about_ratings_intro') }),
      scale,
      el('p', null, [badge('low', true)]),
      el('p', { text: t('about_low_watch') }),
      el('p', null, [badge('official')]),
      el('p', { text: t('about_official') }),
      el('p', { class: 'strong', text: t('about_official_rule') }),
      el('p', { text: t('about_reviews') }),
      el('p', null, [badge('not_in_database')]),
      el('p', { class: 'strong', text: t('about_not_in_db') }),
      el('p', { text: t('about_rating_source') })
    ]));

    var ev = el('dl', { class: 'about-dl' });
    L.EVIDENCE_LEVELS.forEach(function (lvl) {
      ev.appendChild(el('dt', { text: t('ev_' + lvl) }));
      ev.appendChild(el('dd', { text: t('ev_' + lvl + '_desc') }));
    });
    page.appendChild(section('about_evidence_title', [ev]));

    page.appendChild(section('about_disclaimer_title', [el('p', { class: 'disclaimer-box' }, disclaimerText())]));
    page.appendChild(section('about_privacy_title', [el('p', { text: t('about_privacy') })]));
    page.appendChild(installSection());

    // Every source in the database, once, with the combinations that cite it.
    var byUrl = {}, order = [];
    db.interactions.forEach(function (e) {
      e.sources.forEach(function (s) {
        if (!byUrl[s.url]) { byUrl[s.url] = { source: s, pairs: [] }; order.push(s.url); }
        byUrl[s.url].pairs.push(pairLabel(e));
      });
    });
    var list = el('ol', { class: 'sources about-sources' });
    order.forEach(function (url) {
      var x = byUrl[url];
      list.appendChild(el('li', null, [
        el('a', { href: url, target: '_blank', rel: 'noopener noreferrer' }, [
          el('span', { text: x.source.label }), icon('external', 'ext'),
          el('span', { class: 'visually-hidden', text: ' ' + t('opens_new_tab') })
        ]),
        el('span', { class: 'source-pairs', text: x.pairs.join(t('list_sep')) })
      ]));
    });
    var background = el('ol', { class: 'sources about-sources' });
    BACKGROUND_SOURCES.forEach(function (src) {
      background.appendChild(el('li', null, [
        el('a', { href: src.url, target: '_blank', rel: 'noopener noreferrer' }, [
          el('span', { text: src.label }), icon('external', 'ext'),
          el('span', { class: 'visually-hidden', text: ' ' + t('opens_new_tab') })
        ]),
        el('span', { class: 'source-pairs', text: t('about_background_used') })
      ]));
    });
    // Official documents quoted on "Official caution" cards, one line per document.
    var docs = [], docByUrl = {};
    db.cautions.forEach(function (c) {
      var pairName = primaryName(db.herbById[c.herb_id]) + ' + ' + (c.drug_id ? shownName(db.drugById[c.drug_id]) : t('class_' + c.drug_class));
      c.statements.forEach(function (id) {
        var s = db.statementById[id], zh = state.lang === 'zh';
        if (!docByUrl[s.url]) {
          docByUrl[s.url] = { url: zh && s.url_zh ? s.url_zh : s.url, label: zh ? s.body_zh + '：' + s.document_zh + '，' + s.date_zh : s.body_en + ': ' + s.document_en + ', ' + s.date_en, pairs: [] };
          docs.push(docByUrl[s.url]);
        }
        if (docByUrl[s.url].pairs.indexOf(pairName) === -1) docByUrl[s.url].pairs.push(pairName);
      });
    });
    var official = el('ol', { class: 'sources about-sources' });
    docs.forEach(function (d) {
      official.appendChild(el('li', null, [
        el('a', { href: d.url, target: '_blank', rel: 'noopener noreferrer' }, [
          el('span', { text: d.label }), icon('external', 'ext'),
          el('span', { class: 'visually-hidden', text: ' ' + t('opens_new_tab') })
        ]),
        el('span', { class: 'source-pairs', text: d.pairs.join(t('list_sep')) })
      ]));
    });
    page.appendChild(section('about_sources_title', [
      el('p', { text: t('about_sources_intro') }),
      list,
      docs.length ? el('h3', { class: 'about-subhead', text: t('about_official_sources_title') }) : null,
      docs.length ? official : null,
      el('h3', { class: 'about-subhead', text: t('about_background_title') }),
      background,
      db.lastUpdated ? el('p', { class: 'muted', text: t('about_updated', { date: formatDate(new Date(db.lastUpdated + 'T00:00:00')) }) }) : null
    ]));

    var next = el('ul', { class: 'about-next' });
    ['about_next_1', 'about_next_2', 'about_next_3', 'about_next_4'].forEach(function (k) { next.appendChild(el('li', { text: t(k) })); });
    page.appendChild(section('about_next_title', [next]));
  }

  /* ---------- Installable app ---------- */

  // Chrome and Edge on Android offer their own install prompt; we keep it for the About page button.
  var installPrompt = null;
  window.addEventListener('beforeinstallprompt', function (ev) {
    ev.preventDefault();
    installPrompt = ev;
    if (currentRoute() === 'about') render(false);
  });
  window.addEventListener('appinstalled', function () {
    installPrompt = null;
    if (currentRoute() === 'about') render(false);
  });

  function isInstalled() {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
  }

  function installSection() {
    var children = [el('h2', { text: t('install_title') })];
    if (isInstalled()) {
      children.push(el('p', { class: 'strong', text: t('install_done') }));
    } else {
      children.push(el('p', { text: t('install_text') }));
      if (installPrompt) {
        children.push(el('button', {
          type: 'button', class: 'btn btn-primary',
          onclick: function () {
            var prompt = installPrompt;
            installPrompt = null;
            prompt.prompt();
            prompt.userChoice.then(function () { render(false); }, function () { render(false); });
          }
        }, [el('span', { text: t('install_button') })]));
      }
      children.push(el('ul', { class: 'install-steps' }, [
        el('li', { text: t('install_iphone') }),
        el('li', { text: t('install_android') })
      ]));
    }
    return el('section', { class: 'about-section', id: 'install' }, children);
  }

  /* ---------- error screen ---------- */

  function renderError() {
    applyStaticText();
    app.textContent = '';
    app.appendChild(el('section', { class: 'notice notice-error', role: 'alert' }, [
      el('h1', { text: t('error_title') }),
      el('p', { text: location.protocol === 'file:' ? t('error_file') : t('error_network') })
    ]));
  }

  /* ---------- routing ---------- */

  // Screens: #/cabinet (also #/check), #/results, #/pair/<herb>-<drug>, #/summary, #/about.
  var routeParam = null;
  function currentRoute() {
    var r = (location.hash || '').replace(/^#\/?/, '');
    routeParam = null;
    if (r === 'cabinet') return 'check';
    var m = /^pair\/([a-z_]+)-([a-z_]+)$/.exec(r);
    if (m) { routeParam = { herb: m[1], drug: m[2] }; return 'pair'; }
    return ['check', 'results', 'summary', 'about'].indexOf(r) !== -1 ? r : 'check';
  }

  function applyStaticText() {
    var zh = state.lang === 'zh';
    document.documentElement.lang = zh ? 'zh-HK' : 'en-GB';
    Array.prototype.forEach.call(document.querySelectorAll('[data-i18n]'), function (node) {
      node.textContent = t(node.getAttribute('data-i18n'));
    });
    // The slogan may only break after its comma ("…East to West," / 「中西相通，」).
    Array.prototype.forEach.call(document.querySelectorAll('.brand-slogan'), function (node) {
      var m = t('slogan').match(/^(.*?[,，])\s*(.*)$/);
      if (!m) return;
      node.textContent = '';
      node.appendChild(el('span', { class: 'slogan-part', text: m[1] }));
      node.appendChild(document.createTextNode(zh ? '' : ' '));
      node.appendChild(el('span', { class: 'slogan-part', text: m[2] }));
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-i18n-label]'), function (node) {
      node.setAttribute('aria-label', t(node.getAttribute('data-i18n-label')));
    });
    applyMode();
    if (speechOk()) updateVoiceAvailability();
    var toggleBtn = document.getElementById('lang-toggle');
    toggleBtn.textContent = '';
    toggleBtn.appendChild(el('span', { lang: zh ? 'en-GB' : 'zh-HK', text: t('lang_toggle') }));
    toggleBtn.setAttribute('aria-label', t('lang_toggle_label'));
    // Chinese drafts are flagged until a native speaker has reviewed them.
    var note = document.getElementById('zh-note');
    var unreviewed = zh && (!db || zhUnreviewed());
    note.hidden = !unreviewed;
    note.textContent = unreviewed ? t('zh_unreviewed_note') : '';
  }

  function zhUnreviewed() {
    return !I.zhReviewed || db.herbs.concat(db.drugs, db.interactions, drugGroups).some(function (x) { return x.zh_reviewed !== true; });
  }

  function switchLanguage() {
    var live = document.getElementById('sr-alert');
    if (live) live.textContent = '';
    state.lang = state.lang === 'zh' ? 'en' : 'zh';
    I.setLang(state.lang);
    save();
    var y = window.scrollY;
    if (!db) { renderError(); return; }
    render(false);
    window.scrollTo(0, y);
    document.getElementById('lang-toggle').focus();
  }

  function render(focus) {
    var route = currentRoute();
    closeSheet(true);
    checkBar = null;
    statusTile = null;
    cards = {};
    warningPanel = null;
    demoBox = null;
    if (route !== 'check') alertState = null;
    applyStaticText();
    Array.prototype.forEach.call(document.querySelectorAll('[data-route-link]'), function (a) {
      if (a.getAttribute('data-route-link') === route) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    document.body.setAttribute('data-route', route);
    document.documentElement.setAttribute('data-route', route);
    var target = null;
    if (route === 'results') target = renderResults();
    else if (route === 'pair') renderPair(routeParam);
    else if (route === 'summary') renderSummary();
    else if (route === 'about') renderAbout();
    else renderCheck();
    app.insertBefore(modeStrip(), app.firstChild);
    keepEndTogether(app);
    // Full details: a short fade between screens (CSS turns it off for "reduce motion").
    app.classList.remove('screen-in');
    if (mode === 'full' && focus) { void app.offsetWidth; app.classList.add('screen-in'); }
    if (focus) {
      window.scrollTo(0, 0);
      // From a dashboard row: go straight to that pair's (opened) card.
      if (target) {
        target.scrollIntoView({ block: 'start' });
        target.focus({ preventScroll: true });
        return;
      }
      var h1 = app.querySelector('h1');
      if (h1) h1.focus({ preventScroll: true });
    }
  }

  function getJson(url) {
    return fetch(url, { cache: 'no-cache' }).then(function (res) {
      if (!res.ok) throw new Error(url + ' ' + res.status);
      return res.json();
    });
  }

  // Use the saved language straight away, so even the "could not load" page is in the right language.
  try {
    var early = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (early && I.languages.indexOf(early.lang) !== -1) { state.lang = early.lang; I.setLang(state.lang); }
  } catch (e) { /* ignore */ }
  document.getElementById('lang-toggle').addEventListener('click', switchLanguage);
  ['simple', 'full'].forEach(function (m) {
    var b = document.getElementById('mode-' + m);
    if (b) b.addEventListener('click', function () { setMode(m); });
  });
  applyMode();
  // Screens are redrawn on every visit; the app decides where to scroll (and Back closes the picker sheet).
  try { if ('scrollRestoration' in history) history.scrollRestoration = 'manual'; } catch (e) { /* ignore */ }

  // Offline support for the installed app. Never on file:// (browsers do not allow it there).
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () { /* the app still works online */ });
    });
  }

  Promise.all(['data/herbs.json', 'data/drugs.json', 'data/interactions.json', 'data/official.json', 'data/reviews.json'].map(getJson))
    .then(function (d) {
      db = L.createDb(d[0], d[1], d[2], d[3], d[4]);
      drugGroups = Array.isArray(d[1].groups) ? d[1].groups : [];
      load();
      I.setLang(state.lang);
      window.addEventListener('hashchange', function () { render(true); });
      document.querySelector('.skip-link').addEventListener('click', function (ev) {
        ev.preventDefault();
        document.getElementById('main').focus();
      });
      render(false);
    })
    .catch(function (err) {
      if (window.console) console.error(err);
      renderError();
    });
})();
