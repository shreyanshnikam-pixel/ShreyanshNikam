#!/usr/bin/env python3
"""Encode rendered Blender PNG sequences into web-ready frames, manifests, and optional all-intra AV1.

Reads:
    renders/<name>/<res>/f_####.png   (1-indexed or sparse --preview frames; supports desktop/portrait,
                                       4k/4k-portrait, and 8k/8k-portrait render directories)
Writes:
    assets/films/<name>/<variant>/f_0000.<ext> ...  (0-indexed WebP or AVIF frames for js/film.js,
                                                     supports 144 to 2000+ frames)
    assets/films/<name>/manifest.json               ({fps, desktop:{w,h,count,ext,chunk,path}, portrait:{...}})
    assets/films/index.json                         ({"films":[...]}) so FilmPlayer loads with zero 404s
    assets/films/<name>/<variant>.mp4               (optional all-intra AV1: -c:v libaom-av1 -crf 30 -g 1)

Usage (from the repo root):
    python3 blender/encode.py                             # encode every film found in renders/
    python3 blender/encode.py pool echo_descent           # encode specific films
    python3 blender/encode.py --preset 4k --format avif   # prefer 4k/4k-portrait renders, encode AVIF
    python3 blender/encode.py --preset 8k240 --av1        # prefer 8k/8k-portrait @ 240 fps + all-intra AV1
    python3 blender/encode.py --renders /tmp/r --out /tmp/o --no-index
"""
import argparse
import concurrent.futures
import json
import os
import re
import shutil
import struct
import subprocess
import sys
import tempfile

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(SCRIPT_DIR)
VARIANTS = ('desktop', 'portrait')
PRESETS = ('preview', 'standard', '100fps', '4k', '8k240')
FRAME_RE = re.compile(r'^f_(\d+)\.png$', re.IGNORECASE)

# Resolution folder search order per output variant and preset
VARIANT_DIRS = {
    'preview': {
        'desktop': ('desktop', '4k', '8k'),
        'portrait': ('portrait', '4k-portrait', '8k-portrait'),
    },
    'standard': {
        'desktop': ('desktop', '4k', '8k'),
        'portrait': ('portrait', '4k-portrait', '8k-portrait'),
    },
    '100fps': {
        'desktop': ('desktop', '4k', '8k'),
        'portrait': ('portrait', '4k-portrait', '8k-portrait'),
    },
    '4k': {
        'desktop': ('4k', '8k', 'desktop'),
        'portrait': ('4k-portrait', '8k-portrait', 'portrait'),
    },
    '8k240': {
        'desktop': ('8k', '4k', 'desktop'),
        'portrait': ('8k-portrait', '4k-portrait', 'portrait'),
    },
}


def natural_key(name):
    return [int(tok) if tok.isdigit() else tok.lower() for tok in re.split(r'(\d+)', name)]


def png_dimensions(path):
    """Read (width, height) from a PNG IHDR chunk using stdlib only (no Pillow/ffprobe required)."""
    with open(path, 'rb') as fh:
        hdr = fh.read(24)
    if len(hdr) < 24 or hdr[:8] != b'\x89PNG\r\n\x1a\n' or hdr[12:16] != b'IHDR':
        return None
    return struct.unpack('>II', hdr[16:24])


def list_png_frames(folder):
    """Return sorted non-empty PNG paths in `folder` (skips 0-byte Blender placeholder files)."""
    if not os.path.isdir(folder):
        return []
    entries = []
    for name in os.listdir(folder):
        if not name.lower().endswith('.png'):
            continue
        full = os.path.join(folder, name)
        try:
            if os.path.isfile(full) and os.path.getsize(full) > 0:
                entries.append((name, full))
        except OSError:
            continue
    entries.sort(key=lambda pair: natural_key(pair[0]))
    return [p for _, p in entries]


