# Official-source checklist (herb warnings)

**Why this exists:** the owner's rule is that every source must be officially confirmed. The build machine could not open any official website, so every warning below was seen only as a search-result snippet. **A person must open each link and tick it.** Only ticked warnings may go into the app, and only after the owner approves how they are shown.

How to check one line: open the link, use Ctrl+F (or Find on page) to look for the sentence, and tick **Confirmed** only if the page says the same thing. If it says something different or you cannot find it, tick **Not found** and write what it says.

Status: NOT LIVE. Prepared 18 Oct 2026 from `herb-warnings-candidates-A.json` and `-B.json`.

## Part 1: would turn grey cards into official warnings

These are the ones that reduce grey. Check these first.
### 1. ginkgo with antiplatelet → fills: ginkgo + clopidogrel

- **Official body:** European Medicines Agency (HMPC)
- **Open this:** <https://www.ema.europa.eu/en/documents/herbal-monograph/final-european-union-herbal-monograph-ginkgo-biloba-l-folium_en.pdf>
- **Find this sentence (or one meaning the same):** "... or antiplatelet drugs (e.g. clopidogrel, acetylsalicylic acid and other non-steroidal anti-inflammatory drugs), their effect may be influenced. ... concomitant anticoagulant and antiplatelet treatment, the medicinal product should only be used after consultation with a doctor. (Search-snippet fragments of sections 4.5 and 4.4.)"
- **What the app would say:** The European Medicines Agency says that when ginkgo leaf is taken with antiplatelet medicines such as aspirin or clopidogrel, their effect may be changed, and that people on these medicines should only use ginkgo after talking to a doctor.
- **中文:** 歐洲藥品管理局話，銀杏葉同阿士匹靈、氯吡格雷呢類抗血小板藥一齊食，可能會影響藥物嘅作用；食緊呢類藥嘅人，要同醫生傾過先好用銀杏。
- [ ] Confirmed, word for word   - [ ] Not found / different   - Checked by: ________  Date: ______

### 2. ginkgo with blood pressure all → fills: ginkgo + amlodipine, ginkgo + furosemide

- **Official body:** Health Canada (NNHPD)
- **Open this:** <https://webprod.hc-sc.gc.ca/nhpid-bdipsn/atReq?atid=ginkgo.biloba2&lang=eng>
- **Find this sentence (or one meaning the same):** "Ask a health care practitioner before use if you are taking medications for diabetes, high blood pressure or seizures. (Health Canada ginkgo monograph, cited there to Brinker 2010; reported by search summary, and the same wording appears on Health Canada-licensed product labels, e.g. NPN 80022257.)"
- **What the app would say:** Health Canada says to ask a health professional before taking ginkgo if you take medicine for high blood pressure.
- **中文:** 加拿大衞生部話，如果你食緊降血壓藥，食銀杏之前要先問醫護人員。
- [ ] Confirmed, word for word   - [ ] Not found / different   - Checked by: ________  Date: ______

### 3. american_ginseng with cardiac glycoside → fills: American ginseng + digoxin

- **Official body:** Health Canada (Natural and Non-prescription Health Products Directorate)
- **Open this:** <https://webprod.hc-sc.gc.ca/nhpid-bdipsn/dbImages/mono_ginseng-american_english.pdf>
- **Find this sentence (or one meaning the same):** "Ask a health care practitioner/health care provider/health care professional/doctor/physician before use if you are taking blood thinners or digoxin."
- **What the app would say:** Health Canada says to ask a health professional before using American ginseng if you take digoxin.
- **中文:** 加拿大衞生部話，如果你食緊地高辛（Digoxin），用西洋參之前要先問醫護人員。
- [ ] Confirmed, word for word   - [ ] Not found / different   - Checked by: ________  Date: ______

### 4. asian_ginseng with cardiac glycoside → fills: Asian ginseng + digoxin

- **Official body:** Health Canada (Natural and Non-prescription Health Products Directorate)
- **Open this:** <https://webprod.hc-sc.gc.ca/nhpid-bdipsn/dbImages/mono_ginseng-panax_english.pdf>
- **Find this sentence (or one meaning the same):** "Consult a health care practitioner/health care provider/health care professional/doctor/physician prior to use if you are taking antidepressant medication, blood thinners or digoxin."
- **What the app would say:** Health Canada says to ask a health professional before using Asian ginseng if you take digoxin.
- **中文:** 加拿大衞生部話，如果你食緊地高辛（Digoxin），用人參之前要先問醫護人員。
- [ ] Confirmed, word for word   - [ ] Not found / different   - Checked by: ________  Date: ______

