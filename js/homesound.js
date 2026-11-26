/* Home page soundscape: real CC0 field recordings (Freesound, see Credits) that follow the drone footage as you scroll.
   Lake shore and birds over the opening lake, high wind on the peaks, loons on the mirror lake, the creek by the tarn,
   evening air on the ridges, and water lapping at the dock in the canoe ending. Nothing loads until sound is turned on. */
(function () {
  const S0 = window.SITE;
  if (!S0 || !S0.ensureAudio) return;
  const secs = Array.from(document.querySelectorAll('main > section')); if (!secs.length) return;
  const N = secs.length;
  const LAYERS = ['rockies', 'peakwind', 'lake', 'lap', 'birds', 'creek'];
  // how loud each recording is in each section (0 hero lake, 1 peaks, 2 mirror lake, 3 dusk ridge, 4 tarn, 5 alpenglow, 6 sunset ridge, 7 canoes)
  const MIX = [
    { lake: 0.5, birds: 0.45, rockies: 0.25 },
    { peakwind: 0.55, rockies: 0.25 },
    { lake: 0.4, birds: 0.3, rockies: 0.15 },
    { rockies: 0.5, peakwind: 0.2 },
    { creek: 0.55, birds: 0.35 },
    { peakwind: 0.35, rockies: 0.3 },
    { rockies: 0.45, birds: 0.2 },
    { lap: 0.6, lake: 0.3, birds: 0.2 },
  ];
  const LOONS = [0, 0, 1, 0, 0, 0, 0, 0.7];   // where a loon may call
  const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const pos = () => { const mid = innerHeight * 0.5; for (let i = 0; i < N; i++) { const r = secs[i].getBoundingClientRect(); if (mid < r.bottom || i === N - 1) return i + Math.max(0, Math.min(1, (mid - r.top) / Math.max(1, r.height))); } return 0; };

  const A = { started: false, g: {}, buf: {}, nextLoon: 0 };
  function start() {
    if (A.started) return; const ac = S0.ensureAudio(); if (!ac) return; A.started = true; A.ac = ac;
    A.out = ac.createGain(); A.out.gain.value = 0.8; A.out.connect(S0.master);
    LAYERS.concat(['loon']).forEach((k) => fetch('assets/home-audio/' + k + '.mp3').then((r) => r.arrayBuffer()).then((ab) => ac.decodeAudioData(ab)).then((b) => {
      A.buf[k] = b; if (k === 'loon') return;
      const s = ac.createBufferSource(); s.buffer = b; s.loop = true; s.loopStart = 0.06; s.loopEnd = b.duration - 0.06;
      const g = ac.createGain(); g.gain.value = 0; s.connect(g); g.connect(A.out); s.start(0, Math.random() * (b.duration - 1)); A.g[k] = g;
    }).catch(() => {}));
  }
  function loon(vol) {
    const ac = A.ac, b = A.buf.loon; if (!b) return; const s = ac.createBufferSource(); s.buffer = b; s.playbackRate.value = 0.94 + Math.random() * 0.1;
    const g = ac.createGain(); g.gain.value = vol; const p = ac.createStereoPanner ? ac.createStereoPanner() : null;
    if (p) { p.pan.value = (Math.random() - 0.5) * 1.2; s.connect(g); g.connect(p); p.connect(A.out); } else { s.connect(g); g.connect(A.out); }
    s.start();
  }
  document.addEventListener('site:sound', (e) => { if (e.detail) start(); });
  if (S0.soundOn) start();

  let last = 0;
  const frame = (now) => {
    if (!A.started || !S0.soundOn) return;
    if (now - last < 100) return; last = now;   // ten updates a second is plenty for slow ambience
    const x = pos(), i = Math.min(N - 1, Math.floor(x)), f = ss(0.58, 1, x - i), j = Math.min(N - 1, i + 1);
    const a = MIX[Math.min(i, MIX.length - 1)] || {}, b = MIX[Math.min(j, MIX.length - 1)] || {}, t = A.ac.currentTime;
    LAYERS.forEach((k) => { const g = A.g[k]; if (g) g.gain.setTargetAtTime((a[k] || 0) * (1 - f) + (b[k] || 0) * f, t, 0.6); });
    const lw = (LOONS[i] || 0) * (1 - f) + (LOONS[j] || 0) * f;
    if (lw > 0.4 && now > A.nextLoon) { if (A.nextLoon) loon(0.35 * lw); A.nextLoon = now + 14000 + Math.random() * 16000; }
  };
  S0.loop(frame);
  window.__homeSound = { gains: () => Object.fromEntries(Object.entries(A.g).map(([k, g]) => [k, +g.gain.value.toFixed(2)])), loaded: () => Object.keys(A.buf) };
})();
