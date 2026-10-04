import * as THREE from './vendor/three/three.module.js';

// One owner for viewing pose: OrbitControls in showcase, this transition in between.
export function createViewModes({camera,controls,requestRender,useZoom=()=>1.17,onChange=()=>{},onCancel=()=>{},reducedMotion=false,now=()=>performance.now()}) {
  let mode='showcase',transition=null,visible=true,paused=false,dragging=false,resumeAt=0,resumeTimer=null,disposed=false;
  let reduced=reducedMotion;
  const orbitPointers=new Set(),element=controls.domElement;
  const initial={position:camera.position.clone(),target:controls.target.clone(),zoom:camera.zoom};
  let showcase=initial;
  const notify=()=>onChange({mode,paused,reducedMotion:reduced});
  const canRotate=()=>mode==='showcase'&&visible&&!paused&&!reduced&&!dragging&&now()>=resumeAt;
  function clearResume(){clearTimeout(resumeTimer);resumeTimer=null;}
  function flushControls(){
    const position=camera.position.clone(),target=controls.target.clone(),zoom=camera.zoom;
    controls.autoRotate=false;controls.enableDamping=false;controls.update(0);
    camera.position.copy(position);controls.target.copy(target);camera.zoom=zoom;camera.updateProjectionMatrix();controls.update(0);
  }
  function cancelOrbit(){
    for(const id of [...orbitPointers])element.dispatchEvent(new PointerEvent('pointercancel',{pointerId:id}));
    orbitPointers.clear();dragging=false;clearResume();
  }
  function begin(next){
    if(disposed||!visible||transition||mode===next)return false;
    onCancel();cancelOrbit();flushControls();controls.enabled=false;
    if(next==='use')showcase={position:camera.position.clone(),target:controls.target.clone(),zoom:camera.zoom};
    const destination=next==='use'?{position:new THREE.Vector3(0,0,initial.position.length()),target:new THREE.Vector3(),zoom:useZoom()}:showcase;
    const start=new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
    const end=new THREE.Spherical().setFromVector3(destination.position.clone().sub(destination.target));
    end.theta=start.theta+Math.atan2(Math.sin(end.theta-start.theta),Math.cos(end.theta-start.theta));
    transition={next,start,end,fromTarget:controls.target.clone(),destination,fromZoom:camera.zoom,elapsed:0,duration:reduced?.001:.42};
    mode=next==='use'?'entering-use':'leaving-use';notify();requestRender();return true;
  }
  function start(){if(mode!=='showcase')return;dragging=true;clearResume();controls.autoRotate=false;requestRender();}
  function end(){
    dragging=false;if(mode!=='showcase')return;
    resumeAt=now()+1200;clearResume();resumeTimer=setTimeout(()=>{resumeTimer=null;if(!disposed&&visible)requestRender();},1200);
    requestRender();
  }
  const track=event=>{if(mode==='showcase')orbitPointers.add(event.pointerId);};
  const untrack=event=>orbitPointers.delete(event.pointerId);
  element.addEventListener('pointerdown',track,{capture:true});
  element.addEventListener('pointerup',untrack);element.addEventListener('pointercancel',untrack);
  controls.addEventListener('start',start);controls.addEventListener('end',end);
  controls.autoRotateSpeed=1;notify();
  return {
    toggle(){return begin(mode==='showcase'?'use':'showcase');},
    togglePause(){if(mode!=='showcase'||reduced)return;paused=!paused;notify();requestRender();},
    setReducedMotion(value){reduced=value;if(transition&&reduced)transition.duration=.001;notify();requestRender();},
    setVisible(value){visible=value;onCancel();cancelOrbit();flushControls();controls.enabled=value&&mode==='showcase';if(value)requestRender();},
    update(dt){
      if(!visible||disposed)return false;
      if(transition){
        const t=transition;t.elapsed+=dt;const progress=Math.min(1,t.elapsed/t.duration),e=progress*progress*(3-2*progress);
        if(t.next==='use')t.destination.zoom=useZoom();
        const sphere=new THREE.Spherical(THREE.MathUtils.lerp(t.start.radius,t.end.radius,e),THREE.MathUtils.lerp(t.start.phi,t.end.phi,e),THREE.MathUtils.lerp(t.start.theta,t.end.theta,e));
        controls.target.lerpVectors(t.fromTarget,t.destination.target,e);
        camera.position.setFromSpherical(sphere).add(controls.target);camera.zoom=THREE.MathUtils.lerp(t.fromZoom,t.destination.zoom,e);camera.updateProjectionMatrix();controls.update(0);
        if(progress===1){
          camera.position.copy(t.destination.position);controls.target.copy(t.destination.target);camera.zoom=t.destination.zoom;camera.updateProjectionMatrix();controls.update(0);
          mode=t.next;transition=null;controls.enabled=mode==='showcase';controls.enableDamping=mode==='showcase';notify();
        }
        return !!transition||canRotate();
      }
      controls.autoRotate=canRotate();controls.enableDamping=mode==='showcase';
      if(mode==='use'&&camera.zoom!==useZoom()){camera.zoom=useZoom();camera.updateProjectionMatrix();}
      const moving=mode==='showcase'?controls.update(dt):false;
      return moving||controls.autoRotate;
    },
    get isUsing(){return mode==='use'&&visible;},
    get diagnostics(){return {mode,paused,reducedMotion:reduced,visible,transition:!!transition,autoRotate:controls.autoRotate};},
    dispose(){disposed=true;clearResume();controls.removeEventListener('start',start);controls.removeEventListener('end',end);element.removeEventListener('pointerdown',track,{capture:true});element.removeEventListener('pointerup',untrack);element.removeEventListener('pointercancel',untrack);},
  };
}