### 5. liquorice with all blood pressure medicines → fills: liquorice + amlodipine

- **Official body:** European Medicines Agency, HMPC
- **Open this:** <https://www.ema.europa.eu/en/documents/herbal-monograph/draft-european-union-herbal-monograph-glycyrrhiza-glabra-l-gycyrrhiza-inflata-bat-glycyrrhiza-uralensis-fisch-radix-revision-1_en.pdf>
- **Find this sentence (or one meaning the same):** "Liquorice root may counteract antihypertensive action of prescribed medications."
- **What the app would say:** The European Medicines Agency says liquorice root may work against blood pressure medicines. The Hong Kong Hospital Authority says taking larger amounts of liquorice for a long time can raise blood pressure and weaken blood pressure medicines.
- **中文:** 歐洲藥品管理局話，甘草可能抵消降血壓藥嘅作用。香港醫院管理局話，長期食較大份量嘅甘草，可以令血壓升高，減弱降血壓藥嘅效果。
- **Note:** this link is a *draft* EMA document. Please check the final version (Revision 1, published 20 Jul 2026) says the same.
- [ ] Confirmed, word for word   - [ ] Not found / different   - Checked by: ________  Date: ______

## Part 2: weaker (the official body only says it is *uncertain*)

Probably not worth showing; listed so nothing is hidden.

### 6. asian_ginseng with calcium channel blocker → would cover: Asian ginseng + amlodipine

- **Official body:** US NIH NCCIH
- **Open this:** <https://www.nccih.nih.gov/health/providers/digest/herb-drug-interactions-science>
- **Find this sentence (or one meaning the same):** "There are uncertainties about whether ginseng might interact with certain medications, such as calcium channel blockers and other high blood pressure medications, as well as statin medications and some antidepressants. (near-verbatim, reconstructed from search snippets)"
- **What the app would say:** The US NIH (NCCIH) says it is uncertain whether Asian ginseng interacts with calcium channel blockers such as amlodipine and other blood pressure medicines.
- **中文:** 美國國家衞生研究院（NCCIH）話，暫時未確定人參會唔會同鈣離子通道阻斷劑（例如氨氯地平）同其他降血壓藥有相互作用。
- [ ] Confirmed, word for word   - [ ] Not found / different   - Checked by: ________  Date: ______

### 7. asian_ginseng with statin → would cover: Asian ginseng + atorvastatin, simvastatin, rosuvastatin

- **Official body:** US NIH NCCIH
- **Open this:** <https://www.nccih.nih.gov/health/providers/digest/herb-drug-interactions-science>
- **Find this sentence (or one meaning the same):** "There are uncertainties about whether ginseng might interact with certain medications, such as calcium channel blockers and other high blood pressure medications, as well as statin medications and some antidepressants. (near-verbatim, reconstructed from search snippets)"
- **What the app would say:** The US NIH (NCCIH) says it is uncertain whether Asian ginseng interacts with statins.
- **中文:** 美國國家衞生研究院（NCCIH）話，暫時未確定人參會唔會同他汀類降膽固醇藥有相互作用。
- [ ] Confirmed, word for word   - [ ] Not found / different   - Checked by: ________  Date: ______

## Part 3: official backing for pairs that are already live

These do not reduce grey, but they would give the existing cards an official source, which the owner now requires.

### 8. ginkgo + warfarin (already live)

- **Official body:** European Medicines Agency (HMPC)
- **Open this:** <https://www.ema.europa.eu/en/documents/herbal-monograph/final-european-union-herbal-monograph-ginkgo-biloba-l-folium_en.pdf>
- **Find this sentence (or one meaning the same):** "Ginkgo leaf may increase the effects of anticoagulants such as coumarin derivatives [warfarin, phenprocoumon] ... In patients with ... concomitant anticoagulant and antiplatelet treatment, the medicinal product should only be used after consultation with a doctor. (Search-snippet fragments of sections 4.5 and 4.4; exact full sentences not seen.)"
- **What the app would say:** The European Medicines Agency says ginkgo leaf may increase the effect of blood thinners such as warfarin. The US National Institutes of Health (NCCIH) says ginkgo may increase the risk of bleeding in people taking warfarin.
- **中文:** 歐洲藥品管理局話，銀杏葉可能會加強華法林呢類薄血藥嘅作用。美國國家衞生研究院（NCCIH）話，食緊華法林嘅人食銀杏，可能會增加出血風險。
- [ ] Confirmed, word for word   - [ ] Not found / different   - Checked by: ________  Date: ______

