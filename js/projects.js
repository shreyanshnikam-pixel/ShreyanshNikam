/* Projects: two real places, split down the middle, each made three-dimensional in WebGL (three.js).
   Left, Sky Sentry: a KLM jet landing at Schiphol over the approach lights (Luka Slapnicar, Unsplash). The approach
   lights run their strobe toward the runway, and a flock crosses the sky; hover and the flock is picked out with
   detection brackets, the way the app sees it.
   Right, Echo: the timbered entrance of the Iwami Ginzan silver mine (Yosuke Ota, Unsplash), graded to night. A lamp
   flickers deep in the tunnel and a sonar ping rolls out of it, showing the true colours only where the sound passes,
   as Echo's echolocation does. Each photo is a finely divided surface pushed into depth by a depth map (Depth Anything V2),
   so the camera's drift and your mouse give real parallax. Hover widens a side; choosing one flies the camera in. */
(function () {
  const T = THREE, S0 = window.SITE, PF = window.PERF;
  const cv = document.getElementById('pgl'), stage = document.querySelector('.pstage');
  const pans = Array.from(document.querySelectorAll('.pan')), flashEl = document.querySelector('.flash');
  const rm = S0.rm;
  if (!S0.glOk || !cv) { S0.boot(Promise.resolve()); return; }
  let R;
  try { R = new T.WebGLRenderer({ canvas: cv, antialias: false, powerPreference: 'high-performance' }); }
  catch (e) { S0.boot(Promise.resolve()); return; }
  document.documentElement.classList.add('gl');
  R.outputEncoding = T.LinearEncoding; R.autoClear = false; R.setClearColor(0x06090C, 1); R.setScissorTest(true);

  const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const lerp = (a, b, k) => a + (b - a) * k;
  const Q = PF.ultra ? 4 : PF.high ? 3 : PF.mid ? 2 : 1;
  const segs = [0, [110, 70], [200, 130], [300, 200], [400, 260]][Q];
  let curPR = PF.startPR(innerWidth, innerHeight);
  const gov = PF.governor((pr) => { curPR = pr; size(); }, () => [innerWidth, innerHeight]); gov.started = true; gov.pr = curPR; gov.settle = 40;

  const D = 10, FOV = 38;
  const VS = [
    'uniform sampler2D tMap; uniform float uK; varying vec2 vUv; varying float vD;',
    'void main(){ vUv = uv; vec4 m = texture2D(tMap, uv); vD = m.r;',
    '  vec3 p = position; p.z += pow(m.a, 1.3) * uK; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }'].join('\n');
  const NOISE = [
    'float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
    'float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h2(i), h2(i+vec2(1,0)), f.x), mix(h2(i+vec2(0,1)), h2(i+vec2(1,1)), f.x), f.y); }'].join('\n');
  // Sky Sentry: the photo, a soft drift in the sky, and the approach lights' sequenced strobe running toward the runway
  const FS_SKY = ['uniform sampler2D tImg, tMap; uniform float uT, uH, uDim, uFly, uVeil; varying vec2 vUv; varying float vD;', NOISE,
    'void main(){',
    '  vec4 m = texture2D(tMap, vUv); float sky = m.b, lit = m.g;',
    '  vec2 uv = vUv; uv.x += sky * (n2(vUv * 3.0 + uT * 0.03) - 0.5) * 0.003;',
    '  vec3 col = texture2D(tImg, uv).rgb;',
    '  float rabbit = pow(fract(uT * 0.9 - vD * 2.4), 22.0);',
    '  col += vec3(1.0, 0.86, 0.6) * lit * (0.22 + 0.9 * rabbit * (0.45 + 0.55 * uH));',
    '  col = mix(col, col * vec3(0.78, 0.84, 0.92), uDim * 0.55);',
    '  col *= 1.0 - 0.6 * uVeil; gl_FragColor = vec4(col, 1.0); }'].join('\n');
  // Echo: night grade, a lamp deep in the tunnel, and a sonar ring that shows the real colours as it passes
  const FS_MINE = ['uniform sampler2D tImg, tMap; uniform float uT, uH, uDim, uPing, uFly, uAsp, uVeil; uniform vec2 uC; varying vec2 vUv; varying float vD;', NOISE,
    'void main(){',
    '  vec3 src = texture2D(tImg, vUv).rgb; float lum = dot(src, vec3(0.299, 0.587, 0.114));',
    '  vec3 night = src * vec3(0.20, 0.25, 0.34) + vec3(0.02, 0.03, 0.05) * lum;',
    '  vec2 d = (vUv - uC) * vec2(uAsp, 1.0); float r = length(d);',
    '  float tunnel = smoothstep(0.30, 0.05, vD) * smoothstep(0.42, 0.06, r);',
    '  float flick = 0.78 + 0.22 * n2(vec2(uT * 9.0, 1.7)) * n2(vec2(uT * 3.1, 4.2));',
    '  vec3 lamp = vec3(1.0, 0.62, 0.3) * (src * 2.4 + 0.05) * tunnel * flick * (0.85 + 0.6 * uH);',
    '  vec3 col = night + lamp + vec3(1.0, 0.55, 0.25) * 0.10 * smoothstep(0.35, 0.0, r) * flick;',
    '  float ring = 0.0; for (int k = 0; k < 2; k++) { float ph = fract(uPing - float(k) * 0.5); float rr = ph * 1.25;',
    '    ring += exp(-pow((r - rr) / 0.045, 2.0)) * pow(1.0 - ph, 1.5) * (0.6 + 0.4 * uH); }',
    '  col = mix(col, src * 1.05, clamp(ring, 0.0, 1.0)) + vec3(0.45, 0.75, 1.0) * ring * 0.22;',
    '  col = mix(col, col * 0.6, uDim * 0.6);',
    '  col *= 1.0 - 0.6 * uVeil; gl_FragColor = vec4(col, 1.0); }'].join('\n');

  const TL = new T.TextureLoader();
  const tex = (u, mips) => new Promise((res) => TL.load(u, (t) => { t.encoding = T.LinearEncoding; if (mips) { t.anisotropy = R.capabilities.getMaxAnisotropy(); } else { t.minFilter = T.LinearFilter; t.generateMipmaps = false; } res(t); }, undefined, () => res(null)));
  const big = Q >= 3 ? '_4k.webp' : '_2k.webp';

  // fu, fv: the point of interest each side keeps in view; k: depth relief
  const P = [
    { name: 'sky', asp: 16 / 9, over: 1.1, fu: 0.56, fv: 0.4, fly: [0.42, 0.37], k: 1.3, fs: FS_SKY, flash: '#F4F7FA' },
    { name: 'mine', asp: 1.5, over: 1.45, fu: 0.5, fv: 0.9, fly: [0.5, 0.74], k: 2.2, fs: FS_MINE, flash: '#05070A' },
  ];
  P.forEach((p, i) => {
    p.i = i; p.el = pans[i]; p.S = new T.Scene(); p.C = new T.PerspectiveCamera(FOV, 1, 0.1, 100);
    p.u = { tImg: { value: null }, tMap: { value: null }, uK: { value: p.k }, uT: { value: 0 }, uH: { value: 0 }, uDim: { value: 0 }, uFly: { value: 0 }, uVeil: { value: 0 }, uPing: { value: 0 }, uAsp: { value: p.asp }, uC: { value: new T.Vector2(p.fly[0], 1 - p.fly[1]) } };
    p.mesh = new T.Mesh(new T.PlaneGeometry(1, 1 / p.asp, segs[0], segs[1]), new T.ShaderMaterial({ uniforms: p.u, vertexShader: VS, fragmentShader: p.fs }));
    p.S.add(p.mesh); p.st = { h: 0, dim: 0 }; p.rect = { x: 0, y: 0, w: 1, h: 1 };
  });
  P[1].u.uC.value.set(P[1].fly[0], 1 - P[1].fly[1]);

  // ---- the flock over Sky Sentry: small birds with flapping wings, drawn as points; on hover each gets a detection bracket ----
  const NB = [0, 18, 26, 34, 40][Q], bird = new Float32Array(NB * 4);
  for (let i = 0; i < NB; i++) { bird[i * 4] = Math.random(); bird[i * 4 + 1] = Math.random(); bird[i * 4 + 2] = Math.random(); bird[i * 4 + 3] = Math.random(); }
  const bg = new T.BufferGeometry(); bg.setAttribute('position', new T.BufferAttribute(new Float32Array(NB * 3), 3)); bg.setAttribute('aR', new T.BufferAttribute(bird, 4));
  const bU = { uT: { value: 0 }, uH: { value: 0 }, uPx: { value: 1 }, uW: { value: 1 }, uA: { value: 1 } };
  const birds = new T.Points(bg, new T.ShaderMaterial({ uniforms: bU, transparent: true, depthTest: false,
    vertexShader: [
      'attribute vec4 aR; uniform float uT, uPx, uW; varying vec4 vR; varying float vF;',
      'void main(){ vR = aR; float s = 0.009 + aR.w * 0.006;',
      // a loose flock drifting right to left across the upper sky, wrapping around
      '  float x = fract(aR.x * 0.22 - uT * (0.014 + aR.z * 0.004)) * 0.8 - 0.4; float y = 0.1 + aR.y * 0.13 + sin(uT * 0.4 + aR.x * 9.0) * 0.012;',
      '  vF = sin(uT * (9.0 + aR.z * 5.0) + aR.x * 40.0);',
      '  vec3 p = vec3(x * uW, y * uW, 0.45); gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); gl_PointSize = max(6.0, s * uW * uPx / gl_Position.w); }'].join('\n'),
    fragmentShader: [
      'uniform float uH, uA; varying vec4 vR; varying float vF;',
      'void main(){ vec2 c = gl_PointCoord * 2.0 - 1.0; c.y = -c.y;',
      // the bird: two wings in a shallow V whose angle follows the flap
      '  float w = 0.18 + 0.32 * vF; float body = abs(c.y - abs(c.x) * w * 1.6 + 0.05) - (0.07 - abs(c.x) * 0.045);',
      '  float b = (1.0 - smoothstep(0.0, 0.05, body)) * step(abs(c.x), 0.62) * step(abs(c.y), 0.6);',
      // the detection bracket: four corners, cut away along the edges
      '  vec2 a = abs(c); float edge = step(0.86, max(a.x, a.y)) * step(max(a.x, a.y), 0.95); float corner = step(0.62, min(a.x, a.y));',
      '  float br = edge * corner * uH * step(vR.w, 0.75);',
      '  vec3 col = mix(vec3(0.05, 0.07, 0.09), vec3(0.3, 0.85, 1.0), step(0.5, br));',
      '  float al = max(b * 0.92, br) * uA; if (al < 0.01) discard; gl_FragColor = vec4(col, al); }'].join('\n'),
  }));
  birds.frustumCulled = false; if (NB) P[0].S.add(birds);

  // ---- dust in the mine's lamplight ----
  const ND = [0, 60, 120, 180, 220][Q], dust = new Float32Array(ND * 3);
  for (let i = 0; i < ND * 3; i++) dust[i] = Math.random();
  const dg = new T.BufferGeometry(); dg.setAttribute('position', new T.BufferAttribute(new Float32Array(ND * 3), 3)); dg.setAttribute('aR', new T.BufferAttribute(dust, 3));
  const dU = { uT: { value: 0 }, uPx: { value: 1 }, uW: { value: 1 }, uC: { value: new T.Vector2() }, uH: { value: 0 } };
  const motes = new T.Points(dg, new T.ShaderMaterial({ uniforms: dU, transparent: true, depthTest: false, blending: T.AdditiveBlending,
    vertexShader: [
      'attribute vec3 aR; uniform float uT, uPx, uW; uniform vec2 uC; varying float vA;',
      'void main(){ vec3 p = vec3(uC.x + (aR.x - 0.5) * 0.12 + sin(uT * 0.2 + aR.y * 20.0) * 0.006, uC.y + fract(aR.y + uT * (0.004 + aR.z * 0.006)) * 0.12 - 0.05, 0.0); p.xy *= uW; p.z = 0.4 + aR.z * 1.4;',
      '  vA = (0.25 + 0.75 * aR.z) * sin(fract(aR.y + uT * (0.004 + aR.z * 0.006)) * 3.1416);',
      '  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); gl_PointSize = (1.2 + aR.z * 2.4) * uPx; }'].join('\n'),
    fragmentShader: 'uniform float uH; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d) * vA * (0.35 + 0.4 * uH); gl_FragColor = vec4(vec3(1.0, 0.7, 0.4) * a, a); }',
  }));
  motes.frustumCulled = false; if (ND) P[1].S.add(motes);

  // ---- layout: each side's camera frames its photo to cover that side, keeping the point of interest in view ----
  const tanH = Math.tan(T.MathUtils.degToRad(FOV / 2));
  const stack = () => innerWidth <= 760;
  function size() { R.setPixelRatio(curPR); R.setSize(innerWidth, innerHeight, false); }
  function measure() {
    if (!stack()) {
      const wl = Math.round(innerWidth * parseFloat(getComputedStyle(stage).getPropertyValue('--split') || 0.5));
      P[0].rect = { x: 0, y: 0, w: Math.max(1, wl), h: innerHeight, top: 0, bottom: innerHeight };
      P[1].rect = { x: wl, y: 0, w: Math.max(1, innerWidth - wl), h: innerHeight, top: 0, bottom: innerHeight };
      return;
    }
    P.forEach((p) => {
      const r = p.el.getBoundingClientRect();
      p.rect = { x: Math.max(0, r.left), y: Math.max(0, r.top), w: Math.max(1, Math.min(innerWidth, r.right) - Math.max(0, r.left)), h: Math.max(1, Math.min(innerHeight, r.bottom) - Math.max(0, r.top)), top: r.top, bottom: r.bottom, fullH: r.height };
    });
  }
  window.addEventListener('resize', () => { size(); measure(); });
  size();

  // ---- hover, split and fly-in ----
  let hover = -1, focusI = -1, active = -2, flying = false;
  const split = { v: 0.5 }, fly = { p: 0, i: -1 };
  const setActive = (i) => {
    if (i === active) return; active = i;
    pans.forEach((a, k) => { a.classList.toggle('on', k === i); a.classList.toggle('dim', i >= 0 && k !== i); });
    if (stack()) return;
    const to = i === 0 ? 0.62 : i === 1 ? 0.38 : 0.5;
    if (rm || !window.gsap) { split.v = to; stage.style.setProperty('--split', to); return; }
    gsap.to(split, { v: to, duration: 1.1, ease: 'expo.out', overwrite: true, onUpdate: () => stage.style.setProperty('--split', split.v.toFixed(4)) });
  };
  const pick = () => { if (!flying) setActive(focusI >= 0 ? focusI : hover); };
  pans.forEach((a, i) => {
    a.addEventListener('pointerenter', (e) => { if (e.pointerType !== 'touch') { hover = i; pick(); } });
    a.addEventListener('pointerleave', () => { if (hover === i) hover = -1; pick(); });
    a.addEventListener('focus', () => { focusI = i; pick(); });
    a.addEventListener('blur', () => { if (focusI === i) focusI = -1; pick(); });
    a.addEventListener('click', (e) => {
      if (rm || flying || e.defaultPrevented || e.button > 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault(); flying = true; fly.i = i; setActive(i);
      if (!stack()) gsap.to(split, { v: i === 0 ? 1 : 0, duration: 1.0, ease: 'expo.inOut', overwrite: true, onUpdate: () => stage.style.setProperty('--split', split.v.toFixed(4)) });
      gsap.to(fly, { p: 1, duration: 1.15, ease: 'power3.inOut', onComplete: () => { location.href = a.href; } });
      if (flashEl) { flashEl.style.background = P[i].flash; gsap.to(flashEl, { opacity: 1, duration: 0.4, delay: 0.8, ease: 'power2.in' }); }
    });
  });
  window.addEventListener('pageshow', (e) => {
    if (!e.persisted) return; flying = false; fly.p = 0; fly.i = -1; active = -2;
    if (flashEl) { gsap.set(flashEl, { opacity: 0 }); flashEl.style.background = ''; }
    setActive(-1);
  });

  const mouse = new T.Vector2(), mt = new T.Vector2();
  window.addEventListener('pointermove', (e) => { if (e.pointerType !== 'touch') mt.set(e.clientX / innerWidth * 2 - 1, e.clientY / innerHeight * 2 - 1); }, { passive: true });

  // a side's camera: cover its rectangle with the photo, then drift, follow the mouse, push in with the scroll, fly in on choice
  const place = (p, t, sc) => {
    const r = p.rect, asp = r.w / r.h, C = p.C; C.aspect = asp;
    const PWv = p.over * Math.max(2 * D * tanH * asp, 2 * D * tanH * p.asp);
    p.mesh.scale.set(PWv, PWv, 1); const PH = PWv / p.asp;
    const f = fly.i === p.i ? fly.p : 0, push = ss(0, 1, sc) * 0.16 + p.st.h * 0.05;
    const d = D * (1 - push - 0.62 * ss(0, 1, f));
    const hh = d * tanH, hw = hh * asp, mx = Math.max(0, PWv / 2 - hw - 0.2), my = Math.max(0, PH / 2 - hh - 0.2);
    const ku = lerp(p.fu, p.fly[0], ss(0, 0.8, f)), kv = lerp(p.fv, p.fly[1], ss(0, 0.8, f));
    const x = Math.max(-mx, Math.min(mx, (ku - 0.5) * PWv)), y = Math.max(-my, Math.min(my, (0.5 - kv) * PH));
    const o = rm ? 0 : 1, sway = Math.sin(t * 0.18 + p.i * 2) * 0.18 * o;
    C.position.set(x + mouse.x * 0.45 * o + sway, y - mouse.y * 0.28 * o + Math.cos(t * 0.15 + p.i) * 0.08 * o, d);
    C.lookAt(x, y, 0); C.updateProjectionMatrix();
    return PWv;
  };

  let ready = false, last = 0; const t0 = performance.now();
  const load = Promise.all(P.map((p) => Promise.all([tex('assets/projects/' + p.name + big, true), tex('assets/projects/' + p.name + '_maps.png', false)]).then(([a, b]) => { p.u.tImg.value = a; p.u.tMap.value = b; return a && b; })))
    .then((ok) => { ready = ok.every(Boolean); measure(); });

  function frame(now) {
    if (!ready || document.hidden) { last = now; return; }
    if (!rm) gov.tick(now);
    const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
    const t = rm ? 4 : (now - t0) / 1000;
    mouse.lerp(mt, 1 - Math.exp(-dt * 3));
    measure();
    const sc = Math.min(1.5, Math.max(0, scrollY / Math.max(1, innerHeight)));
    const pr = R.getPixelRatio();
    R.setScissorTest(false); R.clear(); R.setScissorTest(true);
    P.forEach((p) => {
      const k = 1 - Math.exp(-dt * 6), on = active === p.i ? 1 : 0, off = active >= 0 && active !== p.i ? 1 : 0;
      p.st.h += (on - p.st.h) * (rm ? 1 : k); p.st.dim += (off - p.st.dim) * (rm ? 1 : k);
      const r = p.rect; if (r.w < 2 || r.h < 2 || r.bottom < 0 || r.top > innerHeight) return;
      const PWv = place(p, t, sc);
      p.u.uT.value = t; p.u.uH.value = p.st.h; p.u.uDim.value = p.st.dim; p.u.uVeil.value = ss(0.25, 0.95, sc);
      p.u.uPing.value = rm ? 0.35 : t / (3.6 - 1.2 * p.st.h) % 1;
      if (p.i === 0) { bU.uT.value = t; bU.uH.value = p.st.h; bU.uW.value = PWv; bU.uPx.value = pr * r.h / 2 / tanH; bU.uA.value = 1 - ss(0, 0.6, fly.i === 0 ? fly.p : 0); }
      else { dU.uT.value = t; dU.uW.value = PWv; dU.uPx.value = pr; dU.uH.value = p.st.h; dU.uC.value.set(p.fly[0] - 0.5, (0.5 - p.fly[1]) / p.asp); }
      const y = innerHeight - r.y - r.h; R.setViewport(r.x, y, r.w, r.h); R.setScissor(r.x, y, r.w, r.h);
      R.render(p.S, p.C);
    });
  }
  window.__proj = { R, P, gov, split };
  S0.boot(load, () => { measure(); });
  S0.loop(frame);
})();
