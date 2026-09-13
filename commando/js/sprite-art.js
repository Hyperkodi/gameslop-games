/* Shared presentation-only sprite loading. No gameplay state is changed here. */
(function(root){
  'use strict';
  const G=root.SlopCommando=root.SlopCommando||{};
  const surfaces=new Map();
  function keyPixel(r,g,b){return r>200&&b>200&&g<70;}
  function removeMatte(pixels){
    const d=pixels.data,w=pixels.width,h=pixels.height,mask=new Uint8Array(w*h);
    for(let n=0;n<mask.length;n++){const i=n*4;if(keyPixel(d[i],d[i+1],d[i+2])){mask[n]=1;d[i+3]=0;}}
    // Despill only the immediate boundary. Interior purple armor and pink skin
    // are untouched; mixed magenta/charcoal edge pixels become charcoal again.
    for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
      const n=y*w+x,i=n*4;if(mask[n])continue;
      if(!(mask[n-1]||mask[n+1]||mask[n-w]||mask[n+w]||mask[n-w-1]||mask[n+w+1]))continue;
      const spill=Math.min(d[i],d[i+2])-d[i+1];
      if(spill>30){d[i]-=spill;d[i+2]-=spill;}
    }
    return pixels;
  }
  function loadActorAtlas(file,skin){
    const source=root.SlopCommandoActorAtlases?.[file]||'skin/'+skin.name+'/'+file;
    if(surfaces.has(source))return surfaces.get(source);
    const record={surface:null,error:null};
    record.ready=new Promise(resolve=>{
      const image=new Image();
      image.onload=()=>{
        try{
          const canvas=document.createElement('canvas');canvas.width=image.naturalWidth||image.width;canvas.height=image.naturalHeight||image.height;
          const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);
          const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);
          ctx.putImageData(removeMatte(pixels),0,0);record.surface=canvas;resolve(true);
        }catch(error){record.error=String(error);resolve(false);}
      };
      image.onerror=()=>{record.error='Could not load '+file;resolve(false);};image.src=source;
    });
    surfaces.set(source,record);return record;
  }
  // Stride lengths are in game pixels. Walking therefore slows with the actor,
  // including slowdown effects, rather than running in place at a fixed FPS.
  const profiles={
    soldier:{stride:27,bob:1.1,recoil:2},turret:{stride:1,bob:0,recoil:2.2},
    drone:{stride:32,bob:1.6,hover:5,bank:.07,recoil:2},
    vineMantis:{stride:34,bob:3.2,hop:true,recoil:1.2},
    securitySpider:{stride:29,bob:1.2,recoil:1.8},
    riverRay:{stride:42,bob:1.5,hover:3,bank:.04,recoil:1.2},
    reactorOrb:{stride:42,bob:.8,hover:2.5,bank:.025,recoil:2.5},
    iceWolf:{stride:38,bob:1.7,contact:true,recoil:0},
    slagCrab:{stride:38,bob:1.8,recoil:3},
    caveBat:{stride:40,bob:1.4,hover:6,bank:.1,contact:true,recoil:0},
    sporeWasp:{stride:26,bob:1.9,hover:4,bank:.025,recoil:1},
    core:{stride:1,bob:0,recoil:0}
  };
  const bossProfiles=[
    {stride:64,bob:.55,recoil:4}, // Chump's tracks
    {stride:68,bob:2.2,recoil:3}, // GreenHood's walker
    {stride:74,bob:1.2,hover:2,bank:.012,recoil:3},
    {stride:90,bob:.8,hover:1.4,bank:.015,recoil:4},
    {stride:70,bob:1.7,recoil:3}, // Moo's four-legged chassis
    {stride:75,bob:.65,recoil:4}, // Pipedog's locomotive
    {stride:70,bob:1.4,hover:2.3,bank:.015,recoil:2},
    {stride:80,bob:1,hover:1.8,bank:.012,recoil:3}
  ];
  function profileFor(e){return e.kind==='boss'?bossProfiles[e.variant||0]:profiles[e.kind]||profiles.soldier;}
  function createAnimationClock(){
    let last=null,value=0,wasPaused=false;
    return (now,paused=false)=>{
      if(last!==null&&now>=last&&!paused&&!wasPaused)value+=Math.min(.05,now-last);
      last=now;wasPaused=paused;return value;
    };
  }
  function animationSample(e,time,previous,targetX,tick){
    const old=previous&&time>=previous.time?previous:null,dt=old?time-old.time:0;
    const distance=old?Math.hypot(e.x-old.x,e.y-old.y):0;
    const stride=profileFor(e).stride;
    const shotChanged=Number.isFinite(e.attackTick)&&e.attackTick!==old?.attackTick;
    const recent=tick===undefined||tick-e.attackTick<=3;
    const sample={x:e.x,y:e.y,time,attackTick:e.attackTick,hp:e.hp,
      stride:(old?.stride||0)+(distance<100?distance/stride:0),
      moving:dt>0?distance>.005:old?.moving||false,
      speed:dt>0?Math.min(240,distance/dt):old?.speed||0,
      shotUntil:shotChanged&&recent?time+.18:old?.shotUntil??-1,
      hurtUntil:old&&e.hp<old.hp?time+.16:old?.hurtUntil??-1,
      facing:Number.isFinite(targetX)?(targetX<e.x+(e.w||32)/2?-1:1):old?.facing||-1,
      targeted:Number.isFinite(targetX)};
    return sample;
  }
  function enemyState(e,meta,time,sample={}){
    if(e.hp<=0)return 'defeat';
    if(e.flash>0||sample.hurtUntil>time)return 'hurt';
    if(e.kind==='core'){
      if(sample.shotUntil>time)return 'attack';
      if(sample.targeted&&e.cooldown>=0&&e.cooldown<.24)return 'windup';
      return e.hp<e.maxHp*.4?'alert':'idle';
    }
    const profile=profileFor(e);
    if(profile.contact){
      if(e.kind==='iceWolf'&&sample.moving&&Math.sin((e.phase||0)*2)>.7)return 'charge';
      if(e.kind==='caveBat'&&sample.moving&&sample.speed>80)return 'charge';
    }else{
      if(sample.shotUntil>time)return 'attack';
      if(sample.targeted&&e.cooldown>=0&&e.cooldown<.24)return 'windup';
    }
    return sample.moving&&!meta.stationary?'move':'idle';
  }
  function enemyFrame(e,meta,time,sample={},state=enemyState(e,meta,time,sample)){
    const extra=meta.frames?.length>=8;
    if(e.kind==='boss')return state==='defeat'?(meta.defeatFrame??3):state==='hurt'?3:state==='attack'?2:state==='windup'?1:0;
    if(state==='defeat')return extra?7:e.kind==='core'?3:0;
    if(state==='hurt')return extra?6:0;
    if(state==='windup')return extra?4:0;
    if(state==='charge'&&e.kind==='iceWolf')return [extra?5:3,1,extra?5:3,2][Math.floor((sample.stride||0)*4)%4];
    if(state==='attack'||state==='charge')return extra?5:3;
    if(state==='alert')return 2;
    if(state==='move')return [1,0,2,0][Math.floor((sample.stride||0)*4)%4];
    if(e.kind==='core'||e.kind==='turret')return Math.floor(time*2)%6===0?1:0;
    return 0;
  }
  function actorMotion(e,time,sample,state){
    if(state==='defeat')return {x:0,y:0,angle:0,sx:1,sy:1};
    const p=profileFor(e),phase=(sample.stride||0)*Math.PI*2;
    const cycle=Math.sin(phase),moving=state==='move'||state==='charge';
    const hover=p.hover?Math.sin(time*p.hover+(e.phase||0)):0;
    let x=0,y=p.hover?hover*p.bob:0,angle=p.bank?hover*p.bank:0,sx=1,sy=1;
    if(moving&&!p.hover)y=-Math.abs(cycle)*p.bob;
    if(p.hop&&moving){sx=1+Math.abs(cycle)*.025;sy=1-Math.abs(cycle)*.025;}
    if(e.kind==='iceWolf'&&state==='charge')angle=.07;
    if(state==='windup'){sy=.98;sx=1.015;}
    if(state==='attack'){const kick=Math.max(0,Math.min(1,(sample.shotUntil-time)/.18));x=-p.recoil*kick;angle-=kick*.025;}
    if(state==='hurt'){x=-1.5;angle=-.035;}
    return {x,y,angle,sx,sy};
  }
  function createDefeatTracker(){
    let previous=new Set(),seen=new WeakSet(),ghosts=[],stage,room,players,lastTime=-1;
    return (state,time)=>{
      if(stage!==state.stage||room!==state.room||players!==state.players||time<lastTime||state.status==='ready'){
        previous.clear();seen=new WeakSet();ghosts=[];
      }
      const current=new Set([...state.enemies,...(state.boss?[state.boss]:[])]);
      // The engine retains a defeated boss after clear, but removes normal foes.
      for(const e of new Set([...previous,...current]))if(e.hp<=0&&!seen.has(e)){
        seen.add(e);ghosts.push({source:e,actor:{...e,flash:0},start:time,duration:e.kind==='boss'?.95:.6});
      }
      ghosts=ghosts.filter(g=>time-g.start<g.duration);
      previous=current;stage=state.stage;room=state.room;players=state.players;lastTime=time;
      return ghosts;
    };
  }
  function createCastRenderer(ctx,skin){
    const cast=skin.cast, records=new Map(),history=new WeakMap();
    const defeats=createDefeatTracker();let tick;
    for(const file of cast.atlases.slice(1))records.set(file,loadActorAtlas(file,skin));
    function draw(e,time,targetX,options={}){
      const meta=e.kind==='boss'?cast.bosses[e.variant||0]:cast.enemies[e.kind];
      if(!meta)return false;
      if(e.hp<=0&&!options.defeated&&options.state!=='defeat')return true;
      const prev=animationSample(e,time,history.get(e),targetX,tick);history.set(e,prev);
      const state=options.state||enemyState(e,meta,time,prev);
      // State overrides are only used by the cast review and defeat presentation.
      if(options.stride!==undefined){prev.stride=options.stride;prev.moving=true;}
      if(options.state==='attack')prev.shotUntil=time+.12;
      const frame=meta.frames[enemyFrame(e,meta,time,prev,state)];
      const surface=records.get(frame.atlas||meta.atlas)?.surface;if(!surface)return false;
      const [sx,sy,sw,sh]=frame.rect,[ax,ay]=frame.anchor;
      // One scale per character: changing poses cannot inflate the character.
      const scale=Math.min(meta.height/meta.standingHeight,(e.kind==='boss'?178:72)/meta.frames[0].rect[2])*(frame.scale||1);
      const cx=e.x+(e.w||32)/2,feet=e.y+(e.h||34);
      const motion=actorMotion(e,time,prev,state);
      ctx.save();ctx.translate(cx,feet+motion.y);ctx.scale(prev.facing,1);
      ctx.translate(motion.x,0);ctx.rotate(motion.angle);ctx.scale(motion.sx,motion.sy);
      ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
      ctx.shadowColor='#071219';ctx.shadowBlur=1.2;
      if(e.flash>0&&state!=='defeat')ctx.filter='brightness(1.35)';
      ctx.drawImage(surface,sx,sy,sw,sh,-ax*scale,-ay*scale,sw*scale,sh*scale);
      ctx.restore();return true;
    }
    function drawDefeats(state,time){
      tick=state.tick;
      for(const ghost of defeats(state,time)){
        const t=(time-ghost.start)/ghost.duration,e=ghost.actor;
        ctx.save();ctx.globalAlpha=Math.min(1,(1-t)*2);
        ctx.translate(0,t*t*(e.kind==='boss'?12:5));
        const facing=history.get(ghost.source)?.facing||-1;
        draw(e,time,e.x+e.w/2+facing*100,{defeated:true,state:t<.2?'hurt':'defeat'});ctx.restore();
      }
    }
    return {draw,drawDefeats,ready:Promise.all([...records.values()].map(r=>r.ready)),records};
  }
  const api={loadActorAtlas,createCastRenderer,enemyFrame,enemyState,animationSample,actorMotion,profileFor,createAnimationClock,createDefeatTracker,keyPixel,removeMatte};
  Object.assign(G,api);
  if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
