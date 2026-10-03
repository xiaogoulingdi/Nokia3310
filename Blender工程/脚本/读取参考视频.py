import bpy, json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'Blender工程'/'优化检查'
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene
editor=scene.sequence_editor_create()
strip=editor.strips.new_movie('GlassPhoneReference',str(ROOT/'参考资料'/'video1.mp4'),channel=1,frame_start=1)
scene.render.resolution_x=strip.elements[0].orig_width
scene.render.resolution_y=strip.elements[0].orig_height
scene.render.resolution_percentage=60
scene.render.image_settings.file_format='PNG'
scene.render.use_sequencer=True
scene.view_settings.view_transform='Standard'
print('VIDEO',scene.render.resolution_x,scene.render.resolution_y,strip.frame_final_duration)
for fraction in [0.12,0.42,0.72]:
    frame=max(1,int(strip.frame_final_duration*fraction))
    scene.frame_set(frame)
    scene.render.filepath=str(OUT/f'reference_{frame}.png')
    bpy.ops.render.render(write_still=True)
