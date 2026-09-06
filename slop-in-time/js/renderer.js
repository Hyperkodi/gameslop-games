(function(root){
  'use strict';
  const G=root.SlopInTime,TAU=Math.PI*2;
  function createRenderer(canvas){
    const output=canvas.getContext('2d'),world=document.createElement('canvas'),atlas=new Image(),enemyImage=new Image();world.width=480;world.height=270;
    const pixels=world.getContext('2d');let c=pixels,mascot=null,enemySprites=null,redSprites=null,enemyFrames=[];const panoramas=[];
    const frames={idle:[100,28,330,402],runA:[565,38,384,407],runB:[1080,42,369,399],jump:[99,515,344,363],crouch:[586,570,310,347],victory:[1077,523,326,389]};
    let combat=null,flyers=null;const combatImage=new Image(),flyerImage=new Image();combatImage.onload=()=>combat=prepare(combatImage).surface;combatImage.src='skin/gameslop/combat-v3.png';flyerImage.onload=()=>flyers=prepare(flyerImage).surface;flyerImage.src='skin/gameslop/flyers-v3.png';
    let bossSprites=null,redBossSprites=null;const bossFrames=[],bossImage=new Image();
    bossImage.onload=()=>{const {surface,pixels}=prepare(bossImage);bossSprites=surface;redBossSprites=document.createElement('canvas');redBossSprites.width=surface.width;redBossSprites.height=surface.height;const g=redBossSprites.getContext('2d'),d=new ImageData(new Uint8ClampedArray(pixels.data),pixels.width,pixels.height);
      for(let i=0;i<d.data.length;i+=4){const l=d.data[i]*.3+d.data[i+1]*.55+d.data[i+2]*.15;d.data[i]=Math.min(255,45+l*1.15);d.data[i+1]=l*.24;d.data[i+2]=l*.18;}g.putImageData(d,0,0);
      const rows=[[0,317],[318,343],[663,361]];for(let i=0;i<12;i++){const sx=i%4*384,[sy,h]=rows[Math.floor(i/4)],w=384;let bottom=h-1;for(;bottom>0;bottom--){let found=false;for(let x=0;x<w;x++)if(pixels.data[((sy+bottom)*surface.width+sx+x)*4+3]>128){found=true;break;}if(found)break;}bossFrames.push({sx,sy,w,h,bottom,anchor:192});}
    };bossImage.src='skin/gameslop/bosses-v3.png';
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
      // Precompute the classic low-health palette once, preserving all alpha
      // and shade detail. A boss remains visibly red between hit flashes.
      redSprites=document.createElement('canvas');redSprites.width=surface.width;redSprites.height=surface.height;
      const red=redSprites.getContext('2d'),tint=new ImageData(new Uint8ClampedArray(pixels.data),pixels.width,pixels.height);
      for(let i=0;i<tint.data.length;i+=4){const l=pixels.data[i]*.3+pixels.data[i+1]*.55+pixels.data[i+2]*.15;tint.data[i]=Math.min(255,45+l*1.15);tint.data[i+1]=l*.24;tint.data[i+2]=l*.18;}
      red.putImageData(tint,0,0);
      // Tight authored cells exclude the next row's hats/tails. Generated
      // poses do not all occupy an exact third of the source image height.
      const rects=[[0,0,342,334],[355,0,425,334],[790,0,339,334],[1136,0,400,334],[0,337,344,316],[354,337,439,316],[794,337,336,316],[1136,337,400,316],[0,654,339,349],[353,654,424,349],[777,654,347,349],[1134,654,402,349]];
      for(let i=0;i<12;i++){
        const [sx,sy,w,h]=rects[i];
        let bottom=h-1;for(;bottom>0;bottom--){let opaque=false;for(let x=0;x<w;x++)if(pixels.data[((sy+bottom)*surface.width+sx+x)*4+3]>128){opaque=true;break;}if(opaque)break;}
        let sum=0,count=0;for(let y=Math.max(0,bottom-8);y<=bottom;y++)for(let x=0;x<w;x++)if(pixels.data[((sy+y)*surface.width+sx+x)*4+3]>128){sum+=x;count++;}
        enemyFrames.push({sx,sy,w,h,bottom,anchor:count?sum/count:w*.42});
      }
    };enemyImage.src=root.SlopTimeEnemyAtlas||'skin/gameslop/enemies-pixel-v2.png';
    // Stitch scenery in world space once. Dithered overlaps soften joins;
    // the camera then scrolls one continuous strip, never swaps screen images.
    G.stages.forEach((era,index)=>{const image=new Image();image.onload=()=>{
      const stripW=1536,overlap=128,total=stripW*3-overlap*2,pan=document.createElement('canvas');pan.width=total;pan.height=340;const g=pan.getContext('2d');g.imageSmoothingEnabled=false;
      const cuts=[[0,342,683,1024],[0,342,662,1024],[0,341,682,1024],[0,338,682,1024],[0,342,656,1024],[0,341,671,1024]][index];
      for(let row=0;row<3;row++){
        const part=document.createElement('canvas');part.width=stripW;part.height=340;const p=part.getContext('2d');p.imageSmoothingEnabled=false;
        p.drawImage(image,0,cuts[row]*image.height/1024,image.width,(cuts[row+1]-cuts[row])*image.height/1024,0,0,stripW,340);
        if(row){const data=p.getImageData(0,0,overlap,340);for(let y=0;y<340;y++)for(let x=0;x<overlap;x++){const threshold=((x%4)*2+(y%4)*3)%16;if(x/overlap<threshold/16)data.data[(y*overlap+x)*4+3]=0;}p.putImageData(data,0,0);}
        g.drawImage(part,row*(stripW-overlap),0);
      }panoramas[index]=pan;
    };image.src='skin/gameslop/'+era.theme+'-pixel-v2.png';});
    function ellipse(x,y,rx,ry,fill,stroke){c.beginPath();c.ellipse(x,y,Math.max(.1,rx),Math.max(.1,ry),0,0,TAU);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=2;c.stroke();}}
    function line(points,color,width=2){c.beginPath();c.moveTo(...points[0]);for(const p of points.slice(1))c.lineTo(...p);c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.stroke();}
    function text(str,x,y,size=14,color='#f5eddb',align='left',font='monospace'){c.font=`bold ${size}px ${font}`;c.fillStyle=color;c.textAlign=align;c.fillText(str,x,y);}
    function box(x,y,w,h,color,r=0){c.fillStyle=color;c.beginPath();c.roundRect(x,y,w,h,r);c.fill();}
    function backdrop(s,t){
      const era=G.stages[s.stage],panorama=panoramas[s.stage],offset=s.camera*(4352-960)/(era.width-960);
      c.fillStyle=era.floor;c.fillRect(0,0,960,540);
      const base=G.content.floor(era,s.camera+310);c.save();c.translate(0,base-(s.cameraY||0));
      const grad=c.createLinearGradient(0,0,0,540);grad.addColorStop(0,['#132c3e','#443b48','#293e2b','#292444','#6a4435','#092c42'][s.stage]);grad.addColorStop(1,era.floor);c.fillStyle=grad;c.fillRect(0,0,960,540);
      if(panorama)c.drawImage(panorama,Math.round(offset),0,960,340,0,0,960,340);
      const shade=c.createLinearGradient(0,310,0,365);shade.addColorStop(0,'#07101700');shade.addColorStop(1,era.floor);c.fillStyle=shade;c.fillRect(0,310,960,55);
      c.fillStyle=era.floor;c.fillRect(0,362,960,178);
      const ground=c.createLinearGradient(0,340,0,540);ground.addColorStop(0,'#0000');ground.addColorStop(1,'#020b13bb');c.fillStyle=ground;c.fillRect(0,330,960,210);
      // Every ground mark tracks the same camera as the fighters.
      const start=Math.floor(s.camera/110)*110;
      for(let x=start-110;x<s.camera+1100;x+=110){const sx=x-s.camera;
        for(let y=357;y<550;y+=43){const shift=(Math.floor(y/43)%2)*55;
          if(era.theme==='jungle'){for(let n=0;n<5;n++){box(sx+n*17+shift,y+(n*13)%30,6+n%3*3,2,'#9ba46830');}line([[sx+18,y+12],[sx+25,y+4],[sx+28,y+12]],'#719852',2);}
          else if(era.theme==='pirate'){box(sx+shift,y,105,36,(Math.floor(x/110)+y)%2?'#6e493c':'#604337');line([[sx+shift,y],[sx+shift+104,y]],'#bc93694f',2);for(let n=0;n<4;n++){const grain=(Math.abs(x*7+y*11+n*37)%39);line([[sx+shift+9+grain,y+11+n*5],[sx+shift+56+grain,y+10+n*5]],n%2?'#342b2b55':'#a1785438',1);}ellipse(sx+shift+62,y+23,9,2,null,'#382d2d66');box(sx+shift+7,y+5,3,3,'#292837');box(sx+shift+97,y+5,3,3,'#292837');}
          else if(era.theme==='west'){box(sx+shift+17,y+12,34,2,'#b997593b');box(sx+shift+71,y+22,15,3,'#231f2677');}
          else{line([[sx+shift,y],[sx+shift+104,y]],'#ffffff18',2);line([[sx+shift,y],[sx+shift-18,y+40]],'#060b1266',2);if(era.theme==='future'){box(sx+shift+8,y+8,5,5,'#72d9c159');box(sx+shift+84,y+8,12,2,'#80b8c33b');}}
        }
      }
      if(era.theme==='city'){for(let x=Math.floor(s.camera/290)*290;x<s.camera+1100;x+=290){const px=x-s.camera;box(px,415,100,2,'#64b7c54a');box(px+17,423,57,4,'#ba76842a');box(px+36,427,44,2,'#64b7c54a');}}
      if(era.theme==='west'){for(let y=382;y<500;y+=89){line([[0,y],[960,y]],'#c1ae7a',3);line([[0,y+5],[960,y+5]],'#241e29',3);}for(let x=Math.floor(s.camera/70)*70;x<s.camera+1000;x+=70)box(x-s.camera,385,18,82,'#261e2733');}
      line([[0,333],[960,333]],era.color+'77',2);
      for(let x=Math.floor(s.camera/470)*470;x<s.camera+1050;x+=470){const px=x-s.camera;
        if(era.theme==='jungle'){for(let frond=0;frond<5;frond++){const dir=(frond-2)*.45,tipX=px+Math.sin(dir)*45,tipY=335-Math.cos(dir)*47;line([[px,335],[tipX,tipY]],'#65783e',2);for(let n=1;n<7;n++){const x=px+(tipX-px)*n/7,y=335+(tipY-335)*n/7,w=(7-n)*1.8;line([[x-w,y+4],[x,y],[x+w,y+4]],n%2?'#69894a':'#3a633b',3);}}}
        else if(era.theme==='pirate'){box(px-9,270,18,65,'#3d2b25',4);ellipse(px,269,11,5,'#c39265');line([[px,290],[px+470,290]],'#bc906888',3);}
        else if(era.theme==='temple'){box(px-5,251,10,84,'#342837');box(px-18,252,36,29,'#d77851',5);ellipse(px,266,12,13,'#ffc98e');line([[px-23,249],[px+23,249]],'#251b2e',7);}
        else{box(px-4,230,8,105,'#182629');line([[px,235],[px+31,235]],'#344847',4);ellipse(px+30,239,12,4,era.color);}
      }
      if(era.theme==='city'){c.strokeStyle='#82b8bd44';c.lineWidth=1;for(let i=0;i<42;i++){const x=(i*79+t*33)%1000,y=(i*47+t*430)%550;c.beginPath();c.moveTo(x,y);c.lineTo(x-8,y+22);c.stroke();}}
      if(era.theme==='future'){c.globalAlpha=.14+.05*Math.sin(t*3);c.strokeStyle=era.color;c.lineWidth=2;for(let i=0;i<7;i++){c.beginPath();c.ellipse(710-offset*.2,192,105+i*8,132+i*7,0,0,TAU);c.stroke();}c.globalAlpha=1;}
      for(let i=0;i<18;i++){const x=(i*197+Math.sin(t*.3+i)*35-offset*.5)%980,y=110+(i*71)%220+Math.sin(t+i)*12;ellipse(x,y,1.1,1.1,era.color+'66');}
      c.restore();routeScenery(s,t);
    }
    function routeScenery(s,t){
      const era=G.stages[s.stage];for(const turn of era.turns){const mix=Math.max(0,Math.min(1,(s.camera+960-turn.x+600)/280,(turn.end+850-s.camera)/280));if(!mix)continue;const left=0,right=960;
        c.save();c.globalAlpha=mix;c.beginPath();c.rect(left,0,right-left,540);c.clip();box(left,0,right-left,540,['#12242b','#133039','#1b322b','#242639','#3a2c27','#142630'][s.stage]);
        // This connector is seen from above: roofs/water/garden beds surround
        // an actual southbound strip whose collision uses the same bounds.
        for(let x=Math.floor((left+s.camera)/44)*44;x<right+s.camera;x+=44)for(let y=Math.floor((s.cameraY||0)/36)*36;y<(s.cameraY||0)+560;y+=36){const sx=x-s.camera,sy=y-(s.cameraY||0),b=G.content.bounds(era,x+22),onPath=y+18>=b.min-10&&y+18<=b.max+18;
          box(sx,sy,42,34,onPath?['#486066','#8a6550','#526647','#666078','#927550','#496570'][s.stage]:['#152029','#123c49','#163725','#23253d','#423028','#152333'][s.stage]);
          if(onPath){line([[sx+2,sy+2],[sx+39,sy+2]],era.color+'35',2);box(sx+31,sy+27,5,2,'#0005');if(era.theme==='pirate')for(let n=0;n<3;n++)line([[sx+4,sy+9+n*7],[sx+35,sy+9+n*7]],'#b18d5733',1);}
          else if((Math.floor(x/44)+Math.floor(y/36))%3===0){if(['jungle','temple'].includes(era.theme)){ellipse(sx+20,sy+15,16,11,'#436647');line([[sx+12,sy+15],[sx+26,sy+8]],'#8ca763',2);}else if(era.theme==='pirate'){line([[sx+5,sy+14],[sx+17,sy+11],[sx+31,sy+14]],'#83bcb64a',2);}else{box(sx+7,sy+5,28,24,'#34424b');box(sx+10,sy+8,22,18,'#1c2b35');for(let n=0;n<3;n++)line([[sx+12,sy+11+n*5],[sx+29,sy+11+n*5]],'#64756c',2);}}
        }
        for(let x=s.camera;x<s.camera+960;x+=8){const b=G.content.bounds(era,x);box(x-s.camera,b.min-12-(s.cameraY||0),8,6,'#acb29aff');box(x-s.camera,b.max+14-(s.cameraY||0),8,8,'#050d16bb');}
        for(const edge of [turn.x,turn.end]){const y=335+turn.offset-(s.cameraY||0);box(edge-s.camera-5,y+155,10,turn.drop-155,'#829781');box(edge-s.camera-2,y+155,4,turn.drop-155,'#c3b685');}
        const arrowX=(turn.x+turn.end)/2-s.camera,arrowY=530+turn.offset-(s.cameraY||0);line([[arrowX,arrowY-22],[arrowX,arrowY+20]],'#ffe1a8',5);line([[arrowX-13,arrowY+7],[arrowX,arrowY+20],[arrowX+13,arrowY+7]],'#ffe1a8',5);
        // Fixed edge shadows attach the connector to its neighboring scenery.
        for(let i=0;i<10;i++){box(left+i*4,0,4,540,'#06121b'+Math.round((1-i/10)*110).toString(16).padStart(2,'0'));box(right-i*4-4,0,4,540,'#06121b'+Math.round((1-i/10)*110).toString(16).padStart(2,'0'));}c.restore();
      }
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
      if(combat&&!hero&&(!p.moving||a||p.z>0)){
        const phase=a?a.age/a.duration:0,hitPose=a?.kind==='punch'&&phase>=.18&&phase<.7;
        const frame=p.z>0?(a?.kind==='kick'?5:4):['throw','propThrow'].includes(a?.kind)?6:hitPose?(p.weapon?7:a.step===3?3:1):0;
        const anchors=[[230,392],[168,392],[197,392],[142,392],[230,300],[168,302],[162,342],[114,352]],anchor=anchors[frame];
        c.save();c.scale(p.face,1);if(p.id)c.filter='hue-rotate(165deg)';c.translate(hitPose?4:0,0);c.rotate(hitPose&&a.step===2?.06:0);c.drawImage(combat,(frame%4)*384,Math.floor(frame/4)*512,384,512,-anchor[0]*.34,-anchor[1]*.34,384*.34,512*.34);
        if(p.weapon&&p.z===0&&!['throw','propThrow'].includes(a?.kind))weapon(p.weapon,hitPose?53:27,hitPose?-45:-49,hitPose?-.9+extension*1.6:-.25,1);
        if(a?.kind==='propThrow'&&!a.struck){ellipse(23,-112,25,9,'#71838d','#d0d8c3');line([[4,-113],[41,-113]],'#273e49',3);}
        if(hitPose&&!p.weapon){c.globalAlpha=.6;const y=a.step===3?-105:-51;line([[44,y-12],[64,y],[43,y+12]],'#fff0b3',3);}c.restore();
      }
      else if(mascot){const [x,y,w,h]=frames[pose],scale=.245;c.save();c.scale(-p.face,1);if(p.id)c.filter='hue-rotate(165deg)';c.drawImage(mascot,x,y,w,h,-w*scale/2,-h*scale,w*scale,h*scale);c.restore();}
      else{ellipse(0,-45,30,39,p.id?'#60d8d3':'#ed342d','#ffd9ba');ellipse(-10,-64,8,11,'#fff');ellipse(10,-64,8,11,'#fff');ellipse(-8,-64,4,7,'#111');ellipse(12,-64,4,7,'#111');box(-5,-48,10,28,'#191d22',2);box(-14,-39,28,10,'#191d22',2);}
      if(a?.kind==='special'){c.strokeStyle='#fff0b3';c.lineWidth=5;c.beginPath();c.ellipse(0,-45,50+extension*40,65,0,t*15,t*15+Math.PI*1.6);c.stroke();}
      c.restore();
      if(!hero){text(p.id?'2P':'1P',p.x,p.y-p.z-108,11,p.id?'#80e9ea':'#ffd2ac','center');if(p.weapon)text(p.weapon.toUpperCase()+' '+p.weaponHits,p.x,p.y+21,9,'#ffe4a0','center');}
    }
    function enemy(e,s,t){
      const era=G.stages[s.stage],size=e.boss?1.55:e.kind==='brute'?1.22:e.kind==='swift'?.92:1;
      if(e.boss&&bossSprites){const active=e.windup>0||e.charge>0||e.cooldown>.8,f=bossFrames[s.stage*2+Number(active)],rage=e.hp/e.maxHp<=G.BOSS_RAGE,scale=.5;
        c.save();c.translate(e.x,e.y);shadow(0,0,65);c.scale(-e.face,1);if(e.hp<=0){c.globalAlpha=e.dead/.7;c.rotate(-.8);}const floating=s.stage===3||s.stage===5,bob=floating?Math.sin(t*3)*5:Math.abs(Math.sin(e.walk))*2;c.translate(0,-bob);c.drawImage(rage?redBossSprites:bossSprites,f.sx,f.sy,f.w,f.h,-f.anchor*scale,-f.bottom*scale,f.w*scale,f.h*scale);c.restore();
        if(e.windup>0){const a=e.attack,at=a?.kind==='pounce'?a:e;ellipse(at.x,at.y,a?.kind==='slam'?140:a?.kind==='pounce'?85:62,a?.kind==='slam'?55:28,null,'#ffb584');text('!',e.x,e.y-180,23,'#ffdf9c','center');}return;
      }
      if(e.kind==='flyer'){c.save();c.translate(e.x,e.y);shadow(0,0,27);c.translate(0,-e.z-22);c.scale(-e.face,1+(e.dive>0?-.08:Math.sin(t*10)*.035));if(e.hp<=0){c.globalAlpha=e.dead/.7;c.rotate(t*5);}if(flyers)c.drawImage(flyers,(s.stage%3)*512,Math.floor(s.stage/3)*512,512,512,-64,-76,128,128);else ellipse(0,-20,30,22,era.color);c.restore();if(e.windup>0){ellipse(e.attack.x,e.attack.y,42,24,null,'#ffb47f');text('DIVE!',e.x,e.y-e.z-95,12,'#ffd6a3','center');}return;}
      c.save();c.translate(e.x,e.y);shadow(0,0,29*size);c.scale(e.face*size,size);
      if(e.hp<=0){c.globalAlpha=e.dead/.7;c.rotate(-1.4);c.translate(30,8);}
      else if(e.down>0){c.rotate(-1.3);c.translate(15,8);}
      if(enemySprites){
        const attacking=e.windup>0&&e.windup<.3||e.charge>0||e.cooldown>.95;
        const f=enemyFrames[s.stage*2+Number(attacking)],scale=.34,bob=e.windup>0?0:Math.abs(Math.sin(e.walk))*2;
        const rage=e.boss&&e.hp/e.maxHp<=G.BOSS_RAGE;
        c.save();if(e.boss&&!rage)c.filter='hue-rotate(22deg) saturate(1.25)';else if(!e.boss&&e.kind==='swift')c.filter='hue-rotate(45deg)';else if(!e.boss&&e.kind==='thrower')c.filter='hue-rotate(-35deg)';
        c.translate(0,-bob);c.rotate(e.windup>0?-.035:Math.sin(e.walk)*.015);c.drawImage(rage?redSprites:enemySprites,f.sx,f.sy,f.w,f.h,-f.anchor*scale,-f.bottom*scale,f.w*scale,f.h*scale);c.restore();
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
      if(e.kind==='guard'){ellipse(26,-45,20,32,'#334859','#adbea0');line([[12,-64],[40,-64],[40,-27],[26,-17],[12,-27],[12,-64]],era.color,3);line([[26,-64],[26,-25]],'#b4bf9a',3);}
      c.restore();
      if(e.hp>0){if(e.windup>0){c.save();c.globalAlpha=.4+.3*Math.sin(t*28);const targeted=e.attack?.kind==='pounce';ellipse(targeted?e.attack.x:e.x,targeted?e.attack.y:e.y,e.attack?.kind==='slam'?140:targeted?85:e.boss?65:43,e.attack?.kind==='slam'?55:targeted?35:17,null,'#ff7856');c.restore();text('!',e.x,e.y-118*size,23,'#ffce8a','center');}if(!e.boss&&e.hp<e.maxHp){box(e.x-23,e.y-112*size,46,4,'#13202b');box(e.x-23,e.y-112*size,46*e.hp/e.maxHp,4,era.color);}}
    }
    function prop(p,s){
      if(p.kind==='lid'){const theme=G.stages[s.stage].theme,stone=theme==='jungle',wood=['pirate','temple'].includes(theme);c.save();c.translate(p.x,p.y);ellipse(0,0,31,17,'#07121b',stone?'#8b9474':wood?'#ad8859':'#80949a');if(!p.open){ellipse(0,-3,27,14,stone?'#798365':wood?'#836243':'#5e737b',stone?'#b0b791':wood?'#c3a56f':'#a9b8ae');for(let x=-16;x<23;x+=8)line([[x,-12],[x,5]],stone?'#59654b':wood?'#493b2b':'#263e49',3);line([[-18,-4],[19,-4]],stone?'#c4c79e':wood?'#c6a06b':'#bbc3ac',2);}else{ellipse(0,1,23,11,'#00060b');if(!stone)line([[-12,7],[-12,0],[10,0],[10,8]],'#657c7b',3);}c.restore();return;}
      if(p.hp<=0)return;const theme=G.stages[s.stage].theme;c.save();c.translate(p.x,p.y);shadow(0,0,25);
      if(theme==='future'){box(-23,-49,46,48,'#314c5b',5);box(-19,-44,38,12,'#688c91',3);line([[-14,-23],[14,-23]],'#8dffdd',4);}
      else{ellipse(0,-6,24,9,'#3d2b2b');box(-23,-45,46,39,'#74503e',6);for(let i=-18;i<20;i+=8){box(i,-41,6,31,i<0?'#ae7b50':'#88583f');line([[i+2,-38],[i+3,-18]],'#382d2a77',1);}ellipse(0,-45,23,8,'#bd8c5a','#422c28');line([[-14,-48],[12,-48]],'#e0aa70',2);line([[-22,-36],[22,-36]],'#343d46',6);line([[-20,-38],[18,-38]],'#919a95',2);line([[-22,-14],[22,-14]],'#343d46',6);line([[-20,-16],[18,-16]],'#919a95',2);for(const y of [-35,-13])for(const x of [-14,10])box(x,y,2,2,'#c3bba0');}
      text('✦',0,-53,13,'#ffe3a0','center');c.restore();
    }
    function weapon(kind,x,y,angle=0,scale=1){c.save();c.translate(x,y);c.rotate(angle);c.scale(scale,scale);const steel='#d2dfd3',dark='#283744',wood='#b28255';
      line([[0,17],[0,-45]],dark,10);line([[0,15],[0,-44]],['bat','club','staff','spear','hammer'].includes(kind)?wood:steel,6);line([[0,13],[0,1]],'#654438',9);
      if(kind==='bat')line([[0,-17],[0,-48]],'#ddb779',12);
      if(kind==='club'){ellipse(0,-38,13,19,'#d1bb8c',dark);ellipse(-9,-51,7,7,'#e5d4a6');ellipse(9,-51,7,7,'#e5d4a6');}
      if(kind==='spear'){line([[0,10],[0,-68]],wood,5);c.fillStyle='#b9dbda';c.beginPath();c.moveTo(0,-84);c.lineTo(-9,-59);c.lineTo(0,-63);c.lineTo(9,-59);c.closePath();c.fill();}
      if(kind==='staff'){line([[0,34],[0,-66]],'#d1ae79',6);for(const at of [-48,-40,22,30])line([[-3,at],[3,at]],'#7c4340',3);}
      if(['saber','katana','blade'].includes(kind)){line([[-11,-8],[11,-8]],'#c7a35e',5);line([[0,-10],[3,-40],[kind==='katana'?10:6,-68]],kind==='blade'?'#83ffe6':steel,9);line([[2,-11],[5,-44],[10,-66]],'#faffda',2);}
      if(kind==='anchor'){ellipse(0,-47,7,7,null,steel);line([[-20,-26],[-16,-10],[0,-1],[16,-10],[20,-26]],steel,8);line([[-9,-34],[9,-34]],steel,6);}
      if(kind==='hammer'){box(-24,-55,48,23,dark,3);box(-21,-54,42,16,'#91a7a5',2);line([[-19,-52],[18,-52]],'#e6ddba',3);}
      if(kind==='wrench'){line([[-10,-55],[-12,-40],[0,-32],[12,-40],[10,-55]],steel,8);}
      if(kind==='coil'){for(let at=-46;at<-9;at+=8)ellipse(0,at,10,4,'#72f5e3',dark);line([[-6,-46],[6,-46]],'#efffe5',3);}
      c.restore();
    }
    function pickup(p,t){c.save();c.translate(p.x,p.y);shadow(0,0,19);c.translate(0,-10-Math.sin(t*4+p.x)*2);if(p.kind==='food'){ellipse(0,0,22,10,'#d5d7c3','#556469');ellipse(0,-3,18,10,'#df8041','#7c4130');ellipse(0,-8,17,9,'#f4c682');line([[-12,-4],[13,-4]],'#66a469',3);line([[-11,0],[12,0]],'#a54532',4);for(let i=0;i<5;i++)box(-8+i*4,-12+(i%2)*3,2,2,'#fff0bb');}else if(p.kind==='energy'){box(-10,-25,20,32,'#33515a',4);box(-8,-23,16,27,'#65c9bc',2);ellipse(0,-25,9,3,'#e2e7cb');line([[-3,-20],[3,-20]],'#29444d',2);text('S',0,-3,16,'#fff0bf','center');}else weapon(p.weapon||'pipe',0,9,.95,.72);c.restore();}
    function trap(t,s,time){c.save();c.translate(t.x,t.y);const color=t.warning?'#ffc170':t.active?'#ff5b49':'#6b888b';ellipse(0,0,39,22,'#14232c',color);
      if(['steam','laser','arrows'].includes(t.kind)){for(let x=-24;x<30;x+=9)line([[x,-10],[x,10]],'#71838b',4);}
      if(t.kind==='spikes'){for(let x=-26;x<30;x+=13){c.fillStyle=t.active?'#eee4bd':'#859598';c.beginPath();c.moveTo(x-5,3);c.lineTo(x,t.active?-42:-5);c.lineTo(x+5,3);c.fill();}}
      if(t.kind==='cannon'){ellipse(-24,-12,11,11,'#2b343c','#a1a99b');line([[-24,-16],[10,-29]],'#637783',14);ellipse(11,-30,8,6,'#11222c');}
      if(t.kind==='rail'){box(-44,-9,88,18,'#594831');line([[-47,-10],[47,-10]],'#afa998',3);line([[-47,10],[47,10]],'#afa998',3);}
      if(t.warning){text('!',0,-39,21,'#ffcd89','center');ellipse(0,0,t.kind==='rail'?100:38,['laser','arrows'].includes(t.kind)?125:30,null,'#ffb671');}
      if(t.active){if(t.kind==='steam'){for(let n=0;n<6;n++){const rise=(time*130+n*21)%115;ellipse(Math.sin(n+time)*12,-rise,10+rise*.12,13,'#e1f5ceaa');}}
        else if(t.kind==='laser')line([[0,-125],[0,125]],'#a7ffeb',7);
        else if(t.kind==='arrows')for(let n=0;n<3;n++){const y=(time*330+n*90)%250-125;line([[0,y+20],[0,y-15]],'#dfd9b3',4);line([[-5,y-8],[0,y-15],[5,y-8]],'#d9f3dd',3);}
        else if(t.kind==='rail'){const x=(time*440)%200-100;box(x-22,-35,44,35,'#927057',3);ellipse(x-13,0,8,8,'#1a2c34');ellipse(x+13,0,8,8,'#1a2c34');}
        else if(t.kind==='cannon'){ellipse(12+Math.sin(time*23)*20,-19,15,15,'#ffc987');}}
      c.restore();
    }
    function effect(f){
      const a=Math.max(0,f.life/f.max),progress=1-a;c.save();c.globalAlpha=Math.min(1,a*2);c.translate(f.x,f.y);
      if(f.kind==='word')text(f.text,0,-progress*25,16,f.color||'#ffda91','center');
      else if(['special','slam','burst'].includes(f.kind)){for(let i=0;i<3;i++){c.strokeStyle=f.color||'#ffd494';c.lineWidth=4-i;c.beginPath();c.ellipse(0,0,Math.max(1,progress*(f.kind==='special'?235:165)-i*22),Math.max(1,progress*72-i*8),0,0,TAU);c.stroke();}}
      else if(f.kind==='hit'){c.fillStyle=f.color||'#ffe1a2';c.beginPath();for(let i=0;i<16;i++){const r=(i%2?12:30)*(1+progress*.5),angle=i*TAU/16;i?c.lineTo(Math.cos(angle)*r,Math.sin(angle)*r):c.moveTo(r,0);}c.fill();ellipse(0,0,8,8,'#fff6de');}
      else if(f.kind==='debris'){for(let i=0;i<7;i++){c.save();c.translate(Math.cos(i)*progress*55,Math.sin(i)*progress*32-progress*20);c.rotate(i+progress*6);box(-4,-4,8,8,f.color);c.restore();}}
      else if(f.kind==='swipe'){c.strokeStyle='#ffc996';c.lineWidth=4;c.beginPath();c.arc(0,0,30,-1.1,1.1);c.stroke();}
      else ellipse(0,0,10+progress*30,5+progress*6,'#b2ab8555');c.restore();
    }
    function hazard(h,t){
      const warning=h.delay>0;c.save();c.translate(h.x,h.y);
      c.globalAlpha=warning?.35+.15*Math.sin(t*18):.85;
      ellipse(0,0,h.rx,h.ry,warning?'#ff4b4022':h.kind==='time'?null:h.color+'55',warning?'#ffba78':h.color);
      if(warning){line([[-10,0],[10,0]],'#ffe1a4',2);line([[0,-9],[0,9]],'#ffe1a4',2);}
      else if(h.kind==='electric'){for(let n=0;n<2;n++){const points=[];for(let x=-h.rx;x<=h.rx;x+=18)points.push([x,Math.sin(x*.5+t*40+n)*12-6]);line(points,n?'#fff8d0':'#70edff',n?2:6);}}
      else if(h.kind==='cannon'){ellipse(0,-80+Math.min(1,h.age*5)*75,12,12,'#182432','#fbc183');for(let i=0;i<9;i++){const a=i*TAU/9;box(Math.cos(a)*h.age*140,Math.sin(a)*h.age*90-25,9,7,'#ffd084');}}
      else if(h.kind==='steam'){for(let i=0;i<7;i++){const rise=(t*100+i*19)%115;ellipse(Math.sin(i+t*3)*10,-rise,12+rise*.12,10,'#daf7e3bb');}box(-21,-5,42,7,'#fff6c1');}
      else if(h.kind==='shadow'){line([[-h.rx,-55],[h.rx,8]],'#c8a1ff',9);line([[-h.rx,8],[h.rx,-55]],'#ffe9ff',5);}
      else if(h.kind==='quake'){line([[-22,0],[-15,-18],[-4,-8],[4,-34],[15,-11],[24,0]],'#ffe2a1',6);}
      else if(h.kind==='time'){ellipse(0,0,h.rx-8,Math.max(2,h.ry-4),null,'#eefcff');}
      c.restore();
    }
    function hud(s){
      for(const p of s.players){const x=p.id?650:26;colorBars(p,x);}
      function colorBars(p,x){const color=p.id?'#77e5e8':'#ff6a55';box(x-10,12,294,91,'#08151bdf',7);text((p.id?'2P / ECHO':'1P / SLOP')+'   ×'+p.lives,x,33,13,color);box(x,43,264,12,'#343a40',3);box(x,43,264*p.hp/100,12,color,3);box(x,64,210,6,'#343a40',2);box(x,64,210*p.energy/100,6,p.energy>=100?'#ffe79b':'#80cab8',2);text(p.energy>=100?'SPECIAL READY':'SPECIAL '+Math.floor(p.energy)+'%',x,88,10,p.energy>=100?'#ffe79b':'#adbdb4');}
      text(String(s.score).padStart(7,'0'),480,37,21,'#ffe4b1','center');text('ERA '+(s.stage+1)+' / 06',480,58,11,'#b1cac4','center');
      if(s.combo>1){text(s.combo+' HITS',s.players.length===2?480:907,105,25,'#ffe0a1',s.players.length===2?'center':'right');}
      const era=G.stages[s.stage],boss=s.enemies.find(e=>e.boss&&e.hp>0);
      const landmark=Math.min(6,Math.floor((s.camera+310)/era.width*7));
      text(era.landmarks[landmark].toUpperCase(),480,76,10,'#bed9cd','center');
      box(372,84,216,3,'#1d383b');box(372,84,216*Math.min(1,(s.camera+960)/era.width),3,era.color);
      if(boss){const rage=boss.hp/boss.maxHp<=G.BOSS_RAGE;box(253,487,454,39,'#071620ee',5);text(era.boss.toUpperCase()+(rage?' / ENRAGED':''),480,502,12,rage?'#ff6655':'#f6c8ab','center');box(266,510,428,7,'#323d44',2);box(266,510,428*boss.hp/boss.maxHp,7,rage?'#ff3f40':'#ef8267',2);
        if(boss.attack?.kind==='super'||s.hazards.length){box(235,116,490,52,'#10151eee',3);text(era.superName,480,137,17,era.color,'center');text(era.superHint,480,155,10,'#ffe1b3','center');}
      }
      else if(s.arena){text('CLEAR THE STREET',480,521,11,'#d0ba9a','center');}
      else{text(s.players[0]&&G.content.nextTurn(era,s.players[0])?'GO ↓':'GO →',900,310,20,'#ffdc9f','right');text('ENCOUNTER '+Math.min(era.encounters.length,s.gate+1)+' / '+era.encounters.length,480,521,10,'#b2cbc1','center');}
      if(s.story?.life>0&&s.transition<=0){const words=s.story.text.split(' '),lines=[''];for(const word of words){if((lines.at(-1)+' '+word).length>47)lines.push(word);else lines[lines.length-1]+=(lines.at(-1)?' ':'')+word;}box(185,181,590,32+lines.length*22,'#091923eb',4);text('SLOP / '+era.year,203,200,10,era.color);lines.forEach((line,i)=>text(line,203,222+i*22,17,'#f5e7c8'));}
      if(s.transition>0){c.save();c.globalAlpha=Math.min(1,s.transition);box(230,133,500,74,'#081721cc',5);text(G.stages[s.stage].year+' / '+G.stages[s.stage].name.toUpperCase(),480,164,22,'#ffe3ab','center');text(G.stages[s.stage].tag,480,188,11,'#accdc6','center');c.restore();}
    }
    function draw(s,time){
      c=pixels;c.setTransform(.5,0,0,.5,0,0);c.imageSmoothingEnabled=false;c.clearRect(0,0,960,540);c.save();if(s.shake>0)c.translate(Math.round(Math.sin(time*83)*s.shake),Math.round(Math.cos(time*77)*s.shake*.45));backdrop(s,time);
      if(s.status==='ready'){player({x:741,y:459,z:0,face:1,lives:3,id:0,invincible:0,action:null,dead:0},time,true);}
      else{c.save();c.translate(-Math.round(s.camera),-Math.round(s.cameraY||0));s.hazards.forEach(h=>hazard(h,time));const visible=p=>p.x>s.camera-180&&p.x<s.camera+1140;(s.traps||[]).filter(visible).forEach(t=>trap(t,s,time));const objects=[...s.props.filter(visible).map(p=>({y:p.y,draw:()=>prop(p,s)})),...s.pickups.filter(visible).map(p=>({y:p.y,draw:()=>pickup(p,time)})),...s.enemies.map(e=>({y:e.y,draw:()=>enemy(e,s,time)})),...s.players.map(p=>({y:p.y,draw:()=>player(p,time)}))];objects.sort((a,b)=>a.y-b.y);objects.forEach(o=>o.draw());for(const b of s.shots){shadow(b.x,b.y,9);ellipse(b.x,b.y-34,7,4,'#ffc18b','#863e3a');}for(const m of s.missiles||[]){shadow(m.x,m.y,18);c.save();c.translate(m.x,m.y-m.z);c.rotate(time*25);ellipse(0,0,24,9,'#82979f','#d0decd');line([[-17,0],[17,0]],'#2e4552',3);c.restore();}s.effects.forEach(effect);c.restore();}
      c.restore();if(s.flash>0){c.fillStyle=`rgba(255,245,207,${Math.min(.55,s.flash*2)})`;c.fillRect(0,0,960,540);}
      const vignette=c.createRadialGradient(480,290,250,480,290,610);vignette.addColorStop(0,'#0000');vignette.addColorStop(1,'#02080d66');c.fillStyle=vignette;c.fillRect(0,0,960,540);
      output.imageSmoothingEnabled=false;output.clearRect(0,0,960,540);output.drawImage(world,0,0,960,540);c=output;if(s.status!=='ready')hud(s);c=pixels;
    }
    return {draw,get ready(){return !!mascot&&!!enemySprites&&!!combat&&!!flyers&&!!bossSprites&&panoramas.filter(Boolean).length===6;},get mascotReady(){return !!mascot;},get enemiesReady(){return !!enemySprites;},get backgroundReady(){return panoramas.filter(Boolean).length===6;},inspect(){return {world:[world.width,world.height],panoramas:panoramas.map(p=>[p.width,p.height]),redPalette:!!redBossSprites,combat:!!combat,flyers:!!flyers,bosses:bossFrames.length};}};
  }
  G.createRenderer=createRenderer;
})(window);
