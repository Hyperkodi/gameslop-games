// Identical fixed-step simulation in the browser and replay validator. No DOM or clock.
import {POWERUPS,SPECIAL_TICKS,specialIs,canEat,ghostBonus} from './powerups.mjs';
export const VERSION = 'pac-chad-campaign-v3';
export const FPS = 60;
export const WIDTH = 23, HEIGHT = 19;
export const DIRS = [[0,-1],[1,0],[0,1],[-1,0]];
export const CAST = [
  { id:'rook', name:'Rook', role:'THE CHASER', color:'#4986ff', detail:'Blue bob. Broad jaw. Goatee. Follows your trail.' },
  { id:'hex', name:'Hex', role:'THE AMBUSHER', color:'#c570ff', detail:'Round glasses. Purple bun. Dramatic makeup. Cuts off your next turn.' },
  { id:'ivy', name:'Ivy', role:'THE GUARDIAN', color:'#b5ec4f', detail:'Green undercut. Soft features. Silver hoops. Guards the power pellets.' },
  { id:'riot', name:'Riot', role:'THE CHARGER', color:'#62e8bd', detail:'Rainbow space buns. Red glasses. Charges after a warning.' }
];
export const THEMES = [
  {name:'AFTERHOURS', subtitle:'The neon arcade', wall:'#354b95', edge:'#638cf4', accent:'#bcff5b', floor:'#0c1020'},
  {name:'ACID WORKS', subtitle:'The midnight factory', wall:'#305347', edge:'#67ac7c', accent:'#ffe170', floor:'#0b1716'},
  {name:'VIOLET VAULT', subtitle:'The underground club', wall:'#603460', edge:'#b36ec3', accent:'#71e7ec', floor:'#170c20'},
  {name:'SUNSET STRIP', subtitle:'The neon boulevard', wall:'#854532', edge:'#f69a66', accent:'#ffe170', floor:'#20100c'},
  {name:'FROST BYTE', subtitle:'The frozen server room', wall:'#285b78', edge:'#8adcf0', accent:'#e5fffa', floor:'#081720'},
  {name:'REDLINE', subtitle:'The reactor core', wall:'#7c2637', edge:'#ec667a', accent:'#ffdb79', floor:'#20090f'},
  {name:'GOLD RUSH', subtitle:'The gilded labyrinth', wall:'#74602a', edge:'#dab955', accent:'#fff2b0', floor:'#1b1709'},
  {name:'DEEP SIGNAL', subtitle:'The abyssal relay', wall:'#23565c', edge:'#4cb2b8', accent:'#a7fff0', floor:'#06191c'},
  {name:'HOT PINK PANIC', subtitle:'The laser district', wall:'#702557', edge:'#f169bf', accent:'#8dfcff', floor:'#1d0918'},
  {name:'CHAD CITADEL', subtitle:'The final chase', wall:'#4d5067', edge:'#c6c9e8', accent:'#ffda67', floor:'#101019'}
];
export const LEVEL_COUNT = THEMES.length;
export const key = (x,y) => y*WIDTH+x;
export function random(seed) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s,1664525)+1013904223)>>>0; return s/4294967296; };
}
export function makeMaze(seed, stage = 0) {
  const rng=random((seed+Math.imul(stage+1,2654435761))>>>0);
  const tiles=new Uint8Array(WIDTH*HEIGHT).fill(1);
  const stack=[[1,1]]; tiles[key(1,1)]=0;
  while(stack.length) {
    const [x,y]=stack[stack.length-1];
    const choices=DIRS.map(([dx,dy])=>[x+dx*2,y+dy*2,dx,dy]).filter(([nx,ny])=>nx>0&&nx<WIDTH-1&&ny>0&&ny<HEIGHT-1&&tiles[key(nx,ny)]);
    if(!choices.length) {stack.pop(); continue;}
    const [nx,ny,dx,dy]=choices[Math.floor(rng()*choices.length)];
    tiles[key(x+dx,y+dy)]=0; tiles[key(nx,ny)]=0; stack.push([nx,ny]);
  }
  // Add loops, then open every dead end so a chase always offers another route.
  for(let y=1;y<HEIGHT-1;y++) for(let x=1;x<WIDTH-1;x++) {
    if(tiles[key(x,y)] && (x%2!==y%2) && rng()<0.36) tiles[key(x,y)]=0;
  }
  for(let pass=0;pass<3;pass++) for(let y=1;y<HEIGHT-1;y++) for(let x=1;x<WIDTH-1;x++) {
    if(tiles[key(x,y)]) continue;
    const open=DIRS.filter(([dx,dy])=>tiles[key(x+dx,y+dy)]===0);
    if(open.length>1) continue;
    const walls=DIRS.filter(([dx,dy])=>x+dx*2>0&&x+dx*2<WIDTH-1&&y+dy*2>0&&y+dy*2<HEIGHT-1&&tiles[key(x+dx,y+dy)]===1&&tiles[key(x+dx*2,y+dy*2)]===0);
    if(walls.length) {const [dx,dy]=walls[Math.floor(rng()*walls.length)]; tiles[key(x+dx,y+dy)]=0;}
  }
  // Permanent, safe spawn lane; all themes have their own layout.
  for(let x=1;x<WIDTH-1;x++) tiles[key(x,HEIGHT-2)]=0;
  const gates=[];
  for(let y=3;y<HEIGHT-3;y++) for(let x=3;x<WIDTH-3;x++) {
    if(tiles[key(x,y)] && x%2!==y%2 && ((tiles[key(x-1,y)]===0&&tiles[key(x+1,y)]===0)||(tiles[key(x,y-1)]===0&&tiles[key(x,y+1)]===0))) gates.push(key(x,y));
  }
  const selected=[];
  while(gates.length && selected.length<3) selected.push(gates.splice(Math.floor(rng()*gates.length),1)[0]);
  const pellets=new Uint8Array(tiles.length);
  for(let i=0;i<tiles.length;i++) if(!tiles[i]) pellets[i]=1;
  const powers=[[1,1],[WIDTH-2,1],[1,HEIGHT-2],[WIDTH-2,HEIGHT-2]];
  for(const [x,y] of powers) pellets[key(x,y)]=2;
  pellets[key(11,HEIGHT-2)]=0;
  // Optional side-route collectible, off the spawn lane and separate from pellets.
  const candidates=[];
  for(let y=3;y<HEIGHT-3;y++)for(let x=2;x<WIDTH-2;x++)if(!tiles[key(x,y)]&&pellets[key(x,y)]===1&&Math.abs(x-11)+Math.abs(y-17)>=9&&DIRS.filter(([dx,dy])=>!tiles[key(x+dx,y+dy)]).length===2)candidates.push({x,y});
  const spot=candidates[Math.floor(rng()*candidates.length)]||{x:3,y:1};
  pellets[key(spot.x,spot.y)]=0;
  return {tiles,pellets,gates:selected,pickup:{...spot,id:POWERUPS[stage].id,collected:false},remaining:pellets.reduce((n,p)=>n+(p>0),0)};
}
export function walkable(s,x,y) { return x>=0&&y>=0&&x<WIDTH&&y<HEIGHT&&s.maze.tiles[key(x,y)]===0; }
export function neighbors(s,x,y) {return DIRS.map(([dx,dy],dir)=>({x:x+dx,y:y+dy,dir})).filter(p=>walkable(s,p.x,p.y));}
const actor=(x,y,dir=1)=>({x,y,tx:x,ty:y,dir,progress:0,duration:13,moving:false});
export function position(a) {
  const t=a.moving?a.progress/a.duration:0;
  return {x:a.x+(a.tx-a.x)*t,y:a.y+(a.ty-a.y)*t};
}
function loadStage(s) {
  s.maze=makeMaze(s.seed,s.stage);
  s.stageStart=s.tick; s.player=actor(11,HEIGHT-2); s.invulnerable=180;
  s.ghosts=[[1,1],[21,1],[1,9],[21,9]].map(([x,y],i)=>({...actor(x,y,2),kind:i,wait:90+i*60,returning:false,warning:0,charge:0}));
  s.decoy=null; s.special=null;s.power=0; s.chain=0; s.nextGate=900; s.gatesOpened=0;
}
export function createRun({seed=0x504143,ability='dash'}={}) {
  if(!Number.isInteger(seed)||seed<0||seed>0xffffffff||!['dash','decoy'].includes(ability)) throw new Error('Invalid run configuration');
  const s={version:VERSION,seed,ability,tick:0,score:0,lives:3,stage:0,clearedStages:0,pelletsEaten:0,ghostsEaten:0,combo:0,multiplier:1,lastPellet:-999,energy:600,invulnerable:180,dash:0,power:0,chain:0,transition:0,done:false,reason:'',events:[],input:4};
  loadStage(s); return s;
}
function event(s,type,data={}) {s.events.push({type,tick:s.tick,...data});}
function startMove(a,next,duration) {a.dir=next.dir; a.tx=next.x; a.ty=next.y; a.progress=a.carry||0;a.carry=0; a.duration=duration; a.moving=true;}
function advance(a,amount=1) {
  if(!a.moving) return false;
  a.progress+=amount;if(a.progress<a.duration) return false;
  a.carry=a.progress-a.duration;a.x=a.tx; a.y=a.ty; a.progress=0; a.moving=false; return true;
}
function playerMove(s) {
  const p=s.player;
  if(p.moving && s.input<4 && s.input===(p.dir+2)%4) {
    [p.x,p.tx]=[p.tx,p.x]; [p.y,p.ty]=[p.ty,p.y]; p.progress=p.duration-p.progress; p.dir=s.input;
  }
  if(!p.moving) {
    const opts=neighbors(s,p.x,p.y);
    const next=opts.find(n=>n.dir===s.input)||opts.find(n=>n.dir===p.dir);
    if(next) startMove(p,next,s.dash>0&&!specialIs(s,'steak')&&!specialIs(s,'final-form')?7:13);else p.carry=0;
  }
  if(advance(p,specialIs(s,'steak')?2:specialIs(s,'final-form')?1.5:1)) collect(s,p.x,p.y);
}
function pickSpecial(s,x,y){
  const item=s.maze.pickup;if(!item||item.collected||item.x!==x||item.y!==y)return;
  item.collected=true;
  s.special={id:item.id,ticks:SPECIAL_TICKS,charges:3,lastKnown:{x,y},echoes:[]};
  if(item.id==='mirror-check')s.special.echoes=[actor(x,y,(s.player.dir+1)%4),actor(x,y,(s.player.dir+3)%4)];
  if(['gym-pass','final-form'].includes(item.id))s.chain=0;
  if(['steak','final-form'].includes(item.id)&&s.player.moving){s.player.progress=s.player.progress/s.player.duration*13;s.player.duration=13;}
  if(['gym-pass','leg-day','mirror-check','cold-plunge','ghosted','absolute-aura','final-form'].includes(item.id))for(const g of s.ghosts){
    g.warning=0;g.charge=0;
    if(item.id==='leg-day'&&g.moving&&!g.returning){const duration=Math.max(14,19-Math.floor(s.stage/2));g.progress=g.progress/g.duration*duration;g.duration=duration;}
  }
  const spec=POWERUPS[s.stage];event(s,'special',{id:item.id,text:spec.name.toUpperCase()+' · 5 SECONDS'});
}
function collect(s,x,y) {
  pickSpecial(s,x,y);
  const k=key(x,y), kind=s.maze.pellets[k];
  if(!kind) return;
  s.maze.pellets[k]=0; s.maze.remaining--; s.pelletsEaten++;
  s.combo=s.tick-s.lastPellet<=150?s.combo+1:1; s.lastPellet=s.tick;
  s.multiplier=Math.min(5,1+Math.floor(s.combo/20));
  const points=(kind===2?50:10)*s.multiplier*(kind===1&&specialIs(s,'cheat-day')?3:1); s.score+=points;
  if(kind===2) {s.power=420; s.chain=0; event(s,'power');} else event(s,'pellet');
  if(s.combo%20===0) event(s,'combo',{text:`${s.multiplier}x COMBO`});
  if(s.maze.remaining===0) {
    s.clearedStages=s.stage+1;
    const bonus=1000*s.clearedStages;s.score+=bonus;
    event(s,'stage',{text:`LEVEL ${s.clearedStages} CLEARED +${bonus}`});
    if(s.clearedStages===LEVEL_COUNT){s.done=true;s.reason='campaign_complete';event(s,'end');}
    else s.transition=150;
  }
}
function distanceMap(s,tx,ty) {
  tx=Math.max(1,Math.min(WIDTH-2,Math.round(tx))); ty=Math.max(1,Math.min(HEIGHT-2,Math.round(ty)));
  if(!walkable(s,tx,ty)) {
    let best=Infinity,bx=1,by=1;
    for(let y=1;y<HEIGHT-1;y++) for(let x=1;x<WIDTH-1;x++) if(walkable(s,x,y)) {
      const d=Math.abs(tx-x)+Math.abs(ty-y); if(d<best) {best=d; bx=x;by=y;}
    }
    tx=bx;ty=by;
  }
  const dist=new Int16Array(WIDTH*HEIGHT).fill(30000), queue=[key(tx,ty)];dist[queue[0]]=0;
  for(let head=0;head<queue.length;head++) {
    const k=queue[head],x=k%WIDTH,y=Math.floor(k/WIDTH);
    for(const n of neighbors(s,x,y)) if(dist[key(n.x,n.y)]===30000) {dist[key(n.x,n.y)]=dist[k]+1;queue.push(key(n.x,n.y));}
  }
  return dist;
}
function ghostMove(s,g) {
  if(g.wait>0) {g.wait--;return;}
  if(g.stun>0){g.stun--;return;}
  if(!g.returning&&specialIs(s,'cold-plunge')&&s.special.ticks>180)return;
  if(g.warning>0) {if(--g.warning===0) g.charge=90;return;}
  if(!g.moving) {
    const mirror=specialIs(s,'mirror-check'),hidden=specialIs(s,'ghosted'),leg=specialIs(s,'leg-day');
    const aura=specialIs(s,'absolute-aura')&&Math.hypot(s.player.x-g.x,s.player.y-g.y)<3;
    const flee=!g.returning&&(canEat(s)||leg||aura);
    let target=hidden?s.special.lastKnown:mirror?position(s.special.echoes[g.kind%2]):s.decoy?position(s.decoy):position(s.player);
    if(g.returning) target={x:11,y:1};
    else if(!s.decoy&&!mirror&&!hidden&&!flee) {
      if(g.kind===1) {const [dx,dy]=DIRS[s.player.dir]; target={x:target.x+dx*4,y:target.y+dy*4};}
      if(g.kind===2 && Math.hypot(target.x-g.x,target.y-g.y)>5) {
        const powers=[]; for(let i=0;i<s.maze.pellets.length;i++) if(s.maze.pellets[i]===2) powers.push({x:i%WIDTH,y:Math.floor(i/WIDTH)});
        if(powers.length) target=powers[Math.floor(s.tick/420)%powers.length];
      }
      if(Math.floor((s.tick+g.kind*80)/900)%3===2) target={x:g.kind%2?21:1,y:g.kind>1?17:1};
    }
    if(g.kind===3&&!g.returning&&!canEat(s)&&!leg&&!aura&&!mirror&&!hidden&&!specialIs(s,'cold-plunge')&&g.charge===0&&s.tick%300<55) {
      if((Math.abs(target.x-g.x)<0.4||Math.abs(target.y-g.y)<0.4)&&Math.hypot(target.x-g.x,target.y-g.y)>2) {
        g.dir=Math.abs(target.x-g.x)<0.4?(target.y>g.y?2:0):(target.x>g.x?1:3);g.warning=45;event(s,'warning');return;
      }
    }
    let opts=neighbors(s,g.x,g.y);
    if(opts.length>1&&!g.returning&&!flee) opts=opts.filter(n=>n.dir!==(g.dir+2)%4);
    const distances=distanceMap(s,target.x,target.y);
    opts.sort((a,b)=>{const d=distances[key(a.x,a.y)]-distances[key(b.x,b.y)];return (flee?-d:d)||a.dir-b.dir;});
    const next=(g.charge>0?opts.find(n=>n.dir===g.dir):null)||opts[0];
    if(next) startMove(g,next,g.returning?7:leg?Math.max(14,19-Math.floor(s.stage/2)):canEat(s)?25:g.charge>0?9:Math.max(14,19-Math.floor(s.stage/2)));
    if(g.returning&&g.x===11&&g.y===1) {g.returning=false;g.wait=100;return;}
  }
  if(g.charge>0) g.charge--;
  advance(g,g.returning?1:specialIs(s,'leg-day')?2:specialIs(s,'cold-plunge')?.5:1);
}
function repel(s,g){
  const p=position(s.player),opts=neighbors(s,g.x,g.y);
  opts.sort((a,b)=>(Math.hypot(b.x-p.x,b.y-p.y)-Math.hypot(a.x-p.x,a.y-p.y))||a.dir-b.dir);
  const n=opts[0];if(n&&Math.hypot(n.x-p.x,n.y-p.y)>Math.hypot(g.x-p.x,g.y-p.y)){g.x=n.x;g.y=n.y;g.dir=n.dir;}
  g.tx=g.x;g.ty=g.y;g.progress=0;g.carry=0;g.moving=false;g.warning=0;g.charge=0;g.stun=45;
  event(s,'repel',{x:g.x,y:g.y,text:specialIs(s,'pre-workout')?'BLOCKED!':'AURA PUSH'});
}
function collide(s) {
  const p=position(s.player);
  for(const g of s.ghosts) {
    if(g.returning||g.wait>0||g.stun>0) continue;
    const q=position(g);
    if(Math.hypot(p.x-q.x,p.y-q.y)>0.69) continue;
    if(canEat(s)) {
      g.returning=true; g.warning=0;g.charge=0;
      const points=200*2**Math.min(s.chain++,3)*ghostBonus(s);s.score+=points;s.ghostsEaten++;event(s,'ghost',{x:q.x,y:q.y,points,character:CAST[g.kind].id});
    } else if(specialIs(s,'absolute-aura')||specialIs(s,'pre-workout')&&s.special.charges>0){
      repel(s,g);if(specialIs(s,'pre-workout')){s.special.charges--;if(!s.special.charges){s.special=null;event(s,'special-end');}}
    } else if(s.invulnerable===0 && s.dash===0) {
      s.lives--;s.combo=0;s.multiplier=1;s.decoy=null;s.special=null;s.player=actor(11,HEIGHT-2);s.invulnerable=180;event(s,'hit');
      if(s.lives===0) {s.done=true;s.reason='out_of_lives';event(s,'end');} break;
    }
  }
}
export function step(s,input=4) {
  if(s.done) return s;
  s.events=[]; s.tick++;
  s.input=input&7;
  for(const name of ['invulnerable','dash','power']) if(s[name]>0) s[name]--;
  if(s.special&&--s.special.ticks===0){s.special=null;event(s,'special-end');}
  s.energy=Math.min(600,s.energy+1);
  if(s.tick-s.lastPellet>150) {s.combo=0;s.multiplier=1;}
  if(s.transition>0) {if(--s.transition===0){s.stage++;loadStage(s);}}
  else {
    if((input&8)&&s.energy===600) {
      s.energy=0;
      if(s.ability==='dash') s.dash=48;
      else s.decoy={...actor(s.player.x,s.player.y,s.player.dir),ttl:240};
      event(s,'ability');
    }
    for(const d of [...(s.decoy?[s.decoy]:[]),...(s.special?.echoes||[])]) {
      if(!d.moving) {const opts=neighbors(s,d.x,d.y);const n=opts.find(n=>n.dir===d.dir)||opts.find(n=>n.dir!==(d.dir+2)%4)||opts[0];if(n)startMove(d,n,12);}
      advance(d);if(d===s.decoy&&--d.ttl===0)s.decoy=null;
    }
    // Shortcuts only open. No gate can close on a character or strand a pellet.
    const elapsed=s.tick-s.stageStart;
    if(s.gatesOpened<s.maze.gates.length&&elapsed===s.nextGate-180) event(s,'gate-warning',{text:'SHORTCUT OPENS IN 3'});
    if(s.gatesOpened<s.maze.gates.length&&elapsed>=s.nextGate) {
      s.maze.tiles[s.maze.gates[s.gatesOpened++]]=0;s.nextGate+=900;event(s,'gate',{text:'NEW SHORTCUT OPEN'});
    }
    playerMove(s);
    // The last pellet wins the level before a ghost can take another life.
    if(!s.done&&!s.transition){for(const g of s.ghosts) ghostMove(s,g);collide(s);}
  }
  return s;
}
