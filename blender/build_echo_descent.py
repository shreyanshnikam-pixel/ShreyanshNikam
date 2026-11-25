"""Echo descent film for the Echo page opening (plan.md 4.5 and 7).

Time-normalized over args.f0..args.f1 and args.fps so both standard (144 frames @ 24 fps = 6.0 s)
and ultra high-speed (1200-2000 frames @ 240 fps, 4K/8K) Cycles renders work identically.

Story (normalized progress t in [0.0 .. 1.0]):
    0.00 - 0.19  above the icy world surface: snowfield, distant jagged peaks, cold Nishita sky,
                 approaching the yawning glacial crevasse
    0.17 - 0.47  descending into the refractive ice cave: thick glacial ice (IOR 1.31, icy blue
                 volume attenuation, SSS + spectral dispersion tint, specular frost coat),
                 icicles, faint heterogeneous volumetric frost mist and drifting snow motes
    0.45 - 0.71  seamless 3D-noise transition from refractive ice into dark wet mine rock as
                 surface daylight dies away
    0.68 - 1.00  entering the abandoned mine: rugged damp rock walls with micro-normal bump,
                 rotting timber sets, rusted steel rails on wooden sleepers, hanging chains,
                 reflective dark floor puddles, fallen rock debris, and the pitch-black abyss
                 ahead matching Echo's real-time opening

Coordinate system (Blender Z-up):
    Surface snowfield at Z = 0.0; tunnel runs forward along +Y and descends along -Z into the
    horizontal mine (Z ~ -28..-29.5 m, Y = 46..94 m), capped at the far end so zero sky light
    leaks into the abyss.

Run (from the repo root):
    blender -b -P blender/build_echo_descent.py -- --out renders/echo_descent --res desktop --frames 1-144
    blender -b -P blender/build_echo_descent.py -- --out renders/echo_descent --res portrait --frames 1-144
    blender -b -P blender/build_echo_descent.py -- --out renders/echo_descent --preset 8k240 --frames 1-1440
    blender -b -P blender/build_echo_descent.py -- --preview --save renders/echo_descent/echo_descent.blend
"""
import math
import os
import random
import sys

import bpy
import bmesh
from mathutils import Euler, Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)) if '__file__' in globals() else os.getcwd())
import common as C  # noqa: E402

DEFAULT_FRAMES = 144

# Centerline control points (X, Y, Z) in metres: crevasse mouth -> ice chute -> mine -> abyss
SPLINE_PTS = [
    Vector((0.0, -4.0, -5.0)),
    Vector((0.1, 2.0, -7.5)),
    Vector((0.35, 9.0, -11.0)),
    Vector((0.1, 16.0, -15.2)),
    Vector((-0.85, 23.0, -19.8)),
    Vector((-1.35, 30.0, -23.6)),
    Vector((-0.55, 37.5, -26.4)),
    Vector((0.75, 45.0, -27.9)),
    Vector((1.45, 53.0, -28.4)),
    Vector((1.05, 61.5, -28.6)),
    Vector((-0.35, 70.0, -28.9)),
    Vector((-1.25, 79.0, -29.2)),
    Vector((-0.8, 88.0, -29.5)),
    Vector((0.2, 96.0, -29.8)),
]

# Y coordinates of key zones along the tunnel
Y_CREVASSE_END = 14.0
Y_TRANS_START = 32.0
Y_TRANS_END = 45.0
Y_MINE_START = 44.0
Y_MINE_END = 94.0


def extra_args(p):
    p.add_argument('--sun-elevation', type=float, default=22.0, help='winter sun elevation in degrees')
    p.add_argument('--sun-azimuth', type=float, default=155.0, help='sun azimuth in degrees')
    p.add_argument('--fog-density', type=float, default=0.026, help='volumetric frost mist density in ice cave')
    p.add_argument('--no-mist', action='store_true', help='skip volumetric frost mist (faster render)')


# --------------------------------------------------------------------------------------------------
# Math & spline utilities (pure Python + mathutils, deterministic)
# --------------------------------------------------------------------------------------------------
def clamp(v, lo=0.0, hi=1.0):
    return lo if v < lo else (hi if v > hi else v)


