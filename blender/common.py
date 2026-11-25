"""Shared helpers for the Blender film kit (Blender 4.x, Cycles).

Imported by build_pool.py, build_sky.py and build_echo_descent.py. Nothing here renders on import.

What lives here
  * CLI parsing for arguments after `--` (same flags for every film, including --fps, --res up to 8K,
    and --preset preview|standard|4k|8k240)
  * Render settings: Cycles on the GPU (OptiX / CUDA / HIP / Metal / oneAPI), adaptive sampling,
    full multi-bounce GI, MNEE/light-path caustics, OpenImageDenoise (GPU), AgX "Medium High Contrast",
    physical 180-degree centered motion blur, 24-240 fps, PNG sequence output
  * Camera rigs: one animated rig (an empty aimed with Track To at a LOOK empty) carrying a
    16:9 desktop camera and a 9:16 portrait camera (automatically selected for desktop/4k/8k and
    portrait/4k-portrait/8k-portrait), plus a depth-of-field helper
  * Time-normalization helper (`frame_at`) so animations scale cleanly from 144/240 frames @ 24 fps
    up to 1200-2000+ frames @ 240 fps
  * Nishita sky world (with optional stars), materials that work with Blender 4.x and 3.x socket names,
    bmesh primitives, keyframe helpers (cut-safe holds for motion blur), noise shake, caustics flags.

All API calls that changed between Blender versions go through try/except helpers (set_input, try_set,
iter_fcurves), so a missing property prints a warning instead of stopping a long build.
"""
import argparse
import math
import os
import sys

import bpy
import bmesh
from mathutils import Euler, Matrix, Vector

FPS = 24
RES = {
    'desktop': (1920, 1080),
    'portrait': (1080, 1920),
    '4k': (3840, 2160),
    '4k-portrait': (2160, 3840),
    '8k': (7680, 4320),
    '8k-portrait': (4320, 7680),
}
PRESETS = ('preview', 'standard', '100fps', '4k', '8k240')


def res_aspect_key(which):
    """Map any RES key to its camera orientation ('desktop' or 'portrait')."""
    return 'portrait' if 'portrait' in str(which) else 'desktop'


def upgrade_res_tier(which, tier):
    """Upgrade desktop/portrait to 4k/4k-portrait or 8k/8k-portrait, preserving orientation."""
    is_port = 'portrait' in str(which)
    if tier == '4k':
        return '4k-portrait' if is_port else '4k'
    if tier == '8k':
        return '8k-portrait' if is_port else '8k'
    return 'portrait' if is_port else 'desktop'


def frame_at(t, f0, f1):
    """Map normalized clip progress t in [0, 1] to an integer frame in [f0, f1]."""
    t = 0.0 if t < 0.0 else (1.0 if t > 1.0 else float(t))
    return int(round(f0 + t * (f1 - f0)))


def fps_scale(args, base_fps=FPS):
    """Scale factor relative to 24 fps for time-based rates (noise scale, particle lifetimes, etc.)."""
    return max(0.05, float(getattr(args, 'fps', base_fps)) / float(base_fps))


# --------------------------------------------------------------------------------------------------
# CLI
# --------------------------------------------------------------------------------------------------
def _flag_given(argv, flag):
    return any(tok == flag or tok.startswith(flag + '=') for tok in argv)


