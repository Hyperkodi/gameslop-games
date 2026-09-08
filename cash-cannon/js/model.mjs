// Fixed 120 Hz simulation. A seed, launch angle and power reproduce a whole run.
import {EXCHANGES,exchangeFor} from './exchanges.mjs';
import {RUG_DURATION} from './animations.mjs';
export const VERSION='cash-cannon-v2',DT=1/120,RADIUS=22,MAX_TICKS=120*180;
export const OBJECTS={
  dex:{name:'DEX BOOST',description:'A trampoline bounce that keeps the run alive.',color:'#bbff68'},
  cabal:{name:'CABAL PUSH',description:'Ground explosives. A very coordinated push.',color:'#ff8548'},
  cex:{name:'CEX LISTING',description:'Eleven exchange balloons. Pop one for a listing boost.',color:'#b09bff'},
  honey:{name:'HONEY POT',description:'Looks sweet. Swallows your entire run.',color:'#ffce62'},
  rug:{name:'RUG PULL',description:'A soft landing. Then the rug whips away beneath you.',color:'#ff514f'}
};
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function random(s){s.rng=(Math.imul(s.rng,1664525)+1013904223)>>>0;return s.rng/4294967296;}
export function createRun(seed=0x43415348){
  const s={version:VERSION,seed:seed>>>0,rng:seed>>>0,phase:'aim',tick:0,angle:35,power:.5,x:90,y:42,vx:0,vy:0,rotation:0,spin:0,startX:90,maxX:90,score:0,boosts:0,bounces:0,peak:0,objects:[],nextX:360,objectId:0,events:[],reason:null,endTicks:0,endingLength:0,impact:null,restTicks:0,launch:null};
  populate(s);return s;
}
export function powerAt(tick){return .15+.85*(1-Math.abs((tick%156)/78-1));}
export function setAngle(s,angle){if(s.phase==='aim'&&Number.isFinite(angle))s.angle=clamp(angle,10,60);}
export function launch(s,power=powerAt(s.tick)){
  if(s.phase!=='aim'||!Number.isFinite(power))return false;
  s.power=clamp(power,.15,1);s.launch={version:VERSION,seed:s.seed,angle:s.angle,power:s.power};
  const rad=s.angle*Math.PI/180,speed=310+s.power*700;
  s.x=90+Math.cos(rad)*88;s.y=42+Math.sin(rad)*88;s.startX=s.x;s.maxX=s.x;
  s.vx=Math.cos(rad)*speed;s.vy=Math.sin(rad)*speed;s.spin=3.5+s.power*4;s.phase='flight';s.tick=0;
  s.events=[{type:'launch',x:s.x,y:s.y}];populate(s);return true;
}
function populate(s){
  while(s.nextX<s.x+2300){
    const roll=random(s),kind=roll<.26?'dex':roll<.49?'cabal':roll<.70?'cex':roll<.84?'honey':'rug';
    // Give the opening stretch a chance to build momentum before deadly traps.
    const chosen=s.objectId<2?['dex','cex'][s.objectId]:kind;
    const exchange=chosen==='cex'?(s.seed%EXCHANGES.length+(s.cexCount??0)*7)%EXCHANGES.length:0;
    if(chosen==='cex')s.cexCount=(s.cexCount??0)+1;
    s.objects.push({id:s.objectId++,kind:chosen,exchange,x:s.nextX,y:chosen==='cex'?160+random(s)*280:0,used:false,phase:random(s)*Math.PI*2});
    s.nextX+=210+random(s)*280;
  }
  s.objects=s.objects.filter(o=>o.x>s.x-1600);
}
export function objectY(o,tick){return o.y+(o.kind==='cex'?Math.sin(tick/100+o.phase)*13:0);}
function segmentBox(ax,ay,bx,by,left,right,bottom,top){
  let enter=0,leave=1;
  for(const [a,d,min,max] of [[ax,bx-ax,left,right],[ay,by-ay,bottom,top]]){
    if(Math.abs(d)<1e-10){if(a<min||a>max)return null;continue;}
    let t0=(min-a)/d,t1=(max-a)/d;if(t0>t1)[t0,t1]=[t1,t0];enter=Math.max(enter,t0);leave=Math.min(leave,t1);
    if(enter>leave)return null;
  }
  return enter;
}
function end(s,reason,object=null){
  s.phase='ending';s.reason=reason;s.endTicks=reason==='honey'?160:reason==='rug'?Math.round(RUG_DURATION/DT):65;s.endingLength=s.endTicks;
  s.impact={x:s.x,y:s.y,object};s.vx=0;s.vy=0;s.events.push({type:'end',reason,x:s.x,y:s.y});
}
function hit(s,o){
  o.used=true;o.hitTick=s.tick;s.events.push({type:o.kind,x:o.x,y:objectY(o,s.tick),label:o.kind==='cex'?exchangeFor(o).name.toUpperCase()+' LISTING!':OBJECTS[o.kind].name});
  if(o.kind==='honey'||o.kind==='rug'){end(s,o.kind,o);return;}
  s.boosts++;
  if(o.kind==='dex'){s.y=Math.max(s.y,56);s.vy=Math.max(700,Math.abs(s.vy)*1.08);s.vx=Math.max(280,s.vx+45);}
  if(o.kind==='cabal'){s.y=Math.max(s.y,75);s.vy=820;s.vx+=180;}
  if(o.kind==='cex'){s.vy=Math.max(s.vy,510)+180;s.vx+=150;}
  s.vy=Math.min(s.vy,1050);s.vx=Math.min(s.vx,1250);s.spin=5+s.boosts%5;
}
export function step(s){
  s.events=[];
  if(s.phase==='done')return s;
  s.tick++;
  if(s.phase==='aim'){s.power=powerAt(s.tick);return s;}
  if(s.phase==='ending'){if(--s.endTicks<=0){s.phase='done';s.events.push({type:'result'});}return s;}
  const ox=s.x,oy=s.y;
  s.vy-=620*DT;s.vx*=Math.exp(-.028*DT);s.x+=s.vx*DT;s.y+=s.vy*DT;s.rotation+=s.spin*DT;
  populate(s);
  let candidate=null,first=2;
  for(const o of s.objects){
    if(o.used||Math.abs(o.x-s.x)>150)continue;
    if((o.kind==='dex'||o.kind==='rug')&&s.vy>=0)continue;
    const cy=objectY(o,s.tick),half=o.kind==='rug'?68:o.kind==='cex'?43:o.kind==='honey'?49:48;
    let t=segmentBox(ox,oy,s.x,s.y,o.x-half-RADIUS,o.x+half+RADIUS,o.kind==='cex'?cy-53-RADIUS:0,o.kind==='cex'?cy+53+RADIUS:o.kind==='dex'?35+RADIUS:o.kind==='honey'?91+RADIUS:o.kind==='rug'?8+RADIUS:66+RADIUS);
    if(o.kind==='cex'){
      const bomb=segmentBox(ox,oy,s.x,s.y,o.x-23-RADIUS,o.x+23+RADIUS,cy-106-RADIUS,cy-62+RADIUS);
      if(bomb!==null&&(t===null||bomb<t))t=bomb;
    }
    if(t!==null&&t<first){candidate=o;first=t;}
  }
  if(candidate){s.x=ox+(s.x-ox)*first;s.y=oy+(s.y-oy)*first;hit(s,candidate);}
  s.maxX=Math.max(s.maxX,s.x);s.score=Math.max(0,Math.floor(s.maxX-s.startX));s.peak=Math.max(s.peak,s.y);
  if(s.phase==='flight'&&s.y<RADIUS){
    s.y=RADIUS;
    if(Math.abs(s.vy)>115){s.vy=Math.abs(s.vy)*.57;s.vx*=.77;s.spin*=.8;s.bounces++;s.events.push({type:'bounce',x:s.x,y:0});}
    else{s.vy=0;s.vx=Math.max(0,s.vx-330*DT);s.spin=s.vx/70;s.restTicks++;}
    if(s.vx<28&&s.restTicks>20)end(s,'out-of-gas');
  }
  if(s.phase==='flight'&&s.tick>=MAX_TICKS)end(s,'market-closed');
  return s;
}
export function replay(config){
  if(config?.version!==VERSION||!Number.isInteger(config.seed)||config.seed<0||config.seed>0xffffffff||!Number.isFinite(config.angle)||config.angle<10||config.angle>60||!Number.isFinite(config.power)||config.power<.15||config.power>1)throw Error('Invalid launch evidence');
  const s=createRun(config.seed);setAngle(s,config.angle);launch(s,config.power);while(s.phase!=='done')step(s);return s;
}
