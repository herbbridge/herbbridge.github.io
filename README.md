# HerbBridge 中西通

*Bridging you from East to West, easing worries in your chest.* 「中西相通，心頭放鬆。」

HerbBridge is built for **heart patients**: people taking heart, blood pressure, cholesterol or
blood-thinning medicines (Challenge 4: cardiovascular disease).

HerbBridge lets patients in Hong Kong check the Chinese herbs they take against their Western
medicines. Each herb × medicine pair is shown with a rating on a four-level scale (High,
Moderate, Low, No reported risk), a plain-language reason, what to do, the evidence level and
the sources. Where a government health agency has written about a pair, its own words are
quoted as an "Official caution".

Built for the Imperial College London Hackathon (Hong Kong & Macau 2026), Challenge 4.

## Safety rules (more important than any feature)

1. **No generated answers.** Every result comes from the hand-checked files in `data/`.
   The app only looks things up.
2. **"Not in our database" is never "safe".** Missing pairs get a grey card with their own
   icon and the text: "We have no record of this combination. This does not mean it is
   safe. Please ask your pharmacist or doctor."
3. **Every rated pair shows its sources** (clickable) and an evidence level.
4. **Advice is about monitoring and talking to a professional.** No dosing or timing advice
   unless the source states it.
5. **A disclaimer on every result.**
6. **British spelling** in English text.
7. **Only verified content.** Every sentence in a pair must be supported by its cited sources.

## Run it

Browsers block pages opened straight from a file from reading the data, so use a tiny
local server:

```
cd herbsafe.github.io
python3 -m http.server
```

Then open <http://localhost:8000>. (Opening `index.html` by double-click shows a message
explaining this.)

No build step, no frameworks, no backend. Plain HTML, CSS and JavaScript.

## Install it on a phone

Once HerbBridge is online (e.g. GitHub Pages), open it on the phone and choose
"Add to Home Screen" (iPhone: Safari → Share; Android: menu → Install app). It opens
full-screen like an app and works without the internet. Database files are always
fetched fresh when online; the saved copy is used only offline. If you add or rename
app files, list them in `APP_FILES` in `sw.js` and bump `VERSION`.

## Test it

```
node tests/run-tests.js
```

or open <http://localhost:8000/tests/test.html>. The tests check the data files, the
10 medicine lists in `tests/test-cases.md`, search, the safety rules, and that every
interface text exists in English and Chinese.

## How to add an interaction pair

You only edit `data/interactions.json`. No code changes.

1. Copy an existing entry and give it a new `id` such as `"sanqi-warfarin"`.
2. Fill in every field:

| Field | What to write |
|---|---|
| `herb_id` | An `id` from `data/herbs.json` |
| `drug_id` **or** `drug_class` | One of them, never both. `drug_class` matches every drug with that class in `data/drugs.json` (e.g. `"statin"`, `"diuretic"`). An entry for the drug itself wins over a class entry. |
| `risk` | `"high"`, `"moderate"`, `"low"` or `"none_reported"` (lower case) |
| `watch` | `true` shows "Low risk · watch"; otherwise `false` |
| `rating_source` | `"HA"` only if the Hospital Authority rated this pair; otherwise `"team"` |
| `effect_en`, `effect_zh` | One line: what happens |
| `why_en`, `why_zh` | Plain-language mechanism, or `null` for both if no source establishes one |
| `why_pro_en` | Technical detail for professionals, or `null` |
| `action_en`, `action_zh` | What to do: monitoring and talking to a professional |
| `heart_impact_en`, `heart_impact_zh` | One line: why this pair matters for a heart patient (shown under the effect, and in the doctor summary) |
| `main_source` | Which source the rating mainly rests on: `0` = first in `sources`, `1` = second… |
| `main_finding_en`, `main_finding_zh` | One sentence: what that main source found |
| `evidence_level` | A list from `"case_reports"`, `"human_trial"`, `"review"`, `"lab_animal"`, `"official_guidance"` |
| `sources` | A list of `{ "label": "...", "url": "https://..." }` |
| `zh_reviewed` | `false` until a Chinese speaker has checked the Chinese text |

3. Run `node tests/run-tests.js`. The validator tells you exactly what is wrong if a field
   is missing or mistyped.
4. The test "every rating, watch flag and rating source matches the brief" will list your
   new entry. Once the team agrees its rating, add it to `BRIEF_RATINGS` in
   `tests/test-suite.js`. This stops ratings being changed by accident later.

## Official cautions (`data/official.json`)

Some pairs have no study but a government health agency (e.g. the European Medicines Agency,
Health Canada) has written about them. These are shown as **"Official caution"**, quoting the
agency's own words, never reworded, with the body, document, date and section.

