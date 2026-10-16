/*
 * HerbSafe interface text. English uses British spelling.
 * Chinese (繁體中文) is added in step 5; until then every key falls back to English.
 */
(function (root) {
  'use strict';

  var STRINGS = {
    en: {
      loading: 'Loading…',
      nav_check: 'Check',
      nav_summary: 'Doctor summary',
      nav_about: 'About',
      footer_disclaimer: 'HerbSafe gives information, not medical advice. Never stop or change a medicine without talking to your doctor or pharmacist.',
      footer_privacy: 'No accounts, no tracking. Your list stays on this device.',

      hero_title: 'Chinese and Western medicine, safely together.',
      hero_lede: 'Choose the Chinese herbs and Western medicines you take. HerbSafe shows what is known about each combination, and where that information comes from.',
      herbs_title: 'My Chinese herbs',
      drugs_title: 'My Western medicines',
      search_herbs: 'Search herbs',
      search_drugs: 'Search medicines',
      search_hint: 'English, 中文, pinyin or Cantonese',
      selected_none: 'Nothing chosen yet.',
      selected_count: '{n} chosen',
      add: 'Add',
      added: 'Added',
      remove_item: 'Remove {name}',
      no_matches: 'No match for “{q}”. Try another spelling, or ask your pharmacist.',
      check_button: 'Check',
      count_herbs_one: '1 herb',
      count_herbs_other: '{n} herbs',
      count_drugs_one: '1 medicine',
      count_drugs_other: '{n} medicines',
      check_need_both: 'Choose a herb and a medicine.',
      clear_all: 'Clear my list',
      clear_confirm: 'Remove all herbs and medicines from your list?',

      results_title: 'Your results',
      results_intro: 'Each Chinese herb is checked against each Western medicine you chose. The most serious appear first.',
      results_counts_flagged: '{n} to discuss with your doctor',
      results_counts_unknown: '{n} not in our database',
      results_empty: 'Choose at least one herb and one medicine first.',
      edit_list: 'Edit my list',
      to_summary: 'Doctor summary',

      risk_high: 'High risk',
      risk_moderate: 'Moderate risk',
      risk_low: 'Low risk',
      risk_low_watch: 'Low risk · watch',
      risk_none_reported: 'No reported risk',
      risk_not_in_database: 'Not in our database',

      label_why: 'Why',
      label_for_pros: 'For professionals',
      label_what_to_do: 'What to do',
      label_evidence: 'Evidence',
      label_sources: 'Sources',
      label_rated_by: 'Rating',
      rated_by_ha: 'Hospital Authority rating',
      rated_by_team: 'HerbSafe team rating, based on the sources below',
      why_none: 'No clear mechanism has been established in our sources.',
      pro_english_only: '',
      opens_new_tab: '(opens in a new tab)',
      not_in_db_text: 'We have no record of this combination. This does not mean it is safe. Please ask your pharmacist or doctor.',
      card_disclaimer: 'HerbSafe gives information, not medical advice. Never stop or change a medicine without talking to your doctor or pharmacist.',

      ev_case_reports: 'Case reports',
      ev_human_trial: 'Human trial',
      ev_review: 'Review',
      ev_lab_animal: 'Lab/animal studies',
      ev_official_guidance: 'Official guidance',

      coming_soon_title: 'Coming soon',
      coming_soon_text: 'This page is still being built.',
      back_to_check: 'Back to Check',

      error_title: 'HerbSafe could not load its database',
      error_file: 'This page was opened straight from a file, and browsers block that. Open a terminal in the HerbSafe folder, run “python3 -m http.server”, then visit http://localhost:8000.',
      error_network: 'Please check your connection and reload the page.'
    },
    zh: {}
  };

  var lang = 'en';

  // Plural-aware lookup: tn('count_herbs', 2) uses count_herbs_other. Chinese has no plural forms.
  function tn(key, n) {
    var k = key + (n === 1 ? '_one' : '_other');
    return t((STRINGS[lang] && STRINGS[lang][key] != null) ? key : k, { n: n });
  }

  function t(key, vars) {
    var s = (STRINGS[lang] && STRINGS[lang][key] != null) ? STRINGS[lang][key] : STRINGS.en[key];
    if (s == null) s = key;
    if (vars) s = s.replace(/\{(\w+)\}/g, function (m, k) { return vars[k] != null ? vars[k] : m; });
    return s;
  }

  root.HerbSafeI18n = {
    t: t,
    tn: tn,
    getLang: function () { return lang; },
    setLang: function (l) { if (STRINGS[l]) lang = l; },
    languages: ['en', 'zh']
  };
})(typeof self !== 'undefined' ? self : this);
