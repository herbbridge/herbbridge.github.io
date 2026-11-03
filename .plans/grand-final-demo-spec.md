# Grand Final demo and upgrade: spec

Written 3 Nov 2026 from Ayden's plan interview. Save this in the repo as `.plans/grand-final-demo-spec.md`.

## Goal

Upgrade HerbBridge for the Grand Final on 14 Nov 2026 (HKSTP, Tseung Kwan O). The live demo tells Grandpa's story from the Round 1 video, works with or without the internet, and gives the judges four moments to remember.

## Done means

On a laptop shown on the projector, Cavan clicks through this, using the demo reset key:

1. Grandpa's list loads. He takes warfarin and amlodipine, and danshen is added.
2. The danshen + warfarin pair shows **High**, with sources.
3. **Read aloud** plays the result in natural-sounding Cantonese, using pre-made audio files that are labelled as a computer voice.
4. The **doctor summary** shows on screen (collapsed by default), then its **QR code** is scanned by a judge's own phone, which opens the live site with Grandpa's list.
5. The **pillbox** gets the list over USB (with a shared hotspot as backup), and the danshen and warfarin compartments light red.
6. Steps 1–4 also work in aeroplane mode. Only the judge's phone needs internet, and it uses its own mobile data.
7. If the pillbox isn't working by 12 Nov evening, steps 1–4 are the whole demo and the box becomes a "next step" slide.

## Decisions

| Decision | Reason |
|---|---|
| Laptop on projector, not a mirrored phone | The most reliable setup at a venue |
| Story: Grandpa / danshen + warfarin (the existing demo mode) | Ties the final to the Round 1 video |
| All four high points: summary, QR, Cantonese Read aloud, pillbox | Ayden's choice |
| Ayden presents; Cavan clicks; Lucas helps either way | Cyrus and Matthew are away on 14 Nov |
| Online and offline both supported | The venue's Wi-Fi is unknown |
| Pillbox link: USB (Web Serial, Chrome) first, shared phone hotspot second | USB needs no Wi-Fi. Two routes is the most we can test in time. |
| QR opens herbbridge.github.io with the list in the link | The judge sees the real app, on their own data |
| Backups: demo reset key + a second browser window ready at each step | Ayden's choice |
| Voice: try open-source Cantonese AI (CosyVoice2-Yue, canto-tts) | Ayden's choice. The no-AI-voice rule was for the Round 1 video only. |
| Full upgrade: Tasks 2–5, redesign, more data, pillbox + app link | Ayden's choice: no feature freeze |
| Stop changing on 12 Nov evening; 13 Nov is rehearsal only | So the demo is rehearsed on the exact final version |
| Pillbox not ready by 12 Nov → app-only demo | Ayden's choice |

## Out of scope

- Bluetooth and the box's own Wi-Fi network (maybe after the final).
- A judge picking a random pair live.
- Any backend, accounts or database (the site stays static).
- Pharmacist review claims: none have happened, so none are claimed.
- Counter mode for herb shops (it stays in the Ecosystem Plan for later).

## Tasks

Each task gets its own branch and git worktree. To stop agents editing the same files, **each new feature goes in its own JS and CSS file**, and `js/app.js` and `index.html` only get a small hook (one `<script>`/`<link>` line plus one call). The hooks are merged one at a time.

**Wave 1 (4–6 Nov): these can run in parallel**

1. **Merge Task 2** (herb uses box): apply the decisions already sent, check on /preview/, then merge.
   - Owns: `task2-what-people-take` branch.
   - Check: tests pass, and Ayden signs off the Chinese.
2. **Redesign the look.**
   - Owns: `css/styles.css`, the layout parts of `index.html`, `icons/`.
   - First check whether the old `redesign` branch (last changed 21 Oct) is already merged or worth reusing.
   - Keeps the storage keys `herbsafe.v1` and `herbsafe.mode`.
   - Check: `tools/check-modes.js`, `check-flow.js` and `check-print.js` pass, tested on phone and laptop sizes in English and Chinese.
3. **Cantonese voice files.**
   - Owns: `audio/` and `tools/add-recordings.py`.
   - Read the CosyVoice2-Yue and canto-tts licences in full first, and report whether they allow this use. Make the danshen + warfarin files listed in `audio/RECORDING-LIST.md`, and add "computer voice" / 「電腦語音」 to the player.
   - Check: `tools/check-recordings.js` passes, Ayden listens to and approves each file, and they play in aeroplane mode.
