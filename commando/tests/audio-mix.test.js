'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createAudio,audioTracks}=require('../js/audio.js');
function harness({deferMusic=false,failMusic=false,failEffects=false}={}){
  const started=[],oscillators=[],requests=[],waiters=[];
  const param=()=>({value:1,setValueAtTime(v){this.value=v;},linearRampToValueAtTime(v){this.value=v;},exponentialRampToValueAtTime(){},cancelScheduledValues(){}});
  const node=()=>({connect(target){this.target=target;},disconnect(){this.disconnected=true;},gain:param()});
  let ctx;
  class Context {
    constructor(){ctx=this;this.state='running';this.currentTime=0;this.destination={};}
    createGain(){return node();} createDynamicsCompressor(){return node();}
    decodeAudioData(){return Promise.resolve({duration:120,length:4,numberOfChannels:1,sampleRate:2,getChannelData:()=>new Float32Array([.2,.3,.2,.1])});}
    createBufferSource(){const s={...node(),playbackRate:param(),start(when,offset){s.offset=offset;started.push(s);},stop(){s.stopped=true;}};return s;}
    createOscillator(){const s={...node(),frequency:param(),start(){oscillators.push(s);},stop(){}};return s;}
  }
  const audio=createAudio({env:{AudioContext:Context,fetch(url){
    requests.push(url);const music=url.startsWith('Soundtrack/');
    const result={ok:!(music?failMusic:failEffects),arrayBuffer:async()=>new ArrayBuffer(4)};
    return music&&deferMusic&&!url.includes('Level%20Victory')?new Promise(resolve=>waiters.push(()=>resolve(result))):Promise.resolve(result);
  }}});
  const flush=()=>new Promise(resolve=>setImmediate(resolve));
  return {audio,started,oscillators,requests,waiters,flush,get ctx(){return ctx;}};
}
test('rockets, lasers and loud blasts have much lower actual playback gain; speech stays clear',async()=>{
  const h=harness();await h.audio.unlock();h.audio.update({stage:0,status:'playing'});await h.flush();
  for(const [event,max,old] of [
    [{type:'shot',weapon:'L'},.10,.55],[{type:'shot',weapon:'H'},.14,.55],
    [{type:'impact',weapon:'H'},.20,.8],[{type:'explosion',kind:'boss'},.16,.8],
    [{type:'shot',weapon:'F'},.08,.55],[{type:'shot',weapon:'T'},.10,.55]
  ]){
    h.audio.update({stage:0,status:'playing'},[event]);
    const gain=h.started.at(-1).target.gain.value;
    assert.ok(gain<=max);assert.ok(20*Math.log10(gain/old)<-10);
  }
  h.audio.update({stage:0,status:'playing'},[{type:'victory:0'}]);
  assert.equal(h.started.at(-1).target.gain.value,.8);
});
test('rapid fire cannot stack more than two recorded laser tails',async()=>{
  const h=harness();await h.audio.unlock();h.audio.update({stage:0,status:'playing'});await h.flush();
  for(let i=0;i<100;i++)h.audio.update({stage:0,status:'playing'},[{type:'shot',weapon:'L'},{type:'shot',weapon:'L'}]);
  assert.equal(h.audio.inspect().voices,2);
  assert.equal(h.started.filter(s=>!s.loop&&!s.stopped).length,2);
});

test('boss explosion audio fills the cinematic, plays once and resumes at the matching paused offset',async()=>{
 const h=harness();await h.audio.unlock();h.audio.update({stage:0,status:'playing'});await h.flush();
 const state={stage:0,status:'boss-defeat',bossDefeat:{elapsed:0,duration:6.56}};
 h.audio.update(state,[{type:'explosion',kind:'boss'}]);const blast=h.started.at(-1),count=h.started.length;
 assert.equal(blast.offset,0);assert.equal(blast.loop,undefined);assert.equal(blast.buffer.duration/blast.playbackRate.value,6.56);
 assert.ok(h.started.find(s=>s.loop).stopped);assert.equal(blast.target.target.gain.value,.28);
 for(let i=0;i<20;i++)h.audio.update(state);assert.equal(h.started.length,count);
 state.bossDefeat.elapsed=2;state.status='paused';h.audio.update(state);assert.equal(blast.stopped,true);
 state.status='boss-defeat';h.audio.update(state);assert.equal(h.started.at(-1).offset,2*120/6.56);
 h.audio.toggle();assert.equal(h.started.at(-1).stopped,true);const mutedCount=h.started.length;h.audio.update(state);assert.equal(h.started.length,mutedCount);
 h.audio.toggle();state.bossDefeat.elapsed=3;h.audio.update(state);assert.ok(Math.abs(h.started.at(-1).offset-3*120/6.56)<1e-9);
 state.status='clear';h.audio.update(state);assert.equal(h.started.filter(s=>!s.stopped&&s.buffer===blast.buffer).length,0);
});

