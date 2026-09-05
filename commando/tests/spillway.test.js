'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {createEngine, weapons} = require('../js/engine.js');
function ticks(e, count=1) { for(let i=0;i<count;i++) e.tick(); }
function quiet(e) {
  e.state.level.spawns=[];e.state.level.supplies=[];e.state.enemies=[];e.state.pickups=[];e.state.bullets=[];e.state.waveTime=-999;
  e.state.players.forEach(p=>p.invincible=999);
}
function game(stage=2, difficulty='normal') {
  const e=createEngine({seed:42});e.start({difficulty});
  for(let i=0;i<stage;i++){e.state.status='clear';e.advance();} return e;
}
function stand(e, platform, x) {
  const p=e.state.players[0];Object.assign(p,{x,y:platform.y-p.h,grounded:true,onGround:!!platform.ground,vy:0,jumpHeld:false,held:{}});
  e.state.camera.y=Math.max(0,Math.min(e.state.level.height-540,p.y-235));return p;
}
test('down+jump catches a close lower shelf, and holding the combo drops only once',()=>{
  const e=game(0);quiet(e);
  e.state.level.platforms=[{x:0,y:454,w:960,h:86,ground:true},{x:70,y:365,w:220,h:18},{x:70,y:385,w:220,h:18}];
  const p=stand(e,e.state.level.platforms[1],110);
  p.onGround=true; // The actual supporting ledge determines whether a drop is allowed.
  e.input(0,'down',true);e.input(0,'jump',true);ticks(e,40);
  assert.equal(p.y,385-p.h);assert.equal(p.grounded,true);
  assert.equal(e.drainEvents().filter(event=>event.type==='drop').length,1);
  e.input(0,'jump',false);ticks(e);e.input(0,'jump',true);ticks(e,40);
  assert.equal(p.y,454-p.h);assert.equal(p.lives,3);
});
test('down+jump cannot drop through the solid floor',()=>{
  const e=game(0);quiet(e);const floor=e.state.level.platforms.find(p=>p.ground);const p=stand(e,floor,110);
  e.input(0,'down',true);e.input(0,'jump',true);ticks(e);
  assert.ok(p.y<floor.y-p.h);ticks(e,70);assert.equal(p.y,floor.y-p.h);assert.equal(p.lives,3);
});
test('the climb camera follows a retreat without losing a life or rewinding the checkpoint',()=>{
  const e=game();quiet(e);
  e.state.level.platforms=Array.from({length:12},(_,i)=>({x:0,y:150+i*95,w:960,h:18}));
  const p=stand(e,e.state.level.platforms[0],100),startLives=p.lives;
  ticks(e);const checkpoint={...e.state.checkpoint};
  for(let i=1;i<10;i++) {
    e.input(0,'down',true);e.input(0,'jump',true);ticks(e,35);
    assert.equal(p.y,e.state.level.platforms[i].y-p.h);
    e.input(0,'jump',false);ticks(e);
  }
  assert.ok(e.state.camera.y>500);assert.equal(p.lives,startLives);assert.deepEqual(e.state.checkpoint,checkpoint);
});
test('Spillway guns are fewer, varied, optional, and scaled to difficulty',()=>{
  for(const [mode,count] of [['easy',5],['normal',3],['hard',1]]) {
    const s=game(2,mode).state, guns=s.level.supplies.filter(p=>weapons[p.type]);
    assert.equal(guns.length,count,mode+' gun caches');assert.ok(guns.every(p=>p.optional&&p.type!=='G'));
    assert.equal(new Set(guns.map(p=>p.type)).size,count);
    for(const gun of guns) assert.ok(s.level.platforms.some(p=>p.optional&&gun.x>=p.x&&gun.x+24<=p.x+p.w&&gun.y<p.y&&gun.y+55>p.y));
  }
});
test('the boss crest allows a safe drop and return across its entire width',()=>{
  for(const x of [0,150,450,750,929]) {
    const e=game();quiet(e);const crest=e.state.level.platforms.reduce((a,b)=>a.y<b.y?a:b);
    const p=stand(e,crest,x),lives=p.lives;
    e.input(0,'down',true);e.input(0,'jump',true);ticks(e,40);
    assert.equal(p.y,245-p.h,'retreat shelf at x='+x);assert.equal(p.lives,lives);
    e.input(0,'down',false);e.input(0,'jump',false);ticks(e);e.input(0,'jump',true);ticks(e,50);
    assert.equal(p.y,crest.y-p.h,'return to crest at x='+x);assert.equal(p.lives,lives);
  }
});
