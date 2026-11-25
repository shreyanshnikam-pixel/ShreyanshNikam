#!/usr/bin/env python3
"""Runway markings and cockpit display textures for build_sky.py, drawn with Pillow.

Run with your normal Python (Blender's bundled Python has no Pillow):
    pip install pillow
    python3 blender/make_textures.py            # writes blender/tex/*.png
build_sky.py runs this automatically if the files are missing and `python3` with Pillow is on PATH.

Runway: 3000 x 45 m, ICAO-style markings at 0.1 m per pixel (paint mask: white = paint, black = asphalt).
    runway_threshold.png   450 x 6000 px = 45 x 600 m: threshold stripes, designation, centreline,
                           touchdown-zone markings, aiming point, edge lines. Bottom of the image = threshold.
    runway_middle.png      450 x 500 px = 45 x 50 m tile: one 30 m centreline stripe + 20 m gap, edge lines.
                           Tiled along the 1800 m middle section.
Cockpit (fictional, generic glass cockpit):
    pfd.png, nd.png        512 x 512 primary flight display and navigation display.
"""
import argparse
import math
import os

from PIL import Image, ImageDraw, ImageFont

PX = 10  # pixels per metre
W_M = 45.0


def font(size):
    for p in ('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', '/Library/Fonts/Arial Bold.ttf',
              '/System/Library/Fonts/Supplemental/Arial Bold.ttf', 'C:/Windows/Fonts/arialbd.ttf'):
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


class Runway:
    """Draw in metres: x across the runway (0 = centreline), d along it (0 = threshold edge of the image)."""

    def __init__(self, length_m):
        self.L = length_m
        self.im = Image.new('L', (int(W_M * PX), int(length_m * PX)), 0)
        self.d = ImageDraw.Draw(self.im)

    def rect(self, x0, x1, d0, d1):
        H = self.im.height
        cx = self.im.width / 2
        self.d.rectangle([cx + x0 * PX, H - d1 * PX, cx + x1 * PX - 1, H - d0 * PX - 1], fill=255)

    def edges(self):
        for s in (-1, 1):
            x = s * (W_M / 2 - 0.45)
            self.rect(x - 0.45, x + 0.45, 0, self.L)

    def centreline(self, start, period=50.0, stripe=30.0, width=0.9):
        d = start
        while d < self.L:
            self.rect(-width / 2, width / 2, d, min(self.L, d + stripe))
            d += period


def threshold_texture(designation='09'):
    r = Runway(600.0)
    r.edges()
    # threshold: 12 stripes (6 each side of a 3.6 m centre gap), 30 m long, 1.8 m wide, 6 m in from the edge
    for s in (-1, 1):
        for k in range(6):
            x0 = 1.8 + k * 3.6
            r.rect(s * x0 if s > 0 else -(x0 + 1.8), s * (x0 + 1.8) if s > 0 else -x0, 6.0, 36.0)
    # designation: 9 m tall numbers, 12 m beyond the threshold stripes, upright for an approaching pilot
    f = font(int(9 * PX * 1.3))
    tw = r.d.textlength(designation, font=f)
    H = r.im.height
    top = H - (48 + 9) * PX
    r.d.text(((r.im.width - tw) / 2, top - 0.18 * 9 * PX), designation, font=f, fill=255)
    # centreline from 66 m
    r.centreline(66.0)
    # touchdown zone: (distance, stripes per side), 22.5 m long, 1.8 m wide, 1.5 m apart, inner edge 9 m from CL
    for dist, n in ((150, 3), (300, 3), (450, 2), (550, 2)):
        for s in (-1, 1):
            for k in range(n):
                x0 = 9.0 + k * 3.3
                xa, xb = (x0, x0 + 1.8) if s > 0 else (-x0 - 1.8, -x0)
                r.rect(xa, xb, dist, dist + 22.5)
    # aiming point: 400 m from the threshold, 60 m long, 10 m wide, inner edges 18 m apart (overrides TDZ there)
    for s in (-1, 1):
        r.rect(9.0 if s > 0 else -19.0, 19.0 if s > 0 else -9.0, 400.0, 460.0)
    return r.im