test('recorded and synthesized effects are reduced by 9 dB while dialogue and music retain their mix',async()=>{
  const h=harness();await h.audio.unlock();h.audio.update({stage:0,status:'playing'});await h.flush();
  h.audio.update({stage:0,status:'playing'},[{type:'shot',weapon:'G'}]);
  const effectsBus=h.started.at(-1).target.target;
  assert.ok(20*Math.log10(effectsBus.gain.value/.8)<-9);
  h.audio.update({stage:0,status:'playing'},[{type:'jump'}]);
  assert.equal(h.oscillators.at(-1).target.target,effectsBus);
  h.audio.update({stage:0,status:'playing'},[{type:'victory:0'}]);
  assert.equal(h.started.at(-1).target.target.gain.value,.8);
  assert.notEqual(h.started.at(-1).target.target,effectsBus);
  assert.equal(h.started.find(s=>s.loop).target.gain.value,.38);
});

test('rifle plays a recorded pop per round and machine gun is over 11 dB quieter',async()=>{
  const h=harness();await h.audio.unlock();
  h.audio.update({stage:0,status:'playing'},[{type:'shot',weapon:'P'}]);
  assert.equal(h.audio.inspect().lastSample,'shot:P');
  assert.ok(h.requests.some(url=>url.endsWith('Rifle%20Pop.wav')));
  assert.equal(h.started.at(-1).target.gain.value,.38);
  const first=h.started.at(-1);
  h.audio.update({stage:0,status:'playing'},[{type:'shot',weapon:'P'}]);
  assert.notEqual(h.started.at(-1),first);
  h.audio.update({stage:0,status:'playing'},[{type:'shot',weapon:'M'}]);
  assert.equal(h.audio.inspect().lastSample,'shot:M');
  assert.ok(20*Math.log10(h.started.at(-1).target.gain.value/.30)<-11);
});
test('music uses one looping buffer and resumes its position after pause and mute',async()=>{
  const h=harness();h.audio.update({stage:0,status:'playing'});
  assert.equal(h.requests.length,0);await h.audio.unlock();
  const first=h.started.find(s=>s.loop);assert.ok(first);
  h.ctx.currentTime=37;h.audio.update({stage:0,status:'paused'});
  assert.equal(first.stopped,true);assert.equal(h.audio.inspect().musicTime,37);
  h.ctx.currentTime=50;h.audio.update({stage:0,status:'playing'});
  assert.equal(h.started.at(-1).offset,37);
  h.ctx.currentTime=56;h.audio.toggle();assert.equal(h.audio.inspect().musicTime,43);
  h.audio.toggle();assert.equal(h.started.at(-1).offset,43);
  assert.equal(h.requests.filter(s=>s.startsWith('Soundtrack/')&&!s.includes('Victory')).length,1);
  assert.equal(h.started.filter(s=>s.loop&&!s.stopped).length,1);
});
test('stale music downloads never start over a different stage or the title screen',async()=>{
  const h=harness({deferMusic:true});await h.audio.unlock();
  h.audio.update({stage:0,status:'playing'});h.audio.update({stage:1,status:'playing'});
  h.waiters[0]();await h.flush();assert.equal(h.started.length,0);
  h.waiters[1]();await h.flush();assert.equal(h.started.filter(s=>s.loop).length,1);
  h.audio.update({stage:2,status:'playing'});h.audio.update({stage:2,status:'ready'});
  h.waiters[2]();await h.flush();assert.equal(h.audio.inspect().musicPlaying,false);
  assert.equal(h.started.filter(s=>s.loop&&!s.stopped).length,0);
});
test('late music stays silent while paused, then starts on resume; stage restart resets it',async()=>{
  const h=harness({deferMusic:true});await h.audio.unlock();
  h.audio.update({stage:0,status:'playing'});h.audio.update({stage:0,status:'paused'});
  h.waiters[0]();await h.flush();assert.equal(h.started.length,0);
  h.audio.update({stage:0,status:'playing'});h.ctx.currentTime=20;
  h.audio.update({stage:0,status:'playing'},[{type:'stage'}]);
  h.waiters[1]();await h.flush();assert.equal(h.audio.inspect().musicTime,0);
});
test('failed music is optional and retries only on a user gesture',async()=>{
  const h=harness({failMusic:true});await h.audio.unlock();h.audio.update({stage:0,status:'playing'});await h.flush();
  for(let i=0;i<100;i++)h.audio.update({stage:0,status:'playing'});
  assert.equal(h.audio.inspect().musicFailed,true);
  assert.equal(h.requests.filter(s=>s.startsWith('Soundtrack/')&&!s.includes('Victory')).length,1);
  h.audio.update({stage:0,status:'playing'},[{type:'shot',weapon:'M'}]);assert.equal(h.audio.inspect().lastSample,'shot:M');
  await h.audio.unlock();assert.equal(h.requests.filter(s=>s.startsWith('Soundtrack/')&&!s.includes('Victory')).length,2);
});
test('fallback laser cues stay quieter when a recording fails',async()=>{
  const h=harness({failEffects:true});await h.audio.unlock();h.audio.update({stage:0,status:'playing'},[{type:'shot',weapon:'L'}]);
  assert.ok(h.oscillators[0].target.gain.value<.004);
});
test('each stage fetches its corresponding numbered soundtrack and loops it',async()=>{
  assert.deepEqual(audioTracks,['1.mp3','2.mp3','3.mp3','4.mp3','5.mp3','6.mp3','7.mp3','8.mp3']);
  const h=harness();await h.audio.unlock();
  for(let stage=0;stage<8;stage++){
    h.audio.update({stage,status:'playing'});await h.flush();
    assert.equal(h.audio.inspect().track,audioTracks[stage]);
    assert.ok(h.requests.includes('Soundtrack/'+audioTracks[stage]));
    assert.equal(h.started.at(-1).loop,true);
  }
  assert.ok(h.requests.every(url=>!url.includes('/cc0/')));
});

