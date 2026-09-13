'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createEngine,weapons}=require('../js/engine.js');
function game(){
  const e=createEngine({seed:42});e.start({players:2});const s=e.state;
  s.level.spawns=[];s.level.supplies=[];s.level.hazards=[];s.enemies=[];s.pickups=[];s.waveTime=-9999;
  s.level.platforms=[{x:0,y:454,w:6600,h:86,ground:true}];s.players.forEach(p=>p.invincible=9999);return e;
}
function ticks(e,n=1){for(let i=0;i<n;i++)e.tick();}
const foe=(id,x,y=410,hp=20)=>({id,kind:'turret',x,y,w:32,h:34,hp,maxHp:hp,cooldown:999,phase:0});
function bullet(weapon,x,y,extra={}){
  const spec=weapons[weapon];return {weapon,x,y,w:spec.width||8,h:spec.height||5,vx:0,vy:0,ttl:1,team:'player',hits:[],damage:spec.damage,splash:spec.splash,splashDamage:spec.splashDamage,...extra};
}
function light(e,target){e.state.bullets.push(bullet('F',target.x+5,target.y+5));ticks(e);}

test('flamethrower hits ignite a moving target, then deliver small lingering damage and stop',()=>{
  const e=game(),s=e.state,t=foe(1,300);s.enemies=[t];light(e,t);
  assert.equal(t.hp,18);assert.equal(t.burnTime,3);assert.ok(t.burning>0);
  t.x=500;ticks(e,60);assert.ok(Math.abs(t.hp-17.76)<1e-8);assert.ok(t.burning>0);
  ticks(e,120);assert.ok(Math.abs(t.hp-17.28)<1e-8);assert.equal(t.burnTime,0);
  ticks(e,60);assert.ok(Math.abs(t.hp-17.28)<1e-8);
});

test('repeated and allied flame hits refresh one burn without stacking tick damage',()=>{
  const e=game(),s=e.state,t=foe(1,300);s.enemies=[t];light(e,t);ticks(e,6);
  s.bullets.push(bullet('F',305,415,{source:'sloppy',damage:.55}));ticks(e);
  const hp=t.hp;assert.equal(t.burnTime,3);ticks(e,8);
  assert.ok(Math.abs(t.hp-(hp-.06))<1e-8); // The first scheduled pulse survives refresh.
});

test('pause freezes burns; lingering fire kills and scores only once',()=>{
  const e=game(),s=e.state,t=foe(1,300,410,2.05);s.enemies=[t];light(e,t);
  e.pause();ticks(e,60);assert.ok(t.hp>0);assert.equal(t.burnTime,3);e.pause();ticks(e,15);
  assert.ok(t.hp<=0);assert.equal(s.kills,1);assert.equal(s.score,150);ticks(e,60);assert.equal(s.kills,1);
});

test('a boss can die from a burn, awards its clear once, and clears old ordnance',()=>{
  const e=game(),s=e.state,b={...foe(1,600,310,2.07),kind:'boss',originX:600,originY:310,attack:0};
  s.boss=b;light(e,b);ticks(e,15);assert.equal(s.status,'boss-defeat');ticks(e,394);assert.equal(s.status,'clear');assert.equal(s.kills,1);
  assert.equal(s.events.filter(x=>x.type==='clear').length,1);assert.equal(s.grenades.length,0);
  const score=s.score;ticks(e,60);assert.equal(s.score,score);
});

test('launcher shots start with an upward arc, hit the ground, and blast nearby enemies',()=>{
  const e=game(),s=e.state,p=s.players[0];p.weapon='G';p.y=412;p.grounded=true;
  e.input(0,'fire',true);ticks(e);e.input(0,'fire',false);assert.ok(s.bullets[0].vy<0);
  let impact=null;
  for(let i=0;i<150;i++){ticks(e);impact=s.effects.find(x=>x.blast);if(impact)break;}
  assert.ok(impact);assert.ok(impact.y>=440&&impact.y<=454);assert.ok(impact.x>500);
  assert.equal(s.bullets.filter(x=>x.weapon==='G').length,0);
  assert.equal(s.events.filter(x=>x.type==='impact'&&x.weapon==='G').length,1);
});

test('ground and ledge impacts catch very fast grenades and rockets, and damage groups',()=>{
  for(const weapon of ['G','H'])for(const ground of [false,true]){
    const e=game(),s=e.state;s.level.platforms=[{x:100,y:300,w:600,h:8,ground}];
    const near=foe(1,400,265),far=foe(2,560,265);s.enemies=[near,far];
    s.bullets=[bullet(weapon,300,240,{vy:9000})];ticks(e);
    assert.equal(s.bullets.length,0);assert.equal(near.hp,16);assert.equal(far.hp,20);
    const blast=s.effects.find(x=>x.blast);assert.ok(blast.y<=300);
    ticks(e,10);assert.equal(near.hp,16);assert.equal(s.events.filter(x=>x.type==='impact').length,1);
  }
});

test('a direct hit damages nearby enemies out to the expanded radius without double-hitting its target',()=>{
  for(const weapon of ['G','H']){
    const e=game(),s=e.state,a=foe(1,300),b=foe(2,400),far=foe(3,600);s.enemies=[a,b,far];
    s.players.forEach(p=>p.invincible=0);
    s.bullets=[bullet(weapon,310,420)];ticks(e);
    assert.equal(a.hp,20-weapons[weapon].damage);assert.equal(b.hp,16);assert.equal(far.hp,20);
    assert.deepEqual(s.players.map(p=>p.lives),[7,7]);
  }
});

test('solid terrain stops explosives before a directly intersected target behind it',()=>{
  const e=game(),s=e.state;s.level.platforms=[{x:300,y:0,w:20,h:454,ground:true}];
  const t=foe(1,470);s.enemies=[t];s.bullets=[bullet('G',200,420,{vx:24000})];ticks(e);
  assert.equal(t.hp,20);assert.ok(s.effects.find(x=>x.blast).x<300);
});

test('upward explosives pass through one-way ledges, and bunker launchers follow overhead aim without gravity',()=>{
  const e=game(),s=e.state;s.level.platforms=[{x:100,y:300,w:600,h:8,ground:false}];
  s.bullets=[bullet('G',300,320,{vy:-3000})];ticks(e);assert.equal(s.bullets.length,1);
  s.status='clear';e.advance();const p=s.players[0];p.weapon='G';e.input(0,'fire',true);ticks(e);
  const b=s.bullets.find(x=>x.weapon==='G');assert.equal(b.gravity,0);assert.ok(b.vy<0);assert.ok(Math.abs(b.vx)<1e-6);
});
