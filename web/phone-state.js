// Phone navigation is independent of rendering, audio, storage and accounts.
// 手机导航独立于渲染、声音、存储和账户，后续应用复用相同动作接口。
export const MENU_ITEMS = ['DIGITS', 'SETTINGS', 'ABOUT'];
export const DIGIT_LIMIT = 32;
const isSymbol = key => /^[0-9]$/.test(key) || key === 'star' || key === 'hash';
const symbol = key => ({star: '*', hash: '#'})[key] ?? key;
const shift = (index, key, length) => (index + (key === 'up' ? -1 : 1) + length) % length;

export function initialPhoneState(preferences = {}) {
  return {page: 'home', menuIndex: 0, settingsIndex: 0, optionsIndex: 0, digits: '',
    theme: preferences.theme === 'glass' ? 'glass' : 'real', soundEnabled: preferences.soundEnabled !== false};
}

export function reducePhone(state, event) {
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
      if (key === 'menu') return {...state, page: ['digits', 'settings', 'about'][state.menuIndex]};
      return state;
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

export function createPhoneState({preferences, onChange = () => {}} = {}) {
  let state = initialPhoneState(preferences);
  function publish(next) {
    if (next === state) return false;
    const previous = state; state = next; onChange({...state}, {...previous}); return true;
  }
  return {
    dispatch: event => publish(reducePhone(state, event)),
    setPreferences({theme = state.theme, soundEnabled = state.soundEnabled}) {
      if (!['real', 'glass'].includes(theme) || typeof soundEnabled !== 'boolean') return false;
      return theme === state.theme && soundEnabled === state.soundEnabled ? false : publish({...state, theme, soundEnabled});
    },
    get state() {return {...state};},
  };
}

export function describeScreen(state) {
  const names = {digits: '数字输入', settings: '设置', about: '关于手机'};
  switch (state.page) {
    case 'home': return '手机待机。数字键开始输入，Menu 打开菜单。';
    case 'menu': return `主菜单，第 ${state.menuIndex + 1} 项：${['数字输入', '设置', '关于手机'][state.menuIndex]}。上下选择，Menu 确认，C 返回待机。`;
    case 'digits': return `数字输入：${state.digits || '空'}${state.digits.length === DIGIT_LIMIT ? '，已达 32 位上限' : ''}。C 删除，空白时 C 返回待机，Menu 打开选项。`;
    case 'digit-options': return `输入选项：${state.optionsIndex === 0 ? '清空全部' : '主菜单'}。Menu 确认，C 返回输入。`;
    case 'settings': return `设置：${state.settingsIndex === 0 ? '材质主题，' + (state.theme === 'real' ? '经典实体' : '玻璃棚拍') : '按键声音，' + (state.soundEnabled ? '开启' : '关闭')}。Menu 更改，C 返回菜单。`;
    default: return `${names[state.page] ?? '手机'}。Menu 或 C 返回菜单。`;
  }
}
