from common import RED
from three import box, medal, fly_section, awards_scene

K = lambda t: f'<p class="mono" style="margin: 0 0 16px; font-size: 13px; color: {RED}">{t}</p>'
T = lambda t, size='clamp(54px, 6.4vw, 100px)': f'<h3 class="st" style="margin: 0; font-size: {size}; line-height: .86; font-weight: 900; text-transform: uppercase; color: #FFFFFF">{t}</h3>'
B = lambda t: f'<p style="margin: 18px 0 0; max-width: 32em; font-size: 18px; line-height: 1.6; color: #D2C6C0">{t}</p>'
CARD = 'padding: 46px 50px; border-radius: 24px; background: linear-gradient(160deg, rgba(22,10,10,.92), rgba(6,3,3,.94)); border: 1px solid rgba(255,59,48,.18); box-shadow: 0 60px 120px -40px #000'

ripple = ''.join(f'<div style="position: absolute; left: -220px; top: -220px; width: 440px; height: 440px; border-radius: 50%; border: 2px solid {RED}; box-shadow: 0 0 30px rgba(255,59,48,.5), inset 0 0 30px rgba(255,59,48,.3); animation: rip3 3s cubic-bezier(.15,.6,.3,1) infinite; animation-delay: {i}s"></div>' for i in range(3))
S1 = f'''<div style="{CARD}; display: flex; flex-wrap: wrap; align-items: center; gap: 20px 40px">
<div style="flex: 1 1 400px">{K('How it works')}{T('Sound is your only light')}{B('Each ping sends out a ring of light that shows the walls for a moment. The Listeners are blind and hunt by sound, so every ping also tells them exactly where you are.')}
<p class="tw" style="margin: 18px 0 0; max-width: 30em; font-size: 19px; line-height: 1.5; color: #FF8A80">The theme was “Bounce Back.” An echo is sound bouncing back, and you are bouncing back from the fall by climbing out.</p></div>
<div class="p3 obj3d" style="flex: 1 1 340px; position: relative; height: 360px"><div class="p3" style="position: absolute; left: 50%; top: 62%; width: 0; height: 0; transform: rotateX(72deg)">{ripple}<div style="position: absolute; left: -9px; top: -9px; width: 18px; height: 18px; border-radius: 50%; background: #FFFFFF; box-shadow: 0 0 30px 8px #FFFFFF"></div></div></div>
</div>'''

ICONS = {
    'sneak': '<path d="M5 19c2-1 3-3 3-6M9 7a2 2 0 1 0 0-.01M10 9l3 4 4 1M13 13l-2 6"/>',
    'run': '<path d="M14 5a2 2 0 1 0 0-.01M9 21l3-6 3 2v4M6 12l3-3 4 1 2 3 3 1"/>',
    'breath': '<path d="M12 4v8M8 8c-3 1-4 4-4 7 0 2 2 3 4 2l2-2V9M16 8c3 1 4 4 4 7 0 2-2 3-4 2l-2-2V9"/>',
    'pebble': '<path d="M6 16c0-3 2-5 5-5s6 2 6 5-3 4-6 4-5-1-5-4zM15 6l3-2M18 9l3-1M12 5l1-3"/>',
    'whisper': '<path d="M4 12h3M9 9c1 2 1 4 0 6M13 7c2 3 2 7 0 10"/>',
    'chalk': '<path d="M6 6l12 12M18 6L6 18"/>',
}
MOVES = [('sneak', 'Sneak', 'Move quietly through the dark.'), ('run', 'Run', 'Move fast when you have to.'), ('breath', 'Hold your breath', 'Make no sound at all.'),
         ('pebble', 'Throw pebbles', 'Distract the monsters with noise somewhere else.'), ('whisper', 'Whisper ping', 'A quieter version of the ping.'), ('chalk', 'Chalk marks', 'Mark the walls as you go.')]
