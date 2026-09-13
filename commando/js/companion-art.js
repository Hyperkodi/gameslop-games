(function(root){
  'use strict';
  const G=root.SlopCommando;
  function createCompanionArt(c,skin){
    const meta=skin.companion,atlas=G.loadActorAtlas(meta.atlas,skin),gun=G.createWeaponArt(c,skin.weapons);
    function draw(a,time,{recruit=false,elapsed=0}={}){
      if(!a||!atlas.surface)return;
      const firing=a.shotUntil>elapsed&&!recruit;
      const pose=recruit?6:!a.grounded?9:Math.abs(a.vx)+Math.abs(a.vy)>5?meta.runFrames[Math.floor(a.distance/8)%6]:firing?8:a.aimY<-.3?7:6;
      const f=meta.frames[pose],[sx,sy,w,h]=f.rect,[ax,ay]=f.anchor,scale=meta.renderHeight/meta.standingHeight;
      c.save();c.translate(a.x+15,a.y+42);c.scale(a.face||1,1);c.shadowColor='#08141c';c.shadowBlur=1.5;
      c.drawImage(atlas.surface,sx,sy,w,h,-ax*scale,-ay*scale,w*scale,h*scale);c.restore();
      c.save();c.translate(a.x+17,a.y+24);c.rotate(Math.atan2(a.aimY||0,a.aimX??1));
      if(a.aimX<0)c.scale(1,-1);
      c.save();c.scale(.46,.46);gun.draw('M',{time});c.restore();
      if(firing){c.fillStyle='#ffe4a1';c.beginPath();c.moveTo(32,-4);c.lineTo(43,0);c.lineTo(32,5);c.fill();}c.restore();
      c.save();c.textAlign='center';c.font='bold 9px monospace';c.shadowColor='#000';c.shadowBlur=4;c.fillStyle='#b6f4c9';
      c.fillText(recruit?'PAWNS · COME CLOSER':'PAWNS',a.x+15,a.y-27);c.restore();
    }
    return {draw,ready:atlas.ready};
  }
  G.createCompanionArt=createCompanionArt;
})(window);
