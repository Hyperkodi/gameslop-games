'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createEngine,weapons}=require('../js/engine.js');
function game(difficulty='normal',stage=0,players=1){
  const e=createEngine({seed:42});e.start({difficulty,players});
  for(let i=0;i<stage;i++){e.state.status='clear';e.advance();}
  return e;
}
function quiet(e){
  const s=e.state;s.level.spawns=[];s.level.supplies=[];s.enemies=[];s.pickups=[];s.waveTime=-100000;
  s.players.forEach(p=>p.invincible=100000);
}
function ticks(e,n=1){for(let i=0;i<n;i++)e.tick();}
function finish(e){
  const s=e.state;quiet(e);
  const boss={id:900,kind:'boss',x:600,y:300,w:90,h:80,hp:1,maxHp:1,originX:600,originY:300,phase:0,attack:0,cooldown:999};
  s.boss=boss;
  // Wide enough to cover the authored bunker boss sway during this tick.
  const shot={x:100,y:220,w:800,h:240,vx:0,vy:0,ttl:1,team:'player',damage:100,weapon:'P',hits:[]};
  s.bullets=[{...shot,hits:[]},{...shot,hits:[]}];ticks(e);assert.equal(s.status,'boss-defeat');ticks(e,394);assert.equal(s.status,'clear');
}

test('each difficulty starts and continues with its own lives; co-op shares a finite credit pool',()=>{
  for(const [difficulty,lives,credits]of [['easy',9,3],['normal',7,3],['hard',5,3],['extra-hard',3,1]]){
    const e=game(difficulty,0,2),s=e.state;
    assert.deepEqual(s.players.map(p=>p.lives),[lives,lives]);assert.equal(s.continues,credits);
    for(let i=0;i<credits;i++){
      s.players.forEach(p=>p.lives=0);s.status='gameover';assert.equal(e.continueRun(),true);
      assert.deepEqual(s.players.map(p=>p.lives),[lives,lives]);assert.equal(s.continues,credits-i-1);
    }
    s.status='gameover';assert.equal(e.continueRun(),false);
    e.start({difficulty});assert.equal(s.continues,credits);assert.equal(s.players[0].lives,lives);
  }
});

test('Extra Hard retains Hard route enemies and authored loot, including the climb caches',()=>{
  for(let stage=0;stage<8;stage++){
    const h=game('hard',stage).state,x=game('extra-hard',stage).state;
    assert.deepEqual(x.level.spawns,h.level.spawns);
    assert.deepEqual(x.level.supplies,h.level.supplies);
    assert.deepEqual(x.pickups,h.pickups);
    assert.deepEqual(x.enemies,h.enemies);
    assert.ok([...x.level.supplies,...x.pickups].every(p=>p.type!=='N'));
    if(stage===2)assert.equal(x.level.supplies.filter(p=>weapons[p.type]).length,1);
  }
});

test('Extra Hard keeps one weapon slot and drops discarded upgrades',()=>{
  const e=game('extra-hard'),s=e.state,p=s.players[0];quiet(e);
  const pickup=type=>{s.pickups=[{x:p.x,y:p.y,w:24,h:24,type,ttl:1}];ticks(e);};
  pickup('L');pickup('L');assert.equal(p.weaponLevels.L,2);
  pickup('M');assert.equal(p.holstered,null);
  e.input(0,'swap',true);ticks(e);assert.equal(p.weapon,'M');
  pickup('L');assert.equal(p.weaponLevels.L,1);
});

test('stage clock counts exact gameplay seconds and freezes outside play',()=>{
  const e=game(),s=e.state;quiet(e);assert.equal(s.timeRemaining,1000);
  ticks(e,60);assert.equal(s.timeRemaining,999);assert.equal(s.stageTicks,60);
  e.pause();ticks(e,90);assert.equal(s.timeRemaining,999);e.pause();ticks(e,60);assert.equal(s.timeRemaining,998);
  for(const status of ['clear','gameover','victory','ready']){s.status=status;ticks(e,90);assert.equal(s.timeRemaining,998);}
});

test('death and bunker chamber transitions retain the clock; stage and continue restart it',()=>{
  const e=game(),s=e.state;quiet(e);ticks(e,90);s.players[0].y=700;ticks(e);
  assert.equal(s.players[0].lives,6);assert.equal(s.stageTicks,91);
  s.status='clear';e.advance();assert.equal(s.timeRemaining,1000);
  ticks(e,60);const before=s.stageTicks;s.enemies=s.enemies.filter(x=>x.kind!=='core');ticks(e);
  assert.equal(s.room,1);assert.equal(s.stageTicks,before+1);assert.ok(s.timeRemaining<999);
  s.status='gameover';assert.equal(e.continueRun(),true);assert.equal(s.timeRemaining,1000);assert.equal(s.stageTicks,0);assert.equal(s.timeBonus,null);
});

test('all eight bosses bank whole remaining seconds once, including the final clear',()=>{
  for(let stage=0;stage<8;stage++){
    const e=game('normal',stage),s=e.state;
    s.stageTicks=60*123+29;s.score=0;finish(e);
    assert.equal(s.timeRemaining,876.5);assert.equal(s.timeBonus,876);assert.equal(s.score,5876);
    assert.equal(e.drainEvents().filter(x=>x.type==='clear'&&x.timeBonus===876).length,1);
    ticks(e,100);assert.equal(s.score,5876);assert.equal(s.timeRemaining,876.5);
    e.advance();assert.equal(s.score,5876);
    if(stage===7)assert.equal(s.status,'victory');else assert.equal(s.timeRemaining,1000);
  }
});

test('a time bonus can cross the ordinary extra-life score threshold',()=>{
  const e=game(),s=e.state;s.score=9500;s.stageTicks=60*100;finish(e);
  assert.equal(s.score,15399);assert.equal(s.players[0].lives,8);assert.equal(s.extraLifeAt,30000);
});

test('timer clamps at zero without death and expired clears award no speed points',()=>{
  const e=game(),s=e.state;quiet(e);s.stageTicks=59999;ticks(e);
  assert.equal(s.timeRemaining,0);ticks(e,60);assert.equal(s.timeRemaining,0);
  assert.equal(s.status,'playing');assert.equal(s.players[0].lives,7);
  finish(e);assert.equal(s.timeBonus,0);assert.equal(s.score,5000);
});
