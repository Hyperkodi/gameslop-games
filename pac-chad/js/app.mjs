import {createRun,step,CAST,THEMES,LEVEL_COUNT,VERSION} from './model.mjs';
import {POWERUPS,SPECIAL_TICKS} from './powerups.mjs';
import {Recorder} from './replay.mjs';
import {Renderer} from './renderer.mjs';
import {Audio} from './audio.mjs';
import {Music} from './music.mjs';
import {MUSIC_BANK} from './music-bank.mjs';
import {Platform} from './platform.mjs';
import {createDisplay} from './display.mjs';
const $=id=>document.getElementById(id),number=n=>n.toLocaleString('en-US');
const audio=new Audio(),music=new Music(audio),platform=new Platform();
let windowActive=true;
for(const [i,track] of MUSIC_BANK.entries()){
  const item=document.createElement('li'),link=document.createElement('a');
  link.href=track.source;link.target='_blank';link.rel='noopener';link.textContent=track.title;
  item.append(document.createTextNode(THEMES[i].name+' \u2014 '),link);$('music-tracks').append(item);
}
const storageKey='pac-chad:personal:campaign:v3';
let scores=[];try{const saved=JSON.parse(localStorage.getItem(storageKey)||'[]');if(Array.isArray(saved))scores=saved.filter(x=>x&&Number.isSafeInteger(x.score)&&x.score>=0&&['dash','decoy'].includes(x.ability)&&typeof x.date==='string').slice(0,5);}catch{}
function board(){const list=$('personal-board');list.replaceChildren();if(!scores.length){const li=document.createElement('li');li.textContent='YOUR FIRST RUN GOES HERE.';list.append(li);}scores.forEach((r,i)=>{const li=document.createElement('li');const label=document.createElement('span');label.textContent=`0${i+1} / ${r.ability.toUpperCase()}`;const value=document.createElement('b');value.textContent=number(r.score);li.append(label,value);list.append(li);});$('best').textContent=number(scores[0]?.score||0).padStart(6,'0');}
board();
for(const [i,spec] of POWERUPS.entries()){
  const card=document.createElement('article');card.style.setProperty('--power-color',spec.color);
  const img=document.createElement('img');img.src='assets/power-'+spec.id+'.svg';img.alt=spec.object;
  const copy=document.createElement('div'),level=document.createElement('small'),name=document.createElement('h3'),effect=document.createElement('p');
  level.textContent='LEVEL '+String(i+1).padStart(2,'0')+' / 5 SECONDS';name.textContent=spec.name;effect.textContent=spec.effect;
  copy.append(level,name,effect);card.append(img,copy);$('powerup-guide').append(card);
}
const images={};
try{await Promise.all(['chad','chad-chomp',...CAST.map(c=>c.id),...POWERUPS.map(p=>'power-'+p.id)].map(id=>new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>{images[id]=img;resolve();};img.onerror=()=>reject(new Error('Could not load '+id));img.src=`assets/${id}.${id.startsWith('power-')?'svg':'png'}`;})));}catch(e){$('start').textContent='ART COULD NOT LOAD. RELOAD TO RETRY.';$('platform-note').textContent=e.message;throw e;}
const renderer=new Renderer($('game'),images);renderer.resize();new ResizeObserver(()=>renderer.resize()).observe($('viewport'));
let state=createRun(),recorder=new Recorder(),ability='dash',phase='title',desired=4,queuedAbility=false,paused=false,hostPaused=false,countdown=0,previous=performance.now(),accumulator=0,toastUntil=0,lastFinished=null,padAbility=false;
function toast(text,ms=1800){$('toast').textContent=text;$('toast').classList.add('visible');toastUntil=performance.now()+ms;}
function chooseAbility(value){ability=value;for(const b of document.querySelectorAll('[data-ability]')){const selected=b.dataset.ability===value;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));}$('touch-ability').querySelector('span').textContent=value.toUpperCase();$('touch-ability').querySelector('b').textContent=value==='dash'?'↯':'◈';$('touch-ability').setAttribute('aria-label','Use '+value);}
for(const b of document.querySelectorAll('[data-ability]'))b.addEventListener('click',()=>{chooseAbility(b.dataset.ability);audio.ui('select');});
function clearInput(){desired=4;queuedAbility=false;padAbility=false;for(const b of document.querySelectorAll('[data-dir]'))b.classList.remove('pressed');}
function pause(value=true,silent=false){if(phase!=='run')return;const wasPaused=paused;paused=value||hostPaused;if(paused){audio.stop();music.pause();}if(!silent&&wasPaused!==paused)audio.ui(paused?'pause':'resume');clearInput();$('pause-panel').hidden=!paused;$('pause').textContent=paused?'RESUME':'PAUSE';previous=performance.now();accumulator=0;if(!paused)$('game').focus({preventScroll:true});}
async function start(){
  if(!['title','results'].includes(phase))return;
  const oldPhase=phase;phase='starting';$('start').disabled=true;$('again').disabled=true;
  await audio.unlock();let run;
  try{run=await platform.start();}catch{phase=oldPhase;$('start').disabled=false;$('again').disabled=false;toast('GAMESLOP COULD NOT START THIS RUN',4000);return;}
  state=createRun({seed:Number.isInteger(run?.seed)?run.seed:0x504143,ability});recorder=new Recorder();audio.reset();music.reset();
  clearInput();paused=false;hostPaused=false;lastFinished=null;renderer.particles=[];renderer.labels=[];
  for(const id of ['start-panel','results-panel','pause-panel'])$(id).hidden=true;
  document.body.classList.add('playing');$('cabinet').scrollIntoView({behavior:'instant',block:'start'});$('game').focus({preventScroll:true});
  phase='countdown';countdown=180;accumulator=0;previous=performance.now();$('countdown').hidden=false;$('pause').disabled=true;$('start').disabled=false;$('again').disabled=false;updateHUD();display.sync();
}
function title(){music.reset();audio.reset();audio.ui('select');phase='title';paused=false;hostPaused=false;clearInput();state=createRun({ability});$('pause-panel').hidden=true;$('results-panel').hidden=true;$('countdown').hidden=true;$('start-panel').hidden=false;$('pause').disabled=true;$('pause').textContent='PAUSE';$('power-status').hidden=true;document.body.classList.remove('playing');$('start').focus({preventScroll:true});updateHUD();display.sync();}
async function finish(){
  if(phase==='results')return;
  phase='results';music.sync(null,false);$('pause').disabled=true;$('results-panel').hidden=false;$('power-status').hidden=true;
  lastFinished={configuration:{version:VERSION,seed:state.seed,ability:state.ability,score:state.score},evidence:recorder.export()};
  const isBest=state.score>(scores[0]?.score||0);
  audio.event({type:isBest?'best':'end'});
  $('result-reason').textContent=state.reason==='campaign_complete'?'TEN LEVELS. ALL CHAD.':'OUT OF LIVES. STILL CHAD.';
  $('result-title').textContent=state.reason==='campaign_complete'?'CAMPAIGN COMPLETE.':isBest?'NEW PERSONAL BEST.':'CHAD ENERGY.';
  $('save-replay').disabled=!lastFinished.evidence;
  $('save-replay').textContent=lastFinished.evidence?'SAVE RUN REPLAY ↓':'REPLAY LIMIT REACHED';
  $('final-score').textContent=number(state.score);$('result-pellets').textContent=state.pelletsEaten;$('result-ghosts').textContent=state.ghostsEaten;$('result-mazes').textContent=state.clearedStages;
  scores.push({score:state.score,ability:state.ability,date:new Date().toISOString()});scores.sort((a,b)=>b.score-a.score);scores=scores.slice(0,5);
  let stored=true;try{localStorage.setItem(storageKey,JSON.stringify(scores));}catch{stored=false;}
  board();$('result-status').textContent=platform.sdk?'Sending your run to Gameslop…':stored?'Saved to this device.':'This browser could not save your run.';
  const message=await platform.finish(state);if(phase==='results')$('result-status').textContent=!stored&&!platform.sdk?'Session best only. Browser storage is unavailable.':message;
  $('again').focus({preventScroll:true});
}
function updateHUD(){
  const special=POWERUPS[state.stage],active=!!state.special;
  const icon='assets/power-'+special.id+'.svg';if($('special-icon').getAttribute('src')!==icon){$('special-icon').src=icon;$('special-icon').alt=special.object;}
  $('special-status').style.setProperty('--special-color',special.color);$('special-status').classList.toggle('active',active);
  $('special-name').textContent=special.name;$('special-description').textContent=special.effect;
  $('special-state').textContent=active?(state.special.id==='pre-workout'?state.special.charges+' BLOCKS LEFT':'SPECIAL ACTIVE'):state.maze.pickup.collected?'USED THIS LEVEL':'LEVEL SPECIAL \u00b7 FIND THE STAR';
  $('special-time').textContent=active?(state.special.ticks/60).toFixed(1)+'s':state.maze.pickup.collected?'USED':'5s';
  $('special-meter').style.width=active?(state.special.ticks/SPECIAL_TICKS*100)+'%':'0%';
  $('score').textContent=number(state.score).padStart(6,'0');$('combo').textContent=state.multiplier+'×';$('combo-label').textContent=state.combo?state.combo+' IN A ROW':'KEEP EATING';
  $('combo-meter').style.width=Math.max(0,100*(1-(state.tick-state.lastPellet)/150))+'%';
  const secs=Math.floor(state.tick/60);$('time').textContent=String(Math.floor(secs/60)).padStart(2,'0')+':'+String(secs%60).padStart(2,'0');
  $('lives').textContent=Array.from({length:3},(_,i)=>i<state.lives?'♥':'♡').join(' ');$('lives').setAttribute('aria-label',state.lives+' lives');
  $('stage-number').textContent=String(state.stage+1).padStart(2,'0')+'/'+LEVEL_COUNT;$('stage-name').textContent=THEMES[state.stage].name;
  $('ability-status').textContent=ability.toUpperCase()+(state.energy===600?' READY':' '+Math.ceil((600-state.energy)/60)+'s');
  $('touch-ability').querySelector('i').style.height=100-state.energy/6+'%';$('touch-ability').querySelector('span').textContent=state.energy===600?ability.toUpperCase():Math.ceil((600-state.energy)/60)+'s';
  $('power-status').hidden=!state.power||phase!=='run';if(state.power)$('power-status').querySelector('b').textContent=(state.power/60).toFixed(1);
  $('status').textContent=state.reason==='campaign_complete'?'ALL TEN LEVELS CLEARED':state.power?'CHAD MODE. FLIP THE CHASE.':state.dash?'DASH ACTIVE':state.decoy?'DECOY ON THE MOVE':state.maze.remaining+' PELLETS TO THE NEXT MAZE';
}
const keyDirections={ArrowUp:0,KeyW:0,ArrowRight:1,KeyD:1,ArrowDown:2,KeyS:2,ArrowLeft:3,KeyA:3};
window.addEventListener('keydown',e=>{
  if(['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)||e.metaKey||e.ctrlKey||e.altKey)return;
  if(e.code==='Escape'&&$('cabinet').classList.contains('full-window')){display.exit();return;}
  if(phase!=='run'&&phase!=='countdown')return;
  if(e.code in keyDirections){e.preventDefault();if(!paused)desired=keyDirections[e.code];}
  if(e.code==='Space'){e.preventDefault();if(!e.repeat&&!paused)queuedAbility=true;}
  if((e.code==='KeyP'||e.code==='Escape')&&!e.repeat){e.preventDefault();pause(!paused);}
});
for(const b of document.querySelectorAll('[data-dir]')){
  b.addEventListener('pointerdown',e=>{e.preventDefault();if(!paused)desired=Number(b.dataset.dir);b.classList.add('pressed');b.setPointerCapture(e.pointerId);audio.unlock();});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(type,()=>b.classList.remove('pressed'));
}
$('touch-ability').addEventListener('pointerdown',e=>{e.preventDefault();if(!paused)queuedAbility=true;audio.unlock();});
let swipe=null;
$('game').addEventListener('pointerdown',e=>{e.preventDefault();swipe={id:e.pointerId,x:e.clientX,y:e.clientY};$('game').setPointerCapture(e.pointerId);audio.unlock();});
$('game').addEventListener('pointermove',e=>{if(!swipe||swipe.id!==e.pointerId||paused)return;const dx=e.clientX-swipe.x,dy=e.clientY-swipe.y;if(Math.hypot(dx,dy)<14)return;desired=Math.abs(dx)>Math.abs(dy)?dx>0?1:3:dy>0?2:0;swipe.x=e.clientX;swipe.y=e.clientY;});
for(const type of ['pointerup','pointercancel','lostpointercapture'])$('game').addEventListener(type,()=>{swipe=null;});
function gamepad(){const pad=navigator.getGamepads?.()[0];if(!pad){padAbility=false;return;}if(paused)return;const x=pad.axes[0]||0,y=pad.axes[1]||0;if(Math.max(Math.abs(x),Math.abs(y))>.35)desired=Math.abs(x)>Math.abs(y)?x>0?1:3:y>0?2:0;for(const [button,dir]of [[12,0],[15,1],[13,2],[14,3]])if(pad.buttons[button]?.pressed)desired=dir;const pressed=!!pad.buttons[0]?.pressed;if(pressed&&!padAbility)queuedAbility=true;padAbility=pressed;}
document.addEventListener('visibilitychange',()=>{if(document.hidden){music.pause();audio.stop();pause(true,true);previous=performance.now();accumulator=0;}});
window.addEventListener('blur',()=>{windowActive=false;music.pause();audio.stop();pause(true,true);});
window.addEventListener('focus',()=>{windowActive=true;});
$('start').addEventListener('click',start);$('again').addEventListener('click',start);$('pause').addEventListener('click',()=>pause(!paused));$('resume').addEventListener('click',()=>pause(false));$('quit').addEventListener('click',title);
$('sound').addEventListener('click',()=>{audio.muted=!audio.muted;audio.unlock();$('sound').textContent=audio.muted?'SOUND OFF':'SOUND ON';$('sound').setAttribute('aria-pressed',String(audio.muted));});
const display=createDisplay({cabinet:$('cabinet'),button:$('fullscreen'),resize:()=>renderer.resize(),isPlaying:()=>['countdown','run','results'].includes(phase)});
$('save-replay').addEventListener('click',()=>{if(!lastFinished)return;const url=URL.createObjectURL(new Blob([JSON.stringify(lastFinished)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='pac-chad-run.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
function frame(now){
  const dt=Math.min(250,now-previous);previous=now;
  if(!document.hidden&&!paused&&!hostPaused&&(phase==='run'||phase==='countdown')){
    accumulator+=dt;gamepad();let steps=0;
    while(accumulator>=1000/60&&steps++<15){
      accumulator-=1000/60;
      if(phase==='countdown'){if(countdown===180||countdown===120)audio.event({type:'countdown'});if(countdown===60)audio.event({type:'start'});$('countdown').textContent=countdown>60?Math.ceil(countdown/60):'GO!';if(--countdown<=0){phase='run';$('countdown').hidden=true;$('pause').disabled=false;}continue;}
      if(phase!=='run')break;
      const energyBefore=state.energy,powerBefore=state.power;
      const input=desired|(queuedAbility?8:0);queuedAbility=false;recorder.add(input);step(state,input);renderer.events(state);
      if(!state.done){if(energyBefore<600&&state.energy===600)audio.event({type:'ready'});if(powerBefore>0&&state.power===0)audio.event({type:'power-end'});}
      for(const e of state.events){if(e.type!=='end')audio.event(e,state.ability);if(['ghost','hit','stage','special'].includes(e.type))music.duck(e.type==='ghost'?2.7:1.1);if(e.text)toast(e.text);}
      if(state.done){finish();break;}
    }
    updateHUD();if(platform.sdk&&phase==='run'&&state.tick%60===0)platform.sdk.tick(state.score);
  }
  music.sync(['countdown','run'].includes(phase)?state.stage:null,phase==='run'&&!paused&&!hostPaused&&!document.hidden&&windowActive&&state.transition===0);
  if(now>toastUntil)$('toast').classList.remove('visible');
  renderer.draw(state,paused?state.tick*1000/60:now);requestAnimationFrame(frame);
}
$('start').disabled=false;$('start').textContent='ENTER THE MAZE →';updateHUD();requestAnimationFrame(frame);
platform.connect().then(connected=>{
  $('platform-note').textContent=platform.status;
  if(connected){$('online-board-note').textContent='Gameslop records your run through your signed-in account. See its game page for ranking status.';platform.sdk.onPause(()=>{hostPaused=true;pause(true,true);});platform.sdk.onResume(()=>{hostPaused=false;pause(false,true);});platform.sdk.onRestart(title);}
});
