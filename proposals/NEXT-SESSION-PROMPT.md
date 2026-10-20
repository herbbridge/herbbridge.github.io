You are taking over HerbBridge 中西通, a static web app I am building for the Imperial College London Hackathon (Hong Kong & Macau 2026), Challenge 4: Chinese and Western medicine, focusing on cardiovascular disease. Tagline: "Chinese and Western medicine, safely together." It lets heart patients in Hong Kong check the Chinese herbs they take against their heart, blood pressure, cholesterol and blood-thinning medicines.

- Code: https://github.com/herbsafe/herbsafe.github.io (branch main)
- Live site: https://herbsafe.github.io (GitHub Pages deploys from main)

Clone the repo and read README.md, HANDOVER.md and proposals/README.md before doing anything.

## Hard rules (never break these)

1. No AI-generated answers. Every result comes from the hand-curated JSON in data/. The app only looks things up.
2. A missing pair is never "safe". It shows a grey card with its own icon and exactly this text: "We have no record of this combination. This does not mean it is safe. Please ask your pharmacist or doctor."
3. Every rated pair shows clickable sources and an evidence-level label (Case reports, Human trial, Review, Lab/animal studies, Official guidance).
4. Advice covers monitoring and talking to a professional only. No dosing or timing advice unless the source states it.
5. Disclaimer on every result: "HerbBridge gives information, not medical advice. Never stop or change a medicine without talking to your doctor or pharmacist."
6. British spelling. All Chinese is Traditional, Cantonese-style written Chinese (食, 話俾醫生知, 嘅). Never use 同時服用 or 中風險 (write 中度風險). New Chinese text is marked zh_reviewed: false.
7. Only verified content. Every sentence must be supported by its cited sources. Never invent a pair or change a rating. New pairs go into proposals/ first and go live only after I approve each one.
8. Static site: plain HTML/CSS/vanilla JS, no build step, no frameworks, no backend. Mobile-first, large text, big tap targets. No accounts and no tracking; the medicine list stays in the browser (localStorage).
9. Ask me before any big decision. Explain things in plain words, keep updates short, and tell me what to check in the browser after each change.

## Where things stand (18 Oct 2026)

- Live: 9 rated pairs, rated on the Hospital Authority's four-level scale (High, Moderate, Low, No reported risk) plus the grey "not in database" card.
  - Danshen + warfarin (Moderate) is the only rating credited to the Hospital Authority; all others are team ratings.
  - Every rated card has a "Main evidence" line and a "Why this matters for your heart" line.
- Interface: the "Calm dashboard" design.
  - Screens: "My medicine cabinet" home, with medicines grouped by heart condition and a "Commonly taken for" line under each herb; instant clash warnings; results; a printable one-page doctor summary; an About page with "Why heart patients?".
  - There is a Mrs Wong demo, and the app installs on phones as a PWA (cache sw.js VERSION = herbsafe-v4).
- Tests: `node tests/run-tests.js` gives 93 passed. BRIEF_RATINGS in tests/test-suite.js locks every rating.

## Task 1: put the 15 approved pairs live

I approved all 15 pairs in proposals/approved-pairs.json on 18 Oct. That includes sanqi + clopidogrel, which the team had suggested holding back because its only study contradicts itself. I approved it anyway.

Follow the "To put them live" steps in proposals/README.md exactly:

1. Append the entries unchanged.
2. Add them to BRIEF_RATINGS.
3. Update the test cases that expected "not in database" for these pairs, and regenerate tests/test-cases.md.
4. Fix the Mrs Wong doctor summary so it prints on one A4 page again.
5. Bump sw.js to herbsafe-v5.
6. Run the tests, then check in a real browser at phone width (320 and 390 px) in English and 中文 that:
   - every rated card has its heart line;
   - nothing overflows sideways;
   - grey cards are unchanged;
   - the summary prints on one page.

Do not reword the entries. Their wording was checked twice; earlier "simplifications" accidentally put back claims the checkers had removed. If something looks wrong, tell me instead of changing it. Commit with clear messages, push to main, and give me a step-by-step list of what to check on the live site.

## Task 2: decisions and checks still open (ask me; don't decide them yourself)

1. **Danshen + warfarin and the Hospital Authority.** The "Moderate" rating, the four-level scale and the advice "INR tests 2–3 times a week" come from a South China Morning Post article (27 Sep 2026) that could only be partly read. I need to confirm it. If I can't, relabel the pair as a team rating and keep it Moderate.
2. **A 2026 study on danshen.** A 2026 Taiwanese self-controlled case series (Ther Adv Drug Saf, PMC13169102) found a strong bleeding signal for danshen with oral anticoagulants. Ask me whether to add it as a source to danshen + warfarin (rating stays as is unless I say otherwise).
3. **Live sources that were never opened in full.** Checked only by web search: Yu, Chan & Sanderson (J Intern Med 1997), Izzat et al. (Ann Thorac Surg 1998), Chan (Ann Pharmacother 2001), Zhuang et al. (Front Pharmacol 2021), Yuan et al. (Ann Intern Med 2004), Lim et al. (Singapore Med J 2018), Yoshino et al. (Front Nutr 2021). If you can open PubMed/PMC, confirm each one supports the exact sentences that cite it. Report any mismatch to me; don't fix it silently.
4. **About page figures.** The DH press release (https://www.info.gov.hk/gia/general/202409/29/P2024092700490.htm) and Lam et al., Hong Kong Med J 2020 (https://www.hkmj.org/node/10340) were found by web search only. Check that the figures quoted in "Why heart patients?" match the sources.
5. **Chinese review.** All Chinese text still needs a native speaker's review. When I confirm that review is done, set every zh_reviewed to true and ZH_REVIEWED in js/i18n.js to true.

## Task 3 (only if I ask): more pairs

Use the same method as before, keeping to Hong Kong heart patients and the 10 herbs and 9 medicines already in data/:

1. Research a candidate pair.
2. Have a separate, independent check confirm every source and remove anything it cannot confirm.
3. Run a second check on wording, Chinese and the safety rules.
4. Write the result to proposals/ with notes for me.
5. Ask me to approve each pair.

Pairs not yet covered include ginkgo + clopidogrel, the ginsengs with aspirin and clopidogrel, goji/sanqi/safflower with amlodipine, digoxin, furosemide and the statins, and liquorice with the blood-pressure medicines.

## Future roadmap (pitch only, do not build)

- Accounts with a private, encrypted medicine history, meeting Hong Kong's Personal Data (Privacy) Ordinance.
- Scanning HK registration numbers on packs (HK-… and HKC-…), always followed by a confirmation step.
- Push notifications for new clashes or database updates.
