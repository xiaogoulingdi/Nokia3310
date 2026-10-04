// One native switch: click, horizontal drag, Space/Enter, and arrow keys.
export function bindThemeSwitch(button, onChange) {
  let theme='real', gesture=null;
  function select(next) {
    theme=next;
    button.setAttribute('aria-checked',String(theme==='glass'));
    document.body.dataset.theme=theme;
    onChange(theme);
  }
  button.addEventListener('click',()=>select(theme==='real'?'glass':'real'));
  button.addEventListener('keydown',event=>{
    if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) {
      event.preventDefault();select(['ArrowRight','End'].includes(event.key)?'glass':'real');
    }
  });
  button.addEventListener('pointerdown',event=>{
    if(event.button!==0 || button.disabled)return;
    gesture={id:event.pointerId,x:event.clientX};button.setPointerCapture(event.pointerId);
  });
  button.addEventListener('pointerup',event=>{
    if(gesture?.id!==event.pointerId)return;
    const delta=event.clientX-gesture.x;gesture=null;
    if(Math.abs(delta)>12) {
      // Suppress the synthetic click after a drag, so it cannot toggle twice.
      button.addEventListener('click',event=>event.stopImmediatePropagation(),{capture:true,once:true});
      select(delta>0?'glass':'real');
    }
  });
  button.addEventListener('pointercancel',()=>{gesture=null;});
  return {select,get current(){return theme;}};
}
