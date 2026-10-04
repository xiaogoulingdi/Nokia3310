import * as THREE from './vendor/three/three.module.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createKeyFeedback } from './interaction.js?v=20261004-screen-1';
import { createAppearance } from './appearance.js?v=20261004-screen-1';
import { createLCD } from './lcd.js?v=20261004-screen-1';

export function createViewer({container,onProgress=()=>{},onScreenSummary=()=>{}}) {
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x000000);
  const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.transmissionResolutionScale=.65;
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.AgXToneMapping;
  const element=renderer.domElement;element.tabIndex=-1;element.setAttribute('role','application');
  element.setAttribute('aria-label','Nokia 3310 手机操作区');element.setAttribute('aria-describedby','instructions keyboard-help');
  container.appendChild(element);
  const camera=new THREE.OrthographicCamera(-1,1,1,-1,.001,100);
  const controls=new OrbitControls(camera,element);controls.enableDamping=true;controls.dampingFactor=.08;
  controls.enablePan=false;controls.rotateSpeed=.75;controls.minZoom=.65;controls.maxZoom=2.5;
  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
  let model,feedback,appearance,lcd,size,frame=0,lastTime=0,renderCount=0,disposed=false,visible=true,driver=()=>false;
  const requestRender=()=>{if(!frame&&!disposed&&visible&&!document.hidden)frame=requestAnimationFrame(render);};
  function render(time){
    frame=0;if(disposed||!visible||document.hidden)return;
    const dt=lastTime?Math.max(0,Math.min((time-lastTime)/1000,.05)):1/60;lastTime=time;
    const motion=driver(dt),keysMoving=feedback?.update(dt);
    renderer.render(scene,camera);renderCount++;
    if(motion||keysMoving)requestRender();else lastTime=0;
  }
  function resize(){
    const {width,height}=container.getBoundingClientRect();if(!width||!height||disposed)return;
    renderer.setSize(width,height,false);
    if(size){
      const aspect=width/height,span=Math.max(size.y*1.22,size.x*1.6/aspect);
      camera.left=-span*aspect/2;camera.right=span*aspect/2;camera.top=span/2;camera.bottom=-span/2;camera.updateProjectionMatrix();
    }
    requestRender();
  }
  controls.addEventListener('change',requestRender);
  const observer=new ResizeObserver(resize);observer.observe(container);resize();
  function disposeModel(root,materials=true){
    const geometries=new Set(),ownedMaterials=new Set();
    root?.traverse(node=>{if(node.isMesh){geometries.add(node.geometry);for(const mat of Array.isArray(node.material)?node.material:[node.material])ownedMaterials.add(mat);}});
    geometries.forEach(item=>item.dispose());if(materials)ownedMaterials.forEach(item=>item.dispose());
  }
  const ready=Promise.all([
    new GLTFLoader().loadAsync('/assets/nokia3310.glb?v=20261004-screen-1',event=>{if(!disposed&&event.total)onProgress(Math.round(event.loaded/event.total*100));}),
    fetch('/assets/studio.json?v=20261004-screen-1').then(response=>{if(!response.ok)throw Error('Studio HTTP '+response.status);return response.json();}),
  ]).then(([gltf,studio])=>{
    if(disposed){disposeModel(gltf.scene);return false;}
    model=gltf.scene;model.updateMatrixWorld(true);
    const bounds=new THREE.Box3().setFromObject(model),center=bounds.getCenter(new THREE.Vector3());size=bounds.getSize(new THREE.Vector3());
    model.position.sub(center);scene.add(model);
    appearance=createAppearance(renderer,scene,model,studio,center);appearance.apply('real');
    lcd=createLCD({model,requestRender,onSummary:onScreenSummary});
    lcd.setVisible(visible);
    feedback=createKeyFeedback(model,gltf.animations,(name,amount)=>appearance.setKeyFeedback(name,amount));
    camera.position.set(studio.camera.position[0],studio.camera.position[2],-studio.camera.position[1]).sub(center).normalize().multiplyScalar(size.y*3);
    camera.near=Math.max(size.y/1000,.0001);camera.far=size.y*100;controls.target.set(0,0,0);controls.update();resize();return true;
  });
  function project(point){const box=element.getBoundingClientRect();point.project(camera);return {x:box.left+(point.x+1)*box.width/2,y:box.top+(1-point.y)*box.height/2};}
  return {
    ready,element,camera,controls,requestRender,
    setDriver(value){driver=value;requestRender();},
    setVisible(value){visible=value;lcd?.setVisible(value);lastTime=0;if(!value){cancelAnimationFrame(frame);frame=0;}else requestRender();},
    setScreen(state){lcd?.update(state);},
    setTheme(value){appearance?.apply(value);requestRender();},
    hold(key){feedback?.hold(key);requestRender();},release(key){feedback?.release(key);requestRender();},
    resetKeys(){feedback?.reset();requestRender();},
    pick(x,y){
      if(!feedback)return null;
      const box=element.getBoundingClientRect();pointer.set((x-box.left)/box.width*2-1,1-(y-box.top)/box.height*2);
      scene.updateMatrixWorld(true);camera.updateMatrixWorld();raycaster.setFromCamera(pointer,camera);
      const first=raycaster.intersectObjects(feedback.caps,false)[0];return first?feedback.hit(first):null;
    },
    get diagnostics(){
      const keys={},logicalKeys={};scene.updateMatrixWorld(true);camera.updateMatrixWorld();
      if(feedback)for(const [name,key] of feedback.keys){
        keys[name]={...project(key.node.getWorldPosition(new THREE.Vector3())),atRest:key.amount===0,held:key.target===1,amount:key.amount,travel:key.travel,displacement:key.node.position.distanceTo(key.rest),quaternion:key.node.quaternion.toArray(),color:key.cap?.material.color.toArray()};
        if(name!=='Key_Scroll')logicalKeys[name.slice(4).toLowerCase()]=keys[name];
      }
      if(feedback){const rocker=feedback.keys.get('Key_Scroll').node;for(const name of ['up','down','center'])logicalKeys[name]=project(rocker.localToWorld(feedback.calibration[name].clone()));}
      return {ready:!!feedback,theme:appearance?.current,keys,logicalKeys,lcd:lcd?.diagnostics,renderCount,memory:{...renderer.info.memory},programs:renderer.info.programs.length,camera:camera.position.toArray(),zoom:camera.zoom,controlsEnabled:controls.enabled};
    },
    dispose(){if(disposed)return;disposed=true;cancelAnimationFrame(frame);observer.disconnect();controls.removeEventListener('change',requestRender);controls.dispose();lcd?.dispose();appearance?.dispose();disposeModel(model,!appearance);renderer.dispose();element.remove();},
  };
}
