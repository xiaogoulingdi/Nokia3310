import assert from 'node:assert/strict';
import {test} from 'node:test';
import {daysInMonth,shiftDays,shiftMonths,monthGrid,calendarInfo,localDate} from '../dist/apps/calendar.js';
import {initialPhoneState,reducePhone,createPhoneState,MENU_ITEMS,describeScreen} from '../dist/phone-state.js';
const today='2026-10-04';
const tap=(state,key)=>reducePhone(state,{key,phase:'activate'},{today});
const enter=(date=today)=>tap({...initialPhoneState({},date),page:'menu',menuIndex:MENU_ITEMS.findIndex(x=>x.id==='calendar')},'menu');

test('civil date arithmetic handles leap centuries, DST boundaries and years 1..99',()=>{
  assert.equal(daysInMonth(1900,2),28);assert.equal(daysInMonth(2000,2),29);assert.equal(daysInMonth(2100,2),28);
  assert.equal(shiftDays('2024-02-28',1),'2024-02-29');assert.equal(shiftDays('2024-02-29',1),'2024-03-01');
  assert.equal(shiftDays('2026-03-08',1),'2026-03-09');assert.equal(shiftDays('2026-11-01',1),'2026-11-02');
  assert.equal(shiftDays('2026-01-01',-1),'2025-12-31');assert.equal(shiftDays('0099-12-31',1),'0100-01-01');
  assert.equal(localDate(new Date(2026,9,4,0,15)),today);
});

test('month jumps clamp the day and bound navigation to four-digit positive years',()=>{
  assert.equal(shiftMonths('2024-01-31',1),'2024-02-29');assert.equal(shiftMonths('2025-01-31',1),'2025-02-28');
  assert.equal(shiftMonths('2026-12-31',1),'2027-01-31');assert.equal(shiftMonths('2026-01-31',-1),'2025-12-31');
  assert.equal(shiftMonths('9999-11-30',1),'9999-12-30');assert.equal(shiftMonths('9999-12-31',1),'9999-12-31');
  assert.equal(shiftMonths('0001-01-01',-1),'0001-01-01');
  assert.equal(shiftDays('9999-12-31',1),'9999-12-31');assert.equal(shiftDays('0001-01-01',-1),'0001-01-01');
});

test('Monday-first grid includes all days once, including the sixth week',()=>{
  const grid=monthGrid('2026-03-01');assert.equal(grid.length,42);assert.equal(grid[0],null);assert.equal(grid[6],'2026-03-01');
  assert.equal(grid[36],'2026-03-31');assert.equal(grid.filter(Boolean).length,31);assert.equal(new Set(grid.filter(Boolean)).size,31);
  const feb=monthGrid('2024-02-01');assert.equal(feb.filter(Boolean).length,29);assert.equal(calendarInfo(today).weekdayName,'SUNDAY');
});

test('menu -> calendar -> day -> C -> month -> C -> menu preserves date and menu selection',()=>{
  let state=enter();assert.equal(state.page,'calendar');assert.equal(state.calendar.selected,today);
  state=tap(state,'down');assert.equal(state.calendar.selected,'2026-10-05');
  state=tap(state,'menu');assert.equal(state.calendar.view,'day');state=tap(state,'clear');assert.equal(state.calendar.view,'month');
  state=tap(state,'clear');assert.equal(state.page,'menu');assert.equal(MENU_ITEMS[state.menuIndex].id,'calendar');
  state=tap(state,'menu');assert.equal(state.calendar.selected,'2026-10-05');assert.match(describeScreen(state),/星期一/);
});

test('phone keys move dates, weeks and months without entering digits; repeated arrows move once per accepted event',()=>{
  let state=enter('2026-01-31');state=tap(state,'hash');assert.equal(state.calendar.selected,'2026-02-28');
  state=tap(state,'star');assert.equal(state.calendar.selected,'2026-01-28');
  state=tap(state,'2');assert.equal(state.calendar.selected,'2026-01-21');state=tap(state,'8');assert.equal(state.calendar.selected,'2026-01-28');
  state=tap(state,'4');state=tap(state,'6');assert.equal(state.calendar.selected,'2026-01-28');
  state=reducePhone(state,{key:'up',phase:'repeat'});assert.equal(state.calendar.selected,'2026-01-27');
  for(const phase of ['down','up','cancel','repeat'])assert.equal(reducePhone(state,{key:'hash',phase}),state);
  assert.equal(tap(state,'1'),state);assert.equal(state.digits,'');assert.equal(tap(state,'0').calendar.selected,today);
});

test('today comes from the current client date, and separate phones and snapshots cannot mutate each other',()=>{
  let now=new Date(2026,9,4,23,59),changes=[];
  const a=createPhoneState({now:()=>now,onChange:next=>{changes.push(next);next.calendar.selected='broken';}});
  const b=createPhoneState({now:()=>new Date(2024,1,29)});
  for(const key of ['menu','down','menu'])a.dispatch({key,phase:'activate'});
  now=new Date(2026,9,5,0,1);a.dispatch({key:'0',phase:'activate'});
  assert.equal(a.state.calendar.selected,'2026-10-05');assert.equal(a.state.calendar.today,'2026-10-05');
  const snapshot=a.state;snapshot.calendar.selected='broken';assert.equal(a.state.calendar.selected,'2026-10-05');
  assert.equal(b.state.calendar.selected,'2024-02-29');assert.equal(b.state.page,'home');assert.equal(changes.length,4);
});
