# Proposed pairs (not read by the app)

`approved-pairs.json` holds 15 new herb × medicine pairs. The owner approved all 15 on
18 Oct 2026. **They went live on 18 Oct 2026**: appended unchanged to
`data/interactions.json` (cache herbsafe-v5). This file is kept as the record of what was
approved; its `status` line predates going live.

Each pair went through three steps:

1. Research.
2. An independent checker confirmed each source by web search (full texts could not be
   opened from the build machine) and removed every claim it could not confirm.
3. A second review of the wording, the Chinese and the safety rules.

`verification-notes.json` is the audit trail: what was confirmed for every source, which
claims were removed, and what the owner was told before approving.

| Pair | Rating | Note |
|---|---|---|
| goji + warfarin | High | Four published cases, one in Hong Kong |
| safflower + warfarin | Moderate | One case report plus rat studies; "High" could be argued |
| safflower + aspirin | Low | Lab/animal only, mixed |
| safflower + clopidogrel | Low | Animal/lab only |
| sanqi + warfarin | Low · watch | Evidence points both ways |
| sanqi + aspirin | Moderate | One source is hosted on a retailer site (vital.ly) |
| sanqi + clopidogrel | Low · watch | Only study contradicts itself; the team suggested holding it, the owner approved it |
| danshen + aspirin | Low · watch | Borderline Low/Moderate |
| danshen + clopidogrel | Low · watch | Weak, mixed evidence |
| danshen + digoxin | Low | Blood-test interference, not a drug effect |
| danshen + rosuvastatin | Low | One study in 6 healthy men |
| danshen + atorvastatin | Low | Two rat studies that disagree |
| danshen + amlodipine | Low | One rat study; changes the Mrs Wong demo |
| dong quai + aspirin | Low | A nursing drug guide says avoid; a trial found no added platelet effect |
| dong quai + clopidogrel | Low | Only source: a drug guide's warning for the whole antiplatelet group |

## To put them live

1. Append the 15 entries to `data/interactions.json` exactly as they are (same fields as the
   live entries; `watch` is true on goji + warfarin and safflower + warfarin as checked, and
   the app ignores `watch` unless the rating is Low).
2. Add each id, rating, watch flag and `"team"` to `BRIEF_RATINGS` in `tests/test-suite.js`.
3. Update what the tests expect:
   - `tests/test-cases.json`: case 1 (Mrs Wong: danshen + amlodipine is now Low), case 4
     (dong quai + aspirin is now Low), case 10 (danshen/sanqi/safflower with warfarin and
     aspirin are now rated). Rename stories that say "no record" where that is no longer true.
   - The check "goji, sanqi and safflower show not_in_database with every drug" in
     `tests/test-suite.js`: limit it to the drugs that still have no record (for example
     amlodipine, digoxin, furosemide and the statins).
   - Regenerate `tests/test-cases.md`.
4. Mrs Wong's printed doctor summary now spills one line (the disclaimer) onto a second
   page. Tighten the print CSS so it fits on one A4 page again.
5. Bump `VERSION` in `sw.js` (herbsafe-v4 → herbsafe-v5).
6. Run `node tests/run-tests.js` and check the app in a browser in English and 中文.

## Round 2 (18 Oct 2026): awaiting the owner's approval

16 grey combinations were researched with the same three steps. Sources could be seen only
as search results and abstracts (PubMed/PMC were blocked from the build machine).

- `candidates-batch1/2/3.json`: research (step 1)
- `check-batch1/2.json`: independent source check (step 2)
- `proposed-pairs-round2.json`: after the wording, Chinese and safety review (step 3).
  **Not live.** Each pair needs the owner's yes before it goes into `data/`.

| Pair | Proposed rating | Open question for the owner |
|---|---|---|
| ginkgo + clopidogrel | Low · watch | Keep "watch" now the unconfirmed case report was removed? |
| Asian ginseng + aspirin | Low | Or "No reported risk": a trial measured this pair and found no added effect |
| liquorice + amlodipine | Moderate | Accept Drugs.com as a source? If not, the checker would rate it Low |

No published evidence on the pair itself, so these stay "not in database": asian ginseng +
clopidogrel; american ginseng + aspirin, clopidogrel; danshen + furosemide; goji + digoxin,
amlodipine, furosemide; sanqi + digoxin, amlodipine, furosemide; safflower + digoxin,
amlodipine, furosemide.

### Update 19 Oct 2026

Round 2 stays on hold (sources were snippet-only). Two of its pairs are now covered instead by
**official cautions** quoting verified documents (`data/official.json`):
ginkgo + clopidogrel (EMA ginkgo monograph; Health Canada) and liquorice + amlodipine (EMA
liquorice monograph, Revision 1, 2026). The Drugs.com-based liquorice proposal is no longer
needed. Asian ginseng + aspirin is still only in round 2.
