#!/usr/bin/env python3
"""Make Cantonese computer-voice lines for Read aloud, exactly the way the approved "take 2" was made.

Each line of docs/spoken-scripts.txt is made on its own:
  1. load the model fresh (canto-tts seeds its random numbers once per load: numpy default_rng(1234)),
  2. make the line once and throw it away (the first sentence after loading came out with a pause),
  3. make the same line again and keep that one, as 48 kHz stereo WAV.
No slowing, cleaning or other processing. The voice is canto-tts-nano's single built-in voice.

Pinned versions (the script stops if they differ):
  canto-tts 0.1.4, canto-hk-g2p 2.6.1, onnxruntime 1.31.1, model typangaa/canto-tts-nano at fe17418a.
Install them in a separate virtual environment, outside the repo:
  python3 -m venv venv && venv/bin/pip install canto-tts==0.1.4 canto-hk-g2p==2.6.1 onnxruntime==1.31.1

The model is used from a plain folder (--model-dir) through canto-tts's checkpoint option, not from the
Hugging Face cache: onnxruntime 1.31.1 refuses the cache's links ("External data path escapes model
directory"). If the folder does not exist, the pinned model version is downloaded into it (about 0.73 GB).

Usage (run with the virtual environment's Python):
  venv/bin/python tools/make-computer-voice.py --pair danshen-warfarin --line 7 \\
      --ref origin/task2-what-people-take --model-dir ~/canto-tts-nano-fe17418a
  --lang zh (default) or en; --line is the [number] in docs/spoken-scripts.txt; --ref reads the script
  from that branch instead of the working tree; --out sets the file (default
  audio/computer-voice/<pair>/<lang>-<NN>.wav, replaced if it exists).
"""
import argparse
import glob
import os
import re
import subprocess
import sys
from importlib import metadata

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PINNED = {'canto-tts': '0.1.4', 'canto-hk-g2p': '2.6.1', 'onnxruntime': '1.31.1'}
MODEL_REPO = 'typangaa/canto-tts-nano'
MODEL_REVISION = 'fe17418a293d9be85685ddf750b0cfef9c88abb4'


def check_versions():
    wrong = []
    for name, want in PINNED.items():
        try:
            got = metadata.version(name)
        except metadata.PackageNotFoundError:
            got = 'not installed'
        if got != want:
            wrong.append('%s %s (needs %s)' % (name, got, want))
    if wrong:
        sys.exit('Wrong versions: ' + '; '.join(wrong) + '\nInstall: pip install ' +
                 ' '.join('%s==%s' % kv for kv in PINNED.items()))


def model_dir(path):
    """The pinned model in a plain folder. Each downloaded file records the revision it came from."""
    path = os.path.expanduser(path)
    if not os.path.isdir(path):
        from huggingface_hub import snapshot_download
        snapshot_download(MODEL_REPO, revision=MODEL_REVISION, local_dir=path)
    records = glob.glob(os.path.join(path, '.cache', 'huggingface', 'download', '**', '*.metadata'), recursive=True)
    revisions = {open(r, encoding='utf-8').readline().strip() for r in records}
    if revisions != {MODEL_REVISION}:
        sys.exit('%s is not model revision %s (found %s)' % (path, MODEL_REVISION[:8], ', '.join(sorted(revisions)) or 'no record'))
    return path


def script_text(ref):
    if not ref:
        with open(os.path.join(ROOT, 'docs', 'spoken-scripts.txt'), encoding='utf-8') as f:
            return f.read()
    return subprocess.run(['git', '-C', ROOT, 'show', ref + ':docs/spoken-scripts.txt'],
                          capture_output=True, text=True, check=True).stdout


def spoken_line(text, pair, lang, number):
    """Line [number] of one pair and language, exactly as written in docs/spoken-scripts.txt."""
    m = re.search(r'^\d+\. .*\(' + re.escape(pair) + r', status: [^)]*\)\n(.*?)(?=^=+$|\Z)', text, re.M | re.S)
    if not m:
        sys.exit('No section for %s in docs/spoken-scripts.txt' % pair)
    parts = re.split(r'^  中文$', m.group(1), maxsplit=1, flags=re.M)
    block = parts[1] if lang == 'zh' else parts[0]
    lines = dict(re.findall(r'^\s*\[(\d+)\] (.+)$', block, re.M))
    if str(number) not in lines:
        sys.exit('%s %s has no line [%d] (it has %d lines)' % (pair, lang, number, len(lines)))
    return lines[str(number)]


def make(text, out, checkpoint):
    from canto_tts import CantoTTS
    tts = CantoTTS(backend='onnx', checkpoint=checkpoint)  # fresh load: random numbers start from seed 1234
    tts.synthesize(text, out)                               # first take, thrown away (it had the pause)
    tts.synthesize(text, out)                               # second take: kept, as take 2 was


def main():
    p = argparse.ArgumentParser(description='Make one Cantonese computer-voice line the way take 2 was made.')
    p.add_argument('--pair', required=True, help='e.g. danshen-warfarin')
    p.add_argument('--line', type=int, required=True, help='the [number] in docs/spoken-scripts.txt')
    p.add_argument('--lang', default='zh', choices=['zh', 'en'])
    p.add_argument('--ref', help='read docs/spoken-scripts.txt from this branch, e.g. origin/task2-what-people-take')
    p.add_argument('--model-dir', required=True, help='plain folder for the pinned model (downloaded if missing)')
    p.add_argument('--out', help='output WAV (default audio/computer-voice/<pair>/<lang>-<NN>.wav)')
    a = p.parse_args()

    check_versions()
    checkpoint = model_dir(a.model_dir)
    text = spoken_line(script_text(a.ref), a.pair, a.lang, a.line)
    out = a.out or os.path.join(ROOT, 'audio', 'computer-voice', a.pair, '%s-%02d.wav' % (a.lang, a.line))
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    make(text, out, checkpoint)
    import soundfile
    info = soundfile.info(out)
    print('%s  %.1f s  %s' % (out, info.frames / info.samplerate, text))


if __name__ == '__main__':
    main()
