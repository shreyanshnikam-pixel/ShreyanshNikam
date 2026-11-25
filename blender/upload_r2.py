#!/usr/bin/env python3
"""Upload encoded film sequences to Cloudflare R2 and wire manifests for GitHub Pages / Netlify.

Workflow:
  1. Auto-locates Cloudflare Wrangler CLI (`D:\\Tools\\wrangler\\node_modules\\.bin\\wrangler.cmd` or PATH).
  2. Creates the target R2 bucket if needed (`wrangler r2 bucket create <bucket>`).
  3. Applies CORS rules from `blender/r2-cors.json` (`wrangler r2 bucket cors set <bucket> --file ... --force`).
  4. Uploads encoded frames (`*.webp`, `*.avif`, `*.mp4`, `manifest.json`) from
     `D:\\ShreyanshNikam-renders\\encoded\\<film>` (or `assets/films/<film>`) to
     `r2://<bucket>/films/<film>/...` using `--remote`, proper `Content-Type`, and
     immutable cache headers (`public, max-age=31536000, immutable`).
  5. Writes lightweight `assets/films/<film>/manifest.json` with
     `"baseUrl": "<public-r2-url>/films/<film>/"` and updates `assets/films/index.json`
     so GitHub Pages stays tiny while streaming 4K/8K 100fps frames directly from R2.

Usage (from the repo root):
  python blender/upload_r2.py --bucket shreyanshnikam-films --public-url https://pub-xxxx.r2.dev
  python blender/upload_r2.py --bucket shreyanshnikam-films --public-url https://pub-xxxx.r2.dev pool echo_descent
  python blender/upload_r2.py --dry-run --source D:\\ShreyanshNikam-renders\\encoded --public-url https://pub-xxxx.r2.dev
"""
import argparse
import concurrent.futures
import json
import os
import shutil
import subprocess
import sys
import threading

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(SCRIPT_DIR)
DEFAULT_WRANGLER_WIN = r'D:\Tools\wrangler\node_modules\.bin\wrangler.cmd'
DEFAULT_ENCODED_D = r'D:\ShreyanshNikam-renders\encoded'
DEFAULT_ASSETS_FILMS = os.path.join(REPO_ROOT, 'assets', 'films')
DEFAULT_CORS_FILE = os.path.join(SCRIPT_DIR, 'r2-cors.json')
IMMUTABLE_CACHE = 'public, max-age=31536000, immutable'
MANIFEST_CACHE = 'public, max-age=300'

CONTENT_TYPES = {
    '.webp': 'image/webp',
    '.avif': 'image/avif',
    '.mp4': 'video/mp4',
    '.json': 'application/json',
}


def find_wrangler(explicit=''):
    """Locate wrangler CLI (explicit path, D:\\Tools\\wrangler, or PATH)."""
    if explicit:
        if os.path.isfile(explicit):
            return explicit
        found = shutil.which(explicit)
        if found:
            return found
        raise FileNotFoundError('Specified wrangler executable not found: %s' % explicit)

    if os.path.isfile(DEFAULT_WRANGLER_WIN):
        return DEFAULT_WRANGLER_WIN

    for candidate in ('wrangler', 'wrangler.cmd', 'wrangler.exe'):
        found = shutil.which(candidate)
        if found:
            return found

    return None


def resolve_source_roots(explicit_source=''):
    """Return ordered source directories to search for encoded film folders."""
    if explicit_source:
        return [os.path.abspath(explicit_source)]
    roots = []
    if os.path.isdir(DEFAULT_ENCODED_D):
        roots.append(DEFAULT_ENCODED_D)
    if os.path.isdir(DEFAULT_ASSETS_FILMS) and os.path.abspath(DEFAULT_ASSETS_FILMS) not in roots:
        roots.append(os.path.abspath(DEFAULT_ASSETS_FILMS))
    return roots


