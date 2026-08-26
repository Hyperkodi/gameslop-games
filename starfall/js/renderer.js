/* Canvas renderer: 5:7 portrait well, bevelled gold chevron ship, gold bullets, obsidian asteroid
   polygons, gold-edged drone diamonds, a small gold explosion-particle burst, watermark. Hi-DPI
   canvas setup and rect bevels come from the kit. */
(function (global) {
  "use strict";
  const K = global.GameSlopKit;
  const G = global.Game = global.Game || {};
  const WORLD_W = 100, WORLD_H = 140;
  const PARTICLE_MS = 300, PARTICLE_COUNT = 8;
  const BLINK_MS = 100; // invulnerable ship: skip drawing on alternate 100 ms windows

  function reducedMotion() {
    return global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function createRenderer(o) {
    const skin = o.skin, sprites = skin.sprites, pal = skin.palette;
    const r = { cell: 4 };
    let wellCtx, dpr = 1;
    let particles = []; // { x, y, angle, speed, born } — world units; explode() feeds this list

    r.resize = function () {
      dpr = Math.min(global.devicePixelRatio || 1, 3);
      const narrow = global.innerWidth < 760;
      const frame = parseFloat(getComputedStyle(o.wrapEl).borderTopWidth) || 14;
      const titleH = (document.querySelector(".title") || {}).offsetHeight || 60;
      const touchEl = document.getElementById("touch");
      const touchH = touchEl && getComputedStyle(touchEl).display !== "none" ? touchEl.offsetHeight : 0;
      const stripH = narrow ? ((document.querySelector(".panel-left") || {}).offsetHeight || 70) + 8 : 0;
      const availH = global.innerHeight - titleH - touchH - stripH - 2 * frame - 24;
      const availW = global.innerWidth - (narrow ? 20 : 2 * (172 + 22) + 32) - 2 * frame;
      const scale = Math.max(2, Math.min(availW / WORLD_W, availH / WORLD_H));
      r.cell = scale;
      wellCtx = K.setupCanvas(o.wellCanvas, scale * WORLD_W, scale * WORLD_H, dpr);
      return { cell: scale };
    };

    // Fed by js/game.js's onEvent hook on every "explode" engine event. No-op under reduced
    // motion (spec: "Reduced motion: no particles") — the burst is purely decorative.
    r.explode = function (kind, x, y) {
      if (reducedMotion()) return;
      const now = performance.now();
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const angle = (Math.PI * 2 * i) / PARTICLE_COUNT;
        particles.push({ x: x, y: y, angle: angle, speed: 22 + (i % 3) * 6, born: now });
      }
    };

    function drawWatermark(ctx, w, h) {
      const wa = skin.watermarkAlpha == null ? 0.06 : skin.watermarkAlpha;
      if (wa <= 0 || !skin.logoImage) return;
      const size = Math.min(w, h) * 0.42;
      ctx.globalAlpha = wa;
      ctx.drawImage(skin.logoImage, (w - size) / 2, (h - size) / 2, size, size);
      ctx.globalAlpha = 1;
    }

    function drawShip(ctx, s, ship) {
      const tone = sprites.ship, cx = ship.x * s, cy = ship.y * s, w = ship.w * s, h = ship.h * s;
      function chevron(scale) {
        ctx.beginPath();
        ctx.moveTo(cx, cy - (h / 2) * scale);
        ctx.lineTo(cx + (w / 2) * scale, cy + (h / 2) * scale);
        ctx.lineTo(cx, cy + h * 0.18 * scale);
        ctx.lineTo(cx - (w / 2) * scale, cy + (h / 2) * scale);
        ctx.closePath();
      }
      chevron(1);
      ctx.fillStyle = tone.base; ctx.fill();
      chevron(0.6);
      ctx.fillStyle = tone.hi; ctx.fill();
      ctx.strokeStyle = "#FFFFFF"; ctx.globalAlpha = 0.85; ctx.lineWidth = Math.max(1, s * 0.1);
      ctx.beginPath(); ctx.moveTo(cx, cy - h * 0.42); ctx.lineTo(cx, cy - h * 0.02); ctx.stroke();
      ctx.globalAlpha = 1;
      if (tone.edge) { ctx.strokeStyle = tone.edge; ctx.lineWidth = 1; chevron(1); ctx.stroke(); }
    }

    function drawBullet(ctx, s, b) {
      const tone = sprites.bullet, cx = b.x * s, cy = b.y * s, br = b.r * s;
      ctx.fillStyle = tone.base;
      ctx.beginPath(); ctx.arc(cx, cy, br, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = tone.hi;
      ctx.beginPath(); ctx.arc(cx, cy, br * 0.55, 0, Math.PI * 2); ctx.fill();
    }

    // A 7-gon reads as a chunky, irregular-enough rock at these sizes; a per-enemy rotation
    // (derived from its id) keeps a field of asteroids from looking like stamped copies.
    function drawAsteroid(ctx, s, en) {
      const tone = sprites.asteroid, cx = en.x * s, cy = en.y * s, radius = en.r * s;
      const rot = (en.id % 7) * (Math.PI / 7);
      function heptagon(scale) {
        ctx.beginPath();
        for (let i = 0; i < 7; i++) {
          const a = rot + (Math.PI * 2 * i) / 7;
          const px = cx + Math.cos(a) * radius * scale, py = cy + Math.sin(a) * radius * scale;
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
      }
      heptagon(1);
      ctx.fillStyle = tone.base; ctx.fill();
      heptagon(0.55);
      ctx.strokeStyle = tone.hi; ctx.lineWidth = Math.max(1, s * 0.08); ctx.stroke();
      if (tone.edge) { ctx.strokeStyle = tone.edge; ctx.lineWidth = 1; heptagon(1); ctx.stroke(); }
    }

    function drawDrone(ctx, s, en) {
      const tone = sprites.drone, cx = en.x * s, cy = en.y * s, radius = en.r * s;
      function diamond(scale) {
        ctx.beginPath();
        ctx.moveTo(cx, cy - radius * scale);
        ctx.lineTo(cx + radius * scale, cy);
        ctx.lineTo(cx, cy + radius * scale);
        ctx.lineTo(cx - radius * scale, cy);
        ctx.closePath();
      }
      diamond(1);
      ctx.fillStyle = tone.base; ctx.fill();
      diamond(0.55);
      ctx.fillStyle = tone.hi; ctx.fill();
      if (tone.edge) { ctx.strokeStyle = tone.edge; ctx.lineWidth = Math.max(1, s * 0.06); diamond(1); ctx.stroke(); }
    }

    function drawParticles(ctx, s) {
      if (!particles.length) return;
      const now = performance.now();
      particles = particles.filter(function (p) { return now - p.born < PARTICLE_MS; });
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i], age = (now - p.born) / PARTICLE_MS;
        const dist = p.speed * (now - p.born) / 1000;
        const px = (p.x + Math.cos(p.angle) * dist) * s, py = (p.y + Math.sin(p.angle) * dist) * s;
        ctx.globalAlpha = Math.max(0, 1 - age);
        ctx.fillStyle = pal.gold;
        ctx.beginPath(); ctx.arc(px, py, Math.max(1, s * 0.1) * (1 - age * 0.5), 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    r.draw = function (state) {
      const ctx = wellCtx, s = r.cell, w = s * WORLD_W, h = s * WORLD_H;
      ctx.fillStyle = pal.well; ctx.fillRect(0, 0, w, h);
      drawWatermark(ctx, w, h);

      const enemies = state.enemies;
      for (let i = 0; i < enemies.length; i++) {
        const en = enemies[i];
        if (en.kind === "drone") drawDrone(ctx, s, en); else drawAsteroid(ctx, s, en);
      }

      const bullets = state.bullets;
      for (let i = 0; i < bullets.length; i++) drawBullet(ctx, s, bullets[i]);

      drawParticles(ctx, s);

      // invulnerable ship blinks: skip the draw on alternate 100 ms windows
      const blinkHidden = state.invulnMs > 0 && Math.floor(performance.now() / BLINK_MS) % 2 === 1;
      if (!blinkHidden) drawShip(ctx, s, state.ship);
    };

    r.resize();
    return r;
  }

  G.createRenderer = createRenderer;
})(typeof window !== "undefined" ? window : globalThis);
