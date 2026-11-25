# usage: shoot.py page.html W H prefix "p1,p2,..." [wait_ms]   p = film progress, or "p@ms" to wait extra
import sys, subprocess, time, os
from playwright.sync_api import sync_playwright
page, W, H, pref, ps = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4], sys.argv[5]
wait = int(sys.argv[6]) if len(sys.argv) > 6 else 1500
srv = subprocess.Popen(['python3', '-m', 'http.server', '8765', '-d', '/home/claude/preview'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(0.6)
try:
  with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width': W, 'height': H})
    errs = []
    pg.on('pageerror', lambda e: errs.append('PE ' + str(e)[:300]))
    pg.on('console', lambda m: (m.type in ('error', 'warning') or 'status' in m.text) and errs.append(m.type + ' ' + m.text[:300]))
    pg.goto('http://localhost:8765/' + page)
    pg.wait_for_timeout(wait)
    for i, x in enumerate(ps.split(',')):
      x = x.strip(); extra = 0; js = ''
      if '@' in x: x, extra = x.split('@'); extra = int(extra)
      if x.startswith('!'): js = x[1:]; pg.evaluate(js); x = None
      if x is not None: pg.evaluate(f'window.film.setProgress({x})')
      pg.wait_for_timeout(1800 + extra)
      pg.screenshot(path=f'/home/claude/preview/{pref}{i}.png')
    print('errs', errs[:12])
    b.close()
finally:
  srv.terminate()
from PIL import Image
import glob
fs = [f'/home/claude/preview/{pref}{i}.png' for i in range(len(ps.split(',')))]
ims = [Image.open(f) for f in fs]; w, h = ims[0].size; cols = 3 if len(ims) > 4 else 2; tw = 560; th = int(h * tw / w)
rows = (len(ims) + cols - 1) // cols; g = Image.new('RGB', (tw * cols, th * rows))
for i, im in enumerate(ims): g.paste(im.resize((tw, th)), ((i % cols) * tw, (i // cols) * th))
g.save(f'/home/claude/preview/{pref}grid.png')