- `statements`: one per quoted sentence: `body_en/zh`, `document_en/zh`, `date_en/zh`,
  `section_en/zh`, `url`, `quote_en` (exactly as in the document), `quote_zh` (a translation;
  the English original is always shown under it), `verified` (date it was checked in the
  document).
- `cautions`: which herb × drug (or `drug_class`) a set of statements applies to, and `kind`:
  `"official"`, or `"disagree"` when the agency and the team rating do not agree.
- An official caution shows instead of a Moderate/Low team rating (the team evidence stays on
  the card under "What the studies in our database show"), but never instead of High.
- `general_advice`: Hospital Authority patient leaflets for GROUPS of heart medicines (angina,
  cholesterol-lowering, heart failure, blood pressure). They give general advice about all
  Chinese medicines, so they are shown as "Hospital Authority advice" on grey and rated cards
  (and in the doctor summary), never as a rating and never as an Official caution. Both
  languages are the HA's own wording; each card shows the leaflet's own S/N and date.
- Every quote is locked in `VERIFIED_QUOTES` and every caution in `OFFICIAL_CAUTIONS` in
  `tests/test-suite.js`. Only add a statement after a person has opened the official document
  and copied the sentence.

## Screens and display modes

Screens: `#/cabinet` (add herbs and medicines) → `#/results` (short headline and one compact
card per pair) → `#/pair/<herb_id>-<drug_id>` (everything about one pair) → `#/summary`
(printable doctor summary, one A4 page). The phone's Back button goes back one step and closes
the picker.

Two display modes, switched in the header and remembered on the device:
- **Simple** (default, for older users): very large text, higher contrast, no animation. Result
  cards show the badge, the names and the first sentence of "What to do". On a pair screen the
  rest sits behind one "More details" button. The grey card's required sentence is always shown.
- **Full details**: same screens and content, with icons, a step bar, short transitions (off when
  the phone asks for reduced motion) and every detail open.

## Fonts

`fonts/` holds Inter (latin) and a subset of Noto Sans TC. **Whenever new Chinese text is added
to `data/`, `js/i18n.js`, `js/app.js` or `index.html`, run `python3 tools/make-font-subset.py`**
(needs Python with fonttools and brotli, and npm), then bump `VERSION` in `sw.js`. Characters
missing from the subset fall back to the phone's own font.

## Pharmacist reviews (`data/reviews.json`)

Every card says "Prototype: … not yet reviewed by a pharmacist" until a pharmacist has checked
it. To record a review:

1. The pharmacist reads the card (English and Chinese) in the app.
2. Run `node tests/review-fingerprint.js <herb_id> <drug_id>` (e.g. `danshen warfarin`) and copy
   the 8-character fingerprint.
3. Add to `reviews`: `{ "herb_id": "danshen", "drug_id": "warfarin", "reviewer_en": "…",
   "reviewer_zh": "…", "role_en": "registered pharmacist", "role_zh": "註冊藥劑師",
   "date": "YYYY-MM-DD", "fingerprint": "…" }`.

The card then says "Reviewed by …, …, on …". The fingerprint covers everything the card shows
(team entry, official quotes, Hospital Authority advice). If any of it changes later, the
review stops showing and `node tests/run-tests.js` fails until the card is reviewed again.

To add a herb or a medicine, add it to `data/herbs.json` or `data/drugs.json` with its
English and Chinese names and search `aliases` (pinyin, Cantonese romanisation, brand
names). Only add names you have checked.

- Herbs also need `used_for_en` / `used_for_zh`: what the herb is commonly taken for,
  shown under its name in the picker.
- Medicines also need a `group`: one of the `groups` at the top of `data/drugs.json`
  (blood thinners, cholesterol, heart rhythm and heart failure, blood pressure and fluid).
  The picker lists medicines under these condition headings.

Chinese text is drafted in Cantonese-style written Chinese. When a native speaker has
reviewed everything, set every `zh_reviewed` to `true` and `ZH_REVIEWED` in `js/i18n.js`
to `true`. This removes the "not yet reviewed" note shown in Chinese mode.

## Files

```
index.html            one page; screens switch by #/check, #/results, #/summary, #/about
css/styles.css        styles, including @media print for the doctor summary
js/lookup.js          lookup logic (no DOM), shared by the app and the tests
js/i18n.js            interface text in English and 繁體中文
js/app.js             cabinet, clash warnings, results, summary, About, demo
data/*.json           the hand-checked database
tests/                test cases and runners
HANDOVER.md           decisions made so far and what still needs checking
```

## Privacy

No accounts and no tracking. A person's list is saved only in their own browser
(localStorage) and never leaves the device. The app makes no outside requests: the fonts are
stored in `fonts/` (Inter, and Noto Sans TC cut down to the characters HerbBridge uses).

## Medical disclaimer

HerbBridge gives information, not medical advice. Never stop or change a medicine without
talking to your doctor or pharmacist.
