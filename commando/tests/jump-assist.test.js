'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {createEngine} = require('../js/engine.js');

function ticks(engine, count=1) { for (let i=0;i<count;i++) engine.tick(); }
function game(stage=0) {
  const engine=createEngine({seed:42});engine.start();
  for(let i=0;i<stage;i++){engine.state.status='clear';engine.advance();}
  const s=engine.state;
  s.level.spawns=[];s.level.supplies=[];s.level.hazards=[];s.enemies=[];s.bullets=[];s.pickups=[];s.waveTime=-999;
  // Retain bunker cores so movement tests do not accidentally load a new room.
  if(s.level.mode==='base')s.enemies.push({id:999,kind:'core',x:220,y:125,w:42,h:50,hp:10,cooldown:999});
  s.players.forEach(p=>p.invincible=999);engine.drainEvents();return engine;
}
function stand(engine, platform, x=110) {
  const p=engine.state.players[0];engine.release();
  Object.assign(p,{x,y:platform.y-p.h,vy:0,grounded:true,onGround:!!platform.ground});return p;
}
function tap(engine, action) { engine.input(0,action,true);engine.input(0,action,false); }
function events(engine, type) { return engine.state.events.filter(event=>event.type===type); }
const floor={x:0,y:454,w:960,h:86,ground:true};

test('a released jump tap shortly before landing jumps once as soon as feet touch down',()=>{
  const e=game();e.state.level.platforms=[floor];const p=e.state.players[0];
  Object.assign(p,{y:390,vy:180,grounded:false});
  tap(e,'jump');ticks(e,3);assert.equal(events(e,'jump').length,0,'the tap should wait while airborne');
  ticks(e,3);assert.equal(events(e,'jump').length,1);assert.equal(p.grounded,false);assert.ok(p.vy<0);
  ticks(e,80);assert.equal(p.grounded,true);assert.equal(events(e,'jump').length,1,'the consumed tap cannot repeat');
});

test('jump buffering expires if the landing is more than 120 milliseconds away',()=>{
  const e=game();e.state.level.platforms=[floor];const p=e.state.players[0];
  Object.assign(p,{y:280,vy:180,grounded:false});tap(e,'jump');ticks(e,50);
  assert.equal(p.grounded,true);assert.equal(events(e,'jump').length,0);assert.equal(p.jumpBuffer,0);
});

test('walking off a ledge allows a late jump for about 100 milliseconds, then expires',()=>{
  for(const [wait,canJump] of [[4,true],[7,false]]){
    const e=game(),ledge={x:70,y:300,w:130,h:18};e.state.level.platforms=[floor,ledge];
    const p=stand(e,ledge,199);e.input(0,'right',true);ticks(e);e.input(0,'right',false);
    assert.equal(p.grounded,false);assert.ok(p.coyoteTime>0);
    ticks(e,wait);tap(e,'jump');ticks(e);
    assert.equal(events(e,'jump').length,canJump?1:0,'late jump after '+wait+' ticks');
    assert.equal(p.vy<0,canJump);
  }
});

test('jumping consumes coyote time and a second air tap cannot double-jump',()=>{
  const e=game();e.state.level.platforms=[floor];const p=stand(e,floor);
  tap(e,'jump');ticks(e,2);const upwardSpeed=p.vy;tap(e,'jump');ticks(e);
  assert.equal(events(e,'jump').length,1);assert.ok(p.vy>upwardSpeed,'gravity should continue slowing the original jump');
  assert.equal(p.coyoteTime,0);ticks(e,70);assert.equal(p.grounded,true);assert.equal(events(e,'jump').length,1);
});

test('holding jump through repeated landings does not create automatic hops',()=>{
  const e=game();e.state.level.platforms=[floor];const p=stand(e,floor);
  e.input(0,'jump',true);ticks(e,180);assert.equal(p.grounded,true);assert.equal(events(e,'jump').length,1);
  e.input(0,'jump',false);tap(e,'jump');ticks(e);assert.equal(events(e,'jump').length,2,'a fresh tap still jumps');
});

test('dedicated Drop passes one shelf and holding it never drops again on landing',()=>{
  const e=game(),upper={x:70,y:365,w:220,h:18},lower={x:70,y:385,w:220,h:18};
  e.state.level.platforms=[floor,upper,lower];const p=stand(e,upper);
  e.input(0,'drop',true);ticks(e,40);
  assert.equal(p.y,lower.y-p.h);assert.equal(events(e,'drop').length,1);assert.equal(events(e,'jump').length,0);
  assert.equal(p.coyoteTime,0);
  e.input(0,'drop',false);tap(e,'drop');ticks(e,40);
  assert.equal(p.y,floor.y-p.h);assert.equal(events(e,'drop').length,2);
});

test('dedicated Drop on solid ground or a bunker floor never launches a jump',()=>{
  const run=game();run.state.level.platforms=[floor];const p=stand(run,floor);
  tap(run,'drop');ticks(run,15);assert.equal(p.y,floor.y-p.h);assert.equal(p.grounded,true);
  assert.equal(events(run,'jump').length,0);assert.equal(events(run,'drop').length,0);
  const base=game(1),q=base.state.players[0],startY=q.y;tap(base,'drop');ticks(base,15);
  assert.equal(q.y,startY);assert.equal(q.jumpTime,0);assert.equal(events(base,'jump').length,0);
  assert.equal(events(base,'drop').length,0);
});

