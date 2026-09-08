import {WIDTH,HEIGHT,THEMES,CAST,position,key} from './model.mjs';
import {CHOMP_ATLAS,chompFrame} from './chomp.mjs';
import {specialIs,canEat} from './powerups.mjs';
import {drawPickup,drawPlayerEffect,drawGhostEffect} from './powerup-render.mjs';
export class Renderer {
  constructor(canvas,images){this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});this.images=images;this.particles=[];this.labels=[];this.shake=0;this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;this.width=0;this.height=0;}
  resize(){const r=this.canvas.getBoundingClientRect(),dpr=Math.min(2,devicePixelRatio||1);this.width=r.width;this.height=r.height;if(this.canvas.width!==Math.round(r.width*dpr)||this.canvas.height!==Math.round(r.height*dpr)){this.canvas.width=Math.round(r.width*dpr);this.canvas.height=Math.round(r.height*dpr);}this.dpr=dpr;}
  events(state){for(const e of state.events){if(e.type==='ghost'){this.labels.push({x:e.x,y:e.y,text:'+'+e.points,life:60});for(let i=0;i<12;i++)this.particles.push({x:e.x,y:e.y,vx:Math.cos(i*Math.PI/6)*.05,vy:Math.sin(i*Math.PI/6)*.05,life:35});}if(e.type==='hit'&&!this.reduced)this.shake=12;}}
  draw(s,now=0){
    const c=this.ctx,w=this.width,h=this.height;if(!w||!h)return;
    const theme=THEMES[s.stage];
    c.setTransform(this.dpr,0,0,this.dpr,0,0);c.fillStyle=theme.floor;c.fillRect(0,0,w,h);
    // Closer follow camera makes portraits legible; the minimap retains the full route.
    // Short landscape viewports keep enough vertical space to see nearby junctions.
    const tile=Math.min(56,Math.max(h<320?44:48,Math.min(w/19,h/13)));
    const p=position(s.player),viewW=w/tile,viewH=h/tile;
    const cx=Math.max(viewW/2,Math.min(WIDTH-viewW/2,p.x+.5)),cy=Math.max(viewH/2,Math.min(HEIGHT-viewH/2,p.y+.5));
    const ox=WIDTH*tile<=w?(w-WIDTH*tile)/2:w/2-cx*tile,oy=HEIGHT*tile<=h?(h-HEIGHT*tile)/2:h/2-cy*tile;
    this.metrics={tile,ox,oy,w,h};
    c.save();c.translate(ox,oy);if(this.shake){c.translate(Math.sin(now*.07)*this.shake*.22,Math.cos(now*.09)*this.shake*.18);this.shake--;}
    // Slight floor grid supplies scale without competing with the faces.
    c.strokeStyle='#ffffff04';c.lineWidth=1;
    for(let x=0;x<=WIDTH;x++){c.beginPath();c.moveTo(x*tile,0);c.lineTo(x*tile,HEIGHT*tile);c.stroke();}
    for(let y=0;y<=HEIGHT;y++){c.beginPath();c.moveTo(0,y*tile);c.lineTo(WIDTH*tile,y*tile);c.stroke();}
    for(let y=0;y<HEIGHT;y++)for(let x=0;x<WIDTH;x++){
      const i=key(x,y),px=x*tile,py=y*tile;
      if(s.maze.tiles[i]){
        c.fillStyle=theme.wall+'75';c.fillRect(px,py,tile+.5,tile+.5);
        c.strokeStyle=theme.edge;c.lineWidth=1.5;
        const edges=[[x,y-1,px,py+3,px+tile,py+3],[x+1,y,px+tile-3,py,px+tile-3,py+tile],[x,y+1,px,py+tile-3,px+tile,py+tile-3],[x-1,y,px+3,py,px+3,py+tile]];
        for(const [nx,ny,x1,y1,x2,y2]of edges)if(nx>=0&&ny>=0&&nx<WIDTH&&ny<HEIGHT&&!s.maze.tiles[key(nx,ny)]){c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.stroke();}
        if(x%2===0&&y%2===0){c.fillStyle=theme.edge+'1c';c.fillRect(px+tile*.42,py+tile*.42,tile*.16,tile*.16);}
      }else if(s.maze.pellets[i]){
        const power=s.maze.pellets[i]===2;
        c.fillStyle=power?theme.accent:specialIs(s,'cheat-day')?'#ffdc55':'#e2d7a2';
        if(power){c.shadowColor=theme.accent;c.shadowBlur=18;c.beginPath();c.arc(px+tile/2,py+tile/2,tile*(.17+.018*Math.sin(now*.004)),0,Math.PI*2);c.fill();c.shadowBlur=0;c.strokeStyle=theme.accent+'60';c.lineWidth=1;c.beginPath();c.arc(px+tile/2,py+tile/2,tile*.27,0,Math.PI*2);c.stroke();}
        else {c.beginPath();c.arc(px+tile/2,py+tile/2,specialIs(s,'cheat-day')?4:2.2,0,Math.PI*2);c.fill();}
      }
    }
    for(let i=s.gatesOpened;i<s.maze.gates.length;i++){
      const k=s.maze.gates[i],x=k%WIDTH,y=Math.floor(k/WIDTH),warning=i===s.gatesOpened&&s.tick-s.stageStart>=s.nextGate-180;
      c.fillStyle=warning?'#ffec8c':'#637562';c.globalAlpha=warning?.6+.3*Math.sin(now*.012):.5;
      for(let line=0;line<3;line++)c.fillRect((x+.2)*tile,(y+.27+line*.22)*tile,tile*.6,2);c.globalAlpha=1;
    }
    drawPickup(this,s,now);
    for(const echo of s.special?.echoes||[]){const d=position(echo);this.sprite('chad',d.x,d.y,tile,now,.6,echo.dir===3,'#d9a5ff',chompFrame(echo));c.fillStyle='#d9a5ff';c.font='bold 10px Arial';c.textAlign='center';c.fillText('DECOY',(d.x+.5)*tile,(d.y-.15)*tile);}
    if(s.decoy){const d=position(s.decoy);this.sprite('chad',d.x,d.y,tile,now,.4,s.decoy.dir===3,undefined,chompFrame(s.decoy));}
    for(const g of s.ghosts){
      const q=position(g),col=CAST[g.kind].color;
      if(g.warning>0){c.strokeStyle='#ff6643';c.lineWidth=2;c.setLineDash([6,6]);const [dx,dy]=[[0,-1],[1,0],[0,1],[-1,0]][g.dir];c.beginPath();c.moveTo((q.x+.5)*tile,(q.y+.5)*tile);c.lineTo((q.x+.5+dx*7)*tile,(q.y+.5+dy*7)*tile);c.stroke();c.setLineDash([]);c.font='bold 20px Arial';c.fillStyle='#fff0cf';c.textAlign='center';c.fillText('!',(q.x+.5)*tile,(q.y-.2)*tile);}
      if(g.returning){c.globalAlpha=.5;this.sprite(CAST[g.kind].id,q.x,q.y,tile*.68,now,.45,false);c.globalAlpha=1;continue;}
      if(canEat(s)){c.strokeStyle=s.power>0&&s.power<120&&Math.floor(s.tick/12)%2?'#fff1d0':'#c2ff62';c.lineWidth=2;c.beginPath();c.arc((q.x+.5)*tile,(q.y+.5)*tile,tile*.55,0,Math.PI*2);c.stroke();}
      // Always preserve hair and accessories during frightened mode.
      this.sprite(CAST[g.kind].id,q.x,q.y,tile,now+g.kind*900,1,false,col);
      drawGhostEffect(this,s,g);
    }
    if(s.power||s.dash){c.strokeStyle=s.dash?'#ffffff':'#c0ff69';c.shadowColor=c.strokeStyle;c.shadowBlur=15;c.lineWidth=3;c.beginPath();c.arc((p.x+.5)*tile,(p.y+.5)*tile,tile*.6,0,Math.PI*2);c.stroke();c.shadowBlur=0;}
    drawPlayerEffect(this,s,now);
    const alpha=specialIs(s,'ghosted')?.42:s.invulnerable>0&&Math.floor(s.tick/8)%2?.82:1;
    this.sprite('chad',p.x,p.y,tile,now,alpha,s.player.dir===3,undefined,chompFrame(s.player));
    const [dx,dy]=[[0,-1],[1,0],[0,1],[-1,0]][s.player.dir];
    c.fillStyle=theme.accent;c.beginPath();const ax=(p.x+.5+dx*.7)*tile,ay=(p.y+.5+dy*.7)*tile;c.moveTo(ax+dx*4,ay+dy*4);c.lineTo(ax-dy*3-dx*3,ay+dx*3-dy*3);c.lineTo(ax+dy*3-dx*3,ay-dx*3-dy*3);c.fill();
    for(const part of this.particles){c.globalAlpha=part.life/35;c.fillStyle='#c4ff79';c.fillRect((part.x+.5)*tile,(part.y+.5)*tile,4,4);part.x+=part.vx;part.y+=part.vy;part.life--;}
    this.particles=this.particles.filter(v=>v.life>0);c.globalAlpha=1;
    for(const label of this.labels){c.globalAlpha=Math.min(1,label.life/15);c.fillStyle='#d8ff9b';c.font='bold 23px Impact';c.textAlign='center';c.strokeStyle='#000';c.lineWidth=4;const x=(label.x+.5)*tile,y=(label.y+.1)*tile-(60-label.life)*.5;c.strokeText(label.text,x,y);c.fillText(label.text,x,y);label.life--;}
    this.labels=this.labels.filter(v=>v.life>0);c.globalAlpha=1;c.restore();
    if(viewW<WIDTH||viewH<HEIGHT)this.minimap(s,w,h,ox,oy,tile);
    if(s.transition){c.fillStyle='#10110ee8';c.fillRect(0,0,w,h);c.fillStyle='#bfff67';c.textAlign='center';c.font=`${Math.min(46,w/12)}px Impact`;c.fillText('MAZE CLEARED',w/2,h/2-20);c.fillStyle='#fff0cc';c.font='18px monospace';c.fillText(THEMES[s.stage+1].name+' NEXT',w/2,h/2+20);}
  }
  sprite(id,x,y,tile,now,alpha=1,flip=false,color,mouthFrame=0){
    const chomp=id==='chad'&&this.images['chad-chomp'];
    const c=this.ctx,img=chomp||this.images[id];if(!img)return;
    const realTile=this.metrics.tile,centerX=(x+.5)*realTile,centerY=(y+.5)*realTile;
    const bob=this.reduced?0:Math.sin(now*.006+(id==='chad'?0:2))*realTile*.035;
    c.save();c.globalAlpha=alpha;c.translate(centerX,centerY+bob);c.fillStyle='#0008';c.beginPath();c.ellipse(0,tile*.39,tile*.34,tile*.11,0,0,Math.PI*2);c.fill();
    if(color){c.strokeStyle=color+'80';c.lineWidth=2;c.beginPath();c.ellipse(0,tile*.43,tile*.32,tile*.10,0,0,Math.PI*2);c.stroke();}
    if(flip)c.scale(-1,1);
    if(chomp){
      const a=CHOMP_ATLAS,f=a.frames[mouthFrame],size=tile*1.4,scale=size/a.logicalHeight;
      c.drawImage(img,f.column*a.cell+a.cropX-f.dx,f.sourceY,a.cropWidth,f.sourceHeight,
        -a.cropWidth/2*scale,-size*.56+f.dy*scale,a.cropWidth*scale,f.sourceHeight*scale);
    }else{
      const size=tile*(id==='chad'?1.28:1.35),ratio=img.naturalWidth/img.naturalHeight;
      c.drawImage(img,-size*ratio/2,-size*.56,size*ratio,size);
    }
    c.restore();
  }
  minimap(s,w,h,ox,oy,tile){const c=this.ctx,scale=w<500?3.4:4,x=w-WIDTH*scale-12,y=12;c.fillStyle='#05080ae8';c.fillRect(x-5,y-5,WIDTH*scale+10,HEIGHT*scale+10);c.fillStyle='#6f83a688';for(let k=0;k<s.maze.tiles.length;k++)if(s.maze.tiles[k])c.fillRect(x+(k%WIDTH)*scale,y+Math.floor(k/WIDTH)*scale,scale,scale);for(const g of s.ghosts){const p=position(g);c.fillStyle=CAST[g.kind].color;c.fillRect(x+p.x*scale,y+p.y*scale,scale+1,scale+1);}if(!s.maze.pickup.collected){const item=s.maze.pickup;c.fillStyle='#ffdb76';c.font='bold 12px Arial';c.textAlign='center';c.fillText('?',x+(item.x+.5)*scale,y+(item.y+1)*scale);}const p=position(s.player);c.fillStyle='#fff8d0';c.fillRect(x+p.x*scale-1,y+p.y*scale-1,scale+2,scale+2);c.strokeStyle='#d9efb665';c.lineWidth=1;c.strokeRect(x+Math.max(0,-ox/tile)*scale,y+Math.max(0,-oy/tile)*scale,Math.min(WIDTH,w/tile)*scale,Math.min(HEIGHT,h/tile)*scale);}
}
