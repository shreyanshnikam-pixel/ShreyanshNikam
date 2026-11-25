"""Shared 3D building blocks: CSS 3D boxes, spinning medals, pedestal award scenes, camera fly-through sections."""
import json

THREE_CSS = """
.p3{transform-style:preserve-3d}
.face{position:absolute;left:0;top:0;box-sizing:border-box;backface-visibility:hidden}
.fly{position:relative}
.fly-stage{position:sticky;top:0;height:100vh;min-height:600px;max-height:1100px;overflow:hidden;perspective:900px}
.fly-bg{position:absolute;inset:0;width:100%;height:100%;display:block}
.fly-world{position:absolute;left:50%;top:50%;width:0;height:0;transform-style:preserve-3d}
.fly .panel{position:absolute;left:0;top:0;transform-origin:0 0;transform-style:preserve-3d;box-sizing:border-box}
.fly-dots{position:absolute;right:28px;top:50%;transform:translateY(-50%);display:flex;flex-direction:column;gap:10px;z-index:4}
.fly-dot{width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,.25);transition:background .3s,transform .3s}
.fly-dot.on{background:var(--acc,#FF3B30);transform:scale(1.5)}
.fly.flat{height:auto !important}
.fly.flat .fly-stage{position:relative;height:auto;max-height:none;overflow:visible;perspective:none}
.fly.flat .fly-bg,.fly.flat .fly-dots{display:none}
.fly.flat .fly-world{position:relative;left:auto;top:auto;width:auto;height:auto;transform:none !important}
.fly.flat .panel{position:relative !important;transform:none !important;margin:56px auto !important;opacity:1 !important;visibility:visible !important;max-width:94vw}
@keyframes spinY{from{transform:rotateY(0)}to{transform:rotateY(360deg)}}
@keyframes spinYb{from{transform:rotateX(-14deg) rotateY(0)}to{transform:rotateX(-14deg) rotateY(360deg)}}
@keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-14px)}}
@keyframes orbit{0%,100%{transform:rotateX(-8deg) rotateY(-16deg)}50%{transform:rotateX(-8deg) rotateY(16deg)}}
@keyframes blink{0%,100%{opacity:.25}50%{opacity:1}}
@keyframes beam{0%,100%{opacity:.55}50%{opacity:.85}}
.spin{animation:spinY 7s linear infinite}
.story{position:relative}
.story-stage{position:sticky;top:0;height:100vh;height:100svh;min-height:560px;overflow:hidden}
.story-cv{position:absolute;inset:0;width:100%;height:100%;display:block}
.story-scrim{position:absolute;inset:0;pointer-events:none;background:linear-gradient(90deg,rgba(0,0,0,.82) 0%,rgba(0,0,0,.55) 34%,rgba(0,0,0,0) 60%)}
.story .sp{position:absolute;top:0;bottom:0;left:max(24px,6vw);width:min(46vw,640px);display:flex;align-items:center;opacity:0;visibility:hidden;will-change:opacity,transform}
.story .sp-in>div{background:none !important;border:0 !important;box-shadow:none !important;padding:0 !important;border-radius:0 !important}
.story .obj3d,.story .stage3d{display:none !important}
.story .fly-dots{position:absolute;right:28px;top:50%;transform:translateY(-50%);display:flex;flex-direction:column;gap:10px}
.fly-dot.on{background:var(--acc);transform:scale(1.4)}
.story.flat{height:auto !important}.story.flat .story-stage{position:relative;height:auto;min-height:0;padding:120px 0 60px}
.story.flat .story-cv,.story.flat .story-scrim,.story.flat .fly-dots{display:none}
.story.flat .story-panels{display:flex;flex-direction:column;gap:80px;padding:0 max(20px,6vw)}
.story.flat .sp{position:relative;inset:auto;width:auto;max-width:900px;opacity:1;visibility:visible;transform:none !important}
.m3d{position:relative;min-height:max(100vh,720px);overflow:hidden;display:flex;flex-direction:column;justify-content:space-between}
.m3d canvas.medals3d{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:pan-y}
.m3d-head{position:relative;z-index:2;padding-top:110px;pointer-events:none}.m3d-head *{pointer-events:auto}
.m3d-foot{position:relative;z-index:2;padding-bottom:40px}
.m3d-caps{position:relative;z-index:2;list-style:none;margin:40px auto;padding:0 24px;display:flex;flex-wrap:wrap;gap:16px;justify-content:center}
.m3d-cap{flex:0 1 220px;text-align:center}.m3d-t{margin:0;font:700 17px/1.2 Geist,sans-serif;color:#fff}.m3d-s{margin:6px 0 0;font-size:13px;line-height:1.4;color:#A8A39C}
.m3d-hint{display:none;position:relative;z-index:2;margin:0;text-align:center;font:12px Geist Mono,monospace;color:rgba(255,255,255,.45)}
.m3d.m3d-on .m3d-caps{position:absolute;inset:0;margin:0;padding:0;display:block;pointer-events:none}
.m3d.m3d-on .m3d-cap{position:absolute;left:0;top:0;width:220px;will-change:transform}
.m3d.m3d-on .m3d-hint{display:block;position:absolute;left:0;right:0;bottom:18px}
@media (max-width:760px){.m3d{min-height:0}.m3d canvas.medals3d{position:relative;inset:auto;order:2;height:58vh;min-height:360px}.m3d-head{order:1}.m3d-caps,.m3d.m3d-on .m3d-caps{order:3;position:relative;display:flex;margin:8px auto 24px;pointer-events:auto}.m3d.m3d-on .m3d-cap{position:relative;width:auto;transform:none !important}.m3d-foot{order:4}.m3d.m3d-on .m3d-hint{position:relative;order:5;bottom:auto;padding-bottom:20px}}
.gl-on>.spin{display:none}
.spinb{animation:spinYb 10s linear infinite}
.bob{animation:bob 5s ease-in-out infinite}
.drop{transition:transform 1.3s cubic-bezier(.2,1.25,.35,1),opacity .6s}
.drop:not(.in){transform:translateY(-700px) !important;opacity:0}

@media (max-width:760px){.obj3d{transform:scale(.6);transform-origin:50% 45%;margin:-30px 0 -50px}.fly.flat .panel ul.p3{display:flex !important;flex-direction:column}.fly.flat .panel ul.p3>li{transform:none !important}.fly.flat .panel>div{padding:30px 22px !important}}
@media (prefers-reduced-motion:reduce){.drop:not(.in){transform:none !important;opacity:1}}
"""

