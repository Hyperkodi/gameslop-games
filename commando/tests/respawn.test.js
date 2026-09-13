'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createEngine,safeRespawnPoint,hit}=require('../js/engine.js');
const {buildLevel,levels}=require('../js/levels.js');

function footing(level,point,p) {
  assert.ok(point,'a safe point exists in '+level.name);
  assert.ok(level.platforms.some(f=>point.x>=f.x&&point.x+p.w<=f.x+f.w&&Math.abs(point.y+p.h-f.y)<.001),'whole body supported');
  for(const hazard of level.hazards) assert.equal(hit({...point,w:p.w,h:p.h},hazard),false,'outside even inactive hazards');
}
function game(stage,players=1) {
  const e=createEngine({seed:42});e.start({players,difficulty:'normal'});
  for(let i=0;i<stage;i++){e.state.status='clear';e.advance();}
  e.state.level.spawns=[];e.state.level.supplies=[];e.state.waveTime=-1e9;
  return e;
}
function quietTick(e) {
  e.state.enemies=e.state.enemies.filter(enemy=>enemy.kind==='core');
  e.state.enemies.forEach(enemy=>enemy.cooldown=1e9);e.state.bullets=[];e.state.pickups=[];
  e.tick();
}

test('every horizontal camera position has safe visible respawns for both players across all five run levels',()=>{
  let positions=0;
  for(let stage=0;stage<levels.length;stage++) {
    const l=buildLevel(stage);if(l.mode!=='run')continue;
    for(let x=0;x<=l.width-960;x++) for(let id=0;id<2;id++) {
      const p={id,w:30,h:42};
      for(const checkpoint of [{x:110,y:410},{x:Math.max(110,x-90),y:410},{x:x+80,y:410}]) {
        const point=safeRespawnPoint(l,{x,y:0},checkpoint,p);footing(l,point,p);
        assert.ok(point.x>=x&&point.x+p.w<=x+960,'respawn inside current camera');
        positions++;
      }
    }
  }
  assert.equal(positions,169230);
});

test('each of the 25 pits costs one life and cannot cause idle repeat deaths at either camera edge in solo or co-op',()=>{
  let cases=0;
  for(let stage=0;stage<levels.length;stage++) for(const [a,b] of levels[stage].gaps||[]) {
    for(const cameraX of [a-100,a+5,(a+b)/2,b-5]) for(const id of [0,1]) {
      const e=game(stage,id+1),s=e.state,p=s.players[id];
      s.camera.x=cameraX;s.checkpoint={x:a-42,y:410};
      if(id){const other=s.players[0],point=safeRespawnPoint(s.level,s.camera,s.checkpoint,other);Object.assign(other,point,{vy:0,held:{},invincible:999});}
      Object.assign(p,{x:cameraX+100,y:s.level.height+80,vy:500,vx:225,prone:true,held:{right:true},jumpBuffer:.1});
      quietTick(e);assert.equal(p.lives,6);footing(s.level,p,p);
      assert.equal(p.vx,0);assert.equal(p.vy,0);assert.deepEqual(p.held,{});
      const respawn={x:p.x,y:p.y};
      for(let t=0;t<300;t++)quietTick(e);
      assert.equal(p.lives,6,`${s.level.name} pit ${a}, camera ${cameraX}, player ${id}`);
      assert.equal(p.x,respawn.x);assert.equal(p.y,respawn.y);cases++;
    }
  }
  assert.equal(cases,200);
});

test('every ascent platform supports either player even with a checkpoint on its far edge',()=>{
  const l=buildLevel(2);
  for(const floor of l.platforms) for(const id of [0,1]) {
    const p={id,w:30,h:42},checkpoint={x:floor.x+floor.w-10,y:floor.y-p.h};
    const point=safeRespawnPoint(l,{x:0,y:Math.max(0,checkpoint.y-235)},checkpoint,p);
    footing(l,point,p);assert.equal(point.y,checkpoint.y);
  }
});

test('real ascent deaths restore the saved ledge and bring it back into view without repeated falls',()=>{
  const l=buildLevel(2);
  for(const floor of l.platforms) {
    const e=game(2),s=e.state,p=s.players[0];
    s.checkpoint={x:floor.x+floor.w-10,y:floor.y-p.h};s.camera.y=Math.max(0,floor.y-540);
    Object.assign(p,{y:l.height+80,vy:400});quietTick(e);
    assert.equal(p.lives,6);footing(s.level,p,p);
    assert.ok(p.y>=s.camera.y&&p.y+p.h<=s.camera.y+540);
    for(let i=0;i<300;i++)quietTick(e);
    assert.equal(p.lives,6);assert.equal(p.y,floor.y-p.h);
  }
});

test('all six bunker rooms retain safe respawns for both players',()=>{
  for(const stage of [1,3]) for(const room of [0,1,2]) for(const id of [0,1]) {
    const e=game(stage,2),s=e.state;
    for(let i=0;i<room;i++){s.enemies=[];quietTick(e);}
    const p=s.players[id];p.hp=1;p.invincible=0;
    // A contact hit uses the same respawn path as enemy bullets.
    s.level.hazards=[{x:p.x,y:p.y,w:p.w,h:p.h,phase:180}];e.tick();s.level.hazards=[];
    assert.equal(p.lives,6);assert.equal(p.x,390+id*80);assert.equal(p.y,420);
    for(let i=0;i<300;i++)quietTick(e);
    assert.equal(p.lives,6);assert.equal(s.room,room);
  }
});

test('camera relocates only when the entire current view has no safe floor',()=>{
  const e=game(0),s=e.state,p=s.players[0];
  s.level.platforms=[{x:1200,y:454,w:400,h:86,ground:true}];s.camera.x=0;s.checkpoint={x:110,y:410};
  p.y=700;quietTick(e);footing(s.level,p,p);
  assert.ok(s.camera.x>0);assert.ok(p.x>=s.camera.x&&p.x+p.w<=s.camera.x+960);
  for(let i=0;i<300;i++)quietTick(e);assert.equal(p.lives,6);
});
