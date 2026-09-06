import {HAND_TILES,readTiles} from './tiles.js';
const ATLASES=['hands-a-v2.png','hands-b-v2.png'];
let imagesPromise;
function images(){return imagesPromise ||= Promise.all(ATLASES.map(async name=>{const image=new Image();image.src=new URL(name,import.meta.url).href;await image.decode();return image;}));}

export async function handFrames(){
  const sheets=await images(),frames=new Map();
  for(let index=0;index<HAND_TILES.length;index++){
    const id=HAND_TILES[index];
    if(id===2546)continue; // A muzzle flash with no hand: keep the original tile.
    const image=sheets[Math.floor(index/16)],cell=index%16,col=cell%4,row=Math.floor(cell/4);
    const x=Math.round(col*image.width/4),y=Math.round(row*image.height/4),w=Math.round((col+1)*image.width/4)-x,h=Math.round((row+1)*image.height/4)-y;
    const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,x,y,w,h,0,0,w,h);
    const data=ctx.getImageData(0,0,w,h),p=data.data;let left=w,top=h,right=-1,bottom=-1;
    for(let yy=0;yy<h;yy++)for(let xx=0;xx<w;xx++){
      const j=(yy*w+xx)*4,r=p[j],g=p[j+1],b=p[j+2];
      // The generated sprites deliberately use a magenta colour key. Remove it
      // in every gap, including enclosed finger gaps, while keeping red hands.
      if(b>35&&b>r*.28&&b>g*1.65&&r>g*1.5)p[j+3]=0;
      if(p[j+3]>127){left=Math.min(left,xx);right=Math.max(right,xx);top=Math.min(top,yy);bottom=Math.max(bottom,yy);}
    }
    if(right<left)throw new Error('A mascot hand frame is empty: '+id);
    ctx.putImageData(data,0,0);frames.set(id,{canvas,x:left,y:top,w:right-left+1,h:bottom-top+1});
  }
  return frames;
}

export async function makeMascotHands(buffer){
  const {tiles,palette}=readTiles(buffer),frames=await handFrames(),files=[],cache=new Map();
  if(!palette||palette.length<768)throw new Error('Cannot read the game palette for mascot hands.');
  function nearest(r,g,b){
    const key=(r<<16)|(g<<8)|b;if(cache.has(key))return cache.get(key);
    let best=0,distance=Infinity;
    for(let i=0;i<255;i++){const dr=r-palette[i*3]*4,dg=g-palette[i*3+1]*4,db=b-palette[i*3+2]*4,d=dr*dr+dg*dg+db*db;if(d<distance){distance=d;best=i;}}
    cache.set(key,best);return best;
  }
  for(const [id,frame] of frames){
    const tile=tiles.get(id);if(!tile)continue;
    const canvas=document.createElement('canvas');canvas.width=tile.w;canvas.height=tile.h;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.imageSmoothingEnabled=false;
    ctx.drawImage(frame.canvas,frame.x,frame.y,frame.w,frame.h,0,0,tile.w,tile.h);
    const rgba=ctx.getImageData(0,0,tile.w,tile.h).data,bytes=new Uint8Array(24+tile.w*tile.h),view=new DataView(bytes.buffer);
    [1,1,id,id].forEach((n,i)=>view.setInt32(i*4,n,true));view.setUint16(16,tile.w,true);view.setUint16(18,tile.h,true);view.setUint32(20,tile.anim,true);
    for(let x=0;x<tile.w;x++)for(let y=0;y<tile.h;y++){
      const j=(y*tile.w+x)*4;bytes[24+x*tile.h+y]=rgba[j+3]>127?nearest(rgba[j],rgba[j+1],rgba[j+2]):255;
    }
    files.push({name:'gameslop-hand-'+id+'.art',bytes});
  }
  if(!files.length)throw new Error('No compatible first-person hand frames were found.');
  return files;
}
