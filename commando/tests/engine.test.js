'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createEngine, weapons } = require('../js/engine.js');
const { levels, buildLevel } = require('../js/levels.js');
function game(config={}) { const e=createEngine({seed:42});e.start(config);return e; }
function ticks(e,n) { for(let i=0;i<n;i++)e.tick(); }
function quiet(e) { e.state.level.spawns=[];e.state.level.supplies=[];e.state.waveTime=-10000;e.state.enemies=[];e.state.bullets=[]; }
function shot(x,y,damage=1000) { return {x,y,w:20,h:20,vx:0,vy:0,ttl:2,team:'player',damage,weapon:'P',hits:[]}; }
function enemyBullet(p) {return {x:p.x+8,y:p.y+12,w:9,h:9,vx:0,vy:0,ttl:1,team:'enemy'};}
test('eight original stages include two bunker assaults and a vertical climb',()=>{assert.equal(levels.length,8);assert.equal(levels.filter(l=>l.mode==='base').length,2);assert.equal(levels.filter(l=>l.mode==='climb').length,1);assert.equal(new Set(levels.map(l=>l.boss)).size,8);});
test('ready state never advances',()=>{const e=createEngine();ticks(e,20);assert.equal(e.state.tick,0);assert.equal(e.state.status,'ready');});
test('start config creates independent co-op players and assist lives',()=>{const e=game({players:2,difficulty:'assist'});assert.equal(e.state.players.length,2);assert.equal(e.state.players[0].lives,12);assert.notEqual(e.state.players[0].held,e.state.players[1].held);});
test('running, jumping and landing follow actual fixed-step physics',()=>{const e=game();quiet(e);ticks(e,10);const p=e.state.players[0];assert.equal(p.grounded,true);e.input(0,'right',true);e.input(0,'jump',true);ticks(e,22);assert.ok(p.x>180);assert.ok(p.y<330);e.input(0,'right',false);ticks(e,45);assert.equal(p.y,412);assert.equal(p.grounded,true);});
test('holding jump does not auto-jump upon landing',()=>{const e=game();quiet(e);ticks(e,5);e.input(0,'jump',true);ticks(e,100);assert.equal(e.state.players[0].grounded,true);});
test('one-way platforms allow jumping upward and landing on top',()=>{const e=game();quiet(e);e.state.level.platforms=[{x:0,y:454,w:960,h:86,ground:true},{x:70,y:365,w:220,h:18}];ticks(e,4);e.input(0,'jump',true);ticks(e,40);assert.equal(e.state.players[0].y,323);});
test('down plus jump drops through an elevated platform',()=>{const e=game();quiet(e);e.state.level.platforms=[{x:0,y:454,w:960,h:86,ground:true},{x:70,y:365,w:220,h:18}];Object.assign(e.state.players[0],{y:323,grounded:true,onGround:false});e.input(0,'down',true);e.input(0,'jump',true);ticks(e,30);assert.equal(e.state.players[0].y,412);});
test('crouching shrinks the hitbox and stops running',()=>{const e=game();quiet(e);ticks(e,5);const p=e.state.players[0];p.invincible=0;e.input(0,'down',true);e.input(0,'right',true);ticks(e,1);assert.equal(p.prone,true);assert.equal(p.x,110);e.state.bullets.push(enemyBullet(p));ticks(e,1);assert.equal(p.lives,3);});
test('directional shooting supports upward diagonals',()=>{const e=game();quiet(e);e.input(0,'up',true);e.input(0,'right',true);e.input(0,'fire',true);ticks(e,1);const b=e.state.bullets[0];assert.ok(b.vx>0&&b.vy<0);assert.ok(Math.abs(b.vx+b.vy)<.01);});
test('airborne down input can fire downward',()=>{const e=game();quiet(e);e.state.players[0].y=200;e.input(0,'down',true);e.input(0,'fire',true);ticks(e,1);assert.ok(e.state.bullets[0].vy>600);});
test('spread emits five distinct trajectories',()=>{const e=game();quiet(e);e.state.players[0].weapon='S';e.input(0,'fire',true);ticks(e,1);assert.equal(e.state.bullets.length,5);assert.equal(new Set(e.state.bullets.map(b=>b.vy)).size,5);});
test('machine gun fires faster than rifle',()=>{const count=w=>{const e=game();quiet(e);e.state.players[0].weapon=w;e.input(0,'fire',true);ticks(e,50);return e.state.events.filter(x=>x.type==='shot').length;};assert.ok(count('M')>count('P'));});
test('laser penetrates separate targets once each',()=>{const e=game();quiet(e);e.state.enemies=[{id:91,kind:'turret',x:200,y:410,w:32,h:34,hp:3,cooldown:100},{id:92,kind:'turret',x:260,y:410,w:32,h:34,hp:3,cooldown:100}];e.state.players[0].weapon='L';e.input(0,'fire',true);ticks(e,10);assert.equal(e.state.kills,2);});
test('flame has a finite short range',()=>{const e=game();quiet(e);e.state.players[0].weapon='F';e.input(0,'fire',true);ticks(e,1);const b=e.state.bullets[0];assert.ok(b.ttl<.61);assert.equal(b.damage,2);});
test('every gun pickup equips its matching weapon and awards score',()=>{for(const type of ['S','M','L','F','G','H','W']){const e=game();quiet(e);e.state.pickups.push({x:110,y:410,w:24,h:24,type,ttl:10});ticks(e,1);assert.equal(e.state.players[0].weapon,type);assert.equal(e.state.score,200);assert.equal(e.state.pickups.length,0);}});
test('new weapons use distinct splash, seeking, and piercing behavior',()=>{
  const grenade=game();quiet(grenade);grenade.state.enemies=[{id:71,kind:'turret',x:200,y:410,w:32,h:34,hp:3,cooldown:100},{id:72,kind:'turret',x:224,y:410,w:32,h:34,hp:3,cooldown:100}];grenade.state.players[0].weapon='G';grenade.input(0,'fire',true);ticks(grenade,10);assert.equal(grenade.state.kills,2);
  const rocket=game();quiet(rocket);rocket.state.enemies=[{id:73,kind:'turret',x:700,y:210,w:32,h:34,hp:20,cooldown:100}];rocket.state.players[0].weapon='H';rocket.input(0,'fire',true);ticks(rocket,1);assert.ok(rocket.state.bullets[0].vy<0);
  const wave=game();quiet(wave);wave.state.enemies=[{id:74,kind:'turret',x:200,y:410,w:32,h:34,hp:2,cooldown:100},{id:75,kind:'turret',x:260,y:410,w:32,h:34,hp:2,cooldown:100}];wave.state.players[0].weapon='W';wave.input(0,'fire',true);ticks(wave,10);assert.equal(wave.state.kills,2);
});
test('touching the end of a weapon pickup collects it',()=>{const e=game();quiet(e);e.state.pickups.push({x:150,y:410,w:24,h:24,type:'F',ttl:10});ticks(e,1);assert.equal(e.state.players[0].weapon,'F');assert.equal(e.state.pickups.length,0);});
test('nearby weapon outside the collection bounds is not collected',()=>{const e=game();quiet(e);e.state.pickups.push({x:155,y:410,w:24,h:24,type:'F',ttl:10});ticks(e,1);assert.equal(e.state.players[0].weapon,'P');assert.equal(e.state.pickups.length,1);});
test('barrier prevents bullet deaths but falling still costs a life',()=>{const e=game();quiet(e);const p=e.state.players[0];p.shield=12;p.invincible=0;e.state.bullets.push(enemyBullet(p));ticks(e,1);assert.equal(p.lives,3);p.y=700;ticks(e,1);assert.equal(p.lives,2);});
test('death resets weapon and grants safe checkpoint respawn',()=>{const e=game();quiet(e);const p=e.state.players[0];p.invincible=0;p.weapon='S';p.rapid=10;e.state.bullets.push(enemyBullet(p));ticks(e,1);assert.equal(p.lives,2);assert.equal(p.weapon,'P');assert.equal(p.rapid,0);assert.ok(p.invincible>2);assert.equal(p.x,110);});
test('co-op continues while either player survives',()=>{const e=game({players:2});quiet(e);const p=e.state.players[0];p.lives=1;p.invincible=0;e.state.bullets.push(enemyBullet(p));ticks(e,1);assert.equal(p.lives,0);assert.equal(e.state.status,'playing');});
test('game over, limited continues, and restart reset state correctly',()=>{const e=game();for(let i=0;i<4;i++){quiet(e);const p=e.state.players[0];p.lives=1;p.invincible=0;e.state.bullets.push(enemyBullet(p));ticks(e,1);assert.equal(e.state.status,'gameover');assert.equal(e.continueRun(),i<3);}assert.equal(e.state.continues,0);e.start();assert.equal(e.state.continues,3);assert.equal(e.state.score,0);});
test('pause releases held input and stops simulation',()=>{const e=game();e.input(0,'right',true);ticks(e,5);e.pause();const x=e.state.players[0].x;ticks(e,100);assert.equal(e.state.players[0].x,x);assert.deepEqual(e.state.players[0].held,{});e.pause();ticks(e,5);assert.equal(e.state.status,'playing');assert.equal(e.state.players[0].x,x);});
test('seed and tick-indexed inputs replay identically',()=>{const run=()=>{const e=game();for(let t=0;t<360;t++){if(t===10)e.input(0,'right',true);if(t%40===0)e.input(0,'jump',true);if(t%40===1)e.input(0,'jump',false);if(t===15)e.input(0,'fire',true);e.tick();}return JSON.stringify(e.state);};assert.equal(run(),run());});
test('all eight bosses and all six bunker rooms lead to the victory ending',()=>{
  const e=game({difficulty:'assist'});let rooms=0;
  for(let stage=0;stage<8;stage++){
    assert.equal(e.state.stage,stage);const s=e.state,p=s.players[0];p.invincible=1000;
    if(s.level.mode==='base'){
      for(let room=0;room<3;room++){
        assert.equal(s.room,room);s.enemies.filter(x=>x.kind==='core').forEach(x=>s.bullets.push(shot(x.x,x.y)));ticks(e,1);rooms++;
      }
    }else if(s.level.mode==='climb'){p.y=280;ticks(e,1);}
    else {p.x=s.level.width-770;ticks(e,1);}
    assert.ok(s.boss,'boss should appear in '+s.level.name);s.bullets.push(shot(s.boss.x+30,s.boss.y+30));ticks(e,1);
    assert.equal(s.status,'clear','boss should end '+s.level.name);e.advance();
  }
  assert.equal(rooms,6);assert.equal(e.state.status,'victory');assert.ok(e.state.score>=40000);
});
test('bunker movement is bounded, defaults fire upward and jumping dodges',()=>{
  const e=game();e.state.status='clear';e.advance();const p=e.state.players[0];e.input(0,'fire',true);ticks(e,1);assert.ok(e.state.bullets.some(b=>b.team==='player'&&b.vy<0));e.input(0,'fire',false);e.input(0,'left',true);e.input(0,'down',true);ticks(e,300);assert.ok(p.x>=100&&p.y<=478);e.input(0,'left',false);e.input(0,'down',false);p.invincible=0;e.input(0,'jump',true);e.state.bullets.push(enemyBullet(p));const lives=p.lives;ticks(e,1);assert.equal(p.lives,lives);assert.ok(p.jumpTime>0);
});
test('platform route has no vertical step beyond jump height',()=>{
  const l=buildLevel(2),route=l.platforms.filter(p=>!p.ground).sort((a,b)=>b.y-a.y);
  let previous=l.platforms[0];for(const p of route){assert.ok(previous.y-p.y<=113);assert.ok(p.x<previous.x+previous.w+140&&p.x+p.w>previous.x-140);previous=p;}
});
test('expanded run stages are substantially longer with distributed, varied routes',()=>{
  // These are the campaign widths before the expansion. Keep the expectation
  // proportional so later art or pacing passes can adjust exact destinations.
  const previousWidths={0:4800,4:5100,5:5300,6:5500,7:5700};
  for(const[indexText,previousWidth]of Object.entries(previousWidths)){
    const index=Number(indexText),l=buildLevel(index),ledges=l.platforms.filter(p=>!p.ground),encounters=l.spawns;
    assert.equal(l.mode,'run');
    assert.ok(l.width>=Math.max(previousWidth+800,previousWidth*1.15),`${l.name} should add a material amount of travel`);
    assert.ok(ledges.length>=12,`${l.name} should have a substantial route of optional ledges`);
    assert.ok(new Set(ledges.map(p=>Math.min(4,Math.floor(p.x/l.width*5)))).size>=4,`${l.name} should spread ledges across the route`);
    assert.ok(new Set(ledges.map(p=>Math.round(p.y/35))).size>=3,`${l.name} should use multiple ledge heights`);
    assert.ok(new Set(ledges.map(p=>Math.round(p.w/25))).size>=3,`${l.name} should use multiple landing widths`);
    assert.ok(encounters.length>=12,`${l.name} should have a sustained encounter route`);
    assert.equal(new Set(encounters.map(e=>e.kind)).size,3,`${l.name} should mix soldiers, turrets, and drones`);
    assert.ok(encounters.some(e=>e.y<300)&&encounters.some(e=>e.y>=400),`${l.name} should mix elevated and ground encounters`);
    assert.ok(new Set(encounters.map(e=>Math.min(4,Math.floor(e.x/l.width*5)))).size>=4,`${l.name} should distribute encounters across the route`);
  }
});
test('Spillway is a taller, safe switchback ascent with mixed encounters',()=>{
  const previousHeight=1930,l=buildLevel(2),route=l.platforms.filter(p=>!p.ground).sort((a,b)=>b.y-a.y);
  assert.ok(l.height>=previousHeight*1.4,'Spillway should be materially taller than the earlier climb');
  assert.ok(route.length>=30,'Spillway should provide a long sequence of landing choices');
  assert.ok(route[route.length-1].y<=l.height*.12,'the route should reach the dam crest');
  let previous=l.platforms.find(p=>p.ground),previousDirection=0,directionChanges=0;
  for(const landing of route){
    const rise=previous.y-landing.y;
    assert.ok(rise>0&&rise<=90,'each ascent step should stay comfortably inside the jump envelope');
    assert.ok(landing.x<previous.x+previous.w+140&&landing.x+landing.w>previous.x-140,'each landing should connect to the prior safe approach');
    const direction=Math.sign((landing.x+landing.w/2)-(previous.x+previous.w/2));
    if(direction&&previousDirection&&direction!==previousDirection)directionChanges++;
    if(direction)previousDirection=direction;
    previous=landing;
  }
  assert.ok(directionChanges>=6,'the climb should switch back instead of reading as a vertical ladder');
  assert.equal(new Set(l.spawns.map(e=>e.kind)).size,3,'the ascent should mix enemy roles across its landings');
  assert.ok(new Set(l.spawns.map(e=>Math.floor((l.height-e.y)/350))).size>=5,'the ascent encounters should be spread through its height');
});
test('run-stage gaps are shorter than a full jump and do not contain spawns',()=>{for(let i=0;i<8;i++){const l=buildLevel(i);for(const[a,b]of l.gaps||[]){assert.ok(b-a<150);assert.ok(!l.spawns.some(e=>e.x>a&&e.x<b&&e.kind!=='drone'));}}});
test('world entities remain bounded during extended gameplay',()=>{const e=game({difficulty:'assist'});e.state.players[0].invincible=1000;e.input(0,'fire',true);ticks(e,36000);assert.ok(e.state.bullets.length<100);assert.ok(e.state.enemies.length<30);assert.ok(e.state.effects.length<300);assert.ok(Number.isFinite(e.state.players[0].y));});
test('extra-life threshold awards exactly once',()=>{const e=game();quiet(e);e.state.score=14900;e.state.pickups.push({x:110,y:410,w:24,h:24,type:'R',ttl:10});ticks(e,1);assert.equal(e.state.players[0].lives,4);ticks(e,10);assert.equal(e.state.players[0].lives,4);});
test('all weapon definitions expose valid gameplay values',()=>{assert.deepEqual(Object.keys(weapons).sort(),['A','F','G','H','I','L','M','P','S','T','W']);for(const w of Object.values(weapons)){assert.ok(w.damage>0&&w.delay>0&&w.speed>0);}});
