/*
 * HerbBridge "Identify from a photo": reads the printed words on a medicine box ON THIS DEVICE
 * (Tesseract OCR, English + Traditional Chinese) and matches them to names HerbBridge already lists
 * (generic, brand, Chinese and romanised names). It shows the top matches with the words it found;
 * nothing is added until the person confirms. The photo is never uploaded or saved.
 * A trained image model can be added later through the same candidate format (see addModel).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(null);
  else root.HerbBridgePhotoId = factory(root);
})(typeof self !== 'undefined' ? self : this, function (win) {
  'use strict';

  var VENDOR = 'js/vendor/tesseract/';
  var MAX_SIDE = 1600;

  /* ---------- pure matching (testable in Node) ---------- */

  function norm(text) {
    return String(text == null ? '' : text).normalize('NFKC').toLowerCase()
      .replace(/[\s\-_'’.,()\/·:;|®™©*]+/g, '');
  }
  function isCJK(s) { return /[㐀-鿿]/.test(s); }

  // Terms that name a whole class, not one medicine: they can support a match but never decide it.
  var CLASS_TERMS = { statin: 1, '他汀': 1 };

  function termsFor(item) {
    var latin = item.latin ? String(item.latin).split('/').map(function (s) { return s.trim(); }) : [];
    return [item.name_en, item.name_zh].concat(latin, item.aliases || []).filter(Boolean).map(function (raw) {
      var n = norm(raw);
      return { raw: raw, n: n, cjk: isCJK(n), generic: !!CLASS_TERMS[n] };
    }).filter(function (t) { return t.cjk ? t.n.length >= 2 : t.n.length >= 4; });
  }

  // Edit distance with an early exit once it is above max.
  function within(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return false;
    var prev = [], cur, i, j;
    for (j = 0; j <= b.length; j++) prev[j] = j;
    for (i = 1; i <= a.length; i++) {
      cur = [i]; var best = i;
      for (j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (cur[j] < best) best = cur[j];
      }
      if (best > max) return false;
      prev = cur;
    }
    return prev[b.length] <= max;
  }

  /* text → [{ kind, id, item, score, words: [matched raw terms] }] best first (max 3).
     Exact appearance of a name scores by its length; a near miss (one wrong letter, Latin names
     of 6+ letters only) scores less. Class words alone (e.g. "statin") never make a candidate. */
  function matchText(db, text) {
    var whole = norm(text);
    var tokens = String(text || '').normalize('NFKC').toLowerCase().split(/[^a-z㐀-鿿]+/).filter(function (t) { return t.length >= 6; });
    if (!whole) return [];
    var out = [];
    [['herbs', db.herbs], ['drugs', db.drugs]].forEach(function (group) {
      group[1].forEach(function (item) {
        var score = 0, words = [], decisive = false;
        termsFor(item).forEach(function (term) {
          var hit = 0;
          if (whole.indexOf(term.n) !== -1) hit = term.cjk ? 3 * term.n.length : term.n.length;
          else if (!term.cjk && term.n.length >= 6 && tokens.some(function (tok) { return within(tok, term.n, 1); })) hit = term.n.length * 0.6;
          if (hit) {
            if (term.generic) hit = Math.min(hit, 2); else decisive = true;
            if (words.indexOf(term.raw) === -1) { score += hit; words.push(term.raw); }
          }
        });
        if (decisive) out.push({ kind: group[0], id: item.id, item: item, score: Math.round(score * 10) / 10, words: words });
      });
    });
    out.sort(function (a, b) { return b.score - a.score || a.item.name_en.localeCompare(b.item.name_en); });
    return out.slice(0, 3);
  }

  var WORDS = {
    en: {
      photo_button: 'Identify from a photo',
      photo_title: 'Identify from a photo',
      photo_help: 'Take a clear photo of the front of the box, with the medicine name in focus. The photo is read on this device and never uploaded or saved.',
      photo_take: 'Take or choose a photo',
      photo_reading: 'Reading the words on the box…',
      photo_loading: 'Getting the text reader ready (first time only)…',
      photo_failed: 'The words could not be read. Try a sharper photo with more light, or search by name.',
      photo_found_title: 'Which one is on your box?',
      photo_found_help: 'Matched from words read on the box. Pick the one that matches, then confirm.',
      photo_words: 'Words found:',
      photo_none_title: 'No match found',
      photo_none_help: 'HerbBridge could not match the words on this box to a medicine or herb it covers. Search by name instead.',
      photo_read_text: 'Text read from the photo',
      photo_retry: 'Try another photo',
      photo_search: 'Search by name',
      confirm_title: 'Is this your medicine?',
      confirm_yes: 'Yes, add to my list',
      confirm_back: 'Back',
      confirm_already: 'This is already on your list.',
      confirm_check: 'Check that this name matches the words on your box before adding it.',
      kind_herbs: 'Chinese herb',
      kind_drugs: 'Western medicine',
      pick_none: 'No matching medicine or herb. HerbBridge may not cover it yet.',
      close: 'Close',
      disclaimer: 'Photo matching can be wrong. Always check the name on the pack yourself. HerbBridge gives information, not medical advice.'
    },
    zh: {
      photo_button: '影相認藥',
      photo_title: '影相認藥',
      photo_help: '請清楚影低藥盒正面，藥名要清晰。相片只會喺呢部裝置讀取，唔會上載或者儲存。',
      photo_take: '影相或者揀相',
      photo_reading: '讀緊藥盒上面嘅字…',
      photo_loading: '準備緊文字讀取（只係第一次需要）…',
      photo_failed: '讀唔到相入面嘅字。試下喺光啲嘅地方影清楚啲，或者用名稱搜尋。',
      photo_found_title: '你嘅藥盒係邊一隻？',
      photo_found_help: '根據藥盒上讀到嘅字配對。揀啱嗰隻，再確認。',
      photo_words: '讀到嘅字：',
      photo_none_title: '搵唔到相符嘅藥',
      photo_none_help: '中西通配對唔到呢個藥盒上嘅字。請改用名稱搜尋。',
      photo_read_text: '相片入面讀到嘅文字',
      photo_retry: '再影一張',
      photo_search: '用名稱搜尋',
      confirm_title: '呢隻係咪你嘅藥？',
      confirm_yes: '係，加入我嘅清單',
      confirm_back: '返回',
      confirm_already: '呢隻已經喺你嘅清單入面。',
      confirm_check: '加入之前，請核對呢個名稱同藥盒上嘅字一樣。',
      kind_herbs: '中藥',
      kind_drugs: '西藥',
      pick_none: '搵唔到相符嘅藥物或者中藥，中西通可能未有收錄。',
      close: '關閉',
      disclaimer: '影相配對可能會出錯。請自己再核對藥盒上嘅名稱。中西通只提供資訊，唔係醫療建議。'
    }
  };

  var api = { WORDS: WORDS, norm: norm, matchText: matchText, within: within, termsFor: termsFor };
  if (!win) return api;

  /* ---------- browser ---------- */

  var workerPromise = null;
  function abs(p) { return new URL(p, win.location.href).href; }
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      if (win.Tesseract) return resolve();
      var s = win.document.createElement('script'); s.src = src; s.onload = resolve; s.onerror = function () { reject(new Error('reader unavailable')); };
      win.document.head.appendChild(s);
    });
  }
  // Everything is loaded from HerbBridge itself (never a CDN) and only when someone uses this feature.
  function getWorker() {
    if (!workerPromise) {
      workerPromise = loadScript(VENDOR + 'tesseract.min.js').then(function () {
        return win.Tesseract.createWorker(['eng', 'chi_tra'], 1, {
          workerPath: abs(VENDOR + 'worker.min.js'),
          corePath: abs(VENDOR + 'core'),
          langPath: abs(VENDOR + 'lang'),
          workerBlobURL: false,
          gzip: true,
          cacheMethod: 'write'
        });
      }).catch(function (e) { workerPromise = null; throw e; });
    }
    return workerPromise;
  }

  // Draws the photo onto a canvas (this drops location and camera details) at a sensible size.
  function toCanvas(file) {
    return createImageBitmap(file, { imageOrientation: 'from-image' }).then(function (bmp) {
      var scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
      var c = win.document.createElement('canvas');
      c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
      c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
      if (bmp.close) bmp.close();
      return c;
    });
  }

  var models = []; // optional image models: function(canvas) → Promise<[{kind,id,score}]>
  function addModel(fn) { if (typeof fn === 'function') models.push(fn); }

  /* open({ db, lang, el, search, inList(kind,id), onAdd(kind,id), readText? }) */
  function open(opts) {
    var doc = win.document, el = opts.el, w = WORDS[opts.lang === 'zh' ? 'zh' : 'en'];
    var t = function (k) { return w[k] || k; };
    var closed = false, lastFocus = doc.activeElement;
    var title = el('h2', { id: 'photo-title', tabindex: '-1', text: t('photo_title') });
    var live = el('p', { class: 'scan-live', role: 'status', 'aria-live': 'polite' });
    var body = el('div', { class: 'scan-body' });
    var root = el('div', { class: 'sheet scan-sheet photo-sheet', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'photo-title', lang: opts.lang === 'zh' ? 'zh-HK' : 'en-GB' }, [
      el('div', { class: 'sheet-panel' }, [
        el('div', { class: 'sheet-body' }, [title, live, body]),
        el('div', { class: 'sheet-foot' }, [el('button', { type: 'button', class: 'btn btn-secondary', onclick: close }, [el('span', { text: t('close') })])])
      ])
    ]);
    root.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') close(); });
    doc.body.appendChild(root); background(true);
    start(); title.focus();

    function background(on) {
      ['.skip-link', '.site-header', '#main', '.site-footer'].forEach(function (sel) {
        var node = doc.querySelector(sel); if (!node) return;
        if (on) { node.setAttribute('inert', ''); node.setAttribute('aria-hidden', 'true'); } else { node.removeAttribute('inert'); node.removeAttribute('aria-hidden'); }
      });
      doc.documentElement.classList.toggle('sheet-open', on);
    }
    function close() { if (closed) return; closed = true; root.remove(); background(false); if (lastFocus && lastFocus.focus) lastFocus.focus(); }
    function say(k) { live.textContent = k ? t(k) : ''; }
    function heading(k) { title.textContent = t(k); }

    function start() {
      heading('photo_title'); say(''); body.textContent = '';
      var input = el('input', { type: 'file', id: 'photo-file', accept: 'image/*', capture: 'environment', class: 'photo-input' });
      input.addEventListener('change', function () { if (input.files && input.files[0]) read(input.files[0]); });
      body.appendChild(el('p', { class: 'search-hint', text: t('photo_help') }));
      body.appendChild(input);
      body.appendChild(el('label', { class: 'btn btn-primary photo-take', for: 'photo-file' }, [el('span', { text: t('photo_take') })]));
      body.appendChild(el('div', { class: 'scan-actions' }, [el('button', { type: 'button', class: 'btn btn-quiet', onclick: function () { pick(); } }, [el('span', { text: t('photo_search') })])]));
      body.appendChild(el('p', { class: 'where-tip', text: t('disclaimer') }));
    }

    async function read(file) {
      body.textContent = ''; say('photo_loading');
      var text = '', canvas = null;
      try {
        canvas = await toCanvas(file);
        if (opts.readText) { say('photo_reading'); text = await opts.readText(canvas); }
        else {
          var worker = await getWorker(); if (closed) return;
          say('photo_reading');
          var res = await worker.recognize(canvas);
          text = (res && res.data && res.data.text) || '';
        }
      } catch (e) { if (!closed) failed(); return; }
      if (closed) return;
      var candidates = matchText(opts.db, text);
      for (var i = 0; i < models.length && canvas; i++) {
        try { (await models[i](canvas)).forEach(function (m) { if (!candidates.some(function (c) { return c.kind === m.kind && c.id === m.id; })) { var item = (m.kind === 'herbs' ? opts.db.herbById : opts.db.drugById)[m.id]; if (item) candidates.push({ kind: m.kind, id: m.id, item: item, score: m.score, words: [], model: true }); } }); } catch (e) { /* model optional */ }
      }
      if (canvas) { canvas.width = 0; canvas.height = 0; } // drop the photo from memory
      say('');
      if (!candidates.length) return none(text);
      showCandidates(candidates.slice(0, 3), text);
    }

    function failed() { say(''); heading('photo_none_title'); body.textContent = ''; body.appendChild(el('p', { class: 'search-hint', text: t('photo_failed') })); body.appendChild(retryRow()); }
    function retryRow() {
      return el('div', { class: 'scan-actions' }, [
        el('button', { type: 'button', class: 'btn btn-secondary', onclick: start }, [el('span', { text: t('photo_retry') })]),
        el('button', { type: 'button', class: 'btn btn-quiet', onclick: function () { pick(); } }, [el('span', { text: t('photo_search') })])
      ]);
    }
    function textBox(text) {
      var clean = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 400);
      return clean ? el('details', { class: 'photo-text' }, [el('summary', { text: t('photo_read_text') }), el('p', { text: clean })]) : null;
    }
    function none(text) {
      heading('photo_none_title'); body.textContent = '';
      body.appendChild(el('p', { class: 'search-hint', text: t('photo_none_help') }));
      var box = textBox(text); if (box) body.appendChild(box);
      body.appendChild(retryRow());
    }
    function names(item) { return (opts.lang === 'zh' ? item.name_zh : item.name_en) + ' · ' + (opts.lang === 'zh' ? item.name_en : item.name_zh); }

    function showCandidates(list, text) {
      heading('photo_found_title'); body.textContent = '';
      body.appendChild(el('p', { class: 'search-hint', text: t('photo_found_help') }));
      var ul = el('ul', { class: 'options scan-options photo-candidates' });
      list.forEach(function (c) {
        ul.appendChild(el('li', null, [el('button', { type: 'button', class: 'option scan-option', 'data-key': c.kind + ':' + c.id, onclick: function () { confirm(c.kind, c.id, function () { showCandidates(list, text); }); } }, [
          el('span', { class: 'scan-option-name', text: names(c.item) }),
          el('span', { class: 'scan-kind', text: t('kind_' + c.kind) }),
          c.words.length ? el('span', { class: 'photo-words', text: t('photo_words') + ' ' + c.words.join(', ') }) : null
        ])]));
      });
      body.appendChild(ul);
      var box = textBox(text); if (box) body.appendChild(box);
      body.appendChild(retryRow());
      body.appendChild(el('p', { class: 'where-tip', text: t('disclaimer') }));
      var first = ul.querySelector('button'); if (first) first.focus();
    }

    function confirm(kind, id, back) {
      var item = (kind === 'herbs' ? opts.db.herbById : opts.db.drugById)[id];
      heading('confirm_title'); body.textContent = '';
      body.appendChild(el('div', { class: 'scan-medicine' }, [
        el('p', { class: 'scan-kind', text: t('kind_' + kind) }),
        el('p', { class: 'scan-name', text: opts.lang === 'zh' ? item.name_zh : item.name_en }),
        el('p', { class: 'scan-name-alt', text: opts.lang === 'zh' ? item.name_en : item.name_zh })
      ]));
      body.appendChild(el('p', { class: 'search-hint', text: t('confirm_check') }));
      var already = opts.inList(kind, id);
      if (already) body.appendChild(el('p', { class: 'scan-already', role: 'status', text: t('confirm_already') }));
      body.appendChild(el('div', { class: 'scan-actions' }, [
        already ? null : el('button', { type: 'button', class: 'btn btn-primary photo-yes', onclick: function () { opts.onAdd(kind, id); close(); } }, [el('span', { text: t('confirm_yes') })]),
        el('button', { type: 'button', class: 'btn btn-secondary', onclick: back }, [el('span', { text: t('confirm_back') })])
      ]));
      body.appendChild(el('p', { class: 'where-tip', text: t('disclaimer') }));
      var yes = body.querySelector('.photo-yes'); if (yes) yes.focus();
    }

    function pick() {
      heading('photo_search'); body.textContent = ''; say('');
      var input = el('input', { id: 'photo-search', class: 'search', type: 'search', autocomplete: 'off', spellcheck: 'false' });
      var ul = el('ul', { class: 'options scan-options' });
      var none2 = el('p', { class: 'where-tip', text: t('pick_none'), hidden: true });
      function fill() {
        ul.textContent = ''; var rows = [];
        opts.search(opts.db.herbs, input.value).forEach(function (h) { rows.push(['herbs', h]); });
        opts.search(opts.db.drugs, input.value).forEach(function (d) { rows.push(['drugs', d]); });
        rows.slice(0, 40).forEach(function (r) {
          ul.appendChild(el('li', null, [el('button', { type: 'button', class: 'option scan-option', onclick: function () { confirm(r[0], r[1].id, pick); } }, [
            el('span', { class: 'scan-option-name', text: names(r[1]) }), el('span', { class: 'scan-kind', text: t('kind_' + r[0]) })
          ])]));
        });
        none2.hidden = rows.length > 0;
      }
      input.addEventListener('input', fill);
      body.appendChild(el('label', { class: 'search-label', for: 'photo-search', text: t('photo_search') }));
      body.appendChild(input); body.appendChild(ul); body.appendChild(none2);
      body.appendChild(el('div', { class: 'scan-actions' }, [el('button', { type: 'button', class: 'btn btn-quiet', onclick: start }, [el('span', { text: t('photo_retry') })])]));
      fill(); input.focus();
    }

    return { close: close, read: read };
  }

  api.open = open;
  api.addModel = addModel;
  api.words = function (lang) { return WORDS[lang === 'zh' ? 'zh' : 'en']; };
  return api;
});
