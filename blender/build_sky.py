"""Sky Sentry photorealistic Cycles film for sky-sentry.html (plan.md sections 4.4 and 7).

All 8 storyboard shots are parameterized by normalized timeline progress u in [0, 1] over the
configured frame count (default 480 frames = 20 s at 24 fps, 10 exact chunks of 48 frames; scales
cleanly to 60 / 120 / 240 fps—e.g. 1200 frames for a 5 s 240 fps sequence or 4800 frames for the
full 20 s at 240 fps—and supports 1080p, 4K UHD, and 8K UHD in both desktop 16:9 and portrait 9:16).
Every physical animation driver (approach strobes, wingtip strobes, beacons, goose wingbeats, drone
rotors, radar sweep, cloud drift, condensation streaks) is parameterized in real seconds (frame / fps)
so motion speed stays physically consistent at any frame rate.

Storyboard (normalized u ranges aligned with js/sky.js):
    Shot 1  (u 0.000-0.110)  Cockpit at cruise above clouds pre-dawn: glareshield, glowing PFD/ND
                             displays (blender/make_textures.py), window frames, dual yokes,
                             gloved pilot hands, Nishita pre-dawn sky with fading stars.
    Shot 2  (u 0.110-0.235)  Descent through heterogeneous 3D volumetric clouds: wind-sheared
                             moisture streaks on Fresnel glass, cloud light flicker, brief whiteout.
    Shot 3  (u 0.235-0.360)  Breakout beneath clouds over a snowy airport at dawn: cockpit breakout
                             (0.235-0.300) into exterior establishing shot (0.300-0.360) of the 3 km
                             runway with ICAO markings, sequenced approach strobes, PAPI (2 red / 2
                             white), snow terrain, and the 747SP on a 3-degree glideslope.
    Shot 4  (u 0.360-0.450)  Cinematic chase cam of the airliner: volumetric landing light beams &
                             cones through winter mist, flashing strobes, wingtip vortices.
    Shot 5  (u 0.450-0.530)  Flock of 60 banking/flapping Canada geese crossing the approach path
                             (0.450-0.500) + hovering quadcopter drone with blinking nav lights
                             and motion-blurred rotors near the perimeter fence (0.500-0.530).
    Shot 6  (u 0.530-0.640)  Sky Sentry camera POV framing the crossing flock & approach corridor
                             (clean optical framing ready for live 2D HTML/canvas detection overlays).
    Shot 7  (u 0.640-0.800)  Control tower interior looking out over the runway: wrap-around ATC
                             consoles, glowing radar & Sky Sentry alert screens, flashing red alert
                             beacon, silhouetted seated controllers.
    Shot 8  (u 0.800-1.000)  Go-around: pitch up and climb over the flock with jet-blast camera shake
                             (0.800-0.880), cut back to cockpit climbing into clouds (0.880-1.000),
                             smooth fade to white (0.940-1.000).

Assets & fallbacks:
    * Runway markings and cockpit PFD/ND PNGs are auto-generated via blender/make_textures.py into
      blender/tex/ when missing (with procedural shader fallbacks if Pillow is unavailable).
    * Boeing 747SP geometry is imported from assets/models/b747.glb with a fictional "Skyline" livery
      shader (falls back to a procedural widebody mesh if b747.glb is absent).
    * Poly Haven CC0 snow/asphalt textures from assets/textures/ are loaded when present (with
      procedural PBR fallbacks otherwise).
    * Controllers sit under CONTROLLER_1 / CONTROLLER_2 empties so Mixamo characters can replace them.

Run (from the repo root):
    blender -b -P blender/build_sky.py -- --out renders/sky --res desktop --frames 1-480
    blender -b -P blender/build_sky.py -- --out renders/sky --res portrait --frames 1-480
    blender -b -P blender/build_sky.py -- --fps 240 --duration 5 --uhd 8k --frames 1-1200
    blender -b -P blender/build_sky.py -- --fps 240 --total-frames 4800 --uhd 4k --frames 1-240
    blender -b -P blender/build_sky.py -- --shot 4 --preview --save renders/sky/sky.blend
    blender -b -P blender/build_sky.py -- --no-render --save renders/sky/sky.blend
"""
import math
import os
import random
import subprocess
import sys

import bpy
import bmesh
from mathutils import Euler, Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)) if '__file__' in globals() else os.getcwd())
import common as C  # noqa: E402

# ------------------------------------------------------------------------------------------------ constants
DEFAULT_DURATION_S = 20.0
DEG = math.pi / 180.0
TAN3 = math.tan(3.0 * DEG)

RUNWAY_L = 3000.0
RUNWAY_W = 45.0
AIM_X = 400.0            # aiming point 400 m past threshold (matches make_textures.py)
CLOUD_BASE = 420.0       # overcast base (m)
CLOUD_TOP = 1480.0       # overcast top (m)

TOWER_POS = Vector((115.0, 178.0, 0.0))
TOWER_CAB_Z = 34.0
SENTRY_POS = Vector((-45.0, -74.0, 1.65))
DRONE_POS = Vector((-290.0, -110.0, 18.0))

# Resolution tiers (desktop 16:9, portrait 9:16)
UHD_RES = {
    '1080p': {'desktop': (1920, 1080), 'portrait': (1080, 1920)},
    '4k':    {'desktop': (3840, 2160), 'portrait': (2160, 3840)},
    '8k':    {'desktop': (7680, 4320), 'portrait': (4320, 7680)},
}

# Normalized shot boundaries u in [0, 1] aligned with js/sky.js
SHOT_U = {
    1: (0.000, 0.110),   # Cruise above clouds (pre-dawn cockpit)
    2: (0.110, 0.235),   # Descent through volumetric clouds + moisture streaks + whiteout
    3: (0.235, 0.360),   # Breakout over snowy airport (0.235-0.300 cockpit, 0.300-0.360 exterior)
    4: (0.360, 0.450),   # Cinematic chase cam of the airliner
    5: (0.450, 0.530),   # Flock of 60 geese (0.450-0.500) + quadcopter drone (0.500-0.530)
    6: (0.530, 0.640),   # Sky Sentry camera POV
    7: (0.640, 0.800),   # Control tower interior
    8: (0.800, 1.000),   # Go-around (0.800-0.880 exterior climb + shake, 0.880-1.000 cockpit + fade to white)
}

# Exact normalized hard-cut timestamps (u_end of outgoing shot -> next frame is incoming shot)
HARD_CUT_U = (0.208, 0.300, 0.360, 0.450, 0.500, 0.530, 0.640, 0.800, 0.880)


def gs_z(x):
    """3-degree glideslope altitude (m) targeting AIM_X."""
    return max(0.0, (AIM_X - x) * TAN3)


def clamp(v, lo=0.0, hi=1.0):
    return lo if v < lo else (hi if v > hi else v)


def smoothstep(a, b, x):
    t = clamp((x - a) / max(1e-6, b - a))
    return t * t * (3.0 - 2.0 * t)


def lerp(a, b, t):
    return a + (b - a) * t


def lerp_vec(a, b, t):
    return a.lerp(b, clamp(t))


