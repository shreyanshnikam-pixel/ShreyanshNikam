class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { ch: 0 };
    this.canvasRef = (el) => { if (el && el !== this.cv) { this.cv = el; this.tryStart(); } };
    this.filmRef = (el) => { if (el && el !== this.film) { this.film = el; this.tryStart(); } };
    this.barRef = (el) => { this.bar = el; };
    this.skyRef = (el) => { if (el && el !== this.skyCv) { this.skyCv = el; } };
  }
  tryStart() { if (this.cv && this.film && !this.started) { this.started = true; this.startFilm(); } }
  componentWillUnmount() {
    this.dead = true;
    if (this.raf) cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.onResize);
    this.cleanupFly();
  }
  skyGLInit(cv) {
    const gl = cv.getContext('webgl', { alpha: true, premultipliedAlpha: false, antialias: false });
    if (!gl) return null;
    const VS = 'attribute vec2 a; void main(){ gl_Position = vec4(a, 0.0, 1.0); }';
    const FS = [
      'precision highp float;',
      'uniform vec2 uRes; uniform vec2 uC; uniform vec2 uF; uniform float uZ; uniform vec2 uView; uniform float uHy; uniform vec2 uSun; uniform float uT; uniform float uNight; uniform float uDesat; uniform float uScale;',
      'float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }',
      'float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }',
      'float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 6; i++){ s += a * vn(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; } return s; }',
      'const float Re = 6360e3; const float Ra = 6420e3; const vec3 bR = vec3(5.8e-6, 13.5e-6, 33.1e-6); const float bM = 21e-6;',
      'vec2 sph(vec3 ro, vec3 rd, float r){ float b = dot(ro, rd), c = dot(ro, ro) - r*r, h = b*b - c; if (h < 0.0) return vec2(-1.0); h = sqrt(h); return vec2(-b - h, -b + h); }',
      'vec3 atmo(vec3 rd, vec3 sd, out vec3 trans){',
      '  vec3 ro = vec3(0.0, Re + 30.0, 0.0); float tm = sph(ro, rd, Ra).y; float ds = tm / 10.0;',
      '  vec3 sR = vec3(0.0), sM = vec3(0.0); float oR = 0.0, oM = 0.0; float mu = dot(rd, sd);',
      '  float pR = 3.0/(16.0*3.14159)*(1.0+mu*mu); float g = 0.76; float pM = 3.0/(8.0*3.14159)*((1.0-g*g)*(1.0+mu*mu))/((2.0+g*g)*pow(1.0+g*g-2.0*g*mu, 1.5));',
      '  for (int i = 0; i < 10; i++){',
      '    vec3 p = ro + rd * (float(i) + 0.5) * ds; float hh = length(p) - Re;',
      '    float hr = exp(-hh/7994.0)*ds, hm = exp(-hh/1200.0)*ds; oR += hr; oM += hm;',
      '    float tl = sph(p, sd, Ra).y; float dl = tl / 5.0; float lR = 0.0, lM = 0.0; bool ok = true;',
      '    for (int j = 0; j < 5; j++){ vec3 q = p + sd * (float(j) + 0.5) * dl; float hq = length(q) - Re; if (hq < 0.0) { ok = false; break; } lR += exp(-hq/7994.0)*dl; lM += exp(-hq/1200.0)*dl; }',
      '    if (ok) { vec3 tau = bR*(oR+lR) + bM*1.1*(oM+lM); vec3 at = exp(-tau); sR += at*hr; sM += at*hm; }',
      '  }',
      '  trans = exp(-(bR*oR + bM*1.1*oM));',
      '  return 22.0 * (sR*bR*pR + sM*bM*pM); }',
      'vec3 sunTrans(vec3 sd){ vec3 ro = vec3(0.0, Re + 1500.0, 0.0); float tl = sph(ro, sd, Ra).y; float dl = tl/8.0; float lR=0.0, lM=0.0;',
      '  for (int j = 0; j < 8; j++){ vec3 q = ro + sd*(float(j)+0.5)*dl; float hq = max(0.0, length(q)-Re); lR += exp(-hq/7994.0)*dl; lM += exp(-hq/1200.0)*dl; }',
      '  return exp(-(bR*lR + bM*1.1*lM)); }',
      'vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14), 0.0, 1.0); }',
      'void main(){',
      '  vec2 sp = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uScale;',
      '  vec2 w = (sp - uC) / uZ + uF;',
      '  float W = uView.x, H = uView.y;',
      '  float ey = (uHy - w.y) / H;',
      '  if (ey < -0.004) { gl_FragColor = vec4(0.0); return; }',
      '  vec3 rd = normalize(vec3((w.x - W*0.5)/H*0.95, max(ey, 0.0)*1.7 + 0.004, 1.0));',
      '  vec3 sd = normalize(vec3((uSun.x - W*0.5)/H*0.95, (uHy - uSun.y)/H*1.7, 1.0));',
      '  vec3 tr; vec3 col = atmo(rd, sd, tr);',
      '  vec3 sunCol = sunTrans(sd) * 22.0;',
      '  float mu = dot(rd, sd);',
      '  float disk = smoothstep(0.99955, 0.99975, mu); vec3 sunD = sunCol * disk * 6.0 * (0.6 + 0.4*smoothstep(0.99955, 0.99999, mu));',
      '  col += sunD * smoothstep(-0.002, 0.004, rd.y);',
      '  col += sunCol * 0.018 * pow(max(mu, 0.0), 300.0);',
      '  // clouds: two layers on planes above the camera',
      '  vec3 cl = vec3(0.0); float ca = 0.0;',
      '  for (int L = 0; L < 2; L++){',
      '    float alt = L == 0 ? 1.0 : 3.2; float tH = alt / max(rd.y, 0.02); vec2 xz = rd.xz * tH;',
      '    vec2 uv = L == 0 ? xz * vec2(0.55, 0.9) + vec2(uT * 0.012, 0.0) : xz * vec2(0.18, 0.9) + vec2(uT * 0.004, 3.0);',
      '    float cov = L == 0 ? 0.52 : 0.6;',
      '    float d0 = fbm(uv * (L == 0 ? 1.6 : 1.0));',
      '    if (L == 1) d0 = fbm(vec2(uv.x * 0.6, uv.y * 5.0));',
      '    float den = smoothstep(cov, cov + (L == 0 ? 0.22 : 0.35), d0);',
      '    if (den <= 0.001) continue;',
      '    vec2 sdir = normalize(sd.xz + vec2(0.0001)); float occ = 0.0;',
      '    for (int k = 1; k < 5; k++){ occ += smoothstep(cov, cov + 0.22, fbm((uv + sdir * float(k) * 0.07) * (L == 0 ? 1.6 : 1.0))); }',
      '    float beer = exp(-occ * 0.55); float powder = 1.0 - exp(-den * 2.0);',
      '    float hg = 0.5 + 2.2 * pow(max(mu, 0.0), 8.0);',
      '    vec3 amb = atmo(normalize(vec3(rd.x, 0.35, rd.z)), sd, tr) * 0.55;',
      '    vec3 c = sunCol * 0.05 * beer * powder * hg + amb * (0.55 + 0.45 * den);',
      '    float fade = smoothstep(0.0, 0.07, rd.y);',
      '    float a = den * fade * (L == 0 ? 0.92 : 0.55);',
      '    cl = cl * (1.0 - a) + c * a; ca = ca + a * (1.0 - ca);',
      '  }',
      '  col = col * (1.0 - ca) + cl;',
      '  float st = step(0.996, h21(floor(gl_FragCoord.xy / (2.0 * uScale / max(uScale, 1.0))))) * smoothstep(0.08, 0.5, rd.y);',
      '  col += vec3(st) * uNight * (0.5 + 0.5 * sin(uT * 2.0 + h21(floor(gl_FragCoord.xy)) * 40.0)) * 0.9;',
      '  col *= mix(1.0, 0.35, uNight);',
      '  col = aces(col * 0.42); col = pow(col, vec3(1.0/2.2));',
      '  float g = dot(col, vec3(0.299, 0.587, 0.114)); col = mix(col, vec3(g) * vec3(0.92, 1.0, 1.05), uDesat);',
      '  float hz = smoothstep(-0.004, 0.0, ey);',
      '  gl_FragColor = vec4(col, hz);',
      '}'
    ].join('\n');
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; } return s; };
    const vs = sh(gl.VERTEX_SHADER, VS), fs = sh(gl.FRAGMENT_SHADER, FS);
    if (!vs || !fs) return null;
    const pr = gl.createProgram(); gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return null;
    gl.useProgram(pr);
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'a'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = {}; ['uRes', 'uC', 'uF', 'uZ', 'uView', 'uHy', 'uSun', 'uT', 'uNight', 'uDesat', 'uScale'].forEach((k) => { U[k] = gl.getUniformLocation(pr, k); });
    return (o) => {
      const px = Math.max(1, Math.round(o.W * o.scale)), py = Math.max(1, Math.round(o.H * o.scale));
      if (cv.width !== px || cv.height !== py) { cv.width = px; cv.height = py; }
      gl.viewport(0, 0, px, py);
      gl.uniform2f(U.uRes, px, py); gl.uniform1f(U.uScale, o.scale);
      gl.uniform2f(U.uC, o.Cx, o.Cy); gl.uniform2f(U.uF, o.Fx, o.Fy); gl.uniform1f(U.uZ, o.z);
      gl.uniform2f(U.uView, o.W, o.H); gl.uniform1f(U.uHy, o.hy); gl.uniform2f(U.uSun, o.sx, o.sy);
      gl.uniform1f(U.uT, o.t); gl.uniform1f(U.uNight, o.night); gl.uniform1f(U.uDesat, o.desat);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
  }

  startFilm() {
    const self = this, cv = this.cv, ctx = cv.getContext('2d');
    const reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    let W = 1, H = 1, dpr = 1, hy = 1;
    let seed = 11;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
    const lerp = (a, b, k) => a + (b - a) * k;
    const sm = (a, b, x) => { const k = clamp((x - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };
    let clouds = [], ridges = [], stars = [], grass = [], grain = null, vign = null, trails = [];
    const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };

    const build = () => {
      seed = 11;
      hy = H * 0.64;
      clouds = [];
      for (let i = 0; i < 7; i++) {
        const cw = W * (0.28 + rnd() * 0.22), ch = cw * 0.32;
        const c = mk(cw, ch), g = c.getContext('2d');
        for (let k = 0; k < 46; k++) {
          const px = cw * (0.12 + rnd() * 0.76), py = ch * (0.35 + rnd() * 0.4) - Math.sin((px / cw) * Math.PI) * ch * 0.18;
          const r = ch * (0.16 + rnd() * 0.24);
          const lowK = clamp((py / ch - 0.3) * 1.6, 0, 1);
          const rg = g.createRadialGradient(px, py, 0, px, py, r);
          const top = 'rgba(' + Math.round(lerp(70, 255, lowK)) + ',' + Math.round(lerp(72, 150, lowK)) + ',' + Math.round(lerp(110, 120, lowK)) + ',';
          rg.addColorStop(0, top + '0.32)'); rg.addColorStop(0.6, top + '0.14)'); rg.addColorStop(1, top + '0)');
          g.fillStyle = rg; g.beginPath(); g.arc(px, py, r, 0, Math.PI * 2); g.fill();
        }
        clouds.push({ c, x: rnd() * W * 1.4 - W * 0.2, y: hy - H * (0.16 + rnd() * 0.36), sp: 4 + rnd() * 10, par: 0.1 + rnd() * 0.35, w: cw, h: ch });
      }
      ridges = [];
      const cols = ['rgba(118,88,118,0.75)', 'rgba(70,52,86,0.92)', '#2A2034'];
      for (let l = 0; l < 3; l++) {
        const pts = [], ph = [rnd() * 9, rnd() * 9, rnd() * 9], amp = H * (0.05 - l * 0.012), base = hy - H * (0.004 + l * 0.0);
        for (let x = -20; x <= W + 20; x += 10) {
          const y = base - amp * (0.55 + 0.25 * Math.sin(x * 0.004 + ph[0]) + 0.15 * Math.sin(x * 0.011 + ph[1]) + 0.08 * Math.sin(x * 0.031 + ph[2]));
          pts.push([x, y]);
        }
        ridges.push({ pts, col: cols[l] });
      }
      stars = [];
      for (let i = 0; i < 140; i++) stars.push([rnd() * W, rnd() * hy * 0.7, rnd() * 1.3 + 0.3, rnd() * 6]);
      grass = [];
      for (let x = 0; x < W; x += 5) grass.push([x, 10 + rnd() * 26, rnd() * 6]);
      grain = mk(180, 180);
      const gg = grain.getContext('2d'), id = gg.createImageData(180, 180);
      for (let i = 0; i < id.data.length; i += 4) { const v = rnd() * 255; id.data[i] = v; id.data[i + 1] = v; id.data[i + 2] = v; id.data[i + 3] = 255; }
      gg.putImageData(id, 0, 0);
      vign = mk(W, H);
      const vg = vign.getContext('2d'), rg = vg.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
      rg.addColorStop(0, 'rgba(0,0,0,0)'); rg.addColorStop(1, 'rgba(0,0,0,0.72)');
      vg.fillStyle = rg; vg.fillRect(0, 0, W, H);
      trails = [[], [], [], [], [], [], []];
    };
    const resize = () => {
      dpr = Math.max(0.75, Math.min(window.devicePixelRatio || 1, 3, Math.sqrt(16e6 / Math.max(1, cv.clientWidth * cv.clientHeight))) * (self.qs || 1));
      const r = cv.getBoundingClientRect();
      W = Math.max(320, r.width); H = Math.max(320, r.height);
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      build();
    };
    this.onResize = resize;
    window.addEventListener('resize', resize);
    resize();
    const skyGL = this.skyCv ? this.skyGLInit(this.skyCv) : null;
    if (!skyGL && this.skyCv) this.skyCv.style.display = 'none';

    // ---------- world elements ----------
    const flockOff = [[0, 0], [-0.026, -0.012], [-0.021, 0.015], [-0.052, -0.02], [-0.046, 0.024], [0.022, 0.006]];
    const conf = [0.94, 0.91, 0.97, 0.89, 0.92, 0.95];
    const flockCenter = (p, t) => {
      const k = clamp((p - 0.07) / 0.83, 0, 1);
      return [lerp(-0.1, 0.72, k) * W, lerp(0.39, 0.53, k) * H + Math.sin(k * 3.2) * H * 0.015 + Math.sin(t * 0.7) * H * 0.004];
    };
    const birdPos = (i, p, t) => {
      const c = flockCenter(p, t), o = flockOff[i];
      return [c[0] + o[0] * W + Math.sin(t * 1.3 + i * 1.7) * W * 0.004, c[1] + o[1] * H * 1.6 + Math.cos(t * 1.1 + i) * H * 0.005];
    };
    const planeState = (p, t) => {
      const a = clamp(p / 0.76, 0, 1);
      let x = lerp(1.16, 0.86, a) * W, y = lerp(0.1 * H, 0.35 * H, a), s = lerp(0.4, 0.85, a), th = 0.03, gear = 1;
      const g = sm(0.76, 0.9, p);
      if (g > 0) {
        const bx = lerp(lerp(0.86 * W, 0.62 * W, g), lerp(0.62 * W, 0.16 * W, g), g);
        const by = lerp(lerp(0.35 * H, 0.3 * H, g), lerp(0.3 * H, 0.06 * H, g), g);
        x = bx; y = by; s = lerp(0.85, 1.05, g); th = lerp(0.03, 0.24, sm(0, 0.35, g)); gear = 1 - sm(0.25, 0.6, g);
      }
      const e = sm(0.9, 1.0, p);
      if (e > 0) { x = lerp(0.16 * W, -0.35 * W, e); y = lerp(0.06 * H, -0.14 * H, e); }
      return { x, y, s, th, gear, a };
    };
    const dronePos = (p, t) => [W * 0.47 + Math.sin(t * 0.6) * W * 0.01, hy - H * 0.31 + Math.sin(t * 1.7) * H * 0.006];

    const drawSky = (p, t) => {
      const g = ctx.createLinearGradient(0, 0, 0, hy);
      g.addColorStop(0, '#070C22'); g.addColorStop(0.34, '#18244A'); g.addColorStop(0.56, '#4A3B62');
      g.addColorStop(0.72, '#9B5767'); g.addColorStop(0.86, '#E2845C'); g.addColorStop(1, '#FFC27C');
      ctx.fillStyle = g; ctx.fillRect(-W, -H, W * 3, hy + H);
      const night = 0.15 + p * 0.45;
      ctx.fillStyle = 'rgba(4,7,22,' + night.toFixed(3) + ')'; ctx.fillRect(-W, -H, W * 3, hy + H);
      const sa = clamp(p * 1.6 - 0.1, 0, 1);
      for (const s of stars) { ctx.fillStyle = 'rgba(255,255,255,' + (sa * (0.4 + 0.6 * Math.abs(Math.sin(t * 0.8 + s[3])))).toFixed(3) + ')'; ctx.fillRect(s[0], s[1], s[2], s[2]); }
      const sx = W * 0.3, sy = hy - H * 0.035 + p * H * 0.05, sr = W * 0.03;
      ctx.globalCompositeOperation = 'lighter';
      let rg = ctx.createRadialGradient(sx, sy, 0, sx, sy, W * 0.5);
      rg.addColorStop(0, 'rgba(255,190,120,0.55)'); rg.addColorStop(0.2, 'rgba(255,140,90,0.22)'); rg.addColorStop(1, 'rgba(255,120,80,0)');
      ctx.fillStyle = rg; ctx.fillRect(sx - W * 0.5, sy - W * 0.5, W, W);
      rg = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr);
      rg.addColorStop(0, 'rgba(255,248,230,1)'); rg.addColorStop(0.7, 'rgba(255,214,150,0.95)'); rg.addColorStop(1, 'rgba(255,170,100,0)');
      ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      for (const c of clouds) {
        let x = ((c.x + t * c.sp - p * W * c.par) % (W * 1.6));
        if (x < -c.w) x += W * 1.6;
        ctx.globalAlpha = 0.85; ctx.drawImage(c.c, x - W * 0.2, c.y, c.w, c.h); ctx.globalAlpha = 1;
      }
      const hz = ctx.createLinearGradient(0, hy - H * 0.08, 0, hy);
      hz.addColorStop(0, 'rgba(255,190,140,0)'); hz.addColorStop(1, 'rgba(255,190,140,0.35)');
      ctx.fillStyle = hz; ctx.fillRect(-W, hy - H * 0.08, W * 3, H * 0.08);
    };
    const drawGround = (p, t) => {
      for (const r of ridges) {
        ctx.fillStyle = r.col; ctx.beginPath(); ctx.moveTo(-W, hy + 2);
        for (const q of r.pts) ctx.lineTo(q[0], q[1]);
        ctx.lineTo(W * 2, hy + 2); ctx.closePath(); ctx.fill();
      }
      const g = ctx.createLinearGradient(0, hy, 0, H);
      g.addColorStop(0, '#231A26'); g.addColorStop(0.3, '#120E16'); g.addColorStop(1, '#06050A');
      ctx.fillStyle = g; ctx.fillRect(-W, hy, W * 3, H);
      // terminal + hangars
      ctx.fillStyle = '#0D0B12';
      ctx.fillRect(W * 0.04, hy - H * 0.026, W * 0.2, H * 0.03); ctx.fillRect(W * 0.08, hy - H * 0.04, W * 0.07, H * 0.016);
      ctx.fillRect(W * 0.25, hy - H * 0.018, W * 0.08, H * 0.02);
      for (let i = 0; i < 26; i++) { const wx = W * (0.05 + i * 0.0072); ctx.fillStyle = (i % 5 === 2) ? 'rgba(255,200,140,0.2)' : 'rgba(255,210,150,0.75)'; ctx.fillRect(wx, hy - H * 0.017, W * 0.003, H * 0.005); }
      // tower
      const tx = W * 0.19;
      ctx.fillStyle = '#0B0A10'; ctx.fillRect(tx - W * 0.006, hy - H * 0.12, W * 0.012, H * 0.124);
      ctx.beginPath(); ctx.moveTo(tx - W * 0.02, hy - H * 0.12); ctx.lineTo(tx + W * 0.02, hy - H * 0.12); ctx.lineTo(tx + W * 0.016, hy - H * 0.148); ctx.lineTo(tx - W * 0.016, hy - H * 0.148); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(150,230,200,0.3)'; ctx.fillRect(tx - W * 0.016, hy - H * 0.142, W * 0.032, H * 0.014);
      const bOn = (t % 2) < 1;
      ctx.globalCompositeOperation = 'lighter';
      glow(tx, hy - H * 0.156, W * 0.005, bOn ? 'rgba(120,255,170,' : 'rgba(255,255,255,', 0.8);
      ctx.globalCompositeOperation = 'source-over';
      // runway strip
      const ry0 = hy + H * 0.03, ry1 = hy + H * 0.058;
      ctx.fillStyle = '#1D1B22'; ctx.beginPath(); ctx.moveTo(-W, ry0); ctx.lineTo(W * 0.56, ry0); ctx.lineTo(W * 0.56, ry1); ctx.lineTo(-W, ry1); ctx.fill();
      ctx.fillStyle = 'rgba(230,230,240,0.35)';
      for (let x = 0; x < W * 0.54; x += W * 0.03) ctx.fillRect(x, (ry0 + ry1) / 2 - 1, W * 0.014, 2);
      ctx.globalCompositeOperation = 'lighter';
      for (let x = W * 0.01; x < W * 0.56; x += W * 0.022) { glow(x, ry0, 4, 'rgba(255,236,200,', 0.9); glow(x, ry1, 5, 'rgba(255,236,200,', 0.9); }
      for (let k = 0; k < 5; k++) glow(W * 0.56, lerp(ry0, ry1, k / 4), 5, 'rgba(90,255,140,', 0.95);
      const papi = ['rgba(255,255,255,', 'rgba(255,255,255,', 'rgba(255,70,60,', 'rgba(255,70,60,'];
      for (let k = 0; k < 4; k++) glow(W * (0.47 + k * 0.009), ry1 + H * 0.012, 4, papi[k], 1);
      const rabbit = (t * 2.2) % 1;
      for (let k = 0; k < 14; k++) {
        const x = W * (0.575 + k * 0.022), on = Math.abs((1 - k / 14) - rabbit) < 0.05;
        glow(x, (ry0 + ry1) / 2, on ? 8 : 3, on ? 'rgba(255,255,255,' : 'rgba(255,220,170,', on ? 1 : 0.7);
      }
      for (let x = W * 0.05; x < W * 0.5; x += W * 0.05) glow(x, ry0 - H * 0.012, 3, 'rgba(90,140,255,', 0.8);
      ctx.globalCompositeOperation = 'source-over';
    };
    const glow = (x, y, r, rgb, a) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
      g.addColorStop(0, rgb + a + ')'); g.addColorStop(0.25, rgb + (a * 0.5) + ')'); g.addColorStop(1, rgb + '0)');
      ctx.fillStyle = g; ctx.fillRect(x - r * 3, y - r * 3, r * 6, r * 6);
    };
    const drawForeground = (p, t) => {
      ctx.fillStyle = '#040306';
      ctx.beginPath(); ctx.moveTo(0, H);
      for (const gr of grass) { const sway = Math.sin(t * 1.4 + gr[2] + gr[0] * 0.01) * 3; ctx.lineTo(gr[0] + sway, H * 0.93 - gr[1]); ctx.lineTo(gr[0] + 2.5, H * 0.95); }
      ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
      ctx.fillRect(0, H * 0.94, W, H * 0.06);
      // the Sky Sentry phone on a tripod
      const bx = W * 0.12, by = H * 0.95;
      ctx.strokeStyle = '#08070C'; ctx.lineWidth = Math.max(2, W * 0.0022); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(bx, by - H * 0.15); ctx.lineTo(bx - W * 0.025, by); ctx.moveTo(bx, by - H * 0.15); ctx.lineTo(bx + W * 0.022, by); ctx.moveTo(bx, by - H * 0.15); ctx.lineTo(bx + W * 0.004, by + 4); ctx.stroke();
      ctx.save(); ctx.translate(bx, by - H * 0.16); ctx.rotate(-0.42);
      ctx.fillStyle = '#0B0A10'; roundRect(-W * 0.012, -W * 0.022, W * 0.024, W * 0.044, W * 0.004); ctx.fill();
      ctx.strokeStyle = 'rgba(255,190,140,0.35)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.restore();
      if ((t % 1.2) < 0.7) { ctx.globalCompositeOperation = 'lighter'; glow(bx + W * 0.01, by - H * 0.19, 3, 'rgba(255,40,40,', 1); ctx.globalCompositeOperation = 'source-over'; }
    };
    const roundRect = (x, y, w, h, r) => { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); };

    const drawBird = (x, y, b, t, ph, col) => {
      const f = Math.sin(t * 10 + ph);
      ctx.strokeStyle = col; ctx.lineWidth = Math.max(1.2, b * 0.11); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(x - b, y - f * b * 0.42);
      ctx.quadraticCurveTo(x - b * 0.45, y - f * b * 0.22 - b * 0.16, x, y);
      ctx.quadraticCurveTo(x + b * 0.45, y - f * b * 0.22 - b * 0.16, x + b, y - f * b * 0.42);
      ctx.stroke();
      ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(x + b * 0.06, y + b * 0.03, b * 0.2, b * 0.07, 0.1, 0, Math.PI * 2); ctx.fill();
    };
    const drawDrone = (x, y, s, t) => {
      ctx.fillStyle = '#0C0B12'; ctx.strokeStyle = '#0C0B12'; ctx.lineWidth = Math.max(1, s * 0.08);
      ctx.fillRect(x - s * 0.35, y - s * 0.12, s * 0.7, s * 0.24);
      ctx.beginPath(); ctx.moveTo(x - s, y - s * 0.15); ctx.lineTo(x + s, y - s * 0.15); ctx.stroke();
      ctx.fillStyle = 'rgba(30,30,40,0.55)';
      for (const dx of [-s, s]) { ctx.beginPath(); ctx.ellipse(x + dx, y - s * 0.22, s * 0.5, s * 0.07, 0, 0, Math.PI * 2); ctx.fill(); }
      ctx.globalCompositeOperation = 'lighter';
      if ((t % 0.8) < 0.4) glow(x + s * 0.35, y, 2.5, 'rgba(255,60,60,', 1); else glow(x - s * 0.35, y, 2.5, 'rgba(80,255,120,', 1);
      ctx.globalCompositeOperation = 'source-over';
    };

    const drawPlane = (ps, t) => {
      const L = W * 0.2 / 100 * ps.s;
      ctx.save(); ctx.translate(ps.x, ps.y); ctx.rotate(ps.th); ctx.scale(L, L); ctx.translate(-50, 0);
      // far wing
      ctx.fillStyle = '#5C6470';
      ctx.beginPath(); ctx.moveTo(40, -3); ctx.lineTo(56, -3.5); ctx.lineTo(67, -10); ctx.lineTo(62, -10.2); ctx.closePath(); ctx.fill();
      // vertical stabilizer
      let g = ctx.createLinearGradient(0, -26, 0, -5); g.addColorStop(0, '#9AA4B2'); g.addColorStop(1, '#D3D9E1');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(78, -5.4); ctx.lineTo(90, -25); ctx.lineTo(97, -25.6); ctx.lineTo(100.5, -8.5); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(30,36,46,0.5)'; ctx.beginPath(); ctx.moveTo(90, -25); ctx.lineTo(97, -25.6); ctx.lineTo(97.6, -23); ctx.lineTo(91.2, -23); ctx.closePath(); ctx.fill();
      // fuselage
      g = ctx.createLinearGradient(0, -6.5, 0, 6); g.addColorStop(0, '#F1F3F6'); g.addColorStop(0.3, '#CBD1DA'); g.addColorStop(0.68, '#838D9A'); g.addColorStop(1, '#2C323C');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(2.2, 1.2); ctx.quadraticCurveTo(0.2, -3.6, 8.5, -5.4); ctx.lineTo(76, -5.6); ctx.quadraticCurveTo(89, -6.2, 99.5, -9.2); ctx.lineTo(101.5, -7.4); ctx.quadraticCurveTo(91, -1.2, 74, 4.9); ctx.lineTo(14, 5.7); ctx.quadraticCurveTo(4, 5.7, 2.2, 1.2); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(255,196,150,0.75)'; ctx.lineWidth = 0.35; ctx.beginPath(); ctx.moveTo(8.5, -5.3); ctx.lineTo(76, -5.5); ctx.quadraticCurveTo(89, -6.1, 99.5, -9.1); ctx.stroke();
      // cheatline shadow + windows
      ctx.fillStyle = 'rgba(40,46,58,0.35)'; ctx.fillRect(12, -0.8, 62, 0.5);
      for (let x = 16; x < 72; x += 2.3) { ctx.fillStyle = 'rgba(255,224,170,0.95)'; ctx.fillRect(x, -2.6, 1.0, 1.25); }
      ctx.fillStyle = '#121721'; ctx.beginPath(); ctx.moveTo(4.4, -2.6); ctx.lineTo(9.6, -4.5); ctx.lineTo(10.8, -2.4); ctx.lineTo(5.4, -1.5); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(40,46,58,0.4)'; ctx.lineWidth = 0.25; ctx.strokeRect(11.5, -4.2, 2.2, 6.5); ctx.strokeRect(68, -4.4, 2, 6.2);
      // horizontal stabilizer
      ctx.fillStyle = '#8E97A3'; ctx.beginPath(); ctx.moveTo(86, -6); ctx.lineTo(99.5, -3.4); ctx.lineTo(101.5, -1.6); ctx.lineTo(90, -2.6); ctx.closePath(); ctx.fill();
      // gear
      if (ps.gear > 0.02) {
        const gf = ps.gear;
        ctx.strokeStyle = '#1B1F27'; ctx.lineWidth = 0.9;
        ctx.beginPath(); ctx.moveTo(12.5, 5.4); ctx.lineTo(12.5, 5.4 + 5.6 * gf); ctx.moveTo(47, 5); ctx.lineTo(47.5, 5 + 7.5 * gf); ctx.stroke();
        ctx.fillStyle = '#0C0E12';
        ctx.beginPath(); ctx.arc(12.5, 5.6 + 5.6 * gf, 1.5 * gf, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(46.4, 5.6 + 7.5 * gf, 1.9 * gf, 0, Math.PI * 2); ctx.arc(49.2, 5.6 + 7.5 * gf, 1.9 * gf, 0, Math.PI * 2); ctx.fill();
      }
      // near wing + engine
      g = ctx.createLinearGradient(0, 1, 0, 11); g.addColorStop(0, '#A9B2BE'); g.addColorStop(1, '#4A525E');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(35, 1.8); ctx.lineTo(55, 2.4); ctx.lineTo(71, 10.6); ctx.lineTo(65, 11.2); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(20,24,30,0.5)'; ctx.lineWidth = 0.3; ctx.beginPath(); ctx.moveTo(52, 2.6); ctx.lineTo(66, 9.8); ctx.stroke();
      g = ctx.createLinearGradient(0, 5, 0, 12); g.addColorStop(0, '#C9D0D9'); g.addColorStop(1, '#3A414C');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(30.5, 6); ctx.lineTo(43, 6.2); ctx.quadraticCurveTo(46, 8.6, 43, 11.4); ctx.lineTo(31, 11.6); ctx.quadraticCurveTo(29.2, 8.8, 30.5, 6); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#0A0C10'; ctx.beginPath(); ctx.ellipse(30.6, 8.8, 0.9, 2.6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      // lights in screen space
      const toS = (lx, ly) => { const c = Math.cos(ps.th), s = Math.sin(ps.th); const X = (lx - 50) * L, Y = ly * L; return [ps.x + X * c - Y * s, ps.y + X * s + Y * c]; };
      ctx.globalCompositeOperation = 'lighter';
      const bc = (t % 1.1) < 0.12;
      if (bc) { const q = toS(50, -6); glow(q[0], q[1], 3 * ps.s + 2, 'rgba(255,40,40,', 1); }
      const q2 = toS(69, 11); glow(q2[0], q2[1], 2 + ps.s * 2, 'rgba(255,50,50,', 0.9);
      const st = t % 1.3; if (st < 0.05 || (st > 0.12 && st < 0.17)) { const q3 = toS(101, -8); glow(q3[0], q3[1], 6 + ps.s * 6, 'rgba(255,255,255,', 1); const q4 = toS(70, 11); glow(q4[0], q4[1], 6 + ps.s * 6, 'rgba(255,255,255,', 1); }
      ctx.globalCompositeOperation = 'source-over';
      return [toS(36, 4.5), toS(12.5, 7.5)];
    };
    const flare = (pts, I) => {
      if (I <= 0.01) return;
      ctx.globalCompositeOperation = 'lighter';
      for (const q of pts) {
        let g = ctx.createRadialGradient(q[0], q[1], 0, q[0], q[1], W * 0.06 * I);
        g.addColorStop(0, 'rgba(255,255,255,' + (0.95 * I) + ')'); g.addColorStop(0.12, 'rgba(255,240,215,' + (0.5 * I) + ')'); g.addColorStop(1, 'rgba(255,200,150,0)');
        ctx.fillStyle = g; ctx.fillRect(q[0] - W * 0.06, q[1] - W * 0.06, W * 0.12, W * 0.12);
      }
      const q = pts[0];
      ctx.save(); ctx.translate(q[0], q[1]); ctx.scale(1, 0.012);
      let g = ctx.createRadialGradient(0, 0, 0, 0, 0, W * 0.55);
      g.addColorStop(0, 'rgba(180,215,255,' + (0.55 * I) + ')'); g.addColorStop(1, 'rgba(120,170,255,0)');
      ctx.fillStyle = g; ctx.fillRect(-W * 0.55, -W * 0.55, W * 1.1, W * 1.1);
      ctx.restore();
      const cx = W / 2, cy = H / 2;
      for (const [k, r, a] of [[0.5, 0.02, 0.08], [1.25, 0.035, 0.06], [1.6, 0.012, 0.12]]) {
        const x = q[0] + (cx - q[0]) * k * 2, y = q[1] + (cy - q[1]) * k * 2;
        const g2 = ctx.createRadialGradient(x, y, 0, x, y, W * r);
        g2.addColorStop(0, 'rgba(160,200,255,' + (a * I) + ')'); g2.addColorStop(1, 'rgba(160,200,255,0)');
        ctx.fillStyle = g2; ctx.fillRect(x - W * r, y - W * r, W * r * 2, W * r * 2);
      }
      ctx.globalCompositeOperation = 'source-over';
    };

    // ---------- HUD ----------
    const riskOf = (p) => p < 0.48 ? 0 : (p < 0.54 ? 1 : 2);
    const RC = ['#3DDC84', '#FFC83D', '#FF3B30'];
    const RN = ['GREEN', 'YELLOW', 'RED'];
    const bracket = (x, y, w, h, col, lw) => {
      const c = Math.min(w, h) * 0.28;
      ctx.strokeStyle = col; ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.moveTo(x, y + c); ctx.lineTo(x, y); ctx.lineTo(x + c, y);
      ctx.moveTo(x + w - c, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + c);
      ctx.moveTo(x + w, y + h - c); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w - c, y + h);
      ctx.moveTo(x + c, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y + h - c);
      ctx.stroke();
    };
    const label = (txt, x, y, col, bg) => {
      ctx.font = '600 ' + Math.round(clamp(W * 0.0085, 10, 13)) + 'px "Geist Mono", ui-monospace, monospace';
      const w = ctx.measureText(txt).width + 10, h = Math.round(clamp(W * 0.0085, 10, 13)) + 8;
      ctx.fillStyle = bg; ctx.fillRect(x, y - h, w, h);
      ctx.fillStyle = col; ctx.fillText(txt, x + 5, y - 5);
    };
    const drawHUD = (p, t, h, cam, bird, ps, dr) => {
      if (h <= 0.01) return;
      ctx.save(); ctx.globalAlpha = h;
      const m = Math.max(24, W * 0.03), top = H * 0.16, bot = H * 0.86;
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 2;
      bracket(m, top, W - m * 2, bot - top, 'rgba(255,255,255,0.85)', 2);
      ctx.font = '600 ' + Math.round(clamp(W * 0.0095, 11, 14)) + 'px "Geist Mono", ui-monospace, monospace';
      ctx.fillStyle = '#FFFFFF';
      if ((t % 1) < 0.6) { ctx.fillStyle = '#FF3B30'; ctx.beginPath(); ctx.arc(m + 18, top + 22, 5, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = '#FFFFFF'; ctx.fillText('REC   CAM 03   RWY 27 APPROACH', m + 30, top + 27);
      const secs = 18 + Math.floor(t) % 42;
      const ts = '19:42:' + (secs < 10 ? '0' : '') + secs + '   4 FRAMES/S   JPEG STREAM';
      if (W > 700) { ctx.textAlign = 'right'; ctx.fillText(ts, W - m - 14, top + 27); ctx.textAlign = 'left'; }
      const risk = riskOf(p), rc = RC[risk];
      // corridor
      const cor = sm(0.44, 0.5, p);
      if (cor > 0) {
        const a = cam(ps.x, ps.y), b = cam(W * 0.56, hy + H * 0.044);
        const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len, wv = H * 0.045 * cam.z;
        ctx.globalAlpha = h * cor;
        ctx.fillStyle = 'rgba(255,59,48,0.10)'; ctx.beginPath(); ctx.moveTo(a[0] + nx * wv, a[1] + ny * wv); ctx.lineTo(b[0] + nx * wv * 0.3, b[1] + ny * wv * 0.3); ctx.lineTo(b[0] - nx * wv * 0.3, b[1] - ny * wv * 0.3); ctx.lineTo(a[0] - nx * wv, a[1] - ny * wv); ctx.closePath(); ctx.fill();
        ctx.setLineDash([8, 6]); ctx.strokeStyle = 'rgba(255,90,80,0.9)'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.setLineDash([]);
        const mx = lerp(a[0], b[0], 0.35), my = lerp(a[1], b[1], 0.35);
        label('APPROACH CORRIDOR', mx + nx * wv + 8, my + ny * wv - 6, '#FFFFFF', 'rgba(200,30,30,0.85)');
        ctx.globalAlpha = h;
      }
      // aircraft
      if (p > 0.3 && p < 0.8) {
        const a = cam(ps.x, ps.y), sz = W * 0.11 * ps.s * cam.z;
        bracket(a[0] - sz, a[1] - sz * 0.32, sz * 2, sz * 0.7, 'rgba(200,210,225,0.85)', 1.5);
        label('AIRCRAFT  TRACKED', a[0] - sz, a[1] - sz * 0.32 - 4, '#0B0F1A', 'rgba(220,228,240,0.92)');
      }
      // drone
      if (p > 0.37) {
        const d = cam(dr[0], dr[1]), sz = W * 0.02 * cam.z;
        bracket(d[0] - sz, d[1] - sz * 0.7, sz * 2, sz * 1.4, '#FFB36B', 1.6);
        label('DRONE 0.88  #07', d[0] - sz, d[1] - sz * 0.7 - 4, '#140A00', 'rgba(255,179,107,0.95)');
      }
      // birds
      let minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9, all = true;
      for (let i = 0; i < 6; i++) {
        const q = cam(bird[i][0], bird[i][1]);
        const tr = trails[i]; tr.push(q); if (tr.length > 26) tr.shift();
        const det = p > 0.31 + i * 0.017;
        if (!det) { all = false; continue; }
        const sz = W * 0.016 * cam.z * 1.25;
        minx = Math.min(minx, q[0] - sz); miny = Math.min(miny, q[1] - sz); maxx = Math.max(maxx, q[0] + sz); maxy = Math.max(maxy, q[1] + sz);
        ctx.strokeStyle = rc; ctx.globalAlpha = h * 0.6; ctx.lineWidth = 1.2; ctx.beginPath();
        for (let k = 0; k < tr.length; k++) { const z = tr[k]; if (k === 0) ctx.moveTo(z[0], z[1]); else ctx.lineTo(z[0], z[1]); }
        ctx.stroke(); ctx.globalAlpha = h;
        const pop = sm(0.31 + i * 0.017, 0.325 + i * 0.017, p);
        const s2 = sz * (1 + (1 - pop) * 1.2);
        bracket(q[0] - s2, q[1] - s2 * 0.75, s2 * 2, s2 * 1.5, rc, 1.8);
        label('BIRD ' + conf[i].toFixed(2) + '  #' + (11 + i), q[0] - s2, q[1] - s2 * 0.75 - 4, risk === 1 ? '#2A1D00' : '#FFFFFF', risk === 0 ? 'rgba(20,120,70,0.92)' : (risk === 1 ? 'rgba(255,200,61,0.95)' : 'rgba(220,30,30,0.95)'));
        if (p > 0.44) {
          const vl = W * 0.035 * cam.z * sm(0.44, 0.52, p);
          ctx.strokeStyle = rc; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(q[0], q[1]); ctx.lineTo(q[0] + vl, q[1] + vl * 0.08); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(q[0] + vl, q[1] + vl * 0.08); ctx.lineTo(q[0] + vl - 7, q[1] + vl * 0.08 - 5); ctx.moveTo(q[0] + vl, q[1] + vl * 0.08); ctx.lineTo(q[0] + vl - 7, q[1] + vl * 0.08 + 5); ctx.stroke();
        }
      }
      if (all && p > 0.42) {
        const pad = 16; ctx.setLineDash([6, 5]); ctx.strokeStyle = rc; ctx.lineWidth = 1.5;
        ctx.strokeRect(minx - pad, miny - pad - 26, maxx - minx + pad * 2, maxy - miny + pad * 2 + 26); ctx.setLineDash([]);
        label('FLOCK x6   HEADING 088   14 M/S', minx - pad, miny - pad - 26 - 4, risk === 1 ? '#2A1D00' : '#FFFFFF', risk === 0 ? 'rgba(20,120,70,0.92)' : (risk === 1 ? 'rgba(255,200,61,0.95)' : 'rgba(220,30,30,0.95)'));
      }
      // risk panel
      const pw = Math.min(330, Math.max(240, W * 0.3)), px = m + 18, py = W > 700 ? bot - 112 : top + 44;
      ctx.fillStyle = 'rgba(6,8,16,0.72)'; ctx.fillRect(px, py, pw, 92);
      ctx.fillStyle = '#AEB6C6'; ctx.font = '600 12px "Geist Mono", ui-monospace, monospace'; ctx.fillText('RISK', px + 14, py + 24);
      ctx.fillText('TIME TO CORRIDOR', px + pw * 0.5, py + 24);
      for (let k = 0; k < 3; k++) { ctx.fillStyle = k <= risk ? RC[k] : 'rgba(255,255,255,0.12)'; ctx.fillRect(px + 14 + k * 38, py + 36, 34, 10); }
      ctx.fillStyle = rc; ctx.font = '700 22px "Geist Mono", ui-monospace, monospace'; ctx.fillText(RN[risk], px + 14, py + 76);
      const ttc = Math.max(0, 4 * (1 - sm(0.44, 0.62, p)));
      ctx.fillStyle = '#FFFFFF'; ctx.fillText(ttc.toFixed(1) + ' S', px + pw * 0.5, py + 76);
      ctx.restore();
    };
    const drawTower = (p, t) => {
      const k = sm(0.6, 0.64, p) * (1 - sm(0.76, 0.8, p));
      if (k <= 0.01) return;
      const pw = Math.min(460, Math.max(300, W * 0.32)), px = W - pw - Math.max(24, W * 0.04) + (1 - k) * 60, py = H * 0.2;
      ctx.save(); ctx.globalAlpha = k;
      ctx.fillStyle = 'rgba(8,10,20,0.88)'; roundRect(px, py, pw, H * (W > 700 ? 0.56 : 0.48), 16); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1; ctx.stroke();
      const fs = Math.round(clamp(W * 0.0095, 11, 13));
      ctx.font = '600 ' + fs + 'px "Geist Mono", ui-monospace, monospace'; ctx.fillStyle = '#AEB6C6';
      ctx.fillText('TOWER DASHBOARD   RWY 27', px + 22, py + 34);
      ctx.fillStyle = '#FF3B30'; roundRect(px + 22, py + 50, pw - 44, 86, 10); ctx.fill();
      ctx.fillStyle = '#FFFFFF'; ctx.font = '700 ' + (fs + 1) + 'px "Geist Mono", ui-monospace, monospace'; ctx.fillText('RED ALERT  SPOKEN', px + 38, py + 76);
      ctx.font = '600 ' + Math.round(fs * 1.35) + 'px Geist, system-ui, sans-serif';
      ctx.fillText('Flock of six birds, heading', px + 38, py + 102); ctx.fillText('toward the runway.', px + 38, py + 124);
      for (let i = 0; i < 34; i++) { const a = Math.abs(Math.sin(t * 9 + i * 0.7) * Math.sin(t * 3.1 + i * 0.3)); ctx.fillStyle = 'rgba(255,255,255,0.75)'; const bh = 4 + a * 26; ctx.fillRect(px + 22 + i * ((pw - 44) / 34), py + 172 - bh / 2, (pw - 44) / 34 - 3, bh); }
      ctx.font = '500 ' + fs + 'px "Geist Mono", ui-monospace, monospace'; ctx.fillStyle = '#AEB6C6'; ctx.fillText('ELEVENLABS VOICE   0.5 S', px + 22, py + 206);
      ctx.fillStyle = '#FFB36B'; ctx.fillText('INCIDENT REPORT   GEMINI', px + 22, py + 240);
      const rep = '19:42. Six birds crossing the runway 27 approach corridor at low altitude, closing on inbound traffic. Advise arriving aircraft and hold departures until clear.';
      const n = Math.floor(rep.length * sm(0.63, 0.71, p));
      ctx.fillStyle = '#E7EAF0'; ctx.font = '400 ' + Math.round(fs * 1.15) + 'px Geist, system-ui, sans-serif';
      wrap(rep.slice(0, n), px + 22, py + 266, pw - 44, Math.round(fs * 1.6));
      ctx.font = '500 ' + fs + 'px "Geist Mono", ui-monospace, monospace'; ctx.fillStyle = '#B59CFF';
      const hy2 = py + H * (W > 700 ? 0.56 : 0.48) - 56;
      ctx.fillText('DRONE REPORT STAMPED   SOLANA DEVNET', px + 22, hy2);
      const hash = '9f2c41e07ab35d6c88e1f40b2a97c5d3e61f08b4a7c9d2e5f1036b8a4c7e0d19';
      const hn = Math.floor(hash.length * sm(0.7, 0.75, p));
      ctx.fillStyle = '#E7EAF0'; ctx.fillText('SHA-256 ' + hash.slice(0, Math.min(hn, 28)) + (hn > 28 ? '...' : ''), px + 22, hy2 + 24);
      ctx.restore();
    };
    const wrap = (txt, x, y, mw, lh) => {
      const words = txt.split(' '); let line = '', yy = y;
      for (const w of words) { const test = line ? line + ' ' + w : w; if (ctx.measureText(test).width > mw && line) { ctx.fillText(line, x, yy); line = w; yy += lh; } else line = test; }
      if (line) ctx.fillText(line, x, yy);
    };

    // ---------- loop ----------
    let pS = 0, lastCh = -1;
    const t0 = performance.now();
    const chOf = (p) => p < 0.12 ? 0 : p < 0.26 ? 1 : p < 0.44 ? 2 : p < 0.6 ? 3 : p < 0.76 ? 4 : p < 0.9 ? 5 : 6;
    const frame = (now) => {
      if (self.dead) return;
      self.raf = requestAnimationFrame(frame);
      const t = (now - t0) / 1000;
      if (self._lt) { const dt = now - self._lt; self._ema = self._ema ? self._ema * 0.95 + dt * 0.05 : dt; }
      self._lt = now; self._fc = (self._fc || 0) + 1;
      if (self._fc % 90 === 0 && self._ema > 21 && (self.qs || 1) > 0.5) { self.qs = (self.qs || 1) - 0.2; resize(); }
      const r = self.film.getBoundingClientRect(), vh = window.innerHeight || H;
      if (r.bottom < -50 || r.top > vh + 50) return;
      const target = clamp(-r.top / Math.max(1, r.height - Math.min(vh, H)), 0, 1);
      pS += (target - pS) * (reduce ? 1 : 0.09);
      const p = pS;
      if (self.bar) self.bar.style.transform = 'scaleX(' + p.toFixed(4) + ')';
      const ch = chOf(p);
      if (ch !== lastCh) { lastCh = ch; self.setState({ ch }); }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const h = sm(0.26, 0.32, p) * (1 - sm(0.74, 0.8, p));
      const fc = flockCenter(p, t);
      const z = 1 + 1.25 * h;
      const Cx = lerp(fc[0], W * 0.42, h), Cy = lerp(fc[1], H * 0.47, h);
      const drift = Math.sin(t * 0.25) * 6 * (1 - h), dolly = p * H * 0.02;
      const cam = (x, y) => [(x - fc[0]) * z + (h > 0 ? Cx : fc[0]) + drift, (y - fc[1]) * z + (h > 0 ? Cy : fc[1]) - dolly];
      cam.z = z;
      if (skyGL) skyGL({ W, H, scale: Math.max(0.35, Math.min(1, 1600 / W)) * Math.min(dpr, 1.5) * 0.6 * (self.qs || 1), Cx: (h > 0 ? Cx : fc[0]) + drift, Cy: (h > 0 ? Cy : fc[1]) - dolly, Fx: fc[0], Fy: fc[1], z, hy, sx: W * 0.3, sy: hy - H * 0.035 + p * H * 0.05, t, night: Math.min(0.85, Math.max(0, p * 0.9 - 0.15)), desat: h * 0.55 });
      ctx.save();
      ctx.translate((h > 0 ? Cx : fc[0]) + drift, (h > 0 ? Cy : fc[1]) - dolly); ctx.scale(z, z); ctx.translate(-fc[0], -fc[1]);
      if (!skyGL) drawSky(p, t);
      drawGround(p, t);
      // distant birds
      for (let i = 0; i < 9; i++) {
        const bx = ((i * 173 + t * (12 + i * 3)) % (W * 1.3)) - W * 0.15, by = hy - H * (0.32 + (i % 4) * 0.05) + Math.sin(t + i) * 4;
        drawBird(bx, by, W * 0.0045, t * 0.8, i, 'rgba(26,20,36,0.7)');
      }
      const bird = [];
      for (let i = 0; i < 6; i++) bird.push(birdPos(i, p, t));
      const ps = planeState(p, t);
      const dr = dronePos(p, t);
      drawDrone(dr[0], dr[1], W * 0.008, t);
      const birdsBehind = ps.y < bird[0][1];
      if (!birdsBehind) for (let i = 0; i < 6; i++) drawBird(bird[i][0], bird[i][1], W * 0.016, t, i * 1.3, '#120D17');
      const lights = drawPlane(ps, t);
      if (birdsBehind) for (let i = 0; i < 6; i++) drawBird(bird[i][0], bird[i][1], W * 0.016, t, i * 1.3, '#120D17');
      ctx.restore();
      // lens flare (screen space)
      const L = lights.map((q) => cam(q[0], q[1]));
      flare(L, Math.pow(ps.a, 1.4) * (1 - sm(0.8, 0.88, p)) * (1 - h * 0.6));
      // foreground (not zoomed), hidden in camera view
      if (h < 0.99) { ctx.save(); ctx.globalAlpha = 1 - h; drawForeground(p, t); ctx.restore(); }
      // camera grade
      if (h > 0.01) {
        ctx.save(); ctx.globalCompositeOperation = 'saturation'; ctx.fillStyle = 'rgba(128,128,128,' + (h * 0.55) + ')'; ctx.fillRect(0, 0, W, H); ctx.restore();
        ctx.fillStyle = 'rgba(0,10,20,' + (h * 0.18) + ')'; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = 'rgba(0,0,0,' + (h * 0.12) + ')';
        for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);
      }
      drawHUD(p, t, h, cam, bird, ps, dr);
      drawTower(p, t);
      // grade, grain, vignette, letterbox
      ctx.drawImage(vign, 0, 0, W, H);
      ctx.save(); ctx.globalAlpha = 0.05 + h * 0.07; ctx.globalCompositeOperation = 'overlay';
      const ox = Math.floor(Math.random() * 180), oy = Math.floor(Math.random() * 180);
      for (let x = -ox; x < W; x += 180) for (let y = -oy; y < H; y += 180) ctx.drawImage(grain, x, y);
      ctx.restore();
      const lb = H * 0.065 * (1 - h);
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, lb); ctx.fillRect(0, H - lb, W, lb);
      const fade = sm(0.9, 0.98, p);
      if (fade > 0) { ctx.fillStyle = 'rgba(3,4,10,' + (fade * 0.85) + ')'; ctx.fillRect(0, 0, W, H); }
    };
    this.raf = requestAnimationFrame(frame);
  }
  renderVals() {
    const v = { canvasRef: this.canvasRef, filmRef: this.filmRef, barRef: this.barRef, skyRef: this.skyRef, flyRef: this.flyRef, tiltRef: this.tiltRef };
    for (let i = 0; i < 7; i++) { v['c' + i] = this.state.ch === i ? 'on' : ''; v['h' + i] = this.state.ch === i ? 'false' : 'true'; }
    return v;
  }
}
