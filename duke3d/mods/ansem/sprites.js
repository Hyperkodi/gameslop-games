// Generated Ansem artwork; atlas coordinates and classic-renderer adaptation.
// No Duke pixels, palettes or animation data are bundled here.
export const ATLAS = new URL('./ansem-atlas-v2.png', import.meta.url);
export const ROWS = ['Ready', 'Walk A', 'Walk B', 'Fire', 'Jetpack', 'Crouch', 'Crouch fire', 'Defeat'];
const XS = [20,218,417,607,802,1004], YS = [5,199,384,565,745,941,1115,1293,1493];
let atlasPromise;
export function loadSprites() {
  return atlasPromise ||= (async()=>{
    const image = new Image(); image.src = ATLAS.href; await image.decode();
    const sprites=[];
    for(let row=0;row<8;row++)for(let col=0;col<5;col++){
      const w=XS[col+1]-XS[col], h=YS[row+1]-YS[row];
      const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
      const ctx=canvas.getContext('2d',{willReadFrequently:true});
      ctx.drawImage(image,XS[col],YS[row],w,h,0,0,w,h);
      const pixels=ctx.getImageData(0,0,w,h),p=pixels.data;
      // The generated atlas has a baked light checkerboard. Key only neutral
      // background connected to a cell boundary, retaining enclosed white art.
      const seen=new Uint8Array(w*h),queue=new Int32Array(w*h);let head=0,tail=0;
      function visit(i){
        if(seen[i])return;seen[i]=1;const j=i*4;
        if(p[j+3]<16||(Math.min(p[j],p[j+1],p[j+2])>205&&Math.max(p[j],p[j+1],p[j+2])-Math.min(p[j],p[j+1],p[j+2])<23))queue[tail++]=i;
      }
      for(let x=0;x<w;x++){visit(x);visit((h-1)*w+x);}
      for(let y=0;y<h;y++){visit(y*w);visit(y*w+w-1);}
      while(head<tail){const i=queue[head++],x=i%w,y=Math.floor(i/w);p[i*4+3]=0;if(x)visit(i-1);if(x<w-1)visit(i+1);if(y)visit(i-w);if(y<h-1)visit(i+w);}
      ctx.putImageData(pixels,0,0);
      let left=w,top=h,right=0,bottom=0;
      for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(p[(y*w+x)*4+3]){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
      sprites.push({canvas,x:left,y:top,w:right-left+1,h:bottom-top+1});
    }
    return sprites;
  })();
}

export function grpEntries(buffer){
  const view=new DataView(buffer),bytes=new Uint8Array(buffer),count=view.getUint32(12,true),entries=new Map();let start=16+count*16;
  for(let i=0;i<count;i++){
    const off=16+i*16,name=new TextDecoder().decode(bytes.subarray(off,off+12)).replace(/\0.*$/,'').toUpperCase(),length=view.getUint32(off+12,true);
    entries.set(name,bytes.subarray(start,start+length));start+=length;
  }
  return entries;
}

// Trooper's directional action groups; mirrored angles are handled by the game.
export function poseForTile(offset){
  if(offset<20)return [1,0,2,0][Math.floor(offset/5)]*5+offset%5;
  if(offset<35)return offset%5;
  if(offset<40)return 15+offset%5;
  if(offset<50)return 20+offset%5;
  if(offset<55)return 35+offset-50;
  if(offset<64)return 35+Math.min(4,Math.max(0,offset-56));
  if(offset<69)return 25+(offset-64);
  if(offset<74)return 30+(offset-69);
  return offset===79?39:25;
}

export async function makeAnsemArt(buffer){
  const entries=grpEntries(buffer),palette=entries.get('PALETTE.DAT');
  if(!palette||palette.length<768)throw new Error('The game palette could not be read.');
  const sprites=await loadSprites(),metadata=new Map();
  for(const [name,bytes] of entries){
    if(!/^TILES\d{3}\.ART$/.test(name))continue;
    const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),first=v.getInt32(8,true),last=v.getInt32(12,true),n=last-first+1;
    if(first>1759||last<1680)continue;
    for(let tile=Math.max(1680,first);tile<=Math.min(1759,last);tile++){
      const j=tile-first;metadata.set(tile,{w:v.getUint16(16+2*j,true),h:v.getUint16(16+2*n+2*j,true),anim:v.getUint32(16+4*n+4*j,true)});
    }
  }
  if(metadata.size!==80)throw new Error('This game archive has no compatible trooper artwork.');
  const frames=[],cache=new Map();
  function color(r,g,b){
    const key=(r<<16)|(g<<8)|b;if(cache.has(key))return cache.get(key);
    let best=0,distance=Infinity;
    for(let i=0;i<255;i++){const dr=r-palette[i*3]*4,dg=g-palette[i*3+1]*4,db=b-palette[i*3+2]*4,d=dr*dr+dg*dg+db*db;if(d<distance){distance=d;best=i;}}
    cache.set(key,best);return best;
  }
  for(let offset=0;offset<80;offset++){
    const meta=metadata.get(1680+offset),pixels=new Uint8Array(meta.w*meta.h).fill(255);
    if(meta.w&&meta.h){
      const sprite=sprites[poseForTile(offset)],canvas=document.createElement('canvas');canvas.width=meta.w;canvas.height=meta.h;
      const ctx=canvas.getContext('2d',{willReadFrequently:true}),scale=Math.min(meta.w/sprite.w,meta.h/sprite.h),w=Math.max(1,Math.round(sprite.w*scale)),h=Math.max(1,Math.round(sprite.h*scale));
      ctx.imageSmoothingEnabled=false;
      ctx.drawImage(sprite.canvas,sprite.x,sprite.y,sprite.w,sprite.h,Math.floor((meta.w-w)/2),meta.h-h,w,h);
      const rgba=ctx.getImageData(0,0,meta.w,meta.h).data;
      for(let x=0;x<meta.w;x++)for(let y=0;y<meta.h;y++){const j=(y*meta.w+x)*4;if(rgba[j+3]>127)pixels[x*meta.h+y]=color(rgba[j],rgba[j+1],rgba[j+2]);}
    }
    frames.push({...meta,pixels});
  }
  const bytes=new Uint8Array(16+80*8+frames.reduce((n,f)=>n+f.pixels.length,0)),view=new DataView(bytes.buffer);
  [1,80,1680,1759].forEach((value,i)=>view.setInt32(i*4,value,true));let pos=16+80*8;
  frames.forEach((frame,i)=>{view.setUint16(16+2*i,frame.w,true);view.setUint16(16+160+2*i,frame.h,true);view.setUint32(16+320+4*i,frame.anim,true);bytes.set(frame.pixels,pos);pos+=frame.pixels.length;});
  return bytes;
}
