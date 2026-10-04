import {COLS,ROWS,LEVELS} from './snake.js?v=20261004-snake-1';
export function paintSnake({rect,text,centered,header,footer,ink,background},state) {
  const best=state.highScores[state.difficulty];
  if(state.status==='ready') {
    centered('SNAKE',3,2);centered(`< ${LEVELS[state.difficulty].label} >`,24);
    centered(`BEST ${best}`,38);footer('START');return;
  }
  text(`S${String(state.score).padStart(3,'0')}`,2,2);
  text(`B${String(best).padStart(3,'0')}`,55,2);
  rect(1,12,COLS*4+2,ROWS*4+2);rect(2,13,COLS*4,ROWS*4,background);
  state.body.forEach((p,index)=>rect(2+p.x*4,13+p.y*4,index?3:4,index?3:4));
  if(state.food){const x=2+state.food.x*4,y=13+state.food.y*4;rect(x+1,y,2,4);rect(x,y+1,4,2);}
  if(state.status==='running')return;
  rect(4,23,76,30,background);rect(5,24,74,1);rect(5,51,74,1);
  centered({paused:'PAUSED',over:'GAME OVER',won:'YOU WIN'}[state.status],28);
  centered(state.status==='paused'?'MENU RESUME':'MENU RETRY',39);
}
