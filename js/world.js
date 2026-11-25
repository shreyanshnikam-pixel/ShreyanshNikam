/* Home: one continuous flight through an icy world. Classic script; needs THREE (r147 bundle), FK (kit.js), SITE (core.js), optional FilmPlayer (film.js). */
(function () {
  const T = THREE, S0 = window.SITE, V = (x, y, z) => new T.Vector3(x, y, z);
  const cv = document.getElementById('world'), poolCv = document.getElementById('pool-film');
  const loadAll = [];
  if (!S0.glOk) { S0.boot(Promise.resolve()); return; }
  const isMobile = () => innerWidth < 760;
  const mobile = isMobile(), rm = S0.rm;
  const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  // ---------- pre-rendered pool film slot (zero 404s when assets/films/index.json lists []) ----------
  let poolFilm = null;
  if (window.FilmPlayer && poolCv) {
    loadAll.push(window.FilmPlayer.load(poolCv, 'assets/films/pool/manifest.json', { maxDpr: 2, fit: 'cover', background: '#E7EEF4' })
      .then((pl) => { if (pl) { poolFilm = pl; poolCv.style.display = 'block'; } })
      .catch(() => {}));
  }

  // ---------- renderer, scene, post ----------
  const R = new T.WebGLRenderer({ canvas: cv, antialias: false, powerPreference: 'high-performance' });
  R.outputEncoding = T.LinearEncoding; R.toneMapping = T.NoToneMapping; R.shadowMap.enabled = true; R.shadowMap.type = T.PCFSoftShadowMap;
  const S = new T.Scene(), C = new T.PerspectiveCamera(mobile ? 48 : 36, innerWidth / innerHeight, 0.1, 900);
  const bgC = document.createElement('canvas'); bgC.width = 512; bgC.height = 512;
  { const g = bgC.getContext('2d'), gr = g.createRadialGradient(256, 150, 20, 256, 230, 420); gr.addColorStop(0, '#FFFFFF'); gr.addColorStop(0.45, '#F4F7FA'); gr.addColorStop(1, '#DCE6EE'); g.fillStyle = gr; g.fillRect(0, 0, 512, 512); }
  const bg = new T.CanvasTexture(bgC); bg.encoding = T.sRGBEncoding; S.background = bg; /* replaced by the sky dome once built */
  const FOG_SNOW = new T.Color('#C4D5E3'), FOG_WATER = new T.Color('#3C88A6');
  S.fog = new T.FogExp2(FOG_SNOW.clone(), 0.008);
  const comp = new T.EffectComposer(R, new T.WebGLRenderTarget(4, 4, { type: T.HalfFloatType }));
  comp.addPass(new T.RenderPass(S, C));
  const bloom = new T.UnrealBloomPass(new T.Vector2(256, 256), 0.35, 0.55, 0.96); comp.addPass(bloom);
  const grade = new T.ShaderPass({
    uniforms: {
      tDiffuse: { value: null }, uT: { value: 0 }, uFlash: { value: 0 }, uWater: { value: 0 },
      uVel: { value: 0 }, uDof: { value: 0 }, uFocus: { value: new T.Vector2(0.7, 0.5) },
      uRes: { value: new T.Vector2(1, 1) },
    },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: [
      'uniform sampler2D tDiffuse; uniform float uT, uFlash, uWater, uVel, uDof; uniform vec2 uFocus, uRes; varying vec2 vUv;',
      'float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }',
      'float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }',
      'float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ s += a*n2(p); p *= 2.03; a *= 0.5; } return s; }',
      'vec3 knee(vec3 x){ vec3 k = vec3(0.82); return mix(x, k + 0.18*(1.0 - exp(-(x - k)/0.18)), step(k, x)); }',
      'void main(){',
      '  vec2 c = vUv - 0.5; float r2 = dot(c,c);',
      '  vec2 o = c * (0.0015 + uVel * 0.003 + uFlash * 0.004) * (1.0 + r2*4.0);',
      '  vec3 col = vec3(texture2D(tDiffuse, vUv + o).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - o).b);',
      '  if (uVel > 0.002) {',
      '    vec2 dir = c * (uVel * 0.014);',
      '    vec3 mb = col * 0.34;',
      '    mb += texture2D(tDiffuse, clamp(vUv - dir * 0.45, 0.0, 1.0)).rgb * 0.24;',
      '    mb += texture2D(tDiffuse, clamp(vUv - dir * 0.90, 0.0, 1.0)).rgb * 0.18;',
      '    mb += texture2D(tDiffuse, clamp(vUv + dir * 0.45, 0.0, 1.0)).rgb * 0.14;',
      '    mb += texture2D(tDiffuse, clamp(vUv + dir * 0.90, 0.0, 1.0)).rgb * 0.10;',
      '    col = mix(col, mb, clamp(uVel * 1.4, 0.0, 0.65));',
      '  }',
      '  if (uDof > 0.002) {',
      '    vec2 fd = (vUv - uFocus) * vec2(uRes.x / max(uRes.y, 1.0), 1.0);',
      '    float coc = smoothstep(0.28, 0.95, length(fd)) * uDof;',
      '    if (coc > 0.002) {',
      '      vec2 px = (1.6 * coc) / max(uRes, vec2(1.0));',
      '      vec3 blur = (texture2D(tDiffuse, vUv + vec2(px.x, px.y)).rgb + texture2D(tDiffuse, vUv + vec2(-px.x, px.y)).rgb + texture2D(tDiffuse, vUv + vec2(px.x, -px.y)).rgb + texture2D(tDiffuse, vUv + vec2(-px.x, -px.y)).rgb) * 0.25;',
      '      col = mix(col, blur, coc * 0.55);',
      '    }',
      '  }',
      '  col = mix(col, col * vec3(0.55, 0.85, 0.95) + vec3(0.0, 0.03, 0.05), uWater);',
      '  col = knee(col); col = pow(max(col, 0.0), vec3(1.0/2.2));',
      '  col = mix(col, col*col*(3.0-2.0*col), 0.35); col *= vec3(0.97, 0.99, 1.03);',
      '  col *= mix(1.0, smoothstep(1.3, 0.2, r2*1.6), 0.52 + uVel * 0.12);',
      '  if (uFlash > 0.001) {',
      '    float m = fbm(vUv * vec2(uRes.x/uRes.y, 1.0) * 3.0 + uT * 0.15);',
      '    float w = smoothstep(m - 0.18, m + 0.18, uFlash * 1.25); col = mix(col, vec3(1.0), w);',
      '  }',
      '  col += (h(vUv * uRes + fract(uT*7.1)*100.0) - 0.5) * 0.03;',
      '  gl_FragColor = vec4(col, 1.0);',
      '}'].join('\n'),
  });
  comp.addPass(grade);
  // adaptive DPR governor capped at <=2 (1.5 on narrow mobile), targeting <16ms frame time for native 60-240Hz
  const gov = { q: 1, ema: 12, n: 0 };
  const getDpr = () => Math.min(window.devicePixelRatio || 1, isMobile() ? 1.5 : 2) * gov.q;
  const resize = () => { const w = innerWidth, h = innerHeight, dpr = getDpr(); R.setPixelRatio(dpr); R.setSize(w, h, false); comp.setPixelRatio(dpr); comp.setSize(w, h); C.aspect = w / h; C.fov = w / h < 0.9 ? 50 : 36; C.updateProjectionMatrix(); grade.uniforms.uRes.value.set(w, h); bloom.resolution.set(Math.max(64, w >> 2), Math.max(64, h >> 2)); };
  window.addEventListener('resize', resize); resize();

  // ---------- light and environment ----------
  const sun = new T.DirectionalLight(0xffffff, 2.3); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 65 }); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; sun.shadow.radius = 3;
  S.add(sun); S.add(sun.target);
  S.add(new T.HemisphereLight(0x9fc0dc, 0x87a2b8, 0.65));
  const pm = new T.PMREMGenerator(R);
  loadAll.push(new Promise((res) => new T.RGBELoader().load('assets/textures/snow_2k.hdr', (tx) => { tx.mapping = T.EquirectangularReflectionMapping; S.environment = pm.fromEquirectangular(tx).texture; res(); }, undefined, () => res())));
  const TL = new T.TextureLoader();
  const ltex = (f, srgb, rep) => { const t = TL.load(f); t.wrapS = t.wrapT = T.RepeatWrapping; if (srgb) t.encoding = T.sRGBEncoding; t.anisotropy = 8; if (rep) t.repeat.set(rep, rep); return t; };

  // Procedural micro-crystalline frost normal & roughness maps (generated once, zero network cost)
  const frostMaps = (() => {
    const SZ = 256, hgt = new Float32Array(SZ * SZ);
    for (let y = 0; y < SZ; y++) for (let x = 0; x < SZ; x++) {
      const u = x / SZ, v = y / SZ;
      const n1 = FK.fbm(u * 8, v * 8, 1.3, 4);
      const n2 = FK.noise(u * 28, v * 28, 4.7) * 0.45 + FK.noise(u * 64, v * 64, 9.1) * 0.25;
      hgt[y * SZ + x] = n1 * 0.65 + n2 * 0.35;
    }
    const nC = document.createElement('canvas'); nC.width = nC.height = SZ;
    const rC = document.createElement('canvas'); rC.width = rC.height = SZ;
    const nX = nC.getContext('2d'), rX = rC.getContext('2d');
    const nImg = nX.createImageData(SZ, SZ), rImg = rX.createImageData(SZ, SZ);
    for (let y = 0; y < SZ; y++) for (let x = 0; x < SZ; x++) {
      const xm = (x - 1 + SZ) % SZ, xp = (x + 1) % SZ, ym = (y - 1 + SZ) % SZ, yp = (y + 1) % SZ;
      const dx = (hgt[y * SZ + xp] - hgt[y * SZ + xm]) * 3.2;
      const dy = (hgt[yp * SZ + x] - hgt[ym * SZ + x]) * 3.2;
      const inv = 1 / Math.hypot(dx, dy, 1);
      const i = (y * SZ + x) * 4;
      nImg.data[i] = Math.round((-dx * inv * 0.5 + 0.5) * 255);
      nImg.data[i + 1] = Math.round((-dy * inv * 0.5 + 0.5) * 255);
      nImg.data[i + 2] = Math.round((inv * 0.5 + 0.5) * 255);
      nImg.data[i + 3] = 255;
      const rv = Math.round((0.18 + hgt[y * SZ + x] * 0.22) * 255);
      rImg.data[i] = rImg.data[i + 1] = rImg.data[i + 2] = rv; rImg.data[i + 3] = 255;
    }
    nX.putImageData(nImg, 0, 0); rX.putImageData(rImg, 0, 0);
    const nor = new T.CanvasTexture(nC), rgh = new T.CanvasTexture(rC);
    [nor, rgh].forEach((tx) => { tx.wrapS = tx.wrapT = T.RepeatWrapping; tx.repeat.set(2.5, 2.5); tx.anisotropy = 4; });
    return { nor, rgh };
  })();

  // Single-pass frosted glacial ice (calibrated in LINEAR color space to exact Snow/Glacier/Ice-blue/Deep-ice palette)
  const DISS = [];
  const ice = (o) => {
    const m = new T.MeshPhysicalMaterial(Object.assign({
      color: new T.Color('#B8CEE0'),
      transparent: true, opacity: 0.86, depthWrite: false,
      roughness: 0.34, metalness: 0.03,
      normalMap: frostMaps.nor, normalScale: new T.Vector2(0.75, 0.75),
      roughnessMap: frostMaps.rgh,
      clearcoat: 0.25, clearcoatRoughness: 0.34,
      envMapIntensity: 0.82, reflectivity: 0.7,
    }, o || {}));
    const u = { uD: { value: 0 } }; m.userData.u = u; DISS.push(m);
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uD = u.uD;
      sh.vertexShader = 'varying vec3 vOP;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vOP = position;');
      sh.fragmentShader = 'uniform float uD; varying vec3 vOP;\nfloat dh(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719))) * 43758.5453); }\nfloat dn(vec3 p){ vec3 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(mix(dh(i),dh(i+vec3(1,0,0)),f.x),mix(dh(i+vec3(0,1,0)),dh(i+vec3(1,1,0)),f.x),f.y),mix(mix(dh(i+vec3(0,0,1)),dh(i+vec3(1,0,1)),f.x),mix(dh(i+vec3(0,1,1)),dh(i+vec3(1,1,1)),f.x),f.y),f.z); }\n' +
        sh.fragmentShader.replace('void main() {', 'void main() {\n float dz = dn(vOP * 2.3) * 0.65 + dn(vOP * 7.0) * 0.35; if (dz < uD) discard;')
          .replace('#include <output_fragment>', [
            '{ vec3 nV = normalize(normal), vV = normalize(vViewPosition);',
            '  float ndv = clamp(abs(dot(nV, vV)), 0.0, 1.0);',
            '  // Linear-space frosted glacial optics: cold Beer-Lambert absorption + refracted bevels + micro-frost rime',
            '  float frostTex = dn(vOP * 5.5) * 0.55 + dn(vOP * 18.0) * 0.45;',
            '  float pathLen = 1.0 + (1.0 - ndv) * 1.35;',
            '  vec3 beer = exp(-vec3(0.68, 0.44, 0.28) * pathLen * (0.78 + 0.32 * frostTex));',
            '  float bevel = pow(1.0 - ndv, 2.0);',
            '  float schlick = 0.018 + 0.982 * pow(1.0 - ndv, 5.0);',
            '  // Cold monochrome glacial palette: Glacier/Ice-blue frosted body -> Deep-ice shadows -> slate-blue refracted edge',
            '  vec3 iceCore = mix(vec3(0.20, 0.31, 0.41), vec3(0.52, 0.63, 0.74), smoothstep(0.22, 0.84, frostTex));',
            '  vec3 darkEdge = vec3(0.06, 0.13, 0.20);',
            '  vec3 col = outgoingLight * 0.50 * beer + iceCore * 0.36;',
            '  col = mix(col, darkEdge, bevel * 0.64);',
            '  // Subtle Snell chromatic rim split + frosted white micro-crystal glints',
            '  col *= vec3(1.0 - 0.04 * schlick, 1.0 + 0.005 * schlick, 1.0 + 0.05 * schlick);',
            '  float micro = dn(vOP * 36.0);',
            '  float glint = pow(clamp(micro * (0.5 + 0.5 * bevel), 0.0, 1.0), 12.0) * 0.45;',
            '  col += vec3(0.78, 0.85, 0.92) * (schlick * 0.46 + glint);',
            '  outgoingLight = col;',
            '  diffuseColor.a = clamp(diffuseColor.a + bevel * 0.12 + frostTex * 0.05, 0.68, 0.96);',
            '  float edge = smoothstep(uD, uD + 0.06, dz);',
            '  outgoingLight = mix(vec3(0.95, 0.98, 1.0), outgoingLight, uD > 0.001 ? edge : 1.0); }',
            '#include <output_fragment>'].join('\n'));
    };
    m.customProgramCacheKey = () => 'ice-frost-lin2';
    return m;
  };
  const textCanvas = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.anisotropy = 8; t.userData.redraw = (...a) => { const g = c.getContext('2d'); g.clearRect(0, 0, w, h); draw(g, w, h, ...a); t.needsUpdate = true; }; t.userData.redraw(); return t; };
  const inner = (tex, w, h) => { const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ map: tex, alphaTest: 0.35, side: T.DoubleSide, fog: false })); m.renderOrder = 1; return m; };

  // ---------- anchors ----------
  const O = [V(4.6, 3.2, 0), V(4.2, 3.2, -26), V(-4.4, 2.6, -52), V(5.2, 0, -80), V(-3.5, 0, -106), V(4.2, 3.2, -134), V(-4.2, 3.0, -160), V(0, 2, -150)];
  const CAM = [
    { p: V(-0.4, 3.0, 12.5), l: V(1.6, 3.0, 0) },
    { p: V(0.6, 2.1, -14), l: V(2.6, 2.8, -26) },
    { p: V(-0.8, 2.9, -41), l: V(-2.8, 2.6, -52) },
    { p: V(1.2, 2.6, -68), l: V(3.6, 1.0, -80) },
    { p: V(-1.0, 2.4, -96), l: V(-2.8, 0.2, -106) },
    { p: V(0.6, 3.3, -122), l: V(2.6, 3.1, -134) },
    { p: V(-0.6, 3.2, -149), l: V(-2.6, 3.0, -160) },
    { p: V(0, 24, -186), l: V(0, 1, -110) },
  ];
  const curP = new T.CatmullRomCurve3(CAM.map((c) => c.p), false, 'centripetal'), curL = new T.CatmullRomCurve3(CAM.map((c) => c.l), false, 'centripetal');

  // ---------- ground: snowfield with the pool cut out, contour grid, distant mountains ----------
  const shape = new T.Shape(); shape.moveTo(-260, -320); shape.lineTo(260, -320); shape.lineTo(260, 120); shape.lineTo(-260, 120); shape.lineTo(-260, -320);
  const hole = new T.Path(); const PX = O[4].x, PZ = O[4].z, PL = 14, PW = 8.4; hole.moveTo(PX - PL / 2 - 1.2, PZ - PW / 2 - 1); hole.lineTo(PX + PL / 2 + 1.2, PZ - PW / 2 - 1); hole.lineTo(PX + PL / 2 + 1.2, PZ + PW / 2 + 1); hole.lineTo(PX - PL / 2 - 1.2, PZ + PW / 2 + 1); shape.holes.push(hole);
  const gGeo = new T.ShapeGeometry(shape, 1); gGeo.rotateX(Math.PI / 2); { const uv = gGeo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 7, uv.getY(i) / 7); }
  gGeo.setAttribute('uv2', gGeo.attributes.uv);
  const gMat = new T.MeshStandardMaterial({ color: 0xffffff, map: ltex('assets/textures/snow_diff.jpg', true), normalMap: ltex('assets/textures/snow_nor_gl.jpg'), roughnessMap: ltex('assets/textures/snow_rough.jpg'), normalScale: new T.Vector2(0.7, 0.7), side: T.DoubleSide });
  FK.patch(gMat, 'snow-grid-ao-glint', {}, 'float sgh(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }', [
    '{ vec2 g = abs(fract(vWP.xz / 4.0 - 0.5) - 0.5) / fwidth(vWP.xz / 4.0);',
    '  float line = 1.0 - min(min(g.x, g.y), 1.0);',
    '  float dist = length(vWP.xz - cameraPosition.xz);',
    '  float fade = exp(-dist * 0.04);',
    '  // Crisp powder-snow sunlight micro-sparkles',
    '  vec3 vd = normalize(cameraPosition - vWP);',
    '  vec2 cell = floor(vWP.xz * 22.0);',
    '  float sp = sgh(cell + floor(vd.xz * 14.0));',
    '  float sparkle = smoothstep(0.985, 1.0, sp) * exp(-dist * 0.055) * 0.55;',
    '  // Per-pixel grounded ambient-occlusion contact shadows beneath hero objects',
    '  float ao = 1.0;',
    '  ao *= 1.0 - 0.24 * exp(-dot(vWP.xz - vec2(4.6, 0.0), vWP.xz - vec2(4.6, 0.0)) * 0.14);',
    '  ao *= 1.0 - 0.22 * exp(-dot(vWP.xz - vec2(-4.4, -52.0), vWP.xz - vec2(-4.4, -52.0)) * 0.07);',
    '  ao *= 1.0 - 0.28 * exp(-dot((vWP.xz - vec2(5.2, -80.0)) * vec2(0.18, 0.45), (vWP.xz - vec2(5.2, -80.0)) * vec2(0.18, 0.45)));',
    '  ao *= 1.0 - 0.20 * exp(-dot(vWP.xz - vec2(4.2, -134.0), vWP.xz - vec2(4.2, -134.0)) * 0.07);',
    '  ao *= 1.0 - 0.20 * exp(-dot(vWP.xz - vec2(-4.2, -160.0), vWP.xz - vec2(-4.2, -160.0)) * 0.08);',
    '  outgoingLight *= mix(vec3(0.76, 0.84, 0.92), vec3(1.0), ao);',
    '  outgoingLight += vec3(0.95, 0.98, 1.0) * sparkle;',
    '  outgoingLight = mix(outgoingLight, vec3(0.6, 0.69, 0.77), line * fade * 0.24); }'].join('\n'), true);
  const ground = new T.Mesh(gGeo, gMat); ground.receiveShadow = true; S.add(ground);
  const rnd = FK.rng(21);
  // mountain range: a displaced terrain with a flat valley along the camera path, snow on flats, rock on steep faces
  { const SZ = 1600, SEG = mobile ? 100 : 180, tg = new T.PlaneGeometry(SZ, SZ, SEG, SEG); tg.rotateX(-Math.PI / 2); const p = tg.attributes.position;
    for (let k = 0; k < p.count; k++) { const x = p.getX(k), z = p.getZ(k) - 80;
      const dv = Math.max(Math.abs(x) - 22, 0, z - 60, -260 - z) , valley = ss(0, 160, dv);
      let r = 0, a = 1, f = 1 / 220; for (let o = 0; o < 6; o++) { const n = 1 - Math.abs(FK.noise(x * f + 11, z * f - 7, o * 3.1) * 2 - 1); r += n * n * a; a *= 0.5; f *= 2.05; }
      p.setY(k, valley * r * (110 + 120 * FK.noise(x / 500, z / 500, 5)) - 1.2); }
    tg.computeVertexNormals();
    const tm = new T.MeshStandardMaterial({ color: 0xffffff, map: ltex('assets/textures/snow_diff.jpg', true, 60), roughness: 0.9 });
    const rockT = ltex('assets/textures/rock_diff.jpg', true);
    FK.patch(tm, 'mtn', { rockT: { value: rockT } }, 'uniform sampler2D rockT;', [
      '{ vec3 wn = normalize(cross(dFdx(vWP), dFdy(vWP)));',
      '  float steep = smoothstep(0.82, 0.55, abs(wn.y));',
      '  vec3 rk = texture2D(rockT, vWP.xz * 0.02 + vWP.y * 0.01).rgb; rk = pow(rk, vec3(1.6)) * vec3(0.55, 0.62, 0.7);',
      '  outgoingLight = mix(outgoingLight, outgoingLight * rk * 1.6, steep * 0.85); }'].join('\n'), true);
    const terrain = new T.Mesh(tg, tm); terrain.position.z = -80; terrain.receiveShadow = true; S.add(terrain); }
  // low fog banks: pre-baked soft mist texture (replaces 9x heavy per-pixel fbm loops -> 30x faster & smoother)
  const mistTex = (() => {
    const SZ = 256, c = document.createElement('canvas'); c.width = c.height = SZ;
    const x = c.getContext('2d'), img = x.createImageData(SZ, SZ);
    for (let j = 0; j < SZ; j++) for (let i = 0; i < SZ; i++) {
      const u = i / SZ, v = j / SZ;
      const n = FK.fbm(u * 5, v * 5, 2.1, 4) * FK.fbm(u * 9 + 3, v * 9 + 1, 5.7, 3);
      const ex = ss(0, 0.25, u) * ss(1, 0.75, u) * ss(0, 0.25, v) * ss(1, 0.75, v);
      const a = Math.max(0, Math.min(255, Math.round(ss(0.08, 0.34, n) * ex * 135)));
      const k = (j * SZ + i) * 4; img.data[k] = 240; img.data[k + 1] = 246; img.data[k + 2] = 250; img.data[k + 3] = a;
    }
    x.putImageData(img, 0, 0); const tx = new T.CanvasTexture(c); tx.wrapS = tx.wrapT = T.RepeatWrapping; return tx;
  })();
  const bankU = { uT: { value: 0 }, tMist: { value: mistTex } };
  const bankM = new T.ShaderMaterial({ uniforms: bankU, transparent: true, depthWrite: false, fog: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform float uT; uniform sampler2D tMist; varying vec2 vUv; void main(){ float m1 = texture2D(tMist, vUv + vec2(uT * 0.008, uT * 0.002)).a; float m2 = texture2D(tMist, vUv * 1.4 - vec2(uT * 0.005, 0.0)).a; float e = smoothstep(0.0, 0.22, vUv.x)*smoothstep(1.0, 0.78, vUv.x)*smoothstep(0.0, 0.22, vUv.y)*smoothstep(1.0, 0.78, vUv.y); gl_FragColor = vec4(vec3(0.94, 0.965, 0.985), (m1 * 0.65 + m2 * 0.35) * e * 0.58); }' });
  for (let i = 0; i < 5; i++) { const m = new T.Mesh(new T.PlaneGeometry(210, 110), bankM); m.rotation.x = -Math.PI / 2; m.position.set((rnd() - 0.5) * 45, 0.9 + i * 1.1, -i * 42 + 8); S.add(m); }
  // god rays: soft shafts falling from the sun side
  const rayM = new T.ShaderMaterial({ uniforms: { uT: bankU.uT, uA: { value: 1 } }, transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, fog: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform float uT, uA; varying vec2 vUv; void main(){ float s = smoothstep(0.0, 0.5, vUv.x) * smoothstep(1.0, 0.5, vUv.x); float b = 0.55 + 0.45 * sin(vUv.x * 18.0 + uT * 0.25) * sin(vUv.x * 7.0 - uT * 0.17); gl_FragColor = vec4(vec3(1.0, 0.98, 0.94), s * b * vUv.y * 0.11 * uA); }' });
  const rays = new T.Group(); for (let i = 0; i < 5; i++) { const m = new T.Mesh(new T.PlaneGeometry(14 + i * 4, 70), rayM); m.position.set(-20 + i * 7, 30, -20 - i * 30); m.rotation.set(0, 0.3, -0.55); rays.add(m); } S.add(rays);
  // sky dome: cold blue-hour gradient with drifting cirrus and a low sun glow (icy palette)
  const skyU = { uT: bankU.uT, uSun: { value: V(-0.45, 0.18, -0.87).normalize() } };
  const sky = new T.Mesh(new T.SphereGeometry(760, 40, 20), new T.ShaderMaterial({ uniforms: skyU, side: T.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }',
    fragmentShader: [
      'uniform float uT; uniform vec3 uSun; varying vec3 vD;',
      'float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); } float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }',
      'float fb(vec2 p){ float s=0.0,a=0.5; for(int i=0;i<4;i++){ s+=a*n(p); p=p*2.03+vec2(1.7,9.2); a*=0.5; } return s; }',
      'vec3 lin(vec3 c){ return pow(c, vec3(2.2)); }',
      'void main(){ vec3 d = normalize(vD); float y = d.y;',
      '  vec3 zen = lin(vec3(0.24, 0.38, 0.52)), mid = lin(vec3(0.55, 0.69, 0.80)), hor = lin(vec3(0.86, 0.91, 0.95));',
      '  vec3 col = mix(hor, mid, smoothstep(-0.01, 0.07, y)); col = mix(col, zen, smoothstep(0.07, 0.4, y));',
      '  float s = max(dot(d, uSun), 0.0); col += lin(vec3(1.0, 0.97, 0.92)) * (pow(s, 600.0) * 6.0 + pow(s, 24.0) * 0.35 + pow(s, 4.0) * 0.12);',
      '  vec2 uv = d.xz / max(y + 0.12, 0.05); float c = fb(uv * 1.3 + vec2(uT * 0.004, 0.0)); float c2 = fb(uv * 3.1 - vec2(uT * 0.006, uT * 0.002));',
      '  float cl = smoothstep(0.48, 0.78, c * 0.7 + c2 * 0.45) * smoothstep(0.0, 0.25, y);',
      '  vec3 cc = mix(lin(vec3(0.72, 0.80, 0.88)), lin(vec3(1.0)), smoothstep(0.5, 0.9, c2) + pow(s, 8.0));',
      '  col = mix(col, cc, cl * 0.85); col = mix(col, hor, smoothstep(0.06, -0.02, y));',
      '  gl_FragColor = vec4(col, 1.0); }'].join('\n') }));
  sky.frustumCulled = false; S.add(sky);
  // realistic 6-fold dendritic crystalline snowflakes (rotating, near-lens bokeh, seamless wrap fade, accurate sunlit white + ice-blue shading; off in reduced motion)
  const SN = rm ? 0 : (mobile ? 550 : 1400);
  const snowU = { uT: { value: 0 }, uCam: { value: new T.Vector3() }, uScale: { value: innerHeight }, uWind: { value: 1 } };
  if (SN) {
    const sp = new Float32Array(SN * 3), sr = new Float32Array(SN);
    for (let i = 0; i < SN; i++) { sp.set([rnd() * 44 - 22, rnd() * 18, rnd() * 44 - 22], i * 3); sr[i] = rnd(); }
    const sg = new T.BufferGeometry(); sg.setAttribute('position', new T.BufferAttribute(sp, 3)); sg.setAttribute('aR', new T.BufferAttribute(sr, 1));
    const snow = new T.Points(sg, new T.ShaderMaterial({
      uniforms: snowU, transparent: true, depthWrite: false,
      vertexShader: [
        'attribute float aR; uniform float uT, uScale, uWind; uniform vec3 uCam;',
        'varying float vA, vNear, vAng, vGlint;',
        'void main(){',
        '  vec3 b = vec3(44.0, 18.0, 44.0); float w = 0.65 + aR * 0.7;',
        '  vec3 p = position + vec3(uT*0.72*uWind*w + sin(uT*0.42+aR*19.0)*1.15, -uT*(0.38+aR*0.44), uT*0.18 + cos(uT*0.36+aR*13.0)*0.75);',
        '  vec3 rel = mod(p - uCam + b*0.5, b) - b*0.5;',
        '  vec3 wf = smoothstep(0.5, 0.34, abs(rel / b)); float wrapFade = wf.x * wf.y * wf.z;',
        '  vec4 mv = modelViewMatrix * vec4(rel + uCam, 1.0);',
        '  float z = max(1.0, -mv.z);',
        '  vNear = smoothstep(6.5, 1.8, z);',
        '  vAng = aR * 6.28318 + uT * (0.28 + aR * 0.42) * (aR > 0.5 ? 1.0 : -1.0);',
        '  vGlint = pow(0.5 + 0.5 * sin(uT * 2.2 + aR * 47.0), 6.0);',
        '  gl_PointSize = clamp((3.2 + aR*3.4 + vNear*6.0) * uScale / z * 0.055, 2.5, 28.0);',
        '  vA = wrapFade * (0.52 + aR*0.38) * smoothstep(40.0, 7.0, z) * smoothstep(0.8, 2.0, z) * (1.0 - vNear * 0.45);',
        '  gl_Position = projectionMatrix * mv;',
        '}'].join('\n'),
      fragmentShader: [
        'varying float vA, vNear, vAng, vGlint;',
        'void main(){',
        '  vec2 u = (gl_PointCoord - 0.5) * 2.0;',
        '  float r = length(u); if (r > 1.0) discard;',
        '  float ca = cos(vAng), sa = sin(vAng);',
        '  vec2 p = vec2(u.x * ca - u.y * sa, u.x * sa + u.y * ca);',
        '  // 6-fold hexagonal crystal fold + dendritic branches',
        '  float ang = abs(mod(atan(p.y, p.x) + 0.523599, 1.047198) - 0.523599);',
        '  vec2 q = vec2(cos(ang), sin(ang)) * r;',
        '  float stem = smoothstep(0.11, 0.025, q.y) * smoothstep(0.95, 0.62, q.x);',
        '  float b1 = smoothstep(0.085, 0.02, abs(q.y - (q.x - 0.28) * 1.15)) * smoothstep(0.24, 0.34, q.x) * smoothstep(0.74, 0.56, q.x);',
        '  float b2 = smoothstep(0.075, 0.018, abs(q.y - (q.x - 0.54) * 1.15)) * smoothstep(0.50, 0.58, q.x) * smoothstep(0.90, 0.76, q.x);',
        '  float core = smoothstep(0.26, 0.06, r);',
        '  float crystal = clamp(max(max(stem, core), max(b1, b2)), 0.0, 1.0);',
        '  float bokeh = smoothstep(1.0, 0.08, r) * (0.72 + 0.28 * smoothstep(0.35, 0.85, r));',
        '  float mask = mix(crystal, bokeh, vNear);',
        '  if (mask < 0.02) discard;',
        '  // Accurate physical coloration (linear): pure sunlit white core + cool ice-blue shadowed edges',
        '  vec3 edgeCol = vec3(0.42, 0.61, 0.78);',
        '  vec3 whiteCore = vec3(0.96, 0.985, 1.0);',
        '  vec3 col = mix(edgeCol, whiteCore, smoothstep(0.15, 0.78, mask) * (0.75 + 0.25 * (1.0 - r)));',
        '  col += vec3(0.32, 0.36, 0.42) * vGlint * smoothstep(0.5, 0.95, crystal);',
        '  gl_FragColor = vec4(col, vA * mask);',
        '}'].join('\n'),
    }));
    snow.frustumCulled = false; S.add(snow);
  }

  // ---------- 01: the monolith ----------
  const mono = new T.Group(); mono.position.copy(O[0]); S.add(mono);
  const monoMesh = new T.Mesh(new T.RoundedBoxGeometry(1.5, 5.2, 1.5, 6, 0.12), ice()); monoMesh.castShadow = true; monoMesh.renderOrder = 2; mono.add(monoMesh);
  const monoInnerMat = ice({ opacity: 0.85 });
  for (let i = 0; i < 7; i++) { const sh = new T.Mesh(new T.OctahedronGeometry(0.22 + rnd() * 0.3, 0), monoInnerMat); sh.scale.y = 2.2 + rnd() * 2; sh.position.set((rnd() - 0.5) * 0.7, (rnd() - 0.5) * 3.6, (rnd() - 0.5) * 0.7); sh.rotation.set(rnd(), rnd(), rnd() * 0.5); sh.renderOrder = 1; mono.add(sh); }
  const monoShadow = new T.Mesh(new T.CircleGeometry(1.8, 48), new T.MeshBasicMaterial({ color: 0x5E8AAB, transparent: true, opacity: 0.1, depthWrite: false })); monoShadow.rotation.x = -Math.PI / 2; monoShadow.position.set(O[0].x, 0.02, O[0].z); S.add(monoShadow);

  // ---------- 03: four ice cubes, each with a number frozen inside ----------
  const STATS = [[39, 'AP courses'], [13, 'dual enrollment'], [5, 'pathways'], [474, 'AP Scholars']];
  const cubeGeo = new T.RoundedBoxGeometry(1.8, 1.8, 1.8, 5, 0.14);
  const cubeMat = ice({ thickness: 1.8 });
  const cubes = STATS.map((s, i) => {
    const g = new T.Group(); g.position.copy(O[2]).add(V((i % 2) * 2.3 - 1.15, Math.floor(i / 2) * -2.2 + 1.2, (i % 2) * -0.6)); S.add(g);
    const m = new T.Mesh(cubeGeo, cubeMat); m.castShadow = true; m.renderOrder = 2; g.add(m);
    const tex = textCanvas(512, 512, (x, w, h, v) => { x.fillStyle = '#2F4F6A'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = '600 ' + (String(v == null ? s[0] : v).length > 2 ? 150 : 200) + 'px Unbounded, sans-serif'; x.fillText(String(v == null ? s[0] : v), w / 2, h * 0.46); x.font = '500 34px "Geist Mono", monospace'; x.fillStyle = '#5E8AAB'; x.fillText(s[1].toUpperCase(), w / 2, h * 0.8); });
    const pl = inner(tex, 1.25, 1.25); g.add(pl); g.userData = { tex, val: s[0], ph: i * 1.3, m };
    return g;
  });
  let counted = false;

  // ---------- 04: glacier cross-section: AP over Honors over College Prep ----------
  const gl3 = new T.Group(); gl3.position.copy(O[3]); S.add(gl3);
  const layer = (y0, h, mat, lab, sub, glow) => {
    const sh2 = new T.Shape(); const L = 16, N = 60;
    sh2.moveTo(-L / 2, 0); for (let i = 0; i <= N; i++) { const x = -L / 2 + i / N * L; sh2.lineTo(x, h + Math.sin(x * 0.9 + y0) * 0.12 + FK.noise(x * 0.8, y0 * 3, 1) * 0.18); } sh2.lineTo(L / 2, 0); sh2.lineTo(-L / 2, 0);
    const m = new T.Mesh(new T.ExtrudeGeometry(sh2, { depth: 3.2, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 2, curveSegments: 4 }), mat);
    m.position.set(0, y0, -1.6); m.castShadow = m.receiveShadow = true; gl3.add(m);
    const t = textCanvas(1024, 256, (x, w, hh) => { x.fillStyle = glow ? '#0F1B26' : '#2F4F6A'; x.font = '600 96px Unbounded, sans-serif'; x.textBaseline = 'middle'; x.fillText(lab, 24, hh * 0.42); x.font = '500 30px "Geist Mono", monospace'; x.fillStyle = '#5E8AAB'; x.fillText(sub.toUpperCase(), 28, hh * 0.82); });
    const p = inner(t, 4.2, 1.05); p.position.set(-5.2, y0 + h * 0.5, 1.68); gl3.add(p);
    return m;
  };
  layer(2.2, 1.1, new T.MeshStandardMaterial({ color: 0xf6f9fb, roughness: 0.9 }), 'AP', 'opens in later years');
  const hon = layer(1.0, 1.15, ice({ thickness: 2.4, attenuationDistance: 1.6, roughness: 0.12 }), 'HONORS', 'highest level open to freshmen', true);
  layer(-0.25, 1.2, new T.MeshPhysicalMaterial({ color: 0x8fb0c8, roughness: 0.35, clearcoat: 0.5 }), 'COLLEGE PREP', 'one of my five');
  const honLight = new T.PointLight(0xA9CBE3, 6, 10, 2); honLight.position.set(0, 1.6, 0.3); gl3.add(honLight);

  // ---------- 05: the pool under the ice ----------
  const pool = new T.Group(); pool.position.set(PX, 0, PZ); S.add(pool);
  const DP = 2.6;
  const tileT = textCanvas(1024, 616, (x, w, h) => { x.fillStyle = '#DCE9EE'; x.fillRect(0, 0, w, h); for (let i = 0; i < w; i += 16) for (let j = 0; j < h; j += 16) { x.fillStyle = `rgb(${218 + rnd() * 16},${232 + rnd() * 12},${238 + rnd() * 12})`; x.fillRect(i + 1, j + 1, 14, 14); } x.fillStyle = '#1C3A52'; for (let k = 0; k < 4; k++) { const y = (k + 0.5) / 4 * h; x.fillRect(w * 0.05, y - 7, w * 0.9, 14); x.fillRect(w * 0.05, y - 34, 14, 68); x.fillRect(w * 0.95 - 14, y - 34, 14, 68); } });
  const caust = { uT: { value: 0 } };
  const poolFloorM = new T.MeshStandardMaterial({ map: tileT, roughness: 0.35 });
  // Dual-layer chromatic refracted caustics with Beer-Lambert depth attenuation
  FK.patch(poolFloorM, 'caust-dual', caust, 'uniform float uT;\nfloat caustL(vec2 q, float t){ float c = 0.0; for (int i = 0; i < 3; i++){ float fi = float(i); vec2 o = vec2(sin(t*0.6 + fi*1.7), cos(t*0.5 + fi*2.3)); vec2 p2 = q*(1.0 + fi*0.37) + o; c += pow(abs(sin(p2.x + sin(p2.y*1.3 + t*0.8)) * sin(p2.y + sin(p2.x*1.1 - t*0.7))), 6.0); } return c; }', [
    '{ vec2 q = vWP.xz * 1.55;',
    '  float cR = caustL(q + vec2(0.018, 0.008), uT) + 0.55 * caustL(q * 1.65 - vec2(uT*0.2, -uT*0.15), -uT * 0.85);',
    '  float cG = caustL(q, uT) + 0.55 * caustL(q * 1.65 - vec2(uT*0.2, -uT*0.15), -uT * 0.85);',
    '  float cB = caustL(q - vec2(0.018, 0.01), uT) + 0.55 * caustL(q * 1.65 - vec2(uT*0.2, -uT*0.15), -uT * 0.85);',
    '  vec3 beer = exp(-vec3(0.45, 0.14, 0.07) * max(0.0, -0.3 - vWP.y));',
    '  outgoingLight = outgoingLight * mix(vec3(1.0), beer, 0.45) + vec3(cR * 0.72, cG * 0.94, cB * 1.0) * 0.48; }'].join('\n'), true);
  const pf = new T.Mesh(new T.PlaneGeometry(PL, PW).rotateX(-Math.PI / 2), poolFloorM); pf.position.y = -DP; pf.receiveShadow = true; pool.add(pf);
  const wallM = new T.MeshStandardMaterial({ color: 0xd3e3ea, roughness: 0.4, side: T.DoubleSide });
  FK.patch(wallM, 'caustw-dual', caust, 'uniform float uT;', [
    '{ float c1 = pow(abs(sin(vWP.x*2.0 + sin(vWP.y*3.0 + uT)) * sin(vWP.y*2.5 + uT*0.7)), 7.0);',
    '  float c2 = pow(abs(sin(vWP.z*2.2 - sin(vWP.y*2.6 - uT*0.9)) * sin(vWP.y*2.1 - uT*0.5)), 7.0);',
    '  vec3 beer = exp(-vec3(0.45, 0.14, 0.07) * max(0.0, -0.3 - vWP.y));',
    '  outgoingLight = outgoingLight * mix(vec3(1.0), beer, 0.4) + vec3(0.68, 0.9, 1.0) * (c1 + c2 * 0.6) * 0.34; }'].join('\n'), true);
  [[0, -DP / 2, -PW / 2, 0, PL], [0, -DP / 2, PW / 2, Math.PI, PL], [-PL / 2, -DP / 2, 0, Math.PI / 2, PW], [PL / 2, -DP / 2, 0, -Math.PI / 2, PW]].forEach(([x, y, z, ry, w]) => { const m = new T.Mesh(new T.PlaneGeometry(w, DP), wallM); m.position.set(x, y, z); m.rotation.y = ry; pool.add(m); });
  const floatG = new T.CylinderGeometry(0.06, 0.06, 0.1, 10).rotateZ(Math.PI / 2);
  const floatM = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
  const floatInst = new T.InstancedMesh(floatG, floatM, 210);
  { const dm = new T.Object3D(), colR = new T.Color(0xc8102e), colB = new T.Color(0x2a5aa8), colW = new T.Color(0xf2f2f2); let idx = 0;
    for (let k = 1; k < 4; k++) for (let i = 0; i < 70; i++) { const edge = i < 9 || i > 60; dm.position.set(-PL / 2 + 0.1 + i * (PL - 0.2) / 69, -0.3, -PW / 2 + k * PW / 4); dm.updateMatrix(); floatInst.setMatrixAt(idx, dm.matrix); floatInst.setColorAt(idx, edge ? colR : i % 2 ? colB : colW); idx++; }
    floatInst.instanceMatrix.needsUpdate = true; if (floatInst.instanceColor) floatInst.instanceColor.needsUpdate = true; }
  pool.add(floatInst);
  const waterMat = new T.MeshPhysicalMaterial({ color: 0x8fd0e0, transparent: true, opacity: 0.56, roughness: 0.035, clearcoat: 1, envMapIntensity: 1.35, side: T.DoubleSide, depthWrite: false });
  // Snell's window (critical angle 48.6deg when viewed underwater) + Schlick Fresnel reflection above water
  FK.patch(waterMat, 'water-snell', caust, 'uniform float uT;', [
    '{ vec3 viewDirW = normalize(cameraPosition - vWP);',
    '  float rip = sin(vWP.x * 3.4 + uT * 1.9) * cos(vWP.z * 3.1 - uT * 1.5) * 0.05;',
    '  float cosTheta = clamp(abs(viewDirW.y) + rip, 0.0, 1.0);',
    '  if (cameraPosition.y < -0.3) {',
    '    // Underwater: Snell window bright refracted sky circle inside cos(48.6deg)=0.661, total internal reflection outside',
    '    float snell = smoothstep(0.60, 0.72, cosTheta);',
    '    float rim = smoothstep(0.56, 0.66, cosTheta) * (1.0 - smoothstep(0.66, 0.78, cosTheta));',
    '    vec3 tir = vec3(0.14, 0.34, 0.44);',
    '    vec3 skyWin = vec3(0.86, 0.95, 1.0);',
    '    outgoingLight = mix(tir, skyWin, snell) + vec3(0.55, 0.82, 0.96) * rim * 0.45;',
    '  } else {',
    '    float schlick = 0.02 + 0.98 * pow(1.0 - cosTheta, 5.0);',
    '    outgoingLight = mix(outgoingLight, vec3(0.92, 0.97, 1.0), schlick * 0.65);',
    '  } }'].join('\n'), true);
  const water = new T.Mesh(new T.PlaneGeometry(PL, PW, 120, 72).rotateX(-Math.PI / 2), waterMat);
  water.position.y = -0.3; pool.add(water);
  const slab = new T.Mesh(new T.BoxGeometry(PL + 2.4, 0.5, PW + 2), ice({ thickness: 0.5, attenuationDistance: 3 })); slab.position.y = -0.05; slab.receiveShadow = true; pool.add(slab);
  const shaftM = new T.ShaderMaterial({ uniforms: { uT: caust.uT, uA: { value: 0 } }, transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform float uT, uA; varying vec2 vUv; void main(){ float a = smoothstep(0.0, 1.0, vUv.y) * (0.5 + 0.5*sin(vUv.x*40.0 + uT*0.7)) * uA; gl_FragColor = vec4(vec3(0.75, 0.92, 1.0), a * 0.18); }' });
  for (let i = 0; i < 9; i++) { const s = new T.Mesh(new T.CylinderGeometry(0.25, 0.9, DP, 16, 1, true), shaftM); s.position.set(-PL / 2 + 1 + i * 1.5, -0.3 - DP / 2, (rnd() - 0.5) * 4); s.rotation.z = 0.25; s.userData.shaft = i; pool.add(s); }
  const BN = 500, bp2 = new Float32Array(BN * 3); for (let i = 0; i < BN; i++) bp2.set([(rnd() - 0.5) * PL, -rnd() * DP, (rnd() - 0.5) * PW], i * 3);
  const bubG = new T.BufferGeometry(); bubG.setAttribute('position', new T.BufferAttribute(bp2, 3));
  const bubbles = new T.Points(bubG, new T.PointsMaterial({ color: 0xffffff, size: 0.035, transparent: true, opacity: 0.7, depthWrite: false })); pool.add(bubbles);
  const swimmer = new T.Group(); { const dk = new T.MeshStandardMaterial({ color: 0x1b2a36, roughness: 0.6 }); const add = (g, p, r) => { const m = new T.Mesh(g, dk); m.position.set(...p); if (r) m.rotation.set(...r); swimmer.add(m); return m; };
    add(new T.CapsuleGeometry(0.17, 0.55, 6, 12), [0, 0, 0], [0, 0, Math.PI / 2]); add(new T.SphereGeometry(0.12, 16, 12), [0.52, 0.02, 0]);
    swimmer.userData.arms = [add(new T.CapsuleGeometry(0.05, 0.55, 4, 8), [0.5, 0, 0.2], [0, 0, Math.PI / 2]), add(new T.CapsuleGeometry(0.05, 0.55, 4, 8), [0.5, 0, -0.2], [0, 0, Math.PI / 2])];
    swimmer.userData.legs = [add(new T.CapsuleGeometry(0.06, 0.6, 4, 8), [-0.62, 0, 0.09], [0, 0, Math.PI / 2]), add(new T.CapsuleGeometry(0.06, 0.6, 4, 8), [-0.62, 0, -0.09], [0, 0, Math.PI / 2])]; }
  swimmer.position.set(0, -0.6, -PW / 8); pool.add(swimmer);

  // ---------- 06: four award shards ----------
  const AW = [['BEST USE', 'SOLANA', 'SKY SENTRY · HACKPHS 2026'], ['BEST USE', 'TIGERDATA', 'SKY SENTRY · HACKPHS 2026'], ['OVERALL', '5TH PLACE', 'SKY SENTRY · HACKPHS 2026'], ['1ST PRIZE', 'BEST OVERALL', 'ECHO · HACK CLUB HAVEN 2026']];
  const shardG = (() => { const g = new T.CylinderGeometry(0.62, 0.62, 2.6, 6, 1); const tip = new T.ConeGeometry(0.62, 0.9, 6); tip.translate(0, 1.75, 0); const tip2 = tip.clone(); tip2.rotateX(Math.PI); return T.BufferGeometryUtils.mergeBufferGeometries([g.toNonIndexed(), tip.toNonIndexed(), tip2.toNonIndexed()]); })();
  shardG.computeVertexNormals();
  const shardMat = ice({ thickness: 1.3, roughness: 0.05 });
  const shards = AW.map((a, i) => {
    const g = new T.Group(); S.add(g);
    const m = new T.Mesh(shardG, shardMat); m.castShadow = true; m.renderOrder = 2; g.add(m);
    const t = textCanvas(512, 1024, (x, w, h) => { x.textAlign = 'center'; x.fillStyle = '#2F4F6A'; x.font = '600 58px Unbounded, sans-serif'; x.fillText(a[0], w / 2, h * 0.38); x.font = '700 66px Unbounded, sans-serif'; x.fillStyle = '#0F1B26'; x.fillText(a[1], w / 2, h * 0.47); x.font = '500 26px "Geist Mono", monospace'; x.fillStyle = '#5E8AAB'; x.fillText(a[2], w / 2, h * 0.56); });
    const pl = inner(t, 1.05, 2.1); g.add(pl);
    g.userData = { home: O[5].clone().add(V((i - 1.5) * 1.6, (i % 2) * 0.35, (i % 2) * -0.5)), i };
    return g;
  });

  // ---------- 07: three prisms ----------
  const prismGeo = new T.CylinderGeometry(0.95, 0.95, 2.8, 3, 1);
  const prismMat = ice({ thickness: 1.5 });
  const prisms = ['01', '02', '03'].map((n, i) => {
    const g = new T.Group(); g.position.copy(O[6]).add(V((i - 1) * 2.1, (i % 2) * 0.4, -i * 0.3)); S.add(g);
    const m = new T.Mesh(prismGeo, prismMat); m.castShadow = true; m.renderOrder = 2; g.add(m);
    const t = textCanvas(512, 512, (x, w, h) => { x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#2F4F6A'; x.font = '600 190px Unbounded, sans-serif'; x.fillText(n, w / 2, h / 2); });
    g.add(inner(t, 0.95, 0.95)); g.userData.ph = i * 2;
    return g;
  });

  // ---------- particles: the monolith dissolves to sparkling frosted ice crystals, which re-form into the cubes ----------
  const PN = rm ? 0 : (mobile ? 1400 : 3200);
  const sampleGroup = (meshes, n) => { const out = new Float32Array(n * 3), tmp = V(0, 0, 0), samplers = meshes.map((m) => new T.MeshSurfaceSampler(m).build()); for (let i = 0; i < n; i++) { const k = i % meshes.length, m = meshes[k]; samplers[k].sample(tmp); m.updateWorldMatrix(true, false); tmp.applyMatrix4(m.matrixWorld); out.set([tmp.x, tmp.y, tmp.z], i * 3); } return out; };
  S.updateMatrixWorld(true);
  const pA = sampleGroup([monoMesh], PN), pC = sampleGroup(cubes.map((c) => c.children[0]), PN), pB = new Float32Array(PN * 3), pR = new Float32Array(PN);
  for (let i = 0; i < PN; i++) { const a = rnd() * Math.PI * 2, r = 1.2 + rnd() * 2.4, y = (rnd() - 0.5) * 3.6; pB.set([O[1].x + Math.cos(a) * r, O[1].y + y, O[1].z + Math.sin(a) * r], i * 3); pR[i] = rnd(); }
  const pg = new T.BufferGeometry(); pg.setAttribute('position', new T.BufferAttribute(pA, 3)); pg.setAttribute('aB', new T.BufferAttribute(pB, 3)); pg.setAttribute('aC', new T.BufferAttribute(pC, 3)); pg.setAttribute('aR', new T.BufferAttribute(pR, 1));
  const partU = { uK: { value: 0 }, uT: { value: 0 }, uScale: { value: innerHeight }, uCB: { value: O[1].clone() } };
  const parts = new T.Points(pg, new T.ShaderMaterial({ uniforms: partU, transparent: true, depthWrite: false,
    vertexShader: [
      'attribute vec3 aB, aC; attribute float aR; uniform float uK, uT, uScale; uniform vec3 uCB; varying float vA;',
      'vec3 curl(vec3 p){ return vec3(sin(p.y*1.3+uT*0.7)+cos(p.z*0.9), sin(p.z*1.1+uT*0.6)+cos(p.x*1.2), sin(p.x*0.8+uT*0.5)+cos(p.y*1.4)); }',
      'void main(){',
      '  float e1 = smoothstep(0.0, 1.0, clamp(uK - aR*0.25, 0.0, 1.0)), e2 = smoothstep(0.0, 1.0, clamp(uK - 1.0 - aR*0.25, 0.0, 1.0));',
      '  vec3 b = aB - uCB; float a = uT*0.35*(0.5 + aR); b.xz = mat2(cos(a), -sin(a), sin(a), cos(a)) * b.xz; b += uCB;',
      '  vec3 p = mix(position, b, e1); p = mix(p, aC, e2);',
      '  float turb = sin(3.14159*clamp(uK, 0.0, 1.0)) + sin(3.14159*clamp(uK - 1.0, 0.0, 1.0)); p += curl(p*0.6 + aR*6.0) * turb * 0.9;',
      '  vec4 mv = modelViewMatrix * vec4(p, 1.0); float z = max(2.0, -mv.z); gl_PointSize = clamp((1.0 + aR*1.6) * uScale / z * 0.032, 1.5, 9.0);',
      '  vA = smoothstep(0.02, 0.15, uK) * (1.0 - smoothstep(1.85, 2.0, uK)) * smoothstep(1.0, 3.0, z); gl_Position = projectionMatrix * mv; }'].join('\n'),
    fragmentShader: 'varying float vA; void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; if (d > 1.0) discard; vec3 col = mix(vec3(0.72, 0.84, 0.93), vec3(1.0), smoothstep(0.6, 0.0, d)); gl_FragColor = vec4(col, vA * 0.8 * smoothstep(1.0, 0.15, d)); }' }));
  parts.frustumCulled = false; S.add(parts);

  // ---------- scroll position: section index plus fraction, held in the middle of each section ----------
  const secs = Array.from(document.querySelectorAll('main > section')), N = secs.length;
  let tS = 0, tTarget = 0;
  const measure = () => { const mid = innerHeight * 0.5; for (let i = 0; i < N; i++) { const r = secs[i].getBoundingClientRect(); if (r.top <= mid && r.bottom > mid) { const f = (mid - r.top) / r.height; return i + f - 0.5; } } return secs[N - 1].getBoundingClientRect().bottom <= innerHeight * 0.5 ? N - 1 : 0; };
  const held = (t) => { const i = Math.floor(t), f = t - i; return i + ss(0.22, 0.78, f); };
  const pinned = secs.findIndex((s) => s.id === 'awards');
  const secFrac = (i) => { const r = secs[i].getBoundingClientRect(); return Math.min(1, Math.max(0, (innerHeight * 0.5 - r.top) / r.height)); };

  // ---------- loop (uncapped native refresh rate 60Hz-240Hz, pure delta-time, pauses when hidden) ----------
  let last = 0, visible = !document.hidden, t0 = performance.now(), prevTS = 0, velS = 0, rmDrawn = -1, rmFrames = 0;
  document.addEventListener('visibilitychange', () => { visible = !document.hidden; });
  window.addEventListener('resize', () => { rmDrawn = -1; });
  const mouse = new T.Vector2(), mt = new T.Vector2(); window.addEventListener('pointermove', (e) => mt.set(e.clientX / innerWidth * 2 - 1, e.clientY / innerHeight * 2 - 1), { passive: true });
  const tmpP = V(0, 0, 0), tmpL = V(0, 0, 0);
  // Hero focus X alternates opposite the DOM copy column for subtle optical DOF
  const FOCUS_X = [0.72, 0.68, 0.30, 0.72, 0.30, 0.72, 0.30, 0.50];
  function frame(now) {
    requestAnimationFrame(frame);
    if (!visible) { last = now; return; }
    if (!rm && last) {
      if (++gov.n > 20) {
        gov.ema = gov.ema * 0.88 + Math.min(now - last, 80) * 0.12;
        if (gov.n % 15 === 0) {
          const q = gov.ema > 22 ? Math.max(0.75, gov.q * 0.9) : gov.ema < 17.5 ? Math.min(1, gov.q + 0.08) : gov.q;
          if (q !== gov.q) { gov.q = q; resize(); }
        }
      }
    }
    const dt = Math.min(0.05, Math.max(0.0005, (now - (last || now)) / 1000)); last = now;
    const t = rm ? 0 : (now - t0) / 1000;
    const idle = rm ? 0 : 1;
    tTarget = measure();
    prevTS = tS;
    tS = rm ? Math.round(tTarget) : tS + (tTarget - tS) * (1 - Math.exp(-dt * 6.5));
    if (rm) {
      if (tS === rmDrawn && rmFrames > 3) return;
      rmDrawn = tS; rmFrames++;
    }
    // Tight 1.3-section visibility culling: draw only active neighborhood (and all during Outro overview)
    const ov = tS > 6.4;
    mono.visible = tS < 1.3 || ov;
    monoShadow.visible = mono.visible;
    const showCubes = (tS > 1.2 && tS < 3.3) || ov; cubes.forEach((c) => { c.visible = showCubes; });
    gl3.visible = (tS > 2.25 && tS < 4.35) || ov;
    pool.visible = (tS > 3.2 && tS < 5.3) || ov;
    const showShards = (tS > 4.2 && tS < 6.3) || ov; shards.forEach((g) => { g.visible = showShards; });
    const showPrisms = tS > 5.25; prisms.forEach((g) => { g.visible = showPrisms; });
    parts.visible = !rm && tS > 0.15 && tS < 2.25;

    const speed = rm ? 0 : Math.min(1, Math.abs(tS - prevTS) / dt * 0.42);
    velS += (speed - velS) * (1 - Math.exp(-dt * 8));
    const k = Math.max(0, Math.min(N - 1, held(tS)));
    curP.getPoint(k / (N - 1), tmpP); curL.getPoint(k / (N - 1), tmpL);
    // the pool section: Cycles film slot when renders exist, otherwise real-time dive under the ice
    const pf2 = secFrac(4), inPool = Math.abs(tS - 4) < 0.75;
    let poolFilmAlpha = 0;
    if (poolFilm && poolCv) {
      poolFilmAlpha = inPool ? ss(0.02, 0.14, pf2) * (1 - ss(0.86, 0.98, pf2)) : 0;
      poolCv.style.opacity = poolFilmAlpha.toFixed(3);
      if (poolFilmAlpha > 0.005) poolFilm.draw(rm ? 0.52 : pf2);
    }
    let under = 0;
    if (inPool && !rm && poolFilmAlpha < 0.95) { const d = ss(0.28, 0.42, pf2) * (1 - ss(0.66, 0.8, pf2)); tmpP.y = tmpP.y * (1 - d) + (-1.35) * d; tmpP.x += d * -1.6; tmpL.y = tmpL.y * (1 - d) + (-0.6) * d; under = tmpP.y < -0.3 ? 1 : 0; }
    // glacier: track along the strata
    if (Math.abs(tS - 3) < 0.6 && !rm) { const f = secFrac(3); tmpP.x += (f - 0.5) * 3.5; tmpL.x += (f - 0.5) * 4.5; }
    mouse.lerp(mt, 1 - Math.exp(-dt * 3.8));
    C.position.copy(tmpP).add(V(mouse.x * 0.55 * idle + Math.sin(t * 0.3) * 0.05 * idle, -mouse.y * 0.32 * idle + Math.sin(t * 0.45) * 0.04 * idle, 0));
    C.lookAt(tmpL);
    // sun and shadows follow the camera's subject
    sun.position.copy(tmpL).add(V(-16, 7, 10)); sun.target.position.copy(tmpL); sky.position.copy(C.position);
    // objects alive
    mono.rotation.y = t * 0.12 * idle; mono.position.y = O[0].y + Math.sin(t * 0.6) * 0.12 * idle;
    const kd = Math.max(0, tS);
    monoMesh.material.userData.u.uD.value = rm ? (kd > 0.5 ? 1 : 0) : ss(0.25, 0.75, kd);
    monoInnerMat.userData.u.uD.value = rm ? (kd > 0.5 ? 1 : 0) : ss(0.2, 0.7, kd);
    partU.uK.value = rm ? 0 : Math.max(0, Math.min(2, kd < 1 ? ss(0.3, 0.95, kd) : 1 + ss(1.25, 1.95, kd)));
    partU.uT.value = t; partU.uScale.value = innerHeight; snowU.uScale.value = innerHeight;
    cubeMat.userData.u.uD.value = rm ? 0 : 1 - ss(1.55, 2.0, kd);
    cubes.forEach((c, i) => { c.rotation.y = Math.sin(t * 0.3 + c.userData.ph) * 0.35 * idle; c.rotation.x = Math.sin(t * 0.25 + c.userData.ph) * 0.12 * idle; c.position.y = O[2].y + (Math.floor(i / 2) * -2.2 + 1.2) + Math.sin(t * 0.7 + c.userData.ph) * 0.08 * idle; });
    if (!counted && tTarget > 1.6) { counted = true; cubes.forEach((c) => { const o = { v: 0 }; gsap.to(o, { v: c.userData.val, duration: rm ? 0.01 : 2.2, ease: 'expo.out', onUpdate: () => c.userData.tex.userData.redraw(Math.round(o.v)) }); }); }
    gl3.rotation.y = -0.25 + Math.sin(t * 0.2) * 0.04 * idle; honLight.intensity = 5 + Math.sin(t * 1.4) * 1.5 * idle;
    // pool life (paused in reduced motion or when Cycles film covers viewport)
    caust.uT.value = t; const melt = (inPool && !rm && poolFilmAlpha < 0.95) ? ss(0.12, 0.3, pf2) * (1 - ss(0.78, 0.94, pf2)) : 0;
    slab.material.userData.u.uD.value = melt; shaftM.uniforms.uA.value = melt;
    if (inPool && !rm && poolFilmAlpha < 0.98) {
      const wp = water.geometry.attributes.position;
      for (let i = 0; i < wp.count; i++) { const x = wp.getX(i), z = wp.getZ(i); wp.setY(i, Math.sin(x * 2.2 + t * 1.6) * 0.03 + Math.sin(z * 3.1 - t * 1.2) * 0.02); }
      wp.needsUpdate = true;
      floatInst.position.y = Math.sin(t * 1.6) * 0.012;
      pool.children.forEach((o) => { if (o.userData.shaft != null) o.rotation.z = 0.25 + Math.sin(t * 0.3 + o.userData.shaft) * 0.06; });
      const bpos = bubG.attributes.position; for (let i = 0; i < BN; i++) { let y = bpos.getY(i) + dt * (0.25 + (i % 7) * 0.05); if (y > -0.32) y = -DP; bpos.setY(i, y); } bpos.needsUpdate = true;
      swimmer.position.x = ((t * 1.1) % (PL + 4)) - PL / 2 - 2; const st = t * 4.2; swimmer.userData.arms.forEach((a, j) => { a.rotation.y = Math.sin(st + j * Math.PI) * 1.2; }); swimmer.userData.legs.forEach((l, j) => { l.rotation.y = Math.sin(st * 2 + j * Math.PI) * 0.25; });
    }
    const MOOD = [[0.006, 1.0, 2.6], [0.016, 3.0, 1.6], [0.008, 1.0, 2.4], [0.007, 1.2, 2.8], [0.009, 1.0, 2.2], [0.006, 0.8, 2.6], [0.007, 1.2, 2.4], [0.0045, 0.6, 2.8]];
    const mi = Math.max(0, Math.min(N - 2, Math.floor(tS))), mf = Math.max(0, Math.min(1, tS - mi)), mA = MOOD[mi] || MOOD[0], mB = MOOD[mi + 1] || mA;
    const fogD = mA[0] + (mB[0] - mA[0]) * mf, windM = mA[1] + (mB[1] - mA[1]) * mf; sun.intensity = mA[2] + (mB[2] - mA[2]) * mf;
    S.fog.color.copy(FOG_SNOW).lerp(FOG_WATER, under); S.fog.density = under ? 0.16 : fogD; bankU.uT.value = t; snowU.uWind.value = windM + Math.abs(tTarget - tS) * 4;
    grade.uniforms.uWater.value += ((under ? 1 : 0) - grade.uniforms.uWater.value) * (1 - Math.exp(-dt * 6));
    // awards: shards rotate in while the section is pinned
    const af = secFrac(pinned);
    shards.forEach((g, i) => { const k2 = rm ? 1 : ss(0.12 + i * 0.1, 0.42 + i * 0.1, af); g.position.copy(g.userData.home).add(V((1 - k2) * (i - 1.5) * 5, (1 - k2) * 6, -(1 - k2) * 4)); g.rotation.set((1 - k2) * 2.5, (1 - k2) * 6 + t * 0.25 * idle + i, (1 - k2) * 1.2); g.position.y += Math.sin(t * 0.8 + i) * 0.06 * idle; });
    prisms.forEach((g) => { g.rotation.y = t * 0.2 * idle + g.userData.ph; g.position.y = O[6].y + Math.sin(t * 0.6 + g.userData.ph) * 0.1 * idle; });
    // white noise flash at each section boundary + velocity motion blur & optical DOF (off in reduced motion)
    let fl = 0; if (!rm) for (let i = 0; i < N - 1; i++) fl = Math.max(fl, 1 - Math.abs(tS - (i + 0.5)) / 0.07);
    grade.uniforms.uFlash.value = Math.max(0, fl) * 0.6;
    grade.uniforms.uVel.value = velS;
    grade.uniforms.uDof.value = rm ? 0 : (under ? 0 : 0.42 * (1 - velS * 0.5));
    const fxA = FOCUS_X[mi] != null ? FOCUS_X[mi] : 0.5, fxB = FOCUS_X[mi + 1] != null ? FOCUS_X[mi + 1] : 0.5;
    grade.uniforms.uFocus.value.set(isMobile() ? 0.5 : fxA + (fxB - fxA) * mf, 0.5);
    grade.uniforms.uT.value = t;
    if (SN) { snowU.uT.value = t; snowU.uCam.value.copy(C.position); }
    if (poolFilmAlpha < 0.99) comp.render(dt);
  }

  // fonts first, so canvas text uses Unbounded and Geist Mono
  const fontsReady = (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(() => { cubes.forEach((c) => c.userData.tex.userData.redraw()); rmDrawn = -1; });
  loadAll.push(fontsReady);
  window.__world = { S, C, R, comp, grade, gov, poolFilm: () => poolFilm };
  S0.boot(Promise.all(loadAll), () => { rmDrawn = -1; });
  requestAnimationFrame(frame);
})();
