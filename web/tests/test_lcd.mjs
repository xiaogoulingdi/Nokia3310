import assert from 'node:assert/strict';
import {test} from 'node:test';
import {phoneFixture} from './phone-fixture.mjs';
import {createLCD,paintScreen,LCD_WIDTH,LCD_HEIGHT} from '../dist/lcd.js';
import {initialPhoneState} from '../dist/phone-state.js';

function fixture() {
  const {root}=phoneFixture(),base=root.getObjectByName('Screen_Display');
  const original=base.material,rects=[],timers=new Map();let time=Date.UTC(2026,9,4,12,0,20),renders=0,serial=0;
  const canvas={getContext:()=>({fillRect:(...args)=>rects.push(args)})};
  const lcd=createLCD({model:root,canvasFactory:()=>canvas,requestRender:()=>renders++,now:()=>new Date(time),setTimer:(fn,delay)=>{timers.set(++serial,{fn,delay});return serial;},clearTimer:id=>timers.delete(id)});
  return {root,base,original,lcd,rects,timers,canvas,get renders(){return renders;},advanceMinute(){time+=60000;const [id,timer]=[...timers][0];timers.delete(id);timer.fn();}};
}

test('dynamic content fits real GLB rounded LCD with square pixels and front-facing depth',()=>{
  const f=fixture();try{
    f.lcd.update(initialPhoneState());const plane=f.base.getObjectByName('LCD_Content'),box=f.base.geometry.boundingBox;
    assert.equal(f.root.getObjectByName('Screen_Preview_Pixels').visible,false);
    assert.ok(plane.position.z>box.max.z);assert.ok(plane.geometry.parameters.width<box.max.x-box.min.x);
    assert.ok(plane.geometry.parameters.height<box.max.y-box.min.y);
    assert.ok(Math.abs(plane.geometry.parameters.width/plane.geometry.parameters.height-LCD_WIDTH/LCD_HEIGHT)<1e-12);
    assert.equal(plane.material.toneMapped,false);assert.equal(plane.material.map.generateMipmaps,false);
  }finally{f.lcd.dispose();}
});

test('one canvas and texture update only on content changes; clock sleeps away from home',()=>{
  const f=fixture();try{
    const state=initialPhoneState();f.lcd.update(state);const plane=f.base.getObjectByName('LCD_Content'),texture=plane.material.map;
    assert.equal(f.lcd.diagnostics.draws,1);f.lcd.update({...state});assert.equal(f.renders,1);assert.equal(f.timers.size,1);
    f.advanceMinute();assert.equal(f.lcd.diagnostics.draws,2);assert.equal(f.timers.size,1);
    f.lcd.update({...state,page:'menu'});assert.equal(f.timers.size,0);const draws=f.lcd.diagnostics.draws;
    f.lcd.update({...state,page:'menu'});assert.equal(f.lcd.diagnostics.draws,draws);assert.equal(plane.material.map,texture);
  }finally{f.lcd.dispose();}
});

test('hidden updates defer drawing, then resume once; disposal restores GLB and frees owned resources',()=>{
  const f=fixture();f.lcd.update(initialPhoneState());f.lcd.setVisible(false);assert.equal(f.timers.size,0);
  const count=f.renders;f.lcd.update({...initialPhoneState(),theme:'glass',page:'digits',digits:'123'});assert.equal(f.renders,count);
  f.lcd.setVisible(true);assert.equal(f.renders,count+1);assert.equal(f.timers.size,0);
  const plane=f.base.getObjectByName('LCD_Content'),released=[];
  for(const value of [plane.geometry,plane.material,plane.material.map,f.base.material])value.addEventListener('dispose',()=>released.push(value));
  f.lcd.dispose();f.lcd.dispose();assert.equal(released.length,4);assert.equal(f.base.material,f.original);
  assert.equal(f.base.getObjectByName('LCD_Content'),undefined);assert.equal(f.root.getObjectByName('Screen_Preview_Pixels').visible,true);
});

test('all pages, selections and a full 32-digit entry remain inside LCD pixel bounds',()=>{
  for(const theme of ['real','glass'])for(const page of ['home','menu','digits','digit-options','settings','about'])for(const index of [0,1,2,3]){
    const rects=[];paintScreen({fillRect:(...r)=>rects.push(r)},{...initialPhoneState(),theme,page,menuIndex:index,settingsIndex:index%2,optionsIndex:index%2,digits:'12345678901234567890123456789012',soundEnabled:false},new Date(2026,9,4,23,59));
    assert.ok(rects.length>20);for(const [x,y,w,h] of rects){assert.ok(x>=0&&y>=0&&x+w<=LCD_WIDTH&&y+h<=LCD_HEIGHT,`${page}: ${[x,y,w,h]}`);}
  }
});

test('six-week calendars, selected dates and detail screens fit the LCD in both themes',()=>{
  for(const theme of ['real','glass'])for(const view of ['month','day'])for(const date of ['2026-03-01','2026-03-31','2024-02-29','0001-01-01','9999-12-31']){
    const rects=[];paintScreen({fillRect:(...r)=>rects.push(r)},{...initialPhoneState({},date),theme,page:'calendar',calendar:{selected:date,today:date,view}});
    for(const [x,y,w,h] of rects)assert.ok(x>=0&&y>=0&&x+w<=LCD_WIDTH&&y+h<=LCD_HEIGHT,`${date} ${view}: ${[x,y,w,h]}`);
  }
});

test('calendar month changes reuse the LCD texture and never schedule a render timer',()=>{
  const f=fixture();try{
    const state={...initialPhoneState({},'2026-10-04'),page:'calendar'};f.lcd.update(state);
    const texture=f.base.getObjectByName('LCD_Content').material.map;assert.equal(f.timers.size,0);
    for(let i=0;i<40;i++)f.lcd.update({...state,calendar:{...state.calendar,selected:i%2?'2026-10-05':'2026-10-04'}});
    assert.equal(f.base.getObjectByName('LCD_Content').material.map,texture);assert.equal(f.timers.size,0);
    const draws=f.lcd.diagnostics.draws;f.lcd.update({...state,calendar:{...state.calendar,selected:'2026-10-05'}});
    assert.equal(f.lcd.diagnostics.draws,draws);
  }finally{f.lcd.dispose();}
});
