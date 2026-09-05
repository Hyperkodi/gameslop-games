/* Shared weapon silhouettes for world pickups, equipped guns and the field guide. */
(function (root) {
  'use strict';
  const G = root.SlopCommando = root.SlopCommando || {};
  const names = { P: 'RIFLE', M: 'MACHINE GUN', S: 'SPREAD GUN', L: 'LASER RIFLE', F: 'FLAMETHROWER', G: 'GRENADE LAUNCHER', H: 'HOMING ROCKET', W: 'WAVE CANNON', B: 'BARRIER', R: 'RAPID FIRE' };
  function createWeaponArt(c, palette = {}) {
    const p = { outline: '#07151c', steel: '#637e86', light: '#c8dad3', dark: '#273c49', brass: '#e8b766', wood: '#b15f3f', flame: '#ff793f', laser: '#75f2ef', ...palette };
    const rect = (x,y,w,h,color) => { c.fillStyle=color; c.fillRect(x,y,w,h); };
    function shape(points, fill, stroke=p.outline) {
      c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();
      c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=1.5;c.lineJoin='round';c.stroke();}
    }
    function round(x,y,w,h,r,fill,stroke=p.outline) {
      c.beginPath();c.roundRect(x,y,w,h,r);c.fillStyle=fill;c.fill();
      if(stroke){c.lineWidth=1.2;c.strokeStyle=stroke;c.stroke();}
    }
    function line(points, color, width=1) {
      c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.strokeStyle=color;c.lineWidth=width;c.stroke();
    }
    function receiver(color=p.steel) {
      round(17,-8,27,15,2,color);rect(19,-7,23,2,p.light);
      shape([[19,5],[27,5],[23,17],[17,17]],p.dark);
      round(29,5,8,8,2,p.dark);rect(31,6,4,4,p.outline);
    }
    function rifle() {
      shape([[1,-7],[18,-5],[19,4],[7,4],[3,9],[0,9]],p.dark);
      receiver();round(36,-5,22,9,2,p.dark);
      rect(41,-4,2,5,p.steel);rect(47,-4,2,5,p.steel);rect(53,-4,2,5,p.steel);
      round(57,-3,10,5,1,p.steel);rect(57,-3,10,1,p.light);
      rect(35,6,9,11,p.dark);rect(36,7,2,9,p.steel);rect(26,-11,6,3,p.dark);
    }
    function machine() {
      shape([[0,-9],[14,-8],[18,-4],[18,4],[6,5],[2,9],[0,9]],'#48665b');
      receiver('#63765a');round(40,-6,24,10,2,p.dark);rect(43,-6,19,2,p.steel);
      for(let x=44;x<63;x+=5)rect(x,-3,2,4,p.outline);
      round(62,-4,8,6,1,p.steel);rect(63,-4,6,1,p.light);
      round(29,6,16,13,2,'#657448');rect(30,7,14,2,'#a4b67b');
      for(let i=0;i<4;i++)round(19+i*3,8+i*.8,2,6,.6,p.brass,null);
      line([[52,5],[48,15]],p.steel,2);line([[54,5],[59,15]],p.steel,2);
      round(23,-13,17,4,1,p.dark);rect(26,-12,10,1,p.light);
    }
    function spread() {
      shape([[0,-9],[14,-6],[21,-3],[19,5],[8,5],[2,12],[0,12]],p.wood);
      line([[3,-5],[12,-3],[14,1],[6,2]],'#edaa6c',2);
      round(19,-7,20,14,2,p.steel);rect(20,-6,17,2,p.light);
      round(36,-7,33,5,2,p.dark);round(36,0,33,5,2,p.dark);
      rect(39,-7,28,1.5,p.light);rect(40,0,27,1.5,p.light);
      round(42,4,17,7,2,p.wood);for(let x=44;x<58;x+=4)rect(x,5,1,5,'#6c392b');
      rect(67,-8,3,14,p.steel);rect(68,-6,2,3,p.outline);rect(68,1,2,3,p.outline);
      shape([[24,6],[30,6],[26,14],[21,14]],p.wood);
    }
    function laser() {
      shape([[0,-8],[13,-8],[21,-4],[19,4],[8,4],[1,9]],'#7c6c94');
      shape([[16,-9],[35,-11],[46,-5],[46,7],[18,7]],p.steel);
      line([[19,-7],[34,-9],[42,-5]],p.light,2);
      round(23,-5,16,9,3,p.outline);round(26,-3,10,5,2,p.laser,null);
      rect(43,-8,26,4,p.light);rect(44,5,25,4,p.steel);rect(44,-1,24,3,p.laser);
      rect(52,-5,3,10,'#86749f');rect(63,-5,3,10,'#86749f');
      shape([[21,7],[29,7],[25,17],[18,17]],p.dark);
      rect(68,-5,3,10,p.laser);rect(31,7,9,7,'#7c6c94');rect(33,8,5,2,p.laser);
    }
    function flame(time) {
      // Twin fuel cylinders and a curved feed hose distinguish this at a glance.
      round(1,-15,11,29,4,'#c8372c');round(12,-10,9,24,3,'#ed6740');
      rect(3,-12,2,22,'#ff9c6f');rect(14,-7,2,17,'#ffbc7c');
      rect(4,-19,5,4,p.steel);rect(14,-14,5,4,p.steel);
      rect(0,-6,21,4,p.dark);rect(0,8,21,3,p.dark);
      c.beginPath();c.moveTo(7,14);c.bezierCurveTo(8,25,27,25,28,7);c.strokeStyle=p.outline;c.lineWidth=5;c.stroke();
      c.strokeStyle=p.brass;c.lineWidth=2;c.stroke();
      round(20,-7,23,13,2,p.dark);rect(23,-6,16,2,p.steel);
      shape([[24,5],[31,5],[28,15],[22,15]],p.dark);
      round(38,-5,23,9,2,p.steel);rect(42,-5,16,2,p.light);
      for(let x=43;x<59;x+=5)rect(x,-2,2,4,p.outline);
      round(60,-7,7,13,2,p.brass);rect(61,-5,2,8,'#fff0b1');
      line([[47,7],[64,7],[68,2]],p.brass,2);
      const flicker=Math.sin(time*10)*1.5;
      shape([[67,3],[70,-6-flicker],[74,-1],[72,5],[69,7]],p.flame,null);
      shape([[68,4],[70,-1],[72,4],[70,6]],'#ffe6a0',null);
    }
    function grenade() {
      // A fat rifled barrel, break-action receiver and visible grenade separate it from a rifle.
      shape([[0,-8],[16,-7],[21,-2],[19,5],[7,6],[2,12],[0,12]],'#76523f');
      rect(3,-5,14,3,'#d49a67');rect(14,-10,18,17,p.dark);rect(16,-8,14,3,p.steel);
      shape([[24,-8],[47,-8],[56,-3],[56,6],[24,6]],'#52636b');rect(27,-6,25,2,p.light);
      shape([[48,-6],[70,-4],[70,5],[48,5]],'#283b45');
      for(let x=52;x<69;x+=5)rect(x,-5,2,9,'#91a4a6');
      round(66,-7,12,13,5,'#6f9748');round(69,-4,6,7,3,'#bdd36f',null);rect(66,-9,12,2,p.brass);
      shape([[24,6],[33,6],[28,17],[21,17]],p.dark);round(13,6,9,7,2,'#54372d');
    }
    function homing() {
      // A shoulder tube with a painted rocket nose and guide fins reads immediately at pickup size.
      shape([[0,-8],[17,-7],[24,-1],[21,6],[8,6],[2,12],[0,12]],'#3e5a51');
      round(16,-8,42,16,5,p.dark);rect(20,-6,34,3,p.steel);rect(22,5,31,2,'#1b2930');
      shape([[54,-9],[69,-5],[74,0],[69,5],[54,8]],'#d8ddd1');shape([[66,-5],[77,0],[66,5]],'#d95b43');
      rect(69,-3,5,6,'#ffe29a');shape([[39,-9],[47,-15],[48,-8]],'#9eb7b2');shape([[39,8],[47,14],[48,7]],'#9eb7b2');
      round(24,-4,10,8,3,'#263740');round(27,-2,4,4,2,p.laser,null);shape([[21,7],[29,7],[25,17],[18,17]],p.dark);
    }
    function wave(time) {
      // The side coils and three bright curved emitters make this an energy weapon, not a box.
      shape([[0,-8],[14,-8],[20,-3],[19,5],[8,5],[1,10]],'#5b6186');
      round(16,-10,29,19,4,p.dark);rect(19,-8,23,3,p.steel);
      for(const x of [24,35]){round(x,-5,8,10,4,'#253e52');round(x+2,-3,4,6,2,p.laser,null);}
      shape([[42,-7],[58,-11],[68,-6],[68,7],[42,7]],'#627b8e');rect(45,-4,20,3,p.light);
      const pulse=Math.sin(time*8)*1.5;
      for(let i=0;i<3;i++){
        c.beginPath();c.arc(67+i*4,0,10+i*3+pulse,-.85,.85);c.strokeStyle=i===1?'#d3fffb':p.laser;c.lineWidth=2;c.stroke();
      }
      shape([[20,8],[29,8],[25,18],[18,18]],p.dark);rect(30,8,9,7,'#656b98');
    }
    function barrier() {
      shape([[32,-21],[52,-14],[49,5],[42,15],[32,22],[22,15],[15,5],[12,-14]],p.steel);
      shape([[32,-17],[47,-11],[44,4],[39,11],[32,17],[25,11],[20,4],[17,-11]],'#164d61');
      line([[32,-16],[46,-11],[43,4],[38,11],[32,16]],p.laser,2);
      shape([[32,-10],[37,-2],[34,0],[37,8],[27,1],[30,-1],[27,-6]],'#9effeb',null);
      round(27,15,10,5,1,p.dark);rect(29,16,6,2,p.laser);
    }
    function rapid() {
      for(let i=0;i<3;i++) {
        const x=15+i*12,y=i===1?-16:-11;
        round(x,y+6,10,24,2,p.brass);shape([[x,y+7],[x+5,y],[x+10,y+7]],'#f9dc94');
        rect(x+2,y+9,2,17,'#fff0b1');rect(x,y+24,10,3,'#ad713a');
      }
      shape([[34,-7],[26,5],[33,4],[27,20],[47,-1],[37,1],[43,-7]],'#fff2aa');
      line([[8,-1],[3,-1]],'#efc96e',2);line([[9,6],[1,6]],'#efc96e',2);
    }
    function draw(type, {time=0} = {}) {
      c.save();
      ({P:rifle,M:machine,S:spread,L:laser,F:()=>flame(time),G:grenade,H:homing,W:()=>wave(time),B:barrier,R:rapid}[type]||rifle)();
      c.restore();
    }
    function pickup(item, time, nearby=false) {
      const x=item.x+item.w/2,y=item.y+item.h/2+Math.sin(time*3+item.x)*2;
      const color=item.type==='L'||item.type==='W'||item.type==='B'?p.laser:item.type==='F'||item.type==='G'||item.type==='H'?p.flame:p.brass;
      c.save();c.translate(x,y);
      const glow=c.createRadialGradient(0,0,2,0,0,34);glow.addColorStop(0,color+'44');glow.addColorStop(1,color+'00');
      c.fillStyle=glow;c.fillRect(-34,-34,68,68);
      c.strokeStyle=color;c.globalAlpha=.45;c.lineWidth=1;c.beginPath();c.ellipse(0,22,22,4,0,0,Math.PI*2);c.stroke();c.globalAlpha=1;
      for(let i=0;i<2;i++){const a=time*1.6+i*Math.PI;c.fillStyle=color;c.fillRect(Math.cos(a)*29,Math.sin(a)*19,2,2);}
      c.save();c.scale(.68,.68);c.translate(-35,0);c.shadowColor=p.outline;c.shadowBlur=2;draw(item.type,{time});c.restore();
      if(nearby){c.font='bold 8px monospace';c.textAlign='center';c.fillStyle='#f8eed7';c.shadowColor='#08151c';c.shadowBlur=3;c.fillText(names[item.type]||'RIFLE',0,-25);}
      c.restore();
    }
    return {draw,pickup,names};
  }
  G.createWeaponArt=createWeaponArt;
  G.pickupNames=names;
})(window);