def parse_args(description, defaults=None, extra=None):
    """Parse the arguments Blender passes after `--`.

    defaults: dict overriding the shared defaults for one film (e.g. {'samples': 1024, 'frames': '1-240'}).
    extra: function(parser) that adds film-specific flags.
    """
    d = {
        'out': 'renders/film',
        'res': 'desktop',
        'frames': '1-240',
        'fps': FPS,
        'samples': 768,
        'min_samples': 64,
        'threshold': 0.01,
        'shutter': 0.5,
        'device': 'auto',
    }
    d.update(defaults or {})
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    p = argparse.ArgumentParser(prog='blender -b -P <script> --', description=description)
    p.add_argument('--out', default=d['out'], help='output folder; frames go to <out>/<res>/f_####.png')
    p.add_argument('--res', choices=list(RES.keys()), default=d['res'],
                   help='desktop/portrait (1080p), 4k/4k-portrait (2160p), or 8k/8k-portrait (4320p)')
    p.add_argument('--frames', default=d['frames'], help='frame range, e.g. 1-240, 1-1200, or 1-2000')
    p.add_argument('--fps', type=int, default=d['fps'],
                   help='frame rate (24, 60, 120, 240; default: %d)' % d['fps'])
    p.add_argument('--preset', choices=list(PRESETS), default=None,
                   help='quality/speed preset: preview | standard | 100fps | 4k | 8k240')
    p.add_argument('--samples', type=int, default=d['samples'], help='max samples per pixel (adaptive)')
    p.add_argument('--min-samples', type=int, default=d['min_samples'], help='adaptive minimum samples')
    p.add_argument('--threshold', type=float, default=d['threshold'], help='adaptive noise threshold')
    p.add_argument('--shutter', type=float, default=d['shutter'],
                   help='motion blur shutter in frames (0.5 = physical 180-deg shutter)')
    p.add_argument('--device', default=d['device'], help='auto | OPTIX | CUDA | HIP | METAL | ONEAPI | CPU')
    p.add_argument('--preview', action='store_true', help='fast look: 50%% resolution, 64 samples, every 4th frame')
    p.add_argument('--png16', action='store_true', help='16-bit PNG (bigger files, smoother gradients)')
    p.add_argument('--no-render', action='store_true', help='build the scene only (use with --save)')
    p.add_argument('--save', default='', help='save the built scene to this .blend path')
    p.add_argument('--seed', type=int, default=7)
    if extra:
        extra(p)
    args = p.parse_args(argv)

    # Apply preset defaults without overriding flags explicitly supplied on the command line.
    if args.preset == 'preview':
        args.preview = True
    elif args.preset == '100fps':
        if not _flag_given(argv, '--fps'):
            args.fps = 100
        if not _flag_given(argv, '--frames'):
            base_a, _, base_b = str(d['frames']).partition('-')
            base_count = max(1, int(base_b or base_a) - int(base_a) + 1)
            scaled = max(1, int(round(base_count * (args.fps / float(FPS)))))
            args.frames = '1-%d' % scaled
    elif args.preset == '4k':
        if not _flag_given(argv, '--res') or args.res in ('desktop', 'portrait'):
            args.res = upgrade_res_tier(args.res, '4k')
        if not _flag_given(argv, '--samples'):
            args.samples = max(args.samples, 1024)
        if not _flag_given(argv, '--min-samples'):
            args.min_samples = max(args.min_samples, 96)
        if not _flag_given(argv, '--threshold'):
            args.threshold = min(args.threshold, 0.008)
    elif args.preset == '8k240':
        if not _flag_given(argv, '--res') or args.res in ('desktop', 'portrait'):
            args.res = upgrade_res_tier(args.res, '8k')
        if not _flag_given(argv, '--fps'):
            args.fps = 240
        if not _flag_given(argv, '--frames'):
            base_a, _, base_b = str(d['frames']).partition('-')
            base_count = max(1, int(base_b or base_a) - int(base_a) + 1)
            scaled = max(1200, min(2000, int(round(base_count * (args.fps / float(FPS))))))
            args.frames = '1-%d' % scaled
        if not _flag_given(argv, '--samples'):
            args.samples = max(args.samples, 1024)
        if not _flag_given(argv, '--min-samples'):
            args.min_samples = max(args.min_samples, 128)
        if not _flag_given(argv, '--threshold'):
            args.threshold = min(args.threshold, 0.008)

    args.fps = max(1, int(args.fps))
    a, _, b = args.frames.partition('-')
    args.f0, args.f1 = int(a), int(b or a)
    args.out = os.path.abspath(args.out)
    return args


# --------------------------------------------------------------------------------------------------
# small utilities
# --------------------------------------------------------------------------------------------------
def warn(msg):
    print('[film-kit] WARNING: ' + msg)


def try_set(obj, attr, value):
    """Set obj.attr (or obj.cycles.attr) if it exists in this Blender version. Returns True on success."""
    for target in (obj, getattr(obj, 'cycles', None)):
        if target is not None and hasattr(target, attr):
            try:
                setattr(target, attr, value)
                return True
            except (TypeError, AttributeError, ValueError) as e:
                warn('%s.%s: %s' % (getattr(obj, 'name', obj), attr, e))
                return False
    warn('no property %s on %s (Blender version?)' % (attr, getattr(obj, 'name', obj)))
    return False


