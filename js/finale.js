/* Home finale: Lake Louise in real photographs, made three-dimensional in WebGL (three.js).
   Two Unsplash photos (Andrew Ly: canoes on the lake under Victoria Glacier; Peter Jackson: red canoes on the dock),
   each turned into a finely divided surface pushed into depth by a depth map (Depth Anything V2), so the camera moves
   through the scene with real parallax. The water (SegFormer mask) ripples and glints, the sky drifts. Your scroll drives
   everything: the push in over the floating canoes, the dissolve, and the glide toward the dock at the very end. */
(function () {
  const T = THREE, S0 = window.SITE, PF = window.PERF;
  const cv = document.getElementById('world');
  if (!S0.glOk || !cv) { S0.boot(Promise.resolve()); return; }
  const BASE = 'assets/finale/', rm = S0.rm;
  const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const lerp = (a, b, k) => a + (b - a) * k;
  const Q = PF.ultra ? 4 : PF.high ? 3 : PF.mid ? 2 : 1;

  const R = new T.WebGLRenderer({ canvas: cv, antialias: PF.high, powerPreference: 'high-performance' });
  R.outputEncoding = T.LinearEncoding; R.autoClear = false; R.setClearColor(0xE7EEF4, 1);
  const C = new T.PerspectiveCamera(40, innerWidth / innerHeight, 0.1, 100);
  let curPR = PF.startPR(innerWidth, innerHeight);
  const resize = () => { R.setPixelRatio(curPR); R.setSize(innerWidth, innerHeight, false); C.aspect = innerWidth / innerHeight; C.updateProjectionMatrix(); fit(); };
  const gov = PF.governor((pr) => { curPR = pr; resize(); }, () => [innerWidth, innerHeight]); gov.started = true; gov.pr = curPR; gov.settle = 40;

  const D = 10, K = 1.5; // camera distance to the photo plane; how far the nearest things stand out of it
  const scenes = [];
  const TL = new T.TextureLoader();
  const tex = (u) => new Promise((res) => TL.load(u, (t) => { t.encoding = T.LinearEncoding; t.anisotropy = R.capabilities.getMaxAnisotropy(); t.minFilter = T.LinearMipmapLinearFilter; res(t); }, undefined, () => res(null)));
  const segs = [0, [96, 64], [180, 120], [300, 200], [420, 280]][Q];

  const VS = [
    'uniform sampler2D tMap; uniform float uK; varying vec2 vUv; varying float vD;',
    'void main(){ vUv = uv; vec4 m = texture2D(tMap, uv); float d = pow(m.a, 1.3); vD = m.r;',
    '  vec3 p = position; p.z += d * uK; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }'].join('\n');
  const FS = [
    'uniform sampler2D tImg, tMap; uniform float uT, uA, uGlint; varying vec2 vUv; varying float vD;',
    'float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
    'float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h2(i), h2(i+vec2(1,0)), f.x), mix(h2(i+vec2(0,1)), h2(i+vec2(1,1)), f.x), f.y); }',
    'void main(){',
    '  vec4 m = texture2D(tMap, vUv); float water = smoothstep(0.35, 0.9, m.g), sky = smoothstep(0.35, 0.9, m.b);',
    // gentle wind ripples: they shrink toward the far shore, the way perspective squeezes real waves
    '  float far = 1.0 - smoothstep(0.0, 0.55, vD); vec2 q = vec2(vUv.x * 60.0, vUv.y * 260.0 * (1.0 + far)) + vec2(uT * 0.35, uT * 0.9);',
    '  float e = 0.08, c = n2(q); vec2 g = vec2(n2(q + vec2(e, 0.0)) - c, n2(q + vec2(0.0, e)) - c) / e;',
    '  vec2 uv = vUv + g * vec2(0.0012, 0.0024) * (0.35 + 0.65 * (1.0 - far)) * water;',
    '  uv.x += sky * sin(uT * 0.07) * 0.004;',
    '  vec3 col = texture2D(tImg, uv).rgb;',
    '  float lum = dot(col, vec3(0.299, 0.587, 0.114));',
    '  col += vec3(1.0, 0.97, 0.9) * pow(max(g.y * 0.5 + 0.5, 0.0), 14.0) * smoothstep(0.45, 0.85, lum) * water * uGlint;',
    '  gl_FragColor = vec4(col, uA); }'].join('\n');

  const makeScene = async (name) => {
    const [img, map] = await Promise.all([tex(BASE + name + (Q >= 3 ? '_4k.webp' : '_2k.webp')), tex(BASE + name + '_maps.png')]);
    if (!img || !map) return null;
    map.minFilter = T.LinearFilter; map.generateMipmaps = false;
    const S = new T.Scene(), u = { tImg: { value: img }, tMap: { value: map }, uK: { value: K }, uT: { value: 0 }, uA: { value: 1 }, uGlint: { value: Q >= 2 ? 0.55 : 0 } };
    const mesh = new T.Mesh(new T.PlaneGeometry(1, 1 / 1.5, segs[0], segs[1]), new T.ShaderMaterial({ uniforms: u, vertexShader: VS, fragmentShader: FS, transparent: true }));
    S.add(mesh); return { S, mesh, u, name };
  };
  // the plane overfills the view enough for the camera's drift
  // the photo fills the view with a little to spare (width on wide screens, height on phones); shots are framed in photo coordinates
  const tanH = () => Math.tan(T.MathUtils.degToRad(C.fov / 2));
  let PW = 1, PH = 1;
  function fit() { const hh = D * tanH(); PW = Math.max(2 * hh * C.aspect, 2 * hh * 1.5) * 1.1; PH = PW / 1.5; scenes.forEach((s) => s && s.mesh.scale.set(PW, PW, 1)); }

  let ready = false;
  const load = () => { if (load.done) return; load.done = true; Promise.all([makeScene('wide'), makeScene('dock')]).then((s) => { s.forEach((x) => scenes.push(x)); ready = scenes.every(Boolean); fit(); }); };
  window.addEventListener('resize', resize); resize();

  const secs = Array.from(document.querySelectorAll('main > section')), N = secs.length;
  const pos = () => { const mid = innerHeight * 0.5; for (let i = 0; i < N; i++) { const r = secs[i].getBoundingClientRect(); if (mid < r.bottom || i === N - 1) return i + Math.max(0, Math.min(1, (mid - r.top) / Math.max(1, r.height))); } return 0; };
  const mt = new T.Vector2(), mouse = new T.Vector2();
  window.addEventListener('pointermove', (e) => mt.set(e.clientX / innerWidth * 2 - 1, e.clientY / innerHeight * 2 - 1), { passive: true });
  let x = pos(), last = 0; const t0 = performance.now();

  // one camera move per photo; t runs 0..1 with the scroll
  // u, v: where in the photo the view is centred; d: distance as a share of D; o: sideways swing of the camera around that point
  const SHOTS = [
    [{ u: 0.5, v: 0.5, d: 1, o: -0.55 }, { u: 0.56, v: 0.8, d: 0.66, o: 0.35 }],   // the glacier and the lake, then down onto the floating canoes
    [{ u: 0.5, v: 0.4, d: 1, o: 0.5 }, { u: 0.56, v: 0.66, d: 0.88, o: -0.3 }],  // the dock: the mountains, then along the canoes
  ];
  // phones see a narrow slice of each photo, so there the camera stays further back and centres on the canoes themselves
  const SHOTS_P = [
    [{ u: 0.6, v: 0.5, d: 1, o: -0.3 }, { u: 0.66, v: 0.62, d: 0.9, o: 0.2 }],
    [{ u: 0.62, v: 0.45, d: 1, o: 0.3 }, { u: 0.74, v: 0.6, d: 0.94, o: -0.2 }],
  ];
  const shot = (i, t, cam, extra) => {
    const [a, b] = (C.aspect < 1 ? SHOTS_P : SHOTS)[i], e = t * t * (3 - 2 * t), d = D * lerp(a.d, b.d, e) - extra;
    const hh = d * tanH() * 1.02, hw = hh * C.aspect, mx = Math.max(0, PW / 2 - hw - 0.35), my = Math.max(0, PH / 2 - hh - 0.3);
    const x = Math.max(-mx, Math.min(mx, (lerp(a.u, b.u, e) - 0.5) * PW)), y = Math.max(-my, Math.min(my, (0.5 - lerp(a.v, b.v, e)) * PH));
    const o = lerp(a.o, b.o, e);
    cam.position.set(x + o, y + 0.12 * Math.abs(o), d); cam.lookAt(x, y, 0);
  };

  function frame(now) {
    const target = pos(); x += (target - x) * (rm || S0.lenis ? 1 : 0.25);
    if (x > N - 3) load();
    if (!ready || window.__bgCover || document.hidden) { last = now; return; }
    if (!rm) gov.tick(now);
    const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
    const t = rm ? 0 : (now - t0) / 1000;
    // the finale's own progress: starts as the last drone scene hands over, ends at the bottom of the page
    const u = rm ? (x >= N - 1 ? 1 : 0) : ss(N - 2 + 0.56, N - 1 + 0.74, x);
    const k = ss(0.42, 0.66, u); // the dissolve from the floating canoes to the dock
    mouse.lerp(mt, 1 - Math.exp(-dt * 3));
    R.clear();
    [0, 1].forEach((i) => {
      const s = scenes[i], a = i === 0 ? 1 : k; if (a < 0.002 || (i === 0 && k > 0.998)) return;
      shot(i, i === 0 ? ss(0, 0.66, u) : ss(0.42, 1, u), C, i === 0 ? k * 0.9 : 0); // the first scene keeps pushing in as it dissolves
      if (!rm) { C.position.x += mouse.x * 0.1; C.position.y -= mouse.y * 0.06; }
      s.u.uA.value = a; s.u.uT.value = t; R.clearDepth(); R.render(s.S, C);
    });
  }
  // the opening is the drone footage, so the page can show as soon as the first clip has a frame (or after 2.5 s)
  S0.boot(new Promise((res) => { const go = () => res(); const v = () => document.querySelector('.drone video'); let n = 0; const poll = () => { const el = v(); if ((el && el.readyState >= 2) || ++n > 25) go(); else setTimeout(poll, 100); }; poll(); }));
  S0.loop(frame);
  window.__finale = { R, C, scenes, gov };
})();
