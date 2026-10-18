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
