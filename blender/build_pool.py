"""Pool film for the home page, section 05 "Beyond the classroom" (plan.md 4.2 and 7).

Story (240 frames at 24 fps = 10 s):
    1-40     above a slab of ice that covers the pool, slow push in
    30-95    the slab melts: a noise mask eats it from transparent holes outwards
    90-115   the camera drops through the hole and under the surface
    110-185  a swimmer glides overhead in streamline with a flutter kick; bubbles, caustics, light shafts
    180-210  the camera rises back through the surface
    195-235  the water refreezes into the slab

Scene: 50 x 25 m competition pool, 2 m deep, 10 lanes of 2.5 m, white tiles with dark lane T-lines and wall
targets, lane ropes, starting blocks, refractive water (IOR 1.333) with animated displacement waves and an
absorbing + scattering volume, sun through the surface with caustics (light-path caustics, plus shadow
caustics/MNEE on Blender 3.2+), a gobo spot light for volumetric shafts (light linking keeps the water from
blocking it, Blender 4.0+), bubbles, and a stand-in swimmer.

Swimmer: the empty SWIMMER is the root. Its children are simple capsules with pivot empties at the shoulders
and hips. To use a Mixamo character instead: import the FBX, parent its armature to SWIMMER (keep transform),
rotate it prone facing +X, then delete the SWIMMER_* mesh children. The glide path stays on SWIMMER.

Run (from the repo root):
    blender -b -P blender/build_pool.py -- --out renders/pool --res desktop --frames 1-240
    blender -b -P blender/build_pool.py -- --out renders/pool --res portrait --frames 1-240
    blender -b -P blender/build_pool.py -- --preview --save renders/pool/pool.blend   # quick look + .blend
"""
import math
import os
import sys

import bpy
import bmesh
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)) if '__file__' in globals() else os.getcwd())
import common as C  # noqa: E402

POOL_L, POOL_W, DEPTH = 50.0, 25.0, 2.0
LANES, LANE_W = 10, 2.5
DECK_Z = 0.3


def extra_args(p):
    p.add_argument('--waves', type=float, default=0.035, help='wave displacement strength in metres')
    p.add_argument('--sun-elevation', type=float, default=55.0)
    p.add_argument('--sun-azimuth', type=float, default=30.0)
    p.add_argument('--no-shafts', action='store_true', help='skip the gobo spot light (faster)')


def scale_uvs(obj, sx, sy):
    """create_grid makes 0..1 UVs; scale them to metres so procedural tiles have a real size."""
    uv = obj.data.uv_layers.active
    for d in uv.data:
        d.uv = (d.uv[0] * sx, d.uv[1] * sy)


# ------------------------------------------------------------------------------------------------ materials
def tile_material():
    """White square tiles (25 cm) with glacier-grey grout, glossy glaze, grout bump. Uses UVs in metres."""
    mat = C.material('PoolTiles', Base_Color=(0.93, 0.95, 0.97, 1), Roughness=0.12, Specular_IOR_Level=0.5)
    nt = mat.node_tree
    b = C.bsdf_of(mat)
    tc = nt.nodes.new('ShaderNodeTexCoord')
    brick = nt.nodes.new('ShaderNodeTexBrick')
    brick.offset = 0.0
    brick.inputs['Scale'].default_value = 1.0
    brick.inputs['Brick Width'].default_value = 0.25
    brick.inputs['Row Height'].default_value = 0.25
    brick.inputs['Mortar Size'].default_value = 0.006
    brick.inputs['Mortar Smooth'].default_value = 0.3
    brick.inputs['Color1'].default_value = (0.95, 0.97, 0.98, 1)
    brick.inputs['Color2'].default_value = (0.90, 0.93, 0.96, 1)
    brick.inputs['Mortar'].default_value = (0.62, 0.70, 0.76, 1)
    bump = nt.nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = 0.35
    nt.links.new(tc.outputs['UV'], brick.inputs['Vector'])
    nt.links.new(brick.outputs['Color'], b.inputs['Base Color'])
    nt.links.new(brick.outputs['Fac'], bump.inputs['Height'])
    nt.links.new(bump.outputs['Normal'], b.inputs['Normal'])
    return mat


