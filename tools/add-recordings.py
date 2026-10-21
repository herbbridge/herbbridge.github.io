#!/usr/bin/env python3
"""Add human Read aloud recordings to the app.

Put phone recordings in audio/ named <herb_id>-<drug_id>.<en|zh>.m4a (see audio/RECORDING-LIST.md),
then run:  python3 tools/add-recordings.py

For each .m4a (or .wav / .aac / .mp4) it:
  1. converts it to MP3, mono, 44.1 kHz, 96 kbps (64 kbps if 96 would be 1 MB or more),
  2. checks the result (mono, 44.1 kHz, 64-96 kbps, under 1 MB),
  3. lists it in audio/manifest.json,
and then bumps the cache version in sw.js so phones fetch the new files.
The original recording is kept, unchanged. Needs ffmpeg (or: pip install imageio-ffmpeg).
"""
import json
import os
import re
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AUDIO = os.path.join(ROOT, 'audio')
NAME = re.compile(r'^([a-z0-9_]+)-([a-z0-9_]+)\.(en|zh)\.(m4a|wav|aac|mp4)$')
MAX_BYTES = 1024 * 1024


def ffmpeg():
    exe = shutil.which('ffmpeg')
    if exe:
        return exe
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        sys.exit('ffmpeg not found. Install ffmpeg, or: pip install imageio-ffmpeg')


def ids(path, key):
    with open(os.path.join(ROOT, 'data', path), encoding='utf-8') as f:
        return {x['id'] for x in json.load(f)[key]}


def probe(exe, path):
    """Channels, sample rate and bitrate of an MP3, read from ffmpeg's own report."""
    out = subprocess.run([exe, '-hide_banner', '-i', path], capture_output=True, text=True).stderr
    m = re.search(r'Audio: mp3.*?, (\d+) Hz, (mono|stereo).*?, (\d+) kb/s', out)
    return (m.group(2), int(m.group(1)), int(m.group(3))) if m else None


def convert(exe, src, dest, kbps):
    subprocess.run([exe, '-hide_banner', '-loglevel', 'error', '-y', '-i', src, '-vn', '-ac', '1', '-ar', '44100',
                    '-codec:a', 'libmp3lame', '-b:a', '%dk' % kbps, dest], check=True)


def main():
    exe = ffmpeg()
    herbs, drugs = ids('herbs.json', 'herbs'), ids('drugs.json', 'drugs')
    manifest_path = os.path.join(AUDIO, 'manifest.json')
    with open(manifest_path, encoding='utf-8') as f:
        manifest = json.load(f)
    files = list(manifest.get('files', []))
    added, problems = [], []

    for name in sorted(os.listdir(AUDIO)):
        m = NAME.match(name)
        if not m:
            if re.search(r'\.(m4a|wav|aac|mp4)$', name):
                problems.append('%s: name must be <herb_id>-<drug_id>.<en|zh>.m4a' % name)
            continue
        herb, drug, lang = m.group(1), m.group(2), m.group(3)
        if herb not in herbs or drug not in drugs:
            problems.append('%s: unknown herb or medicine id' % name)
            continue
        mp3 = '%s-%s.%s.mp3' % (herb, drug, lang)
        dest = os.path.join(AUDIO, mp3)
        src = os.path.join(AUDIO, name)
        if mp3 in files and os.path.exists(dest) and os.path.getmtime(dest) >= os.path.getmtime(src):
            continue  # already converted and listed
        for kbps in (96, 64):
            convert(exe, os.path.join(AUDIO, name), dest, kbps)
            if os.path.getsize(dest) < MAX_BYTES:
                break
        size = os.path.getsize(dest)
        info = probe(exe, dest)
        ok = info and info[0] == 'mono' and info[1] == 44100 and 60 <= info[2] <= 100 and size < MAX_BYTES
        if not ok:
            problems.append('%s: converted file is %s, %d bytes (needs mono, 44.1 kHz, 64-96 kbps, under 1 MB)%s'
                            % (mp3, info, size, '; record a shorter take' if size >= MAX_BYTES else ''))
            continue
        if mp3 not in files:
            files.append(mp3)
        added.append('%s <- %s (%s, %d Hz, %d kb/s, %d KB)' % (mp3, name, info[0], info[1], info[2], size // 1024))

    if added:
        manifest['files'] = sorted(set(files))
        with open(manifest_path, 'w', encoding='utf-8') as f:
            json.dump(manifest, f, ensure_ascii=False, indent=2)
            f.write('\n')
        sw_path = os.path.join(ROOT, 'sw.js')
        with open(sw_path, encoding='utf-8') as f:
            sw = f.read()
        sw, n = re.subn(r"(var VERSION = 'herbbridge-v)(\d+)(';)", lambda mm: mm.group(1) + str(int(mm.group(2)) + 1) + mm.group(3), sw)
        with open(sw_path, 'w', encoding='utf-8') as f:
            f.write(sw)
        print('Added:\n  ' + '\n  '.join(added))
        print('sw.js cache version bumped.' if n else 'Note: cache version not found in sw.js; bump it by hand.')
    else:
        print('Nothing new to add (put <herb_id>-<drug_id>.<en|zh>.m4a files in audio/; converted ones are skipped).')
    if problems:
        print('Problems:\n  ' + '\n  '.join(problems))
        sys.exit(1)


if __name__ == '__main__':
    main()