def smoothstep(e0, e1, x):
    if e0 == e1:
        return 0.0 if x < e0 else 1.0
    t = clamp((x - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def lerp(a, b, t):
    return a + (b - a) * t


def _hash3(ix, iy, iz):
    n = math.sin(ix * 127.1 + iy * 311.7 + iz * 74.7) * 43758.5453123
    return n - math.floor(n)


def vnoise(x, y, z):
    ix, iy, iz = math.floor(x), math.floor(y), math.floor(z)
    fx, fy, fz = x - ix, y - iy, z - iz
    ux = fx * fx * (3.0 - 2.0 * fx)
    uy = fy * fy * (3.0 - 2.0 * fy)
    uz = fz * fz * (3.0 - 2.0 * fz)
    c000 = _hash3(ix, iy, iz)
    c100 = _hash3(ix + 1, iy, iz)
    c010 = _hash3(ix, iy + 1, iz)
    c110 = _hash3(ix + 1, iy + 1, iz)
    c001 = _hash3(ix, iy, iz + 1)
    c101 = _hash3(ix + 1, iy, iz + 1)
    c011 = _hash3(ix, iy + 1, iz + 1)
    c111 = _hash3(ix + 1, iy + 1, iz + 1)
    x00 = lerp(c000, c100, ux)
    x10 = lerp(c010, c110, ux)
    x01 = lerp(c001, c101, ux)
    x11 = lerp(c011, c111, ux)
    return lerp(lerp(x00, x10, uy), lerp(x01, x11, uy), uz)


def fbm(x, y, z, octaves=4):
    val, amp, freq, norm = 0.0, 0.5, 1.0, 0.0
    for _ in range(octaves):
        val += amp * vnoise(x * freq, y * freq, z * freq)
        norm += amp
        amp *= 0.5
        freq *= 2.03
    return val / norm


class SplinePath:
    """Uniformly sampled Catmull-Rom spline with stable Z-up local frames (side, up, forward)."""

    def __init__(self, pts, samples=600):
        self.pts = [p.copy() for p in pts]
        self.table = []
        self.lengths = [0.0]
        n = len(self.pts) - 1
        prev = self.pts[0]
        self.table.append(prev.copy())
        for i in range(1, samples + 1):
            u = (i / samples) * n
            seg = min(int(u), n - 1)
            t = u - seg
            p0 = self.pts[max(0, seg - 1)]
            p1 = self.pts[seg]
            p2 = self.pts[min(n, seg + 1)]
            p3 = self.pts[min(n, seg + 2)]
            p = self._catmull(p0, p1, p2, p3, t)
            self.table.append(p)
            self.lengths.append(self.lengths[-1] + (p - prev).length)
            prev = p
        self.total_length = self.lengths[-1]

    @staticmethod
    def _catmull(p0, p1, p2, p3, t):
        t2 = t * t
        t3 = t2 * t
        return 0.5 * (
            (2.0 * p1)
            + (-p0 + p2) * t
            + (2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3) * t2
            + (-p0 + 3.0 * p1 - 3.0 * p2 + p3) * t3
        )

    def point_at_s(self, s):
        s = clamp(s, 0.0, self.total_length)
        lo, hi = 0, len(self.lengths) - 1
        while lo + 1 < hi:
            mid = (lo + hi) // 2
            if self.lengths[mid] <= s:
                lo = mid
            else:
                hi = mid
        d = self.lengths[hi] - self.lengths[lo]
        t = (s - self.lengths[lo]) / d if d > 1e-8 else 0.0
        return self.table[lo].lerp(self.table[hi], t)

    def frame_at_s(self, s):
        """Return (pos, side, up, fwd) where side points +X-ish, up points +Z-ish, fwd points +Y-ish."""
        ds = 0.25
        p = self.point_at_s(s)
        p0 = self.point_at_s(max(0.0, s - ds))
        p1 = self.point_at_s(min(self.total_length, s + ds))
        fwd = (p1 - p0).normalized()
        world_up = Vector((0.0, 0.0, 1.0))
        side = fwd.cross(world_up)
        if side.length < 1e-5:
            side = Vector((1.0, 0.0, 0.0))
        else:
            side.normalize()
        up = side.cross(fwd).normalized()
        return p, side, up, fwd

    def s_at_y(self, y_target):
        for i in range(1, len(self.table)):
            y0, y1 = self.table[i - 1].y, self.table[i].y
            if y1 >= y_target:
                t = (y_target - y0) / (y1 - y0) if abs(y1 - y0) > 1e-6 else 0.0
                return lerp(self.lengths[i - 1], self.lengths[i], clamp(t))
        return self.total_length

    def at(self, s, x_off=0.0, z_off=0.0):
        p, side, up, _ = self.frame_at_s(s)
        return p + side * x_off + up * z_off

    def basis_euler(self, s):
        """Euler rotation aligning local +X=side, +Y=fwd, +Z=up."""
        _, side, up, fwd = self.frame_at_s(s)
        m = Matrix((
            (side.x, fwd.x, up.x),
            (side.y, fwd.y, up.y),
            (side.z, fwd.z, up.z),
        ))
        return m.to_euler('XYZ')


def tunnel_profile(y):
    """Cross-section parameters (width, height, floor_half_width, noise_amp) along Y."""
    crevasse = 1.0 - smoothstep(4.0, 17.0, y)
    mine = smoothstep(34.0, 46.0, y)
    width = lerp(lerp(2.25, 2.75, mine), 2.1, crevasse)
    height = lerp(lerp(2.65, 2.95, mine), 11.5, crevasse)
    floor_hw = min(lerp(lerp(1.15, 1.95, mine), 0.85, crevasse), width * 0.82)
    amp = lerp(0.75, 1.15, mine)
    return width, height, floor_hw, amp


def crevasse_half_width(y):
    """Surface opening half-width along Y for the snowfield cutout (-1..14 m)."""
    if y < -1.5 or y > 14.5:
        return 0.0
    t = (y + 1.5) / 16.0
    envelope = math.sin(clamp(t, 0.0, 1.0) * math.pi) ** 0.72
    jitter = 0.82 + 0.36 * fbm(y * 0.35, 3.1, 1.7, 3)
    return 2.45 * envelope * jitter


def tex_path(*parts):
    p = os.path.join(C.repo_root(), 'assets', 'textures', *parts)
    return p if os.path.exists(p) else None


def separate_color_node(nt):
    """Blender 3.3+ uses ShaderNodeSeparateColor; older versions use ShaderNodeSeparateRGB."""
    try:
        return nt.nodes.new('ShaderNodeSeparateColor')
    except RuntimeError:
        return nt.nodes.new('ShaderNodeSeparateRGB')


def connect_normal_map(nt, img_node, bsdf, strength=1.0):
    nm = nt.nodes.new('ShaderNodeNormalMap')
    nm.inputs['Strength'].default_value = strength
    nt.links.new(img_node.outputs['Color'], nm.inputs['Color'])
    nt.links.new(nm.outputs['Normal'], bsdf.inputs['Normal'])
    return nm


# --------------------------------------------------------------------------------------------------
# Materials (physically based Cycles shaders)
# --------------------------------------------------------------------------------------------------
def snow_material():
    """Cold snowfield using Poly Haven snow_02 maps when available, with Random Walk SSS & micro sparkle."""
    mat = C.material('EchoSnow', Base_Color=(0.93, 0.96, 0.99, 1), Roughness=0.56,
                     Subsurface_Weight=0.28, Coat_Weight=0.18, Coat_Roughness=0.28,
                     Specular_IOR_Level=0.48)
    b = C.bsdf_of(mat)
    try:
        C.set_input(b, 'Subsurface Radius', (0.48, 0.74, 1.0))
        C.set_input(b, 'Subsurface Scale', 0.12)
    except Exception:
        pass
    nt = mat.node_tree
    tc = nt.nodes.new('ShaderNodeTexCoord')
    mp = nt.nodes.new('ShaderNodeMapping')
    mp.inputs['Scale'].default_value = (0.14, 0.14, 0.14)
    nt.links.new(tc.outputs['Object'], mp.inputs['Vector'])

    diff_p = tex_path('snow_diff.jpg')
    nor_p = tex_path('snow_nor_gl.jpg')
    rough_p = tex_path('snow_rough.jpg')
    if diff_p and nor_p and rough_p:
        diff = C.image_texture(nt, diff_p, non_color=False)
        nor = C.image_texture(nt, nor_p, non_color=True)
        rough = C.image_texture(nt, rough_p, non_color=True)
        for n in (diff, nor, rough):
            n.projection = 'BOX'
            n.projection_blend = 0.25
            nt.links.new(mp.outputs['Vector'], n.inputs['Vector'])
        nt.links.new(diff.outputs['Color'], b.inputs['Base Color'])
        nt.links.new(rough.outputs['Color'], b.inputs['Roughness'])
        connect_normal_map(nt, nor, b, strength=0.7)
    else:
        noise = nt.nodes.new('ShaderNodeTexNoise')
        noise.inputs['Scale'].default_value = 18.0
        noise.inputs['Detail'].default_value = 6.0
        bump = nt.nodes.new('ShaderNodeBump')
        bump.inputs['Strength'].default_value = 0.14
        nt.links.new(mp.outputs['Vector'], noise.inputs['Vector'])
        nt.links.new(noise.outputs['Fac'], bump.inputs['Height'])
        nt.links.new(bump.outputs['Normal'], b.inputs['Normal'])
    return mat


def glacial_ice_material(dissolve_y0=None, dissolve_y1=None):
    """Refractive glacial ice (IOR 1.31, icy blue volume attenuation, SSS, grazing dispersion tint).

    When dissolve_y0/dissolve_y1 are given, smoothly mixes to Transparent BSDF across that Y span
    with 3D noise so the ice cave walls dissolve organically into the rocky mine behind them.
    """
    mat = C.material('GlacialIce' if dissolve_y0 is None else 'GlacialIceCave',
                     Base_Color=(0.86, 0.93, 0.98, 1), Roughness=0.08, IOR=1.31,
                     Transmission_Weight=0.94, Subsurface_Weight=0.20,
                     Coat_Weight=0.75, Coat_Roughness=0.035, Specular_IOR_Level=0.58)
    b = C.bsdf_of(mat)
    try:
        C.set_input(b, 'Subsurface Radius', (0.32, 0.68, 0.98))
        C.set_input(b, 'Subsurface Scale', 0.25)
    except Exception:
        pass
    nt = mat.node_tree
    out = C.output_of(mat)
    tc = nt.nodes.new('ShaderNodeTexCoord')

    # Fresnel-weighted glacial dispersion tint (deep ice #5E8AAB at grazing angles, crystal clear straight-on)
    lw = nt.nodes.new('ShaderNodeLayerWeight')
    lw.inputs['Blend'].default_value = 0.35
    cr_col = nt.nodes.new('ShaderNodeValToRGB')
    cr_col.color_ramp.elements[0].position = 0.0
    cr_col.color_ramp.elements[0].color = (0.91, 0.96, 1.0, 1)
    cr_col.color_ramp.elements[1].position = 1.0
    cr_col.color_ramp.elements[1].color = (0.58, 0.78, 0.92, 1)
    nt.links.new(lw.outputs['Fresnel'], cr_col.inputs['Fac'])
    nt.links.new(cr_col.outputs['Color'], b.inputs['Base Color'])

    # Striated glacial roughness + frosted internal bands
    mp = nt.nodes.new('ShaderNodeMapping')
    mp.inputs['Scale'].default_value = (0.45, 0.45, 1.5)
    nt.links.new(tc.outputs['Object'], mp.inputs['Vector'])

    noise = nt.nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 1.9
    noise.inputs['Detail'].default_value = 9.0
    noise.inputs['Roughness'].default_value = 0.62
    nt.links.new(mp.outputs['Vector'], noise.inputs['Vector'])

    rough_mr = nt.nodes.new('ShaderNodeMapRange')
    rough_mr.inputs[1].default_value = 0.24
    rough_mr.inputs[2].default_value = 0.80
    rough_mr.inputs[3].default_value = 0.04
    rough_mr.inputs[4].default_value = 0.24
    nt.links.new(noise.outputs['Fac'], rough_mr.inputs[0])
    nt.links.new(rough_mr.outputs[0], b.inputs['Roughness'])

    # Multi-scale fractured ice micro-normal bump
    macro = nt.nodes.new('ShaderNodeTexVoronoi')
    macro.feature = 'DISTANCE_TO_EDGE'
    macro.inputs['Scale'].default_value = 2.6
    nt.links.new(tc.outputs['Object'], macro.inputs['Vector'])
    macro_bump = nt.nodes.new('ShaderNodeBump')
    macro_bump.inputs['Strength'].default_value = 0.16
    macro_bump.inputs['Distance'].default_value = 0.06
    nt.links.new(macro.outputs['Distance'], macro_bump.inputs['Height'])

    fine = nt.nodes.new('ShaderNodeTexNoise')
    fine.inputs['Scale'].default_value = 18.0
    fine.inputs['Detail'].default_value = 6.0
    nt.links.new(tc.outputs['Object'], fine.inputs['Vector'])
    fine_bump = nt.nodes.new('ShaderNodeBump')
    fine_bump.inputs['Strength'].default_value = 0.18
    fine_bump.inputs['Distance'].default_value = 0.04
    nt.links.new(fine.outputs['Fac'], fine_bump.inputs['Height'])
    nt.links.new(macro_bump.outputs['Normal'], fine_bump.inputs['Normal'])
    nt.links.new(fine_bump.outputs['Normal'], b.inputs['Normal'])

    # Volumetric icy-blue attenuation (#A9CBE3 -> #5E8AAB) inside the thick ice shell
    absorb = nt.nodes.new('ShaderNodeVolumeAbsorption')
    absorb.inputs['Color'].default_value = (0.56, 0.78, 0.92, 1)
    absorb.inputs['Density'].default_value = 0.38
    scat = nt.nodes.new('ShaderNodeVolumeScatter')
    scat.inputs['Color'].default_value = (0.66, 0.81, 0.90, 1)
    scat.inputs['Density'].default_value = 0.05
    scat.inputs['Anisotropy'].default_value = 0.6
    add_v = nt.nodes.new('ShaderNodeAddShader')
    nt.links.new(absorb.outputs[0], add_v.inputs[0])
    nt.links.new(scat.outputs[0], add_v.inputs[1])
    nt.links.new(add_v.outputs[0], out.inputs['Volume'])

    if dissolve_y0 is not None and dissolve_y1 is not None:
        geom = nt.nodes.new('ShaderNodeNewGeometry')
        sep = nt.nodes.new('ShaderNodeSeparateXYZ')
        nt.links.new(geom.outputs['Position'], sep.inputs[0])
        ymap = nt.nodes.new('ShaderNodeMapRange')
        ymap.inputs[1].default_value = float(dissolve_y0)
        ymap.inputs[2].default_value = float(dissolve_y1)
        ymap.inputs[3].default_value = 0.0
        ymap.inputs[4].default_value = 1.0
        nt.links.new(sep.outputs['Y'], ymap.inputs[0])

        dnoise = nt.nodes.new('ShaderNodeTexNoise')
        dnoise.inputs['Scale'].default_value = 0.72
        dnoise.inputs['Detail'].default_value = 6.0
        nt.links.new(geom.outputs['Position'], dnoise.inputs['Vector'])

        sub = nt.nodes.new('ShaderNodeMath')
        sub.operation = 'SUBTRACT'
        nt.links.new(ymap.outputs[0], sub.inputs[0])
        nscale = nt.nodes.new('ShaderNodeMath')
        nscale.operation = 'MULTIPLY_ADD'
        nscale.inputs[1].default_value = 0.55
        nscale.inputs[2].default_value = -0.275
        nt.links.new(dnoise.outputs['Fac'], nscale.inputs[0])
        nt.links.new(nscale.outputs[0], sub.inputs[1])

        mask = nt.nodes.new('ShaderNodeMapRange')
        mask.inputs[1].default_value = 0.42
        mask.inputs[2].default_value = 0.58
        mask.inputs[3].default_value = 0.0
        mask.inputs[4].default_value = 1.0
        nt.links.new(sub.outputs[0], mask.inputs[0])

        transp = nt.nodes.new('ShaderNodeBsdfTransparent')
        mix = nt.nodes.new('ShaderNodeMixShader')
        nt.links.new(mask.outputs[0], mix.inputs[0])
        nt.links.new(b.outputs[0], mix.inputs[1])
        nt.links.new(transp.outputs[0], mix.inputs[2])
        nt.links.new(mix.outputs[0], out.inputs['Surface'])

    return mat


def mine_rock_material():
    """Dark damp mine walls using repo rock maps + micro-normal bump + glossy water seepage coat."""
    mat = C.material('MineRock', Base_Color=(0.042, 0.045, 0.052, 1), Roughness=0.78,
                     Coat_Weight=0.25, Coat_Roughness=0.14, Specular_IOR_Level=0.48)
    nt = mat.node_tree
    b = C.bsdf_of(mat)
    tc = nt.nodes.new('ShaderNodeTexCoord')
    mp = nt.nodes.new('ShaderNodeMapping')
    mp.inputs['Scale'].default_value = (0.32, 0.32, 0.32)
    nt.links.new(tc.outputs['Object'], mp.inputs['Vector'])

    micro = nt.nodes.new('ShaderNodeTexNoise')
    micro.inputs['Scale'].default_value = 28.0
    micro.inputs['Detail'].default_value = 8.0
    micro.inputs['Roughness'].default_value = 0.65
    nt.links.new(tc.outputs['Object'], micro.inputs['Vector'])
    micro_bump = nt.nodes.new('ShaderNodeBump')
    micro_bump.inputs['Strength'].default_value = 0.22
    micro_bump.inputs['Distance'].default_value = 0.02
    nt.links.new(micro.outputs['Fac'], micro_bump.inputs['Height'])

    diff_p = tex_path('rock_diff.jpg')
    nor_p = tex_path('rock_nor_gl.jpg')
    if diff_p and nor_p:
        diff = C.image_texture(nt, diff_p, non_color=False)
        nor = C.image_texture(nt, nor_p, non_color=True)
        for n in (diff, nor):
            n.projection = 'BOX'
            n.projection_blend = 0.2
            nt.links.new(mp.outputs['Vector'], n.inputs['Vector'])
        hsv = nt.nodes.new('ShaderNodeHueSaturation')
        hsv.inputs['Saturation'].default_value = 0.55
        hsv.inputs['Value'].default_value = 0.24
        nt.links.new(diff.outputs['Color'], hsv.inputs['Color'])
        nt.links.new(hsv.outputs['Color'], b.inputs['Base Color'])
        nm = nt.nodes.new('ShaderNodeNormalMap')
        nm.inputs['Strength'].default_value = 1.35
        nt.links.new(nor.outputs['Color'], nm.inputs['Color'])
        nt.links.new(nm.outputs['Normal'], micro_bump.inputs['Normal'])
        nt.links.new(micro_bump.outputs['Normal'], b.inputs['Normal'])
    else:
        n1 = nt.nodes.new('ShaderNodeTexNoise')
        n1.inputs['Scale'].default_value = 3.5
        n1.inputs['Detail'].default_value = 10.0
        n1.inputs['Roughness'].default_value = 0.7
        nt.links.new(mp.outputs['Vector'], n1.inputs['Vector'])
        bump = nt.nodes.new('ShaderNodeBump')
        bump.inputs['Strength'].default_value = 0.6
        nt.links.new(n1.outputs['Fac'], bump.inputs['Height'])
        nt.links.new(bump.outputs['Normal'], micro_bump.inputs['Normal'])
        nt.links.new(micro_bump.outputs['Normal'], b.inputs['Normal'])

    # Wet seepage patches on the rock walls (glint softly in grazing light)
    wet = nt.nodes.new('ShaderNodeTexNoise')
    wet.inputs['Scale'].default_value = 1.3
    wet.inputs['Detail'].default_value = 5.0
    nt.links.new(tc.outputs['Object'], wet.inputs['Vector'])
    wmr = nt.nodes.new('ShaderNodeMapRange')
    wmr.inputs[1].default_value = 0.36
    wmr.inputs[2].default_value = 0.70
    wmr.inputs[3].default_value = 0.22
    wmr.inputs[4].default_value = 0.92
    nt.links.new(wet.outputs['Fac'], wmr.inputs[0])
    nt.links.new(wmr.outputs[0], b.inputs['Roughness'])
    return mat


def mine_floor_material():
    """Damp dark mud/gravel floor with wet sheen."""
    mat = C.material('MineFloor', Base_Color=(0.032, 0.030, 0.028, 1), Roughness=0.50,
                     Coat_Weight=0.35, Coat_Roughness=0.10, Specular_IOR_Level=0.52)
    nt = mat.node_tree
    b = C.bsdf_of(mat)
    tc = nt.nodes.new('ShaderNodeTexCoord')
    noise = nt.nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 4.2
    noise.inputs['Detail'].default_value = 9.0
    noise.inputs['Roughness'].default_value = 0.68
    nt.links.new(tc.outputs['Object'], noise.inputs['Vector'])
    mr = nt.nodes.new('ShaderNodeMapRange')
    mr.inputs[1].default_value = 0.3
    mr.inputs[2].default_value = 0.72
    mr.inputs[3].default_value = 0.18
    mr.inputs[4].default_value = 0.85
    nt.links.new(noise.outputs['Fac'], mr.inputs[0])
    nt.links.new(mr.outputs[0], b.inputs['Roughness'])
    bump = nt.nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = 0.38
    nt.links.new(noise.outputs['Fac'], bump.inputs['Height'])
    nt.links.new(bump.outputs['Normal'], b.inputs['Normal'])
    return mat


def timber_material():
    """Rotting dark mine timber sets and railway sleepers (procedural wood grain + splinter bump)."""
    mat = C.material('RottingTimber', Base_Color=(0.075, 0.052, 0.038, 1), Roughness=0.88,
                     Specular_IOR_Level=0.3)
    nt = mat.node_tree
    b = C.bsdf_of(mat)
    tc = nt.nodes.new('ShaderNodeTexCoord')
    mp = nt.nodes.new('ShaderNodeMapping')
    mp.inputs['Scale'].default_value = (1.5, 1.5, 8.5)
    nt.links.new(tc.outputs['Object'], mp.inputs['Vector'])
    noise = nt.nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 4.0
    noise.inputs['Detail'].default_value = 10.0
    noise.inputs['Distortion'].default_value = 1.4
    nt.links.new(mp.outputs['Vector'], noise.inputs['Vector'])
    cr = nt.nodes.new('ShaderNodeValToRGB')
    cr.color_ramp.elements[0].position = 0.25
    cr.color_ramp.elements[0].color = (0.032, 0.022, 0.016, 1)
    cr.color_ramp.elements[1].position = 0.78
    cr.color_ramp.elements[1].color = (0.11, 0.078, 0.056, 1)
    nt.links.new(noise.outputs['Fac'], cr.inputs['Fac'])
    nt.links.new(cr.outputs['Color'], b.inputs['Base Color'])
    bump = nt.nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = 0.45
    nt.links.new(noise.outputs['Fac'], bump.inputs['Height'])
    nt.links.new(bump.outputs['Normal'], b.inputs['Normal'])
    return mat


def rusted_metal_material(name='RustedRail'):
    """Rusted rails and chains using repo echo rust textures when available."""
    mat = C.material(name, Base_Color=(0.14, 0.085, 0.06, 1), Metallic=0.68, Roughness=0.52)
    nt = mat.node_tree
    b = C.bsdf_of(mat)
    tc = nt.nodes.new('ShaderNodeTexCoord')
    mp = nt.nodes.new('ShaderNodeMapping')
    mp.inputs['Scale'].default_value = (1.5, 1.5, 1.5)
    nt.links.new(tc.outputs['Object'], mp.inputs['Vector'])

    diff_p = tex_path('echo', 'rusty_metal_02_diff_1k.jpg') or tex_path('echo', 'rust_coarse_01_diff_512.jpg')
    nor_p = tex_path('echo', 'rusty_metal_02_nor_gl_1k.jpg') or tex_path('echo', 'rust_coarse_01_nor_gl_512.jpg')
    arm_p = tex_path('echo', 'rusty_metal_02_arm_1k.jpg')
    if diff_p and nor_p:
        diff = C.image_texture(nt, diff_p, non_color=False)
        nor = C.image_texture(nt, nor_p, non_color=True)
        for n in (diff, nor):
            n.projection = 'BOX'
            n.projection_blend = 0.2
            nt.links.new(mp.outputs['Vector'], n.inputs['Vector'])
        hsv = nt.nodes.new('ShaderNodeHueSaturation')
        hsv.inputs['Value'].default_value = 0.55
        nt.links.new(diff.outputs['Color'], hsv.inputs['Color'])
        nt.links.new(hsv.outputs['Color'], b.inputs['Base Color'])
        connect_normal_map(nt, nor, b, strength=0.85)
        if arm_p:
            arm = C.image_texture(nt, arm_p, non_color=True)
            arm.projection = 'BOX'
            arm.projection_blend = 0.2
            nt.links.new(mp.outputs['Vector'], arm.inputs['Vector'])
            sep = separate_color_node(nt)
            nt.links.new(arm.outputs['Color'], sep.inputs[0])
            # ARM: G = Roughness, B = Metallic
            nt.links.new(sep.outputs[1], b.inputs['Roughness'])
            nt.links.new(sep.outputs[2], b.inputs['Metallic'])
    else:
        noise = nt.nodes.new('ShaderNodeTexNoise')
        noise.inputs['Scale'].default_value = 9.0
        noise.inputs['Detail'].default_value = 8.0
        nt.links.new(mp.outputs['Vector'], noise.inputs['Vector'])
        bump = nt.nodes.new('ShaderNodeBump')
        bump.inputs['Strength'].default_value = 0.35
        nt.links.new(noise.outputs['Fac'], bump.inputs['Height'])
        nt.links.new(bump.outputs['Normal'], b.inputs['Normal'])
    return mat


def puddle_material():
    """Still, glossy dark mine floor puddles that catch cold overhead reflections."""
    mat = C.material('MinePuddle', Base_Color=(0.008, 0.012, 0.016, 1), Roughness=0.02,
                     IOR=1.333, Coat_Weight=1.0, Coat_Roughness=0.012, Specular_IOR_Level=0.65)
    nt = mat.node_tree
    b = C.bsdf_of(mat)
    tc = nt.nodes.new('ShaderNodeTexCoord')
    noise = nt.nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 14.0
    noise.inputs['Detail'].default_value = 3.0
    nt.links.new(tc.outputs['Object'], noise.inputs['Vector'])
    bump = nt.nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = 0.014
    nt.links.new(noise.outputs['Fac'], bump.inputs['Height'])
    nt.links.new(bump.outputs['Normal'], b.inputs['Normal'])
    return mat


def frost_mist_material(density):
    """Faint heterogeneous icy mist hanging in the crevasse and ice cave."""
    mat = bpy.data.materials.new('FrostMist')
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    vol = nt.nodes.new('ShaderNodeVolumeScatter')
    vol.inputs['Color'].default_value = (0.72, 0.85, 0.95, 1)
    vol.inputs['Anisotropy'].default_value = 0.65

    geom = nt.nodes.new('ShaderNodeNewGeometry')
    noise = nt.nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 0.16
    noise.inputs['Detail'].default_value = 4.0
    nt.links.new(geom.outputs['Position'], noise.inputs['Vector'])

    # Fade mist gently out as we enter the mine (Y = 34..52) so the abyss stays crisp pitch black
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(geom.outputs['Position'], sep.inputs[0])
    yfade = nt.nodes.new('ShaderNodeMapRange')
    yfade.inputs[1].default_value = 34.0
    yfade.inputs[2].default_value = 52.0
    yfade.inputs[3].default_value = 1.0
    yfade.inputs[4].default_value = 0.0
    nt.links.new(sep.outputs['Y'], yfade.inputs[0])

    nmap = nt.nodes.new('ShaderNodeMapRange')
    nmap.inputs[1].default_value = 0.25
    nmap.inputs[2].default_value = 0.78
    nmap.inputs[3].default_value = 0.25 * density
    nmap.inputs[4].default_value = 1.55 * density
    nt.links.new(noise.outputs['Fac'], nmap.inputs[0])

    mul = nt.nodes.new('ShaderNodeMath')
    mul.operation = 'MULTIPLY'
    nt.links.new(nmap.outputs[0], mul.inputs[0])
    nt.links.new(yfade.outputs[0], mul.inputs[1])
    nt.links.new(mul.outputs[0], vol.inputs['Density'])
    nt.links.new(vol.outputs[0], out.inputs['Volume'])
    return mat


# --------------------------------------------------------------------------------------------------
# Geometry builders
# --------------------------------------------------------------------------------------------------
def build_surface_snowfield(col, snow_mat, rng):
    """Snowy plateau at Z=0 with the crevasse slot cut cleanly out and wind-sculpted lips."""
    def b(bm):
        nx, ny = 96, 96
        span_x, span_y = 240.0, 240.0
        xs = []
        for i in range(nx + 1):
            u = (i / nx) * 2.0 - 1.0
            xs.append(math.copysign(abs(u) ** 1.65, u) * (span_x * 0.5))
        ys = []
        for j in range(ny + 1):
            u = (j / ny) * 2.0 - 1.0
            ys.append(math.copysign(abs(u) ** 1.65, u) * (span_y * 0.5) + 8.0)

        grid = []
        for j, y in enumerate(ys):
            row = []
            hw = crevasse_half_width(y)
            for i, x in enumerate(xs):
                d_edge = abs(x) - hw
                dist_c = math.hypot(x, (y - 6.0) * 0.7)
                if dist_c > 24.0:
                    z = (fbm(x * 0.025, y * 0.025, 1.3, 4) - 0.38) * min(1.0, (dist_c - 24.0) / 55.0) * 14.0
                else:
                    z = (fbm(x * 0.14, y * 0.14, 2.1, 3) - 0.5) * 0.45
                if hw > 0.0 and d_edge < 1.8:
                    lip = smoothstep(1.8, 0.0, max(0.0, d_edge))
                    z -= lip * 0.75
                row.append(bm.verts.new((x, y, z)))
            grid.append(row)

        uv = bm.loops.layers.uv.verify()
        for j in range(ny):
            ym = 0.5 * (ys[j] + ys[j + 1])
            hw = crevasse_half_width(ym)
            for i in range(nx):
                xm = 0.5 * (xs[i] + xs[i + 1])
                if hw > 0.05 and abs(xm) < hw:
                    continue
                f = bm.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]))
                for lp in f.loops:
                    lp[uv].uv = (lp.vert.co.x * 0.12, lp.vert.co.y * 0.12)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)

    ground = C.mesh_object('Snowfield', b, col, smooth=True)
    C.assign(ground, snow_mat)

    mtn_mat = C.material('HorizonPeaks', Base_Color=(0.89, 0.93, 0.97, 1), Roughness=0.88)
    for k in range(10):
        angle = math.radians(15.0 + k * 16.5 + rng.uniform(-5.0, 5.0))
        dist = rng.uniform(115.0, 175.0)
        sx = rng.uniform(26.0, 48.0)
        sy = rng.uniform(22.0, 40.0)
        sz = rng.uniform(18.0, 38.0)
        seed_k = k * 3.7

        def mk_peak(bm, sk=seed_k, s_x=sx, s_y=sy, s_z=sz):
            bmesh.ops.create_icosphere(bm, subdivisions=3, radius=1.0, calc_uvs=True)
            for v in bm.verts:
                p = v.co
                n = fbm(p.x * 1.9 + sk, p.y * 1.9, p.z * 1.9, 4)
                r = 0.65 + n * 0.75
                v.co = Vector((p.x * r * s_x, p.y * r * s_y, max(-0.15, p.z * r) * s_z))

        pos = (math.cos(angle) * dist, math.sin(angle) * dist + 10.0, -3.5)
        peak = C.mesh_object('SnowPeak_%d' % k, mk_peak, col, location=pos, smooth=False)
        C.assign(peak, mtn_mat)
    return ground