def filter_frame_range(paths, frames_spec):
    """Optional --frames slice, e.g. '1-1200' (matches PNG frame numbers if f_####.png, else 1-based index)."""
    if not frames_spec or not paths:
        return paths
    a, sep, b = str(frames_spec).partition('-')
    f0 = int(a)
    f1 = int(b) if sep and b else f0
    filtered = []
    for idx, p in enumerate(paths, start=1):
        m = FRAME_RE.match(os.path.basename(p))
        num = int(m.group(1)) if m else idx
        if f0 <= num <= f1:
            filtered.append(p)
    return filtered


def contiguous_f_sequence(paths):
    """If paths are contiguous f_####.png (step 1), return (start_number, width_digits), else None."""
    if not paths:
        return None
    nums = []
    digits = None
    for p in paths:
        m = FRAME_RE.match(os.path.basename(p))
        if not m:
            return None
        tok = m.group(1)
        if digits is None:
            digits = len(tok)
        elif len(tok) != digits:
            return None
        nums.append(int(tok))
    for i in range(1, len(nums)):
        if nums[i] != nums[i - 1] + 1:
            return None
    return nums[0], digits


def find_ffmpeg():
    return shutil.which('ffmpeg')


def has_pillow():
    try:
        import PIL.Image  # noqa: F401
        return True
    except ImportError:
        return False


def pillow_supports_format(fmt):
    try:
        from PIL import Image, features
        if fmt == 'webp':
            return bool(features.check('webp'))
        if fmt == 'avif':
            if 'AVIF' in Image.SAVE:
                return True
            try:
                import pillow_avif  # noqa: F401
                return 'AVIF' in Image.SAVE
            except ImportError:
                return False
    except ImportError:
        return False
    return False


def clean_stale_frames(out_dir, keep_count, ext):
    """Remove leftover f_####.<ext> files beyond keep_count from previous runs."""
    pat = re.compile(r'^f_(\d+)\.' + re.escape(ext) + r'$', re.IGNORECASE)
    for name in os.listdir(out_dir):
        m = pat.match(name)
        if m and int(m.group(1)) >= keep_count:
            try:
                os.remove(os.path.join(out_dir, name))
            except OSError:
                pass


def run_cmd(cmd, quiet=True):
    proc = subprocess.run(
        cmd,
        stdout=subprocess.PIPE if quiet else None,
        stderr=subprocess.PIPE if quiet else None,
        text=True,
    )
    if proc.returncode != 0:
        err = (proc.stderr or proc.stdout or '').strip()
        raise RuntimeError('Command failed (%d): %s\n%s' % (proc.returncode, ' '.join(cmd), err))


def encode_frames_pillow(src_paths, out_dir, fmt, quality, max_width, workers):
    from PIL import Image

    os.makedirs(out_dir, exist_ok=True)
    save_fmt = 'WEBP' if fmt == 'webp' else 'AVIF'

    def convert_one(item):
        idx, src = item
        dst = os.path.join(out_dir, 'f_%04d.%s' % (idx, fmt))
        with Image.open(src) as im:
            rgb = im.convert('RGB')
            if max_width and rgb.width > max_width:
                nh = max(2, int(round(rgb.height * (max_width / rgb.width))))
                nh -= nh % 2
                rgb = rgb.resize((max_width, nh), Image.Resampling.LANCZOS)
            size = rgb.size
            if save_fmt == 'WEBP':
                rgb.save(dst, 'WEBP', quality=quality, method=4)
            else:
                rgb.save(dst, 'AVIF', quality=quality)
        return size

    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
        sizes = list(pool.map(convert_one, enumerate(src_paths)))
    return sizes[0] if sizes else (0, 0)


