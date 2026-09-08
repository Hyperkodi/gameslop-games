// Rotation can expand the page immediately. Native fullscreen requires a gesture.
export function createDisplay({cabinet,button,resize,isPlaying}){
  let automatic=false,suppressed=false,busy=false,attempted=false,native=false,lastTouch=-1000;
  let oldOverflow='';
  const touchDevice=navigator.maxTouchPoints>0||matchMedia('(any-pointer: coarse)').matches;
  const landscape=()=>touchDevice&&innerWidth>innerHeight;
  function label(){button.textContent=document.fullscreenElement||cabinet.classList.contains('full-window')?'EXIT FULLSCREEN':'FULLSCREEN ↗';}
  function expand(auto){
    if(!cabinet.classList.contains('full-window'))oldOverflow=document.documentElement.style.overflow;
    automatic=auto;cabinet.classList.add('full-window');cabinet.classList.toggle('auto-landscape',auto);
    document.documentElement.style.overflow='hidden';label();resize();
  }
  function collapse(){
    automatic=false;cabinet.classList.remove('full-window','auto-landscape');document.documentElement.style.overflow=oldOverflow;label();resize();
  }
  async function requestNative(){
    if(busy||document.fullscreenElement||!cabinet.requestFullscreen)return;
    busy=true;attempted=true;const fromRotation=automatic;
    try{
      await cabinet.requestFullscreen({navigationUI:'hide'});
      if(fromRotation&&(!automatic||!landscape()||!isPlaying()||suppressed))await document.exitFullscreen();
    }catch{/* Full-window play remains available, including on iPhone. */}
    finally{busy=false;label();resize();}
  }
  async function exit(){
    suppressed=true;collapse();
    if(document.fullscreenElement){try{await document.exitFullscreen();}catch{}}
    label();resize();
  }
  function sync(){
    const wide=landscape();
    cabinet.classList.toggle('touch-landscape',wide);
    if(!wide){suppressed=false;attempted=false;}
    if((!wide||!isPlaying())&&automatic){
      collapse();if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});
    }else if(wide&&isPlaying()&&!suppressed&&!document.fullscreenElement&&!cabinet.classList.contains('full-window'))expand(true);
    resize();
  }
  async function toggle(){
    if(busy)return;
    if(document.fullscreenElement||cabinet.classList.contains('full-window')){await exit();return;}
    // Manual fullscreen also has a full-window fallback if native fullscreen fails.
    expand(false);await requestNative();
  }
  button.addEventListener('pointerup',e=>{if(e.pointerType!=='touch')return;e.preventDefault();lastTouch=performance.now();toggle();});
  button.addEventListener('click',e=>{if(e.detail===0||performance.now()-lastTouch>700)toggle();});
  cabinet.addEventListener('pointerup',e=>{
    if(automatic&&!attempted&&!document.fullscreenElement&&e.isTrusted&&e.target.closest('.launch-controls,#game,#start,#again'))requestNative();
  });
  document.addEventListener('fullscreenchange',()=>{
    const now=!!document.fullscreenElement;
    // Respect Escape / the browser's exit control; do not immediately force re-entry.
    if(native&&!now){suppressed=landscape();collapse();}
    native=now;label();resize();
  });
  window.addEventListener('resize',sync);
  window.visualViewport?.addEventListener('resize',sync);
  screen.orientation?.addEventListener('change',sync);
  sync();return {sync,exit};
}