### 9. dong quai + warfarin (already live)

- **Official body:** Hong Kong Hospital Authority
- **Open this:** <https://www.ha.org.hk/hadf/Content/uploads/docs/mcfDfgqUQ5320084.pdf>
- **Find this sentence (or one meaning the same):** "Do not take any Traditional Chinese Medicines (TCM), Proprietary Chinese Medicines, herbal drinks, or food that contains TCM, such as Guilinggao. Many TCM such as ginseng, Dong quai, Danshen, Chishao can interact with warfarin."
- **What the app would say:** The Hong Kong Hospital Authority's warfarin leaflet names dong quai as a Chinese medicine that can interact with warfarin. The US National Institutes of Health (NCCIH) also says dong quai may interact with warfarin.
- **中文:** 香港醫院管理局嘅華法林單張指出，當歸係可能同華法林有相互作用嘅中藥。美國國家衞生研究院（NCCIH）都話，當歸可能會同華法林有相互作用。
- **Note:** two HA warfarin leaflets exist; please check this is the current one. The leaflet also says "Do not take any Traditional Chinese Medicines": tell me if you want that quoted.
- [ ] Confirmed, word for word   - [ ] Not found / different   - Checked by: ________  Date: ______

### 10. danshen + warfarin (already live)

- **Official body:** Hong Kong Hospital Authority
- **Open this:** <https://www.ha.org.hk/hadf/Content/uploads/docs/mcfDfgqUQ5320084.pdf>
- **Find this sentence (or one meaning the same):** "Do not take any Traditional Chinese Medicines (TCM), Proprietary Chinese Medicines, herbal drinks, or food that contains TCM, such as Guilinggao. Many TCM such as ginseng, Dong quai, Danshen, Chishao can interact with warfarin."
- **What the app would say:** The Hong Kong Hospital Authority's warfarin leaflet names danshen as a Chinese medicine that can interact with warfarin.
- **中文:** 香港醫院管理局嘅華法林單張指出，丹參係可能同華法林有相互作用嘅中藥。
- **Note:** two HA warfarin leaflets exist; please check this is the current one. The leaflet also says "Do not take any Traditional Chinese Medicines": tell me if you want that quoted.
- [ ] Confirmed, word for word   - [ ] Not found / different   - Checked by: ________  Date: ______

### 11. American ginseng + warfarin (already live)

- **Official body:** Health Canada (Natural and Non-prescription Health Products Directorate)
- **Open this:** <https://webprod.hc-sc.gc.ca/nhpid-bdipsn/dbImages/mono_ginseng-american_english.pdf>
- **Find this sentence (or one meaning the same):** "Ask a health care practitioner/health care provider/health care professional/doctor/physician before use if you are taking blood thinners or digoxin."
- **What the app would say:** Health Canada says to ask a health professional before using American ginseng if you take blood thinners. The US NIH (NCCIH) says American ginseng may interact with warfarin.
- **中文:** 加拿大衞生部話，如果你食緊薄血藥，用西洋參之前要先問醫護人員。美國國家衞生研究院（NCCIH）話，西洋參可能同華法林有相互作用。
- [ ] Confirmed, word for word   - [ ] Not found / different   - Checked by: ________  Date: ______

### 12. Asian ginseng + warfarin (already live)

- **Official body:** Health Canada (Natural and Non-prescription Health Products Directorate)
- **Open this:** <https://webprod.hc-sc.gc.ca/nhpid-bdipsn/dbImages/mono_ginseng-panax_english.pdf>
- **Find this sentence (or one meaning the same):** "Consult a health care practitioner/health care provider/health care professional/doctor/physician prior to use if you are taking antidepressant medication, blood thinners or digoxin."
- **What the app would say:** Health Canada says to ask a health professional before using Asian ginseng if you take blood thinners. The Hong Kong Hospital Authority says ginseng may make warfarin work less well; US NIH (NCCIH) says studies on ginseng and warfarin have mixed results.
- **中文:** 加拿大衞生部話，如果你食緊薄血藥，用人參之前要先問醫護人員。香港醫院管理局話，人參可能令華法林藥效減弱；美國國家衞生研究院（NCCIH）就話，人參同華法林嘅研究結果唔一致。
- [ ] Confirmed, word for word   - [ ] Not found / different   - Checked by: ________  Date: ______

### 13. liquorice + furosemide (already live)

