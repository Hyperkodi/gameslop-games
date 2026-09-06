(function(root){
  'use strict';
  const G=root.SlopInTime,TAU=Math.PI*2;
  function createRenderer(canvas){
    const output=canvas.getContext('2d'),world=document.createElement('canvas'),atlas=new Image(),enemyImage=new Image();world.width=480;world.height=270;
    const pixels=world.getContext('2d');let c=pixels,mascot=null,enemySprites=null,redSprites=null,enemyFrames=[];const panoramas=[];
    const frames={idle:[100,28,330,402],runA:[565,38,384,407],runB:[1080,42,369,399],jump:[99,515,344,363],crouch:[586,570,310,347],victory:[1077,523,326,389]};
    let combat=null,flyers=null;const combatImage=new Image(),flyerImage=new Image();combatImage.onload=()=>combat=prepare(combatImage).surface;combatImage.src='skin/gameslop/combat-v3.png';flyerImage.onload=()=>flyers=prepare(flyerImage).surface;flyerImage.src='skin/gameslop/flyers-v3.png';
    let sideSprites=null;const sideFrames=[],sideImage=new Image();
    sideImage.onload=()=>{const {surface,pixels}=prepare(sideImage);sideSprites=surface;
      // Align the torso rather than the changing stride width. Run passing poses
      // retain their authored lift above the row's common ground line.
      const cuts=[[0,425,780,1140,1536],[0,410,780,1145,1536]];
      for(let row=0;row<2;row++)for(let col=0;col<4;col++){
        const sx=cuts[row][col],sy=row*512,w=cuts[row][col+1]-sx,h=512;let top=h;
        for(let y=0;y<h&&top===h;y++)for(let x=0;x<w;x++)if(pixels.data[((sy+y)*surface.width+sx+x)*4+3]>128){top=y;break;}
        let left=w,right=0;for(let y=top+85;y<top+145;y++)for(let x=0;x<w;x++)if(pixels.data[((sy+y)*surface.width+sx+x)*4+3]>128){left=Math.min(left,x);right=Math.max(right,x);}
        sideFrames.push({sx,sy,w,h,anchor:(left+right)/2,bottom:row?368:436});
      }
    };sideImage.src='skin/gameslop/mascot-side-v1.png';
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
      const era=G.stages[s.stage],pan=panoramas[s.stage],offset=s.camera*(4352-960)/(era.width-960),cy=s.cameraY||0;
      box(0,0,960,540,era.floor);
      // A single stitched panorama stays present through every bend. The distant
      // skyline has parallax; the foreground follows the actual walkable route.
      if(pan)c.drawImage(pan,Math.round(offset),0,960,280,0,0,960,280);
      for(let sx=0;sx<960;sx+=8){const wx=s.camera+sx,b=G.content.bounds(era,wx),top=b.min-20-cy,bottom=b.max+22-cy;
        if(pan)c.drawImage(pan,Math.round(offset)+sx,250,8,90,sx,250,8,Math.max(1,top-250));
        box(sx,top,8,540-top,era.floor);box(sx,top,8,3,era.color+'66');box(sx,bottom,8,540-bottom,'#06131b99');box(sx,bottom,8,5,'#020a12aa');
      }
      for(let x=Math.floor(s.camera/96)*96;x<s.camera+1060;x+=96){const f=G.content.floor(era,x),sx=x-s.camera;
        for(let lane=0;lane<4;lane++){const y=354+f-cy+lane*38;
          if(era.theme==='jungle'){line([[sx+14,y+9],[sx+22,y],[sx+25,y+9]],'#80964c',3);box(sx+60,y+10,16,3,'#b8b47944');}
          else if(era.theme==='pirate'){box(sx+2,y,91,32,lane%2?'#74513e':'#624332');line([[sx+5,y+4],[sx+86,y+4]],'#c09a6655',2);for(let n=0;n<3;n++)line([[sx+12,y+12+n*5],[sx+72,y+10+n*5]],'#30232155',1);box(sx+8,y+7,3,3,'#bdaa86');}
          else{line([[sx+2,y],[sx+87,y+G.content.floor(era,x+87)-f]],'#b2c6b026',2);box(sx+19,y+15,21,2,era.theme==='west'?'#d7b87944':'#85b9c22a');}
        }
      }
      // Seven authored landmark sections share world coordinates and joins.
      for(let x=Math.floor(s.camera/390)*390;x<s.camera+1120;x+=390){const sx=x-s.camera,y=G.content.bounds(era,x).min-22-cy,section=Math.min(6,Math.floor(x/era.width*7));
        if(['jungle','temple'].includes(era.theme)){for(let n=0;n<5;n++){const dx=(n-2)*17;line([[sx,y],[sx+dx,y-36-Math.abs(dx)*.2]],'#456344',5);for(let k=1;k<4;k++)line([[sx+dx*k/4-12,y-k*10+4],[sx+dx*k/4,y-k*10],[sx+dx*k/4+12,y-k*10+4]],'#739452',3);}if(era.theme==='temple'){box(sx+45,y-58,6,58,'#302734');box(sx+33,y-56,30,25,'#c97a61',4);box(sx+39,y-53,18,19,'#ffd39a',4);}}
        else if(era.theme==='pirate'){box(sx-9,y-54,18,54,'#3b2c28');ellipse(sx,y-54,12,5,'#c79868');line([[sx,y-30],[sx+70,y-22]],'#b9986b',3);}
        else{box(sx-4,y-85,8,85,'#14272e');line([[sx,y-84],[sx+29,y-84]],'#52656a',4);ellipse(sx+29,y-80,14,4,era.color);if(section%2){box(sx+48,y-30,47,29,'#344d55',3);box(sx+52,y-27,39,7,era.color+'66');}}
      }
      if(era.theme==='city')for(let i=0;i<40;i++){const x=(i*79+t*33)%1000,y=(i*47+t*430)%550;line([[x,y],[x-6,y+18]],'#82b8bd33',1);}
    }
    function shadow(x,y,rx=30){ellipse(x,y+1,rx,9,'#02090dbb');}
    function glove(x,y,color='#ef4134',scale=1){c.save();c.translate(x,y);c.scale(scale,scale);ellipse(0,0,15,12,color,'#431a24');ellipse(6,6,7,6,color,'#431a24');line([[-8,-5],[5,-7]],'#ffd5b5',2);line([[-5,3],[4,3]],'#981f2b',2);c.restore();}
    // Animate the painted boots/legs independently, retaining each character's pixel art.
    // Two opposing footfalls, lift on the return step, and a small weight shift.
    function walkingSprite(sheet,f,scale,phase,{run=false,cut=.62,facing=1,heavy=false}={}){
      const split=Math.round(f.bottom*cut),hip=(split-f.bottom)*scale;
      const stride=heavy?5:run?12:8,lift=heavy?3:run?10:6,bob=Math.abs(Math.sin(phase))*(run?3:1.5);
      const middle=Math.max(1,Math.min(f.w-1,Math.round(f.anchor)));
      for(const side of [-1,1]){
        const swing=Math.sin(phase+(side<0?Math.PI:0)),raised=Math.max(0,Math.cos(phase+(side<0?Math.PI:0)))*lift;
        const sx=side<0?0:middle,w=side<0?middle:f.w-middle;
        c.save();c.translate(swing*stride,-raised);c.translate(0,hip);c.rotate(swing*(run?.17:.1));
        c.drawImage(sheet,f.sx+sx,f.sy+split-5,w,f.h-split+5,(sx-f.anchor)*scale,-5*scale,w*scale,(f.h-split+5)*scale);c.restore();
      }
      c.save();c.translate(0,hip-bob);c.rotate(run?facing*.09:Math.sin(phase)*.018);
      c.drawImage(sheet,f.sx,f.sy,f.w,split+7,-f.anchor*scale,-split*scale,f.w*scale,(split+7)*scale);c.restore();
    }
    function player(p,t,hero=false){
      if(p.lives<=0&&p.dead<=0)return;c.save();c.translate(p.x,p.y);shadow(0,0,hero?65:30);c.translate(0,-p.z);
      if(p.dead>0){c.globalAlpha=Math.min(1,p.dead);c.rotate(-p.face*1.25);}
      else if(p.hurt>0)c.rotate(-p.face*.13);
      if(!hero&&p.invincible>0&&Math.floor(t*12)%2===0)c.globalAlpha=.65;
      c.scale(hero?2.7:1,hero?2.7:1);
      const a=p.action,extension=a?Math.sin(Math.min(1,a.age/a.duration)*Math.PI):0;
      const pose=hero?'victory':p.z>0?'jump':a?.kind==='special'?'victory':a?.kind==='throw'?'victory':p.moving?Math.sin(p.walk)>0?'runA':'runB':'idle';
      const walking=!hero&&p.moving&&p.z===0&&!a&&p.hurt<=0&&p.dead<=0;
      if(sideSprites&&walking){
        const f=sideFrames[(p.running?4:0)+Math.floor(((p.walk%TAU)+TAU)%TAU/TAU*4)],scale=.3;
        c.save();c.scale(p.face,1);if(p.id)c.filter='hue-rotate(165deg)';
        c.drawImage(sideSprites,f.sx,f.sy,f.w,f.h,-f.anchor*scale,-f.bottom*scale,f.w*scale,f.h*scale);
        if(p.weapon)weapon(p.weapon,22,-43,-.25,1);c.restore();
      }
      else if(combat&&!hero&&(!p.moving||a||p.z>0)){
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
      const arrival=e.entrance;if(arrival&&arrival.age<arrival.delay)return;const progress=arrival?.progress||0;
      if(arrival&&['rift','descend'].includes(arrival.style)){ellipse(arrival.landX,arrival.landY,60,18,null,G.stages[s.stage].color);}
      const era=G.stages[s.stage],size=e.boss?1.55:e.kind==='brute'?1.22:e.kind==='swift'?.92:1;
      if(e.boss&&bossSprites){const active=e.windup>0||e.charge>0||!e.moving&&e.cooldown>.8,f=bossFrames[s.stage*2+Number(active)],rage=e.hp/e.maxHp<=G.BOSS_RAGE,scale=.5;
        c.save();c.translate(e.x,e.y);shadow(0,0,65);c.translate(0,-(e.z||0));if(arrival?.style==='rift'){c.globalAlpha=progress;c.scale(.6+.4*progress,.6+.4*progress);}c.scale(-e.face,1);if(e.hp<=0){c.globalAlpha=Math.max(0,1-(s.ending?.age||0)/2.3);c.translate(Math.sin(t*95)*5,0);}const floating=s.stage===3||s.stage===5,bob=floating?Math.sin(t*3)*5:0;c.translate(0,-bob);if(e.moving&&!arrival&&!floating&&!active)walkingSprite(rage?redBossSprites:bossSprites,f,scale,e.walk,{heavy:true,cut:s.stage===4?.9:.76,facing:-1});else c.drawImage(rage?redBossSprites:bossSprites,f.sx,f.sy,f.w,f.h,-f.anchor*scale,-f.bottom*scale,f.w*scale,f.h*scale);c.restore();
        if(e.windup>0){const a=e.attack,at=a?.kind==='pounce'?a:e;ellipse(at.x,at.y,a?.kind==='slam'?140:a?.kind==='pounce'?85:62,a?.kind==='slam'?55:28,null,'#ffb584');text('!',e.x,e.y-180,23,'#ffdf9c','center');}return;
      }
      if(e.kind==='flyer'){c.save();c.translate(e.x,e.y);shadow(0,0,27);c.translate(0,-e.z-22);c.scale(-e.face,1+(e.dive>0?-.08:Math.sin(t*10)*.035));if(e.hp<=0){c.globalAlpha=e.dead/.7;c.rotate(t*5);}if(flyers)c.drawImage(flyers,(s.stage%3)*512,Math.floor(s.stage/3)*512,512,512,-64,-76,128,128);else ellipse(0,-20,30,22,era.color);c.restore();if(e.windup>0){ellipse(e.attack.x,e.attack.y,42,24,null,'#ffb47f');text('DIVE!',e.x,e.y-e.z-95,12,'#ffd6a3','center');}return;}
      c.save();c.translate(e.x,e.y);shadow(0,0,29*size);c.translate(0,-(e.z||0));c.scale(e.face*size,size);
      if(e.hp<=0){c.globalAlpha=e.dead/.7;c.rotate(-1.4);c.translate(30,8);}
      else if(e.down>0){c.rotate(-1.3);c.translate(15,8);}
      if(enemySprites){
        const attacking=!!arrival||e.windup>0||e.charge>0||!e.moving&&e.cooldown>.95;
        const f=enemyFrames[s.stage*2+Number(attacking)],scale=.34,bob=0;
        const rage=e.boss&&e.hp/e.maxHp<=G.BOSS_RAGE;
        c.save();if(e.boss&&!rage)c.filter='hue-rotate(22deg) saturate(1.25)';else if(!e.boss&&e.kind==='swift')c.filter='hue-rotate(135deg) saturate(1.5)';else if(!e.boss&&e.kind==='thrower')c.filter='hue-rotate(-70deg) saturate(1.6)';
        c.translate(0,-bob);
        if(arrival?.style==='flip'){c.translate(0,-45);c.rotate(progress*Math.PI*2);c.translate(0,45);}
        else c.rotate(arrival?.style==='charge'?-.16:arrival?.style==='vault'?-.35*Math.sin(progress*Math.PI):e.windup>0?-.035:0);
        if(arrival?.style==='kick'&&progress<.88){
          // Keep the authored torso; articulated legs make the arrival a kick.
          const crop=f.bottom-85;c.drawImage(enemySprites,f.sx,f.sy,f.w,crop,-f.anchor*scale,-f.bottom*scale,f.w*scale,crop*scale);
          const suit=['#514876','#584e73','#71894e','#403976','#665237','#416873'][s.stage];
          line([[-8,-31],[-22,-15],[-9,-6]],'#142432',14);line([[-8,-31],[-22,-15],[-9,-6]],suit,9);
          line([[6,-31],[25,-27],[48,-23]],'#142432',15);line([[6,-31],[25,-27],[48,-23]],suit,10);box(43,-30,19,11,'#8b9c9c',2);box(47,-29,17,4,'#d9d9bd',1);
        }else if(e.moving&&!arrival&&!attacking)walkingSprite(enemySprites,f,scale,e.walk,{cut:.61});else c.drawImage(rage?redSprites:enemySprites,f.sx,f.sy,f.w,f.h,-f.anchor*scale,-f.bottom*scale,f.w*scale,f.h*scale);c.restore();
        if(e.kind==='thrower'){projectile({kind:['arc','bomb','venom','shuriken','bullet','pulse'][s.stage],x:31,y:-14,z:34},t);}if(e.kind==='swift')line([[-20,-68],[-39,-57],[-50,-61]],'#6ee9df',5);
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
      if(e.defend>0){line([[17,-63],[33,-58],[29,-40]],'#c7e6e0',4);}c.restore();
      if(e.hp>0&&!arrival){if(e.windup>0){c.save();c.globalAlpha=.4+.3*Math.sin(t*28);const targeted=e.attack?.kind==='pounce';ellipse(targeted?e.attack.x:e.x,targeted?e.attack.y:e.y,e.attack?.kind==='slam'?140:targeted?85:e.boss?65:43,e.attack?.kind==='slam'?55:targeted?35:17,null,'#ff7856');c.restore();text('!',e.x,e.y-118*size,23,'#ffce8a','center');}if(!e.boss&&e.hp<e.maxHp){box(e.x-23,e.y-112*size,46,4,'#13202b');box(e.x-23,e.y-112*size,46*e.hp/e.maxHp,4,era.color);}}
    }
    function sceneryItem(kind,used=false){
      const metal='#93aaa7',dark='#29414b',wood='#a67e54';
      if(['hydrant','valve'].includes(kind)){box(-13,-36,26,36,used?'#546d69':'#a9543e',5);ellipse(0,-37,16,6,'#d48c66');line([[-20,-21],[20,-21]],metal,10);ellipse(0,-45,12,5,null,'#d9b279');}
      else if(['cutoff','console'].includes(kind)){box(-21,-46,42,46,dark,4);box(-17,-41,34,23,used?'#426963':'#72c5b7',2);if(kind==='cutoff')line([[-6,-31],[9,-20]],'#f4cf83',6);else{line([[-11,-33],[9,-33]],'#d4fae1',2);box(-9,-25,13,3,'#285957');}for(const x of [-10,2,12])ellipse(x,-9,3,3,'#d7b883');}
      else if(['capstan','winch','brake'].includes(kind)){box(-20,-13,40,13,wood,3);line([[0,-5],[0,-43]],metal,8);ellipse(0,-28,16,15,'#775a43',metal);line([[-22,-43],[22,-43]],wood,6);line([[0,-60],[0,-28]],wood,5);}
      else if(kind==='slab'){box(-28,-20,56,20,'#819584',6);line([[-22,-16],[4,-18],[23,-10]],'#cad0ad',3);}
      else if(kind==='battery'){box(-18,-39,36,39,dark,5);box(-12,-44,9,6,metal);box(5,-44,9,6,metal);box(-13,-32,26,23,'#65bdac',3);line([[4,-30],[-4,-20],[4,-20],[-3,-11]],'#e3f4b8',3);}
      else if(kind==='scooter'){for(const x of [-27,27])ellipse(x,-3,10,10,dark,metal);line([[-27,-9],[23,-9],[16,-50],[6,-50]],'#cb7760',7);line([[-4,-15],[12,-30],[23,-9]],metal,5);}
      else if(kind==='log'){box(-36,-25,72,27,'#715238',9);ellipse(-32,-13,13,14,'#c1a271','#433c31');ellipse(-32,-13,7,8,null,'#755636');for(const y of [-21,-8])line([[-13,y],[29,y-3]],'#bd94604f',3);}
      else if(kind==='bell'){line([[-28,0],[-28,-78],[28,-78],[28,0]],wood,7);line([[0,-78],[0,-65]],metal,3);ellipse(0,-40,23,29,'#b99a58','#e5cf95');box(-25,-27,50,7,'#b29356',3);ellipse(0,-23,5,6,'#e8ca90');}
      else if(kind==='powder'){box(-23,-44,46,42,'#896443',7);ellipse(0,-44,23,7,'#c0a171');for(const y of [-35,-12])line([[-23,y],[23,y]],metal,5);line([[-9,-22],[9,-22]],'#dcbe88',3);}
    }
    function prop(p,s){
      if(p.kind==='lid'){const theme=G.stages[s.stage].theme,stone=theme==='jungle',wood=['pirate','temple'].includes(theme);c.save();c.translate(p.x,p.y);ellipse(0,0,31,17,'#07121b',stone?'#8b9474':wood?'#ad8859':'#80949a');if(!p.open){ellipse(0,-3,27,14,stone?'#798365':wood?'#836243':'#5e737b',stone?'#b0b791':wood?'#c3a56f':'#a9b8ae');for(let x=-16;x<23;x+=8)line([[x,-12],[x,5]],stone?'#59654b':wood?'#493b2b':'#263e49',3);line([[-18,-4],[19,-4]],stone?'#c4c79e':wood?'#c6a06b':'#bbc3ac',2);}else{ellipse(0,1,23,11,'#00060b');if(!stone)line([[-12,7],[-12,0],[10,0],[10,8]],'#657c7b',3);}c.restore();return;}
      if(['hydrant','valve','cutoff','console','capstan','winch','brake','slab','battery','scooter','log','bell','powder'].includes(p.kind)){if(p.hp<=0&&['slab','battery','scooter','log','powder'].includes(p.kind))return;c.save();c.translate(p.x,p.y);shadow(0,0,25);sceneryItem(p.kind,p.hp<=0);if(p.hp>0)text('HIT',0,-86,9,'#e9d09c','center');c.restore();return;}
      if(p.hp<=0)return;const theme=G.stages[s.stage].theme;c.save();c.translate(p.x,p.y);shadow(0,0,25);
      if(p.kind==='gong'){line([[-25,0],[-25,-74],[25,-74],[25,0]],'#8e6b47',6);ellipse(0,-45,23,25,'#b89a50','#eed78e');ellipse(0,-45,9,10,'#eed68b');}else if(p.kind==='switch'){box(-20,-30,40,30,'#344b56',3);line([[0,-23],[14,-53]],'#ccd9c9',6);ellipse(14,-54,8,8,'#f07559');line([[-12,-13],[11,-13]],'#ffd478',3);}else if(theme==='future'){box(-23,-49,46,48,'#314c5b',5);box(-19,-44,38,12,'#688c91',3);line([[-14,-23],[14,-23]],'#8dffdd',4);}
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
    function pickup(p,t){c.save();c.translate(p.x,p.y);shadow(0,0,20);c.translate(0,-10-Math.sin(t*4+p.x)*2);
      if(p.kind==='food'){
        ellipse(0,1,24,10,'#e2e1c9','#52626c');const food=p.food||'burger';
        if(food==='burger'){ellipse(0,-3,18,10,'#df8041','#7c4130');ellipse(0,-10,18,9,'#f4c682');line([[-14,-5],[14,-5]],'#65a14c',4);line([[-14,0],[14,0]],'#633426',4);for(let i=0;i<5;i++)box(-9+i*4,-14+(i%2)*3,2,2,'#fff0bb');}
        if(food==='hotdog'){box(-23,-13,46,17,'#edba72',8);box(-21,-10,42,9,'#aa4330',5);line([[-17,-8],[-10,-4],[-3,-8],[4,-4],[12,-8],[18,-4]],'#ffdc65',2);}
        if(food==='pizza'){c.fillStyle='#f5ce72';c.beginPath();c.moveTo(-22,-21);c.lineTo(21,-12);c.lineTo(-8,9);c.closePath();c.fill();line([[-22,-21],[21,-12]],'#ca853e',6);for(const [x,y] of [[-10,-12],[5,-9],[-6,-1]])ellipse(x,y,4,3,'#b94d37');}
        if(food==='ramen'){ellipse(0,-3,23,14,'#bd554b','#f1d7b2');ellipse(0,-12,23,9,'#efd1a0');for(let i=0;i<4;i++)line([[-15+i*3,-12+i*2],[-4,-16+i*3],[13-i*2,-12+i*2]],'#c49e59',2);ellipse(9,-13,7,5,'#fff3cf');ellipse(9,-13,3,3,'#efaf43');line([[-16,-17],[15,-35]],'#9d653e',3);line([[-10,-16],[21,-34]],'#d3a76a',3);}
        text('+'+G.content.foods[food].heal,0,25,10,'#b5f5b3','center');
      }else if(p.kind==='energy'){
        box(-21,-31,42,38,'#25323f',2);box(-19,-33,38,36,'#a5b2b4',2);for(let x=-15;x<-7;x+=4)box(x,-28,2,26,'#61727c');box(-4,-28,19,23,'#c15148',1);box(-1,-25,13,8,'#edc588');text('S',5,-7,12,'#fff3c7','center');box(-10,2,20,5,'#2b3944');for(let i=0;i<6;i++)box(-8+i*3,3,1,3,'#cbb079');
      }else if(p.kind==='heart'){
        c.fillStyle='#ff665f';c.beginPath();c.moveTo(0,4);c.bezierCurveTo(-35,-17,-13,-39,0,-22);c.bezierCurveTo(13,-39,35,-17,0,4);c.fill();line([[-9,-22],[-13,-19]],'#ffdbaf',4);text('+1 MAX',0,23,10,'#ffe6b5','center');
      }else weapon(p.weapon||'pipe',0,9,.95,.72);c.restore();
    }
    function steam(time){for(let i=0;i<12;i++){const rise=(time*75+i*13)%150,alpha=(1-rise/150)*.2,x=Math.sin(i*2+time)* (8+rise*.12),r=12+rise*.19;c.save();c.globalAlpha=alpha;ellipse(x,-rise,r,r*.7,'#e1f1e9');ellipse(x-r*.45,-rise+4,r*.7,r*.5,'#f3f4df');c.restore();}}
    function projectile(b,t){c.save();c.translate(b.x,b.y-(b.z||34));if(b.kind==='shuriken'){c.rotate(t*18);for(let i=0;i<4;i++){c.rotate(Math.PI/2);line([[0,0],[12,0],[4,5]],'#d0e1e3',3);}ellipse(0,0,3,3,'#526576');}else if(b.kind==='bomb'){ellipse(0,0,9,9,'#334450','#bea373');line([[3,-8],[6,-14]],'#efa554',2);}else if(b.kind==='venom'){ellipse(0,0,10,6,'#a2dd62','#527f45');}else if(b.kind==='bullet'){line([[-10,0],[8,0]],'#f5d594',4);}else{ellipse(0,0,9,6,b.kind==='arc'?'#8ce8ff':'#dda3ff','#eefcdb');}c.restore();}
    function trap(t,s,time){
      c.save();c.translate(t.x,t.y);const color=t.disabled?'#8ec6a4':t.warning?'#ffd08b':t.active?'#ff795a':'#718c91',u=Math.max(0,Math.min(1,((t.clock||0)-3.3)/1.2)),area=G.content.trapArea(t),dx=area.x-t.x;
      const pipe=points=>{line(points,'#233843',14);line(points,'#889ea1',9);line(points.map(([x,y])=>[x-2,y-2]),'#cfccb0',2);};
      const grate=()=>{ellipse(0,0,38,17,'#182c35','#869c96');for(let x=-25;x<=25;x+=10)line([[x,-9],[x,9]],'#829596',4);};
      const gauge=(x,y)=>{ellipse(x,y,11,11,'#d6d7b5','#314650');line([[x,y],[x+Math.sin((t.clock||0))*7,y-6]],'#a8573e',2);};
      const posts=(wood=false)=>{const dark=wood?'#593e3b':'#29434f',light=wood?'#aa8064':'#79999b';for(const x of [-62,58]){box(x,-151,12,157,dark);box(x+2,-149,4,149,light);box(x-6,-5,25,9,light);for(const y of [-136,-18])ellipse(x+7,y,2,2,'#d1c69d');}box(-68,-155,140,16,dark);line([[-64,-151],[67,-151]],light,3);};
      if(['steam','boiler'].includes(t.kind)){
        if(t.kind==='steam'){box(-100,-130,57,110,'#374d58');for(let y=-123;y<-25;y+=17)line([[-97,y],[-46,y]],'#72808244',2);pipe([[-79,-126],[-79,-42],[0,-42],[0,-5]]);gauge(-79,-90);}
        else{ellipse(-69,-64,39,38,'#314953','#9bada5');box(-106,-91,76,42,'#49626b',9);for(const x of [-95,-47])line([[x,-93],[x,-48]],'#a8b5a2',5);gauge(-72,-73);pipe([[-32,-60],[0,-60],[0,-5]]);box(-105,-28,77,14,'#243640');}
        grate();if(t.active)steam(time);
      }else if(t.kind==='puddle'){
        box(-102,-98,44,73,'#2a424f',4);box(-99,-95,38,63,'#658185',3);line([[-92,-82],[-67,-82]],'#d6c28c',3);line([[-90,-61],[-82,-73],[-83,-55],[-72,-65]],'#e9c269',3);pipe([[-80,-27],[-62,-3],[-20,0]]);ellipse(0,0,73,25,'#37647777','#789c9b');if(t.active)for(let n=0;n<4;n++)line([[-62+n*31,0],[-48+n*31,-10],[ -42+n*31,8],[-32+n*31,-3]],'#c2f8ee',3);
      }else if(t.kind==='cannon'){
        box(-131,-14,64,10,'#654d39');for(const x of [-116,-79]){ellipse(x,-5,13,13,'#20313b','#b1b49f');ellipse(x,-5,4,4,'#9ba5a1');}line([[-118,-32],[-76,-36]],'#233a45',25);line([[-118,-37],[-75,-41]],'#849b9c',7);ellipse(-73,-35,7,12,'#101f2a','#a1aea1');for(const x of [-132,-67])box(x,-1,6,5,'#a9a687');if(t.warning)ellipse(-116,-51,3,4,'#ffd794');if(t.active){shadow(dx,0,9);ellipse(dx,-18,11,11,'#263c46','#b7b4a0');}
      }else if(t.kind==='cargo'){
        box(-103,-161,17,162,'#5f4938');box(-102,-158,7,158,'#b18b58');line([[-96,-150],[43,-150]],'#806543',15);line([[-96,-90],[-42,-151]],'#c19967',7);ellipse(32,-146,9,9,'#d3b481','#4e4840');const nx=t.disabled?0:Math.sin(u*Math.PI*2)*40,ny=t.disabled?-4-30*(t.released||0):-34;line([[32,-140],[nx,ny-38]],'#cdb28a',3);box(nx-25,ny-30,50,30,'#806044');for(let x=-24;x<28;x+=12)line([[nx+x,ny-32],[nx+x*.3,ny+8]],'#d0b484',2);line([[nx-30,ny-30],[nx,ny+12],[nx+30,ny-30]],'#ddc29a',3);if(t.released>0)ellipse(0,0,55,22,null,'#dec78b');
      }else if(t.kind==='rockfall'){
        c.fillStyle='#586651';c.beginPath();c.moveTo(-112,0);c.lineTo(-110,-139);c.lineTo(-57,-158);c.lineTo(-32,-115);c.lineTo(-5,-99);c.lineTo(-28,-37);c.lineTo(-7,0);c.fill();line([[-105,-135],[-61,-149],[-47,-117],[-24,-104]],'#9eab88',4);line([[-59,-128],[-70,-94],[-46,-70],[-54,-31]],'#2c4238',5);for(let i=0;i<4;i++){const fall=t.active?Math.max(0,u*170-i*14):t.warning?(time*50+i*23)%80:0,x=-20+i*14,y=-139+fall;if(t.active){c.fillStyle=i%2?'#92a085':'#b0b69a';c.beginPath();c.moveTo(x-8,y-5);c.lineTo(x+3,y-9);c.lineTo(x+11,y);c.lineTo(x+5,y+9);c.lineTo(x-9,y+6);c.closePath();c.fill();line([[x-6,y-4],[x+2,y-7],[x+6,y-2]],'#d2d1af',2);}else if(t.warning)box(x,y,4,3,'#c0b994');}ellipse(0,0,45,18,'#24352955');
      }else if(t.kind==='geyser'){
        ellipse(0,0,45,22,'#78937b','#b5b391');ellipse(0,-2,32,15,'#37695e');for(let i=0;i<7;i++)ellipse(Math.cos(i)*38,Math.sin(i)*16,8,6,i%2?'#819681':'#b2b299');if(t.plugged){box(-28,-15,56,21,'#7f9185',7);line([[-23,-12],[17,-14],[25,-5]],'#d2d5b4',3);}else if(t.active)steam(time);else if(t.warning)for(let i=0;i<4;i++)ellipse(-18+i*11,-6-Math.sin(time*8+i)*3,4,3,null,'#bfe1b3');
      }else if(t.kind==='darts'){
        box(-110,-72,37,72,'#657478',3);box(-106,-69,29,36,'#89978b',7);for(const x of [-102,-85])box(x,-57,6,4,'#203a40');box(-101,-42,22,6,'#172c36');ellipse(-90,-15,26,10,'#46575a');box(-52,-7,104,15,'#536977');for(let i=-50;i<55;i+=26)box(i,-6,23,12,t.warning?'#c2a675':'#8b9693');if(t.active){line([[dx-18,-20],[dx+13,-20]],'#cebea0',3);line([[dx+7,-25],[dx+14,-20],[dx+7,-15]],'#dce8db',2);}
      }else if(['gate','press'].includes(t.kind)){
        posts(t.kind==='gate');const y=t.active?-32:t.warning?-110+((t.clock-2.3)*45):-116;
        if(t.kind==='gate'){for(let x=-44;x<50;x+=18)line([[x,y-4],[x,y+30]],'#a0aaa4',5);line([[-48,y], [48,y]],'#c1ba9b',5);line([[-48,y+19],[48,y+19]],'#747f7f',5);line([[-53,-145],[-74,-124],[-134,48]],'#bea978',3);}
        else{for(const x of [-26,26])pipe([[x,-142],[x,y]]);box(-45,y,90,27,'#809b97',3);for(let x=-40;x<40;x+=22)line([[x,y+2],[x+17,y+23]],'#d5b869',6);pipe([[-61,0],[-90,10],[-130,48]]);}
      }else if(t.kind==='cart'){
        for(const x of [-100,-70,-40,-10,20,50,80])box(x,-12,10,24,'#74553e');for(const y of [-12,12])line([[-109,y],[106,y]],'#aab2a5',4);
        const x=t.active?dx:t.disabled?0:-88;box(x-23,-36,46,28,'#7d6350',3);line([[x-24,-34],[x+24,-34]],'#bea582',4);for(let i=0;i<5;i++)ellipse(x-16+i*8,-35,7,5,'#25323a');for(const off of [-15,15])ellipse(x+off,-5,9,9,'#233640','#9faea1');
      }else if(t.kind==='arc'){
        pipe([[-82,0],[-82,16],[82,16],[82,0]]);for(const x of [-82,82]){box(x-12,-68,24,68,'#456571',4);box(x-18,-5,36,10,'#849c98');ellipse(x,-68,19,13,t.active?'#c6ffe7':'#76b5ad','#d0d4b4');for(let y=-50;y<-10;y+=12)box(x-8,y,16,5,t.warning?'#e0bf73':'#233f4b');}if(t.active){const pts=[];for(let x=-70;x<=70;x+=14)pts.push([x,-20+Math.sin(x+time*40)*9]);line(pts,'#baffdf',5);}
      }
      if(t.warning){ellipse(0,0,['cannon','cart','darts','cargo'].includes(t.kind)?96:area.rx,28,'#ffad531c','#efb572');text('!',0,-58,18,'#ffe5a3','center');}
      if(t.disabled){ellipse(0,4,4,4,'#9fdeb2');}c.restore();
    }
    function effect(f){
      const a=Math.max(0,f.life/f.max),progress=1-a;c.save();c.globalAlpha=Math.min(1,a*2);c.translate(f.x,f.y);
      if(f.kind==='word')text(f.text,0,-progress*25,16,f.color||'#ffda91','center');
      else if(f.kind==='explosion'){const r=(f.radius||80)*Math.sin(Math.min(1,progress)*Math.PI*.75);for(let i=0;i<8;i++){const angle=i*TAU/8,rx=Math.cos(angle)*r*.6,ry=Math.sin(angle)*r*.5;ellipse(rx,ry,r*.48,r*.43,progress>.65?'#656876':'#eb673a');ellipse(rx,ry,r*.34,r*.29,'#ffb85f');}ellipse(0,0,r*.5,r*.46,'#fff5d7');ellipse(0,0,r*1.3,r*.8,null,'#ffeac6');}
      else if(['special','slam','burst','ring'].includes(f.kind)){for(let i=0;i<3;i++){c.strokeStyle=f.color||'#ffd494';c.lineWidth=4-i;c.beginPath();c.ellipse(0,0,Math.max(1,progress*(f.kind==='special'?235:165)-i*22),Math.max(1,progress*72-i*8),0,0,TAU);c.stroke();}}
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
      else if(h.kind==='steam'){steam(t);box(-21,-5,42,7,'#9bafa4');}
      else if(h.kind==='shadow'){line([[-h.rx,-55],[h.rx,8]],'#c8a1ff',9);line([[-h.rx,8],[h.rx,-55]],'#ffe9ff',5);}
      else if(h.kind==='quake'){line([[-22,0],[-15,-18],[-4,-8],[4,-34],[15,-11],[24,0]],'#ffe2a1',6);}
      else if(h.kind==='time'){ellipse(0,0,h.rx-8,Math.max(2,h.ry-4),null,'#eefcff');}
      c.restore();
    }
    function hud(s){
      for(const p of s.players){const x=p.id?650:26;colorBars(p,x);}
      function colorBars(p,x){
        const color=p.id?'#77e5e8':'#ff6a55',stamina=p.stamina??100,tired=stamina<18,staminaColor=tired?'#ffa276':'#b9e788';
        box(x-10,12,294,97,'#08151bdf',7);text((p.id?'2P / ECHO':'1P / SLOP')+'   ×'+p.lives,x,33,13,color);
        box(x,43,264,12,'#343a40',3);box(x,43,264*p.hp/(p.maxHp||100),12,color,3);for(let n=1;n<20;n++)box(x+n*13.2,43,2,12,'#08151b');text(Math.ceil(p.hp)+' / '+(p.maxHp||100)+' HP',x+264,33,11,'#fff0ce','right');
        text(tired?'STAMINA / LOW':'STAMINA',x,71,9,staminaColor);box(x+99,63,133,8,'#343a40',2);box(x+99,63,133*stamina/100,8,staminaColor,2);text(Math.floor(stamina),x+264,71,10,staminaColor,'right');
        text(p.energy>=100?'SPECIAL READY':'SPECIAL',x,94,9,p.energy>=100?'#ffe79b':'#adbdb4');box(x+99,86,133,6,'#343a40',2);box(x+99,86,133*p.energy/100,6,p.energy>=100?'#ffe79b':'#80cab8',2);text(Math.floor(p.energy)+'%',x+264,94,9,'#adbdb4','right');
      }
      text(String(s.score).padStart(7,'0'),480,37,21,'#ffe4b1','center');text('ERA '+(s.stage+1)+' / 06',480,58,11,'#b1cac4','center');
      if(s.combo>1){text(s.combo+' HITS',s.players.length===2?480:907,105,25,'#ffe0a1',s.players.length===2?'center':'right');}
      const era=G.stages[s.stage],boss=s.enemies.find(e=>e.boss&&e.hp>0);
      const landmark=Math.min(6,Math.floor((s.camera+310)/era.width*7));
      text(era.landmarks[landmark].toUpperCase(),480,76,10,'#bed9cd','center');
      box(372,84,216,3,'#1d383b');box(372,84,216*Math.min(1,(s.camera+960)/era.width),3,era.color);
      if(boss){const rage=boss.hp/boss.maxHp<=G.BOSS_RAGE;box(253,487,454,39,'#071620ee',5);text(era.boss.toUpperCase()+(rage?' / ENRAGED':''),480,502,12,rage?'#ff6655':'#f6c8ab','center');box(266,510,428,7,'#323d44',2);box(266,510,428*boss.hp/boss.maxHp,7,rage?'#ff3f40':'#ef8267',2);
        if(boss.attack?.kind==='super'||s.hazards.length){box(235,116,490,52,'#10151eee',3);text(era.superName,480,137,17,era.color,'center');text(era.superHint,480,155,10,'#ffe1b3','center');}
      }
      else if(s.arena){text(s.waveDelay>0?'REINFORCEMENTS APPROACHING':'CLEAR THE STREET / WAVE '+(s.wave+1),480,521,11,'#d0ba9a','center');}
      else{text(s.players[0]&&G.content.nextTurn(era,s.players[0])?'GO ↘':'GO →',900,310,20,'#ffdc9f','right');text('ENCOUNTER '+Math.min(era.encounters.length,s.gate+1)+' / '+era.encounters.length,480,521,10,'#b2cbc1','center');}

    }
    function draw(s,time){
      c=pixels;c.setTransform(.5,0,0,.5,0,0);c.imageSmoothingEnabled=false;c.clearRect(0,0,960,540);c.save();if(s.shake>0)c.translate(Math.round(Math.sin(time*83)*s.shake),Math.round(Math.cos(time*77)*s.shake*.45));backdrop(s,time);
      if(s.status==='ready'){player({x:741,y:459,z:0,face:1,lives:3,id:0,invincible:0,action:null,dead:0},time,true);}
      else{c.save();c.translate(-Math.round(s.camera),-Math.round(s.cameraY||0));s.hazards.forEach(h=>hazard(h,time));const visible=p=>p.x>s.camera-180&&p.x<s.camera+1140;(s.traps||[]).filter(visible).forEach(t=>trap(t,s,time));const objects=[...s.props.filter(visible).map(p=>({y:p.y,draw:()=>prop(p,s)})),...s.pickups.filter(visible).map(p=>({y:p.y,draw:()=>pickup(p,time)})),...s.enemies.map(e=>({y:e.y,draw:()=>enemy(e,s,time)})),...s.players.map(p=>({y:p.y,draw:()=>player(p,time)}))];objects.sort((a,b)=>a.y-b.y);objects.forEach(o=>o.draw());for(const b of s.shots){shadow(b.x,b.y,9);projectile(b,time);}for(const m of s.missiles||[]){shadow(m.x,m.y,18);c.save();c.translate(m.x,m.y-m.z);if(['scooter','log','powder','battery','slab'].includes(m.kind)){if(['log','powder'].includes(m.kind))c.rotate(time*9);sceneryItem(m.kind);}else if(m.kind==='barrel'){ellipse(0,0,23,23,'#a9774d','#3c3331');ellipse(0,0,17,17,null,'#d0ac73');line([[-18,0],[18,0]],'#485962',5);}else{ellipse(0,0,24,9,'#82979f','#d0decd');line([[-17,0],[17,0]],'#2e4552',3);}c.restore();}s.effects.forEach(effect);c.restore();}
      c.restore();if(s.flash>0){c.fillStyle=`rgba(255,245,207,${Math.min(.55,s.flash*2)})`;c.fillRect(0,0,960,540);}
      const vignette=c.createRadialGradient(480,290,250,480,290,610);vignette.addColorStop(0,'#0000');vignette.addColorStop(1,'#02080d66');c.fillStyle=vignette;c.fillRect(0,0,960,540);
      output.imageSmoothingEnabled=false;output.clearRect(0,0,960,540);output.drawImage(world,0,0,960,540);c=output;if(s.status!=='ready')hud(s);if(s.ending?.fade>0){output.fillStyle='rgba(0,0,0,'+s.ending.fade+')';output.fillRect(0,0,960,540);}c=pixels;
    }
    return {draw,get sideReady(){return !!sideSprites;},get ready(){return !!sideSprites&&!!mascot&&!!enemySprites&&!!combat&&!!flyers&&!!bossSprites&&panoramas.filter(Boolean).length===6;},get mascotReady(){return !!mascot;},get enemiesReady(){return !!enemySprites;},get backgroundReady(){return panoramas.filter(Boolean).length===6;},inspect(){return {world:[world.width,world.height],panoramas:panoramas.map(p=>[p.width,p.height]),redPalette:!!redBossSprites,combat:!!combat,flyers:!!flyers,bosses:bossFrames.length};}};
  }
  G.createRenderer=createRenderer;
})(window);
