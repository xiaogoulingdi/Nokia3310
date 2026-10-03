"""Preserve the imported silhouette; rebuild readable, independently animated controls."""
import bpy, bmesh, math, json, hashlib
import numpy as np
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'Blender工程'
CHECK=OUT/'优化检查'
EXPORT=OUT/'网页模型'
for folder in (CHECK, EXPORT): folder.mkdir(exist_ok=True)
source=ROOT/'参考资料'/'nokia3310_混元原始.glb'
source_hash=hashlib.file_digest(source.open('rb'),'sha256').hexdigest()
scene=bpy.context.scene
original=next(o for o in scene.objects if o.type=='MESH')
original.name='Reference_Hunyuan_Original'
reference_collection=original.users_collection[0]
reference_collection.name='00_Reference_Original_Hidden'
reference_collection.hide_render=True
reference_collection.hide_viewport=True
for other in list(scene.objects):
    if other!=original: bpy.data.objects.remove(other,do_unlink=True)

def collection(name):
    col=bpy.data.collections.new(name);scene.collection.children.link(col);return col
body_col=collection('01_Phone_Body')
keys_col=collection('02_Independent_Keys')
screen_col=collection('03_Dynamic_Screen')
details_col=collection('04_Legends_and_Details')
studio_col=collection('90_Studio')

def relink(obj,col):
    for prev in list(obj.users_collection):prev.objects.unlink(obj)
    col.objects.link(obj)

root=bpy.data.objects.new('Phone_Root',None);body_col.objects.link(root)
root.empty_display_type='PLAIN_AXES'
root['asset']='Nokia 3310-inspired interactive glass phone'
root['front_axis']='-Y';root['up_axis']='Z'
root['mode_note']='Showcase_Rotate for presentation; stop animation and face -Y for interaction.'

def material(name,color,metal=0,rough=.3,transmission=0,emission=0):
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
    p.inputs['Transmission Weight'].default_value=transmission
    p.inputs['IOR'].default_value=1.47
    p.inputs['Coat Weight'].default_value=.22
    if emission:
        p.inputs['Emission Color'].default_value=(*color,1);p.inputs['Emission Strength'].default_value=emission
    return m

glass=material('Glass_Clear_IOR_1_47',(.86,.94,1),rough=.05,transmission=1)
key_glass=material('Key_Frosted_Clear',(.72,.87,.95),rough=.14,transmission=.88)
from io_scene_gltf2.blender.com.material_helpers import create_settings_group
gltf_group=create_settings_group('glTF Material Output')
for mat,thickness,dispersion in [(glass,.16,.8),(key_glass,.015,.15)]:
    node=mat.node_tree.nodes.new('ShaderNodeGroup');node.node_tree=gltf_group;node.label='Web glass thickness / dispersion';node.location=(-250,-250)
    node.inputs['Thickness'].default_value=thickness;node.inputs['Dispersion'].default_value=dispersion
glass.node_tree.nodes.get('Principled BSDF').inputs['Thin Film Thickness'].default_value=420
glass.node_tree.nodes.get('Principled BSDF').inputs['Thin Film IOR'].default_value=1.33
dark=material('Legend_Graphite',(.012,.025,.034),rough=.37)
rim_mat=material('Socket_Graphite',(.018,.03,.038),metal=.42,rough=.24)
logo_plate_mat=material('Badge_Graphite',(.022,.032,.04),rough=.29)
white=material('Legend_Silver',(.82,.89,.93),metal=.25,rough=.23)
accent=material('Navi_Cyan',(.04,.46,.62),metal=.16,rough=.25,emission=.10)
lcd_mat=material('LCD_Backlight',(.40,.52,.20),rough=.65,emission=.30)
pixel_mat=material('LCD_Pixels',(.025,.055,.027),rough=.7)

def finish(obj,mat,col,parent=root,smooth=True):
    relink(obj,col)
    if mat:obj.data.materials.append(mat)
    if parent:obj.parent=parent
    if obj.type=='MESH':
        for p in obj.data.polygons:p.use_smooth=smooth
    return obj

