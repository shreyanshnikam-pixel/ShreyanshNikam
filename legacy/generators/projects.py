from common import *
from three import *

FONTS = 'family=Bricolage+Grotesque:opsz,wdth,wght@12..96,75..100,300..800&family=Big+Shoulders:opsz,wght@10..72,400..900&family=Big+Shoulders+Stencil:opsz,wght@10..72,600..900&family=Geist:wght@300..700&family=Geist+Mono:wght@400..600'
CSS = THREE_CSS + """
.brico{font-family:'Bricolage Grotesque',Geist,sans-serif}
.mono{font-family:'Geist Mono',ui-monospace,monospace;letter-spacing:.02em}
.mono3d{transition:transform .8s cubic-bezier(.2,.8,.2,1)}
.mono3d:hover,.mono3d:focus-within{transform:var(--hov) !important}
.mono3d .go{display:inline-flex;align-items:center;gap:12px;min-height:54px;padding:0 26px;border-radius:999px;font:600 16px/1 Geist,sans-serif;transition:gap .3s}
.mono3d:hover .go{gap:20px}
@keyframes ring{0%{transform:scale(.05);opacity:.9}100%{transform:scale(1);opacity:0}}
.ring{position:absolute;left:50%;top:40%;width:900px;height:900px;margin:-450px 0 0 -450px;border-radius:50%;border:2px solid #FF3B30;box-shadow:0 0 30px rgba(255,59,48,.35);animation:ring 3.6s cubic-bezier(.15,.6,.3,1) infinite}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes fly{from{transform:translateX(-30%)}to{transform:translateX(130%)}}
@keyframes flap{0%,100%{transform:scaleY(1)}50%{transform:scaleY(.3)}}
.flock{position:absolute;animation:fly 14s linear infinite}.flock svg{animation:flap .6s ease-in-out infinite}
@keyframes intro{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:none}}
.intro{animation:intro 1s cubic-bezier(.16,.84,.24,1) both}
.only-sm{display:none}
@media (max-width:860px){.show3d{display:none !important}.only-sm{display:block}}
"""

BIRDS = '<path d="M0 10 q6 -7 12 0 q6 -7 12 0"></path><path d="M30 2 q6 -7 12 0 q6 -7 12 0"></path><path d="M34 22 q6 -7 12 0 q6 -7 12 0"></path><path d="M66 12 q6 -7 12 0 q6 -7 12 0"></path><path d="M96 4 q6 -7 12 0 q6 -7 12 0"></path><path d="M102 28 q6 -7 12 0 q6 -7 12 0"></path>'
ARROW = '<svg aria-hidden="true" viewBox="0 0 24 24" style="width: 18px; height: 18px"><path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg>'

def echo_face(h):
    return f'''<a href="Echo.dc.html" style="position: relative; display: flex; flex-direction: column; justify-content: flex-end; height: {h}; box-sizing: border-box; overflow: hidden; border-radius: 6px; text-decoration: none; color: #FFFFFF; background: radial-gradient(ellipse at 50% 40%, #3B0A08 0%, #140404 45%, #050202 100%)">
<div aria-hidden="true" style="position: absolute; inset: 0; overflow: hidden"><div class="ring"></div><div class="ring" style="animation-delay: 1.2s"></div><div class="ring" style="animation-delay: 2.4s"></div>
<div style="position: absolute; inset: 0; background: linear-gradient(0deg, rgba(5,2,2,.95) 0%, rgba(5,2,2,0) 60%)"></div></div>
<div style="position: relative; padding: 36px">
<p class="mono" style="margin: 0 0 12px; font-size: 13px; color: #FF8A80">Horror game, Godot 4</p>
<h2 style="margin: 0; font-family: 'Big Shoulders Stencil', sans-serif; font-size: 118px; line-height: .85; font-weight: 900; color: {RED}; text-shadow: 0 0 50px rgba(255,59,48,.5)">ECHO</h2>
<p style="margin: 16px 0 18px; font-size: 17px; line-height: 1.5; color: #E8DAD8">You can only see by making noise, and every ping tells the monsters where you are.</p>
<p style="margin: 0 0 24px"><span style="display: inline-block; padding: 8px 14px; border-radius: 999px; background: {RED}; font-size: 13px; font-weight: 600">1st prize, best overall</span> <span style="margin-left: 6px; font-size: 13px; color: #C2A9A6">Hack Club Haven Princeton 2026</span></p>
<span class="go" style="background: #FFFFFF; color: #140404">Enter the Hollow {ARROW}</span></div></a>'''

