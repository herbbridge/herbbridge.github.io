# Computer voice (Cantonese Read aloud)

These files are a **computer voice**, not a person. Wherever the app plays them, it must label them
「電腦語音」 / "computer voice". This is a deliberate change by the owner (3 Nov 2026) to the earlier
rule against AI voices, for the Grand Final demo.

## How the files are made

Every line is made with `tools/make-computer-voice.py`, the same way as the approved "take 2":

1. Load the model fresh. canto-tts starts its random numbers from the same seed (1234) every time the
   model loads, so the result is the same each time.
2. Make the line once and throw it away. The first sentence after loading came out with a short pause
   after the first word.
3. Make the same line again and keep that one.

Nothing else is done to the sound: **no slowing, no cleaning and no other processing.** The files are
48 kHz stereo WAV, straight from the model, in its single built-in voice.

## Exact settings

| Setting | Value |
|---|---|
| Program | canto-tts 0.1.4 (https://github.com/typangaa/canto-tts) |
| Model | typangaa/canto-tts-nano, version fe17418a293d9be85685ddf750b0cfef9c88abb4 |
| Characters to Cantonese sounds | canto-hk-g2p 2.6.1 |
| Engine | ONNX Runtime 1.31.1, on the computer's processor (no graphics card needed) |
| Voice | the model's single built-in voice (no voice copying) |
| Speed and other options | the defaults; nothing changed |
| Text | the numbered lines in `docs/spoken-scripts.txt`, word for word |

The model is used from a plain folder, through canto-tts's checkpoint option. ONNX Runtime 1.31.1
refuses to load it from the Hugging Face download cache (error: "External data path escapes model
directory"). The script handles this, and checks every version above before it starts.

Install the programs in a separate virtual environment, outside this repo:

```
python3 -m venv venv
venv/bin/pip install canto-tts==0.1.4 canto-hk-g2p==2.6.1 onnxruntime==1.31.1
venv/bin/python tools/make-computer-voice.py --pair danshen-warfarin --line 7 \
    --ref origin/task2-what-people-take --model-dir ~/canto-tts-nano-fe17418a
```

## The files

`danshen-warfarin/zh-01.wav` to `zh-07.wav`: the 7 Cantonese lines for danshen + warfarin, from
`docs/spoken-scripts.txt` on the `task2-what-people-take` branch (`main` has only 5 lines until
Task 2 is merged).

- `zh-01.wav` is take 2. Remaking it with the script gives the same file, byte for byte (checked
  4 Nov 2026).
- `zh-02.wav` to `zh-06.wav` were made on 3 Nov 2026 in one run after take 2, each as the next take,
  not one by one with the script. Remake any of them with the script if it needs changing.
- `zh-07.wav` was remade with the script on 4 Nov 2026. The first version was cut short (2.1 s).
- Lines 5 and 6 come from the "What people take it for" box, whose wording is not final.

The separate lines are not yet joined, converted or used by the app.

## Licence

canto-tts and the canto-tts-nano model are released under the **Apache License 2.0** (the model's
licence is inherited from MOSS-TTS-Nano by OpenMOSS). It allows this use, including hosting the audio
on a public website, and needs no credit for audio made with it. canto-hk-g2p calls itself Apache 2.0,
but its licence file is a reworded version of that licence; it bundles rime-cantonese data
(CC BY 4.0), which needs credit only if that program or its data is passed on, not for the audio.
