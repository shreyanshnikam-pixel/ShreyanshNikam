#!/usr/bin/env python3
"""High-resolution procedural textures for build_sky.py, drawn with Pillow.

Run with your normal Python (Blender's bundled Python has no Pillow):
    pip install pillow
    python3 blender/make_textures.py            # writes blender/tex/*.png
build_sky.py runs this automatically if any required texture is missing.

Outputs:
  Runway (3000 x 45 m ICAO-style paint masks: white = paint, black = asphalt):
    runway_threshold.png        450 x 6000 px = 45 x 600 m (threshold, designation, CL, TDZ, aiming)
    runway_threshold_far.png    450 x 6000 px opposite-end markings
    runway_middle.png           450 x 500 px  50 m tileable middle section
  Cockpit glass displays (fictional generic widebody):
    pfd.png, nd.png, eicas.png  1024 x 1024 primary flight, navigation, and 4-engine EICAS displays
    mcp.png                     1536 x 160  amber backlit Mode Control Panel strip
  Boeing 747SP photoreal skin (tileable 2048 x 2048 box-projected maps):
    b747_panels_bump.png        aluminum skin panel seams, access hatches, and micro-rivet rows
    b747_panels_rough.png       panel-to-panel weathering, airflow streaks, and dark seam grooves
  FAA Airport Traffic Control Tower displays (for 18 dual-tier cab monitors):
    atc_stars.png               1024 x 1024 STARS terminal radar scope with targets & bird caution
    atc_asdex.png               1024 x 1024 ASDE-X airport surface movement radar
    atc_tfdm.png                1024 x 768  TFDM electronic flight strip bay
    atc_ids4.png                1024 x 768  IDS4 ATIS, runway status, wind & NOTAM table
    atc_weather.png             1024 x 768  ITWS / LLWAS winter Doppler radar & wind shear
    atc_sentry_alert.png        1024 x 768  Sky Sentry live detection feed & HIGH RISK red alert
    atc_comms.png               1024 x 768  FAA VCSS radio frequency & airfield lighting panel
    atc_flightplan.png          1024 x 768  TBFM arrival metering timeline & wildlife log
  Canada goose feather plumage:
    goose_plumage.png           1024 x 1024 scalloped grey-brown feathered mantle & covert texture
"""
import argparse
import math
import os
import random

from PIL import Image, ImageDraw, ImageFilter, ImageFont

PX = 10  # pixels per metre for runway masks
W_M = 45.0


def font(size, mono=False):
    paths = (
        ('C:/Windows/Fonts/consolab.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf',
         '/System/Library/Fonts/Menlo.ttc', 'C:/Windows/Fonts/arialbd.ttf')
        if mono else
        ('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', '/Library/Fonts/Arial Bold.ttf',
         '/System/Library/Fonts/Supplemental/Arial Bold.ttf', 'C:/Windows/Fonts/arialbd.ttf')
    )
    for p in paths:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except OSError:
                continue
    return ImageFont.load_default()


# ------------------------------------------------------------------------------------------------ runway
class Runway:
    """Draw in metres: x across the runway (0 = centreline), d along it (0 = threshold edge of image)."""

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
    for s in (-1, 1):
        for k in range(6):
            x0 = 1.8 + k * 3.6
            r.rect(s * x0 if s > 0 else -(x0 + 1.8), s * (x0 + 1.8) if s > 0 else -x0, 6.0, 36.0)
    f = font(int(9 * PX * 1.3))
    tw = r.d.textlength(designation, font=f)
    H = r.im.height
    top = H - (48 + 9) * PX
    r.d.text(((r.im.width - tw) / 2, top - 0.18 * 9 * PX), designation, font=f, fill=255)
    r.centreline(66.0)
    for dist, n in ((150, 3), (300, 3), (450, 2), (550, 2)):
        for s in (-1, 1):
            for k in range(n):
                x0 = 9.0 + k * 3.3
                xa, xb = (x0, x0 + 1.8) if s > 0 else (-x0 - 1.8, -x0)
                r.rect(xa, xb, dist, dist + 22.5)
    for s in (-1, 1):
        r.rect(9.0 if s > 0 else -19.0, 19.0 if s > 0 else -9.0, 400.0, 460.0)
    return r.im


def middle_texture():
    r = Runway(50.0)
    r.edges()
    r.rect(-0.45, 0.45, 10.0, 40.0)
    return r.im


