/* Photographic look shared by the light pages (Home, Projects, Credits).
   A real HDR photograph lights the scene and fills the sky, a photo-scanned frosted-grass ground runs out to the
   horizon under matching mist, and a camera-like finish (depth of field, film response, grain, lens vignette,
   faint chromatic fringing and halation) makes it read as footage rather than a render.
   Usage: const RL = REAL.setup(renderer, scene, camera, { hdr, ground: true, focus: 11, aperture: 0.00018 });
          RL.ready (Promise), RL.render(dt), RL.setFocus(metres), RL.resize() */
(function () {
  const T = THREE;
  function setup(R, S, C, o) {
    o = Object.assign({ hdr: 'assets/textures/misty_dawn_2k.hdr', ground: true, groundY: 0, focus: 11, aperture: 0.00016, maxblur: 0.0055, exposure: 0.92, fogDensity: 0.011, mobile: innerWidth < 760 }, o || {});
    // linear pipeline: the final pass does the film response once
    R.toneMapping = T.NoToneMapping; R.outputEncoding = T.LinearEncoding;
    const pm = new T.PMREMGenerator(R);
    const fogCol = new T.Color('#C9D3DA');
    S.fog = new T.FogExp2(fogCol, o.fogDensity);
    let groundMesh = null;
    const uBg = { value: null }, uBgOn = { value: 0 };
    // Sharp backdrop: slices cut from the 16K original where the camera looks (o.crops), the 2K photo everywhere else.
    // Slices store y = x / (x + k) at gamma 1/2.2, so the exact linear HDR value comes back out in the shader.
    const crops = (o.crops || []).slice(0, 2), lowRes = Math.min(innerWidth, 2400) * Math.min(devicePixelRatio || 1, 2) < 1700;
    const bgU = { tBgLo: uBg, uBgOn, uK: { value: o.cropK || 1 }, tCa: { value: null }, tCb: { value: null }, uRa: { value: new T.Vector4(0, 0, 0, 0) }, uRb: { value: new T.Vector4(0, 0, 0, 0) }, uOnA: { value: 0 }, uOnB: { value: 0 } };
    const cropLoads = crops.map((c, i) => new Promise((done) => {
      new T.TextureLoader().load(lowRes && c.half ? c.half : c.url, (tx) => {
        tx.anisotropy = R.capabilities.getMaxAnisotropy ? R.capabilities.getMaxAnisotropy() : 8; tx.minFilter = T.LinearMipmapLinearFilter; tx.generateMipmaps = true;
        const k = i ? 'b' : 'a'; bgU['tC' + k].value = tx; bgU['uR' + k].value.set(c.u0, c.v0, c.u1, c.v1); bgU['uOn' + k.toUpperCase()].value = 1; done();
      }, undefined, () => done());
    }));
    const BG_GLSL = [
      'uniform sampler2D tBgLo, tCa, tCb; uniform vec4 uRa, uRb; uniform float uOnA, uOnB, uK, uBgOn;',
      'vec3 bgDec(vec3 s){ vec3 y = min(pow(s, vec3(2.2)), vec3(0.9995)); return uK * y / (1.0 - y); }',
      'float bgW(vec2 q){ return smoothstep(0.0, 0.025, q.x) * smoothstep(0.0, 0.025, 1.0 - q.x) * smoothstep(0.0, 0.05, q.y) * smoothstep(0.0, 0.05, 1.0 - q.y); }',
      'vec3 bgSample(vec3 d){ d = normalize(d); vec2 uv = vec2(atan(d.z, d.x) * 0.15915494 + 0.5, asin(clamp(d.y, -1.0, 1.0)) * 0.31830989 + 0.5);',
      '  vec3 c = texture2D(tBgLo, uv).rgb;',
      '  vec2 qa = (uv - uRa.xy) / max(uRa.zw - uRa.xy, vec2(1e-5)); vec3 ca = bgDec(texture2D(tCa, clamp(qa, 0.0, 1.0)).rgb); c = mix(c, ca, bgW(qa) * uOnA);',
      '  vec2 qb = (uv - uRb.xy) / max(uRb.zw - uRb.xy, vec2(1e-5)); vec3 cb = bgDec(texture2D(tCb, clamp(qb, 0.0, 1.0)).rgb); c = mix(c, cb, bgW(qb) * uOnB);',
      '  return c; }',
      'vec3 bgLo(vec3 d){ d = normalize(d); return texture2D(tBgLo, vec2(atan(d.z, d.x) * 0.15915494 + 0.5, asin(clamp(d.y, -1.0, 1.0)) * 0.31830989 + 0.5)).rgb; }'].join('\n');
    let dome = null;
    if (crops.length) {
      dome = new T.Mesh(new T.SphereGeometry(420, 48, 24), new T.ShaderMaterial({ uniforms: bgU, side: T.BackSide, depthWrite: false, fog: false,
        vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: BG_GLSL + '\nvarying vec3 vDir; void main(){ gl_FragColor = vec4(bgSample(vDir), 1.0); }' }));
      dome.renderOrder = -1000; dome.frustumCulled = false; dome.visible = false; S.add(dome);
    }
    const ready = new Promise((res) => {
      new T.RGBELoader().load(o.hdr, (tx) => {
        tx.mapping = T.EquirectangularReflectionMapping;
        // turn the panorama (o.turn = fraction of a full turn) so nothing large sits behind the text
        if (o.turn) { const W = tx.image.width, H = tx.image.height, d = tx.image.data, ch = d.length / (W * H), out = new d.constructor(d.length), sh = Math.round(o.turn * W);
          for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const nx = (x + sh) % W, a = (y * W + x) * ch, b = (y * W + nx) * ch; for (let k = 0; k < ch; k++) out[b + k] = d[a + k]; }
          tx.image.data = out; tx.needsUpdate = true; }
        S.background = tx; S.environment = pm.fromEquirectangular(tx).texture;
        uBg.value = tx; uBgOn.value = 1;
        if (dome) { dome.visible = true; S.background = null; }
        // match the mist to the photo's horizon so the ground melts into it
        try {
          const W = tx.image.width, H = tx.image.height, d = tx.image.data, ch = d.length / (W * H), f = tx.type === T.HalfFloatType ? T.DataUtils.fromHalfFloat : (v) => v;
          let r = 0, g = 0, b = 0, n = 0;
          for (let y = Math.floor(H * 0.47); y < Math.floor(H * 0.5); y++) for (let x = 0; x < W; x += 4) { const i = (y * W + x) * ch; r += f(d[i]); g += f(d[i + 1]); b += f(d[i + 2]); n++; }
          S.fog.color.setRGB(r / n, g / n, b / n);
        } catch (e) {}
        Promise.all(cropLoads).then(res);
      }, undefined, () => res());
    });
    // photo-scanned frosted grass ground (Poly Haven "withered_grass", CC0)
    if (o.ground) {
      const TL = new T.TextureLoader(), tl = (f, srgb) => { const t = TL.load(f); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(220, 220); t.anisotropy = 8; if (srgb) t.encoding = T.sRGBEncoding; return t; };
      const g = new T.PlaneGeometry(900, 900, 1, 1); g.rotateX(-Math.PI / 2); g.setAttribute('uv2', g.attributes.uv);
      const m = new T.MeshStandardMaterial({ map: tl('assets/textures/withered_grass_diff.jpg', true), normalMap: tl('assets/textures/withered_grass_nor_gl.jpg'), roughnessMap: tl('assets/textures/withered_grass_rough.jpg'), color: 0xa9b3b4, envMapIntensity: 0.8 });
      // break up tiling with large-scale tone variation and a frosty sheen in the low spots
      m.onBeforeCompile = (sh) => {
        // far away, the ground dissolves into the photograph behind it, so there is no seam at the horizon
        Object.assign(sh.uniforms, bgU);
        sh.fragmentShader = BG_GLSL + '\n' + sh.fragmentShader.replace('#include <fog_fragment>', '#include <fog_fragment>\n { float dd = length(vWG.xz - cameraPosition.xz); float w = smoothstep(45.0, 220.0, dd) * uBgOn; gl_FragColor.rgb = mix(gl_FragColor.rgb, bgLo(vWG - cameraPosition), w); }');
        sh.vertexShader = 'varying vec3 vWG;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n vWG = (modelMatrix * vec4(transformed, 1.0)).xyz;');
        sh.fragmentShader = 'varying vec3 vWG;\nfloat gh(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); } float gn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(gh(i),gh(i+vec2(1,0)),f.x),mix(gh(i+vec2(0,1)),gh(i+vec2(1,1)),f.x),f.y); }\n' +
          sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n { vec2 q = vWG.xz; float v = gn(q * 0.03) * 0.6 + gn(q * 0.11) * 0.4; diffuseColor.rgb *= 0.78 + 0.42 * v; float frost = smoothstep(0.55, 0.85, gn(q * 0.07 + 3.0)); diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.80, 0.85, 0.88), frost * 0.35); }');
      };
      const ground = new T.Mesh(g, m); ground.position.y = o.groundY - 0.004; ground.receiveShadow = true; S.add(ground); groundMesh = ground;
    }
    // camera finish
    const comp = new T.EffectComposer(R, new T.WebGLRenderTarget(4, 4, { type: T.HalfFloatType }));
    comp.addPass(new T.RenderPass(S, C));
    const bokeh = new T.BokehPass(S, C, { focus: o.focus, aperture: o.aperture, maxblur: o.maxblur, width: innerWidth, height: innerHeight });
    if (o.dof && !o.mobile) comp.addPass(bokeh); // off by default: Shreyansh wants a crisp, not blurred, background
    const bloom = new T.UnrealBloomPass(new T.Vector2(256, 256), 0.22, 0.8, 0.92); comp.addPass(bloom);
    const grade = new T.ShaderPass({
      uniforms: { tDiffuse: { value: null }, uT: { value: 0 }, uExp: { value: o.exposure }, uRes: { value: new T.Vector2(1, 1) }, uFlash: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: [
        'uniform sampler2D tDiffuse; uniform float uT, uExp, uFlash; uniform vec2 uRes; varying vec2 vUv;',
        'float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }',
        // ACES fitted (Hill) for a filmic shoulder
        'vec3 RRT(vec3 v){ vec3 a = v*(v + 0.0245786) - 0.000090537; vec3 b = v*(0.983729*v + 0.4329510) + 0.238081; return a/b; }',
        'vec3 aces(vec3 c){ const mat3 i = mat3(0.59719,0.07600,0.02840, 0.35458,0.90834,0.13383, 0.04823,0.01566,0.83777); const mat3 o = mat3(1.60475,-0.10208,-0.00327, -0.53108,1.10813,-0.07276, -0.07367,-0.00605,1.07602); return clamp(o * RRT(i * c), 0.0, 1.0); }',
        'void main(){',
        '  vec2 c = vUv - 0.5; float r2 = dot(c, c); vec2 off = c * 0.0005 * (1.0 + r2 * 2.0);',
        '  vec3 col = vec3(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b);',
        // halation: a little red-orange glow around bright edges, like film
        '  vec3 blur = (texture2D(tDiffuse, vUv + vec2(0.004, 0.0)).rgb + texture2D(tDiffuse, vUv - vec2(0.004, 0.0)).rgb + texture2D(tDiffuse, vUv + vec2(0.0, 0.004)).rgb + texture2D(tDiffuse, vUv - vec2(0.0, 0.004)).rgb) * 0.25;',
        '  col += max(blur - 1.0, 0.0) * vec3(0.30, 0.10, 0.04);',
        '  col = aces(col * uExp);',
        '  col = pow(col, vec3(1.0/2.2));',
        // gentle split tone: cool shadows, neutral highlights
        '  float l = dot(col, vec3(0.2126,0.7152,0.0722)); col += vec3(-0.012, 0.0, 0.018) * (1.0 - l);',
        '  col *= mix(1.0, smoothstep(1.25, 0.25, r2 * 1.7), 0.5);',
        '  col += (h(vUv * uRes + fract(uT * 7.13) * 91.7) - 0.5) * 0.028;',
        '  col = mix(col, vec3(1.0), uFlash);',
        '  gl_FragColor = vec4(col, 1.0);',
        '}'].join('\n'),
    });
    comp.addPass(grade);
    const resize = () => { const pr = R.getPixelRatio(), w = innerWidth, h = innerHeight; comp.setPixelRatio(pr); comp.setSize(w, h); grade.uniforms.uRes.value.set(w, h); bloom.resolution.set(w / 2, h / 2); };
    window.addEventListener('resize', () => setTimeout(resize, 0)); resize();
    let t = 0;
    return {
      ready, ground: groundMesh, composer: comp, grade: grade.uniforms, bokeh,
      setFocus: (d) => { bokeh.uniforms.focus.value += (d - bokeh.uniforms.focus.value) * 0.12; },
      resize,
      render: (dt) => { if (dome) dome.position.copy(C.position); t += dt || 0.016; grade.uniforms.uT.value = t; if (comp._w !== R.domElement.width) { comp._w = R.domElement.width; resize(); } comp.render(dt || 0.016); },
    };
  }
  window.REAL = { setup };
})();
