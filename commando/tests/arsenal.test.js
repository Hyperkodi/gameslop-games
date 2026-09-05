'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createEngine,weapons,weaponTier,stageEnemies,difficultyRules}=require('../js/engine.js');
function game(difficulty='normal',players=1){const e=createEngine({seed:42});e.start({difficulty,players});quiet(e);return e;}
function quiet(e){e.state.level.spawns=[];e.state.level.supplies=[];e.state.waveTime=-10000;e.state.enemies=[];e.state.bullets=[];e.state.players.forEach(p=>p.invincible=999);}
function ticks(e,n=1){for(let i=0;i<n;i++)e.tick();}
function pickup(e,type,player=0){const p=e.state.players[player];e.state.pickups.push({x:p.x,y:p.y,w:24,h:24,type,ttl:10});ticks(e);}
function target(id,x=350,y=412){return {id,x,y,w:32,h:34,kind:'turret',hp:50,maxHp:50,cooldown:999,originY:y};}

test('easy and normal auto-holster, swap once per press, and upgrade either carried gun',()=>{
  for(const mode of ['easy','normal']){
    const e=game(mode),p=e.state.players[0];pickup(e,'S');pickup(e,'M');
    assert.equal(p.weapon,'M');assert.equal(p.holstered,'S');
    pickup(e,'S');assert.equal(p.weaponLevels.S,2);assert.equal(p.weapon,'M');
    e.input(0,'swap',true);ticks(e,4);assert.equal(p.weapon,'S');assert.equal(p.holstered,'M');
    assert.equal(weaponTier(p),2);e.input(0,'swap',false);ticks(e);e.input(0,'swap',true);ticks(e);assert.equal(p.weapon,'M');
  }
});
test('every gun has five increasing power tiers and duplicates cap at five',()=>{
  for(const type of Object.keys(weapons)){
    const e=game(),p=e.state.players[0];if(type!=='P')pickup(e,type);
    const damage=[],cooldowns=[];
    for(let tier=1;tier<=5;tier++){
      assert.equal(weaponTier(p),tier);p.cooldown=0;e.state.bullets=[];e.input(0,'fire',true);ticks(e);e.input(0,'fire',false);
      damage.push(e.state.bullets[0].damage);cooldowns.push(p.cooldown);pickup(e,type);
    }
    pickup(e,type);assert.equal(weaponTier(p),5);
    for(let i=1;i<5;i++){assert.ok(damage[i]>damage[i-1]);assert.ok(cooldowns[i]<cooldowns[i-1]);}
  }
});
test('easy and normal remember discarded weapon tiers through death and continues',()=>{
  for(const mode of ['easy','normal']){
    const e=game(mode),p=e.state.players[0];pickup(e,'L');pickup(e,'L');pickup(e,'L');pickup(e,'M');pickup(e,'S');
    assert.notEqual(p.holstered,'L');pickup(e,'L');assert.equal(weaponTier(p),3);
    p.y=700;ticks(e);assert.equal(p.weapon,'P');pickup(e,'L');assert.equal(weaponTier(p),3);
    p.lives=1;p.y=700;ticks(e);assert.equal(e.state.status,'gameover');e.continueRun();quiet(e);pickup(e,'L');assert.equal(weaponTier(p),3);
  }
});
test('hard has one slot, loses discarded upgrades, and rejects swaps and nukes',()=>{
  const e=game('hard'),p=e.state.players[0];pickup(e,'L');pickup(e,'L');assert.equal(weaponTier(p),2);
  pickup(e,'M');assert.equal(p.holstered,null);e.input(0,'swap',true);ticks(e);assert.equal(p.weapon,'M');
  pickup(e,'L');assert.equal(weaponTier(p),1);const t=target(90);e.state.enemies=[t];pickup(e,'N');assert.equal(t.hp,50);assert.equal(e.state.nukeFlash,0);
});
test('cloak breaks pursuit and aimed fire for eight seconds, then tracking resumes',()=>{
  const e=game(),p=e.state.players[0];pickup(e,'C');const drone={...target(91,700,330),kind:'drone',cooldown:0,phase:0};e.state.enemies=[drone];
  ticks(e,400);assert.equal(drone.x,700);assert.equal(e.state.bullets.filter(b=>b.team==='enemy').length,0);assert.ok(p.cloak>1);
  ticks(e,82);assert.equal(p.cloak,0);assert.ok(drone.x<700);assert.ok(e.state.bullets.some(b=>b.team==='enemy'));
});
test('enemies choose the visible co-op partner, while cloak does not stop existing bullets',()=>{
  const e=game('normal',2),[p,q]=e.state.players;p.cloak=8;q.x=500;
  e.state.enemies=[{...target(92,700,300),cooldown:0}];ticks(e);const b=e.state.bullets.find(b=>b.team==='enemy');assert.ok(b.vx<0&&b.vy>0);
  p.invincible=0;e.state.bullets=[{x:p.x+10,y:p.y+10,w:9,h:9,vx:0,vy:0,team:'enemy',ttl:1}];const lives=p.lives;ticks(e);assert.equal(p.lives,lives-1);
});
test('nuke kills visible enemies once, preserves offscreen enemies and bosses, clears enemy fire',()=>{
  const e=game();const visible=target(1,300),offscreen=target(2,1100);e.state.enemies=[visible,offscreen];
  const boss={...target(3,720,310),kind:'boss',phase:0,attack:0,name:'TEST',originX:720,originY:310};e.state.boss=boss;
  e.state.bullets=[{x:500,y:400,w:9,h:9,vx:0,vy:0,team:'enemy',ttl:10}];pickup(e,'N');
  assert.equal(visible.hp,0);assert.equal(offscreen.hp,50);assert.equal(boss.hp,50);assert.equal(e.state.kills,1);assert.equal(e.state.nukeFlash,1.2);
  assert.equal(e.state.bullets.length,0);ticks(e);assert.equal(e.state.kills,1);
});
test('Tesla chains, cryo slows, and plasma explodes across nearby targets',()=>{
  const tesla=game();pickup(tesla,'T');const a=target(1,200),b=target(2,280);tesla.state.enemies=[a,b];tesla.input(0,'fire',true);ticks(tesla,8);assert.ok(a.hp<50&&b.hp<50);
  const cryo=game();pickup(cryo,'I');const cold=target(3,200);cryo.state.enemies=[cold];cryo.input(0,'fire',true);ticks(cryo,8);assert.ok(cold.slow>2);
  const plasma=game();pickup(plasma,'A');const c=target(4,200),d=target(5,225);plasma.state.enemies=[c,d];plasma.input(0,'fire',true);ticks(plasma,10);assert.ok(c.hp<50&&d.hp<50);
});
test('difficulty scales caches and enemy counts, every stage introduces its own themed enemy',()=>{
  const counts={};
  for(const mode of ['easy','normal','hard']){
    const e=createEngine();e.start({difficulty:mode});counts[mode]={guns:0,enemies:0};
    for(let stage=0;stage<8;stage++){
      const s=e.state,all=[...s.level.spawns,...s.enemies],loot=[...s.level.supplies,...s.pickups];
      assert.ok(all.some(t=>t.kind===stageEnemies[stage]),'themed enemy in stage '+(stage+1));
      counts[mode].guns+=loot.filter(p=>weapons[p.type]).length;counts[mode].enemies+=all.length;
      if(mode==='hard')assert.ok(loot.every(p=>p.type!=='N'));
      s.status='clear';e.advance();
    }
  }
  assert.ok(counts.easy.guns>counts.normal.guns&&counts.normal.guns>counts.hard.guns);
  assert.ok(counts.hard.enemies>counts.normal.enemies);
  assert.ok(difficultyRules.easy.dropChance>difficultyRules.normal.dropChance&&difficultyRules.normal.dropChance>difficultyRules.hard.dropChance);
  assert.equal(new Set(stageEnemies).size,8);
});
test('gun levels and holster state are independent between co-op players',()=>{
  const e=game('normal',2);pickup(e,'T');pickup(e,'T');pickup(e,'I',1);
  assert.equal(e.state.players[0].weaponLevels.T,2);assert.equal(e.state.players[1].weaponLevels.T,undefined);assert.equal(e.state.players[1].weapon,'I');
});