# ------------------------------------------------------------------------------------------------ cockpit displays
def pfd():
    W, H = 1024, 1024
    im = Image.new('RGB', (W, H), (5, 9, 15))
    d = ImageDraw.Draw(im)
    cx, cy, bank = 512, 460, math.radians(-2.5)
    horizon = cy - 42
    sky, ground = (34, 106, 184), (118, 72, 34)
    poly_s, poly_g = [], []
    for x in range(180, 845, 8):
        y = horizon + (x - cx) * math.tan(bank)
        poly_s.append((x, y))
        poly_g.append((x, y))
    d.polygon([(180, 130)] + poly_s + [(844, 130)], fill=sky)
    d.polygon([(180, 770)] + poly_g + [(844, 770)], fill=ground)
    d.line([poly_s[0], poly_s[-1]], fill=(245, 250, 255), width=4)
    f_sm = font(24, mono=True)
    for p in range(-20, 25, 5):
        if p == 0:
            continue
        y = horizon - p * 12
        if 150 < y < 740:
            hw = 88 if p % 10 == 0 else 44
            d.line([(cx - hw, y), (cx + hw, y)], fill=(235, 242, 248), width=3)
            if p % 10 == 0:
                d.text((cx - hw - 42, y - 14), str(abs(p)), font=f_sm, fill=(235, 242, 248))
                d.text((cx + hw + 12, y - 14), str(abs(p)), font=f_sm, fill=(235, 242, 248))
    d.line([(cx - 170, cy), (cx - 56, cy), (cx - 56, cy + 24)], fill=(255, 214, 48), width=10)
    d.line([(cx + 170, cy), (cx + 56, cy), (cx + 56, cy + 24)], fill=(255, 214, 48), width=10)
    d.rectangle([cx - 10, cy - 10, cx + 10, cy + 10], outline=(255, 214, 48), width=5)
    d.line([(cx - 120, cy + 8), (cx + 120, cy + 8)], fill=(240, 78, 224), width=5)
    d.line([(cx, cy - 105), (cx, cy + 105)], fill=(240, 78, 224), width=5)
    d.rectangle([20, 130, 152, 770], fill=(32, 38, 46), outline=(140, 154, 170), width=2)
    d.rectangle([872, 130, 1004, 770], fill=(32, 38, 46), outline=(140, 154, 170), width=2)
    for k in range(-5, 6):
        y = cy - k * 56
        d.line([(132, y), (152, y)], fill=(230, 238, 245), width=3)
        d.text((40, y - 14), str(140 + k * 10), font=f_sm, fill=(220, 228, 236))
        d.line([(872, y), (892, y)], fill=(230, 238, 245), width=3)
        d.text((900, y - 14), str(2500 + k * 100), font=f_sm, fill=(220, 228, 236))
    d.rectangle([12, cy - 32, 158, cy + 32], fill=(6, 10, 16), outline=(245, 250, 255), width=4)
    d.text((34, cy - 20), '140', font=font(38, mono=True), fill=(255, 255, 255))
    d.rectangle([866, cy - 32, 1012, cy + 32], fill=(6, 10, 16), outline=(245, 250, 255), width=4)
    d.text((878, cy - 18), '2500', font=font(34, mono=True), fill=(255, 255, 255))
    for k in range(-2, 3):
        gy = cy + k * 52
        d.ellipse([848, gy - 6, 860, gy + 6], outline=(230, 238, 245), width=2)
        gx = cx + k * 52
        d.ellipse([gx - 6, 788, gx + 6, 800], outline=(230, 238, 245), width=2)
    d.polygon([(854, cy - 16), (866, cy), (854, cy + 16), (842, cy)], fill=(240, 78, 224))
    d.polygon([(cx, 782), (cx + 16, 794), (cx, 806), (cx - 16, 794)], fill=(240, 78, 224))
    d.rectangle([180, 28, 844, 104], fill=(16, 22, 30), outline=(84, 98, 114), width=2)
    f_fma = font(34, mono=True)
    d.text((225, 48), 'SPD', font=f_fma, fill=(76, 236, 134))
    d.text((468, 48), 'LOC', font=f_fma, fill=(76, 236, 134))
    d.text((710, 48), 'G/S', font=f_fma, fill=(76, 236, 134))
    d.rectangle([230, 842, 794, 988], fill=(24, 30, 38), outline=(120, 134, 150), width=2)
    d.text((406, 892), 'HDG 090', font=font(42, mono=True), fill=(245, 250, 255))
    d.text((34, 940), 'ILS 09  110.30', font=font(26, mono=True), fill=(240, 78, 224))
    d.text((776, 940), 'BARO 30.12', font=font(26, mono=True), fill=(90, 220, 255))
    return im


def nd():
    W, H = 1024, 1024
    im = Image.new('RGB', (W, H), (5, 9, 15))
    d = ImageDraw.Draw(im)
    cx, cy = 512, 830
    for r in (210, 420, 630):
        d.arc([cx - r, cy - r, cx + r, cy + r], 204, 336, fill=(185, 200, 215), width=3)
    for deg_a in range(-60, 65, 10):
        rad = math.radians(deg_a - 90)
        x0, y0 = cx + math.cos(rad) * 630, cy + math.sin(rad) * 630
        x1, y1 = cx + math.cos(rad) * 604, cy + math.sin(rad) * 604
        d.line([(x0, y0), (x1, y1)], fill=(225, 235, 245), width=3)
    d.line([(cx, cy), (cx, 150)], fill=(238, 82, 224), width=5)
    d.rectangle([cx - 10, 220, cx + 10, 266], outline=(245, 250, 255), width=3)
    d.text((cx + 22, 224), 'RW09', font=font(30, mono=True), fill=(76, 236, 134))
    d.polygon([(cx, cy - 28), (cx - 20, cy + 20), (cx + 20, cy + 20)], outline=(255, 216, 56), width=4)
    for wx, wy, rad_c, col_c in ((340, 490, 56, (18, 92, 62)), (690, 440, 48, (18, 84, 58)), (610, 310, 34, (130, 110, 24))):
        d.ellipse([wx - rad_c, wy - rad_c, wx + rad_c, wy + rad_c], fill=col_c)
    for nm, (x, y) in (('CF09', (cx, 540)), ('FINGR', (360, 590)), ('GLIDE', (660, 480)), ('VORTX', (310, 410))):
        d.polygon([(x, y - 9), (x + 9, y), (x, y + 9), (x - 9, y)], fill=(90, 210, 255))
        d.text((x + 14, y - 12), nm, font=font(24, mono=True), fill=(170, 220, 255))
    d.text((34, 34), 'GS 140   TAS 142', font=font(32, mono=True), fill=(240, 246, 252))
    d.text((34, 78), '080° / 09 KT', font=font(28, mono=True), fill=(150, 215, 255))
    d.text((730, 34), 'ILS 09', font=font(32, mono=True), fill=(238, 82, 224))
    d.text((730, 78), '4.2 NM', font=font(28, mono=True), fill=(240, 246, 252))
    return im