def water_material():
    """Clear refractive surface + blue absorption + forward scattering volume (shows the light shafts)."""
    mat = C.material('Water', Base_Color=(1, 1, 1, 1), Roughness=0.02, IOR=1.333, Transmission_Weight=1.0,
                     Specular_IOR_Level=0.5)
    nt = mat.node_tree
    out = C.output_of(mat)
    absorb = nt.nodes.new('ShaderNodeVolumeAbsorption')
    absorb.inputs['Color'].default_value = (0.70, 0.88, 0.95, 1)
    absorb.inputs['Density'].default_value = 0.09
    scat = nt.nodes.new('ShaderNodeVolumeScatter')
    scat.inputs['Color'].default_value = (0.82, 0.93, 1.0, 1)
    scat.inputs['Density'].default_value = 0.018
    scat.inputs['Anisotropy'].default_value = 0.65
    add = nt.nodes.new('ShaderNodeAddShader')
    nt.links.new(absorb.outputs[0], add.inputs[0])
    nt.links.new(scat.outputs[0], add.inputs[1])
    nt.links.new(add.outputs[0], out.inputs['Volume'])
    return mat


def ice_slab_material():
    """Ice with a melt mask: a Value node 'MELT' (0 = solid, 1 = gone) thresholds a noise field; below the
    threshold the surface becomes Transparent BSDF (the 'alpha' of the dissolve). A thin bright rim marks the edge."""
    mat = C.material('IceSlab', Base_Color=(0.91, 0.94, 0.97, 1), Roughness=0.08, IOR=1.31,
                     Transmission_Weight=0.92, Subsurface_Weight=0.15, Specular_IOR_Level=0.5)
    b = C.bsdf_of(mat)
    try:
        C.set_input(b, 'Subsurface Radius', (0.6, 0.85, 1.0))
    except Exception:
        pass
    nt = mat.node_tree
    out = C.output_of(mat)
    tc = nt.nodes.new('ShaderNodeTexCoord')
    noise = nt.nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 0.35
    noise.inputs['Detail'].default_value = 8.0
    noise.inputs['Roughness'].default_value = 0.6
    melt = nt.nodes.new('ShaderNodeValue')
    melt.name = melt.label = 'MELT'
    melt.outputs[0].default_value = 0.0
    # threshold = melt * 1.3 - 0.15 so 0 is fully solid and 1 is fully gone
    thr = nt.nodes.new('ShaderNodeMath')
    thr.operation = 'MULTIPLY_ADD'
    thr.inputs[1].default_value = 1.3
    thr.inputs[2].default_value = -0.15
    thr_hi = nt.nodes.new('ShaderNodeMath')
    thr_hi.operation = 'ADD'
    thr_hi.inputs[1].default_value = 0.03
    mr = nt.nodes.new('ShaderNodeMapRange')
    mr.inputs[3].default_value = 0.0
    mr.inputs[4].default_value = 1.0
    nt.links.new(tc.outputs['Object'], noise.inputs['Vector'])
    nt.links.new(melt.outputs[0], thr.inputs[0])
    nt.links.new(thr.outputs[0], thr_hi.inputs[0])
    nt.links.new(noise.outputs['Fac'], mr.inputs[0])
    nt.links.new(thr.outputs[0], mr.inputs[1])
    nt.links.new(thr_hi.outputs[0], mr.inputs[2])
    transp = nt.nodes.new('ShaderNodeBsdfTransparent')
    mix = nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(mr.outputs[0], mix.inputs[0])
    nt.links.new(transp.outputs[0], mix.inputs[1])
    nt.links.new(b.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs['Surface'])
    # subtle frost on the surface: bump from fine noise
    fn = nt.nodes.new('ShaderNodeTexNoise')
    fn.inputs['Scale'].default_value = 40.0
    fn.inputs['Detail'].default_value = 4.0
    bump = nt.nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = 0.08
    nt.links.new(tc.outputs['Object'], fn.inputs['Vector'])
    nt.links.new(fn.outputs['Fac'], bump.inputs['Height'])
    nt.links.new(bump.outputs['Normal'], b.inputs['Normal'])
    return mat, melt


