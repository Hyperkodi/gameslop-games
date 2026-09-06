import {loadSprites} from './sprites.js';
const canvas=document.getElementById('preview'),ctx=canvas.getContext('2d'),$=id=>document.getElementById(id);
const poses={walk:[5,0,10,0],idle:[0],fire:[0,15,15,0],jetpack:[20],crouch:[25],duckfire:[25,30,30,25],defeat:[35,36,37,38,39,39,39]};
try{
  const sprites=await loadSprites();window.ansemSprites=sprites;
  $('preview-status').textContent='40 poses · Five viewing angles · Walking, firing, jetpack, crouching and defeat';document.body.dataset.ready='1';
  function draw(now){
    const animation=$('animation').value,frames=poses[animation],tick=$('animate').checked?Math.floor(now/180):0,angle=Number($('angle').value),pose=frames[tick%frames.length]+(animation==='defeat'?0:angle),sprite=sprites[pose];
    ctx.fillStyle='#17212a';ctx.fillRect(0,0,900,450);ctx.fillStyle='#243039';ctx.fillRect(0,359,900,91);
    ctx.strokeStyle='#35434e';ctx.beginPath();ctx.moveTo(0,359);ctx.lineTo(900,359);ctx.stroke();
    ctx.imageSmoothingEnabled=false;
    for(let i=0;i<3;i++){
      const s=i===1?sprite:sprites[(animation==='defeat'?35:frames[tick%frames.length])+((angle+i+1)%5)*(animation==='defeat'?0:1)],scale=i===1?1.85:1.25,x=[155,450,740][i],bottom=360;
      ctx.fillStyle='#0005';ctx.beginPath();ctx.ellipse(x,bottom+4,55,10,0,0,Math.PI*2);ctx.fill();
      ctx.drawImage(s.canvas,s.x,s.y,s.w,s.h,x-s.w*scale/2,bottom-s.h*scale,s.w*scale,s.h*scale);
    }
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
}catch(error){$('preview-status').textContent='Could not load the sprite preview: '+error.message;}
