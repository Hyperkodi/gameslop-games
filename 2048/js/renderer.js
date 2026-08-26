/* Canvas renderer: square 4x4 well with gapped tiles, numerals, watermark, and a 120ms
   crossfade slide animation driven by the engine's "slide" event (from -> current board).
   Hi-DPI canvas setup and tile bevels come from the kit. */
(function (global) {
  "use strict";
  const K = global.GameSlopKit;
  const G = global.Game = global.Game || {};
  const COLS = 4, ROWS = 4;
  const SLIDE_MS = 120;
  const SERIF = 'Georgia, "Times New Roman", serif';

  function reducedMotion() {
    return global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function createRenderer(o) {
    const skin = o.skin, sprites = skin.sprites, pal = skin.palette;
    const fontStack = '"' + skin.fonts.display + '", ' + SERIF;
    const r = { cell: 96 };
    let wellCtx, dpr = 1;
    let anim = null; // { from: board, start: performance.now(), duration }

    r.resize = function () {
      const vp = K.wellViewport(o.wrapEl);
      dpr = vp.dpr;
      const cell = Math.max(48, Math.floor(Math.min(vp.availW, vp.availH) / COLS));
      r.cell = cell;
      wellCtx = K.setupCanvas(o.wellCanvas, cell * COLS, cell * ROWS, dpr);
      return { cell: cell };
    };

    function toneFor(value) {
      if (value >= 2048) return sprites.t2048plus;
      return sprites["t" + value] || sprites.t2048plus;
    }
    function textColorFor(value) {
      return value >= 128 ? pal.bg : pal.ink;
    }
    function fontSizeFor(cell, value) {
      const digits = String(value).length;
      if (digits >= 4) return cell * 0.30;
      if (digits === 3) return cell * 0.38;
      return cell * 0.46;
    }

    function drawValueTile(ctx, px, py, s, value, alpha) {
      K.drawTile(ctx, px, py, s, toneFor(value), alpha);
      ctx.save();
      ctx.globalAlpha = alpha === undefined ? 1 : alpha;
      ctx.fillStyle = textColorFor(value);
      ctx.font = "bold " + fontSizeFor(s, value) + "px " + fontStack;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(value), px + s / 2, py + s / 2 + s * 0.02);
      ctx.restore();
    }

    // Called from game.js's onEvent hook when a "slide" event arrives; kicks off the 120ms
    // crossfade from the pre-move board to the (now current) post-move board.
    r.slide = function (fromBoard) {
      if (reducedMotion()) return;
      anim = { from: fromBoard, start: performance.now(), duration: SLIDE_MS };
    };

    r.draw = function (state) {
      const ctx = wellCtx, s = r.cell, w = s * COLS, h = s * ROWS;
      ctx.fillStyle = pal.well; ctx.fillRect(0, 0, w, h);
      K.drawWatermark(ctx, skin, w, h);

      const gap = s * 0.08;
      const tsize = s - gap;

      // Empty-cell backdrop: a faint grid square in every cell, drawn under the tiles.
      ctx.fillStyle = pal.grid;
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          ctx.fillRect(x * s + gap / 2, y * s + gap / 2, tsize, tsize);
        }
      }

      let progress = 1, fromBoard = null;
      if (anim) {
        const t = performance.now() - anim.start;
        if (t < anim.duration) { progress = t / anim.duration; fromBoard = anim.from; }
        else { anim = null; }
      }

      if (fromBoard) {
        for (let y = 0; y < ROWS; y++) {
          for (let x = 0; x < COLS; x++) {
            const v = fromBoard[y][x];
            if (v) drawValueTile(ctx, x * s + gap / 2, y * s + gap / 2, tsize, v, 1 - progress);
          }
        }
      }
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          const v = state.board[y][x];
          if (v) drawValueTile(ctx, x * s + gap / 2, y * s + gap / 2, tsize, v, fromBoard ? progress : 1);
        }
      }
    };

    r.resize();
    return r;
  }

  G.createRenderer = createRenderer;
})(typeof window !== "undefined" ? window : globalThis);
