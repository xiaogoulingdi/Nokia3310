import * as THREE from './vendor/three/three.module.js';

export const KEY_NAMES = [...Array(10)].map((_,i)=>`Key_${i}`).concat(['Key_Star','Key_Hash','Key_Menu','Key_Clear','Key_Scroll']);

export function findKey(object) {
  for(let node=object;node;node=node.parent) if(KEY_NAMES.includes(node.name)) return node;
  return null;
}

export function canActivatePointer(record,x,y,remainingPointers=0,now=performance.now()) {
  return !!record && !record.dragged && !record.multitouch && remainingPointers===0 && now-record.time<700 && Math.hypot(x-record.x,y-record.y)<7;
}

export const PRESS_TRAVEL_SCALE = 1.35;

export function createKeyAnimator(model,clips,onFeedback=()=>{}) {
  const mixer=new THREE.AnimationMixer(model);
  const keys=new Map();
  const actions=new Map();
  for(const name of KEY_NAMES) {
    const node=model.getObjectByName(name);
    const original=clips.find(item=>item.name===`Press_${name.slice(4)}`);
    if(!node || !original) throw new Error(`Missing key or animation: ${name}`);
    const rest=node.position.clone();
    const clip=original.clone();
    let travel=0;
    // Scale displacement about the saved rest pose, never the absolute position.
    // Clone tracks so the GLB and its other animation clips remain untouched.
    for(const track of clip.tracks) {
      const binding=THREE.PropertyBinding.parseTrackName(track.name);
      if(binding.propertyName!=='position' || ![node.name,node.uuid].includes(binding.nodeName))continue;
      for(let i=0;i<track.values.length;i+=3) {
        let distanceSquared=0;
        for(let axis=0;axis<3;axis++) {
          const delta=(track.values[i+axis]-rest.getComponent(axis))*PRESS_TRAVEL_SCALE;
          track.values[i+axis]=rest.getComponent(axis)+delta;distanceSquared+=delta*delta;
        }
        travel=Math.max(travel,Math.sqrt(distanceSquared));
      }
    }
    if(!travel)throw new Error(`Missing press translation: ${name}`);
    keys.set(name,{node,rest,travel,feedback:0});
    const action=mixer.clipAction(clip);
    action.setLoop(THREE.LoopOnce,1);
    action.clampWhenFinished=true;
    actions.set(name,action);
  }
  mixer.addEventListener('finished',event=>{
    const name=`Key_${event.action.getClip().name.replace(/^Press_/,'')}`;
    if(!keys.has(name)) return;
    event.action.stop();
    keys.get(name).node.position.copy(keys.get(name).rest);
  });
  return {mixer,keys,actions,update(dt){
    mixer.update(dt);
    for(const [name,key] of keys) {
      const amount=Math.min(1,key.node.position.distanceTo(key.rest)/key.travel);
      if(Math.abs(amount-key.feedback)>1e-6) {key.feedback=amount;onFeedback(name,amount);}
    }
  },press(name){
    const action=actions.get(name);if(!action)return false;
    action.stop().reset().play();return true;
  },reset(){
    for(const [name,action] of actions){
      action.stop();const key=keys.get(name);key.node.position.copy(key.rest);key.feedback=0;onFeedback(name,0);
    }
  }};
}
