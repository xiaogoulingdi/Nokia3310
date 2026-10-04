// Pure game rules: no DOM, rendering, timers, storage or network access.
// 游戏规则独立于界面、渲染、计时、存储和网络；随机数由外部注入以便复现。
export const COLS=20, ROWS=12, MAX_SCORE=COLS*ROWS-3;
export const LEVELS=Object.freeze({easy:{label:'EASY',name:'舒缓',step:360},normal:{label:'NORMAL',name:'标准',step:260},fast:{label:'FAST',name:'快速',step:180}});
const DIRECTIONS={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]};
const opposite={up:'down',down:'up',left:'right',right:'left'};
const levelNames=Object.keys(LEVELS);
const NUMBER_DIRECTIONS={2:'up',8:'down',4:'left',6:'right'};
export const snakeDirection=key=>Object.hasOwn(NUMBER_DIRECTIONS,key)?NUMBER_DIRECTIONS[key]:null;
const same=(a,b)=>a.x===b.x&&a.y===b.y;
export function foodFor(body,random=0) {
  const occupied=new Set(body.map(p=>p.y*COLS+p.x)),free=[];
  for(let i=0;i<COLS*ROWS;i++)if(!occupied.has(i))free.push(i);
  if(!free.length)return null;
  const index=free[Math.floor(Math.max(0,Math.min(.999999,Number.isFinite(random)?random:0))*free.length)];
  return {x:index%COLS,y:Math.floor(index/COLS)};
}
export function initialSnake({difficulty='normal',highScores={}}={}) {
  return {status:'ready',difficulty:Object.hasOwn(LEVELS,difficulty)?difficulty:'normal',highScores:{easy:0,normal:0,fast:0,...highScores},
    body:[{x:9,y:6},{x:8,y:6},{x:7,y:6}],direction:'right',queue:[],food:null,score:0,reason:null};
}
export function startSnake(state,random=0) {
  const next=initialSnake(state);return {...next,status:'running',food:foodFor(next.body,random)};
}
export const pauseSnake=state=>state.status==='running'?{...state,status:'paused',queue:[]}:state;
export function turnSnake(state,direction) {
  const previous=state.queue.at(-1)??state.direction;
  if(state.status!=='running'||!DIRECTIONS[direction]||state.queue.length>=2||direction===previous||direction===opposite[previous])return state;
  return {...state,queue:[...state.queue,direction]};
}
export function stepSnake(state,random=0) {
  if(state.status!=='running')return state;
  const direction=state.queue[0]??state.direction,[dx,dy]=DIRECTIONS[direction];
  const head={x:state.body[0].x+dx,y:state.body[0].y+dy},eating=state.food&&same(head,state.food);
  const collision=state.body.slice(0,eating?undefined:-1).some(p=>same(p,head));
  if(head.x<0||head.x>=COLS||head.y<0||head.y>=ROWS||collision)
    return {...state,status:'over',queue:[],reason:collision?'self':'wall'};
  const body=[head,...state.body];if(!eating)body.pop();
  const score=state.score+(eating?1:0),highScores=score>state.highScores[state.difficulty]?{...state.highScores,[state.difficulty]:score}:state.highScores;
  const food=eating?foodFor(body,random):state.food;
  return {...state,body,score,highScores,direction,queue:state.queue.slice(1),food,status:food?'running':'won',reason:food?null:'filled'};
}
export function reduceSnake(state,key,random=0) {
  if(key==='clear')return pauseSnake(state);
  if(key==='menu') {
    if(state.status==='running')return pauseSnake(state);
    if(state.status==='paused')return {...state,status:'running',queue:[]};
    return startSnake(state,random);
  }
  if(key==='5'&&['paused','over','won'].includes(state.status))return initialSnake(state);
  if(state.status==='ready'&&(key==='up'||key==='down')) {
    const index=levelNames.indexOf(state.difficulty),direction=key==='up'?-1:1;
    return initialSnake({...state,difficulty:levelNames[(index+direction+levelNames.length)%levelNames.length]});
  }
  return turnSnake(state,snakeDirection(key));
}
export function describeSnake(state) {
  const labels={ready:'准备开始',running:'游戏中',paused:'已暂停',over:'游戏结束',won:'已填满棋盘'};
  const controls={ready:'上下选择难度，Menu 开始，C 返回。',running:'2 上、4 左、6 右、8 下，Menu 或 C 暂停。',paused:'Menu 继续，5 重新选择难度，C 返回游戏菜单。',over:'Menu 再玩一次，5 选择难度，C 返回。',won:'Menu 再玩一次，5 选择难度，C 返回。'};
  // Movement never changes this summary; avoid screen-reader announcements every tick.
  // 描述只随状态、分数或难度改变，避免每一步移动都触发屏幕阅读器播报。
  return `贪吃蛇，${LEVELS[state.difficulty].name}，${labels[state.status]}。得分 ${state.score}，最高分 ${state.highScores[state.difficulty]}。${controls[state.status]}`;
}
