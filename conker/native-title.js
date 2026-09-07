/* Match the rendered EU title, so skipping/loading a scene cannot leave a timed
   stamp over gameplay. Read only after the renderer presents to its canvas. */
(function(root){
 'use strict';
 const points=[[515,172,2],[555,172,0],[615,172,0],[675,172,2],[735,172,0],[515,197,0],[555,197,0],[775,197,2],[715,222,0],[735,222,0],[775,222,2],[495,247,0],[515,247,0],[535,247,0],[635,247,2],[715,247,0],[735,247,0],[475,272,1],[495,272,0],[635,272,2],[755,272,2],[775,272,2],[495,297,0],[635,297,2],[495,322,0],[595,322,0],[655,322,0],[755,322,0],[495,347,0],[535,347,2],[595,347,0],[615,347,0],[635,347,0],[655,347,0],[715,347,0],[735,347,0],[755,347,0],[495,372,0],[555,372,2],[615,372,0],[635,372,0],[655,372,0],[755,372,0],[475,397,2],[595,397,2],[675,397,2],[735,397,2],[495,422,0],[515,422,0],[575,422,2],[595,422,2],[615,422,2],[675,422,2],[735,422,2],[535,447,0],[555,447,0],[595,447,2],[615,447,2],[635,447,0],[735,447,2],[515,472,2],[555,472,0],[595,472,2],[655,472,0],[715,472,0]];
 function matches(bytes,width,height,bottomUp=true){
  const scale=Math.min(height,width*.75)/725,oy=(height-725*scale)/2;
  const hits=[0,0,0],total=[0,0,0];
  for(const [x,y,type] of points){
   const px=Math.round(width/2+(x-640)*scale),py=Math.round(oy+y*scale);
   const i=((bottomUp?height-1-py:py)*width+px)*4,r=bytes[i],g=bytes[i+1],b=bytes[i+2];
   const ok=type===0?r>120&&g>65&&g<r*.9&&b<g*.68:type===1?Math.min(r,g,b)>125&&Math.max(r,g,b)<Math.min(r,g,b)*1.6:Math.max(r,g,b)<85;
   total[type]++;if(ok)hits[type]++;
  }
  return hits[0]/total[0]>=.85&&hits[2]/total[2]>=.76&&hits[1]===1;
 }
 // The opening credit is a separate black card. Match its unchanged red
 // heading and purple Berri line, including their fade, never a wall-clock timer.
 const creditRed=[[460,147],[510,147],[535,147],[585,147],[735,147],[760,147],[510,162],[535,162],[560,162],[585,162],[610,162],[735,162]];
 const creditPurple=[[600,422],[775,422],[450,437],[525,437],[550,437],[600,437],[625,437],[700,437],[725,437],[450,452],[525,452],[600,452],[650,452],[725,452],[475,467],[550,467],[650,467],[725,467],[500,482],[775,482]];
 function creditOpacity(bytes,width,height,bottomUp=true){
  const scale=Math.min(height,width*.75)/725,oy=(height-725*scale)/2;
  const pixel=(x,y)=>{const px=Math.round(width/2+(x-640)*scale),py=Math.round(oy+y*scale),i=((bottomUp?height-1-py:py)*width+px)*4;return [bytes[i],bytes[i+1],bytes[i+2]];};
  let red=0,purple=0,brightness=0;
  for(const [x,y] of creditRed){const [r,g,b]=pixel(x,y);if(r>18&&g<r*.38&&b<r*.35)red++;}
  for(const [x,y] of creditPurple){const [r,g,b]=pixel(x,y);if(r>14&&b>10&&g<r*.62&&b>r*.45){purple++;brightness+=r;}}
  // Small screens can round a few thin red strokes onto their black edge.
  if(red<8||purple<16)return 0;
  for(const [x,y] of [[320,220],[900,280],[420,370],[810,370],[620,540]])if(Math.max(...pixel(x,y))>24)return 0;
  return Math.min(1,brightness/purple/156);
 }
 if(typeof module==='object'&&module.exports){module.exports={matches,creditOpacity};return;}
 const layer=document.createElement('div');layer.className='native-title';layer.hidden=true;layer.setAttribute('aria-hidden','true');
 layer.innerHTML='<div class="native-imprint">Slopper\'s</div><div class="native-hand-motion"><img src="art/stamp-hand-matte.png" alt=""></div>';
 document.body.append(layer);
 const credit=document.createElement('div');credit.className='native-credit';credit.hidden=true;credit.setAttribute('aria-hidden','true');
 credit.innerHTML='<img src="art/starring-slopper.svg" alt="Slopper">';document.body.append(credit);
 let lastRead=0,lastSeen=0,visible=false,buffer,reads=0,hits=0;
 const api=root.SlopperNativeTitle={matches,get state(){return {visible,reads,hits,creditVisible:!credit.hidden};}};
 function observe(gl){
  const now=performance.now();if(now-lastRead<(visible||!credit.hidden?80:150))return;
  if(gl.canvas!==root.EJS_emulator?.canvas)return;
  // Offscreen draws are incomplete; only inspect the default framebuffer.
  if(gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING||gl.FRAMEBUFFER_BINDING)!==null)return;
  lastRead=now;
  const w=gl.drawingBufferWidth,h=gl.drawingBufferHeight;if(!w||!h||gl.isContextLost())return;
  if(!buffer||buffer.length!==w*h*4)buffer=new Uint8Array(w*h*4);
  const target=gl.READ_FRAMEBUFFER||gl.FRAMEBUFFER,binding=gl.READ_FRAMEBUFFER_BINDING||gl.FRAMEBUFFER_BINDING,previous=gl.getParameter(binding);
  // The core leaves a pixel-pack buffer bound. Typed-array readback requires
  // unbinding it; restore every changed binding before returning to the core.
  const pack=gl.PIXEL_PACK_BUFFER?gl.getParameter(gl.PIXEL_PACK_BUFFER_BINDING):null;
  try{if(gl.PIXEL_PACK_BUFFER)gl.bindBuffer(gl.PIXEL_PACK_BUFFER,null);gl.bindFramebuffer(target,null);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,buffer);}finally{gl.bindFramebuffer(target,previous);if(gl.PIXEL_PACK_BUFFER)gl.bindBuffer(gl.PIXEL_PACK_BUFFER,pack);}
  reads++;
  const opacity=creditOpacity(buffer,w,h);
  credit.hidden=!opacity;
  if(opacity){
   const rect=gl.canvas.getBoundingClientRect(),scale=Math.min(rect.height,rect.width*.75)/725;
   credit.style.setProperty('--unit',scale+'px');credit.style.setProperty('--letter-opacity',opacity);
   credit.style.left=(rect.left+rect.width/2+(617-640)*scale)+'px';
   credit.style.top=(rect.top+(rect.height-725*scale)/2+272*scale)+'px';
  }
  if(matches(buffer,w,h)){
   lastSeen=now;hits++;
   const rect=gl.canvas.getBoundingClientRect(),scale=Math.min(rect.height,rect.width*.75)/725;
   layer.style.setProperty('--unit',scale+'px');
   layer.style.left=(rect.left+rect.width/2+(535-640)*scale)+'px';
   layer.style.top=(rect.top+(rect.height-725*scale)/2+91*scale)+'px';
   if(!visible){visible=true;layer.hidden=false;layer.classList.remove('pressing');void layer.offsetWidth;layer.classList.add('pressing');}
  }else if(visible&&now-lastSeen>250){visible=false;layer.hidden=true;layer.classList.remove('pressing');}
 }
 for(const type of [root.WebGLRenderingContext,root.WebGL2RenderingContext]){
  if(!type)continue;
  for(const name of ['drawElements','drawArrays','blitFramebuffer']){
   const original=type.prototype[name];if(!original)continue;
   type.prototype[name]=function(...args){const result=original.apply(this,args);observe(this);return result;};
  }
 }
})(typeof window==='object'?window:globalThis);
