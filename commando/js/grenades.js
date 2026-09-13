/* Deterministic grenade flight, blast zones and elemental matchups. */
(function(root){
  'use strict';
  const types={
    frag:{name:'FRAG',color:'#d4d29a',radius:145,damage:7,duration:0},
    incendiary:{name:'INCENDIARY',color:'#ff9a42',radius:84,damage:1.3,duration:4,pulse:.5,pulseDamage:.7},
    electric:{name:'ELECTRIC STUN',color:'#79dfff',radius:108,damage:.65,duration:3.5,pulse:.45,pulseDamage:.35}
  };
  const order=Object.keys(types),recharge=6;
  const fireWeak=new Set(['soldier','vineMantis','securitySpider']);
  const mechanical=new Set(['drone','turret','reactorOrb','core']);
  function affinity(e,type){
    if(type==='frag')return 1;
    // Boss armor remains vulnerable to electricity without taking the full
    // ordinary-machine multiplier. Mixed organic/piloted foes remain neutral.
    if(e.kind==='boss')return type==='electric'?1.25:.8;
    if(type==='incendiary')return fireWeak.has(e.kind)?1.8:mechanical.has(e.kind)?.6:1;
    return mechanical.has(e.kind)?2:1;
  }
  function inRadius(e,x,y,radius){
    const px=Math.max(e.x,Math.min(x,e.x+e.w)),py=Math.max(e.y,Math.min(y,e.y+e.h));
    return Math.hypot(px-x,py-y)<=radius;
  }
  function createGrenadeSystem({state,damage,event}){
    let nextId=0;
    const targets=()=>[...state.enemies,...(state.boss?[state.boss]:[])].filter(e=>e.hp>0);
    function reset(){state.grenades=[];state.grenadeZones=[];nextId=0;}
    function affect(e,type,amount,at){
      if(e.hp<=0)return;
      const factor=affinity(e,type);
      damage(e,amount*factor,at);
      if(type==='incendiary')e.burning=.55;
      if(type==='electric'){
        e.electrified=.48;
        if(e.kind==='boss')e.disrupted=Math.max(e.disrupted||0,.5);
        else e.stunned=Math.max(e.stunned||0,mechanical.has(e.kind)?.6:.14);
      }
    }
    function detonate(g){
      if(g.exploded)return;g.exploded=true;
      const spec=types[g.type];event('grenadeImpact',{grenade:g.type});
      for(const e of targets()){
        if(inRadius(e,g.x,g.y,spec.radius))affect(e,g.type,spec.damage,g);
        if(state.status!=='playing')return;
      }
      state.grenadeZones.push({id:nextId++,type:g.type,x:g.x,y:g.y,radius:spec.radius,
        duration:spec.duration||.32,ttl:spec.duration||.32,pulseIn:spec.pulse||Infinity,base:g.base,vy:0});
    }
    function launch(p){
      if(p.lives<=0||state.status!=='playing'||(p.grenadeCooldown||0)>1e-9)return false;
      const type=types[p.grenadeType]?p.grenadeType:'frag',base=state.level.mode==='base';
      let dx=Number(!!p.held.right)-Number(!!p.held.left),dy=Number(!!p.held.down)-Number(!!p.held.up);
      if(!dx&&!dy){dx=base?0:p.face;dy=base?-1:0;}
      if(!base&&p.grounded&&dy>0)dy=0;
      if(!dx&&!dy)dx=p.face;
      const d=Math.hypot(dx,dy)||1;
      state.grenades.push({id:nextId++,type,owner:p.id,x:p.x+p.w/2,y:p.y+p.h/2,
        vx:base?dx/d*310:dx/d*320,vy:base?dy/d*310:dy<0?-390:dy>0?120:-270,
        base,fuse:1.05,age:0,exploded:false});
      p.grenadeCooldown=recharge;event('grenadeThrow',{grenade:type,player:p.id});return true;
    }
    function tick(dt){
      for(const g of state.grenades){
        if(g.exploded)continue;
        g.age+=dt;g.fuse-=dt;
        const lastY=g.y;g.x+=g.vx*dt;
        if(g.base){
          g.y+=g.vy*dt;
          if(g.age>.65){g.vx*=.86;g.vy*=.86;}
          const x=Math.max(104,Math.min(g.x,856)),y=Math.max(110,Math.min(g.y,500));
          if(x!==g.x)g.vx*=-.45;if(y!==g.y)g.vy*=-.45;g.x=x;g.y=y;
        }else{
          g.vy+=780*dt;g.y+=g.vy*dt;
          const landing=state.level.platforms.filter(p=>g.x>=p.x&&g.x<=p.x+p.w&&lastY<=p.y&&g.y>=p.y).sort((a,b)=>a.y-b.y)[0];
          if(landing&&g.vy>=0){
            g.y=landing.y-1;
            if(g.type==='frag')detonate(g);
            else {g.vy=Math.abs(g.vy)>90?-g.vy*.25:0;g.vx*=.6;}
          }
          if(g.x<0||g.x>state.level.width){g.vx*=-.4;g.x=Math.max(0,Math.min(g.x,state.level.width));}
        }
        if(!g.exploded&&g.type==='frag'&&targets().some(e=>inRadius(e,g.x,g.y,5)))detonate(g);
        if(g.fuse<=1e-9)detonate(g);
        if(state.status!=='playing')break;
      }
      state.grenades=state.grenades.filter(g=>!g.exploded&&g.y<state.level.height+100);
      for(const zone of state.grenadeZones){
        zone.ttl-=dt;
        // Fire settles onto a supporting surface instead of floating over a gap.
        if(zone.type==='incendiary'&&!zone.base){
          const lastY=zone.y;zone.vy+=780*dt;zone.y+=zone.vy*dt;
          const landing=state.level.platforms.filter(p=>zone.x>=p.x&&zone.x<=p.x+p.w&&lastY<=p.y&&zone.y>=p.y).sort((a,b)=>a.y-b.y)[0];
          if(landing){zone.y=landing.y-1;zone.vy=0;}
        }
        const spec=types[zone.type];zone.pulseIn-=dt;
        if(spec.duration&&zone.ttl>0&&zone.pulseIn<=1e-9){
          zone.pulseIn+=spec.pulse;
          for(const e of targets()){
            // In side-view, flames rise from the floor; electricity fills a disk.
            const fireReach=zone.base||e.y+e.h>=zone.y-42;
            if(inRadius(e,zone.x,zone.y,zone.radius)&&(zone.type!=='incendiary'||fireReach))affect(e,zone.type,spec.pulseDamage,zone);
            if(state.status!=='playing')break;
          }
          if(zone.type==='electric')event('grenadePulse',{grenade:zone.type});
        }
        if(state.status!=='playing')break;
      }
      state.grenadeZones=state.grenadeZones.filter(z=>z.ttl>0&&z.y<state.level.height+100);
      if(state.status!=='playing')reset();
    }
    return {reset,launch,tick};
  }
  function createGrenadeArt(ctx){
    function zones(items,time){
      for(const z of items||[]){
        const spec=types[z.type],age=z.duration-z.ttl,fade=Math.min(1,z.ttl/.6);
        ctx.save();ctx.translate(z.x,z.y);
        if(z.type==='frag'){
          const r=z.radius*Math.min(1,age/.25);ctx.globalAlpha=Math.max(0,z.ttl/.32);
          ctx.strokeStyle='#ffe4a2';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.stroke();
          for(let i=0;i<14;i++){const a=i*Math.PI*2/14;ctx.fillStyle=i%2?'#ff9a42':'#fff1bd';ctx.fillRect(Math.cos(a)*r,Math.sin(a)*r,3,3);}
        }else if(z.type==='incendiary'){
          ctx.globalAlpha=fade;const glow=ctx.createRadialGradient(0,-8,4,0,-8,z.radius);glow.addColorStop(0,'#ffac4844');glow.addColorStop(1,'#ff5a1200');
          ctx.fillStyle=glow;ctx.fillRect(-z.radius,-z.radius,z.radius*2,z.radius*2);
          ctx.fillStyle='#ef631b44';ctx.beginPath();ctx.ellipse(0,0,z.radius,z.base?z.radius*.65:10,0,0,Math.PI*2);ctx.fill();
          for(let i=0;i<11;i++){
            const x=(i/10*2-1)*(z.radius-9),y=z.base?Math.sin(i*2.1)*z.radius*.5:0;
            const h=18+Math.sin(time*9+i*1.8)*7+(1-Math.abs(x/z.radius))*12;
            ctx.fillStyle=i%2?'#ff8e36bb':'#ffb54dbb';ctx.beginPath();ctx.moveTo(x-7,y);ctx.quadraticCurveTo(x-12,y-h*.6,x+Math.sin(time*7+i)*6,y-h);ctx.quadraticCurveTo(x+12,y-h*.4,x+7,y);ctx.fill();
            ctx.fillStyle='#ffe3aab0';ctx.beginPath();ctx.ellipse(x,y-5,3,7,0,0,Math.PI*2);ctx.fill();
          }
        }else{
          ctx.globalAlpha=fade;const pulse=(time*2.2)%1;
          ctx.fillStyle='#469edb12';ctx.beginPath();ctx.arc(0,0,z.radius,0,Math.PI*2);ctx.fill();
          ctx.strokeStyle='#79dfff55';ctx.lineWidth=1;ctx.setLineDash([5,8]);ctx.stroke();ctx.setLineDash([]);
          ctx.strokeStyle='#8ee7ff66';ctx.beginPath();ctx.arc(0,0,z.radius*pulse,0,Math.PI*2);ctx.stroke();
          const seed=Math.floor(time*7)+z.id;
          for(let i=0;i<7;i++){
            const a=i*Math.PI*2/7+seed*.11,r=z.radius*(.6+.3*Math.sin(i+seed));
            ctx.strokeStyle=i%2?'#acffffa0':'#66caff80';ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(0,0);
            for(let n=1;n<5;n++){const q=r*n/4,jitter=n<4?Math.sin(seed+n*4+i)*10:0;ctx.lineTo(Math.cos(a)*q+Math.sin(a)*jitter,Math.sin(a)*q-Math.cos(a)*jitter);}ctx.stroke();
          }
          ctx.fillStyle='#d8ffff';ctx.fillRect(-3,-3,6,6);
        }
        ctx.restore();
      }
    }
    function projectiles(items){
      for(const g of items||[]){
        const lift=g.base?Math.sin(Math.min(1,g.age/.65)*Math.PI)*32:0;
        ctx.save();ctx.translate(g.x,g.y);
        if(g.base){ctx.fillStyle='#0005';ctx.beginPath();ctx.ellipse(0,0,7,3,0,0,Math.PI*2);ctx.fill();}
        ctx.translate(0,-lift);ctx.rotate(g.age*6);
        ctx.fillStyle=types[g.type].color;ctx.strokeStyle='#13242b';ctx.lineWidth=2;
        ctx.beginPath();ctx.roundRect(-5,-7,10,14,g.type==='frag'?4:2);ctx.fill();ctx.stroke();
        ctx.fillStyle='#344847';ctx.fillRect(-2,-11,4,5);ctx.fillStyle='#fff6c6';ctx.fillRect(-1,-12,2,2);
        if(g.type==='electric'){ctx.strokeStyle='#defaff';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(2,-4);ctx.lineTo(-2,0);ctx.lineTo(2,0);ctx.lineTo(-2,4);ctx.stroke();}
        if(g.type==='frag'){ctx.strokeStyle='#697256';ctx.lineWidth=1;for(const y of [-3,2]){ctx.beginPath();ctx.moveTo(-4,y);ctx.lineTo(4,y);ctx.stroke();}}
        ctx.restore();
      }
    }
    return {zones,projectiles};
  }
  const api={grenadeTypes:types,grenadeOrder:order,grenadeRecharge:recharge,grenadeAffinity:affinity,createGrenadeSystem,createGrenadeArt};
  root.SlopCommando=Object.assign(root.SlopCommando||{},api);
  if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
