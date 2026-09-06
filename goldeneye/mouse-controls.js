'use strict';
// Pinned USA GoldenEye + EmulatorJS 4.2.3. Native option offsets are documented
// in n64decomp/007: player.c, bondview.h and options.c. Never patch ROM/code.
class GoldenEyeMouseProfile {
  constructor(emulator){this.emulator=emulator;this.base=null;this.saved=null;}
  view(){return new DataView(this.emulator.gameManager.Module.HEAPU8.buffer);}
  locate(){
    const m=this.emulator.gameManager,heap=m.Module.HEAPU8,rom=m.FS.readFile(this.emulator.fileName);
    if(rom[0]!==0x80||rom[1]!==0x37||rom[2]!==0x12||rom[3]!==0x40||new DataView(rom.buffer,rom.byteOffset).getUint32(8)!==0x80000400)return false;
    // Identify word-swapped RDRAM using the actual loaded ROM's boot code.
    // Other copies (ROM/cache/state buffers) must fail the live-player check.
    const pattern=Array.from({length:64},(_,i)=>rom[0x1000+(i^3)]),found=[],v=this.view();
    for(let i=0x400;i<=heap.length-0x800000;i+=4){
      if(heap[i]!==pattern[0]||heap[i+1]!==pattern[1]||heap[i+2]!==pattern[2]||heap[i+3]!==pattern[3])continue;
      if(!pattern.every((b,j)=>heap[i+j]===b))continue;
      const base=i-0x400,p=v.getUint32(base+0x7a0b0,true);
      if(base%4096)continue; // pinned cores page-align RDRAM; state copies are not RDRAM
      if(p<0x80080000||p>0x807fc000||p%4)continue;
      if(v.getUint32(base+(p&0x7fffff)+0x2a58,true)>7)continue;
      if(v.getUint32(base+0x40a84,true)>1||v.getUint32(base+0x40a9c,true)>1)continue;
      found.push(base);
    }
    if(found.length!==1)return false;
    this.base=found[0];return true;
  }
  player(){
    if(this.base===null)return null;
    const v=this.view(),p=v.getUint32(this.base+0x7a0b0,true);
    if(p<0x80080000||p>0x807fc000||p%4)return null;
    const address=this.base+(p&0x7fffff),style=v.getUint32(address+0x2a58,true);
    return style<=7?address:null;
  }
  apply(){
    const address=this.player();if(address===null)return false;
    const v=this.view();
    if(!this.saved||this.saved.address!==address){
      this.saved={address,fields:Array.from({length:5},(_,i)=>v.getUint32(address+0x2a58+i*4,true)),aim:v.getUint32(this.base+0x40a9c,true),aiming:v.getUint32(address+0x124,true)};
    }
    // Equivalent to cur_player_set_control_type(1): 1.2 Solitaire.
    [1,1,0x3f800000,0xfffffff6,1].forEach((value,i)=>v.setUint32(address+0x2a58+i*4,value,true));
    v.setUint32(this.base+0x40a9c,0,true); // right mouse is hold-to-aim
    return true;
  }
  // Native positive pitch looks up; screen mouse Y increases downwards.
  verticalSign(){return this.view().getUint32(this.base+0x40a84,true)===0?-1:1;}
  restore(){
    if(this.saved&&this.player()===this.saved.address){
      const v=this.view();
      this.saved.fields.forEach((value,i)=>v.setUint32(this.saved.address+0x2a58+i*4,value,true));
      v.setUint32(this.saved.address+0x124,this.saved.aiming,true);
      v.setUint32(this.base+0x40a9c,this.saved.aim,true);
    }
    this.saved=null;
  }
}

