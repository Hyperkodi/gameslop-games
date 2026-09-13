'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createEngine,weapons,difficultyRules}=require('../js/engine.js');
function game(mode='normal',players=1){const e=createEngine({seed:42});e.start({difficulty:mode,players});e.state.level.spawns=[];e.state.level.supplies=[];e.state.waveTime=-999;e.state.enemies=[];e.state.pickups=[];return e;}
function strike(e,p,clearProtection=true){if(clearProtection)p.invincible=0;e.state.bullets=[{x:p.x+8,y:p.y+15,w:9,h:9,vx:0,vy:0,ttl:1,team:'enemy'}];e.tick();}
test('each difficulty takes the specified number of hits per life and respawns fully healed',()=>{
 for(const [mode,hits]of [['easy',3],['normal',2],['hard',1],['extra-hard',1]]){
  const e=game(mode),p=e.state.players[0],lives=p.lives;
  assert.equal(p.hp,hits);assert.equal(p.maxHp,hits);
  p.weapon='L';p.weaponLevels.L=2;
  for(let i=1;i<=hits;i++){
   const x=p.x;strike(e,p);
   assert.equal(p.lives,lives-(i===hits?1:0));
   assert.equal(p.hp,i===hits?hits:hits-i);
   if(i<hits){assert.equal(p.weapon,'L');assert.equal(p.x,x);assert.ok(p.invincible>1);}
  }
  assert.equal(p.weapon,'P');assert.equal(e.state.events.filter(x=>x.type==='death').length,1);
 }
});
test('hit protection, barrier, pause, co-op, stage transitions and continues preserve health rules',()=>{
 const e=game('easy',2),[p,q]=e.state.players;
 strike(e,p);assert.equal(p.hp,2);assert.equal(q.hp,3);
 strike(e,p,false);assert.equal(p.hp,2);
 p.shield=2;strike(e,p);assert.equal(p.hp,2);p.shield=0;
 e.pause();const protection=p.invincible;e.tick();assert.equal(p.invincible,protection);assert.equal(p.hp,2);e.pause();
 e.state.status='clear';e.advance();assert.equal(p.hp,2);assert.equal(q.hp,3);
 e.state.status='gameover';p.hp=0;q.hp=0;p.lives=0;q.lives=0;
 assert.equal(e.continueRun(),true);assert.equal(p.hp,3);assert.equal(q.hp,3);assert.equal(p.lives,9);
});
test('pits still cost one life regardless of remaining health or barrier',()=>{
 const e=game('easy'),p=e.state.players[0];p.shield=10;p.y=800;e.tick();
 assert.equal(p.lives,8);assert.equal(p.hp,3);assert.ok(p.y<540);
});
test('all eleven guns increase modestly at every tier, including splash and firing cadence',()=>{
 for(const [type,w]of Object.entries(weapons))for(let tier=1;tier<=5;tier++){
  const e=game(),p=e.state.players[0];p.weapon=type;p.weaponLevels[type]=tier;
  e.input(0,'fire',true);e.tick();const b=e.state.bullets.find(b=>b.team==='player');
  assert.ok(Math.abs(b.damage/w.damage-(1+(tier-1)*.1))<1e-9);
  assert.ok(Math.abs(p.cooldown/w.delay-(1-(tier-1)*.02))<1e-9);
  if(w.splashDamage)assert.ok(Math.abs(b.splashDamage/w.splashDamage-(1+(tier-1)*.1))<1e-9);
  assert.equal(b.chain,w.chain||0);
  assert.ok((b.damage/w.damage)/(p.cooldown/w.delay)<1.53,'tier five stays within a modest overall increase');
 }
});
test('equipped and holstered upgrades identify the correct gun and stop at level five',()=>{
 const e=game(),p=e.state.players[0];p.weapon='M';p.weaponLevels.M=1;p.holstered='L';p.weaponLevels.L=1;
 for(let i=2;i<=6;i++){
  e.state.pickups=[{type:'L',x:p.x,y:p.y,w:24,h:24,ttl:10}];e.tick();
  assert.equal(p.weapon,'M');assert.equal(p.weaponLevels.L,Math.min(i,5));
  assert.match(p.weaponNotice,/LASER RIFLE LV [2-5]\/5/);assert.ok(p.weaponNoticeTime>2);
 }
 assert.match(p.weaponNotice,/MAX POWER/);
});
