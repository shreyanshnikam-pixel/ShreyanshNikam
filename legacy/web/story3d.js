/* Scroll-driven 3D walkthroughs: the camera travels between real 3D objects while the text for each stop sits beside them.
   window.Story3D(section, { stage, canvas, panels, stops: [{prop}], theme: {acc, bg} }) */
(function () {
  const T = THREE, FK = window.FK, V = (x, y, z) => new T.Vector3(x, y, z);
  let ENV = null;
  const std = (c, o) => new T.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.5, metalness: 0.1 }, o || {}));
  const phys = (c, o) => new T.MeshPhysicalMaterial(Object.assign({ color: c, roughness: 0.3, metalness: 0.0, clearcoat: 0.6 }, o || {}));
  const glow = (c, k) => new T.MeshBasicMaterial({ color: new T.Color(c).multiplyScalar(k || 3), toneMapped: false });
  const canvasTex = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.anisotropy = 8; t.userData = { c, draw }; return t; };
  const mesh = (g, m, p, r, s) => { const o = new T.Mesh(g, m); if (p) o.position.set(p[0], p[1], p[2]); if (r) o.rotation.set(r[0], r[1], r[2]); if (s) o.scale.set(s[0], s[1], s[2]); o.castShadow = o.receiveShadow = true; return o; };
  const label = (txt, sub, acc, w, h) => canvasTex(w || 512, h || 256, (x, W, H) => {
    x.clearRect(0, 0, W, H); x.fillStyle = '#ffffff'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = `800 ${H * 0.42}px "Big Shoulders", "Fraunces", Geist, sans-serif`; x.fillText(txt, W / 2, H * (sub ? 0.4 : 0.5));
    if (sub) { x.font = `500 ${H * 0.12}px Geist, sans-serif`; x.fillStyle = acc || '#cccccc'; x.fillText(sub, W / 2, H * 0.78); }
  });
  const plate = (tex, w, h) => { const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, depthWrite: false })); return m; };

  // ---------- props: real objects for each stop ----------
  const P = {};
  P.laptop = (acc) => {
    const g = new T.Group(), al = std(0xb9bcc4, { metalness: 0.9, roughness: 0.32 });
    g.add(mesh(new T.BoxGeometry(3.0, 0.1, 2.0), al, [0, 0, 0]));
    const scr = canvasTex(1024, 640, (x, W, H) => { x.fillStyle = '#0b0d12'; x.fillRect(0, 0, W, H); x.font = '500 24px "Geist Mono", monospace';
      const L = ['export function ping(world) {', '  const ring = world.emit(pos, 18);', '  listeners.forEach(l => l.hear(ring));', '}', '', 'def detect(frame):', '  boxes = model(frame)', '  return [b for b in boxes if b.conf > .6]', '', '// ship it.'];
      L.forEach((l, i) => { x.fillStyle = i % 5 === 0 ? acc : '#c9d1e0'; x.fillText(l, 40, 70 + i * 50); }); });
    const lid = new T.Group(); lid.position.set(0, 0.05, -1.0); lid.rotation.x = -0.28; g.add(lid);
    lid.add(mesh(new T.BoxGeometry(3.0, 2.0, 0.07), al, [0, 1.0, 0]));
    const s = new T.Mesh(new T.PlaneGeometry(2.8, 1.75), new T.MeshBasicMaterial({ map: scr, toneMapped: false })); s.position.set(0, 1.0, 0.04); lid.add(s);
    g.add(mesh(new T.BoxGeometry(2.6, 0.02, 1.0), std(0x1a1b1f), [0, 0.06, 0.25]));
    return g;
  };
  P.pillars = (acc) => {
    const g = new T.Group(), marble = phys(0xb8b2a8, { roughness: 0.3, envMapIntensity: 0.6 });
    [['39', 'AP courses', 3.4], ['13', 'dual enrollment', 2.4], ['5', 'pathways', 1.6], ['474', 'AP Scholars', 4.0]].forEach((d, i) => {
      const x = (i - 1.5) * 1.35, h = d[2];
      const col = mesh(new T.CylinderGeometry(0.42, 0.46, h, 24, 1), marble, [x, h / 2, 0]); g.add(col);
      for (let k = 0; k < 16; k++) { const f = mesh(new T.CylinderGeometry(0.03, 0.03, h * 0.94, 6), std(0xcfc9be), [x + Math.cos(k / 16 * 6.283) * 0.43, h / 2, Math.sin(k / 16 * 6.283) * 0.43]); g.add(f); }
      g.add(mesh(new T.BoxGeometry(1.1, 0.16, 1.1), marble, [x, h + 0.08, 0])); g.add(mesh(new T.BoxGeometry(1.1, 0.16, 1.1), marble, [x, 0.08, 0]));
      const lb = plate(label(d[0], d[1], acc), 1.4, 0.7); lb.position.set(x, h + 0.65, 0); g.add(lb);
    });
    return g;
  };
  P.stairs = (acc) => {
    const g = new T.Group();
    [['College Prep', 0.6, 0x3a3b41], ['Honors', 1.2, null], ['AP', 1.8, 0x2a2b30]].forEach((d, i) => {
      const m = d[2] == null ? phys(acc, { roughness: 0.25, emissive: new T.Color(acc), emissiveIntensity: 0.25 }) : phys(d[2]);
      g.add(mesh(new T.BoxGeometry(1.5, d[1], 2.2), m, [(i - 1) * 1.5, d[1] / 2, 0]));
      const lb = plate(label(d[0], i === 1 ? 'highest level open to freshmen' : i === 2 ? 'opens in later years' : '', '#ffd9d6', 512, 200), 1.6, 0.62); lb.position.set((i - 1) * 1.5, d[1] + 0.45, 0.4); g.add(lb);
    });
    const me = mesh(new T.SphereGeometry(0.18, 32, 16), glow(0xffffff, 2), [0, 1.42, 0.6]); me.userData.bob = 1; g.add(me);
    return g;
  };
  const UT = { value: 0 };
  P.pool = (acc) => {
    const g = new T.Group(), L = 6.4, W = 4.2, D = 0.9;
    // tiled basin: white tiles, black lane lines with T ends, caustics drifting over the floor
    const tile = canvasTex(1024, 672, (x, w, h) => {
      x.fillStyle = '#d9e6ea'; x.fillRect(0, 0, w, h); const ts = 16;
      for (let i = 0; i < w; i += ts) for (let j = 0; j < h; j += ts) { x.fillStyle = `rgba(${200 + Math.random() * 30},${220 + Math.random() * 20},${226 + Math.random() * 20},1)`; x.fillRect(i + 1, j + 1, ts - 2, ts - 2); }
      x.fillStyle = '#1b2a33'; for (let k = 0; k < 4; k++) { const y = (k + 0.5) / 4 * h; x.fillRect(w * 0.06, y - 6, w * 0.88, 12); x.fillRect(w * 0.06, y - 30, 12, 60); x.fillRect(w * 0.94 - 12, y - 30, 12, 60); }
    });
    const wallT = canvasTex(512, 128, (x, w, h) => { x.fillStyle = '#cfe0e6'; x.fillRect(0, 0, w, h); for (let i = 0; i < w; i += 16) for (let j = 0; j < h; j += 16) { x.fillStyle = '#e4eef1'; x.fillRect(i + 1, j + 1, 14, 14); } x.fillStyle = '#1b2a33'; x.fillRect(0, h - 22, w, 10); });
    wallT.wrapS = T.RepeatWrapping; wallT.repeat.set(4, 1);
    const floorM = new T.MeshStandardMaterial({ map: tile, roughness: 0.35, color: 0x9fc9d3 });
    FK.patch(floorM, 'pool-caustics', { uT: UT }, 'uniform float uT;', [
      '{ vec2 q = vWP.xz * 2.6; float c = 0.0;',
      '  for (int i = 0; i < 3; i++) { float fi = float(i); vec2 o = vec2(sin(uT * 0.5 + fi * 1.7), cos(uT * 0.43 + fi * 2.3));',
      '    vec2 p2 = q * (1.0 + fi * 0.37) + o; c += pow(abs(sin(p2.x + sin(p2.y * 1.3 + uT * 0.7)) * sin(p2.y + sin(p2.x * 1.1 - uT * 0.6))), 6.0); }',
      '  outgoingLight += vec3(0.75, 0.95, 1.0) * c * 0.55; }'].join('\n'), true);
    const fl = mesh(new T.PlaneGeometry(L, W).rotateX(-Math.PI / 2), floorM, [0, -D, 0]); g.add(fl);
    const wm = new T.MeshStandardMaterial({ map: wallT, roughness: 0.4, side: T.DoubleSide });
    g.add(mesh(new T.PlaneGeometry(L, D), wm, [0, -D / 2, -W / 2])); g.add(mesh(new T.PlaneGeometry(L, D), wm, [0, -D / 2, W / 2], [0, Math.PI, 0]));
    g.add(mesh(new T.PlaneGeometry(W, D), wm, [-L / 2, -D / 2, 0], [0, Math.PI / 2, 0])); g.add(mesh(new T.PlaneGeometry(W, D), wm, [L / 2, -D / 2, 0], [0, -Math.PI / 2, 0]));
    // water: refracting, gently moving surface
    const water = new T.Mesh(new T.PlaneGeometry(L, W, 96, 64).rotateX(-Math.PI / 2), new T.MeshPhysicalMaterial({ color: 0x1690aa, roughness: 0.06, metalness: 0, transparent: true, opacity: 0.5, clearcoat: 0.6, clearcoatRoughness: 0.05, envMapIntensity: 0.18, specularIntensity: 0.6, depthWrite: false }));
    water.position.y = -0.08; water.userData.wave = 1; g.add(water);
    // deck: non-slip stone around the basin, gutter edge
    const deck = new T.MeshStandardMaterial({ color: 0x3f3c37, roughness: 0.92 }), DH = D + 0.12;
    g.add(mesh(new T.BoxGeometry(L + 2.4, DH, 0.9), deck, [0, -DH / 2, -W / 2 - 0.45])); g.add(mesh(new T.BoxGeometry(L + 2.4, DH, 0.9), deck, [0, -DH / 2, W / 2 + 0.45]));
    g.add(mesh(new T.BoxGeometry(1.2, DH, W), deck, [-L / 2 - 0.6, -DH / 2, 0])); g.add(mesh(new T.BoxGeometry(1.2, DH, W), deck, [L / 2 + 0.6, -DH / 2, 0]));
    // lane ropes: strings of floats, red near the walls, blue and white between
    const discG = new T.CylinderGeometry(0.06, 0.06, 0.09, 14).rotateZ(Math.PI / 2);
    for (let k = 1; k < 4; k++) { const z = -W / 2 + k * W / 4; for (let i = 0; i < 60; i++) { const x = -L / 2 + 0.06 + i * (L - 0.12) / 59, edge = i < 8 || i > 51; const d = mesh(discG, std(edge ? 0xc8102e : i % 2 ? 0x1f4fa8 : 0xf2f2f2, { roughness: 0.35 }), [x, -0.05, z]); d.userData.bobRope = i + k * 7; g.add(d); } }
    // starting blocks with lane numbers
    for (let k = 0; k < 4; k++) { const z = -W / 2 + (k + 0.5) * W / 4; g.add(mesh(new T.BoxGeometry(0.55, 0.5, 0.5), std(0xeeeeee, { roughness: 0.5 }), [-L / 2 - 0.35, 0.25, z], [0, 0, -0.12]));
      const n = plate(label(String(k + 1), '', '', 128, 128), 0.28, 0.28); n.position.set(-L / 2 - 0.05, 0.28, z); n.rotation.y = Math.PI / 2; g.add(n);
      g.add(mesh(new T.BoxGeometry(0.06, 0.5, 0.06), std(0x9aa0a8, { metalness: 0.8 }), [-L / 2 - 0.6, 0.6, z + 0.2])); }
    // backstroke flags strung across the pool
    for (const x of [-L / 2 + 1.0, L / 2 - 1.0]) { for (const z of [-W / 2 - 0.7, W / 2 + 0.7]) g.add(mesh(new T.CylinderGeometry(0.03, 0.03, 1.9, 8), std(0xd8dce0, { metalness: 0.8 }), [x, 0.9, z]));
      for (let i = 0; i < 14; i++) { const fg = new T.BufferGeometry().setFromPoints([V(0, 0, -0.1), V(0, 0, 0.1), V(0, -0.24, 0)]); fg.computeVertexNormals(); const f = mesh(fg, new T.MeshStandardMaterial({ color: [0xc8102e, 0xffffff, 0x1f4fa8][i % 3], side: T.DoubleSide }), [x, 1.8, -W / 2 - 0.6 + i * (W + 1.2) / 13]); f.userData.flag = i; g.add(f); } }
    g.position.y = D + 0.12; g.userData.lift = D + 0.12;
    return g;
  };
  P.medals = () => { const g = new T.Group(); if (window.Medals3D && window.Medals3D.make) { [['red', 'BEST USE OF', 'SOLANA'], ['teal', 'BEST USE OF', 'TIGERDATA'], ['silver', 'OVERALL', '5TH|PLACE'], ['gold', 'BEST OVERALL', '1ST|PRIZE']].forEach((d, i) => { const m = window.Medals3D.make({ mat: d[0], top: d[1], main: d[2], bot: i < 3 ? 'HACKPHS 2026' : 'HACK CLUB HAVEN', b3: i < 3 ? 'SKY SENTRY' : 'ECHO' }); m.scale.setScalar(i === 3 ? 0.75 : 0.6); m.position.set((i - 1.5) * 1.55, 1.6 + (i === 3 ? 0.15 : 0), 0); m.userData.spin = 0.4 + i * 0.07; g.add(m); }); } return g; };
  P.slabs = (acc) => {
    const g = new T.Group();
    ['Find the real problem', 'Build the smallest true version', 'Ship it, then make it good'].forEach((t, i) => {
      const s = mesh(new T.BoxGeometry(3.4, 0.12, 2.0), phys(i === 2 ? acc : 0x9aa3b2, { transmission: 0.6, roughness: 0.15, thickness: 0.4, transparent: true, opacity: 0.9 }), [0, 0.6 + i * 0.9, 0], [0, i * 0.18, 0]);
      s.userData.float = i; g.add(s);
      const lb = plate(label(t, '', '', 1024, 160), 3.2, 0.5); lb.position.set(0, 0.95 + i * 0.9, 1.05); g.add(lb);
    });
    return g;
  };
  P.phone = (acc) => {
    const g = new T.Group(), blk = std(0x141518, { metalness: 0.6, roughness: 0.35 });
    for (let k = 0; k < 3; k++) { const a = k * 2.094, l = mesh(new T.CylinderGeometry(0.03, 0.04, 2.6, 8), blk); l.position.set(Math.cos(a) * 0.5, 1.2, Math.sin(a) * 0.5); l.lookAt(0, 2.6, 0); l.rotateX(Math.PI / 2); g.add(l); }
    const ph = mesh(new T.BoxGeometry(1.6, 0.8, 0.09), phys(0x2a2d33, { metalness: 0.7, roughness: 0.25 }), [0, 2.85, 0]); g.add(ph);
    const scr = canvasTex(800, 400, (x, W, H) => { const gr = x.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#2c3e6b'); gr.addColorStop(0.6, '#d88a62'); gr.addColorStop(0.62, '#2a2a24'); x.fillStyle = gr; x.fillRect(0, 0, W, H); x.strokeStyle = acc; x.lineWidth = 5; [[220, 140], [330, 110], [430, 160]].forEach(([a, b]) => x.strokeRect(a, b, 70, 46)); x.fillStyle = acc; x.font = '700 22px monospace'; x.fillText('BIRD 0.94', 220, 128); });
    const s = new T.Mesh(new T.PlaneGeometry(1.5, 0.72), new T.MeshBasicMaterial({ map: scr, toneMapped: false })); s.position.set(0, 2.85, 0.05); g.add(s);
    return g;
  };
  P.rack = () => {
    const g = new T.Group(); g.add(mesh(new T.BoxGeometry(1.6, 3.6, 1.4), std(0x111216, { metalness: 0.7, roughness: 0.4 }), [0, 1.8, 0]));
    for (let i = 0; i < 8; i++) { g.add(mesh(new T.BoxGeometry(1.4, 0.32, 0.05), std(0x24262c, { metalness: 0.6 }), [0, 0.45 + i * 0.4, 0.71]));
      for (let k = 0; k < 6; k++) { const led = mesh(new T.SphereGeometry(0.03, 8, 6), glow(k % 3 ? 0x3ddc84 : 0x4aa3ff, 4), [-0.55 + k * 0.08, 0.45 + i * 0.4, 0.75]); led.userData.blink = Math.random() * 10; g.add(led); } }
    return g;
  };
  P.stacklight = () => {
    const g = new T.Group(); g.add(mesh(new T.CylinderGeometry(0.12, 0.12, 1.6, 16), std(0x2a2c31, { metalness: 0.8 }), [0, 0.8, 0]));
    [0x3ddc84, 0xffb02e, 0xff3b30].forEach((c, i) => { const m = new T.MeshPhysicalMaterial({ color: c, emissive: c, emissiveIntensity: 0, roughness: 0.2, transmission: 0.3, transparent: true, opacity: 0.92 }); const s = mesh(new T.CylinderGeometry(0.42, 0.42, 0.55, 32), m, [0, 1.9 + i * 0.6, 0]); s.userData.lamp = i; g.add(s); });
    g.add(mesh(new T.CylinderGeometry(0.45, 0.45, 0.08, 32), std(0x1a1b1f, { metalness: 0.8 }), [0, 3.55, 0]));
    return g;
  };
  P.database = (acc) => {
    const g = new T.Group();
    for (let i = 0; i < 4; i++) { const d = mesh(new T.CylinderGeometry(1.1, 1.1, 0.42, 64), phys(0x2b3140, { metalness: 0.5, roughness: 0.3 }), [0, 0.3 + i * 0.6, 0]); g.add(d);
      const r = mesh(new T.TorusGeometry(1.1, 0.025, 8, 96), glow(acc, 2.5), [0, 0.52 + i * 0.6, 0], [Math.PI / 2, 0, 0]); g.add(r); }
    return g;
  };
  P.tower = () => {
    const g = new T.Group(), c = std(0xcfc9be, { roughness: 0.85 }), dark = std(0x2a2d31, { metalness: 0.5 }), rail = std(0xd0d3d8, { metalness: 0.8, roughness: 0.35 });
    g.add(mesh(new T.CylinderGeometry(0.32, 0.42, 3.0, 40), c, [0, 1.5, 0]));
    for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; g.add(mesh(new T.BoxGeometry(0.06, 2.9, 0.08), c, [Math.cos(a) * 0.37, 1.45, Math.sin(a) * 0.37], [0, -a, 0])); }
    g.add(mesh(new T.CylinderGeometry(0.5, 0.36, 0.22, 40), c, [0, 3.1, 0])); g.add(mesh(new T.CylinderGeometry(0.52, 0.52, 0.14, 40), dark, [0, 3.28, 0]));
    g.add(mesh(new T.CylinderGeometry(0.7, 0.58, 0.1, 40), c, [0, 3.4, 0]));
    g.add(mesh(new T.CylinderGeometry(0.76, 0.6, 0.5, 8, 1, true), phys(0x4b6a82, { transparent: true, opacity: 0.55, roughness: 0.03, metalness: 0.2, clearcoat: 1, side: T.DoubleSide }), [0, 3.7, 0]));
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2 + Math.PI / 8; g.add(mesh(new T.BoxGeometry(0.025, 0.52, 0.025), dark, [Math.cos(a) * 0.68, 3.7, Math.sin(a) * 0.68], [Math.cos(a + Math.PI / 2) * -0.22, 0, Math.sin(a + Math.PI / 2) * 0.22])); }
    g.add(mesh(new T.TorusGeometry(0.74, 0.008, 4, 64), rail, [0, 3.62, 0], [Math.PI / 2, 0, 0]));
    g.add(mesh(new T.CylinderGeometry(0.72, 0.78, 0.07, 40), dark, [0, 3.99, 0])); g.add(mesh(new T.CylinderGeometry(0.4, 0.48, 0.14, 40), c, [0, 4.1, 0]));
    g.add(mesh(new T.SphereGeometry(0.14, 24, 12), std(0xf1efe9, { roughness: 0.5 }), [-0.2, 4.32, 0.1]));
    [[0.25, 0.1, 0.8], [0.1, -0.25, 0.55]].forEach(([x, z, h]) => g.add(mesh(new T.CylinderGeometry(0.008, 0.015, h, 6), dark, [x, 4.17 + h / 2, z])));
    const bl = mesh(new T.SphereGeometry(0.03, 8, 6), glow(0xff2010, 4), [0.25, 4.98, 0.1]); bl.userData.blink = 0; g.add(bl);
    g.add(mesh(new T.BoxGeometry(2.2, 0.6, 1.2), c, [0.9, 0.3, 0.6]));
    for (let i = 0; i < 3; i++) { const w = mesh(new T.TorusGeometry(0.9 + i * 0.5, 0.02, 6, 64, Math.PI * 0.6), glow(0xff3b30, 2.5), [0.3, 3.7, 0], [0, 0, -Math.PI * 0.3]); w.userData.wave = i; g.add(w); }
    return g;
  };
  P.waveform = (acc) => { const g = new T.Group(); for (let i = 0; i < 40; i++) { const b = mesh(new T.BoxGeometry(0.1, 1, 0.1), phys(acc, { emissive: new T.Color(acc), emissiveIntensity: 0.4 }), [(i - 20) * 0.15, 1.5, 0]); b.userData.bar = i; g.add(b); } return g; };
  P.docs = () => { const g = new T.Group(); for (let i = 0; i < 7; i++) { const t = canvasTex(400, 520, (x, W, H) => { x.fillStyle = '#f4f1ea'; x.fillRect(0, 0, W, H); x.fillStyle = '#1a1a1a'; x.font = '700 26px Geist, sans-serif'; x.fillText('INCIDENT REPORT', 30, 60); x.fillStyle = '#888'; for (let k = 0; k < 12; k++) x.fillRect(30, 100 + k * 30, 200 + Math.random() * 140, 8); x.fillStyle = '#c8102e'; x.fillRect(30, 470, 120, 20); });
      const p = mesh(new T.BoxGeometry(1.6, 2.1, 0.01), [std(0xeeeeee), std(0xeeeeee), std(0xeeeeee), std(0xeeeeee), new T.MeshStandardMaterial({ map: t, roughness: 0.9 }), std(0xeeeeee)], [i * 0.08 - 0.3, 1.6 + i * 0.02, -i * 0.12], [0, 0.1 - i * 0.05, 0.05 - i * 0.03]); g.add(p); } return g; };
  P.chain = (acc) => { const g = new T.Group(); for (let i = 0; i < 5; i++) { const b = mesh(new T.BoxGeometry(0.8, 0.8, 0.8), phys(0x1d1f27, { metalness: 0.6, roughness: 0.25 }), [(i - 2) * 1.2, 1.6 + Math.sin(i) * 0.3, 0], [0.3, i * 0.4, 0.2]); b.userData.spinb = i; g.add(b); if (i) g.add(mesh(new T.CylinderGeometry(0.03, 0.03, 0.5, 8), glow(acc, 3), [(i - 2.5) * 1.2, 1.6, 0], [0, 0, Math.PI / 2])); } return g; };
  P.chat = (acc) => { const g = new T.Group(); [['How many birds near runway 27 today?', 1], ['14, all cleared by 6:51 PM.', 0], ['Any drones this week?', 1]].forEach(([t, me], i) => { const tx = canvasTex(1024, 200, (x, W, H) => { x.fillStyle = me ? '#2a2f3c' : acc; x.beginPath(); x.roundRect ? x.roundRect(0, 0, W, H, 60) : x.rect(0, 0, W, H); x.fill(); x.fillStyle = '#fff'; x.font = '500 54px Geist, sans-serif'; x.fillText(t, 50, 118); }); const b = plate(tx, 2.9, 0.56); b.position.set(me ? -0.6 : -1.2, 2.6 - i * 0.8, 0); b.userData.float = i; g.add(b); }); return g; };
  P.gears = (acc) => { const g = new T.Group(); [[0, 1.8, 1, 0], [1.25, 2.4, 0.6, 1], [1.1, 0.95, 0.5, 2]].forEach(([x, y, r, i]) => { const s = new T.Shape(); const n = Math.round(r * 18); for (let k = 0; k < n * 2; k++) { const a = k / (n * 2) * Math.PI * 2, rr = k % 2 ? r : r * 0.86; k ? s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); } const hole = new T.Path(); hole.absarc(0, 0, r * 0.3, 0, Math.PI * 2, true); s.holes.push(hole);
      const m = mesh(new T.ExtrudeGeometry(s, { depth: 0.2, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2 }), std(i === 0 ? acc : 0x9aa0aa, { metalness: 0.85, roughness: 0.3 }), [x - 0.5, y, 0]); m.userData.gear = (i % 2 ? -1 : 1) / r; g.add(m); }); return g; };
  P.ripples = (acc) => { const g = new T.Group(); const fl = mesh(new T.CircleGeometry(3.2, 64).rotateX(-Math.PI / 2), std(0x15100f, { roughness: 0.9 }), [0, 0.01, 0]); g.add(fl); for (let i = 0; i < 6; i++) { const r = mesh(new T.TorusGeometry(1, 0.015, 6, 128), glow(i % 2 ? 0xffffff : acc, 2.5), [0, 0.05, 0], [Math.PI / 2, 0, 0]); r.userData.ring = i; g.add(r); } g.add(mesh(new T.SphereGeometry(0.12, 24, 16), glow(0xffffff, 3), [0, 0.15, 0])); return g; };
  P.tiles = (acc) => { const g = new T.Group(); ['SNEAK', 'RUN', 'HOLD BREATH', 'PEBBLES', 'WHISPER', 'CHALK'].forEach((t, i) => { const tx = label(t, '', '', 512, 220); const s = mesh(new T.BoxGeometry(1.5, 0.95, 0.18), [std(0x2a1d1b, { roughness: 0.9 }), std(0x2a1d1b), std(0x2a1d1b), std(0x2a1d1b), std(0x3a2a27, { roughness: 0.85 }), std(0x2a1d1b)], [((i % 3) - 1) * 1.7, 2.6 - Math.floor(i / 3) * 1.2, 0]); s.userData.float = i; g.add(s); const lb = plate(tx, 1.3, 0.56); lb.position.set(((i % 3) - 1) * 1.7, 2.6 - Math.floor(i / 3) * 1.2, 0.1); lb.userData.follow = s; g.add(lb); }); return g; };
  P.loop = (acc) => { const g = new T.Group(); ['PATROL', 'LISTEN', 'INVESTIGATE', 'CHASE', 'LOSE YOU'].forEach((t, i) => { const a = Math.PI / 2 - i / 5 * Math.PI * 2, x = Math.cos(a) * 1.9, y = 1.9 + Math.sin(a) * 1.5; g.add(mesh(new T.SphereGeometry(0.32, 32, 16), i === 3 ? glow(acc, 3) : phys(0x2a2324, { metalness: 0.4 }), [x, y, 0])); const lb = plate(label(t, '', '', 512, 160), 1.5, 0.47); lb.position.set(x, y - 0.6, 0.1); g.add(lb); }); const ring = mesh(new T.TorusGeometry(1.9, 0.02, 6, 128), glow(acc, 1.5), [0, 1.9, 0], null, [1, 0.79, 1]); g.add(ring); const dot = mesh(new T.SphereGeometry(0.1, 16, 8), glow(0xffffff, 4)); dot.userData.orbit = 1; g.add(dot); return g; };
  P.engine = (acc) => { const g = new T.Group(); ['GODOT 4 SCENES', 'GDSCRIPT AI', 'SPATIAL AUDIO', 'PING SHADER'].forEach((t, i) => { const s = mesh(new T.BoxGeometry(3.2, 0.5, 2), phys(i === 3 ? acc : 0x2a2324, { transmission: i === 3 ? 0 : 0.3, roughness: 0.2, transparent: true, opacity: 0.92 }), [0, 0.6 + i * 0.75, 0]); s.userData.float = i; g.add(s); const lb = plate(label(t, '', '', 1024, 160), 3.0, 0.47); lb.position.set(0, 0.6 + i * 0.75, 1.02); g.add(lb); }); return g; };
  P.wall = (acc) => { const g = new T.Group(); const n = 89, lit = new Set([3, 9, 14, 20, 27, 31, 38, 42, 49, 53, 58, 61, 66, 70, 75, 79, 84, 88]); for (let i = 0; i < n; i++) { const x = (i % 13 - 6) * 0.42, y = 0.4 + Math.floor(i / 13) * 0.42; g.add(mesh(new T.BoxGeometry(0.38, 0.38, 0.2), lit.has(i) ? glow(acc, 2.2) : std(0x2b2223, { roughness: 0.8 }), [x, y, 0])); } return g; };

  function Story3D(sec, o) {
    const self = this; this.sec = sec; this.o = o; this.dead = false;
    const cv = this.cv = o.canvas, th = o.theme || {}, acc = th.acc || '#ff3b30';
    const R = this.renderer = new T.WebGLRenderer({ canvas: cv, antialias: true, powerPreference: 'high-performance' });
    R.outputEncoding = T.sRGBEncoding; R.toneMapping = T.ACESFilmicToneMapping; R.toneMappingExposure = 1.15; R.shadowMap.enabled = true; R.shadowMap.type = T.PCFSoftShadowMap;
    const S = this.scene = new T.Scene(); const bg = new T.Color(th.bg3d || '#07080b'); S.background = bg; S.fog = new T.Fog(bg, 12, 34);
    if (!ENV) ENV = new T.PMREMGenerator(R).fromScene(new T.RoomEnvironment(), 0.04).texture; S.environment = ENV;
    S.add(new T.HemisphereLight(0xc8d4ff, 0x140c0a, 0.22));
    const key = this.key = new T.DirectionalLight(0xfff2e6, 1.7); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); Object.assign(key.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 0.5, far: 40 }); key.shadow.bias = -0.0005; S.add(key); S.add(key.target);
    const rim = this.rim = new T.PointLight(acc, 1.4, 16, 2); S.add(rim);
    const floor = new T.Mesh(new T.PlaneGeometry(400, 400), new T.MeshStandardMaterial({ color: 0x060607, roughness: 0.78, metalness: 0.05, envMapIntensity: 0.1 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; S.add(floor);
    const grid = new T.GridHelper(400, 200, new T.Color(acc).multiplyScalar(0.35), 0x1a1c22); grid.position.y = 0.002; grid.material.transparent = true; grid.material.opacity = 0.35; S.add(grid);
    // dust
    const pn = 900, pp = new Float32Array(pn * 3); for (let i = 0; i < pn; i++) pp.set([(Math.random() - 0.5) * 60, Math.random() * 8, -Math.random() * 120 + 10], i * 3);
    const pg = new T.BufferGeometry(); pg.setAttribute('position', new T.BufferAttribute(pp, 3)); this.dust = new T.Points(pg, new T.PointsMaterial({ color: 0xffffff, size: 0.025, transparent: true, opacity: 0.45, depthWrite: false })); S.add(this.dust);
    // stops: props along a gentle curve
    this.stops = (o.stops || []).map((s, i) => {
      const pos = V(Math.sin(i * 0.9) * 6, 0, -i * 16);
      const g = (P[s.prop] || P.slabs)(acc); g.position.copy(pos); g.position.y += g.userData.lift || 0; g.rotation.y = -0.35; S.add(g);
      const fw = V(Math.sin(i * 0.9 + 0.5) * 0.4, 0, 1).normalize();
      const cam = pos.clone().add(V(-3.8, 2.6, 7.2)), look = pos.clone().add(V(-2.4, 1.8, 0));
      return { g, pos, cam, look, fw };
    });
    const C = this.camera = new T.PerspectiveCamera(38, 1, 0.1, 200);
    this.post = FK.composer(R, S, C, [0.22, 0.5, 1.4]); this.grade = this.post.grade.uniforms;
    // composer grade expects linear: render scene linear into composer, grade does tonemap
    R.toneMapping = T.NoToneMapping; R.outputEncoding = T.LinearEncoding; this.grade.uExp.value = 0.78; this.grade.uVig.value = 0.6; this.grade.uGrain.value = 0.03; this.grade.uCA.value = 0.0008;
    this.fit = () => { const r = cv.getBoundingClientRect(), w = Math.max(2, r.width | 0), h = Math.max(2, r.height | 0); C.aspect = w / h; C.fov = w / h < 1.2 ? 50 : 38; C.updateProjectionMatrix(); const pr = Math.min(window.devicePixelRatio || 1, 2); R.setPixelRatio(pr); R.setSize(w, h, false); this.post.c.setPixelRatio(pr); this.post.c.setSize(w, h); this.grade.uRes.value.set(w, h); };
    this.onResize = () => this.fit(); window.addEventListener('resize', this.onResize); this.fit();
    this.mt = new T.Vector2(); this.mouse = new T.Vector2();
    this.onMove = (e) => { self.mt.set(e.clientX / innerWidth * 2 - 1, e.clientY / innerHeight * 2 - 1); }; window.addEventListener('pointermove', this.onMove, { passive: true });
    this.k = 0; this.t0 = performance.now();
    this.loop = this.loop.bind(this); this.raf = requestAnimationFrame(this.loop);
  }
  Story3D.prototype.loop = function (now) {
    if (this.dead) return; this.raf = requestAnimationFrame(this.loop);
    const r = this.sec.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) return;
    const dt = Math.min(0.05, (now - (this.lt || now)) / 1000); this.lt = now; const t = (now - this.t0) / 1000;
    const n = this.stops.length, prog = Math.max(0, Math.min(1, -r.top / Math.max(1, r.height - innerHeight)));
    const target = prog * (n - 1); this.k += (target - this.k) * (1 - Math.exp(-dt * 3));
    const i0 = Math.min(n - 2, Math.floor(this.k)), f = this.k - i0, e = FK.ss(0.18, 0.82, f); // holds at each stop
    const a = this.stops[Math.max(0, i0)], b = this.stops[Math.min(n - 1, i0 + 1)] || a, C = this.camera;
    const arc = Math.sin(e * Math.PI) * 1.6;
    C.position.copy(a.cam).lerp(b.cam, e).add(V(0, arc, 0)); const look = a.look.clone().lerp(b.look, e);
    this.mouse.lerp(this.mt, 1 - Math.exp(-dt * 2)); C.position.x += this.mouse.x * 0.5; C.position.y -= this.mouse.y * 0.3; C.lookAt(look);
    const focus = a.pos.clone().lerp(b.pos, e); this.key.position.copy(focus).add(V(-5, 9, 6)); this.key.target.position.copy(focus); this.rim.position.copy(focus).add(V(4, 4.5, -4.5));
    // panels: fully shown at their stop
    (this.o.panels || []).forEach((p, i) => { const d = Math.abs(this.k - i), op = 1 - FK.ss(0.12, 0.42, d); p.style.opacity = op.toFixed(3); p.style.transform = `translateY(${((this.k - i) * -40).toFixed(1)}px)`; p.style.visibility = op < 0.01 ? 'hidden' : 'visible'; p.classList.toggle('on', op > 0.5); });
    if (this.o.dots) this.o.dots.forEach((d, i) => d.classList.toggle('on', Math.round(this.k) === i));
    // object life
    this.stops.forEach((s, si) => { if (Math.abs(si - this.k) > 1.5) return; s.g.rotation.y = -0.35 + Math.sin(t * 0.25 + si) * 0.12; s.g.traverse((o) => {
      const u = o.userData; if (!u) return;
      if (u.bob) o.position.y = 1.42 + Math.sin(t * 2) * 0.06;
      if (u.float != null) o.position.y += Math.sin(t * 1.2 + u.float) * 0.0015;
      if (u.spin) o.rotation.y = t * u.spin;
      if (u.blink != null) o.visible = Math.sin(t * 6 + u.blink * 3) > -0.6;
      if (u.lamp != null) o.material.emissiveIntensity = Math.floor(t / 1.6) % 3 === u.lamp ? 2.6 : 0.05;
      if (u.wave != null && o.isMesh && o.geometry.type === 'PlaneGeometry') { const pa = o.geometry.attributes.position; for (let k = 0; k < pa.count; k++) { const x = pa.getX(k), z = pa.getZ(k); pa.setY(k, Math.sin(x * 5 + t * 1.6) * 0.008 + Math.sin(z * 7 - t * 1.3) * 0.006 + Math.sin((x + z) * 11 + t * 2.4) * 0.003); } pa.needsUpdate = true; o.geometry.computeVertexNormals(); }
      else if (u.wave != null) { const k = (t * 0.6 + u.wave / 3) % 1; o.scale.setScalar(0.6 + k * 1.2); o.material.opacity = 1 - k; o.material.transparent = true; }
      if (u.bar != null) { const h = 0.3 + Math.abs(Math.sin(t * 3 + u.bar * 0.5) * Math.sin(t * 1.3 + u.bar * 0.2)) * 2.4; o.scale.y = h; o.position.y = 0.2 + h / 2; }
      if (u.spinb != null) o.rotation.y = t * 0.4 + u.spinb;
      if (u.gear) o.rotation.z = t * 0.5 * u.gear;
      if (u.ring != null) { const k = (t * 0.35 + u.ring / 6) % 1; o.scale.set(0.2 + k * 3, 0.2 + k * 3, 1); o.material.transparent = true; o.material.opacity = 1 - k; }
      if (u.bobRope != null) o.position.y = -0.05 + Math.sin(t * 1.4 + u.bobRope * 0.35) * 0.008;
      if (u.flag != null) o.rotation.x = Math.sin(t * 2 + u.flag) * 0.25;
      if (u.orbit) { const a2 = t * 0.9; o.position.set(Math.cos(a2) * 1.9, 1.9 + Math.sin(a2) * 1.5, 0.05); }
    }); });
    this.dust.position.y = Math.sin(t * 0.2) * 0.2; this.grade.uT.value = t; UT.value = t;
    this.post.c.render(dt);
  };
  Story3D.prototype.dispose = function () { this.dead = true; cancelAnimationFrame(this.raf); window.removeEventListener('resize', this.onResize); window.removeEventListener('pointermove', this.onMove); this.renderer.dispose(); };
  window.Story3D = Story3D;
})();
