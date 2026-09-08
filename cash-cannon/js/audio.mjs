export class Sound{
  constructor(){this.ctx=null;this.muted=false;this.active=new Set();}
  async unlock(){try{this.ctx??=new (window.AudioContext||window.webkitAudioContext)();if(this.ctx.state==='suspended')await this.ctx.resume();}catch{}}
  stop(){for(const n of this.active)try{n.stop();}catch{}this.active.clear();}
  tone(f,to,d=.2,type='sine',volume=.08){
    if(this.muted||this.ctx?.state!=='running')return;const c=this.ctx,t=c.currentTime,o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.setValueAtTime(f,t);o.frequency.exponentialRampToValueAtTime(Math.max(20,to),t+d);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(volume,t+.008);g.gain.exponentialRampToValueAtTime(.001,t+d);o.connect(g);g.connect(c.destination);o.start();o.stop(t+d+.02);this.active.add(o);o.onended=()=>{this.active.delete(o);o.disconnect();g.disconnect();};
  }
  event(e){
    if(['launch','cabal','cex'].includes(e.type)){this.tone(160,30,.45,'triangle',.17);this.tone(470,60,.22,'sawtooth',.055);}
    if(e.type==='dex')this.tone(160,900,.32,'sine',.12);
    if(e.type==='bounce')this.tone(120,55,.09,'sine',.06);
    if(e.type==='honey'){this.tone(300,50,.38,'sine',.12);this.tone(140,60,.6,'triangle',.07);}
    if(e.type==='rug')this.tone(590,35,.65,'sawtooth',.065);
    if(e.type==='result')this.tone(360,180,.3,'triangle',.06);
    if(e.type==='click')this.tone(620,800,.07,'sine',.045);
  }
}
