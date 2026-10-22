# Recording list (Read aloud)

Human recordings for the demo pairs (Mrs Wong: warfarin and amlodipine, then danshen). A recording
is played instead of the phone voice for that pair and language; any pair or language without one
uses the phone voice. Made by `tools/make-spoken-scripts.js` from the same script as the app
(`js/speech.js`, see `docs/spoken-scripts.txt`). Do not use AI-generated voices.

## How to record

- Read each numbered line as a short sentence, with a short pause (about 1 second) between lines.
- Quiet room, phone about 20 cm from the mouth, no music. Normal, calm speed.
- English: British English. Chinese: Cantonese, read as written (it is Cantonese-style written Chinese).
- Format in the app: **MP3, mono, 44.1 kHz, 64–96 kbps, under 1 MB** per file (about 1 minute or less).
- A phone recording (`.m4a`) is fine: save it in `audio/` with the name below but ending `.m4a`
  (e.g. `audio/danshen-warfarin.en.m4a`), then run `python3 tools/add-recordings.py`. It converts it
  to that MP3 format, lists it in `audio/manifest.json` and bumps the cache version in `sw.js`.
- Check: `node tests/run-tests.js` (every listed file must exist and be named correctly) and
  `node tools/check-recordings.js` (each recording plays instead of the phone voice).

## Checklist

Every pair the demo shows: 2 pairs, 2 need attention, 0 "no record" card(s).

- [ ] `audio/danshen-warfarin.en.mp3`: Danshen + Warfarin, English
- [ ] `audio/danshen-warfarin.zh.mp3`: Danshen + Warfarin, Cantonese
- [ ] `audio/danshen-amlodipine.en.mp3`: Danshen + Amlodipine, English
- [ ] `audio/danshen-amlodipine.zh.mp3`: Danshen + Amlodipine, Cantonese

## Danshen + Warfarin (丹參 + 華法林)

**English**: save as `audio/danshen-warfarin.en.mp3`

1. Danshen and warfarin. High risk.
2. The Hospital Authority says: Do not take any Traditional Chinese Medicines, Proprietary Chinese Medicines, herbal drinks, or food that contains TCM, such as Guilinggao. Many TCM such as ginseng, Dong quai, Danshen, Chishao can interact with warfarin.
3. What to do: tell your doctor that you take danshen, and ask about a clotting test.
4. Why this matters for your heart: serious bleeding, including internal bleeding.
5. What people take it for: in China, a danshen product is approved for angina, chest pain from heart disease.
6. This is not a recommendation to take it.
7. Next: show your doctor and your Chinese medicine practitioner. You can say: ‘I take danshen and warfarin. Can you check if that’s OK for me?’

**Cantonese 廣東話**: save as `audio/danshen-warfarin.zh.mp3`

1. 丹參同華法林。高度風險。
2. 醫院管理局話：不可隨便服用中藥材，中成藥，藥材湯或涼茶，或含中藥成份的食品如龜苓膏，因為很多中藥，如人參、當歸、丹參、赤芍，會與「華法林」產生相互作用，影響抗凝血藥的功效。
3. 應該點做：話俾醫生知你有食丹參，同埋問吓需唔需要驗凝血指數。
4. 對心臟有咩影響：嚴重出血，包括內出血。
5. 一般用嚟做咩：喺中國，有丹參產品獲批用嚟治心絞痛，心臟病引致嘅胸口痛。
6. 呢個唔係建議你服用。
7. 下一步：俾醫生同中醫師睇。你可以咁講：『我有食丹參同華法林，可唔可以幫我睇吓有冇問題？』

## Danshen + Amlodipine (丹參 + 氨氯地平)

**English**: save as `audio/danshen-amlodipine.en.mp3`

1. Danshen and amlodipine. Low risk. Keep an eye on it.
2. What to do: tell your doctor or pharmacist that you take danshen, so they can keep an eye on your blood pressure.
3. Why this matters for your heart: amlodipine controls your blood pressure. Whether danshen weakens it in people is not known.
4. What people take it for: in China, a danshen product is approved for angina, chest pain from heart disease.
5. This is not a recommendation to take it.
6. Next: show your doctor and your Chinese medicine practitioner. You can say: ‘I take danshen and amlodipine. Can you check if that’s OK for me?’

**Cantonese 廣東話**: save as `audio/danshen-amlodipine.zh.mp3`

1. 丹參同氨氯地平。低度風險。要留意。
2. 應該點做：話俾醫生或者藥劑師知你有食丹參，等佢哋留意你嘅血壓。
3. 對心臟有咩影響：氨氯地平用嚟控制血壓。丹參喺人體會唔會減弱佢嘅效果，仲未知道。
4. 一般用嚟做咩：喺中國，有丹參產品獲批用嚟治心絞痛，心臟病引致嘅胸口痛。
5. 呢個唔係建議你服用。
6. 下一步：俾醫生同中醫師睇。你可以咁講：『我有食丹參同氨氯地平，可唔可以幫我睇吓有冇問題？』