class Timeline:
    """Maps normalized progress u in [0, 1] cleanly to integer frame numbers [1, total_frames]
    and converts real-world frequencies (Hz) to per-frame rates at any FPS (24/60/120/240)."""

    def __init__(self, total_frames, fps):
        self.total = max(24, int(total_frames))
        self.fps = max(1, int(fps))
        self.duration = self.total / float(self.fps)

    def frame(self, u):
        """Convert normalized u in [0, 1] to integer frame in [1, total]."""
        return max(1, min(self.total, int(round(1.0 + clamp(u) * (self.total - 1)))))

    def u(self, frame):
        """Convert 1-based frame to normalized progress u in [0, 1]."""
        return clamp((float(frame) - 1.0) / max(1.0, float(self.total - 1)))

    def seconds(self, frame):
        return (float(frame) - 1.0) / float(self.fps)

    def shot_range(self, shot_idx):
        u0, u1 = SHOT_U[shot_idx]
        f0 = 1 if shot_idx == 1 else self.frame(u0) + 1
        f1 = self.total if shot_idx == 8 else self.frame(u1)
        return (min(f0, f1), f1)

    def cut_frames(self):
        cuts = sorted({self.frame(u) for u in HARD_CUT_U if 1 <= self.frame(u) < self.total})
        return cuts

    def sample_frames(self, f_start, f_end, target_samples=64):
        """Evenly spaced integer frames covering [f_start, f_end] inclusive without blowing up high-FPS builds."""
        f_start = max(1, int(f_start))
        f_end = min(self.total, int(f_end))
        if f_end <= f_start:
            return [f_start]
        span = f_end - f_start
        step = max(1, span // max(1, int(target_samples)))
        pts = list(range(f_start, f_end + 1, step))
        if pts[-1] != f_end:
            pts.append(f_end)
        return pts

    def rad_per_frame(self, hz):
        return 2.0 * math.pi * float(hz) / float(self.fps)


def extra_args(p):
    p.add_argument('--fps', type=int, default=C.FPS,
                   help='frames per second (e.g. 24, 60, 100, 120, 240; default 24; 100 fps = 2000 frames for 20 s)')
    p.add_argument('--duration', type=float, default=None,
                   help='clip duration in seconds (default 20 s; e.g. --fps 240 --duration 5 -> 1200 frames)')
    p.add_argument('--total-frames', type=int, default=None,
                   help='full timeline length when rendering a sub-range with --frames (for multi-machine splits)')
    p.add_argument('--uhd', choices=['1080p', '4k', '8k'], default='1080p',
                   help='resolution tier: 1080p (1920x1080), 4k (3840x2160), or 8k (7680x4320) desktop/portrait')
    p.add_argument('--shot', type=int, choices=range(1, 9), default=None,
                   help='override --frames to render a single storyboard shot (1-8)')
    p.add_argument('--designation', default='09', help='runway designation for make_textures.py (default 09)')
    p.add_argument('--flock-count', type=int, default=60, help='number of geese in the flock (default 60)')
    p.add_argument('--no-clouds', action='store_true', help='skip heavy cloud volumes (faster test renders)')
    p.add_argument('--no-vortices', action='store_true', help='skip wingtip vortex particle systems')
    p.add_argument('--no-caustics', action='store_true', help='disable MNEE shadow caustics for faster drafts')


# ------------------------------------------------------------------------------------------------ texture & node helpers
REQUIRED_TEX = (
    'runway_threshold.png',
    'runway_threshold_far.png',
    'runway_middle.png',
    'pfd.png',
    'nd.png',
    'eicas.png',
    'mcp.png',
    'b747_panels_bump.png',
    'b747_panels_rough.png',
    'atc_stars.png',
    'atc_asdex.png',
    'atc_tfdm.png',
    'atc_ids4.png',
    'atc_weather.png',
    'atc_sentry_alert.png',
    'atc_comms.png',
    'atc_flightplan.png',
    'goose_plumage.png',
)


def ensure_textures(designation='09'):
    """Auto-invoke blender/make_textures.py if blender/tex/*.png are missing."""
    sdir = C.script_dir()
    tex_dir = os.path.join(sdir, 'tex')
    missing = [f for f in REQUIRED_TEX if not os.path.exists(os.path.join(tex_dir, f))]
    if not missing:
        return tex_dir
    maker = os.path.join(sdir, 'make_textures.py')
    if not os.path.exists(maker):
        C.warn('make_textures.py not found at %s; using procedural fallbacks' % maker)
        return tex_dir

    candidates = ['python3', 'python', 'py', sys.executable]
    for exe in candidates:
        if not exe:
            continue
        cmd = [exe, maker, '--out', tex_dir, '--designation', str(designation)]
        try:
            res = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
            if res.returncode == 0:
                still_missing = [f for f in REQUIRED_TEX if not os.path.exists(os.path.join(tex_dir, f))]
                if not still_missing:
                    print('[film-kit] generated runway & cockpit textures via %s' % exe)
                    return tex_dir
        except (OSError, subprocess.SubprocessError):
            continue

    C.warn('could not auto-run make_textures.py (missing Python/Pillow on PATH). '
           'Run `pip install pillow && python blender/make_textures.py` for crisp ICAO markings & PFD/ND; '
           'continuing with procedural fallbacks.')
    return tex_dir


def mix_rgb(nt, fac, col_a, col_b):
    """Blender 3.x / 4.x compatible color Mix node. Returns (node, output_socket)."""
    try:
        m = nt.nodes.new('ShaderNodeMix')
        m.data_type = 'RGBA'
        m.clamp_factor = True
        in_fac = next(s for s in m.inputs if s.type == 'VALUE')
        cols = [s for s in m.inputs if s.type == 'RGBA']
        out_col = next(s for s in m.outputs if s.type == 'RGBA')
        if isinstance(fac, (int, float)):
            in_fac.default_value = float(fac)
        else:
            nt.links.new(fac, in_fac)
        if isinstance(col_a, (tuple, list)):
            cols[0].default_value = col_a
        else:
            nt.links.new(col_a, cols[0])
        if isinstance(col_b, (tuple, list)):
            cols[1].default_value = col_b
        else:
            nt.links.new(col_b, cols[1])
        return m, out_col
    except RuntimeError:
        m = nt.nodes.new('ShaderNodeMixRGB')
        m.use_clamp = True
        if isinstance(fac, (int, float)):
            m.inputs['Fac'].default_value = float(fac)
        else:
            nt.links.new(fac, m.inputs['Fac'])
        if isinstance(col_a, (tuple, list)):
            m.inputs['Color1'].default_value = col_a
        else:
            nt.links.new(col_a, m.inputs['Color1'])
        if isinstance(col_b, (tuple, list)):
            m.inputs['Color2'].default_value = col_b
        else:
            nt.links.new(col_b, m.inputs['Color2'])
        return m, m.outputs['Color']


def drive_mapping_channel(nt, mapping_node, input_name, axis_idx, expression):
    """Drive one axis (0=X, 1=Y, 2=Z) of a Mapping node's vector input using a scalar Value node
    + CombineXYZ so common.frame_driver always receives a scalar socket (never a 3-element vector)."""
    val = nt.nodes.new('ShaderNodeValue')
    C.frame_driver(val.outputs[0], expression)
    comb = nt.nodes.new('ShaderNodeCombineXYZ')
    nt.links.new(val.outputs[0], comb.inputs[axis_idx])
    nt.links.new(comb.outputs['Vector'], mapping_node.inputs[input_name])
    return val


def safe_load_image(path, non_color=False):
    if path:
        ap = os.path.abspath(path)
        if os.path.exists(ap):
            img = bpy.data.images.load(ap, check_existing=True)
            if non_color:
                try:
                    img.colorspace_settings.name = 'Non-Color'
                except TypeError:
                    pass
            return img
    return None


def enable_caustics_light(light_obj):
    """Enable MNEE shadow caustics on a light without emitting spurious Blender 4.x warnings."""
    ld = getattr(light_obj, 'data', None)
    lc = getattr(ld, 'cycles', None)
    if lc is not None and hasattr(lc, 'is_caustics_light'):
        lc.is_caustics_light = True
        return
    if ld is not None and hasattr(ld, 'is_caustics_light'):
        ld.is_caustics_light = True
        return
    C.caustics_light(light_obj)


def disable_shadow_rays(obj):
    """Keep thin architectural glass or light cones from casting opaque shadows in Cycles."""
    if not C.try_set(obj, 'visible_shadow', False):
        try:
            obj.cycles_visibility.shadow = False
        except AttributeError:
            pass


def set_visibility_ranges(obj, visible_ranges, total_frames):
    """Keyframe hide_render and hide_viewport so obj is visible ONLY within visible_ranges [(a, b), ...]."""
    def is_vis(f):
        return any(a <= f <= b for a, b in visible_ranges)

    key_frames = {1, total_frames}
    for a, b in visible_ranges:
        for f in (a - 1, a, b, b + 1):
            if 1 <= f <= total_frames:
                key_frames.add(f)
    for f in sorted(key_frames):
        hide = not is_vis(f)
        obj.hide_render = hide
        obj.hide_viewport = hide
        obj.keyframe_insert('hide_render', frame=f)
        obj.keyframe_insert('hide_viewport', frame=f)
    for fc in C.iter_fcurves(obj):
        if fc.data_path in ('hide_render', 'hide_viewport'):
            for kp in fc.keyframe_points:
                kp.interpolation = 'CONSTANT'


def make_bar(name, p0, p1, thickness, col, mat, radius=None):
    """Create a box or cylinder strut spanning p0 -> p1."""
    a, b = Vector(p0), Vector(p1)
    d = b - a
    length = d.length
    if length < 1e-5:
        return None
    mid = (a + b) * 0.5
    if radius is not None:
        o = C.cylinder(name, radius=radius, depth=length, location=mid, col=col, mat=mat, segments=12)
    else:
        o = C.box(name, (thickness, thickness, length), location=mid, col=col, mat=mat)
    o.rotation_euler = d.normalized().to_track_quat('Z', 'Y').to_euler()
    return o


# ------------------------------------------------------------------------------------------------ flight physics
def airliner_state(u, t_sec=None):
    """Analytical flight trajectory for Skyline 902 Heavy parameterized by normalized progress u in [0, 1].

    Returns dict: pos (Vector), pitch (deg, +nose up), roll (deg, +right wing down),
                  gear (0..1), thrust (0..1), in_cloud (0..1).
    """
    u = clamp(u)
    t_s = (u * DEFAULT_DURATION_S) if t_sec is None else t_sec

    # Shot 1 (u 0.000..0.110): Pre-dawn cruise above clouds
    if u <= 0.110:
        k = u / 0.110
        x = lerp(-24000.0, -22500.0, k)
        z = lerp(2260.0, 2180.0, k)
        pitch = lerp(1.5, 0.5, smoothstep(0.072, 0.110, u))
        roll = math.sin(t_s * 1.1) * 0.55
        return {'pos': Vector((x, 0.0, z)), 'pitch': pitch, 'roll': roll, 'gear': 0.0, 'thrust': 0.48, 'in_cloud': 0.0}

    # Shot 2a (u 0.110..0.208): Descent through volumetric clouds into dense whiteout
    if u <= 0.208:
        k = (u - 0.110) / (0.208 - 0.110)
        x = lerp(-22500.0, -18500.0, k)
        z = lerp(2180.0, 860.0, smoothstep(0.0, 1.0, k))
        pitch = lerp(0.5, -3.2, smoothstep(0.110, 0.150, u))
        roll = math.sin(t_s * 5.2) * 1.35 + math.sin(t_s * 11.3) * 0.55
        ic = smoothstep(CLOUD_TOP + 60.0, CLOUD_TOP - 160.0, z)
        return {'pos': Vector((x, 0.0, z)), 'pitch': pitch, 'roll': roll, 'gear': 0.0, 'thrust': 0.34, 'in_cloud': ic}

    # Shot 2b (u 0.208..0.235): Post-whiteout reposition onto final 3-deg glideslope just inside cloud base
    if u <= 0.235:
        k = (u - 0.208) / (0.235 - 0.208)
        x = lerp(-2650.0, -2150.0, k)
        z = lerp(430.0, gs_z(-2150.0), smoothstep(0.0, 1.0, k))
        pitch = lerp(-2.5, 2.2, k)
        roll = math.sin(t_s * 4.5) * 0.9 * (1.0 - k)
        ic = smoothstep(CLOUD_BASE - 20.0, CLOUD_BASE + 90.0, z)
        return {'pos': Vector((x, 0.0, z)), 'pitch': pitch, 'roll': roll, 'gear': 1.0, 'thrust': 0.42, 'in_cloud': ic}

    # Shots 3..7 (u 0.235..0.800): Stabilized 3-degree glideslope approach at ~140 kt into threshold 09
    if u <= 0.800:
        knots = (
            (0.235, -2150.0),
            (0.300, -1720.0),
            (0.360, -1380.0),
            (0.450, -960.0),
            (0.530, -760.0),
            (0.640, -590.0),
            (0.760, -410.0),
            (0.800, -340.0),
        )
        x = knots[-1][1]
        for i in range(len(knots) - 1):
            u0, x0 = knots[i]
            u1, x1 = knots[i + 1]
            if u <= u1:
                x = lerp(x0, x1, (u - u0) / max(1e-6, u1 - u0))
                break
        ga_start = smoothstep(0.770, 0.800, u)
        z = gs_z(x) + ga_start * 10.0
        pitch = lerp(2.6, 8.5, ga_start)
        roll = math.sin(t_s * 1.6) * 0.5
        thrust = lerp(0.45, 0.96, ga_start)
        return {'pos': Vector((x, 0.0, z)), 'pitch': pitch, 'roll': roll, 'gear': 1.0, 'thrust': thrust, 'in_cloud': 0.0}

    # Shot 8a (u 0.800..0.880): Low-angle go-around climbing cleanly over the flock at x ~ -160, z ~ 40
    if u <= 0.880:
        k = (u - 0.800) / (0.880 - 0.800)
        x = lerp(-340.0, 95.0, k)
        z = lerp(49.0, 152.0, k ** 1.12)
        pitch = lerp(8.5, 15.5, smoothstep(0.800, 0.838, u))
        roll = math.sin(t_s * 3.3) * 1.05
        gear = 1.0 - smoothstep(0.838, 0.872, u)
        return {'pos': Vector((x, 0.0, z)), 'pitch': pitch, 'roll': roll, 'gear': gear, 'thrust': 1.0, 'in_cloud': 0.0}

    # Shot 8b (u 0.880..1.000): Cockpit climb back into volumetric cloud deck -> fade to white
    k = (u - 0.880) / (1.000 - 0.880)
    x = lerp(95.0, 3200.0, k)
    z = lerp(155.0, 1180.0, k)
    pitch = lerp(15.2, 11.5, k)
    roll = math.sin(t_s * 3.8) * 0.85
    ic = smoothstep(CLOUD_BASE - 30.0, CLOUD_BASE + 160.0, z)
    return {'pos': Vector((x, 0.0, z)), 'pitch': pitch, 'roll': roll, 'gear': 0.0, 'thrust': 0.98, 'in_cloud': ic}


def airliner_matrix(st):
    """World matrix of AIRLINER empty (+X forward, +Z up; +pitch raises nose = negative Y Euler)."""
    rot = Euler((st['roll'] * DEG, -st['pitch'] * DEG, 0.0), 'XYZ').to_matrix().to_4x4()
    return Matrix.Translation(st['pos']) @ rot


def flock_center(u):
    """Flock center sweeping across the approach corridor right in front of the threshold & tower cab
    (x ~ -160..-230 m, y sweeping +115..-75 m, z ~ 40 m)."""
    k = clamp((u - 0.340) / (0.940 - 0.340))
    x = -215.0 + math.sin(k * 3.0) * 32.0 + 55.0 * k
    y = lerp(120.0, -75.0, k)
    z = 41.0 + math.sin(k * 4.5) * 4.5
    return Vector((x, y, z))


# ------------------------------------------------------------------------------------------------ world & sky
def build_world_and_sun(scene, col, tl, use_caustics=True):
    """Physically-based Nishita sky (Rayleigh/Mie/ozone scattering) transitioning pre-dawn -> golden winter
    dawn with fading starfield + low-angle grazing dawn sun lamp for realistic metallic glints & shadows."""
    world = C.nishita_world(
        scene,
        sun_elevation=-1.0,
        sun_rotation=-58.0,
        strength=0.68,
        altitude=2250.0,
        air=1.35,
        dust=1.65,
        ozone=2.3,
        sun_disc=True,
        sun_intensity=1.1,
        stars=1.6,
        name='SkySentrySky',
    )
    sky = C.sky_node(world)
    bg = world.node_tree.nodes[world['bg_node']]
    stars_node = world.node_tree.nodes.get(world.get('stars_node', ''))

    sky_keys = (
        (0.000, -1.0, 2250.0, 0.68, 1.60),
        (0.110, -0.4, 2150.0, 0.76, 1.10),
        (0.208,  0.6,  900.0, 0.88, 0.15),
        (0.235,  2.2,  350.0, 1.00, 0.00),
        (0.530,  2.8,  120.0, 1.05, 0.00),
        (0.640,  3.2,   60.0, 1.12, 0.00),
        (0.800,  3.6,  150.0, 1.15, 0.00),
        (1.000,  4.4, 1150.0, 1.38, 0.00),
    )
    for u, el, alt, st, star_v in sky_keys:
        f = tl.frame(u)
        if hasattr(sky, 'sun_elevation'):
            sky.sun_elevation = C.deg(el)
            sky.keyframe_insert('sun_elevation', frame=f)
        if hasattr(sky, 'altitude'):
            sky.altitude = alt
            sky.keyframe_insert('altitude', frame=f)
        C.key_socket(bg.inputs['Strength'], f, st)
        if stars_node is not None:
            C.key_socket(stars_node.inputs['Color'], f, (star_v, star_v * 1.03, star_v * 1.15, 1.0))

    # Grazing golden winter dawn sun lamp casting crisp shadows and glinting off 747SP aluminum panels
    sun = C.sun_lamp('DAWN_SUN', elevation=6.2, azimuth=58.0, energy=2.4, angle=0.55, col=col,
                     color=(1.0, 0.80, 0.62))
    if use_caustics:
        enable_caustics_light(sun)
    for u, en in ((0.000, 0.65), (0.110, 1.0), (0.195, 0.25), (0.218, 0.25),
                  (0.235, 2.8), (0.640, 3.2), (0.940, 3.5)):
        sun.data.energy = en
        sun.data.keyframe_insert('energy', frame=tl.frame(u))
    return world, sun


# ------------------------------------------------------------------------------------------------ clouds & mist
def build_clouds(col, airliner, tl, skip_clouds=False):
    """Heterogeneous 3D volumetric cloud deck (420..1480 m) with Henyey-Greenstein forward scattering,
    localized descent/climb cockpit cloud wisps, and winter approach corridor mist."""
    if skip_clouds:
        return []
    objs = []

    # 1) Main heterogeneous 3D volumetric cloud deck spanning cruise & approach horizon
    mat_deck = bpy.data.materials.new('VolumetricCloudDeck')
    mat_deck.use_nodes = True
    nt = mat_deck.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    vol = nt.nodes.new('ShaderNodeVolumePrincipled')
    vol.inputs['Color'].default_value = (0.94, 0.96, 0.99, 1.0)
    vol.inputs['Anisotropy'].default_value = 0.74  # strong Mie/Henyey-Greenstein forward scattering
    vol.inputs['Absorption Color'].default_value = (0.80, 0.86, 0.94, 1.0)

    tc = nt.nodes.new('ShaderNodeTexCoord')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(tc.outputs['Generated'], sep.inputs[0])

    # Vertical envelope: soft cloud base (0..0.16) and billowing cumulus tops (0.72..1.0)
    bot = nt.nodes.new('ShaderNodeMapRange')
    bot.inputs[1].default_value = 0.0
    bot.inputs[2].default_value = 0.16
    top = nt.nodes.new('ShaderNodeMapRange')
    top.inputs[1].default_value = 0.72
    top.inputs[2].default_value = 1.0
    top.inputs[3].default_value = 1.0
    top.inputs[4].default_value = 0.0
    nt.links.new(sep.outputs['Z'], bot.inputs[0])
    nt.links.new(sep.outputs['Z'], top.inputs[0])
    v_env = nt.nodes.new('ShaderNodeMath')
    v_env.operation = 'MULTIPLY'
    nt.links.new(bot.outputs[0], v_env.inputs[0])
    nt.links.new(top.outputs[0], v_env.inputs[1])

    # Multi-octave 3D cloud billows with physically time-scaled wind drift
    mp = nt.nodes.new('ShaderNodeMapping')
    mp.inputs['Scale'].default_value = (0.00048, 0.00048, 0.0014)
    drive_mapping_channel(nt, mp, 'Location', 0, 'frame * %.6f' % (0.048 / tl.fps))
    nt.links.new(tc.outputs['Object'], mp.inputs['Vector'])

    n1 = nt.nodes.new('ShaderNodeTexNoise')
    n1.inputs['Scale'].default_value = 1.0
    n1.inputs['Detail'].default_value = 7.0
    n1.inputs['Roughness'].default_value = 0.60
    nt.links.new(mp.outputs['Vector'], n1.inputs['Vector'])

    n2 = nt.nodes.new('ShaderNodeTexNoise')
    n2.inputs['Scale'].default_value = 4.4
    n2.inputs['Detail'].default_value = 5.0
    n2.inputs['Roughness'].default_value = 0.56
    nt.links.new(mp.outputs['Vector'], n2.inputs['Vector'])

    n2_s = nt.nodes.new('ShaderNodeMath')
    n2_s.operation = 'MULTIPLY'
    n2_s.inputs[1].default_value = 0.24
    nt.links.new(n2.outputs['Fac'], n2_s.inputs[0])

    comb = nt.nodes.new('ShaderNodeMath')
    comb.operation = 'MULTIPLY_ADD'
    comb.inputs[1].default_value = 0.76
    nt.links.new(n1.outputs['Fac'], comb.inputs[0])
    nt.links.new(n2_s.outputs[0], comb.inputs[2])

    cov = nt.nodes.new('ShaderNodeMapRange')
    cov.inputs[1].default_value = 0.43
    cov.inputs[2].default_value = 0.66
    cov.inputs[3].default_value = 0.0
    cov.inputs[4].default_value = 0.017
    nt.links.new(comb.outputs[0], cov.inputs[0])

    dens = nt.nodes.new('ShaderNodeMath')
    dens.operation = 'MULTIPLY'
    nt.links.new(cov.outputs[0], dens.inputs[0])
    nt.links.new(v_env.outputs[0], dens.inputs[1])
    nt.links.new(dens.outputs[0], vol.inputs['Density'])
    nt.links.new(vol.outputs[0], out.inputs['Volume'])

    deck = C.box('CloudDeck', (72000.0, 56000.0, CLOUD_TOP - CLOUD_BASE),
                 (0.0, 0.0, (CLOUD_BASE + CLOUD_TOP) * 0.5), col, mat_deck)
    objs.append(deck)

    # 2) High-detail local cloud volume around cockpit during Shot 2 descent & Shot 8b climb
    mat_local = bpy.data.materials.new('CockpitCloudMist')
    mat_local.use_nodes = True
    nt2 = mat_local.node_tree
    nt2.nodes.clear()
    out2 = nt2.nodes.new('ShaderNodeOutputMaterial')
    vol2 = nt2.nodes.new('ShaderNodeVolumePrincipled')
    vol2.inputs['Color'].default_value = (0.96, 0.97, 1.0, 1.0)
    vol2.inputs['Anisotropy'].default_value = 0.76

    tc2 = nt2.nodes.new('ShaderNodeTexCoord')
    mp2 = nt2.nodes.new('ShaderNodeMapping')
    mp2.inputs['Scale'].default_value = (0.045, 0.045, 0.06)
    drive_mapping_channel(nt2, mp2, 'Location', 0, 'frame * %.6f' % (20.0 / tl.fps))
    nt2.links.new(tc2.outputs['Object'], mp2.inputs['Vector'])

    nf = nt2.nodes.new('ShaderNodeTexNoise')
    nf.inputs['Scale'].default_value = 1.7
    nf.inputs['Detail'].default_value = 6.0
    nf.inputs['Roughness'].default_value = 0.62
    nt2.links.new(mp2.outputs['Vector'], nf.inputs['Vector'])

    base_d = nt2.nodes.new('ShaderNodeValue')
    base_d.name = base_d.label = 'CLOUD_DENSITY'
    for u, v in (
        (0.000, 0.0), (0.120, 0.0), (0.145, 0.028), (0.170, 0.060),
        (0.192, 0.15), (0.206, 0.25), (0.218, 0.11), (0.232, 0.015), (0.242, 0.0),
        (0.895, 0.0), (0.920, 0.045), (0.958, 0.15), (1.000, 0.24),
    ):
        C.key_socket(base_d.outputs[0], tl.frame(u), v)

    mod = nt2.nodes.new('ShaderNodeMapRange')
    mod.inputs[1].default_value = 0.25
    mod.inputs[2].default_value = 0.75
    mod.inputs[3].default_value = 0.35
    mod.inputs[4].default_value = 1.65
    nt2.links.new(nf.outputs['Fac'], mod.inputs[0])

    mul2 = nt2.nodes.new('ShaderNodeMath')
    mul2.operation = 'MULTIPLY'
    nt2.links.new(base_d.outputs[0], mul2.inputs[0])
    nt2.links.new(mod.outputs[0], mul2.inputs[1])
    nt2.links.new(mul2.outputs[0], vol2.inputs['Density'])
    nt2.links.new(vol2.outputs[0], out2.inputs['Volume'])

    local_box = C.box('CockpitCloudEnvelope', (120.0, 90.0, 70.0), (35.0, 0.0, 6.8), col, mat_local)
    local_box.parent = airliner
    set_visibility_ranges(local_box, [(tl.frame(0.118), tl.frame(0.246)), (tl.frame(0.885), tl.total)], tl.total)
    objs.append(local_box)

    # 3) Winter mist layer along the approach corridor so landing & approach spotlights cast volumetric beams
    mat_mist = C.volume_material('ApproachMist', density=0.00042, color=(0.86, 0.90, 0.96, 1.0),
                                 anisotropy=0.76, absorption=(0.88, 0.92, 0.98, 1.0))
    mist = C.box('ApproachMistVolume', (9200.0, 1800.0, 260.0), (-2600.0, 0.0, 130.0), col, mat_mist)
    set_visibility_ranges(mist, [(tl.frame(0.235), tl.frame(0.895))], tl.total)
    objs.append(mist)

    return objs


# ------------------------------------------------------------------------------------------------ airport & snow
def make_snow_terrain_material(repo):
    """Snowy aerial ground using Poly Haven snow_field_aerial maps + subsurface scattering & ice glint."""
    mat = C.material('SnowTerrain', Base_Color=(0.87, 0.91, 0.95, 1.0), Roughness=0.76,
                     Subsurface_Weight=0.22, Specular_IOR_Level=0.45, Coat_Weight=0.18, Coat_Roughness=0.25)
    nt = mat.node_tree
    bsdf = C.bsdf_of(mat)
    try:
        C.set_input(bsdf, 'Subsurface Radius', (0.55, 0.80, 1.0))
    except Exception:
        pass
    tex_root = os.path.join(repo, 'assets', 'textures')
    diff_p = os.path.join(tex_root, 'snow_field_aerial_diff.jpg')
    nor_p = os.path.join(tex_root, 'snow_field_aerial_nor_gl.jpg')
    rgh_p = os.path.join(tex_root, 'snow_field_aerial_rough.jpg')

    tc = nt.nodes.new('ShaderNodeTexCoord')
    mp = nt.nodes.new('ShaderNodeMapping')
    mp.inputs['Scale'].default_value = (120.0, 120.0, 1.0)
    nt.links.new(tc.outputs['UV'], mp.inputs['Vector'])

    img_d = safe_load_image(diff_p, non_color=False)
    if img_d is not None:
        tex_d = nt.nodes.new('ShaderNodeTexImage')
        tex_d.image = img_d
        nt.links.new(mp.outputs['Vector'], tex_d.inputs['Vector'])
        noise = nt.nodes.new('ShaderNodeTexNoise')
        noise.inputs['Scale'].default_value = 0.0005
        noise.inputs['Detail'].default_value = 5.0
        nt.links.new(tc.outputs['Object'], noise.inputs['Vector'])
        mr = nt.nodes.new('ShaderNodeMapRange')
        mr.inputs[1].default_value = 0.35
        mr.inputs[2].default_value = 0.72
        mr.inputs[3].default_value = 0.0
        mr.inputs[4].default_value = 0.35
        nt.links.new(noise.outputs['Fac'], mr.inputs[0])
        _, col_out = mix_rgb(nt, mr.outputs[0], tex_d.outputs['Color'], (0.86, 0.90, 0.95, 1.0))
        nt.links.new(col_out, bsdf.inputs['Base Color'])
    else:
        C.warn('snow_field_aerial_diff.jpg missing; using procedural snow terrain shader')
        noise = nt.nodes.new('ShaderNodeTexNoise')
        noise.inputs['Scale'].default_value = 0.003
        noise.inputs['Detail'].default_value = 6.0
        nt.links.new(tc.outputs['Object'], noise.inputs['Vector'])
        _, col_out = mix_rgb(nt, noise.outputs['Fac'], (0.76, 0.81, 0.87, 1.0), (0.93, 0.95, 0.98, 1.0))
        nt.links.new(col_out, bsdf.inputs['Base Color'])

    img_r = safe_load_image(rgh_p, non_color=True)
    if img_r is not None:
        tex_r = nt.nodes.new('ShaderNodeTexImage')
        tex_r.image = img_r
        nt.links.new(mp.outputs['Vector'], tex_r.inputs['Vector'])
        nt.links.new(tex_r.outputs['Color'], bsdf.inputs['Roughness'])

    img_n = safe_load_image(nor_p, non_color=True)
    if img_n is not None:
        tex_n = nt.nodes.new('ShaderNodeTexImage')
        tex_n.image = img_n
        nt.links.new(mp.outputs['Vector'], tex_n.inputs['Vector'])
        nmap = nt.nodes.new('ShaderNodeNormalMap')
        nmap.inputs['Strength'].default_value = 0.45
        nt.links.new(tex_n.outputs['Color'], nmap.inputs['Color'])
        nt.links.new(nmap.outputs['Normal'], bsdf.inputs['Normal'])
    return mat


def make_runway_section_material(name, paint_png, repo, v_repeat=1.0):
    """Asphalt + cold specular ice sheen + snow edge dusting + crisp white ICAO paint mask."""
    mat = C.material(name, Base_Color=(0.14, 0.15, 0.17, 1.0), Roughness=0.68,
                     Specular_IOR_Level=0.52, Coat_Weight=0.22, Coat_Roughness=0.18)
    nt = mat.node_tree
    bsdf = C.bsdf_of(mat)
    tc = nt.nodes.new('ShaderNodeTexCoord')

    tex_root = os.path.join(repo, 'assets', 'textures')
    asp_mp = nt.nodes.new('ShaderNodeMapping')
    asp_mp.inputs['Scale'].default_value = (3.2, 125.0 if v_repeat > 1.0 else 42.0, 1.0)
    nt.links.new(tc.outputs['UV'], asp_mp.inputs['Vector'])

    img_ad = safe_load_image(os.path.join(tex_root, 'asphalt_snow_diff.jpg'), non_color=False)
    if img_ad is not None:
        td = nt.nodes.new('ShaderNodeTexImage')
        td.image = img_ad
        nt.links.new(asp_mp.outputs['Vector'], td.inputs['Vector'])
        asp_col = td.outputs['Color']
    else:
        n_asp = nt.nodes.new('ShaderNodeTexNoise')
        n_asp.inputs['Scale'].default_value = 35.0
        n_asp.inputs['Detail'].default_value = 6.0
        nt.links.new(asp_mp.outputs['Vector'], n_asp.inputs['Vector'])
        _, asp_col = mix_rgb(nt, n_asp.outputs['Fac'], (0.09, 0.10, 0.12, 1.0), (0.18, 0.19, 0.21, 1.0))

    # Modulate roughness with cold black-ice patches so approach & landing lights reflect wetly off the runway
    ice_n = nt.nodes.new('ShaderNodeTexNoise')
    ice_n.inputs['Scale'].default_value = 6.5
    ice_n.inputs['Detail'].default_value = 4.0
    nt.links.new(asp_mp.outputs['Vector'], ice_n.inputs['Vector'])
    ice_mr = nt.nodes.new('ShaderNodeMapRange')
    ice_mr.inputs[1].default_value = 0.35
    ice_mr.inputs[2].default_value = 0.72
    ice_mr.inputs[3].default_value = 0.22
    ice_mr.inputs[4].default_value = 0.82
    nt.links.new(ice_n.outputs['Fac'], ice_mr.inputs[0])

    img_ar = safe_load_image(os.path.join(tex_root, 'asphalt_snow_rough.jpg'), non_color=True)
    if img_ar is not None:
        tr = nt.nodes.new('ShaderNodeTexImage')
        tr.image = img_ar
        nt.links.new(asp_mp.outputs['Vector'], tr.inputs['Vector'])
        r_mul = nt.nodes.new('ShaderNodeMath')
        r_mul.operation = 'MULTIPLY'
        nt.links.new(tr.outputs['Color'], r_mul.inputs[0])
        nt.links.new(ice_mr.outputs[0], r_mul.inputs[1])
        nt.links.new(r_mul.outputs[0], bsdf.inputs['Roughness'])
    else:
        nt.links.new(ice_mr.outputs[0], bsdf.inputs['Roughness'])

    img_an = safe_load_image(os.path.join(tex_root, 'asphalt_snow_nor_gl.jpg'), non_color=True)
    if img_an is not None:
        tn = nt.nodes.new('ShaderNodeTexImage')
        tn.image = img_an
        nt.links.new(asp_mp.outputs['Vector'], tn.inputs['Vector'])
        nm = nt.nodes.new('ShaderNodeNormalMap')
        nm.inputs['Strength'].default_value = 0.55
        nt.links.new(tn.outputs['Color'], nm.inputs['Color'])
        nt.links.new(nm.outputs['Normal'], bsdf.inputs['Normal'])

    paint_img = safe_load_image(paint_png, non_color=True)
    if paint_img is not None:
        pm = nt.nodes.new('ShaderNodeMapping')
        pm.inputs['Scale'].default_value = (1.0, v_repeat, 1.0)
        nt.links.new(tc.outputs['UV'], pm.inputs['Vector'])
        tp = nt.nodes.new('ShaderNodeTexImage')
        tp.image = paint_img
        tp.extension = 'REPEAT' if v_repeat > 1.0 else 'CLIP'
        nt.links.new(pm.outputs['Vector'], tp.inputs['Vector'])
        paint_fac = tp.outputs['Color']
    else:
        sep = nt.nodes.new('ShaderNodeSeparateXYZ')
        nt.links.new(tc.outputs['UV'], sep.inputs[0])
        sub = nt.nodes.new('ShaderNodeMath')
        sub.operation = 'SUBTRACT'
        sub.inputs[1].default_value = 0.5
        nt.links.new(sep.outputs['X'], sub.inputs[0])
        ab = nt.nodes.new('ShaderNodeMath')
        ab.operation = 'ABSOLUTE'
        nt.links.new(sub.outputs[0], ab.inputs[0])
        cl = nt.nodes.new('ShaderNodeMath')
        cl.operation = 'LESS_THAN'
        cl.inputs[1].default_value = 0.015
        nt.links.new(ab.outputs[0], cl.inputs[0])
        paint_fac = cl.outputs[0]

    _, painted = mix_rgb(nt, paint_fac, asp_col, (0.93, 0.95, 0.97, 1.0))

    # Snow drift along outer runway shoulders
    sep_s = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(tc.outputs['UV'], sep_s.inputs[0])
    sub_s = nt.nodes.new('ShaderNodeMath')
    sub_s.operation = 'SUBTRACT'
    sub_s.inputs[1].default_value = 0.5
    nt.links.new(sep_s.outputs['X'], sub_s.inputs[0])
    abs_s = nt.nodes.new('ShaderNodeMath')
    abs_s.operation = 'ABSOLUTE'
    nt.links.new(sub_s.outputs[0], abs_s.inputs[0])
    edge_snow = nt.nodes.new('ShaderNodeMapRange')
    edge_snow.inputs[1].default_value = 0.43
    edge_snow.inputs[2].default_value = 0.50
    edge_snow.inputs[3].default_value = 0.0
    edge_snow.inputs[4].default_value = 0.78
    nt.links.new(abs_s.outputs[0], edge_snow.inputs[0])

    _, final_col = mix_rgb(nt, edge_snow.outputs[0], painted, (0.90, 0.93, 0.96, 1.0))
    nt.links.new(final_col, bsdf.inputs['Base Color'])
    return mat


def build_airport(col, tex_dir, repo, tl, use_caustics=True):
    """Snowy terrain, mountain ridges, 3 km runway (3 UV-matched sections), taxiways, terminal,
    sequenced approach strobes, PAPI (2 red / 2 white), runway edge lights, and distant city glow."""
    snow_mat = make_snow_terrain_material(repo)
    ground = C.plane('SnowGround', (18000.0, 14000.0), (-2000.0, 0.0, 0.0), col, snow_mat, segments=(40, 30))
    if use_caustics:
        C.caustics_object(ground, receiver=True)

    # Distant snow-dusted mountain ridges along northern & eastern horizon
    def ridge_mesh(bm):
        bmesh.ops.create_grid(bm, x_segments=80, y_segments=16, size=1.0, calc_uvs=True)
        C._fit(bm, (22000.0, 3600.0))
        rng = random.Random(42)
        for v in bm.verts:
            nx = v.co.x / 11000.0
            ny = abs(v.co.y) / 1800.0
            edge = max(0.0, 1.0 - ny)
            h = (math.sin(nx * 9.0) * 0.4 + math.cos(nx * 21.0 + 1.2) * 0.25 + rng.uniform(-0.08, 0.08) + 0.55)
            v.co.z = max(0.0, h * edge * edge * 360.0)

    ridge_mat = C.material('DistantRidge', Base_Color=(0.68, 0.74, 0.82, 1.0), Roughness=0.88)
    C.mesh_object('MountainsNorth', ridge_mesh, col, (-1500.0, 6200.0, -5.0), smooth=True).data.materials.append(ridge_mat)
    r_east = C.mesh_object('MountainsEast', ridge_mesh, col, (7200.0, 0.0, -5.0), smooth=True)
    r_east.rotation_euler = (0.0, 0.0, math.pi * 0.5)
    r_east.data.materials.append(ridge_mat)

    # 3 km x 45 m Runway: 3 seamless UV-aligned sections from blender/make_textures.py
    mat_thr = make_runway_section_material('RunwayThreshold', os.path.join(tex_dir, 'runway_threshold.png'), repo, 1.0)
    mat_mid = make_runway_section_material('RunwayMiddle', os.path.join(tex_dir, 'runway_middle.png'), repo, 36.0)
    mat_far = make_runway_section_material('RunwayThresholdFar', os.path.join(tex_dir, 'runway_threshold_far.png'), repo, 1.0)

    r_near = C.plane('Runway_Near', (RUNWAY_W, 600.0), (300.0, 0.0, 0.08), col, mat_thr)
    r_near.rotation_euler = (0.0, 0.0, -math.pi * 0.5)
    r_mid = C.plane('Runway_Mid', (RUNWAY_W, 1800.0), (1500.0, 0.0, 0.08), col, mat_mid)
    r_mid.rotation_euler = (0.0, 0.0, -math.pi * 0.5)
    r_far = C.plane('Runway_Far', (RUNWAY_W, 600.0), (2700.0, 0.0, 0.08), col, mat_far)
    r_far.rotation_euler = (0.0, 0.0, math.pi * 0.5)
    if use_caustics:
        for rw in (r_near, r_mid, r_far):
            C.caustics_object(rw, receiver=True)

    # Parallel taxiway, connecting turnoffs, apron, and terminal building
    taxi_mat = C.material('Taxiway', Base_Color=(0.18, 0.20, 0.22, 1.0), Roughness=0.80)
    C.plane('TaxiwayParallel', (3200.0, 23.0), (1500.0, 190.0, 0.05), col, taxi_mat)
    for tx in (30.0, 850.0, 1750.0, 2940.0):
        C.plane('TaxiLink_%d' % int(tx), (23.0, 170.0), (tx, 105.0, 0.05), col, taxi_mat)
    C.plane('Apron', (1300.0, 240.0), (1650.0, 340.0, 0.05), col, taxi_mat)

    term_mat = C.material('TerminalWall', Base_Color=(0.56, 0.60, 0.65, 1.0), Roughness=0.55)
    term_glass = C.emission_material('TerminalWin', color=(1.0, 0.86, 0.62, 1.0), strength=4.5)
    roof_snow = C.material('RoofSnow', Base_Color=(0.91, 0.94, 0.97, 1.0), Roughness=0.68, Subsurface_Weight=0.18)
    C.box('TerminalMain', (340.0, 56.0, 16.0), (1680.0, 485.0, 8.0), col, term_mat)
    C.box('TerminalRoof', (342.0, 58.0, 0.7), (1680.0, 485.0, 16.35), col, roof_snow)
    C.box('TerminalGlass', (320.0, 1.0, 7.0), (1680.0, 456.6, 8.5), col, term_glass)

    # Perimeter fence posts near the drone (Shot 5b)
    fence_mat = C.material('FenceSteel', Base_Color=(0.25, 0.27, 0.30, 1.0), Metallic=0.78, Roughness=0.42)
    for i in range(18):
        fx = -490.0 + i * 24.0
        C.cylinder('FencePost_%02d' % i, 0.05, 3.2, (fx, -132.0, 1.6), col, fence_mat, segments=8)
    C.box('FenceRailTop', (410.0, 0.06, 0.06), (-286.0, -132.0, 3.1), col, fence_mat)
    C.box('FenceRailMid', (410.0, 0.06, 0.06), (-286.0, -132.0, 1.7), col, fence_mat)

    # ---- Airfield lighting (shared mesh datablock + per-object material slot) ----
    bm_lamp = bmesh.new()
    bmesh.ops.create_icosphere(bm_lamp, subdivisions=1, radius=0.42)
    me_lamp = bpy.data.meshes.new('AirfieldLampMesh')
    bm_lamp.to_mesh(me_lamp)
    bm_lamp.free()

    mat_edge = C.emission_material('RunwayEdgeLight', color=(1.0, 0.94, 0.80, 1.0), strength=24.0)
    me_lamp.materials.append(mat_edge)

    def place_bulb(name, loc, mat, scale=1.0):
        o = C.link(bpy.data.objects.new(name, me_lamp), col)
        o.location = loc
        o.scale = (scale, scale, scale)
        o.material_slots[0].link = 'OBJECT'
        o.material_slots[0].material = mat
        return o

    mat_thr_g = C.emission_material('ThresholdGreen', color=(0.12, 1.0, 0.36, 1.0), strength=32.0)
    mat_end_r = C.emission_material('RunwayEndRed', color=(1.0, 0.08, 0.04, 1.0), strength=32.0)
    mat_app_w = C.emission_material('ApproachSteady', color=(1.0, 0.92, 0.76, 1.0), strength=28.0)
    mat_app_r = C.emission_material('ApproachSideRed', color=(1.0, 0.12, 0.06, 1.0), strength=26.0)
    mat_taxi_b = C.emission_material('TaxiwayBlue', color=(0.15, 0.48, 1.0, 1.0), strength=14.0)

    for x in range(0, 3001, 60):
        for sy in (-1, 1):
            place_bulb('Edge_%d_%d' % (x, sy), (float(x), sy * 24.5, 0.55), mat_edge, 0.95)
    for k in range(-6, 7):
        place_bulb('ThrG_%d' % k, (-2.0, k * 3.4, 0.55), mat_thr_g, 1.1)
        place_bulb('EndR_%d' % k, (3002.0, k * 3.4, 0.55), mat_end_r, 1.1)
    for x in range(100, 2901, 120):
        place_bulb('TaxiB_%d' % x, (float(x), 176.0, 0.45), mat_taxi_b, 0.75)

    # ALSF-2 Approach lights: steady bars + sequenced "rabbit" strobes sweeping at 2 Hz regardless of FPS
    strobe_w = tl.rad_per_frame(2.0)
    strobe_mats = []
    for idx in range(30):
        sm = C.emission_material('ApproachStrobe_%02d' % idx, color=(0.94, 0.98, 1.0, 1.0), strength=0.0)
        em = sm.node_tree.nodes[sm['emission_node']]
        phase = idx * (2.0 * math.pi / 30.0)
        C.frame_driver(em.inputs['Strength'],
                       '165.0 * pow(max(0.0, sin(frame * %.6f - %.4f)), 24.0)' % (strobe_w, phase))
        strobe_mats.append(sm)

    for idx in range(30):
        x = -900.0 + idx * 30.0
        for dy in (-4.0, -2.0, 0.0, 2.0, 4.0):
            place_bulb('AppBar_%02d_%d' % (idx, int(dy)), (x, dy, 1.1), mat_app_w, 1.05)
        place_bulb('AppStrobe_%02d' % idx, (x, 0.0, 1.75), strobe_mats[idx], 1.55)
        if x >= -300.0:
            for sy in (-1, 1):
                for dy in (12.0, 14.5, 17.0):
                    place_bulb('AppRed_%02d_%d_%d' % (idx, sy, int(dy)), (x, sy * dy, 1.0), mat_app_r, 0.95)
    for sy in (-1, 1):
        for dy in (7.5, 10.0, 12.5, 15.0, 17.5, 20.0):
            place_bulb('DecisionBar_%d_%d' % (sy, int(dy)), (-300.0, sy * dy, 1.1), mat_app_w, 1.1)

    # PAPI (4 boxes on port/+Y side at x = 300 m): 2 WHITE (inner) + 2 RED (outer) = on 3-deg glideslope
    papi_box_mat = C.material('PAPIBox', Base_Color=(0.12, 0.13, 0.15, 1.0), Roughness=0.55)
    papi_w = C.emission_material('PAPIWhite', color=(1.0, 0.97, 0.90, 1.0), strength=58.0)
    papi_r = C.emission_material('PAPIRed', color=(1.0, 0.05, 0.02, 1.0), strength=58.0)
    for k, (py, mat_p) in enumerate(((30.0, papi_w), (37.0, papi_w), (44.0, papi_r), (51.0, papi_r))):
        C.box('PAPI_Housing_%d' % k, (1.4, 2.2, 0.9), (300.0, py, 0.85), col, papi_box_mat)
        place_bulb('PAPI_Lamp_%d' % k, (299.1, py, 0.95), mat_p, 1.6)

    # Distant pre-dawn city horizon lights
    rng = random.Random(109)
    mat_city_a = C.emission_material('CityAmber', color=(1.0, 0.72, 0.36, 1.0), strength=22.0)
    mat_city_w = C.emission_material('CityCool', color=(0.86, 0.92, 1.0, 1.0), strength=18.0)
    for i in range(180):
        ang = rng.uniform(-1.35, 1.35)
        dist = rng.uniform(3400.0, 8200.0)
        cx = 1200.0 + math.cos(ang) * dist
        cy = math.sin(ang) * dist
        if abs(cy) < 600.0 and cx < 3800.0:
            continue
        place_bulb('City_%03d' % i, (cx, cy, rng.uniform(2.0, 14.0)),
                   mat_city_a if rng.random() < 0.72 else mat_city_w, rng.uniform(2.2, 4.2))


# ------------------------------------------------------------------------------------------------ 747SP airliner
def make_skyline_livery_material(ref_obj, tex_dir):
    """Photorealistic fictional 'Skyline' livery in object space (ref_obj: +X nose, +Z up, +-Y wingspan):
    - Box-projected 2048px aluminum skin panel seams, recessed hatches & micro-rivet bump/AO maps
    - Panel-to-panel roughness weathering & airflow streaks for realistic sunlight glints
    - Anisotropic brushed aluminum lower belly & engine nacelles
    - Deep-navy cheatline & tailfin with ice-blue stripe
    - Multi-layered dark-tinted reflective cockpit & cabin windows (IOR Fresnel mirror coat + subtle
      warm interior cabin lighting on selected passenger windows)."""
    mat = C.material('SkylineLivery', Base_Color=(0.94, 0.95, 0.97, 1.0), Metallic=0.14,
                     Roughness=0.25, Coat_Weight=0.88, Coat_Roughness=0.09, Anisotropic=0.38,
                     Specular_IOR_Level=0.62)
    nt = mat.node_tree
    bsdf = C.bsdf_of(mat)
    tc = nt.nodes.new('ShaderNodeTexCoord')
    tc.object = ref_obj
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(tc.outputs['Object'], sep.inputs[0])

    abs_y = nt.nodes.new('ShaderNodeMath')
    abs_y.operation = 'ABSOLUTE'
    nt.links.new(sep.outputs['Y'], abs_y.inputs[0])

    def band(sock, lo, hi):
        g1 = nt.nodes.new('ShaderNodeMath')
        g1.operation = 'GREATER_THAN'
        g1.inputs[1].default_value = lo
        nt.links.new(sock, g1.inputs[0])
        l1 = nt.nodes.new('ShaderNodeMath')
        l1.operation = 'LESS_THAN'
        l1.inputs[1].default_value = hi
        nt.links.new(sock, l1.inputs[0])
        m = nt.nodes.new('ShaderNodeMath')
        m.operation = 'MULTIPLY'
        nt.links.new(g1.outputs[0], m.inputs[0])
        nt.links.new(l1.outputs[0], m.inputs[1])
        return m.outputs[0]

    def prod(*socks):
        cur = socks[0]
        for s in socks[1:]:
            m = nt.nodes.new('ShaderNodeMath')
            m.operation = 'MULTIPLY'
            nt.links.new(cur, m.inputs[0])
            nt.links.new(s, m.inputs[1])
            cur = m.outputs[0]
        return cur

    # Brushed metallic belly (z < 3.0, |y| < 4.0)
    belly = prod(band(sep.outputs['Z'], -2.0, 3.0), band(abs_y.outputs[0], -0.1, 4.0))
    _, c1 = mix_rgb(nt, belly, (0.93, 0.94, 0.96, 1.0), (0.66, 0.70, 0.75, 1.0))

    # Deep-navy cheatline + subtle ice-blue accent pinstripe along fuselage
    cheat = prod(band(sep.outputs['Z'], 3.55, 4.10), band(sep.outputs['X'], -20.5, 25.2), band(abs_y.outputs[0], -0.1, 3.4))
    _, c2a = mix_rgb(nt, cheat, c1, (0.035, 0.095, 0.23, 1.0))
    pinstripe = prod(band(sep.outputs['Z'], 4.10, 4.24), band(sep.outputs['X'], -20.5, 25.0), band(abs_y.outputs[0], -0.1, 3.4))
    _, c2 = mix_rgb(nt, pinstripe, c2a, (0.60, 0.78, 0.90, 1.0))

    # Vertical tailfin navy + ice-blue diagonal stripe
    tail = prod(band(sep.outputs['X'], -40.0, -19.0), band(sep.outputs['Z'], 9.0, 24.0), band(abs_y.outputs[0], -0.1, 1.5))
    _, c3 = mix_rgb(nt, tail, c2, (0.035, 0.095, 0.23, 1.0))

    x_shift = nt.nodes.new('ShaderNodeMath')
    x_shift.operation = 'MULTIPLY_ADD'
    x_shift.inputs[1].default_value = 0.55
    x_shift.inputs[2].default_value = 10.45
    nt.links.new(sep.outputs['X'], x_shift.inputs[0])
    diag = nt.nodes.new('ShaderNodeMath')
    diag.operation = 'ADD'
    nt.links.new(sep.outputs['Z'], diag.inputs[0])
    nt.links.new(x_shift.outputs[0], diag.inputs[1])
    t_stripe = prod(tail, band(diag.outputs[0], 12.6, 14.1))
    _, c4 = mix_rgb(nt, t_stripe, c3, (0.64, 0.80, 0.91, 1.0))

    # Multi-layered dark-tinted reflective cockpit & cabin windows
    x_w = nt.nodes.new('ShaderNodeMath')
    x_w.operation = 'MULTIPLY'
    x_w.inputs[1].default_value = 1.95
    nt.links.new(sep.outputs['X'], x_w.inputs[0])
    fr = nt.nodes.new('ShaderNodeMath')
    fr.operation = 'FRACT'
    nt.links.new(x_w.outputs[0], fr.inputs[0])
    w_pat = band(fr.outputs[0], 0.04, 0.46)

    win_main = prod(w_pat, band(sep.outputs['Z'], 4.55, 4.90), band(sep.outputs['X'], -18.0, 21.0), band(abs_y.outputs[0], -0.1, 3.35))
    win_up = prod(w_pat, band(sep.outputs['Z'], 7.00, 7.34), band(sep.outputs['X'], 8.0, 21.0), band(abs_y.outputs[0], -0.1, 3.05))
    # 6-pane 747SP cockpit windshield band (deep green-blue aviation tint)
    ck_win = prod(band(sep.outputs['X'], 23.8, 26.8), band(sep.outputs['Z'], 5.15, 6.02), band(abs_y.outputs[0], -0.1, 1.85))

    w_cabin = nt.nodes.new('ShaderNodeMath')
    w_cabin.operation = 'MAXIMUM'
    nt.links.new(win_main, w_cabin.inputs[0])
    nt.links.new(win_up, w_cabin.inputs[1])
    w_all = nt.nodes.new('ShaderNodeMath')
    w_all.operation = 'MAXIMUM'
    nt.links.new(w_cabin.outputs[0], w_all.inputs[0])
    nt.links.new(ck_win, w_all.inputs[1])
    # Dark green-blue tinted glass base color so reflections dominate over diffuse
    _, c5 = mix_rgb(nt, w_all.outputs[0], c4, (0.008, 0.018, 0.026, 1.0))

    # Brushed aluminum engine nacelles + dark turbine fan intakes
    nac = prod(band(sep.outputs['Z'], -1.0, 3.4), band(abs_y.outputs[0], 9.0, 24.0))
    _, c6 = mix_rgb(nt, nac, c5, (0.62, 0.65, 0.70, 1.0))
    in_inner = prod(nac, band(sep.outputs['X'], 8.7, 10.6), band(abs_y.outputs[0], 9.0, 14.0))
    in_outer = prod(nac, band(sep.outputs['X'], -0.3, 1.2), band(abs_y.outputs[0], 18.0, 24.0))
    intake = nt.nodes.new('ShaderNodeMath')
    intake.operation = 'MAXIMUM'
    nt.links.new(in_inner, intake.inputs[0])
    nt.links.new(in_outer, intake.inputs[1])
    _, c7 = mix_rgb(nt, intake.outputs[0], c6, (0.016, 0.018, 0.022, 1.0))

    # Box-projected 2048px panel seams, hatches, micro-rivets, and weathering roughness
    pan_mp = nt.nodes.new('ShaderNodeMapping')
    pan_mp.inputs['Scale'].default_value = (0.18, 0.18, 0.18)
    nt.links.new(tc.outputs['Object'], pan_mp.inputs['Vector'])

    img_pb = safe_load_image(os.path.join(tex_dir, 'b747_panels_bump.png'), non_color=True)
    img_pr = safe_load_image(os.path.join(tex_dir, 'b747_panels_rough.png'), non_color=True)

    if img_pb is not None:
        tex_pb = nt.nodes.new('ShaderNodeTexImage')
        tex_pb.image = img_pb
        tex_pb.projection = 'BOX'
        tex_pb.projection_blend = 0.15
        nt.links.new(pan_mp.outputs['Vector'], tex_pb.inputs['Vector'])

        # Darken recessed panel gaps crisply (AO inside grooves so seams read even in overcast dawn light)
        seam_ao = nt.nodes.new('ShaderNodeMapRange')
        seam_ao.inputs[1].default_value = 0.08
        seam_ao.inputs[2].default_value = 0.52
        seam_ao.inputs[3].default_value = 0.44
        seam_ao.inputs[4].default_value = 0.0
        nt.links.new(tex_pb.outputs['Color'], seam_ao.inputs[0])
        _, c_final = mix_rgb(nt, seam_ao.outputs[0], c7, (0.04, 0.05, 0.06, 1.0))

        # Suppress panel bump on glass windows + add crisp recessed panel seam relief across aluminum skin
        inv_w = nt.nodes.new('ShaderNodeMath')
        inv_w.operation = 'SUBTRACT'
        inv_w.inputs[0].default_value = 1.0
        nt.links.new(w_all.outputs[0], inv_w.inputs[1])
        h_skin = nt.nodes.new('ShaderNodeMath')
        h_skin.operation = 'MULTIPLY'
        nt.links.new(tex_pb.outputs['Color'], h_skin.inputs[0])
        nt.links.new(inv_w.outputs[0], h_skin.inputs[1])
        bump = nt.nodes.new('ShaderNodeBump')
        bump.inputs['Strength'].default_value = 0.42
        bump.inputs['Distance'].default_value = 0.018
        nt.links.new(h_skin.outputs[0], bump.inputs['Height'])
        nt.links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    else:
        # Procedural brick-seam fallback if Pillow textures were not generated
        brick = nt.nodes.new('ShaderNodeTexBrick')
        brick.inputs['Scale'].default_value = 0.65
        brick.inputs['Mortar Size'].default_value = 0.012
        nt.links.new(tc.outputs['Object'], brick.inputs['Vector'])
        bump = nt.nodes.new('ShaderNodeBump')
        bump.inputs['Strength'].default_value = 0.20
        nt.links.new(brick.outputs['Fac'], bump.inputs['Height'])
        nt.links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
        c_final = c7

    nt.links.new(c_final, bsdf.inputs['Base Color'])

    # Metallic: high on bare aluminum belly & nacelles, low on paint/glass
    bare_metal = nt.nodes.new('ShaderNodeMath')
    bare_metal.operation = 'MAXIMUM'
    nt.links.new(belly, bare_metal.inputs[0])
    nt.links.new(nac, bare_metal.inputs[1])
    met_mr = nt.nodes.new('ShaderNodeMapRange')
    met_mr.inputs[3].default_value = 0.14
    met_mr.inputs[4].default_value = 0.86
    nt.links.new(bare_metal.outputs[0], met_mr.inputs[0])
    nt.links.new(met_mr.outputs[0], bsdf.inputs['Metallic'])

    # Roughness: panel-to-panel variation + airflow weathering streaks, ultra-glossy 0.025 on windows!
    if img_pr is not None:
        tex_pr = nt.nodes.new('ShaderNodeTexImage')
        tex_pr.image = img_pr
        tex_pr.projection = 'BOX'
        tex_pr.projection_blend = 0.15
        nt.links.new(pan_mp.outputs['Vector'], tex_pr.inputs['Vector'])
        r_skin = nt.nodes.new('ShaderNodeMapRange')
        r_skin.inputs[1].default_value = 0.15
        r_skin.inputs[2].default_value = 0.85
        r_skin.inputs[3].default_value = 0.16
        r_skin.inputs[4].default_value = 0.42
        nt.links.new(tex_pr.outputs['Color'], r_skin.inputs[0])
    else:
        wn = nt.nodes.new('ShaderNodeTexNoise')
        wn.inputs['Scale'].default_value = 0.45
        wn.inputs['Detail'].default_value = 4.0
        nt.links.new(tc.outputs['Object'], wn.inputs['Vector'])
        r_skin = nt.nodes.new('ShaderNodeMapRange')
        r_skin.inputs[1].default_value = 0.25
        r_skin.inputs[2].default_value = 0.75
        r_skin.inputs[3].default_value = 0.18
        r_skin.inputs[4].default_value = 0.36
        nt.links.new(wn.outputs['Fac'], r_skin.inputs[0])

    # Override window roughness to 0.025 for mirror-like dawn sky & sunlight reflections
    r_win = nt.nodes.new('ShaderNodeMapRange')
    r_win.inputs[3].default_value = 1.0
    r_win.inputs[4].default_value = 0.08
    nt.links.new(w_all.outputs[0], r_win.inputs[0])
    r_mul = nt.nodes.new('ShaderNodeMath')
    r_mul.operation = 'MULTIPLY'
    nt.links.new(r_skin.outputs[0], r_mul.inputs[0])
    nt.links.new(r_win.outputs[0], r_mul.inputs[1])
    nt.links.new(r_mul.outputs[0], bsdf.inputs['Roughness'])

    # Subtle warm interior cabin glow in ~65% of passenger windows + faint cool cockpit glass glow
    w_rnd = nt.nodes.new('ShaderNodeTexNoise')
    w_rnd.inputs['Scale'].default_value = 1.8
    nt.links.new(tc.outputs['Object'], w_rnd.inputs[0] if 'Vector' not in w_rnd.inputs else w_rnd.inputs['Vector'])
    w_lit = nt.nodes.new('ShaderNodeMapRange')
    w_lit.inputs[1].default_value = 0.36
    w_lit.inputs[2].default_value = 0.52
    w_lit.inputs[3].default_value = 0.08
    w_lit.inputs[4].default_value = 0.85
    nt.links.new(w_rnd.outputs['Fac'], w_lit.inputs[0])
    cab_em = nt.nodes.new('ShaderNodeMath')
    cab_em.operation = 'MULTIPLY'
    nt.links.new(w_cabin.outputs[0], cab_em.inputs[0])
    nt.links.new(w_lit.outputs[0], cab_em.inputs[1])

    # Blend warm cabin glow & faint blue-amber cockpit instrument glow into Emission
    _, em_col = mix_rgb(nt, ck_win, (1.0, 0.76, 0.42, 1.0), (0.48, 0.72, 1.0, 1.0))
    em_str = nt.nodes.new('ShaderNodeMath')
    em_str.operation = 'MULTIPLY_ADD'
    em_str.inputs[1].default_value = 0.30
    nt.links.new(ck_win, em_str.inputs[0])
    nt.links.new(cab_em.outputs[0], em_str.inputs[2])
    em_scale = nt.nodes.new('ShaderNodeMath')
    em_scale.operation = 'MULTIPLY'
    em_scale.inputs[1].default_value = 0.75
    nt.links.new(em_str.outputs[0], em_scale.inputs[0])

    try:
        nt.links.new(em_col, C.get_input(bsdf, 'Emission Color'))
        if 'Emission Strength' in bsdf.inputs:
            nt.links.new(em_scale.outputs[0], bsdf.inputs['Emission Strength'])
    except KeyError:
        pass
    return mat


def build_fallback_airliner(col, body_parent, livery_mat):
    """Procedural widebody airliner matching 747SP dimensions if assets/models/b747.glb is absent."""
    parts = []
    fus = C.cylinder('FallbackFuselage', 3.2, 50.0, (-1.0, 0.0, 4.5), col, livery_mat, segments=28)
    fus.rotation_euler = (0.0, math.pi * 0.5, 0.0)
    parts.append(fus)
    nose = C.sphere('FallbackNose', 3.2, (24.0, 0.0, 4.4), col, livery_mat)
    nose.scale = (1.6, 1.0, 0.96)
    parts.append(nose)
    hump = C.sphere('FallbackHump', 2.4, (14.5, 0.0, 6.9), col, livery_mat)
    hump.scale = (4.2, 0.95, 0.68)
    parts.append(hump)
    tail_cone = C.cylinder('FallbackTailCone', 3.1, 10.0, (-29.0, 0.0, 5.2), col, livery_mat, radius2=0.6)
    tail_cone.rotation_euler = (0.0, -math.pi * 0.5, 0.0)
    parts.append(tail_cone)
    for sy in (-1, 1):
        w = C.box('FallbackWing_%d' % sy, (7.5, 29.5, 0.65), (1.0, sy * 15.5, 3.0), col, livery_mat)
        w.rotation_euler = (sy * C.deg(4.5), 0.0, -sy * C.deg(28.0))
        parts.append(w)
        hs = C.box('FallbackHStab_%d' % sy, (4.0, 10.5, 0.35), (-27.0, sy * 5.8, 6.2), col, livery_mat)
        hs.rotation_euler = (0.0, 0.0, -sy * C.deg(26.0))
        parts.append(hs)
    fin = C.box('FallbackFin', (8.5, 0.55, 13.5), (-25.5, 0.0, 12.2), col, livery_mat)
    fin.rotation_euler = (0.0, C.deg(-28.0), 0.0)
    parts.append(fin)
    for i, (ex, ey, ez) in enumerate(((9.5, 11.8, 2.3), (0.4, 21.1, 2.9), (9.5, -11.8, 2.3), (0.4, -21.1, 2.9))):
        nac = C.cylinder('FallbackEngine_%d' % i, 1.35, 4.6, (ex, ey, ez), col, livery_mat, segments=20)
        nac.rotation_euler = (0.0, math.pi * 0.5, 0.0)
        parts.append(nac)
    for p in parts:
        p.parent = body_parent
    return parts


def build_landing_gear(col, airliner, tl):
    """Retractable 747SP landing gear (nose + 4 main bogies), retracting cleanly during go-around."""
    gear_root = C.empty('LandingGear', (0.0, 0.0, 0.0), col)
    gear_root.parent = airliner
    steel = C.material('GearSteel', Base_Color=(0.60, 0.63, 0.67, 1.0), Metallic=0.88, Roughness=0.28, Anisotropic=0.4)
    rubber = C.material('GearTire', Base_Color=(0.045, 0.048, 0.055, 1.0), Roughness=0.84)

    def add_bogie(prefix, x, y, h, wheels):
        strut = C.cylinder(prefix + '_Strut', 0.13, h, (x, y, 0.62 + h * 0.5), col, steel, segments=10)
        strut.parent = gear_root
        for i in range(wheels):
            dx = (0.75 if i < 2 else -0.75) if wheels > 2 else 0.0
            dy = 0.45 if (i % 2 == 0) else -0.45
            w = C.cylinder(prefix + '_W%d' % i, 0.62, 0.44, (x + dx, y + dy, 0.62), col, rubber, segments=16)
            w.rotation_euler = (math.pi * 0.5, 0.0, 0.0)
            w.parent = gear_root

    add_bogie('NoseGear', 22.5, 0.0, 1.6, 2)
    for sy in (-1, 1):
        add_bogie('BodyGear_%d' % sy, -4.2, sy * 1.9, 1.6, 4)
        add_bogie('WingGear_%d' % sy, -1.8, sy * 5.6, 1.3, 4)

    for u in (0.0, 0.208, 0.212, 0.838, 0.872, 1.0):
        f = tl.frame(u)
        g = max(0.01, airliner_state(u)['gear'])
        gear_root.scale = (1.0, 1.0, g)
        gear_root.location = (0.0, 0.0, (1.0 - g) * 2.2)
        gear_root.keyframe_insert('scale', frame=f)
        gear_root.keyframe_insert('location', frame=f)

    vis = [(tl.frame(0.300) + 1, tl.frame(0.874))]
    set_visibility_ranges(gear_root, vis, tl.total)
    for ch in gear_root.children_recursive:
        set_visibility_ranges(ch, vis, tl.total)
    return gear_root


def build_airliner(col, repo, tex_dir, args, tl, use_caustics=True):
    """Import assets/models/b747.glb with photorealistic Skyline livery, panel seams, antennas,
    turbine exhaust cones, lights, cones, vortices, and animation."""
    airliner = C.empty('AIRLINER', (0.0, 0.0, 0.0), col, 'ARROWS', 5.0)
    body_ref = C.empty('AIRLINER_BODY', (0.0, 0.0, 1.3), col)
    body_ref.parent = airliner

    livery_mat = make_skyline_livery_material(body_ref, tex_dir)
    glb_path = os.path.join(repo, 'assets', 'models', 'b747.glb')
    ext_meshes = []

    if os.path.exists(glb_path):
        before = set(bpy.data.objects)
        try:
            bpy.ops.import_scene.gltf(filepath=glb_path)
            imported = [o for o in bpy.data.objects if o not in before]
            top_objs = [o for o in imported if o.parent is None]
            for o in imported:
                for old_col in list(o.users_collection):
                    old_col.objects.unlink(o)
                col.objects.link(o)
                if o.type == 'MESH':
                    o.data.materials.clear()
                    o.data.materials.append(livery_mat)
                    for p in o.data.polygons:
                        p.use_smooth = True
                    # Crisp normals across sharp aerospace creases (eliminates STL triangulation ripples)
                    es = o.modifiers.new('EdgeSplit', 'EDGE_SPLIT')
                    es.split_angle = C.deg(32.0)
                    ext_meshes.append(o)
            for o in top_objs:
                o.parent = body_ref
            print('[film-kit] imported 747SP from %s (%d mesh(es))' % (glb_path, len(ext_meshes)))
        except Exception as e:
            C.warn('failed to import %s (%s); using procedural fallback airliner' % (glb_path, e))
            ext_meshes = build_fallback_airliner(col, body_ref, livery_mat)
    else:
        C.warn('b747.glb missing at %s; using procedural fallback airliner' % glb_path)
        ext_meshes = build_fallback_airliner(col, body_ref, livery_mat)

    build_landing_gear(col, airliner, tl)

    # Exterior aircraft details: dorsal VHF blade antennas, satcom fairing, and 4 turbine exhaust cones
    ti_mat = C.material('TurbineExhaust', Base_Color=(0.24, 0.25, 0.28, 1.0), Metallic=0.92, Roughness=0.28, Anisotropic=0.5)
    core_glow = C.emission_material('JetCoreGlow', color=(1.0, 0.42, 0.14, 1.0), strength=4.5)
    ant_mat = C.material('BladeAntenna', Base_Color=(0.90, 0.92, 0.95, 1.0), Metallic=0.2, Roughness=0.35)
    ext_extras = []
    for ax, az, h in ((11.0, 9.25, 0.55), (-4.0, 7.65, 0.50), (-14.0, 7.55, 0.45)):
        ant = C.box('VHFBlade_%d' % int(ax), (0.48, 0.04, h), (ax, 0.0, az), col, ant_mat)
        ant.rotation_euler = (0.0, C.deg(-18.0), 0.0)
        ant.parent = airliner
        ext_extras.append(ant)
    sat = C.sphere('SatcomDome', 0.95, (2.5, 0.0, 7.55), col, ant_mat)
    sat.scale = (2.1, 0.65, 0.42)
    sat.parent = airliner
    ext_extras.append(sat)
    for idx, (ex, ey, ez) in enumerate(((5.8, 11.8, 3.6), (-3.1, 21.1, 4.1), (5.8, -11.8, 3.6), (-3.1, -21.1, 4.1))):
        noz = C.cylinder('JetNozzle_%d' % idx, 0.85, 1.5, (ex, ey, ez), col, ti_mat, segments=20, radius2=0.52)
        noz.rotation_euler = (0.0, -math.pi * 0.5, 0.0)
        noz.parent = airliner
        ext_extras.append(noz)
        glow_d = C.cylinder('JetGlow_%d' % idx, 0.46, 0.12, (ex + 0.35, ey, ez), col, core_glow, segments=16)
        glow_d.rotation_euler = (0.0, math.pi * 0.5, 0.0)
        glow_d.parent = airliner
        ext_extras.append(glow_d)

    # Exterior aircraft lighting (FPS-independent Hz frequencies)
    mat_land = C.emission_material('PlaneLandingLight', color=(1.0, 0.96, 0.86, 1.0), strength=95.0)
    mat_nav_r = C.emission_material('PlaneNavRed', color=(1.0, 0.08, 0.04, 1.0), strength=42.0)
    mat_nav_g = C.emission_material('PlaneNavGreen', color=(0.06, 1.0, 0.34, 1.0), strength=42.0)
    mat_tail_w = C.emission_material('PlaneTailWhite', color=(1.0, 1.0, 1.0, 1.0), strength=24.0)

    # Helper: glass-lens strobe/beacon material so bulbs look like real glass lenses (never black dots!) when off
    def lens_beacon_mat(name_m, lens_rgb, emit_rgb, driver_expr):
        m = C.material(name_m, Base_Color=(*lens_rgb, 1.0), Roughness=0.08, Transmission_Weight=0.75, IOR=1.5)
        b = C.bsdf_of(m)
        try:
            C.set_input(b, 'Emission Color', (*emit_rgb, 1.0))
            if 'Emission Strength' in b.inputs:
                C.frame_driver(b.inputs['Emission Strength'], driver_expr)
        except KeyError:
            pass
        return m

    # Double-flash wingtip strobes at 1.0 Hz
    w_st = tl.rad_per_frame(1.0)
    mat_strobe = lens_beacon_mat(
        'PlaneStrobe', (0.85, 0.90, 0.95), (1.0, 0.98, 1.0),
        '260.0 * max(pow(max(0.0, sin(frame * %.6f)), 32.0), pow(max(0.0, sin(frame * %.6f - 0.55)), 32.0))'
        % (w_st, w_st),
    )

    # Anti-collision red beacons at 0.85 Hz
    w_bc = tl.rad_per_frame(0.85)
    mat_bcn = lens_beacon_mat(
        'PlaneBeacon', (0.65, 0.05, 0.04), (1.0, 0.06, 0.02),
        '140.0 * pow(max(0.0, sin(frame * %.6f)), 14.0)' % w_bc,
    )

    light_specs = (
        ('LandBulbL', (9.8, 6.5, 3.6), mat_land, 0.34),
        ('LandBulbR', (9.8, -6.5, 3.6), mat_land, 0.34),
        ('LandBulbNose', (23.0, 0.0, 1.5), mat_land, 0.28),
        ('NavPortRed', (-2.5, 29.8, 4.6), mat_nav_r, 0.22),
        ('NavStbdGreen', (-2.5, -29.8, 4.6), mat_nav_g, 0.22),
        ('TailWhite', (-33.5, 0.0, 6.5), mat_tail_w, 0.20),
        ('StrobeL', (-2.8, 29.9, 4.6), mat_strobe, 0.24),
        ('StrobeR', (-2.8, -29.9, 4.6), mat_strobe, 0.24),
        ('BeaconTop', (4.0, 0.0, 9.55), mat_bcn, 0.16),
        ('BeaconBot', (4.0, 0.0, 0.3), mat_bcn, 0.16),
    )
    for nm, loc, mat_l, rad in light_specs:
        b = C.ico(nm, rad, 2, loc, col, mat_l)
        b.parent = airliner
        ext_extras.append(b)

    # Subtle translucent landing light cones (delicate mist glow, never washing across the fuselage)
    cone_mat = bpy.data.materials.new('LandingLightCone')
    cone_mat.use_nodes = True
    ntc = cone_mat.node_tree
    ntc.nodes.clear()
    out_c = ntc.nodes.new('ShaderNodeOutputMaterial')
    tr_c = ntc.nodes.new('ShaderNodeBsdfTransparent')
    em_c = ntc.nodes.new('ShaderNodeEmission')
    em_c.inputs['Color'].default_value = (1.0, 0.94, 0.80, 1.0)
    em_c.inputs['Strength'].default_value = 1.6

    tc_c = ntc.nodes.new('ShaderNodeTexCoord')
    sep_c = ntc.nodes.new('ShaderNodeSeparateXYZ')
    ntc.links.new(tc_c.outputs['Generated'], sep_c.inputs[0])
    lw = ntc.nodes.new('ShaderNodeLayerWeight')
    lw.inputs['Blend'].default_value = 0.55
    inv_f = ntc.nodes.new('ShaderNodeMath')
    inv_f.operation = 'SUBTRACT'
    inv_f.inputs[0].default_value = 1.0
    ntc.links.new(lw.outputs['Facing'], inv_f.inputs[1])
    pw_len = ntc.nodes.new('ShaderNodeMath')
    pw_len.operation = 'POWER'
    pw_len.inputs[1].default_value = 2.8
    ntc.links.new(sep_c.outputs['Z'], pw_len.inputs[0])
    fac1 = ntc.nodes.new('ShaderNodeMath')
    fac1.operation = 'MULTIPLY'
    ntc.links.new(pw_len.outputs[0], fac1.inputs[0])
    ntc.links.new(inv_f.outputs[0], fac1.inputs[1])
    fac2 = ntc.nodes.new('ShaderNodeMath')
    fac2.operation = 'MULTIPLY'
    fac2.inputs[1].default_value = 0.048
    ntc.links.new(fac1.outputs[0], fac2.inputs[0])

    mix_c = ntc.nodes.new('ShaderNodeMixShader')
    ntc.links.new(fac2.outputs[0], mix_c.inputs[0])
    ntc.links.new(tr_c.outputs[0], mix_c.inputs[1])
    ntc.links.new(em_c.outputs[0], mix_c.inputs[2])
    ntc.links.new(mix_c.outputs[0], out_c.inputs['Surface'])

    for nm, loc, length in (('LandConeL', (10.4, 6.5, 3.6), 145.0),
                            ('LandConeR', (10.4, -6.5, 3.6), 145.0),
                            ('LandConeNose', (23.4, 0.0, 1.5), 110.0)):
        def build_cone(bm, L=length):
            bmesh.ops.create_cone(bm, cap_ends=False, cap_tris=False, segments=24,
                                  radius1=L * 0.095, radius2=0.35, depth=L, calc_uvs=True)
            bmesh.ops.translate(bm, verts=bm.verts, vec=(0.0, 0.0, -L * 0.5))

        cone = C.mesh_object(nm, build_cone, col, loc, smooth=True)
        C.assign(cone, cone_mat)
        cone.rotation_euler = (0.0, -math.pi * 0.5 + C.deg(3.0), 0.0)
        cone.parent = airliner
        disable_shadow_rays(cone)
        ext_extras.append(cone)

    # Real Cycles SPOT lights cutting physical god-rays through ApproachMist and casting crisp beams on snow
    for nm, sy in (('LandSpotL', 6.5), ('LandSpotR', -6.5)):
        ld = bpy.data.lights.new(nm, 'SPOT')
        ld.energy = 920000.0
        ld.spot_size = C.deg(25.0)
        ld.spot_blend = 0.52
        ld.shadow_soft_size = 0.30
        ld.color = (1.0, 0.95, 0.85)
        sp = C.link(bpy.data.objects.new(nm, ld), col)
        sp.location = (9.8, sy, 3.6)
        sp.rotation_euler = (0.0, math.pi * 0.5 + C.deg(3.0), 0.0)
        sp.parent = airliner
        if use_caustics:
            enable_caustics_light(sp)
        ext_extras.append(sp)

    # Wingtip vortices (time-scaled lifetime & count for any FPS)
    if not args.no_vortices:
        v_mat = bpy.data.materials.new('VortexMist')
        v_mat.use_nodes = True
        ntv = v_mat.node_tree
        ntv.nodes.clear()
        ov = ntv.nodes.new('ShaderNodeOutputMaterial')
        tv = ntv.nodes.new('ShaderNodeBsdfTransparent')
        bv = ntv.nodes.new('ShaderNodeBsdfPrincipled')
        bv.inputs['Base Color'].default_value = (0.92, 0.95, 0.99, 1.0)
        bv.inputs['Roughness'].default_value = 0.9
        mv = ntv.nodes.new('ShaderNodeMixShader')
        mv.inputs[0].default_value = 0.14
        ntv.links.new(tv.outputs[0], mv.inputs[1])
        ntv.links.new(bv.outputs[0], mv.inputs[2])
        ntv.links.new(mv.outputs[0], ov.inputs['Surface'])
        puff = C.ico('VortexPuff', 1.0, 1, (0.0, 0.0, -500.0), col, v_mat)
        disable_shadow_rays(puff)

        v_f0 = tl.frame(0.310)
        v_f1 = tl.frame(0.895)
        v_life = max(12, int(round(1.8 * tl.fps)))
        for idx, sy in enumerate((29.8, -29.8)):
            em_obj = C.plane('VortexEmit_%d' % idx, (0.4, 0.4), (-3.5, sy, 4.6), col)
            em_obj.parent = airliner
            C.particles(em_obj, 'WingtipVortex_%d' % idx, puff, count=360, frame_start=v_f0, frame_end=v_f1,
                        lifetime=v_life, size=0.65, size_random=0.6, normal=0.0, gravity=0.0,
                        brownian=1.2, seed=args.seed + idx)

    # Hide exterior airliner during cockpit POV shots (Shots 1..3a and Shot 8b)
    ext_vis = [(tl.frame(0.300) + 1, tl.frame(0.880))]
    for o in ext_meshes + ext_extras:
        set_visibility_ranges(o, ext_vis, tl.total)

    # Keyframe AIRLINER smoothly across the entire timeline with exact keys on both sides of the whiteout cut
    f_cut = tl.frame(0.208)
    frames_a = tl.sample_frames(1, f_cut, target_samples=120)
    frames_b = tl.sample_frames(f_cut + 1, tl.total, target_samples=360)
    for f in sorted(set(frames_a + frames_b + tl.cut_frames() + [c + 1 for c in tl.cut_frames() if c + 1 <= tl.total])):
        st = airliner_state(tl.u(f), tl.seconds(f))
        airliner.location = st['pos']
        airliner.rotation_euler = (st['roll'] * DEG, -st['pitch'] * DEG, 0.0)
        airliner.keyframe_insert('location', frame=f)
        airliner.keyframe_insert('rotation_euler', frame=f)
    C.interpolation(airliner, 'LINEAR')
    C.hold_cut(airliner, f_cut)

    return airliner


# ------------------------------------------------------------------------------------------------ cockpit
def make_display_material(name, png_path, fallback_color=(0.12, 0.55, 0.95, 1.0), strength=2.6):
    """Self-lit glass-cockpit display using blender/tex/pfd.png or nd.png with procedural fallback."""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    em = nt.nodes.new('ShaderNodeEmission')
    em.inputs['Strength'].default_value = strength
    img = safe_load_image(png_path, non_color=False)
    if img is not None:
        tex = nt.nodes.new('ShaderNodeTexImage')
        tex.image = img
        nt.links.new(tex.outputs['Color'], em.inputs['Color'])
    else:
        tc = nt.nodes.new('ShaderNodeTexCoord')
        sep = nt.nodes.new('ShaderNodeSeparateXYZ')
        nt.links.new(tc.outputs['UV'], sep.inputs[0])
        gt = nt.nodes.new('ShaderNodeMath')
        gt.operation = 'GREATER_THAN'
        gt.inputs[1].default_value = 0.52
        nt.links.new(sep.outputs['Y'], gt.inputs[0])
        _, col_out = mix_rgb(nt, gt.outputs[0], (0.22, 0.15, 0.08, 1.0), fallback_color)
        nt.links.new(col_out, em.inputs['Color'])
    nt.links.new(em.outputs[0], out.inputs['Surface'])
    return mat


def make_windshield_material(tl):
    """Physically-based Fresnel cockpit glass (IOR 1.52) with animated wind-sheared moisture streaks
    & condensation bump during cloud descent (Shot 2) and go-around climb (Shot 8b)."""
    mat = bpy.data.materials.new('CockpitWindshield')
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    tr = nt.nodes.new('ShaderNodeBsdfTransparent')
    gl = nt.nodes.new('ShaderNodeBsdfGlossy')
    gl.inputs['Color'].default_value = (0.90, 0.95, 1.0, 1.0)
    gl.inputs['Roughness'].default_value = 0.05

    # Physical Fresnel reflection (IOR 1.52 laminated aviation glass)
    fres = nt.nodes.new('ShaderNodeFresnel')
    fres.inputs['IOR'].default_value = 1.52
    fres_scale = nt.nodes.new('ShaderNodeMath')
    fres_scale.operation = 'MULTIPLY'
    fres_scale.inputs[1].default_value = 0.35
    nt.links.new(fres.outputs['Fac'], fres_scale.inputs[0])

    # Keyframed wetness (0 above clouds, peaks during Shot 2 descent & Shot 8b climb)
    wet = nt.nodes.new('ShaderNodeValue')
    wet.name = wet.label = 'WETNESS'
    for u, v in (
        (0.000, 0.02), (0.115, 0.02), (0.142, 0.65), (0.195, 1.0), (0.232, 0.72), (0.262, 0.28), (0.300, 0.08),
        (0.880, 0.10), (0.918, 0.78), (0.968, 1.0), (1.000, 1.0),
    ):
        C.key_socket(wet.outputs[0], tl.frame(u), v)

    # Anisotropic slipstream noise stretched vertically to produce wind-driven moisture streaks
    tc = nt.nodes.new('ShaderNodeTexCoord')
    mp = nt.nodes.new('ShaderNodeMapping')
    mp.inputs['Scale'].default_value = (26.0, 3.2, 1.0)
    drive_mapping_channel(nt, mp, 'Location', 1, 'frame * %.6f' % (10.8 / tl.fps))
    nt.links.new(tc.outputs['UV'], mp.inputs['Vector'])

    noise = nt.nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 2.4
    noise.inputs['Detail'].default_value = 6.0
    nt.links.new(mp.outputs['Vector'], noise.inputs['Vector'])

    streaks = nt.nodes.new('ShaderNodeMapRange')
    streaks.inputs[1].default_value = 0.56
    streaks.inputs[2].default_value = 0.78
    streaks.inputs[3].default_value = 0.0
    streaks.inputs[4].default_value = 0.48
    nt.links.new(noise.outputs['Fac'], streaks.inputs[0])

    mul = nt.nodes.new('ShaderNodeMath')
    mul.operation = 'MULTIPLY'
    nt.links.new(streaks.outputs[0], mul.inputs[0])
    nt.links.new(wet.outputs[0], mul.inputs[1])

    refl_fac = nt.nodes.new('ShaderNodeMath')
    refl_fac.operation = 'ADD'
    refl_fac.use_clamp = True
    nt.links.new(mul.outputs[0], refl_fac.inputs[0])
    nt.links.new(fres_scale.outputs[0], refl_fac.inputs[1])

    # Droplet bump on the glossy sheen
    bump = nt.nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = 0.28
    nt.links.new(streaks.outputs[0], bump.inputs['Height'])
    nt.links.new(bump.outputs['Normal'], gl.inputs['Normal'])

    mix = nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(refl_fac.outputs[0], mix.inputs[0])
    nt.links.new(tr.outputs[0], mix.inputs[1])
    nt.links.new(gl.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs['Surface'])
    return mat


def build_cockpit(col, airliner, tex_dir, tl):
    """Detailed cockpit interior parented to AIRLINER at (24.0, 0.0, 6.8):
    glareshield, glowing PFD/ND/EICAS displays, Fresnel windshield & frames, overhead panel,
    dual yokes, animated thrust levers, seats, and two pilots with headsets & gloved hands."""
    ck_root = C.empty('COCKPIT', (24.0, 0.0, 6.8), col)
    ck_root.parent = airliner
    ck_objs = []

    def track(o):
        if o is not None:
            o.parent = ck_root
            ck_objs.append(o)
        return o

    shell = C.material('CkShell', Base_Color=(0.14, 0.16, 0.19, 1.0), Roughness=0.70)
    fabric = C.material('CkFabric', Base_Color=(0.07, 0.08, 0.09, 1.0), Roughness=0.92)
    panel_m = C.material('CkPanel', Base_Color=(0.11, 0.13, 0.16, 1.0), Roughness=0.66)
    metal = C.material('CkMetal', Base_Color=(0.64, 0.67, 0.71, 1.0), Metallic=0.88, Roughness=0.28, Anisotropic=0.45)
    yoke_m = C.material('CkYoke', Base_Color=(0.18, 0.20, 0.23, 1.0), Metallic=0.22, Roughness=0.45)
    bezel_m = C.material('CkBezel', Base_Color=(0.04, 0.05, 0.06, 1.0), Roughness=0.44)
    seat_m = C.material('CkSeat', Base_Color=(0.14, 0.12, 0.10, 1.0), Roughness=0.85)
    shirt_m = C.material('PilotShirt', Base_Color=(0.86, 0.89, 0.92, 1.0), Roughness=0.78)
    gold_m = C.material('PilotGold', Base_Color=(0.84, 0.66, 0.26, 1.0), Metallic=0.88, Roughness=0.25)
    glove_m = C.material('PilotGlove', Base_Color=(0.035, 0.038, 0.045, 1.0), Roughness=0.36, Specular_IOR_Level=0.58)
    headset_m = C.material('Headset', Base_Color=(0.06, 0.065, 0.075, 1.0), Roughness=0.42)
    mcp_glow = C.emission_material('MCPAmber', color=(1.0, 0.72, 0.30, 1.0), strength=3.2)
    oh_glow = C.emission_material('OverheadLed', color=(0.75, 0.90, 1.0, 1.0), strength=1.6)

    pfd_mat = make_display_material('CockpitPFD', os.path.join(tex_dir, 'pfd.png'), (0.14, 0.38, 0.66, 1.0), 2.8)
    nd_mat = make_display_material('CockpitND', os.path.join(tex_dir, 'nd.png'), (0.06, 0.24, 0.18, 1.0), 2.6)
    eicas_mat = make_display_material('CockpitEICAS', os.path.join(tex_dir, 'eicas.png'), (0.12, 0.30, 0.22, 1.0), 2.5)
    mcp_mat = make_display_material('CockpitMCP', os.path.join(tex_dir, 'mcp.png'), (0.75, 0.52, 0.16, 1.0), 2.4)
    wet_mat = make_windshield_material(tl)

    zb, zt = -0.20, 0.32
    pts = [
        (Vector((1.14, 0.0, zb)), Vector((0.97, 0.0, zt))),
        (Vector((1.07, 0.64, zb)), Vector((0.90, 0.60, zt))),
        (Vector((0.62, 0.98, zb)), Vector((0.50, 0.92, zt))),
        (Vector((-0.15, 1.06, zb + 0.05)), Vector((-0.15, 1.00, zt - 0.06))),
    ]

    def mir(v):
        return Vector((v.x, -v.y, v.z))

    for side in (1, -1):
        xf = (lambda v: v) if side > 0 else mir
        for i in range(len(pts)):
            a0, a1 = xf(pts[i][0]), xf(pts[i][1])
            track(make_bar('CkPost_%d_%d' % (side, i), a0, a1, 0.065 if i == 0 else 0.055, col, shell))
            if i < len(pts) - 1:
                b0, b1 = xf(pts[i + 1][0]), xf(pts[i + 1][1])
                track(make_bar('CkSillB_%d_%d' % (side, i), a0, b0, 0.05, col, shell))
                track(make_bar('CkSillT_%d_%d' % (side, i), a1, b1, 0.05, col, shell))

                def build_pane(bm, p0=a0, p1=b0, p2=b1, p3=a1):
                    v0 = bm.verts.new(p0)
                    v1 = bm.verts.new(p1)
                    v2 = bm.verts.new(p2)
                    v3 = bm.verts.new(p3)
                    f = bm.faces.new((v0, v1, v2, v3))
                    uv = bm.loops.layers.uv.verify()
                    for lp, c in zip(f.loops, ((0.0, 0.0), (1.0, 0.0), (1.0, 1.0), (0.0, 1.0))):
                        lp[uv].uv = c

                pane = C.mesh_object('CkGlass_%d_%d' % (side, i), build_pane, col)
                C.assign(pane, wet_mat)
                disable_shadow_rays(pane)
                track(pane)

    oh = track(C.box('CkOverhead', (1.15, 1.65, 0.08), (0.28, 0.0, 0.56), col, shell))
    oh.rotation_euler = (0.0, C.deg(-18.0), 0.0)
    for r in range(4):
        for c in range(6):
            led = track(C.box('OhLed_%d_%d' % (r, c), (0.04, 0.07, 0.015),
                              (0.05 + r * 0.16, -0.45 + c * 0.18, 0.49 + r * 0.05), col, oh_glow))
            led.rotation_euler = (0.0, C.deg(-18.0), 0.0)
    # Fully enclosed cockpit ceiling & window header brow (zero sky light leak above windshield)
    track(C.box('CkHeader', (0.48, 2.12, 0.24), (0.86, 0.0, zt + 0.11), col, shell))
    track(C.box('CkCeilingEnclosure', (2.20, 2.24, 0.10), (-0.15, 0.0, 0.66), col, shell))
    for sy in (-1, 1):
        track(C.box('CkSideWall_%d' % sy, (2.3, 0.07, 1.15), (-0.35, sy * 1.06, -0.75), col, shell))
        track(C.box('CkUpperSide_%d' % sy, (1.4, 0.08, 0.55), (-0.35, sy * 1.04, 0.42), col, shell))
        track(C.box('CkArmRest_%d' % sy, (1.5, 0.36, 0.05), (-0.20, sy * 0.88, -0.22), col, fabric))
    track(C.box('CkFloor', (2.8, 2.15, 0.05), (-0.25, 0.0, -1.32), col, fabric))

    gs = track(C.box('GlareshieldTop', (0.56, 1.92, 0.05), (0.80, 0.0, -0.235), col, fabric))
    gs.rotation_euler = (0.0, C.deg(3.5), 0.0)
    track(C.box('GlareshieldFace', (0.06, 1.86, 0.15), (0.53, 0.0, -0.30), col, panel_m))
    mcp_strip = track(C.plane('MCPStrip', (1.46, 0.125), (0.495, 0.0, -0.295), col, mcp_mat))
    mcp_strip.rotation_euler = (math.pi * 0.5, 0.0, -math.pi * 0.5)

    mip = track(C.box('MainPanel', (0.06, 1.90, 0.50), (0.72, 0.0, -0.60), col, panel_m))
    mip.rotation_euler = (0.0, C.deg(10.0), 0.0)
    for nm, dy, dmat in (
        ('Disp_CaptPFD', 0.72, pfd_mat),
        ('Disp_CaptND',  0.40, nd_mat),
        ('Disp_EICAS',   0.00, eicas_mat),
        ('Disp_FOND',   -0.40, nd_mat),
        ('Disp_FOPFD',  -0.72, pfd_mat),
    ):
        bz = track(C.box(nm + '_Bezel', (0.025, 0.27, 0.27), (0.70, dy, -0.56), col, bezel_m))
        bz.rotation_euler = (0.0, C.deg(10.0), 0.0)
        scr = track(C.plane(nm, (0.235, 0.235), (0.682, dy, -0.56), col, dmat))
        scr.rotation_euler = (math.pi * 0.5, 0.0, -math.pi * 0.5)
        scr.rotation_euler.y += C.deg(10.0)

    track(C.box('Pedestal', (0.66, 0.42, 0.62), (0.30, 0.0, -0.99), col, panel_m))
    for i in range(4):
        piv = track(C.empty('ThrustPivot_%d' % i, (0.24, -0.09 + i * 0.06, -0.68), col))
        stem = C.box('ThrustStem_%d' % i, (0.014, 0.014, 0.16), (0.0, 0.0, 0.08), col, metal)
        stem.parent = piv
        ck_objs.append(stem)
        knob = C.cylinder('ThrustKnob_%d' % i, 0.017, 0.05, (0.0, 0.0, 0.16), col, bezel_m, segments=12)
        knob.rotation_euler = (math.pi * 0.5, 0.0, 0.0)
        knob.parent = piv
        ck_objs.append(knob)
        for u in (0.0, 0.110, 0.235, 0.770, 0.880, 1.0):
            th = airliner_state(u)['thrust']
            piv.rotation_euler = (0.0, C.deg(10.0 + th * 34.0), 0.0)
            piv.keyframe_insert('rotation_euler', frame=tl.frame(u))

    for side_n, sy in (('Capt', 0.53), ('FO', -0.53)):
        track(make_bar('Column_' + side_n, (0.50, sy, -1.30), (0.43, sy, -0.58), 0.055, col, yoke_m, radius=0.032))
        track(C.box('YokeHub_' + side_n, (0.06, 0.11, 0.08), (0.43, sy, -0.56), col, yoke_m))
        for h in (-1, 1):
            p0 = (0.43, sy + h * 0.04, -0.56)
            p1 = (0.43, sy + h * 0.16, -0.55)
            p2 = (0.42, sy + h * 0.18, -0.40)
            track(make_bar('YokeArm_%s_%d' % (side_n, h), p0, p1, 0.025, col, yoke_m, radius=0.017))
            track(make_bar('YokeHorn_%s_%d' % (side_n, h), p1, p2, 0.025, col, yoke_m, radius=0.018))

    for side_n, sy in (('Capt', 0.53), ('FO', -0.53)):
        sb = track(C.box('SeatBack_' + side_n, (0.14, 0.54, 0.76), (-0.34, sy, -0.54), col, seat_m))
        sb.rotation_euler = (0.0, C.deg(-8.0), 0.0)
        track(C.box('SeatPan_' + side_n, (0.48, 0.54, 0.12), (-0.08, sy, -0.86), col, seat_m))

    def build_pilot(name_p, sy, skin_rgb, hair_rgb, stripes):
        skin_m = C.material(name_p + '_Skin', Base_Color=(*skin_rgb, 1.0), Roughness=0.52, Subsurface_Weight=0.28)
        hair_m = C.material(name_p + '_Hair', Base_Color=(*hair_rgb, 1.0), Roughness=0.88)
        head = track(C.sphere(name_p + '_Head', 0.105, (-0.06, sy, 0.03), col, skin_m))
        head.scale = (1.05, 0.92, 1.12)
        hair = track(C.sphere(name_p + '_Hair', 0.108, (-0.08, sy, 0.055), col, hair_m))
        hair.scale = (1.02, 0.94, 0.95)
        track(C.cylinder(name_p + '_Neck', 0.052, 0.12, (-0.08, sy, -0.09), col, skin_m, segments=14))
        for s in (-1, 1):
            ec = track(C.cylinder(name_p + '_Cup_%d' % s, 0.044, 0.036, (-0.07, sy + s * 0.105, 0.03), col, headset_m))
            ec.rotation_euler = (math.pi * 0.5, 0.0, 0.0)
        track(make_bar(name_p + '_BandL', (-0.07, sy - 0.105, 0.05), (-0.07, sy, 0.16), 0.018, col, headset_m, radius=0.01))
        track(make_bar(name_p + '_BandR', (-0.07, sy + 0.105, 0.05), (-0.07, sy, 0.16), 0.018, col, headset_m, radius=0.01))
        tor = track(C.sphere(name_p + '_Torso', 0.22, (-0.15, sy, -0.40), col, shirt_m))
        tor.scale = (0.72, 1.15, 1.35)
        for s in (-1, 1):
            track(C.sphere(name_p + '_Sh_%d' % s, 0.078, (-0.13, sy + s * 0.19, -0.24), col, shirt_m))
            track(C.box(name_p + '_Ep_%d' % s, (0.10, 0.055, 0.012), (-0.13, sy + s * 0.19, -0.165), col, bezel_m))
            for k in range(stripes):
                track(C.box(name_p + '_St_%d_%d' % (s, k), (0.008, 0.050, 0.015),
                            (-0.105 + k * 0.016, sy + s * 0.19, -0.162), col, gold_m))

    def build_gloved_arm(name_a, sh, el, wr, hand):
        track(make_bar(name_a + '_Upper', sh, el, 0.04, col, shirt_m, radius=0.048))
        track(make_bar(name_a + '_Fore', el, wr, 0.04, col, shirt_m, radius=0.040))
        track(make_bar(name_a + '_Cuff', wr, hand, 0.04, col, glove_m, radius=0.036))
        palm = track(C.box(name_a + '_Palm', (0.088, 0.082, 0.036), hand, col, glove_m))
        d = (Vector(hand) - Vector(wr)).normalized()
        palm.rotation_euler = d.to_track_quat('X', 'Z').to_euler()
        for k in range(4):
            fpos = Vector(hand) + d * 0.048 + Vector((0.0, -0.028 + k * 0.018, -0.014))
            track(C.sphere(name_a + '_F%d' % k, 0.014, fpos, col, glove_m))
        track(C.sphere(name_a + '_Thumb', 0.016, Vector(hand) + Vector((0.02, 0.038, -0.008)), col, glove_m))

    build_pilot('Captain', 0.53, (0.68, 0.50, 0.39), (0.36, 0.34, 0.32), 4)
    build_pilot('FirstOfficer', -0.53, (0.46, 0.30, 0.21), (0.10, 0.07, 0.05), 3)

    build_gloved_arm('CaptL', (-0.13, 0.72, -0.25), (0.10, 0.84, -0.50), (0.34, 0.72, -0.46), (0.41, 0.71, -0.44))
    build_gloved_arm('CaptR', (-0.13, 0.34, -0.25), (0.04, 0.20, -0.58), (0.18, 0.07, -0.53), (0.24, 0.02, -0.51))
    build_gloved_arm('FOR', (-0.13, -0.72, -0.25), (0.10, -0.84, -0.50), (0.34, -0.72, -0.46), (0.41, -0.71, -0.44))
    build_gloved_arm('FOL', (-0.13, -0.34, -0.25), (0.02, -0.26, -0.60), (0.14, -0.23, -0.63), (0.20, -0.22, -0.62))

    ld_inst = bpy.data.lights.new('CkInstGlow', 'POINT')
    ld_inst.energy = 12.0
    ld_inst.shadow_soft_size = 0.25
    ld_inst.color = (0.62, 0.80, 1.0)
    track(C.link(bpy.data.objects.new('CkInstGlow', ld_inst), col)).location = (0.45, 0.0, -0.42)

    ld_fld = bpy.data.lights.new('CkWarmFlood', 'POINT')
    ld_fld.energy = 6.0
    ld_fld.shadow_soft_size = 0.30
    ld_fld.color = (1.0, 0.80, 0.58)
    track(C.link(bpy.data.objects.new('CkWarmFlood', ld_fld), col)).location = (-0.20, 0.0, 0.42)

    # Cloud-traversal exterior light flicker inside cockpit during Shot 2
    ld_flk = bpy.data.lights.new('CkCloudFlicker', 'AREA')
    ld_flk.energy = 0.0
    ld_flk.size = 1.8
    ld_flk.color = (0.85, 0.92, 1.0)
    flk_obj = track(C.link(bpy.data.objects.new('CkCloudFlicker', ld_flk), col))
    flk_obj.location = (1.6, 0.0, 0.4)
    flk_obj.rotation_euler = (0.0, C.deg(70.0), 0.0)
    for u, v in ((0.0, 0.0), (0.128, 0.0), (0.154, 40.0), (0.200, 98.0), (0.225, 32.0), (0.242, 0.0),
                 (0.900, 0.0), (0.955, 72.0)):
        ld_flk.energy = v
        ld_flk.keyframe_insert('energy', frame=tl.frame(u))
    C.add_noise(ld_flk, 'energy', strength=28.0, scale=max(1.5, 2.2 * tl.fps / 24.0),
                frame_range=(tl.frame(0.132), tl.frame(0.232)))

    vis = [(1, tl.frame(0.300)), (tl.frame(0.880) + 1, tl.total)]
    for o in ck_objs:
        set_visibility_ranges(o, vis, tl.total)
    return ck_root


# ------------------------------------------------------------------------------------------------ flock & drone
def make_goose_materials(tex_dir):
    """Multi-material Canada goose plumage:
      0 = feathered grey-brown mantle/upperparts (goose_plumage.png + micro-feather bump)
      1 = pale buff-grey breast/flanks
      2 = matte jet-black neck, head, tail & bill
      3 = crisp white chinstrap cheek patch & white U-shaped rump/undertail coverts
      4 = dark charcoal-black outer flight primaries & tucked webbed feet
      5 = glossy dark avian eye
    """
    # 0: Feathered mantle & wing coverts
    mantle = C.material('GooseMantle', Base_Color=(0.28, 0.23, 0.18, 1.0), Roughness=0.86, Specular_IOR_Level=0.25)
    img_p = safe_load_image(os.path.join(tex_dir, 'goose_plumage.png'), non_color=False)
    if img_p is not None:
        nt = mantle.node_tree
        bsdf = C.bsdf_of(mantle)
        tc = nt.nodes.new('ShaderNodeTexCoord')
        mp = nt.nodes.new('ShaderNodeMapping')
        mp.inputs['Scale'].default_value = (1.8, 1.8, 1.8)
        nt.links.new(tc.outputs['Object'], mp.inputs['Vector'])
        tex = nt.nodes.new('ShaderNodeTexImage')
        tex.image = img_p
        tex.projection = 'BOX'
        tex.projection_blend = 0.25
        nt.links.new(mp.outputs['Vector'], tex.inputs['Vector'])
        nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
        bump = nt.nodes.new('ShaderNodeBump')
        bump.inputs['Strength'].default_value = 0.22
        bump.inputs['Distance'].default_value = 0.008
        nt.links.new(tex.outputs['Color'], bump.inputs['Height'])
        nt.links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])

    breast = C.material('GooseBreast', Base_Color=(0.64, 0.60, 0.54, 1.0), Roughness=0.88, Specular_IOR_Level=0.2)
    black = C.material('GooseBlack', Base_Color=(0.025, 0.026, 0.030, 1.0), Roughness=0.72, Specular_IOR_Level=0.35)
    white = C.material('GooseWhite', Base_Color=(0.94, 0.94, 0.92, 1.0), Roughness=0.82, Specular_IOR_Level=0.25)
    prim = C.material('GoosePrimaries', Base_Color=(0.06, 0.055, 0.052, 1.0), Roughness=0.80, Specular_IOR_Level=0.28)
    eye = C.material('GooseEye', Base_Color=(0.01, 0.01, 0.01, 1.0), Roughness=0.05, Coat_Weight=1.0)
    return [mantle, breast, black, white, prim, eye]