def reset_scene():
    """Start from an empty file so the script is repeatable."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.name = 'Film'
    return scene


def collection(name, parent=None):
    col = bpy.data.collections.get(name) or bpy.data.collections.new(name)
    parent = parent or bpy.context.scene.collection
    if col.name not in parent.children:
        parent.children.link(col)
    return col


def link(obj, col=None):
    (col or bpy.context.scene.collection).objects.link(obj)
    return obj


def deg(v):
    return math.radians(v)


# --------------------------------------------------------------------------------------------------
# render settings
# --------------------------------------------------------------------------------------------------
def enable_gpu(scene, device='auto'):
    """Turn on every GPU of the best available backend. Falls back to CPU with a warning."""
    scene.render.engine = 'CYCLES'
    if device.upper() == 'CPU':
        scene.cycles.device = 'CPU'
        return 'CPU'
    try:
        prefs = bpy.context.preferences.addons['cycles'].preferences
    except KeyError:
        warn('Cycles add-on preferences not found; rendering on CPU')
        scene.cycles.device = 'CPU'
        return 'CPU'
    order = [device.upper()] if device != 'auto' else ['OPTIX', 'CUDA', 'HIP', 'METAL', 'ONEAPI']
    for backend in order:
        try:
            prefs.compute_device_type = backend
        except TypeError:
            continue  # backend not compiled into this build
        try:
            prefs.refresh_devices()
        except AttributeError:
            prefs.get_devices()
        gpus = [d for d in prefs.devices if d.type == backend]
        if gpus:
            for d in prefs.devices:
                d.use = d.type == backend  # GPUs only; CPU+GPU hybrid usually slows OptiX down
            scene.cycles.device = 'GPU'
            print('[film-kit] rendering on %s: %s' % (backend, ', '.join(d.name for d in gpus)))
            return backend
    warn('no GPU found for %s; rendering on CPU (slow)' % order)
    scene.cycles.device = 'CPU'
    return 'CPU'


def setup_render(scene, args, caustics=False, volumes=True, film_transparent=False):
    """Cycles settings shared by every film (see plan.md section 7)."""
    enable_gpu(scene, args.device)
    c = scene.cycles
    preview = getattr(args, 'preview', False)
    c.samples = 64 if preview else args.samples
    c.use_adaptive_sampling = True
    c.adaptive_threshold = 0.03 if preview else args.threshold
    c.adaptive_min_samples = 16 if preview else args.min_samples
    c.use_denoising = True
    try_set(c, 'denoiser', 'OPENIMAGEDENOISE')
    try_set(c, 'denoising_input_passes', 'RGB_ALBEDO_NORMAL')
    try_set(c, 'denoising_prefilter', 'ACCURATE')
    if hasattr(c, 'denoising_use_gpu'):
        c.denoising_use_gpu = True  # Blender 4.1+: OIDN on the GPU
    # light paths: full multi-bounce GI, realistic water/glass/ice refraction & caustics
    c.max_bounces = 24 if caustics else 16
    c.diffuse_bounces = 8
    c.glossy_bounces = 12
    c.transmission_bounces = 24
    c.volume_bounces = 4 if volumes else 0
    c.transparent_max_bounces = 32
    c.caustics_reflective = caustics
    c.caustics_refractive = caustics
    c.blur_glossy = 0.25 if caustics else 0.75
    try_set(c, 'sample_clamp_direct', 0.0)
    c.sample_clamp_indirect = 20.0 if caustics else 10.0
    try_set(c, 'use_light_tree', True)
    try_set(c, 'volume_step_rate', 0.65 if volumes else 1.0)
    try_set(c, 'volume_max_steps', 2048)
    c.seed = args.seed
    c.use_animated_seed = True  # different noise pattern per frame: denoised frames blend better in motion
    r = scene.render
    r.use_persistent_data = True  # keep BVH/textures between frames of an animation
    r.fps = int(getattr(args, 'fps', FPS))
    r.fps_base = 1.0
    r.use_motion_blur = True
    r.motion_blur_shutter = float(getattr(args, 'shutter', 0.5))
    try_set(r, 'motion_blur_position', 'CENTER')
    r.film_transparent = film_transparent
    set_resolution(scene, args.res, 50 if preview else 100)
    # colour: AgX, Medium High Contrast look
    vs = scene.view_settings
    try:
        vs.view_transform = 'AgX'
    except TypeError:
        warn('AgX not available (Blender < 4.0?); using Filmic')
        vs.view_transform = 'Filmic'
    for look in ('AgX - Medium High Contrast', 'Medium High Contrast'):
        try:
            vs.look = look
            break
        except TypeError:
            continue
    vs.exposure = 0.0
    vs.gamma = 1.0
    scene.display_settings.display_device = 'sRGB'
    # output: numbered PNG sequence
    im = r.image_settings
    im.file_format = 'PNG'
    im.color_mode = 'RGB'
    im.color_depth = '16' if getattr(args, 'png16', False) else '8'
    im.compression = 15
    r.use_file_extension = True
    r.use_overwrite = False    # resume a crashed render without redoing frames
    r.use_placeholder = True   # lets two machines share one frame range
    r.filepath = os.path.join(args.out, args.res, 'f_')
    scene.frame_start, scene.frame_end = args.f0, args.f1
    scene.frame_step = 4 if preview else 1
    return scene


def set_resolution(scene, which, percent=100):
    w, h = RES[which]
    scene.render.resolution_x, scene.render.resolution_y = w, h
    scene.render.resolution_percentage = percent
    scene.render.pixel_aspect_x = scene.render.pixel_aspect_y = 1.0


# --------------------------------------------------------------------------------------------------
# cameras
# --------------------------------------------------------------------------------------------------
class CameraRig:
    """An empty you animate (location), aimed at a LOOK empty (animate its location too).

    Carries two cameras with identical transforms: desktop (16:9) and portrait (9:16). The portrait camera
    gets a shorter lens so it keeps roughly the same horizontal subject size on a phone.
    """

    def __init__(self, name, lens=35.0, portrait_lens=None, clip_end=5000.0, col=None):
        self.rig = link(bpy.data.objects.new(name, None), col)
        self.rig.empty_display_type = 'ARROWS'
        self.look = link(bpy.data.objects.new(name + '_LOOK', None), col)
        self.look.empty_display_type = 'SPHERE'
        self.look.empty_display_size = 0.3
        tr = self.rig.constraints.new('TRACK_TO')
        tr.target = self.look
        tr.track_axis = 'TRACK_NEGATIVE_Z'
        tr.up_axis = 'UP_Y'
        self.cams = {}
        for which, L in (('desktop', lens), ('portrait', portrait_lens or lens * 0.72)):
            cd = bpy.data.cameras.new('%s_%s' % (name, which))
            cd.lens = L
            cd.sensor_width = 36.0
            cd.sensor_fit = 'AUTO'
            cd.clip_start = 0.05
            cd.clip_end = clip_end
            cam = link(bpy.data.objects.new(cd.name, cd), col)
            cam.parent = self.rig
            self.cams[which] = cam

    def camera(self, which):
        return self.cams[res_aspect_key(which)]

    def key(self, frame, loc=None, look=None):
        if loc is not None:
            self.rig.location = loc
            self.rig.keyframe_insert('location', frame=frame)
        if look is not None:
            self.look.location = look
            self.look.keyframe_insert('location', frame=frame)

    def dof(self, focus=None, distance=10.0, fstop=2.8):
        for cam in self.cams.values():
            set_dof(cam, focus, distance, fstop)

    def lens_key(self, frame, lens):
        for which, cam in self.cams.items():
            cam.data.lens = lens if which == 'desktop' else lens * 0.72
            cam.data.keyframe_insert('lens', frame=frame)

    def shake(self, strength=0.01, scale=6.0, phase=0.0):
        """Handheld / turbulence shake on the child cameras' local rotation (keeps the rig path clean)."""
        for i, cam in enumerate(self.cams.values()):
            add_noise(cam, 'rotation_euler', strength, scale, phase + i * 0.0)


