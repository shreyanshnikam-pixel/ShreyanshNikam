import subprocess, time
from playwright.sync_api import sync_playwright
srv = subprocess.Popen(['python3', '-m', 'http.server', '8770', '-d', '/home/claude/export/site'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.6)
shots = [('index.html', [0, 0.35]), ('projects.html', [0, 0.85]), ('sky-sentry.html', [0.02, 0.2]), ('echo.html', [0.03, 0.3])]
try:
  with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    for page, fr in shots:
      pg = b.new_page(viewport={'width': 1440, 'height': 900}); errs = []
      pg.on('pageerror', lambda e: errs.append('PE ' + str(e)[:200])); pg.on('console', lambda m: m.type == 'error' and errs.append(m.text[:200]))
      pg.goto('http://localhost:8770/' + page); pg.wait_for_timeout(4000)
      for i, f in enumerate(fr):
        pg.evaluate(f'window.scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * {f})'); pg.wait_for_timeout(5000)
        pg.screenshot(path=f'/home/claude/export/ck_{page}_{i}.png')
      left = pg.evaluate("(document.body.innerText.match(/\\{\\{/g) || []).length")
      print(page, 'errors:', errs[:5], 'unfilled holes:', left)
      pg.close()
    b.close()
finally: srv.terminate()
