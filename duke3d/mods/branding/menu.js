// Gameslop's native menu skin. Draw code-native type and geometry, then compile
// to the selected GRP's 8-bit palette. No original menu pixels are copied.
import {readTiles} from '../mascot-hands/tiles.js';

const glyphs = new Map();
for (let i=0;i<10;i++) glyphs.set(2930+i,String(i));
for (let i=0;i<26;i++) {
  glyphs.set(2940+i,String.fromCharCode(65+i));
  glyphs.set(2966+i,String.fromCharCode(97+i));
}
for (const [id,char] of [[2929,'-'],[3002,'.'],[3003,','],[3004,'!'],[3005,'?'],[3006,';'],[3007,':'],[3008,'/'],[3009,'%'],[3022,"'"]]) glyphs.set(id,char);
export const MENU_TILES = [2456,2457,2497,2498,2499,2501,2503,3281,...Array.from({length:7},(_,i)=>2813+i),...glyphs.keys()];
const cream='#f4ecda',red='#ff4439';
// Five-by-seven lettering stays sharp at the engine's original menu resolution.
const PIXEL_FONT = {
  A:'01110/10001/10001/11111/10001/10001/10001',B:'11110/10001/10001/11110/10001/10001/11110',C:'01111/10000/10000/10000/10000/10000/01111',D:'11110/10001/10001/10001/10001/10001/11110',
  E:'11111/10000/10000/11110/10000/10000/11111',F:'11111/10000/10000/11110/10000/10000/10000',G:'01111/10000/10000/10111/10001/10001/01111',H:'10001/10001/10001/11111/10001/10001/10001',
  I:'11111/00100/00100/00100/00100/00100/11111',J:'00111/00010/00010/00010/10010/10010/01100',K:'10001/10010/10100/11000/10100/10010/10001',L:'10000/10000/10000/10000/10000/10000/11111',
  M:'10001/11011/10101/10101/10001/10001/10001',N:'10001/11001/11001/10101/10011/10011/10001',O:'01110/10001/10001/10001/10001/10001/01110',P:'11110/10001/10001/11110/10000/10000/10000',
  Q:'01110/10001/10001/10001/10101/10010/01101',R:'11110/10001/10001/11110/10100/10010/10001',S:'01111/10000/10000/01110/00001/00001/11110',T:'11111/00100/00100/00100/00100/00100/00100',
  U:'10001/10001/10001/10001/10001/10001/01110',V:'10001/10001/10001/10001/10001/01010/00100',W:'10001/10001/10001/10101/10101/11011/10001',X:'10001/10001/01010/00100/01010/10001/10001',
  Y:'10001/10001/01010/00100/00100/00100/00100',Z:'11111/00001/00010/00100/01000/10000/11111',
  0:'01110/10001/10011/10101/11001/10001/01110',1:'00100/01100/00100/00100/00100/00100/01110',2:'01110/10001/00001/00010/00100/01000/11111',3:'11110/00001/00001/01110/00001/00001/11110',4:'00010/00110/01010/10010/11111/00010/00010',
  5:'11111/10000/10000/11110/00001/00001/11110',6:'01110/10000/10000/11110/10001/10001/01110',7:'11111/00001/00010/00100/01000/01000/01000',8:'01110/10001/10001/01110/10001/10001/01110',9:'01110/10001/10001/01111/00001/00001/01110',
  '-':'00000/00000/00000/11111/00000/00000/00000','.':'00000/00000/00000/00000/00000/00110/00110',',':'00000/00000/00000/00000/00110/00110/00100','!':'00100/00100/00100/00100/00100/00000/00100','?':'01110/10001/00001/00010/00100/00000/00100',
  ';':'00000/00110/00110/00000/00110/00110/00100',':':'00000/00110/00110/00000/00110/00110/00000','/':'00001/00001/00010/00100/01000/10000/10000','%':'11001/11010/00010/00100/01000/01011/10011',"'":'00100/00100/00100/00000/00000/00000/00000'
};
function pixelGlyph(ctx,char,x,y,w,h){
  const rows=PIXEL_FONT[char.toUpperCase()];if(!rows)return;
  rows.split('/').forEach((row,yy)=>Array.from(row).forEach((bit,xx)=>{
    if(bit==='1'){const left=Math.round(xx*w/5),top=Math.round(yy*h/7);ctx.fillRect(x+left,y+top,Math.round((xx+1)*w/5)-left,Math.round((yy+1)*h/7)-top);}
  }));
}
function pixelLabel(ctx,text,x,y,color){ctx.fillStyle=color;Array.from(text).forEach((c,i)=>pixelGlyph(ctx,c,x+i*6,y,5,7));}

