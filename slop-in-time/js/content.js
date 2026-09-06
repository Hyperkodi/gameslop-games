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
  const pairs=[['pipe','bat'],['saber','anchor'],['club','spear'],['staff','katana'],['wrench','hammer'],['blade','coil']];
  const stories=[
    ['The arcade clocks stopped at midnight. Someone stole the next day.','Volt has sealed the skyrail. Take the service alley south.','His substation powers the time rift. Pull the plug.'],
    ['The rift spits you into 1712. Brassjaw has your stolen clock core.','The main pier is burning. Follow the lower wharf around it.','That ship is leaving with tomorrow aboard. Stop its captain.'],
    ['Wrong century. Very wrong century. The clock core woke the valley.','The bone bridge has collapsed. Head down through the fern ravine.','King Fossil is guarding the rift. Make extinction wait.'],
    ['The Iron Ronin mistook the clock core for a fallen star.','The castle gate is barred. Turn south through the moon garden.','He will not surrender the star. You will have to earn it.'],
    ['Boiler Bill is feeding stolen time into his runaway locomotive.','The railway is blocked. Take the lower maintenance crossing.','One last train. One very large wrench. End this ride.'],
    ['Every stolen second leads here: the Timekeeper’s foundry.','The assembly line is locked. Follow the coolant channel south.','Break the Timekeeper. Give everyone their tomorrow back.']
  ];
  function configure(stages){stages.forEach((s,i)=>{s.weapons=pairs[i];s.story=stories[i];s.flyer=['Shock drone','Powder parrot','Pterodactyl','Tengu','Steam gyrocopter','Rift sentry'][i];s.trap=['steam','cannon','spikes','arrows','rail','laser'][i];s.turns=[2,5].map((gate,n)=>({x:s.encounters[gate]+355,end:s.encounters[gate]+555,drop:300,offset:n*300}));});}
  function bounds(stage,x){let offset=0;for(const t of stage.turns){if(x<t.x)break;if(x<=t.end)return {min:335+offset,max:487+offset+t.drop};offset+=t.drop;}return {min:335+offset,max:487+offset};}
  function floor(stage,x){return bounds(stage,x).min-335;}
  function walkable(stage,x,y){const b=bounds(stage,x);return y>=b.min&&y<=b.max;}
  function nextTurn(stage,p){return stage.turns.find(t=>p.x<t.end+35&&p.x>t.x-160&&p.y<335+t.offset+t.drop+28);}
  const api={weapons,configure,bounds,floor,walkable,nextTurn};root.SlopTimeContent=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
