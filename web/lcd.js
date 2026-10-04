import * as THREE from './vendor/three/three.module.js';
import {describeScreen, DIGIT_LIMIT, MENU_ITEMS} from './phone-state.js?v=20261004-snake-1';
import {paintCalendar} from './apps/calendar-screen.js?v=20261004-snake-1';
import {paintSnake} from './apps/snake-screen.js?v=20261004-snake-1';

export const LCD_WIDTH = 84, LCD_HEIGHT = 64;
// Compact 5x7 bitmaps keep pixels sharp without external fonts or text meshes.
// 小型 5x7 字模保持点阵清晰，不下载字体，也不为文字创建三维网格。
const FONT = {
  '0':'0E11131519110E','1':'040C040404040E','2':'0E11010204081F','3':'1E01010E01011E',
  '4':'02060A121F0202','5':'1F10101E01011E','6':'0E10101E11110E','7':'1F010204080808',
  '8':'0E11110E11110E','9':'0E11110F01010E',
  A:'0E11111F111111',B:'1E11111E11111E',C:'0F10101010100F',D:'1E11111111111E',
  E:'1F10101E10101F',F:'1F10101E101010',G:'0F10101711110F',H:'1111111F111111',
  I:'0E04040404040E',J:'0702020212120C',K:'11121418141211',L:'1010101010101F',
  M:'111B1515111111',N:'11191915131311',O:'0E11111111110E',P:'1E11111E101010',
  Q:'0E11111115120D',R:'1E11111E141211',S:'0F10100E01011E',T:'1F040404040404',
  U:'1111111111110E',V:'11111111110A04',W:'11111115151B11',X:'11110A040A1111',
  Y:'11110A04040404',Z:'1F01020408101F',
  ':':'00040400040400','/':'01010204081010','-':'0000001F000000','*':'00150E1F0E1500',
  '#':'0A0A1F0A1F0A0A','>':'10080402040810','<':'01020408040201',' ':'00000000000000',
};
export const LCD_COLORS = {real:{background:'#adb986',ink:'#26351f'},glass:{background:'#c1cea7',ink:'#2d432c'}};
const textWidth = (text, scale=1) => Math.max(0, text.length * 6 - 1) * scale;

