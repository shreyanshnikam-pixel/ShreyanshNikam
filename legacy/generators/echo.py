from common import *
from three import *
from echo3d import HOW_FLY, AWARDS

FONTS = 'family=Big+Shoulders+Stencil:opsz,wght@10..72,500..900&family=Special+Elite&family=Geist:wght@300..700&family=Geist+Mono:wght@400..600'
CSS = THREE_CSS + """
.st{font-family:'Big Shoulders Stencil',Geist,sans-serif}
.tw{font-family:'Special Elite','Courier New',monospace}
.mono{font-family:'Geist Mono',ui-monospace,monospace;letter-spacing:.03em}
.film{position:relative;height:15000px;background:#000}
.stage{position:sticky;top:0;height:100vh;height:100svh;min-height:520px;width:100%;overflow:hidden;background:#000}
.fstatus{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:4;opacity:0;transition:opacity .8s;pointer-events:none;font-family:'Special Elite',monospace;font-size:18px;color:#cfc6be}.fstatus.on{opacity:1}
.cap{position:absolute;left:0;right:0;bottom:18%;opacity:0;transform:translateY(16px);transition:opacity 1.1s ease,transform 1.4s cubic-bezier(.2,.8,.2,1);pointer-events:none;text-align:center}
.cap.on{opacity:1;transform:none}
.chap{opacity:.35;transition:opacity .3s}.chap.on{opacity:1;color:#FF3B30}
.pingbtn{position:relative;width:88px;height:88px;border-radius:50%;border:1.5px solid rgba(255,255,255,.7);background:rgba(0,0,0,.35);color:#FFFFFF;font:600 15px/1 Geist,sans-serif;cursor:pointer;transition:transform .15s cubic-bezier(.2,.8,.2,1),background .25s}
.pingbtn:hover{background:rgba(255,255,255,.12)}.pingbtn:active{transform:scale(.92)}
.pingbtn::after{content:"";position:absolute;inset:-1px;border-radius:50%;border:1.5px solid #FFFFFF;animation:pr 2.4s ease-out infinite}
@keyframes pr{0%{transform:scale(1);opacity:.7}100%{transform:scale(1.9);opacity:0}}
.soundbtn{min-height:44px;padding:0 18px;border-radius:999px;border:1px solid rgba(255,255,255,.35);background:rgba(0,0,0,.4);color:#FFFFFF;font:500 14px/1 Geist,sans-serif;cursor:pointer}
.soundbtn[aria-pressed=true]{background:#FF3B30;border-color:#FF3B30}
@keyframes ripple{0%{transform:scale(.1);opacity:.9}100%{transform:scale(1);opacity:0}}
.rip{position:absolute;left:50%;top:50%;width:300px;height:300px;margin:-150px 0 0 -150px;border-radius:50%;border:1.5px solid #FF3B30;animation:ripple 2.6s ease-out infinite}
@keyframes rip3{0%{transform:scale(.05);opacity:.95}100%{transform:scale(1);opacity:0}}
.move{transition:transform .35s cubic-bezier(.2,.8,.2,1),border-color .35s}.move:hover{transform:translateY(-6px);border-color:#FF3B30}
"""

CAPS = [
    ('You fell. Your lantern broke.', 'The only way to see is to make noise.'),
    ('Every ping lights the walls.', 'Press Ping, or wait for the next one. The chalk marks show where someone has been.'),
    ('Every ping also tells them where you are.', ''),
    ('Something is listening.', 'The Listener. Tall, blind, and hunting by sound.'),
    ('Hold your breath.', 'Do not ping. It is close. Keep scrolling, slowly.'),
    ('IT HEARD YOU.', ''),
]
LABELS = ['The fall', 'Ping', 'Exposed', 'The Listener', 'Hold', 'Caught']

def caps():
    out = []
    for i, (a, b) in enumerate(CAPS):
        if i == 5:
            out.append(f'<div class="cap {{{{ c{i} }}}}" aria-hidden="{{{{ h{i} }}}}" style="bottom: 40%"><p class="st" style="margin: 0; font-size: clamp(72px, 13vw, 220px); line-height: .85; font-weight: 900; color: #FF3B30; text-shadow: 0 0 60px rgba(255,40,30,.7)">{a}</p></div>')
        else:
            sub = f'<p class="tw" style="margin: 14px auto 0; max-width: 34em; font-size: clamp(16px, 1.5vw, 20px); line-height: 1.5; color: #CFC6BE">{b}</p>' if b else ''
            out.append(f'<div class="cap {{{{ c{i} }}}}" aria-hidden="{{{{ h{i} }}}}"><div class="wrap"><p class="tw" style="margin: 0; font-size: clamp(28px, 3.6vw, 54px); line-height: 1.1; color: #F2ECE6; text-shadow: 0 0 30px rgba(0,0,0,.9)">{a}</p>{sub}</div></div>')
    return '\n'.join(out)