def eicas():
    W, H = 1024, 1024
    im = Image.new('RGB', (W, H), (5, 9, 15))
    d = ImageDraw.Draw(im)
    f_l = font(28, mono=True)
    f_v = font(32, mono=True)
    for row, (label, vals, unit_col) in enumerate((
        ('N1', (64.2, 64.5, 64.1, 64.4), (76, 236, 134)),
        ('EGT', (512, 518, 515, 510), (240, 246, 252)),
    )):
        cy = 180 + row * 250
        d.text((482, cy + 94), label, font=f_l, fill=(130, 175, 215))
        for i in range(4):
            cx = 150 + i * 240
            r = 84
            d.arc([cx - r, cy - r, cx + r, cy + r], 140, 380, fill=(210, 222, 235), width=4)
            frac = 0.58 if row == 0 else 0.52
            ang = math.radians(140 + frac * 240)
            d.line([(cx, cy), (cx + math.cos(ang) * r, cy + math.sin(ang) * r)], fill=(255, 255, 255), width=6)
            d.rectangle([cx - 54, cy + 20, cx + 54, cy + 64], fill=(12, 18, 26), outline=(140, 155, 172), width=2)
            d.text((cx - 42, cy + 26), f'{vals[i]:.1f}' if row == 0 else str(vals[i]), font=f_v, fill=unit_col)
    d.line([(40, 610), (984, 610)], fill=(70, 86, 104), width=3)
    d.text((64, 650), 'GEAR    DOWN  3 GREEN', font=font(34, mono=True), fill=(76, 236, 134))
    d.text((64, 718), 'FLAPS   30', font=font(34, mono=True), fill=(76, 236, 134))
    d.text((64, 786), 'ANTI-ICE  ENG + WING ON', font=font(30, mono=True), fill=(95, 215, 255))
    d.text((64, 866), 'TAT -04C     TOTAL FUEL 41.2 T', font=font(28, mono=True), fill=(235, 242, 248))
    d.text((64, 932), 'CAB ALT 1200  DIFF 0.1  RATE 0', font=font(26, mono=True), fill=(180, 198, 216))
    return im


def mcp():
    W, H = 1536, 160
    im = Image.new('RGB', (W, H), (36, 40, 48))
    d = ImageDraw.Draw(im)
    f_lbl = font(20, mono=True)
    f_val = font(48, mono=True)
    for x, lbl, val, lit in (
        (60, 'IAS/MACH', '140', True),
        (370, 'HDG SEL', '090', False),
        (680, 'ALTITUDE', '3000', True),
        (1000, 'VERT SPD', '-0700', False),
    ):
        d.text((x, 16), lbl, font=f_lbl, fill=(204, 212, 220))
        d.rectangle([x, 48, x + 210, 128], fill=(8, 10, 14), outline=(74, 82, 92), width=2)
        d.text((x + 14, 62), val, font=f_val, fill=(255, 190, 76))
        d.rectangle([x + 228, 74, x + 276, 98], fill=(90, 245, 145) if lit else (22, 28, 34))
    for i, lbl in enumerate(('LOC', 'APP', 'CMD')):
        bx = 1300 + i * 74
        d.text((bx + 6, 36), lbl, font=f_lbl, fill=(210, 218, 226))
        d.rectangle([bx, 72, bx + 60, 106], fill=(90, 245, 145))
    return im


