'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createAudio,allyDialogue}=require('../js/audio.js');
const {createEngine}=require('../js/engine.js');
function harness(fail=false){
 const gains=[],started=[];
 const param=()=>({value:1,setValueAtTime(v){this.value=v;},linearRampToValueAtTime(v){this.value=v;},exponentialRampToValueAtTime(v){this.value=v;},cancelScheduledValues(){}});
 const node=()=>({connect(target){this.target=target;},disconnect(){},gain:param()});
 class Context{
  constructor(){this.state='running';this.currentTime=0;this.destination={};}
  createGain(){const n=node();gains.push(n);return n;}createDynamicsCompressor(){return node();}
  decodeAudioData(){return Promise.resolve({numberOfChannels:1,length:4,sampleRate:2,duration:2,getChannelData:()=>new Float32Array([.2,.3,.2,.1])});}
  createBufferSource(){const s={...node(),start(){started.push(s);},stop(){s.stopped=true;}};return s;}
  createOscillator(){return {...node(),frequency:param(),start(){},stop(){}};}
 }
 const audio=createAudio({env:{AudioContext:Context,fetch:url=>Promise.resolve({ok:!(fail&&url.includes('ally-')),arrayBuffer:async()=>new ArrayBuffer(4)})}});
 return {audio,gains,started,flush:()=>new Promise(resolve=>setImmediate(resolve))};
}
test('actual recruitment events play the three requested lines once and persist through continues',async()=>{
 assert.deepEqual(Object.values(allyDialogue).map(x=>x.line),["All right, I'm with you. Let's murder these assholes.",'Fine, if I must.',"You're all fired."]);
 const h=harness(),e=createEngine({seed:42});await h.audio.unlock();e.start({difficulty:'easy'});
 for(const [id,stage] of [['pawns',2],['wojak',4],['sloppy',6]]){
  while(e.state.stage<stage){e.state.status='clear';e.advance();}
  const s=e.state;s.level.spawns=[];s.level.hazards=[];s.enemies=[];s.waveTime=-99999;
  h.audio.update(s,e.drainEvents());await h.flush();
  const npc=s.recruits.find(a=>a.allyId===id);assert.ok(npc);
  Object.assign(s.players[0],{x:npc.x,y:npc.y,vx:0,vy:0,grounded:true,invincible:999});e.tick();
  const events=e.drainEvents();assert.ok(events.some(ev=>ev.type==='companionJoined'&&ev.ally===id));
  h.audio.update(s,events);await h.flush();assert.equal(h.audio.inspect().lastAllyDialogue,id);
  const voice=h.started.at(-1),before=h.started.length;
  h.audio.update(s,[{type:'companionJoined',ally:id}]);await h.flush();assert.equal(h.started.length,before);
  s.status='gameover';e.continueRun();h.audio.update(s,e.drainEvents());await h.flush();
  assert.equal(h.started.filter(v=>v.buffer===voice.buffer).length,1);
 }
 // A new game may hear the ally again.
 e.start();h.audio.update(e.state,e.drainEvents());h.audio.update({stage:2,status:'playing'},[{type:'companionJoined',ally:'pawns'}]);
 await h.flush();assert.equal(h.audio.inspect().lastAllyDialogue,'pawns');
});
test('recruitment speech uses the dialogue bus, ducks the mix, and survives busy effects',async()=>{
 const h=harness();await h.audio.unlock();h.audio.update({stage:2,status:'playing'});await h.flush();
 h.audio.update({stage:2,status:'playing'},[{type:'companionJoined',ally:'pawns'}]);await h.flush();
 const voice=h.started.at(-1);assert.equal(voice.target.target,h.gains[3]);
 assert.equal(h.gains[1].gain.value,.38*.45);assert.equal(h.gains[2].gain.value,.28*.5);
 for(let i=0;i<4;i++)h.audio.update({stage:2,status:'playing'},'P M S L F G R W T I A'.split(' ').map(weapon=>({type:'shot',weapon})));
 assert.notEqual(voice.stopped,true);voice.onended();
 assert.equal(h.gains[1].gain.value,.38);assert.equal(h.gains[2].gain.value,.28);
});
test('pause, mute, stage change and background interruption cancel pending recruitment speech',async()=>{
 for(const action of ['pause','mute','stage','background']){
  const h=harness();await h.audio.unlock();h.audio.update({stage:2,status:'playing'},[{type:'companionJoined',ally:'pawns'}]);
  if(action==='pause')h.audio.update({stage:2,status:'paused'});
  if(action==='mute')h.audio.toggle();
  if(action==='stage')h.audio.update({stage:3,status:'playing'});
  if(action==='background')h.audio.interrupt();
  await h.flush();assert.equal(h.audio.inspect().lastAllyDialogue,null,action);
 }
});
test('muted or missing lines do not replay later or synthesize fake speech',async()=>{
 for(const fail of [false,true]){
  const h=harness(fail);await h.audio.unlock();if(!fail)h.audio.toggle();
  h.audio.update({stage:2,status:'playing'},[{type:'companionJoined',ally:'pawns'}]);await h.flush();
  assert.equal(h.audio.inspect().lastAllyDialogue,null);
  if(!fail)h.audio.toggle();
  h.audio.update({stage:2,status:'playing'},[{type:'companionJoined',ally:'pawns'}]);await h.flush();
  assert.equal(h.audio.inspect().lastAllyDialogue,null);
 }
});
