'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createEngine,STEP}=require('../js/engine.js');
const {createGrenadeSystem,grenadeTypes,grenadeAffinity}=require('../js/grenades.js');
const {audioCueFor}=require('../js/audio.js');
function game(players=1){
 const engine=createEngine({seed:42});engine.start({players});const s=engine.state;
 s.level.spawns=[];s.level.supplies=[];s.level.hazards=[];s.waveTime=-10000;s.enemies=[];
 s.level.platforms=[{x:0,y:454,w:6600,h:86,ground:true}];
 s.players.forEach(p=>Object.assign(p,{x:110,y:412,grounded:true,invincible:10000}));return engine;
}
function ticks(engine,n){for(let i=0;i<n;i++)engine.tick();}
function press(engine,action,player=0){engine.input(player,action,true);engine.input(player,action,false);engine.tick();}
function foe(kind,x=320,y=420,hp=100){return {id:1,kind,x,y,originX:x,originY:y,w:32,h:34,hp,maxHp:hp,cooldown:20,phase:0};}
function harness(enemies){
 const state={status:'playing',enemies,players:[],boss:null,level:{mode:'run',width:960,height:540,platforms:[{x:0,y:454,w:960}]}};
 const events=[],sys=createGrenadeSystem({state,damage(e,n){e.hp-=n;},event(type,data){events.push({type,...data});}});sys.reset();
 const detonate=(type,x=335,y=453)=>{state.grenades.push({id:1,type,x,y,vx:0,vy:0,fuse:.001,age:1,base:false});sys.tick(STEP);};
 return {state,events,sys,detonate};
}
test('quick throwable taps work beside a gun, with one throw per press',()=>{
 const e=game(),s=e.state,p=s.players[0];p.weapon='M';
 e.input(0,'fire',true);press(e,'grenade');
 assert.equal(s.grenades.length,1);assert.ok(s.bullets.some(b=>b.weapon==='M'));assert.equal(p.weapon,'M');
 e.input(0,'grenade',true);ticks(e,400);
 assert.equal(s.events.filter(x=>x.type==='grenadeThrow').length,1,'holding cannot throw again when recharge ends');
 e.input(0,'grenade',false);press(e,'grenade');
 assert.equal(s.events.filter(x=>x.type==='grenadeThrow').length,2);
});
test('type selection cycles all three types without bypassing the shared recharge',()=>{
 const e=game(),p=e.state.players[0];press(e,'grenade');const cd=p.grenadeCooldown;
 press(e,'grenadeNext');assert.equal(p.grenadeType,'incendiary');
 press(e,'grenade');assert.ok(p.grenadeCooldown<cd&&p.grenadeCooldown>5);
 assert.equal(e.state.events.filter(x=>x.type==='grenadeThrow').length,1);
 press(e,'grenadeNext');assert.equal(p.grenadeType,'electric');
 press(e,'grenadeNext');assert.equal(p.grenadeType,'frag');
});
test('frag deals one radial blast, hits nearby targets and leaves distant targets alone',()=>{
 const a=foe('soldier'),b=foe('turret',360),far=foe('soldier',500),h=harness([a,b,far]);
 h.detonate('frag');assert.equal(a.hp,93);assert.equal(b.hp,93);assert.equal(far.hp,100);
 for(let i=0;i<90;i++)h.sys.tick(STEP);
 assert.equal(a.hp,93);assert.equal(h.events.filter(e=>e.type==='grenadeImpact').length,1);
 assert.equal(h.state.grenadeZones.length,0);
});
test('fire has the requested organic vulnerabilities and reduced machine damage',()=>{
 for(const kind of ['soldier','vineMantis','securitySpider']){
  const organic=foe(kind),machine=foe('drone'),h=harness([organic,machine]);h.detonate('incendiary');
  assert.ok(Math.abs((100-organic.hp)/(100-machine.hp)-3)<1e-9,kind);
  assert.equal(grenadeAffinity(organic,'incendiary'),1.8);
 }
});