def discover_films(source_roots):
    """Find film folders containing a manifest.json across source roots."""
    found = []
    for root in source_roots:
        if not os.path.isdir(root):
            continue
        for name in sorted(os.listdir(root)):
            if name.startswith('.') or name.startswith('_') or name in found:
                continue
            film_dir = os.path.join(root, name)
            if os.path.isdir(film_dir) and os.path.isfile(os.path.join(film_dir, 'manifest.json')):
                found.append(name)
    return found


def locate_film_dir(name, source_roots):
    for root in source_roots:
        candidate = os.path.join(root, name)
        if os.path.isdir(candidate) and os.path.isfile(os.path.join(candidate, 'manifest.json')):
            return candidate
    return None


def collect_upload_files(film_dir):
    """Collect (abs_path, rel_posix_path, content_type) for all supported film assets."""
    items = []
    for dirpath, dirnames, filenames in os.walk(film_dir):
        dirnames.sort()
        for fname in sorted(filenames):
            ext = os.path.splitext(fname)[1].lower()
            ct = CONTENT_TYPES.get(ext)
            if not ct:
                continue
            full = os.path.join(dirpath, fname)
            rel = os.path.relpath(full, film_dir).replace('\\', '/')
            items.append((full, rel, ct))
    return items


def build_base_url(public_url, prefix, film_name):
    """Build `<public_url>/<prefix>/<film_name>/` without duplicating `<prefix>`."""
    base = public_url.strip().rstrip('/')
    pref = prefix.strip().strip('/')
    if pref:
        suffix = '/' + pref
        if base.endswith(suffix):
            return '%s/%s/' % (base, film_name)
        return '%s/%s/%s/' % (base, pref, film_name)
    return '%s/%s/' % (base, film_name)


def run_wrangler(wrangler_cmd, args, dry_run=False, allow_already_exists=False):
    cmd = [wrangler_cmd] + list(args)
    if dry_run:
        print('[upload_r2][dry-run] %s' % subprocess.list2cmdline(cmd))
        return 0, ''

    proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    combined = ((proc.stdout or '') + '\n' + (proc.stderr or '')).strip()
    if proc.returncode != 0:
        if allow_already_exists and ('already exists' in combined.lower() or '10004' in combined):
            return 0, combined
        raise RuntimeError('Wrangler command failed (%d): %s\n%s' % (
            proc.returncode, subprocess.list2cmdline(cmd), combined
        ))
    return proc.returncode, combined


def ensure_bucket_and_cors(wrangler_cmd, bucket, cors_file, dry_run=False):
    print('[upload_r2] Ensuring R2 bucket "%s" exists...' % bucket)
    _, out = run_wrangler(
        wrangler_cmd,
        ['r2', 'bucket', 'create', bucket],
        dry_run=dry_run,
        allow_already_exists=True,
    )
    if out and 'already exists' in out.lower():
        print('[upload_r2] Bucket "%s" already exists (continuing).' % bucket)

    if not os.path.isfile(cors_file):
        raise FileNotFoundError('CORS config file not found: %s' % cors_file)

    print('[upload_r2] Applying CORS policy %s to bucket "%s"...' % (cors_file, bucket))
    run_wrangler(
        wrangler_cmd,
        ['r2', 'bucket', 'cors', 'set', bucket, '--file', cors_file, '--force'],
        dry_run=dry_run,
    )


def upload_one_object(wrangler_cmd, bucket, key, local_path, content_type, cache_control, dry_run=False):
    args = [
        'r2', 'object', 'put', '%s/%s' % (bucket, key),
        '--file', local_path,
        '--remote',
        '--content-type', content_type,
        '--cache-control', cache_control,
    ]
    try:
        run_wrangler(wrangler_cmd, args, dry_run=dry_run)
    except RuntimeError:
        if dry_run:
            raise
        # One automatic retry for transient network hiccups on large sequences.
        run_wrangler(wrangler_cmd, args, dry_run=False)


