/* Credits page backdrop: calm minimalist frosted alpine horizon (zero snow particles, instant load). */
(function () {
  'use strict';
  const canvas = document.getElementById('bg');
  const SITE = window.SITE || {};
  if (!canvas || !window.THREE || SITE.glOk === false) { window.CREDITS_BG = { ready: Promise.resolve() }; return; }
  const T = THREE, rm = !!SITE.rm, small = Math.min(innerWidth, innerHeight) < 700;
  const C = (hex) => new T.Color(hex).convertSRGBToLinear();

  let renderer;
  try {
    renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'low-power' });
  } catch (e) { window.CREDITS_BG = { ready: Promise.resolve() }; return; }
  renderer.setPixelRatio(Math.max(1.0, Math.min(small ? 1.5 : 2.0, window.devicePixelRatio || 1)));
  renderer.outputEncoding = T.sRGBEncoding;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.98;

  const scene = new T.Scene();
  const FOG = C('#DCE7F1');
  scene.fog = new T.Fog(FOG, 80, 680);
  const camera = new T.PerspectiveCamera(42, 1, 0.5, 1100);

  const sky = new T.Mesh(new T.SphereGeometry(860, 32, 16), new T.ShaderMaterial({
    side: T.BackSide, depthWrite: false, fog: false,
    uniforms: { uTop: { value: C('#7DA3C2') }, uMid: { value: C('#BDD3E5') }, uLow: { value: C('#EDF3F8') } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: [
      'uniform vec3 uTop, uMid, uLow; varying vec3 vP;',
      'void main(){',
      '  float y = clamp(vP.y, 0.0, 1.0);',
      '  vec3 c = mix(uLow, uMid, smoothstep(0.0, 0.24, y));',
      '  c = mix(c, uTop, smoothstep(0.10, 0.62, y));',
      '  gl_FragColor = vec4(c, 1.0);',
      '  #include <encodings_fragment>',
      '}'].join('\n'),
  }));
  const RL = window.REAL ? REAL.setup(renderer, scene, camera, { hdr: 'assets/textures/misty_dawn_2k.hdr', focus: 60, aperture: 0.00004, fogDensity: 0.01, turn: 0.5 }) : null;
  if (!RL) scene.add(sky);

  scene.add(new T.HemisphereLight(0xf2f7fc, 0x9ab4ca, 0.85));
  const key = new T.DirectionalLight(0xffffff, 0.72); key.position.set(-120, 70, -140); scene.add(key);

  function noise2(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const r = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = r(xi, yi), b = r(xi + 1, yi), c = r(xi, yi + 1), d = r(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function ridged(x, y, oct) { let f = 0, amp = 0.5, fr = 1; for (let i = 0; i < oct; i++) { const n = 1 - Math.abs(noise2(x * fr, y * fr) * 2 - 1); f += n * n * amp; amp *= 0.5; fr *= 2.03; } return f; }

  const topCol = C('#F4F7FA'), midCol = C('#CAD7E2'), deepCol = C('#6F96B5');
  function ridge(z, width, depth, height, seed, segX, segZ) {
    const g = new T.PlaneGeometry(width, depth, segX, segZ); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position, n = p.count, col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const x = p.getX(i), zz = p.getZ(i);
      const back = 1 - (zz + depth / 2) / depth;
      const peak = ridged(x * 0.0075 + seed, zz * 0.015 + seed * 1.7, 4);
      const y = Math.pow(peak, 1.55) * height * (0.25 + 0.75 * Math.sin(Math.min(1, back * 1.2) * Math.PI * 0.5));
      p.setY(i, y - 4);
    }
    g.computeVertexNormals();
    const nr = g.attributes.normal, c = new T.Color();
    for (let i = 0; i < n; i++) {
      const slope = 1 - nr.getY(i), lit = Math.max(0, nr.getX(i) * -0.5 + nr.getZ(i) * -0.3 + 0.5);
      c.copy(topCol).lerp(midCol, Math.min(1, slope * 2.0)).lerp(deepCol, Math.min(1, Math.max(0, slope * 2.2 - 0.8)) * (1 - lit * 0.5));
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new T.BufferAttribute(col, 3));
    const m = new T.Mesh(g, new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 }));
    m.position.z = z; scene.add(m); return m;
  }
  const q = small ? 0.5 : 1;
  ridge(-330, 1300, 220, 210, 11.3, Math.round(160 * q), Math.round(32 * q));
  ridge(-180, 900, 150, 95, 4.1, Math.round(140 * q), Math.round(28 * q));
  const ground = new T.Mesh(new T.PlaneGeometry(900, 320, 1, 1).rotateX(-Math.PI / 2), new T.MeshStandardMaterial({ color: C('#EFF4F9'), roughness: 0.92 }));
  ground.position.set(0, -3.4, 60); scene.add(ground);

  function size() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h;
    camera.fov = w < h ? 58 : 42; camera.updateProjectionMatrix();
  }
  size(); addEventListener('resize', () => { size(); frame(performance.now()); });

  let px = 0, py = 0, sx = 0, sy = 0;
  if (!rm && !SITE.touch) addEventListener('pointermove', (e) => { px = e.clientX / innerWidth - 0.5; py = e.clientY / innerHeight - 0.5; }, { passive: true });
  const t0 = performance.now();
  function frame(now) {
    const t = rm ? 40 : (now - t0) / 1000;
    sx += (px - sx) * 0.03; sy += (py - sy) * 0.03;
    const sp = SITE.progress || 0;
    camera.position.set(Math.sin(t * 0.02) * 24 + sx * 3.5, 6 - sp * 3 - sy * 1.2, 40);
    camera.lookAt(camera.position.x * 0.6 + sx * 8, 26 - sp * 10, -200);
    if (RL) RL.render(1 / 60); else renderer.render(scene, camera);
  }
  frame(performance.now());
  window.CREDITS_BG = { ready: RL ? RL.ready : Promise.resolve() };
  let running = false, raf = 0;
  const loop = (now) => { frame(now); raf = requestAnimationFrame(loop); };
  const setRun = (on) => { if (rm || on === running) return; running = on; if (on) raf = requestAnimationFrame(loop); else cancelAnimationFrame(raf); };
  setRun(!document.hidden);
  document.addEventListener('visibilitychange', () => setRun(!document.hidden));
})();