def build_tunnel_shell(name, path, s0, s1, seg_l, seg_r, col, mats, cut_top=False, cap_end=False,
                       radial_bias=0.0, solidify_thickness=0.0):
    """Build a sculpted organic tunnel swept along `path` from s0 to s1 with a flattened floor."""
    def b(bm):
        rings = []
        ring_is_floor = []
        ring_z = []
        uv = bm.loops.layers.uv.verify()

        for i in range(seg_l + 1):
            s = lerp(s0, s1, i / seg_l)
            p, side, up, _ = path.frame_at_s(s)
            w, h, floor_hw, amp = tunnel_profile(p.y)
            fl_z = h * math.sqrt(max(0.0, 1.0 - (floor_hw / w) ** 2))
            ring = []
            is_fl = []
            zs = []
            for j in range(seg_r):
                th = (j / seg_r) * math.tau
                cx, cz = math.cos(th), math.sin(th)
                n1 = fbm(cx * 1.4 + 9.0, s * 0.19, cz * h * 0.16 + 3.0, 4)
                n2 = fbm(cx * 4.2 + 1.5, s * 0.85, cz * 2.4 + 7.0, 2)
                disp = (n1 - 0.5) * amp * 1.35 + (n2 - 0.5) * amp * 0.28 + radial_bias
                lx = cx * (w + disp)
                lz = cz * (h + disp * 0.78)
                fl_flag = 0
                if lz < -fl_z:
                    lz = -fl_z + (vnoise(lx * 1.9, s * 1.6, 3.0) - 0.5) * 0.09 + max(0.0, abs(lx) - floor_hw) * 0.28
                    fl_flag = 1
                world_v = p + side * lx + up * (lz + fl_z)
                ring.append(bm.verts.new(world_v))
                is_fl.append(fl_flag)
                zs.append(world_v.z)
            rings.append(ring)
            ring_is_floor.append(is_fl)
            ring_z.append(zs)

        for i in range(seg_l):
            for j in range(seg_r):
                jn = (j + 1) % seg_r
                v00 = rings[i][j]
                v01 = rings[i][jn]
                v11 = rings[i + 1][jn]
                v10 = rings[i + 1][j]
                if cut_top and max(ring_z[i][j], ring_z[i][jn], ring_z[i + 1][jn], ring_z[i + 1][j]) > 0.25:
                    continue
                f = bm.faces.new((v00, v10, v11, v01))
                fl_count = (ring_is_floor[i][j] + ring_is_floor[i][jn]
                            + ring_is_floor[i + 1][jn] + ring_is_floor[i + 1][j])
                f.material_index = 1 if (len(mats) > 1 and fl_count >= 3) else 0
                u0, u1 = (j / seg_r) * 4.0, ((j + 1) / seg_r) * 4.0
                v0, v1 = (i / seg_l) * ((s1 - s0) / 3.0), ((i + 1) / seg_l) * ((s1 - s0) / 3.0)
                for lp, coord in zip(f.loops, ((u0, v0), (u0, v1), (u1, v1), (u1, v0))):
                    lp[uv].uv = coord

        if cap_end:
            p_end, _, up_end, _ = path.frame_at_s(s1)
            c_vert = bm.verts.new(p_end + up_end * 1.4)
            last = rings[-1]
            for j in range(seg_r):
                jn = (j + 1) % seg_r
                bm.faces.new((last[j], c_vert, last[jn]))

    obj = C.mesh_object(name, b, col, smooth=True)
    for m in mats:
        obj.data.materials.append(m)
    if solidify_thickness > 0.0:
        sol = obj.modifiers.new('IceThickness', 'SOLIDIFY')
        sol.thickness = solidify_thickness
        sol.offset = -1.0
        sol.use_even_offset = True
    return obj


