import assert from 'node:assert/strict';
import {test} from 'node:test';
import {initialPhoneState,reducePhone,createPhoneState,DIGIT_LIMIT,describeScreen} from '../dist/phone-state.js';
const tap=(state,key)=>reducePhone(state,{key,phase:'activate'});
const sequence=(state,keys)=>keys.reduce(tap,state);

test('home -> number input -> delete -> empty -> home is a complete path',()=>{
  let state=sequence(initialPhoneState(),['1','2','star','hash']);
  assert.equal(state.page,'digits');assert.equal(state.digits,'12*#');
  state=sequence(state,['clear','clear','clear','clear']);assert.equal(state.digits,'');assert.equal(state.page,'digits');
  assert.equal(tap(state,'clear').page,'home');
});

test('menu directions wrap, confirm selected entry and C restores parent selection',()=>{
  let state=sequence(initialPhoneState(),['menu','up']);assert.equal(state.menuIndex,4);
  state=tap(state,'menu');assert.equal(state.page,'about');state=tap(state,'clear');
  assert.equal(state.page,'menu');assert.equal(state.menuIndex,4);
  state=sequence(state,['up','up','menu']);assert.equal(state.page,'settings');
  state=tap(state,'clear');assert.equal(state.page,'menu');assert.equal(state.menuIndex,2);
  assert.equal(tap(state,'clear').page,'home');
});

test('digits options can cancel, clear all and return to main menu without losing a draft',()=>{
  let state=sequence(initialPhoneState(),['1','2','menu','down','clear']);
  assert.equal(state.page,'digits');assert.equal(state.digits,'12');
  state=sequence(state,['menu','down','menu']);assert.equal(state.page,'menu');assert.equal(state.digits,'12');
  state=tap(state,'menu');assert.equal(state.page,'digits');assert.equal(state.digits,'12');
  state=sequence(state,['menu','menu']);assert.equal(state.page,'digits');assert.equal(state.digits,'');
});

test('new home entry replaces a retained draft, and input is bounded to 32 symbols',()=>{
  const home={...initialPhoneState(),digits:'old'};let state=tap(home,'8');assert.equal(state.digits,'8');
  for(let n=1;n<40;n++)state=tap(state,String(n%10));assert.equal(state.digits.length,DIGIT_LIMIT);
  assert.equal(tap(state,'1'),state);assert.match(describeScreen(state),/32 位上限/);
  assert.equal(tap(state,'clear').digits.length,31);
});

test('press/release/cancel and unsupported repeat do not become a second business action',()=>{
  const state=initialPhoneState();for(const phase of ['down','up','cancel','repeat'])assert.equal(reducePhone(state,{phase,key:'1'}),state);
  const menu=tap(state,'menu');const next=reducePhone(menu,{phase:'repeat',key:'down'});
  assert.equal(next.menuIndex,1);assert.equal(reducePhone(next,{phase:'up',key:'down'}),next);
});

test('settings and external controls share preferences without redundant notifications',()=>{
  const changes=[];const phone=createPhoneState({onChange:s=>changes.push(s)});
  for(const key of ['menu','down','down','menu','menu'])phone.dispatch({key,phase:'activate'});
  assert.equal(phone.state.theme,'glass');phone.dispatch({key:'down',phase:'activate'});phone.dispatch({key:'menu',phase:'activate'});
  assert.equal(phone.state.soundEnabled,false);const count=changes.length;
  phone.setPreferences({theme:'glass',soundEnabled:false});assert.equal(changes.length,count);
  phone.setPreferences({theme:'real',soundEnabled:true});assert.equal(changes.length,count+1);
  const copy=phone.state;copy.page='broken';assert.equal(phone.state.page,'settings');
});
