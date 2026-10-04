"""Run through Blender MCP against v1; save a separate v2 and never change v1."""
import bpy
import bmesh
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
scene = bpy.context.scene
assert Path(bpy.data.filepath).name == 'Nokia3310_交互优化_v1.blend', 'Open v1 first; do not apply twice.'
body = bpy.data.objects['Body_Glass_Optimized']

def smooth(v):
    v = min(1, max(0, v))
    return v * v * (3 - 2 * v)

# The v1 numeric deck ended at z=.46, leaving the AI-generated C/rocker relief.
# Move vertices without deleting faces, retaining the closed glass shell.
edited = 0
for vertex in body.data.vertices:
    x, y, z = vertex.co
    if y < -.025 and .435 < z < .552 and abs(x) < .176:
        weight = smooth((.176-abs(x))/.018) * smooth((z-.435)/.020) * smooth((.552-z)/.018)
        deck = -.0938 - (z-.435)*.058 + .43*x*x
        vertex.co.y = y * (1-weight) + deck * weight
        edited += 1
bm = bmesh.new()
bm.from_mesh(body.data)
bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
non_manifold = sum(not edge.is_manifold for edge in bm.edges)
bm.to_mesh(body.data)
bm.free()
body.data.update()

function_material = bpy.data.materials['Key_Frosted_Clear'].copy()
function_material.name = 'Key_Function_Satin'
principled = function_material.node_tree.nodes.get('Principled BSDF')
principled.inputs['Roughness'].default_value = .26
principled.inputs['Transmission Weight'].default_value = .42
principled.inputs['Coat Weight'].default_value = .12
for name in ('Keycap_Clear', 'Keycap_Scroll'):
    bpy.data.objects[name].data.materials[0] = function_material

# Keep clearance throughout the press travel; update the clip and rest transform.
for name in ('Key_Clear', 'Key_Scroll'):
    key = bpy.data.objects[name]
    key.location.y -= .005
    for track in key.animation_data.nla_tracks:
        for nla_strip in track.strips:
            for layer in nla_strip.action.layers:
                for strip in layer.strips:
                    for bag in strip.channelbags:
                        for curve in bag.fcurves:
                            if curve.data_path == 'location' and curve.array_index == 1:
                                for point in curve.keyframe_points:
                                    point.co.y -= .005
                                    point.handle_left.y -= .005
                                    point.handle_right.y -= .005

# Use upright arrow silhouettes rather than rotated text glyphs on the rocker.
for name, cx, cz, direction in [('Legend_Up', .028, .025, 1), ('Legend_Down', -.021, -.016, -1)]:
    obj = bpy.data.objects[name]
    mesh = bpy.data.meshes.new(name + '_Arrow')
    mesh.from_pydata([(-.0055, 0, -.003*direction), (.0055, 0, -.003*direction),
                      (0, 0, .0048*direction)], [], [(0, 1, 2) if direction == 1 else (2, 1, 0)])
    mesh.materials.append(bpy.data.materials['Legend_Graphite'])
    obj.data = mesh
    obj.location = (cx, -.0108, cz)
    obj.rotation_euler = (0, 0, 0)
    obj.scale = (1, 1, 1)

# Avoid switching the user's viewport into a costly live Cycles render on opening.
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type == 'VIEW_3D':
            area.spaces.active.shading.type = 'MATERIAL'
            area.spaces.active.shading.use_scene_lights = True
            area.spaces.active.shading.use_scene_world = True

assets = [obj for obj in scene.objects if obj.name != 'Reference_Hunyuan_Original'
          and all(col.name != '90_Studio' and not col.name.startswith('00_Reference') for col in obj.users_collection)]
for name in ('polyhaven', 'hyper3d', 'hunyuan3d', 'sketchfab', 'tripo', 'polypizza'):
    prop = 'blendermcp_use_' + name
    if hasattr(scene, prop): setattr(scene, prop, False)
scene.frame_set(1)
blend = ROOT / 'Blender工程/Nokia3310_交互优化_v2.blend'
out = ROOT / 'Blender工程/网页模型/nokia3310_interactive_v2.glb'
bpy.ops.wm.save_as_mainfile(filepath=str(blend), compress=True)
for obj in scene.objects:
    obj.select_set(False)
for obj in assets:
    obj.select_set(True)
    if obj.animation_data:
        for track in obj.animation_data.nla_tracks: track.mute = False
bpy.ops.export_scene.gltf(filepath=str(out), export_format='GLB', use_selection=True,
    export_extras=True, export_animations=True, export_animation_mode='NLA_TRACKS',
    export_apply=True, export_force_sampling=True)
for obj in assets:
    if obj.animation_data:
        for track in obj.animation_data.nla_tracks: track.mute = True
scene.frame_set(1)
report = {'edited_vertices': edited, 'body_non_manifold_edges': non_manifold,
          'glb_bytes': out.stat().st_size, 'source_preserved': 'Nokia3310_交互优化_v1.blend',
          'changes': ['Flatten original C/scroll relief', 'Satin function key material', 'Upright rocker arrows']}
(ROOT / 'Blender工程/优化检查/v2修正报告.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
exec(compile((ROOT / 'Blender工程/脚本/导出网页棚拍配置.py').read_text(encoding='utf-8'),
    str(ROOT / 'Blender工程/脚本/导出网页棚拍配置.py'), 'exec'))
print(json.dumps(report))
