"""Import the user's GLB without changing its geometry or material nodes."""
import bpy
import json
import hashlib
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / '参考资料' / 'nokia3310_混元原始.glb'
OUT = ROOT / 'Blender工程'
OUT.mkdir(exist_ok=True)
PREVIEW = OUT / '导入检查'
PREVIEW.mkdir(exist_ok=True)
source_hash = hashlib.file_digest(SOURCE.open('rb'), 'sha256').hexdigest()

# This is a fresh background session; no existing user scene is opened.
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(SOURCE))
objects = [o for o in bpy.context.scene.objects if o.type == 'MESH']
assert objects, 'No mesh imported'
collection = bpy.data.collections.new('01_Imported_Phone')
bpy.context.scene.collection.children.link(collection)
for obj in objects:
    for previous in list(obj.users_collection):
        previous.objects.unlink(obj)
    collection.objects.link(obj)
    obj.name = 'Nokia3310_Imported' if len(objects) == 1 else obj.name

bpy.context.view_layer.update()
corners = [o.matrix_world @ Vector(c) for o in objects for c in o.bound_box]
lo = Vector(tuple(min(c[i] for c in corners) for i in range(3)))
hi = Vector(tuple(max(c[i] for c in corners) for i in range(3)))
center = (lo + hi) / 2
extent = hi - lo
radius = max(extent)

prefs = bpy.context.preferences
languages = {e.identifier for e in prefs.view.bl_rna.properties['language'].enum_items}
if 'zh_HANS' in languages:
    prefs.view.language = 'zh_HANS'
elif 'zh_CN' in languages:
    prefs.view.language = 'zh_CN'
prefs.view.use_translate_interface = True
prefs.view.use_translate_tooltips = True
prefs.view.use_translate_new_dataname = False
prefs.inputs.use_rotate_around_active = True
prefs.inputs.use_zoom_to_mouse = True
if hasattr(prefs.view, 'show_splash'):
    prefs.view.show_splash = False
bpy.ops.wm.save_userpref()

scene = bpy.context.scene
scene.render.engine = 'BLENDER_WORKBENCH'
scene.render.resolution_x = 900
scene.render.resolution_y = 1200
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.film_transparent = False
scene.display.shading.light = 'STUDIO'
scene.display.shading.color_type = 'TEXTURE'
scene.display.shading.background_type = 'WORLD'
scene.display.shading.background_color = (0.12, 0.12, 0.12)
scene.display.shading.show_shadows = True
scene.display.shading.show_cavity = False
scene.display.shading.show_object_outline = False
scene.view_settings.view_transform = 'Standard'
scene.world = scene.world or bpy.data.worlds.new('Inspection_World')
scene.world.color = (0.12, 0.12, 0.12)

camera_data = bpy.data.cameras.new('Inspection_Camera')
camera = bpy.data.objects.new('Inspection_Camera', camera_data)
helpers = bpy.data.collections.new('02_Inspection_Camera')
scene.collection.children.link(helpers)
helpers.objects.link(camera)
camera_data.type = 'ORTHO'
camera_data.ortho_scale = radius * 1.16
camera_data.clip_start = radius * 0.001
camera_data.clip_end = radius * 100
scene.camera = camera

for label, y in [('view_negative_y', -1), ('view_positive_y', 1)]:
    camera.location = center + Vector((0, y * radius * 4, 0))
    camera.rotation_euler = (center - camera.location).to_track_quat('-Z', 'Y').to_euler()
    scene.render.filepath = str(PREVIEW / (label + '.png'))
    bpy.ops.render.render(write_still=True)

# Material Preview is available with Eevee, not with Workbench as the scene engine.
for engine in ('BLENDER_EEVEE', 'BLENDER_EEVEE_NEXT'):
    try:
        scene.render.engine = engine
        break
    except TypeError:
        continue
else:
    raise RuntimeError('Eevee render engine unavailable')
camera.location = center + Vector((0, -radius * 4, 0))
camera.rotation_euler = (center - camera.location).to_track_quat('-Z', 'Y').to_euler()
camera.hide_set(True)

for obj in scene.objects:
    obj.select_set(False)
for obj in objects:
    obj.select_set(True)
bpy.context.view_layer.objects.active = objects[0]

images = []
for img in bpy.data.images:
    if img.type == 'IMAGE' and img.size[0]:
        if not img.packed_file:
            img.pack()
        images.append({'name': img.name, 'width': img.size[0], 'height': img.size[1], 'packed': bool(img.packed_file)})

for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type == 'VIEW_3D':
            space = area.spaces.active
            space.shading.type = 'SOLID'
            space.shading.color_type = 'TEXTURE'
            space.shading.use_scene_world = False
            space.shading.use_scene_lights = False
            space.overlay.show_floor = False
            space.overlay.show_axis_x = False
            space.overlay.show_axis_y = False
            space.overlay.show_stats = True
            space.clip_start = radius * 0.001
            space.clip_end = radius * 100
            region = space.region_3d
            region.view_location = center
            region.view_distance = radius * 1.8
            region.view_rotation = camera.rotation_euler.to_quaternion()
            region.view_perspective = 'ORTHO'

report = {
    'blender_version': bpy.app.version_string,
    'source_file': str(SOURCE),
    'source_sha256': source_hash,
    'mesh_objects': len(objects),
    'vertices': sum(len(o.data.vertices) for o in objects),
    'polygons': sum(len(o.data.polygons) for o in objects),
    'materials': len([m for m in bpy.data.materials if m.users]),
    'images': images,
    'world_bounds_min': list(lo),
    'world_bounds_max': list(hi),
    'dimensions_in_import_units': list(extent),
    'interface_language': prefs.view.language,
    'render_engine': scene.render.engine,
    'geometry_modified': False,
    'material_nodes_modified': False,
    'physical_scale_calibrated': False,
    'preview_kind': 'Blender Workbench textured inspection render, not a desktop screenshot',
}
(OUT / '导入报告.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
bpy.ops.wm.save_as_mainfile(filepath=str(OUT / 'Nokia3310_导入工作副本.blend'), compress=True)
assert hashlib.file_digest(SOURCE.open('rb'), 'sha256').hexdigest() == source_hash
print('IMPORT_REPORT ' + json.dumps(report, ensure_ascii=False))