test('thrown frags detonate on floor or enemy contact and reach enemies beyond the old blast radius',()=>{
 for(const floor of [true,false]){
  const a=foe('turret',420),h=harness([a]);
  h.state.grenades.push({id:1,type:'frag',x:floor?300:425,y:floor?450:425,vx:0,vy:floor?600:0,fuse:1,age:.1,base:false});
  h.sys.tick(STEP);
  assert.equal(a.hp,93);assert.equal(h.state.grenades.length,0);
  assert.equal(h.events.filter(e=>e.type==='grenadeImpact').length,1);
  assert.equal(h.state.grenadeZones[0].radius,145);
 }
});
test('fire persists for four seconds, settles on the floor, then stops damaging',()=>{
 const target=foe('soldier'),h=harness([target]);h.detonate('incendiary',335,440);
 const initial=target.hp;for(let i=0;i<60;i++)h.sys.tick(STEP);
 assert.ok(target.hp<initial);assert.ok(h.state.grenadeZones[0].y<=454&&h.state.grenadeZones[0].y>=452);
 for(let i=0;i<200;i++)h.sys.tick(STEP);assert.equal(h.state.grenadeZones.length,0);
 const final=target.hp;for(let i=0;i<120;i++)h.sys.tick(STEP);assert.equal(target.hp,final);
});
test('floor flames do not keep burning a flyer above their visible height',()=>{
 const flying=foe('riverRay',320,370),h=harness([flying]);h.detonate('incendiary');const blastHP=flying.hp;
 for(let i=0;i<100;i++)h.sys.tick(STEP);assert.equal(flying.hp,blastHP);
});
test('electricity doubles machine damage and applies longer stun than organics',()=>{
 for(const kind of ['drone','turret','reactorOrb','core']){
  const machine=foe(kind),organic=foe('soldier'),h=harness([machine,organic]);h.detonate('electric');
  assert.ok(Math.abs((100-machine.hp)/(100-organic.hp)-2)<1e-9,kind);
  assert.ok(machine.stunned>organic.stunned);assert.equal(machine.stunned,.6);
  const first=machine.hp;for(let i=0;i<30;i++)h.sys.tick(STEP);assert.ok(machine.hp<first,'field must pulse');
 }
});
test('stunned machines cannot move or shoot until their stun wears off',()=>{
 const e=game(),s=e.state,m=foe('drone');m.stunned=.3;m.cooldown=0;s.enemies=[m];
 const before={x:m.x,y:m.y};ticks(e,10);
 assert.equal(m.x,before.x);assert.equal(m.y,before.y);assert.equal(s.bullets.length,0);
 ticks(e,12);assert.ok(s.bullets.some(b=>b.team==='enemy'));assert.notEqual(m.x,before.x);
});
test('bosses take partial electrical weakness and slowdown without a full stun',()=>{
 const boss={...foe('boss'),variant:0,w:130,h:144,attack:0},h=harness([]);h.state.boss=boss;h.detonate('electric',335,445);
 assert.equal(boss.stunned,undefined);assert.ok(boss.disrupted>0);assert.equal(grenadeAffinity(boss,'electric'),1.25);
 const e=game(),s=e.state;s.boss=boss;boss.cooldown=.01;
 e.tick();assert.ok(boss.phase>0);assert.equal(boss.attackTick,s.tick);
});
test('throwing and blast areas never damage the player or co-op partner',()=>{
 const e=game(2),s=e.state;s.players.forEach(p=>p.invincible=0);
 const lives=s.players.map(p=>p.lives);
 for(const type of Object.keys(grenadeTypes)){
  s.grenades.push({id:50,type,x:125,y:435,vx:0,vy:0,fuse:.001,age:1,base:false});ticks(e,70);
 }
 assert.deepEqual(s.players.map(p=>p.lives),lives);
});
test('pause freezes fuse, area lifetime, recharge and pending input is released',()=>{
 const e=game(),s=e.state;press(e,'grenade');
 s.grenadeZones.push({id:2,type:'electric',x:400,y:430,radius:108,duration:3.5,ttl:3,pulseIn:.4,base:false,vy:0});
 const before=JSON.stringify([s.grenades,s.grenadeZones,s.players[0].grenadeCooldown]);
 e.input(0,'grenadeNext',true);e.pause();ticks(e,500);
 assert.equal(JSON.stringify([s.grenades,s.grenadeZones,s.players[0].grenadeCooldown]),before);
 e.pause();e.tick();assert.equal(s.players[0].grenadeType,'frag');
});
test('co-op types and recharge are independent; stage transitions clear old ordnance',()=>{
 const e=game(2),s=e.state;press(e,'grenadeNext',1);press(e,'grenade',0);
 assert.equal(s.players[0].grenadeType,'frag');assert.equal(s.players[1].grenadeType,'incendiary');assert.equal(s.players[1].grenadeCooldown,0);
 press(e,'grenade',1);assert.equal(s.grenades.length,2);
 s.status='clear';e.advance();assert.equal(s.grenades.length,0);assert.equal(s.grenadeZones.length,0);
 assert.ok(s.players.every(p=>p.grenadeCooldown===0));
});
test('overhead throws travel along aim and stay inside the room',()=>{
 const e=game(),s=e.state;s.status='clear';e.advance();s.enemies=[];s.level.spawns=[];s.level.supplies=[];s.waveTime=-1000;
 // Keep a core so the empty-room progression cannot reset the projectile.
 s.enemies=[foe('core',700,125)];const p=s.players[0],y=p.y;press(e,'grenade');ticks(e,20);
 const g=s.grenades[0];assert.equal(g.base,true);assert.ok(g.y<y);assert.ok(g.y>=110);
});
test('grenade kills score once and boss defeat clears all active zones',()=>{
 const e=game(),s=e.state;s.enemies=[foe('soldier',320,420,1)];
 s.grenades.push({id:1,type:'incendiary',x:335,y:453,vx:0,vy:0,fuse:.001,age:1,base:false});e.tick();
 assert.equal(s.kills,1);ticks(e,100);assert.equal(s.kills,1);
 s.boss={...foe('boss',320,320,.1),variant:0,w:130,h:144,attack:0};
 s.grenades.push({id:2,type:'electric',x:335,y:430,vx:0,vy:0,fuse:.001,age:1,base:false});e.tick();
 assert.equal(s.status,'clear');assert.equal(s.kills,2);assert.equal(s.grenadeZones.length,0);assert.equal(s.grenades.length,0);
});
test('grenade input replays deterministically and has distinct sound cues',()=>{
 const run=()=>{const e=game();for(let i=0;i<500;i++){if(i===0||i===390)press(e,'grenade');if(i===200)press(e,'grenadeNext');e.tick();}return JSON.stringify(e.state);};
 assert.equal(run(),run());
 for(const type of Object.keys(grenadeTypes))assert.equal(audioCueFor({type:'grenadeImpact',grenade:type}),'grenade:'+type);
 assert.equal(audioCueFor({type:'grenadePulse'}),'grenadePulse');
});
