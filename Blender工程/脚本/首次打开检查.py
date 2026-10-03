import bpy
import json
from pathlib import Path

OUT = Path(__file__).resolve().parents[1]

def capture_imported_workspace():
    windows = list(bpy.context.window_manager.windows)
    if not windows:
        return 2.0
    window = windows[0]
    state = {
        'blend_file': bpy.data.filepath,
        'language': bpy.context.preferences.view.language,
        'windows': len(windows),
        'mesh_objects': [o.name for o in bpy.context.scene.objects if o.type == 'MESH'],
        'material_preview_areas': sum(a.type == 'VIEW_3D' and a.spaces.active.shading.type == 'MATERIAL' for a in window.screen.areas),
        'viewport_modes': [a.spaces.active.shading.type for a in window.screen.areas if a.type == 'VIEW_3D'],
    }
    try:
        with bpy.context.temp_override(window=window):
            result = bpy.ops.screen.screenshot(filepath=str(OUT / '导入检查' / 'Blender已导入_界面截图.png'))
        state['screenshot_result'] = sorted(result)
    except Exception as exc:
        state['screenshot_error'] = str(exc)
    (OUT / '桌面打开状态.json').write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding='utf-8')
    return None

bpy.app.timers.register(capture_imported_workspace, first_interval=6.0)
