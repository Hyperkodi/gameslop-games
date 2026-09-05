(function (root) {
  'use strict';
  const themes = {
    jungle: { sky: '#102c30', far: '#174446', mid: '#18504a', leaf: '#277163', light: '#69a174', soil: '#243736', edge: '#8ab382', glow: '#b7ce8b' },
    base: { sky: '#111d2b', far: '#182d40', mid: '#243e50', leaf: '#3c6271', light: '#759a98', soil: '#1e303c', edge: '#738d98', glow: '#71ccdc' },
    water: { sky: '#142c3c', far: '#1e4051', mid: '#285e68', leaf: '#3f8182', light: '#92cbba', soil: '#334b51', edge: '#91bab0', glow: '#a6e5de' },
    snow: { sky: '#243d53', far: '#385b6c', mid: '#537481', leaf: '#7095a0', light: '#d6e5df', soil: '#4f6470', edge: '#e6eeea', glow: '#c5e0d9' },
    foundry: { sky: '#291f28', far: '#442e37', mid: '#614344', leaf: '#7d5d51', light: '#c39575', soil: '#473d40', edge: '#b68e68', glow: '#ff9c51' },
    cave: { sky: '#191d36', far: '#292b49', mid: '#40385e', leaf: '#5e5479', light: '#927dab', soil: '#373445', edge: '#9181a5', glow: '#c89de9' },
    alien: { sky: '#251826', far: '#432a43', mid: '#62314e', leaf: '#8b4262', light: '#b87885', soil: '#42303f', edge: '#b98595', glow: '#fb718e' },
  };
  function createRenderer({ canvas }) {
    const c = canvas.getContext('2d', { alpha: false }); canvas.width = 960; canvas.height = 540; c.imageSmoothingEnabled = false;
    const hero = root.SlopCommando.createMascotRenderer(c, root.SlopCommandoSkin);
    const arsenal = root.SlopCommando.createWeaponArt(c, root.SlopCommandoSkin.weapons);
    const environment = root.SlopCommando.createEnvironmentRenderer(c, root.SlopCommandoSkin, themes);
    const rect = (x,y,w,h,color) => { c.fillStyle = color; c.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h)); };
    function poly(points, color) { c.fillStyle=color; c.beginPath(); points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y)); c.closePath(); c.fill(); }
    function text(value,x,y,size=12,color='#f5ecd9',align='left') { c.fillStyle=color; c.font=`bold ${size}px monospace`; c.textAlign=align; c.fillText(value,Math.round(x),Math.round(y)); c.textAlign='left'; }
    function tree(x,y,scale,t) {
      rect(x-5*scale,y,12*scale,180*scale,t.far);
      poly([[x,y-75*scale],[x-75*scale,y+25*scale],[x+64*scale,y+18*scale]],t.mid);
      poly([[x,y-44*scale],[x-94*scale,y+55*scale],[x+82*scale,y+44*scale]],t.leaf);
      poly([[x,y-44*scale],[x-5*scale,y+18*scale],[x-94*scale,y+55*scale]],t.mid);
    }
    function background(s,time) {
      const l=s.level,t=themes[l.theme],cx=s.camera.x,cy=s.camera.y;
      rect(0,0,960,540,t.sky);
      const grad=c.createLinearGradient(0,0,0,540);grad.addColorStop(0,t.sky);grad.addColorStop(1,t.mid);c.fillStyle=grad;c.fillRect(0,0,960,540);
      rect(735-cx*.035,60,66,66,l.theme==='alien'?'#a25570':'#aec5ad');
      for(let i=0;i<9;i++) {
        let x=(i*211-cx*.12)%1300-180;
        poly([[x,370],[x+110,120+(i%3)*27],[x+240,370]],t.far);
        if(l.theme==='snow')poly([[x+110,120+(i%3)*27],[x+65,220],[x+115,195],[x+150,220]],t.light);
      }
      if(['jungle','water','snow'].includes(l.theme)) {
        for(let i=0;i<15;i++){let x=(i*143-cx*.3)%1200-100;tree(x,185+(i%3)*40-cy*.08,.8+(i%3)*.3,t);}
        for(let i=0;i<10;i++){let x=(i*197-cx*.55)%1300-120;tree(x,300+(i%2)*40,1.25,t);}
        if(l.theme==='jungle')for(let i=0;i<8;i++) {
          const x=(i*177-cx*.65)%1300-100;
          rect(x,180,13,280,t.far);
          poly([[x+8,196],[x-80,213],[x-61,180],[x-25,173],[x+8,191],[x+56,154],[x+86,170],[x+31,200]],t.leaf);
          poly([[x+7,184],[x-18,135],[x-39,119],[x-45,154],[x,193],[x+25,131],[x+51,119],[x+45,163]],t.mid);
          for(let j=0;j<7;j++)rect(x+2,220+j*28,8,3,t.mid);
        }
      } else {
        for(let i=0;i<12;i++) {
          const x=(i*133-cx*.28)%1250-100,h=100+(i*73)%170;
          if(l.theme==='cave'||l.theme==='alien') {
            poly([[x,0],[x+80,0],[x+35,h]],t.mid);poly([[x,540],[x+100,540],[x+45,540-h]],t.mid);
            rect(x+35,80,4,45,t.leaf);
          } else {rect(x,380-h,80,h,t.mid);rect(x+15,330-h,15,55,t.mid);for(let j=0;j<4;j++)rect(x+12+j*15,400-h,5,15,t.light);}
        }
      }
      if(l.theme==='water') for(let i=0;i<3;i++) {
        const x=155+i*305;rect(x,0,85,540,'#356f7b');rect(x+15,0,9,540,'#72b9bd');rect(x+60,0,6,540,'#86c7c6');
        for(let j=0;j<15;j++)rect(x+8,((j*71+time*120)%600)-50,65,2,'#9bcecb');
      }
      if(l.mode==='run') {
        rect(0,467,960,73,l.theme==='foundry'?'#b6462e':t.sky);
        for(let i=0;i<35;i++)rect((i*71-time*23-cx*.6)%1050,474+(i%7)*10,30+(i%4)*10,2,t.mid);
      }
      if(l.theme==='snow')for(let i=0;i<65;i++)rect((i*107+time*15)%970,(i*59+time*32)%540,2,2,'#ccdfdb');
      if(l.theme==='alien'||l.theme==='foundry')for(let i=0;i<20;i++)rect((i*157-time*13)%1000,540-(i*39+time*24)%550,2,3,t.glow);
      // Atmospheric horizon mist, kept behind playable silhouettes.
      const fog=c.createLinearGradient(0,290,0,465);fog.addColorStop(0,'#b5d6ae00');fog.addColorStop(1,l.theme==='jungle'?'#a1c89b25':'#cadde510');c.fillStyle=fog;c.fillRect(0,290,960,175);
    }
    function terrain(s) {
      const t=themes[s.level.theme];
      for(const p of s.level.platforms) {
        if(p.x+p.w<s.camera.x||p.x>s.camera.x+960||p.y>s.camera.y+540||p.y+p.h<s.camera.y)continue;
        environment.platform(p,s.level.theme,s.camera);
      }
      for(const h of s.level.hazards) {
        rect(h.x-4,h.y+h.h-9,36,9,'#151c24');
        if((s.tick+h.phase)%240>120){for(let i=0;i<4;i++)poly([[h.x+i*7,h.y+h.h],[h.x+i*7+6,h.y-8+Math.sin(s.tick+i)*8],[h.x+i*7+12,h.y+h.h]],i%2?'#ffbf58':'#f66335');}
        else {rect(h.x+9,h.y+h.h-5,10,3,'#ff9348');}
      }
    }
    function baseRoom(s,time) {
      const t=themes[s.level.theme];rect(0,0,960,540,t.sky);
      poly([[0,0],[960,0],[810,210],[150,210]],t.far);
      poly([[0,540],[960,540],[810,210],[150,210]],t.soil);
      poly([[0,0],[150,210],[150,540],[0,540]],t.mid);poly([[960,0],[810,210],[810,540],[960,540]],t.mid);
      for(let i=0;i<9;i++){c.strokeStyle=t.mid;c.beginPath();c.moveTo(150+i*82,210);c.lineTo(-100+i*145,540);c.stroke();}
      for(let i=0;i<9;i++)rect(0,210+i*i*5,960,1,t.mid);
      rect(168,64,624,157,'#101a24');rect(176,73,608,140,t.mid);
      for(let i=0;i<7;i++){rect(193+i*83,86,65,118,t.far);rect(202+i*83,94,3,93,t.leaf);}
      for(const x of [45,875]){rect(x,90,35,340,t.far);rect(x+12,105,8,295,t.glow);}
      text('SECTOR '+String(s.room+1).padStart(2,'0')+' / 03',480,49,18,t.light,'center');
      rect(130,233,700,4,'#ff5842');
      for(let i=0;i<24;i++)rect(135+i*29,235,15,3,Math.sin(time*4)>.2?'#fbc67b':'#ab4135');
    }
    // Enemies stay vector-drawn so their action reads at arcade scale, but each one gets a
    // real silhouette instead of a stack of rectangles. Their art is deliberately allowed
    // to overhang the fixed engine hitboxes; no gameplay values live in this renderer.
    function oval(x,y,rx,ry,fill,edge,width=1) {
      c.beginPath();c.ellipse(Math.round(x),Math.round(y),rx,ry,0,0,Math.PI*2);c.fillStyle=fill;c.fill();
      if(edge){c.strokeStyle=edge;c.lineWidth=width;c.stroke();}
    }
    function outlined(points,fill,edge='#071219',width=1) {
      poly(points,fill);
      if(edge){c.strokeStyle=edge;c.lineWidth=width;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.stroke();}
    }
    function line(x1,y1,x2,y2,color,width=1) {c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.stroke();}
    function curve(x1,y1,cx1,cy1,cx2,cy2,x2,y2,color,width=1) {c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.moveTo(x1,y1);c.bezierCurveTo(cx1,cy1,cx2,cy2,x2,y2);c.stroke();}
    function palette(theme,flash) {
      const t=themes[theme]||themes.jungle;
      const shell={jungle:'#52766d',base:'#537988',water:'#4e8285',snow:'#7c9398',foundry:'#896953',cave:'#685a86',alien:'#974a6b'}[theme]||'#587580';
      return {t,ink:'#071217',shadow:'#14242b',frame:'#263c45',shell:flash?'#fff3ce':shell,plate:flash?'#fff8df':t.light,trim:t.glow,hot:'#ff704d',glass:theme==='alien'?'#ff8fab':theme==='foundry'?'#ffc06d':'#91e9e1'};
    }
    function rivet(x,y,color='#d8e5d1') {oval(x,y,1.35,1.35,color,'#17242a',.6);}
    function drawSoldier(e,time,theme,flash) {
      const p=palette(theme,flash),stride=Math.sin(time*10+(e.phase||0)*7)*1.7,dir=e.vx>0?1:-1;
      c.save();c.translate(e.x+16,e.y);c.scale(dir,1);
      oval(0,35,15,2,p.ink);
      outlined([[-8,24],[-2,24],[-2+stride,34],[-10+stride,34],[-12,31]],p.shadow);
      outlined([[3,24],[9,24],[12-stride,34],[4-stride,34],[1,30]],p.frame);
      rect(-11+stride,32,10,4,'#0a151a');rect(3-stride,32,10,4,'#0a151a');
      outlined([[-9,15],[-4,11],[8,12],[12,19],[8,27],[-10,26]],p.shell);
      outlined([[-7,17],[6,16],[7,25],[-6,24]],p.frame,'#142129');
      line(-3,17,4,25,p.trim,1);rect(-1,20,8,2,p.hot);rivet(-7,18,p.plate);rivet(6,19,p.plate);
      outlined([[-7,13],[-12,16],[-10,24],[-3,23],[-2,16]],p.plate);
      outlined([[4,15],[11,17],[18,20],[15,24],[6,21]],p.plate);
      outlined([[11,17],[33,15],[35,19],[16,22]],p.frame);
      rect(22,14,17,5,p.ink);rect(36,15,6,3,p.shell);rect(27,13,6,2,p.trim);oval(41,16.5,2,2,p.hot);
      outlined([[3,6],[7,7],[9,14],[4,18],[-5,16],[-6,9],[-2,5]],p.plate);
      oval(1,10,6,6,flash?'#fff9e7':'#bc8a6c','#0c1b20');
      outlined([[-7,9],[-4,2],[4,0],[10,4],[9,10],[2,8],[-6,11]],p.shell);
      rect(-5,10,12,3,'#102229');rect(-1,10,5,2,p.glass);line(-7,9,9,9,p.ink,1);
      outlined([[-11,15],[-7,13],[-5,23],[-10,25],[-14,20]],p.frame);rect(-12,16,4,6,p.trim);
      c.restore();
    }
    function drawTurret(e,time,theme,flash) {
      const p=palette(theme,flash),dir=e.vx>0?1:-1,bob=Math.sin(time*5+(e.phase||0))*1.2;
      c.save();c.translate(e.x+16,e.y);c.scale(dir,1);
      oval(0,35,19,2,p.ink);
      outlined([[-11,29],[-5,29],[-12,35],[-17,35]],p.frame);outlined([[9,29],[14,29],[18,35],[12,35]],p.frame);outlined([[-2,28],[4,28],[4,35],[-3,35]],p.shell);
      oval(0,27,14,7,p.shadow,'#071219');rect(-11,25,22,5,p.frame);rivet(-7,27,p.plate);rivet(7,27,p.plate);
      outlined([[-12,14],[-8,8],[3,6],[12,11],[13,20],[7,26],[-9,24],[-14,19]],p.shell);
      oval(1,16+bob,8,7,p.frame,'#0a171c');oval(3,16+bob,4,4,p.glass,'#102027');oval(4,15+bob,1.3,1.3,'#f6ffe5');
      outlined([[8,14+bob],[33,11+bob],[36,16+bob],[9,20+bob]],p.frame);rect(28,12+bob,12,4,p.ink);rect(38,13+bob,6,2,p.shell);oval(45,14+bob,2.2,2.2,p.hot);
      outlined([[-5,7],[-2,2],[7,4],[8,9]],p.plate);line(1,4,1,-2,p.trim,1);oval(1,-3,1.5,1.5,p.hot);
      line(-9,19,-18,24,p.trim,1);line(-8,21,-15,28,p.trim,1);rivet(-7,12,p.plate);rivet(8,18,p.plate);
      c.restore();
    }
    function drawDrone(e,time,theme,flash) {
      const p=palette(theme,flash),spin=time*22+(e.phase||0)*5,dir=e.vx>0?1:-1;
      c.save();c.translate(e.x+16,e.y+17+Math.sin(time*5+(e.phase||0))*1.5);c.scale(dir,1);
      oval(0,18,19,2,'#071319');
      line(-6,-2,-20,-10,p.frame,2);line(6,-2,20,-10,p.frame,2);line(-7,4,-19,11,p.frame,2);line(7,4,19,11,p.frame,2);
      for(const [px,py] of [[-20,-10],[20,-10],[-19,11],[19,11]]) {
        oval(px,py,6,3,p.shell,'#09151b');
        line(px-7*Math.cos(spin+py),py-3*Math.sin(spin+px),px+7*Math.cos(spin+py),py+3*Math.sin(spin+px),p.trim,1);
      }
      outlined([[-10,-7],[-4,-12],[8,-10],[13,-3],[9,7],[0,10],[-10,5],[-13,-2]],flash?'#fff6d7':p.frame);
      oval(3,-1,8,7,p.shell,'#0a171c');oval(6,-1,4.5,4.5,p.glass,'#102027');oval(7,-2,1.4,1.4,'#f7fff1');
      outlined([[1,8],[8,8],[6,14],[-1,14]],p.shadow);oval(3,14,3,2,p.hot);line(-5,-10,-3,-16,p.trim,1);oval(-3,-17,1.5,1.5,p.hot);
      c.restore();
    }
    function drawCore(e,time,theme,flash) {
      const p=palette(theme,flash),pulse=1+Math.sin(time*6+(e.phase||0))*1.5;
      c.save();c.translate(e.x+21,e.y+27);
      oval(0,29,29,4,'#071217');
      line(-20,-21,-27,-6,p.frame,4);line(20,-21,27,-6,p.frame,4);line(-22,5,-27,20,p.frame,4);line(22,5,27,20,p.frame,4);
      outlined([[-18,-24],[-7,-30],[12,-28],[22,-16],[22,15],[12,28],[-10,27],[-21,15],[-22,-13]],p.frame);
      oval(0,0,19,23,flash?'#fff5d4':p.shell,'#09151b',2);oval(0,0,14,17,p.shadow,p.trim,1);
      oval(0,0,10+pulse,12+pulse,flash?'#fff9e8':'#d84343','#351b26',2);oval(0,0,5+pulse*.25,7+pulse*.25,'#ffbd77');oval(1,-2,2,3,'#fff5cf');
      for(let i=0;i<8;i++){const a=i*Math.PI/4;oval(Math.cos(a)*22,Math.sin(a)*25,2,2,p.plate,'#0d1b20');}
      rect(-11,-28,22,4,p.trim);line(-14,23,-17,31,p.hot,2);line(14,23,17,31,p.hot,2);
      c.restore();
    }
    function drawCrawler(e,time,theme,flash) {
      const p=palette(theme,flash),dir=e.vx>0?1:-1,step=Math.sin(time*12+(e.phase||0))*2;
      c.save();c.translate(e.x+16,e.y);c.scale(dir,1);
      oval(0,35,19,2,p.ink);
      for(const x of [-10,0,10]){line(x,25,x-5,34+step,p.frame,3);line(x,26,x+6,34-step,p.frame,3);}
      outlined([[-15,17],[-8,9],[8,9],[15,17],[11,26],[-12,26]],flash?'#fff3d1':p.shell);
      oval(8,16,6,5,p.frame,'#0b181d');oval(10,16,2.7,2.7,p.glass);outlined([[12,15],[29,13],[31,17],[14,20]],p.frame);oval(32,15,2,2,p.hot);
      for(const x of [-8,1,9])rivet(x,13,p.plate);c.restore();
    }
    function drawTankBoss(e,time,theme,flash) {
      const p=palette(theme,flash),x=e.x,y=e.y,smoke=Math.sin(time*3)*4;
      oval(x+65,y+146,88,7,'#081319');
      outlined([[x-8,y+105],[x+16,y+95],[x+128,y+98],[x+145,y+112],[x+137,y+139],[x+8,y+140],[x-16,y+126]],p.shadow,'#071217',2);
      outlined([[x+4,y+107],[x+132,y+109],[x+137,y+130],[x+8,y+132],[-1+x,y+123]],p.frame);
      for(let i=0;i<5;i++){oval(x+16+i*25,y+124,10,10,'#0b171d',p.plate,1);oval(x+16+i*25,y+124,4,4,p.shell,'#061116');}
      outlined([[x+8,y+73],[x+29,y+53],[x+109,y+55],[x+132,y+75],[x+122,y+108],[x+30,y+111],[x+4,y+96]],flash?'#fff2d2':p.shell,'#071217',2);
      outlined([[x+35,y+47],[x+49,y+25],[x+101,y+28],[x+118,y+48],[x+104,y+73],[x+48,y+73]],p.frame,'#071217',2);
      outlined([[x+45,y+43],[x-20,y+39],[x-28,y+48],[x+49,y+55]],p.frame,'#071217',2);rect(x-39,y+42,24,7,p.shadow);rect(x-43,y+44,7,3,p.shell);oval(x-45,y+45.5,3,3,p.hot);
      oval(x+76,y+48,18,12,'#112229','#061015',2);oval(x+70,y+48,8,7,p.glass,'#092028');oval(x+72,y+46,2,2,'#f5ffe5');
      for(const [dx,dy] of [[22,80],[49,93],[111,83],[118,102]])rivet(x+dx,y+dy,p.plate);
      rect(x+96,y+37,13,23,p.shadow);oval(x+102,y+33+smoke,8,5,'#35494b');oval(x+106,y+25+smoke,5,4,'#5b7268');
      poly([[x+15,y+74],[x+29,y+63],[x+39,y+75],[x+21,y+83]],p.t.leaf);poly([[x+112,y+70],[x+128,y+58],[x+132,y+77]],p.t.leaf);
    }
    function drawWatchtowerBoss(e,time,theme,flash) {
      const p=palette(theme,flash),x=e.x,y=e.y,sweep=Math.sin(time*2.2+(e.phase||0))*4;
      oval(x+65,y+146,95,6,'#071217');
      for(const side of [-1,1]) {
        const ax=x+65+side*38;
        line(ax,y+88,ax+side*31,y+137,p.frame,8);line(ax+side*28,y+135,ax+side*46,y+140,p.shell,7);
        oval(ax+side*46,y+140,12,4,p.shadow,'#071217');line(ax,y+87,ax+side*23,y+114,p.plate,2);
      }
      outlined([[x+31,y+42],[x+48,y+19],[x+87,y+17],[x+108,y+43],[x+103,y+100],[x+84,y+119],[x+44,y+116],[x+27,y+95]],flash?'#fff4d5':p.shell,'#071217',2);
      outlined([[x+42,y+49],[x+54,y+34],[x+84,y+34],[x+96,y+51],[x+90,y+86],[x+48,y+86]],p.frame);
      oval(x+69,y+56,17,15,'#0a1920',p.trim,2);oval(x+69+sweep,y+56,9,9,p.glass,'#0a1a20');oval(x+72+sweep,y+53,2.5,2.5,'#f6ffea');
      outlined([[x+45,y+52],[x-22,y+48],[x-30,y+57],[x+48,y+64]],p.frame,'#071217',2);rect(x-42,y+51,18,6,p.shadow);oval(x-45,y+54,3,3,p.hot);
      line(x+50,y+89,x+46,y+109,p.trim,3);line(x+88,y+89,x+92,y+109,p.trim,3);rect(x+57,y+96,24,10,p.shadow);rect(x+61,y+98,16,3,p.hot);
      line(x+68,y+20,x+68,y-12,p.plate,2);line(x+68,y-12,x+87,y-21,p.plate,2);oval(x+88,y-21,3,3,p.hot);rivet(x+37,y+68,p.plate);rivet(x+101,y+69,p.plate);
    }
    function drawUndertowBoss(e,time,theme,flash) {
      const p=palette(theme,flash),x=e.x,y=e.y,spin=time*13+(e.phase||0)*4;
      oval(x+67,y+112,100,6,'#07151b');
      outlined([[x-25,y+67],[x+9,y+37],[x+79,y+27],[x+137,y+47],[x+163,y+71],[x+132,y+93],[x+57,y+101],[x+5,y+91]],flash?'#fff5d6':p.shell,'#071217',2);
      outlined([[x+24,y+52],[x+70,y+37],[x+125,y+52],[x+131,y+75],[x+75,y+89],[x+31,y+78]],p.frame);
      oval(x+13,y+68,24,24,p.shadow,p.plate,2);oval(x+13,y+68,15,15,p.glass,'#092027');
      for(let i=0;i<6;i++){const a=spin+i*Math.PI/3;line(x+13,y+68,x+13+Math.cos(a)*13,y+68+Math.sin(a)*13,p.plate,2);}
      oval(x+79,y+63,22,17,'#10232a','#061217',2);oval(x+73,y+61,10,9,p.glass,'#0b1c25');oval(x+76,y+58,2.5,2.5,'#f7fff0');
      for(const dx of [112,141]){oval(x+dx,y+68,15,20,p.frame,'#071217');oval(x+dx,y+68,9,14,p.shell,'#0b181d');line(x+dx,y+48,x+dx,y+87,p.trim,2);}
      outlined([[x+34,y+88],[x+52,y+97],[x+111,y+96],[x+127,y+86],[x+116,y+108],[x+45,y+108]],p.shadow);
      for(const dx of [39,107])line(x+dx,y+98,x+dx-7,y+118,p.plate,3);
      line(x+136,y+48,x+149,y+31,p.trim,2);oval(x+150,y+29,3,3,p.hot);
    }
    function drawOverseerBoss(e,time,theme,flash) {
      const p=palette(theme,flash),x=e.x,y=e.y,heat=1+Math.sin(time*8)*.16;
      oval(x+66,y+144,85,5,'#071217');
      outlined([[x-30,y-14],[x+163,y-14],[x+172,y-4],[x-39,y-4]],p.frame,'#071217',2);
      for(const dx of [5,126]){line(x+dx,y-5,x+dx+8,y+37,p.plate,3);oval(x+dx+8,y+40,4,4,p.hot);}
      line(x+30,y-5,x+35,y+51,p.trim,2);line(x+101,y-5,x+96,y+51,p.trim,2);
      outlined([[x+19,y+51],[x+39,y+35],[x+99,y+35],[x+119,y+54],[x+111,y+111],[x+92,y+127],[x+41,y+123],[x+21,y+106]],flash?'#fff1cf':p.shell,'#071217',2);
      oval(x+69,y+75,31,32,p.frame,'#09151b',2);oval(x+69,y+75,23,25,'#6c342f','#211719',2);oval(x+69,y+77,15*heat,17*heat,'#ff753d','#652525',2);rect(x+59,y+69,20,4,'#ffce76');
      for(const side of [-1,1]){
        line(x+28+side*2,y+76,x+7+side*22,y+104,p.frame,7);line(x+7+side*22,y+104,x+18+side*30,y+120,p.plate,5);oval(x+18+side*30,y+121,9,5,p.shadow,'#071217');
      }
      outlined([[x+31,y+60],[x-19,y+55],[x-25,y+63],[x+37,y+71]],p.frame,'#071217',2);rect(x-35,y+58,17,5,p.shadow);oval(x-38,y+60.5,3,3,p.hot);
      for(const dx of [44,92]){rect(x+dx,y+19,12,25,p.frame);rect(x+dx+3,y+22,6,20,p.trim);oval(x+dx+6,y+16,8,5,'#5e5d52');}
      rivet(x+32,y+91,p.plate);rivet(x+106,y+91,p.plate);
    }
    function drawFrostbiteBoss(e,time,theme,flash) {
      const p=palette(theme,flash),x=e.x,y=e.y,step=Math.sin(time*4+(e.phase||0))*7;
      oval(x+65,y+149,100,6,'#0a171d');
      for(const [dx,phase] of [[22,1],[49,-1],[91,-1],[117,1]]) {
        const hipY=y+91,kneeX=x+dx+step*phase*.35,kneeY=y+116,footX=x+dx+step*phase;
        line(x+dx,y+88,kneeX,kneeY,p.frame,10);line(kneeX,kneeY,footX,y+142,p.shell,9);oval(footX,y+144,13,5,p.shadow,'#071217');line(kneeX,kneeY,footX,y+142,p.trim,2);
      }
      outlined([[x+12,y+44],[x+34,y+25],[x+102,y+27],[x+129,y+47],[x+122,y+91],[x+96,y+105],[x+35,y+102],[x+7,y+78]],flash?'#fff8e7':p.shell,'#071217',2);
      outlined([[x+33,y+47],[x+59,y+33],[x+104,y+45],[x+111,y+72],[x+87,y+88],[x+40,y+81]],p.frame);
      outlined([[x+36,y+52],[x-23,y+48],[x-35,y+61],[x+39,y+67]],p.frame,'#071217',2);rect(x-46,y+52,17,7,p.shadow);oval(x-49,y+55,3,3,p.glass);
      oval(x+77,y+59,15,11,'#10242b','#061217',2);oval(x+72,y+58,7,6,p.glass,'#0c222c');oval(x+74,y+56,2,2,'#ffffff');
      outlined([[x+7,y+74],[x-12,y+83],[x+12,y+91],[x+28,y+80]],p.plate,'#071217',1);line(x+49,y+27,x+45,y+8,p.trim,2);line(x+94,y+29,x+101,y+10,p.trim,2);oval(x+45,y+7,2,2,p.glass);oval(x+102,y+9,2,2,p.glass);
      for(const [dx,dy] of [[29,74],[52,88],[105,74]])rivet(x+dx,y+dy,p.plate);
    }
    function drawCrucibleBoss(e,time,theme,flash) {
      const p=palette(theme,flash),x=e.x,y=e.y,flame=Math.sin(time*14)*6;
      oval(x+66,y+147,95,6,'#071217');
      outlined([[x-9,y+105],[x+141,y+105],[x+153,y+121],[x+142,y+141],[x-1,y+141],[x-17,y+123]],p.shadow,'#071217',2);
      for(const dx of [14,54,100,132]){oval(x+dx,y+126,13,13,'#0a151a',p.plate,2);oval(x+dx,y+126,5,5,p.hot,'#25151b');}
      outlined([[x+5,y+70],[x+24,y+48],[x+112,y+49],[x+135,y+73],[x+130,y+108],[x+22,y+111],[x+2,y+93]],flash?'#fff1cf':p.shell,'#071217',2);
      oval(x+76,y+77,43,33,p.frame,'#071217',2);oval(x+76,y+77,34,27,'#6a3730','#2a1b20',2);
      oval(x+62,y+78,16,18,'#191c20','#0a1216',2);oval(x+62,y+78,10,12,p.hot,'#572127',2);rect(x+55,y+72,14,3,'#ffcf72');
      outlined([[x+28,y+67],[x-22,y+61],[x-30,y+71],[x+30,y+80]],p.frame,'#071217',2);rect(x-44,y+65,19,7,p.shadow);oval(x-47,y+68,3,3,p.hot);
      for(const dx of [100,116]){outlined([[x+dx,y+51],[x+dx+16,y+51],[x+dx+14,y+17],[x+dx+3,y+17]],p.frame);rect(x+dx+4,y+23,8,27,p.shell);poly([[x+dx+5,y+17],[x+10+dx,y-12-flame],[x+dx+14,y+17]],'#ff9f4c');poly([[x+dx+7,y+17],[x+10+dx,y-5-flame*.5],[x+dx+12,y+17]],'#ffe37e');}
      rect(x+25,y+98,96,5,p.trim);for(const dx of [21,100])rivet(x+dx,y+94,p.plate);
    }
    function drawMawBoss(e,time,theme,flash) {
      const p=palette(theme,flash),x=e.x,y=e.y,wave=time*3+(e.phase||0);
      oval(x+67,y+147,83,6,'#10111c');
      for(let i=0;i<5;i++){
        const sx=x+13+i*28,sy=y+90+Math.sin(wave+i)*7,ex=x-9+i*38,ey=y+138+Math.sin(wave*1.7+i)*11;
        curve(sx,sy,sx-25,sy+18,ex+18,ey-18,ex,ey,p.t.leaf,12);curve(sx,sy,sx-24,sy+18,ex+17,ey-18,ex,ey,p.trim,2);
        oval(ex,ey,6,6,p.t.far,'#261b30');
      }
      outlined([[x+4,y+62],[x+19,y+28],[x+52,y+8],[x+97,y+12],[x+132,y+40],[x+143,y+77],[x+116,y+111],[x+63,y+122],[x+18,y+105],[-4+x,y+83]],flash?'#fff1dc':p.t.leaf,'#25152c',2);
      oval(x+69,y+69,49,40,p.t.far,'#25152c',2);oval(x+69,y+71,37,29,'#381d31','#140e1b',2);oval(x+69,y+73,24,19,'#dc4d64','#551d31',2);oval(x+69,y+73,12,10,'#160f1d');
      for(let i=0;i<6;i++){const a=Math.PI*2*i/6;oval(x+69+Math.cos(a)*27,y+72+Math.sin(a)*20,3,3,'#ffd2ab','#4d273b');}
      for(const side of [-1,1]){oval(x+69+side*27,y+48,11,8,'#1a1220','#301d34');oval(x+69+side*29,y+48,4,4,p.glass);oval(x+69+side*30,y+47,1.3,1.3,'#fff5d9');}
      for(let i=0;i<7;i++)poly([[x+19+i*15,y+97],[x+27+i*15,y+114],[x+33+i*15,y+97]],'#e9c7a6');
      for(const dx of [30,98])curve(x+dx,y+27,x+dx-12,y+4,x+dx+9,y-10,x+dx+1,y-25,p.trim,3);
    }
    function drawSourceBoss(e,time,theme,flash) {
      const p=palette(theme,flash),x=e.x,y=e.y,pulse=1+Math.sin(time*5+(e.phase||0))*0.08;
      c.save();c.translate(x+68,y+70);c.scale(pulse,pulse);c.translate(-x-68,-y-70);
      oval(x+68,y+148,88,6,'#120e1a');
      for(let i=0;i<6;i++){
        const a=i*Math.PI/3+time*.28,sx=x+68+Math.cos(a)*42,sy=y+72+Math.sin(a)*33,ex=x+68+Math.cos(a)*75,ey=y+84+Math.sin(a*1.8)*43;
        curve(sx,sy,sx+Math.cos(a+.8)*28,sy+Math.sin(a+.8)*29,ex-Math.cos(a)*15,ey-10,ex,ey,p.t.leaf,9);curve(sx,sy,sx+Math.cos(a+.8)*28,sy+Math.sin(a+.8)*29,ex-Math.cos(a)*15,ey-10,ex,ey,p.trim,1.5);
      }
      for(let i=0;i<7;i++){const a=i*Math.PI*2/7-time*.2;oval(x+68+Math.cos(a)*56,y+69+Math.sin(a)*44,15,12,p.t.leaf,'#321735',1);}
      oval(x+68,y+69,55,47,flash?'#fff0df':p.t.far,'#311733',2);oval(x+68,y+69,44,37,'#7c365c','#431b42',2);
      for(let i=0;i<5;i++){const a=i*Math.PI*2/5+time*.35;oval(x+68+Math.cos(a)*29,y+69+Math.sin(a)*23,8,7,p.t.light,'#42213f');}
      oval(x+68,y+69,23,27,'#f06784','#571d45',2);oval(x+68,y+69,14,19,'#190d22');oval(x+68+Math.sin(time*2)*3,y+69,6,13,p.glass,'#2b1430');oval(x+70+Math.sin(time*2)*3,y+65,2,4,'#fff8dc');
      for(let i=0;i<4;i++)poly([[x+39+i*19,y+34],[x+48+i*18,y-12-Math.sin(time*3+i)*9],[x+57+i*19,y+35]],p.t.light);
      c.restore();
    }
    function drawBoss(e,time,theme,flash) {
      if(e.variant===0)return drawTankBoss(e,time,theme,flash);
      if(e.variant===1)return drawWatchtowerBoss(e,time,theme,flash);
      if(e.variant===2)return drawUndertowBoss(e,time,theme,flash);
      if(e.variant===3)return drawOverseerBoss(e,time,theme,flash);
      if(e.variant===4)return drawFrostbiteBoss(e,time,theme,flash);
      if(e.variant===5)return drawCrucibleBoss(e,time,theme,flash);
      if(e.variant===6)return drawMawBoss(e,time,theme,flash);
      return drawSourceBoss(e,time,theme,flash);
    }
    function themedEnemy(e,time) {
      const kind=e.kind,walk=Math.sin(time*11),outline='#09151e';
      c.save();c.translate(e.x+16,e.y+17);
      if(e.flash>0)c.filter='brightness(2)';
      if(e.slow>0)c.filter='sepia(.6) saturate(2) hue-rotate(140deg)';
      const limb=(x,y,x2,y2,color,w=3)=>{c.strokeStyle=outline;c.lineWidth=w+2;c.beginPath();c.moveTo(x,y);c.lineTo(x2,y2);c.stroke();c.strokeStyle=color;c.lineWidth=w;c.stroke();};
      const dot=(x,y,rx,ry,color)=>{c.fillStyle=color;c.strokeStyle=outline;c.lineWidth=1.5;c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fill();c.stroke();};
      if(kind==='vineMantis'){
        for(const side of [-1,1]){
          limb(side*5,5,side*(15+walk),16,'#65873e');limb(side*6,-6,side*20,-15,'#98b867');
          poly([[side*20,-15],[side*25,-3],[side*15,-8]],'#c7d988');
        }
        dot(0,1,7,14,'#486b36');poly([[-11,-10],[0,-18],[11,-10],[0,-4]],'#89b257');dot(-5,-11,3,2,'#ffee7b');dot(5,-11,3,2,'#ffee7b');
      }else if(kind==='securitySpider'){
        for(let i=0;i<3;i++)for(const side of [-1,1]){limb(side*6,i*6-8,side*20,i*10-12+walk*(i%2?2:-2),'#8da9b0',2);limb(side*20,i*10-12,side*24,i*10-7,'#77919b',2);}
        dot(0,0,12,10,'#536e7d');dot(0,-3,7,6,'#172b40');dot(0,-4,4,3,'#ff6159');limb(0,2,0,15,'#b5c9c6',4);
      }else if(kind==='riverRay'){
        const flap=Math.sin(time*7)*5;
        poly([[0,-13],[-11,-4],[-31,flap],[-17,12],[0,7],[17,12],[31,flap],[11,-4]],'#4eb6b9');
        poly([[0,-10],[-17,5],[0,12],[17,5]],'#236077');limb(0,8,4+walk*3,27,'#84d1c9',2);dot(-5,-6,2,2,'#e5fda2');dot(5,-6,2,2,'#e5fda2');
      }else if(kind==='reactorOrb'){
        dot(0,0,17,17,'#694936');dot(0,0,10,10,'#ffad4c');dot(-3,-4,4,4,'#ffe9a0');
        for(let i=0;i<4;i++){c.save();c.rotate(time+i*Math.PI/2);limb(12,0,23,3,'#a7b1a3',4);c.restore();}
      }else if(kind==='iceWolf'){
        for(const x of [-10,10]){limb(x,4,x+walk*4,16,'#a4c5d2');limb(x,4,x-walk*4,14,'#d4e9eb',2);}
        dot(0,0,19,9,'#bddee1');poly([[-18,-2],[-28,-13],[-23,4]],'#809eaf');
        poly([[11,-3],[13,-19],[21,-10],[31,-4],[28,5],[14,5]],'#d9eff0');dot(22,-5,2,2,'#39cff9');
      }else if(kind==='slagCrab'){
        for(const side of [-1,1]){for(let i=0;i<3;i++)limb(side*9,i*4,side*(20-i),10+i*3+walk,'#bb6f42',2);
          limb(side*9,-2,side*23,-12,'#9d5034',4);poly([[side*23,-12],[side*31,-21],[side*30,-7],[side*20,-5]],'#e39750');}
        dot(0,0,15,11,'#67403c');poly([[-11,-5],[0,-12],[12,-5],[7,3],[-7,3]],'#e58b40');dot(-5,-7,2,2,'#ffef9c');dot(5,-7,2,2,'#ffef9c');
      }else if(kind==='caveBat'){
        const flap=Math.sin(time*15)*12;
        for(const side of [-1,1])poly([[side*5,0],[side*31,-12+flap],[side*26,8+flap*.4],[side*18,3],[side*11,10]],'#9276b9');
        dot(0,1,7,12,'#44304f');poly([[-7,-4],[-7,-18],[0,-10],[7,-18],[7,-4]],'#755283');dot(-3,-6,2,2,'#a2f5ed');dot(3,-6,2,2,'#a2f5ed');
      }else if(kind==='sporeWasp'){
        c.globalAlpha=.6;dot(-15,-9,14,6+Math.abs(walk)*4,'#adbedb');dot(15,-9,14,6+Math.abs(walk)*4,'#adbedb');c.globalAlpha=1;
        dot(0,3,9,15,'#783b69');for(let i=0;i<3;i++)dot(0,i*7-3,7,2,'#d490a8');poly([[-4,15],[0,25],[4,15]],'#e6bb7e');dot(0,-13,8,7,'#4c305b');dot(-4,-14,3,3,'#97f5a2');dot(4,-14,3,3,'#97f5a2');
      }
      c.restore();
    }
    function enemy(e,time,theme) {
      const flash=e.flash>0;
      if(root.SlopCommando.specialEnemies[e.kind]){themedEnemy(e,time);return;}
      if(e.kind==='boss') {drawBoss(e,time,theme,flash);return;}
      if(e.kind==='core') {drawCore(e,time,theme,flash);return;}
      if(e.kind==='drone') {drawDrone(e,time,theme,flash);return;}
      if(e.kind==='turret') {drawTurret(e,time,theme,flash);return;}
      if(e.kind==='crawler') {drawCrawler(e,time,theme,flash);return;}
      drawSoldier(e,time,theme,flash);
    }
    function draw(s,{time=0,attract=false}={}) {
      const t=themes[s.level.theme];
      if(!environment.draw(s,time)){if(s.level.mode==='base')baseRoom(s,time);else background(s,time);}
      c.save();c.translate(-Math.round(s.camera.x),-Math.round(s.camera.y));
      terrain(s);
      if(attract){enemy({kind:'turret',x:680,y:420},time,'jungle');enemy({kind:'soldier',x:520,y:420},time,'jungle');}
      for(const p of s.pickups) arsenal.pickup(p,time,s.players.some(hero=>hero.lives>0&&Math.abs(hero.x-p.x)<140&&Math.abs(hero.y-p.y)<100));
      if(s.level.mode==='base'){
        for(const actor of [...s.enemies,...s.players,...(s.boss?[s.boss]:[])]){c.fillStyle='#00000055';c.beginPath();c.ellipse(actor.x+actor.w/2,actor.y+actor.h-2,actor.w*.6,8,0,0,Math.PI*2);c.fill();}
      }
      s.enemies.forEach(e=>enemy(e,time,s.level.theme));if(s.boss)enemy(s.boss,time,s.level.theme);
      s.players.forEach(p=>hero.draw(p,time,{victory:s.status==='clear'||s.status==='victory',mode:s.level.mode}));
      for(const b of s.bullets) {
        const color=b.team==='enemy'?'#ff7850':b.weapon==='L'?'#a8faff':b.weapon==='F'?'#ff9f3b':'#ffe5a5';
        if(b.weapon==='F'){
          c.save();c.translate(b.x,b.y);c.rotate(Math.atan2(b.vy,b.vx));c.globalAlpha=Math.min(1,b.ttl*4);
          const flicker=Math.sin(time*26+b.x)*3;
          poly([[-16,-8],[-7,-5],[-10,-12-flicker],[5,-8],[12,0],[5,8],[-12,10],[-6,4],[-18,5]],'#ff6b30');
          poly([[-9,-4],[2,-5],[8,0],[1,5],[-10,4],[-4,0]],'#ffd576');c.restore();
        }
        else if(b.weapon==='G'){
          c.save();c.translate(b.x,b.y);c.rotate(Math.atan2(b.vy,b.vx)+time*14);
          oval(0,0,7,7,'#48653a','#101c23',2);oval(-2,-2,2.5,2.5,'#a8c56a');
          rect(-1,-11,2,6,'#d7ac5d');rect(-3,-12,6,2,'#263b36');
          c.globalAlpha=.65;line(-9,0,-17,0,'#f2b34d',2);c.restore();
        }
        else if(b.weapon==='H'){
          c.save();c.translate(b.x,b.y);c.rotate(Math.atan2(b.vy,b.vx));
          c.globalAlpha=Math.min(1,b.ttl*3);poly([[-10,-4],[7,-4],[13,0],[7,4],[-10,4]],'#d8ded0');
          poly([[-3,-4],[-7,-9],[-7,-3]],'#718b86');poly([[-3,4],[-7,9],[-7,3]],'#718b86');
          oval(8,0,3,3,'#ff7c4c','#6b2e2c');poly([[-11,-3],[-19,0],[-11,3]],'#ffb54d');poly([[-11,-1],[-16,0],[-11,1]],'#ffe49b');c.restore();
        }
        else if(b.weapon==='W'){
          c.save();c.translate(b.x,b.y);c.rotate(Math.atan2(b.vy,b.vx));c.globalAlpha=Math.min(1,b.ttl*3);
          c.strokeStyle='#6bf5ed';c.lineWidth=3;for(let i=0;i<3;i++){c.beginPath();c.arc(-3-i*5,0,9+i*4,-1.05,1.05);c.stroke();}
          c.strokeStyle='#d9fffa';c.lineWidth=1;c.beginPath();c.arc(-7,0,14,-1.05,1.05);c.stroke();c.restore();
        }
        else if(b.weapon==='T'){
          c.strokeStyle='#c5adff';c.lineWidth=2;c.beginPath();c.moveTo(b.x-b.vx*.025,b.y-b.vy*.025);c.lineTo(b.x-6,b.y-7);c.lineTo(b.x+4,b.y+4);c.lineTo(b.x+10,b.y);c.stroke();
        }else if(b.weapon==='I'){
          c.save();c.translate(b.x,b.y);c.rotate(time*4);poly([[0,-9],[5,-3],[10,0],[4,4],[0,10],[-4,3],[-10,0],[-4,-4]],'#b0efff');c.restore();
        }else if(b.weapon==='A'){
          oval(b.x,b.y,b.w*.7,b.h*.7,'#ba55f066');oval(b.x,b.y,b.w*.45,b.h*.45,'#f6b0ff');oval(b.x-2,b.y-2,4,4,'#ffffff');
        }
        else if(b.weapon==='L'){c.strokeStyle=color;c.lineWidth=4;c.beginPath();c.moveTo(b.x,b.y);c.lineTo(b.x-b.vx*.035,b.y-b.vy*.035);c.stroke();}
        else {rect(b.x-2,b.y-2,b.w+4,b.h+4,b.team==='enemy'?'#a73c3544':'#fff5ce22');rect(b.x,b.y,b.w,b.h,color);rect(b.x+2,b.y+2,3,2,'#fff4c6');}
      }
      for(const e of s.effects){c.globalAlpha=Math.min(1,e.ttl*5);if(e.arc){c.strokeStyle=e.color;c.lineWidth=2;c.beginPath();c.moveTo(e.x,e.y);c.lineTo((e.x+e.x2)/2+5,(e.y+e.y2)/2-8);c.lineTo(e.x2,e.y2);c.stroke();}else rect(e.x,e.y,4,4,e.color);}c.globalAlpha=1;
      c.restore();
      if(s.roomTransition>0){c.fillStyle='rgba(4,12,19,'+Math.min(.85,s.roomTransition/.65)+')';c.fillRect(0,0,960,540);}
      if(s.nukeFlash>0){
        // A nuke is a screen-clearing moment: a white-hot detonation that fills the frame,
        // then a huge blast front and shock rings race beyond the visible battlefield.
        const duration=1.2, progress=Math.max(0,Math.min(1,1-s.nukeFlash/duration));
        const flash=progress<.16?.98-(progress/.16)*.18:Math.pow(1-progress,1.65)*.8;
        const radius=70+progress*1160, core=Math.max(0,1-progress*2.4)*210;
        c.save();c.globalCompositeOperation='screen';
        c.fillStyle='rgba(255,255,255,'+flash+')';c.fillRect(0,0,960,540);
        const blast=c.createRadialGradient(480,270,0,480,270,radius);
        blast.addColorStop(0,'rgba(255,255,255,'+Math.min(1,.95+flash*.2)+')');
        blast.addColorStop(Math.min(.78,Math.max(.08,core/radius)),'rgba(255,248,214,'+(1-progress)*.92+')');
        blast.addColorStop(.88,'rgba(255,207,116,'+(1-progress)*.48+')');blast.addColorStop(1,'rgba(255,255,255,0)');
        c.fillStyle=blast;c.beginPath();c.arc(480,270,radius,0,Math.PI*2);c.fill();
        c.strokeStyle='rgba(255,255,255,'+(1-progress)*.95+')';c.lineWidth=18*(1-progress)+3;
        c.beginPath();c.arc(480,270,radius,0,Math.PI*2);c.stroke();
        c.strokeStyle='rgba(255,238,174,'+(1-progress)*.65+')';c.lineWidth=6;
        c.beginPath();c.arc(480,270,Math.max(0,radius-95),0,Math.PI*2);c.stroke();
        for(let i=0;i<20;i++){const angle=i*Math.PI*2/20+progress*.45,inner=Math.max(0,radius*.12),outer=radius*(.72+(i%3)*.12);c.strokeStyle='rgba(255,255,255,'+(1-progress)*.42+')';c.lineWidth=2+(i%3);c.beginPath();c.moveTo(480+Math.cos(angle)*inner,270+Math.sin(angle)*inner);c.lineTo(480+Math.cos(angle)*outer,270+Math.sin(angle)*outer);c.stroke();}
        c.restore();
      }
      if(attract) {
        const shade=c.createLinearGradient(0,0,960,0);shade.addColorStop(0,'#08171beb');shade.addColorStop(.5,'#08171ba0');shade.addColorStop(1,'#08171b10');c.fillStyle=shade;c.fillRect(0,0,960,540);
        c.save();c.translate(710,265);hero.draw({x:-15,y:-22,lives:1,id:0},time,{large:true});c.restore();
        text('NO ORDERS. JUST SLOP.',714,448,12,'#f8e6bd','center');
      }
      if(s.boss&&s.status==='playing') {
        rect(244,23,472,35,'#0b1a24db');text(s.boss.name.toUpperCase(),480,38,11,'#f0d9b4','center');rect(260,45,440,5,'#49343a');rect(260,45,440*Math.max(0,s.boss.hp/s.boss.maxHp),5,'#ff6250');
      }
      if(s.banner>0&&s.status==='playing'&&!s.boss) {rect(300,72,360,46,'#081c23ce');text(s.level.mode==='base'?'BREACH CHAMBER '+(s.room+1):s.level.name.toUpperCase(),480,94,17,'#f6ebd2','center');text(s.level.mode==='base'?'DESTROY THE RED CORES':'MOVE OUT  →',480,110,10,t.glow,'center');}
      if(s.level.mode==='run'&&s.status==='playing'&&!s.boss)text('→',922,282,24,'#e1cf9a','center');
    }
    return { draw, themes, mascot: hero, environment };
  }
  root.SlopCommando.createRenderer=createRenderer;
})(window);
