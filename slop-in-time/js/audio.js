(function(root){
  'use strict';
  function createAudio(){
    let ctx,master,muted=false,unlocked=false,lastStatus='',nextBeat=0,beat=0,stage=-1;const voices=new Set();
    try{muted=localStorage.getItem('gameslop:slop-in-time:muted')==='1';}catch(_){}
    function unlock(){unlocked=true;if(!ctx){try{ctx=new (window.AudioContext||window.webkitAudioContext)();master=ctx.createGain();master.gain.value=muted?0:.45;const limit=ctx.createDynamicsCompressor();master.connect(limit);limit.connect(ctx.destination);}catch(_){return;}}if(ctx.state==='suspended')ctx.resume().catch(()=>{});}
    function note(freq,duration=.1,volume=.1,type='square',at=0,end){
      if(!ctx||muted||voices.size>=32)return;const time=at||ctx.currentTime,o=ctx.createOscillator(),g=ctx.createGain();o.type=type;o.frequency.setValueAtTime(Math.max(20,freq),time);if(end)o.frequency.exponentialRampToValueAtTime(Math.max(20,end),time+duration);g.gain.setValueAtTime(volume,time);g.gain.exponentialRampToValueAtTime(.001,time+duration);o.connect(g);g.connect(master);voices.add(o);o.onended=()=>{voices.delete(o);o.disconnect();g.disconnect();};o.start(time);o.stop(time+duration+.02);
    }
    function stop(){for(const o of voices){try{o.stop();}catch(_){}}voices.clear();nextBeat=0;}
    function effect(type,heavy=false){if(type==='hit'){note(heavy?110:180,.12,.24,'triangle',0,35);note(650,.045,.075,'sawtooth',0,130);}else if(type==='swing')note(240,.055,.035,'triangle',0,90);else if(type==='jump')note(180,.12,.075,'square',0,450);else if(type==='throw')note(300,.25,.13,'sawtooth',0,50);else if(type==='hurt'||type==='death')note(150,.22,.13,'sawtooth',0,30);else if(type==='pickup'){note(660,.12,.1,'triangle');note(990,.17,.08,'triangle',ctx.currentTime+.09);}else if(['special','bossdown','slam','super','enrage'].includes(type)){note(65,.5,.23,'sawtooth',0,22);note(420,.32,.09,'triangle',0,80);}else if(type==='explosion'){note(85,.35,.17,'sawtooth',0,23);note(280,.2,.08,'triangle',0,40);}else if(type==='block')note(880,.09,.1,'triangle',0,320);else if(type==='story')note(440,.2,.04,'triangle',0,660);else if(type==='break')note(160,.15,.09,'sawtooth',0,35);else if(type==='clear'||type==='victory'){[0,4,7,12].forEach((n,i)=>note(330*2**(n/12),.3,.1,'triangle',ctx.currentTime+i*.13));}}
    function update(s,events=[]){
      if(!ctx||!unlocked)return;
      if(lastStatus!==s.status){if(s.status!=='playing')stop();lastStatus=s.status;}
      if(stage!==s.stage){stage=s.stage;beat=0;nextBeat=0;}
      if(events.some(e=>e.type==='bossdown'))stop();
      if(!muted)for(const e of events)effect(e.type,e.heavy);
      if(s.status!=='playing'||s.ending||muted)return;
      const now=ctx.currentTime;if(nextBeat<now-.2)nextBeat=now;
      const roots=[110,98,82.41,123.47,110,92.5],motifs=[[0,7,10,7,12,10,7,3],[0,3,7,10,7,3,5,7],[0,0,7,3,0,10,7,3],[0,2,7,10,9,7,2,0],[0,7,12,7,3,5,7,3],[0,7,3,10,12,15,10,7]],rootNote=roots[s.stage];
      while(nextBeat<now+.08){const n=motifs[s.stage][beat%8];if(beat%2===0)note(rootNote*(beat%8<4?1:2**(-2/12)),.18,.065,'triangle',nextBeat);note(rootNote*4*2**(n/12),.115,.018,s.stage===3?'triangle':'square',nextBeat);if(beat%4===0)note(100,.095,.095,'sine',nextBeat,28);if(beat%4===2)note(190,.055,.035,'triangle',nextBeat,60);beat++;nextBeat+=s.stage===3?.16:.14;}
    }
    return {unlock,update,toggle(){unlock();muted=!muted;if(master)master.gain.value=muted?0:.45;stop();try{localStorage.setItem('gameslop:slop-in-time:muted',String(Number(muted)));}catch(_){}},get muted(){return muted;}};
  }
  root.SlopInTime.createAudio=createAudio;
})(window);
