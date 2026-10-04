import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as THREE from '../dist/vendor/three/three.module.js';
import {createKeyFeedback,LOGICAL_KEYS,physicalKeyFor,classifyRocker} from '../dist/interaction.js';
import {phoneFixture} from './phone-fixture.mjs';

test('all actual GLB keys hold their press and return exactly, preserving source tracks',()=>{
  const {root,clips}=phoneFixture(),original=clips.map(c=>c.tracks.map(t=>Array.from(t.values))),amounts=new Map();
  const feedback=createKeyFeedback(root,clips,(name,value)=>amounts.set(name,value));
  for(const logical of LOGICAL_KEYS){
    const name=physicalKeyFor(logical),key=feedback.keys.get(name);
    feedback.hold(logical);assert.ok(key.amount>0,'immediate visual response');feedback.update(1);
    assert.equal(key.amount,1);assert.equal(feedback.update(2),false,'settled hold needs no frames');
    if(name!=='Key_Scroll')assert.ok(Math.abs(key.node.position.distanceTo(key.rest)-(['Key_Clear','Key_Menu'].includes(name)?.00405:.0054))<1e-6);
    feedback.release(logical);feedback.update(1);
    assert.ok(key.node.position.equals(key.rest));assert.ok(key.node.quaternion.equals(key.rotation));assert.equal(amounts.get(name),0);
  }
  assert.deepEqual(clips.map(c=>c.tracks.map(t=>Array.from(t.values))),original);
});

test('rocker classification follows actual arrow positions and rotation, with a center dead zone',()=>{
  const {root,clips}=phoneFixture(),feedback=createKeyFeedback(root,clips),key=feedback.keys.get('Key_Scroll'),c=feedback.calibration;
  for(const angle of [0,.8,Math.PI]){
    root.rotation.y=angle;root.updateMatrixWorld(true);
    for(const direction of ['up','down']){
      const world=key.node.localToWorld(c[direction].clone());
      assert.equal(feedback.hit({object:key.cap,point:world}).key,direction);
    }
    assert.equal(classifyRocker(c.center,c),null);
  }
});

test('rocker tilts the pressed end inward, leaves other keys alone and resets after interruption',()=>{
  const {root,clips}=phoneFixture(),feedback=createKeyFeedback(root,clips),key=feedback.keys.get('Key_Scroll'),c=feedback.calibration;
  const depths=[];
  for(const direction of ['up','down']){
    feedback.hold(direction);feedback.update(1);root.updateMatrixWorld(true);
    const up=key.node.localToWorld(c.up.clone()),down=key.node.localToWorld(c.down.clone());
    depths.push(up.z-down.z);
    for(const [name,item] of feedback.keys)if(name!=='Key_Scroll')assert.equal(item.amount,0);
    feedback.reset();assert.ok(key.node.quaternion.equals(key.rotation));assert.ok(key.node.position.equals(key.rest));
  }
  assert.ok(depths[0]<0,'up end goes inward');assert.ok(depths[1]>0,'down end goes inward');
});
