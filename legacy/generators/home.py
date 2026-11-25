from common import *
from three import *

FONTS = 'family=Fraunces:ital,opsz,wght@0,9..144,300..900;1,9..144,300..900&family=Geist:wght@300..800&family=Geist+Mono:wght@400..600'
CSS = THREE_CSS + """
.serif{font-family:Fraunces,Georgia,serif;font-optical-sizing:auto}
.mono{font-family:'Geist Mono',ui-monospace,monospace;letter-spacing:.02em}
@keyframes rise{from{transform:translateY(110%) rotate(4deg);opacity:0}to{transform:none;opacity:1}}
.ch{display:inline-block;animation:rise 1s cubic-bezier(.16,.84,.24,1) both}
@keyframes rot{0%,26%{transform:translateY(0)}33%,59%{transform:translateY(-1.25em)}66%,92%{transform:translateY(-2.5em)}100%{transform:translateY(-3.75em)}}
.rot{display:block;animation:rot 9s cubic-bezier(.7,0,.2,1) infinite}
@keyframes fadeup{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
.fu{animation:fadeup 1s cubic-bezier(.16,.84,.24,1) both}
@property --n{syntax:'<integer>';inherits:false;initial-value:0}
@keyframes count{from{--n:0}to{--n:var(--to)}}.count{animation:count 1.6s cubic-bezier(.2,.7,.2,1) both;counter-reset:n var(--n)}.count::after{content:counter(n)}
@keyframes scrollcue{0%{transform:scaleY(0);transform-origin:top}45%{transform:scaleY(1);transform-origin:top}55%{transform:scaleY(1);transform-origin:bottom}100%{transform:scaleY(0);transform-origin:bottom}}
.glass{background:linear-gradient(160deg,rgba(24,25,31,.92),rgba(10,11,14,.92));border:1px solid rgba(255,255,255,.09);border-radius:28px;box-shadow:0 60px 120px -40px rgba(0,0,0,.9)}
@keyframes ringspin{from{transform:rotateX(70deg) rotateZ(0)}to{transform:rotateX(70deg) rotateZ(360deg)}}
"""

def chars(word, delay0, step):
    return ''.join(f'<span class="ch" style="animation-delay: {delay0 + i*step:.2f}s">{c}</span>' for i, c in enumerate(word))

K = lambda t: f'<p class="mono" style="margin: 0 0 18px; font-size: 13px; color: {RED}">{t}</p>'
H2 = lambda t, size='clamp(38px, 4.2vw, 62px)': f'<h2 class="serif" style="margin: 0; font-size: {size}; line-height: 1.02; font-weight: 400; letter-spacing: -0.02em; color: #F4F1EC">{t}</h2>'

# ---------- stop 0: about ----------
S0 = f'''<div class="glass" style="padding: 56px 60px 60px; display: flex; flex-wrap: wrap; gap: 32px 56px">
<div style="flex: 1 1 380px">{K('About me')}{H2('I build things that have to work <em style="font-weight: 300">when it matters.</em>')}</div>
<div style="flex: 1 1 360px; font-size: 18px; line-height: 1.65; color: #C9C4BC">
<p style="margin: 0 0 18px">I’m Shreyansh Nikam, a freshman at Livingston High School in New Jersey. I swim on the LHS team, help lead our school’s Hack Club, and spend weekends at hackathons and game jams with a few friends.</p>
<p style="margin: 0 0 18px">This fall I helped build Sky Sentry, an early-warning system that spots birds and drones near a runway, and Echo, a horror game where sound is the only way to see.</p>
<p style="margin: 0; color: #FFFFFF">Together they won four awards at two competitions, including first prize for best overall.</p>
</div></div>'''

