/* Projects: two architectural frosted glass blocks (Sky Sentry, Echo) in a calm frosted studio horizon.
   Direct antialiased WebGL (DPR >= 1.0, ACESFilmicToneMapping), instant RoomEnvironment lighting (<15ms), zero snow clutter. */
(function () {
  const T = THREE, S0 = window.SITE, V = (x, y, z) => new T.Vector3(x, y, z);
  const cv = document.getElementById('pgl'), stage = document.querySelector('.pstage');
  const links = Array.from(document.querySelectorAll('.blk')), spaces = links.map((a) => a.querySelector('.space'));
  const flashEl = document.querySelector('.flash');
  const rm = S0.rm, ss = FK.ss;
  if (!S0.glOk || !cv) { S0.boot(Promise.resolve()); return; }

  let R;
  try { R = new T.WebGLRenderer({ canvas: cv, antialias: true, powerPreference: 'high-performance' }); }
  catch (e) { S0.boot(Promise.resolve()); return; }
  document.documentElement.classList.add('gl');

  R.outputEncoding = T.sRGBEncoding;
  R.toneMapping = T.ACESFilmicToneMapping;
  R.toneMappingExposure = 1.02;

  const S = new T.Scene(), C = new T.PerspectiveCamera(32, 1, 0.1, 400);
  const FOG = new T.Color('#EDF3F8'), FOG_D = 0.009;
  S.background = FOG.clone();
  S.fog = new T.FogExp2(FOG.clone(), FOG_D);

  const mobile = () => innerWidth < 760;
  const gov = { q: 1, ema: 12, n: 0 };
  const DPR = () => Math.max(1.0, Math.min(window.devicePixelRatio || 1, mobile() ? 1.5 : 2) * gov.q);

  const pm = new T.PMREMGenerator(R);
  S.environment = pm.fromScene(new T.RoomEnvironment(), 0.04).texture;
  pm.dispose();

  const sun = new T.DirectionalLight(0xffffff, 1.35);
  sun.position.set(-14, 18, 22);
  S.add(sun);
  S.add(new T.HemisphereLight(0xf6f9fc, 0xcad7e2, 0.92));
  const rim = new T.DirectionalLight(0xa9cbe3, 0.55);
  rim.position.set(14, 10, -24);
  S.add(rim);

  const sky = new T.Mesh(new T.SphereGeometry(320, 32, 16), new T.ShaderMaterial({
    side: T.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }',
    fragmentShader: [
      'varying vec3 vD;',
      'void main(){',
      '  float y = clamp(vD.y, -0.2, 1.0);',
      '  vec3 low = vec3(0.925, 0.950, 0.972);',
      '  vec3 mid = vec3(0.956, 0.971, 0.985);',
      '  vec3 top = vec3(0.848, 0.896, 0.938);',
      '  vec3 col = mix(low, mid, smoothstep(-0.04, 0.08, y));',
      '  col = mix(col, top, smoothstep(0.08, 0.65, y));',
      '  gl_FragColor = vec4(col, 1.0);',
      '}'].join('\n'),
  }));
  sky.frustumCulled = false; S.add(sky);

  const textCanvas = (w, h, draw) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.anisotropy = 8;
    t.userData.redraw = (...a) => { const g = c.getContext('2d'); g.clearRect(0, 0, w, h); draw(g, w, h, ...a); t.needsUpdate = true; };
    t.userData.redraw(); return t;
  };

  const gMat = new T.MeshStandardMaterial({ color: 0xedf3f8, roughness: 0.78, metalness: 0.02, envMapIntensity: 0.45 });
  FK.patch(gMat, 'p-frosted-grid', {}, '', [
    '{ vec2 g = abs(fract(vWP.xz / 4.5 - 0.5) - 0.5) / max(fwidth(vWP.xz / 4.5), vec2(0.0005));',
    '  float line = 1.0 - min(min(g.x, g.y), 1.0);',
    '  float dist = length(vWP.xz - cameraPosition.xz);',
    '  float fade = exp(-dist * 0.032);',
    '  outgoingLight = mix(outgoingLight, vec3(0.68, 0.76, 0.83), line * fade * 0.24); }'].join('\n'), true);
  const ground = new T.Mesh(new T.PlaneGeometry(500, 500).rotateX(-Math.PI / 2), gMat);
  S.add(ground);

  const pFrost = (() => {
    const SZ = 128, hgt = new Float32Array(SZ * SZ);
    for (let y = 0; y < SZ; y++) for (let x = 0; x < SZ; x++) {
      const u = x / SZ, v = y / SZ;
      hgt[y * SZ + x] = FK.fbm(u * 6, v * 6, 2.7, 3) * 0.7 + FK.noise(u * 22, v * 22, 6.1) * 0.3;
    }
    const nC = document.createElement('canvas'); nC.width = nC.height = SZ;
    const nX = nC.getContext('2d'), nImg = nX.createImageData(SZ, SZ);
    for (let y = 0; y < SZ; y++) for (let x = 0; x < SZ; x++) {
      const xm = (x - 1 + SZ) % SZ, xp = (x + 1) % SZ, ym = (y - 1 + SZ) % SZ, yp = (y + 1) % SZ;
      const dx = (hgt[y * SZ + xp] - hgt[y * SZ + xm]) * 1.4, dy = (hgt[yp * SZ + x] - hgt[ym * SZ + x]) * 1.4;
      const inv = 1 / Math.hypot(dx, dy, 1), i = (y * SZ + x) * 4;
      nImg.data[i] = Math.round((-dx * inv * 0.5 + 0.5) * 255);
      nImg.data[i + 1] = Math.round((-dy * inv * 0.5 + 0.5) * 255);
      nImg.data[i + 2] = Math.round((inv * 0.5 + 0.5) * 255);
      nImg.data[i + 3] = 255;
    }
    nX.putImageData(nImg, 0, 0);
    const nor = new T.CanvasTexture(nC); nor.wrapS = nor.wrapT = T.RepeatWrapping; nor.repeat.set(2, 2.5);
    return { nor };
  })();

  const ASP = 0.74, DEP = 0.34;
  const blockGeo = new T.RoundedBoxGeometry(ASP, 1, DEP, 6, 0.035);
  const etchDraw = {
    sky: (x, w, h) => {
      const L = 64;
      mono(x, 'HACKPHS \u00b7 OCTOBER 2026', 26, L, 96, '#1E3447', w - L * 2);
      disp(x, 'SKY SENTRY', 600, 92, L, 200, '#0F1B26', w - L * 2);
      rule(x, L, 246, w - L * 2);
      [['BEST USE OF', 'SOLANA'], ['BEST USE OF', 'TIGERDATA'], ['OVERALL', '5TH PLACE']].forEach((a, i) => {
        const y = 350 + i * 196;
        mono(x, a[0], 24, L, y, '#1E3447', w - L * 2);
        disp(x, a[1], 600, 70, L, y + 82, '#0F1B26', w - L * 2);
      });
      mono(x, '3 AWARDS \u00b7 SKY SENTRY', 22, L, 940, '#3A5266', w - L * 2);
    },
    echo: (x, w, h) => {
      const L = 64;
      mono(x, 'HACK CLUB HAVEN PRINCETON', 26, L, 96, '#1E3447', w - L * 2);
      mono(x, 'NOVEMBER 14 TO 15, 2026', 26, L, 140, '#1E3447', w - L * 2);
      disp(x, 'ECHO', 600, 118, L, 262, '#0F1B26', w - L * 2);
      rule(x, L, 306, w - L * 2);
      mono(x, 'AWARD', 24, L, 410, '#1E3447', w - L * 2);
      disp(x, '1ST', 700, 280, L - 10, 680, '#0F1B26', w - L * 2);
      disp(x, 'PRIZE,', 600, 70, L, 786, '#0F1B26', w - L * 2);
      disp(x, 'BEST OVERALL', 600, 70, L, 868, '#0F1B26', w - L * 2);
      mono(x, '1 AWARD \u00b7 ECHO', 22, L, 950, '#3A5266', w - L * 2);
    },
  };
  function fit(x, s, font, size, maxW) { let z = size; x.font = font(z); while (x.measureText(s).width > maxW && z > 10) { z -= 2; x.font = font(z); } }
  function etch(x, s, X, Y, col) { x.globalAlpha = 0.72; x.fillStyle = '#FFFFFF'; x.fillText(s, X + 1, Y + 1.5); x.globalAlpha = 1; x.fillStyle = col; x.fillText(s, X, Y); }
  function mono(x, s, size, X, Y, col, maxW) { x.letterSpacing = '4px'; fit(x, s, (z) => '500 ' + z + 'px "Geist Mono", ui-monospace, monospace', size * 1.3, maxW); etch(x, s, X, Y, col); x.letterSpacing = '0px'; }
  function disp(x, s, wt, size, X, Y, col, maxW) { x.letterSpacing = '-2px'; fit(x, s, (z) => wt + ' ' + z + 'px Unbounded, system-ui, sans-serif', size, maxW); etch(x, s, X, Y, col); x.letterSpacing = '0px'; }
  function rule(x, X, Y, w) { x.fillStyle = 'rgba(94,138,171,.55)'; x.fillRect(X, Y, w, 2); x.fillStyle = 'rgba(255,255,255,.9)'; x.fillRect(X, Y + 2, w, 2); }

  const crackTex = (seed, ox, oy) => textCanvas(624, 800, (x, w, h) => {
    const r = FK.rng(seed);
    const seg = (px, py, a, len, wdt, depth) => {
      const pts = [[px, py]]; let X = px, Y = py;
      for (let d = 0; d < len; d += 7) { a += (r() - 0.5) * 0.55; X += Math.cos(a) * 7; Y += Math.sin(a) * 7; pts.push([X, Y]); if (depth < 3 && r() < 0.045) seg(X, Y, a + (r() < 0.5 ? -1 : 1) * (0.45 + r() * 0.6), len * (0.3 + r() * 0.35), wdt * 0.7, depth + 1); }
      [['rgba(94,138,171,0.52)', wdt + 1.3, 1.1], ['rgba(255,255,255,0.95)', wdt, 0]].forEach(([c, lw, off]) => {
        x.strokeStyle = c; x.lineWidth = lw; x.lineJoin = x.lineCap = 'round'; x.beginPath();
        pts.forEach(([u, v], i) => (i ? x.lineTo(u + off, v + off) : x.moveTo(u + off, v + off))); x.stroke();
      });
    };
    const cx = ox * w, cy = oy * h;
    for (let i = 0; i < 6; i++) seg(cx, cy, (i / 6) * Math.PI * 2 + r() * 0.6, 150 + r() * 320, 1.5, 0);
  });
  const crackMat = (tex, ox, oy) => new T.ShaderMaterial({
    uniforms: { map: { value: tex }, uK: { value: 0 }, uA: { value: 1 }, uO: { value: new T.Vector2(ox, 1 - oy) } },
    transparent: true, depthTest: false, depthWrite: false, side: T.DoubleSide,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform sampler2D map; uniform float uK, uA; uniform vec2 uO; varying vec2 vUv; float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); } void main(){ vec4 c = texture2D(map, vUv); float d = distance(vUv * vec2(0.78, 1.0), uO * vec2(0.78, 1.0)) + h(floor(vUv * 48.0)) * 0.04; float m = smoothstep(uK * 0.95 + 0.03, uK * 0.95 - 0.03, d) * step(0.001, uK); gl_FragColor = vec4(c.rgb, c.a * m * uA); }',
  });
  const blobMat = (col, add) => new T.ShaderMaterial({
    uniforms: { uA: { value: add ? 0 : 0.16 }, uC: { value: new T.Color(col) } }, transparent: true, depthWrite: false, blending: add ? T.AdditiveBlending : T.NormalBlending,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform float uA; uniform vec3 uC; varying vec2 vUv; void main(){ vec2 c = (vUv - 0.5) * vec2(1.0, 1.6); float a = exp(-dot(c, c) * 11.0) * uA; gl_FragColor = vec4(uC * (' + (add ? 'a' : '1.0') + '), ' + (add ? '1.0' : 'a') + '); }',
  });

  const DEF = [
    { key: 'sky', rot: -0.20, crack: [0.8, 0.16], seed: 11 },
    { key: 'echo', rot: 0.20, crack: [0.2, 0.22], seed: 29 },
  ];
  const B = DEF.map((d, i) => {
    const group = new T.Group(), widen = new T.Group(); group.add(widen); S.add(group);
    const mat = new T.MeshPhysicalMaterial({
      color: new T.Color('#C4DCF0'),
      transparent: true, opacity: 0.88, depthWrite: false,
      roughness: 0.20, metalness: 0.03,
      normalMap: pFrost.nor, normalScale: new T.Vector2(0.28, 0.28),
      clearcoat: 0.65, clearcoatRoughness: 0.16,
      envMapIntensity: 1.05, reflectivity: 0.85,
    });
    const u = { uH: { value: 0 }, uDim: { value: 0 } };
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, u);
      sh.vertexShader = 'varying vec3 vOP;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vOP = position;');
      sh.fragmentShader = 'uniform float uH, uDim; varying vec3 vOP;\nfloat ph(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719))) * 43758.5453); }\nfloat pn(vec3 p){ vec3 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(mix(ph(i),ph(i+vec3(1,0,0)),f.x),mix(ph(i+vec3(0,1,0)),ph(i+vec3(1,1,0)),f.x),f.y),mix(mix(ph(i+vec3(0,0,1)),ph(i+vec3(1,0,1)),f.x),mix(ph(i+vec3(0,1,1)),ph(i+vec3(1,1,1)),f.x),f.y),f.z); }\n' + sh.fragmentShader.replace('#include <output_fragment>', [
        '{ vec3 nV = normalize(normal), vV = normalize(vViewPosition);',
        '  float ndv = clamp(abs(dot(nV, vV)), 0.0, 1.0);',
        '  float bevel = pow(1.0 - ndv, 1.85);',
        '  float schlick = 0.025 + 0.975 * pow(1.0 - ndv, 4.2);',
        '  float frost = pn(vOP * 5.0) * 0.6 + pn(vOP * 14.0) * 0.4;',
        '  vec3 bodyTint = mix(vec3(0.36, 0.54, 0.70), vec3(0.72, 0.83, 0.91), smoothstep(0.18, 0.84, frost));',
        '  vec3 deepEdge = vec3(0.12, 0.25, 0.39);',
        '  vec3 col = outgoingLight * 0.48 + bodyTint * (0.40 + 0.14 * uH);',
        '  col = mix(col, deepEdge, bevel * 0.56 * (1.0 - 0.15 * uH));',
        '  col += vec3(0.96, 0.985, 1.0) * (schlick * 0.60 + uH * 0.07);',
        '  col = mix(col, col * vec3(0.84, 0.87, 0.90) + vec3(0.14, 0.16, 0.18), uDim * 0.55);',
        '  outgoingLight = col;',
        '  diffuseColor.a = clamp(diffuseColor.a + bevel * 0.14 - uDim * 0.18, 0.62, 0.96); }',
        '#include <output_fragment>'].join('\n'));
    };
    mat.customProgramCacheKey = () => 'proj-ice-studio-v4';
    const mesh = new T.Mesh(blockGeo, mat); mesh.userData.i = i; mesh.renderOrder = 1; widen.add(mesh);
    const etchT = textCanvas(624, 800, (x, w, h) => { x.save(); x.scale(w / 780, h / 1000); etchDraw[d.key](x, 780, 1000); x.restore(); });
    const text = new T.Mesh(new T.PlaneGeometry(0.64, 0.82), new T.MeshBasicMaterial({ map: etchT, transparent: true, depthTest: false, depthWrite: false, fog: false, opacity: 0.94 }));
    text.position.z = 0.02; text.renderOrder = 4; group.add(text);
    const ck = crackMat(crackTex(d.seed, d.crack[0], d.crack[1]), d.crack[0], d.crack[1]);
    const crack = new T.Mesh(new T.PlaneGeometry(ASP * 0.97, 0.97), ck); crack.position.z = DEP / 2 - 0.012; crack.renderOrder = 5; widen.add(crack);
    const light = new T.PointLight(0xA9CBE3, 1.2, 6, 2); group.add(light);
    const shadow = new T.Mesh(new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), blobMat('#5E8AAB', false)); S.add(shadow);
    const pool = new T.Mesh(new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), blobMat('#A9CBE3', true)); pool.position.y = 0.01; S.add(pool);
    return { i, d, u, group, widen, mesh, mat, text, etchT, crack: ck, light, shadow, pool, base: V(0, 0, 0), sc: 1, st: { h: 0, dim: 0 }, href: links[i].getAttribute('href'), ph: i * 2.1 };
  });

  const D = 13.03, PITCH0 = -0.068;
  let W = 1, H = 1, FOV = 32, scrollK = 0;
  const LOOK = V(0, 0, 0), LC = new T.PerspectiveCamera(32, 1, 0.1, 400);
  const camPose = (k, cam) => { const pitch = PITCH0 - 0.05 * k; cam.position.set(0, 1.5 + 0.55 * k, 13 - 4.5 * k); LOOK.set(0, Math.sin(pitch), -Math.cos(pitch)).multiplyScalar(D).add(cam.position); cam.lookAt(LOOK); cam.updateMatrixWorld(); };
  const tmpF = V(0, 0, 0);
  const toPlane = (cam, cx, cy, out) => { const f = cam.getWorldDirection(tmpF), dir = V(cx / W * 2 - 1, -(cy / H * 2 - 1), 0.5).unproject(cam).sub(cam.position).normalize(); return out.copy(cam.position).addScaledVector(dir, D / dir.dot(f)); };
  const sizeOf = (s) => Math.max(40, Math.min(s.height * 0.86, s.width * 0.9 / (ASP * 1.12))) * 2 * D * Math.tan(T.MathUtils.degToRad(FOV) / 2) / H;
  const place = (cam) => { B.forEach((b, i) => { const s = spaces[i].getBoundingClientRect(); toPlane(cam, s.left + s.width / 2, s.top + s.height / 2, b.base); b.sc = sizeOf(s); b.light.distance = b.sc * 2.6; }); };
  const layout = () => {
    W = Math.max(1, cv.clientWidth); H = Math.max(1, cv.clientHeight);
    R.setPixelRatio(DPR()); R.setSize(W, H, false);
    FOV = W / H < 0.9 ? 40 : 32; [C, LC].forEach((c) => { c.fov = FOV; c.aspect = W / H; c.updateProjectionMatrix(); });
    camPose(0, LC); let low = Infinity, avg = 0; const pts = [];
    B.forEach((b, i) => { const s = spaces[i].getBoundingClientRect(), p = toPlane(LC, s.left + s.width / 2, s.top + scrollY + s.height / 2, V(0, 0, 0)), sc = sizeOf(s); pts.push([p, sc]); low = Math.min(low, p.y - sc / 2); avg += sc / B.length; });
    const gy = low - avg * 0.42; ground.position.y = gy;
    B.forEach((b, i) => { [b.shadow, b.pool].forEach((m, j) => { m.position.set(pts[i][0].x, gy + 0.01 + j * 0.01, pts[i][0].z); m.scale.set(pts[i][1] * 1.5, 1, pts[i][1] * 0.9); }); });
  };
  window.addEventListener('resize', layout);
  if (window.ResizeObserver) new ResizeObserver(() => layout()).observe(document.body);
  layout();

  let rayHit = -1, linkHover = -1, focusI = -1, active = -2;
  const ray = new T.Raycaster(), ndc = new T.Vector2();
  const setActive = (i) => {
    if (i === active) return; active = i;
    if (i >= 0) S0.click && S0.click();
    B.forEach((b, j) => {
      gsap.to(b.st, { h: j === i ? 1 : 0, dim: i >= 0 && j !== i ? 1 : 0, duration: rm ? 0 : (j === i ? 0.9 : 0.7), ease: 'expo.out', overwrite: true });
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
  stage.addEventListener('click', (e) => { if (rm || flying || rayHit < 0 || e.target.closest('a')) return; fly(rayHit); });

  let flying = false; const fl = { p: 0, i: -1, from: V(0, 0, 0), look: V(0, 0, 0), end: V(0, 0, 0), aim: V(0, 0, 0) };
  function fly(i) {
    if (flying) return; flying = true; setActive(i);
    const b = B[i]; fl.i = i; fl.from.copy(C.position); fl.look.copy(LOOK);
    const dir = b.group.position.clone().sub(C.position).normalize();
    fl.end.copy(b.group.position).addScaledVector(dir, b.sc * DEP * 0.2); fl.aim.copy(b.group.position).addScaledVector(dir, 8);
    const o = { p: 0 };
    gsap.to(o, { p: 1, duration: 0.85, ease: 'power3.inOut', onUpdate: () => { fl.p = o.p; }, onComplete: () => { location.href = b.href; } });
    if (flashEl) gsap.to(flashEl, { opacity: 1, duration: 0.35, delay: 0.52, ease: 'power3.in' });
  }
  window.addEventListener('pageshow', (e) => { if (!e.persisted) return; flying = false; fl.p = 0; fl.i = -1; if (flashEl) gsap.set(flashEl, { opacity: 0 }); active = -2; setActive(-1); });

  let visible = !document.hidden, last = 0; const t0 = performance.now();
  document.addEventListener('visibilitychange', () => { visible = !document.hidden; });
  const mouse = new T.Vector2(), mt = new T.Vector2();
  window.addEventListener('pointermove', (e) => { if (e.pointerType !== 'touch') mt.set(e.clientX / innerWidth * 2 - 1, e.clientY / innerHeight * 2 - 1); }, { passive: true });
  const look = V(0, 0, 0), tmp = V(0, 0, 0);

  function frame(now) {
    requestAnimationFrame(frame);
    if (!visible) { last = now; return; }
    if (!rm && last) {
      if (++gov.n > 30) {
        gov.ema = gov.ema * 0.9 + Math.min(now - last, 80) * 0.1;
        if (gov.n % 30 === 0) {
          const minQ = Math.min(1, 1 / Math.max(1, Math.min(window.devicePixelRatio || 1, 2)));
          const q = gov.ema > 24 ? Math.max(minQ, gov.q - 0.1) : gov.ema < 16 ? Math.min(1, gov.q + 0.08) : gov.q;
          if (q !== gov.q) { gov.q = q; layout(); }
        }
      }
    }
    const dt = Math.min(0.05, Math.max(0.0005, (now - (last || now)) / 1000)); last = now;
    const t = rm ? 0 : (now - t0) / 1000, idle = rm ? 0 : 1;
    mouse.lerp(mt, 1 - Math.exp(-dt * 3.8));

    if (flying) {
      const p = fl.p, e2 = ss(0, 0.7, p);
      C.position.lerpVectors(fl.from, fl.end, p);
      look.lerpVectors(fl.look, fl.aim, e2); C.lookAt(look);
      C.fov = FOV * (1 - 0.10 * ss(0, 0.5, p) + 0.65 * Math.pow(ss(0.45, 1, p), 2)); C.updateProjectionMatrix();
      S.fog.density = FOG_D + (fl.i === 0 ? 0.05 : 0.02) * ss(0.4, 1, p);
    } else {
      scrollK = Math.min(2.5, Math.max(0, scrollY / Math.max(1, innerHeight)));
      camPose(scrollK, C); place(C);
      C.position.add(tmp.set(mouse.x * 0.35 * idle + Math.sin(t * 0.25) * 0.04 * idle, -mouse.y * 0.20 * idle + Math.sin(t * 0.35) * 0.03 * idle, 0));
      C.lookAt(LOOK); S.fog.density = FOG_D;
    }
    sky.position.copy(C.position);

    B.forEach((b) => {
      const { h, dim } = b.st, fp = flying && fl.i === b.i ? fl.p : 0, fo = flying && fl.i !== b.i ? ss(0, 0.5, fl.p) : 0;
      b.group.position.copy(b.base); b.group.position.y += Math.sin(t * 0.5 + b.ph) * 0.05 * b.sc * idle; b.group.position.z -= dim * 0.45 * b.sc;
      b.group.rotation.set(Math.sin(t * 0.35 + b.ph) * 0.02 * idle, b.d.rot * (1 - 0.55 * h) + Math.sin(t * 0.2 + b.ph) * 0.06 * idle + mouse.x * 0.12 * h * idle, Math.sin(t * 0.28 + b.ph) * 0.012 * idle);
      b.group.scale.setScalar(b.sc * (1 - 0.035 * dim));
      b.widen.scale.x = 1 + 0.10 * h;
      b.light.intensity = (1.0 + 3.5 * h - 0.6 * dim) * (b.sc / 3); b.light.position.set(0, -0.1, 0);
      b.text.material.opacity = (0.94 - 0.48 * dim) * (1 - ss(0.45, 0.75, fp)) * (1 - fo);
      b.crack.uniforms.uK.value = h; b.crack.uniforms.uA.value = (1 - dim) * (1 - fo);
      b.mat.envMapIntensity = 0.95 + 0.35 * h - 0.35 * dim; b.u.uH.value = h; b.u.uDim.value = dim;
      const near = 1 - ss(0.1, 0.6, scrollK);
      b.shadow.material.uniforms.uA.value = (0.16 + 0.05 * h - 0.05 * dim) * near;
      b.pool.material.uniforms.uA.value = (0.04 + 0.25 * h) * near;
    });
    R.render(S, C);
  }

  if (document.fonts) {
    Promise.all([document.fonts.load('600 64px Unbounded'), document.fonts.load('700 64px Unbounded'), document.fonts.load('500 24px "Geist Mono"')]).catch(() => {})
      .then(() => { B.forEach((b) => b.etchT.userData.redraw()); layout(); });
  }
  window.__proj = { S, C, B, ground, R, sky, gov };
  S0.boot(Promise.resolve(), () => { layout(); });
  requestAnimationFrame(frame);
})();
