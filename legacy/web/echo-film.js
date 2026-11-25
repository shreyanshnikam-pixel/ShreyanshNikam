/* ECHO: a scroll-driven walk through the Hollow, built from the game's own CC0 assets.
   window.EchoFilm(canvas, opts) -> { setProgress(p), ping(), setSound(on), dispose() } */
(function () {
  const T = THREE, FK = window.FK;
  const FL = 1.5, EYE = 1.62;

  function EchoFilm(canvas, opts) {
    const self = this; opts = opts || {};
    this.cv = canvas; this.p = 0; this.ps = 0; this.dead = false; this.sound = false;
    this.reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const R = this.renderer = new T.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    R.outputEncoding = T.LinearEncoding; R.toneMapping = T.NoToneMapping; R.setClearColor(0x000000, 1);
    const S = this.scene = new T.Scene();
    S.fog = new T.FogExp2(0x000000, 0.045);
    const C = this.camera = new T.PerspectiveCamera(58, 16 / 9, 0.04, 200);
    S.add(C);
    const P = this.post = FK.composer(R, S, C, [0.7, 0.65, 0.82]);
    this.grade = P.grade.uniforms; this.grade.uGrain.value = 0.075; this.grade.uCA.value = 0.0022; this.grade.uExp.value = 1.25;
    this.size = () => { const r = canvas.getBoundingClientRect(); return [Math.max(2, r.width | 0), Math.max(2, r.height | 0)]; };
    this.gov = FK.governor(R, P.c, this.size);
    this.onResize = () => { const s = self.size(); C.aspect = s[0] / s[1]; C.updateProjectionMatrix(); self.gov.apply(); self.grade.uRes.value.set(s[0], s[1]); if (self.post.bloom) self.post.bloom.resolution.set(s[0] / 2, s[1] / 2); };
    window.addEventListener('resize', this.onResize); this.onResize();
    this.mouse = new T.Vector2(); this.mt = new T.Vector2();
    this.onMove = (e) => { self.mt.set(e.clientX / innerWidth * 2 - 1, e.clientY / innerHeight * 2 - 1); };
    window.addEventListener('pointermove', this.onMove, { passive: true });
    // ping uniforms shared by every material
    this.U = { uPW: { value: new T.Vector3(0, 0, 1e4) }, uPOV: { value: new T.Vector3() }, uPR: { value: 0 }, uPA: { value: 0 }, uRim: { value: 0 } };
    this.pingT = -99; this.lastAuto = 0; this.t0 = performance.now();
    this.ready = false; this.status = opts.onStatus || (() => {});
    this.capCb = opts.onCaption || (() => {}); this.cap = -1;
    this.base = opts.base || 'assets/'; this.urls = opts.urls || { core: this.base + 'echo-core.json', scare: this.base + 'echo-scare.json' };
    this.status('Loading the Hollow');
    FK.json(this.urls.core).then((d) => self.build(d)).catch((e) => { console.error(e); self.status('The mine failed to load. Scroll on to read about Echo.'); });
    this.loop = this.loop.bind(this); this.raf = requestAnimationFrame(this.loop);
  }

  // ---------- materials with the ping light ----------
  EchoFilm.prototype.pinged = function (mat, key, rim) {
    const decl = 'uniform vec3 uPW; uniform vec3 uPOV; uniform float uPR; uniform float uPA; uniform float uRim;';
    const code = [
      '{ vec3 Lv = uPOV + vViewPosition; float dl = max(length(Lv), 1e-3); Lv /= dl;',
      '  float dw = distance(vWP, uPW);',
      '  float ring = exp(-pow((dw - uPR) / 2.4, 2.0)) + 0.5 * exp(-pow((dw - uPR + 3.5) / 1.2, 2.0));',
      '  float trail = smoothstep(uPR + 0.6, uPR - 22.0, dw) * 0.55;',
      '  float lam = max(dot(normal, Lv), 0.0) * 0.9 + 0.1;',
      '  float fall = 1.0 / (1.0 + dw * 0.03);',
      '  float aoK = 1.0;',
      '#ifdef USE_AOMAP',
      '  aoK = ambientOcclusion;',
      '#endif',
      '  vec3 pc = vec3(0.58, 0.76, 1.0);',
      '  outgoingLight += diffuseColor.rgb * pc * lam * (ring * 7.0 + trail * 1.1) * uPA * fall * aoK;',
      '  outgoingLight += pc * ring * uPA * 0.06 * fall;',
      rim ? '  float fr = 1.0 - abs(dot(normal, normalize(vViewPosition))); outgoingLight += vec3(1.0, 0.012, 0.03) * fr * fr * uRim;' : '',
      '}'].join('\n');
    return FK.patch(mat, key, this.U, decl, code, true);
  };

  // ---------- world ----------
  EchoFilm.prototype.build = function (d) {
    if (this.dead) return;
    const self = this, S = this.scene, rnd = FK.rng(7);
    this.data = d;
    const tex = (k, srgb, rx, ry) => FK.tex(d.tex[k], srgb, [rx, ry]);
    // path through the mine
    const pts = [];
    for (let i = 0; i <= 28; i++) { const z = -i * 4.6; pts.push(new T.Vector3(Math.sin(i * 0.33) * 2.4 + Math.sin(i * 0.11) * 4.5, Math.sin(i * 0.27) * 0.45 - i * 0.05, z)); }
    const curve = this.curve = new T.CatmullRomCurve3(pts); curve.arcLengthDivisions = 600;
    const Ltot = this.L = curve.getLength();
    const SEG = 420, RAD = 64, W = 2.7, H = 2.6;
    const pos = [], uv = [], up0 = new T.Vector3(0, 1, 0);
    this.frame = (s) => {
      const t = FK.clamp(s / Ltot, 0, 1), P = curve.getPointAt(t), Tn = curve.getTangentAt(t);
      const side = new T.Vector3().crossVectors(Tn, up0).normalize(), up = new T.Vector3().crossVectors(side, Tn).normalize();
      return { P, Tn, side, up };
    };
    const floorFlag = [];
    for (let i = 0; i <= SEG; i++) {
      const s = i / SEG * Ltot, f = this.frame(s);
      const wide = 1 + 0.35 * FK.ss(0.55, 0.65, s / Ltot) * (1 - FK.ss(0.75, 0.85, s / Ltot));
      for (let j = 0; j <= RAD; j++) {
        const th = j / RAD * Math.PI * 2, cx = Math.cos(th), cy = Math.sin(th);
        const n1 = FK.fbm(cx * 1.3 + 9, cy * 1.3 + 3, s * 0.21, 5), n2 = FK.fbm(cx * 4 + 1, cy * 4 + 7, s * 0.9, 3);
        const r = 1 + (n1 - 0.5) * 0.75 + (n2 - 0.5) * 0.16;
        let x = cx * W * wide * r, y = cy * H * r;
        let fl = 0;
        if (y < -FL) { y = -FL + (FK.noise(x * 2.1, s * 1.7, 3) - 0.5) * 0.09 + Math.max(0, Math.abs(x) - W * 0.7) * 0.25; fl = 1; }
        const v = f.P.clone().addScaledVector(f.side, x).addScaledVector(f.up, y);
        pos.push(v.x, v.y, v.z); uv.push(j / RAD * 7, s / 3.2); floorFlag.push(fl);
      }
    }
    const wall = [], flo = [];
    for (let i = 0; i < SEG; i++) for (let j = 0; j < RAD; j++) {
      const a = i * (RAD + 1) + j, b = a + RAD + 1, c = a + 1, e = b + 1;
      const isF = floorFlag[a] + floorFlag[b] + floorFlag[c] + floorFlag[e] >= 3;
      (isF ? flo : wall).push(a, c, b, c, e, b);
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    g.setAttribute('uv2', new T.Float32BufferAttribute(uv, 2));
    g.setIndex(wall.concat(flo)); g.addGroup(0, wall.length, 0); g.addGroup(wall.length, flo.length, 1);
    g.computeVertexNormals();
    const rockM = this.pinged(new T.MeshStandardMaterial({ map: tex('dark_rock_02_diff', true, 1, 1), normalMap: tex('dark_rock_02_nor', false, 1, 1), aoMap: tex('dark_rock_02_ao', false, 1, 1),
      normalScale: new T.Vector2(1.6, 1.6), roughness: 0.92, color: 0x8f8a86, side: T.DoubleSide }), 'rock');
    const mudM = this.pinged(new T.MeshStandardMaterial({ map: tex('brown_mud_03_diff', true, 1, 1), normalMap: tex('brown_mud_03_nor', false, 1, 1), roughness: 0.75, color: 0x6d625a, side: T.DoubleSide }), 'mud');
    const cave = new T.Mesh(g, [rockM, mudM]); S.add(cave);

    // timber sets, rails and sleepers
    const plank = this.pinged(new T.MeshStandardMaterial({ map: tex('weathered_planks_diff', true, 0.5, 2), normalMap: tex('weathered_planks_nor', false, 0.5, 2), roughness: 0.85, color: 0x8a7462 }), 'plank');
    const post = new T.BoxGeometry(0.26, 1, 0.26), beam = new T.BoxGeometry(1, 0.3, 0.3);
    const m4 = new T.Matrix4(), q = new T.Quaternion(), sc = new T.Vector3();
    const basis = (f) => new T.Matrix4().makeBasis(f.side, f.up, f.Tn.clone().negate());
    for (let s = 6; s < Ltot - 6; s += 7.5) {
      const f = this.frame(s), B = basis(f), broken = rnd() < 0.25, hw = W * 0.78;
      for (const sgn of [-1, 1]) {
        const lean = (rnd() - 0.5) * 0.08, h = H * 0.95 + FL;
        const m = new T.Mesh(post, plank);
        m.position.copy(f.P).addScaledVector(f.side, sgn * hw).addScaledVector(f.up, -FL + h / 2);
        m.quaternion.setFromRotationMatrix(B); m.rotateZ(lean); m.scale.set(1, h, 1); S.add(m);
      }
      const bm = new T.Mesh(beam, plank);
      bm.position.copy(f.P).addScaledVector(f.up, H * 0.95 - 0.1);
      bm.quaternion.setFromRotationMatrix(B); bm.scale.set(hw * 2 + 0.4, 1, 1);
      if (broken) { bm.rotateZ(0.35 * (rnd() < 0.5 ? -1 : 1)); bm.position.addScaledVector(f.up, -0.5); }
      S.add(bm);
    }
    const sleeperN = Math.floor(Ltot / 0.9);
    const sl = new T.InstancedMesh(new T.BoxGeometry(1.5, 0.12, 0.22), plank, sleeperN);
    for (let k = 0; k < sleeperN; k++) {
      const f = this.frame(k * 0.9 + 0.5); q.setFromRotationMatrix(basis(f));
      const pp = f.P.clone().addScaledVector(f.up, -FL + 0.06);
      q.multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), (rnd() - 0.5) * 0.12));
      m4.compose(pp, q, sc.set(1, 1, 1)); sl.setMatrixAt(k, m4);
    }
    S.add(sl);
    const railM = this.pinged(new T.MeshStandardMaterial({ color: 0x5a4a40, metalness: 0.85, roughness: 0.45 }), 'rail');
    for (const sgn of [-0.55, 0.55]) {
      const rp = []; for (let k = 0; k <= 160; k++) { const f = this.frame(k / 160 * Ltot); rp.push(f.P.clone().addScaledVector(f.side, sgn).addScaledVector(f.up, -FL + 0.16)); }
      S.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(rp), 400, 0.035, 5, false), railM));
    }

    // props from the game: rocks, rubble, bones, lanterns, crates
    const place = (key, s, x, y, scale, rotY, tilt) => {
      const src = this.props[key]; if (!src) return null;
      const o = src.clone(true), f = this.frame(s);
      o.position.copy(f.P).addScaledVector(f.side, x).addScaledVector(f.up, -FL + (y || 0));
      o.quaternion.setFromRotationMatrix(basis(f)); o.rotateY(rotY || 0); if (tilt) o.rotateX(tilt);
      o.scale.setScalar(scale); S.add(o); return o;
    };
    this.props = {};
    const keys = Object.keys(d.props);
    Promise.all(keys.map((k) => FK.glb(d.props[k]).then((gl) => {
      gl.scene.traverse((o) => { if (o.isMesh) { const mm = o.material.clone(); if (mm.map) mm.map.anisotropy = 8; if (/rock/.test(k)) mm.color = new T.Color(0x6e6862); if (/bone|skull|rib/.test(k)) { mm.color = new T.Color(0x5e5446); mm.roughness = 0.9; } o.material = self.pinged(mm, 'prop-' + k); } });
      self.props[k] = gl.scene;
    }))).then(() => {
      for (let s = 3; s < Ltot - 3; s += 0.9 + rnd() * 1.6) {
        const sgn = rnd() < 0.5 ? -1 : 1, big = rnd(), r7 = rnd() < 0.55;
        place(r7 ? 'rock_07' : 'rock_09', s, sgn * (W * (0.72 + rnd() * 0.3)), -0.05, (r7 ? 2.2 : 5) * (0.6 + big * big * 3.2), rnd() * 6, (rnd() - 0.5) * 0.8);
        if (rnd() < 0.5) place(rnd() < 0.5 ? 'rock_07' : 'rock_09', s + 0.4, (rnd() - 0.5) * W * 1.2, -0.02, 0.9 + rnd() * 1.6, rnd() * 6, rnd() * 3);
      }
            // the lair: bones scattered where the Listener feeds
      for (let k = 0; k < 26; k++) place(['bone_A', 'bone_B', 'bone_C'][k % 3], 47 + rnd() * 26, (rnd() - 0.5) * W * 1.3, 0.02, 0.42 + rnd() * 0.2, rnd() * 6, (rnd() - 0.5) * 0.4);
      place('skull', 51, 0.9, 0.02, 0.26, 2.6); place('skull', 58.4, -1.3, 0.02, 0.24, 0.4, 0.5); place('skull', 66, 0.2, 0.02, 0.27, 3.4);
      place('ribcage', 55, -1.1, 0, 0.55, 1.1); place('ribcage', 69, 1.4, 0, 0.5, 4.2, 0.3);
    });

    // lantern lights (warm, flickering) where the story needs them
    this.lanterns = [{ s: 31, x: -1.7, r: 0.4, I: 2.2 }, { s: 62.5, x: 1.9, r: 2.8, I: 3.2 }, { s: 82, x: -1.6, r: 1.1, I: 2.0 }];
    this.lanterns.forEach((l) => {
      const f = this.frame(l.s); l.light = new T.PointLight(0xff9248, l.I, 11, 2);
      l.light.position.copy(f.P).addScaledVector(f.side, l.x).addScaledVector(f.up, -FL + 0.42); S.add(l.light); l.on = 1;
      const g0 = new T.Group(); g0.position.copy(l.light.position).addScaledVector(f.up, -0.3);
      const iron = new T.MeshStandardMaterial({ color: 0x1c1915, metalness: 0.8, roughness: 0.55 });
      const glass = l.glass = new T.MeshStandardMaterial({ color: 0x2a1a0a, emissive: 0xff9a40, emissiveIntensity: 3, transparent: true, opacity: 0.9, roughness: 0.2 });
      const add = (geo, m, y) => { const o = new T.Mesh(geo, m); o.position.y = y; g0.add(o); return o; };
      add(new T.CylinderGeometry(0.085, 0.1, 0.03, 16), iron, 0.0); add(new T.CylinderGeometry(0.07, 0.07, 0.2, 16, 1, true), glass, 0.12);
      add(new T.ConeGeometry(0.1, 0.08, 16), iron, 0.26); add(new T.TorusGeometry(0.05, 0.007, 6, 16), iron, 0.33);
      for (let k = 0; k < 4; k++) { const b = add(new T.CylinderGeometry(0.006, 0.006, 0.22, 4), iron, 0.12); b.position.x = Math.cos(k * 1.57) * 0.075; b.position.z = Math.sin(k * 1.57) * 0.075; }
      S.add(g0);
    });
    S.add(new T.HemisphereLight(0x1a2230, 0x050302, window.DBG ? 1.6 : 0.06));

    // chalk marks drawn on the rock
    const chalk = (draw) => { const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); x.strokeStyle = 'rgba(235,232,222,.85)'; x.lineWidth = 9; x.lineCap = 'round'; draw(x); const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; return t; };
    const marks = [
      chalk((x) => { x.beginPath(); x.moveTo(60, 70); x.lineTo(196, 190); x.moveTo(196, 66); x.lineTo(64, 192); x.stroke(); }),
      chalk((x) => { x.beginPath(); x.moveTo(40, 128); x.lineTo(210, 128); x.moveTo(160, 80); x.lineTo(214, 128); x.lineTo(160, 176); x.stroke(); }),
      chalk((x) => { x.lineWidth = 7; for (let i = 0; i < 4; i++) { x.beginPath(); x.moveTo(60 + i * 34, 60); x.lineTo(66 + i * 34, 196); x.stroke(); } x.beginPath(); x.moveTo(40, 170); x.lineTo(200, 90); x.stroke(); }),
    ];
    [[18, -1, 0], [26, 1, 1], [38, -1, 2], [45, 1, 0]].forEach(([s, sgn, k]) => {
      const f = this.frame(s), m = new T.Mesh(new T.PlaneGeometry(0.9, 0.9), this.pinged(new T.MeshStandardMaterial({ map: marks[k], transparent: true, roughness: 1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }), 'chalk'));
      m.position.copy(f.P).addScaledVector(f.side, sgn * (W * 0.98)).addScaledVector(f.up, 0.2);
      m.quaternion.setFromRotationMatrix(basis(f)); m.rotateY(-sgn * Math.PI / 2); S.add(m);
    });

    // dust in the air
    const dn = 1400, dp = new Float32Array(dn * 3);
    for (let k = 0; k < dn; k++) { const f = this.frame(rnd() * Ltot); const v = f.P.clone().addScaledVector(f.side, (rnd() - 0.5) * W * 1.6).addScaledVector(f.up, (rnd() - 0.4) * H * 1.3); dp.set([v.x, v.y, v.z], k * 3); }
    const dg = new T.BufferGeometry(); dg.setAttribute('position', new T.BufferAttribute(dp, 3));
    this.dust = new T.Points(dg, new T.PointsMaterial({ color: 0x8a8f99, size: 0.012, transparent: true, opacity: 0.22, depthWrite: false, blending: T.AdditiveBlending }));
    S.add(this.dust);

    // the Listener, from the game
    FK.glb(d.listener).then((gl) => {
      const L = self.listener = gl.scene; const box = new T.Box3().setFromObject(L);
      self.lScale = 2.85 / (box.max.y - box.min.y); L.scale.setScalar(self.lScale);
      L.traverse((o) => { if (o.isMesh) { o.frustumCulled = false; o.material = self.pinged(o.material, 'listener-' + o.material.name, true); } });
      self.mixer = new T.AnimationMixer(L); self.acts = {};
      gl.animations.forEach((a) => { self.acts[a.name] = self.mixer.clipAction(a); });
      L.visible = false; S.add(L);
    });
    // audio buffers decode on demand
    this.ready = true; this.status('');
    FK.json(this.urls.scare).then((j) => { self.scareData = j; return FK.glb(j.glb); }).then((gl) => {
      const J = self.js = new T.Group(); J.add(gl.scene); J.visible = false; S.add(J);
      gl.scene.traverse((o) => { if (o.isMesh) { o.frustumCulled = false; o.material = self.pinged(o.material, 'scare-' + o.material.name, true); } });
      self.jsMixer = new T.AnimationMixer(gl.scene); self.jsAct = self.jsMixer.clipAction(gl.animations[0]); self.jsAct.setLoop(T.LoopOnce); self.jsAct.clampWhenFinished = true;
      const mk = (c) => { const l = new T.PointLight(c, 0, 14, 2); J.add(l); return l; };
      self.jsKey = mk(0x5fa6b3); self.jsKey.position.set(-0.4, 2.3, 4.9);
      self.jsRim = mk(0xff0a0c); self.jsRim.position.set(0, 2.2, -1.8);
      self.jsFace = mk(0xff1a14); self.jsFace.position.set(-1.2, 2.5, 5.4);
      J.visible = true; try { self.renderer.compile(S, self.camera); } catch (e) {} J.visible = false;
    }).catch((e) => console.error(e));
  };

  // ---------- audio (the game's CC0 recordings) ----------
  EchoFilm.prototype.setSound = function (on) {
    this.sound = on;
    if (on && !this.ac) {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC || !this.data) return;
      const ac = this.ac = new AC(); this.buf = {}; this.out = ac.createGain(); this.out.connect(ac.destination);
      const dec = (k, b64) => ac.decodeAudioData(FK.b64ab(b64)).then((b) => { this.buf[k] = b; if (k === 'drone') this.startDrone(); }).catch(() => {});
      Object.keys(this.data.audio).forEach((k) => dec(k, this.data.audio[k]));
    }
    if (this.ac) { if (on) this.ac.resume(); this.out.gain.setTargetAtTime(on ? 1 : 0, this.ac.currentTime, 0.08); }
  };
  EchoFilm.prototype.startDrone = function () {
    if (!this.buf.drone || this.droneSrc) return;
    const s = this.droneSrc = this.ac.createBufferSource(); s.buffer = this.buf.drone; s.loop = true;
    const g = this.droneGain = this.ac.createGain(); g.gain.value = 0.5; s.connect(g); g.connect(this.out); s.start();
  };
  EchoFilm.prototype.play = function (k, vol, rate) {
    if (!this.sound || !this.ac || !this.buf || !this.buf[k]) return null;
    const s = this.ac.createBufferSource(); s.buffer = this.buf[k]; s.playbackRate.value = rate || 1;
    const g = this.ac.createGain(); g.gain.value = vol == null ? 1 : vol; s.connect(g); g.connect(this.out); s.start(); return s;
  };

  // ---------- story ----------
  EchoFilm.prototype.setProgress = function (p) { this.p = p; };
  EchoFilm.prototype.ping = function (auto) {
    if (!this.ready || this.scaring) return;
    if (!auto && this.p > 0.57 && this.p < 0.72 && !this.reduced) { this.triggerScare(); return; }
    this.pingT = performance.now(); this.U.uPW.value.copy(this.camera.position).addScaledVector(this.fwd || new T.Vector3(0, 0, -1), 0.4);
    this.play('ping', 0.7);
  };
  EchoFilm.prototype.triggerScare = function () {
    if (this.scaring || !this.js) return;
    this.scaring = true; this.scareT = 0; this.caught = false;
    const f = this.frame(this.camS), J = this.js;
    const fw = f.Tn.clone(); fw.y = 0; fw.normalize();
    J.position.copy(this.camera.position).addScaledVector(fw, 6); J.position.y = f.P.y - FL;
    J.lookAt(this.camera.position.x, J.position.y, this.camera.position.z);
    J.visible = true; if (this.listener) this.listener.visible = false;
    this.lanterns.forEach((l) => { l.light.intensity = 0; l.glass.emissiveIntensity = 0; });
    this.jsAct.reset().play(); this.jsMixer.update(0);
    this.scareSrc = this.play('scare', 1.0);
    if (this.droneGain) this.droneGain.gain.setTargetAtTime(0, this.ac.currentTime, 0.2);
  };
  EchoFilm.prototype.resetScare = function () {
    this.scaring = false; this.caught = false; if (this.js) this.js.visible = false;
    if (this.scareSrc) { try { this.scareSrc.stop(); } catch (e) {} this.scareSrc = null; }
    if (this.droneGain) this.droneGain.gain.setTargetAtTime(0.5, this.ac.currentTime, 0.5);
  };

  const KEYS_S = [[0, 3], [0.1, 9], [0.2, 19], [0.3, 33], [0.36, 37], [0.5, 47], [0.6, 53], [0.7, 55]];
  EchoFilm.prototype.loop = function (now) {
    if (this.dead) return;
    this.raf = requestAnimationFrame(this.loop);
    const r = this.cv.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight || !this.ready) return;
    this.gov.tick(now);
    const dt = Math.min(0.05, (now - (this.lt || now)) / 1000); this.lt = now;
    const t = (now - this.t0) / 1000, C = this.camera, U = this.U;
    // eased scroll (slightly behind the wheel, so motion reads as slow and heavy)
    this.ps += (this.p - this.ps) * (1 - Math.exp(-dt * 2.2));
    const p = this.ps;
    if (this.scaring && this.p < 0.52) this.resetScare();
    // caption
    const cap = this.caught ? 5 : p < 0.1 ? 0 : p < 0.24 ? 1 : p < 0.33 ? 2 : p < 0.56 ? 3 : p < 0.73 ? 4 : 5;
    const capShow = this.scaring && !this.caught ? -1 : cap;
    if (capShow !== this.cap) { this.cap = capShow; this.capCb(capShow); }
    // camera walk
    const s = this.camS = FK.keys(KEYS_S, p), f = this.frame(s);
    const bob = Math.sin(s * 2.6) * 0.035, sway = Math.sin(s * 1.3) * 0.025;
    this.mouse.lerp(this.mt, 1 - Math.exp(-dt * 3));
    const ahead = this.frame(s + 4).P;
    const hold = FK.ss(0.56, 0.66, p);
    if (!this.scaring) {
      C.position.copy(f.P).addScaledVector(f.up, -FL + EYE + bob - hold * 0.12).addScaledVector(f.side, sway);
      const look = ahead.clone().addScaledVector(f.up, -FL + EYE - 0.1 - hold * 0.15).addScaledVector(f.side, this.mouse.x * 1.2);
      look.y -= this.mouse.y * 0.8;
      C.lookAt(look); C.rotateZ(sway * 0.4);
      C.fov = 58; C.updateProjectionMatrix();
      this.fwd = look.sub(C.position).normalize();
    }
    // ping: story pings and the automatic heartbeat of pings until the hold
    const storyPings = [0.02, 0.12, 0.2, 0.3, 0.42, 0.5];
    storyPings.forEach((sp) => { if (this.lastP != null && this.lastP < sp && p >= sp) this.ping(true); });
    if (p > 0.01 && p < 0.56 && now - this.pingT > 5200) this.ping(true);
    this.lastP = p;
    const age = (now - this.pingT) / 1000;
    U.uPR.value = age * 13; U.uPA.value = age < 0 ? 0 : Math.exp(-age * 0.42) * FK.ss(0, 0.05, age);
    U.uPOV.value.copy(U.uPW.value).applyMatrix4(C.matrixWorldInverse);
    // lanterns flicker, and die during the hold
    this.lanterns.forEach((l, i) => {
      const fl = 0.75 + 0.25 * FK.noise(t * 7 + i * 10, i, 0) + (FK.noise(t * 23, i * 3, 1) > 0.8 ? -0.5 : 0);
      let k = 1; if (i === 1) k = 1 - FK.ss(0.655, 0.675, p) + (p > 0.64 && p < 0.67 && Math.sin(t * 40) > 0.6 ? -0.6 : 0);
      if (!this.scaring) { l.light.intensity = Math.max(0, l.I * fl * k); l.glass.emissiveIntensity = 3 * Math.max(0, fl * k); }
    });
    // the Listener
    const Ls = this.listener;
    if (Ls && !this.scaring) {
      let st = null, ls = 0, sp = 1;
      if (p > 0.17 && p < 0.33) { st = 'Alert_Listen'; ls = 52; }
      else if (p > 0.39 && p < 0.585) { st = 'Walk_Stalk'; ls = FK.lerp(80, 66, FK.ss(0.39, 0.585, p)); sp = 0.8; }
      else if (p >= 0.585 && p < 0.69) { st = 'Walk_Stalk'; ls = FK.lerp(66, 61.2, FK.ss(0.585, 0.68, p)); sp = 0.45; }
      Ls.visible = !!st;
      if (st) {
        const lf = this.frame(ls); Ls.position.copy(lf.P).addScaledVector(lf.up, -FL).addScaledVector(lf.side, 0.3);
        Ls.lookAt(C.position.x, Ls.position.y, C.position.z);
        if (this.curAct !== st) { if (this.curAct) this.acts[this.curAct].fadeOut(0.4); this.acts[st].reset().fadeIn(0.4).play(); this.curAct = st; }
        this.acts[st].timeScale = sp; this.mixer.update(dt);
      }
      U.uRim.value = 0.04 + 0.06 * Math.max(0, Math.sin(t * 1.7));
    }
    // heartbeat during the hold
    if (!this.scaring && p > 0.56 && p < 0.72) { if (!this.beatT || now - this.beatT > FK.lerp(1000, 560, FK.ss(0.56, 0.7, p))) { this.beatT = now; this.play('heart', 0.9); } }
    if (!this.scaring && p >= 0.7 && !this.reduced && this.js) this.triggerScare();
    // the jump scare (the game's own animation and camera, played in real time)
    const G = this.grade;
    G.uFlash.value.set(0, 0, 0); G.uCA.value = 0.0022; G.uExp.value = 1.25; G.uTint.value.set(1, 1, 1);
    if (this.scaring) {
      if (!this.scareT) this.scareT = now;
      const fr = window.SCAREF || (now - this.scareT) / 1000 * 24 + 1, J = this.js;
      if (window.SCAREF) { this.jsAct.time = (fr - 1) / 24; this.jsMixer.update(0); } else this.jsMixer.update(dt);
      const rec = FK.clamp((fr - 51) / 6, 0, 1), atk = FK.clamp((fr - 49) / 7, 0, 1), sh = fr >= 54 && fr <= 74;
      const lc = new T.Vector3(sh ? 0.025 * Math.sin(fr * 2.1) : 0, 1.63 + (sh ? 0.015 * Math.cos(fr * 1.7) : 0), 6 + 0.19 * rec);
      const tg = new T.Vector3(0, 1.78, 0.5).lerp(new T.Vector3(0, 2.1, 4.15), atk);
      C.position.copy(J.localToWorld(lc)); C.lookAt(J.localToWorld(tg));
      if (sh) C.rotateY(0.018 * Math.sin(fr * 1.4));
      const lens = fr < 49 ? 35 : fr < 54 ? 32 : 29, hf = 2 * Math.atan(18 / lens);
      C.fov = Math.max(34, 2 * Math.atan(Math.tan(hf / 2) / C.aspect) * 180 / Math.PI); C.updateProjectionMatrix();
      const pw = FK.lin([[1, 8], [29, 12], [38, 22], [44, 3], [49, 6], [52, 30], [54, 95], [59, 60], [78, 60], [79, 0], [96, 0]], fr);
      this.jsKey.intensity = pw * 0.55 * 0.05; this.jsRim.intensity = pw * 1.8 * 0.032; this.jsFace.intensity = fr >= 52 ? pw * 0.55 * 0.06 : 0;
      U.uRim.value = FK.lin([[1, 0.015], [15, 0.025], [29, 0.1], [38, 0.14], [44, 0.02], [48, 0.07], [51, 0.08], [54, 0.16], [58, 0.1], [72, 0.075], [78, 0.075], [79, 0]], fr) * 2.6;
      const hit = FK.clamp(1 - Math.abs(fr - 54) / 5, 0, 1);
      G.uCA.value = 0.0022 + hit * 0.02 + (sh ? 0.004 : 0); G.uFlash.value.set(hit * 0.35, hit * 0.02, 0);
      G.uExp.value = 1.25 + hit * 0.45;
      if (fr >= 79) { J.visible = false; G.uExp.value = 0; if (!this.caught) { this.caught = true; } }
    }
    G.uT.value = t;
    if (this.dust) { this.dust.rotation.y = Math.sin(t * 0.05) * 0.002; this.dust.position.y = Math.sin(t * 0.3) * 0.05; }
    this.post.c.render(dt);
  };
  EchoFilm.prototype.dispose = function () {
    this.dead = true; cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.onResize); window.removeEventListener('pointermove', this.onMove);
    if (this.ac) this.ac.close(); this.renderer.dispose();
  };
  window.EchoFilm = EchoFilm;
})();
