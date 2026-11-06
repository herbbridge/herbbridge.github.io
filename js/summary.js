/* Screen-only folding for the doctor summary. Medical wording comes from the existing
 * rendered summary and lookup results. The original full content always prints. */
(function (root) {
  'use strict';

  function enhance(page, options) {
    var rows = options.rows, t = options.t, el = options.el;
    var disclosures = [];
    var counter = 0;

    function disclosure(panel, before, rowName) {
      panel.id = 'summary-detail-' + (++counter);
      var label = el('span', { text: t('summary_show_details') });
      var button = el('button', {
        type: 'button', class: 'summary-toggle no-print',
        'aria-controls': panel.id, 'aria-expanded': 'false'
      }, [label, el('span', { class: 'visually-hidden', text: ' — ' + rowName })]);
      var item = { panel: panel, button: button, label: label, before: before };
      function setOpen(open) {
        panel.hidden = !open;
        button.setAttribute('aria-expanded', String(open));
        label.textContent = t(open ? 'summary_hide_details' : 'summary_show_details');
        if (before) before.hidden = open;
      }
      button.addEventListener('click', function () { setOpen(panel.hidden); });
      item.setOpen = setOpen;
      disclosures.push(item);
      setOpen(false);
      return button;
    }

    var counts = {};
    rows.forEach(function (row) { counts[row.status] = (counts[row.status] || 0) + 1; });
    var countText = [options.tn('group_count', rows.length)];
    options.order.forEach(function (status) {
      if (counts[status]) countText.push(counts[status] + ' ' + t('risk_' + status));
    });
    var count = el('p', { class: 'summary-count no-print', text: countText.join(' · ') });
    page.querySelector('.summary-head').appendChild(count);

    var rated = rows.filter(function (row) { return row.entry || row.official; });
    Array.prototype.forEach.call(page.querySelectorAll('.summary-row'), function (card, index) {
      var row = rated[index], details = card.querySelector('.summary-dl');
      if (!row || !details) return;
      var action = row.entry ? options.field(row.entry, 'action') : t('official_action');
      var shortAction = el('p', { class: 'summary-short-action no-print' }, [
        el('strong', { text: t('label_what_to_do') + ': ' }),
        el('span', { text: options.firstSentence(action) })
      ]);
      card.insertBefore(shortAction, details);
      card.insertBefore(disclosure(details, shortAction, card.querySelector('.summary-pair').textContent), details);
    });

    var unknown = rows.filter(function (row) { return row.status === 'not_in_database'; });
    var unknownSection = page.querySelector('.summary-unknown');
    if (unknownSection && unknown.length) {
      var list = unknownSection.querySelector('.summary-unknown-list');
      var intro = unknownSection.querySelector('p');
      list.classList.add('summary-print-original');
      if (intro) intro.classList.add('summary-print-original');
      var cards = el('div', { class: 'summary-unknown-cards no-print' });
      unknown.forEach(function (row) {
        cards.appendChild(el('div', { class: 'summary-unknown-card' }, [
          el('div', { class: 'summary-row-head' }, [options.badgeFor(row), options.bilingualPair(row)]),
          el('p', { class: 'summary-unknown-warning', text: t('not_in_db_text') })
        ]));
      });
      unknownSection.insertBefore(cards, list);
      var advice = Array.prototype.slice.call(unknownSection.querySelectorAll('.advice-box'));
      if (advice.length) {
        var extra = el('div', { class: 'summary-unknown-extra' });
        advice.forEach(function (node) { extra.appendChild(node); });
        unknownSection.appendChild(disclosure(extra, null, t('summary_unknown')));
        unknownSection.appendChild(extra);
      }
    }

    if (disclosures.length) {
      var controls = el('div', { class: 'summary-fold-actions no-print' }, [
        el('button', { type: 'button', class: 'summary-expand-all', text: t('summary_expand_all'),
          onclick: function () { disclosures.forEach(function (item) { item.setOpen(true); }); } }),
        el('button', { type: 'button', class: 'summary-collapse-all', text: t('summary_collapse_all'),
          onclick: function () { disclosures.forEach(function (item) { item.setOpen(false); }); } })
      ]);
      var section = page.querySelector('.summary-section');
      if (section) page.insertBefore(controls, section);
    }

    var topPrint = page.querySelector('.summary-actions button');
    if (topPrint) {
      page.appendChild(el('div', { class: 'summary-actions summary-actions-bottom no-print' }, [
        el('button', { type: 'button', class: 'btn btn-secondary', text: t('summary_print'),
          onclick: function () { root.print(); } })
      ]));
    }
  }

  root.HerbBridgeSummary = { enhance: enhance };
})(window);