# ---------- stop 1: LHS pillars ----------
PIL = [('39', 'AP courses offered'), ('13', 'dual-enrollment courses'), ('5', 'academic pathways and selective programs'), ('474', 'AP Scholars in one year')]
def pillar(i, n, lab):
    x = -390 + i * 260; h = 250 + (i % 2) * 40; z = (i % 2) * -60
    front = f'<div style="height: 100%; box-sizing: border-box; padding: 22px 20px; display: flex; flex-direction: column; justify-content: flex-end"><p class="serif" style="margin: 0; font-size: 72px; line-height: .9; font-weight: 300; color: #FFFFFF">{n}</p><p style="margin: 10px 0 0; font-size: 14px; line-height: 1.35; color: #C9C4BC">{lab}</p></div>'
    return box(220, h, 110, {'front': ('linear-gradient(170deg,#24252C,#111216)', front), 'side': ('linear-gradient(170deg,#1A1B20,#0B0C0F)', ''), 'top': ('#2C2D34', '')},
               extra_style=f'transform: translate3d({x}px, {300 - h/2}px, {z}px)')
S1 = f'''<div style="padding: 0 20px">
{K('The classroom')}{H2('A high-rigor public school, <em style="font-weight: 300">taken at the highest level open to me.</em>')}
<p style="margin: 22px 0 0; max-width: 40em; font-size: 18px; line-height: 1.6; color: #C9C4BC">In 2025 the College Board placed Livingston High School on its AP School Honor Roll at the Platinum level, its highest tier.</p>
<div class="p3 obj3d" style="position: relative; height: 360px; margin-top: 30px"><div class="p3" style="position: absolute; left: 50%; top: 0; width: 0; height: 0; transform: rotateX(-10deg) rotateY(-16deg)">{''.join(pillar(i, n, l) for i, (n, l) in enumerate(PIL))}</div></div>
<p class="mono" style="margin: 0; font-size: 11px; color: #6E6A64">Sources: LHS School Profile 2024–2025. College Board, AP School Honor Roll, New Jersey, 2025.</p>
</div>'''

# ---------- stop 2: staircase ----------
def step_box(label, sub, w, h, y, z, bg, glow=''):
    front = f'<div style="height: 100%; box-sizing: border-box; padding: 18px 22px; display: flex; flex-direction: column; justify-content: center">{label}<p style="margin: 6px 0 0; font-size: 13px; line-height: 1.4; color: rgba(255,255,255,.75)">{sub}</p></div>'
    return box(w, h, 180, {'front': (bg, front), 'side': ('#121318', ''), 'top': (glow or '#1E1F25', '')}, extra_style=f'transform: translate3d(0px, {y}px, {z}px)')
STAIRS = (step_box('<p class="serif" style="margin: 0; font-size: 28px; font-weight: 600; color: #8E8A84">AP</p>', 'College-level courses. They open up in later years of high school.', 340, 80, -120, -200, 'linear-gradient(170deg,#191A1F,#101114)')
          + step_box(f'<p class="serif" style="margin: 0; font-size: 34px; font-weight: 600; color: {RED}">Honors</p>', 'The highest level open to freshmen. Four of my five core courses.', 380, 100, -30, -20, 'linear-gradient(170deg,#2A0D0C,#140606)', f'linear-gradient({RED},#7A1410)')
          + step_box('<p class="serif" style="margin: 0; font-size: 28px; font-weight: 600; color: #C9C4BC">College Prep</p>', 'The college-preparatory standard.', 420, 80, 70, 170, 'linear-gradient(170deg,#1C1D22,#111216)'))
def chip(t, hot):
    return f'<li style="display: flex; justify-content: space-between; gap: 12px; padding: 13px 0; border-bottom: 1px solid #26272C; font-size: 17px; color: {"#F4F1EC" if hot else "#9A968F"}"><span>{t}</span><span class="mono" style="font-size: 12px; color: {RED if hot else "#6E6A64"}">{"Honors" if hot else "College Prep"}</span></li>'
