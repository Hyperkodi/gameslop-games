'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const {createEngine}=require('../js/engine.js');
function game(index=0,difficulty='normal',players=1){const e=createEngine({seed:42});e.start({difficulty,players});for(let i=0;i<index;i++){e.state.status='clear';e.advance();}e.state.players.forEach(p=>p.invincible=9999);return e;}
function tick(e,n=1){for(let i=0;i<n;i++)e.tick();}
function apex(hold,base=false){
  const e=game(base?1:0),s=e.state,p=s.players[0];s.waveTime=-999;s.pickups=[];s.level.spawns=[];s.level.supplies=[];
  if(!base){s.level.platforms=[{x:0,y:454,w:960,h:100,ground:true}];p.y=412;p.grounded=true;}
  const origin=p.y;let peak=0;e.input(0,'jump',true);if(!hold)e.input(0,'jump',false);
  for(let i=0;i<100;i++){if(i===hold)e.input(0,'jump',false);e.tick();peak=Math.max(peak,base?p.dodgeLift||0:origin-p.y);}
  assert.equal(s.events.filter(x=>x.type==='jump').length,1);return peak;
}
test('tap, medium hold and full hold give progressively higher jumps, with a capped full arc',()=>{
  const short=apex(0),medium=apex(8),full=apex(60);
  assert.ok(short>10&&short<30);assert.ok(medium>short+25&&medium<full-10);assert.ok(full>100&&full<114);
  assert.equal(apex(95),full);
});
test('bunker dodge lift also scales with hold time, without repeat hops',()=>{
  const short=apex(0,true),medium=apex(6,true),full=apex(60,true);
  assert.ok(short>0&&short<8);assert.ok(medium>short&&medium<full);assert.ok(full>20&&full<=25);
});
test('re-holding jump in the air cannot restore cut ascent or double-jump',()=>{
  const e=game(),p=e.state.players[0];e.state.level.spawns=[];e.state.level.supplies=[];e.state.waveTime=-999;p.y=412;p.grounded=true;
  e.input(0,'jump',true);tick(e,3);e.input(0,'jump',false);tick(e);const vy=p.vy;
  e.input(0,'jump',true);tick(e);assert.ok(p.vy>vy);assert.equal(e.state.events.filter(x=>x.type==='jump').length,1);
});
function bonuses(e){
  const s=e.state;
  if(s.level.mode!=='base')return s.level.supplies.filter(p=>p.bonusId);
  const found=[];
  for(let i=0;i<3;i++){
    found.push(...s.pickups.filter(p=>p.bonusId));s.enemies=s.enemies.filter(x=>x.kind!=='core');tick(e);
  }
  return found;
}
test('Easy/Normal get one life per stage and continues at 3/6; Hard only gets a level-4 continue',()=>{
  for(const difficulty of ['easy','normal','hard'])for(let stage=0;stage<8;stage++){
    const e=game(stage,difficulty),items=bonuses(e),types=items.map(x=>x.type).sort();
    const expected=difficulty==='hard'?(stage===3?['CONTINUE']:[]):['LIFE',...([2,5].includes(stage)?['CONTINUE']:[])].sort();
    assert.deepEqual(types,expected,`${difficulty} stage ${stage+1}`);
    for(const p of items){
      if(e.state.level.mode==='base')assert.ok(p.x>=100&&p.x<=830&&p.y>=260&&p.y<=478);
      else assert.ok(e.state.level.platforms.some(f=>p.x>=f.x&&p.x+p.w<=f.x+f.w&&p.y+30===f.y),'bonus needs a real supporting platform');
    }
  }
});
test('bonus collection awards once, survives continue/revisit, and a new run restores it',()=>{
  for(const [stage,difficulty,type]of [[0,'easy','LIFE'],[2,'normal','CONTINUE'],[3,'hard','CONTINUE']]){
    const e=game(stage,difficulty),item=bonuses(e).find(p=>p.type===type),s=e.state,p=s.players[0];
    s.boss=null;s.waveTime=-999;s.level.spawns=[];s.level.supplies=[];s.pickups=[{...item}];p.x=item.x;p.y=item.y;p.vy=0;
    const before=type==='LIFE'?p.lives:s.continues;tick(e);
    assert.equal(type==='LIFE'?p.lives:s.continues,before+1);assert.ok(s.bonusNoticeTime>0);
    s.pickups.push({...item});tick(e);assert.equal(type==='LIFE'?p.lives:s.continues,before+1);
    s.status='gameover';e.continueRun();assert.ok(!bonuses(e).some(x=>x.bonusId===item.bonusId));
    e.start({difficulty});for(let i=0;i<stage;i++){s.status='clear';e.advance();}assert.ok(bonuses(e).some(x=>x.bonusId===item.bonusId));
  }
});
test('one physical life pickup awards its collecting co-op player once',()=>{
  const e=game(0,'normal',2),s=e.state,item=bonuses(e)[0];s.level.supplies=[];s.level.spawns=[];s.waveTime=-999;s.pickups=[{...item}];
  for(const p of s.players){p.x=item.x;p.y=item.y;p.vy=0;}
  const before=s.players.reduce((n,p)=>n+p.lives,0);tick(e);
  assert.equal(s.players.reduce((n,p)=>n+p.lives,0),before+1);
});
