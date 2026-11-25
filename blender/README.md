# Blender Cycles Film Kit (`blender/`)

This kit builds, path-traces, and encodes the pre-rendered scroll-scrubbed films consumed by `js/film.js`:

| Film | Builder script | Duration | Standard (24 fps) | `100fps` (100 frames/sec) | High-speed (240 fps) | Page slot |
|---|---|---|---|---|---|---|
| `pool` | `blender/build_pool.py` | 10 s | 240 frames | **1,000 frames** | 1,200–2,000 frames | `index.html` section 05 |
| `sky` | `blender/build_sky.py` | 20 s | 480 frames | **2,000 frames** | 1,200–2,000 frames | `sky-sentry.html` |
| `echo_descent` | `blender/build_echo_descent.py` | 6 s | 144 frames | **600 frames** | 1,200–1,440 frames | `echo.html` opening descent |

Every film uses **Cycles GPU** (OptiX / CUDA / HIP / Metal / oneAPI), **AgX (Medium High Contrast)**, **OpenImageDenoise (GPU)**, **full multi-bounce GI + MNEE/light-path caustics**, **physical 180° centered motion blur**, and separate **16:9 desktop** and **9:16 portrait** cameras.

---

## 1. Prerequisites

- **Blender 4.1+** (recommended for GPU-accelerated OpenImageDenoise, AgX, and light linking): https://www.blender.org/download/
- **Python 3.9+** with **Pillow** (`pip install pillow`) — used by `blender/make_textures.py` and as a fallback encoder in `blender/encode.py`.
- **ffmpeg** (recommended for fast WebP, AVIF, and all-intra AV1 encoding):
  - **Windows**: `winget install Gyan.FFmpeg`
  - **macOS**: `brew install ffmpeg`
  - **Linux (Debian/Ubuntu)**: `sudo apt install ffmpeg`

---

## 2. Quick Start

### Windows (GPU laptop/desktop)

`blender\render_films.bat` auto-detects Blender on `PATH`, in `D:\Blender\*\blender.exe` (e.g. `D:\Blender\blender-4.5.9-windows-x64\blender.exe`), or in `C:\Program Files\Blender Foundation\Blender*\blender.exe`. When a `D:` drive exists, raw PNG renders default to `D:\ShreyanshNikam-renders` (keeping `C:` free); override anytime with `--out <dir>`.

Double-click `blender\render_films.bat` for the standard 1080p @ 24 fps pass, or run from PowerShell/CMD at the repo root:

```bat
REM Fast sanity preview (50% res, 64 samples, every 4th frame) + encode
blender\render_films.bat --preview

REM Standard production render (1920x1080 + 1080x1920, 24 fps, WebP)
blender\render_films.bat --preset standard

REM 100 frames/second preset (pool: 1,000 frames, sky: 2,000 frames, echo_descent: 600 frames)
blender\render_films.bat --preset 100fps

REM 4K UHD render (3840x2160 + 2160x3840) encoded as AVIF
blender\render_films.bat --preset 4k --format avif

REM Ultra high-speed 8K @ 240 fps (1200-2000 frames) + all-intra AV1
blender\render_films.bat --preset 8k240 --frames 1-1440 --fps 240 --av1

REM Single film only, with optional Cloudflare R2 CDN baseUrl recorded in manifest.json
blender\render_films.bat --film echo_descent --preset 100fps --cdn-base https://pub-your-bucket.r2.dev/films
```

### macOS & Linux

Run from the repository root:

```bash
# 1. Generate runway & cockpit textures for build_sky.py
python3 blender/make_textures.py

# 2. Render each film (desktop + portrait)
blender -b -P blender/build_pool.py -- --out renders/pool --res desktop --frames 1-240
blender -b -P blender/build_pool.py -- --out renders/pool --res portrait --frames 1-240

blender -b -P blender/build_echo_descent.py -- --out renders/echo_descent --res desktop --frames 1-144
blender -b -P blender/build_echo_descent.py -- --out renders/echo_descent --res portrait --frames 1-144

blender -b -P blender/build_sky.py -- --out renders/sky --res desktop
blender -b -P blender/build_sky.py -- --out renders/sky --res portrait

# 3. Encode PNG sequences -> assets/films/<name>/{desktop,portrait}/f_0000.webp + manifest.json + index.json
bash blender/encode.sh
```

To inspect a scene interactively in Blender before rendering, add `--no-render --save renders/<name>/<name>.blend`:

```bash
blender -b -P blender/build_echo_descent.py -- --no-render --save renders/echo_descent/echo_descent.blend
```

---

## 3. Presets & High-Speed / 4K / 8K Options

Both `common.py` (all `build_*.py` scripts) and `encode.py` accept `--preset`, `--res`, `--fps`, and `--frames`:

