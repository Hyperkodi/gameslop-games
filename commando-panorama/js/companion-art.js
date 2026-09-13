(function(root){
  'use strict';
  const G=root.SlopCommando;
  function createCompanionArt(c,skin){
    const characters=skin.companions||{pawns:skin.companion};
    const atlases=Object.fromEntries(Object.entries(characters).map(([id,meta])=>[id,G.loadActorAtlas(meta.atlas,skin)]));
    const gun=G.createWeaponArt(c,skin.weapons);
    function draw(a,time,{recruit=false,elapsed=0}={}){
      const meta=characters[a?.allyId||'pawns'],atlas=atlases[a?.allyId||'pawns'];
      if(!a||!atlas.surface)return;
      const firing=a.shotUntil>elapsed&&!recruit;
      const idle=meta.idleFrame??6;
      const pose=recruit?idle:!a.grounded?(meta.jumpFrame??9):Math.abs(a.vx)+Math.abs(a.vy)>5?meta.runFrames[Math.floor(a.distance/8)%meta.runFrames.length]:firing?(meta.fireFrame??8):a.aimY<-.3?(meta.aimFrame??7):idle;
      const f=meta.frames[pose],[sx,sy,w,h]=f.rect,[ax,ay]=f.anchor,scale=meta.renderHeight/meta.standingHeight;
      c.save();c.translate(a.x+15,a.y+42);c.scale(a.face||1,1);c.shadowColor='#08141c';c.shadowBlur=1.5;
      c.drawImage(atlas.surface,sx,sy,w,h,-ax*scale,-ay*scale,w*scale,h*scale);c.restore();
      const hand=f.hand;
      c.save();c.translate(hand?a.x+15+(hand[0]-ax)*scale*(a.face||1):a.x+17,hand?a.y+42+(hand[1]-ay)*scale:a.y+24);c.rotate(Math.atan2(a.aimY||0,a.aimX??1));
      if(a.aimX<0)c.scale(1,-1);
      if(hand)c.translate(-9.2,-2.3);
      c.save();c.scale(.46,.46);gun.draw(a.weapon||'M',{time});c.restore();
      if(firing){c.fillStyle=a.weapon==='L'?'#83f7ff':a.weapon==='F'?'#ff9a42':'#ffe4a1';c.beginPath();c.moveTo(32,-4);c.lineTo(43,0);c.lineTo(32,5);c.fill();}c.restore();
      c.save();c.textAlign='center';c.font='bold 9px monospace';c.shadowColor='#000';c.shadowBlur=4;c.fillStyle='#b6f4c9';
      c.fillText(meta.name.toUpperCase()+(recruit?' · ALLY':''),a.x+15,a.y-27);c.restore();
    }
    return {draw,ready:Promise.all(Object.values(atlases).map(a=>a.ready)).then(results=>results.every(Boolean))};
  }
  G.createCompanionArt=createCompanionArt;
})(window);