def sky_face(h):
    chips = ''.join(f'<span style="padding: 8px 13px; border-radius: 999px; background: rgba(255,255,255,.14); font-size: 13px; font-weight: 600">{t}</span>' for t in ['Best Use of Solana', 'Best Use of TigerData', '5th overall'])
    return f'''<a href="SkySentry.dc.html" style="position: relative; display: flex; flex-direction: column; justify-content: flex-end; height: {h}; box-sizing: border-box; overflow: hidden; border-radius: 6px; text-decoration: none; color: #FFFFFF; background: linear-gradient(to bottom, #0B1430 0%, #23305A 38%, #7A4A66 62%, #E0865A 78%, #2A1A22 79%, #0C0A10 100%)">
<div aria-hidden="true" style="position: absolute; inset: 0; overflow: hidden">
<div style="position: absolute; left: 62%; top: 78%; width: 220px; height: 220px; margin: -110px 0 0 -110px; border-radius: 50%; background: radial-gradient(circle, #FFE7C2 0%, #FFB36B 30%, rgba(255,140,80,0) 70%)"></div>
<div class="flock" style="left: 0; top: 26%"><svg viewBox="0 0 150 40" style="width: 140px" fill="none" stroke="#120E1C" stroke-width="2.4" stroke-linecap="round">{BIRDS}</svg></div>
<div class="flock" style="left: 0; top: 44%; animation-duration: 19s; animation-delay: -7s"><svg viewBox="0 0 150 40" style="width: 86px" fill="none" stroke="#2A2238" stroke-width="2.4" stroke-linecap="round">{BIRDS}</svg></div>
<div style="position: absolute; right: 24px; top: 24px; width: 130px; height: 130px; border-radius: 50%; border: 1px solid rgba(127,220,255,.5); overflow: hidden; background: rgba(5,14,30,.35)"><div style="position: absolute; inset: 0; border-radius: 50%; background: conic-gradient(from 0deg, rgba(127,220,255,.55), rgba(127,220,255,0) 22%); animation: spin 3s linear infinite"></div></div>
<div style="position: absolute; inset: 0; background: linear-gradient(0deg, rgba(8,6,12,.96) 0%, rgba(8,6,12,0) 58%)"></div></div>
<div style="position: relative; padding: 36px">
<p class="mono" style="margin: 0 0 12px; font-size: 13px; color: #9CD6F2">AI early-warning system</p>
<h2 style="margin: 0; font-family: 'Big Shoulders', sans-serif; font-size: 104px; line-height: .85; font-weight: 800; text-transform: uppercase">Sky Sentry</h2>
<p style="margin: 16px 0 18px; font-size: 17px; line-height: 1.5; color: #DCE3EC">A phone camera spots birds and drones near a runway, and the control tower hears the warning out loud.</p>
<p style="margin: 0 0 24px; display: flex; flex-wrap: wrap; gap: 8px; align-items: center">{chips}<span style="font-size: 13px; color: #A9B4C4">HackPHS 2026</span></p>
<span class="go" style="background: #FFFFFF; color: #0B1430">Watch the film {ARROW}</span></div></a>'''

def monolith(x, ry, face, edge):
    W, H, D = 540, 660, 70
    b = box(W, H, D, {'front': ('#000', face(f'{H}px')), 'side': (edge, ''), 'top': (edge, ''), 'back': ('#0A0A0C', '')})
    base = f'translate3d({x}px, 0, 0) rotateY({ry}deg)'
    hov = f'translate3d({x}px, -26px, 90px) rotateY({ry*0.25}deg)'
    return f'<div class="mono3d p3" style="position: absolute; left: 0; top: 0; transform: {base}; --hov: {hov}">{b}<div aria-hidden="true" style="position: absolute; left: {-W/2}px; top: {H/2 + 6}px; width: {W}px; height: 220px; transform: rotateX(180deg); transform-origin: 50% 0; opacity: .16; -webkit-mask-image: linear-gradient(#000, transparent 70%); mask-image: linear-gradient(#000, transparent 70%); pointer-events: none; background: {edge}"></div></div>'

SHOWROOM = f'''<div class="show3d" ref="{{{{ tiltRef }}}}" style="position: relative; height: 860px; perspective: 1700px; perspective-origin: 50% 35%">
<div class="p3" style="position: absolute; left: 50%; top: 48%; width: 0; height: 0; transform: rotateX(-3deg)">
<div class="p3" data-tilt="0.55">
<div aria-hidden="true" style="position: absolute; left: -1800px; top: 336px; width: 3600px; height: 3600px; margin-top: -1800px; transform: rotateX(90deg); background: radial-gradient(circle, rgba(255,59,48,.16) 0%, rgba(0,0,0,0) 45%), repeating-linear-gradient(90deg, rgba(255,255,255,.07) 0 1px, transparent 1px 110px), repeating-linear-gradient(0deg, rgba(255,255,255,.07) 0 1px, transparent 1px 110px); -webkit-mask-image: radial-gradient(circle, #000 18%, transparent 55%); mask-image: radial-gradient(circle, #000 18%, transparent 55%)"></div>
{monolith(-305, 16, echo_face, 'linear-gradient(180deg,#3A0B08,#120303)')}
{monolith(305, -16, sky_face, 'linear-gradient(180deg,#2A3660,#140E1A)')}
</div></div></div>'''

