#!/usr/bin/env python3
"""Rebuild fonts/noto-sans-tc-herbsafe-{400,700}.woff2: Noto Sans TC cut down to the Chinese
characters HerbSafe actually shows, so the app stays small and works offline.

RUN THIS WHENEVER data/*.json, js/i18n.js, js/app.js or index.html gain new Chinese text,
otherwise new characters fall back to the phone's own font.

Needs: Python 3 with fonttools and brotli (pip install fonttools brotli), and npm (to fetch
the open-licence font files from the @fontsource/noto-sans-tc package).
Usage, from the project folder:   python3 tools/make-font-subset.py
Then bump VERSION in sw.js so installed phones pick up the new font.
"""
import glob, os, subprocess, sys, tarfile, tempfile
from fontTools.ttLib import TTFont
from fontTools import subset
from fontTools.merge import Merger

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PACKAGE = '@fontsource/noto-sans-tc@5.3.1'
SOURCES = glob.glob(os.path.join(ROOT, 'data', '*.json')) + [os.path.join(ROOT, f) for f in ('js/i18n.js', 'js/app.js', 'index.html')]
# A little headroom: common punctuation and full-width digits.
EXTRA = '，。：；？！「」『』（）〔〕、·—…％０１２３４５６７８９'

def chars_used():
    text = EXTRA
    for f in SOURCES:
        with open(f, encoding='utf-8') as fh:
            text += fh.read()
    return sorted({c for c in text if ord(c) >= 0x2E80})

def main():
    chars = chars_used()
    need = {ord(c) for c in chars}
    print(len(chars), 'Chinese characters used')
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run(['npm', 'pack', PACKAGE, '--pack-destination', tmp, '--loglevel=error'], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        tgz = glob.glob(os.path.join(tmp, '*.tgz'))[0]
        with tarfile.open(tgz) as t:
            try:
                t.extractall(tmp, filter='data')
            except TypeError:  # Python < 3.12
                t.extractall(tmp)
        files = os.path.join(tmp, 'package', 'files')
        for weight in ('400', '700'):
            parts = []
            for f in sorted(glob.glob(os.path.join(files, 'noto-sans-tc-*-%s-normal.woff2' % weight))):
                hit = need & set(TTFont(f).getBestCmap())
                if hit:
                    parts.append((f, hit))
            covered = set().union(*[h for _, h in parts]) if parts else set()
            missing = ''.join(chr(c) for c in sorted(need - covered))
            if missing:
                print('  not in Noto Sans TC (phone font used instead):', missing)
            ttfs = []
            for i, (f, hit) in enumerate(parts):
                opts = subset.Options(); opts.layout_features = ['*']; opts.notdef_outline = True
                font = TTFont(f); s = subset.Subsetter(opts); s.populate(unicodes=hit); s.subset(font)
                font.flavor = None
                out = os.path.join(tmp, 'p%s-%d.ttf' % (weight, i)); font.save(out); ttfs.append(out)
            merged = Merger().merge(ttfs)
            merged.flavor = 'woff2'
            dest = os.path.join(ROOT, 'fonts', 'noto-sans-tc-herbsafe-%s.woff2' % weight)
            merged.save(dest)
            print('  wrote', os.path.relpath(dest, ROOT), os.path.getsize(dest) // 1024, 'KB')

if __name__ == '__main__':
    sys.exit(main())
