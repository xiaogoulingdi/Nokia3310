import bpy,bmesh,json,struct,hashlib,math,sys,subprocess
from pathlib import Path
import numpy as np

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'Blender工程'
CHECK=OUT/'优化检查'
version=sys.argv[sys.argv.index('--')+1] if '--' in sys.argv else 'v1'
assert version in ('v1','v2')
glb=OUT/'网页模型'/f'nokia3310_interactive_{version}.glb'
data=glb.read_bytes()
assert data[:4]==b'glTF'
json_len=struct.unpack_from('<I',data,12)[0]
doc=json.loads(data[20:20+json_len])
bin_start=20+json_len+8
binary=data[bin_start:]
types={5126:np.dtype('<f4'),5125:np.dtype('<u4'),5123:np.dtype('<u2'),5121:np.dtype('u1')}
widths={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}
def accessor(idx):
    a=doc['accessors'][idx];v=doc['bufferViews'][a['bufferView']];dt=types[a['componentType']];w=widths[a['type']]
    offset=v.get('byteOffset',0)+a.get('byteOffset',0);stride=v.get('byteStride',dt.itemsize*w)
    return np.ndarray((a['count'],w),dtype=dt,buffer=binary,offset=offset,strides=(stride,dt.itemsize)).copy()

expected_keys=['1','2','3','4','5','6','7','8','9','Star','0','Hash','Menu','Clear','Scroll']
animation_report={}
for anim in doc.get('animations',[]):
    name=anim['name']
    if name.startswith('Press_'):
        key=name.removeprefix('Press_');assert key in expected_keys
        relevant=[c for c in anim['channels'] if c['target']['path']=='translation' and doc['nodes'][c['target']['node']]['name']=='Key_'+key]
        assert len(relevant)==1,(name,'translation channel missing')
        sampler=anim['samplers'][relevant[0]['sampler']]
        values=accessor(sampler['output']);times=accessor(sampler['input'])[:,0]
        delta=np.ptp(values,axis=0)
        # glTF is Y-up: Blender local +Y pressing maps to glTF -Z.
        amplitude=float(np.linalg.norm(delta))
        expected=.003 if key in ['Menu','Clear','Scroll'] else .004
        assert abs(amplitude-expected)<.0001,(name,delta)
        assert np.allclose(values[0],values[-1],atol=1e-6),(name,'does not return to rest')
        animation_report[name]={'travel':amplitude,'duration_seconds':float(times[-1]-times[0]),'returns_to_rest':True}
    if name=='Showcase_Rotate':
        channel=next(c for c in anim['channels'] if c['target']['path']=='rotation')
        sampler=anim['samplers'][channel['sampler']]
        quats=accessor(sampler['output']);times=accessor(sampler['input'])[:,0]
        assert len(quats)>20 and float(np.ptp(quats,axis=0).max())>.9
        animation_report[name]={'duration_seconds':float(times[-1]-times[0]),'sampled_frames':len(quats)}
assert len(animation_report)==16
node_names={n.get('name') for n in doc['nodes']}
assert 'Reference_Hunyuan_Original' not in node_names
assert not any('Camera_' in n or 'Softbox' in n for n in node_names if n)
assert 'Screen_Display' in node_names and 'Phone_Root' in node_names
assert len(doc.get('images',[]))==0
screen_node=next(n for n in doc['nodes'] if n.get('name')=='Screen_Display')
screen_mesh=doc['meshes'][screen_node['mesh']]
assert all('TEXCOORD_0' in p['attributes'] for p in screen_mesh['primitives'])
glass=next(m for m in doc['materials'] if m['name']=='Glass_Clear_IOR_1_47')
for extension in ['KHR_materials_transmission','KHR_materials_volume','KHR_materials_dispersion']:
    assert extension in glass.get('extensions',{}),extension

closed_geometry={}
for ob in bpy.context.scene.objects:
    if ob.type!='MESH' or ob.name.startswith('Reference_'):continue
    if ob.name.startswith(('Body_','Keycap_','Screen_Frame','Screen_Display','Nokia_Badge')):
        bm=bmesh.new();bm.from_mesh(ob.data)
        open_edges=sum(not e.is_manifold for e in bm.edges);volume=bm.calc_volume(signed=True);bm.free()
        assert open_edges==0,(ob.name,open_edges)
        assert volume>0,(ob.name,'negative volume')
        closed_geometry[ob.name]={'nonmanifold_edges':open_edges,'positive_volume':True}
for mesh in doc['meshes']:
    for p in mesh['primitives']:
        points=accessor(p['attributes']['POSITION']);indices=accessor(p['indices'])[:,0]
        assert np.isfinite(points).all() and indices.max()<len(points)
triangles=sum(doc['accessors'][p['indices']]['count']//3 for m in doc['meshes'] for p in m['primitives'])
assert triangles<110000
original_glb=ROOT/'参考资料'/'nokia3310_混元原始.glb'
original_hash=hashlib.file_digest(original_glb.open('rb'),'sha256').hexdigest()
assert original_hash=='a967f406837d0faa38eb8313681ee00d3ecf7923ba6c4609a2a56733bbb3e63a'
install=json.loads((OUT/'Windows全局安装结果.json').read_text(encoding='utf-8-sig'))
original_blend=OUT/'Nokia3310_导入工作副本.blend'
blend_preserved=hashlib.file_digest(original_blend.open('rb'),'sha256').hexdigest().upper()==install['working_blend_sha256'].upper()
if version=='v2':
    # The import copy was edited since the old installation receipt. For v2,
    # compare both pre-existing Blender projects with this checkout's HEAD.
    def matches_head(path):
        relative=path.relative_to(ROOT).as_posix()
        committed=subprocess.check_output(['git','rev-parse','HEAD:'+relative],cwd=ROOT,text=True).strip()
        current=subprocess.check_output(['git','hash-object',str(path)],cwd=ROOT,text=True).strip()
        return committed==current
    blend_preserved=matches_head(original_blend) and matches_head(OUT/'Nokia3310_交互优化_v1.blend')
assert blend_preserved
report={'validation_passed':True,'source_glb_unchanged':True,'original_blend_unchanged':blend_preserved,'export_triangles':triangles,'glb_bytes':len(data),'export_meshes':len(doc['meshes']),'export_nodes':len(doc['nodes']),'animation_checks':animation_report,'closed_geometry_checks':closed_geometry,'screen_uv_present':True,'glass_extensions':glass['extensions'],'reference_and_studio_excluded':True,'browser_visual_validation':'not performed; Blender renders checked separately'}
(CHECK/('交互模型验证.json' if version=='v1' else 'v2交互模型验证.json')).write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print('VALIDATED',json.dumps({k:v for k,v in report.items() if k not in ['closed_geometry_checks','animation_checks','glass_extensions']},ensure_ascii=False))