def build_icicles(col, path, ice_mat, rng):
    """Clusters of tapered refractive icicles hanging from the crevasse lip and ice cave roof."""
    s_start = path.s_at_y(2.0)
    s_end = path.s_at_y(36.0)
    idx = 0
    s = s_start
    while s < s_end:
        p, side, up, _ = path.frame_at_s(s)
        w, h, floor_hw, _ = tunnel_profile(p.y)
        fl_z = h * math.sqrt(max(0.0, 1.0 - (floor_hw / w) ** 2))
        for _ in range(rng.randint(2, 4)):
            length = rng.uniform(0.45, 1.85)
            rad = length * rng.uniform(0.06, 0.11)
            if p.y < 13.5:
                sgn = -1.0 if rng.random() < 0.5 else 1.0
                hw = max(0.8, crevasse_half_width(p.y))
                loc = Vector((sgn * (hw - rng.uniform(0.0, 0.35)), p.y + rng.uniform(-0.8, 0.8),
                              -0.25 - length * 0.5))
            else:
                x_off = rng.uniform(-w * 0.6, w * 0.6)
                ceil_z = fl_z + h * math.sqrt(max(0.05, 1.0 - (x_off / (w + 0.2)) ** 2))
                loc = p + side * x_off + up * (ceil_z - length * 0.45)
            ic = C.cylinder('Icicle_%d' % idx, radius=0.008, radius2=rad, depth=length,
                            location=loc, col=col, mat=ice_mat, segments=10, smooth=True)
            ic.rotation_euler = (rng.uniform(-0.08, 0.08), rng.uniform(-0.08, 0.08), rng.uniform(0.0, math.tau))
            idx += 1
        s += rng.uniform(1.6, 3.0)


