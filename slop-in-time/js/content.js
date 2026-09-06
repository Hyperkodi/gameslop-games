(function(root){
  'use strict';
  const weapons={
    pipe:{name:'Steel pipe',reach:108,damage:23,hits:22,speed:1},bat:{name:'Street bat',reach:120,damage:27,hits:18,speed:1.08},
    saber:{name:'Boarding saber',reach:118,damage:25,hits:24,speed:.88},anchor:{name:'Deck anchor',reach:105,damage:38,hits:14,speed:1.4},
    club:{name:'Bone club',reach:112,damage:29,hits:20,speed:1.1},spear:{name:'Obsidian spear',reach:160,damage:22,hits:24,speed:1},
    staff:{name:'Bo staff',reach:150,damage:21,hits:30,speed:.86},katana:{name:'Moon katana',reach:128,damage:30,hits:18,speed:.88},
    wrench:{name:'Rail wrench',reach:105,damage:30,hits:22,speed:1.08},hammer:{name:'Boiler hammer',reach:112,damage:40,hits:12,speed:1.45},
    blade:{name:'Plasma blade',reach:135,damage:28,hits:24,speed:.88},coil:{name:'Arc baton',reach:118,damage:25,hits:26,speed:.8}
  };
  Object.assign(weapons,{chain:{name:'Street chain',reach:145,damage:33,hits:20,speed:1.15},trident:{name:'Coral trident',reach:165,damage:40,hits:21,speed:1.1},axe:{name:'Obsidian axe',reach:120,damage:46,hits:17,speed:1.25},naginata:{name:'Storm naginata',reach:175,damage:50,hits:22,speed:1.12},pickaxe:{name:'Railbreaker pick',reach:130,damage:56,hits:18,speed:1.3},photon:{name:'Photon hammer',reach:145,damage:64,hits:20,speed:1.25}});
  const pairs=[['pipe','bat','chain'],['saber','anchor','trident'],['club','spear','axe'],['staff','katana','naginata'],['wrench','hammer','pickaxe'],['blade','coil','photon']];
  // Later-era equipment keeps pace with sturdier enemies.
  pairs.forEach((ids,era)=>ids.slice(0,2).forEach(id=>weapons[id].damage=Math.round(weapons[id].damage*(1+era*.12))));
  const foods={hotdog:{name:'Hot dog',heal:15},pizza:{name:'Pizza',heal:25},burger:{name:'Hamburger',heal:35},ramen:{name:'Ramen',heal:50}};
  const enemyKinds=['grunt','guard','swift','thrower','flyer'];
  const rosters=[['Street punk','Riot shield','Volt runner','Arc skater','Shock drone'],['Deckhand','Shell guard','Boarding raider','Powder gunner','Powder parrot'],['Raptor','Armored saurian','Leaping hunter','Venom spitter','Pterodactyl'],['Shinobi','Iron guard','Shadow jumper','Shuriken adept','Tengu'],['Outlaw','Boiler guard','Dynamite runner','Gunslinger','Steam gyrocopter'],['Sentinel','Aegis unit','Blink striker','Pulse lancer','Rift sentry']];
  function configure(stages){stages.forEach((s,i)=>{
    s.weapons=pairs[i];s.enemies=enemyKinds.map((kind,n)=>({kind,name:rosters[i][n]}));s.flyer=rosters[i][4];s.traps=[['steam','puddle'],['cannon','cargo'],['rockfall','geyser'],['darts','gate'],['cart','boiler'],['press','arc']][i];s.trap=s.traps[0];
    const plans=[[1,4],[2,6],[1,3,6],[0,4,7],[2,5],[1,5,7]][i];let offset=0;
    s.turns=plans.map((gate,n)=>{const drop=[150,190,130,170,145,160][i]*(n%2? .8:1),t={x:s.encounters[gate]+350,end:s.encounters[gate+1]-345,drop,offset};offset+=drop;return t;});s.depth=offset;
  });}
  function floor(stage,x){let offset=0;for(const t of stage.turns){if(x<t.x)break;if(x<t.end){const u=(x-t.x)/(t.end-t.x);return offset+t.drop*u*u*(3-2*u);}offset+=t.drop;}return offset;}
  function bounds(stage,x){const offset=floor(stage,x);return {min:335+offset,max:487+offset};}
  function walkable(stage,x,y){const b=bounds(stage,x);return y>=b.min&&y<=b.max;}
  function nextTurn(stage,p){return stage.turns.find(t=>p.x<t.end&&p.x>t.x-100);}
  function trapArea(t){const u=Math.max(0,Math.min(1,((t.clock||0)-3.3)/1.2)),moving=['cannon','cart','darts'].includes(t.kind);return {x:t.x+(moving?-70+u*140:t.kind==='cargo'?Math.sin(u*Math.PI*2)*40:0),rx:moving?22:t.kind==='cargo'?29:['puddle','arc'].includes(t.kind)?70:45,ry:27,height:['steam','boiler','geyser','rockfall','cargo','gate','press'].includes(t.kind)?200:40};}
  const api={trapArea,weapons,foods,enemyKinds,configure,bounds,floor,walkable,nextTurn};root.SlopTimeContent=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
