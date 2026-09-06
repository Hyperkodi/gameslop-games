 'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createEngine,stages}=require('../js/engine'),C=require('../js/content');
const tick=(e,n)=>{for(let i=0;i<n;i++)e.tick();};
function stageAt(index,players=1,seed=42){const e=createEngine({seed});e.start({players});for(let i=0;i<index;i++){e.state.status='clear';e.advance();}return e;}
function collect(e,kind){const p=e.state.players[0],item=e.state.pickups.find(v=>v.kind===kind);assert.ok(item,kind);p.x=item.x;p.y=item.y;p.invincible=100;e.state.camera=p.x-310;e.state.cameraY=C.floor(stages[e.state.stage],p.x);e.tick();}
function fight(){const e=stageAt(0),p=e.state.players[0];p.x=170;p.invincible=100;e.tick();e.state.props=[];e.state.traps=[];e.state.pickups=[];const foe=e.state.enemies[0];Object.assign(foe,{entrance:null,kind:'grunt',x:370,y:p.y,z:0,hp:1000,maxHp:1000,cooldown:100,stun:100,down:0});e.state.enemies=[foe];return {e,p,foe};}
test('scarce supplies, one stamina booster per era, strength only in eras 2, 4 and 6, and three weapons',()=>{
 for(let i=0;i<6;i++){const e=stageAt(i),items=e.state.pickups;for(const kind of ['food','energy'])assert.ok(items.filter(v=>v.kind===kind).length<=3);assert.equal(items.filter(v=>v.kind==='stamina').length,1);assert.equal(items.filter(v=>v.kind==='strength').length,i%2);assert.equal(items.filter(v=>v.kind==='heart').length,1);assert.equal(new Set(items.filter(v=>v.kind==='weapon').map(v=>v.weapon)).size,3);}
});
test('stamina upgrades are shared, persist through deaths/continues, cannot be farmed, and reset on a new run',()=>{
 const e=stageAt(0,2);collect(e,'stamina');for(const p of e.state.players){assert.equal(p.maxStamina,120);assert.deepEqual(p.staminaUpgrades,[0]);}
 const p=e.state.players[0];p.dead=.01;p.stamina=0;e.tick();assert.equal(p.stamina,120);e.state.status='gameover';e.continueRun();assert.equal(p.maxStamina,120);assert.equal(e.state.pickups.filter(v=>v.kind==='stamina').length,0);
 e.state.status='clear';e.advance();collect(e,'stamina');assert.equal(p.maxStamina,140);e.start();assert.equal(e.state.players[0].maxStamina,100);
});
test('missed upgrades remain reachable after a later checkpoint continue',()=>{
 const e=stageAt(1);e.state.checkpoint=6;e.state.status='gameover';e.continueRun();const p=e.state.players[0];for(const kind of ['stamina','strength']){const item=e.state.pickups.find(v=>v.kind===kind);assert.ok(item.x>p.x);assert.ok(C.walkable(stages[1],item.x,item.y));}
});
test('strength is shared once per eligible stage and stacks to sixty percent',()=>{
 const e=stageAt(0,2);for(let i=0;i<6;i++){if(i){e.state.status='clear';e.advance();}if(i%2)collect(e,'strength');}for(const p of e.state.players){assert.equal(p.strength,3);assert.deepEqual(p.strengthUpgrades,[1,3,5]);}e.state.status='gameover';e.continueRun();assert.equal(e.state.players[0].strength,3);assert.ok(!e.state.pickups.some(v=>v.kind==='strength'));e.start();assert.equal(e.state.players[0].strength,0);
});
test('all five enemy kinds get progressively more health in later eras',()=>{
 const seen=new Set();for(let seed=1;seed<=35;seed++){let previous;for(let era=0;era<6;era++){const e=stageAt(era,1,seed);e.state.players[0].x=170;e.tick();const foes=e.state.enemies;for(const f of foes)seen.add(f.kind);if(previous)foes.forEach((f,i)=>assert.ok(f.maxHp>previous[i].maxHp));previous=foes;}}assert.equal(seen.size,5);
});
test('V modifier alone keeps a weapon; V plus Attack throws it once and damages down the lane',()=>{
 const {e,p,foe}=fight();p.weapon='pipe';p.weaponHits=22;e.input(0,'throwWeapon',true);tick(e,10);assert.equal(p.weapon,'pipe');e.input(0,'attack',true);tick(e,8);assert.equal(p.weapon,null);assert.equal(p.weaponHits,0);assert.ok(e.state.missiles.some(m=>m.weapon==='pipe'));tick(e,20);assert.equal(foe.hp,962);assert.equal(e.drainEvents().filter(v=>v.type==='throw').length,1);
});
test('weapon throws cost stamina and respect depth',()=>{
 const {e,p,foe}=fight();p.weapon='photon';p.weaponHits=20;p.stamina=0;e.input(0,'throwWeapon',true);e.input(0,'attack',true);tick(e,8);assert.equal(p.weapon,'photon');assert.equal(e.state.missiles.length,0);
 p.stamina=100;foe.y+=70;tick(e,30);assert.equal(foe.hp,1000);assert.equal(p.weapon,null);
});
test('strength increases punches, weapon swings and thrown weapon damage',()=>{
 for(const weapon of [null,'pipe']){const {e,p,foe}=fight();p.strength=2;p.weapon=weapon;p.weaponHits=22;foe.x=p.x+65;e.input(0,'attack',true);tick(e,8);assert.equal(foe.hp,1000-Math.round((weapon?23:12)*1.4));}
 const {e,p,foe}=fight();p.strength=3;p.weapon='photon';p.weaponHits=20;e.input(0,'throwWeapon',true);e.input(0,'attack',true);tick(e,28);assert.equal(foe.hp,1000-Math.round(Math.round(C.weapons.photon.damage*1.65)*1.6));
});
test('a thrown weapon strikes at most two enemies, without hitting a third target',()=>{
 const {e,p,foe}=fight();foe.x=p.x+100;const b={...foe,id:999,x:p.x+140},c={...foe,id:1000,x:p.x+230};e.state.enemies.push(b,c);p.weapon='pipe';e.input(0,'throwWeapon',true);e.input(0,'attack',true);tick(e,26);assert.equal(foe.hp,962);assert.equal(b.hp,962);assert.equal(c.hp,1000);
});

test('a quick mobile Throw tap survives input release before the next simulation tick',()=>{const {e,p}=fight();p.weapon='pipe';p.weaponHits=22;for(const a of ['throwWeapon','attack']){e.input(0,a,true);e.input(0,a,false);}e.tick();assert.equal(p.action.kind,'weaponThrow');assert.equal(p.weapon,null);});
test('a boss stops a thrown weapon before it reaches another target',()=>{const {e,p,foe}=fight();foe.boss=true;foe.x=p.x+100;const other={...foe,boss:false,id:999,x:p.x+180};e.state.enemies.push(other);p.weapon='pipe';e.input(0,'throwWeapon',true);e.input(0,'attack',true);tick(e,25);assert.equal(foe.hp,962);assert.equal(other.hp,1000);});