S2 = f'''<div style="display: flex; flex-wrap: wrap; gap: 24px 56px; align-items: center">
<div style="flex: 1 1 420px">{K('How LHS levels its courses')}{H2('Honors is the highest level a freshman can take. <em style="font-weight: 300">Four of my five are Honors.</em>', 'clamp(32px, 3.4vw, 50px)')}
<div class="p3 obj3d" style="position: relative; height: 380px; margin-top: 20px"><div class="p3" style="position: absolute; left: 50%; top: 230px; width: 0; height: 0; transform: rotateX(-16deg) rotateY(24deg)">{STAIRS}</div></div></div>
<div style="flex: 1 1 320px">
<p class="mono" style="margin: 0 0 12px; font-size: 13px; color: #9A968F">My freshman schedule, 2026 to 2027</p>
<ul style="list-style: none; margin: 0; padding: 0; border-top: 1px solid #26272C">{chip('English 1', 1)}{chip('Modern World History', 1)}{chip('Geometry', 1)}{chip('Biology', 1)}{chip('French 2', 0)}</ul>
</div></div>'''

# ---------- stop 3: beyond ----------
def card(i, kick, kc, title, body, g1, g2, bd):
    ry = [-22, 0, 22][i]; z = [-40, 60, -40][i]
    return f'''<li class="p3" style="flex: 1 1 0; min-width: 0; transform: translateZ({z}px) rotateY({ry}deg)"><div style="height: 100%; padding: 30px 26px 32px; border-radius: 22px; background: linear-gradient(160deg,{g1},{g2}); border: 1px solid {bd}; box-shadow: 0 50px 90px -30px rgba(0,0,0,.9)">
<p class="mono" style="margin: 0 0 34px; font-size: 12px; color: {kc}">{kick}</p>
<h3 class="serif" style="margin: 0 0 10px; font-size: 28px; line-height: 1.08; font-weight: 500; color: #FFFFFF">{title}</h3>
<p style="margin: 0; font-size: 15px; line-height: 1.55; color: #C6C0B8">{body}</p></div></li>'''
S3 = f'''<div style="padding: 0 10px">{K('Beyond the classroom')}{H2('Practice in the pool. <em style="font-weight: 300">Code on weekends.</em>')}
<ul class="p3" style="list-style: none; margin: 44px 0 0; padding: 0; display: flex; gap: 22px; perspective: 1400px">
{card(0, 'Athletics', '#7FB8E6', 'LHS Swim', 'I swim for Livingston High School, training through the season on top of a full Honors schedule.', '#0F2233', '#0A1420', '#1E3346')}
{card(1, 'Leadership', RED, 'LHS Hack Club, Vice President', 'One of the leaders of a first-year club of 30 to 50 students who build software and hardware, run workshops and go to hackathons.', '#2A0C0C', '#160707', '#4A1616')}
{card(2, 'Competitions', '#E7B95A', 'Hackathons and game jams', 'Two events this fall, two winning projects, built with Atharv, Pranav, Vivan and Elias.', '#1E1A10', '#110F09', '#3A3220')}
</ul></div>'''

# ---------- stop 4: fall awards with medals ----------
def mini(i, x, c1, c2, rim, txt, gl=None):
    return f'<div class="p3" style="position: absolute; left: 0; top: 0; transform: translate3d({x}px, 0, 0)"><div class="bob p3" style="animation-delay: {-i*1.3}s">{medal(120, c1, c2, rim, txt, speed=7 + i, delay=-i*2, gl=gl)}</div></div>'
