# HerbSafe test cases

Ten realistic medicine lists for heart patients (HerbSafe’s focus for Challenge 4: cardiovascular disease). Every person here is fictional.

The machine-readable copy is `tests/test-cases.json`. Check both with `node tests/run-tests.js`, or open `tests/test.html` through a local server. Results are listed in the order the Results screen shows them: High → Moderate → Low → No reported risk → Not in database.

"Not in database" means we have no record. It does **not** mean the pair is safe.

The heart-disease update (18 Oct 2026) added the “Why this matters for your heart” line, medicine groups and herb uses. **No rating changed**: the test “every rating, watch flag and rating source matches the brief” guards this, and every expected result below is unchanged.

The 15 owner-approved pairs went live on 18 Oct 2026. Cases 1, 4 and 10 now expect those ratings where they used to expect "Not in database"; no earlier rating changed.

## 1. Mrs Wong (demo case)

Fictional 72-year-old with atrial fibrillation, on warfarin and amlodipine, who buys danshen.

- **Chinese herbs:** Danshen 丹參
- **Western medicines:** Warfarin – Blood thinners (stroke and heart valve protection), Amlodipine – Blood pressure and fluid

| Herb | Medicine | Expected result | Entry | Why this matters for your heart |
|---|---|---|---|---|
| Danshen | Warfarin | Moderate | `danshen-warfarin` | Too much bleeding, including bleeding in the brain. |
| Danshen | Amlodipine | Low | `danshen-amlodipine` | Amlodipine controls your blood pressure. Whether danshen weakens it in people is not known. |

## 2. Nothing in our database

Goji, sanqi and safflower with blood pressure medicine. We have no records, so every card must say 'not in database', never 'safe'.

- **Chinese herbs:** Goji 枸杞, Sanqi 三七, Safflower 紅花
- **Western medicines:** Amlodipine – Blood pressure and fluid

| Herb | Medicine | Expected result | Entry | Why this matters for your heart |
|---|---|---|---|---|
| Goji | Amlodipine | Not in database | none | (not shown on grey cards) |
| Sanqi | Amlodipine | Not in database | none | (not shown on grey cards) |
| Safflower | Amlodipine | Not in database | none | (not shown on grey cards) |

## 3. Statin + red yeast rice

Takes simvastatin for cholesterol and adds red yeast rice 'to help naturally'. Matches through the statin class.

- **Chinese herbs:** Red yeast rice 紅麴
- **Western medicines:** Simvastatin – Cholesterol, Amlodipine – Blood pressure and fluid

| Herb | Medicine | Expected result | Entry | Why this matters for your heart |
|---|---|---|---|---|
| Red yeast rice | Simvastatin | High | `red_yeast_rice-statin` | A double statin dose can damage muscles and the liver. |
| Red yeast rice | Amlodipine | Not in database | none | (not shown on grey cards) |

## 4. Several flagged pairs

Heart failure and atrial fibrillation: warfarin, aspirin, digoxin and furosemide, plus dong quai, ginkgo and liquorice.

- **Chinese herbs:** Dong quai 當歸, Ginkgo 銀杏, Liquorice 甘草
- **Western medicines:** Warfarin – Blood thinners (stroke and heart valve protection), Aspirin – Blood thinners (stroke and heart valve protection), Digoxin – Heart rhythm and heart failure, Furosemide – Blood pressure and fluid

| Herb | Medicine | Expected result | Entry | Why this matters for your heart |
|---|---|---|---|---|
| Dong quai | Warfarin | High | `dong_quai-warfarin` | Too much bleeding, including bleeding in the brain. |
| Liquorice | Digoxin | Moderate | `liquorice-digoxin` | Low potassium can lead to a dangerous heart rhythm. |
| Liquorice | Furosemide | Moderate | `liquorice-diuretic` | Low potassium can lead to a dangerous heart rhythm. |
| Dong quai | Aspirin | Low | `dong_quai-aspirin` | Watch for unusual bruising or bleeding. |
| Ginkgo | Warfarin | Low (watch) | `ginkgo-warfarin` | Watch for unusual bruising or bleeding. |
| Ginkgo | Aspirin | Low (watch) | `ginkgo-aspirin` | Watch for unusual bruising or bleeding. |
| Dong quai | Digoxin | Not in database | none | (not shown on grey cards) |
| Dong quai | Furosemide | Not in database | none | (not shown on grey cards) |
| Ginkgo | Digoxin | Not in database | none | (not shown on grey cards) |
| Ginkgo | Furosemide | Not in database | none | (not shown on grey cards) |
| Liquorice | Warfarin | Not in database | none | (not shown on grey cards) |
| Liquorice | Aspirin | Not in database | none | (not shown on grey cards) |

