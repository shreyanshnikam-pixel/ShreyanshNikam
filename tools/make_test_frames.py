#!/usr/bin/env python3
"""Generate a numbered test film for js/film.js.

Writes assets/films/_test/{desktop,portrait}/f_0000.webp ... and assets/films/_test/manifest.json.
Each frame shows its number, a sweeping bar, and a flat centre square whose grey level is 2 * frame index,
so an automated test can read the centre pixel of the canvas and know exactly which frame is on screen.

    python3 tools/make_test_frames.py                 # 120 frames, chunks of 16
    python3 tools/make_test_frames.py --count 240 --chunk 48
"""
import argparse, json, math, os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def font(size):
    for p in ('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', '/System/Library/Fonts/Helvetica.ttc', 'C:/Windows/Fonts/arialbd.ttf'):
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def frame(i, n, w, h):
    t = i / max(1, n - 1)
    im = Image.new('RGB', (w, h))
    d = ImageDraw.Draw(im)
    # vertical icy gradient that shifts with time
    for y in range(h):
        k = y / h
        c = (int(200 - 120 * k + 30 * t), int(215 - 110 * k + 20 * t), int(230 - 80 * k))
        d.line([(0, y), (w, y)], fill=c)
    # sweeping bar (shows motion direction while scrubbing)
    x = int(t * (w - 40))
    d.rectangle([x, 0, x + 40, h], fill=(47, 111, 228))
    # centre square: grey = 2 * i (the test reads this)
    s = min(w, h) // 4
    g = min(255, 2 * i)
    d.rectangle([w // 2 - s // 2, h // 2 - s // 2, w // 2 + s // 2, h // 2 + s // 2], fill=(g, g, g))
    # frame number
    f = font(min(w, h) // 7)
    txt = f'{i:04d}'
    tw = d.textlength(txt, font=f)
    d.text(((w - tw) / 2, h // 2 + s // 2 + 20), txt, font=f, fill=(15, 27, 38))
    # a little rotating tick so neighbouring frames differ visibly
    a = t * math.tau * 2
    cx, cy, r = w - 90, 90, 50
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(15, 27, 38), width=4)
    d.line([(cx, cy), (cx + r * math.cos(a), cy + r * math.sin(a))], fill=(15, 27, 38), width=4)
    return im


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--count', type=int, default=120)
    ap.add_argument('--chunk', type=int, default=16)
    ap.add_argument('--out', default=os.path.join(ROOT, 'assets', 'films', '_test'))
    ap.add_argument('--quality', type=int, default=90)
    a = ap.parse_args()
    variants = {'desktop': (960, 540), 'portrait': (540, 960)}
    man = {'fps': 24}
    for name, (w, h) in variants.items():
        od = os.path.join(a.out, name)
        os.makedirs(od, exist_ok=True)
        for i in range(a.count):
            frame(i, a.count, w, h).save(os.path.join(od, f'f_{i:04d}.webp'), 'WEBP', quality=a.quality, method=4)
        man[name] = {'w': w, 'h': h, 'count': a.count, 'ext': 'webp', 'chunk': a.chunk, 'path': name + '/'}
    with open(os.path.join(a.out, 'manifest.json'), 'w') as fh:
        json.dump(man, fh, indent=2)
    print('wrote', a.count, 'frames x', len(variants), 'variants to', a.out)


if __name__ == '__main__':
    main()