MT = lambda a, b, c='#1A0F02': f'<div style="font-family: Geist, sans-serif; color: {c}; line-height: 1.05"><div style="font-size: 10px; font-weight: 700; letter-spacing: .08em">{a}</div><div style="font-size: 15px; font-weight: 800; margin-top: 2px">{b}</div></div>'
S4 = f'''<div style="padding: 0 10px">{K('Fall 2026')}{H2('Two competitions. <em style="font-weight: 300">Four awards.</em>')}
<div style="display: flex; flex-wrap: wrap; gap: 30px 56px; margin-top: 26px">
<div style="flex: 1.3 1 420px">
<div class="p3 obj3d" style="position: relative; height: 170px"><div class="p3" style="position: absolute; left: 50%; top: 80px; width: 0; height: 0">
{mini(0, -150, '#FF8A80', '#C8102E', '#7A0A12', MT('BEST USE', 'SOLANA', '#FFFFFF'), gl=dict(mat='red', top='BEST USE OF', main='SOLANA', bot='HACKPHS 2026', b3='SKY SENTRY'))}{mini(1, 0, '#9FF2E6', '#1FA897', '#0C5A50', MT('BEST USE', 'TIGERDATA', '#04201C'), gl=dict(mat='teal', top='BEST USE OF', main='TIGERDATA', bot='HACKPHS 2026', b3='SKY SENTRY'))}{mini(2, 150, '#F2F4F8', '#9AA3B2', '#525A68', MT('OVERALL', '5TH PLACE', '#141A24'), gl=dict(mat='silver', top='OVERALL', main='5TH|PLACE', bot='HACKPHS 2026', b3='SKY SENTRY'))}
</div></div>
<p class="mono" style="margin: 8px 0 6px; font-size: 13px; color: #9A968F">October 2026, HackPHS</p>
<h3 class="serif" style="margin: 0 0 10px; font-size: 40px; font-weight: 500; color: #FFFFFF">Sky Sentry</h3>
<a href="SkySentry.dc.html" style="font-size: 16px; font-weight: 600; padding: 10px 0; color: #FFFFFF">Watch the Sky Sentry film</a></div>
<div style="flex: 1 1 300px">
<div class="p3 obj3d" style="position: relative; height: 170px"><div class="p3" style="position: absolute; left: 50%; top: 80px; width: 0; height: 0"><div class="bob p3">{medal(160, '#FFF1B8', '#E0A82E', '#8A5A10', MT('1ST PRIZE', 'BEST OVERALL'), speed=9, gl=dict(mat='gold', top='BEST OVERALL', main='1ST|PRIZE', bot='HACK CLUB HAVEN', b3='ECHO'))}</div></div></div>
<p class="mono" style="margin: 8px 0 6px; font-size: 13px; color: #9A968F">November 14 to 15, 2026, Hack Club Haven Princeton</p>
<h3 class="serif" style="margin: 0 0 10px; font-size: 40px; font-weight: 500; color: #FFFFFF">Echo</h3>
<a href="Echo.dc.html" style="font-size: 16px; font-weight: 600; padding: 10px 0; color: #FFFFFF">Enter the Hollow</a></div>
</div></div>'''

# ---------- stop 5: how I work slabs ----------
def slab(i, t, b):
    x = -360 + i * 360; ry = [18, 0, -18][i]
    front = f'<div style="padding: 30px 26px"><p class="mono" style="margin: 0 0 22px; font-size: 12px; color: {RED}">0{i+1}</p><h3 class="serif" style="margin: 0 0 10px; font-size: 28px; font-weight: 500; color: #FFFFFF">{t}</h3><p style="margin: 0; font-size: 15px; line-height: 1.55; color: #B5B0A8">{b}</p></div>'
    return box(320, 280, 34, {'front': ('linear-gradient(165deg,#1E1F25,#0E0F12)', front), 'side': ('#0B0C0F', ''), 'top': ('#2A2B31', '')}, extra_style=f'transform: translate3d({x}px, 0, {abs(i-1)*-40}px) rotateY({ry}deg)')
S5 = f'''<div style="padding: 0 10px">{K('How I work')}{H2('Any team. End to end. <em style="font-weight: 300">Tested before done.</em>')}
<div class="p3 obj3d" style="position: relative; height: 340px; margin-top: 30px"><div class="p3" style="position: absolute; left: 50%; top: 160px; width: 0; height: 0">
{slab(0, 'Any team, any stack', 'From an AI and blockchain backend to a game engine, with different teammates each time.')}
{slab(1, 'End to end', 'I like building the whole path, from the camera frame to the spoken alert in the tower.')}
{slab(2, 'Tested before done', 'Sky Sentry runs even with no API keys. After my cleanup of Echo, I ran the game again to make sure nothing broke.')}
</div></div></div>'''

