import assert from 'node:assert/strict';
import {test} from 'node:test';
import {initialSnake,startSnake,turnSnake,stepSnake,pauseSnake,foodFor,MAX_SCORE,LEVELS,snakeDirection,reduceSnake} from '../dist/apps/snake.js';
import {createPhoneState,initialPhoneState,reducePhone,MENU_ITEMS} from '../dist/phone-state.js';
import {paintScreen} from '../dist/lcd.js';
import {createGameClock} from '../dist/game-clock.js';
const running=()=>startSnake(initialSnake(),.4);

test('only 2/4/6/8 steer the live game; rocker selects difficulty only before starting',()=>{
  for(const [key,direction] of Object.entries({2:'up',4:'left',6:'right',8:'down'}))assert.equal(snakeDirection(key),direction);
  for(const key of ['up','down','left','right','5','0','menu','clear','toString'])assert.equal(snakeDirection(key),null);
  const state=running();assert.equal(reduceSnake(state,'up'),state);assert.equal(reduceSnake(state,'down'),state);
  assert.deepEqual(reduceSnake(state,'2').queue,['up']);assert.equal(reduceSnake(initialSnake(),'up').difficulty,'easy');
  assert.equal(reduceSnake({...state,status:'paused'},'5').status,'ready');
});

test('starting, moving, eating and records preserve immutable prior state',()=>{
  const initial=initialSnake(),state={...startSnake(initial,.1),food:{x:10,y:6}},before=structuredClone(state);
  const next=stepSnake(state,.6);
  assert.equal(next.score,1);assert.equal(next.body.length,4);assert.deepEqual(next.body[0],{x:10,y:6});
  assert.equal(next.highScores.normal,1);assert.equal(next.highScores.easy,0);assert.deepEqual(state,before);
  assert.equal(next.body.some(p=>p.x===next.food.x&&p.y===next.food.y),false);
});

test('reversal and duplicate turns are ignored, two fast turns run on separate ticks',()=>{
  const start=running();assert.equal(turnSnake(start,'left'),start);assert.equal(turnSnake(start,'right'),start);
  let state=turnSnake(turnSnake(start,'up'),'left');assert.deepEqual(state.queue,['up','left']);
  assert.equal(turnSnake(state,'down'),state);state=stepSnake(state);assert.deepEqual(state.body[0],{x:9,y:5});
  state=stepSnake(state);assert.deepEqual(state.body[0],{x:8,y:5});assert.equal(state.direction,'left');
});

test('wall and self collisions end the game, but the departing tail is a legal cell',()=>{
  const wall={...running(),body:[{x:19,y:6},{x:18,y:6},{x:17,y:6}]};assert.equal(stepSnake(wall).reason,'wall');
  const loop={...running(),direction:'left',body:[{x:1,y:1},{x:1,y:0},{x:0,y:0},{x:0,y:1}],food:{x:10,y:9}};
  assert.equal(stepSnake(loop).status,'running');
  const self={...loop,body:[...loop.body,{x:0,y:2}]};assert.equal(stepSnake(self).reason,'self');
});

test('food placement is bounded, never overlaps, and full board wins without looping',()=>{
  const occupied=Array.from({length:240},(_,i)=>({x:i%20,y:Math.floor(i/20)}));
  assert.equal(foodFor(occupied),null);
  const only=occupied.filter(p=>!(p.x===10&&p.y===6));
  for(const random of [0,1,NaN,-1])assert.deepEqual(foodFor(only,random),{x:10,y:6});
  const state={...running(),body:[{x:9,y:6},...only.filter(p=>!(p.x===9&&p.y===6))],food:{x:10,y:6},score:MAX_SCORE-1};
  const next=stepSnake(state);assert.equal(next.status,'won');assert.equal(next.score,MAX_SCORE);assert.equal(next.food,null);
});

test('paused game is frozen; resume has no stale buffered turn, and records survive a restart',()=>{
  const state={...turnSnake(running(),'up'),score:7,highScores:{easy:1,normal:7,fast:2}};
  const paused=pauseSnake(state);assert.equal(stepSnake(paused),paused);assert.deepEqual(paused.queue,[]);
  const restarted=startSnake(paused);assert.equal(restarted.score,0);assert.deepEqual(restarted.highScores,state.highScores);
});

test('full menu -> games -> snake -> pause -> games -> menu path preserves selection',()=>{
  let state={...initialPhoneState(),page:'menu',menuIndex:MENU_ITEMS.findIndex(x=>x.id==='games')};
  const tap=key=>{state=reducePhone(state,{key,phase:'activate'});};
  tap('menu');assert.equal(state.page,'games');tap('menu');assert.equal(state.page,'snake');
  tap('up');assert.equal(state.snake.difficulty,'easy');tap('menu');assert.equal(state.snake.status,'running');
  tap('clear');assert.equal(state.snake.status,'paused');assert.equal(state.page,'snake');
  tap('clear');assert.equal(state.page,'games');tap('clear');assert.equal(state.page,'menu');assert.equal(MENU_ITEMS[state.menuIndex].id,'games');
});

test('phone tick, pause and snapshots remain isolated across multiple phones',()=>{
  const phone=createPhoneState({random:()=>.3}),other=createPhoneState();
  for(const key of ['menu','up','up','menu','menu','menu'])phone.dispatch({key,phase:'activate'});
  assert.equal(phone.state.snake.status,'running');phone.tick();phone.pauseGame();
  const paused=phone.state;assert.equal(phone.tick(),false);
  paused.snake.body[0].x=-100;paused.snake.highScores.normal=100;
  assert.notEqual(phone.state.snake.body[0].x,-100);assert.equal(other.state.snake.status,'ready');assert.equal(other.state.snake.highScores.normal,0);
});

test('every difficulty, score and game state paints inside the same 84x64 LCD',()=>{
  for(const theme of ['real','glass'])for(const status of ['ready','running','paused','over','won'])for(const difficulty of Object.keys(LEVELS)){
    const rects=[];paintScreen({fillRect:(...r)=>rects.push(r)},{...initialPhoneState(),theme,page:'snake',snake:{...running(),status,difficulty,score:MAX_SCORE,highScores:{easy:237,normal:237,fast:237}}});
    for(const [x,y,w,h] of rects)assert.ok(x>=0&&y>=0&&x+w<=84&&y+h<=64,`${status}: ${[x,y,w,h]}`);
  }
});

test('one game clock survives state updates, stops on pause and disposes without late ticks',()=>{
  const timers=new Map();let serial=0,ticks=0;
  const clock=createGameClock({tick:()=>{ticks++;clock.sync(true,160);},setTimer:(fn,delay)=>{timers.set(++serial,{fn,delay});return serial;},clearTimer:id=>timers.delete(id)});
  clock.sync(true,160);const original=[...timers.keys()][0];for(let i=0;i<20;i++)clock.sync(true,160);
  assert.equal(timers.size,1);assert.equal([...timers.keys()][0],original);
  const first=timers.get(original);timers.delete(original);first.fn();assert.equal(ticks,1);assert.equal(timers.size,1);
  clock.sync(false);assert.equal(timers.size,0);assert.equal(clock.diagnostics.timerActive,false);
  clock.sync(true,110);assert.equal([...timers.values()][0].delay,110);
  const late=[...timers.values()][0];clock.dispose();late.fn();assert.equal(ticks,1);assert.equal(timers.size,0);
});
