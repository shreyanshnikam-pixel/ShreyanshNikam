  mountMedals() {
    if (this._medInit) return; this._medInit = true;
    const cvs = Array.prototype.slice.call(document.querySelectorAll('canvas.medal-gl'));
    if (!cvs.length) return;
    const gc = document.createElement('canvas');
    const gl = gc.getContext('webgl', { alpha: true, premultipliedAlpha: false, antialias: false, preserveDrawingBuffer: false });
    if (!gl) return;
    const VS = 'attribute vec2 a; void main(){ gl_Position = vec4(a, 0.0, 1.0); }';
    const FS = [
      'precision highp float;',
      'uniform vec2 uRes; uniform float uAng; uniform float uTilt; uniform sampler2D uTex; uniform float uMat; uniform vec3 uTint;',
      'const float R = 1.0; const float HT = 0.082; const float RB = 0.028;',
      'vec3 ry(vec3 v, float a){ float c = cos(a), s = sin(a); return vec3(c*v.x + s*v.z, v.y, -s*v.x + c*v.z); }',
      'vec3 rx(vec3 v, float a){ float c = cos(a), s = sin(a); return vec3(v.x, c*v.y - s*v.z, s*v.y + c*v.z); }',
      'float relief(vec3 p){ vec2 uv = p.xy * 0.5 + 0.5; float front = step(0.0, p.z);',
      '  vec2 t = vec2(mix(1.0 - uv.x, uv.x, front) * 0.5 + (1.0 - front) * 0.5, 1.0 - uv.y);',
      '  return texture2D(uTex, t).r; }',
      'float sdf(vec3 p){ float r = length(p.xy);',
      '  float reed = 0.0025 * sin(atan(p.y, p.x) * 140.0) * smoothstep(R - 0.05, R, r);',
      '  vec2 d = vec2(r - R + RB + reed, abs(p.z) - HT + RB);',
      '  float s = min(max(d.x, d.y), 0.0) + length(max(d, 0.0)) - RB;',
      '  if (r < R - 0.015 && abs(p.z) > HT - 0.07) s -= relief(p) * 0.034;',
      '  return s; }',
      'vec3 nrm(vec3 p){ const vec2 k = vec2(1.0, -1.0); float e = 0.0012;',
      '  return normalize(k.xyy*sdf(p + k.xyy*e) + k.yyx*sdf(p + k.yyx*e) + k.yxy*sdf(p + k.yxy*e) + k.xxx*sdf(p + k.xxx*e)); }',
      'float box(vec3 d, vec3 ax, vec2 sz){ float c = dot(d, ax); if (c <= 0.0) return 0.0;',
      '  vec3 u = normalize(cross(ax, abs(ax.y) > 0.9 ? vec3(1.0,0.0,0.0) : vec3(0.0,1.0,0.0))); vec3 v = cross(ax, u);',
      '  vec2 q = vec2(dot(d, u), dot(d, v)) / c;',
      '  return smoothstep(sz.x, sz.x * 0.7, abs(q.x)) * smoothstep(sz.y, sz.y * 0.7, abs(q.y)); }',
      'vec3 env(vec3 d){',
      '  vec3 c = mix(vec3(0.03, 0.03, 0.035), vec3(0.16, 0.15, 0.145), smoothstep(-0.3, 0.9, d.y));',
      '  c += uTint * 0.35 * smoothstep(0.2, 1.0, d.y);',
      '  c += vec3(0.06, 0.035, 0.025) * smoothstep(0.0, -0.7, d.y);',
      '  c += vec3(7.0, 6.4, 5.6) * box(d, normalize(vec3(-0.55, 0.62, 0.55)), vec2(0.42, 0.22));',
      '  c += vec3(2.4, 2.7, 3.2) * box(d, normalize(vec3(0.85, 0.15, 0.5)), vec2(0.1, 0.65));',
      '  c += vec3(1.8) * box(d, normalize(vec3(0.0, 0.95, -0.3)), vec2(0.55, 0.1));',
      '  c += vec3(1.1, 1.0, 0.92) * box(d, normalize(vec3(-0.1, -0.15, 1.0)), vec2(0.8, 0.1));',
      '  c += vec3(0.9, 0.95, 1.05) * box(d, normalize(vec3(-0.9, -0.1, 0.4)), vec2(0.12, 0.5));',
      '  c += uTint * 2.2 * box(d, normalize(vec3(0.2, 0.9, 0.35)), vec2(0.25, 0.25));',
      '  return c; }',
      'vec3 envBlur(vec3 r, float rough){ vec3 acc = vec3(0.0);',
      '  vec3 u = normalize(cross(r, vec3(0.0, 1.0, 0.0001))); vec3 v = cross(r, u);',
      '  for (int i = 0; i < 8; i++){ float a = float(i) * 2.39996; float rr = sqrt((float(i) + 0.5) / 8.0) * rough;',
      '    acc += env(normalize(r + (u * cos(a) + v * sin(a)) * rr)); }',
      '  return acc / 8.0; }',
      'vec3 aces(vec3 x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }',
      'void main(){',
      '  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;',
      '  vec3 ro = vec3(0.0, 0.0, 4.6); vec3 rd = normalize(vec3(p * 0.62, -1.0));',
      '  vec3 lro = rx(ry(ro, -uAng), -uTilt); vec3 lrd = rx(ry(rd, -uAng), -uTilt);',
      '  float b = dot(lro, lrd); float c = dot(lro, lro) - 1.25; float h = b*b - c;',
      '  if (h < 0.0) { gl_FragColor = vec4(0.0); return; }',
      '  float t = max(0.0, -b - sqrt(h)); float hit = 0.0; float md = 1.0;',
      '  for (int i = 0; i < 90; i++){ vec3 q = lro + lrd * t; float d = sdf(q); md = min(md, d); if (d < 0.0006) { hit = 1.0; break; } t += d * 0.8; if (t > 7.0) break; }',
      '  if (hit < 0.5) { gl_FragColor = vec4(0.0); return; }',
      '  vec3 lp = lro + lrd * t; vec3 ln = nrm(lp);',
      '  vec3 n = ry(rx(ln, uTilt), uAng); vec3 v = -rd; vec3 r = reflect(rd, n);',
      '  float rad = length(lp.xy); float face = smoothstep(0.55, 0.8, abs(ln.z)); float ht = rad < R - 0.015 ? relief(lp) : 0.0;',
      '  float field = face * (1.0 - smoothstep(0.35, 0.6, ht)) * (1.0 - smoothstep(0.82, 0.86, rad));',
      '  vec3 gold = vec3(1.0, 0.76, 0.33), silver = vec3(0.96, 0.95, 0.93);',
      '  vec3 metal = uMat < 0.5 ? gold : (uMat < 1.5 ? silver : gold);',
      '  float rough = mix(0.06, 0.22, field);',
      '  float brushed = 0.5 + 0.5 * sin(rad * 900.0); rough += field * brushed * 0.05;',
      '  float ndv = clamp(dot(n, v), 0.0, 1.0);',
      '  vec3 F = metal + (1.0 - metal) * pow(1.0 - ndv, 5.0);',
      '  vec3 spec = envBlur(r, rough) * F;',
      '  float ao = mix(0.55, 1.0, face > 0.5 ? clamp(ht * 1.4 + 0.25, 0.0, 1.0) : 1.0);',
      '  vec3 col = spec * ao;',
      '  if (uMat > 1.5 && field > 0.01) {',
      '    vec3 enamel = uMat < 2.5 ? vec3(0.62, 0.02, 0.04) : vec3(0.02, 0.42, 0.38);',
      '    vec3 fn = ry(rx(vec3(0.0, 0.0, sign(lp.z)), uTilt), uAng); vec3 fr = reflect(rd, fn); float fdv = clamp(dot(fn, v), 0.0, 1.0);',
      '    vec3 diff = enamel * (envBlur(fn, 0.9) * 1.1 + 0.05);',
      '    float fc = 0.04 + 0.96 * pow(1.0 - fdv, 5.0);',
      '    vec3 coat = env(fr) * fc;',
      '    col = mix(col, diff + coat, field);',
      '  }',
      '  col = aces(col * 0.9);',
      '  col = pow(col, vec3(1.0 / 2.2));',
      '  gl_FragColor = vec4(col, 1.0);',
      '}'
    ].join('\n');
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; } return s; };
    const vs = sh(gl.VERTEX_SHADER, VS), fs = sh(gl.FRAGMENT_SHADER, FS);
    if (!vs || !fs) return;
    const pr = gl.createProgram(); gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return;
    gl.useProgram(pr);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'a'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = {}; ['uRes', 'uAng', 'uTilt', 'uTex', 'uMat', 'uTint'].forEach((k) => { U[k] = gl.getUniformLocation(pr, k); });
    const MATS = { gold: 0, silver: 1, red: 2, teal: 3 };
    const drawTex = (m) => {
      const c = document.createElement('canvas'); c.width = 1024; c.height = 512; const g = c.getContext('2d');
      g.fillStyle = '#000'; g.fillRect(0, 0, 1024, 512);
      const side = (ox, top, main, bot, back) => {
        const cx = ox + 256, cy = 256;
        g.save();
        g.strokeStyle = '#1C1C1C'; g.lineWidth = 1.2;
        for (let r = 30; r < 210; r += 5) { g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke(); }
        g.lineWidth = 2; g.strokeStyle = '#2A2A2A';
        for (let a = 0; a < 72; a++) { const an = a / 72 * Math.PI * 2; g.beginPath(); g.moveTo(cx + Math.cos(an) * 60, cy + Math.sin(an) * 60); g.lineTo(cx + Math.cos(an) * 205, cy + Math.sin(an) * 205); g.stroke(); }
        let gr = g.createRadialGradient(cx, cy, 214, cx, cy, 252); gr.addColorStop(0, '#000'); gr.addColorStop(0.18, '#FFF'); gr.addColorStop(0.75, '#FFF'); gr.addColorStop(1, '#888');
        g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, 252, 0, Math.PI * 2); g.arc(cx, cy, 214, 0, Math.PI * 2, true); g.fill();
        g.fillStyle = '#E0E0E0';
        for (let a = 0; a < 60; a++) { const an = a / 60 * Math.PI * 2; g.beginPath(); g.arc(cx + Math.cos(an) * 203, cy + Math.sin(an) * 203, 4.2, 0, Math.PI * 2); g.fill(); }
        const arcText = (txt, rad, size, bottom) => {
          g.font = '700 ' + size + 'px Geist, Arial, sans-serif'; g.fillStyle = '#FFF';
          const chars = txt.split(''); const widths = chars.map((ch) => g.measureText(ch).width + size * 0.12);
          const total = widths.reduce((a2, b2) => a2 + b2, 0); let ang = (bottom ? 1 : -1) * Math.PI / 2 - (bottom ? -1 : 1) * total / rad / 2;
          for (let i = 0; i < chars.length; i++) {
            const w = widths[i]; const a = ang + (bottom ? -1 : 1) * w / rad / 2;
            g.save(); g.translate(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad); g.rotate(a + (bottom ? -Math.PI / 2 : Math.PI / 2));
            g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(chars[i], 0, 0); g.restore();
            ang += (bottom ? -1 : 1) * w / rad;
          }
        };
        if (top) arcText(top, 168, 30, false);
        if (bot) arcText(bot, 172, 24, true);
        if (!back) {
          g.fillStyle = '#FFF';
          for (const sgn of [-1, 1]) for (let k = 0; k < 7; k++) {
            const an = Math.PI / 2 + sgn * (0.55 + k * 0.13), rr = 132;
            g.save(); g.translate(cx + Math.cos(an) * rr, cy + Math.sin(an) * rr); g.rotate(an + sgn * 0.9);
            g.beginPath(); g.ellipse(0, 0, 13, 5.5, 0, 0, Math.PI * 2); g.fill(); g.restore();
          }
        }
        g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#FFF';
        const lines = main.split('|');
        let fs = lines.length > 1 ? 58 : 70; g.font = '800 ' + fs + 'px Geist, Arial, sans-serif';
        const maxw = Math.max.apply(null, lines.map((l) => g.measureText(l).width));
        if (maxw > 300) { fs = Math.floor(fs * 300 / maxw); g.font = '800 ' + fs + 'px Geist, Arial, sans-serif'; }
        lines.forEach((l, i) => g.fillText(l, cx, cy + (i - (lines.length - 1) / 2) * fs * 1.05 - (back ? 0 : 6)));
        g.restore();
      };
      side(0, m.top || '', m.main || '', m.bot || '', false);
      side(512, m.b1 || 'SHREYANSH NIKAM', m.b2 || '2026', m.b3 || '', true);
      const o = document.createElement('canvas'); o.width = 1024; o.height = 512; const og = o.getContext('2d');
      og.filter = 'blur(1.6px)'; og.drawImage(c, 0, 0);
      const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, o);
      return tex;
    };
    const items = cvs.map((cv, i) => {
      let m = {}; try { m = JSON.parse(cv.getAttribute('data-m')); } catch (e) {}
      cv.style.display = 'block'; if (cv.parentNode) cv.parentNode.classList.add('gl-on');
      return { cv, ctx: cv.getContext('2d'), m, tex: null, ph: (m.ph || 0) + i * 1.3 };
    });
    const build = () => { items.forEach((it) => { it.tex = drawTex(it.m); }); };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(build); else build();
    build();
    this.medals = { gl, gc, U, items, MATS };
  }
  medalFrame(t) {
    const M = this.medals; if (!M) return;
    const gl = M.gl, vh = window.innerHeight || 800, dprBase = Math.min(window.devicePixelRatio || 1, 2) * (this.q || 1);
    for (const it of M.items) {
      const r = it.cv.getBoundingClientRect();
      if (r.bottom < -50 || r.top > vh + 50 || r.width < 2) continue;
      const css = it.cv.offsetWidth || r.width;
      const px = Math.max(64, Math.min(720, Math.round(css * dprBase)));
      if (it.cv.width !== px) { it.cv.width = px; it.cv.height = px; }
      if (M.gc.width < px || M.gc.height < px) { M.gc.width = Math.max(M.gc.width, px); M.gc.height = Math.max(M.gc.height, px); }
      gl.viewport(0, 0, px, px);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      const sp = (it.m.speed || 0.5);
      gl.uniform2f(M.U.uRes, px, px);
      gl.uniform1f(M.U.uAng, t * sp + it.ph);
      gl.uniform1f(M.U.uTilt, -0.18 + Math.sin(t * 0.6 + it.ph) * 0.05);
      gl.uniform1f(M.U.uMat, M.MATS[it.m.mat] || 0);
      const tint = it.m.tint || [0.25, 0.12, 0.08];
      gl.uniform3f(M.U.uTint, tint[0], tint[1], tint[2]);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, it.tex); gl.uniform1i(M.U.uTex, 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      it.ctx.clearRect(0, 0, px, px);
      it.ctx.drawImage(M.gc, 0, M.gc.height - px, px, px, 0, 0, px, px);
    }
  }