ICONS = {
    'sneak': '<path d="M5 19c2-1 3-3 3-6M9 7a2 2 0 1 0 0-.01M10 9l3 4 4 1M13 13l-2 6"/>',
    'run': '<path d="M14 5a2 2 0 1 0 0-.01M9 21l3-6 3 2v4M6 12l3-3 4 1 2 3 3 1"/>',
    'breath': '<path d="M12 4v8M8 8c-3 1-4 4-4 7 0 2 2 3 4 2l2-2V9M16 8c3 1 4 4 4 7 0 2-2 3-4 2l-2-2V9"/>',
    'pebble': '<path d="M6 16c0-3 2-5 5-5s6 2 6 5-3 4-6 4-5-1-5-4zM15 6l3-2M18 9l3-1M12 5l1-3"/>',
    'whisper': '<path d="M4 12h3M9 9c1 2 1 4 0 6M13 7c2 3 2 7 0 10"/>',
    'chalk': '<path d="M6 6l12 12M18 6L6 18"/>',
}
MOVES = [('sneak', 'Sneak', 'Move quietly through the dark.'), ('run', 'Run', 'Move fast when you have to.'),
         ('breath', 'Hold your breath', 'Make no sound at all.'), ('pebble', 'Throw pebbles', 'Distract the monsters with noise somewhere else.'),
         ('whisper', 'Whisper ping', 'A quieter version of the ping.'), ('chalk', 'Chalk marks', 'Mark the walls as you go.')]

def move(k, t, d, i):
    return f'''<li class="move vs" style="padding: 26px 24px 28px; border-radius: 16px; background: #0D0909; border: 1px solid #2A1A1A; animation-range: entry {i*4}% cover {30+i*4}%; --y0: 50px; --o0: 0">
<svg aria-hidden="true" viewBox="0 0 24 24" style="width: 34px; height: 34px" fill="none" stroke="#FF3B30" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">{ICONS[k]}</svg>
<h4 class="st" style="margin: 18px 0 8px; font-size: 30px; line-height: 1; font-weight: 800; text-transform: uppercase">{t}</h4>
<p style="margin: 0; font-size: 15px; line-height: 1.55; color: #B5A9A6">{d}</p></li>'''

STATES = [('Patrol', 'Walks its route through the mine.'), ('Listen', 'Stops dead and listens.'), ('Investigate', 'Heads for the last noise it heard.'),
          ('Chase', 'Comes after you.'), ('Lose you', 'Loses you after a few seconds.')]

def state_row():
    out = []
    for i, (t, d) in enumerate(STATES):
        arrow = '' if i == 4 else '<svg aria-hidden="true" viewBox="0 0 40 24" class="hide-sm" style="flex: 0 0 34px; width: 34px; height: 24px; align-self: center"><path d="M2 12h34M28 5l8 7-8 7" fill="none" stroke="#5A3A38" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg>'
        hot = i == 3
        out.append(f'''<li class="vs" style="flex: 1 1 150px; padding: 20px 18px; border-radius: 14px; background: {'#FF3B30' if hot else '#120C0C'}; border: 1px solid {'#FF3B30' if hot else '#2A1A1A'}; animation-range: entry {i*5}% cover {30+i*5}%; --x0: -30px; --o0: 0">
<span class="mono" style="font-size: 12px; color: {'#FFE3E0' if hot else '#8C7774'}">{i+1:02d}</span>
<h4 class="st" style="margin: 8px 0 6px; font-size: 28px; font-weight: 800; text-transform: uppercase">{t}</h4>
<p style="margin: 0; font-size: 14px; line-height: 1.5; color: {'#FFF1EF' if hot else '#B5A9A6'}">{d}</p></li>{('<li aria-hidden="true" style="display: flex">' + arrow + '</li>') if arrow else ''}''')
    return ''.join(out)

