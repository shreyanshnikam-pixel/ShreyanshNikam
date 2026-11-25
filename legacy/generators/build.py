import random, math
random.seed(7)
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

rings=[]
for i in range(7):
    t=i/6; h=hole(i+3)
    fill=mix('#0F3742','#03111A',t); rim=f'{lerp(.95,.22,t):.2f}'
    rings.append(f'<svg aria-hidden="true" viewBox="0 0 1600 1000" style="position: absolute; left: 50%; top: 50%; width: 1600px; height: 1000px; margin: -500px 0 0 -800px; transform: translateZ({-i*500}px)"><path fill="{fill}" fill-rule="evenodd" d="M0 0H1600V1000H0Z {h}"></path><path d="{h}" fill="none" stroke="#FFB547" stroke-width="4" opacity="{rim}"></path></svg>')
motes=[]
for i in range(34):
    x=random.randint(-900,900); y=random.randint(-520,520); z=random.randint(-3200,-150)
    s=random.choice([3,4,5,6]); d=random.uniform(5,11); dl=random.uniform(-10,0)
    fx=random.randint(-30,30); fy=random.randint(-60,-20)
    motes.append(f'<div style="position: absolute; left: 50%; top: 50%; transform: translate3d({x}px, {y}px, {z}px)"><div class="float" style="width: {s}px; height: {s}px; border-radius: 50%; background: #FFD38A; box-shadow: 0 0 12px 2px rgba(255,181,71,.7); animation-duration: {d:.1f}s; animation-delay: {dl:.1f}s; --fx: {fx}px; --fy: {fy}px"></div></div>')
stars=[]
for i in range(46):
    x=random.uniform(1,99); y=random.uniform(2,46); s=random.choice([1.5,2,2,3]); d=random.uniform(2,5); dl=random.uniform(-5,0)
    stars.append(f'<div class="twinkle" style="position: absolute; left: {x:.1f}%; top: {y:.1f}%; width: {s}px; height: {s}px; border-radius: 50%; background: #FFFFFF; animation-duration: {d:.1f}s; animation-delay: {dl:.1f}s"></div>')
BIRDS='<path d="M0 10 q6 -7 12 0 q6 -7 12 0"></path><path d="M30 2 q6 -7 12 0 q6 -7 12 0"></path><path d="M34 22 q6 -7 12 0 q6 -7 12 0"></path><path d="M66 12 q6 -7 12 0 q6 -7 12 0"></path><path d="M96 4 q6 -7 12 0 q6 -7 12 0"></path><path d="M102 28 q6 -7 12 0 q6 -7 12 0"></path>'
def flock(left,top,w,col,x0,x1,y0,y1,dur):
    return f'<div class="ts" aria-hidden="true" style="position: absolute; left: {left}; top: {top}; --x0: {x0}; --x1: {x1}; --y0: {y0}; --y1: {y1}"><svg class="flap" viewBox="0 0 150 40" style="width: {w}px; animation-duration: {dur}s" fill="none" stroke="{col}" stroke-width="2.4" stroke-linecap="round">{BIRDS}</svg></div>'
edge=[]
for k in range(9):
    yy=60+k*150
    for side in ('left: -10px','right: -10px'):
        edge.append(f'<div style="position: absolute; {side}; top: {yy}px; width: 14px; height: 14px; border-radius: 50%; background: #FFE3A1; box-shadow: 0 0 24px 8px rgba(255,190,90,.75)"></div>')
strobes=''.join(f'<div class="strobe" style="position: absolute; left: 50%; bottom: {40+k*70}px; width: 16px; height: 16px; margin-left: -8px; border-radius: 50%; background: #FFFFFF; animation-delay: {(5-k)*0.1:.1f}s"></div>' for k in range(6))
blips=''.join(f'<div class="blip" style="position: absolute; left: {x}%; top: {y}%; width: 8px; height: 8px; border-radius: 50%; background: #5BE1FF; animation-delay: {d}s"></div>' for x,y,d in [(62,30,0),(68,36,.2),(58,40,.4),(70,26,.6),(64,44,.8),(55,33,1)])

def step(n,title,body,col,rng):
    return f'''<li class="vs" style="flex: 1 1 220px; background: #141C4E; border-radius: 20px; padding: 26px 24px 28px; border-top: 4px solid {col}; animation-range: {rng}; --ry0: -38deg; --z0: -160px; --o0: 0; --x0: -40px">
<span style="font-size: 15px; font-weight: 700; color: {col}">{n}</span>
<h4 style="margin: 8px 0 8px; font-size: 21px; font-weight: 700; color: #F4F7FF">{title}</h4>
<p style="margin: 0; font-size: 16px; line-height: 1.55; color: #B9C3E6">{body}</p>
</li>'''