def box(w, h, d, faces, extra_style='', cls=''):
    """CSS 3D box centered on its own origin. faces: dict front/back/left/right/top/bottom -> (background, inner_html)."""
    def f(name, fw, fh, tf):
        bg, inner = faces.get(name, (faces.get('side', ('#222', ''))[0], ''))
        return f'<div class="face" style="width: {fw}px; height: {fh}px; margin-left: {-fw/2}px; margin-top: {-fh/2}px; background: {bg}; transform: {tf}">{inner}</div>'
    parts = [
        f('front', w, h, f'translateZ({d/2}px)'),
        f('back', w, h, f'rotateY(180deg) translateZ({d/2}px)'),
        f('right', d, h, f'rotateY(90deg) translateZ({w/2}px)'),
        f('left', d, h, f'rotateY(-90deg) translateZ({w/2}px)'),
        f('top', w, d, f'rotateX(90deg) translateZ({h/2}px)'),
        f('bottom', w, d, f'rotateX(-90deg) translateZ({h/2}px)'),
    ]
    return f'<div class="p3 {cls}" style="position: absolute; left: 0; top: 0; width: 0; height: 0; {extra_style}">{"".join(parts)}</div>'

def medal(size, c1, c2, rim, front_html, back_html='', speed=7, delay=0, label_aria='', gl=None):
    """Spinning 3D medal. CSS version is the fallback; when WebGL works a ray-marched metal medal replaces it."""
    layers = []
    th = max(6, size // 16)
    for i in range(th):
        z = i - th / 2
        layers.append(f'<div class="face" style="width: {size}px; height: {size}px; margin: {-size/2}px 0 0 {-size/2}px; border-radius: 50%; background: {rim}; transform: translateZ({z:.1f}px); backface-visibility: visible"></div>')
    face = f'radial-gradient(circle at 32% 28%, {c1} 0%, {c2} 62%, {rim} 100%)'
    fr = f'<div class="face" style="width: {size}px; height: {size}px; margin: {-size/2}px 0 0 {-size/2}px; border-radius: 50%; background: {face}; box-shadow: inset 0 0 0 {max(3,size//28)}px rgba(255,255,255,.35), inset 0 0 {size//6}px rgba(0,0,0,.35); transform: translateZ({th/2+0.5}px); display: flex; align-items: center; justify-content: center; text-align: center">{front_html}</div>'
    bk = f'<div class="face" style="width: {size}px; height: {size}px; margin: {-size/2}px 0 0 {-size/2}px; border-radius: 50%; background: {face}; box-shadow: inset 0 0 0 {max(3,size//28)}px rgba(255,255,255,.35); transform: rotateY(180deg) translateZ({th/2+0.5}px); display: flex; align-items: center; justify-content: center; text-align: center">{back_html or front_html}</div>'
    css = f'<div class="p3 spin" style="position: absolute; left: 0; top: 0; width: 0; height: 0; animation-duration: {speed}s; animation-delay: {delay}s">{"".join(layers)}{fr}{bk}</div>'
    if not gl:
        return css
    cs = round(size / 0.7)
    m = dict(gl); m.setdefault('speed', round(6.283 / max(1, speed), 3)); m.setdefault('ph', -delay)
    data = json.dumps(m).replace("'", '&#39;')
    return f'<div class="p3 medal-wrap" style="position: absolute; left: 0; top: 0; width: 0; height: 0">{css}<canvas class="medal-gl" aria-hidden="true" data-m=\'{data}\' style="display: none; position: absolute; left: {-cs/2}px; top: {-cs/2}px; width: {cs}px; height: {cs}px"></canvas></div>'

def awards_scene(items, theme, heading_html, foot_html='', height=820, sec_id='', label=''):
    """A full-screen three.js stage: struck medals on ribbons, spotlit pedestals. Captions are real text that follow each medal."""
    data = [dict(it.get('gl', {}), big=1 if it.get('size', 0) >= 200 else 0) for it in items]
    th = json.dumps({'acc': theme.get('acc', '#FF3B30'), 'bg': theme.get('bg3d', '#07080B')}).replace("'", '&#39;')
    caps = ''.join(f'<li data-cap="{i}" class="m3d-cap"><p class="m3d-t">{it["title"]}</p><p class="m3d-s">{it["sub"]}</p></li>' for i, it in enumerate(items))
    sid = f' id="{sec_id}"' if sec_id else ''
    return f'''<section{sid} class="m3d" aria-label="{label}" style="background: {theme.get('bg3d', '#07080B')}">
<canvas class="medals3d" aria-hidden="true" data-items='{json.dumps(data).replace("'", "&#39;")}' data-theme='{th}'></canvas>
<div class="wrap m3d-head">{heading_html}</div>
<ul class="m3d-caps" style="--acc: {theme.get('acc', '#FF3B30')}">{caps}</ul>
<p class="m3d-hint">Drag a medal to turn it.</p>
<div class="wrap m3d-foot">{foot_html}</div>
</section>'''

def fly_section(stops, theme, label, sec_id='', per_stop=1050, props=None):
    """A full-screen three.js walkthrough: the camera travels between real 3D objects; each stop's text sits beside its object."""
    props = props or ['slabs'] * len(stops)
    data = [{'prop': props[i] if i < len(props) else 'slabs'} for i in range(len(stops))]
    panels = ''.join(f'<div class="sp" data-i="{i}"><div class="sp-in">{s["html"]}</div></div>' for i, s in enumerate(stops))
    dots = ''.join('<span class="fly-dot" aria-hidden="true"></span>' for _ in stops)
    sid = f' id="{sec_id}"' if sec_id else ''
    th = json.dumps({'acc': theme.get('acc', '#FF3B30'), 'bg3d': theme.get('bg3d', '#07080B')}).replace("'", '&#39;')
    st = json.dumps(data).replace("'", '&#39;')
    return f'''<section{sid} class="story" ref="{{{{ flyRef }}}}" aria-label="{label}" data-stops='{st}' data-theme='{th}' style="--n: {len(stops)}; --acc: {theme.get('acc', '#FF3B30')}; height: calc({len(stops) * per_stop}px + 100vh)">
<div class="story-stage" style="background: {theme.get('bg3d', '#07080B')}">
<canvas class="story-cv" aria-hidden="true"></canvas>
<div class="story-scrim" aria-hidden="true"></div>
<div class="story-panels">{panels}</div>
<div class="fly-dots hide-sm">{dots}</div>
</div>
</section>'''

# ---------------- JS injected into each page's Component ----------------
FLY_CTOR = r'''
    this.flies = [];
    this.flyRef = (el) => { if (el && !el.__fly) { el.__fly = true; this.mountFly(el); } };
    this.tiltRef = (el) => { if (el && !el.__tilt) { el.__tilt = true; this.mountTilt(el); } };
    this.mxN = 0; this.myN = 0;
'''

FLY_METHODS = r'''
  ensureGlobal() {
    if (this._glob) return; this._glob = true;
    this._onMove = (e) => { this.mxN = e.clientX / (window.innerWidth || 1) - 0.5; this.myN = e.clientY / (window.innerHeight || 1) - 0.5; };
    window.addEventListener('mousemove', this._onMove, { passive: true });
    if ('IntersectionObserver' in window) {
      this._io = new IntersectionObserver((es) => { es.forEach((e) => { if (e.isIntersecting) { e.target.querySelectorAll('.drop').forEach((d) => d.classList.add('in')); } }); }, { threshold: 0.25 });
    }
    const loop = (now) => {
      if (this.dead) return;
      this._loopRaf = requestAnimationFrame(loop);
      const t = now / 1000;
      if (this._lt) { const dt = now - this._lt; this._ema = this._ema ? this._ema * 0.95 + dt * 0.05 : dt; }
      this._lt = now; this._fc = (this._fc || 0) + 1;
      if (this._fc % 45 === 0 && this._ema) { if (this._ema > 21) this.q = Math.max(0.45, (this.q || 1) - 0.12); else if (this._ema < 9.5) this.q = Math.min(1, (this.q || 1) + 0.06); }
      if (!this._medInit) this.mountMedals();
      this.medalFrame(t);
      if (this.tilts) for (const el of this.tilts) {
        const r = el.getBoundingClientRect(); if (r.bottom < 0 || r.top > window.innerHeight) continue;
        const tgt = el.querySelector('[data-tilt]'); if (!tgt) continue;
        el.__mx = (el.__mx || 0) + (this.mxN - (el.__mx || 0)) * 0.06; el.__my = (el.__my || 0) + (this.myN - (el.__my || 0)) * 0.06;
        const tm = parseFloat(tgt.getAttribute('data-tilt')) || 1; tgt.style.transform = 'rotateY(' + (el.__mx * 26 * tm).toFixed(2) + 'deg) rotateX(' + (-el.__my * 10 * tm).toFixed(2) + 'deg)';
      }
      if (this.extraFrame) this.extraFrame(t);
    };
    this._loopRaf = requestAnimationFrame(loop);
  }
  mountTilt(el) {
    this.ensureGlobal();
    this.tilts = this.tilts || []; this.tilts.push(el);
    const sec = el.closest('section') || el;
    if (this._io) this._io.observe(sec); else sec.querySelectorAll('.drop').forEach((d) => d.classList.add('in'));
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) sec.querySelectorAll('.drop').forEach((d) => d.classList.add('in'));
  }
  mountFly(sec) {
    const reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    let stops = [], theme = {};
    try { stops = JSON.parse(sec.getAttribute('data-stops')); theme = JSON.parse(sec.getAttribute('data-theme') || '{}'); } catch (e) { sec.classList.add('flat'); return; }
    if (reduce || (window.innerWidth || 1000) < 760 || !window.Story3D) { sec.classList.add('flat'); return; }
    this.ensureGlobal();
    const panels = Array.prototype.slice.call(sec.querySelectorAll('.sp')), dots = Array.prototype.slice.call(sec.querySelectorAll('.fly-dot'));
    try { this.flies.push(new window.Story3D(sec, { canvas: sec.querySelector('.story-cv'), panels, dots, stops, theme })); sec.classList.add('s3d-on'); }
    catch (e) { console.error(e); sec.classList.add('flat'); }
    panels.forEach((p, i) => p.addEventListener('focusin', () => { const r = sec.getBoundingClientRect(), y = window.scrollY + r.top + (r.height - window.innerHeight) * (i / Math.max(1, panels.length - 1)); window.scrollTo({ top: y }); }));
  }
  flyFrame() {}
  cleanupFly() {
    this.dead = true;
    (this.flies || []).forEach((f) => { if (f && f.dispose) f.dispose(); });
    if (this._loopRaf) cancelAnimationFrame(this._loopRaf);
    if (this._onMove) window.removeEventListener('mousemove', this._onMove);
    if (this._io) this._io.disconnect();
  }
'''

MEDAL_JS = open('/home/claude/gen/medal_gl.js').read()

def inject(class_src, extra_vals=('flyRef', 'tiltRef')):
    """Insert the fly constructor lines and methods into a Component class source."""
    s = class_src
    marker = 'super(props);'
    assert marker in s
    s = s.replace(marker, marker + FLY_CTOR, 1)
    idx = s.rfind('renderVals()')
    s = s[:idx] + FLY_METHODS.strip() + '\n' + MEDAL_JS + '\n  ' + s[idx:]
    return s
