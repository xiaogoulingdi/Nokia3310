// Short synthesized cues: no audio downloads, continuous loops, or microphone.
const TONES={};
[['1','2','3'],['4','5','6'],['7','8','9'],['Star','0','Hash']].forEach((row,r)=>
  row.forEach((key,c)=>{TONES[key]=[[697,770,852,941][r],[1209,1336,1477][c]];}));
Object.assign(TONES,{Menu:[880,1320],Clear:[622,933],Scroll:[740,1110]});

// The same synthesis is usable with OfflineAudioContext for waveform validation.
export function scheduleKeyTone(context,destination,key,theme,when=context.currentTime) {
  const frequencies=TONES[key.replace(/^Key_/,'')];if(!frequencies)return null;
  const glass=theme==='glass';
  const partials=glass
    ? [{frequency:620,end:390,level:.12,duration:.050,type:'triangle'},
       {frequency:1860,end:1700,level:.045,duration:.085,type:'sine'}]
    : frequencies.map(frequency=>({frequency,end:frequency,level:.085,duration:.075,type:'sine'}));
  const nodes=[];
  let remaining=partials.length,resolveEnded;
  const ended=new Promise(resolve=>{resolveEnded=resolve;});
  for(const partial of partials) {
    const oscillator=context.createOscillator(),gain=context.createGain();
    oscillator.type=partial.type;
    oscillator.frequency.setValueAtTime(partial.frequency,when);
    oscillator.frequency.exponentialRampToValueAtTime(partial.end,when+partial.duration);
    gain.gain.setValueAtTime(0,when);
    gain.gain.linearRampToValueAtTime(partial.level,when+.003);
    if(!glass)gain.gain.setValueAtTime(partial.level,when+.025);
    gain.gain.exponentialRampToValueAtTime(.0001,when+partial.duration-.005);
    gain.gain.linearRampToValueAtTime(0,when+partial.duration);
    oscillator.connect(gain);gain.connect(destination);
    oscillator.onended=()=>{
      oscillator.disconnect();gain.disconnect();
      if(--remaining===0)resolveEnded();
    };
    oscillator.start(when);oscillator.stop(when+partial.duration+.002);
    nodes.push({oscillator,gain});
  }
  return {ended,stop(){
    for(const {oscillator,gain} of nodes) {
      gain.gain.cancelScheduledValues(context.currentTime);
      gain.gain.setTargetAtTime(0,context.currentTime,.002);
      oscillator.stop(context.currentTime+.012);
    }
  }};
}

export function createKeySound({enabled:initialEnabled=true}={}) {
  let enabled=initialEnabled,context,master,resuming,idleTimer,generation=0,played=0,lastCue=null,disposed=false;
  const voices=new Set();
  const AudioContextClass=globalThis.AudioContext || globalThis.webkitAudioContext;
  function suspendWhenIdle() {
    clearTimeout(idleTimer);
    if(disposed)return;
    idleTimer=setTimeout(()=>{
      if(context?.state==='running' && !voices.size)void context.suspend().catch(()=>{});
    },800);
  }
  function hush() {
    generation++;for(const voice of voices)voice.stop();suspendWhenIdle();
  }
  function prepare() {
    if(disposed || !enabled || !AudioContextClass)return Promise.resolve(false);
    try {
      if(!context) {
        context=new AudioContextClass({latencyHint:'interactive'});
        master=context.createGain();master.gain.value=.28;master.connect(context.destination);
      }
      suspendWhenIdle();
      if(context.state==='running')return Promise.resolve(true);
      if(!resuming)resuming=context.resume().then(()=>context.state==='running',()=>false).finally(()=>{resuming=null;});
      return resuming;
    } catch {return Promise.resolve(false);}
  }
  function play(key,theme) {
    const ticket=generation,requested=performance.now();
    function start(ready) {
      // Never replay a stale click after a delayed unlock, mute, or tab switch.
      if(disposed || !ready || !enabled || ticket!==generation || document.hidden || performance.now()-requested>120)return;
      if(voices.size>=4)return;
      const voice=scheduleKeyTone(context,master,key,theme);if(!voice)return;
      voices.add(voice);played++;lastCue={key,theme};
      voice.ended.then(()=>{voices.delete(voice);suspendWhenIdle();});
    }
    if(context?.state==='running')start(true);else void prepare().then(start);
  }
  if(!AudioContextClass)enabled=false;
  return {prepare,play,hush,supported:!!AudioContextClass,
    setEnabled(value){enabled=!!value&&!!AudioContextClass;if(!enabled)hush();},
    dispose(){disposed=true;hush();clearTimeout(idleTimer);if(context&&context.state!=='closed')void context.close().catch(()=>{});voices.clear();},
    get diagnostics(){
    return {enabled,contextState:context?.state??'uninitialized',activeVoices:voices.size,played,lastCue};
  }};
}
