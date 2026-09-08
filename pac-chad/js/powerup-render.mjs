import {POWERUPS,specialIs,canEat,ghostBonus} from './powerups.mjs';
import {position} from './model.mjs';

export function drawPickup(r,s,now){
 const item=s.maze.pickup;if(!item||item.collected)return;
 const c=r.ctx,t=r.metrics.tile,spec=POWERUPS[s.stage],img=r.images['power-'+item.id];
 const x=(item.x+.5)*t,y=(item.y+.5)*t,bob=r.reduced?0:Math.sin(now*.003)*t*.07;
 c.save();c.translate(x,y+bob);c.fillStyle='#061018e8';c.strokeStyle=spec.color;c.lineWidth=2;
 c.beginPath();c.arc(0,0,t*.72,0,Math.PI*2);c.fill();c.stroke();
 if(img)c.drawImage(img,-t*.69,-t*.69,t*1.38,t*1.38);
 c.font='bold 9px Arial';c.textAlign='center';c.fillStyle='#071119';c.fillRect(-25,t*.61,50,13);c.fillStyle=spec.color;c.fillText('SPECIAL',0,t*.61+10);c.restore();
}
export function drawPlayerEffect(r,s,now){
 if(!s.special)return;
 const c=r.ctx,t=r.metrics.tile,p=position(s.player),x=(p.x+.5)*t,y=(p.y+.5)*t,spec=POWERUPS[s.stage];
 c.save();c.strokeStyle=spec.color;c.fillStyle=spec.color;c.lineWidth=3;
 if(specialIs(s,'steak')||specialIs(s,'final-form')){
   const [dx,dy]=[[0,-1],[1,0],[0,1],[-1,0]][s.player.dir];
   for(let i=1;i<=3;i++){c.globalAlpha=.4/i;c.beginPath();c.ellipse(x-dx*t*.3*i,y-dy*t*.3*i,t*.36,t*.48,0,0,Math.PI*2);c.fill();}
   c.globalAlpha=1;
 }
 const aura=specialIs(s,'absolute-aura'),radius=t*(aura?2.4:.69);
 if(aura){c.globalAlpha=.08;c.beginPath();c.arc(x,y,radius,0,Math.PI*2);c.fill();c.globalAlpha=1;}
 c.setLineDash(specialIs(s,'ghosted')?[6,7]:[]);c.beginPath();c.arc(x,y,radius,0,Math.PI*2);c.stroke();
 if(specialIs(s,'pre-workout'))for(let i=0;i<s.special.charges;i++){const a=-Math.PI/2+(i-1)*.65;c.beginPath();c.arc(x+Math.cos(a)*t*.8,y+Math.sin(a)*t*.8,5,0,Math.PI*2);c.fill();}
 c.restore();
}
export function drawGhostEffect(r,s,g){
 const c=r.ctx,t=r.metrics.tile,p=position(g),x=(p.x+.5)*t,y=(p.y+.5)*t;
 if(g.returning)return;
 c.save();c.textAlign='center';c.font='bold 12px Arial';c.lineWidth=2;c.strokeStyle='#9beeff';c.fillStyle='#9beeff';
 if(specialIs(s,'cold-plunge')){
   const frozen=s.special.ticks>180;c.globalAlpha=frozen?.25:.1;c.fillRect(x-t*.55,y-t*.6,t*1.1,t*1.2);c.globalAlpha=1;c.strokeRect(x-t*.55,y-t*.6,t*1.1,t*1.2);
   c.beginPath();c.moveTo(x-t*.42,y-t*.36);c.lineTo(x-t*.16,y-t*.52);c.moveTo(x+t*.22,y+t*.46);c.lineTo(x+t*.44,y+t*.27);c.stroke();
   c.fillText(frozen?'FROZEN':'SLOW',x,y-t*.7);
 }else if(specialIs(s,'leg-day')){
   const [dx,dy]=[[0,-1],[1,0],[0,1],[-1,0]][g.dir];c.beginPath();
   for(let i=-1;i<=1;i++){c.moveTo(x-dx*t*.5-dy*i*7,y-dy*t*.5+dx*i*7);c.lineTo(x-dx*t*.95-dy*i*7,y-dy*t*.95+dx*i*7);}c.stroke();c.fillText('RUN!',x,y-t*.7);
 }else if(specialIs(s,'ghosted')){c.fillStyle='#b7f1e7';c.font='bold 23px Arial';c.fillText('?',x,y-t*.55);}
 if(g.stun>0){c.fillStyle='#ffe18a';c.font='bold 18px Arial';c.fillText('★ ★',x,y-t*.6);}
 if(canEat(s)&&ghostBonus(s)===2){c.fillStyle='#baff63';c.fillText('2×',x,y-t*.65);}
 c.restore();
}
