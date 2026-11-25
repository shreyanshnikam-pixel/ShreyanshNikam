from common import RED
from three import box, medal, fly_section, awards_scene

AMB = '#FFB36B'
K = lambda t: f'<p class="mono" style="margin: 0 0 16px; font-size: 13px; color: {AMB}">{t}</p>'
T = lambda t, size='clamp(52px, 6vw, 92px)': f'<h3 class="bs" style="margin: 0; font-size: {size}; line-height: .86; font-weight: 800; text-transform: uppercase; color: #FFFFFF">{t}</h3>'
B = lambda t: f'<p style="margin: 18px 0 0; max-width: 30em; font-size: 18px; line-height: 1.6; color: #C3CBDB">{t}</p>'

def stage(obj, h=420, rot='rotateX(-12deg) rotateY(-24deg)'):
    return f'<div class="p3 obj3d" style="flex: 1 1 380px; position: relative; height: {h}px"><div class="p3" style="position: absolute; left: 50%; top: 55%; width: 0; height: 0; transform: {rot}"><div class="p3 spinb" style="animation-duration: 18s">{obj}</div></div></div>'

def panel(step, title, body, obj, rot='rotateX(-12deg) rotateY(-24deg)'):
    return f'''<div style="display: flex; flex-wrap: wrap; align-items: center; gap: 20px 40px; padding: 48px 52px; border-radius: 28px; background: linear-gradient(160deg, rgba(16,22,42,.9), rgba(8,10,20,.9)); border: 1px solid rgba(255,255,255,.08); box-shadow: 0 60px 120px -40px #000">
<div style="flex: 1 1 380px">{K(step)}{T(title)}{B(body)}</div>{stage(obj, rot=rot)}</div>'''

# --- 3D objects ---
PHONE = box(150, 290, 16, {
    'front': ('#0B0E15', '<div style="position: absolute; inset: 8px; border-radius: 14px; overflow: hidden; background: linear-gradient(#18244A, #9B5767 62%, #FFC27C 78%, #1A1420 79%)"><div style="position: absolute; left: 30px; top: 70px; width: 60px; height: 34px; border: 2px solid #3DDC84"></div><div style="position: absolute; left: 30px; top: 56px; font: 700 9px Geist Mono, monospace; color: #3DDC84">BIRD 0.94</div><div style="position: absolute; left: 10px; top: 10px; width: 8px; height: 8px; border-radius: 50%; background: #FF3B30; animation: blink 1s infinite"></div></div>'),
    'side': ('linear-gradient(#6A7386,#2A303C)', ''), 'back': ('linear-gradient(160deg,#8A93A6,#3A4150)', '<div style="position: absolute; left: 16px; top: 16px; width: 44px; height: 44px; border-radius: 12px; background: #05070C; box-shadow: inset 0 0 0 3px #2A2F3A"></div>')})

def rack_front():
    rows = ''
    for i in range(7):
        leds = ''.join(f'<span style="display: inline-block; width: 6px; height: 6px; margin-right: 5px; border-radius: 50%; background: {["#3DDC84", AMB, "#5BE1FF"][(i + k) % 3]}; animation: blink {0.6 + ((i * 3 + k) % 5) * 0.3:.1f}s infinite"></span>' for k in range(4))
        rows += f'<div style="height: 34px; margin: 0 0 6px; border-radius: 4px; background: linear-gradient(#232B40,#141A28); border: 1px solid #3A4660; display: flex; align-items: center; justify-content: space-between; padding: 0 12px"><span>{leds}</span><span style="width: 60px; height: 4px; background: #2A3348"></span></div>'
    return f'<div style="padding: 16px 14px">{rows}</div>'
RACK = box(230, 320, 170, {'front': ('linear-gradient(#2C3650,#161C2C)', rack_front()), 'side': ('linear-gradient(#3A4660,#1A2030)', ''), 'top': ('#4A5672', '')})

def light(col, glow, y, blinkc=False):
    anim = 'animation: blink 0.9s infinite;' if blinkc else ''
    face = f'<div style="position: absolute; inset: 0; background: {col}; box-shadow: inset 0 0 30px rgba(255,255,255,.35), 0 0 60px {glow}; {anim}"></div>'
    return box(120, 78, 120, {'front': (col, face), 'back': (col, face), 'left': (col, face), 'right': (col, face), 'top': (col, '')}, extra_style=f'transform: translateY({y}px)')
STACK = (light('#3DDC84', 'rgba(61,220,132,.8)', 90) + light('#FFC83D', 'rgba(255,200,61,.8)', 10) + light('#FF3B30', 'rgba(255,59,48,.9)', -70, True)
         + box(130, 18, 130, {'side': ('#2A2F3A', '')}, extra_style='transform: translateY(-118px)') + box(36, 120, 36, {'side': ('#1A1D24', '')}, extra_style='transform: translateY(190px)'))