BODY = f'''<main style="font-family: Geist, system-ui, sans-serif; color: #F2ECE6; background: #000; overflow-x: clip">
{nav('echo')}
<section class="film" ref="{{{{ filmRef }}}}" aria-label="Echo, an interactive walk through the mine. Scroll to move forward.">
<div class="stage">
<canvas ref="{{{{ canvasRef }}}}" role="img" aria-label="A first-person walk down a dark mine tunnel with timber supports and rails. Each sound ping sweeps a ring of light across the rock. The Listener, a tall eyeless creature with huge ears and a round toothed mouth, appears in the distance, walks closer in lantern light, and then lunges at the viewer." style="position: absolute; inset: 0; width: 100%; height: 100%; display: block"></canvas>
<p class="fstatus {{{{ statusOn }}}}" aria-live="polite">{{{{ status }}}}</p>
<div style="position: absolute; left: 0; right: 0; top: 74px; z-index: 5"><div class="wrap">
<div class="hide-sm" style="height: 2px; background: rgba(255,255,255,.14); overflow: hidden"><div ref="{{{{ barRef }}}}" style="height: 2px; background: #FF3B30; transform-origin: left center; transform: scaleX(0)"></div></div>
<div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 10px; margin-top: 10px">
<div class="hide-sm" style="display: flex; gap: 22px">{''.join(f'<span class="chap mono {{{{ c{i} }}}}" style="font-size: 11px; color: #BFB3AE">{l}</span>' for i, l in enumerate(LABELS))}</div>
<button type="button" class="soundbtn" aria-pressed="{{{{ soundPressed }}}}" onClick="{{{{ toggleSound }}}}">{{{{ soundLabel }}}}</button>
</div>
</div></div>
{caps()}
<div style="position: absolute; left: 50%; bottom: 30px; transform: translateX(-50%); z-index: 6; display: flex; flex-direction: column; align-items: center; gap: 10px">
<button type="button" class="pingbtn" onClick="{{{{ doPing }}}}">Ping</button>
</div>
<p class="mono" style="position: absolute; left: 0; right: 0; bottom: 6px; margin: 0; text-align: center; font-size: 11px; color: rgba(242,236,230,.45); z-index: 5">Contains a jump scare with a red flash and, with sound on, a loud scream. Reduced motion in your system settings skips it.</p>
</div>
</section>

<section aria-labelledby="echo-h" style="position: relative; padding: 120px 0 80px; min-height: 100vh; min-height: 100svh; box-sizing: border-box; display: flex; flex-direction: column; justify-content: center; background: radial-gradient(ellipse at 50% 0%, #2A0605 0%, #000 60%)">
<div class="wrap">
<p class="mono" style="margin: 0 0 20px; font-size: 13px; color: #FF3B30">Hack Club Haven, Princeton, November 2026</p>
<h1 id="echo-h" class="st vs" style="margin: 0; font-size: clamp(110px, 20vw, 330px); line-height: .78; font-weight: 900; color: #FF3B30; letter-spacing: .01em; text-shadow: 0 0 80px rgba(255,59,48,.35); --y0: 60px; --o0: 0">ECHO</h1>
<div style="margin-top: 40px; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-end; gap: 32px 64px">
<div style="max-width: 38em">
<p style="margin: 0 0 18px; font-size: clamp(20px, 1.9vw, 26px); line-height: 1.4; color: #F2ECE6">A first-person stealth-horror game in Godot 4. You fall into an old mine called the Hollow, your lantern breaks, and the only way to see is to make noise.</p>
<p style="margin: 0; font-size: 16px; color: #9C8D89">Built with Atharv Sharma and Elias Chen at Hack Haven Princeton 2026</p>
</div>
<div style="display: flex; flex-wrap: wrap; gap: 14px">
<a class="btn btn-red" href="https://burthebear.itch.io/echo-hack-haven-princeton">Play Echo</a>
<a class="btn btn-ghost" href="https://github.com/BurTheBear/HackHaven">View the code</a>
</div>
</div>
</div>
</section>

{HOW_FLY}
{AWARDS}
{footer()}
</main>
'''

JS = inject(open('/home/claude/gen/echo_comp.js').read())
SCRIPT = '''<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":1440,"height":21000}}'>\n''' + JS + '\n</script>'
html = head('Echo: enter the Hollow', FONTS, CSS, extra=('echo',)) + BODY + tail(SCRIPT)
open(OUTDIR + 'Echo.dc.html', 'w').write(html)
print('echo', len(html))
