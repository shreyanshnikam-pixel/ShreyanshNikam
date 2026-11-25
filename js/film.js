/* Scroll-scrubbed pre-rendered film player. window.FilmPlayer
 *
 * Draws one frame of an image-sequence film to a <canvas>, chosen from a 0..1 progress value
 * (usually a ScrollTrigger's progress). Frames are loaded in chunks: the chunk under the visitor first,
 * then the next chunk in the direction they are scrolling, and chunks far away are evicted so memory stays flat.
 *
 * Manifest (assets/films/<name>/manifest.json, written by blender/encode.sh):
 *   { "fps": 24,
 *     "desktop":  { "w": 1920, "h": 1080, "count": 240, "ext": "webp", "chunk": 48, "path": "desktop/" },
 *     "portrait": { "w": 1080, "h": 1920, "count": 240, "ext": "webp", "chunk": 48, "path": "portrait/" } }
 * Frames are <path>f_0000.<ext>, f_0001.<ext>, ... relative to the manifest. "portrait" is optional.
 * The older flat form from plan.md ({fps, count, w, h, portrait:{...}}) is accepted too.
 *
 * Optional registry: assets/films/index.json = {"films":["pool","sky"]}. If it exists and does not list the film,
 * load() returns null without requesting the manifest, so pages without renders log no 404s.
 *
 * Usage:
 *   const film = await FilmPlayer.load(canvas, 'assets/films/pool/manifest.json');   // null if there is no film yet
 *   if (film) ScrollTrigger.create({ trigger: el, start: 'top top', end: 'bottom bottom', onUpdate: (st) => film.draw(st.progress) });
 *   else startRealtimeScene();
 *   film.dispose();
 *
 * Options (all optional): { maxDpr: 2, fit: 'cover'|'contain', concurrency: 6, keep: 2,
 *   registry: url | false, variant: 'desktop'|'portrait' (forces one), onDraw(ctx, frame, progress, w, h),
 *   onVariant(name) }
 */
