/* Canvas renderer: square well, bevelled snake segments, pickup, grid, watermark.
   Hi-DPI canvas setup, tile bevels and the logo stamp come from the kit. */
(function (global) {
  "use strict";
  const K = global.GameSlopKit;
  const G = global.Game = global.Game || {};
  const COLS = 20, ROWS = 20;

  function createRenderer(o) {
    const skin = o.skin, sprites = skin.sprites, pal = skin.palette;
    const r = { cell: 24 };
    let wellCtx, dpr = 1;

    r.resize = function () {
      const vp = K.wellViewport(o.wrapEl);
      dpr = vp.dpr;
      const cell = Math.max(12, Math.floor(Math.min(vp.availW, vp.availH) / 20));
      r.cell = cell;
      wellCtx = K.setupCanvas(o.wellCanvas, cell * COLS, cell * ROWS, dpr);
      return { cell: cell };
    };

    r.draw = function (state) {
      const ctx = wellCtx, s = r.cell, w = s * COLS, h = s * ROWS;
      ctx.fillStyle = pal.well; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = pal.grid; ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 1; x < COLS; x++) { ctx.moveTo(x * s + 0.5, 0); ctx.lineTo(x * s + 0.5, h); }
      for (let y = 1; y < ROWS; y++) { ctx.moveTo(0, y * s + 0.5); ctx.lineTo(w, y * s + 0.5); }
      ctx.stroke();
      K.drawWatermark(ctx, skin, w, h);

      const p = state.pickup;
      if (p) {
        K.drawTile(ctx, p.x * s, p.y * s, s, sprites.pickup);
        if (skin.logoImage) {
          K.drawLogo(ctx, skin.logoImage, p.x * s + s / 2, p.y * s + s / 2, s * 0.9, 1);
        }
      }

      const snake = state.snake;
      for (let i = snake.length - 1; i >= 0; i--) {
        const seg = snake[i];
        const tone = i === 0 ? sprites.head : (i === snake.length - 1 ? sprites.tail : sprites.body);
        K.drawTile(ctx, seg.x * s, seg.y * s, s, tone);
      }
    };

    r.resize();
    return r;
  }

  G.createRenderer = createRenderer;
})(typeof window !== "undefined" ? window : globalThis);
