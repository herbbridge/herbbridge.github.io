# HerbSafe 中西通: handover notes

Status as of 18 Oct 2026. Deadline: working app by Sunday 18 Oct (demo video).
Paste the original project brief into the new session together with this file.

## Progress (order of work from the brief)
1. Folder structure + JSON schema: done
2. Data files (`data/`): done, cleaned to source-verified claims only
3. Lookup logic + tests: done (`node tests/run-tests.js`, or tests/test.html via a local server)
4. Check → Results: done, reshaped as "My medicine cabinet" (see below)
5. Language toggle: done (Chinese drafted, flagged unreviewed: ZH_REVIEWED in js/i18n.js)
6. Doctor summary (print): done (#/summary; Mrs Wong prints on one A4 page)
7. About page: done (#/about; scale, evidence levels, privacy, all sources, roadmap)
   Extra: "Demo: Mrs Wong" button (warfarin + amlodipine preloaded; tap "Add danshen" on camera)
8. GitHub Pages deploy: not started

## Decisions already made by the owner
- Data loads from real `.json` files via `fetch`. Run locally with `python3 -m http.server`
  and open http://localhost:8000. If index.html is opened by double-click, show a clear
  message explaining this instead of failing silently.
- Pairs with no established mechanism (Asian ginseng, ginkgo) have `why_* = null`; the card
  shows the standard text "No clear mechanism has been established in our sources."
- `rating_source`: only danshen + warfarin is "HA". Everything else is "team".
- **Only verified content. No risks.** Do not add claims, sources or search names that have
  not been checked against the cited source.

## Schema notes (differences from the brief)
- `evidence_level` is an array of keys: `case_reports`, `human_trial`, `review`,
  `lab_animal`, `official_guidance`.
- `watch: true` shows "Low · watch" (ginkgo pairs).
- Exactly one of `drug_id` / `drug_class` per entry. Lookup: match `drug_id` first, then any
  of the drug's `classes`. Statins have class `statin`; furosemide has class `diuretic`.
- `why_pro_en` has no Chinese version; in Chinese mode show the English text with a note (只有英文).
- "Licorice" is spelt "Liquorice" (British spelling); id `liquorice`, alias "licorice".
- Chinese text is Cantonese-style written Chinese; every entry has `zh_reviewed: false`.

## Source verification (done by web search only; full texts could not be opened)
All 11 sources exist, labels are correct and the PMID/PMC/DOI links match the right papers.
Text was changed where a source did not support the wording (see git log, commit
"Keep only source-verified claims"). Ratings were NOT changed.

Still to do with full-text access:
1. **SCMP article (27 Sep 2026)**: the only source for the HA "Moderate" rating on danshen +
   warfarin and for "INR tests 2–3 times a week". Must be confirmed by opening the article.
   If it cannot be confirmed, the card must not claim to be an HA rating.
2. Open every link in `data/interactions.json` and check each card's wording against the
   full text, not just the abstract.
3. Page & Lawrence 1999: the abstract says ">2-fold" rise in PT and INR. Check the raw
   numbers in the full text.
4. Cleveland Clinic 2001 page: check it is still live.

## Hackathon version: "My medicine cabinet" (decided 17 Oct)
The owner wants the app to feel like a personal dashboard that warns about clashes.
For Sunday this is done WITHOUT accounts, a server or scanning:
- The Check screen is "My medicine cabinet": the list is saved only on the device
  (localStorage), with a summary of flagged pairs and "not in database" pairs at the top.
- Adding an item that clashes with something already in the cabinet shows an instant
  warning in the sticky bar. It stays until closed. Only rated pairs (High/Moderate/Low)
  trigger it; "not in database" pairs are reported in the cabinet summary, never as safe.
- Users find names on the pharmacy label, medicine box or 藥方 and pick them from the list.
- Warnings build up until closed, one line per pair with its own rating (17 Oct review).

## Decided 17 Oct (after the full review)
- "Avoid this combination" reworded to "Talk to your doctor before taking these together"
  (danshen and dong quai). Owner approved.
- Colours: keep the HA four levels + grey (owner chose this over a 3-colour traffic light).
  Each badge has a plain-language line under it (app wording, in js/i18n.js level_*).
- Every rated card shows "Main evidence": data fields main_source (index into sources) and
  main_finding_en/zh, written only from findings confirmed in the source check.
- Green ("No reported risk") is used only when a verified source reports no interaction.
  No pair qualifies yet, so nothing is green.
- Chinese: no 同時服用 (reads as timing advice) and no 中風險 (reads as 'stroke risk');
  levels are 高度/中度/低度風險. A test guards this.

## Decided 18 Oct
- Interface: owner chose design C, "Calm dashboard" (from three prototypes A/B/C).
  Home = status tile + two cards (Chinese herbs / Western medicines) with chips and a big
  "+ Add" button that opens a full-screen picker (phone Back and Esc close it).
  Results are grouped under level headings with counts; each card shows badge, effect,
  evidence level, main source and disclaimer, with the rest behind "Details and sources".
- Installable app (PWA): manifest + sw.js; bump VERSION in sw.js when app files change.
- Bigger database: research runs into a separate proposed file; nothing goes live until the
  owner approves each pair.
- Heart-disease focus made visible (no rating, source or lookup change):
  home subtitle; medicine picker grouped by condition (`group` in drugs.json, headings in
  `groups`); "Commonly taken for" under each herb (`used_for_en/zh`); "Why this matters for
  your heart" on rated cards and in the doctor summary (`heart_impact_en/zh`); About
  "Why heart patients?" with two background sources (DH press release 29 Sep 2024;
  Lam et al., HKMJ 2020). All new Chinese is zh_reviewed false.
- Still to check by hand: the figures quoted from the DH press release and the HKMJ paper
  (both found by web search only; neither page could be opened from the build machine).
- Red yeast rice wording now follows NIH/NCCIH: "structurally identical", not
  "chemically identical".
- Service-worker cache was herbsafe-v4 for this update (now herbsafe-v5, see below).
- 15 new pairs approved by the owner (all of them) and saved in proposals/ with their
  verification notes.
- 15 approved pairs now LIVE (24 entries in data/interactions.json, all team ratings;
  danshen + warfarin is still the only HA rating). Tests updated (cases 1, 4, 10; the
  goji/sanqi/safflower check now lists only medicines still without a record).
  Mrs Wong's summary fits one A4 page again (print line-height 1.4). Cache herbsafe-v5.
  Checked in Chromium at 320 and 390 px, EN and 中文: every rated card has its heart line,
  no sideways overflow, grey cards identical to before.
- First visit simplified (owner, 18 Oct, after "no one knows what to press"): with an empty or
  half-filled cabinet the status tile shows ONE step and ONE big button ("Step 1: Which
  Chinese herbs do you take?" → "Step 2: Which Western medicines…"). After picking, focus moves
  to the next step, then to the result. The demo is a small link under step 1. The grey
  "Check" bar is hidden until both lists have something. New Chinese strings unreviewed.
  Cache herbsafe-v6.
- Grey cards (owner, 18 Oct, "grey doesn't solve any problems"): the required wording is
  unchanged; under it a "What you can do" step with a button to the doctor summary, which
  lists every not-in-database pair for the pharmacist. No medical claim. Cache herbsafe-v7.
- More pairs (Task 3) started 18 Oct for 16 grey combinations (antiplatelets with ginkgo and
  the ginsengs; liquorice + amlodipine; danshen + furosemide; goji/sanqi/safflower with
  digoxin, amlodipine, furosemide). Research → independent source check → wording/Chinese
  check → proposals/. Nothing goes live until the owner approves each pair.
- Owner, 18 Oct: "sources must be officially ensured". Every live pair so far was checked by
  web search only, so after every disclaimer the app now says (in bold) "Prototype: this
  information has not yet been reviewed by a pharmacist." Round 2 pairs are ON HOLD (not
  live). Next: a pharmacist signs off each pair ("reviewed by" record) before real use.
- Owner approved researching herb-level warnings from OFFICIAL sources only (regulators,
  NIH, EMA, HK DH/HA, WHO, MSKCC) to reduce grey cards. Candidates go to
  proposals/herb-warnings-*.json; how they are shown in the app is still to be decided.
  Cache herbsafe-v8.
- Official cautions LIVE (owner approved 18 Oct): data/official.json, 8 statements from the
  EMA (ginkgo 2015, liquorice Revision 1 2026) and Health Canada (ginkgo, American ginseng,
  Panax ginseng), verified word for word by the owner's checker. 9 pairs: ginkgo + warfarin
  and + aspirin ("sources disagree", team Low · watch still shown), ginkgo + clopidogrel,
  ginkgo + amlodipine, American/Asian ginseng + digoxin, liquorice + amlodipine, liquorice +
  furosemide and + digoxin (EMA "not to be used concomitantly"). Ginkgo + furosemide stays
  grey (Health Canada names only high blood pressure medications). Ratings unchanged.
  Cache herbsafe-v9.
- 19 Oct: two more statements verified in the documents and added. (1) EMA ginkgo 4.5:
  "Available studies with warfarin do not indicate that there is an interaction…, but
  adequate monitoring is advised…" (on the ginkgo + warfarin "sources disagree" card).
  (2) Hospital Authority warfarin leaflet 019Ev10/019Cv10 (Oct 2025, current per the HA Drug
  Education page): "Do not take any TCM… Many TCM such as ginseng, Dong quai, Danshen,
  Chishao can interact with warfarin." Its Chinese text is the HA's own (quote_zh_is_original)
  and is locked in VERIFIED_QUOTES_ZH. Applied to danshen + warfarin (Mrs Wong; Moderate kept
  underneath), dong quai + warfarin (High kept as the badge) and Asian ginseng (人參) +
  warfarin ("sources disagree" with team Low). The leaflet does NOT give a rating, so it does
  not confirm the "HA rated Moderate" claim (still SCMP-only; open Task 2 item 1).
  OPEN for the owner: the leaflet says "Do not take ANY TCM" with warfarin; should this quote
  also go on every other herb + warfarin (strict reading)? And should Health Canada's verified
  "blood thinners" sentences be added to American/Asian ginseng + warfarin? Cache herbsafe-v10.
- 19 Oct, owner decisions after a full-text check of the live sources (owner's checker):
  * SCMP could not be read (paywall), so per the owner's rule danshen + warfarin is now a TEAM
    rating, raised to HIGH by the owner (two HK case reports: INR >5.6 and >8.4 with major
    bleeding; Chan 2001). Main evidence: Izzat 1998. SCMP source removed; "INR tests 2–3 times
    a week" removed; advice now points to the HA warfarin leaflet. No pair is "HA" any more,
    and About/README no longer call the scale "the Hospital Authority's".
  * Wording fixed to match the full texts: ginkgo + warfarin (Lim 2018: trials gave ginkgo
    alone; "does not adversely affect the safety…" is the authors' conclusion); Zhuang 2021
    details for danshen and dong quai; About figures (provisional registered deaths;
    40–49% "therapeutic range", one hospital).
  * Asian ginseng + warfarin: "one case report found a drop in INR" restored after the owner's
    checker read Leonard, Cleveland Clinic Pharmacotherapy Update, Mar/Apr 2001 ("Oriental
    ginseng", INR fell to 1.5). Leonard's Table 2 also confirmed for liquorice + digoxin and
    + potassium-depleting diuretics (two wording points put to the owner).
- Shorter cards (owner, 19 Oct): an official caution shows its first statement; the others fold
  behind one big "Show N more official statements" button. All statements still print and all
  appear in the doctor summary. Statement order in data/official.json decides which is first.
  Cache herbsafe-v15.
- HA leaflets for the other heart medicines (owner's checker, 19 Oct): four GROUP leaflets
  (015 angina incl. aspirin/clopidogrel, 013 cholesterol, 016 heart failure incl. digoxin,
  014 blood pressure incl. amlodipine/furosemide) advise consulting before ANY Chinese
  medicine; none names a herb. Owner chose option A: shown as "Hospital Authority advice" on
  grey cards, rated cards (under Details), official-only cards and the summary; never a rating
  or Official caution. Locked in GENERAL_ADVICE (both languages exactly as the HA wrote them).
  Cache herbsafe-v16.
- RULE (owner, 19 Oct, on the About page): an Official caution needs an official source that
  NAMES the herb. General "any Chinese medicine" advice is shown as Hospital Authority advice.
  So liquorice, goji, red yeast rice, sanqi and safflower + warfarin are no longer blue; the
  HA warfarin leaflet (019Ev10) is now general advice for warfarin and appears in their advice
  box. Team ratings unchanged (goji High, safflower Moderate, sanqi Low · watch); liquorice and
  red yeast rice + warfarin are grey with the HA box. A card whose official caution already
  quotes the same leaflet does not repeat it. Cache herbsafe-v17.
  Possible later team-rating candidate: liquorice + warfarin (Zhuang 2021 discusses mixed
  evidence; would need the usual research/check/approval).
- Pharmacist review record (19 Oct): data/reviews.json (empty) + fingerprint per card
  (tests/review-fingerprint.js). A reviewed card says "Reviewed by …" instead of "Prototype";
  any later change to the card hides the review and fails the tests until re-reviewed. Steps in
  README. Cache herbsafe-v18.
- Read aloud (19 Oct): a "Read aloud / 讀出嚟" button on each card reads pair, level, the first
  official quote or the effect, what to do and the disclaimer. Uses ON-DEVICE voices only
  (localService), so no text leaves the phone. Chinese reads only with a Cantonese (zh-HK/yue)
  voice; otherwise it says the phone has none. The grouped grey card (several pairs) has no
  button. Cache herbsafe-v19.
- Ideas not started: search by HK product names (needs official registration data).
  * HA leaflet quote now on EVERY herb + warfarin (owner: it covers all TCM); Health Canada
    "blood thinners" sentences added to both ginseng + warfarin cards. Cache herbsafe-v12.

## Future full app (owner's long-term plan; pitch as roadmap, do not build now)
- Accounts (username + password) and a private, secure database of each person's
  medicine history. Needs: a proper auth service (never store plain passwords), encryption,
  explicit consent, and compliance with Hong Kong's Personal Data (Privacy) Ordinance.
  The "no accounts, no tracking" promise in the UI must be rewritten when this happens.
- Scanning: HK registration numbers on packs (HK-… Western, HKC-… proprietary Chinese
  medicines) or a label photo, ALWAYS followed by a user confirmation step before saving.
  Needs a verified registration-number → product database. Manual search stays as fallback.
- Push notifications for new clashes or database updates (needs a server).
- Keep the current data model (cabinet = lists of herb/drug ids; curated JSON database)
  so it can be synced to an account later without rewriting the lookup logic.

## Redesign (branch `redesign`, 19 Oct 2026; NOT merged to main until the owner says so)
Owner and Cyrus approved the look from a preview (`_preview/`). Layout and design only: no data,
rating, quote, source, S/N or date changed.
- Step-by-step screens: #/cabinet → #/results (compact cards) → #/pair/<herb>-<drug> → #/summary.
- Two modes, header toggle "Simple / Full design" (簡易 / 完整設計), stored in localStorage
  ("herbsafe.mode"), default Simple. Simple: 20px base, no motion, cards show the FIRST sentence of
  "What to do"; pair screen shows badge, What to do, required grey wording, disclaimer, then
  "More details". Full: icons, steps, transitions (respecting reduced motion).
- New palette (violet accent #4B3FD1, warm neutral background, soft rating pills; all WCAG AA).
- Fonts self-hosted in fonts/ (Inter + Noto Sans TC subset); Google Fonts removed; no outside
  requests. MUST RUN `python3 tools/make-font-subset.py` WHENEVER DATA OR UI TEXT GAINS NEW
  CHINESE, then bump sw.js VERSION.
- Fixed: headings breaking mid-word at large text; Chinese headings/names splitting (華法 / 林,
  虛構人 / 物); controls running off screen at 200% text.
- Checked: Mrs Wong demo end to end in both modes and languages; Back closes picker; offline with
  the service worker (fonts cached, zero outside requests); 390/195/1280 px and 200% text, all
  screens, both modes and languages: no sideways scroll, no clipped headings, no console errors;
  doctor summary prints on one A4 page in black and white. Cache herbsafe-v20.
- Screenshots of every screen: _preview/build/.
- New Chinese labels (Cantonese style) are NOT YET REVIEWED; see the list in the owner report.

### 20 Oct 2026 (redesign branch), owner-checked data fixes, applied exactly
- danshen/dong quai/goji/safflower + warfarin: heart line now "Serious bleeding, including
  internal bleeding." / 「嚴重出血，包括內出血。」 (zh NOT YET REVIEWED); "bleeding in the brain"
  removed everywhere; HA warfarin leaflet 019Ev10 added as the LAST source on all four (main
  evidence unchanged).
- danshen + amlodipine: "(a multi-herb Chinese medicine product)"; main evidence now about the
  total amount (AUC). Rating stays Low; no dosing advice added.
- goji + warfarin "What to do" now starts with the HA leaflet sentence (tea/juice/wine kept).
- Simple cards: first sentence of "What to do"; in Chinese a ； clause counts as a sentence too.
- Font subset rebuilt (tools/make-font-subset.py); every character on these cards is covered.
- sw.js ignores /preview/ and /_preview/ (never cached or intercepted). Cache herbsafe-v21.
- 20 Oct: goji + warfarin "What to do" split so tea/juice/wine is not attributed to the HA:
  "…not to take any Chinese medicine with warfarin. Goji tea, juice and wine count too." /
  「…唔好將任何中藥同華法林一齊食。枸杞茶、枸杞汁同枸杞酒都計埋。」 (zh NOT YET REVIEWED). Cache v22.
- Merge plan agreed (owner, 20 Oct): on Wed 21 Oct, when the owner says so, merge redesign into
  main, removing _preview/ and preview/ in the same step and keeping sw.js from redesign (with the
  /preview/ exclusion). Do not merge before the owner says so.
- 20 Oct, owner's phone test of the preview → fixes on redesign (cache v23):
  1. No "What to do" inside official quote boxes (it contradicted the HA's "Do not take"); official-only
     cards keep their own What to do above the quotes.
  2. Intro "Hong Kong's Hospital Authority, which runs the public hospitals, says in its own words:" /
     「管理公立醫院嘅香港醫院管理局，原文係咁講：」 only on cards whose herb the HA leaflet names
     (danshen, dong quai; Asian ginseng keeps its "sources disagree" intro). American ginseng + warfarin
     still quotes the HA leaflet ("ginseng") first under the general intro: owner to decide.
  3. Simple cabinet: once both lists are filled, only the clash pop-up and "Check my list" remain
     (the status card stays if the list cannot be saved).
  4. Phones: mode toggle and language button on one row; "Demo: Mrs Wong" button under the cabinet title.
  5. Simple pair screen shows the official quote block without "More details".
  6. Chinese labels use full-width "："; HA leaflet sources carry label_zh/url_zh (019Cv10), shown in
     Chinese mode (screen and printed summary).
- 20 Oct: American ginseng + warfarin official caution = Health Canada only (names American ginseng);
  the HA warfarin leaflet now shows in its Hospital Authority advice box (as for other herbs the
  leaflet does not name). Added as last source: "Hospital Authority patient talk (undated):
  當中藥師遇見藥劑師, slide 19" (smartpatient.ha.org.hk PDF; lists 西洋參 with warfarin). Not used for
  the badge. Owner confirmed (20 Oct) the link is the PDF they read and slide 19 lists 西洋參 with
  warfarin. Cache v24.
- Remaining before Wed 21 Oct merge (owner): phone check with Cyrus, then Chinese sign-off (set every
  zh_reviewed and ZH_REVIEWED to true only when the owner confirms), then merge redesign → main,
  removing _preview/ and preview/ in the same step and keeping sw.js from redesign.
- 20 Oct, iPhone phone check → Read aloud fix (cache v25): the voice list is loaded in the background
  (voiceschanged + re-checks for 3 s; iOS often fills it late or with no event), because iOS only
  speaks when speak() runs straight away in the tap. Voice order: on-device voice for the language →
  on-device voice of the same family (e.g. Mandarin) → phone default with lang en-GB/zh-HK when the
  list is empty (in-app browsers). Never an online-only voice: then the button is hidden. A message
  shows only when speaking fails (error, or nothing starts within 4 s). Tested with iPhone emulation
  in Chromium and a fake speech engine (no real iOS/WebKit available here). Chinese speech uses 。.
- Preview build tags css/js with ?v=<cache version> so phones fetch a rebuilt preview fresh.
