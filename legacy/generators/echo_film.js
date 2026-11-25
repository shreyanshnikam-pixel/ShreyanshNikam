class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { ch: 0, sound: false };
    this.pings = [];
    this.canvasRef = (el) => { if (el && el !== this.cv) { this.cv = el; this.tryStart(); } };
    this.filmRef = (el) => { if (el && el !== this.film) { this.film = el; this.tryStart(); } };
    this.barRef = (el) => { this.bar = el; };
    this.doPing = () => { this.pings.push({ t0: this.now || 0 }); this.sndPing(); };
    this.toggleSound = () => {
      const on = !this.state.sound;
      if (on) this.audioInit(); else if (this.ac) this.ac.suspend();
      if (on && this.ac) this.ac.resume();
      this.setState({ sound: on });
    };
  }
  tryStart() { if (this.cv && this.film && !this.started) { this.started = true; this.startFilm(); } }
  componentWillUnmount() {
    this.dead = true;
    if (this.raf) cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.onResize);
    if (this.ac) this.ac.close();
    this.cleanupFly();
  }
  // ---------- sound (opt-in, synthesized) ----------
  audioInit() {
    if (this.ac) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ac = new AC(); this.ac = ac;
    const master = ac.createGain(); master.gain.value = 0.7; master.connect(ac.destination); this.master = master;
    const delay = ac.createDelay(1); delay.delayTime.value = 0.29;
    const fb = ac.createGain(); fb.gain.value = 0.38; delay.connect(fb); fb.connect(delay);
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400; delay.connect(lp); lp.connect(master);
    this.echoIn = delay;
    const drone = ac.createGain(); drone.gain.value = 0.05; drone.connect(master);
    [46, 49.5, 92.5].forEach((f) => { const o = ac.createOscillator(); o.frequency.value = f; o.connect(drone); o.start(); });
    const len = ac.sampleRate * 2, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;
    const n = ac.createBufferSource(); n.buffer = buf; n.loop = true;
    const nf = ac.createBiquadFilter(); nf.type = 'lowpass'; nf.frequency.value = 260;
    const ng = ac.createGain(); ng.gain.value = 0.05; n.connect(nf); nf.connect(ng); ng.connect(master); n.start();
  }
  sndPing() {
    if (!this.state.sound || !this.ac) return;
    const ac = this.ac, t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(1400, t); o.frequency.exponentialRampToValueAtTime(620, t + 0.25);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.22, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    o.connect(g); g.connect(this.master); g.connect(this.echoIn); o.start(t); o.stop(t + 0.6);
  }
  sndBeat() {
    if (!this.state.sound || !this.ac) return;
    const ac = this.ac, t = ac.currentTime;
    [0, 0.22].forEach((dt, i) => {
      const o = ac.createOscillator(), g = ac.createGain(); o.frequency.setValueAtTime(62 - i * 8, t + dt);
      g.gain.setValueAtTime(0.0001, t + dt); g.gain.exponentialRampToValueAtTime(0.5 - i * 0.15, t + dt + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dt + 0.25);
      o.connect(g); g.connect(this.master); o.start(t + dt); o.stop(t + dt + 0.3);
    });
  }
  sndScare() {
    if (!this.state.sound || !this.ac) return;
    const ac = this.ac, t = ac.currentTime;
    const n = ac.createBufferSource(); n.buffer = this.noise;
    const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.setValueAtTime(900, t); bp.frequency.exponentialRampToValueAtTime(3200, t + 0.4); bp.Q.value = 0.7;
    const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(1.0, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.3);
    n.connect(bp); bp.connect(g); g.connect(this.master); n.start(t); n.stop(t + 1.4);
    const ws = ac.createWaveShaper(), curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) { const x = i / 128 - 1; curve[i] = Math.tanh(x * 6); }
    ws.curve = curve; ws.connect(this.master);
    [1, 1.06, 1.5].forEach((m) => {
      const o = ac.createOscillator(), og = ac.createGain(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(160 * m, t); o.frequency.exponentialRampToValueAtTime(980 * m, t + 0.35);
      og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(0.35, t + 0.04); og.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
      o.connect(og); og.connect(ws); o.start(t); o.stop(t + 1.2);
    });
    const th = ac.createOscillator(), tg = ac.createGain(); th.frequency.setValueAtTime(70, t); th.frequency.exponentialRampToValueAtTime(30, t + 0.5);
    tg.gain.setValueAtTime(0.9, t); tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.6); th.connect(tg); tg.connect(this.master); th.start(t); th.stop(t + 0.7);
  }
  startFilmGL(gl) {
    const self = this, cv = this.cv;
    const reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
    const lerp = (a, b, k) => a + (b - a) * k;
    const sm = (a, b, x) => { const k = clamp((x - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };
    let seed = 9; const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    const cxz = (z) => Math.sin(z * 0.045) * 2.2;
    // ---------- build dense world: pos(3) normal(3) type seed ----------
    const A = [];
    const add = (x, y, z, nx, ny, nz, ty) => { A.push(x, y, z, nx, ny, nz, ty, rnd()); };
    for (let z = 0; z < 112; z += 0.075) {
      const c = cxz(z);
      for (let k = 0; k < 112; k++) {
        const th = (k / 112) * Math.PI * 2 + rnd() * 0.06;
        const r = 2.25 + 0.22 * Math.sin(th * 3 + z * 0.7) + 0.14 * Math.sin(th * 7 - z * 1.3) + 0.06 * Math.sin(th * 23 + z * 4.1) + 0.035 * Math.sin(th * 51 - z * 9.3) + rnd() * 0.05;
        let x = Math.cos(th) * r * 1.05, y = Math.sin(th) * r * 0.86, nx = -Math.cos(th), ny = -Math.sin(th);
        if (y < -1.6) { y = -1.6 + rnd() * 0.025 + 0.02 * Math.sin(x * 9 + z * 3); x *= 0.92 + rnd() * 0.1; nx = 0; ny = 1; }
        add(c + x, y, z + rnd() * 0.07, nx, ny, 0, 0);
      }
    }
    for (let z = 3; z < 110; z += 4.5) {
      const c = cxz(z);
      for (let y = -1.6; y < 1.35; y += 0.022) for (const sx of [-1, 1]) for (let w = 0; w < 4; w++) add(c + sx * (1.86 - w * 0.045), y, z + (rnd() - 0.5) * 0.16, -sx, 0, 0, 1);
      for (let x = -2.0; x <= 2.0; x += 0.022) for (let w = 0; w < 4; w++) add(c + x, 1.36 - w * 0.04, z + (rnd() - 0.5) * 0.16, 0, -1, 0, 1);
    }
    for (let z = 0; z < 110; z += 0.035) { const c = cxz(z); for (const sx of [-0.55, 0.55]) { add(c + sx, -1.53, z, 0, 1, 0, 2); add(c + sx + 0.03, -1.53, z, 0, 1, 0, 2); } }
    for (let z = 0; z < 110; z += 0.7) { const c = cxz(z); for (let x = -0.82; x <= 0.82; x += 0.03) for (let w = 0; w < 3; w++) add(c + x, -1.585, z + w * 0.05, 0, 1, 0, 1); }
    const chalk = (z0, side) => {
      const c = cxz(z0), x0 = c + side * 2.1;
      for (let s = -0.38; s <= 0.38; s += 0.006) { add(x0, 0.2 + s, z0 + s * 0.9, -side, 0, 0, 3); add(x0, 0.2 - s, z0 + s * 0.9, -side, 0, 0, 3); }
      for (let a = 0; a < Math.PI * 2; a += 0.015) add(x0, 0.2 + Math.sin(a) * 0.52, z0 + Math.cos(a) * 0.52, -side, 0, 0, 3);
    };
    chalk(12, -1); chalk(27, 1); chalk(41, -1);
    const world = new Float32Array(A), NW = A.length / 8;
    // monster: pos(3) normal(3) head seed
    const M = [];
    const cap = (a, b, r, n, head) => {
      const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], L = Math.hypot(dx, dy, dz) || 1;
      const ux = dx / L, uy = dy / L, uz = dz / L;
      let vx = -uy, vy = ux, vz = 0; if (Math.abs(uz) > 0.9) { vx = 1; vy = 0; vz = 0; }
      const vl = Math.hypot(vx, vy, vz); vx /= vl; vy /= vl; vz /= vl;
      const wx = uy * vz - uz * vy, wy = uz * vx - ux * vz, wz = ux * vy - uy * vx;
      for (let i = 0; i < n; i++) {
        const t = rnd(), ang = rnd() * Math.PI * 2, rr = r * (0.94 + rnd() * 0.12) * (1 + 0.12 * Math.sin(t * 17 + ang * 3));
        const nx = vx * Math.cos(ang) + wx * Math.sin(ang), ny = vy * Math.cos(ang) + wy * Math.sin(ang), nz = vz * Math.cos(ang) + wz * Math.sin(ang);
        M.push(a[0] + dx * t + nx * rr, a[1] + dy * t + ny * rr, a[2] + dz * t + nz * rr, nx, ny, nz, head ? 1 : 0, rnd());
      }
    };
    for (const s of [-1, 1]) {
      cap([s * 0.17, 1.3, 0], [s * 0.21, 0.68, -0.06], 0.075, 900, 0); cap([s * 0.21, 0.68, -0.06], [s * 0.23, 0.05, 0.05], 0.058, 760, 0);
      cap([s * 0.23, 0.04, 0.05], [s * 0.25, 0.0, -0.18], 0.035, 200, 0);
      cap([s * 0.34, 2.02, -0.1], [s * 0.46, 1.45, -0.24], 0.05, 700, 0); cap([s * 0.46, 1.45, -0.24], [s * 0.5, 0.86, -0.34], 0.04, 640, 0);
      for (let f = 0; f < 4; f++) cap([s * 0.5, 0.86, -0.34], [s * (0.47 + f * 0.025), 0.42, -0.43 + f * 0.02], 0.011, 160, 0);
    }
    cap([0, 1.28, 0], [0, 2.02, -0.16], 0.16, 2600, 0); cap([-0.36, 2.02, -0.1], [0.36, 2.02, -0.1], 0.07, 700, 0);
    for (let r = 0; r < 8; r++) cap([-0.15, 1.5 + r * 0.065, -0.135], [0.15, 1.5 + r * 0.065, -0.135], 0.013, 110, 0);
    for (let v = 0; v < 9; v++) cap([0, 1.3 + v * 0.08, 0.15], [0, 1.34 + v * 0.08, 0.17], 0.03, 40, 0);
    cap([0, 2.08, -0.15], [0, 2.32, -0.26], 0.055, 420, 0);
    cap([0, 2.36, -0.29], [0, 2.78, -0.36], 0.125, 4200, 1);
    cap([-0.04, 2.36, -0.39], [-0.03, 2.62, -0.41], 0.012, 160, 1); cap([0.04, 2.36, -0.39], [0.03, 2.62, -0.41], 0.012, 160, 1);
    const mon = new Float32Array(M), NM = M.length / 8;
    // ---------- shaders ----------
    const VSW = [
      'attribute vec3 aP; attribute vec3 aN; attribute float aT; attribute float aS;',
      'uniform vec3 uCam; uniform float uSlope; uniform float uF; uniform vec2 uRes; uniform float uPings[8]; uniform float uTime; uniform float uPS; uniform float uGlow; uniform vec2 uShake;',
      'uniform float uMon; uniform vec4 uMT; uniform vec2 uYT; uniform float uSelf; uniform float uMaw;',
      'varying vec3 vC; varying float vA;',
      'vec3 ry(vec3 v, float a){ float c = cos(a), s = sin(a); return vec3(c*v.x + s*v.z, v.y, -s*v.x + c*v.z); }',
      'vec3 rx(vec3 v, float a){ float c = cos(a), s = sin(a); return vec3(v.x, c*v.y - s*v.z, s*v.y + c*v.z); }',
      'void main(){',
      '  vec3 p = aP; vec3 n = aN; float ty = aT;',
      '  if (uMon > 0.5) {',
      '    if (aT > 0.5) { vec3 hp = p - vec3(0.0, 2.34, -0.27); hp = rx(ry(hp, uYT.x), uYT.y); n = rx(ry(n, uYT.x), uYT.y);',
      '      if (hp.z < -0.1 && abs(hp.x) < uMaw && hp.y > 0.08 && hp.y < 0.3) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; return; }',
      '      p = hp + vec3(0.0, 2.34, -0.27); }',
      '    p = vec3(uMT.x, -1.6 + uMT.w, uMT.y) + p * uMT.z; ty = 4.0;',
      '  }',
      '  float z = p.z - uCam.z;',
      '  if (z < 0.18 || z > 38.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; return; }',
      '  float X = p.x - uCam.x - uSlope * z, Y = p.y - uCam.y;',
      '  float d = length(vec3(X, Y, z));',
      '  vec3 toC = -normalize(vec3(X, Y, z)); float lam = 0.35 + 0.65 * max(dot(n, toC), 0.0);',
      '  float b = d < 4.0 ? 0.16 * (1.0 - d / 4.0) : 0.0;',
      '  for (int k = 0; k < 8; k++){ float t0 = uPings[k]; if (t0 < -50.0) continue; float R = (uTime - t0) * 13.5; float att = exp(-d / 15.0); float e = R - d;',
      '    b += exp(-(e*e) / 0.16) * att * 2.6; if (e > 0.0) b += 0.95 * exp(-(e / 13.5) * 0.75) * att; }',
      '  b *= lam;',
      '  vec3 col = vec3(0.86, 0.82, 0.76) * (0.75 + 0.5 * aS);',
      '  if (ty > 0.5 && ty < 1.5) col = vec3(1.0, 0.62, 0.32) * (0.7 + 0.4 * aS);',
      '  if (ty > 1.5 && ty < 2.5) { col = vec3(0.62, 0.76, 0.95); b *= 1.0 + 1.5 * pow(max(dot(reflect(-toC, n), toC), 0.0), 8.0); }',
      '  if (ty > 2.5 && ty < 3.5) { col = vec3(1.0); b *= 1.7; }',
      '  if (ty > 3.5) { col = vec3(1.0, 0.13, 0.09) * (0.8 + 0.4 * aS); b *= 1.3; if (uSelf > 0.0) b = uSelf * (0.65 + 0.35 * fract(aS * 91.7 + uTime * 13.0)); }',
      '  vC = col * min(b, 2.2) * 1.35; vA = 1.0;',
      '  if (b < 0.02) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; return; }',
      '  vec2 s = vec2(X, Y) / z * uF + uShake;',
      '  gl_Position = vec4(s.x / (uRes.x * 0.5), s.y / (uRes.y * 0.5), 0.0, 1.0);',
      '  float sz = clamp(0.042 * uF / z, 1.2, 10.0) * uPS * (ty > 3.5 ? 1.15 : 1.0);',
      '  gl_PointSize = sz * uGlow; if (uGlow > 1.5) vC *= 0.075;',
      '}'
    ].join('\n');
    const FSW = 'precision mediump float; varying vec3 vC; void main(){ vec2 q = gl_PointCoord - 0.5; float r = dot(q, q) * 4.0; float a = exp(-r * 3.2); gl_FragColor = vec4(vC * a, 1.0); }';
    const VSQ = 'attribute vec2 a; varying vec2 v; void main(){ v = a * 0.5 + 0.5; gl_Position = vec4(a, 0.0, 1.0); }';
    const FSQ = 'precision mediump float; varying vec2 v; uniform float uHold; uniform float uBeat; uniform float uFlash; uniform float uBlack;' +
      'void main(){ vec2 q = v - 0.5; float r = length(q * vec2(1.4, 1.0)); float vig = smoothstep(0.35, 0.95, r) * 0.75;' +
      ' vec3 c = vec3(0.0); float a = vig; if (uHold > 0.0) { float h = smoothstep(0.2, 0.85, r) * (0.25 + uBeat * 0.35); c = mix(c, vec3(0.47, 0.0, 0.0), h / max(a + h, 0.001)); a = max(a, h); }' +
      ' if (uFlash > 0.0) { c = mix(c, vec3(1.0, 0.08, 0.08), uFlash); a = max(a, uFlash * 0.55); } if (uBlack > 0.0) { c = vec3(0.0); a = 1.0; }' +
      ' gl_FragColor = vec4(c, a); }';
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; } return s; };
    const prog = (v, f) => { const a = sh(gl.VERTEX_SHADER, v), b = sh(gl.FRAGMENT_SHADER, f); if (!a || !b) return null; const p = gl.createProgram(); gl.attachShader(p, a); gl.attachShader(p, b); gl.linkProgram(p); return gl.getProgramParameter(p, gl.LINK_STATUS) ? p : null; };
    const PW = prog(VSW, FSW), PQ = prog(VSQ, FSQ);
    if (!PW || !PQ) return false;
    const mkBuf = (arr) => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW); return b; };
    const bW = mkBuf(world), bM = mkBuf(mon), bQ = mkBuf(new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]));
    const L = { aP: gl.getAttribLocation(PW, 'aP'), aN: gl.getAttribLocation(PW, 'aN'), aT: gl.getAttribLocation(PW, 'aT'), aS: gl.getAttribLocation(PW, 'aS') };
    const UW = {}; ['uCam', 'uSlope', 'uF', 'uRes', 'uPings', 'uTime', 'uPS', 'uGlow', 'uShake', 'uMon', 'uMT', 'uYT', 'uSelf', 'uMaw'].forEach((k) => { UW[k] = gl.getUniformLocation(PW, k); });
    const UQ = {}; ['uHold', 'uBeat', 'uFlash', 'uBlack'].forEach((k) => { UQ[k] = gl.getUniformLocation(PQ, k); });
    const aQ = gl.getAttribLocation(PQ, 'a');
    const bindW = (buf) => {
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.enableVertexAttribArray(L.aP); gl.vertexAttribPointer(L.aP, 3, gl.FLOAT, false, 32, 0);
      gl.enableVertexAttribArray(L.aN); gl.vertexAttribPointer(L.aN, 3, gl.FLOAT, false, 32, 12);
      gl.enableVertexAttribArray(L.aT); gl.vertexAttribPointer(L.aT, 1, gl.FLOAT, false, 32, 24);
      gl.enableVertexAttribArray(L.aS); gl.vertexAttribPointer(L.aS, 1, gl.FLOAT, false, 32, 28);
    };
    let W = 1, H = 1, RW = 1, RH = 1, PS = 1;
    const resize = () => {
      const r = cv.getBoundingClientRect(); W = Math.max(320, r.width); H = Math.max(320, r.height);
      const sc = Math.max(0.6, Math.min(window.devicePixelRatio || 1, 3, Math.sqrt(16e6 / (W * H))) * (self.qs || 1));
      RW = Math.round(W * sc); RH = Math.round(H * sc); PS = sc; cv.width = RW; cv.height = RH;
    };
    this.onResize = resize; window.addEventListener('resize', resize); resize();
    let pS = 0, lastCh = -1, lastAuto = -10, armed = true, scareT = -1, lastBeat = 0;
    const t0 = performance.now();
    const chOf = (p) => p < 0.1 ? 0 : p < 0.3 ? 1 : p < 0.45 ? 2 : p < 0.6 ? 3 : p < 0.7 ? 4 : 5;
    const pingArr = new Float32Array(8);
    const frame = (now) => {
      if (self.dead) return;
      self.raf = requestAnimationFrame(frame);
      const t = (now - t0) / 1000; self.now = t;
      if (self._lt) { const dt = now - self._lt; self._ema = self._ema ? self._ema * 0.95 + dt * 0.05 : dt; }
      self._lt = now; self._fc = (self._fc || 0) + 1;
      if (self._fc % 90 === 0 && self._ema > 21 && (self.qs || 1) > 0.5) { self.qs = (self.qs || 1) - 0.2; resize(); }
      const rc = self.film.getBoundingClientRect(), vh = window.innerHeight || H;
      if (rc.bottom < -50 || rc.top > vh + 50) return;
      const target = clamp(-rc.top / Math.max(1, rc.height - Math.min(vh, H)), 0, 1);
      pS += (target - pS) * (reduce ? 1 : 0.08);
      const p = pS;
      if (self.bar) self.bar.style.transform = 'scaleX(' + p.toFixed(4) + ')';
      if (p < 0.6) { armed = true; scareT = -1; }
      if (armed && p >= 0.7) { armed = false; scareT = t; self.sndScare(); }
      const scare = scareT >= 0 ? t - scareT : -1;
      const ch = scare > 0.95 || (scareT >= 0 && reduce) ? 5 : Math.min(4, chOf(p));
      if (ch !== lastCh) { lastCh = ch; self.setState({ ch }); }
      const hold = p >= 0.6 && scareT < 0;
      if (!hold && scareT < 0 && t - lastAuto > 2.4) { lastAuto = t; self.pings.push({ t0: t }); self.sndPing(); }
      if (hold && t - lastBeat > 0.95) { lastBeat = t; self.sndBeat(); }
      self.pings = self.pings.filter((q) => t - q.t0 < 3.2);
      for (let i = 0; i < 8; i++) pingArr[i] = i < self.pings.length ? self.pings[self.pings.length - 1 - i].t0 : -100;
      const walk = sm(0, 0.62, p), camZ = lerp(0, 51, walk);
      const bob = reduce ? 0 : Math.sin(t * 6.5) * 0.035 * (walk > 0 && walk < 1 ? 1 : 0.2);
      const camX = cxz(camZ + 1.5), slope = (cxz(camZ + 6) - cxz(camZ)) / 6, camY = 0.15 + bob;
      let mz = 62, mScale = 1, selfLit = 0, dropY = 0, shx = 0, shy = 0;
      if (scare >= 0) {
        if (reduce) { mz = camZ + 2.2; selfLit = 0.8; }
        else {
          const k = clamp((scare - 0.06) / 0.3, 0, 1);
          mz = lerp(62, camZ + 0.72, k * k * k); mScale = lerp(1, 1.1, k); dropY = lerp(0, -0.9, k * k);
          selfLit = scare > 0.06 ? 1.0 : 0;
          const sh2 = scare > 0.3 ? Math.max(0, 1 - (scare - 0.3) / 0.6) : 0;
          shx = (Math.random() - 0.5) * 40 * sh2 * PS; shy = (Math.random() - 0.5) * 30 * sh2 * PS;
        }
      }
      const f = RH * 0.82;
      gl.viewport(0, 0, RW, RH); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(PW); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
      gl.uniform3f(UW.uCam, camX, camY, camZ); gl.uniform1f(UW.uSlope, slope); gl.uniform1f(UW.uF, f); gl.uniform2f(UW.uRes, RW, RH);
      gl.uniform1fv(UW.uPings, pingArr); gl.uniform1f(UW.uTime, t); gl.uniform1f(UW.uPS, PS); gl.uniform2f(UW.uShake, shx, shy);
      for (const glow of [1, 3.2]) {
        gl.uniform1f(UW.uGlow, glow);
        gl.uniform1f(UW.uMon, 0); bindW(bW); gl.drawArrays(gl.POINTS, 0, NW);
        if (p > 0.4 && !(scare > 0.95)) {
          gl.uniform1f(UW.uMon, 1); gl.uniform4f(UW.uMT, cxz(mz), mz, mScale, dropY);
          gl.uniform2f(UW.uYT, lerp(1.25, 0, sm(0.5, 0.58, p)), Math.sin(t * 0.9) * 0.08 + (scare >= 0 ? -0.25 : 0));
          gl.uniform1f(UW.uSelf, selfLit); gl.uniform1f(UW.uMaw, scare >= 0 ? 0.075 : 0.022);
          bindW(bM); gl.drawArrays(gl.POINTS, 0, NM);
        }
      }
      gl.useProgram(PQ); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.bindBuffer(gl.ARRAY_BUFFER, bQ); gl.enableVertexAttribArray(aQ); gl.vertexAttribPointer(aQ, 2, gl.FLOAT, false, 0, 0);
      const beat = Math.pow(Math.max(0, Math.sin((t % 0.95) / 0.95 * Math.PI)), 6);
      gl.uniform1f(UQ.uHold, hold ? 1 : 0); gl.uniform1f(UQ.uBeat, beat);
      gl.uniform1f(UQ.uFlash, scare > 0.3 && scare < 0.9 && !reduce ? Math.max(0, 1 - (scare - 0.3) / 0.35) * 0.85 : 0);
      gl.uniform1f(UQ.uBlack, scare > 0.95 ? 1 : 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.disableVertexAttribArray(aQ);
    };
    this.raf = requestAnimationFrame(frame);
    return true;
  }

  // ---------- film ----------
  startFilm() {
    const gl0 = this.cv.getContext('webgl', { alpha: false, antialias: false, premultipliedAlpha: false });
    if (gl0 && this.startFilmGL(gl0)) return;
    const self = this, cv = this.cv, ctx = cv.getContext('2d');
    const reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
    const lerp = (a, b, k) => a + (b - a) * k;
    const sm = (a, b, x) => { const k = clamp((x - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };
    let seed = 5;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    const cxz = (z) => Math.sin(z * 0.045) * 2.2;

    // ----- build point cloud -----
    const P = []; // x,y,z,type
    const add = (x, y, z, ty) => { P.push(x, y, z, ty); };
    for (let z = 0; z < 112; z += 0.3) {
      const c = cxz(z);
      for (let k = 0; k < 46; k++) {
        const th = (k / 46) * Math.PI * 2 + rnd() * 0.08;
        const r = 2.25 + 0.22 * Math.sin(th * 3 + z * 0.7) + 0.14 * Math.sin(th * 7 - z * 1.3) + rnd() * 0.09;
        let x = Math.cos(th) * r * 1.05, y = Math.sin(th) * r * 0.86;
        if (y < -1.6) { y = -1.6 + rnd() * 0.03; x *= 0.92 + rnd() * 0.1; }
        add(c + x, y, z + rnd() * 0.25, 0);
      }
    }
    for (let z = 3; z < 110; z += 4.5) {
      const c = cxz(z);
      for (let y = -1.6; y < 1.35; y += 0.06) { add(c - 1.85, y, z, 1); add(c - 1.78, y, z + 0.08, 1); add(c + 1.85, y, z, 1); add(c + 1.78, y, z + 0.08, 1); }
      for (let x = -2.0; x <= 2.0; x += 0.06) { add(c + x, 1.38, z, 1); add(c + x, 1.3, z + 0.05, 1); }
    }
    for (let z = 0; z < 110; z += 0.11) { const c = cxz(z); add(c - 0.55, -1.53, z, 2); add(c + 0.55, -1.53, z, 2); }
    for (let z = 0; z < 110; z += 0.7) { const c = cxz(z); for (let x = -0.8; x <= 0.8; x += 0.09) add(c + x, -1.58, z, 2); }
    const chalk = (z0, side) => {
      const c = cxz(z0), x0 = c + side * 2.12;
      for (let s = -0.35; s <= 0.35; s += 0.02) { add(x0, 0.2 + s, z0 + s * 0.9, 3); add(x0, 0.2 - s, z0 + s * 0.9, 3); }
      for (let a = 0; a < Math.PI * 2; a += 0.08) add(x0, 0.2 + Math.sin(a) * 0.5, z0 + Math.cos(a) * 0.5, 3);
    };
    chalk(12, -1); chalk(27, 1); chalk(41, -1);
    const tunnel = new Float32Array(P);
    // monster (local coords, facing -z toward the camera)
    const M = [], HEAD = [];
    const cap = (a, b, r, n, arr) => {
      const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], L = Math.hypot(dx, dy, dz) || 1;
      const ux = dx / L, uy = dy / L, uz = dz / L;
      let vx = -uy, vy = ux, vz = 0; if (Math.abs(uz) > 0.9) { vx = 1; vy = 0; vz = 0; }
      const vl = Math.hypot(vx, vy, vz); vx /= vl; vy /= vl; vz /= vl;
      const wx = uy * vz - uz * vy, wy = uz * vx - ux * vz, wz = ux * vy - uy * vx;
      for (let i = 0; i < n; i++) {
        const t = rnd(), ang = rnd() * Math.PI * 2, rr = r * (0.92 + rnd() * 0.16);
        arr.push(a[0] + dx * t + (vx * Math.cos(ang) + wx * Math.sin(ang)) * rr, a[1] + dy * t + (vy * Math.cos(ang) + wy * Math.sin(ang)) * rr, a[2] + dz * t + (vz * Math.cos(ang) + wz * Math.sin(ang)) * rr);
      }
    };
    for (const s of [-1, 1]) {
      cap([s * 0.17, 1.3, 0], [s * 0.21, 0.68, -0.06], 0.075, 140, M);
      cap([s * 0.21, 0.68, -0.06], [s * 0.23, 0.05, 0.05], 0.058, 120, M);
      cap([s * 0.23, 0.04, 0.05], [s * 0.25, 0.0, -0.18], 0.035, 30, M);
      cap([s * 0.34, 2.02, -0.1], [s * 0.46, 1.45, -0.24], 0.05, 110, M);
      cap([s * 0.46, 1.45, -0.24], [s * 0.5, 0.86, -0.34], 0.04, 100, M);
      for (let f = 0; f < 4; f++) cap([s * 0.5, 0.86, -0.34], [s * (0.47 + f * 0.025), 0.45, -0.42 + f * 0.02], 0.011, 22, M);
    }
    cap([0, 1.28, 0], [0, 2.02, -0.16], 0.16, 380, M);
    cap([-0.36, 2.02, -0.1], [0.36, 2.02, -0.1], 0.07, 120, M);
    for (let r = 0; r < 7; r++) cap([-0.14, 1.55 + r * 0.07, -0.13], [0.14, 1.55 + r * 0.07, -0.13], 0.012, 16, M);
    cap([0, 2.08, -0.15], [0, 2.32, -0.26], 0.055, 60, M);
    cap([0, 2.36, -0.29], [0, 2.78, -0.36], 0.125, 1100, HEAD);
    const monster = new Float32Array(M), head = new Float32Array(HEAD);

    // ----- canvases -----
    let W = 1, H = 1, RW = 1, RH = 1, PS = 1, img = null, data = null, u32 = null, buf = null, bctx = null, small = null, sctx = null;
    const resize = () => {
      const r = cv.getBoundingClientRect();
      W = Math.max(320, r.width); H = Math.max(320, r.height);
      const sc = Math.max(0.6, Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(2.6e6 / Math.max(1, W * H))) * (self.qs || 1));
      RW = Math.round(W * sc); RH = Math.round(H * sc); PS = sc;
      cv.width = RW; cv.height = RH;
      buf = document.createElement('canvas'); buf.width = RW; buf.height = RH; bctx = buf.getContext('2d');
      img = bctx.createImageData(RW, RH); data = img.data; u32 = new Uint32Array(data.buffer);
      small = document.createElement('canvas'); small.width = Math.max(1, Math.round(RW / 5)); small.height = Math.max(1, Math.round(RH / 5)); sctx = small.getContext('2d');
    };
    this.onResize = resize;
    window.addEventListener('resize', resize);
    resize();

    const COL = [[226, 216, 202], [255, 176, 104], [150, 190, 230], [255, 255, 255], [255, 42, 36]];
    const plot = (sx, sy, sz, c, b) => {
      const x0 = sx | 0, y0 = sy | 0, s = Math.max(0, Math.round((sz + 1) * PS) - 1);
      if (x0 < 0 || y0 < 0 || x0 + s >= RW || y0 + s >= RH) return;
      const r = c[0] * b, g = c[1] * b, bl = c[2] * b;
      for (let yy = 0; yy <= s; yy++) {
        let i = ((y0 + yy) * RW + x0) * 4;
        for (let xx = 0; xx <= s; xx++, i += 4) { data[i] = Math.min(255, data[i] + r); data[i + 1] = Math.min(255, data[i + 1] + g); data[i + 2] = Math.min(255, data[i + 2] + bl); }
      }
    };

    // ----- state -----
    let pS = 0, lastCh = -1, lastAuto = -10, armed = true, scareT = -1, lastBeat = 0;
    const t0 = performance.now();
    const chOf = (p) => p < 0.1 ? 0 : p < 0.3 ? 1 : p < 0.45 ? 2 : p < 0.6 ? 3 : p < 0.7 ? 4 : 5;
    const frame = (now) => {
      if (self.dead) return;
      self.raf = requestAnimationFrame(frame);
      const t = (now - t0) / 1000; self.now = t;
      if (self._lt) { const dt = now - self._lt; self._ema = self._ema ? self._ema * 0.95 + dt * 0.05 : dt; }
      self._lt = now; self._fc = (self._fc || 0) + 1;
      if (self._fc % 90 === 0 && self._ema > 21 && (self.qs || 1) > 0.5) { self.qs = (self.qs || 1) - 0.2; resize(); }
      const rc = self.film.getBoundingClientRect(), vh = window.innerHeight || H;
      if (rc.bottom < -50 || rc.top > vh + 50) return;
      const target = clamp(-rc.top / Math.max(1, rc.height - Math.min(vh, H)), 0, 1);
      pS += (target - pS) * (reduce ? 1 : 0.08);
      const p = pS;
      if (self.bar) self.bar.style.transform = 'scaleX(' + p.toFixed(4) + ')';
      if (p < 0.6) { armed = true; scareT = -1; }
      if (armed && p >= 0.7) { armed = false; scareT = t; self.sndScare(); }
      const scare = scareT >= 0 ? t - scareT : -1;
      const ch = scare > 0.95 || (scareT >= 0 && reduce) ? 5 : Math.min(4, chOf(p));
      if (ch !== lastCh) { lastCh = ch; self.setState({ ch }); }
      const hold = p >= 0.6 && scareT < 0;
      if (!hold && scareT < 0 && t - lastAuto > 2.4) { lastAuto = t; self.pings.push({ t0: t }); self.sndPing(); }
      if (hold && t - lastBeat > 0.95) { lastBeat = t; self.sndBeat(); }
      self.pings = self.pings.filter((q) => t - q.t0 < 3.2);

      // camera
      const walk = sm(0, 0.62, p);
      const camZ = lerp(0, 51, walk);
      const bob = reduce ? 0 : Math.sin(t * 6.5) * 0.035 * (walk > 0 && walk < 1 ? 1 : 0.2);
      const camX = cxz(camZ + 1.5), slope = (cxz(camZ + 6) - cxz(camZ)) / 6, camY = 0.15 + bob;
      const f = RH * 0.82;
      let shakeX = 0, shakeY = 0;
      u32.fill(0xFF000000);
      const pings = self.pings;
      const lightAt = (X, Y, Z) => {
        const d = Math.hypot(X, Y, Z); let b = d < 3.2 ? 0.09 * (1 - d / 3.2) : 0;
        for (let k = 0; k < pings.length; k++) {
          const R = (t - pings[k].t0) * 13.5, att = Math.exp(-d / 15);
          const e = R - d;
          b += Math.exp(-(e * e) / 0.22) * att * 1.9;
          if (e > 0) b += 0.7 * Math.exp(-(e / 13.5) * 1.0) * att;
        }
        return b;
      };
      const pc = tunnel.length;
      for (let i = 0; i < pc; i += 4) {
        const z = tunnel[i + 2] - camZ;
        if (z < 0.25 || z > 34) continue;
        const X = tunnel[i] - camX - slope * z, Y = tunnel[i + 1] - camY;
        let b = lightAt(X, Y, z);
        const ty = tunnel[i + 3];
        if (ty === 3) b *= 1.6;
        if (b < 0.03) continue;
        const sx = RW / 2 + X / z * f, sy = RH / 2 - Y / z * f;
        plot(sx, sy, z < 2.5 ? 3 : (z < 7 ? 2 : (z < 16 ? 1 : 0)), COL[ty], Math.min(1.6, b));
      }
      // monster
      const showM = p > 0.4;
      if (showM && !(scare > 0.95)) {
        let mz = 62, mScale = 1, selfLit = 0, dropY = 0;
        if (scare >= 0) {
          if (reduce) { mz = camZ + 2.2; selfLit = 0.7; }
          else {
            const k = clamp((scare - 0.06) / 0.3, 0, 1);
            mz = lerp(62, camZ + 0.72, k * k * k); mScale = lerp(1, 1.1, k); dropY = lerp(0, -0.9, k * k);
            selfLit = scare > 0.06 ? 0.9 + Math.random() * 0.4 : 0;
            const sh = scare > 0.3 ? Math.max(0, 1 - (scare - 0.3) / 0.6) : 0;
            shakeX = (Math.random() - 0.5) * 34 * sh; shakeY = (Math.random() - 0.5) * 26 * sh;
          }
        }
        const mx = cxz(mz), yaw = lerp(1.25, 0, sm(0.5, 0.58, p)), tilt = Math.sin(t * 0.9) * 0.08 + (scare >= 0 ? -0.25 : 0);
        const cy0 = Math.cos(yaw), sy0 = Math.sin(yaw);
        const drawPts = (arr, isHead) => {
          for (let i = 0; i < arr.length; i += 3) {
            let lx = arr[i], ly = arr[i + 1], lz = arr[i + 2];
            if (isHead) {
              const hx = lx, hy = ly - 2.34, hz = lz + 0.27;
              const rx = hx * cy0 + hz * sy0, rz = -hx * sy0 + hz * cy0;
              const ry = hy * Math.cos(tilt) - rz * Math.sin(tilt), rz2 = hy * Math.sin(tilt) + rz * Math.cos(tilt);
              lx = rx; ly = ry + 2.34; lz = rz2 - 0.27;
              const maw = scare >= 0 ? 0.075 : 0.022;
              if (lz < -0.38 && Math.abs(lx) < maw && ly > 2.42 && ly < 2.66) continue;
            }
            const wx = mx + lx * mScale, wy = -1.6 + ly * mScale + dropY, wz = mz + lz * mScale;
            const z = wz - camZ; if (z < 0.2) continue;
            const X = wx - camX - slope * z, Y = wy - camY;
            let b = selfLit > 0 ? selfLit * (0.6 + 0.4 * Math.random()) : lightAt(X, Y, z) * 1.25;
            if (b < 0.03) continue;
            plot(RW / 2 + X / z * f, RH / 2 - Y / z * f, z < 1.2 ? 5 : (z < 2.5 ? 3 : (z < 6 ? 2 : (z < 14 ? 1 : 0))), COL[4], Math.min(1.5, isHead && selfLit > 0 ? b * 1.3 : b));
          }
        };
        drawPts(monster, false); drawPts(head, true);
      }
      bctx.putImageData(img, 0, 0);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, RW, RH);
      ctx.drawImage(buf, shakeX, shakeY);
      sctx.clearRect(0, 0, small.width, small.height); sctx.drawImage(buf, 0, 0, small.width, small.height);
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.85; ctx.imageSmoothingEnabled = true;
      ctx.drawImage(small, shakeX, shakeY, RW, RH); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      // glitch + flash
      if (scare > 0.3 && scare < 0.9 && !reduce) {
        for (let k = 0; k < 7; k++) { const y = Math.random() * RH, h = 4 + Math.random() * RH * 0.06, dx = (Math.random() - 0.5) * 80; ctx.drawImage(cv, 0, y, RW, h, dx, y, RW, h); }
        const fl = Math.max(0, 1 - (scare - 0.3) / 0.35);
        ctx.fillStyle = 'rgba(255,20,20,' + (0.5 * fl) + ')'; ctx.fillRect(0, 0, RW, RH);
      }
      if (scare > 0.95) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, RW, RH); }
      // heartbeat vignette while holding breath
      if (hold) {
        const beat = Math.pow(Math.max(0, Math.sin((t % 0.95) / 0.95 * Math.PI)), 6);
        const g = ctx.createRadialGradient(RW / 2, RH / 2, RH * 0.2, RW / 2, RH / 2, RH * 0.85);
        g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(120,0,0,' + (0.25 + beat * 0.35) + ')');
        ctx.fillStyle = g; ctx.fillRect(0, 0, RW, RH);
      }
      const vg = ctx.createRadialGradient(RW / 2, RH / 2, RH * 0.35, RW / 2, RH / 2, RH * 0.95);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.7)');
      ctx.fillStyle = vg; ctx.fillRect(0, 0, RW, RH);
    };
    this.raf = requestAnimationFrame(frame);
  }
  renderVals() {
    const v = { canvasRef: this.canvasRef, filmRef: this.filmRef, barRef: this.barRef, doPing: this.doPing, toggleSound: this.toggleSound, flyRef: this.flyRef, tiltRef: this.tiltRef,
      soundLabel: this.state.sound ? 'Sound on' : 'Sound off', soundPressed: this.state.sound ? 'true' : 'false' };
    for (let i = 0; i < 6; i++) { v['c' + i] = this.state.ch === i ? 'on' : ''; v['h' + i] = this.state.ch === i ? 'false' : 'true'; }
    return v;
  }
}
