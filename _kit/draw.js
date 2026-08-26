/* Canvas drawing kit: bevelled stone tiles/rects, hi-DPI canvas setup, seamless marble ground, logo stamp. */
(function (global) {
  "use strict";
  const K = global.GameSlopKit = global.GameSlopKit || {};

  function hexToRgba(hex, alpha) {
    const h = hex.replace("#", "");
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    return "rgba(" + r + "," + g + "," + b + "," + alpha + ")";
  }

  // Bevelled rectangle: flat base fill, light bevel on top/left, dark bevel on bottom/right,
  // 1px inset gap all around, optional 1px stroke from tone.edge.
  function drawBevelRect(ctx, x, y, w, h, tone, alpha) {
    ctx.globalAlpha = alpha === undefined ? 1 : alpha;
    const b = Math.max(2, Math.round(Math.min(w, h) * 0.12));
    ctx.fillStyle = tone.base;
    ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
    ctx.fillStyle = tone.hi;
    ctx.fillRect(x + 1, y + 1, w - 2, b);
    ctx.fillRect(x + 1, y + 1, b, h - 2);
    ctx.fillStyle = tone.lo;
    ctx.fillRect(x + 1, y + h - 1 - b, w - 2, b);
    ctx.fillRect(x + w - 1 - b, y + 1, b, h - 2);
    if (tone.edge) {
      ctx.strokeStyle = tone.edge; ctx.lineWidth = 1;
      ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
    }
    ctx.globalAlpha = 1;
  }

  // Square tile — thin wrapper over drawBevelRect for the common w === h === size case.
  function drawTile(ctx, px, py, s, tone, alpha) {
    drawBevelRect(ctx, px, py, s, s, tone, alpha);
  }

  function setupCanvas(canvas, cssW, cssH, dpr) {
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.width = cssW + "px";
    canvas.style.height = cssH + "px";
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    return ctx;
  }

  // Draws `img` centered at (cx, cy) at `size`, rotated by `rotationRad` if given.
  // Alpha and transform are always restored after.
  function drawLogo(ctx, img, cx, cy, size, alpha, rotationRad) {
    if (!img) return;
    ctx.save();
    ctx.globalAlpha = alpha === undefined ? 1 : alpha;
    ctx.translate(cx, cy);
    if (rotationRad) ctx.rotate(rotationRad);
    ctx.drawImage(img, -size / 2, -size / 2, size, size);
    ctx.restore();
  }

  // Shared well-sizing math (title height, touch bar, mobile strip, frame border, paddings) —
  // every renderer's resize() calls this, then applies its own aspect-specific cell/scale line
  // to {availW, availH}.
  function wellViewport(wrapEl) {
    const dpr = Math.min(global.devicePixelRatio || 1, 3);
    const narrow = global.innerWidth < 760;
    const frame = parseFloat(getComputedStyle(wrapEl).borderTopWidth) || 14;
    const titleH = (document.querySelector(".title") || {}).offsetHeight || 60;
    const touchEl = document.getElementById("touch");
    const touchH = touchEl && getComputedStyle(touchEl).display !== "none" ? touchEl.offsetHeight : 0;
    const stripH = narrow ? ((document.querySelector(".panel-left") || {}).offsetHeight || 70) + 8 : 0;
    const availH = global.innerHeight - titleH - touchH - stripH - 2 * frame - 24;
    const availW = global.innerWidth - (narrow ? 20 : 2 * (172 + 22) + 32) - 2 * frame;
    return { availW: availW, availH: availH, narrow: narrow, dpr: dpr };
  }

  // Faint centered logo behind the well grid. skin.watermarkAlpha (default 0.06) and
  // skin.logoImage (preloaded by skin.js) gate it; scale is the fraction of min(w, h).
  function drawWatermark(ctx, skin, w, h, scale) {
    const wa = skin.watermarkAlpha == null ? 0.06 : skin.watermarkAlpha;
    if (wa <= 0 || !skin.logoImage) return;
    const size = Math.min(w, h) * (scale === undefined ? 0.62 : scale);
    ctx.globalAlpha = wa;
    ctx.drawImage(skin.logoImage, (w - size) / 2, (h - size) / 2, size, size);
    ctx.globalAlpha = 1;
  }

  // The seamless 512px marble ground tile from Armaratris' renderer: soft cloudy patches +
  // veins, each shape drawn at all nine wrap offsets so the tile repeats without a seam.
  // Accepts the legacy palette argument or a full skin. A skin may add a presentation-only
  // background image beneath a dark readability wash; the procedural tile remains the fallback.
  function paintGround(skinOrPalette) {
    const skin = skinOrPalette && skinOrPalette.palette ? skinOrPalette : null;
    const palette = skin ? skin.palette : skinOrPalette;
    const size = 512;
    const wrap = [-size, 0, size]; // draw every shape 9x so it tiles seamlessly across edges
    const c = document.createElement("canvas"); c.width = size; c.height = size;
    const ctx = c.getContext("2d");
    const rng = K.mulberry32(7);
    ctx.fillStyle = palette.bg; ctx.fillRect(0, 0, size, size);
    // soft cloudy patches
    for (let i = 0; i < 18; i++) {
      const cx = rng() * size, cy = rng() * size, rad = 120 + rng() * 160;
      for (let wx = 0; wx < wrap.length; wx++) {
        for (let wy = 0; wy < wrap.length; wy++) {
          ctx.save();
          ctx.translate(wrap[wx], wrap[wy]);
          const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
          g.addColorStop(0, hexToRgba(palette.marble, 0.035)); g.addColorStop(1, hexToRgba(palette.marble, 0));
          ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
          ctx.restore();
        }
      }
    }
    // veins
    ctx.strokeStyle = palette.marble; ctx.lineCap = "round";
    for (let i = 0; i < 26; i++) {
      ctx.globalAlpha = 0.025 + rng() * 0.04;
      ctx.lineWidth = 0.6 + rng() * 2.2;
      const x0 = rng() * size, y0 = rng() * size;
      const segs = [];
      let x = x0, y = y0;
      for (let k = 0; k < 4; k++) {
        const nx = x + (rng() - 0.5) * 260, ny = y + (rng() - 0.5) * 260;
        segs.push([x + (rng() - 0.5) * 120, y + (rng() - 0.5) * 120, nx, ny]);
        x = nx; y = ny;
      }
      for (let wx = 0; wx < wrap.length; wx++) {
        for (let wy = 0; wy < wrap.length; wy++) {
          ctx.save();
          ctx.translate(wrap[wx], wrap[wy]);
          ctx.beginPath(); ctx.moveTo(x0, y0);
          for (let k = 0; k < segs.length; k++) ctx.quadraticCurveTo(segs[k][0], segs[k][1], segs[k][2], segs[k][3]);
          ctx.stroke();
          ctx.restore();
        }
      }
    }
    ctx.globalAlpha = 1;
    const tile = "url(" + c.toDataURL("image/png") + ")";
    const background = skin && skin.background && skin.background.image ? skin.background : null;
    if (background) {
      let overlay = Number(background.overlay);
      if (!Number.isFinite(overlay)) overlay = 0.72;
      overlay = Math.max(0, Math.min(1, overlay));
      const imageUrl = (skin.base || "") + background.image;
      const escapedUrl = imageUrl.replace(/(["\\])/g, "\\$1");
      const wash = hexToRgba(palette.bg, overlay);
      document.body.style.backgroundImage =
        "linear-gradient(" + wash + ", " + wash + "), url(\"" + escapedUrl + "\"), " + tile;
      document.body.style.backgroundSize = "cover, cover, " + size + "px " + size + "px";
      document.body.style.backgroundPosition = "center, " + (background.position || "center") + ", 0 0";
      document.body.style.backgroundRepeat = "no-repeat, no-repeat, repeat";
    } else {
      document.body.style.backgroundImage = tile;
      document.body.style.backgroundSize = size + "px " + size + "px";
      document.body.style.backgroundPosition = "0 0";
      document.body.style.backgroundRepeat = "repeat";
    }
  }

  Object.assign(K, {
    drawTile: drawTile, drawBevelRect: drawBevelRect, hexToRgba: hexToRgba,
    setupCanvas: setupCanvas, paintGround: paintGround, drawLogo: drawLogo,
    wellViewport: wellViewport, drawWatermark: drawWatermark,
  });
})(typeof window !== "undefined" ? window : globalThis);