def build_timber_sets(col, path, timber_mat, rng):
    """Rotting mine timber sets (posts + overhead crossbeam); ~22% crooked/broken."""
    s_start = path.s_at_y(Y_MINE_START)
    s_end = path.s_at_y(Y_MINE_END - 4.0)
    beam_positions = []
    s = s_start
    idx = 0
    while s < s_end:
        p, side, up, _ = path.frame_at_s(s)
        _, _, floor_hw, _ = tunnel_profile(p.y)
        hw = floor_hw * 0.92
        h = 2.65
        broken = rng.random() < 0.22
        rot = path.basis_euler(s)

        for sgn, tag in ((-1.0, 'L'), (1.0, 'R')):
            post = C.box('TimberPost_%d_%s' % (idx, tag), (0.24, 0.24, h),
                         p + side * (sgn * hw) + up * (h * 0.5), col, timber_mat)
            post.rotation_euler = (rot.x + rng.uniform(-0.04, 0.04),
                                   rot.y + rng.uniform(-0.06, 0.06),
                                   rot.z + rng.uniform(-0.08, 0.08))

        beam_loc = p + up * (h + 0.10)
        beam_rot = Euler((rot.x, rot.y, rot.z), 'XYZ')
        if broken:
            beam_loc = beam_loc - up * 0.35
            beam_rot.y += 0.28 * (-1.0 if rng.random() < 0.5 else 1.0)
        beam = C.box('TimberBeam_%d' % idx, (hw * 2.0 + 0.45, 0.26, 0.24), beam_loc, col, timber_mat)
        beam.rotation_euler = beam_rot
        if not broken:
            beam_positions.append(s)
        idx += 1
        s += rng.uniform(5.2, 6.6)
    return beam_positions