## 5. American ginseng with warfarin

Drinks 花旗參 tea daily and is on warfarin after a heart valve operation.

- **Chinese herbs:** American ginseng 花旗參
- **Western medicines:** Warfarin – Blood thinners (stroke and heart valve protection)

| Herb | Medicine | Expected result | Entry | Why this matters for your heart |
|---|---|---|---|---|
| American ginseng | Warfarin | Moderate | `american_ginseng-warfarin` | Warfarin may work less well, raising the risk of clots and stroke. |

## 6. Asian ginseng with warfarin and clopidogrel

Takes Korean ginseng with warfarin and clopidogrel after a stent. Clopidogrel has no record and must not look safe.

- **Chinese herbs:** Asian ginseng 人參
- **Western medicines:** Warfarin – Blood thinners (stroke and heart valve protection), Clopidogrel – Blood thinners (stroke and heart valve protection)

| Herb | Medicine | Expected result | Entry | Why this matters for your heart |
|---|---|---|---|---|
| Asian ginseng | Warfarin | Low | `asian_ginseng-warfarin` | Warfarin may work less well, raising the risk of clots and stroke. |
| Asian ginseng | Clopidogrel | Not in database | none | (not shown on grey cards) |

## 7. Liquorice with furosemide only

On furosemide for swollen ankles, takes a herbal tea containing 甘草. Matches through the diuretic class.

- **Chinese herbs:** Liquorice 甘草
- **Western medicines:** Furosemide – Blood pressure and fluid

| Herb | Medicine | Expected result | Entry | Why this matters for your heart |
|---|---|---|---|---|
| Liquorice | Furosemide | Moderate | `liquorice-diuretic` | Low potassium can lead to a dangerous heart rhythm. |

## 8. Red yeast rice with two statins

Switched from atorvastatin to rosuvastatin and still has both on the list, plus red yeast rice. Both statins must match.

- **Chinese herbs:** Red yeast rice 紅麴
- **Western medicines:** Atorvastatin – Cholesterol, Rosuvastatin – Cholesterol

| Herb | Medicine | Expected result | Entry | Why this matters for your heart |
|---|---|---|---|---|
| Red yeast rice | Atorvastatin | High | `red_yeast_rice-statin` | A double statin dose can damage muscles and the liver. |
| Red yeast rice | Rosuvastatin | High | `red_yeast_rice-statin` | A double statin dose can damage muscles and the liver. |

## 9. Ginkgo with aspirin and clopidogrel

Takes ginkgo for memory, on aspirin and clopidogrel. Only ginkgo + aspirin has a record; ginkgo + clopidogrel must show 'not in database'.

- **Chinese herbs:** Ginkgo 銀杏
- **Western medicines:** Aspirin – Blood thinners (stroke and heart valve protection), Clopidogrel – Blood thinners (stroke and heart valve protection)

| Herb | Medicine | Expected result | Entry | Why this matters for your heart |
|---|---|---|---|---|
| Ginkgo | Aspirin | Low (watch) | `ginkgo-aspirin` | Watch for unusual bruising or bleeding. |
| Ginkgo | Clopidogrel | Not in database | none | (not shown on grey cards) |

## 10. Danshen, sanqi and safflower with warfarin and aspirin

A 'blood circulation' herbal mix (丹參, 三七, 紅花) taken with warfarin and aspirin. Every pair now has a record: three Moderate and three Low.

- **Chinese herbs:** Danshen 丹參, Sanqi 三七, Safflower 紅花
- **Western medicines:** Warfarin – Blood thinners (stroke and heart valve protection), Aspirin – Blood thinners (stroke and heart valve protection)

| Herb | Medicine | Expected result | Entry | Why this matters for your heart |
|---|---|---|---|---|
| Danshen | Warfarin | Moderate | `danshen-warfarin` | Too much bleeding, including bleeding in the brain. |
| Sanqi | Aspirin | Moderate | `sanqi-aspirin` | A stronger anti-clotting effect could raise the chance of bleeding. |
| Safflower | Warfarin | Moderate | `safflower-warfarin` | Too much bleeding, including bleeding in the brain. |
| Danshen | Aspirin | Low (watch) | `danshen-aspirin` | Watch for unusual bruising or bleeding. |
| Sanqi | Warfarin | Low (watch) | `sanqi-warfarin` | If warfarin works too strongly you may bleed; if it works less well, the risk of clots and stroke rises. |
| Safflower | Aspirin | Low | `safflower-aspirin` | Watch for unusual bruising or bleeding. |
