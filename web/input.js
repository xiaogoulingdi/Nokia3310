// Input state is independent of Three.js, DOM, sound, accounts and future apps.
export function createInputState({emit,now=()=>performance.now(),setTimer=setTimeout,clearTimer=clearTimeout}) {
  const active=new Map();let timer=null,disposed=false;
  const output=(record,phase,extra={})=>emit({key:record.key,physicalKey:record.physicalKey,source:record.source,phase,time:now(),...extra});
  function schedule(){
    if(timer!==null)clearTimer(timer);timer=null;
    if(disposed)return;
    const due=Math.min(...[...active.values()].map(r=>r.nextRepeat));
    if(Number.isFinite(due))timer=setTimer(tick,Math.max(0,due-now()));
  }
  function tick(){
    timer=null;const time=now();
    for(const record of active.values())if(record.nextRepeat<=time){
      record.repeats++;record.nextRepeat=time+120;
      output(record,'repeat',{first:record.repeats===1});
    }
    schedule();
  }
  function end(token,cancel=false){
    const record=active.get(token);if(!record)return;
    active.delete(token);output(record,cancel?'cancel':'up');
    if(!cancel&&!record.repeats)output(record,'activate');
    schedule();
  }
  return {
    begin(token,hit,source){
      if(disposed||!hit||active.has(token)||[...active.values()].some(r=>r.physicalKey===hit.physicalKey))return false;
      const record={...hit,source,repeats:0,nextRepeat:['up','down'].includes(hit.key)?now()+400:Infinity};
      active.set(token,record);output(record,'down');schedule();return true;
    },
    end,cancel(token){end(token,true);},
    cancelAll(){for(const token of [...active.keys()])end(token,true);},
    dispose(){this.cancelAll();disposed=true;if(timer!==null)clearTimer(timer);timer=null;},
    get diagnostics(){return {held:[...active.values()].map(r=>r.key),repeatTimer:timer!==null};},
  };
}

export function keyboardKey(event) {
  if(event.ctrlKey||event.altKey||event.metaKey||event.isComposing)return null;
  if(/^[0-9]$/.test(event.key))return event.key;
  return ({'*':'star','#':'hash',ArrowUp:'up',ArrowDown:'down',Enter:'menu',Backspace:'clear'})[event.key]??null;
}
const physicalFor=key=>['up','down'].includes(key)?'Key_Scroll':'Key_'+key[0].toUpperCase()+key.slice(1);

export function bindPhoneInput({element,enabled,pick,emit,prepare}) {
  const state=createInputState({emit}),pointers=new Map(),keyboard=new Set(),listeners=[];
  let blocked=false;
  function listen(target,name,fn,options){target.addEventListener(name,fn,options);listeners.push(()=>target.removeEventListener(name,fn,options));}
  function clear(){
    state.cancelAll();keyboard.clear();
    const ids=[...pointers.keys()];pointers.clear();blocked=false;
    for(const id of ids)if(element.hasPointerCapture(id))element.releasePointerCapture(id);
  }
  listen(element,'pointerdown',event=>{
    if(!enabled()||event.button!==0)return;
    event.preventDefault();element.focus({preventScroll:true});
    const hit=pick(event.clientX,event.clientY);
    pointers.set(event.pointerId,{hit,x:event.clientX,y:event.clientY});
    element.setPointerCapture(event.pointerId);
    if(pointers.size>1){blocked=true;state.cancelAll();return;}
    if(!blocked&&hit){prepare();state.begin('p'+event.pointerId,hit,'pointer');}
  });
  listen(element,'pointermove',event=>{
    const record=pointers.get(event.pointerId);if(!record||blocked||!record.hit)return;
    const next=pick(event.clientX,event.clientY);
    if(!enabled()||next?.key!==record.hit.key||Math.hypot(event.clientX-record.x,event.clientY-record.y)>12){
      state.cancel('p'+event.pointerId);record.hit=null;
    }
  });
  function finish(event,cancel){
    const record=pointers.get(event.pointerId);if(!record)return;
    pointers.delete(event.pointerId);
    const same=!cancel&&enabled()&&!blocked&&record.hit&&pick(event.clientX,event.clientY)?.key===record.hit.key;
    state.end('p'+event.pointerId,!same);
    if(element.hasPointerCapture(event.pointerId))element.releasePointerCapture(event.pointerId);
    if(!pointers.size)blocked=false;
  }
  listen(element,'pointerup',event=>finish(event,false));
  listen(element,'pointercancel',event=>finish(event,true));
  listen(element,'lostpointercapture',event=>finish(event,true));
  listen(element,'keydown',event=>{
    const key=keyboardKey(event);
    if(!enabled()||event.target!==element||!key)return;
    event.preventDefault();if(event.repeat)return;
    const token='k'+(event.code||event.key);
    prepare();if(state.begin(token,{key,physicalKey:physicalFor(key)},'keyboard'))keyboard.add(token);
  });
  listen(window,'keyup',event=>{
    const token='k'+(event.code||event.key);if(!keyboard.has(token))return;
    keyboard.delete(token);state.end(token,!enabled());
  });
  listen(element,'blur',clear);listen(window,'blur',clear);
  listen(document,'visibilitychange',()=>{if(document.hidden)clear();});
  listen(element,'contextmenu',event=>event.preventDefault());
  return {cancelAll:clear,get diagnostics(){return {...state.diagnostics,pointers:pointers.size};},dispose(){clear();state.dispose();listeners.forEach(remove=>remove());}};
}
