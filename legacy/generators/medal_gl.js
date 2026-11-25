  loadJS(src) {
    const G = { 'assets/echo-film.js': 'EchoFilm', 'assets/sky-film.js': 'SkyFilm', 'assets/medals3d.js': 'Medals3D', 'assets/kit.js': 'FK' };
    if (G[src] && window[G[src]]) return Promise.resolve();
    window.__js = window.__js || {};
    if (!window.__js[src]) window.__js[src] = new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.async = true; s.onload = () => res(); s.onerror = () => rej(new Error('Could not load ' + src)); document.head.appendChild(s); });
    return window.__js[src];
  }
  load3D() {
    const ok = (() => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } })();
    if (!ok) return Promise.reject(new Error('WebGL unavailable'));
    return (window.THREE ? Promise.resolve() : this.loadJS('assets/three-bundle.js')).then(() => this.loadJS('assets/kit.js'));
  }
  mountMedals() {
    if (this._medInit) return; this._medInit = true;
    const stages = Array.prototype.slice.call(document.querySelectorAll('canvas.medals3d'));
    const singles = Array.prototype.slice.call(document.querySelectorAll('canvas.medal-gl')).filter((c) => !c.closest('.story'));
    if (!stages.length && !singles.length) return;
    this._m3d = [];
    this.load3D().then(() => this.loadJS('assets/medals3d.js')).then(() => {
      if (this.dead) return;
      stages.forEach((cv) => {
        let items = [], theme = {}; try { items = JSON.parse(cv.getAttribute('data-items')); theme = JSON.parse(cv.getAttribute('data-theme') || '{}'); } catch (e) { return; }
        const sec = cv.closest('section'); const caps = sec ? Array.prototype.slice.call(sec.querySelectorAll('[data-cap]')) : [];
        try { this._m3d.push(new window.Medals3D(cv, items, { stage: true, theme, captions: caps, gap: items.length > 2 ? 2.9 : 3.4 })); if (sec) sec.classList.add('m3d-on'); } catch (e) { console.error(e); }
      });
      singles.forEach((cv) => {
        let m = {}; try { m = JSON.parse(cv.getAttribute('data-m')); } catch (e) {}
        m.noRibbon = true;
        try { this._m3d.push(new window.Medals3D(cv, [m], { stage: false })); if (cv.parentElement) cv.parentElement.classList.add('gl-on'); } catch (e) { console.error(e); }
      });
    }).catch(() => {});
  }
  medalFrame() {}
