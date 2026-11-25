/* SKY SENTRY: two takes of the same departure. Built in three.js from a NASA 747SP model (public domain)
   and generated geometry. window.SkyFilm(canvas, { base, sub, title, onStatus }) */
(function () {
  const T = THREE, FK = window.FK;
  const V = (x, y, z) => new T.Vector3(x, y, z);
  const ss = FK.ss, lerp = FK.lerp, clamp = FK.clamp;
  const TWR = V(1250, 0, 330), CAB = 46.3; // tower base and cab floor height
  const BIRDS0 = V(1960, 0, -95);         // where the flock feeds, beside runway 27
  const HOLD = 40;                          // aircraft holding point (x)

  function SkyFilm(canvas, opts) {
    const self = this; opts = opts || {};
    this.cv = canvas; this.p = 0; this.ps = 0; this.dead = false; this.opts = opts;
    const R = this.renderer = new T.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    R.outputEncoding = T.LinearEncoding; R.toneMapping = T.NoToneMapping;
    R.shadowMap.enabled = true; R.shadowMap.type = T.PCFSoftShadowMap;
    const S = this.scene = new T.Scene();
    const C = this.camera = new T.PerspectiveCamera(40, 16 / 9, 0.05, 40000);
    this.post = FK.composer(R, S, C, [0.45, 0.5, 0.92]);
    this.grade = this.post.grade.uniforms; this.grade.uGrain.value = 0.035; this.grade.uVig.value = 0.55; this.grade.uCA.value = 0.0012; this.grade.uExp.value = 0.5;
    this.size = () => { const r = canvas.getBoundingClientRect(); return [Math.max(2, r.width | 0), Math.max(2, r.height | 0)]; };
    this.gov = FK.governor(R, this.post.c, this.size);
    this.onResize = () => { const s = self.size(); C.aspect = s[0] / s[1]; C.updateProjectionMatrix(); self.gov.apply(); self.grade.uRes.value.set(s[0], s[1]); self.post.bloom.resolution.set(s[0] / 2, s[1] / 2); };
    window.addEventListener('resize', this.onResize); this.onResize();
    this.mt = new T.Vector2(); this.mouse = new T.Vector2();
    this.onMove = (e) => { self.mt.set(e.clientX / innerWidth * 2 - 1, e.clientY / innerHeight * 2 - 1); };
    window.addEventListener('pointermove', this.onMove, { passive: true });
    this.sub = opts.sub; this.title = opts.title; this.status = opts.onStatus || (() => {});
    this.base = opts.base || 'assets/'; this.urls = opts.urls || { core: this.base + 'sky-core.json', audio: this.base + 'sky-audio.json' };
    this.status('Loading the airfield');
    this.t0 = performance.now();
    Promise.all([FK.json(this.urls.core)]).then(([d]) => self.build(d)).catch((e) => { console.error(e); self.status('The film failed to load. Scroll on to read about Sky Sentry.'); });
    this.loop = this.loop.bind(this); this.raf = requestAnimationFrame(this.loop);
  }

  // ---------------- textures drawn in code ----------------
  const cnv = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return c; };
  const noiseFill = (x, w, h, base, amp, n, sz) => {
    x.fillStyle = base; x.fillRect(0, 0, w, h);
    for (let i = 0; i < n; i++) { const v = (Math.random() - 0.5) * amp; x.fillStyle = v > 0 ? `rgba(255,255,255,${v})` : `rgba(0,0,0,${-v})`; const s = Math.random() * sz + 1; x.fillRect(Math.random() * w, Math.random() * h, s, s); }
  };
  function runwayTile() { // 45 m wide x 60 m long; dash 36 m + gap 24 m
    return cnv(512, 682, (x, w, h) => {
      x.clearRect(0, 0, w, h); for (let i = 0; i < 30; i++) { x.fillStyle = `rgba(0,0,0,${Math.random() * 0.18})`; x.fillRect(w * 0.3 + Math.random() * w * 0.4, Math.random() * h, 4 + Math.random() * 22, Math.random() * 300); }
      x.fillStyle = 'rgba(236,234,226,.92)'; const px = w / 45;
      x.fillRect(0.6 * px, 0, 0.9 * px, h); x.fillRect(w - 1.5 * px, 0, 0.9 * px, h);
      x.fillRect(w / 2 - 0.45 * px, 0, 0.9 * px, 36 * (h / 60));
    });
  }
  function thresholdTex() { // 45 m x 450 m, aircraft rolls toward +v
    return cnv(512, 5120, (x, w, h) => {
      x.clearRect(0, 0, w, h);
      const px = w / 45, m = h / 450, Y = (v) => h - v * m; // v metres from threshold
      x.fillStyle = 'rgba(236,234,226,.92)';
      x.fillRect(0.6 * px, 0, 0.9 * px, h); x.fillRect(w - 1.5 * px, 0, 0.9 * px, h);
      for (let i = 0; i < 12; i++) { const cx = (i < 6 ? 3 + i * 3 : 45 - 3 - (11 - i) * 3 - 1.8); x.fillRect(cx * px, Y(36), 1.8 * px, 30 * m); }
      x.save(); x.translate(w / 2, Y(42)); x.scale(1, -1); x.font = `900 ${9 * m * 1.25}px "Arial Narrow", Arial, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'top';
      x.scale(1, 1); x.fillText('27', 0, -9 * m * 1.05); x.restore();
      for (let v = 60; v < 450; v += 60) x.fillRect(w / 2 - 0.45 * px, Y(v + 36), 0.9 * px, 36 * m);
      for (const v of [150, 300]) for (const sg of [-1, 1]) for (let k = 0; k < 3; k++) x.fillRect(w / 2 + sg * (5 + k * 1.6) * px - (sg < 0 ? 1 : 0) * 0.9 * px, Y(v + 22.5), 0.9 * px, 22.5 * m);
      for (const sg of [-1, 1]) x.fillRect(w / 2 + sg * 6 * px - (sg < 0 ? 4 : 0) * px, Y(400 + 45), 4 * px, 45 * m);
      for (let i = 0; i < 60; i++) { x.fillStyle = `rgba(10,10,10,${0.05 + Math.random() * 0.12})`; x.fillRect(w / 2 + (Math.random() - 0.5) * 14 * px, Y(330 + Math.random() * 110), 2 + Math.random() * 8, 40 + Math.random() * 260); }
    });
  }
  function taxiTex() {
    return cnv(256, 256, (x, w, h) => { noiseFill(x, w, h, '#45464a', 0.1, 6000, 2); x.fillStyle = '#d8b52a'; x.fillRect(w / 2 - 3, 0, 6, h); });
  }
  function puff() {
    return cnv(128, 128, (x, w, h) => {
      for (let i = 0; i < 26; i++) { const r = 14 + Math.random() * 30, cx = 64 + (Math.random() - 0.5) * 50, cy = 64 + (Math.random() - 0.5) * 50; const g = x.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, 'rgba(255,255,255,.22)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); }
      const g = x.createRadialGradient(64, 64, 30, 64, 64, 64); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,1)'); x.globalCompositeOperation = 'destination-out'; x.fillStyle = g; x.fillRect(0, 0, w, h);
    });
  }
  function windowsTex(cols, rows, lit) {
    return cnv(512, 256, (x, w, h) => {
      x.fillStyle = '#1b2028'; x.fillRect(0, 0, w, h);
      const cw = w / cols, rh = h / rows;
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) { const on = Math.random() < lit; x.fillStyle = on ? `rgba(255,${200 + Math.random() * 40},${130 + Math.random() * 60},${0.55 + Math.random() * 0.4})` : 'rgba(70,90,110,.35)'; x.fillRect(i * cw + 2, j * rh + 3, cw - 4, rh - 6); }
    });
  }
  const paved = (m) => { m.polygonOffset = true; m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -4; return m; };
  const tx = (c, srgb, rep) => { const t = new T.CanvasTexture(c); if (srgb !== false) t.encoding = T.sRGBEncoding; t.anisotropy = 16; t.wrapS = t.wrapT = T.RepeatWrapping; if (rep) t.repeat.set(rep[0], rep[1]); return t; };

  // ---------------- people, gear, birds (generated) ----------------
  function person(cloth, skin) {
    const g = new T.Group(), M = (c, r) => new T.MeshStandardMaterial({ color: c, roughness: r || 0.85, envMapIntensity: 0.15 });
    const cm = M(cloth, 0.9), sk = M(skin, 0.6), dark = M(0x121214, 0.5);
    const add = (geo, m, p, r) => { const o = new T.Mesh(geo, m); o.position.set(p[0], p[1], p[2]); if (r) o.rotation.set(r[0], r[1], r[2]); o.castShadow = true; g.add(o); return o; };
    add(new T.CapsuleGeometry(0.17, 0.36, 6, 14), cm, [0, 0.72, 0]).scale.set(1.25, 1, 0.75);
    add(new T.CapsuleGeometry(0.07, 0.07, 4, 10), sk, [0, 1.06, 0]);
    add(new T.SphereGeometry(0.105, 24, 18), sk, [0, 1.2, 0.01]).scale.set(0.92, 1.08, 1.0);
    add(new T.SphereGeometry(0.108, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.62), M(0x0d0a08, 0.95), [0, 1.215, 0.015]).scale.set(0.95, 1.05, 1.03);
    add(new T.TorusGeometry(0.115, 0.012, 6, 24, Math.PI), dark, [0, 1.23, 0], [0, Math.PI / 2, 0]);
    for (const s of [-1, 1]) {
      add(new T.CylinderGeometry(0.045, 0.045, 0.03, 16), dark, [s * 0.112, 1.2, 0], [0, 0, Math.PI / 2]);
      add(new T.CapsuleGeometry(0.055, 0.26, 4, 10), cm, [s * 0.25, 0.8, -0.06], [0.5, 0, s * 0.12]);
      add(new T.CapsuleGeometry(0.048, 0.24, 4, 10), cm, [s * 0.27, 0.62, -0.24], [1.45, 0, 0]);
      add(new T.CapsuleGeometry(0.075, 0.34, 4, 10), M(0x23262c), [s * 0.1, 0.48, -0.22], [Math.PI / 2, 0, 0]);
      add(new T.CapsuleGeometry(0.065, 0.36, 4, 10), M(0x23262c), [s * 0.1, 0.22, -0.42], [0.1, 0, 0]);
    }
    add(new T.CylinderGeometry(0.008, 0.008, 0.1, 6), dark, [0.1, 1.15, -0.07], [1.2, 0, 0.4]);
    // chair
    const ch = M(0x2b2d31, 0.7);
    add(new T.BoxGeometry(0.52, 0.08, 0.5), ch, [0, 0.42, -0.05]); add(new T.BoxGeometry(0.5, 0.62, 0.07), ch, [0, 0.78, 0.22], [-0.1, 0, 0]);
    add(new T.CylinderGeometry(0.03, 0.03, 0.38, 8), M(0x111111, 0.4), [0, 0.2, 0]);
    return g;
  }
  function gear(plane) {
    const g = new T.Group(), rub = new T.MeshStandardMaterial({ color: 0x151515, roughness: 0.8 }), st = new T.MeshStandardMaterial({ color: 0x9a9ea4, metalness: 0.8, roughness: 0.35 });
    const wheel = new T.CylinderGeometry(0.62, 0.62, 0.45, 24); wheel.rotateX(Math.PI / 2);
    const leg = (x, z, h, n) => {
      const L = new T.Mesh(new T.CylinderGeometry(0.12, 0.14, h, 10), st); L.position.set(x, 0.62 + h / 2, z); g.add(L);
      for (let i = 0; i < n; i++) { const w = new T.Mesh(wheel, rub); w.position.set(x + (n > 2 ? (i < 2 ? 0.75 : -0.75) : 0), 0.62, z + (i % 2 ? 0.45 : -0.45)); w.castShadow = true; g.add(w); }
    };
    leg(22.5, 0, 1.6, 2);
    for (const z of [-1.9, 1.9]) leg(-4.2, z, 1.6, 4);
    for (const z of [-5.6, 5.6]) leg(-1.8, z, 1.3, 4);
    g.position.y = -1.3; plane.add(g); return g;
  }
  function goose() {
    const g = new T.Group();
    const body = new T.MeshStandardMaterial({ color: 0x5a4a3a, roughness: 0.9 }), black = new T.MeshStandardMaterial({ color: 0x0f0e0d, roughness: 0.8 }), pale = new T.MeshStandardMaterial({ color: 0xa89f90, roughness: 0.9 });
    const add = (geo, m, p, r, s) => { const o = new T.Mesh(geo, m); o.position.set(...p); if (r) o.rotation.set(...r); if (s) o.scale.set(...s); o.castShadow = true; g.add(o); return o; };
    add(new T.SphereGeometry(0.2, 16, 12), body, [0, 0, 0], null, [2.2, 0.95, 1]);
    add(new T.SphereGeometry(0.16, 12, 10), pale, [0.05, -0.06, 0], null, [1.8, 0.7, 0.85]);
    add(new T.ConeGeometry(0.12, 0.3, 10), black, [-0.52, 0.02, 0], [0, 0, Math.PI / 2]);
    const neck = new T.Group(); neck.position.set(0.36, 0.08, 0); g.add(neck);
    const n = new T.Mesh(new T.CapsuleGeometry(0.05, 0.42, 4, 8), black); n.position.set(0.0, 0.22, 0); n.castShadow = true; neck.add(n);
    const h = new T.Mesh(new T.SphereGeometry(0.075, 12, 10), black); h.scale.set(1.5, 1, 0.9); h.position.set(0.05, 0.47, 0); neck.add(h);
    const ch = new T.Mesh(new T.SphereGeometry(0.05, 10, 8), pale); ch.position.set(0.04, 0.45, 0.0); ch.scale.set(1.2, 0.9, 1.25); neck.add(ch);
    const bill = new T.Mesh(new T.ConeGeometry(0.03, 0.12, 8), black); bill.rotation.z = -Math.PI / 2; bill.position.set(0.18, 0.46, 0); neck.add(bill);
    const wingGeo = new T.BufferGeometry();
    const wv = new Float32Array([0, 0, 0, 0.24, 0, 0.05, 0.18, 0, 0.55, 0.05, 0, 0.82, -0.16, 0, 0.72, -0.22, 0, 0.3, -0.12, 0, 0]);
    wingGeo.setAttribute('position', new T.BufferAttribute(wv, 3)); wingGeo.setIndex([0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 5, 0, 5, 6]); wingGeo.computeVertexNormals();
    const wm = new T.MeshStandardMaterial({ color: 0x4d4135, roughness: 0.9, side: T.DoubleSide });
    const wings = [];
    for (const s of [-1, 1]) { const w = new T.Mesh(wingGeo, wm); w.scale.set(1.1, 1, s * 1.15); w.position.set(0.05, 0.08, s * 0.12); w.castShadow = true; g.add(w); wings.push(w); }
    g.userData = { neck, wings };
    return g;
  }

  // ---------------- particles: fire and smoke ----------------
  function Particles(n, additive, tex) {
    const g = new T.BufferGeometry();
    this.pos = new Float32Array(n * 3); this.col = new Float32Array(n * 4); this.size = new Float32Array(n);
    g.setAttribute('position', new T.BufferAttribute(this.pos, 3)); g.setAttribute('color', new T.BufferAttribute(this.col, 4)); g.setAttribute('size', new T.BufferAttribute(this.size, 1));
    this.mat = new T.ShaderMaterial({
      uniforms: { map: { value: tex }, uScale: { value: 600 } }, transparent: true, depthWrite: false, blending: additive ? T.AdditiveBlending : T.NormalBlending,
      vertexShader: 'attribute float size; attribute vec4 color; varying vec4 vC; uniform float uScale; void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = size * uScale / -mv.z; gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform sampler2D map; varying vec4 vC; void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vC.rgb * t.rgb, vC.a * t.a); }',
    });
    this.pts = new T.Points(g, this.mat); this.pts.frustumCulled = false; this.g = g;
    this.n = n; this.list = []; this.add = (o) => { if (this.list.length < n) this.list.push(o); };
    this.clear = () => { this.list.length = 0; };
    this.update = (dt, kind) => {
      const L = this.list;
      for (let i = L.length - 1; i >= 0; i--) { const q = L[i]; q.age += dt; if (q.age > q.life) { L.splice(i, 1); continue; } q.p.addScaledVector(q.v, dt); q.v.multiplyScalar(1 - dt * (q.drag || 0.6)); q.v.y += (q.lift || 0) * dt; }
      for (let i = 0; i < n; i++) {
        const q = L[i];
        if (!q) { this.size[i] = 0; this.col[i * 4 + 3] = 0; continue; }
        const k = q.age / q.life; this.pos.set([q.p.x, q.p.y, q.p.z], i * 3);
        this.size[i] = q.s0 + (q.s1 - q.s0) * Math.sqrt(k);
        if (kind === 'fire') { const h = 1 - k; this.col.set([1.6 * h + 0.25, 0.55 * h * h + 0.05, 0.08 * h * h * h, (1 - k) * (q.a || 0.6)], i * 4); }
        else { const c = q.c || 0.06; this.col.set([c, c * 0.96, c * 0.92, Math.min(1, k * 6) * (1 - k) * (q.a || 0.85)], i * 4); }
      }
      this.g.attributes.position.needsUpdate = true; this.g.attributes.color.needsUpdate = true; this.g.attributes.size.needsUpdate = true;
    };
  }

  // ---------------- world ----------------
  SkyFilm.prototype.build = function (d) {
    if (this.dead) return;
    const self = this, S = this.scene, R = this.renderer; this.data = d;
    // sky and sun: low in the west, ahead of the departing aircraft
    const sunDir = this.sunDir = V(0.93, 0.055, -0.36).normalize();
    const pm = new T.PMREMGenerator(R);
    { const hd = new T.RGBELoader().parse(FK.b64ab(d.hdr)), W = hd.width, H = hd.height, src = hd.data, ch = src.length / (W * H);
      // find the sun in the image, then turn the panorama so it lands at sunDir's azimuth
      let best = -1, bx = 0, by = 0; const lum = (i) => { const f = hd.type === T.HalfFloatType ? T.DataUtils.fromHalfFloat : (v) => v; return f(src[i]) + f(src[i + 1]) + f(src[i + 2]); };
      for (let y = 0; y < H / 2; y += 2) for (let x = 0; x < W; x += 2) { const l = lum((y * W + x) * ch); if (l > best) { best = l; bx = x; by = y; } }
      const az = Math.atan2(sunDir.z, sunDir.x), uWant = ((-az / (2 * Math.PI) + 0.5) % 1 + 1) % 1 * W, shift = Math.round(uWant - bx);
      const out = new src.constructor(src.length);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const nx = ((x + shift) % W + W) % W; for (let c = 0; c < ch; c++) out[(y * W + nx) * ch + c] = src[(y * W + x) * ch + c]; }
      const el = (0.5 - by / H) * Math.PI; sunDir.y = Math.max(0.04, Math.sin(el)); sunDir.normalize();
      const tex = new T.DataTexture(out, W, H, hd.format, hd.type); tex.mapping = T.EquirectangularReflectionMapping; tex.minFilter = tex.magFilter = T.LinearFilter; tex.flipY = true; tex.needsUpdate = true;
      S.background = tex; S.environment = pm.fromEquirectangular(tex).texture; this.hdrBg = tex; }
    S.fog = new T.FogExp2(0xc79a7c, 0.00012);
    const sun = this.sun = new T.DirectionalLight(0xff9c55, 3.0); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera; sc.left = -90; sc.right = 90; sc.top = 90; sc.bottom = -90; sc.near = 10; sc.far = 1200; sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.6;
    S.add(sun); S.add(sun.target);
    S.add(new T.HemisphereLight(0x8aa0c8, 0x4a3a26, 0.38));

    // ground with fbm colour variation and mowing stripes near the runway
    const gTex = FK.tex(d.tex.aerial_grass_rock_diff, true, [60000 / 90, 60000 / 90]), gNor = FK.tex(d.tex.aerial_grass_rock_nor_gl, false, [60000 / 90, 60000 / 90]);
    const gm = new T.MeshStandardMaterial({ color: 0xffffff, map: gTex, normalMap: gNor, roughness: 0.97 });
    FK.patch(gm, 'ground', {}, [
      'float gh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
      'float gn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(gh(i), gh(i+vec2(1,0)), f.x), mix(gh(i+vec2(0,1)), gh(i+vec2(1,1)), f.x), f.y); }',
      'float gf(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 6; i++){ s += a*gn(p); p *= 2.02; a *= 0.5; } return s; }'].join('\n'),
      ['{ vec2 q = vWP.xz;',
       ' float a = gf(q * 0.004), b = gf(q * 0.03 + 7.0), c = gn(q * 0.9) * 0.5 + gn(q * 3.7) * 0.5;',
       ' vec3 g1 = vec3(0.13, 0.15, 0.06), g2 = vec3(0.25, 0.24, 0.10), dry = vec3(0.40, 0.33, 0.18), dirt = vec3(0.28, 0.22, 0.15);',
       ' vec3 col = mix(g1, g2, smoothstep(0.3, 0.7, a));',
       ' col = mix(col, dry, smoothstep(0.55, 0.85, b) * 0.6);',
       ' col *= 0.82 + 0.36 * c;',
       ' float near = 1.0 - smoothstep(250.0, 420.0, abs(q.y));',
       ' col *= 1.0 + near * 0.07 * sign(sin(q.y * 0.26));',
       ' col = mix(col, dirt, smoothstep(0.78, 0.95, gf(q * 0.012 + 3.0)) * 0.5);',
       ' outgoingLight *= mix(vec3(1.0), col * 3.4, 0.7); }'].join('\n'), true);
    const gg = new T.PlaneGeometry(60000, 60000, 1, 1).rotateX(-Math.PI / 2); gg.setAttribute('uv2', gg.attributes.uv); const ground = new T.Mesh(gg, gm); ground.receiveShadow = true; S.add(ground);

    // runway 27 (3000 x 45 m), threshold section + repeating tiles
    const asp = FK.tex(d.tex.asphalt_02_diff, true, [3100 / 12, 45 / 12]), aspN = FK.tex(d.tex.asphalt_02_nor_gl, false, [3100 / 12, 45 / 12]);
    const asphalt = new T.Mesh(new T.PlaneGeometry(3100, 45).rotateX(-Math.PI / 2), paved(new T.MeshStandardMaterial({ map: asp, normalMap: aspN, color: 0x8a8a8c, roughness: 0.9 })));
    asphalt.position.set(1500, 0.03, 0); asphalt.receiveShadow = true; S.add(asphalt);
    const thr = new T.Mesh(new T.PlaneGeometry(45, 450).rotateX(-Math.PI / 2).rotateY(-Math.PI / 2), paved(new T.MeshStandardMaterial({ map: tx(thresholdTex()), roughness: 0.85, transparent: true, depthWrite: false })));
    thr.position.set(225, 0.07, 0); thr.receiveShadow = true; S.add(thr);
    const tile = tx(runwayTile(), true, [1, 2550 / 60]);
    const rw = new T.Mesh(new T.PlaneGeometry(45, 2550).rotateX(-Math.PI / 2).rotateY(-Math.PI / 2), paved(new T.MeshStandardMaterial({ map: tile, roughness: 0.85, transparent: true, depthWrite: false })));
    rw.position.set(450 + 1275, 0.07, 0); rw.receiveShadow = true; S.add(rw);
    const shoulder = paved(new T.MeshStandardMaterial({ color: 0x55534c, roughness: 0.95 }));
    for (const z of [-26, 26]) { const sh = new T.Mesh(new T.PlaneGeometry(3100, 7).rotateX(-Math.PI / 2), shoulder); sh.position.set(1500, 0.03, z); sh.receiveShadow = true; S.add(sh); }
    const taxM = paved(new T.MeshStandardMaterial({ map: tx(taxiTex(), true, [3300 / 23, 1]), roughness: 0.9 }));
    const taxi = new T.Mesh(new T.PlaneGeometry(3300, 23).rotateX(-Math.PI / 2), taxM); taxi.position.set(1550, 0.04, 190); taxi.receiveShadow = true; S.add(taxi);
    for (const x of [20, 900, 1800, 2950]) { const c = new T.Mesh(new T.PlaneGeometry(23, 170).rotateX(-Math.PI / 2), paved(new T.MeshStandardMaterial({ map: tx(taxiTex(), true, [1, 7]), roughness: 0.9 }))); c.position.set(x, 0.045, 105); c.receiveShadow = true; S.add(c); }
    const apron = new T.Mesh(new T.PlaneGeometry(1500, 260).rotateX(-Math.PI / 2), paved(new T.MeshStandardMaterial({ color: 0x8b8a86, roughness: 0.92 }))); apron.position.set(1700, 0.035, 340); apron.receiveShadow = true; S.add(apron);

    // lights: edge (white), threshold (green), end (red), approach
    const lamp = (col, inten) => new T.MeshBasicMaterial({ color: new T.Color(col).multiplyScalar(inten) });
    const addLights = (list, col, inten, r) => { const m = new T.InstancedMesh(new T.SphereGeometry(r || 0.22, 8, 6), lamp(col, inten), list.length); const m4 = new T.Matrix4(); list.forEach((p, i) => { m4.makeTranslation(p[0], p[1], p[2]); m.setMatrixAt(i, m4); }); S.add(m); return m; };
    const edge = []; for (let x = 0; x <= 3000; x += 60) for (const z of [-23.5, 23.5]) edge.push([x, 0.4, z]); addLights(edge, 0xfff1d6, 6);
    const th = []; for (let z = -22; z <= 22; z += 3) th.push([-1, 0.35, z]); addLights(th, 0x3cff7a, 8);
    const en = []; for (let z = -22; z <= 22; z += 3) en.push([3001, 0.35, z]); addLights(en, 0xff2a20, 8);
    const ap = []; for (let x = -30; x > -900; x -= 30) for (let k = -2; k <= 2; k++) ap.push([x, 1.2 + (-x) * 0.004, k * 1.1]); addLights(ap, 0xfff6e0, 5, 0.3);
    const papi = []; for (let k = 0; k < 4; k++) papi.push([330, 0.8, -40 - k * 9]); addLights(papi, 0xff3030, 10, 0.45);
    // windsock
    const pole = new T.Mesh(new T.CylinderGeometry(0.08, 0.08, 6, 8), new T.MeshStandardMaterial({ color: 0xdddddd })); pole.position.set(380, 3, -70); S.add(pole);
    const sockG = new T.CylinderGeometry(0.5, 0.22, 3.2, 16, 5, true); sockG.rotateZ(Math.PI / 2); sockG.translate(1.6, 0, 0);
    const sockT = tx(cnv(64, 64, (x) => { for (let i = 0; i < 5; i++) { x.fillStyle = i % 2 ? '#f4f4f0' : '#ff5a12'; x.fillRect(i * 12.8, 0, 12.8, 64); } }));
    this.sock = new T.Mesh(sockG, new T.MeshStandardMaterial({ map: sockT, side: T.DoubleSide, roughness: 0.8 })); this.sock.position.set(380, 5.8, -70); this.sock.rotation.y = Math.PI * 0.95; S.add(this.sock);

    // airport buildings, tree lines, distant city
    const conc = new T.MeshStandardMaterial({ color: 0x8f8a82, roughness: 0.9 });
    const term = new T.Mesh(new T.BoxGeometry(520, 22, 70), [conc, conc, conc, conc, new T.MeshStandardMaterial({ map: tx(windowsTex(60, 3, 0.4)), emissive: 0xffffff, emissiveMap: tx(windowsTex(60, 3, 0.4)), emissiveIntensity: 0.06, roughness: 0.5, metalness: 0.1, color: 0x8a8f96 }), conc]);
    term.position.set(1750, 11, 520); term.castShadow = term.receiveShadow = true; S.add(term);
    for (let k = 0; k < 3; k++) { const hg = new T.Mesh(new T.CylinderGeometry(24, 24, 70, 32, 1, false, 0, Math.PI), new T.MeshStandardMaterial({ color: 0x7d838a, metalness: 0.5, roughness: 0.55, envMapIntensity: 0.5 })); hg.rotation.set(0, 0, Math.PI / 2); hg.rotation.y = Math.PI / 2; hg.scale.set(1, 1, 0.45); hg.position.set(2450 + k * 110, 0, 430); hg.castShadow = true; S.add(hg); }
    const treeC = cnv(256, 256, (x, w, h) => {
      const blobs = []; for (let k = 0; k < 9; k++) blobs.push([w / 2 + (Math.random() - 0.5) * w * 0.55, h * 0.2 + Math.random() * h * 0.5, w * (0.1 + Math.random() * 0.12)]);
      x.strokeStyle = '#1e1810'; x.lineWidth = 6; x.beginPath(); x.moveTo(w / 2, h); x.lineTo(w / 2 + 4, h * 0.55); x.stroke();
      for (let i = 0; i < 5000; i++) { const b = blobs[i % 9], a = Math.random() * 6.283, rr = Math.pow(Math.random(), 0.6) * b[2], cx = b[0] + Math.cos(a) * rr, cy = b[1] + Math.sin(a) * rr;
        const lit = Math.max(0, (b[1] - cy) / b[2] * 0.5 + (cx - b[0]) / b[2] * 0.3 + 0.3); x.fillStyle = `hsl(${78 + Math.random() * 18},${22 + Math.random() * 12}%,${7 + lit * 16 + Math.random() * 6}%)`; x.fillRect(cx, cy, 1.5 + Math.random() * 3, 1.5 + Math.random() * 3); }
    });
    const treeT = tx(treeC); treeT.wrapS = treeT.wrapT = T.ClampToEdgeWrapping;
    const tg1 = new T.PlaneGeometry(2, 2); tg1.translate(0, 1, 0); const tg2 = tg1.clone().rotateY(Math.PI / 2); const tg3 = tg1.clone().rotateY(Math.PI / 4), tg4 = tg1.clone().rotateY(-Math.PI / 4);
    const treeG = T.BufferGeometryUtils ? T.BufferGeometryUtils.mergeBufferGeometries([tg1, tg2, tg3, tg4]) : tg1;
    const treeM = new T.MeshStandardMaterial({ map: treeT, alphaTest: 0.5, side: T.DoubleSide, roughness: 1 });
    const NT = 3200, trees = new T.InstancedMesh(treeG, treeM, NT), m4 = new T.Matrix4(), rnd = FK.rng(11);
    for (let i = 0; i < NT; i++) {
      const band = rnd() < 0.5 ? -1 : 1, x = -3000 + rnd() * 9500, z = band * (1100 + rnd() * 900 + Math.sin(x * 0.002) * 300), s = 7 + rnd() * 8;
      m4.compose(V(x, -0.5, z), new T.Quaternion().setFromAxisAngle(V(0, 1, 0), rnd() * 6), V(s * (0.8 + rnd() * 0.4), s * (0.9 + rnd() * 0.5), s)); trees.setMatrixAt(i, m4);
    }
    trees.castShadow = false; S.add(trees);
    const city = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), new T.MeshStandardMaterial({ color: 0x6b6f7a, roughness: 0.7, metalness: 0.2 }), 220);
    for (let i = 0; i < 220; i++) { const h = 20 + rnd() * rnd() * 160; m4.compose(V(-3500 + rnd() * 5000, h / 2, 5200 + rnd() * 1500), new T.Quaternion(), V(20 + rnd() * 50, h, 20 + rnd() * 50)); city.setMatrixAt(i, m4); }
    S.add(city);

    // the control tower and its cab (consoles, monitors, the controller)
    this.buildTower(d);

    // the aircraft: NASA's 747SP geometry, painted in code
    FK.glb(d.b747).then((gl) => {
      let mesh = null; gl.scene.traverse((o) => { if (o.isMesh && !mesh) mesh = o; });
      const pm2 = new T.MeshPhysicalMaterial({ color: 0xf2f2f0, metalness: 0.15, roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.15, envMapIntensity: 1.0 });
      // object-space varying for the livery (applied before lighting)
      pm2.onBeforeCompile = (sh) => {
        sh.vertexShader = 'varying vec3 vLP;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vLP = position;');
        sh.fragmentShader = 'varying vec3 vLP;\n' + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n' + '/*LIV*/');
        const code = ['{ vec3 c = vec3(0.95); float x = vLP.x, y = vLP.y, z = abs(vLP.z);',
          'if (y < 3.0 && z < 4.0) c = vec3(0.78, 0.79, 0.8);',
          'float cheat = smoothstep(3.55, 3.6, y) * (1.0 - smoothstep(4.05, 4.1, y)) * step(x, 25.2) * step(-20.5, x) * step(z, 3.4); c = mix(c, vec3(0.04, 0.09, 0.24), cheat);',
          'float win = step(4.55, y) * (1.0 - step(4.85, y)) * step(fract(x * 1.95), 0.45) * step(x, 21.0) * step(-18.0, x) * step(z, 3.3);',
          'float upper = step(7.0, y) * (1.0 - step(7.28, y)) * step(fract(x * 1.95), 0.45) * step(x, 21.0) * step(8.0, x) * step(z, 3.0);',
          'c = mix(c, vec3(0.03), max(win, upper));',
          'float ck = step(24.6, x) * step(x, 26.6) * step(5.15, y) * step(y, 5.95) * step(z, 1.5); c = mix(c, vec3(0.015, 0.02, 0.03), ck);',
          'float tail = step(x, -19.0) * step(9.0, y) * step(z, 1.4); c = mix(c, vec3(0.62, 0.06, 0.08), tail);',
          'float nac = step(y, 3.3) * step(9.0, z) * step(z, 24.0); c = mix(c, vec3(0.7, 0.71, 0.73), nac);',
          'float intake = nac * step(8.9, x) * step(x, 10.2) * step(z, 13.5) + nac * step(-0.1, x) * step(x, 0.9) * step(18.5, z); c = mix(c, vec3(0.03), clamp(intake, 0.0, 1.0));',
          'diffuseColor.rgb *= c; }'].join('\n');
        sh.fragmentShader = sh.fragmentShader.replace('/*LIV*/', code);
      };
      pm2.customProgramCacheKey = () => 'livery2';
      mesh.material = pm2; mesh.castShadow = true; mesh.receiveShadow = true;
      mesh.geometry = T.BufferGeometryUtils && T.BufferGeometryUtils.toCreasedNormals ? T.BufferGeometryUtils.toCreasedNormals(mesh.geometry, Math.PI / 5) : (mesh.geometry.computeVertexNormals(), mesh.geometry);
      const plane = self.plane = new T.Group(), body = self.body = new T.Group(); plane.add(body); body.add(mesh); body.position.y = 1.3;
      gear(body); S.add(plane);
      // landing and beacon lights
      const ll = self.landing = new T.SpotLight(0xfff4e0, 0, 900, 0.22, 0.6, 1.2); ll.position.set(23, 2.6, 0); ll.target.position.set(200, 0, 0); body.add(ll); body.add(ll.target);
      self.beacon = new T.Mesh(new T.SphereGeometry(0.25, 10, 8), new T.MeshBasicMaterial({ color: 0xff2010 })); self.beacon.position.set(0, 8.3, 0); body.add(self.beacon);
      for (const [z, c] of [[-29.6, 0xff1010], [29.6, 0x10ff40]]) { const n = new T.Mesh(new T.SphereGeometry(0.18, 8, 6), new T.MeshBasicMaterial({ color: new T.Color(c).multiplyScalar(4) })); n.position.set(-2.5, 3.3, z); body.add(n); }
      // two more aircraft parked at the terminal
      for (const [x, ry] of [[1600, Math.PI / 2], [1820, Math.PI / 2]]) { const pp = mesh.clone(); const gg = new T.Group(); gg.add(pp); pp.position.y = 1.3; gear(gg); gg.position.set(x, 0, 440); gg.rotation.y = ry; gg.scale.setScalar(0.92); S.add(gg); }
      self.engines = [V(9.6, 2.85, 11.8), V(0.4, 3.4, 21.1), V(9.6, 2.85, -11.8), V(0.4, 3.4, -21.1)];
      self.ready = true; self.status('');
    });

    // the flock
    this.geese = [];
    const fr = FK.rng(5);
    for (let i = 0; i < 16; i++) {
      const g = goose(); g.scale.setScalar(1.15);
      g.userData.off = V((fr() - 0.5) * 26, 0, (fr() - 0.5) * 16); g.userData.ph = fr() * 10; g.userData.fly = V((i % 5) * -1.6 - Math.floor(i / 5) * 0.6, Math.floor(i / 5) * 0.8, ((i % 5) - 2) * 1.7 + (Math.floor(i / 5) % 2) * 0.8);
      S.add(g); this.geese.push(g);
    }
    // Sky Sentry's camera: a phone on a tripod at the runway edge
    const phoneG = new T.Group(); phoneG.position.set(1830, 0, -60);
    const blk = new T.MeshStandardMaterial({ color: 0x18191b, metalness: 0.6, roughness: 0.4 });
    for (let k = 0; k < 3; k++) { const l = new T.Mesh(new T.CylinderGeometry(0.012, 0.018, 1.45, 6), blk); const a = k * 2.094; l.position.set(Math.cos(a) * 0.22, 0.68, Math.sin(a) * 0.22); l.lookAt(0, 1.45, 0); l.rotateX(Math.PI / 2); phoneG.add(l); }
    const ph = new T.Mesh(new T.BoxGeometry(0.16, 0.078, 0.009), blk); ph.position.set(0, 1.42, 0); phoneG.add(ph);
    this.phoneScreen = new T.Mesh(new T.PlaneGeometry(0.15, 0.07), new T.MeshBasicMaterial({ color: 0xffffff })); this.phoneScreen.position.set(0, 1.42, 0.0052); phoneG.add(this.phoneScreen);
    this.phoneAim = V(1985, 3, -45); phoneG.lookAt(this.phoneAim.x, 0, this.phoneAim.z); phoneG.rotateY(Math.PI); this.phoneG = phoneG; S.add(phoneG);
    this.phoneCam = new T.PerspectiveCamera(32, 16 / 9, 0.5, 6000); this.phoneCam.position.set(1830, 1.45, -60); this.phoneCam.lookAt(this.phoneAim);
    this.feedRT = new T.WebGLRenderTarget(640, 360, { type: T.HalfFloatType });
    this.feedMat = new T.ShaderMaterial({ uniforms: { map: { value: this.feedRT.texture }, uExp: { value: 0.22 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform sampler2D map; uniform float uExp; varying vec2 vUv; vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14), 0.0, 1.0); } void main(){ vec3 c = texture2D(map, vUv).rgb * uExp; c = pow(aces(c), vec3(1.0/2.2)); float l = dot(c, vec3(0.3,0.59,0.11)); c = mix(vec3(l), c, 0.85) * 1.6; gl_FragColor = vec4(c, 1.0); }' });
    this.phoneScreen.material = this.feedMat;

    // particles
    const pt = new T.CanvasTexture(puff());
    this.fire = new Particles(500, true, pt); this.smoke = new Particles(700, false, pt);
    S.add(this.smoke.pts); S.add(this.fire.pts);
    this.flash = new T.PointLight(0xff8a3a, 0, 600, 2); S.add(this.flash);
  };

  // concrete with formwork seams, drawn in code
  function concreteTex(w, h, rows) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
    x.fillStyle = '#b9b3a8'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 60000; i++) { const v = Math.random(); x.fillStyle = v > 0.5 ? `rgba(255,255,255,${(v - 0.5) * 0.12})` : `rgba(40,35,30,${(0.5 - v) * 0.16})`; x.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2); }
    for (let i = 0; i < 40; i++) { const gx = Math.random() * w, g = x.createLinearGradient(gx, 0, gx + 6, 0); g.addColorStop(0, 'rgba(60,52,44,0)'); g.addColorStop(0.5, `rgba(60,52,44,${0.05 + Math.random() * 0.08})`); g.addColorStop(1, 'rgba(60,52,44,0)'); x.fillStyle = g; x.fillRect(gx, Math.random() * h * 0.5, 6, h * (0.3 + Math.random() * 0.7)); }
    x.fillStyle = 'rgba(70,62,54,.35)'; for (let r = 1; r < rows; r++) x.fillRect(0, r * h / rows, w, 2);
    for (let k = 0; k < 16; k++) for (let r = 0; r < rows; r++) { x.fillStyle = 'rgba(60,55,50,.4)'; x.beginPath(); x.arc((k + 0.5) * w / 16, (r + 0.5) * h / rows, 2, 0, 7); x.fill(); }
    const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 16; return t;
  }
  SkyFilm.prototype.towerExterior = function (G) {
    const ct = FK.tex(this.data.tex.brushed_concrete_diff, true, [3, 8]), cn = FK.tex(this.data.tex.brushed_concrete_nor_gl, false, [3, 8]);
    const conc = new T.MeshStandardMaterial({ color: 0xe8e2d8, map: ct, normalMap: cn, roughness: 0.9 });
    const dark = new T.MeshStandardMaterial({ color: 0x23262b, roughness: 0.5, metalness: 0.5 });
    const glassD = new T.MeshPhysicalMaterial({ color: 0x1c2733, roughness: 0.08, metalness: 0.2, clearcoat: 1, envMapIntensity: 1.4 });
    const add = (geo, m, p, r) => { const o = new T.Mesh(geo, m); o.position.set(p[0], p[1], p[2]); if (r) o.rotation.set(r[0], r[1], r[2]); o.castShadow = o.receiveShadow = true; G.add(o); return o; };
    // shaft: tapered, fluted concrete with a glazed stair slot facing the runway
    add(new T.CylinderGeometry(3.6, 4.6, CAB - 6, 48), conc, [0, (CAB - 6) / 2, 0]);
    for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; const f = add(new T.BoxGeometry(0.7, CAB - 6, 0.9), conc, [Math.cos(a) * 4.05, (CAB - 6) / 2, Math.sin(a) * 4.05]); f.rotation.y = -a; f.scale.x = 1; f.geometry.translate(0, 0, 0); }
    const slot = add(new T.BoxGeometry(1.2, CAB - 12, 0.3), glassD, [0, (CAB - 4) / 2, -4.55]);
    for (let y = 4; y < CAB - 8; y += 3.2) add(new T.BoxGeometry(1.4, 0.18, 0.4), conc, [0, y, -4.6]);
    // junction and mechanical floors beneath the cab, louvred
    const louv = document.createElement('canvas'); louv.width = 64; louv.height = 64; const lx = louv.getContext('2d'); lx.fillStyle = '#5a5f66'; lx.fillRect(0, 0, 64, 64); for (let i = 0; i < 8; i++) { lx.fillStyle = '#2a2d31'; lx.fillRect(0, i * 8 + 5, 64, 3); }
    const lt = new T.CanvasTexture(louv); lt.wrapS = lt.wrapT = T.RepeatWrapping; lt.repeat.set(40, 3); lt.encoding = T.sRGBEncoding;
    add(new T.CylinderGeometry(5.2, 3.8, 2.6, 48), conc, [0, CAB - 4.7, 0]);
    add(new T.CylinderGeometry(5.6, 5.6, 1.7, 48), new T.MeshStandardMaterial({ map: lt, roughness: 0.6, metalness: 0.5 }), [0, CAB - 2.55, 0]);
    add(new T.CylinderGeometry(7.6, 6.2, 1.1, 48), conc, [0, CAB - 1.15, 0]);
    // catwalk with railing around the cab
    add(new T.CylinderGeometry(8.4, 8.4, 0.16, 64), new T.MeshStandardMaterial({ color: 0x8a8d92, roughness: 0.6, metalness: 0.6 }), [0, CAB - 0.55, 0]);
    const rail = new T.MeshStandardMaterial({ color: 0xc9ccd1, metalness: 0.8, roughness: 0.35 });
    add(new T.TorusGeometry(8.35, 0.035, 6, 96), rail, [0, CAB + 0.55, 0], [Math.PI / 2, 0, 0]); add(new T.TorusGeometry(8.35, 0.025, 6, 96), rail, [0, CAB + 0.05, 0], [Math.PI / 2, 0, 0]);
    for (let k = 0; k < 64; k++) { const a = k / 64 * Math.PI * 2; add(new T.CylinderGeometry(0.025, 0.025, 1.1, 5), rail, [Math.cos(a) * 8.35, CAB, Math.sin(a) * 8.35]); }
    // base building (TRACON) at the foot, with window bands
    const win = document.createElement('canvas'); win.width = 512; win.height = 128; const wx = win.getContext('2d'); wx.fillStyle = '#9e978c'; wx.fillRect(0, 0, 512, 128);
    for (let r = 0; r < 2; r++) { wx.fillStyle = '#18202a'; wx.fillRect(0, 18 + r * 60, 512, 26); for (let i = 0; i < 32; i++) { wx.fillStyle = Math.random() < 0.3 ? 'rgba(255,214,160,.8)' : 'rgba(80,110,140,.5)'; wx.fillRect(i * 16 + 2, 20 + r * 60, 12, 22); wx.fillStyle = '#6a655d'; wx.fillRect(i * 16, 18 + r * 60, 2, 26); } }
    const wt = new T.CanvasTexture(win); wt.encoding = T.sRGBEncoding; wt.wrapS = T.RepeatWrapping; wt.repeat.set(3, 1);
    const wm = new T.MeshStandardMaterial({ map: wt, roughness: 0.6 }), roofM = new T.MeshStandardMaterial({ color: 0x55575b, roughness: 0.9 });
    add(new T.BoxGeometry(46, 9, 24), [wm, wm, roofM, roofM, wm, wm], [14, 4.5, 14]);
    for (let k = 0; k < 4; k++) add(new T.BoxGeometry(3, 1.4, 2.2), new T.MeshStandardMaterial({ color: 0x9a9da2, metalness: 0.5, roughness: 0.5 }), [4 + k * 7, 9.7, 18]);
    return conc;
  };
  SkyFilm.prototype.towerRoof = function (G, Hc, mull) {
    const add = (geo, m, p, r) => { const o = new T.Mesh(geo, m); o.position.set(p[0], p[1], p[2]); if (r) o.rotation.set(r[0], r[1], r[2]); o.castShadow = true; G.add(o); return o; };
    const roofM = new T.MeshStandardMaterial({ color: 0x3a3c40, metalness: 0.4, roughness: 0.6, side: T.DoubleSide, envMapIntensity: 0.2 });
    const y0 = CAB + Hc;
    add(new T.CylinderGeometry(8.0, 8.4, 0.5, 48), roofM, [0, y0 + 0.25, 0]);
    add(new T.CylinderGeometry(8.5, 8.5, 0.35, 48, 1, true), new T.MeshStandardMaterial({ color: 0xd9d5cd, roughness: 0.7, side: T.DoubleSide }), [0, y0 + 0.35, 0]);
    add(new T.CylinderGeometry(4.5, 5.5, 1.6, 48), new T.MeshStandardMaterial({ color: 0xcfcac1, roughness: 0.8 }), [0, y0 + 1.3, 0]);
    const rail = new T.MeshStandardMaterial({ color: 0xc9ccd1, metalness: 0.8, roughness: 0.35 });
    add(new T.TorusGeometry(7.6, 0.03, 6, 96), rail, [0, y0 + 1.5, 0], [Math.PI / 2, 0, 0]);
    for (let k = 0; k < 48; k++) { const a = k / 48 * Math.PI * 2; add(new T.CylinderGeometry(0.02, 0.02, 1.0, 5), rail, [Math.cos(a) * 7.6, y0 + 1.0, Math.sin(a) * 7.6]); }
    add(new T.SphereGeometry(1.5, 32, 16), new T.MeshStandardMaterial({ color: 0xf1efe9, roughness: 0.55 }), [-2.2, y0 + 3.3, 1.2]);
    add(new T.CylinderGeometry(0.3, 0.4, 1.1, 16), mull, [-2.2, y0 + 2.4, 1.2]);
    [[1.8, 0.6, 9], [2.6, -1.8, 6], [0.2, 2.6, 4.5]].forEach(([x, z, h]) => { add(new T.CylinderGeometry(0.05, 0.11, h, 8), mull, [x, y0 + 2.1 + h / 2, z]); for (let i = 1; i < 4; i++) add(new T.BoxGeometry(0.9 - i * 0.15, 0.04, 0.04), mull, [x, y0 + 2.1 + h * i / 4, z]); });
    this.obstacle = add(new T.SphereGeometry(0.22, 12, 8), new T.MeshBasicMaterial({ color: 0xff2010 }), [1.8, y0 + 11.3, 0.6]);
  };
  SkyFilm.prototype.buildTower = function () {
    const S = this.scene, G = new T.Group(); G.position.copy(TWR); S.add(G);
    const conc = this.towerExterior(G);
    const floor = new T.Mesh(new T.CylinderGeometry(7.4, 7.4, 0.2, 8), new T.MeshStandardMaterial({ color: 0x15161a, roughness: 0.9, envMapIntensity: 0.1 })); floor.position.y = CAB; floor.rotation.y = Math.PI / 8; G.add(floor);
    // tilted glass: 8 panels leaning out, with mullions
    const glass = new T.MeshPhysicalMaterial({ color: 0x6f8aa0, metalness: 0.1, roughness: 0.03, transparent: true, opacity: 0.1, envMapIntensity: 1.2, clearcoat: 1, side: T.DoubleSide, depthWrite: false });
    const mull = new T.MeshStandardMaterial({ color: 0x2c2f35, metalness: 0.7, roughness: 0.4 });
    const Hc = 4.4, rb = 7.0, rt = 8.1;
    for (let k = 0; k < 8; k++) {
      const a0 = k * Math.PI / 4 + Math.PI / 8, a1 = a0 + Math.PI / 4;
      const b0 = V(Math.cos(a0) * rb, CAB + 0.9, Math.sin(a0) * rb), b1 = V(Math.cos(a1) * rb, CAB + 0.9, Math.sin(a1) * rb), t0 = V(Math.cos(a0) * rt, CAB + Hc, Math.sin(a0) * rt), t1 = V(Math.cos(a1) * rt, CAB + Hc, Math.sin(a1) * rt);
      const gg = new T.BufferGeometry().setFromPoints([b0, b1, t1, b0, t1, t0]); gg.computeVertexNormals(); G.add(new T.Mesh(gg, glass));
      const m = new T.Mesh(new T.BoxGeometry(0.12, 1, 0.12), mull); const mid = b0.clone().add(t0).multiplyScalar(0.5); m.position.copy(mid); m.scale.y = b0.distanceTo(t0); m.lookAt(t0); m.rotateX(Math.PI / 2); G.add(m);
      const sill = new T.Mesh(new T.BoxGeometry(1, 0.9, 0.3), conc); sill.position.copy(b0.clone().add(b1).multiplyScalar(0.5)); sill.position.y = CAB + 0.45; sill.scale.x = b0.distanceTo(b1); sill.lookAt(0, CAB + 0.45, 0); G.add(sill);
    }
    this.towerRoof(G, Hc, mull);
    const ceilLight = new T.PointLight(0x9fb8d6, 0.12, 14, 2); ceilLight.position.set(0, CAB + 3.6, 0); G.add(ceilLight);
    // console arc facing the runway (-z), monitors on it
    const desk = new T.MeshStandardMaterial({ color: 0x1a1c20, roughness: 0.7, metalness: 0.2, envMapIntensity: 0.12 });
    const top = new T.Mesh(new T.CylinderGeometry(6.2, 6.2, 0.06, 48, 1, false, Math.PI * 0.62, Math.PI * 0.76), desk); top.position.y = CAB + 0.78; G.add(top);
    const front = new T.Mesh(new T.CylinderGeometry(6.25, 6.25, 0.78, 48, 1, true, Math.PI * 0.62, Math.PI * 0.76), desk); front.position.y = CAB + 0.39; G.add(front);
    const inner = new T.Mesh(new T.CylinderGeometry(5.3, 5.3, 0.78, 48, 1, true, Math.PI * 0.62, Math.PI * 0.76), desk); inner.position.y = CAB + 0.39; G.add(inner);
    this.screens = {};
    const mon = (key, ang, w, h, y, r, tilt) => {
      const c = document.createElement('canvas'); c.width = Math.round(w * 900); c.height = Math.round(h * 900);
      const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.anisotropy = 8;
      const grp = new T.Group(); grp.position.set(Math.sin(ang) * r, CAB + y, -Math.cos(ang) * r); grp.rotation.y = -ang; grp.rotateX(-tilt || 0);
      const shell = new T.MeshStandardMaterial({ color: 0x15161a, roughness: 0.45, metalness: 0.35, envMapIntensity: 0.3 });
      const bez = new T.Mesh(new T.BoxGeometry(w + 0.016, h + 0.016, 0.018), shell); grp.add(bez);
      const back = new T.Mesh(new T.BoxGeometry(w * 0.7, h * 0.6, 0.05), shell); back.position.z = -0.03; grp.add(back);
      const scr = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ map: t, toneMapped: false })); scr.position.z = 0.0095; grp.add(scr);
      const gl = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshPhysicalMaterial({ color: 0x000000, roughness: 0.08, metalness: 0, clearcoat: 1, transparent: true, opacity: 0.12, envMapIntensity: 0.9, depthWrite: false })); gl.position.z = 0.0105; grp.add(gl);
      const neck = new T.Mesh(new T.BoxGeometry(0.05, y - 0.78 - h / 2 + 0.06, 0.03), shell); neck.position.set(0, -(y - 0.78) / 2 - h / 4 + 0.03, -0.06); grp.add(neck);
      const foot = new T.Mesh(new T.CylinderGeometry(0.11, 0.12, 0.015, 32), shell); foot.position.set(0, -(y - 0.78) + 0.01, -0.06); foot.rotation.x = tilt || 0; grp.add(foot);
      G.add(grp); this.screens[key] = { c, x: c.getContext('2d'), t, grp, scr };
      return grp;
    };
    mon('radar', -0.36, 0.5, 0.42, 1.12, 5.75, 0.12);
    mon('strips', -0.22, 0.46, 0.3, 1.06, 5.75, 0.12);
    mon('sentry', 0.0, 0.74, 0.44, 1.14, 5.7, 0.1);
    mon('adsb', 0.2, 0.46, 0.3, 1.06, 5.75, 0.12);
    mon('wx', 0.34, 0.4, 0.26, 1.04, 5.75, 0.12);
    mon('ground', 0.48, 0.46, 0.3, 1.06, 5.8, 0.12);
    mon('radar2', -0.52, 0.42, 0.36, 1.08, 5.8, 0.12);
    // sentry overlay: the live feed is drawn under the HUD
    const sn = this.screens.sentry; const feed = new T.Mesh(new T.PlaneGeometry(0.47, 0.264), new T.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));
    feed.position.set(-0.102, 0.026, 0.0225); sn.grp.add(feed); sn.feed = feed;
    const hc = document.createElement('canvas'); hc.width = 640; hc.height = 360; const ht = new T.CanvasTexture(hc); ht.encoding = T.sRGBEncoding;
    const hud = new T.Mesh(new T.PlaneGeometry(0.47, 0.264), new T.MeshBasicMaterial({ map: ht, transparent: true, toneMapped: false })); hud.position.set(-0.102, 0.026, 0.024); sn.grp.add(hud); sn.hud = { c: hc, x: hc.getContext('2d'), t: ht };
    this.redLight = new T.PointLight(0xff2418, 0, 6, 2); this.redLight.position.set(0.3, CAB + 0.6, -4.4); G.add(this.redLight);
    this.monLight = new T.PointLight(0x7fb0ff, 0.6, 5, 2); this.monLight.position.set(-0.3, CAB + 0.6, -4.4); G.add(this.monLight);
    // the controller, seated at the centre console, and a second one further along
    const p1 = this.controller = person(0x161b26, 0x4a3328); p1.position.set(0.15, CAB, -4.75); p1.rotation.y = Math.PI; G.add(p1);
    const p2 = person(0x262628, 0x5a4034); p2.position.set(-2.9, CAB, -3.9); p2.rotation.y = Math.PI + 0.55; G.add(p2);
    const kbT = (() => { const c = document.createElement('canvas'); c.width = 512; c.height = 170; const x = c.getContext('2d'); x.fillStyle = '#121316'; x.fillRect(0, 0, 512, 170);
      for (let r = 0; r < 5; r++) for (let k = 0; k < 15; k++) { x.fillStyle = '#2a2c31'; x.fillRect(8 + k * 33.5, 10 + r * 31, 29, 26); x.fillStyle = '#3a3d43'; x.fillRect(10 + k * 33.5, 11 + r * 31, 25, 3); } const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; return t; })();
    const kbM = new T.MeshStandardMaterial({ map: kbT, roughness: 0.6 }), plain = new T.MeshStandardMaterial({ color: 0x17181b, roughness: 0.5, envMapIntensity: 0.2 });
    const onDesk = (ang, r, obj) => { obj.position.set(Math.sin(ang) * r, CAB + 0.81, -Math.cos(ang) * r); obj.rotation.y = -ang; G.add(obj); return obj; };
    [-0.3, -0.05, 0.25, 0.42].forEach((a, i) => {
      onDesk(a, 5.45, new T.Mesh(new T.BoxGeometry(0.44, 0.02, 0.15), [plain, plain, kbM, plain, plain, plain])).rotateX(0.04);
      onDesk(a + 0.045, 5.45, new T.Mesh(new T.CapsuleGeometry(0.022, 0.04, 4, 8).rotateX(Math.PI / 2), plain)).scale.set(1, 0.6, 1);
      if (i % 2 === 0) { const mug = new T.Group(); const cm = new T.MeshStandardMaterial({ color: i ? 0xe8e4dc : 0x1f3c6b, roughness: 0.35 }); const cup = new T.Mesh(new T.CylinderGeometry(0.04, 0.036, 0.1, 24), cm); cup.position.y = 0.05; mug.add(cup); const hd = new T.Mesh(new T.TorusGeometry(0.025, 0.007, 8, 16), cm); hd.position.set(0.045, 0.05, 0); mug.add(hd); const cof = new T.Mesh(new T.CircleGeometry(0.035, 20).rotateX(-Math.PI / 2), new T.MeshStandardMaterial({ color: 0x2a1406, roughness: 0.15 })); cof.position.y = 0.09; mug.add(cof); onDesk(a - 0.07, 5.55, mug); }
    });
    // flight strip bay: tilted board with coloured paper strips in holders
    const bay = new T.Group(); const bayB = new T.Mesh(new T.BoxGeometry(0.5, 0.02, 0.34), plain); bay.add(bayB);
    for (let k = 0; k < 7; k++) { const st2 = new T.Mesh(new T.BoxGeometry(0.46, 0.012, 0.036), new T.MeshStandardMaterial({ color: [0xe9e4c8, 0xc9e2f0, 0xe9e4c8, 0xf3d3c8, 0xe9e4c8, 0xc9e2f0, 0xe9e4c8][k], roughness: 0.8 })); st2.position.set(0, 0.016, -0.14 + k * 0.045); bay.add(st2); }
    bay.rotation.x = -0.35; onDesk(-0.16, 5.5, bay).position.y += 0.06;
    // sunshades rolled half down inside the glass, recessed ceiling lights
    const shade = new T.MeshStandardMaterial({ color: 0x1a1d22, transparent: true, opacity: 0.55, roughness: 0.9, side: T.DoubleSide, depthWrite: false });
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4 + Math.PI / 4; const sh = new T.Mesh(new T.PlaneGeometry(5.6, 0.9), shade); sh.position.set(Math.cos(a) * 7.75, CAB + 3.85, Math.sin(a) * 7.75); sh.lookAt(0, CAB + 3.85, 0); sh.rotateX(0.24); G.add(sh); }
    const ceil = new T.Mesh(new T.CircleGeometry(8.1, 8).rotateX(Math.PI / 2), new T.MeshStandardMaterial({ color: 0x2b2d31, roughness: 0.9, side: T.DoubleSide })); ceil.position.y = CAB + 4.38; ceil.rotation.y = Math.PI / 8; G.add(ceil);
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; const l = new T.Mesh(new T.CircleGeometry(0.16, 20).rotateX(Math.PI / 2), new T.MeshBasicMaterial({ color: new T.Color(0xfff1dc).multiplyScalar(2.2) })); l.position.set(Math.cos(a) * 4, CAB + 4.36, Math.sin(a) * 4); G.add(l); }
    this.towerG = G;
  };

  // ---------------- monitors ----------------
  SkyFilm.prototype.drawScreens = function (t, st) {
    const sc = this.screens; if (!sc) return;
    const mono = (x, sz, w) => { x.font = `${w || 500} ${sz}px "Geist Mono", ui-monospace, Menlo, monospace`; };
    // radar scope: a STARS-style display, black with a dim video map, history trails and data blocks
    if (!this.vmap) { const r = FK.rng(3); this.vmap = []; for (let k = 0; k < 9; k++) { const pts = []; let x = r() * 2 - 1, y = r() * 2 - 1; for (let i = 0; i < 7; i++) { pts.push([x, y]); x += (r() - 0.5) * 0.5; y += (r() - 0.5) * 0.5; } this.vmap.push(pts); } }
    for (const k of ['radar', 'radar2']) {
      const { c, x, t: tex } = sc[k], w = c.width, h = c.height, cx = w / 2, cy = h / 2, R0 = Math.min(w, h) * 0.48, zoom = k === 'radar' ? 1 : 0.6;
      x.fillStyle = '#020304'; x.fillRect(0, 0, w, h);
      x.strokeStyle = 'rgba(90,110,130,.35)'; x.lineWidth = 1; this.vmap.forEach((pl) => { x.beginPath(); pl.forEach(([px, py], i) => { const X = cx + px * R0 * zoom * 1.3, Y = cy + py * R0 * zoom * 1.3; i ? x.lineTo(X, Y) : x.moveTo(X, Y); }); x.stroke(); });
      x.setLineDash([2, 5]); x.strokeStyle = 'rgba(120,140,160,.25)'; for (let i = 1; i <= 5; i++) { x.beginPath(); x.arc(cx, cy, R0 * i / 5, 0, 7); x.stroke(); } x.setLineDash([]);
      x.strokeStyle = 'rgba(200,210,220,.7)'; x.lineWidth = 2; x.beginPath(); x.moveTo(cx - 14 * zoom, cy - 3); x.lineTo(cx + 18 * zoom, cy - 3); x.stroke();
      const ac = [[0.03, 0.0, 0, 0, 'SKY902', '000 B74S', '#e8f0e8'], [0.45, 2.2, 0.22, 1, 'DAL118', '031 A321', '#d6f5d6'], [0.62, 4.0, -0.15, 1, 'N512RT', '014 C172', '#d6f5d6'], [0.85, 5.3, 0.3, 1, 'AAL2201', '068 B738', '#9fe0ff'], [0.72, 1.1, -0.25, 1, 'JBU611', '110 A320', '#9fe0ff']];
      x.font = '600 11px ui-monospace, Menlo, monospace';
      ac.forEach(([rr, ang, vel, mv, cs, alt, col]) => { const a2 = ang + (mv ? t * 0.004 * (1 + vel) : 0); const X = cx + Math.cos(a2) * R0 * rr * zoom, Y = cy + Math.sin(a2) * R0 * rr * zoom;
        if (mv) for (let i = 1; i <= 5; i++) { const ah = a2 - i * 0.02 * (1 + vel); x.fillStyle = `rgba(120,200,140,${0.5 - i * 0.08})`; x.fillRect(cx + Math.cos(ah) * R0 * rr * zoom - 1.5, cy + Math.sin(ah) * R0 * rr * zoom - 1.5, 3, 3); }
        x.fillStyle = col; x.fillRect(X - 3, Y - 3, 6, 6); x.strokeStyle = 'rgba(200,220,200,.6)'; x.beginPath(); x.moveTo(X + 4, Y - 4); x.lineTo(X + 16, Y - 16); x.stroke();
        x.fillText(cs, X + 18, Y - 18); x.fillText(alt, X + 18, Y - 5); });
      if (st.alert > 0 && k === 'radar') { const on = Math.sin(t * 12) > -0.2; x.strokeStyle = on ? '#ff3b30' : 'rgba(255,59,48,.3)'; x.lineWidth = 2; x.strokeRect(cx + R0 * 0.12 - 18, cy - 30, 36, 24); x.fillStyle = on ? '#ff3b30' : 'rgba(255,59,48,.4)'; x.fillText('BIRDS', cx + R0 * 0.12 - 16, cy - 36); }
      x.fillStyle = '#7f8b99'; x.font = '500 10px ui-monospace, Menlo, monospace'; x.fillText('KSKY  1842Z  ALT 3002  RWY 27', 8, h - 8);
      tex.needsUpdate = true;
    }
    // flight strips
    { const { c, x, t: tex } = sc.strips, w = c.width, h = c.height; x.fillStyle = '#0d1117'; x.fillRect(0, 0, w, h);
      const rows = [['SKY902', 'B74S/H', 'RWY 27', st.stripState], ['DAL118', 'A321/M', 'TWY B', 'TAXI'], ['N512RT', 'C172/L', 'RWY 27', 'PATTERN'], ['UAL77', 'B789/H', 'GATE 14', 'PUSH']];
      rows.forEach((r, i) => { const y = 10 + i * (h - 14) / 4, hh = (h - 14) / 4 - 6; x.fillStyle = i === 0 ? (st.alert > 0 ? '#5a1410' : '#1d2a1e') : '#161b22'; x.fillRect(8, y, w - 16, hh); x.fillStyle = i === 0 ? '#ffffff' : '#a9b4c2'; mono(x, 17, 600); x.fillText(r[0], 18, y + hh * 0.62); mono(x, 13); x.fillText(r[1], w * 0.36, y + hh * 0.62); x.fillText(r[2], w * 0.58, y + hh * 0.62); x.fillStyle = i === 0 ? (st.alert > 0 ? '#ff6a5a' : '#7dffa0') : '#7f8a99'; x.fillText(r[3], w * 0.78, y + hh * 0.62); });
      tex.needsUpdate = true; }
    // ADS-B list
    { const { c, x, t: tex } = sc.adsb, w = c.width, h = c.height; x.fillStyle = '#05080d'; x.fillRect(0, 0, w, h); mono(x, 12); x.fillStyle = '#6f8bab'; x.fillText('ADS-B  CALLSIGN  ALT    GS   HDG', 12, 22);
      const L = [['SKY902', '000', '000', '270'], ['N512RT', '1400', '092', '180'], ['UAL77', '000', '000', '090'], ['AAL2201', '6800', '231', '045'], ['JBU611', '11000', '388', '310'], ['DAL118', '000', '012', '360']];
      L.forEach((r, i) => { x.fillStyle = i === 0 ? '#eaf2ff' : '#9fb3c8'; x.fillText(`${String(i + 1).padStart(2, '0')}     ${r[0].padEnd(9)}${r[1].padStart(5)}  ${r[2]}  ${r[3]}`, 12, 46 + i * 20); });
      tex.needsUpdate = true; }
    // weather
    { const { c, x, t: tex } = sc.wx, w = c.width, h = c.height; x.fillStyle = '#0a0d12'; x.fillRect(0, 0, w, h); const cx = w * 0.27, cy = h * 0.55, r = h * 0.34;
      x.strokeStyle = '#3d4e66'; x.lineWidth = 2; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.stroke(); const wa = -Math.PI / 2 + 270 / 180 * Math.PI + Math.sin(t * 0.7) * 0.06; x.strokeStyle = '#ffd27a'; x.lineWidth = 4; x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + Math.cos(wa) * r, cy + Math.sin(wa) * r); x.stroke();
      mono(x, 22, 600); x.fillStyle = '#eaf2ff'; x.fillText('270 / 08', w * 0.52, h * 0.4); mono(x, 13); x.fillStyle = '#93a4ba'; x.fillText('VIS 10SM  FEW045', w * 0.52, h * 0.58); x.fillText('ALT 30.02  T 14C', w * 0.52, h * 0.72); tex.needsUpdate = true; }
    // ground map
    { const { c, x, t: tex } = sc.ground, w = c.width, h = c.height; x.fillStyle = '#0b0f0c'; x.fillRect(0, 0, w, h); const sx = (X) => 20 + (X + 100) / 3300 * (w - 40), sz = (Z) => h * 0.55 + Z / 900 * h;
      x.fillStyle = '#39424c'; x.fillRect(sx(0), sz(-22), sx(3000) - sx(0), 8); x.fillStyle = '#2b323a'; x.fillRect(sx(-100), sz(190) - 3, sx(3200) - sx(-100), 6);
      if (this.plane) { x.fillStyle = '#7dffa0'; x.beginPath(); x.arc(sx(this.plane.position.x), sz(this.plane.position.z), 5, 0, 7); x.fill(); mono(x, 11); x.fillText('SKY902', sx(this.plane.position.x) + 8, sz(this.plane.position.z) - 8); }
      if (st.alert > 0) { x.fillStyle = `rgba(255,70,50,${0.6 + 0.4 * Math.sin(t * 12)})`; x.beginPath(); x.arc(sx(st.flock.x), sz(st.flock.z), 9, 0, 7); x.fill(); }
      tex.needsUpdate = true; }
    // Sky Sentry: HUD over the live phone feed
    { const { c, x, t: tex } = sc.sentry, w = c.width, h = c.height, A = st.alert, clr = st.clear;
      x.clearRect(0, 0, w, h); x.fillStyle = '#06080c'; x.fillRect(0, 0, w, h);
      const fx = w * 0.045, fy = h * 0.14, fw = w * 0.635, fh = fw * 9 / 16;
      x.clearRect(fx, fy, fw, fh);
      const red = A > 0 && Math.sin(t * 11) > -0.3;
      x.strokeStyle = A > 0 ? (red ? '#ff3b30' : '#7a1d18') : '#2d3a4f'; x.lineWidth = A > 0 ? 8 : 3; x.strokeRect(4, 4, w - 8, h - 8);
      mono(x, 20, 700); x.fillStyle = '#ffffff'; x.fillText('SKY SENTRY', fx, h * 0.09); mono(x, 14); x.fillStyle = '#8fa0b8'; x.fillText('RWY 27  \u00b7  CAM 2  \u00b7  LIVE', fx + 170, h * 0.09);
      // detections
      { const H = sc.sentry.hud, hx = H.x; hx.clearRect(0, 0, 640, 360);
        (st.boxes || []).forEach((b, i) => { const bx = b[0] * 640, by = b[1] * 360, z = Math.max(10, b[2] || 14); hx.strokeStyle = A > 0 ? '#ff3b30' : '#ffd23a'; hx.lineWidth = 2; hx.strokeRect(bx - z, by - z * 0.8, z * 2, z * 1.6);
          if (i === 0) { hx.font = '600 13px ui-monospace, Menlo, monospace'; hx.fillStyle = hx.strokeStyle; hx.fillText('BIRD ' + (0.9 + 0.05 * Math.sin(t)).toFixed(2), bx - z, by - z - 6); } });
        if (A > 0 && Math.sin(t * 11) > -0.3) { hx.strokeStyle = '#ff3b30'; hx.lineWidth = 6; hx.strokeRect(3, 3, 634, 354); }
        H.t.needsUpdate = true; }
      const px = fx + fw + w * 0.03, pw = w - px - w * 0.04;
      mono(x, 13); x.fillStyle = '#8fa0b8'; x.fillText('OBJECTS', px, fy + 14); mono(x, 40, 700); x.fillStyle = '#ffffff'; x.fillText(String(st.count || 0), px, fy + 58);
      mono(x, 13); x.fillStyle = '#8fa0b8'; x.fillText('RUNWAY RISK', px, fy + 96);
      const risk = A > 0 ? 0.92 : clr ? 0.05 : st.risk || 0.18; x.fillStyle = '#1b2230'; x.fillRect(px, fy + 106, pw, 14); x.fillStyle = risk > 0.6 ? '#ff3b30' : risk > 0.3 ? '#ffb02e' : '#3ddc84'; x.fillRect(px, fy + 106, pw * risk, 14);
      mono(x, 13); x.fillStyle = '#8fa0b8'; x.fillText('DIST TO RWY', px, fy + 150); mono(x, 24, 700); x.fillStyle = '#fff'; x.fillText(`${Math.round(st.dist || 0)} m`, px, fy + 178);
      if (A > 0) { x.fillStyle = red ? '#ff3b30' : '#a1201a'; x.fillRect(0, h * 0.8, w, h * 0.2); mono(x, Math.round(h * 0.066), 800); x.fillStyle = '#ffffff'; x.fillText('INCOMING \u00b7 FLOCK CROSSING RWY 27', w * 0.045, h * 0.92); }
      else if (clr) { x.fillStyle = '#1f8a4c'; x.fillRect(0, h * 0.8, w, h * 0.2); mono(x, Math.round(h * 0.085), 800); x.fillStyle = '#fff'; x.fillText('RUNWAY 27 CLEAR', w * 0.045, h * 0.925); }
      else { mono(x, 14); x.fillStyle = '#7dffa0'; x.fillText('\u25cf MONITORING', w * 0.045, h * 0.9); }
      tex.needsUpdate = true; }
  };

  // ---------------- sound: neural-voice radio calls and synthesized airfield sound ----------------
  SkyFilm.prototype.setSound = function (on) {
    this.sound = on; const self = this;
    if (on && !this.ac) {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC || !this.urls.audio) return;
      const ac = this.ac = new AC(); this.buf = {}; this.out = ac.createGain(); this.out.connect(ac.destination);
      FK.json(this.urls.audio).then((d) => Promise.all(Object.keys(d).map((k) => ac.decodeAudioData(FK.b64ab(d[k])).then((b) => { self.buf[k] = b; }).catch(() => {})))).then(() => {
        const loop = (k) => { const s = ac.createBufferSource(); s.buffer = self.buf[k]; s.loop = true; const g = ac.createGain(); g.gain.value = 0; s.connect(g); g.connect(self.out); s.start(); return g; };
        self.gEngine = loop('engine'); self.gWind = loop('wind'); self.gAlarm = loop('alarm'); self.subKey = null;
      });
    }
    if (this.ac) { if (on) this.ac.resume(); this.out.gain.setTargetAtTime(on ? 1 : 0, this.ac.currentTime, 0.1); }
  };
  SkyFilm.prototype.play = function (k, vol) {
    if (!this.sound || !this.ac || !this.buf || !this.buf[k]) return null;
    const s = this.ac.createBufferSource(); s.buffer = this.buf[k]; const g = this.ac.createGain(); g.gain.value = vol == null ? 1 : vol; s.connect(g); g.connect(this.out); s.start(); return s;
  };
  const CLIPS = [null, null, 'l02', 'l03', 'l04', 'l05', 'l06', null, 'l08', 'l09', 'l10', 'l11', 'l12', 'l13'];

  // ---------------- story ----------------
  SkyFilm.prototype.setProgress = function (p) { this.p = p; };
  const LINES = [
    [0.012, 0.07, '', 'Runway 27. 6:42 PM. Golden hour.'],
    [0.075, 0.14, '', 'A flock of Canada geese, about to go on the runway.'],
    [0.145, 0.168, 'PILOT \u00b7 SKYLINE 902 HEAVY', 'Tower, Skyline 902 heavy, holding short runway 27, ready for departure.'],
    [0.168, 0.192, 'TOWER', 'Skyline 902 heavy, wind 270 at 8, runway 27, cleared for takeoff.'],
    [0.192, 0.215, 'PILOT \u00b7 SKYLINE 902 HEAVY', 'Cleared for takeoff runway 27, Skyline 902 heavy.'],
    [0.29, 0.33, 'PILOT \u00b7 SKYLINE 902 HEAVY', 'V1. Rotate.'],
    [0.352, 0.4, 'PILOT \u00b7 SKYLINE 902 HEAVY', 'Bird strike. Engines two and three. Mayday, mayday, mayday.'],
    [0.505, 0.56, '', 'Same runway. Same birds. This time a phone on a tripod is watching the grass.'],
    [0.565, 0.6, 'PILOT \u00b7 SKYLINE 902 HEAVY', 'Tower, Skyline 902 heavy, holding short runway 27, ready for departure.'],
    [0.655, 0.676, 'TOWER', 'Skyline 902 heavy, runway 27, cleared for take\u2014'],
    [0.676, 0.7, 'SKY SENTRY', 'Incoming. Flock crossing runway 27.'],
    [0.7, 0.73, 'TOWER', 'Skyline 902 heavy, hold position. Takeoff clearance cancelled, birds approaching the runway.'],
    [0.73, 0.76, 'PILOT \u00b7 SKYLINE 902 HEAVY', 'Holding position, Skyline 902 heavy.'],
    [0.86, 0.9, 'TOWER', 'Skyline 902 heavy, runway 27 is clear. Cleared for takeoff.'],
  ];
  const CUTS = [0.075, 0.145, 0.168, 0.192, 0.222, 0.3, 0.335, 0.368, 0.535, 0.565, 0.6, 0.645, 0.73, 0.76, 0.86, 0.895, 0.955];
  const TITLES = [[0.445, 0.5, 'What if this never happened?'], [0.955, 1.01, 'Sky Sentry saw them first.']];

  // flock state for a given take
  SkyFilm.prototype.flock = function (p) {
    const A1 = p < 0.47;
    // act 1: lift off as the aircraft roars past (0.3) and cross its climb-out; act 2: cross early while it holds
    const k0 = A1 ? 0.3 : 0.69, k1 = A1 ? 0.37 : 0.86;
    const f = clamp((p - k0) / (k1 - k0), 0, 1);
    const start = BIRDS0, end = A1 ? V(2050, 32, 140) : V(1990, 38, 260);
    const mid = A1 ? V(2010, 14, -20) : V(1975, 16, 20);
    const a = start.clone().lerp(mid, f).lerp(mid.clone().lerp(end, f), f);
    return { pos: a, air: f > 0.02, f };
  };

  SkyFilm.prototype.planeState = function (p) {
    // returns { x, y, z, pitch, yaw, roll, thrust, fire }
    if (p < 0.47) {
      const u = ss(0.222, 0.333, p), x = HOLD + 1640 * u * u;
      const rot = ss(0.326, 0.352, p), climb = ss(0.33, 0.37, p);
      let y = climb * climb * 34, pitch = rot * 0.18, yaw = 0, roll = 0, z = 0, xx = x + ss(0.333, 0.37, p) * 380;
      const fail = ss(0.356, 0.41, p);
      if (p > 0.356) { xx = 1680 + 380 + fail * 860; z = -fail * fail * 150; y = 34 * (1 - fail * fail) + Math.sin(fail * 3) * 6 * (1 - fail); pitch = 0.18 - fail * 0.36; yaw = fail * 0.22; roll = Math.sin(fail * 2.4) * 0.35 * fail; }
      return { x: xx, y, z, pitch, yaw, roll, thrust: ss(0.21, 0.24, p), fire: p > 0.354, crashed: p > 0.41 };
    }
    const u = ss(0.895, 0.975, p), x = HOLD + 1640 * u * u + ss(0.965, 1.0, p) * 900;
    const climb = ss(0.958, 1.0, p);
    return { x, y: climb * climb * 140, z: 0, pitch: ss(0.952, 0.97, p) * 0.2, yaw: 0, roll: 0, thrust: ss(0.885, 0.9, p), fire: false, crashed: false };
  };

  // camera director: one function per shot
  SkyFilm.prototype.shot = function (p, ps, t) {
    const P = ps, pp = this.plane ? this.plane.position : V(HOLD, 0, 0);
    const fl = this.flockNow.pos;
    const sh = (a, b) => clamp((p - a) / (b - a), 0, 1);
    if (p < 0.075) { const k = sh(0, 0.075); return { pos: V(lerp(-700, -260, k), lerp(320, 70, k), lerp(-1100, -380, k)), look: V(HOLD + 60, 4, 0), fov: 34 }; }
    if (p < 0.145) { const k = sh(0.075, 0.145); return { pos: V(1922, 0.65, -131), look: V(lerp(1700, fl.x, ss(0, 0.4, k)), lerp(4, 0.7, ss(0, 0.4, k)), lerp(0, fl.z, ss(0, 0.4, k))), fov: lerp(34, 7, ss(0.15, 0.8, k)) }; }
    if (p < 0.168 || (p >= 0.192 && p < 0.222) || (p >= 0.565 && p < 0.6) || (p >= 0.73 && p < 0.76)) { const k = (p * 40) % 1; return { pos: V(pp.x + 62 - Math.sin(p * 120) * 1.5, 6.5, -19), look: V(pp.x + 24, 5.8, 0), fov: 22 }; }
    if (p < 0.192) { const k = sh(0.168, 0.192); return { pos: V(TWR.x - 30, 3, TWR.z - 52), look: V(TWR.x, CAB + 2.5, TWR.z), fov: lerp(40, 34, k) }; }
    if (p < 0.3) { const k = sh(0.222, 0.3); return { pos: V(pp.x - 70 + k * 30, 3.2, -72), look: V(pp.x + 10, 5, 0), fov: 30 }; }
    if (p < 0.335) { return { pos: V(1880, 1.2, -205), look: V(fl.x - 10, fl.y + 3, fl.z), fov: 16 }; }
    if (p < 0.368) { const k = sh(0.335, 0.368); return { pos: V(2220, 16, -70), look: V(pp.x, pp.y + 4, pp.z), fov: lerp(26, 18, k) }; }
    if (p < 0.445) { const k = sh(0.368, 0.445); const sk = this.shake || 0; return { pos: V(2600 + k * 40, 22 - k * 6, -470), look: V(lerp(pp.x, 2880, ss(0.4, 0.7, k)), lerp(pp.y, 12, ss(0.4, 0.7, k)), lerp(pp.z, -150, ss(0.4, 0.7, k))), fov: 26, shake: sk }; }
    if (p < 0.5) return { pos: V(0, 2000, 0), look: V(0, 2000, -1), fov: 30, black: true };
    if (p < 0.535) { const k = sh(0.5, 0.535); return { pos: V(lerp(-300, -120, k), lerp(140, 40, k), lerp(380, 200, k)), look: V(HOLD + 40, 4, 0), fov: 30 }; }
    if (p < 0.565) { const k = sh(0.535, 0.565), dir = this.phoneAim.clone().sub(V(1830, 1.45, -60)).setY(0).normalize(), side = V(-dir.z, 0, dir.x); const pos = V(1830, 1.62, -60).addScaledVector(dir, -lerp(1.4, 0.55, k)).addScaledVector(side, 0.18); return { pos, look: V(1830, 1.4, -60).addScaledVector(dir, 3), fov: lerp(40, 32, k), phone: true }; }
    if (p < 0.645 && p >= 0.6) {
      const k = ss(0.6, 0.645, p), a = V(TWR.x, CAB + 3, TWR.z - 120), b = V(TWR.x + 0.55, CAB + 1.62, TWR.z - 3.6);
      return { pos: a.clone().lerp(b, k), look: V(lerp(TWR.x, TWR.x + 0.2, k), lerp(CAB + 2.5, CAB + 1.2, k), lerp(TWR.z, TWR.z - 7, k)), fov: lerp(28, 46, k) };
    }
    if (p < 0.73 && p >= 0.645) {
      const k = ss(0.645, 0.73, p), push = ss(0.678, 0.71, p);
      const pos = V(TWR.x + lerp(lerp(1.8, 0.62, ss(0, 0.4, k)), 0.52, push), CAB + lerp(1.6, 1.4, push), TWR.z - 3.4 - push * 1.62);
      const look = V(TWR.x + lerp(lerp(-1.2, 0.05, ss(0, 0.45, k)), 0.0, push), CAB + lerp(1.25, 1.14, push), TWR.z - lerp(6.2, 5.7, push));
      return { pos, look, fov: lerp(44, 34, push), inside: true };
    }
    if (p < 0.86) { const k = sh(0.76, 0.86); return { pos: V(2075, 1.3, -75), look: V(fl.x - 25, Math.max(4, fl.y * 0.8), fl.z * 0.7), fov: 26 }; }
    if (p < 0.895) { const k = sh(0.86, 0.895); return { pos: V(TWR.x + 0.55, CAB + 1.62, TWR.z - 3.7 - k * 0.3), look: V(TWR.x - 0.2, CAB + 1.3, TWR.z - 12), fov: 50, inside: true }; }
    if (p < 0.955) { const k = sh(0.895, 0.955); return { pos: V(pp.x - 120 + k * 60, 4 + k * 6, -90), look: V(pp.x + 20, pp.y + 6, 0), fov: 30 }; }
    const k = sh(0.955, 1); return { pos: V(pp.x - 420 - k * 200, 30 + k * 30, 160), look: V(pp.x + 60, pp.y + 10, 0), fov: 30 };
  };

  SkyFilm.prototype.loop = function (now) {
    if (this.dead) return;
    this.raf = requestAnimationFrame(this.loop);
    const r = this.cv.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight || !this.ready) return;
    this.gov.tick(now);
    const dt = Math.min(0.05, (now - (this.lt || now)) / 1000); this.lt = now;
    const t = (now - this.t0) / 1000, C = this.camera, S = this.scene, Gd = this.grade;
    this.ps += (this.p - this.ps) * (1 - Math.exp(-dt * 2.6));
    const p = this.ps;
    // aircraft
    const st = this.planeState(p), PL = this.plane;
    PL.position.set(st.x, st.y, st.z); PL.rotation.set(0, st.yaw, 0); this.body.rotation.set(st.roll, 0, st.pitch);
    PL.visible = !st.crashed;
    this.landing.intensity = 4 + st.thrust * 6; this.beacon.visible = Math.sin(t * 7) > 0.6;
    // flock
    const fl = this.flockNow = this.flock(p);
    const hitP = 0.352, hit = p < 0.47 && p > hitP;
    this.geese.forEach((g, i) => {
      const u = g.userData;
      if (hit && i < 6) { g.visible = false; return; } g.visible = true;
      if (!fl.air) {
        const graze = Math.sin(t * 0.8 + u.ph);
        g.position.copy(BIRDS0).add(u.off); g.position.x += Math.sin(t * 0.1 + u.ph) * 0.6; g.position.y = 0.42;
        g.rotation.set(0, u.ph + Math.sin(t * 0.07 + u.ph) * 0.4, 0);
        u.neck.rotation.z = graze > 0.3 ? -1.25 : -0.1; u.wings.forEach((w) => { w.rotation.x = 0; w.scale.x = 0.9; w.rotation.z = 0.1; w.position.y = 0.12; });
        u.wings.forEach((w, j) => { w.rotation.y = (j ? 1 : -1) * 1.35; });
      } else {
        const spread = 1 + fl.f * 1.6;
        g.position.copy(fl.pos).addScaledVector(u.fly, 2.2 * spread); g.position.addScaledVector(u.off, (1 - Math.min(1, fl.f * 4)));
        g.position.y = Math.max(0.42, g.position.y + Math.sin(t * 1.3 + u.ph) * 0.4);
        const dir = this.flock(p + 0.002).pos.sub(fl.pos); g.rotation.set(0, Math.atan2(-dir.z, dir.x), Math.min(0.5, dir.y * 0.4));
        u.neck.rotation.z = 0.6;
        const fp = Math.sin(t * 9 + u.ph);
        u.wings.forEach((w, j) => { w.rotation.y = 0; w.rotation.x = (j ? -1 : 1) * fp * 0.9; w.scale.x = 1.1; });
      }
    });
    // particles: engine fire, smoke, crash
    if (p < 0.35 || p > 0.47) { this.fire.clear(); this.smoke.clear(); this.boom = false; }
    if (st.fire && !st.crashed) {
      for (const e of [this.engines[0], this.engines[2]]) {
        const w = this.body.localToWorld(e.clone().add(V(-6, 0, 0)));
        for (let k = 0; k < 3; k++) this.fire.add({ p: w.clone(), v: V(-20 + Math.random() * 6, Math.random() * 3, (Math.random() - 0.5) * 4), age: 0, life: 0.35 + Math.random() * 0.3, s0: 1.2, s1: 4.5, drag: 1.5 });
        this.smoke.add({ p: w.clone(), v: V(-14, 1 + Math.random() * 2, (Math.random() - 0.5) * 3), age: 0, life: 5, s0: 3, s1: 22, drag: 0.4, lift: 0.6, c: 0.05 });
      }
    }
    if (st.crashed && !this.boom) {
      this.boom = true; const c0 = V(2900, 2, -150);
      for (let k = 0; k < 120; k++) this.fire.add({ p: c0.clone().add(V((Math.random() - 0.5) * 30, Math.random() * 6, (Math.random() - 0.5) * 30)), v: V((Math.random() - 0.5) * 50, 10 + Math.random() * 40, (Math.random() - 0.5) * 50), age: 0, life: 1.2 + Math.random() * 1.6, s0: 10, s1: 46, drag: 1.2, lift: 6, a: 0.35 });
      for (let k = 0; k < 120; k++) this.smoke.add({ p: c0.clone().add(V((Math.random() - 0.5) * 40, Math.random() * 20, (Math.random() - 0.5) * 40)), v: V((Math.random() - 0.5) * 20, 12 + Math.random() * 20, (Math.random() - 0.5) * 20), age: Math.random() * 1.5, life: 9, s0: 20, s1: 110, drag: 0.3, lift: 1.5, c: 0.03, a: 0.95 });
      this.boomT = now;
    }
    if (this.boom && p < 0.47) {
      const c0 = V(2900, 2, -150), age = (now - this.boomT) / 1000;
      for (let k = 0, nk = Math.ceil(dt * 160); k < nk; k++) this.smoke.add({ p: c0.clone().add(V((Math.random() - 0.5) * 30, 4, (Math.random() - 0.5) * 30)), v: V(4 + Math.random() * 4, 14 + Math.random() * 10, (Math.random() - 0.5) * 6), age: 0, life: 9, s0: 18, s1: 120, drag: 0.15, lift: 1.2, c: 0.03, a: 0.9 });
      if (Math.random() < 0.6) this.fire.add({ p: c0.clone().add(V((Math.random() - 0.5) * 40, 1, (Math.random() - 0.5) * 30)), v: V(0, 8 + Math.random() * 8, 0), age: 0, life: 1.4, s0: 8, s1: 20, drag: 0.5, lift: 3 });
      this.flash.position.copy(c0).add(V(0, 20, 0)); this.flash.intensity = 14 * Math.exp(-age * 1.6) + 2.5;
      this.shake = Math.exp(-age * 2.2);
    } else { this.flash.intensity = 0; this.shake = 0; }
    this.fire.update(dt, 'fire'); this.smoke.update(dt, 'smoke');
    this.fire.mat.uniforms.uScale.value = this.smoke.mat.uniforms.uScale.value = this.size()[1] * 0.5 / Math.tan(C.fov * Math.PI / 360);
    // camera
    this.mouse.lerp(this.mt, 1 - Math.exp(-dt * 2));
    const shot = this.shot(p, this.ps, t);
    C.position.copy(shot.pos); C.lookAt(shot.look);
    const sk = shot.shake || 0; if (sk) { C.position.add(V((Math.random() - 0.5) * sk * 3, (Math.random() - 0.5) * sk * 3, 0)); }
    C.rotateY(-this.mouse.x * 0.02); C.rotateX(-this.mouse.y * 0.015);
    C.fov = shot.fov; C.near = shot.inside || shot.phone ? 0.05 : 0.6; C.far = shot.inside ? 6000 : 40000; C.updateProjectionMatrix();
    // sun shadow follows what the camera is looking at
    const focus = shot.inside ? TWR.clone().setY(CAB) : (p < 0.145 && p >= 0.075) || (p >= 0.76 && p < 0.86) || (p >= 0.3 && p < 0.335) ? fl.pos.clone() : PL.position.clone();
    this.sun.position.copy(focus).addScaledVector(this.sunDir, 600); this.sun.target.position.copy(focus);
    // sentry state
    const A2 = p >= 0.5, alert = A2 && p > 0.676 && p < 0.79 ? 1 : 0, clear = A2 && p >= 0.79;
    const pc = this.phoneCam, boxes = []; let count = 0;
    this.geese.forEach((g) => { if (!g.visible) return; const v = g.position.clone().project(pc); if (v.z < 1 && Math.abs(v.x) < 1 && Math.abs(v.y) < 1) { const dd = g.position.distanceTo(pc.position); boxes.push([(v.x + 1) / 2, (1 - v.y) / 2, 900 / dd]); count++; } });
    const sstate = { alert, clear, boxes, count, flock: fl.pos, dist: Math.max(0, Math.abs(fl.pos.z) - 22), risk: fl.air ? 0.5 : 0.22, stripState: p < 0.676 ? 'CLRD T/O' : p < 0.86 ? 'HOLD' : 'CLRD T/O' };
    if (this.screens && (shot.inside || (p > 0.6 && p < 0.9)) && (this.fc = (this.fc || 0) + 1) % 3 === 0) this.drawScreens(t, sstate);
    if (this.screens) {
      this.redLight.intensity = alert ? 2.5 * (Math.sin(t * 11) > -0.3 ? 1 : 0.25) : 0;
      // live feed for the monitor and the phone: render the phone's view into a texture
      if (shot.inside || shot.phone) {
        const fade = S.fog; this.towerG.visible = false;
        this.renderer.setRenderTarget(this.feedRT); this.renderer.render(S, pc); this.renderer.setRenderTarget(null);
        this.towerG.visible = true; S.fog = fade;
        if (!this.feedSet) { this.screens.sentry.feed.material = this.feedMat; this.feedSet = true; }
      }
    }
    // grade: black interlude, flash on impact, red pulse on alert, rewind tint
    Gd.uFlash.value.set(0, 0, 0); Gd.uSat.value = 1; Gd.uTint.value.set(1.06, 1.0, 0.9); Gd.uExp.value = this.expo || 0.2;
    if (shot.black) Gd.uExp.value = 0;
    { let d = 1; for (const b of CUTS) d = Math.min(d, Math.abs(p - b)); Gd.uExp.value *= 0.04 + 0.96 * ss(0.0004, 0.0042, d); }
    if (p > 0.425 && p < 0.445) Gd.uExp.value *= 1 - ss(0.425, 0.445, p);
    if (p > 0.5 && p < 0.512) { const k = 1 - ss(0.5, 0.512, p); Gd.uSat.value = 1 - k * 0.8; Gd.uTint.value.set(1 - k * 0.3, 1 - k * 0.1, 1 + k * 0.4); }
    if (p > 0.352 && p < 0.36) Gd.uFlash.value.set(0.4, 0.25, 0.1);
    Gd.uCA.value = 0.0012 + (this.shake || 0) * 0.01; Gd.uT.value = t;
    this.sock.rotation.z = Math.sin(t * 1.3) * 0.05 - 0.08; if (this.obstacle) this.obstacle.visible = Math.sin(t * 3.2) > 0;
    this.post.c.render(dt);
    // subtitles and titles
    const L = LINES.find((l) => p >= l[0] && p < l[1]), key = L ? L[0] : -1;
    if (this.sound && this.ac && this.gEngine) {
      const ct = this.ac.currentTime, dist = C.position.distanceTo(PL.position), near = 1 / (1 + dist / 220);
      this.gEngine.gain.setTargetAtTime(PL.visible ? (0.12 + st.thrust * 0.9) * near * (shot.inside ? 0.25 : 1) * (st.fire ? 1.3 : 1) : 0, ct, 0.15);
      this.gWind.gain.setTargetAtTime(shot.black ? 0 : shot.inside ? 0.08 : 0.3, ct, 0.3);
      this.gAlarm.gain.setTargetAtTime(alert ? (shot.inside ? 0.7 : 0.15) : 0, ct, 0.05);
      if (key !== this.voiceKey) { const idx = LINES.indexOf(L), clip = idx >= 0 ? CLIPS[idx] : null; if (clip && p > (this.lastVoiceP || 0)) { if (this.voice) try { this.voice.stop(); } catch (e) {} this.voice = this.play(clip, 1.0); } this.voiceKey = key; }
      if (this.lastSndP != null && this.lastSndP < 0.352 && p >= 0.352) this.play('thump', 1);
      if (st.crashed && !this.boomPlayed) { this.boomPlayed = true; this.play('boom', 1); }
      if (p < 0.4) this.boomPlayed = false;
      this.lastVoiceP = p; this.lastSndP = p;
    }
    if (key !== this.subKey && this.sub) { this.subKey = key; this.sub.dataset.on = L ? '1' : '0'; if (L) { this.sub.querySelector('[data-who]').textContent = L[2]; this.sub.querySelector('[data-line]').textContent = L[3]; this.sub.dataset.kind = L[2] === 'SKY SENTRY' ? 'alert' : L[2] ? 'radio' : 'caption'; } }
    const Ti = TITLES.find((l) => p >= l[0] && p < l[1]), tk = Ti ? Ti[0] : -1;
    if (tk !== this.titleKey && this.title) { this.titleKey = tk; this.title.dataset.on = Ti ? '1' : '0'; if (Ti) this.title.textContent = Ti[2]; }
  };
  SkyFilm.prototype.dispose = function () { this.dead = true; cancelAnimationFrame(this.raf); window.removeEventListener('resize', this.onResize); window.removeEventListener('pointermove', this.onMove); this.renderer.dispose(); };
  window.SkyFilm = SkyFilm;
})();
