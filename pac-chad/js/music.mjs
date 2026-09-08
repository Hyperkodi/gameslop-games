import {MUSIC_BANK} from './music-bank.mjs';

// Separate from the eight SFX voices so collecting pellets never cuts off music.
export class Music {
  constructor(audio){
    this.audio=audio;this.stage=null;this.playing=false;this.offset=0;
    this.source=null;this.gain=null;this.startedAt=0;
    this.buffers=new Map();this.failed=new Set();this.loading=null;this.retiring=new Set();
  }
  sync(stage,playing){
    stage=Number.isInteger(stage)&&MUSIC_BANK[stage]?stage:null;
    if(stage!==this.stage){
      this.pause(.12);this.offset=0;this.stage=stage;
      this.loading?.controller.abort();this.loading=null;
    }
    this.playing=!!playing;
    if(!this.playing||this.audio.muted||this.audio.ctx?.state!=='running')this.pause();
    if(stage===null||!this.audio.ctx||this.audio.muted)return;
    if(!this.buffers.has(stage))this.load(stage);
    this.start();
  }
  load(stage){
    if(this.loading?.stage===stage||this.failed.has(stage))return;
    const controller=new AbortController(),job={stage,controller};this.loading=job;
    job.promise=(async()=>{
      const timer=setTimeout(()=>controller.abort(),30000);
      try{
        const spec=MUSIC_BANK[stage];let buffer,usedFallback=false;
        for(const file of [spec.file,spec.fallback]){
          try{
            const response=await fetch(new URL('../'+file,import.meta.url),{signal:controller.signal});
            if(!response.ok)throw Error('Music unavailable');
            buffer=await this.audio.ctx.decodeAudioData(await response.arrayBuffer());
            if(buffer.duration<1)throw Error('Invalid music');
            usedFallback=file===spec.fallback;
            break;
          }catch(error){if(controller.signal.aborted||file===spec.fallback)throw error;}
        }
        // A late decode must never restart an old stage or a stopped game.
        if(controller.signal.aborted)return;
        // Some MP3 decoders expose encoder padding; others already remove it.
        const loopStart=usedFallback&&buffer.duration>spec.duration+.01?spec.fallbackStart:0;
        const loopEnd=usedFallback?Math.min(buffer.duration,loopStart+spec.duration):buffer.duration;
        this.buffers.set(stage,{buffer,loopStart,loopEnd});
        while(this.buffers.size>2){const key=[...this.buffers.keys()].find(key=>key!==this.stage);this.buffers.delete(key);}
      }catch{if(this.stage===stage&&this.loading===job)this.failed.add(stage);}
      finally{
        clearTimeout(timer);
        if(this.loading===job){this.loading=null;this.start();}
      }
    })();
  }
  start(){
    const {ctx}=this.audio,loaded=this.buffers.get(this.stage);
    if(this.source||!loaded||!this.playing||this.audio.muted||ctx?.state!=='running')return;
    const {buffer,loopStart,loopEnd}=loaded;
    const spec=MUSIC_BANK[this.stage],source=ctx.createBufferSource(),gain=ctx.createGain();
    source.buffer=buffer;source.loop=true;source.loopStart=loopStart;source.loopEnd=loopEnd;
    gain.gain.setValueAtTime(0,ctx.currentTime);gain.gain.linearRampToValueAtTime(spec.volume,ctx.currentTime+.25);
    source.connect(gain);gain.connect(this.audio.master||ctx.destination);
    source.onended=()=>{this.retiring.delete(source);source.disconnect();gain.disconnect();};
    this.offset%=(loopEnd-loopStart);this.startedAt=ctx.currentTime;this.source=source;this.gain=gain;
    source.start(0,loopStart+this.offset);
  }
  pause(fade=0){
    this.playing=false;
    if(!fade){for(const source of this.retiring){try{source.stop();}catch{}}this.retiring.clear();}
    if(!this.source)return;
    const now=this.audio.ctx.currentTime,source=this.source,gain=this.gain;
    this.offset=(this.offset+Math.max(0,now-this.startedAt))%(source.loopEnd-source.loopStart);
    if(fade){this.retiring.add(source);gain.gain.cancelScheduledValues(now);gain.gain.setValueAtTime(gain.gain.value,now);gain.gain.linearRampToValueAtTime(0,now+fade);}
    try{source.stop(now+fade);}catch{}
    this.source=null;this.gain=null;
  }
  duck(seconds=1){
    if(!this.gain)return;
    const now=this.audio.ctx.currentTime,level=MUSIC_BANK[this.stage].volume,param=this.gain.gain;
    if(param.cancelAndHoldAtTime)param.cancelAndHoldAtTime(now);else{param.cancelScheduledValues(now);param.setValueAtTime(param.value,now);}
    param.linearRampToValueAtTime(level*.3,now+.035);
    param.setValueAtTime(level*.3,now+seconds);param.linearRampToValueAtTime(level,now+seconds+.3);
  }
  reset(){
    this.pause();this.loading?.controller.abort();this.loading=null;
    this.stage=null;this.playing=false;this.offset=0;this.failed.clear();
  }
}