def encode_frames_ffmpeg(ffmpeg, src_paths, out_dir, fmt, quality, max_width, workers):
    os.makedirs(out_dir, exist_ok=True)
    vf = []
    if max_width:
        vf.append("scale='min(%d,iw)':-2:flags=lanczos" % max_width)
    vf_args = ['-vf', ','.join(vf)] if vf else []

    seq = contiguous_f_sequence(src_paths)
    if fmt == 'webp' and seq is not None:
        start_num, digits = seq
        in_pattern = os.path.join(os.path.dirname(src_paths[0]), 'f_%%0%dd.png' % digits)
        out_pattern = os.path.join(out_dir, 'f_%04d.webp')
        cmd = [
            ffmpeg, '-y', '-hide_banner', '-loglevel', 'error',
            '-start_number', str(start_num), '-i', in_pattern,
            '-frames:v', str(len(src_paths)),
            *vf_args,
            '-c:v', 'libwebp', '-lossless', '0', '-compression_level', '4',
            '-q:v', str(quality), '-preset', 'picture',
            '-start_number', '0', out_pattern,
        ]
        run_cmd(cmd)
    else:
        crf = max(0, min(63, int(round((100 - quality) * 0.63))))

        def convert_one(item):
            idx, src = item
            dst = os.path.join(out_dir, 'f_%04d.%s' % (idx, fmt))
            if fmt == 'webp':
                cmd = [
                    ffmpeg, '-y', '-hide_banner', '-loglevel', 'error',
                    '-i', src, *vf_args,
                    '-c:v', 'libwebp', '-lossless', '0', '-compression_level', '4',
                    '-q:v', str(quality), '-preset', 'picture', dst,
                ]
            else:
                cmd = [
                    ffmpeg, '-y', '-hide_banner', '-loglevel', 'error',
                    '-i', src, *vf_args,
                    '-c:v', 'libaom-av1', '-still-picture', '1',
                    '-crf', str(crf), '-b:v', '0', '-cpu-used', '6',
                    '-pix_fmt', 'yuv420p', '-f', 'avif', dst,
                ]
            run_cmd(cmd)

        with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
            list(pool.map(convert_one, enumerate(src_paths)))

    first_dst = os.path.join(out_dir, 'f_0000.%s' % fmt)
    if has_pillow():
        try:
            from PIL import Image
            with Image.open(first_dst) as im:
                return im.size
        except Exception:
            pass
    dims = png_dimensions(src_paths[0])
    if dims:
        w, h = dims
        if max_width and w > max_width:
            h = max(2, int(round(h * (max_width / w))))
            h -= h % 2
            w = max_width
        return (w, h)
    return (1920, 1080)


def encode_av1_video(ffmpeg, src_paths, out_mp4, fps, crf, max_width):
    """Encode all-intra AV1 (-c:v libaom-av1 -crf 30 -g 1) for keyframe-accurate scrubbing."""
    os.makedirs(os.path.dirname(out_mp4), exist_ok=True)
    vf = []
    if max_width:
        vf.append("scale='min(%d,iw)':-2:flags=lanczos" % max_width)
    vf_args = ['-vf', ','.join(vf)] if vf else []

    seq = contiguous_f_sequence(src_paths)
    concat_file = None
    try:
        if seq is not None:
            start_num, digits = seq
            in_pattern = os.path.join(os.path.dirname(src_paths[0]), 'f_%%0%dd.png' % digits)
            in_args = ['-framerate', str(fps), '-start_number', str(start_num), '-i', in_pattern,
                       '-frames:v', str(len(src_paths))]
        else:
            dur = 1.0 / max(1, fps)
            fd, concat_file = tempfile.mkstemp(prefix='encode_av1_', suffix='.txt')
            with os.fdopen(fd, 'w', encoding='utf-8') as fh:
                for p in src_paths:
                    escaped = os.path.abspath(p).replace('\\', '/').replace("'", "'\\''")
                    fh.write("file '%s'\n" % escaped)
                    fh.write('duration %.8f\n' % dur)
                escaped_last = os.path.abspath(src_paths[-1]).replace('\\', '/').replace("'", "'\\''")
                fh.write("file '%s'\n" % escaped_last)
            in_args = ['-f', 'concat', '-safe', '0', '-i', concat_file]

        cmd = [
            ffmpeg, '-y', '-hide_banner', '-loglevel', 'error',
            *in_args,
            *vf_args,
            '-c:v', 'libaom-av1', '-crf', str(crf), '-b:v', '0',
            '-g', '1', '-cpu-used', '6', '-pix_fmt', 'yuv420p',
            '-r', str(fps), '-movflags', '+faststart', out_mp4,
        ]
        run_cmd(cmd)
    finally:
        if concat_file and os.path.exists(concat_file):
            try:
                os.remove(concat_file)
            except OSError:
                pass