def set_dof(cam, focus=None, distance=10.0, fstop=2.8):
    """Depth of field on the hero subject: focus an object if given, else a fixed distance."""
    d = cam.data.dof
    d.use_dof = True
    d.aperture_fstop = fstop
    d.aperture_blades = 7
    d.aperture_rotation = deg(12)
    if focus is not None:
        d.focus_object = focus
    else:
        d.focus_distance = distance


def use_camera(scene, rig, which):
    scene.camera = rig.camera(which)


# --------------------------------------------------------------------------------------------------
# sky and lights
# --------------------------------------------------------------------------------------------------
def nishita_world(scene, sun_elevation=20.0, sun_rotation=0.0, strength=1.0, altitude=0.0, air=1.0, dust=1.0,
                  ozone=1.0, sun_disc=True, sun_intensity=1.0, stars=0.0, name='Sky'):
    """Physically based Nishita sky. Angles in degrees. stars > 0 adds a faint star field above the horizon.

    sun_rotation is the azimuth of the sun around the zenith. Check the direction in a preview render;
    plan.md wants the dawn glow ahead of the aircraft in build_sky.py.
    """
    world = bpy.data.worlds.new(name)
    scene.world = world
    world.use_nodes = True
    nt = world.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputWorld')
    bg = nt.nodes.new('ShaderNodeBackground')
    sky = nt.nodes.new('ShaderNodeTexSky')
    try:
        sky.sky_type = 'NISHITA'
    except TypeError:
        warn('Nishita sky type missing in this Blender; using its default sky model')
    try_set(sky, 'sun_elevation', deg(sun_elevation))
    try_set(sky, 'sun_rotation', deg(sun_rotation))
    try_set(sky, 'altitude', float(altitude))
    try_set(sky, 'air_density', air)
    try_set(sky, 'dust_density', dust)
    try_set(sky, 'ozone_density', ozone)
    try_set(sky, 'sun_disc', sun_disc)
    try_set(sky, 'sun_intensity', sun_intensity)
    try_set(sky, 'sun_size', deg(0.545))
    bg.inputs['Strength'].default_value = strength
    if stars > 0:
        # stars: tiny Voronoi cells on the view direction, only above the horizon, added to the sky
        tc = nt.nodes.new('ShaderNodeTexCoord')
        vor = nt.nodes.new('ShaderNodeTexVoronoi')
        vor.inputs['Scale'].default_value = 900.0
        thr = nt.nodes.new('ShaderNodeMath')
        thr.operation = 'LESS_THAN'
        thr.inputs[1].default_value = 0.035
        sep = nt.nodes.new('ShaderNodeSeparateXYZ')
        up = nt.nodes.new('ShaderNodeMath')
        up.operation = 'MULTIPLY'
        up.use_clamp = True
        up.inputs[1].default_value = 6.0
        mul = nt.nodes.new('ShaderNodeMath')
        mul.operation = 'MULTIPLY'
        emi = nt.nodes.new('ShaderNodeEmission')
        emi.inputs['Strength'].default_value = stars
        add = nt.nodes.new('ShaderNodeAddShader')
        nt.links.new(tc.outputs['Generated'], vor.inputs['Vector'])
        nt.links.new(vor.outputs['Distance'], thr.inputs[0])
        nt.links.new(tc.outputs['Generated'], sep.inputs[0])
        nt.links.new(sep.outputs['Z'], up.inputs[0])
        nt.links.new(thr.outputs[0], mul.inputs[0])
        nt.links.new(up.outputs[0], mul.inputs[1])
        nt.links.new(mul.outputs[0], emi.inputs['Strength'])
        emi.inputs['Strength'].default_value = stars
        # Strength socket is linked, so scale the colour instead
        emi.inputs['Color'].default_value = (stars, stars, stars * 1.1, 1)
        nt.links.new(sky.outputs['Color'], bg.inputs['Color'])
        nt.links.new(bg.outputs[0], add.inputs[0])
        nt.links.new(emi.outputs[0], add.inputs[1])
        nt.links.new(add.outputs[0], out.inputs['Surface'])
        world['stars_node'] = emi.name
    else:
        nt.links.new(sky.outputs['Color'], bg.inputs['Color'])
        nt.links.new(bg.outputs[0], out.inputs['Surface'])
    world['sky_node'] = sky.name
    world['bg_node'] = bg.name
    return world


