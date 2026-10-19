#!/usr/bin/env python3
"""Stamp a deployed copy of public/ with one build id so browsers never mix files from two deploys.

GitHub Pages serves every file with max-age=600. Without this, a fresh index.html can run against
cached scripts from the previous deploy. For each top-level page this script:
  - adds ?v=<build> to relative stylesheet and script URLs,
  - adds an import map entry for every first-party module (./x.js -> ./x.js?v=<build>), so relative
    imports between modules resolve to the same build,
  - adds <meta name="diddums-build">, which site-url.js assetUrl() appends to worklet/catalog URLs.
Content-addressed or pinned paths (proof-renderers/, vendor/, __hatchable/) are left alone.
Run on the CI copy only: python3 tools/stamp-build.py public <build-id>
"""
import json, pathlib, re, sys

root, build = pathlib.Path(sys.argv[1]), re.sub(r'[^A-Za-z0-9]', '', sys.argv[2])[:16]
pinned = ('proof-renderers/', 'vendor/', '__hatchable/', 'plugin-universe/')
local = lambda u: not re.match(r'^[a-z]+:|^//|^#|^data:', u) and '?' not in u and not u.startswith(pinned)
modules = sorted(p.relative_to(root).as_posix() for p in root.rglob('*') if p.suffix in ('.js', '.mjs') and not p.relative_to(root).as_posix().startswith(pinned))
mapped = {'./' + m: './' + m + '?v=' + build for m in modules}

for page in sorted(root.glob('*.html')):
    html = page.read_text()
    html = re.sub(r'(<link[^>]*href=")([^"]+\.css)(")', lambda m: m[1] + m[2] + ('?v=' + build if local(m[2]) else '') + m[3], html)
    html = re.sub(r'(<script[^>]*src=")([^"]+\.m?js)(")', lambda m: m[1] + m[2] + ('?v=' + build if local(m[2]) else '') + m[3], html)
    found = re.search(r'<script type="importmap">(.*?)</script>', html, re.S)
    imports = json.loads(found[1]).get('imports', {}) if found else {}
    imports = {k: (v + '?v=' + build if local(v.lstrip('./')) and v.startswith('./') else v) for k, v in imports.items()}
    tag = '<script type="importmap">' + json.dumps({'imports': {**mapped, **imports}}, separators=(',', ':')) + '</script>'
    meta = f'<meta name="diddums-build" content="{build}">'
    if found:
        html = html.replace(found[0], meta + tag, 1)
    else:  # the import map must precede the first module script
        html = re.sub(r'(<script)', meta + tag + r'\1', html, count=1)
    page.write_text(html)
    print(f'stamped {page.name} with build {build} ({len(mapped)} modules)')
