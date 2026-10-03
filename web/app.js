import * as THREE from './vendor/three/three.module.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { findKey, canActivatePointer, createKeyAnimator } from './interaction.js';

const container=document.querySelector('#canvas-container');
const loading=document.querySelector('#loading');
const label=document.querySelector('#loading-label');
const status=document.querySelector('#key-status');
const scene=new THREE.Scene();scene.background=new THREE.Color(0x000000);
const raycaster=new THREE.Raycaster();
const pointer=new THREE.Vector2();
const pointers=new Map();
let renderer,controls,camera,model,animator,phoneSize,baseFitDistance;
let failure=false,statusTimer;

function showError(message) {
  failure=true;loading.hidden=false;loading.classList.add('error');label.classList.remove('sr-only');label.textContent=message;
  document.body.dataset.ready='error';
}

function fitDistance() {
  const tangent=Math.tan(THREE.MathUtils.degToRad(camera.fov/2));
  return Math.max(phoneSize.y/(2*tangent),phoneSize.x/(2*tangent*camera.aspect))*1.09+phoneSize.z*.5;
}

function resize() {
  const {width,height}=container.getBoundingClientRect();if(!width||!height)return;
  renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();
  if(phoneSize && baseFitDistance) {
    const nextDistance=fitDistance();
    const offset=camera.position.clone().sub(controls.target).multiplyScalar(nextDistance/baseFitDistance);
    camera.position.copy(controls.target).add(offset);baseFitDistance=nextDistance;
    controls.maxDistance=nextDistance*3;controls.update();
  }
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
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;
  renderer.domElement.setAttribute('aria-label','三维手机模型，拖动旋转，滚轮或双指缩放，轻点按键');
  container.appendChild(renderer.domElement);
  camera=new THREE.PerspectiveCamera(30,1,.001,100);
  controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.08;controls.enablePan=false;controls.rotateSpeed=.75;
  const environment=new RoomEnvironment();
  const pmrem=new THREE.PMREMGenerator(renderer);
  const envTarget=pmrem.fromScene(environment,.04);scene.environment=envTarget.texture;scene.environmentIntensity=1;
  environment.dispose();pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xe8f3ff,0x171a20,.75));
  const keyLight=new THREE.DirectionalLight(0xffffff,2.2);keyLight.position.set(2,3,4);scene.add(keyLight);
  const rim=new THREE.DirectionalLight(0xa7cfff,2.4);rim.position.set(-3,1,-2);scene.add(rim);
  const fill=new THREE.DirectionalLight(0xd6e5ff,.75);fill.position.set(3,-1,1);scene.add(fill);
  new ResizeObserver(resize).observe(container);resize();

  new GLTFLoader().load('/assets/nokia3310.glb',gltf=>{
    model=gltf.scene;model.updateMatrixWorld(true);
    const bounds=new THREE.Box3().setFromObject(model);phoneSize=bounds.getSize(new THREE.Vector3());
    model.position.sub(bounds.getCenter(new THREE.Vector3()));scene.add(model);
    animator=createKeyAnimator(model,gltf.animations);
    baseFitDistance=fitDistance();
    camera.position.set(phoneSize.y*.025,phoneSize.y*.015,baseFitDistance);
    camera.near=Math.max(phoneSize.y/1000,.0001);camera.far=phoneSize.y*100;camera.updateProjectionMatrix();
    controls.minDistance=phoneSize.y*.65;controls.maxDistance=baseFitDistance*3;controls.target.set(0,0,0);controls.update();
    document.body.dataset.ready='true';loading.hidden=true;
  },event=>{
    if(event.total)label.textContent=`正在加载模型 ${Math.round(event.loaded/event.total*100)}%`;
  },error=>{console.error('Model load failed',error);showError('模型加载失败，请刷新页面重试。');});

  renderer.domElement.addEventListener('pointerdown',event=>{
    if(event.button!==0)return;
    const key=pickKey(event.clientX,event.clientY);
    const record={x:event.clientX,y:event.clientY,time:performance.now(),key:key?.name,dragged:false,multitouch:pointers.size>0};
    if(pointers.size)for(const value of pointers.values())value.multitouch=true;
    pointers.set(event.pointerId,record);
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
      status.textContent=`已轻触 ${key.name.slice(4).replace('Star','*').replace('Hash','#')}`;
      clearTimeout(statusTimer);statusTimer=setTimeout(()=>{status.textContent='';},1400);
    }
  });
  renderer.domElement.addEventListener('pointercancel',event=>pointers.delete(event.pointerId));
  renderer.domElement.addEventListener('contextmenu',event=>event.preventDefault());
  const clock=new THREE.Clock();
  renderer.setAnimationLoop(()=>{
    if(failure)return;animator?.mixer.update(Math.min(clock.getDelta(),.05));controls.update();renderer.render(scene,camera);
  });
} catch(error) {
  console.error('Viewer setup failed',error);showError('当前浏览器无法启动三维显示，请使用支持 WebGL 的浏览器。');
}