(function () {
  'use strict';
  const hasBitmap = typeof window.createImageBitmap === 'function';
  const pad4 = (i) => String(i).padStart(4, '0');

  // Normalise one variant of the manifest ({w,h,count,ext,chunk,path}).
  function variantOf(m, name) {
    let v = m[name];
    if (!v && name === 'desktop') v = { w: m.w, h: m.h, count: m.count, ext: m.ext, chunk: m.chunk, path: m.path };
    if (!v || !v.count) return null;
    return {
      name, w: v.w || 1920, h: v.h || 1080, count: v.count | 0, ext: v.ext || m.ext || 'webp',
      chunk: Math.max(1, (v.chunk || m.chunk || 48) | 0), path: v.path != null ? v.path : name + '/', start: v.start | 0
    };
  }

  function Player(canvas, manifest, baseUrl, opts) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d', { alpha: false });
    this.m = manifest; this.base = baseUrl; this.o = opts;
    this.fps = manifest.fps || 24;
    this.frames = new Map();     // frame index -> ImageBitmap | HTMLImageElement
    this.inflight = new Map();   // frame index -> AbortController (or Image)
    this.failed = new Set();
    this.queue = [];
    this.progress = 0; this.target = 0; this.drawn = -1; this.dir = 1; this.lastDir = 1; this.lastChunk = 0;
    this.disposed = false;
    this.pickVariant();
    this._resize = () => { const before = this.v && this.v.name; this.pickVariant(); if (this.v.name !== before) { this.flush(); this.o.onVariant && this.o.onVariant(this.v.name); } this.drawn = -1; this.draw(this.progress); };
    window.addEventListener('resize', this._resize);
    if (window.ResizeObserver) { this._ro = new ResizeObserver(() => { this.drawn = -1; this.paint(); }); this._ro.observe(canvas); }
  }

  Player.prototype = {
    // Portrait renders when the viewport is taller than wide (and the manifest has them).
    pickVariant() {
      const want = this.o.variant || (innerWidth < innerHeight ? 'portrait' : 'desktop');
      this.v = variantOf(this.m, want) || variantOf(this.m, 'desktop') || variantOf(this.m, 'portrait');
      this.count = this.v.count;
    },
    url(i) { return this.base + this.v.path + 'f_' + pad4(i + this.v.start) + '.' + this.v.ext; },
    chunkOf(i) { return Math.floor(i / this.v.chunk); },
    get chunks() { return Math.ceil(this.count / this.v.chunk); },

    // Draw the frame nearest to progress (0..1). Cheap to call every scroll tick.
    draw(progress) {
      if (this.disposed) return;
      const p = Math.min(1, Math.max(0, +progress || 0));
      const f = Math.round(p * (this.count - 1));
      if (f !== this.target) this.dir = f > this.target ? 1 : -1;
      this.progress = p; this.target = f;
      const c = this.chunkOf(f);
      if (c !== this.lastChunk || this.dir !== this.lastDir || !this.queue.length) { this.lastChunk = c; this.lastDir = this.dir; this.schedule(); }
      this.paint();
    },

    // Frame to show now: the target if loaded, otherwise the closest loaded frame (no blank flashes while loading).
    pick() {
      const f = this.target;
      if (this.frames.has(f)) return f;
      for (let d = 1; d < this.count; d++) {
        if (this.frames.has(f - d)) return f - d;
        if (this.frames.has(f + d)) return f + d;
        if (d > this.v.chunk * 2) break;
      }
      return -1;
    },

    paint() {
      if (this.disposed) return;
      const cv = this.canvas, dpr = Math.min(this.o.maxDpr || 2, window.devicePixelRatio || 1);
      const W = Math.max(1, Math.round(cv.clientWidth * dpr)), H = Math.max(1, Math.round(cv.clientHeight * dpr));
      let resized = false;
      if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; resized = true; }
      const f = this.pick();
      if (f < 0) { if (resized || this.drawn === -1) { this.ctx.fillStyle = this.o.background || '#0b1016'; this.ctx.fillRect(0, 0, W, H); } return; }
      if (f === this.drawn && !resized && !this.o.onDraw) return;
      const img = this.frames.get(f), iw = img.width || this.v.w, ih = img.height || this.v.h;
      const s = (this.o.fit === 'contain' ? Math.min : Math.max)(W / iw, H / ih);
      const dw = iw * s, dh = ih * s;
      if (this.o.fit === 'contain') { this.ctx.fillStyle = this.o.background || '#0b1016'; this.ctx.fillRect(0, 0, W, H); }
      this.ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
      this.drawn = f;
      if (this.o.onDraw) this.o.onDraw(this.ctx, f, this.progress, W, H);
    },

    // Rebuild the load queue: current chunk (nearest frames first), next chunk ahead, the one behind when
    // scrubbing backwards (or the one after next when going forwards). Evict everything farther away.
    schedule() {
      const c = this.chunkOf(this.target), n = this.chunks, keep = this.o.keep != null ? this.o.keep : 2;
      const order = [c, c + this.dir, c - this.dir, c + 2 * this.dir].filter((k, i, a) => k >= 0 && k < n && a.indexOf(k) === i);
      const wanted = new Set(order.slice(0, this.dir < 0 ? 3 : 2));
      // evict far chunks
      for (const [i, bmp] of this.frames) { if (Math.abs(this.chunkOf(i) - c) > keep) { if (bmp.close) bmp.close(); this.frames.delete(i); } }
      for (const [i, ctl] of this.inflight) { if (Math.abs(this.chunkOf(i) - c) > keep) { this.abort(ctl); this.inflight.delete(i); } }
      const q = [];
      order.forEach((k) => {
        if (!wanted.has(k)) return;
        const a = k * this.v.chunk, b = Math.min(this.count, a + this.v.chunk);
        const ids = []; for (let i = a; i < b; i++) if (!this.frames.has(i) && !this.inflight.has(i) && !this.failed.has(i)) ids.push(i);
        if (k === c) ids.sort((x, y) => Math.abs(x - this.target) - Math.abs(y - this.target));
        else if (this.dir < 0) ids.reverse();
        q.push(...ids);
      });
      this.queue = q;
      this.pump();
    },

    pump() {
      const max = this.o.concurrency || 6;
      while (!this.disposed && this.inflight.size < max && this.queue.length) this.fetchFrame(this.queue.shift());
    },

    abort(ctl) { try { if (ctl.abort) ctl.abort(); else if (ctl.src !== undefined) ctl.src = ''; } catch (e) { /* ignore */ } },

    fetchFrame(i) {
      const done = (img) => {
        if (!this.inflight.has(i)) { if (img && img.close) img.close(); return; } // evicted while loading
        this.inflight.delete(i);
        if (this.disposed) { if (img && img.close) img.close(); return; }
        if (img) this.frames.set(i, img); else this.failed.add(i);
        // repaint if this frame is a better match for the target than what is on screen
        if (img && (this.drawn < 0 || Math.abs(i - this.target) < Math.abs(this.drawn - this.target))) this.paint();
        this.pump();
      };
      if (hasBitmap && window.fetch && window.AbortController) {
        const ctl = new AbortController(); this.inflight.set(i, ctl);
        fetch(this.url(i), { signal: ctl.signal })
          .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.blob(); })
          .then((b) => createImageBitmap(b))
          .then(done, (e) => { if (e && e.name === 'AbortError') return; done(null); });
      } else {
        const im = new Image(); im.decoding = 'async'; this.inflight.set(i, im);
        im.onload = () => (im.decode ? im.decode().catch(() => {}) : Promise.resolve()).then(() => done(im));
        im.onerror = () => { if (this.inflight.get(i) === im) done(null); };
        im.src = this.url(i);
      }
    },

    // Resolves when the chunk around `progress` is loaded (use it to hold a preloader).
    preload(progress) {
      this.draw(progress == null ? this.progress : progress);
      const c = this.chunkOf(this.target), a = c * this.v.chunk, b = Math.min(this.count, a + this.v.chunk);
      return new Promise((res) => {
        const check = () => {
          if (this.disposed) return res();
          let ok = true; for (let i = a; i < b; i++) if (!this.frames.has(i) && !this.failed.has(i)) { ok = false; break; }
          ok ? res() : setTimeout(check, 50);
        };
        check();
      });
    },

    flush() {
      for (const ctl of this.inflight.values()) this.abort(ctl);
      for (const b of this.frames.values()) if (b.close) b.close();
      this.inflight.clear(); this.frames.clear(); this.failed.clear(); this.queue = []; this.drawn = -1;
    },

    // Debug/test info.
    state() {
      const chunks = new Set(); for (const i of this.frames.keys()) chunks.add(this.chunkOf(i));
      return { variant: this.v.name, count: this.count, target: this.target, drawn: this.drawn, loaded: this.frames.size,
        inflight: this.inflight.size, chunks: Array.from(chunks).sort((a, b) => a - b), failed: this.failed.size };
    },

    dispose() {
      this.disposed = true; this.flush();
      window.removeEventListener('resize', this._resize);
      if (this._ro) this._ro.disconnect();
    }
  };

  async function load(canvas, manifestUrl, opts) {
    opts = opts || {};
    const abs = new URL(manifestUrl, location.href), base = abs.href.replace(/[^/]*$/, '');
    // Registry check: avoid requesting a manifest that does not exist yet (keeps the console free of 404s).
    if (opts.registry !== false) {
      const regUrl = opts.registry ? new URL(opts.registry, location.href) : new URL('../index.json', base);
      const name = base.replace(/\/$/, '').split('/').pop();
      try {
        const r = await fetch(regUrl, { cache: 'no-cache' });
        if (r.ok) { const reg = await r.json(); if (Array.isArray(reg.films) && reg.films.indexOf(name) < 0) return null; }
      } catch (e) { /* no registry: fall through to the manifest */ }
    }
    let m;
    try {
      const r = await fetch(abs, { cache: 'no-cache' });
      if (!r.ok) return null;
      m = await r.json();
    } catch (e) { return null; }
    if (!variantOf(m, 'desktop') && !variantOf(m, 'portrait')) return null;
    return new Player(canvas, m, base, opts);
  }

  // FilmPlayer(canvas, url, opts) and FilmPlayer.load(canvas, url, opts) both return Promise<Player|null>.
  function FilmPlayer(canvas, manifestUrl, opts) { return load(canvas, manifestUrl, opts); }
  FilmPlayer.load = load;
  FilmPlayer.Player = Player;
  window.FilmPlayer = FilmPlayer;
})();