# ------------------------------------------------------------------------------------------------ 747SP skin maps
def b747_panel_maps():
    """Generate 2048x2048 tileable aircraft aluminum panel-seam, access-hatch, rivet-row bump map
    and matching panel-to-panel roughness/weathering map for box projection onto b747.glb."""
    W = H = 2048
    rng = random.Random(747)
    bump = Image.new('L', (W, H), 192)
    rough = Image.new('L', (W, H), 76)
    db = ImageDraw.Draw(bump)
    dr = ImageDraw.Draw(rough)

    rows = [0, 256, 512, 768, 1024, 1280, 1536, 1792, 2048]
    for ri in range(len(rows) - 1):
        y0, y1 = rows[ri], rows[ri + 1]
        offset = 0 if (ri % 2 == 0) else 256
        cols = [0] + sorted(c for c in range(offset, W, 512) if 0 < c < W) + [W]
        for ci in range(len(cols) - 1):
            x0, x1 = cols[ci], cols[ci + 1]
            b_val = rng.randint(184, 206)
            r_val = rng.randint(58, 96)
            db.rectangle([x0, y0, x1, y1], fill=b_val)
            dr.rectangle([x0, y0, x1, y1], fill=r_val)
            for _ in range(5):
                sy = rng.randint(y0 + 12, y1 - 12)
                sx0 = rng.randint(x0 + 8, max(x0 + 10, x1 - 80))
                sx1 = min(x1 - 4, sx0 + rng.randint(50, 240))
                dr.line([(sx0, sy), (sx1, sy)], fill=min(155, r_val + rng.randint(18, 42)), width=rng.randint(2, 5))

    for y in rows[:-1]:
        db.rectangle([0, y, W, y + 3], fill=34)
        dr.rectangle([0, y, W, y + 5], fill=180)
        for rx in range(10, W, 18):
            for ry in (y + 11, (y - 10) % H):
                db.ellipse([rx - 2, ry - 2, rx + 2, ry + 2], fill=118)
                dr.ellipse([rx - 2, ry - 2, rx + 2, ry + 2], fill=125)

    for ri in range(len(rows) - 1):
        y0, y1 = rows[ri], rows[ri + 1]
        offset = 0 if (ri % 2 == 0) else 256
        for x in range(offset, W, 512):
            db.rectangle([x, y0, x + 3, y1], fill=38)
            dr.rectangle([x, y0, x + 5, y1], fill=175)
            for ry in range(y0 + 14, y1 - 10, 18):
                for rx in ((x + 11) % W, (x - 10) % W):
                    db.ellipse([rx - 2, ry - 2, rx + 2, ry + 2], fill=120)

    hatches = (
        (140, 310, 260, 430),
        (1160, 820, 1340, 960),
        (660, 1330, 800, 1460),
        (1640, 1590, 1820, 1730),
        (360, 1840, 480, 1960),
    )
    for x0, y0, x1, y1 in hatches:
        db.rectangle([x0, y0, x1, y1], outline=24, width=4)
        dr.rectangle([x0, y0, x1, y1], outline=195, width=5)
        for rx in range(x0 + 12, x1 - 8, 16):
            db.ellipse([rx - 2, y0 + 8, rx + 2, y0 + 12], fill=95)
            db.ellipse([rx - 2, y1 - 12, rx + 2, y1 - 8], fill=95)
        for ry in range(y0 + 16, y1 - 12, 16):
            db.ellipse([x0 + 8, ry - 2, x0 + 12, ry + 2], fill=95)
            db.ellipse([x1 - 12, ry - 2, x1 - 8, ry + 2], fill=95)

    bump = bump.filter(ImageFilter.GaussianBlur(radius=0.55))
    rough = rough.filter(ImageFilter.GaussianBlur(radius=0.8))
    return bump, rough


# ------------------------------------------------------------------------------------------------ FAA ATC monitors
def atc_stars():
    """FAA STARS terminal radar display (1024x1024)."""
    W = H = 1024
    im = Image.new('RGB', (W, H), (3, 7, 10))
    d = ImageDraw.Draw(im)
    cx, cy = 540, 520
    rng = random.Random(301)
    for bx, by, r in ((280, 320, 110), (770, 290, 90), (220, 720, 85)):
        for _ in range(140):
            ang = rng.uniform(0, 6.283)
            rr = rng.uniform(0, r)
            px, py = bx + math.cos(ang) * rr, by + math.sin(ang) * rr
            d.rectangle([px, py, px + 5, py + 5], fill=(10, 42, 48))
    for r in (110, 220, 330, 440):
        d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(24, 72, 62), width=2)
    for deg_a in range(0, 360, 30):
        rad = math.radians(deg_a)
        d.line([(cx, cy), (cx + math.cos(rad) * 460, cy + math.sin(rad) * 460)], fill=(14, 42, 38), width=1)
    d.line([(cx - 320, cy), (cx + 120, cy)], fill=(48, 168, 128), width=3)
    d.rectangle([cx - 6, cy - 5, cx + 66, cy + 5], fill=(120, 240, 185))
    for k in range(1, 7):
        tx = cx - k * 48
        d.line([(tx, cy - 10), (tx, cy + 10)], fill=(48, 168, 128), width=2)
    d.ellipse([cx - 115, cy - 38, cx - 35, cy + 38], outline=(255, 68, 52), width=3)
    d.text((cx - 135, cy + 44), 'FLOCK 60+  RW09 FINAL', font=font(18, mono=True), fill=(255, 86, 68))
    f_db = font(19, mono=True)
    targets = (
        (cx - 135, cy, 'SKY902H', '003  14', (255, 198, 64), (36, -54)),
        (cx - 270, cy + 8, 'DAL412', '024  18', (110, 255, 168), (-95, -52)),
        (cx + 210, cy - 140, 'UAL88', '062  24', (110, 255, 168), (28, -42)),
        (cx + 170, cy + 175, 'AAL309', '038  21', (110, 255, 168), (28, 18)),
        (cx - 180, cy - 230, 'JBU114', '045  22', (92, 220, 255), (-110, -40)),
        (cx + 295, cy + 40, 'FDX81', '051  23', (110, 255, 168), (24, -36)),
    )
    for tx, ty, cs, line2, col, (dx, dy) in targets:
        d.ellipse([tx - 6, ty - 6, tx + 6, ty + 6], outline=col, width=2)
        d.line([(tx, ty), (tx + dx, ty + dy)], fill=col, width=2)
        d.text((tx + dx + 4, ty + dy - 16), cs, font=f_db, fill=col)
        d.text((tx + dx + 4, ty + dy + 6), line2, font=f_db, fill=col)
    d.rectangle([0, 0, W, 56], fill=(10, 18, 24))
    d.text((22, 16), 'STARS  KEWR-SIM  06:41:18 UTC   BARO 30.12   RWY 09 ILS   RNG 20NM', font=font(20, mono=True), fill=(110, 255, 168))
    d.rectangle([16, H - 56, 360, H - 14], fill=(115, 18, 16), outline=(255, 76, 62), width=2)
    d.text((28, H - 46), 'ALERT: WILDLIFE RWY 09 FINAL', font=font(18, mono=True), fill=(255, 245, 240))
    return im


