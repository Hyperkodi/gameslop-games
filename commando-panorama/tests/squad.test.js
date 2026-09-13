'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createEngine}=require('../js/engine.js');
const {createSupportSystem,allySpecs,recruitedCount,reinforcementCount}=require('../js/support.js');
function game(){const e=createEngine({seed:42});e.start({difficulty:'easy',players:2});return e;}
function stage(e,n){while(e.state.stage<n){e.state.status='clear';e.advance();}e.state.players.forEach(p=>p.invincible=99999);return e.state;}
function quiet(s){s.level.spawns=[];s.level.supplies=[];s.level.hazards=[];s.enemies=[];s.waveTime=-99999;s.boss=null;}
function join(e,id){const s=e.state,npc=s.recruits.find(a=>a.allyId===id);assert.ok(npc,id);s.players.forEach(p=>Object.assign(p,{x:npc.x,y:npc.y,vx:0,vy:0,grounded:true}));e.tick();assert.ok(s[id+'Recruited']);}

test('all three allies join at the authored halfway points, persist through continues and final level, reset on new run',()=>{
 const e=game();
 for(const [i,spec] of allySpecs.entries()){
  const s=stage(e,spec.stage);const npc=s.recruits[0];
  assert.equal(npc.allyId,spec.id);assert.ok(s.level.platforms.some(p=>Math.abs(p.y-npc.y-42)<1&&npc.x>=p.x&&npc.x+30<=p.x+p.w));
  if(spec.stage>2)assert.ok(Math.abs(npc.x-s.level.width/2)<150);
  quiet(s);join(e,spec.id);assert.equal(s.companions.length,i+1);assert.equal(recruitedCount(s),i+1);
  assert.equal(s.companions.at(-1).weapon,spec.weapon);assert.equal(s.recruits.length,0);
  for(let k=0;k<8;k++)e.tick();assert.equal(s.events.filter(x=>x.type==='companionJoined'&&x.ally===spec.id).length,1);
  s.status='gameover';e.continueRun();assert.equal(s.companions.length,i+1);assert.equal(s.recruits.length,0);
 }
 stage(e,7);assert.deepEqual(e.state.companions.map(a=>a.allyId),['pawns','wojak','sloppy']);
 e.start();assert.equal(recruitedCount(e.state),0);assert.equal(e.state.companions.length,0);
});

test('airborne players cannot miss the halfway recruitment trigger',()=>{
 const e=game(),s=stage(e,4);quiet(s);const npc=s.recruits[0];
 Object.assign(s.players[0],{x:npc.x-100,y:412});Object.assign(s.players[1],{x:npc.x+50,y:230,vy:-100});e.tick();assert.equal(s.wojakRecruited,true);
});

test('an original 20-enemy route becomes 24 only after Pawns joins, with all extra spawns ahead',()=>{
 const e=game(),s=stage(e,2);quiet(s);
 const base=Array.from({length:20},(_,i)=>({kind:'drone',x:350,y:2600-i*115}));
 s.routeBaseSpawns=base;s.level.spawns=base.slice();s.reinforcementsAdded=0;
 e.tick();assert.equal(s.level.spawns.length,20);join(e,'pawns');
 assert.equal(s.level.spawns.length,24);const extras=s.level.spawns.filter(x=>x.squadExtra);
 assert.equal(extras.length,4);assert.ok(extras.every(x=>x.y<s.players[0].y-100));
 assert.equal(reinforcementCount(20,2),8);assert.equal(reinforcementCount(20,3),12);
});