# All geometry in the edited copy uses the imported world coordinates.
body=bpy.data.objects.new('Body_Glass_Optimized',original.data.copy());body_col.objects.link(body)
body.matrix_world=original.matrix_world.copy()
bpy.context.view_layer.objects.active=body
body.select_set(True)
bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
body.data.materials.clear();body.data.materials.append(glass)
body.parent=root
world_vertices=[v.co.copy() for v in body.data.vertices]
bvh=BVHTree.FromPolygons(world_vertices,[tuple(p.vertices) for p in body.data.polygons],all_triangles=True)
def front_y(x,z):
    hit=bvh.ray_cast(Vector((x,-1,z)),Vector((0,1,0)))
    return hit[0].y if hit[0] else -.08

numeric=[]
rows=[(.383,.372),(.294,.282),(.210,.194),(.131,.116)]
legend_rows=[('1','2','3'),('4','5','6'),('7','8','9'),('*','0','#')]
letters={'1':'','2':'abc','3':'def','4':'ghi','5':'jkl','6':'mno','7':'pqrs','8':'tuv','9':'wxyz','*':'+','0':'','':'','#':''}
for row,(outer_z,center_z) in enumerate(rows):
    for col,x in enumerate([-.120,-.001,.118]):
        digit=legend_rows[row][col]
        numeric.append({'id':digit,'x':x,'z':center_z if col==1 else outer_z,'a':.0465,'b':.0265,'tilt':0 if col==1 else (-.32 if col==0 else .32)})

# Fit the uninterrupted keypad deck between the generated keys, then remove their relief.
deck_samples=[];deck_values=[]
for x in np.linspace(-.17,.17,55):
    for z in np.linspace(.05,.44,65):
        near_key=False
        for key in numeric:
            dx,dz=x-key['x'],z-key['z'];c,s=math.cos(key['tilt']),math.sin(key['tilt'])
            u=c*dx+s*dz;w=-s*dx+c*dz
            if (u/(key['a']*1.32))**2+(w/(key['b']*1.32))**2<1:near_key=True;break
        if not near_key:
            deck_samples.append([1,z,z*z,x*x,x*x*z]);deck_values.append(front_y(float(x),float(z)))
deck_coeff=np.linalg.lstsq(np.array(deck_samples),np.array(deck_values),rcond=None)[0]
def deck_y(x,z):return float(np.dot(deck_coeff,[1,z,z*z,x*x,x*x*z]))
def smoothstep(v):v=min(1,max(0,v));return v*v*(3-2*v)
for v in body.data.vertices:
    x,y,z=v.co
    if y>-.025:continue
    if .01<z<.46 and abs(x)<.193:
        blend=smoothstep((.193-abs(x))/.027)*smoothstep((z-.01)/.025)*smoothstep((.46-z)/.026)
        v.co.y=y*(1-blend)+deck_y(x,z)*blend
bm=bmesh.new();bm.from_mesh(body.data)
bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.000001)
bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
bm.to_mesh(body.data);bm.free()
smooth=body.modifiers.new('Gentle_surface_relax','SMOOTH');smooth.factor=.55;smooth.iterations=3
bpy.ops.object.modifier_apply(modifier=smooth.name)
dec=body.modifiers.new('Web_triangle_budget','DECIMATE');dec.ratio=.14
bpy.ops.object.modifier_apply(modifier=dec.name)
for polygon in body.data.polygons:polygon.use_smooth=True
body['source_triangles']=499970
body['optimization']='Position seams merged, keypad deck fitted between old keys, old relief flattened, gentle smoothing, 14 percent decimation.'

def ellipse_mesh(name,a,b,depth,mat,col,location=(0,0,0),tilt=0,parent=root):
    segments=40
    rings=[(.91,depth/2),(1,depth*.10),(.96,-depth*.31),(.72,-depth*.49),(.28,-depth*.55)]
    vertices=[];faces=[]
    for radius,y in rings:
        for i in range(segments):
            t=math.tau*i/segments;vertices.append((a*radius*math.cos(t),y,b*radius*math.sin(t)))
    for ring in range(len(rings)-1):
        for i in range(segments):
            j=(i+1)%segments;a0=ring*segments+i;b0=ring*segments+j
            faces.append((a0,b0,b0+segments,a0+segments))
    faces.append(tuple(reversed(range(segments))))
    faces.append(tuple((len(rings)-1)*segments+i for i in range(segments)))
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(vertices,[],faces);mesh.update()
    obj=bpy.data.objects.new(name,mesh);col.objects.link(obj)
    obj.location=location;obj.rotation_euler[1]=-tilt
    obj.parent=parent;obj.data.materials.append(mat)
    for p in mesh.polygons:p.use_smooth=True
    return obj

