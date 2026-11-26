/* Sky Sentry: the approach, real-time. three.js r147 (global THREE), FK (kit.js), SITE (core.js).
   One scroll-scrubbed film inside #film (eight shots), then a quiet sky-above-the-clouds backdrop behind the sections after it.
   Reuses the previous build's 747 livery, runway markings, airfield lights, control tower and monitors (legacy/web/sky-film.js);
   the cockpit, clouds, flock, drone, sensor view and every camera move are new.
   Test hook: window.film.setProgress(p) jumps the film to p (0..1). */
(function () {
  const T = THREE, S0 = window.SITE, FK = window.FK, V = (x, y, z) => new T.Vector3(x, y, z);
  const ss = FK.ss, lerp = FK.lerp, clamp = FK.clamp;
  const film = document.getElementById('film'), stage = document.getElementById('stage'), cv = document.getElementById('sky'), ovl = document.getElementById('ovl'), framesCv = document.getElementById('frames');

  // ================= interactive detection & risk simulator (works in all modes, including reduced motion) =================
  (function initSimulator() {
    const simCv = document.getElementById('sim-canvas');
    const inFlock = document.getElementById('sim-flock');
    const inDist = document.getElementById('sim-dist');
    const inDrone = document.getElementById('sim-drone');
    if (!simCv || !inFlock || !inDist || !inDrone) return;
    const ctx = simCv.getContext('2d');
    const outFlock = document.getElementById('sim-flock-v');
    const outDist = document.getElementById('sim-dist-v');
    const pill = document.getElementById('sim-pill');
    const barMask = document.getElementById('sim-bar-mask');
    const scoreEl = document.getElementById('sim-score');
    const gemEl = document.getElementById('sim-gemini');
    const actEl = document.getElementById('sim-action');
    const solEl = document.getElementById('sim-solana');
    const solTitle = document.getElementById('sim-sol-title');
    const solMeta = document.getElementById('sim-sol-meta');
    const solHash = document.getElementById('sim-sol-hash');

    const seeds = Array.from({ length: 80 }, (_, i) => {
      const a = Math.sin(i * 12.9898) * 43758.5453;
      const b = Math.sin((i + 17) * 78.233) * 43758.5453;
      const c = Math.sin((i + 53) * 39.425) * 43758.5453;
      return { rx: (a - Math.floor(a)) - 0.5, ry: (b - Math.floor(b)) - 0.5, ph: (c - Math.floor(c)) * Math.PI * 2, sp: 0.7 + (a - Math.floor(a)) * 0.7 };
    });

    function deterministicHash(str) {
      let h1 = 0xdeadbeef ^ str.length, h2 = 0x41c6ce57 ^ str.length, h3 = 0x1b873593, h4 = 0x85ebca6b;
      for (let i = 0; i < str.length; i++) {
        const ch = str.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
        h3 = Math.imul(h3 ^ (ch << 3), 2246822519);
        h4 = Math.imul(h4 ^ (ch << 5), 3266489917);
      }
      const hex = (n) => (n >>> 0).toString(16).padStart(8, '0');
      return (hex(h1) + hex(h2) + hex(h3) + hex(h4) + hex(h1 ^ h3) + hex(h2 ^ h4) + hex(h1 + h4) + hex(h2 + h3)).slice(0, 64);
    }

    function computeState() {
      const flock = clamp(parseInt(inFlock.value, 10) || 1, 1, 80);
      const dist = clamp(parseInt(inDist.value, 10) || 50, 50, 1500);
      const drone = !!inDrone.checked;
      const proximity = clamp(1 - (dist - 50) / 1450, 0, 1);
      const density = clamp(flock / 60, 0, 1);
      const raw = Math.round(clamp((proximity * 54 + density * 34 + (drone ? 22 : 0)), 4, 100));
      const lvl = raw >= 66 ? 'high' : raw >= 36 ? 'warn' : 'low';
      const eta = Math.max(3, Math.round(dist / 19.5));
      return { flock, dist, drone, raw, lvl, eta };
    }

    let simState = computeState();

    function updateReadouts() {
      simState = computeState();
      const { flock, dist, drone, raw, lvl, eta } = simState;
      const totalObj = flock + (drone ? 1 : 0);
      if (outFlock) outFlock.textContent = flock + (flock === 1 ? ' bird' : ' birds');
      if (outDist) outDist.textContent = dist + ' m';
      if (pill) {
        pill.dataset.lvl = lvl;
        pill.textContent = lvl === 'high' ? 'HIGH · GO AROUND' : lvl === 'warn' ? 'ELEVATED · CAUTION' : 'LOW · MONITORING';
      }
      if (barMask) barMask.style.transform = `scaleX(${((100 - raw) / 100).toFixed(3)})`;
      if (scoreEl) scoreEl.textContent = `Score ${raw} / 100 · ${totalObj} tracked ${totalObj === 1 ? 'object' : 'objects'} · Range ${dist} m`;
      if (actEl) actEl.textContent = lvl === 'high' ? 'SPOKEN ALERT FIRED' : lvl === 'warn' ? 'TOWER ADVISORY' : 'PASSIVE LOGGING';
      if (gemEl) {
        const rec = lvl === 'high'
          ? 'Issue immediate go-around on RWY 27; spoken alert queued (<0.5 s).'
          : lvl === 'warn'
            ? 'Advise incoming traffic on final; keep visual watch on corridor.'
            : 'Clear for approach; hourly counts logged to TigerData.';
        gemEl.textContent =
          `SECTOR   RWY 27 FINAL · CAM 02\n` +
          `OBJECTS  ${flock} Canada ${flock === 1 ? 'goose' : 'geese'}${drone ? ' + 1 quadcopter drone' : ''}\n` +
          `CLOSING  ${dist} m from threshold (ETA ~${eta} s)\n` +
          `ACTION   ${rec}`;
      }
      if (solEl && solTitle && solMeta && solHash) {
        const stamp = drone || lvl === 'high';
        solEl.dataset.verified = stamp ? 'true' : 'false';
        if (stamp) {
          const payload = `sky-sentry|rwy27|flock=${flock}|dist=${dist}|drone=${drone ? 1 : 0}|risk=${raw}`;
          solTitle.textContent = drone ? 'Solana Devnet Memo · Verified' : 'High-Risk Incident · Tamper-Evident';
          solMeta.textContent = drone ? 'Drone incident hashed (SHA-256) and stamped on Solana devnet' : 'Logged to MongoDB + SHA-256 integrity digest ready';
          solHash.textContent = 'sha256:' + deterministicHash(payload);
        } else {
          solTitle.textContent = 'Solana Stamp · Standby';
          solMeta.textContent = 'No drone in corridor; telemetry stored in TigerData time-series';
          solHash.textContent = 'Enable drone toggle or raise risk to stamp a devnet memo.';
        }
      }
    }

    function drawSim(t) {
      const w = simCv.width, h = simCv.height;
      const { flock, dist, drone, raw, lvl } = simState;
      const prox = clamp(1 - (dist - 50) / 1450, 0, 1);

      // Cold dawn snowy sky + runway horizon
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#182534');
      g.addColorStop(0.48, '#384c61');
      g.addColorStop(0.62, '#99adbf');
      g.addColorStop(0.66, '#d9e3ec');
      g.addColorStop(1, '#a9bac9');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      // Runway 27 perspective strip
      ctx.fillStyle = '#252f3a';
      ctx.beginPath();
      ctx.moveTo(w * 0.45, h * 0.64);
      ctx.lineTo(w * 0.55, h * 0.64);
      ctx.lineTo(w * 0.72, h);
      ctx.lineTo(w * 0.28, h);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(244,247,250,0.75)';
      ctx.lineWidth = 2;
      ctx.setLineDash([12, 10]);
      ctx.beginPath(); ctx.moveTo(w * 0.5, h * 0.65); ctx.lineTo(w * 0.5, h); ctx.stroke();
      ctx.setLineDash([]);

      // Approach corridor cone
      const corAlpha = lvl === 'high' ? 0.22 : lvl === 'warn' ? 0.16 : 0.11;
      ctx.fillStyle = lvl === 'high' ? `rgba(217,56,46,${corAlpha})` : `rgba(47,111,228,${corAlpha})`;
      ctx.strokeStyle = lvl === 'high' ? 'rgba(255,105,95,0.78)' : 'rgba(169,203,227,0.78)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([7, 6]);
      ctx.beginPath();
      ctx.moveTo(w * 0.12, h * 0.20);
      ctx.lineTo(w * 0.88, h * 0.34);
      ctx.lineTo(w * 0.88, h * 0.74);
      ctx.lineTo(w * 0.12, h * 0.82);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]);

      // Simulated flock cluster positioned by distance-to-runway
      const cx = lerp(w * 0.18, w * 0.52, prox);
      const cy = lerp(h * 0.30, h * 0.48, prox);
      const spreadX = lerp(95, 165, prox);
      const spreadY = lerp(42, 72, prox);
      const boxCap = Math.min(flock, 24);

      for (let i = 0; i < flock; i++) {
        const s = seeds[i];
        const bx = cx + s.rx * spreadX + Math.sin(t * s.sp + s.ph) * 14;
        const by = cy + s.ry * spreadY + Math.cos(t * (s.sp * 1.2) + s.ph) * 8;
        const flap = Math.sin(t * 7.5 + s.ph) * 4;
        // Bird silhouette
        ctx.strokeStyle = '#0F1B26';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(bx - 7, by + flap);
        ctx.quadraticCurveTo(bx - 3, by - 3, bx, by);
        ctx.quadraticCurveTo(bx + 3, by - 3, bx + 7, by + flap);
        ctx.stroke();

        // Signal-blue tracking boxes on representative detections
        if (i < boxCap) {
          const bw = lerp(18, 28, prox), bh = lerp(15, 22, prox);
          ctx.strokeStyle = '#2F6FE4';
          ctx.lineWidth = 1.6;
          ctx.strokeRect(bx - bw / 2, by - bh / 2, bw, bh);
          if (i < 6) {
            ctx.fillStyle = '#2F6FE4';
            ctx.fillRect(bx - bw / 2, by - bh / 2 - 13, 36, 12);
            ctx.fillStyle = '#FFFFFF';
            ctx.font = '600 9px "Geist Mono", ui-monospace, monospace';
            ctx.fillText('B-' + String(i + 1).padStart(2, '0'), bx - bw / 2 + 3, by - bh / 2 - 4);
          }
        }
      }

      // Optional quadcopter drone with blinking nav LED & Signal-blue lock
      if (drone) {
        const dx = lerp(w * 0.78, w * 0.66, prox) + Math.sin(t * 1.1) * 10;
        const dy = h * 0.52 + Math.cos(t * 1.7) * 5;
        ctx.fillStyle = '#0F1B26';
        ctx.fillRect(dx - 11, dy - 3, 22, 6);
        ctx.fillRect(dx - 16, dy - 6, 8, 2);
        ctx.fillRect(dx + 8, dy - 6, 8, 2);
        ctx.fillStyle = Math.sin(t * 8) > 0 ? '#ff3b30' : '#3ddc84';
        ctx.beginPath(); ctx.arc(dx, dy + 4, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#2F6FE4';
        ctx.lineWidth = 2;
        ctx.strokeRect(dx - 24, dy - 16, 48, 32);
        ctx.fillStyle = '#2F6FE4';
        ctx.fillRect(dx - 24, dy - 30, 56, 13);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '600 9.5px "Geist Mono", ui-monospace, monospace';
        ctx.fillText('DRN-01', dx - 20, dy - 20);
      }

      // Top sensor HUD bar
      ctx.fillStyle = 'rgba(8,13,19,0.74)';
      ctx.fillRect(14, 14, w - 28, 30);
      ctx.fillStyle = '#EAF2F8';
      ctx.font = '600 11px "Geist Mono", ui-monospace, monospace';
      ctx.fillText(`SKY SENTRY · CAM 02 · RWY 27 FINAL   OBJ ${flock + (drone ? 1 : 0)}   RNG ${dist}m`, 24, 33);
      ctx.fillStyle = lvl === 'high' ? '#ff6b63' : lvl === 'warn' ? '#ffd166' : '#52e59b';
      ctx.textAlign = 'right';
      ctx.fillText(`RISK ${raw}%`, w - 24, 33);
      ctx.textAlign = 'left';
    }

    ['input', 'change'].forEach((ev) => {
      inFlock.addEventListener(ev, () => { updateReadouts(); drawSim(performance.now() * 0.001); });
      inDist.addEventListener(ev, () => { updateReadouts(); drawSim(performance.now() * 0.001); });
      inDrone.addEventListener(ev, () => { updateReadouts(); drawSim(performance.now() * 0.001); });
    });
    updateReadouts();
    drawSim(0);

    if (!S0.rm) {
      let simVis = false;
      const io = window.IntersectionObserver ? new IntersectionObserver((ents) => { simVis = ents[0].isIntersecting; }, { threshold: 0.05 }) : null;
      if (io) io.observe(simCv); else simVis = true;
      const simTick = (now) => {
        if (!document.hidden && simVis) drawSim(now * 0.001);
      };
      SITE.loop(simTick);
    }
  })();

  if (!S0.glOk || S0.rm || !film) { S0.boot(Promise.resolve()); return; }
  const mobile = innerWidth < 760 || Math.min(innerWidth, innerHeight) < 560;
  const DEG = Math.PI / 180, TAN3 = Math.tan(3 * DEG), AIM = 400, gsY = (x) => (AIM - x) * TAN3;
  const CB = 420, CTOP = 1500;                 // cloud base and tops (m)
  const TWR = V(160, 0, 260), CAB = 36.0;      // FAA control tower beside Runway 27 approach/apron, cab floor height
  const SENT = V(-95, 1.45, -72);              // Sky Sentry's phone on its tripod, beside the approach lights
  const DRONE0 = V(-210, 22, -145);            // the drone, near the perimeter fence
  const SUN = V(0.83, 0.012, -0.56).normalize();
  const SIGNAL = '#2F6FE4';
  const loads = [];
  const rnd = FK.rng(17);

  // ================= renderer, camera, post =================
  const R = new T.WebGLRenderer({ canvas: cv, antialias: PERF.high, powerPreference: 'high-performance', logarithmicDepthBuffer: true });
  R.outputEncoding = T.LinearEncoding; R.toneMapping = T.NoToneMapping;
  R.shadowMap.enabled = !PERF.low; R.shadowMap.type = PERF.high ? T.PCFSoftShadowMap : T.PCFShadowMap; R.shadowMap.autoUpdate = false;
  const S = new T.Scene(), C = new T.PerspectiveCamera(50, 1, 0.05, 120000);
  const comp = new T.EffectComposer(R, new T.WebGLRenderTarget(4, 4, { type: T.HalfFloatType }));
  comp.addPass(new T.RenderPass(S, C));
  const bloom = new T.UnrealBloomPass(new T.Vector2(256, 256), 0.42, 0.42, 0.92); if (!PERF.low) comp.addPass(bloom); // phones skip the glow
  const grade = new T.ShaderPass({
    uniforms: { tDiffuse: { value: null }, uT: { value: 0 }, uExp: { value: 1 }, uWhite: { value: 0 }, uDip: { value: 0 }, uSensor: { value: 0 }, uCA: { value: 0.0005 }, uVig: { value: 0.36 },
      uGrain: { value: 0.008 }, uSat: { value: 1 }, uLift: { value: 0 }, uTint: { value: new T.Vector3(1, 1, 1) }, uRes: { value: new T.Vector2(1, 1) } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: [
      'uniform sampler2D tDiffuse; uniform float uT, uExp, uWhite, uDip, uSensor, uCA, uVig, uGrain, uSat, uLift; uniform vec3 uTint; uniform vec2 uRes; varying vec2 vUv;',
      'float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }',
      'vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14), 0.0, 1.0); }',
      'void main(){',
      '  vec2 uv = vUv; uv.x += sin(uv.y*220.0 + uT*40.0) * 0.0004 * uSensor;',
      '  vec2 c = uv - 0.5; float r2 = dot(c, c); vec2 o = c * (uCA + uSensor*0.0025) * (1.0 + r2*3.0);',
      '  vec3 col = vec3(texture2D(tDiffuse, uv + o).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - o).b);',
      '  col *= uExp * uTint;',
      '  float l = dot(col, vec3(0.2126, 0.7152, 0.0722)); col = mix(vec3(l), col, uSat);',
      '  col = pow(aces(col), vec3(1.0/2.2));',
      '  col = col * (1.0 - uLift) + uLift;',
      '  col *= mix(1.0, smoothstep(1.3, 0.15, r2*1.5), uVig);',
      '  if (uSensor > 0.0) {',
      '    float ln = dot(col, vec3(0.3, 0.59, 0.11)); vec3 sc = mix(vec3(ln), col, 0.68) * vec3(0.95, 1.0, 1.04);',
      '    vec2 px = floor(uv * uRes / 1.5); sc += (h(px + fract(uT*17.0)*91.0) - 0.5) * 0.04;',
      '    sc *= 0.98 + 0.02*sin(uv.y*uRes.y*1.5);',
      '    col = mix(col, sc, uSensor); }',
      '  col += (h(uv*uRes + fract(uT*13.1)*91.7) - 0.5) * uGrain;',
      '  col = mix(col, vec3(1.0), uWhite); col *= 1.0 - uDip;',
      '  gl_FragColor = vec4(col, 1.0);',
      '}'].join('\n'),
  });
  comp.addPass(grade);
  const G = grade.uniforms;
  let W = innerWidth, H = innerHeight, curPR = PERF.startPR(W, H);
  const applySize = () => { const pr = curPR; R.setPixelRatio(pr); R.setSize(W, H, false); comp.setPixelRatio(pr); comp.setSize(W, H); bloom.resolution.set(Math.max(64, W >> 2), Math.max(64, H >> 2)); G.uRes.value.set(W * pr, H * pr); sizeOvl(); };
  const sizeOvl = () => { const pr = Math.max(1.0, Math.min(window.devicePixelRatio || 1, 2)); ovl.width = Math.round(W * pr); ovl.height = Math.round(H * pr); ovl.style.width = W + 'px'; ovl.style.height = H + 'px'; };
  const resize = () => { W = innerWidth; H = innerHeight; C.aspect = W / H; C.updateProjectionMatrix(); applySize(); };
  window.addEventListener('resize', resize); resize();
  // frame-time governor: the shared PERF governor (tier budget first, then held at 60 fps, stepping up only while smooth)
  const gov = PERF.governor((pr) => { curPR = pr; applySize(); }, () => [W, H]); gov.started = true; gov.pr = curPR; gov.settle = 40;
  const govern = (now) => gov.tick(now);

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

  // ================= clouds: streamlined volumetric slices (fast FPS, crisp overcast) =================
  const NSL = PERF.high ? 7 : PERF.mid ? 5 : 4; // cloud layers by device tier
  const cloudU = { uT: { value: 0 }, uFogD: { value: 0.0001 }, uFogC: { value: new T.Color() }, uLit: { value: new T.Color() }, uShade: { value: new T.Color() }, uSunC: { value: new T.Color() }, uSun: { value: SUN.clone() }, uDen: { value: mobile ? 0.36 : 0.28 }, uClear: { value: 1 } };
  const cloudVS = LOGV + 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w;\n#include <logdepthbuf_vertex>\n}';
  const cloudFS = LOGF + NOISE + [
    '\nuniform float uT, uH, uFogD, uDen, uClear; uniform vec3 uLit, uShade, uSunC, uSun, uFogC; varying vec3 vW;',
    'float hg(float c, float g){ float g2 = g*g; return (1.0 - g2) / (4.0 * 3.14159265 * pow(max(1.0 + g2 - 2.0*g*c, 0.01), 1.5)); }',
    'void main(){',
    '  vec3 d = vW - cameraPosition; float dist = length(d); vec3 vd = d / max(dist, 1e-3);',
    '  vec2 q = vW.xz * 0.00042 + vec2(uT*0.0035, uT*0.0012);',
    '  float n = 0.0, a = 0.5; vec3 p = vec3(q, uH*1.25);',
    '  for (int i = 0; i < 2; i++){ n += a*nn3(p); p = p*2.07 + vec3(1.7, 9.2, 3.1); a *= 0.5; }',
    '  n = n * 1.1 + nn3(vec3(vW.xz*0.0024, uH*3.0 + uT*0.02)) * 0.16;',
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

  // ================= ground: the real Hudson Valley around Stewart International (KSWF), New York =================
  // Elevation: AWS Terrain Tiles. Imagery: USGS National Map aerial photos (public domain) near the airport and along the
  // approach, Sentinel-2 cloudless (EOX) to the horizon. Everything is resampled into this scene's frame offline: the origin
  // is runway 27's landing threshold, +x runs down the runway (258 deg true), +z is to its right (north).
  const grp = { airport: new T.Group(), plane: new T.Group(), flock: new T.Group(), tower: new T.Group(), cockpit: null };
  S.add(grp.airport);
  const GQ = PERF.ultra ? 4 : PERF.high ? 3 : PERF.mid ? 2 : 1;
  const SWF = 'assets/swf/';
  const terrain = { ready: false, meta: null, mid: null, far: null };
  // height of the real ground under any point (metres above the threshold); 0 until the data has loaded
  const groundY = (x, z) => {
    const m = terrain.meta; if (!m) return 0;
    const pick = (H, g) => { const fx = (x - g.x0) / (g.x1 - g.x0) * (g.w - 1), fz = (z - g.z0) / (g.z1 - g.z0) * (g.h - 1); if (fx < 0 || fz < 0 || fx > g.w - 1 || fz > g.h - 1) return null;
      const ix = Math.min(g.w - 2, Math.floor(fx)), iz = Math.min(g.h - 2, Math.floor(fz)), tx = fx - ix, tz = fz - iz, at = (i, j) => H[j * g.w + i] / 10 - 1000;
      return (at(ix, iz) * (1 - tx) + at(ix + 1, iz) * tx) * (1 - tz) + (at(ix, iz + 1) * (1 - tx) + at(ix + 1, iz + 1) * tx) * tz; };
    const h = terrain.mid ? pick(terrain.mid, m.midH) : null; if (h != null) return h;
    const f = terrain.far ? pick(terrain.far, m.farH) : null; return f == null ? 0 : f;
  };
  const tU = { tNear: { value: null }, tMid: { value: null }, tFar: { value: null }, tDet: { value: null }, tAsp: { value: null },
    uNear: { value: new T.Vector4() }, uMid: { value: new T.Vector4() }, uFar: { value: new T.Vector4() } };
  const terrainMat = (far) => {
    const m = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.97, metalness: 0, envMapIntensity: 0.2 });
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, tU);
      sh.vertexShader = 'varying vec3 vWP;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = 'varying vec3 vWP; uniform sampler2D tNear, tMid, tFar, tDet, tAsp; uniform vec4 uNear, uMid, uFar;\n' + sh.fragmentShader.replace('#include <map_fragment>', [
        '{ vec2 q = vWP.xz;',
        '  vec2 uf = (q - uFar.xy) / uFar.zw; vec3 col = texture2D(tFar, uf).rgb;',
        far ? '' : [
          '  vec2 um = (q - uMid.xy) / uMid.zw; float im = step(0.0, um.x) * step(um.x, 1.0) * step(0.0, um.y) * step(um.y, 1.0);',
          '  vec2 em = min(um, 1.0 - um) * uMid.zw; im *= smoothstep(0.0, 900.0, min(em.x, em.y));',
          '  col = mix(col, texture2D(tMid, um).rgb, im);',
          '  vec2 un = (q - uNear.xy) / uNear.zw; vec4 nc = texture2D(tNear, clamp(un, 0.0, 1.0));',
          '  vec2 en = min(un, 1.0 - un) * uNear.zw; float inn = nc.a * smoothstep(0.0, 220.0, min(en.x, en.y)) * step(0.0, min(un.x, un.y));',
          '  col = mix(col, nc.rgb, inn);',
          // close to the camera, a little real grain so the photo's pixels never read as blocks
          // close to the camera the 2 m photo pixels get real surface grain: asphalt where the photo shows pavement, grass where it
          // shows grass, each divided by its own local average so the photo keeps its colours
          '  float dd = length(vWP - cameraPosition); float near = 1.0 - smoothstep(60.0, 900.0, dd);',
          '  float mxc = max(col.r, max(col.g, col.b)), sat = (mxc - min(col.r, min(col.g, col.b))) / max(mxc, 1e-3);',
          '  float paved = smoothstep(0.24, 0.1, sat) * smoothstep(0.18, 0.32, dot(col, vec3(0.333)));',
          '  vec3 dg = texture2D(tDet, q / 7.0).rgb / max(texture2D(tDet, q / 7.0, 9.0).rgb, vec3(0.04));',
          '  vec3 da = texture2D(tAsp, q / 5.0).rgb / max(texture2D(tAsp, q / 5.0, 9.0).rgb, vec3(0.04));',
          '  vec3 det = mix(dg, da, paved); det = mix(vec3(1.0), det, 0.85);',
          '  col *= mix(vec3(1.0), det, near * 0.9);'].join('\n'),
        '  diffuseColor.rgb *= col; }'].join('\n'))
        .replace('#include <output_fragment>', [
          // the aerial photos carry their own daylight: keep most of it, cooled to the dawn, and let the live sun and shadows add the rest
          '{ float lm = dot(diffuseColor.rgb, vec3(0.333)); outgoingLight = mix(outgoingLight, diffuseColor.rgb * vec3(0.62, 0.68, 0.78) * (1.0 - 0.28 * smoothstep(0.35, 0.7, lm)), 0.62); }',
          '#include <output_fragment>'].join('\n'));
    };
    m.customProgramCacheKey = () => 'swf-terrain-' + (far ? 1 : 0);
    return m;
  };
  const gridGeo = (H, g, step, adjust) => {
    const cols = Math.floor((g.w - 1) / step) + 1, rows = Math.floor((g.h - 1) / step) + 1;
    const pos = new Float32Array(cols * rows * 3), idx = new Uint32Array((cols - 1) * (rows - 1) * 6);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const ix = Math.min(g.w - 1, c * step), iz = Math.min(g.h - 1, r * step), i = (r * cols + c) * 3;
      const x = g.x0 + ix / (g.w - 1) * (g.x1 - g.x0), z = g.z0 + iz / (g.h - 1) * (g.z1 - g.z0);
      pos[i] = x; pos[i + 1] = adjust(H[iz * g.w + ix] / 10 - 1000, x, z); pos[i + 2] = z;
    }
    let k = 0; for (let r = 0; r < rows - 1; r++) for (let c = 0; c < cols - 1; c++) { const a = r * cols + c, b = a + 1, d = a + cols, e = d + 1; idx[k++] = a; idx[k++] = d; idx[k++] = b; idx[k++] = b; idx[k++] = d; idx[k++] = e; }
    const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(pos, 3)); geo.setIndex(new T.BufferAttribute(idx, 1)); geo.computeVertexNormals(); geo.computeBoundingSphere(); return geo;
  };
  const stex = (url, mips) => new Promise((res) => TL.load(url, (t) => { t.encoding = T.sRGBEncoding; t.flipY = false; t.anisotropy = R.capabilities.getMaxAnisotropy(); t.wrapS = t.wrapT = T.ClampToEdgeWrapping; if (!mips) { t.generateMipmaps = false; t.minFilter = T.LinearFilter; } res(t); }, undefined, () => res(null)));
  const sbin = (url) => fetch(url).then((r) => r.arrayBuffer()).then((b) => new Uint16Array(b)).catch(() => null);
  loads.push(fetch(SWF + 'meta.json').then((r) => r.json()).then(async (meta) => {
    const hi = GQ >= 3 ? '_hi.webp' : '_lo.webp';
    const [midH, farH, tn, tm, tf, td, ta] = await Promise.all([sbin(SWF + 'mid_h.bin'), sbin(SWF + 'far_h.bin'), stex(SWF + 'near' + hi, true), stex(SWF + 'mid' + hi, true), stex(SWF + 'far' + (GQ >= 2 ? '_hi.webp' : '_lo.webp'), true), ltex('assets/textures/withered_grass_diff.jpg', true), ltex('assets/textures/asphalt_diff.jpg', true)]);
    terrain.meta = meta; terrain.mid = midH; terrain.far = farH;
    const box = (g, v) => v.set(g.x0, g.z0, g.x1 - g.x0, g.z1 - g.z0);
    box(meta.near, tU.uNear.value); box(meta.mid, tU.uMid.value); box(meta.far, tU.uFar.value);
    tU.tNear.value = tn; tU.tMid.value = tm; tU.tFar.value = tf; tU.tDet.value = td; tU.tAsp.value = ta;
    const mg = meta.midH, fg = meta.farH;
    if (midH) { const g = gridGeo(midH, mg, [0, 4, 3, 2, 1][GQ], (h) => h); const mesh = new T.Mesh(g, terrainMat(false)); mesh.receiveShadow = true; grp.airport.add(mesh); terrain.midMesh = mesh; }
    if (farH) { // the wider ground sinks under the detailed ground where they overlap, so the two never fight
      const inMid = (x, z) => Math.min(x - mg.x0, mg.x1 - x, z - mg.z0, mg.z1 - z);
      const g = gridGeo(farH, fg, GQ >= 3 ? 1 : 2, (h, x, z) => { const d = inMid(x, z); return d > 0 ? h - 45 * ss(0, 600, d) : h; });
      const mesh = new T.Mesh(g, terrainMat(true)); grp.airport.add(mesh); terrain.farMesh = mesh;
    }
    terrain.ready = true;
  }).catch((e) => console.warn('terrain failed', e)));

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
      ' float edge = smoothstep(22.6, 23.5, abs(v));',
      ' vec3 col = mix(asp, vec3(0.93, 0.95, 0.97), paint * 0.92);',
      ' float py = max(1.0, uPlanePos.y); float spread = 1.0 + py * 0.045;',
      ' vec2 dp = q - uPlanePos.xz;',
      ' float fus = exp(-((dp.x*dp.x)/(760.0*spread*spread) + (dp.y*dp.y)/(36.0*spread*spread)));',
      ' float wing = exp(-(((dp.x + 2.0)*(dp.x + 2.0))/(95.0*spread*spread) + (dp.y*dp.y)/(780.0*spread*spread)));',
      ' float csh = clamp(max(fus, wing), 0.0, 1.0) * (1.0 - smoothstep(15.0, 220.0, py)) * 0.48;',
      ' col *= (1.0 - csh);',
      ' diffuseColor.rgb *= col;',
      '#endif'].join('\n'));
  };
  rwMat.transparent = false; rwMat.customProgramCacheKey = () => 'sky-runway-2';
  const runway = new T.Mesh(new T.PlaneGeometry(3000, 47).rotateX(-Math.PI / 2), rwMat); runway.position.set(1496, 0.3, 0); runway.receiveShadow = true; grp.airport.add(runway);
  const taxM = new T.MeshStandardMaterial({ color: 0x9a9ea3, roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 });
  const addPave = (w, d, x, z) => { const m = new T.Mesh(new T.PlaneGeometry(w, d).rotateX(-Math.PI / 2), taxM); m.position.set(x, 0.25, z); grp.airport.add(m); return m; };

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

  // city lights where the towns really are: Newburgh, Beacon, New Windsor, the I-84 corridor (picked from the aerial photos' built-up areas)
  let cityPts = null;
  const city = { set renderOrder(v) { if (cityPts) cityPts.renderOrder = v; }, get renderOrder() { return cityPts ? cityPts.renderOrder : 0; } };
  loads.push(Promise.all([sbin(SWF + 'lights.bin'), new Promise((res) => { const w = () => (terrain.ready ? res() : setTimeout(w, 50)); w(); })]).then(([P]) => {
    if (!P) return; const n = Math.min(P.length / 2, [0, 12000, 26000, 42000, 60000][GQ]), cr = FK.rng(31), CL = [];
    const I = new Int16Array(P.buffer);
    for (let i = 0; i < n; i++) { const x = I[i * 2] * 2, z = I[i * 2 + 1] * 2; const sod = cr() < 0.58;
      const c = sod ? [2.6, 1.35, 0.45] : [2.2, 2.35, 2.6]; CL.push([x, groundY(x, z) + 6, z, c[0], c[1], c[2], 1.5 + cr() * 1.5, 0, 0, 0]); }
    cityPts = LightPoints(CL, 0.8, mobile ? 1.2 : 1.0); cityPts.renderOrder = 4; grp.airport.add(cityPts);
  }));

  // ================= airport buildings =================
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
  const snowRoof = new T.MeshStandardMaterial({ color: 0x6f747a, roughness: 0.85 }); // roofing membrane (the name stays from the winter version)
  const concM = new T.MeshStandardMaterial({ color: 0x8f8a84, roughness: 0.9 });
  // perimeter fence (posts and chain-link) on the approach side
  { const fenceT = ctex(cnv(64, 64, (x) => { x.strokeStyle = 'rgba(150,160,170,.95)'; x.lineWidth = 2; x.beginPath(); x.moveTo(0, 0); x.lineTo(64, 64); x.moveTo(64, 0); x.lineTo(0, 64); x.stroke(); }), true, [520, 1]);
    const fm = new T.MeshStandardMaterial({ map: fenceT, transparent: true, alphaTest: 0.3, side: T.DoubleSide, roughness: 0.5, metalness: 0.6 });
    const fence = new T.Mesh(new T.PlaneGeometry(1560, 2.4), fm); fence.position.set(-170, 1.2, -182); grp.airport.add(fence);
    const post = new T.InstancedMesh(new T.CylinderGeometry(0.04, 0.04, 2.7, 6), new T.MeshStandardMaterial({ color: 0x6d747b, metalness: 0.6, roughness: 0.4 }), 520); const m4 = new T.Matrix4();
    for (let i = 0; i < 520; i++) { m4.makeTranslation(-950 + i * 3, 1.35, -182); post.setMatrixAt(i, m4); } grp.airport.add(post);
    const wire = new T.Mesh(new T.CylinderGeometry(0.01, 0.01, 1560, 4).rotateZ(Math.PI / 2), fm); wire.position.set(-170, 2.62, -182); grp.airport.add(wire); }

  // ================= real-life FAA ATCT control tower (exterior and panoramic cab with 19 monitors + 3 controllers) =================
  const screens = {};
  function person(cloth, skin, hair, opt) {
    opt = opt || {};
    const standing = !!opt.standing, bino = !!opt.bino, shirtCol = opt.collar || 0x9aa6b4;
    // Built facing local -Z (toward consoles & panoramic windows); realistic slim human proportions
    const g = new T.Group(), M = (c, r, mt) => new T.MeshStandardMaterial({ color: c, roughness: r == null ? 0.9 : r, metalness: mt || 0, envMapIntensity: 0.08 });
    const cm = M(cloth, 0.92), sk = M(skin, 0.68), dark = M(0x0d0f13, 0.5, 0.15), pants = M(opt.pants || 0x13161c, 0.94), shoe = M(0x0e1014, 0.6), hairM = M(hair || 0x120e0a, 0.95);
    const add = (geo, m, p, r) => { const o = new T.Mesh(geo, m); o.position.set(p[0], p[1], p[2]); if (r) o.rotation.set(r[0], r[1], r[2]); g.add(o); return o; };
    const yOff = standing ? 0.44 : 0;
    // torso: tailored shoulders + tapered waist + collar + hips + belt (realistic human silhouette from behind)
    add(new T.CylinderGeometry(0.165, 0.128, 0.38, 18), cm, [0, 0.78 + yOff, 0]).scale.set(1.22, 1.0, 0.66);
    add(new T.SphereGeometry(0.145, 16, 12), cm, [0, 0.95 + yOff, 0]).scale.set(1.32, 0.42, 0.72);
    add(new T.CylinderGeometry(0.068, 0.088, 0.06, 16), M(shirtCol, 0.85), [0, 1.0 + yOff, -0.005]);
    add(new T.CylinderGeometry(0.132, 0.138, 0.042, 18), dark, [0, 0.58 + yOff, 0]).scale.set(1.16, 1, 0.68);
    add(new T.CylinderGeometry(0.136, 0.126, 0.13, 18), pants, [0, 0.50 + yOff, 0]).scale.set(1.15, 1, 0.68);
    // neck + sculpted head (cranium, jaw, ears, nose, hair)
    add(new T.CapsuleGeometry(0.048, 0.07, 6, 12), sk, [0, 1.05 + yOff, -0.005]);
    const headG = new T.Group(); headG.position.set(0, 1.18 + yOff, -0.01); headG.rotation.y = opt.headYaw || 0; headG.rotation.x = opt.headPitch || 0; g.add(headG);
    const hAdd = (geo, m, p, r) => { const o = new T.Mesh(geo, m); o.position.set(p[0], p[1], p[2]); if (r) o.rotation.set(r[0], r[1], r[2]); headG.add(o); return o; };
    hAdd(new T.SphereGeometry(0.092, 24, 18), sk, [0, 0.008, 0]).scale.set(0.88, 1.08, 0.98);
    hAdd(new T.SphereGeometry(0.07, 16, 12), sk, [0, -0.042, -0.016]).scale.set(0.82, 0.8, 0.9);
    hAdd(new T.ConeGeometry(0.014, 0.036, 8), sk, [0, -0.004, -0.092], [-1.35, 0, 0]);
    for (const s of [-1, 1]) hAdd(new T.SphereGeometry(0.018, 10, 8), sk, [s * 0.086, -0.004, 0.005]).scale.set(0.45, 1.1, 0.8);
    hAdd(new T.SphereGeometry(0.098, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.68), hairM, [0, 0.018, 0.015], [-0.18, 0, 0]).scale.set(0.95, 1.04, 1.04);
    // FAA single-ear lightweight ATC headset + boom mic
    hAdd(new T.TorusGeometry(0.102, 0.006, 6, 28, Math.PI), dark, [0, 0.024, 0], [0, Math.PI / 2, 0]);
    hAdd(new T.CylinderGeometry(0.032, 0.032, 0.022, 16), dark, [-0.096, 0.0, 0], [0, 0, Math.PI / 2]);
    hAdd(new T.CylinderGeometry(0.016, 0.016, 0.016, 12), dark, [0.094, 0.008, 0], [0, 0, Math.PI / 2]);
    hAdd(new T.CylinderGeometry(0.003, 0.003, 0.12, 6), dark, [-0.07, -0.038, -0.052], [1.25, 0, -0.45]);
    hAdd(new T.SphereGeometry(0.008, 8, 6), M(0x090a0c, 0.9), [-0.03, -0.056, -0.102]);
    // slim realistic arms + hands
    for (const s of [-1, 1]) {
      add(new T.SphereGeometry(0.054, 14, 10), cm, [s * 0.185, 0.91 + yOff, -0.005]);
      if (standing && bino) {
        add(new T.CapsuleGeometry(0.042, 0.24, 6, 12), cm, [s * 0.20, 0.78 + yOff, -0.09], [0.95, 0, s * 0.2]);
        add(new T.CapsuleGeometry(0.035, 0.22, 6, 12), cm, [s * 0.125, 0.96 + yOff, -0.22], [2.15, 0, -s * 0.42]);
        add(new T.SphereGeometry(0.032, 10, 8), sk, [s * 0.068, 1.13 + yOff, -0.165]).scale.set(0.85, 0.9, 1.1);
      } else if (standing) {
        add(new T.CapsuleGeometry(0.042, 0.26, 6, 12), cm, [s * 0.20, 0.76 + yOff, -0.06], [0.35, 0, s * 0.08]);
        add(new T.CapsuleGeometry(0.035, 0.24, 6, 12), cm, [s * 0.18, 0.62 + yOff, -0.21], [1.18, 0, -s * 0.1]);
        add(new T.SphereGeometry(0.03, 10, 8), sk, [s * 0.16, 0.56 + yOff, -0.33]).scale.set(0.9, 0.65, 1.25);
      } else {
        add(new T.CapsuleGeometry(0.042, 0.25, 6, 12), cm, [s * 0.205, 0.8 + yOff, -0.065], [0.5, 0, s * 0.1]);
        add(new T.CapsuleGeometry(0.036, 0.23, 6, 12), cm, [s * 0.185, 0.66 + yOff, -0.25], [1.48, 0, -s * 0.15]);
        add(new T.SphereGeometry(0.03, 10, 8), sk, [s * 0.145, 0.65 + yOff, -0.39]).scale.set(0.9, 0.6, 1.25);
      }
    }
    if (standing && bino) {
      const bm = M(0x111317, 0.35, 0.45), gls = M(0x284e68, 0.08, 0.6);
      for (const s of [-1, 1]) {
        add(new T.CylinderGeometry(0.022, 0.028, 0.13, 14), bm, [s * 0.032, 1.155 + yOff, -0.17], [Math.PI / 2, 0, 0]);
        add(new T.CylinderGeometry(0.026, 0.026, 0.008, 14), gls, [s * 0.032, 1.155 + yOff, -0.235], [Math.PI / 2, 0, 0]);
      }
      add(new T.BoxGeometry(0.052, 0.018, 0.036), bm, [0, 1.155 + yOff, -0.17]);
    }
    // legs & chair
    if (standing) {
      for (const s of [-1, 1]) {
        add(new T.CapsuleGeometry(0.064, 0.38, 6, 12), pants, [s * 0.095, 0.72, 0.01]);
        add(new T.CapsuleGeometry(0.052, 0.4, 6, 12), pants, [s * 0.095, 0.28, 0.02]);
        add(new T.BoxGeometry(0.085, 0.06, 0.21), shoe, [s * 0.095, 0.032, -0.04]);
      }
    } else {
      for (const s of [-1, 1]) {
        add(new T.CapsuleGeometry(0.064, 0.33, 6, 12), pants, [s * 0.095, 0.48, -0.21], [Math.PI / 2, 0, 0]);
        add(new T.CapsuleGeometry(0.052, 0.36, 6, 12), pants, [s * 0.095, 0.22, -0.38], [0.08, 0, 0]);
        add(new T.BoxGeometry(0.085, 0.055, 0.2), shoe, [s * 0.095, 0.03, -0.43]);
      }
      const ch = M(0x181a1f, 0.8), chr = M(0x464b52, 0.35, 0.75);
      add(new T.RoundedBoxGeometry(0.46, 0.07, 0.44, 3, 0.03), ch, [0, 0.42, -0.04]);
      add(new T.RoundedBoxGeometry(0.42, 0.62, 0.055, 3, 0.03), ch, [0, 0.79, 0.2], [-0.08, 0, 0]);
      add(new T.CylinderGeometry(0.025, 0.025, 0.36, 10), chr, [0, 0.22, 0]);
      for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; add(new T.BoxGeometry(0.026, 0.022, 0.3), dark, [Math.sin(a) * 0.15, 0.045, Math.cos(a) * 0.15], [0, a, 0]); }
    }
    return g;
  }
  function buildTower() {
    const Gt = grp.tower; Gt.position.copy(TWR); S.add(Gt);
    // orient local -Z across Runway 27 threshold & short final so the cab faces both the runway and the approaching 747SP + geese
    const dir = V(-380, 0, 0).sub(TWR).normalize(); Gt.rotation.y = Math.atan2(-dir.x, -dir.z); Gt.updateMatrixWorld(true);
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
    // FAA cab: dark anti-static carpeted floor, 8 panoramic outward-canted (~15 deg) anti-glare windows, slim steel mullions, low sills
    const floor = add(new T.CylinderGeometry(7.35, 7.35, 0.2, 8), new T.MeshStandardMaterial({ color: 0x15181d, roughness: 0.92, envMapIntensity: 0.1 }), [0, CAB, 0]); floor.rotation.y = Math.PI / 8;
    const glass = new T.MeshPhysicalMaterial({ color: 0x7fa3bd, metalness: 0.08, roughness: 0.02, transparent: true, opacity: 0.055, envMapIntensity: 0.7, side: T.DoubleSide, depthWrite: false });
    const mull = new T.MeshStandardMaterial({ color: 0x22262c, metalness: 0.75, roughness: 0.35 });
    const sillM = new T.MeshStandardMaterial({ color: 0x25282e, roughness: 0.75, metalness: 0.15 });
    const Hc = 4.45, rb = 6.9, rt = 7.95; // outward cant ~16 deg (matches real FAA ATCT anti-glare glass)
    for (let k = 0; k < 8; k++) {
      const a0 = k * Math.PI / 4 + Math.PI / 8, a1 = a0 + Math.PI / 4;
      const b0 = V(Math.cos(a0) * rb, CAB + 0.88, Math.sin(a0) * rb), b1 = V(Math.cos(a1) * rb, CAB + 0.88, Math.sin(a1) * rb);
      const t0 = V(Math.cos(a0) * rt, CAB + Hc, Math.sin(a0) * rt), t1 = V(Math.cos(a1) * rt, CAB + Hc, Math.sin(a1) * rt);
      const gg = new T.BufferGeometry().setFromPoints([b0, b1, t1, b0, t1, t0]); gg.computeVertexNormals(); const pane = new T.Mesh(gg, glass); pane.renderOrder = 70; Gt.add(pane);
      // slim outward-canted corner steel mullion oriented purely in tower-local space (zero world/local mismatch)
      const mDir = t0.clone().sub(b0);
      const m = new T.Mesh(new T.BoxGeometry(0.09, mDir.length(), 0.10), mull);
      m.position.copy(b0).add(t0).multiplyScalar(0.5);
      m.quaternion.setFromUnitVectors(V(0, 1, 0), mDir.normalize());
      Gt.add(m);
      // sill & upper window header beam
      const sDir = b1.clone().sub(b0);
      const sill = new T.Mesh(new T.BoxGeometry(sDir.length() + 0.1, 0.88, 0.28), sillM);
      sill.position.copy(b0).add(b1).multiplyScalar(0.5); sill.position.y = CAB + 0.44;
      sill.rotation.y = -Math.atan2(sDir.z, sDir.x); Gt.add(sill);
      const hDir = t1.clone().sub(t0);
      const hdr = new T.Mesh(new T.BoxGeometry(hDir.length() + 0.12, 0.28, 0.22), mull);
      hdr.position.copy(t0).add(t1).multiplyScalar(0.5); hdr.position.y = CAB + Hc - 0.12;
      hdr.rotation.y = -Math.atan2(hDir.z, hDir.x); Gt.add(hdr);
    }
    // roof, radome, antennas, obstruction light
    const roofM = new T.MeshStandardMaterial({ color: 0x3a3c40, metalness: 0.4, roughness: 0.6, side: T.DoubleSide, envMapIntensity: 0.2 });
    const y0 = CAB + Hc;
    add(new T.CylinderGeometry(8.0, 8.4, 0.5, 48), roofM, [0, y0 + 0.25, 0]); add(new T.CylinderGeometry(8.0, 8.0, 0.08, 48), snowRoof, [0, y0 + 0.54, 0]);
    add(new T.CylinderGeometry(8.5, 8.5, 0.35, 48, 1, true), new T.MeshStandardMaterial({ color: 0xd9d5cd, roughness: 0.7, side: T.DoubleSide }), [0, y0 + 0.35, 0]);
    add(new T.CylinderGeometry(4.5, 5.5, 1.6, 48), new T.MeshStandardMaterial({ color: 0xcfcac1, roughness: 0.8 }), [0, y0 + 1.3, 0]);
    add(new T.SphereGeometry(1.5, 32, 16), new T.MeshStandardMaterial({ color: 0xf1efe9, roughness: 0.55 }), [-2.2, y0 + 3.3, 1.2]);
    [[1.8, 0.6, 9], [2.6, -1.8, 6], [0.2, 2.6, 4.5]].forEach(([x, z, h]) => { add(new T.CylinderGeometry(0.05, 0.11, h, 8), mull, [x, y0 + 2.1 + h / 2, z]); });
    // dark acoustic baffle ceiling, structural ribs, recessed task downlights, and rolled-up sunshades at the upper transom
    const ceilM = new T.MeshStandardMaterial({ color: 0x191c22, roughness: 0.95, side: T.DoubleSide });
    const ceil = add(new T.CircleGeometry(8.05, 8).rotateX(Math.PI / 2), ceilM, [0, CAB + Hc - 0.04, 0]); ceil.rotation.y = Math.PI / 8;
    for (let k = 0; k < 8; k++) {
      const a = k * Math.PI / 4 + Math.PI / 8;
      const rib = add(new T.BoxGeometry(0.14, 0.14, 7.9), mull, [Math.cos(a) * 3.9, CAB + Hc - 0.11, Math.sin(a) * 3.9]); rib.rotation.y = -a + Math.PI / 2;
    }
    add(new T.CylinderGeometry(1.35, 1.5, 0.22, 8), mull, [0, CAB + Hc - 0.15, 0]).rotation.y = Math.PI / 8;
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; add(new T.CircleGeometry(0.11, 18).rotateX(Math.PI / 2), new T.MeshBasicMaterial({ color: new T.Color(0xffe9cc).multiplyScalar(1.8) }), [Math.cos(a) * 4.4, CAB + Hc - 0.06, Math.sin(a) * 4.4]); }
    const shade = new T.MeshStandardMaterial({ color: 0x10141a, transparent: true, opacity: 0.45, roughness: 0.9, side: T.DoubleSide, depthWrite: false });
    for (let k = 0; k < 8; k++) {
      const a0 = k * Math.PI / 4 + Math.PI / 8, a1 = a0 + Math.PI / 4;
      const t0 = V(Math.cos(a0) * (rt - 0.14), CAB + Hc - 0.28, Math.sin(a0) * (rt - 0.14));
      const t1 = V(Math.cos(a1) * (rt - 0.14), CAB + Hc - 0.28, Math.sin(a1) * (rt - 0.14));
      const sDir = t1.clone().sub(t0);
      const sh = new T.Mesh(new T.PlaneGeometry(sDir.length() - 0.1, 0.34), shade);
      sh.position.copy(t0).add(t1).multiplyScalar(0.5);
      sh.rotation.y = -Math.atan2(sDir.z, sDir.x); sh.rotateX(0.24); Gt.add(sh);
    }
    // wrap-around curved FAA perimeter slatwall console (matte anodized dark charcoal — zero washed-out glare)
    const desk = new T.MeshStandardMaterial({ color: 0x101318, roughness: 0.78, metalness: 0.14, envMapIntensity: 0.10 });
    const slat = new T.MeshStandardMaterial({ color: 0x171b22, roughness: 0.70, metalness: 0.28, envMapIntensity: 0.16 });
    add(new T.CylinderGeometry(6.35, 6.35, 0.055, 64, 1, false, Math.PI * 0.48, Math.PI * 1.04), desk, [0, CAB + 0.78, 0]);
    add(new T.CylinderGeometry(6.4, 6.4, 0.78, 64, 1, true, Math.PI * 0.48, Math.PI * 1.04), desk, [0, CAB + 0.39, 0]);
    add(new T.CylinderGeometry(5.25, 5.25, 0.78, 64, 1, true, Math.PI * 0.48, Math.PI * 1.04), desk, [0, CAB + 0.39, 0]);
    // low equipment riser & slatwall rail along outer console rim (keeps monitors below window horizon)
    add(new T.CylinderGeometry(6.28, 6.28, 0.24, 64, 1, true, Math.PI * 0.48, Math.PI * 1.04), slat, [0, CAB + 0.9, 0]);
    add(new T.CylinderGeometry(5.96, 5.96, 0.24, 64, 1, true, Math.PI * 0.48, Math.PI * 1.04), slat, [0, CAB + 0.9, 0]);
    // helper to mount a monitor on the slatwall or overhead bridge
    const monShell = new T.MeshStandardMaterial({ color: 0x121418, roughness: 0.42, metalness: 0.4, envMapIntensity: 0.3 });
    const mon = (key, ang, w, h, y, r, tilt, res, isStatic) => {
      const c = cnv(Math.round(w * (res || 720)), Math.round(h * (res || 720))); const t = ctex(c, true);
      const g2 = new T.Group(); g2.position.set(Math.sin(ang) * r, CAB + y, -Math.cos(ang) * r); g2.rotation.y = -ang; g2.rotateX(-(tilt || 0));
      g2.add(new T.Mesh(new T.BoxGeometry(w + 0.018, h + 0.018, 0.02), monShell));
      const back = new T.Mesh(new T.BoxGeometry(w * 0.68, h * 0.56, 0.045), monShell); back.position.z = -0.028; g2.add(back);
      const scr = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ map: t })); scr.position.z = 0.0105; g2.add(scr);
      if (y < 2.2) {
        const armH = Math.max(0.08, y - 0.82 - h / 2 + 0.08);
        const neck = new T.Mesh(new T.BoxGeometry(0.042, armH, 0.032), monShell); neck.position.set(0, -h / 2 - armH / 2 + 0.04, -0.045); g2.add(neck);
      } else {
        const rod = new T.Mesh(new T.CylinderGeometry(0.014, 0.014, Hc - y, 8), monShell); rod.position.set(0, (Hc - y) / 2, -0.02); g2.add(rod);
      }
      Gt.add(g2); screens[key] = { c, x: c.getContext('2d'), t, grp: g2, isStatic: !!isStatic }; return g2;
    };
    // 19 distinct glowing FAA ATC monitors (17 wrap-around console/slatwall monitors + 2 overhead status soffit displays):
    // Packed cleanly across the panoramic arc so 16+ glowing screens are clearly visible in the Shot 7 establishing frame
    mon('wx_rad',   -0.66, 0.42, 0.32, 1.04, 5.84, 0.14, 520, true);
    mon('tfdm2',    -0.55, 0.42, 0.28, 1.02, 5.80, 0.14, 520, true);
    mon('radar2',   -0.44, 0.44, 0.36, 1.06, 5.78, 0.12, 600, true);
    mon('metar',    -0.44, 0.40, 0.24, 1.38, 5.90, 0.06, 520, true);
    mon('vscs',     -0.34, 0.40, 0.26, 1.01, 5.74, 0.18, 520, true);
    mon('radar',    -0.24, 0.48, 0.40, 1.09, 5.76, 0.12, 760, false);
    mon('cam1',     -0.34, 0.38, 0.22, 1.32, 5.88, 0.06, 520, true);
    mon('asdex',    -0.13, 0.44, 0.34, 1.06, 5.74, 0.12, 720, false);
    mon('tfdm',     -0.04, 0.38, 0.28, 1.02, 5.70, 0.14, 680, false);
    // Center hero (Sky Sentry Live Feed + Detection Console)
    mon('sentry',    0.07, 0.68, 0.40, 1.09, 5.70, 0.10, 1000, false);
    // Right of center (Alert Console, Perimeter Cam 03 tucked outboard, ADS-B, IDS4, D-ATIS, Ground Map, Arrival Spacing)
    mon('alert',     0.19, 0.40, 0.27, 1.03, 5.72, 0.12, 640, false);
    mon('cam3',      0.29, 0.38, 0.22, 1.32, 5.88, 0.06, 520, true);
    mon('adsb',      0.29, 0.42, 0.28, 1.04, 5.75, 0.12, 640, false);
    mon('ids4',      0.39, 0.42, 0.28, 1.04, 5.78, 0.12, 540, true);
    mon('atis',      0.39, 0.38, 0.23, 1.35, 5.92, 0.05, 520, true);
    mon('ground',    0.50, 0.44, 0.32, 1.06, 5.82, 0.12, 600, true);
    mon('traffic',   0.61, 0.42, 0.28, 1.04, 5.86, 0.12, 540, true);
    // Overhead FAA cab status bridge (high along ceiling transom — frames top of cab without blocking runway/plane/geese)
    mon('oh_status', -0.17, 0.90, 0.23, 3.68, 6.22, -0.22, 600, true);
    mon('oh_freq',    0.17, 0.86, 0.23, 3.68, 6.22, -0.22, 600, true);
    // live Sky Sentry feed on the centre hero monitor
    const sn = screens.sentry; const feed = new T.Mesh(new T.PlaneGeometry(0.43, 0.242), feedMat); feed.position.set(-0.095, 0.024, 0.0112); sn.grp.add(feed);
    const hc = cnv(640, 360), ht = ctex(hc, true); const hud = new T.Mesh(new T.PlaneGeometry(0.43, 0.242), new T.MeshBasicMaterial({ map: ht, transparent: true })); hud.position.set(-0.095, 0.024, 0.0122); sn.grp.add(hud); sn.hud = { c: hc, x: hc.getContext('2d'), t: ht };
    // the Arduino beacon on the console, and the red light it throws
    const bc = new T.Group(); bc.position.set(Math.sin(0.13) * 5.45, CAB + 0.81, -Math.cos(0.13) * 5.45); Gt.add(bc);
    bc.add(new T.Mesh(new T.CylinderGeometry(0.05, 0.06, 0.05, 20), new T.MeshStandardMaterial({ color: 0x1a1a1c, roughness: 0.5 })));
    const dome = new T.Mesh(new T.SphereGeometry(0.045, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), new T.MeshBasicMaterial({ color: 0x401010 })); dome.position.y = 0.025; bc.add(dome); towerFx.dome = dome;
    towerFx.red = new T.PointLight(0xff2a1c, 0, 5.5, 2); towerFx.red.position.set(0.55, CAB + 1.15, -4.9); Gt.add(towerFx.red);
    towerFx.mon = new T.PointLight(0x7ca6e8, 0.34, 6.0, 2); towerFx.mon.position.set(-0.15, CAB + 1.35, -5.0); Gt.add(towerFx.mon);
    towerFx.mon2 = new T.PointLight(0x6e98d8, 0.24, 5.5, 2); towerFx.mon2.position.set(-2.1, CAB + 1.35, -4.6); Gt.add(towerFx.mon2);
    const ceilL = new T.PointLight(0xd8e6f5, 0.14, 11, 2); ceilL.position.set(0, CAB + 3.9, -1.5); Gt.add(ceilL);
    // Clean unobstructed first-person ATC tower cab POV (zero cartoon mannequins or boxy chairs)
    // desk keyboards, mice, flight-strip bay, binoculars, mugs
    const kbT = ctex(cnv(512, 170, (x) => { x.fillStyle = '#121316'; x.fillRect(0, 0, 512, 170); for (let r = 0; r < 5; r++) for (let k = 0; k < 15; k++) { x.fillStyle = '#2a2c31'; x.fillRect(8 + k * 33.5, 10 + r * 31, 29, 26); } }));
    const kbM = new T.MeshStandardMaterial({ map: kbT, roughness: 0.6 }), plain = new T.MeshStandardMaterial({ color: 0x17181b, roughness: 0.5, envMapIntensity: 0.2 });
    const onDesk = (ang, r, obj) => { obj.position.set(Math.sin(ang) * r, CAB + 0.81, -Math.cos(ang) * r); obj.rotation.y = -ang; Gt.add(obj); return obj; };
    [-0.58, -0.35, -0.04, 0.22, 0.46].forEach((a, i) => {
      onDesk(a, 5.45, new T.Mesh(new T.BoxGeometry(0.42, 0.02, 0.145), [plain, plain, kbM, plain, plain, plain])).rotateX(0.04);
      onDesk(a + 0.055, 5.46, new T.Mesh(new T.SphereGeometry(0.028, 10, 8), plain)).scale.set(0.85, 0.55, 1.35);
      if (i % 2 === 0) { const mug = new T.Group(); const cm = new T.MeshStandardMaterial({ color: i === 2 ? 0x1f3c6b : 0xe4e0d8, roughness: 0.35 }); const cup = new T.Mesh(new T.CylinderGeometry(0.038, 0.034, 0.098, 20), cm); cup.position.y = 0.049; mug.add(cup); onDesk(a - 0.065, 5.52, mug); }
    });
    // spare binoculars resting on center-left console
    const bDesk = new T.Group();
    for (const s of [-1, 1]) bDesk.add(new T.Mesh(new T.CylinderGeometry(0.025, 0.032, 0.14, 12).rotateX(Math.PI / 2), plain)).position.set(s * 0.035, 0.032, 0);
    onDesk(-0.18, 5.42, bDesk).rotation.y += 0.45;
    // paper flight-strip bay (muted low-glare console strips)
    const bay = new T.Group(); bay.add(new T.Mesh(new T.BoxGeometry(0.46, 0.02, 0.30), plain));
    for (let k = 0; k < 7; k++) { const st2 = new T.Mesh(new T.BoxGeometry(0.42, 0.010, 0.032), new T.MeshStandardMaterial({ color: [0x3d444d, 0x2d4354, 0x3d444d, 0x4f3535, 0x3d444d, 0x2d4354, 0x3d444d][k], roughness: 0.9 })); st2.position.set(0, 0.015, -0.12 + k * 0.040); bay.add(st2); }
    bay.rotation.x = -0.35; onDesk(-0.13, 5.55, bay).position.y += 0.052;
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
      const pm2 = new T.MeshPhysicalMaterial({ color: 0xd6dce2, metalness: 0.16, roughness: 0.36, clearcoat: 0.55, clearcoatRoughness: 0.16, envMapIntensity: 0.65 });
      pm2.onBeforeCompile = (sh) => {
        sh.uniforms.uSun = { value: SUN.clone() };
        sh.vertexShader = 'varying vec3 vLP; varying vec3 vWPos; varying vec3 vWNrm;\n' + sh.vertexShader
          .replace('#include <begin_vertex>', '#include <begin_vertex>\n vLP = position;\n vWPos = (modelMatrix * vec4(position, 1.0)).xyz;\n vWNrm = normalize(mat3(modelMatrix) * objectNormal);');
        sh.fragmentShader = 'varying vec3 vLP; varying vec3 vWPos; varying vec3 vWNrm; uniform vec3 uSun;\n' +
          'float pH2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }\n' +
          sh.fragmentShader
            .replace('#include <color_fragment>', '#include <color_fragment>\n' + [
              'float b747Glass = 0.0, b747Seam = 0.0, b747Metal = 0.0, b747WarmWin = 0.0;',
              '{ vec3 c = vec3(0.86, 0.88, 0.90); float x = vLP.x, y = vLP.y, z = abs(vLP.z);',
              '  float isFus = step(z, 3.65); float isWing = step(3.65, z) * step(y, 5.2);',
              '  float ang = atan(y - 3.8, max(z, 0.01));',
              // crisp procedural fuselage & wing skin panel seams/gaps, per-panel weathering & rivet rows
              '  float sx = fract(x * 0.44), sy = fract(ang * 3.8);',
              '  float fxSeam = smoothstep(0.024, 0.0, min(sx, 1.0 - sx));',
              '  float fySeam = smoothstep(0.026, 0.0, min(sy, 1.0 - sy));',
              '  float fPanel = pH2(floor(vec2(x * 0.44, ang * 3.8)));',
              '  float wSx = fract(x * 0.55 + z * 0.14), wSz = fract(z * 0.45);',
              '  float wSeam = max(smoothstep(0.026, 0.0, min(wSx, 1.0 - wSx)), smoothstep(0.024, 0.0, min(wSz, 1.0 - wSz))) * isWing;',
              '  float flapTrack = smoothstep(0.04, 0.0, abs(fract(z * 0.22) - 0.5)) * step(x, -1.5) * isWing;',
              '  float rivetBand = smoothstep(0.06, 0.028, min(sx, 1.0 - sx)) * (1.0 - fxSeam);',
              '  float rivets = rivetBand * step(0.68, fract(ang * 44.0)) * isFus * 0.42;',
              // passenger doors (L1..L4) + forward/aft cargo doors + nose radome seam
              '  float dX = min(min(abs(x - 18.2), abs(x - 7.8)), min(abs(x + 4.4), abs(x + 14.8)));',
              '  float doorOutline = (smoothstep(0.06, 0.015, abs(dX - 0.58)) * step(3.75, y) * step(y, 5.55) + smoothstep(0.05, 0.015, abs(y - 5.55)) * step(dX, 0.6) + smoothstep(0.05, 0.015, abs(y - 3.75)) * step(dX, 0.6)) * isFus;',
              '  float radomeSeam = smoothstep(0.08, 0.0, abs(x - 26.8)) * isFus;',
              '  b747Seam = clamp(max(max(fxSeam, fySeam) * isFus, max(wSeam, flapTrack)) + doorOutline * 1.25 + radomeSeam + rivets, 0.0, 1.0);',
              // brushed aluminum belly, bare metal leading edges & per-panel tonal variation
              '  if (y < 3.05 && z < 4.0) { c = vec3(0.62, 0.65, 0.69); b747Metal = 0.72; }',
              '  c *= (0.93 + 0.09 * fPanel);',
              '  float grime = smoothstep(4.2, 2.0, y) * (0.05 + 0.08 * pH2(vec2(floor(x * 1.8), 3.0))) * isFus;',
              '  c *= (1.0 - grime);',
              // fictional Skyline deep-navy + ice-blue double cheatline & tail
              '  float cheat = smoothstep(3.52, 3.58, y) * (1.0 - smoothstep(4.02, 4.08, y)) * step(x, 25.4) * step(-20.5, x) * step(z, 3.45);',
              '  float accentLine = smoothstep(4.06, 4.10, y) * (1.0 - smoothstep(4.20, 4.24, y)) * step(x, 25.0) * step(-20.5, x) * step(z, 3.45);',
              '  c = mix(c, vec3(0.04, 0.09, 0.22), cheat);',
              '  c = mix(c, vec3(0.45, 0.66, 0.84), accentLine);',
              // dark-tinted reflective cabin windows (rounded ovals with subtle per-window warm dawn interior glow)
              '  float wxF = fract(x * 1.92) - 0.5; float wId = floor(x * 1.92);',
              '  float mainWin = smoothstep(0.25, 0.17, length(vec2(wxF * 1.15, (y - 4.70) * 1.45))) * step(x, 21.0) * step(-18.0, x) * step(z, 3.4) * step(0.85, dX);',
              '  float upperWin = smoothstep(0.25, 0.17, length(vec2(wxF * 1.15, (y - 7.14) * 1.5))) * step(x, 21.0) * step(8.2, x) * step(z, 3.05);',
              '  float winMask = max(mainWin, upperWin);',
              '  float winLit = step(0.58, pH2(vec2(wId, step(6.0, y))));',
              // faceted 6-pane dark-tinted cockpit windshield with structural silver pillars
              '  float ckBox = step(24.5, x) * step(x, 26.65) * step(5.12, y) * step(y, 5.98) * step(z, 1.55);',
              '  float ckPost = max(smoothstep(0.06, 0.015, z), max(smoothstep(0.07, 0.02, abs(z - 0.62)), smoothstep(0.07, 0.02, abs(z - 1.24))));',
              '  float ckGlass = ckBox * (1.0 - ckPost * 0.92);',
              '  float ckFrame = ckBox * ckPost;',
              '  b747Glass = clamp(max(winMask, ckGlass), 0.0, 1.0);',
              '  b747WarmWin = clamp(winMask * winLit * 0.35 + ckGlass * 0.22, 0.0, 1.0);',
              '  c = mix(c, vec3(0.015, 0.028, 0.048), b747Glass);',
              '  c = mix(c, vec3(0.24, 0.27, 0.31), ckFrame);',
              // tail fin + bare metal leading edge + engine nacelles & metallic intake lips
              '  float tail = step(x, -19.0) * step(9.0, y) * step(z, 1.45); c = mix(c, vec3(0.04, 0.09, 0.22), tail);',
              '  float stripe = tail * smoothstep(-0.5, -0.3, y - 13.0 + (x + 19.0) * 0.6) * (1.0 - smoothstep(0.3, 0.5, y - 13.6 + (x + 19.0) * 0.6)); c = mix(c, vec3(0.55, 0.72, 0.86), stripe);',
              '  float nac = step(y, 3.35) * step(9.0, z) * step(z, 24.5); c = mix(c, vec3(0.60, 0.63, 0.67), nac);',
              '  float lip = nac * (smoothstep(0.45, 0.0, abs(x - 10.1)) * step(z, 13.8) + smoothstep(0.45, 0.0, abs(x - 0.85)) * step(18.2, z));',
              '  b747Metal = clamp(max(b747Metal, lip * 0.92 + isWing * smoothstep(0.8, 0.0, abs(x - (11.0 - z * 0.65))) * 0.75), 0.0, 1.0);',
              '  float intake = nac * step(8.9, x) * step(x, 10.15) * step(z, 13.5) + nac * step(-0.1, x) * step(x, 0.85) * step(18.5, z); c = mix(c, vec3(0.02), clamp(intake, 0.0, 1.0));',
              '  c *= (1.0 - b747Seam * 0.38 * (1.0 - b747Glass));',
              '  diffuseColor.rgb *= c; }'
            ].join('\n'))
            .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n' + [
              'roughnessFactor = mix(roughnessFactor, 0.05, b747Glass);',
              'roughnessFactor = mix(roughnessFactor, 0.22, b747Metal * (1.0 - b747Glass));',
              'roughnessFactor = clamp(roughnessFactor + b747Seam * 0.35, 0.05, 0.94);'
            ].join('\n'))
            .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n' + [
              'metalnessFactor = clamp(max(metalnessFactor, b747Metal * 0.82), 0.0, 0.9);',
              'metalnessFactor = mix(metalnessFactor, 0.12, b747Glass);'
            ].join('\n'))
            .replace('#include <dithering_fragment>', [
              '{ vec3 Vw = normalize(cameraPosition - vWPos); vec3 Nw = normalize(vWNrm);',
              '  float ndv = clamp(dot(Nw, Vw), 0.0, 1.0); float fres = 0.04 + 0.96 * pow(1.0 - ndv, 5.0);',
              '  vec3 Hw = normalize(uSun + Vw);',
              '  float sunGlint = pow(max(dot(Nw, Hw), 0.0), mix(64.0, 220.0, b747Glass)) * (0.06 + 0.32 * b747Glass + 0.22 * b747Metal);',
              '  vec3 dawnCol = vec3(1.0, 0.72, 0.48);',
              '  vec3 skyRefl = mix(vec3(0.24, 0.38, 0.54), dawnCol, pow(max(dot(reflect(-Vw, Nw), uSun), 0.0), 5.0)) * fres * (0.03 + 0.38 * b747Glass);',
              '  gl_FragColor.rgb += skyRefl + dawnCol * sunGlint + vec3(1.0, 0.72, 0.38) * b747WarmWin * 0.32;',
              '}',
              '#include <dithering_fragment>'
            ].join('\n'));
      };
      pm2.customProgramCacheKey = () => 'livery-sky-pbr2';
      mesh.material = pm2;
      mesh.castShadow = true; mesh.receiveShadow = true;
      mesh.geometry = T.BufferGeometryUtils && T.BufferGeometryUtils.toCreasedNormals ? T.BufferGeometryUtils.toCreasedNormals(mesh.geometry, Math.PI / 5) : (mesh.geometry.computeVertexNormals(), mesh.geometry);
      mesh.position.set(0, 0, 0); mesh.rotation.set(0, 0, 0); mesh.scale.set(1, 1, 1);
      body.add(mesh); plane.mesh = mesh; plane.gear = gear(body);
      // two more 747s parked on the real cargo apron
      for (const x of [1470, 1610]) { const gg = new T.Group(); const pp = mesh.clone(); pp.position.y = 1.3; gg.add(pp); gear(gg); gg.position.set(x, 0, 372); gg.rotation.y = Math.PI / 2; grp.airport.add(gg); }
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
    const shell = M(0x16191f, 0.78), shellL = M(0x21262e, 0.72), fabric = M(0x111317, 0.95, 0, 0.12), metal = M(0x7c848d, 0.35, 0.8, 0.55);
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
    // seats seen from behind (clean unobstructed architectural flight deck — zero cartoon pilot figures)
    const seatM = M(0x22252b, 0.82, 0.04, 0.2);
    for (const z of [-0.53, 0.53]) { const sb = add(new T.RoundedBoxGeometry(0.14, 0.62, 0.50, 4, 0.04), seatM, [-0.34, -0.66, z]); sb.rotation.z = 0.12; add(new T.RoundedBoxGeometry(0.46, 0.10, 0.50, 4, 0.04), seatM, [-0.08, -0.88, z]); }
    // instrument glow and a soft cockpit flood light
    ck.glowL = new T.PointLight(0x8fb4ff, 0.7, 2.6, 2); ck.glowL.position.set(0.5, -0.45, 0); Gc.add(ck.glowL);
    ck.flood = new T.PointLight(0xffd9b0, 0.22, 3, 2); ck.flood.position.set(-0.2, 0.45, 0); Gc.add(ck.flood);
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

  // ================= the flock: anatomically sculpted Canada geese (Branta canadensis) with 3D airfoil wings & multi-phase wingbeat =================
  const NB = mobile ? 56 : 72;
  const gooseGeo = (() => {
    const parts = [];
    const pushPart = (g, colFn, wingFn) => {
      g = g.toNonIndexed(); g.deleteAttribute('uv');
      const pos = g.attributes.position, n = pos.count, a = new Float32Array(n * 3), w = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const px = pos.getX(i), py = pos.getY(i), pz = pos.getZ(i);
        const c = typeof colFn === 'function' ? colFn(px, py, pz) : colFn;
        a.set(c, i * 3); w[i] = wingFn ? wingFn(px, py, pz) : 0;
      }
      g.setAttribute('color', new T.BufferAttribute(a, 3)); g.setAttribute('aWing', new T.BufferAttribute(w, 1));
      if (!g.attributes.normal) g.computeVertexNormals();
      parts.push(g); return g;
    };
    const darkBrown = [0.20, 0.16, 0.12], warmBrown = [0.30, 0.25, 0.20], buff = [0.58, 0.53, 0.46], jet = [0.03, 0.035, 0.04], cream = [0.92, 0.92, 0.89], slate = [0.10, 0.095, 0.09];
    // sleek aerodynamic body: brown-grey mottled back, pale cream-buff breast/belly, crisp white rump V-band
    const bodyG = new T.SphereGeometry(0.19, 18, 14).scale(2.55, 0.88, 0.98);
    pushPart(bodyG, (x, y, z) => {
      if (x < -0.34 && y > -0.05) return cream; // iconic white upper-tail-covert rump band
      if (y < -0.04) return buff;               // pale cream-buff breast & belly
      const bar = Math.sin(x * 28.0) * 0.04;    // subtle scalloped covert feather barring
      return [warmBrown[0] + bar, warmBrown[1] + bar * 0.85, warmBrown[2] + bar * 0.7];
    });
    // crisp white lower undertail coverts & black fan tail feathers
    pushPart(new T.ConeGeometry(0.13, 0.22, 10).rotateZ(Math.PI / 2).scale(1, 0.42, 1.15).translate(-0.49, 0.0, 0), cream);
    pushPart(new T.ConeGeometry(0.125, 0.28, 10).rotateZ(Math.PI / 2).scale(1, 0.28, 1.25).translate(-0.63, 0.01, 0), jet);
    // tucked dark webbed feet streaming under tail
    for (const sg of [-1, 1]) pushPart(new T.CylinderGeometry(0.014, 0.022, 0.16, 6).rotateZ(Math.PI / 2).translate(-0.46, -0.09, sg * 0.055), jet);
    // graceful curved elongated black neck (3-point CatmullRom tube from breast collar to head)
    const neckCurve = new T.CatmullRomCurve3([V(0.36, 0.01, 0), V(0.56, 0.06, 0), V(0.76, 0.115, 0), V(0.92, 0.125, 0)]);
    pushPart(new T.TubeGeometry(neckCurve, 12, 0.048, 10, false), (x) => (x < 0.41 ? buff : jet));
    // sculpted black head + crisp Canada goose white cheek-and-chinstrap + flat dark spatulate bill
    pushPart(new T.SphereGeometry(0.068, 14, 10).scale(1.48, 0.94, 0.86).translate(0.96, 0.135, 0), (x, y, z) => {
      // white chinstrap wraps under throat and sweeps up behind the cheek
      const cheek = (y < 0.162 && x > 0.91 && x < 0.995 && (Math.abs(z) > 0.036 || y < 0.105));
      return cheek ? cream : jet;
    });
    pushPart(new T.CylinderGeometry(0.012, 0.034, 0.13, 10).rotateZ(-Math.PI / 2).scale(1, 0.55, 1.05).translate(1.09, 0.12, 0), slate);
    // 3D cambered airfoil wings with wrist bend & 6 splayed primary wingtip feathers
    const stations = [
      // [zSpan, xLead, xTrail, yCamber, thick]
      [0.09,  0.22, -0.22, 0.065, 0.046],
      [0.26,  0.27, -0.20, 0.082, 0.038],
      [0.44,  0.29, -0.17, 0.090, 0.030], // carpal wrist joint (sweeps forward, then angles back)
      [0.64,  0.21, -0.19, 0.078, 0.022],
      [0.84,  0.09, -0.22, 0.062, 0.014],
      [1.02, -0.04, -0.20, 0.046, 0.008],
    ];
    for (const sg of [-1, 1]) {
      const pos = [], cc = [], wt = [];
      const addTri = (a, b, c) => {
        for (const p of [a, b, c]) {
          pos.push(p[0], p[1], p[2]);
          const zAbs = Math.abs(p[2]), span = clamp((zAbs - 0.09) / 0.96, 0, 1);
          wt.push(span);
          const isPrimary = span > 0.54 || p[0] < -0.08;
          const isUnder = p[3] < 0;
          const col = isPrimary ? (isUnder ? [0.22, 0.21, 0.2] : slate) : (isUnder ? [0.58, 0.55, 0.50] : (span < 0.3 ? warmBrown : darkBrown));
          cc.push(col[0], col[1], col[2]);
        }
      };
      for (let i = 0; i < stations.length - 1; i++) {
        const s0 = stations[i], s1 = stations[i + 1];
        const z0 = sg * s0[0], z1 = sg * s1[0];
        const xm0 = s0[1] * 0.6 + s0[2] * 0.4, xm1 = s1[1] * 0.6 + s1[2] * 0.4;
        const L0 = [s0[1], s0[3], z0, 1], L1 = [s1[1], s1[3], z1, 1];
        const T0 = [s0[2], s0[3] - s0[4] * 0.3, z0, 1], T1 = [s1[2], s1[3] - s1[4] * 0.3, z1, 1];
        const U0 = [xm0, s0[3] + s0[4], z0, 1], U1 = [xm1, s1[3] + s1[4], z1, 1];
        const B0 = [xm0, s0[3] - s0[4] * 0.45, z0, -1], B1 = [xm1, s1[3] - s1[4] * 0.45, z1, -1];
        // upper cambered surface (front & rear panels)
        addTri(L0, U0, U1); addTri(L0, U1, L1);
        addTri(U0, T0, T1); addTri(U0, T1, U1);
        // concave underwing surface
        addTri(L0, B1, B0); addTri(L0, L1, B1);
        addTri(B0, T1, T0); addTri(B0, B1, T1);
      }
      // 6 distinct splayed primary feather tips at the wingtip
      for (let f = 0; f < 6; f++) {
        const u = f / 5;
        const zR = sg * (0.94 + (1 - u) * 0.08), zTip = sg * (1.06 + (1 - u) * 0.14);
        const xR = lerp(-0.02, -0.19, u), xTip = xR - 0.06 - u * 0.05;
        const yR = 0.048 - u * 0.004, yTip = yR + (1 - u) * 0.028;
        addTri([xR + 0.022, yR, zR, 1], [xR - 0.022, yR, zR, 1], [xTip, yTip, zTip, 1]);
      }
      const wg = new T.BufferGeometry();
      wg.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
      wg.setAttribute('color', new T.Float32BufferAttribute(cc, 3));
      wg.setAttribute('aWing', new T.Float32BufferAttribute(wt, 1));
      wg.computeVertexNormals();
      parts.push(wg);
    }
    return T.BufferGeometryUtils.mergeBufferGeometries(parts);
  })();
  const flockU = { uT: { value: 0 }, uSun: { value: SUN.clone() } };
  const gooseMat = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: T.DoubleSide, envMapIntensity: 0.32 });
  gooseMat.onBeforeCompile = (sh) => {
    sh.uniforms.uT = flockU.uT; sh.uniforms.uSun = flockU.uSun;
    sh.vertexShader = 'attribute float aWing; attribute float aPh; uniform float uT; varying float vWing; varying vec3 vGLP; varying vec3 vGWPos; varying vec3 vGWNrm;\n' + sh.vertexShader.replace('#include <begin_vertex>', [
      '#include <begin_vertex>',
      'vWing = aWing; vGLP = position;',
      'if (aWing > 0.0) {',
      '  float freq = 11.2 * (0.92 + 0.16 * fract(aPh * 3.7));',
      '  float cyc = uT * freq + aPh;',
      '  float glide = smoothstep(0.65, 0.92, sin(uT * 0.55 + aPh * 1.3));', // brief natural glide pauses between wingbeats
      '  float amp = (0.58 + 0.42 * fract(aPh * 7.13)) * (1.0 - glide * 0.78);',
      '  float innerFlap = sin(cyc);',
      '  float outerFlap = sin(cyc - 0.62);', // wrist-to-primary phase lag
      '  float innerAng = (0.52 * innerFlap + 0.08) * amp;',
      '  float outerAng = (0.44 * outerFlap) * amp * smoothstep(0.32, 1.0, aWing);',
      '  float th = innerAng + outerAng;',
      '  float r = abs(transformed.z) - 0.09; float sz = sign(transformed.z);',
      '  transformed.y += r * sin(th) - 0.04 * innerFlap * amp;',
      '  transformed.z = sz * (0.09 + r * cos(th));',
      '  transformed.x -= abs(sin(th)) * aWing * 0.07;', // natural backward primary sweep
      '}',
      'vec4 gW = vec4(transformed, 1.0);',
      '#ifdef USE_INSTANCING', ' gW = instanceMatrix * gW;', '#endif',
      'vGWPos = (modelMatrix * gW).xyz; vGWNrm = normalize(mat3(modelMatrix) * objectNormal);'
    ].join('\n'));
    sh.fragmentShader = 'varying float vWing; varying vec3 vGLP; varying vec3 vGWPos; varying vec3 vGWNrm; uniform vec3 uSun;\n' + sh.fragmentShader
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + [
        '{ float barbs = sin(vGLP.x * 58.0 + abs(vGLP.z) * 26.0) * 0.5 + 0.5;',
        '  float scall = smoothstep(0.65, 0.95, sin(abs(vGLP.z) * 32.0 + vGLP.x * 16.0)) * step(0.02, vGLP.y) * step(vGLP.x, 0.35);',
        '  diffuseColor.rgb *= (0.86 + 0.18 * barbs);',
        '  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 1.24, scall * 0.38); }'
      ].join('\n'))
      .replace('#include <dithering_fragment>', [
        '{ vec3 Vw = normalize(cameraPosition - vGWPos); vec3 Nw = normalize(vGWNrm);',
        '  float rim = pow(1.0 - abs(dot(Nw, Vw)), 3.2) * max(0.0, dot(Nw, uSun) * 0.5 + 0.5);',
        '  gl_FragColor.rgb += vec3(1.0, 0.76, 0.52) * rim * (0.08 + 0.12 * vWing);',
        '}',
        '#include <dithering_fragment>'
      ].join('\n'));
  };
  gooseMat.customProgramCacheKey = () => 'goose-flap-v3';
  const flock = new T.InstancedMesh(gooseGeo, gooseMat, NB); flock.frustumCulled = false;
  { const ph = new Float32Array(NB); for (let i = 0; i < NB; i++) ph[i] = rnd() * 40; flock.geometry.setAttribute('aPh', new T.InstancedBufferAttribute(ph, 1)); }
  grp.flock.add(flock); S.add(grp.flock);
  const BIRD = []; // formation offsets: two classic Canada-goose V-skeins + near-tower flanking skein + swirling flock
  for (let i = 0; i < NB; i++) {
    let o, nearTwr = false;
    if (i < 28) { const sk = i < 14 ? 0 : 1, j = i % 14, arm = j % 2 ? 1 : -1, n = Math.ceil(j / 2); o = V(-n * 2.1 - sk * 14, sk * 3.2 + (rnd() - 0.5) * 0.8, arm * n * 2.2 + sk * 15); }
    else if (i < 46) { // flanking V-skein sweeping across the sightline ~140-220m in front of the FAA tower glass during Shot 7!
      const j = i - 28, arm = j % 2 ? 1 : -1, n = Math.ceil(j / 2);
      o = V(-n * 2.4, (rnd() - 0.5) * 2.2, arm * n * 2.6);
      nearTwr = true;
    } else o = V((rnd() - 0.5) * 40, (rnd() - 0.5) * 11, (rnd() - 0.5) * 40);
    BIRD.push({ o, ph: rnd() * 10, sp: 0.72 + rnd() * 0.55, sc: 0.98 + rnd() * 0.16, nearTwr });
  }
  // Main flock crosses short final (~350m before threshold 27)
  const flockC = (p, out) => { const k = clamp((p - 0.38) / (0.95 - 0.38), 0, 1); return out.set(-340 + Math.sin(k * 3.1) * 42 - 38 * k, 52 + Math.sin(k * 4.8) * 6 - k * 6, lerp(290, -250, k)); };
  // Near-tower flanking skein glides diagonally in front of the panoramic tower window (~95-175m from the glass) during Shot 7
  const nearFlockC = (p, out) => { const k = clamp((p - 0.58) / 0.26, 0, 1); return out.set(lerp(88, -110, k), lerp(43, 50, k) + Math.sin(k * 4.0) * 2.2, lerp(212, 118, k)); };
  const _m4 = new T.Matrix4(), _q = new T.Quaternion(), _e = new T.Euler(), _v1 = V(0, 0, 0), _v2 = V(0, 0, 0), _v3 = V(0, 0, 0), _sc = V(1, 1, 1);
  const birdPos = (i, p, t, out) => {
    const b = BIRD[i];
    if (b.nearTwr) { nearFlockC(p, _v1); nearFlockC(p + 0.004, _v2); } else { flockC(p, _v1); flockC(p + 0.004, _v2); }
    const hd = Math.atan2(-(_v2.z - _v1.z), _v2.x - _v1.x);
    const sw = b.nearTwr ? Math.sin(t * 0.25 * b.sp + b.ph) * 0.14 : (ss(0.5, 0.9, p) * (i % 3 - 1) * 1.0 + Math.sin(t * 0.21 * b.sp + b.ph) * 0.22);
    const a = hd + sw * (i >= 46 ? 1 : 0.2);
    const o = b.o, ca = Math.cos(a), sa = Math.sin(a), loose = b.nearTwr ? 1.15 : (1 + ss(0.5, 0.85, p) * 0.65);
    out.set(_v1.x + (o.x * ca + o.z * sa) * loose + Math.sin(t * 0.5 * b.sp + b.ph) * 0.9, _v1.y + o.y * loose + Math.sin(t * 0.7 * b.sp + b.ph * 2) * 0.55, _v1.z + (-o.x * sa + o.z * ca) * loose + Math.cos(t * 0.4 * b.sp + b.ph) * 0.9);
    return hd;
  };
  const birdNow = []; for (let i = 0; i < NB; i++) birdNow.push(V(0, 0, 0));
  const updateFlock = (p, t) => {
    for (let i = 0; i < NB; i++) {
      const hd = birdPos(i, p, t, birdNow[i]); const b = BIRD[i];
      const turn = Math.sin(t * 0.21 * b.sp + b.ph) * 0.35 + ss(0.5, 0.9, p) * (i % 3 - 1) * 0.45;
      _e.set(-turn * 0.55, hd + turn * 0.4, Math.sin(t * 0.3 + b.ph) * 0.08, 'YXZ'); _q.setFromEuler(_e);
      _sc.setScalar(b.sc);
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
  loads.push(Promise.all([ltex('assets/textures/asphalt_diff.jpg', true), ltex('assets/textures/asphalt_nor_gl.jpg'), ltex('assets/textures/asphalt_rough.jpg')]).then(([ad, an, ar]) => {
    if (ad) { rwMat.map = ad; rwMat.normalMap = an; rwMat.roughnessMap = ar; rwMat.needsUpdate = true; taxM.map = ad; taxM.normalMap = an; taxM.needsUpdate = true; }
  }));
  buildTower();

  // ================= the story: plane, shots, captions, radio =================
  // ---- the flight: a 747SP flown by physics, not keyframes ----
  // A point-mass longitudinal model (lift, drag, thrust, weight) with pitch and roll dynamics and engine spool lag, flown by an
  // autopilot on the ILS (glideslope and localizer, autothrottle on speed), then a go-around exactly as a crew flies one:
  // TOGA thrust, rotate to 15 degrees, flaps 20, positive rate, gear up. Wind 270 at 8 (a headwind on runway 27) with seeded
  // turbulence, rougher inside the cloud. It is simulated once, ahead of time; the scroll moves through that recorded flight.
  const FLIGHT = (() => {
    const g = 9.81, M = 215000, S = 511, AR = 6.96, kInd = 1 / (Math.PI * 0.78 * AR), CLa = 5.2, TMAX = 4 * 206000;
    const VAPP = 140 * 0.5144, HW = 8 * 0.5144 * Math.cos(2 * DEG), XW = 8 * 0.5144 * Math.sin(2 * DEG);
    const rho = (y) => 1.225 * Math.exp(-(y + 143) / 8500);
    const flapCL = (f) => 0.32 + f * 0.0185, flapCD = (f) => 0.0004 * f + 0.00006 * f * f;   // flaps 30: CL0 0.88, +0.066 CD
    const thrustOf = (n1) => TMAX * Math.pow(clamp((n1 - 0.2) / 0.8, 0, 1), 1.35);
    const n1For = (T) => 0.2 + 0.8 * Math.pow(clamp(T / TMAX, 0, 1), 1 / 1.35);
    // turbulence: sums of slow sines with seeded phases, so the same scroll position always shows the same bump
    const tr = FK.rng(902), comps = (n, f0, f1) => Array.from({ length: n }, () => [f0 * Math.pow(f1 / f0, tr()), tr() * 6.283, 0.4 + tr() * 0.6]);
    const GW = comps(7, 0.05, 1.1), GV = comps(6, 0.04, 0.8), GP = comps(5, 0.2, 1.6);
    const sumN = (c, t) => { let v = 0, n = 0; for (const [f, ph, a] of c) { v += Math.sin(t * f * 6.283 + ph) * a; n += a * a; } return v / Math.sqrt(n * 0.5); };
    const st = { t: 0, x: -42000, y: gsY(-42000), z: 520, vx: 0, vy: 0, th: 0, q: 0, phi: 0, psi: 0, n1: 0.45, flap: 10, gear: 0, gearCmd: 0, ga: -1 };
    const V0 = 178 * 0.5144; st.vx = V0 + HW * 0; st.vy = -Math.tan(3 * DEG) * (V0 - HW);
    st.th = Math.atan2(st.vy, st.vx) / DEG + 2.2;
    const XGA = -520, dt = 1 / 50, out = [];
    let posRate = 0;
    for (let i = 0; i < 60 * 50 * 16 && st.x < 4200; i++) {
      const t = st.t, inCl = ss(CB - 40, CB + 120, st.y) * (1 - ss(CTOP - 100, CTOP + 60, st.y));
      const sig = 0; // turbulence is applied live in planeAt (real time), never baked into the scrubbed path
      const wg = sumN(GW, t) * sig, vg = sumN(GV, t + 40) * sig * 0.9, ug = sumN(GV, t + 90) * sig * 0.6;
      // air-relative velocity (headwind adds to airspeed; the gusts move the air)
      const ax_ = st.vx + HW - ug, ay_ = st.vy - wg, V = Math.hypot(ax_, ay_), gam = Math.atan2(ay_, ax_);
      const alpha = st.th * DEG - gam, q = 0.5 * rho(st.y) * V * V;
      const CL = flapCL(st.flap) + CLa * alpha, CD = 0.018 + flapCD(st.flap) + 0.016 * st.gear + kInd * CL * CL;
      const L = q * S * CL, Dr = q * S * CD, Th = thrustOf(st.n1);
      // ---- the autopilot and the crew ----
      const gsDev = gsY(st.x) - st.y, ga = st.ga >= 0, Vg0 = Math.hypot(st.vx, st.vy);
      const vT = ga ? VAPP + 10 * 0.5144 : lerp(178, 140, ss(-22000, -11000, st.x)) * 0.5144;
      st.flap = ga ? lerp(30, 20, ss(st.ga + 1.5, st.ga + 5, t)) : lerp(10, 30, ss(-21000, -10500, st.x));
      if (!ga && st.x > -15500) st.gearCmd = 1;
      let thC, n1C;
      if (!ga) {
        // fly the glideslope: a path angle that closes the error, then the pitch that gives the lift for it
        const gamC = -3 * DEG + clamp(gsDev * 0.0016 - (st.vy + Math.tan(3 * DEG) * (st.vx)) * 0.004, -2 * DEG, 2 * DEG);
        const CLreq = M * g * Math.cos(gamC) / Math.max(1, q * S);
        thC = (gamC + (CLreq - flapCL(st.flap)) / CLa) / DEG;
        const Treq = Dr + M * g * Math.sin(gamC) + M * 0.12 * (vT - V);
        n1C = n1For(Math.max(0, Treq));
        if (st.x >= XGA) { st.ga = t; }
      } else {
        thC = 15; n1C = 0.97;
        if (st.vy > 1.5) posRate += dt; if (posRate > 1.2) st.gearCmd = 0;
        // the 747's go-around mode: full thrust first, then the autothrottle trims it back to hold a 2,000 ft/min climb
        if (posRate > 4) thC = clamp(15 + (V / 0.5144 - 150) * 0.35, 10, 15);
        if (posRate > 4) n1C = clamp(n1For(Dr + M * g * Math.sin(Math.atan2(10.16, Vg0)) ) + (10.16 - st.vy) * 0.02, 0.6, 0.97);
      }
      // pitch: a well-damped response, rate-limited the way a pilot rotates (about 2.5 degrees a second)
      const qC = clamp((thC - st.th) * 0.9, -2.5, 2.5) + sumN(GP, t + 7) * 0.25 * sig;
      st.q += (qC - st.q) * (1 - Math.exp(-dt * 2.2)); st.th += st.q * dt;
      // engines spool: slow from low thrust, faster near the top
      st.n1 += clamp((n1C - st.n1) * 1.4 * dt, -0.1 * dt, (st.n1 < 0.55 ? 0.06 : 0.12) * dt); // about 5 s from approach power to go-around power
      // forces along and across the air path -> accelerations
      const ca = Math.cos(gam), sa = Math.sin(gam), cth = Math.cos(st.th * DEG), sth = Math.sin(st.th * DEG);
      const Fx = -Dr * ca - L * sa + Th * cth, Fy = -Dr * sa + L * ca + Th * sth - M * g;
      st.vx += Fx / M * dt; st.vy += Fy / M * dt; st.x += st.vx * dt; st.y += st.vy * dt;
      st.gear += clamp(st.gearCmd - st.gear, -dt / 9, dt / 9);
      // lateral: the localizer, coordinated turns, the gusty crosswind
      const Vg = Math.hypot(st.vx, st.vy), zd = Vg * Math.sin(st.psi) + XW + vg * 0.35;
      const phiC = ga ? 0 : clamp(Math.atan2(-(st.z * 0.0045 + zd * 0.16), g) / DEG, -14, 14);
      st.phi += (phiC - st.phi) * (1 - Math.exp(-dt * 0.9)) + sumN(GP, t + 31) * 0.9 * sig * dt * 3;
      st.psi += g * Math.tan(st.phi * DEG) / Math.max(40, V) * dt; st.z += zd * dt;
      st.t += dt;
      if (i % 5 === 0) out.push([st.t, st.x, st.y, st.z, st.th, st.phi, st.psi / DEG, st.gear, st.n1, V / 0.5144, st.vy, ga ? 1 : 0, st.flap, gsDev]);
    }
    const tGA = st.ga;
    // the state at any time, linearly interpolated between recorded samples
    const at = (t) => { let lo = 0, hi = out.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (out[m][0] <= t) lo = m; else hi = m; } const A = out[lo], B = out[hi], k = clamp((t - A[0]) / Math.max(1e-6, B[0] - A[0]), 0, 1); return A.map((v, j) => v + (B[j] - v) * k); };
    const timeAtX = (x) => { let lo = 0, hi = out.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (out[m][1] <= x) lo = m; else hi = m; } const A = out[lo], B = out[hi]; return A[0] + (B[0] - A[0]) * clamp((x - A[1]) / Math.max(1e-6, B[1] - A[1]), 0, 1); };
    return { out, at, timeAtX, tGA, tEnd: out[out.length - 1][0] };
  })();
  // the scroll keeps its story beats at the same places along the approach: these are where the airliner is at each beat
  const XK = [[0, -42000], [0.11, -30500], [0.19, -12500], [0.24, -6000], [0.30, -4600], [0.36, -3400], [0.45, -2100], [0.53, -1450], [0.64, -760], [0.745, -520], [0.80, -400], [0.88, -20], [0.955, 2400], [1.0, 3500]];
  const TK = XK.map(([pp, x]) => [pp, FLIGHT.timeAtX(x)]);
  // Fritsch-Carlson monotone cubic through the beats: continuous speed, never running backwards
  const TKm = (() => { const n = TK.length, d = [], m = new Array(n).fill(0);
    for (let i = 0; i < n - 1; i++) d.push((TK[i + 1][1] - TK[i][1]) / (TK[i + 1][0] - TK[i][0]));
    m[0] = d[0]; m[n - 1] = d[n - 2]; for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
    for (let i = 0; i < n - 1; i++) { if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; } const a = m[i] / d[i], b = m[i + 1] / d[i], h = a * a + b * b; if (h > 9) { const k = 3 / Math.sqrt(h); m[i] = k * a * d[i]; m[i + 1] = k * b * d[i]; } }
    return m; })();
  const timeAt = (p) => { const n = TK.length; if (p <= TK[0][0]) return TK[0][1]; if (p >= TK[n - 1][0]) return TK[n - 1][1];
    let i = 0; while (p > TK[i + 1][0]) i++; const h = TK[i + 1][0] - TK[i][0], u = (p - TK[i][0]) / h, u2 = u * u, u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * TK[i][1] + (u3 - 2 * u2 + u) * h * TKm[i] + (-2 * u3 + 3 * u2) * TK[i + 1][1] + (u3 - u2) * h * TKm[i + 1]; };
  // live turbulence: slow, smooth sums of sines in real time, rougher inside the cloud
  const TB = (() => { const r = FK.rng(77), c = () => Array.from({ length: 5 }, () => [0.06 + r() * 0.5, r() * 6.283, 0.4 + r() * 0.6]); return { y: c(), r: c(), p: c(), z: c() }; })();
  const tbn = (c, t) => { let v = 0, n = 0; for (const [f, ph, a] of c) { v += Math.sin(t * f * 6.283 + ph) * a; n += a; } return v / n; };
  const XG = -520;
  const planeAt = (p, t) => {
    const tm = timeAt(p), s = FLIGHT.at(tm);
    const [, x, y, z, pitch, roll, yaw, gear, n1, kt, vy, ga, flap, gsDev] = s;
    const cl = ss(CB - 40, CB + 120, y) * (1 - ss(CTOP - 100, CTOP + 60, y)), a = 0.35 + 0.9 * cl;
    return { x, y: y + tbn(TB.y, t) * 0.9 * a, z: z + tbn(TB.z, t) * 0.6 * a, pitch: pitch + tbn(TB.p, t) * 0.5 * a, roll: roll + tbn(TB.r, t) * 1.6 * a, yaw, gear, n1, kt, ga: ga > 0.5, app: x > -12500, flap, vs: vy * 196.85, gsDev, ft: y * 3.281, nm: Math.max(0, (0 - x) / 1852), time: tm };
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
    // third person (Shreyansh asked for this instead of the cockpit): a chase camera behind and above the 747SP,
    // drifting slowly around it, 0 to 0.30; a low trailing view as it climbs away on the go-around, 0.88 to the end
    if (p < 0.30) {
      const k = sh(0, 0.30), a = lerp(-2.55, -2.25, k) + Math.sin(t * 0.21) * 0.025, r = lerp(92, 70, ss(0, 0.30, p)), up = lerp(16, 9, k);
      const bump = inCloud * 0.35; const jx = (Math.sin(t * 9.1) + Math.sin(t * 5.3)) * bump, jy = Math.sin(t * 7.7) * bump;
      return { mode: 'ext', pos: V(pp.x + Math.cos(a) * r + jx, pp.y + up + jy, pp.z + Math.sin(a) * r * (port ? 0.8 : 1)), look: V(pp.x + 34, pp.y + 2.5, pp.z), fov: port ? 58 : 38 };
    }
    if (p >= 0.88) {
      const k = sh(0.88, 1), a = lerp(-2.85, -3.05, k);
      return { mode: 'ext', pos: V(pp.x + Math.cos(a) * lerp(80, 120, k), pp.y - lerp(4, 10, k), pp.z + Math.sin(a) * lerp(80, 120, k)), look: V(pp.x + 30, pp.y + 6, pp.z), fov: port ? 56 : 36 };
    }
    if (p < 0.36) { const k = sh(0.30, 0.36); return { mode: 'ext', pos: V(pp.x + lerp(-140, 110, k), pp.y - 22, pp.z - 260), look: V(pp.x + 30, pp.y + 2, pp.z), fov: port ? 46 : 30 }; }
    // Shot 4: heroic 3/4 front-side chase orbit showing 747SP nose, faceted dark-tinted cockpit windows, upper hump, panel seams, doors & engines
    if (p < 0.45) { const k = sh(0.36, 0.45), a = lerp(-0.55, -1.55, k); return { mode: 'ext', pos: V(pp.x + Math.cos(a) * 56, pp.y + 5.5 - k * 2.2, pp.z + Math.sin(a) * 56), look: V(pp.x + 8, pp.y + 3.2, pp.z), fov: port ? 52 : 34 }; }
    // Shot 5: intimate close-up alongside the lead Canada goose skein, looking across the flock toward the approaching 747SP
    if (p < 0.50) { const k = sh(0.45, 0.50), lead = birdNow[0]; return { mode: 'ext', pos: V(lead.x + lerp(14, 10, k), lead.y + 1.4 - k * 0.8, lead.z + lerp(11, 8, k)), look: V(lerp(lead.x - 10, pp.x, 0.16), lerp(lead.y, pp.y, 0.08), lerp(lead.z - 4, 0, 0.16)), fov: port ? 44 : 30 }; }
    if (p < 0.53) { const k = sh(0.50, 0.53), a = lerp(0.9, 1.5, k), d = drone.position; return { mode: 'ext', pos: V(d.x + Math.cos(a) * 4.2, d.y + 0.6, d.z + Math.sin(a) * 4.2), look: V(d.x, d.y, d.z), fov: port ? 50 : 34 }; }
    if (p < 0.545) { const k = sh(0.53, 0.545); return { mode: 'ext', pos: V(SENT.x + 1.3 - k * 0.5, 1.6, SENT.z + 0.35), look: V(SENT.x - 3, 1.5 + k * 0.2, SENT.z), fov: port ? 56 : 40 }; }
    if (p < 0.64) { sentAim(p); return { mode: 'sentry', pos: sentCam.position.clone(), quat: sentCam.quaternion.clone(), fov: sentCam.fov * (port ? 1.6 : 1) }; }
    // Shot 7: Moody, razor-sharp architectural first-person ATC tower cab POV — dark anodized-steel canted mullions,
    // glowing tactical console & Sky Sentry alert monitor framing Runway 27, dawn alpine ridge, geese flock & approaching 747SP
    if (p < 0.80) {
      const k1 = ss(0.64, 0.71, p), k2 = ss(0.71, 0.755, p), k3 = ss(0.76, 0.80, p);
      let pos = towerLocal(lerp(0.18, 0.04, k1), CAB + lerp(1.66, 1.56, k1), lerp(-2.35, -2.95, k1));
      let look = towerLocal(lerp(-0.12, -0.04, k1), CAB + lerp(1.42, 1.38, k1), -10.5);
      if (k2 > 0) { pos.lerp(towerLocal(0.10, CAB + 1.50, -3.55), k2); look.lerp(towerLocal(0.02, CAB + 1.34, -10.5), k2); }
      if (k3 > 0) { pos.lerp(towerLocal(0.16, CAB + 1.62, -3.20), k3); look.lerp(V(lerp(pp.x, fl.x, 0.28), lerp(pp.y, fl.y, 0.28), lerp(pp.z, fl.z, 0.28)), k3); }
      return { mode: 'tower', pos, look, fov: port ? lerp(66, 56, k2) : lerp(54, 46, k2) };
    }
    // Shot 8: go-around — low beside the flock as the 747SP pitches up and climbs overhead
    const k = sh(0.80, 0.88); const cam = V(-300, 24, -205); // far enough from the path that the flyby is a steady pan, not a whip
    const d = cam.distanceTo(pp); return { mode: 'ext', pos: cam, look: V(lerp(pp.x, fl.x, 0.15), lerp(pp.y, fl.y, 0.15), lerp(pp.z, fl.z, 0.15)), fov: port ? 52 : 34, shake: Math.exp(-Math.pow(d / 260, 2)) * 0.8 };
  }
  // the former cuts, each with the half-width of scroll over which the camera travels between the two framings
  const MOVES = [[0.30, 0.028], [0.36, 0.028], [0.45, 0.024], [0.50, 0.014], [0.64, 0.04], [0.80, 0.033], [0.88, 0.047]];
  const _mv = new T.Matrix4(), _up = V(0, 1, 0), _qa = new T.Quaternion(), _qb = new T.Quaternion();
  const quatOf = (sh, out) => sh.quat ? out.copy(sh.quat) : out.setFromRotationMatrix(_mv.lookAt(sh.pos, sh.look, _up));
  const expOf = (m) => m === 'tower' ? 1.06 : m === 'sentry' ? 1.12 : 1.08;
  const PHONE_MOVE = [0.5155, 0.562];
  function shotBlend(p, t, ps) {
    if (p > PHONE_MOVE[0] && p < PHONE_MOVE[1]) {
      const A = shot(0.5154, t, ps), Pm = shot(0.535, t, ps), B = shot(Math.max(p, 0.5451), t, ps);
      let k = (p - PHONE_MOVE[0]) / (PHONE_MOVE[1] - PHONE_MOVE[0]); k = k * k * (3 - 2 * k);
      // a quadratic curve that bends past the phone on its tripod, ending in its lens
      const u = 1 - k, pos = A.pos.clone().multiplyScalar(u * u).add(Pm.pos.clone().multiplyScalar(2 * u * k)).add(B.pos.clone().multiplyScalar(k * k));
      quatOf(A, _qa); quatOf(Pm, _qb); const qm = _qa.clone().slerp(_qb, Math.min(1, k * 2)); quatOf(B, _qb); qm.slerp(_qb, ss(0.5, 1, k));
      const sn = ss(0.75, 1, k);
      return { mode: k < 0.9 ? 'ext' : 'sentry', pos, quat: qm, fov: lerp(lerp(A.fov, Pm.fov, Math.min(1, k * 2)), B.fov, ss(0.5, 1, k)), shake: 0, sensor: sn, exp: lerp(expOf('ext'), expOf('sentry'), sn), moving: true };
    }
    for (const [b, w] of MOVES) {
      if (p <= b - w || p >= b + w) continue;
      const A = shot(Math.min(p, b - 1e-5), t, ps), B = shot(Math.max(p, b + 1e-5), t, ps);
      let k = (p - (b - w)) / (2 * w); k = k * k * k * (k * (k * 6 - 15) + 10);   // smootherstep: eases out of one framing and into the next
      const pos = A.pos.clone().lerp(B.pos, k), d = A.pos.distanceTo(B.pos);
      pos.y += Math.sin(Math.PI * k) * Math.min(d * 0.16, 140);                      // a long move rises on an arc, like a crane
      quatOf(A, _qa); quatOf(B, _qb); _qa.slerp(_qb, k);
      return { mode: k < 0.5 ? A.mode : B.mode, pos, quat: _qa.clone(), fov: lerp(A.fov, B.fov, k), shake: lerp(A.shake || 0, B.shake || 0, k),
        sensor: lerp(A.mode === 'sentry' ? 1 : 0, B.mode === 'sentry' ? 1 : 0, k), exp: lerp(expOf(A.mode), expOf(B.mode), k), moving: true };
    }
    const sh = shot(p, t, ps); sh.sensor = sh.mode === 'sentry' ? 1 : 0; sh.exp = expOf(sh.mode); return sh;
  }
  const sentAim = (p) => { const fl = flockC(p, V(0, 0, 0)); sentCam.position.copy(SENT); const k = ss(0.545, 0.64, p); sentCam.lookAt(lerp(fl.x - 120, fl.x, 0.72), lerp(fl.y + 4, fl.y, 0.85), lerp(fl.z * 0.75, fl.z, 0.82)); sentCam.fov = lerp(34, 26, k); sentCam.aspect = W / H; sentCam.updateProjectionMatrix(); };

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
    // HUD frame (cleanly positioned below the top chapter pill so nothing ever collides)
    ox.fillStyle = 'rgba(234,242,248,.94)'; ox.font = '600 12px "Geist Mono", monospace';
    const top = mobile ? 96 : 114, L0 = mobile ? 16 : 32;
    ox.fillText('SKY SENTRY · CAM 02 · RWY 27 FINAL', L0, top + 24); ox.font = '500 11px "Geist Mono", monospace';
    ox.fillStyle = Math.sin(t * 6) > 0 ? '#ff3b30' : 'rgba(255,59,48,.3)'; ox.beginPath(); ox.arc(L0 + 5, top + 42, 4, 0, 7); ox.fill(); ox.fillStyle = 'rgba(234,242,248,.86)';
    ox.fillText('LIVE  06:41:' + String(8 + Math.floor(k * 10)).padStart(2, '0') + '  ·  ' + shown + ' BIRDS  ·  1 DRONE', L0 + 16, top + 46);
    // risk meter
    const mw = Math.min(280, W - L0 * 2 - 24), mx = mobile ? L0 + 12 : W - mw - 40, my = mobile ? top + 72 : 98;
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
    const tOn = sh.mode === 'ext' && p > 0.24 && p < 0.525;
    if (tOn !== teleOn) { teleOn = tOn; D.tele.classList.toggle('on', tOn); }
    if (tOn) { D.ta.textContent = 'SKY902 · B747 · RWY 27'; D.tb.textContent = `ALT ${Math.round(st.ft / 10) * 10} FT · ${Math.round(st.kt)} KT · N1 ${Math.round(st.n1 * 100)}%`; D.tc.textContent = st.ga ? `TO/GA · ${st.vs > 0 ? '+' : ''}${Math.round(st.vs / 50) * 50} FPM · FLAPS ${Math.round(st.flap)}` : `G/S ${st.gsDev > 0 ? '+' : ''}${(st.gsDev * 3.281).toFixed(0)} FT · ${Math.round(st.vs / 50) * 50} FPM · ${st.nm.toFixed(1)} NM`; }
    const rk = p > 0.69 && p < 0.80; D.rep.classList.toggle('on', rk);
    const n = Math.round(repText.length * ss(0.695, 0.755, p)); if (n !== repLen) { repLen = n; const s = repText.slice(0, n); D.repPre.innerHTML = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/^(\w+)/gm, '<span class="k">$1</span>') + (n < repText.length ? '<span class="caret"></span>' : ''); }
    const so = p > 0.762; if (so !== stampOn) { stampOn = so; D.stamp.classList.toggle('on', so); }
  }

  // ================= 19 FAA ATC monitors in the tower cab =================
  let vmap = null, staticScreensAlert = -1;
  function drawStaticScreens(alert) {
    const sc = screens; if (!sc.metar) return;
    // METAR / AWOS Wind Rose & RVR Weather
    { const { c, x, t: tex } = sc.metar, w = c.width, h = c.height; x.fillStyle = '#04090e'; x.fillRect(0, 0, w, h);
      mono(x, 12, 700); x.fillStyle = '#6ec8ff'; x.fillText('AWOS / METAR · KSKY', 10, 20);
      x.strokeStyle = '#2d4963'; x.lineWidth = 2; x.beginPath(); x.arc(w * 0.24, h * 0.58, h * 0.28, 0, 7); x.stroke();
      x.strokeStyle = '#3ddc84'; x.lineWidth = 3; x.beginPath(); x.moveTo(w * 0.24, h * 0.58); x.lineTo(w * 0.1, h * 0.58); x.stroke();
      mono(x, 11, 600); x.fillStyle = '#eaf2f8';
      ['WIND 270 / 08 KT', 'VIS  6SM -SN', 'CEIL BKN014', 'TEMP -04 / -07', 'ALTM 30.02 INHG', 'RVR  6000+ FT'].forEach((l, i) => x.fillText(l, w * 0.48, 40 + i * 16));
      tex.needsUpdate = true; }
    // IDS4 Runway Status, Lighting & NOTAMs
    { const { c, x, t: tex } = sc.ids4, w = c.width, h = c.height; x.fillStyle = '#070b10'; x.fillRect(0, 0, w, h);
      x.fillStyle = '#122236'; x.fillRect(0, 0, w, 24); mono(x, 12, 700); x.fillStyle = '#a9cbe3'; x.fillText('IDS4 · RUNWAY STATUS · RWY 27', 10, 16);
      const boxes = [['RWY 27', alert ? 'HAZARD' : 'ACTIVE', alert ? '#c4221c' : '#1b5e36'], ['ALS/PAPI', 'STEP 5', '#1b4775'], ['BRAKING', 'GOOD', '#1b5e36'], ['ILS 27', 'NORM', '#1b5e36']];
      boxes.forEach((b, i) => { const bx = 10 + (i % 2) * (w / 2 - 12), by = 32 + Math.floor(i / 2) * ((h - 42) / 2); x.fillStyle = b[2]; x.fillRect(bx, by, w / 2 - 16, (h - 54) / 2); x.fillStyle = '#fff'; mono(x, 11, 600); x.fillText(b[0], bx + 8, by + 18); mono(x, 15, 700); x.fillText(b[1], bx + 8, by + 38); });
      tex.needsUpdate = true; }
    // VSCS Touchscreen Radio & Frequency Matrix
    { const { c, x, t: tex } = sc.vscs, w = c.width, h = c.height; x.fillStyle = '#0a0d12'; x.fillRect(0, 0, w, h);
      mono(x, 11, 700); x.fillStyle = '#8fa9c2'; x.fillText('VSCS COMM · LOCAL / GND / EMERG', 8, 18);
      const ch = [['LC 118.30', '#1c4d7a'], ['GC 121.90', '#18382c'], ['CD 121.75', '#232b36'], ['APP 124.20', '#232b36'], ['GRD 121.50', '#611818'], ['ARFF 122.9', alert ? '#a8221c' : '#2a221c']];
      ch.forEach((b, i) => { const bx = 8 + (i % 3) * ((w - 16) / 3), by = 28 + Math.floor(i / 3) * ((h - 36) / 2); x.fillStyle = b[1]; x.fillRect(bx, by, (w - 28) / 3, (h - 46) / 2); x.strokeStyle = 'rgba(255,255,255,.2)'; x.strokeRect(bx, by, (w - 28) / 3, (h - 46) / 2); x.fillStyle = '#fff'; mono(x, 10, 600); x.fillText(b[0], bx + 6, by + 26); });
      tex.needsUpdate = true; }
    // Perimeter Wildlife Cams (CAM 01 Threshold, CAM 03 East Fence / Drone)
    for (const [key, title, tag] of [['cam1', 'CAM 01 · THR 27', 'FLOCK VECTOR'], ['cam3', 'CAM 03 · E FENCE', 'DRONE D-01']]) {
      const { c, x, t: tex } = sc[key], w = c.width, h = c.height;
      const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#1e2c3a'); g.addColorStop(0.55, '#465768'); g.addColorStop(1, '#263038'); x.fillStyle = g; x.fillRect(0, 0, w, h);
      x.strokeStyle = alert ? '#2F6FE4' : '#3ddc84'; x.lineWidth = 2; x.strokeRect(w * 0.36, h * 0.32, w * 0.28, h * 0.32);
      x.fillStyle = 'rgba(5,8,12,.7)'; x.fillRect(0, 0, w, 20); x.fillRect(0, h - 20, w, 20);
      mono(x, 10, 600); x.fillStyle = '#eaf2f8'; x.fillText(title, 6, 13); x.fillStyle = alert ? '#ff5449' : '#6ec8ff'; x.fillText(tag + ' · LIVE', 6, h - 6);
      tex.needsUpdate = true;
    }
    // D-ATIS
    { const { c, x, t: tex } = sc.atis, w = c.width, h = c.height; x.fillStyle = '#060a0e'; x.fillRect(0, 0, w, h);
      mono(x, 11, 700); x.fillStyle = '#ffd166'; x.fillText('D-ATIS INFO JULIET · 1140Z', 8, 18);
      mono(x, 10); x.fillStyle = '#cad7e2';
      ['ILS RWY 27 APPROACH IN USE', 'WIND 270 AT 8 · RWY DRY', 'BIRD ACTIVITY REPORTED FINAL', 'ADVISE ON INITIAL CONTACT'].forEach((l, i) => x.fillText(l, 8, 38 + i * 18));
      tex.needsUpdate = true; }
    // TFDM Clearance / Ground Strips + Arrival Spacing Traffic
    { const { c, x, t: tex } = sc.tfdm2, w = c.width, h = c.height; x.fillStyle = '#0c1016'; x.fillRect(0, 0, w, h);
      mono(x, 11, 700); x.fillStyle = '#8fb3d4'; x.fillText('TFDM · CLEARANCE / GND', 8, 18);
      [['UAL77  B789', 'GATE 14 -> 27'], ['DAL118 A321', 'HOLD SHORT 27'], ['JBU410 A320', 'DE-ICE PAD 2'], ['FDX901 B763', 'CARGO RAMP']].forEach((r, i) => { x.fillStyle = '#18212b'; x.fillRect(8, 26 + i * 26, w - 16, 22); x.fillStyle = '#e5eef6'; mono(x, 10, 600); x.fillText(r[0] + '  ' + r[1], 14, 41 + i * 26); });
      tex.needsUpdate = true; }
    { const { c, x, t: tex } = sc.traffic, w = c.width, h = c.height; x.fillStyle = '#05090e'; x.fillRect(0, 0, w, h);
      mono(x, 11, 700); x.fillStyle = '#7bdff2'; x.fillText('ARRIVAL SEQUENCE · RWY 27', 8, 18);
      x.strokeStyle = '#2d4963'; x.beginPath(); x.moveTo(16, h * 0.55); x.lineTo(w - 16, h * 0.55); x.stroke();
      [['SKY902', 0.22, alert ? '#ff4d42' : '#3ddc84'], ['AAL2201', 0.54, '#7bdff2'], ['SWA814', 0.82, '#7bdff2']].forEach(([cs, u, col]) => { const X = 16 + u * (w - 32); x.fillStyle = col; x.fillRect(X - 4, h * 0.55 - 12, 8, 24); mono(x, 10, 600); x.fillText(cs, X - 16, h * 0.55 - 18); });
      tex.needsUpdate = true; }
    // TDWR Terminal Doppler Weather Radar
    { const { c, x, t: tex } = sc.wx_rad, w = c.width, h = c.height; x.fillStyle = '#03060a'; x.fillRect(0, 0, w, h);
      const cx = w / 2, cy = h / 2, R0 = Math.min(w, h) * 0.42;
      for (let i = 0; i < 6; i++) { const rg = x.createRadialGradient(cx + (i - 2.5) * 18, cy + (i % 2 ? -14 : 18), 2, cx + (i - 2.5) * 18, cy + (i % 2 ? -14 : 18), 38); rg.addColorStop(0, 'rgba(60,210,140,.55)'); rg.addColorStop(0.5, 'rgba(40,120,210,.35)'); rg.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = rg; x.fillRect(0, 0, w, h); }
      x.strokeStyle = 'rgba(130,170,210,.35)'; for (let k = 1; k <= 3; k++) { x.beginPath(); x.arc(cx, cy, R0 * k / 3, 0, 7); x.stroke(); }
      mono(x, 10, 600); x.fillStyle = '#9fd0ff'; x.fillText('TDWR · SNOW CELL NE', 8, 16);
      tex.needsUpdate = true; }
    // Ground Surface Map + Secondary STARS Radar
    { const { c, x, t: tex } = sc.ground, w = c.width, h = c.height; x.fillStyle = '#080e0a'; x.fillRect(0, 0, w, h);
      x.fillStyle = '#2e3842'; x.fillRect(20, h * 0.42, w - 40, 12); x.fillRect(36, h * 0.65, w - 72, 8);
      mono(x, 11, 700); x.fillStyle = '#7dffa0'; x.fillText('GND · TWY A / B · RWY 27', 10, 20);
      x.fillStyle = '#ffd166'; x.fillRect(w * 0.45, h * 0.66, 10, 6); x.fillText('DAL118', w * 0.45 + 14, h * 0.72);
      tex.needsUpdate = true; }
    { const { c, x, t: tex } = sc.radar2, w = c.width, h = c.height, cx = w / 2, cy = h / 2, R0 = Math.min(w, h) * 0.44;
      x.fillStyle = '#020408'; x.fillRect(0, 0, w, h); x.strokeStyle = 'rgba(90,140,190,.35)';
      for (let i = 1; i <= 4; i++) { x.beginPath(); x.arc(cx, cy, R0 * i / 4, 0, 7); x.stroke(); }
      mono(x, 10, 600); x.fillStyle = '#7ee081'; x.fillText('STARS E · 30NM', 8, 16);
      [[0.3, 0.4, 'AAL2201'], [0.6, 2.5, 'SWA814'], [0.75, 4.7, 'JBU410']].forEach(([rr, a, cs]) => { const X = cx + Math.cos(a) * R0 * rr, Y = cy + Math.sin(a) * R0 * rr; x.fillRect(X - 2, Y - 2, 5, 5); x.fillText(cs, X + 6, Y - 4); });
      tex.needsUpdate = true; }
    // Overhead FAA Cab Status & Frequency Displays
    { const { c, x, t: tex } = sc.oh_status, w = c.width, h = c.height; x.fillStyle = '#070a0f'; x.fillRect(0, 0, w, h);
      x.strokeStyle = '#243447'; x.lineWidth = 3; x.strokeRect(3, 3, w - 6, h - 6);
      mono(x, 26, 700); x.fillStyle = '#3ddc84'; x.fillText('11:41:18 Z', 20, h * 0.62);
      x.fillStyle = '#ffd166'; x.fillText('270° / 08KT', w * 0.36, h * 0.62);
      x.fillStyle = '#8ad0ff'; x.fillText('30.02', w * 0.72, h * 0.62);
      mono(x, 11, 600); x.fillStyle = '#7e93a8'; x.fillText('UTC CLOCK', 20, 22); x.fillText('SURFACE WIND', w * 0.36, 22); x.fillText('ALTIMETER', w * 0.72, 22);
      tex.needsUpdate = true; }
    { const { c, x, t: tex } = sc.oh_freq, w = c.width, h = c.height; x.fillStyle = alert ? '#2b0908' : '#070a0f'; x.fillRect(0, 0, w, h);
      x.strokeStyle = alert ? '#ff3b30' : '#243447'; x.lineWidth = 3; x.strokeRect(3, 3, w - 6, h - 6);
      mono(x, 24, 700); x.fillStyle = '#fff'; x.fillText('RWY 27 ACTIVE', 18, h * 0.62);
      x.fillStyle = alert ? '#ff4d42' : '#3ddc84'; x.fillText(alert ? 'WILDLIFE ALERT' : 'CAT I · OPEN', w * 0.48, h * 0.62);
      mono(x, 11, 600); x.fillStyle = '#9bb0c4'; x.fillText('LOCAL 118.30 · GND 121.90 · GUARD 121.50', 18, 22);
      tex.needsUpdate = true; }
    // ASDE-X Surface Movement Radar (static airport geometry + alert marker)
    { const { c, x, t: tex } = sc.asdex, w = c.width, h = c.height; x.fillStyle = '#060a08'; x.fillRect(0, 0, w, h);
      const sx = (X) => 20 + (X + 1400) / 4500 * (w - 40), sz = (Z) => h * 0.48 + Z / 1200 * h;
      x.fillStyle = '#2d3740'; x.fillRect(sx(0), sz(-28), sx(3000) - sx(0), 10); x.fillRect(sx(0), sz(160), sx(3000) - sx(0), 6);
      mono(x, 11, 700); x.fillStyle = '#7dffa0'; x.fillText('ASDE-X SURFACE · RWY 27', 10, 18);
      x.fillStyle = '#7dffa0'; x.beginPath(); x.arc(sx(-520), sz(0), 5, 0, 7); x.fill(); x.fillText('SKY902', sx(-520) + 8, sz(0) - 8);
      if (alert > 0) { x.fillStyle = '#ff4632'; x.beginPath(); x.arc(sx(-340), sz(20), 8, 0, 7); x.fill(); x.fillStyle = '#ff6a5a'; x.fillText('FLOCK', sx(-340) + 10, sz(20) + 4); }
      tex.needsUpdate = true; }
    // TFDM Electronic Flight Progress Strips
    { const { c, x, t: tex } = sc.tfdm, w = c.width, h = c.height; x.fillStyle = '#0d1117'; x.fillRect(0, 0, w, h);
      const rows = [['SKY902', 'B74S/H', 'RWY 27', alert ? 'GO AROUND' : 'CLRD LAND'], ['DAL118', 'A321/M', 'TWY B', 'HOLD'], ['N512RT', 'C172/L', 'RWY 27', 'PATTERN'], ['UAL77', 'B789/H', 'GATE 14', 'PUSH']];
      rows.forEach((r, i) => { const y = 10 + i * (h - 14) / 4, hh = (h - 14) / 4 - 6; x.fillStyle = i === 0 ? (alert ? '#5a1410' : '#1d2a1e') : '#161b22'; x.fillRect(8, y, w - 16, hh); x.fillStyle = i === 0 ? '#ffffff' : '#a9b4c2'; mono(x, 14, 600); x.fillText(r[0], 14, y + hh * 0.62); mono(x, 11); x.fillText(r[1], w * 0.36, y + hh * 0.62); x.fillText(r[2], w * 0.58, y + hh * 0.62); x.fillStyle = i === 0 ? (alert ? '#ff6a5a' : '#7dffa0') : '#7f8a99'; x.fillText(r[3], w * 0.74, y + hh * 0.62); });
      tex.needsUpdate = true; }
    // ADS-B Flight List
    { const { c, x, t: tex } = sc.adsb, w = c.width, h = c.height; x.fillStyle = '#05080d'; x.fillRect(0, 0, w, h); mono(x, 11, 600); x.fillStyle = '#6f8bab'; x.fillText('ADS-B  CALLSIGN  ALT   GS  HDG', 10, 20);
      const Lr = [['SKY902', '0280', '140', '270'], ['N512RT', '1400', '092', '180'], ['UAL77', '000', '000', '090'], ['AAL2201', '6800', '231', '045'], ['DAL118', '000', '012', '360']];
      Lr.forEach((r, i) => { x.fillStyle = i === 0 ? '#eaf2ff' : '#9fb3c8'; x.fillText(`${String(i + 1).padStart(2, '0')}    ${r[0].padEnd(8)}${r[1].padStart(5)} ${r[2]} ${r[3]}`, 10, 42 + i * 20); }); tex.needsUpdate = true; }
    // Sky Sentry Alert Panel
    { const { c, x, t: tex } = sc.alert, w = c.width, h = c.height; x.fillStyle = alert ? '#7a1410' : '#0a0d12'; x.fillRect(0, 0, w, h);
      mono(x, 13, 600); x.fillStyle = '#fff'; x.fillText('SKY SENTRY ALERT', 12, 26); mono(x, 28, 700); x.fillStyle = alert ? '#fff' : '#3ddc84'; x.fillText(alert ? 'RISK HIGH' : 'RISK LOW', 12, h * 0.58); mono(x, 12); x.fillStyle = 'rgba(255,255,255,.8)'; x.fillText(alert ? 'BIRDS ON FINAL · RWY 27' : 'MONITORING', 12, h * 0.84); tex.needsUpdate = true; }
  }
  function drawScreens(t, st) {
    const sc = screens; if (!sc.radar) return;
    if (staticScreensAlert !== st.alert) { staticScreensAlert = st.alert; drawStaticScreens(st.alert); }
    if (!vmap) { const r = FK.rng(3); vmap = []; for (let k = 0; k < 9; k++) { const pts = []; let x = r() * 2 - 1, y = r() * 2 - 1; for (let i = 0; i < 7; i++) { pts.push([x, y]); x += (r() - 0.5) * 0.5; y += (r() - 0.5) * 0.5; } vmap.push(pts); } }
    // Live screen 1 of 2: STARS Primary Local Control Radar
    { const { c, x, t: tex } = sc.radar, w = c.width, h = c.height, cx = w / 2, cy = h / 2, R0 = Math.min(w, h) * 0.48;
      x.fillStyle = '#020407'; x.fillRect(0, 0, w, h);
      x.strokeStyle = 'rgba(90,120,150,.38)'; x.lineWidth = 1; vmap.forEach((pl) => { x.beginPath(); pl.forEach(([px, py], i) => { const X = cx + px * R0 * 1.25, Y = cy + py * R0 * 1.25; i ? x.lineTo(X, Y) : x.moveTo(X, Y); }); x.stroke(); });
      x.setLineDash([2, 5]); x.strokeStyle = 'rgba(120,150,180,.28)'; for (let i = 1; i <= 5; i++) { x.beginPath(); x.arc(cx, cy, R0 * i / 5, 0, 7); x.stroke(); } x.setLineDash([]);
      x.strokeStyle = 'rgba(210,225,240,.8)'; x.lineWidth = 2; x.beginPath(); x.moveTo(cx - 16, cy - 3); x.lineTo(cx + 20, cy - 3); x.stroke();
      const ac = [[0.14 + (st.nm / 6) * 0.45, Math.PI, 0, 0, 'SKY902', '0' + String(Math.round(st.ft / 100)).padStart(2, '0') + ' B74S', '#eef8ee'], [0.45, 2.2, 0.22, 1, 'DAL118', '031 A321', '#d6f5d6'], [0.62, 4.0, -0.15, 1, 'N512RT', '014 C172', '#d6f5d6'], [0.82, 5.3, 0.3, 1, 'AAL2201', '068 B738', '#9fe0ff']];
      x.font = '600 11px ui-monospace, Menlo, monospace';
      ac.forEach(([rr, ang, vel, mv, cs, alt, col]) => { const a2 = ang + (mv ? t * 0.004 * (1 + vel) : 0); const X = cx + Math.cos(a2) * R0 * rr, Y = cy + Math.sin(a2) * R0 * rr;
        x.fillStyle = col; x.fillRect(X - 3, Y - 3, 6, 6); x.strokeStyle = 'rgba(200,220,200,.6)'; x.beginPath(); x.moveTo(X + 4, Y - 4); x.lineTo(X + 16, Y - 16); x.stroke(); x.fillText(cs, X + 18, Y - 18); x.fillText(alt, X + 18, Y - 5); });
      if (st.alert > 0) { const on = Math.sin(t * 12) > -0.2; x.strokeStyle = on ? '#ff3b30' : 'rgba(255,59,48,.3)'; x.lineWidth = 2; x.strokeRect(cx - R0 * 0.24 - 18, cy - 14, 36, 24); x.fillStyle = on ? '#ff3b30' : 'rgba(255,59,48,.4)'; x.fillText('BIRDS', cx - R0 * 0.24 - 16, cy - 20); }
      x.fillStyle = '#7f8b99'; x.font = '500 10px ui-monospace, Menlo, monospace'; x.fillText('STARS · KSKY 1141Z · RWY 27', 8, h - 8); tex.needsUpdate = true;
    }
    // Live screen 2 of 2: Sky Sentry Centre Hero Widescreen
    { const { c, x, t: tex } = sc.sentry, w = c.width, h = c.height, A = st.alert;
      x.fillStyle = '#06080c'; x.fillRect(0, 0, w, h); const fx = w * 0.045, fy = h * 0.14, fw = w * 0.635, fh = fw * 9 / 16; x.clearRect(fx, fy, fw, fh);
      const red = A > 0 && Math.sin(t * 11) > -0.3; x.strokeStyle = A > 0 ? (red ? '#ff3b30' : '#7a1d18') : '#2d3a4f'; x.lineWidth = A > 0 ? 8 : 3; x.strokeRect(4, 4, w - 8, h - 8);
      mono(x, 20, 700); x.fillStyle = '#fff'; x.fillText('SKY SENTRY', fx, h * 0.09); mono(x, 14); x.fillStyle = '#8fa0b8'; x.fillText('RWY 27 FINAL · CAM 02 · LIVE', fx + 170, h * 0.09);
      const H2 = sc.sentry.hud, hx = H2.x; hx.clearRect(0, 0, 640, 360); hx.strokeStyle = SIGNAL; hx.lineWidth = 2;
      for (let i = 0; i < NB; i += 1) { const s = birdNow[i].clone().project(sentCam); if (s.z < 1 && Math.abs(s.x) < 1 && Math.abs(s.y) < 1) { const bx = (s.x + 1) / 2 * 640, by = (1 - s.y) / 2 * 360; hx.strokeRect(bx - 6, by - 5, 12, 10); } }
      if (red) { hx.strokeStyle = '#ff3b30'; hx.lineWidth = 6; hx.strokeRect(3, 3, 634, 354); } H2.t.needsUpdate = true;
      const px = fx + fw + w * 0.03, pw = w - px - w * 0.04; mono(x, 13); x.fillStyle = '#8fa0b8'; x.fillText('OBJECTS', px, fy + 14); mono(x, 40, 700); x.fillStyle = '#fff'; x.fillText(String(NB + 1), px, fy + 58);
      mono(x, 13); x.fillStyle = '#8fa0b8'; x.fillText('RUNWAY RISK', px, fy + 94); const risk = st.risk; x.fillStyle = '#1b2230'; x.fillRect(px, fy + 104, pw, 15); x.fillStyle = risk > 0.66 ? '#ff3b30' : risk > 0.36 ? '#ffb02e' : '#3ddc84'; x.fillRect(px, fy + 104, pw * risk, 15);
      if (A > 0) { x.fillStyle = red ? '#ff3b30' : '#a1201a'; x.fillRect(0, h * 0.8, w, h * 0.2); mono(x, Math.round(h * 0.064), 800); x.fillStyle = '#fff'; x.fillText('BIRDS ON FINAL · RWY 27 · GO AROUND', w * 0.045, h * 0.92); }
      else { mono(x, 14); x.fillStyle = '#7dffa0'; x.fillText('● MONITORING', w * 0.045, h * 0.9); }
      tex.needsUpdate = true; }
  }

  // ================= backdrop for the sections after the film =================
  const after = Array.from(document.querySelectorAll('main > section.ice'));
  const backdropQ = () => { const a = after[0], b = after[after.length - 1]; if (!a) return 0; const top = a.getBoundingClientRect().top + scrollY, bot = b.getBoundingClientRect().bottom + scrollY; return clamp((scrollY + innerHeight * 0.5 - top) / Math.max(1, bot - top), 0, 1); };

  // ================= loop =================
  let forced = null, lastForced = null, ps = 0, lastP = 0, lt = 0, last = 0, visible = true, frameN = 0, mode = null, useFrames = false, framePl = null, lastMonT = -1e9;
  document.addEventListener('visibilitychange', () => { visible = !document.hidden; });
  const filmP = () => { const r = film.getBoundingClientRect(); return clamp(-r.top / Math.max(1, r.height - innerHeight), 0, 1); };
  let inCloud = 0, bk = 0;
  const mt = new T.Vector2(), mouse = new T.Vector2(); window.addEventListener('pointermove', (e) => mt.set(e.clientX / innerWidth * 2 - 1, e.clientY / innerHeight * 2 - 1), { passive: true });
  const cA = new T.Color(), cB = new T.Color();
  function setLook(sh) { C.position.copy(sh.pos); if (sh.quat) C.quaternion.copy(sh.quat); else C.lookAt(sh.look); }

  const shC = V(0, 0, 0), camAbs = V(0, 0, 0), refPrev = V(0, 0, 0), refNow = V(0, 0, 0), camQ = new T.Quaternion(); let camInit = false;
  function frame(now) {
    if (!visible) return;
    const dt = clamp((now - (last || now)) / 1000, 0.0005, 0.05); last = now; lt += dt; const t = lt;
    const rf = film.getBoundingClientRect(), filmOn = rf.bottom > innerHeight * 0.02;
    const p0 = forced != null ? forced : filmP();
    ps = forced != null ? p0 : ps + (p0 - ps) * (1 - Math.exp(-dt * 6)); if (Math.abs(p0 - ps) < 1e-5) ps = p0;
    let p = clamp(ps, 0, 1);
    govern(now);
    const back = forced == null && !filmOn;
    frameN++;
    // after the film, the sections scroll over a slow replay of the project itself: final approach, the flock, the drone
    if (back) { bk += (backdropQ() - bk) * (1 - Math.exp(-dt * 3)); p = 0.30 + bk * 0.235; }
    const bScene = false;
    lpT.value = t; flockU.uT.value = t; cloudU.uT.value = t; snowU.uT.value = t; G.uT.value = t;
    const st = planeAt(p, t);
    PL.position.set(st.x, st.y, st.z); PL.rotation.set(0, -st.yaw * DEG, 0); body.rotation.set(st.roll * DEG, 0, st.pitch * DEG);
    rwU.uPlanePos.value.copy(PL.position);
    heatU.uN1.value = st.n1;
    if (plane.gear) { plane.gear.scale.y = Math.max(0.01, st.gear); plane.gear.visible = st.gear > 0.02; }
    updateFlock(p, t);
    drone.position.set(DRONE0.x + Math.sin(t * 0.3) * 2, DRONE0.y + Math.sin(t * 0.9) * 0.4, DRONE0.z + Math.cos(t * 0.25) * 1.5); drone.rotation.y = Math.sin(t * 0.2) * 0.4; dr.props.forEach((pr, i) => { pr.rotation.y += (i % 2 ? 1 : -1) * dt * 55; });
    dr.leds.forEach((l, i) => { l.visible = Math.sin(t * 6 + i) > -0.2; }); dr.strobe.visible = (t * 1.2) % 1 < 0.06;
    PL.updateMatrixWorld(true);
    let sh;
    sh = shotBlend(p, t, ps);
    const modeChanged = sh.mode !== mode;
    if (modeChanged) { mode = sh.mode; }
    setLook(sh);
    // final damping: the camera's offset from the airliner and its rotation ease toward the shot, filtering any remaining roughness
    // shots that ride with the airliner carry its motion forward; cameras fixed in the world (tripod, tower, ground) stay put
    { const ride = 1 - ss(0.42, 0.47, p) + ss(0.86, 0.9, p); refNow.copy(PL.position).multiplyScalar(clamp(ride, 0, 1));
      if (forced == null && camInit) {
        const k = 1 - Math.exp(-dt * 10);
        camAbs.add(refNow).sub(refPrev).lerp(C.position, k); C.position.copy(camAbs);
        camQ.slerp(C.quaternion, k); C.quaternion.copy(camQ);
      } else { camAbs.copy(C.position); camQ.copy(C.quaternion); camInit = true; }
      refPrev.copy(refNow); }
    mouse.lerp(mt, 1 - Math.exp(-dt * 2)); if (sh.sensor < 0.5) { C.rotateY(-mouse.x * 0.016 * (1 - sh.sensor)); C.rotateX(-mouse.y * 0.011 * (1 - sh.sensor)); }
    if (sh.shake) { const k = sh.shake; C.rotateX(tbn(TB.p, t * 9) * 0.006 * k); C.rotateY(tbn(TB.r, t * 8) * 0.006 * k); C.position.y += tbn(TB.y, t * 7) * 0.12 * k; }
    C.fov = sh.fov; C.near = sh.mode === 'cockpit' ? 0.04 : sh.mode === 'tower' ? 0.1 : 0.4; C.updateProjectionMatrix(); C.updateMatrixWorld(true);
    const cockpit = sh.mode === 'cockpit', inTower = sh.mode === 'tower';
    if (plane.mesh) plane.mesh.visible = !cockpit; grp.cockpit.visible = cockpit;
    Object.values(plane.sprites).forEach((s) => { s.visible = !cockpit; });
    plane.cones.forEach((c) => { c.visible = !cockpit && !bScene; });
    plane.plumes.forEach((c) => { c.visible = !cockpit && !bScene; });
    if (!bScene && !cockpit && sh.mode !== 'sentry' && (modeChanged || frameN % (PERF.high ? 1 : 2) === 0)) {
      const c = inTower ? TWR : PL.position, q = 0.5; shC.set(Math.round(c.x / q) * q, Math.round(c.y / q) * q, Math.round(c.z / q) * q);
      sunL.target.position.copy(shC); sunL.target.updateMatrixWorld(); sunL.position.copy(shC).addScaledVector(SUN, 900); R.shadowMap.needsUpdate = true;
    }
    grp.airport.visible = grp.tower.visible = !bScene; grp.flock.visible = !bScene && p > 0.3; drone.visible = phoneG.visible = !bScene && p > 0.3 && p < 0.9; vort.pts.visible = !bScene;
    const cy = C.position.y; const approach = C.position.x < 9000;
    inCloud = approach ? ss(CB - 25, CB + 140, cy) * (1 - ss(CTOP - 160, CTOP + 30, cy)) : 0;
    const above = cy > CTOP - 60;
    const pre = bScene ? 0 : 1 - ss(0.02, 0.2, p);
    setSun(bScene ? 7 : lerp(-1.4, 0.8, ss(0, 0.24, p)));
    starsU.uA.value = bScene ? 0 : above ? pre * 0.9 : 0; starsU.uScale.value = Math.max(1.0, curPR);
    S.environment = above ? envAbove : envBelow;
    if (above) { cA.setRGB(0.45, 0.54, 0.66); S.fog.color.copy(cA); S.fog.density = 0.000012; }
    else {
      // Crisp cold dawn slate-blue haze (never flat muddy grey) so runway lights, approach strobes, dawn ridge & 747SP pop cleanly
      cA.setRGB(0.16, 0.23, 0.33); cB.setRGB(0.84, 0.87, 0.91);
      S.fog.color.copy(cA).lerp(cB, inCloud);
      S.fog.density = lerp(0.000075, 0.011, Math.pow(inCloud, 1.5));
    }
    cloudU.uFogD.value = S.fog.density; cloudU.uFogC.value.copy(S.fog.color); lpFog.value = S.fog.density;
    if (bScene) { cloudU.uLit.value.setRGB(1.0, 0.98, 0.97); cloudU.uShade.value.setRGB(0.6, 0.67, 0.78); cloudU.uSunC.value.setRGB(1.0, 0.85, 0.7); }
    else if (above) { cloudU.uLit.value.setRGB(0.78 + pre * -0.25, 0.6 - pre * 0.2, 0.55 - pre * 0.12); cloudU.uShade.value.setRGB(0.16, 0.19, 0.28); cloudU.uSunC.value.setRGB(1.0, 0.55, 0.3).multiplyScalar(1 - pre * 0.5); }
    else { cloudU.uLit.value.setRGB(0.44, 0.50, 0.60); cloudU.uShade.value.setRGB(0.16, 0.21, 0.30); cloudU.uSunC.value.setRGB(0.95, 0.62, 0.38); }
    hemi.intensity = bScene ? 1.2 : above ? 0.35 + (1 - pre) * 0.35 : 0.42;
    sunL.intensity = bScene ? 2 : above ? 0.8 * (1 - pre * 0.7) : 0.78;
    const lowShot = !bScene && !above && inCloud < 0.05 && cy < 260;
    slices.forEach((m, i) => {
      m.renderOrder = 10 + Math.round(2000 - Math.abs(cy - m.userData.y));
      m.visible = bScene ? m.userData.y > CB + 300 : lowShot ? i < 2 : above ? i >= slices.length - 2 : true;
    });
    // above the deck only the top two layers are drawn (the rest are hidden behind them anyway), made denser to match
    cloudU.uDen.value = (mobile ? 0.36 : 0.28) * (above ? 1.75 : 1);
    const below = !above && inCloud < 0.5; fieldLights.renderOrder = city.renderOrder = below ? 3000 : 2; snowfall.visible = false;
    sky.position.copy(C.position); stars.position.copy(C.position);
    lpScale.value = H * R.getPixelRatio() / (2 * Math.tan(C.fov * DEG / 2));
    const sp = plane.sprites, dcam = C.position.distanceTo(PL.position), grow = Math.max(1, dcam / 280);
    const strobe = (t * 0.95) % 1, sOn = strobe < 0.05 || (strobe > 0.12 && strobe < 0.17);
    sp.strL.visible = sp.strR.visible = !cockpit && sOn; sp.bcn.visible = sp.bcn2.visible = !cockpit && Math.sin(t * 6.5) > 0.7;
    Object.values(sp).forEach((s) => s.scale.setScalar(s.userData.base * Math.min(grow, 44) * (s === sp.landL || s === sp.landR || s === sp.nose ? 1.55 : 1)));
    coneU.uMist.value = below ? 1.15 : 0.3; coneU.uI.value = 1;
    if (!cockpit && !back && (p > 0.34 && p < 0.47 || p > 0.8 && p < 0.88)) for (const z of [-29.8, 29.8]) { const w = body.localToWorld(V(-4, 3.3, z)); vort.add({ p: w, age: 0, life: 2.6, ang: Math.random() * 6, r: 0.4 + Math.random() * 1.2, s: 1.4, a: 0.18 }); }
    vort.update(dt);
    snowU.uA.value = 0;
    const alert = p > 0.652 && p < 0.80 ? 1 : 0, risk = clamp(0.12 + ss(0.56, 0.635, p) * 0.86, 0, 1);
    if (towerFx.red) { towerFx.red.intensity = alert ? 2.6 * (Math.sin(t * 11) > -0.3 ? 1 : 0.25) : 0; towerFx.dome.material.color.setRGB(alert && Math.sin(t * 11) > -0.3 ? 4 : 0.25, 0.04, 0.03); }
    // Throttle live ATC monitor redraws + Sky Sentry live feed RT cleanly to 12 Hz (static screens drawn once)
    const forcedChanged = forced !== lastForced;
    lastForced = forced;
    if (inTower && (modeChanged || forcedChanged || (now - lastMonT >= 83))) {
      lastMonT = now;
      drawScreens(t, { alert, risk, ga: st.ga, ft: st.ft, kt: st.kt, nm: st.nm, flock: flockC(p, V(0, 0, 0)) });
      sentAim(clamp(p, 0.6, 0.64)); grp.tower.visible = false; const fg = S.fog.density; R.setRenderTarget(feedRT); R.render(S, sentCam); R.setRenderTarget(null); grp.tower.visible = true; S.fog.density = fg;
    }
    if (cockpit && (modeChanged || forcedChanged || frameN % 5 === 0)) {
      const s2 = { pitch: st.pitch, roll: st.roll, kt: st.kt, ft: st.ft, hdg: 272 + st.yaw, ga: st.ga, app: st.app, gsd: clamp(st.gsDev / 8, -2, 2), nm: Math.max(0.3, st.nm), n1: st.n1, gear: st.gear, sel: st.ga ? 160 : st.app ? 140 : 250, tfc: p > 0.9 };
      drawPFD(ck.pfd.getContext('2d'), 512, 512, s2); drawND(ck.nd.getContext('2d'), 512, 512, s2); drawEICAS(ck.eicas.getContext('2d'), 512, 512, s2); drawMCP(ck.mcp.getContext('2d'), 1536, 128, s2);
      ck.pfdT.needsUpdate = ck.ndT.needsUpdate = ck.eicasT.needsUpdate = ck.mcpT.needsUpdate = true;
      ck.levers.forEach((l) => { l.rotation.z = -0.2 - st.n1 * 0.55; });
    }
    wetU.uWet.value = cockpit ? clamp(inCloud * 1.3 + (p > 0.24 && p < 0.3 ? 0.35 * (1 - ss(0.24, 0.3, p)) : 0), 0, 1) : 0; wetU.uFlow.value = 0.6 + st.kt / 300;
    let exp = back ? 1.0 : above ? lerp(0.95, 0.72, 1 - pre) : sh.exp;
    exp *= 1 - inCloud * 0.10;
    const dip = 0;
    let white = back ? 0 : inCloud * 0.45 + ss(0.935, 0.975, p) * 1.0;
    if (!back && p > 0.53 && p < 0.548) white = Math.max(white, 1 - ss(0.0, 0.006, Math.abs(p - 0.545)));
    G.uExp.value = exp; G.uDip.value = dip * (p > 0.53 && p < 0.55 ? 0 : 1); G.uWhite.value = Math.min(1, white);
    G.uSensor.value = sh.sensor; G.uCA.value = 0.0005 + (sh.shake || 0) * 0.004; G.uSat.value = back ? 0.92 : 1.04;
    G.uTint.value.set(1.0, 1.0, 1.02); G.uLift.value = back ? 0.02 : 0; G.uVig.value = back ? 0.32 : 0.36; G.uGrain.value = back ? 0.004 : 0.008;
    bloom.threshold = sh.mode === 'tower' ? 1.02 : 1.08;
    bloom.strength = back ? 0.22 : sh.mode === 'tower' ? 0.32 : 0.34;
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
    drawSentry(p, t, C, sh.sensor * ss(0.545, 0.552, p));
    lastP = p;
  }

  // ================= boot =================
  if (window.FilmPlayer && framesCv) {
    window.FilmPlayer.load(framesCv, 'assets/films/sky/manifest.json').then((pl) => { if (pl) { framePl = pl; useFrames = true; stage.classList.add('frames'); } }).catch(() => {});
  }
  window.__pose = (p, t) => { const st = planeAt(p, t); PL.position.set(st.x, st.y, st.z); PL.updateMatrixWorld(true); updateFlock(p, t); const sh = shotBlend(p, t, p); setLook(sh); C.updateMatrixWorld(true); const q = C.quaternion; return [C.position.x, C.position.y, C.position.z, q.x, q.y, q.z, q.w, st.x, st.y, st.z]; };
  window.film = { setProgress: (v) => { forced = v == null ? null : clamp(+v, 0, 1); }, get progress() { return ps; }, get dpr() { return R.getPixelRatio(); } };
  const fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  loads.push(fontsReady);
  const all = Promise.all(loads);
  all.then(() => { D.load.classList.add('off'); });
  S0.boot(all, () => { try { R.compile(S, C); } catch (e) {} });
  window.__sky = { S, C, R, comp, slices, bloom, gov };
  S0.loop(frame);
})();
