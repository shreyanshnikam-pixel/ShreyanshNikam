"""Render a .dc.html page outside the editor: strip DC syntax, shim DCLogic, mount refs and clicks.
Usage: python3 harness.py Page.dc.html W H prefix "y1,y2,..."  (y values: px, or 'f0.5' = fraction of element #film/.film, or '#id+off')"""
import re, sys, json
from playwright.sync_api import sync_playwright

page_file, W, H, pref, ys = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4], sys.argv[5]
src = open('/mnt/user-data/outputs/artifacts/baf5b780-9a21-483f-91fc-32be15b1a48b/project/' + page_file).read()
m = re.search(r'<script type="text/x-dc"[^>]*>(.*?)</script>', src, flags=re.S)
js = m.group(1)
src = src[:m.start()] + src[m.end():]
src = src.replace('<script src="./support.js"></script>', '')
import json as _j
_N = {'three':'three-bundle.js','kit':'kit.js','echo':'echo-film.js','sky':'sky-film.js','medals':'medals3d.js','echoCore':'echo-core.json','echoScare':'echo-scare.json','skyCore':'sky-core.json','story':'story3d.js','skyAudio':'sky-audio.json'}
for _k, _u in _j.load(open('/home/claude/gen/blobs.json')).items(): src = src.replace(_u, 'assets/' + _N[_k]); js = js.replace(_u, 'assets/' + _N[_k])
src = re.sub(r'<sc-if[^>]*>.*?</sc-if>', '', src, flags=re.S)
src = re.sub(r'ref="\{\{\s*(\w+)\s*\}\}"', r'data-ref="\1"', src)
src = re.sub(r'onClick="\{\{\s*(\w+)\s*\}\}"', r'data-click="\1"', src)
src = re.sub(r'\{\{\s*c0\s*\}\}', 'on', src)
src = re.sub(r'\{\{\s*[\w.]+\s*\}\}', '', src)
for t in ['<x-dc>', '</x-dc>', '<helmet>', '</helmet>']:
    src = src.replace(t, '')
shim = '''<script>
class DCLogic { constructor(p){ this.props = p || {}; this.state = {}; } setState(o){ Object.assign(this.state, typeof o === 'function' ? o(this.state) : o); } forceUpdate(){} }
window.__err = [];
window.addEventListener('error', e => window.__err.push(String(e.message)));
''' + js + '''
window.addEventListener('load', () => {
  try {
    const c = new Component({}); window.__c = c;
    const v = c.renderVals();
    document.querySelectorAll('[data-ref]').forEach(el => { const f = v[el.dataset.ref]; if (typeof f === 'function') f(el); });
    document.querySelectorAll('[data-click]').forEach(el => { el.addEventListener('click', () => { const vv = c.renderVals(); vv[el.dataset.click] && vv[el.dataset.click](); }); });
    if (c.componentDidMount) c.componentDidMount();
  } catch (e) { window.__err.push('mount: ' + e.message + ' ' + e.stack); }
});
</script>'''
src = src.replace('</body>', shim + '</body>')
open('/home/claude/preview/h_' + page_file + '.html', 'w').write(src)

import subprocess, time
srv = subprocess.Popen(['python3','-m','http.server','8766','-d','/home/claude/preview'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.6)
with sync_playwright() as p:
    b = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width': W, 'height': H})
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda mm: mm.type == 'error' and errs.append(mm.text))
    pg.goto('http://localhost:8766/h_' + page_file + '.html')
    pg.wait_for_timeout(2500)
    tot = pg.evaluate('document.documentElement.scrollHeight')
    print('height', tot, 'hscroll', pg.evaluate('document.documentElement.scrollWidth>innerWidth'), 'errs', errs[:6], pg.evaluate('window.__err'))
    shots = []
    for i, y in enumerate(ys.split(',')):
        y = y.strip()
        if y.startswith('S'):
            sel, fr = y[1:].split('@')
            yy = pg.evaluate(f"(()=>{{const e=document.querySelector('{sel}'); const r=e.getBoundingClientRect(); return r.top+scrollY+{fr}*(r.height-innerHeight);}})()")
        elif y.startswith('f'):
            fr = float(y[1:])
            yy = pg.evaluate(f"(()=>{{const e=document.querySelector('.film'); const r=e.getBoundingClientRect(); return r.top+scrollY+{fr}*(r.height-innerHeight);}})()")
        elif y.startswith('#'):
            sel, off = (y.split('+') + ['0'])[:2]
            yy = pg.evaluate(f"document.querySelector('{sel}').getBoundingClientRect().top+scrollY+{off}")
        else:
            yy = float(y)
        pg.evaluate(f'window.scrollTo(0,{yy})')
        pg.wait_for_timeout(int(__import__('os').environ.get('WAIT','1400')))
        fn = f'/home/claude/preview/{pref}{i}.png'
        pg.screenshot(path=fn); shots.append(fn)
    print('errs2', pg.evaluate('window.__err'), errs[:6])
    b.close()
srv.terminate()

from PIL import Image
ims = [Image.open(f) for f in shots]
w, h = ims[0].size
cols = 3 if len(ims) > 4 else 2
sc = 480 / w if cols == 3 else 720 / w
tw, th = int(w * sc), int(h * sc)
rows = (len(ims) + cols - 1) // cols
g = Image.new('RGB', (tw * cols, th * rows))
for i, im in enumerate(ims):
    g.paste(im.resize((tw, th)), ((i % cols) * tw, (i // cols) * th))
g.save(f'/home/claude/preview/{pref}grid.png')
