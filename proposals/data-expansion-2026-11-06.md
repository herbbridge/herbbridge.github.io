# Source check: 6 November 2026

Two additions to the existing 52 interaction records. Ratings are editorial team
judgements, not agency ratings or pharmacist reviews. No review is added to
`data/reviews.json`; new Chinese text remains `zh_reviewed: false`.

## Liquorice + warfarin

[Liu, Srivatsa & Kaul, 2010](https://pmc.ncbi.nlm.nih.gov/articles/PMC2999197/),
doi:10.4240/wjgs.v2.i1.30. Full article read: case, discussion and references.
The card identifies the unusually large black-liquorice exposure and concurrent
bleeding ulcer. It describes association, not causation or a dose threshold.
**Moderate** is a team judgement reflecting a serious reported outcome with
very limited evidence. No mechanism is presented as established. No class rule
is created for other anticoagulants or antiplatelets.

## Ginkgo + clopidogrel

[Aruna & Naidu, 2007](https://pmc.ncbi.nlm.nih.gov/articles/PMC2000722/),
doi:10.1111/j.1365-2125.2006.02759.x. The abstract and indexed results/discussion
were accessible; ordinary full-page retrieval was unreliable. The card and source
label disclose this. Do not describe this as a full-text verification.

[Mai et al., 2025](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0321804),
doi:10.1371/journal.pone.0321804. Publisher full article read. Its observational
association does not establish an interaction's cause or magnitude: concurrent
medicines and comorbidities were not thoroughly controlled. Reported control
counts are inconsistent (489 versus 484), so numerical risk estimates are not
used in the app. The trial's result is not presented as assurance about longer use.

[Health Canada, 25 July 2025](https://webprod.hc-sc.gc.ca/nhpid-bdipsn/dbImages/mono_ginkgo-biloba_english.pdf),
risk information, page 3, rechecked. Existing official quotations are retained
word for word. The existing **Official caution** remains the displayed status;
the new **Low · watch** team judgement is secondary. The caution's `kind` becomes
`disagree` to make this distinction explicit, matching existing ginkgo cards.

## Held back

Ginkgo with atorvastatin, simvastatin or digoxin was considered. Those candidates
remain unrated because the retrieved material was insufficient for this batch.
All remaining unknown pairs retain the grey warning; no absence-of-risk rating
is inferred from an unsuccessful search.