window.installGoldenEyeMouseControls=function(emulator){
  const canvas=emulator.canvas,manager=emulator.gameManager,profile=new GoldenEyeMouseProfile(emulator);
  const supported=!!canvas?.requestPointerLock&&matchMedia('(any-pointer: fine)').matches;
  let active=false,pending=false,dx=0,dy=0,lastTime=0,raf=0,sensitivity=1;
  const held=new Map(),sent=new Map();
  const movement={KeyW:4,KeyS:5,KeyA:6,KeyD:7},actions={KeyR:1,KeyZ:1,KeyX:0,KeyE:11,Space:12};
  const indexes=[0,1,4,5,6,7,11,12,16,17,18,19];
  const reticle=document.createElement('div');reticle.id='mouse-reticle';reticle.setAttribute('aria-hidden','true');document.body.append(reticle);
  const post=(type,extra={})=>parent.postMessage({type,...extra},location.origin);
  function send(index,value){if(sent.get(index)!==value){manager.simulateInput(0,index,value);sent.set(index,value);}}
  function button(source,index,down){if(down)held.set(source,index);else held.delete(source);send(index,[...held.values()].includes(index)?1:0);reticle.hidden=!active||[...held.values()].includes(11);}
  function clear(){held.clear();indexes.forEach(index=>{manager.simulateInput(0,index,0);sent.set(index,0);});dx=dy=0;reticle.hidden=true;}
  function release(){clear();if(document.pointerLockElement===canvas)document.exitPointerLock();deactivate();}
  function deactivate(){active=false;cancelAnimationFrame(raf);profile.restore();reticle.hidden=true;post('mouse-state',{active:false});}
  function stick(delta){if(Math.abs(delta)<.01)return 0;return Math.round(Math.sign(delta)*Math.min(32767,6500+Math.abs(delta)*sensitivity*750));}
  function axis(positive,negative,value){send(positive,Math.max(0,value));send(negative,Math.max(0,-value));}
  function tick(now){
    if(!active)return;
    if(document.hidden||emulator.isPopupOpen?.()){release();return;}
    if(!profile.apply()){release();post('mouse-error',{message:'Mouse controls could not read the current player. Click Mouse aim again after the mission loads.'});return;}
    const dt=Math.min(50,Math.max(8,now-lastTime||16.67));lastTime=now;
    axis(16,17,stick(dx*16.67/dt));axis(18,19,stick(dy*16.67/dt)*profile.verticalSign());dx=dy=0;
    raf=requestAnimationFrame(tick);
  }
  async function capture(){
    if(active||pending||!supported)return;
    pending=true;
    try{
      if(profile.base===null&&!profile.locate())throw Error('Mouse controls are unavailable for this emulator session. Keyboard and controller controls still work.');
      canvas.focus();
      try{await canvas.requestPointerLock({unadjustedMovement:true});}
      catch(error){if(error.name!=='NotSupportedError')throw error;await canvas.requestPointerLock();}
    }catch(error){post('mouse-error',{message:error.message||'Click Mouse aim again to capture the cursor.'});}
    finally{pending=false;}
  }
  document.addEventListener('pointerlockchange',()=>{
    if(document.pointerLockElement===canvas){
      clear();active=true;lastTime=performance.now();reticle.hidden=false;post('mouse-state',{active:true});raf=requestAnimationFrame(tick);
    }else{clear();deactivate();}
  });
  document.addEventListener('pointerlockerror',()=>post('mouse-error',{message:'Mouse capture was blocked. Click Mouse aim to try again.'}));
  document.addEventListener('mousemove',event=>{if(active){dx+=event.movementX;dy+=event.movementY;}},true);
  document.addEventListener('mousedown',event=>{
    if(!active){if(event.target===canvas&&event.button===0&&!emulator.isPopupOpen?.()){event.preventDefault();event.stopImmediatePropagation();capture();}return;}
    if(event.button===0||event.button===2){event.preventDefault();event.stopImmediatePropagation();button('mouse'+event.button,event.button===0?12:11,true);}
  },true);
  document.addEventListener('mouseup',event=>{
    if(active&&(event.button===0||event.button===2)){event.preventDefault();event.stopImmediatePropagation();button('mouse'+event.button,event.button===0?12:11,false);}
  },true);
  document.addEventListener('contextmenu',event=>{if(active){event.preventDefault();event.stopImmediatePropagation();}},true);
  for(const type of ['keydown','keyup'])window.addEventListener(type,event=>{
    if(!active)return;
    if(event.code==='Escape'||event.code==='Enter'||event.code==='Tab'){
      if(type==='keydown')release();return;
    }
    const index=movement[event.code]??actions[event.code];if(index===undefined)return;
    event.preventDefault();event.stopImmediatePropagation();button(event.code,index,type==='keydown');
  },true);
  window.addEventListener('blur',release);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)release();});
  window.addEventListener('pagehide',release);
  reticle.hidden=true;
  const api={capture,release,get active(){return active;},get supported(){return supported;},
    setSensitivity(value){sensitivity=Math.min(2,Math.max(.25,Number(value)||1));},
    get sensitivity(){return sensitivity;}};
  window.GoldenEyeLocal.mouse=api;
  post('mouse-ready',{supported});
  return api;
};
