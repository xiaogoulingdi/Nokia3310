import assert from 'node:assert/strict';
import {test} from 'node:test';
import {bindPhoneInput} from '../dist/input.js';

// Deterministic DOM adapter tests; these do not simulate a real mobile browser.
// 确定性的 DOM 适配层测试，不将它等同于真实移动浏览器测试。
function fixture() {
  const previousWindow=globalThis.window, previousDocument=globalThis.document;
  const win=new EventTarget(), doc=new EventTarget(), element=new EventTarget();
  globalThis.window=win; globalThis.document=doc;
  const captured=new Set(), events=[];
  let using=true;
  element.focus=()=>{};
  element.setPointerCapture=id=>captured.add(id);
  element.hasPointerCapture=id=>captured.has(id);
  element.releasePointerCapture=id=>captured.delete(id);
  const pick=x=>x<0?null:{key:x<40?'up':x<80?'down':'5',physicalKey:x<80?'Key_Scroll':'Key_5'};
  const input=bindPhoneInput({element,enabled:()=>using,pick,emit:e=>events.push(e),prepare:()=>{}});
  function send(target,type,props={}) {
    const event=new Event(type,{cancelable:true});
    Object.assign(event,{pointerId:1,button:0,clientX:10,clientY:10,...props});
    target.dispatchEvent(event); return event;
  }
  return {element,win,doc,input,events,captured,send,setUsing(value){using=value;},
    accepted(){return events.filter(e=>['activate','repeat'].includes(e.phase));},
    dispose(){input.dispose();globalThis.window=previousWindow;globalThis.document=previousDocument;}};
}

test('pointer captured touch releases once; second touch cancels until every finger lifts',()=>{
  const f=fixture();try {
    f.send(f.element,'pointerdown',{pointerType:'touch'});
    f.send(f.element,'pointerup',{pointerType:'touch'});
    assert.equal(f.accepted().length,1);
    f.send(f.element,'pointerdown',{pointerType:'touch'});
    f.send(f.element,'pointerdown',{pointerType:'touch',pointerId:2,clientX:60});
    assert.deepEqual(f.input.diagnostics.held,[]);
    f.send(f.element,'pointerup'); f.send(f.element,'pointerup',{pointerId:2,clientX:60});
    assert.equal(f.accepted().length,1); assert.equal(f.captured.size,0);
    f.send(f.element,'pointerdown',{clientX:60}); f.send(f.element,'pointerup',{clientX:60});
    assert.equal(f.accepted().at(-1).key,'down');
  } finally {f.dispose();}
});

test('crossing rocker, leaving key, movement threshold and lost capture cancel without commit',()=>{
  const f=fixture();try {
    for(const props of [{clientX:60},{clientX:-1},{clientX:25}]) {
      f.send(f.element,'pointerdown'); f.send(f.element,'pointermove',props); f.send(f.element,'pointerup');
    }
    for(const type of ['pointercancel','lostpointercapture']) {
      f.send(f.element,'pointerdown'); f.send(f.element,type); f.send(f.element,'pointerup');
    }
    assert.equal(f.accepted().length,0); assert.deepEqual(f.input.diagnostics,{held:[],repeatTimer:false,pointers:0});
  } finally {f.dispose();}
});

test('keyboard ignores OS repeat; focus, visibility and mode loss cancel held actions',()=>{
  const f=fixture();try {
    const key={key:'5',code:'Digit5'};
    f.send(f.element,'keydown',key); f.send(f.element,'keydown',{...key,repeat:true}); f.send(f.win,'keyup',key);
    assert.equal(f.accepted().length,1);
    for(const cancel of [()=>f.send(f.element,'blur'),()=>f.send(f.win,'blur'),()=>{f.doc.hidden=true;f.send(f.doc,'visibilitychange');}]) {
      f.doc.hidden=false; f.send(f.element,'keydown',key); cancel(); f.send(f.win,'keyup',key);
      assert.deepEqual(f.input.diagnostics.held,[]);
    }
    f.send(f.element,'keydown',key); f.setUsing(false); f.send(f.win,'keyup',key);
    const blocked=f.send(f.element,'keydown',key); assert.equal(blocked.defaultPrevented,false);
    assert.equal(f.accepted().length,1);
  } finally {f.dispose();}
});

test('disposal removes DOM listeners and releases pointer capture',()=>{
  const f=fixture();try {
    f.send(f.element,'pointerdown'); f.input.dispose(); const count=f.events.length;
    assert.equal(f.captured.size,0); assert.equal(f.input.diagnostics.repeatTimer,false);
    f.send(f.element,'pointerdown'); f.send(f.element,'pointerup');
    assert.equal(f.events.length,count);
  } finally {f.dispose();}
});
