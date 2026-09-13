const test=require('node:test'),assert=require('node:assert/strict');
const {createEngine}=require('../js/engine.js');
function defeated(stage=0){
 const e=createEngine({seed:42});e.start({difficulty:'easy',players:2});
 for(let i=0;i<stage;i++){e.state.status='clear';e.advance();}
 const s=e.state;s.level.spawns=[];s.level.supplies=[];s.level.hazards=[];s.enemies=[];s.waveTime=-999;
 s.players.forEach(p=>p.invincible=99);
 s.boss={id:999,kind:'boss',variant:stage,x:450,y:250,w:130,h:144,hp:1,maxHp:10,originX:450,originY:250,cooldown:99,phase:0,attack:0};
 s.bullets=[{x:0,y:0,w:960,h:540,vx:0,vy:0,ttl:2,team:'player',damage:10,weapon:'P',hits:[]}];
 e.drainEvents();e.tick();assert.equal(s.status,'boss-defeat');return e;
}
const ticks=(e,n)=>{for(let i=0;i<n;i++)e.tick();};
test('every boss freezes the battlefield and timer for its complete explosion before allowing advance',()=>{
 for(let stage=0;stage<8;stage++){
  const e=defeated(stage),s=e.state,clock=s.timeRemaining,score=s.score;
  const frozen=()=>JSON.stringify([s.players,s.enemies,s.bullets,s.pickups,s.grenades,s.grenadeZones,s.camera,s.stageTime,s.tick,s.elapsed]);
  const before=frozen();assert.equal(s.bossDefeat.duration,6.56);
  const events=e.drainEvents();assert.equal(events.filter(x=>x.type==='explosion'&&x.kind==='boss').length,1);assert.ok(!events.some(x=>x.type==='clear'));
  e.input(0,'fire',true);e.input(1,'right',true);e.advance();assert.equal(s.stage,stage);
  ticks(e,393);assert.equal(s.status,'boss-defeat');assert.equal(frozen(),before);assert.equal(s.timeRemaining,clock);assert.equal(s.score,score);
  e.tick();assert.equal(s.status,'clear');assert.equal(s.bossDefeat.elapsed,6.56);assert.equal(s.bullets.length,0);
  assert.equal(e.drainEvents().filter(x=>x.type==='clear').length,1);ticks(e,100);assert.equal(s.score,score);assert.equal(e.drainEvents().length,0);
  e.advance();assert.equal(s.status,stage===7?'victory':'playing');
 }
});
test('pause suspends the explosion clock and resume continues it; a new run discards it',()=>{
 const e=defeated();ticks(e,60);const elapsed=e.state.bossDefeat.elapsed;
 e.pause();assert.equal(e.state.status,'paused');assert.equal(e.state.pausedFrom,'boss-defeat');ticks(e,300);assert.equal(e.state.bossDefeat.elapsed,elapsed);
 e.pause();assert.equal(e.state.status,'boss-defeat');e.tick();assert.ok(e.state.bossDefeat.elapsed>elapsed);
 e.start();assert.equal(e.state.status,'playing');assert.equal(e.state.bossDefeat,null);assert.equal(e.state.pausedFrom,null);
});
