// Phone navigation is independent of rendering, audio, storage and accounts.
// 手机导航独立于渲染、声音、存储和账户，后续应用复用相同动作接口。
import {initialCalendar,localDate,reduceCalendar,describeCalendar} from './apps/calendar.js?v=20261004-calendar-1';

// One catalog supplies routing, LCD labels and accessible names.
// 同一菜单目录供路由、LCD 标签及无障碍描述使用，新增应用无需维护三组索引。
export const MENU_ITEMS = Object.freeze([
  {id:'digits',label:'DIGITS',name:'数字输入'},
  {id:'calendar',label:'CALENDAR',name:'日历'},
  {id:'settings',label:'SETTINGS',name:'设置'},
  {id:'about',label:'ABOUT',name:'关于手机'},
].map(Object.freeze));
export const DIGIT_LIMIT = 32;
const isSymbol = key => /^[0-9]$/.test(key) || key === 'star' || key === 'hash';
const symbol = key => ({star: '*', hash: '#'})[key] ?? key;
const shift = (index, key, length) => (index + (key === 'up' ? -1 : 1) + length) % length;

export function initialPhoneState(preferences = {}, today = localDate(new Date())) {
  return {page: 'home', menuIndex: 0, settingsIndex: 0, optionsIndex: 0, digits: '',
    theme: preferences.theme === 'glass' ? 'glass' : 'real', soundEnabled: preferences.soundEnabled !== false,
    calendar:initialCalendar(today)};
}

export function reducePhone(state, event, {today=state.calendar.today} = {}) {
  const {key, phase} = event;
  if (phase !== 'activate' && phase !== 'repeat') return state;
  if (phase === 'repeat' && key !== 'up' && key !== 'down') return state;
  const direction = key === 'up' || key === 'down';
  if ((state.page === 'home' || state.page === 'digits') && isSymbol(key)) {
    if (state.page === 'home') return {...state, page: 'digits', digits: symbol(key)};
    if (state.digits.length >= DIGIT_LIMIT) return state;
    return {...state, page: 'digits', digits: state.digits + symbol(key)};
  }
  switch (state.page) {
    case 'home':
      return key === 'menu' ? {...state, page: 'menu'} : state;
    case 'menu':
      if (direction) return {...state, menuIndex: shift(state.menuIndex, key, MENU_ITEMS.length)};
      if (key === 'clear') return {...state, page: 'home'};
      if (key === 'menu') {
        const page=MENU_ITEMS[state.menuIndex].id;
        return {...state,page,...(page==='calendar'?{calendar:{...state.calendar,today,view:'month'}}:{})};
      }
      return state;
    case 'calendar': {
      if(key==='clear'&&state.calendar.view==='month')return {...state,page:'menu'};
      const calendar=reduceCalendar(state.calendar,event,today);
      return calendar===state.calendar ? state : {...state,calendar};
    }
    case 'digits':
      if (key === 'clear') return state.digits ? {...state, digits: state.digits.slice(0, -1)} : {...state, page: 'home'};
      if (key === 'menu') return {...state, page: 'digit-options', optionsIndex: 0};
      return state;
    case 'digit-options':
      if (direction) return {...state, optionsIndex: shift(state.optionsIndex, key, 2)};
      if (key === 'clear') return {...state, page: 'digits'};
      if (key === 'menu') return state.optionsIndex === 0 ? {...state, page: 'digits', digits: ''} : {...state, page: 'menu'};
      return state;
    case 'settings':
      if (direction) return {...state, settingsIndex: shift(state.settingsIndex, key, 2)};
      if (key === 'clear') return {...state, page: 'menu'};
      if (key === 'menu') return state.settingsIndex === 0
        ? {...state, theme: state.theme === 'real' ? 'glass' : 'real'}
        : {...state, soundEnabled: !state.soundEnabled};
      return state;
    case 'about':
      return key === 'clear' || key === 'menu' ? {...state, page: 'menu'} : state;
    default: return state;
  }
}

const copyState = state => ({...state,calendar:{...state.calendar}});
export function createPhoneState({preferences, onChange = () => {}, now = () => new Date()} = {}) {
  let state = initialPhoneState(preferences,localDate(now()));
  function publish(next) {
    if (next === state) return false;
    const previous = state; state = next; onChange(copyState(state), copyState(previous)); return true;
  }
  return {
    dispatch: event => publish(reducePhone(state, event, {today:localDate(now())})),
    setPreferences({theme = state.theme, soundEnabled = state.soundEnabled}) {
      if (!['real', 'glass'].includes(theme) || typeof soundEnabled !== 'boolean') return false;
      return theme === state.theme && soundEnabled === state.soundEnabled ? false : publish({...state, theme, soundEnabled});
    },
    get state() {return copyState(state);},
  };
}

export function describeScreen(state) {
  const names = {digits: '数字输入', settings: '设置', about: '关于手机'};
  switch (state.page) {
    case 'home': return '手机待机。数字键开始输入，Menu 打开菜单。';
    case 'menu': return `主菜单，第 ${state.menuIndex + 1} 项：${MENU_ITEMS[state.menuIndex].name}。上下选择，Menu 确认，C 返回待机。`;
    case 'calendar': return describeCalendar(state.calendar);
    case 'digits': return `数字输入：${state.digits || '空'}${state.digits.length === DIGIT_LIMIT ? '，已达 32 位上限' : ''}。C 删除，空白时 C 返回待机，Menu 打开选项。`;
    case 'digit-options': return `输入选项：${state.optionsIndex === 0 ? '清空全部' : '主菜单'}。Menu 确认，C 返回输入。`;
    case 'settings': return `设置：${state.settingsIndex === 0 ? '材质主题，' + (state.theme === 'real' ? '经典实体' : '玻璃棚拍') : '按键声音，' + (state.soundEnabled ? '开启' : '关闭')}。Menu 更改，C 返回菜单。`;
    default: return `${names[state.page] ?? '手机'}。Menu 或 C 返回菜单。`;
  }
}
