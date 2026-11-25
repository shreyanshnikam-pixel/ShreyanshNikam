"""Turn the canvas pages into a plain static site (index.html, projects.html, sky-sentry.html, echo.html + assets/)."""
import re, json, shutil, os
SRC = '/mnt/user-data/outputs/artifacts/baf5b780-9a21-483f-91fc-32be15b1a48b/project/'
OUT = '/home/claude/export/site/'
shutil.rmtree(OUT, ignore_errors=True); os.makedirs(OUT + 'assets')
PAGES = {'Main.dc.html': 'index.html', 'Projects.dc.html': 'projects.html', 'SkySentry.dc.html': 'sky-sentry.html', 'Echo.dc.html': 'echo.html'}
NAMES = {'three': 'three-bundle.js', 'kit': 'kit.js', 'echo': 'echo-film.js', 'sky': 'sky-film.js', 'medals': 'medals3d.js', 'story': 'story3d.js',
         'echoCore': 'echo-core.json', 'echoScare': 'echo-scare.json', 'skyCore': 'sky-core.json', 'skyAudio': 'sky-audio.json'}
LOCAL = {'three-bundle.js': '/home/claude/pkg/three-bundle.js', 'kit.js': '/home/claude/gen/web/kit.js', 'echo-film.js': '/home/claude/gen/web/echo-film.js',
         'sky-film.js': '/home/claude/gen/web/sky-film.js', 'medals3d.js': '/home/claude/gen/web/medals3d.js', 'story3d.js': '/home/claude/gen/web/story3d.js',
         'echo-core.json': '/home/claude/pkg/echo-core.json', 'echo-scare.json': '/home/claude/pkg/echo-scare.json',
         'sky-core.json': '/home/claude/preview/assets/sky-core.json', 'sky-audio.json': '/home/claude/tts/sky-audio.json'}
for n, p in LOCAL.items(): shutil.copy(p, OUT + 'assets/' + n)
B = json.load(open('/home/claude/gen/blobs.json'))
RUNTIME = r'''<script>
/* Tiny stand-in for the canvas runtime: fills {{ holes }}, wires refs and clicks, re-renders on setState. */
class DCLogic { constructor(p) { this.props = p || {}; this.state = {}; } setState(o) { Object.assign(this.state, typeof o === 'function' ? o(this.state) : o); this.forceUpdate(); } forceUpdate() { if (window.__dcRender) window.__dcRender(); } }
</script>'''
BOOT = r'''<script>
(function () {
  const HOLE = /\{\{\s*([\w.]+)\s*\}\}/g, binds = [];
  const look = (v, k) => k.split('.').reduce((o, x) => (o == null ? o : o[x]), v);
  const fill = (tpl, v) => tpl.replace(HOLE, (_, k) => { const r = look(v, k); return r == null ? '' : String(r); });
  function scan(root) {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    for (let n = w.currentNode; n; n = w.nextNode()) {
      if (n.nodeType === 3) { if (HOLE.test(n.nodeValue)) binds.push({ n, tpl: n.nodeValue }); HOLE.lastIndex = 0; continue; }
      if (n.tagName === 'SCRIPT' || n.tagName === 'STYLE') continue;
      for (const a of Array.from(n.attributes)) { if (a.value.indexOf('{{') < 0) continue; binds.push({ n, attr: a.name, tpl: a.value }); }
    }
  }
  function boot() {
    const c = new Component({}); window.__dc = c;
    const refs = Array.from(document.querySelectorAll('[data-ref]')), clicks = Array.from(document.querySelectorAll('[data-click]'));
    scan(document.body);
    let queued = false;
    window.__dcRender = () => { if (queued) return; queued = true; Promise.resolve().then(() => { queued = false; render(); }); };
    function render() { const v = c.renderVals() || {}; binds.forEach((b) => { const s = fill(b.tpl, v); if (b.attr) { if (b.n.getAttribute(b.attr) !== s) b.n.setAttribute(b.attr, s); } else if (b.n.nodeValue !== s) b.n.nodeValue = s; }); }
    render();
    const v = c.renderVals() || {};
    refs.forEach((el) => { const f = v[el.dataset.ref]; if (typeof f === 'function') f(el); });
    clicks.forEach((el) => el.addEventListener('click', (e) => { const f = (c.renderVals() || {})[el.dataset.click]; if (typeof f === 'function') f(e); }));
    if (c.componentDidMount) c.componentDidMount();
    window.addEventListener('pagehide', () => { if (c.componentWillUnmount) c.componentWillUnmount(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
</script>'''
for src_name, out_name in PAGES.items():
    s = open(SRC + src_name).read()
    m = re.search(r'<script type="text/x-dc"[^>]*>(.*?)</script>', s, flags=re.S)
    js = m.group(1); s = s[:m.start()] + s[m.end():]
    for k, u in B.items():
        if k in NAMES: s = s.replace(u, 'assets/' + NAMES[k]); js = js.replace(u, 'assets/' + NAMES[k])
    s = s.replace('<script src="./support.js"></script>', RUNTIME)
    s = re.sub(r'ref="\{\{\s*(\w+)\s*\}\}"', r'data-ref="\1"', s)
    s = re.sub(r'onClick="\{\{\s*(\w+)\s*\}\}"', r'data-click="\1"', s)
    for t in ['<x-dc>', '</x-dc>', '<helmet>', '</helmet>']: s = s.replace(t, '')
    for a, b in PAGES.items(): s = s.replace(f'href="{a}', f'href="{b}')
    s = s.replace('</body>', '<script>\n' + js + '\n</script>\n' + BOOT + '\n</body>')
    open(OUT + out_name, 'w').write(s)
open(OUT + 'netlify.toml', 'w').write('[build]\n  publish = "."\n\n[[headers]]\n  for = "/assets/*"\n  [headers.values]\n    Cache-Control = "public, max-age=31536000"\n')
print(sorted(os.listdir(OUT)), sum(os.path.getsize(OUT + 'assets/' + f) for f in os.listdir(OUT + 'assets')) // 1e6, 'MB assets')
