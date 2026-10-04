import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createInputState,keyboardKey} from '../dist/input.js';
function fixture(){
  let time=0,serial=0;const timers=new Map(),events=[];
  const state=createInputState({emit:e=>events.push(e),now:()=>time,setTimer:(fn,delay)=>{timers.set(++serial,{fn,due:time+delay});return serial;},clearTimer:id=>timers.delete(id)});
  return {state,events,timers,advance(ms){const end=time+ms;while(true){const next=[...timers].sort((a,b)=>a[1].due-b[1].due)[0];if(!next||next[1].due>end)break;time=next[1].due;timers.delete(next[0]);next[1].fn();}time=end;}};
}
const hit=key=>({key,physicalKey:['up','down'].includes(key)?'Key_Scroll':'Key_'+key});
test('short click commits once and physical keyboard/pointer duplicates are rejected',()=>{
  const {state,events}=fixture();assert.equal(state.begin('pointer',hit('5'),'pointer'),true);assert.equal(state.begin('keyboard',hit('5'),'keyboard'),false);
  state.end('pointer');state.end('pointer');assert.deepEqual(events.map(e=>e.phase),['down','up','activate']);
});
test('holding a direction repeats at 400/120 ms and does not append a release click',()=>{
  const {state,events,advance,timers}=fixture();state.begin('up',hit('up'),'keyboard');advance(399);assert.equal(events.length,1);
  advance(241);assert.equal(events.filter(e=>e.phase==='repeat').length,3);state.end('up');advance(1000);
  assert.equal(events.filter(e=>e.phase==='activate').length,0);assert.equal(timers.size,0);
  assert.deepEqual(events.filter(e=>e.phase==='repeat').map(e=>e.first),[true,false,false]);
});
test('opposite rocker halves cannot be held at once; cancellation never commits',()=>{
  const {state,events,advance,timers}=fixture();state.begin('a',hit('up'),'pointer');assert.equal(state.begin('b',hit('down'),'keyboard'),false);
  advance(200);state.cancelAll();advance(2000);assert.deepEqual(events.map(e=>e.phase),['down','cancel']);assert.equal(timers.size,0);
  assert.equal(state.begin('b',hit('down'),'keyboard'),true);state.dispose();assert.equal(state.begin('c',hit('3'),'keyboard'),false);
});
test('non-direction long holds do not repeat and multiple independent keys are released on cancel',()=>{
  const {state,events,advance}=fixture();state.begin('a',hit('1'),'keyboard');state.begin('b',hit('2'),'keyboard');advance(3000);state.cancelAll();
  assert.equal(events.filter(e=>e.phase==='repeat'||e.phase==='activate').length,0);assert.deepEqual(state.diagnostics.held,[]);
});
test('keyboard mapping preserves browser shortcuts and composition',()=>{
  for(const [key,result] of Object.entries({'8':'8','*':'star','#':'hash',ArrowUp:'up',ArrowDown:'down',Enter:'menu',Backspace:'clear'}))assert.equal(keyboardKey({key}),result);
  for(const modifier of ['ctrlKey','metaKey','altKey','isComposing'])assert.equal(keyboardKey({key:'5',[modifier]:true}),null);
  for(const key of ['Tab','Escape','a','ArrowLeft'])assert.equal(keyboardKey({key}),null);
});
