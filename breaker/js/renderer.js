/* Canvas renderer: 2:3 portrait well, bevelled bricks/paddle, gold ball with a marble highlight,
   watermark. No grid (per the design decisions for this game). Hi-DPI canvas setup and tile
   bevels come from the kit. */
(function (global) {
  "use strict";
  const K = global.GameSlopKit;
  const G = global.Game = global.Game || {};
  const WORLD_W = 100, WORLD_H = 150;

  function createRenderer(o) {
    const skin = o.skin, sprites = skin.sprites, pal = skin.palette;
    const r = { cell: 4 };
    let wellCtx, dpr = 1;

    r.resize = function () {
      const vp = K.wellViewport(o.wrapEl);
      dpr = vp.dpr;
      const scale = Math.max(2, Math.min(vp.availW / WORLD_W, vp.availH / WORLD_H));
      r.cell = scale;
      wellCtx = K.setupCanvas(o.wellCanvas, scale * WORLD_W, scale * WORLD_H, dpr);
      return { cell: scale };
    };

    r.draw = function (state) {
      const ctx = wellCtx, s = r.cell, w = s * WORLD_W, h = s * WORLD_H;
      ctx.fillStyle = pal.well; ctx.fillRect(0, 0, w, h);
      K.drawWatermark(ctx, skin, w, h, 0.42);

      const bricks = state.bricks;
      for (let i = 0; i < bricks.length; i++) {
        const b = bricks[i];
        const tone = sprites[b.tier] || sprites.marble;
        K.drawBevelRect(ctx, b.x * s, b.y * s, b.w * s, b.h * s, tone);
      }

      const p = state.paddle;
      K.drawBevelRect(ctx, (p.x - p.w / 2) * s, p.y * s, p.w * s, p.h * s, sprites.paddle);

      const ball = state.ball;
      const bx = ball.x * s, by = ball.y * s, br = ball.r * s;
      ctx.fillStyle = pal.gold;
      ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#FFFFFF";
      ctx.globalAlpha = 0.85;
      ctx.beginPath(); ctx.arc(bx - br * 0.32, by - br * 0.32, br * 0.32, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    };

    r.resize();
    return r;
  }

  G.createRenderer = createRenderer;
})(typeof window !== "undefined" ? window : globalThis);
