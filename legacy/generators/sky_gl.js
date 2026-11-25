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
      '  vec3 rd = normalize(vec3((w.x - W*0.5)/H*0.95, max(ey, 0.0)*0.95 + 0.004, 1.0));',
      '  vec3 sd = normalize(vec3((uSun.x - W*0.5)/H*0.95, (uHy - uSun.y)/H*0.95, 1.0));',
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
      '  col = aces(col * 0.95); col = pow(col, vec3(1.0/2.2));',
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
