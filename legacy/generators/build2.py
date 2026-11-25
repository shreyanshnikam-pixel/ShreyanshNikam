import random, math
random.seed(11)
OUT='/mnt/user-data/outputs/artifacts/baf5b780-9a21-483f-91fc-32be15b1a48b/project/Main.dc.html'
def lerp(a,b,t): return a+(b-a)*t
def mix(c1,c2,t):
    a=[int(c1[i:i+2],16) for i in (1,3,5)]; b=[int(c2[i:i+2],16) for i in (1,3,5)]
    return '#'+''.join(f'{round(lerp(x,y,t)):02X}' for x,y in zip(a,b))
def hole(seed):
    r=random.Random(seed); pts=[]
    for k in range(30):
        a=2*math.pi*k/30; j=r.uniform(.84,1.08)
        pts.append((800+520*j*math.cos(a), 500+330*j*math.sin(a)))
    return ' '.join(('M' if i==0 else 'L')+f'{x:.0f} {y:.0f}' for i,(x,y) in enumerate(pts))+'Z'
RED='#FF2D2D'; RED2='#E0141E'
rings=[]
for i in range(7):
    t=i/6; h=hole(i+5)
    rings.append(f'<svg aria-hidden="true" viewBox="0 0 1600 1000" style="position: absolute; left: 50%; top: 50%; width: 1600px; height: 1000px; margin: -500px 0 0 -800px; transform: translateZ({-i*500}px)"><path fill="{mix("#1C0204","#040000",t)}" fill-rule="evenodd" d="M0 0H1600V1000H0Z {h}"></path><path d="{h}" fill="none" stroke="{RED}" stroke-width="3" opacity="{lerp(.95,.2,t):.2f}"></path></svg>')
motes=[]
for i in range(34):
    x=random.randint(-900,900); y=random.randint(-520,520); z=random.randint(-3200,-150)
    s=random.choice([2,3,4,5]); d=random.uniform(5,11); dl=random.uniform(-10,0)
    motes.append(f'<div style="position: absolute; left: 50%; top: 50%; transform: translate3d({x}px, {y}px, {z}px)"><div class="float" style="width: {s}px; height: {s}px; border-radius: 50%; background: #FF8A6B; box-shadow: 0 0 12px 2px rgba(255,45,45,.8); animation-duration: {d:.1f}s; animation-delay: {dl:.1f}s; --fx: {random.randint(-30,30)}px; --fy: {random.randint(-60,-20)}px"></div></div>')
stars=''.join(f'<div class="twinkle" style="position: absolute; left: {random.uniform(1,99):.1f}%; top: {random.uniform(2,48):.1f}%; width: {random.choice([1.5,2,2,3])}px; height: {random.choice([1.5,2,2,3])}px; border-radius: 50%; background: #FFFFFF; animation-duration: {random.uniform(2,5):.1f}s; animation-delay: {random.uniform(-5,0):.1f}s"></div>' for _ in range(60))
BIRDS='<path d="M0 10 q6 -7 12 0 q6 -7 12 0"></path><path d="M30 2 q6 -7 12 0 q6 -7 12 0"></path><path d="M34 22 q6 -7 12 0 q6 -7 12 0"></path><path d="M66 12 q6 -7 12 0 q6 -7 12 0"></path><path d="M96 4 q6 -7 12 0 q6 -7 12 0"></path><path d="M102 28 q6 -7 12 0 q6 -7 12 0"></path>'
def flock(left,top,w,col,x0,x1,y0,y1,dur):
    return f'<div class="ts" aria-hidden="true" style="position: absolute; left: {left}; top: {top}; --x0: {x0}; --x1: {x1}; --y0: {y0}; --y1: {y1}"><svg class="flap" viewBox="0 0 150 40" style="width: {w}px; animation-duration: {dur}s" fill="none" stroke="{col}" stroke-width="2.4" stroke-linecap="round">{BIRDS}</svg></div>'
edge=''.join(f'<div style="position: absolute; {side}; top: {60+k*150}px; width: 14px; height: 14px; border-radius: 50%; background: {"#FF4D4D" if k<3 else "#FFFFFF"}; box-shadow: 0 0 24px 8px {"rgba(255,45,45,.8)" if k<3 else "rgba(255,255,255,.55)"}"></div>' for k in range(9) for side in ('left: -10px','right: -10px'))
strobes=''.join(f'<div class="strobe" style="position: absolute; left: 50%; bottom: {40+k*70}px; width: 16px; height: 16px; margin-left: -8px; border-radius: 50%; background: #FFFFFF; animation-delay: {(5-k)*0.1:.1f}s"></div>' for k in range(6))
COLS,ROWS=10,6
tiles=[]
for r in range(ROWS):
    for c in range(COLS):
        a=4+((c+r*1.3)%12)*2.0+random.uniform(0,3)
        tiles.append(f'<div class="te0" style="background: #000; border: 1px solid #1A0003; transform: rotateY(90deg); opacity: 0; animation-range: contain {a:.1f}% contain {a+9:.1f}%; --ry1: 90deg; --o1: 0"></div>')
STATEMENT=[('I',0),('build',0),('things',0),('that',0),('work',1),('end',1),('to',1),('end,',1),('and',0),('I',0),('test',1),('them',1),('before',0),('I',0),('call',0),('them',0),('done.',0),('From',0),('an',0),('AI',0),('and',0),('blockchain',0),('backend',0),('to',0),('a',0),('game',0),('engine,',0),('with',0),('different',0),('teams,',0),('on',0),('top',0),('of',0),('honors',0),('classes',0),('and',0),('swim',0),('practice.',0)]
words=[]
n=len(STATEMENT)
for i,(w,b) in enumerate(STATEMENT):
    a=10+i*(45/n)
    col=f'color: {RED}; ' if b else ''
    words.append(f'<span class="wr" style="{col}animation-range: cover {a:.1f}% cover {a+5:.1f}%">{w}</span>')
MARQ=['Gemini','ElevenLabs','Solana','SHA-256','Godot 4','Tiger Data','MongoDB','Clerk','DigitalOcean','Arduino','Poly Haven','KayKit']
def marq_items():
    return ''.join(f'<span style="display: inline-flex; align-items: center; gap: 36px; padding-right: 36px">{m}<svg aria-hidden="true" viewBox="0 0 20 20" style="width: 22px; height: 22px"><path d="M10 0 L12 8 L20 10 L12 12 L10 20 L8 12 L0 10 L8 8Z" fill="currentColor"></path></svg></span>' for m in MARQ)
