import * as THREE from './vendor/three/three.module.js';

const toWeb = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0), -Math.PI/2);

// Bake Blender's area-light rectangles once per theme, not once per frame.
// PMREM is an image-based approximation: it does not reproduce Cycles path tracing.
function bakeStudio(renderer, studio, center, neutral) {
  const room = new THREE.Scene();
  room.background = new THREE.Color().fromArray(studio.worldColor).multiplyScalar(studio.worldStrength);
  const geometry = new THREE.PlaneGeometry(1,1);
  for (const light of studio.lights) {
    const color = neutral ? new THREE.Color(1,1,1) : new THREE.Color().fromArray(light.color);
    const radiance = light.power / (Math.PI * light.width * light.height) * (neutral ? .15 : 1);
    const material = new THREE.MeshBasicMaterial({color:color.multiplyScalar(radiance), side:THREE.DoubleSide});
    const card = new THREE.Mesh(geometry, material);
    card.position.fromArray(light.position).applyQuaternion(toWeb).sub(center);
    const [w,x,y,z] = light.quaternion;
    card.quaternion.copy(toWeb).multiply(new THREE.Quaternion(x,y,z,w));
    card.scale.set(light.width,light.height,1);
    room.add(card);
  }
  const generator = new THREE.PMREMGenerator(renderer);
  const target = generator.fromScene(room,0,.01,20,{size:256});
  generator.dispose();
  geometry.dispose();
  for (const card of room.children) card.material.dispose();
  return target;
}

export function createAppearance(renderer, scene, model, studio, center) {
  const environments = {
    real:bakeStudio(renderer,studio,center,true),
    glass:bakeStudio(renderer,studio,center,false),
  };
  const pairs = new Map();
  const keyMaterials = new Map();
  model.traverse(object=>{
    if (!object.isMesh) return;
    const source = object.material;
    if (!pairs.has(source)) {
      const glass = source.clone();
      // These shells are closed. A second back-face transmission pass creates
      // duplicate key silhouettes in Three's screen-space refraction buffer.
      if (source.name === 'Glass_Clear_IOR_1_47' || source.name.startsWith('Key_')) glass.side=THREE.FrontSide;
      // Cycles traces the actual volume. WebGL samples a screen-space buffer;
      // use a shorter effective path to avoid refracting foreground legends twice.
      if (source.name === 'Glass_Clear_IOR_1_47') glass.thickness=.035;
      else if (source.name.startsWith('Key_')) glass.thickness=.0075;
      const physical = studio.materials[source.name];
      if (physical && glass.isMeshPhysicalMaterial) {
        glass.roughness = physical.Roughness;
        glass.ior = physical.IOR;
        glass.clearcoat = physical['Coat Weight'];
        glass.transmission = physical['Transmission Weight'];
        if (physical['Thin Film Thickness'] > 0) {
          glass.iridescence = 1;
          glass.iridescenceIOR = physical['Thin Film IOR'];
          glass.iridescenceThicknessRange = [physical['Thin Film Thickness'],physical['Thin Film Thickness']];
        }
      }
      const real = new THREE.MeshStandardMaterial({name:source.name+'_Real',color:source.color,roughness:.55,metalness:0,side:source.side});
      if (source.name === 'Glass_Clear_IOR_1_47') real.color.setRGB(.29,.31,.28);
      if (source.name.startsWith('Key_')) { real.color.setRGB(.57,.59,.53);real.roughness=.48; }
      if (source.name === 'LCD_Backlight') { real.color.setRGB(.40,.52,.20); real.roughness=.8; }
      if (source.name === 'Legend_Graphite' || source.name === 'LCD_Pixels') real.roughness=.85;
      if (source.name === 'Socket_Graphite') real.roughness=.7;
      // Geometry and textures are shared. No second phone is loaded for the switch.
      pairs.set(source,{real,glass});
    }
    let pair=pairs.get(source);
    if(object.name.startsWith('Keycap_')) {
      pair={real:pair.real.clone(),glass:pair.glass.clone()};
      const baseline=Object.fromEntries(Object.entries(pair).map(([theme,material])=>[
        theme,{color:material.color.clone(),roughness:material.roughness},
      ]));
      keyMaterials.set('Key_'+object.name.slice(7),{pair,baseline});
    }
    object.userData.appearance = pair;
  });
  let current;
  return {
    apply(theme) {
      if (!(theme in environments)) return;
      current = theme;
      model.traverse(object=>{if(object.isMesh) object.material=object.userData.appearance[theme];});
      scene.environment = environments[theme].texture;
      scene.environmentIntensity = theme === 'glass' ? 1 : .8;
      renderer.toneMappingExposure = 1;
    },
    get current(){return current;},
    setKeyFeedback(name,amount) {
      const key=keyMaterials.get(name);if(!key)return;
      for(const theme of ['real','glass']) {
        const material=key.pair[theme],base=key.baseline[theme];
        material.color.copy(base.color).multiplyScalar(1-amount*(theme==='glass'?.22:.16));
        material.roughness=base.roughness+amount*(theme==='glass'?.10:.06);
      }
    },
    dispose(){
      Object.values(environments).forEach(target=>target.dispose());
      for(const [source,pair] of pairs){source.dispose();pair.real.dispose();pair.glass.dispose();}
      for(const {pair} of keyMaterials.values()){pair.real.dispose();pair.glass.dispose();}
    },
  };
}