def choose_encoder(requested, fmt):
    ffmpeg = find_ffmpeg()
    pil_ok = pillow_supports_format(fmt)
    if requested == 'ffmpeg':
        if not ffmpeg:
            raise RuntimeError('ffmpeg requested (--encoder ffmpeg) but not found on PATH.')
        return 'ffmpeg', ffmpeg
    if requested == 'pillow':
        if not pil_ok:
            raise RuntimeError('Pillow requested (--encoder pillow) but Pillow %s support is unavailable.' % fmt.upper())
        return 'pillow', None
    if ffmpeg:
        return 'ffmpeg', ffmpeg
    if pil_ok:
        return 'pillow', None
    raise RuntimeError(
        'No encoder available for %s. Install ffmpeg (https://ffmpeg.org) or Pillow (`pip install pillow`).' % fmt.upper()
    )


def find_variant_source(film_in, variant, preset):
    """Find the best available PNG render subfolder for `variant` ('desktop' or 'portrait')."""
    candidates = VARIANT_DIRS.get(preset or 'standard', VARIANT_DIRS['standard'])[variant]
    for sub in candidates:
        folder = os.path.join(film_in, sub)
        paths = list_png_frames(folder)
        if paths:
            return sub, folder, paths
    return None, os.path.join(film_in, candidates[0]), []


def discover_films(renders_dir):
    if not os.path.isdir(renders_dir):
        return []
    all_subs = ('desktop', 'portrait', '4k', '4k-portrait', '8k', '8k-portrait')
    found = []
    for name in sorted(os.listdir(renders_dir)):
        if name.startswith('.') or name.startswith('_'):
            continue
        full = os.path.join(renders_dir, name)
        if not os.path.isdir(full):
            continue
        if any(list_png_frames(os.path.join(full, sub)) for sub in all_subs):
            found.append(name)
    return found


