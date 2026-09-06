import {grpEntries} from '../ansem/sprites.js';
export const HAND_TILES = [1640,2324,2325,2326,2327,2524,2525,2526,2528,2529,2531,2532,2536,2544,2546,2564,2565,2568,2570,2571,2572,2573,2574,2575,2576,2577,2613,2616,2617,2618,2619];
export function readTiles(buffer,requested=HAND_TILES){
  const entries=grpEntries(buffer),palette=entries.get('PALETTE.DAT'),wanted=new Set(requested),tiles=new Map();
  for(const [name,bytes] of entries){
    if(!/^TILES\d{3}\.ART$/.test(name))continue;
    const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),first=v.getInt32(8,true),last=v.getInt32(12,true),n=last-first+1;
    let pos=16+n*8;
    for(let j=0;j<n;j++){
      const w=v.getUint16(16+2*j,true),h=v.getUint16(16+2*n+2*j,true),tile=first+j;
      if(wanted.has(tile)&&w&&h)tiles.set(tile,{tile,w,h,anim:v.getUint32(16+4*n+4*j,true),pixels:bytes.slice(pos,pos+w*h)});
      pos+=w*h;
    }
  }
  return {tiles,palette};
}
export function tileCanvas(tile,palette){
  const canvas=document.createElement('canvas');canvas.width=tile.w;canvas.height=tile.h;const ctx=canvas.getContext('2d'),rgba=ctx.createImageData(tile.w,tile.h);
  for(let x=0;x<tile.w;x++)for(let y=0;y<tile.h;y++){const c=tile.pixels[x*tile.h+y],p=(y*tile.w+x)*4;if(c===255)continue;rgba.data.set([palette[c*3]*4,palette[c*3+1]*4,palette[c*3+2]*4,255],p);}
  ctx.putImageData(rgba,0,0);return canvas;
}
