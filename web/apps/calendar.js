// Calendar dates are civil YYYY-MM-DD values, never timestamps in user storage.
// 日历保存民用日期字符串；UTC 仅用于日期运算，避免夏令时把一天变成 23/25 小时。
export const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
export const WEEKDAYS = ['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY','SUNDAY'];
const MIN_DATE = '0001-01-01', MAX_DATE = '9999-12-31';
const pad = (value, size=2) => String(value).padStart(size,'0');
const format = (year,month,day) => `${pad(year,4)}-${pad(month)}-${pad(day)}`;
export const localDate = date => format(date.getFullYear(), date.getMonth()+1, date.getDate());
export const daysInMonth = (year,month) => month===2
  ? (year%4===0 && (year%100!==0 || year%400===0) ? 29 : 28)
  : ([4,6,9,11].includes(month) ? 30 : 31);

function parts(value) {return value.split('-').map(Number);}
function utcDate(value) {
  const [year,month,day]=parts(value),date=new Date(0);
  date.setUTCFullYear(year,month-1,day);return date;
}
const formatUTC = date => format(date.getUTCFullYear(),date.getUTCMonth()+1,date.getUTCDate());
export function shiftDays(value, amount) {
  const date=utcDate(value);date.setUTCDate(date.getUTCDate()+amount);
  if(date.getUTCFullYear()<1)return MIN_DATE;
  if(date.getUTCFullYear()>9999)return MAX_DATE;
  return formatUTC(date);
}
export function shiftMonths(value, amount) {
  const [year,month,day]=parts(value);
  const total=Math.min(10000*12-1,Math.max(12,year*12+month-1+amount));
  const nextYear=Math.floor(total/12),nextMonth=total%12+1;
  return format(nextYear,nextMonth,Math.min(day,daysInMonth(nextYear,nextMonth)));
}
export function monthGrid(value) {
  const [year,month]=parts(value),offset=(utcDate(format(year,month,1)).getUTCDay()+6)%7;
  const count=daysInMonth(year,month);
  return Array.from({length:42},(_,index)=>index>=offset&&index<offset+count ? format(year,month,index-offset+1) : null);
}
export function calendarInfo(value) {
  const [year,month,day]=parts(value),weekday=(utcDate(value).getUTCDay()+6)%7;
  return {year,month,day,weekday,title:`${MONTHS[month-1]} ${pad(year,4)}`,weekdayName:WEEKDAYS[weekday]};
}
export function initialCalendar(today) {return {selected:today,today,view:'month'};}
export function reduceCalendar(state,{key},today=state.today) {
  let selected=state.selected,view=state.view;
  if(key==='clear')return view==='day' ? {...state,view:'month',today} : state;
  if(key==='menu')view=view==='month'?'day':'month';
  else if(key==='up'||key==='4')selected=shiftDays(selected,-1);
  else if(key==='down'||key==='6')selected=shiftDays(selected,1);
  else if(key==='2')selected=shiftDays(selected,-7);
  else if(key==='8')selected=shiftDays(selected,7);
  else if(key==='star')selected=shiftMonths(selected,-1);
  else if(key==='hash')selected=shiftMonths(selected,1);
  else if(key==='0')selected=today;
  else return state;
  return selected===state.selected&&view===state.view&&today===state.today ? state : {selected,view,today};
}
export function describeCalendar(state) {
  const info=calendarInfo(state.selected),weekday='一二三四五六日'[info.weekday];
  return `日历${state.view==='day'?'日期详情':'月视图'}：${info.year} 年 ${info.month} 月 ${info.day} 日，星期${weekday}${state.selected===state.today?'，今天':''}。上下或 4、6 换日，2、8 换周，星号上月、井号下月，0 回今天。${state.view==='day'?'Menu 或 C 返回月历':'Menu 查看日期，C 返回菜单'}。`;
}