def atc_asdex():
    """FAA ASDE-X airport surface movement radar (1024x1024)."""
    W = H = 1024
    im = Image.new('RGB', (W, H), (14, 18, 22))
    d = ImageDraw.Draw(im)
    d.rectangle([90, 480, 930, 540], fill=(74, 80, 88), outline=(170, 180, 192), width=2)
    d.rectangle([110, 320, 910, 356], fill=(56, 62, 70), outline=(120, 130, 140), width=1)
    for tx in (130, 360, 610, 880):
        d.rectangle([tx, 356, tx + 34, 480], fill=(56, 62, 70))
    d.polygon([(260, 150), (760, 150), (800, 320), (220, 320)], fill=(44, 50, 58))
    d.rectangle([340, 120, 680, 195], fill=(82, 92, 108), outline=(140, 156, 176), width=2)
    f_m = font(22, mono=True)
    d.text((104, 498), '09', font=f_m, fill=(245, 250, 255))
    d.text((882, 498), '27', font=f_m, fill=(245, 250, 255))
    d.text((480, 326), 'TWY ALPHA', font=font(18, mono=True), fill=(235, 205, 85))
    for tx in (130, 360, 610, 880):
        d.line([(tx, 474), (tx + 34, 474)], fill=(255, 56, 44), width=5)
    for x, y, cs, col in (
        (46, 510, 'SKY902H (APP)', (255, 92, 68)),
        (376, 430, 'SWA442 HOLD', (255, 220, 72)),
        (590, 338, 'UAL218', (90, 240, 145)),
        (410, 245, 'DAL901 GATE B4', (90, 210, 255)),
        (720, 445, 'OPS-1 WILDLIFE', (255, 165, 62)),
    ):
        d.rectangle([x - 10, y - 6, x + 10, y + 6], fill=col)
        d.text((x + 14, y - 12), cs, font=font(18, mono=True), fill=col)
    d.rectangle([0, 0, W, 56], fill=(10, 14, 18))
    d.text((22, 16), 'ASDE-X SURFACE RADAR   RWY 09 ACTIVE   RWSL: ARMED   06:41:18Z', font=font(20, mono=True), fill=(245, 214, 96))
    return im


def atc_tfdm():
    """FAA TFDM electronic flight strip bay (1024x768)."""
    W, H = 1024, 768
    im = Image.new('RGB', (W, H), (14, 18, 24))
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, W, 52], fill=(22, 30, 42))
    d.text((20, 14), 'TFDM  ELECTRONIC FLIGHT STRIPS   RWY 09 ARR / DEP', font=font(22, mono=True), fill=(235, 244, 252))
    cols = ((18, 504, 'LOCAL ARRIVAL BAY · RWY 09'), (520, 1006, 'DEPARTURE / TAXI QUEUE'))
    for x0, x1, title in cols:
        d.rectangle([x0, 66, x1, 104], fill=(28, 38, 52))
        d.text((x0 + 14, 74), title, font=font(18, mono=True), fill=(155, 205, 248))
    arr_strips = (
        ('SKY902H', 'B74S/H', 'RW09', 'GO-AROUND', (235, 86, 68), (255, 245, 240)),
        ('DAL412',  'A321/L', 'RW09', 'FINAL 6NM', (224, 212, 178), (18, 22, 28)),
        ('UAL88',   'B77W/H', 'RW09', 'BASE  11NM', (224, 212, 178), (18, 22, 28)),
        ('AAL309',  'B738/L', 'RW09', 'DOWNWIND', (224, 212, 178), (18, 22, 28)),
        ('JBU114',  'A220/L', 'RW09', 'STAR 18NM', (224, 212, 178), (18, 22, 28)),
        ('FDX81',   'B763/H', 'RW09', 'SEQ  22NM', (224, 212, 178), (18, 22, 28)),
    )
    dep_strips = (
        ('SWA442', 'B738/L', 'TWY A', 'HOLD SHORT 09', (178, 216, 238), (16, 22, 30)),
        ('UAL218', 'A320/L', 'TWY A', 'TAXI OUT', (178, 216, 238), (16, 22, 30)),
        ('DAL901', 'B752/L', 'GATE B4', 'PUSH APPROVED', (178, 216, 238), (16, 22, 30)),
        ('NKS504', 'A32N/L', 'GATE C2', 'CLR DEL', (178, 216, 238), (16, 22, 30)),
        ('OPS-1',  'TRUCK',  'APRON', 'WILDLIFE RESP', (242, 194, 96), (20, 20, 24)),
    )
    f_cs = font(26, mono=True)
    f_sub = font(18, mono=True)
    for col_i, strips in enumerate((arr_strips, dep_strips)):
        x0 = 24 if col_i == 0 else 526
        for idx, (cs, typ, loc, stat, bg, fg) in enumerate(strips):
            y0 = 118 + idx * 102
            d.rectangle([x0, y0, x0 + 474, y0 + 88], fill=bg, outline=(70, 82, 96), width=2)
            d.text((x0 + 14, y0 + 10), cs, font=f_cs, fill=fg)
            d.text((x0 + 160, y0 + 14), typ, font=f_sub, fill=fg)
            d.text((x0 + 290, y0 + 14), loc, font=f_sub, fill=fg)
            d.text((x0 + 14, y0 + 50), stat, font=f_sub, fill=fg)
    return im


