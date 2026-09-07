'use strict';
window.EJS_player='#emulator';
window.EJS_core=new URLSearchParams(location.search).get('core')==='parallel'?'parallel_n64':'mupen64plus_next';
window.EJS_pathtodata='https://cdn.emulatorjs.org/4.2.3/data/';
window.EJS_gameName='Sloppers Bad Fur Day EU v1';
window.EJS_color='#ff4439';
window.EJS_backgroundColor='#101312';
window.EJS_startOnLoaded=true;
window.EJS_language='en-US';
window.EJS_disableAutoLang=true;
window.EJS_threads=false;
window.EJS_defaultOptions={webgl2Enabled:'enabled','save-state-location':'browser','save-save-interval':'30','virtual-gamepad':navigator.maxTouchPoints>0?'enabled':'disabled'};
window.EJS_Buttons={saveState:true,loadState:true,gamepad:true,settings:true,volume:true,fullscreen:true,screenRecord:false,netplay:false};
window.EJS_defaultControls={0:{
  0:{value:'space',value2:'BUTTON_1'},1:{value:'j',value2:'BUTTON_3'},8:{value:'',value2:'BUTTON_2'},9:{value:'',value2:'BUTTON_4'},3:{value:'enter',value2:'START'},
  4:{value:'t',value2:'DPAD_UP'},5:{value:'g',value2:'DPAD_DOWN'},6:{value:'f',value2:'DPAD_LEFT'},7:{value:'h',value2:'DPAD_RIGHT'},
  10:{value:'q',value2:'LEFT_TOP_SHOULDER'},11:{value:'e',value2:'RIGHT_TOP_SHOULDER'},12:{value:'shift',value2:'LEFT_BOTTOM_SHOULDER'},
  16:{value:'d',value2:'LEFT_STICK_X:+1'},17:{value:'a',value2:'LEFT_STICK_X:-1'},18:{value:'s',value2:'LEFT_STICK_Y:+1'},19:{value:'w',value2:'LEFT_STICK_Y:-1'},
  20:{value:'right arrow',value2:'RIGHT_STICK_X:+1'},21:{value:'left arrow',value2:'RIGHT_STICK_X:-1'},22:{value:'down arrow',value2:'RIGHT_STICK_Y:+1'},23:{value:'up arrow',value2:'RIGHT_STICK_Y:-1'}
},1:{},2:{},3:{}};
window.EJS_onGameStart=()=>{
  parent.postMessage({type:'started'},location.origin);

};
// These APIs are tied to the pinned EmulatorJS 4.2.3 runtime manifest.
window.ConkerLocal={async flushSaves(){
  const manager=window.EJS_emulator?.gameManager;if(!manager)return;
  manager.saveSaveFiles();
  await new Promise((resolve,reject)=>manager.FS.syncfs(false,error=>error?reject(error):resolve()));
}};
document.addEventListener('visibilitychange',()=>{if(document.hidden)window.ConkerLocal.flushSaves().catch(()=>{});});
window.addEventListener('error',event=>parent.postMessage({type:'error',message:event.message},location.origin));
window.addEventListener('unhandledrejection',event=>parent.postMessage({type:'error',message:String(event.reason)},location.origin));

// Verify the published Gameslop build before starting the core.
(async () => {
  const manifestResponse=await fetch('game-manifest.json',{cache:'no-store'});
  if(!manifestResponse.ok)throw Error('Could not load the game. Return to the launcher and try again.');
  const game=await manifestResponse.json();
  if(game.schema!==1||game.size!==67108864||game.file!=='data/gameslop.z64'||!/^[a-f0-9]{64}$/.test(game.sha256))throw Error('Invalid game build. Reload this page and try again.');
  const url=new URL(game.file,location.href);url.searchParams.set('build',game.sha256);
  const response=await fetch(url);
  if(!response.ok)throw Error('Could not download the game. Check your connection and try again.');
  const bytes=await response.arrayBuffer();
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
  if(bytes.byteLength!==game.size||digest!==game.sha256)throw Error('The game download was incomplete. Return to the launcher and try again.');
  window.EJS_gameUrl=URL.createObjectURL(new Blob([bytes],{type:'application/octet-stream'}));
  window.EJS_CacheLimit=0;
  window.ConkerLocal.build={mode:'slopper',sha256:game.sha256};
  const loader=document.createElement('script');
  loader.src=window.EJS_pathtodata+'loader.js';
  loader.onerror=()=>parent.postMessage({type:'error',message:'Could not load the emulator. Check your connection and try again.'},location.origin);
  document.body.append(loader);
})().catch(error=>{
  document.getElementById('emulator').textContent=error.message;
  parent.postMessage({type:'error',message:error.message},location.origin);
});