def row(num,title,meta,href,link,rng):
    return f'''<li class="vs" style="--y0: 60px; --o0: 0; animation-range: {rng}"><a class="row" href="{href}" style="position: relative; display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px 32px; padding: 30px 8px; border-bottom: 1px solid #2A2A2A; text-decoration: none; color: #F2F2F2">
<span style="flex: 0 0 64px; font-size: 18px; font-weight: 700; color: {RED}">{num}</span>
<span style="flex: 1 1 420px; font-size: clamp(44px, 7vw, 104px); line-height: .9; font-weight: 800; font-stretch: 62%; text-transform: uppercase">{title}</span>
<span style="flex: 1 1 260px; font-size: 18px; line-height: 1.45; color: #B5B5B5">{meta}</span>
<span style="flex: 0 0 auto; font-size: 16px; font-weight: 700; text-decoration: underline; text-underline-offset: 5px">{link}</span>
</a></li>'''
def step(n,title,body,rng):
    return f'''<li class="vs" style="flex: 1 1 220px; background: #0E0E0E; border: 1px solid #222; border-radius: 4px; padding: 26px 24px 28px; animation-range: {rng}; --ry0: -38deg; --z0: -160px; --o0: 0; --x0: -40px">
<span style="font-size: 15px; font-weight: 700; color: {RED}">{n}</span>
<h4 style="margin: 10px 0 8px; font-size: 26px; line-height: 1; font-weight: 800; font-stretch: 70%; text-transform: uppercase; color: #FFFFFF">{title}</h4>
<p style="margin: 0; font-size: 16px; line-height: 1.55; color: #A8A8A8">{body}</p>
</li>'''
def part(title,body,extra='',last=False):
    bb='' if last else 'border-bottom: 1px solid #262626; '
    return f'<div style="padding: 28px 0; {bb}">{title}<p style="margin: 0; font-size: 17px; line-height: 1.6; max-width: 36em; color: #C4C4C4">{body}</p>{extra}</div>'
H4=lambda t: f'<h4 style="margin: 0 0 10px; font-size: 26px; line-height: 1; font-weight: 800; font-stretch: 70%; text-transform: uppercase; color: #FFFFFF">{t}</h4>'
DISP='font-weight: 800; font-stretch: 62%; text-transform: uppercase; letter-spacing: -0.005em'

