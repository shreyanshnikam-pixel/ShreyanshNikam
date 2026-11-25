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
      '  float b = d < 3.2 ? 0.07 * (1.0 - d / 3.2) : 0.0;',
      '  for (int k = 0; k < 8; k++){ float t0 = uPings[k]; if (t0 < -50.0) continue; float R = (uTime - t0) * 13.5; float att = exp(-d / 15.0); float e = R - d;',
      '    b += exp(-(e*e) / 0.12) * att * 1.7; if (e > 0.0) b += 0.55 * exp(-(e / 13.5) * 1.1) * att; }',
      '  b *= lam;',
      '  vec3 col = vec3(0.86, 0.82, 0.76) * (0.75 + 0.5 * aS);',
      '  if (ty > 0.5 && ty < 1.5) col = vec3(1.0, 0.62, 0.32) * (0.7 + 0.4 * aS);',
      '  if (ty > 1.5 && ty < 2.5) { col = vec3(0.62, 0.76, 0.95); b *= 1.0 + 1.5 * pow(max(dot(reflect(-toC, n), toC), 0.0), 8.0); }',
      '  if (ty > 2.5 && ty < 3.5) { col = vec3(1.0); b *= 1.7; }',
      '  if (ty > 3.5) { col = vec3(1.0, 0.13, 0.09) * (0.8 + 0.4 * aS); b *= 1.3; if (uSelf > 0.0) b = uSelf * (0.65 + 0.35 * fract(aS * 91.7 + uTime * 13.0)); }',
      '  vC = col * min(b, 1.8); vA = 1.0;',
      '  if (b < 0.02) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; return; }',
      '  vec2 s = vec2(X, Y) / z * uF + uShake;',
      '  gl_Position = vec4(s.x / (uRes.x * 0.5), s.y / (uRes.y * 0.5), 0.0, 1.0);',
      '  float sz = clamp(0.03 * uF / z, 1.0, 16.0) * uPS * (ty > 3.5 ? 1.15 : 1.0);',
      '  gl_PointSize = sz * uGlow; if (uGlow > 1.5) vC *= 0.05;',
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