# ------------------------------------------------------------------------------------------------ geometry
def build_basin(col, tiles, line_mat):
    floor = C.plane('PoolFloor', (POOL_L, POOL_W), (0, 0, -DEPTH), col, tiles)
    scale_uvs(floor, POOL_L, POOL_W)
    h = DEPTH + DECK_Z
    zc = -DEPTH + h / 2
    walls = []
    for name, size, loc, rot in (
            ('WallN', (POOL_L, h), (0, POOL_W / 2, zc), (90, 0, 0)),
            ('WallS', (POOL_L, h), (0, -POOL_W / 2, zc), (-90, 0, 0)),
            ('WallE', (POOL_W, h), (POOL_L / 2, 0, zc), (90, 0, 90)),
            ('WallW', (POOL_W, h), (-POOL_L / 2, 0, zc), (90, 0, -90))):
        w = C.plane(name, size, loc, col, tiles)
        w.rotation_euler = [math.radians(r) for r in rot]
        scale_uvs(w, size[0], size[1])
        walls.append(w)
    # lane T-lines on the floor: 25 cm wide, ending 2 m from each wall with a 1 m cross bar
    for i in range(LANES):
        y = -POOL_W / 2 + LANE_W * (i + 0.5)
        C.box('LaneLine_%d' % i, (POOL_L - 4.0, 0.25, 0.004), (0, y, -DEPTH + 0.002), col, line_mat)
        for sx in (-1, 1):
            C.box('LaneT_%d_%d' % (i, sx), (0.25, 1.0, 0.004), (sx * (POOL_L / 2 - 2.0), y, -DEPTH + 0.002), col, line_mat)
            # wall target: vertical line down the end wall with a 50 cm cross 30 cm below the surface
            C.box('Target_%d_%d' % (i, sx), (0.004, 0.25, DEPTH - 0.3), (sx * (POOL_L / 2 - 0.003), y, -DEPTH / 2 - 0.15), col, line_mat)
            C.box('TargetX_%d_%d' % (i, sx), (0.004, 0.5, 0.25), (sx * (POOL_L / 2 - 0.003), y, -0.3), col, line_mat)
    return floor, walls


def build_deck(col, snow):
    """Snowy deck around the pool so the above-water shots sit in the icy world."""
    t = 30.0
    C.box('DeckN', (POOL_L + 2 * t, t, 1.0), (0, POOL_W / 2 + t / 2, DECK_Z - 0.5), col, snow)
    C.box('DeckS', (POOL_L + 2 * t, t, 1.0), (0, -POOL_W / 2 - t / 2, DECK_Z - 0.5), col, snow)
    C.box('DeckE', (t, POOL_W, 1.0), (POOL_L / 2 + t / 2, 0, DECK_Z - 0.5), col, snow)
    C.box('DeckW', (t, POOL_W, 1.0), (-POOL_L / 2 - t / 2, 0, DECK_Z - 0.5), col, snow)


def build_water(col, mat, strength):
    """Grid -> two Displace modifiers (animated by drifting empties) -> Solidify into a closed volume."""
    water = C.plane('Water', (POOL_L - 0.02, POOL_W - 0.02), (0, 0, 0), col, mat, segments=(400, 200))
    for p in water.data.polygons:
        p.use_smooth = True
    for i, (scale, s, drift) in enumerate(((1.6, 1.0, (0.9, 0.35, 0)), (0.55, 0.45, (-0.4, 0.8, 0)))):
        tex = bpy.data.textures.new('Waves%d' % i, 'CLOUDS')
        tex.noise_scale = scale
        tex.noise_depth = 2
        tex.noise_basis = 'ORIGINAL_PERLIN'
        drv = C.empty('WaveDrift%d' % i, (0, 0, 0), col)
        C.key(drv, 1, loc=(0, 0, 0))
        C.key(drv, 240, loc=(drift[0] * 10, drift[1] * 10, 0))
        C.interpolation(drv, 'LINEAR')
        m = water.modifiers.new('Waves%d' % i, 'DISPLACE')
        m.texture = tex
        m.texture_coords = 'OBJECT'
        m.texture_coords_object = drv
        m.direction = 'Z'
        m.strength = strength * s
        m.mid_level = 0.5
    sol = water.modifiers.new('Body', 'SOLIDIFY')
    sol.thickness = DEPTH - 0.02   # bottom sits 2 cm above the floor (no z-fighting with the tiles)
    sol.offset = -1.0
    sol.use_even_offset = True
    C.caustics_object(water, caster=True)
    return water


