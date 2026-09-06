import {inspectGrp,crc32} from './grp.js';
import {LocalStore,BUILD,encodeSaves,decodeSaves} from './storage.js';
const $=id=>document.getElementById(id), store=new LocalStore();
let selected=null,frame=null,ready=false,launching=false,stopping=false,pendingBoot=null,saveJob=null;
let sessionSaves={},lastSignature='',loadTimer=null,storageWarning=false,selectionToken=0;
let prefs={touch:'auto',sensitivity:1,sound:true,remember:true,ansem:true,hands:true},held=new Set(),weapon=1;
const ansemEnabled=()=>Boolean(prefs.ansem&&selected&&selected.crc!=='983ad923');
const profile=()=>selected?BUILD+':'+selected.crc+(ansemEnabled()?':ansem-v2':''):'';
const api=()=>frame?.contentWindow?.publicDuke;
const active=()=>{const gm=api()?.state()||0;return Boolean((gm&4)&&!(gm&1));};
function status(text){$('status').textContent=text;}
function showSelection(){
  $('edition').textContent=selected?.label||'Bring your DUKE3D.GRP';
  $('file-info').textContent=selected?`${(selected.size/1048576).toFixed(1)} MB · Ready on this device`:'Your game file is read on your device. It is never uploaded.';
  $('play').disabled=!selected||launching;
  $('play').firstChild.textContent=selected?'PLAY SLOP NUKEM 3D ':'CHOOSE A FILE TO PLAY ';
  $('forget').hidden=!selected;$('export').disabled=!selected;$('import').disabled=!selected;$('import-button').disabled=!selected;
  $('ansem').disabled=!selected||selected.crc==='983ad923';
  $('hands').disabled=!selected||selected.crc==='983ad923';
  $('ansem-note').textContent=selected?.crc==='983ad923'?'Shareware keeps its original menus and artwork. The Gameslop reskin requires a supported retail game file.':'Retail copies get Slop Nukem 3D menus, with optional Ansem enemies and red mascot hands.';
}
function storageIssue(error){
  $('storage-note').textContent='Browser storage is unavailable or full. You can still play; export your saves before closing the page.';
  if(!storageWarning){storageWarning=true;status('Could not keep data on this device. Play still works; use Export saves for a backup.');console.warn(error);}
}
async function persist(){
  if(saveJob)return saveJob;
  if(!ready||!selected)return;
  saveJob=(async()=>{
    const files=api()?.files();if(!files)return;
    const signature=Object.entries(files).map(([name,bytes])=>name+':'+crc32(bytes)).join('|');
    sessionSaves=files;
    if(signature===lastSignature)return;
    try{await store.put('saves:'+profile(),files);lastSignature=signature;}catch(error){storageIssue(error);}
  })();
  try{await saveJob;}finally{saveJob=null;}
}
function key(code,down){
  if(!ready)return;
  if(down){if(held.has(code))return;api()?.focus();held.add(code);}else held.delete(code);
  api()?.key(code,down);
}
function tap(code){key(code,true);setTimeout(()=>key(code,false),90);}
function release(){for(const code of [...held])key(code,false);$('stick').firstElementChild.style.transform='';}
function pause(){release();if(active())tap(41);}
function touchWanted(){return prefs.touch==='on'||(prefs.touch==='auto'&&matchMedia('(pointer:coarse)').matches);}
function updateTouch(){
  const wanted=ready&&touchWanted(),portrait=innerHeight>innerWidth;
  $('touch').hidden=!wanted||!active()||portrait;
  $('touch-menu').hidden=!wanted||active()||portrait;
  $('rotate').hidden=!wanted||!portrait;
  if(wanted&&portrait&&active())pause();
}
function progress(text){$('loading-text').textContent=text;$('loading').hidden=false;}
async function stop(){
  if(stopping)return;stopping=true;release();await persist();
  clearTimeout(loadTimer);
  try{if(document.fullscreenElement)await document.exitFullscreen();}catch{}
  frame?.remove();frame=null;ready=false;launching=false;pendingBoot=null;stopping=false;
  $('loading').hidden=true;$('game').hidden=true;$('launcher').hidden=false;document.body.style.overflow='';
  showSelection();$('play').focus();
}
async function launch(){
  if(!selected||launching)return;
  launching=true;lastSignature='';showSelection();status('');
  try{
    inspectGrp(selected.bytes);
    try{sessionSaves=await store.get('saves:'+profile())||sessionSaves;}catch(error){storageIssue(error);}
    pendingBoot={type:'boot',bytes:selected.bytes,saves:sessionSaves,sound:prefs.sound,touch:touchWanted(),ansem:ansemEnabled(),hands:prefs.hands&&selected.crc!=='983ad923'};
    $('launcher').hidden=true;$('game').hidden=false;document.body.style.overflow='hidden';progress('Loading engine…');
    frame=document.createElement('iframe');frame.title='Slop Nukem 3D game';frame.allow='fullscreen; autoplay';frame.src='engine.html';
    $('viewport').replaceChildren(frame);
    loadTimer=setTimeout(()=>{if(!ready)progress('Still loading. You can wait or return to the launcher.');},30000);
  }catch(error){await stop();status(error.message);}
}
window.addEventListener('message',event=>{
  if(!frame||event.source!==frame.contentWindow||event.origin!==location.origin)return;
  const {type,value}=event.data||{};
  if(type==='frame-ready'&&pendingBoot)frame.contentWindow.postMessage(pendingBoot,location.origin);
  if(type==='progress')progress(value);
  if(type==='pointer-unavailable')$('game-note').textContent='Mouse capture unavailable. Click to try again, or enable touch controls in the launcher.';
  if(type==='ready'){clearTimeout(loadTimer);pendingBoot=null;ready=true;$('loading').hidden=true;api()?.focus();updateTouch();}
  if(type==='error'){clearTimeout(loadTimer);pause();progress('The game could not continue. Return to the launcher to try again.');status(String(value));}
  if(type==='exit'){persist().then(stop);}
});
$('game-file').addEventListener('change',async event=>{
  const file=event.target.files[0];if(!file)return;
  const token=++selectionToken;
  $('play').disabled=true;
  try{
    if(file.size>50*1024*1024)throw new Error('Choose DUKE3D.GRP, up to 50 MB. Extract downloaded archives first.');
    const bytes=await file.arrayBuffer(),info=inspectGrp(bytes);
    if(token!==selectionToken)return;
    selected={...info,bytes};sessionSaves={};lastSignature='';status('');
    try{await store.put('selected',prefs.remember?selected:undefined);}catch(error){storageIssue(error);}
  }catch(error){status(error.message);}
  showSelection();
});
$('choose').addEventListener('click',()=>$('game-file').click());
$('import-button').addEventListener('click',()=>$('import').click());
$('forget').addEventListener('click',async()=>{
  try{await store.put('selected',undefined);}catch(error){storageIssue(error);return;}
  selected=null;sessionSaves={};$('game-file').value='';showSelection();status('Game file removed from this browser. Your saved games are retained.');
});
async function setPreferences(){
  const previousRemember=prefs.remember;
  const previousAnsem=prefs.ansem;
  prefs={touch:$('touch-mode').value,sensitivity:Number($('sensitivity').value),sound:$('sound').checked,remember:$('remember').checked,ansem:$('ansem').checked,hands:$('hands').checked};
  if(previousAnsem!==prefs.ansem){sessionSaves={};lastSignature='';}
  try{if(previousRemember!==prefs.remember)await store.put('selected',prefs.remember?selected:undefined);await store.put('prefs',prefs);}catch(error){storageIssue(error);}
  updateTouch();
}
for(const id of ['touch-mode','sensitivity','sound','remember','ansem','hands'])$(id).addEventListener('change',setPreferences);
$('export').addEventListener('click',async()=>{
  if(!selected)return;
  try{
    await persist();let files=sessionSaves;
    if(!Object.keys(files).length)files=await store.get('saves:'+profile())||{};
    if(!Object.keys(files).some(name=>/\.esv$/i.test(name)))throw new Error('No saved games yet. Use F2 or the Save button during a game first.');
    const blob=new Blob([encodeSaves(profile(),files)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=`duke-saves-${selected.crc}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);status('Save backup exported.');
  }catch(error){status(error.message);}
});
$('import').addEventListener('change',async event=>{
  const file=event.target.files[0];if(!file||!selected)return;
  try{
    if(file.size>48*1024*1024)throw new Error('Backup is too large.');
    const files=decodeSaves(await file.text(),profile());
    const current=await store.get('saves:'+profile())||sessionSaves;
    // Keep existing slots; backups can be imported repeatedly without erasing progress.
    sessionSaves={...files,...current};
    try{await store.put('saves:'+profile(),sessionSaves);}catch(error){storageIssue(error);}
    status('Backup imported. Existing save slots were kept. Choose Load Game after starting.');
  }catch(error){status('Could not import backup: '+error.message);}finally{event.target.value='';}
});
$('play').addEventListener('click',launch);$('cancel').addEventListener('click',stop);$('quit').addEventListener('click',stop);
$('pause').addEventListener('click',()=>{release();tap(41);api()?.focus();});
$('save-game').addEventListener('click',()=>{release();tap(59);api()?.focus();});
$('load-game').addEventListener('click',()=>{release();tap(60);api()?.focus();});
$('fullscreen').addEventListener('click',async()=>{
  try{release();if(document.fullscreenElement)await document.exitFullscreen();else await $('game').requestFullscreen();api()?.focus();}
  catch{status('Fullscreen is unavailable here. You can still play in the browser window.');}
});
function resumeSound(){api()?.sound(prefs.sound);}
document.addEventListener('pointerdown',resumeSound);document.addEventListener('keydown',resumeSound);
for(const button of document.querySelectorAll('[data-key]')){
  const code=Number(button.dataset.key);
  if(button.closest('#touch-menu')){
    // Menus need a complete key tap after the browser finishes the touch gesture.
    button.addEventListener('click',()=>tap(code));
    continue;
  }
  button.addEventListener('pointerdown',event=>{event.preventDefault();button.setPointerCapture(event.pointerId);key(code,true);});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,()=>key(code,false));
}
for(const [id,delta] of [['weapon-prev',-1],['weapon-next',1]])$(id).addEventListener('click',()=>{weapon=(weapon+delta+10)%10;tap(30+weapon);});
let stickPointer=null,lookPointer=null,lookLast=null;
const movement=[26,22,4,7];
function moveStick(event){
  const box=$('stick').getBoundingClientRect(),dx=(event.clientX-box.left-box.width/2)/(box.width/2),dy=(event.clientY-box.top-box.height/2)/(box.height/2);
  key(26,dy<-.28);key(22,dy>.28);key(4,dx<-.28);key(7,dx>.28);
  const length=Math.max(1,Math.hypot(dx,dy));$('stick').firstElementChild.style.transform=`translate(${dx/length*32}px,${dy/length*32}px)`;
}
$('stick').addEventListener('pointerdown',event=>{if(stickPointer!==null)return;event.preventDefault();stickPointer=event.pointerId;$('stick').setPointerCapture(event.pointerId);moveStick(event);});
$('stick').addEventListener('pointermove',event=>{if(event.pointerId===stickPointer)moveStick(event);});
function endStick(event){if(event.pointerId!==stickPointer)return;stickPointer=null;for(const code of movement)key(code,false);$('stick').firstElementChild.style.transform='';}
for(const type of ['pointerup','pointercancel','lostpointercapture'])$('stick').addEventListener(type,endStick);
$('look').addEventListener('pointerdown',event=>{if(lookPointer!==null)return;event.preventDefault();lookPointer=event.pointerId;lookLast={x:event.clientX,y:event.clientY};$('look').setPointerCapture(event.pointerId);});
$('look').addEventListener('pointermove',event=>{if(event.pointerId!==lookPointer||!lookLast)return;api()?.look((event.clientX-lookLast.x)*prefs.sensitivity,(event.clientY-lookLast.y)*prefs.sensitivity);lookLast={x:event.clientX,y:event.clientY};});
for(const type of ['pointerup','pointercancel','lostpointercapture'])$('look').addEventListener(type,event=>{if(event.pointerId===lookPointer){lookPointer=null;lookLast=null;}});
window.addEventListener('resize',()=>{release();stickPointer=null;lookPointer=null;lookLast=null;updateTouch();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){pause();persist();}});
// Focus can move through BODY while the iframe captures the mouse. Check after
// the focus transition so clicking the game does not accidentally open its menu.
window.addEventListener('blur',()=>{setTimeout(()=>{if(!document.hasFocus()){release();pause();}},0);});
setInterval(()=>{if(ready)updateTouch();},180);setInterval(persist,2000);
window.DukePublic={get engine(){return api();},get ready(){return ready;},get selected(){return selected;},get held(){return [...held];},persist,store,profile,stop};
(async()=>{
  try{
    if(!window.WebAssembly)throw new Error('This browser does not support WebAssembly. Use a current Chrome, Edge, Firefox or Safari.');
    try{await store.open();prefs={...prefs,...await store.get('prefs')};selected=await store.get('selected')||null;}catch(error){storageIssue(error);}
    if(selected){try{Object.assign(selected,inspectGrp(selected.bytes));}catch{selected=null;status('The remembered game file could not be read. Choose it again.');}}
    $('touch-mode').value=prefs.touch;$('sensitivity').value=prefs.sensitivity;$('sound').checked=prefs.sound;$('remember').checked=prefs.remember;$('ansem').checked=prefs.ansem;$('hands').checked=prefs.hands;
    showSelection();document.body.dataset.ready='1';
  }catch(error){status(error.message);}
})();
