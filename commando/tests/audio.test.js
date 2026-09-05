'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {createEngine, weapons} = require('../js/engine.js');
const {audioTracks, audioSamples, audioCueFor, createAudio} = require('../js/audio.js');
function game() {
  const e = createEngine({seed:42}); e.start({difficulty:'easy',players:2});
  e.state.level.spawns = []; e.state.level.supplies = []; e.state.waveTime = -999;
  e.state.enemies = []; e.drainEvents(); return e;
}
test('every mapped soundtrack and effect recording exists', () => {
  assert.equal(audioTracks.length, 8); assert.equal(audioTracks[2], 'Foundry.mp3');
  for (const file of audioTracks.filter(Boolean)) assert.ok(fs.statSync(path.join(__dirname,'../Soundtrack',file)).size > 0);
  for (const file of Object.values(audioSamples)) assert.ok(fs.statSync(path.join(__dirname,'../Sound Effects',file)).size > 0);
});
test('each weapon emits one firing cue per trigger, including both co-op players', () => {
  const e = game();
  for (const weapon of Object.keys(weapons)) {
    for (const p of e.state.players) { p.weapon = weapon; p.cooldown = 0; e.input(p.id,'fire',true); }
    e.tick();
    const events = e.drainEvents().filter(event => event.type === 'shot');
    assert.deepEqual(events.map(event => [event.weapon,event.player]), [[weapon,0],[weapon,1]]);
    assert.deepEqual(events.map(audioCueFor), ['shot:'+weapon,'shot:'+weapon]);
    e.state.bullets = [];
  }
});
test('grenades and rockets emit a single detonation cue even when they miss', () => {
  for (const weapon of ['G','H']) {
    const e = game(), p = e.state.players[0]; p.weapon = weapon;
    e.input(0,'fire',true); e.tick(); e.input(0,'fire',false); e.drainEvents();
    e.state.bullets[0].ttl = 0; e.tick(); e.tick();
    const events = e.drainEvents().filter(event => event.type === 'impact');
    assert.equal(events.length,1); assert.equal(audioCueFor(events[0]),'impact:'+weapon);
  }
});
test('barrier activation and boss destruction route to their recordings', () => {
  const e = game(), p = e.state.players[0];
  e.state.pickups.push({type:'B',x:p.x,y:p.y,w:24,h:24,ttl:10}); e.tick();
  assert.equal(audioCueFor(e.drainEvents().find(event => event.type === 'pickup')), 'barrier');
  const boss = {id:999,kind:'boss',x:300,y:300,w:100,h:100,hp:1,maxHp:1,cooldown:99,phase:0,attack:0};
  e.state.boss = boss;
  e.state.bullets.push({x:320,y:320,w:10,h:10,vx:0,vy:0,team:'player',ttl:1,damage:2,weapon:'P',hits:[]});
  e.tick();
  assert.equal(audioCueFor(e.drainEvents().find(event => event.type === 'explosion')), 'bossExplosion');
});
test('audio remains optional with unavailable browser APIs or blocked storage', async () => {
  const audio = createAudio({env:{localStorage:{getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}}}});
  await audio.unlock();
  assert.doesNotThrow(() => audio.update({stage:0,status:'playing'},[{type:'shot',weapon:'M'}]));
  assert.equal(audio.toggle(),true); assert.equal(audio.toggle(),false);
  assert.equal(audio.inspect().voices,0);
});