def build_lane_ropes(col):
    white = C.material('RopeWhite', Base_Color=(0.95, 0.96, 0.97, 1), Roughness=0.35)
    blue = C.material('RopeIce', Base_Color=(0.37, 0.54, 0.67, 1), Roughness=0.35)  # Deep ice

    def build(bm):
        for k in range(2):
            geo = bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=16, radius1=0.055, radius2=0.055, depth=0.11)
            vs = geo['verts']
            bmesh.ops.rotate(bm, verts=vs, cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi / 2, 3, 'Y'))
            bmesh.ops.translate(bm, verts=vs, vec=(k * 0.116, 0, 0))
            for f in {f for v in vs for f in v.link_faces}:
                f.material_index = k
    for i in range(1, LANES):
        y = -POOL_W / 2 + LANE_W * i
        r = C.mesh_object('LaneRope_%d' % i, build, col, (-POOL_L / 2 + 0.1, y, 0.0), smooth=True)
        r.data.materials.append(white)
        r.data.materials.append(blue)
        arr = r.modifiers.new('Array', 'ARRAY')
        arr.use_relative_offset = False
        arr.use_constant_offset = True
        arr.constant_offset_displace = (0.232, 0, 0)
        arr.count = int((POOL_L - 0.2) / 0.232)


def build_blocks(col):
    mat = C.material('Blocks', Base_Color=(0.85, 0.88, 0.91, 1), Roughness=0.4)
    for i in range(LANES):
        y = -POOL_W / 2 + LANE_W * (i + 0.5)
        C.box('Block_%d' % i, (0.6, 0.55, 0.12), (POOL_L / 2 + 0.35, y, DECK_Z + 0.7), col, mat)
        C.box('BlockPost_%d' % i, (0.3, 0.3, 0.65), (POOL_L / 2 + 0.45, y, DECK_Z + 0.33), col, mat)


def build_swimmer(col):
    """Stand-in swimmer, prone, facing +X, arms in streamline ahead, flutter kick from the hips."""
    root = C.empty('SWIMMER', (0, 0, -0.35), col, 'ARROWS', 0.6)
    suit = C.material('SwimSuit', Base_Color=(0.03, 0.04, 0.06, 1), Roughness=0.45)
    skin = C.material('Skin', Base_Color=(0.62, 0.46, 0.38, 1), Roughness=0.45, Subsurface_Weight=0.3)
    cap = C.material('Cap', Base_Color=(0.95, 0.96, 0.97, 1), Roughness=0.3)
    torso = C.sphere('SWIMMER_torso', 1.0, (0, 0, 0), col, suit)
    torso.scale = (0.42, 0.19, 0.12)
    head = C.sphere('SWIMMER_head', 0.11, (0.58, 0, 0.0), col, cap)
    parts = [torso, head]
    for side, sy in (('L', 0.17), ('R', -0.17)):
        sh = C.empty('SWIMMER_shoulder.%s' % side, (0.36, sy, 0.02), col)
        arm = C.cylinder('SWIMMER_arm.%s' % side, 0.045, 0.62, (0.31, 0, 0), col, skin, radius2=0.035)
        arm.rotation_euler = (0, math.pi / 2, 0)
        arm.parent = sh
        sh.rotation_euler = (0, 0, math.radians(-8 if side == 'L' else 8))  # hands meet ahead of the head
        hip = C.empty('SWIMMER_hip.%s' % side, (-0.36, sy * 0.55, 0), col)
        leg = C.cylinder('SWIMMER_leg.%s' % side, 0.07, 0.85, (-0.43, 0, 0), col, skin, radius2=0.04)
        leg.rotation_euler = (0, math.pi / 2, 0)
        leg.parent = hip
        # flutter kick: legs alternate +-12 degrees, 2 kicks per second, looped with a Cycles modifier
        ph = 0 if side == 'L' else 6
        for f, a in ((1 + ph, 12), (7 + ph, -12), (13 + ph, 12)):
            C.key(hip, f, rot=(0, a, 0))
        for fc in C.iter_fcurves(hip):
            fc.modifiers.new('CYCLES')
        parts += [sh, hip]
    for p in parts:
        p.parent = root
    # glide overhead from -X to +X, about 2 m/s, with a slow body roll
    C.key(root, 100, loc=(-4.5, 0.2, -0.38), rot=(0, 0, 0))
    C.key(root, 190, loc=(3.0, 0.0, -0.32), rot=(0, 0, 0))
    C.interpolation(root, 'LINEAR', 'location')
    C.add_noise(root, 'rotation_euler', strength=0.08, scale=30.0)
    return root


