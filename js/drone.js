/* Home: drone moments from "The Rockies | Cinematic Drone 4K Video" by stoked tour (Samson Tan), used with permission.
   Sections 0 to 6 each own a looping moment; the last section is the 3D Lake Louise (js/lake.js).
   Everything follows the scroll position, not a timer: crossing from one section to the next blends the two scenes by
   exactly how far you have scrolled, and each clip pushes in and drifts with the scroll. The scenes on either side are
   kept loaded and playing so a blend never waits. Missing clips, reduced motion, data saver: posters, nothing breaks. */
(function () {
  const S0 = window.SITE, PF = window.PERF || {};
  const BASE = 'assets/rockies/';
  const still = S0.rm || (navigator.connection && navigator.connection.saveData);
  const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  fetch(BASE + 'manifest.json').then((r) => (r.ok ? r.json() : null)).then((m) => { if (m && m.clips && m.clips.length) start(m); }).catch(() => {});

  function start(man) {
    const bySec = {}; man.clips.forEach((c) => { bySec[c.section] = c; });
    const px = innerWidth * Math.min(devicePixelRatio || 1, 2), q = PF.low ? 720 : (PF.ultra || (PF.high && px > 2000)) ? 2160 : 1080;
    const wrap = document.createElement('div'); wrap.className = 'drone'; wrap.setAttribute('aria-hidden', 'true');
    const scrim = document.createElement('div'); scrim.className = 'scrim'; wrap.appendChild(scrim);
    const world = document.getElementById('world'); (world ? world.parentNode : document.body).insertBefore(wrap, world ? world.nextSibling : null);
    const credit = document.createElement('a'); credit.className = 'drone-credit hud'; credit.href = man.source; credit.target = '_blank'; credit.rel = 'noopener';
    credit.textContent = 'Footage: stoked tour, The Rockies'; credit.setAttribute('aria-label', 'Drone footage: The Rockies by stoked tour, on YouTube'); document.body.appendChild(credit);

    // a small pool of video layers, one per clip near the current position
    const pool = [];
    const layer = (c) => {
      let L = pool.find((p) => p.c === c); if (L) return L;
      L = pool.find((p) => !p.keep);
      if (!L) { const v = document.createElement('video'); v.muted = true; v.defaultMuted = true; v.loop = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.setAttribute('muted', ''); v.preload = 'auto'; v.disablePictureInPicture = true; wrap.insertBefore(v, scrim); L = { v, c: null }; pool.push(L); }
      L.c = c; L.v.poster = BASE + c.name + '.webp';
      if (still) { L.v.removeAttribute('src'); L.v.load(); } else { L.v.src = BASE + c.name + '_' + q + '.mp4'; L.v.load(); }
      return L;
    };
    const play = (v) => { if (still || !v.getAttribute('src')) return; if (v.paused) { const p = v.play(); if (p && p.catch) p.catch(() => {}); } };

    const secs = Array.from(document.querySelectorAll('main > section')), N = secs.length;
    // continuous position: section index + how far its middle has been crossed (the same measure the 3D scene uses)
    const pos = () => { const mid = innerHeight * 0.5; for (let i = 0; i < N; i++) { const r = secs[i].getBoundingClientRect(); if (mid < r.bottom || i === N - 1) return i + Math.max(0, Math.min(1, (mid - r.top) / Math.max(1, r.height))); } return 0; };
    let x = pos(), shownX = -1;
    const frame = () => {
      requestAnimationFrame(frame);
      const target = pos(); x += (target - x) * (S0.rm ? 1 : 0.22); // a touch of smoothing so a wheel step still glides
      if (Math.abs(x - shownX) < 0.0004) return; shownX = x;
      const i = Math.min(N - 1, Math.floor(x)), f = x - i;
      const b = ss(0.58, 1.0, f); // the hand-over runs across the last stretch of each section
      const cA = bySec[i], cB = bySec[i + 1];
      pool.forEach((p) => { p.keep = false; });
      [cA, cB, bySec[i - 1]].filter(Boolean).forEach((c) => { layer(c).keep = true; });
      // the drone layer as a whole hands over to the 3D lake where the next section has no clip
      const wa = cA ? (cB ? 1 : 1 - b) : (cB ? b : 0);
      wrap.style.opacity = wa.toFixed(4); credit.classList.toggle('on', wa > 0.5);
      window.__bgCover = wa > 0.999;
      pool.forEach((p) => {
        const isA = !!cA && p.c === cA, isB = !!cB && p.c === cB;
        let op = 0, k = 0;
        if (isA) { op = 1; k = f; } else if (isB) { op = cA ? b : 1; k = f - 1; }
        p.v.style.opacity = op.toFixed(4);
        // push in through each section and drift up a little; the incoming scene settles from slightly larger
        const kk = Math.max(-0.5, Math.min(1, k)), sc = 1.04 + 0.075 * Math.max(0, kk) + (isB && cA ? 0.06 * (1 - b) : 0), ty = (0.5 - kk) * 2.2;
        p.v.style.transform = 'translate3d(0,' + ty.toFixed(3) + 'vh,0) scale(' + sc.toFixed(4) + ')';
        if (op > 0.001 || p.keep) play(p.v); else if (!p.v.paused) p.v.pause();
      });
    };
    requestAnimationFrame(frame);
    document.addEventListener('visibilitychange', () => { if (document.hidden) pool.forEach((p) => p.v.pause()); else shownX = -1; });
    window.__drone = { pos, pool };
  }
})();
