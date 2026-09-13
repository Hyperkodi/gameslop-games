(function(root){
  'use strict';
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const JETPACK_FUEL=10;
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
  function createSupportSystem({state,event}){
    function transition(){
      state.pawnsRecruit=state.stage===2&&!state.pawnsRecruited?{x:480,y:1388,w:30,h:42,face:1,grounded:true,distance:0}:null;
      state.companion=state.pawnsRecruited?make(state.players.find(p=>p.lives>0)||state.players[0]):null;
    }
    function make(p){return {x:p.x-42,y:p.y,w:30,h:42,vx:0,vy:0,face:1,grounded:false,distance:0,cooldown:.3,burst:0,aimX:1,aimY:0,shotUntil:0,stuck:0,targetId:null};}
    function tick(dt){
      state.supportNotice=Math.max(0,(state.supportNotice||0)-dt);
      const players=state.players.filter(p=>p.lives>0),l=state.level;
      if(!players.length)return;
      const npc=state.pawnsRecruit;
      if(npc&&players.some(p=>Math.hypot(p.x-npc.x,p.y-npc.y)<75)){
        state.pawnsRecruited=true;state.companion=make(npc);state.companion.x=npc.x;state.pawnsRecruit=null;
        state.supportNotice=5;event('companionJoined');
      }
      const a=state.companion;if(!a)return;
      const leader=players.reduce((p,q)=>Math.hypot(q.x-a.x,q.y-a.y)<Math.hypot(p.x-a.x,p.y-a.y)?q:p);
      const foes=[...state.enemies,...(state.boss?[state.boss]:[])].filter(e=>e.hp>0&&Math.hypot(e.x-a.x,e.y-a.y)<520&&e.x>state.camera.x-30&&e.x<state.camera.x+990&&e.y>state.camera.y-30&&e.y<state.camera.y+570);
      const target=foes.sort((p,q)=>Math.hypot(p.x-a.x,p.y-a.y)-Math.hypot(q.x-a.x,q.y-a.y))[0];a.targetId=target?.id??null;
      const close=Math.hypot(leader.x-a.x,leader.y-a.y)<260;
      let goal=leader.x-55*(leader.face||1);
      if(target&&close)goal=target.x+(a.x<target.x?-190:190)+Math.sin(state.elapsed*.9)*35;
      const oldX=a.x,oldY=a.y;
      if(l.mode==='base'){
        const gy=target&&close?clamp(target.y+170,280,470):leader.y+35;
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
        const off=a.x<state.camera.x-80||a.y>state.camera.y+640||a.y<state.camera.y-120;
        if(off&&there&&(leader.grounded||a.y>l.height)){
          a.x=clamp(leader.x-65,there.x+5,there.x+there.w-35);a.y=there.y-a.h;a.vy=0;a.jumpTarget=null;a.grounded=true;
        }
      }
      a.distance+=Math.hypot(a.x-oldX,a.y-oldY);if(a.vx)a.face=Math.sign(a.vx);
      a.cooldown-=dt;
      if(target){
        const dx=target.x+target.w/2-a.x-15,dy=target.y+target.h/2-a.y-22,d=Math.max(1,Math.hypot(dx,dy));
        a.aimX=dx/d;a.aimY=dy/d;a.face=dx<0?-1:1;
        if(a.cooldown<=0){
          state.bullets.push({x:a.x+15+a.aimX*25,y:a.y+22+a.aimY*25,vx:a.aimX*780,vy:a.aimY*780,w:8,h:5,team:'player',source:'pawns',weapon:'M',damage:.55,ttl:1.1,hits:[]});
          a.burst++;a.cooldown=a.burst%5===0?.65:.12;a.shotUntil=state.elapsed+.09;event('shot',{weapon:'M',player:'pawns'});
        }
      }else{a.aimX=a.face;a.aimY=0;a.burst=0;}
    }
    return {transition,tick};
  }
  const api={JETPACK_FUEL,createSupportSystem,nextPlatform};
  root.SlopCommando=Object.assign(root.SlopCommando||{},api);
  if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
