import {calendarInfo,monthGrid} from './calendar.js?v=20261004-calendar-1';

// A 3x5 numeric face fits six complete weeks in the same 84x64 LCD.
// 3x5 数字字模让六周月历完整放入原有 84x64 LCD，不增加纹理。
const NUMBERS=['75557','26227','71747','71717','55711','74717','74757','71111','75757','75717'];
export function paintCalendar({rect,text,centered,header,footer,ink,background},state) {
  const {selected,today,view}=state,info=calendarInfo(selected);
  if(view==='day') {
    header(info.title);centered(String(info.day).padStart(2,'0'),19,2);
    centered(info.weekdayName,36);if(selected===today)centered('TODAY',44);
    footer('BACK');return;
  }
  centered(info.title,1);
  for(let col=0;col<7;col++)text('MTWTFSS'[col],5+col*11,11);
  monthGrid(selected).forEach((date,index)=>{
    if(!date)return;
    const x=3+(index%7)*11,y=21+Math.floor(index/7)*7;
    const chosen=date===selected,color=chosen?background:ink;
    if(chosen)rect(x-1,y-1,10,7);
    const label=String(Number(date.slice(-2))),start=x+(label.length===1?3:1);
    for(let char=0;char<label.length;char++)for(let row=0;row<5;row++)for(let col=0;col<3;col++) {
      if(Number(NUMBERS[Number(label[char])][row])&(1<<(2-col)))rect(start+char*4+col,y+row,1,1,color);
    }
    if(date===today)rect(x+8,y+2,1,1,color);
  });
}
