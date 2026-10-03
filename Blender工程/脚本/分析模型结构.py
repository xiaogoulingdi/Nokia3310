import bpy, json, math
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'Blender工程' / '优化检查'
OUT.mkdir(exist_ok=True)
obj = next(o for o in bpy.context.scene.objects if o.type == 'MESH')
mesh = obj.data
coords = np.empty(len(mesh.vertices)*3, dtype=np.float32)
mesh.vertices.foreach_get('co', coords)
coords = coords.reshape(-1,3)
matrix = np.array(obj.matrix_world, dtype=float)
world = coords @ matrix[:3,:3].T + matrix[:3,3]
# UV seams may duplicate vertices. Analyze geometric connectivity after a tiny positional merge.
_, inverse = np.unique(np.round(world, 6), axis=0, return_inverse=True)
parents = np.arange(int(inverse.max())+1)
def find(x):
    while parents[x] != x:
        parents[x] = parents[parents[x]]
        x = parents[x]
    return x
edges = np.empty(len(mesh.edges)*2, dtype=np.int32)
mesh.edges.foreach_get('vertices', edges)
for a,b in inverse[edges.reshape(-1,2)]:
    ra,rb=find(a),find(b)
    if ra!=rb: parents[rb]=ra
labels=np.array([find(x) for x in inverse])
unique, counts = np.unique(labels,return_counts=True)
components=[]
for idx in np.argsort(counts)[::-1][:30]:
    points=world[labels==unique[idx]]
    components.append({'vertices':int(counts[idx]),'min':points.min(0).tolist(),'max':points.max(0).tolist()})
polys=[tuple(p.vertices) for p in mesh.polygons]
bvh=BVHTree.FromPolygons([Vector(p) for p in world],polys,all_triangles=True)
samples={}
for z in [.12,.20,.28,.37,.48,.60,.72,.85,1.0]:
    samples[str(z)]=[]
    for x in [-.15,-.12,-.08,0,.08,.12,.15]:
        hit=bvh.ray_cast(Vector((x,-1,z)),Vector((0,1,0)))
        samples[str(z)].append({'x':x,'y':float(hit[0].y) if hit[0] else None})
report={'mesh':obj.name,'vertices':len(coords),'triangles':len(mesh.polygons),'unique_positions':len(parents),'components':len(unique),'largest_components':components,'front_samples':samples}
(OUT/'原始结构分析.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False))
