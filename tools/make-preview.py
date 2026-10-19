#!/usr/bin/env python3
"""Copy the current branch's app into <target>/preview/ as a clearly labelled test preview that
cannot interfere with the live app on the same site:
- no service worker (it is never registered) and no install-to-home-screen (no manifest);
- its own storage keys, so it never reads or changes a list saved in the live app;
- a "PREVIEW" banner on every screen, and noindex for search engines.
The live app's sw.js must ignore /preview/ (it does from cache herbsafe-v21 on).
Usage: python3 tools/make-preview.py <path-to-main-checkout>
"""
import os, re, shutil, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
COPY = ['index.html', 'css', 'js', 'data', 'fonts', 'icons', 'audio']

def patch(path, pairs):
    with open(path, encoding='utf-8') as f:
        s = f.read()
    for old, new in pairs:
        if old not in s:
            sys.exit('make-preview: could not find %r in %s' % (old[:60], path))
        s = s.replace(old, new, 1)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(s)

def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    dest = os.path.join(os.path.abspath(sys.argv[1]), 'preview')
    if os.path.exists(dest):
        shutil.rmtree(dest)
    os.makedirs(dest)
    for name in COPY:
        src = os.path.join(ROOT, name)
        (shutil.copytree if os.path.isdir(src) else shutil.copy2)(src, os.path.join(dest, name))
    # Phones re-use cached files for a while (GitHub Pages): tag scripts and styles with the cache
    # version so a rebuilt preview is always fetched fresh.
    with open(os.path.join(ROOT, 'sw.js'), encoding='utf-8') as f:
        version = re.search(r"VERSION = '([^']+)'", f.read()).group(1)
    patch(os.path.join(dest, 'index.html'), [
        ('href="css/styles.css"', 'href="css/styles.css?v=%s"' % version),
        ('src="js/lookup.js"', 'src="js/lookup.js?v=%s"' % version),
        ('src="js/i18n.js"', 'src="js/i18n.js?v=%s"' % version),
        ('src="js/speech.js"', 'src="js/speech.js?v=%s"' % version),
        ('src="js/app.js"', 'src="js/app.js?v=%s"' % version),
    ])
    patch(os.path.join(dest, 'index.html'), [
        ('<title>HerbSafe 中西通</title>', '<title>PREVIEW · HerbSafe 中西通</title>\n  <meta name="robots" content="noindex, nofollow">'),
        ('  <link rel="manifest" href="manifest.webmanifest">\n', ''),
        ('<body>\n', '<body>\n  <div class="preview-flag" role="note" style="position:sticky;top:0;z-index:50;background:#16181D;color:#fff;'
         'text-align:center;font:700 15px/1.3 Inter,system-ui,sans-serif;padding:8px 12px;letter-spacing:.04em">'
         'PREVIEW · test version, not the live app · 測試版</div>\n'),
    ])
    patch(os.path.join(dest, 'js', 'app.js'), [
        ("var STORAGE_KEY = 'herbsafe.v1';", "var STORAGE_KEY = 'herbsafe.preview.v1'; // preview: separate from the live app"),
        ("var MODE_KEY = 'herbsafe.mode';", "var MODE_KEY = 'herbsafe.preview.mode';"),
        ("if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {", "if (false) { // preview: no service worker"),
    ])
    print('preview written to', dest)

if __name__ == '__main__':
    main()