def encode_film(name, renders_dir, out_root, args):
    film_in = os.path.join(renders_dir, name)
    film_out = os.path.join(out_root, name)
    manifest_path = os.path.join(film_out, 'manifest.json')

    manifest = {'fps': args.fps}
    if os.path.isfile(manifest_path):
        try:
            with open(manifest_path, 'r', encoding='utf-8') as fh:
                existing = json.load(fh)
            if isinstance(existing, dict):
                manifest.update(existing)
                manifest['fps'] = args.fps
        except Exception:
            pass

    target_variants = VARIANTS if args.res == 'both' else (args.res,)
    encoder_kind, ffmpeg = choose_encoder(args.encoder, args.format)
    if args.av1 and not ffmpeg:
        ffmpeg = find_ffmpeg()
        if not ffmpeg:
            raise RuntimeError('--av1 requires ffmpeg on PATH.')

    encoded_any = False
    for var in target_variants:
        src_sub, src_dir, src_paths = find_variant_source(film_in, var, args.preset)
        src_paths = filter_frame_range(src_paths, args.frames)
        if not src_paths:
            print('[encode] %s/%s: no PNG frames in %s (skipping)' % (name, var, src_dir))
            continue

        dst_dir = os.path.join(film_out, var)
        print('[encode] %s/%s (%s): %d PNGs -> %s (%s, q=%d, fps=%d)' % (
            name, var, src_sub, len(src_paths), dst_dir, args.format.upper(), args.quality, args.fps
        ))
        if args.dry_run:
            encoded_any = True
            continue

        if encoder_kind == 'ffmpeg':
            try:
                w, h = encode_frames_ffmpeg(
                    ffmpeg, src_paths, dst_dir, args.format, args.quality, args.max_width, args.workers
                )
            except RuntimeError as exc:
                if args.encoder == 'auto' and pillow_supports_format(args.format):
                    print('[encode] ffmpeg failed (%s); falling back to Pillow' % exc)
                    w, h = encode_frames_pillow(
                        src_paths, dst_dir, args.format, args.quality, args.max_width, args.workers
                    )
                else:
                    raise
        else:
            w, h = encode_frames_pillow(
                src_paths, dst_dir, args.format, args.quality, args.max_width, args.workers
            )

        clean_stale_frames(dst_dir, len(src_paths), args.format)
        entry = {
            'w': int(w),
            'h': int(h),
            'count': len(src_paths),
            'ext': args.format,
            'chunk': int(args.chunk),
            'path': var + '/',
        }

        if args.av1:
            mp4_name = var + '.mp4'
            mp4_path = os.path.join(film_out, mp4_name)
            print('[encode] %s/%s: encoding all-intra AV1 -> %s (crf=%d, g=1, fps=%d)' % (
                name, var, mp4_path, args.av1_crf, args.fps
            ))
            encode_av1_video(ffmpeg, src_paths, mp4_path, args.fps, args.av1_crf, args.max_width)
            entry['av1'] = mp4_name

        manifest[var] = entry
        encoded_any = True

    if encoded_any and not args.dry_run:
        if args.cdn_base:
            manifest['baseUrl'] = args.cdn_base.rstrip('/') + '/' + name + '/'
        os.makedirs(film_out, exist_ok=True)
        with open(manifest_path, 'w', encoding='utf-8') as fh:
            json.dump(manifest, fh, indent=2)
            fh.write('\n')
        print('[encode] wrote %s' % manifest_path)
    return encoded_any


def update_index(index_path, out_root, newly_encoded):
    existing = []
    if os.path.isfile(index_path):
        try:
            with open(index_path, 'r', encoding='utf-8') as fh:
                data = json.load(fh)
            if isinstance(data, dict) and isinstance(data.get('films'), list):
                existing = [f for f in data['films'] if isinstance(f, str)]
        except Exception:
            existing = []

    merged = []
    for name in existing + list(newly_encoded):
        if name.startswith('_') or name in merged:
            continue
        if os.path.isfile(os.path.join(out_root, name, 'manifest.json')):
            merged.append(name)

    os.makedirs(os.path.dirname(os.path.abspath(index_path)), exist_ok=True)
    with open(index_path, 'w', encoding='utf-8') as fh:
        json.dump({'films': merged}, fh, indent=2)
        fh.write('\n')
    print('[encode] updated %s -> %s' % (index_path, merged))


def _flag_given(argv, flag):
    return any(tok == flag or tok.startswith(flag + '=') for tok in argv)