css=f'''
body{{margin:0;background:#000}}
a{{color:inherit;text-underline-offset:4px}}a:hover{{color:{RED}}}
.wrap{{max-width:1240px;margin:0 auto;padding:0 48px;box-sizing:border-box;position:relative}}
.stage{{position:sticky;top:0;height:min(100vh,1000px);overflow:hidden}}
.hero-scene{{view-timeline-name:--hero}}.sky-scene{{view-timeline-name:--sky}}.echo-scene{{view-timeline-name:--echo}}
@keyframes pan{{from{{transform:translate3d(var(--x0,0px),var(--y0,0px),var(--z0,0px)) rotateX(var(--rx0,0deg)) rotateY(var(--ry0,0deg)) scale(var(--s0,1))}}to{{transform:translate3d(var(--x1,0px),var(--y1,0px),var(--z1,0px)) rotateX(var(--rx1,0deg)) rotateY(var(--ry1,0deg)) scale(var(--s1,1))}}}}
@keyframes fadev{{from{{opacity:var(--o0,1)}}to{{opacity:var(--o1,1)}}}}
@keyframes fin{{from{{opacity:0}}to{{opacity:1}}}}@keyframes fout{{from{{opacity:1}}to{{opacity:0}}}}@keyframes fio{{0%{{opacity:0}}15%,85%{{opacity:1}}100%{{opacity:0}}}}
@keyframes draw{{from{{transform:scaleX(0)}}to{{transform:scaleX(1)}}}}
@keyframes float{{0%,100%{{transform:translate3d(0,0,0)}}50%{{transform:translate3d(var(--fx,10px),var(--fy,-30px),0)}}}}.float{{animation:float 8s ease-in-out infinite}}
@keyframes pulse{{0%{{transform:scale(.03);opacity:.95}}100%{{transform:scale(1);opacity:0}}}}
.pulse{{position:absolute;left:50%;top:50%;width:1800px;height:1800px;margin:-900px 0 0 -900px;border-radius:50%;border:2px solid {RED};box-shadow:0 0 40px rgba(255,45,45,.4),inset 0 0 60px rgba(255,45,45,.25);pointer-events:none;transform:scale(.6);opacity:.2;animation:pulse 3.6s cubic-bezier(.15,.6,.3,1) infinite}}
.once{{animation-iteration-count:1;animation-fill-mode:both}}
@keyframes twinkle{{0%,100%{{opacity:.25}}50%{{opacity:1}}}}.twinkle{{animation:twinkle 3s ease-in-out infinite}}
@keyframes spinY{{to{{transform:rotateX(-18deg) rotateY(360deg)}}}}@keyframes flap{{0%,100%{{transform:scaleY(1)}}50%{{transform:scaleY(.35)}}}}.flap{{display:block;animation:flap .7s ease-in-out infinite;transform-origin:center}}
@keyframes strobe{{0%,6%{{opacity:1;box-shadow:0 0 26px 10px #fff}}14%,100%{{opacity:.12;box-shadow:none}}}}.strobe{{opacity:.12;animation:strobe 1.4s linear infinite}}
@keyframes sweep{{from{{transform:translateX(-30%)}}to{{transform:translateX(130%)}}}}.sweep{{animation:sweep 3.6s cubic-bezier(.2,.6,.4,1) infinite}}
@keyframes marq{{to{{transform:translateX(-50%)}}}}.marq{{display:flex;width:max-content;animation:marq 38s linear infinite}}.marq.rev{{animation-direction:reverse}}
@keyframes rise{{from{{transform:translateY(105%)}}to{{transform:none}}}}.rise{{display:block;animation:rise 1.1s cubic-bezier(.2,.7,.1,1) both}}
@property --n{{syntax:'<integer>';inherits:false;initial-value:0}}
@keyframes count{{from{{--n:0}}to{{--n:100}}}}.count{{animation:count 1.5s cubic-bezier(.4,0,.2,1) both}}.count::after{{counter-reset:n var(--n);content:counter(n)}}
@keyframes curtain{{0%,78%{{transform:none;visibility:visible}}100%{{transform:translateY(-101%);visibility:hidden}}}}
.loader{{position:fixed;inset:0;z-index:100;background:#000;transform:translateY(-101%);visibility:hidden;animation:curtain 2.3s cubic-bezier(.7,0,.2,1) both}}
@keyframes bar{{from{{transform:scaleX(0)}}to{{transform:scaleX(1)}}}}.bar{{transform-origin:left;animation:bar 1.5s cubic-bezier(.4,0,.2,1) both}}
.row::before{{content:"";position:absolute;inset:0;background:{RED2};transform:scaleY(0);transform-origin:bottom;transition:transform .45s cubic-bezier(.2,.8,.2,1);z-index:-1}}
.row{{z-index:0;transition:color .3s}}.row:hover{{color:#FFFFFF}}.row:hover::before{{transform:scaleY(1)}}.row:hover span{{color:#FFFFFF !important}}
.pill{{font:700 15px/1 Archivo,sans-serif;letter-spacing:.02em;color:#FFFFFF;background:transparent;border:1px solid #FFFFFF;border-radius:999px;padding:0 22px;min-height:44px;cursor:pointer;transition:background .25s,color .25s,transform .16s}}
.pill:hover{{background:#FFFFFF;color:#000}}.pill:active{{transform:scale(.95)}}
.ping-btn{{font:700 16px/1 Archivo,sans-serif;color:#FFFFFF;background:{RED2};border:0;border-radius:999px;padding:0 28px;min-height:50px;cursor:pointer;box-shadow:0 10px 40px -10px {RED};transition:transform .16s cubic-bezier(.2,.8,.2,1),box-shadow .3s}}
.ping-btn:hover{{box-shadow:0 0 0 8px rgba(255,45,45,.2),0 10px 50px -8px {RED}}}.ping-btn:active{{transform:scale(.95)}}
.ping-btn:focus-visible,.pill:focus-visible,a:focus-visible{{outline:3px solid #FFFFFF;outline-offset:3px}}
.orb{{position:fixed;left:0;top:0;width:300px;height:300px;margin:-150px 0 0 -150px;z-index:40;pointer-events:none;transform:translate(84vw,24vh) scale(.55)}}
@keyframes travel{{0%,9%{{transform:translate(30vw,47vh) scale(1)}}17%,31%{{transform:translate(94vw,24vh) scale(.36)}}36%,47%{{transform:translate(88vw,40vh) scale(.5)}}52%,67%{{transform:translate(94vw,50vh) scale(.36)}}69%,72%{{transform:translate(50vw,50vh) scale(1)}}76%,82%{{transform:translate(50vw,15vh) scale(.45)}}87%,100%{{transform:translate(94vw,28vh) scale(.36)}}}}
.cursor{{position:fixed;left:0;top:0;width:36px;height:36px;margin:-18px 0 0 -18px;border:1.5px solid {RED};border-radius:50%;z-index:90;pointer-events:none;opacity:0;transition:opacity .3s}}
.te0{{}}
@supports (animation-timeline: view()){{@media (prefers-reduced-motion:no-preference){{
.th,.ts,.te{{animation:pan linear both}}.th1,.ts1,.te1,.vs,.te0{{animation:pan linear both,fadev linear both}}
.th{{animation-timeline:--hero;animation-range:contain 0% contain 100%}}.th1{{animation-timeline:--hero;animation-range:contain 0% contain 30%}}
.ts{{animation-timeline:--sky;animation-range:contain 0% contain 100%}}.ts1{{animation-timeline:--sky;animation-range:contain 0% contain 30%}}
.te{{animation-timeline:--echo;animation-range:contain 0% contain 100%}}.te1{{animation-timeline:--echo;animation-range:contain 30% contain 55%}}.te0{{animation-timeline:--echo}}
.vs{{animation-timeline:view();animation-range:entry 0% cover 40%}}
.wr{{animation:fadev linear both;animation-timeline:view();--o0:.14}}
.draw{{transform-origin:left center;animation:draw linear both;animation-timeline:view();animation-range:entry 20% cover 45%}}
.s-g{{animation:fout linear both;animation-timeline:--sky;animation-range:contain 28% contain 36%}}
.s-y{{animation:fio linear both;animation-timeline:--sky;animation-range:contain 28% contain 64%}}
.s-r{{animation:fin linear both;animation-timeline:--sky;animation-range:contain 56% contain 64%}}
.dusk{{animation:fin linear both;animation-timeline:--sky;animation-range:contain 10% contain 90%}}
.orb{{animation:travel linear both;animation-timeline:scroll(root)}}
}}}}
@media (max-width:720px){{.wrap{{padding:0 20px}}.orb{{display:none}}}}
@media (prefers-reduced-motion:reduce){{*,*::before,*::after{{animation:none !important;transition:none !important}}}}
'''

