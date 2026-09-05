(function () {
  'use strict';
  const G = window.SlopCommando, $ = id => document.getElementById(id);
  Object.entries(window.SlopCommandoSkin.palette).forEach(([name,value])=>document.documentElement.style.setProperty('--'+name,value));
  const params = new URLSearchParams(location.search);
  const engine = G.createEngine({ seed: GameSlopKit.parseSeed(params.get('seed')) });
  const renderer = G.createRenderer({ canvas: $('game') });
  const p2Power=document.createElement('small');$('p2-hud').append(p2Power);
  // The guide mirrors the actual loot table. Stronger weapons are rare in play,
  // but every silhouette is visible here before the player finds one.
  const guideWeapons = [
    ['S','Spread gun'],['M','Machine gun'],['G','Grenade launcher'],
    ['L','Laser rifle'],['H','Homing rocket'],['F','Flamethrower'],
    ['W','Wave cannon'],['T','Tesla carbine'],['I','Cryo blaster'],['A','Plasma cannon'],['B','Barrier'],['R','Rapid fire'],['C','Invisibility cloak'],['N','Screen nuke']
  ];
  const weaponList = document.querySelector('.weapon-list');
  if (weaponList) weaponList.replaceChildren(...guideWeapons.map(([type,label]) => {
    const row=document.createElement('span'), icon=document.createElement('canvas');
    icon.width=112;icon.height=64;icon.dataset.pickupIcon=type;icon.setAttribute('aria-hidden','true');
    row.append(icon,document.createTextNode(label));return row;
  }));
  document.querySelectorAll('[data-pickup-icon]').forEach(canvas=>{
    const c=canvas.getContext('2d');c.translate(7,31);c.scale(1.35,1.35);
    G.createWeaponArt(c,window.SlopCommandoSkin.weapons).draw(canvas.dataset.pickupIcon);
  });
  const audio = G.createAudio();
  let players = 1, lastStatus = '', last = 0, accumulator = 0, best = 0, lastGamepadStart = false, posted = false, showingDossier = false;
  const cabinet = document.querySelector('.cabinet');
  // Controls must be descendants of the fullscreen element on mobile.
  cabinet.append(document.querySelector('.touch-controls'));
  const sources = { keyboard: new Set(), touch: new Map(), pad: new Set() };
  const keymap = { ArrowLeft:[0,'left'],ArrowRight:[0,'right'],ArrowUp:[0,'up'],ArrowDown:[0,'down'],KeyZ:[0,'jump'],Space:[0,'jump'],KeyX:[0,'fire'],KeyC:[0,'fire'],KeyV:[0,'swap'],KeyJ:[1,'swap'],KeyA:[1,'left'],KeyD:[1,'right'],KeyW:[1,'up'],KeyS:[1,'down'],KeyG:[1,'jump'],KeyH:[1,'fire'] };
  const storage = { get(k,f) { try { return localStorage.getItem(k) ?? f; } catch (_) { return f; } }, set(k,v) { try { localStorage.setItem(k,String(v)); } catch (_) { /* Offline/private browsing remains playable. */ } } };
  const touch=G.createTouchControls({element:document.querySelector('.touch-controls'),cabinet,getState:()=>engine.state,storage,unlock:()=>audio.unlock(),
    onChange(id,actions){if(actions)sources.touch.set(id,actions);else sources.touch.delete(id);syncInputs();}});
  cabinet.addEventListener('pointerdown',event=>touch.notePointer(event),true);
  function bestKey() { return 'gameslop:commando:gameslop:'+engine.state.difficulty+':'+engine.state.players.length+':best'; }
  function clearInput() { sources.keyboard.clear();sources.touch.clear();sources.pad.clear();touch.reset();engine.release();document.querySelectorAll('.pressed').forEach(el=>el.classList.remove('pressed')); }
  function syncInputs() {
    const held = new Set([...[...sources.keyboard].map(code=>keymap[code].join(':')),...[...sources.touch.values()].flat(),...sources.pad]);
    if(touch.shouldAutoFire())held.add('0:fire');
    engine.state.players.forEach((p,i) => ['left','right','up','down','jump','fire','swap','drop'].forEach(action=>engine.input(i,action,held.has(i+':'+action))));
  }
  function start() {
    clearInput();audio.unlock();engine.start({ players, difficulty: $('difficulty').value });
    best=Number(storage.get(bestKey(),0))||0;posted=false;$('game').focus({preventScroll:true});updateUI();
  }
  function setTitle() {
    clearInput(); engine.state.status='ready'; engine.state.level=G.buildLevel(0);engine.state.stage=0;engine.state.camera={x:0,y:0};engine.state.boss=null;
    engine.state.enemies=[];engine.state.bullets=[];engine.state.pickups=[];engine.state.effects=[];
    updateUI();$('start').focus({preventScroll:true});
  }
  function togglePause() { audio.unlock(); if (engine.state.status==='playing'||engine.state.status==='paused') { clearInput();engine.pause();updateUI(); } }
  function toggleMute() { audio.toggle();$('sound').textContent=audio.muted?'SOUND OFF':'SOUND ON';$('sound').setAttribute('aria-pressed',String(audio.muted)); }
  function overlayAction() {
    const s=engine.state;audio.unlock();clearInput();
    if(s.status==='paused')engine.pause();
    else if(s.status==='clear')engine.advance();
    else if(s.status==='gameover'&&s.continues>0)engine.continueRun();
    else start();
    updateUI();$('game').focus({preventScroll:true});
  }
  function updateUI() {
    audio.update(engine.state, engine.drainEvents());
    const s=engine.state,active=s.status==='playing',title=s.status==='ready',isOverlay=['paused','clear','gameover','victory'].includes(s.status);
    $('title-screen').hidden=!title;$('hud').hidden=title;$('overlay').hidden=!isOverlay;
    $('mission').textContent=String(s.stage+1).padStart(2,'0');$('mission-name').textContent=s.level.name.toUpperCase();
    $('stage-progress').innerHTML='CAMPAIGN <b>'+String(s.stage+1).padStart(2,'0')+' / 08</b>';
    $('score').textContent=String(s.score).padStart(6,'0');
    const p=s.players[0];$('p1-lives').textContent=p.lives>5?'♥ × '+p.lives:'♥ '.repeat(Math.max(0,p.lives))||'OUT';
    $('p1-weapon').textContent=G.weapons[p.weapon].name+' '+G.weaponTier(p)+'/5';
    $('p1-power').textContent=[p.cloak>0?'CLOAK '+Math.ceil(p.cloak)+'s':'',p.shield>0?'BARRIER '+Math.ceil(p.shield)+'s':'',p.rapid>0?'RAPID '+Math.ceil(p.rapid)+'s':'',p.holstered?'HOLSTER: '+G.weapons[p.holstered].name+' '+(p.weaponLevels[p.holstered]||1)+'/5':''].filter(Boolean).join(' · ');
    const swapButton=document.querySelector('[data-action="swap"]');swapButton.disabled=s.difficulty==='hard'||!p.holstered;swapButton.textContent=s.difficulty==='hard'?'1 GUN':'SWAP';
    document.querySelector('[data-action="drop"]').disabled=s.level.mode==='base';
    if(s.players.length===2){const q=s.players[1];$('p2-label').textContent='2P  ♥ × '+q.lives;$('p2-value').textContent=q.lives?G.weapons[q.weapon].name+' '+G.weaponTier(q)+'/5':'OUT';p2Power.textContent=[q.cloak>0?'CLOAK '+Math.ceil(q.cloak)+'s':'',q.holstered?'HOLSTER: '+G.weapons[q.holstered].name+' '+(q.weaponLevels[q.holstered]||1)+'/5':''].filter(Boolean).join(' · ');}
    else{p2Power.textContent='';$('p2-label').textContent='HI-SCORE';$('p2-value').textContent=String(Math.max(best,s.score)).padStart(6,'0');}
    $('pause').disabled=title||!['playing','paused'].includes(s.status);
    const pauseLabel=s.status==='paused'?'▶ <span>RESUME</span>':'Ⅱ <span>PAUSE</span>';
    if($('pause').innerHTML!==pauseLabel)$('pause').innerHTML=pauseLabel;
    $('pause').setAttribute('aria-label',s.status==='paused'?'Resume game':'Pause game');
    const progress=s.level.mode==='base'?'CHAMBER '+(s.room+1)+'/3':s.level.mode==='climb'?'CLIMB TO THE SUMMIT':s.level.tag;
    $('status-line').textContent=title?'READY WHEN YOU ARE.':active?(s.boss?'BOSS CONTACT · '+s.boss.name.toUpperCase():progress):s.status.toUpperCase();
    if(lastStatus!==s.status){
      if(isOverlay){
        const data={paused:['TAKE A BREATHER','PAUSED','The mission can wait.\nYour progress is right here.','BACK TO THE ACTION →'],clear:['SECTOR SECURED',s.stage===7?'SOURCE DESTROYED':'STAGE CLEAR',s.level.name+' complete.\n'+s.score.toLocaleString()+' points · '+s.kills+' targets down',s.stage===7?'FINISH THE MISSION →':'NEXT MISSION →'],gameover:['YOU MADE A MESS','GAME OVER',s.score.toLocaleString()+' points · Stage '+(s.stage+1)+' / 8\n'+s.continues+' continues remaining',s.continues?'CONTINUE MISSION →':'TRY AGAIN →'],victory:['OPERATION COMPLETE','SLOP TRIUMPHS','All eight sectors liberated.\n'+s.score.toLocaleString()+' points · '+Math.floor(s.elapsed/60)+'m '+Math.floor(s.elapsed%60)+'s\n'+s.difficulty.toUpperCase()+' · '+s.creditsUsed+' continues used','RUN IT BACK →']}[s.status];
        $('overlay-kicker').textContent=data[0];$('overlay-title').textContent=data[1];$('overlay-body').textContent=data[2];$('overlay-action').textContent=data[3];$('overlay-action').focus({preventScroll:true});
      }
      if(['clear','gameover','victory'].includes(s.status)&&s.score>best){best=s.score;storage.set(bestKey(),best);}
      if((s.status==='gameover'||s.status==='victory')&&!posted){
        // Match the arcade's existing optional embedding bridge. No input or private data.
        if(window.parent!==window)window.parent.postMessage({v:1,type:'gameover',game:'commando',skin:'gameslop',score:s.score,seed:s.seed,inputsHash:engine.hash(),stats:{stage:s.stage+1,players:s.players.length,difficulty:s.difficulty,victory:s.status==='victory'}},'*');
        posted=true;
      }
      if(active)posted=false;lastStatus=s.status;
    }
  }
  function gamepads() {
    sources.pad.clear();let startDown=false;
    const pads=navigator.getGamepads?Array.from(navigator.getGamepads()).filter(Boolean).slice(0,2):[];
    pads.forEach((pad,i)=>{
      const button=n=>!!pad.buttons[n]?.pressed,actions={left:button(14)||pad.axes[0]<-.3,right:button(15)||pad.axes[0]>.3,up:button(12)||pad.axes[1]<-.3,down:button(13)||pad.axes[1]>.3,jump:button(0),fire:button(2)||button(7)||button(1),swap:button(3)};
      if(i===0&&(Object.values(actions).some(Boolean)||button(9)))touch.usePhysicalControls();
      Object.entries(actions).forEach(([a,down])=>{if(down)sources.pad.add(i+':'+a);});if(button(9))startDown=true;
    });
    if(startDown&&!lastGamepadStart){if(engine.state.status==='ready')start();else if(engine.state.status==='playing')togglePause();else overlayAction();}lastGamepadStart=startDown;
  }
  function frame(now) {
    const elapsed=Math.min(.1,(now-last)/1000||0);last=now;
    if(!showingDossier)gamepads();syncInputs();
    if(engine.state.status==='playing') {
      accumulator+=elapsed;while(accumulator>=G.STEP){engine.tick();accumulator-=G.STEP;}
    } else accumulator=0;
    updateUI();renderer.draw(engine.state,{time:now/1000,attract:engine.state.status==='ready'});requestAnimationFrame(frame);
  }
  document.querySelectorAll('[data-players]').forEach(btn=>btn.addEventListener('click',()=>{players=Number(btn.dataset.players);document.querySelectorAll('[data-players]').forEach(b=>{b.classList.toggle('selected',b===btn);b.setAttribute('aria-pressed',String(b===btn));});}));
  $('start').addEventListener('click',start);$('pause').addEventListener('click',togglePause);$('sound').addEventListener('click',toggleMute);$('overlay-action').addEventListener('click',overlayAction);$('restart').addEventListener('click',setTitle);
  function editable(target){return ['SELECT','INPUT','TEXTAREA'].includes(target.tagName);}
  document.addEventListener('keydown',e=>{
    if(showingDossier||editable(e.target)||e.ctrlKey||e.metaKey||e.altKey)return;
    if(e.code==='Space'&&e.target.tagName==='BUTTON')return;
    const mapped=keymap[e.code];if(mapped?.[0]===0||['Enter','Escape','KeyP'].includes(e.code))touch.usePhysicalControls();
    if(mapped){e.preventDefault();sources.keyboard.add(e.code);syncInputs();}
    if(e.repeat)return;
    if(e.code==='Escape'||e.code==='KeyP'){e.preventDefault();togglePause();}
    if(e.code==='KeyM')toggleMute();
    if(e.code==='Enter'&&e.target.tagName!=='BUTTON'){e.preventDefault();if(engine.state.status==='ready')start();else if(engine.state.status!=='playing')overlayAction();}
  });
  document.addEventListener('keyup',e=>{const mapped=keymap[e.code];if(mapped){e.preventDefault();sources.keyboard.delete(e.code);syncInputs();}});
  function backgroundPause(){clearInput();if(engine.state.status==='playing'){engine.pause();updateUI();}}
  window.addEventListener('blur',backgroundPause);document.addEventListener('visibilitychange',()=>{if(document.hidden)backgroundPause();});
  // Rotation/fullscreen can move controls away from the fingers holding them.
  window.addEventListener('resize',clearInput);
  screen.orientation?.addEventListener?.('change',clearInput);
  $('crt').checked=storage.get('gameslop:commando:crt','1')==='1';
  function setCRT(){document.querySelector('.scanlines').hidden=!$('crt').checked;storage.set('gameslop:commando:crt',$('crt').checked?'1':'0');}
  $('crt').addEventListener('change',setCRT);setCRT();
  $('sound').textContent=audio.muted?'SOUND OFF':'SOUND ON';$('sound').setAttribute('aria-pressed',String(audio.muted));
  function expanded(){return !!document.fullscreenElement||cabinet.classList.contains('expanded');}
  function fullscreenUI(){const on=expanded();$('fullscreen').innerHTML=on?'⛶ <span>EXIT</span>':'⛶ <span>EXPAND</span>';$('fullscreen').setAttribute('aria-label',on?'Exit fullscreen':'Toggle fullscreen');document.body.classList.toggle('is-expanded',on);}
  $('fullscreen').addEventListener('click',async()=>{
    if(document.fullscreenElement){await document.exitFullscreen();}
    else if(cabinet.classList.contains('expanded'))cabinet.classList.remove('expanded');
    else {
      try {if(!cabinet.requestFullscreen)throw new Error('fallback');await cabinet.requestFullscreen();}
      catch(_){cabinet.classList.add('expanded');}
      try{await screen.orientation?.lock?.('landscape');}catch(_){/* Browser/OS may require manual rotation. */}
    }
    if(!expanded()){try{screen.orientation?.unlock?.();}catch(_){/* Optional browser capability. */}}
    fullscreenUI();
  });
  document.addEventListener('fullscreenchange',()=>{fullscreenUI();if(!expanded()){try{screen.orientation?.unlock?.();}catch(_){/* Optional capability. */}}});
  $('mission-list').innerHTML=G.levels.map((l,i)=>'<li><strong>'+l.name+'</strong><span>'+l.briefing+'</span></li>').join('');
  let resumeAfterDossier=false;
  $('howto').addEventListener('click',()=>{resumeAfterDossier=engine.state.status==='playing';backgroundPause();showingDossier=true;$('dossier').showModal();});
  $('close-dossier').addEventListener('click',()=>$('dossier').close());
  $('dossier').addEventListener('close',()=>{showingDossier=false;if(resumeAfterDossier&&engine.state.status==='paused')engine.pause();updateUI();});
  if(params.get('debug')==='1')window.__gameslop={engine,renderer,audio,touch};
  document.body.dataset.ready='1';updateUI();requestAnimationFrame(frame);
})();