def sky_node(world):
    return world.node_tree.nodes[world['sky_node']]


def sun_vector(elevation, azimuth):
    """Unit vector pointing towards the sun. Degrees; azimuth 0 = +Y, 90 = +X."""
    el, az = deg(elevation), deg(azimuth)
    return Vector((math.sin(az) * math.cos(el), math.cos(az) * math.cos(el), math.sin(el)))


def sun_lamp(name='SUN', elevation=40.0, azimuth=30.0, energy=4.0, angle=0.53, col=None, color=(1.0, 0.97, 0.92)):
    """Sun lamp pointing down from (elevation, azimuth) in degrees; azimuth 0 = light comes from +Y."""
    ld = bpy.data.lights.new(name, 'SUN')
    ld.energy = energy
    ld.angle = deg(angle)
    ld.color = color
    obj = link(bpy.data.objects.new(name, ld), col)
    # a sun shines along its local -Z: aim -Z opposite the direction the light comes from
    obj.rotation_euler = (-sun_vector(elevation, azimuth)).to_track_quat('-Z', 'Y').to_euler()
    return obj


def caustics_light(light_obj):
    """Mark a light as a shadow-caustics (MNEE) light. Blender 3.2+."""
    for target in (getattr(light_obj, 'data', None), light_obj):
        if target is None:
            continue
        for sub in (getattr(target, 'cycles', None), target):
            if sub is not None and hasattr(sub, 'is_caustics_light'):
                try:
                    setattr(sub, 'is_caustics_light', True)
                    return True
                except (TypeError, AttributeError, ValueError) as e:
                    warn('%s.is_caustics_light: %s' % (getattr(light_obj, 'name', light_obj), e))
                    return False
    warn('no property is_caustics_light on %s (Blender version?)' % getattr(light_obj, 'name', light_obj))
    return False


