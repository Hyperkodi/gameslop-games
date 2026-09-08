import {SOUND_BANK} from './sound-bank.mjs';

export class Audio {
  constructor(){this._muted=false;this.ctx=null;this.buffers=new Map();this.failed=new Set();this.active=new Set();this.last=new Map();this.loading=null;}
  get muted(){return this._muted;}
  set muted(value){this._muted=Boolean(value);if(this._muted)this.stop();}
  async unlock(){
    try{
      this.ctx??=new (window.AudioContext||window.webkitAudioContext)();
      if(!this.master){
        this.master=this.ctx.createGain();this.master.gain.value=.8;
        this.limiter=this.ctx.createDynamicsCompressor();
        this.limiter.threshold.value=-9;this.limiter.knee.value=6;this.limiter.ratio.value=8;
        this.limiter.attack.value=.003;this.limiter.release.value=.12;
        this.master.connect(this.limiter);this.limiter.connect(this.ctx.destination);
      }
      if(this.ctx.state==='suspended')await this.ctx.resume();
      this.loading??=this.load(); // Audio loading never delays a run or touch input.
    }catch{/* Audio is optional. */}
  }
  async ui(type){await this.unlock();this.event({type});}
  async load(){
    await Promise.all(Object.entries(SOUND_BANK).map(async([id,spec])=>{
      try{
        const res=await fetch(new URL('../'+spec.file,import.meta.url),{signal:AbortSignal.timeout(15000)});
        if(!res.ok)throw Error();
        const buffer=await this.ctx.decodeAudioData(await res.arrayBuffer());
        // Skip leading silence at playback; preserve the original generated file.
        let first=buffer.length;
        for(let c=0;c<buffer.numberOfChannels;c++){
          const samples=buffer.getChannelData(c);
          for(let i=0;i<first;i++)if(Math.abs(samples[i])>.005){first=i;break;}
        }
        if(first===buffer.length)throw Error('Silent effect');
        this.buffers.set(id,{buffer,offset:Math.max(0,first/buffer.sampleRate-.004)});
      }catch{this.failed.add(id);}
    }));
  }
  track(source,gain){
    if(this.active.size>=8){const oldest=this.active.values().next().value;oldest.stop();this.active.delete(oldest);}
    this.active.add(source);
    source.onended=()=>{source.disconnect();gain.disconnect();this.active.delete(source);};
  }
  stop(){for(const source of this.active){try{source.stop();}catch{}}this.active.clear();}
  reset(){this.stop();this.last.clear();}
  tone(freq,duration=.08,type='sine',volume=.045,delay=0){
    if(this.muted||!this.ctx||this.ctx.state!=='running')return;
    const t=this.ctx.currentTime+delay,osc=this.ctx.createOscillator(),gain=this.ctx.createGain();
    osc.type=type;osc.frequency.setValueAtTime(freq,t);gain.gain.setValueAtTime(.001,t);gain.gain.linearRampToValueAtTime(volume,t+.008);gain.gain.exponentialRampToValueAtTime(.001,t+duration);
    osc.connect(gain);gain.connect(this.master||this.ctx.destination);this.track(osc,gain);osc.start(t);osc.stop(t+duration+.01);
  }
  event(e,ability='dash'){
    if(this.muted||!this.ctx||this.ctx.state!=='running')return;
    const id=e.type==='ability'?ability:e.type,now=this.ctx.currentTime;
    const cooldown=SOUND_BANK[id]?.cooldown??(id==='pellet'?.12:id==='warning'?.45:0);
    if(now-(this.last.get(id)??-Infinity)<cooldown)return;
    this.last.set(id,now);
    const loaded=this.buffers.get(id);
    if(!loaded){this.fallback(e);return;}
    const source=this.ctx.createBufferSource(),gain=this.ctx.createGain();source.buffer=loaded.buffer;
    gain.gain.value=SOUND_BANK[id].volume;
    if(id==='pellet')source.playbackRate.value=e.tick%2?1:1.08;
    if(id==='ghost')source.playbackRate.value=1+.06*Math.max(0,Math.min(3,Math.log2((e.points||200)/200)));
    source.connect(gain);gain.connect(this.master||this.ctx.destination);this.track(source,gain);
    source.start(0,loaded.offset);
    // Repeated bites must not build up long tails over the important cues.
    if(id==='pellet'){gain.gain.setValueAtTime(gain.gain.value,now+.09);gain.gain.linearRampToValueAtTime(0,now+.13);source.stop(now+.14);}
  }
  fallback(e){
    if(e.type==='pellet')this.tone(e.tick%2?490:640,.045,'sine',.023);
    if(e.type==='power'||e.type==='stage')for(let i=0;i<5;i++)this.tone(220*2**(i/3),.14,'triangle',.045,i*.07);
    if(e.type==='ghost')for(let i=0;i<3;i++)this.tone(650+i*200,.1,'square',.025,i*.06);
    if(e.type==='ability'){this.tone(330,.16,'sawtooth',.025);this.tone(700,.2,'triangle',.025,.06);}
    if(e.type==='hit'){this.tone(90,.32,'sawtooth',.05);this.tone(60,.35,'triangle',.04,.1);}
    if(e.type==='warning')this.tone(850,.09,'square',.018);
    if(e.type==='gate')this.tone(430,.2,'triangle',.04);
  }
}
