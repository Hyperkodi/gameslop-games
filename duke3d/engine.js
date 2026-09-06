'use strict';
const canvas=document.getElementById('canvas');
let engine, booted=false;
const tell=(type,value)=>parent.postMessage({type,value},location.origin);
// SDL also requests pointer lock. A browser may reject it (for example when
// embedded or immediately after Escape); that is recoverable, not an engine crash.
const nativePointerLock=canvas.requestPointerLock?.bind(canvas);
if(nativePointerLock)canvas.requestPointerLock=(...args)=>{
  if(window.touchControls)return Promise.resolve();
  try{return Promise.resolve(nativePointerLock(...args)).catch(()=>tell('pointer-unavailable'));}
  catch{return Promise.resolve(tell('pointer-unavailable'));}
};
const safeName=name=>/^(save\d{4}\.esv|eduke32\.cfg|settings\.cfg)$/i.test(name);
window.publicDuke={
  key(code,down){engine?._gameslop_key(code,down?1:0);},
  look(dx,dy){engine?._gameslop_look(Math.round(dx),Math.round(dy));},
  state(field=0){return engine?._gameslop_state(field)||0;},
  files(){
    const result={};if(!engine)return result;
    for(const name of engine.FS.readdir('/'))if(safeName(name))result[name]=engine.FS.readFile('/'+name);
    return result;
  },
  sound(enabled){const ctx=engine?.SDL2?.audioContext;if(ctx){if(enabled)ctx.resume().catch(()=>{});else ctx.suspend().catch(()=>{});}},
  focus(){canvas.focus();},
  get module(){return engine;}
};
function unlock(){if(engine&&window.soundEnabled!==false)window.publicDuke.sound(true);}
window.addEventListener('pointerdown',unlock);window.addEventListener('keydown',unlock);
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('click',()=>{
  canvas.focus();const gm=window.publicDuke.state();
  if(!window.touchControls&&(gm&4)&&!(gm&1)&&document.pointerLockElement!==canvas)canvas.requestPointerLock?.()?.catch?.(()=>{});
});
window.addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','F2','F3'].includes(e.code))e.preventDefault();});
window.addEventListener('error',e=>tell('error',e.message));
window.addEventListener('unhandledrejection',e=>tell('error',String(e.reason)));
window.addEventListener('message',async event=>{
  if(event.source!==parent||event.origin!==location.origin||event.data?.type!=='boot'||booted)return;
  booted=true;
  const {bytes,saves,sound,touch,ansem,hands}=event.data;
  window.soundEnabled=sound;
  window.touchControls=Boolean(touch);
  try {
    const {inspectGrp}=await import('./grp.js');
    const retail=inspectGrp(bytes).crc!=='983ad923';
    const artwork=[];
    if(retail){
      const {makeMenuArt}=await import('./mods/branding/menu.js');
      artwork.push(...makeMenuArt(bytes));
      if(hands){
        tell('progress','Preparing Gameslop mascot hands…');
        const {makeMascotHands}=await import('./mods/mascot-hands/hands.js');
        artwork.push(...await makeMascotHands(bytes));
      }
    }
    let ansemArt=null;
    if(ansem){
      if(!retail)throw new Error('The Ansem mod requires a supported retail game file.');
      tell('progress','Preparing Ansem enemy artwork…');
      const {makeAnsemArt}=await import('./mods/ansem/sprites.js');ansemArt=await makeAnsemArt(bytes);
    }
    await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='runtime/eduke32.js';script.onload=resolve;script.onerror=()=>reject(new Error('The engine could not download. Check your connection and try again.'));document.head.appendChild(script);});
    tell('progress',retail?'Starting Slop Nukem 3D…':'Starting the shareware episode…');
    engine=await createEDuke32Module({
      canvas,
      arguments:['-usecwd','-nosetup','-nologo','-gamegrp','DUKE3D.GRP','-cfg','eduke32.cfg',...(retail?['-h','gameslop.def']:[])],
      locateFile:name=>'runtime/'+name,
      print:text=>{console.log(text);tell('log',String(text));},
      printErr:text=>{console.log(text);tell('log',String(text));},
      preRun:[module=>{
        module.FS.writeFile('/DUKE3D.GRP',new Uint8Array(bytes));
        if(retail){
          let definitions='';
          if(ansemArt){module.FS.writeFile('/ansem.art',ansemArt);definitions+='artfile { file "ansem.art" }\n';}
          for(const art of artwork){module.FS.writeFile('/'+art.name,art.bytes);definitions+='artfile { file "'+art.name+'" }\n';}
          module.FS.writeFile('/gameslop.def',definitions);
        }
        module.FS.writeFile('/eduke32.cfg','[Screen Setup]\nScreenMode = 0\nScreenWidth = 960\nScreenHeight = 540\nScreenBPP = 8\n[Controls]\nUseMouse = 1\nMouseAiming = 1\n[KeyDefinitions]\nMove_Forward = "W" "Up"\nMove_Backward = "S" "Down"\nStrafe_Left = "A" ""\nStrafe_Right = "D" ""\nOpen = "E" ""\nJump = "Space" ""\nCrouch = "LCtrl" ""\nFire = "RCtrl" ""\n');
        for(const [name,data] of Object.entries(saves||{}))if(safeName(name))module.FS.writeFile('/'+name,new Uint8Array(data));
      }],
      onAbort:reason=>tell('error','Engine stopped: '+reason),
      onExit:()=>tell('exit'),
    });
    tell('ready');window.publicDuke.sound(sound);canvas.focus();
  }catch(error){tell('error',error.message);}
});
tell('frame-ready');
