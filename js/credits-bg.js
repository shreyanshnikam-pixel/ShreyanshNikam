/* Credits page backdrop: a slow drift past snowy mountains at blue hour, with falling snow and low fog.
 * Lightweight on purpose: three ridge meshes, one sky dome, two fog sheets, one Points cloud. No post-processing.
 * Lighting comes from the Poly Haven snow HDRI (PMREM environment) plus a cold hemisphere and a low key light.
 * Reduced motion or a hidden tab: no animation (one still frame). No WebGL: the CSS Snow-to-Frost gradient stays.
 * Exposes window.CREDITS_BG = { ready: Promise } so the preloader can wait for the first frame. */
(function () {
  'use strict';
  const canvas = document.getElementById('bg');
  const SITE = window.SITE || {};
  if (!canvas || !window.THREE || SITE.glOk === false) { window.CREDITS_BG = { ready: Promise.resolve() }; return; }
  const T = THREE, rm = !!SITE.rm, small = Math.min(innerWidth, innerHeight) < 700;
  const C = (hex) => new T.Color(hex).convertSRGBToLinear(); // palette colours are sRGB; three r147 shades in linear

  let renderer;
  try {
    renderer = new T.WebGLRenderer({ canvas, antialias: !small, alpha: false, powerPreference: 'low-power' });
  } catch (e) { window.CREDITS_BG = { ready: Promise.resolve() }; return; }
  renderer.setPixelRatio(Math.min(small ? 1.5 : 1.75, window.devicePixelRatio || 1));
  renderer.outputEncoding = T.sRGBEncoding;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new T.Scene();
  const FOG = C('#CAD7E2');
  scene.fog = new T.Fog(FOG, 60, 330);
  const camera = new T.PerspectiveCamera(42, 1, 0.5, 1200);

  // ---------- sky dome: Deep ice at the zenith, Ice blue, then Frost and a white afterglow at the horizon ----------
  const sky = new T.Mesh(new T.SphereGeometry(900, 32, 16), new T.ShaderMaterial({
    side: T.BackSide, depthWrite: false, fog: false,
    uniforms: { uTop: { value: C('#5E8AAB') }, uMid: { value: C('#A9CBE3') }, uLow: { value: C('#E7EEF4') }, uGlow: { value: C('#FFFFFF') }, uT: { value: 0 } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: [
      'uniform vec3 uTop, uMid, uLow, uGlow; uniform float uT; varying vec3 vP;',
      'float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
      'void main(){',
      '  float y = clamp(vP.y, 0.0, 1.0);',
      '  vec3 c = mix(uLow, uMid, smoothstep(0.0, 0.22, y));',
      '  c = mix(c, uTop, smoothstep(0.2, 0.75, y));',
      // afterglow low in the sky, off to one side
      '  float g = pow(max(0.0, dot(normalize(vec3(vP.x, 0.0, vP.z)), normalize(vec3(-0.6, 0.0, -1.0)))), 6.0) * (1.0 - smoothstep(0.0, 0.25, y));',
      '  c = mix(c, uGlow, g * 0.55);',
      // a few faint stars high up (blue hour), twinkling slowly
      '  vec2 sp = vec2(atan(vP.z, vP.x) * 180.0, vP.y * 260.0); vec2 cell = floor(sp);',
      '  float s = step(0.996, h(cell)) * smoothstep(0.35, 0.8, y) * (0.6 + 0.4 * sin(uT * 0.8 + h(cell + 3.1) * 40.0));',
      '  float d = length(fract(sp) - 0.5); c += vec3(s * smoothstep(0.35, 0.0, d) * 0.6);',
      '  gl_FragColor = vec4(c, 1.0);',
      '  #include <encodings_fragment>',
      '}'
    ].join('\n')
  }));
  scene.add(sky);

  // ---------- lights ----------
  scene.add(new T.HemisphereLight(0xdcebf7, 0x8fa9bf, 0.55));
  const key = new T.DirectionalLight(0xeaf2ff, 0.9); key.position.set(-120, 60, -160); scene.add(key);

  // ---------- mountains: ridged fbm height fields, snow on gentle slopes, Deep ice in steep shadowed faces ----------
  function noise2(x, y) { // value noise
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const r = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = r(xi, yi), b = r(xi + 1, yi), c = r(xi, yi + 1), d = r(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function ridged(x, y, oct) { let f = 0, amp = 0.5, fr = 1; for (let i = 0; i < oct; i++) { const n = 1 - Math.abs(noise2(x * fr, y * fr) * 2 - 1); f += n * n * amp; amp *= 0.5; fr *= 2.03; } return f; }

  const snowCol = C('#FFFFFF'), shadowCol = C('#5E8AAB'), midCol = C('#CAD7E2');
  function ridge(z, width, depth, height, seed, segX, segZ) {
    const g = new T.PlaneGeometry(width, depth, segX, segZ); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position, n = p.count, col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const x = p.getX(i), zz = p.getZ(i);
      const back = 1 - (zz + depth / 2) / depth; // 0 at the front edge, 1 at the back
      const peak = ridged(x * 0.012 + seed, zz * 0.02 + seed * 1.7, 5);
      const y = Math.pow(peak, 1.6) * height * (0.25 + 0.75 * Math.sin(Math.min(1, back * 1.2) * Math.PI * 0.5));
      p.setY(i, y - 4);
    }
    g.computeVertexNormals();
    const nr = g.attributes.normal, c = new T.Color();
    for (let i = 0; i < n; i++) {
      const slope = 1 - nr.getY(i), lit = Math.max(0, nr.getX(i) * -0.5 + nr.getZ(i) * -0.3 + 0.5);
      c.copy(snowCol).lerp(midCol, Math.min(1, slope * 2.2)).lerp(shadowCol, Math.min(1, Math.max(0, slope * 2.4 - 0.9)) * (1 - lit * 0.6));
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new T.BufferAttribute(col, 3));
    const m = new T.Mesh(g, new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0, envMapIntensity: 0.7 }));
    m.position.z = z; scene.add(m); return m;
  }
  const q = small ? 0.5 : 1;
  ridge(-300, 1100, 220, 150, 11.3, Math.round(220 * q), Math.round(44 * q));
  ridge(-170, 800, 150, 80, 4.1, Math.round(200 * q), Math.round(40 * q));
  ridge(-60, 520, 110, 26, 7.7, Math.round(160 * q), Math.round(34 * q));
  // snowfield in front
  const ground = new T.Mesh(new T.PlaneGeometry(900, 300, 1, 1).rotateX(-Math.PI / 2), new T.MeshStandardMaterial({ color: C('#F4F7FA'), roughness: 0.95, envMapIntensity: 0.6 }));
  ground.position.set(0, -3.4, 60); scene.add(ground);

  // ---------- low fog sheets drifting between the ridges ----------
  const fogMat = (o) => new T.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false,
    uniforms: { uT: { value: 0 }, uO: { value: o }, uC: { value: C('#F4F7FA') } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: [
      'uniform float uT, uO; uniform vec3 uC; varying vec2 vUv;',
      'float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
      'float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }',
      'float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++){ s += a * n(p); p *= 2.02; a *= 0.5; } return s; }',
      'void main(){',
      '  vec2 p = vUv * vec2(6.0, 1.6) + vec2(uT * 0.012, 0.0);',
      '  float f = fbm(p + fbm(p * 0.7 - uT * 0.006));',
      '  float a = smoothstep(0.35, 0.85, f) * smoothstep(0.0, 0.25, vUv.y) * (1.0 - smoothstep(0.45, 1.0, vUv.y)) * smoothstep(0.0, 0.15, vUv.x) * (1.0 - smoothstep(0.85, 1.0, vUv.x));',
      '  gl_FragColor = vec4(uC, a * uO);',
      '  #include <encodings_fragment>',
      '}'
    ].join('\n')
  });
  const fogs = [[-120, 18, 0.75], [-30, 8, 0.55]].map(([z, y, o]) => { const m = new T.Mesh(new T.PlaneGeometry(700, 60), fogMat(o)); m.position.set(0, y, z); scene.add(m); return m; });

  // ---------- falling snow (one Points cloud wrapped around the camera in the shader) ----------
  const N = rm ? 900 : small ? 1100 : 2600, pos = new Float32Array(N * 3), rnd = new Float32Array(N);
  for (let i = 0; i < N; i++) { pos[i * 3] = Math.random(); pos[i * 3 + 1] = Math.random(); pos[i * 3 + 2] = Math.random(); rnd[i] = Math.random(); }
  const sg = new T.BufferGeometry(); sg.setAttribute('position', new T.BufferAttribute(pos, 3)); sg.setAttribute('aR', new T.BufferAttribute(rnd, 1));
  const snowMat = new T.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false,
    uniforms: { uT: { value: 0 }, uCam: { value: new T.Vector3() }, uPx: { value: renderer.getPixelRatio() } },
    vertexShader: [
      'attribute float aR; uniform float uT; uniform vec3 uCam; uniform float uPx; varying float vA;',
      'void main(){',
      '  vec3 box = vec3(120.0, 50.0, 90.0);',
      '  vec3 p = position * box;',
      '  p.y -= uT * (1.1 + aR * 1.6);',
      '  p.x += uT * 0.9 + sin(uT * 0.6 + aR * 30.0) * 1.2;',
      '  p.z += cos(uT * 0.4 + aR * 20.0) * 0.8;',
      '  vec3 c = uCam - vec3(box.x * 0.5, box.y * 0.5, box.z * 0.85);',
      '  p = c + mod(p - c, box);',
      '  vec4 mv = modelViewMatrix * vec4(p, 1.0);',
      '  gl_Position = projectionMatrix * mv;',
      '  float d = -mv.z;',
      '  gl_PointSize = uPx * (0.35 + aR * 0.9) * 90.0 / max(d, 1.0);',
      '  vA = smoothstep(90.0, 20.0, d) * smoothstep(0.5, 3.0, d) * (0.55 + 0.45 * aR);',
      '}'
    ].join('\n'),
    fragmentShader: 'varying float vA; void main(){ float r = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.1, r) * vA; if (a < 0.01) discard; gl_FragColor = vec4(1.0, 1.0, 1.0, a); }'
  });
  const snow = new T.Points(sg, snowMat); snow.frustumCulled = false; scene.add(snow);

  // ---------- environment from the Poly Haven snow HDRI ----------
  const ready = new Promise((res) => {
    if (!T.RGBELoader) return res();
    const pm = new T.PMREMGenerator(renderer);
    new T.RGBELoader().load('assets/textures/snow.hdr', (tex) => {
      tex.mapping = T.EquirectangularReflectionMapping;
      scene.environment = pm.fromEquirectangular(tex).texture; tex.dispose(); pm.dispose(); res();
    }, (e) => { if (e && e.total && SITE.setLoad) SITE.setLoad(0.9 * e.loaded / e.total); }, () => res());
  }).then(() => frame(performance.now()));
  window.CREDITS_BG = { ready };

  // ---------- sizing, drift, render loop ----------
  function size() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h;
    camera.fov = w < h ? 58 : 42; camera.updateProjectionMatrix();
  }
  size(); addEventListener('resize', () => { size(); if (rm) frame(performance.now()); });

  let px = 0, py = 0, sx = 0, sy = 0;
  if (!rm && !SITE.touch) addEventListener('pointermove', (e) => { px = e.clientX / innerWidth - 0.5; py = e.clientY / innerHeight - 0.5; }, { passive: true });
  const t0 = performance.now();
  function frame(now) {
    const t = rm ? 40 : (now - t0) / 1000;
    sx += (px - sx) * 0.03; sy += (py - sy) * 0.03;
    const sp = SITE.progress || 0;
    // slow lateral drift along the valley, sinking a little as you read down the page
    camera.position.set(Math.sin(t * 0.025) * 30 + sx * 4, 9 - sp * 4 - sy * 1.5, 40);
    camera.lookAt(camera.position.x * 0.6 + sx * 10, 14 - sp * 6, -200);
    sky.material.uniforms.uT.value = t;
    fogs.forEach((f) => { f.material.uniforms.uT.value = t; });
    snowMat.uniforms.uT.value = t; snowMat.uniforms.uCam.value.copy(camera.position);
    renderer.render(scene, camera);
  }
  let running = false, raf = 0;
  const loop = (now) => { frame(now); raf = requestAnimationFrame(loop); };
  const setRun = (on) => { if (rm || on === running) return; running = on; if (on) raf = requestAnimationFrame(loop); else cancelAnimationFrame(raf); };
  ready.then(() => setRun(!document.hidden));
  document.addEventListener('visibilitychange', () => setRun(!document.hidden));
})();
