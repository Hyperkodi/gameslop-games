import {createRun,setAngle,launch,step,DT,OBJECTS} from './model.mjs';
import {Renderer,drawObject} from './renderer.mjs';
import {Sound} from './audio.mjs';
import {createDisplay} from './display.mjs';
import {EXCHANGES,loadExchangeLogos} from './exchanges.mjs';
const logosReady=loadExchangeLogos();
const $=id=>document.getElementById(id),sound=new Sound(),cat=new Image();
let state=createRun(),renderer,active=false,paused=false,raf=0,last=0,accumulator=0,calloutUntil=0;
let scores=[];try{scores=JSON.parse(localStorage.getItem('cash-cannon-scores')||'[]').filter(v=>Number.isFinite(v.score)&&v.score>=0).slice(0,5);sound.muted=localStorage.getItem('cash-cannon-muted')==='true';}catch{}
const metres=n=>(n/10).toFixed(1);
function board(){
  $('score-board').replaceChildren();
  if(!scores.length){const li=document.createElement('li');li.textContent='NO SENDS YET. MAKE THE FIRST ONE.';$('score-board').append(li);}
  scores.forEach((s,i)=>{const li=document.createElement('li'),rank=document.createElement('span'),value=document.createElement('strong'),detail=document.createElement('small');rank.textContent=String(i+1).padStart(2,'0');value.textContent=metres(s.score)+' m';detail.textContent=s.boosts+' BOOSTS';li.append(rank,value,detail);$('score-board').append(li);});
  $('best').textContent=metres(scores[0]?.score||0)+' m';
}
function hud(){
  $('distance').textContent=metres(state.score)+' m';$('boosts').textContent=state.boosts+'×';
  $('altitude').hidden=!(renderer?.cameraY>50);
  $('altitude').textContent='↑ '+Math.round(state.y/10)+'m ALTITUDE';
  $('angle-value').textContent=state.angle+'°';$('angle').value=state.angle;
  const power=Math.round(state.power*100);$('power-value').textContent=power+'%';$('power-fill').style.width=power+'%';document.querySelector('.power-meter').setAttribute('aria-valuenow',power);
  const aiming=active&&!paused&&state.phase==='aim';for(const id of ['angle','angle-down','angle-up','fire'])$(id).disabled=!aiming;
  $('fire').textContent=state.phase==='aim'?'FIRE CASHCAT ↗':state.phase==='done'?'RUN COMPLETE':'IN FLIGHT ↗';
  $('pause').disabled=!active||state.phase==='done';$('pause').textContent=paused?'RESUME':'PAUSE';
  $('launch-hint').textContent=state.phase==='aim'?'CATCH THE PEAK.':'THE MARKET TAKES IT FROM HERE.';
}
function render(){if(renderer){renderer.draw(state);hud();}}
function resize(){if(renderer){renderer.resize();render();}}
const display=createDisplay({cabinet:$('cabinet'),button:$('fullscreen'),resize,isPlaying:()=>active});
function schedule(){if(!raf&&active&&!paused&&!document.hidden){last=performance.now();raf=requestAnimationFrame(frame);}}
function events(){
  for(const e of state.events){sound.event(e);if(e.type!=='result')renderer.events([e]);if(e.label){$('callout').textContent=e.label;$('callout').classList.add('visible');$('callout').style.color=OBJECTS[e.type].color;calloutUntil=state.tick+150;}if(e.type==='result')finish();}
}
function frame(now){
  raf=0;if(!active||paused||document.hidden)return;
  const elapsed=Math.min(.1,(now-last)/1000);last=now;accumulator+=elapsed;
  while(accumulator>=DT&&state.phase!=='done'){step(state);events();accumulator-=DT;}
  renderer.draw(state,elapsed);hud();if(state.tick>calloutUntil){$('callout').textContent='';$('callout').classList.remove('visible');}
  if(state.phase!=='done')raf=requestAnimationFrame(frame);
}
function start(){
  sound.unlock();sound.stop();state=createRun(crypto.getRandomValues(new Uint32Array(1))[0]);setAngle(state,Number($('angle').value));active=true;paused=false;accumulator=0;renderer.reset();
  for(const id of ['intro-panel','pause-panel','results-panel'])$(id).hidden=true;
  $('callout').textContent='';$('status').textContent='SET YOUR ANGLE. TIME YOUR SHOT.';display.sync();hud();schedule();$('game').focus({preventScroll:true});
}
function fire(){if(!active||paused||!launch(state))return;sound.unlock();events();$('status').textContent='CASHCAT HAS ENTERED THE MARKET.';hud();}
function pause(value=true){if(!active||state.phase==='done')return;paused=value;cancelAnimationFrame(raf);raf=0;sound.stop();$('pause-panel').hidden=!paused;hud();if(!paused){sound.unlock();schedule();}}
function finish(){
  scores.push({score:state.score,boosts:state.boosts});scores.sort((a,b)=>b.score-a.score);scores=scores.slice(0,5);try{localStorage.setItem('cash-cannon-scores',JSON.stringify(scores));}catch{}
  board();$('result-reason').textContent=({'honey':'CAUGHT IN A HONEY POT.','rug':'YOU GOT RUGGED.','out-of-gas':'OUT OF GAS.','market-closed':'MARKET CLOSED.'})[state.reason];
  $('result-title').textContent=state.score>=scores[0].score?'YOUR BIGGEST SEND.':'WHAT A SEND.';$('final-distance').textContent=metres(state.score)+' m';$('result-boosts').textContent=state.boosts;$('result-height').textContent=metres(state.peak)+' m';$('result-note').textContent='Personal score saved on this device.';$('results-panel').hidden=false;$('status').textContent='THE NEXT SEND COULD BE THE ONE.';
}
function aim(value){setAngle(state,value);hud();if(!active)render();}
$('start').onclick=start;$('again').onclick=start;$('fire').onclick=fire;$('resume').onclick=()=>pause(false);$('pause').onclick=()=>pause(!paused);
$('quit').onclick=()=>{cancelAnimationFrame(raf);raf=0;active=false;paused=false;state=createRun();renderer.reset();sound.stop();$('pause-panel').hidden=true;$('intro-panel').hidden=false;display.sync();render();};
$('angle').oninput=e=>aim(Number(e.target.value));$('angle-down').onclick=()=>aim(state.angle-2);$('angle-up').onclick=()=>aim(state.angle+2);
function soundLabel(){$('sound').textContent=sound.muted?'SOUND OFF':'SOUND ON';$('sound').setAttribute('aria-pressed',String(sound.muted));}
$('sound').onclick=()=>{sound.muted=!sound.muted;sound.unlock();if(sound.muted)sound.stop();soundLabel();try{localStorage.setItem('cash-cannon-muted',sound.muted);}catch{}};
document.addEventListener('keydown',e=>{
  if(!active||e.target.closest('input')||e.target.closest('button,a')&&['Enter','Space'].includes(e.code))return;
  if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyP'].includes(e.code))e.preventDefault();
  if(e.code==='KeyP'&&!e.repeat)pause(!paused);
  if(paused)return;if(e.code==='Space'&&!e.repeat)fire();
  if(state.phase==='aim'){if(['ArrowUp','ArrowRight'].includes(e.code))aim(state.angle+1);if(['ArrowDown','ArrowLeft'].includes(e.code))aim(state.angle-1);}
});
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});window.addEventListener('blur',()=>pause());
$('save-replay').onclick=()=>{const blob=new Blob([JSON.stringify({launch:state.launch,score:state.score,unit:'decimetres',reason:state.reason},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='cash-cannon-launch.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
function buildGuide(logos){
 for(const [kind,info] of Object.entries(OBJECTS)){
  const card=document.createElement('article'),canvas=document.createElement('canvas'),title=document.createElement('h3'),p=document.createElement('p');card.className='hazard-card';canvas.width=260;canvas.height=230;canvas.setAttribute('aria-hidden','true');const c=canvas.getContext('2d');c.translate(130,kind==='cex'?80:181);drawObject(c,{kind,used:false},0,logos);title.textContent=info.name;title.style.color=info.color;p.textContent=info.description;card.append(canvas,title,p);$('hazards').append(card);
 }
 EXCHANGES.forEach((brand,exchange)=>{const card=document.createElement('article'),canvas=document.createElement('canvas'),title=document.createElement('h3');card.className='exchange-card';canvas.width=180;canvas.height=235;canvas.setAttribute('aria-hidden','true');const c=canvas.getContext('2d');c.translate(90,80);drawObject(c,{kind:'cex',exchange,used:false,phase:0},0,logos);title.textContent=brand.name;card.append(canvas,title);$('exchanges').append(card);});
}
cat.onload=async()=>{const logos=await logosReady;renderer=new Renderer($('game'),cat,logos);buildGuide(logos);$('start').disabled=false;$('start').textContent='LET’S SEND IT ↗';render();};
cat.onerror=()=>{$('start').textContent='ART COULD NOT LOAD — RELOAD TO RETRY';$('status').textContent='CashCat’s image could not load.';};cat.src=new URL('../assets/cashcat.png',import.meta.url).href;board();soundLabel();