test('future route totals and recruitment increments use the original count, never multiply already-added enemies',()=>{
 const e=game();stage(e,2);quiet(e.state);join(e,'pawns');
 const s=stage(e,4),base=s.routeBaseSpawns.length;
 assert.equal(s.level.spawns.length,base+reinforcementCount(base,1));
 const existing=new Set(s.level.spawns);s.waveTime=-99999;s.enemies=[];s.level.hazards=[];join(e,'wojak');
 assert.equal(s.level.spawns.length,base+reinforcementCount(base,2));
 assert.ok(s.level.spawns.filter(x=>!existing.has(x)).every(x=>x.x>s.players[0].x+150));
 const total=s.level.spawns.length;for(let i=0;i<5;i++)e.tick();assert.equal(s.level.spawns.length,total);
 stage(e,6);s.waveTime=-99999;s.enemies=[];s.level.hazards=[];join(e,'sloppy');
 assert.equal(s.level.spawns.length,s.routeBaseSpawns.length+reinforcementCount(s.routeBaseSpawns.length,3));
});

test('recurring waves add exactly one extra per five waves per ally, without pre-unlock spawns',()=>{
 for(let count=0;count<=3;count++){
  const e=game(),s=e.state;quiet(s);s.level.platforms=[{x:0,y:454,w:6600,ground:true}];
  allySpecs.slice(0,count).forEach(a=>{s[a.id+'Recruited']=true;});
  let total=0;
  for(let n=0;n<5;n++){s.enemies=[];s.waveTime=99;e.tick();total+=s.enemies.length;}
  assert.equal(total,5+count);
 }
});

test('allies use different weapons, real projectiles, no friendly fire, and finite flame range',()=>{
 const e=game(),s=e.state;quiet(s);s.level.platforms=[{x:0,y:454,w:6600,ground:true}];
 allySpecs.forEach(a=>{s[a.id+'Recruited']=true;});createSupportSystem({state:s,event(){}}).transition();
 s.players.forEach(p=>Object.assign(p,{x:340,y:412,grounded:true}));
 s.companions.forEach(a=>Object.assign(a,{x:300,y:412,grounded:true,cooldown:0}));
 s.enemies=[{id:999,kind:'turret',x:430,y:420,w:40,h:34,hp:100,maxHp:100,cooldown:999,phase:0}];
 const lives=s.players.map(p=>p.lives);e.tick();
 for(const spec of allySpecs){const b=s.bullets.find(b=>b.source===spec.id);assert.ok(b,spec.id);assert.equal(b.weapon,spec.weapon);assert.equal(b.team,'player');}
 assert.equal(s.bullets.find(b=>b.source==='wojak').pierce,true);
 assert.ok(s.bullets.find(b=>b.source==='sloppy').ttl<=.5);
 for(let i=0;i<60;i++)e.tick();assert.ok(s.enemies[0].hp<100);assert.deepEqual(s.players.map(p=>p.lives),lives);
 const positions=s.companions.map(a=>[a.x,a.y]);e.pause();for(let i=0;i<60;i++)e.tick();assert.deepEqual(s.companions.map(a=>[a.x,a.y]),positions);
});

test('spawned hostile Wojaks are replaced by existing Bundle Cat troops',()=>{
 const e=game(),s=e.state;quiet(s);s.level.spawns=[{kind:'soldier',x:500,y:420}];e.tick();
 assert.equal(s.enemies.length,1);assert.equal(s.enemies[0].kind,'securitySpider');
 const skin=require('../skin/gameslop/skin.json');assert.ok(Object.values(skin.cast.enemies).every(m=>m.name!=='Wojak'));
});

test('all squad members recover near the player after a distant death/checkpoint return',()=>{
 const e=game(),s=e.state;quiet(s);s.level.platforms=[{x:0,y:454,w:6600,ground:true}];
 allySpecs.forEach(a=>s[a.id+'Recruited']=true);createSupportSystem({state:s,event(){}}).transition();
 s.players.forEach(p=>Object.assign(p,{x:150,y:412,grounded:true}));
 s.companions.forEach(a=>{a.x=3000;a.y=412;});e.tick();
 assert.ok(s.companions.every(a=>a.x<400&&a.grounded));assert.equal(s.companions.length,3);
});