function label(ctx,text,x,y,size,color=cream,font='Impact') {
  ctx.font=`${size}px ${font}`;ctx.fillStyle=color;ctx.textBaseline='top';ctx.fillText(text,x,y);
}
function title(ctx,w,h,full=true) {
  const words=full?['SLOP ','NUKEM ','3D']:['SLOP ','NUKEM'];
  ctx.font=`${h-3}px Impact`;
  const total=words.reduce((n,s)=>n+ctx.measureText(s).width,0),scale=Math.min(1,(w-4)/total);
  ctx.save();ctx.translate((w-total*scale)/2,0);ctx.scale(scale,1);
  let x=0;
  words.forEach((s,i)=>{label(ctx,s,x+1,2,h-3,'#42181a');label(ctx,s,x,0,h-3,i===1?red:cream);x+=ctx.measureText(s).width;});
  ctx.restore();
  ctx.fillStyle=red;ctx.fillRect(2,h-2,w-4,1);
}
function backdrop(ctx,loading=false) {
  ctx.fillStyle='#414a45';ctx.fillRect(0,0,320,200);
  ctx.fillStyle='#657566';
  for(let x=8;x<320;x+=8)for(let y=8;y<200;y+=8)if(x<62||x>258)ctx.fillRect(x,y,1,1);
  ctx.fillStyle='#303936';ctx.fillRect(66,4,188,190);
  ctx.strokeStyle='#637064';ctx.strokeRect(3.5,3.5,313,193);
  ctx.fillStyle=red;ctx.fillRect(4,4,40,2);ctx.fillRect(276,194,40,2);
  // The city sits below the menu's last entry, leaving all options readable.
  for(let i=0;i<19;i++){
    const h=5+(i*17%15);ctx.fillStyle=i%2?'#111817':'#26342d';ctx.fillRect(i*18,196-h,15,h);
    ctx.fillStyle='#805547';if(i%3===0)ctx.fillRect(i*18+4,199-h,2,2);
  }
  pixelLabel(ctx,'GAME',12,12,cream);pixelLabel(ctx,'SLOP',12,21,red);
  pixelLabel(ctx,'GAMESLOP / LOCAL LAB',104,186,'#bbc5ad');
  for(const x of [24,288])for(const y of [48,154]){
    ctx.fillStyle='#ba453b';ctx.fillRect(x-3,y-1,7,3);ctx.fillRect(x-1,y-3,3,7);
  }
  if(loading){ctx.save();ctx.translate(59,43);title(ctx,203,32);ctx.restore();label(ctx,'MAKING A MESS...',111,112,9);}
}
function paint(ctx,id,w,h) {
  if(id===2456||id===3281){ctx.save();ctx.scale(w/320,h/200);backdrop(ctx,id===3281);ctx.restore();}
  else if(id===2499||id===2497)title(ctx,w,h,id===2499);
  else if(id===2498){label(ctx,'3D',1,0,h-2);}
  else if(id===2457){ctx.fillStyle='#303936';ctx.fillRect(w*.21,0,w*.58,h);ctx.fillStyle=red;ctx.fillRect(w*.21,h-2,w*.58,1);}
  else if(id>=2813&&id<=2819){
    const r=Math.min(w,h)*(.34+.025*Math.sin((id-2813)*Math.PI*2/7));
    ctx.fillStyle=cream;ctx.beginPath();ctx.arc(w/2,h/2,r+1,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=red;ctx.beginPath();ctx.arc(w/2,h/2,r,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#161c1a';ctx.fillRect(w/2-r*.63,h/2-r*.22,r*1.26,r*.44);ctx.fillRect(w/2-r*.22,h/2-r*.63,r*.44,r*1.26);
  } else if(glyphs.has(id)) {
    // Keep each glyph's original metrics so the native hitboxes and spacing work.
    ctx.fillStyle=cream;pixelGlyph(ctx,glyphs.get(id),0,1,w-1,h-2);
  }
  // Atomic-edition badges (2501/2503) intentionally stay transparent.
}

export function makeMenuArt(buffer) {
  const {tiles,palette}=readTiles(buffer,MENU_TILES),cache=new Map(),files=[];
  if(!palette||palette.length<768||!tiles.has(2499)||!tiles.has(2456))throw new Error('Cannot prepare the Slop Nukem 3D menu for this game file.');
  function nearest(r,g,b){
    const key=(r<<16)|(g<<8)|b;if(cache.has(key))return cache.get(key);
    let best=0,distance=Infinity;
    for(let i=0;i<255;i++){const d=(r-palette[i*3]*4)**2+(g-palette[i*3+1]*4)**2+(b-palette[i*3+2]*4)**2;if(d<distance){distance=d;best=i;}}
    cache.set(key,best);return best;
  }
  for(const [id,tile] of tiles){
    const cursor=id>=2813&&id<=2819;
    const w=cursor?18:tile.w,h=cursor?18:tile.h,anim=cursor?0:tile.anim,canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});paint(ctx,id,w,h);
    const rgba=ctx.getImageData(0,0,w,h).data,bytes=new Uint8Array(24+w*h),view=new DataView(bytes.buffer);
    [1,1,id,id].forEach((n,i)=>view.setInt32(i*4,n,true));view.setUint16(16,w,true);view.setUint16(18,h,true);view.setUint32(20,anim,true);
    for(let x=0;x<w;x++)for(let y=0;y<h;y++){const j=(y*w+x)*4;bytes[24+x*h+y]=rgba[j+3]>127?nearest(rgba[j],rgba[j+1],rgba[j+2]):255;}
    files.push({name:`gameslop-menu-${id}.art`,bytes});
  }
  return files;
}