def build_goose_meshes(mats):
    """Anatomically realistic Canada goose (Branta canadensis) multi-part meshes:
    - Body mesh (slot 0..5): sculpted streamlined breast/mantle, pale underbelly, crisp white
      upper-tail covert V-band, matte-black fanned tail feathers, tucked dark webbed feet,
      graceful S-curved matte-black neck, anatomically proportioned head, crisp white chinstrap
      cheek patch, flat broad dark bill, and dark glossy eyes.
    - 2-segment articulated cambered wings (inner arm/coverts + outer hand/slotted primaries)
      so each wing bends organically at both shoulder and wrist during flight."""

    def add_part(bm, build_fn, mat_idx):
        before = set(bm.faces)
        build_fn(bm)
        for f in bm.faces:
            if f not in before:
                f.material_index = mat_idx

    bm = bmesh.new()

    # 1) Streamlined dorsal torso / mantle (slot 0)
    def b_torso(bm_):
        g = bmesh.ops.create_uvsphere(bm_, u_segments=16, v_segments=10, radius=0.19)
        bmesh.ops.scale(bm_, vec=(2.45, 0.96, 0.86), verts=g['verts'])
        # Taper aft toward rump, broaden rounded chest forward
        for v in g['verts']:
            if v.co.x < 0:
                taper = max(0.32, 1.0 + v.co.x * 1.15)
                v.co.y *= taper
                v.co.z *= taper * 0.92
            v.co.z += 0.015 * math.sin(v.co.x * 3.0)
    add_part(bm, b_torso, 0)

    # 2) Pale buff-grey breast & lower belly keel (slot 1)
    def b_breast(bm_):
        g = bmesh.ops.create_uvsphere(bm_, u_segments=14, v_segments=8, radius=0.175)
        bmesh.ops.scale(bm_, vec=(2.15, 0.88, 0.72), verts=g['verts'])
        bmesh.ops.translate(bm_, verts=g['verts'], vec=(0.04, 0.0, -0.052))
    add_part(bm, b_breast, 1)

    # 3) Crisp white U-shaped rump & undertail coverts (iconic Canada goose field mark, slot 3)
    def b_rump(bm_):
        g = bmesh.ops.create_cone(bm_, cap_ends=True, segments=12, radius1=0.115, radius2=0.065, depth=0.19)
        bmesh.ops.rotate(bm_, verts=g['verts'], cent=(0, 0, 0), matrix=Matrix.Rotation(-math.pi * 0.5, 3, 'Y'))
        bmesh.ops.scale(bm_, vec=(1.0, 1.25, 0.62), verts=g['verts'])
        bmesh.ops.translate(bm_, verts=g['verts'], vec=(-0.44, 0.0, 0.005))
    add_part(bm, b_rump, 3)

    # 4) Fanned matte-black tail feathers extending aft of white rump band (slot 2)
    def b_tail(bm_):
        pts = [(-0.48, 0.07, 0.01), (-0.70, 0.145, 0.015), (-0.74, 0.0, 0.018),
               (-0.70, -0.145, 0.015), (-0.48, -0.07, 0.01)]
        vs = [bm_.verts.new(p) for p in pts]
        f = bm_.faces.new(vs)
        bmesh.ops.solidify(bm_, geom=[f], thickness=0.014)
    add_part(bm, b_tail, 2)

    # 5) Tucked dark webbed feet streaming neatly under the tail in flight (slot 4)
    for sy in (-1, 1):
        def b_foot(bm_, s=sy):
            g = bmesh.ops.create_cone(bm_, cap_ends=True, segments=6, radius1=0.014, radius2=0.038, depth=0.18)
            bmesh.ops.rotate(bm_, verts=g['verts'], cent=(0, 0, 0), matrix=Matrix.Rotation(-math.pi * 0.5, 3, 'Y'))
            bmesh.ops.scale(bm_, vec=(1.0, 1.35, 0.35), verts=g['verts'])
            bmesh.ops.translate(bm_, verts=g['verts'], vec=(-0.50, s * 0.055, -0.065))
        add_part(bm, b_foot, 4)

    # 6) Long graceful S-curved matte-black neck (3 smooth lofted segments, slot 2)
    neck_pts = (
        ((0.36, 0.0, 0.015), 0.078),
        ((0.50, 0.0, 0.048), 0.056),
        ((0.66, 0.0, 0.076), 0.046),
        ((0.82, 0.0, 0.095), 0.044),
    )
    for idx in range(len(neck_pts) - 1):
        (p0, r0), (p1, r1) = neck_pts[idx], neck_pts[idx + 1]
        v0, v1 = Vector(p0), Vector(p1)
        d = v1 - v0
        mid = (v0 + v1) * 0.5
        rot_m = d.normalized().to_track_quat('Z', 'Y').to_matrix()

        def b_nseg(bm_, ra=r0, rb=r1, dep=d.length * 1.12, rm=rot_m, md=mid):
            g = bmesh.ops.create_cone(bm_, cap_ends=True, segments=12, radius1=ra, radius2=rb, depth=dep)
            bmesh.ops.rotate(bm_, verts=g['verts'], cent=(0, 0, 0), matrix=rm)
            bmesh.ops.translate(bm_, verts=g['verts'], vec=md)
        add_part(bm, b_nseg, 2)

    # 7) Anatomically sculpted matte-black head + flat broad waterfowl bill (slot 2)
    def b_head(bm_):
        g = bmesh.ops.create_uvsphere(bm_, u_segments=14, v_segments=10, radius=0.058)
        bmesh.ops.scale(bm_, vec=(1.42, 0.86, 0.94), verts=g['verts'])
        bmesh.ops.translate(bm_, verts=g['verts'], vec=(0.885, 0.0, 0.112))
    add_part(bm, b_head, 2)

    def b_bill(bm_):
        g = bmesh.ops.create_cone(bm_, cap_ends=True, segments=10, radius1=0.032, radius2=0.018, depth=0.115)
        bmesh.ops.rotate(bm_, verts=g['verts'], cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi * 0.5 + 0.08, 3, 'Y'))
        bmesh.ops.scale(bm_, vec=(1.0, 1.05, 0.52), verts=g['verts'])
        bmesh.ops.translate(bm_, verts=g['verts'], vec=(0.99, 0.0, 0.095))
    add_part(bm, b_bill, 2)

    # 8) Unmistakable crisp white cheek / chinstrap patch wrapping under throat & up both cheeks (slot 3)
    def b_chinstrap(bm_):
        g = bmesh.ops.create_uvsphere(bm_, u_segments=12, v_segments=8, radius=0.044)
        bmesh.ops.scale(bm_, vec=(0.85, 1.24, 1.05), verts=g['verts'])
        bmesh.ops.translate(bm_, verts=g['verts'], vec=(0.875, 0.0, 0.096))
    add_part(bm, b_chinstrap, 3)

    # 9) Glossy dark eyes (slot 5)
    for sy in (-1, 1):
        def b_eye(bm_, s=sy):
            g = bmesh.ops.create_uvsphere(bm_, u_segments=8, v_segments=6, radius=0.009)
            bmesh.ops.translate(bm_, verts=g['verts'], vec=(0.915, s * 0.044, 0.125))
        add_part(bm, b_eye, 5)

    me_body = bpy.data.meshes.new('CanadaGooseBody')
    bm.to_mesh(me_body)
    bm.free()
    for p in me_body.polygons:
        p.use_smooth = True
    for m in mats:
        me_body.materials.append(m)

    # 10) Articulated 2-segment cambered wings (Inner arm: 0..0.46 m; Outer hand w/ slotted primaries: 0..0.52 m)
    def make_inner_wing(side):
        bm_w = bmesh.new()
        # Cambered airfoil loft along span y = 0 -> 0.46 m
        sections = (
            (0.00, 0.24, -0.22, 0.045, 0.02),
            (0.16, 0.27, -0.24, 0.055, 0.03),
            (0.32, 0.24, -0.23, 0.045, 0.025),
            (0.46, 0.19, -0.20, 0.032, 0.01),
        )
        rings = []
        for y_d, x_le, x_te, thick, z_off in sections:
            y = side * y_d
            xm = (x_le + x_te) * 0.5
            pts = (
                (x_le, y, z_off),
                (xm + 0.04, y, z_off + thick * 0.65),
                (x_te, y, z_off - thick * 0.1),
                (xm, y, z_off - thick * 0.35),
            )
            rings.append([bm_w.verts.new(p) for p in pts])
        for i in range(len(rings) - 1):
            r0, r1 = rings[i], rings[i + 1]
            for j in range(4):
                jn = (j + 1) % 4
                quad = [r0[j], r0[jn], r1[jn], r1[j]] if side > 0 else [r0[j], r1[j], r1[jn], r0[jn]]
                f = bm_w.faces.new(quad)
                f.material_index = 0  # Feathered brown coverts
        me = bpy.data.meshes.new('GooseInnerWing_%s' % ('L' if side > 0 else 'R'))
        bm_w.to_mesh(me)
        bm_w.free()
        for p in me.polygons:
            p.use_smooth = True
        for m in mats:
            me.materials.append(m)
        return me

    def make_outer_wing(side):
        bm_w = bmesh.new()
        # Swept tapered outer wing transitioning to dark primary flight feathers + 4 slotted wingtip fingers
        sections = (
            (0.00, 0.19, -0.20, 0.030, 0.00),
            (0.18, 0.13, -0.18, 0.022, -0.005),
            (0.36, 0.05, -0.14, 0.015, -0.012),
            (0.50, -0.03, -0.10, 0.009, -0.018),
        )
        rings = []
        for y_d, x_le, x_te, thick, z_off in sections:
            y = side * y_d
            xm = (x_le + x_te) * 0.5
            pts = (
                (x_le, y, z_off),
                (xm + 0.02, y, z_off + thick * 0.6),
                (x_te, y, z_off - thick * 0.1),
                (xm, y, z_off - thick * 0.3),
            )
            rings.append([bm_w.verts.new(p) for p in pts])
        for i in range(len(rings) - 1):
            r0, r1 = rings[i], rings[i + 1]
            for j in range(4):
                jn = (j + 1) % 4
                quad = [r0[j], r0[jn], r1[jn], r1[j]] if side > 0 else [r0[j], r1[j], r1[jn], r0[jn]]
                f = bm_w.faces.new(quad)
                f.material_index = 4 if i >= 1 else 0  # Dark primaries toward tip
        # 4 distinct slotted primary tip feathers fanning out at the wingtip
        for k in range(4):
            y0 = side * (0.43 + k * 0.022)
            y1 = side * (0.58 - k * 0.024)
            x0 = 0.01 - k * 0.032
            x1 = -0.04 - k * 0.042
            z0 = -0.012 - k * 0.003
            z1 = 0.010 - k * 0.008  # slight aerodynamic upcurl at primary tips
            pts = [(x0 + 0.015, y0, z0), (x1 + 0.010, y1, z1), (x1 - 0.012, y1, z1), (x0 - 0.015, y0, z0)]
            vs = [bm_w.verts.new(p) for p in (pts if side > 0 else list(reversed(pts)))]
            f = bm_w.faces.new(vs)
            f.material_index = 4
            bmesh.ops.solidify(bm_w, geom=[f], thickness=0.006)
        me = bpy.data.meshes.new('GooseOuterWing_%s' % ('L' if side > 0 else 'R'))
        bm_w.to_mesh(me)
        bm_w.free()
        for p in me.polygons:
            p.use_smooth = True
        for m in mats:
            me.materials.append(m)
        return me

    return me_body, make_inner_wing(1), make_inner_wing(-1), make_outer_wing(1), make_outer_wing(-1)


