'use strict';
(() => {
 const stage=document.getElementById('title-stage'),hand=stage.querySelector('.stamp-hand');
 let timer,impactTimer,context;
 function impact(){
  const t=context.currentTime,osc=context.createOscillator(),gain=context.createGain();
  osc.type='triangle';osc.frequency.setValueAtTime(120,t);osc.frequency.exponentialRampToValueAtTime(38,t+.14);
  gain.gain.setValueAtTime(.18,t);gain.gain.exponentialRampToValueAtTime(.001,t+.19);osc.connect(gain);gain.connect(context.destination);osc.start(t);osc.stop(t+.2);
 }
 function replay(withSound=false){
  clearTimeout(timer);clearTimeout(impactTimer);stage.classList.remove('stamping','stamped');
  if(matchMedia('(prefers-reduced-motion: reduce)').matches){stage.classList.add('stamped');return;}
  void stage.offsetWidth;stage.classList.add('stamping');
  if(withSound){try{context??=new (window.AudioContext||window.webkitAudioContext)();context.resume().catch(()=>{});impactTimer=setTimeout(impact,1170);}catch{}}
  timer=setTimeout(()=>{stage.classList.add('stamped');stage.classList.remove('stamping');},2600);
 }
 document.getElementById('replay-stamp').addEventListener('click',()=>replay(true));
 window.SlopperTitle={replay};hand.decode().then(()=>replay()).catch(()=>stage.classList.add('stamped'));
})();