STOPS = [
    dict(x=0, y=0, z=0, ry=0, w=1060, html=S0),
    dict(x=1500, y=-120, z=-1900, ry=-30, w=1100, html=S1),
    dict(x=2900, y=140, z=-3800, ry=-62, w=1120, html=S2),
    dict(x=3200, y=0, z=-6000, ry=-102, w=1120, html=S3),
    dict(x=2100, y=-80, z=-7900, ry=-146, w=1100, html=S4),
    dict(x=400, y=60, z=-9100, ry=-188, w=1140, html=S5),
]
FLY = fly_section(STOPS, {'bg3d': '#0b0708', 'bg': 'radial-gradient(ellipse at 50% 40%, #16090A 0%, #07080B 60%)', 'acc': RED, 'dot': '244,241,236', 'hotc': '255,59,48', 'hot': 0.14, 'particles': 750, 'lift': 180, 'pull': 900}, 'About me, a 3D walkthrough. Scroll to move between sections.', sec_id='about', props=['laptop', 'pillars', 'stairs', 'pool', 'medals', 'slabs'])

def ring(r, dur, col, rev=False):
    return f'<div aria-hidden="true" style="position: absolute; left: 50%; top: 50%; width: {r*2}px; height: {r*2}px; margin: {-r}px 0 0 {-r}px; border-radius: 50%; border: 1.5px solid {col}; box-shadow: 0 0 30px {col}; animation: ringspin {dur}s linear infinite{" reverse" if rev else ""}"></div>'