def build_bubbles(col, swimmer, args):
    bubble_mat = C.material('Bubble', Base_Color=(1, 1, 1, 1), Roughness=0.0, IOR=0.752, Transmission_Weight=1.0)
    bubble = C.ico('BUBBLE', 1.0, 2, (0, 0, -500), col, bubble_mat)   # instance source, parked far away
    floor_em = C.plane('BubbleEmitterFloor', (12, 6), (0, 0, -DEPTH + 0.05), col)
    C.particles(floor_em, 'FloorBubbles', bubble, count=700, frame_start=1, frame_end=240, lifetime=90, size=0.012,
                size_random=0.7, normal=0.45, gravity=0.0, brownian=0.06, seed=args.seed)
    kick = C.plane('BubbleEmitterKick', (0.3, 0.3), (-1.2, 0, 0), col)
    kick.parent = swimmer
    C.particles(kick, 'KickBubbles', bubble, count=260, frame_start=100, frame_end=190, lifetime=50, size=0.008,
                size_random=0.8, normal=0.15, gravity=0.0, brownian=0.25, seed=args.seed + 1)


def build_shafts(col, sun_el, sun_az, blockers):
    """Spot light with an animated caustic gobo (Voronoi distance-to-edge). With light linking the water surface
    does not block it, so it lights the water volume as shafts and draws moving caustic webs on the tiles."""
    ld = bpy.data.lights.new('SHAFTS', 'SPOT')
    ld.energy = 9000.0
    ld.spot_size = math.radians(80)
    ld.spot_blend = 0.6
    ld.shadow_soft_size = 0.05
    ld.color = (0.9, 0.96, 1.0)
    ld.use_nodes = True
    nt = ld.node_tree
    em = nt.nodes.get('Emission')
    tc = nt.nodes.new('ShaderNodeTexCoord')
    mp = nt.nodes.new('ShaderNodeMapping')
    mp.inputs['Scale'].default_value = (6.0, 6.0, 6.0)
    vor = nt.nodes.new('ShaderNodeTexVoronoi')
    vor.voronoi_dimensions = '4D'
    vor.feature = 'DISTANCE_TO_EDGE'
    vor.inputs['Scale'].default_value = 3.0
    C.frame_driver(vor.inputs['W'], 'frame / 60')
    mr = nt.nodes.new('ShaderNodeMapRange')
    mr.inputs[1].default_value = 0.0
    mr.inputs[2].default_value = 0.08
    mr.inputs[3].default_value = 1.0
    mr.inputs[4].default_value = 0.0
    pw = nt.nodes.new('ShaderNodeMath')
    pw.operation = 'POWER'
    pw.inputs[1].default_value = 2.0
    nt.links.new(tc.outputs['Normal'], mp.inputs['Vector'])
    nt.links.new(mp.outputs['Vector'], vor.inputs['Vector'])
    nt.links.new(vor.outputs['Distance'], mr.inputs[0])
    nt.links.new(mr.outputs[0], pw.inputs[0])
    nt.links.new(pw.outputs[0], em.inputs['Strength'])
    obj = C.link(bpy.data.objects.new('SHAFTS', ld), col)
    # place it up the sun direction from the middle of the shot and aim it down along the sun
    d = C.sun_vector(sun_el, sun_az)
    obj.location = d * 16.0
    obj.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
    try:
        obj.light_linking.blocker_collection = blockers  # Blender 4.0+: only these objects cast its shadows
    except AttributeError:
        C.warn('light linking needs Blender 4.0+; the water will block the shaft light (shafts get weaker)')
    return obj


