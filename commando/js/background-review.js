(function(){
 'use strict';
 const G=window.SlopCommando,$=id=>document.getElementById(id);
 const themes=Object.fromEntries(['jungle','water','snow','foundry','cave','alien'].map(t=>[t,{sky:'#142c30'}]));
 const original=JSON.parse(JSON.stringify(window.SlopCommandoSkin));original.environment.preferOriginal=true;
 const before=G.createEnvironmentRenderer($('before').getContext('2d'),original,themes);
 const after=G.createEnvironmentRenderer($('after').getContext('2d'),window.SlopCommandoSkin,themes);
 let stage=0,progress=0,playing=false,loaded=false,request=0,last=0,join=0;
 function render(){
  if(!loaded)return;
  const level=G.buildLevel(stage),vertical=level.mode==='climb';
  const state={stage,level,camera:{x:vertical?0:progress*(level.width-960),y:vertical?(1-progress)*(level.height-540):0}};
  before.draw(state,0);after.draw(state,0);
  $('position').value=Math.round(progress*1000);$('progress').textContent=Math.round(progress*100)+'%';
 }
 async function select(){
  const token=++request;stage=Number($('stage').value);loaded=false;progress=0;join=0;$('status').textContent='Loading scenery…';
  try{const results=await Promise.all([before.loadStage(stage),after.loadStage(stage)]);if(token!==request)return;
   loaded=results.every(Boolean);$('status').textContent=loaded?'Ready. Both views move together.':'Some scenery could not load. Reload to try again.';render();
  }catch(e){if(token===request)$('status').textContent='Unable to load scenery. Reload to try again.';}
 }
 $('stage').addEventListener('change',select);
 $('position').addEventListener('input',()=>{progress=Number($('position').value)/1000;render();});
 $('auto').addEventListener('click',()=>{playing=!playing;$('auto').textContent=playing?'Stop scrolling':'Auto-scroll';$('auto').setAttribute('aria-pressed',String(playing));});
 $('join').addEventListener('click',()=>{join=join%6+1;const level=G.buildLevel(stage),vertical=level.mode==='climb',travel=vertical?level.height-540:level.width-960;progress=Math.max(0,Math.min(1,(join*travel/6-(vertical?270:480))/travel));render();});
 function frame(now){const dt=last?Math.min(.05,(now-last)/1000):0;last=now;if(playing&&loaded&&!document.hidden){progress+=dt/65;if(progress>1)progress=0;render();}requestAnimationFrame(frame);}
 select();requestAnimationFrame(frame);
})();
