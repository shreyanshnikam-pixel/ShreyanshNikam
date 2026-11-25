from common import *
from three import *
from sky3d import HOW_FLY, MINE_FLY, AWARDS

FONTS = 'family=Big+Shoulders:opsz,wght@10..72,300..900&family=Geist:wght@300..700&family=Geist+Mono:wght@400..600'
CSS = THREE_CSS + """
.bs{font-family:'Big Shoulders',Geist,sans-serif}
.mono{font-family:'Geist Mono',ui-monospace,monospace;letter-spacing:.03em}
.film{position:relative;height:30000px;background:#05070D}
.stage{position:sticky;top:0;height:100vh;height:100svh;min-height:520px;width:100%;overflow:hidden;background:#000}
.soundbtn{min-height:44px;padding:0 18px;border-radius:999px;border:1px solid rgba(255,255,255,.4);background:rgba(0,0,0,.45);color:#fff;font:500 14px/1 Geist,sans-serif;cursor:pointer;backdrop-filter:blur(6px)}.soundbtn[aria-pressed=true]{background:#FFB36B;border-color:#FFB36B;color:#140c04}
.fstatus{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:4;opacity:0;transition:opacity .8s;pointer-events:none;font:500 16px Geist,sans-serif;color:#cfd6e4}.fstatus.on{opacity:1}
.fsub{position:absolute;left:50%;bottom:11%;transform:translate(-50%,10px);width:min(92vw,980px);text-align:center;z-index:5;opacity:0;transition:opacity .6s ease,transform .8s cubic-bezier(.2,.8,.2,1);pointer-events:none}
.fsub[data-on="1"]{opacity:1;transform:translate(-50%,0)}
.fsub [data-who]{display:inline-block;margin-bottom:10px;font:600 12px/1 'Geist Mono',monospace;letter-spacing:.06em;color:#FFB36B}
.fsub[data-kind=alert] [data-who]{color:#fff;background:#FF3B30;padding:5px 8px;border-radius:3px}
.fsub[data-kind=caption] [data-who]{display:none}
.fsub [data-line]{display:block;font:500 clamp(19px,2vw,30px)/1.35 Geist,sans-serif;color:#fff;text-shadow:0 2px 14px rgba(0,0,0,.85),0 0 2px rgba(0,0,0,.9)}
.ftitle{position:absolute;left:0;right:0;top:50%;transform:translateY(-50%) scale(.98);margin:0;text-align:center;z-index:5;opacity:0;transition:opacity 1.4s ease,transform 2.4s cubic-bezier(.2,.8,.2,1);font-family:'Big Shoulders',Geist,sans-serif;font-weight:800;text-transform:uppercase;font-size:clamp(44px,7.5vw,128px);line-height:.92;color:#fff;padding:0 6vw;pointer-events:none}
.ftitle[data-on="1"]{opacity:1;transform:translateY(-50%) scale(1)}
.cap{position:absolute;left:0;right:0;bottom:12%;opacity:0;transform:translateY(24px);transition:opacity .6s cubic-bezier(.2,.8,.2,1),transform .8s cubic-bezier(.2,.8,.2,1);pointer-events:none}
.cap.on{opacity:1;transform:none}
.chap{opacity:.4;transition:opacity .3s,color .3s}.chap.on{opacity:1;color:#FFFFFF}
.step{transition:transform .35s cubic-bezier(.2,.8,.2,1),border-color .35s}.step:hover{transform:translateY(-6px);border-color:#FFB36B}
"""

CHAPTERS = [
    ('Runway 27. Last light.', 'An airliner turns onto final approach, four miles out.'),
    ('It isn’t alone.', 'A flock of six is drifting toward the approach path.'),
    ('The camera sees them.', 'A phone on a tripod streams frames to the server. Every bird gets a box, an ID and a track.'),
    ('Risk climbs.', 'Six birds, seconds from the approach corridor. Green, then yellow, then red.'),
    ('The tower hears it.', 'A spoken alert in about half a second, an incident report, and the drone report stamped on Solana.'),
    ('Go around.', 'The crew climbs away. The flock passes beneath.'),
    ('Sky Sentry', 'Built for the seconds that matter.'),
]
CH_LABELS = ['Approach', 'The flock', 'Detection', 'Risk', 'The tower', 'Go around', 'Sky Sentry']