def parse_args(argv=None):
    raw_argv = list(sys.argv[1:] if argv is None else argv)
    ap = argparse.ArgumentParser(
        description='Encode rendered Blender PNG sequences into WebP/AVIF frames and FilmPlayer manifests.'
    )
    ap.add_argument('films', nargs='*', help='optional film names to encode (e.g. pool sky echo_descent)')
    ap.add_argument('--film', action='append', dest='film_flags', default=[],
                    help='film name to encode (repeatable; default: auto-discover all in --renders)')
    ap.add_argument('--preset', choices=list(PRESETS), default='standard',
                    help='encoding preset: preview | standard | 100fps | 4k | 8k240 (default: standard)')
    ap.add_argument('--renders', default=os.path.join(REPO_ROOT, 'renders'),
                    help='root folder containing <film>/{desktop,portrait,4k,8k,...}/f_####.png')
    ap.add_argument('--out', default=os.path.join(REPO_ROOT, 'assets', 'films'),
                    help='output folder for assets/films/<film>/')
    ap.add_argument('--res', choices=['both', 'desktop', 'portrait'], default='both',
                    help='which output variant(s) to encode')
    ap.add_argument('--frames', default='',
                    help='optional frame range filter, e.g. 1-240, 1-600, 1-1000, or 1-2000')
    ap.add_argument('--format', choices=['webp', 'avif'], default='webp',
                    help='still frame format (default: webp)')
    ap.add_argument('--quality', type=int, default=82,
                    help='image quality 1..100 (default: 82)')
    ap.add_argument('--fps', type=int, default=24,
                    help='manifest & AV1 frame rate (24..240; default: 24, 100 with 100fps, 240 with 8k240)')
    ap.add_argument('--chunk', type=int, default=48,
                    help='frames per preload chunk in manifest (default: 48)')
    ap.add_argument('--max-width', type=int, default=0,
                    help='optional maximum output width in pixels (0 keeps rendered size)')
    ap.add_argument('--encoder', choices=['auto', 'ffmpeg', 'pillow'], default='auto',
                    help='encoder backend (default: auto)')
    ap.add_argument('--workers', type=int, default=max(1, min(8, os.cpu_count() or 4)),
                    help='parallel frame encoding workers')
    ap.add_argument('--av1', action='store_true',
                    help='also produce all-intra AV1 video (-c:v libaom-av1 -crf 30 -g 1)')
    ap.add_argument('--av1-crf', type=int, default=30, help='CRF for --av1 output (default: 30)')
    ap.add_argument('--cdn-base', default='',
                    help='optional external CDN base URL (e.g. https://pub-xxx.r2.dev/films) recorded as baseUrl in manifest.json')
    ap.add_argument('--index', default='', help='path to index.json (default: <out>/index.json)')
    ap.add_argument('--no-index', action='store_true', help='do not update index.json')
    ap.add_argument('--dry-run', action='store_true', help='show planned work without writing files')
    args = ap.parse_args(raw_argv)

    # Apply preset defaults without overriding explicit flags.
    if args.preset == 'preview':
        if not _flag_given(raw_argv, '--quality'):
            args.quality = 74
        if not _flag_given(raw_argv, '--chunk'):
            args.chunk = 24
    elif args.preset == '100fps':
        if not _flag_given(raw_argv, '--fps'):
            args.fps = 100
        if not _flag_given(raw_argv, '--chunk'):
            args.chunk = 50
    elif args.preset == '4k':
        if not _flag_given(raw_argv, '--quality'):
            args.quality = 85
        if not _flag_given(raw_argv, '--chunk'):
            args.chunk = 48
    elif args.preset == '8k240':
        if not _flag_given(raw_argv, '--fps'):
            args.fps = 240
        if not _flag_given(raw_argv, '--quality'):
            args.quality = 84
        if not _flag_given(raw_argv, '--chunk'):
            args.chunk = 60

    args.fps = max(1, int(args.fps))
    return args


def main(argv=None):
    args = parse_args(argv)
    args.renders = os.path.abspath(args.renders)
    args.out = os.path.abspath(args.out)

    requested = []
    for name in list(args.film_flags) + list(args.films):
        if name not in requested:
            requested.append(name)

    films = requested if requested else discover_films(args.renders)
    if not films:
        print('[encode] no rendered films found in %s' % args.renders)
        return 0

    encoded = []
    for name in films:
        if encode_film(name, args.renders, args.out, args):
            encoded.append(name)

    if encoded and not args.no_index and not args.dry_run:
        idx_path = os.path.abspath(args.index) if args.index else os.path.join(args.out, 'index.json')
        update_index(idx_path, args.out, encoded)

    if not encoded:
        print('[encode] nothing encoded (no PNG frames found)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