def rounded_outline(w,h,r,steps=10):
    points=[]
    for cx,cz,start in [(w/2-r,h/2-r,0),(-w/2+r,h/2-r,90),(-w/2+r,-h/2+r,180),(w/2-r,-h/2+r,270)]:
        for i in range(steps):
            t=math.radians(start+i*90/(steps-1));points.append((cx+r*math.cos(t),cz+r*math.sin(t)))
    return points

def plate(name,w,h,depth,r,location,mat,col,parent=root):
    pts=rounded_outline(w,h,r);n=len(pts)
    verts=[(x,y,z) for y in [-depth/2,depth/2] for x,z in pts]
    faces=[tuple(range(n)),tuple(range(2*n-1,n-1,-1))]
    faces += [(i+n,(i+1)%n+n,(i+1)%n,i) for i in range(n)]
    me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update()
    ob=bpy.data.objects.new(name,me);col.objects.link(ob);ob.parent=parent;ob.location=location;me.materials.append(mat)
    bevel=ob.modifiers.new('Micro_edge_bevel','BEVEL');bevel.width=min(depth*.3,.001);bevel.segments=3
    bevel.affect='EDGES'
    return ob

def shaped_key(name,points,depth,parent):
    outline=[]
    for i,p in enumerate(points):
        prev,nxt=Vector(points[i-1]),Vector(points[(i+1)%len(points)]);corner=Vector(p)
        start=corner.lerp(prev,.22);end=corner.lerp(nxt,.22)
        for j in range(8):
            t=j/8;v=(1-t)**2*start+2*t*(1-t)*corner+t*t*end;outline.append(tuple(v))
    area=sum(outline[i][0]*outline[(i+1)%len(outline)][1]-outline[(i+1)%len(outline)][0]*outline[i][1] for i in range(len(outline)))
    if area<0:outline.reverse()
    n=len(outline);verts=[];faces=[]
    for radius,y in [(.93,depth*.5),(1,0),(.94,-depth*.40),(.70,-depth*.51)]:
        verts.extend([(x*radius,y,z*radius) for x,z in outline])
    for r in range(3):
        for i in range(n):faces.append((r*n+i,r*n+(i+1)%n,(r+1)*n+(i+1)%n,(r+1)*n+i))
    faces.extend([tuple(range(n-1,-1,-1)),tuple(range(3*n,4*n))])
    me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update()
    ob=bpy.data.objects.new(name,me);keys_col.objects.link(ob);ob.parent=parent;me.materials.append(key_glass)
    for p in me.polygons:p.use_smooth=True
    return ob

font_path=Path('C:/Windows/Fonts/arialbd.ttf')
font=bpy.data.fonts.load(str(font_path)) if font_path.exists() else None
def text(name,string,size,location,mat,parent=root,col=details_col,align='CENTER'):
    curve=bpy.data.curves.new(name,'FONT');curve.body=string;curve.size=size;curve.align_x=align;curve.align_y='CENTER'
    curve.resolution_u=6;curve.extrude=.00006;curve.bevel_depth=0
    if font:curve.font=font
    ob=bpy.data.objects.new(name,curve);col.objects.link(ob);ob.parent=parent;ob.location=location
    ob.rotation_euler[0]=math.pi/2;curve.materials.append(mat)
    return ob

keys=[]
for key in numeric:
    code={'*':'Star','#':'Hash'}.get(key['id'],key['id'])
    x,z=key['x'],key['z'];y=deck_y(x,z)-.0035
    socket=ellipse_mesh('Socket_'+code,key['a']*1.09,key['b']*1.10,.006,rim_mat,keys_col,(x,y+.003,z),key['tilt'])
    parent=bpy.data.objects.new('Key_'+code,None);keys_col.objects.link(parent);parent.parent=root
    parent.location=(x,y-.001,z);parent.rotation_euler[1]=-key['tilt'];parent.empty_display_size=.015
    parent['key_id']=key['id'];parent['press_axis']='+Y';parent['press_travel']=.004
    cap=ellipse_mesh('Keycap_'+code,key['a'],key['b'],.015,key_glass,keys_col,parent=parent)
    label=key['id'];sub=letters[label]
    text('Digit_'+code,label,.029,(0,-.0090,.005 if sub else .0),dark,parent,keys_col)
    if sub:text('Letters_'+code,sub,.012,(0,-.0092,-.0115),dark,parent,keys_col)
    keys.append(parent)

