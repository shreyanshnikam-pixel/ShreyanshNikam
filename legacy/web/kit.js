/* Shared helpers for the three.js films. Exposes window.FK. */
(function () {
  const T = THREE;
  const FK = {};
  FK.b64ab = (s) => { const b = atob(s), n = b.length, u = new Uint8Array(n); for (let i = 0; i < n; i++) u[i] = b.charCodeAt(i); return u.buffer; };
  FK.glb = (b64) => new Promise((res, rej) => new T.GLTFLoader().parse(FK.b64ab(b64), '', res, rej));
  FK.tex = (b64, srgb, rep) => {
    const img = new Image(); const t = new T.Texture(img);
    img.onload = () => { t.needsUpdate = true; };
    img.src = 'data:image/jpeg;base64,' + b64;
    t.wrapS = t.wrapT = T.RepeatWrapping; if (srgb) t.encoding = T.sRGBEncoding; t.anisotropy = 8;
    if (rep) t.repeat.set(rep[0], rep[1]);
    return t;
  };
  FK.json = (url) => fetch(url).then((r) => { if (!r.ok) throw new Error(url + ' ' + r.status); return r.json(); });
  // value noise
  const hash = (x, y, z) => { let h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return h - Math.floor(h); };
  const sm = (t) => t * t * (3 - 2 * t);
  FK.noise = (x, y, z) => {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = sm(x - xi), yf = sm(y - yi), zf = sm(z - zi);
    const L = (a, b, t) => a + (b - a) * t;
    const c = (i, j, k) => hash(xi + i, yi + j, zi + k);
    return L(L(L(c(0,0,0), c(1,0,0), xf), L(c(0,1,0), c(1,1,0), xf), yf), L(L(c(0,0,1), c(1,0,1), xf), L(c(0,1,1), c(1,1,1), xf), yf), zf);
  };
  FK.fbm = (x, y, z, o) => { let s = 0, a = 0.5, f = 1; for (let i = 0; i < (o || 4); i++) { s += a * FK.noise(x * f, y * f, z * f); f *= 2.03; a *= 0.5; } return s; };
  FK.rng = (seed) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  FK.clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  FK.ss = (a, b, x) => { const t = FK.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  FK.lerp = (a, b, t) => a + (b - a) * t;
  // piecewise smooth keyframes [[p, v], ...]
  FK.keys = (K, p) => {
    if (p <= K[0][0]) return K[0][1];
    for (let i = 1; i < K.length; i++) if (p <= K[i][0]) { const t = FK.ss(K[i - 1][0], K[i][0], p); return FK.lerp(K[i - 1][1], K[i][1], t); }
    return K[K.length - 1][1];
  };
  // linear keyframe list [[f, v], ...]
  FK.lin = (K, f) => {
    if (f <= K[0][0]) return K[0][1];
    for (let i = 1; i < K.length; i++) if (f <= K[i][0]) { const t = (f - K[i - 1][0]) / (K[i][0] - K[i - 1][0]); return FK.lerp(K[i - 1][1], K[i][1], t); }
    return K[K.length - 1][1];
  };
  // final grade: ACES, gamma, grain, vignette, chromatic aberration, flash
  FK.gradePass = () => new T.ShaderPass({
    uniforms: { tDiffuse: { value: null }, uT: { value: 0 }, uCA: { value: 0.0015 }, uVig: { value: 1.0 }, uGrain: { value: 0.05 },
      uFlash: { value: new T.Vector3() }, uExp: { value: 1.0 }, uRes: { value: new T.Vector2(1, 1) }, uSat: { value: 1.0 }, uTint: { value: new T.Vector3(1, 1, 1) } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: [
      'uniform sampler2D tDiffuse; uniform float uT, uCA, uVig, uGrain, uExp, uSat; uniform vec3 uFlash, uTint; uniform vec2 uRes; varying vec2 vUv;',
      'vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14), 0.0, 1.0); }',
      'float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }',
      'void main(){',
      '  vec2 c = vUv - 0.5; float r2 = dot(c, c);',
      '  vec2 o = c * uCA * (1.0 + r2 * 4.0);',
      '  vec3 col = vec3(texture2D(tDiffuse, vUv + o).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - o).b);',
      '  col *= uExp * uTint; col += uFlash;',
      '  float l = dot(col, vec3(0.2126, 0.7152, 0.0722)); col = mix(vec3(l), col, uSat);',
      '  col = aces(col);',
      '  col = pow(col, vec3(1.0/2.2));',
      '  col *= mix(1.0, smoothstep(1.25, 0.15, r2 * 1.7), uVig);',
      '  col += (h(vUv * uRes + fract(uT * 13.1) * 91.7) - 0.5) * uGrain;',
      '  gl_FragColor = vec4(col, 1.0);',
      '}'].join('\n'),
  });
  FK.composer = (renderer, scene, camera, bloom) => {
    const c = new T.EffectComposer(renderer, new T.WebGLRenderTarget(16, 16, { type: T.HalfFloatType }));
    c.addPass(new T.RenderPass(scene, camera));
    let bp = null;
    if (bloom) { bp = new T.UnrealBloomPass(new T.Vector2(256, 256), bloom[0], bloom[1], bloom[2]); c.addPass(bp); }
    const g = FK.gradePass(); c.addPass(g);
    return { c, bloom: bp, grade: g };
  };
  // quality governor: frame-time EMA adjusts pixel ratio
  FK.governor = (renderer, composer, getSize) => {
    const g = { q: 1, ema: 16, last: 0, max: Math.min(window.devicePixelRatio || 1, 2) };
    g.tick = (now) => {
      if (g.last) { const dt = now - g.last; g.ema = g.ema * 0.93 + Math.min(dt, 80) * 0.07; }
      g.last = now;
      g.frames = (g.frames || 0) + 1;
      if (g.frames % 40 === 0) {
        let nq = g.q;
        if (g.ema > 24 && g.q > 0.5) nq = g.q - 0.1; else if (g.ema < 15 && g.q < 1) nq = g.q + 0.05;
        if (nq !== g.q) { g.q = nq; g.apply(); }
      }
    };
    g.apply = () => {
      const pr = Math.max(0.6, g.max * g.q); const s = getSize();
      renderer.setPixelRatio(pr); renderer.setSize(s[0], s[1], false);
      composer.setPixelRatio(pr); composer.setSize(s[0], s[1]);
    };
    return g;
  };
  // patch a standard material with extra shader code (onBeforeCompile)
  FK.patch = (mat, key, uniforms, fragDecl, fragCode, needWorld) => {
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, uniforms);
      if (needWorld) {
        sh.vertexShader = 'varying vec3 vWP;\n' + sh.vertexShader.replace('#include <project_vertex>',
          '#include <project_vertex>\n vec4 fkw = vec4(transformed, 1.0);\n#ifdef USE_INSTANCING\n fkw = instanceMatrix * fkw;\n#endif\n vWP = (modelMatrix * fkw).xyz;');
        }
      sh.fragmentShader = (needWorld ? 'varying vec3 vWP;\n' : '') + fragDecl + '\n' + sh.fragmentShader.replace('#include <output_fragment>', fragCode + '\n#include <output_fragment>');
    };
    mat.customProgramCacheKey = () => key;
    mat.needsUpdate = true;
    return mat;
  };
  window.FK = FK;
})();
