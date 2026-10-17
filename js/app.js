/*
 * HerbSafe app: pick lists, results cards and routing.
 * All medical content comes from data/*.json via js/lookup.js. Nothing is generated.
 * Data text is always inserted with textContent, never as HTML.
 */
(function () {
  'use strict';

  var L = window.HerbSafeLookup;
  var I = window.HerbSafeI18n;
  var t = I.t;
  var STORAGE_KEY = 'herbsafe.v1';

  var db = null;
  var state = { herbs: [], drugs: [], lang: 'en', demo: false };
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
    close: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 7l10 10M17 7 7 17" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
    plus: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 6v12M6 12h12" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
    tick: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5.5 12.5l4 4 9-9" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    external: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };
  function icon(name, cls) {
    var span = el('span', { class: 'icon ' + (cls || '') });
    span.innerHTML = ICONS[name];
    return span;
  }

  function primaryName(item) { return state.lang === 'zh' ? item.name_zh : item.name_en; }
  function secondaryName(item) { return state.lang === 'zh' ? item.name_en : item.name_zh; }
  function nameNode(item) {
    return el('span', { class: 'name' }, [
      el('span', { class: 'name-primary', text: primaryName(item), lang: state.lang === 'zh' ? 'zh-HK' : 'en-GB' }),
      ' ',
      el('span', { class: 'name-secondary', text: secondaryName(item), lang: state.lang === 'zh' ? 'en-GB' : 'zh-HK' })
    ]);
  }
  function field(entry, base) {
    var zh = entry[base + '_zh'];
    return state.lang === 'zh' && zh ? zh : entry[base + '_en'];
  }

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
    return rows.filter(function (r) { return r.entry && r.entry.risk !== 'none_reported'; });
  }

  /* Warnings for clashes found while adding items. They build up until the user closes them,
     each pair keeps its own rating, and they are not saved. */
  var alertState = null;
  function pairKey(r) { return r.herb.id + '|' + r.drug.id; }

  function addOrRemove(kind, id, sourceEl) {
    var anchorKey = sourceEl && sourceEl.getAttribute('data-key');
    var anchorTop = anchorKey ? sourceEl.getBoundingClientRect().top : null;
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
    // The warning and cabinet above the lists grow or shrink; scroll so the tapped row stays
    // where the finger is, and a quick second tap cannot land on a different item.
    if (anchorKey) {
      var again = findByKey(anchorKey);
      if (again) window.scrollBy(0, again.getBoundingClientRect().top - anchorTop);
    }
    return added;
  }

  function findByKey(key) {
    var target = app.querySelector('[data-key="' + key + '"]');
    // A removed chip disappears: use the same item in the list instead.
    if (!target && key.indexOf('chip-') === 0) target = app.querySelector('[data-key="opt-' + key.slice(5) + '"]');
    return target;
  }

  /* Short spoken message for screen readers when new clashes appear (once, not on every redraw). */
  function announce(rows) {
    var live = document.getElementById('sr-alert');
    if (!live) return;
    live.textContent = '';
    var msg = rows.map(function (r) {
      return t('warn_sr', { herb: primaryName(r.herb), drug: primaryName(r.drug), risk: t(r.status === 'low' && r.entry.watch ? 'risk_low_watch' : 'risk_' + r.status) });
    }).join(' ');
    window.setTimeout(function () { live.textContent = msg; }, 50);
  }

  /* ---------- Check screen ---------- */

  function picker(kind, number) {
    var items = kind === 'herbs' ? db.herbs : db.drugs;
    var byId = kind === 'herbs' ? db.herbById : db.drugById;
    var titleKey = kind === 'herbs' ? 'herbs_title' : 'drugs_title';
    var inputId = 'search-' + kind;
    var query = queries[kind];

    var chips = el('ul', { class: 'chips', 'aria-label': t(titleKey) });
    var count = el('p', { class: 'picker-count' });
    var options = el('ul', { class: 'options' });
    var input = el('input', {
      id: inputId, class: 'search', type: 'search', autocomplete: 'off', autocapitalize: 'off',
      spellcheck: 'false', enterkeyhint: 'search',
      'aria-controls': 'options-' + kind, 'aria-describedby': 'hint-' + kind
    });
    options.id = 'options-' + kind;

    function renderChips() {
      chips.textContent = '';
      state[kind].forEach(function (id) {
        var item = byId[id];
        chips.appendChild(el('li', null, [
          el('button', {
            type: 'button', class: 'chip', 'data-key': 'chip-' + kind + '-' + id,
            'aria-label': t('remove_item', { name: primaryName(item) + ' ' + secondaryName(item) }),
            onclick: function (ev) { addOrRemove(kind, id, ev.currentTarget); }
          }, [nameNode(item), icon('close', 'chip-x')])
        ]));
      });
      count.textContent = state[kind].length ? t('selected_count', { n: state[kind].length }) : t('selected_none');
    }

    function renderOptions() {
      options.textContent = '';
      var found = L.search(items, query);
      if (!found.length) {
        options.appendChild(el('li', { class: 'no-match', text: t('no_matches', { q: query }) }));
        return;
      }
      found.forEach(function (item) {
        var on = state[kind].indexOf(item.id) !== -1;
        options.appendChild(el('li', null, [
          el('button', {
            type: 'button', class: 'option' + (on ? ' is-on' : ''), 'aria-pressed': on ? 'true' : 'false',
            'data-key': 'opt-' + kind + '-' + item.id,
            onclick: function (ev) { addOrRemove(kind, item.id, ev.currentTarget); }
          }, [
            nameNode(item),
            el('span', { class: 'option-state', 'aria-hidden': 'true' }, [icon(on ? 'tick' : 'plus'), el('span', { text: on ? t('added') : t('add') })])
          ])
        ]));
      });
    }

    pickerRefreshers.push(function () { renderChips(); renderOptions(); });

    input.value = query;
    input.addEventListener('input', function () { query = queries[kind] = input.value; renderOptions(); });

    renderChips();
    renderOptions();

    return el('section', { class: 'picker', 'aria-labelledby': 'h-' + kind }, [
      el('div', { class: 'section-head' }, [
        el('span', { class: 'section-no', text: number, 'aria-hidden': 'true' }),
        el('h2', { id: 'h-' + kind, text: t(titleKey) })
      ]),
      count,
      chips,
      el('label', { class: 'search-label', for: inputId, text: kind === 'herbs' ? t('search_herbs') : t('search_drugs') }),
      el('p', { class: 'search-hint', id: 'hint-' + kind, text: t('search_hint') }),
      input,
      options,
      el('p', { class: 'where-tip', text: t(kind === 'herbs' ? 'where_herbs' : 'where_drugs') })
    ]);
  }

  var queries = { herbs: '', drugs: '' };
  var pickerRefreshers = [];
  var cabinetPanel = null;
  var demoBox = null;

  function refreshCheck() {
    var active = document.activeElement;
    var key = active && active.getAttribute ? active.getAttribute('data-key') : null;
    pickerRefreshers.forEach(function (fn) { fn(); });
    renderDemo();
    renderCabinet();
    renderWarning();
    updateCheckBar();
    if (key) {
      var target = findByKey(key);
      if (target) target.focus({ preventScroll: true });
    }
  }

  /* Demo for the video: Mrs Wong already takes warfarin and amlodipine; danshen is added on camera.
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
      }, [el('span', { text: t('demo_add') })]),
      el('button', { type: 'button', class: 'btn btn-quiet btn-small', onclick: endDemo }, [el('span', { text: t('demo_end') })])
    ]));
  }

  /* Dashboard: what is in the cabinet and which combinations need attention. */
  function renderCabinet() {
    if (!cabinetPanel) return;
    cabinetPanel.textContent = '';
    cabinetPanel.appendChild(el('div', { class: 'section-head' }, [
      el('h2', { id: 'h-cabinet', tabindex: '-1', text: t('cabinet_title') })
    ]));
    cabinetPanel.appendChild(storageOk
      ? el('p', { class: 'cabinet-lede', text: t('cabinet_lede') })
      : el('p', { class: 'cabinet-storage-off', role: 'status', text: t('storage_off') }));

    var nH = state.herbs.length, nD = state.drugs.length;
    if (!nH && !nD) {
      cabinetPanel.appendChild(el('p', { class: 'cabinet-empty', text: t('cabinet_empty') }));
      cabinetPanel.appendChild(el('button', { type: 'button', class: 'btn btn-secondary btn-small demo-start', onclick: startDemo }, [el('span', { text: t('demo_button') })]));
      return;
    }
    cabinetPanel.appendChild(el('p', { class: 'cabinet-counts', text: I.tn('count_herbs', nH) + ' · ' + I.tn('count_drugs', nD) }));
    if (!nH || !nD) {
      cabinetPanel.appendChild(el('p', { class: 'cabinet-empty', text: t('cabinet_need_both') }));
      return;
    }

    var rows = L.checkPairs(db, state.herbs, state.drugs);
    var flagged = rows.filter(function (r) { return r.entry && r.entry.risk !== 'none_reported'; });
    var unknown = rows.filter(function (r) { return !r.entry; }).length;

    if (flagged.length) {
      cabinetPanel.appendChild(el('p', { class: 'cabinet-alert-title', text: I.tn('cabinet_clashes', flagged.length) }));
      var list = el('ul', { class: 'clash-list' });
      flagged.forEach(function (r) {
        list.appendChild(el('li', { class: 'clash-row clash-' + r.status }, [
          badge(r.status, r.entry.watch),
          el('span', { class: 'clash-pair' }, [
            el('span', { text: primaryName(r.herb) }), ' ', el('span', { class: 'pair-plus', 'aria-hidden': 'true', text: '+' }), ' ',
            el('span', { class: 'visually-hidden', text: ' ' + t('and_sr') + ' ' }), el('span', { text: primaryName(r.drug) })
          ])
        ]));
      });
      cabinetPanel.appendChild(list);
    } else {
      cabinetPanel.appendChild(el('p', { class: 'cabinet-clear', text: t('cabinet_no_rated') }));
    }
    if (unknown) cabinetPanel.appendChild(el('p', { class: 'cabinet-unknown' }, [icon('not_in_database'), el('span', { text: I.tn('cabinet_unknown', unknown) })]));
    cabinetPanel.appendChild(el('a', { class: 'btn btn-secondary btn-small', href: '#/results', text: t('cabinet_see_all') }));
  }

  var warningPanel = null;
  function renderWarning() {
    if (!warningPanel) return;
    warningPanel.textContent = '';
    warningPanel.hidden = !alertState;
    if (!alertState) return;
    var list = el('ul', { class: 'warning-list' });
    alertState.rows.forEach(function (r) {
      list.appendChild(el('li', { class: 'clash-row' }, [
        badge(r.status, r.entry.watch),
        el('span', { class: 'clash-pair' }, [
          el('span', { text: primaryName(r.herb) }), ' ', el('span', { class: 'pair-plus', 'aria-hidden': 'true', text: '+' }), ' ',
          el('span', { class: 'visually-hidden', text: t('and_sr') + ' ' }), el('span', { text: primaryName(r.drug) })
        ])
      ]));
    });
    warningPanel.appendChild(el('h2', { id: 'h-warning', text: I.tn('warn_title', alertState.rows.length) }));
    warningPanel.appendChild(list);
    warningPanel.appendChild(el('div', { class: 'alert-actions' }, [
      el('a', { class: 'btn btn-primary btn-small', href: '#/results', text: t('alert_details') }),
      el('button', {
        type: 'button', class: 'btn btn-secondary btn-small',
        onclick: function () {
          alertState = null; renderWarning(); updateCheckBar();
          var h = document.getElementById('h-cabinet');
          if (h) h.focus();
        }
      }, [el('span', { text: t('alert_dismiss') })])
    ]));
  }

  function showWarning() {
    if (!warningPanel) return;
    warningPanel.scrollIntoView({ block: 'start', behavior: 'smooth' });
    warningPanel.focus({ preventScroll: true });
  }

  var checkBar = null;
  function updateCheckBar() {
    if (!checkBar) return;
    checkBar.notice.hidden = !alertState;
    if (alertState) {
      var top = alertState.rows[0];
      checkBar.notice.textContent = '';
      checkBar.notice.appendChild(icon(top.status));
      checkBar.notice.appendChild(el('span', { text: I.tn('bar_notice', alertState.rows.length) }));
    }
    var ready = state.herbs.length > 0 && state.drugs.length > 0;
    checkBar.button.disabled = !ready;
    checkBar.button.setAttribute('aria-describedby', 'check-status');
    checkBar.status.textContent = ready
      ? I.tn('count_herbs', state.herbs.length) + ' · ' + I.tn('count_drugs', state.drugs.length)
      : t('check_need_both');
  }

  function renderCheck() {
    var status = el('p', { id: 'check-status', class: 'check-status' });
    var button = el('button', {
      type: 'button', class: 'btn btn-primary btn-check',
      onclick: function () { if (!button.disabled) location.hash = '#/results'; }
    }, [el('span', { text: t('check_button') })]);
    var notice = el('button', { type: 'button', class: 'bar-notice', hidden: true, onclick: showWarning });
    checkBar = { button: button, status: status, notice: notice };

    var clear = el('button', {
      type: 'button', class: 'btn btn-quiet',
      onclick: function () {
        if (!state.herbs.length && !state.drugs.length) return;
        if (window.confirm(t('clear_confirm'))) {
          state.herbs = []; state.drugs = []; state.demo = false; delete state.demoBackup; alertState = null;
          queries = { herbs: '', drugs: '' };
          save(); render(true);
        }
      }
    }, [el('span', { text: t('clear_all') })]);

    var demo = el('button', { type: 'button', class: 'btn btn-quiet', onclick: startDemo }, [el('span', { text: t('demo_button') })]);

    app.textContent = '';
    var hasItems = state.herbs.length + state.drugs.length > 0;
    app.appendChild(el('section', { class: 'hero' + (hasItems ? ' hero-compact' : '') }, [
      el('h1', { class: 'display', tabindex: '-1', text: t('hero_title') }),
      el('p', { class: 'lede', text: t('hero_lede') })
    ]));
    pickerRefreshers = [];
    demoBox = el('section', { class: 'demo-banner', 'aria-labelledby': 'h-demo', hidden: true });
    app.appendChild(demoBox);
    warningPanel = el('section', { class: 'clash-alert', tabindex: '-1', 'aria-labelledby': 'h-warning', hidden: true });
    app.appendChild(warningPanel);
    cabinetPanel = el('section', { class: 'cabinet', 'aria-labelledby': 'h-cabinet' });
    app.appendChild(cabinetPanel);
    app.appendChild(picker('herbs', '01'));
    app.appendChild(picker('drugs', '02'));
    app.appendChild(el('div', { class: 'check-bar' }, [
      el('div', { class: 'check-bar-inner' }, [notice, status, button])
    ]));
    app.appendChild(el('div', { class: 'below-bar' }, [clear, ' ', demo]));
    renderDemo();
    renderCabinet();
    renderWarning();
    updateCheckBar();
  }

  /* ---------- Results screen ---------- */

  function badge(status, watch) {
    var key = status === 'low' && watch ? 'risk_low_watch' : 'risk_' + status;
    return el('p', { class: 'badge badge-' + status }, [icon(status), el('span', { text: t(key) })]);
  }

  function pairTitle(r) {
    return el('h3', { class: 'pair' }, [
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

  function mainEvidence(e) {
    var s = e.sources[e.main_source];
    return el('div', { class: 'main-evidence' }, [
      el('h4', { class: 'block-label', text: t('label_main_evidence') }),
      el('p', { class: 'main-finding', text: field(e, 'main_finding') }),
      el('p', { class: 'main-source' }, [
        el('a', { href: s.url, target: '_blank', rel: 'noopener noreferrer' }, [
          el('span', { text: s.label }), icon('external', 'ext'),
          el('span', { class: 'visually-hidden', text: ' ' + t('opens_new_tab') })
        ]),
        el('span', { class: 'print-url', text: s.url })
      ])
    ]);
  }

  function block(label, content, cls) {
    return el('div', { class: 'block ' + (cls || '') }, [el('h4', { class: 'block-label', text: label })].concat(content));
  }

  function card(r) {
    if (!r.entry) {
      return el('article', { class: 'card card-unknown' }, [
        el('header', { class: 'card-head' }, [pairTitle(r), badge('not_in_database')]),
        el('p', { class: 'unknown-text', text: t('not_in_db_text') }),
        el('p', { class: 'card-disclaimer', text: t('card_disclaimer') })
      ]);
    }
    var e = r.entry;
    var why = field(e, 'why');
    var whyBlock = [el('p', { text: why || t('why_none') })];
    if (e.why_pro_en) {
      whyBlock.push(el('details', { class: 'pro' }, [
        el('summary', { text: t('label_for_pros') }),
        el('p', { lang: 'en-GB', text: e.why_pro_en }),
        state.lang === 'zh' ? el('p', { class: 'muted', text: t('pro_english_only') }) : null
      ]));
    }
    var sources = sourceList(e.sources);
    var evidence = el('ul', { class: 'evidence' });
    e.evidence_level.forEach(function (lvl) { evidence.appendChild(el('li', { text: t('ev_' + lvl) })); });

    return el('article', { class: 'card card-' + e.risk }, [
      el('header', { class: 'card-head' }, [pairTitle(r), badge(e.risk, e.watch), levelMeaning(e.risk)]),
      el('p', { class: 'effect', text: field(e, 'effect') }),
      mainEvidence(e),
      block(t('label_why'), whyBlock),
      block(t('label_what_to_do'), [el('p', { class: 'action', text: field(e, 'action') })], 'block-action'),
      el('div', { class: 'meta' }, [
        block(t('label_evidence'), [evidence]),
        block(t('label_rated_by'), [el('p', { text: e.rating_source === 'HA' ? t('rated_by_ha') : t('rated_by_team') })])
      ]),
      block(t('label_sources'), [sources]),
      el('p', { class: 'card-disclaimer', text: t('card_disclaimer') })
    ]);
  }

  function renderResults() {
    app.textContent = '';
    var results = L.checkPairs(db, state.herbs, state.drugs);
    var head = el('section', { class: 'results-head' }, [
      el('h1', { tabindex: '-1', text: t('results_title') })
    ]);
    app.appendChild(head);

    if (!results.length) {
      head.appendChild(el('p', { class: 'lede', text: t('results_empty') }));
      head.appendChild(el('a', { class: 'btn btn-primary', href: '#/check', text: t('back_to_check') }));
      return;
    }

    var flagged = results.filter(function (r) { return r.entry && r.entry.risk !== 'none_reported'; }).length;
    var unknown = results.filter(function (r) { return !r.entry; }).length;
    head.appendChild(el('p', { class: 'lede', text: t('results_intro') }));
    var tally = el('ul', { class: 'tally' });
    if (flagged) tally.appendChild(el('li', { class: 'tally-flagged', text: t('results_counts_flagged', { n: flagged }) }));
    if (unknown) tally.appendChild(el('li', { class: 'tally-unknown', text: t('results_counts_unknown', { n: unknown }) }));
    head.appendChild(tally);
    head.appendChild(el('p', { class: 'disclaimer-box', text: t('card_disclaimer') }));

    var list = el('ol', { class: 'cards' });
    results.forEach(function (r) { list.appendChild(el('li', null, [card(r)])); });
    app.appendChild(list);

    app.appendChild(el('div', { class: 'actions' }, [
      el('a', { class: 'btn btn-secondary', href: '#/check', text: t('edit_list') }),
      el('a', { class: 'btn btn-primary', href: '#/summary', text: t('to_summary') })
    ]));
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
      ol.appendChild(el('li', null, [
        el('a', { href: s.url, target: '_blank', rel: 'noopener noreferrer' }, [
          el('span', { text: s.label }), icon('external', 'ext'),
          el('span', { class: 'visually-hidden', text: ' ' + t('opens_new_tab') })
        ]),
        el('span', { class: 'print-url', text: s.url })
      ]));
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
      el('p', { class: 'summary-kicker', text: 'HerbSafe 中西通 · ' + t('summary_title') }),
      el('h1', { tabindex: '-1', text: t('summary_headline') }),
      el('p', { class: 'muted', text: t('summary_generated', { date: formatDate(new Date()) }) })
    ]));

    if (!state.herbs.length && !state.drugs.length) {
      page.appendChild(el('p', { class: 'lede', text: t('summary_empty') }));
      page.appendChild(el('a', { class: 'btn btn-primary no-print', href: '#/check', text: t('back_to_check') }));
      return;
    }

    page.appendChild(el('div', { class: 'no-print summary-actions' }, [
      el('button', { type: 'button', class: 'btn btn-primary', onclick: function () { window.print(); } }, [el('span', { text: t('summary_print') })]),
      el('a', { class: 'btn btn-secondary', href: '#/check', text: t('edit_list') })
    ]));

    page.appendChild(el('section', { class: 'summary-lists' }, [
      el('div', null, [el('h2', { text: t('summary_herbs') }), itemList(state.herbs.map(function (id) { return db.herbById[id]; }))]),
      el('div', null, [el('h2', { text: t('summary_drugs') }), itemList(state.drugs.map(function (id) { return db.drugById[id]; }))])
    ]));

    var rows = L.checkPairs(db, state.herbs, state.drugs);
    var rated = rows.filter(function (r) { return r.entry; });
    var unknown = rows.filter(function (r) { return !r.entry; });

    var flaggedSection = el('section', { class: 'summary-section' }, [el('h2', { text: t('summary_flagged') })]);
    if (!rated.length) flaggedSection.appendChild(el('p', { text: state.herbs.length && state.drugs.length ? t('summary_flagged_none') : t('cabinet_need_both') }));
    rated.forEach(function (r) {
      var e = r.entry;
      var evidence = e.evidence_level.map(function (l) { return t('ev_' + l); }).join(' · ');
      flaggedSection.appendChild(el('div', { class: 'summary-row summary-' + e.risk }, [
        el('div', { class: 'summary-row-head' }, [badge(e.risk, e.watch), bilingualPair(r)]),
        el('dl', { class: 'summary-dl' }, [
          el('dt', { text: t('label_rated_by') }), el('dd', { text: e.rating_source === 'HA' ? t('rated_by_ha') : t('rated_by_team') }),
          el('dt', { text: t('label_main_evidence') }), el('dd', { text: field(e, 'main_finding') + ' (' + e.sources[e.main_source].label + ')' }),
          el('dt', { text: t('col_effect') }), el('dd', { text: field(e, 'effect') }),
          el('dt', { text: t('label_what_to_do') }), el('dd', { text: field(e, 'action') }),
          el('dt', { text: t('label_evidence') }), el('dd', { text: evidence }),
          el('dt', { text: t('label_sources') }), el('dd', null, [sourceList(e.sources)])
        ])
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
      ]));
    }

    page.appendChild(el('p', { class: 'disclaimer-box summary-disclaimer', text: t('card_disclaimer') }));
    if (state.lang === 'zh' && zhUnreviewed()) page.appendChild(el('p', { class: 'muted zh-note', text: t('zh_unreviewed_note') }));
  }

  /* ---------- About ---------- */

  function pairLabel(e) {
    var herb = db.herbById[e.herb_id];
    var other = e.drug_id ? primaryName(db.drugById[e.drug_id]) : t('class_' + e.drug_class);
    return primaryName(herb) + ' + ' + other;
  }

  function renderAbout() {
    app.textContent = '';
    var page = el('article', { class: 'about' });
    app.appendChild(page);
    function section(titleKey, children) {
      return el('section', { class: 'about-section' }, [el('h2', { text: t(titleKey) })].concat(children));
    }

    page.appendChild(el('header', { class: 'results-head' }, [
      el('h1', { tabindex: '-1', text: t('about_title') }),
      el('p', { class: 'lede', text: t('about_intro') })
    ]));

    page.appendChild(section('about_how_title', [el('p', { text: t('about_how') })]));

    var scale = el('ol', { class: 'scale' });
    L.RISKS.forEach(function (risk) { scale.appendChild(el('li', null, [badge(risk), levelMeaning(risk)])); });
    page.appendChild(section('about_ratings_title', [
      el('p', { text: t('about_ratings_intro') }),
      scale,
      el('p', null, [badge('low', true)]),
      el('p', { text: t('about_low_watch') }),
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

    page.appendChild(section('about_disclaimer_title', [el('p', { class: 'disclaimer-box', text: t('card_disclaimer') })]));
    page.appendChild(section('about_privacy_title', [el('p', { text: t('about_privacy') })]));

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
    page.appendChild(section('about_sources_title', [
      el('p', { text: t('about_sources_intro') }),
      list,
      db.lastUpdated ? el('p', { class: 'muted', text: t('about_updated', { date: formatDate(new Date(db.lastUpdated + 'T00:00:00')) }) }) : null
    ]));

    var next = el('ul', { class: 'about-next' });
    ['about_next_1', 'about_next_2', 'about_next_3', 'about_next_4'].forEach(function (k) { next.appendChild(el('li', { text: t(k) })); });
    page.appendChild(section('about_next_title', [next, el('p', { class: 'muted', text: t('about_team') })]));
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

  function currentRoute() {
    var r = (location.hash || '').replace(/^#\/?/, '');
    return ['check', 'results', 'summary', 'about'].indexOf(r) !== -1 ? r : 'check';
  }

  function applyStaticText() {
    var zh = state.lang === 'zh';
    document.documentElement.lang = zh ? 'zh-HK' : 'en-GB';
    Array.prototype.forEach.call(document.querySelectorAll('[data-i18n]'), function (node) {
      node.textContent = t(node.getAttribute('data-i18n'));
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-i18n-label]'), function (node) {
      node.setAttribute('aria-label', t(node.getAttribute('data-i18n-label')));
    });
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
    return !I.zhReviewed || db.herbs.concat(db.drugs, db.interactions).some(function (x) { return x.zh_reviewed !== true; });
  }

  function switchLanguage() {
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
    checkBar = null;
    cabinetPanel = null;
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
    if (route === 'results') renderResults();
    else if (route === 'summary') renderSummary();
    else if (route === 'about') renderAbout();
    else renderCheck();
    if (focus) {
      window.scrollTo(0, 0);
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

  Promise.all(['data/herbs.json', 'data/drugs.json', 'data/interactions.json'].map(getJson))
    .then(function (d) {
      db = L.createDb(d[0], d[1], d[2]);
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
