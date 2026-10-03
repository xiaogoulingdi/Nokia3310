import bpy
import json
from pathlib import Path

OUT=Path(__file__).resolve().parents[1]
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':
            s=area.spaces.active.shading
            s.type='SOLID'
            s.color_type='TEXTURE'
            s.light='STUDIO'
            s.show_cavity=False
            s.show_shadows=True
bpy.context.preferences.filepaths.save_version=1
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'Nokia3310_导入工作副本.blend'),compress=True)
report_path=OUT/'导入报告.json'
report=json.loads(report_path.read_text(encoding='utf-8'))
report['startup_viewport']='SOLID with TEXTURE colors; original PBR material nodes preserved'
report['material_preview_gui_verified']=False
report_path.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print('Lightweight textured viewport saved; PBR materials preserved.')