def award(title,where,link,href,bg,fg,sub,rng):
    return f'''<li class="vs" style="flex: 1 1 300px; min-height: 300px; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; gap: 24px; padding: 32px; border-radius: 28px; background: {bg}; color: {fg}; box-shadow: 0 30px 80px -30px {bg}; animation-range: {rng}; --rx0: 62deg; --z0: -260px; --y0: 120px; --o0: 0">
<strong style="font-size: clamp(34px, 3.6vw, 48px); line-height: 1; font-weight: 800; font-stretch: 120%">{title}</strong>
<span style="display: flex; flex-direction: column; gap: 14px"><span style="font-size: 18px; line-height: 1.45; color: {sub}">{where}</span><a href="{href}" style="align-self: flex-start; font-size: 18px; font-weight: 700; padding: 10px 0">{link}</a></span>
</li>'''

def part(title,body,extra='',last=False):
    bb='' if last else 'border-bottom: 1px solid #27306A; '
    return f'''<div style="padding: 28px 0; {bb}">
{title}
<p style="margin: 0; font-size: 17px; line-height: 1.6; max-width: 36em; color: #C9D2F0">{body}</p>{extra}
</div>'''

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
<style>
body{{margin:0;background:#03090C}}
a{{color:inherit;text-underline-offset:4px}}a:hover{{opacity:.8}}
.wrap{{max-width:1200px;margin:0 auto;padding:0 48px;box-sizing:border-box;position:relative}}
.stage{{position:sticky;top:0;height:min(100vh,1000px);overflow:hidden}}
.hero-scene{{view-timeline-name:--hero}}.sky-scene{{view-timeline-name:--sky}}.echo-scene{{view-timeline-name:--echo}}
@keyframes pan{{from{{transform:translate3d(var(--x0,0px),var(--y0,0px),var(--z0,0px)) rotateX(var(--rx0,0deg)) rotateY(var(--ry0,0deg)) scale(var(--s0,1))}}to{{transform:translate3d(var(--x1,0px),var(--y1,0px),var(--z1,0px)) rotateX(var(--rx1,0deg)) rotateY(var(--ry1,0deg)) scale(var(--s1,1))}}}}
@keyframes fadev{{from{{opacity:var(--o0,1)}}to{{opacity:var(--o1,1)}}}}
@keyframes fin{{from{{opacity:0}}to{{opacity:1}}}}@keyframes fout{{from{{opacity:1}}to{{opacity:0}}}}@keyframes fio{{0%{{opacity:0}}15%,85%{{opacity:1}}100%{{opacity:0}}}}
@keyframes draw{{from{{transform:scaleX(0)}}to{{transform:scaleX(1)}}}}
@keyframes float{{0%,100%{{transform:translate3d(0,0,0)}}50%{{transform:translate3d(var(--fx,10px),var(--fy,-30px),0)}}}}.float{{animation:float 8s ease-in-out infinite}}
@keyframes pulse{{0%{{transform:scale(.03);opacity:.95}}100%{{transform:scale(1);opacity:0}}}}
.pulse{{position:absolute;left:50%;top:50%;width:1800px;height:1800px;margin:-900px 0 0 -900px;border-radius:50%;border:2px solid #FFB547;box-shadow:0 0 40px rgba(255,181,71,.35),inset 0 0 60px rgba(255,181,71,.2);pointer-events:none;transform:scale(.6);opacity:.2;animation:pulse 3.6s cubic-bezier(.15,.6,.3,1) infinite}}
.once{{animation-iteration-count:1;animation-fill-mode:both}}
@keyframes twinkle{{0%,100%{{opacity:.25}}50%{{opacity:1}}}}.twinkle{{animation:twinkle 3s ease-in-out infinite}}
@keyframes spin{{to{{transform:rotate(360deg)}}}}@keyframes flap{{0%,100%{{transform:scaleY(1)}}50%{{transform:scaleY(.35)}}}}.flap{{display:block;animation:flap .7s ease-in-out infinite;transform-origin:center}}
@keyframes strobe{{0%,6%{{opacity:1;box-shadow:0 0 26px 10px #fff}}14%,100%{{opacity:.12;box-shadow:none}}}}.strobe{{opacity:.12;animation:strobe 1.4s linear infinite}}
@keyframes blip{{0%,100%{{opacity:.15}}10%{{opacity:1}}}}.blip{{animation:blip 3s linear infinite}}
@keyframes sweep{{from{{transform:translateX(-30%)}}to{{transform:translateX(130%)}}}}.sweep{{animation:sweep 3.6s cubic-bezier(.2,.6,.4,1) infinite}}
@keyframes reveal{{0%{{color:#0B2A33;text-shadow:none}}100%{{color:#EAF6F7}}}}.reveal{{color:#EAF6F7;animation:reveal 1.3s ease-out both}}
.ping-btn{{font:600 17px/1 Archivo,sans-serif;font-stretch:112%;color:#1A0F02;background:#FFB547;border:0;border-radius:999px;padding:0 28px;min-height:50px;cursor:pointer;box-shadow:0 0 0 0 rgba(255,181,71,.6),0 10px 40px -10px #FFB547;transition:transform .16s cubic-bezier(.2,.8,.2,1),box-shadow .3s}}
.ping-btn:hover{{box-shadow:0 0 0 8px rgba(255,181,71,.18),0 10px 50px -8px #FFB547}}.ping-btn:active{{transform:scale(.95)}}
.ping-btn:focus-visible,a:focus-visible{{outline:3px solid #5BE1FF;outline-offset:3px}}
@supports (animation-timeline: view()){{@media (prefers-reduced-motion:no-preference){{
.th,.ts,.te{{animation:pan linear both}}.th1,.ts1,.te1,.vs{{animation:pan linear both,fadev linear both}}
.th{{animation-timeline:--hero;animation-range:contain 0% contain 100%}}.th1{{animation-timeline:--hero;animation-range:contain 0% contain 30%}}
.ts{{animation-timeline:--sky;animation-range:contain 0% contain 100%}}.ts1{{animation-timeline:--sky;animation-range:contain 0% contain 30%}}
.te{{animation-timeline:--echo;animation-range:contain 0% contain 100%}}.te1{{animation-timeline:--echo;animation-range:contain 0% contain 35%}}
.vs{{animation-timeline:view();animation-range:entry 0% cover 40%}}
.draw{{transform-origin:left center;animation:draw linear both;animation-timeline:view();animation-range:entry 20% cover 45%}}
.s-g{{animation:fout linear both;animation-timeline:--sky;animation-range:contain 28% contain 36%}}
.s-y{{animation:fio linear both;animation-timeline:--sky;animation-range:contain 28% contain 64%}}
.s-r{{animation:fin linear both;animation-timeline:--sky;animation-range:contain 56% contain 64%}}
.dusk{{animation:fin linear both;animation-timeline:--sky;animation-range:contain 10% contain 90%}}
}}}}
@media (max-width:720px){{.wrap{{padding:0 20px}}.radar{{display:none}}}}
@media (prefers-reduced-motion:reduce){{*,*::before,*::after{{animation:none !important;transition:none !important}}}}
</style>
</helmet>
<main style="font-family: Archivo, system-ui, sans-serif; color: #F4F7FF; background: #03090C; overflow-x: clip">

<section class="hero-scene" aria-labelledby="name-h" style="position: relative; height: 2600px; background: #03090C">
<div class="stage" style="perspective: 900px; perspective-origin: 50% 48%; background: radial-gradient(ellipse at 50% 48%, #0F3B46 0%, #062029 45%, #020809 100%)">
<div class="th" aria-hidden="true" style="position: absolute; inset: 0; transform-style: preserve-3d; --z1: 2800px">
<div style="position: absolute; left: 50%; top: 50%; width: 1400px; height: 1400px; margin: -700px 0 0 -700px; border-radius: 50%; background: radial-gradient(circle, #FFF1D2 0%, #FFB547 14%, rgba(255,138,76,.45) 34%, rgba(255,138,76,0) 66%); transform: translateZ(-3400px)"></div>
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
<div aria-hidden="true" style="position: absolute; inset: 0; pointer-events: none; background: radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 50%, rgba(0,0,0,.7) 100%)"></div>
<div class="th1" style="position: absolute; inset: 0; display: flex; flex-direction: column; background: linear-gradient(90deg, rgba(2,8,9,.78) 0%, rgba(2,8,9,.45) 45%, rgba(2,8,9,0) 70%); --z1: 520px; --o1: 0">
<nav aria-label="Sections" class="wrap" style="width: 100%; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 16px; padding-top: 26px; padding-bottom: 26px">
<span style="font-weight: 700; font-size: 17px; font-stretch: 112%">Shreyansh Nikam</span>
<span style="display: flex; flex-wrap: wrap; gap: 28px; font-size: 16px; color: #A9C7CC">
<a href="#sky-sentry" style="padding: 12px 0">Sky Sentry</a>
<a href="#echo" style="padding: 12px 0">Echo</a>
<a href="#about" style="padding: 12px 0">About</a>
</span>
</nav>
<div class="wrap" style="width: 100%; flex-grow: 1; display: flex; flex-direction: column; justify-content: center; padding-bottom: 80px">
<h1 id="name-h" style="margin: 0; font-size: clamp(48px, 11vw, 168px); line-height: .9; font-weight: 800; font-stretch: 125%; letter-spacing: -0.01em; text-shadow: 0 0 60px rgba(255,181,71,.35)">
<span class="reveal" style="display: block; animation-delay: .45s">Shreyansh</span>
<span class="reveal" style="display: block; animation-delay: .85s">Nikam</span>
</h1>
<p class="reveal" style="margin: 32px 0 0; max-width: 33em; font-size: clamp(18px, 1.6vw, 22px); line-height: 1.5; animation-delay: 1.3s">I’m a freshman at Livingston High School. I build software at hackathons and game jams with a few friends, and in the last few months that has earned a first-place finish and two sponsor awards.</p>
<div style="margin-top: 36px; display: flex; flex-wrap: wrap; align-items: center; gap: 20px">
<button type="button" class="ping-btn" onClick="{{{{ sendPing }}}}">Send a ping</button>
<span style="font-size: 15px; line-height: 1.5; color: #9FBFC4; max-width: 28em">Then scroll to fly through the Hollow, the mine from Echo.</span>
</div>
</div>
</div>
</div>
</section>

<section aria-labelledby="results-h" style="position: relative; background: #0A1030; padding: 120px 0 140px">
<div class="wrap">
<h2 id="results-h" class="vs" style="margin: 0 0 48px; font-size: clamp(40px, 6vw, 84px); line-height: .95; font-weight: 800; font-stretch: 125%; --y0: 60px; --o0: 0">Results</h2>
<ul style="list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 24px; perspective: 1200px">
{award('1st place','HackHaven, the Hack Club Haven game jam at Princeton','Echo','#echo','#FFB547','#1A0F02','#3D2706','entry 0% cover 40%')}
{award('Best Use of Solana','HackPHS sponsor award, for my report-stamping work','Sky Sentry','#sky-sentry','#6D5DFC','#FFFFFF','#E6E2FF','entry 8% cover 48%')}
{award('Best Use of Tiger Data','HackPHS sponsor award, for Pranav’s server and database work','Sky Sentry','#sky-sentry','#2DD4BF','#04201C','#0B3B34','entry 16% cover 56%')}
</ul>
</div>
</section>

<section id="sky-sentry" class="sky-scene" aria-labelledby="sky-h" style="position: relative; height: 2600px; background: #0B1440">
<div class="stage" style="perspective: 700px; perspective-origin: 50% 60%">
<div aria-hidden="true" style="position: absolute; inset: 0; background: linear-gradient(to bottom, #0B1440 0%, #2B2470 26%, #8E3B8C 44%, #E8566B 54%, #FF8A4C 60%, #FFC46B 64%)"></div>
<div class="dusk" aria-hidden="true" style="position: absolute; inset: 0; opacity: 0; background: linear-gradient(to bottom, rgba(6,10,40,.85), rgba(20,12,60,.55) 50%, rgba(40,10,40,.2) 64%)"></div>
<div class="dusk" aria-hidden="true" style="position: absolute; inset: 0; opacity: 0">{''.join(stars)}</div>
<div class="ts" aria-hidden="true" style="position: absolute; left: 60%; top: 64%; width: 340px; height: 340px; margin: -170px 0 0 -170px; border-radius: 50%; background: radial-gradient(circle, #FFF3D1 0%, #FFD27A 30%, rgba(255,160,80,.6) 46%, rgba(255,140,76,0) 70%); --y0: -150px; --y1: 140px"></div>
<div aria-hidden="true" style="position: absolute; left: 0; right: 0; top: 64%; bottom: 0; background: linear-gradient(to bottom, #1A1238, #07091C 60%)"></div>
<div aria-hidden="true" style="position: absolute; left: 0; right: 0; top: 64%; bottom: 0; perspective: 420px; perspective-origin: 50% 0%; overflow: hidden">
<div style="position: absolute; left: 50%; margin-left: -280px; bottom: -20px; width: 560px; height: 1600px; transform-origin: 50% 100%; transform: rotateX(78deg); background: #1B2038; border-left: 6px solid #E9EDF5; border-right: 6px solid #E9EDF5; overflow: hidden">
<div class="ts" style="position: absolute; left: 50%; top: -1040px; width: 12px; margin-left: -6px; height: 2600px; background: repeating-linear-gradient(to bottom, #FFFFFF 0 70px, transparent 70px 130px); --y1: 1040px"></div>
<div style="position: absolute; left: 30px; right: 30px; bottom: 30px; height: 90px; background: repeating-linear-gradient(90deg, #FFFFFF 0 22px, transparent 22px 44px)"></div>
{''.join(edge)}
{strobes}
</div>
</div>
{flock('8%','18%',140,'#2A1F4F','-80px','520px','0px','80px','.8')}
{flock('48%','10%',110,'#3A2A66','-160px','420px','20px','140px','.65')}
{flock('14%','40%',300,'#120C2B','-320px','760px','-140px','160px','.9')}
<div class="radar" aria-hidden="true" style="position: absolute; right: 5%; top: 9%; width: 200px; height: 200px; border-radius: 50%; border: 1px solid rgba(91,225,255,.6); background: radial-gradient(circle, rgba(91,225,255,.1), rgba(10,20,60,.4)); overflow: hidden">
<div style="position: absolute; inset: 24%; border-radius: 50%; border: 1px solid rgba(91,225,255,.35)"></div>
<div style="position: absolute; inset: 0; border-radius: 50%; background: conic-gradient(from 0deg, rgba(91,225,255,.55), rgba(91,225,255,0) 22%); animation: spin 3s linear infinite"></div>
{blips}
</div>
<div class="ts1 wrap" style="position: absolute; left: 0; right: 0; top: 12%; --y0: 140px; --o0: 0; --s0: .9">
<h2 id="sky-h" style="margin: 0; font-size: clamp(56px, 12vw, 190px); line-height: .9; font-weight: 800; font-stretch: 125%; color: #FFFFFF; text-shadow: 0 10px 60px rgba(232,86,107,.6)">Sky Sentry</h2>
<p style="margin: 24px 0 0; max-width: 30em; font-size: clamp(18px, 1.6vw, 22px); line-height: 1.5; color: #FFFFFF; text-shadow: 0 2px 16px rgba(20,10,50,.8)">Warns airport towers about birds and drones near a runway. Built at HackPHS with Atharv, Pranav and Vivan.</p>
</div>
<div role="status" class="wrap" style="position: absolute; left: 0; right: 0; bottom: 6%">
<div style="position: relative; max-width: 460px; height: 132px">
<div class="s-g" style="position: absolute; inset: 0; border-radius: 20px; background: #2FBF71; color: #04210F; padding: 22px 24px; box-shadow: 0 20px 60px -20px #2FBF71">
<p style="margin: 0; font-size: 15px; font-weight: 700">Green</p><p style="margin: 6px 0 0; font-size: 21px; line-height: 1.3; font-weight: 600">Few objects. Nothing heading for the runway.</p></div>
<div class="s-y" style="position: absolute; inset: 0; opacity: 0; border-radius: 20px; background: #FFC83D; color: #2A1D00; padding: 22px 24px; box-shadow: 0 20px 60px -20px #FFC83D">
<p style="margin: 0; font-size: 15px; font-weight: 700">Yellow</p><p style="margin: 6px 0 0; font-size: 21px; line-height: 1.3; font-weight: 600">More objects, or one closing in. Worth watching.</p></div>
<div class="s-r" style="position: absolute; inset: 0; border-radius: 20px; background: #D7263D; color: #FFFFFF; padding: 22px 24px; box-shadow: 0 20px 70px -16px #D7263D">
<p style="margin: 0; font-size: 15px; font-weight: 700">Red, spoken aloud in the tower</p><p style="margin: 6px 0 0; font-size: 21px; line-height: 1.3; font-weight: 600">“Flock of six birds, heading toward the runway.”</p></div>
</div>
</div>
<div aria-hidden="true" style="position: absolute; inset: 0; pointer-events: none; background: radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 55%, rgba(5,5,25,.55) 100%)"></div>
</div>
</section>

<section aria-labelledby="sky-how" style="position: relative; background: linear-gradient(to bottom, #0B1440, #0A0F2E); padding: 120px 0 128px">
<div class="wrap">
<h3 id="sky-how" class="vs" style="margin: 0 0 32px; font-size: clamp(30px, 3.4vw, 44px); font-weight: 800; font-stretch: 118%; --y0: 40px; --o0: 0">How it works</h3>
<ol style="list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 20px; perspective: 1400px">
{step(1,'Phone camera','A phone pointed at the sky, running our native iPhone app or any phone browser.','#5BE1FF','entry 0% cover 40%')}
{step(2,'Server','Finds birds and drones, tracks them, spots flocks, and rates the situation green, yellow or red.','#A78BFA','entry 6% cover 46%')}
{step(3,'Tower dashboard','A live map of each camera’s view, an hourly chart, incident reports, spoken alerts and typed questions.','#FF6B9A','entry 12% cover 52%')}
{step(4,'Arduino beacon','Lights LEDs, beeps faster as the object gets closer, and points a servo at the threat.','#FF8A4C','entry 18% cover 58%')}
</ol>

<div style="margin-top: 120px; display: flex; flex-wrap: wrap; gap: 32px 64px">
<div class="vs" style="flex: 1 1 300px; max-width: 400px; --x0: -60px; --o0: 0">
<h3 style="margin: 0; font-size: clamp(34px, 4vw, 56px); line-height: 1.02; font-weight: 800; font-stretch: 120%; color: #FFFFFF">My part: the AI and voice pipeline</h3>
<p style="margin: 22px 0 0; font-size: 17px; line-height: 1.6; color: #B9C3E6">About 1,300 lines across 16 files, with tests and a mock camera-and-tower setup. The whole thing still runs without API keys, using template reports and honest status messages.</p>
</div>
<div class="vs" style="flex: 999 1 520px; min-width: 0; display: flex; flex-direction: column; --x0: 60px; --o0: 0">
{part('<h4 style="margin: 0 0 8px; font-size: 21px; font-weight: 700; color: #5BE1FF">Incident reports</h4>','Gemini looks at the camera snapshot and writes a short report. If it fails, the next step takes over, so a report always gets written.','''
<ol style="list-style: none; margin: 18px 0 0; padding: 0; display: flex; flex-wrap: wrap; gap: 8px; font-size: 15px; font-weight: 700">
<li style="background: #5BE1FF; color: #04202A; padding: 10px 16px; border-radius: 999px">1. Gemini</li>
<li style="background: #A78BFA; color: #1A0B40; padding: 10px 16px; border-radius: 999px">2. Backup model</li>
<li style="background: #FFFFFF; color: #0A1030; padding: 10px 16px; border-radius: 999px">3. Template</li>
</ol>''')}
{part('<h4 style="margin: 0 0 8px; font-size: 21px; font-weight: 700; color: #FF6B9A">Spoken alerts</h4>','ElevenLabs turns a red alert into audio in about half a second. If it fails, the browser’s own voice takes over. Alerts are rate-limited so towers don’t get flooded.')}
{part('<div style="display: flex; flex-wrap: wrap; gap: 8px 14px; align-items: center; margin-bottom: 8px"><h4 style="margin: 0; font-size: 21px; font-weight: 700; color: #A78BFA">Solana stamps</h4><span style="font-size: 14px; font-weight: 700; background: #6D5DFC; color: #FFFFFF; padding: 5px 12px; border-radius: 999px">Won Best Use of Solana</span></div>','For drone incidents, I hash the report with SHA-256 and write the hash to the Solana devnet as a memo. Anyone can check later that the report wasn’t changed.')}
{part('<h4 style="margin: 0 0 8px; font-size: 21px; font-weight: 700; color: #FFB547">Ask SkySentry</h4>','Answers typed questions using only the last seven days of hourly data, and says “I don’t have data on that” when it doesn’t know. I also added the “In action” video section to the landing page.',last=True)}
</div>
</div>

<h3 style="margin: 112px 0 24px; font-size: 22px; font-weight: 700; font-stretch: 112%">The rest of the team</h3>
<ul style="list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 24px 40px; font-size: 16px; line-height: 1.55; color: #B9C3E6">
<li style="flex: 1 1 280px"><strong style="color: #FFFFFF">Pranav</strong> built the server on DigitalOcean with Tiger Data, a time-series database that rolls detections into hourly totals, plus MongoDB and Clerk sign-in. That won Best Use of Tiger Data.</li>
<li style="flex: 1 1 280px"><strong style="color: #FFFFFF">Vivan</strong> built the detection engine for motion, tracking, wingbeat and flocks, with benchmarks and a testing log, and the Arduino beacon.</li>
<li style="flex: 1 1 280px"><strong style="color: #FFFFFF">Atharv</strong> built the website, the 3D landing-page film and the native iPhone app.</li>
</ul>
</div>
</section>

<section id="echo" class="echo-scene" aria-labelledby="echo-h" style="position: relative; height: 2400px; background: #020709">
<div class="stage" style="perspective: 600px; perspective-origin: 50% 50%; background: #020709">
<div class="te" aria-hidden="true" style="position: absolute; inset: 0; transform-style: preserve-3d; --z1: 1500px">
<div style="position: absolute; left: 0; top: 0; width: 3000px; height: 100%; transform-origin: 0 50%; transform: rotateY(90deg); background: repeating-linear-gradient(90deg, #0B2B34 0 140px, #072029 140px 210px, #0E3540 210px 300px, #061A21 300px 360px); overflow: hidden"><div class="sweep" style="position: absolute; inset: 0; background: linear-gradient(90deg, rgba(255,181,71,0) 0%, rgba(255,181,71,.65) 6%, rgba(255,181,71,0) 14%)"></div></div>
<div style="position: absolute; right: 0; top: 0; width: 3000px; height: 100%; transform-origin: 100% 50%; transform: rotateY(-90deg); background: repeating-linear-gradient(270deg, #0B2B34 0 160px, #072029 160px 220px, #0E3540 220px 320px, #061A21 320px 370px); overflow: hidden"><div class="sweep" style="position: absolute; inset: 0; transform-origin: right; background: linear-gradient(270deg, rgba(255,181,71,0) 0%, rgba(255,181,71,.65) 6%, rgba(255,181,71,0) 14%); animation-direction: reverse"></div></div>
<div style="position: absolute; left: 0; bottom: 0; width: 100%; height: 3000px; transform-origin: 50% 100%; transform: rotateX(90deg); background: repeating-linear-gradient(0deg, #051419 0 120px, #08202A 120px 180px)"></div>
<div style="position: absolute; left: 0; top: 0; width: 100%; height: 3000px; transform-origin: 50% 0; transform: rotateX(-90deg); background: repeating-linear-gradient(180deg, #04121A 0 150px, #072029 150px 200px)"></div>
</div>
<div aria-hidden="true" style="position: absolute; inset: 0; pointer-events: none; background: radial-gradient(circle at 50% 50%, #000 0%, rgba(0,0,0,.85) 12%, rgba(0,0,0,0) 38%)"></div>
<div aria-hidden="true">
<div class="pulse" style="animation-delay: .2s"></div>
<div class="pulse" style="animation-delay: 2s"></div>
</div>
<div class="te1" style="position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 0 20px; --s0: 1.8; --o0: 0; --z0: -400px">
<h2 id="echo-h" style="margin: 0; font-size: clamp(80px, 16vw, 240px); line-height: .85; font-weight: 800; font-stretch: 125%; color: #FFB547; text-shadow: 0 0 80px rgba(255,181,71,.55), 0 0 20px rgba(255,181,71,.4)">Echo</h2>
<p style="margin: 28px 0 0; max-width: 30em; font-size: clamp(18px, 1.6vw, 22px); line-height: 1.5; color: #E6F1F2">First place at HackHaven, the Hack Club Haven game jam at Princeton. A first-person stealth-horror game in Godot 4, made with Atharv and Elias. The theme was “Bounce Back.”</p>
</div>
</div>
</section>

<section aria-label="About Echo" style="position: relative; background: linear-gradient(to bottom, #020709, #061A21); color: #E6F1F2; padding: 112px 0 128px">
<div class="wrap">
<div style="display: flex; flex-wrap: wrap; gap: 40px 64px">
<div class="vs" style="flex: 1 1 420px; max-width: 36em; --y0: 60px; --o0: 0">
<p style="margin: 0 0 20px; font-size: 21px; line-height: 1.6">You play a cave explorer who falls into an old mine called the Hollow, and your lantern breaks. The only way to see is to make noise. Each ping sends out a ring of light that shows the walls for a moment.</p>
<p style="margin: 0 0 20px; font-size: 21px; line-height: 1.6">The tall, blind monsters called Listeners hunt by sound, so every ping also tells them where you are.</p>
<p style="margin: 0; font-size: 21px; line-height: 1.6; color: #FFB547">The theme fits twice: an echo is sound bouncing back, and you’re bouncing back from the fall by climbing out.</p>
</div>
<div style="flex: 1 1 340px; display: flex; flex-direction: column; gap: 16px; font-size: 16px; line-height: 1.6; color: #A9C7CC; perspective: 1000px">
<div class="vs" style="background: #0A2730; border-radius: 20px; padding: 22px 24px; animation-range: entry 0% cover 40%; --ry0: 30deg; --o0: 0; --x0: 60px">
<h3 style="margin: 0 0 6px; font-size: 18px; font-weight: 700; color: #FFFFFF">What you can do</h3>
<p style="margin: 0">Sneak, run, hold your breath, throw pebbles to distract monsters, whisper a quieter ping, and chalk-mark the walls. There’s an optional combat mode with hidden daggers.</p>
</div>
<div class="vs" style="background: #0A2730; border-radius: 20px; padding: 22px 24px; animation-range: entry 8% cover 48%; --ry0: 30deg; --o0: 0; --x0: 60px">
<h3 style="margin: 0 0 6px; font-size: 18px; font-weight: 700; color: #FFFFFF">How the Listeners hunt</h3>
<p style="margin: 0">They patrol, stop to listen, investigate noises and chase you, then lose you after a few seconds.</p>
</div>
<div class="vs" style="background: #0A2730; border-radius: 20px; padding: 22px 24px; animation-range: entry 16% cover 56%; --ry0: 30deg; --o0: 0; --x0: 60px">
<h3 style="margin: 0 0 6px; font-size: 18px; font-weight: 700; color: #FFFFFF">What’s in it</h3>
<p style="margin: 0">Two levels, including The Flooded Deep, plus cutscenes, a map, voice-log story pieces, key rebinding, controller support and a ranking system. Audio from CC0 libraries, textures from Poly Haven, props from KayKit, and a custom 3D monster.</p>
</div>
</div>
</div>

<div style="margin-top: 104px; padding-top: 44px; border-top: 1px solid #16404A; display: flex; flex-wrap: wrap; gap: 32px 64px">
<div style="flex: 1 1 300px; max-width: 400px">
<h3 style="margin: 0; font-size: clamp(34px, 4vw, 56px); line-height: 1.02; font-weight: 800; font-stretch: 120%; color: #FFFFFF">My part</h3>
<p style="margin: 24px 0 10px; font-size: 17px; font-weight: 600">18 of about 89 commits</p>
<div role="img" aria-label="18 of about 89 commits, about one fifth" style="height: 14px; border-radius: 999px; background: #16404A; overflow: hidden">
<div style="width: 20.2%; height: 14px"><div class="draw" style="height: 14px; background: #FFB547; box-shadow: 0 0 16px #FFB547"></div></div>
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

<section id="about" aria-labelledby="about-h" style="position: relative; background: linear-gradient(to bottom, #FFC46B 0%, #FFD99A 30%, #EAF2FB 100%); color: #0B1B2E; padding: 128px 0 120px">
<div class="wrap" style="display: flex; flex-wrap: wrap; gap: 48px 64px">
<div class="vs" style="flex: 1 1 340px; --y0: 60px; --o0: 0">
<h2 id="about-h" style="margin: 0 0 20px; font-size: clamp(34px, 4vw, 56px); line-height: 1.02; font-weight: 800; font-stretch: 120%">Outside the hackathons</h2>
<p style="margin: 0 0 24px; font-size: 19px; line-height: 1.6; max-width: 30em">I’m on the LHS swim team. This year I’m taking:</p>
<ul style="list-style: none; margin: 0; padding: 0; font-size: 19px; line-height: 1.5; border-top: 1px solid rgba(11,27,46,.25)">
<li style="padding: 12px 0; border-bottom: 1px solid rgba(11,27,46,.25)">English 1 Honors</li>
<li style="padding: 12px 0; border-bottom: 1px solid rgba(11,27,46,.25)">Modern World History Honors</li>
<li style="padding: 12px 0; border-bottom: 1px solid rgba(11,27,46,.25)">Geometry Honors</li>
<li style="padding: 12px 0; border-bottom: 1px solid rgba(11,27,46,.25)">Biology Honors</li>
<li style="padding: 12px 0; border-bottom: 1px solid rgba(11,27,46,.25)">French 2 CP</li>
</ul>
</div>
<div class="vs" style="flex: 1 1 400px; animation-range: entry 10% cover 50%; --y0: 60px; --o0: 0">
<h2 style="margin: 0 0 20px; font-size: clamp(34px, 4vw, 56px); line-height: 1.02; font-weight: 800; font-stretch: 120%">What these show</h2>
<div style="display: flex; flex-direction: column; gap: 24px; font-size: 19px; line-height: 1.6; max-width: 32em">
<p style="margin: 0">I can work with different teams on very different projects, from an AI and blockchain backend to a game engine.</p>
<p style="margin: 0">I like building something that works end to end, and I test it before I call it done.</p>
<p style="margin: 0">I do all of this on top of honors classes and swim practice.</p>
</div>
</div>
</div>
</section>

<footer style="background: #0B1B2E; color: #A9B6CC; padding: 40px 0">
<div class="wrap" style="display: flex; flex-wrap: wrap; justify-content: space-between; gap: 12px; font-size: 15px">
<span style="color: #FFFFFF; font-weight: 700; font-stretch: 112%">Shreyansh Nikam</span>
<span>Built with Atharv, Pranav, Vivan and Elias.</span>
</div>
</footer>
</main>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{{"$preview":{{"width":1440,"height":11900}}}}'>
class Component extends DCLogic {{
  constructor(props) {{
    super(props);
    this.state = {{ s0: false, s1: false, s2: false }};
    this.n = 0;
  }}
  sendPing() {{
    const key = 's' + (this.n++ % 3);
    this.setState({{ [key]: false }});
    setTimeout(() => this.setState({{ [key]: true }}), 30);
    setTimeout(() => this.setState({{ [key]: false }}), 2700);
  }}
  renderVals() {{
    return {{
      s0: this.state.s0,
      s1: this.state.s1,
      s2: this.state.s2,
      sendPing: () => this.sendPing()
    }};
  }}
}}
</script>
</body>
</html>
'''
open(OUT,'w').write(html)
print(len(html))
