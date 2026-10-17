/*
 * HerbSafe interface text. English uses British spelling.
 * Chinese (繁體中文) is drafted in Cantonese-style written Chinese and NOT YET REVIEWED.
 * When a native speaker has checked every zh string below, set ZH_REVIEWED to true
 * (this hides the "not yet reviewed" note shown in Chinese mode).
 */
(function (root) {
  'use strict';

  var ZH_REVIEWED = false;

  var STRINGS = {
    en: {
      loading: 'Loading…',
      nav_check: 'My cabinet',
      nav_summary: 'Doctor summary',
      nav_about: 'About',
      footer_disclaimer: 'HerbSafe gives information, not medical advice. Never stop or change a medicine without talking to your doctor or pharmacist.',
      footer_privacy: 'No accounts, no tracking. Your list stays on this device.',

      hero_title: 'Chinese and Western medicine, safely together.',
      hero_lede: 'Choose the Chinese herbs and Western medicines you take. HerbSafe shows what is known about each combination, and where that information comes from.',
      cabinet_title: 'My medicine cabinet',
      cabinet_lede: 'Saved only on this device. Add what you take, and HerbSafe warns you straight away if anything clashes.',
      cabinet_empty: 'Your cabinet is empty. Add the Chinese herbs and Western medicines you take below.',
      cabinet_need_both: 'Add at least one Chinese herb and one Western medicine to check for clashes.',
      cabinet_clashes_one: '1 combination to discuss with your doctor',
      cabinet_clashes_other: '{n} combinations to discuss with your doctor',
      cabinet_no_rated: 'None of your combinations has a rating in our database.',
      cabinet_unknown_one: '1 combination is not in our database. That does not mean it is safe: ask your pharmacist.',
      cabinet_unknown_other: '{n} combinations are not in our database. That does not mean they are safe: ask your pharmacist.',
      cabinet_see_all: 'See full details',
      alert_clash: '{item} may clash with {others} in your cabinet.',
      list_sep: ', ',
      alert_details: 'See details',
      alert_dismiss: 'Close',
      herbs_title: 'My Chinese herbs',
      drugs_title: 'My Western medicines',
      search_herbs: 'Search herbs',
      search_drugs: 'Search medicines',
      search_hint: 'English, 中文, pinyin or Cantonese',
      where_herbs: 'Where do I find the name? On your Chinese medicine prescription (藥方) or the packet. Not sure? Ask the herbalist or your pharmacist.',
      where_drugs: 'Where do I find the name? On the pharmacy label or the medicine box. Brand names work too. Not sure? Ask your pharmacist.',
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
      back_to_check: 'Back to my cabinet',

      lang_toggle: '繁體中文',
      lang_toggle_label: 'Switch language to 繁體中文 (Traditional Chinese)',
      and_sr: 'and',
      zh_unreviewed_note: '',

      error_title: 'HerbSafe could not load its database',
      error_file: 'This page was opened straight from a file, and browsers block that. Open a terminal in the HerbSafe folder, run “python3 -m http.server”, then visit http://localhost:8000.',
      error_network: 'Please check your connection and reload the page.'
    },
    zh: {
      loading: '載入中…',
      nav_check: '我嘅藥箱',
      nav_summary: '醫生摘要',
      nav_about: '關於',
      footer_disclaimer: 'HerbSafe 只提供資訊，唔係醫療建議。未同醫生或者藥劑師傾過之前，千祈唔好自行停藥或者改藥。',
      footer_privacy: '唔使開帳戶，冇追蹤。你嘅清單只會儲存喺呢部裝置。',

      hero_title: '中藥西藥，安心並用。',
      hero_lede: '揀選你食緊嘅中藥同西藥。HerbSafe 會話你知每個配搭有咩已知資料，同埋資料嘅出處。',
      cabinet_title: '我嘅藥箱',
      cabinet_lede: '只會儲存喺呢部裝置。加入你食緊嘅藥，如果有相沖，HerbSafe 會即刻提你。',
      cabinet_empty: '你嘅藥箱仲係空嘅。請喺下面加入你食緊嘅中藥同西藥。',
      cabinet_need_both: '最少加入一種中藥同一種西藥，先可以檢查有冇相沖。',
      cabinet_clashes: '有 {n} 個配搭要同醫生傾',
      cabinet_no_rated: '你嘅配搭喺我哋嘅資料庫入面都冇評級。',
      cabinet_unknown: '有 {n} 個配搭唔喺我哋嘅資料庫。咁唔代表安全，請問你嘅藥劑師。',
      cabinet_see_all: '睇詳細結果',
      alert_clash: '{item}可能同你藥箱入面嘅{others}相沖。',
      list_sep: '、',
      alert_details: '睇詳情',
      alert_dismiss: '關閉',
      herbs_title: '我嘅中藥',
      drugs_title: '我嘅西藥',
      search_herbs: '搜尋中藥',
      search_drugs: '搜尋西藥',
      search_hint: '可以用中文、英文、拼音或者粵拼',
      where_herbs: '喺邊度搵到個名？睇你嘅中藥藥方或者包裝。唔肯定？問中醫師或者藥劑師。',
      where_drugs: '喺邊度搵到個名？睇藥房標籤或者藥盒。用牌子名都得。唔肯定？問你嘅藥劑師。',
      selected_none: '仲未揀。',
      selected_count: '已揀 {n} 項',
      add: '加入',
      added: '已加入',
      remove_item: '移除 {name}',
      no_matches: '搵唔到「{q}」。試吓第二個寫法，或者問你嘅藥劑師。',
      check_button: '檢查',
      count_herbs: '{n} 種中藥',
      count_drugs: '{n} 種西藥',
      check_need_both: '請揀一種中藥同一種西藥。',
      clear_all: '清除我嘅清單',
      clear_confirm: '確定要移除清單上所有中藥同西藥？',

      results_title: '你嘅結果',
      results_intro: '每種中藥都會同你揀咗嘅每種西藥逐一對照。最嚴重嘅排喺最前。',
      results_counts_flagged: '{n} 個要同醫生傾',
      results_counts_unknown: '{n} 個唔喺我哋嘅資料庫',
      results_empty: '請先揀最少一種中藥同一種西藥。',
      edit_list: '修改我嘅清單',
      to_summary: '醫生摘要',

      risk_high: '高風險',
      risk_moderate: '中風險',
      risk_low: '低風險',
      risk_low_watch: '低風險 · 要留意',
      risk_none_reported: '未有報告風險',
      risk_not_in_database: '資料庫未有記錄',

      label_why: '原因',
      label_for_pros: '專業人員參考',
      label_what_to_do: '應該點做',
      label_evidence: '證據',
      label_sources: '資料來源',
      label_rated_by: '評級',
      rated_by_ha: '醫院管理局評級',
      rated_by_team: 'HerbSafe 團隊根據以下資料來源評級',
      why_none: '我哋嘅資料來源未有確立清楚嘅原理。',
      pro_english_only: '只有英文版本。',
      opens_new_tab: '（喺新分頁開啟）',
      not_in_db_text: '我哋冇呢個配搭嘅記錄。咁唔代表安全。請問你嘅藥劑師或者醫生。',
      card_disclaimer: 'HerbSafe 只提供資訊，唔係醫療建議。未同醫生或者藥劑師傾過之前，千祈唔好自行停藥或者改藥。',

      ev_case_reports: '病例報告',
      ev_human_trial: '人體試驗',
      ev_review: '文獻綜述',
      ev_lab_animal: '實驗室／動物研究',
      ev_official_guidance: '官方指引',

      coming_soon_title: '即將推出',
      coming_soon_text: '呢一頁仲做緊。',
      back_to_check: '返回我嘅藥箱',

      lang_toggle: 'English',
      lang_toggle_label: '切換語言至英文 (Switch language to English)',
      and_sr: '同',
      zh_unreviewed_note: '中文內容仲未經專人審閱，如有疑問請以英文版本為準，並請教醫生或藥劑師。',

      error_title: 'HerbSafe 載入唔到資料庫',
      error_file: '呢個網頁係直接由檔案開啟，瀏覽器會阻止。請喺 HerbSafe 資料夾開終端機，執行「python3 -m http.server」，然後去 http://localhost:8000。',
      error_network: '請檢查網絡連線，然後重新載入網頁。'
    }
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
    languages: ['en', 'zh'],
    zhReviewed: ZH_REVIEWED,
    strings: STRINGS
  };
})(typeof self !== 'undefined' ? self : this);
