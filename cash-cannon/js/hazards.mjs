import {exchangeFor} from './exchanges.mjs';
import {rugPose} from './animations.mjs';
const clamp=n=>Math.max(0,Math.min(1,n));
function ellipse(c,x,y,rx,ry,fill,stroke){c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.stroke();}}
function box(c,x,y,w,h,r,fill,stroke){c.beginPath();c.roundRect(x,y,w,h,r);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.stroke();}}
function label(c,s,x,y,color='#fff0c5',size=12){c.font=`900 ${size}px Arial`;c.textAlign='center';c.strokeStyle='#07140f';c.lineWidth=4;c.strokeText(s,x,y);c.fillStyle=color;c.fillText(s,x,y);c.lineWidth=2;}
function path(c,points,fill,stroke){c.beginPath();c.moveTo(...points[0]);for(const p of points.slice(1))c.lineTo(...p);c.closePath();if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.stroke();}}
function gradient(c,x1,y1,x2,y2,stops){const g=c.createLinearGradient(x1,y1,x2,y2);stops.forEach(([p,color])=>g.addColorStop(p,color));return g;}
export function drawObject(c,o,tick=0,logos=new Map()){
 c.save();c.lineWidth=2;c.lineJoin='round';c.lineCap='round';
 const age=o.used?Math.max(0,(tick-(o.hitTick??tick))/120):0;
 if(o.kind==='dex')drawTrampoline(c,o,tick,age);
 if(o.kind==='cabal')drawDynamite(c,o,tick,age);
 if(o.kind==='cex')drawBalloon(c,o,tick,age,logos);
 if(o.kind==='honey')drawHoney(c,o,tick,age);
 if(o.kind==='rug')drawRug(c,o,tick,age);
 c.restore();
}
function drawTrampoline(c,o,tick,age){
 ellipse(c,0,1,61,10,'#0005');
 const squash=o.used?Math.sin(age*24)*Math.exp(-age*5)*9:Math.sin(tick/40)*1.2;
 const top=-35+squash;
 for(const x of [-41,41]){c.strokeStyle='#a7b9af';c.lineWidth=5;c.beginPath();c.moveTo(x,top+5);c.lineTo(x+(x<0?-5:5),-2);c.lineTo(x+(x<0?-18:18),-2);c.stroke();}
 ellipse(c,0,top,59,18,gradient(c,0,top-18,0,top+18,[[0,'#eff9b6'],[.45,'#8db83b'],[1,'#405d28']]),'#c9eba1');
 ellipse(c,0,top,46,12,'#142b29','#86bf71');
 c.save();c.beginPath();c.ellipse(0,top,44,11,0,0,Math.PI*2);c.clip();c.lineWidth=.6;c.strokeStyle='#72966b77';for(let x=-44;x<45;x+=7){c.beginPath();c.moveTo(x,top-14);c.lineTo(x+18,top+14);c.stroke();}for(let y=-9;y<=9;y+=4){c.beginPath();c.moveTo(-45,top+y);c.lineTo(45,top+y);c.stroke();}c.restore();
 c.strokeStyle='#e3f0c1';c.lineWidth=1.4;for(let x=-47;x<49;x+=12){c.beginPath();c.moveTo(x,top+7);c.lineTo(x+3,top+11);c.lineTo(x-2,top+13);c.lineTo(x+3,top+15);c.stroke();}
 path(c,[[-15,top],[0,top-7],[15,top],[6,top],[6,top+6],[-6,top+6],[-6,top]],'#c6ff6e');
 box(c,-41,top+12,82,16,3,'#2d491f','#aacf62');c.font='900 10px Arial';c.textAlign='center';c.fillStyle='#eaffb9';c.fillText('DEX BOOST',0,top+24);
}
function drawDynamite(c,o,tick,age){
 if(o.used){ellipse(c,0,-2,52,11,'#07110fcc');for(let i=0;i<7;i++)box(c,-40+i*12,-8-(i%3)*3,8,7,1,'#574b3a');return;}
 ellipse(c,0,0,54,10,'#0005');
 box(c,-47,-14,94,13,3,'#563a28','#b27a46');
 for(const row of [0,1])for(let i=0;i<3;i++){
  const x=-42+i*27+row*8,y=-43-row*23;
  box(c,x,y,25,47,7,gradient(c,x,y,x+25,y,[[0,'#922d26'],[.3,'#f27449'],[.64,'#d34e32'],[1,'#782320']]),'#4e251d');
  ellipse(c,x+12,y,12,5,'#ef9b67','#ffd3a0');ellipse(c,x+12,y,4,2,'#67392b');
  box(c,x+3,y+10,3,20,1,'#ffb58455');
 }
 box(c,-47,-37,102,15,2,'#362d22','#c0955d');
 for(const x of [-34,39]){box(c,x,-45,8,29,2,'#4f5045','#b6b4a0');ellipse(c,x+4,-30,2,2,'#d9d3ab');}
 c.strokeStyle='#dcb576';c.lineWidth=3;c.beginPath();c.moveTo(29,-68);c.bezierCurveTo(28,-98,60,-72,53,-104);c.stroke();
 c.strokeStyle='#ffe79a';c.lineWidth=2;for(let i=0;i<7;i++){const a=i*Math.PI*2/7+tick*.09,r=7+(i%2)*4;c.beginPath();c.moveTo(53+Math.cos(a)*3,-104+Math.sin(a)*3);c.lineTo(53+Math.cos(a)*r,-104+Math.sin(a)*r);c.stroke();}ellipse(c,53,-104,3,3,'#fff5c4');
 label(c,'CABAL PUSH',0,-81,'#ffc18a',11);
}
function drawBalloon(c,o,tick,age,logos){
 const brand=exchangeFor(o);
 if(o.used){if(age>.45)return;c.globalAlpha=1-age/.45;for(let i=0;i<7;i++){const a=i*Math.PI*2/7,r=20+age*150;c.save();c.translate(Math.cos(a)*r,Math.sin(a)*r);c.rotate(a+age*7);path(c,[[-5,-4],[9,0],[0,10]],brand.color);c.restore();}return;}
 c.save();c.rotate(Math.sin(tick/85+(o.phase??0))*.025);
 const g=c.createRadialGradient(-18,-24,3,9,8,68);g.addColorStop(0,'#f4f2dd');g.addColorStop(.2,brand.color);g.addColorStop(.76,brand.color);g.addColorStop(1,'#182e37');
 ellipse(c,0,0,43,53,g,'#ffffff90');
 c.save();c.globalAlpha=.35;ellipse(c,-23,-28,6,15,'#fff');c.restore();
 path(c,[[0,51],[-6,61],[7,61]],brand.color,'#e1ddd080');
 // Original artwork on an opaque badge keeps every logo's original colors.
 box(c,-29,-26,58,52,11,'#fff','#ffffff99');
 const img=logos.get(brand.id);
 if(img){const [sx,sy,sw,sh]=brand.crop||[0,0,img.naturalWidth,img.naturalHeight],ratio=Math.min(49/sw,43/sh),w=sw*ratio,h=sh*ratio;c.drawImage(img,sx,sy,sw,sh,-w/2,-h/2,w,h);}
 else {c.fillStyle='#16242b';c.font='bold 9px Arial';c.textAlign='center';c.fillText(brand.name,0,3);}
 c.restore();
 c.strokeStyle='#ddd8b7';c.lineWidth=1.5;c.beginPath();c.moveTo(0,60);c.quadraticCurveTo(9*Math.sin(tick/75),69,0,76);c.stroke();
 box(c,-7,64,14,11,3,'#9d987e','#d7d8c0');
 const bomb=c.createRadialGradient(-8,78,2,0,86,24);bomb.addColorStop(0,'#607180');bomb.addColorStop(.4,'#2b3b42');bomb.addColorStop(1,'#09191d');ellipse(c,0,87,22,22,bomb,'#9ea894');
 path(c,[[0,76],[-5,88],[0,88],[-3,98],[8,84],[2,84]],'#ffb957');
 label(c,brand.name.toUpperCase(),0,-65,'#f8ecd4',12);label(c,'CEX LISTING',0,126,'#e3d1ff',10);
}
function drawHoney(c,o,tick,age){
 ellipse(c,0,1,57,12,'#0006');c.save();
 if(o.used)c.scale(1+Math.sin(age*19)*Math.exp(-age*2)*.07,1-Math.sin(age*19)*Math.exp(-age*2)*.06);
 const pot=gradient(c,-51,0,54,0,[[0,'#6d3317'],[.17,'#c47125'],[.42,'#f0b34b'],[.74,'#b76621'],[1,'#66301b']]);
 c.beginPath();c.moveTo(-37,-79);c.bezierCurveTo(-41,-62,-58,-47,-49,-21);c.bezierCurveTo(-44,2,42,5,49,-22);c.bezierCurveTo(56,-44,41,-62,37,-79);c.closePath();c.fillStyle=pot;c.fill();c.strokeStyle='#ffcd77';c.lineWidth=2;c.stroke();
 ellipse(c,0,-8,39,5,'#8d481b66');ellipse(c,-27,-44,7,20,'#ffd78555');
 c.save();c.translate(48,-55);c.rotate(.55);box(c,-3,-57,6,62,3,'#a77942','#f5cf89');for(let y=-57;y<-32;y+=6)box(c,-10,y,20,5,2,'#d3a05d','#ffe2a3');c.restore();
 ellipse(c,0,-81,43,17,'#f7b82f','#ffdd80');
 const open=o.used?Math.max(3,15-age*13):13+Math.sin(tick/37)*2;
 ellipse(c,0,-81,35,open,'#351810','#9b441e');ellipse(c,0,-77,24,Math.max(2,open-7),'#741e22');
 if(!o.used){for(let i=0;i<5;i++){const x=-27+i*13;path(c,[[x,-89],[x+5,-77],[x+10,-89]],'#fff0be');}for(const x of [-18,9])path(c,[[x,-72],[x+5,-80],[x+10,-72]],'#ffe6ad');}
 c.strokeStyle='#ffc933';c.lineWidth=7;for(const [x,l] of [[-33,19],[-17,11],[19,23],[35,12]]){c.beginPath();c.moveTo(x,-76);c.quadraticCurveTo(x-2,-67,x,-76+l);c.stroke();ellipse(c,x,-76+l,3.6,4.8,'#ffc933');}
 box(c,-32,-48,64,31,7,'#fff1bc','#7b3c1b');c.fillStyle='#683315';c.textAlign='center';c.font='900 12px Arial';c.fillText('HONEY',0,-34);c.font='900 10px Arial';c.fillText('POT',0,-22);
 c.restore();
 if(o.used&&age<.65){for(let i=0;i<6;i++){const a=i*Math.PI/5;ellipse(c,Math.cos(a)*age*95,-79-Math.sin(a)*Math.sin(age/.65*Math.PI)*50,3,5,'#ffd044');}}
 label(c,'HONEY POT',0,-115,'#ffdc7a',12);
}
function drawRug(c,o,tick,age){
 const pose=o.used?rugPose(age):{offset:0,lift:0,rugAlpha:1,pull:0};
 ellipse(c,0,0,77,9,'#0004');c.translate(pose.offset,-pose.lift);c.globalAlpha*=pose.rugAlpha;
 const fill=gradient(c,0,-22,0,2,[[0,'#c75370'],[.5,'#832e5d'],[1,'#531d43']]);
 path(c,[[-64,-22],[65,-22],[77,-3],[-77,-3]],fill,'#f7c784');
 path(c,[[-57,-18],[57,-18],[65,-6],[-65,-6]],'#442842','#e7ac71');
 path(c,[[-46,-15],[46,-15],[51,-9],[-51,-9]],'#b44867');
 path(c,[[-17,-12],[0,-19],[17,-12],[0,-5]],'#eac785','#ffedb5');
 path(c,[[-8,-12],[0,-16],[8,-12],[0,-8]],'#49b3ac');
 for(const x of [-38,38])path(c,[[x-6,-12],[x,-16],[x+6,-12],[x,-8]],'#f3cf86');
 c.lineWidth=1.3;c.strokeStyle='#f9dda2';for(let i=0;i<9;i++){const y=-21+i*2.2;for(const sign of [-1,1]){const x=sign*(65+i*1.2);c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x+sign*5,y-2,x+sign*10,y+Math.sin(i+tick/25)*.9);c.stroke();}}
 if(pose.pull>0){const x=65-pose.pull*15;ellipse(c,x,-12,7+pose.pull*5,12,'#762c57','#ffe0a0');ellipse(c,x,-12,3,7,'#d87880');}
 if(!o.used)label(c,'RUG PULL',0,-39,'#ffadbb',11);
}