# Distinct controls under the display, with exact text rather than generated marks.
menu=bpy.data.objects.new('Key_Menu',None);keys_col.objects.link(menu);menu.parent=root;menu.location=(0,-.105,.556)
menu['key_id']='menu';menu['press_axis']='+Y';menu['press_travel']=.003
ellipse_mesh('Keycap_Menu',.074,.019,.014,key_glass,keys_col,parent=menu)
plate('Navi_Cyan_Bar',.044,.004,.001,.0015,(0,-.0083,0),accent,keys_col,menu);keys.append(menu)
clear=bpy.data.objects.new('Key_Clear',None);keys_col.objects.link(clear);clear.parent=root;clear.location=(-.096,-.099,.499)
clear['key_id']='clear';clear['press_axis']='+Y';clear['press_travel']=.003
shaped_key('Keycap_Clear',[(-.043,.015),(-.022,.036),(.044,-.001),(.012,-.040),(-.012,-.022)],.015,clear)
text('Legend_Clear','C',.024,(0,-.009,0),dark,clear,keys_col);keys.append(clear)
rocker=bpy.data.objects.new('Key_Scroll',None);keys_col.objects.link(rocker);rocker.parent=root;rocker.location=(.085,-.100,.490)
rocker['key_id']='scroll';rocker['actions']='up,down';rocker['press_axis']='+Y';rocker['press_travel']=.003
shaped_key('Keycap_Scroll',[(-.05,-.048),(-.053,.017),(.044,.056),(.065,.040),(.045,-.006),(.010,-.034)],.016,rocker)
text('Legend_Up','>',.020,(.028,-.010,.025),dark,rocker,keys_col)
text('Legend_Down','<',.020,(-.021,-.010,-.016),dark,rocker,keys_col);keys.append(rocker)

badge=plate('Nokia_Badge',.124,.026,.0025,.002,(0,-.0825,.936),logo_plate_mat,details_col)
text('Nokia_Legend','NOKIA',.023,(0,-.0844,.936),white)
text('Model_Mark','3310',.0105,(0,deck_y(0,.054)-.001,.054),dark)

# A separate screen surface with a conventional 0..1 UV map for a browser CanvasTexture.
bezel=plate('Screen_Frame',.300,.253,.008,.015,(0,-.087,.735),rim_mat,screen_col)
screen=plate('Screen_Display',.276,.229,.0015,.010,(0,-.092,.735),lcd_mat,screen_col)
screen['role']='dynamic_display';screen['pixel_width']=84;screen['pixel_height']=48
screen['replace_material_with']='CanvasTexture or render target in the web application'
uv=screen.data.uv_layers.new(name='ScreenUV')
for poly in screen.data.polygons:
    for loop_index in poly.loop_indices:
        co=screen.data.vertices[screen.data.loops[loop_index].vertex_index].co
        uv.data[loop_index].uv=(co.x/.276+.5,co.z/.229+.5)

glyphs={
 'N':['10001','11001','10101','10011','10001','10001','10001'],
 'O':['01110','10001','10001','10001','10001','10001','01110'],
 'K':['10001','10010','10100','11000','10100','10010','10001'],
 'I':['111','010','010','010','010','010','111'],
 'A':['01110','10001','10001','11111','10001','10001','10001'],
 'M':['10001','11011','10101','10101','10001','10001','10001'],
 'E':['11111','10000','10000','11110','10000','10000','11111'],
 'U':['10001','10001','10001','10001','10001','10001','01110'],
 '1':['010','110','010','010','010','010','111'],
 '2':['11110','00001','00001','01110','10000','10000','11111'],
 '4':['00010','00110','01010','10010','11111','00010','00010'],
 '5':['11111','10000','10000','11110','00001','00001','11110'],
 ':':['0','1','0','0','1','0','0']}
pixels=set()
def draw_word(word,x,y):
    for ch in word:
        g=glyphs[ch]
        for row,line in enumerate(g):
            for col,bit in enumerate(line):
                if bit=='1':pixels.add((x+col,y+row))
        x+=len(g[0])+1
draw_word('12:45',47,3);draw_word('NOKIA',27,15);draw_word('MENU',31,37)
for bar in range(4):
    for x in range(4+bar*3,6+bar*3):
        for y in range(10-bar*2,13):pixels.add((x,y))
for x in range(73,81):
    for y in range(4,10):
        if x in [73,80] or y in [4,9]:pixels.add((x,y))
