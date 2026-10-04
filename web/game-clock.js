// One bounded simulation timer, not a second render loop. No catch-up after sleep.
// 一个有界逻辑计时器，不创建第二个渲染循环；恢复后不追赶后台时间。
export function createGameClock({tick,setTimer=setTimeout,clearTimer=clearTimeout}) {
  let timer=null,running=false,interval=160,disposed=false,ticks=0;
  function schedule(){if(!disposed&&running&&timer===null)timer=setTimer(()=>{timer=null;if(!running||disposed)return;ticks++;tick();schedule();},interval);}
  return {
    sync(active,delay=interval){
      if(disposed)return;
      if(!active||delay!==interval){if(timer!==null)clearTimer(timer);timer=null;}
      running=active;interval=delay;schedule();
    },
    get diagnostics(){return {active:running,timerActive:timer!==null,ticks,interval};},
    dispose(){disposed=true;running=false;if(timer!==null)clearTimer(timer);timer=null;},
  };
}