body=f'''<main id="top" style="font-family: Archivo, system-ui, sans-serif; color: #F2F2F2; background: #000; overflow-x: clip">

<div class="loader" aria-hidden="true">
<div class="wrap" style="height: 100%; display: flex; flex-direction: column; justify-content: flex-end; padding-bottom: 8vh">
<div style="display: flex; justify-content: space-between; align-items: flex-end; gap: 24px">
<span style="font-size: clamp(56px, 10vw, 160px); line-height: .85; {DISP}">Shreyansh<br>Nikam</span>
<span class="count" style="font-size: clamp(56px, 10vw, 160px); line-height: .85; font-weight: 800; font-stretch: 62%; color: {RED}; font-variant-numeric: tabular-nums"></span>
</div>
<div style="margin-top: 28px; height: 2px; background: #1F1F1F"><div class="bar" style="height: 2px; background: {RED}"></div></div>
</div>
</div>

<div class="orb" aria-hidden="true">
<div style="position: absolute; inset: 0; border-radius: 50%; background: radial-gradient(circle, rgba(255,45,45,.55) 0%, rgba(255,45,45,.12) 40%, rgba(255,45,45,0) 68%)"></div>
<div style="position: absolute; inset: 0; perspective: 900px">
<div style="position: absolute; inset: 0; transform-style: preserve-3d; animation: spinY 9s linear infinite">
<div style="position: absolute; inset: 18%; border-radius: 50%; border: 2px solid {RED}; transform: rotateY(0deg)"></div>
<div style="position: absolute; inset: 18%; border-radius: 50%; border: 2px solid {RED}; transform: rotateY(45deg)"></div>
<div style="position: absolute; inset: 18%; border-radius: 50%; border: 2px solid {RED}; transform: rotateY(90deg)"></div>
<div style="position: absolute; inset: 18%; border-radius: 50%; border: 2px solid {RED}; transform: rotateY(135deg)"></div>
<div style="position: absolute; inset: 18%; border-radius: 50%; border: 1px solid rgba(255,255,255,.5); transform: rotateX(90deg)"></div>
<div style="position: absolute; inset: 30%; border-radius: 50%; border: 1px solid rgba(255,255,255,.35); transform: rotateX(90deg) translateZ(40px)"></div>
<div style="position: absolute; inset: 30%; border-radius: 50%; border: 1px solid rgba(255,255,255,.35); transform: rotateX(90deg) translateZ(-40px)"></div>
</div>
</div>
<div style="position: absolute; left: 50%; top: 50%; width: 34px; height: 34px; margin: -17px 0 0 -17px; border-radius: 50%; background: radial-gradient(circle at 35% 35%, #FFFFFF, {RED} 45%, #6A0006); box-shadow: 0 0 40px 10px rgba(255,45,45,.7)"></div>
</div>

<div class="cursor" aria-hidden="true" ref="{{{{ setRing }}}}"></div>

<header style="position: fixed; left: 0; right: 0; top: 0; z-index: 60; pointer-events: none; background: linear-gradient(to bottom, rgba(0,0,0,.9) 0%, rgba(0,0,0,.6) 60%, rgba(0,0,0,0) 100%)">
<div class="wrap" style="display: flex; justify-content: space-between; align-items: center; padding-top: 22px; padding-bottom: 22px">
<a href="#top" style="pointer-events: auto; font-size: 20px; font-weight: 800; font-stretch: 62%; text-transform: uppercase; letter-spacing: .02em; text-decoration: none; padding: 10px 0">Shreyansh Nikam<span style="color: {RED}">.</span></a>
<button type="button" class="pill" style="pointer-events: auto" aria-expanded="{{{{ menuExp }}}}" aria-controls="site-menu" onClick="{{{{ toggleMenu }}}}">{{{{ menuLabel }}}}</button>
</div>
</header>

<sc-if value="{{{{ menu }}}}" hint-placeholder-val="{{{{ false }}}}">
<nav id="site-menu" aria-label="Sections" style="position: fixed; inset: 0; z-index: 55; background: #000; display: flex; flex-direction: column; justify-content: center">
<div class="wrap" style="width: 100%">
<ul style="list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px">
<li style="overflow: hidden"><a class="rise" href="#sky-sentry" onClick="{{{{ closeMenu }}}}" style="font-size: clamp(64px, 12vw, 180px); line-height: .9; text-decoration: none; {DISP}">Sky Sentry</a></li>
<li style="overflow: hidden"><a class="rise" href="#echo" onClick="{{{{ closeMenu }}}}" style="font-size: clamp(64px, 12vw, 180px); line-height: .9; text-decoration: none; animation-delay: .06s; {DISP}">Echo</a></li>
<li style="overflow: hidden"><a class="rise" href="#about" onClick="{{{{ closeMenu }}}}" style="font-size: clamp(64px, 12vw, 180px); line-height: .9; text-decoration: none; animation-delay: .12s; {DISP}">About</a></li>
</ul>
<p style="margin: 40px 0 0; font-size: 16px; color: #8F8F8F">Livingston High School. LHS Swim. Hackathons and game jams.</p>
</div>
</nav>
</sc-if>

<section class="hero-scene" aria-labelledby="name-h" style="position: relative; height: 2600px; background: #000">
<div class="stage" style="perspective: 900px; perspective-origin: 50% 50%; background: radial-gradient(ellipse at 50% 50%, #2A0306 0%, #0B0001 48%, #000 100%)">
<div class="th" aria-hidden="true" style="position: absolute; inset: 0; transform-style: preserve-3d; --z1: 2800px">
<div style="position: absolute; left: 50%; top: 50%; width: 1400px; height: 1400px; margin: -700px 0 0 -700px; border-radius: 50%; background: radial-gradient(circle, #FFE3D9 0%, #FF2D2D 15%, rgba(170,0,10,.5) 36%, rgba(120,0,0,0) 66%); transform: translateZ(-3400px)"></div>
{''.join(reversed(rings))}
{''.join(motes)}
</div>
<div aria-hidden="true">
<div class="pulse" style="animation-delay: .3s"></div>
<div class="pulse" style="animation-delay: 1.5s"></div>
<div class="pulse" style="animation-delay: 2.7s"></div>
<sc-if value="{{{{ s0 }}}}" hint-placeholder-val="{{{{ false }}}}"><div class="pulse once" style="animation-duration: 2.6s"></div></sc-if>
<sc-if value="{{{{ s1 }}}}" hint-placeholder-val="{{{{ false }}}}"><div class="pulse once" style="animation-duration: 2.6s"></div></sc-if>
<sc-if value="{{{{ s2 }}}}" hint-placeholder-val="{{{{ false }}}}"><div class="pulse once" style="animation-duration: 2.6s"></div></sc-if>
</div>
<div aria-hidden="true" style="position: absolute; inset: 0; pointer-events: none; background: radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 45%, rgba(0,0,0,.8) 100%)"></div>
<div class="th1" style="position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: center; background: linear-gradient(180deg, rgba(0,0,0,0) 35%, rgba(0,0,0,.72) 62%, rgba(0,0,0,.4) 85%); --z1: 520px; --o1: 0">
<div class="wrap" style="width: 100%">
<h1 id="name-h" style="margin: 0; font-size: clamp(76px, 17vw, 290px); line-height: .82; {DISP}">
<span style="display: block; overflow: hidden"><span class="rise" style="animation-delay: 2.05s">Shreyansh</span></span>
<span style="display: block; overflow: hidden; text-align: right"><span class="rise" style="animation-delay: 2.15s; color: {RED}">Nikam</span></span>
</h1>
<div style="margin-top: 36px; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-end; gap: 24px">
<p style="margin: 0; max-width: 30em; font-size: clamp(17px, 1.5vw, 20px); line-height: 1.5; color: #D6D6D6">I’m a freshman at Livingston High School. I build software at hackathons and game jams with a few friends, and in the last few months that has earned a first-place finish and two sponsor awards.</p>
<div style="display: flex; flex-wrap: wrap; align-items: center; gap: 18px">
<button type="button" class="ping-btn" onClick="{{{{ sendPing }}}}">Send a ping</button>
<span style="font-size: 14px; color: #9A9A9A">Scroll to fly through the Hollow</span>
</div>
</div>
</div>
</div>
</div>
</section>

<section aria-label="Tools I’ve built with" style="position: relative; background: #000; padding: 40px 0; overflow: hidden">
<div style="transform: rotate(-2deg); margin: 0 -40px; background: {RED2}; color: #000; padding: 18px 0">
<div class="marq" style="font-size: clamp(36px, 5vw, 64px); line-height: 1; {DISP}">{marq_items()}{marq_items()}</div>
</div>
<div aria-hidden="true" style="transform: rotate(1.5deg); margin: -6px -40px 0; border-top: 1px solid #2A2A2A; border-bottom: 1px solid #2A2A2A; color: #5E5E5E; padding: 14px 0">
<div class="marq rev" style="font-size: clamp(28px, 3.4vw, 44px); line-height: 1; {DISP}">{marq_items()}{marq_items()}</div>
</div>
</section>

<section aria-label="How I work" style="position: relative; background: #000; padding: 140px 0 120px">
<div class="wrap">
<p style="margin: 0; max-width: 18em; font-size: clamp(34px, 4.6vw, 68px); line-height: 1.08; font-weight: 700; font-stretch: 88%; color: #FFFFFF">{' '.join(words)}</p>
</div>
</section>

<section aria-labelledby="results-h" style="position: relative; background: #000; padding: 40px 0 160px">
<div class="wrap">
<div style="display: flex; justify-content: space-between; align-items: baseline; gap: 24px; border-bottom: 1px solid #2A2A2A; padding-bottom: 20px">
<h2 id="results-h" style="margin: 0; font-size: 18px; font-weight: 700; color: #FFFFFF">Results</h2>
<span style="font-size: 15px; color: #8F8F8F">Fall 2026</span>
</div>
<ul style="list-style: none; margin: 0; padding: 0">
{row('01','1st place','HackHaven, the Hack Club Haven game jam at Princeton','#echo','Echo','entry 0% cover 30%')}
{row('02','Best Use of Solana','HackPHS sponsor award, for my report-stamping work','#sky-sentry','Sky Sentry','entry 5% cover 35%')}
{row('03','Best Use of Tiger Data','HackPHS sponsor award, for Pranav’s server and database work','#sky-sentry','Sky Sentry','entry 10% cover 40%')}
</ul>
</div>
</section>

<section id="sky-sentry" class="sky-scene" aria-labelledby="sky-h" style="position: relative; height: 2600px; background: #000">
<div class="stage" style="background: #000">
<div aria-hidden="true" style="position: absolute; inset: 0; background: linear-gradient(to bottom, #000 0%, #070000 28%, #220003 44%, #6E0610 54%, #D3121E 61%, #FF5B3A 64%)"></div>
<div class="dusk" aria-hidden="true" style="position: absolute; inset: 0; opacity: 0; background: linear-gradient(to bottom, rgba(0,0,0,.8), rgba(0,0,0,.5) 50%, rgba(0,0,0,.15) 64%)"></div>
<div class="dusk" aria-hidden="true" style="position: absolute; inset: 0; opacity: 0">{stars}</div>
<div class="ts" aria-hidden="true" style="position: absolute; left: 62%; top: 64%; width: 360px; height: 360px; margin: -180px 0 0 -180px; border-radius: 50%; background: radial-gradient(circle, #FFE9E0 0%, #FF6A4A 26%, rgba(255,45,45,.6) 44%, rgba(255,45,45,0) 70%); --y0: -150px; --y1: 140px"></div>
<div aria-hidden="true" style="position: absolute; left: 0; right: 0; top: 64%; bottom: 0; background: linear-gradient(to bottom, #140002, #000 55%)"></div>
<div aria-hidden="true" style="position: absolute; left: 0; right: 0; top: 64%; bottom: 0; perspective: 420px; perspective-origin: 50% 0%; overflow: hidden">
<div style="position: absolute; left: 50%; margin-left: -280px; bottom: -20px; width: 560px; height: 1600px; transform-origin: 50% 100%; transform: rotateX(78deg); background: #0E0E10; border-left: 6px solid #EDEDED; border-right: 6px solid #EDEDED; overflow: hidden">
<div class="ts" style="position: absolute; left: 50%; top: -1040px; width: 12px; margin-left: -6px; height: 2600px; background: repeating-linear-gradient(to bottom, #FFFFFF 0 70px, transparent 70px 130px); --y1: 1040px"></div>
<div style="position: absolute; left: 30px; right: 30px; bottom: 30px; height: 90px; background: repeating-linear-gradient(90deg, #FFFFFF 0 22px, transparent 22px 44px)"></div>
{edge}
{strobes}
</div>
</div>
{flock('8%','20%',140,'#000','-80px','520px','0px','80px','.8')}
{flock('46%','12%',110,'#1A0000','-160px','420px','20px','140px','.65')}
{flock('14%','42%',300,'#000','-320px','760px','-140px','160px','.9')}
<div class="ts1 wrap" style="position: absolute; left: 0; right: 0; top: 14%; --y0: 140px; --o0: 0; --s0: .9">
<h2 id="sky-h" style="margin: 0; font-size: clamp(80px, 16vw, 270px); line-height: .82; {DISP}; color: #FFFFFF">Sky Sentry</h2>
<p style="margin: 20px 0 0; max-width: 30em; font-size: clamp(17px, 1.5vw, 21px); line-height: 1.5; color: #FFFFFF">Warns airport towers about birds and drones near a runway. Built at HackPHS with Atharv, Pranav and Vivan.</p>
</div>
<div role="status" class="wrap" style="position: absolute; left: 0; right: 0; bottom: 6%">
<div style="position: relative; max-width: 460px; height: 132px">
<div class="s-g" style="position: absolute; inset: 0; border-radius: 6px; background: #2FBF71; color: #04210F; padding: 22px 24px">
<p style="margin: 0; font-size: 15px; font-weight: 700">Green</p><p style="margin: 6px 0 0; font-size: 21px; line-height: 1.3; font-weight: 600">Few objects. Nothing heading for the runway.</p></div>
<div class="s-y" style="position: absolute; inset: 0; opacity: 0; border-radius: 6px; background: #FFC83D; color: #2A1D00; padding: 22px 24px">
<p style="margin: 0; font-size: 15px; font-weight: 700">Yellow</p><p style="margin: 6px 0 0; font-size: 21px; line-height: 1.3; font-weight: 600">More objects, or one closing in. Worth watching.</p></div>
<div class="s-r" style="position: absolute; inset: 0; border-radius: 6px; background: {RED2}; color: #FFFFFF; padding: 22px 24px; box-shadow: 0 20px 70px -16px {RED}">
<p style="margin: 0; font-size: 15px; font-weight: 700">Red, spoken aloud in the tower</p><p style="margin: 6px 0 0; font-size: 21px; line-height: 1.3; font-weight: 600">“Flock of six birds, heading toward the runway.”</p></div>
</div>
</div>
<div aria-hidden="true" style="position: absolute; inset: 0; pointer-events: none; background: radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 55%, rgba(0,0,0,.6) 100%)"></div>
</div>
</section>

<section aria-labelledby="sky-how" style="position: relative; background: #000; padding: 140px 0 128px">
<div class="wrap">
<h3 id="sky-how" class="vs" style="margin: 0 0 36px; font-size: clamp(48px, 7vw, 110px); line-height: .85; {DISP}; --y0: 40px; --o0: 0">How it works</h3>
<ol style="list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 16px; perspective: 1400px">
{step('01','Phone camera','A phone pointed at the sky, running our native iPhone app or any phone browser.','entry 0% cover 40%')}
{step('02','Server','Finds birds and drones, tracks them, spots flocks, and rates the situation green, yellow or red.','entry 6% cover 46%')}
{step('03','Tower dashboard','A live map of each camera’s view, an hourly chart, incident reports, spoken alerts and typed questions.','entry 12% cover 52%')}
{step('04','Arduino beacon','Lights LEDs, beeps faster as the object gets closer, and points a servo at the threat.','entry 18% cover 58%')}
</ol>
<div style="margin-top: 140px; display: flex; flex-wrap: wrap; gap: 32px 64px">
<div class="vs" style="flex: 1 1 300px; max-width: 420px; --x0: -60px; --o0: 0">
<h3 style="margin: 0; font-size: clamp(52px, 6vw, 96px); line-height: .85; {DISP}">My part<span style="color: {RED}">:</span> the AI and voice pipeline</h3>
<p style="margin: 24px 0 0; font-size: 17px; line-height: 1.6; color: #A8A8A8">About 1,300 lines across 16 files, with tests and a mock camera-and-tower setup. The whole thing still runs without API keys, using template reports and honest status messages.</p>
</div>
<div class="vs" style="flex: 999 1 520px; min-width: 0; display: flex; flex-direction: column; --x0: 60px; --o0: 0">
{part(H4('Incident reports'),'Gemini looks at the camera snapshot and writes a short report. If it fails, the next step takes over, so a report always gets written.',f'<ol style="list-style: none; margin: 18px 0 0; padding: 0; display: flex; flex-wrap: wrap; gap: 8px; font-size: 15px; font-weight: 700"><li style="background: {RED2}; color: #FFFFFF; padding: 10px 16px; border-radius: 999px">1. Gemini</li><li style="background: #5A0A10; color: #FFFFFF; padding: 10px 16px; border-radius: 999px">2. Backup model</li><li style="background: #FFFFFF; color: #000; padding: 10px 16px; border-radius: 999px">3. Template</li></ol>')}
{part(H4('Spoken alerts'),'ElevenLabs turns a red alert into audio in about half a second. If it fails, the browser’s own voice takes over. Alerts are rate-limited so towers don’t get flooded.')}
{part(f'<div style="display: flex; flex-wrap: wrap; gap: 8px 14px; align-items: center; margin-bottom: 10px"><h4 style="margin: 0; font-size: 26px; line-height: 1; font-weight: 800; font-stretch: 70%; text-transform: uppercase">Solana stamps</h4><span style="font-size: 13px; font-weight: 700; background: {RED2}; color: #FFFFFF; padding: 5px 12px; border-radius: 999px">Won Best Use of Solana</span></div>','For drone incidents, I hash the report with SHA-256 and write the hash to the Solana devnet as a memo. Anyone can check later that the report wasn’t changed.')}
{part(H4('Ask SkySentry'),'Answers typed questions using only the last seven days of hourly data, and says “I don’t have data on that” when it doesn’t know. I also added the “In action” video section to the landing page.',last=True)}
</div>
</div>
<h3 style="margin: 120px 0 24px; font-size: 18px; font-weight: 700">The rest of the team</h3>
<ul style="list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 24px 40px; font-size: 16px; line-height: 1.55; color: #A8A8A8">
<li style="flex: 1 1 280px"><strong style="color: #FFFFFF">Pranav</strong> built the server on DigitalOcean with Tiger Data, a time-series database that rolls detections into hourly totals, plus MongoDB and Clerk sign-in. That won Best Use of Tiger Data.</li>
<li style="flex: 1 1 280px"><strong style="color: #FFFFFF">Vivan</strong> built the detection engine for motion, tracking, wingbeat and flocks, with benchmarks and a testing log, and the Arduino beacon.</li>
<li style="flex: 1 1 280px"><strong style="color: #FFFFFF">Atharv</strong> built the website, the 3D landing-page film and the native iPhone app.</li>
</ul>
</div>
</section>

<section id="echo" class="echo-scene" aria-labelledby="echo-h" style="position: relative; height: 2800px; background: #000">
<div class="stage" style="perspective: 600px; perspective-origin: 50% 50%; background: #000">
<div class="te" aria-hidden="true" style="position: absolute; inset: 0; transform-style: preserve-3d; --z1: 1500px">
<div style="position: absolute; left: 0; top: 0; width: 3000px; height: 100%; transform-origin: 0 50%; transform: rotateY(90deg); background: repeating-linear-gradient(90deg, #1A0204 0 140px, #0B0001 140px 210px, #240307 210px 300px, #070000 300px 360px); overflow: hidden"><div class="sweep" style="position: absolute; inset: 0; background: linear-gradient(90deg, rgba(255,45,45,0) 0%, rgba(255,45,45,.7) 6%, rgba(255,45,45,0) 14%)"></div></div>
<div style="position: absolute; right: 0; top: 0; width: 3000px; height: 100%; transform-origin: 100% 50%; transform: rotateY(-90deg); background: repeating-linear-gradient(270deg, #1A0204 0 160px, #0B0001 160px 220px, #240307 220px 320px, #070000 320px 370px); overflow: hidden"><div class="sweep" style="position: absolute; inset: 0; background: linear-gradient(270deg, rgba(255,45,45,0) 0%, rgba(255,45,45,.7) 6%, rgba(255,45,45,0) 14%); animation-direction: reverse"></div></div>
<div style="position: absolute; left: 0; bottom: 0; width: 100%; height: 3000px; transform-origin: 50% 100%; transform: rotateX(90deg); background: repeating-linear-gradient(0deg, #050000 0 120px, #140103 120px 180px)"></div>
<div style="position: absolute; left: 0; top: 0; width: 100%; height: 3000px; transform-origin: 50% 0; transform: rotateX(-90deg); background: repeating-linear-gradient(180deg, #030000 0 150px, #120103 150px 200px)"></div>
</div>
<div aria-hidden="true" style="position: absolute; inset: 0; pointer-events: none; background: radial-gradient(circle at 50% 50%, #000 0%, rgba(0,0,0,.85) 12%, rgba(0,0,0,0) 38%)"></div>
<div aria-hidden="true"><div class="pulse" style="animation-delay: .2s"></div><div class="pulse" style="animation-delay: 2s"></div></div>
<div class="te1" style="position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 0 20px; --s0: 1.8; --o0: 0; --z0: -400px">
<h2 id="echo-h" style="margin: 0; font-size: clamp(120px, 26vw, 420px); line-height: .8; {DISP}; color: {RED}; text-shadow: 0 0 80px rgba(255,45,45,.6)">Echo</h2>
<p style="margin: 24px 0 0; max-width: 30em; font-size: clamp(17px, 1.5vw, 21px); line-height: 1.5; color: #EDEDED">First place at HackHaven, the Hack Club Haven game jam at Princeton. A first-person stealth-horror game in Godot 4, made with Atharv and Elias. The theme was “Bounce Back.”</p>
</div>
<div aria-hidden="true" style="position: absolute; inset: 0; display: grid; grid-template-columns: repeat({COLS}, minmax(0, 1fr)); grid-template-rows: repeat({ROWS}, minmax(0, 1fr)); perspective: 1200px; pointer-events: none">
{''.join(tiles)}
</div>
</div>
</section>

<section aria-label="About Echo" style="position: relative; background: #000; color: #EDEDED; padding: 128px 0 128px">
<div class="wrap">
<div style="display: flex; flex-wrap: wrap; gap: 40px 64px">
<div class="vs" style="flex: 1 1 420px; max-width: 36em; --y0: 60px; --o0: 0">
<p style="margin: 0 0 22px; font-size: 22px; line-height: 1.55">You play a cave explorer who falls into an old mine called the Hollow, and your lantern breaks. The only way to see is to make noise. Each ping sends out a ring of light that shows the walls for a moment.</p>
<p style="margin: 0 0 22px; font-size: 22px; line-height: 1.55">The tall, blind monsters called Listeners hunt by sound, so every ping also tells them where you are.</p>
<p style="margin: 0; font-size: 22px; line-height: 1.55; color: {RED}">The theme fits twice: an echo is sound bouncing back, and you’re bouncing back from the fall by climbing out.</p>
</div>
<div style="flex: 1 1 340px; display: flex; flex-direction: column; gap: 12px; font-size: 16px; line-height: 1.6; color: #A8A8A8; perspective: 1000px">
<div class="vs" style="background: #0E0E0E; border: 1px solid #222; border-radius: 4px; padding: 22px 24px; animation-range: entry 0% cover 40%; --ry0: 30deg; --o0: 0; --x0: 60px">{H4('What you can do')}<p style="margin: 0">Sneak, run, hold your breath, throw pebbles to distract monsters, whisper a quieter ping, and chalk-mark the walls. There’s an optional combat mode with hidden daggers.</p></div>
<div class="vs" style="background: #0E0E0E; border: 1px solid #222; border-radius: 4px; padding: 22px 24px; animation-range: entry 8% cover 48%; --ry0: 30deg; --o0: 0; --x0: 60px">{H4('How the Listeners hunt')}<p style="margin: 0">They patrol, stop to listen, investigate noises and chase you, then lose you after a few seconds.</p></div>
<div class="vs" style="background: #0E0E0E; border: 1px solid #222; border-radius: 4px; padding: 22px 24px; animation-range: entry 16% cover 56%; --ry0: 30deg; --o0: 0; --x0: 60px">{H4('What’s in it')}<p style="margin: 0">Two levels, including The Flooded Deep, plus cutscenes, a map, voice-log story pieces, key rebinding, controller support and a ranking system. Audio from CC0 libraries, textures from Poly Haven, props from KayKit, and a custom 3D monster.</p></div>
</div>
</div>
<div style="margin-top: 112px; padding-top: 44px; border-top: 1px solid #2A2A2A; display: flex; flex-wrap: wrap; gap: 32px 64px">
<div style="flex: 1 1 300px; max-width: 420px">
<h3 style="margin: 0; font-size: clamp(52px, 6vw, 96px); line-height: .85; {DISP}">My part</h3>
<p style="margin: 28px 0 10px; font-size: 17px; font-weight: 600">18 of about 89 commits</p>
<div role="img" aria-label="18 of about 89 commits, about one fifth" style="height: 10px; background: #1F1F1F; overflow: hidden">
<div style="width: 20.2%; height: 10px"><div class="draw" style="height: 10px; background: {RED}; box-shadow: 0 0 16px {RED}"></div></div>
</div>
</div>
<ul class="vs" style="flex: 999 1 480px; min-width: 0; margin: 0; padding: 0 0 0 20px; display: flex; flex-direction: column; gap: 16px; font-size: 18px; line-height: 1.6; --y0: 50px; --o0: 0">
<li>Gameplay systems, the menu and settings screens, level work, and the work that made the game run reliably.</li>
<li>The code cleanup on 14 November: I rewrote the scripts to be easier to read without changing how the game plays.</li>
<li>I ran the game in Godot after the changes to make sure nothing broke.</li>
</ul>
</div>
</div>
</section>

<section id="about" aria-labelledby="about-h" style="position: relative; background: #0A0A0A; padding: 140px 0 120px; border-top: 1px solid #1F1F1F">
<div class="wrap" style="display: flex; flex-wrap: wrap; gap: 48px 64px">
<div class="vs" style="flex: 1 1 340px; --y0: 60px; --o0: 0">
<h2 id="about-h" style="margin: 0 0 24px; font-size: clamp(52px, 6vw, 96px); line-height: .85; {DISP}">Outside the hackathons</h2>
<p style="margin: 0 0 24px; font-size: 19px; line-height: 1.6; max-width: 30em; color: #C4C4C4">I’m on the LHS swim team. This year I’m taking:</p>
<ul style="list-style: none; margin: 0; padding: 0; font-size: 19px; line-height: 1.5; border-top: 1px solid #2A2A2A">
<li style="padding: 14px 0; border-bottom: 1px solid #2A2A2A">English 1 Honors</li>
<li style="padding: 14px 0; border-bottom: 1px solid #2A2A2A">Modern World History Honors</li>
<li style="padding: 14px 0; border-bottom: 1px solid #2A2A2A">Geometry Honors</li>
<li style="padding: 14px 0; border-bottom: 1px solid #2A2A2A">Biology Honors</li>
<li style="padding: 14px 0; border-bottom: 1px solid #2A2A2A">French 2 CP</li>
</ul>
</div>
<div class="vs" style="flex: 1 1 400px; animation-range: entry 10% cover 50%; --y0: 60px; --o0: 0">
<h2 style="margin: 0 0 24px; font-size: clamp(52px, 6vw, 96px); line-height: .85; {DISP}">What these show</h2>
<div style="display: flex; flex-direction: column; gap: 24px; font-size: 19px; line-height: 1.6; max-width: 32em; color: #C4C4C4">
<p style="margin: 0">I can work with different teams on very different projects, from an AI and blockchain backend to a game engine.</p>
<p style="margin: 0">I like building something that works end to end, and I test it before I call it done.</p>
<p style="margin: 0">I do all of this on top of honors classes and swim practice.</p>
</div>
</div>
</div>
</section>

<footer style="position: relative; background: #000; padding: 64px 0 0; overflow: hidden">
<div class="wrap" style="display: flex; flex-wrap: wrap; justify-content: space-between; gap: 16px; font-size: 15px; color: #8F8F8F">
<span>Built with Atharv, Pranav, Vivan and Elias.</span>
<a href="#top" style="padding: 10px 0; color: #FFFFFF">Back to top</a>
</div>
<p aria-hidden="true" class="vs" style="margin: 24px 0 -0.12em; text-align: center; white-space: nowrap; font-size: 20.5vw; line-height: .9; {DISP}; color: {RED}; --y0: 120px; --o0: 0; animation-range: entry 0% cover 30%">Shreyansh</p>
</footer>
</main>'''