def build_rails_and_sleepers(col, path, timber_mat, rail_mat, rng):
    """Wooden sleepers and extruded I-profile rusted steel rails along the mine floor."""
    s_start = path.s_at_y(Y_MINE_START - 2.0)
    s_end = path.s_at_y(Y_MINE_END - 2.0)

    s = s_start
    idx = 0
    while s < s_end:
        p, side, up, _ = path.frame_at_s(s)
        rot = path.basis_euler(s)
        sl = C.box('Sleeper_%d' % idx, (1.42, 0.20, 0.11),
                   p + side * rng.uniform(-0.05, 0.05) + up * 0.055, col, timber_mat)
        sl.rotation_euler = (rot.x, rot.y, rot.z + rng.uniform(-0.09, 0.09))
        idx += 1
        s += 0.85

    profile = [
        (-0.036, 0.000), (0.036, 0.000), (0.036, 0.012), (0.009, 0.022),
        (0.009, 0.072), (0.024, 0.080), (0.024, 0.102), (-0.024, 0.102),
        (-0.024, 0.080), (-0.009, 0.072), (-0.009, 0.022), (-0.036, 0.012),
    ]
    n_seg = 120
    for tag, x_gauge in (('L', -0.50), ('R', 0.50)):
        def build_rail(bm, xg=x_gauge):
            rings = []
            for i in range(n_seg + 1):
                si = lerp(s_start, s_end, i / n_seg)
                p, side, up, _ = path.frame_at_s(si)
                base = p + side * xg + up * 0.105
                rings.append([bm.verts.new(base + side * px + up * pz) for px, pz in profile])
            np = len(profile)
            for i in range(n_seg):
                for j in range(np):
                    jn = (j + 1) % np
                    bm.faces.new((rings[i][j], rings[i][jn], rings[i + 1][jn], rings[i + 1][j]))
            bmesh.ops.recalc_face_normals(bm, faces=bm.faces)

        r_obj = C.mesh_object('MineRail_%s' % tag, build_rail, col, smooth=False)
        C.assign(r_obj, rail_mat)


