'use strict';
const $=id=>document.getElementById(id);
let frame,leaving=false;
function status(text){$('status').textContent=text;}
$('play').addEventListener('click',()=>{
 if(frame)return;
 $('launcher').hidden=true;$('game').hidden=false;status('Loading Slopper’s Bad Fur Day…');
 frame=document.createElement('iframe');frame.title="Slopper's Bad Fur Day game";frame.allow='autoplay; fullscreen; gamepad';
 const query=new URLSearchParams(location.search);frame.src='engine.html'+(query.get('core')==='parallel'?'?core=parallel':'');$('viewport').replaceChildren(frame);
});
$('fullscreen').addEventListener('click',async()=>{
 try{if(document.fullscreenElement)await document.exitFullscreen();else await $('game').requestFullscreen();frame?.contentWindow.focus();}catch{status('Fullscreen is unavailable in this browser.');}
});
$('exit').addEventListener('click',async()=>{
 if(leaving)return;leaving=true;
 try{await frame?.contentWindow.ConkerLocal?.flushSaves();if(document.fullscreenElement)await document.exitFullscreen();frame?.remove();frame=null;delete document.body.dataset.playing;$('game').hidden=true;$('launcher').hidden=false;status('');$('play').focus();}
 catch{status('Could not keep progress. Export a save from the emulator menu before leaving.');}finally{leaving=false;}
});
addEventListener('message',event=>{
 if(event.source!==frame?.contentWindow||event.origin!==location.origin)return;
 if(event.data?.type==='started'){status('');document.body.dataset.playing='1';}
 if(event.data?.type==='error')status(event.data.message);
});
document.body.dataset.ready='1';