def tile(i, k, t, d):
    col = i % 3; ry = [16, 0, -16][col]; z = [-30, 30, -30][col]
    return f'''<li class="p3" style="transform: translateZ({z}px) rotateY({ry}deg)"><div style="height: 100%; box-sizing: border-box; padding: 22px 22px 24px; border-radius: 16px; background: linear-gradient(160deg,#1A0C0C,#0A0505); border: 1px solid #3A1C1C; box-shadow: 0 30px 60px -20px #000">
<svg aria-hidden="true" viewBox="0 0 24 24" style="width: 30px; height: 30px" fill="none" stroke="{RED}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">{ICONS[k]}</svg>
<h4 class="st" style="margin: 14px 0 6px; font-size: 26px; line-height: 1; font-weight: 800; text-transform: uppercase; color: #FFFFFF">{t}</h4>
<p style="margin: 0; font-size: 14px; line-height: 1.5; color: #B5A9A6">{d}</p></div></li>'''
S2 = f'''<div style="{CARD}">{K('Your moves')}{T('What you can do', 'clamp(44px, 5vw, 76px)')}
<ul class="p3" style="list-style: none; margin: 30px 0 0; padding: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; perspective: 1200px">{''.join(tile(i, k, t, d) for i, (k, t, d) in enumerate(MOVES))}</ul>
<p style="margin: 18px 0 0; font-size: 14px; color: #9C8D89">There is also an optional combat mode with hidden daggers.</p></div>'''

STATES = [('Patrol', 'Walks its route through the mine.'), ('Listen', 'Stops dead and listens.'), ('Investigate', 'Heads for the last noise it heard.'), ('Chase', 'Comes after you.'), ('Lose you', 'Loses you after a few seconds.')]
def node(i, t, d):
    ang = (2 - i) * 22; hot = i == 3
    return f'''<div class="p3" style="position: absolute; left: 0; top: 0; transform: rotateY({ang}deg) translateZ(-560px)"><div style="position: absolute; left: -100px; top: -90px; width: 200px; box-sizing: border-box; padding: 18px 16px; border-radius: 14px; background: {RED if hot else 'linear-gradient(160deg,#1A0C0C,#0A0505)'}; border: 1px solid {RED if hot else '#3A1C1C'}; box-shadow: {'0 0 60px rgba(255,59,48,.6)' if hot else '0 30px 60px -20px #000'}">
<span class="mono" style="font-size: 12px; color: {'#FFE3E0' if hot else '#8C7774'}">{i+1:02d}</span>
<h4 class="st" style="margin: 6px 0 6px; font-size: 26px; font-weight: 800; text-transform: uppercase; color: #FFFFFF">{t}</h4>
<p style="margin: 0; font-size: 13px; line-height: 1.45; color: {'#FFF1EF' if hot else '#B5A9A6'}">{d}</p></div></div>'''
S3 = f'''<div style="{CARD}">{K('The monsters')}{T('How a Listener hunts', 'clamp(44px, 5vw, 76px)')}{B('Each one runs through the same loop, driven by what it hears.')}
<div class="p3 obj3d" style="position: relative; height: 300px; margin-top: 10px"><div class="p3" style="position: absolute; left: 50%; top: 150px; width: 0; height: 0; transform: translateZ(470px)">{''.join(node(i, t, d) for i, (t, d) in enumerate(STATES))}</div></div></div>'''

S4 = f'''<div style="{CARD}; display: flex; flex-wrap: wrap; gap: 24px 56px">
<div style="flex: 1 1 360px">{K('The game')}{T('What’s inside', 'clamp(44px, 5vw, 76px)')}
<ul style="margin: 22px 0 0; padding: 0 0 0 20px; font-size: 18px; line-height: 1.85; color: #D2C6C0"><li>Two levels, including The Flooded Deep</li><li>Cutscenes, a map and voice-log story pieces</li><li>A settings menu with key rebinding</li><li>Controller support and a ranking system</li></ul></div>
<div style="flex: 1 1 320px; align-self: center"><p class="tw" style="margin: 0 0 18px; padding: 24px 26px; border-left: 3px solid {RED}; background: rgba(255,59,48,.06); font-size: 18px; line-height: 1.6; color: #E6DCD6">The story is told through voice logs you find in the dark, between cutscenes.</p>
<p style="margin: 0; font-size: 15px; line-height: 1.6; color: #9C8D89">Audio from CC0 sound libraries, textures from Poly Haven, props from KayKit, and a custom 3D model for the monster.</p></div></div>'''

def wall():
    out = []
    for i in range(89):
        c, r = i % 15, i // 15
        hot = i < 18
        z = (hash((i * 7919) % 97) % 5) * 6 + (30 if hot else 0)
        out.append(f'<div style="position: absolute; left: {c*34 - 255}px; top: {r*34 - 102}px; width: 30px; height: 30px; border-radius: 4px; transform: translateZ({z}px); background: {"linear-gradient(160deg,#FF6B5E,#C8102E)" if hot else "linear-gradient(160deg,#2A1616,#120909)"}; box-shadow: {"0 0 18px rgba(255,59,48,.7)" if hot else "inset 0 0 0 1px #3A1C1C"}"></div>')
    return ''.join(out)
