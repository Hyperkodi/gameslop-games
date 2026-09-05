(function(root) {
  'use strict';
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  function stickDirections(dx,dy,previous=[],base=false) {
    const length=Math.hypot(dx,dy),active=previous.length>0;
    if(length<(active?.16:.22))return [];
    const x=Math.abs(dx),y=Math.abs(dy),out=[];
    const horizontal=dx<0?'left':'right',vertical=dy<0?'up':'down';
    const hadHorizontal=previous.includes(horizontal),hadVertical=previous.includes(vertical);
    if(x>=(hadHorizontal?.18:.24)&&x>=y*(hadHorizontal?.42:.55))out.push(horizontal);
    // Bunkers retain eight-way floor movement. Elsewhere, down requires a
    // deliberate downward gesture so natural sideways drift cannot crouch.
    const down=!base&&dy>0;
    const threshold=down?(hadVertical?.30:.40):(hadVertical?.20:.28);
    const ratio=down?(hadVertical?1:1.25):(hadVertical?.48:.65);
    if(y>=threshold&&y>=x*ratio)out.push(vertical);
    return out;
  }
  function createTouchControls({element,cabinet=element,getState,onChange,storage,unlock}) {
    const stick=element.querySelector('.dpad'),auto=element.querySelector('#auto-fire');
    const hint=element.querySelector('.touch-hint');
    const contacts=new Map();let stickPointer=null,directions=[],usingTouch=false;
    let autoFire=storage.get('gameslop:commando:auto-fire','1')!=='0';
    function paintPreference() {
      auto.textContent=autoFire?'AUTO FIRE ON':'AUTO FIRE OFF';
      auto.setAttribute('aria-pressed',String(autoFire));
      auto.setAttribute('aria-label',autoFire?'Turn off automatic firing':'Turn on automatic firing');
      if(hint)hint.textContent=autoFire?'MOVE + JUMP':'TAP AUTO FIRE TO SHOOT';
    }
    function capture(node,id) { try{node.setPointerCapture(id);}catch(_){/* Some browsers cancel a pointer during rotation. */} }
    function steer(event) {
      const rect=stick.getBoundingClientRect();
      let dx=(event.clientX-rect.x-rect.width/2)/(rect.width/2),dy=(event.clientY-rect.y-rect.height/2)/(rect.height/2);
      const length=Math.max(1,Math.hypot(dx,dy));dx/=length;dy/=length;
      directions=stickDirections(dx,dy,directions,getState().level.mode==='base');
      stick.style.setProperty('--stick-x',clamp(dx,-1,1)*rect.width*.26+'px');
      stick.style.setProperty('--stick-y',clamp(dy,-1,1)*rect.height*.26+'px');
      stick.querySelectorAll('[data-action]').forEach(button=>button.classList.toggle('pressed',directions.includes(button.dataset.action)));
      onChange(event.pointerId,directions.map(action=>'0:'+action));
    }
    function release(id) {
      const node=contacts.get(id);if(!node)return;
      contacts.delete(id);node.classList.remove('pressed');
      if(id===stickPointer){
        stickPointer=null;directions=[];
        stick.style.setProperty('--stick-x','0px');stick.style.setProperty('--stick-y','0px');
        stick.querySelectorAll('[data-action]').forEach(button=>button.classList.remove('pressed'));
      }
      onChange(id,null);
      if(node.hasPointerCapture?.(id)){try{node.releasePointerCapture(id);}catch(_){/* Already released by the browser. */}}
    }
    stick.addEventListener('pointerdown',event=>{
      event.preventDefault();if(getState().status!=='playing'||stickPointer!==null)return;
      usingTouch=true;unlock();stickPointer=event.pointerId;contacts.set(event.pointerId,stick);capture(stick,event.pointerId);steer(event);
    });
    stick.addEventListener('pointermove',event=>{if(event.pointerId===stickPointer){event.preventDefault();steer(event);}});
    element.querySelectorAll('.action-buttons [data-action]').forEach(button=>{
      button.addEventListener('pointerdown',event=>{
        event.preventDefault();if(getState().status!=='playing'||button.disabled)return;
        usingTouch=true;unlock();contacts.set(event.pointerId,button);capture(button,event.pointerId);
        button.classList.add('pressed');onChange(event.pointerId,['0:'+button.dataset.action]);
      });
    });
    for(const type of ['pointerup','pointercancel','lostpointercapture'])element.addEventListener(type,event=>release(event.pointerId));
    element.addEventListener('contextmenu',event=>event.preventDefault());
    auto.addEventListener('click',()=>{
      autoFire=!autoFire;usingTouch=true;storage.set('gameslop:commando:auto-fire',autoFire?'1':'0');paintPreference();
      if(autoFire)unlock();onChange('auto',null);
    });
    // Browsers can omit a click when a second finger taps a menu button while
    // the movement thumb stays down. Activate that tap on release instead.
    const secondaryTaps=new WeakMap();
    const menuButton=event=>event.target.closest?.('#pause,#sound,#fullscreen,#auto-fire');
    cabinet.addEventListener('pointerdown',event=>{
      const button=menuButton(event);if(button)secondaryTaps.delete(button);
    },true);
    cabinet.addEventListener('pointerup',event=>{
      const button=menuButton(event);
      if(!button||button.disabled||event.pointerType!=='touch'||event.isPrimary)return;
      const rect=button.getBoundingClientRect();
      if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)return;
      secondaryTaps.set(button,{id:event.pointerId,time:performance.now()});button.click();
    });
    cabinet.addEventListener('click',event=>{
      const button=menuButton(event),tap=button&&secondaryTaps.get(button);
      if(tap&&event.isTrusted&&event.detail>0&&performance.now()-tap.time<500&&(event.pointerId===undefined||event.pointerId===tap.id)){
        event.preventDefault();event.stopImmediatePropagation();secondaryTaps.delete(button);
      }
    },true);
    paintPreference();
    return {
      reset(){[...contacts.keys()].forEach(release);},
      notePointer(event){if(event.pointerType==='touch'||event.pointerType==='pen')usingTouch=true;},
      usePhysicalControls(){usingTouch=false;},
      shouldAutoFire(){return autoFire&&usingTouch&&getState().status==='playing';},
      inspect(){return {autoFire,usingTouch,contacts:contacts.size,directions:[...directions]};}
    };
  }
  const api={createTouchControls,stickDirections};
  root.SlopCommando=Object.assign(root.SlopCommando||{},api);
  if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
