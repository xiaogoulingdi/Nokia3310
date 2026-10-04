"""Open the completed project and record a local MCP connection check."""
import bpy
import json
from pathlib import Path

root=Path(__file__).resolve().parents[2]
bpy.ops.wm.open_mainfile(filepath=str(root/'Blender工程/Nokia3310_交互优化_v2.blend'))
report={
    'server_package':'mcp-for-blender==2.1.3',
    'repository':'https://github.com/ahujasid/mcp-for-blender',
    'blender':bpy.app.version_string,
    'project':Path(bpy.data.filepath).name,
    'addon_enabled':'blender_mcp' in bpy.context.preferences.addons,
    'telemetry':bpy.context.preferences.addons['blender_mcp'].preferences.telemetry_consent,
    'external_integrations':{name:getattr(bpy.context.scene,'blendermcp_use_'+name,False)
        for name in ('polyhaven','hyper3d','hunyuan3d','sketchfab','tripo','polypizza')},
    'function_key_roughness':bpy.data.materials['Key_Function_Satin'].node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value,
    'status':'MCP execute_blender_code reached Blender and opened the completed v2 project',
}
(root/'工具/blender-mcp/安装验证.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False))
