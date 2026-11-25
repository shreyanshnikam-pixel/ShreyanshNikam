/* Scroll-scrubbed pre-rendered film player. window.FilmPlayer
 *
 * Draws one frame of an image-sequence film to a <canvas>, chosen from a 0..1 progress value
 * (usually a ScrollTrigger's progress). Supports high-FPS (24–240 fps) and ultra-high-count
 * sequences (1,200–2,000+ frames) as well as 4K/8K variants with bounded decoded-bitmap memory
 * so browsers never OOM when scrubbing.
 *
 * Manifest (assets/films/<name>/manifest.json, written by blender/encode.sh):
 *   { "fps": 24,
 *     "baseUrl": "https://pub-xxxx.r2.dev/films/sky/",  // optional CDN base (also supported per-variant or in index.json)
 *     "desktop":  { "w": 1920, "h": 1080, "count": 240, "ext": "webp", "chunk": 48, "path": "desktop/" },
 *     "4k":       { "w": 3840, "h": 2160, "count": 1200, "ext": "avif", "chunk": 48, "path": "4k/" },
 *     "8k":       { "w": 7680, "h": 4320, "count": 1200, "ext": "avif", "chunk": 48, "path": "8k/" },
 *     "portrait": { "w": 1080, "h": 1920, "count": 240, "ext": "webp", "chunk": 48, "path": "portrait/" } }
 * Frames are <path>f_0000.<ext>, f_0001.<ext>, ... (or zero-padded to `digits` / count width when > 9999)
 * relative to `v.baseUrl || manifest.baseUrl || registry.baseUrl/<name>/ || manifest directory`.
 * "portrait", "4k", and "8k" are optional.
 * The older flat form from plan.md ({fps, count, w, h, portrait:{...}}) is accepted too.
 *
 * Optional registry: assets/films/index.json = {"films":["pool","sky"], "baseUrl":"https://pub-xxxx.r2.dev/films/"}.
 * If it exists and does not list the film, load() returns null without requesting the manifest, so pages without
 * renders log no 404s. If `baseUrl` is present in index.json, manifests without their own `baseUrl` resolve frames
 * against `<baseUrl>/<name>/`.
 *
 * Usage:
 *   const film = await FilmPlayer.load(canvas, 'assets/films/pool/manifest.json');   // null if there is no film yet
 *   if (film) ScrollTrigger.create({ trigger: el, start: 'top top', end: 'bottom bottom', onUpdate: (st) => film.draw(st.progress) });
 *   else startRealtimeScene();
 *   film.dispose();
 *
 * Options (all optional): { maxDpr: 2, fit: 'cover'|'contain', concurrency: 6, keep: 2, maxFrames: auto,
 *   registry: url | false, variant: 'desktop'|'portrait'|'4k'|'8k' (forces one), onDraw(ctx, frame, progress, w, h),
 *   onVariant(name) }
 */
