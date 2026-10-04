import {MAX_SCORE,LEVELS} from './apps/snake.js?v=20261004-snake-1';
export const STORAGE_KEY='nokia3310.preferences.v1';
function clean(value={}) {
  return {version:1,theme:value?.theme==='glass'?'glass':'real',soundEnabled:value?.soundEnabled!==false,
    snakeDifficulty:Object.hasOwn(LEVELS,value?.snakeDifficulty)?value.snakeDifficulty:'normal',
    snakeScores:Object.fromEntries(Object.keys(LEVELS).map(key=>{
      const score=value?.snakeScores?.[key];return [key,Number.isInteger(score)&&score>=0&&score<=MAX_SCORE?score:0];
    }))};
}
const copy=value=>({...value,snakeScores:{...value.snakeScores}});
export function createPreferencesStore({storage}={}) {
  let current=clean(),available=true,writes=0;
  try {
    storage??=globalThis.localStorage;
    const raw=storage.getItem(STORAGE_KEY);
    if(raw){const parsed=JSON.parse(raw);current=parsed?.version===1?clean(parsed):clean();}
    else current=clean({soundEnabled:storage.getItem('nokia3310.sound-enabled')!=='false'});
  }catch{available=false;}
  return {
    get value(){return copy(current);},
    save(value){
      const next=clean(value);if(JSON.stringify(next)===JSON.stringify(current))return false;
      current=next;
      try{storage.setItem(STORAGE_KEY,JSON.stringify(current));available=true;writes++;}catch{available=false;}
      return true;
    },
    get diagnostics(){return {available,writes};},
  };
}