for x in range(75,79):
    for y in range(6,8):pixels.add((x,y))
for x,y in [(34,28),(35,28),(36,28),(37,28),(38,28),(38,27),(38,26),(39,26),(40,26),(41,26),(45,28)]:
    for dx in [0,1]:
        for dy in [0,1]:pixels.add((x+dx,y+dy))
verts=[];faces=[]
for px,py in sorted(pixels):
    x=(px-42)*.00310;z=(24-py)*.00435
    i=len(verts);verts.extend([(x,-.00095,z),(x+.0028,-.00095,z),(x+.0028,-.00095,z-.0039),(x,-.00095,z-.0039)])
    faces.append((i,i+1,i+2,i+3))
me=bpy.data.meshes.new('LCD_Pixel_Preview');me.from_pydata(verts,[],faces);me.update()
pixel_obj=bpy.data.objects.new('Screen_Preview_Pixels',me);screen_col.objects.link(pixel_obj)
pixel_obj.parent=screen;me.materials.append(pixel_mat)
pixel_obj['role']='preview_only_hide_when_dynamic_screen_is_enabled'

# Convert precise font legends to meshes for self-contained GLB export.
for ob in list(scene.objects):
    if ob.type=='FONT':
        bpy.ops.object.select_all(action='DESELECT');ob.select_set(True);bpy.context.view_layer.objects.active=ob
        bpy.ops.object.convert(target='MESH')

# Add independent key press clips and an optional turntable clip.
scene.frame_start=1;scene.frame_end=240;scene.render.fps=30
for key in keys:
    rest=key.location.copy()
    for frame,press in [(1,0),(4,1),(8,1),(12,0)]:
        key.location=rest+Vector((0,key['press_travel']*press,0));key.keyframe_insert(data_path='location',frame=frame)
    key.location=rest;action=key.animation_data.action;action.name='Press_'+key.name.removeprefix('Key_')
    track=key.animation_data.nla_tracks.new();track.name=action.name
    track.strips.new(action.name,1,action);track.mute=True
    key.animation_data.action=None
root.rotation_euler=(0,0,0);root.keyframe_insert(data_path='rotation_euler',frame=1)
root.rotation_euler[2]=math.tau;root.keyframe_insert(data_path='rotation_euler',frame=241)
action=root.animation_data.action;action.name='Showcase_Rotate'
for layer in action.layers:
    for strip in layer.strips:
        for bag in strip.channelbags:
            for fcurve in bag.fcurves:
                for point in fcurve.keyframe_points:point.interpolation='LINEAR'
track=root.animation_data.nla_tracks.new();track.name='Showcase_Rotate';track.strips.new(action.name,1,action);track.mute=True
root.animation_data.action=None;root.rotation_euler=(0,0,0)
scene.frame_set(1)

# Controlled studio illumination. Color fringes here are lighting, not spectral dispersion.
world=bpy.data.worlds.new('Glass_Studio_World');world.use_nodes=True
world.node_tree.nodes['Background'].inputs[0].default_value=(.008,.011,.018,1)
world.node_tree.nodes['Background'].inputs[1].default_value=.12;scene.world=world
def area(name,location,energy,color,size,size_y,target=(0,0,.60)):
    data=bpy.data.lights.new(name,'AREA');data.energy=energy;data.color=color;data.shape='RECTANGLE';data.size=size;data.size_y=size_y
    ob=bpy.data.objects.new(name,data);studio_col.objects.link(ob);ob.location=location
    ob.rotation_euler=(Vector(target)-ob.location).to_track_quat('-Z','Y').to_euler();return ob