def caustics_object(obj, caster=False, receiver=False):
    """Shadow caustics (MNEE, Blender 3.2+): the refractive surface casts, the tiles receive."""
    if caster:
        try_set(obj, 'is_caustics_caster', True)
    if receiver:
        try_set(obj, 'is_caustics_receiver', True)


# --------------------------------------------------------------------------------------------------
# materials (socket names differ between Blender 3.x and 4.x; set_input tries both)
# --------------------------------------------------------------------------------------------------
ALIASES = {
    'Subsurface Weight': ['Subsurface Weight', 'Subsurface'],
    'Transmission Weight': ['Transmission Weight', 'Transmission'],
    'Specular IOR Level': ['Specular IOR Level', 'Specular'],
    'Emission Color': ['Emission Color', 'Emission'],
    'Coat Weight': ['Coat Weight', 'Clearcoat'],
    'Coat Roughness': ['Coat Roughness', 'Clearcoat Roughness'],
}


def set_input(node, name, value):
    for n in ALIASES.get(name, [name]):
        if n in node.inputs:
            node.inputs[n].default_value = value
            return node.inputs[n]
    warn('node %s has no input %s' % (node.name, name))
    return None


def get_input(node, name):
    for n in ALIASES.get(name, [name]):
        if n in node.inputs:
            return node.inputs[n]
    raise KeyError(name)


def material(name, **inputs):
    """Principled BSDF material. Keyword names use 4.x socket names with spaces replaced by underscores,
    e.g. material('Ice', Base_Color=(...), Transmission_Weight=1, IOR=1.31, Roughness=0.08)."""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    for k, v in inputs.items():
        set_input(bsdf, k.replace('_', ' '), v)
    return mat


def bsdf_of(mat):
    return mat.node_tree.nodes.get('Principled BSDF')


def output_of(mat):
    return mat.node_tree.nodes.get('Material Output')


def emission_material(name, color=(1, 1, 1, 1), strength=10.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    em = nt.nodes.new('ShaderNodeEmission')
    em.inputs['Color'].default_value = color
    em.inputs['Strength'].default_value = strength
    nt.links.new(em.outputs[0], out.inputs['Surface'])
    mat['emission_node'] = em.name
    return mat


def volume_material(name, density=0.02, color=(1, 1, 1, 1), anisotropy=0.0, absorption=(1, 1, 1, 1)):
    """Volume-only material (no surface): for fog boxes, dust and cloud domains."""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    vol = nt.nodes.new('ShaderNodeVolumePrincipled')
    vol.inputs['Color'].default_value = color
    vol.inputs['Density'].default_value = density
    vol.inputs['Anisotropy'].default_value = anisotropy
    vol.inputs['Absorption Color'].default_value = absorption
    nt.links.new(vol.outputs[0], out.inputs['Volume'])
    mat['volume_node'] = vol.name
    return mat


def node(nt, kind, **props):
    n = nt.nodes.new(kind)
    for k, v in props.items():
        if k in ('inputs',):
            continue
        setattr(n, k, v)
    for k, v in props.get('inputs', {}).items():
        n.inputs[k].default_value = v
    return n


def key_socket(sock, frame, value):
    """Keyframe a node input (works for material, world and light node trees)."""
    sock.default_value = value
    sock.keyframe_insert('default_value', frame=frame)


def frame_driver(sock, expression='frame'):
    """Drive a socket with a *simple* expression (no Python needed, so it also works without -y)."""
    fc = sock.driver_add('default_value')
    fc.driver.type = 'SCRIPTED'
    fc.driver.expression = expression
    return fc


def image_texture(nt, path, non_color=False, extension='REPEAT'):
    n = nt.nodes.new('ShaderNodeTexImage')
    if path and os.path.exists(path):
        n.image = bpy.data.images.load(path, check_existing=True)
        if non_color:
            n.image.colorspace_settings.name = 'Non-Color'
    else:
        warn('texture missing: %s' % path)
    n.extension = extension
    return n


def assign(obj, mat):
    if obj.data.materials:
        obj.data.materials[0] = mat
    else:
        obj.data.materials.append(mat)
    return obj


# --------------------------------------------------------------------------------------------------
# meshes (bmesh, so no operator context is needed in background mode)
# --------------------------------------------------------------------------------------------------
def mesh_object(name, build, col=None, location=(0, 0, 0), smooth=False):
    """build(bm) fills a bmesh; returns a new linked object."""
    bm = bmesh.new()
    build(bm)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    if smooth:
        for p in me.polygons:
            p.use_smooth = True
    obj = link(bpy.data.objects.new(name, me), col)
    obj.location = location
    return obj


def _fit(bm, size):
    """Scale a fresh primitive so its bounding box is exactly `size` (independent of how a Blender version
    interprets the primitive's own size argument)."""
    n = len(size)
    lo = [min(v.co[i] for v in bm.verts) for i in range(n)]
    hi = [max(v.co[i] for v in bm.verts) for i in range(n)]
    k = [size[i] / (hi[i] - lo[i]) if hi[i] - lo[i] > 1e-9 else 1.0 for i in range(n)] + [1.0] * (3 - n)
    bmesh.ops.scale(bm, vec=Vector(k[:3]), verts=bm.verts)


def box(name, size=(1, 1, 1), location=(0, 0, 0), col=None, mat=None):
    def b(bm):
        bmesh.ops.create_cube(bm, size=1.0, calc_uvs=True)
        _fit(bm, size)
    o = mesh_object(name, b, col, location)
    if mat:
        assign(o, mat)
    return o


def plane(name, size=(1, 1), location=(0, 0, 0), col=None, mat=None, segments=(1, 1)):
    def b(bm):
        bmesh.ops.create_grid(bm, x_segments=max(1, segments[0]), y_segments=max(1, segments[1]), size=1.0, calc_uvs=False)
        _fit(bm, size)
        # UVs 0..1 across the plane (scale them to metres with build_pool.scale_uvs for procedural tiles)
        uv = bm.loops.layers.uv.verify()
        for f in bm.faces:
            for lp in f.loops:
                lp[uv].uv = (lp.vert.co.x / size[0] + 0.5, lp.vert.co.y / size[1] + 0.5)
    o = mesh_object(name, b, col, location)
    if mat:
        assign(o, mat)
    return o


def sphere(name, radius=1.0, location=(0, 0, 0), col=None, mat=None, segments=24, rings=12, smooth=True):
    def b(bm):
        bmesh.ops.create_uvsphere(bm, u_segments=segments, v_segments=rings, radius=radius, calc_uvs=True)
    o = mesh_object(name, b, col, location, smooth)
    if mat:
        assign(o, mat)
    return o


def ico(name, radius=1.0, subdiv=2, location=(0, 0, 0), col=None, mat=None, smooth=True):
    def b(bm):
        bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=radius, calc_uvs=True)
    o = mesh_object(name, b, col, location, smooth)
    if mat:
        assign(o, mat)
    return o


