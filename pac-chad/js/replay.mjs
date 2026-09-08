import {createRun,step,RUN_TICKS,VERSION} from './model.mjs';
// Two four-bit controller states per byte: full five-minute evidence is 12 KB base64.
export class Recorder {
  constructor(){this.bytes=new Uint8Array(Math.ceil(RUN_TICKS/2));this.length=0;}
  add(input){if(this.length>=RUN_TICKS)throw new Error('Replay full');const i=this.length++;this.bytes[i>>1]|=input<<((i%2)*4);}
  export(){let raw='';for(const byte of this.bytes.subarray(0,Math.ceil(this.length/2)))raw+=String.fromCharCode(byte);return {version:VERSION,ticks:this.length,inputs:btoa(raw)};}
}
export function validateReplay(evidence,expected) {
  if(!evidence||evidence.version!==VERSION||!Number.isInteger(evidence.ticks)||evidence.ticks<1||evidence.ticks>RUN_TICKS||typeof evidence.inputs!=='string'||evidence.inputs.length>12000) throw new Error('Invalid replay envelope');
  if(!expected||expected.version!==VERSION)throw new Error('Unknown authoritative ruleset');
  let raw;try{raw=atob(evidence.inputs);}catch{throw new Error('Invalid replay encoding');}
  if(btoa(raw)!==evidence.inputs||raw.length!==Math.ceil(evidence.ticks/2))throw new Error('Noncanonical replay');
  if(evidence.ticks%2 && raw.charCodeAt(raw.length-1)>15)throw new Error('Invalid padding');
  const state=createRun(expected);
  for(let tick=0;tick<evidence.ticks;tick++) {
    if(state.done)throw new Error('Inputs after completion');
    const input=(raw.charCodeAt(tick>>1)>>((tick%2)*4))&15;
    if((input&7)>4)throw new Error('Impossible controller input');
    step(state,input);
  }
  if(!state.done)throw new Error('Incomplete run');
  if(expected.score!==undefined&&expected.score!==state.score)throw new Error('Score does not match replay');
  return {score:state.score,ticks:state.tick,reason:state.reason,stage:state.stage,pellets:state.pelletsEaten,ghosts:state.ghostsEaten};
}