def disc(y, c):
    return f'<div class="p3" style="position: absolute; left: 0; top: 0; transform: translateY({y}px) rotateX(90deg)">{medal(220, c, "#0C4A54", "#0B3A42", "", speed=999)}</div>'
DB = disc(-90, '#5BE1FF') + disc(-20, '#3FB8D0') + disc(50, '#2B8FA6') + disc(120, '#1D6A7C')

TOWER = (box(60, 360, 60, {'side': ('linear-gradient(#2A2F3A,#12151C)', '')}, extra_style='transform: translateY(80px)')
         + box(190, 80, 190, {'front': ('linear-gradient(#5BE1FF33,#5BE1FF11)', '<div style="position: absolute; inset: 0; border: 2px solid #2A2F3A; background: linear-gradient(180deg, rgba(150,230,200,.35), rgba(150,230,200,.08))"></div>'), 'side': ('linear-gradient(180deg, rgba(150,230,200,.35), rgba(150,230,200,.08))', ''), 'top': ('#1A1D24', ''), 'bottom': ('#1A1D24', '')}, extra_style='transform: translateY(-140px)')
         + box(220, 16, 220, {'side': ('#2A2F3A', '')}, extra_style='transform: translateY(-188px)')
         + '<div style="position: absolute; left: -10px; top: -215px; width: 20px; height: 20px; border-radius: 50%; background: #FF3B30; box-shadow: 0 0 30px 10px rgba(255,59,48,.7); animation: blink 1s infinite"></div>')

HOW_STOPS = [
    dict(x=0, y=0, z=0, ry=0, w=1120, html=panel('Step 01: Camera', 'Eyes on the sky', 'An iPhone app, or any phone browser, points at the sky and streams JPEG frames to the server.', PHONE)),
    dict(x=1400, y=-200, z=-1700, ry=-24, w=1120, html=panel('Step 02: Detection', 'Find what flies', 'The server runs the detection engine on every camera: motion, tracking, wingbeat and flock detection.', RACK)),
    dict(x=2500, y=0, z=-3500, ry=-50, w=1120, html=panel('Step 03: Risk', 'Green. Yellow. Red.', 'Each situation is rated by how many objects there are and how fast they close on the runway.', STACK, rot='rotateX(-10deg) rotateY(-20deg)')),
    dict(x=2900, y=160, z=-5500, ry=-82, w=1120, html=panel('Step 04: Record', 'Every detection kept', 'Detections land in Tiger Data and roll into hourly totals for the charts. Incidents are saved to MongoDB.', DB, rot='rotateX(-24deg) rotateY(0deg)')),
    dict(x=2300, y=-60, z=-7400, ry=-118, w=1120, html=panel('Step 05: Alert', 'The tower hears it', 'Gemini writes the report, red alerts are spoken out loud, drone reports are stamped on Solana, and the dashboard and Arduino beacon light up.', TOWER, rot='rotateX(-8deg) rotateY(-20deg)')),
]
HOW_FLY = fly_section(HOW_STOPS, {'bg3d': '#070a14', 'bg': 'radial-gradient(ellipse at 50% 30%, #1A2448 0%, #05070D 65%)', 'acc': AMB, 'dot': '200,215,240', 'hotc': '255,179,107', 'hot': 0.2, 'particles': 800, 'lift': 200, 'pull': 900}, 'How Sky Sentry works, a 3D walkthrough', sec_id='how', props=['phone', 'rack', 'stacklight', 'database', 'tower'])

def stat_slab(big, unit):
    front = f'<div style="height: 100%; box-sizing: border-box; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; padding: 20px"><span class="bs" style="font-size: 92px; line-height: .9; font-weight: 900; color: {AMB}; text-shadow: 0 0 40px rgba(255,179,107,.45)">{big}</span><span class="mono" style="margin-top: 10px; font-size: 13px; color: #AEB6C6">{unit}</span></div>'
    return box(360, 240, 60, {'front': ('linear-gradient(160deg,#18203A,#0A0E1A)', front), 'side': ('linear-gradient(#202A48,#0C1020)', ''), 'top': ('#26304F', '')})

def part(title, body, big, unit):
    return f'''<div style="display: flex; flex-wrap: wrap; align-items: center; gap: 20px 40px; padding: 48px 52px; border-radius: 28px; background: linear-gradient(160deg, rgba(16,22,42,.9), rgba(8,10,20,.9)); border: 1px solid rgba(255,255,255,.08); box-shadow: 0 60px 120px -40px #000">
<div style="flex: 1 1 380px">{K('My part: the AI and voice pipeline')}{T(title, 'clamp(44px, 5vw, 76px)')}{B(body)}</div>
<div class="p3 obj3d" style="flex: 1 1 360px; position: relative; height: 320px"><div class="p3" style="position: absolute; left: 50%; top: 50%; width: 0; height: 0; transform: rotateX(-8deg) rotateY(-22deg)"><div class="p3 bob">{stat_slab(big, unit)}</div></div></div></div>'''