BODY = f'''<main style="font-family: Geist, system-ui, sans-serif; color: #F4F1EC; background: #07080B; overflow-x: clip">
{nav('home')}

<section ref="{{{{ tiltRef }}}}" aria-labelledby="hero-name" style="position: relative; height: 100vh; height: 100svh; min-height: 640px; overflow: hidden; background: #07080B">
<canvas ref="{{{{ fieldRef }}}}" aria-hidden="true" style="position: absolute; inset: 0; width: 100%; height: 100%; display: block"></canvas>
<div aria-hidden="true" style="position: absolute; inset: 0; background: linear-gradient(90deg, rgba(7,8,11,.94) 0%, rgba(7,8,11,.7) 42%, rgba(7,8,11,0) 75%), linear-gradient(0deg, #07080B 0%, rgba(7,8,11,0) 30%)"></div>
<div class="wrap" style="height: 100%; display: flex; flex-direction: column; justify-content: center; padding-top: 90px; padding-bottom: 60px; perspective: 1100px">
<div class="p3 tilt" data-tilt="0.28">
<p class="mono fu" style="margin: 0 0 28px; font-size: 13px; color: #B9B4AC; animation-delay: .2s; transform: translateZ(30px)"><span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: {RED}; margin-right: 10px; box-shadow: 0 0 12px {RED}"></span>Freshman at Livingston High School, New Jersey</p>
<h1 id="hero-name" class="serif" style="margin: 0; font-size: clamp(64px, 11.5vw, 176px); line-height: .86; letter-spacing: -0.035em; transform: translateZ(90px); text-shadow: 0 30px 60px rgba(0,0,0,.6)">
<span style="display: block; overflow: hidden; padding-bottom: .06em; font-style: italic; font-weight: 300; font-variation-settings: 'SOFT' 100, 'WONK' 1">{chars('Shreyansh', .35, .05)}</span>
<span style="display: block; overflow: hidden; padding-bottom: .04em; font-weight: 700">{chars('Nikam', .7, .06)}<span class="ch" style="animation-delay: 1.05s; color: {RED}">.</span></span>
</h1>
<p class="fu" style="margin: 30px 0 0; font-size: clamp(15px, 2vw, 28px); line-height: 1.25; color: #D9D4CC; animation-delay: 1.1s; display: flex; flex-wrap: wrap; gap: 0 .3em; transform: translateZ(55px)">I build
<span style="display: inline-block; max-width: 100%; height: 1.25em; overflow: hidden; vertical-align: bottom; white-space: nowrap"><span class="rot serif" style="font-style: italic; color: #FFFFFF">
<span style="display: block; height: 1.25em">AI that warns airport towers about birds.</span>
<span style="display: block; height: 1.25em">horror games you see with sound.</span>
<span style="display: block; height: 1.25em">things that work end to end.</span>
<span style="display: block; height: 1.25em">AI that warns airport towers about birds.</span>
</span></span></p>
<ul class="fu" style="list-style: none; margin: 44px 0 0; padding: 0; display: flex; flex-wrap: wrap; gap: 20px 48px; animation-delay: 1.3s; transform: translateZ(40px)">
<li><span class="serif count" style="--to: 4; font-size: 52px; line-height: 1; font-weight: 400; animation-delay: 1.4s"></span><span style="display: block; margin-top: 6px; font-size: 14px; color: #9A968F">awards this fall</span></li>
<li><span class="serif count" style="--to: 2; font-size: 52px; line-height: 1; font-weight: 400; animation-delay: 1.5s"></span><span style="display: block; margin-top: 6px; font-size: 14px; color: #9A968F">competitions, both with awards</span></li>
<li><span class="serif" style="font-size: 52px; line-height: 1; font-weight: 400; font-style: italic; color: {RED}">1st</span><span style="display: block; margin-top: 6px; font-size: 14px; color: #9A968F">prize, best overall</span></li>
</ul>
<div class="fu" style="margin-top: 44px; display: flex; flex-wrap: wrap; align-items: center; gap: 16px; animation-delay: 1.55s; transform: translateZ(70px)">
<a class="btn btn-red" href="Projects.dc.html">See my projects and achievements</a>
<a class="btn btn-ghost" href="#about">Read about me</a>
</div>
</div>
</div>
<div aria-hidden="true" class="hide-sm" style="position: absolute; right: 48px; bottom: 40px; display: flex; flex-direction: column; align-items: center; gap: 10px; color: #77736D; font-size: 12px">
<span class="mono">Scroll</span><span style="display: block; width: 1px; height: 56px; background: #F4F1EC; animation: scrollcue 2.2s cubic-bezier(.7,0,.3,1) infinite"></span>
</div>
</section>

{FLY}

<section aria-labelledby="cta-h" style="position: relative; padding: 120px 0; min-height: 100vh; min-height: 100svh; box-sizing: border-box; display: flex; flex-direction: column; justify-content: center; overflow: hidden; background: radial-gradient(ellipse at 50% 120%, #3A0B08 0%, #07080B 60%); perspective: 900px">
<div aria-hidden="true" class="p3" style="position: absolute; inset: 0">{ring(260, 22, 'rgba(255,59,48,.55)')}{ring(380, 34, 'rgba(255,59,48,.3)', True)}{ring(520, 48, 'rgba(244,241,236,.14)')}</div>
<div class="wrap" style="position: relative; text-align: center">
<h2 id="cta-h" class="serif" style="margin: 0 auto; max-width: 12em; font-size: clamp(48px, 7vw, 112px); line-height: .95; font-weight: 400; letter-spacing: -0.03em">Two projects. <em style="font-weight: 300">One fall.</em></h2>
<p style="margin: 28px auto 44px; max-width: 30em; font-size: 19px; line-height: 1.6; color: #C9C4BC">Watch Sky Sentry catch a flock before it reaches the runway, then walk into the mine from Echo.</p>
<a class="btn btn-red" href="Projects.dc.html" style="min-height: 64px; padding: 0 40px; font-size: 19px">See my projects and achievements</a>
</div>
</section>
{footer()}
</main>
'''

