import * as THREE from './vendor/three/three.module.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { findKey, canActivatePointer, createKeyAnimator } from './interaction.js?v=20261004-feedback-3';
import { createAppearance } from './appearance.js?v=20261004-feedback-3';
import { bindThemeSwitch } from './theme-switch.js?v=20261004-feedback-3';
import { createKeySound } from './key-sound.js?v=20261004-feedback-3';

const container=document.querySelector('#canvas-container');
const loading=document.querySelector('#loading');
const label=document.querySelector('#loading-label');
const status=document.querySelector('#key-status');
const scene=new THREE.Scene();scene.background=new THREE.Color(0x000000);
const raycaster=new THREE.Raycaster();
const pointer=new THREE.Vector2();
const pointers=new Map();
let renderer,controls,camera,model,animator,phoneSize,baseFitDistance,appearance;
let failure=false,statusTimer,frame=0,lastTime=0,renderCount=0;
const switchButton=document.querySelector('#theme-switch');
const keySound=createKeySound(document.querySelector('#sound-toggle'));
const themeSwitch=bindThemeSwitch(switchButton,theme=>{
  appearance?.apply(theme);requestRender();
});

// Let the GPU sleep when the phone is still; only orbit damping and key presses
// request subsequent frames. Hidden tabs never run the renderer.
function requestRender() {
  if(!frame && !failure && !document.hidden)frame=requestAnimationFrame(render);
}
function render(time) {
  frame=0;if(failure || !renderer || document.hidden)return;
  // rAF's frame timestamp can predate performance.now() in the input handler.
  // A negative delta would immediately finish a LoopOnce action in reverse.
  const dt=lastTime?Math.max(0,Math.min((time-lastTime)/1000,.05)):0;lastTime=time;
  animator?.update(dt);
  const moving=controls.update();
  renderer.render(scene,camera);renderCount++;
  const animating=animator && [...animator.actions.values()].some(action=>action.isRunning());
  if(moving || animating)requestRender();
}

function showError(message) {
  failure=true;loading.hidden=false;loading.classList.add('error');label.classList.remove('sr-only');label.textContent=message;
  document.body.dataset.ready='error';
}

function fitDistance() {
  const {width,height}=container.getBoundingClientRect();
  const aspect=width/height;
  const span=Math.max(phoneSize.y*1.25,phoneSize.x*1.6/aspect);
  camera.left=-span*aspect/2;camera.right=span*aspect/2;
  camera.top=span/2;camera.bottom=-span/2;camera.updateProjectionMatrix();
  return phoneSize.y*3;
}

function resize() {
  const {width,height}=container.getBoundingClientRect();if(!width||!height)return;
  renderer.setSize(width,height,false);
  if(phoneSize && baseFitDistance) {
    const nextDistance=fitDistance();
    const offset=camera.position.clone().sub(controls.target).multiplyScalar(nextDistance/baseFitDistance);
    camera.position.copy(controls.target).add(offset);baseFitDistance=nextDistance;
    controls.maxDistance=nextDistance*3;controls.update();
  }
  requestRender();
}

function pickKey(x,y) {
  if(!model)return null;
  const box=renderer.domElement.getBoundingClientRect();
  pointer.set((x-box.left)/box.width*2-1,-(y-box.top)/box.height*2+1);
  scene.updateMatrixWorld(true);camera.updateMatrixWorld();raycaster.setFromCamera(pointer,camera);
  for(const hit of raycaster.intersectObject(model,true)) {
    const key=findKey(hit.object);if(key)return key;
  }
  return null;
}

