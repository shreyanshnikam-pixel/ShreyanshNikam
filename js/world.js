/* Home: serene architectural flight through a calm frosted studio world.
   Direct antialiased WebGL (DPR >= 1.0, ACESFilmicToneMapping), instant RoomEnvironment lighting (<15ms), zero snow clutter. */
(function () {
  const T = THREE, S0 = window.SITE, V = (x, y, z) => new T.Vector3(x, y, z);
  const cv = document.getElementById('world'), poolCv = document.getElementById('pool-film');
  const loadAll = [];
  if (!S0.glOk) { S0.boot(Promise.resolve()); return; }
  const isMobile = () => innerWidth < 760;
  const mobile = isMobile(), rm = S0.rm;
  const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  // ---------- optional pre-rendered pool film slot (zero 404s when assets/films/index.json lists []) ----------
  let poolFilm = null;
  if (window.FilmPlayer && poolCv) {
    window.FilmPlayer.load(poolCv, 'assets/films/pool/manifest.json', { maxDpr: 2, fit: 'cover', background: '#E7EEF4' })
      .then((pl) => { if (pl) { poolFilm = pl; poolCv.style.display = 'block'; } })
      .catch(() => {});
  }

  // ---------- crisp direct renderer (antialias: true, DPR never < 1.0, calm ACES studio look) ----------
  const R = new T.WebGLRenderer({ canvas: cv, antialias: true, powerPreference: 'high-performance' });
  R.outputEncoding = T.sRGBEncoding;
  R.toneMapping = T.ACESFilmicToneMapping;
  R.toneMappingExposure = 1.02;
  R.shadowMap.enabled = true;
  R.shadowMap.type = T.PCFSoftShadowMap;

  const S = new T.Scene();
  const C = new T.PerspectiveCamera(mobile ? 48 : 35, innerWidth / innerHeight, 0.1, 600);
  const FOG_COL = new T.Color('#ECF2F7');
  S.background = FOG_COL.clone();
  S.fog = new T.FogExp2(FOG_COL.clone(), 0.0085);

  const gov = { q: 1, ema: 12, n: 0 };
  const getDpr = () => Math.max(1.0, Math.min(window.devicePixelRatio || 1, isMobile() ? 1.5 : 2) * gov.q);
  const resize = () => {
    const w = innerWidth, h = innerHeight, dpr = getDpr();
    R.setPixelRatio(dpr); R.setSize(w, h, false);
    C.aspect = w / h; C.fov = w / h < 0.9 ? 48 : 35; C.updateProjectionMatrix();
  };
  window.addEventListener('resize', resize); resize();

  // ---------- instant procedural cold studio lighting (<15ms, zero network megabytes) ----------
  const pm = new T.PMREMGenerator(R);
  S.environment = pm.fromScene(new T.RoomEnvironment(), 0.04).texture;
  pm.dispose();

  const sun = new T.DirectionalLight(0xffffff, 1.35);
  sun.castShadow = true;
  sun.shadow.mapSize.set(mobile ? 512 : 1024, mobile ? 512 : 1024);
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 65 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.025; sun.shadow.radius = 3;
  S.add(sun); S.add(sun.target);
  S.add(new T.HemisphereLight(0xf6f9fc, 0xcad7e2, 0.9));
  const rimL = new T.DirectionalLight(0xa9cbe3, 0.55);
  rimL.position.set(16, 10, -18);
  S.add(rimL);
  const RL = window.REAL ? REAL.setup(R, S, C, { hdr: 'assets/textures/misty_dawn_2k.hdr', focus: 12, fogDensity: 0.017, turn: 0.5, cropK: 1, crops: [
    { url: 'assets/textures/misty_dawn_main.webp', half: 'assets/textures/misty_dawn_main_half.webp', u0: 0.09442138671875, v0: 0.449951171875, u1: 0.4000244140625, v1: 0.6444091796875 },
    { url: 'assets/textures/misty_dawn_outro.webp', half: 'assets/textures/misty_dawn_outro_half.webp', u0: 0.6278076171875, v0: 0.449951171875, u1: 0.8721923828125, v1: 0.6444091796875 }] }) : null;

  // Calm frosted studio sky dome (pure Snow #F4F7FA -> Frost #E7EEF4 -> subtle cool Glacier zenith)
  const sky = new T.Mesh(new T.SphereGeometry(420, 32, 16), new T.ShaderMaterial({
    side: T.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }',
    fragmentShader: [
      'varying vec3 vD;',
      'void main(){',
      '  float y = clamp(vD.y, -0.2, 1.0);',
      '  vec3 low = vec3(0.925, 0.950, 0.972);',
      '  vec3 mid = vec3(0.955, 0.970, 0.984);',
      '  vec3 top = vec3(0.840, 0.892, 0.935);',
      '  vec3 col = mix(low, mid, smoothstep(-0.04, 0.08, y));',
      '  col = mix(col, top, smoothstep(0.08, 0.65, y));',
      '  gl_FragColor = vec4(col, 1.0);',
      '}'].join('\n'),
  }));
  sky.frustumCulled = false; if (!RL) S.add(sky);

  // Procedural fine frosted micro-surface normal map (tiny 128px, generated in ~2ms, zero network cost)
  const frostMaps = (() => {
    const SZ = 128, hgt = new Float32Array(SZ * SZ);
    for (let y = 0; y < SZ; y++) for (let x = 0; x < SZ; x++) {
      const u = x / SZ, v = y / SZ;
      hgt[y * SZ + x] = FK.fbm(u * 6, v * 6, 1.3, 3) * 0.7 + FK.noise(u * 22, v * 22, 4.7) * 0.3;
    }
    const nC = document.createElement('canvas'); nC.width = nC.height = SZ;
    const nX = nC.getContext('2d'), nImg = nX.createImageData(SZ, SZ);
    for (let y = 0; y < SZ; y++) for (let x = 0; x < SZ; x++) {
      const xm = (x - 1 + SZ) % SZ, xp = (x + 1) % SZ, ym = (y - 1 + SZ) % SZ, yp = (y + 1) % SZ;
      const dx = (hgt[y * SZ + xp] - hgt[y * SZ + xm]) * 1.4;
      const dy = (hgt[yp * SZ + x] - hgt[ym * SZ + x]) * 1.4;
      const inv = 1 / Math.hypot(dx, dy, 1), i = (y * SZ + x) * 4;
      nImg.data[i] = Math.round((-dx * inv * 0.5 + 0.5) * 255);
      nImg.data[i + 1] = Math.round((-dy * inv * 0.5 + 0.5) * 255);
      nImg.data[i + 2] = Math.round((inv * 0.5 + 0.5) * 255);
      nImg.data[i + 3] = 255;
    }
    nX.putImageData(nImg, 0, 0);
    const nor = new T.CanvasTexture(nC);
    nor.wrapS = nor.wrapT = T.RepeatWrapping; nor.repeat.set(2, 2);
    return { nor };
  })();

  // Refined architectural frosted glacial glass (tactile pale-ice Beer-Lambert depth + crisp Fresnel bevels)
  const DISS = [];
  const ice = (o) => {
    const m = new T.MeshPhysicalMaterial(Object.assign({
      color: new T.Color('#C4DCF0'),
      transparent: true, opacity: 0.88, depthWrite: false,
      roughness: 0.20, metalness: 0.03,
      normalMap: frostMaps.nor, normalScale: new T.Vector2(0.28, 0.28),
      clearcoat: 0.65, clearcoatRoughness: 0.16,
      envMapIntensity: 1.05, reflectivity: 0.85,
    }, o || {}));
    const u = { uD: { value: 0 } }; m.userData.u = u; DISS.push(m);
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uD = u.uD;
      sh.vertexShader = 'varying vec3 vOP;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vOP = position;');
      sh.fragmentShader = 'uniform float uD; varying vec3 vOP;\nfloat dh(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719))) * 43758.5453); }\nfloat dn(vec3 p){ vec3 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(mix(dh(i),dh(i+vec3(1,0,0)),f.x),mix(dh(i+vec3(0,1,0)),dh(i+vec3(1,1,0)),f.x),f.y),mix(mix(dh(i+vec3(0,0,1)),dh(i+vec3(1,0,1)),f.x),mix(dh(i+vec3(0,1,1)),dh(i+vec3(1,1,1)),f.x),f.y),f.z); }\n' +
        sh.fragmentShader.replace('void main() {', 'void main() {\n float dz = dn(vOP * 2.1) * 0.65 + dn(vOP * 6.0) * 0.35; if (uD > 0.002 && dz < uD) discard;')
          .replace('#include <output_fragment>', [
            '{ vec3 nV = normalize(normal), vV = normalize(vViewPosition);',
            '  float ndv = clamp(abs(dot(nV, vV)), 0.0, 1.0);',
            '  float bevel = pow(1.0 - ndv, 1.85);',
            '  float schlick = 0.025 + 0.975 * pow(1.0 - ndv, 4.2);',
            '  float frost = dn(vOP * 4.5) * 0.6 + dn(vOP * 13.0) * 0.4;',
            '  vec3 bodyTint = mix(vec3(0.32, 0.50, 0.67), vec3(0.68, 0.80, 0.90), smoothstep(0.18, 0.84, frost));',
            '  vec3 deepEdge = vec3(0.12, 0.25, 0.38);',
            '  vec3 col = outgoingLight * 0.48 + bodyTint * 0.42;',
            '  col = mix(col, deepEdge, bevel * 0.58);',
            '  col += vec3(0.96, 0.985, 1.0) * schlick * 0.62;',
            '  outgoingLight = col;',
            '  diffuseColor.a = clamp(diffuseColor.a + bevel * 0.14, 0.76, 0.96);',
            '  float edge = smoothstep(uD, uD + 0.055, dz);',
            '  outgoingLight = mix(vec3(0.96, 0.985, 1.0), outgoingLight, uD > 0.002 ? edge : 1.0); }',
            '#include <output_fragment>'].join('\n'));
    };
    m.customProgramCacheKey = () => 'ice-studio-v4';
    return m;
  };
  const textCanvas = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.anisotropy = 8; t.userData.redraw = (...a) => { const g = c.getContext('2d'); g.clearRect(0, 0, w, h); draw(g, w, h, ...a); t.needsUpdate = true; }; t.userData.redraw(); return t; };
  const inner = (tex, w, h) => { const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.08, side: T.DoubleSide, fog: false })); m.renderOrder = 3; return m; };

  // ---------- anchors (spaced cleanly opposite each section's DOM copy column) ----------
  const O = [V(4.6, 3.1, 0), V(4.2, 3.1, -26), V(-6.1, 2.6, -52), V(5.8, 0, -80), V(-4.2, 0, -106), V(5.6, 3.1, -134), V(-4.8, 2.9, -160), V(0, 2, -150)];
  const CAM = [
    { p: V(-0.4, 3.0, 12.6), l: V(1.6, 3.0, 0) },
    { p: V(0.6, 2.3, -14), l: V(2.6, 2.9, -26) },
    { p: V(-1.4, 2.9, -39.5), l: V(-1.6, 2.6, -52) },
    { p: V(1.4, 2.5, -67.5), l: V(2.6, 2.6, -80) },
    { p: V(-1.2, 3.2, -94.5), l: V(-3.8, 2.6, -106) },
    { p: V(0.8, 3.3, -121.0), l: V(2.2, 3.1, -134) },
    { p: V(-0.8, 3.2, -148.5), l: V(-2.4, 2.9, -160) },
    { p: V(0, 2.7, -176), l: V(1.2, 3.5, -110) }, // low, looking back across the field to the trees (no more crane shot down at the dirt)
  ];
  const curP = new T.CatmullRomCurve3(CAM.map((c) => c.p), false, 'centripetal');
  const curL = new T.CatmullRomCurve3(CAM.map((c) => c.l), false, 'centripetal');
  const rnd = FK.rng(21);

  // ---------- serene smooth architectural frosted horizon plane (ZERO snow textures, ZERO snowflakes) ----------
  const PX = O[4].x, PZ = O[4].z, PL = 12.6, PW = 7.2;
  const gGeo = new T.PlaneGeometry(520, 480, 1, 1); gGeo.rotateX(-Math.PI / 2);
  const gMat = new T.MeshStandardMaterial({ color: 0xedf3f8, roughness: 0.78, metalness: 0.02, envMapIntensity: 0.45 });
  FK.patch(gMat, 'frosted-studio-grid', {}, '', [
    '{ vec2 g = abs(fract(vWP.xz / 4.5 - 0.5) - 0.5) / max(fwidth(vWP.xz / 4.5), vec2(0.0005));',
    '  float line = 1.0 - min(min(g.x, g.y), 1.0);',
    '  float dist = length(vWP.xz - cameraPosition.xz);',
    '  float fade = exp(-dist * 0.032);',
    '  float ao = 1.0;',
    '  ao *= 1.0 - 0.16 * exp(-dot(vWP.xz - vec2(4.6, 0.0), vWP.xz - vec2(4.6, 0.0)) * 0.16);',
    '  ao *= 1.0 - 0.14 * exp(-dot(vWP.xz - vec2(-4.4, -52.0), vWP.xz - vec2(-4.4, -52.0)) * 0.08);',
    '  ao *= 1.0 - 0.18 * exp(-dot((vWP.xz - vec2(5.2, -80.0)) * vec2(0.16, 0.42), (vWP.xz - vec2(5.2, -80.0)) * vec2(0.16, 0.42)));',
    '  ao *= 1.0 - 0.14 * exp(-dot(vWP.xz - vec2(4.2, -134.0), vWP.xz - vec2(4.2, -134.0)) * 0.08);',
    '  ao *= 1.0 - 0.14 * exp(-dot(vWP.xz - vec2(-4.2, -160.0), vWP.xz - vec2(-4.2, -160.0)) * 0.09);',
    '  outgoingLight *= mix(vec3(0.84, 0.89, 0.94), vec3(1.0), ao);',
    '  outgoingLight = mix(outgoingLight, vec3(0.68, 0.76, 0.83), line * fade * 0.24); }'].join('\n'), true);
  const ground = new T.Mesh(gGeo, gMat); ground.position.set(0, 0, -90); ground.receiveShadow = true; if (RL) ground.visible = false; S.add(ground);

  // ---------- 01: architectural frosted monolith ----------
  const mono = new T.Group(); mono.position.copy(O[0]); S.add(mono);
  const monoMesh = new T.Mesh(new T.RoundedBoxGeometry(1.55, 5.2, 1.55, 6, 0.11), ice()); monoMesh.castShadow = true; monoMesh.renderOrder = 2; mono.add(monoMesh);
  const monoInnerMat = ice({ opacity: 0.78, color: new T.Color('#B5D2E8') });
  for (let i = 0; i < 5; i++) {
    const sh = new T.Mesh(new T.OctahedronGeometry(0.24 + rnd() * 0.26, 0), monoInnerMat);
    sh.scale.y = 2.4 + rnd() * 1.8;
    sh.position.set((rnd() - 0.5) * 0.55, (rnd() - 0.5) * 3.2, (rnd() - 0.5) * 0.55);
    sh.rotation.set(rnd() * 0.6, rnd() * 2, rnd() * 0.35);
    sh.renderOrder = 1; mono.add(sh);
  }
  const monoShadow = new T.Mesh(new T.CircleGeometry(1.75, 48), new T.MeshBasicMaterial({ color: 0x5E8AAB, transparent: true, opacity: 0.08, depthWrite: false }));
  monoShadow.rotation.x = -Math.PI / 2; monoShadow.position.set(O[0].x, 0.015, O[0].z); S.add(monoShadow);

  // ---------- 03: four frosted glass cubes ----------
  const STATS = [[39, 'AP courses'], [13, 'dual enrollment'], [5, 'pathways'], [474, 'AP Scholars']];
  const cubeGeo = new T.RoundedBoxGeometry(1.58, 1.58, 1.58, 5, 0.12);
  const cubeMat = ice();
  const cubes = STATS.map((s, i) => {
    const g = new T.Group(); g.position.copy(O[2]).add(V((i % 2) * 1.98 - 0.99, Math.floor(i / 2) * -1.96 + 1.05, (i % 2) * -0.35)); S.add(g);
    const m = new T.Mesh(cubeGeo, cubeMat); m.castShadow = true; m.renderOrder = 2; g.add(m);
    const tex = textCanvas(512, 512, (x, w, h, v) => {
      x.fillStyle = '#0F1B26'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.font = '600 ' + (String(v == null ? s[0] : v).length > 2 ? 148 : 196) + 'px Unbounded, sans-serif';
      x.fillText(String(v == null ? s[0] : v), w / 2, h * 0.45);
      x.font = '500 32px "Geist Mono", monospace'; x.fillStyle = '#3E6584';
      x.fillText(s[1].toUpperCase(), w / 2, h * 0.78);
    });
    g.add(inner(tex, 1.12, 1.12)); g.userData = { tex, val: s[0], ph: i * 1.3, m };
    return g;
  });
  let counted = false;

  // ---------- 04: calm architectural strata (AP / Honors / College Prep) ----------
  const gl3 = new T.Group(); gl3.position.copy(O[3]); S.add(gl3);
  const layer = (y0, h, mat, lab, sub, glow) => {
    const sh2 = new T.Shape(); const L = 14.5, N = 48;
    sh2.moveTo(-L / 2, 0);
    for (let i = 0; i <= N; i++) {
      const x = -L / 2 + i / N * L;
      sh2.lineTo(x, h + Math.sin(x * 0.55 + y0) * 0.08 + FK.noise(x * 0.45, y0 * 2, 1) * 0.08);
    }
    sh2.lineTo(L / 2, 0); sh2.lineTo(-L / 2, 0);
    const m = new T.Mesh(new T.ExtrudeGeometry(sh2, { depth: 3.0, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 3, curveSegments: 4 }), mat);
    m.position.set(0, y0, -1.5); m.castShadow = m.receiveShadow = true; gl3.add(m);
    const t = textCanvas(1024, 256, (x, w, hh) => {
      x.fillStyle = glow ? '#0F1B26' : '#2E4960'; x.font = '600 92px Unbounded, sans-serif'; x.textBaseline = 'middle';
      x.fillText(lab, 24, hh * 0.42);
      x.font = '500 30px "Geist Mono", monospace'; x.fillStyle = '#4B6F8C';
      x.fillText(sub.toUpperCase(), 28, hh * 0.82);
    });
    const p = inner(t, 3.8, 0.95); p.position.set(-0.65, y0 + h * 0.5, 1.62); gl3.add(p);
    return m;
  };
  layer(2.25, 1.05, new T.MeshStandardMaterial({ color: 0xf4f7fa, roughness: 0.65, metalness: 0.02 }), 'AP', 'opens in later years');
  layer(1.05, 1.12, ice({ opacity: 0.9, color: new T.Color('#C4DDF0') }), 'HONORS', 'highest level open to freshmen', true);
  layer(-0.15, 1.12, new T.MeshPhysicalMaterial({ color: 0x99b8cf, roughness: 0.32, clearcoat: 0.35 }), 'COLLEGE PREP', 'one of my five');
  const honLight = new T.PointLight(0xA9CBE3, 2.2, 9, 2); honLight.position.set(0, 1.6, 0.8); gl3.add(honLight);

  // ---------- 05: serene minimalist architectural frosted-water reflection basin ----------
  const pool = new T.Group(); pool.position.set(PX, 0.02, PZ); S.add(pool);
  const caust = { uT: { value: 0 } };
  const rimMat = new T.MeshStandardMaterial({ color: 0xe7eef4, roughness: 0.45, metalness: 0.04, envMapIntensity: 0.6 });
  const rimT = 0.28, rimH = 0.14;
  [[0, rimH * 0.5, -PW / 2 - rimT / 2, PL + rimT * 2, rimH, rimT],
   [0, rimH * 0.5,  PW / 2 + rimT / 2, PL + rimT * 2, rimH, rimT],
   [-PL / 2 - rimT / 2, rimH * 0.5, 0, rimT, rimH, PW],
   [ PL / 2 + rimT / 2, rimH * 0.5, 0, rimT, rimH, PW]].forEach(([x, y, z, sx, sy, sz]) => {
    const b = new T.Mesh(new T.RoundedBoxGeometry(sx, sy, sz, 3, 0.03), rimMat);
    b.position.set(x, y, z); b.receiveShadow = true; pool.add(b);
  });
  const waterMat = new T.ShaderMaterial({
    uniforms: { uT: caust.uT },
    transparent: true, depthWrite: false,
    vertexShader: 'varying vec2 vUv; varying vec3 vWP; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vWP = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: [
      'uniform float uT; varying vec2 vUv; varying vec3 vWP;',
      'float ribbon(vec2 p, float t){',
      '  float a = sin(p.x * 1.8 + sin(p.y * 1.4 + t * 0.45)) * cos(p.y * 1.6 - sin(p.x * 1.2 - t * 0.38));',
      '  float b = sin(p.x * 3.1 - t * 0.35 + cos(p.y * 2.5 + t * 0.3)) * 0.5;',
      '  return pow(clamp(0.5 + 0.5 * (a * 0.72 + b * 0.28), 0.0, 1.0), 4.0);',
      '}',
      'void main(){',
      '  vec2 q = (vUv - 0.5) * vec2(12.6, 7.2);',
      '  float c1 = ribbon(q * 0.75, uT);',
      '  float c2 = ribbon(q * 1.22 + vec2(2.4, -1.7), -uT * 0.72);',
      '  float caust = clamp(c1 * 0.65 + c2 * 0.45, 0.0, 1.0);',
      '  vec3 vd = normalize(cameraPosition - vWP);',
      '  float fres = 0.06 + 0.94 * pow(1.0 - clamp(abs(vd.y), 0.0, 1.0), 3.6);',
      '  vec3 deepAqua = vec3(0.66, 0.82, 0.90);',
      '  vec3 paleIce  = vec3(0.86, 0.93, 0.97);',
      '  vec3 col = mix(deepAqua, paleIce, smoothstep(0.15, 0.85, vUv.y) * 0.52 + fres * 0.55);',
      '  col += vec3(0.96, 0.99, 1.0) * caust * 0.30;',
      '  float lane = 0.0;',
      '  for (int k = 1; k <= 3; k++) {',
      '    float ly = float(k) * 0.25;',
      '    float d = abs(vUv.y - ly);',
      '    lane = max(lane, smoothstep(0.0085, 0.0018, d) * smoothstep(0.04, 0.08, vUv.x) * smoothstep(0.96, 0.92, vUv.x));',
      '  }',
      '  col = mix(col, vec3(0.32, 0.54, 0.72), lane * 0.54);',
      '  float edge = smoothstep(0.0, 0.045, vUv.x) * smoothstep(1.0, 0.955, vUv.x) * smoothstep(0.0, 0.06, vUv.y) * smoothstep(1.0, 0.94, vUv.y);',
      '  col = mix(vec3(0.54, 0.69, 0.80), col, 0.55 + 0.45 * edge);',
      '  gl_FragColor = vec4(col, 0.92);',
      '}'].join('\n'),
  });
  const water = new T.Mesh(new T.PlaneGeometry(PL, PW, 1, 1).rotateX(-Math.PI / 2), waterMat);
  water.position.y = 0.08; pool.add(water);
  const barMat = new T.MeshPhysicalMaterial({ color: 0xeaf3fa, roughness: 0.16, clearcoat: 0.8, transparent: true, opacity: 0.72 });
  for (let k = 1; k <= 3; k++) {
    const z = -PW / 2 + k * (PW / 4);
    const bar = new T.Mesh(new T.BoxGeometry(PL * 0.88, 0.025, 0.045), barMat);
    bar.position.set(0, 0.115, z); pool.add(bar);
  }
  const shaftM = new T.ShaderMaterial({
    uniforms: { uT: caust.uT }, transparent: true, depthWrite: false, side: T.DoubleSide,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform float uT; varying vec2 vUv; void main(){ float x = smoothstep(0.0, 0.5, vUv.x) * smoothstep(1.0, 0.5, vUv.x); float y = smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.12, vUv.y); float s = 0.75 + 0.25 * sin(vUv.x * 8.0 + uT * 0.35); gl_FragColor = vec4(vec3(0.86, 0.94, 1.0), x * y * s * 0.14); }',
  });
  for (let i = 0; i < 4; i++) {
    const sh = new T.Mesh(new T.PlaneGeometry(2.6, 4.8), shaftM);
    sh.position.set(-PL * 0.32 + i * (PL * 0.22), 2.35, -0.6 + (i % 2) * 1.2);
    sh.rotation.set(0, 0.22, -0.24);
    pool.add(sh);
  }

  // ---------- 06: four award crystal shards ----------
  const AW = [['BEST USE', 'SOLANA', 'SKY SENTRY \u00b7 HACKPHS 2026'], ['BEST USE', 'TIGERDATA', 'SKY SENTRY \u00b7 HACKPHS 2026'], ['OVERALL', '5TH PLACE', 'SKY SENTRY \u00b7 HACKPHS 2026'], ['1ST PRIZE', 'BEST OVERALL', 'ECHO \u00b7 HACK CLUB HAVEN 2026']];
  const shardG = (() => {
    const g = new T.CylinderGeometry(0.62, 0.62, 2.6, 6, 1);
    const tip = new T.ConeGeometry(0.62, 0.9, 6); tip.translate(0, 1.75, 0);
    const tip2 = tip.clone(); tip2.rotateX(Math.PI);
    return T.BufferGeometryUtils.mergeBufferGeometries([g.toNonIndexed(), tip.toNonIndexed(), tip2.toNonIndexed()]);
  })();
  shardG.computeVertexNormals();
  const shardMat = ice({ roughness: 0.16 });
  const shards = AW.map((a, i) => {
    const g = new T.Group(); S.add(g);
    const m = new T.Mesh(shardG, shardMat); m.castShadow = true; m.renderOrder = 2; g.add(m);
    const t = textCanvas(512, 1024, (x, w, h) => {
      x.textAlign = 'center'; x.fillStyle = '#33536E'; x.font = '600 46px Unbounded, sans-serif'; x.fillText(a[0], w / 2, h * 0.39);
      x.font = '700 ' + (a[1].length > 10 ? 50 : 58) + 'px Unbounded, sans-serif'; x.fillStyle = '#0F1B26'; x.fillText(a[1], w / 2, h * 0.48);
      x.font = '500 22px "Geist Mono", monospace'; x.fillStyle = '#4B6F8C'; x.fillText(a[2], w / 2, h * 0.57);
    });
    g.add(inner(t, 0.98, 1.96));
    g.userData = { home: O[5].clone().add(V((i - 1.5) * 1.42, (i % 2) * 0.28, (i % 2) * -0.35)), i };
    return g;
  });

  // ---------- 07: three frosted glass prisms ----------
  const prismGeo = new T.CylinderGeometry(0.95, 0.95, 2.8, 3, 1);
  const prismMat = ice();
  const prisms = ['01', '02', '03'].map((n, i) => {
    const g = new T.Group(); g.position.copy(O[6]).add(V((i - 1) * 2.1, (i % 2) * 0.35, -i * 0.3)); S.add(g);
    const m = new T.Mesh(prismGeo, prismMat); m.castShadow = true; m.renderOrder = 2; g.add(m);
    const t = textCanvas(512, 512, (x, w, h) => { x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#1E364B'; x.font = '600 185px Unbounded, sans-serif'; x.fillText(n, w / 2, h / 2); });
    g.add(inner(t, 0.95, 0.95)); g.userData.ph = i * 2;
    return g;
  });

  // ---------- calm monolith-to-cubes morph particles (only active between sections 01 and 03) ----------
  const PN = rm ? 0 : (mobile ? 800 : 1800);
  const sampleGroup = (meshes, n) => {
    const out = new Float32Array(n * 3), tmp = V(0, 0, 0), samplers = meshes.map((m) => new T.MeshSurfaceSampler(m).build());
    for (let i = 0; i < n; i++) { const k = i % meshes.length, m = meshes[k]; samplers[k].sample(tmp); m.updateWorldMatrix(true, false); tmp.applyMatrix4(m.matrixWorld); out.set([tmp.x, tmp.y, tmp.z], i * 3); }
    return out;
  };
  S.updateMatrixWorld(true);
  const pA = sampleGroup([monoMesh], PN), pC = sampleGroup(cubes.map((c) => c.children[0]), PN), pB = new Float32Array(PN * 3), pR = new Float32Array(PN);
  for (let i = 0; i < PN; i++) { const a = rnd() * Math.PI * 2, r = 1.2 + rnd() * 2.2, y = (rnd() - 0.5) * 3.2; pB.set([O[1].x + Math.cos(a) * r, O[1].y + y, O[1].z + Math.sin(a) * r], i * 3); pR[i] = rnd(); }
  const pg = new T.BufferGeometry(); pA.set(pB); // no ice block to dissolve from: the particles start as the drifting cloud
  pg.setAttribute('position', new T.BufferAttribute(pA, 3)); pg.setAttribute('aB', new T.BufferAttribute(pB, 3)); pg.setAttribute('aC', new T.BufferAttribute(pC, 3)); pg.setAttribute('aR', new T.BufferAttribute(pR, 1));
  const partU = { uK: { value: 0 }, uT: { value: 0 }, uScale: { value: innerHeight }, uCB: { value: O[1].clone() } };
  const parts = new T.Points(pg, new T.ShaderMaterial({
    uniforms: partU, transparent: true, depthWrite: false,
    vertexShader: [
      'attribute vec3 aB, aC; attribute float aR; uniform float uK, uT, uScale; uniform vec3 uCB; varying float vA;',
      'void main(){',
      '  float e1 = smoothstep(0.0, 1.0, clamp(uK - aR*0.22, 0.0, 1.0)), e2 = smoothstep(0.0, 1.0, clamp(uK - 1.0 - aR*0.22, 0.0, 1.0));',
      '  vec3 b = aB - uCB; float a = uT*0.22*(0.5 + aR); b.xz = mat2(cos(a), -sin(a), sin(a), cos(a)) * b.xz; b += uCB;',
      '  vec3 p = mix(position, b, e1); p = mix(p, aC, e2);',
      '  vec4 mv = modelViewMatrix * vec4(p, 1.0); float z = max(2.0, -mv.z); gl_PointSize = clamp((1.0 + aR*1.4) * uScale / z * 0.026, 1.5, 6.5);',
      '  vA = smoothstep(0.04, 0.18, uK) * (1.0 - smoothstep(1.82, 1.98, uK)) * smoothstep(1.0, 3.0, z); gl_Position = projectionMatrix * mv; }'].join('\n'),
    fragmentShader: 'varying float vA; void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; if (d > 1.0) discard; vec3 col = mix(vec3(0.54, 0.70, 0.84), vec3(0.95, 0.98, 1.0), smoothstep(0.65, 0.0, d)); gl_FragColor = vec4(col, vA * 0.72 * smoothstep(1.0, 0.15, d)); }',
  }));
  parts.frustumCulled = false; S.add(parts);

  // ---------- scroll tracking ----------
  const secs = Array.from(document.querySelectorAll('main > section')), N = secs.length;
  let tS = 0, tTarget = 0;
  const measure = () => {
    const mid = innerHeight * 0.5;
    for (let i = 0; i < N; i++) {
      const r = secs[i].getBoundingClientRect();
      if (mid < r.bottom || i === N - 1) return i + Math.max(0, Math.min(1, (mid - r.top) / Math.max(1, r.height)));
    }
    return 0;
  };
  const held = (x) => { const i = Math.floor(x), f = x - i; return i + (f < 0.25 ? 0 : f > 0.75 ? (f - 0.75) * 4 : 0); };
  const pinned = secs.findIndex((s) => s.id === 'awards');
  const secFrac = (i) => { const r = secs[i].getBoundingClientRect(); return Math.min(1, Math.max(0, (innerHeight * 0.5 - r.top) / Math.max(1, r.height))); };

  // ---------- render loop (smooth locked 60fps+, zero artificial lag, calm subtle motion) ----------
  let last = 0, visible = !document.hidden, t0 = performance.now(), rmDrawn = -1, rmFrames = 0;
  document.addEventListener('visibilitychange', () => { visible = !document.hidden; });
  window.addEventListener('resize', () => { rmDrawn = -1; });
  const mouse = new T.Vector2(), mt = new T.Vector2();
  window.addEventListener('pointermove', (e) => mt.set(e.clientX / innerWidth * 2 - 1, e.clientY / innerHeight * 2 - 1), { passive: true });
  const tmpP = V(0, 0, 0), tmpL = V(0, 0, 0);

  function frame(now) {
    requestAnimationFrame(frame);
    if (!visible) { last = now; return; }
    if (!rm && last) {
      if (++gov.n > 30) {
        gov.ema = gov.ema * 0.9 + Math.min(now - last, 80) * 0.1;
        if (gov.n % 30 === 0) {
          const minQ = Math.min(1, 1 / Math.max(1, Math.min(window.devicePixelRatio || 1, 2)));
          const q = gov.ema > 24 ? Math.max(minQ, gov.q - 0.1) : gov.ema < 16 ? Math.min(1, gov.q + 0.08) : gov.q;
          if (q !== gov.q) { gov.q = q; resize(); }
        }
      }
    }
    const dt = Math.min(0.05, Math.max(0.0005, (now - (last || now)) / 1000)); last = now;
    const t = rm ? 0 : (now - t0) / 1000;
    const idle = rm ? 0 : 1;
    tTarget = measure();
    tS = rm ? Math.round(tTarget) : tS + (tTarget - tS) * (1 - Math.exp(-dt * 9.5));
    if (rm) {
      if (tS === rmDrawn && rmFrames > 3) return;
      rmDrawn = tS; rmFrames++;
    }
    mono.visible = false; // the hero ice block was removed at Shreyansh's request; the group is kept only as a hidden reference
    monoShadow.visible = mono.visible;
    cubes.forEach((c) => { c.visible = false; }); // 3D stat cubes removed at Shreyansh's request: the stats live in the page as frosted cards
    gl3.visible = false; // 3D course-level slabs removed: the schedule list carries this section
    pool.visible = false; // the stylised 3D pool was removed at Shreyansh's request (only a real Cycles pool film may stand in here)
    shards.forEach((g) => { g.visible = false; }); // 3D award crystals removed: the award cards carry this section
    prisms.forEach((g) => { g.visible = false; }); // 3D numbered prisms removed: the 'How I work' cards carry this section
    parts.visible = false; // the drifting particle cloud was removed at Shreyansh's request (it read as out-of-place snow)

    const k = Math.max(0, Math.min(N - 1, held(tS)));
    curP.getPoint(k / (N - 1), tmpP); curL.getPoint(k / (N - 1), tmpL);

    const pf2 = secFrac(4), inPool = Math.abs(tS - 4) < 0.75;
    let poolFilmAlpha = 0;
    if (poolFilm && poolCv) {
      poolFilmAlpha = inPool ? ss(0.02, 0.14, pf2) * (1 - ss(0.86, 0.98, pf2)) : 0;
      poolCv.style.opacity = poolFilmAlpha.toFixed(3);
      if (poolFilmAlpha > 0.005) poolFilm.draw(rm ? 0.52 : pf2);
    }
    if (inPool && !rm && poolFilmAlpha < 0.95) {
      const glide = Math.sin(pf2 * Math.PI);
      tmpP.y = tmpP.y * (1 - glide * 0.35) + 1.55 * (glide * 0.35);
      tmpP.x += (pf2 - 0.5) * 2.2;
      tmpL.x += (pf2 - 0.5) * 1.8;
    }
    if (Math.abs(tS - 3) < 0.6 && !rm) {
      const f = secFrac(3);
      tmpP.x += (f - 0.5) * 2.8;
      tmpL.x += (f - 0.5) * 3.6;
    }
    mouse.lerp(mt, 1 - Math.exp(-dt * 3.5));
    C.position.copy(tmpP).add(V(mouse.x * 0.35 * idle + Math.sin(t * 0.25) * 0.04 * idle, -mouse.y * 0.22 * idle + Math.sin(t * 0.35) * 0.03 * idle, 0));
    C.lookAt(tmpL);
    sun.position.copy(tmpL).add(V(-14, 10, 12)); sun.target.position.copy(tmpL); sky.position.copy(C.position);

    mono.rotation.y = t * 0.09 * idle; mono.position.y = O[0].y + Math.sin(t * 0.5) * 0.08 * idle;
    const kd = Math.max(0, tS);
    // Hero sits at tS=0.5 (100% solid monolith); dissolve begins cleanly as you scroll into About (tS 0.85..1.40)
    monoMesh.material.userData.u.uD.value = rm ? (kd > 0.9 ? 1 : 0) : ss(0.85, 1.40, kd);
    monoInnerMat.userData.u.uD.value = rm ? (kd > 0.9 ? 1 : 0) : ss(0.80, 1.35, kd);
    partU.uK.value = rm ? 0 : Math.max(0, Math.min(2, kd < 1.45 ? ss(0.82, 1.42, kd) : 1 + ss(1.50, 2.15, kd)));
    partU.uT.value = t; partU.uScale.value = innerHeight;
    cubeMat.userData.u.uD.value = rm ? 0 : 1 - ss(1.75, 2.20, kd);
    cubes.forEach((c, i) => {
      c.rotation.y = Math.sin(t * 0.22 + c.userData.ph) * 0.18 * idle;
      c.rotation.x = Math.sin(t * 0.18 + c.userData.ph) * 0.05 * idle;
      c.position.y = O[2].y + (Math.floor(i / 2) * -1.96 + 1.05) + Math.sin(t * 0.55 + c.userData.ph) * 0.05 * idle;
    });
    if (!counted && tTarget > 1.6) {
      counted = true;
      cubes.forEach((c) => { const o = { v: 0 }; gsap.to(o, { v: c.userData.val, duration: rm ? 0.01 : 1.8, ease: 'expo.out', onUpdate: () => c.userData.tex.userData.redraw(Math.round(o.v)) }); });
    }
    gl3.rotation.y = -0.22 + Math.sin(t * 0.16) * 0.03 * idle;
    honLight.intensity = 2.2 + Math.sin(t * 1.0) * 0.4 * idle;
    caust.uT.value = t;

    const af = secFrac(pinned);
    shards.forEach((g, i) => {
      const k2 = rm ? 1 : ss(0.06 + i * 0.08, 0.30 + i * 0.08, af);
      g.position.copy(g.userData.home).add(V((1 - k2) * (i - 1.5) * 3.4, (1 - k2) * 3.6, -(1 - k2) * 2.4));
      // Keep etched award text strictly forward-facing (never flips backwards!)
      g.rotation.set((1 - k2) * 0.35, Math.sin(t * 0.45 + i * 0.9) * 0.22 * idle + (1 - k2) * 0.6, (1 - k2) * 0.15);
      g.position.y += Math.sin(t * 0.6 + i) * 0.05 * idle;
    });
    prisms.forEach((g) => {
      g.rotation.y = Math.sin(t * 0.4 + g.userData.ph) * 0.28 * idle;
      g.position.y = O[6].y + Math.sin(t * 0.5 + g.userData.ph) * 0.07 * idle;
    });

    if (poolFilmAlpha < 0.99) { if (RL) RL.render(1 / 60); else R.render(S, C); }
  }

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => { cubes.forEach((c) => c.userData.tex.userData.redraw()); rmDrawn = -1; });
  }
  window.__world = { S, C, R, gov, poolFilm: () => poolFilm };
  if (RL) loadAll.push(RL.ready);
  S0.boot(Promise.all(loadAll), () => { rmDrawn = -1; });
  requestAnimationFrame(frame);
})();
