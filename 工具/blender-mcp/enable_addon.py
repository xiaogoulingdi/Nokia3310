"""Enable the locally installed MCP add-on; keep external integrations off."""
import bpy
import shutil
from pathlib import Path

prefs = Path(bpy.utils.user_resource('CONFIG')) / 'userpref.blend'
backup = prefs.with_name('userpref.before-blender-mcp.blend')
if prefs.exists() and not backup.exists():
    shutil.copy2(prefs, backup)
bpy.ops.preferences.addon_enable(module='blender_mcp')
bpy.context.preferences.addons['blender_mcp'].preferences.telemetry_consent = False
for name in ('polyhaven', 'hyper3d', 'hunyuan3d', 'sketchfab', 'tripo', 'polypizza'):
    prop = 'blendermcp_use_' + name
    if hasattr(bpy.context.scene, prop):
        setattr(bpy.context.scene, prop, False)
bpy.context.scene.blendermcp_port = 9876
bpy.ops.wm.save_userpref()
print('MCP_ADDON_ENABLED', bpy.context.preferences.addons['blender_mcp'].module)