def cylinder(name, radius=0.5, depth=1.0, location=(0, 0, 0), col=None, mat=None, segments=24, radius2=None, smooth=True):
    def b(bm):
        bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segments, radius1=radius,
                              radius2=radius if radius2 is None else radius2, depth=depth, calc_uvs=True)
    o = mesh_object(name, b, col, location, smooth)
    if mat:
        assign(o, mat)
    return o


def empty(name, location=(0, 0, 0), col=None, kind='PLAIN_AXES', size=1.0):
    e = link(bpy.data.objects.new(name, None), col)
    e.empty_display_type = kind
    e.empty_display_size = size
    e.location = location
    return e


def parent(child, par, keep_world=True):
    mw = child.matrix_world.copy()
    child.parent = par
    if keep_world:
        child.matrix_parent_inverse = par.matrix_world.inverted()
        child.matrix_world = mw
    return child


# --------------------------------------------------------------------------------------------------
# animation
# --------------------------------------------------------------------------------------------------
def key(obj, frame, loc=None, rot=None, scale=None):
    """Keyframe an object's transform. rot in degrees."""
    if loc is not None:
        obj.location = loc
        obj.keyframe_insert('location', frame=frame)
    if rot is not None:
        obj.rotation_euler = [deg(r) for r in rot]
        obj.keyframe_insert('rotation_euler', frame=frame)
    if scale is not None:
        obj.scale = scale
        obj.keyframe_insert('scale', frame=frame)


def iter_fcurves(idb):
    """F-curves of an ID's action. Works with the classic API and the layered actions of Blender 4.4+."""
    ad = getattr(idb, 'animation_data', None)
    if not ad or not ad.action:
        return []
    act = ad.action
    try:
        fcs = list(act.fcurves)
        if fcs:
            return fcs
    except AttributeError:
        pass
    out = []
    for layer in getattr(act, 'layers', []):
        for strip in layer.strips:
            for bag in getattr(strip, 'channelbags', []):
                out.extend(bag.fcurves)
    return out


def interpolation(idb, mode='LINEAR', data_path=None):
    for fc in iter_fcurves(idb):
        if data_path and fc.data_path != data_path:
            continue
        for kp in fc.keyframe_points:
            kp.interpolation = mode


