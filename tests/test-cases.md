# HerbSafe test cases

Ten realistic medicine lists. Every person here is fictional.

The machine-readable copy is `tests/test-cases.json`. Check both with `node tests/run-tests.js`, or open `tests/test.html` through a local server. Results are listed in the order the Results screen shows them: High → Moderate → Low → No reported risk → Not in database.

"Not in database" means we have no record. It does **not** mean the pair is safe.

## 1. Mrs Wong (demo case)

Fictional 72-year-old with atrial fibrillation, on warfarin and amlodipine, who buys danshen.

- **Chinese herbs:** Danshen 丹參
- **Western medicines:** Warfarin, Amlodipine

| Herb | Medicine | Expected result | Entry |
|---|---|---|---|
| Danshen | Warfarin | Moderate | `danshen-warfarin` |
| Danshen | Amlodipine | Not in database | none |

## 2. Nothing in our database

Goji, sanqi and safflower with blood pressure medicine. We have no records, so every card must say 'not in database', never 'safe'.

- **Chinese herbs:** Goji 枸杞, Sanqi 三七, Safflower 紅花
- **Western medicines:** Amlodipine

| Herb | Medicine | Expected result | Entry |
|---|---|---|---|
| Goji | Amlodipine | Not in database | none |
| Sanqi | Amlodipine | Not in database | none |
| Safflower | Amlodipine | Not in database | none |

## 3. Statin + red yeast rice

Takes simvastatin for cholesterol and adds red yeast rice 'to help naturally'. Matches through the statin class.

- **Chinese herbs:** Red yeast rice 紅麴
- **Western medicines:** Simvastatin, Amlodipine

| Herb | Medicine | Expected result | Entry |
|---|---|---|---|
| Red yeast rice | Simvastatin | High | `red_yeast_rice-statin` |
| Red yeast rice | Amlodipine | Not in database | none |

## 4. Several flagged pairs

Heart failure and atrial fibrillation: warfarin, aspirin, digoxin and furosemide, plus dong quai, ginkgo and liquorice.

- **Chinese herbs:** Dong quai 當歸, Ginkgo 銀杏, Liquorice 甘草
- **Western medicines:** Warfarin, Aspirin, Digoxin, Furosemide

| Herb | Medicine | Expected result | Entry |
|---|---|---|---|
| Dong quai | Warfarin | High | `dong_quai-warfarin` |
| Liquorice | Digoxin | Moderate | `liquorice-digoxin` |
| Liquorice | Furosemide | Moderate | `liquorice-diuretic` |
| Ginkgo | Warfarin | Low (watch) | `ginkgo-warfarin` |
| Ginkgo | Aspirin | Low (watch) | `ginkgo-aspirin` |
| Dong quai | Aspirin | Not in database | none |
| Dong quai | Digoxin | Not in database | none |
| Dong quai | Furosemide | Not in database | none |
| Ginkgo | Digoxin | Not in database | none |
| Ginkgo | Furosemide | Not in database | none |
| Liquorice | Warfarin | Not in database | none |
| Liquorice | Aspirin | Not in database | none |

## 5. American ginseng with warfarin

Drinks 花旗參 tea daily and is on warfarin after a heart valve operation.

- **Chinese herbs:** American ginseng 花旗參
- **Western medicines:** Warfarin

| Herb | Medicine | Expected result | Entry |
|---|---|---|---|
| American ginseng | Warfarin | Moderate | `american_ginseng-warfarin` |

## 6. Asian ginseng with warfarin and clopidogrel

Takes Korean ginseng with warfarin and clopidogrel after a stent. Clopidogrel has no record and must not look safe.

- **Chinese herbs:** Asian ginseng 人參
- **Western medicines:** Warfarin, Clopidogrel

| Herb | Medicine | Expected result | Entry |
|---|---|---|---|
| Asian ginseng | Warfarin | Low | `asian_ginseng-warfarin` |
| Asian ginseng | Clopidogrel | Not in database | none |

## 7. Liquorice with furosemide only

On furosemide for swollen ankles, takes a herbal tea containing 甘草. Matches through the diuretic class.

- **Chinese herbs:** Liquorice 甘草
- **Western medicines:** Furosemide

| Herb | Medicine | Expected result | Entry |
|---|---|---|---|
| Liquorice | Furosemide | Moderate | `liquorice-diuretic` |

## 8. Red yeast rice with two statins

Switched from atorvastatin to rosuvastatin and still has both on the list, plus red yeast rice. Both statins must match.

- **Chinese herbs:** Red yeast rice 紅麴
- **Western medicines:** Atorvastatin, Rosuvastatin

| Herb | Medicine | Expected result | Entry |
|---|---|---|---|
| Red yeast rice | Atorvastatin | High | `red_yeast_rice-statin` |
| Red yeast rice | Rosuvastatin | High | `red_yeast_rice-statin` |

## 9. Ginkgo with aspirin and clopidogrel

Takes ginkgo for memory, on aspirin and clopidogrel. Only ginkgo + aspirin has a record; ginkgo + clopidogrel must show 'not in database'.

- **Chinese herbs:** Ginkgo 銀杏
- **Western medicines:** Aspirin, Clopidogrel

| Herb | Medicine | Expected result | Entry |
|---|---|---|---|
| Ginkgo | Aspirin | Low (watch) | `ginkgo-aspirin` |
| Ginkgo | Clopidogrel | Not in database | none |

## 10. Danshen, sanqi and safflower with warfarin and aspirin

A 'blood circulation' herbal mix (丹參, 三七, 紅花) taken with warfarin and aspirin. Only danshen + warfarin has a record; every other pair must show 'not in database', never 'safe'.

- **Chinese herbs:** Danshen 丹參, Sanqi 三七, Safflower 紅花
- **Western medicines:** Warfarin, Aspirin

| Herb | Medicine | Expected result | Entry |
|---|---|---|---|
| Danshen | Warfarin | Moderate | `danshen-warfarin` |
| Danshen | Aspirin | Not in database | none |
| Sanqi | Warfarin | Not in database | none |
| Sanqi | Aspirin | Not in database | none |
| Safflower | Warfarin | Not in database | none |
| Safflower | Aspirin | Not in database | none |
