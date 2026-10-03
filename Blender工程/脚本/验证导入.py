import bpy
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
report = json.loads((ROOT / 'Blender工程' / '导入报告.json').read_text(encoding='utf-8'))
objects = [o for o in bpy.data.objects if o.type == 'MESH']
images = [i for i in bpy.data.images if i.type == 'IMAGE' and i.size[0]]
assert len(objects) == report['mesh_objects'] == 1
assert sum(len(o.data.polygons) for o in objects) == report['polygons'] == 499970
assert len(images) == 3 and all(i.packed_file and tuple(i.size) == (4096, 4096) for i in images)
assert all(o.data.uv_layers for o in objects)
source = ROOT / '参考资料' / 'nokia3310_混元原始.glb'
assert hashlib.file_digest(source.open('rb'), 'sha256').hexdigest() == report['source_sha256']
views = [a.spaces.active for s in bpy.data.screens for a in s.areas if a.type == 'VIEW_3D']
assert views and all(v.shading.type == 'SOLID' and v.shading.color_type == 'TEXTURE' for v in views)
result = {'saved_blend_reopened': True, 'mesh_count': len(objects), 'triangles': 499970, 'packed_4k_textures': 3,
          'uv_present': True, 'textured_solid_preview_configured': True, 'original_glb_unchanged': True,
          'render_engine': bpy.context.scene.render.engine, 'language': bpy.context.preferences.view.language}
(ROOT / 'Blender工程' / '验证结果.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
print('VERIFIED ' + json.dumps(result, ensure_ascii=False))