CLASS = r'''class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.fieldRef = (el) => { if (el && el !== this.cv) { this.cv = el; this.start(); } };
  }
  start() {
    const cv = this.cv, ctx = cv.getContext('2d');
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let W = 0, H = 0, dpr = 1, mx = 0, my = 0;
    const NX = 150, NZ = 46;
    const resize = () => {
      dpr = Math.max(0.75, Math.min(window.devicePixelRatio || 1, 3, Math.sqrt(16e6 / Math.max(1, cv.clientWidth * cv.clientHeight))) * (this.q || 1));
      const r = cv.getBoundingClientRect(); W = r.width; H = r.height;
      cv.width = Math.max(1, Math.round(W * dpr)); cv.height = Math.max(1, Math.round(H * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    this.onResize = resize;
    window.addEventListener('resize', resize);
    this.ensureGlobal();
    resize();
    const t0 = performance.now();
    this.extraFrame = () => {
      const now = performance.now();
      const r = cv.getBoundingClientRect(); if (r.bottom < 0) return;
      const t = reduce ? 6 : (now - t0) / 1000;
      mx += (this.mxN - mx) * 0.05; my += (this.myN - my) * 0.05;
      const want = Math.max(0.75, Math.min(window.devicePixelRatio || 1, 3) * (this.q || 1));
      if (Math.abs(want - dpr) > 0.15) resize();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const f = H * 0.9, cx = W * 0.64 + mx * 60, cy = H * 0.4 + my * 30;
      const camY = 6.5 + my * 1.5, sweep = t * 0.55, ringR = (t * 9) % 70;
      for (let iz = NZ - 1; iz >= 0; iz--) {
        const z = 6 + iz * 1.5;
        for (let ix = 0; ix < NX; ix++) {
          const x = (ix - NX / 2) * 0.62 + mx * 4;
          const y = 1.8 * Math.sin(x * 0.13 + t * 0.35) * Math.cos(z * 0.11 - t * 0.27) + 1.4 * Math.sin((x + z) * 0.06 + t * 0.18);
          const sx = cx + x / z * f, sy = cy + (camY - y) / z * f;
          if (sx < -10 || sx > W + 10 || sy < -10 || sy > H + 10) continue;
          const a = Math.atan2(x, z - 30);
          const d = ((sweep - a) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
          const sweepB = Math.exp(-d * 2.4);
          const rr = Math.hypot(x + 18, z - 22);
          const ringB = Math.exp(-Math.pow(rr - ringR, 2) / 6) * Math.max(0, 1 - ringR / 70);
          const depth = 1 - iz / NZ, hot = Math.min(1, sweepB * 0.9 + ringB);
          const s = Math.max(1, 2.6 * depth + hot * 1.6);
          ctx.fillStyle = hot > 0.05 ? 'rgba(255,' + Math.round(70 + 120 * ringB) + ',' + Math.round(48 + 40 * ringB) + ',' + (0.25 + hot * 0.75 * (0.4 + depth)).toFixed(3) + ')' : 'rgba(244,241,236,' + (0.1 + depth * 0.35).toFixed(3) + ')';
          ctx.fillRect(sx, sy, s, s);
        }
      }
    };
  }
  componentWillUnmount() { this.cleanupFly(); window.removeEventListener('resize', this.onResize); }
  renderVals() { return { fieldRef: this.fieldRef, flyRef: this.flyRef, tiltRef: this.tiltRef }; }
}'''

SCRIPT = '''<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":1440,"height":9400}}'>\n''' + inject(CLASS) + '\n</script>'
html = head('Shreyansh Nikam: about me', FONTS, CSS) + BODY + tail(SCRIPT)
open(OUTDIR + 'Main.dc.html', 'w').write(html)
print('home', len(html))