def build_hanging_chains(col, path, beam_s_list, chain_mat, rng):
    """Hanging rusted chains suspended from selected mine timber crossbeams."""
    if not beam_s_list:
        return
    for ci, s in enumerate(beam_s_list[:4]):
        p, side, up, _ = path.frame_at_s(s)
        x_off = rng.uniform(-0.85, 0.85)
        n_links = rng.randint(14, 24)
        top = p + side * x_off + up * 2.62

        def build_chain(bm, count=n_links):
            link_h = 0.055
            for k in range(count):
                rot_z = (math.pi * 0.5) if (k % 2 == 1) else 0.0
                cx, cz = 0.022, 0.036
                r_tube = 0.007
                segs = 8
                ring_v = []
                for a in range(segs):
                    th = (a / segs) * math.tau
                    px, pz = cx * math.cos(th), cz * math.sin(th)
                    nx, nz = math.cos(th), math.sin(th)
                    sub = []
                    for b in range(4):
                        ph = (b / 4) * math.tau
                        vx = px + nx * r_tube * math.cos(ph)
                        vy = r_tube * math.sin(ph)
                        vz = pz + nz * r_tube * math.cos(ph)
                        rx = vx * math.cos(rot_z) - vy * math.sin(rot_z)
                        ry = vx * math.sin(rot_z) + vy * math.cos(rot_z)
                        sub.append(bm.verts.new((rx, ry, vz - k * link_h)))
                    ring_v.append(sub)
                for a in range(segs):
                    an = (a + 1) % segs
                    for b in range(4):
                        bn = (b + 1) % 4
                        bm.faces.new((ring_v[a][b], ring_v[an][b], ring_v[an][bn], ring_v[a][bn]))
            bmesh.ops.recalc_face_normals(bm, faces=bm.faces)

        ch = C.mesh_object('MineChain_%d' % ci, build_chain, col, location=top, smooth=True)
        C.assign(ch, chain_mat)


def build_puddles_and_debris(col, path, puddle_mat, rock_mat, rng):
    """Dark reflective floor puddles and angular fallen rock debris in the mine mouth."""
    for idx, (y_pos, x_off, rx, ry) in enumerate((
            (46.0, -0.35, 1.25, 2.4),
            (53.5, 0.40, 1.45, 3.1),
            (63.0, -0.15, 1.65, 3.8),
            (74.0, 0.25, 1.50, 3.4))):
        s = path.s_at_y(y_pos)
        p, side, up, _ = path.frame_at_s(s)
        rot = path.basis_euler(s)

        def mk_puddle(bm, a=rx, b_rad=ry, seed_i=idx):
            segs = 28
            center = bm.verts.new((0.0, 0.0, 0.0))
            rim = []
            for k in range(segs):
                th = (k / segs) * math.tau
                wob = 0.78 + 0.42 * fbm(math.cos(th) * 2.0 + seed_i * 4.1, math.sin(th) * 2.0, 1.2, 3)
                rim.append(bm.verts.new((math.cos(th) * a * wob, math.sin(th) * b_rad * wob, 0.0)))
            for k in range(segs):
                bm.faces.new((center, rim[k], rim[(k + 1) % segs]))

        pud = C.mesh_object('MinePuddle_%d' % idx, mk_puddle, col,
                            location=p + side * x_off + up * 0.025, smooth=True)
        pud.rotation_euler = rot
        C.assign(pud, puddle_mat)

    s = path.s_at_y(36.0)
    s_end = path.s_at_y(82.0)
    r_idx = 0
    while s < s_end:
        p, side, up, _ = path.frame_at_s(s)
        _, _, floor_hw, _ = tunnel_profile(p.y)
        sgn = -1.0 if rng.random() < 0.5 else 1.0
        sc = rng.uniform(0.18, 0.65)
        seed_r = r_idx * 2.3

        def mk_rock(bm, sr=seed_r, scale=sc):
            bmesh.ops.create_icosphere(bm, subdivisions=2, radius=scale, calc_uvs=True)
            for v in bm.verts:
                n = fbm(v.co.x * 2.4 + sr, v.co.y * 2.4, v.co.z * 2.4, 3)
                v.co *= (0.65 + n * 0.7)

        loc = p + side * (sgn * (floor_hw + rng.uniform(-0.15, 0.35))) + up * (sc * 0.25)
        rk = C.mesh_object('MineDebris_%d' % r_idx, mk_rock, col, location=loc, smooth=False)
        rk.rotation_euler = (rng.uniform(0, math.tau), rng.uniform(0, math.tau), rng.uniform(0, math.tau))
        C.assign(rk, rock_mat)
        r_idx += 1
        s += rng.uniform(2.0, 3.8)


def build_frost_particles(col, args):
    """Drifting snow/frost motes catching cold sunlight at the surface and upper crevasse."""
    scale = C.fps_scale(args)
    flake_mat = C.material('FrostFlake', Base_Color=(0.94, 0.97, 1.0, 1), Roughness=0.3,
                           Emission_Color=(0.82, 0.91, 1.0, 1), Emission_Strength=0.35)
    flake = C.ico('FROST_FLAKE', radius=1.0, subdiv=1, location=(0, 0, -500), col=col, mat=flake_mat)
    emitter = C.plane('SnowEmitter', (16.0, 26.0), (0.0, 5.0, 6.5), col)
    pre_roll = int(round(-40 * scale))
    C.particles(
        emitter, 'SurfaceSnow', flake,
        count=650,
        frame_start=args.f0 + pre_roll,
        frame_end=args.f1,
        lifetime=max(24, int(round(160 * scale))),
        size=0.014,
        size_random=0.65,
        normal=-0.35,
        gravity=0.12,
        brownian=0.35,
        seed=args.seed,
    )


