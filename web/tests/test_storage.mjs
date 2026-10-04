import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createPreferencesStore,STORAGE_KEY} from '../dist/storage.js';
function memoryStorage(entries=[]){const map=new Map(entries);return {getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value)};}

test('legacy mute preference migrates and validated settings survive another instance',()=>{
  const storage=memoryStorage([['nokia3310.sound-enabled','false']]);const first=createPreferencesStore({storage});
  assert.equal(first.value.soundEnabled,false);assert.equal(first.diagnostics.writes,0);
  first.save({...first.value,theme:'glass',snakeDifficulty:'fast',snakeScores:{easy:3,normal:7,fast:9}});
  const second=createPreferencesStore({storage});assert.deepEqual(second.value,first.value);
  const snapshot=second.value;snapshot.snakeScores.fast=999;assert.equal(second.value.snakeScores.fast,9);
});

test('unchanged values cause no writes during game ticks',()=>{
  const store=createPreferencesStore({storage:memoryStorage()});for(let i=0;i<100;i++)assert.equal(store.save(store.value),false);
  assert.equal(store.diagnostics.writes,0);store.save({...store.value,snakeScores:{normal:1}});assert.equal(store.diagnostics.writes,1);
});

test('malformed, future or unsafe stored values cannot corrupt the app state',()=>{
  for(const raw of ['{broken','null',JSON.stringify({version:2,theme:'glass'}),JSON.stringify({version:1,theme:'bad',snakeDifficulty:'constructor',snakeScores:{easy:-1,normal:9999,fast:'4'},unknown:'ignored'})]){
    const store=createPreferencesStore({storage:memoryStorage([[STORAGE_KEY,raw]])});
    assert.equal(store.value.theme,'real');assert.equal(store.value.snakeDifficulty,'normal');assert.deepEqual(store.value.snakeScores,{easy:0,normal:0,fast:0});assert.equal('unknown' in store.value,false);
  }
});

test('denied or full storage falls back to session data without throwing',()=>{
  const storage={getItem(){throw Error('denied');},setItem(){throw Error('quota');}};
  const store=createPreferencesStore({storage});assert.equal(store.diagnostics.available,false);
  assert.doesNotThrow(()=>store.save({...store.value,theme:'glass',snakeScores:{normal:9}}));
  assert.equal(store.value.snakeScores.normal,9);assert.equal(store.diagnostics.available,false);
});
