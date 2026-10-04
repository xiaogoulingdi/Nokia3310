import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as THREE from '../dist/vendor/three/three.module.js';
import {createViewModes} from '../dist/view-modes.js';
function fixture(position=[1,.5,3],reducedMotion=false){
  const camera=new THREE.OrthographicCamera(-1,1,1,-1,.01,100);camera.position.fromArray(position);
  const controls=new THREE.EventDispatcher();Object.assign(controls,{domElement:new EventTarget(),target:new THREE.Vector3(),enabled:true,update(){camera.lookAt(this.target);return false;}});
  let cancelled=0;const modes=createViewModes({camera,controls,reducedMotion,requestRender(){},onCancel(){cancelled++;}});
  return {camera,controls,modes,get cancelled(){return cancelled;}};
}
test('front, rear and side all transition to exact front use and restore their showcase pose',()=>{
  for(const position of [[1,.5,3],[0,.8,-3],[-3,1,0]]){
    const f=fixture(position),start=f.camera.position.clone();f.camera.zoom=1.6;
    assert.equal(f.modes.toggle(),true);assert.equal(f.modes.toggle(),false,'ignore transition reentry');f.modes.update(1);
    assert.equal(f.modes.isUsing,true);assert.equal(f.controls.enabled,false);assert.equal(f.camera.position.x,0);assert.equal(f.camera.position.y,0);assert.equal(f.camera.zoom,1.06);
    assert.equal(f.modes.update(1),false,'use mode idles');f.modes.toggle();f.modes.update(1);
    assert.ok(f.camera.position.equals(start));assert.equal(f.camera.zoom,1.6);assert.equal(f.controls.enabled,true);assert.equal(f.cancelled,2);f.modes.dispose();
  }
});
test('hidden transition is frozen and visibility does not accept phone input',()=>{
  const {modes,camera}=fixture();modes.toggle();modes.update(.1);modes.setVisible(false);const pose=camera.position.clone();modes.update(5);
  assert.ok(camera.position.equals(pose));assert.equal(modes.isUsing,false);modes.setVisible(true);modes.update(1);assert.equal(modes.isUsing,true);
  modes.setVisible(false);assert.equal(modes.isUsing,false);modes.dispose();
});
test('pause and reduced motion stop automatic rendering',()=>{
  const {modes}=fixture();assert.equal(modes.update(.01),true);modes.togglePause();assert.equal(modes.update(.01),false);
  modes.togglePause();modes.setReducedMotion(true);assert.equal(modes.update(.01),false);modes.toggle();modes.update(.016);assert.equal(modes.isUsing,true);modes.dispose();
});
