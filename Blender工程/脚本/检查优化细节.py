import bpy,bmesh,json
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'Blender工程'/'优化检查'
scene=bpy.context.scene
report={}
for name in ['Body_Glass_Optimized','Keycap_2','Screen_Display','Screen_Frame','Nokia_Badge']:
    ob=bpy.data.objects[name];bm=bmesh.new();bm.from_mesh(ob.data)
    report[name]={'volume':bm.calc_volume(signed=True),'nonmanifold_edges':sum(not e.is_manifold for e in bm.edges)};bm.free()
print(json.dumps(report))
scene.render.engine='BLENDER_WORKBENCH'
scene.display.shading.color_type='MATERIAL';scene.display.shading.light='STUDIO'
scene.display.shading.background_type='WORLD';scene.world.color=(.075,.075,.075)
scene.view_settings.view_transform='Standard'
camera=scene.camera;camera.location=(0,-3,.29);target=Vector((0,0,.29));camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.ortho_scale=.62
scene.render.resolution_x=1300;scene.render.resolution_y=1300
scene.render.filepath=str(OUT/'02_按键文字与几何检查.png')
bpy.ops.render.render(write_still=True)