def caps():
    out = []
    for i, (t, l) in enumerate(CHAPTERS):
        big = 'clamp(64px, 9vw, 150px)' if i == 6 else 'clamp(44px, 6vw, 96px)'
        out.append(f'''<div class="cap {{{{ c{i} }}}}" aria-hidden="{{{{ h{i} }}}}"><div class="wrap">
<p class="bs" style="margin: 0; font-size: {big}; line-height: .88; font-weight: 800; text-transform: uppercase; letter-spacing: -0.005em; color: #FFFFFF; text-shadow: 0 6px 40px rgba(0,0,0,.6)">{t}</p>
<p style="margin: 16px 0 0; max-width: 30em; font-size: clamp(17px, 1.6vw, 22px); line-height: 1.45; color: #E7EAF0; text-shadow: 0 2px 18px rgba(0,0,0,.8)">{l}</p>
</div></div>''')
    return '\n'.join(out)

def chap_labels():
    return ''.join(f'<span class="chap mono {{{{ c{i} }}}}" style="flex: 1 1 0; font-size: 11px; color: #AEB6C6; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{l}</span>' for i, l in enumerate(CH_LABELS))

def step(n, title, body, i):
    return f'''<li class="step vs" style="flex: 1 1 200px; padding: 28px 24px 30px; border-radius: 18px; background: #0E1426; border: 1px solid #1E2740; animation-range: entry {i*5}% cover {32+i*5}%; --y0: 50px; --o0: 0">
<span class="mono" style="font-size: 13px; color: #FFB36B">{n}</span>
<h3 class="bs" style="margin: 14px 0 10px; font-size: 32px; line-height: .95; font-weight: 800; text-transform: uppercase">{title}</h3>
<p style="margin: 0; font-size: 15px; line-height: 1.55; color: #A9B3C7">{body}</p></li>'''

def part(k, title, body, big, unit):
    return f'''<li class="vs" style="display: flex; flex-wrap: wrap; gap: 12px 40px; padding: 30px 0; border-top: 1px solid #1E2740; --y0: 40px; --o0: 0">
<div style="flex: 0 0 200px"><span class="bs" style="font-size: 64px; line-height: .9; font-weight: 800; color: #FFB36B">{big}</span><span class="mono" style="display: block; margin-top: 6px; font-size: 12px; color: #8A93A8">{unit}</span></div>
<div style="flex: 1 1 360px"><h3 style="margin: 0 0 8px; font-size: 22px; font-weight: 600">{title}</h3><p style="margin: 0; font-size: 17px; line-height: 1.6; color: #B7C0D2; max-width: 40em">{body}</p></div></li>'''

def award(title, sub, i, hot=False):
    bg = RED if hot else '#111830'
    return f'''<li class="vs" style="flex: 1 1 280px; min-height: 240px; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; gap: 30px; padding: 32px; border-radius: 24px; background: {bg}; border: 1px solid {'transparent' if hot else '#26304D'}; animation-range: entry {i*6}% cover {34+i*6}%; --rx0: 40deg; --y0: 80px; --o0: 0">
<svg aria-hidden="true" viewBox="0 0 24 24" style="width: 34px; height: 34px"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3" fill="none" stroke="#FFFFFF" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"></path></svg>
<div><h3 class="bs" style="margin: 0 0 8px; font-size: 44px; line-height: .9; font-weight: 800; text-transform: uppercase">{title}</h3><p style="margin: 0; font-size: 15px; line-height: 1.5; color: {'#FFE3E0' if hot else '#A9B3C7'}">{sub}</p></div></li>'''