# --------------------------------------------------------------------------------------------------
# Main scene assembly
# --------------------------------------------------------------------------------------------------
def main():
    args = C.parse_args(
        'Echo descent film: icy surface -> refractive ice cave -> abandoned mine abyss.',
        {'out': 'renders/echo_descent', 'frames': '1-%d' % DEFAULT_FRAMES, 'samples': 768, 'min_samples': 64},
        extra_args,
    )
    rng = random.Random(args.seed)
    scene = C.reset_scene()
    C.setup_render(scene, args, caustics=True, volumes=not args.no_mist)
    if not args.no_mist:
        scene.cycles.volume_step_rate = 0.65
    col = C.collection('EchoDescent')
    scale = C.fps_scale(args)
    kf = lambda t: C.frame_at(t, args.f0, args.f1)

    # Cold winter Nishita sky (sun disc off; directional sun lamp drives crisp crevasse shafts)
    C.nishita_world(scene, sun_elevation=args.sun_elevation, sun_rotation=args.sun_azimuth,
                    strength=0.72, sun_disc=False, air=1.4, dust=0.75, ozone=1.8)
    sun = C.sun_lamp('WINTER_SUN', args.sun_elevation, args.sun_azimuth, energy=3.8, angle=1.8,
                     col=col, color=(0.88, 0.94, 1.0))
    C.caustics_light(sun)

    # Soft icy blue sky-bounce area light tucked in the crevasse lip to illuminate glacial refraction
    ld = bpy.data.lights.new('CREVASSE_BOUNCE', 'AREA')
    ld.shape = 'RECTANGLE'
    ld.size = 3.2
    ld.size_y = 11.0
    ld.energy = 680.0
    ld.color = (0.64, 0.81, 0.95)
    bounce = C.link(bpy.data.objects.new('CREVASSE_BOUNCE', ld), col)
    bounce.location = (0.0, 6.5, -0.4)
    bounce.rotation_euler = (C.deg(26.0), 0.0, 0.0)

    # Subtle cold grazing rim at the mine mouth so timber, rails & puddles read cleanly before pitch black
    md = bpy.data.lights.new('MINE_THRESHOLD_GLINT', 'POINT')
    md.energy = 38.0
    md.shadow_soft_size = 0.85
    md.color = (0.58, 0.76, 0.94)
    mine_glint = C.link(bpy.data.objects.new('MINE_THRESHOLD_GLINT', md), col)
    path = SplinePath(SPLINE_PTS, samples=700)
    mine_glint.location = path.at(path.s_at_y(41.5), 0.0, 2.2)

    # Materials
    snow_mat = snow_material()
    ice_cave_mat = glacial_ice_material(dissolve_y0=Y_TRANS_START, dissolve_y1=Y_TRANS_END)
    ice_solid_mat = glacial_ice_material()
    rock_mat = mine_rock_material()
    floor_mat = mine_floor_material()
    timber_mat = timber_material()
    rail_mat = rusted_metal_material('RustedRail')
    chain_mat = rusted_metal_material('RustedChain')
    pud_mat = puddle_material()

    # 1. Surface snowfield & horizon peaks
    build_surface_snowfield(col, snow_mat, rng)

    # 2. Ice cave shell (crevasse mouth -> ice chute -> noise-dissolved transition edge)
    s_ice0 = path.s_at_y(-2.0)
    s_ice1 = path.s_at_y(Y_TRANS_END + 1.5)
    ice_shell = build_tunnel_shell(
        'IceCaveShell', path, s_ice0, s_ice1, seg_l=120, seg_r=48, col=col,
        mats=[ice_cave_mat, snow_mat], cut_top=True, cap_end=False,
        radial_bias=-0.06, solidify_thickness=0.42,
    )
    C.caustics_object(ice_shell, caster=True, receiver=True)

    # 3. Dark rocky mine tunnel overlapping behind the dissolving ice and continuing into the abyss
    s_rock0 = path.s_at_y(Y_TRANS_START - 2.0)
    s_rock1 = path.s_at_y(Y_MINE_END)
    mine_shell = build_tunnel_shell(
        'MineTunnel', path, s_rock0, s_rock1, seg_l=160, seg_r=48, col=col,
        mats=[rock_mat, floor_mat], cut_top=False, cap_end=True, radial_bias=0.0,
    )
    C.caustics_object(mine_shell, receiver=True)

    # 4. Ice cave icicles + mine props (timbers, rails, sleepers, chains, puddles, rock debris)
    build_icicles(col, path, ice_solid_mat, rng)
    beam_s = build_timber_sets(col, path, timber_mat, rng)
    build_rails_and_sleepers(col, path, timber_mat, rail_mat, rng)
    build_hanging_chains(col, path, beam_s, chain_mat, rng)
    build_puddles_and_debris(col, path, pud_mat, rock_mat, rng)

    # 5. Frost mist volume box spanning the crevasse and ice cave
    if not args.no_mist and args.fog_density > 0.0:
        mist_mat = frost_mist_material(args.fog_density)
        C.box('FrostMistDomain', (14.0, 56.0, 32.0), (0.0, 26.0, -15.5), col, mist_mat)

    # 6. Drifting snow/frost particles near the surface mouth
    build_frost_particles(col, args)

    # 7. Camera choreography (normalized t in [0..1] -> f0..f1): surface -> ice cave -> mine -> abyss
    rig = C.CameraRig('CAM', lens=26.0, portrait_lens=20.0, clip_end=1000.0, col=col)
    waypoints = [
        (0.000, Vector((-2.2, -13.5, 3.4)), Vector((0.3, 12.0, -1.5))),
        (0.161, Vector((-0.5, -3.5, 2.2)), Vector((0.2, 8.5, -5.5))),
        (0.287, Vector((0.25, 4.5, -3.8)), path.at(path.s_at_y(16.0), 0.0, 1.2)),
        (0.441, path.at(path.s_at_y(18.5), 0.15, 1.55), path.at(path.s_at_y(30.0), -0.2, 1.35)),
        (0.594, path.at(path.s_at_y(32.0), -0.1, 1.55), path.at(path.s_at_y(44.0), 0.1, 1.45)),
        (0.748, path.at(path.s_at_y(44.5), 0.05, 1.62), path.at(path.s_at_y(58.0), 0.0, 1.45)),
        (0.888, path.at(path.s_at_y(55.5), 0.0, 1.62), path.at(path.s_at_y(72.0), 0.0, 1.40)),
        (1.000, path.at(path.s_at_y(63.5), 0.0, 1.62), path.at(path.s_at_y(84.0), 0.0, 1.35)),
    ]
    for t, loc, look in waypoints:
        rig.key(kf(t), loc=loc, look=look)
    C.ease(rig.rig)
    C.ease(rig.look)
    rig.shake(strength=0.005, scale=32.0 * scale)

    # Depth of field tracks ~6-9 m ahead along the descent path
    focus = C.empty('FOCUS', (0.0, 6.0, -2.0), col)
    for t, _, look in waypoints:
        C.key(focus, kf(t), loc=look)
    C.ease(focus)
    rig.dof(focus=focus, fstop=2.8)
    C.use_camera(scene, rig, args.res)

    C.finish(scene, args)


if __name__ == '__main__':
    main()
