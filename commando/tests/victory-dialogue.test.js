'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {createAudio, victoryDialogue, audioSamples} = require('../js/audio.js');
const {createEngine} = require('../js/engine.js');

function harness(failDialogue = false) {
  const timers = [], started = [], fetched = [];
  const param = () => ({value:1,setValueAtTime(){},exponentialRampToValueAtTime(){},linearRampToValueAtTime(){},cancelScheduledValues(){}});
  const node = () => ({connect(){},disconnect(){},gain:param()});
  class Context {
    constructor(){this.state='running';this.currentTime=0;this.destination={};}
    createGain(){return node();} createDynamicsCompressor(){return node();}
    createMediaElementSource(){return node();}
    decodeAudioData(){return Promise.resolve({numberOfChannels:1,length:4,sampleRate:2,duration:2,getChannelData:()=>new Float32Array([.2,.3,.2,.1])});}
    createBufferSource(){const s={...node(),start(){started.push(s);},stop(){s.stopped=true;}};return s;}
    createOscillator(){return {...node(),frequency:param(),start(){},stop(){}};}
  }
  class Music {
    constructor(){this.paused=true;this.attrs={};}
    setAttribute(k,v){this.attrs[k]=v;} getAttribute(k){return this.attrs[k];}
    removeAttribute(k){delete this.attrs[k];} load(){} addEventListener(){}
    play(){this.paused=false;return Promise.resolve();} pause(){this.paused=true;}
  }
  const audio=createAudio({env:{AudioContext:Context,Audio:Music,
    setTimeout(fn){timers.push(fn);},
    fetch(url){fetched.push(url);return Promise.resolve({ok:!(failDialogue&&url.includes('victory-')),arrayBuffer:async()=>new ArrayBuffer(4)});}
  }});
  const flush=async()=>{timers.splice(0).forEach(fn=>fn());await new Promise(resolve=>setImmediate(resolve));};
  return {audio,timers,started,fetched,flush};
}

test('all eight actual boss deaths play their corresponding approved line exactly once',async()=>{
  assert.deepEqual(victoryDialogue.map(v=>v[0]),['Chump','GreenHood','ZZZ','Boner','Memory Cow Moo','Pipedog','Cash Cat','Artificial Inu']);
  const h=harness();await h.audio.unlock();
  for(let stage=0;stage<8;stage++){
    const e=createEngine({seed:42});e.start({difficulty:'easy',players:1});
    for(let i=0;i<stage;i++){e.state.status='clear';e.advance();}
    // Place a one-hit boss in front of a player bullet; use the real kill/event path.
    e.state.stage=stage;e.state.status='playing';e.state.level.spawns=[];e.state.enemies=[];
    e.state.boss={id:999,kind:'boss',x:300,y:300,w:100,h:100,hp:1,maxHp:1,cooldown:99,phase:0,attack:0,originX:300,originY:300};
    e.state.bullets=[{x:0,y:0,w:960,h:540,vx:0,vy:0,team:'player',ttl:1,damage:2,weapon:'P',hits:[]}];
    // Later bosses move before collision; freeze their animation at the hit location.
    if(stage>=6){e.state.boss.originY=300;}
    e.drainEvents();h.audio.update(e.state);e.tick();
    assert.equal(e.state.status,'boss-defeat');h.audio.update(e.state,e.drainEvents());
    assert.equal(h.timers.length,0,'no victory line during the explosion');
    for(let tick=0;tick<394;tick++)e.tick();
    assert.equal(e.state.status,'clear');
    const events=e.drainEvents();assert.ok(events.some(ev=>ev.type==='clear'));
    h.audio.update(e.state,events);const before=h.started.length;
    assert.equal(h.timers.length,1);await h.flush();
    assert.equal(h.started.length,before+1);
    assert.equal(h.audio.inspect().lastSample,'victory:'+stage);
    h.audio.update(e.state);await h.flush();assert.equal(h.started.length,before+1);
    assert.ok(audioSamples['victory:'+stage].endsWith('-american-v6.mp3'));
  }
});

test('advancing, returning to title, muting and background interruption cancel delayed speech',async()=>{
  for(const action of ['advance','title','mute','background']){
    const h=harness();await h.audio.unlock();h.audio.update({stage:0,status:'playing'});
    h.audio.update({stage:0,status:'clear'},[{type:'clear'}]);
    if(action==='advance')h.audio.update({stage:1,status:'playing'},[{type:'stage'}]);
    if(action==='title')h.audio.update({stage:0,status:'ready'});
    if(action==='mute')h.audio.toggle();
    if(action==='background')h.audio.interrupt();
    await h.flush();assert.equal(h.audio.inspect().lastDialogue,null,action);
  }
});

test('mute stops an active line and unmute does not replay it',async()=>{
  const h=harness();await h.audio.unlock();h.audio.update({stage:0,status:'clear'});await h.flush();
  const spoken=h.started.at(-1);assert.ok(spoken);h.audio.toggle();assert.equal(spoken.stopped,true);
  h.audio.toggle();h.audio.update({stage:0,status:'clear'});await h.flush();
  assert.equal(h.started.filter(source=>source.buffer===spoken.buffer).length,1);
  assert.equal(h.audio.inspect().musicPlaying,true,'victory music resumes without repeating speech');
});

test('missing dialogue downloads never synthesize speech or break stage clear',async()=>{
  const h=harness(true);await h.audio.unlock();h.audio.update({stage:7,status:'clear'},[{type:'clear'}]);
  await h.flush();assert.equal(h.audio.inspect().lastDialogue,null);assert.equal(h.started.length,1);
  assert.equal(h.audio.inspect().track,'Level Victory.mp3');
});

test('late downloads cannot play after a stage change',async()=>{
  const h=harness();h.audio.unlock();h.audio.update({stage:0,status:'clear'});
  h.audio.update({stage:1,status:'playing'});await h.flush();assert.equal(h.audio.inspect().lastDialogue,null);
});
