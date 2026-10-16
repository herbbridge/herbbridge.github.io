# HerbSafe 中西通: handover notes

Status as of 16 Oct 2026. Deadline: working app by Sunday 18 Oct (demo video).
Paste the original project brief into the new session together with this file.

## Progress (order of work from the brief)
1. Folder structure + JSON schema: done
2. Data files (`data/`): done, cleaned to source-verified claims only
3. Lookup logic + tests: **not started (owner said wait)**
4. Check → Results: not started
5. Language toggle: not started
6. Doctor summary (print): not started
7. About page: not started
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
