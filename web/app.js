import { createViewer } from './viewer.js?v=20261004-calendar-1';
import { createViewModes } from './view-modes.js?v=20261004-calendar-1';
import { bindPhoneInput } from './input.js?v=20261004-calendar-1';
import { bindThemeSwitch } from './theme-switch.js?v=20261004-calendar-1';
import { createKeySound } from './key-sound.js?v=20261004-calendar-1';
import { createPhoneState } from './phone-state.js?v=20261004-calendar-1';

const container=document.querySelector('#canvas-container'),loading=document.querySelector('#loading'),label=document.querySelector('#loading-label');
const status=document.querySelector('#key-status'),instructions=document.querySelector('#instructions');
const screenSummary=document.querySelector('#screen-summary');
const modeButton=document.querySelector('#mode-toggle'),pauseButton=document.querySelector('#rotation-toggle');
const soundButton=document.querySelector('#sound-toggle'),themeButton=document.querySelector('#theme-switch');
const media=matchMedia('(prefers-reduced-motion: reduce)'),listeners=[];
let viewer,modes,input,themeSwitch,disposed=false,statusTimer,lastAction=null,actionCount=0;
const counts={},keyLabel=key=>({up:'↑ 向上',down:'↓ 向下',menu:'Menu',clear:'C',star:'*',hash:'#'})[key]??key;
let soundEnabled=true;
try{soundEnabled=localStorage.getItem('nokia3310.sound-enabled')!=='false';}catch{}
const sound=createKeySound({enabled:soundEnabled});
const phone=createPhoneState({preferences:{soundEnabled},onChange:state=>{
  if(themeSwitch && themeSwitch.current!==state.theme)themeSwitch.select(state.theme);
  if(sound.diagnostics.enabled!==state.soundEnabled)setSound(state.soundEnabled);
  viewer?.setScreen(state);syncInstructions();
}});
function syncSound(){soundButton.setAttribute('aria-pressed',String(sound.diagnostics.enabled));soundButton.title=sound.diagnostics.enabled?'关闭按键声音':'开启按键声音';soundButton.disabled=!sound.supported;}
function setSound(enabled){
  sound.setEnabled(enabled);syncSound();
  try{localStorage.setItem('nokia3310.sound-enabled',String(enabled));}catch{}
  phone.setPreferences({soundEnabled:enabled});
}
function syncInstructions(){
  const mode=document.body.dataset.mode,page=phone.state.page;
  const hints={home:'数字键开始输入 · Menu 打开菜单',digits:'C 删除 · 空白时 C 返回 · Menu 选项',settings:'↑ ↓ 选择 · Menu 更改 · C 返回',about:'Menu 或 C 返回菜单',
    calendar:phone.state.calendar.view==='day'?'↑ ↓ 换日 · 0 今天 · Menu / C 返回月历':'↑ ↓ 换日 · * / # 换月 · 0 今天\n2 / 8 换周 · Menu 日期 · C 返回'};
  instructions.textContent=mode==='use'?(hints[page]??'↑ ↓ 选择 · Menu 确认 · C 返回'):mode==='showcase'?'拖动观察 · 滚轮或双指缩放':'正在调整视角';
}
syncSound();
function listen(target,name,fn){target.addEventListener(name,fn);listeners.push(()=>target.removeEventListener(name,fn));}
function cancelInput(){input?.cancelAll();viewer?.resetKeys();sound.hush();clearTimeout(statusTimer);status.textContent='';}
function modeChanged({mode,paused,reducedMotion}){
  const previous=document.body.dataset.mode;document.body.dataset.mode=mode;
  const transitioning=mode==='entering-use'||mode==='leaving-use';
  modeButton.disabled=transitioning;
  modeButton.textContent=({showcase:'开始使用',use:'回到展示','entering-use':'正在进入…','leaving-use':'正在返回…'})[mode];
  pauseButton.hidden=mode!=='showcase'||reducedMotion;pauseButton.disabled=false;
  pauseButton.textContent=paused?'继续旋转':'暂停旋转';pauseButton.setAttribute('aria-pressed',String(paused));
  syncInstructions();
  if(viewer){viewer.element.tabIndex=mode==='use'?0:-1;if(mode==='use'&&previous==='entering-use')viewer.element.focus({preventScroll:true});}
}
// Only accepted actions reach the phone state; down/up control physical feedback.
// 只有确认后的动作进入手机状态，按下／抬起仅控制实体键帽，避免重复输入。
function handleInput(event){
  if(event.phase==='down')viewer.hold(event.key);
  if(event.phase==='up'||event.phase==='cancel')viewer.release(event.key);
  if(event.phase!=='activate'&&event.phase!=='repeat')return;
  if(!modes.isUsing)return;
  lastAction={key:event.key,phase:event.phase,source:event.source};actionCount++;counts[event.key]=(counts[event.key]??0)+1;
  phone.dispatch(event);
  if(event.phase==='activate'||event.first)sound.play(event.physicalKey,themeSwitch.current);
  status.textContent=`${keyLabel(event.key)}${event.phase==='repeat'?' · 连续按住':' · 已轻触'}`;
  clearTimeout(statusTimer);statusTimer=setTimeout(()=>{status.textContent='';},1100);
}
function setVisible(value){cancelInput();modes?.setVisible(value);viewer?.setVisible(value);}
listen(soundButton,'click',()=>{
  setSound(!sound.diagnostics.enabled);
  if(sound.diagnostics.enabled)void sound.prepare();
});
listen(modeButton,'click',()=>{if(modes?.toggle()&&document.body.dataset.mode==='leaving-use')modeButton.focus({preventScroll:true});});
listen(pauseButton,'click',()=>modes?.togglePause());
listen(media,'change',()=>modes?.setReducedMotion(media.matches));
listen(document,'visibilitychange',()=>setVisible(!document.hidden));
listen(window,'blur',()=>setVisible(false));listen(window,'focus',()=>setVisible(!document.hidden));
listen(window,'pagehide',event=>{if(event.persisted)setVisible(false);else disposeViewer();});
listen(window,'pageshow',()=>{if(!disposed)setVisible(!document.hidden);});
function showError(error){
  console.error('Viewer setup failed',error);document.body.dataset.ready='error';
  loading.hidden=false;loading.classList.add('error');label.classList.remove('sr-only');label.textContent='手机加载失败，请刷新页面重试。';modeButton.disabled=true;
}
try{
  viewer=createViewer({container,onProgress:percent=>{label.textContent=`正在加载模型 ${percent}%`;},onScreenSummary:text=>{screenSummary.textContent=text;}});
  themeSwitch=bindThemeSwitch(themeButton,theme=>{viewer.setTheme(theme);phone.setPreferences({theme});});
  viewer.ready.then(ready=>{
    if(!ready||disposed)return;
    viewer.setScreen(phone.state);
    modes=createViewModes({camera:viewer.camera,controls:viewer.controls,requestRender:viewer.requestRender,onChange:modeChanged,onCancel:cancelInput,reducedMotion:media.matches});
    viewer.setDriver(dt=>modes.update(dt));
    input=bindPhoneInput({element:viewer.element,enabled:()=>modes.isUsing,pick:viewer.pick,emit:handleInput,prepare:()=>void sound.prepare()});
    document.body.dataset.ready='true';loading.hidden=true;themeButton.disabled=false;
    if(document.hidden)setVisible(false);
  }).catch(showError);
}catch(error){showError(error);}

export function getViewerDiagnostics(){return {...viewer?.diagnostics,phone:phone.state,mode:modes?.diagnostics,input:input?.diagnostics,sound:sound.diagnostics,actions:{count:actionCount,last:lastAction,counts:{...counts}}};}
export function disposeViewer(){
  if(disposed)return;disposed=true;clearTimeout(statusTimer);input?.dispose();modes?.dispose();themeSwitch?.dispose();sound.dispose();viewer?.dispose();listeners.forEach(remove=>remove());
}
