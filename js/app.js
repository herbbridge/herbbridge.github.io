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
  var state = { herbs: [], drugs: [], lang: 'en' };
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
        if (Array.isArray(saved.herbs)) state.herbs = saved.herbs.filter(function (id) { return db.herbById[id]; });
        if (Array.isArray(saved.drugs)) state.drugs = saved.drugs.filter(function (id) { return db.drugById[id]; });
        if (I.languages.indexOf(saved.lang) !== -1) state.lang = saved.lang;
      }
    } catch (e) { /* private mode or blocked storage: start empty */ }
  }
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }

  function toggle(kind, id) {
    var list = state[kind];
    var i = list.indexOf(id);
    if (i === -1) list.push(id); else list.splice(i, 1);
    save();
  }

  /* ---------- Check screen ---------- */

  function picker(kind, number) {
    var items = kind === 'herbs' ? db.herbs : db.drugs;
    var byId = kind === 'herbs' ? db.herbById : db.drugById;
    var titleKey = kind === 'herbs' ? 'herbs_title' : 'drugs_title';
    var inputId = 'search-' + kind;
    var query = '';

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
            type: 'button', class: 'chip', 'aria-label': t('remove_item', { name: item.name_en + ' ' + item.name_zh }),
            onclick: function () { toggle(kind, id); refresh(); }
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
            onclick: function () { toggle(kind, item.id); refresh(); }
          }, [
            nameNode(item),
            el('span', { class: 'option-state' }, [icon(on ? 'tick' : 'plus'), el('span', { text: on ? t('added') : t('add') })])
          ])
        ]));
      });
    }

    function refresh() { renderChips(); renderOptions(); updateCheckBar(); }

    input.addEventListener('input', function () { query = input.value; renderOptions(); });

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
      options
    ]);
  }

  var checkBar = null;
  function updateCheckBar() {
    if (!checkBar) return;
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
    checkBar = { button: button, status: status };

    var clear = el('button', {
      type: 'button', class: 'btn btn-quiet',
      onclick: function () {
        if (!state.herbs.length && !state.drugs.length) return;
        if (window.confirm(t('clear_confirm'))) { state.herbs = []; state.drugs = []; save(); render(); }
      }
    }, [el('span', { text: t('clear_all') })]);

    app.textContent = '';
    app.appendChild(el('section', { class: 'hero' }, [
      el('h1', { class: 'display', tabindex: '-1', text: t('hero_title') }),
      el('p', { class: 'lede', text: t('hero_lede') })
    ]));
    app.appendChild(picker('herbs', '01'));
    app.appendChild(picker('drugs', '02'));
    app.appendChild(el('div', { class: 'check-bar' }, [
      el('div', { class: 'check-bar-inner' }, [status, button])
    ]));
    app.appendChild(el('div', { class: 'below-bar' }, [clear]));
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
      el('span', { class: 'pair-plus', 'aria-hidden': 'true', text: '+' }),
      el('span', { class: 'visually-hidden', text: ' and ' }),
      nameNode(r.drug)
    ]);
  }

  function block(label, content, cls) {
    return el('div', { class: 'block ' + (cls || '') }, [el('h4', { class: 'block-label', text: label })].concat(content));
  }

  function card(r) {
    if (!r.entry) {
      return el('article', { class: 'card card-unknown' }, [
        el('header', { class: 'card-head' }, [badge('not_in_database'), pairTitle(r)]),
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
    var sources = el('ol', { class: 'sources' });
    e.sources.forEach(function (s) {
      sources.appendChild(el('li', null, [
        el('a', { href: s.url, target: '_blank', rel: 'noopener noreferrer' }, [
          el('span', { text: s.label }), icon('external', 'ext'),
          el('span', { class: 'visually-hidden', text: ' ' + t('opens_new_tab') })
        ])
      ]));
    });
    var evidence = el('ul', { class: 'evidence' });
    e.evidence_level.forEach(function (lvl) { evidence.appendChild(el('li', { text: t('ev_' + lvl) })); });

    return el('article', { class: 'card card-' + e.risk }, [
      el('header', { class: 'card-head' }, [badge(e.risk, e.watch), pairTitle(r)]),
      el('p', { class: 'effect', text: field(e, 'effect') }),
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

  /* ---------- placeholder and error screens ---------- */

  function renderComingSoon(titleKey) {
    app.textContent = '';
    app.appendChild(el('section', { class: 'results-head' }, [
      el('h1', { tabindex: '-1', text: t(titleKey) }),
      el('p', { class: 'lede', text: t('coming_soon_text') }),
      el('a', { class: 'btn btn-secondary', href: '#/check', text: t('back_to_check') })
    ]));
  }

  function renderError() {
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
    document.documentElement.lang = state.lang === 'zh' ? 'zh-HK' : 'en-GB';
    Array.prototype.forEach.call(document.querySelectorAll('[data-i18n]'), function (node) {
      node.textContent = t(node.getAttribute('data-i18n'));
    });
  }

  function render(focus) {
    var route = currentRoute();
    checkBar = null;
    applyStaticText();
    Array.prototype.forEach.call(document.querySelectorAll('[data-route-link]'), function (a) {
      if (a.getAttribute('data-route-link') === route) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    document.body.setAttribute('data-route', route);
    if (route === 'results') renderResults();
    else if (route === 'summary') renderComingSoon('nav_summary');
    else if (route === 'about') renderComingSoon('nav_about');
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

  Promise.all(['data/herbs.json', 'data/drugs.json', 'data/interactions.json'].map(getJson))
    .then(function (d) {
      db = L.createDb(d[0], d[1], d[2]);
      load();
      I.setLang(state.lang);
      window.addEventListener('hashchange', function () { render(true); });
      render(false);
    })
    .catch(function (err) {
      if (window.console) console.error(err);
      renderError();
    });
})();
