/* Home: drone moments from "The Rockies | Cinematic Drone 4K Video" by stoked tour (Samson Tan), used with permission.
   Sections 1 to 6 each get their own looping moment, crossfaded behind the text; the 3D Lake Louise opens and
   closes the page and pauses while a clip covers it. Clips come from tools/cut_rockies.py (assets/rockies/).
   Missing clips, reduced motion or data saver: nothing breaks (posters or the 3D lake show instead). */
(function () {
  const S0 = window.SITE, PF = window.PERF || {};
  const BASE = 'assets/rockies/';
  const still = S0.rm || (navigator.connection && navigator.connection.saveData);
  fetch(BASE + 'manifest.json').then((r) => (r.ok ? r.json() : null)).then((m) => { if (m && m.clips && m.clips.length) start(m); }).catch(() => {});

  function start(man) {
    const bySec = {}; man.clips.forEach((c) => { bySec[c.section] = c; });
    const q = PF.low ? 720 : 1080;
    const wrap = document.createElement('div'); wrap.className = 'drone'; wrap.setAttribute('aria-hidden', 'true');
    const mk = () => { const v = document.createElement('video'); v.muted = true; v.defaultMuted = true; v.loop = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.setAttribute('muted', ''); v.preload = 'none'; v.disablePictureInPicture = true; wrap.appendChild(v); return v; };
    const A = mk(), B = mk(), scrim = document.createElement('div'); scrim.className = 'scrim'; wrap.appendChild(scrim);
    const credit = document.createElement('a'); credit.className = 'drone-credit hud'; credit.href = man.source; credit.target = '_blank'; credit.rel = 'noopener';
    credit.textContent = 'Footage: stoked tour, The Rockies'; credit.setAttribute('aria-label', 'Drone footage: The Rockies by stoked tour, on YouTube'); document.body.appendChild(credit);
    const world = document.getElementById('world'); (world ? world.parentNode : document.body).insertBefore(wrap, world ? world.nextSibling : null);

    const secs = Array.from(document.querySelectorAll('main > section'));
    const current = () => { const mid = innerHeight * 0.5; for (let i = 0; i < secs.length; i++) { const r = secs[i].getBoundingClientRect(); if (mid < r.bottom) return i; } return secs.length - 1; };
    let front = A, back = B, shown = null, timer = 0;
    const src = (c) => BASE + c.name + '_' + q + '.mp4', poster = (c) => BASE + c.name + '.webp';
    // a few clips ahead load quietly, so the next section is ready when you reach it
    const warm = (i) => { [i + 1, i - 1].forEach((k) => { const c = bySec[k]; if (c && !c._l) { c._l = true; const l = document.createElement('link'); l.rel = 'preload'; l.as = still ? 'image' : 'video'; l.href = still ? poster(c) : src(c); if (!still) l.type = 'video/mp4'; document.head.appendChild(l); } }); };
    const show = (i) => {
      const c = bySec[i];
      if (!c) { wrap.classList.remove('on'); credit.classList.remove('on'); window.__bgCover = false; shown = null; return; }
      wrap.classList.add('on'); credit.classList.add('on'); warm(i);
      if (shown === c.name) return; shown = c.name;
      const v = back; v.poster = poster(c); v.setAttribute('aria-label', c.alt);
      if (still) { v.removeAttribute('src'); v.load(); } else { v.src = src(c); v.load(); const p = v.play(); if (p && p.catch) p.catch(() => {}); }
      const swap = () => { if (front === v || shown !== c.name) return; v.classList.add('front'); front.classList.remove('front'); const old = front; front = v; back = old; setTimeout(() => { if (back !== front) back.pause(); }, 900); };
      if (still || v.readyState >= 2) swap(); else { v.addEventListener('loadeddata', swap, { once: true }); setTimeout(() => { if (front !== v) swap(); }, 1500); }
    };
    // the 3D lake behind may rest only once the layer has fully faded in
    wrap.addEventListener('transitionend', () => { window.__bgCover = wrap.classList.contains('on'); });
    const tick = () => { cancelAnimationFrame(timer); timer = requestAnimationFrame(() => { const i = current(); if (!bySec[i]) window.__bgCover = false; show(i); }); };
    window.addEventListener('scroll', tick, { passive: true }); window.addEventListener('resize', tick); tick();
    document.addEventListener('visibilitychange', () => { if (document.hidden) [A, B].forEach((v) => v.pause()); else if (!still && wrap.classList.contains('on')) { const p = front.play(); if (p && p.catch) p.catch(() => {}); } });
  }
})();
