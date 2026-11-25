/* Shared site behaviour: smooth scroll, preloader, header, HUD, cursor, reveals, sound. window.SITE */
(function () {
  const rm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const touch = window.matchMedia('(hover: none), (pointer: coarse)').matches;
  const root = document.documentElement; root.classList.remove('js-off'); if (rm) root.classList.add('rm');
  const glOk = (() => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } })();
  if (!glOk) root.classList.add('nogl');
  const SITE = window.SITE = { rm, touch, glOk, progress: 0, listeners: [], onScroll: (f) => SITE.listeners.push(f) };
  gsap.registerPlugin(ScrollTrigger, SplitText);

  // ---- pure 100% native scrolling (instant wheel/trackpad response, zero artificial inertia lag) ----
  SITE.lenis = null;
  document.querySelectorAll('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    if (id.length < 2) return;
    const el = document.querySelector(id);
    if (!el) return;
    e.preventDefault();
    el.scrollIntoView({ behavior: rm ? 'auto' : 'smooth', block: 'start' });
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
