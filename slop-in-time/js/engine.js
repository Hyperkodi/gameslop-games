(function(root){
  'use strict';
  const K=typeof module!=='undefined'?require('../../_kit/rng.js'):root.GameSlopKit;
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
  const BOSS_RAGE=.3;
  const difficulties={easy:{lives:5,damage:.65,health:.8},normal:{lives:3,damage:1,health:1},hard:{lives:2,damage:1.3,health:1.25}};
  function createEngine({seed=1991}={}){
    let rng=K.mulberry32(seed),nextId=0;
    const state={status:'ready',stage:0,players:[],enemies:[],props:[],pickups:[],effects:[],shots:[],hazards:[],events:[],inputLog:[],camera:0,tick:0,time:0,score:0,kills:0,combo:0,comboTime:0,bestCombo:0,shake:0,flash:0,hitstop:0,continues:2,gate:0,checkpoint:0,wave:0,arena:false,width:9000,transition:0,difficulty:'normal',seed};
    const emit=(type,data={})=>state.events.push({type,...data});
    const rules=()=>difficulties[state.difficulty];
    const stage=()=>stages[state.stage],center=()=>stage().encounters[Math.min(state.gate,stage().encounters.length-1)],lastGate=()=>state.gate===stage().encounters.length-1;
    function player(id){return {id,x:130+id*70,y:416+id*36,z:0,vz:0,face:1,hp:100,lives:rules().lives,energy:40,held:{},queued:{},cooldown:0,action:null,comboStep:0,comboUntil:0,invincible:2,hurt:0,dead:0,weapon:null,weaponHits:0,walk:0,moving:false};}
    function release(){for(const p of state.players){p.held={};p.queued={};}}
    function stageLoad(index,startGate=0){
      state.stage=index;state.enemies=[];state.pickups=[];state.effects=[];state.shots=[];state.props=[];state.camera=0;state.gate=0;state.arena=false;state.transition=2.4;state.shake=0;state.flash=0;state.hitstop=0;state.combo=0;state.comboTime=0;
      release();
      state.width=stage().width;state.hazards=[];state.checkpoint=startGate;state.gate=startGate;state.wave=0;
      state.players.forEach((p,i)=>Object.assign(p,{x:130+i*65,y:416+i*35,z:0,vz:0,airKick:false,hp:100,invincible:2,dead:0,hurt:0,action:null,cooldown:0,weapon:null,weaponHits:0,energy:Math.max(40,p.energy),lives:Math.max(1,p.lives)}));
      const spawnX=startGate?center()-360:130;
      state.players.forEach((p,i)=>p.x=spawnX+i*65);state.camera=Math.max(0,spawnX-130);
      for(let i=0;i<Math.floor(state.width/310);i++){const x=330+i*310;if(x<spawnX)continue;state.props.push({id:nextId++,x,y:350+(i%3)*60,hp:16,kind:i%3===0?'food':i%3===1?'weapon':'energy'});}
      emit('stage',{stage:index});
    }
    function start({players=1,difficulty='normal'}={}){
      rng=K.mulberry32(seed);nextId=0;
      Object.assign(state,{status:'playing',difficulty:difficulties[difficulty]?difficulty:'normal',tick:0,time:0,score:0,kills:0,bestCombo:0,continues:2,inputLog:[],events:[]});
      state.players=Array.from({length:players===2?2:1},(_,i)=>player(i));stageLoad(0);
    }
    function input(id,action,down){
      const p=state.players[id];if(state.status!=='playing'||!p||!['left','right','up','down','attack','jump','special'].includes(action)||!!p.held[action]===!!down)return;
      p.held[action]=!!down;if(down)p.queued[action]=true;state.inputLog.push({tick:state.tick,player:id,action,down:!!down});
    }
    function pause(){if(state.status==='playing'){state.status='paused';release();}else if(state.status==='paused')state.status='playing';}
    function advance(){if(state.status!=='clear')return;if(state.stage===stages.length-1){state.status='victory';emit('victory');}else{state.status='playing';stageLoad(state.stage+1);}}
    function continueRun(){if(state.status!=='gameover'||state.continues<=0)return;state.continues--;state.players.forEach(p=>{p.lives=rules().lives;p.energy=40;});state.status='playing';stageLoad(state.stage,state.checkpoint);}
    function fx(kind,x,y,extra={}){state.effects.push({kind,x,y,life:.45,max:.45,...extra});}
    function spawn(kind,x,y,boss=false){
      const hp=Math.round((boss?440+state.stage*55:kind==='brute'?65:kind==='thrower'?30:kind==='swift'?30:37)*rules().health*(boss&&state.players.length===2?1.6:1));
      const e={id:nextId++,kind,boss,x,y,z:0,hp,maxHp:hp,face:-1,cooldown:.65+rng()*.7,stun:0,down:0,windup:0,attack:null,vx:0,thrown:0,throwHits:[],phase:0,walk:0,dead:0,enraged:false,superTimer:4};state.enemies.push(e);return e;
    }
    function beginArena(){
      state.arena=true;const at=center();
      const count=(lastGate()?2:3+(state.gate+state.wave)%3)+(state.players.length-1)*2+(state.difficulty==='hard'?2:0);
      for(let i=0;i<count;i++){const flank=state.wave>0&&i%2===0;spawn(['grunt','swift','grunt','thrower','brute'][(i+state.stage+state.gate+state.wave)%5],flank?Math.max(state.camera+45,at-200):at+110+(i%3)*70,350+(i%4)*42);}
      if(lastGate())spawn('boss',at+200,419,true);
      emit('arena');
    }
    function hitEnemy(e,damage,face,force=80){
      if(e.hp<=0)return;const actual=Math.min(e.hp,damage);e.hp-=damage;
      // Boss windups are armored: repeated punches cannot lock them out of
      // their attacks. Their visible warnings must still be dodged.
      if(!e.boss){e.windup=0;e.attack=null;e.stun=.4;}else e.stun=0;
      e.vx=face*force*(e.boss?.18:1);
      if(force>=220&&!e.boss){e.down=.65;e.stun=.8;}
      state.score+=Math.round(actual*10);state.combo++;state.comboTime=2;state.bestCombo=Math.max(state.bestCombo,state.combo);state.shake=Math.max(state.shake,force>=220?7:3);state.hitstop=.035;fx('hit',e.x,e.y-40,{color:stages[state.stage].color});emit('hit',{heavy:force>=220});
      if(e.hp<=0){e.dead=.7;state.kills++;state.score+=e.boss?2000:120;state.players.filter(p=>p.lives>0).forEach(p=>p.energy=clamp(p.energy+8,0,100));emit(e.boss?'bossdown':'ko');if(e.boss)fx('burst',e.x,e.y-60,{life:1.2,max:1.2});else if(rng()<.12)state.pickups.push({x:e.x,y:e.y,kind:rng()<.5?'food':'energy'});}
    }
    function hurtPlayer(p,damage,face){
      if(p.lives<=0||p.dead>0||p.invincible>0)return false;
      p.hp-=Math.round(damage*rules().damage);p.hurt=.3;p.invincible=.85;p.action=null;p.x=clamp(p.x+face*20,state.camera+25,state.width-40);state.combo=0;state.shake=5;emit('hurt');fx('hit',p.x,p.y-p.z-35,{color:'#ff7466'});
      if(p.hp<=0){p.hp=0;p.lives--;p.dead=1.4;p.airKick=false;p.held={};p.queued={};p.weapon=null;p.weaponHits=0;emit('death');}
      return true;
    }
    function strike(p,a){
      a.struck=true;const reach=p.weapon?116:a.kind==='kick'?103:a.step===3?98:84,damage=p.weapon?24:a.kind==='kick'?17:a.step===3?20:12;
      for(const e of state.enemies){if(e.hp<=0||e.down>.3||Math.abs(e.y-p.y)>33)continue;const dx=(e.x-p.x)*p.face;if(dx<-18||dx>reach)continue;hitEnemy(e,damage,p.face,a.step===3||a.kind==='kick'?280:65);p.energy=clamp(p.energy+5,0,100);}
      for(const prop of state.props){if(prop.hp<=0||Math.abs(prop.y-p.y)>38||(prop.x-p.x)*p.face<-15||(prop.x-p.x)*p.face>reach)continue;prop.hp-=damage;fx('debris',prop.x,prop.y-25,{color:'#dfac73'});emit('break');if(prop.hp<=0){state.score+=50;state.pickups.push({x:prop.x,y:prop.y,kind:prop.kind});}}
      if(p.weapon&&--p.weaponHits<=0)p.weapon=null;
    }
    function attack(p){
      const target=state.enemies.find(e=>!e.boss&&e.hp>0&&e.down<=0&&Math.abs(e.y-p.y)<25&&(e.x-p.x)*p.face>-8&&(e.x-p.x)*p.face<45&&(e.stun>0||e.hp<e.maxHp*.5));
      if(target&&p.z===0){
        p.action={kind:'throw',age:0,duration:.46,struck:true,step:3};p.cooldown=.5;target.thrown=.55;target.throwHits=[];target.stun=.8;hitEnemy(target,23,p.face,530);p.energy=clamp(p.energy+10,0,100);fx('word',p.x,p.y-100,{text:'THROW!',life:.7,max:.7});emit('throw');return;
      }
      p.comboStep=state.time<p.comboUntil?p.comboStep%3+1:1;p.comboUntil=state.time+.8;
      const kind=p.z>12?'kick':'punch',duration=kind==='kick'?.38:p.comboStep===3?.4:.27;
      p.action={kind,step:p.comboStep,age:0,duration,struck:false};p.cooldown=duration;emit('swing');
    }
    function special(p){
      if(p.energy<100)return;p.energy=0;p.invincible=1;p.action={kind:'special',age:0,duration:.6,struck:true};p.cooldown=.65;state.flash=.22;state.shake=12;
      state.shots=state.shots.filter(b=>Math.abs(b.x-p.x)>185);for(const e of state.enemies)if(Math.abs(e.x-p.x)<185&&Math.abs(e.y-p.y)<125)hitEnemy(e,42,p.face,420);
      fx('special',p.x,p.y,{life:.75,max:.75,color:p.id?'#81e7fa':'#ffe6a0'});emit('special');
    }
    function movePlayer(p,dt){
      p.invincible=Math.max(0,p.invincible-dt);p.hurt=Math.max(0,p.hurt-dt);p.cooldown=Math.max(0,p.cooldown-dt);
      if(p.dead>0){p.dead=Math.max(0,p.dead-dt);p.queued={};if(p.dead===0&&p.lives>0){p.hp=100;p.invincible=3;p.z=0;p.vz=0;p.action=null;}return;}
      if(p.lives<=0)return;
      const dx=Number(!!p.held.right)-Number(!!p.held.left),dy=Number(!!p.held.down)-Number(!!p.held.up),norm=dx&&dy?Math.SQRT1_2:1;
      if(dx&&!p.action)p.face=Math.sign(dx);
      if(p.queued.jump&&p.z===0&&p.hurt<=0){p.vz=460;p.z=.1;p.airKick=true;emit('jump');}
      if(p.queued.special&&p.hurt<=0)special(p);
      if((p.held.attack||p.queued.attack||(p.airKick&&p.z>12))&&p.cooldown===0&&p.hurt<=0){attack(p);if(p.z>12)p.airKick=false;}
      p.queued={};
      const speed=p.hurt>0?0:p.action&&p.z===0?95:205;p.moving=!!(dx||dy);p.walk+=dt*(p.moving?12:2);
      const boundary=state.arena?center()+340:state.width-40;
      p.x=clamp(p.x+dx*speed*norm*dt,state.camera+30,boundary);p.y=clamp(p.y+dy*speed*.7*norm*dt,335,487);
      if(p.z>0||p.vz>0){p.z+=p.vz*dt;p.vz-=1150*dt;if(p.z<=0){p.z=0;p.vz=0;p.airKick=false;fx('dust',p.x,p.y,{life:.25,max:.25});}}
      if(p.action){p.action.age+=dt;if(!p.action.struck&&p.action.age>=.085)strike(p,p.action);if(p.action.age>=p.action.duration)p.action=null;}
      for(let i=state.pickups.length-1;i>=0;i--){const item=state.pickups[i];if(p.z>25||Math.abs(p.x-item.x)>33||Math.abs(p.y-item.y)>25)continue;
        if(item.kind==='food'&&p.hp>=100)continue;
        if(item.kind==='food')p.hp=clamp(p.hp+35,0,100);else if(item.kind==='energy')p.energy=clamp(p.energy+30,0,100);else{p.weapon=stages[state.stage].weapon;p.weaponHits=18;}
        state.pickups.splice(i,1);state.score+=100;fx('word',p.x,p.y-100,{text:item.kind==='food'?'+35 HEALTH':item.kind==='energy'?'+30 SPECIAL':'WEAPON UP',color:'#ffe3a0',life:.9,max:.9});emit('pickup');
      }
    }
    function enemyAttack(e,target){
      const patterns=[['punch','charge','shot'],['punch','volley','slam'],['punch','pounce','slam'],['punch','blink','shot'],['punch','volley','charge'],['slam','pulse','blink']];
      const kind=e.boss?(e.superTimer<=0||e.phase%3===2?'super':patterns[state.stage][e.phase%3]):e.kind==='thrower'?'shot':'punch';
      e.attack={kind,x:target.x,y:target.y,face:e.face};e.windup=kind==='super'?1.1:e.boss?.8:e.kind==='brute'?.7:.48;e.phase++;
      if(kind==='super'){e.superTimer=e.enraged?6:9;emit('super');fx('word',e.x,e.y-160,{text:stage().superName,life:1.2,max:1.2,color:stage().color});}
    }
    function bossPower(e,a){
      const color=stage().color,add=(kind,x,y,rx,ry,delay,extra={})=>state.hazards.push({kind,x,y,rx,ry,delay,life:.38,age:0,damage:24,owner:e.id,color,...extra});
      const left=state.camera+25,right=Math.min(state.width-30,state.camera+935),fit=x=>clamp(x,left+45,right-45);
      if(state.stage===0){for(let i=0;i<2;i++)add('electric',(left+right)/2,clamp(a.y+(i?76:0),343,479),(right-left)/2,18,.7+i*.45);}
      if(state.stage===1){for(let i=0;i<4;i++)add('cannon',fit(a.x+(i-1)*130),clamp(a.y+(i%2?52:-34),345,477),58,32,.8+i*.26);}
      if(state.stage===2){for(const dir of [-1,1])add('quake',e.x,e.y,30,160,.75,{vx:dir*250,life:2.4,damage:22});}
      if(state.stage===3){for(let i=0;i<3;i++)add('shadow',fit(a.x+(i-1)*140),clamp(a.y+(i-1)*50,346,474),80,26,.65+i*.36);}
      if(state.stage===4){for(let i=0;i<3;i++)add('steam',left+100+i*(right-left-200)/2,416,34,95,.9+i*.22,{life:1.25,damage:22});}
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
    function moveEnemy(e,dt){
      if(e.hp<=0&&e.thrown<=0){e.dead=Math.max(0,e.dead-dt);return;}
      if(e.boss&&e.hp>0){
        if(!e.enraged&&e.hp/e.maxHp<=BOSS_RAGE){e.enraged=true;e.superTimer=Math.min(e.superTimer,1);state.shake=8;emit('enrage');fx('word',e.x,e.y-170,{text:'ENRAGED!',color:'#ff6655',life:1.2,max:1.2});}
        e.superTimer-=dt;
      }
      e.stun=Math.max(0,e.stun-dt);e.down=Math.max(0,e.down-dt);e.cooldown=Math.max(0,e.cooldown-dt*(e.enraged?1.3:1));e.walk+=dt*8;
      if(e.thrown>0){e.thrown-=dt;for(const other of state.enemies)if(other!==e&&other.hp>0&&!e.throwHits.includes(other.id)&&Math.abs(other.x-e.x)<45&&Math.abs(other.y-e.y)<35){e.throwHits.push(other.id);hitEnemy(other,20,Math.sign(e.vx),280);}}
      e.x=clamp(e.x+e.vx*dt,state.camera+20,Math.min(state.width-30,center()+350));e.vx*=Math.exp(-6*dt);
      if(e.hp<=0){e.dead=Math.max(0,e.dead-dt);return;}
      if(e.stun>0)return;
      const alive=state.players.filter(p=>p.lives>0&&p.dead<=0);if(!alive.length)return;
      if(e.charge>0){e.charge=Math.max(0,e.charge-dt);e.vx=e.face*460;for(const p of alive)if(Math.abs(p.x-e.x)<55&&Math.abs(p.y-e.y)<34&&p.z<38)hurtPlayer(p,18,e.face);return;}
      const target=alive.reduce((best,p)=>Math.hypot(p.x-e.x,p.y-e.y)<Math.hypot(best.x-e.x,best.y-e.y)?p:best);
      const dx=target.x-e.x,dy=target.y-e.y;
      if(e.windup>0){e.windup-=dt;if(e.windup<=0){const a=e.attack;e.attack=null;e.cooldown=e.boss?1.1:e.kind==='swift'?.8:1.3;
        if(a.kind==='super')bossPower(e,a);
        else if(['shot','volley','pulse'].includes(a.kind)){
          const aim=Math.atan2(a.y-e.y,a.x-e.x),angles=a.kind==='pulse'?Array.from({length:10},(_,i)=>i*Math.PI/5):a.kind==='volley'?[-.28,0,.28].map(n=>aim+n):[aim];
          for(const angle of angles)state.shots.push({x:e.x,y:e.y,vx:Math.cos(angle)*310,vy:Math.sin(angle)*310,life:3,owner:e.id});emit('shot');
        }
        else if(a.kind==='charge'){e.charge=.5;e.vx=a.face*460;fx('word',e.x,e.y-130,{text:'CHARGE!',life:.6,max:.6});}
        else if(a.kind==='blink'){fx('burst',e.x,e.y-40);e.x=clamp(a.x-a.face*100,state.camera+30,Math.min(state.width-40,center()+320));e.y=clamp(a.y,335,487);e.face=a.face;e.cooldown=.22;fx('burst',e.x,e.y-40);}
        else if(a.kind==='pounce'){e.x=clamp(a.x,state.camera+30,Math.min(state.width-40,center()+320));e.y=clamp(a.y,335,487);fx('slam',e.x,e.y,{life:.5,max:.5});for(const p of alive)if(Math.abs(p.x-e.x)<85&&Math.abs(p.y-e.y)<55&&p.z<35)hurtPlayer(p,20,Math.sign(p.x-e.x)||1);emit('slam');}
        else if(a.kind==='slam'){fx('slam',e.x,e.y,{life:.5,max:.5});state.shake=8;for(const p of alive)if(Math.abs(p.x-e.x)<140&&Math.abs(p.y-e.y)<85&&p.z<35)hurtPlayer(p,20,Math.sign(p.x-e.x)||1);emit('slam');}
        else{fx('swipe',e.x+a.face*48,e.y-37,{face:a.face});for(const p of alive)if((p.x-e.x)*a.face>-15&&(p.x-e.x)*a.face<(e.boss?105:80)&&Math.abs(p.y-e.y)<32&&p.z<38)hurtPlayer(p,e.boss?19:e.kind==='brute'?17:11,a.face);}
      }return;}
      e.face=dx<0?-1:1;
      if(e.boss&&e.superTimer<=0&&e.cooldown===0){enemyAttack(e,target);return;}
      const range=e.kind==='thrower'?260:e.boss?90:58;
      if(Math.abs(dx)<range&&Math.abs(dy)<26&&e.cooldown===0){enemyAttack(e,target);return;}
      const speed=e.kind==='swift'?115:e.kind==='brute'?57:e.boss?(e.enraged?100:78):83;
      const laneOffset=(e.id%3-1)*13,moveY=dy+laneOffset;
      if(Math.abs(dx)>range*.75)e.x+=Math.sign(dx)*speed*dt;
      if(Math.abs(moveY)>5)e.y=clamp(e.y+Math.sign(moveY)*speed*.72*dt,337,484);
      for(const other of state.enemies)if(other!==e&&other.hp>0&&Math.abs(other.x-e.x)<30&&Math.abs(other.y-e.y)<22)e.y=clamp(e.y+(e.id>other.id?1:-1)*24*dt,337,484);
    }
    function tick(dt=STEP){
      if(state.status!=='playing')return;dt=Math.min(dt,.05);state.tick++;state.time+=dt;
      state.transition=Math.max(0,state.transition-dt);state.flash=Math.max(0,state.flash-dt);state.shake=Math.max(0,state.shake-dt*24);state.comboTime=Math.max(0,state.comboTime-dt);if(!state.comboTime)state.combo=0;
      state.effects.forEach(f=>f.life-=dt);state.effects=state.effects.filter(f=>f.life>0).slice(-90);
      if(state.hitstop>0){state.hitstop-=dt;return;}
      state.players.forEach(p=>movePlayer(p,dt));state.enemies.forEach(e=>moveEnemy(e,dt));moveHazards(dt);
      for(const b of state.shots){b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;for(const p of state.players)if(b.life>0&&Math.abs(p.x-b.x)<24&&Math.abs(p.y-b.y)<22&&p.z<34&&hurtPlayer(p,13,Math.sign(b.vx)))b.life=0;}
      state.shots=state.shots.filter(b=>b.life>0&&b.x>state.camera-60&&b.x<state.camera+1050);
      state.enemies=state.enemies.filter(e=>e.hp>0||e.dead>0);
      const alive=state.players.filter(p=>p.lives>0||p.dead>0);if(!alive.length){state.status='gameover';release();emit('gameover');return;}
      const standing=state.players.filter(p=>p.lives>0);if(!standing.length)return;
      const lead=Math.max(...standing.map(p=>p.x)),tail=Math.min(...standing.map(p=>p.x));
      const cameraTarget=Math.min(lead-310,tail-45,state.width-960);state.camera=clamp(Math.max(state.camera,cameraTarget),0,state.width-960);
      if(!state.arena&&state.gate<stage().encounters.length&&lead>center()-330)beginArena();
      if(state.arena&&!state.enemies.some(e=>e.hp>0)){
        if(!lastGate()&&state.gate%3===2&&state.wave===0){state.wave=1;beginArena();fx('word',lead+150,230,{text:'AMBUSH!',life:1.1,max:1.1});return;}
        state.arena=false;state.wave=0;state.gate++;state.hazards=[];state.shots=[];state.players.forEach(p=>p.energy=clamp(p.energy+12,0,100));emit('gate');
        if(state.gate<stage().encounters.length&&state.gate%3===0){state.checkpoint=state.gate;for(const p of state.players)if(p.lives>0){p.hp=clamp(p.hp+45,0,100);p.energy=clamp(p.energy+25,0,100);}fx('word',lead,240,{text:'CHECKPOINT / +45 HEALTH',life:2,max:2,color:'#9fffc9'});emit('pickup');}
        if(state.gate===stage().encounters.length){state.status='clear';release();emit('clear');}
      }
      if(state.inputLog.length>100000)state.inputLog.splice(0,1000);
    }
    return {state,start,input,release,pause,advance,continueRun,tick,drainEvents(){return state.events.splice(0);},hash(){return K.fnv1a(JSON.stringify({seed,state:state.inputLog}));}};
  }
  const api={createEngine,stages,difficulties,STEP,BOSS_RAGE};root.SlopInTime=Object.assign(root.SlopInTime||{},api);if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
