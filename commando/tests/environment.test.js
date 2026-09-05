'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {sceneryLayout,bunkerProgress}=require('../js/environment.js');
const {buildLevel}=require('../js/levels.js');
const fs=require('node:fs');
const path=require('node:path');

test('all stage artwork exists and authored crops stay inside each PNG',()=>{
  const directory=path.join(__dirname,'../skin/gameslop');
  const skin=JSON.parse(fs.readFileSync(path.join(directory,'skin.json'),'utf8'));
  assert.equal(skin.environment.stages.length,8);
  for(const stage of skin.environment.stages){
    const data=fs.readFileSync(path.join(directory,stage.atlas||stage));
    assert.equal(data.toString('ascii',1,4),'PNG');
    const width=data.readUInt32BE(16),height=data.readUInt32BE(20);
    if(stage.frames){
      assert.ok(stage.frames.length>=6&&stage.frames.length<=7);
      for(const [x,y,w,h] of stage.frames){assert.ok(x>=0&&y>=0&&w>100&&h>100);assert.ok(x+w<=width&&y+h<=height,stage.atlas);}
    }
  }
});

test('configured scenery strips cover every point throughout every stage',()=>{
  const skin=JSON.parse(fs.readFileSync(path.join(__dirname,'../skin/gameslop/skin.json'),'utf8'));
  for(let stage=0;stage<8;stage++){
    const configured=skin.environment.stages[stage];
    const count=configured.frames?.length||skin.environment.sections;
    assert.ok(count>=6&&count<=7);
    const level=buildLevel(stage),s={level,camera:{x:0,y:0}},seen=new Set();
    const vertical=level.mode==='climb',viewport=vertical?540:960;
    const travel=level.mode==='base'?3840:vertical?level.height-540:level.width-960;
    for(let n=0;n<=180;n++){
      const position=travel*n/180;s.camera={x:position,y:position};
      const layout=sceneryLayout(s,position,count);
      assert.ok(layout.visible.length<=(vertical?5:3));
      for(const section of layout.visible)seen.add(section.index);
      // Every point has an opaque section beneath any blended sections.
      for(let p=0;p<viewport;p+=10){
        assert.ok(layout.visible.some(section=>{
          const local=p-(vertical?section.y:section.x);
          return local>=0&&local<=viewport&&(section.index===0||(vertical?local<=layout.step:local>=layout.overlap));
        }),`uncovered stage ${stage}, camera ${position}, pixel ${p}`);
      }
    }
    assert.equal(seen.size,count);
  }
});

test('horizontal scenery moves exactly with the camera and does not stop early',()=>{
  const level=buildLevel(0),a=sceneryLayout({level,camera:{x:2500,y:0}}),b=sceneryLayout({level,camera:{x:2501,y:0}});
  for(const section of a.visible){const next=b.visible.find(s=>s.index===section.index);if(next)assert.equal(next.x,section.x-1);}
  const end=sceneryLayout({level,camera:{x:level.width-960,y:0}});
  assert.equal(end.visible.at(-1).index,6);assert.equal(end.visible.at(-1).x,0);
});

test('waterfall starts at section zero and finishes at section six while ascending',()=>{
  const level=buildLevel(2);
  const start=sceneryLayout({level,camera:{x:0,y:level.height-540}}),end=sceneryLayout({level,camera:{x:0,y:0}});
  assert.equal(start.visible[0].index,0);assert.equal(start.visible[0].y,0);
  assert.equal(end.visible.at(-1).index,6);assert.equal(end.visible.at(-1).y,0);
});

test('bunker scenery advances monotonically through cores, rooms and boss',()=>{
  let previous=-1;
  for(let room=0;room<3;room++)for(let remaining=3;remaining>=0;remaining--){
    const position=bunkerProgress({room,enemies:Array.from({length:remaining},()=>({kind:'core',hp:5})),boss:null});
    assert.ok(position>=previous);previous=position;
  }
  assert.equal(bunkerProgress({room:2,enemies:[],boss:{hp:100}}),3840);
});
