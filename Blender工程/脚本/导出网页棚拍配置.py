"""Read the actual saved studio; export lighting without modifying the blend."""
import bpy
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
scene = bpy.context.scene
def vec(value):
    return [round(float(x), 7) for x in value]

lights = []
for ob in scene.objects:
    if ob.type == 'LIGHT' and ob.data.type == 'AREA':
        lights.append({'name': ob.name, 'position': vec(ob.matrix_world.translation),
                       'quaternion': vec(ob.matrix_world.to_quaternion()),
                       'width': ob.data.size, 'height': ob.data.size_y,
                       'power': ob.data.energy, 'color': vec(ob.data.color)})
materials = {}
for mat in bpy.data.materials:
    if not mat.use_nodes:
        continue
    p = next((n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
    if p:
        values = {}
        for name in ['Base Color', 'Metallic', 'Roughness', 'IOR', 'Transmission Weight',
                     'Coat Weight', 'Thin Film Thickness', 'Thin Film IOR', 'Emission Strength']:
            if name in p.inputs:
                val = p.inputs[name].default_value
                values[name] = vec(val) if hasattr(val, '__len__') else val
        materials[mat.name] = values
world = scene.world.node_tree.nodes.get('Background')
report = {'source': Path(bpy.data.filepath).name, 'blenderVersion': bpy.app.version_string,
          'coordinateSystem': 'Blender Z-up; map (x,y,z) to glTF (x,z,-y)',
          'lights': lights, 'worldColor': vec(world.inputs[0].default_value),
          'worldStrength': world.inputs[1].default_value,
          'viewTransform': scene.view_settings.view_transform, 'materials': materials,
          'camera': {'position': vec(scene.camera.location), 'type': scene.camera.data.type,
                     'orthographicScale': scene.camera.data.ortho_scale}}
dest = ROOT / 'web/assets/studio.json'
dest.parent.mkdir(exist_ok=True)
dest.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('STUDIO_EXPORTED', json.dumps({'lights': lights, 'camera': report['camera'], 'viewTransform': report['viewTransform']}, ensure_ascii=False))
for name in ['Body_Glass_Optimized','Keycap_Clear','Keycap_Scroll','Legend_Clear','Legend_Up','Legend_Down']:
    ob = bpy.data.objects.get(name)
    if ob:
        print('PART', name, 'position', vec(ob.matrix_world.translation), 'dimensions', vec(ob.dimensions))
