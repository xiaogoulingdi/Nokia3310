import {readFileSync} from 'node:fs';
import * as THREE from '../dist/vendor/three/three.module.js';

// Decode the actual GLB transforms, positions and indices for geometry-aware tests.
export function phoneFixture(){
  const bytes=readFileSync(new URL('../dist/assets/nokia3310.glb',import.meta.url));
  const length=bytes.readUInt32LE(12),data=JSON.parse(bytes.subarray(20,20+length)),bin=28+length;
  function values(index){
    const a=data.accessors[index],v=data.bufferViews[a.bufferView],width={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type];
    const formats={5126:[4,'readFloatLE',Float32Array],5125:[4,'readUInt32LE',Uint32Array],5123:[2,'readUInt16LE',Uint16Array]};
    const [size,read,ArrayType]=formats[a.componentType],out=new ArrayType(a.count*width),offset=bin+(v.byteOffset??0)+(a.byteOffset??0);
    for(let i=0;i<a.count;i++)for(let j=0;j<width;j++)out[i*width+j]=bytes[read](offset+i*(v.byteStride??width*size)+j*size);
    return out;
  }
  const geometries=data.meshes.map(mesh=>{const p=mesh.primitives[0],g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(values(p.attributes.POSITION),3));if(p.indices!==undefined)g.setIndex(new THREE.BufferAttribute(values(p.indices),1));return g;});
  const nodes=data.nodes.map(n=>{
    const node=n.mesh===undefined?new THREE.Object3D():new THREE.Mesh(geometries[n.mesh]);node.name=n.name;
    if(n.translation)node.position.fromArray(n.translation);if(n.rotation)node.quaternion.fromArray(n.rotation);if(n.scale)node.scale.fromArray(n.scale);return node;
  });
  data.nodes.forEach((n,i)=>n.children?.forEach(c=>nodes[i].add(nodes[c])));
  const root=new THREE.Group();data.scenes[0].nodes.forEach(i=>root.add(nodes[i]));root.updateMatrixWorld(true);
  const clips=data.animations.filter(c=>c.name.startsWith('Press_')).map(c=>new THREE.AnimationClip(c.name,-1,c.channels.filter(ch=>ch.target.path==='translation').map(ch=>{
    const sampler=c.samplers[ch.sampler];return new THREE.VectorKeyframeTrack(nodes[ch.target.node].name+'.position',values(sampler.input),values(sampler.output));
  })));
  return {root,clips};
}