(function () {
  'use strict';
  const hasBitmap = typeof window.createImageBitmap === 'function';
  const padN = (i, n) => String(i).padStart(n || 4, '0');
  const ensureSlash = (u, fallbackBase) => {
    if (!u) return fallbackBase || '';
    const href = new URL(u, fallbackBase || location.href).href;
    return href.endsWith('/') ? href : href + '/';
  };

  // Normalise one variant of the manifest ({w,h,count,ext,chunk,path,digits,baseUrl}).
  function variantOf(m, name) {
    let v = m[name];
    if (!v && name === 'desktop') v = { w: m.w, h: m.h, count: m.count, ext: m.ext, chunk: m.chunk, path: m.path, baseUrl: m.baseUrl };
    if (!v || !v.count) return null;
    const count = v.count | 0, start = v.start | 0;
    const autoDigits = Math.max(4, String(Math.max(0, start + count - 1)).length);
    const rawPath = v.path != null ? String(v.path) : name + '/';
    const path = rawPath && !rawPath.endsWith('/') ? rawPath + '/' : rawPath;
    return {
      name, w: v.w || 1920, h: v.h || 1080, count, ext: v.ext || m.ext || 'webp',
      chunk: Math.max(1, (v.chunk || m.chunk || 48) | 0),
      path, start,
      baseUrl: typeof v.baseUrl === 'string' && v.baseUrl.trim() ? v.baseUrl.trim() : null,
      digits: Math.max(4, (v.digits || m.digits || autoDigits) | 0)
    };
  }

  // Adaptive decoded-frame memory cap (~256 MB uncompressed RGBA ceiling across 1080p / 4K / 8K).
  function frameBudget(v, opts) {
    if (opts.maxFrames && opts.maxFrames > 0) return opts.maxFrames | 0;
    const px = Math.max(1, (v.w || 1920) * (v.h || 1080));
    const bytesPerFrame = px * 4;
    const targetBytes = 256 * 1024 * 1024;
    return Math.max(8, Math.min(180, Math.floor(targetBytes / bytesPerFrame)));
  }

  function Player(canvas, manifest, baseUrl, opts) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d', { alpha: false });
    this.m = manifest; this.base = ensureSlash(baseUrl || location.href, location.href); this.o = opts || {};
    this.fps = Math.max(1, Number(manifest.fps) || 24);
    this.frames = new Map();     // frame index -> ImageBitmap | HTMLImageElement
    this.inflight = new Map();   // frame index -> AbortController (or Image)
    this.failed = new Set();
    this.queue = [];
    this.progress = 0; this.target = 0; this.drawn = -1; this.dir = 1; this.lastDir = 1; this.lastChunk = -1;
    this.disposed = false;
    this.pickVariant();
    this._resize = () => {
      const before = this.v && this.v.name;
      this.pickVariant();
      if (this.v.name !== before) { this.flush(); this.o.onVariant && this.o.onVariant(this.v.name); }
      this.drawn = -1; this.draw(this.progress);
    };
    window.addEventListener('resize', this._resize);
    if (window.ResizeObserver) { this._ro = new ResizeObserver(() => { this.drawn = -1; this.paint(); }); this._ro.observe(canvas); }
  }

  Player.prototype = {
    // Select portrait on tall viewports, or highest matching resolution (8k / 4k / desktop) for physical screen width.
    pickVariant() {
      const dpr = Math.min(this.o.maxDpr || 2, window.devicePixelRatio || 1);
      const physW = Math.round((window.innerWidth || 1920) * dpr);
      let v = this.o.variant ? variantOf(this.m, this.o.variant) : null;
      if (!v) {
        if (window.innerWidth < window.innerHeight) {
          v = (physW >= 1800 && variantOf(this.m, 'portrait_4k')) || variantOf(this.m, 'portrait') || variantOf(this.m, 'desktop');
        } else {
          if (physW >= 3840) v = variantOf(this.m, '8k') || variantOf(this.m, '4k') || variantOf(this.m, 'desktop');
          else if (physW >= 2200) v = variantOf(this.m, '4k') || variantOf(this.m, 'desktop') || variantOf(this.m, '8k');
          else v = variantOf(this.m, 'desktop') || variantOf(this.m, '4k') || variantOf(this.m, '8k');
        }
      }
      this.v = v || variantOf(this.m, 'desktop') || variantOf(this.m, '4k') || variantOf(this.m, '8k') || variantOf(this.m, 'portrait');
      this.count = this.v.count;
      const manifestBase = typeof this.m.baseUrl === 'string' && this.m.baseUrl.trim() ? this.m.baseUrl.trim() : null;
      this.frameBase = ensureSlash(this.v.baseUrl || manifestBase || this.base, this.base);
      this.maxFrames = frameBudget(this.v, this.o);
      this.windowRadius = Math.max(4, Math.min(this.v.chunk * 2, Math.floor(this.maxFrames * 0.6)));
    },
    url(i) { return new URL(this.v.path + 'f_' + padN(i + this.v.start, this.v.digits) + '.' + this.v.ext, this.frameBase).href; },
    chunkOf(i) { return Math.floor(i / this.v.chunk); },
    get chunks() { return Math.ceil(this.count / this.v.chunk); },

    // Draw the frame nearest to progress (0..1). Cheap to call every scroll tick (including 240Hz displays).
    draw(progress) {
      if (this.disposed) return;
      const p = Math.min(1, Math.max(0, +progress || 0));
      const f = Math.round(p * (this.count - 1));
      const prevTarget = this.target;
      if (f !== prevTarget) this.dir = f > prevTarget ? 1 : -1;
      this.progress = p; this.target = f;
      const c = this.chunkOf(f);
      const jumped = Math.abs(f - prevTarget) >= Math.max(2, Math.floor(this.windowRadius * 0.25));
      if (c !== this.lastChunk || this.dir !== this.lastDir || jumped || !this.queue.length) {
        this.lastChunk = c; this.lastDir = this.dir; this.schedule();
      }
      this.paint();
    },

    // Frame to show now: the target if loaded, otherwise the closest loaded frame (no blank flashes while loading).
    pick() {
      const f = this.target;
      if (this.frames.has(f)) return f;
      const maxSearch = Math.min(this.count, Math.max(this.v.chunk * 2, this.windowRadius * 2));
      for (let d = 1; d <= maxSearch; d++) {
        if (this.frames.has(f - d)) return f - d;
        if (this.frames.has(f + d)) return f + d;
      }
      return -1;
    },

    paint() {
      if (this.disposed) return;
      const cv = this.canvas;
      if (!cv.clientWidth || !cv.clientHeight) return;
      const dpr = Math.min(this.o.maxDpr || 2, window.devicePixelRatio || 1);
      const W = Math.max(1, Math.round(cv.clientWidth * dpr)), H = Math.max(1, Math.round(cv.clientHeight * dpr));
      let resized = false;
      if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; resized = true; }
      const f = this.pick();
      if (f < 0) { if (resized || this.drawn === -1) { this.ctx.fillStyle = this.o.background || '#0b1016'; this.ctx.fillRect(0, 0, W, H); } return; }
      if (f === this.drawn && !resized && !this.o.onDraw) return;
      const img = this.frames.get(f), iw = img.width || this.v.w, ih = img.height || this.v.h;
      const s = (this.o.fit === 'contain' ? Math.min : Math.max)(W / iw, H / ih);
      const dw = iw * s, dh = ih * s;
      this.ctx.imageSmoothingEnabled = true;
      this.ctx.imageSmoothingQuality = 'high';
      if (this.o.fit === 'contain') { this.ctx.fillStyle = this.o.background || '#0b1016'; this.ctx.fillRect(0, 0, W, H); }
      this.ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
      this.drawn = f;
      if (this.o.onDraw) this.o.onDraw(this.ctx, f, this.progress, W, H);
    },

    // Evict decoded bitmaps farthest from target whenever cache exceeds maxFrames or chunk distance.
    evict() {
      const c = this.chunkOf(this.target), keep = this.o.keep != null ? this.o.keep : 2;
      const maxDist = Math.max(this.windowRadius * 2, this.v.chunk * (keep + 1));
      for (const [i, bmp] of this.frames) {
        if (Math.abs(this.chunkOf(i) - c) > keep || Math.abs(i - this.target) > maxDist) {
          if (bmp && bmp.close) bmp.close();
          this.frames.delete(i);
        }
      }
      if (this.frames.size > this.maxFrames) {
        const keys = Array.from(this.frames.keys()).sort((a, b) => Math.abs(b - this.target) - Math.abs(a - this.target));
        while (this.frames.size > this.maxFrames && keys.length) {
          const k = keys.shift();
          if (k === this.target || k === this.drawn) continue;
          const bmp = this.frames.get(k);
          if (bmp && bmp.close) bmp.close();
          this.frames.delete(k);
        }
      }
      for (const [i, ctl] of this.inflight) {
        if (Math.abs(this.chunkOf(i) - c) > keep || Math.abs(i - this.target) > maxDist) {
          this.abort(ctl); this.inflight.delete(i);
        }
      }
    },

    // Rebuild the load queue around target: nearest frames first within the memory-safe window,
    // biased toward scroll direction so high-FPS scrubbing (up to 240fps / 2000+ frames) stays crisp.
    schedule() {
      this.evict();
      const t = this.target, r = this.windowRadius;
      const lo = Math.max(0, t - (this.dir < 0 ? r : Math.max(2, Math.floor(r * 0.45))));
      const hi = Math.min(this.count - 1, t + (this.dir > 0 ? r : Math.max(2, Math.floor(r * 0.45))));
      const ids = [];
      for (let i = lo; i <= hi; i++) {
        if (!this.frames.has(i) && !this.inflight.has(i) && !this.failed.has(i)) ids.push(i);
      }
      ids.sort((x, y) => {
        const dx = Math.abs(x - t) - ((x - t) * this.dir > 0 ? 0.35 : 0);
        const dy = Math.abs(y - t) - ((y - t) * this.dir > 0 ? 0.35 : 0);
        return dx - dy;
      });
      this.queue = ids.slice(0, this.maxFrames);
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
        if (img) { this.frames.set(i, img); if (this.frames.size > this.maxFrames) this.evict(); }
        else this.failed.add(i);
        // repaint if this frame is a better match for the target than what is on screen
        if (img && (this.drawn < 0 || Math.abs(i - this.target) < Math.abs(this.drawn - this.target))) this.paint();
        this.pump();
      };
      if (hasBitmap && window.fetch && window.AbortController) {
        const ctl = new AbortController(); this.inflight.set(i, ctl);
        fetch(this.url(i), { signal: ctl.signal, mode: 'cors' })
          .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.blob(); })
          .then((b) => createImageBitmap(b))
          .then(done, (e) => { if (e && e.name === 'AbortError') return; done(null); });
      } else {
        const im = new Image(); im.crossOrigin = 'anonymous'; im.decoding = 'async'; this.inflight.set(i, im);
        im.onload = () => (im.decode ? im.decode().catch(() => {}) : Promise.resolve()).then(() => done(im));
        im.onerror = () => { if (this.inflight.get(i) === im) done(null); };
        im.src = this.url(i);
      }
    },

    // Resolves when the initial window around `progress` is loaded (use it to hold a preloader).
    preload(progress) {
      this.draw(progress == null ? this.progress : progress);
      const a = Math.max(0, this.target - Math.min(4, this.windowRadius));
      const b = Math.min(this.count, this.target + Math.min(this.v.chunk, this.windowRadius));
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
      for (const b of this.frames.values()) if (b && b.close) b.close();
      this.inflight.clear(); this.frames.clear(); this.failed.clear(); this.queue = []; this.drawn = -1;
    },

    // Debug/test info.
    state() {
      const chunks = new Set(); for (const i of this.frames.keys()) chunks.add(this.chunkOf(i));
      return { variant: this.v.name, baseUrl: this.frameBase, fps: this.fps, count: this.count, maxFrames: this.maxFrames, target: this.target,
        drawn: this.drawn, loaded: this.frames.size, inflight: this.inflight.size,
        chunks: Array.from(chunks).sort((a, b) => a - b), failed: this.failed.size };
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
    let regFilmBase = null;
    // Registry check: avoid requesting a manifest that does not exist yet (keeps the console free of 404s).
    if (opts.registry !== false) {
      const regUrl = opts.registry ? new URL(opts.registry, location.href) : new URL('../index.json', base);
      const name = base.replace(/\/$/, '').split('/').pop();
      try {
        const r = await fetch(regUrl, { cache: 'no-cache', mode: 'cors' });
        if (r.ok) {
          const reg = await r.json();
          if (Array.isArray(reg.films) && reg.films.indexOf(name) < 0) return null;
          if (typeof reg.baseUrl === 'string' && reg.baseUrl.trim()) {
            regFilmBase = ensureSlash(reg.baseUrl.trim(), regUrl.href) + encodeURIComponent(name) + '/';
          }
        }
      } catch (e) { /* no registry: fall through to the manifest */ }
    }
    let m = null, resolvedBase = base;
    const tryManifest = async (url) => {
      try {
        const r = await fetch(url, { cache: 'no-cache', mode: 'cors' });
        if (!r.ok) return null;
        return await r.json();
      } catch (e) { return null; }
    };
    m = await tryManifest(abs);
    if (!m && regFilmBase) {
      m = await tryManifest(regFilmBase + 'manifest.json');
      if (m) resolvedBase = regFilmBase;
    }
    if (!m) return null;
    if (!variantOf(m, 'desktop') && !variantOf(m, '4k') && !variantOf(m, '8k') && !variantOf(m, 'portrait')) return null;
    const effectiveBase = (typeof m.baseUrl === 'string' && m.baseUrl.trim()) ? ensureSlash(m.baseUrl.trim(), resolvedBase) : (regFilmBase || resolvedBase);
    return new Player(canvas, m, effectiveBase, opts);
  }

  // FilmPlayer(canvas, url, opts) and FilmPlayer.load(canvas, url, opts) both return Promise<Player|null>.
  function FilmPlayer(canvas, manifestUrl, opts) { return load(canvas, manifestUrl, opts); }
  FilmPlayer.load = load;
  FilmPlayer.Player = Player;
  window.FilmPlayer = FilmPlayer;
})();