def write_manifest_with_base_url(src_manifest_path, dst_manifest_path, base_url, dry_run=False):
    with open(src_manifest_path, 'r', encoding='utf-8') as fh:
        manifest = json.load(fh)
    manifest['baseUrl'] = base_url

    if dry_run:
        print('[upload_r2][dry-run] Would write %s with baseUrl=%s' % (dst_manifest_path, base_url))
        return manifest

    os.makedirs(os.path.dirname(os.path.abspath(dst_manifest_path)), exist_ok=True)
    with open(dst_manifest_path, 'w', encoding='utf-8') as fh:
        json.dump(manifest, fh, indent=2)
        fh.write('\n')
    print('[upload_r2] Wrote %s (baseUrl=%s)' % (dst_manifest_path, base_url))
    return manifest


def update_index_json(index_path, assets_dir, uploaded_films, dry_run=False):
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
    for name in existing + list(uploaded_films):
        if name.startswith('_') or name in merged:
            continue
        manifest_file = os.path.join(assets_dir, name, 'manifest.json')
        if dry_run or os.path.isfile(manifest_file):
            merged.append(name)

    if dry_run:
        print('[upload_r2][dry-run] Would update %s -> %s' % (index_path, merged))
        return merged

    os.makedirs(os.path.dirname(os.path.abspath(index_path)), exist_ok=True)
    with open(index_path, 'w', encoding='utf-8') as fh:
        json.dump({'films': merged}, fh, indent=2)
        fh.write('\n')
    print('[upload_r2] Updated %s -> %s' % (index_path, merged))
    return merged


def upload_film(wrangler_cmd, film_name, film_dir, args):
    files = collect_upload_files(film_dir)
    if not files:
        print('[upload_r2] %s: no uploadable files found in %s (skipping)' % (film_name, film_dir))
        return False

    pref = args.prefix.strip().strip('/')
    base_url = build_base_url(args.public_url, pref, film_name) if args.public_url else ''
    total = len(files)
    print('[upload_r2] %s: uploading %d files from %s -> r2://%s/%s/%s/' % (
        film_name, total, film_dir, args.bucket, pref, film_name
    ))

    # Build upload plan; for dry-run, show first 5 + summary so huge sequences stay readable.
    plan = []
    for local_path, rel_posix, ct in files:
        key = '%s/%s/%s' % (pref, film_name, rel_posix) if pref else '%s/%s' % (film_name, rel_posix)
        cc = args.manifest_cache_control if rel_posix == 'manifest.json' else args.cache_control
        plan.append((local_path, rel_posix, key, ct, cc))

    if args.dry_run:
        sample = plan[:5]
        for local_path, _, key, ct, cc in sample:
            upload_one_object(wrangler_cmd, args.bucket, key, local_path, ct, cc, dry_run=True)
        if len(plan) > len(sample):
            print('[upload_r2][dry-run] ... and %d more objects' % (len(plan) - len(sample)))
    else:
        done = 0
        lock = threading.Lock()

        def worker(item):
            nonlocal done
            local_path, _, key, ct, cc = item
            upload_one_object(wrangler_cmd, args.bucket, key, local_path, ct, cc, dry_run=False)
            with lock:
                done += 1
                if done == total or done % 50 == 0:
                    print('[upload_r2] %s: %d / %d uploaded' % (film_name, done, total))

        with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
            futures = [pool.submit(worker, item) for item in plan]
            for fut in concurrent.futures.as_completed(futures):
                fut.result()

    if base_url:
        src_manifest = os.path.join(film_dir, 'manifest.json')
        dst_manifest = os.path.join(args.assets_dir, film_name, 'manifest.json')
        write_manifest_with_base_url(src_manifest, dst_manifest, base_url, dry_run=args.dry_run)

    return True


