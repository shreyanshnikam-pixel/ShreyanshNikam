/* Sky Sentry: the approach, real-time. three.js r147 (global THREE), FK (kit.js), SITE (core.js).
   One scroll-scrubbed film inside #film (eight shots), then a quiet sky-above-the-clouds backdrop behind the sections after it.
   Reuses the previous build's 747 livery, runway markings, airfield lights, control tower and monitors (legacy/web/sky-film.js);
   the cockpit, clouds, flock, drone, sensor view and every camera move are new.
   Test hook: window.film.setProgress(p) jumps the film to p (0..1). */
(function () {
  const T = THREE, S0 = window.SITE, FK = window.FK, V = (x, y, z) => new T.Vector3(x, y, z);
  const ss = FK.ss, lerp = FK.lerp, clamp = FK.clamp;
  const film = document.getElementById('film'), stage = document.getElementById('stage'), cv = document.getElementById('sky'), ovl = document.getElementById('ovl'), framesCv = document.getElementById('frames');
  if (!S0.glOk || S0.rm || !film) { S0.boot(Promise.resolve()); return; }
  const mobile = innerWidth < 760 || Math.min(innerWidth, innerHeight) < 560;
  const DEG = Math.PI / 180, TAN3 = Math.tan(3 * DEG), AIM = 400, gsY = (x) => (AIM - x) * TAN3;
  const CB = 420, CTOP = 1500;                 // cloud base and tops (m)
  const TWR = V(1250, 0, 330), CAB = 46.3;     // tower base, cab floor height
  const SENT = V(-320, 1.45, -95);             // Sky Sentry's phone on its tripod, beside the approach lights
  const DRONE0 = V(-520, 22, -170);            // the drone, near the perimeter fence
  const SUN = V(0.83, 0.012, -0.56).normalize();
  const SIGNAL = '#2F6FE4';
  const loads = [];
  const rnd = FK.rng(17);

  // ================= renderer, camera, post =================
  const R = new T.WebGLRenderer({ canvas: cv, antialias: false, powerPreference: 'high-performance', logarithmicDepthBuffer: true });
  R.outputEncoding = T.LinearEncoding; R.toneMapping = T.NoToneMapping;
  R.shadowMap.enabled = true; R.shadowMap.type = T.PCFSoftShadowMap; R.shadowMap.autoUpdate = false;
  const S = new T.Scene(), C = new T.PerspectiveCamera(50, 1, 0.05, 120000);
  const comp = new T.EffectComposer(R, new T.WebGLRenderTarget(4, 4, { type: T.HalfFloatType }));
  comp.addPass(new T.RenderPass(S, C));
  const bloom = new T.UnrealBloomPass(new T.Vector2(256, 256), 0.55, 0.45, 0.82); comp.addPass(bloom);
  const grade = new T.ShaderPass({
    uniforms: { tDiffuse: { value: null }, uT: { value: 0 }, uExp: { value: 1 }, uWhite: { value: 0 }, uDip: { value: 0 }, uSensor: { value: 0 }, uCA: { value: 0.0012 }, uVig: { value: 0.6 },
      uGrain: { value: 0.035 }, uSat: { value: 1 }, uLift: { value: 0 }, uTint: { value: new T.Vector3(1, 1, 1) }, uRes: { value: new T.Vector2(1, 1) } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: [
      'uniform sampler2D tDiffuse; uniform float uT, uExp, uWhite, uDip, uSensor, uCA, uVig, uGrain, uSat, uLift; uniform vec3 uTint; uniform vec2 uRes; varying vec2 vUv;',
      'float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }',
      'vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14), 0.0, 1.0); }',
      'void main(){',
      '  vec2 uv = vUv; uv.x += sin(uv.y*220.0 + uT*40.0) * 0.0005 * uSensor;',
      '  vec2 c = uv - 0.5; float r2 = dot(c, c); vec2 o = c * (uCA + uSensor*0.004) * (1.0 + r2*4.0);',
      '  vec3 col = vec3(texture2D(tDiffuse, uv + o).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - o).b);',
      '  col *= uExp * uTint;',
      '  float l = dot(col, vec3(0.2126, 0.7152, 0.0722)); col = mix(vec3(l), col, uSat);',
      '  col = pow(aces(col), vec3(1.0/2.2));',
      '  col = col * (1.0 - uLift) + uLift;',
      '  col *= mix(1.0, smoothstep(1.25, 0.15, r2*1.7), uVig);',
      '  if (uSensor > 0.0) {',
      '    float ln = dot(col, vec3(0.3, 0.59, 0.11)); vec3 sc = mix(vec3(ln), col, 0.5) * vec3(0.93, 1.0, 1.05);',
      '    vec2 px = floor(uv * uRes / 1.5); sc += (h(px + fract(uT*17.0)*91.0) - 0.5) * 0.17;',
      '    sc += (h(vec2(floor(uv.y*uRes.y/2.0), floor(uT*30.0))) - 0.5) * 0.035;',
      '    sc *= 0.94 + 0.06*sin(uv.y*uRes.y*1.7); sc = floor(sc*48.0)/48.0;',
      '    col = mix(col, sc, uSensor); }',
      '  col += (h(uv*uRes + fract(uT*13.1)*91.7) - 0.5) * uGrain;',
      '  col = mix(col, vec3(1.0), uWhite); col *= 1.0 - uDip;',
      '  gl_FragColor = vec4(col, 1.0);',
      '}'].join('\n'),
  });
  comp.addPass(grade);
  const G = grade.uniforms;
  let DPR = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2), q = 1, W = 1, H = 1;
  const applySize = () => { const pr = Math.max(0.5, DPR * q); R.setPixelRatio(pr); R.setSize(W, H, false); comp.setPixelRatio(pr); comp.setSize(W, H); bloom.resolution.set(W / 2, H / 2); G.uRes.value.set(W * pr, H * pr); sizeOvl(); };
  const sizeOvl = () => { const pr = Math.min(window.devicePixelRatio || 1, 2); ovl.width = Math.round(W * pr); ovl.height = Math.round(H * pr); ovl.style.width = W + 'px'; ovl.style.height = H + 'px'; };
  const resize = () => { W = innerWidth; H = innerHeight; C.aspect = W / H; C.updateProjectionMatrix(); applySize(); };
  window.addEventListener('resize', resize); resize();
  // frame-time governor: lower the resolution when frames are slow
  let ema = 16, gl0 = 0, fcount = 0;
  const govern = (now) => { if (gl0) ema = ema * 0.93 + Math.min(80, now - gl0) * 0.07; gl0 = now; if (++fcount % 45) return; let nq = q; if (ema > 26 && q > 0.55) nq = q - 0.1; else if (ema < 15 && q < 1) nq = q + 0.05; if (nq !== q) { q = nq; applySize(); } };

  // ================= small helpers =================
  const cnv = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; if (draw) draw(c.getContext('2d'), w, h); return c; };
  const ctex = (c, srgb, rep) => { const t = new T.CanvasTexture(c); if (srgb !== false) t.encoding = T.sRGBEncoding; t.anisotropy = 8; if (rep) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rep[0], rep[1]); } return t; };
  const TL = new T.TextureLoader();
  const ltex = (f, srgb) => new Promise((res) => { TL.load(f, (t) => { t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 8; if (srgb) t.encoding = T.sRGBEncoding; res(t); }, undefined, () => res(null)); });
  const LOGV = '#include <common>\n#include <logdepthbuf_pars_vertex>\n', LOGF = '#include <logdepthbuf_pars_fragment>\n';
  const glowTex = ctex(cnv(128, 128, (x) => { const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.12, 'rgba(255,255,255,.85)'); g.addColorStop(0.35, 'rgba(255,255,255,.18)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); }), false);
  const glow = (col, s) => { const sp = new T.Sprite(new T.SpriteMaterial({ map: glowTex, color: new T.Color(col), blending: T.AdditiveBlending, depthWrite: false, transparent: true, fog: false })); sp.scale.setScalar(s); sp.userData.base = s; sp.renderOrder = 60; return sp; };
  const NOISE = [
    'float hh3(vec3 p){ p = fract(p*0.3183099 + 0.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }',
    'float nn3(vec3 x){ vec3 i = floor(x), f = fract(x); f = f*f*(3.0-2.0*f); return mix(mix(mix(hh3(i), hh3(i+vec3(1,0,0)), f.x), mix(hh3(i+vec3(0,1,0)), hh3(i+vec3(1,1,0)), f.x), f.y), mix(mix(hh3(i+vec3(0,0,1)), hh3(i+vec3(1,0,1)), f.x), mix(hh3(i+vec3(0,1,1)), hh3(i+vec3(1,1,1)), f.x), f.y), f.z); }',
    'float hh2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
    'float nn2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(hh2(i), hh2(i+vec2(1,0)), f.x), mix(hh2(i+vec2(0,1)), hh2(i+vec2(1,1)), f.x), f.y); }',
    'float ff2(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ s += a*nn2(p); p *= 2.03; a *= 0.5; } return s; }'].join('\n');

  // ================= sky, stars, environment =================
  const sky = new T.Sky(); sky.scale.setScalar(40000); sky.frustumCulled = false; S.add(sky);
  const su = sky.material.uniforms; su.turbidity.value = 4.5; su.rayleigh.value = 2.4; su.mieCoefficient.value = 0.005; su.mieDirectionalG.value = 0.86;
  const setSun = (elDeg) => { const az = Math.atan2(SUN.z, SUN.x), el = elDeg * DEG; su.sunPosition.value.set(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)); };
  setSun(1.5);
  const pm = new T.PMREMGenerator(R);
  const envAbove = pm.fromScene(sky).texture;
  const envBelow = (() => { const c = cnv(512, 256, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#5c6878'); g.addColorStop(0.42, '#8e9aaa'); g.addColorStop(0.5, '#c9b7ad'); g.addColorStop(0.52, '#c7ced6'); g.addColorStop(1, '#a9b3bd'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    const az = Math.atan2(SUN.z, SUN.x), u = ((-az / (2 * Math.PI) + 0.5) % 1 + 1) % 1 * w; const rg = x.createRadialGradient(u, h * 0.5, 0, u, h * 0.5, w * 0.18); rg.addColorStop(0, 'rgba(255,190,140,.9)'); rg.addColorStop(1, 'rgba(255,190,140,0)'); x.fillStyle = rg; x.fillRect(0, 0, w, h); });
    const t = new T.CanvasTexture(c); t.mapping = T.EquirectangularReflectionMapping; t.encoding = T.sRGBEncoding; const env = pm.fromEquirectangular(t).texture; t.dispose(); return env; })();
  pm.dispose();
  S.environment = envBelow;
  const starsU = { uA: { value: 1 }, uScale: { value: 1 } };
  const stars = (() => { const N = mobile ? 1500 : 4000, p = new Float32Array(N * 3), a = new Float32Array(N);
    for (let i = 0; i < N; i++) { const u = rnd(), v = rnd() * 0.97 + 0.03, th = u * Math.PI * 2, y = v, r = Math.sqrt(1 - y * y); p.set([Math.cos(th) * r * 30000, y * 30000, Math.sin(th) * r * 30000], i * 3); a[i] = Math.pow(rnd(), 3); }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(p, 3)); g.setAttribute('aB', new T.BufferAttribute(a, 1));
    const m = new T.ShaderMaterial({ uniforms: starsU, transparent: true, depthWrite: false, blending: T.AdditiveBlending,
      vertexShader: LOGV + 'attribute float aB; uniform float uA, uScale; varying float vA; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vA = uA * (0.25 + aB*0.9) * smoothstep(0.0, 0.25, normalize(position).y); gl_PointSize = (1.0 + aB*1.6) * uScale; gl_Position = projectionMatrix * mv;\n#include <logdepthbuf_vertex>\n}',
      fragmentShader: LOGF + 'varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; gl_FragColor = vec4(vec3(0.85, 0.9, 1.0) * vA * smoothstep(0.5, 0.0, d), 1.0);\n#include <logdepthbuf_fragment>\n}' });
    const s = new T.Points(g, m); s.frustumCulled = false; s.renderOrder = -5; S.add(s); return s; })();

  // ================= lights =================
  const hemi = new T.HemisphereLight(0x8a9ab0, 0xc9d3de, 0.8); S.add(hemi);
  const sunL = new T.DirectionalLight(0xffb07a, 1.0);
  sunL.position.copy(SUN).multiplyScalar(1000);
  sunL.castShadow = true;
  sunL.shadow.mapSize.set(mobile ? 512 : 1024, mobile ? 512 : 1024);
  sunL.shadow.camera.near = 20; sunL.shadow.camera.far = 2600;
  sunL.shadow.camera.left = -260; sunL.shadow.camera.right = 260; sunL.shadow.camera.top = 260; sunL.shadow.camera.bottom = -260;
  sunL.shadow.bias = -0.0004; sunL.shadow.normalBias = 0.06;
  S.add(sunL); S.add(sunL.target);
  S.fog = new T.FogExp2(0x9aa7b6, 0.00016);

  // ================= clouds: stacked volumetric fbm slices with Henyey-Greenstein & Beer-Lambert scattering =================
  const NSL = mobile ? 12 : 18;
  const cloudU = { uT: { value: 0 }, uFogD: { value: 0.0001 }, uFogC: { value: new T.Color() }, uLit: { value: new T.Color() }, uShade: { value: new T.Color() }, uSunC: { value: new T.Color() }, uSun: { value: SUN.clone() }, uDen: { value: mobile ? 0.36 : 0.28 }, uClear: { value: 1 } };
  const cloudVS = LOGV + 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w;\n#include <logdepthbuf_vertex>\n}';
  const cloudFS = LOGF + NOISE + [
    '\nuniform float uT, uH, uFogD, uDen, uClear; uniform vec3 uLit, uShade, uSunC, uSun, uFogC; varying vec3 vW;',
    'float hg(float c, float g){ float g2 = g*g; return (1.0 - g2) / (4.0 * 3.14159265 * pow(max(1.0 + g2 - 2.0*g*c, 0.01), 1.5)); }',
    'void main(){',
    '  vec3 d = vW - cameraPosition; float dist = length(d); vec3 vd = d / max(dist, 1e-3);',
    '  vec2 q = vW.xz * 0.00042 + vec2(uT*0.0035, uT*0.0012);',
    '  float n = 0.0, a = 0.5; vec3 p = vec3(q, uH*1.25);',
    '  for (int i = 0; i < 3; i++){ n += a*nn3(p); p = p*2.07 + vec3(1.7, 9.2, 3.1); a *= 0.5; }',
    '  n = n * 0.82 + nn3(vec3(vW.xz*0.0024, uH*3.0 + uT*0.02)) * 0.18;',
    '  float cov = mix(0.26, 0.6, pow(uH, 1.2)) + smoothstep(9000.0, 17000.0, vW.x) * 0.45 * uClear;',
    '  float den = smoothstep(cov, cov + 0.17, n);',
    '  if (den < 0.003) discard;',
    '  float al = den * uDen * smoothstep(0.0, 45.0, abs(vW.y - cameraPosition.y)) * (1.0 - smoothstep(32000.0, 62000.0, dist));',
    '  float tau = (1.0 - uH) * 1.65 + max(0.0, n - cov) * 2.2;',
    '  float beer = exp(-tau * 0.85); float powder = 1.0 - exp(-tau * 2.1);',
    '  float mu = dot(vd, uSun); float phase = mix(hg(mu, 0.72), hg(mu, -0.25), 0.25);',
    '  float lit = clamp(pow(uH, 0.78) * (0.5 + 1.8*(n - cov)) * (0.65 + 0.55*beer*powder), 0.0, 1.0);',
    '  vec3 col = mix(uShade, uLit, lit);',
    '  col += uSunC * (clamp(phase * 1.35, 0.0, 2.2) * (0.25 + 0.75*uH) * (0.45 + 0.55*beer));',
    '  float rayleigh = 1.0 - exp(-dist * uFogD);',
    '  vec3 mieHorizon = uFogC + uSunC * pow(max(mu, 0.0), 6.0) * 0.28;',
    '  col = mix(col, mieHorizon, rayleigh);',
    '  gl_FragColor = vec4(col, al);',
    '#include <logdepthbuf_fragment>',
    '}'].join('\n');
  const slices = [];
  const slGeo = new T.PlaneGeometry(150000, 150000).rotateX(-Math.PI / 2);
  for (let i = 0; i < NSL; i++) {
    const h = i / (NSL - 1), y = CB + (CTOP - CB) * Math.pow(h, 1.15);
    const m = new T.ShaderMaterial({ uniforms: Object.assign({ uH: { value: h } }, cloudU), vertexShader: cloudVS, fragmentShader: cloudFS, transparent: true, depthWrite: false, side: T.DoubleSide });
    const mesh = new T.Mesh(slGeo, m); mesh.position.set(-10000, y, 0); mesh.frustumCulled = false; mesh.userData.y = y; S.add(mesh); slices.push(mesh);
  }

  // ================= ground: snow field with forests and hedgerows =================
  const grp = { airport: new T.Group(), plane: new T.Group(), flock: new T.Group(), tower: new T.Group(), cockpit: null };
  S.add(grp.airport);
  const gMat = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, normalScale: new T.Vector2(0.5, 0.5) });
  gMat.onBeforeCompile = (sh) => {
    sh.vertexShader = 'varying vec3 vWP;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = 'varying vec3 vWP;\n' + NOISE + '\n' + sh.fragmentShader.replace('#include <map_fragment>', [
      '#ifdef USE_MAP',
      ' vec2 q = vWP.xz;',
      ' vec3 tc = mix(texture2D(map, q/55.0).rgb, texture2D(map, q/377.0 + 0.31).rgb, 0.45);',
      ' float apt = 1.0 - smoothstep(0.0, 300.0, max(max(-1300.0 - q.x, q.x - 3700.0), max(-650.0 - q.y, q.y - 1000.0)));',
      ' float forest = smoothstep(0.55, 0.63, ff2(q*0.0009 + 11.0)) * (1.0 - apt);',
      ' vec3 fc = vec3(0.07, 0.08, 0.08) * (0.5 + 1.0*nn2(q*0.31)) + vec3(0.5, 0.55, 0.6) * step(0.66, nn2(q*0.85)) * 0.6;',
      ' tc = mix(tc, fc, forest * 0.9);',
      ' vec2 fq = q / vec2(430.0, 300.0); vec2 fe = abs(fract(fq) - 0.5);',
      ' float hedge = (1.0 - smoothstep(0.0, 0.014, min(fe.x, fe.y))) * (1.0 - apt) * step(0.42, nn2(floor(fq)*1.7)) * (1.0 - forest);',
      ' tc = mix(tc, vec3(0.2, 0.21, 0.21), hedge * 0.55);',
      ' tc *= 0.9 + 0.2*ff2(q*0.0004);',
      ' diffuseColor.rgb *= tc * 1.18;',
      '#endif'].join('\n'));
  };
  gMat.customProgramCacheKey = () => 'sky-ground';
  const ground = new T.Mesh(new T.PlaneGeometry(160000, 160000).rotateX(-Math.PI / 2), gMat); ground.position.set(0, 0, 0); ground.receiveShadow = true; grp.airport.add(ground);

  // ================= runway 27/09: one surface, markings + per-pixel aircraft contact shadow in shader =================
  function thresholdCanvas(num) { // 45 m wide x 450 m, the aircraft rolls toward the top of the canvas
    return cnv(256, 2560, (x, w, h) => {
      const px = w / 45, m = h / 450, Y = (v) => h - v * m; x.clearRect(0, 0, w, h);
      x.fillStyle = '#fff';
      x.fillRect(0.6 * px, 0, 0.9 * px, h); x.fillRect(w - 1.5 * px, 0, 0.9 * px, h);
      for (let i = 0; i < 16; i++) { const cz = i < 8 ? 3 + i * 2.4 : 45 - 3 - 1.8 - (15 - i) * 2.4; x.fillRect(cz * px, Y(36), 1.8 * px, 30 * m); }
      x.save(); x.translate(w / 2, Y(42)); x.scale(1, (18 * m) / (14 * px)); x.font = `700 ${Math.round(14 * px)}px "Arial Narrow", Arial, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'bottom'; x.fillText(num, 0, 0); x.restore();
      for (let v = 72; v < 450; v += 60) x.fillRect(w / 2 - 0.45 * px, Y(v + 36), 0.9 * px, 36 * m);
      for (const v of [150, 300]) for (const sg of [-1, 1]) for (let k = 0; k < (v === 150 ? 3 : 2); k++) x.fillRect(w / 2 + sg * (5 + k * 1.6) * px - (sg < 0 ? 0.9 : 0) * px, Y(v + 22.5), 0.9 * px, 22.5 * m);
      for (const sg of [-1, 1]) x.fillRect(w / 2 + sg * 6 * px - (sg < 0 ? 4 : 0) * px, Y(400 + 45), 4 * px, 45 * m);
    });
  }
  const tileCanvas = () => cnv(256, 341, (x, w, h) => { const px = w / 45; x.clearRect(0, 0, w, h); x.fillStyle = '#fff'; x.fillRect(0.6 * px, 0, 0.9 * px, h); x.fillRect(w - 1.5 * px, 0, 0.9 * px, h); x.fillRect(w / 2 - 0.45 * px, 0, 0.9 * px, 36 * (h / 60)); });
  const rwU = { tThr: { value: ctex(thresholdCanvas('27'), false) }, tThr2: { value: ctex(thresholdCanvas('9'), false) }, tTile: { value: ctex(tileCanvas(), false, [1, 1]) }, uPlanePos: { value: V(-9000, 500, 0) } };
  const rwMat = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 });
  rwMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, rwU);
    sh.vertexShader = 'varying vec3 vWP;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = 'varying vec3 vWP; uniform sampler2D tThr, tThr2, tTile; uniform vec3 uPlanePos;\n' + NOISE + '\n' + sh.fragmentShader.replace('#include <map_fragment>', [
      '#ifdef USE_MAP',
      ' vec2 q = vWP.xz; vec3 asp = mix(texture2D(map, q/14.0).rgb, texture2D(map, q/61.0+0.4).rgb, 0.4) * 0.92;',
      ' float u = q.x, v = q.y; float paint = 0.0;',
      ' if (abs(v) < 22.5) {',
      '  if (u < 450.0) paint = texture2D(tThr, vec2(v/45.0 + 0.5, u/450.0)).a;',
      '  else if (u > 2550.0) paint = texture2D(tThr2, vec2(-v/45.0 + 0.5, (3000.0 - u)/450.0)).a;',
      '  else paint = texture2D(tTile, vec2(v/45.0 + 0.5, fract((u - 450.0)/60.0))).a;',
      ' }',
      ' float snowE = smoothstep(19.0, 25.0, abs(v) + nn2(q*0.35)*3.0) + smoothstep(0.62, 0.78, ff2(q*0.05)) * 0.35;',
      ' vec3 col = mix(asp, vec3(0.93, 0.95, 0.97), paint * 0.92);',
      ' col = mix(col, vec3(0.9, 0.93, 0.96), clamp(snowE, 0.0, 1.0));',
      ' float py = max(1.0, uPlanePos.y); float spread = 1.0 + py * 0.045;',
      ' vec2 dp = q - uPlanePos.xz;',
      ' float fus = exp(-((dp.x*dp.x)/(760.0*spread*spread) + (dp.y*dp.y)/(36.0*spread*spread)));',
      ' float wing = exp(-(((dp.x + 2.0)*(dp.x + 2.0))/(95.0*spread*spread) + (dp.y*dp.y)/(780.0*spread*spread)));',
      ' float csh = clamp(max(fus, wing), 0.0, 1.0) * (1.0 - smoothstep(15.0, 220.0, py)) * 0.48;',
      ' col *= (1.0 - csh);',
      ' diffuseColor.rgb *= col;',
      '#endif'].join('\n'));
  };
  rwMat.customProgramCacheKey = () => 'sky-runway';
  const runway = new T.Mesh(new T.PlaneGeometry(3080, 62).rotateX(-Math.PI / 2), rwMat); runway.position.set(1500, 0.3, 0); runway.receiveShadow = true; grp.airport.add(runway);
  const taxM = new T.MeshStandardMaterial({ color: 0x9a9ea3, roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 });
  const addPave = (w, d, x, z) => { const m = new T.Mesh(new T.PlaneGeometry(w, d).rotateX(-Math.PI / 2), taxM); m.position.set(x, 0.25, z); grp.airport.add(m); return m; };
  addPave(3300, 23, 1550, 190); for (const xx of [20, 900, 1800, 2950]) addPave(23, 170, xx, 105); addPave(1500, 260, 1700, 340);

  // ================= airfield lights (one points system, shader-animated) =================
  function LightPoints(list, gain, minPx) {
    const n = list.length, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), prm = new Float32Array(n * 4);
    list.forEach((l, i) => { pos.set([l[0], l[1], l[2]], i * 3); col.set([l[3], l[4], l[5]], i * 3); prm.set([l[6], l[7] || 0, l[8] || 0, l[9] || 0], i * 4); });
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('color', new T.BufferAttribute(col, 3)); g.setAttribute('aP', new T.BufferAttribute(prm, 4));
    const u = { uT: lpT, uScale: lpScale, uFogD: lpFog, uGain: { value: gain || 1 }, uMin: { value: minPx || 1.6 } };
    const m = new T.ShaderMaterial({ uniforms: u, transparent: true, depthWrite: false, blending: T.AdditiveBlending,
      vertexShader: LOGV + [
        'attribute vec3 color; attribute vec4 aP; uniform float uT, uScale, uFogD, uGain, uMin; varying vec3 vC; varying float vI;',
        'void main(){',
        '  vec4 mv = modelViewMatrix * vec4(position, 1.0); float dist = -mv.z; float I = 1.0; vec3 c = color;',
        '  if (aP.y > 0.5 && aP.y < 1.5) { float d = fract(uT*2.0) - aP.z; I = exp(-d*d*9000.0) * 2.4 + 0.0; }',
        '  else if (aP.y > 1.5 && aP.y < 2.5) { vec3 wp = (modelMatrix * vec4(position, 1.0)).xyz; vec3 dv = cameraPosition - wp; float el = degrees(atan(dv.y, length(dv.xz))); c = mix(vec3(3.4, 0.16, 0.08), vec3(3.4, 3.2, 2.9), smoothstep(aP.z - 0.04, aP.z + 0.04, el)); }',
        '  else if (aP.y > 2.5) { I = fract(uT*aP.w + aP.z) < 0.5 ? 1.0 : 0.05; }',
        '  vC = c; vI = I * exp(-dist * uFogD * 0.5) * uGain;',
        '  gl_PointSize = clamp(aP.x * uScale / dist, uMin, 70.0);',
        '  gl_Position = projectionMatrix * mv;',
        '#include <logdepthbuf_vertex>',
        '}'].join('\n'),
      fragmentShader: LOGF + 'varying vec3 vC; varying float vI; void main(){ vec2 c = gl_PointCoord - 0.5; float r = length(c) * 2.0; float a = exp(-r*r*5.0)*0.55 + exp(-r*r*40.0); if (a * vI < 0.004) discard; gl_FragColor = vec4(vC * vI * a, 1.0);\n#include <logdepthbuf_fragment>\n}' });
    const pts = new T.Points(g, m); pts.frustumCulled = false; return pts;
  }
  const lpT = { value: 0 }, lpScale = { value: 500 }, lpFog = { value: 0.0002 };
  const WH = [3.2, 2.95, 2.5], L = [];
  const push = (x, y, z, c, s, mode, k, ph) => L.push([x, y, z, c[0], c[1], c[2], s, mode || 0, k || 0, ph || 0]);
  // approach lighting: 900 m of barrettes, a crossbar at 300 m, red side rows, and the sequenced flashers ("the rabbit")
  for (let x = -30; x >= -900; x -= 30) { const y = 1.0 + (-x) * 0.0035; for (let k = -2; k <= 2; k++) push(x, y, k * 1.05, WH, 0.9); if (x >= -270) for (const sg of [-1, 1]) for (let k = 0; k < 3; k++) push(x, y, sg * (6.5 + k * 1.5), [3.2, 0.2, 0.12], 0.8); }
  for (let z = -15; z <= 15; z += 1.5) if (Math.abs(z) > 3) push(-300, 2.1, z, WH, 0.9);
  const NF = 21; for (let i = 0; i < NF; i++) { const x = -900 + i * 30; push(x, 2.0 + (-x) * 0.0035, 0, [6, 6, 6.6], 2.2, 1, 0.82 * i / (NF - 1)); }
  for (let z = -22; z <= 22.01; z += 1.5) push(-1.5, 0.5, z, [0.4, 3.2, 1.2], 0.8);
  for (const sg of [-1, 1]) for (let k = 0; k < 5; k++) push(-1.5, 0.5, sg * (25 + k * 1.5), [0.4, 3.2, 1.2], 0.8);
  for (let z = -22; z <= 22.01; z += 3) push(3001.5, 0.5, z, [3.2, 0.25, 0.15], 0.8);
  for (let x = 0; x <= 3000; x += 60) for (const z of [-23.5, 23.5]) push(x, 0.6, z, x > 2400 ? [3.2, 2.4, 0.8] : WH, 0.75);
  for (let x = 15; x < 3000; x += 15) push(x, 0.35, 0, x > 2700 ? [3, 0.3, 0.2] : x > 2100 && (x / 15) % 2 ? [3, 0.3, 0.2] : [2.6, 2.6, 2.6], 0.45);
  for (let x = 60; x <= 900; x += 30) for (const sg of [-1, 1]) for (let k = 0; k < 3; k++) push(x, 0.35, sg * (9.5 + k * 1.5), [2.6, 2.6, 2.6], 0.4);
  [3.5, 3.1667, 2.8333, 2.5].forEach((th, i) => push(380, 1.0, -33 - i * 9, WH, 1.4, 2, th));
  for (let x = -100; x <= 3200; x += 50) for (const z of [178.5, 201.5]) push(x, 0.5, z, [0.35, 0.55, 3.2], 0.6);
  for (let i = 0; i < 40; i++) push(1000 + i * 37, 12, 230 + (i % 2) * 220, [3.2, 2.3, 1.2], 2.6);
  push(TWR.x, CAB + 16, TWR.z, [3.2, 0.2, 0.1], 1.5, 3, 0, 0.8);
  for (let k = 0; k < 3; k++) push(2450 + k * 110, 26, 430, [3.2, 0.2, 0.1], 1.2, 3, k * 0.3, 0.8);
  const fieldLights = LightPoints(L, 1, mobile ? 1.6 : 1.4); fieldLights.renderOrder = 5; grp.airport.add(fieldLights);

  // city lights spread to the horizon: street grids of sodium and LED lamps
  const city = (() => {
    const CL = [], max = mobile ? 14000 : 42000, cr = FK.rng(31);
    const town = (cx, cz, rad, sp, dens) => {
      const a = cr() * Math.PI, ca = Math.cos(a), sa = Math.sin(a);
      for (let i = -rad; i <= rad && CL.length < max; i += sp) for (let j = -rad; j <= rad && CL.length < max; j += 34) {
        for (const sw of [0, 1]) {
          const lx = sw ? i : j, lz = sw ? j : i; const r2 = (lx * lx + lz * lz) / (rad * rad); if (r2 > 1 || cr() > dens * (1 - r2 * 0.7)) continue;
          const x = cx + lx * ca - lz * sa, z = cz + lx * sa + lz * ca;
          if (x > -1500 && x < 3900 && z > -700 && z < 1100) continue;
          const sod = cr() < 0.62; push2(CL, x + (cr() - 0.5) * 6, 6, z + (cr() - 0.5) * 6, sod ? [2.6, 1.35, 0.45] : [2.2, 2.35, 2.6], 1.6 + cr() * 1.4);
        }
      }
    };
    const push2 = (A, x, y, z, c, s) => A.push([x, y, z, c[0], c[1], c[2], s, 0, 0, 0]);
    town(9500, 4200, 3800, 95, 0.55); town(4200, 3600, 1600, 110, 0.5); town(-6000, 5200, 2200, 120, 0.45); town(14000, -5200, 4200, 120, 0.5);
    const nt = mobile ? 22 : 44; for (let k = 0; k < nt; k++) { const ang = cr() * Math.PI * 2, r = 4500 + Math.pow(cr(), 0.7) * 26000; town(Math.cos(ang) * r + 3000, Math.sin(ang) * r, 500 + cr() * 1600, 110 + cr() * 60, 0.35 + cr() * 0.3); }
    for (let k = 0; k < 7; k++) { const a = cr() * Math.PI * 2, x0 = 3000 + Math.cos(a) * 3000, z0 = Math.sin(a) * 3000; for (let d = 0; d < 32000 && CL.length < max + 4000; d += 28) { const w = Math.sin(d * 0.0003 + k) * 600; push2(CL, x0 + Math.cos(a) * d - Math.sin(a) * w, 5, z0 + Math.sin(a) * d + Math.cos(a) * w, k % 2 ? [2.6, 1.3, 0.4] : [2.3, 2.3, 2.4], 2.2); } }
    const pts = LightPoints(CL, 0.8, mobile ? 1.2 : 1.0); pts.renderOrder = 4; grp.airport.add(pts); return pts;
  })();

  // ================= airport buildings (snow on the roofs) =================
  function windowsTex(cols, rows, lit) { return cnv(512, 256, (x, w, h) => { x.fillStyle = '#1b2028'; x.fillRect(0, 0, w, h); const cw = w / cols, rh = h / rows; for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) { const on = rnd() < lit; x.fillStyle = on ? `rgba(255,${205 + rnd() * 40},${150 + rnd() * 60},${0.6 + rnd() * 0.4})` : 'rgba(70,90,110,.35)'; x.fillRect(i * cw + 2, j * rh + 3, cw - 4, rh - 6); } }); }
  function concreteTex(w, h, rows) {
    const c = cnv(w, h, (x) => {
      const img = x.createImageData(w, h), d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        const n = (rnd() - 0.5) * 26;
        d[i] = Math.max(0, Math.min(255, 201 + n));
        d[i + 1] = Math.max(0, Math.min(255, 198 + n));
        d[i + 2] = Math.max(0, Math.min(255, 192 + n));
        d[i + 3] = 255;
      }
      x.putImageData(img, 0, 0);
      for (let i = 0; i < 40; i++) { const gx = rnd() * w, g = x.createLinearGradient(gx, 0, gx + 6, 0); g.addColorStop(0, 'rgba(60,52,44,0)'); g.addColorStop(0.5, `rgba(60,52,44,${0.04 + rnd() * 0.07})`); g.addColorStop(1, 'rgba(60,52,44,0)'); x.fillStyle = g; x.fillRect(gx, rnd() * h * 0.5, 6, h * (0.3 + rnd() * 0.7)); }
      x.fillStyle = 'rgba(70,62,54,.3)'; for (let r = 1; r < rows; r++) x.fillRect(0, r * h / rows, w, 2); });
    const t = ctex(c, true); t.wrapS = t.wrapT = T.RepeatWrapping; return t;
  }
  const snowRoof = new T.MeshStandardMaterial({ color: 0xeef3f7, roughness: 0.9 });
  const concM = new T.MeshStandardMaterial({ color: 0x8f8a84, roughness: 0.9 });
  { const wt = ctex(windowsTex(60, 3, 0.45)); const wm = new T.MeshStandardMaterial({ map: wt, emissive: 0xffffff, emissiveMap: wt, emissiveIntensity: 0.5, roughness: 0.5, color: 0x8a8f96 });
    const term = new T.Mesh(new T.BoxGeometry(520, 22, 70), [concM, concM, snowRoof, concM, wm, concM]); term.position.set(1750, 11, 520); grp.airport.add(term);
    for (let k = 0; k < 3; k++) { const hg = new T.Mesh(new T.CylinderGeometry(24, 24, 70, 32, 1, false, 0, Math.PI), new T.MeshStandardMaterial({ color: 0xdde4ea, roughness: 0.8 })); hg.rotation.set(Math.PI / 2, 0, Math.PI / 2); hg.scale.set(1, 1, 0.45); hg.position.set(2450 + k * 110, 0, 430); grp.airport.add(hg); }
    for (let k = 0; k < 14; k++) { const b = new T.Mesh(new T.BoxGeometry(40 + rnd() * 60, 8 + rnd() * 14, 30 + rnd() * 40), [concM, concM, snowRoof, concM, wm, concM]); b.position.set(2900 + rnd() * 900, b.geometry.parameters.height / 2, 620 + rnd() * 400); grp.airport.add(b); } }

  // perimeter fence (posts and chain-link) on the approach side
  { const fenceT = ctex(cnv(64, 64, (x) => { x.strokeStyle = 'rgba(150,160,170,.95)'; x.lineWidth = 2; x.beginPath(); x.moveTo(0, 0); x.lineTo(64, 64); x.moveTo(64, 0); x.lineTo(0, 64); x.stroke(); }), true, [520, 1]);
    const fm = new T.MeshStandardMaterial({ map: fenceT, transparent: true, alphaTest: 0.3, side: T.DoubleSide, roughness: 0.5, metalness: 0.6 });
    const fence = new T.Mesh(new T.PlaneGeometry(1560, 2.4), fm); fence.position.set(-170, 1.2, -182); grp.airport.add(fence);
    const post = new T.InstancedMesh(new T.CylinderGeometry(0.04, 0.04, 2.7, 6), new T.MeshStandardMaterial({ color: 0x6d747b, metalness: 0.6, roughness: 0.4 }), 520); const m4 = new T.Matrix4();
    for (let i = 0; i < 520; i++) { m4.makeTranslation(-950 + i * 3, 1.35, -182); post.setMatrixAt(i, m4); } grp.airport.add(post);
    const wire = new T.Mesh(new T.CylinderGeometry(0.01, 0.01, 1560, 4).rotateZ(Math.PI / 2), fm); wire.position.set(-170, 2.62, -182); grp.airport.add(wire); }

  // ================= the control tower (exterior and cab, from the previous build) =================
  const screens = {};
  function person(cloth, skin, hair) {
    const g = new T.Group(), M = (c, r) => new T.MeshStandardMaterial({ color: c, roughness: r || 0.85, envMapIntensity: 0.15 });
    const cm = M(cloth, 0.9), sk = M(skin, 0.6), dark = M(0x121214, 0.5);
    const add = (geo, m, p, r) => { const o = new T.Mesh(geo, m); o.position.set(p[0], p[1], p[2]); if (r) o.rotation.set(r[0], r[1], r[2]); g.add(o); return o; };
    add(new T.CapsuleGeometry(0.17, 0.36, 6, 14), cm, [0, 0.72, 0]).scale.set(1.25, 1, 0.75);
    add(new T.CapsuleGeometry(0.07, 0.07, 4, 10), sk, [0, 1.06, 0]);
    add(new T.SphereGeometry(0.105, 24, 18), sk, [0, 1.2, 0.01]).scale.set(0.92, 1.08, 1.0);
    add(new T.SphereGeometry(0.108, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.62), M(hair || 0x0d0a08, 0.95), [0, 1.215, 0.015]).scale.set(0.95, 1.05, 1.03);
    add(new T.TorusGeometry(0.115, 0.012, 6, 24, Math.PI), dark, [0, 1.23, 0], [0, Math.PI / 2, 0]);
    for (const s of [-1, 1]) {
      add(new T.CylinderGeometry(0.045, 0.045, 0.03, 16), dark, [s * 0.112, 1.2, 0], [0, 0, Math.PI / 2]);
      add(new T.CapsuleGeometry(0.055, 0.26, 4, 10), cm, [s * 0.25, 0.8, -0.06], [0.5, 0, s * 0.12]);
      add(new T.CapsuleGeometry(0.048, 0.24, 4, 10), cm, [s * 0.27, 0.62, -0.24], [1.45, 0, 0]);
      add(new T.CapsuleGeometry(0.075, 0.34, 4, 10), M(0x23262c), [s * 0.1, 0.48, -0.22], [Math.PI / 2, 0, 0]);
      add(new T.CapsuleGeometry(0.065, 0.36, 4, 10), M(0x23262c), [s * 0.1, 0.22, -0.42], [0.1, 0, 0]);
    }
    const ch = M(0x2b2d31, 0.7);
    add(new T.BoxGeometry(0.52, 0.08, 0.5), ch, [0, 0.42, -0.05]); add(new T.BoxGeometry(0.5, 0.62, 0.07), ch, [0, 0.78, 0.22], [-0.1, 0, 0]);
    add(new T.CylinderGeometry(0.03, 0.03, 0.38, 8), M(0x111111, 0.4), [0, 0.2, 0]);
    return g;
  }
  function buildTower() {
    const Gt = grp.tower; Gt.position.copy(TWR); S.add(Gt);
    const dir = V(-600, 0, 0).sub(TWR).normalize(); Gt.rotation.y = Math.atan2(-dir.x, -dir.z); Gt.updateMatrixWorld(true);
    const conc = new T.MeshStandardMaterial({ color: 0xe9e6e0, map: concreteTex(1024, 1024, 8), roughness: 0.9 }); conc.map.repeat.set(3, 6);
    const glassD = new T.MeshPhysicalMaterial({ color: 0x1c2733, roughness: 0.08, metalness: 0.2, clearcoat: 1, envMapIntensity: 1.4 });
    const add = (geo, m, p, r) => { const o = new T.Mesh(geo, m); o.position.set(p[0], p[1], p[2]); if (r) o.rotation.set(r[0], r[1], r[2]); Gt.add(o); return o; };
    add(new T.CylinderGeometry(3.6, 4.6, CAB - 6, 48), conc, [0, (CAB - 6) / 2, 0]);
    for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; const f = add(new T.BoxGeometry(0.7, CAB - 6, 0.9), conc, [Math.cos(a) * 4.05, (CAB - 6) / 2, Math.sin(a) * 4.05]); f.rotation.y = -a; }
    add(new T.BoxGeometry(1.2, CAB - 12, 0.3), glassD, [0, (CAB - 4) / 2, -4.55]);
    for (let y = 4; y < CAB - 8; y += 3.2) add(new T.BoxGeometry(1.4, 0.18, 0.4), conc, [0, y, -4.6]);
    const lt = ctex(cnv(64, 64, (x) => { x.fillStyle = '#5a5f66'; x.fillRect(0, 0, 64, 64); for (let i = 0; i < 8; i++) { x.fillStyle = '#2a2d31'; x.fillRect(0, i * 8 + 5, 64, 3); } }), true, [40, 3]);
    add(new T.CylinderGeometry(5.2, 3.8, 2.6, 48), conc, [0, CAB - 4.7, 0]);
    add(new T.CylinderGeometry(5.6, 5.6, 1.7, 48), new T.MeshStandardMaterial({ map: lt, roughness: 0.6, metalness: 0.5 }), [0, CAB - 2.55, 0]);
    add(new T.CylinderGeometry(7.6, 6.2, 1.1, 48), conc, [0, CAB - 1.15, 0]);
    add(new T.CylinderGeometry(8.4, 8.4, 0.16, 64), snowRoof, [0, CAB - 0.55, 0]);
    const rail = new T.MeshStandardMaterial({ color: 0xc9ccd1, metalness: 0.8, roughness: 0.35 });
    add(new T.TorusGeometry(8.35, 0.035, 6, 96), rail, [0, CAB + 0.55, 0], [Math.PI / 2, 0, 0]);
    for (let k = 0; k < 64; k++) { const a = k / 64 * Math.PI * 2; add(new T.CylinderGeometry(0.025, 0.025, 1.1, 5), rail, [Math.cos(a) * 8.35, CAB, Math.sin(a) * 8.35]); }
    const wt = ctex(cnv(512, 128, (wx) => { wx.fillStyle = '#9e978c'; wx.fillRect(0, 0, 512, 128); for (let r = 0; r < 2; r++) { wx.fillStyle = '#18202a'; wx.fillRect(0, 18 + r * 60, 512, 26); for (let i = 0; i < 32; i++) { wx.fillStyle = rnd() < 0.4 ? 'rgba(255,214,160,.85)' : 'rgba(80,110,140,.5)'; wx.fillRect(i * 16 + 2, 20 + r * 60, 12, 22); } } }), true, [3, 1]);
    const wm = new T.MeshStandardMaterial({ map: wt, roughness: 0.6 });
    add(new T.BoxGeometry(46, 9, 24), [wm, wm, snowRoof, snowRoof, wm, wm], [14, 4.5, 14]);
    // cab: floor, eight tilted panes, mullions, sills
    const floor = add(new T.CylinderGeometry(7.4, 7.4, 0.2, 8), new T.MeshStandardMaterial({ color: 0x15161a, roughness: 0.9, envMapIntensity: 0.1 }), [0, CAB, 0]); floor.rotation.y = Math.PI / 8;
    const glass = new T.MeshPhysicalMaterial({ color: 0x8aa6bd, metalness: 0.1, roughness: 0.03, transparent: true, opacity: 0.08, envMapIntensity: 0.8, side: T.DoubleSide, depthWrite: false });
    const mull = new T.MeshStandardMaterial({ color: 0x2c2f35, metalness: 0.7, roughness: 0.4 });
    const Hc = 4.4, rb = 7.0, rt = 8.1;
    for (let k = 0; k < 8; k++) {
      const a0 = k * Math.PI / 4 + Math.PI / 8, a1 = a0 + Math.PI / 4;
      const b0 = V(Math.cos(a0) * rb, CAB + 0.9, Math.sin(a0) * rb), b1 = V(Math.cos(a1) * rb, CAB + 0.9, Math.sin(a1) * rb), t0 = V(Math.cos(a0) * rt, CAB + Hc, Math.sin(a0) * rt), t1 = V(Math.cos(a1) * rt, CAB + Hc, Math.sin(a1) * rt);
      const gg = new T.BufferGeometry().setFromPoints([b0, b1, t1, b0, t1, t0]); gg.computeVertexNormals(); const pane = new T.Mesh(gg, glass); pane.renderOrder = 70; Gt.add(pane);
      const m = new T.Mesh(new T.BoxGeometry(0.12, 1, 0.12), mull); m.position.copy(b0.clone().add(t0).multiplyScalar(0.5)); m.scale.y = b0.distanceTo(t0); m.lookAt(Gt.localToWorld(t0.clone())); m.rotateX(Math.PI / 2); Gt.add(m);
      const sill = new T.Mesh(new T.BoxGeometry(1, 0.9, 0.3), conc); sill.position.copy(b0.clone().add(b1).multiplyScalar(0.5)); sill.position.y = CAB + 0.45; sill.scale.x = b0.distanceTo(b1); Gt.add(sill); sill.lookAt(Gt.localToWorld(V(0, CAB + 0.45, 0)));
    }
    // roof, antennas, obstruction light
    const roofM = new T.MeshStandardMaterial({ color: 0x3a3c40, metalness: 0.4, roughness: 0.6, side: T.DoubleSide, envMapIntensity: 0.2 });
    const y0 = CAB + Hc;
    add(new T.CylinderGeometry(8.0, 8.4, 0.5, 48), roofM, [0, y0 + 0.25, 0]); add(new T.CylinderGeometry(8.0, 8.0, 0.08, 48), snowRoof, [0, y0 + 0.54, 0]);
    add(new T.CylinderGeometry(8.5, 8.5, 0.35, 48, 1, true), new T.MeshStandardMaterial({ color: 0xd9d5cd, roughness: 0.7, side: T.DoubleSide }), [0, y0 + 0.35, 0]);
    add(new T.CylinderGeometry(4.5, 5.5, 1.6, 48), new T.MeshStandardMaterial({ color: 0xcfcac1, roughness: 0.8 }), [0, y0 + 1.3, 0]);
    add(new T.SphereGeometry(1.5, 32, 16), new T.MeshStandardMaterial({ color: 0xf1efe9, roughness: 0.55 }), [-2.2, y0 + 3.3, 1.2]);
    [[1.8, 0.6, 9], [2.6, -1.8, 6], [0.2, 2.6, 4.5]].forEach(([x, z, h]) => { add(new T.CylinderGeometry(0.05, 0.11, h, 8), mull, [x, y0 + 2.1 + h / 2, z]); });
    // inside: ceiling, shades, console arc, monitors, keyboards, strips, controllers
    const ceil = add(new T.CircleGeometry(8.1, 8).rotateX(Math.PI / 2), new T.MeshStandardMaterial({ color: 0x2b2d31, roughness: 0.9, side: T.DoubleSide }), [0, CAB + 4.38, 0]); ceil.rotation.y = Math.PI / 8;
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; add(new T.CircleGeometry(0.16, 20).rotateX(Math.PI / 2), new T.MeshBasicMaterial({ color: new T.Color(0xfff1dc).multiplyScalar(2.2) }), [Math.cos(a) * 4, CAB + 4.36, Math.sin(a) * 4]); }
    const shade = new T.MeshStandardMaterial({ color: 0x1a1d22, transparent: true, opacity: 0.5, roughness: 0.9, side: T.DoubleSide, depthWrite: false });
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4 + Math.PI / 4; const sh = new T.Mesh(new T.PlaneGeometry(5.6, 0.7), shade); sh.position.set(Math.cos(a) * 7.75, CAB + 3.95, Math.sin(a) * 7.75); Gt.add(sh); sh.lookAt(Gt.localToWorld(V(0, CAB + 3.95, 0))); sh.rotateX(0.24); }
    const desk = new T.MeshStandardMaterial({ color: 0x1a1c20, roughness: 0.7, metalness: 0.2, envMapIntensity: 0.12 });
    add(new T.CylinderGeometry(6.2, 6.2, 0.06, 48, 1, false, Math.PI * 0.62, Math.PI * 0.76), desk, [0, CAB + 0.78, 0]);
    add(new T.CylinderGeometry(6.25, 6.25, 0.78, 48, 1, true, Math.PI * 0.62, Math.PI * 0.76), desk, [0, CAB + 0.39, 0]);
    add(new T.CylinderGeometry(5.3, 5.3, 0.78, 48, 1, true, Math.PI * 0.62, Math.PI * 0.76), desk, [0, CAB + 0.39, 0]);
    const mon = (key, ang, w, h, y, r, tilt, res) => {
      const c = cnv(Math.round(w * (res || 900)), Math.round(h * (res || 900))); const t = ctex(c, true);
      const g2 = new T.Group(); g2.position.set(Math.sin(ang) * r, CAB + y, -Math.cos(ang) * r); g2.rotation.y = -ang; g2.rotateX(-(tilt || 0));
      const shell = new T.MeshStandardMaterial({ color: 0x15161a, roughness: 0.45, metalness: 0.35, envMapIntensity: 0.3 });
      g2.add(new T.Mesh(new T.BoxGeometry(w + 0.016, h + 0.016, 0.018), shell));
      const back = new T.Mesh(new T.BoxGeometry(w * 0.7, h * 0.6, 0.05), shell); back.position.z = -0.03; g2.add(back);
      const scr = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ map: t })); scr.position.z = 0.0095; g2.add(scr);
      const neck = new T.Mesh(new T.BoxGeometry(0.05, y - 0.78 - h / 2 + 0.06, 0.03), shell); neck.position.set(0, -(y - 0.78) / 2 - h / 4 + 0.03, -0.06); g2.add(neck);
      Gt.add(g2); screens[key] = { c, x: c.getContext('2d'), t, grp: g2 }; return g2;
    };
    mon('radar', -0.36, 0.5, 0.42, 1.12, 5.75, 0.12); mon('strips', -0.22, 0.46, 0.3, 1.06, 5.75, 0.12); mon('sentry', 0.0, 0.74, 0.44, 1.14, 5.7, 0.1, 1100);
    mon('adsb', 0.2, 0.46, 0.3, 1.06, 5.75, 0.12); mon('alert', 0.34, 0.4, 0.26, 1.04, 5.75, 0.12); mon('ground', 0.48, 0.46, 0.3, 1.06, 5.8, 0.12); mon('radar2', -0.52, 0.42, 0.36, 1.08, 5.8, 0.12);
    // live Sky Sentry feed on the centre monitor
    const sn = screens.sentry; const feed = new T.Mesh(new T.PlaneGeometry(0.47, 0.264), feedMat); feed.position.set(-0.102, 0.026, 0.0105); sn.grp.add(feed);
    const hc = cnv(640, 360), ht = ctex(hc, true); const hud = new T.Mesh(new T.PlaneGeometry(0.47, 0.264), new T.MeshBasicMaterial({ map: ht, transparent: true })); hud.position.set(-0.102, 0.026, 0.0115); sn.grp.add(hud); sn.hud = { c: hc, x: hc.getContext('2d'), t: ht };
    // the Arduino beacon on the console, and the red light it throws
    const bc = new T.Group(); bc.position.set(Math.sin(0.27) * 5.55, CAB + 0.81, -Math.cos(0.27) * 5.55); Gt.add(bc);
    bc.add(new T.Mesh(new T.CylinderGeometry(0.05, 0.06, 0.05, 20), new T.MeshStandardMaterial({ color: 0x1a1a1c, roughness: 0.5 })));
    const dome = new T.Mesh(new T.SphereGeometry(0.045, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), new T.MeshBasicMaterial({ color: 0x401010 })); dome.position.y = 0.025; bc.add(dome); towerFx.dome = dome;
    towerFx.red = new T.PointLight(0xff2a1c, 0, 7, 2); towerFx.red.position.set(0.3, CAB + 1.0, -4.6); Gt.add(towerFx.red);
    towerFx.mon = new T.PointLight(0x9fc0ff, 0.5, 5, 2); towerFx.mon.position.set(-0.2, CAB + 1.3, -4.7); Gt.add(towerFx.mon);
    const ceilL = new T.PointLight(0xffe2c0, 0.35, 12, 2); ceilL.position.set(0, CAB + 3.8, 0); Gt.add(ceilL);
    // controllers
    const p1 = person(0x1a2230, 0x6a4a38, 0x2a1d14); p1.position.set(0.15, CAB, -4.75); p1.rotation.y = Math.PI; Gt.add(p1);
    const p2 = person(0x2a2c30, 0x8a6650, 0x5a4a3a); p2.position.set(-2.9, CAB, -3.9); p2.rotation.y = Math.PI + 0.55; Gt.add(p2);
    const kbT = ctex(cnv(512, 170, (x) => { x.fillStyle = '#121316'; x.fillRect(0, 0, 512, 170); for (let r = 0; r < 5; r++) for (let k = 0; k < 15; k++) { x.fillStyle = '#2a2c31'; x.fillRect(8 + k * 33.5, 10 + r * 31, 29, 26); } }));
    const kbM = new T.MeshStandardMaterial({ map: kbT, roughness: 0.6 }), plain = new T.MeshStandardMaterial({ color: 0x17181b, roughness: 0.5, envMapIntensity: 0.2 });
    const onDesk = (ang, r, obj) => { obj.position.set(Math.sin(ang) * r, CAB + 0.81, -Math.cos(ang) * r); obj.rotation.y = -ang; Gt.add(obj); return obj; };
    [-0.3, -0.05, 0.25, 0.42].forEach((a, i) => {
      onDesk(a, 5.45, new T.Mesh(new T.BoxGeometry(0.44, 0.02, 0.15), [plain, plain, kbM, plain, plain, plain])).rotateX(0.04);
      if (i % 2 === 0) { const mug = new T.Group(); const cm = new T.MeshStandardMaterial({ color: i ? 0xe8e4dc : 0x1f3c6b, roughness: 0.35 }); const cup = new T.Mesh(new T.CylinderGeometry(0.04, 0.036, 0.1, 24), cm); cup.position.y = 0.05; mug.add(cup); onDesk(a - 0.07, 5.55, mug); }
    });
    const bay = new T.Group(); bay.add(new T.Mesh(new T.BoxGeometry(0.5, 0.02, 0.34), plain));
    for (let k = 0; k < 7; k++) { const st2 = new T.Mesh(new T.BoxGeometry(0.46, 0.012, 0.036), new T.MeshStandardMaterial({ color: [0xe9e4c8, 0xc9e2f0, 0xe9e4c8, 0xf3d3c8, 0xe9e4c8, 0xc9e2f0, 0xe9e4c8][k], roughness: 0.8 })); st2.position.set(0, 0.016, -0.14 + k * 0.045); bay.add(st2); }
    bay.rotation.x = -0.35; onDesk(-0.16, 5.5, bay).position.y += 0.06;
  }
  const towerFx = {};
  const feedRT = new T.WebGLRenderTarget(mobile ? 384 : 512, mobile ? 216 : 288, { type: T.HalfFloatType });
  const feedMat = new T.ShaderMaterial({ uniforms: { map: { value: feedRT.texture }, uExp: { value: 1 }, uT: lpT },
    vertexShader: LOGV + 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);\n#include <logdepthbuf_vertex>\n}',
    fragmentShader: LOGF + 'uniform sampler2D map; uniform float uExp, uT; varying vec2 vUv; vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14), 0.0, 1.0); } float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); } void main(){ vec3 c = texture2D(map, vUv).rgb * uExp; c = pow(aces(c), vec3(1.0/2.2)); float l = dot(c, vec3(0.3,0.59,0.11)); c = mix(vec3(l), c, 0.6) + (h(vUv*500.0 + uT) - 0.5)*0.08; gl_FragColor = vec4(c * 0.8, 1.0);\n#include <logdepthbuf_fragment>\n}' });

  // ================= the airliner: NASA 747SP geometry, fictional "Skyline" livery =================
  const PL = grp.plane, body = new T.Group(); PL.add(body); body.position.y = 1.3; S.add(PL);
  const plane = { mesh: null, ready: false, sprites: {}, cones: [], gear: null };
  function gear(parent) {
    const g = new T.Group(), rub = new T.MeshStandardMaterial({ color: 0x151515, roughness: 0.8 }), st = new T.MeshStandardMaterial({ color: 0x9a9ea4, metalness: 0.8, roughness: 0.35 });
    const wheel = new T.CylinderGeometry(0.62, 0.62, 0.45, 20); wheel.rotateX(Math.PI / 2);
    const leg = (x, z, h, n) => { const Lg = new T.Mesh(new T.CylinderGeometry(0.12, 0.14, h, 10), st); Lg.position.set(x, 0.62 + h / 2, z); g.add(Lg); for (let i = 0; i < n; i++) { const w = new T.Mesh(wheel, rub); w.position.set(x + (n > 2 ? (i < 2 ? 0.75 : -0.75) : 0), 0.62, z + (i % 2 ? 0.45 : -0.45)); g.add(w); } };
    leg(22.5, 0, 1.6, 2); for (const z of [-1.9, 1.9]) leg(-4.2, z, 1.6, 4); for (const z of [-5.6, 5.6]) leg(-1.8, z, 1.3, 4);
    g.position.y = -1.3; parent.add(g); return g;
  }
  const coneU = { uI: { value: 1 }, uMist: { value: 1 } };
  const coneMat = new T.ShaderMaterial({ uniforms: coneU, transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide,
    vertexShader: LOGV + 'varying float vA; varying vec3 vN, vV; void main(){ vA = uv.y; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv;\n#include <logdepthbuf_vertex>\n}',
    fragmentShader: LOGF + 'uniform float uI, uMist; varying float vA; varying vec3 vN, vV; void main(){ float edge = pow(abs(dot(vN, vV)), 1.6); float a = pow(vA, 2.2) * edge * uI * uMist * 0.16; gl_FragColor = vec4(vec3(1.0, 0.96, 0.88) * a, 1.0);\n#include <logdepthbuf_fragment>\n}' });
  loads.push(new Promise((res) => {
    new T.GLTFLoader().load('assets/models/b747.glb', (gl) => {
      let mesh = null; gl.scene.traverse((o) => { if (o.isMesh && !mesh) mesh = o; });
      const pm2 = new T.MeshPhysicalMaterial({ color: 0xf2f2f0, metalness: 0.15, roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.15, envMapIntensity: 1.0 });
      pm2.onBeforeCompile = (sh) => {
        sh.vertexShader = 'varying vec3 vLP;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vLP = position;');
        sh.fragmentShader = 'varying vec3 vLP;\n' + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n' + ['{ vec3 c = vec3(0.95); float x = vLP.x, y = vLP.y, z = abs(vLP.z);',
          'if (y < 3.0 && z < 4.0) c = vec3(0.78, 0.79, 0.8);',
          'float cheat = smoothstep(3.55, 3.6, y) * (1.0 - smoothstep(4.05, 4.1, y)) * step(x, 25.2) * step(-20.5, x) * step(z, 3.4); c = mix(c, vec3(0.06, 0.12, 0.26), cheat);',
          'float win = step(4.55, y) * (1.0 - step(4.85, y)) * step(fract(x * 1.95), 0.45) * step(x, 21.0) * step(-18.0, x) * step(z, 3.3);',
          'float upper = step(7.0, y) * (1.0 - step(7.28, y)) * step(fract(x * 1.95), 0.45) * step(x, 21.0) * step(8.0, x) * step(z, 3.0);',
          'c = mix(c, vec3(0.03), max(win, upper));',
          'float ck = step(24.6, x) * step(x, 26.6) * step(5.15, y) * step(y, 5.95) * step(z, 1.5); c = mix(c, vec3(0.015, 0.02, 0.03), ck);',
          'float tail = step(x, -19.0) * step(9.0, y) * step(z, 1.4); c = mix(c, vec3(0.06, 0.12, 0.26), tail);',
          'float stripe = tail * smoothstep(-0.5, -0.3, y - 13.0 + (x + 19.0) * 0.6) * (1.0 - smoothstep(0.3, 0.5, y - 13.6 + (x + 19.0) * 0.6)); c = mix(c, vec3(0.66, 0.8, 0.9), stripe);',
          'float nac = step(y, 3.3) * step(9.0, z) * step(z, 24.0); c = mix(c, vec3(0.7, 0.71, 0.73), nac);',
          'float intake = nac * step(8.9, x) * step(x, 10.2) * step(z, 13.5) + nac * step(-0.1, x) * step(x, 0.9) * step(18.5, z); c = mix(c, vec3(0.03), clamp(intake, 0.0, 1.0));',
          'diffuseColor.rgb *= c; }'].join('\n'));
      };
      pm2.customProgramCacheKey = () => 'livery-sky';
      mesh.material = pm2;
      mesh.castShadow = true; mesh.receiveShadow = true;
      mesh.geometry = T.BufferGeometryUtils && T.BufferGeometryUtils.toCreasedNormals ? T.BufferGeometryUtils.toCreasedNormals(mesh.geometry, Math.PI / 5) : (mesh.geometry.computeVertexNormals(), mesh.geometry);
      mesh.position.set(0, 0, 0); mesh.rotation.set(0, 0, 0); mesh.scale.set(1, 1, 1);
      body.add(mesh); plane.mesh = mesh; plane.gear = gear(body);
      // two more 747s parked at the terminal, snow on their wings implied by the white paint
      for (const x of [1600, 1820]) { const gg = new T.Group(); const pp = mesh.clone(); pp.position.y = 1.3; gg.add(pp); gear(gg); gg.position.set(x, 0, 440); gg.rotation.y = Math.PI / 2; grp.airport.add(gg); }
      plane.ready = true; res();
    }, undefined, (e) => { console.warn('747 failed to load', e); res(); });
  }));
  // lights on the airliner: landing lights (with cones through the mist), nav, strobes, beacon
  { const sp = plane.sprites;
    sp.landL = glow(0xfff3dc, 3); sp.landL.position.set(9.5, 2.3, -6.5); sp.landR = glow(0xfff3dc, 3); sp.landR.position.set(9.5, 2.3, 6.5); sp.nose = glow(0xfff3dc, 2.2); sp.nose.position.set(23, 0.2, 0);
    sp.navL = glow(0xff2a1a, 1.4); sp.navL.position.set(-2.5, 3.3, -29.8); sp.navR = glow(0x20ff60, 1.4); sp.navR.position.set(-2.5, 3.3, 29.8); sp.tail = glow(0xffffff, 1.0); sp.tail.position.set(-33.5, 5.2, 0);
    sp.strL = glow(0xffffff, 3.2); sp.strL.position.set(-2.7, 3.3, -29.9); sp.strR = glow(0xffffff, 3.2); sp.strR.position.set(-2.7, 3.3, 29.9);
    sp.bcn = glow(0xff2010, 1.6); sp.bcn.position.set(4, 8.3, 0); sp.bcn2 = glow(0xff2010, 1.6); sp.bcn2.position.set(4, -1.0, 0);
    Object.values(sp).forEach((s) => body.add(s));
    for (const [z, len] of [[-6.5, 240], [6.5, 240], [0, 160]]) { const g = new T.ConeGeometry(len * 0.1, len, 28, 1, true); g.translate(0, -len / 2, 0); g.rotateZ(Math.PI / 2); const c = new T.Mesh(g, coneMat); c.position.set(z ? 9.5 : 23, z ? 2.3 : 0.2, z); c.rotation.z = -3 * DEG; c.renderOrder = 61; c.frustumCulled = false; body.add(c); plane.cones.push(c); } }
  const ENG = [V(9.6, 2.85, 11.8), V(0.4, 3.4, 21.1), V(9.6, 2.85, -11.8), V(0.4, 3.4, -21.1)];
  // heat-shimmer / exhaust plume behind the four engines
  const heatU = { uT: lpT, uN1: { value: 0.42 } };
  const heatMat = new T.ShaderMaterial({ uniforms: heatU, transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide,
    vertexShader: LOGV + 'varying vec2 vUv; varying vec3 vN, vV; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv;\n#include <logdepthbuf_vertex>\n}',
    fragmentShader: LOGF + 'uniform float uT, uN1; varying vec2 vUv; varying vec3 vN, vV; void main(){ float edge = pow(abs(dot(vN, vV)), 1.3); float wave = 0.65 + 0.35 * sin(vUv.y * 44.0 - uT * 52.0 + sin(vUv.x * 18.0 + uT * 19.0)); float fade = smoothstep(0.0, 0.14, vUv.y) * pow(1.0 - vUv.y, 1.8); float a = fade * edge * wave * (0.04 + 0.16 * uN1); vec3 col = mix(vec3(0.88, 0.92, 0.98), vec3(1.0, 0.78, 0.56), smoothstep(0.35, 0.95, uN1) * (1.0 - vUv.y)); gl_FragColor = vec4(col * a, 1.0);\n#include <logdepthbuf_fragment>\n}' });
  plane.plumes = ENG.map((e) => {
    const g = new T.CylinderGeometry(1.15, 2.4, 26, 16, 1, true); g.translate(0, -13, 0); g.rotateZ(-Math.PI / 2);
    const m = new T.Mesh(g, heatMat); m.position.set(e.x - 2.2, e.y, e.z); m.renderOrder = 61; m.frustumCulled = false; body.add(m); return m;
  });

  // ================= the cockpit (built in code) =================
  const ck = {}; // display canvases and moving parts
  function buildCockpit() {
    const Gc = new T.Group(); Gc.position.set(24.0, 5.5, 0); body.add(Gc); grp.cockpit = Gc;
    const M = (c, r, m, e) => new T.MeshStandardMaterial({ color: c, roughness: r == null ? 0.7 : r, metalness: m || 0, envMapIntensity: e == null ? 0.35 : e });
    const shell = M(0x2b2f35, 0.75), shellL = M(0x3a3f46, 0.7), fabric = M(0x1b1d20, 0.95, 0, 0.15), metal = M(0x8c9298, 0.35, 0.8, 0.6);
    const add = (geo, m, p, r, par) => { const o = new T.Mesh(geo, m); o.position.set(p[0], p[1], p[2]); if (r) o.rotation.set(r[0], r[1], r[2]); (par || Gc).add(o); return o; };
    const bar = (a, b, t, m) => { const d = b.clone().sub(a), o = new T.Mesh(new T.BoxGeometry(t, d.length(), t), m); o.position.copy(a).add(b).multiplyScalar(0.5); o.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize()); Gc.add(o); return o; };
    const limb = (a, b, r0, r1, m) => { const d = b.clone().sub(a), o = new T.Mesh(new T.CylinderGeometry(r1, r0, d.length(), 14), m); o.position.copy(a).add(b).multiplyScalar(0.5); o.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize()); Gc.add(o); return o; };
    // windshield and side windows: panes with the moisture shader, framed by posts
    const yb = -0.2, yt = 0.31;
    const P = { c0: [V(1.13, yb, 0), V(0.96, yt, 0)], f1: [V(1.07, yb, 0.64), V(0.9, yt, 0.6)], s1: [V(0.62, yb, 0.98), V(0.5, yt, 0.92)], s2: [V(-0.15, yb + 0.05, 1.06), V(-0.15, yt - 0.06, 1.0)] };
    const mir = (v) => V(v.x, v.y, -v.z);
    const panes = [];
    const pane = (a0, a1, b0, b1) => { const g = new T.BufferGeometry().setFromPoints([a0, b0, b1, a0, b1, a1]); g.setAttribute('uv', new T.BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1]), 2)); g.computeVertexNormals(); const m = new T.Mesh(g, wetMat); m.renderOrder = 90; Gc.add(m); panes.push(m); };
    const seq = ['c0', 'f1', 's1', 's2'];
    for (const sg of [1, -1]) { const f = sg > 0 ? (v) => v : mir; for (let i = 0; i < 3; i++) { const A = P[seq[i]], B = P[seq[i + 1]]; pane(f(A[0]), f(A[1]), f(B[0]), f(B[1])); } }
    for (const k of seq) for (const sg of [1, -1]) { const f = sg > 0 ? (v) => v : mir; const A = P[k]; bar(f(A[0]), f(A[1]), k === 'c0' ? 0.07 : 0.06, shell); }
    for (const sg of [1, -1]) { const f = sg > 0 ? (v) => v : mir; for (let i = 0; i < 3; i++) { const A = P[seq[i]], B = P[seq[i + 1]]; bar(f(A[0]), f(B[0]), 0.05, shell); bar(f(A[1]), f(B[1]), 0.05, shell); } }
    // header, overhead panel, side walls, floor
    const ohC = cnv(1024, 512, (x, w, h) => { x.fillStyle = '#2c3036'; x.fillRect(0, 0, w, h); for (let r = 0; r < 9; r++) for (let c = 0; c < 22; c++) { if (rnd() < 0.18) continue; const X = 14 + c * 45, Y = 14 + r * 55; x.fillStyle = '#1a1c20'; x.fillRect(X, Y, 36, 40); const lit = rnd(); x.fillStyle = lit < 0.12 ? 'rgba(255,190,90,.95)' : lit < 0.2 ? 'rgba(150,230,255,.9)' : 'rgba(225,230,235,.55)'; x.fillRect(X + 6, Y + 26, 24, 4); x.fillStyle = 'rgba(230,235,240,.5)'; x.fillRect(X + 4, Y + 4, 28, 3); } });
    const ohT = ctex(ohC); const ohM = new T.MeshStandardMaterial({ map: ohT, emissive: 0xffffff, emissiveMap: ohT, emissiveIntensity: 0.12, roughness: 0.8 });
    const oh = add(new T.PlaneGeometry(1.15, 1.6), ohM, [0.3, 0.5, 0]); oh.quaternion.setFromUnitVectors(V(0, 0, 1), V(-0.4, -1, 0).normalize());
    add(new T.BoxGeometry(0.22, 0.06, 2.0), shell, [0.98, yt + 0.04, 0]);
    for (const sg of [-1, 1]) { add(new T.BoxGeometry(2.4, 1.1, 0.06), shell, [-0.4, -0.76, sg * 1.06]); add(new T.BoxGeometry(1.2, 0.7, 0.06), shellL, [-0.9, 0.12, sg * 1.04]); add(new T.BoxGeometry(1.6, 0.05, 0.4), fabric, [-0.2, -0.22, sg * 0.88]); }
    add(new T.BoxGeometry(3, 0.04, 2.2), M(0x16181b, 0.9), [-0.2, -1.32, 0]);
    // glareshield with the mode control panel
    add(new T.BoxGeometry(0.55, 0.05, 1.92), fabric, [0.8, -0.235, 0], [0, 0, -0.06]);
    add(new T.BoxGeometry(0.06, 0.16, 1.86), fabric, [0.53, -0.3, 0]);
    ck.mcp = cnv(1536, 128); ck.mcpT = ctex(ck.mcp); add(new T.PlaneGeometry(1.5, 0.125), new T.MeshBasicMaterial({ map: ck.mcpT }), [0.497, -0.3, 0], [0, -Math.PI / 2, 0]);
    // main instrument panel and six displays
    const panelM = M(0x24282d, 0.8);
    const pnl = add(new T.BoxGeometry(0.05, 0.5, 1.9), panelM, [0.72, -0.6, 0], [0, 0, -0.18]);
    ck.pfd = cnv(512, 512); ck.nd = cnv(512, 512); ck.eicas = cnv(512, 512); ck.pfdT = ctex(ck.pfd); ck.ndT = ctex(ck.nd); ck.eicasT = ctex(ck.eicas);
    const dispM = (t) => new T.MeshBasicMaterial({ map: t });
    [[-0.74, ck.pfdT], [-0.42, ck.ndT], [0, ck.eicasT], [0.42, ck.ndT], [0.74, ck.pfdT]].forEach(([z, t]) => { const d = add(new T.PlaneGeometry(0.24, 0.24), dispM(t), [0.692, -0.56, z], [0, -Math.PI / 2, 0]); d.rotateX(0.18); const bz = add(new T.BoxGeometry(0.02, 0.27, 0.27), M(0x111316, 0.5), [0.705, -0.56, z], [0, 0, -0.18]); });
    // pedestal and thrust levers
    add(new T.BoxGeometry(0.62, 0.62, 0.42), panelM, [0.32, -0.99, 0]);
    const pedC = cnv(512, 512, (x, w, h) => { x.fillStyle = '#25292e'; x.fillRect(0, 0, w, h); x.font = '600 22px "Geist Mono", monospace'; for (let r = 0; r < 5; r++) { x.fillStyle = '#16181b'; x.fillRect(20, 120 + r * 76, w - 40, 60); x.fillStyle = r % 2 ? 'rgba(255,200,110,.9)' : 'rgba(150,235,170,.9)'; x.fillText(['118.30  121.90', 'VHF 1  VHF 2', '7421   XPDR', '110.30 ILS 27', 'TCAS TA/RA'][r], 40, 158 + r * 76); } });
    const pedT = ctex(pedC); add(new T.PlaneGeometry(0.42, 0.6), new T.MeshStandardMaterial({ map: pedT, emissive: 0xffffff, emissiveMap: pedT, emissiveIntensity: 0.25, roughness: 0.6 }), [0.3, -0.675, 0], [-Math.PI / 2, 0, -Math.PI / 2]);
    ck.levers = [];
    for (let i = 0; i < 4; i++) { const lv = new T.Group(); lv.position.set(0.22, -0.68, -0.09 + i * 0.06); Gc.add(lv); const st = new T.Mesh(new T.BoxGeometry(0.012, 0.15, 0.012), metal); st.position.y = 0.075; lv.add(st); const kn = new T.Mesh(new T.CylinderGeometry(0.016, 0.016, 0.05, 12).rotateX(Math.PI / 2), M(0x101214, 0.4)); kn.position.y = 0.15; lv.add(kn); ck.levers.push(lv); }
    // control columns and yokes
    const yokeM = M(0x3b3f44, 0.5, 0.2);
    for (const z of [-0.53, 0.53]) {
      limb(V(0.5, -1.3, z), V(0.43, -0.6, z), 0.035, 0.03, yokeM);
      const hub = add(new T.BoxGeometry(0.06, 0.08, 0.1), yokeM, [0.43, -0.56, z]);
      for (const s of [-1, 1]) { const c = new T.CatmullRomCurve3([V(0.43, -0.56, z), V(0.43, -0.58, z + s * 0.12), V(0.43, -0.5, z + s * 0.18), V(0.42, -0.41, z + s * 0.17)]); add(new T.TubeGeometry(c, 16, 0.017, 8), yokeM, [0, 0, 0]); }
      add(new T.BoxGeometry(0.01, 0.09, 0.13), M(0xd9dcdf, 0.7), [0.42, -0.52, z]);
    }
    // seats seen from behind
    const seatM = M(0x2a2622, 0.85, 0, 0.2);
    for (const z of [-0.53, 0.53]) { const sb = add(new T.RoundedBoxGeometry(0.16, 0.78, 0.56, 4, 0.05), seatM, [-0.32, -0.55, z]); sb.rotation.z = 0.12; add(new T.RoundedBoxGeometry(0.5, 0.12, 0.56, 4, 0.04), seatM, [-0.06, -0.86, z]); }
    // the two pilots: heads with headsets, uniform shoulders and arms, gloved hands on the controls
    const navy = M(0x161e2c, 0.85, 0, 0.25), shirt = M(0xe8ecef, 0.8), gold = M(0xc9a24a, 0.35, 0.8, 0.8), glove = M(0x0e0f11, 0.42, 0, 0.6), skin = (c) => M(c, 0.6), hairM = (c) => M(c, 0.95, 0, 0.2), blk = M(0x15161a, 0.45);
    const pilot = (z, sg, hairC, skinC) => {
      const g = new T.Group(); Gc.add(g);
      const head = add(new T.SphereGeometry(0.1, 28, 20), skin(skinC), [-0.06, 0.03, z], null, g); head.scale.set(1.05, 1.15, 0.92);
      const hair = add(new T.SphereGeometry(0.104, 28, 20, 0, Math.PI * 2, 0, Math.PI * 0.6), hairM(hairC), [-0.075, 0.045, z], [0, 0, 0.5], g); hair.scale.set(1.05, 1.12, 0.95);
      add(new T.CylinderGeometry(0.05, 0.055, 0.12, 16), skin(skinC), [-0.08, -0.1, z], null, g);
      const band = add(new T.TorusGeometry(0.113, 0.012, 6, 28, Math.PI), blk, [-0.07, 0.035, z], null, g); band.rotation.set(0, Math.PI / 2, 0);
      for (const s of [-1, 1]) add(new T.CylinderGeometry(0.045, 0.045, 0.035, 18), blk, [-0.07, 0.03, z + s * 0.105], [Math.PI / 2, 0, 0], g);
      add(new T.CylinderGeometry(0.004, 0.004, 0.14, 6), blk, [0.0, -0.01, z + sg * 0.09], [0, 0, 1.3], g);
      // torso and shoulders with epaulettes
      const tor = add(new T.CapsuleGeometry(0.17, 0.3, 6, 14), shirt, [-0.14, -0.42, z], null, g); tor.scale.set(0.75, 1, 1.25);
      for (const s of [-1, 1]) { add(new T.SphereGeometry(0.075, 16, 12), shirt, [-0.13, -0.24, z + s * 0.19], null, g); const ep = add(new T.BoxGeometry(0.1, 0.012, 0.055), blk, [-0.13, -0.17, z + s * 0.19], null, g); for (let k = 0; k < (sg < 0 ? 4 : 3); k++) add(new T.BoxGeometry(0.008, 0.014, 0.05), gold, [-0.105 + k * 0.016, -0.165, z + s * 0.19], null, g); }
      return g;
    };
    pilot(-0.53, -1, 0x6e6a66, 0xc49a7c); pilot(0.53, 1, 0x241a12, 0x8a5e44);
    const gloveAt = (pos, dir, curl) => { // palm + four curled fingers + thumb, oriented along dir
      const g = new T.Group(); g.position.copy(pos); Gc.add(g); g.quaternion.setFromUnitVectors(V(0, 0, 1), dir.clone().normalize());
      const palm = new T.Mesh(new T.RoundedBoxGeometry(0.085, 0.032, 0.095, 3, 0.012), glove); g.add(palm);
      for (let k = 0; k < 4; k++) { const f = new T.Mesh(new T.CapsuleGeometry(0.0095, 0.05, 4, 8), glove); f.position.set(-0.03 + k * 0.02, -0.01 - curl * 0.02, 0.07); f.rotation.x = Math.PI / 2 + curl; g.add(f); }
      const th = new T.Mesh(new T.CapsuleGeometry(0.011, 0.045, 4, 8), glove); th.position.set(0.05, -0.012, 0.035); th.rotation.set(Math.PI / 2, 0, -0.7); g.add(th);
      const cuff = new T.Mesh(new T.CylinderGeometry(0.036, 0.034, 0.05, 14).rotateX(Math.PI / 2), glove); cuff.position.z = -0.065; g.add(cuff);
      return g;
    };
    const arm = (sh, el, wr, hand, dir, curl, cuffStripes) => {
      limb(sh, el, 0.05, 0.045, shirt); limb(el, wr, 0.045, 0.036, shirt);
      gloveAt(hand, dir, curl);
      for (let k = 0; k < cuffStripes; k++) { const d = wr.clone().sub(el).normalize(); const r = new T.Mesh(new T.TorusGeometry(0.038, 0.004, 6, 20), gold); r.position.copy(wr).addScaledVector(d, -0.03 - k * 0.012); r.quaternion.setFromUnitVectors(V(0, 0, 1), d); Gc.add(r); }
    };
    // captain: left hand on the yoke's left horn, right hand on the thrust levers
    arm(V(-0.13, -0.25, -0.72), V(0.1, -0.52, -0.86), V(0.35, -0.47, -0.72), V(0.4, -0.45, -0.71), V(1, 0.35, 0.1), 0.9, 4);
    arm(V(-0.13, -0.25, -0.34), V(0.03, -0.6, -0.2), V(0.18, -0.55, -0.05), V(0.23, -0.53, -0.01), V(1, 0.1, 0.25), 1.1, 4);
    // first officer: right hand on his yoke, left hand on the pedestal edge
    arm(V(-0.13, -0.25, 0.72), V(0.1, -0.52, 0.86), V(0.35, -0.47, 0.72), V(0.4, -0.45, 0.71), V(1, 0.35, -0.1), 0.9, 3);
    arm(V(-0.13, -0.25, 0.34), V(0.0, -0.62, 0.26), V(0.12, -0.66, 0.23), V(0.17, -0.65, 0.22), V(1, -0.2, -0.1), 0.6, 3);
    // instrument glow and a warm flood light
    ck.glowL = new T.PointLight(0x8fb4ff, 0.7, 2.6, 2); ck.glowL.position.set(0.5, -0.45, 0); Gc.add(ck.glowL);
    ck.flood = new T.PointLight(0xffd9b0, 0.25, 3, 2); ck.flood.position.set(-0.2, 0.45, 0); Gc.add(ck.flood);
    ck.rig = new T.Object3D(); Gc.add(ck.rig);
    return Gc;
  }
  const wetU = { uT: lpT, uWet: { value: 0 }, uFlow: { value: 1 }, uSun: { value: SUN.clone() } };
  const wetMat = new T.ShaderMaterial({ uniforms: wetU, transparent: true, depthWrite: false, side: T.DoubleSide,
    vertexShader: LOGV + 'varying vec2 vUv; varying vec3 vWN, vWP; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vWP = w.xyz; vWN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w;\n#include <logdepthbuf_vertex>\n}',
    fragmentShader: LOGF + [
      'uniform float uT, uWet, uFlow; uniform vec3 uSun; varying vec2 vUv; varying vec3 vWN, vWP;',
      'float h1(float n){ return fract(sin(n)*43758.5453); } float h2(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }',
      'void main(){',
      '  float s = 0.0, dr = 0.0;',
      '  for (int L = 0; L < 3; L++){ float fl = float(L); vec2 g = vec2(18.0 + fl*9.0, 2.0 + fl);',
      '    vec2 uv = vUv; uv.x += uv.y * (0.35 + fl*0.1);',
      '    float col = floor(uv.x * g.x); float r = h1(col*13.1 + fl*7.0);',
      '    float y = fract(uv.y * g.y - uT * uFlow * (0.35 + r*0.9) - r*9.0);',
      '    float xo = fract(uv.x * g.x) - 0.5 - (r - 0.5)*0.4;',
      '    float w = 0.04 + 0.04*r; float line = smoothstep(w, 0.0, abs(xo)) * smoothstep(0.0, 0.08, y) * smoothstep(1.0, 0.25, y) * step(0.45, r);',
      '    s += line * (0.6 + 0.4*sin(y*30.0)); }',
      '  vec2 dp = vUv * vec2(60.0, 22.0); vec2 id = floor(dp); vec2 f = fract(dp) - 0.5 - (vec2(h2(id), h2(id+3.1)) - 0.5)*0.6; float rr = h2(id+7.7);',
      '  dr = smoothstep(0.16*rr, 0.0, length(f)) * step(0.55, rr);',
      '  vec3 Vv = normalize(cameraPosition - vWP); vec3 N = normalize(vWN);',
      '  float ndv = abs(dot(N, Vv)); float fres = 0.04 + 0.96 * pow(1.0 - ndv, 5.0);',
      '  float glint = pow(max(dot(normalize(uSun + Vv), N), 0.0), 36.0) * (s + dr);',
      '  float cond = (s * 0.42 + dr * 0.38) * uWet + 0.035*uWet;',
      '  float a = clamp(cond + fres * 0.14, 0.0, 0.85);',
      '  vec3 glassCol = mix(vec3(0.42, 0.54, 0.68), vec3(1.0, 0.86, 0.72), pow(max(dot(-Vv, uSun), 0.0), 4.0));',
      '  vec3 c = mix(glassCol, vec3(1.0), clamp(s*0.6 + dr + glint*0.85, 0.0, 1.0));',
      '  gl_FragColor = vec4(c, a);',
      '#include <logdepthbuf_fragment>',
      '}'].join('\n') });
  buildCockpit();

  // ================= cockpit displays (drawn in code) =================
  const mono = (x, sz, w) => { x.font = `${w || 500} ${sz}px "Geist Mono", ui-monospace, Menlo, monospace`; };
  function drawPFD(x, w, h, s) {
    x.fillStyle = '#000'; x.fillRect(0, 0, w, h);
    x.save(); x.beginPath(); x.rect(w * 0.2, h * 0.14, w * 0.6, h * 0.62); x.clip();
    x.translate(w * 0.5, h * 0.45); x.rotate(-s.roll * DEG); const ppd = 8; x.translate(0, s.pitch * ppd);
    x.fillStyle = '#2d7fd0'; x.fillRect(-w, -h * 2, w * 2, h * 2); x.fillStyle = '#8a5522'; x.fillRect(-w, 0, w * 2, h * 2);
    x.strokeStyle = '#fff'; x.fillStyle = '#fff'; x.lineWidth = 2; x.beginPath(); x.moveTo(-w, 0); x.lineTo(w, 0); x.stroke(); mono(x, 14, 600); x.textAlign = 'center';
    for (let a = -20; a <= 20; a += 2.5) { if (!a) continue; const y = -a * ppd, L = a % 10 === 0 ? 70 : a % 5 === 0 ? 44 : 22; x.beginPath(); x.moveTo(-L / 2, y); x.lineTo(L / 2, y); x.stroke(); if (a % 10 === 0) { x.fillText(Math.abs(a), -L / 2 - 16, y + 5); x.fillText(Math.abs(a), L / 2 + 16, y + 5); } }
    x.restore();
    x.strokeStyle = '#000'; x.lineWidth = 6; x.beginPath(); x.moveTo(w * 0.32, h * 0.45); x.lineTo(w * 0.44, h * 0.45); x.lineTo(w * 0.44, h * 0.49); x.moveTo(w * 0.68, h * 0.45); x.lineTo(w * 0.56, h * 0.45); x.lineTo(w * 0.56, h * 0.49); x.stroke();
    x.strokeStyle = '#ffd400'; x.lineWidth = 3; x.stroke(); x.fillStyle = '#ffd400'; x.fillRect(w * 0.49, h * 0.44, w * 0.02, h * 0.02);
    // speed and altitude tapes
    const tape = (X, val, step, ppu, fmt) => { x.fillStyle = 'rgba(60,64,70,.92)'; x.fillRect(X, h * 0.14, w * 0.14, h * 0.62); x.save(); x.beginPath(); x.rect(X, h * 0.14, w * 0.14, h * 0.62); x.clip(); x.fillStyle = '#fff'; x.strokeStyle = '#fff'; x.lineWidth = 2; mono(x, 15, 500); x.textAlign = 'center';
      const base = Math.floor(val / step) * step; for (let k = -6; k <= 6; k++) { const v = base + k * step, y = h * 0.45 - (v - val) * ppu; x.beginPath(); x.moveTo(X + w * 0.12, y); x.lineTo(X + w * 0.14, y); x.stroke(); if (v >= 0) x.fillText(fmt(v), X + w * 0.06, y + 5); } x.restore();
      x.fillStyle = '#000'; x.fillRect(X - 4, h * 0.42, w * 0.15, h * 0.06); x.strokeStyle = '#fff'; x.strokeRect(X - 4, h * 0.42, w * 0.15, h * 0.06); x.fillStyle = '#fff'; mono(x, 20, 600); x.fillText(fmt(Math.round(val)), X + w * 0.065, h * 0.465); };
    tape(w * 0.03, s.kt, 10, 3.2, (v) => String(v)); tape(w * 0.83, s.ft, 100, 0.35, (v) => String(Math.round(v / 10) * 10));
    // FMA, glideslope, heading
    mono(x, 17, 600); x.textAlign = 'center'; x.fillStyle = '#3ddc84'; const fm = s.ga ? ['TO/GA', 'TO/GA', 'TO/GA'] : s.app ? ['SPD', 'LOC', 'G/S'] : ['SPD', 'LNAV', 'VNAV PTH']; fm.forEach((t, i) => x.fillText(t, w * (0.3 + i * 0.2), h * 0.09));
    if (s.app && !s.ga) { x.strokeStyle = '#fff'; x.lineWidth = 2; for (let k = -2; k <= 2; k++) { x.beginPath(); x.arc(w * 0.79, h * 0.45 + k * 26, 4, 0, 7); x.stroke(); } x.fillStyle = '#ff4fd8'; x.beginPath(); const gy = h * 0.45 + (s.gsd || 0) * 26; x.moveTo(w * 0.79, gy - 9); x.lineTo(w * 0.8 + 6, gy); x.lineTo(w * 0.79, gy + 9); x.lineTo(w * 0.78 - 6, gy); x.fill(); }
    x.fillStyle = 'rgba(60,64,70,.92)'; x.fillRect(w * 0.25, h * 0.82, w * 0.5, h * 0.14); x.fillStyle = '#fff'; mono(x, 16, 600); for (let k = -3; k <= 3; k++) { const hd = (Math.round(s.hdg / 10) * 10 + k * 10 + 360) % 360, X = w * 0.5 + (hd - s.hdg) * 5.2; x.fillText(String(hd / 10).padStart(2, '0'), X, h * 0.9); }
    x.strokeStyle = '#fff'; x.beginPath(); x.moveTo(w * 0.5, h * 0.82); x.lineTo(w * 0.5, h * 0.85); x.stroke();
    mono(x, 13); x.fillStyle = '#3ddc84'; x.textAlign = 'left'; x.fillText(s.ga ? 'FLAPS 20' : s.app ? 'MINIMUMS 200' : 'FL' + Math.round(s.ft / 100), w * 0.03, h * 0.97);
  }
  function drawND(x, w, h, s) {
    x.fillStyle = '#000'; x.fillRect(0, 0, w, h); const cx = w / 2, cy = h * 0.82, Rr = h * 0.68;
    x.strokeStyle = '#fff'; x.lineWidth = 2; x.beginPath(); x.arc(cx, cy, Rr, Math.PI * 1.17, Math.PI * 1.83); x.stroke();
    mono(x, 14, 600); x.fillStyle = '#fff'; x.textAlign = 'center';
    for (let a = -30; a <= 30; a += 5) { const an = (a - 90) * DEG, r1 = Rr, r2 = Rr - (a % 10 ? 8 : 16); x.beginPath(); x.moveTo(cx + Math.cos(an) * r1, cy + Math.sin(an) * r1); x.lineTo(cx + Math.cos(an) * r2, cy + Math.sin(an) * r2); x.stroke(); if (a % 10 === 0) { const hd = (Math.round(s.hdg) + a + 360) % 360; x.fillText(String(Math.round(hd / 10)).padStart(2, '0'), cx + Math.cos(an) * (Rr + 16), cy + Math.sin(an) * (Rr + 16) + 5); } }
    x.setLineDash([4, 8]); x.strokeStyle = 'rgba(255,255,255,.5)'; x.beginPath(); x.arc(cx, cy, Rr / 2, Math.PI * 1.17, Math.PI * 1.83); x.stroke(); x.setLineDash([]);
    x.strokeStyle = '#ff4fd8'; x.lineWidth = 3; x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + 2, cy - Rr * 0.9); x.stroke();
    const rw = cy - Rr * Math.min(0.9, s.nm / 10); x.strokeStyle = '#fff'; x.lineWidth = 2; x.strokeRect(cx - 4, rw - 30, 8, 30); mono(x, 13); x.fillText('RW27', cx + 34, rw - 10);
    x.fillStyle = '#3ddc84'; x.beginPath(); x.arc(cx - 90, cy - Rr * 0.55, 5, 0, 7); x.fill(); x.fillStyle = '#fff'; x.fillText('CF27', cx - 90, cy - Rr * 0.55 - 12);
    x.strokeStyle = '#fff'; x.lineWidth = 3; x.beginPath(); x.moveTo(cx, cy - 16); x.lineTo(cx - 12, cy + 10); x.lineTo(cx + 12, cy + 10); x.closePath(); x.stroke();
    mono(x, 15, 600); x.textAlign = 'left'; x.fillStyle = '#fff'; x.fillText(`GS ${Math.round(s.kt)}  TAS ${Math.round(s.kt + 3)}`, 12, 26); x.fillText('270°/08', 12, 48); x.textAlign = 'right'; x.fillStyle = '#ff4fd8'; x.fillText('RW27', w - 12, 26); x.fillStyle = '#fff'; x.fillText(`${s.nm.toFixed(1)} NM`, w - 12, 48);
    if (s.tfc) { x.fillStyle = '#ffb02e'; x.textAlign = 'center'; x.fillText('BIRDS', cx - 30, cy - Rr * 0.25); }
  }
  function drawEICAS(x, w, h, s) {
    x.fillStyle = '#000'; x.fillRect(0, 0, w, h); mono(x, 16, 600); x.textAlign = 'center';
    for (let i = 0; i < 4; i++) { const cx = w * (0.14 + i * 0.24), cy = h * 0.22, r = w * 0.09, n1 = s.n1 * (0.98 + 0.02 * Math.sin(i * 2.1));
      x.strokeStyle = '#fff'; x.lineWidth = 2; x.beginPath(); x.arc(cx, cy, r, Math.PI, Math.PI * 2.3); x.stroke();
      x.fillStyle = 'rgba(255,255,255,.15)'; x.beginPath(); x.moveTo(cx, cy); x.arc(cx, cy, r, Math.PI, Math.PI + n1 * Math.PI * 1.3); x.fill();
      x.strokeStyle = '#fff'; x.lineWidth = 3; const an = Math.PI + n1 * Math.PI * 1.3; x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + Math.cos(an) * r, cy + Math.sin(an) * r); x.stroke();
      x.fillStyle = '#fff'; x.fillText((n1 * 104).toFixed(1), cx, cy + r * 0.75); }
    x.fillStyle = '#8fa0b8'; mono(x, 13); x.fillText('N1', w * 0.5, h * 0.44);
    mono(x, 17, 600); x.textAlign = 'left'; x.fillStyle = s.gear > 0.5 ? '#3ddc84' : '#fff'; x.fillText(s.gear > 0.5 ? 'GEAR  DOWN' : s.gear > 0.02 ? 'GEAR  TRANSIT' : 'GEAR  UP', w * 0.08, h * 0.62);
    x.fillStyle = '#3ddc84'; x.fillText(`FLAPS ${s.ga ? 20 : s.app ? 30 : 'UP'}`, w * 0.08, h * 0.7);
    if (s.ga) { x.fillStyle = '#ffb02e'; x.fillText('GO AROUND', w * 0.08, h * 0.82); }
    x.fillStyle = '#fff'; mono(x, 13); x.fillText('TAT -6C   FUEL 41.2', w * 0.08, h * 0.94);
  }
  function drawMCP(x, w, h, s) {
    x.fillStyle = '#3a3f46'; x.fillRect(0, 0, w, h); mono(x, 40, 600); x.textBaseline = 'middle';
    const win = (X, lab, v, on) => { x.fillStyle = '#c8cdd2'; mono(x, 18, 600); x.fillText(lab, X, 22); x.fillStyle = '#0b0c0e'; x.fillRect(X, 38, 150, 64); x.fillStyle = 'rgba(255,190,90,.95)'; mono(x, 44, 600); x.fillText(v, X + 10, 72); if (on != null) { x.fillStyle = on ? 'rgba(120,255,160,.95)' : '#20242a'; x.fillRect(X + 170, 60, 50, 10); } };
    win(60, 'IAS', String(Math.round(s.sel)), true); win(380, 'HDG', '270', false); win(700, 'ALT', s.ga ? '3000' : '3000', s.ga); win(1020, 'V/S', s.ga ? '+2500' : '', false);
    ['LOC', 'APP', 'A/P'].forEach((t, i) => { x.fillStyle = '#c8cdd2'; mono(x, 18, 600); x.fillText(t, 1300 + i * 75, 36); x.fillStyle = !s.ga ? 'rgba(120,255,160,.95)' : '#20242a'; x.fillRect(1300 + i * 75, 64, 52, 10); });
  }

  // ================= the flock: 60 geese, instanced, flapping in the vertex shader =================
  const NB = mobile ? 52 : 64;
  const gooseGeo = (() => {
    const parts = [], col = (g, c) => { g = g.toNonIndexed(); g.deleteAttribute('uv'); const n = g.attributes.position.count, a = new Float32Array(n * 3), w = new Float32Array(n); for (let i = 0; i < n; i++) a.set(c, i * 3); g.setAttribute('color', new T.BufferAttribute(a, 3)); g.setAttribute('aWing', new T.BufferAttribute(w, 1)); parts.push(g); return g; };
    const brown = [0.34, 0.29, 0.24], pale = [0.66, 0.62, 0.55], black = [0.05, 0.05, 0.05], white = [0.92, 0.92, 0.9];
    col(new T.SphereGeometry(0.2, 12, 8).scale(2.4, 0.95, 1.05), brown);
    col(new T.SphereGeometry(0.16, 10, 6).scale(1.9, 0.7, 0.9).translate(0.05, -0.07, 0), pale);
    col(new T.ConeGeometry(0.11, 0.26, 8).rotateZ(Math.PI / 2).translate(-0.56, 0.02, 0), black);
    col(new T.CapsuleGeometry(0.045, 0.36, 3, 8).rotateZ(-Math.PI / 2 + 0.12).translate(0.62, 0.06, 0), black);
    col(new T.SphereGeometry(0.065, 10, 8).scale(1.6, 1, 0.9).translate(0.88, 0.1, 0), black);
    col(new T.SphereGeometry(0.045, 8, 6).scale(1.2, 0.8, 1.3).translate(0.86, 0.08, 0), white);
    col(new T.ConeGeometry(0.025, 0.1, 6).rotateZ(-Math.PI / 2).translate(1.0, 0.09, 0), black);
    for (const sg of [-1, 1]) { // wing: root at |z| = 0.08, tip at 0.95
      const P2 = [[0.16, 0.08], [0.22, 0.3], [0.16, 0.62], [0.02, 0.95], [-0.14, 0.82], [-0.2, 0.45], [-0.14, 0.08]];
      const pos = [], wt = [], cc = [];
      for (let i = 1; i < P2.length - 1; i++) for (const k of [0, i, i + 1]) { const [px, pz] = P2[k]; pos.push(px, 0.06, sg * pz); wt.push(Math.max(0, (pz - 0.08) / 0.87)); const tip = pz > 0.6 ? 1 : 0; cc.push(...(tip ? [0.16, 0.14, 0.12] : [0.4, 0.35, 0.3])); }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new T.Float32BufferAttribute(cc, 3)); g.setAttribute('aWing', new T.Float32BufferAttribute(wt, 1)); g.computeVertexNormals(); parts.push(g);
    }
    return T.BufferGeometryUtils.mergeBufferGeometries(parts.map((g) => { if (!g.attributes.normal) g.computeVertexNormals(); return g; }));
  })();
  const flockU = { uT: { value: 0 } };
  const gooseMat = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: T.DoubleSide, envMapIntensity: 0.6 });
  gooseMat.onBeforeCompile = (sh) => {
    sh.uniforms.uT = flockU.uT;
    sh.vertexShader = 'attribute float aWing; attribute float aPh; uniform float uT;\n' + sh.vertexShader.replace('#include <begin_vertex>', [
      '#include <begin_vertex>',
      'if (aWing > 0.0) { float amp = 0.45 + 0.55*fract(aPh*7.13); float fl = sin(uT*13.0*(0.9 + 0.2*fract(aPh*3.7)) + aPh);',
      '  float th = (0.62*fl + 0.12) * amp + 0.38*fl*aWing*amp; float r = abs(transformed.z) - 0.08; float sz = sign(transformed.z);',
      '  transformed.y += r * sin(th); transformed.z = sz * (0.08 + r * cos(th)); }'].join('\n'));
  };
  gooseMat.customProgramCacheKey = () => 'goose-flap';
  const flock = new T.InstancedMesh(gooseGeo, gooseMat, NB); flock.frustumCulled = false;
  { const ph = new Float32Array(NB); for (let i = 0; i < NB; i++) ph[i] = rnd() * 40; flock.geometry.setAttribute('aPh', new T.InstancedBufferAttribute(ph, 1)); }
  grp.flock.add(flock); S.add(grp.flock);
  const BIRD = []; // formation offsets: two loose skeins and a swirling cloud
  for (let i = 0; i < NB; i++) {
    let o; if (i < 30) { const sk = i < 15 ? 0 : 1, j = i % 15, arm = j % 2 ? 1 : -1, n = Math.ceil(j / 2); o = V(-n * 1.9 - sk * 14, sk * 4 + (rnd() - 0.5), arm * n * 2.1 + sk * 18); }
    else o = V((rnd() - 0.5) * 46, (rnd() - 0.5) * 14, (rnd() - 0.5) * 46);
    BIRD.push({ o, ph: rnd() * 10, sp: 0.7 + rnd() * 0.6 });
  }
  const flockC = (p, out) => { const k = clamp((p - 0.38) / (0.95 - 0.38), 0, 1); return out.set(-1080 + Math.sin(k * 3.2) * 90 - 60 * k, 82 + Math.sin(k * 5.0) * 10 - k * 12, lerp(560, -420, k)); };
  const _m4 = new T.Matrix4(), _q = new T.Quaternion(), _e = new T.Euler(), _v1 = V(0, 0, 0), _v2 = V(0, 0, 0), _v3 = V(0, 0, 0), _sc = V(1, 1, 1);
  const birdPos = (i, p, t, out) => {
    const b = BIRD[i]; flockC(p, _v1); flockC(p + 0.004, _v2); const hd = Math.atan2(-(_v2.z - _v1.z), _v2.x - _v1.x);
    const sw = ss(0.5, 0.9, p) * (i % 3 - 1) * 1.4 + Math.sin(t * 0.21 * b.sp + b.ph) * 0.25; const a = hd + sw * (i >= 30 ? 1 : 0.25);
    const o = b.o, ca = Math.cos(a), sa = Math.sin(a), loose = 1 + ss(0.5, 0.85, p) * 0.8;
    out.set(_v1.x + (o.x * ca + o.z * sa) * loose + Math.sin(t * 0.5 * b.sp + b.ph) * 1.2, _v1.y + o.y * loose + Math.sin(t * 0.7 * b.sp + b.ph * 2) * 0.8, _v1.z + (-o.x * sa + o.z * ca) * loose + Math.cos(t * 0.4 * b.sp + b.ph) * 1.2);
    return hd;
  };
  const birdNow = []; for (let i = 0; i < NB; i++) birdNow.push(V(0, 0, 0));
  const updateFlock = (p, t) => {
    for (let i = 0; i < NB; i++) {
      const hd = birdPos(i, p, t, birdNow[i]); const b = BIRD[i];
      const turn = Math.sin(t * 0.21 * b.sp + b.ph) * 0.4 + ss(0.5, 0.9, p) * (i % 3 - 1) * 0.6;
      _e.set(-turn * 0.6, hd + turn * 0.5, Math.sin(t * 0.3 + b.ph) * 0.08, 'YXZ'); _q.setFromEuler(_e);
      _m4.compose(birdNow[i], _q, _sc); flock.setMatrixAt(i, _m4);
    }
    flock.instanceMatrix.needsUpdate = true;
  };

  // ================= the drone near the perimeter =================
  const drone = new T.Group(); drone.position.copy(DRONE0); S.add(drone);
  const dr = { props: [], leds: [] };
  { const wm = new T.MeshStandardMaterial({ color: 0xd9dde1, roughness: 0.45, metalness: 0.1 }), dk = new T.MeshStandardMaterial({ color: 0x1b1d21, roughness: 0.5, metalness: 0.3 });
    drone.add(new T.Mesh(new T.RoundedBoxGeometry(0.3, 0.09, 0.2, 3, 0.03), wm));
    const cam = new T.Mesh(new T.SphereGeometry(0.04, 16, 12), dk); cam.position.set(0.14, -0.06, 0); drone.add(cam);
    for (let k = 0; k < 4; k++) { const a = Math.PI / 4 + k * Math.PI / 2, x = Math.cos(a) * 0.24, z = Math.sin(a) * 0.24;
      const arm = new T.Mesh(new T.BoxGeometry(0.34, 0.025, 0.03), wm); arm.position.set(x / 2, 0, z / 2); arm.rotation.y = -a; drone.add(arm);
      const mot = new T.Mesh(new T.CylinderGeometry(0.03, 0.03, 0.045, 14), dk); mot.position.set(x, 0.02, z); drone.add(mot);
      const pr = new T.Mesh(new T.CylinderGeometry(0.12, 0.12, 0.004, 24), new T.MeshBasicMaterial({ color: 0x222428, transparent: true, opacity: 0.28, depthWrite: false })); pr.position.set(x, 0.05, z); drone.add(pr); dr.props.push(pr);
      const led = glow(k < 2 ? 0xff2a1a : 0x30ff70, 0.6); led.position.set(x, -0.02, z); drone.add(led); dr.leds.push(led); }
    dr.strobe = glow(0xffffff, 1.4); dr.strobe.position.set(0, 0.07, 0); drone.add(dr.strobe); }

  // ================= Sky Sentry's phone on a tripod =================
  const phoneG = new T.Group(); phoneG.position.set(SENT.x, 0, SENT.z); S.add(phoneG);
  const sentCam = new T.PerspectiveCamera(22, 16 / 9, 0.5, 30000);
  { const blk = new T.MeshStandardMaterial({ color: 0x18191b, metalness: 0.6, roughness: 0.4 });
    for (let k = 0; k < 3; k++) { const a = k * 2.094, l = new T.Mesh(new T.CylinderGeometry(0.012, 0.018, 1.5, 6), blk); l.position.set(Math.cos(a) * 0.22, 0.7, Math.sin(a) * 0.22); l.lookAt(phoneG.localToWorld(V(0, 1.45, 0))); l.rotateX(Math.PI / 2); phoneG.add(l); }
    const ph = new T.Mesh(new T.BoxGeometry(0.009, 0.078, 0.16), blk); ph.position.set(0, 1.42, 0); phoneG.add(ph);
    const scr = new T.Mesh(new T.PlaneGeometry(0.15, 0.07), feedMat); scr.position.set(0.0052, 1.42, 0); scr.rotation.y = Math.PI / 2; phoneG.add(scr);
    phoneG.rotation.y = Math.PI; }

  // ================= wingtip vortices and falling snow =================
  function Particles(n, tex) {
    const g = new T.BufferGeometry(); this.pos = new Float32Array(n * 3); this.a = new Float32Array(n); this.size = new Float32Array(n);
    g.setAttribute('position', new T.BufferAttribute(this.pos, 3)); g.setAttribute('aA', new T.BufferAttribute(this.a, 1)); g.setAttribute('size', new T.BufferAttribute(this.size, 1));
    this.mat = new T.ShaderMaterial({ uniforms: { map: { value: tex }, uScale: lpScale }, transparent: true, depthWrite: false,
      vertexShader: LOGV + 'attribute float size, aA; varying float vA; uniform float uScale; void main(){ vA = aA; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = min(size * uScale / -mv.z, 400.0); gl_Position = projectionMatrix * mv;\n#include <logdepthbuf_vertex>\n}',
      fragmentShader: LOGF + 'uniform sampler2D map; varying float vA; void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vec3(0.92, 0.95, 1.0), t.a * vA);\n#include <logdepthbuf_fragment>\n}' });
    this.pts = new T.Points(g, this.mat); this.pts.frustumCulled = false; this.pts.renderOrder = 62; this.g = g; this.n = n; this.list = [];
    this.add = (o) => { if (this.list.length < n) this.list.push(o); };
    this.update = (dt) => { const Lp = this.list; for (let i = Lp.length - 1; i >= 0; i--) { const o = Lp[i]; o.age += dt; if (o.age > o.life) { Lp.splice(i, 1); continue; } o.ang += dt * 2.2; o.p.y -= dt * 1.2; }
      for (let i = 0; i < n; i++) { const o = Lp[i]; if (!o) { this.a[i] = 0; this.size[i] = 0; continue; } const k = o.age / o.life; this.pos.set([o.p.x, o.p.y + Math.sin(o.ang) * o.r, o.p.z + Math.cos(o.ang) * o.r], i * 3); this.a[i] = Math.min(1, k * 5) * (1 - k) * o.a; this.size[i] = o.s * (1 + k * 2.5); }
      g.attributes.position.needsUpdate = g.attributes.aA.needsUpdate = g.attributes.size.needsUpdate = true; };
  }
  const puffTex = ctex(cnv(128, 128, (x) => { for (let i = 0; i < 26; i++) { const r = 14 + rnd() * 30, cx = 64 + (rnd() - 0.5) * 50, cy = 64 + (rnd() - 0.5) * 50; const g = x.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, 'rgba(255,255,255,.22)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); } const g = x.createRadialGradient(64, 64, 30, 64, 64, 64); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,1)'); x.globalCompositeOperation = 'destination-out'; x.fillStyle = g; x.fillRect(0, 0, 128, 128); }), false);
  const vort = new Particles(mobile ? 260 : 700, puffTex); S.add(vort.pts);
  const snowU = { uT: { value: 0 }, uCam: { value: V(0, 0, 0) }, uScale: lpScale, uA: { value: 0 } };
  const snowfall = (() => { const N = mobile ? 1400 : 4500, sp = new Float32Array(N * 3), sr = new Float32Array(N); for (let i = 0; i < N; i++) { sp.set([rnd() * 80 - 40, rnd() * 40 - 20, rnd() * 80 - 40], i * 3); sr[i] = rnd(); }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(sp, 3)); g.setAttribute('aR', new T.BufferAttribute(sr, 1));
    const m = new T.ShaderMaterial({ uniforms: snowU, transparent: true, depthWrite: false,
      vertexShader: LOGV + 'attribute float aR; uniform float uT, uScale, uA; uniform vec3 uCam; varying float vA; void main(){ vec3 b = vec3(80.0, 40.0, 80.0); vec3 p = position + vec3(uT*1.4 + sin(uT*0.4 + aR*20.0)*1.5, -uT*(1.0 + aR*0.8), uT*0.5); p = mod(p - uCam + b*0.5, b) - b*0.5 + uCam; vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_PointSize = (0.05 + aR*0.07) * uScale / -mv.z; vA = uA * (0.3 + aR*0.5) * smoothstep(40.0, 3.0, -mv.z) * smoothstep(0.3, 1.5, -mv.z); gl_Position = projectionMatrix * mv;\n#include <logdepthbuf_vertex>\n}',
      fragmentShader: LOGF + 'varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; gl_FragColor = vec4(vec3(0.9, 0.94, 1.0), vA * smoothstep(0.5, 0.1, d));\n#include <logdepthbuf_fragment>\n}' });
    const s = new T.Points(g, m); s.frustumCulled = false; s.renderOrder = 63; S.add(s); return s; })();

  // ================= textures from Poly Haven (CC0) =================
  loads.push(Promise.all([ltex('assets/textures/snow_field_aerial_diff.jpg', true), ltex('assets/textures/snow_field_aerial_nor_gl.jpg'), ltex('assets/textures/asphalt_snow_diff.jpg', true), ltex('assets/textures/asphalt_snow_nor_gl.jpg'), ltex('assets/textures/asphalt_snow_rough.jpg')]).then(([sd, sn, ad, an, ar]) => {
    if (sd) { gMat.map = sd; gMat.normalMap = sn; sd.repeat.set(160000 / 55, 160000 / 55); gMat.needsUpdate = true; }
    if (ad) { rwMat.map = ad; rwMat.normalMap = an; rwMat.roughnessMap = ar; ad.repeat.set(3080 / 14, 62 / 14); rwMat.needsUpdate = true; taxM.map = ad; taxM.normalMap = an; taxM.needsUpdate = true; }
  }));
  buildTower();

  // ================= the story: plane, shots, captions, radio =================
  const XK = [[0, -42000], [0.19, -33600], [0.19001, -8600], [0.24, -7650], [0.30, -6000], [0.36, -4800], [0.45, -3450], [0.53, -2700], [0.64, -2250], [0.745, -1900], [0.80, -1600], [0.88, -650], [0.955, 2500], [1.0, 3500]];
  const XG = -1900, YG = gsY(XG);
  const planeAt = (p, t) => {
    const x = FK.lin(XK, p); let y, pitch, gear = 1, n1 = 0.42, kt = 140, ga = false, app = true;
    if (p < 0.19001) { y = 2500 - ss(0.1, 0.19, p) * 1250; pitch = 1.5 - ss(0.1, 0.13, p) * 4.5; gear = 0; n1 = 0.36; kt = 250 - ss(0.1, 0.19, p) * 60; app = false; }
    else if (p < 0.745) { y = gsY(x); pitch = 2.6; }
    else { const d = Math.max(0, x - XG); y = YG + d * 0.1 * ss(0, 600, d); pitch = lerp(2.6, 15, ss(0.745, 0.8, p)) - ss(0.88, 0.95, p) * 4; gear = 1 - ss(0.835, 0.865, p); n1 = lerp(0.42, 0.98, ss(0.745, 0.785, p)); kt = 140 + ss(0.76, 0.9, p) * 18; ga = true; }
    const roll = Math.sin(t * 0.37) * 0.7 + Math.sin(t * 1.1) * 0.3;
    return { x, y, z: 0, pitch, roll, gear, n1, kt, ga, app, ft: y * 3.281, nm: Math.max(0, (0 - x) / 1852) };
  };
  const CH = [[0, '01', 'Cruise'], [0.11, '02', 'Descent'], [0.235, '03', 'Runway 27'], [0.36, '04', 'Final'], [0.45, '05', 'The flock'], [0.53, '06', 'Detection'], [0.64, '07', 'The tower'], [0.8, '08', 'Go around']];
  const CAPS = [
    [0.004, 0.075, 'Sky Sentry', 'A dramatization. Scroll to fly the approach.', 'mid'],
    [0.12, 0.17, 'Into the weather.', 'Descending through the overcast toward runway 27.'],
    [0.252, 0.295, 'Runway 27.', 'Breakout below the clouds. The approach lights run toward the threshold.'],
    [0.38, 0.435, 'Final approach.', 'A 3° glideslope at about 140 knots.'],
    [0.455, 0.5, 'It isn’t alone.', 'A flock of geese is drifting across the approach path. A drone hangs by the fence.'],
    [0.548, 0.6, 'The camera sees them.', 'A phone on a tripod streams frames to the server. Every bird gets a box, an ID and a track.'],
    [0.603, 0.637, 'Risk climbs.', 'Green, then yellow, then red.'],
    [0.645, 0.69, 'The tower hears it.', 'A spoken alert in about half a second, an incident report, and the drone report stamped on Solana.'],
    [0.815, 0.87, 'Go around.', 'The crew climbs away. The flock passes beneath.'],
    [0.965, 1.01, 'Sky Sentry', 'Built for the seconds that matter.', 'mid ink'],
  ];
  const LINES = [
    [0.15, 0.2, 'PILOT · SKYLINE 902 HEAVY', 'Tower, Skyline 902 heavy, eight miles final, runway 27.', 's01', 'radio'],
    [0.255, 0.31, 'TOWER', 'Skyline 902 heavy, wind 270 at 8, runway 27, cleared to land.', 's02', 'radio'],
    [0.655, 0.685, 'SKY SENTRY', 'Bird activity on final approach. Risk high.', 's03', 'alert'],
    [0.69, 0.722, 'TOWER', 'Skyline 902 heavy, go around, birds on final.', 's04', 'tower'],
    [0.724, 0.756, 'PILOT · SKYLINE 902 HEAVY', 'Going around, Skyline 902 heavy.', 's05', 'radio'],
    [0.8, 0.835, 'CAPTAIN', 'Go around. Flaps twenty. Positive rate, gear up.', 's06', 'cabin'],
  ];
  const CUTS = [0.30, 0.36, 0.45, 0.50, 0.53, 0.64, 0.80, 0.88];
  const REPORT = [
    ['TIME', '06:41:12 local · CAM 02 · RWY 27 final'],
    ['SEEN', 'Flock of about 60 Canada geese crossing the approach path at 250 to 300 ft, 1.1 km from the threshold. One quadcopter drone holding at 70 ft near the east perimeter fence.'],
    ['RISK', 'HIGH. Birds inside the approach corridor; Skyline 902 heavy on a 4 NM final.'],
    ['ACTION', 'Go-around issued 06:41:19. Runway inspection and wildlife unit requested.'],
  ];
  const repText = REPORT.map(([k, v]) => k.padEnd(7) + v).join('\n');
  const HASH = '7f3c9a12e4b8d05c61a9f2e7b3d4c8a016e5f9b2c7d3a8e41f0b6c9d2e7a5b13';

  const CKP = V(-0.82, 0.13, 0); // the observer's eye in the cockpit, behind and between the pilots
  const towerLocal = (x, y, z) => grp.tower.localToWorld(V(x, y, z));
  const _cp = V(0, 0, 0), _cl = V(0, 0, 0), _cq = new T.Quaternion();
  function shot(p, t, ps) {
    const pp = PL.position, sh = (a, b) => clamp((p - a) / (b - a), 0, 1), fl = flockC(p, V(0, 0, 0));
    const port = W / H < 0.9;
    // cockpit: 0 to 0.30 and 0.88 to the end
    if (p < 0.30 || p >= 0.88) {
      const k = p < 0.30 ? p : (p - 0.88) * 3;
      const rig = ck.rig; const eye = CKP.clone(); eye.x += ss(0, 0.11, p) * 0.12 * (p < 0.30 ? 1 : 0);
      const cloudShake = inCloud * 0.004; eye.y += (Math.sin(t * 13.1) + Math.sin(t * 7.3)) * cloudShake; eye.z += Math.sin(t * 9.7) * cloudShake + (port ? Math.sin(p * 40) * 0.12 : 0);
      rig.position.copy(eye); rig.rotation.set(0, -Math.PI / 2 + Math.sin(k * 6.0) * 0.03 + (port ? Math.sin(p * 40) * 0.12 : 0), 0, 'YXZ'); rig.rotateX((p >= 0.88 ? -2 : -7.5) * DEG + Math.sin(t * 0.4) * 0.004);
      rig.updateMatrixWorld(true); rig.getWorldPosition(_cp); rig.getWorldQuaternion(_cq);
      return { mode: 'cockpit', pos: _cp.clone(), quat: _cq.clone(), fov: port ? 74 : 54 };
    }
    if (p < 0.36) { const k = sh(0.30, 0.36); return { mode: 'ext', pos: V(pp.x + lerp(-160, 120, k), pp.y - 28, -330), look: V(pp.x + 40, pp.y + 2, 0), fov: port ? 46 : 30 }; }
    if (p < 0.45) { const k = sh(0.36, 0.45), a = lerp(-2.55, -3.55, k); return { mode: 'ext', pos: V(pp.x + Math.cos(a) * 78, pp.y + 11 - k * 3, Math.sin(a) * 78 * 0.8), look: V(pp.x + 70, pp.y - 3, 0), fov: port ? 52 : 34 }; }
    if (p < 0.50) { const k = sh(0.45, 0.50); return { mode: 'ext', pos: V(fl.x + 95 - k * 25, fl.y - 6, fl.z + 26 - k * 20), look: V(fl.x - 10, fl.y + 2, fl.z), fov: port ? 40 : 26 }; }
    if (p < 0.53) { const k = sh(0.50, 0.53), a = lerp(0.9, 1.5, k), d = drone.position; return { mode: 'ext', pos: V(d.x + Math.cos(a) * 4.2, d.y + 0.6, d.z + Math.sin(a) * 4.2), look: V(d.x, d.y, d.z), fov: port ? 50 : 34 }; }
    if (p < 0.545) { const k = sh(0.53, 0.545); return { mode: 'ext', pos: V(SENT.x + 1.3 - k * 0.5, 1.6, SENT.z + 0.35), look: V(SENT.x - 3, 1.5 + k * 0.2, SENT.z), fov: port ? 56 : 40 }; }
    if (p < 0.64) { sentAim(p); return { mode: 'sentry', pos: sentCam.position.clone(), quat: sentCam.quaternion.clone(), fov: sentCam.fov * (port ? 1.6 : 1) }; }
    if (p < 0.80) {
      const k1 = ss(0.64, 0.70, p), k2 = ss(0.70, 0.745, p), k3 = ss(0.755, 0.80, p);
      let pos = towerLocal(lerp(1.6, 0.9, k1), CAB + lerp(1.85, 1.7, k1), lerp(-2.0, -2.7, k1)), look = towerLocal(lerp(-0.4, -0.3, k1), CAB + 1.15, -7.5);
      if (k2 > 0) { pos.lerp(towerLocal(0.22, CAB + 1.42, -4.78), k2); look.lerp(towerLocal(-0.05, CAB + 1.16, -5.72), k2); }
      if (k3 > 0) { pos.lerp(towerLocal(0.9, CAB + 1.75, -3.3), k3); look.lerp(pp.clone(), k3); }
      return { mode: 'tower', pos, look, fov: port ? lerp(62, 50, k2) : lerp(46, 34, k2) };
    }
    // go-around: low beside the flock, the airliner climbs overhead
    const k = sh(0.80, 0.88); const cam = V(-1060, 52, -70);
    const d = cam.distanceTo(pp); return { mode: 'ext', pos: cam, look: V(lerp(pp.x, fl.x, 0.15), lerp(pp.y, fl.y, 0.15), lerp(pp.z, fl.z, 0.15)), fov: port ? 60 : 42, shake: Math.exp(-Math.pow(d / 260, 2)) * 1.0 };
  }
  const sentAim = (p) => { const fl = flockC(p, V(0, 0, 0)); sentCam.position.copy(SENT); const k = ss(0.545, 0.64, p); sentCam.lookAt(lerp(-1500, fl.x, 0.55), lerp(150, fl.y, 0.7), lerp(-30, fl.z, 0.35)); sentCam.fov = lerp(27, 21, k); sentCam.aspect = W / H; sentCam.updateProjectionMatrix(); };

  // ================= sentry overlay (2D canvas over the camera's view) =================
  const ox = ovl.getContext('2d');
  const _pv = V(0, 0, 0);
  const proj = (v, cam) => { _pv.copy(v).project(cam); return { x: (_pv.x + 1) / 2 * W, y: (1 - _pv.y) / 2 * H, ok: _pv.z < 1 && _pv.z > -1 }; };
  function drawSentry(p, t, cam, a) {
    const pr = ovl.width / W; ox.setTransform(pr, 0, 0, pr, 0, 0); ox.clearRect(0, 0, W, H); if (a <= 0) return;
    ox.globalAlpha = a; ox.lineCap = 'round';
    const k = ss(0.548, 0.64, p), risk = clamp(0.12 + ss(0.56, 0.635, p) * 0.86, 0, 1);
    // approach corridor: glideslope tube projected over the footage
    ox.strokeStyle = 'rgba(169,203,227,.85)'; ox.fillStyle = 'rgba(47,111,228,.10)'; ox.lineWidth = 1.2;
    const edge = (zs, ys) => { ox.beginPath(); let first = true; for (let x = 0; x >= -3600; x -= 150) { const s = proj(V(x, gsY(x) + ys, zs), cam); if (!s.ok) continue; first ? ox.moveTo(s.x, s.y) : ox.lineTo(s.x, s.y); first = false; } ox.stroke(); };
    ox.setLineDash([6, 6]); for (const zs of [-150, 150]) for (const ys of [-45, 45]) edge(zs, ys); ox.setLineDash([]);
    ox.font = '500 10.5px "Geist Mono", monospace';
    for (const x of [-500, -1000, -1500, -2000, -3000]) { const c = [[-150, -45], [150, -45], [150, 45], [-150, 45]].map(([z, y]) => proj(V(x, gsY(x) + y, z), cam)); if (c.some((s) => !s.ok)) continue; ox.beginPath(); c.forEach((s, i) => i ? ox.lineTo(s.x, s.y) : ox.moveTo(s.x, s.y)); ox.closePath(); ox.fill(); ox.stroke(); ox.fillStyle = 'rgba(234,242,248,.85)'; ox.fillText(-x >= 1000 ? (-x / 1000) + ' KM' : (-x) + ' M', c[1].x + 6, c[1].y); ox.fillStyle = 'rgba(47,111,228,.10)'; }
    // birds: lock brackets, IDs, tracks
    let shown = 0, nearest = 1e9;
    for (let i = 0; i < NB; i++) {
      const on = ss(0.55 + (i % 20) * 0.0016, 0.556 + (i % 20) * 0.0016, p); if (on <= 0) continue;
      const s = proj(birdNow[i], cam); if (!s.ok || s.x < -20 || s.x > W + 20 || s.y < -20 || s.y > H + 20) continue; shown++;
      const dist = cam.position.distanceTo(birdNow[i]), px = Math.max(9, 1.7 / dist * H / (2 * Math.tan(cam.fov * DEG / 2)));
      const b = px * (1 + (1 - on) * 2.5), x0 = s.x - b, y0 = s.y - b * 0.8, w2 = b * 2, h2 = b * 1.6, c = Math.min(8, b * 0.6);
      nearest = Math.min(nearest, Math.abs(birdNow[i].z));
      ox.strokeStyle = SIGNAL; ox.lineWidth = 1.6; ox.beginPath();
      ox.moveTo(x0, y0 + c); ox.lineTo(x0, y0); ox.lineTo(x0 + c, y0); ox.moveTo(x0 + w2 - c, y0); ox.lineTo(x0 + w2, y0); ox.lineTo(x0 + w2, y0 + c);
      ox.moveTo(x0 + w2, y0 + h2 - c); ox.lineTo(x0 + w2, y0 + h2); ox.lineTo(x0 + w2 - c, y0 + h2); ox.moveTo(x0 + c, y0 + h2); ox.lineTo(x0, y0 + h2); ox.lineTo(x0, y0 + h2 - c); ox.stroke();
      // track: where this bird was over the last few seconds
      ox.strokeStyle = 'rgba(47,111,228,.75)'; ox.lineWidth = 1; ox.beginPath(); let trStarted = false;
      for (let j = 0; j <= 7; j++) { birdPos(i, p - j * 0.0035, lt - j * 0.4, _v3); const q2 = proj(_v3, cam); if (!q2.ok) { trStarted = false; continue; } trStarted ? ox.lineTo(q2.x, q2.y) : ox.moveTo(q2.x, q2.y); trStarted = true; } ox.stroke();
      if (i % 4 === 0 || W > 900 && i % 2 === 0) { ox.fillStyle = SIGNAL; const lab = 'B-' + String(i + 1).padStart(2, '0'); const tw = ox.measureText(lab).width + 8; ox.fillRect(x0, y0 - 14, tw, 13); ox.fillStyle = '#fff'; ox.fillText(lab, x0 + 4, y0 - 4); }
    }
    // drone
    { const s = proj(drone.position, cam); if (s.ok && p > 0.575) { const b = 16; ox.strokeStyle = '#fff'; ox.lineWidth = 1.6; ox.strokeRect(s.x - b, s.y - b * 0.7, b * 2, b * 1.4); ox.fillStyle = '#fff'; ox.fillRect(s.x - b, s.y - b * 0.7 - 15, 76, 14); ox.fillStyle = '#0F1B26'; ox.fillText('DRONE D-01', s.x - b + 4, s.y - b * 0.7 - 4); } }
    // HUD frame
    ox.fillStyle = 'rgba(234,242,248,.92)'; ox.font = '600 12px "Geist Mono", monospace';
    const top = mobile ? 76 : 92, L0 = mobile ? 16 : 32;
    ox.fillText('SKY SENTRY · CAM 02 · RWY 27 FINAL', L0, top + 34); ox.font = '500 11px "Geist Mono", monospace';
    ox.fillStyle = Math.sin(t * 6) > 0 ? '#ff3b30' : 'rgba(255,59,48,.3)'; ox.beginPath(); ox.arc(L0 + 5, top + 52, 4, 0, 7); ox.fill(); ox.fillStyle = 'rgba(234,242,248,.8)';
    ox.fillText('LIVE  06:41:' + String(8 + Math.floor(k * 10)).padStart(2, '0') + '  ·  ' + shown + ' BIRDS  ·  1 DRONE', L0 + 16, top + 56);
    // risk meter
    const mw = Math.min(280, W - L0 * 2 - 24), mx = mobile ? L0 + 12 : W - mw - 40, my = mobile ? top + 82 : top + 26;
    ox.fillStyle = 'rgba(8,13,19,.6)'; ox.fillRect(mx - 12, my - 10, mw + 24, 70);
    ox.fillStyle = 'rgba(234,242,248,.8)'; ox.fillText('RUNWAY RISK', mx, my + 6);
    const lvl = risk > 0.66 ? 'HIGH' : risk > 0.36 ? 'ELEVATED' : 'LOW', lc = risk > 0.66 ? '#ff3b30' : risk > 0.36 ? '#ffc23d' : '#3ddc84';
    ox.fillStyle = lc; ox.font = '600 12px "Geist Mono", monospace'; ox.textAlign = 'right'; ox.fillText(lvl, mx + mw, my + 6); ox.textAlign = 'left';
    const segs = 24; for (let i = 0; i < segs; i++) { const f = i / segs, on2 = f < risk; ox.fillStyle = on2 ? (f > 0.66 ? '#ff3b30' : f > 0.36 ? '#ffc23d' : '#3ddc84') : 'rgba(255,255,255,.12)'; ox.fillRect(mx + i * (mw / segs), my + 18, mw / segs - 2, 12); }
    ox.font = '500 10.5px "Geist Mono", monospace'; ox.fillStyle = 'rgba(234,242,248,.7)'; ox.fillText('CLOSEST TO CENTRELINE ' + Math.round(nearest < 1e8 ? nearest : 0) + ' M', mx, my + 48);
    ox.globalAlpha = 1;
  }

  // ================= sound: spatial engines and voices (off until the visitor turns it on) =================
  const AU = { ready: false, loading: false, buf: {}, eng: [], voice: null };
  const AFILES = ['engine', 'wind', 'alarm', 's01', 's02', 's03', 's04', 's05', 's06'];
  function initAudio() {
    if (AU.loading) return; const ac = S0.ensureAudio(); if (!ac) return; AU.loading = true; AU.ac = ac;
    AU.out = ac.createGain(); AU.out.gain.value = 1; AU.out.connect(S0.master);
    Promise.all(AFILES.map((k) => fetch('assets/audio/' + k + '.mp3').then((r) => r.arrayBuffer()).then((b) => ac.decodeAudioData(b)).then((d) => { AU.buf[k] = d; }).catch(() => {}))).then(() => {
      const pan = () => { const pn = ac.createPanner(); pn.panningModel = 'HRTF'; pn.distanceModel = 'inverse'; pn.refDistance = 18; pn.maxDistance = 20000; pn.rolloffFactor = 1; return pn; };
      AU.engLP = ac.createBiquadFilter(); AU.engLP.type = 'lowpass'; AU.engLP.frequency.value = 2000; AU.engBus = ac.createGain(); AU.engBus.gain.value = 0; AU.engLP.connect(AU.engBus); AU.engBus.connect(AU.out);
      if (AU.buf.engine) for (let i = 0; i < 4; i++) { const s = ac.createBufferSource(); s.buffer = AU.buf.engine; s.loop = true; s.loopStart = 0.2; s.detune.value = (i - 1.5) * 18; const pn = pan(); s.connect(pn); pn.connect(AU.engLP); s.start(0, i * 1.7); AU.eng.push({ s, pn }); }
      const loop = (k, g) => { if (!AU.buf[k]) return null; const s = ac.createBufferSource(); s.buffer = AU.buf[k]; s.loop = true; const gn = ac.createGain(); gn.gain.value = 0; s.connect(gn); gn.connect(g || AU.out); s.start(); return gn; };
      AU.wind = loop('wind'); AU.alarmPan = pan(); AU.alarmPan.connect(AU.out); AU.alarm = loop('alarm', AU.alarmPan);
      AU.ready = true;
    });
  }
  const _ap = V(0, 0, 0);
  const setPan = (pn, world) => { _ap.copy(world).applyMatrix4(C.matrixWorldInverse); const ct = AU.ac.currentTime; if (pn.positionX) { pn.positionX.setTargetAtTime(_ap.x, ct, 0.05); pn.positionY.setTargetAtTime(_ap.y, ct, 0.05); pn.positionZ.setTargetAtTime(_ap.z, ct, 0.05); } else pn.setPosition(_ap.x, _ap.y, _ap.z); };
  const voiceSrc = (kind, mode) => {
    if (mode === 'tower') return kind === 'alert' ? towerLocal(Math.sin(0.27) * 5.4, CAB + 1.1, -Math.cos(0.27) * 5.4) : towerLocal(0.6, CAB + 1.0, -5.2);
    if (mode === 'cockpit') return C.localToWorld(V(kind === 'cabin' ? 0.6 : -0.25, -0.1, kind === 'cabin' ? -1.2 : -0.3));
    return C.localToWorld(V(-0.6, -0.2, -0.8));
  };
  function playVoice(L, mode) {
    if (!AU.ready || !AU.buf[L[4]]) return; const ac = AU.ac;
    if (AU.voice) { try { AU.voice.s.stop(); } catch (e) {} }
    const s = ac.createBufferSource(); s.buffer = AU.buf[L[4]]; const pn = ac.createPanner(); pn.panningModel = 'HRTF'; pn.distanceModel = 'inverse'; pn.refDistance = 1.2; pn.rolloffFactor = 0.6;
    const g = ac.createGain(); g.gain.value = L[5] === 'alert' ? 1.3 : 1.1; s.connect(pn); pn.connect(g); g.connect(AU.out); s.start();
    AU.voice = { s, pn, kind: L[5] }; s.onended = () => { if (AU.voice && AU.voice.s === s) AU.voice = null; };
    setPan(pn, voiceSrc(L[5], mode));
  }
  document.addEventListener('site:sound', (e) => { if (e.detail) initAudio(); hp.setAttribute('aria-pressed', e.detail ? 'true' : 'false'); hp.querySelector('span').textContent = e.detail ? 'Sound on · headphones' : 'Best with headphones'; });
  const hp = document.querySelector('[data-hp]'); hp.addEventListener('click', () => S0.setSound(!S0.soundOn));

  // ================= DOM overlays =================
  const $ = (s) => stage.querySelector(s);
  const D = { chN: $('[data-ch-n]'), ch: $('[data-ch]'), chap: $('.chapter'), cap: $('.cap'), capT: $('[data-cap-t]'), capL: $('[data-cap-l]'), subs: $('.subs'), who: $('[data-who]'), line: $('[data-line]'),
    tele: $('.tele'), ta: $('[data-tl=a]'), tb: $('[data-tl=b]'), tc: $('[data-tl=c]'), rep: $('.report'), repPre: $('[data-rep]'), stamp: $('[data-stamp]'), hash: $('[data-hash]'), bar: $('.progress i'), load: $('.loading'), warn: $('.warn') };
  D.hash.textContent = HASH;
  let capKey = -2, subKey = -2, chKey = -2, repLen = -1, stampOn = null, teleOn = null;
  function updateDOM(p, st, sh) {
    D.bar.style.transform = `scaleX(${p.toFixed(4)})`;
    const ch = CH.filter((c) => p >= c[0]).pop(); if (ch && ch[0] !== chKey) { chKey = ch[0]; D.chN.textContent = ch[1] + ' / 08'; D.ch.textContent = ch[2]; }
    const cp = CAPS.find((c) => p >= c[0] && p < c[1]), ck2 = cp ? cp[0] : -1;
    if (ck2 !== capKey) { capKey = ck2; D.cap.classList.remove('on'); if (cp) { D.capT.textContent = cp[2]; D.capL.textContent = cp[3]; D.cap.className = 'cap ' + (cp[4] || ''); void D.cap.offsetWidth; D.cap.classList.add('on'); } }
    const ln = LINES.find((l) => p >= l[0] && p < l[1]), lk = ln ? ln[0] : -1;
    if (lk !== subKey) { subKey = lk; D.subs.classList.toggle('on', !!ln); if (ln) { D.who.textContent = ln[2]; D.line.textContent = ln[3]; D.who.className = 'who' + (ln[5] === 'alert' ? ' alert' : ''); if (S0.soundOn && p > lastP && p - ln[0] < 0.02) playVoice(ln, sh.mode); } }
    const tOn = sh.mode === 'ext' && p > 0.3 && p < 0.53 || sh.mode === 'cockpit' && p > 0.24 && p < 0.3;
    if (tOn !== teleOn) { teleOn = tOn; D.tele.classList.toggle('on', tOn); }
    if (tOn) { D.ta.textContent = 'SKY902 · B747 · RWY 27'; D.tb.textContent = `ALT ${Math.round(st.ft / 10) * 10} FT · ${Math.round(st.kt)} KT`; D.tc.textContent = `G/S 3.0° · ${st.nm.toFixed(1)} NM`; }
    const rk = p > 0.69 && p < 0.80; D.rep.classList.toggle('on', rk);
    const n = Math.round(repText.length * ss(0.695, 0.755, p)); if (n !== repLen) { repLen = n; const s = repText.slice(0, n); D.repPre.innerHTML = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/^(\w+)/gm, '<span class="k">$1</span>') + (n < repText.length ? '<span class="caret"></span>' : ''); }
    const so = p > 0.762; if (so !== stampOn) { stampOn = so; D.stamp.classList.toggle('on', so); }
  }

  // ================= monitors in the tower =================
  let vmap = null;
  function drawScreens(t, st) {
    const sc = screens; if (!sc.radar) return;
    if (!vmap) { const r = FK.rng(3); vmap = []; for (let k = 0; k < 9; k++) { const pts = []; let x = r() * 2 - 1, y = r() * 2 - 1; for (let i = 0; i < 7; i++) { pts.push([x, y]); x += (r() - 0.5) * 0.5; y += (r() - 0.5) * 0.5; } vmap.push(pts); } }
    for (const k of ['radar', 'radar2']) {
      const { c, x, t: tex } = sc[k], w = c.width, h = c.height, cx = w / 2, cy = h / 2, R0 = Math.min(w, h) * 0.48, zoom = k === 'radar' ? 1 : 0.6;
      x.fillStyle = '#020304'; x.fillRect(0, 0, w, h);
      x.strokeStyle = 'rgba(90,110,130,.35)'; x.lineWidth = 1; vmap.forEach((pl) => { x.beginPath(); pl.forEach(([px, py], i) => { const X = cx + px * R0 * zoom * 1.3, Y = cy + py * R0 * zoom * 1.3; i ? x.lineTo(X, Y) : x.moveTo(X, Y); }); x.stroke(); });
      x.setLineDash([2, 5]); x.strokeStyle = 'rgba(120,140,160,.25)'; for (let i = 1; i <= 5; i++) { x.beginPath(); x.arc(cx, cy, R0 * i / 5, 0, 7); x.stroke(); } x.setLineDash([]);
      x.strokeStyle = 'rgba(200,210,220,.7)'; x.lineWidth = 2; x.beginPath(); x.moveTo(cx - 14 * zoom, cy - 3); x.lineTo(cx + 18 * zoom, cy - 3); x.stroke();
      const ac = [[0.16 + (st.nm / 12) * 0.5, Math.PI, 0, 0, 'SKY902', (st.ga ? '0' : '0') + String(Math.round(st.ft / 100)).padStart(2, '0') + ' B74S', '#e8f0e8'], [0.45, 2.2, 0.22, 1, 'DAL118', '031 A321', '#d6f5d6'], [0.62, 4.0, -0.15, 1, 'N512RT', '014 C172', '#d6f5d6'], [0.85, 5.3, 0.3, 1, 'AAL2201', '068 B738', '#9fe0ff']];
      x.font = '600 11px ui-monospace, Menlo, monospace';
      ac.forEach(([rr, ang, vel, mv, cs, alt, col]) => { const a2 = ang + (mv ? t * 0.004 * (1 + vel) : 0); const X = cx + Math.cos(a2) * R0 * rr * zoom, Y = cy + Math.sin(a2) * R0 * rr * zoom;
        x.fillStyle = col; x.fillRect(X - 3, Y - 3, 6, 6); x.strokeStyle = 'rgba(200,220,200,.6)'; x.beginPath(); x.moveTo(X + 4, Y - 4); x.lineTo(X + 16, Y - 16); x.stroke(); x.fillText(cs, X + 18, Y - 18); x.fillText(alt, X + 18, Y - 5); });
      if (st.alert > 0 && k === 'radar') { const on = Math.sin(t * 12) > -0.2; x.strokeStyle = on ? '#ff3b30' : 'rgba(255,59,48,.3)'; x.lineWidth = 2; x.strokeRect(cx - R0 * 0.3 - 18, cy - 14, 36, 24); x.fillStyle = on ? '#ff3b30' : 'rgba(255,59,48,.4)'; x.fillText('BIRDS', cx - R0 * 0.3 - 16, cy - 20); }
      x.fillStyle = '#7f8b99'; x.font = '500 10px ui-monospace, Menlo, monospace'; x.fillText('KSKY  1141Z  ALT 3002  RWY 27', 8, h - 8); tex.needsUpdate = true;
    }
    { const { c, x, t: tex } = sc.strips, w = c.width, h = c.height; x.fillStyle = '#0d1117'; x.fillRect(0, 0, w, h);
      const rows = [['SKY902', 'B74S/H', 'RWY 27', st.ga ? 'GO AROUND' : 'CLRD LAND'], ['DAL118', 'A321/M', 'TWY B', 'HOLD'], ['N512RT', 'C172/L', 'RWY 27', 'PATTERN'], ['UAL77', 'B789/H', 'GATE 14', 'PUSH']];
      rows.forEach((r, i) => { const y = 10 + i * (h - 14) / 4, hh = (h - 14) / 4 - 6; x.fillStyle = i === 0 ? (st.alert > 0 ? '#5a1410' : '#1d2a1e') : '#161b22'; x.fillRect(8, y, w - 16, hh); x.fillStyle = i === 0 ? '#ffffff' : '#a9b4c2'; mono(x, 17, 600); x.fillText(r[0], 18, y + hh * 0.62); mono(x, 13); x.fillText(r[1], w * 0.36, y + hh * 0.62); x.fillText(r[2], w * 0.58, y + hh * 0.62); x.fillStyle = i === 0 ? (st.alert > 0 ? '#ff6a5a' : '#7dffa0') : '#7f8a99'; x.fillText(r[3], w * 0.76, y + hh * 0.62); });
      tex.needsUpdate = true; }
    { const { c, x, t: tex } = sc.adsb, w = c.width, h = c.height; x.fillStyle = '#05080d'; x.fillRect(0, 0, w, h); mono(x, 12); x.fillStyle = '#6f8bab'; x.fillText('ADS-B  CALLSIGN  ALT    GS   HDG', 12, 22);
      const Lr = [['SKY902', String(Math.round(st.ft)), String(Math.round(st.kt)), '270'], ['N512RT', '1400', '092', '180'], ['UAL77', '000', '000', '090'], ['AAL2201', '6800', '231', '045'], ['DAL118', '000', '012', '360']];
      Lr.forEach((r, i) => { x.fillStyle = i === 0 ? '#eaf2ff' : '#9fb3c8'; x.fillText(`${String(i + 1).padStart(2, '0')}     ${r[0].padEnd(9)}${r[1].padStart(5)}  ${r[2]}  ${r[3]}`, 12, 46 + i * 20); }); tex.needsUpdate = true; }
    { const { c, x, t: tex } = sc.alert, w = c.width, h = c.height, A = st.alert, on = A > 0 && Math.sin(t * 11) > -0.3; x.fillStyle = A > 0 ? (on ? '#7a1410' : '#2a0806') : '#0a0d12'; x.fillRect(0, 0, w, h);
      mono(x, 15, 600); x.fillStyle = '#fff'; x.fillText('SKY SENTRY ALERT', 14, 30); mono(x, 34, 700); x.fillStyle = A > 0 ? '#fff' : '#3ddc84'; x.fillText(A > 0 ? 'RISK HIGH' : 'RISK LOW', 14, h * 0.6); mono(x, 13); x.fillStyle = 'rgba(255,255,255,.75)'; x.fillText(A > 0 ? 'BIRDS ON FINAL · RWY 27' : 'MONITORING', 14, h * 0.85); tex.needsUpdate = true; }
    { const { c, x, t: tex } = sc.ground, w = c.width, h = c.height; x.fillStyle = '#0b0f0c'; x.fillRect(0, 0, w, h); const sx = (X) => 20 + (X + 3000) / 6300 * (w - 40), sz = (Z) => h * 0.5 + Z / 1500 * h;
      x.fillStyle = '#39424c'; x.fillRect(sx(0), sz(-22), sx(3000) - sx(0), 8); x.fillStyle = '#7dffa0'; x.beginPath(); x.arc(sx(PL.position.x), sz(0), 5, 0, 7); x.fill(); mono(x, 11); x.fillText('SKY902', sx(PL.position.x) + 8, sz(0) - 8);
      if (st.alert > 0) { x.fillStyle = `rgba(255,70,50,${0.6 + 0.4 * Math.sin(t * 12)})`; x.beginPath(); x.arc(sx(st.flock.x), sz(st.flock.z), 9, 0, 7); x.fill(); } tex.needsUpdate = true; }
    { const { c, x, t: tex } = sc.sentry, w = c.width, h = c.height, A = st.alert;
      x.fillStyle = '#06080c'; x.fillRect(0, 0, w, h); const fx = w * 0.045, fy = h * 0.14, fw = w * 0.635, fh = fw * 9 / 16; x.clearRect(fx, fy, fw, fh);
      const red = A > 0 && Math.sin(t * 11) > -0.3; x.strokeStyle = A > 0 ? (red ? '#ff3b30' : '#7a1d18') : '#2d3a4f'; x.lineWidth = A > 0 ? 8 : 3; x.strokeRect(4, 4, w - 8, h - 8);
      mono(x, 22, 700); x.fillStyle = '#fff'; x.fillText('SKY SENTRY', fx, h * 0.09); mono(x, 15); x.fillStyle = '#8fa0b8'; x.fillText('RWY 27 FINAL · CAM 02 · LIVE', fx + 190, h * 0.09);
      const H2 = sc.sentry.hud, hx = H2.x; hx.clearRect(0, 0, 640, 360); hx.strokeStyle = SIGNAL; hx.lineWidth = 2;
      for (let i = 0; i < NB; i += 1) { const s = birdNow[i].clone().project(sentCam); if (s.z < 1 && Math.abs(s.x) < 1 && Math.abs(s.y) < 1) { const bx = (s.x + 1) / 2 * 640, by = (1 - s.y) / 2 * 360; hx.strokeRect(bx - 6, by - 5, 12, 10); } }
      if (red) { hx.strokeStyle = '#ff3b30'; hx.lineWidth = 6; hx.strokeRect(3, 3, 634, 354); } H2.t.needsUpdate = true;
      const px = fx + fw + w * 0.03, pw = w - px - w * 0.04; mono(x, 14); x.fillStyle = '#8fa0b8'; x.fillText('OBJECTS', px, fy + 14); mono(x, 44, 700); x.fillStyle = '#fff'; x.fillText(String(NB + 1), px, fy + 62);
      mono(x, 14); x.fillStyle = '#8fa0b8'; x.fillText('RUNWAY RISK', px, fy + 100); const risk = st.risk; x.fillStyle = '#1b2230'; x.fillRect(px, fy + 110, pw, 16); x.fillStyle = risk > 0.66 ? '#ff3b30' : risk > 0.36 ? '#ffb02e' : '#3ddc84'; x.fillRect(px, fy + 110, pw * risk, 16);
      if (A > 0) { x.fillStyle = red ? '#ff3b30' : '#a1201a'; x.fillRect(0, h * 0.8, w, h * 0.2); mono(x, Math.round(h * 0.066), 800); x.fillStyle = '#fff'; x.fillText('BIRDS ON FINAL · RWY 27 · GO AROUND', w * 0.045, h * 0.92); }
      else { mono(x, 15); x.fillStyle = '#7dffa0'; x.fillText('● MONITORING', w * 0.045, h * 0.9); }
      tex.needsUpdate = true; }
  }

  // ================= backdrop for the sections after the film =================
  const after = Array.from(document.querySelectorAll('main > section.ice'));
  const backdropQ = () => { const a = after[0], b = after[after.length - 1]; if (!a) return 0; const top = a.getBoundingClientRect().top + scrollY, bot = b.getBoundingClientRect().bottom + scrollY; return clamp((scrollY + innerHeight * 0.5 - top) / Math.max(1, bot - top), 0, 1); };

  // ================= loop =================
  let forced = null, ps = 0, lastP = 0, lt = 0, last = 0, visible = true, frameN = 0, mode = null, useFrames = false, framePl = null;
  document.addEventListener('visibilitychange', () => { visible = !document.hidden; });
  const filmP = () => { const r = film.getBoundingClientRect(); return clamp(-r.top / Math.max(1, r.height - innerHeight), 0, 1); };
  let inCloud = 0;
  const mt = new T.Vector2(), mouse = new T.Vector2(); window.addEventListener('pointermove', (e) => mt.set(e.clientX / innerWidth * 2 - 1, e.clientY / innerHeight * 2 - 1), { passive: true });
  const cA = new T.Color(), cB = new T.Color();
  function setLook(sh) { C.position.copy(sh.pos); if (sh.quat) C.quaternion.copy(sh.quat); else C.lookAt(sh.look); }

  function frame(now) {
    requestAnimationFrame(frame);
    if (!visible) return;
    const dt = clamp((now - (last || now)) / 1000, 0.0005, 0.05); last = now; lt += dt; const t = lt;
    const rf = film.getBoundingClientRect(), filmOn = rf.bottom > innerHeight * 0.02;
    const p0 = forced != null ? forced : filmP();
    ps = forced != null ? p0 : ps + (p0 - ps) * (1 - Math.exp(-dt * 6)); if (Math.abs(p0 - ps) < 1e-5) ps = p0;
    const p = clamp(ps, 0, 1);
    govern(now);
    const back = forced == null && !filmOn;
    frameN++;
    // backdrop: lighter frame cadence when scroll is past the film
    if (back && (frameN % 2)) return;
    lpT.value = t; flockU.uT.value = t; cloudU.uT.value = t; snowU.uT.value = t; G.uT.value = t;
    const st = planeAt(p, t);
    PL.position.set(st.x, st.y, st.z); PL.rotation.set(0, 0, 0); body.rotation.set(st.roll * DEG, 0, st.pitch * DEG);
    rwU.uPlanePos.value.copy(PL.position);
    heatU.uN1.value = st.n1;
    if (plane.gear) { plane.gear.scale.y = Math.max(0.01, st.gear); plane.gear.visible = st.gear > 0.02; }
    updateFlock(p, t);
    drone.position.set(DRONE0.x + Math.sin(t * 0.3) * 2, DRONE0.y + Math.sin(t * 0.9) * 0.4, DRONE0.z + Math.cos(t * 0.25) * 1.5); drone.rotation.y = Math.sin(t * 0.2) * 0.4; dr.props.forEach((pr, i) => { pr.rotation.y += (i % 2 ? 1 : -1) * dt * 55; });
    dr.leds.forEach((l, i) => { l.visible = Math.sin(t * 6 + i) > -0.2; }); dr.strobe.visible = (t * 1.2) % 1 < 0.06;
    PL.updateMatrixWorld(true);
    let sh;
    if (back) { // above the clouds at sunrise, drifting with scroll
      const k = backdropQ();
      sh = { mode: 'back', pos: V(-30000 + k * 9000 + Math.sin(t * 0.05) * 60, 2350 - k * 500 + Math.sin(t * 0.13) * 8, -1500 + Math.sin(k * 3) * 800), fov: W / H < 0.9 ? 70 : 48 };
      sh.look = sh.pos.clone().add(V(1000, -110 - k * 80, -380 + Math.sin(t * 0.04) * 60));
    } else sh = shot(p, t, ps);
    const modeChanged = sh.mode !== mode;
    if (modeChanged) { mode = sh.mode; }
    setLook(sh);
    mouse.lerp(mt, 1 - Math.exp(-dt * 2)); if (sh.mode !== 'sentry') { C.rotateY(-mouse.x * 0.02); C.rotateX(-mouse.y * 0.014); }
    if (sh.shake) { const k = sh.shake; C.rotateX((Math.random() - 0.5) * 0.012 * k); C.rotateY((Math.random() - 0.5) * 0.012 * k); C.position.y += (Math.random() - 0.5) * 0.25 * k; }
    C.fov = sh.fov; C.near = sh.mode === 'cockpit' ? 0.04 : sh.mode === 'tower' ? 0.1 : 0.4; C.updateProjectionMatrix(); C.updateMatrixWorld(true);
    // visibility per shot
    const cockpit = sh.mode === 'cockpit', inTower = sh.mode === 'tower';
    if (plane.mesh) plane.mesh.visible = !cockpit; grp.cockpit.visible = cockpit;
    Object.values(plane.sprites).forEach((s) => { s.visible = !cockpit; });
    plane.cones.forEach((c) => { c.visible = !cockpit && !back; });
    plane.plumes.forEach((c) => { c.visible = !cockpit && !back; });
    // keep sun shadow frustum centered on the active hero subject; refresh shadow map on hero shots only
    const shCenter = inTower ? TWR : PL.position;
    sunL.target.position.copy(shCenter); sunL.target.updateMatrixWorld();
    sunL.position.copy(shCenter).addScaledVector(SUN, 900);
    if (!back && !cockpit && sh.mode !== 'sentry' && (modeChanged || frameN % 2 === 0)) R.shadowMap.needsUpdate = true;
    grp.airport.visible = grp.tower.visible = !back; grp.flock.visible = !back && p > 0.3; drone.visible = phoneG.visible = !back && p > 0.3 && p < 0.9; vort.pts.visible = !back;
    // atmosphere: above, inside or below the cloud deck
    const cy = C.position.y; const approach = C.position.x < 9000;
    inCloud = approach ? ss(CB - 25, CB + 140, cy) * (1 - ss(CTOP - 160, CTOP + 30, cy)) : 0;
    const above = cy > CTOP - 60;
    const pre = back ? 0 : 1 - ss(0.02, 0.2, p); // pre-dawn darkness fades as the descent begins
    setSun(back ? 7 : lerp(-1.2, 1.5, ss(0, 0.24, p)));
    starsU.uA.value = back ? 0 : above ? pre * 0.9 : 0; starsU.uScale.value = Math.min(window.devicePixelRatio || 1, 2) * q;
    S.environment = above ? envAbove : envBelow;
    if (above) { cA.setRGB(0.55, 0.6, 0.7); S.fog.color.copy(cA); S.fog.density = 0.000012; }
    else { cA.setRGB(0.6, 0.66, 0.74); cB.setRGB(0.86, 0.88, 0.9); S.fog.color.copy(cA).lerp(cB, inCloud); S.fog.density = lerp(0.00011, 0.012, Math.pow(inCloud, 1.5)); }
    cloudU.uFogD.value = S.fog.density; cloudU.uFogC.value.copy(S.fog.color); lpFog.value = S.fog.density;
    if (back) { cloudU.uLit.value.setRGB(1.0, 0.98, 0.97); cloudU.uShade.value.setRGB(0.6, 0.67, 0.78); cloudU.uSunC.value.setRGB(1.0, 0.85, 0.7); }
    else if (above) { cloudU.uLit.value.setRGB(0.78 + pre * -0.25, 0.6 - pre * 0.2, 0.55 - pre * 0.12); cloudU.uShade.value.setRGB(0.16, 0.19, 0.28); cloudU.uSunC.value.setRGB(1.0, 0.55, 0.3).multiplyScalar(1 - pre * 0.5); }
    else { cloudU.uLit.value.setRGB(0.62, 0.65, 0.72); cloudU.uShade.value.setRGB(0.36, 0.39, 0.46); cloudU.uSunC.value.setRGB(0.9, 0.55, 0.35); }
    hemi.intensity = back ? 1.2 : above ? 0.35 + (1 - pre) * 0.35 : 0.75; sunL.intensity = back ? 2 : above ? 0.8 * (1 - pre * 0.7) : 0.55;
    // render order of the cloud slices: far to near; cull upper slices during low ground/sentry/tower shots
    const lowShot = !back && !above && inCloud < 0.05 && cy < 260;
    slices.forEach((m, i) => {
      m.renderOrder = 10 + Math.round(2000 - Math.abs(cy - m.userData.y));
      m.visible = back ? m.userData.y > CB + 300 : lowShot ? i < 6 : true;
    });
    const below = !above && inCloud < 0.5; fieldLights.renderOrder = city.renderOrder = below ? 3000 : 2; snowfall.renderOrder = 3001;
    sky.position.copy(C.position); stars.position.copy(C.position);
    lpScale.value = H * R.getPixelRatio() / (2 * Math.tan(C.fov * DEG / 2));
    // airliner lights
    const sp = plane.sprites, dcam = C.position.distanceTo(PL.position), grow = Math.max(1, dcam / 300);
    const strobe = (t * 0.95) % 1, sOn = strobe < 0.05 || (strobe > 0.12 && strobe < 0.17);
    sp.strL.visible = sp.strR.visible = !cockpit && sOn; sp.bcn.visible = sp.bcn2.visible = !cockpit && Math.sin(t * 6.5) > 0.7;
    Object.values(sp).forEach((s) => s.scale.setScalar(s.userData.base * Math.min(grow, 40) * (s === sp.landL || s === sp.landR || s === sp.nose ? 1.4 : 1)));
    coneU.uMist.value = below ? 1 : 0.3; coneU.uI.value = 1;
    // wingtip vortices in the chase and the go-around
    if (!cockpit && !back && (p > 0.34 && p < 0.47 || p > 0.8 && p < 0.88)) for (const z of [-29.8, 29.8]) { const w = body.localToWorld(V(-4, 3.3, z)); vort.add({ p: w, age: 0, life: 2.6, ang: Math.random() * 6, r: 0.4 + Math.random() * 1.2, s: 1.4, a: 0.18 }); }
    vort.update(dt);
    // snow in the air near the ground
    snowU.uCam.value.copy(C.position); snowU.uA.value = !back && cy < 300 ? (inTower ? 0.5 : 1) : 0;
    // sentry state and grade
    const alert = p > 0.652 && p < 0.80 ? 1 : 0, risk = clamp(0.12 + ss(0.56, 0.635, p) * 0.86, 0, 1);
    if (towerFx.red) { towerFx.red.intensity = alert ? 3.2 * (Math.sin(t * 11) > -0.3 ? 1 : 0.2) : 0; towerFx.dome.material.color.setRGB(alert && Math.sin(t * 11) > -0.3 ? 4 : 0.25, 0.04, 0.03); }
    if (inTower && (modeChanged || forced != null || frameN % 3 === 0)) {
      drawScreens(t, { alert, risk, ga: st.ga, ft: st.ft, kt: st.kt, nm: st.nm, flock: flockC(p, V(0, 0, 0)) });
      sentAim(clamp(p, 0.6, 0.64)); grp.tower.visible = false; const fg = S.fog.density; R.setRenderTarget(feedRT); R.render(S, sentCam); R.setRenderTarget(null); grp.tower.visible = true; S.fog.density = fg;
    }
    if (cockpit && (modeChanged || forced != null || frameN % 4 === 0)) {
      const s2 = { pitch: st.pitch, roll: st.roll, kt: st.kt, ft: st.ft, hdg: 270 + Math.sin(t * 0.2) * 0.6, ga: st.ga, app: st.app, gsd: Math.sin(t * 0.5) * 0.15, nm: Math.max(0.3, st.nm), n1: st.n1, gear: st.gear, sel: st.ga ? 160 : st.app ? 140 : 250, tfc: p > 0.9 };
      drawPFD(ck.pfd.getContext('2d'), 512, 512, s2); drawND(ck.nd.getContext('2d'), 512, 512, s2); drawEICAS(ck.eicas.getContext('2d'), 512, 512, s2); drawMCP(ck.mcp.getContext('2d'), 1536, 128, s2);
      ck.pfdT.needsUpdate = ck.ndT.needsUpdate = ck.eicasT.needsUpdate = ck.mcpT.needsUpdate = true;
      ck.levers.forEach((l) => { l.rotation.z = -0.2 - st.n1 * 0.55; });
    }
    wetU.uWet.value = cockpit ? clamp(inCloud * 1.3 + (p > 0.24 && p < 0.3 ? 0.35 * (1 - ss(0.24, 0.3, p)) : 0), 0, 1) : 0; wetU.uFlow.value = 0.6 + st.kt / 300;
    // grade per shot
    let exp = back ? 0.85 : above ? lerp(0.95, 0.7, 1 - pre) : sh.mode === 'tower' ? 1.25 : sh.mode === 'sentry' ? 1.1 : 1.15;
    if (cockpit && !above) exp *= 1.0;
    exp *= 1 - inCloud * 0.12 + (inCloud > 0.2 ? (Math.sin(t * 23) * 0.5 + Math.sin(t * 37)) * 0.04 * inCloud : 0);
    let dip = 0; if (!back) for (const c of CUTS) { const d = Math.abs(p - c); dip = Math.max(dip, 1 - ss(0.0007, 0.0045, d)); }
    let white = back ? ss(-innerHeight * 0.85, innerHeight * 0.02, rf.bottom) * 0.95 : inCloud * 0.55 + ss(0.935, 0.975, p) * 1.0;
    if (!back && p > 0.53 && p < 0.548) white = Math.max(white, 1 - ss(0.0, 0.006, Math.abs(p - 0.545)));
    G.uExp.value = exp; G.uDip.value = dip * (p > 0.53 && p < 0.55 ? 0 : 1); G.uWhite.value = Math.min(1, white);
    G.uSensor.value = sh.mode === 'sentry' ? 1 : 0; G.uCA.value = 0.0012 + (sh.shake || 0) * 0.006; G.uSat.value = back ? 0.55 : 1;
    G.uTint.value.set(back ? 0.97 : 1.02, 1, back ? 1.06 : 1.0); G.uLift.value = back ? 0.1 : 0; G.uVig.value = back ? 0.25 : 0.6; G.uGrain.value = back ? 0.02 : 0.035;
    bloom.strength = back ? 0.25 : sh.mode === 'tower' ? 0.5 : 0.6;
    // sound
    if (AU.ready && S0.soundOn) {
      const ac = AU.ac, ct = ac.currentTime, near = back ? 0 : 1;
      AU.eng.forEach((e, i) => { setPan(e.pn, body.localToWorld(ENG[i].clone())); e.s.playbackRate.setTargetAtTime(0.82 + st.n1 * 0.42, ct, 0.4); });
      AU.engBus.gain.setTargetAtTime(near * (cockpit ? 0.5 : inTower ? 0.6 : 1.4) * (0.35 + st.n1 * 0.9), ct, 0.3);
      AU.engLP.frequency.setTargetAtTime(cockpit ? 700 : inTower ? 450 : 6000, ct, 0.2);
      if (AU.wind) AU.wind.gain.setTargetAtTime(back ? 0.12 : cockpit ? 0.25 + inCloud * 0.5 : inTower ? 0.05 : 0.35, ct, 0.4);
      if (AU.alarm) { AU.alarm.gain.setTargetAtTime(alert && inTower ? 0.35 : alert ? 0.06 : 0, ct, 0.05); setPan(AU.alarmPan, towerLocal(Math.sin(0.27) * 5.5, CAB + 0.9, -Math.cos(0.27) * 5.5)); }
      if (AU.voice) setPan(AU.voice.pn, voiceSrc(AU.voice.kind, sh.mode));
    }
    // overlays and render
    if (!back) updateDOM(p, st, sh);
    if (useFrames && !back) framePl.draw(p);
    if (!(useFrames && !back)) comp.render(dt);
    drawSentry(p, t, C, sh.mode === 'sentry' ? ss(0.545, 0.552, p) : 0);
    lastP = p;
  }

  // ================= boot =================
  if (window.FilmPlayer && framesCv) {
    window.FilmPlayer.load(framesCv, 'assets/films/sky/manifest.json').then((pl) => { if (pl) { framePl = pl; useFrames = true; stage.classList.add('frames'); } }).catch(() => {});
  }
  window.film = { setProgress: (v) => { forced = v == null ? null : clamp(+v, 0, 1); }, get progress() { return ps; } };
  const fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  loads.push(fontsReady);
  const all = Promise.all(loads);
  all.then(() => { D.load.classList.add('off'); });
  S0.boot(all, () => { try { R.compile(S, C); } catch (e) {} });
  requestAnimationFrame(frame);
})();