script=r'''<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":1440,"height":13600}}'>
class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { s0: false, s1: false, s2: false, menu: false };
    this.n = 0;
    this.mx = -100; this.my = -100; this.rx = -100; this.ry = -100;
    this.setRing = (el) => { this.ring = el; };
    this.onMove = (e) => {
      this.mx = e.clientX; this.my = e.clientY;
      if (this.ring) this.ring.style.opacity = '1';
    };
    this.tick = () => {
      this.rx += (this.mx - this.rx) * 0.18;
      this.ry += (this.my - this.ry) * 0.18;
      if (this.ring) this.ring.style.transform = 'translate3d(' + this.rx + 'px,' + this.ry + 'px,0)';
      this.raf = requestAnimationFrame(this.tick);
    };
    this.toggleMenu = () => this.setState({ menu: !this.state.menu });
    this.closeMenu = () => this.setState({ menu: false });
    this.sendPing = () => {
      const key = 's' + (this.n++ % 3);
      this.setState({ [key]: false });
      setTimeout(() => this.setState({ [key]: true }), 30);
      setTimeout(() => this.setState({ [key]: false }), 2700);
    };
  }
  componentDidMount() {
    const mm = window.matchMedia;
    if (mm && mm('(pointer: fine)').matches && !mm('(prefers-reduced-motion: reduce)').matches) {
      window.addEventListener('mousemove', this.onMove, { passive: true });
      this.raf = requestAnimationFrame(this.tick);
    }
  }
  componentWillUnmount() {
    window.removeEventListener('mousemove', this.onMove);
    if (this.raf) cancelAnimationFrame(this.raf);
  }
  renderVals() {
    return {
      s0: this.state.s0, s1: this.state.s1, s2: this.state.s2,
      menu: this.state.menu,
      menuExp: this.state.menu ? 'true' : 'false',
      menuLabel: this.state.menu ? 'Close' : 'Menu',
      toggleMenu: this.toggleMenu, closeMenu: this.closeMenu,
      sendPing: this.sendPing, setRing: this.setRing
    };
  }
}
</script>'''

html=f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Shreyansh Nikam: hackathon and game jam projects</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,100..900&amp;display=swap">
<style>{css}</style>
</helmet>
{body}
</x-dc>
{script}
</body>
</html>
'''
open(OUT,'w').write(html); print(len(html))
