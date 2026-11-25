# usage: shoot_page.py page.html W H prefix "f1,f2,..."  (f = fraction of page scroll, or #id)  [port]
import sys, subprocess, time
from playwright.sync_api import sync_playwright
page, W, H, pref, ps = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4], sys.argv[5]
port = sys.argv[6] if len(sys.argv) > 6 else '8790'
srv = subprocess.Popen(['python3', '-m', 'http.server', port, '-d', '/home/claude/ShreyanshNikam'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.6)
try:
  with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width': W, 'height': H}); errs = []
    pg.on('pageerror', lambda e: errs.append('PE ' + str(e)[:300])); pg.on('console', lambda m: m.type == 'error' and errs.append(m.text[:300]))
    pg.goto(f'http://localhost:{port}/' + page); pg.wait_for_timeout(9000)
    for i, x in enumerate(ps.split(',')):
      if x.startswith('#'): pg.evaluate(f"window.scrollTo(0, document.querySelector('{x}').getBoundingClientRect().top + scrollY)")
      else: pg.evaluate(f'window.scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * {x})')
      pg.wait_for_timeout(4500); pg.screenshot(path=f'/tmp/{pref}{i}.png')
    print('errors', errs[:8]); b.close()
finally: srv.terminate()
from PIL import Image
n = len(ps.split(',')); ims = [Image.open(f'/tmp/{pref}{i}.png') for i in range(n)]; cols = 3 if n > 4 else 2; tw = 560; th = int(ims[0].height * tw / ims[0].width)
g = Image.new('RGB', (tw * cols, th * ((n + cols - 1) // cols)))
for i, im in enumerate(ims): g.paste(im.resize((tw, th)), ((i % cols) * tw, (i // cols) * th))
g.save(f'/tmp/{pref}grid.png')