try {
  renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
  renderer.transmissionResolutionScale=.65;
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.AgXToneMapping;renderer.toneMappingExposure=1;
  renderer.domElement.setAttribute('aria-label','三维手机模型，拖动旋转，滚轮或双指缩放，轻点按键');
  container.appendChild(renderer.domElement);
  camera=new THREE.OrthographicCamera(-1,1,1,-1,.001,100);
  controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.08;controls.enablePan=false;controls.rotateSpeed=.75;
  controls.minZoom=.65;controls.maxZoom=2.5;
  controls.addEventListener('change',requestRender);
  new ResizeObserver(resize).observe(container);resize();

  const studioPromise=fetch('/assets/studio.json?v=20261004-feedback-3').then(response=>{
    if(!response.ok)throw new Error(`Studio HTTP ${response.status}`);return response.json();
  });
  const modelPromise=new GLTFLoader().loadAsync('/assets/nokia3310.glb?v=20261004-feedback-3',event=>{
    if(event.total)label.textContent=`正在加载模型 ${Math.round(event.loaded/event.total*100)}%`;
  });
  Promise.all([modelPromise,studioPromise]).then(([gltf,studio])=>{
    model=gltf.scene;model.updateMatrixWorld(true);
    const bounds=new THREE.Box3().setFromObject(model);phoneSize=bounds.getSize(new THREE.Vector3());
    const center=bounds.getCenter(new THREE.Vector3());
    model.position.sub(center);scene.add(model);
    appearance=createAppearance(renderer,scene,model,studio,center);
    themeSwitch.select('real');switchButton.disabled=false;
    animator=createKeyAnimator(model,gltf.animations,(name,amount)=>appearance.setKeyFeedback(name,amount));
    baseFitDistance=fitDistance();
    // Match the Blender product-camera direction, while keeping orbit/zoom available.
    camera.position.fromArray(studio.camera.position).set(
      studio.camera.position[0],studio.camera.position[2],-studio.camera.position[1]);
    camera.position.sub(center).normalize().multiplyScalar(baseFitDistance);
    camera.near=Math.max(phoneSize.y/1000,.0001);camera.far=phoneSize.y*100;camera.updateProjectionMatrix();
    controls.minDistance=phoneSize.y*.65;controls.maxDistance=baseFitDistance*3;controls.target.set(0,0,0);controls.update();
    document.body.dataset.ready='true';loading.hidden=true;
    requestRender();
  }).catch(error=>{console.error('Model load failed',error);showError('模型或棚拍配置加载失败，请刷新页面重试。');});

  renderer.domElement.addEventListener('pointerdown',event=>{
    if(event.button!==0)return;
    const key=pickKey(event.clientX,event.clientY);
    const record={x:event.clientX,y:event.clientY,time:performance.now(),key:key?.name,dragged:false,multitouch:pointers.size>0};
    if(pointers.size)for(const value of pointers.values())value.multitouch=true;
    pointers.set(event.pointerId,record);
    if(key && !record.multitouch)void keySound.prepare();
  });
  renderer.domElement.addEventListener('pointermove',event=>{
    const record=pointers.get(event.pointerId);
    if(record && Math.hypot(event.clientX-record.x,event.clientY-record.y)>=7)record.dragged=true;
  });
  renderer.domElement.addEventListener('pointerup',event=>{
    const record=pointers.get(event.pointerId);pointers.delete(event.pointerId);
    if(!animator || !canActivatePointer(record,event.clientX,event.clientY,pointers.size))return;
    const key=pickKey(event.clientX,event.clientY);
    if(!key || key.name!==record.key)return;
    if(animator.press(key.name)) {
      keySound.play(key.name,themeSwitch.current);
      lastTime=performance.now();requestRender();
      status.textContent=`已轻触 ${key.name.slice(4).replace('Star','*').replace('Hash','#')}`;
      clearTimeout(statusTimer);statusTimer=setTimeout(()=>{status.textContent='';},1400);
    }
  });
  renderer.domElement.addEventListener('pointercancel',event=>pointers.delete(event.pointerId));
  renderer.domElement.addEventListener('contextmenu',event=>event.preventDefault());
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){cancelAnimationFrame(frame);frame=0;animator?.reset();pointers.clear();keySound.hush();}
    else{lastTime=0;requestRender();}
  });
} catch(error) {
  console.error('Viewer setup failed',error);showError('当前浏览器无法启动三维显示，请使用支持 WebGL 的浏览器。');
}

// Read-only diagnostics used by local validation; no second render loop or model.
export function getViewerDiagnostics() {
  const keys={};
  if(animator)for(const [name,{node,rest,travel,feedback}] of animator.keys) {
    const point=node.getWorldPosition(new THREE.Vector3()).project(camera);
    const box=renderer.domElement.getBoundingClientRect();
    keys[name]={x:box.left+(point.x+1)*box.width/2,y:box.top+(1-point.y)*box.height/2,
      atRest:node.position.distanceTo(rest)<1e-7,travel,feedback,
      displacement:node.position.distanceTo(rest),
      keycapColor:node.getObjectByName('Keycap_'+name.slice(4))?.material.color.toArray()};
  }
  return {ready:document.body.dataset.ready,theme:appearance?.current,renderCount,
    memory:renderer?.info.memory,programs:renderer?.info.programs.length,
    camera:camera?.position.toArray(),keys,sound:keySound.diagnostics};
}
