/* Shared site behaviour: smooth scroll, preloader, header, HUD, cursor, reveals, sound. window.SITE */
(function () {
  // motion: follow the system's reduced-motion setting unless the visitor chose otherwise in the Graphics panel
  let motionPref = 'system'; try { motionPref = localStorage.getItem('motion') || 'system'; } catch (e) { /* storage blocked */ }
  const sysRM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rm = motionPref === 'full' ? false : motionPref === 'reduced' ? true : sysRM;
  const touch = window.matchMedia('(hover: none), (pointer: coarse)').matches;
  const root = document.documentElement; root.classList.remove('js-off'); if (rm) root.classList.add('rm');
  const glOk = (() => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } })();
  if (!glOk) root.classList.add('nogl');

  // ---- performance tier + resolution governor, shared by every 3D page ----
  // tier 'high' = a dedicated GPU; 'mid' = built-in laptop/desktop graphics; 'low' = phones, tablets and software rendering.
  // Each tier gets a pixel budget for its first frames; the governor then holds 60 fps and only steps up while it stays smooth.
  const PERF = window.PERF = (() => {
    let gpu = '';
    try { const c = document.createElement('canvas'), gl = c.getContext('webgl2') || c.getContext('webgl'); if (gl) { const e = gl.getExtension('WEBGL_debug_renderer_info'); gpu = String(gl.getParameter(e ? e.UNMASKED_RENDERER_WEBGL : gl.RENDERER) || ''); const lc = gl.getExtension('WEBGL_lose_context'); if (lc) lc.loseContext(); } } catch (e) { /* no WebGL */ }
    const phone = /Android|iPhone|iPad|iPod|Mobile|Silk/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform || '')) || touch;
    const soft = /SwiftShader|llvmpipe|Software|Basic Render|Microsoft Basic/i.test(gpu);
    const discrete = /NVIDIA|GeForce|RTX|GTX|Quadro|Radeon RX|Radeon Pro|Radeon \d{3,4}M|Arc\(TM\) A|Arc A\d|Apple M\d (Pro|Max|Ultra)/i.test(gpu);
    const detected = soft || phone ? 'low' : discrete ? 'high' : 'mid';
    // the visitor's own choice from the Graphics panel wins: auto | low | medium | high | ultra
    let level = 'auto'; try { level = localStorage.getItem('gfx') || 'auto'; } catch (e) { /* storage blocked */ }
    const q = (location.search.match(/[?&]gfx=(auto|low|medium|high|ultra)\b/) || [])[1]; if (q) level = q;
    if (!/^(auto|low|medium|high|ultra)$/.test(level)) level = 'auto';
    const auto = level === 'auto', ultra = level === 'ultra';
    const tier = auto ? detected : { low: 'low', medium: 'mid', high: 'high', ultra: 'high' }[level];
    const budget = ultra ? Infinity : { high: 4.4e6, mid: 1.45e6, low: 0.8e6 }[tier];
    const dprCap = Math.min(window.devicePixelRatio || 1, 2);
    const minPR = { high: 0.75, mid: 0.5, low: 0.45 }[tier];
    // starting pixel ratio for a w x h canvas: native where the budget allows, less where it does not
    const startPR = (w, h) => Math.max(minPR, Math.min(dprCap, Math.sqrt(budget / Math.max(1, w * h))));
    // governor: call g.tick(now) once a frame; g.pr is the pixel ratio to use; onChange(pr) applies it
    const governor = (onChange, getWH) => {
      const g = { pr: 1, ema: 16.7, last: 0, n: 0, ceil: dprCap, calm: 0, settle: 0 };
      g.reset = () => { const [w, h] = getWH(); g.pr = startPR(w, h); g.ceil = dprCap; g.settle = 30; g.t0 = 0; onChange(g.pr); };
      g.tick = (now) => {
        if (!auto) return; // a fixed level from the Graphics panel: render exactly what was chosen
        if (!g.t0) g.t0 = now; const warm = now - g.t0 < 9000;
        if (g.last) g.ema = g.ema * 0.9 + Math.min(now - g.last, 100) * 0.1;
        g.last = now; if (document.hidden || g.settle-- > 0) return;
        if (++g.n % 20) return;
        if (!warm && g.ema < 30) return; // after warm-up the resolution holds still: no periodic resizes
        if (g.ema > 19.5 && g.pr > minPR) { g.ceil = Math.max(minPR, g.pr - 0.02); g.pr = Math.max(minPR, g.pr * (g.ema > 34 ? 0.78 : 0.9)); g.calm = 0; g.settle = 20; onChange(g.pr); }
        else if (warm && g.ema < 17.6) { if (++g.calm >= 6 && g.pr < g.ceil) { g.pr = Math.min(g.ceil, g.pr * 1.08); g.calm = 0; g.settle = 20; onChange(g.pr); } }
        else g.calm = 0;
      };
      g.apply = () => { if (!g.started) { g.started = true; g.reset(); } else onChange(g.pr); };
      return g;
    };
    root.dataset.tier = tier;
    const setLevel = (l) => { let saved = false; try { localStorage.setItem('gfx', l); saved = localStorage.getItem('gfx') === l; } catch (e) { /* storage blocked */ } const u = new URL(location.href); u.searchParams.delete('gfx'); if (!saved) u.searchParams.set('gfx', l); location.replace(u.toString()); };
    return { tier, detected, level, auto, ultra, gpu, phone, low: tier === 'low', mid: tier === 'mid', high: tier === 'high', budget, dprCap, minPR, startPR, governor, setLevel };
  })();
  // ---- Graphics panel in the header: Auto (default) or a fixed level, remembered on this browser ----
  const buildGfx = () => {
    const tools = document.querySelector('.hdr .tools'); if (!tools || tools.querySelector('.gfx')) return;
    const P = window.PERF, names = { auto: 'Auto', low: 'Low', medium: 'Medium', high: 'High', ultra: 'Ultra' };
    const notes = { auto: 'Picks for this device and keeps it smooth', low: 'Phones and older computers', medium: 'Built-in laptop graphics', high: 'A dedicated graphics card', ultra: 'Full resolution and every effect, nothing scaled down' };
    const wrap = document.createElement('div'); wrap.className = 'gfx';
    wrap.innerHTML = '<button class="sound gfx-btn" type="button" aria-haspopup="true" aria-expanded="false" aria-controls="gfx-menu"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></svg><span class="t">Graphics: ' + names[P.level] + '</span></button>'
      + '<div class="gfx-menu glass" id="gfx-menu" role="radiogroup" aria-label="Graphics quality" hidden>'
      + Object.keys(names).map((k) => '<button type="button" role="radio" aria-checked="' + (k === P.level) + '" data-gfx="' + k + '"><b>' + names[k] + (k === 'auto' ? ' <i>(' + { low: 'low', mid: 'medium', high: 'high' }[P.detected] + ' here)</i>' : '') + '</b><span>' + notes[k] + '</span></button>').join('')
      + '<div class="gfx-sep" role="presentation"></div><div class="gfx-sub" role="radiogroup" aria-label="Motion">' + [['system', 'Follow system', sysRM ? 'Your device asks for reduced motion' : 'Your device allows motion'], ['full', 'Full motion', 'Video, reveals and the camera flight'], ['reduced', 'Reduced motion', 'Still images, no movement']].map((m) => '<button type="button" role="radio" aria-checked="' + (m[0] === motionPref) + '" data-motion="' + m[0] + '"><b>' + m[1] + '</b><span>' + m[2] + '</span></button>').join('') + '</div>'
      + '<p>The page reloads to apply.</p></div>';
    tools.insertBefore(wrap, tools.firstChild);
    const btn = wrap.querySelector('.gfx-btn'), menu = wrap.querySelector('.gfx-menu');
    const close = () => { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); };
    btn.addEventListener('click', (e) => { e.stopPropagation(); const open = menu.hidden; menu.hidden = !open; btn.setAttribute('aria-expanded', String(open)); if (open) (menu.querySelector('[aria-checked=true]') || menu.querySelector('button')).focus(); });
    menu.addEventListener('click', (e) => { const mb = e.target.closest('[data-motion]'); if (mb) { if (mb.dataset.motion !== motionPref) { try { localStorage.setItem('motion', mb.dataset.motion); } catch (er) { /* storage blocked */ } location.reload(); } else close(); return; } const b = e.target.closest('[data-gfx]'); if (!b) return; if (b.dataset.gfx === P.level) { close(); return; } P.setLevel(b.dataset.gfx); });
    menu.addEventListener('keydown', (e) => { const items = [...menu.querySelectorAll('[data-gfx],[data-motion]')], i = items.indexOf(document.activeElement); if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); items[(i + 1) % items.length].focus(); } if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); } if (e.key === 'Escape') { close(); btn.focus(); } });
    document.addEventListener('click', (e) => { if (!wrap.contains(e.target)) close(); });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', buildGfx); else buildGfx();
  const SITE = window.SITE = { rm, touch, glOk, progress: 0, listeners: [], onScroll: (f) => SITE.listeners.push(f) };
  gsap.registerPlugin(ScrollTrigger, SplitText);

  // ---- smooth scrolling (Lenis) driven by the GSAP ticker so ScrollTrigger, the 3D scenes and the drone blends move as one;
  //      touch screens keep their own native momentum, and reduced motion keeps plain scrolling ----
  SITE.lenis = null;
  if (!rm && window.Lenis && !window.matchMedia('(pointer: coarse)').matches) {
    const lenis = SITE.lenis = new Lenis({ lerp: 0.085, smoothWheel: true, wheelMultiplier: 0.9, touchMultiplier: 1 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000)); gsap.ticker.lagSmoothing(0);
  }
  // every scene and overlay draws in the same tick as the scroll, after Lenis has moved the page, so backgrounds never lag the text
  SITE.loop = (fn) => { if (window.gsap) gsap.ticker.add(() => fn(performance.now())); else { const l = (n) => { requestAnimationFrame(l); fn(n); }; requestAnimationFrame(l); } };
  document.querySelectorAll('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    if (id.length < 2) return;
    const el = document.querySelector(id);
    if (!el) return;
    e.preventDefault();
    if (SITE.lenis) SITE.lenis.scrollTo(el, { duration: 1.4 }); else el.scrollIntoView({ behavior: rm ? 'auto' : 'smooth', block: 'start' });
    el.setAttribute('tabindex', '-1');
    el.focus({ preventScroll: true });
  }));

  // ---- header: hide on scroll down, show on scroll up; colour follows the section ----
  const hdr = document.querySelector('.hdr'); let lastY = 0;
  const onScrollHdr = () => {
    const y = window.scrollY, dy = y - lastY; lastY = y;
    if (hdr && y > 140 && dy > 4) hdr.classList.add('hide'); else if (hdr && dy < -4) hdr.classList.remove('hide');
    const max = document.documentElement.scrollHeight - innerHeight; SITE.progress = max > 0 ? y / max : 0;
    const pct = document.querySelector('[data-hud=pct]'); if (pct) pct.textContent = String(Math.round(SITE.progress * 100)).padStart(3, '0') + '%';
    SITE.listeners.forEach((f) => f(SITE.progress, y));
    let dark = document.body.dataset.base === 'dark';
    document.querySelectorAll('[data-tone]').forEach((s) => { const r = s.getBoundingClientRect(); if (r.top < 60 && r.bottom > 60) dark = s.dataset.tone === 'dark'; });
    if (hdr) hdr.classList.toggle('dark', dark); document.body.classList.toggle('dark', dark);
  };
  window.addEventListener('scroll', onScrollHdr, { passive: true });

  // ---- HUD: clock in New York, section counter ----
  const clock = document.querySelector('[data-hud=clock]');
  const tick = () => { if (clock) clock.textContent = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZoneName: 'short' }).format(new Date()); };
  tick(); setInterval(tick, 1000);
  const secs = Array.from(document.querySelectorAll('[data-section]')), secHud = document.querySelector('[data-hud=sec]'), secName = document.querySelector('[data-hud=name]');
  secs.forEach((s, i) => ScrollTrigger.create({ trigger: s, start: 'top 55%', end: 'bottom 55%', onToggle: (st) => { if (!st.isActive) return; if (secHud) secHud.textContent = String(i + 1).padStart(2, '0') + ' / ' + String(secs.length).padStart(2, '0'); if (secName) secName.textContent = s.dataset.section; SITE.section = i; } }));

  // ---- custom cursor (delta-time smoothed for 60Hz-240Hz parity; disabled on touch & reduced motion) ----
  if (!touch && !rm) {
    const c = document.createElement('div'); c.className = 'cursor'; c.setAttribute('aria-hidden', 'true'); document.body.appendChild(c);
    let x = innerWidth / 2, y = innerHeight / 2, cx = x, cy = y, seen = false;
    window.addEventListener('pointermove', (e) => {
      x = e.clientX; y = e.clientY;
      if (!seen) { seen = true; cx = x; cy = y; c.classList.add('seen'); }
    }, { passive: true });
    gsap.ticker.add((t, deltaRatio, frame) => {
      if (!seen) return;
      const dt = Math.min(0.05, (gsap.ticker.deltaRatio(60) || 1) / 60);
      const k = 1 - Math.exp(-dt * 14);
      cx += (x - cx) * k; cy += (y - cy) * k;
      c.style.transform = `translate3d(${cx.toFixed(1)}px,${cy.toFixed(1)}px,0)`;
    });
    document.addEventListener('pointerover', (e) => { c.classList.toggle('big', !!e.target.closest('a,button,[data-hover]')); });
  }

  // ---- buttons: frost fill spreads from the pointer; cards tilt with a moving highlight ----
  document.querySelectorAll('.btn').forEach((b) => b.addEventListener('pointerenter', (e) => { const r = b.getBoundingClientRect(); b.style.setProperty('--x', e.clientX - r.left + 'px'); b.style.setProperty('--y', e.clientY - r.top + 'px'); SITE.click && SITE.click(); }));
  if (!touch && !rm) document.querySelectorAll('.tilt').forEach((el) => {
    el.addEventListener('pointermove', (e) => { const r = el.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height; el.style.transform = `perspective(900px) rotateX(${(0.5 - py) * 6}deg) rotateY(${(px - 0.5) * 8}deg)`; el.style.setProperty('--mx', px * 100 + '%'); el.style.setProperty('--my', py * 100 + '%'); });
    el.addEventListener('pointerleave', () => { el.style.transform = ''; });
  });

  // ---- reveals: headings line by line, blocks with a clip-path mask and a slight scale-in ----
  SITE.reveals = () => {
    if (rm) return;
    document.querySelectorAll('[data-split]').forEach((h) => {
      if (h.dataset.splitDone) return; h.dataset.splitDone = 1;
      const st = new SplitText(h, { type: 'lines,words', linesClass: 'line-mask' });
      gsap.from(st.words, { yPercent: 110, opacity: 0, duration: 1.1, ease: 'expo.out', stagger: 0.04, scrollTrigger: { trigger: h, start: 'top 82%' } });
    });
    document.querySelectorAll('[data-fade]').forEach((el) => gsap.from(el, { y: 26, opacity: 0, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 86%' } }));
    document.querySelectorAll('.reveal').forEach((el) => gsap.to(el, { clipPath: 'inset(0 0 0% 0)', scale: 1, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 85%' } }));
    document.querySelectorAll('[data-stagger]').forEach((g) => gsap.from(g.children, { y: 40, opacity: 0, duration: 1, ease: 'power3.out', stagger: 0.08, scrollTrigger: { trigger: g, start: 'top 85%' } }));
  };

  // ---- rotating "I build ..." line ----
  document.querySelectorAll('.rot').forEach((r) => { const items = Array.from(r.children); let i = 0; items[0].classList.add('on'); if (rm) return; setInterval(() => { items[i].classList.remove('on'); i = (i + 1) % items.length; items[i].classList.add('on'); }, 3200); });

  // ---- count-ups ----
  SITE.countUp = (el, to, dur) => { const o = { v: 0 }; gsap.to(o, { v: to, duration: dur || 1.8, ease: 'expo.out', onUpdate: () => { el.textContent = Math.round(o.v); } }); };
  document.querySelectorAll('[data-count]').forEach((el) => { const to = +el.dataset.count; if (rm) { el.textContent = to; return; } el.textContent = '0'; ScrollTrigger.create({ trigger: el, start: 'top 90%', once: true, onEnter: () => SITE.countUp(el, to) }); });

  // ---- sound: wind ambience and crystal clicks (off by default) ----
  SITE.audio = null; SITE.soundOn = false; const soundBtn = document.querySelector('.sound');
  SITE.ensureAudio = () => {
    if (SITE.audio) return SITE.audio;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    const ac = SITE.audio = new AC(), master = SITE.master = ac.createGain(); master.gain.value = 0; master.connect(ac.destination);
    if (document.body.dataset.wind !== 'off') {
      const len = ac.sampleRate * 4, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0); let b = 0;
      for (let i = 0; i < len; i++) { b = 0.985 * b + 0.015 * (Math.random() * 2 - 1); d[i] = b * 3; }
      const src = ac.createBufferSource(); src.buffer = buf; src.loop = true;
      const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 520; bp.Q.value = 0.7;
      const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 260; lfo.connect(lg); lg.connect(bp.frequency); lfo.start();
      const wg = ac.createGain(); wg.gain.value = 0.35; src.connect(bp); bp.connect(wg); wg.connect(master); src.start();
    }
    return ac;
  };
  SITE.click = () => {
    if (!SITE.soundOn || !SITE.audio) return; const ac = SITE.audio, t = ac.currentTime;
    [2600 + Math.random() * 1400, 5200 + Math.random() * 1600].forEach((f, k) => { const o = ac.createOscillator(), g = ac.createGain(); o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(k ? 0.03 : 0.06, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35); o.connect(g); g.connect(SITE.master); o.start(t); o.stop(t + 0.4); });
  };
  SITE.setSound = (on) => {
    SITE.soundOn = on; const ac = SITE.ensureAudio(); if (!ac) return;
    if (on) ac.resume(); SITE.master.gain.setTargetAtTime(on ? 0.9 : 0, ac.currentTime, 0.25);
    if (soundBtn) { soundBtn.setAttribute('aria-pressed', on ? 'true' : 'false'); soundBtn.querySelector('.t').textContent = on ? 'Sound on' : 'Sound off'; }
    SITE.listeners.forEach((f) => f(SITE.progress, window.scrollY, 'sound'));
    document.dispatchEvent(new CustomEvent('site:sound', { detail: on }));
  };
  if (soundBtn) soundBtn.addEventListener('click', () => SITE.setSound(!SITE.soundOn));

  // ---- preloader: scenic mountain frame, swift progress hairline, calm fade-out (zero artificial stall) ----
  SITE.boot = (loadPromise, onDone) => {
    const pre = document.querySelector('.pre');
    const cnt = pre && pre.querySelector('.count');
    const bar = pre && pre.querySelector('.pre-bar i');
    let shown = 0, target = 0.12, doneFlag = false, lastT = performance.now();
    const step = () => {
      const now = performance.now(), dtt = Math.min(0.12, (now - lastT) / 1000); lastT = now;
      const rate = target >= 1 ? 4.8 : 1.6;
      shown = Math.min(target, shown + dtt * rate);
      if (target >= 1 && shown > 0.985) shown = 1;
      if (cnt) cnt.textContent = String(Math.round(shown * 100)).padStart(3, '0');
      if (bar) bar.style.transform = `scaleX(${shown.toFixed(4)})`;
      if (shown < 1) requestAnimationFrame(step); else finish();
    };
    const finish = () => {
      if (doneFlag) return;
      doneFlag = true;
      if (pre) pre.classList.add('done');
      onDone && onDone();
      ScrollTrigger.refresh();
      if (rm) { SITE.reveals(); return; }
      const tl = gsap.timeline();
      const t = document.querySelector('[data-intro]');
      if (t) {
        const st = new SplitText(t, { type: 'chars,lines', linesClass: 'line-mask' });
        tl.from(st.chars, { yPercent: 105, opacity: 0, duration: 0.85, ease: 'expo.out', stagger: 0.022 }, 0.08);
      }
      document.querySelectorAll('[data-intro-fade]').forEach((el, i) => tl.from(el, { y: 18, opacity: 0, duration: 0.72, ease: 'power3.out' }, 0.16 + i * 0.07));
      SITE.reveals();
    };
    const fake = setInterval(() => { target = Math.min(0.92, target + 0.06); }, 60);
    (loadPromise || Promise.resolve()).catch(() => {}).then(() => { clearInterval(fake); target = 1; if (rm) shown = 1; });
    SITE.setLoad = (v) => { target = Math.max(target, Math.min(0.97, v)); };
    requestAnimationFrame(step);
  };
  onScrollHdr();
})();
