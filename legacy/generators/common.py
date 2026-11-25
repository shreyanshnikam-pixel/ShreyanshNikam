OUTDIR = '/mnt/user-data/outputs/artifacts/baf5b780-9a21-483f-91fc-32be15b1a48b/project/'
RED = '#FF3B30'
RED_DEEP = '#C8102E'
INK = '#07080B'

BASE_CSS = """
body{margin:0;background:#07080B}
a{color:inherit;text-underline-offset:4px}
.wrap{max-width:1240px;margin:0 auto;padding:0 48px;box-sizing:border-box;position:relative}
.nav a{text-decoration:none;opacity:.72;transition:opacity .2s}.nav a:hover,.nav a[aria-current=page]{opacity:1}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:12px;min-height:56px;padding:0 30px;border-radius:999px;font:600 17px/1 Geist,system-ui,sans-serif;text-decoration:none;cursor:pointer;border:0;transition:transform .18s cubic-bezier(.2,.8,.2,1),box-shadow .3s,background .25s,color .25s}
.btn:active{transform:scale(.96)}
.btn-red{background:#FF3B30;color:#FFFFFF;box-shadow:0 18px 50px -18px rgba(255,59,48,.9)}
.btn-red:hover{box-shadow:0 0 0 8px rgba(255,59,48,.18),0 18px 60px -14px rgba(255,59,48,1)}
.btn-ghost{background:transparent;color:#F4F1EC;border:1px solid rgba(244,241,236,.35)}
.btn-ghost:hover{background:#F4F1EC;color:#07080B}
a:focus-visible,button:focus-visible{outline:3px solid #FFFFFF;outline-offset:3px}
@keyframes fadev{from{opacity:var(--o0,1)}to{opacity:var(--o1,1)}}
@keyframes pan{from{transform:translate3d(var(--x0,0px),var(--y0,0px),0) rotateX(var(--rx0,0deg)) rotateY(var(--ry0,0deg)) scale(var(--s0,1))}to{transform:none}}
@keyframes draw{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@supports (animation-timeline: view()){@media (prefers-reduced-motion:no-preference){
.vs{animation:pan linear both,fadev linear both;animation-timeline:view();animation-range:entry 0% cover 35%}
.draw{transform-origin:left center;animation:draw linear both;animation-timeline:view();animation-range:entry 10% cover 40%}
}}
@media (max-width:720px){.wrap{padding:0 20px}.hide-sm{display:none !important}}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation:none !important;transition:none !important}}
"""

BLOBS = __import__('json').load(open('/home/claude/gen/blobs.json'))

def head(title, fonts, css, lang='en', extra=()):
    scripts = ''.join(f'<script src="{BLOBS[k]}"></script>\n' for k in ('three', 'kit', 'medals', 'story') + tuple(extra) if k in BLOBS)
    return f'''<!doctype html>
<html lang="{lang}">
<head>
<meta charset="utf-8">
<title>{title}</title>
<script src="./support.js"></script>
{scripts}</head>
<body>
<x-dc>
<helmet>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?{fonts}&amp;display=swap">
<style>{BASE_CSS}{css}</style>
</helmet>
'''

def nav(active, dark=True):
    items = [('Main.dc.html', 'About me', 'home'), ('Projects.dc.html', 'Projects', 'projects'),
             ('SkySentry.dc.html', 'Sky Sentry', 'sky'), ('Echo.dc.html', 'Echo', 'echo')]
    links = ''.join(
        f'<a href="{h}" style="padding: 12px 0"{" aria-current=" + chr(34) + "page" + chr(34) if k == active else ""}>{t}</a>'
        for h, t, k in items)
    return f'''<header class="nav" style="position: fixed; left: 0; right: 0; top: 0; z-index: 60; background: linear-gradient(to bottom, rgba(7,8,11,.88), rgba(7,8,11,0)); font-family: Geist, system-ui, sans-serif">
<div class="wrap" style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 8px 24px; padding-top: 16px; padding-bottom: 16px; color: #F4F1EC">
<a href="Main.dc.html" style="opacity: 1; font: 600 16px/1 Geist, sans-serif; letter-spacing: -.01em; padding: 12px 0">Shreyansh Nikam<span style="color: {RED}">.</span></a>
<nav aria-label="Pages" style="display: flex; flex-wrap: wrap; gap: 4px 26px; font-size: 15px">{links}</nav>
</div>
</header>'''

def footer():
    return f'''<footer style="background: #07080B; color: #8E8A84; font-family: Geist, system-ui, sans-serif; padding: 56px 0 40px; border-top: 1px solid #1B1C20">
<div class="wrap" style="display: flex; flex-wrap: wrap; justify-content: space-between; gap: 16px; font-size: 14px">
<span>Shreyansh Nikam, Livingston High School, New Jersey</span>
<span style="display: flex; gap: 22px"><a href="Main.dc.html" style="padding: 10px 0">About me</a><a href="Projects.dc.html" style="padding: 10px 0">Projects</a></span>
</div>
</footer>'''

def tail(script):
    return f'''</x-dc>
{script}
</body>
</html>
'''