BODY = f'''<main style="font-family: Geist, system-ui, sans-serif; color: #F2F4F8; background: #05070D; overflow-x: clip">
{nav('sky')}
<section class="film" ref="{{{{ filmRef }}}}" aria-label="Sky Sentry film. Scroll to play.">
<div class="stage">
<canvas ref="{{{{ canvasRef }}}}" role="img" aria-label="A two-part film at a 3D airfield at sunset. First, a 747 is cleared for takeoff, flies into a flock of Canada geese beside runway 27 and crashes. Then the same evening plays again with Sky Sentry: a phone camera spots the flock, the tower monitor flashes red mid-clearance, the controller holds the aircraft, the geese cross, and the 747 departs safely." style="position: absolute; inset: 0; width: 100%; height: 100%; display: block"></canvas>
<p class="fstatus {{{{ statusOn }}}}" aria-live="polite">{{{{ status }}}}</p>
<div class="fsub" ref="{{{{ subRef }}}}" data-on="0" aria-live="polite"><span data-who></span><span data-line></span></div>
<p class="ftitle" ref="{{{{ titleRef }}}}" data-on="0" aria-live="polite"></p>
<div class="hide-sm" style="position: absolute; left: 0; right: 0; top: 74px; z-index: 5"><div class="wrap">
<div style="height: 2px; background: rgba(255,255,255,.16); overflow: hidden"><div ref="{{{{ barRef }}}}" style="height: 2px; background: #FFB36B; transform-origin: left center; transform: scaleX(0)"></div></div>
</div></div>
<div class="wrap" style="position: absolute; left: 0; right: 0; bottom: 22px; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 8px 24px; z-index: 5">
<span class="mono" style="font-size: 11px; color: rgba(231,234,240,.6)">Dramatization: the crash, airline, radio calls and readings are fictional. Voices: Kokoro neural TTS. 747SP geometry: NASA.</span>
<div style="display: flex; align-items: center; gap: 18px"><button type="button" class="soundbtn" aria-pressed="{{{{ soundPressed }}}}" onClick="{{{{ toggleSound }}}}">{{{{ soundLabel }}}}</button><a href="#about-sky" style="font-size: 14px; font-weight: 600; color: #FFFFFF; padding: 12px 0">Skip the film</a></div>
</div>
</div>
</section>

<section id="about-sky" aria-labelledby="sky-h" style="position: relative; padding: 120px 0 80px; min-height: 100vh; min-height: 100svh; box-sizing: border-box; display: flex; flex-direction: column; justify-content: center; background: radial-gradient(ellipse at 70% 0%, #1A2448 0%, #05070D 60%)">
<div class="wrap">
<p class="mono" style="margin: 0 0 20px; font-size: 13px; color: #FFB36B">HackPHS 2026</p>
<h1 id="sky-h" class="bs vs" style="margin: 0; font-size: clamp(80px, 14vw, 230px); line-height: .82; font-weight: 900; text-transform: uppercase; letter-spacing: -0.01em; --y0: 60px; --o0: 0">Sky Sentry</h1>
<div style="margin-top: 36px; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-end; gap: 32px 64px">
<div style="max-width: 38em">
<p style="margin: 0 0 18px; font-size: clamp(20px, 1.9vw, 26px); line-height: 1.4; color: #E7EAF0">An early-warning system for birds and drones near runways. A phone camera watches the sky, the server finds what is flying, and the control tower hears the warning out loud.</p>
<p style="margin: 0; font-size: 16px; color: #8A93A8">Built with Atharv Sharma, Vivan Chowdhury, and Pranav Atreya at HackPHS 2026</p>
</div>
<div style="display: flex; flex-wrap: wrap; gap: 14px">
<a class="btn btn-red" href="https://lancerhacks-rvs8r.ondigitalocean.app">Open the live site</a>
<a class="btn btn-ghost" href="https://github.com/pranav-atreya10/hackphs-dot">View the code</a>
</div>
</div>
</div>
</section>

{HOW_FLY}
{MINE_FLY}
{AWARDS}
{footer()}
</main>
'''

JS = inject(open('/home/claude/gen/sky_comp.js').read())
SCRIPT = '''<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":1440,"height":36000}}'>\n''' + JS + '\n</script>'

html = head('Sky Sentry: a film', FONTS, CSS, extra=('sky',)) + BODY + tail(SCRIPT)
open(OUTDIR + 'SkySentry.dc.html', 'w').write(html)
print('sky', len(html))