def build_flock(col, tex_dir, tl, count=60, seed=7):
    """Flock of 60 anatomically realistic banking, flapping Canada geese crossing the approach corridor
    (Shots 5, 6, 7, 8a) with 2-joint articulated wingbeats and realistic V-skein + swirling formations."""
    count = max(50, int(count))
    mats = make_goose_materials(tex_dir)
    me_body, me_il, me_ir, me_ol, me_or = build_goose_meshes(mats)

    rng = random.Random(seed + 101)
    flock_root = C.empty('FLOCK', (0.0, 0.0, 0.0), col)

    # 2 realistic V-skeins (30 birds) + loose trailing/banking cloud (remaining)
    offsets = []
    for i in range(count):
        if i < 30:
            sk = 0 if i < 16 else 1
            j = i if i < 16 else (i - 16)
            arm = 1 if (j % 2 == 0) else -1
            rank = (j + 1) // 2
            off = Vector((-rank * 2.2 - sk * 12.0, arm * rank * 2.1 + sk * 11.0, sk * 2.8 + rng.uniform(-0.8, 0.8)))
        else:
            off = Vector((rng.uniform(-22.0, 18.0), rng.uniform(-22.0, 22.0), rng.uniform(-6.5, 6.5)))
        offsets.append((off, rng.uniform(0.0, 12.0), rng.uniform(0.86, 1.18), rng.uniform(0.92, 1.16)))

    f_vis_0 = tl.frame(0.300) + 1
    f_vis_1 = tl.frame(0.895)
    sample_frames = tl.sample_frames(f_vis_0, f_vis_1, target_samples=28)

    for i, (off, ph, spd, sc) in enumerate(offsets):
        b_root = C.link(bpy.data.objects.new('Goose_%02d' % i, me_body), col)
        b_root.scale = (sc, sc, sc)
        b_root.parent = flock_root

        # Inner wing (shoulder pivot) + outer wing (wrist pivot at y = +-0.45 m)
        il = C.link(bpy.data.objects.new('Goose_%02d_IL' % i, me_il), col)
        il.location = (0.04, 0.13, 0.04)
        il.parent = b_root
        ol = C.link(bpy.data.objects.new('Goose_%02d_OL' % i, me_ol), col)
        ol.location = (0.0, 0.45, 0.01)
        ol.parent = il

        ir = C.link(bpy.data.objects.new('Goose_%02d_IR' % i, me_ir), col)
        ir.location = (0.04, -0.13, 0.04)
        ir.parent = b_root
        or_ = C.link(bpy.data.objects.new('Goose_%02d_OR' % i, me_or), col)
        or_.location = (0.0, -0.45, 0.01)
        or_.parent = ir

        # Realistic Canada goose wingbeat (~2.3 Hz * spd): shoulder flap + phase-lagged wrist whip!
        # Every 6th bird glides/banks with gently cupped wings for natural flock variety
        gliding = (i % 7 == 5)
        if gliding:
            il.rotation_euler = (C.deg(12.0), 0.0, 0.0)
            ir.rotation_euler = (C.deg(-12.0), 0.0, 0.0)
            ol.rotation_euler = (C.deg(-16.0), 0.0, 0.0)
            or_.rotation_euler = (C.deg(16.0), 0.0, 0.0)
        else:
            period = max(4, int(round((tl.fps / 2.3) / spd)))
            q1 = max(1, period // 4)
            q2 = max(2, period // 2)
            q3 = max(3, (3 * period) // 4)
            f0 = 1 + int(ph * period) % period
            amp = 32.0 * rng.uniform(0.84, 1.12)
            # Shoulder downstroke/upstroke
            for wf, ang in ((f0, amp), (f0 + q2, -amp * 0.82), (f0 + period, amp)):
                C.key(il, wf, rot=(ang, 0.0, 0.0))
                C.key(ir, wf, rot=(-ang, 0.0, 0.0))
            # Wrist bends cleanly on recovery upstroke and extends flat/cupped on power downstroke
            for wf, wang in ((f0, -10.0), (f0 + q1, 24.0), (f0 + q2, 8.0), (f0 + q3, -28.0), (f0 + period, -10.0)):
                C.key(ol, wf, rot=(wang, 0.0, 0.0))
                C.key(or_, wf, rot=(-wang, 0.0, 0.0))
            for wobj in (il, ir, ol, or_):
                C.ease(wobj)
                for fc in C.iter_fcurves(wobj):
                    fc.modifiers.new('CYCLES')

        for f in sample_frames:
            u = tl.u(f)
            t_s = u * DEFAULT_DURATION_S
            c0 = flock_center(u)
            c1 = flock_center(min(1.0, u + 0.008))
            vel = (c1 - c0).normalized()
            hdg = math.atan2(vel.y, vel.x)
            swirl = math.sin(t_s * 1.05 * spd + ph) * (0.34 if i >= 30 else 0.10)
            scatter = smoothstep(0.815, 0.880, u) * (1.0 + 0.65 * (i % 3))
            ang = hdg + swirl
            ca, sa = math.cos(ang), math.sin(ang)
            loc = Vector((
                c0.x + (off.x * ca - off.y * sa) * (1.0 + scatter * 0.45) + math.sin(t_s * 1.8 + ph) * 1.2,
                c0.y + (off.x * sa + off.y * ca) * (1.0 + scatter * 0.45) + math.cos(t_s * 1.6 + ph) * 1.2,
                c0.z + off.z * (1.0 + scatter * 0.35) + math.sin(t_s * 2.4 + ph * 2.0) * 0.9 - scatter * 5.0,
            ))
            bank = math.cos(t_s * 1.05 * spd + ph) * 24.0 * (1.0 if i >= 30 else 0.45)
            pitch_b = -math.sin(t_s * 2.4 + ph) * 5.0
            C.key(b_root, f, loc=loc, rot=(bank, pitch_b, math.degrees(ang)))

        vis = [(f_vis_0, f_vis_1)]
        for obj_p in (b_root, il, ir, ol, or_):
            set_visibility_ranges(obj_p, vis, tl.total)

    return flock_root


def build_drone(col, tl):
    """Hovering quadcopter drone near the perimeter fence with spinning rotors & blinking nav LEDs."""
    root = C.empty('DRONE', DRONE_POS, col, 'ARROWS', 0.4)
    white_m = C.material('DroneBody', Base_Color=(0.82, 0.85, 0.88, 1.0), Roughness=0.34, Metallic=0.12, Coat_Weight=0.5)
    carbon_m = C.material('DroneCarbon', Base_Color=(0.06, 0.07, 0.08, 1.0), Roughness=0.38, Metallic=0.40)
    rotor_m = C.material('DroneRotor', Base_Color=(0.10, 0.11, 0.12, 1.0), Roughness=0.35)

    hull = C.box('DroneHull', (0.28, 0.16, 0.085), (0.0, 0.0, 0.0), col, white_m)
    hull.modifiers.new('Bevel', 'BEVEL').width = 0.02
    hull.parent = root
    cam_g = C.sphere('DroneGimbal', 0.042, (0.11, 0.0, -0.06), col, carbon_m)
    cam_g.parent = root
    for sy in (-1, 1):
        sk = C.box('DroneSkid_%d' % sy, (0.24, 0.014, 0.014), (0.0, sy * 0.11, -0.11), col, carbon_m)
        sk.parent = root
        for sx in (-0.07, 0.07):
            lg = make_bar('DroneLeg_%d_%d' % (sy, int(sx * 100)), (sx, sy * 0.07, -0.03), (sx, sy * 0.11, -0.11),
                          0.012, col, carbon_m, radius=0.007)
            lg.parent = root

    w_led = tl.rad_per_frame(1.6)
    w_str = tl.rad_per_frame(1.3)
    led_r = C.emission_material('DroneRedLED', color=(1.0, 0.07, 0.03, 1.0), strength=0.0)
    led_g = C.emission_material('DroneGreenLED', color=(0.06, 1.0, 0.36, 1.0), strength=0.0)
    led_w = C.material('DroneWhiteStrobe', Base_Color=(0.88, 0.92, 0.96, 1.0), Roughness=0.10, Transmission_Weight=0.7)
    try:
        C.set_input(C.bsdf_of(led_w), 'Emission Color', (1.0, 1.0, 1.0, 1.0))
        if 'Emission Strength' in C.bsdf_of(led_w).inputs:
            C.frame_driver(C.bsdf_of(led_w).inputs['Emission Strength'],
                           '145.0 * pow(max(0.0, sin(frame * %.6f)), 24.0)' % w_str)
    except KeyError:
        pass
    C.frame_driver(led_r.node_tree.nodes[led_r['emission_node']].inputs['Strength'],
                   '55.0 * max(0.15, pow(max(0.0, sin(frame * %.6f)), 4.0))' % w_led)
    C.frame_driver(led_g.node_tree.nodes[led_g['emission_node']].inputs['Strength'],
                   '55.0 * max(0.15, pow(max(0.0, sin(frame * %.6f + 1.5)), 4.0))' % w_led)

    top_str = C.ico('DroneTopStrobe', 0.022, 1, (0.0, 0.0, 0.055), col, led_w)
    top_str.parent = root

    # 4 arms, motors, ~3600 RPM spinning blades (authentic Cycles motion blur at both 24 fps & 240 fps)
    total_deg = 60.0 * 360.0 * tl.duration  # 60 rev/s = 3600 RPM
    for k in range(4):
        ang = math.pi * 0.25 + k * math.pi * 0.5
        ax, ay = math.cos(ang) * 0.25, math.sin(ang) * 0.25
        arm = make_bar('DroneArm_%d' % k, (0.0, 0.0, 0.01), (ax, ay, 0.02), 0.024, col, carbon_m, radius=0.014)
        arm.parent = root
        mot = C.cylinder('DroneMotor_%d' % k, 0.028, 0.042, (ax, ay, 0.035), col, carbon_m, segments=14)
        mot.parent = root
        blade = C.box('DroneProp_%d' % k, (0.24, 0.022, 0.005), (ax, ay, 0.062), col, rotor_m)
        blade.parent = root
        sign = 1.0 if (k % 2 == 0) else -1.0
        C.key(blade, 1, rot=(0.0, 0.0, 0.0))
        C.key(blade, tl.total, rot=(0.0, 0.0, sign * total_deg))
        C.interpolation(blade, 'LINEAR')
        led = C.ico('DroneLED_%d' % k, 0.018, 1, (ax, ay, -0.005), col, led_r if ax > 0 else led_g)
        led.parent = root

    for f in tl.sample_frames(tl.frame(0.300) + 1, tl.frame(0.900), target_samples=20):
        t_s = tl.u(f) * DEFAULT_DURATION_S
        loc = Vector((
            DRONE_POS.x + math.sin(t_s * 1.1) * 1.4,
            DRONE_POS.y + math.cos(t_s * 0.9) * 1.1,
            DRONE_POS.z + math.sin(t_s * 2.3) * 0.45,
        ))
        C.key(root, f, loc=loc, rot=(math.sin(t_s * 1.7) * 3.0, math.cos(t_s * 1.4) * 2.5, math.sin(t_s * 0.7) * 18.0))
    C.ease(root)
    return root


def build_sentry_tripod(col, tl):
    """Physical Sky Sentry smartphone on tripod beside approach lights (hidden during Shot 6 POV)."""
    root = C.empty('SENTRY_TRIPOD', (SENTRY_POS.x, SENTRY_POS.y, 0.0), col)
    blk = C.material('TripodBlack', Base_Color=(0.08, 0.09, 0.10, 1.0), Metallic=0.65, Roughness=0.38)
    scr_m = C.emission_material('PhoneScreen', color=(0.24, 0.52, 0.92, 1.0), strength=2.4)
    objs = []
    for k in range(3):
        ang = k * 2.0 * math.pi / 3.0
        leg = make_bar('TripodLeg_%d' % k, (math.cos(ang) * 0.35, math.sin(ang) * 0.35, 0.0),
                       (0.0, 0.0, 1.48), 0.02, col, blk, radius=0.014)
        leg.parent = root
        objs.append(leg)
    phone = C.box('SentryPhone', (0.012, 0.16, 0.082), (0.0, 0.0, 1.54), col, blk)
    phone.parent = root
    objs.append(phone)
    scr = C.plane('SentryPhoneScr', (0.148, 0.072), (0.008, 0.0, 1.54), col, scr_m)
    scr.rotation_euler = (math.pi * 0.5, 0.0, math.pi * 0.5)
    scr.parent = root
    objs.append(scr)
    vis = [(tl.frame(0.300) + 1, tl.frame(0.530)), (tl.frame(0.640) + 1, tl.frame(0.880))]
    for o in objs:
        set_visibility_ranges(o, vis, tl.total)
    return root


# ------------------------------------------------------------------------------------------------ control tower
def make_atc_monitor_material(name, tex_path, fallback_col=(0.06, 0.28, 0.24, 1.0), strength=2.6, pulse_tl=None):
    """Self-lit FAA ATC console monitor material using Pillow-generated 1024px displays with subtle glass sheen."""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    em = nt.nodes.new('ShaderNodeEmission')
    em.inputs['Strength'].default_value = strength

    img = safe_load_image(tex_path, non_color=False)
    if img is not None:
        tex = nt.nodes.new('ShaderNodeTexImage')
        tex.image = img
        nt.links.new(tex.outputs['Color'], em.inputs['Color'])
    else:
        em.inputs['Color'].default_value = fallback_col

    if pulse_tl is not None:
        # Subtle pulse on the primary Sky Sentry red alert display during Shot 7 alert
        C.frame_driver(em.inputs['Strength'],
                       '%.2f + 0.85 * pow(max(0.0, sin(frame * %.6f)), 2.0)' % (strength, pulse_tl.rad_per_frame(2.2)))

    # Add realistic subtle anti-glare monitor glass specular via Fresnel mix
    gl = nt.nodes.new('ShaderNodeBsdfGlossy')
    gl.inputs['Color'].default_value = (0.85, 0.90, 0.96, 1.0)
    gl.inputs['Roughness'].default_value = 0.14
    mix = nt.nodes.new('ShaderNodeMixShader')
    mix.inputs[0].default_value = 0.08
    nt.links.new(em.outputs[0], mix.inputs[1])
    nt.links.new(gl.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs['Surface'])
    return mat


def build_human_controller(col, parent_obj, name_c, loc, yaw_deg, standing=False,
                           shirt_rgb=(0.12, 0.17, 0.26), pants_rgb=(0.07, 0.08, 0.10),
                           skin_rgb=(0.64, 0.46, 0.36), hair_rgb=(0.14, 0.10, 0.08),
                           holding_binocs=False, hand_to_mic=False):
    """Articulated, realistically proportioned human FAA ATC controller (seated or standing),
    parented to `name_c` empty so Mixamo characters can still swap in cleanly."""
    c_root = C.empty(name_c, loc, col, 'ARROWS', 0.45)
    c_root.rotation_euler = (0.0, 0.0, C.deg(yaw_deg))
    c_root.parent = parent_obj

    shirt_m = C.material(name_c + '_Shirt', Base_Color=(*shirt_rgb, 1.0), Roughness=0.82)
    pants_m = C.material(name_c + '_Pants', Base_Color=(*pants_rgb, 1.0), Roughness=0.86)
    skin_m = C.material(name_c + '_Skin', Base_Color=(*skin_rgb, 1.0), Roughness=0.52, Subsurface_Weight=0.28)
    hair_m = C.material(name_c + '_Hair', Base_Color=(*hair_rgb, 1.0), Roughness=0.88)
    shoe_m = C.material(name_c + '_Shoe', Base_Color=(0.05, 0.05, 0.055, 1.0), Roughness=0.45)
    dark_m = C.material(name_c + '_Gear', Base_Color=(0.05, 0.055, 0.065, 1.0), Roughness=0.40, Metallic=0.35)
    lanyard_m = C.material(name_c + '_Badge', Base_Color=(0.14, 0.36, 0.72, 1.0), Roughness=0.55)
    chrome_m = C.material(name_c + '_Chrome', Base_Color=(0.72, 0.75, 0.78, 1.0), Metallic=0.90, Roughness=0.24)

    def p(o):
        if o is not None:
            o.parent = c_root
        return o

    # Height offsets: standing eye ~ 1.70 m, seated on elevated ATC drafting chair eye ~ 1.46 m
    hip_z = 0.94 if standing else 0.62
    sh_z = hip_z + 0.50
    head_z = sh_z + 0.21
    lean_x = 0.11 if standing else 0.07

    # Ergonomic ATC swivel chair for seated controllers (5-star caster base, gas lift, armrests, mesh back)
    if not standing:
        p(C.cylinder(name_c + '_ChairPost', 0.032, 0.50, (-0.06, 0.0, 0.28), col, chrome_m, segments=12))
        p(C.cylinder(name_c + '_ChairRing', 0.22, 0.018, (-0.06, 0.0, 0.22), col, chrome_m, segments=20))
        for k in range(5):
            a = k * 2.0 * math.pi / 5.0
            p(make_bar(name_c + '_Caster_%d' % k, (-0.06, 0.0, 0.07),
                       (-0.06 + math.cos(a) * 0.32, math.sin(a) * 0.32, 0.04), 0.03, col, dark_m, radius=0.018))
        p(C.box(name_c + '_SeatCush', (0.46, 0.46, 0.08), (-0.04, 0.0, 0.55), col, dark_m))
        sb = p(C.box(name_c + '_SeatBack', (0.06, 0.44, 0.56), (-0.25, 0.0, 0.88), col, dark_m))
        sb.rotation_euler = (0.0, C.deg(-8.0), 0.0)
        for s in (-1, 1):
            p(C.box(name_c + '_ArmRest_%d' % s, (0.30, 0.055, 0.03), (-0.04, s * 0.25, 0.78), col, dark_m))
            p(make_bar(name_c + '_ArmPost_%d' % s, (-0.08, s * 0.25, 0.56), (-0.08, s * 0.25, 0.78), 0.025, col, dark_m, radius=0.015))

    # Pelvis & articulated legs
    pelv = p(C.sphere(name_c + '_Pelvis', 0.16, (0.0, 0.0, hip_z), col, pants_m))
    pelv.scale = (0.78, 1.15, 0.82)
    for s in (-1, 1):
        hip_pt = (0.0, s * 0.11, hip_z - 0.04)
        if standing:
            knee_pt = (0.04 if s > 0 else -0.04, s * 0.115, 0.49)
            ank_pt = (0.06 if s > 0 else -0.06, s * 0.12, 0.08)
        else:
            knee_pt = (0.34, s * 0.125, hip_z - 0.06)
            ank_pt = (0.30, s * 0.125, 0.14)
        p(make_bar(name_c + '_Thigh_%d' % s, hip_pt, knee_pt, 0.08, col, pants_m, radius=0.072))
        p(make_bar(name_c + '_Calf_%d' % s, knee_pt, ank_pt, 0.06, col, pants_m, radius=0.052))
        shoe = p(C.box(name_c + '_Shoe_%d' % s, (0.24, 0.095, 0.07), (ank_pt[0] + 0.05, ank_pt[1], ank_pt[2] - 0.04), col, shoe_m))
        shoe.modifiers.new('Bevel', 'BEVEL').width = 0.015

    # Smooth, continuous sculpted human torso + sloped shoulders (single lofted bmesh — zero mannequin ball-joint seams!)
    def build_sculpted_torso(bm):
        # Elliptical rings from lower hem (hip) -> waist -> ribcage -> broad sloped shoulders -> collar base
        rings_spec = (
            (hip_z - 0.06,  lean_x * 0.10, 0.125, 0.175),
            (hip_z + 0.06,  lean_x * 0.25, 0.118, 0.162),
            (hip_z + 0.20,  lean_x * 0.45, 0.128, 0.180),
            (hip_z + 0.34,  lean_x * 0.68, 0.138, 0.212),
            (sh_z - 0.04,   lean_x * 0.88, 0.125, 0.238),
            (sh_z + 0.015,  lean_x * 0.96, 0.088, 0.155),
            (sh_z + 0.045,  lean_x * 1.00, 0.066, 0.072),
        )
        segs = 20
        rings = []
        for rz, cx, rx, ry in rings_spec:
            ring = []
            for k in range(segs):
                a = k * 2.0 * math.pi / segs
                # Slight anatomical flattening across upper back & chest
                vx = cx + math.cos(a) * rx
                vy = math.sin(a) * ry
                ring.append(bm.verts.new((vx, vy, rz)))
            rings.append(ring)
        for i in range(len(rings) - 1):
            r0, r1 = rings[i], rings[i + 1]
            for k in range(segs):
                kn = (k + 1) % segs
                bm.faces.new((r0[k], r0[kn], r1[kn], r1[k]))
        bm.faces.new(list(reversed(rings[0])))
        bm.faces.new(rings[-1])

    p(C.mesh_object(name_c + '_TorsoMesh', build_sculpted_torso, col, (0.0, 0.0, 0.0), smooth=True)).data.materials.append(shirt_m)
    # Subtle woven cloth micro-bump on shirt/jacket so shoulders & back catch dawn rim light organically
    nt_s = shirt_m.node_tree
    bs_s = C.bsdf_of(shirt_m)
    tc_s = nt_s.nodes.new('ShaderNodeTexCoord')
    n_s = nt_s.nodes.new('ShaderNodeTexNoise')
    n_s.inputs['Scale'].default_value = 95.0
    n_s.inputs['Detail'].default_value = 4.0
    nt_s.links.new(tc_s.outputs['Object'], n_s.inputs['Vector'])
    bp_s = nt_s.nodes.new('ShaderNodeBump')
    bp_s.inputs['Strength'].default_value = 0.08
    nt_s.links.new(n_s.outputs['Fac'], bp_s.inputs['Height'])
    nt_s.links.new(bp_s.outputs['Normal'], bs_s.inputs['Normal'])

    # FAA ID lanyard badge on chest
    p(C.box(name_c + '_IDBadge', (0.012, 0.055, 0.085), (lean_x + 0.132, 0.06, sh_z - 0.14), col, lanyard_m))

    # Sculpted neck, head with jawline/nose/ears, realistic hair, and Plantronics-style ATC headset
    p(C.cylinder(name_c + '_Neck', 0.052, 0.11, (lean_x + 0.01, 0.0, sh_z + 0.08), col, skin_m, segments=14))
    head = p(C.sphere(name_c + '_Head', 0.102, (lean_x + 0.03, 0.0, head_z), col, skin_m, segments=20, rings=14))
    head.scale = (1.06, 0.88, 1.14)
    jaw = p(C.sphere(name_c + '_Jaw', 0.076, (lean_x + 0.055, 0.0, head_z - 0.052), col, skin_m))
    jaw.scale = (0.98, 0.86, 0.92)
    nose = p(C.cylinder(name_c + '_Nose', 0.015, 0.042, (lean_x + 0.132, 0.0, head_z - 0.008), col, skin_m, segments=8, radius2=0.007))
    nose.rotation_euler = (0.0, C.deg(62.0), 0.0)
    hair = p(C.sphere(name_c + '_HairCap', 0.107, (lean_x + 0.012, 0.0, head_z + 0.025), col, hair_m, segments=18, rings=12))
    hair.scale = (1.05, 0.92, 0.98)
    for s in (-1, 1):
        ear = p(C.sphere(name_c + '_Ear_%d' % s, 0.024, (lean_x + 0.02, s * 0.088, head_z - 0.005), col, skin_m))
        ear.scale = (0.65, 0.45, 1.15)

    # Single-ear FAA ATC headset + thin metal headband + curved boom mic
    p(C.cylinder(name_c + '_HeadsetCup', 0.036, 0.028, (lean_x + 0.02, 0.098, head_z - 0.002), col, dark_m, segments=16)).rotation_euler = (math.pi * 0.5, 0.0, 0.0)
    p(make_bar(name_c + '_HeadBandL', (lean_x + 0.02, 0.098, head_z + 0.02), (lean_x + 0.02, 0.0, head_z + 0.132), 0.01, col, chrome_m, radius=0.006))
    p(make_bar(name_c + '_HeadBandR', (lean_x + 0.02, -0.092, head_z + 0.02), (lean_x + 0.02, 0.0, head_z + 0.132), 0.01, col, chrome_m, radius=0.006))
    p(make_bar(name_c + '_BoomMic', (lean_x + 0.03, 0.095, head_z - 0.015), (lean_x + 0.155, 0.028, head_z - 0.048), 0.008, col, dark_m, radius=0.004))

    # Articulated arms & sleeves tucked smoothly into the sculpted shoulders (no exposed shoulder spheres!)
    for s in (-1, 1):
        sh = (lean_x * 0.85, s * 0.195, sh_z - 0.055)
        if standing:
            if s < 0 and holding_binocs:
                el = (lean_x + 0.16, -0.25, sh_z - 0.20)
                wr = (lean_x + 0.24, -0.10, head_z - 0.06)
                hd = (lean_x + 0.23, -0.06, head_z - 0.03)
            else:
                el = (lean_x + 0.20, s * 0.24, sh_z - 0.24)
                wr = (lean_x + 0.44, s * 0.16, 0.84)
                hd = (lean_x + 0.50, s * 0.14, 0.82)
        else:
            if s < 0 and hand_to_mic:
                el = (lean_x + 0.18, -0.25, sh_z - 0.22)
                wr = (lean_x + 0.16, -0.15, head_z - 0.09)
                hd = (lean_x + 0.11, -0.10, head_z - 0.04)
            else:
                el = (lean_x + 0.16, s * 0.23, sh_z - 0.26)
                wr = (lean_x + 0.42, s * 0.14, 0.84)
                hd = (lean_x + 0.49, s * 0.12, 0.83)
        p(make_bar(name_c + '_UpperArm_%d' % s, sh, el, 0.05, col, shirt_m, radius=0.052))
        p(C.sphere(name_c + '_Elbow_%d' % s, 0.046, el, col, shirt_m))
        p(make_bar(name_c + '_ForeArm_%d' % s, el, wr, 0.04, col, shirt_m, radius=0.040))
        hand = p(C.sphere(name_c + '_Hand_%d' % s, 0.042, hd, col, skin_m))
        hand.scale = (1.25, 0.9, 0.62)

    if standing and holding_binocs:
        for bs in (-0.036, 0.036):
            br = p(C.cylinder(name_c + '_Binoc_%d' % int(bs * 100), 0.026, 0.15, (lean_x + 0.24, bs - 0.02, head_z - 0.02), col, dark_m, segments=14, radius2=0.020))
            br.rotation_euler = (0.0, math.pi * 0.5, 0.0)

    return c_root


def build_control_tower(col, tex_dir, tl):
    """Real-life FAA Airport Traffic Control Tower cab modeled after Evans-outfitted FAA towers
    (e.g., LAS/JFK/ORD):
    - 12-sided panoramic 360-deg outward-canted (~15.3 deg) green-tinted anti-glare windows
    - Slim dark structural steel mullions + retractable tinted roller sunshades at top
    - Dark charcoal acoustic tile ceiling with recessed warm/cool downlights & overhead UTC clock
    - Wrap-around Evans-style perimeter slatwall console with 18 distinct dual-tier mounted FAA
      monitors (STARS, ASDE-X, TFDM, IDS4, ITWS, VCSS, TBFM, Sky Sentry live red-alert console)
    - Keyboards, trackballs, gooseneck PTT mics, binoculars, coffee mugs, FAA light gun, red beacon
    - 3 realistic articulated human ATC controllers (2 seated + 1 standing supervisor)."""
    root = C.empty('CONTROL_TOWER', TOWER_POS, col, 'ARROWS', 3.0)
    # Local +X points directly along the approach corridor toward the crossing flock & approaching 747SP!
    aim = Vector((-340.0, 0.0, 0.0)) - TOWER_POS
    root.rotation_euler = (0.0, 0.0, math.atan2(aim.y, aim.x))

    conc = C.material('TowerConcrete', Base_Color=(0.64, 0.66, 0.69, 1.0), Roughness=0.82)
    mull = C.material('TowerMullion', Base_Color=(0.07, 0.08, 0.095, 1.0), Metallic=0.82, Roughness=0.34, Anisotropic=0.35)
    desk_top = C.material('EvansDeskTop', Base_Color=(0.14, 0.155, 0.175, 1.0), Roughness=0.52, Metallic=0.08)
    slatwall = C.material('EvansSlatwall', Base_Color=(0.24, 0.26, 0.29, 1.0), Metallic=0.72, Roughness=0.38, Anisotropic=0.5)
    desk_base = C.material('EvansDeskBase', Base_Color=(0.06, 0.065, 0.075, 1.0), Roughness=0.68)
    carpet_m = C.material('CabCarpet', Base_Color=(0.06, 0.068, 0.082, 1.0), Roughness=0.95)
    ceil_m = C.material('AcousticCeiling', Base_Color=(0.08, 0.088, 0.10, 1.0), Roughness=0.92)
    mon_shell = C.material('MonShell', Base_Color=(0.045, 0.05, 0.058, 1.0), Roughness=0.40, Metallic=0.35)
    vesa_m = C.material('VESAArm', Base_Color=(0.22, 0.24, 0.27, 1.0), Metallic=0.80, Roughness=0.32)
    mug_w = C.material('CoffeeMug', Base_Color=(0.88, 0.86, 0.82, 1.0), Roughness=0.22, Coat_Weight=0.8)
    mug_b = C.material('CoffeeMugBlue', Base_Color=(0.10, 0.22, 0.44, 1.0), Roughness=0.22, Coat_Weight=0.8)
    downlight_m = C.emission_material('CabDownlight', color=(1.0, 0.90, 0.74, 1.0), strength=6.5)
    clock_m = C.emission_material('OverheadUTC', color=(1.0, 0.22, 0.12, 1.0), strength=5.5)
    led_g = C.emission_material('RackLEDGreen', color=(0.12, 1.0, 0.45, 1.0), strength=8.0)

    # Anti-glare 15-deg outward-canted green-tinted architectural glass (Fresnel reflection, no opaque shadow rays)
    cab_glass = bpy.data.materials.new('TowerCabGlass')
    cab_glass.use_nodes = True
    ntg = cab_glass.node_tree
    ntg.nodes.clear()
    og = ntg.nodes.new('ShaderNodeOutputMaterial')
    tg = ntg.nodes.new('ShaderNodeBsdfTransparent')
    tg.inputs['Color'].default_value = (0.94, 0.985, 0.96, 1.0)  # subtle FAA green anti-glare tint
    gg = ntg.nodes.new('ShaderNodeBsdfGlossy')
    gg.inputs['Color'].default_value = (0.68, 0.88, 0.80, 1.0)
    gg.inputs['Roughness'].default_value = 0.03
    fg = ntg.nodes.new('ShaderNodeFresnel')
    fg.inputs['IOR'].default_value = 1.52
    f_mul = ntg.nodes.new('ShaderNodeMath')
    f_mul.operation = 'MULTIPLY'
    f_mul.inputs[1].default_value = 0.16
    ntg.links.new(fg.outputs['Fac'], f_mul.inputs[0])
    mg = ntg.nodes.new('ShaderNodeMixShader')
    ntg.links.new(f_mul.outputs[0], mg.inputs[0])
    ntg.links.new(tg.outputs[0], mg.inputs[1])
    ntg.links.new(gg.outputs[0], mg.inputs[2])
    ntg.links.new(mg.outputs[0], og.inputs['Surface'])

    # Translucent dark grey roller sunshade at top of panoramic cab windows
    shade_m = bpy.data.materials.new('TowerSunshade')
    shade_m.use_nodes = True
    nts = shade_m.node_tree
    nts.nodes.clear()
    os_ = nts.nodes.new('ShaderNodeOutputMaterial')
    ts_ = nts.nodes.new('ShaderNodeBsdfTransparent')
    ts_.inputs['Color'].default_value = (0.28, 0.32, 0.36, 1.0)
    ds_ = nts.nodes.new('ShaderNodeBsdfPrincipled')
    ds_.inputs['Base Color'].default_value = (0.04, 0.045, 0.055, 1.0)
    ds_.inputs['Roughness'].default_value = 0.85
    ms_ = nts.nodes.new('ShaderNodeMixShader')
    ms_.inputs[0].default_value = 0.45
    nts.links.new(ts_.outputs[0], ms_.inputs[1])
    nts.links.new(ds_.outputs[0], ms_.inputs[2])
    nts.links.new(ms_.outputs[0], os_.inputs['Surface'])

    # 8 distinct high-res generated FAA ATC monitor materials
    m_stars = make_atc_monitor_material('ATC_STARS', os.path.join(tex_dir, 'atc_stars.png'), (0.04, 0.26, 0.18, 1.0), 2.8)
    m_asdex = make_atc_monitor_material('ATC_ASDEX', os.path.join(tex_dir, 'atc_asdex.png'), (0.12, 0.14, 0.16, 1.0), 2.5)
    m_tfdm = make_atc_monitor_material('ATC_TFDM', os.path.join(tex_dir, 'atc_tfdm.png'), (0.14, 0.18, 0.24, 1.0), 2.4)
    m_ids4 = make_atc_monitor_material('ATC_IDS4', os.path.join(tex_dir, 'atc_ids4.png'), (0.06, 0.14, 0.28, 1.0), 2.5)
    m_wx = make_atc_monitor_material('ATC_ITWS', os.path.join(tex_dir, 'atc_weather.png'), (0.06, 0.20, 0.28, 1.0), 2.5)
    m_sentry = make_atc_monitor_material('ATC_SkySentry', os.path.join(tex_dir, 'atc_sentry_alert.png'),
                                         (0.65, 0.08, 0.06, 1.0), 3.4, pulse_tl=tl)
    m_comms = make_atc_monitor_material('ATC_VCSS', os.path.join(tex_dir, 'atc_comms.png'), (0.08, 0.22, 0.14, 1.0), 2.4)
    m_tbfm = make_atc_monitor_material('ATC_TBFM', os.path.join(tex_dir, 'atc_flightplan.png'), (0.08, 0.16, 0.24, 1.0), 2.4)

    def add(o):
        o.parent = root
        return o

    # Exterior concrete shaft, sub-cab equipment junction level, cab floor, overhang roof, radome & spire
    add(C.cylinder('TowerShaft', 4.1, TOWER_CAB_Z - 3.6, (0.0, 0.0, (TOWER_CAB_Z - 3.6) * 0.5), col, conc,
                   segments=12, radius2=3.8))
    add(C.cylinder('TowerJunction', 5.8, 3.6, (0.0, 0.0, TOWER_CAB_Z - 1.8), col, conc, segments=12, radius2=6.35))
    add(C.cylinder('TowerCabFloor', 6.30, 0.25, (0.0, 0.0, TOWER_CAB_Z - 0.125), col, carpet_m, segments=12))
    # Raised central supervisor platform step (classic FAA cab detail)
    add(C.cylinder('SupervisorPlatform', 2.45, 0.12, (-0.8, 0.0, TOWER_CAB_Z + 0.06), col, carpet_m, segments=12))

    cab_h = 4.40
    sill_h = 0.92
    r_bot = 6.20
    r_top = 7.38  # atan((7.38 - 6.20) / 4.40) = 15.0 deg authentic outward window cant!
    add(C.cylinder('TowerCabRoof', 7.85, 0.65, (0.0, 0.0, TOWER_CAB_Z + cab_h + 0.35), col, conc, segments=12, radius2=8.15))
    add(C.cylinder('TowerCabCeiling', 7.32, 0.14, (0.0, 0.0, TOWER_CAB_Z + cab_h - 0.05), col, ceil_m, segments=12))
    # Central acoustic ceiling soffit + recessed dimmable downlights
    add(C.cylinder('CeilingSoffit', 4.60, 0.22, (0.0, 0.0, TOWER_CAB_Z + cab_h - 0.20), col, ceil_m, segments=12))
    for k in range(8):
        a = k * math.pi * 0.25
        add(C.cylinder('CeilLight_%d' % k, 0.11, 0.03, (math.cos(a) * 3.2, math.sin(a) * 3.2, TOWER_CAB_Z + cab_h - 0.31), col, downlight_m, segments=14))
    add(C.sphere('TowerRadome', 1.35, (-1.8, 1.4, TOWER_CAB_Z + cab_h + 2.0), col, conc))
    add(C.cylinder('TowerSpire', 0.08, 7.2, (1.1, -0.9, TOWER_CAB_Z + cab_h + 4.2), col, mull, segments=8, radius2=0.025))

    # 12-sided panoramic outward-canted glass, slim steel mullions, low knee wall, overhead valance & roller shades
    N_SIDES = 12
    for k in range(N_SIDES):
        a0 = k * (2.0 * math.pi / N_SIDES) + (math.pi / N_SIDES)
        a1 = (k + 1) * (2.0 * math.pi / N_SIDES) + (math.pi / N_SIDES)
        r_sill = lerp(r_bot, r_top, sill_h / cab_h)
        r_val = lerp(r_bot, r_top, (cab_h - 0.38) / cab_h)
        r_sh = lerp(r_bot, r_top, (cab_h - 0.88) / cab_h)

        p_f0 = Vector((math.cos(a0) * r_bot, math.sin(a0) * r_bot, TOWER_CAB_Z))
        p_f1 = Vector((math.cos(a1) * r_bot, math.sin(a1) * r_bot, TOWER_CAB_Z))
        p_s0 = Vector((math.cos(a0) * r_sill, math.sin(a0) * r_sill, TOWER_CAB_Z + sill_h))
        p_s1 = Vector((math.cos(a1) * r_sill, math.sin(a1) * r_sill, TOWER_CAB_Z + sill_h))
        p_v0 = Vector((math.cos(a0) * r_val, math.sin(a0) * r_val, TOWER_CAB_Z + cab_h - 0.38))
        p_v1 = Vector((math.cos(a1) * r_val, math.sin(a1) * r_val, TOWER_CAB_Z + cab_h - 0.38))
        p_t0 = Vector((math.cos(a0) * r_top, math.sin(a0) * r_top, TOWER_CAB_Z + cab_h))
        p_t1 = Vector((math.cos(a1) * r_top, math.sin(a1) * r_top, TOWER_CAB_Z + cab_h))
        p_sh0 = Vector((math.cos(a0) * (r_sh - 0.08), math.sin(a0) * (r_sh - 0.08), TOWER_CAB_Z + cab_h - 0.88))
        p_sh1 = Vector((math.cos(a1) * (r_sh - 0.08), math.sin(a1) * (r_sh - 0.08), TOWER_CAB_Z + cab_h - 0.88))

        # Slim dark steel canted window mullion & top/bottom horizontal frames
        add(make_bar('CabMullion_%02d' % k, p_f0, p_t0, 0.075, col, mull))
        add(make_bar('CabSillBar_%02d' % k, p_s0, p_s1, 0.08, col, mull))
        add(make_bar('CabValBar_%02d' % k, p_v0, p_v1, 0.08, col, mull))

        def build_quad(bm, va, vb, vc, vd):
            bm.faces.new([bm.verts.new(v) for v in (va, vb, vc, vd)])

        # Low opaque perimeter knee wall below sill
        kw = add(C.mesh_object('CabKneeWall_%02d' % k, lambda bm, a=p_f0, b=p_f1, c=p_s1, d=p_s0: build_quad(bm, a, b, c, d), col))
        C.assign(kw, desk_base)
        # Overhead tilted valance soffit housing speakers/clocks/radio indicators
        vw = add(C.mesh_object('CabValance_%02d' % k, lambda bm, a=p_v0, b=p_v1, c=p_t1, d=p_t0: build_quad(bm, a, b, c, d), col))
        C.assign(vw, ceil_m)
        # Panoramic green-tinted anti-glare window pane
        win = add(C.mesh_object('CabGlass_%02d' % k, lambda bm, a=p_s0, b=p_s1, c=p_v1, d=p_v0: build_quad(bm, a, b, c, d), col))
        C.assign(win, cab_glass)
        disable_shadow_rays(win)
        # Retractable translucent dark roller sunshade pulled 50 cm down from top frame
        sh = add(C.mesh_object('CabShade_%02d' % k, lambda bm, a=p_sh0, b=p_sh1, c=p_v1, d=p_v0: build_quad(bm, a, b, c, d), col))
        C.assign(sh, shade_m)
        disable_shadow_rays(sh)

    # Overhead digital UTC clock bar & mullion-mounted FAA ATC light gun (physically bracketed to mullion)
    clk_box = add(C.box('OverheadClockBox', (0.14, 0.72, 0.16), (6.72, 0.0, TOWER_CAB_Z + cab_h - 0.50), col, mon_shell))
    clk_box.rotation_euler = (0.0, C.deg(20.0), 0.0)
    clk_led = add(C.box('OverheadClockLED', (0.02, 0.62, 0.08), (6.64, 0.0, TOWER_CAB_Z + cab_h - 0.51), col, clock_m))
    clk_led.rotation_euler = (0.0, C.deg(20.0), 0.0)
    # FAA light gun mounted neatly on steel bracket attached directly to the front-right cab mullion
    m_ang_r = -math.pi / N_SIDES
    r_lg = lerp(r_bot, r_top, 2.05 / cab_h)
    mx_lg, my_lg = math.cos(m_ang_r) * r_lg, math.sin(m_ang_r) * r_lg
    add(make_bar('LightGunBracket', (mx_lg, my_lg, TOWER_CAB_Z + 2.05), (mx_lg - 0.22, my_lg + 0.04, TOWER_CAB_Z + 2.05), 0.03, col, mull, radius=0.015))
    lgun = add(C.cylinder('FAALightGun', 0.068, 0.26, (mx_lg - 0.24, my_lg + 0.05, TOWER_CAB_Z + 2.05), col, mull, segments=14, radius2=0.052))
    lgun.rotation_euler = (0.0, C.deg(82.0), C.deg(-12.0))

    # Seamless continuous curved Evans-style perimeter slatwall console (48-segment annular arcs — ZERO seam gaps!)
    def build_arc_strip(bm, r_in, r_out, z0, z1, deg_span=78.0, segs=48):
        verts = []
        for i in range(segs + 1):
            a = C.deg(lerp(-deg_span, deg_span, i / float(segs)))
            ca, sa = math.cos(a), math.sin(a)
            verts.append((
                bm.verts.new((ca * r_in,  sa * r_in,  z0)),
                bm.verts.new((ca * r_out, sa * r_out, z0)),
                bm.verts.new((ca * r_out, sa * r_out, z1)),
                bm.verts.new((ca * r_in,  sa * r_in,  z1)),
            ))
        for i in range(segs):
            a0, a1, a2, a3 = verts[i]
            b0, b1, b2, b3 = verts[i + 1]
            bm.faces.new((a0, b0, b1, a1))
            bm.faces.new((a1, b1, b2, a2))
            bm.faces.new((a2, b2, b3, a3))
            bm.faces.new((a3, b3, b0, a0))
        bm.faces.new((verts[0][0], verts[0][1], verts[0][2], verts[0][3]))
        bm.faces.new((verts[-1][3], verts[-1][2], verts[-1][1], verts[-1][0]))

    add(C.mesh_object('EvansBaseArc', lambda bm: build_arc_strip(bm, 4.72, 5.60, TOWER_CAB_Z, TOWER_CAB_Z + 0.74), col)).data.materials.append(desk_base)
    add(C.mesh_object('EvansTopArc', lambda bm: build_arc_strip(bm, 4.56, 5.62, TOWER_CAB_Z + 0.74, TOWER_CAB_Z + 0.79), col)).data.materials.append(desk_top)
    add(C.mesh_object('EvansSlatArc', lambda bm: build_arc_strip(bm, 5.48, 5.60, TOWER_CAB_Z + 0.79, TOWER_CAB_Z + 1.03), col)).data.materials.append(slatwall)
    for k in range(-4, 5, 2):
        ang = C.deg(k * 14.0)
        led = add(C.box('RackLED_%02d' % (k + 4), (0.015, 0.08, 0.012), (math.cos(ang) * 4.71, math.sin(ang) * 4.71, TOWER_CAB_Z + 0.66), col, led_g))
        led.rotation_euler = (0.0, 0.0, ang)

    # 18 distinct dual-tier mounted FAA ATC monitors tightly arrayed across -52..+52 deg so 15-18 glowing displays
    # are simultaneously visible in the wide Shot 7a frame while center [-14..+14 deg] stays low-profile & open!
    monitor_specs = (
        # Far Left (+42..+52 deg) — 3 monitors (lower + upper)
        ('Mon01_STARS_FL',   51.0, 5.42, 0.44, 0.36, 1.03, 12.0, m_stars),
        ('Mon02_ASDEX_FL',   44.0, 5.42, 0.42, 0.34, 1.02, 12.0, m_asdex),
        ('Mon03_TFDM_FLU',   47.5, 5.48, 0.44, 0.30, 1.38, -4.0, m_tfdm),
        # Center-Left (+21..+38 deg) — 4 monitors (2 lower + 2 upper)
        ('Mon04_STARS_CL',   35.5, 5.40, 0.46, 0.38, 1.04, 12.0, m_stars),
        ('Mon05_TFDM_CL',    26.0, 5.40, 0.46, 0.32, 1.01, 14.0, m_tfdm),
        ('Mon06_IDS4_CLU',   35.5, 5.48, 0.44, 0.30, 1.40, -5.0, m_ids4),
        ('Mon07_VCSS_CLU',   26.0, 5.48, 0.42, 0.28, 1.35, -4.0, m_comms),
        # Center Primary (-16..+17 deg) — 4 low-profile monitors (top <= 1.26 m -> wide open panoramic view!)
        ('Mon08_ASDEX_C',    16.0, 5.38, 0.44, 0.34, 1.00, 14.0, m_asdex),
        ('Mon09_SkySentry',   4.5, 5.34, 0.62, 0.38, 1.02, 13.0, m_sentry),
        ('Mon10_STARS_C',    -7.0, 5.38, 0.46, 0.36, 1.01, 13.0, m_stars),
        ('Mon11_ITWS_C',    -16.5, 5.40, 0.42, 0.30, 1.00, 14.0, m_wx),
        # Center-Right (-24..-40 deg) — 4 monitors (2 lower + 2 upper)
        ('Mon12_TBFM_CR',   -25.5, 5.40, 0.46, 0.32, 1.01, 14.0, m_tbfm),
        ('Mon13_IDS4_CR',   -35.0, 5.40, 0.46, 0.34, 1.02, 12.0, m_ids4),
        ('Mon14_STARS_CRU', -25.5, 5.48, 0.44, 0.32, 1.36, -5.0, m_stars),
        ('Mon15_VCSS_CRU',  -35.0, 5.48, 0.44, 0.30, 1.38, -5.0, m_comms),
        # Far Right (-43..-52 deg) — 3 monitors (lower + upper)
        ('Mon16_ASDEX_FR',  -44.0, 5.42, 0.42, 0.34, 1.02, 12.0, m_asdex),
        ('Mon17_TFDM_FR',   -51.5, 5.42, 0.44, 0.32, 1.01, 12.0, m_tfdm),
        ('Mon18_ITWS_FRU',  -47.5, 5.48, 0.44, 0.30, 1.38, -4.0, m_wx),
    )
    for nm, a_deg, r_m, mw, mh, mz, tilt_deg, smat in monitor_specs:
        ang = C.deg(a_deg)
        m_grp = add(C.empty(nm + '_Grp', (math.cos(ang) * r_m, math.sin(ang) * r_m, TOWER_CAB_Z + mz), col))
        m_grp.rotation_euler = (0.0, C.deg(-tilt_deg), ang)
        bezel = C.box(nm + '_Bezel', (0.032, mw + 0.026, mh + 0.026), (0.0, 0.0, 0.0), col, mon_shell)
        bezel.parent = m_grp
        scr = C.plane(nm + '_Screen', (mw, mh), (-0.018, 0.0, 0.0), col, smat)
        scr.rotation_euler = (math.pi * 0.5, 0.0, -math.pi * 0.5)
        scr.parent = m_grp
        # Articulated VESA mount arm connecting back to the Evans slatwall rail
        arm = C.box(nm + '_VESA', (0.14, 0.045, 0.045), (0.08, 0.0, -0.02), col, vesa_m)
        arm.parent = m_grp
        post = C.cylinder(nm + '_Post', 0.018, max(0.18, mz - 0.78), (0.13, 0.0, -(mz - 0.78) * 0.5), col, vesa_m, segments=8)
        post.parent = m_grp

    # Real-life ATC console props: keyboards, trackballs, gooseneck PTT mics, coffee mugs, desk binoculars
    for idx, a_deg in enumerate((46.0, 29.0, 4.0, -24.0, -48.0)):
        ang = C.deg(a_deg)
        # Keyboard + trackball
        kb = add(C.box('KB_%d' % idx, (0.16, 0.42, 0.022), (math.cos(ang) * 4.86, math.sin(ang) * 4.86, TOWER_CAB_Z + 0.802), col, mon_shell))
        kb.rotation_euler = (0.0, C.deg(-4.0), ang)
        tb = add(C.box('Trackball_%d' % idx, (0.11, 0.08, 0.03), (math.cos(ang - 0.06) * 4.86, math.sin(ang - 0.06) * 4.86, TOWER_CAB_Z + 0.805), col, mon_shell))
        tb.rotation_euler = (0.0, 0.0, ang)
        # Gooseneck desk PTT mic
        m_ang = ang + 0.075
        p0 = (math.cos(m_ang) * 5.05, math.sin(m_ang) * 5.05, TOWER_CAB_Z + 0.79)
        p1 = (math.cos(m_ang) * 4.92, math.sin(m_ang) * 4.92, TOWER_CAB_Z + 1.06)
        add(make_bar('PTTMic_%d' % idx, p0, p1, 0.01, col, mull, radius=0.005))
        add(C.sphere('PTTTip_%d' % idx, 0.014, p1, col, mon_shell))
        # Coffee mugs at active positions
        if idx in (1, 3):
            c_ang = ang - 0.095
            add(C.cylinder('CoffeeMug_%d' % idx, 0.042, 0.10, (math.cos(c_ang) * 4.95, math.sin(c_ang) * 4.95, TOWER_CAB_Z + 0.84),
                           col, mug_b if idx == 1 else mug_w, segments=16))

    # Desk binoculars resting on the front-left console sill
    b_ang = C.deg(18.0)
    for off_y in (-0.035, 0.035):
        bn = add(C.cylinder('DeskBinoc_%d' % int(off_y * 100), 0.028, 0.17,
                            (math.cos(b_ang) * 4.98 - math.sin(b_ang) * off_y,
                             math.sin(b_ang) * 4.98 + math.cos(b_ang) * off_y, TOWER_CAB_Z + 0.82),
                            col, mon_shell, segments=14, radius2=0.020))
        bn.rotation_euler = (0.0, math.pi * 0.5, b_ang)

    # Flashing red Arduino Sky Sentry alert beacon next to the primary Sky Sentry monitor + red point light
    b_pos = (math.cos(C.deg(-2.5)) * 5.02, math.sin(C.deg(-2.5)) * 5.02, TOWER_CAB_Z + 0.815)
    add(C.cylinder('BeaconBase', 0.055, 0.05, b_pos, col, mon_shell, segments=16))
    b_mat = C.emission_material('TowerBeaconDome', color=(1.0, 0.08, 0.04, 1.0), strength=0.0)
    b_em = b_mat.node_tree.nodes[b_mat['emission_node']]
    add(C.sphere('BeaconDome', 0.048, (b_pos[0], b_pos[1], b_pos[2] + 0.04), col, b_mat))

    ld_red = bpy.data.lights.new('TowerAlertRed', 'POINT')
    ld_red.energy = 0.0
    ld_red.shadow_soft_size = 0.18
    ld_red.color = (1.0, 0.10, 0.05)
    red_l = add(C.link(bpy.data.objects.new('TowerAlertRed', ld_red), col))
    red_l.location = (b_pos[0] - 0.45, b_pos[1], TOWER_CAB_Z + 1.32)

    f_a0, f_a1 = tl.frame(0.640), tl.frame(0.806)
    for f in tl.sample_frames(f_a0, f_a1, target_samples=48):
        u = tl.u(f)
        if u < 0.655 or u > 0.800:
            val_e, val_l = 0.2, 0.0
        else:
            on = 1.0 if math.sin(u * DEFAULT_DURATION_S * 20.0) > -0.25 else 0.15
            val_e, val_l = 75.0 * on, 130.0 * on
        C.key_socket(b_em.inputs['Strength'], f, val_e)
        ld_red.energy = val_l
        ld_red.keyframe_insert('energy', frame=f)

    # Soft cool screen bounce + dimmable warm cab ceiling fill so monitors pop without crushing human detail
    ld_mon = bpy.data.lights.new('TowerMonitorGlow', 'AREA')
    ld_mon.energy = 65.0
    ld_mon.size = 3.2
    ld_mon.color = (0.58, 0.78, 1.0)
    m_lt = add(C.link(bpy.data.objects.new('TowerMonitorGlow', ld_mon), col))
    m_lt.location = (4.5, 0.0, TOWER_CAB_Z + 1.25)
    m_lt.rotation_euler = (0.0, C.deg(78.0), 0.0)

    ld_ceil = bpy.data.lights.new('TowerCeilWarm', 'AREA')
    ld_ceil.energy = 45.0
    ld_ceil.size = 2.4
    ld_ceil.color = (1.0, 0.86, 0.70)
    add(C.link(bpy.data.objects.new('TowerCeilWarm', ld_ceil), col)).location = (1.6, 0.0, TOWER_CAB_Z + cab_h - 0.45)

    # 3 articulated realistic human FAA ATC controllers inside the cab!
    # 1) Seated Local Controller (center-left): dark navy quarter-zip, headset, hand raised to PTT mic
    c1 = build_human_controller(
        col, root, 'CONTROLLER_1', (4.05, 1.05, TOWER_CAB_Z), 12.0, standing=False,
        shirt_rgb=(0.08, 0.13, 0.22), pants_rgb=(0.06, 0.07, 0.09),
        skin_rgb=(0.66, 0.48, 0.37), hair_rgb=(0.14, 0.10, 0.07), hand_to_mic=True,
    )
    # 2) Standing Tower Supervisor (center-right): dark charcoal wool pullover/vest, braced on console watching final approach
    c2 = build_human_controller(
        col, root, 'CONTROLLER_2', (3.95, -1.25, TOWER_CAB_Z), -14.0, standing=True,
        shirt_rgb=(0.11, 0.13, 0.16), pants_rgb=(0.06, 0.07, 0.08),
        skin_rgb=(0.46, 0.32, 0.23), hair_rgb=(0.08, 0.07, 0.06), holding_binocs=True,
    )
    # 3) Seated Ground/Clearance Controller (left): dark slate sweater, headset, working STARS/TFDM
    build_human_controller(
        col, root, 'CONTROLLER_3', (3.45, 2.35, TOWER_CAB_Z), 34.0, standing=False,
        shirt_rgb=(0.13, 0.15, 0.18), pants_rgb=(0.07, 0.08, 0.10),
        skin_rgb=(0.74, 0.57, 0.46), hair_rgb=(0.30, 0.22, 0.15),
    )

    # Subtle lifelike body turn by Local Controller toward Sky Sentry alert & then out at 747SP
    C.key(c1, tl.frame(0.640), rot=(0.0, 0.0, 14.0))
    C.key(c1, tl.frame(0.680), rot=(0.0, 0.0, 4.0))
    C.key(c1, tl.frame(0.770), rot=(0.0, 0.0, -4.0))
    C.ease(c1)
    # Supervisor leans subtly toward approaching aircraft
    C.key(c2, tl.frame(0.640), rot=(0.0, 0.0, -16.0))
    C.key(c2, tl.frame(0.780), rot=(0.0, 0.0, -8.0))
    C.ease(c2)

    return root


# ------------------------------------------------------------------------------------------------ camera choreography
def build_camera_rig(scene, col, tower_root, args, tl):
    """One dual-camera rig (desktop 16:9 + portrait 9:16) choreographed across all 8 shots,
    with hold_cut on every hard cut so 180-deg shutter motion blur never smears across cuts."""
    rig = C.CameraRig('CAM', lens=28.0, portrait_lens=20.0, clip_end=45000.0, col=col)
    tower_mw = Matrix.Translation(tower_root.location) @ tower_root.rotation_euler.to_matrix().to_4x4()

    def twr_world(x, y, z):
        return tower_mw @ Vector((x, y, z))

    def cockpit_cam_pair(f, eye_local, look_local):
        m = airliner_matrix(airliner_state(tl.u(f), tl.seconds(f)))
        origin = Vector((24.0, 0.0, 6.8))
        return m @ (origin + Vector(eye_local)), m @ (origin + Vector(look_local))

    # --- Shots 1, 2, 3a (u 0.000..0.300): Cockpit POV locked to airliner ---
    f_wcut = tl.frame(0.208)
    f_ck1_end = tl.frame(0.300)
    ck1_frames = sorted(set(
        tl.sample_frames(1, f_wcut, target_samples=60)
        + tl.sample_frames(f_wcut + 1, f_ck1_end, target_samples=36)
        + [tl.frame(0.110), tl.frame(0.235), f_wcut, f_wcut + 1, f_ck1_end]
    ))
    for f in ck1_frames:
        u = tl.u(f)
        push = smoothstep(0.0, 0.110, u) * 0.14
        eye = (-0.78 + push, 0.0, 0.12)
        look_z = lerp(-0.18, -0.35, smoothstep(0.110, 0.300, u))
        loc, look = cockpit_cam_pair(f, eye, (6.0, math.sin(u * 14.0) * 0.12, look_z))
        rig.key(f, loc=loc, look=look)
    rig.lens_key(1, 26.0)
    rig.lens_key(f_ck1_end, 28.0)

    # --- Shot 3b (u 0.300..0.360): Wide exterior breakout over snowy airport ---
    f3_0, f3_1 = f_ck1_end + 1, tl.frame(0.360)
    for f in (f3_0, (f3_0 + f3_1) // 2, f3_1):
        t = (f - f3_0) / max(1.0, float(f3_1 - f3_0))
        pp = airliner_state(tl.u(f), tl.seconds(f))['pos']
        loc = Vector((pp.x + lerp(-75.0, 55.0, t), -185.0, pp.z - 8.0))
        look = Vector((pp.x + 32.0, 4.0, pp.z - 4.0))
        rig.key(f, loc=loc, look=look)
    rig.lens_key(f3_0, 35.0)
    rig.lens_key(f3_1, 35.0)

    # --- Shot 4 (u 0.360..0.450): Intimate photoreal chase cam orbiting the 747SP ---
    # Matches airliner velocity smoothly at 62..66 m off sunlit port-forward quarter so full nose-to-tail
    # 747SP, panel gaps, rivets, navy Skyline livery & dark-tinted reflective windows stay razor-sharp!
    f4_0, f4_1 = f3_1 + 1, tl.frame(0.450)
    for f in tl.sample_frames(f4_0, f4_1, target_samples=20):
        t = (f - f4_0) / max(1.0, float(f4_1 - f4_0))
        pp = airliner_state(tl.u(f), tl.seconds(f))['pos']
        ang = lerp(0.76, 1.34, t)
        loc = Vector((pp.x + math.cos(ang) * 62.0, math.sin(ang) * 64.0, pp.z + lerp(11.5, 8.0, t)))
        look = Vector((pp.x + 1.0, 0.0, pp.z + 5.2))
        rig.key(f, loc=loc, look=look)
    rig.lens_key(f4_0, 35.0)
    rig.lens_key(f4_1, 34.0)

    # --- Shot 5a (u 0.450..0.500): Close aerial shot of 60 anatomically realistic Canada geese ---
    # Tracks 14..20 m alongside the leading V-skein with approaching 747SP landing lights in background!
    f5a_0, f5a_1 = f4_1 + 1, tl.frame(0.500)
    for f in (f5a_0, (f5a_0 + f5a_1) // 2, f5a_1):
        t = (f - f5a_0) / max(1.0, float(f5a_1 - f5a_0))
        fl = flock_center(tl.u(f))
        loc = Vector((fl.x + lerp(18.0, 12.0, t), fl.y + lerp(-14.0, -7.0, t), fl.z + lerp(-1.5, 1.5, t)))
        look = Vector((fl.x - 10.0, fl.y + 4.0, fl.z + 1.0))
        rig.key(f, loc=loc, look=look)
    rig.lens_key(f5a_0, 46.0)
    rig.lens_key(f5a_1, 44.0)

    # --- Shot 5b (u 0.500..0.530): Hovering quadcopter drone near perimeter fence ---
    f5b_0, f5b_1 = f5a_1 + 1, tl.frame(0.530)
    for f in (f5b_0, (f5b_0 + f5b_1) // 2, f5b_1):
        t = (f - f5b_0) / max(1.0, float(f5b_1 - f5b_0))
        t_s = tl.u(f) * DEFAULT_DURATION_S
        ang = lerp(0.75, 1.35, t)
        d_loc = Vector((
            DRONE_POS.x + math.sin(t_s * 1.1) * 1.4,
            DRONE_POS.y + math.cos(t_s * 0.9) * 1.1,
            DRONE_POS.z + math.sin(t_s * 2.3) * 0.45,
        ))
        loc = d_loc + Vector((math.cos(ang) * 2.1, math.sin(ang) * 2.1, 0.28))
        rig.key(f, loc=loc, look=d_loc)
    rig.lens_key(f5b_0, 45.0)
    rig.lens_key(f5b_1, 45.0)

    # --- Shot 6 (u 0.530..0.640): Sky Sentry camera POV framing the flock & approaching 747SP ---
    f6_0, f6_1 = f5b_1 + 1, tl.frame(0.640)
    for f in (f6_0, (f6_0 + f6_1) // 2, f6_1):
        u = tl.u(f)
        fl = flock_center(u)
        pp = airliner_state(u, tl.seconds(f))['pos']
        look = lerp_vec(fl, pp, 0.22)
        rig.key(f, loc=SENTRY_POS, look=look)
    rig.lens_key(f6_0, 40.0)
    rig.lens_key(f6_1, 48.0)

    # --- Shot 7 (u 0.640..0.800): Real-life FAA ATC cab looking OUT at runway, 60 geese & 747SP ---
    # 18mm architectural wide start shows 16+ dual-tier glowing FAA monitors, all 3 controllers,
    # canted green-tinted windows, snowy runway, crossing 60 Canada geese, and approaching 747SP!
    f7_0, f7_1 = f6_1 + 1, tl.frame(0.800)
    f7_m1 = tl.frame(0.715)
    f7_m2 = tl.frame(0.765)
    twr_keys = (
        (f7_0,  twr_world(-0.55, -0.05, TOWER_CAB_Z + 1.98), twr_world(6.2, 0.15, TOWER_CAB_Z + 1.48), 18.0),
        (f7_m1, twr_world(1.45, -0.05, TOWER_CAB_Z + 1.88), twr_world(6.5, 0.10, TOWER_CAB_Z + 1.54), 22.0),
        (f7_m2, twr_world(2.85, -0.05, TOWER_CAB_Z + 1.80), lerp_vec(flock_center(0.765), airliner_state(0.765)['pos'], 0.45), 29.0),
        (f7_1,  twr_world(3.25, -0.05, TOWER_CAB_Z + 1.76), lerp_vec(flock_center(0.800), airliner_state(0.800)['pos'], 0.55), 34.0),
    )
    for f, loc, look, ln in twr_keys:
        rig.key(f, loc=loc, look=look)
        rig.lens_key(f, ln)

    # --- Shot 8a (u 0.800..0.880): Low exterior go-around climbing over flock with jet-blast shake ---
    f8a_0, f8a_1 = f7_1 + 1, tl.frame(0.880)
    ga_cam = Vector((-120.0, -72.0, 26.0))
    for f in tl.sample_frames(f8a_0, f8a_1, target_samples=16):
        u = tl.u(f)
        pp = airliner_state(u, tl.seconds(f))['pos']
        fl = flock_center(u)
        rig.key(f, loc=ga_cam, look=lerp_vec(pp, fl, 0.18))
    rig.lens_key(f8a_0, 32.0)
    rig.lens_key(f8a_1, 28.0)

    # --- Shot 8b (u 0.880..1.000): Cockpit climb back into clouds & fade to white ---
    f8b_0, f8b_1 = f8a_1 + 1, tl.total
    for f in tl.sample_frames(f8b_0, f8b_1, target_samples=32):
        loc, look = cockpit_cam_pair(f, (-0.72, 0.0, 0.11), (6.0, 0.0, 0.25))
        rig.key(f, loc=loc, look=look)
    rig.lens_key(f8b_0, 26.0)
    rig.lens_key(f8b_1, 24.0)

    # LINEAR interpolation prevents spline overshoot across distant shot cuts
    C.interpolation(rig.rig, 'LINEAR')
    C.interpolation(rig.look, 'LINEAR')
    for cam in rig.cams.values():
        C.interpolation(cam.data, 'LINEAR')

    # Hold cuts on every hard edit so 180-deg shutter motion blur never smears across cuts
    for f_cut in tl.cut_frames():
        C.hold_cut(rig.rig, f_cut, ('location',))
        C.hold_cut(rig.look, f_cut, ('location',))
        for cam in rig.cams.values():
            C.hold_cut(cam.data, f_cut, ('lens',))

    # FPS-scaled turbulence & jet-blast camera shake
    fps_k = tl.fps / 24.0
    for cam in rig.cams.values():
        C.add_noise(cam, 'rotation_euler', strength=0.008, scale=3.0 * fps_k,
                    frame_range=(tl.frame(0.132), tl.frame(0.232)))
        C.add_noise(cam, 'rotation_euler', strength=0.028, scale=1.8 * fps_k,
                    frame_range=(f8a_0, f8a_1))
        C.add_noise(cam, 'rotation_euler', strength=0.010, scale=2.6 * fps_k,
                    frame_range=(f8b_0, tl.frame(0.985)))

    # Deep cinema DOF (keep both ATC foreground monitors/controllers AND distant 747SP/geese crisp in Shot 7!)
    dof_keys = (
        (1, 1.5, 4.0), (f_ck1_end, 1.5, 4.0),
        (f3_0, 240.0, 8.0), (f3_1, 240.0, 8.0),
        (f4_0, 46.0, 6.4), (f4_1, 46.0, 6.4),
        (f5a_0, 18.0, 5.6), (f5a_1, 18.0, 5.6),
        (f5b_0, 2.2, 2.8), (f5b_1, 2.2, 2.8),
        (f6_0, 190.0, 8.0), (f6_1, 190.0, 8.0),
        (f7_0, 5.5, 8.0), (f7_m1, 5.0, 8.0), (f7_m2, 12.0, 11.0), (f7_1, 45.0, 11.0),
        (f8a_0, 110.0, 6.4), (f8a_1, 110.0, 6.4),
        (f8b_0, 1.5, 4.0), (f8b_1, 1.5, 4.0),
    )
    for cam in rig.cams.values():
        d = cam.data.dof
        d.use_dof = True
        d.aperture_blades = 7
        for f, dist, fst in dof_keys:
            d.focus_distance = dist
            d.aperture_fstop = fst
            d.keyframe_insert('focus_distance', frame=f)
            d.keyframe_insert('aperture_fstop', frame=f)
        C.interpolation(cam.data, 'LINEAR', 'dof.focus_distance')
        C.interpolation(cam.data, 'LINEAR', 'dof.aperture_fstop')

    C.use_camera(scene, rig, args.res)
    return rig


# ------------------------------------------------------------------------------------------------ compositor
def build_compositor(scene, tl):
    """Cinema fog-glow halation on runway/aircraft/tower lights, Shot 2 brief whiteout,
    and Shot 8 smooth fade to white."""
    try:
        scene.use_nodes = True
        nt = scene.node_tree
        if nt is None:
            return
    except AttributeError:
        C.warn('compositor node tree unavailable in this Blender version')
        return

    rl = next((n for n in nt.nodes if n.type == 'R_LAYERS'), None)
    comp = next((n for n in nt.nodes if n.type == 'COMPOSITE'), None)
    if rl is None or comp is None:
        return

    glare = nt.nodes.new('CompositorNodeGlare')
    glare.glare_type = 'FOG_GLOW'
    glare.quality = 'HIGH'
    if 'Threshold' in glare.inputs:
        # Blender 4.4+ / 4.5 LTS socket-based Glare parameters
        glare.inputs['Threshold'].default_value = 1.6
        if 'Size' in glare.inputs:
            glare.inputs['Size'].default_value = 0.75
        if 'Strength' in glare.inputs:
            glare.inputs['Strength'].default_value = 0.24
    else:
        glare.threshold = 1.6
        glare.size = 7
        glare.mix = -0.78
    nt.links.new(rl.outputs['Image'], glare.inputs['Image'])

    mix_w = nt.nodes.new('CompositorNodeMixRGB')
    mix_w.blend_type = 'MIX'
    mix_w.inputs[2].default_value = (1.0, 1.0, 1.0, 1.0)
    nt.links.new(glare.outputs['Image'], mix_w.inputs[1])
    nt.links.new(mix_w.outputs['Image'], comp.inputs['Image'])

    white_keys = (
        (0.000, 0.0),
        (0.184, 0.0),
        (0.200, 0.88),
        (0.208, 0.96),
        (0.217, 0.78),
        (0.233, 0.0),
        (0.935, 0.0),
        (0.962, 0.45),
        (0.990, 1.0),
        (1.000, 1.0),
    )
    for u, v in white_keys:
        C.key_socket(mix_w.inputs[0], tl.frame(u), v)
    C.ease(nt)


# ------------------------------------------------------------------------------------------------ main
def resolve_timeline(args):
    """Determine (Timeline, render_f0, render_f1) from --fps, --duration, --total-frames, --frames, and --shot."""
    fps = max(1, int(args.fps))
    dur = DEFAULT_DURATION_S if args.duration is None else max(0.25, float(args.duration))
    if args.total_frames is not None:
        total = max(24, int(args.total_frames))
    else:
        total = max(24, int(round(dur * fps)))
        # If the user explicitly asked for a frame beyond the default duration (e.g. --frames 1-2000 at 24 fps),
        # scale the timeline to fit rather than clipping their requested range.
        if args.frames != '1-480' and args.f1 > total:
            total = args.f1

    tl = Timeline(total, fps)
    if args.shot is not None:
        f0, f1 = tl.shot_range(args.shot)
    elif args.frames == '1-480' and args.total_frames is None and (args.duration is not None or fps != C.FPS):
        f0, f1 = 1, tl.total
    else:
        f0, f1 = max(1, args.f0), min(tl.total, args.f1)
    return tl, f0, f1


def main():
    args = C.parse_args(
        'Sky Sentry 8-shot film: cockpit cruise, cloud descent, snowy airport breakout, chase cam, '
        'flock & drone, Sky Sentry POV, control tower, go-around fade to white.',
        {'out': 'renders/sky', 'frames': '1-480', 'samples': 512, 'min_samples': 64},
        extra_args,
    )
    tl, f0, f1 = resolve_timeline(args)
    args.f0, args.f1 = f0, f1

    scene = C.reset_scene()
    use_caustics = not args.no_caustics
    C.setup_render(scene, args, caustics=use_caustics, volumes=not args.no_clouds)

    # Apply configured FPS (24/60/120/240), UHD resolution tier (1080p/4K/8K), and deep Cycles light paths
    scene.render.fps = tl.fps
    scene.render.fps_base = 1.0
    w, h = UHD_RES[args.uhd][args.res]
    scene.render.resolution_x, scene.render.resolution_y = w, h
    scene.render.resolution_percentage = 50 if args.preview else 100
    scene.cycles.diffuse_bounces = 6
    if not args.no_clouds:
        C.try_set(scene.cycles, 'volume_bounces', 2)
        C.try_set(scene.cycles, 'volume_step_rate', 2.5 if args.preview else 1.5)
        C.try_set(scene.cycles, 'volume_max_steps', 512)

    print('[film-kit] Sky Sentry timeline: %d frames @ %d fps (%.2f s), %dx%d (%s %s), rendering %d-%d'
          % (tl.total, tl.fps, tl.duration, w, h, args.uhd, args.res, args.f0, args.f1))

    repo = C.repo_root()
    tex_dir = ensure_textures(args.designation)

    col_env = C.collection('Environment')
    col_apt = C.collection('Airport')
    col_air = C.collection('Airliner')
    col_ck = C.collection('Cockpit')
    col_haz = C.collection('Hazards')
    col_twr = C.collection('ControlTower')
    col_cam = C.collection('Cameras')

    build_world_and_sun(scene, col_env, tl, use_caustics=use_caustics)
    build_airport(col_apt, tex_dir, repo, tl, use_caustics=use_caustics)
    airliner = build_airliner(col_air, repo, tex_dir, args, tl, use_caustics=use_caustics)
    build_cockpit(col_ck, airliner, tex_dir, tl)
    build_clouds(col_env, airliner, tl, skip_clouds=args.no_clouds)
    build_flock(col_haz, tex_dir, tl, count=args.flock_count, seed=args.seed)
    build_drone(col_haz, tl)
    build_sentry_tripod(col_haz, tl)
    tower = build_control_tower(col_twr, tex_dir, tl)
    build_camera_rig(scene, col_cam, tower, args, tl)
    build_compositor(scene, tl)

    C.finish(scene, args)


if __name__ == '__main__':
    main()
