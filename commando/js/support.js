(function(root){
  'use strict';
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const JETPACK_FUEL=10;
  const allySpecs=[
    {id:'pawns',name:'Pawns',stage:2,weapon:'M',range:520,spacing:55,speed:780,damage:.55,ttl:1.1,delay:.12},
    {id:'wojak',name:'Wojak',stage:4,weapon:'L',range:610,spacing:105,speed:1150,damage:1.5,ttl:.7,delay:.65,pierce:true},
    {id:'sloppy',name:'Sloppy',stage:6,weapon:'F',range:225,spacing:155,speed:400,damage:.55,ttl:.5,delay:.13}
  ];
  const recruitedCount=state=>allySpecs.filter(s=>state[s.id+'Recruited']).length;
  const reinforcementCount=(base,count)=>Math.floor(base*count/5);
  const support=(a,platforms)=>platforms.filter(p=>a.x+a.w>p.x&&a.x<p.x+p.w&&p.y>=a.y+a.h-2).sort((a,b)=>a.y-b.y)[0];
  // Directed platform graph: solve the ballistic flight time for each landing.
  function nextPlatform(from,to,platforms){
    if(!from||!to||from===to)return null;
    const queue=[from],previous=new Map([[from,null]]);
    for(let i=0;i<queue.length;i++){
      const a=queue[i];
      for(const b of platforms){
        if(previous.has(b))continue;
        const discriminant=520*520+2300*(b.y-a.y);
        const gap=Math.max(0,b.x-a.x-a.w,a.x-b.x-b.w);
        if(discriminant<0||b.y-a.y>300||gap+24>225*(520+Math.sqrt(discriminant))/1150)continue;
        previous.set(b,a);queue.push(b);
        if(b===to){let step=b;while(previous.get(step)!==from)step=previous.get(step);return step;}
      }
    }
    return null;
  }
  function createSupportSystem({state,event,onRecruit=()=>{}}){
    function recruitmentPoint(spec){
      if(spec.id==='pawns')return {x:480,y:1388};
      const middle=state.level.width/2;
      const floor=state.level.platforms.filter(p=>p.ground&&p.w>=100)
        .sort((a,b)=>Math.abs(clamp(middle,a.x+45,a.x+a.w-45)-middle)-Math.abs(clamp(middle,b.x+45,b.x+b.w-45)-middle))[0];
      return {x:clamp(middle,floor.x+40,floor.x+floor.w-70),y:floor.y-42};
    }
    function aliases(){
      state.pawnsRecruit=state.recruits.find(a=>a.allyId==='pawns')||null;
      state.companion=state.companions.find(a=>a.allyId==='pawns')||null;
    }
    function transition(){
      const leader=state.players.find(p=>p.lives>0)||state.players[0];
      state.recruits=allySpecs.filter(s=>state.stage===s.stage&&!state[s.id+'Recruited']).map(s=>({...make(recruitmentPoint(s),s),...recruitmentPoint(s),grounded:true}));
      state.companions=allySpecs.filter(s=>state[s.id+'Recruited']).map(s=>make(leader,s));
      aliases();
    }
    function make(p,spec){return {allyId:spec.id,weapon:spec.weapon,x:p.x-spec.spacing,y:p.y,w:30,h:42,vx:0,vy:0,face:1,grounded:false,distance:0,cooldown:.3,burst:0,aimX:1,aimY:0,shotUntil:0,stuck:0,targetId:null};}
    function tick(dt){
      state.supportNotice=Math.max(0,(state.supportNotice||0)-dt);
      const players=state.players.filter(p=>p.lives>0),l=state.level;
      if(!players.length)return;
      for(const npc of [...(state.recruits||[])]){
        if(!players.some(p=>Math.hypot(p.x-npc.x,p.y-npc.y)<85||(l.mode==='run'?p.x>=npc.x:p.y<=npc.y)))continue;
        const spec=allySpecs.find(s=>s.id===npc.allyId);
        state[spec.id+'Recruited']=true;state.companions.push({...make(npc,spec),x:npc.x});
        state.recruits=state.recruits.filter(a=>a!==npc);aliases();
        state.supportNotice=5;state.supportNoticeName=spec.name;event('companionJoined',{ally:spec.id});onRecruit(spec.id);
      }
      for(const a of state.companions||[])tickAlly(a,dt,players,l);
    }
    function tickAlly(a,dt,players,l){
      const spec=allySpecs.find(s=>s.id===a.allyId);
      const leader=players.reduce((p,q)=>Math.hypot(q.x-a.x,q.y-a.y)<Math.hypot(p.x-a.x,p.y-a.y)?q:p);
      const foes=[...state.enemies,...(state.boss?[state.boss]:[])].filter(e=>e.hp>0&&Math.hypot(e.x-a.x,e.y-a.y)<spec.range+120&&e.x>state.camera.x-30&&e.x<state.camera.x+990&&e.y>state.camera.y-30&&e.y<state.camera.y+570);
      const target=foes.sort((p,q)=>Math.hypot(p.x-a.x,p.y-a.y)-Math.hypot(q.x-a.x,q.y-a.y))[0];a.targetId=target?.id??null;
      const close=Math.hypot(leader.x-a.x,leader.y-a.y)<260;
      let goal=leader.x-spec.spacing*(leader.face||1);
      if(target&&close)goal=target.x+(a.x<target.x?-(spec.weapon==='F'?110:190):spec.weapon==='F'?110:190)+Math.sin(state.elapsed*.9+spec.spacing)*25;
      const oldX=a.x,oldY=a.y;
      if(l.mode==='base'){
        const gy=target&&close?clamp(target.y+(spec.weapon==='F'?105:170),260,470):leader.y+35;
        const dx=goal-a.x,dy=gy-a.y,d=Math.max(1,Math.hypot(dx,dy));
        a.vx=Math.abs(dx)>10?dx/d*185:0;a.vy=Math.abs(dy)>10?dy/d*185:0;
        a.x=clamp(a.x+a.vx*dt,100,830);a.y=clamp(a.y+a.vy*dt,260,478);a.grounded=true;
      }else{
        const here=support(a,l.platforms),there=support(leader,l.platforms);
        const next=nextPlatform(here,there,l.platforms);
        if(a.grounded&&here&&next){
          const overlapLo=Math.max(here.x+8,next.x+8),overlapHi=Math.min(here.x+here.w-38,next.x+next.w-38);
          const takeoff=overlapLo<=overlapHi?clamp(a.x,overlapLo,overlapHi):next.x>here.x?here.x+here.w-38:here.x+8;
          goal=takeoff;
          if(Math.abs(a.x-takeoff)<8){a.vy=-520;a.grounded=false;a.jumpTarget=next;}
        }
        if(!a.grounded&&a.jumpTarget)goal=clamp(a.x,a.jumpTarget.x+8,a.jumpTarget.x+a.jumpTarget.w-38);
        if(a.grounded&&here&&!next)goal=clamp(goal,here.x+5,here.x+here.w-35);
        a.vx=Math.abs(goal-a.x)>5?Math.sign(goal-a.x)*225:0;
        a.x=clamp(a.x+a.vx*dt,0,l.width-a.w);
        const feet=a.y+a.h;a.vy+=1150*dt;a.y+=a.vy*dt;a.grounded=false;
        if(a.vy>=0){
          const land=l.platforms.filter(p=>a.x+a.w>p.x&&a.x<p.x+p.w&&feet<=p.y+1&&a.y+a.h>=p.y).sort((p,q)=>p.y-q.y)[0];
          if(land){a.y=land.y-a.h;a.vy=0;a.grounded=true;a.jumpTarget=null;}
        }
        // Recover only when outside the view, onto a real surface near the player.
        const off=a.x<state.camera.x-80||a.x>state.camera.x+1040||a.y>state.camera.y+640||a.y<state.camera.y-120;
        if(off&&there&&(leader.grounded||a.y>l.height)){
          a.x=clamp(leader.x-spec.spacing,there.x+5,there.x+there.w-35);a.y=there.y-a.h;a.vy=0;a.jumpTarget=null;a.grounded=true;
        }
      }
      a.distance+=Math.hypot(a.x-oldX,a.y-oldY);if(a.vx)a.face=Math.sign(a.vx);
      a.cooldown-=dt;
      if(target){
        const dx=target.x+target.w/2-a.x-15,dy=target.y+target.h/2-a.y-22,d=Math.max(1,Math.hypot(dx,dy));
        a.aimX=dx/d;a.aimY=dy/d;a.face=dx<0?-1:1;
        if(a.cooldown<=0&&d<spec.range){
          state.bullets.push({x:a.x+15+a.aimX*25,y:a.y+22+a.aimY*25,vx:a.aimX*spec.speed,vy:a.aimY*spec.speed,w:spec.weapon==='L'?18:8,h:spec.weapon==='F'?14:5,team:'player',source:spec.id,weapon:spec.weapon,damage:spec.damage,ttl:spec.ttl,pierce:!!spec.pierce,hits:[]});
          a.burst++;a.cooldown=spec.id==='pawns'&&a.burst%5===0?.65:spec.delay;a.shotUntil=state.elapsed+.09;event('shot',{weapon:spec.weapon,player:spec.id});
        }
      }else{a.aimX=a.face;a.aimY=0;a.burst=0;}
    }
    return {transition,tick};
  }
  const api={JETPACK_FUEL,createSupportSystem,nextPlatform,allySpecs,recruitedCount,reinforcementCount};
  root.SlopCommando=Object.assign(root.SlopCommando||{},api);
  if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