export function paintScreen(ctx, state, date = new Date()) {
  const {background, ink} = LCD_COLORS[state.theme];
  ctx.fillStyle = background; ctx.fillRect(0, 0, LCD_WIDTH, LCD_HEIGHT);
  const rect = (x,y,w,h,color=ink) => {ctx.fillStyle=color;ctx.fillRect(x,y,w,h);};
  function text(value,x,y,scale=1,color=ink) {
    for (const char of value.toUpperCase()) {
      const rows = FONT[char] ?? FONT[' '];
      for (let row=0;row<7;row++) {
        const bits=parseInt(rows.slice(row*2,row*2+2),16);
        for(let col=0;col<5;col++) if(bits & (1 << (4-col))) rect(x+col*scale,y+row*scale,scale,scale,color);
      }
      x += 6*scale;
    }
  }
  const centered = (value,y,scale=1) => text(value,Math.floor((LCD_WIDTH-textWidth(value,scale))/2),y,scale);
  function header(title) {text(title,3,3);rect(2,13,80,1);}
  function footer(label) {rect(2,51,80,1);centered(label,55);}
  function rows(items, selected) {
    items.forEach((label,i)=>{
      const y=17+i*11;
      if(i===selected)rect(2,y-1,80,10);
      text(label,5,y,1,i===selected?background:ink);
    });
  }
  if (state.page === 'home') {
    // Decorative status icons, not measurements of battery or network strength.
    // 状态图标仅作复古装饰，不表示设备实际电量或信号。
    for(let i=0;i<4;i++)rect(3+i*3,11-(i+1)*2,2,(i+1)*2);
    const time=String(date.getHours()).padStart(2,'0')+':'+String(date.getMinutes()).padStart(2,'0');
    text(time,32,3);rect(70,3,10,7);rect(71,4,8,5,background);rect(72,5,6,3);rect(80,5,1,3);
    centered('NOKIA',21,2);
    const months=['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
    centered(`${String(date.getDate()).padStart(2,'0')} ${months[date.getMonth()]} ${date.getFullYear()}`,41);
    footer('MENU');
  } else if (state.page === 'menu') {
    const start=Math.max(0,Math.min(state.menuIndex-1,MENU_ITEMS.length-3));
    header(`MENU ${state.menuIndex+1}/${MENU_ITEMS.length}`);
    rows(MENU_ITEMS.slice(start,start+3).map(item=>item.label),state.menuIndex-start);
    if(start>0)text('<',75,3);else if(start+3<MENU_ITEMS.length)text('>',75,3);
    footer('SELECT');
  } else if (state.page === 'calendar') {
    paintCalendar({rect,text,centered,header,footer,ink,background},state.calendar);
  } else if (state.page === 'games') {
    header('GAMES');rows(['SNAKE'],0);footer('SELECT');
  } else if (state.page === 'snake') {
    paintSnake({rect,text,centered,header,footer,ink,background},state.snake);
  } else if (state.page === 'digits') {
    header(state.digits.length === DIGIT_LIMIT ? 'FULL 32/32' : `DIGITS ${state.digits.length}/32`);
    if (!state.digits) {centered('TYPE A',22);centered('NUMBER',33);}
    else if (state.digits.length <= 6) text(state.digits,81-textWidth(state.digits,2),24,2);
    else for(let line=0;line<3;line++)text(state.digits.slice(line*12,line*12+12),4,17+line*11);
    footer('OPTIONS');
  } else if (state.page === 'digit-options') {
    header('OPTIONS');rows(['CLEAR ALL','MAIN MENU'],state.optionsIndex);footer('SELECT');
  } else if (state.page === 'settings') {
    header('SETTINGS');rows([`THEME ${state.theme==='glass'?'GLASS':'REAL'}`,`KEY TONE ${state.soundEnabled?'ON':'OFF'}`],state.settingsIndex);
    centered('MENU: CHANGE',41);footer('CHANGE');
  } else {
    header('ABOUT');centered('NOKIA 3310',18);centered('RETRO PHONE',29);centered('2026',40);footer('BACK');
  }
}

export function createLCD({model,requestRender,onSummary=()=>{},now=()=>new Date(),canvasFactory=()=>document.createElement('canvas'),setTimer=setTimeout,clearTimer=clearTimeout}) {
  const base=model.getObjectByName('Screen_Display'),preview=model.getObjectByName('Screen_Preview_Pixels');
  if (!base?.isMesh) throw Error('Screen_Display is missing');
  const originalMaterial=base.material,originalPreview=preview?.visible;
  const canvas=canvasFactory();canvas.width=LCD_WIDTH;canvas.height=LCD_HEIGHT;
  const ctx=canvas.getContext('2d');if(!ctx)throw Error('LCD Canvas 2D is unavailable');ctx.imageSmoothingEnabled=false;
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  texture.magFilter=texture.minFilter=THREE.NearestFilter;texture.generateMipmaps=false;
  const material=new THREE.MeshBasicMaterial({map:texture,toneMapped:false});
  const backing=new THREE.MeshBasicMaterial({toneMapped:false});
  // A square-pixel content plane fits inside the existing rounded LCD substrate.
  // 方形像素显示面放入现有圆角 LCD 基座内，独立 UV，保留正常深度遮挡。
  base.geometry.computeBoundingBox();const box=base.geometry.boundingBox, width=(box.max.x-box.min.x)*.94;
  const geometry=new THREE.PlaneGeometry(width,width*LCD_HEIGHT/LCD_WIDTH);
  const plane=new THREE.Mesh(geometry,material);plane.name='LCD_Content';plane.userData.lcdOwned=true;
  plane.position.set((box.min.x+box.max.x)/2,(box.min.y+box.max.y)/2,box.max.z+.00035);
  base.add(plane);base.userData.lcdOwned=true;base.material=backing;if(preview)preview.visible=false;
  let state,visible=true,disposed=false,timer=null,signature='',draws=0,summary='';
  function schedule() {
    if(timer!==null)clearTimer(timer);timer=null;
    if(!disposed&&visible&&state?.page==='home')timer=setTimer(()=>{timer=null;draw();},60000-now().getTime()%60000+10);
  }
  function draw() {
    if(disposed||!state||!visible)return;
    const date=now(),key=JSON.stringify(state)+(state.page==='home'?Math.floor(date.getTime()/60000):'');
    if(key!==signature){
      signature=key;paintScreen(ctx,state,date);backing.color.set(LCD_COLORS[state.theme].background);
      texture.needsUpdate=true;draws++;requestRender();
      const nextSummary=describeScreen(state);if(nextSummary!==summary){summary=nextSummary;onSummary(summary);}
    }
    schedule();
  }
  return {
    update(value){state={...value};draw();},
    setVisible(value){visible=value;if(value)draw();else if(timer!==null){clearTimer(timer);timer=null;}},
    get diagnostics(){return {width:LCD_WIDTH,height:LCD_HEIGHT,draws,textureVersion:texture.version,clockTimer:timer!==null,summary,previewHidden:preview?.visible===false};},
    dispose(){if(disposed)return;disposed=true;if(timer!==null)clearTimer(timer);timer=null;base.remove(plane);delete base.userData.lcdOwned;base.material=originalMaterial;if(preview)preview.visible=originalPreview;geometry.dispose();material.dispose();backing.dispose();texture.dispose();},
  };
}
