/* Armara Aegis landscape renderer and contextual command controller.
   Simulation data is read-only here: interpolation, poses, projectiles, panel state and effects
   are presentation-only and never feed targeting, damage, economy, hit testing or replay logs. */
(function (global) {
  "use strict";

  const K = global.GameSlopKit;
  const G = global.Game = global.Game || {};
  const FALLBACK_WORLD_W = 160;
  const FALLBACK_WORLD_H = 100;
  const LOCAL_PATH = [
    [-8, 18], [42, 18], [42, 48], [88, 48],
    [88, 76], [132, 76], [132, 44], [168, 44],
  ];
  const LOCAL_PADS = [
    [18, 34], [61, 17], [61, 64], [76, 31], [104, 32],
    [105, 61], [106, 90], [148, 88], [148, 61], [148, 27],
  ];
  const LOCAL_TOWER_STATS = {
    sentinel: [
      { buildCost: 40, damage: 8, cooldownMs: 450, range: 22 },
      { upgradeCost: 35, damage: 12, cooldownMs: 410, range: 24 },
      { upgradeCost: 60, damage: 18, cooldownMs: 360, range: 26 },
    ],
    chronos: [
      { buildCost: 55, damage: 3, cooldownMs: 800, range: 20, slowPct: 0.35, slowMs: 1500 },
      { upgradeCost: 45, damage: 5, cooldownMs: 720, range: 22, slowPct: 0.45, slowMs: 1700 },
      { upgradeCost: 75, damage: 8, cooldownMs: 650, range: 24, slowPct: 0.55, slowMs: 1900 },
    ],
    siege: [
      { buildCost: 75, damage: 18, cooldownMs: 1350, range: 24, splash: 5 },
      { upgradeCost: 60, damage: 28, cooldownMs: 1250, range: 26, splash: 6 },
      { upgradeCost: 90, damage: 42, cooldownMs: 1150, range: 28, splash: 7 },
    ],
  };
  const TOWER_ORDER = ["sentinel", "chronos", "siege"];
  const TOWER_INFO = {
    sentinel: { label: "SENTINEL", role: "Rapid single-target striker", color: "#22D9FF", dark: "#075E78" },
    chronos: { label: "CHRONOS", role: "Slows enemies with time energy", color: "#B66CFF", dark: "#542587" },
    siege: { label: "SIEGE", role: "Heavy splash-damage artillery", color: "#FF704F", dark: "#8E2C20" },
  };
  const ENEMY_SIZE = {
    scout: { world: 7.2, min: 34, max: 54 },
    raider: { world: 8.7, min: 40, max: 66 },
    guardian: { world: 10.2, min: 48, max: 78 },
    titan: { world: 13.2, min: 64, max: 108 },
  };
  const MAX_SPRITE_DIM = 768;
  const MAX_EFFECTS = 128;
  const TWO_PI = Math.PI * 2;

  function clamp(value, low, high) { return value < low ? low : (value > high ? high : value); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeOutCubic(t) { const p = 1 - clamp(t, 0, 1); return 1 - p * p * p; }
  function easeOutBack(t) {
    const c1 = 1.70158, c3 = c1 + 1, p = clamp(t, 0, 1) - 1;
    return 1 + c3 * p * p * p + c1 * p * p;
  }
  function pointPair(point) {
    if (Array.isArray(point)) return { x: Number(point[0]), y: Number(point[1]) };
    return { x: Number(point && point.x), y: Number(point && point.y) };
  }
  function normalizedPoints(source, fallback) {
    const points = Array.isArray(source) && source.length ? source : fallback;
    return points.map(pointPair);
  }
  function reducedMotion() {
    return !!(global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }
  function shortestAngle(from, to) {
    let delta = (to - from + Math.PI) % TWO_PI;
    if (delta < 0) delta += TWO_PI;
    return delta - Math.PI;
  }
  function element(id) { return document.getElementById(id); }
  function setText(el, value) { if (el && el.textContent !== String(value)) el.textContent = String(value); }
  function setHidden(el, hidden) { if (el) el.hidden = !!hidden; }
  function imageWidth(img) { return Number(img && (img.naturalWidth || img.width)) || 1; }
  function imageHeight(img) { return Number(img && (img.naturalHeight || img.height)) || 1; }
  function isLightNeutral(data, offset) {
    const r = data[offset], g = data[offset + 1], b = data[offset + 2];
    return Math.min(r, g, b) >= 225 && Math.max(r, g, b) - Math.min(r, g, b) <= 12;
  }
  function isDarkNeutral(data, offset) {
    const r = data[offset], g = data[offset + 1], b = data[offset + 2];
    return Math.max(r, g, b) <= 24 && Math.max(r, g, b) - Math.min(r, g, b) <= 8;
  }

  // The built-in generator occasionally exports a visually transparent neutral matte as RGB.
  // Prepare every foreground image once: genuine alpha is preserved verbatim, while only an
  // edge-connected light/dark neutral exterior is removed. Black outlines protect enclosed
  // ivory/gold details, and the opaque battlefield is deliberately excluded.
  function prepareSpriteImage(key, img) {
    if (/battlefield/i.test(key)) return img;
    const scale = Math.min(1, MAX_SPRITE_DIM / Math.max(img.naturalWidth, img.naturalHeight));
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return img;
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, width, height);
    let pixels;
    try { pixels = ctx.getImageData(0, 0, width, height); } catch (error) { return img; }
    const data = pixels.data;
    for (let offset = 3; offset < data.length; offset += 4) if (data[offset] !== 255) return canvas;
    let lightEdges = 0, darkEdges = 0;
    function count(index) {
      const offset = index * 4;
      if (isLightNeutral(data, offset)) lightEdges++;
      if (isDarkNeutral(data, offset)) darkEdges++;
    }
    for (let x = 0; x < width; x++) { count(x); count((height - 1) * width + x); }
    for (let y = 1; y < height - 1; y++) { count(y * width); count(y * width + width - 1); }
    if (Math.max(lightEdges, darkEdges) < 4) return canvas;
    const edgeTest = lightEdges >= darkEdges ? isLightNeutral : isDarkNeutral;
    const total = width * height, visited = new Uint8Array(total), queue = new Int32Array(total);
    let head = 0, tail = 0;
    function enqueue(index) {
      if (index < 0 || index >= total || visited[index] || !edgeTest(data, index * 4)) return;
      visited[index] = 1; queue[tail++] = index;
    }
    for (let x = 0; x < width; x++) { enqueue(x); enqueue((height - 1) * width + x); }
    for (let y = 1; y < height - 1; y++) { enqueue(y * width); enqueue(y * width + width - 1); }
    while (head < tail) {
      const index = queue[head++], x = index % width;
      data[index * 4 + 3] = 0;
      if (x > 0) enqueue(index - 1);
      if (x + 1 < width) enqueue(index + 1);
      if (index >= width) enqueue(index - width);
      if (index + width < total) enqueue(index + width);
    }
    // Generated checkerboard mattes can also be trapped inside rings, handles, or spread legs.
    // Remove only large enclosed light-neutral components; small white highlights and ivory
    // details remain protected, while visible checkerboard islands become transparent.
    if (edgeTest === isLightNeutral) {
      const minimumIsland = Math.max(96, Math.round(total * 0.0005));
      for (let seed = 0; seed < total; seed++) {
        if (visited[seed] || !edgeTest(data, seed * 4)) continue;
        head = 0; tail = 0; enqueue(seed);
        while (head < tail) {
          const index = queue[head++], x = index % width;
          if (x > 0) enqueue(index - 1);
          if (x + 1 < width) enqueue(index + 1);
          if (index >= width) enqueue(index - width);
          if (index + width < total) enqueue(index + width);
        }
        if (tail >= minimumIsland) {
          for (let i = 0; i < tail; i++) data[queue[i] * 4 + 3] = 0;
        }
      }
    }
    ctx.putImageData(pixels, 0, 0);
    return canvas;
  }

  function createRenderer(options) {
    const skin = options.skin, pal = skin.palette, fx = skin.effects || {};
    const worldW = Number(G.WORLD_W) || FALLBACK_WORLD_W;
    const worldH = Number(G.WORLD_H) || FALLBACK_WORLD_H;
    const path = normalizedPoints(G.PATH, LOCAL_PATH);
    const pads = normalizedPoints(G.PADS, LOCAL_PADS);
    const towerStats = G.TOWER_STATS || LOCAL_TOWER_STATS;
    const r = { cell: 4 }, images = {};
    const previousEnemies = new Map(), enemyPoses = new Map(), towerPoses = new Map();
    let effects = [], wellCtx = null, dpr = 1, lastState = null;
    let lastFrameNow = 0, visualNow = 0, visualDelta = 0, assetVersion = 0;
    let lastDrawStatus = null, lastDrawTick = -1, assetsSettled = 0, assetsLoaded = 0;
    let uiSignature = "", panelOpen = false, focusBeforePanel = null, feedbackUntil = 0;

    const ui = {
      aether: element("aether"), integrity: element("integrity"), wave: element("wave"), score: element("score"),
      aetherFeedback: element("aetherFeedback"),
      waveButton: element("waveButton") || document.querySelector('[data-btn="wave"]'),
      waveButtonLabel: element("waveButtonLabel"),
      panel: element("commandPanel"), panelTitle: element("panelTitle"), panelSubtitle: element("panelSubtitle"),
      panelClose: element("panelClose") || document.querySelector('[data-panel-action="close"]'),
      panelFeedback: element("panelFeedback"),
      buildPanel: element("buildPanel") || document.querySelector('[data-panel-view="build"]'),
      inspectorPanel: element("inspectorPanel") || document.querySelector('[data-panel-view="inspector"]'),
      inspectorPortrait: element("inspectorPortrait"), inspectorName: element("inspectorName"),
      inspectorLevel: element("inspectorLevel"), inspectorRole: element("inspectorRole"),
      inspectorDamage: element("inspectorDamage"), inspectorRate: element("inspectorRate"),
      inspectorRange: element("inspectorRange"), inspectorSpecial: element("inspectorSpecial"),
      inspectorNextDamage: element("inspectorNextDamage"), inspectorNextRate: element("inspectorNextRate"),
      inspectorNextRange: element("inspectorNextRange"), inspectorNextSpecial: element("inspectorNextSpecial"),
      upgradeButton: element("upgradeButton") || document.querySelector('[data-btn="upgrade"]'),
      upgradePrice: element("upgradePrice"), upgradeMax: element("upgradeMax"),
      sellButton: element("sellButton") || document.querySelector('[data-btn="sell"]'),
      sellRefund: element("sellRefund"), statusText: element("statusText"),
    };

    const segments = [];
    let pathLength = 0;
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1], b = path[i], length = Math.hypot(b.x - a.x, b.y - a.y);
      segments.push({ a: a, b: b, start: pathLength, length: length, angle: Math.atan2(b.y - a.y, b.x - a.x) });
      pathLength += length;
    }
    function makeRouteStonework(compact) {
      const spacing = compact ? 9 : 6.2, inset = compact ? 4.5 : 3.4, faceHalf = 4.05;
      const courseEdges = compact ? [-faceHalf, faceHalf] : [-faceHalf, -1.35, 1.35, faceHalf];
      const courses = [], joints = [], chips = [];
      function line(segment, distanceA, offsetA, distanceB, offsetB) {
        const tx = Math.cos(segment.angle), ty = Math.sin(segment.angle), nx = -ty, ny = tx;
        return [
          segment.a.x + tx * distanceA + nx * offsetA,
          segment.a.y + ty * distanceA + ny * offsetA,
          segment.a.x + tx * distanceB + nx * offsetB,
          segment.a.y + ty * distanceB + ny * offsetB,
        ];
      }
      segments.forEach(function (segment, segmentIndex) {
        if (segment.length <= inset * 2) return;
        if (!compact) {
          courses.push(line(segment, inset, -1.35, segment.length - inset, -1.35));
          courses.push(line(segment, inset, 1.35, segment.length - inset, 1.35));
        }
        for (let row = 0; row < courseEdges.length - 1; row++) {
          const low = courseEdges[row] + 0.08, high = courseEdges[row + 1] - 0.08;
          const phase = spacing * (0.3 + ((segmentIndex * 2 + row) % 3) / 3);
          for (let distance = inset + phase; distance < segment.length - inset; distance += spacing) {
            joints.push(line(segment, distance, low, distance, high));
          }
        }
        if (!compact) {
          for (let distance = inset + spacing * 1.45; distance < segment.length - inset; distance += spacing * 3) {
            const offset = ((segmentIndex + Math.round(distance / spacing)) % 3 - 1) * 1.75;
            const first = line(segment, distance, offset, distance + 0.7, offset + 0.34);
            const second = line(segment, distance + 0.7, offset + 0.34, distance + 1.25, offset + 0.08);
            chips.push([first[0], first[1], first[2], first[3], second[2], second[3]]);
          }
        }
      });
      return { courses: courses, joints: joints, chips: chips };
    }
    const detailedRouteStonework = makeRouteStonework(false);
    const compactRouteStonework = makeRouteStonework(true);

    const artKeys = Object.keys(skin.art || {});
    if (document.body) document.body.dataset.artReady = artKeys.length ? "0" : "1";
    function settleAsset(loaded) {
      assetsSettled++; if (loaded) assetsLoaded++;
      if (document.body && assetsSettled >= artKeys.length) document.body.dataset.artReady = "1";
    }
    artKeys.forEach(function (key) {
      const img = new Image(); images[key] = null;
      img.onload = function () { images[key] = prepareSpriteImage(key, img); assetVersion++; uiSignature = ""; settleAsset(true); };
      img.onerror = function () { images[key] = null; assetVersion++; uiSignature = ""; settleAsset(false); };
      img.src = skin.base + skin.art[key];
    });
    r.assetStatus = function () { return { total: artKeys.length, settled: assetsSettled, loaded: assetsLoaded, ready: assetsSettled >= artKeys.length }; };

    function imageFor() {
      for (let i = 0; i < arguments.length; i++) if (images[arguments[i]]) return images[arguments[i]];
      return null;
    }
    function towerType(tower) { return String(tower && (tower.type || tower.kind || tower.towerType) || "sentinel").toLowerCase(); }
    function towerLevel(tower) { return clamp(Math.trunc(Number(tower && tower.level) || 1), 1, 3); }
    function towerPadIndex(tower) {
      const value = tower && (tower.padIndex !== undefined ? tower.padIndex : tower.pad);
      return Number.isFinite(Number(value)) ? Number(value) : -1;
    }
    function enemyKind(enemy) { return String(enemy && (enemy.type || enemy.kind || enemy.enemyType) || "raider").toLowerCase(); }
    function towerAtPad(state, index) {
      return (state.towers || []).find(function (tower) { return towerPadIndex(tower) === index; }) || null;
    }
    function selectedTower(state) {
      return towerAtPad(state, clamp(Math.trunc(Number(state.selectedPad) || 0), 0, pads.length - 1));
    }
    function towerPoint(tower) {
      if (tower && Number.isFinite(tower.x) && Number.isFinite(tower.y)) return { x: tower.x, y: tower.y };
      return pads[towerPadIndex(tower)] || pads[0];
    }
    function statLevel(type, level) {
      const table = towerStats[type] || LOCAL_TOWER_STATS[type] || [];
      if (Array.isArray(table)) return table[clamp(level - 1, 0, table.length - 1)] || {};
      if (Array.isArray(table.levels)) return table.levels[clamp(level - 1, 0, table.levels.length - 1)] || {};
      return table[level] || {};
    }
    function buildCost(type) {
      const stats = statLevel(type, 1);
      return Number(stats.buildCost !== undefined ? stats.buildCost : (skin.towers && skin.towers[type] && skin.towers[type].cost)) || 0;
    }
    function upgradeCost(tower) {
      if (!tower || towerLevel(tower) >= 3) return 0;
      const next = statLevel(towerType(tower), towerLevel(tower) + 1);
      return Number(next.upgradeCost !== undefined ? next.upgradeCost : next.cost) || 0;
    }
    function investedAmount(tower) {
      if (!tower) return 0;
      if (Number.isFinite(Number(tower.invested))) return Number(tower.invested);
      const type = towerType(tower), level = towerLevel(tower);
      let total = buildCost(type);
      for (let i = 2; i <= level; i++) total += Number(statLevel(type, i).upgradeCost) || 0;
      return total;
    }
    function refundAmount(tower) { return Math.floor(investedAmount(tower) * 0.7); }
    function towerInfo(type) {
      const defaults = TOWER_INFO[type] || TOWER_INFO.sentinel;
      const fromSkin = skin.towers && skin.towers[type] || {}, tone = fromSkin.tone || {};
      return {
        label: fromSkin.label || defaults.label, role: fromSkin.role || defaults.role,
        color: tone.base || defaults.color, dark: tone.lo || defaults.dark,
        edge: tone.edge || pal.marble || "#FFF7E7",
      };
    }
    function attacksPerSecond(stats) {
      const rate = 1000 / Math.max(1, Number(stats.cooldownMs) || 1000);
      return (rate >= 10 ? String(Math.round(rate)) : rate.toFixed(2)).replace(/0+$/, "").replace(/\.$/, "");
    }
    function specialStat(type, stats) {
      if (type === "chronos") return Math.round((Number(stats.slowPct) || 0) * 100) + "% slow / " + ((Number(stats.slowMs) || 0) / 1000).toFixed(1).replace(/\.0$/, "") + "s";
      if (type === "siege") return "Splash radius " + (Number(stats.splash) || 0);
      return "Single target";
    }
    function pointAlongPath(distance) {
      const d = clamp(Number(distance) || 0, 0, pathLength);
      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        if (d <= segment.start + segment.length || i === segments.length - 1) {
          const t = segment.length ? clamp((d - segment.start) / segment.length, 0, 1) : 0;
          return { x: lerp(segment.a.x, segment.b.x, t), y: lerp(segment.a.y, segment.b.y, t), segment: i, angle: segment.angle };
        }
      }
      const end = path[path.length - 1];
      return { x: end.x, y: end.y, segment: segments.length - 1, angle: segments[segments.length - 1].angle };
    }

    function drawAtlasCell(ctx, img, index, columns, rows, x, y, width, height, alpha) {
      if (!img) return false;
      const sourceW = imageWidth(img), sourceH = imageHeight(img);
      const cellW = sourceW / columns, cellH = sourceH / rows;
      const safeIndex = clamp(Math.trunc(index), 0, columns * rows - 1);
      ctx.save(); if (alpha !== undefined) ctx.globalAlpha *= alpha;
      ctx.drawImage(img, (safeIndex % columns) * cellW, Math.floor(safeIndex / columns) * cellH, cellW, cellH, x, y, width, height);
      ctx.restore(); return true;
    }
    function drawAtlasCellContained(ctx, img, index, columns, rows, x, y, width, height) {
      if (!img) return false;
      const cellW = imageWidth(img) / columns, cellH = imageHeight(img) / rows;
      const ratio = Math.min(width / cellW, height / cellH);
      const drawW = cellW * ratio, drawH = cellH * ratio;
      return drawAtlasCell(ctx, img, index, columns, rows, x + (width - drawW) / 2, y + (height - drawH) / 2, drawW, drawH);
    }
    function coverImage(ctx, img, width, height) {
      const scale = Math.max(width / imageWidth(img), height / imageHeight(img));
      const drawW = imageWidth(img) * scale, drawH = imageHeight(img) * scale;
      ctx.drawImage(img, (width - drawW) / 2, (height - drawH) / 2, drawW, drawH);
    }
    function traceRoute(ctx, scale) {
      ctx.beginPath(); ctx.moveTo(path[0].x * scale, path[0].y * scale);
      for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x * scale, path[i].y * scale);
    }
    function drawBackground(ctx, scale, width, height) {
      ctx.fillStyle = pal.well || "#111725"; ctx.fillRect(0, 0, width, height);
      const battlefield = imageFor("battlefieldV2", "battlefield");
      if (battlefield) {
        ctx.save(); ctx.globalAlpha = 0.72; coverImage(ctx, battlefield, width, height); ctx.restore();
        ctx.fillStyle = "rgba(5,10,22,.34)"; ctx.fillRect(0, 0, width, height);
      } else {
        const gradient = ctx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, "#24313B"); gradient.addColorStop(0.52, "#151E29"); gradient.addColorStop(1, "#2A2020");
        ctx.fillStyle = gradient; ctx.fillRect(0, 0, width, height);
        ctx.strokeStyle = "rgba(239,232,216,.055)"; ctx.lineWidth = Math.max(1, scale * 0.16);
        for (let y = 8; y < worldH; y += 10) { ctx.beginPath(); ctx.moveTo(0, y * scale); ctx.lineTo(width, y * scale); ctx.stroke(); }
      }
      K.drawWatermark(ctx, skin, width, height, 0.26);
    }
    function drawRoute(ctx, scale) {
      ctx.save(); ctx.lineCap = "square"; ctx.lineJoin = "round";
      traceRoute(ctx, scale); ctx.strokeStyle = fx.outline || "#071622"; ctx.globalAlpha = 0.92; ctx.lineWidth = 13.2 * scale; ctx.stroke();
      traceRoute(ctx, scale); ctx.strokeStyle = fx.pathCurb || "#D8BE78"; ctx.globalAlpha = 0.92; ctx.lineWidth = 11.4 * scale; ctx.stroke();
      traceRoute(ctx, scale); ctx.strokeStyle = fx.pathEdge || "#5B432B"; ctx.globalAlpha = 0.96; ctx.lineWidth = 10.1 * scale; ctx.stroke();
      traceRoute(ctx, scale); ctx.strokeStyle = fx.path || "#B9A06F"; ctx.globalAlpha = 0.98; ctx.lineWidth = 9.1 * scale; ctx.stroke();
      traceRoute(ctx, scale); ctx.strokeStyle = K.hexToRgba(fx.pathHighlight || "#FFEFC6", 0.12); ctx.lineWidth = 8.5 * scale; ctx.stroke();

      // Staggered mortar joints turn the route into a worn ashlar causeway instead of a
      // modern traffic lane. The pattern is derived from segment/row indexes so it never
      // shimmers between frames, and it simplifies automatically at small canvas scales.
      const compact = scale < 3;
      const stonework = compact ? compactRouteStonework : detailedRouteStonework;
      ctx.globalAlpha = 1;
      ctx.strokeStyle = K.hexToRgba(fx.pathJoint || "#37281C", compact ? 0.24 : 0.38);
      ctx.lineWidth = Math.max(1, 0.18 * scale);
      ctx.lineCap = "round";
      function strokeLines(lines) {
        ctx.beginPath();
        lines.forEach(function (line) {
          ctx.moveTo(line[0] * scale, line[1] * scale); ctx.lineTo(line[2] * scale, line[3] * scale);
        });
        ctx.stroke();
      }
      if (stonework.courses.length) strokeLines(stonework.courses);
      strokeLines(stonework.joints);
      if (stonework.chips.length) {
        ctx.strokeStyle = K.hexToRgba(fx.pathHighlight || "#FFEFC6", 0.2);
        ctx.lineWidth = Math.max(1, 0.11 * scale);
        ctx.beginPath();
        stonework.chips.forEach(function (chip) {
          ctx.moveTo(chip[0] * scale, chip[1] * scale); ctx.lineTo(chip[2] * scale, chip[3] * scale); ctx.lineTo(chip[4] * scale, chip[5] * scale);
        });
        ctx.stroke();
      }
      ctx.restore();
    }
    function drawBreach(ctx, scale) {
      const x = 2 * scale, y = 18 * scale;
      const pulse = reducedMotion() ? 0 : (Math.sin(visualNow / 210) + 1) * 0.5;
      const radius = Math.max(30, (6.2 + pulse * 0.8) * scale);
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, "rgba(255,81,137,.96)"); gradient.addColorStop(0.42, "rgba(182,29,91,.66)"); gradient.addColorStop(1, "rgba(59,7,45,0)");
      ctx.fillStyle = gradient; ctx.beginPath(); ctx.arc(x, y, radius, 0, TWO_PI); ctx.fill();
      const img = imageFor("breach");
      if (img) { const size = clamp(14 * scale, 48, 94); ctx.drawImage(img, x - size / 2, y - size / 2, size, size); }
      else { ctx.strokeStyle = "#FF4F9B"; ctx.lineWidth = Math.max(2, 0.5 * scale); ctx.beginPath(); ctx.arc(x, y, Math.max(12, 3.5 * scale), 0, TWO_PI); ctx.stroke(); }
    }
    function drawGate(ctx, scale) {
      const x = 157 * scale, y = 44 * scale, img = imageFor("gate"), size = clamp(17 * scale, 58, 112);
      ctx.save(); ctx.shadowColor = "rgba(255,215,112,.55)"; ctx.shadowBlur = Math.max(8, 1.6 * scale);
      if (img) ctx.drawImage(img, x - size / 2, y - size / 2, size, size);
      else { ctx.fillStyle = pal.marble; ctx.fillRect(x - size * 0.28, y - size * 0.42, size * 0.56, size * 0.84); ctx.strokeStyle = pal.gold; ctx.lineWidth = Math.max(2, 0.5 * scale); ctx.strokeRect(x - size * 0.28, y - size * 0.42, size * 0.56, size * 0.84); }
      ctx.restore(); if (skin.logoImage) K.drawLogo(ctx, skin.logoImage, x, y, size * 0.34, 1);
    }
    function drawRange(ctx, scale, state) {
      const tower = selectedTower(state); if (!tower || !panelOpen) return;
      const p = towerPoint(tower), stats = statLevel(towerType(tower), towerLevel(tower));
      const radius = (Number(stats.range) || 0) * scale, color = towerInfo(towerType(tower)).color;
      ctx.save(); ctx.fillStyle = K.hexToRgba(color, 0.09); ctx.strokeStyle = K.hexToRgba(color, 0.86);
      ctx.lineWidth = Math.max(2, 0.36 * scale); ctx.setLineDash([1.3 * scale, 1.05 * scale]);
      ctx.beginPath(); ctx.arc(p.x * scale, p.y * scale, radius, 0, TWO_PI); ctx.fill(); ctx.stroke(); ctx.restore();
    }
    function drawPads(ctx, scale, state) {
      const selected = clamp(Math.trunc(Number(state.selectedPad) || 0), 0, pads.length - 1);
      for (let i = 0; i < pads.length; i++) {
        const p = pads[i], tower = towerAtPad(state, i), active = i === selected;
        const x = p.x * scale, y = p.y * scale, radius = Math.max(12, 4.1 * scale);
        const pulse = active && !reducedMotion() ? 1 + Math.sin(visualNow / 170) * 0.08 : 1;
        ctx.save(); ctx.fillStyle = tower ? "rgba(4,10,18,.76)" : "rgba(233,240,246,.20)";
        ctx.strokeStyle = active ? "#FFF5CF" : "rgba(201,162,74,.82)";
        ctx.lineWidth = active ? Math.max(3, 0.58 * scale) : Math.max(2, 0.34 * scale);
        ctx.beginPath(); ctx.arc(x, y, radius * pulse, 0, TWO_PI); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = active ? "rgba(40,220,255,.88)" : "rgba(239,232,216,.42)"; ctx.lineWidth = Math.max(1, 0.2 * scale);
        ctx.beginPath(); ctx.arc(x, y, radius * 0.67, 0, TWO_PI); ctx.stroke();
        if (!tower) {
          ctx.strokeStyle = active ? "#FFF5CF" : "rgba(239,232,216,.68)"; ctx.lineWidth = Math.max(2, 0.42 * scale);
          const arm = radius * 0.34; ctx.beginPath(); ctx.moveTo(x - arm, y); ctx.lineTo(x + arm, y); ctx.moveTo(x, y - arm); ctx.lineTo(x, y + arm); ctx.stroke();
        }
        ctx.restore();
      }
    }
    function drawShadow(ctx, x, y, width, alpha) {
      ctx.save(); ctx.fillStyle = "rgba(2,5,12," + (alpha === undefined ? 0.52 : alpha) + ")";
      ctx.beginPath(); ctx.ellipse(x, y, width * 0.42, width * 0.14, 0, 0, TWO_PI); ctx.fill(); ctx.restore();
    }
    function drawProceduralBase(ctx, type, size) {
      const info = towerInfo(type); ctx.fillStyle = "#07101B"; ctx.strokeStyle = info.edge; ctx.lineWidth = Math.max(2, size * 0.035);
      ctx.beginPath(); ctx.arc(0, size * 0.1, size * 0.34, 0, TWO_PI); ctx.fill(); ctx.stroke();
      ctx.fillStyle = info.dark; ctx.beginPath(); ctx.arc(0, size * 0.05, size * 0.26, 0, TWO_PI); ctx.fill();
    }
    function drawProceduralTop(ctx, type, size) {
      const info = towerInfo(type); ctx.fillStyle = info.color; ctx.strokeStyle = "#FFF5D8"; ctx.lineWidth = Math.max(2, size * 0.035); ctx.lineJoin = "round";
      if (type === "siege") {
        ctx.fillRect(-size * 0.12, -size * 0.15, size * 0.42, size * 0.3); ctx.strokeRect(-size * 0.12, -size * 0.15, size * 0.42, size * 0.3);
        ctx.beginPath(); ctx.arc(-size * 0.11, 0, size * 0.19, 0, TWO_PI); ctx.fill(); ctx.stroke();
      } else if (type === "chronos") {
        ctx.beginPath(); ctx.arc(0, 0, size * 0.25, 0, TWO_PI); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(size * 0.1, 0); ctx.lineTo(size * 0.38, 0); ctx.stroke();
      } else {
        ctx.beginPath(); ctx.moveTo(-size * 0.12, -size * 0.18); ctx.lineTo(size * 0.4, 0); ctx.lineTo(-size * 0.12, size * 0.18); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
    }
    function towerArt(type) {
      const cap = type.charAt(0).toUpperCase() + type.slice(1);
      return { base: imageFor(type + "BaseAtlas"), top: imageFor(type + "TopAtlas"), legacy: function (level) { return imageFor(type + "L" + level, cap + "L" + level); } };
    }
    function currentTowerTransform(tower) {
      let pose = towerPoses.get(tower.id);
      if (!pose) { pose = { angle: 0, targetAngle: 0, attackAt: -Infinity, flourishAt: -Infinity }; towerPoses.set(tower.id, pose); }
      pose.angle += shortestAngle(pose.angle, pose.targetAngle || 0) * (reducedMotion() ? 1 : clamp(visualDelta / 95, 0, 1));
      const attackAge = visualNow - pose.attackAt;
      let recoil = 0, charge = 0, spin = 0;
      if (!reducedMotion() && attackAge >= 0 && attackAge < 360) {
        const type = towerType(tower);
        if (type === "sentinel") recoil = Math.sin(clamp(attackAge / 170, 0, 1) * Math.PI) * 0.09;
        else if (type === "chronos") { charge = Math.sin(clamp(attackAge / 250, 0, 1) * Math.PI) * 0.12; spin = clamp(attackAge / 250, 0, 1) * TWO_PI; }
        else recoil = Math.sin(clamp(attackAge / 330, 0, 1) * Math.PI) * 0.13;
      }
      let pop = 1; const flourishAge = visualNow - pose.flourishAt;
      if (!reducedMotion() && flourishAge >= 0 && flourishAge < 360) pop = 0.72 + 0.28 * easeOutBack(flourishAge / 360);
      return { pose: pose, recoil: recoil, charge: charge, spin: spin, pop: pop };
    }
    function drawTower(ctx, scale, tower) {
      const type = towerType(tower), level = towerLevel(tower), p = towerPoint(tower), x = p.x * scale, y = p.y * scale;
      const size = clamp((type === "siege" ? 15.5 : 14.5) * scale, 52, 108), art = towerArt(type), transform = currentTowerTransform(tower);
      drawShadow(ctx, x, y + size * 0.33, size, 0.58);
      ctx.save(); ctx.translate(x, y); ctx.scale(transform.pop, transform.pop);
      if (art.base) drawAtlasCell(ctx, art.base, level - 1, 3, 1, -size / 2, -size / 2, size, size);
      else if (!art.legacy(level)) drawProceduralBase(ctx, type, size);
      ctx.save(); ctx.rotate(transform.pose.angle + transform.spin); ctx.translate(-size * transform.recoil, 0);
      const topScale = 1 + transform.charge; ctx.scale(topScale, topScale);
      if (art.top) drawAtlasCell(ctx, art.top, level - 1, 3, 1, -size / 2, -size / 2, size, size);
      else if (art.legacy(level)) ctx.drawImage(art.legacy(level), -size / 2, -size / 2, size, size);
      else drawProceduralTop(ctx, type, size);
      ctx.restore();
      if (type === "chronos" && skin.logoImage) K.drawLogo(ctx, skin.logoImage, 0, 0, size * 0.28, 0.98);
      ctx.restore();
      ctx.save(); ctx.fillStyle = towerInfo(type).color; ctx.strokeStyle = "rgba(4,9,16,.92)"; ctx.lineWidth = 2;
      for (let i = 0; i < level; i++) {
        const pipX = x + (i - (level - 1) / 2) * Math.max(8, size * 0.13), pipY = y + size * 0.48;
        ctx.beginPath(); ctx.arc(pipX, pipY, Math.max(3, size * 0.045), 0, TWO_PI); ctx.fill(); ctx.stroke();
      }
      ctx.restore();
    }

    function interpolatedEnemy(enemy, alpha) {
      const currentProgress = Number(enemy.progress !== undefined ? enemy.progress : enemy.pathDistance), previous = previousEnemies.get(enemy.id);
      let progress = Number.isFinite(currentProgress) ? currentProgress : 0;
      if (previous && Number.isFinite(previous.progress) && Number.isFinite(currentProgress) && !enemy.detached) progress = lerp(previous.progress, currentProgress, alpha);
      let point;
      if (enemy.detached && Number.isFinite(enemy.x) && Number.isFinite(enemy.y)) {
        point = { x: lerp(previous && Number.isFinite(previous.x) ? previous.x : enemy.x, enemy.x, alpha), y: lerp(previous && Number.isFinite(previous.y) ? previous.y : enemy.y, enemy.y, alpha), angle: 0, segment: enemy.segment || 0 };
      } else point = pointAlongPath(progress);
      let pose = enemyPoses.get(enemy.id);
      if (!pose) { pose = { angle: point.angle, targetAngle: point.angle, hitUntil: 0, staggerUntil: 0, x: point.x, y: point.y, kind: enemyKind(enemy) }; enemyPoses.set(enemy.id, pose); }
      pose.targetAngle = point.angle;
      pose.angle += shortestAngle(pose.angle, pose.targetAngle) * (reducedMotion() ? 1 : clamp(visualDelta / 105, 0, 1));
      pose.x = point.x; pose.y = point.y; pose.progress = progress; pose.kind = enemyKind(enemy);
      return { point: point, pose: pose, progress: progress };
    }
    function proceduralEnemy(ctx, kind, size, color) {
      const sides = kind === "scout" ? 3 : (kind === "titan" ? 6 : 4);
      ctx.fillStyle = "#07101B"; ctx.strokeStyle = "#FFF3D1"; ctx.lineWidth = Math.max(2.5, size * 0.055); ctx.beginPath();
      for (let i = 0; i < sides; i++) {
        const angle = i * TWO_PI / sides + (kind === "scout" ? -Math.PI / 2 : Math.PI / 4), px = Math.cos(angle) * size * 0.38, py = Math.sin(angle) * size * 0.38;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = color; ctx.beginPath(); ctx.arc(0, 0, size * 0.2, 0, TWO_PI); ctx.fill();
    }
    function enemyColor(kind) {
      const fromSkin = skin.enemies && skin.enemies[kind] || {};
      return fromSkin.base || ({ scout: "#FF4F9B", raider: "#F23563", guardian: "#C72C78", titan: "#9820A8" }[kind]) || "#F23563";
    }
    function drawEnemy(ctx, scale, enemy, alpha) {
      const kind = enemyKind(enemy), sizeInfo = ENEMY_SIZE[kind] || ENEMY_SIZE.raider;
      const visual = interpolatedEnemy(enemy, alpha), p = visual.point, pose = visual.pose;
      const x = p.x * scale, y = p.y * scale, size = clamp(sizeInfo.world * scale, sizeInfo.min, sizeInfo.max);
      const phase = ((visual.progress / 5.2) + enemy.id * 0.371) % 1;
      let frame = phase < 0.18 || phase > 0.82 ? 0 : (phase < 0.5 ? 1 : 2);
      if (visualNow < pose.staggerUntil) frame = 4; else if (visualNow < pose.hitUntil) frame = 3;
      const bob = reducedMotion() ? 0 : Math.sin(phase * TWO_PI) * Math.min(2.2, size * 0.035);
      const squash = reducedMotion() ? 1 : 1 + Math.cos(phase * TWO_PI) * 0.025;
      const facing = Math.cos(pose.angle) < -0.25 ? -1 : 1;
      const strideLean = reducedMotion() ? 0 : Math.sin(phase * TWO_PI) * 0.035;
      drawShadow(ctx, x, y + size * 0.31, size * 0.82, 0.58);
      // The character atlases are upright three-quarter figures, not top-down tokens. Keep their
      // bodies upright on vertical lane segments; horizontal mirroring plus a tiny stride lean
      // communicates travel direction without ever tipping a warrior onto its side.
      ctx.save(); ctx.translate(x, y + bob); ctx.rotate(strideLean); ctx.scale(facing / squash, squash);
      const cap = kind.charAt(0).toUpperCase() + kind.slice(1), atlas = imageFor("enemy" + cap + "Atlas"), legacy = imageFor("enemy" + cap);
      ctx.shadowColor = fx.outline || "rgba(4,8,18,.9)"; ctx.shadowBlur = Math.max(3, size * 0.055);
      if (atlas) drawAtlasCell(ctx, atlas, frame, 3, 2, -size / 2, -size / 2, size, size);
      else if (legacy) ctx.drawImage(legacy, -size / 2, -size / 2, size, size);
      else proceduralEnemy(ctx, kind, size, enemyColor(kind));
      ctx.restore();
      const hp = Math.max(0, Number(enemy.hp) || 0), maxHp = Math.max(hp, Number(enemy.maxHp !== undefined ? enemy.maxHp : enemy.hpMax) || hp || 1);
      const barWidth = clamp(size * 0.82, 28, 84), barHeight = clamp(size * 0.09, 4, 8), barY = y - size * 0.57;
      ctx.save(); ctx.fillStyle = "rgba(3,7,14,.94)"; ctx.fillRect(x - barWidth / 2 - 2, barY - 2, barWidth + 4, barHeight + 4);
      ctx.fillStyle = hp / maxHp > 0.45 ? (fx.health || "#68F09B") : (fx.danger || "#FF526D"); ctx.fillRect(x - barWidth / 2, barY, barWidth * hp / maxHp, barHeight);
      ctx.strokeStyle = "rgba(255,245,218,.86)"; ctx.lineWidth = 1; ctx.strokeRect(x - barWidth / 2, barY, barWidth, barHeight);
      if ((Number(enemy.slowMs) || 0) > 0) { ctx.strokeStyle = "rgba(153,220,255,.9)"; ctx.lineWidth = Math.max(2, size * 0.035); ctx.beginPath(); ctx.arc(x, y, size * 0.49, 0, TWO_PI); ctx.stroke(); }
      ctx.restore();
    }

    function pushEffect(effect) { effects.push(effect); if (effects.length > MAX_EFFECTS) effects.splice(0, effects.length - MAX_EFFECTS); }
    function drawProjectile(ctx, scale, effect, age) {
      const t = clamp(age / effect.duration, 0, 1), fromX = effect.from.x * scale, fromY = effect.from.y * scale, toX = effect.to.x * scale, toY = effect.to.y * scale;
      ctx.save();
      if (effect.towerType === "sentinel") {
        const p = easeOutCubic(t), trailP = Math.max(0, p - 0.15), x = lerp(fromX, toX, p), y = lerp(fromY, toY, p);
        ctx.strokeStyle = fx.sentinel || "rgba(35,225,255," + (1 - t * 0.45) + ")"; ctx.globalAlpha = 1 - t * 0.45; ctx.lineWidth = Math.max(3, scale * 0.5); ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(lerp(fromX, toX, trailP), lerp(fromY, toY, trailP)); ctx.lineTo(x, y); ctx.stroke();
        ctx.fillStyle = "#FFF4C7"; ctx.beginPath(); ctx.arc(x, y, Math.max(3, scale * 0.52), 0, TWO_PI); ctx.fill();
      } else if (effect.towerType === "chronos") {
        const p = easeOutCubic(t), dx = toX - fromX, dy = toY - fromY, length = Math.max(1, Math.hypot(dx, dy)), curl = Math.sin(p * Math.PI) * Math.min(30, length * 0.13);
        const x = lerp(fromX, toX, p) - dy / length * curl, y = lerp(fromY, toY, p) + dx / length * curl;
        const radius = Math.max(5, scale * (0.75 + Math.sin(t * Math.PI) * 0.35));
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius * 2.1);
        gradient.addColorStop(0, "rgba(255,255,255,.98)"); gradient.addColorStop(0.36, fx.chronos || "rgba(183,104,255,.92)"); gradient.addColorStop(1, "rgba(80,25,150,0)");
        ctx.fillStyle = gradient; ctx.beginPath(); ctx.arc(x, y, radius * 2.1, 0, TWO_PI); ctx.fill();
        if (t > 0.72) { const q = (t - 0.72) / 0.28; ctx.strokeStyle = "rgba(207,170,255," + (1 - q) + ")"; ctx.lineWidth = Math.max(2, scale * 0.35); ctx.beginPath(); ctx.arc(toX, toY, (2 + q * 7) * scale, 0, TWO_PI); ctx.stroke(); }
      } else {
        const p = easeOutCubic(t), x = lerp(fromX, toX, p), y = lerp(fromY, toY, p) - Math.sin(p * Math.PI) * Math.min(72, Math.hypot(toX - fromX, toY - fromY) * 0.28);
        ctx.fillStyle = fx.siege || "#FF6B43"; ctx.strokeStyle = "#FFF0BC"; ctx.lineWidth = Math.max(2, scale * 0.3); ctx.beginPath(); ctx.arc(x, y, Math.max(5, scale * 0.72), 0, TWO_PI); ctx.fill(); ctx.stroke();
        if (t > 0.74) { const q = (t - 0.74) / 0.26, radius = (2 + q * 8) * scale; ctx.fillStyle = "rgba(255,105,55," + ((1 - q) * 0.3) + ")"; ctx.strokeStyle = "rgba(255,218,116," + (1 - q) + ")"; ctx.lineWidth = Math.max(2, scale * 0.45); ctx.beginPath(); ctx.arc(toX, toY, radius, 0, TWO_PI); ctx.fill(); ctx.stroke(); }
      }
      ctx.restore();
    }
    function drawRingEffect(ctx, scale, effect, age) {
      const t = clamp(age / effect.duration, 0, 1), x = effect.at.x * scale, y = effect.at.y * scale, color = effect.color || pal.gold;
      ctx.save(); ctx.globalAlpha = 1 - t; ctx.strokeStyle = color; ctx.lineWidth = Math.max(2, (0.7 - t * 0.35) * scale);
      ctx.beginPath(); ctx.arc(x, y, (2 + easeOutCubic(t) * 7) * scale, 0, TWO_PI); ctx.stroke();
      if (!reducedMotion() && effect.burst) { ctx.fillStyle = color; for (let i = 0; i < 7; i++) { const angle = i * TWO_PI / 7 + effect.seed, distance = easeOutCubic(t) * 8 * scale; ctx.beginPath(); ctx.arc(x + Math.cos(angle) * distance, y + Math.sin(angle) * distance, Math.max(1.5, (1 - t) * 0.55 * scale), 0, TWO_PI); ctx.fill(); } }
      ctx.restore();
    }
    function drawDeathEffect(ctx, scale, effect, age) {
      const t = clamp(age / effect.duration, 0, 1), info = ENEMY_SIZE[effect.enemyType] || ENEMY_SIZE.raider;
      const size = clamp(info.world * scale, info.min, info.max) * (1 + t * 0.18), cap = effect.enemyType.charAt(0).toUpperCase() + effect.enemyType.slice(1);
      const atlas = imageFor("enemy" + cap + "Atlas"), legacy = imageFor("enemy" + cap), x = effect.at.x * scale, y = effect.at.y * scale - t * 4 * scale;
      ctx.save(); ctx.globalAlpha = 1 - t; ctx.translate(x, y); ctx.rotate(effect.angle + t * 0.28);
      if (atlas) drawAtlasCell(ctx, atlas, 5, 3, 2, -size / 2, -size / 2, size, size);
      else if (legacy) ctx.drawImage(legacy, -size / 2, -size / 2, size, size);
      else proceduralEnemy(ctx, effect.enemyType, size, enemyColor(effect.enemyType));
      ctx.restore();
    }
    function drawEffects(ctx, scale) {
      const survivors = [];
      for (let i = 0; i < effects.length; i++) {
        const effect = effects[i], age = visualNow - effect.born;
        if (age < 0 || age >= effect.duration) continue;
        survivors.push(effect);
        if (effect.type === "projectile") drawProjectile(ctx, scale, effect, age);
        else if (effect.type === "death") drawDeathEffect(ctx, scale, effect, age);
        else drawRingEffect(ctx, scale, effect, age);
      }
      effects = survivors;
    }
    function eventPoint(event, state) {
      if (Number.isFinite(event.x) && Number.isFinite(event.y)) return { x: event.x, y: event.y };
      if (Number.isFinite(event.targetX) && Number.isFinite(event.targetY)) return { x: event.targetX, y: event.targetY };
      const enemyId = event.enemyId !== undefined ? event.enemyId : event.targetId, enemyPose = enemyPoses.get(enemyId);
      if (enemyPose) return { x: enemyPose.x, y: enemyPose.y };
      const enemy = (state.enemies || []).find(function (item) { return item.id === enemyId; });
      if (enemy && Number.isFinite(enemy.x) && Number.isFinite(enemy.y)) return { x: enemy.x, y: enemy.y };
      const pad = Number(event.pad !== undefined ? event.pad : event.padIndex);
      return Number.isFinite(pad) && pads[pad] ? pads[pad] : null;
    }

    function ensurePortraitCanvas(host) {
      if (!host) return null;
      if (String(host.tagName).toLowerCase() === "canvas") return host;
      let canvas = host.querySelector && host.querySelector("canvas[data-aegis-portrait]");
      if (!canvas) { canvas = document.createElement("canvas"); canvas.setAttribute("data-aegis-portrait", ""); canvas.setAttribute("aria-hidden", "true"); host.appendChild(canvas); }
      return canvas;
    }
    function paintPortrait(host, type, level, card) {
      const canvas = ensurePortraitCanvas(host); if (!canvas) return;
      const rect = host.getBoundingClientRect ? host.getBoundingClientRect() : { width: 0, height: 0 };
      const cssW = Math.max(88, Math.round(rect.width || host.clientWidth || 150)), cssH = Math.max(72, Math.round(rect.height || host.clientHeight || 112));
      const portraitDpr = Math.min(global.devicePixelRatio || 1, 2), targetW = Math.round(cssW * portraitDpr), targetH = Math.round(cssH * portraitDpr);
      if (canvas.width !== targetW || canvas.height !== targetH) { canvas.width = targetW; canvas.height = targetH; }
      canvas.style.width = cssW + "px"; canvas.style.height = cssH + "px";
      const ctx = canvas.getContext("2d"); ctx.setTransform(portraitDpr, 0, 0, portraitDpr, 0, 0); ctx.clearRect(0, 0, cssW, cssH);
      const info = towerInfo(type), glow = ctx.createRadialGradient(cssW / 2, cssH * 0.52, 0, cssW / 2, cssH * 0.52, Math.max(cssW, cssH) * 0.55);
      glow.addColorStop(0, K.hexToRgba(info.color, 0.26)); glow.addColorStop(1, K.hexToRgba(info.color, 0)); ctx.fillStyle = glow; ctx.fillRect(0, 0, cssW, cssH);
      const cardAtlas = imageFor("towerCardAtlas"), cardIndex = TOWER_ORDER.indexOf(type);
      if (card && cardAtlas && cardIndex >= 0) { drawAtlasCellContained(ctx, cardAtlas, cardIndex, 3, 1, 0, 0, cssW, cssH); return; }
      const size = Math.min(cssW, cssH) * 0.88, art = towerArt(type);
      ctx.save(); ctx.translate(cssW / 2, cssH / 2);
      if (art.base) drawAtlasCell(ctx, art.base, level - 1, 3, 1, -size / 2, -size / 2, size, size); else if (!art.legacy(level)) drawProceduralBase(ctx, type, size);
      if (art.top) drawAtlasCell(ctx, art.top, level - 1, 3, 1, -size / 2, -size / 2, size, size); else if (art.legacy(level)) ctx.drawImage(art.legacy(level), -size / 2, -size / 2, size, size); else drawProceduralTop(ctx, type, size);
      if (type === "chronos" && skin.logoImage) K.drawLogo(ctx, skin.logoImage, 0, 0, size * 0.26, 1);
      ctx.restore();
    }
    function placePanel(state) {
      if (!ui.panel) return;
      const pad = pads[clamp(Math.trunc(Number(state.selectedPad) || 0), 0, pads.length - 1)] || pads[0], side = pad.x > worldW / 2 ? "left" : "right";
      ui.panel.dataset.side = side; ui.panel.classList.toggle("is-left", side === "left");
    }
    function focusPanel() {
      if (!ui.panelClose || typeof ui.panelClose.focus !== "function") return;
      try { ui.panelClose.focus({ preventScroll: true }); } catch (error) { ui.panelClose.focus(); }
    }
    function openPanel(state, moveFocus) {
      if (!state || !ui.panel) return false;
      const wasOpen = panelOpen; panelOpen = true;
      if (!wasOpen) focusBeforePanel = document.activeElement;
      ui.panel.hidden = false; ui.panel.setAttribute("aria-hidden", "false"); placePanel(state); uiSignature = "";
      if (!wasOpen && moveFocus !== false) global.requestAnimationFrame(focusPanel);
      return true;
    }
    r.closePanel = function () {
      if (!panelOpen) return false;
      panelOpen = false;
      if (lastState && r.capturePrevious) r.capturePrevious(lastState);
      if (ui.panel) { ui.panel.hidden = true; ui.panel.setAttribute("aria-hidden", "true"); }
      uiSignature = "";
      const target = focusBeforePanel && document.contains(focusBeforePanel) ? focusBeforePanel : options.wellCanvas;
      focusBeforePanel = null;
      if (target && typeof target.focus === "function") {
        if (target === options.wellCanvas && target.tabIndex < 0) target.tabIndex = 0;
        try { target.focus({ preventScroll: true }); } catch (error) { target.focus(); }
      }
      return true;
    };
    r.pausesSimulation = function () { return !!(panelOpen && lastState && lastState.status === "playing"); };
    if (ui.panelClose) ui.panelClose.addEventListener("click", function () { r.closePanel(); });

    function showFeedback(text, tone) {
      const className = tone === "positive" ? "is-positive" : (tone === "negative" ? "is-negative" : "is-warning");
      [ui.aetherFeedback, ui.panelFeedback].forEach(function (feedback) {
        if (!feedback) return;
        feedback.textContent = text; feedback.classList.remove("is-positive", "is-negative", "is-warning", "is-visible");
        void feedback.offsetWidth; feedback.classList.add(className, "is-visible");
      });
      feedbackUntil = visualNow + 1700;
    }
    function clearExpiredFeedback() {
      if (!feedbackUntil || visualNow < feedbackUntil) return;
      feedbackUntil = 0;
      [ui.aetherFeedback, ui.panelFeedback].forEach(function (feedback) {
        if (!feedback) return;
        feedback.classList.remove("is-visible", "is-positive", "is-negative", "is-warning");
        feedback.textContent = "";
      });
      uiSignature = "";
    }
    function denialMessage(event, state) {
      const reason = String(event.reason || "");
      if (reason === "insufficient-gold") {
        let cost = 0;
        if (String(event.command || "").indexOf("build:") === 0) cost = buildCost(String(event.command).slice(6));
        else if (event.command === "upgrade") cost = upgradeCost(selectedTower(state));
        return "Need " + Math.max(0, cost - Number(state.gold || 0)) + " more Aether";
      }
      if (reason === "occupied-pad") return "That pad already has a tower";
      if (reason === "empty-pad") return "Select a built tower first";
      if (reason === "max-level") return "Tower is already max level";
      if (reason === "wave-active") return "A wave is already in progress";
      return "Command unavailable";
    }
    function updateCard(type, state, occupied) {
      const card = document.querySelector('[data-tower-card="' + type + '"]'); if (!card) return;
      const stats = statLevel(type, 1), info = towerInfo(type), cost = buildCost(type);
      card.style.setProperty("--tower-accent", info.color);
      function field(name, value) { setText(card.querySelector('[data-tower-field="' + name + '"]'), value); }
      field("role", info.role); field("cost", cost + " Aether"); field("damage", Number(stats.damage) || 0);
      field("rate", attacksPerSecond(stats)); field("range", Number(stats.range) || 0); field("special", specialStat(type, stats));
      const button = card.querySelector('[data-btn="' + type + '"]'), affordable = Number(state.gold) >= cost, available = state.status === "playing" && !occupied;
      if (button) {
        button.disabled = !available || !affordable; button.setAttribute("aria-disabled", String(!available || !affordable));
        button.setAttribute("aria-label", "Build " + info.label + " for " + cost + " Aether. " + info.role);
        setText(button.querySelector("[data-build-label]"), "BUILD"); setText(button.querySelector("[data-build-price]"), cost);
      }
      const affordability = card.querySelector("[data-affordability]");
      setText(affordability, affordable
        ? "CAN AFFORD · " + (Number(state.gold) - cost) + " LEFT"
        : "NEED " + (cost - Number(state.gold)) + " MORE AETHER");
      card.classList.toggle("is-unaffordable", !affordable);
      paintPortrait(card.querySelector('[data-card-portrait="' + type + '"]'), type, 1, true);
    }
    function updateInspector(tower, state) {
      if (!tower) return;
      const type = towerType(tower), level = towerLevel(tower), info = towerInfo(type), current = statLevel(type, level), next = level < 3 ? statLevel(type, level + 1) : null;
      if (ui.inspectorPanel) ui.inspectorPanel.style.setProperty("--tower-accent", info.color);
      setText(ui.inspectorName, info.label); setText(ui.inspectorLevel, "LEVEL " + level); setText(ui.inspectorRole, info.role);
      setText(ui.inspectorDamage, Number(current.damage) || 0); setText(ui.inspectorRate, attacksPerSecond(current));
      setText(ui.inspectorRange, Number(current.range) || 0); setText(ui.inspectorSpecial, specialStat(type, current));
      setText(ui.inspectorNextDamage, next ? (Number(next.damage) || 0) : "—"); setText(ui.inspectorNextRate, next ? attacksPerSecond(next) : "—");
      setText(ui.inspectorNextRange, next ? (Number(next.range) || 0) : "—"); setText(ui.inspectorNextSpecial, next ? specialStat(type, next) : "—");
      const cost = upgradeCost(tower), maxLevel = level >= 3, affordable = Number(state.gold) >= cost;
      if (ui.upgradeButton) { ui.upgradeButton.disabled = maxLevel || !affordable || state.status !== "playing"; ui.upgradeButton.setAttribute("aria-disabled", String(ui.upgradeButton.disabled)); ui.upgradeButton.setAttribute("aria-label", maxLevel ? info.label + " is max level" : "Upgrade " + info.label + " for " + cost + " Aether"); }
      setText(ui.upgradePrice, maxLevel ? "" : cost); setHidden(ui.upgradeMax, !maxLevel);
      if (ui.panelFeedback && !feedbackUntil) {
        setText(ui.panelFeedback, !maxLevel && !affordable ? "Need " + (cost - Number(state.gold)) + " more Aether to upgrade" : "");
        ui.panelFeedback.classList.toggle("is-warning", !maxLevel && !affordable);
      }
      if (ui.sellButton) { ui.sellButton.disabled = state.status !== "playing"; ui.sellButton.setAttribute("aria-disabled", String(ui.sellButton.disabled)); ui.sellButton.setAttribute("aria-label", "Sell " + info.label + " for " + refundAmount(tower) + " Aether"); }
      setText(ui.sellRefund, refundAmount(tower)); paintPortrait(ui.inspectorPortrait, type, level, false);
    }
    function phaseText(state) {
      if (state.outcome === "victory") return "The Eternal Gate stands";
      if (state.outcome === "defeat") return "The gate has fallen";
      if (state.phase === "combat") return "Wave " + state.wave + " of 12 in progress";
      return "Planning for wave " + Math.min(12, Number(state.wave || 0) + 1);
    }
    function updateUi(state) {
      clearExpiredFeedback();
      const selected = clamp(Math.trunc(Number(state.selectedPad) || 0), 0, pads.length - 1), tower = towerAtPad(state, selected);
      const signature = [state.status, state.phase, state.wave, state.gold, state.integrity, state.score, selected, tower ? towerType(tower) + towerLevel(tower) + ":" + investedAmount(tower) : "empty", state.outcome, panelOpen, assetVersion].join("|");
      if (signature === uiSignature) return; uiSignature = signature;
      setText(ui.aether, Number(state.gold) || 0); setText(ui.integrity, Number(state.integrity) || 0); setText(ui.wave, Number(state.wave) || 0); setText(ui.score, Number(state.score) || 0);
      if (ui.waveButton) {
        const unavailable = state.status !== "playing" || state.phase === "combat" || Number(state.wave) >= 12;
        ui.waveButton.disabled = unavailable; ui.waveButton.setAttribute("aria-disabled", String(unavailable)); ui.waveButton.setAttribute("aria-label", Number(state.wave) >= 12 ? "Campaign complete" : "Start wave " + (Number(state.wave) + 1));
      }
      setText(ui.waveButtonLabel, Number(state.wave) >= 12 ? "CAMPAIGN COMPLETE" : (state.phase === "combat" ? "WAVE " + state.wave + " ACTIVE" : "START WAVE " + (Number(state.wave) + 1)));
      if (ui.panel) { ui.panel.hidden = !panelOpen; ui.panel.setAttribute("aria-hidden", String(!panelOpen)); }
      if (panelOpen) {
        placePanel(state);
        if (tower) {
          setHidden(ui.buildPanel, true); setHidden(ui.inspectorPanel, false); setText(ui.panelTitle, towerInfo(towerType(tower)).label); setText(ui.panelSubtitle, "PAD " + (selected + 1) + " · TOWER MANAGEMENT"); updateInspector(tower, state);
        } else {
          setHidden(ui.buildPanel, false); setHidden(ui.inspectorPanel, true); setText(ui.panelTitle, "BUILD A DEFENSE"); setText(ui.panelSubtitle, "PAD " + (selected + 1) + " · COMBAT SUSPENDED"); TOWER_ORDER.forEach(function (type) { updateCard(type, state, false); });
          if (ui.panelFeedback && !feedbackUntil) { ui.panelFeedback.textContent = ""; ui.panelFeedback.classList.remove("is-warning"); }
        }
      }
      if (ui.statusText) {
        if (panelOpen && tower) setText(ui.statusText, towerInfo(towerType(tower)).label + " level " + towerLevel(tower) + " selected on pad " + (selected + 1) + ". Combat suspended.");
        else if (panelOpen) setText(ui.statusText, "Build menu open for empty pad " + (selected + 1) + ". Combat suspended.");
        else setText(ui.statusText, phaseText(state) + ". Select a construction pad to manage defenses.");
      }
    }

    r.capturePrevious = function (state) {
      previousEnemies.clear();
      (state.enemies || []).forEach(function (enemy) { previousEnemies.set(enemy.id, { progress: Number(enemy.progress !== undefined ? enemy.progress : enemy.pathDistance), x: Number(enemy.x), y: Number(enemy.y), segment: Number(enemy.segment) || 0 }); });
    };
    r.handleEvent = function (event, state) {
      if (!event) return;
      state = state || lastState || { towers: [], enemies: [] }; lastState = state;
      const type = String(event.type || "").toLowerCase();
      if (type === "select") openPanel(state, true);
      else if (type === "attack" || type === "fire") {
        const towerId = event.towerId !== undefined ? event.towerId : event.sourceId;
        const tower = (state.towers || []).find(function (item) { return item.id === towerId; }), target = eventPoint(event, state);
        if (tower && target) {
          const from = towerPoint(tower), kind = towerType(tower); let pose = towerPoses.get(tower.id);
          if (!pose) { pose = { angle: 0, targetAngle: 0, attackAt: -Infinity, flourishAt: -Infinity }; towerPoses.set(tower.id, pose); }
          pose.targetAngle = Math.atan2(target.y - from.y, target.x - from.x); pose.attackAt = visualNow;
          pushEffect({ type: "projectile", towerType: kind, from: { x: from.x, y: from.y }, to: target, born: visualNow, duration: kind === "sentinel" ? 170 : (kind === "chronos" ? 250 : 360) });
        }
        (event.hitIds || []).forEach(function (id) { const pose = enemyPoses.get(id); if (pose) { if (event.towerType === "siege") pose.staggerUntil = visualNow + 190; else pose.hitUntil = visualNow + 120; } });
      } else if (type === "build" || type === "upgrade") {
        const tower = (state.towers || []).find(function (item) { return item.id === event.towerId; });
        if (tower) {
          let pose = towerPoses.get(tower.id); if (!pose) { pose = { angle: 0, targetAngle: 0, attackAt: -Infinity, flourishAt: -Infinity }; towerPoses.set(tower.id, pose); }
          pose.flourishAt = visualNow; pushEffect({ type: "ring", at: towerPoint(tower), color: towerInfo(towerType(tower)).color, born: visualNow, duration: 430, burst: true, seed: tower.id * 0.7 });
        }
        showFeedback("−" + Number(event.cost || 0) + " Aether", "negative"); openPanel(state, false);
      } else if (type === "sell") {
        const at = pads[Number(event.pad)] || eventPoint(event, state);
        if (at) pushEffect({ type: "ring", at: at, color: "#73F0B0", born: visualNow, duration: 520, burst: true, seed: Number(event.towerId || 1) });
        towerPoses.delete(event.towerId); showFeedback("+" + Number(event.refund || 0) + " Aether", "positive"); openPanel(state, false);
      } else if (type === "denied") showFeedback(denialMessage(event, state), "warning");
      else if (type === "kill") {
        const pose = enemyPoses.get(event.enemyId);
        if (pose) { pushEffect({ type: "death", enemyId: event.enemyId, enemyType: String(event.enemyType || pose.kind || "raider"), at: { x: pose.x, y: pose.y }, angle: pose.angle || 0, born: visualNow, duration: 360 }); enemyPoses.delete(event.enemyId); }
      } else if (type === "leak" || type === "breach") pushEffect({ type: "ring", at: { x: 157, y: 44 }, color: "#FF4F6D", born: visualNow, duration: 480, burst: type === "breach", seed: 0.4 });
      else if (type === "waveclear" || type === "victory") pushEffect({ type: "ring", at: { x: 157, y: 44 }, color: "#F5CE66", born: visualNow, duration: type === "victory" ? 900 : 520, burst: true, seed: 1.1 });
      if (type === "wave" || type === "gameover" || type === "victory" || type === "breach") r.closePanel();
      uiSignature = "";
    };
    r.side = function (state) { lastState = state; updateUi(state); };
    r.hitTest = function (point) {
      const nx = Number(point && (point.x !== undefined ? point.x : point.nx)), ny = Number(point && (point.y !== undefined ? point.y : point.ny));
      if (!Number.isFinite(nx) || !Number.isFinite(ny)) return null;
      const x = clamp(nx, 0, 1) * worldW, y = clamp(ny, 0, 1) * worldH, hitRadius = Math.max(5.8, 24 / Math.max(0.1, r.cell));
      let best = -1, distance = Infinity;
      for (let i = 0; i < pads.length; i++) { const d = Math.hypot(x - pads[i].x, y - pads[i].y); if (d <= hitRadius && d < distance) { best = i; distance = d; } }
      return best < 0 ? null : "selectPad:" + best;
    };
    r.resize = function () {
      const title = document.querySelector(".title"), titleBottom = title && title.getBoundingClientRect ? title.getBoundingClientRect().bottom : 54;
      const narrow = global.innerWidth < 760, availableWidth = Math.max(160, global.innerWidth - (narrow ? 20 : 32));
      const availableHeight = Math.max(100, global.innerHeight - titleBottom - (narrow ? 18 : 24));
      const preferredWidth = narrow ? availableWidth : Math.min(1050, availableWidth);
      const scale = Math.max(1, Math.min(preferredWidth / worldW, availableHeight / worldH));
      r.cell = scale; dpr = Math.min(global.devicePixelRatio || 1, 3);
      wellCtx = K.setupCanvas(options.wellCanvas, scale * worldW, scale * worldH, dpr);
      wellCtx.imageSmoothingEnabled = true; wellCtx.imageSmoothingQuality = "high";
      if (lastState) { placePanel(lastState); uiSignature = ""; updateUi(lastState); }
      return { cell: scale };
    };
    r.draw = function (state, extras, frameMeta) {
      frameMeta = frameMeta || {};
      const frameNow = Number(frameMeta.now), usableNow = Number.isFinite(frameNow) ? frameNow : (global.performance && global.performance.now ? global.performance.now() : Date.now());
      visualDelta = lastFrameNow ? clamp(usableNow - lastFrameNow, 0, 50) : 0; lastFrameNow = usableNow;
      const stateTick = Number(state.tick);
      if ((lastDrawStatus === "over" && state.status !== "over") || (Number.isFinite(stateTick) && stateTick < lastDrawTick)) {
        effects.length = 0; previousEnemies.clear(); enemyPoses.clear(); towerPoses.clear();
      }
      lastDrawStatus = state.status;
      if (Number.isFinite(stateTick)) lastDrawTick = stateTick;
      if (state.status === "playing" || state.status === "over") visualNow += visualDelta;
      lastState = state; updateUi(state); if (!wellCtx) r.resize();
      const ctx = wellCtx, scale = r.cell, width = worldW * scale, height = worldH * scale;
      drawBackground(ctx, scale, width, height); drawRoute(ctx, scale); drawBreach(ctx, scale); drawGate(ctx, scale);
      drawRange(ctx, scale, state); drawPads(ctx, scale, state);
      (state.towers || []).forEach(function (tower) { drawTower(ctx, scale, tower); });
      const alpha = panelOpen ? 1 : clamp(Number(frameMeta.alpha) || 0, 0, 1);
      (state.enemies || []).forEach(function (enemy) { drawEnemy(ctx, scale, enemy, alpha); });
      drawEffects(ctx, scale);
      const liveIds = new Set((state.enemies || []).map(function (enemy) { return enemy.id; }));
      enemyPoses.forEach(function (pose, id) { if (!liveIds.has(id) && !effects.some(function (effect) { return effect.type === "death" && effect.enemyId === id; })) enemyPoses.delete(id); });
    };

    r.resize();
    return r;
  }

  G.createRenderer = createRenderer;
})(typeof window !== "undefined" ? window : globalThis);
