import * as THREE from './vendor/three/three.module.js';

export const KEY_NAMES = [...Array(10)].map((_,i)=>`Key_${i}`).concat(['Key_Star','Key_Hash','Key_Menu','Key_Clear','Key_Scroll']);
export const PRESS_TRAVEL_SCALE = 1.35;
export const LOGICAL_KEYS = [...Array(10)].map((_,i)=>String(i)).concat(['star','hash','menu','clear','up','down']);
export const physicalKeyFor = key => ['up','down'].includes(key) ? 'Key_Scroll' : 'Key_'+key[0].toUpperCase()+key.slice(1);

export function classifyRocker(point,calibration) {
  const distance=point.clone().sub(calibration.center).dot(calibration.direction);
  return Math.abs(distance)<calibration.deadZone ? null : distance>0?'up':'down';
}

// Read authored motion without changing the source animation or mesh.
export function createKeyFeedback(model,clips,onFeedback=()=>{}) {
  const keys=new Map(),caps=[];
  for(const name of KEY_NAMES) {
    const node=model.getObjectByName(name),clip=clips.find(c=>c.name===`Press_${name.slice(4)}`);
    if(!node||!clip)throw Error(`Missing key or animation: ${name}`);
    const rest=node.position.clone(),rotation=node.quaternion.clone(),delta=new THREE.Vector3();
    for(const track of clip.tracks) {
      const binding=THREE.PropertyBinding.parseTrackName(track.name);
      if(binding.propertyName!=='position'||![node.name,node.uuid].includes(binding.nodeName))continue;
      for(let i=0;i<track.values.length;i+=3) {
        const candidate=new THREE.Vector3().fromArray(track.values,i).sub(rest).multiplyScalar(PRESS_TRAVEL_SCALE);
        if(candidate.lengthSq()>delta.lengthSq())delta.copy(candidate);
      }
    }
    if(!delta.lengthSq())throw Error(`Missing press translation: ${name}`);
    const cap=node.getObjectByName('Keycap_'+name.slice(4));
    if(cap){caps.push(cap);cap.userData.physicalKey=name;}
    keys.set(name,{node,cap,rest,rotation,delta,travel:delta.length(),amount:0,target:0,direction:0});
  }
  model.updateMatrixWorld(true);
  const rocker=keys.get('Key_Scroll');
  function localCenter(name) {
    const object=model.getObjectByName(name);
    if(!object)throw Error('Missing rocker arrow: '+name);
    return rocker.node.worldToLocal(new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3()));
  }
  const up=localCenter('Legend_Up'),down=localCenter('Legend_Down');
  const calibration={up,down,center:up.clone().add(down).multiplyScalar(.5),direction:up.clone().sub(down).normalize(),deadZone:.003};
  const inward=rocker.delta.clone().applyQuaternion(rocker.rotation.clone().invert()).normalize();
  const tiltAxis=calibration.direction.clone().cross(inward).normalize();
  const tilt=new THREE.Quaternion(),offset=new THREE.Vector3(),rotatedPivot=new THREE.Vector3();
  function pose(name,key) {
    key.node.position.copy(key.rest).addScaledVector(key.delta,key.amount*(name==='Key_Scroll'?.3:1));
    key.node.quaternion.copy(key.rotation);
    if(name==='Key_Scroll') {
      tilt.setFromAxisAngle(tiltAxis,.10*key.direction*key.amount);
      key.node.quaternion.multiply(tilt);
      offset.copy(calibration.center).sub(rotatedPivot.copy(calibration.center).applyQuaternion(tilt)).applyQuaternion(key.rotation);
      key.node.position.add(offset);
    }
    onFeedback(name,key.amount);
  }
  return {
    keys,caps,calibration,
    hold(logicalKey) {
      const name=physicalKeyFor(logicalKey),key=keys.get(name);if(!key)return;
      key.direction=logicalKey==='up'?1:logicalKey==='down'?-1:0;
      key.target=1;key.amount=Math.max(.18,key.amount);pose(name,key);
    },
    release(logicalKey){const key=keys.get(physicalKeyFor(logicalKey));if(key)key.target=0;},
    update(dt){
      let moving=false;
      for(const [name,key] of keys) {
        if(key.amount===key.target)continue;
        key.amount=THREE.MathUtils.damp(key.amount,key.target,key.target?38:28,dt);
        if(Math.abs(key.amount-key.target)<.001)key.amount=key.target;
        pose(name,key);moving ||= key.amount!==key.target;
      }
      return moving;
    },
    hit(intersection){
      const name=intersection.object.userData.physicalKey;if(!name)return null;
      const key=keys.get(name);
      const logical=name==='Key_Scroll'?classifyRocker(key.node.worldToLocal(intersection.point.clone()),calibration):name.slice(4).toLowerCase();
      return logical?{key:logical,physicalKey:name}:null;
    },
    reset(){for(const [name,key] of keys){key.amount=key.target=key.direction=0;pose(name,key);}},
  };
}
