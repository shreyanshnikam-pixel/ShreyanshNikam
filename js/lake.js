/* Home: Lake Louise, Banff National Park, as a live three.js scene.
   Real terrain (AWS Terrain Tiles elevation) draped in real Sentinel-2 imagery (EOX, s2cloudless 2020),
   a photographed sky (Poly Haven), turquoise water with live mirror reflections, a conifer forest baked into
   billboards in the browser, and red canoes at the dock. Scrolling flies from high above the valley down to the shore.
   Detail follows the visitor's Graphics setting (window.PERF from core.js). Heights are metres above the lake. */
(function () {
  const T = THREE, S0 = window.SITE, PF = window.PERF, V = (x, y, z) => new T.Vector3(x, y, z);
  const cv = document.getElementById('world');
  if (!S0.glOk || !cv) { S0.boot(Promise.resolve()); return; }
  const rm = S0.rm, mobile = innerWidth < 760, BASE = 'assets/lake/';
  const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const lerp = (a, b, k) => a + (b - a) * k;
  let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const Q = PF.ultra ? 4 : PF.high ? 3 : PF.mid ? 2 : 1; // detail level: 1 phone .. 4 ultra

  // ---------- renderer (log depth: canoe paint at 3 m and peaks at 30 km in one frame) ----------
  const R = new T.WebGLRenderer({ canvas: cv, antialias: PF.high, powerPreference: 'high-performance', logarithmicDepthBuffer: true });
  const S = new T.Scene();
  const C = new T.PerspectiveCamera(38, innerWidth / innerHeight, 0.4, 90000);
  let curPR = PF.startPR(innerWidth, innerHeight);
  const resize = () => { R.setPixelRatio(curPR); R.setSize(innerWidth, innerHeight, false); C.aspect = innerWidth / innerHeight; C.fov = C.aspect < 0.9 ? 56 : 38; C.updateProjectionMatrix(); refSize(); };
  const gov = PF.governor((pr) => { curPR = pr; resize(); }, () => [innerWidth, innerHeight]); gov.started = true; gov.pr = curPR; gov.settle = 40;

  // planar reflection target for the lake (High and Ultra every frame, Medium every other frame, phones none)
  const refOn = Q >= 2, refRT = new T.WebGLRenderTarget(16, 16, { type: T.HalfFloatType });
  function refSize() { if (!refOn) return; const k = Q >= 4 ? 0.75 : Q === 3 ? 0.5 : 0.35, b = new T.Vector2(); R.getDrawingBufferSize(b); refRT.setSize(Math.max(64, Math.round(b.x * k)), Math.max(64, Math.round(b.y * k))); }
  window.addEventListener('resize', resize); resize();

  // ---------- sky, light and the photographic grade (realism.js) ----------
  const sunDir = V(0, 0, 0);
  const RL = REAL.setup(R, S, C, { hdr: 'assets/lake/sky_1k.hdr', ground: false, fogDensity: 0.000052, exposure: 0.95, turn: 0, cropK: 1,
    crops: [{ url: BASE + 'sky_main.webp', half: BASE + 'sky_main_half.webp', u0: 0.7554931640625, v0: 0.4888916015625, u1: 0.99859619140625, v1: 0.8055419921875 }] });
  const sun = new T.DirectionalLight(0xfff1df, 2.4); S.add(sun); S.add(sun.target);
  const hemi = new T.HemisphereLight(0xbcd3ea, 0x3b4a32, 0.55); S.add(hemi);

  // ---------- loading ----------
  const TL = new T.TextureLoader();
  const tex = (url, srgb, rep) => new Promise((res) => TL.load(url, (t) => { if (srgb) t.encoding = T.sRGBEncoding; t.anisotropy = R.capabilities.getMaxAnisotropy(); if (rep) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rep, rep); } res(t); }, undefined, () => res(null)));
  const bin = (url) => fetch(url).then((r) => r.arrayBuffer()).then((b) => new Uint16Array(b));
  const pixels = (url) => new Promise((res) => { const im = new Image(); im.onload = () => { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d'); x.drawImage(im, 0, 0); res({ w: im.width, h: im.height, d: x.getImageData(0, 0, im.width, im.height).data }); }; im.onerror = () => res(null); im.src = url; });

  const world = {};
  const build = (async () => {
    const meta = await fetch(BASE + 'meta.json').then((r) => r.json());
    const W0 = meta.water;
    const [coreH, ringH, coreT, ringT, rockT, rockN, forest, lakeM, twigT, barkT, planksT, planksN] = await Promise.all([
      bin(BASE + 'core_h.bin'), bin(BASE + 'ring_h.bin'),
      tex(BASE + (Q >= 3 ? 'core_4k.webp' : 'core_2k.webp'), true), tex(BASE + (Q >= 3 ? 'ring_2k.webp' : 'ring_1k.webp'), true),
      tex(BASE + 'rock.webp', true), tex(BASE + 'rock_n.webp', false),
      pixels(BASE + 'forest.png'), tex(BASE + 'lake_mask.png', false), tex(BASE + 'twig.webp', true), tex(BASE + 'bark.webp', true),
      tex(BASE + 'planks.webp', true), tex(BASE + 'planks_n.webp', false)]);
    [rockT, rockN].forEach((t) => { if (t) t.wrapS = t.wrapT = T.RepeatWrapping; });
    const cm = meta.core, rg = meta.ring;
    const hAt = (H, m, ix, iy) => H[Math.min(m.h - 1, Math.max(0, iy)) * m.w + Math.min(m.w - 1, Math.max(0, ix))] / 10 + 1000 - W0;
    // height at a world point from the core grid (bilinear)
    const height = world.height = (x, z) => {
      const fx = (x - cm.x0) / (cm.x1 - cm.x0) * (cm.w - 1), fz = (z - cm.z0) / (cm.z1 - cm.z0) * (cm.h - 1);
      const ix = Math.floor(fx), iz = Math.floor(fz), tx = fx - ix, tz = fz - iz;
      return lerp(lerp(hAt(coreH, cm, ix, iz), hAt(coreH, cm, ix + 1, iz), tx), lerp(hAt(coreH, cm, ix, iz + 1), hAt(coreH, cm, ix + 1, iz + 1), tx), tz);
    };
    const lb = meta.lake.bbox;
    const inLakeBox = (x, z) => x > lb[0] - 80 && x < lb[1] + 80 && z > lb[2] - 80 && z < lb[3] + 80;

    // ---------- terrain: a grid of real heights, satellite photo on top, rock detail close up ----------
    const grid = (H, m, step, adjust) => {
      const cols = Math.floor((m.w - 1) / step) + 1, rows = Math.floor((m.h - 1) / step) + 1;
      const pos = new Float32Array(cols * rows * 3), uv = new Float32Array(cols * rows * 2), idx = [];
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const ix = Math.min(m.w - 1, c * step), iy = Math.min(m.h - 1, r * step), i = r * cols + c;
        const x = m.x0 + ix / (m.w - 1) * (m.x1 - m.x0), z = m.z0 + iy / (m.h - 1) * (m.z1 - m.z0);
        pos[i * 3] = x; pos[i * 3 + 1] = adjust(hAt(H, m, ix, iy), x, z); pos[i * 3 + 2] = z;
        uv[i * 2] = ix / (m.w - 1); uv[i * 2 + 1] = 1 - iy / (m.h - 1);
      }
      for (let r = 0; r < rows - 1; r++) for (let c = 0; c < cols - 1; c++) { const a = r * cols + c, b = a + 1, d = a + cols, e = d + 1; idx.push(a, d, b, b, d, e); }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('uv', new T.BufferAttribute(uv, 2));
      g.setIndex(pos.length / 3 > 65535 ? new T.Uint32BufferAttribute(idx, 1) : new T.Uint16BufferAttribute(idx, 1)); g.computeVertexNormals(); return g;
    };
    const terrainMat = (map, detail) => {
      const m = new T.MeshStandardMaterial({ map, roughness: 0.96, metalness: 0, envMapIntensity: 0.35 });
      m.onBeforeCompile = (sh) => {
        sh.uniforms.tRock = { value: rockT }; sh.uniforms.tRockN = { value: rockN }; sh.uniforms.uDet = { value: detail ? 1 : 0 };
        sh.vertexShader = 'varying vec3 vWP; varying vec3 vWN;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n vWP = (modelMatrix * vec4(transformed, 1.0)).xyz; vWN = normalize(mat3(modelMatrix) * objectNormal);');
        sh.fragmentShader = 'uniform sampler2D tRock, tRockN; uniform float uDet; varying vec3 vWP; varying vec3 vWN;\n' + sh.fragmentShader
          .replace('#include <map_fragment>', [
            '#include <map_fragment>',
            // close up, the 3 m satellite pixels get real rock grain and soil variation; steep faces read as rock
            '{ float dd = length(vWP - cameraPosition); float near = (1.0 - smoothstep(250.0, 5000.0, dd)) * uDet;',
            // a top-down photo smears on cliffs: there, real rock projected from the side takes over, tinted by the photo
            '  vec3 an = abs(normalize(vWN)); an = pow(an, vec3(4.0)); an /= (an.x + an.y + an.z);',
            '  vec3 tri = texture2D(tRock, vWP.zy / 41.0).rgb * an.x + texture2D(tRock, vWP.xz / 41.0).rgb * an.y + texture2D(tRock, vWP.xy / 41.0).rgb * an.z;',
            (Q >= 3 ? '  vec3 tri2 = texture2D(tRock, vWP.zy / 9.0 + 0.3).rgb * an.x + texture2D(tRock, vWP.xz / 9.0 + 0.3).rgb * an.y + texture2D(tRock, vWP.xy / 9.0 + 0.3).rgb * an.z;' : '  vec3 tri2 = tri;'), // Medium and Low: one rock layer
            '  float steep = smoothstep(0.42, 0.78, 1.0 - vWN.y);',
            '  vec3 photo = diffuseColor.rgb; float pl = dot(photo, vec3(0.333));',
            '  vec3 rock = mix(tri, tri2, 0.4) * (pl * 2.4 + 0.04) * vec3(1.02, 1.0, 0.97);',
            '  float snow = smoothstep(0.42, 0.6, pl) * (1.0 - smoothstep(0.86, 0.98, 1.0 - vWN.y));',
            '  diffuseColor.rgb = mix(photo, mix(rock, photo, snow), steep * mix(0.55, 0.9, near));',
            '  float l = dot(tri2, vec3(0.333)); diffuseColor.rgb *= mix(1.0, 0.6 + l * 0.95, near * 0.45 * (1.0 - steep)); }'].join('\n'))
          .replace('#include <output_fragment>', [
            // the satellite photo already carries the morning light: keep half of it, let the live sun do the rest
            'outgoingLight = mix(outgoingLight, diffuseColor.rgb * 1.05, 0.42);',
            '#include <output_fragment>'].join('\n'));
      };
      m.customProgramCacheKey = () => 'lake-terrain-' + (detail ? 1 : 0) + '-' + Q;
      return m;
    };
    const step = Q >= 4 ? 1 : Q === 3 ? 2 : Q === 2 ? 2 : 3;
    // carve the lake bed a few metres down so the water never fights the ground at the shore
    const coreG = grid(coreH, cm, step, (h) => (h < 0.2 ? h - 1.2 : h)); // the flat lake surface sinks a little under the water
    const core = world.core = new T.Mesh(coreG, terrainMat(coreT, true)); S.add(core);
    // the wider ring: coarser, and sunk under the core so the two never fight
    const cIn = (x, z) => Math.min(x - cm.x0, cm.x1 - x, z - cm.z0, cm.z1 - z);
    const ringG = grid(ringH, rg, Q >= 3 ? 1 : 2, (h, x, z) => { const d = cIn(x, z); return d > 0 ? h - 60 * ss(0, 500, d) : h; });
    const ring = new T.Mesh(ringG, terrainMat(ringT, false)); S.add(ring);

    // ---------- the lake ----------
    const wU = T.UniformsUtils.merge([T.UniformsLib.fog, {
      uT: { value: 0 }, tRef: { value: refRT.texture }, uRefOn: { value: refOn ? 1 : 0 }, uTexM: { value: new T.Matrix4() }, tMask: { value: lakeM },
      uBox: { value: new T.Vector4(cm.x0, cm.z0, cm.x1 - cm.x0, cm.z1 - cm.z0) }, uSun: { value: V(0, 1, 0) }, uSky: { value: new T.Color(0.55, 0.68, 0.82) }, uHor: { value: new T.Color(0.8, 0.85, 0.9) } }]);
    wU.tRef.value = refRT.texture; wU.tMask.value = lakeM; // merge() copies textures; render targets must stay the originals
    const water = world.water = new T.Mesh(new T.PlaneGeometry(lb[1] - lb[0] + 160, lb[3] - lb[2] + 160, 1, 1).rotateX(-Math.PI / 2), new T.ShaderMaterial({
      uniforms: wU, fog: true,
      vertexShader: ['#include <common>', '#include <fog_pars_vertex>', '#include <logdepthbuf_pars_vertex>',
        'uniform mat4 uTexM; varying vec4 vRef; varying vec3 vWP;',
        'void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vWP = wp.xyz; vRef = uTexM * wp; vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;',
        '#include <logdepthbuf_vertex>', '#include <fog_vertex>', '}'].join('\n'),
      fragmentShader: ['#include <common>', '#include <fog_pars_fragment>', '#include <logdepthbuf_pars_fragment>',
        'uniform float uT, uRefOn; uniform sampler2D tRef, tMask; uniform vec4 uBox; uniform vec3 uSun, uSky, uHor; varying vec4 vRef; varying vec3 vWP;',
        'float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
        'float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h2(i), h2(i+vec2(1,0)), f.x), mix(h2(i+vec2(0,1)), h2(i+vec2(1,1)), f.x), f.y); }',
        // a few octaves of gentle wind ripples, as slopes
        'vec2 ripple(vec2 p, float t){ vec2 g = vec2(0.0); float a = 1.0, f = 1.0;',
        '  for (int i = 0; i < 4; i++) { vec2 q = p * f + vec2(t * 0.35, t * 0.22) * f; float e = 0.06; float c = n2(q);',
        '    g += a * vec2(n2(q + vec2(e, 0.0)) - c, n2(q + vec2(0.0, e)) - c) / e; a *= 0.5; f *= 2.1; } return g; }',
        'void main(){',
        '#include <logdepthbuf_fragment>',
        '  vec3 Vd = cameraPosition - vWP; float dist = length(Vd); Vd /= dist;',
        '  float fade = 1.0 - smoothstep(40.0, 1400.0, dist);',
        '  vec2 g = ripple(vWP.xz * 0.11, uT) * 0.032 * (0.12 + 0.88 * fade) + ripple(vWP.xz * 0.9, uT * 1.6) * 0.012 * fade;',
        '  vec3 N = normalize(vec3(-g.x, 1.0, -g.y));',
        '  float ndv = max(dot(N, Vd), 0.0), fr = 0.02 + 0.98 * pow(1.0 - ndv, 5.0);',
        '  vec3 refl; if (uRefOn > 0.5) { vec4 r = vRef; r.xy += N.xz * r.w * 0.03; refl = texture2DProj(tRef, r).rgb; }',
        '  else { vec3 rd = reflect(-Vd, N); refl = mix(uHor, uSky, smoothstep(0.0, 0.5, rd.y)); }',
        // glacial flour: milky turquoise, brighter in the shallows near the shore
        '  vec2 mu = (vWP.xz - uBox.xy) / uBox.zw; float lakeIn = texture2D(tMask, vec2(mu.x, 1.0 - mu.y)).r; if (lakeIn < 0.015) discard;',
        '  vec3 deep = vec3(0.035, 0.30, 0.33), shallow = vec3(0.16, 0.50, 0.46);',
        '  vec3 body = mix(shallow, deep, smoothstep(0.35, 0.95, lakeIn));',
        '  float sunUp = max(uSun.y, 0.0); body *= 0.55 + 0.65 * sunUp;',
        '  vec3 col = mix(body, refl, fr * 0.92 + 0.04);',
        '  vec3 H = normalize(uSun + Vd); col += vec3(1.0, 0.94, 0.84) * pow(max(dot(N, H), 0.0), 520.0) * 9.0 * sunUp;',
        '  gl_FragColor = vec4(col, 1.0);',
        '#include <fog_fragment>', '}'].join('\n'),
    }));
    water.position.set((lb[0] + lb[1]) / 2, 0.3, (lb[2] + lb[3]) / 2); S.add(water);
    world.wU = wU;

    // ---------- conifers: build a few real twig-card trees, bake them into billboards ----------
    const VARS = 4, atlas = new T.WebGLRenderTarget(VARS * (Q >= 3 ? 256 : 128), Q >= 3 ? 512 : 256, { generateMipmaps: true, minFilter: T.LinearMipmapLinearFilter });
    {
      const tS = new T.Scene(), tw = new T.MeshStandardMaterial({ map: twigT, alphaTest: 0.42, side: T.DoubleSide, roughness: 0.9, color: 0x9aa58a });
      const bk = new T.MeshStandardMaterial({ map: barkT, roughness: 0.95, color: 0x8a7a6a });
      tS.add(new T.HemisphereLight(0xdfe8f2, 0x2a3324, 1.3)); const tl = new T.DirectionalLight(0xffffff, 1.4); tl.position.set(0.4, 1, 1); tS.add(tl);
      const card = new T.PlaneGeometry(1, 1); card.translate(0.5, 0, 0);
      for (let v = 0; v < VARS; v++) {
        const g = new T.Group(), Ht = 10, Rb = 2.0 + v * 0.18;
        g.add(new T.Mesh(new T.CylinderGeometry(0.06, 0.24, Ht, 6), bk)).position.y = Ht / 2;
        for (let y = 1.2; y < Ht; y += 0.34) {
          const k = 1 - y / Ht, rr = Rb * Math.pow(k, 0.95) * (0.82 + rnd() * 0.3), n = 7 + Math.floor(rnd() * 4);
          for (let i = 0; i < n; i++) {
            const m = new T.Mesh(card, tw), a = i / n * Math.PI * 2 + rnd() * 0.6;
            m.scale.set(rr, rr * 0.55, 1); m.position.y = y; m.rotation.set(0, a, 0); m.rotateZ(-0.28 - rnd() * 0.2); m.rotateX((rnd() - 0.5) * 0.9); g.add(m);
          }
        }
        const top = new T.Mesh(card, tw); top.scale.set(0.9, 1.4, 1); top.position.y = Ht - 0.3; top.rotation.z = Math.PI / 2; g.add(top);
        g.position.x = (v - (VARS - 1) / 2) * 5; tS.add(g);
      }
      const oc = new T.OrthographicCamera(-VARS * 2.5, VARS * 2.5, 10.4, -0.4, 0.1, 100); oc.position.set(0, 5, 40); oc.lookAt(0, 5, 0);
      const pc = R.getClearColor(new T.Color()), pa = R.getClearAlpha(); R.setClearColor(0x000000, 0);
      R.setRenderTarget(atlas); R.clear(); R.render(tS, oc); R.setRenderTarget(null); R.setClearColor(pc, pa);
      tS.traverse((o) => { if (o.geometry && o.geometry !== card) o.geometry.dispose(); }); card.dispose();
    }
    // placement from the forest map (dark green, below the treeline, not too steep), denser near the shore we land on
    const NT = [0, 9000, 26000, 70000, 130000][Q];
    const ipos = new Float32Array(NT * 3), isz = new Float32Array(NT * 2), ivar = new Float32Array(NT * 2);
    const dock = V(meta.lake.ne[0], 0, meta.lake.ne[1]);
    let n = 0, tries = 0;
    while (n < NT && tries < NT * 40) {
      tries++;
      const near = rnd() < 0.55, x = near ? dock.x + (rnd() - 0.5) * 2600 : cm.x0 + rnd() * (cm.x1 - cm.x0), z = near ? dock.z + (rnd() - 0.5) * 2600 : cm.z0 + rnd() * (cm.z1 - cm.z0);
      if (x < cm.x0 || x > cm.x1 || z < cm.z0 || z > cm.z1) continue;
      const fx = Math.floor((x - cm.x0) / (cm.x1 - cm.x0) * (forest.w - 1)), fz = Math.floor((z - cm.z0) / (cm.z1 - cm.z0) * (forest.h - 1));
      const d = forest.d[(fz * forest.w + fx) * 4] / 255; if (rnd() > d * 1.25) continue;
      const y = height(x, z); if (y < 1.2) continue;
      const h = 13 + rnd() * 17 + (rnd() < 0.1 ? 8 : 0);
      ipos.set([x, y - 0.6, z], n * 3); isz.set([0.88 + rnd() * 0.3, h], n * 2); ivar.set([Math.floor(rnd() * VARS), 0.75 + rnd() * 0.35], n * 2); n++;
    }
    const qg = new T.InstancedBufferGeometry(); qg.instanceCount = n;
    qg.setAttribute('position', new T.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0], 3)); qg.setIndex([0, 1, 2, 0, 2, 3]);
    qg.setAttribute('iPos', new T.InstancedBufferAttribute(ipos.subarray(0, n * 3), 3)); qg.setAttribute('iSz', new T.InstancedBufferAttribute(isz.subarray(0, n * 2), 2)); qg.setAttribute('iVar', new T.InstancedBufferAttribute(ivar.subarray(0, n * 2), 2));
    const fU = T.UniformsUtils.merge([T.UniformsLib.fog, { tA: { value: atlas.texture }, uSun: { value: V(0, 1, 0) }, uVars: { value: VARS }, uLight: { value: 1 } }]);
    fU.tA.value = atlas.texture;
    const trees = world.trees = new T.Mesh(qg, new T.ShaderMaterial({
      uniforms: fU, fog: true,
      vertexShader: ['#include <common>', '#include <fog_pars_vertex>', '#include <logdepthbuf_pars_vertex>',
        'attribute vec3 iPos; attribute vec2 iSz, iVar; varying vec2 vUv; varying float vTint, vSide, vH;',
        'void main(){ vec3 to = cameraPosition - iPos; to.y = 0.0; vec3 fw = normalize(to + vec3(1e-4, 0.0, 0.0)); vec3 rt = vec3(fw.z, 0.0, -fw.x);',
        '  vec3 wp = iPos + rt * position.x * iSz.y * 0.463 * iSz.x + vec3(0.0, position.y * iSz.y, 0.0);',
        '  vUv = vec2((iVar.x + position.x + 0.5) / ' + VARS + '.0, position.y); vTint = iVar.y; vSide = position.x; vH = position.y;',
        '  vec4 mvPosition = viewMatrix * vec4(wp, 1.0); gl_Position = projectionMatrix * mvPosition;',
        '#include <logdepthbuf_vertex>', '#include <fog_vertex>', '}'].join('\n'),
      fragmentShader: ['#include <common>', '#include <fog_pars_fragment>', '#include <logdepthbuf_pars_fragment>',
        'uniform sampler2D tA; uniform vec3 uSun; uniform float uLight; varying vec2 vUv; varying float vTint, vSide, vH;',
        'void main(){',
        '#include <logdepthbuf_fragment>',
        '  vec4 c = texture2D(tA, vUv); if (c.a < 0.5) discard;',
        '  vec3 col = c.rgb / max(c.a, 0.01) * vTint * vec3(0.78, 0.86, 0.74);',
        '  col *= (0.62 + 0.38 * vH) * uLight;',
        '  gl_FragColor = vec4(col, 1.0);',
        '#include <fog_fragment>', '}'].join('\n'),
    }));
    trees.frustumCulled = false; S.add(trees);

    // ---------- the shore: a dock and the red canoes ----------
    const ax = V(meta.lake.axis[0], 0, meta.lake.axis[1]).normalize(); // points from the lake toward the north-east end
    const side = V(-ax.z, 0, ax.x);
    // walk from the north-east tip back along the lake axis until the ground is a little above water: that is the shore
    let shore = dock.clone(); for (let i = 0; i < 80; i++) { const p = dock.clone().addScaledVector(ax, 30 - i * 2); if (height(p.x, p.z) < 0.4) { shore = p.clone().addScaledVector(ax, 2); break; } }
    world.shore = shore; world.ax = ax; world.side = side;
    const dockG = new T.Group(); dockG.position.copy(shore); dockG.position.y = 0; dockG.rotation.y = Math.atan2(ax.x, ax.z); S.add(dockG);
    if (planksT) { planksT.wrapS = planksT.wrapT = T.RepeatWrapping; planksT.repeat.set(1, 7); }
    if (planksN) { planksN.wrapS = planksN.wrapT = T.RepeatWrapping; planksN.repeat.set(1, 7); }
    const deckM = new T.MeshStandardMaterial({ map: planksT, normalMap: planksN, roughness: 0.82, color: 0x9a8a78 });
    const postM = new T.MeshStandardMaterial({ color: 0x4a3c30, roughness: 0.9 });
    const DL = 30, DW = 2.6;
    const deck = new T.Mesh(new T.BoxGeometry(DW, 0.18, DL), deckM); deck.position.set(0, 0.62, -DL / 2 + 2); dockG.add(deck);
    for (let k = 0; k <= 6; k++) for (const sx of [-1, 1]) { const p = new T.Mesh(new T.CylinderGeometry(0.12, 0.14, 2.6, 8), postM); p.position.set(sx * (DW / 2 - 0.1), -0.6, 2 - k * DL / 6); dockG.add(p); }
    // canoes: a lofted hull (16 ft prospector shape), red paint with a clear coat, wooden gunwales, cane seats
    const hull = (() => {
      const L = 4.9, B = 0.86, D = 0.36, NU = 40, NV = 18, pos = [], uv = [], idx = [];
      for (let i = 0; i <= NU; i++) {
        const u = i / NU, s = Math.sin(Math.PI * u), wd = B / 2 * Math.pow(s, 0.62), sheer = D + 0.16 * Math.pow(Math.abs(u * 2 - 1), 3), z = (u - 0.5) * L;
        for (let j = 0; j <= NV; j++) {
          const v = j / NV, a = Math.PI * v; // gunwale to gunwale under the keel
          pos.push(-Math.cos(a) * wd, sheer - Math.sin(a) * (D * Math.pow(s, 0.25) + 0.02) + (1 - Math.pow(s, 0.25)) * 0.12, z); uv.push(u, v);
        }
      }
      for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) { const a = i * (NV + 1) + j, b = a + NV + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
      return { g, L, B, D };
    })();
    const paint = new T.MeshPhysicalMaterial({ color: 0xa51f17, roughness: 0.42, clearcoat: 0.8, clearcoatRoughness: 0.18, side: T.DoubleSide });
    const wood = new T.MeshStandardMaterial({ map: planksT, color: 0xb8925f, roughness: 0.6 });
    const canoe = () => {
      const g = new T.Group(); g.add(new T.Mesh(hull.g, paint));
      for (const sx of [-1, 1]) { const pts = []; for (let i = 0; i <= 24; i++) { const u = i / 24, s = Math.sin(Math.PI * u); pts.push(V(sx * hull.B / 2 * Math.pow(s, 0.62), hull.D + 0.16 * Math.pow(Math.abs(u * 2 - 1), 3), (u - 0.5) * hull.L)); } g.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 40, 0.022, 5), wood)); }
      for (const z of [-1.55, 0, 1.4]) { const s = new T.Mesh(new T.BoxGeometry(hull.B * 0.86 * Math.pow(Math.sin(Math.PI * (z / hull.L + 0.5)), 0.62), 0.03, 0.2), wood); s.position.set(0, hull.D - 0.06, z); g.add(s); }
      return g;
    };
    world.canoes = [];
    const NC = Q >= 2 ? 7 : 4;
    for (let i = 0; i < NC; i++) {
      const c = canoe(), sd = i % 2 ? 1 : -1, row = Math.floor(i / 2);
      c.position.set(sd * (DW / 2 + 0.55 + (row % 2) * 0.05), 0.02, -3.5 - row * 5.4 + (sd > 0 ? 1.2 : 0)); c.rotation.y = (rnd() - 0.5) * 0.06;
      c.userData.ph = rnd() * 6; dockG.add(c); world.canoes.push(c);
    }
    // a couple pulled up on the shore, upside down, the way the boathouse stores them
    for (let i = 0; i < 2; i++) { const c = canoe(); c.rotation.set(Math.PI, 0.3 * (i ? 1 : -1), 0); c.position.set(-4.5 - i * 1.3, 0, 5.5 + i * 0.7); dockG.add(c); dockG.updateMatrixWorld(true); const wp = c.getWorldPosition(V(0, 0, 0)); c.position.y = Math.max(0.3, height(wp.x, wp.z)) + 0.5; }
    world.dockG = dockG;
    // shore stones around the dock foot
    const stoneM = new T.MeshStandardMaterial({ map: rockT, normalMap: rockN, roughness: 0.92, color: 0xa59d92 });
    const stones = new T.InstancedMesh(new T.IcosahedronGeometry(1, 1), stoneM, 160), m4 = new T.Matrix4(), qq = new T.Quaternion();
    for (let i = 0; i < 160; i++) {
      const a = rnd() * Math.PI * 2, r = 2 + rnd() * 26, p = shore.clone().addScaledVector(side, Math.cos(a) * r).addScaledVector(ax, Math.sin(a) * r * 0.5 + 1.5);
      const y = Math.max(height(p.x, p.z), -0.4), sc = 0.2 + rnd() * rnd() * 1.1;
      m4.compose(V(p.x, y + sc * 0.1, p.z), qq.setFromEuler(new T.Euler(rnd() * 3, rnd() * 3, rnd() * 3)), V(sc * (1 + rnd() * 0.6), sc * 0.6, sc)); stones.setMatrixAt(i, m4);
    }
    S.add(stones);

    // ---------- sun from the sky photograph ----------
    const su = meta.skySun, az = (su.u - 0.5) * Math.PI * 2, el = su.elev * Math.PI / 180;
    sunDir.set(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)).normalize();
    wU.uSun.value.copy(sunDir); fU.uSun.value.copy(sunDir);
    world.meta = meta;
  })();

  // ---------- the flight: high above the valley, down the lake, onto the dock ----------
  const secs = Array.from(document.querySelectorAll('main > section')), N = secs.length;
  let path = null;
  const makePath = () => {
    const sh = world.shore, ax = world.ax, sd = world.side, gl = V(-4620, 1700, 4200); // Victoria Glacier, beyond the far end
    const P = (a, s, up) => sh.clone().addScaledVector(ax, a).addScaledVector(sd, s).setY(up);
    const keys = [
      [P(3600, -900, 2350), V(-1800, 250, 1900)],
      [P(2700, -500, 1650), V(-2100, 300, 2100)],
      [P(1900, -150, 1050), V(-2600, 450, 2500)],
      [P(1200, 60, 620), V(-3100, 600, 2900)],
      [P(700, 120, 300), V(-3600, 800, 3300)],
      [P(330, 60, 95), V(-4000, 1000, 3700)],
      [P(90, 18, 18), V(-4400, 1300, 4000)],
      [P(-6, 0.35, 2.35), gl.clone().setY(260)],
    ].slice(0, Math.max(2, N));
    while (keys.length < N) keys.push(keys[keys.length - 1]);
    path = { p: new T.CatmullRomCurve3(keys.map((k) => k[0]), false, 'centripetal'), l: new T.CatmullRomCurve3(keys.map((k) => k[1]), false, 'centripetal') };
  };
  const measure = () => {
    const mid = innerHeight * 0.5;
    for (let i = 0; i < N; i++) { const r = secs[i].getBoundingClientRect(); if (mid < r.bottom || i === N - 1) return i + Math.max(0, Math.min(1, (mid - r.top) / Math.max(1, r.height))); }
    return 0;
  };
  // the flight is the finale: it runs while the drone footage hands over and you scroll through the last section
  const flight = (x) => ss(N - 2 + 0.56, N - 1 + 0.74, x);

  // ---------- frame ----------
  let tS = 0, last = 0, visible = !document.hidden, t0 = performance.now(), rmDrawn = -1, frameN = 0;
  document.addEventListener('visibilitychange', () => { visible = !document.hidden; });
  window.addEventListener('resize', () => { rmDrawn = -1; });
  const mt = new T.Vector2(), mouse = new T.Vector2();
  window.addEventListener('pointermove', (e) => mt.set(e.clientX / innerWidth * 2 - 1, e.clientY / innerHeight * 2 - 1), { passive: true });
  const tmpP = V(0, 0, 0), tmpL = V(0, 0, 0), mc = new T.PerspectiveCamera(), clip = [new T.Plane(V(0, 1, 0), 0.02)];
  const bias = new T.Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);

  function renderReflection() {
    const w = world.water; if (!refOn || !w) return;
    mc.copy(C); mc.position.set(C.position.x, -C.position.y, C.position.z);
    const f = C.getWorldDirection(V(0, 0, 0)); const tg = C.position.clone().add(f); tg.y = -tg.y; mc.up.set(0, 1, 0); mc.lookAt(tg); mc.updateMatrixWorld(); mc.updateProjectionMatrix();
    world.wU.uTexM.value.copy(bias).multiply(mc.projectionMatrix).multiply(mc.matrixWorldInverse);
    w.visible = false; const dome = RL.dome; if (dome) dome.position.copy(mc.position);
    R.clippingPlanes = clip; R.setRenderTarget(refRT); R.clear(); R.render(S, mc); R.setRenderTarget(null); R.clippingPlanes = [];
    w.visible = true;
  }

  function frame(now) {
    requestAnimationFrame(frame);
    if (!visible || !path || window.__bgCover) { last = now; return; } // a drone clip fully covers the lake: rest
    if (!rm) gov.tick(now);
    const dt = Math.min(0.05, Math.max(0.0005, (now - (last || now)) / 1000)); last = now; frameN++;
    const t = rm ? 0 : (now - t0) / 1000;
    const target = measure();
    tS = rm ? Math.round(target) : tS + (target - tS) * (1 - Math.exp(-dt * (S0.lenis ? 14 : 6)));
    if (rm) { if (tS === rmDrawn) return; rmDrawn = tS; }
    const k = rm ? (tS >= N - 1 ? 1 : 0) : flight(tS);
    path.p.getPoint(k, tmpP); path.l.getPoint(k, tmpL);
    mouse.lerp(mt, 1 - Math.exp(-dt * 3));
    const alt = Math.max(2, tmpP.y), sway = rm ? 0 : 1;
    // a camera held by hand near the ground, a slow drift up high
    C.position.copy(tmpP).add(V(mouse.x * alt * 0.012 * sway + Math.sin(t * 0.21) * 0.06 * sway, -mouse.y * alt * 0.006 * sway + Math.sin(t * 0.33) * 0.04 * sway, 0));
    C.lookAt(tmpL);
    sun.position.copy(C.position).addScaledVector(sunDir, 5000); sun.target.position.copy(C.position);
    if (world.wU) world.wU.uT.value = t;
    if (world.canoes) world.canoes.forEach((c) => { c.position.y = 0.02 + Math.sin(t * 1.1 + c.userData.ph) * 0.025 * sway; c.rotation.z = Math.sin(t * 0.8 + c.userData.ph) * 0.025 * sway; });
    if (refOn && (Q >= 3 || frameN % 2 === 0 || rm)) renderReflection();
    RL.render(dt);
  }

  window.__world = { S, C, R, gov, world, RL };
  S0.boot(Promise.all([RL.ready, build.then(makePath)]), () => { rmDrawn = -1; });
  requestAnimationFrame(frame);
})();