S5 = f'''<div style="{CARD}; display: flex; flex-wrap: wrap; align-items: center; gap: 24px 48px">
<div style="flex: 1 1 380px">{K('My part')}{T('18 of 89 commits', 'clamp(48px, 5.6vw, 88px)')}
<ul style="margin: 20px 0 0; padding: 0 0 0 20px; font-size: 16px; line-height: 1.7; color: #D2C6C0"><li>Gameplay systems, the menu and settings screens, and level work</li><li>The fixes that made the game run reliably</li><li>The November 14 cleanup: scripts rewritten to be easier to read, without changing how the game plays, then tested in Godot</li></ul></div>
<div class="p3 obj3d" style="flex: 1 1 440px; position: relative; height: 300px" role="img" aria-label="A wall of 89 commit blocks, 18 of them lit red"><div class="p3" style="position: absolute; left: 50%; top: 50%; width: 0; height: 0; transform: rotateX(-14deg) rotateY(-26deg)"><div class="p3 bob">{wall()}</div></div></div></div>'''

STOPS = [
    dict(x=0, y=0, z=0, ry=0, w=1120, html=S1),
    dict(x=320, y=0, z=-1700, ry=-8, w=1120, html=S2),
    dict(x=-260, y=-40, z=-3400, ry=8, w=1120, html=S3),
    dict(x=280, y=0, z=-5100, ry=-6, w=1120, html=S4),
    dict(x=-200, y=20, z=-6800, ry=6, w=1120, html=S5),
]
HOW_FLY = fly_section(STOPS, {'bg3d': '#0a0404', 'bg': 'radial-gradient(ellipse at 50% 50%, #1A0505 0%, #000 70%)', 'acc': RED, 'dot': '230,220,210', 'hotc': '255,59,48', 'hot': 0.18, 'particles': 700,
                              'lift': 60, 'pull': 500, 'frames': True, 'framec': '255,150,90', 'frameW': 1150, 'frameH': 720, 'frameY': 40}, 'How Echo works, a walk through the mine', sec_id='how', props=['ripples', 'tiles', 'loop', 'engine', 'wall'])

MT = '<div style="font-family: Geist, sans-serif; color: #1A0F02; line-height: 1.05"><div style="font-size: 14px; font-weight: 700; letter-spacing: .08em">1ST PRIZE</div><div style="font-size: 24px; font-weight: 800; margin-top: 4px">BEST OVERALL</div></div>'
AWARDS = awards_scene([dict(x=0, size=280, c1='#FFF1B8', c2='#E0A82E', rim='#8A5A10', front=MT,  gl=dict(mat='gold', top='BEST OVERALL', main='1ST|PRIZE', bot='HACK CLUB HAVEN', b3='ECHO', tint=[0.7,0.06,0.04]),title='1st prize, best overall', sub='Hack Club Haven, Princeton, 2026', speed=11)],
    {'acc': RED, 'bg': 'radial-gradient(ellipse at 50% 100%, #5A0B07 0%, #000 65%)', 'beam': 'rgba(255,80,60,.22)', 'floor': 'rgba(255,59,48,.3)'},
    f'''<div style="text-align: center"><p class="mono" style="margin: 0 0 16px; font-size: 13px; color: #FF8A80">What it won</p><h2 id="won-h" class="st" style="margin: 0; font-size: clamp(90px, 15vw, 240px); line-height: .8; font-weight: 900; color: #FFFFFF; text-shadow: 0 0 90px rgba(255,59,48,.6)">1ST PRIZE</h2>
<p class="st" style="margin: 14px 0 0; font-size: clamp(30px, 3.6vw, 54px); line-height: 1; font-weight: 800; color: {RED}; text-transform: uppercase">Best overall</p></div>''',
    foot_html=f'''<div style="text-align: center; padding-bottom: 80px"><p style="margin: 0 0 28px; font-size: 18px; color: #D8CEC8">Hack Club Haven, Princeton, 2026</p>
<div style="display: flex; flex-wrap: wrap; justify-content: center; gap: 14px"><a class="btn btn-red" href="https://burthebear.itch.io/echo-hack-haven-princeton" style="min-height: 64px; padding: 0 40px; font-size: 19px">Play Echo</a><a class="btn btn-ghost" href="SkySentry.dc.html" style="min-height: 64px">Next: Sky Sentry</a></div></div>''',
    height=760, label='What Echo won')
