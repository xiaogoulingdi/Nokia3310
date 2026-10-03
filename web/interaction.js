import * as THREE from './vendor/three/three.module.js';

export const KEY_NAMES = [...Array(10)].map((_,i)=>`Key_${i}`).concat(['Key_Star','Key_Hash','Key_Menu','Key_Clear','Key_Scroll']);

export function findKey(object) {
  for(let node=object;node;node=node.parent) if(KEY_NAMES.includes(node.name)) return node;
  return null;
}

export function canActivatePointer(record,x,y,remainingPointers=0,now=performance.now()) {
  return !!record && !record.dragged && !record.multitouch && remainingPointers===0 && now-record.time<700 && Math.hypot(x-record.x,y-record.y)<7;
}

export function createKeyAnimator(model,clips) {
  const mixer=new THREE.AnimationMixer(model);
  const keys=new Map();
  const actions=new Map();
  for(const name of KEY_NAMES) {
    const node=model.getObjectByName(name);
    const clip=clips.find(item=>item.name===`Press_${name.slice(4)}`);
    if(!node || !clip) throw new Error(`Missing key or animation: ${name}`);
    keys.set(name,{node,rest:node.position.clone()});
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
  return {mixer,keys,actions,press(name){
    const action=actions.get(name);if(!action)return false;
    action.stop().reset().play();return true;
  },reset(){
    for(const [name,action] of actions){action.stop();keys.get(name).node.position.copy(keys.get(name).rest);}
  }};
}