test('victory song starts on clear immediately after the blast, resumes after mute and never repeats',async()=>{
  const h=harness();await h.audio.unlock();h.audio.update({stage:0,status:'playing'});await h.flush();
  assert.equal(h.requests.filter(url=>url.endsWith('Level%20Victory.mp3')).length,1);
  h.audio.update({stage:0,status:'boss-defeat',bossDefeat:{elapsed:0,duration:6.56}});
  const blast=h.started.at(-1);assert.equal(h.audio.inspect().musicPlaying,false);
  const synthCount=h.oscillators.length;
  h.audio.update({stage:0,status:'clear'},[{type:'clear'}]);
  const fanfare=h.started.at(-1);
  assert.equal(blast.stopped,true);assert.notEqual(fanfare,blast);
  assert.equal(h.audio.inspect().track,'Level Victory.mp3');
  assert.equal(fanfare.loop,false);assert.equal(fanfare.offset,0);
  assert.equal(fanfare.target.gain.value,.38);assert.equal(h.oscillators.length,synthCount);
  const count=h.started.length;for(let i=0;i<60;i++)h.audio.update({stage:0,status:'clear'});
  assert.equal(h.started.length,count);
  h.ctx.currentTime=2;h.audio.toggle();assert.equal(fanfare.stopped,true);
  h.ctx.currentTime=10;h.audio.toggle();const resumed=h.started.at(-1);assert.equal(resumed.offset,2);
  resumed.onended();const endedCount=h.started.length;
  for(let i=0;i<60;i++)h.audio.update({stage:0,status:'clear'});
  assert.equal(h.started.length,endedCount);assert.equal(h.audio.inspect().musicPlaying,false);
  h.audio.update({stage:1,status:'playing'},[{type:'stage'}]);await h.flush();
  assert.equal(h.audio.inspect().track,'2.mp3');assert.equal(h.started.at(-1).loop,true);
  h.audio.update({stage:1,status:'clear'});assert.equal(h.started.at(-1).offset,0);
});

test('a pending stage download cannot overwrite victory music and final menu preserves its position',async()=>{
  const h=harness({deferMusic:true});await h.audio.unlock();await h.flush();
  h.audio.update({stage:7,status:'playing'});
  h.audio.update({stage:7,status:'clear'});const fanfare=h.started.at(-1);
  h.waiters[0]();await h.flush();assert.equal(h.started.at(-1),fanfare);
  h.ctx.currentTime=2;h.audio.update({stage:7,status:'victory'});
  assert.equal(h.started.at(-1).offset,2);assert.equal(h.audio.inspect().track,'Level Victory.mp3');
  h.audio.update({stage:0,status:'ready'});assert.equal(h.audio.inspect().musicPlaying,false);
});
