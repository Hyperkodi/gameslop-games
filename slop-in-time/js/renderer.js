(function(root){
  'use strict';
  const G=root.SlopInTime,TAU=Math.PI*2;
  function createRenderer(canvas){
    const c=canvas.getContext('2d'),atlas=new Image(),scenery=new Image(),enemyImage=new Image();let mascot=null,enemySprites=null,enemyFrames=[],backgroundReady=false;
    const frames={idle:[104,47,319,376],runA:[596,63,350,378],runB:[1108,70,324,365],jump:[113,518,319,333],crouch:[619,592,276,313],victory:[1091,530,302,375]};
    function prepare(image){
      const surface=document.createElement('canvas');surface.width=image.width;surface.height=image.height;const g=surface.getContext('2d',{willReadFrequently:true});g.drawImage(image,0,0);
      const pixels=g.getImageData(0,0,surface.width,surface.height),d=pixels.data,w=surface.width,h=surface.height,seen=new Uint8Array(w*h),queue=new Int32Array(w*h);let head=0,tail=0;
      function visit(n){if(seen[n])return;seen[n]=1;const i=n*4,lo=Math.min(d[i],d[i+1],d[i+2]),hi=Math.max(d[i],d[i+1],d[i+2]);if(d[i+3]<16||(lo>170&&hi-lo<55))queue[tail++]=n;}
      for(let x=0;x<w;x++){visit(x);visit((h-1)*w+x);}for(let y=0;y<h;y++){visit(y*w);visit(y*w+w-1);}while(head<tail){const n=queue[head++],x=n%w;d[n*4+3]=0;if(x>0)visit(n-1);if(x<w-1)visit(n+1);if(n>=w)visit(n-w);if(n<w*(h-1))visit(n+w);}
      g.putImageData(pixels,0,0);return {surface,pixels};
    }
    atlas.onload=()=>{mascot=prepare(atlas).surface;};
    atlas.src=root.SlopCommandoMascotAtlas;
    enemyImage.onload=()=>{
      const {surface,pixels}=prepare(enemyImage);enemySprites=surface;
      // Tight authored cells exclude the next row's hats/tails. Generated
      // poses do not all occupy an exact third of the source image height.
      const rects=[[0,0,342,334],[355,0,425,334],[790,0,339,334],[1136,0,400,334],[0,337,344,316],[354,337,439,316],[794,337,336,316],[1136,337,400,316],[0,654,339,349],[353,654,424,349],[777,654,347,349],[1134,654,402,349]];
      for(let i=0;i<12;i++){
        const [sx,sy,w,h]=rects[i];
        let bottom=h-1;for(;bottom>0;bottom--){let opaque=false;for(let x=0;x<w;x++)if(pixels.data[((sy+bottom)*surface.width+sx+x)*4+3]>128){opaque=true;break;}if(opaque)break;}
        let sum=0,count=0;for(let y=Math.max(0,bottom-8);y<=bottom;y++)for(let x=0;x<w;x++)if(pixels.data[((sy+y)*surface.width+sx+x)*4+3]>128){sum+=x;count++;}
        enemyFrames.push({sx,sy,w,h,bottom,anchor:count?sum/count:w*.42});
      }
    };enemyImage.src=root.SlopTimeEnemyAtlas||'skin/gameslop/enemies-v1.png';
    scenery.onload=()=>backgroundReady=true;scenery.src='skin/gameslop/eras-v1.png';
    function ellipse(x,y,rx,ry,fill,stroke){c.beginPath();c.ellipse(x,y,Math.max(.1,rx),Math.max(.1,ry),0,0,TAU);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=2;c.stroke();}}
    function line(points,color,width=2){c.beginPath();c.moveTo(...points[0]);for(const p of points.slice(1))c.lineTo(...p);c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.stroke();}
    function text(str,x,y,size=14,color='#f5eddb',align='left',font='monospace'){c.font=`bold ${size}px ${font}`;c.fillStyle=color;c.textAlign=align;c.fillText(str,x,y);}
    function box(x,y,w,h,color,r=0){c.fillStyle=color;c.beginPath();c.roundRect(x,y,w,h,r);c.fill();}
    function backdrop(s,t){
      const era=G.stages[s.stage],offset=s.camera*.3;
      const grad=c.createLinearGradient(0,0,0,540);grad.addColorStop(0,['#132c3e','#443b48','#293e2b','#292444','#6a4435','#092c42'][s.stage]);grad.addColorStop(1,era.floor);c.fillStyle=grad;c.fillRect(0,0,960,540);
      if(backgroundReady){const w=scenery.width/2,h=scenery.height/3;c.drawImage(scenery,(s.stage%2)*w,Math.floor(s.stage/2)*h,w,h,-offset,0,1640,420);}
      const shade=c.createLinearGradient(0,200,0,390);shade.addColorStop(0,'#07101700');shade.addColorStop(1,era.floor);c.fillStyle=shade;c.fillRect(0,200,960,220);
      c.fillStyle=era.floor;c.fillRect(0,362,960,178);
      const ground=c.createLinearGradient(0,340,0,540);ground.addColorStop(0,'#0000');ground.addColorStop(1,'#020b13bb');c.fillStyle=ground;c.fillRect(0,330,960,210);
      // Every ground mark tracks the same camera as the fighters.
      const start=Math.floor(s.camera/110)*110;
      for(let x=start-110;x<s.camera+1100;x+=110){const sx=x-s.camera;
        for(let y=357;y<550;y+=43){const shift=(Math.floor(y/43)%2)*55;line([[sx+shift,y],[sx+shift+90,y]],'#ffffff10',1);line([[sx+shift,y],[sx+shift-18,y+40]],'#060b1244',2);}
      }
      line([[0,333],[960,333]],era.color+'77',2);
      for(let x=Math.floor(s.camera/470)*470;x<s.camera+1050;x+=470){const px=x-s.camera;
        if(era.theme==='jungle'){line([[px,335],[px+12,285]],'#374e27',5);for(let n=0;n<6;n++)ellipse(px+Math.cos(n)*25,304+Math.sin(n)*12,23,6,'#697b35');}
        else if(era.theme==='pirate'){box(px-9,270,18,65,'#3d2b25',4);ellipse(px,269,11,5,'#c39265');line([[px,290],[px+470,290]],'#bc906888',3);}
        else if(era.theme==='temple'){box(px-5,251,10,84,'#342837');box(px-18,252,36,29,'#d77851',5);ellipse(px,266,12,13,'#ffc98e');line([[px-23,249],[px+23,249]],'#251b2e',7);}
        else{box(px-4,230,8,105,'#182629');line([[px,235],[px+31,235]],'#344847',4);ellipse(px+30,239,12,4,era.color);}
      }
      if(era.theme==='city'){c.strokeStyle='#82b8bd44';c.lineWidth=1;for(let i=0;i<42;i++){const x=(i*79+t*33)%1000,y=(i*47+t*430)%550;c.beginPath();c.moveTo(x,y);c.lineTo(x-8,y+22);c.stroke();}}
      if(era.theme==='future'){c.globalAlpha=.14+.05*Math.sin(t*3);c.strokeStyle=era.color;c.lineWidth=2;for(let i=0;i<7;i++){c.beginPath();c.ellipse(710-offset*.2,192,105+i*8,132+i*7,0,0,TAU);c.stroke();}c.globalAlpha=1;}
      for(let i=0;i<18;i++){const x=(i*197+Math.sin(t*.3+i)*35-offset*.5)%980,y=110+(i*71)%220+Math.sin(t+i)*12;ellipse(x,y,1.1,1.1,era.color+'66');}
    }
    function shadow(x,y,rx=30){ellipse(x,y+1,rx,9,'#02090dbb');}
    function glove(x,y,color='#ef4134',scale=1){c.save();c.translate(x,y);c.scale(scale,scale);ellipse(0,0,15,12,color,'#431a24');ellipse(6,6,7,6,color,'#431a24');line([[-8,-5],[5,-7]],'#ffd5b5',2);line([[-5,3],[4,3]],'#981f2b',2);c.restore();}
    function player(p,t,hero=false){
      if(p.lives<=0&&p.dead<=0)return;c.save();c.translate(p.x,p.y);shadow(0,0,hero?65:30);c.translate(0,-p.z);
      if(p.dead>0){c.globalAlpha=Math.min(1,p.dead);c.rotate(-p.face*1.25);}
      else if(p.hurt>0)c.rotate(-p.face*.13);
      if(!hero&&p.invincible>0&&Math.floor(t*12)%2===0)c.globalAlpha=.65;
      c.scale(hero?2.7:1,hero?2.7:1);
      const a=p.action,extension=a?Math.sin(Math.min(1,a.age/a.duration)*Math.PI):0;
      const pose=hero?'victory':p.z>0?'jump':a?.kind==='special'?'victory':a?.kind==='throw'?'victory':p.moving?Math.sin(p.walk)>0?'runA':'runB':'idle';
      if(mascot){const [x,y,w,h]=frames[pose],scale=.245;c.save();c.scale(-p.face,1);if(p.id)c.filter='hue-rotate(165deg)';c.drawImage(mascot,x,y,w,h,-w*scale/2,-h*scale,w*scale,h*scale);c.restore();}
      else{ellipse(0,-45,30,39,p.id?'#60d8d3':'#ed342d','#ffd9ba');ellipse(-10,-64,8,11,'#fff');ellipse(10,-64,8,11,'#fff');ellipse(-8,-64,4,7,'#111');ellipse(12,-64,4,7,'#111');box(-5,-48,10,28,'#191d22',2);box(-14,-39,28,10,'#191d22',2);}
      if(a&&a.kind==='punch'){
        const hand=p.face*(35+extension*(a.step===3?50:35));line([[p.face*18,-45],[hand,-46]],p.id?'#46aaa9':'#b9292c',12);glove(hand,-46,p.id?'#6bdddc':'#f74837',a.step===3?1.2:1);
        if(p.weapon){c.save();c.translate(hand,-46);c.rotate(p.face*(-.7+extension*.9));line([[0,16],[0,-61]],'#34444d',10);line([[0,14],[0,-60]],p.weapon==='club'?'#ac794c':'#c6d8d7',6);if(['saber','blade'].includes(p.weapon))line([[0,-20],[12,-62]],'#e8eddb',8);c.restore();}
        if(extension>.5){c.globalAlpha*=.6;line([[hand-p.face*35,-68],[hand+p.face*14,-50],[hand-p.face*23,-31]],'#fff0b3',3);}
      }
      if(a?.kind==='kick'){line([[0,-18],[p.face*(36+extension*40),-18]],p.id?'#4dadae':'#a82330',16);ellipse(p.face*(42+extension*40),-19,19,12,p.id?'#80e4e0':'#ff6650','#632430');}
      if(a?.kind==='special'){c.strokeStyle='#fff0b3';c.lineWidth=5;c.beginPath();c.ellipse(0,-45,50+extension*40,65,0,t*15,t*15+Math.PI*1.6);c.stroke();}
      c.restore();
      if(!hero){text(p.id?'2P':'1P',p.x,p.y-p.z-108,11,p.id?'#80e9ea':'#ffd2ac','center');if(p.weapon)text(p.weapon.toUpperCase()+' '+p.weaponHits,p.x,p.y+21,9,'#ffe4a0','center');}
    }
    function enemy(e,s,t){
      const era=G.stages[s.stage],size=e.boss?1.55:e.kind==='brute'?1.22:e.kind==='swift'?.92:1;
      c.save();c.translate(e.x,e.y);shadow(0,0,29*size);c.scale(e.face*size,size);
      if(e.hp<=0){c.globalAlpha=e.dead/.7;c.rotate(-1.4);c.translate(30,8);}
      else if(e.down>0){c.rotate(-1.3);c.translate(15,8);}
      if(enemySprites){
        const attacking=e.windup>0&&e.windup<.3||e.charge>0||e.cooldown>.95;
        const f=enemyFrames[s.stage*2+Number(attacking)],scale=.34,bob=e.windup>0?0:Math.abs(Math.sin(e.walk))*2;
        c.save();if(e.boss)c.filter='hue-rotate(22deg) saturate(1.25)';else if(e.kind==='swift')c.filter='hue-rotate(45deg)';else if(e.kind==='thrower')c.filter='hue-rotate(-35deg)';
        c.translate(0,-bob);c.rotate(e.windup>0?-.035:Math.sin(e.walk)*.015);c.drawImage(enemySprites,f.sx,f.sy,f.w,f.h,-f.anchor*scale,-f.bottom*scale,f.w*scale,f.h*scale);c.restore();
        if(e.boss){c.strokeStyle=era.color+'99';c.lineWidth=2;c.beginPath();c.ellipse(0,-50,44,63,0,0,TAU);c.stroke();}
        if(e.kind==='thrower'){ellipse(31,-48,7,7,era.color,'#243744');}
      }else{
      const stride=e.windup>0?0:Math.sin(e.walk)*9,skin=['#ab8292','#bda18b','#adb969','#aa96bf','#b49878','#718d9b'][s.stage];
      const suit=e.boss?['#cb5836','#894351','#99633c','#a73947','#a16d37','#6275b9'][s.stage]:e.kind==='thrower'?'#a67762':e.kind==='swift'?'#657fa2':['#6f6479','#665978','#5c8058','#4b4b7b','#77704d','#386c77'][s.stage];
      const action=e.windup>0,arm=action?30:12;
      line([[-11,-28],[-14+stride, -8],[-21+stride,-4]],'#202732',11);line([[11,-28],[14-stride,-8],[24-stride,-4]],'#202732',11);
      ellipse(-18+stride,-3,12,6,'#3a4044','#111b27');ellipse(21-stride,-3,12,6,'#3a4044','#111b27');
      ellipse(0,-44,21,28,suit,'#162332');ellipse(-6,-47,9,21,suit);
      line([[-18,-56],[-27,-35],[-20,-26]],skin,11);line([[18,-56],[27,-44-arm*.4],[26+arm,-38-arm]],skin,12);
      glove(26+arm,-38-arm,skin,.7);ellipse(0,-79,17,19,skin,'#202131');
      // Theme silhouettes: mohawk, pirate hat, reptilian snout, ninja wrap,
      // cowboy brim, or machine visor. Boss armor adds a distinct silhouette.
      if(era.theme==='city'){for(let i=-10;i<14;i+=5)line([[i,-93],[i+4,-106-Math.abs(i)*.3]],e.boss?'#ffbd64':'#d26da0',5);box(-17,-81,35,8,'#152b35',3);line([[-12,-78],[11,-78]],'#8decf1',3);}
      if(era.theme==='pirate'){c.fillStyle='#29283a';c.beginPath();c.moveTo(-28,-93);c.lineTo(-12,-109);c.lineTo(0,-100);c.lineTo(16,-109);c.lineTo(30,-91);c.closePath();c.fill();line([[-24,-92],[24,-92]],'#e0b674',3);ellipse(0,-99,4,5,'#f8d7a2');box(-14,-80,11,8,'#19232c',2);}
      if(era.theme==='jungle'){ellipse(15,-77,22,10,skin,'#29302b');for(let i=-10;i<=5;i+=7){c.fillStyle='#e1c56c';c.beginPath();c.moveTo(i-4,-90);c.lineTo(i,-105);c.lineTo(i+5,-90);c.fill();}line([[-14,-38],[-40,-20],[-57,-28]],skin,10);line([[10,-74],[26,-73]],'#eff0c0',2);}
      if(era.theme==='temple'){ellipse(0,-80,18,20,'#282b45','#111a2e');box(-18,-83,37,9,'#c5545e',2);box(-12,-81,26,5,'#ddd7a3');line([[-16,-80],[-39,-65],[-44,-69]],'#b7424f',6);if(e.boss){line([[-15,-95],[-30,-115]],'#d8b878',7);line([[15,-95],[30,-115]],'#d8b878',7);}}
      if(era.theme==='west'){box(-15,-113,29,23,'#7e5739',6);ellipse(0,-90,31,6,'#ae7d4d','#30282a');box(-15,-74,31,12,'#a44943',3);ellipse(-5,-81,2,2,'#151d23');ellipse(8,-81,2,2,'#151d23');}
      if(era.theme==='future'){ellipse(0,-81,20,20,'#637e8d','#19313f');box(-19,-86,39,10,'#8dffed',3);line([[-11,-68],[10,-68]],'#142734',4);line([[0,-102],[0,-111],[9,-111]],'#99aaa3',3);ellipse(0,-46,8,8,'#7bffe3');}
      if(!['city','temple','future','west'].includes(era.theme)){ellipse(5,-83,3,3,'#121e26');line([[8,-67],[17,-70]],'#342e33',2);}
      line([[-18,-29],[18,-29]],'#b5a17d',5);ellipse(0,-29,4,4,'#e6c187');
      if(e.kind==='brute'||e.boss){ellipse(-22,-56,12,10,'#819293','#293942');ellipse(22,-56,12,10,'#819293','#293942');line([[-15,-44],[15,-44]],'#d0b16c',5);}
      if(e.kind==='thrower'){line([[30,-61],[52,-68]],'#dce3da',4);ellipse(50,-67,7,7,era.color,'#29333e');}
      }
      c.restore();
      if(e.hp>0){if(e.windup>0){c.save();c.globalAlpha=.4+.3*Math.sin(t*28);const targeted=e.attack?.kind==='pounce';ellipse(targeted?e.attack.x:e.x,targeted?e.attack.y:e.y,e.attack?.kind==='slam'?140:targeted?85:e.boss?65:43,e.attack?.kind==='slam'?55:targeted?35:17,null,'#ff7856');c.restore();text('!',e.x,e.y-118*size,23,'#ffce8a','center');}if(!e.boss&&e.hp<e.maxHp){box(e.x-23,e.y-112*size,46,4,'#13202b');box(e.x-23,e.y-112*size,46*e.hp/e.maxHp,4,era.color);}}
    }
    function prop(p,s){
      if(p.hp<=0)return;const theme=G.stages[s.stage].theme;c.save();c.translate(p.x,p.y);shadow(0,0,25);
      if(theme==='future'){box(-23,-49,46,48,'#314c5b',5);box(-19,-44,38,12,'#688c91',3);line([[-14,-23],[14,-23]],'#8dffdd',4);}
      else{ellipse(0,-6,24,9,'#3d2b2b');box(-23,-45,46,39,'#916249',6);ellipse(0,-45,23,8,'#bd8c5a','#422c28');line([[-22,-36],[22,-36]],'#4b4c4c',5);line([[-22,-14],[22,-14]],'#4b4c4c',5);for(let i=-14;i<20;i+=10)line([[i,-37],[i,-14]],'#4b353144',2);}
      text('✦',0,-53,13,'#ffe3a0','center');c.restore();
    }
    function pickup(p,t){c.save();c.translate(p.x,p.y);shadow(0,0,19);c.translate(0,-15-Math.sin(t*4+p.x)*3);if(p.kind==='food'){ellipse(0,0,18,10,'#df8041','#7c4130');ellipse(0,-5,17,9,'#f4c682');line([[-12,-1],[13,-1]],'#66a469',3);line([[-11,3],[12,3]],'#a54532',4);}else if(p.kind==='energy'){c.fillStyle='#83f4da';c.beginPath();c.moveTo(3,-17);c.lineTo(-11,2);c.lineTo(-1,2);c.lineTo(-6,17);c.lineTo(13,-5);c.lineTo(3,-5);c.fill();}else{c.rotate(.6);line([[0,20],[0,-22]],'#cadbcf',7);line([[0,17],[0,6]],'#a57152',9);}c.restore();}
    function effect(f){
      const a=Math.max(0,f.life/f.max),progress=1-a;c.save();c.globalAlpha=Math.min(1,a*2);c.translate(f.x,f.y);
      if(f.kind==='word')text(f.text,0,-progress*25,16,f.color||'#ffda91','center');
      else if(['special','slam','burst'].includes(f.kind)){for(let i=0;i<3;i++){c.strokeStyle=f.color||'#ffd494';c.lineWidth=4-i;c.beginPath();c.ellipse(0,0,Math.max(1,progress*(f.kind==='special'?235:165)-i*22),Math.max(1,progress*72-i*8),0,0,TAU);c.stroke();}}
      else if(f.kind==='hit'){c.fillStyle=f.color||'#ffe1a2';c.beginPath();for(let i=0;i<16;i++){const r=(i%2?12:30)*(1+progress*.5),angle=i*TAU/16;i?c.lineTo(Math.cos(angle)*r,Math.sin(angle)*r):c.moveTo(r,0);}c.fill();ellipse(0,0,8,8,'#fff6de');}
      else if(f.kind==='debris'){for(let i=0;i<7;i++){c.save();c.translate(Math.cos(i)*progress*55,Math.sin(i)*progress*32-progress*20);c.rotate(i+progress*6);box(-4,-4,8,8,f.color);c.restore();}}
      else if(f.kind==='swipe'){c.strokeStyle='#ffc996';c.lineWidth=4;c.beginPath();c.arc(0,0,30,-1.1,1.1);c.stroke();}
      else ellipse(0,0,10+progress*30,5+progress*6,'#b2ab8555');c.restore();
    }
    function hud(s){
      for(const p of s.players){const x=p.id?650:26;colorBars(p,x);}
      function colorBars(p,x){const color=p.id?'#77e5e8':'#ff6a55';box(x-10,12,294,91,'#08151bdf',7);text((p.id?'2P / ECHO':'1P / SLOP')+'   ×'+p.lives,x,33,13,color);box(x,43,264,12,'#343a40',3);box(x,43,264*p.hp/100,12,color,3);box(x,64,210,6,'#343a40',2);box(x,64,210*p.energy/100,6,p.energy>=100?'#ffe79b':'#80cab8',2);text(p.energy>=100?'SPECIAL READY':'SPECIAL '+Math.floor(p.energy)+'%',x,88,10,p.energy>=100?'#ffe79b':'#adbdb4');}
      text(String(s.score).padStart(7,'0'),480,37,21,'#ffe4b1','center');text('ERA '+(s.stage+1)+' / 06',480,58,11,'#b1cac4','center');
      if(s.combo>1){text(s.combo+' HITS',s.players.length===2?480:907,105,25,'#ffe0a1',s.players.length===2?'center':'right');}
      const boss=s.enemies.find(e=>e.boss&&e.hp>0);if(boss){box(277,487,406,39,'#071620ee',5);text(G.stages[s.stage].boss.toUpperCase(),480,502,12,'#f6c8ab','center');box(290,510,380,7,'#323d44',2);box(290,510,380*boss.hp/boss.maxHp,7,'#ef8267',2);}
      else if(s.arena){text('CLEAR THE STREET',480,521,11,'#d0ba9a','center');}
      else{text('GO →',900,310,20,'#ffdc9f','right');text('ENCOUNTER '+Math.min(4,s.gate+1)+' / 4',480,521,10,'#b2cbc1','center');}
      if(s.transition>0){c.save();c.globalAlpha=Math.min(1,s.transition);box(230,133,500,74,'#081721cc',5);text(G.stages[s.stage].year+' / '+G.stages[s.stage].name.toUpperCase(),480,164,22,'#ffe3ab','center');text(G.stages[s.stage].tag,480,188,11,'#accdc6','center');c.restore();}
    }
    function draw(s,time){
      c.clearRect(0,0,960,540);c.save();if(s.shake>0)c.translate(Math.sin(time*83)*s.shake,Math.cos(time*77)*s.shake*.45);backdrop(s,time);
      if(s.status==='ready'){player({x:741,y:459,z:0,face:1,lives:3,id:0,invincible:0,action:null,dead:0},time,true);}
      else{c.save();c.translate(-s.camera,0);const objects=[...s.props.map(p=>({y:p.y,draw:()=>prop(p,s)})),...s.pickups.map(p=>({y:p.y,draw:()=>pickup(p,time)})),...s.enemies.map(e=>({y:e.y,draw:()=>enemy(e,s,time)})),...s.players.map(p=>({y:p.y,draw:()=>player(p,time)}))];objects.sort((a,b)=>a.y-b.y);objects.forEach(o=>o.draw());for(const b of s.shots){shadow(b.x,b.y,9);ellipse(b.x,b.y-34,7,4,'#ffc18b','#863e3a');}s.effects.forEach(effect);c.restore();hud(s);}
      c.restore();if(s.flash>0){c.fillStyle=`rgba(255,245,207,${Math.min(.55,s.flash*2)})`;c.fillRect(0,0,960,540);}
      const vignette=c.createRadialGradient(480,290,250,480,290,610);vignette.addColorStop(0,'#0000');vignette.addColorStop(1,'#02080d66');c.fillStyle=vignette;c.fillRect(0,0,960,540);
    }
    return {draw,get ready(){return !!mascot&&!!enemySprites&&backgroundReady;},get mascotReady(){return !!mascot;},get enemiesReady(){return !!enemySprites;},get backgroundReady(){return backgroundReady;}};
  }
  G.createRenderer=createRenderer;
})(window);