def parse_args(argv=None):
    ap = argparse.ArgumentParser(
        description='Upload encoded film sequences to Cloudflare R2 and update assets/films manifests.'
    )
    ap.add_argument('films', nargs='*', help='optional film names to upload (e.g. pool sky echo_descent)')
    ap.add_argument('--film', action='append', dest='film_flags', default=[],
                    help='film name to upload (repeatable; default: auto-discover all)')
    ap.add_argument('--bucket', default='shreyanshnikam-films',
                    help='Cloudflare R2 bucket name (default: shreyanshnikam-films)')
    ap.add_argument('--public-url', default='',
                    help='Public R2 base URL (e.g. https://pub-xxxx.r2.dev or custom domain)')
    ap.add_argument('--prefix', default='films',
                    help='Object key prefix inside the bucket (default: films)')
    ap.add_argument('--source', default='',
                    help='Encoded films folder (default: D:\\ShreyanshNikam-renders\\encoded if present, else assets/films)')
    ap.add_argument('--assets-dir', default=DEFAULT_ASSETS_FILMS,
                    help='Local repo assets/films directory where manifest.json & index.json are updated')
    ap.add_argument('--cors-file', default=DEFAULT_CORS_FILE,
                    help='Path to R2 CORS JSON file (default: blender/r2-cors.json)')
    ap.add_argument('--cache-control', default=IMMUTABLE_CACHE,
                    help='Cache-Control header for frame/video objects (default: "%s")' % IMMUTABLE_CACHE)
    ap.add_argument('--manifest-cache-control', default=MANIFEST_CACHE,
                    help='Cache-Control header for manifest.json on R2 (default: "%s")' % MANIFEST_CACHE)
    ap.add_argument('--workers', type=int, default=6,
                    help='Parallel wrangler upload workers (default: 6)')
    ap.add_argument('--wrangler', default='',
                    help='Explicit path to wrangler / wrangler.cmd')
    ap.add_argument('--skip-bucket-setup', action='store_true',
                    help='Skip bucket creation and CORS configuration')
    ap.add_argument('--no-index', action='store_true',
                    help='Do not update assets/films/index.json')
    ap.add_argument('--dry-run', action='store_true',
                    help='Print planned wrangler commands and manifest updates without executing')
    return ap.parse_args(argv)


def main(argv=None):
    args = parse_args(argv)
    args.assets_dir = os.path.abspath(args.assets_dir)
    args.cors_file = os.path.abspath(args.cors_file)

    wrangler_cmd = find_wrangler(args.wrangler)
    if not wrangler_cmd:
        if args.dry_run:
            wrangler_cmd = 'wrangler'
        else:
            print('[upload_r2] ERROR: wrangler CLI not found on PATH or at %s' % DEFAULT_WRANGLER_WIN, file=sys.stderr)
            return 1

    if not args.public_url and not args.dry_run:
        print('[upload_r2] WARNING: --public-url not provided; frames will upload to R2, '
              'but manifest.json baseUrl will NOT be updated.')

    source_roots = resolve_source_roots(args.source)
    requested = []
    for name in list(args.film_flags) + list(args.films):
        if name not in requested:
            requested.append(name)

    films = requested if requested else discover_films(source_roots)
    if not films:
        print('[upload_r2] No encoded films with manifest.json found in: %s' % ', '.join(source_roots))
        return 0

    print('[upload_r2] Wrangler : %s' % wrangler_cmd)
    print('[upload_r2] Bucket   : %s (prefix: %s)' % (args.bucket, args.prefix))
    print('[upload_r2] Films    : %s' % ', '.join(films))
    if args.public_url:
        print('[upload_r2] PublicURL: %s' % args.public_url)

    if not args.skip_bucket_setup:
        ensure_bucket_and_cors(wrangler_cmd, args.bucket, args.cors_file, dry_run=args.dry_run)

    uploaded = []
    for name in films:
        film_dir = locate_film_dir(name, source_roots)
        if not film_dir:
            print('[upload_r2] WARNING: film "%s" not found in %s (skipping)' % (name, source_roots))
            continue
        if upload_film(wrangler_cmd, name, film_dir, args):
            uploaded.append(name)

    if uploaded and args.public_url and not args.no_index:
        index_path = os.path.join(args.assets_dir, 'index.json')
        update_index_json(index_path, args.assets_dir, uploaded, dry_run=args.dry_run)

    print('[upload_r2] Done (%d film(s) processed).' % len(uploaded))
    return 0


if __name__ == '__main__':
    sys.exit(main())