def atc_ids4():
    """FAA IDS4 airfield status, ATIS, weather & NOTAM board (1024x768)."""
    W, H = 1024, 768
    im = Image.new('RGB', (W, H), (8, 14, 24))
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, W, 58], fill=(18, 34, 58))
    d.text((22, 16), 'IDS4  AIRPORT STATUS   ATIS INFO BRAVO   06:41:18Z', font=font(24, mono=True), fill=(255, 255, 255))
    cards = (
        (24, 80, 496, 250, 'WIND · RWY 09', '080° / 09 KT', 'GUST 12 · XWIND 02L', (96, 232, 255)),
        (524, 80, 1000, 250, 'ALTIMETER / RVR', '30.12 inHg', 'RVR 09: 5500 FT', (90, 245, 150)),
        (24, 272, 496, 442, 'CEILING / VIS', 'OVC 014 · 4SM', '-SN BR · TEMP -04/-06C', (235, 242, 250)),
        (524, 272, 1000, 442, 'WILDLIFE ADVISORY', 'CRITICAL · RW09', 'FLOCK + DRONE ON FINAL', (255, 82, 66)),
    )
    for x0, y0, x1, y1, title, big, sub, col in cards:
        d.rectangle([x0, y0, x1, y1], fill=(14, 22, 34), outline=(54, 76, 104), width=2)
        d.text((x0 + 18, y0 + 14), title, font=font(18, mono=True), fill=(150, 178, 208))
        d.text((x0 + 18, y0 + 56), big, font=font(42, mono=True), fill=col)
        d.text((x0 + 18, y0 + 124), sub, font=font(22, mono=True), fill=(210, 224, 238))
    d.rectangle([24, 466, 1000, 742], fill=(12, 18, 28), outline=(54, 76, 104), width=2)
    d.text((42, 484), 'ACTIVE RUNWAY & NOTAM SUMMARY', font=font(20, mono=True), fill=(150, 195, 240))
    lines = (
        '* RWY 09/27: WET SNOW PATCHES · BRAKING ACTION GOOD TO MEDIUM',
        '* ILS RWY 09 CAT II OPERATIONAL · ALSF-2 STEP 4 · PAPI 3.0 DEG',
        '* SKY SENTRY CAM 02 ONLINE: BIRDS + UNAUTHORIZED UAV DETECTED',
        '* WILDLIFE OPS-1 DISPATCHED TO RWY 09 APPROACH PERIMETER',
    )
    for i, ln in enumerate(lines):
        d.text((42, 532 + i * 48), ln, font=font(21, mono=True), fill=(255, 196, 86) if i == 2 else (220, 232, 244))
    return im


def atc_weather():
    """ITWS / LLWAS winter snow Doppler radar & wind-shear panel (1024x768)."""
    W, H = 1024, 768
    im = Image.new('RGB', (W, H), (8, 12, 18))
    d = ImageDraw.Draw(im)
    rng = random.Random(512)
    cx, cy = 440, 410
    for bx, by, rad, col in (
        (260, 290, 150, (16, 76, 118)),
        (380, 360, 130, (24, 112, 154)),
        (550, 480, 140, (20, 96, 112)),
        (330, 330, 62, (62, 178, 152)),
    ):
        for _ in range(180):
            a = rng.uniform(0, 6.283)
            r = rng.uniform(0, rad)
            px, py = bx + math.cos(a) * r, by + math.sin(a) * r
            d.rectangle([px, py, px + 8, py + 8], fill=col)
    for r in (90, 180, 270):
        d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(76, 102, 126), width=2)
    d.line([(cx - 110, cy), (cx + 110, cy)], fill=(255, 255, 255), width=4)
    d.rectangle([0, 0, W, 52], fill=(16, 26, 38))
    d.text((20, 14), 'ITWS / LLWAS   WINTER DOPPLER RADAR   WIND SHEAR: NONE', font=font(21, mono=True), fill=(130, 224, 255))
    d.rectangle([736, 74, 1004, 742], fill=(12, 18, 26), outline=(56, 76, 98), width=2)
    d.text((754, 92), 'LLWAS SENSORS', font=font(20, mono=True), fill=(160, 200, 235))
    for i, (nm, v) in enumerate((('CF', '080/09'), ('RW09', '082/10'), ('RW27', '078/08'), ('NE', '075/11'), ('SW', '085/09'))):
        d.text((754, 146 + i * 54), f'{nm:<5} {v} KT', font=font(22, mono=True), fill=(92, 240, 160))
    d.text((754, 460), 'SNOW RATE: LIGHT', font=font(20, mono=True), fill=(170, 225, 255))
    d.text((754, 510), 'CLOUD BASE: 1400 FT', font=font(20, mono=True), fill=(220, 232, 245))
    return im


