// Run after python web/build.py. Exercise the actual exported GLB press tracks.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from '../dist/vendor/three/three.module.js';
import { createKeyAnimator, KEY_NAMES, canActivatePointer } from '../dist/interaction.js';

function fixture() {
  const glb=readFileSync(new URL('../dist/assets/nokia3310.glb',import.meta.url));
  const jsonLength=glb.readUInt32LE(12);
  const doc=JSON.parse(glb.subarray(20,20+jsonLength).toString());
  const binStart=28+jsonLength;
  const root=new THREE.Group();
  for(const data of doc.nodes.filter(node=>KEY_NAMES.includes(node.name))) {
    const node=new THREE.Object3D();node.name=data.name;node.position.fromArray(data.translation);root.add(node);
  }
  function floats(index,width) {
    const accessor=doc.accessors[index],view=doc.bufferViews[accessor.bufferView];
    assert.equal(accessor.componentType,5126);
    const offset=binStart+(view.byteOffset??0)+(accessor.byteOffset??0);
    const values=new Float32Array(accessor.count*width);
    for(let i=0;i<accessor.count;i++)for(let j=0;j<width;j++)
      values[i*width+j]=glb.readFloatLE(offset+i*(view.byteStride??width*4)+j*4);
    return values;
  }
  const clips=doc.animations.filter(clip=>clip.name.startsWith('Press_')).map(data=>{
    const tracks=data.channels.filter(channel=>channel.target.path==='translation').map(channel=>{
      const sampler=data.samplers[channel.sampler];
      assert.ok(!sampler.interpolation || sampler.interpolation==='LINEAR');
      return new THREE.VectorKeyframeTrack(doc.nodes[channel.target.node].name+'.position',
        floats(sampler.input,1),floats(sampler.output,3));
    });
    return new THREE.AnimationClip(data.name,-1,tracks);
  });
  return {root,clips};
}

test('all 15 actual GLB keys move 35% further, return, and clear their feedback',()=>{
  const {root,clips}=fixture(),feedback=new Map();
  const animator=createKeyAnimator(root,clips,(key,value)=>feedback.set(key,value));
  for(const name of KEY_NAMES) {
    assert.equal(animator.press(name),true);
    animator.update(.15);
    const key=animator.keys.get(name);
    const expected=['Key_Menu','Key_Clear','Key_Scroll'].includes(name)?.00405:.0054;
    assert.ok(Math.abs(key.node.position.distanceTo(key.rest)-expected)<1e-6,name);
    assert.ok(feedback.get(name)>.99,name+' visual feedback');
    animator.update(.5);
    assert.ok(key.node.position.distanceTo(key.rest)<1e-7,name+' return');
    assert.ok(feedback.get(name)<1e-6,name+' feedback reset');
    assert.equal(animator.actions.get(name).isRunning(),false);
  }
});

test('scaling leaves original animation buffers untouched',()=>{
  const {root,clips}=fixture();
  const originals=clips.map(clip=>clip.tracks.map(track=>Array.from(track.values)));
  createKeyAnimator(root,clips);
  assert.deepEqual(clips.map(clip=>clip.tracks.map(track=>Array.from(track.values))),originals);
});

test('rapid re-triggers and hide/reset leave all keys at rest',()=>{
  const {root,clips}=fixture(),feedback=new Map();
  const animator=createKeyAnimator(root,clips,(key,value)=>feedback.set(key,value));
  for(let i=0;i<40;i++){animator.press(KEY_NAMES[i%15]);animator.update(.012);}
  animator.reset();
  for(const [name,key] of animator.keys){assert.ok(key.node.position.equals(key.rest));assert.equal(feedback.get(name),0);}
});

test('drag, multi-touch, long press and cancelled gestures cannot activate a sound',()=>{
  const base={x:30,y:40,time:100,dragged:false,multitouch:false};
  assert.equal(canActivatePointer(base,31,41,0,200),true);
  for(const record of [{...base,dragged:true},{...base,multitouch:true},null])
    assert.equal(canActivatePointer(record,31,41,0,200),false);
  assert.equal(canActivatePointer(base,40,40,0,200),false);
  assert.equal(canActivatePointer(base,30,40,0,850),false);
  assert.equal(canActivatePointer(base,30,40,1,200),false);
});