MOBILE = f'''<div class="only-sm" style="padding-top: 10px"><div style="display: flex; flex-direction: column; gap: 18px; perspective: 900px">
<div style="height: 600px; transform: rotateX(4deg); border-radius: 22px; overflow: hidden; box-shadow: 0 40px 80px -30px #000">{echo_face('600px')}</div>
<div style="height: 620px; transform: rotateX(4deg); border-radius: 22px; overflow: hidden; box-shadow: 0 40px 80px -30px #000">{sky_face('620px')}</div>
</div></div>'''

MT = lambda a, b, c='#1A0F02': f'<div style="font-family: Geist, sans-serif; color: {c}; line-height: 1.05"><div style="font-size: 11px; font-weight: 700; letter-spacing: .08em">{a}</div><div style="font-size: 17px; font-weight: 800; margin-top: 3px">{b}</div></div>'
AWARDS = awards_scene([
    dict(x=-470, size=150, c1='#FF8A80', c2='#C8102E', rim='#7A0A12', front=MT('BEST USE', 'SOLANA', '#FFFFFF'), gl=dict(mat='red', top='BEST USE OF', main='SOLANA', bot='HACKPHS 2026', b3='SKY SENTRY'), title='Best Use of Solana', sub='Sky Sentry, HackPHS 2026'),
    dict(x=-170, size=150, c1='#9FF2E6', c2='#1FA897', rim='#0C5A50', front=MT('BEST USE', 'TIGERDATA', '#04201C'), gl=dict(mat='teal', top='BEST USE OF', main='TIGERDATA', bot='HACKPHS 2026', b3='SKY SENTRY'), title='Best Use of TigerData', sub='Sky Sentry, HackPHS 2026'),
    dict(x=130, size=150, c1='#F2F4F8', c2='#9AA3B2', rim='#525A68', front=MT('OVERALL', '5TH PLACE', '#141A24'), gl=dict(mat='silver', top='OVERALL', main='5TH|PLACE', bot='HACKPHS 2026', b3='SKY SENTRY'), title='5th place overall', sub='Sky Sentry, HackPHS 2026'),
    dict(x=450, size=210, c1='#FFF1B8', c2='#E0A82E', rim='#8A5A10', front=MT('1ST PRIZE', 'BEST OVERALL'), gl=dict(mat='gold', top='BEST OVERALL', main='1ST|PRIZE', bot='HACK CLUB HAVEN', b3='ECHO'), title='1st prize, best overall', sub='Echo, Hack Club Haven Princeton 2026', speed=10),
], {'acc': RED}, f'''<p class="mono" style="margin: 0 0 16px; font-size: 13px; color: {RED}">The trophy shelf</p><h2 class="brico" style="margin: 0; font-size: clamp(44px, 6vw, 96px); line-height: .92; font-weight: 700; letter-spacing: -0.035em; font-variation-settings: 'wdth' 80">Four awards. <span style="font-weight: 300; color: #8E8A84">One fall.</span></h2>''',
    height=760, label='Awards')

BODY = f'''<main style="font-family: Geist, system-ui, sans-serif; color: #F4F1EC; background: #07080B; overflow-x: clip">
{nav('projects')}
<section aria-labelledby="proj-h" style="padding: 110px 0 40px; min-height: 100vh; min-height: 100svh; box-sizing: border-box; display: flex; flex-direction: column; justify-content: center; background: radial-gradient(ellipse at 50% 70%, #1A0A0A 0%, #07080B 60%)">
<div class="wrap">
<div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-end; gap: 24px 48px">
<div class="intro">
<p class="mono" style="margin: 0 0 18px; font-size: 13px; color: {RED}">Projects and achievements</p>
<h1 id="proj-h" class="brico" style="margin: 0; font-size: clamp(52px, 7.5vw, 120px); line-height: .9; font-weight: 700; letter-spacing: -0.04em; font-variation-settings: 'wdth' 80">Pick one. <span style="font-weight: 300; color: #8E8A84">Both won.</span></h1>
</div>
<p class="intro hide-sm" style="margin: 0; max-width: 22em; font-size: 15px; line-height: 1.5; color: #8E8A84; animation-delay: .15s">Move your mouse to walk around them. Hover one to bring it forward.</p>
</div>
{MOBILE}
</div>
{SHOWROOM}
</section>
{AWARDS}
<div style="height: 40px"></div>
{footer()}
</main>
'''

CLASS = r'''class Component extends DCLogic {
  constructor(props) {
    super(props);
  }
  componentWillUnmount() { this.cleanupFly(); }
  renderVals() { return { flyRef: this.flyRef, tiltRef: this.tiltRef }; }
}'''
SCRIPT = '''<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":1440,"height":2400}}'>\n''' + inject(CLASS) + '\n</script>'
html = head('Shreyansh Nikam: projects and achievements', FONTS, CSS) + BODY + tail(SCRIPT)
open(OUTDIR + 'Projects.dc.html', 'w').write(html)
print('projects', len(html))