- **Official body:** European Medicines Agency, HMPC
- **Open this:** <https://www.ema.europa.eu/en/documents/herbal-monograph/draft-european-union-herbal-monograph-glycyrrhiza-glabra-l-gycyrrhiza-inflata-bat-glycyrrhiza-uralensis-fisch-radix-revision-1_en.pdf>
- **Find this sentence (or one meaning the same):** "Not to be used concomitantly with diuretics, cardiac glycosides, corticosteroids, stimulant laxatives or other medications which may aggravate electrolyte imbalance (see section 4.4)."
- **What the app would say:** The European Medicines Agency says liquorice root should not be used together with diuretics (water pills), because it can upset the body's salt and potassium balance. MSKCC says liquorice may lower blood potassium in people taking diuretics.
- **中文:** 歐洲藥品管理局話，甘草唔應該同利尿藥（去水丸）一齊用，因為可能打亂身體嘅鹽分同鉀平衡。MSKCC話，食緊利尿藥嘅人用甘草，血鉀可能會降低。
- **Note:** this link is a *draft* EMA document. Please check the final version (Revision 1, published 20 Jul 2026) says the same.
- [ ] Confirmed, word for word   - [ ] Not found / different   - Checked by: ________  Date: ______

### 14. liquorice + digoxin (already live)

- **Official body:** European Medicines Agency, HMPC
- **Open this:** <https://www.ema.europa.eu/en/documents/herbal-monograph/draft-european-union-herbal-monograph-glycyrrhiza-glabra-l-gycyrrhiza-inflata-bat-glycyrrhiza-uralensis-fisch-radix-revision-1_en.pdf>
- **Find this sentence (or one meaning the same):** "Not to be used concomitantly with diuretics, cardiac glycosides, corticosteroids, stimulant laxatives or other medications which may aggravate electrolyte imbalance (see section 4.4)."
- **What the app would say:** The European Medicines Agency says liquorice root should not be used together with heart medicines such as digoxin. The Hong Kong Hospital Authority says liquorice may cause low potassium, which makes heart side effects of digoxin more likely.
- **中文:** 歐洲藥品管理局話，甘草唔應該同地高辛（Digoxin）呢類強心藥一齊用。香港醫院管理局話，甘草可能令血鉀過低，令地高辛更容易對心臟產生副作用。
- **Note:** this link is a *draft* EMA document. Please check the final version (Revision 1, published 20 Jul 2026) says the same.
- [ ] Confirmed, word for word   - [ ] Not found / different   - Checked by: ________  Date: ______

### 15. goji + warfarin (already live)

- **Official body:** Memorial Sloan Kettering Cancer Center (owner-accepted)
- **Open this:** <https://www.mskcc.org/cancer-care/integrative-medicine/herbs/lycium>
- **Find this sentence (or one meaning the same):** "A few cases of elevated INR were reported in patients on anticoagulant therapy after consuming Lycium products. (patient-facing point, near-verbatim from snippet)"
- **What the app would say:** MSKCC reports a few cases of raised INR in people on blood thinners after taking goji (Lycium) products. The Hong Kong Hospital Authority says goji may slow the breakdown of warfarin.
- **中文:** MSKCC記錄咗幾個食緊薄血藥嘅人，食咗枸杞產品之後INR升高嘅個案。香港醫院管理局話，枸杞子可能減慢身體分解華法林。
- [ ] Confirmed, word for word   - [ ] Not found / different   - Checked by: ________  Date: ______

### 16. red yeast rice + statins (already live)

- **Official body:** Memorial Sloan Kettering Cancer Center (owner-accepted)
- **Open this:** <https://www.mskcc.org/cancer-care/integrative-medicine/herbs/red-yeast-rice>
- **Find this sentence (or one meaning the same):** "Do Not Take if: You are taking cholesterol-lowering drugs. (MSKCC patient section, near-verbatim) / 'Side effects and interactions can be comparable to statin drugs.'"
- **What the app would say:** MSKCC says not to take red yeast rice if you take cholesterol-lowering drugs, and EU law requires red yeast rice products to warn people on cholesterol-lowering medicines not to use them. Red yeast rice contains a substance identical to the statin lovastatin.
- **中文:** MSKCC話，如果你食緊降膽固醇藥，就唔好食紅麴。歐盟法例規定紅麴產品要警告食緊降膽固醇藥嘅人唔好用。紅麴含有一種同他汀藥洛伐他汀完全一樣嘅成分。
- [ ] Confirmed, word for word   - [ ] Not found / different   - Checked by: ________  Date: ______

## Nothing official found

No official body says anything about: **sanqi** or **safflower** with any medicine group; **goji** and **red yeast rice** beyond the pairs above; **danshen** and **dong quai** beyond warfarin. Those grey cards stay grey.
