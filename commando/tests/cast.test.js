'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {enemyFrame,enemyState,animationSample,actorMotion,createAnimationClock,createDefeatTracker,keyPixel,removeMatte}=require('../js/sprite-art.js');
const {stageEnemies,createEngine}=require('../js/engine.js');
const skin=JSON.parse(fs.readFileSync(path.join(__dirname,'../skin/gameslop/skin.json'),'utf8'));
test('approved cast covers all spawning types and all eight bosses',()=>{
 assert.equal(skin.cast.bosses.length,8);
 for(const kind of ['soldier','turret','drone','core',...stageEnemies])assert.ok(skin.cast.enemies[kind],kind);
 assert.equal(skin.mascot.runFrames.length,8);assert.equal(new Set(skin.mascot.runFrames).size,8);
});
test('every source rectangle and foot anchor is inside its actual sprite atlas',()=>{
 const dimensions=file=>{const p=fs.readFileSync(path.join(__dirname,'../skin/gameslop',file));return[p.readUInt32BE(16),p.readUInt32BE(20)];};
 const all=[{atlas:skin.mascot.atlas,frames:Object.entries(skin.mascot.frames).map(([key,rect])=>({rect,anchor:skin.mascot.anchors[key]}))},skin.companion,...Object.values(skin.cast.enemies),...skin.cast.bosses];
 for(const meta of all){for(const f of meta.frames){const[width,height]=dimensions(f.atlas||meta.atlas),[x,y,w,h]=f.rect;assert.ok(x>=0&&y>=0&&x+w<=width&&y+h<=height);assert.ok(f.anchor[0]>=0&&f.anchor[0]<=w&&f.anchor[1]>=0&&f.anchor[1]<=h);}}
});
test('keying removes magenta while preserving glass, purple armor, and pink skin',()=>{
 assert.equal(keyPixel(255,0,255),true);assert.equal(keyPixel(249,12,252),true);
 for(const rgb of [[245,248,246],[145,68,170],[255,115,201],[25,25,25]])assert.equal(keyPixel(...rgb),false);
});
test('matte despill cleans a mixed boundary without touching interior purple',()=>{
 const pixels={width:5,height:5,data:new Uint8ClampedArray(5*5*4)};
 for(let i=0;i<25;i++)pixels.data.set([145,68,170,255],i*4);
 pixels.data.set([255,0,255,255],5*4);pixels.data.set([180,10,180,255],6*4);
 removeMatte(pixels);
 assert.equal(pixels.data[5*4+3],0);
 assert.deepEqual([...pixels.data.slice(6*4,7*4)],[10,10,10,255]);
 assert.deepEqual([...pixels.data.slice(18*4,19*4)],[145,68,170,255]);
});
test('boss attack tell and recoil follow engine timing instead of cycling constantly',()=>{
 const boss={kind:'boss',hp:95,maxHp:95,cooldown:.2};
 assert.equal(enemyFrame(boss,{},4,{shotUntil:0,targeted:true}),1);
 assert.equal(enemyFrame({...boss,cooldown:1.5},{},4,{shotUntil:4.1}),2);
 assert.equal(enemyFrame({...boss,cooldown:1},{},4,{shotUntil:0}),0);
 assert.equal(enemyFrame({...boss,flash:.07},{},4,{shotUntil:0}),3);
});
test('movement uses distance traveled and stationary consoles keep their alert pose',()=>{
 const guard={kind:'soldier',cooldown:1,phase:0};
 assert.deepEqual([0,.25,.5,.75].map(stride=>enemyFrame(guard,{},1,{moving:true,stride})),[1,0,2,0]);
 assert.equal(enemyFrame(guard,skin.cast.enemies.soldier,2,{shotUntil:2.1}),5);
 assert.equal(enemyFrame({kind:'core',hp:2,maxHp:8},{stationary:true},2),2);
});
test('all twelve enemy designs have distinct windup, attack, hurt and defeat frames',()=>{
 for(const meta of Object.values(skin.cast.enemies)){
  assert.equal(meta.frames.length,8,meta.name);
  assert.equal(new Set(meta.frames.slice(4).map(f=>f.atlas+f.rect.join(','))).size,4);
 }
});
test('animation clock freezes during pause and does not catch up after resuming',()=>{
 const clock=createAnimationClock();assert.equal(clock(10),0);
 assert.ok(Math.abs(clock(10.04)-.04)<1e-6);
 const frozen=clock(10.05,true);assert.equal(clock(150,true),frozen);
 assert.equal(clock(155),frozen);assert.ok(clock(155.04)>frozen);
 assert.ok(clock(500)<=frozen+.1,'background gaps should never skip an entire animation');
});
test('stationary, slowed and paused walkers use their actual displacement',()=>{
 const e={kind:'soldier',x:0,y:0,hp:4,cooldown:1};
 let a=animationSample(e,0,null,100);
 a=animationSample(e,1,a,100);assert.equal(a.moving,false);
 assert.equal(enemyState(e,{},1,a),'idle');
 e.x=27;a=animationSample(e,2,a,100);assert.equal(a.stride,1);
 const paused=animationSample(e,2,a,100);assert.equal(paused.stride,1);
 e.x+=13.5;a=animationSample(e,3,a,100);assert.equal(a.stride,1.5);
 assert.equal(a.facing,1);
 assert.equal(animationSample(e,3,a,-100).facing,-1);
});
test('cooldown resets cannot fake a shot, and old offscreen shots do not recoil',()=>{
 const e={kind:'soldier',x:0,y:0,hp:4,cooldown:0};
 let a=animationSample(e,1,null,100,100);
 e.cooldown=2;a=animationSample(e,1.05,a,100,103);
 assert.equal(enemyState(e,{},1.05,a),'idle');
 e.attackTick=104;a=animationSample(e,1.1,a,100,104);
 assert.equal(enemyState(e,{},1.1,a),'attack');
 a=animationSample(e,1.4,a,100,122);assert.equal(enemyState(e,{},1.4,a),'idle');
 assert.equal(enemyState(e,{},2,animationSample(e,2,null,100,300)),'idle');
});
test('YOLO and Robin charge without acquiring ranged attack states',()=>{
 for(const kind of ['iceWolf','caveBat']){
  const e={kind,hp:4,cooldown:.1,phase:.6};
  assert.equal(enemyState(e,{},1,{moving:true,speed:100,targeted:true,shotUntil:2}),'charge');
  assert.equal(enemyState(e,{},1,{moving:false,targeted:true}),'idle');
 }
});
test('taking damage selects a readable hit pose before resuming an attack',()=>{
 const e={kind:'soldier',x:0,y:0,hp:4,cooldown:1};
 let a=animationSample(e,0,null,100);e.hp=3;e.attackTick=5;
 a=animationSample(e,.1,a,100,5);
 assert.equal(enemyFrame(e,skin.cast.enemies.soldier,.1,a),6);
 assert.equal(enemyState(e,{},.27,a),'attack');
 assert.equal(enemyState(e,{},.3,a),'idle');
});
test('defeat tracker handles removed enemies, retained bosses, pause, and stage changes',()=>{
 const update=createDefeatTracker(),foe={id:1,kind:'soldier',hp:2},boss={id:2,kind:'boss',hp:10};
 const s={stage:0,room:0,status:'playing',players:[],enemies:[foe],boss};
 assert.equal(update(s,0).length,0);
 foe.hp=0;s.enemies=[];assert.equal(update(s,.1).length,1);
 boss.hp=0;s.status='clear';assert.equal(update(s,.2).length,2);
 assert.equal(update(s,.2).length,2,'same time cannot advance defeat');
 assert.equal(update(s,1.2).length,0);assert.equal(update(s,2).length,0,'retained boss must not repeat');
 const next={id:3,kind:'soldier',hp:2};s.enemies=[next];update(s,3);
 s.stage=1;next.hp=0;s.enemies=[];s.boss=null;assert.equal(update(s,3.1).length,0);
});
test('each hostile animation transform remains finite through every state',()=>{
 const actors=[...Object.keys(skin.cast.enemies).map(kind=>({kind})),...skin.cast.bosses.map((_,variant)=>({kind:'boss',variant}))];
 for(const e of actors)for(const state of ['idle','move','windup','attack','charge','hurt','defeat']){
  const motion=actorMotion(e,2,{stride:.4,shotUntil:2.1},state);
  for(const v of Object.values(motion))assert.ok(Number.isFinite(v));
  if(state==='defeat')assert.equal(motion.y,0,'defeated hovercraft must power down');
 }
});
test('real engine attacks stamp recoil; contact attackers do not',()=>{
 for(const kind of ['soldier','turret','drone','core',...stageEnemies]){
  const engine=createEngine({seed:42});engine.start();const s=engine.state;
  s.level.spawns=[];s.level.supplies=[];s.waveTime=-10000;
  const e={id:999,kind,x:400,y:420,originX:400,originY:420,w:32,h:34,hp:8,maxHp:8,cooldown:0,phase:0};
  s.enemies=[e];s.bullets=[];engine.tick();
  if(['iceWolf','caveBat'].includes(kind)){assert.equal(e.attackTick,undefined);assert.equal(s.bullets.length,0);}
  else {assert.equal(e.attackTick,s.tick,kind);assert.ok(s.bullets.some(b=>b.team==='enemy'),kind);}
 }
});