def ease(idb, data_path=None, easing='EASE_IN_OUT'):
    for fc in iter_fcurves(idb):
        if data_path and fc.data_path != data_path:
            continue
        for kp in fc.keyframe_points:
            kp.interpolation = 'BEZIER'
            kp.easing = easing


def add_noise(obj, data_path='rotation_euler', strength=0.01, scale=6.0, phase=0.0, frame_range=None):
    """Noise F-modifier on each channel of data_path (creates a key first if needed)."""
    if not any(fc.data_path == data_path for fc in iter_fcurves(obj)):
        obj.keyframe_insert(data_path, frame=1)
    for i, fc in enumerate(fc for fc in iter_fcurves(obj) if fc.data_path == data_path):
        m = fc.modifiers.new('NOISE')
        m.strength = strength
        m.scale = scale
        m.phase = phase + i * 13.7
        if frame_range:
            m.use_restricted_range = True
            m.frame_start, m.frame_end = frame_range
            m.blend_in = m.blend_out = 6
    return obj


def hold_cut(obj, frame_end, data_paths=('location', 'rotation_euler')):
    """Before a hard cut at frame_end -> frame_end+1, add hold keys at frame_end+0.49 and frame_end+0.51 so
    motion blur (shutter 0.5 = +-0.25 frame) never smears across the cut."""
    for dp in data_paths:
        fcs = [fc for fc in iter_fcurves(obj) if fc.data_path == dp]
        for fc in fcs:
            v0 = fc.evaluate(frame_end)
            v1 = fc.evaluate(frame_end + 1)
            k = fc.keyframe_points.insert(frame_end + 0.49, v0)
            k.interpolation = 'CONSTANT'   # jump happens at frame_end + 0.51, outside both shutters
            fc.keyframe_points.insert(frame_end + 0.51, v1)


# --------------------------------------------------------------------------------------------------
# particles
# --------------------------------------------------------------------------------------------------
def particles(emitter, name, instance, count=300, frame_start=1, frame_end=240, lifetime=120, size=0.01,
              size_random=0.5, normal=0.0, gravity=1.0, brownian=0.0, emit_from='FACE', seed=1, physics='NEWTON'):
    """Particle system that instances `instance` (keep the source object far away; its location is ignored)."""
    emitter.modifiers.new(name, 'PARTICLE_SYSTEM')
    ps = emitter.particle_systems[-1]
    ps.seed = seed
    s = ps.settings
    s.name = name
    s.count = count
    s.frame_start = frame_start
    s.frame_end = frame_end
    s.lifetime = lifetime
    s.lifetime_random = 0.4
    s.emit_from = emit_from
    s.use_emit_random = True
    s.normal_factor = normal
    s.factor_random = normal * 0.3
    s.render_type = 'OBJECT'
    s.instance_object = instance
    s.particle_size = size
    s.size_random = size_random
    s.brownian_factor = brownian
    s.effector_weights.gravity = gravity
    s.use_rotations = True
    s.rotation_factor_random = 0.3
    try:
        s.physics_type = physics
    except TypeError:
        warn('particle physics %s unavailable' % physics)
    emitter.show_instancer_for_render = False
    emitter.show_instancer_for_viewport = False
    ps.point_cache.frame_start = frame_start
    ps.point_cache.frame_end = frame_end + lifetime
    return ps


# --------------------------------------------------------------------------------------------------
# finishing
# --------------------------------------------------------------------------------------------------
def finish(scene, args):
    """Save the .blend if asked, bake particle caches, then render the frame range as a PNG sequence."""
    os.makedirs(os.path.join(args.out, args.res), exist_ok=True)
    try:
        bpy.ops.ptcache.bake_all(bake=True)
    except RuntimeError as e:
        warn('particle bake skipped: %s' % e)
    if args.save:
        bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(args.save))
        print('[film-kit] saved', os.path.abspath(args.save))
    if args.no_render:
        print('[film-kit] built, not rendering (--no-render)')
        return
    print('[film-kit] rendering frames %d-%d (%s) to %s' % (scene.frame_start, scene.frame_end, args.res, scene.render.filepath))
    bpy.ops.render.render(animation=True, scene=scene.name)
    print('[film-kit] done')


def script_dir():
    """Folder of the running script (works with `blender -b -P path/to/script.py`)."""
    f = globals().get('__file__')
    if f:
        return os.path.dirname(os.path.abspath(f))
    if '-P' in sys.argv:
        return os.path.dirname(os.path.abspath(sys.argv[sys.argv.index('-P') + 1]))
    return os.getcwd()


def repo_root():
    return os.path.dirname(script_dir())