4. **Pillbox firmware (USB first).**
   - Owns: a new `firmware/` folder only.
   - The ESP32 reads the payload `{v, herbs[], drugs[], high[[herb,drug]], doses{am,pm}, lang}` over USB serial (JSON per line), lights the compartments, and keeps Grandpa's list pre-loaded so it can light up even with no link.
   - Check: send a test line from a serial monitor and the right LEDs turn red.
5. **Pillbox shell.**
   - Owns: a new `cad/` folder.
   - OpenSCAD files and STL exports, with every part ≤180 mm. Ayden still needs to confirm the printer's bed size.
   - Check: a test print of one compartment and lid fits.

**Wave 2 (6–9 Nov): each one waits for the item named**

6. **Collapsible doctor summary (Task 3).**
   - Owns: `js/summary.js` (new) and `css/summary.css` (new).
   - Waits for: task 2 (the redesign).
   - Check: collapsed on screen and fully open in print (`check-print.js`).
7. **QR + WhatsApp share (Task 4).**
   - Owns: `js/share.js` and `css/share.css` (both new), plus a small QR library added to `js/vendor/` (licence checked).
   - Waits for: task 6.
   - The list goes in the link fragment, opens read-only, and has a "Save this list to my phone" button.
   - Check: scan from a real iPhone and an Android phone.
8. **Bigger text button (Task 5).**
   - Owns: `js/textsize.js` (new), with the key `herbsafe.textsize`.
   - Waits for: task 2.
   - Check: every page is readable at the largest size, with no overflow.
9. **"Send to box" in the app.**
   - Owns: `js/box.js` (new).
   - Waits for: task 4.
   - Uses Web Serial over USB (Chrome/Edge). If that isn't available, it falls back to sending over the hotspot.
   - Check: one tap lights the box, and it shows a clear message if no box is found.
10. **Hotspot route.**
    - Owns: `firmware/` (the network part).
    - Waits for: task 4.
    - The box joins the phone hotspot, and the laptop finds it there.
    - Check: works with the laptop still online.
11. **More data.**
    - Owns: `data/*.json` only.
    - Every card is sourced, the Chinese stays `zh_reviewed: false` until Ayden signs it off, and nothing new goes in after 10 Nov.
    - Check: `node tests/run-tests.js` passes.

**Wave 3 (10–12 Nov)**

12. **Demo reset key.**
    - Owns: a small addition to the existing demo mode (`startDemo` in `js/app.js`).
    - Waits for: tasks 6–9.
    - One hidden key loads Grandpa's list and returns to the start.
    - Check: works from any page.
13. **Offline proof.**
    - Owns: `sw.js` (add every new file to `APP_FILES` and bump `VERSION`).
    - Waits for: all the others.
    - Check: the whole demo runs in aeroplane mode on the demo laptop.
14. **Demo run sheet.**
    - Owns: `docs/demo-run-sheet.md`.
    - Covers each click, what Ayden says, and what Cavan does if something fails (switch to the second window, or press the reset key).
    - Check: three timed run-throughs on 13 Nov.

## Risks and open questions

1. **The Grand Final format is unknown** (pitch length, Q&A, whether a live demo is allowed). The demo is planned as a short core (steps 1–4) with the pillbox as an extra that can be dropped.
2. **Finalists are announced on 4 Nov.** If we aren't picked, this plan is paused.
3. **The redesign touches everything.** If it runs late, Wave 2 slips. Fallback: Wave 2 tasks build on the current look and get restyled after.
4. **The AI voice licences and quality are unchecked.** Fallback: a team member records the lines.
5. **Pillbox parts:** delivery dates are unchecked, and 15 sensors probably need a GPIO expander (not yet in the plan). The printer bed size is unknown.
6. **Web Serial needs Chrome or Edge.** The demo laptop must use one of them.
7. **Disclosure:** say on screen that the voice is computer-generated, and that ratings come from published sources and official statements, not yet reviewed by a pharmacist.
8. Ayden presenting and answering judge Q&A alone, with Cavan clicking: rehearse Q&A separately (planned later).
9. Still unresolved from before: the Chinese DOAC names, the Cantonese reading of 芪, and the "9,400" figure in the video.
