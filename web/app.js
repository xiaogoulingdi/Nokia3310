import { createViewer } from './viewer.js?v=20261004-snake-1';
import { createViewModes } from './view-modes.js?v=20261004-snake-1';
import { bindPhoneInput } from './input.js?v=20261004-snake-1';
import { bindThemeSwitch } from './theme-switch.js?v=20261004-snake-1';
import { createKeySound } from './key-sound.js?v=20261004-snake-1';
import { createPhoneState } from './phone-state.js?v=20261004-snake-1';
import { createGameClock } from './game-clock.js?v=20261004-snake-1';
import { createPreferencesStore } from './storage.js?v=20261004-snake-1';
import { LEVELS,snakeDirection } from './apps/snake.js?v=20261004-snake-1';

const container=document.querySelector('#canvas-container'),loading=document.querySelector('#loading'),label=document.querySelector('#loading-label');
const status=document.querySelector('#key-status'),instructions=document.querySelector('#instructions');
const screenSummary=document.querySelector('#screen-summary');
const modeButton=document.querySelector('#mode-toggle'),pauseButton=document.querySelector('#rotation-toggle');
const soundButton=document.querySelector('#sound-toggle'),themeButton=document.querySelector('#theme-switch');
const media=matchMedia('(prefers-reduced-motion: reduce)'),listeners=[];
let viewer,modes,input,themeSwitch,disposed=false,statusTimer,lastAction=null,actionCount=0,pageVisible=!document.hidden;
const counts={},keyLabel=key=>({up:'↑ 向上',down:'↓ 向下',menu:'Menu',clear:'C',star:'*',hash:'#'})[key]??key;
const preferences=createPreferencesStore();
const sound=createKeySound({enabled:preferences.value.soundEnabled});
const gameClock=createGameClock({tick:()=>phone.tick()});
const phone=createPhoneState({preferences:preferences.value,onChange:(state,previous)=>{
  if(themeSwitch && themeSwitch.current!==state.theme)themeSwitch.select(state.theme);
  if(sound.diagnostics.enabled!==state.soundEnabled)setSound(state.soundEnabled);
  preferences.save({theme:state.theme,soundEnabled:state.soundEnabled,snakeDifficulty:state.snake.difficulty,snakeScores:state.snake.highScores});
  if(previous.snake.status==='running'&&state.snake.status!=='running')cancelInput();
  viewer?.setScreen(state);syncInstructions(state);syncGame(state);
}});
function syncSound(){soundButton.setAttribute('aria-pressed',String(sound.diagnostics.enabled));soundButton.title=sound.diagnostics.enabled?'关闭按键声音':'开启按键声音';soundButton.disabled=!sound.supported;}
function setSound(enabled){
  sound.setEnabled(enabled);syncSound();
  phone.setPreferences({soundEnabled:enabled});
}
function syncGame(state=phone.state){
  gameClock.sync(state.page==='snake'&&state.snake.status==='running'&&!!modes?.isUsing&&pageVisible,LEVELS[state.snake.difficulty].step);
}
function syncInstructions(state=phone.state){
  const mode=document.body.dataset.mode,page=state.page;
  const hints={home:'数字键开始输入 · Menu 打开菜单',digits:'C 删除 · 空白时 C 返回 · Menu 选项',settings:'↑ ↓ 选择 · Menu 更改 · C 返回',about:'Menu 或 C 返回菜单',
    calendar:state.calendar.view==='day'?'↑ ↓ 换日 · 0 今天 · Menu / C 返回月历':'↑ ↓ 换日 · * / # 换月 · 0 今天\n2 / 8 换周 · Menu 日期 · C 返回',
    games:'Menu 打开贪吃蛇 · C 返回',snake:({ready:'↑ ↓ 难度 · Menu 开始\n2 ↑ · 4 ← · 6 → · 8 ↓',running:'2 ↑ · 4 ← · 6 → · 8 ↓\nMenu 暂停 · C 暂停后返回',paused:'Menu 继续 · C 返回 · 5 重开',over:'Menu 再玩一次 · 5 选难度 · C 返回',won:'Menu 再玩一次 · 5 选难度 · C 返回'})[state.snake.status]};
  instructions.textContent=mode==='use'?(hints[page]??'↑ ↓ 选择 · Menu 确认 · C 返回'):mode==='showcase'?'拖动观察 · 滚轮或双指缩放':'正在调整视角';
}
syncSound();
function listen(target,name,fn){target.addEventListener(name,fn);listeners.push(()=>target.removeEventListener(name,fn));}
function cancelInput(){input?.cancelAll();viewer?.resetKeys();sound.hush();clearTimeout(statusTimer);status.textContent='';}
function modeChanged({mode,paused,reducedMotion}){
  const previous=document.body.dataset.mode;document.body.dataset.mode=mode;
  if(mode!=='use')phone.pauseGame();
  const transitioning=mode==='entering-use'||mode==='leaving-use';
  modeButton.disabled=transitioning;
  modeButton.textContent=({showcase:'开始使用',use:'回到展示','entering-use':'正在进入…','leaving-use':'正在返回…'})[mode];
  pauseButton.hidden=mode!=='showcase'||reducedMotion;pauseButton.disabled=false;
  pauseButton.textContent=paused?'继续旋转':'暂停旋转';pauseButton.setAttribute('aria-pressed',String(paused));
  syncInstructions();syncGame();
  if(viewer){viewer.element.tabIndex=mode==='use'?0:-1;if(mode==='use'&&previous==='entering-use'){
    viewer.element.focus({preventScroll:true});
  }}
}
// Menus commit on release; live Snake steering commits once on key-down.
// 菜单在松开时确认，贪吃蛇转向在按下时立即提交一次。
function handleInput(event){
  if(event.phase==='down')viewer.hold(event.key);
  if(event.phase==='up'||event.phase==='cancel')viewer.release(event.key);
  if(!modes.isUsing)return;
  // Snake turns on key-down; the corresponding release must not turn a second time.
  // 游戏转向在按下时响应，松开或长按重复不再提交第二次转向。
  const game=phone.state,steering=game.page==='snake'&&snakeDirection(event.key)&&game.snake.status==='running';
  if(steering){
    if(event.phase==='down')event={...event,phase:'activate'};
    else return;
  }else if(event.phase!=='activate'&&event.phase!=='repeat')return;
  lastAction={key:event.key,phase:event.phase,source:event.source};actionCount++;counts[event.key]=(counts[event.key]??0)+1;
  phone.dispatch(event);
  if(event.phase==='activate'||event.first)sound.play(event.physicalKey,themeSwitch.current);
  status.textContent=`${keyLabel(event.key)}${event.phase==='repeat'?' · 连续按住':' · 已轻触'}`;
  clearTimeout(statusTimer);statusTimer=setTimeout(()=>{status.textContent='';},1100);
}
function setVisible(value){pageVisible=value;if(!value)phone.pauseGame();cancelInput();modes?.setVisible(value);viewer?.setVisible(value);syncGame();}
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
    modes=createViewModes({camera:viewer.camera,controls:viewer.controls,useZoom:viewer.getUseZoom,requestRender:viewer.requestRender,onChange:modeChanged,onCancel:cancelInput,reducedMotion:media.matches});
    viewer.setDriver(dt=>modes.update(dt));
    input=bindPhoneInput({element:viewer.element,enabled:()=>modes.isUsing,pick:viewer.pick,emit:handleInput,prepare:()=>void sound.prepare()});
    themeSwitch.select(phone.state.theme);syncGame();
    document.body.dataset.ready='true';loading.hidden=true;themeButton.disabled=false;
    if(document.hidden)setVisible(false);
  }).catch(showError);
}catch(error){showError(error);}

export function getViewerDiagnostics(){return {...viewer?.diagnostics,phone:phone.state,mode:modes?.diagnostics,input:input?.diagnostics,sound:sound.diagnostics,gameClock:gameClock.diagnostics,storage:preferences.diagnostics,actions:{count:actionCount,last:lastAction,counts:{...counts}}};}
export function disposeViewer(){
  if(disposed)return;disposed=true;clearTimeout(statusTimer);gameClock.dispose();input?.dispose();modes?.dispose();themeSwitch?.dispose();sound.dispose();viewer?.dispose();listeners.forEach(remove=>remove());
}
