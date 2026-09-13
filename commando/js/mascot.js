/* Mascot presentation only. Sprite poses never change movement or hitboxes. */
(function (root) {
  'use strict';
  const G = root.SlopCommando = root.SlopCommando || {};

  function createMascotRenderer(ctx, skin) {
    const art = skin.mascot;
    const arsenal = G.createWeaponArt(ctx, skin.weapons);
    const atlas = new Image();
    let spriteSurface = atlas;
    let loaded = false;
    const animation = new WeakMap();
    const ready = new Promise(resolve => {
      atlas.onload = () => {
        try {
          spriteSurface = prepareAtlas(atlas);
          loaded = true;
        } catch (_) { loaded = false; }
        resolve(loaded);
      };
      atlas.onerror = () => resolve(false);
    });
    // The embedded source works with file:// without tainting the canvas.
    atlas.src = root.SlopCommandoActorAtlases?.[art.atlas] || root.SlopCommandoMascotAtlas || 'skin/' + skin.name + '/' + art.atlas;

    function prepareAtlas(image) {
      const surface = document.createElement('canvas');
      surface.width = image.naturalWidth; surface.height = image.naturalHeight;
      const paint = surface.getContext('2d', { willReadFrequently: true });
      paint.drawImage(image, 0, 0);
      const pixels = paint.getImageData(0, 0, surface.width, surface.height);
      const data = pixels.data, width = surface.width, height = surface.height;
      if(art.chromaKey)G.removeMatte(pixels);
      // Generated sheets sometimes carry a pale matte. Key only neutral pixels
      // connected to the outside: the enclosed eye whites and highlights stay.
      if (art.keyMatte) {
        const seen = new Uint8Array(width * height), queue = new Int32Array(width * height);
        let head = 0, tail = 0;
        function visit(n) {
          if (seen[n]) return;
          seen[n] = 1;
          const i = n * 4, lo = Math.min(data[i], data[i + 1], data[i + 2]);
          const hi = Math.max(data[i], data[i + 1], data[i + 2]);
          if (data[i + 3] < 16 || (lo > 170 && hi - lo < 55)) queue[tail++] = n;
        }
        for (let x = 0; x < width; x++) { visit(x); visit((height - 1) * width + x); }
        for (let y = 0; y < height; y++) { visit(y * width); visit(y * width + width - 1); }
        while (head < tail) {
          const n = queue[head++], x = n % width;
          data[n * 4 + 3] = 0;
          if (x > 0) visit(n - 1); if (x < width - 1) visit(n + 1);
          if (n >= width) visit(n - width); if (n < width * (height - 1)) visit(n + width);
        }
      }
      paint.putImageData(pixels, 0, 0);
      return surface;
    }

    function ellipse(x, y, rx, ry, fill, stroke) {
      ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fillStyle = fill; ctx.fill();
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = .9; ctx.stroke(); }
    }

    // A likeness-preserving fallback for an unavailable image, including eyes,
    // droplet, gloved hands and boots. It is also usable with file://.
    function fallback(pose, time, player) {
      const red = player ? art.coop : art.body, dark = art.shadow;
      const stride = pose.startsWith('run') ? Math.sin(time*12) : 0;
      const low = pose === 'crouch' ? 11 : 0;
      const body = ctx.createRadialGradient(-8, -35 + low, 2, 1, -25 + low, 28);
      body.addColorStop(0, '#f1fffa'); body.addColorStop(.45, red); body.addColorStop(1, dark);
      ellipse(-11 - stride * 5, -5 - Math.max(0, stride) * 5, 9, 5, red, dark);
      ellipse(11 - stride * 5, -5 + Math.min(0, stride) * 5, 9, 5, red, dark);
      ellipse(-21, -24 + low, 6, 10, red, dark);
      ellipse(21, pose === 'victory' ? -47 : -24 + low, 6, 10, red, dark);
      ellipse(0, -29 + low, 19, 24 - low * .2, body, dark);
      ellipse(2,-42+low,23,15,red,dark);
      for (const x of [-8, 8]) {
        ellipse(x, -44 + low, 8, 5, '#f2f9f5', dark);
        ellipse(x + 2, -43 + low, 3.6, 4, '#111413');
        ellipse(x, -40 + low, 1.5, 2, '#fff8e5');
      }
      ctx.strokeStyle = dark; ctx.lineWidth = 1.7;
      ctx.beginPath(); ctx.moveTo(-13, -48 + low); ctx.lineTo(-3, -44 + low);
      ctx.moveTo(3, -44 + low); ctx.lineTo(13, -48 + low); ctx.stroke();
      ctx.fillStyle = '#141619';
      ctx.beginPath(); ctx.roundRect(-5, -28 + low, 10, 21, 2); ctx.fill();
      ctx.beginPath(); ctx.roundRect(-11, -22 + low, 22, 10, 2); ctx.fill();
      ctx.fillStyle = '#484a4c'; ctx.fillRect(-3, -27 + low, 6, 1);
      ellipse(-11, -45 + low, 2, 5, '#ffded0');
    }

    function poseFor(p, large, victory, mode, time) {
      let a=animation.get(p);
      if(!a||time<a.time)a={grounded:p.grounded,lives:p.lives,landUntil:-1,hurtUntil:-1,time};
      if(!a.grounded&&p.grounded)a.landUntil=time+.10;
      if(p.lives<a.lives)a.hurtUntil=time+.16;
      a.grounded=p.grounded;a.lives=p.lives;a.time=time;animation.set(p,a);
      if (large || victory) return 'victory';
      if(time<a.hurtUntil)return 'hurt';
      if (p.prone) return 'crouch';
      if ((mode !== 'base' && !p.grounded) || p.jumpTime > 0) return p.vy < -390 ? 'takeoff' : 'jump';
      if(time<a.landUntil)return 'landing';
      return Math.abs(p.vx || 0) > 1 || (mode === 'base' && (p.held?.up || p.held?.down)) ? 'run' : Math.floor(time*2)%2?'idleB':'idle';
    }

    function body(p, time, large, victory, mode) {
      let pose = poseFor(p, large, victory, mode, time);
      if (pose === 'run') pose = art.runFrames[Math.floor(time * 12) % art.runFrames.length];
      const bounds = art.frames[pose];
      const targetHeight = large ? 300 : art.renderHeight;
      // Every pose uses the same source-to-world scale, including the crouch.
      const scale = targetHeight / art.standingHeight;
      const bob = large ? Math.sin(time * 2) * 2 : p.grounded || mode === 'base' ?
        Math.abs(p.vx || 0) > 1 ? -Math.abs(Math.sin(time * 12)) * 1.4 : Math.sin(time * 3) * .4 : 0;
      const dodgeLift = p.jumpTime > 0 ? (p.dodgeLift ?? Math.sin(p.jumpTime / .6 * Math.PI) * 25) : 0;
      const feetX = p.x + 15, feetY = large ? p.y + 22 + targetHeight / 2 : p.y + 42;
      ctx.save(); ctx.translate(Math.round(feetX), Math.round(feetY + bob - dodgeLift));
      if (!large && (p.face || 1) !== art.sourceFacing) ctx.scale(-1, 1);
      if (loaded && bounds) {
        const [sx, sy, sw, sh] = bounds;
        const [ax,ay]=art.anchors?.[pose]||[sw/2,sh];
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        if (p.id === 1) ctx.filter = 'sepia(.25) hue-rotate(120deg) saturate(1.5)';
        // A dark edge keeps the silver silhouette legible against snow and water.
        ctx.shadowColor = '#080d14'; ctx.shadowBlur = large ? 5 : 1.5;
        ctx.drawImage(spriteSurface, sx, sy, sw, sh, -ax * scale, -ay * scale, sw * scale, sh * scale);
      } else {
        const s = targetHeight / 64; ctx.scale(s, s); fallback(pose, time, p.id);
      }
      ctx.restore();
    }

    function weapon(p, time) {
      const lift = p.jumpTime > 0 ? (p.dodgeLift ?? Math.sin(p.jumpTime / .6 * Math.PI) * 25) : 0;
      const recoil = p.held?.fire && p.cooldown > .045 ? 1.7 : 0;
      ctx.save(); ctx.translate(p.x + 15, p.y + (p.prone ? 32 : 23) - lift);
      ctx.rotate(Math.atan2(p.aimY ?? 0, p.aimX ?? p.face ?? 1));
      ctx.translate(-recoil, 0);
      ctx.save();ctx.translate(1,0);ctx.scale(.54,.54);arsenal.draw(p.weapon || 'P',{time});ctx.restore();
      // A visible gloved hand attaches the gun to the supplied character.
      ellipse(12, 3, 4, 3.5, p.id ? art.coop : art.body, art.shadow);
      if (recoil) {
        ctx.fillStyle = '#ffe1a0'; ctx.beginPath(); ctx.moveTo(38, -6);
        ctx.lineTo(49, 1); ctx.lineTo(38, 7); ctx.lineTo(41, 1); ctx.fill();
      }
      ctx.restore();
    }

    function draw(p, time, { large = false, victory = false, mode = 'run' } = {}) {
      if (p.lives <= 0) return;
      ctx.save();
      // Blink translucently during protection; never make the mascot disappear.
      if (!large && p.invincible > 0 && Math.floor(time * 12) % 2 === 0) ctx.globalAlpha = .5;
      if(!large&&p.cloak>0){ctx.globalAlpha=.28;ctx.shadowColor='#93dfff';ctx.shadowBlur=8;}
      if(!large&&p.holstered){ctx.save();ctx.translate(p.x+3,p.y+26);ctx.rotate(-1.1);ctx.scale(.4,.4);arsenal.draw(p.holstered,{time});ctx.restore();}
      if(!large&&(p.jetpackFuel||0)>0){
        const lift=p.jumpTime>0?(p.dodgeLift??Math.sin(p.jumpTime/.6*Math.PI)*25):0;
        ctx.save();ctx.translate(p.x+15-(p.face||1)*16,p.y+19-lift);ctx.scale(.55,.55);ctx.translate(-35,0);arsenal.draw('J',{time});
        if(p.jetpackActive){for(const x of [24,48]){ctx.fillStyle='#ffa553';ctx.beginPath();ctx.moveTo(x-5,20);ctx.lineTo(x,37+Math.sin(time*43)*7);ctx.lineTo(x+5,20);ctx.fill();ctx.fillStyle='#bdfaff';ctx.fillRect(x-2,19,4,9);}}ctx.restore();
      }
      body(p, time, large, victory, mode);
      if (!large && !victory) weapon(p, time);
      if (!large && p.shield > 0) {
        ctx.strokeStyle = '#87ece6'; ctx.lineWidth = 2; ctx.beginPath();
        ctx.ellipse(p.x + 15, p.y + 10, 33, 38, 0, 0, Math.PI * 2); ctx.stroke();
      }
      if (!large && p.id === 1) {
        ctx.fillStyle = '#86e4df'; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center';
        ctx.fillText('P2', p.x + 15, p.y - 26);
      }
      ctx.restore();
    }
    return { draw, ready, get loaded() { return loaded; } };
  }
  G.createMascotRenderer = createMascotRenderer;
})(window);
