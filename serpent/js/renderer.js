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
      dpr = Math.min(global.devicePixelRatio || 1, 3);
      const narrow = global.innerWidth < 760;
      const frame = parseFloat(getComputedStyle(o.wrapEl).borderTopWidth) || 14;
      const titleH = (document.querySelector(".title") || {}).offsetHeight || 60;
      const touchEl = document.getElementById("touch");
      const touchH = touchEl && getComputedStyle(touchEl).display !== "none" ? touchEl.offsetHeight : 0;
      const stripH = narrow ? ((document.querySelector(".panel-left") || {}).offsetHeight || 70) + 8 : 0;
      const availH = global.innerHeight - titleH - touchH - stripH - 2 * frame - 24;
      const availW = global.innerWidth - (narrow ? 20 : 2 * (172 + 22) + 32) - 2 * frame;
      const cell = Math.max(12, Math.floor(Math.min(availW, availH) / 20));
      r.cell = cell;
      wellCtx = K.setupCanvas(o.wellCanvas, cell * COLS, cell * ROWS, dpr);
      return { cell: cell };
    };

    function drawWatermark(ctx, w, h) {
      const wa = skin.watermarkAlpha == null ? 0.06 : skin.watermarkAlpha;
      if (wa <= 0 || !skin.logoImage) return;
      const size = Math.min(w, h) * 0.62;
      ctx.globalAlpha = wa;
      ctx.drawImage(skin.logoImage, (w - size) / 2, (h - size) / 2, size, size);
      ctx.globalAlpha = 1;
    }

    r.draw = function (state) {
      const ctx = wellCtx, s = r.cell, w = s * COLS, h = s * ROWS;
      ctx.fillStyle = pal.well; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = pal.grid; ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 1; x < COLS; x++) { ctx.moveTo(x * s + 0.5, 0); ctx.lineTo(x * s + 0.5, h); }
      for (let y = 1; y < ROWS; y++) { ctx.moveTo(0, y * s + 0.5); ctx.lineTo(w, y * s + 0.5); }
      ctx.stroke();
      drawWatermark(ctx, w, h);

      const p = state.pickup;
      if (skin.logoImage) {
        K.drawLogo(ctx, skin.logoImage, p.x * s + s / 2, p.y * s + s / 2, s * 0.8, 1);
      } else {
        K.drawTile(ctx, p.x * s, p.y * s, s, sprites.pickup);
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
