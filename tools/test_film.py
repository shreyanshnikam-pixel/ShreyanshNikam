#!/usr/bin/env python3
"""Playwright check for js/film.js: scrub tools/film-test.html forwards and backwards and verify the frame on screen.

    python3 tools/make_test_frames.py && python3 tools/test_film.py
"""
import os, subprocess, sys, time
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8791


def run(pw, w, h, expect_variant):
    b = pw.chromium.launch()
    pg = b.new_page(viewport={'width': w, 'height': h}, device_scale_factor=1)
    errs = []
    pg.on('pageerror', lambda e: errs.append('pageerror ' + str(e)))
    # the willReadFrequently hint is caused by this test's own getImageData readback, not by film.js
    pg.on('console', lambda m: m.type in ('error', 'warning') and 'willReadFrequently' not in m.text and errs.append(m.type + ' ' + m.text))
    pg.on('requestfailed', lambda r: 'f_' not in r.url and errs.append('requestfailed ' + r.url))
    pg.goto(f'http://localhost:{PORT}/tools/film-test.html')
    pg.wait_for_function('window.filmReady === true', timeout=15000)
    assert pg.evaluate('window.missing') is None, 'missing film should load as null'
    st = pg.evaluate('player.state()')
    assert st['variant'] == expect_variant, st
    count = st['count']
    span = pg.evaluate('document.getElementById("film").offsetHeight - innerHeight')
    bad, max_loaded = [], 0

    def check(p):
        nonlocal max_loaded
        y = round(p * span)
        pg.evaluate(f'window.scrollTo(0, {y})')
        # expected frame from the real scroll position the page ended up at (scroll events are async)
        want = round(min(1, max(0, pg.evaluate('window.scrollY') / span)) * (count - 1))
        pg.wait_for_function(f'(() => {{ const s = player.state(); return s.target === {want} && s.drawn === {want}; }})()', timeout=10000)
        s = pg.evaluate('player.state()')
        # centre pixel grey level encodes the frame index (2 * i), lossy WebP so allow a small error
        g = pg.evaluate('(() => { const c = document.getElementById("cv"), d = c.getContext("2d").getImageData(c.width >> 1, c.height >> 1, 1, 1).data; return d[0]; })()')
        if s['drawn'] != want or abs(g - min(255, 2 * want)) > 3:
            bad.append((p, want, s['drawn'], g))
        max_loaded = max(max_loaded, len(s['chunks']))

    steps = 40
    t0 = time.time()
    for k in range(steps + 1):
        check(k / steps)
    fwd = time.time() - t0
    t0 = time.time()
    for k in range(steps, -1, -1):
        check(k / steps)
    back = time.time() - t0
    # fast random jumps
    for p in (0.9, 0.1, 0.55, 0.0, 1.0, 0.33):
        check(p)
    s = pg.evaluate('player.state()')
    pg.screenshot(path=f'/tmp/film-test-{w}x{h}.png')
    pg.evaluate('player.dispose()')
    b.close()
    print(f'{w}x{h}: variant={s["variant"]} frames={count} forward {fwd:.1f}s back {back:.1f}s '
          f'max chunks held={max_loaded} mismatches={len(bad)} errors={len(errs)}')
    for x in bad[:10]: print('  mismatch (progress, want, drawn, grey):', x)
    for e in errs[:10]: print('  ', e)
    return not bad and not errs


def main():
    if not os.path.exists(os.path.join(ROOT, 'assets/films/_test/manifest.json')):
        sys.exit('run tools/make_test_frames.py first')
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '-d', ROOT], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(0.7)
    try:
        with sync_playwright() as pw:
            ok = run(pw, 1280, 720, 'desktop') & run(pw, 390, 844, 'portrait')
    finally:
        srv.terminate()
    print('PASS' if ok else 'FAIL')
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()
