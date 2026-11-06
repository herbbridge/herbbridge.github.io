/* Local QR generation and explicit sharing. Lists stay in the URL fragment;
 * nothing is copied, saved or sent until the user chooses an action. */
(function (root) {
  'use strict';

  var CANONICAL = 'https://herbbridge.org/';
  var MAX_HASH = 4096;
  var SVG_NS = 'http://www.w3.org/2000/svg';

  function encode(list) {
    if (!list || !Array.isArray(list.herbs) || !Array.isArray(list.drugs)) throw new TypeError('Invalid list');
    var json = JSON.stringify({ v: 1, h: list.herbs, d: list.drugs });
    if (!/^[\x00-\x7f]*$/.test(json)) throw new TypeError('List IDs must be ASCII');
    var value = root.btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    if (value.length + 13 > MAX_HASH) throw new RangeError('List is too long');
    return value;
  }

  function link(list) { return CANONICAL + '#/summary?l=' + encode(list); }

  function read(hash, db) {
    if (typeof hash !== 'string' || hash.indexOf('#/summary?') !== 0) return null;
    if (hash.length > MAX_HASH) return { valid: false };
    var match = /^#\/summary\?l=([A-Za-z0-9_-]+)$/.exec(hash);
    if (!match || match[1].length % 4 === 1) return { valid: false };
    try {
      var value = match[1].replace(/-/g, '+').replace(/_/g, '/');
      value += '==='.slice((value.length + 3) % 4);
      var raw = root.atob(value);
      if (!/^[\x00-\x7f]*$/.test(raw)) return { valid: false };
      var data = JSON.parse(raw);
      if (!data || typeof data !== 'object' || Array.isArray(data) || data.v !== 1) return { valid: false };
      var keys = Object.keys(data).sort().join(',');
      if (keys !== 'd,h,v' || !Array.isArray(data.h) || !Array.isArray(data.d) || !data.h.length && !data.d.length) return { valid: false };
      function validIds(ids, items) {
        if (!Array.isArray(items) || ids.length > items.length) return false;
        var known = new Set(items.map(function (item) { return item.id; }));
        var seen = new Set();
        return ids.every(function (id) {
          if (typeof id !== 'string' || !known.has(id) || seen.has(id) || id === '__proto__' || id === 'constructor' || id === 'prototype') return false;
          seen.add(id); return true;
        });
      }
      if (!validIds(data.h, db.herbs) || !validIds(data.d, db.drugs)) return { valid: false };
      return { valid: true, herbs: data.h.slice(), drugs: data.d.slice() };
    } catch (error) { return { valid: false }; }
  }

  function text(rows, url, formatPair, riskLabel, t) {
    var lines = [t('share_title')];
    rows.slice(0, 10).forEach(function (row) { lines.push(formatPair(row) + ': ' + riskLabel(row)); });
    if (rows.length > 10) lines.push(t('share_more', { n: rows.length - 10 }));
    lines.push(url);
    return lines.join('\n');
  }

  function qrFigure(url, t, el) {
    if (typeof root.qrcode !== 'function') throw new Error('QR library unavailable');
    var qr = root.qrcode(0, 'M');
    qr.addData(url); qr.make();
    var count = qr.getModuleCount(), size = count + 8;
    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + size + ' ' + size);
    svg.setAttribute('width', '180'); svg.setAttribute('height', '180');
    svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', t('share_qr_label'));
    svg.setAttribute('focusable', 'false'); svg.setAttribute('shape-rendering', 'crispEdges');
    var background = document.createElementNS(SVG_NS, 'rect');
    background.setAttribute('width', String(size)); background.setAttribute('height', String(size));
    background.setAttribute('fill', '#fff'); svg.appendChild(background);
    var commands = [];
    for (var y = 0; y < count; y++) for (var x = 0; x < count; x++) {
      if (qr.isDark(y, x)) commands.push('M' + (x + 4) + ' ' + (y + 4) + 'h1v1h-1z');
    }
    var path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', commands.join('')); path.setAttribute('fill', '#000'); svg.appendChild(path);
    var figure = el('figure', { class: 'share-qr' }, [svg, el('figcaption', { text: t('share_title') })]);
    figure.style.setProperty('--share-qr-print-size', Math.max(24, size * 0.35).toFixed(2) + 'mm');
    return figure;
  }

  function attach(page, options) {
    var t = options.t, el = options.el, list = options.list;
    if (!list || !list.herbs.length && !list.drugs.length) return;
    var url;
    try { url = link(list); } catch (error) { return; }
    var message = text(options.rows, url, options.formatPair, options.riskLabel, t);
    var status = el('p', { class: 'share-status', role: 'status', 'aria-live': 'polite' });
    var input = el('input', { class: 'share-link', type: 'text', readonly: true, value: url, 'aria-label': t('share_link_label') });
    // A value attribute alone is sufficient initially; assigning the property also makes
    // the fallback selection reliable if a browser restores form values on navigation.
    input.value = url;

    var panel = el('section', { class: 'share-panel no-print', 'aria-labelledby': 'share-title' }, [
      el('h2', { id: 'share-title', text: t('share_title') }),
      el('p', { class: 'share-notice', text: t('share_notice') })
    ]);
    try {
      var figure = qrFigure(url, t, el);
      panel.appendChild(figure);
      var printed = figure.cloneNode(true);
      printed.className = 'share-qr-print';
      var head = page.querySelector('.summary-head');
      if (head) head.insertBefore(printed, head.firstChild);
    } catch (error) {
      panel.appendChild(el('p', { class: 'share-qr-error', text: t('share_failed') }));
    }
    var actions = el('div', { class: 'share-actions' });
    var copy = el('button', { type: 'button', class: 'btn btn-secondary share-copy', text: t('share_copy') });
    function copyFallback() {
      input.focus(); input.select();
      status.textContent = t('share_copy_hint');
    }
    copy.addEventListener('click', function () {
      if (!root.navigator.clipboard || !root.navigator.clipboard.writeText) { copyFallback(); return; }
      try {
        Promise.resolve(root.navigator.clipboard.writeText(url)).then(function () { status.textContent = t('share_copied'); }, copyFallback);
      } catch (error) { copyFallback(); }
    });
    actions.appendChild(copy);
    actions.appendChild(el('a', {
      class: 'btn btn-secondary share-whatsapp', href: 'https://wa.me/?text=' + encodeURIComponent(message),
      target: '_blank', rel: 'noopener noreferrer', text: t('share_whatsapp')
    }));
    if (typeof root.navigator.share === 'function') {
      var system = el('button', { type: 'button', class: 'btn btn-secondary share-system', text: t('share_system') });
      system.addEventListener('click', function () {
        // The URL is already included in the text, so do not duplicate it in a URL field.
        status.textContent = '';
        function failed(error) { if (!error || error.name !== 'AbortError') status.textContent = t('share_failed'); }
        try { Promise.resolve(root.navigator.share({ title: 'HerbBridge 中西通', text: message })).catch(failed); }
        catch (error) { failed(error); }
      });
      actions.appendChild(system);
    }
    panel.appendChild(input); panel.appendChild(actions); panel.appendChild(status);
    var bottomActions = page.querySelector('.summary-actions-bottom');
    if (bottomActions) bottomActions.parentNode.insertBefore(panel, bottomActions);
    else page.appendChild(panel);

    if (options.shared) {
      var bannerMessage = el('p', { text: t('share_readonly') });
      var saveStatus = el('p', { class: 'shared-save-status', role: 'status', 'aria-live': 'polite' });
      var save = el('button', { type: 'button', class: 'btn btn-primary save-shared-list', text: t('share_save') });
      save.addEventListener('click', function () {
        save.disabled = true;
        Promise.resolve().then(function () { return options.onSave(); }).then(function (result) {
          if (result && result.ok) {
            saveStatus.textContent = result.message || t('share_saved');
            bannerMessage.remove();
            save.remove();
            if (options.onSaved) options.onSaved();
          } else {
            save.disabled = false;
            saveStatus.textContent = result && result.cancelled ? (result.message || '') : result && result.message || t('share_save_failed');
          }
        }).catch(function () { save.disabled = false; saveStatus.textContent = t('share_save_failed'); });
      });
      var banner = el('section', { class: 'shared-list-banner no-print', role: 'note' }, [
        bannerMessage, save, saveStatus
      ]);
      page.insertBefore(banner, page.firstChild);
    }
  }

  root.HerbBridgeShare = { read: read, encode: encode, link: link, text: text, attach: attach };
})(typeof window !== 'undefined' ? window : globalThis);
