import {drawObject} from './hazards.mjs';
export {drawObject} from './hazards.mjs';
import {rugPose} from './animations.mjs';
import {OBJECTS,objectY} from './model.mjs';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),mix=(a,b,t)=>a+(b-a)*t;
const hash=n=>{const v=Math.sin(n*127.1+17.7)*43758.5453;return v-Math.floor(v);};
function rect(c,x,y,w,h,r,fill,stroke){c.beginPath();c.roundRect(x,y,w,h,r);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.stroke();}}
function ellipse(c,x,y,rx,ry,fill,stroke){c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.stroke();}}
function text(c,value,x,y,size=12,color='#fff1d0',align='center'){c.font=`700 ${size}px Arial`;c.textAlign=align;c.fillStyle=color;c.fillText(value,x,y);}
export class Renderer{
  constructor(canvas,cat,logos=new Map()){this.logos=logos;this.canvas=canvas;this.c=canvas.getContext('2d');this.cat=cat;this.cameraX=0;this.cameraY=0;this.particles=[];this.flash=0;this.shake=0;this.trail=[];this.resize();}
  resize(){const r=this.canvas.getBoundingClientRect();this.w=r.width;this.h=r.height;this.dpr=Math.min(devicePixelRatio||1,1.5);this.canvas.width=Math.round(this.w*this.dpr);this.canvas.height=Math.round(this.h*this.dpr);this.scale=clamp(this.h/540,.62,1.4);this.ground=this.h*.78;this.makeSkyline();}
  makeSkyline(){
    this.layers=[0,1].map(layer=>{
      const tile=document.createElement('canvas');tile.width=1600;tile.height=320;const c=tile.getContext('2d');
      for(let i=0;i<20;i++){
        const x=i*80,height=55+hash(i+layer*50)*210,y=320-height;c.fillStyle=layer?'#16302f':'#1b343b';c.fillRect(x,y,68,height);
        c.fillStyle=layer?'#203e37':'#27444a';c.fillRect(x+3,y+4,5,height-4);
        for(let row=0;row<Math.floor(height/17)-1;row++)for(let col=0;col<4;col++){if(hash(i*200+row*4+col+layer*33)<.46)continue;c.fillStyle=layer?'#a5bb6752':'#86b2ba24';c.fillRect(x+13+col*12,y+13+row*17,5,7);}
        if(i%5===2){c.fillStyle='#a7dca83d';c.fillRect(x+11,y-4,43,4);}
      }
      return tile;
    });
  }
  reset(){this.cameraX=0;this.cameraY=0;this.trail=[];this.particles=[];this.flash=0;this.shake=0;}
  events(events){for(const e of events){
    const boom=['launch','cabal','cex'].includes(e.type),end=e.type==='end',count=boom?35:end?24:e.type==='bounce'?7:18;
    if(boom){this.flash=.26;this.shake=boom?9:3;}
    if(end&&e.reason!=='rug')this.shake=7;
    const color=OBJECTS[e.type]?.color||'#f4e4a5';
    for(let i=0;i<count;i++)this.particles.push({x:e.x,y:e.y,vx:(Math.random()-.5)*(boom?420:180),vy:Math.random()*(boom?450:230),life:.4+Math.random()*.6,max:1,color,size:boom?3+Math.random()*6:2+Math.random()*3});
    this.particles=this.particles.slice(-160);
  }}
  draw(s,dt=0){
    const c=this.c,w=this.w,h=this.h,z=this.scale;
    const follow=s.phase==='aim'?0:Math.max(0,s.x-w*.3/z),height=s.phase==='aim'?0:Math.max(0,s.y-h*.51/z);
    const easing=dt?1-Math.exp(-8*dt):1;this.cameraX=mix(this.cameraX,follow,easing);this.cameraY=mix(this.cameraY,height,easing);
    const sx=x=>(x-this.cameraX)*z,sy=y=>this.ground+(this.cameraY-y)*z;
    c.setTransform(this.dpr,0,0,this.dpr,0,0);c.clearRect(0,0,w,h);
    const sky=c.createLinearGradient(0,0,0,h);sky.addColorStop(0,'#0b1825');sky.addColorStop(.65,'#244348');sky.addColorStop(1,'#9b8662');c.fillStyle=sky;c.fillRect(0,0,w,h);
    for(let i=0;i<42;i++){c.fillStyle=i%3?'#d7e5c344':'#ecf6d97a';c.fillRect((hash(i*7)*w-this.cameraX*.02%w+w)%w,hash(i*9)*h*.56,1.5,1.5);}
    ellipse(c,w*.76-this.cameraX*.012,this.ground*.33+this.cameraY*z*.05,49*z,49*z,'#d7d9a1');
    c.fillStyle='#1b3338';c.fillRect(w*.76-55*z-this.cameraX*.012,this.ground*.33+17*z+this.cameraY*z*.05,110*z,3*z);
    for(let layer=0;layer<2;layer++){
      const tile=this.layers[layer],tw=1600*z,offset=-(this.cameraX*(layer?.32:.12)*z)%tw;
      c.globalAlpha=layer?.9:.7;for(let x=offset-tw;x<w;x+=tw)c.drawImage(tile,x,this.ground-320*z+this.cameraY*z*(layer?.5:.28),tw,320*z);
    }c.globalAlpha=1;
    const floor=sy(0);c.fillStyle='#17372e';c.fillRect(0,floor,w,h-floor);c.fillStyle='#b4ce79';c.fillRect(0,floor, w,3*z);c.fillStyle='#617d4e';c.fillRect(0,floor+3*z,w,7*z);
    for(let i=Math.floor(this.cameraX/80);i<(this.cameraX+w/z)/80+1;i++){const x=sx(i*80);c.fillStyle='#38513b';c.fillRect(x,floor+18*z,22*z,2*z);c.fillStyle='#68825b';c.fillRect(x+35*z,floor+36*z,4*z,2*z);}
    for(let d=Math.floor(this.cameraX/500)*500;d<this.cameraX+w/z;d+=500){if(d<500)continue;c.strokeStyle='#b4ce7955';c.beginPath();c.moveTo(sx(d),floor);c.lineTo(sx(d),floor+35*z);c.stroke();text(c,(d/10)+'m',sx(d)+7*z,floor+29*z,11*z,'#b5c6a3','left');}
    c.save();if(this.shake>0){c.translate(Math.sin(s.tick*1.7)*this.shake,Math.cos(s.tick*2.1)*this.shake*.4);this.shake=Math.max(0,this.shake-dt*28);}
    for(const o of s.objects){const x=sx(o.x);if(x<-130*z||x>w+130*z)continue;c.save();c.translate(x,sy(objectY(o,s.tick)));c.scale(z,z);drawObject(c,o,s.tick,this.logos);c.restore();}
    if(this.cameraX<260){
      c.save();c.translate(sx(90),sy(42));c.scale(z,z);const a=-s.angle*Math.PI/180;
      ellipse(c,0,30,65,14,'#071b18');
      c.save();c.rotate(a);rect(c,-18,-25,109,50,8,'#5e7464','#c9d49d');rect(c,67,-30,22,60,5,'#152c28','#d8e4b4');rect(c,-7,-19,58,6,2,'#9caf80');text(c,'SEND IT',28,7,12,'#e6edbb');c.restore();
      rect(c,-32,11,58,20,5,'#313d35');for(const x of [-27,27]){ellipse(c,x,26,23,23,'#132722','#9fb18a');ellipse(c,x,26,9,9,'#adbc8b');}
      c.restore();
      if(s.phase==='aim'){
        const a=s.angle*Math.PI/180,speed=310+s.power*700;
        for(let i=1;i<12;i++){const t=i*.055;const x=90+Math.cos(a)*88+Math.cos(a)*speed*t,y=42+Math.sin(a)*88+Math.sin(a)*speed*t-310*t*t;c.globalAlpha=(1-i/13)*.5;ellipse(c,sx(x),sy(y),2.5*z,2.5*z,'#e7edb7');}c.globalAlpha=1;
      }
    }
    if(s.phase==='flight'&&dt){this.trail.push({x:s.x,y:s.y});this.trail=this.trail.slice(-16);}else if(dt)this.trail.shift();
    for(let i=0;i<this.trail.length;i++){const p=this.trail[i];c.globalAlpha=i/this.trail.length*.22;ellipse(c,sx(p.x),sy(p.y),3*z,3*z,'#d8ef99');}c.globalAlpha=1;
    let x=s.x,y=s.y,rotation=s.rotation,size=Math.max(80,90*z),alpha=1;
    if(s.phase==='aim'){const a=s.angle*Math.PI/180;x=90+Math.cos(a)*99;y=42+Math.sin(a)*99+15;size=Math.max(62,65*z);rotation=.1;}
    if(s.phase==='ending'||s.phase==='done'){
      const t=1-s.endTicks/Math.max(1,s.endingLength);
      if(s.reason==='honey'){x=mix(s.impact.x,s.impact.object.x,t);y=mix(s.impact.y,81,t);size*=Math.max(0,1-t);rotation+=t*5;}
      if(s.reason==='rug'){const pose=rugPose((s.endingLength-s.endTicks)/120),base=Math.max(s.impact.object.x-35,Math.min(s.impact.object.x+35,s.impact.x));x=base+pose.catX;y=(size*.41/z+8)*(1-pose.fallen)+(size*.26/z)*pose.fallen+pose.catLift;rotation=pose.rotation;}
    }
    c.save();c.translate(sx(x),sy(y));c.rotate(rotation);c.globalAlpha=alpha;
    if(this.cat)c.drawImage(this.cat,-size*.5,-size*.58,size,size);c.restore();
    this.particles=this.particles.filter(p=>p.life>0);for(const p of this.particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy-=380*dt;p.life-=dt;c.globalAlpha=clamp(p.life,0,1);c.fillStyle=p.color;c.fillRect(sx(p.x),sy(p.y),p.size*z,p.size*z);}c.globalAlpha=1;c.restore();
    if(this.flash>0){c.globalAlpha=this.flash;c.fillStyle='#fff8d8';c.fillRect(0,0,w,h);c.globalAlpha=1;this.flash=Math.max(0,this.flash-dt*2);}
    if(this.cameraY>50){text(c,'↑ '+Math.round(s.y/10)+'m ALTITUDE',w/2,44,12,'#e4edd4');}
  }
}
