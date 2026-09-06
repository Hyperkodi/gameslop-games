'use strict';
const $=id=>document.getElementById(id);
let frame;
let sensitivity=1;
try{sensitivity=Math.min(2,Math.max(.25,Number(localStorage.getItem('goldeneye-mouse-sensitivity'))||1));}catch{}
$('mouse-sensitivity').value=sensitivity;
$('mouse-aim').addEventListener('click',()=>frame?.contentWindow.GoldenEyeLocal?.mouse?.capture());
$('mouse-sensitivity').addEventListener('input',event=>{
  sensitivity=Number(event.target.value);frame?.contentWindow.GoldenEyeLocal?.mouse?.setSensitivity(sensitivity);
  try{localStorage.setItem('goldeneye-mouse-sensitivity',String(sensitivity));}catch{}
});
function status(text){$('status').textContent=text;}
$('play').addEventListener('click',()=>{
  if(!window.GoldenEyePublic?.gameUrl)return;
  $('mouse-tools').hidden=true;
  $('launcher').hidden=true;$('game').hidden=false;status('Starting GoldenEye 64…');
  const options=new URLSearchParams();const query=new URLSearchParams(location.search);
  if(query.get('core')==='parallel')options.set('core','parallel');
  frame=document.createElement('iframe');frame.title='GoldenEye 64 local game';frame.allow='autoplay; fullscreen; gamepad';frame.src='engine.html'+(options.size?'?'+options:'');$('viewport').replaceChildren(frame);
});
$('fullscreen').addEventListener('click',async()=>{
  try{if(document.fullscreenElement)await document.exitFullscreen();else await $('game').requestFullscreen();frame?.contentWindow.focus();}catch{status('Fullscreen is unavailable in this browser.');}
});
$('exit').addEventListener('click',async()=>{
  frame?.contentWindow.GoldenEyeLocal?.mouse?.release();
  try{await frame?.contentWindow.GoldenEyeLocal?.flushSaves();}
  catch{status('Could not keep mission progress. Export a save from the emulator menu before leaving.');return;}
  if(document.fullscreenElement)await document.exitFullscreen();frame?.remove();frame=null;delete document.body.dataset.playing;$('game').hidden=true;$('launcher').hidden=false;status('');$('play').focus();
});
window.addEventListener('message',event=>{
  if(event.source!==frame?.contentWindow||event.origin!==location.origin)return;
  if(event.data?.type==='started'){status('');document.body.dataset.playing='1';}
  if(event.data?.type==='error')status(event.data.message);
  if(event.data?.type==='mouse-ready'){
    $('mouse-tools').hidden=!event.data.supported;
    frame.contentWindow.GoldenEyeLocal.mouse.setSensitivity(sensitivity);
  }
  if(event.data?.type==='mouse-state'){
    $('mouse-aim').textContent=event.data.active?'Mouse captured · Esc to release':'Mouse aim';
    $('mouse-aim').setAttribute('aria-pressed',String(event.data.active));status('');
  }
  if(event.data?.type==='mouse-error')status(event.data.message);
});
document.body.dataset.ready='1';
