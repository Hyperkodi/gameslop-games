/* Canvas renderer: 5:8 portrait well, marble columns with gold caps, a bronze floor band, and the
   skin logo as a rotating "hourglass" bird. Hi-DPI canvas setup and rect bevels come from the kit. */
(function (global) {
  "use strict";
  const K = global.GameSlopKit;
  const G = global.Game = global.Game || {};
  const WORLD_W = 62.5, WORLD_H = 100;
  const CAP_H = 2; // gold cap height at each gap edge
  const FLOOR_H = 4; // floor band height
  const FLOOR_TOP = G.FLOOR_Y; // 96 — top edge of the floor band, from the engine's api
  const BIRD_SIZE = 8;

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

      const columns = state.columns;
      for (let i = 0; i < columns.length; i++) {
        const c = columns[i];
        const topH = c.gapY - G.GAP_HALF; // top segment: from y=0 to the gap's top edge
        const botY = c.gapY + G.GAP_HALF; // bottom segment: from the gap's bottom edge to the floor
        const botH = FLOOR_TOP - botY;
        if (topH > 0) K.drawBevelRect(ctx, c.x * s, 0, c.w * s, topH * s, sprites.column);
        if (botH > 0) K.drawBevelRect(ctx, c.x * s, botY * s, c.w * s, botH * s, sprites.column);
        // gold caps at each gap edge
        K.drawBevelRect(ctx, c.x * s, (topH - CAP_H) * s, c.w * s, CAP_H * s, sprites.cap);
        K.drawBevelRect(ctx, c.x * s, botY * s, c.w * s, CAP_H * s, sprites.cap);
      }

      // floor band
      K.drawBevelRect(ctx, 0, FLOOR_TOP * s, w, FLOOR_H * s, sprites.floor);

      const bird = state.bird;
      const rot = Math.max(-0.45, Math.min(1.2, bird.vy / 90));
      if (skin.logoImage) {
        K.drawLogo(ctx, skin.logoImage, bird.x * s, bird.y * s, BIRD_SIZE * s, 1, rot);
      } else {
        ctx.save();
        ctx.translate(bird.x * s, bird.y * s);
        ctx.rotate(rot);
        K.drawBevelRect(ctx, -BIRD_SIZE * s / 2, -BIRD_SIZE * s / 2, BIRD_SIZE * s, BIRD_SIZE * s, sprites.cap);
        ctx.restore();
      }
    };

    r.resize();
    return r;
  }

  G.createRenderer = createRenderer;
})(typeof window !== "undefined" ? window : globalThis);