| Preset | Resolution (`--res`) | Default FPS | Samples | Notes |
|---|---|---|---|---|
| `preview` | 50% of 1080p (every 4th frame) | 24 | 64 | Quick lighting, framing, and pipeline verification |
| `standard` | `desktop` (1920×1080) & `portrait` (1080×1920) | 24 | 768–1024 | Recommended for fast Netlify web delivery |
| `100fps` | `desktop` / `portrait` (or pass `--res 4k` / `8k`) | **100** | 768–1024 | 100 individual frames per second (`pool` 1,000, `sky` 2,000, `echo_descent` 600); combine with Cloudflare R2 for web hosting |
| `4k` | `4k` (3840×2160) & `4k-portrait` (2160×3840) | 24 (or pass `--fps 100`) | 1024 | Cinema-grade 4K UHD; heavier downloads |
| `8k240` | `8k` (7680×4320) & `8k-portrait` (4320×7680) | 240 | 1024 | Time-normalized 1,200–2,000 frames; archival/mastering |

All keyframes, wave/caustic speeds, swimmer kick cycles, particle lifetimes, and handheld camera noise in `build_pool.py` and `build_echo_descent.py` scale automatically with `--frames` and `--fps`.

---

## 4. Encoding (`encode.py` / `encode.sh`)

`blender/encode.py` converts Blender's 1-indexed `renders/<name>/<res>/f_####.png` frames into 0-indexed `assets/films/<name>/{desktop,portrait}/f_0000.<ext>` sequences matching `js/film.js`, writes `assets/films/<name>/manifest.json`, and updates `assets/films/index.json` (`{"films": [...]}`) so `FilmPlayer` automatically activates without 404 errors.

```bash
# Default WebP (q=82, chunks of 48)
python3 blender/encode.py

# AVIF stills (smaller files, slower encode; requires ffmpeg with libaom-av1 or pillow-avif)
python3 blender/encode.py --format avif --quality 78

# Also generate all-intra AV1 MP4 (-c:v libaom-av1 -crf 30 -g 1) for instant keyframe scrubbing
python3 blender/encode.py --av1

# Package an 8K 240 fps render while downscaling web delivery frames to 1920px wide
python3 blender/encode.py --preset 8k240 --max-width 1920 --fps 240 --av1
```

---

## 5. Multi-Machine / Distributed Rendering

`common.py` sets `use_overwrite = False` and `use_placeholder = True`, so renders are automatically resumable and multi-GPU / multi-machine safe:

1. **Shared folder (NAS / synced drive)**: run the exact same `blender -b -P ...` command on multiple GPU machines pointing `--out` to the shared folder; each worker claims unrendered frames via placeholder files.
2. **Explicit frame splits**: divide `--frames` across machines (e.g., Machine A `--frames 1-500`, Machine B `--frames 501-1000`, Machine C `--frames 1001-1500`, Machine D `--frames 1501-2000`), merge the PNG folders into `renders/<name>/<res>/`, then run `python3 blender/encode.py`.

---

## 6. Realistic GPU Render Time & Disk Expectations

Cycles path tracing with caustics, refraction (IOR 1.31 / 1.333), subsurface scattering, and volumetrics scales roughly linearly with `pixels × frames × samples`. Typical estimates per **single film (one orientation)** on a modern desktop GPU (e.g. NVIDIA RTX 4080/4090 with OptiX + GPU OIDN; laptop GPUs are ~2–3× slower):

| Tier | Resolution | Frames | Est. time / frame | Total render time (1 GPU) | Raw PNG disk | Encoded WebP (`assets/films/`) |
|---|---|---|---|---|---|---|
| `preview` | 960×540 | 36–60 | ~1–3 s | **1–3 min** | ~30–60 MB | ~2–5 MB |
| `standard` | 1920×1080 (24 fps) | 144–240 | ~6–18 s | **20–75 min** | ~0.6–1.5 GB | **~15–45 MB** |
| `100fps` | 1920×1080 (100 fps) | 600–2,000 | ~6–18 s | **1.5–10 hours** | ~2.5–12 GB | ~70–320 MB *(host on Cloudflare R2)* |
| `4k` | 3840×2160 (24–100 fps) | 240–1,000 | ~25–75 s | **2–20 hours** | ~3–18 GB | ~90–600 MB *(host on Cloudflare R2)* |
| `8k240` | 7680×4320 (240 fps) | 1,200–2,000 | ~1.5–4.5 min | **30–150 hours** *(1.2–6+ days)* | **~40–120 GB** | **~1.5–4.5 GB** *(Cloudflare R2 / CDN or `--max-width 1920`)* |

**Hosting large sequences (Cloudflare R2):** Netlify static deploys work best when committed assets stay small. For `100fps`, `4k`, or `8k240` sequences, upload `assets/films/<name>/` (frames + `manifest.json`) to a public **Cloudflare R2** bucket (zero egress fees) and point `FilmPlayer.load(canvas, 'https://pub-<bucket>.r2.dev/films/<name>/manifest.json')` — or pass `--cdn-base https://pub-<bucket>.r2.dev/films` to `encode.py` / `render_films.bat` to record the external `baseUrl` in `manifest.json`. Keep raw PNG renders on `D:\ShreyanshNikam-renders` (never committed to Git).
