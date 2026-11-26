#!/usr/bin/env python3
"""Cut the background moments from "The Rockies | Cinematic Drone 4K Video" by stoked tour (Samson Tan), used with
the creator's permission, into seamless looping clips for the Home page.

    python3 tools/cut_rockies.py /path/to/the_rockies.mp4          (the original file)
    python3 tools/cut_rockies.py /path/to/folder_of_recordings     (rockies_<name>_from<t0>_x<N>.mp4, recorded in Chrome
                                                                    at 1/N speed in 4K; t0 = video time at frame 0)

Writes assets/rockies/<name>_1080.mp4, <name>_720.mp4 and <name>.webp (poster) for every moment below.
Each loop crossfades its last second into its first, so it repeats without a jump. No audio."""
import json, os, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.environ.get('ROCKIES_OUT') or os.path.join(ROOT, 'assets', 'rockies')
# section index on Home -> moment (start, end in seconds of the original video), picked frame by frame
MOMENTS = [
    (1, 'lake-rays', 12.3, 20.3, 'A turquoise lake under shafts of sunlight'),
    (2, 'peaks-cloud', 93.2, 98.8, 'Snow peaks with cloud on their shoulders'),
    (3, 'mirror-lake', 184.8, 191.6, 'An alpine lake holding the sky like a mirror'),
    (4, 'tarn', 173.2, 177.8, 'A snow-dusted tarn below a ridge'),
    (5, 'alpenglow', 179.2, 182.4, 'Alpenglow on a range at last light'),
    (6, 'sunset-ridge', 28.2, 34.8, 'A rock ridge against a sunset over snow peaks'),
]
XF = 1.0  # loop crossfade, seconds


def run(args):
    subprocess.run(args, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)


def cut(src, name, s, e, height, crf, slow=1.0):
    """body = [s+XF, e]; its last XF seconds blend into [s, s+XF], so the clip ends where it begins.
    slow > 1: the source was recorded slowed down; it is brought back to real speed first."""
    L = e - s - XF
    dst = os.path.join(OUT, f'{name}_{height}.mp4')
    pre = f"setpts=(PTS-STARTPTS)/{slow},fps=24," if slow != 1.0 else ""
    sc = "-2:'min(2160,ih)'" if height == 2160 else f"-2:{height}"  # 4K stays at the source's native size, never stretched
    flt = (f"[0:v]{pre}trim=start={s + XF}:end={e},setpts=PTS-STARTPTS,scale={sc}:flags=lanczos,fps=24,format=yuv420p[a];"
           f"[0:v]{pre}trim=start={s}:end={s + XF},setpts=PTS-STARTPTS,scale={sc}:flags=lanczos,fps=24,format=yuv420p[b];"
           f"[a][b]xfade=transition=fade:duration={XF}:offset={L - XF}[v]")
    run(['ffmpeg', '-y', '-i', src, '-filter_complex', flt, '-map', '[v]', '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', str(crf),
         '-profile:v', 'high', '-movflags', '+faststart', '-pix_fmt', 'yuv420p', dst])
    return dst


def main():
    src = sys.argv[1]
    os.makedirs(OUT, exist_ok=True)
    manifest = {'credit': 'The Rockies | Cinematic Drone 4K Video by stoked tour (Samson Tan), used with permission', 'source': 'https://www.youtube.com/watch?v=zzMo2dy7mNY', 'clips': []}
    import glob, re
    for sec, name, s, e, alt in MOMENTS:
        f, slow = src, 1.0
        if os.path.isdir(src):  # one Chrome recording per moment: times become relative to its first frame
            hits = glob.glob(os.path.join(src, f'rockies_{name}_from*_x[0-9]*.mp4'))
            if not hits: print('missing recording for', name); continue
            f = sorted(hits, key=lambda h: int(re.search(r'_x(\d+)\.mp4$', h).group(1)))[-1]; m = re.search(r'_from([0-9.]+)_x(\d+)\.mp4$', f)
            t0, slow = float(m.group(1)), float(m.group(2)); s, e = s - t0, e - t0
        for height, crf in [(2160, 20), (1080, 22), (720, 25)]:
            cut(f, name, s, e, height, crf, slow)
        run(['ffmpeg', '-y', '-ss', str((s + XF + 0.2) * slow), '-i', f, '-frames:v', '1', '-vf', 'scale=-2:720:flags=lanczos', os.path.join(OUT, f'{name}.webp')])
        manifest['clips'].append({'section': sec, 'name': name, 'alt': alt})
        print('cut', name)
    json.dump(manifest, open(os.path.join(OUT, 'manifest.json'), 'w'), indent=1)
    print('done ->', OUT)


if __name__ == '__main__':
    main()
