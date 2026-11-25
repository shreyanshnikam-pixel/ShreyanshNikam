/* Echo page: from the icy surface down a crevasse and an ice cave into the Hollow, a mine you can only see by sound.
   One fixed canvas behind the page: the film while the #hollow track scrolls, then the mine drifting on behind the
   sections after it. Classic script; needs THREE (r147 bundle), FK (kit.js), SITE (core.js), gsap.
   Test hooks: window.echo.setProgress(p), .ping(), .triggerScare(), .scareFrame(f), .setAfter(p). */
(function () {
  const T = THREE, S0 = window.SITE, V = (x, y, z) => new T.Vector3(x, y, z);
  const ss = FK.ss, cl = FK.clamp, lerp = FK.lerp, lin = FK.lin;
  const mobile = innerWidth < 760;

  // ---------- DOM-only parts (run with reduced motion too) ----------
  const grid = document.querySelector('[data-commits]');
  if (grid) for (let i = 0; i < 89; i++) { const c = document.createElement('i'); if (i < 18) c.className = 'me'; grid.appendChild(c); }
  const states = document.querySelectorAll('[data-loop] li'), ringNodes = document.querySelectorAll('[data-loopring] li'), arc = document.querySelector('[data-arc]');
  if (states.length) {
    let k = 0;
    const step = () => {
      states.forEach((li, i) => li.classList.toggle('on', i === k));
      ringNodes.forEach((li, i) => li.classList.toggle('on', i === k));
      if (arc) arc.setAttribute('stroke-dasharray', `${(k + 1) / 5 * 238.8} 239`);
      k = (k + 1) % 5;
    };
    step(); if (!S0.rm) setInterval(step, 1800);
  }
  const soundBtns = document.querySelectorAll('[data-sound-on]');
  soundBtns.forEach((b) => b.addEventListener('click', () => S0.setSound(!S0.soundOn)));
  document.addEventListener('site:sound', (e) => soundBtns.forEach((b) => { b.setAttribute('aria-pressed', e.detail ? 'true' : 'false'); b.textContent = e.detail ? 'Sound on · tap to mute' : 'Turn sound on · best with headphones'; }));

  const film = document.getElementById('hollow'), cv = document.getElementById('echo-canvas'), after = document.querySelector('.after');
  if (!S0.glOk || S0.rm || !film || !cv) { S0.boot(document.fonts ? document.fonts.ready : null); return; }

  const ovl = film.querySelector('.ovl2'), descentCv = document.getElementById('echo-frames'), caps = Array.from(film.querySelectorAll('.cap[data-a]')), capCaught = film.querySelector('[data-caught]');
  const chs = Array.from(film.querySelectorAll('[data-ch]')), bar = film.querySelector('[data-bar]'), pingBtn = film.querySelector('[data-ping]');
  const hint = film.querySelector('[data-hint]'), loadingEl = film.querySelector('[data-loading]');
  let descentPl = null;
  if (window.FilmPlayer && descentCv) {
    window.FilmPlayer.load(descentCv, 'assets/films/echo_descent/manifest.json').then((pl) => { if (pl) descentPl = pl; }).catch(() => {});
  }

  // ---------- renderer, scene, post ----------
  const R = new T.WebGLRenderer({ canvas: cv, antialias: false, powerPreference: 'high-performance' });
  R.outputEncoding = T.LinearEncoding; R.toneMapping = T.NoToneMapping; R.setClearColor(0x000000, 1);
  const S = new T.Scene(), C = new T.PerspectiveCamera(58, innerWidth / innerHeight, 0.05, 420);
  const SKY = new T.Color('#DCE6EE'), BLACK = new T.Color(0), DEEPICE = new T.Color('#1B3346');
  S.background = SKY.clone(); S.fog = new T.FogExp2(SKY.clone(), 0.012);
  const P = FK.composer(R, S, C, [0.55, 0.6, 0.9]), G = P.grade.uniforms;
  G.uGrain.value = 0.06; G.uCA.value = 0.0018;
  const size = () => [Math.max(2, innerWidth), Math.max(2, innerHeight)];
  const gov = FK.governor(R, P.c, size); gov.max = Math.min(devicePixelRatio || 1, mobile ? 1.5 : 2);
  const bufSize = new T.Vector2();
  const mirRT = new T.WebGLRenderTarget(16, 16, { type: T.HalfFloatType });
  const onResize = () => { const s = size(); C.aspect = s[0] / s[1]; C.fov = C.aspect < 0.8 ? 72 : 58; C.updateProjectionMatrix(); gov.apply(); G.uRes.value.set(s[0], s[1]); if (P.bloom) P.bloom.resolution.set(s[0] / 2, s[1] / 2); R.getDrawingBufferSize(bufSize); mirRT.setSize(Math.max(2, bufSize.x >> 2), Math.max(2, bufSize.y >> 2)); };
  const _apply = gov.apply; gov.apply = () => { _apply(); R.getDrawingBufferSize(bufSize); mirRT.setSize(Math.max(2, bufSize.x >> 2), Math.max(2, bufSize.y >> 2)); };
  window.addEventListener('resize', onResize); onResize();

  // ---------- the path: a floor line from the crevasse, down the ice chute, through the mine ----------
  const FP = [[0.2, -20, 10], [0.3, -20, 4], [-0.3, -20, -4], [0.3, -20, -12], [0.9, -20.4, -20], [0.5, -21.6, -27], [-0.6, -24, -34], [-1.4, -27.4, -41], [-1, -30.6, -48], [0.3, -33, -55], [1.1, -34.4, -61], [1.4, -34.8, -66],
    [1.9, -35, -72], [1.0, -35.3, -79], [-0.8, -35.6, -86], [-2, -35.9, -93], [-1.6, -36.1, -99], [-0.2, -36.2, -104], [1.0, -36.2, -110], [1.6, -36.2, -116], [1.2, -36.2, -121], [0.2, -36.3, -127], [-1.0, -36.4, -133],
    [-1.6, -36.6, -140], [-1.0, -36.8, -147], [0.4, -37, -154], [1.4, -37.2, -161], [1.6, -37.3, -168], [1.2, -37.4, -176]];
  const curve = new T.CatmullRomCurve3(FP.map((a) => V(a[0], a[1], a[2])), false, 'centripetal'); curve.arcLengthDivisions = 1600;
  const LT = curve.getLength(), up0 = V(0, 1, 0);
  const zTab = []; for (let i = 0; i <= 1200; i++) zTab.push(curve.getPointAt(i / 1200).z);
  const sZ = (z) => { for (let i = 1; i <= 1200; i++) if (zTab[i] <= z) { const t = (z - zTab[i - 1]) / (zTab[i] - zTab[i - 1]); return (i - 1 + t) / 1200 * LT; } return LT; };
  const frame = (s, o) => { o = o || {}; const t = cl(s / LT, 0, 1); o.P = curve.getPointAt(t, o.P || V()); o.Tn = curve.getTangentAt(t, o.Tn || V()); o.side = (o.side || V()).crossVectors(o.Tn, up0).normalize(); o.up = (o.up || V()).crossVectors(o.side, o.Tn).normalize(); return o; };
  const at = (s, x, y) => { const f = frame(s); return f.P.clone().addScaledVector(f.side, x).addScaledVector(f.up, y); };
  const basis = (s) => { const f = frame(s); return new T.Matrix4().makeBasis(f.side, f.up, f.Tn.clone().negate()); };
  // cross-section by depth along the path
  const prof = (s, z) => {
    const cre = ss(-30, -18, z), mine = ss(-58, -66, z), lair = ss(-133, -140, z) * (1 - ss(-160, -168, z));
    let W = lerp(lerp(2.3, 2.85, mine), 3.5, lair); W *= lerp(0.06, 1, ss(10, 5.2, z));
    const H = lerp(lerp(2.75, 11, cre), 3.4, lair);
    const wf = Math.min(lerp(lerp(1.1, 0.7, cre), 2.05, mine) + lair * 0.6, W * 0.82);
    return { W, H, wf, FL: H * Math.sqrt(Math.max(0, 1 - (wf / W) * (wf / W))), amp: lerp(0.8, 1.35, mine), ice: 1 - mine };
  };
  const S_ROCK0 = sZ(-55), S_ROCK1 = sZ(-63.5), S_LAND = sZ(-63.2), S_LAMP = sZ(-66.2);
  const S_FLOOD0 = sZ(-103), S_FLOOD1 = sZ(-122), S_HOLD = sZ(-128);

  // ---------- sonar: every mine material is lit only by the expanding ping wavefronts ----------
  const PU = { uPP: { value: [new T.Vector4(0, 0, 0, 0), new T.Vector4(0, 0, 0, 0)] }, uPV: { value: [V(), V()] }, uPA: { value: [0, 0] },
    uTr: { value: new T.Vector2(S_ROCK0, S_ROCK1) }, uDeep: { value: 0.3 }, uGlow: { value: 0.0 }, uRim: { value: 0 } };
  const NOISE = 'float eh(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719))) * 43758.5453); }\nfloat en(vec3 p){ vec3 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(mix(eh(i),eh(i+vec3(1,0,0)),f.x),mix(eh(i+vec3(0,1,0)),eh(i+vec3(1,1,0)),f.x),f.y),mix(mix(eh(i+vec3(0,0,1)),eh(i+vec3(1,0,1)),f.x),mix(eh(i+vec3(0,1,1)),eh(i+vec3(1,1,1)),f.x),f.y),f.z); }';
  const PING = [
    '{ vec3 pc = vec3(0.66, 0.84, 1.0); float aoK = 1.0;',
    '#ifdef USE_AOMAP', ' aoK = ambientOcclusion;', '#endif',
    '  vec3 Vv = normalize(vViewPosition);',
    '  float ndv = clamp(dot(normal, Vv), 0.0, 1.0);',
    '  float fres = 0.04 + 0.96 * pow(1.0 - ndv, 5.0);',
    '  for (int i = 0; i < 2; i++) {',
    '    float A = uPA[i]; if (A < 0.002) continue;',
    '    float dw = distance(vWP, uPP[i].xyz), R = uPP[i].w;',
    '    float ring = exp(-pow((dw - R) / 1.05, 2.0));',
    '    float trail = smoothstep(R + 0.45, R - 1.9, dw) * (0.20 + 0.65 * exp(-max(R - dw, 0.0) * 0.14));',
    '    vec3 L = uPV[i] + vViewPosition; L /= max(length(L), 1e-3);',
    '    float ndl = dot(normal, L);',
    '    float horizonShadow = smoothstep(-0.12, 0.25, ndl);',
    '    float lam = max(ndl, 0.0) * horizonShadow * 0.88 + 0.12 * aoK;',
    '    float fall = 1.0 / (1.0 + 0.065 * dw + 0.0042 * dw * dw);',
    '    vec3 H = normalize(L + Vv);',
    '    float ndh = max(dot(normal, H), 0.0);',
    '    float rough = clamp(roughnessFactor, 0.06, 0.98);',
    '    float specPow = mix(128.0, 14.0, rough * rough);',
    '    float sp = pow(ndh, specPow) * (1.0 - rough * 0.85) * (1.4 + fres * 4.5) * horizonShadow;',
    '    float e = (ring * 5.2 + trail) * A * fall;',
    '    outgoingLight += (diffuseColor.rgb * lam * aoK + sp * 0.85) * pc * e;',
    '    outgoingLight += pc * ring * A * fall * (0.025 + 0.055 * fres);',
    '  }',
    '}'].join('\n');
  const RIM = '{ float fr = 1.0 - abs(dot(normal, normalize(vViewPosition))); outgoingLight += vec3(1.0, 0.03, 0.03) * fr * fr * uRim; }';
  // ice: light scattered down from the surface (bright near the top, deep blue below), annual layers, bubbles and veins
  const ICEFX = ['{ float dep = smoothstep(-27.0, 0.8, vWP.y);',
    '  vec3 sss = mix(vec3(0.01, 0.035, 0.07), vec3(0.16, 0.36, 0.52), smoothstep(0.0, 0.55, dep)); sss = mix(sss, vec3(0.78, 0.9, 0.98), smoothstep(0.55, 1.0, dep));',
    '  float nb = en(vWP * vec3(0.5, 0.9, 0.5));',
    '  float bands = 0.72 + 0.28 * sin(vWP.y * 2.6 + nb * 7.0);',
    '  float veins = smoothstep(0.6, 0.72, en(vWP * vec3(0.7, 2.6, 0.7))) * 0.7 + smoothstep(0.66, 0.7, en(vWP * 4.1 + 3.0)) * 0.4;',
    '  float cloudy = en(vWP * 1.7 + 11.0);',
    '  float fr = pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 2.0);',
    '  outgoingLight *= mix(uDeep, 1.0, dep);',
    '  outgoingLight += sss * uGlow * (bands * (0.75 + 0.5 * cloudy) + veins + fr * 0.6); }'].join('\n');
  const diss = (rock) => 'float dk = clamp((vS - uTr.x) / (uTr.y - uTr.x), 0.0, 1.0) * 1.3 - 0.15; float dn = en(vWP * 0.8) * 0.65 + en(vWP * 2.9) * 0.35; if (' + (rock ? 'dn >= dk' : 'dn < dk') + ') discard;';
  const sonar = (mat, key, o) => {
    o = o || {}; mat.envMapIntensity = o.env != null ? o.env : 0;
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, PU, o.uniforms || {});
      sh.vertexShader = 'varying vec3 vWP;\n' + (o.diss != null ? 'attribute float aS; varying float vS;\n' : '') + sh.vertexShader.replace('#include <project_vertex>',
        '#include <project_vertex>\n vec4 eW = vec4(transformed, 1.0);\n#ifdef USE_INSTANCING\n eW = instanceMatrix * eW;\n#endif\n vWP = (modelMatrix * eW).xyz;' + (o.diss != null ? ' vS = aS;' : ''));
      sh.fragmentShader = 'varying vec3 vWP;\nuniform vec4 uPP[2]; uniform vec3 uPV[2]; uniform float uPA[2]; uniform vec2 uTr; uniform float uDeep, uGlow, uRim;\n' + NOISE + '\n' + (o.diss != null ? 'varying float vS;\n' : '') + (o.decl || '') + '\n' +
        sh.fragmentShader.replace('void main() {', 'void main() {\n' + (o.diss != null ? diss(o.diss) : ''))
          .replace('#include <output_fragment>', (o.ice ? ICEFX : PING) + (o.rim ? RIM : '') + (o.frag || '') + '\n#include <output_fragment>');
    };
    mat.customProgramCacheKey = () => 'echo-' + key;
    mat.needsUpdate = true; return mat;
  };

  // ---------- loading (core JSON with real progress) ----------
  const fetchJSON = (url, w0, w1) => fetch(url).then(async (r) => {
    if (!r.ok) throw new Error(url + ' ' + r.status);
    const total = +r.headers.get('content-length') || 0; if (!r.body || !total) return r.json();
    const rd = r.body.getReader(), parts = []; let got = 0;
    for (;;) { const { done, value } = await rd.read(); if (done) break; parts.push(value); got += value.length; if (S0.setLoad) S0.setLoad(w0 + (w1 - w0) * got / total); }
    const all = new Uint8Array(got); let o = 0; parts.forEach((c) => { all.set(c, o); o += c.length; });
    return JSON.parse(new TextDecoder().decode(all));
  });
  const TL = new T.TextureLoader();
  const ltex = (f, srgb, rx, ry) => { const t = TL.load(f); t.wrapS = t.wrapT = T.RepeatWrapping; if (srgb) t.encoding = T.sRGBEncoding; t.anisotropy = 8; t.repeat.set(rx || 1, ry || rx || 1); return t; };
  const gltf = (url) => new Promise((res) => new T.GLTFLoader().load(url, res, undefined, () => res(null)));
  let D = null; const world = {};

  // ---------- builders ----------
  function tubeGeo(s0, s1, seg, rad, opt) {
    const pos = [], uv = [], sA = [], isF = [], ys = [], f = {}, rnd = opt.lowres ? null : 1;
    const cuts = [];
    for (let i = 0; i <= seg; i++) {
      const s = s0 + (s1 - s0) * i / seg; frame(s, f); const pr = prof(s, f.P.z), per = Math.PI * (pr.W + pr.H) * 0.55;
      let ring = [];
      for (let j = 0; j <= rad; j++) {
        const th = j / rad * Math.PI * 2, cx = Math.cos(th), cy = Math.sin(th);
        const n1 = FK.fbm(cx * 1.3 + 9, cy * pr.H * 0.16 + 3, s * 0.21, rnd ? 4 : 2), n2 = rnd ? FK.fbm(cx * 4 + 1, cy * pr.H * 0.5 + 7, s * 0.9, 2) : 0.5;
        const d = (n1 - 0.5) * pr.amp * 1.4 + (n2 - 0.5) * pr.amp * 0.3;
        let x = cx * (pr.W + d), y = cy * (pr.H + d * 0.8), fl = 0;
        if (y < -pr.FL) { y = -pr.FL + (FK.noise(x * 2.1, s * 1.7, 3) - 0.5) * 0.08 + Math.max(0, Math.abs(x) - pr.wf) * 0.3; fl = 1; }
        const v = f.P.clone().addScaledVector(f.side, x).addScaledVector(f.up, y + pr.FL);
        pos.push(v.x, v.y, v.z); uv.push(j / rad * per / 3, s / 3.2); sA.push(s); isF.push(fl); ys.push(v.y); ring.push(v);
      }
      if (opt.cutTop) { // where the slot meets the snow: points on each side at y = 0
        const cr = (a, b) => { for (let j = a; j !== b; j += Math.sign(b - a)) { const p0 = ring[j], p1 = ring[j + Math.sign(b - a)]; if ((p0.y - 0) * (p1.y - 0) <= 0 && p0.y !== p1.y) { const t = -p0.y / (p1.y - p0.y); return p0.clone().lerp(p1, t); } } return null; };
        const rr = cr(0, rad >> 2), ll = cr(rad >> 1, rad >> 2); if (rr && ll) cuts.push([rr, ll, f.P.clone()]);
      }
    }
    const g = new T.BufferGeometry(), wall = [], flo = [];
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setAttribute('uv2', new T.Float32BufferAttribute(uv, 2));
    g.setAttribute('aS', new T.Float32BufferAttribute(sA, 1));
    for (let i = 0; i < seg; i++) for (let j = 0; j < rad; j++) {
      const a = i * (rad + 1) + j, b = a + rad + 1, c = a + 1, e = b + 1;
      if (opt.cutTop && Math.max(ys[a], ys[b], ys[c], ys[e]) > 0.3) continue;
      (isF[a] + isF[b] + isF[c] + isF[e] >= 3 && !opt.lowres ? flo : wall).push(a, c, b, c, e, b);
    }
    g.setIndex(wall.concat(flo)); g.addGroup(0, wall.length, 0); g.addGroup(wall.length, flo.length, 1); g.computeVertexNormals();
    g.userData.cuts = cuts; return g;
  }

  function build() {
    const tex = (k, srgb, rx, ry) => FK.tex(D.tex[k], srgb, [rx || 1, ry || rx || 1]);
    const rnd = FK.rng(11);
    // ---- surface: snowfield, mountains, sun ----
    const sun = world.sun = new T.DirectionalLight(0xfff6ee, 2.3); sun.position.set(-30, 60, 20); S.add(sun);
    const hemi = world.hemi = new T.HemisphereLight(0xf2f7fc, 0xb8c9d8, 0.9); S.add(hemi);
    const snowMat = new T.MeshStandardMaterial({ map: ltex('assets/textures/snow_diff.jpg', true, 1), normalMap: ltex('assets/textures/snow_nor_gl.jpg', false, 1), roughnessMap: ltex('assets/textures/snow_rough.jpg', false, 1), normalScale: new T.Vector2(0.8, 0.8), envMapIntensity: 1 });
    world.snowMat = snowMat;
    // ---- ice: crevasse, cave and chute in one swept tube ----
    const iceGeo = tubeGeo(0, S_ROCK1, mobile ? 150 : 240, mobile ? 48 : 72, { cutTop: true });
    const iceNor = tex('rock_face_04_nor', false, 1);
    const iceM = world.iceM = sonar(new T.MeshPhysicalMaterial({ color: 0x7fa6c2, roughness: 0.22, metalness: 0, normalMap: iceNor, normalScale: new T.Vector2(0.9, 0.9), clearcoat: 1, clearcoatRoughness: 0.06, ior: 1.31, side: T.DoubleSide, specularIntensity: 1 }), 'ice', { diss: 0, ice: true, env: 1.25 });
    const iceFloorM = world.iceFloorM = sonar(new T.MeshStandardMaterial({ map: ltex('assets/textures/snow_diff.jpg', true, 1), normalMap: ltex('assets/textures/snow_nor_gl.jpg', false, 1), color: 0xd4e3ee, roughness: 0.85, side: T.DoubleSide }), 'icefloor', { diss: 0, ice: true, env: 1 });
    const iceTube = world.iceTube = new T.Mesh(iceGeo, [iceM, iceFloorM]); S.add(iceTube);
    // snowfield with the crevasse cut out (a little overhang, like a cornice)
    const cuts = iceGeo.userData.cuts, shape = new T.Shape([new T.Vector2(-260, -200), new T.Vector2(260, -200), new T.Vector2(260, 220), new T.Vector2(-260, 220)]);
    if (cuts.length > 2) {
      const pts = [], ov = 0.22;
      cuts.forEach((c) => { const m = c[0].clone().lerp(c[1], 0.5), d = c[0].clone().sub(m); const L = d.length(); d.multiplyScalar(Math.max(0.05, L - ov) / Math.max(L, 1e-3)); pts.push(new T.Vector2(m.x + d.x, -(m.z + d.z))); });
      for (let i = cuts.length - 1; i >= 0; i--) { const c = cuts[i], m = c[0].clone().lerp(c[1], 0.5), d = c[1].clone().sub(m); const L = d.length(); d.multiplyScalar(Math.max(0.05, L - ov) / Math.max(L, 1e-3)); pts.push(new T.Vector2(m.x + d.x, -(m.z + d.z))); }
      shape.holes.push(new T.Path(pts));
    }
    const gg = new T.ShapeGeometry(shape, 2); gg.rotateX(-Math.PI / 2);
    { const p = gg.attributes.position, u = gg.attributes.uv; for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), d = Math.hypot(x, z * 0.6); p.setY(i, d > 30 ? (FK.fbm(x * 0.02, z * 0.02, 1, 3) - 0.4) * Math.min(1, (d - 30) / 60) * 14 : 0); u.setXY(i, x / 5, z / 5); } gg.computeVertexNormals(); }
    const ground = new T.Mesh(gg, snowMat); S.add(ground); world.ground = ground;
    const mtnM = new T.MeshStandardMaterial({ color: 0xeef3f7, roughness: 0.95, flatShading: true, envMapIntensity: 0.8 });
    for (let i = 0; i < 12; i++) {
      const g = new T.IcosahedronGeometry(1, 4), p = g.attributes.position;
      for (let k = 0; k < p.count; k++) { const v = V(p.getX(k), p.getY(k), p.getZ(k)); v.multiplyScalar(0.7 + FK.fbm(v.x * 1.8 + i, v.y * 1.8, v.z * 1.8, 5) * 0.75); p.setXYZ(k, v.x, Math.max(-0.2, v.y), v.z); }
      g.computeVertexNormals(); const m = new T.Mesh(g, mtnM), sc = 30 + rnd() * 40, a = -Math.PI * 0.9 + rnd() * Math.PI * 0.8;
      m.scale.set(sc * (1 + rnd()), sc * (0.5 + rnd() * 0.6), sc); m.position.set(Math.cos(a) * (150 + rnd() * 70), -3, Math.sin(a) * (150 + rnd() * 70) - 20); S.add(m);
    }

    // ---- the mine ----
    const rockGeo = tubeGeo(S_ROCK0, LT, mobile ? 200 : 340, mobile ? 32 : 44, {});
    const rockM = sonar(new T.MeshStandardMaterial({ map: tex('dark_rock_02_diff', true), normalMap: tex('dark_rock_02_nor'), aoMap: tex('dark_rock_02_ao'), normalScale: new T.Vector2(1.6, 1.6), roughness: 0.9, color: 0x9a948e, side: T.DoubleSide }), 'rock', { diss: 1 });
    const mudM = sonar(new T.MeshStandardMaterial({ map: tex('brown_mud_03_diff', true), normalMap: tex('brown_mud_03_nor'), roughness: 0.62, color: 0x7a6e64, side: T.DoubleSide }), 'mud', { diss: 1 });
    const rock = world.rock = new T.Mesh(rockGeo, [rockM, mudM]); S.add(rock);
    // low-res copy for the echo raycasts
    const colGeo = T.BufferGeometryUtils.mergeBufferGeometries([tubeGeo(S_ROCK0, LT, 120, 16, { lowres: true }), tubeGeo(0, S_ROCK1, 60, 16, { lowres: true })].map((g) => { g.clearGroups(); g.deleteAttribute('aS'); g.deleteAttribute('uv2'); return g; }));
    world.col = new T.Mesh(colGeo, new T.MeshBasicMaterial({ side: T.DoubleSide })); world.col.updateMatrixWorld(true);

    // rotting timber sets
    const plank = sonar(new T.MeshStandardMaterial({ map: tex('weathered_planks_diff', true, 0.5, 2), normalMap: tex('weathered_planks_nor', false, 0.5, 2), roughness: 0.88, color: 0x7a6656 }), 'plank');
    const postG = new T.BoxGeometry(0.24, 1, 0.24), beamG = new T.BoxGeometry(1, 0.26, 0.28);
    world.beams = [];
    for (let s = S_LAND + 3; s < LT - 4; s += 6.2 + rnd() * 1.2) {
      const f = frame(s), B = basis(s), pr = prof(s, f.P.z), hw = pr.wf * 0.9, h = 2.75, broken = rnd() < 0.22;
      for (const sg of [-1, 1]) { const m = new T.Mesh(postG, plank); m.position.copy(at(s, sg * hw, h / 2)); m.quaternion.setFromRotationMatrix(B); m.rotateZ((rnd() - 0.5) * 0.09); m.rotateY(rnd() * 0.3); m.scale.set(1, h, 1); S.add(m); }
      const bm = new T.Mesh(beamG, plank); bm.position.copy(at(s, 0, h + 0.1)); bm.quaternion.setFromRotationMatrix(B); bm.scale.set(hw * 2 + 0.45, 1, 1);
      if (broken) { bm.rotateZ(0.32 * (rnd() < 0.5 ? -1 : 1)); bm.position.addScaledVector(f.up, -0.45); } S.add(bm);
      if (!broken) world.beams.push(s);
    }
    // rails and sleepers
    const sl0 = S_LAND + 2, slN = Math.floor((LT - sl0 - 2) / 0.85);
    const sleepers = new T.InstancedMesh(new T.BoxGeometry(1.45, 0.12, 0.2), plank, slN), m4 = new T.Matrix4(), q = new T.Quaternion();
    for (let k = 0; k < slN; k++) { const s = sl0 + k * 0.85; q.setFromRotationMatrix(basis(s)).multiply(new T.Quaternion().setFromAxisAngle(up0, (rnd() - 0.5) * 0.14)); m4.compose(at(s, (rnd() - 0.5) * 0.06, 0.05), q, V(1, 1, 1)); sleepers.setMatrixAt(k, m4); }
    S.add(sleepers);
    const rust = { map: ltex('assets/textures/echo/rust_coarse_01_diff_512.jpg', true, 8, 0.3), normalMap: ltex('assets/textures/echo/rust_coarse_01_nor_gl_512.jpg', false, 8, 0.3) };
    const railM = sonar(new T.MeshStandardMaterial(Object.assign({ color: 0x9a8070, metalness: 0.55, roughness: 0.55 }, rust)), 'rail');
    const railShape = new T.Shape([new T.Vector2(-0.035, 0), new T.Vector2(0.035, 0), new T.Vector2(0.035, 0.012), new T.Vector2(0.008, 0.02), new T.Vector2(0.008, 0.07), new T.Vector2(0.022, 0.078), new T.Vector2(0.022, 0.1), new T.Vector2(-0.022, 0.1), new T.Vector2(-0.022, 0.078), new T.Vector2(-0.008, 0.07), new T.Vector2(-0.008, 0.02), new T.Vector2(-0.035, 0.012)]);
    for (const sg of [-0.5, 0.5]) {
      const rp = []; for (let k = 0; k <= 220; k++) rp.push(at(sl0 + k / 220 * (LT - sl0 - 2), sg, 0.11));
      const path = new T.CatmullRomCurve3(rp);
      // an extruded rail profile, kept upright with frames built from the path
      const N = 700, prof2 = railShape.getPoints(1), pos = [], idx = [];
      for (let i = 0; i <= N; i++) { const t = i / N, P0 = path.getPointAt(t), Tn = path.getTangentAt(t), sd = V().crossVectors(Tn, up0).normalize(), uu = V().crossVectors(sd, Tn).normalize(); prof2.forEach((p) => { const v = P0.clone().addScaledVector(sd, p.x).addScaledVector(uu, p.y - 0.05); pos.push(v.x, v.y, v.z); }); }
      const n = prof2.length; for (let i = 0; i < N; i++) for (let j = 0; j < n; j++) { const a = i * n + j, b = i * n + (j + 1) % n, c = a + n, d = b + n; idx.push(a, c, b, b, c, d); }
      const rg = new T.BufferGeometry(); rg.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); const uvs = []; for (let i = 0; i <= N; i++) for (let j = 0; j < n; j++) uvs.push(j / n, i / N * 40); rg.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2)); rg.setIndex(idx); rg.computeVertexNormals();
      S.add(new T.Mesh(rg, railM));
    }
    // chalk marks
    const chalk = (draw) => { const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); x.strokeStyle = 'rgba(238,236,228,.9)'; x.lineWidth = 9; x.lineCap = 'round'; draw(x); const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; return t; };
    const marks = [chalk((x) => { x.beginPath(); x.moveTo(60, 70); x.lineTo(196, 190); x.moveTo(196, 66); x.lineTo(64, 192); x.stroke(); }),
      chalk((x) => { x.beginPath(); x.moveTo(40, 128); x.lineTo(210, 128); x.moveTo(160, 80); x.lineTo(214, 128); x.lineTo(160, 176); x.stroke(); }),
      chalk((x) => { x.lineWidth = 7; for (let i = 0; i < 4; i++) { x.beginPath(); x.moveTo(60 + i * 34, 60); x.lineTo(66 + i * 34, 196); x.stroke(); } x.beginPath(); x.moveTo(40, 170); x.lineTo(200, 90); x.stroke(); })];
    const chalkM = marks.map((t, k) => sonar(new T.MeshStandardMaterial({ map: t, transparent: true, roughness: 1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }), 'chalk' + k));
    [[-74, -1, 1], [-84, 1, 0], [-97, -1, 2], [-113, 1, 1], [-131, -1, 0]].forEach(([z, sg, k]) => {
      const s = sZ(z), f = frame(s), dir = f.side.clone().multiplyScalar(sg);
      const hit = new T.Raycaster(at(s, 0, 1.5), dir, 0, 8).intersectObject(rock)[0]; if (!hit) return;
      const m = new T.Mesh(new T.PlaneGeometry(0.85, 0.85), chalkM[k]); m.position.copy(hit.point).addScaledVector(dir, -0.04); m.lookAt(at(s, 0, 1.5)); S.add(m);
    });

    // the tipped mine cart (built here, Poly Haven rusty metal)
    const rmArm = ltex('assets/textures/echo/rusty_metal_02_arm_1k.jpg');
    const cartM = sonar(new T.MeshStandardMaterial({ map: ltex('assets/textures/echo/rusty_metal_02_diff_1k.jpg', true), normalMap: ltex('assets/textures/echo/rusty_metal_02_nor_gl_1k.jpg'), roughnessMap: rmArm, metalnessMap: rmArm, metalness: 1, roughness: 1, side: T.DoubleSide }), 'cart');
    const cart = new T.Group(), quad = (a, b, c, d) => { const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute([...a, ...b, ...c, ...a, ...c, ...d], 3)); g.setAttribute('uv', new T.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1], 2)); g.computeVertexNormals(); return g; };
    { const L0 = 0.48, W0 = 0.32, L1 = 0.62, W1 = 0.44, y0 = 0.22, y1 = 0.82;
      const B = [[-L0, y0, -W0], [L0, y0, -W0], [L0, y0, W0], [-L0, y0, W0]], U = [[-L1, y1, -W1], [L1, y1, -W1], [L1, y1, W1], [-L1, y1, W1]];
      const hop = T.BufferGeometryUtils.mergeBufferGeometries([quad(B[0], B[1], B[2], B[3]), quad(B[0], B[1], U[1], U[0]), quad(B[1], B[2], U[2], U[1]), quad(B[2], B[3], U[3], U[2]), quad(B[3], B[0], U[0], U[3])]);
      cart.add(new T.Mesh(hop, cartM));
      for (let i = 0; i < 4; i++) { const a = V(...U[i]), b = V(...U[(i + 1) % 4]), m = new T.Mesh(new T.BoxGeometry(a.distanceTo(b) + 0.04, 0.045, 0.045), cartM); m.position.copy(a).lerp(b, 0.5); m.lookAt(b); m.rotateY(Math.PI / 2); cart.add(m); }
      for (const z of [-0.2, 0.2]) { const fr = new T.Mesh(new T.BoxGeometry(1.05, 0.08, 0.07), cartM); fr.position.set(0, 0.2, z); cart.add(fr); }
      for (const x of [-0.32, 0.32]) { const ax = new T.Mesh(new T.CylinderGeometry(0.025, 0.025, 0.7, 8), cartM); ax.rotation.x = Math.PI / 2; ax.position.set(x, 0.17, 0); cart.add(ax);
        for (const z of [-0.31, 0.31]) { const w = new T.Mesh(new T.CylinderGeometry(0.17, 0.17, 0.06, 18), cartM); w.rotation.x = Math.PI / 2; w.position.set(x, 0.17, z); cart.add(w); const fl = new T.Mesh(new T.CylinderGeometry(0.2, 0.2, 0.015, 18), cartM); fl.rotation.x = Math.PI / 2; fl.position.set(x, 0.17, z * 0.88); cart.add(fl); } }
      for (const x of [-0.25, 0, 0.25]) { const st = new T.Mesh(new T.BoxGeometry(0.035, 0.62, 0.012), cartM); st.position.set(x, 0.52, -0.39); st.rotation.x = -0.2; cart.add(st); const st2 = st.clone(); st2.position.z = 0.39; st2.rotation.x = 0.2; cart.add(st2); }
    }
    { const s = sZ(-91.5); cart.position.copy(at(s, 1.25, 0.43)); cart.quaternion.setFromRotationMatrix(basis(s)); cart.rotateY(0.35); cart.rotateX(-1.62); cart.rotateZ(0.08); S.add(cart); world.cartS = s; }

    // hanging chains: instanced torus links
    const linkG = new T.TorusGeometry(0.036, 0.0105, 6, 14); linkG.scale(1, 1.55, 1);
    const chainM = sonar(new T.MeshStandardMaterial({ map: ltex('assets/textures/echo/rusty_metal_02_diff_1k.jpg', true, 0.2, 0.2), roughnessMap: rmArm, metalnessMap: rmArm, metalness: 1, roughness: 1, color: 0xb8a090 }), 'chain');
    const chainDefs = [];
    [[-80, 0.3, 26], [-80, -0.6, 17], [-99, 0.7, 30], [-118.5, -0.4, 22], [-134, 0.5, 34], [-134, 1.1, 14]].forEach(([z, x, n]) => {
      const s = world.beams.reduce((a, b) => Math.abs(b - sZ(z)) < Math.abs(a - sZ(z)) ? b : a, world.beams[0]);
      chainDefs.push({ top: at(s, x, 2.73), n, ph: rnd() * 6, k: 0.6 + rnd() * 0.6 });
    });
    const nL = chainDefs.reduce((a, c) => a + c.n, 0);
    const chains = world.chains = new T.InstancedMesh(linkG, chainM, nL); chains.userData.defs = chainDefs; S.add(chains);

    // water: a flooded stretch (planar reflection) and two small puddles
    let hY = -1e9; for (let s = S_FLOOD0; s <= S_FLOOD1; s += 0.5) hY = Math.max(hY, frame(s).P.y); hY += 0.035; world.hY = hY;
    const ribbon = (s0, s1, w, y, seg) => { const pos = [], idx = []; for (let i = 0; i <= seg; i++) { const s = s0 + (s1 - s0) * i / seg, f = frame(s), u = i / seg, ww = w * Math.pow(Math.sin(Math.PI * u), 0.35) * (0.85 + 0.3 * FK.noise(u * 9, 1, 2)); for (const sg of [-1, 1]) { const v = f.P.clone().addScaledVector(f.side, sg * ww); pos.push(v.x, y == null ? f.P.y + 0.03 : y, v.z); } } for (let i = 0; i < seg; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g; };
    world.drips = [V(), V(), V(), V()].map((v, i) => { const s = S_FLOOD0 + (S_FLOOD1 - S_FLOOD0) * (0.2 + i * 0.22); return at(s, (rnd() - 0.5) * 1.2, 0.035); });
    const WU = { uMir: { value: mirRT.texture }, uRes: { value: bufSize }, uMirOn: { value: 1 }, uDrip: { value: world.drips.map((p) => new T.Vector4(p.x, p.z, -99, 0)) }, uTime: { value: 0 } };
    world.WU = WU;
    const waterFrag = (mir) => ['{ vec2 suv = gl_FragCoord.xy / uRes; vec2 off = vec2(0.0); float rip = 0.0;',
      ' for (int i = 0; i < 4; i++) { vec2 d = vWP.xz - uDrip[i].xy; float r = length(d), age = uTime - uDrip[i].z, R = age * 0.42;',
      '   float w = sin((r - R) * 42.0) * exp(-pow((r - R) / 0.14, 2.0)) * exp(-age * 1.4) * step(0.0, age); off += d / max(r, 1e-3) * w * 0.012; rip += abs(w); }',
      ' vec3 Vw = normalize(vViewPosition); vec3 Nw = normalize(vec3(viewMatrix * vec4(off.x * 16.0, 1.0, off.y * 16.0, 0.0)));',
      ' float fres = 0.02 + 0.98 * pow(1.0 - clamp(dot(Vw, Nw), 0.0, 1.0), 5.0);',
      mir ? ' vec3 refl = texture2D(uMir, clamp(suv + off, vec2(0.002), vec2(0.998))).rgb; outgoingLight += refl * mix(0.38, 1.0, fres) * uMirOn;' : '',
      ' for (int i = 0; i < 2; i++) { float A = uPA[i]; if (A < 0.002) continue; float dw = distance(vWP, uPP[i].xyz), R = uPP[i].w;',
      '   vec3 Lw = normalize(uPV[i] + vViewPosition); float spw = pow(max(dot(Nw, normalize(Lw + Vw)), 0.0), 96.0);',
      '   float ringW = exp(-pow((dw - R) / 1.1, 2.0));',
      '   outgoingLight += vec3(0.66, 0.84, 1.0) * (rip * 0.48 + spw * (0.45 + 1.8 * fres) * (ringW * 2.2 + 0.35)) * A / (1.0 + 0.07 * dw + 0.004 * dw * dw); }', '}'].join('\n');
    const waterDecl = 'uniform sampler2D uMir; uniform vec2 uRes; uniform float uMirOn, uTime; uniform vec4 uDrip[4];';
    const waterM = sonar(new T.MeshStandardMaterial({ color: 0x020304, roughness: 0.05, metalness: 0.1, transparent: false }), 'water', { uniforms: WU, decl: waterDecl, frag: waterFrag(true) });
    const water = world.water = new T.Mesh(ribbon(S_FLOOD0, S_FLOOD1, 2.15, hY, 80), waterM); S.add(water);
    const pudM = sonar(new T.MeshStandardMaterial({ color: 0x030405, roughness: 0.04, metalness: 0.2 }), 'puddle', { uniforms: WU, decl: waterDecl, frag: waterFrag(false) });
    [[-76, -0.7, 1.2], [-88.5, 0.9, 1.6], [-139, 0.2, 1.4]].forEach(([z, x, w]) => { const s = sZ(z); const g = ribbon(s - w, s + w, 0.55 + w * 0.3, null, 16); g.translate(0, 0.005, 0); const m = new T.Mesh(g, pudM); m.position.addScaledVector(frame(s).side, x); S.add(m); });

    // dust motes (and falling snow at the surface), lit by the pings
    const DN = mobile ? 900 : 2600, dp = new Float32Array(DN * 3), dr = new Float32Array(DN);
    for (let i = 0; i < DN; i++) { dp.set([rnd() * 16 - 8, rnd() * 9 - 4.5, rnd() * 16 - 8], i * 3); dr[i] = rnd(); }
    const dg = new T.BufferGeometry(); dg.setAttribute('position', new T.BufferAttribute(dp, 3)); dg.setAttribute('aR', new T.BufferAttribute(dr, 1));
    const DU = world.DU = { uT: { value: 0 }, uScale: { value: innerHeight }, uSnow: { value: 1 }, uCam: { value: V() } };
    const dust = world.dust = new T.Points(dg, new T.ShaderMaterial({ uniforms: Object.assign(DU, { uPP: PU.uPP, uPA: PU.uPA }), transparent: true, depthWrite: false, blending: T.AdditiveBlending, clipping: true,
      vertexShader: ['#include <clipping_planes_pars_vertex>', 'attribute float aR; uniform float uT, uScale, uSnow; uniform vec3 uCam; uniform vec4 uPP[2]; uniform float uPA[2]; varying float vA;',
        'void main(){ vec3 b = vec3(16.0, 9.0, 16.0);',
        ' vec3 p = position + vec3(sin(uT*0.21 + aR*30.0)*0.35 + uT*uSnow*0.5, -uT*(0.035 + uSnow*0.75*(0.5 + aR)), cos(uT*0.17 + aR*20.0)*0.35);',
        ' p = mod(p - uCam + b*0.5, b) - b*0.5 + uCam;',
        ' float L = 0.0; for (int i = 0; i < 2; i++) { float dw = distance(p, uPP[i].xyz), R = uPP[i].w; L += (exp(-pow((dw - R)/0.9, 2.0))*2.4 + smoothstep(R + 0.5, R - 8.0, dw)*0.22) * uPA[i] / (1.0 + dw*0.09); }',
        ' vec4 mvPosition = modelViewMatrix * vec4(p, 1.0); gl_PointSize = (0.9 + aR*1.7) * uScale / -mvPosition.z * mix(0.004, 0.011, uSnow);',
        ' vA = (L * (0.5 + aR) + uSnow * (0.4 + aR*0.5) * smoothstep(15.0, 2.0, -mvPosition.z)) * smoothstep(0.15, 0.7, -mvPosition.z);',
        ' gl_Position = projectionMatrix * mvPosition;', '#include <clipping_planes_vertex>', '}'].join('\n'),
      fragmentShader: '#include <clipping_planes_pars_fragment>\nuniform float uSnow; varying float vA; void main(){\n#include <clipping_planes_fragment>\n float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; gl_FragColor = vec4(mix(vec3(0.62, 0.8, 1.0), vec3(1.0), uSnow) * vA * smoothstep(0.5, 0.1, d), 1.0); }' }));
    dust.frustumCulled = false; S.add(dust);

    // props from the game's asset set (Poly Haven rocks, KayKit bones kept dark), loaded async
    const place = (o, s, x, y, sc, ry, tilt) => { o.position.copy(at(s, x, y)); o.quaternion.setFromRotationMatrix(basis(s)); o.rotateY(ry || 0); if (tilt) o.rotateX(tilt); o.scale.setScalar(sc); S.add(o); return o; };
    const props = {};
    const want = ['rock_07', 'rock_09', 'bone_A', 'bone_B', 'bone_C', 'skull', 'ribcage'];
    const pPromise = Promise.all(want.map((k) => FK.glb(D.props[k]).then((gl) => { gl.scene.traverse((o) => { if (o.isMesh) { const mm = o.material.clone(); if (/rock/.test(k)) mm.color = new T.Color(0x77716b); else { mm.color = new T.Color(0x4a4238); mm.roughness = 0.92; mm.metalness = 0; } o.material = sonar(mm, 'p-' + k); } }); props[k] = gl.scene; }))).then(() => {
      for (let s = S_LAND + 1; s < LT - 3; s += 1.4 + rnd() * 2.2) {
        const sg = rnd() < 0.5 ? -1 : 1, r7 = rnd() < 0.55, big = rnd(), pr = prof(s, frame(s).P.z);
        place(props[r7 ? 'rock_07' : 'rock_09'].clone(), s, sg * (pr.wf + 0.1 + rnd() * 0.5), -0.05, (r7 ? 1.6 : 3.6) * (0.5 + big * big * 2.4), rnd() * 6, (rnd() - 0.5) * 0.8);
      }
      for (let k = 0; k < 9; k++) place(props[rnd() < 0.5 ? 'rock_07' : 'rock_09'].clone(), world.cartS + (rnd() - 0.3) * 2.5, 0.5 + rnd() * 1.2, 0, 0.35 + rnd() * 0.5, rnd() * 6, rnd() * 3);
      const lair = sZ(-134);
      for (let k = 0; k < (mobile ? 14 : 24); k++) place(props[['bone_A', 'bone_B', 'bone_C'][k % 3]].clone(), lair + rnd() * 26, (rnd() - 0.5) * 3.6, 0.02, 0.4 + rnd() * 0.2, rnd() * 6, (rnd() - 0.5) * 0.4);
      place(props.skull.clone(), lair + 3, 1.1, 0.02, 0.26, 2.6); place(props.skull.clone(), lair + 12, -1.4, 0.02, 0.24, 0.4, 0.5); place(props.ribcage.clone(), lair + 7, -1.2, 0, 0.55, 1.1); place(props.ribcage.clone(), lair + 18, 1.4, 0, 0.5, 4.2, 0.3);
    });
    const phPromise = Promise.all([gltf('assets/models/ph/barrel_03/barrel_03.gltf'), gltf('assets/models/ph/rusted_spade_01/rusted_spade_01.gltf'), gltf('assets/models/ph/vintage_oil_lamp/vintage_oil_lamp.gltf')]).then(([barrel, spade, lamp]) => {
      const pf = (g, key) => g.scene.traverse((o) => { if (o.isMesh) o.material = sonar(o.material.clone(), key + o.material.name); });
      if (barrel) { pf(barrel, 'barrel'); place(barrel.scene, sZ(-94.5), -1.6, 0, 1, 0.6); const b2 = barrel.scene.clone(); place(b2, sZ(-95.6), -1.2, 0.3, 1, 1.2, 1.5); }
      if (spade) { pf(spade, 'spade'); const sp = place(spade.scene, sZ(-84.5), 1.95, 0.5, 1, 1.7); sp.rotateZ(0.32); }
      if (lamp) { // the lantern you carry, and drop when you fall
        const g = new T.Group(); lamp.scene.traverse((o) => { if (o.isMesh) { const m = o.material.clone(); m.envMapIntensity = 0.6; if (/flame/.test(m.name)) { m.emissiveIntensity = 3; world.flameM = m; m.depthWrite = false; } else if (/glass/.test(m.name)) { m.transparent = true; m.opacity = 0.35; } o.material = m; o.frustumCulled = false; } });
        lamp.scene.position.y = -0.6; g.add(lamp.scene); g.scale.setScalar(0.42);
        const L = world.lampLight = new T.PointLight(0xffa25a, 0, 9, 1.6); L.position.y = 0.05; g.add(L); S.add(g); world.lamp = g;
      }
    });
    // the Listener
    const lPromise = FK.glb(D.listener).then((gl) => {
      const Lg = world.listener = gl.scene; const box = new T.Box3().setFromObject(Lg); Lg.scale.setScalar(2.85 / (box.max.y - box.min.y));
      Lg.traverse((o) => { if (o.isMesh) { o.frustumCulled = false; o.material = sonar(o.material.clone(), 'listener-' + o.material.name, { rim: true }); } if (o.isBone && o.name === 'head') world.head = o; });
      world.mixer = new T.AnimationMixer(Lg); world.acts = {}; gl.animations.forEach((a) => { world.acts[a.name] = world.mixer.clipAction(a); });
      Lg.updateMatrixWorld(true);
      if (world.head) { const hq = world.head.getWorldQuaternion(new T.Quaternion()), rq = Lg.getWorldQuaternion(new T.Quaternion()); world.headFwd = V(0, 0, 1).applyQuaternion(rq.clone().invert().multiply(hq).invert()); }
      Lg.visible = false; S.add(Lg); world.L = { s: 0, x: 0, yaw: 0, act: null, look: 0, moving: false, init: false };
    });
    return Promise.all([pPromise, phPromise, lPromise]);
  }

  // jump-scare model, loaded after the scene is up
  function loadScare() {
    return FK.json('assets/echo-scare.json').then((j) => FK.glb(j.glb)).then((gl) => {
      const J = world.js = new T.Group(); J.add(gl.scene); J.visible = false; S.add(J);
      gl.scene.traverse((o) => { if (o.isMesh) { o.frustumCulled = false; o.material = sonar(o.material.clone(), 'scare-' + o.material.name, { rim: true }); } });
      world.jsMixer = new T.AnimationMixer(gl.scene); world.jsAct = world.jsMixer.clipAction(gl.animations[0]); world.jsAct.setLoop(T.LoopOnce); world.jsAct.clampWhenFinished = true;
      const mk = (c, x, y, z) => { const l = new T.PointLight(c, 0, 14, 2); l.position.set(x, y, z); J.add(l); return l; };
      world.jsKey = mk(0x5fa6b3, -0.4, 2.3, 4.9); world.jsRim = mk(0xff0a0c, 0, 2.2, -1.8); world.jsFace = mk(0xff1a14, -1.2, 2.5, 5.4);
      J.visible = true; try { R.compile(S, C); } catch (e) { /* compile later */ } J.visible = false;
    }).catch((e) => console.warn('scare model', e));
  }

  // ---------- audio: the game's CC0 sounds plus a few made here, spatialised with HRTF ----------
  const A = {};
  const synth = (ac, dur, fn) => { const n = Math.floor(ac.sampleRate * dur), b = ac.createBuffer(1, n, ac.sampleRate), d = b.getChannelData(0); fn(d, ac.sampleRate, n); return b; };
  function audioStart() {
    if (A.ac || !D) return; const ac = S0.ensureAudio(); if (!ac) return;
    A.ac = ac; A.out = ac.createGain(); A.out.connect(S0.master); A.buf = {};
    Object.keys(D.audio).forEach((k) => { ac.decodeAudioData(FK.b64ab(D.audio[k])).then((b) => { A.buf[k] = b; if (k === 'drone') loop('drone', b, 0); }).catch(() => {}); });
    A.buf.drip = synth(ac, 0.35, (d, sr, n) => { let ph = 0; for (let i = 0; i < n; i++) { const t = i / sr, f = 700 + 2300 * (1 - Math.exp(-t * 55)); ph += 2 * Math.PI * f / sr; d[i] = Math.sin(ph) * Math.exp(-t * 30) * 0.7 + (Math.random() * 2 - 1) * Math.exp(-t * 260) * 0.25; } });
    A.buf.breath = synth(ac, 4.4, (d, sr, n) => { let a = 0, b2 = 0; for (let i = 0; i < n; i++) { const t = i / sr, w = Math.random() * 2 - 1; a += 0.22 * (w - a); b2 += 0.03 * (a - b2); const bp = a - b2; const inh = t < 1.5 ? Math.pow(Math.sin(Math.PI * t / 1.5), 2) : 0, exh = t > 1.8 && t < 4 ? Math.pow(Math.sin(Math.PI * (t - 1.8) / 2.2), 2) * 0.8 : 0; d[i] = bp * (inh * 1.1 + exh) * 1.6; } });
    A.buf.noise = synth(ac, 3, (d, sr, n) => { let b = 0; for (let i = 0; i < n; i++) { b = 0.97 * b + 0.03 * (Math.random() * 2 - 1); d[i] = b * 4; } });
    A.buf.glass = synth(ac, 0.6, (d, sr, n) => { const fs = [3100, 4700, 5900, 7300, 8800]; for (let i = 0; i < n; i++) { const t = i / sr; let v = (Math.random() * 2 - 1) * Math.exp(-t * 40) * 0.5; fs.forEach((f, k) => { const t0 = k * 0.035; if (t > t0) v += Math.sin(2 * Math.PI * f * (t - t0)) * Math.exp(-(t - t0) * 18) * 0.18; }); d[i] = v; } });
    A.buf.thump = synth(ac, 0.7, (d, sr, n) => { let ph = 0; for (let i = 0; i < n; i++) { const t = i / sr; ph += 2 * Math.PI * (42 + 60 * Math.exp(-t * 18)) / sr; d[i] = Math.sin(ph) * Math.exp(-t * 6) + (Math.random() * 2 - 1) * Math.exp(-t * 30) * 0.4; } });
    const wbp = ac.createBiquadFilter(); wbp.type = 'bandpass'; wbp.frequency.value = 480; wbp.Q.value = 0.8; A.wbp = wbp;
    loop('wind', A.buf.noise, 0, wbp);
    const slp = ac.createBiquadFilter(); slp.type = 'lowpass'; slp.frequency.value = 1200; loop('slide', A.buf.noise, 0, slp);
    loop('breath', A.buf.breath, 0);
    A.drip = ac.createGain(); A.drip.connect(A.out); A.dripPan = world.drips.map((p) => { const pn = panner(p); pn.connect(A.drip); return pn; });
    A.shaper = ac.createWaveShaper(); { const k = 60, n = 2048, c = new Float32Array(n); for (let i = 0; i < n; i++) { const x = i * 2 / n - 1; c[i] = (1 + k) * x / (1 + k * Math.abs(x)); } A.shaper.curve = c; A.shaper.oversample = '4x'; }
    const sg = ac.createGain(); sg.gain.value = 0.55; A.shaper.connect(sg); sg.connect(A.out);
  }
  function loop(name, buf, vol, filt) { const ac = A.ac, s = ac.createBufferSource(); s.buffer = buf; s.loop = true; const g = ac.createGain(); g.gain.value = vol; if (filt) { s.connect(filt); filt.connect(g); } else s.connect(g); g.connect(A.out); s.start(); A['s_' + name] = s; A['g_' + name] = g; }
  function panner(p) { const pn = A.ac.createPanner(); pn.panningModel = 'HRTF'; pn.distanceModel = 'inverse'; pn.refDistance = 1.2; pn.rolloffFactor = 1.1; pn.maxDistance = 300; setPos(pn, p); return pn; }
  function setPos(pn, p) { if (pn.positionX) { pn.positionX.value = p.x; pn.positionY.value = p.y; pn.positionZ.value = p.z; } else pn.setPosition(p.x, p.y, p.z); }
  function play(k, o) {
    o = o || {}; if (!A.ac || !A.buf[k] || !S0.soundOn) return null;
    const ac = A.ac, s = ac.createBufferSource(); s.buffer = A.buf[k]; s.playbackRate.value = o.rate || 1;
    const g = ac.createGain(); g.gain.value = o.vol == null ? 1 : o.vol; let node = s;
    if (o.lp) { const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; node.connect(f); node = f; }
    node.connect(g); node = g;
    if (o.pos) { const pn = panner(o.pos); node.connect(pn); node = pn; } else if (o.pan != null && ac.createStereoPanner) { const sp = ac.createStereoPanner(); sp.pan.value = o.pan; node.connect(sp); node = sp; }
    node.connect(o.dest || A.out); s.start(ac.currentTime + (o.when || 0)); return s;
  }
  const gain = (k, v, tc) => { const g = A['g_' + k]; if (g) g.gain.setTargetAtTime(v, A.ac.currentTime, tc || 0.25); };
  document.addEventListener('site:sound', (e) => { if (e.detail) audioStart(); });

  // ---------- pings and their echoes ----------
  const pings = [{ t: -1e9, p: V() }, { t: -1e9, p: V() }]; let lastPing = -1e9, pingAmp = 1;
  const ray = new T.Raycaster(), dirs = [];
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; dirs.push(V(Math.sin(a), 0.05, -Math.cos(a))); }
  for (const a of [0.6, 2.5]) for (const e of [0.55, -0.45]) dirs.push(V(Math.sin(a) * 0, e, -Math.cos(a)));
  function ping(amp) {
    const now = performance.now(); pings[1].t = pings[0].t; pings[1].p.copy(pings[0].p); pings[1].a = pings[0].a;
    pings[0].t = now; pings[0].a = amp || 1; pings[0].p.copy(C.position).addScaledVector(camFwd, 0.3); lastPing = now;
    if (!A.ac || !S0.soundOn) return;
    const soft = amp && amp < 1; play('ping', { vol: soft ? 0.22 : 0.7 });
    if (!world.col) return;
    const yaw = Math.atan2(camFwd.x, -camFwd.z), q = new T.Quaternion().setFromAxisAngle(up0, -yaw);
    dirs.forEach((d0) => {
      const d = d0.clone().normalize().applyQuaternion(q); ray.set(C.position, d); ray.far = 120;
      const h = ray.intersectObject(world.col, false)[0]; if (!h) return;
      const dist = h.distance, delay = 2 * dist / 343;
      const vol = (soft ? 0.18 : 0.58) * Math.exp(-dist * 0.028) / (1 + 0.08 * dist + 0.005 * dist * dist);
      play('ping', { pos: h.point, when: delay, vol, rate: 0.98 - Math.min(0.1, dist * 0.0018), lp: 350 + 8500 * Math.exp(-dist * 0.042) });
      if (dist > 10) play('ping', { pos: h.point, when: delay * 2.02, vol: vol * 0.28, rate: 0.94, lp: 260 + 3400 * Math.exp(-dist * 0.042) });
    });
  }

  // ---------- state ----------
  let forceP = null, forceA = null, snap = 0, mode = 'film';
  let ps = 0, pPrev = 0, camS = 0, sPrev = null, speed = 0, stepIdx = 0, stepSide = 1, beatNext = 0, shakeT = -1e9, mouse = new T.Vector2(), mt = new T.Vector2();
  let scaring = false, scareT0 = 0, scareF = null, caught = false, scareAt = 0, fear = 0, holdK = 0, blk = 0, afterK = 0, aS = 0;
  const camFwd = V(0, 0, -1), tP = V(), tL = V(), tmp = V(), tmp2 = V(), qa = new T.Quaternion(), qb = new T.Quaternion();
  const clearForce = () => { forceP = null; forceA = null; };
  ['wheel', 'touchstart', 'keydown'].forEach((e) => window.addEventListener(e, clearForce, { passive: true }));
  window.addEventListener('pointermove', (e) => mt.set(e.clientX / innerWidth * 2 - 1, e.clientY / innerHeight * 2 - 1), { passive: true });
  const filmP = () => { if (forceP != null) return forceP; const r = film.getBoundingClientRect(), h = r.height - innerHeight; return cl(-r.top / h, 0, 1); };
  const afterP = () => { if (forceA != null) return forceA; const r = after.getBoundingClientRect(); return cl((innerHeight - r.top) / (r.height + innerHeight * 0.5), 0, 1); };

  // descent keys (surface to the crevasse floor), then the walk keys along the path
  const S8 = sZ(1);
  const eyeAt = (s, h, o) => { const f = frame(s); return (o || V()).copy(f.P).addScaledVector(f.up, h); };
  const DK = [V(-2.6, 2.4, 16.5), V(-0.6, 2.2, 10), V(0.3, 1.5, 4.6), V(0.25, -9.5, 1.6), eyeAt(S8, 1.62)];
  const DL = [V(1.6, -1.6, -24), V(0.6, -4, -14), V(0.3, -16, -2.5), V(0.25, -19.4, -7), eyeAt(S8 + 5, 1.5)];
  const dP = new T.CatmullRomCurve3(DK), dL = new T.CatmullRomCurve3(DL);
  const DU_ = [[0, 0], [0.05, 0.25], [0.085, 0.5], [0.115, 0.75], [0.14, 1]];
  const SK = [[0.14, S8], [0.19, sZ(-24)], [0.255, S_LAND], [0.302, S_LAND + 0.6], [0.40, sZ(-80)], [0.56, sZ(-108)], [0.68, S_HOLD - 2.5], [0.80, S_HOLD]];
  const distAhead = (p) => lin([[0.42, 30], [0.5, 22], [0.56, 16], [0.62, 11], [0.68, 7.5], [0.74, 5], [0.795, 3.5]], p);
  const CH = [0, 0.05, 0.2, 0.3, 0.54, 0.68, 0.82];

  function lampPose(p) {
    const lg = world.lamp; if (!lg) return;
    const hand = ss(0.135, 0.16, p), fallK = ss(0.255, 0.262, p);
    // in the hand: lower right of the view
    tmp.set(0.3, -0.34, -0.62).applyQuaternion(C.quaternion).add(C.position);
    const sL = S_LAMP; const fl = at(sL, 0.35, 0.09);
    lg.position.copy(tmp).lerp(fl, fallK);
    qa.copy(C.quaternion).multiply(qb.setFromEuler(new T.Euler(0.15, 0, -0.1)));
    qb.setFromRotationMatrix(basis(sL)).multiply(new T.Quaternion().setFromEuler(new T.Euler(0.2, 0.9, Math.PI / 2 - 0.12)));
    lg.quaternion.copy(qa).slerp(qb, fallK);
    if (fallK > 0 && fallK < 1) lg.position.y += Math.sin(fallK * Math.PI) * 0.5;
    lg.visible = hand > 0.01 && mode === 'film' && p < 0.34;
    lg.scale.setScalar(0.42 * Math.max(0.001, hand));
    const t = performance.now() / 1000, fl1 = 0.82 + 0.18 * FK.noise(t * 9, 1, 2);
    const die = 1 - ss(0.264, 0.292, p), sput = p > 0.262 && p < 0.292 ? (FK.noise(t * 23, 3, 1) > 0.55 ? 0.25 : 1) : 1;
    const I = hand * die * fl1 * sput; world.lampLight.intensity = I * 2.4; if (world.flameM) { world.flameM.emissiveIntensity = 3 * I; world.flameM.opacity = I; world.flameM.transparent = true; }
  }

  function updateListener(dt, p, now) {
    const Lg = world.listener, st = world.L; if (!Lg) return;
    const show = mode === 'film' && p > 0.41 && p < 0.84 && !scaring;
    Lg.visible = show; if (!show) { st.init = false; return; }
    const target = Math.min(camS + distAhead(p), LT - 6);
    // how much light is on it right now
    let lit = 0; const lp = Lg.position;
    pings.forEach((pg) => { const age = (now - pg.t) / 1000, R = age * 17, A0 = (pg.a || 1) * Math.exp(-age * 0.75), d = lp.distanceTo(pg.p); if (R > d - 1 && A0 > 0.07) lit = Math.max(lit, A0); });
    if (!st.init || snap) { st.s = target; st.init = true; st.yaw = 0.7; }
    const moving = !lit && Math.abs(target - st.s) > 0.05;
    if (moving) { const sp = Math.min(Math.abs(target - st.s), 2.8 * dt); st.s += Math.sign(target - st.s) * sp; }
    if (!moving && st.moving) st.yaw = (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 0.4); // arrives, faces off to one side
    st.moving = moving;
    const f = frame(st.s); Lg.position.copy(f.P).addScaledVector(f.side, Math.sin(st.s * 0.35) * 0.55);
    const toCam = Math.atan2(C.position.x - lp.x, C.position.z - lp.z);
    const fy = moving ? toCam + (target < st.s ? 0 : Math.PI) : toCam + st.yaw;
    let dy = fy - Lg.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); Lg.rotation.set(0, Lg.rotation.y + dy * (1 - Math.exp(-dt * (moving ? 5 : 3))), 0);
    if (snap) Lg.rotation.y = fy;
    const want = lit ? 'Alert_Listen' : moving ? 'Walk_Stalk' : 'Idle_Breathe';
    if (st.act !== want && world.acts[want]) { if (st.act) world.acts[st.act].fadeOut(0.3); world.acts[want].reset().fadeIn(0.3).play(); st.act = want; }
    world.mixer.update(snap ? 0.5 : dt);
    // head turns toward the sound (look-at on the head bone, layered over the animation)
    st.look += ((lit ? 1 : 0) - st.look) * (1 - Math.exp(-dt * (lit ? 9 : 1.5))); if (snap) st.look = lit ? 1 : 0;
    const hb = world.head;
    if (hb && world.headFwd && st.look > 0.01) {
      Lg.updateMatrixWorld(true);
      const hw = hb.getWorldQuaternion(new T.Quaternion()), hp = hb.getWorldPosition(V());
      const cur = world.headFwd.clone().applyQuaternion(hw).normalize(), want2 = C.position.clone().sub(hp).normalize();
      const ang = cur.angleTo(want2), lim = Math.min(1, 1.35 / Math.max(ang, 1e-3));
      const dq = new T.Quaternion().setFromUnitVectors(cur, want2); const id = new T.Quaternion(); id.slerp(dq, st.look * lim);
      const nw = id.multiply(hw), pw = hb.parent.getWorldQuaternion(new T.Quaternion()); hb.quaternion.copy(pw.invert().multiply(nw));
    }
    if (lit > 0.3 && !st.hissed && lp.distanceTo(C.position) < 16) { st.hissed = true; play('hiss', { pos: lp.clone().setY(lp.y + 2.4), when: lp.distanceTo(C.position) / 343 + 0.25, vol: 0.9 }); }
    if (!lit) st.hissed = false;
  }

  function triggerScare() {
    if (scaring || !world.js) return;
    scaring = true; scareT0 = performance.now(); caught = false;
    const J = world.js, fw = camFwd.clone(); fw.y = 0; fw.normalize();
    J.position.copy(C.position).addScaledVector(fw, 6); J.position.y = frame(camS).P.y;
    J.lookAt(C.position.x, J.position.y, C.position.z); J.visible = true; if (world.listener) world.listener.visible = false;
    world.jsAct.reset().play(); world.jsMixer.update(0);
    if (A.ac && S0.soundOn) { const s = play('scare', { vol: 0.6 }); if (s && A.buf.scare) play('scare', { vol: 0.9, dest: A.shaper, rate: 0.98 }); gain('drone', 0, 0.1); }
  }
  function resetScare() { scaring = false; caught = false; scareAt = 0; if (world.js) world.js.visible = false; }

  function renderMirror() {
    const hY = world.hY; world.water.visible = false;
    S.position.y = 2 * hY; S.scale.y = -1; S.updateMatrixWorld(true);
    const sv = PU.uPP.value.map((v) => v.clone()), svV = PU.uPV.value.map((v) => v.clone());
    PU.uPP.value.forEach((v, i) => { v.y = 2 * hY - v.y; PU.uPV.value[i].set(v.x, v.y, v.z).applyMatrix4(C.matrixWorldInverse); });
    R.clippingPlanes = [new T.Plane(V(0, -1, 0), hY + 0.01)];
    R.setRenderTarget(mirRT); R.clear(); R.render(S, C); R.setRenderTarget(null); R.clippingPlanes = [];
    PU.uPP.value.forEach((v, i) => v.copy(sv[i])); PU.uPV.value.forEach((v, i) => v.copy(svV[i]));
    S.position.y = 0; S.scale.y = 1; S.updateMatrixWorld(true); world.water.visible = true;
  }

  // ---------- main loop ----------
  let last = 0, t0 = performance.now(), ready = false, visible = true, frameN = 0;
  document.addEventListener('visibilitychange', () => { visible = !document.hidden; });
  function loopF(now) {
    requestAnimationFrame(loopF);
    if (!visible || !ready) return;
    const dt = cl((now - (last || now)) / 1000, 0.0005, 0.05); last = now; const t = (now - t0) / 1000;
    gov.tick(now);
    const pRaw = filmP(), aRaw = afterP();
    const nextMode = pRaw >= 0.999 && aRaw > 0.02 ? 'after' : 'film';
    if (nextMode !== mode) { mode = nextMode; if (mode === 'after') { afterK = 0; resetScare(); } }
    ps = snap ? pRaw : ps + (pRaw - ps) * (1 - Math.exp(-dt * 3.4)); const p = ps;
    aS = snap ? aRaw : aS + (aRaw - aS) * (1 - Math.exp(-dt * 2.5));
    mouse.lerp(mt, 1 - Math.exp(-dt * 2.5));

    // ---- camera ----
    let eye = 1.62, roll = 0, walkK = 1, lookDown = 0.1;
    if (mode === 'film') {
      if (p < 0.14) {
        const u = lin(DU_, p) ; dP.getPoint(u, tP); dL.getPoint(u, tL); camS = S8; walkK = 0;
        tL.x += mouse.x * 0.6; tL.y -= mouse.y * 0.4;
      } else {
        camS = lin(SK, p);
        eye = lin([[0.185, 1.62], [0.2, 1.08], [0.25, 0.98], [0.258, 0.42], [0.284, 0.42], [0.302, 1.62]], p);
        const hold = ss(0.68, 0.72, p); lookDown = 0.12 + hold * 0.12;
        const f = frame(camS); eyeAt(camS, eye, tP);
        frame(camS + 5, {}); eyeAt(camS + 5, eye - lookDown * 5 * 0.25, tL);
        tL.addScaledVector(f.side, mouse.x * 1.4 * (1 - hold * 0.6)); tL.y -= mouse.y * 0.7 * (1 - hold * 0.6);
        // slide down the chute, then the impact
        const slide = ss(0.188, 0.2, p) * (1 - ss(0.25, 0.256, p)); walkK = 1 - Math.max(slide, ss(0.25, 0.256, p) * (1 - ss(0.29, 0.302, p)));
        roll = slide * (Math.sin(camS * 0.55) * 0.07) + lin([[0.255, 0], [0.259, 0.34], [0.284, 0.22], [0.302, 0]], p);
        const lie = ss(0.254, 0.262, p) * (1 - ss(0.284, 0.302, p)); if (lie > 0) tL.lerp(at(S_LAMP, 0.35, 0.1), lie);
        if (pPrev < 0.255 && p >= 0.255 && !snap) { shakeT = now; play('thump', { vol: 0.9 }); play('glass', { vol: 0.5, when: 0.18, pos: at(S_LAMP, 0.35, 0.1) }); }
        if (slide > 0.2) gain('slide', Math.min(0.5, speed * 0.04) * slide, 0.08); else gain('slide', 0, 0.15);
      }
    } else { // after the film: drifting slowly back through the mine
      camS = lerp(sZ(-70), sZ(-124), aS); eyeAt(camS, 1.62, tP); eyeAt(camS + 6, 1.4, tL); const f = frame(camS);
      tL.addScaledVector(f.side, mouse.x * 1.2 + Math.sin(t * 0.13) * 0.8); tL.y += -mouse.y * 0.5 + Math.sin(t * 0.21) * 0.2; walkK = 0.5;
    }
    // head bob tied to how far you actually moved
    if (sPrev == null || snap) sPrev = camS;
    const ds = camS - sPrev; sPrev = camS; const v = Math.abs(ds) < 3 ? Math.abs(ds) / Math.max(dt, 1e-3) : 0;
    speed += (v - speed) * (1 - Math.exp(-dt * 6));
    const k = ss(0.1, 1.4, speed) * walkK, ph = camS / 0.74, still = mode === 'film' ? 1 - ss(0.68, 0.7, p) * (1 - ss(0.86, 0.9, p)) : 1;
    tP.y += -0.04 * k * Math.cos(2 * Math.PI * ph) + Math.sin(t * 1.5) * 0.007 * still;
    tmp.copy(tL).sub(tP).normalize(); tmp2.crossVectors(tmp, up0).normalize();
    tP.addScaledVector(tmp2, 0.025 * k * Math.sin(Math.PI * ph) + Math.sin(t * 0.7) * 0.004 * still);
    const si = Math.floor(ph);
    if (si !== stepIdx) { if (k > 0.18 && !scaring) { stepSide = -stepSide; play('step', { vol: 0.25 + 0.35 * k, rate: 0.88 + Math.random() * 0.2, pan: stepSide * 0.25, lp: 2200 }); } stepIdx = si; }
    C.position.copy(tP); C.up.copy(up0); C.lookAt(tL); C.rotateZ(roll + 0.009 * k * Math.sin(Math.PI * ph));
    // impact shake
    const sa = (now - shakeT) / 1000; if (sa < 0.7) { const a = (1 - sa / 0.7) * 0.06; C.rotateX((FK.noise(t * 40, 1, 0) - 0.5) * a); C.rotateY((FK.noise(t * 40, 5, 0) - 0.5) * a); }
    C.getWorldDirection(camFwd);

    // ---- light: the surface fades out as you descend ----
    const Lf = mode === 'film' ? 1 - ss(0.07, 0.25, p) * 0.75 - ss(0.2, 0.255, p) * 0.25 : 0;
    world.sun.intensity = 2.3 * Math.pow(Lf, 1.6); world.hemi.intensity = 0.9 * Lf;
    world.iceM.envMapIntensity = 0.9 * Lf + 0.05; world.iceFloorM.envMapIntensity = Lf; PU.uGlow.value = 0.12 + 1.1 * Lf; PU.uDeep.value = lerp(0.03, 0.3, Lf);
    S.background.copy(BLACK).lerp(SKY, Math.pow(Lf, 2.2)); S.fog.color.copy(BLACK).lerp(DEEPICE, ss(0.05, 0.5, Lf)).lerp(SKY, ss(0.55, 1, Lf));
    S.fog.density = lerp(0.034, 0.012, Lf);
    world.iceTube.visible = mode === 'film' && camS < S_ROCK1 + 6; world.ground.visible = world.iceTube.visible;
    ovl.classList.toggle('active', mode === 'film' && p > 0.015);
    ovl.classList.toggle('lit', mode === 'film' && p < 0.075);
    if (P.bloom) { P.bloom.threshold = lerp(0.55, 1.4, Lf); P.bloom.strength = lerp(0.75, 0.35, Lf); }
    world.DU.uSnow.value = mode === 'film' ? ss(0.4, 0.8, Lf) : 0;

    // ---- story: pings, the hold, the scare ----
    const inMine = mode === 'film' && p > 0.3 && p < 0.68;
    if (mode === 'film' && !snap) {
      [0.312, 0.35, 0.44, 0.5, 0.555, 0.6, 0.645].forEach((sp) => { if (pPrev < sp && p >= sp) ping(); });
      if (inMine && now - lastPing > 6400) ping();
      if (pPrev < 0.795 && p >= 0.795 && !scaring && !caught) { ping(); scareAt = now + 1300; }
      if (scareAt && now > scareAt && !scaring && p > 0.77) { scareAt = 0; triggerScare(); }
    }
    if (mode === 'after' && now - lastPing > 4200) ping(0.55);
    if (p < 0.76 && mode === 'film') { if (scaring || scareAt) resetScare(); }
    if (caught && p < 0.76) caught = false;
    holdK = mode === 'film' ? ss(0.675, 0.69, p) * (1 - ss(0.8, 0.82, p)) : 0;
    fear = mode === 'film' ? Math.max(ss(0.5, 0.68, p) * 0.55, holdK) : 0;

    // ping uniforms: two wavefronts, the older fading out
    pings.forEach((pg, i) => { const age = (now - pg.t) / 1000; PU.uPP.value[i].set(pg.p.x, pg.p.y, pg.p.z, age * 17); PU.uPA.value[i] = age < 0 || age > 12 ? 0 : (pg.a || 1) * Math.exp(-age * 0.75) * ss(0, 0.04, age); });
    C.updateMatrixWorld(); C.matrixWorldInverse.copy(C.matrixWorld).invert();
    pings.forEach((pg, i) => PU.uPV.value[i].copy(pg.p).applyMatrix4(C.matrixWorldInverse));

    lampPose(p);
    updateListener(dt, p, now);

    // chains sway
    if (world.chains) { const ch = world.chains, m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(); let n = 0;
      ch.userData.defs.forEach((c) => { const ax = Math.sin(t * c.k + c.ph) * 0.05, az = Math.cos(t * c.k * 0.8 + c.ph) * 0.035; for (let i = 0; i < c.n; i++) { const yy = -0.068 * i - 0.04; e.set(ax, i % 2 ? Math.PI / 2 : 0, az); q.setFromEuler(e); tmp.set(0, yy, 0).applyEuler(e.set(ax, 0, az)).add(c.top); m4.compose(tmp, q.setFromEuler(new T.Euler(ax, i % 2 ? Math.PI / 2 : 0, az, 'XZY')), V(1, 1, 1)); ch.setMatrixAt(n++, m4); } });
      ch.instanceMatrix.needsUpdate = true; }

    // ---- the scare ----
    G.uFlash.value.set(0, 0, 0); G.uCA.value = 0.0018; G.uTint.value.set(1, 1, 1); PU.uRim.value = 0;
    let exp = mode === 'film' ? lerp(1.0, 1.25, 1 - Lf) : 1.2;
    if (scaring && world.js) {
      const fr = scareF != null ? scareF : (now - scareT0) / 1000 * 24 + 1, J = world.js;
      if (scareF != null) { world.jsAct.time = (fr - 1) / 24; world.jsMixer.update(0); } else world.jsMixer.update(dt);
      const rec = cl((fr - 51) / 6, 0, 1), atk = cl((fr - 49) / 7, 0, 1), sh = fr >= 52 && fr <= 78;
      const lc = V(sh ? 0.025 * Math.sin(fr * 2.1) : 0, 1.63 + (sh ? 0.015 * Math.cos(fr * 1.7) : 0), 6 + 0.19 * rec), tg = V(0, 1.78, 0.5).lerp(V(0, 2.1, 4.15), atk);
      C.position.copy(J.localToWorld(lc)); C.lookAt(J.localToWorld(tg));
      if (sh) { const a = 0.075 * Math.exp(-(fr - 52) * 0.09); C.rotateZ((FK.noise(fr * 0.9, 2, 0) - 0.5) * a * 2.2); C.rotateX((FK.noise(fr * 1.1, 7, 0) - 0.5) * a * 1.4); C.rotateY((FK.noise(fr * 1.3, 9, 0) - 0.5) * a * 1.4); C.position.x += (FK.noise(fr * 1.7, 4, 1) - 0.5) * a * 0.6; C.position.y += (FK.noise(fr * 1.5, 6, 1) - 0.5) * a * 0.6; }
      const lens = fr < 49 ? 35 : fr < 54 ? 32 : 29, hf = 2 * Math.atan(18 / lens);
      C.fov = Math.max(34, 2 * Math.atan(Math.tan(hf / 2) / C.aspect) * 180 / Math.PI); C.updateProjectionMatrix();
      const pw = lin([[1, 8], [29, 12], [38, 22], [44, 3], [49, 6], [52, 30], [54, 95], [59, 60], [78, 60], [79, 0], [96, 0]], fr);
      world.jsKey.intensity = pw * 0.03; world.jsRim.intensity = pw * 0.06; world.jsFace.intensity = fr >= 52 ? pw * 0.035 : 0;
      PU.uRim.value = lin([[1, 0.015], [15, 0.025], [29, 0.1], [38, 0.14], [44, 0.02], [48, 0.07], [51, 0.08], [54, 0.16], [58, 0.1], [72, 0.075], [78, 0.075], [79, 0]], fr) * 2.6;
      const hit = cl(1 - Math.abs(fr - 54) / 6, 0, 1), flick = sh ? 0.5 + 0.5 * Math.sin(fr * 3.1) : 0;
      G.uCA.value = 0.0018 + hit * 0.032 + flick * 0.006; G.uFlash.value.set(hit * 1.1 + flick * 0.08, hit * 0.03, hit * 0.02); G.uTint.value.set(1 + hit * 0.6, 1 - hit * 0.45, 1 - hit * 0.45);
      exp = 1.25 + hit * 0.6;
      if (fr >= 79) { J.visible = false; caught = true; scaring = false; }
    } else if (C.fov !== (C.aspect < 0.8 ? 72 : 58)) { C.fov = C.aspect < 0.8 ? 72 : 58; C.updateProjectionMatrix(); }
    // blackout after you are caught, then the end card; the mine fades back in behind the sections after
    const bTarget = mode === 'film' ? (caught || (p > 0.84 && !scaring) ? 1 : 0) : 0;
    blk += (bTarget - blk) * (1 - Math.exp(-dt * (bTarget ? 10 : 1.4))); if (snap) blk = bTarget;
    if (mode === 'after') { afterK = Math.min(1, afterK + dt * 0.6); exp *= afterK; }
    G.uExp.value = exp * (1 - blk); G.uT.value = t;

    // ---- audio mix ----
    if (A.ac) {
      const L = A.ac.listener, c = C.position; const fw = camFwd, uq = V(0, 1, 0).applyQuaternion(C.quaternion);
      if (L.positionX) { L.positionX.value = c.x; L.positionY.value = c.y; L.positionZ.value = c.z; L.forwardX.value = fw.x; L.forwardY.value = fw.y; L.forwardZ.value = fw.z; L.upX.value = uq.x; L.upY.value = uq.y; L.upZ.value = uq.z; }
      else { L.setPosition(c.x, c.y, c.z); L.setOrientation(fw.x, fw.y, fw.z, uq.x, uq.y, uq.z); }
      const mineK = mode === 'film' ? ss(0.2, 0.27, p) : 1, silent = holdK > 0.5 || scaring;
      gain('wind', 0.5 * Math.pow(Lf, 1.4) * (mode === 'film' ? 1 : 0)); if (A.wbp) A.wbp.frequency.value = 380 + 300 * Lf + Math.sin(t * 0.3) * 120;
      gain('drone', silent || caught ? 0 : 0.45 * mineK, silent ? 0.08 : 0.8);
      gain('breath', silent || caught || blk > 0.5 ? 0 : (mode === 'film' ? 0.12 + 0.3 * mineK : 0.1), silent ? 0.05 : 0.5);
      if (A.s_breath) A.s_breath.playbackRate.value = 1 + fear * 0.55;
      if (A.drip) A.drip.gain.setTargetAtTime(silent || caught ? 0 : mineK, A.ac.currentTime, 0.1);
      if ((fear > 0.15 || holdK > 0) && !scaring && !caught && now > beatNext && S0.soundOn) { const bpm = lerp(68, 150, holdK > 0 ? ss(0.68, 0.79, p) : fear * 0.6); beatNext = now + 60000 / bpm; play('heart', { vol: 0.25 + 0.75 * Math.max(fear, holdK) }); }
    }
    // drips: random, positioned; ripples in the water
    world.WU.uTime.value = t;
    if (mode !== 'film' || p > 0.27) world.drips.forEach((d, i) => { const u = world.WU.uDrip.value[i]; if (!d.next) d.next = t + 1 + Math.random() * 4; if (t > d.next && holdK < 0.5) { d.next = t + 1.8 + Math.random() * 4.5; u.z = t; if (A.dripPan && S0.soundOn && d.distanceTo(C.position) < 40) play('drip', { vol: 0.9, rate: 0.85 + Math.random() * 0.4, dest: A.dripPan[i] }); } });

    // ---- overlay ----
    const fp = mode === 'film' ? p : 1;
    caps.forEach((c) => { const on = mode === 'film' && fp >= +c.dataset.a && fp < +c.dataset.b && !scaring && !(caught && fp < 0.88); c.classList.toggle('on', on); });
    if (capCaught) capCaught.classList.toggle('on', caught && fp < 0.88 && mode === 'film');
    let chI = 0; CH.forEach((c, i) => { if (fp >= c) chI = i; }); if (caught) chI = 6; chs.forEach((c, i) => c.classList.toggle('on', i === chI));
    if (bar) bar.style.transform = `scaleX(${fp.toFixed(4)})`;
    pingBtn.classList.toggle('show', mode === 'film' && p > 0.27 && p < 0.86 && !scaring); pingBtn.classList.toggle('hold', holdK > 0.5);
    hint.classList.toggle('on', holdK > 0.5 && !scaring);

    // ---- render ----
    const useDescentFilm = !!(descentPl && mode === 'film' && p < 0.24);
    ovl.classList.toggle('descent-film', useDescentFilm);
    if (useDescentFilm) {
      descentPl.draw(cl(p / 0.24, 0, 1));
    } else {
      world.DU.uT.value = t; world.DU.uScale.value = bufSize.y; world.DU.uCam.value.copy(C.position);
      const wantMirror = world.water && Math.abs(camS - (S_FLOOD0 + S_FLOOD1) / 2) < 42 && camS < S_FLOOD1 + 2 && blk < 0.99;
      world.WU.uMirOn.value = wantMirror ? 1 : 0; if (wantMirror && (snap || (frameN % 2 === 0))) renderMirror();
      frameN++;
      P.c.render(dt);
    }
    pPrev = p; snap = Math.max(0, snap - 1);
  }

  // ping button: during the hold it gives you away
  const userPing = () => { if (!ready || scaring) return; const p = filmP(); if (mode === 'film' && p > 0.675 && p < 0.84 && !caught) { ping(); scareAt = performance.now() + 650; return; } ping(); };
  pingBtn.addEventListener('click', userPing);
  window.addEventListener('keydown', (e) => {
    if ((e.key !== 'p' && e.key !== 'P') || e.metaKey || e.ctrlKey || e.altKey) return;
    const tag = document.activeElement && document.activeElement.tagName;
    if (tag && /INPUT|TEXTAREA|SELECT/.test(tag)) return;
    const p = filmP();
    if (mode === 'film' && p > 0.27 && p < 0.86) userPing();
  });

  // ---------- test hooks ----------
  window.echo = {
    get ready() { return ready; },
    setProgress(p) { forceA = null; forceP = cl(p, 0, 1); snap = 2; const top = film.getBoundingClientRect().top + scrollY, y = top + forceP * (film.offsetHeight - innerHeight); if (S0.lenis) S0.lenis.scrollTo(y, { immediate: true, force: true }); else scrollTo(0, y); pPrev = forceP; },
    setAfter(a) { forceP = 1; forceA = cl(a, 0, 1); snap = 2; const r = after.getBoundingClientRect(), y = r.top + scrollY - innerHeight + a * (r.height + innerHeight * 0.5); if (S0.lenis) S0.lenis.scrollTo(y, { immediate: true, force: true }); else scrollTo(0, y); },
    ping: (a) => ping(a), triggerScare, scareFrame(f) { scareF = f; }, state: () => ({ mode, p: ps, camS, scaring, caught, L: world.L && world.L.s }),
  };

  // ---------- boot ----------
  const load = Promise.all([
    fetchJSON('assets/echo-core.json', 0.02, 0.85).then((d) => { D = d; return build(); }),
    new Promise((res) => new T.RGBELoader().load('assets/textures/snow.hdr', (tx) => { tx.mapping = T.EquirectangularReflectionMapping; const pm = new T.PMREMGenerator(R); S.environment = pm.fromEquirectangular(tx).texture; tx.dispose(); pm.dispose(); res(); }, undefined, () => res())),
    document.fonts ? document.fonts.ready : null,
  ]).then(() => { try { R.compile(S, C); } catch (e) { /* first frame compiles */ } ready = true; if (loadingEl) loadingEl.classList.add('off'); if (S0.soundOn) audioStart(); loadScare(); })
    .catch((e) => { console.error(e); if (loadingEl) loadingEl.textContent = 'The mine failed to load. Scroll on to read about Echo.'; });
  S0.boot(load);
  requestAnimationFrame(loopF);
})();
