/* Projects: two refractive ice blocks (Sky Sentry, Echo) over a snowfield. Hover cracks a block; choosing one flies the camera into it.
   Classic script; needs THREE (r147 bundle), FK (kit.js), SITE (core.js). The real <a class="blk"> links stay on top for keyboard and screen readers. */
(function () {
  const T = THREE, S0 = window.SITE, V = (x, y, z) => new T.Vector3(x, y, z);
  const cv = document.getElementById('pgl'), stage = document.querySelector('.pstage');
  const links = Array.from(document.querySelectorAll('.blk')), spaces = links.map((a) => a.querySelector('.space'));
  const flashEl = document.querySelector('.flash');
  const rm = S0.rm, ss = FK.ss;
  if (!S0.glOk || !cv) { S0.boot(Promise.resolve()); return; }

  let R;
  try { R = new T.WebGLRenderer({ canvas: cv, antialias: false, powerPreference: 'high-performance' }); }
  catch (e) { S0.boot(Promise.resolve()); return; }
  document.documentElement.classList.add('gl');
  const loadAll = [];

  // ---------- renderer, scene, post (same pipeline as the home page) ----------
  R.outputEncoding = T.LinearEncoding; R.toneMapping = T.NoToneMapping;
  const S = new T.Scene(), C = new T.PerspectiveCamera(32, 1, 0.1, 700);
  const bgC = document.createElement('canvas'); bgC.width = 512; bgC.height = 512;
  { const g = bgC.getContext('2d'), gr = g.createRadialGradient(256, 170, 20, 256, 240, 420); gr.addColorStop(0, '#FFFFFF'); gr.addColorStop(0.45, '#F4F7FA'); gr.addColorStop(1, '#DCE6EE'); g.fillStyle = gr; g.fillRect(0, 0, 512, 512); }
  const bg = new T.CanvasTexture(bgC); bg.encoding = T.sRGBEncoding; S.background = bg;
  const FOG = new T.Color('#EEF3F7'); S.fog = new T.FogExp2(FOG.clone(), 0.016);
  const comp = new T.EffectComposer(R, new T.WebGLRenderTarget(4, 4, { type: T.HalfFloatType }));
  comp.addPass(new T.RenderPass(S, C));
  const bloom = new T.UnrealBloomPass(new T.Vector2(256, 256), 0.4, 0.6, 0.94); comp.addPass(bloom);
  const grade = new T.ShaderPass({
    uniforms: { tDiffuse: { value: null }, uT: { value: 0 }, uFlash: { value: 0 }, uRes: { value: new T.Vector2(1, 1) } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: [
      'uniform sampler2D tDiffuse; uniform float uT, uFlash; uniform vec2 uRes; varying vec2 vUv;',
      'float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }',
      'float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }',
      'float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ s += a*n2(p); p *= 2.03; a *= 0.5; } return s; }',
      'vec3 knee(vec3 x){ vec3 k = vec3(0.82); return mix(x, k + 0.18*(1.0 - exp(-(x - k)/0.18)), step(k, x)); }',
      'void main(){',
      '  vec2 c = vUv - 0.5; float r2 = dot(c,c); vec2 o = c * (0.0016 + uFlash*0.006) * (1.0 + r2*4.0);',
      '  vec3 col = vec3(texture2D(tDiffuse, vUv + o).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - o).b);',
      '  col = knee(col); col = pow(max(col, 0.0), vec3(1.0/2.2));',
      '  col *= mix(1.0, smoothstep(1.3, 0.2, r2*1.6), 0.3);',
      '  float m = fbm(vUv * vec2(uRes.x/uRes.y, 1.0) * 3.0 + uT * 0.15);',
      '  float w = smoothstep(m - 0.18, m + 0.18, uFlash * 1.3); col = mix(col, vec3(1.0), w);',
      '  col += (h(vUv * uRes + fract(uT*7.1)*100.0) - 0.5) * 0.035;',
      '  gl_FragColor = vec4(col, 1.0);',
      '}'].join('\n'),
  });
  comp.addPass(grade);
  const mobile = () => innerWidth < 760;
  const DPR = () => Math.min(window.devicePixelRatio || 1, mobile() ? 1.5 : 2);

  // ---------- light and environment ----------
  const sun = new T.DirectionalLight(0xffffff, 2.2); sun.position.set(-8, 14, 9); S.add(sun);
  S.add(new T.HemisphereLight(0xf4f8ff, 0xcbd8e4, 0.9));
  const pm = new T.PMREMGenerator(R);
  loadAll.push(new Promise((res) => new T.RGBELoader().load('assets/textures/snow.hdr', (tx) => { tx.mapping = T.EquirectangularReflectionMapping; S.environment = pm.fromEquirectangular(tx).texture; tx.dispose(); res(); }, undefined, () => res())));
  const TL = new T.TextureLoader();
  const ltex = (f, srgb, rep) => new Promise((res) => { const t = TL.load(f, () => res(t), undefined, () => res(t)); t.wrapS = t.wrapT = T.RepeatWrapping; if (srgb) t.encoding = T.sRGBEncoding; t.anisotropy = 8; t.repeat.set(rep, rep); });
  const textCanvas = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.anisotropy = 8; t.userData.redraw = (...a) => { const g = c.getContext('2d'); g.clearRect(0, 0, w, h); draw(g, w, h, ...a); t.needsUpdate = true; }; t.userData.redraw(); return t; };
  const rnd = FK.rng(7);

  // ---------- snowfield with a faint contour grid, distant mountains ----------
  const gMat = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 1, normalScale: new T.Vector2(0.7, 0.7) });
  const GR = 110;
  loadAll.push(Promise.all([ltex('assets/textures/snow_diff.jpg', true, GR), ltex('assets/textures/snow_nor_gl.jpg', false, GR), ltex('assets/textures/snow_rough.jpg', false, GR)]).then(([d, n, r]) => { gMat.map = d; gMat.normalMap = n; gMat.roughnessMap = r; gMat.needsUpdate = true; }));
  FK.patch(gMat, 'p-snow-grid', {}, '', [
    '{ vec2 g = abs(fract(vWP.xz / 4.0 - 0.5) - 0.5) / fwidth(vWP.xz / 4.0);',
    '  float line = 1.0 - min(min(g.x, g.y), 1.0);',
    '  float fade = exp(-length(vWP.xz - cameraPosition.xz) * 0.035);',
    '  outgoingLight = mix(outgoingLight, vec3(0.6, 0.69, 0.77), line * fade * 0.26); }'].join('\n'), true);
  const ground = new T.Mesh(new T.PlaneGeometry(800, 800).rotateX(-Math.PI / 2), gMat); S.add(ground);
  const mtnM = new T.MeshStandardMaterial({ color: 0xf3f6f9, roughness: 0.95, flatShading: true });
  const mtns = new T.Group(); S.add(mtns);
  for (let i = 0; i < 11; i++) {
    const g = new T.IcosahedronGeometry(1, 4), p = g.attributes.position;
    for (let k = 0; k < p.count; k++) { const v = V(p.getX(k), p.getY(k), p.getZ(k)); const n = FK.fbm(v.x * 1.8 + i * 3, v.y * 1.8, v.z * 1.8, 5); v.multiplyScalar(0.75 + n * 0.7); p.setXYZ(k, v.x, Math.max(-0.2, v.y), v.z); }
    g.computeVertexNormals();
    const m = new T.Mesh(g, mtnM), sc = 26 + rnd() * 36;
    m.scale.set(sc * (1 + rnd()), sc * (0.5 + rnd() * 0.6), sc); m.position.set((i - 5) * 46 + (rnd() - 0.5) * 30, 0, -150 - rnd() * 140); mtns.add(m);
  }

  // drifting snow (none in reduced motion)
  const SN = rm ? 0 : (mobile() ? 1400 : 4200);
  const snowU = { uT: { value: 0 }, uCam: { value: new T.Vector3() }, uScale: { value: innerHeight }, uWind: { value: 1 } };
  if (SN) {
    const sp = new Float32Array(SN * 3), sr = new Float32Array(SN);
    for (let i = 0; i < SN; i++) { sp.set([rnd() * 60 - 30, rnd() * 24, rnd() * 60 - 30], i * 3); sr[i] = rnd(); }
    const sg = new T.BufferGeometry(); sg.setAttribute('position', new T.BufferAttribute(sp, 3)); sg.setAttribute('aR', new T.BufferAttribute(sr, 1));
    const snow = new T.Points(sg, new T.ShaderMaterial({
      uniforms: snowU, transparent: true, depthWrite: false,
      vertexShader: 'attribute float aR; uniform float uT, uScale, uWind; uniform vec3 uCam; varying float vA; void main(){ vec3 b = vec3(60.0, 24.0, 60.0); vec3 p = position + vec3(uT*0.9*uWind + sin(uT*0.3+aR*20.0)*1.5, -uT*(0.5+aR*0.6), uT*0.25); p = mod(p - uCam + b*0.5, b) - b*0.5 + uCam; vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_PointSize = (1.2 + aR*2.6) * uScale / -mv.z * 0.06; vA = (0.35 + aR*0.5) * smoothstep(60.0, 3.0, -mv.z) * smoothstep(0.6, 2.0, -mv.z); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; gl_FragColor = vec4(vec3(0.58, 0.70, 0.80), vA * smoothstep(0.5, 0.1, d)); }',
    }));
    snow.frustumCulled = false; S.add(snow);
  }

  // ---------- the two blocks ----------
  const ASP = 0.78, DEP = 0.42; // block: width 0.78, height 1, depth 0.42 (scaled to fit its link)
  const blockGeo = new T.RoundedBoxGeometry(ASP, 1, DEP, 6, 0.035);
  const etchDraw = {
    sky: (x, w, h) => {
      const L = 64;
      mono(x, 'HACKPHS · OCTOBER 2026', 26, L, 96, '#5E8AAB', w - L * 2);
      disp(x, 'SKY SENTRY', 600, 92, L, 200, '#0F1B26', w - L * 2);
      rule(x, L, 246, w - L * 2);
      [['BEST USE OF', 'SOLANA'], ['BEST USE OF', 'TIGERDATA'], ['OVERALL', '5TH PLACE']].forEach((a, i) => { const y = 350 + i * 196; mono(x, a[0], 24, L, y, '#5E8AAB', w - L * 2); disp(x, a[1], 600, 70, L, y + 82, '#0F1B26', w - L * 2); });
      mono(x, '3 AWARDS · SKY SENTRY', 22, L, 940, '#66788A', w - L * 2);
    },
    echo: (x, w, h) => {
      const L = 64;
      mono(x, 'HACK CLUB HAVEN PRINCETON', 26, L, 96, '#5E8AAB', w - L * 2);
      mono(x, 'NOVEMBER 14 TO 15, 2026', 26, L, 140, '#5E8AAB', w - L * 2);
      disp(x, 'ECHO', 600, 118, L, 262, '#0F1B26', w - L * 2);
      rule(x, L, 306, w - L * 2);
      mono(x, 'AWARD', 24, L, 410, '#5E8AAB', w - L * 2);
      disp(x, '1ST', 700, 280, L - 10, 680, '#0F1B26', w - L * 2);
      disp(x, 'PRIZE,', 600, 70, L, 786, '#0F1B26', w - L * 2);
      disp(x, 'BEST OVERALL', 600, 70, L, 868, '#0F1B26', w - L * 2);
      mono(x, '1 AWARD · ECHO', 22, L, 950, '#66788A', w - L * 2);
    },
  };
  // etched text: a white highlight under dark ink, like letters cut into ice
  function fit(x, s, font, size, maxW) { let z = size; x.font = font(z); while (x.measureText(s).width > maxW && z > 10) { z -= 2; x.font = font(z); } }
  function etch(x, s, X, Y, col) { x.globalAlpha = 0.9; x.fillStyle = '#FFFFFF'; x.fillText(s, X + 1.5, Y + 2.5); x.globalAlpha = 1; x.fillStyle = col; x.fillText(s, X, Y); }
  function mono(x, s, size, X, Y, col, maxW) { x.letterSpacing = '5px'; fit(x, s, (z) => '500 ' + z + 'px "Geist Mono", ui-monospace, monospace', size, maxW); etch(x, s, X, Y, col); x.letterSpacing = '0px'; }
  function disp(x, s, wt, size, X, Y, col, maxW) { x.letterSpacing = '-2px'; fit(x, s, (z) => wt + ' ' + z + 'px Unbounded, system-ui, sans-serif', size, maxW); etch(x, s, X, Y, col); x.letterSpacing = '0px'; }
  function rule(x, X, Y, w) { x.fillStyle = 'rgba(94,138,171,.55)'; x.fillRect(X, Y, w, 2); x.fillStyle = 'rgba(255,255,255,.9)'; x.fillRect(X, Y + 2, w, 2); }

  // fine crack lines grown from an impact point; revealed outward by a shader uniform
  const crackTex = (seed, ox, oy) => textCanvas(624, 800, (x, w, h) => {
    const r = FK.rng(seed);
    const seg = (px, py, a, len, wdt, depth) => {
      const pts = [[px, py]]; let X = px, Y = py;
      for (let d = 0; d < len; d += 7) { a += (r() - 0.5) * 0.55; X += Math.cos(a) * 7; Y += Math.sin(a) * 7; pts.push([X, Y]); if (depth < 3 && r() < 0.045) seg(X, Y, a + (r() < 0.5 ? -1 : 1) * (0.45 + r() * 0.6), len * (0.3 + r() * 0.35), wdt * 0.7, depth + 1); }
      [[`rgba(94,138,171,${0.55})`, wdt + 1.4, 1.2], ['rgba(255,255,255,0.95)', wdt, 0]].forEach(([c, lw, off]) => { x.strokeStyle = c; x.lineWidth = lw; x.lineJoin = x.lineCap = 'round'; x.beginPath(); pts.forEach(([u, v], i) => (i ? x.lineTo(u + off, v + off) : x.moveTo(u + off, v + off))); x.stroke(); });
    };
    const cx = ox * w, cy = oy * h;
    for (let i = 0; i < 7; i++) seg(cx, cy, (i / 7) * Math.PI * 2 + r() * 0.6, 160 + r() * 380, 1.6, 0);
    x.strokeStyle = 'rgba(255,255,255,.9)'; x.lineWidth = 1; x.beginPath(); x.arc(cx, cy, 10 + r() * 6, 0, Math.PI * 2); x.stroke();
  });
  const crackMat = (tex, ox, oy) => new T.ShaderMaterial({
    uniforms: { map: { value: tex }, uK: { value: 0 }, uA: { value: 1 }, uO: { value: new T.Vector2(ox, 1 - oy) } },
    transparent: true, depthTest: false, depthWrite: false, side: T.DoubleSide,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform sampler2D map; uniform float uK, uA; uniform vec2 uO; varying vec2 vUv; float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); } void main(){ vec4 c = texture2D(map, vUv); float d = distance(vUv * vec2(0.78, 1.0), uO * vec2(0.78, 1.0)) + h(floor(vUv * 48.0)) * 0.05; float m = smoothstep(uK * 0.95 + 0.03, uK * 0.95 - 0.03, d) * step(0.001, uK); gl_FragColor = vec4(c.rgb, c.a * m * uA); }',
  });
  const glowMat = (col) => new T.ShaderMaterial({
    uniforms: { uA: { value: 0.3 }, uC: { value: new T.Color(col) } }, transparent: true, depthTest: false, depthWrite: false, blending: T.AdditiveBlending,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform float uA; uniform vec3 uC; varying vec2 vUv; void main(){ vec2 c = (vUv - 0.5) * vec2(1.0, 0.82); float a = exp(-dot(c, c) * 9.0) * uA; gl_FragColor = vec4(uC * a, 1.0); }',
  });
  const blobMat = (col, add) => new T.ShaderMaterial({
    uniforms: { uA: { value: add ? 0 : 0.2 }, uC: { value: new T.Color(col) } }, transparent: true, depthWrite: false, blending: add ? T.AdditiveBlending : T.NormalBlending,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform float uA; uniform vec3 uC; varying vec2 vUv; void main(){ vec2 c = (vUv - 0.5) * vec2(1.0, 1.6); float a = exp(-dot(c, c) * 12.0) * uA; gl_FragColor = vec4(uC * (' + (add ? 'a' : '1.0') + '), ' + (add ? '1.0' : 'a') + '); }',
  });
  const bubbleMat = () => new T.ShaderMaterial({
    uniforms: { uA: { value: 1 }, uScale: { value: innerHeight } }, transparent: true, depthTest: false, depthWrite: false,
    vertexShader: 'attribute float aR; uniform float uScale; varying float vA; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = (0.8 + aR * 2.2) * uScale / -mv.z * 0.02; vA = 0.25 + aR * 0.45; gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform float uA; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; float ring = smoothstep(0.5, 0.36, d) * (0.45 + 0.55 * smoothstep(0.2, 0.42, d)); gl_FragColor = vec4(1.0, 1.0, 1.0, ring * vA * uA); }',
  });

  const DEF = [
    { key: 'sky', att: '#A9CBE3', ad: 3.2, rot: -0.24, crack: [0.8, 0.16], seed: 11 },
    { key: 'echo', att: '#5E8AAB', ad: 2.2, rot: 0.24, crack: [0.2, 0.22], seed: 29 },
  ];
  const WHITE = new T.Color('#FFFFFF'), DIMC = new T.Color('#CAD7E2');
  const B = DEF.map((d, i) => {
    const group = new T.Group(), widen = new T.Group(); group.add(widen); S.add(group);
    const mat = new T.MeshPhysicalMaterial({ color: 0xffffff, transmission: 1, ior: 1.31, thickness: DEP, roughness: 0.08, metalness: 0, attenuationColor: new T.Color(d.att), attenuationDistance: d.ad, clearcoat: 0.7, clearcoatRoughness: 0.06, envMapIntensity: 1.3, specularIntensity: 1 });
    const mesh = new T.Mesh(blockGeo, mat); mesh.userData.i = i; widen.add(mesh);
    const glow = new T.Mesh(new T.PlaneGeometry(1.25, 1.4), glowMat('#A9CBE3')); glow.position.z = -0.1; glow.renderOrder = 3; group.add(glow);
    const etchT = textCanvas(624, 800, (x, w, h) => { x.save(); x.scale(w / 780, h / 1000); etchDraw[d.key](x, 780, 1000); x.restore(); });
    const text = new T.Mesh(new T.PlaneGeometry(0.64, 0.82), new T.MeshBasicMaterial({ map: etchT, transparent: true, depthTest: false, depthWrite: false, fog: false, opacity: 0.92 }));
    text.position.z = 0.02; text.renderOrder = 4; group.add(text);
    const ck = crackMat(crackTex(d.seed, d.crack[0], d.crack[1]), d.crack[0], d.crack[1]);
    const crack = new T.Mesh(new T.PlaneGeometry(ASP * 0.97, 0.97), ck); crack.position.z = DEP / 2 - 0.012; crack.renderOrder = 5; widen.add(crack);
    const crack2 = new T.Mesh(crack.geometry, ck); crack2.position.z = -DEP / 2 + 0.03; crack2.scale.x = -1; crack2.renderOrder = 2; widen.add(crack2);
    const BN = 90, bp = new Float32Array(BN * 3), br = new Float32Array(BN);
    for (let k = 0; k < BN; k++) { bp.set([(rnd() - 0.5) * ASP * 0.86, (rnd() - 0.5) * 0.92, (rnd() - 0.5) * DEP * 0.7], k * 3); br[k] = rnd(); }
    const bg2 = new T.BufferGeometry(); bg2.setAttribute('position', new T.BufferAttribute(bp, 3)); bg2.setAttribute('aR', new T.BufferAttribute(br, 1));
    const bubbles = new T.Points(bg2, bubbleMat()); bubbles.renderOrder = 3; widen.add(bubbles);
    const light = new T.PointLight(0xA9CBE3, 1.5, 6, 2); group.add(light);
    const shadow = new T.Mesh(new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), blobMat('#5E8AAB', false)); S.add(shadow);
    const pool = new T.Mesh(new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), blobMat('#A9CBE3', true)); pool.position.y = 0.01; S.add(pool);
    return { i, d, group, widen, mesh, mat, glow, text, etchT, crack: ck, bubbles, light, shadow, pool, base: V(0, 0, 0), sc: 1, st: { h: 0, dim: 0 }, href: links[i].getAttribute('href'), ph: i * 2.1 };
  });

  // ---------- layout: each block sits where its link's empty space is on screen ----------
  const CAM0 = V(0, 1.5, 13), LOOK0 = V(0, 0.55, 0), D = CAM0.distanceTo(LOOK0);
  let W = 1, H = 1, FOV = 32;
  const layout = () => {
    const r = cv.getBoundingClientRect(); W = Math.max(1, r.width); H = Math.max(1, r.height);
    R.setPixelRatio(DPR()); R.setSize(W, H, false); comp.setPixelRatio(DPR()); comp.setSize(W, H);
    grade.uniforms.uRes.value.set(W, H); bloom.resolution.set(W / 2, H / 2);
    FOV = W / H < 0.9 ? 40 : 32; C.fov = FOV; C.aspect = W / H; C.updateProjectionMatrix();
    C.position.copy(CAM0); C.lookAt(LOOK0); C.updateMatrixWorld();
    const f = LOOK0.clone().sub(CAM0).normalize(), k = 2 * D * Math.tan(T.MathUtils.degToRad(FOV) / 2) / H;
    let low = Infinity, avg = 0;
    B.forEach((b, i) => {
      const s = spaces[i].getBoundingClientRect(), cx = s.left + s.width / 2 - r.left, cy = s.top + s.height / 2 - r.top;
      const dir = V(cx / W * 2 - 1, -(cy / H * 2 - 1), 0.5).unproject(C).sub(C.position).normalize();
      b.base.copy(C.position).addScaledVector(dir, D / dir.dot(f));
      const hPx = Math.max(40, Math.min(s.height * 0.92, s.width * 0.92 / (ASP * 1.12)));
      b.sc = hPx * k; low = Math.min(low, b.base.y - b.sc / 2); avg += b.sc / B.length;
      b.bubbles.material.uniforms.uScale.value = H; b.light.distance = b.sc * 2.6;
    });
    const gy = low - avg * 0.42; ground.position.y = gy; mtns.position.y = gy;
    B.forEach((b) => { [b.shadow, b.pool].forEach((m, j) => { m.position.set(b.base.x, gy + 0.01 + j * 0.01, b.base.z); m.scale.set(b.sc * 1.5, 1, b.sc * 0.9); }); });
    snowU.uScale.value = H;
  };
  const ro = window.ResizeObserver ? new ResizeObserver(() => layout()) : null;
  if (ro) ro.observe(stage); else window.addEventListener('resize', layout);
  layout();

  // ---------- hover: pointer raycast over the stage, plus hover and focus on the real links ----------
  let rayHit = -1, linkHover = -1, focusI = -1, active = -2;
  const ray = new T.Raycaster(), ndc = new T.Vector2();
  const setActive = (i) => {
    if (i === active) return; active = i;
    if (i >= 0) S0.click && S0.click();
    B.forEach((b, j) => {
      gsap.to(b.st, { h: j === i ? 1 : 0, dim: i >= 0 && j !== i ? 1 : 0, duration: rm ? 0 : (j === i ? 1.1 : 0.8), ease: 'expo.out', overwrite: true });
      links[j].classList.toggle('on', j === i); links[j].classList.toggle('dim', i >= 0 && j !== i);
    });
  };
  const pick = () => { if (!flying) setActive(rayHit >= 0 ? rayHit : linkHover >= 0 ? linkHover : focusI); };
  stage.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    const r = cv.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, C); const hit = ray.intersectObjects(B.map((b) => b.mesh), false)[0];
    rayHit = hit ? hit.object.userData.i : -1; stage.style.cursor = rayHit >= 0 ? 'pointer' : ''; pick();
  }, { passive: true });
  stage.addEventListener('pointerleave', () => { rayHit = -1; linkHover = -1; pick(); });
  links.forEach((a, i) => {
    a.addEventListener('pointerenter', (e) => { if (e.pointerType !== 'touch') { linkHover = i; pick(); } });
    a.addEventListener('pointerleave', () => { if (linkHover === i) linkHover = -1; pick(); });
    a.addEventListener('focus', () => { focusI = i; pick(); });
    a.addEventListener('blur', () => { if (focusI === i) focusI = -1; pick(); });
    a.addEventListener('click', (e) => { if (rm || e.defaultPrevented || e.button > 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; e.preventDefault(); fly(i); });
  });
  // a click on a block outside its link area still chooses it
  stage.addEventListener('click', (e) => { if (rm || flying || rayHit < 0 || e.target.closest('a')) return; fly(rayHit); });

  // ---------- choosing a block: the camera flies into it, a white flash, then the project page ----------
  let flying = false; const fl = { p: 0, i: -1, from: V(0, 0, 0), look: V(0, 0, 0), end: V(0, 0, 0), aim: V(0, 0, 0) };
  function fly(i) {
    if (flying) return; flying = true; setActive(i);
    const b = B[i]; fl.i = i; fl.from.copy(C.position); fl.look.copy(LOOK0);
    const dir = b.group.position.clone().sub(C.position).normalize();
    fl.end.copy(b.group.position).addScaledVector(dir, b.sc * DEP * 0.2); fl.aim.copy(b.group.position).addScaledVector(dir, 8);
    const o = { p: 0 };
    gsap.to(o, { p: 1, duration: 1.25, ease: 'power3.inOut', onUpdate: () => { fl.p = o.p; }, onComplete: () => { location.href = b.href; } });
    if (flashEl) gsap.to(flashEl, { opacity: 1, duration: 0.4, delay: 0.88, ease: 'power3.in' });
  }
  window.addEventListener('pageshow', (e) => { if (!e.persisted) return; flying = false; fl.p = 0; fl.i = -1; if (flashEl) gsap.set(flashEl, { opacity: 0 }); active = -2; setActive(-1); });

  // ---------- loop (paused when the tab is hidden or the stage is off screen) ----------
  let visible = !document.hidden, onScreen = true, last = 0; const t0 = performance.now();
  document.addEventListener('visibilitychange', () => { visible = !document.hidden; });
  if (window.IntersectionObserver) new IntersectionObserver((en) => { onScreen = en[0].isIntersecting; }, { threshold: 0 }).observe(stage);
  const mouse = new T.Vector2(), mt = new T.Vector2();
  window.addEventListener('pointermove', (e) => { if (e.pointerType !== 'touch') mt.set(e.clientX / innerWidth * 2 - 1, e.clientY / innerHeight * 2 - 1); }, { passive: true });
  const look = V(0, 0, 0), tmp = V(0, 0, 0);
  function frame(now) {
    requestAnimationFrame(frame);
    if (!visible || !onScreen) { last = now; return; }
    const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now; const t = (now - t0) / 1000, idle = rm ? 0 : 1;
    mouse.lerp(mt, 1 - Math.exp(-dt * 2.5));
    // camera: breathing and a little pointer parallax, or the flight
    if (flying) {
      const p = fl.p, e2 = ss(0, 0.7, p);
      C.position.lerpVectors(fl.from, fl.end, p);
      look.lerpVectors(fl.look, fl.aim, e2); C.lookAt(look);
      C.fov = FOV * (1 - 0.12 * ss(0, 0.5, p) + 0.75 * Math.pow(ss(0.45, 1, p), 2)); C.updateProjectionMatrix();
      grade.uniforms.uFlash.value = ss(0.55, 1, p);
      S.fog.density = 0.016 + (fl.i === 0 ? 0.05 : 0.02) * ss(0.4, 1, p);
    } else {
      C.position.copy(CAM0).add(tmp.set(mouse.x * 0.3 * idle + Math.sin(t * 0.3) * 0.05 * idle, -mouse.y * 0.18 * idle + Math.sin(t * 0.45) * 0.04 * idle, 0));
      C.lookAt(LOOK0); grade.uniforms.uFlash.value = 0; S.fog.density = 0.016;
    }
    // blocks: float, turn a little toward the pointer when hovered, widen, glow, crack, dim
    B.forEach((b) => {
      const { h, dim } = b.st, fp = flying && fl.i === b.i ? fl.p : 0, fo = flying && fl.i !== b.i ? ss(0, 0.5, fl.p) : 0;
      b.group.position.copy(b.base); b.group.position.y += Math.sin(t * 0.6 + b.ph) * 0.06 * b.sc * idle; b.group.position.z -= dim * 0.5 * b.sc;
      b.group.rotation.set(Math.sin(t * 0.4 + b.ph) * 0.025 * idle, b.d.rot * (1 - 0.5 * h) + Math.sin(t * 0.25 + b.ph) * 0.08 * idle + mouse.x * 0.14 * h * idle, Math.sin(t * 0.33 + b.ph) * 0.015 * idle);
      b.group.scale.setScalar(b.sc * (1 - 0.04 * dim));
      b.widen.scale.x = 1 + 0.12 * h;
      b.glow.material.uniforms.uA.value = (0.22 + 0.95 * h - 0.18 * dim) * (1 - ss(0.5, 0.9, fp)) * (1 - fo);
      b.light.intensity = (1.2 + 5.5 * h - 0.9 * dim) * (b.sc / 3); b.light.position.set(0, -0.1, 0);
      b.text.material.opacity = (0.92 - 0.5 * dim) * (1 - ss(0.45, 0.75, fp)) * (1 - fo);
      b.crack.uniforms.uK.value = h; b.crack.uniforms.uA.value = (1 - dim) * (1 - fo);
      b.bubbles.material.uniforms.uA.value = 1 - 0.6 * dim;
      b.mat.envMapIntensity = 1.3 + 0.4 * h - 0.55 * dim; b.mat.attenuationDistance = b.d.ad * (1 + 0.5 * h - 0.45 * dim); b.mat.color.copy(WHITE).lerp(DIMC, dim * 0.7);
      b.shadow.material.uniforms.uA.value = 0.2 + 0.06 * h - 0.06 * dim; b.pool.material.uniforms.uA.value = 0.05 + 0.4 * h;
    });
    grade.uniforms.uT.value = t;
    if (SN) { snowU.uT.value = t; snowU.uCam.value.copy(C.position); snowU.uWind.value = 1 + (flying ? fl.p * 6 : 0); }
    comp.render(dt);
  }

  // fonts first, so the etched awards use Unbounded and Geist Mono
  const fontsReady = (document.fonts ? Promise.all([document.fonts.load('600 64px Unbounded'), document.fonts.load('700 64px Unbounded'), document.fonts.load('500 24px "Geist Mono"')]).catch(() => {}) : Promise.resolve())
    .then(() => { B.forEach((b) => b.etchT.userData.redraw()); layout(); });
  loadAll.push(fontsReady);
  window.__proj = { S, C, B, ground, R };
  S0.boot(Promise.all(loadAll), () => { layout(); R.compile(S, C); });
  requestAnimationFrame(frame);
})();