def middle_texture():
    r = Runway(50.0)
    r.edges()
    r.rect(-0.45, 0.45, 10.0, 40.0)
    return r.im


def pfd():
    im = Image.new('RGB', (512, 512), (6, 10, 16))
    d = ImageDraw.Draw(im)
    # attitude: 3 degrees nose down on the glideslope, slight bank
    cx, cy, bank = 256, 230, math.radians(-4)
    horizon = cy - 30
    sky, ground = (40, 92, 150), (92, 64, 40)
    poly_s, poly_g = [], []
    for x in range(60, 453, 4):
        y = horizon + (x - cx) * math.tan(bank)
        poly_s.append((x, y))
        poly_g.append((x, y))
    d.polygon([(60, 70)] + poly_s + [(452, 70)], fill=sky)
    d.polygon([(60, 390)] + poly_g + [(452, 390)], fill=ground)
    for p in range(-20, 25, 5):
        y = horizon - p * 6
        w = 40 if p % 10 == 0 else 20
        d.line([(cx - w, y), (cx + w, y)], fill=(235, 240, 245), width=2)
    d.line([(cx - 90, cy), (cx - 30, cy), (cx - 30, cy + 12)], fill=(250, 220, 60), width=5)
    d.line([(cx + 90, cy), (cx + 30, cy), (cx + 30, cy + 12)], fill=(250, 220, 60), width=5)
    d.rectangle([cx - 4, cy - 4, cx + 4, cy + 4], outline=(250, 220, 60), width=3)
    f = font(22)
    d.rectangle([6, 200, 60, 260], outline=(235, 240, 245), width=2)
    d.text((12, 218), '140', font=f, fill=(235, 240, 245))
    d.rectangle([452, 200, 506, 260], outline=(235, 240, 245), width=2)
    d.text((456, 218), '2500', font=font(18), fill=(235, 240, 245))
    d.text((210, 420), 'GS  LOC', font=f, fill=(80, 230, 120))
    d.text((200, 460), 'HDG 090', font=f, fill=(235, 240, 245))
    return im


def nd():
    im = Image.new('RGB', (512, 512), (6, 10, 16))
    d = ImageDraw.Draw(im)
    cx, cy = 256, 420
    for r in (110, 220, 330):
        d.arc([cx - r, cy - r, cx + r, cy + r], 200, 340, fill=(200, 210, 220), width=2)
    d.line([(cx, cy), (cx, 70)], fill=(230, 80, 220), width=3)
    d.polygon([(cx, cy - 14), (cx - 10, cy + 10), (cx + 10, cy + 10)], outline=(250, 220, 60))
    d.rectangle([cx - 4, 120, cx + 4, 136], fill=(80, 230, 120))
    d.text((cx + 10, 112), 'RW09', font=font(18), fill=(80, 230, 120))
    for i, (x, y) in enumerate(((180, 300), (330, 250), (300, 180), (150, 210))):
        d.ellipse([x - 4, y - 4, x + 4, y + 4], fill=(90, 200, 255))
    d.text((20, 20), 'GS140  TAS142', font=font(18), fill=(235, 240, 245))
    d.text((380, 20), 'ILS', font=font(18), fill=(230, 80, 220))
    return im


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tex'))
    ap.add_argument('--designation', default='09')
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    threshold_texture(a.designation).save(os.path.join(a.out, 'runway_threshold.png'))
    other = '%02d' % ((int(a.designation) + 18 - 1) % 36 + 1)
    threshold_texture(other).save(os.path.join(a.out, 'runway_threshold_far.png'))
    middle_texture().save(os.path.join(a.out, 'runway_middle.png'))
    pfd().save(os.path.join(a.out, 'pfd.png'))
    nd().save(os.path.join(a.out, 'nd.png'))
    print('wrote textures to', a.out)


if __name__ == '__main__':
    main()