test('airborne Drop and Down+Jump are not buffered into a jump or a second drop',()=>{
  for(const action of ['drop','downJump']){
    const e=game(),ledge={x:70,y:385,w:220,h:18};e.state.level.platforms=[floor,ledge];const p=e.state.players[0];
    Object.assign(p,{y:325,vy:180,grounded:false});
    tap(e,'jump');ticks(e);assert.ok(p.jumpBuffer>0);
    if(action==='drop')tap(e,'drop');
    else {e.input(0,'down',true);tap(e,'jump');e.input(0,'down',false);}
    ticks(e,35);assert.equal(p.y,ledge.y-p.h);assert.equal(p.grounded,true);
    assert.equal(events(e,'jump').length,0,action);assert.equal(events(e,'drop').length,0,action);
  }
});

test('a deliberate drop consumes pending jump and cannot be undone by coyote time',()=>{
  const e=game(),ledge={x:70,y:365,w:220,h:18};e.state.level.platforms=[floor,ledge];const p=stand(e,ledge);
  tap(e,'jump');tap(e,'drop');ticks(e);assert.ok(p.vy>0);assert.equal(events(e,'drop').length,1);
  tap(e,'jump');ticks(e);assert.ok(p.vy>0);assert.equal(events(e,'jump').length,0);assert.equal(p.coyoteTime,0);
});

test('release and pause clear pending presses, buffered jumps, and coyote grace',()=>{
  for(const reset of ['release','pause']){
    const e=game();e.state.level.platforms=[floor];const p=e.state.players[0];
    Object.assign(p,{y:390,vy:180,grounded:false});tap(e,'jump');ticks(e);assert.ok(p.jumpBuffer>0);
    tap(e,'drop');p.coyoteTime=.1;
    if(reset==='release')e.release();else{e.pause();e.pause();}
    assert.equal(p.jumpBuffer,0);assert.equal(p.coyoteTime,0);assert.equal(p.dropHeld,false);
    assert.equal(p.dropQueued,false);assert.equal(p.jumpQueued,false);
    ticks(e,40);assert.equal(p.grounded,true);assert.equal(events(e,'jump').length,0);assert.equal(events(e,'drop').length,0);
  }
});

test('stage changes, respawns, and continues discard old jump and drop requests',()=>{
  for(const reset of ['stage','respawn','continue']){
    const e=game();e.state.level.platforms=[floor];const p=e.state.players[0];
    tap(e,'jump');tap(e,'drop');p.jumpBuffer=.12;p.coyoteTime=.1;p.dropHeld=true;
    if(reset==='stage'){e.state.status='clear';e.advance();}
    else if(reset==='continue'){e.state.status='gameover';e.continueRun();}
    else {p.y=700;p.grounded=false;ticks(e);}
    assert.equal(p.jumpBuffer,0,reset);assert.equal(p.coyoteTime,0,reset);assert.equal(p.dropHeld,false,reset);
    assert.equal(p.jumpQueued,false,reset);assert.equal(p.dropQueued,false,reset);
    const jumps=events(e,'jump').length,drops=events(e,'drop').length;ticks(e,20);
    assert.equal(events(e,'jump').length,jumps,reset+' must not replay a jump');assert.equal(events(e,'drop').length,drops,reset+' must not replay a drop');
  }
});

test('release and pause preserve an active bunker dodge and its remaining protection',()=>{
  for(const reset of ['release','pause']){
    const e=game(1),s=e.state,p=s.players[0];p.invincible=0;
    tap(e,'jump');ticks(e,5);const remaining=p.jumpTime,lives=p.lives;
    assert.ok(remaining>0);
    if(reset==='release')e.release();
    else {e.pause();ticks(e,30);assert.equal(p.jumpTime,remaining,'the paused dodge must not advance');e.pause();}
    assert.equal(p.jumpTime,remaining,reset+' must preserve an in-progress dodge');
    s.bullets.push({x:p.x,y:p.y,w:30,h:42,vx:0,vy:0,team:'enemy',ttl:1});
    ticks(e);assert.equal(p.lives,lives,'the remaining dodge still protects against enemy fire');
    assert.ok(p.jumpTime<remaining&&p.jumpTime>0,'the dodge resumes its countdown');
    ticks(e,40);assert.equal(p.jumpTime,0);assert.equal(events(e,'jump').length,1,'resuming cannot repeat the dodge');
    s.bullets.push({x:p.x,y:p.y,w:30,h:42,vx:0,vy:0,team:'enemy',ttl:1});
    ticks(e);assert.equal(p.lives,lives-1,'protection expires normally after the dodge');
  }
});

test('changing a stage or bunker chamber and continuing ends the previous dodge',()=>{
  for(const reset of ['stage','room','continue']){
    const e=game(1),s=e.state,p=s.players[0];tap(e,'jump');ticks(e);assert.ok(p.jumpTime>0);
    if(reset==='stage'){s.status='clear';e.advance();}
    else if(reset==='continue'){s.status='gameover';e.continueRun();}
    else {s.enemies=[];ticks(e);assert.equal(s.room,1);}
    assert.equal(p.jumpTime,0,reset+' must clear the previous dodge animation');
    const jumps=events(e,'jump').length;ticks(e);assert.equal(events(e,'jump').length,jumps);
  }
});

test('a fall respawn clears any remaining dodge animation',()=>{
  const e=game(),p=e.state.players[0],lives=p.lives;
  Object.assign(p,{y:700,grounded:false,jumpTime:.4});ticks(e);
  assert.equal(p.lives,lives-1);assert.equal(p.jumpTime,0);
  assert.ok(p.y<700,'the player respawns at the checkpoint');
});
