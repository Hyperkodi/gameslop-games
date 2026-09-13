'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createEngine,difficultyRules}=require('../js/engine.js');
function stage(index,difficulty='normal',players=1){
  const e=createEngine({seed:42});e.start({difficulty,players});
  for(let i=0;i<index;i++){e.state.status='clear';e.advance();}
  e.state.players.forEach(p=>p.invincible=10000);e.state.pickups=[];return e;
}
function quiet(e){e.state.waveTime=-10000;e.state.level.spawns=[];e.state.level.supplies=[];}
test('bunker retains all eight aim directions after neutral, for movement alone and continuous fire',()=>{
  for(const actions of [['right'],['left'],['up'],['down'],['up','right'],['down','right'],['up','left'],['down','left']]){
    for(const firing of [true,false]){
      const e=stage(1);quiet(e);const p=e.state.players[0];
      if(firing)e.input(0,'fire',true);
      actions.forEach(a=>e.input(0,a,true));e.tick();const aim=[p.aimX,p.aimY],pos=[p.x,p.y];
      actions.forEach(a=>e.input(0,a,false));
      for(let i=0;i<30;i++)e.tick();
      assert.deepEqual([p.aimX,p.aimY],aim);assert.deepEqual([p.x,p.y],pos);
      e.state.bullets=[];p.cooldown=0;e.input(0,'fire',true);e.tick();
      const bullet=e.state.bullets.find(b=>b.team==='player');assert.ok(bullet);
      const length=Math.hypot(bullet.vx,bullet.vy);
      assert.ok(Math.abs(bullet.vx/length-aim[0])<1e-9);
      assert.ok(Math.abs(bullet.vy/length-aim[1])<1e-9);
    }
  }
});
test('side-view aim persists through release and pause, and co-op players remember independent directions',()=>{
  const e=stage(0,'normal',2);quiet(e);
  e.input(0,'left',true);e.input(0,'up',true);e.input(1,'right',true);e.tick();
  e.release();e.pause();e.pause();
  for(const p of e.state.players){p.cooldown=0;e.input(p.id,'fire',true);}
  e.tick();
  assert.ok(e.state.players[0].aimX<0&&e.state.players[0].aimY<0);
  assert.equal(e.state.players[0].face,-1);assert.equal(e.state.players[1].aimX,1);assert.equal(e.state.players[1].aimY,0);
  const shots=e.state.bullets.filter(b=>b.team==='player');
  assert.ok(shots.some(b=>b.vx<0&&b.vy<0));assert.ok(shots.some(b=>b.vx>0&&b.vy===0));
});
test('level 2 reinforcement arrivals are reduced across all difficulties without changing level 4',()=>{
  function count(index,difficulty,legacy=false){
    const e=stage(index,difficulty);if(legacy)delete e.state.level.waveIntervalScale;
    let arrivals=0;
    for(let i=0;i<3600;i++){
      e.tick();arrivals+=e.state.enemies.filter(x=>x.kind!=='core').length;
      e.state.enemies=e.state.enemies.filter(x=>x.kind==='core');e.state.bullets=[];
    }
    return arrivals;
  }
  for(const difficulty of ['easy','normal','hard']){
    const original=count(1,difficulty,true),reduced=count(1,difficulty);
    assert.ok(reduced/original>.65&&reduced/original<.8,`${difficulty}: ${reduced}/${original}`);
    assert.equal(count(3,difficulty),count(3,difficulty,true));
  }
});
test('level 2 enemy cap blocks another arrival but resumes when a slot opens',()=>{
  for(const difficulty of ['easy','normal','hard']){
    const e=stage(1,difficulty),cap=Math.ceil(difficultyRules[difficulty].enemyLimit*.75);
    while(e.state.enemies.length<cap)e.state.enemies.push({id:900+e.state.enemies.length,kind:'core',x:100,y:125,w:42,h:50,hp:100,maxHp:100,cooldown:999});
    e.state.waveTime=100;e.tick();assert.equal(e.state.enemies.length,cap);
    e.state.enemies.pop();e.tick();assert.equal(e.state.enemies.length,cap);
    assert.ok(e.state.enemies.some(x=>x.kind!=='core'));
  }
});