MINE_STOPS = [
    dict(x=0, y=0, z=0, ry=0, w=1120, html=part('Spoken alerts', 'ElevenLabs turns a red alert into audio. If it fails, the browser’s own voice takes over, and alerts are rate-limited so a tower never gets flooded.', '0.5 s', 'from red alert to audio')),
    dict(x=-900, y=-500, z=-1700, ry=22, rx=-6, w=1120, html=part('Incident reports', 'Gemini reads the camera snapshot and writes a short report. If it fails, a backup model takes over, then a template, so a report always gets written.', '3', 'layers of fallback')),
    dict(x=-600, y=-1050, z=-3400, ry=48, rx=-8, w=1120, html=part('Solana stamps', 'For drone incidents I hash the report with SHA-256 and write the hash to the Solana devnet as a memo, so anyone can check it was never changed. This won Best Use of Solana.', 'SHA-256', 'hash on Solana devnet')),
    dict(x=500, y=-1600, z=-4900, ry=82, rx=-6, w=1120, html=part('Ask SkySentry', 'Answers typed questions using only the last seven days of hourly data, and says “I don’t have data on that” when it doesn’t know.', '7 days', 'of data, nothing invented')),
    dict(x=1500, y=-2100, z=-6100, ry=118, rx=-4, w=1120, html=part('Built to keep running', 'The whole system still works without API keys, using template reports and honest status messages. Tests and a mock camera-and-tower setup come with it.', '1,300', 'lines across 16 files')),
]
MINE_FLY = fly_section(MINE_STOPS, {'bg3d': '#0b0912', 'bg': 'radial-gradient(ellipse at 50% 70%, #241A30 0%, #06070E 65%)', 'acc': AMB, 'dot': '220,225,240', 'hotc': '255,179,107', 'hot': 0.25, 'particles': 700, 'lift': 120, 'pull': 700}, 'My part in Sky Sentry, a 3D walkthrough', sec_id='mine', props=['waveform', 'docs', 'chain', 'chat', 'gears'])

MT = lambda a, b, c='#1A0F02': f'<div style="font-family: Geist, sans-serif; color: {c}; line-height: 1.05"><div style="font-size: 11px; font-weight: 700; letter-spacing: .08em">{a}</div><div style="font-size: 18px; font-weight: 800; margin-top: 3px">{b}</div></div>'
AWARDS = awards_scene([
    dict(x=-330, size=170, c1='#FF8A80', c2='#C8102E', rim='#7A0A12', front=MT('BEST USE', 'SOLANA', '#FFFFFF'), gl=dict(mat='red', top='BEST USE OF', main='SOLANA', bot='HACKPHS 2026', b3='SKY SENTRY', tint=[0.45,0.28,0.14]), title='Best Use of Solana', sub='For stamping drone reports on the Solana devnet'),
    dict(x=0, size=170, c1='#9FF2E6', c2='#1FA897', rim='#0C5A50', front=MT('BEST USE', 'TIGERDATA', '#04201C'), gl=dict(mat='teal', top='BEST USE OF', main='TIGERDATA', bot='HACKPHS 2026', b3='SKY SENTRY'), title='Best Use of TigerData', sub='For the time-series detection store'),
    dict(x=330, size=170, c1='#F2F4F8', c2='#9AA3B2', rim='#525A68', front=MT('OVERALL', '5TH PLACE', '#141A24'), gl=dict(mat='silver', top='OVERALL', main='5TH|PLACE', bot='HACKPHS 2026', b3='SKY SENTRY'), title='5th place overall', sub='Out of every team at HackPHS 2026'),
], {'acc': RED, 'bg': 'radial-gradient(ellipse at 50% 100%, #3A1A10 0%, #05070D 62%)', 'beam': 'rgba(255,214,170,.16)', 'floor': 'rgba(255,179,107,.2)'},
    f'''<p class="mono" style="margin: 0 0 16px; font-size: 13px; color: {RED}">What it won</p><h2 id="won-h" class="bs" style="margin: 0; font-size: clamp(56px, 8vw, 130px); line-height: .85; font-weight: 900; text-transform: uppercase">Three awards at HackPHS 2026</h2>''',
    foot_html=f'''<div style="margin-top: 10px; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 24px; padding-bottom: 60px">
<p style="margin: 0; max-width: 30em; font-size: 19px; line-height: 1.5; color: #E7EAF0">Try it yourself: the live site has a local preview with real bird footage.</p>
<div style="display: flex; flex-wrap: wrap; gap: 14px"><a class="btn btn-red" href="https://lancerhacks-rvs8r.ondigitalocean.app">Try Sky Sentry</a><a class="btn btn-ghost" href="Echo.dc.html">Next: Echo</a></div></div>''',
    height=740, label='What Sky Sentry won')
