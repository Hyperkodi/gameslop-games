'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createEngine}=require('../js/engine.js');
const {createSupportSystem,nextPlatform}=require('../js/support.js');
function quiet(e){const s=e.state;s.level.spawns=[];s.level.supplies=[];s.level.hazards=[];s.waveTime=-1e5;s.enemies=[];s.boss=null;s.players.forEach(p=>p.invincible=1e5);return s;}
function game(){const e=createEngine({seed:42});e.start();const s=quiet(e);s.level.platforms=[{x:0,y:454,w:6600,ground:true}];Object.assign(s.players[0],{y:412,grounded:true});return e;}
function ticks(e,n){for(let i=0;i<n;i++)e.tick();}
function stage(e,n){while(e.state.stage<n){e.state.status='clear';e.advance();}return quiet(e);}
function collect(e){const s=e.state,p=s.players[0];s.pickups.push({x:p.x,y:p.y,w:24,h:24,type:'J',ttl:999,packId:'test'});e.tick();}
test('jetpack pickup fuels ten seconds of held thrust, never recharges and cannot fly empty',()=>{
 const e=game(),p=e.state.players[0];collect(e);assert.equal(p.jetpackFuel,10);
 e.input(0,'jump',true);ticks(e,60);assert.ok(p.y<200);assert.ok(Math.abs(p.jetpackFuel-9)<1e-8);
 e.input(0,'jump',false);ticks(e,100);assert.equal(p.grounded,true);assert.ok(Math.abs(p.jetpackFuel-9)<1e-8);
 e.input(0,'jump',true);ticks(e,600);assert.equal(p.jetpackFuel,0);assert.equal(p.jetpackActive,false);
 ticks(e,100);assert.equal(p.grounded,true);assert.equal(p.jetpackFuel,0);
});
test('thrust respects the ceiling, supports shooting, pause and release',()=>{
 const e=game(),p=e.state.players[0];collect(e);e.input(0,'jump',true);e.input(0,'fire',true);ticks(e,180);
 assert.ok(p.y>=20);assert.ok(e.state.events.some(e=>e.type==='shot'));const fuel=p.jetpackFuel;
 e.pause();ticks(e,120);assert.equal(p.jetpackFuel,fuel);assert.equal(p.jetpackActive,false);
 e.pause();ticks(e,5);assert.equal(p.jetpackFuel,fuel);assert.equal(p.held.jump,undefined);
});
test('spent fuel persists across levels, deaths and continue, collected packs do not respawn',()=>{
 const e=game(),s=e.state,p=s.players[0];collect(e);p.jetpackFuel=2.25;
 s.status='clear';e.advance();assert.equal(p.jetpackFuel,2.25);
 s.status='gameover';e.continueRun();assert.equal(p.jetpackFuel,2.25);assert.ok(s.collectedPacks.includes('test'));
 e.start();assert.equal(e.state.players[0].jetpackFuel,0);assert.deepEqual(s.collectedPacks,[]);
});
test('down-jump and drop descend through platforms without engaging thrust',()=>{
 const e=game(),s=e.state,p=s.players[0];collect(e);s.level.platforms.push({x:50,y:300,w:300});Object.assign(p,{x:100,y:258,grounded:true});
 e.input(0,'down',true);e.input(0,'jump',true);ticks(e,15);assert.ok(p.y>258);assert.equal(p.jetpackFuel,10);assert.equal(p.jetpackActive,false);
 e.input(0,'jump',false);e.input(0,'down',false);e.input(0,'jump',true);ticks(e,2);assert.ok(p.jetpackFuel<10);
});
test('bunker hovering consumes fuel and settles when released',()=>{
 const e=game();const s=stage(e,1);s.enemies=[{kind:'core',id:333,x:0,y:0,w:1,h:1,hp:100,cooldown:999}];const p=s.players[0];collect(e);
 e.input(0,'jump',true);ticks(e,60);assert.equal(p.jumpTime,.3);assert.ok(Math.abs(p.jetpackFuel-9)<1e-8);
 e.input(0,'jump',false);ticks(e,40);assert.equal(p.jumpTime,0);
});
test('Pawns recruits once on the level-three halfway landing and stays through transitions',()=>{
 const e=game();assert.equal(e.state.pawnsRecruit,null);const s=stage(e,2),p=s.players[0];assert.equal(s.pawnsRecruit.y+42,1430);
 Object.assign(p,{x:480,y:1388,grounded:true});e.tick();assert.equal(s.pawnsRecruited,true);assert.ok(s.companion);assert.equal(s.pawnsRecruit,null);
 ticks(e,20);assert.equal(s.events.filter(x=>x.type==='companionJoined').length,1);
 s.status='clear';e.advance();assert.ok(s.companion);assert.equal(s.pawnsRecruited,true);
 e.start();assert.equal(s.companion,null);assert.equal(s.pawnsRecruited,false);
});
test('Pawns independently follows, aims, fires and damages enemies without hurting players',()=>{
 const e=game(),s=e.state,p=s.players[0];s.pawnsRecruited=true;const system=createSupportSystem({state:s,event(){}});system.transition();const a=s.companion;
 p.x=340;const x=a.x;ticks(e,30);assert.ok(a.x>x+50);
 const enemy={id:991,kind:'turret',x:550,y:420,w:40,h:34,hp:100,maxHp:100,cooldown:999,phase:0};s.enemies.push(enemy);const lives=p.lives;
 ticks(e,120);assert.ok(enemy.hp<100);assert.equal(a.targetId,991);assert.equal(p.lives,lives);assert.ok(s.events.some(e=>e.type==='shot'&&e.player==='pawns'));
 enemy.hp=0;e.tick();assert.equal(a.targetId,null);
 const frozen={x:a.x,y:a.y};e.pause();ticks(e,20);assert.equal(a.x,frozen.x);assert.equal(a.y,frozen.y);
});
test('platform graph rejects impossible rises and Pawns climbs a reachable staircase',()=>{
 const floor={x:0,y:454,w:250,ground:true},step={x:200,y:360,w:180},top={x:320,y:270,w:180},impossible={x:0,y:100,w:100};
 assert.equal(nextPlatform(floor,top,[floor,step,top]),step);assert.equal(nextPlatform(floor,impossible,[floor,impossible]),null);
 const e=game(),s=e.state,p=s.players[0];s.level.platforms=[floor,step,top];s.pawnsRecruited=true;createSupportSystem({state:s,event(){}}).transition();
 Object.assign(p,{x:370,y:228,grounded:true});ticks(e,220);assert.equal(s.companion.y+42,270);assert.ok(s.companion.grounded);
});
test('authored jetpacks are reachable platform pickups and excluded after collection',()=>{
 const e=createEngine();e.start();let s=e.state;const pack=s.level.supplies.find(x=>x.type==='J');assert.ok(pack);
 assert.ok(s.level.platforms.some(p=>Math.abs(p.y-pack.y-30)<1&&pack.x>=p.x&&pack.x<p.x+p.w));
 s.collectedPacks.push(pack.packId);s.status='gameover';e.continueRun();assert.ok(!s.level.supplies.some(x=>x.packId===pack.packId));
});
