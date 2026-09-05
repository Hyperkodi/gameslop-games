/* Illustrated scenery, atmosphere and cached terrain. Presentation only. */
(function (root) {
  'use strict';
  const G = root.SlopCommando = root.SlopCommando || {};
  const clamp = (x,a,b) => Math.max(a,Math.min(b,x));
  function sceneryLayout(state, basePosition = 0, count = 7) {
    if(state.level.mode==='base')return {vertical:false,position:0,travel:0,step:0,overlap:0,visible:[{index:state.room||0,x:0,y:0}]};
    const vertical=state.level.mode==='climb';
    const viewport=vertical?540:960;
    const extent=vertical?state.level.height:state.level.width;
    const travel=Math.max(0,extent-viewport),step=travel/(count-1);
    const position=clamp(vertical?state.camera.y:state.camera.x,0,travel);
    const visible=[];
    for(let index=0;index<count;index++) {
      const offset=(vertical?travel-index*step:index*step)-position;
      if(offset<viewport&&offset+viewport>0)visible.push({index,x:vertical?0:offset,y:vertical?offset:0});
    }
    return {vertical,step,position,travel,overlap:viewport-step,visible};
  }
  function createEnvironmentRenderer(c, skin, themes) {
    const config = skin.environment;
    const atlases=new Map(),frames=new Map(),tiles=new Map();
    let currentStage=-1,lastLayout=null;
    function loadStage(stage) {
      if(G.levels?.[stage]?.mode==='base')return Promise.resolve(true);
      if(!config.stages[stage])return Promise.resolve(false);
      if(atlases.has(stage))return atlases.get(stage).ready;
      const entry={image:new Image(),loaded:false};
      entry.ready=new Promise(resolve=>{
        entry.image.onload=()=>{entry.loaded=true;resolve(true);};
        entry.image.onerror=()=>resolve(false);
      });
      atlases.set(stage,entry);
      const source=config.stages[stage];
      entry.image.src='skin/'+skin.name+'/'+(source.atlas||source);
      return entry.ready;
    }
    const ready=loadStage(0);
    const noise = n => { const v=Math.sin(n*127.1+311.7)*43758.5453; return v-Math.floor(v); };
    function rect(ctx,x,y,w,h,color) { ctx.fillStyle=color;ctx.fillRect(x,y,w,h); }
    function shape(ctx,points,color,edge) {
      ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fillStyle=color;ctx.fill();
      if(edge){ctx.strokeStyle=edge;ctx.lineWidth=1;ctx.stroke();}
    }
    function frame(index,layout) {
      if(frames.has(index))return frames.get(index);
      const image=atlases.get(currentStage).image;
      const tile=document.createElement('canvas');tile.width=960;tile.height=540;
      const ctx=tile.getContext('2d');ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
      const sw=image.naturalWidth/config.columns,sh=image.naturalHeight/config.rows;
      const source=config.stages[currentStage];
      const crop=source.frames?.[index]||[(index%config.columns)*sw,Math.floor(index/config.columns)*sh,sw,sh];
      let [sx,sy,cw,ch]=crop;
      // Preserve proportions when generated sections have a panoramic aspect ratio.
      if(cw/ch>16/9){const width=ch*16/9;sx+=(cw-width)*(source.anchors?.[index]??.5);cw=width;}
      else {const height=cw*9/16;sy+=(ch-height)/2;ch=height;}
      // Inset crops avoid neighboring atlas rows bleeding into the image.
      ctx.drawImage(image,sx+3,sy+3,cw-6,ch-6,0,0,960,540);
      if(index>0) {
        const feather=Math.min(96,layout.overlap);
        const mask=layout.vertical?ctx.createLinearGradient(0,540-feather,0,540):ctx.createLinearGradient(0,0,feather,0);
        mask.addColorStop(0,layout.vertical?'#fff':'#fff0');
        mask.addColorStop(1,layout.vertical?'#fff0':'#fff');
        ctx.globalCompositeOperation='destination-in';ctx.fillStyle=mask;ctx.fillRect(0,0,960,540);
      }
      frames.set(index,tile);return tile;
    }
    function draw(state,time) {
      if(currentStage!==state.stage) {
        currentStage=state.stage;frames.clear();
        for(const key of atlases.keys())if(key!==currentStage&&key!==currentStage+1)atlases.delete(key);
        loadStage(currentStage);loadStage(currentStage+1);
      }
      if(state.level.mode==='base') {
        // Free up/down movement takes place on a visible overhead floor. Core
        // damage never pans the room; a new chamber shares its floor coordinates.
        lastLayout=sceneryLayout(state);
        drawOverheadRoom(state,time);return true;
      }
      if(!atlases.get(currentStage)?.loaded)return false;
      const level=state.level;
      const count=config.stages[currentStage].frames?.length||config.sections;
      const layout=sceneryLayout(state,0,count);lastLayout=layout;
      c.save();c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';
      c.fillStyle=themes[level.theme].sky;c.fillRect(0,0,960,540);
      // Cache only intersecting sections: up to three sideways or five vertically.
      for(const section of layout.visible)c.drawImage(frame(section.index,layout),section.x,section.y);
      for(const key of frames.keys())if(!layout.visible.some(s=>s.index===key))frames.delete(key);
      // A restrained wash behind the action separates bright sprites from scenery.
      const shade=c.createLinearGradient(0,0,0,540);
      shade.addColorStop(0,'#06111a22');shade.addColorStop(.55,'#06111a0a');shade.addColorStop(1,'#06111a44');
      c.fillStyle=shade;c.fillRect(0,0,960,540);
      // The spillway is travelled upward, so give it a receding channel and retaining
      // walls instead of the flat, side-on read used by the horizontal stages. The
      // painted atlas still provides the setting; these quiet depth cues make the
      // route feel like it leads forward and up through it.
      if(level.mode==='climb'&&level.theme==='water')spillwayDepth(state,time);
      atmosphere(state,time);
      c.restore();return true;
    }
    function drawOverheadRoom(state,time) {
      const hot=state.level.theme==='foundry',room=state.room;
      const glow=hot?'#ffa75a':'#68e2e3',dark=hot?'#292324':'#14252d';
      c.save();
      rect(c,0,0,960,540,'#070f14');
      const floor=c.createLinearGradient(0,80,0,540);
      floor.addColorStop(0,hot?'#4b3a32':'#304a54');floor.addColorStop(1,dark);
      shape(c,[[96,84],[864,84],[930,540],[30,540]],floor);
      // A continuous tiled floor exposes both dimensions of the movement plane.
      c.save();c.beginPath();c.moveTo(96,84);c.lineTo(864,84);c.lineTo(930,540);c.lineTo(30,540);c.closePath();c.clip();
      for(let row=0;row<9;row++){
        const y=86+row*55;
        for(let col=0;col<12;col++){
          const x=15+col*80+(row%2)*40;
          rect(c,x,y,77,52,(row+col)%3===0?'#71858115':'#08151a24');
          rect(c,x,y,77,1,'#bad5cb20');rect(c,x+76,y,1,52,'#00000038');
          if((col+row+room)%7===0){rect(c,x+12,y+14,16,2,'#07131844');rect(c,x+12,y+18,8,1,'#adc0b91c');}
        }
      }
      // Central recessed conduit and walkways remain aligned in all three rooms.
      rect(c,452,190,56,350,'#030c1255');
      for(let y=195;y<540;y+=13)rect(c,458,y,44,3,hot?'#dd985344':'#73afad44');
      for(const x of [116,836]){rect(c,x,196,4,320,glow+'44');for(let y=206;y<530;y+=35)rect(c,x-4,y,12,3,glow);}
      c.restore();
      // Low perimeter walls: top faces and small near-facing lips, no wall-sized
      // background behind the player. Machinery is outside the walkable floor.
      shape(c,[[64,65],[106,82],[42,540],[0,540]],'#233b40');
      shape(c,[[854,82],[896,65],[960,540],[918,540]],'#233b40');
      c.strokeStyle='#87a19d';c.lineWidth=2;c.beginPath();c.moveTo(106,82);c.lineTo(42,540);c.moveTo(854,82);c.lineTo(918,540);c.stroke();
      rect(c,70,50,820,35,hot?'#766050':'#546d73');rect(c,70,85,820,13,'#101c24');
      for(const x of [195,445,695]){
        rect(c,x,113,98,77,'#020a1066');rect(c,x-5,105,98,67,dark);
        rect(c,x,108,88,3,'#91a79c');rect(c,x+7,119,72,37,'#060f16');
        for(let j=0;j<6;j++)rect(c,x+11+j*11,123,5,29,glow+'33');
        rect(c,x+2,169,86,5,glow+'55');
      }
      for(const side of [0,1])for(let n=0;n<3;n++){
        const x=side?861+n*7:57-n*7,y=222+n*105;
        rect(c,x+3,y+8,37,62,'#00000055');
        c.fillStyle=hot?'#69503d':'#42616b';c.beginPath();c.roundRect(x,y,34,55,6);c.fill();
        if(hot){c.fillStyle='#171b20';c.beginPath();c.ellipse(x+17,y+25,12,20,0,0,Math.PI*2);c.fill();c.strokeStyle=glow;c.lineWidth=3;c.stroke();}
        else {rect(c,x+6,y+9,22,13,'#0b252f');rect(c,x+8,y+12,17,2,glow);for(let k=0;k<4;k++)rect(c,x+6,y+30+k*4,22,1,'#172d37');}
      }
      // Chamber identity comes from overhead engineering details and illumination,
      // not sliding landscape images. Nothing drifts as individual cores fall.
      for(let i=0;i<=room;i++){
        const x=300+i*120;
        c.strokeStyle=glow+'38';c.lineWidth=3;c.beginPath();c.arc(x,240,22,0,Math.PI*2);c.stroke();
        for(let a=0;a<4;a++){c.save();c.translate(x,240);c.rotate(time*(hot?.3:.1)+a*Math.PI/2);shape(c,[[2,2],[17,4],[10,13]],'#78969144');c.restore();}
      }
      rect(c,386,60,188,29,'#06131b');c.textAlign='center';c.font='bold 11px monospace';c.fillStyle=glow;
      c.fillText((hot?'REACTOR':'SECURITY')+'  /  0'+(room+1),480,79);
      c.font='10px monospace';c.fillStyle='#b2c4bd88';c.fillText('↑  BREACH THE CORES  ↑',480,510);
      c.restore();
    }
    function spillwayDepth(state,time) {
      const progress=clamp(1-state.camera.y/Math.max(1,state.level.height-540),0,1);
      const horizon=106-progress*18,vanishX=480+Math.sin(time*.18)*7,nearY=558;
      c.save();
      // A low-opacity channel gives every background section the same 45-degree
      // orientation without obscuring its landmarks.
      shape(c,[[126,nearY],[834,nearY],[608,horizon],[352,horizon]],'#6fb8b526');
      shape(c,[[68,nearY],[126,nearY],[352,horizon],[323,horizon]],'#173a4a48');
      shape(c,[[834,nearY],[892,nearY],[637,horizon],[608,horizon]],'#173a4a48');
      c.strokeStyle='#bde4dc42';c.lineWidth=2;
      c.beginPath();c.moveTo(126,nearY);c.lineTo(352,horizon);c.moveTo(834,nearY);c.lineTo(608,horizon);c.stroke();
      // Cross-ripples widen toward the viewer. Their motion is tied to the climb so
      // the scene continues to read as a route, even while the player is stationary.
      const drift=(state.camera.y*.09+time*18)%72;
      for(let i=0;i<8;i++) {
        const ratio=clamp((i*72+drift)/570,0,1),curve=ratio*ratio;
        const y=horizon+(nearY-horizon)*curve;
        const half=112+242*curve;
        c.globalAlpha=.12+.15*curve;c.strokeStyle='#d3f1e7';c.lineWidth=1+curve;
        c.beginPath();c.moveTo(vanishX-half,y);c.quadraticCurveTo(vanishX,y+3+curve*4,vanishX+half,y);c.stroke();
      }
      // Staggered lamp points help the side walls converge toward the upper frame.
      for(let i=0;i<5;i++) {
        const ratio=.18+i*.17,y=horizon+(nearY-horizon)*ratio*ratio,half=112+242*ratio*ratio;
        c.globalAlpha=.28;c.fillStyle='#9ee6d8';c.fillRect(vanishX-half-3,y-2,5,5);c.fillRect(vanishX+half-2,y-2,5,5);
      }
      c.restore();
    }
    function atmosphere(state,time) {
      const theme=state.level.theme,view=state.camera;
      c.save();
      const count=theme==='snow'?42:theme==='water'?28:18;
      for(let i=0;i<count;i++) {
        const n=noise(i+state.stage*53),m=noise(i*5+17);
        let x=((n*1100-time*(theme==='snow'?18:4)-view.x*.16)%1100+1100)%1100-70;
        let y=((m*650+time*(theme==='water'?56:theme==='snow'?23:-8)-view.y*.08)%650+650)%650-60;
        c.globalAlpha=.12+noise(i*7)*.28;
        if(theme==='snow') {
          c.fillStyle='#e9f4f3';c.beginPath();c.arc(x,y,.7+n*1.2,0,Math.PI*2);c.fill();
        }else if(theme==='water')rect(c,x,y,1,4+n*5,'#b9e9e7');
        else if(theme==='foundry')rect(c,x,y,1.2,2.5,'#f0b26f');
        else rect(c,x,y,1.4,1.4,theme==='jungle'?'#b8dbaa':theme==='alien'?'#c999bd':'#83b6cf');
      }
      // Soft mist moves independently of the painted scenery.
      if(['jungle','water','snow','cave'].includes(theme)) {
        for(let i=0;i<2;i++) {
          const x=160+i*510+Math.sin(time*.09+i)*70,y=375+i*45;
          const fog=c.createRadialGradient(x,y,10,x,y,250);
          fog.addColorStop(0,theme==='cave'?'#aab7d91a':'#c2dfd91a');fog.addColorStop(1,'#b7d5d000');
          c.globalAlpha=.7;c.fillStyle=fog;c.save();c.translate(0,y);c.scale(1,.2);c.translate(0,-y);c.fillRect(x-250,y-250,500,500);c.restore();
        }
      }
      c.restore();
    }
    function terrainTile(theme,variant) {
      const key=theme+variant;if(tiles.has(key))return tiles.get(key);
      const t=themes[theme],tile=document.createElement('canvas');tile.width=96;tile.height=86;
      const g=tile.getContext('2d'),metal=theme==='base'||theme==='foundry';
      const grad=g.createLinearGradient(0,0,0,86);grad.addColorStop(0,t.soil);grad.addColorStop(1,t.sky);g.fillStyle=grad;g.fillRect(0,0,96,86);
      if(metal) {
        for(let x=0;x<96;x+=48){rect(g,x+3,10,42,70,'#111f26');rect(g,x+5,12,38,66,t.soil);rect(g,x+5,12,38,2,t.leaf);rect(g,x+8,24,32,3,t.far);rect(g,x+8,58,32,2,t.far);
          for(const y of [17,71])for(const bx of [x+9,x+39]){rect(g,bx,y,2,2,t.light);rect(g,bx+1,y+1,2,2,t.far);}
          for(let j=0;j<5;j++)rect(g,x+11+j*5,35,2,15,t.far);
        }
      } else {
        for(let i=0;i<13;i++) {
          const r=noise(i*13+variant*31),x=noise(i*7+variant)*108-12,y=12+noise(i*11+variant)*70,w=18+r*28,h=12+noise(i+31)*23;
          const pts=[[x,y+3],[x+w*.35,y],[x+w,y+4],[x+w-3,y+h*.7],[x+w*.6,y+h],[x+3,y+h-2]];
          shape(g,pts,[t.soil,t.mid,t.far][i%3],'#09151c66');
          g.beginPath();g.moveTo(x+3,y+4);g.lineTo(x+w*.35,y+1);g.lineTo(x+w-2,y+5);g.strokeStyle=t.leaf;g.globalAlpha=.35;g.stroke();g.globalAlpha=1;
        }
        if(theme==='alien') {
          g.strokeStyle='#be628559';g.lineWidth=2;g.beginPath();g.moveTo(0,25);g.bezierCurveTo(30,5,40,72,96,59);g.stroke();
        }
      }
      for(let i=0;i<140;i++){const x=noise(i*3+variant*47)*96,y=noise(i*9+variant*53)*86;rect(g,x,y,noise(i)> .7?2:1,1,i%2?'#e1ded510':'#00000020');}
      tiles.set(key,tile);return tile;
    }
    function platform(p,theme,view) {
      const t=themes[theme],metal=theme==='base'||theme==='foundry';
      if(theme==='water'){
        spillwayPlatform(p,t,view);return;
      }
      c.save();c.beginPath();c.rect(p.x,p.y,p.w,p.h);c.clip();
      const left=Math.max(p.x,view.x-96),right=Math.min(p.x+p.w,view.x+1056);
      for(let x=p.x+Math.floor((left-p.x)/96)*96;x<right;x+=96){
        const variant=Math.abs(Math.floor(x/96))%3;
        c.drawImage(terrainTile(theme,variant),x,p.y,96,p.ground?p.h:Math.max(34,p.h));
      }
      rect(c,p.x,p.y,p.w,2,t.edge);rect(c,p.x,p.y+2,p.w,4,metal?t.leaf:theme==='snow'?'#e0eceb':t.leaf);
      if(metal) {
        c.globalAlpha=.65;for(let x=Math.floor(left/24)*24;x<right;x+=24)shape(c,[[x,p.y+2],[x+9,p.y+2],[x+15,p.y+7],[x+6,p.y+7]],t.light);c.globalAlpha=1;
      }
      rect(c,p.x,p.y+p.h-3,p.w,3,'#07151e88');c.restore();
      if(!metal) {
        for(let x=Math.ceil(left/31)*31;x<right;x+=31) {
          const n=noise(x+theme.length);
          if(theme==='snow')shape(c,[[x,p.y+4],[x+9,p.y+4],[x+5,p.y+12+n*6]],'#9bbfc4');
          else if(theme==='jungle'||theme==='water') {
            c.strokeStyle=n>.5?'#9aaa6d':'#547b51';c.lineWidth=1;
            c.beginPath();c.moveTo(x,p.y);c.quadraticCurveTo(x-2,p.y-6,x-6,p.y-7);c.moveTo(x,p.y);c.quadraticCurveTo(x+1,p.y-6,x+6,p.y-9);c.stroke();
          } else if(theme==='cave'&&n>.6)shape(c,[[x,p.y],[x+3,p.y-7],[x+6,p.y]],'#97a2b9');
        }
      }
      if(!p.ground){rect(c,p.x+4,p.y+p.h,p.w-8,3,'#06131c55');}
    }
    function spillwayPlatform(p,t,view) {
      const left=Math.max(p.x,view.x-96),right=Math.min(p.x+p.w,view.x+1056);
      const screenY=p.y-view.y,near=clamp((screenY+74)/630,.2,1);
      if(p.ground) {
        // The basin floor is a broad, shallow concrete apron with water channels,
        // establishing the same forward perspective before the first landing.
        const floor=c.createLinearGradient(0,p.y,0,p.y+p.h);floor.addColorStop(0,'#709fa1');floor.addColorStop(.08,'#b8ddd2');floor.addColorStop(1,'#274955');
        c.fillStyle=floor;c.fillRect(p.x,p.y,p.w,p.h);
        rect(c,p.x,p.y,p.w,3,'#d5efe4');rect(c,p.x,p.y+3,p.w,5,'#477a80');
        c.save();c.beginPath();c.rect(p.x,p.y,p.w,p.h);c.clip();
        for(let x=Math.floor(left/96)*96;x<right+96;x+=96){
          const mid=x+48;
          shape(c,[[mid-13,p.y+8],[mid+13,p.y+8],[mid+25,p.y+p.h],[mid-25,p.y+p.h]],'#83c2bd42');
          c.strokeStyle='#173b46';c.globalAlpha=.38;c.lineWidth=1;c.beginPath();c.moveTo(mid-13,p.y+8);c.lineTo(mid-25,p.y+p.h);c.moveTo(mid+13,p.y+8);c.lineTo(mid+25,p.y+p.h);c.stroke();
        }
        c.restore();rect(c,p.x,p.y+p.h-3,p.w,3,'#0a263055');return;
      }
      // Each floating collision platform becomes a shallow trapezoidal landing. The
      // far edge is narrower and slightly higher, making it read as a piece of a
      // spillway route viewed from above rather than a thin side-view shelf.
      const inset=Math.min(42,Math.max(11,p.w*(.08+(1-near)*.12)));
      const rearY=p.y-(5+(1-near)*5),frontY=p.y+1,depth=7+near*7;
      shape(c,[[p.x-3,frontY+2],[p.x+p.w+3,frontY+2],[p.x+p.w-inset,frontY+depth],[p.x+inset,frontY+depth]],'#102f3a8c');
      shape(c,[[p.x+inset,rearY],[p.x+p.w-inset,rearY],[p.x+p.w,frontY],[p.x,frontY]],'#7fb4af','#122f38');
      shape(c,[[p.x,frontY],[p.x+p.w,frontY],[p.x+p.w-inset,frontY+depth],[p.x+inset,frontY+depth]],'#426f73','#143640');
      c.strokeStyle='#d3eee2';c.globalAlpha=.82;c.lineWidth=1.4;c.beginPath();c.moveTo(p.x+inset,rearY+.5);c.lineTo(p.x+p.w-inset,rearY+.5);c.stroke();
      // Slats and two thin drainage channels converge with the landing perspective.
      const lanes=Math.max(2,Math.floor(p.w/54));
      for(let i=1;i<lanes;i++) {
        const farX=p.x+inset+(p.w-inset*2)*i/lanes,nearX=p.x+p.w*i/lanes;
        c.globalAlpha=.32;c.strokeStyle=i%2?'#244f59':'#d1ece1';c.lineWidth=1;c.beginPath();c.moveTo(farX,rearY+1);c.lineTo(nearX,frontY+depth-1);c.stroke();
      }
      c.globalAlpha=.55;c.fillStyle='#9eddd2';
      for(let i=1;i<4;i++){
        const x=p.x+p.w*i/4;c.fillRect(x-1,frontY+2,2,Math.max(2,depth-3));
      }
      c.globalAlpha=1;
      if(screenY>120){
        // Short rails at the close edge reinforce the direction of travel without
        // obstructing the player or changing the engine's collision surface.
        c.strokeStyle='#d6eee2a8';c.lineWidth=1;c.beginPath();
        c.moveTo(p.x+8,frontY);c.lineTo(p.x+inset,frontY-8);c.lineTo(p.x+inset+18,frontY-8);
        c.moveTo(p.x+p.w-8,frontY);c.lineTo(p.x+p.w-inset,frontY-8);c.lineTo(p.x+p.w-inset-18,frontY-8);c.stroke();
      }
      rect(c,p.x+inset,frontY+depth-2,p.w-inset*2,2,'#071c255f');
    }
    return {draw,platform,ready,loadStage,get loaded(){return G.levels?.[currentStage]?.mode==='base'||!!atlases.get(currentStage)?.loaded;},get layout(){return lastLayout;},get cacheSize(){return frames.size;}};
  }
  G.createEnvironmentRenderer=createEnvironmentRenderer;
  if(typeof module!=='undefined')module.exports={sceneryLayout};
})(typeof window!=='undefined'?window:globalThis);
