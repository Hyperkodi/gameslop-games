'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {panoramaLayout}=require('../js/environment.js'),{buildLevel}=require('../js/levels.js');
const directory=path.join(__dirname,'../skin/gameslop');
const skin=JSON.parse(fs.readFileSync(path.join(directory,'skin.json'),'utf8'));
test('six scrolling levels have complete world-sized panoramas; bunker floors keep their renderer',()=>{
 assert.deepEqual(Object.keys(skin.environment.panoramas),['0','2','4','5','6','7']);
 for(const [stage,p]of Object.entries(skin.environment.panoramas)){
  const level=buildLevel(+stage);assert.equal(p.width,level.width);assert.equal(p.height,p.vertical?level.height:540);
  let end=0;
  for(const t of p.tiles){
   const png=fs.readFileSync(path.join(directory,t.file));assert.equal(png.toString('ascii',1,4),'PNG');
   assert.equal(png.readUInt32BE(16),t.w);assert.equal(png.readUInt32BE(20),t.h);assert.ok(t.w<=2048&&t.h<=2048);
   const start=p.vertical?t.y:t.x,length=p.vertical?t.h:t.w;
   if(end)assert.ok(end-start>=96,'at least 96 identical source pixels overlap');else assert.equal(start,0);
   assert.ok(t.x+t.w<=p.width&&t.y+t.h<=p.height);end=start+length;
  }
  assert.equal(end,p.vertical?p.height:p.width);
 }
});
test('panoramas cover every scanline at every camera pixel, including reverse scrolling and both endpoints',()=>{
 for(const [stage,p]of Object.entries(skin.environment.panoramas)){
  const level=buildLevel(+stage),extent=p.vertical?p.height-540:p.width-960,viewport=p.vertical?540:960;
  for(let pos=extent;pos>=0;pos--){
   const state={level,camera:{x:p.vertical?0:pos,y:p.vertical?pos:0}},layout=panoramaLayout(state,p);
   assert.ok(layout.visible.length<=3);let end=0;
   for(const t of layout.visible){const start=p.vertical?t.y:t.x;assert.ok(start<=end);end=Math.max(end,start+(p.vertical?t.h:t.w));}
   assert.ok(end>=viewport);assert.equal(layout.position,pos);
  }
 }
});
test('fractional camera movements preserve exact world alignment with no snap or recropping',()=>{
 for(const [stage,p]of Object.entries(skin.environment.panoramas)){
  const level=buildLevel(+stage),state={level,camera:{x:123.25,y:123.25}},a=panoramaLayout(state,p);
  state.camera={x:123.75,y:123.75};const b=panoramaLayout(state,p);
  for(const t of a.visible){const next=b.visible.find(n=>n.index===t.index);if(next)assert.ok(Math.abs((p.vertical?t.y-next.y:t.x-next.x)-.5)<1e-9);}
 }
});
function loader({fail=false,original=false}={}){
 const requested=[];class Image{set src(value){requested.push(value);queueMicrotask(()=>value.includes('panoramas-v1/')&&fail?this.onerror():this.onload());}}
 const sandbox={Image,location:{search:original?'?scenery=original':''}};sandbox.window=sandbox;vm.createContext(sandbox);
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/environment.js'),'utf8'),sandbox);
 return {requested,renderer:sandbox.SlopCommando.createEnvironmentRenderer({},skin,{})};
}
test('successful panorama loading avoids downloading the old atlas as well',async()=>{
 const {requested,renderer}=loader();assert.equal(await renderer.ready,true);assert.equal(requested.length,7);assert.ok(requested.every(p=>p.includes('panoramas-v1/')));
 const count=requested.length;await renderer.loadStage(0);assert.equal(requested.length,count);
});
test('a failed panorama tile falls back to the complete original atlas',async()=>{
 const {requested,renderer}=loader({fail:true});assert.equal(await renderer.ready,true);assert.match(requested.at(-1),/environment-jungle-v2.png$/);assert.equal(requested.length,8);
});
test('original scenery query loads only the preserved atlas',async()=>{
 const {requested,renderer}=loader({original:true});assert.equal(await renderer.ready,true);assert.equal(requested.length,1);assert.match(requested[0],/environment-jungle-v2.png$/);
});
