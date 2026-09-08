// Use the site's existing SDK when hosted in its cabinet. No X tokens enter the game.
export class Platform {
  constructor(){this.sdk=null;this.run=null;this.status='Practice run · Personal best saved on this device';}
  async connect(){
    if(window.parent===window)return false;
    try{
      if(!window.GameSlop)await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=new URL('../integration/gameslop-sdk.js',import.meta.url).href;script.onload=resolve;script.onerror=reject;document.head.append(script);});
      this.sdk=window.GameSlop;await this.sdk.ready();this.status='Gameslop connected · Provisional score tracking';return true;
    }catch{this.sdk=null;this.status='Practice run · Gameslop connection unavailable';return false;}
  }
  async start(){if(!this.sdk)return {seed:0x504143};this.run=await this.sdk.startRun();return this.run;}
  async finish(state){
    if(!this.sdk||!this.run)return 'Saved to your personal best board on this device.';
    this.run=null;
    try{await this.sdk.submit(state.score,{outcome:state.reason==='campaign_complete'?'victory':'defeat',reason:state.reason});return 'Run sent to Gameslop. Official rankings are not enabled for this build.';}
    catch{return 'Saved on this device. Gameslop could not accept this run.';}
  }
}