# ------------------------------------------------------------------------------------------------ main
def main():
    args = C.parse_args('Pool film: ice slab melts, underwater pool with a swimmer, refreezes.',
                        {'out': 'renders/pool', 'frames': '1-240', 'samples': 1024, 'min_samples': 128}, extra_args)
    scene = C.reset_scene()
    C.setup_render(scene, args, caustics=True, volumes=True)
    scene.cycles.volume_step_rate = 0.5  # finer steps in 2 m of water: crisper shafts
    col = C.collection('Pool')
    blockers = C.collection('ShaftBlockers')

    # sky (sun disc off: the sun lamp below is the sun, so caustics come from a real light)
    C.nishita_world(scene, sun_elevation=args.sun_elevation, sun_rotation=args.sun_azimuth, strength=0.6,
                    sun_disc=False, air=1.2, dust=0.6)
    sun = C.sun_lamp('SUN', args.sun_elevation, args.sun_azimuth, energy=4.5, angle=0.53, col=col)
    C.caustics_light(sun)

    tiles = tile_material()
    lines = C.material('LaneLines', Base_Color=(0.03, 0.07, 0.13, 1), Roughness=0.15)
    snow = C.material('DeckSnow', Base_Color=(0.93, 0.95, 0.97, 1), Roughness=0.6, Subsurface_Weight=0.2)
    floor, walls = build_basin(col, tiles, lines)
    for o in [floor] + walls:
        C.caustics_object(o, receiver=True)
    build_deck(col, snow)
    water = build_water(col, water_material(), args.waves)
    build_lane_ropes(col)
    build_blocks(col)

    # the ice slab over the middle of the pool
    ice_mat, melt = ice_slab_material()
    slab = C.box('IceSlab', (14.0, 10.0, 0.35), (0, 0, 0.2), col, ice_mat)
    bev = slab.modifiers.new('Bevel', 'BEVEL')
    bev.width = 0.04
    bev.segments = 3
    C.key_socket(melt.outputs[0], 1, 0.0)
    C.key_socket(melt.outputs[0], 30, 0.0)
    C.key_socket(melt.outputs[0], 95, 1.0)
    C.key_socket(melt.outputs[0], 195, 1.0)
    C.key_socket(melt.outputs[0], 235, 0.0)
    C.ease(ice_mat.node_tree)

    swimmer = build_swimmer(col)
    for o in [swimmer] + [c for c in swimmer.children_recursive] + [slab]:
        if o.name not in blockers.objects:
            blockers.objects.link(o)
    build_bubbles(col, swimmer, args)
    if not args.no_shafts:
        build_shafts(col, args.sun_elevation, args.sun_azimuth, blockers)

    # camera: above the slab -> down through the melt hole -> under the swimmer -> back up -> refreeze
    rig = C.CameraRig('CAM', lens=28.0, col=col)
    for f, loc, look in (
            (1, (-3.0, -7.0, 4.6), (0.0, 0.0, 0.25)),
            (40, (-2.2, -5.4, 3.6), (0.0, 0.5, 0.2)),
            (90, (-0.6, -2.6, 1.3), (0.3, 2.0, -0.6)),
            (115, (-0.4, -1.6, -1.25), (1.5, 3.5, -0.7)),
            (145, (-0.8, -0.9, -1.55), (0.2, 0.6, -0.2)),
            (180, (0.8, -1.0, -1.35), (3.0, 0.4, -0.4)),
            (205, (1.4, -1.8, 0.9), (1.8, 1.5, 0.1)),
            (240, (2.6, -6.0, 3.9), (0.0, 0.0, 0.25))):
        rig.key(f, loc, look)
    C.ease(rig.rig)
    C.ease(rig.look)
    rig.shake(strength=0.004, scale=40.0)

    # depth of field: FOCUS follows the slab, then the swimmer (Copy Location influence 0 -> 1 -> 0)
    focus = C.empty('FOCUS', (0, 0, 0.37), col)
    cl = focus.constraints.new('COPY_LOCATION')
    cl.target = swimmer
    for f, v in ((100, 0.0), (120, 1.0), (178, 1.0), (195, 0.0)):
        cl.influence = v
        cl.keyframe_insert('influence', frame=f)
    rig.dof(focus=focus, fstop=2.2)
    C.use_camera(scene, rig, args.res)

    C.finish(scene, args)


if __name__ == '__main__':
    main()
