'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createEngine}=require('../js/engine.js');
function encounter(index,difficulty,boss){
 const e=createEngine({seed:42});e.start({difficulty});
 for(let i=0;i<index;i++){e.state.status='clear';e.advance();}
 const s=e.state;s.players.forEach(p=>p.invincible=10000);s.pickups=[];s.level.supplies=[];
 if(boss){
  for(let i=0;i<3;i++){s.enemies=[];e.tick();}
  assert.ok(s.boss);assert.equal(s.room,2);
 }
 s.waveTime=0;
 // Retain a core in ordinary rooms so the room cannot advance during measurement.
 s.enemies=boss?[]:s.enemies.filter(x=>x.kind==='core');
 return e;
}
function arrivals(e,frames){let count=0;for(let i=0;i<frames;i++){e.tick();count+=e.state.enemies.filter(x=>x.kind!=='core').length;e.state.enemies=e.state.enemies.filter(x=>x.kind==='core');e.state.bullets=[];}return count;}
test('level 2 boss reinforcements arrive at half the earlier-room rate in every difficulty',()=>{
 for(const mode of ['easy','normal','hard','extra-hard']){
  const ordinary=arrivals(encounter(1,mode,false),10800),boss=arrivals(encounter(1,mode,true),10800);
  assert.ok(Math.abs(boss-ordinary/2)<=1,`${mode}: ${boss} boss arrivals vs ${ordinary} ordinary arrivals`);
 }
});
test('level 4 boss reinforcement rate remains the same as its ordinary rooms',()=>{
 for(const mode of ['easy','normal','hard','extra-hard'])assert.equal(arrivals(encounter(3,mode,true),3600),arrivals(encounter(3,mode,false),3600));
});
test('pausing freezes the level 2 boss reinforcement timer and player protection',()=>{
 const e=encounter(1,'normal',true),s=e.state;e.tick();const before=s.waveTime;
 e.pause();for(let i=0;i<600;i++)e.tick();assert.equal(s.waveTime,before);assert.equal(s.enemies.length,0);
 e.pause();assert.ok(arrivals(e,1200)>0);
});