def atc_sentry_alert():
    """Sky Sentry primary tower console monitor: live detection feed + Signal-blue boxes + RED ALERT."""
    W, H = 1024, 768
    im = Image.new('RGB', (W, H), (7, 11, 18))
    d = ImageDraw.Draw(im)
    d.rectangle([4, 4, W - 5, H - 5], outline=(255, 58, 48), width=8)
    d.text((28, 24), 'SKY SENTRY', font=font(34, mono=True), fill=(255, 255, 255))
    d.text((255, 32), 'CAM 02 · RWY 09 FINAL · LIVE', font=font(22, mono=True), fill=(154, 186, 218))
    d.ellipse([936, 28, 960, 52], fill=(255, 58, 48))
    d.text((878, 30), 'REC', font=font(22, mono=True), fill=(255, 90, 82))
    fx0, fy0, fx1, fy1 = 28, 86, 690, 560
    for y in range(fy0, fy1):
        t = (y - fy0) / float(fy1 - fy0)
        if t < 0.65:
            k = t / 0.65
            c = (int(28 + 115 * k), int(44 + 86 * k), int(76 + 68 * k))
        else:
            c = (155, 168, 184)
        d.line([(fx0, y), (fx1, y)], fill=c)
    d.polygon([(fx0 + 70, fy0 + 90), (fx1 - 30, fy0 + 250), (fx1 - 30, fy0 + 360), (fx0 + 70, fy0 + 230)],
              outline=(169, 203, 227), width=2)
    rng = random.Random(2026)
    sig = (47, 111, 228)
    for i in range(28):
        bx = rng.randint(fx0 + 110, fx1 - 90)
        by = rng.randint(fy0 + 120, fy0 + 320)
        d.ellipse([bx - 7, by - 3, bx + 7, by + 3], fill=(22, 24, 28))
        d.rectangle([bx - 16, by - 13, bx + 16, by + 13], outline=sig, width=2)
        d.line([(bx - 24, by + 6), (bx, by)], fill=(120, 175, 255), width=1)
        if i % 4 == 0:
            d.rectangle([bx - 16, by - 28, bx + 34, by - 13], fill=sig)
            d.text((bx - 12, by - 27), f'B-{i + 1:02d}', font=font(12, mono=True), fill=(255, 255, 255))
    dx, dy = fx1 - 125, fy0 + 355
    d.rectangle([dx - 24, dy - 18, dx + 24, dy + 18], outline=(255, 255, 255), width=2)
    d.rectangle([dx - 24, dy - 36, dx + 68, dy - 18], fill=(255, 255, 255))
    d.text((dx - 20, dy - 35), 'DRONE D-01', font=font(13, mono=True), fill=(15, 27, 38))
    d.rectangle([fx0, fy0, fx1, fy1], outline=(255, 58, 48), width=4)
    px = 716
    d.text((px, 92), 'TRACKED OBJECTS', font=font(18, mono=True), fill=(142, 168, 198))
    d.text((px, 122), '61', font=font(64, mono=True), fill=(255, 255, 255))
    d.text((px, 206), '60 GEESE · 1 UAV', font=font(18, mono=True), fill=(169, 203, 227))
    d.text((px, 260), 'RUNWAY RISK', font=font(18, mono=True), fill=(142, 168, 198))
    d.text((px, 290), 'HIGH', font=font(44, mono=True), fill=(255, 64, 54))
    for i in range(14):
        c = (60, 220, 132) if i < 5 else ((255, 194, 60) if i < 9 else (255, 58, 48))
        d.rectangle([px + i * 20, 354, px + i * 20 + 15, 378], fill=c)
    d.text((px, 408), 'CORRIDOR DIST', font=font(18, mono=True), fill=(142, 168, 198))
    d.text((px, 438), '18 M TO CL', font=font(28, mono=True), fill=(255, 210, 96))
    d.text((px, 496), 'SOLANA MEMO', font=font(18, mono=True), fill=(142, 168, 198))
    d.text((px, 524), 'HASH STAMPED', font=font(20, mono=True), fill=(104, 232, 168))
    d.rectangle([16, 594, W - 16, H - 18], fill=(220, 34, 28))
    d.text((38, 636), 'BIRDS ON FINAL · RWY 09 · ISSUE GO AROUND', font=font(36, mono=True), fill=(255, 255, 255))
    d.text((38, 696), 'VOICE ALERT PLAYED · GEMINI INCIDENT REPORT LOGGED', font=font(22, mono=True), fill=(255, 228, 224))
    return im


