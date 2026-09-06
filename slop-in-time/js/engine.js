(function(root){
  'use strict';
  const K=typeof module!=='undefined'?require('../../_kit/rng.js'):root.GameSlopKit;
  const Content=typeof module!=='undefined'?require('./content.js'):root.SlopTimeContent;
  const STEP=1/60,clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const stages=[
    {name:'Neon Afterhours',year:'199X',tag:'THE NIGHT THE CLOCK BROKE',theme:'city',boss:'Knuckle Volt',color:'#73e3dc',floor:'#25343a',enemy:'Punk',weapon:'pipe'},
    {name:'Dead Man’s Dock',year:'1712',tag:'ALL HANDS. ALL FISTS.',theme:'pirate',boss:'Captain Brassjaw',color:'#ffc77b',floor:'#584034',enemy:'Deckhand',weapon:'saber'},
    {name:'Primordial Punch',year:'65M BC',tag:'SURVIVAL OF THE SLOPPIEST',theme:'jungle',boss:'King Fossil',color:'#c8e884',floor:'#3a4230',enemy:'Raptor',weapon:'club'},
    {name:'Moonlit Shogunate',year:'1603',tag:'A BAD NIGHT TO BE A NINJA',theme:'temple',boss:'The Iron Ronin',color:'#d2b7ff',floor:'#393341',enemy:'Ninja',weapon:'staff'},
    {name:'Last Train to Trouble',year:'1888',tag:'THIS TOWN AIN’T BIG ENOUGH',theme:'west',boss:'Boiler Bill',color:'#ffba78',floor:'#614b38',enemy:'Outlaw',weapon:'wrench'},
    {name:'The Clockwork End',year:'3099',tag:'BREAK THE MACHINE. FIX TIME.',theme:'future',boss:'The Timekeeper',color:'#90f4e6',floor:'#253844',enemy:'Drone',weapon:'blade'}
  ];
  const routes=[
    ['Arcade Row','Rainwater Alley','Skyrail Station','Warehouse Nine','Canal Bridge','Blackout Yard','Volt Substation'],
    ['Saltwater Wharf','Smuggler Steps','Net Market','Broken Galleon','Cannon Quay','Fortress Pier','Brassjaw Anchorage'],
    ['Fern Canopy','Thundering Falls','Bone Valley','Emerald Pools','Basalt Crossing','Ashen Trail','Fossil Caldera'],
    ['Lantern Avenue','Shrine Gates','Bamboo Grove','Moonwater Bridge','Blossom Court','Castle Ramparts','Iron Courtyard'],
    ['Main Street','Dry Gulch','Water Tower','Rail Depot','Coal Yard','Steel Trestle','Boiler Roundhouse'],
    ['Assembly Line','Conduit Crossing','Gearworks','Reactor Gallery','Gravity Well','Clock Observatory','Timeline Core']
  ];
  const powers=[['GRID OVERLOAD','MOVE OUT OF THE ELECTRIC LANES'],['CANNON RAIN','GET CLEAR OF THE TARGET CIRCLES'],['EXTINCTION STOMP','JUMP OVER THE SHOCKWAVES'],['SHADOW CROSS','DODGE THE THREE SHADOW SLASHES'],['BOILER BURST','STAY BETWEEN THE STEAM VENTS'],['TIME RUPTURE','JUMP THROUGH THE EXPANDING RINGS']];
  stages.forEach((s,i)=>Object.assign(s,{width:[9000,9400,9800,9600,10000,10400][i],landmarks:routes[i],superName:powers[i][0],superHint:powers[i][1],encounters:[.0,.095,.215,.32,.435,.53,.635,.74,.855,1].map(f=>Math.round(480+f*([9000,9400,9800,9600,10000,10400][i]-1130)))}));
  Content.configure(stages);
  const BOSS_RAGE=.3;
  const difficulties={easy:{lives:5,damage:.65,health:.8},normal:{lives:3,damage:1,health:1},hard:{lives:2,damage:1.3,health:1.25}};
  function createEngine({seed=1991}={}){
    let rng=K.mulberry32(seed),nextId=0;
    const state={status:'ready',stage:0,players:[],enemies:[],props:[],pickups:[],effects:[],shots:[],hazards:[],events:[],inputLog:[],camera:0,tick:0,time:0,score:0,kills:0,combo:0,comboTime:0,bestCombo:0,shake:0,flash:0,hitstop:0,continues:2,gate:0,checkpoint:0,wave:0,arena:false,width:9000,transition:0,difficulty:'normal',seed};
    const emit=(type,data={})=>state.events.push({type,...data});
    const rules=()=>difficulties[state.difficulty];
    const stage=()=>stages[state.stage],center=()=>stage().encounters[Math.min(state.gate,stage().encounters.length-1)],lastGate=()=>state.gate===stage().encounters.length-1;
    const ground=x=>Content.floor(stage(),x),bounds=x=>Content.bounds(stage(),x);
    function routeMove(p,dx,dy){const x=p.x+dx;if(Content.walkable(stage(),x,p.y))p.x=x;const b=bounds(p.x);p.y=clamp(p.y+dy,b.min,b.max);}

    function player(id){return {id,x:130+id*70,y:416+id*36,z:0,vz:0,face:1,hp:100,maxHp:100,upgrades:[],lives:rules().lives,energy:40,stamina:100,exhausted:false,running:false,held:{},queued:{},cooldown:0,action:null,comboStep:0,comboUntil:0,invincible:2,hurt:0,dead:0,weapon:null,weaponHits:0,walk:0,moving:false};}
    function release(){for(const p of state.players){p.held={};p.queued={};p.running=false;p.moving=false;}}
    function stageLoad(index,startGate=0){
      state.stage=index;state.enemies=[];state.pickups=[];state.effects=[];state.shots=[];state.props=[];state.camera=0;state.gate=0;state.arena=false;state.transition=0;state.ending=null;state.waveDelay=0;state.shake=0;state.flash=0;state.hitstop=0;state.combo=0;state.comboTime=0;
      release();
      state.width=stage().width;state.hazards=[];state.checkpoint=startGate;state.gate=startGate;state.wave=0;
      state.cameraY=0;state.missiles=[];state.traps=[];state.story=null;state.storySeen=new Set();
      state.players.forEach((p,i)=>Object.assign(p,{x:130+i*65,y:416+i*35,z:0,vz:0,airKick:false,stamina:100,exhausted:false,running:false,moving:false,walk:0,hp:p.maxHp,invincible:2,dead:0,hurt:0,action:null,cooldown:0,weapon:null,weaponHits:0,energy:Math.max(40,p.energy),lives:Math.max(1,p.lives)}));
      const spawnX=startGate?center()-360:130;
      state.players.forEach((p,i)=>{p.x=spawnX+i*65;p.y=416+i*35+ground(p.x);});state.camera=Math.max(0,spawnX-130);state.cameraY=ground(spawnX);
      for(let i=0;i<Math.floor(state.width/370);i++){
        const x=350+i*370,group=Math.floor(i/3),kind=i%3===0?'food':i%3===1?'weapon':'energy';
        // Keep alternate supply placements, preserving every weapon and food variety.
        if(x<spawnX||kind!=='weapon'&&group%2!==0)continue;
        state.pickups.push({x,y:355+(i%3)*55+ground(x),kind,food:Object.keys(Content.foods)[Math.floor(group/2)%4],weapon:stage().weapons[group%2]});
      }
      // Three widely spaced sites. All sit in the upper lane on flat ground.
      const controls={steam:'hydrant',puddle:'cutoff',cannon:'powder',cargo:'capstan',geyser:'slab',gate:'winch',cart:'brake',boiler:'valve',press:'console',arc:'battery'};
      for(const [i,gate] of [2,5,8].entries()){const x=stage().encounters[gate]-120;if(x<spawnX)continue;const kind=stage().traps[i%2],id=nextId++;
        state.traps.push({id,x,y:367+ground(x),kind,clock:0,active:false,warning:false,disabled:false});
        if(controls[kind])state.props.push({id:nextId++,x:x-135,y:425+ground(x-135),hp:24,kind:controls[kind],target:id});
      }
      const extra=['scooter',null,'log','bell',null,null][index],extraX=stage().encounters[4]-80;
      if(extra&&extraX>=spawnX)state.props.push({id:nextId++,x:extraX,y:425+ground(extraX),kind:extra,hp:24});
      for(const gate of [3,7]){const x=stage().encounters[gate]+40;if(x>=spawnX)state.props.push({id:nextId++,x,y:445+ground(x),hp:1,kind:'lid',open:false});}
      const heartX=stage().encounters[5]-170;
      if(state.players.some(p=>!p.upgrades.includes(index)))state.pickups.push({x:Math.max(spawnX+120,heartX),y:411+ground(Math.max(spawnX+120,heartX)),kind:'heart'});
      emit('stage',{stage:index});
    }
    function start({players=1,difficulty='normal'}={}){
      rng=K.mulberry32(seed);nextId=0;
      Object.assign(state,{status:'playing',difficulty:difficulties[difficulty]?difficulty:'normal',tick:0,time:0,score:0,kills:0,bestCombo:0,continues:2,inputLog:[],events:[]});
      state.players=Array.from({length:players===2?2:1},(_,i)=>player(i));stageLoad(0);
    }
    function input(id,action,down){
      const p=state.players[id];if(state.status!=='playing'||state.ending||!p||!['left','right','up','down','attack','jump','special','run'].includes(action)||!!p.held[action]===!!down)return;
      p.held[action]=!!down;if(down)p.queued[action]=true;state.inputLog.push({tick:state.tick,player:id,action,down:!!down});
    }
    function pause(){if(state.status==='playing'){state.status='paused';release();}else if(state.status==='paused')state.status='playing';}
    function advance(){if(state.status!=='clear')return;if(state.stage===stages.length-1){state.status='victory';emit('victory');}else{state.status='playing';stageLoad(state.stage+1);}}
    function continueRun(){if(state.status!=='gameover'||state.continues<=0)return;state.continues--;state.players.forEach(p=>{p.lives=rules().lives;p.energy=40;});state.status='playing';stageLoad(state.stage,state.checkpoint);}
    function fx(kind,x,y,extra={}){state.effects.push({kind,x,y,life:.45,max:.45,...extra});}
    function spawn(kind,x,y,boss=false){
      const hp=Math.round((boss?440+state.stage*55:kind==='guard'?52:kind==='thrower'?30:kind==='swift'?32:37)*(boss?1:.75+rng()*.5)*rules().health*(boss&&state.players.length===2?1.6:1));
      const e={id:nextId++,kind,boss,x,y,z:kind==='flyer'?82:0,hp,maxHp:hp,face:-1,cooldown:.65+rng()*.7,stun:0,down:0,windup:0,attack:null,vx:0,thrown:0,throwHits:[],phase:0,walk:0,dead:0,enraged:false,superTimer:4,defend:0,decision:1+rng()*2,jumpTimer:1.5+rng()*2,vz:0};state.enemies.push(e);return e;
    }
    function enter(e,index){
      const side=e.boss?1:(index+state.gate+state.wave)%3===2?-1:1;
      const style=e.boss?['stomp','scuttle','bound','descend','charge','rift'][state.stage]:{grunt:'kick',guard:'charge',swift:'flip',thrower:'vault',flyer:'swoop'}[e.kind];
      const x=side<0?state.camera+210+(index%2)*80:e.x;let y=clamp(e.y,bounds(x).min,Math.min(bounds(x).max,state.cameraY+475));for(const t of state.traps)if(Math.abs(x-t.x)<210&&Math.abs(y-t.y)<75)y=Math.min(bounds(x).max,state.cameraY+475,t.y+95);
      const fixed=['descend','rift'].includes(style),startX=fixed?x:state.camera+(side<0?-140:1100);
      e.entrance={style,side,age:0,delay:.15+index*.18,duration:e.boss?1.65:e.kind==='guard'?1.15:1.05,startX,landX:x,landY:y,progress:0};
      e.x=startX;e.y=y;e.z=0;e.face=-side;
    }
    function enterTick(e,dt){
      const a=e.entrance;a.age+=dt;if(a.age<a.delay)return;
      const u=clamp((a.age-a.delay)/a.duration,0,1),ease=1-(1-u)**2;a.progress=u;
      e.x=a.startX+(a.landX-a.startX)*ease;e.y=a.landY+ground(e.x)-ground(a.landX);
      const peak={kick:115,flip:155,vault:125,bound:85,stomp:30,swoop:150}[a.style]||0;
      e.z=a.style==='descend'?260*(1-ease):a.style==='swoop'?82+peak*(1-ease):Math.sin(u*Math.PI)*peak;
      e.walk+=dt*16;
      if(!a.announced){a.announced=true;emit('arrival');}
      if(['charge','scuttle'].includes(a.style)&&Math.floor(u*12)>Math.floor((u-dt/a.duration)*12))fx('dust',e.x,e.y,{life:.3,max:.3});
      if(u===1){e.x=a.landX;e.y=a.landY;e.z=e.kind==='flyer'?82:0;e.entrance=null;e.cooldown=.8;e.jumpTimer=1.5;fx(e.kind==='flyer'?'ring':'dust',e.x,e.y,{life:.4,max:.4,color:stage().color});if(e.boss){state.shake=5;emit('slam');}else emit('land');}
    }
    function beginArena(reinforcement=false){
      if(!reinforcement){state.arena=true;state.wave=0;state.waveCount=lastGate()?1:1+Number(rng()<.48)+Number(state.difficulty==='hard'&&rng()<.25);}
      state.waveDelay=0;const at=center(),hard=state.difficulty==='hard',easy=state.difficulty==='easy';
      const count=lastGate()?1:Math.min(6,(easy?2:hard?3:2)+Math.floor(rng()*(hard?4:3))+(state.players.length-1));
      const weights=easy?[55,14,14,10,7]:hard?[20,20,22,23,15]:[36,18,19,17,10];
      for(let i=0;i<count;i++){let roll=rng()*100,n=0;while(n<4&&roll>=weights[n])roll-=weights[n++];const x=clamp(at+70+(i%3)*90,state.camera+60,state.camera+880);enter(spawn(Content.enemyKinds[n],x,355+(i%4)*36+ground(x)),i);}
      if(lastGate())enter(spawn('boss',clamp(at+200,state.camera+80,state.camera+850),419+ground(at+200),true),count);
      emit('arena');
    }
    function endBoss(e){
      if(state.ending)return;
      state.ending={age:0,next:0,x:e.x,y:e.y,fade:0};e.dead=4.5;state.shots=[];state.hazards=[];state.missiles=[];state.enemies.forEach(n=>{n.hp=0;n.dead=n.boss?4.5:.5;});release();emit('bossdown');
    }
    function endingTick(dt){const end=state.ending;end.age+=dt;
      if(end.age<2.5&&end.age>=end.next){end.next+=.15;const x=end.x+(rng()-.5)*150,y=end.y-30-rng()*120;fx('explosion',x,y,{life:.85,max:.85,radius:35+rng()*45});state.shake=12;state.flash=.055;if(Math.floor(end.next/.15)%2===0)emit('explosion');if(end.age>1.9)fx('explosion',end.x,end.y-65,{life:1.1,max:1.1,radius:180});}
      state.enemies.forEach(e=>e.dead=Math.max(0,e.dead-dt));end.fade=clamp((end.age-2.3)/2,0,1);
      if(end.age>=4.3){state.status='clear';state.arena=false;state.gate=stage().encounters.length;release();emit('clear');}
    }
    function hitEnemy(e,damage,face,force=80){
      if(e.hp<=0||e.entrance)return;const actual=Math.min(e.hp,damage);e.hp-=damage;
      // Boss windups are armored: repeated punches cannot lock them out of
      // their attacks. Their visible warnings must still be dodged.
      if(!e.boss){e.windup=0;e.attack=null;e.stun=.4;}else e.stun=0;
      e.vx=face*force*(e.boss?.18:1);
      if(force>=220&&!e.boss){e.down=.65;e.stun=.8;}
      state.score+=Math.round(actual*10);state.combo++;state.comboTime=2;state.bestCombo=Math.max(state.bestCombo,state.combo);state.shake=Math.max(state.shake,force>=220?7:3);state.hitstop=.035;fx('hit',e.x,e.y-40,{color:stages[state.stage].color});emit('hit',{heavy:force>=220});
      if(e.hp<=0){e.dead=.7;state.kills++;state.score+=e.boss?2000:120;state.players.filter(p=>p.lives>0).forEach(p=>p.energy=clamp(p.energy+8,0,100));if(e.boss)endBoss(e);else emit('ko');if(e.boss)fx('explosion',e.x,e.y-60,{life:1.2,max:1.2,radius:100});else if(rng()<.06)state.pickups.push({x:e.x,y:e.y,kind:rng()<.5?'food':'energy',food:Object.keys(Content.foods)[Math.floor(rng()*4)]});}
    }
    function hurtPlayer(p,damage,face){
      if(p.lives<=0||p.dead>0||p.invincible>0)return false;
      p.hp-=Math.round(damage*rules().damage);p.hurt=.3;p.invincible=.85;p.action=null;routeMove(p,clamp(p.x+face*20,state.camera+25,state.width-40)-p.x,0);state.combo=0;state.shake=5;emit('hurt');fx('hit',p.x,p.y-p.z-35,{color:'#ff7466'});
      if(p.hp<=0){p.hp=0;p.lives--;p.dead=1.4;p.airKick=false;p.held={};p.queued={};p.weapon=null;p.weaponHits=0;emit('death');}
      return true;
    }
    function activateProp(prop,p){
      const target=state.traps.find(t=>t.id===prop.target),rolling=['barrel','scooter','log','powder','battery','slab'].includes(prop.kind);
      if(rolling){const guided=target&&['powder','battery','slab'].includes(prop.kind);state.missiles.push({x:prop.x,y:prop.y,z:20,vx:guided?240:p.face*360,life:2.8,hits:[],kind:prop.kind,target:guided?target.id:null});return;}
      if(['gong','bell','capstan'].includes(prop.kind)){for(const e of state.enemies)if(!e.boss&&!e.entrance&&Math.abs(e.x-(target?.x||prop.x))<260){e.stun=2;e.windup=0;e.attack=null;}fx('ring',target?.x||prop.x,target?.y||prop.y,{life:1,max:1});}
      if(target){target.disabled=true;target.active=false;target.warning=false;target.clock=0;if(prop.kind==='console'){target.resume=6;prop.reset=6;}if(prop.kind==='capstan'){target.released=1;for(const e of state.enemies)if(!e.boss&&Math.abs(e.x-target.x)<90&&Math.abs(e.y-target.y)<45)hitEnemy(e,30,p.face,220);}fx('word',prop.x,prop.y-90,{text:prop.kind==='console'?'PAUSED 6s':prop.kind==='capstan'?'NET RELEASED':'SAFE'});}
      else if(prop.kind==='switch'){for(const t of state.traps)if(Math.abs(t.x-prop.x)<300)t.disabled=true;}
      else if(!['gong','bell'].includes(prop.kind))state.pickups.push({x:prop.x,y:prop.y,kind:prop.kind});
    }
    function strike(p,a){
      a.struck=true;
      if(a.kind==='propThrow'){state.missiles.push({x:p.x+p.face*28,y:p.y,z:48,vx:p.face*580,life:1.35,hits:[],kind:'lid'});emit('throw');return;}
      const weapon=p.weapon&&Content.weapons[p.weapon],reach=weapon?weapon.reach:a.kind==='kick'?103:a.step===3?98:84,damage=weapon?weapon.damage:a.kind==='kick'?22:a.step===3?20:12;
      for(const e of state.enemies){if(e.hp<=0||e.entrance||e.down>.3||Math.abs(e.y-p.y)>33||p.z>e.z+110||e.z>p.z+65)continue;const dx=(e.x-p.x)*p.face;if(dx<-18||dx>reach)continue;
        if(e.kind==='guard'&&e.face===-p.face&&a.kind!=='kick'&&a.step!==3&&!weapon){fx('word',e.x,e.y-e.z-115,{text:'BLOCK',life:.35,max:.35});emit('block');continue;}
        hitEnemy(e,damage,p.face,a.step===3||a.kind==='kick'?280:65);p.energy=clamp(p.energy+5,0,100);
      }
      for(const prop of state.props){if(prop.kind==='lid'||prop.hp<=0||Math.abs(prop.y-p.y)>38||(prop.x-p.x)*p.face<-15||(prop.x-p.x)*p.face>reach)continue;prop.hp-=damage;fx('debris',prop.x,prop.y-25,{color:'#dfac73'});emit('break');if(prop.hp<=0){state.score+=50;activateProp(prop,p);}}
      if(p.weapon&&--p.weaponHits<=0)p.weapon=null;
    }
    // Every attack pays its own cost. Regeneration continues during swings, so
    // a held attack naturally slows down when the meter cannot fund full-speed combos.
    function spendStamina(p,cost){
      if(p.stamina<cost)return false;
      p.stamina=Math.max(0,p.stamina-cost);
      if(p.stamina===0)p.exhausted=true;
      return true;
    }
    function attack(p){
      const lid=state.props.find(prop=>prop.kind==='lid'&&!prop.open&&Math.abs(prop.x-p.x)<52&&Math.abs(prop.y-p.y)<30);
      if(lid&&p.z===0){if(!spendStamina(p,18))return;lid.open=true;lid.hp=0;p.action={kind:'propThrow',age:0,duration:.5,struck:false,step:3};p.cooldown=.5;return;}
      const target=state.enemies.find(e=>!e.boss&&!e.entrance&&e.kind!=='flyer'&&e.hp>0&&e.down<=0&&Math.abs(e.y-p.y)<25&&(e.x-p.x)*p.face>-8&&(e.x-p.x)*p.face<45&&(e.stun>0||e.hp<e.maxHp*.5));
      if(target&&p.z===0){
        if(!spendStamina(p,18))return;
        p.action={kind:'throw',age:0,duration:.46,struck:true,step:3};p.cooldown=.5;target.thrown=.55;target.throwHits=[];target.stun=.8;hitEnemy(target,23,p.face,530);p.energy=clamp(p.energy+10,0,100);fx('word',p.x,p.y-100,{text:'THROW!',life:.7,max:.7});emit('throw');return;
      }
      const step=state.time<p.comboUntil?p.comboStep%3+1:1;
      if(!spendStamina(p,p.z>0||step===3?18:p.weapon?16:12))return;
      p.comboStep=step;p.comboUntil=state.time+.8;
      const kind=p.z>0?'kick':'punch',duration=(kind==='kick'?.38:p.comboStep===3?.4:.27)*(p.weapon?Content.weapons[p.weapon].speed:1);
      p.action={kind,step:p.comboStep,age:0,duration,struck:false};p.cooldown=duration;emit('swing');
    }
    function special(p){
      if(p.energy<100)return;p.energy=0;p.invincible=1;p.action={kind:'special',age:0,duration:.6,struck:true};p.cooldown=.65;state.flash=.22;state.shake=12;
      state.shots=state.shots.filter(b=>Math.abs(b.x-p.x)>185);for(const e of state.enemies)if(!e.entrance&&Math.abs(e.x-p.x)<185&&Math.abs(e.y-p.y)<125)hitEnemy(e,42,p.face,420);
      fx('special',p.x,p.y,{life:.75,max:.75,color:p.id?'#81e7fa':'#ffe6a0'});emit('special');
    }
    function movePlayer(p,dt){
      p.running=false;p.moving=false;
      p.invincible=Math.max(0,p.invincible-dt);p.hurt=Math.max(0,p.hurt-dt);p.cooldown=Math.max(0,p.cooldown-dt);
      if(p.dead>0){p.dead=Math.max(0,p.dead-dt);p.queued={};if(p.dead===0&&p.lives>0){p.hp=p.maxHp;p.stamina=100;p.exhausted=false;p.invincible=3;p.z=0;p.vz=0;p.action=null;}return;}
      if(p.lives<=0)return;
      const dx=Number(!!p.held.right)-Number(!!p.held.left),dy=Number(!!p.held.down)-Number(!!p.held.up),norm=dx&&dy?Math.SQRT1_2:1;
      if(dx&&!p.action)p.face=Math.sign(dx);
      if(p.queued.jump&&p.z===0&&p.hurt<=0){p.vz=620;p.z=.1;emit('jump');}
      if(p.queued.special&&p.hurt<=0)special(p);
      if((p.held.attack||p.queued.attack)&&p.cooldown===0&&p.hurt<=0)attack(p);
      p.queued={};
      const sprint=!!p.held.run&&!p.exhausted&&p.stamina>0&&!p.action&&p.hurt<=0&&p.z===0;
      const speed=p.hurt>0?0:p.action&&p.z===0?95:sprint?300:205,oldX=p.x,oldY=p.y;
      const boundary=Math.min(state.camera+910,state.width-40);
      routeMove(p,clamp(p.x+dx*speed*norm*dt,state.camera+30,boundary)-p.x,dy*speed*.85*norm*dt);
      if(state.arena)p.y=clamp(p.y,Math.max(bounds(p.x).min,state.cameraY+180),Math.min(bounds(p.x).max,state.cameraY+487));
      const teammates=state.players.filter(q=>q!==p&&q.lives>0);if(teammates.length){const lo=Math.min(...teammates.map(q=>q.y))-300,hi=Math.max(...teammates.map(q=>q.y))+300;p.y=clamp(p.y,Math.max(bounds(p.x).min,lo),Math.min(bounds(p.x).max,hi));}
      const distance=Math.hypot(p.x-oldX,p.y-oldY);p.moving=distance>.001;
      p.running=sprint&&p.moving;
      if(p.moving&&p.z===0&&!p.hurt)p.walk+=distance*(p.running?.052:.075);
      if(p.running){p.stamina=Math.max(0,p.stamina-22*dt);if(p.stamina===0){p.exhausted=true;p.running=false;}}
      else p.stamina=Math.min(100,p.stamina+24*dt);
      if(p.exhausted&&p.stamina>=35)p.exhausted=false;
      if(p.z>0||p.vz>0){p.z+=p.vz*dt;p.vz-=1150*dt;if(p.z<=0){p.z=0;p.vz=0;p.airKick=false;fx('dust',p.x,p.y,{life:.25,max:.25});}}
      if(p.action){p.action.age+=dt;if(!p.action.struck&&p.action.age>=.085)strike(p,p.action);if(p.action.age>=p.action.duration)p.action=null;}
      for(let i=state.pickups.length-1;i>=0;i--){const item=state.pickups[i];if(p.z>25||Math.abs(p.x-item.x)>33||Math.abs(p.y-item.y)>25)continue;
        if(item.kind==='food'&&p.hp>=p.maxHp)continue;
        if(item.kind==='food')p.hp=clamp(p.hp+(Content.foods[item.food||'burger']?.heal||35),0,p.maxHp);else if(item.kind==='heart'){for(const q of state.players)if(!q.upgrades.includes(state.stage)){q.upgrades.push(state.stage);q.maxHp++;q.hp=Math.min(q.maxHp,q.hp+1);}}else if(item.kind==='energy')p.energy=clamp(p.energy+30,0,100);else{p.weapon=item.weapon||stage().weapon;p.weaponHits=Content.weapons[p.weapon].hits;}
        state.pickups.splice(i,1);state.score+=100;fx('word',p.x,p.y-100,{text:item.kind==='food'?'+'+(Content.foods[item.food||'burger']?.heal||35)+' HP':item.kind==='heart'?'+1 MAX HP':item.kind==='energy'?'+30 SPECIAL':'WEAPON UP',color:'#ffe3a0',life:.9,max:.9});emit('pickup');
      }
    }
    function enemyAttack(e,target){
      const patterns=[['punch','charge','shot'],['punch','volley','slam'],['punch','pounce','slam'],['punch','blink','shot'],['punch','volley','charge'],['slam','pulse','blink']];
      const kind=e.boss?(e.superTimer<=0||e.phase%3===2?'super':patterns[state.stage][e.phase%3]):e.kind==='thrower'?'shot':'punch';
      e.attack={kind,x:target.x,y:target.y,face:e.face};e.windup=kind==='super'?1.1:e.boss?.8:e.kind==='guard'?.75:.62;e.phase++;
      if(kind==='super'){e.superTimer=e.enraged?6:9;emit('super');fx('word',e.x,e.y-160,{text:stage().superName,life:1.2,max:1.2,color:stage().color});}
    }
    function bossPower(e,a){
      const base=ground(e.x);
      const color=stage().color,add=(kind,x,y,rx,ry,delay,extra={})=>state.hazards.push({kind,x,y,rx,ry,delay,life:.38,age:0,damage:24,owner:e.id,color,...extra});
      const left=state.camera+25,right=Math.min(state.width-30,state.camera+935),fit=x=>clamp(x,left+45,right-45);
      if(state.stage===0){for(let i=0;i<2;i++)add('electric',(left+right)/2,clamp(a.y+(i?76:0),343+base,479+base),(right-left)/2,18,.7+i*.45);}
      if(state.stage===1){for(let i=0;i<4;i++)add('cannon',fit(a.x+(i-1)*130),clamp(a.y+(i%2?52:-34),345+base,477+base),58,32,.8+i*.26);}
      if(state.stage===2){for(const dir of [-1,1])add('quake',e.x,e.y,30,160,.75,{vx:dir*250,life:2.4,damage:22});}
      if(state.stage===3){for(let i=0;i<3;i++)add('shadow',fit(a.x+(i-1)*140),clamp(a.y+(i-1)*50,346+base,474+base),80,26,.65+i*.36);}
      if(state.stage===4){for(let i=0;i<3;i++)add('steam',left+100+i*(right-left-200)/2,416+base,34,95,.9+i*.22,{life:1.25,damage:22});}
      if(state.stage===5){for(let i=0;i<2;i++)add('time',e.x,e.y,25,12,.8+i*.85,{life:1.9,damage:22});}
    }
    function moveHazards(dt){
      for(const h of state.hazards){
        const owner=state.enemies.find(e=>e.id===h.owner&&e.hp>0);if(!owner){h.life=0;continue;}
        if(h.delay>0){h.delay-=dt;continue;}
        if(h.age===0){emit('slam');state.shake=Math.max(state.shake,7);fx('slam',h.x,h.y,{color:h.color});}
        h.age+=dt;h.life-=dt;h.x+=(h.vx||0)*dt;
        if(h.kind==='time'){h.rx=25+h.age*260;h.ry=h.rx*.4;}
        for(const p of state.players){const dx=(p.x-h.x)/h.rx,dy=(p.y-h.y)/h.ry,d=dx*dx+dy*dy;
          const hit=h.kind==='time'?d<1.18&&d>.7:d<=1;
          if(hit&&p.z<(h.kind==='steam'?100:38))hurtPlayer(p,h.damage,Math.sign(p.x-h.x)||1);
        }
      }
      state.hazards=state.hazards.filter(h=>h.life>0);
    }
    function sceneryTick(dt){

      for(const prop of state.props)if(prop.reset>0){prop.reset-=dt;if(prop.reset<=0)prop.hp=24;}
      for(const t of state.traps){
        if(t.released>0)t.released=Math.max(0,t.released-dt);
        if(t.resume>0){t.resume-=dt;if(t.resume<=0){t.disabled=false;t.clock=0;}}
        if(t.disabled){t.warning=false;t.active=false;continue;}
        const nearby=state.players.some(p=>p.lives>0&&Math.abs(p.x-t.x)<480);
        if(!nearby){t.clock=0;t.warning=false;t.active=false;t.hits=[];continue;}
        if(t.kind==='darts'&&!t.clock){if(!state.players.concat(state.enemies).some(p=>!p.entrance&&p.hp>0&&p.z<10&&Math.abs(p.x-t.x)<65&&Math.abs(p.y-t.y)<28)){t.warning=false;t.active=false;continue;}t.clock=2.3-dt;}
        const wasWarning=t.warning,wasActive=t.active;t.clock=(t.clock||0)+dt;if(t.clock>=6.2)t.clock=0;t.warning=t.clock>=2.3&&t.clock<3.3;t.active=t.clock>=3.3&&t.clock<4.5;
        if(t.warning&&!wasWarning)emit('trapwarning');if(t.active&&!wasActive)emit(['steam','boiler','geyser'].includes(t.kind)?'trapsteam':'trapfire');
        if(!t.active){t.hits=[];continue;}if(t.kind==='rockfall'&&t.clock<4.05)continue;
        const {x,rx,ry,height}=Content.trapArea(t);
        for(const p of state.players)if(Math.abs(p.x-x)<rx&&Math.abs(p.y-t.y)<ry&&p.z<height)hurtPlayer(p,16,Math.sign(p.x-t.x)||1);
        for(const e of state.enemies)if(!e.boss&&!e.entrance&&e.hp>0&&e.z<height&&!t.hits?.includes(e.id)&&Math.abs(e.x-x)<rx&&Math.abs(e.y-t.y)<ry){(t.hits||=[]).push(e.id);hitEnemy(e,25,1,220);}
      }
      for(const prop of state.props)if(prop.kind==='lid'&&prop.open)for(const p of state.players)if(p.z<8&&Math.abs(p.x-prop.x)<21&&Math.abs(p.y-prop.y)<12&&p.action?.kind!=='propThrow'){if(hurtPlayer(p,14,p.face)){p.z=10;p.vz=230;fx('word',p.x,p.y-100,{text:'WATCH YOUR STEP!'});}}
      for(const m of state.missiles){const oldX=m.x,target=m.target==null?null:state.traps.find(t=>t.id===m.target);if(target){const dx=target.x-m.x,dy=target.y-m.y,d=Math.hypot(dx,dy);if(d<14){target.disabled=true;target.active=false;target.warning=false;target.clock=0;target.plugged=m.kind==='slab';m.life=0;fx('ring',target.x,target.y,{life:.5,max:.5});}else{m.vx=dx/d*240;m.y+=dy/d*240*dt;}}m.x+=m.vx*dt;if(!target)m.y+=ground(m.x)-ground(oldX);m.life-=dt;if(m.life<=0)continue;for(const e of state.enemies)if(e.hp>0&&!e.entrance&&!m.hits.includes(e.id)&&Math.abs(m.x-e.x)<45&&Math.abs(m.y-e.y)<34&&Math.abs(e.z-m.z)<90){m.hits.push(e.id);hitEnemy(e,45,Math.sign(m.vx),360);}}
      state.missiles=state.missiles.filter(m=>m.life>0&&Math.abs(m.x-state.camera)<1150);
    }
    function moveFlyer(e,target,dt){
      e.face=target.x<e.x?-1:1;
      if(e.stun>0){e.z=Math.max(16,e.z-dt*180);return;}
      if(e.dive>0){e.dive-=dt;e.z=Math.max(12,e.z-dt*210);e.x+=e.diveVX*dt;e.y+=e.diveVY*dt;if(Math.abs(e.x-target.x)<42&&Math.abs(e.y-target.y)<28&&Math.abs(target.z-e.z)<50)hurtPlayer(target,14,e.face);if(e.dive<=0)e.cooldown=2.4;return;}
      e.z=Math.min(88,e.z+dt*85)+Math.sin(state.time*7+e.id)*dt*9;
      if(e.windup>0){e.windup-=dt;if(e.windup<=0){e.dive=.65;const dx=e.attack.x-e.x,dy=e.attack.y-e.y,length=Math.max(1,Math.hypot(dx,dy));e.diveVX=dx/length*300;e.diveVY=dy/length*200;e.attack=null;}return;}
      const dx=target.x-e.x,dy=target.y-e.y;
      if(e.cooldown===0&&Math.abs(dx)<260){e.windup=.85;e.attack={kind:'dive',x:target.x,y:target.y};return;}
      e.x+=Math.sign(dx)*dt*(Math.abs(dx)>150?115:-25);e.y+=Math.sign(dy)*Math.min(Math.abs(dy),dt*85);
    }
    function moveEnemy(e,dt){
      if(e.hp<=0&&e.thrown<=0){e.dead=Math.max(0,e.dead-dt);return;}
      if(e.entrance&&e.hp>0){enterTick(e,dt);return;}
      if(e.boss&&e.hp>0){
        if(!e.enraged&&e.hp/e.maxHp<=BOSS_RAGE){e.enraged=true;e.superTimer=Math.min(e.superTimer,1);state.shake=8;emit('enrage');fx('word',e.x,e.y-170,{text:'ENRAGED!',color:'#ff6655',life:1.2,max:1.2});}
        e.superTimer-=dt;
      }
      e.stun=Math.max(0,e.stun-dt);e.down=Math.max(0,e.down-dt);e.cooldown=Math.max(0,e.cooldown-dt*(e.enraged?1.3:1));
      if(e.thrown>0){e.thrown-=dt;for(const other of state.enemies)if(other!==e&&other.hp>0&&!other.entrance&&!e.throwHits.includes(other.id)&&Math.abs(other.x-e.x)<45&&Math.abs(other.y-e.y)<35){e.throwHits.push(other.id);hitEnemy(other,20,Math.sign(e.vx),280);}}
      routeMove(e,clamp(e.x+e.vx*dt,state.camera+20,Math.min(state.width-30,center()+350))-e.x,0);e.vx*=Math.exp(-6*dt);
      if(e.hp<=0){e.dead=Math.max(0,e.dead-dt);return;}
      const alive=state.players.filter(p=>p.lives>0&&p.dead<=0);if(!alive.length)return;
      const target=alive.reduce((best,p)=>Math.hypot(p.x-e.x,p.y-e.y)<Math.hypot(best.x-e.x,best.y-e.y)?p:best);
      if(e.kind==='flyer'){moveFlyer(e,target,dt);return;}
      if(!e.boss){
        if(e.z>0||e.vz>0){e.z+=e.vz*dt;e.vz-=850*dt;if(e.z<0){e.z=0;e.vz=0;}}
        e.jumpTimer-=dt;e.decision-=dt;e.defend=Math.max(0,e.defend-dt);
        if(e.decision<=0){e.decision=2.5+rng()*2;if(rng()<.4)e.defend=.7+rng()*.7;}
        if(['swift','thrower'].includes(e.kind)&&e.jumpTimer<=0&&e.stun<=0){e.vz=e.kind==='swift'?380:290;e.z=.1;e.jumpTimer=3+rng()*2;}
      }
      if(e.stun>0)return;
      if(!e.boss&&e.defend>0&&!e.windup){e.face=target.x<e.x?-1:1;routeMove(e,-e.face*35*dt,(e.id%2?1:-1)*15*dt);return;}
      if(e.charge>0){e.charge=Math.max(0,e.charge-dt);e.vx=e.face*460;for(const p of alive)if(Math.abs(p.x-e.x)<55&&Math.abs(p.y-e.y)<34&&p.z<38)hurtPlayer(p,18,e.face);return;}
      const dx=target.x-e.x,dy=target.y-e.y;
      if(e.windup>0){e.windup-=dt;if(e.windup<=0){const a=e.attack;e.attack=null;e.cooldown=e.boss?1.1:1.7+rng()*.9;
        if(a.kind==='super')bossPower(e,a);
        else if(['shot','volley','pulse'].includes(a.kind)){
          const aim=Math.atan2(a.y-e.y,a.x-e.x),angles=a.kind==='pulse'?Array.from({length:10},(_,i)=>i*Math.PI/5):a.kind==='volley'?[-.28,0,.28].map(n=>aim+n):[aim];
          for(const angle of angles)state.shots.push({x:e.x,y:e.y,vx:Math.cos(angle)*310,vy:Math.sin(angle)*310,life:3,owner:e.id,z:34+(e.z||0),kind:e.boss?'orb':['arc','bomb','venom','shuriken','bullet','pulse'][state.stage]});emit('shot');
        }
        else if(a.kind==='charge'){e.charge=.5;e.vx=a.face*460;fx('word',e.x,e.y-130,{text:'CHARGE!',life:.6,max:.6});}
        else if(a.kind==='blink'){fx('burst',e.x,e.y-40);e.x=clamp(a.x-a.face*100,state.camera+30,Math.min(state.width-40,center()+320));e.y=clamp(a.y,bounds(e.x).min,bounds(e.x).max);e.face=a.face;e.cooldown=.22;fx('burst',e.x,e.y-40);}
        else if(a.kind==='pounce'){e.x=clamp(a.x,state.camera+30,Math.min(state.width-40,center()+320));e.y=clamp(a.y,bounds(e.x).min,bounds(e.x).max);fx('slam',e.x,e.y,{life:.5,max:.5});for(const p of alive)if(Math.abs(p.x-e.x)<85&&Math.abs(p.y-e.y)<55&&p.z<35)hurtPlayer(p,20,Math.sign(p.x-e.x)||1);emit('slam');}
        else if(a.kind==='slam'){fx('slam',e.x,e.y,{life:.5,max:.5});state.shake=8;for(const p of alive)if(Math.abs(p.x-e.x)<140&&Math.abs(p.y-e.y)<85&&p.z<35)hurtPlayer(p,20,Math.sign(p.x-e.x)||1);emit('slam');}
        else{fx('swipe',e.x+a.face*48,e.y-37,{face:a.face});for(const p of alive)if((p.x-e.x)*a.face>-15&&(p.x-e.x)*a.face<(e.boss?105:80)&&Math.abs(p.y-e.y)<32&&Math.abs(p.z-e.z)<38)hurtPlayer(p,e.boss?19:e.kind==='brute'?17:11,a.face);}
      }return;}
      e.face=dx<0?-1:1;
      if(e.boss&&e.superTimer<=0&&e.cooldown===0){enemyAttack(e,target);return;}
      const range=e.kind==='thrower'?260:e.boss?90:58;
      if(Math.abs(dx)<range&&Math.abs(dy)<26&&e.cooldown===0){enemyAttack(e,target);return;}
      const speed=e.kind==='swift'?115:e.kind==='brute'?57:e.boss?(e.enraged?100:78):83;
      const laneOffset=(e.id%3-1)*13,moveY=dy+laneOffset;
      routeMove(e,Math.abs(dx)>range*.75?Math.sign(dx)*speed*dt:0,Math.abs(moveY)>5?Math.sign(moveY)*speed*.72*dt:0);
      for(const other of state.enemies)if(other!==e&&other.hp>0&&!other.entrance&&Math.abs(other.x-e.x)<30&&Math.abs(other.y-e.y)<22)routeMove(e,0,(e.id>other.id?1:-1)*24*dt);
    }
    function tick(dt=STEP){
      if(state.status!=='playing')return;dt=Math.min(dt,.05);state.tick++;state.time+=dt;
      state.transition=Math.max(0,state.transition-dt);state.flash=Math.max(0,state.flash-dt);state.shake=Math.max(0,state.shake-dt*24);state.comboTime=Math.max(0,state.comboTime-dt);if(!state.comboTime)state.combo=0;
      state.effects.forEach(f=>f.life-=dt);state.effects=state.effects.filter(f=>f.life>0).slice(-90);
      if(state.ending){endingTick(dt);return;}
      const fallenBoss=state.enemies.find(e=>e.boss&&e.hp<=0);if(fallenBoss){endBoss(fallenBoss);return;}
      if(state.hitstop>0){state.hitstop-=dt;return;}
      state.players.forEach(p=>{if(!state.ending)movePlayer(p,dt);});if(state.ending)return;state.enemies.forEach(e=>{const x=e.x,y=e.y,arriving=!!e.entrance;moveEnemy(e,dt);const distance=Math.hypot(e.x-x,e.y-y);e.moving=!arriving&&!e.entrance&&e.hp>0&&e.z===0&&e.stun<=0&&e.down<=0&&e.thrown<=0&&!e.windup&&distance>.01;if(e.moving)e.walk+=distance*.11;});moveHazards(dt);sceneryTick(dt);if(state.ending)return;
      for(const b of state.shots){b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;for(const p of state.players)if(b.life>0&&Math.abs(p.x-b.x)<24&&Math.abs(p.y-b.y)<22&&Math.abs(p.z+20-(b.z||34))<28&&hurtPlayer(p,13,Math.sign(b.vx)))b.life=0;}
      state.shots=state.shots.filter(b=>b.life>0&&b.x>state.camera-60&&b.x<state.camera+1050);
      state.enemies=state.enemies.filter(e=>e.hp>0||e.dead>0);
      const alive=state.players.filter(p=>p.lives>0||p.dead>0);if(!alive.length){state.status='gameover';release();emit('gameover');return;}
      const standing=state.players.filter(p=>p.lives>0);if(!standing.length)return;
      const lead=Math.max(...standing.map(p=>p.x)),tail=Math.min(...standing.map(p=>p.x));
      const cameraTarget=Math.min(lead-310,tail-45,state.width-960);if(!state.arena){const distance=Math.max(0,cameraTarget-state.camera);state.camera=clamp(state.camera+Math.min(distance*(1-Math.exp(-5*dt)),300*dt),0,state.width-960);}
      const cameraYTarget=clamp(ground((lead+tail)/2),0,stage().depth);if(!state.arena)state.cameraY+=clamp(cameraYTarget-state.cameraY,-dt*320,dt*320);
      if(!state.arena&&state.gate<stage().encounters.length&&lead>center()-330&&state.camera>=Math.max(0,center()-660))beginArena();
      if(state.arena&&!state.enemies.some(e=>e.hp>0)){
        if(state.wave+1<state.waveCount){state.waveDelay+=dt;if(state.waveDelay>=1.1){state.wave++;beginArena(true);}return;}
        state.arena=false;state.wave=0;state.gate++;state.hazards=[];state.shots=[];state.players.forEach(p=>p.energy=clamp(p.energy+12,0,100));emit('gate');
        if(state.gate<stage().encounters.length&&state.gate%3===0){state.checkpoint=state.gate;for(const p of state.players)if(p.lives>0){p.hp=clamp(p.hp+45,0,p.maxHp);p.energy=clamp(p.energy+25,0,100);}fx('word',lead,240,{text:'CHECKPOINT / +45 HEALTH',life:2,max:2,color:'#9fffc9'});emit('pickup');}
        if(state.gate===stage().encounters.length){state.status='clear';release();emit('clear');}
      }
      if(state.inputLog.length>100000)state.inputLog.splice(0,1000);
    }
    return {state,start,input,release,pause,advance,continueRun,tick,drainEvents(){return state.events.splice(0);},hash(){return K.fnv1a(JSON.stringify({seed,state:state.inputLog}));}};
  }
  const api={createEngine,stages,difficulties,STEP,BOSS_RAGE,content:Content};root.SlopInTime=Object.assign(root.SlopInTime||{},api);if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