area('Key_Softbox',(-1.1,-1.3,1.65),130,(.84,.92,1),.75,1.9)
area('Rim_White',(1.0,.25,1.0),180,(1,1,1),.15,1.8)
area('Rim_Cyan',(-.68,.45,.67),70,(.05,.65,1),.12,1.5)
area('Rim_Amber',(.60,.38,.47),55,(1,.36,.06),.10,1.3)
area('Top_Strip',(0,-.1,1.85),85,(1,.94,.83),.8,.16)
camera_data=bpy.data.cameras.new('Camera_Product');camera=bpy.data.objects.new('Camera_Product',camera_data);studio_col.objects.link(camera)
camera.location=(1.15,-3.4,1.10);target=Vector((0,0,.595));camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
camera_data.type='ORTHO';camera_data.ortho_scale=1.48;scene.camera=camera
scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=48
scene.cycles.use_denoising=True;scene.cycles.max_bounces=12;scene.cycles.transmission_bounces=10
scene.cycles.preview_samples=32;scene.cycles.use_preview_denoising=True
scene.render.resolution_x=1000;scene.render.resolution_y=1300;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.film_transparent=False
scene.view_settings.view_transform='AgX'
scene.render.filepath=str(CHECK/'01_玻璃模型_三分之四视角.png')
for screen_ui in bpy.data.screens:
    for a in screen_ui.areas:
        if a.type=='VIEW_3D':
            sp=a.spaces.active;sp.shading.type='RENDERED';sp.shading.color_type='MATERIAL';sp.shading.light='STUDIO'
            sp.shading.use_scene_lights_render=True;sp.shading.use_scene_world_render=True
            sp.overlay.show_floor=False;sp.overlay.show_axis_x=False;sp.overlay.show_axis_y=False;sp.overlay.show_stats=True
            sp.overlay.show_extras=False;sp.overlay.show_relationship_lines=False
            sp.overlay.show_overlays=False
            sp.region_3d.view_location=target;sp.region_3d.view_distance=2.1;sp.region_3d.view_rotation=camera.rotation_euler.to_quaternion();sp.region_3d.view_perspective='CAMERA'
            sp.region_3d.view_camera_zoom=8;sp.region_3d.view_camera_offset=(0,0)
for ob in studio_col.objects:ob.hide_set(False)
for ob in scene.objects:
    if ob.type=='EMPTY':ob.empty_display_size=.012
bpy.ops.object.select_all(action='DESELECT');body.select_set(True);bpy.context.view_layer.objects.active=body

asset_objects=[o for o in scene.objects if o!=original and o not in list(studio_col.objects)]
scene['workflow']='Original hidden reference + optimized body + independent controls + dynamic display + optional animation clips.'
scene['glass_note']='Blender preview uses thin-film interference and colored studio lights. GLB includes volume and dispersion extensions; browser support and final appearance must be verified.'
blend_path=OUT/'Nokia3310_交互优化_v1.blend'
bpy.ops.wm.save_as_mainfile(filepath=str(blend_path),compress=True)

# Export only the edited asset. Muted NLA tracks are enabled for export then restored.
for ob in asset_objects:ob.select_set(True)
for ob in asset_objects:
    if ob.animation_data:
        for t in ob.animation_data.nla_tracks:t.mute=False
export_options={'filepath':str(EXPORT/'nokia3310_interactive_v1.glb'),'export_format':'GLB','use_selection':True,'export_extras':True,'export_animations':True,'export_animation_mode':'NLA_TRACKS','export_apply':True,'export_force_sampling':True}
properties=bpy.ops.export_scene.gltf.get_rna_type().properties
export_options={k:v for k,v in export_options.items() if k in properties}
bpy.ops.export_scene.gltf(**export_options)
for ob in asset_objects:
    if ob.animation_data:
        for t in ob.animation_data.nla_tracks:t.mute=True
scene.frame_set(1);root.rotation_euler=(0,0,0)
triangles=0
for ob in asset_objects:
    if ob.type=='MESH':ob.data.calc_loop_triangles();triangles+=len(ob.data.loop_triangles)
report={'source_sha256':source_hash,'original_triangles':499970,'body_triangles':len(body.data.polygons),'asset_triangles_before_bevel_evaluation':triangles,'independent_press_controls':len(keys),'key_ids':[key['key_id'] for key in keys],'screen_object':screen.name,'screen_uv':True,'animation_clips':['Showcase_Rotate']+['Press_'+k.name.removeprefix('Key_') for k in keys],'units_note':'Imported proportions preserved; not a measured CAD reconstruction.','material_note':scene['glass_note'],'blend_file':str(blend_path),'glb_file':export_options['filepath']}
(CHECK/'优化报告.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
assert hashlib.file_digest(source.open('rb'),'sha256').hexdigest()==source_hash
print('OPTIMIZED_REPORT',json.dumps(report,ensure_ascii=False))
bpy.ops.render.render(write_still=True)
# A direct front render allows checking the full keypad without the three-quarter perspective.
camera.location=(0,-3.4,.595);camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
scene.render.filepath=str(CHECK/'03_玻璃模型_正面.png')
bpy.ops.render.render(write_still=True)