def atc_comms():
    """FAA VCSS touchscreen frequency & airfield lighting control panel (1024x768)."""
    W, H = 1024, 768
    im = Image.new('RGB', (W, H), (12, 16, 22))
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, W, 52], fill=(24, 32, 44))
    d.text((22, 14), 'VCSS  VOICE COMM & AIRFIELD LIGHTING   LOCAL POS 1', font=font(21, mono=True), fill=(235, 242, 250))
    freqs = (
        ('TWR LOCAL', '118.300', True, (36, 130, 74)),
        ('GND CTRL',  '121.900', True, (36, 130, 74)),
        ('APPROACH',  '124.200', False, (30, 44, 62)),
        ('DEPARTURE', '128.550', False, (30, 44, 62)),
        ('ATIS VHF',  '127.650', True, (34, 86, 138)),
        ('GUARD',     '121.500', True, (152, 40, 34)),
        ('OPS-1',     '129.850', True, (148, 102, 26)),
        ('FIRE/ARFF', '131.100', False, (30, 44, 62)),
    )
    for idx, (nm, frq, on, col) in enumerate(freqs):
        x0 = 28 + (idx % 4) * 246
        y0 = 78 + (idx // 4) * 164
        d.rectangle([x0, y0, x0 + 226, y0 + 144], fill=col, outline=(120, 146, 174), width=2)
        d.text((x0 + 16, y0 + 18), nm, font=font(20, mono=True), fill=(220, 232, 244))
        d.text((x0 + 16, y0 + 62), frq, font=font(34, mono=True), fill=(255, 255, 255))
        d.text((x0 + 16, y0 + 110), 'TX / RX' if on else 'STBY', font=font(16, mono=True), fill=(220, 255, 230) if on else (140, 156, 172))
    d.rectangle([28, 434, 996, 738], fill=(16, 22, 32), outline=(64, 82, 104), width=2)
    d.text((48, 452), 'AIRFIELD LIGHTING · RWY 09/27', font=font(20, mono=True), fill=(160, 206, 246))
    for i, (sys_n, step) in enumerate((('ALSF-2 APPROACH', 4), ('RWY 09 EDGE', 4), ('PAPI 09 (3.0°)', 5), ('TWY ALPHA BLUE', 3))):
        y = 506 + i * 54
        d.text((48, y + 6), sys_n, font=font(21, mono=True), fill=(225, 235, 245))
        for s in range(1, 6):
            bx = 360 + (s - 1) * 116
            active = (s == step)
            d.rectangle([bx, y, bx + 98, y + 36], fill=(47, 111, 228) if active else (26, 34, 46), outline=(92, 112, 136), width=2)
            d.text((bx + 20, y + 7), f'STP {s}', font=font(18, mono=True), fill=(255, 255, 255) if active else (130, 148, 168))
    return im


def atc_flightplan():
    """TBFM arrival metering timeline & Sky Sentry incident log (1024x768)."""
    W, H = 1024, 768
    im = Image.new('RGB', (W, H), (9, 13, 20))
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, W, 52], fill=(20, 30, 44))
    d.text((22, 14), 'TBFM  ARRIVAL METERING · RWY 09   WILDLIFE LOG', font=font(21, mono=True), fill=(235, 244, 252))
    tx = 220
    d.line([(tx, 86), (tx, 720)], fill=(90, 148, 198), width=4)
    slots = (
        (130, '06:41', 'SKY902H  B74S  [GO AROUND]', (255, 86, 68)),
        (240, '06:44', 'DAL412   A321  6.2 NM FINAL', (104, 242, 164)),
        (350, '06:47', 'UAL88    B77W  11.4 NM BASE', (104, 242, 164)),
        (460, '06:50', 'AAL309   B738  15.0 NM', (145, 214, 255)),
        (570, '06:54', 'JBU114   A220  19.8 NM', (145, 214, 255)),
        (670, '06:58', 'FDX81    B763  24.1 NM', (145, 214, 255)),
    )
    for y, tm, txt, col in slots:
        d.line([(tx - 16, y), (tx + 16, y)], fill=col, width=3)
        d.text((78, y - 12), tm, font=font(22, mono=True), fill=(180, 196, 214))
        d.text((tx + 34, y - 14), txt, font=font(24, mono=True), fill=col)
    return im


# ------------------------------------------------------------------------------------------------ goose plumage
def goose_plumage():
    """Tileable 1024x1024 scalloped grey-brown Canada goose mantle & wing covert feather texture."""
    W = H = 1024
    rng = random.Random(902)
    im = Image.new('RGB', (W, H), (88, 76, 64))
    d = ImageDraw.Draw(im)
    rows = 22
    cols = 14
    rh = H / rows
    cw = W / cols
    for r in range(-1, rows + 2):
        ox = (cw * 0.5) if (r % 2) else 0.0
        for c in range(-1, cols + 2):
            cx = c * cw + ox
            cy = r * rh
            base = rng.randint(-12, 14)
            col_f = (max(48, min(130, 92 + base)), max(42, min(115, 78 + base)), max(34, min(98, 64 + base)))
            rim_f = (min(210, col_f[0] + 58), min(198, col_f[1] + 54), min(184, col_f[2] + 48))
            bbox = [cx - cw * 0.54, cy - rh * 0.55, cx + cw * 0.54, cy + rh * 0.85]
            d.ellipse(bbox, fill=col_f, outline=rim_f, width=3)
            d.line([(cx, cy - rh * 0.35), (cx, cy + rh * 0.65)],
                   fill=(max(28, col_f[0] - 24), max(24, col_f[1] - 20), max(20, col_f[2] - 18)), width=2)
    return im.filter(ImageFilter.GaussianBlur(radius=0.6))


# ------------------------------------------------------------------------------------------------ main
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
    eicas().save(os.path.join(a.out, 'eicas.png'))
    mcp().save(os.path.join(a.out, 'mcp.png'))

    b747_b, b747_r = b747_panel_maps()
    b747_b.save(os.path.join(a.out, 'b747_panels_bump.png'))
    b747_r.save(os.path.join(a.out, 'b747_panels_rough.png'))

    atc_stars().save(os.path.join(a.out, 'atc_stars.png'))
    atc_asdex().save(os.path.join(a.out, 'atc_asdex.png'))
    atc_tfdm().save(os.path.join(a.out, 'atc_tfdm.png'))
    atc_ids4().save(os.path.join(a.out, 'atc_ids4.png'))
    atc_weather().save(os.path.join(a.out, 'atc_weather.png'))
    atc_sentry_alert().save(os.path.join(a.out, 'atc_sentry_alert.png'))
    atc_comms().save(os.path.join(a.out, 'atc_comms.png'))
    atc_flightplan().save(os.path.join(a.out, 'atc_flightplan.png'))

    goose_plumage().save(os.path.join(a.out, 'goose_plumage.png'))
    print('wrote textures to', a.out)


if __name__ == '__main__':
    main()
