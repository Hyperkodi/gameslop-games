/* Canvas renderer: well, bevelled stone tiles, ghost, hold/next, watermark.
   Tetris-specific drawing; hi-DPI canvas setup, tile bevels and the marble ground come from the kit. */
(function (global) {
  "use strict";
  const K = global.GameSlopKit;
  const A = global.Armaratris;
  const G = global.Game = global.Game || {};
  const FLASH_MS = 120;

  function reducedMotion() {
    return global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function drawGhost(ctx, px, py, s, color) {
    ctx.globalAlpha = 0.45;
    ctx.strokeStyle = color; ctx.lineWidth = 2;
    ctx.strokeRect(px + 3, py + 3, s - 6, s - 6);
    ctx.globalAlpha = 1;
  }

  // Draws one piece centred in a box of (cols x rows) cells at cell size s.
  function drawPieceCentered(ctx, type, ox, oy, cols, rows, s, tiles) {
    const cells = A.SHAPES[type][0];
    let minX = 9, maxX = -9, minY = 9, maxY = -9;
    cells.forEach(function (c) { minX = Math.min(minX, c[0]); maxX = Math.max(maxX, c[0]); minY = Math.min(minY, c[1]); maxY = Math.max(maxY, c[1]); });
    const w = (maxX - minX + 1) * s, h = (maxY - minY + 1) * s;
    const startX = ox + (cols * s - w) / 2, startY = oy + (rows * s - h) / 2;
    cells.forEach(function (c) {
      K.drawTile(ctx, startX + (c[0] - minX) * s, startY + (c[1] - minY) * s, s, tiles[type]);
    });
  }

  function createRenderer(o) {
    const skin = o.skin, tiles = skin.tiles, pal = skin.palette;
    const COLS = A.COLS, ROWS = A.ROWS, HIDDEN = A.HIDDEN_ROWS, VISIBLE = ROWS - HIDDEN;
    const r = { cell: 24 };
    let wellCtx, holdCtx, nextCtx, miniCell = 16;
    let flash = null; // { rows, board, until }
    let dpr = 1;

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
      const cell = Math.max(12, Math.floor(Math.min(availH / VISIBLE, availW / COLS)));
      r.cell = cell;
      wellCtx = K.setupCanvas(o.wellCanvas, cell * COLS, cell * VISIBLE, dpr);
      miniCell = Math.max(10, Math.round(cell * 0.62));
      holdCtx = K.setupCanvas(o.sideCanvases.hold, miniCell * 4, miniCell * 3, dpr);
      const nextCount = narrow ? 1 : 3;
      nextCtx = K.setupCanvas(o.sideCanvases.next, miniCell * 4, miniCell * (3 * nextCount + (nextCount - 1) * 0.5), dpr);
      r.nextCount = nextCount;
      return { cell: cell };
    };

    function drawWatermark(ctx, w, h) {
      var wa = skin.watermarkAlpha == null ? 0.06 : skin.watermarkAlpha;
      if (wa <= 0 || !skin.logoImage) return;
      const size = Math.min(w, h) * 0.62;
      ctx.globalAlpha = wa;
      ctx.drawImage(skin.logoImage, (w - size) / 2, (h - size) / 2, size, size);
      ctx.globalAlpha = 1;
    }

    r.flash = function (rows, boardSnapshot) {
      if (reducedMotion()) return;
      flash = { rows: rows, board: boardSnapshot, until: performance.now() + FLASH_MS };
    };

    r.draw = function (state, ghostY) {
      const ctx = wellCtx, s = r.cell, w = s * COLS, h = s * VISIBLE;
      ctx.fillStyle = pal.well; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = pal.grid; ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 1; x < COLS; x++) { ctx.moveTo(x * s + 0.5, 0); ctx.lineTo(x * s + 0.5, h); }
      for (let y = 1; y < VISIBLE; y++) { ctx.moveTo(0, y * s + 0.5); ctx.lineTo(w, y * s + 0.5); }
      ctx.stroke();
      drawWatermark(ctx, w, h);

      let board = state.board;
      if (flash) {
        if (performance.now() < flash.until) board = flash.board; else flash = null;
      }
      for (let y = HIDDEN; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          const t = board[y][x];
          if (!t) continue;
          const tone = flash && flash.rows.indexOf(y) !== -1 ? { base: pal.marble, hi: "#FFFFFF", lo: pal.marble } : tiles[t];
          K.drawTile(ctx, x * s, (y - HIDDEN) * s, s, tone);
        }
      }
      if (state.active && state.status !== "over") {
        const a = state.active;
        if (ghostY !== undefined && ghostY !== a.y) {
          A.cellsOf({ type: a.type, rot: a.rot, x: a.x, y: ghostY }).forEach(function (c) {
            if (c[1] >= HIDDEN) drawGhost(ctx, c[0] * s, (c[1] - HIDDEN) * s, s, pal.ghost);
          });
        }
        A.cellsOf(a).forEach(function (c) {
          if (c[1] >= HIDDEN) K.drawTile(ctx, c[0] * s, (c[1] - HIDDEN) * s, s, tiles[a.type]);
        });
      }
    };

    function drawHold(type) {
      const ctx = holdCtx, s = miniCell;
      ctx.clearRect(0, 0, s * 4, s * 3);
      if (type) drawPieceCentered(ctx, type, 0, 0, 4, 3, s, tiles);
    }

    function drawNext(queue, count) {
      const ctx = nextCtx, s = miniCell, n = count || r.nextCount || 3;
      ctx.clearRect(0, 0, s * 4, s * (3 * n + (n - 1) * 0.5));
      for (let i = 0; i < n && i < queue.length; i++) {
        drawPieceCentered(ctx, queue[i], 0, i * 3.5 * s, 4, 3, s, tiles);
      }
    }

    r.side = function (state) {
      drawHold(state.hold);
      drawNext(state.queue);
    };

    r.resize();
    return r;
  }

  G.createRenderer = createRenderer;
})(typeof window !== "undefined" ? window : globalThis);
