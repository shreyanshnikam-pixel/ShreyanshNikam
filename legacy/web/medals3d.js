/* Struck medals in three.js: displaced relief faces, reeded edges, enamel, ribbons, studio lighting.
   window.Medals3D(canvas, items, { stage, theme, captions }) */
(function () {
  const T = THREE, FK = window.FK;
  const METAL = { gold: [0xffd47e, 0x8a5a10], silver: [0xe6e8ec, 0x5a616c], red: [0xffd47e, 0x8a5a10], teal: [0xdfe3e8, 0x525a68] };
  const ENAMEL = { red: '#b0101e', teal: '#0f8d7e' };
  const RIBBON = { gold: ['#7a0e10', '#f2c14e', '#7a0e10'], silver: ['#1b2a4a', '#e8e8ec', '#1b2a4a'], red: ['#c8102e', '#ffffff', '#c8102e'], teal: ['#0c5a50', '#9ff2e6', '#0c5a50'] };

  function relief(m) { // white = raised. front on the left half, back on the right
    const c = document.createElement('canvas'); c.width = 2048; c.height = 1024; const g = c.getContext('2d');
    g.scale(2, 2); g.fillStyle = '#000'; g.fillRect(0, 0, 1024, 512);
    const side = (ox, top, main, bot, back) => {
      const cx = ox + 256, cy = 256; g.save();
      g.strokeStyle = '#262626'; g.lineWidth = 1.1; for (let r = 30; r < 205; r += 5) { g.beginPath(); g.arc(cx, cy, r, 0, 7); g.stroke(); }
      let gr = g.createRadialGradient(cx, cy, 212, cx, cy, 256); gr.addColorStop(0, '#000'); gr.addColorStop(0.15, '#fff'); gr.addColorStop(0.8, '#fff'); gr.addColorStop(1, '#9a9a9a');
      g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, 256, 0, 7); g.arc(cx, cy, 212, 0, 7, true); g.fill();
      g.fillStyle = '#d8d8d8'; for (let a = 0; a < 64; a++) { const an = a / 64 * Math.PI * 2; g.beginPath(); g.arc(cx + Math.cos(an) * 201, cy + Math.sin(an) * 201, 4, 0, 7); g.fill(); }
      const arcText = (txt, rad, size, bottom) => {
        g.font = '700 ' + size + 'px Geist, Arial, sans-serif'; g.fillStyle = '#fff';
        const ch = txt.split(''), ws = ch.map((x) => g.measureText(x).width + size * 0.14), tot = ws.reduce((a, b) => a + b, 0);
        let ang = (bottom ? 1 : -1) * Math.PI / 2 - (bottom ? -1 : 1) * tot / rad / 2;
        ch.forEach((x, i) => { const a = ang + (bottom ? -1 : 1) * ws[i] / rad / 2; g.save(); g.translate(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad); g.rotate(a + (bottom ? -Math.PI / 2 : Math.PI / 2)); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(x, 0, 0); g.restore(); ang += (bottom ? -1 : 1) * ws[i] / rad; });
      };
      if (top) arcText(top, 170, 28, false);
      if (bot) arcText(bot, 172, 23, true);
      if (!back) { g.fillStyle = '#fff'; for (const s of [-1, 1]) for (let k = 0; k < 8; k++) { const an = Math.PI / 2 + s * (0.5 + k * 0.12), rr = 136; g.save(); g.translate(cx + Math.cos(an) * rr, cy + Math.sin(an) * rr); g.rotate(an + s * 0.9); g.beginPath(); g.ellipse(0, 0, 12, 5, 0, 0, 7); g.fill(); g.restore(); } }
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff';
      const lines = main.split('|'); let fs = lines.length > 1 ? 60 : 70; g.font = '800 ' + fs + 'px Geist, Arial, sans-serif';
      const mw = Math.max.apply(null, lines.map((l) => g.measureText(l).width)); if (mw > 290) { fs = Math.floor(fs * 290 / mw); g.font = '800 ' + fs + 'px Geist, Arial, sans-serif'; }
      lines.forEach((l, i) => g.fillText(l, cx, cy + (i - (lines.length - 1) / 2) * fs * 1.04 - (back ? 0 : 6)));
      g.restore();
    };
    side(0, m.top || '', m.main || '', m.bot || '', false);
    side(512, m.b1 || 'SHREYANSH NIKAM', m.b2 || '2026', m.b3 || '', true);
    const o = document.createElement('canvas'); o.width = 2048; o.height = 1024; const og = o.getContext('2d'); og.filter = 'blur(2.2px)'; og.drawImage(c, 0, 0);
    return o;
  }
  function maps(h, mat) {
    const W = h.width, H = h.height, src = h.getContext('2d').getImageData(0, 0, W, H).data;
    const n = document.createElement('canvas'); n.width = W; n.height = H; const nd = n.getContext('2d').createImageData(W, H);
    const col = document.createElement('canvas'); col.width = W; col.height = H; const cd = col.getContext('2d').createImageData(W, H);
    const orm = document.createElement('canvas'); orm.width = W; orm.height = H; const od = orm.getContext('2d').createImageData(W, H);
    const hv = (x, y) => src[((Math.min(H - 1, Math.max(0, y)) * W) + Math.min(W - 1, Math.max(0, x))) * 4] / 255;
    const met = new T.Color(METAL[mat][0]), en = ENAMEL[mat] ? new T.Color(ENAMEL[mat]) : null, s = 6.0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4, dx = (hv(x + 1, y) - hv(x - 1, y)) * s, dy = (hv(x, y + 1) - hv(x, y - 1)) * s, l = Math.hypot(dx, dy, 1);
      nd.data[i] = (-dx / l * 0.5 + 0.5) * 255; nd.data[i + 1] = (dy / l * 0.5 + 0.5) * 255; nd.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; nd.data[i + 3] = 255;
      const hh = hv(x, y), lx = (x % (W / 2)) - W / 4, ly = y - H / 2, r = Math.hypot(lx, ly) / (W / 4);
      const field = en && r < 0.78 && hh < 0.22 && x < W / 2;
      const c = field ? en : met, k = field ? 1 : 0.82 + hh * 0.18;
      cd.data[i] = c.r * 255 * k; cd.data[i + 1] = c.g * 255 * k; cd.data[i + 2] = c.b * 255 * k; cd.data[i + 3] = 255;
      od.data[i] = 255; od.data[i + 1] = field ? 30 : (hh > 0.6 ? 45 : 95); od.data[i + 2] = field ? 0 : 255; od.data[i + 3] = 255;
    }
    n.getContext('2d').putImageData(nd, 0, 0); col.getContext('2d').putImageData(cd, 0, 0); orm.getContext('2d').putImageData(od, 0, 0);
    return { n, col, orm };
  }
  function ribbonTex(cols) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 512; const g = c.getContext('2d');
    const bands = [cols[0], cols[1], cols[2], cols[1], cols[0]], w = [0.3, 0.12, 0.16, 0.12, 0.3]; let x = 0;
    bands.forEach((b, i) => { g.fillStyle = b; g.fillRect(x, 0, w[i] * 256 + 1, 512); x += w[i] * 256; });
    for (let y = 0; y < 512; y += 2) { g.fillStyle = `rgba(0,0,0,${0.04 + Math.random() * 0.05})`; g.fillRect(0, y, 256, 1); }
    for (let xx = 0; xx < 256; xx += 3) { g.fillStyle = 'rgba(255,255,255,0.035)'; g.fillRect(xx, 0, 1, 512); }
    const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.anisotropy = 8; return t;
  }

  function makeMedal(m, env) {
    const grp = new T.Group(), mat = m.mat || 'gold';
    const h = relief(m), mp = maps(h, mat);
    const tex = (c, srgb) => { const t = new T.CanvasTexture(c); if (srgb) t.encoding = T.sRGBEncoding; t.anisotropy = 16; return t; };
    const hT = tex(h), nT = tex(mp.n), cT = tex(mp.col, true), oT = tex(mp.orm);
    const faceMat = new T.MeshPhysicalMaterial({ map: cT, normalMap: nT, normalScale: new T.Vector2(1.1, 1.1), roughnessMap: oT, metalnessMap: oT, metalness: 1, roughness: 1,
      displacementMap: hT, displacementScale: 0.035, clearcoat: ENAMEL[mat] ? 0.9 : 0.2, clearcoatRoughness: 0.08, envMapIntensity: 1.25 });
    const face = (back) => {
      const g = new T.RingGeometry(0.0005, 1, 160, 90), uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) { const u = uv.getX(i); uv.setX(i, u * 0.5 + (back ? 0.5 : 0)); }
      const mesh = new T.Mesh(g, faceMat); mesh.position.z = back ? -0.05 : 0.05; if (back) mesh.rotation.y = Math.PI; mesh.castShadow = true; return mesh;
    };
    grp.add(face(false)); grp.add(face(true));
    const ec = document.createElement('canvas'); ec.width = 1024; ec.height = 8; const eg = ec.getContext('2d');
    for (let x = 0; x < 1024; x++) { const v = 0.5 + 0.5 * Math.sin(x / 1024 * Math.PI * 2 * 180); eg.fillStyle = `rgb(${128 + (v - 0.5) * 200},128,255)`; eg.fillRect(x, 0, 1, 8); }
    const edgeN = tex(ec); edgeN.wrapS = T.RepeatWrapping;
    const edge = new T.Mesh(new T.CylinderGeometry(1.012, 1.012, 0.14, 360, 1, true), new T.MeshPhysicalMaterial({ color: METAL[mat][0], metalness: 1, roughness: 0.28, normalMap: edgeN, normalScale: new T.Vector2(0.9, 0.9), envMapIntensity: 1.25 }));
    edge.rotation.x = Math.PI / 2; edge.castShadow = true; grp.add(edge);
    const lip = new T.Mesh(new T.TorusGeometry(1.0, 0.035, 16, 200), new T.MeshPhysicalMaterial({ color: METAL[mat][0], metalness: 1, roughness: 0.18, envMapIntensity: 1.3 }));
    lip.scale.z = 1.9; grp.add(lip);
    const metal = new T.MeshPhysicalMaterial({ color: METAL[mat][0], metalness: 1, roughness: 0.25, envMapIntensity: 1.3 });
    const eye = new T.Mesh(new T.TorusGeometry(0.11, 0.03, 16, 40), metal); eye.position.y = 1.08; grp.add(eye);
    const ring = new T.Mesh(new T.TorusGeometry(0.17, 0.024, 16, 48), metal); ring.position.y = 1.25; ring.rotation.y = Math.PI / 2; grp.add(ring);
    // ribbon: two folded strips rising from the ring, with a little cloth sag
    const rt = ribbonTex(RIBBON[mat]);
    const rm = new T.MeshPhysicalMaterial({ map: rt, roughness: 0.62, sheen: 0.35, sheenRoughness: 0.6, sheenColor: new T.Color(0x999999), side: T.DoubleSide, envMapIntensity: 0.6 });
    if (!m.noRibbon) for (const s of [-1, 1]) {
      const g = new T.PlaneGeometry(0.42, 4.2, 8, 40); g.translate(0, 2.1, 0);
      const pos = g.attributes.position;
      for (let i = 0; i < pos.count; i++) { const y = pos.getY(i), x = pos.getX(i); pos.setZ(i, s * 0.04 * Math.sin(y * 1.7) + Math.sin(x * 9 + y * 2) * 0.008); pos.setX(i, x + s * y * 0.17); }
      g.computeVertexNormals();
      const r = new T.Mesh(g, rm); r.position.y = 1.36; r.castShadow = true; grp.add(r);
    }
    return grp;
  }

  function Medals3D(canvas, items, opts) {
    const self = this; opts = opts || {};
    this.cv = canvas; this.items = items; this.dead = false; this.opts = opts;
    this.reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const R = this.renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: !opts.stage, powerPreference: 'high-performance' });
    R.outputEncoding = T.sRGBEncoding; R.toneMapping = T.ACESFilmicToneMapping; R.toneMappingExposure = opts.exposure || 1.25;
    R.shadowMap.enabled = !!opts.stage; R.shadowMap.type = T.PCFSoftShadowMap; R.physicallyCorrectLights = true;
    const S = this.scene = new T.Scene();
    const pm = new T.PMREMGenerator(R); S.environment = pm.fromScene(new T.RoomEnvironment(), 0.04).texture;
    const theme = opts.theme || {};
    const acc = new T.Color(theme.acc || '#ff3b30');
    if (opts.stage) {
      S.background = new T.Color(theme.bg || '#07080b'); S.fog = new T.Fog(S.background, 14, 34);
      const floor = new T.Mesh(new T.PlaneGeometry(80, 80), new T.MeshPhysicalMaterial({ color: 0x040405, roughness: 0.3, metalness: 0.1, clearcoat: 0.6, clearcoatRoughness: 0.2, envMapIntensity: 0.25 }));
      floor.rotation.x = -Math.PI / 2; floor.position.y = -2.1; floor.receiveShadow = true; S.add(floor);
      const ped = new T.MeshPhysicalMaterial({ color: 0x15161a, roughness: 0.55, metalness: 0.3, clearcoat: 0.3 });
      this.peds = [];
      const glow = new T.PointLight(acc, 8, 16, 2); glow.position.set(0, -1.2, -4); S.add(glow);
      const back = new T.Mesh(new T.PlaneGeometry(60, 20), new T.MeshBasicMaterial({ color: acc.clone().multiplyScalar(0.12) })); back.position.set(0, 6, -14); S.add(back);
      void ped;
    }
    S.add(new T.HemisphereLight(0xbfd0ff, 0x1a120c, 0.4));
    const key = new T.DirectionalLight(0xfff1e0, 2.6); key.position.set(-4, 7, 6); key.castShadow = !!opts.stage; key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -10, right: 10, top: 8, bottom: -6, near: 1, far: 30 }); key.shadow.bias = -0.0005; key.shadow.radius = 6; S.add(key);
    const rim = new T.DirectionalLight(acc, 2.2); rim.position.set(5, 2, -6); S.add(rim);
    this.medals = [];
    const n = items.length, gap = opts.gap || 2.9;
    items.forEach((it, i) => {
      const m = makeMedal(it.gl || it, S.environment), sc = it.big ? 1.25 : 1;
      const pivot = new T.Group(); pivot.add(m); m.scale.setScalar(sc);
      const x = (i - (n - 1) / 2) * gap; pivot.position.set(x, opts.stage ? 0.3 : 0, 0);
      pivot.userData = { x, ph: i * 1.7, spin: 0, vel: 0, drop: 0, sc };
      if (opts.stage) {
        const sp = new T.SpotLight(0xfff4e6, 170, 22, 0.3, 0.7, 1.6); sp.position.set(x - 1, 9, 5); sp.target = pivot; sp.castShadow = true; sp.shadow.mapSize.set(1024, 1024); sp.shadow.bias = -0.0004; S.add(sp);
        const pd = new T.Mesh(new T.CylinderGeometry(0.95, 1.05, 0.5, 64), new T.MeshPhysicalMaterial({ color: 0x141518, roughness: 0.35, metalness: 0.6, clearcoat: 0.5 })); pd.position.set(x, -1.85, 0); pd.receiveShadow = pd.castShadow = true; S.add(pd);
      }
      S.add(pivot); this.medals.push(pivot);
    });
    const C = this.camera = new T.PerspectiveCamera(opts.stage ? 30 : 26, 1, 0.1, 100);
    this.fit = () => {
      const r = canvas.getBoundingClientRect(), w = Math.max(2, r.width | 0), h = Math.max(2, r.height | 0);
      R.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); R.setSize(w, h, false); C.aspect = w / h;
      const span = n * gap * 0.5 + 1.4, vfov = C.fov * Math.PI / 180, need = Math.max(span / Math.tan(vfov / 2) / C.aspect, (opts.stage ? 4.9 : 1.6) / Math.tan(vfov / 2));
      this.dist = need * (opts.stage ? 1.08 : 1.05); C.updateProjectionMatrix();
    };
    this.onResize = () => this.fit(); window.addEventListener('resize', this.onResize); this.fit();
    // drag to turn a medal
    this.ray = new T.Raycaster(); this.ptr = new T.Vector2(); this.mt = new T.Vector2(); this.mouse = new T.Vector2();
    const pick = (e) => { const r = canvas.getBoundingClientRect(); this.ptr.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1); this.ray.setFromCamera(this.ptr, C); let best = null, bd = 1e9; this.medals.forEach((m) => { const d = this.ray.ray.distanceToPoint(m.position); if (d < bd) { bd = d; best = m; } }); return bd < 1.6 ? best : null; };
    this.onDown = (e) => { this.drag = pick(e); this.lx = e.clientX; if (this.drag) canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId); };
    this.onDrag = (e) => { const r = canvas.getBoundingClientRect(); this.mt.set((e.clientX - r.left) / r.width * 2 - 1, (e.clientY - r.top) / r.height * 2 - 1); if (this.drag) { const dx = e.clientX - this.lx; this.lx = e.clientX; this.drag.userData.vel = dx * 0.012; this.drag.userData.spin += dx * 0.012; } canvas.style.cursor = this.drag || pick(e) ? 'grab' : ''; };
    this.onUp = () => { this.drag = null; };
    canvas.addEventListener('pointerdown', this.onDown); window.addEventListener('pointermove', this.onDrag, { passive: true }); window.addEventListener('pointerup', this.onUp);
    this.caps = opts.captions || [];
    this.t0 = performance.now(); this.inView = false;
    if ('IntersectionObserver' in window) { this.io = new IntersectionObserver((es) => es.forEach((e) => { self.inView = e.isIntersecting; if (e.isIntersecting && !self.shown) { self.shown = performance.now(); } }), { threshold: 0.15 }); this.io.observe(canvas); } else { this.inView = true; this.shown = performance.now(); }
    this.loop = this.loop.bind(this); this.raf = requestAnimationFrame(this.loop);
  }
  Medals3D.prototype.loop = function (now) {
    if (this.dead) return; this.raf = requestAnimationFrame(this.loop);
    if (!this.inView) return;
    const dt = Math.min(0.05, (now - (this.lt || now)) / 1000); this.lt = now;
    const t = (now - this.t0) / 1000, C = this.camera, st = this.opts.stage, red = this.reduced;
    this.mouse.lerp(this.mt, 1 - Math.exp(-dt * 2));
    const orbit = red ? 0 : Math.sin(t * 0.09) * 0.22;
    const ang = orbit + this.mouse.x * 0.16, el = (st ? 0.16 : 0.02) - this.mouse.y * 0.06;
    C.position.set(Math.sin(ang) * this.dist, Math.sin(el) * this.dist + (st ? 0.4 : 0), Math.cos(ang) * this.dist); C.lookAt(0, st ? 0.75 : 0, 0);
    const since = this.shown ? (now - this.shown) / 1000 : 0;
    this.medals.forEach((m, i) => {
      const u = m.userData;
      const d = red ? 1 : FK.ss(0.15 + i * 0.25, 1.9 + i * 0.25, since); // slow, heavy drop from above
      m.position.y = (st ? 0.3 : 0) + (1 - d) * (1 - d) * 7 + (red ? 0 : Math.sin(t * 0.55 + u.ph) * 0.05);
      if (!this.drag || this.drag !== m) { u.vel *= Math.exp(-dt * 0.9); u.spin += u.vel * dt * 60 * 0.2; }
      const idle = red ? 0 : t * 0.22 + Math.sin(t * 0.37 + u.ph) * 0.55;
      m.rotation.y = idle + u.spin + (1 - d) * 3; m.rotation.z = red ? 0 : Math.sin(t * 0.6 + u.ph) * 0.03;
    });
    this.renderer.render(this.scene, C);
    // captions follow their medal on screen
    if (this.caps.length) {
      const r = this.cv.getBoundingClientRect();
      this.caps.forEach((el, i) => { const m = this.medals[i]; if (!m || !el) return; const v = new T.Vector3(m.userData.x, -2.1, 1.2).project(C); el.style.transform = `translate(${((v.x + 1) / 2 * r.width).toFixed(1)}px, ${((1 - v.y) / 2 * r.height + 14).toFixed(1)}px) translate(-50%, 0)`; });
    }
  };
  Medals3D.prototype.dispose = function () { this.dead = true; cancelAnimationFrame(this.raf); window.removeEventListener('resize', this.onResize); window.removeEventListener('pointermove', this.onDrag); window.removeEventListener('pointerup', this.onUp); if (this.io) this.io.disconnect(); this.renderer.dispose(); };
  Medals3D.make = makeMedal;
  window.Medals3D = Medals3D;
})();
