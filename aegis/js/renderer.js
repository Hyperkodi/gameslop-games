/* Armara Aegis renderer: portrait citadel, fixed route, build pads, towers, enemies and effects.
   Generated art is optional presentation only; every element needed to play has a procedural fallback. */
(function (global) {
  "use strict";

  const K = global.GameSlopKit;
  const G = global.Game = global.Game || {};
  const WORLD_W = 100, WORLD_H = 120;
  const LOCAL_PATH = [
    [-5, 14], [28, 14], [28, 42], [74, 42],
    [74, 70], [38, 70], [38, 101], [105, 101],
  ];
  const LOCAL_PADS = [
    [14, 29], [43, 18], [58, 29], [88, 27], [56, 55],
    [89, 57], [19, 59], [20, 84], [56, 86], [78, 88],
  ];
  const LOCAL_TOWER_STATS = {
    sentinel: [
      { range: 22, cost: 40 }, { range: 24, cost: 35 }, { range: 26, cost: 60 },
    ],
    chronos: [
      { range: 20, cost: 55 }, { range: 22, cost: 45 }, { range: 24, cost: 75 },
    ],
    siege: [
      { range: 24, cost: 75 }, { range: 26, cost: 60 }, { range: 28, cost: 90 },
    ],
  };
  const BUILD_COST = { sentinel: 40, chronos: 55, siege: 75 };
  const ENEMY_RADIUS = { scout: 2.1, raider: 2.7, guardian: 3.3, titan: 4.5 };
  const PAD_HIT_RADIUS = 7;
  const MAX_SPRITE_DIM = 512;

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

  function nowMs() {
    return global.performance && global.performance.now ? global.performance.now() : Date.now();
  }

  function lightNeutral(data, offset) {
    const red = data[offset], green = data[offset + 1], blue = data[offset + 2];
    const high = Math.max(red, green, blue), low = Math.min(red, green, blue);
    return low >= 225 && high - low <= 12;
  }

  function darkNeutral(data, offset) {
    const red = data[offset], green = data[offset + 1], blue = data[offset + 2];
    const high = Math.max(red, green, blue), low = Math.min(red, green, blue);
    return high <= 24 && high - low <= 8;
  }

  // Image generators occasionally bake a visible transparency checkerboard into an RGB PNG.
  // Downsample sprites once, then remove only edge-connected neutral background pixels. Flood
  // filling (rather than globally keying light colors) protects enclosed ivory and highlights.
  function prepareSpriteImage(key, img) {
    if (key === "battlefield") return img; // intentionally opaque environmental art

    const scale = Math.min(1, MAX_SPRITE_DIM / Math.max(img.naturalWidth, img.naturalHeight));
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return img;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, width, height);

    let pixels;
    try { pixels = ctx.getImageData(0, 0, width, height); }
    catch (error) { return img; }
    const data = pixels.data;

    // Real transparency, including anti-aliased edges, is authoritative and needs no keying.
    for (let offset = 3; offset < data.length; offset += 4) {
      if (data[offset] !== 255) return canvas;
    }

    let lightEdges = 0, darkEdges = 0;
    function countEdgePixel(index) {
      const offset = index * 4;
      if (lightNeutral(data, offset)) lightEdges++;
      if (darkNeutral(data, offset)) darkEdges++;
    }
    for (let x = 0; x < width; x++) {
      countEdgePixel(x);
      if (height > 1) countEdgePixel((height - 1) * width + x);
    }
    for (let y = 1; y < height - 1; y++) {
      countEdgePixel(y * width);
      if (width > 1) countEdgePixel(y * width + width - 1);
    }

    // Choose the dominant neutral edge family. This supports checkerboards and future flat-black
    // sprite mattes without letting a white matte flood into connected black machinery (or vice versa).
    const edgeTest = lightEdges >= darkEdges ? lightNeutral : darkNeutral;
    if (Math.max(lightEdges, darkEdges) < 4) return canvas;

    const total = width * height;
    const queued = new Uint8Array(total);
    const queue = new Int32Array(total);
    let head = 0, tail = 0;
    function enqueue(index) {
      if (index < 0 || index >= total || queued[index]) return;
      if (!edgeTest(data, index * 4)) return;
      queued[index] = 1;
      queue[tail++] = index;
    }
    for (let x = 0; x < width; x++) {
      enqueue(x);
      enqueue((height - 1) * width + x);
    }
    for (let y = 1; y < height - 1; y++) {
      enqueue(y * width);
      enqueue(y * width + width - 1);
    }

    while (head < tail) {
      const index = queue[head++];
      data[index * 4 + 3] = 0;
      const x = index % width;
      if (x > 0) enqueue(index - 1);
      if (x + 1 < width) enqueue(index + 1);
      if (index >= width) enqueue(index - width);
      if (index + width < total) enqueue(index + width);
    }
    ctx.putImageData(pixels, 0, 0);
    return canvas;
  }

  function toneFor(skin, type) {
    const defaults = {
      sentinel: { base: "#C9A24A", hi: "#F1D890", lo: "#7E6120", edge: "#EFE8D8" },
      chronos: { base: "#E9E2D3", hi: "#FFF7E7", lo: "#A99F8C", edge: "#C9A24A" },
      siege: { base: "#7A5230", hi: "#B98A5E", lo: "#3F2914", edge: "#C9A24A" },
    };
    return (skin.towers && skin.towers[type] && skin.towers[type].tone) || defaults[type] || defaults.sentinel;
  }

  function towerType(tower) {
    return String(tower && (tower.type || tower.kind || tower.towerType) || "sentinel").toLowerCase();
  }

  function towerLevel(tower) {
    return Math.max(1, Math.min(3, Number(tower && tower.level) || 1));
  }

  function towerPadIndex(tower) {
    const value = tower && (tower.padIndex !== undefined ? tower.padIndex : tower.pad);
    return Number.isFinite(Number(value)) ? Number(value) : -1;
  }

  function createRenderer(o) {
    const skin = o.skin;
    const pal = skin.palette;
    const path = normalizedPoints(G.PATH || G.WAYPOINTS, LOCAL_PATH);
    const pads = normalizedPoints(G.PADS || G.BUILD_PADS, LOCAL_PADS);
    const towerStats = G.TOWER_STATS || LOCAL_TOWER_STATS;
    const r = { cell: 4 };
    const images = {};
    let wellCtx, dpr = 1, lastState = null, uiSignature = "";
    let effects = [];

    Object.keys(skin.art || {}).forEach(function (key) {
      const img = new Image();
      images[key] = null;
      img.onload = function () { images[key] = prepareSpriteImage(key, img); };
      img.onerror = function () { images[key] = null; };
      img.src = skin.base + skin.art[key];
    });

    const segments = [];
    let pathLength = 0;
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1], b = path[i];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      segments.push({ a: a, b: b, start: pathLength, length: len });
      pathLength += len;
    }

    function pointAlongPath(distance) {
      let d = Math.max(0, Math.min(pathLength, Number(distance) || 0));
      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        if (d <= seg.start + seg.length || i === segments.length - 1) {
          const t = seg.length ? (d - seg.start) / seg.length : 0;
          return { x: seg.a.x + (seg.b.x - seg.a.x) * t, y: seg.a.y + (seg.b.y - seg.a.y) * t };
        }
      }
      return path[path.length - 1];
    }

    function enemyPoint(enemy) {
      if (Number.isFinite(enemy.x) && Number.isFinite(enemy.y)) return { x: enemy.x, y: enemy.y };
      if (enemy.position && Number.isFinite(enemy.position.x) && Number.isFinite(enemy.position.y)) return enemy.position;
      let progress = Number(enemy.pathDistance !== undefined ? enemy.pathDistance : enemy.progress);
      if (!Number.isFinite(progress)) progress = 0;
      if (progress >= 0 && progress <= 1) progress *= pathLength;
      return pointAlongPath(progress);
    }

    function towerPoint(tower) {
      if (Number.isFinite(tower.x) && Number.isFinite(tower.y)) return { x: tower.x, y: tower.y };
      return pads[towerPadIndex(tower)] || pads[0];
    }

    function selectedTower(state) {
      const index = Number(state.selectedPad) || 0;
      return (state.towers || []).find(function (tower) { return towerPadIndex(tower) === index; }) || null;
    }

    function statLevel(type, level) {
      const table = towerStats[type] || LOCAL_TOWER_STATS[type];
      if (Array.isArray(table)) return table[Math.max(0, Math.min(table.length - 1, level - 1))] || {};
      if (table && Array.isArray(table.levels)) return table.levels[Math.max(0, Math.min(table.levels.length - 1, level - 1))] || {};
      if (table && table[level]) return table[level];
      return {};
    }

    function towerRange(tower) {
      const type = towerType(tower), level = towerLevel(tower);
      return Number(tower.range || statLevel(type, level).range || LOCAL_TOWER_STATS[type][level - 1].range);
    }

    function coverImage(ctx, img, w, h) {
      const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
      const iw = img.naturalWidth * scale, ih = img.naturalHeight * scale;
      ctx.drawImage(img, (w - iw) / 2, (h - ih) / 2, iw, ih);
    }

    function traceRoute(ctx, s) {
      ctx.beginPath();
      ctx.moveTo(path[0].x * s, path[0].y * s);
      for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x * s, path[i].y * s);
    }

    function drawRoute(ctx, s) {
      ctx.save();
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      traceRoute(ctx, s);
      ctx.strokeStyle = pal.goldDeep; ctx.globalAlpha = 0.72; ctx.lineWidth = 14 * s; ctx.stroke();
      traceRoute(ctx, s);
      ctx.strokeStyle = "#211A14"; ctx.globalAlpha = 1; ctx.lineWidth = 11.2 * s; ctx.stroke();
      traceRoute(ctx, s);
      ctx.strokeStyle = pal.bronze; ctx.globalAlpha = 0.42; ctx.lineWidth = 0.65 * s;
      ctx.setLineDash([1.5 * s, 1.8 * s]); ctx.stroke();
      ctx.restore();
    }

    function drawBreach(ctx, s) {
      const pulse = reducedMotion() ? 0 : (Math.sin(nowMs() / 240) + 1) * 0.5;
      const x = 1.5 * s, y = 14 * s, radius = (6.2 + pulse * 0.8) * s;
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, "rgba(255,190,110,.92)");
      gradient.addColorStop(0.35, "rgba(183,67,43,.72)");
      gradient.addColorStop(1, "rgba(90,18,12,0)");
      ctx.fillStyle = gradient; ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
      if (images.breach) {
        const size = 13 * s;
        ctx.drawImage(images.breach, x - size / 2, y - size / 2, size, size);
      } else {
        ctx.strokeStyle = "#B7432B"; ctx.lineWidth = Math.max(1, 0.7 * s);
        ctx.beginPath(); ctx.arc(x, y, 3.1 * s, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = "#E7A48E"; ctx.lineWidth = Math.max(1, 0.28 * s);
        for (let i = 0; i < 5; i++) {
          const a = i * Math.PI * 2 / 5;
          ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * 2.5 * s, y + Math.sin(a) * 2.5 * s);
          ctx.lineTo(x + Math.cos(a + 0.4) * 5.3 * s, y + Math.sin(a + 0.4) * 5.3 * s); ctx.stroke();
        }
      }
    }

    function drawGate(ctx, s) {
      const x = 97 * s, y = 101 * s, w = 6 * s, h = 14 * s;
      ctx.save();
      if (images.gate) {
        const size = 15 * s;
        ctx.drawImage(images.gate, x - size / 2, y - size / 2, size, size);
      } else {
        ctx.fillStyle = pal.marble; ctx.fillRect(x - w / 2, y - h / 2, w, h);
        ctx.fillStyle = pal.goldDeep; ctx.fillRect(x - w / 2, y - h / 2, 0.9 * s, h);
        ctx.fillRect(x + w / 2 - 0.9 * s, y - h / 2, 0.9 * s, h);
        ctx.strokeStyle = pal.gold; ctx.lineWidth = Math.max(1, 0.45 * s); ctx.strokeRect(x - w / 2, y - h / 2, w, h);
      }
      if (skin.logoImage) K.drawLogo(ctx, skin.logoImage, x, y, 5.2 * s, 1);
      else {
        ctx.strokeStyle = pal.gold; ctx.beginPath();
        ctx.ellipse(x, y - 1.8 * s, 1.4 * s, 2.1 * s, 0, 0, Math.PI * 2);
        ctx.ellipse(x, y + 1.8 * s, 1.4 * s, 2.1 * s, 0, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.restore();
    }

    function drawRange(ctx, s, state) {
      const tower = selectedTower(state);
      const pad = pads[Math.max(0, Math.min(pads.length - 1, Number(state.selectedPad) || 0))];
      if (!pad) return;
      const type = tower ? towerType(tower) : String(state.selectedType || "sentinel").toLowerCase();
      const range = tower ? towerRange(tower) : Number(statLevel(type, 1).range || LOCAL_TOWER_STATS[type].range);
      ctx.save();
      ctx.fillStyle = K.hexToRgba(pal.gold, 0.055);
      ctx.strokeStyle = K.hexToRgba(pal.gold, 0.5);
      ctx.lineWidth = Math.max(1, 0.25 * s); ctx.setLineDash([1.2 * s, 1.1 * s]);
      ctx.beginPath(); ctx.arc(pad.x * s, pad.y * s, range * s, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.restore();
    }

    function drawPads(ctx, s, state) {
      const occupied = new Set((state.towers || []).map(towerPadIndex));
      const selected = Number(state.selectedPad) || 0;
      for (let i = 0; i < pads.length; i++) {
        const p = pads[i], active = i === selected;
        ctx.save();
        ctx.fillStyle = occupied.has(i) ? "rgba(20,16,12,.82)" : "rgba(233,226,211,.16)";
        ctx.strokeStyle = active ? pal.marble : pal.goldDeep;
        ctx.lineWidth = (active ? 0.85 : 0.45) * s;
        ctx.beginPath(); ctx.arc(p.x * s, p.y * s, (active ? 5.6 : 5) * s, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = pal.gold; ctx.globalAlpha = active ? 0.9 : 0.35; ctx.lineWidth = Math.max(1, 0.28 * s);
        ctx.beginPath(); ctx.arc(p.x * s, p.y * s, 3.6 * s, 0, Math.PI * 2); ctx.stroke();
        if (!occupied.has(i)) {
          ctx.fillStyle = active ? pal.marble : pal.muted; ctx.globalAlpha = 0.85;
          ctx.font = "700 " + Math.max(8, 1.8 * s) + "px " + (skin.fonts.display || "serif");
          ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(String(i + 1), p.x * s, p.y * s + 0.2 * s);
        }
        ctx.restore();
      }
    }

    function drawTowerFallback(ctx, s, tower, p) {
      const type = towerType(tower), tone = toneFor(skin, type);
      const x = p.x * s, y = p.y * s;
      ctx.save(); ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.fillStyle = tone.lo; ctx.beginPath(); ctx.arc(x, y + 1.1 * s, 3.9 * s, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = tone.edge || pal.gold; ctx.lineWidth = Math.max(1, 0.35 * s); ctx.stroke();

      if (type === "chronos") {
        ctx.strokeStyle = tone.base; ctx.lineWidth = Math.max(1.5, 0.85 * s);
        ctx.beginPath(); ctx.ellipse(x, y - 1.6 * s, 2.5 * s, 2 * s, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(x, y + 1.6 * s, 2.5 * s, 2 * s, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = tone.hi; ctx.beginPath(); ctx.arc(x, y, 0.7 * s, 0, Math.PI * 2); ctx.fill();
      } else if (type === "siege") {
        ctx.fillStyle = tone.base; ctx.fillRect(x - 2.9 * s, y - 2 * s, 5.8 * s, 4 * s);
        ctx.fillStyle = tone.hi; ctx.beginPath(); ctx.arc(x, y - 2.1 * s, 2.25 * s, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = tone.lo; ctx.beginPath(); ctx.arc(x, y - 2.1 * s, 1.25 * s, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillStyle = tone.base; ctx.fillRect(x - 1.1 * s, y - 3.7 * s, 2.2 * s, 6.3 * s);
        ctx.strokeStyle = tone.hi; ctx.lineWidth = Math.max(1.5, 0.75 * s);
        ctx.beginPath(); ctx.moveTo(x - 3.1 * s, y - 2.7 * s); ctx.lineTo(x + 3.1 * s, y - 2.7 * s); ctx.stroke();
        ctx.strokeStyle = tone.edge || pal.marble; ctx.lineWidth = Math.max(1, 0.35 * s);
        ctx.beginPath(); ctx.moveTo(x, y - 4.4 * s); ctx.lineTo(x, y - 0.7 * s); ctx.stroke();
      }
      ctx.restore();
    }

    function drawTower(ctx, s, tower) {
      const type = towerType(tower), p = towerPoint(tower), level = towerLevel(tower);
      const artKey = type + "L" + level;
      const img = images[artKey];
      if (img) {
        const size = (type === "siege" ? 13 : 12) * s;
        ctx.drawImage(img, p.x * s - size / 2, p.y * s - size * 0.58, size, size);
      } else drawTowerFallback(ctx, s, tower, p);
      // Keep the immutable brand artwork as the Chronos core instead of trusting generated art
      // to reproduce it. The same exact PNG is also composited on the defended gate above.
      if (type === "chronos" && skin.logoImage) {
        K.drawLogo(ctx, skin.logoImage, p.x * s, (p.y - 0.5) * s, 3.2 * s, 0.92);
      }

      ctx.fillStyle = pal.gold;
      for (let i = 0; i < level; i++) {
        ctx.beginPath(); ctx.arc((p.x + (i - (level - 1) / 2) * 1.4) * s, (p.y + 5.2) * s, Math.max(1.2, 0.42 * s), 0, Math.PI * 2); ctx.fill();
      }
    }

    function enemyKind(enemy) {
      return String(enemy && (enemy.type || enemy.kind || enemy.enemyType) || "raider").toLowerCase();
    }

    function enemyTone(kind) {
      const fromSkin = skin.enemies && skin.enemies[kind];
      if (fromSkin) return fromSkin;
      return {
        scout: { base: "#B76E5A", hi: "#E7A48E", lo: "#66392C" },
        raider: { base: "#7A5230", hi: "#B98A5E", lo: "#3F2914" },
        guardian: { base: "#2B2622", hi: "#6B5E52", lo: "#000000", edge: "#B76E5A" },
        titan: { base: "#151210", hi: "#7A5230", lo: "#000000", edge: "#C65F42" },
      }[kind] || { base: pal.bronze, hi: pal.gold, lo: pal.bg };
    }

    function polygon(ctx, x, y, radius, sides, rotation) {
      ctx.beginPath();
      for (let i = 0; i < sides; i++) {
        const a = rotation + i * Math.PI * 2 / sides;
        const px = x + Math.cos(a) * radius, py = y + Math.sin(a) * radius;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
    }

    function drawEnemy(ctx, s, enemy) {
      const kind = enemyKind(enemy), p = enemyPoint(enemy), tone = enemyTone(kind);
      const radius = (ENEMY_RADIUS[kind] || 2.7) * s, x = p.x * s, y = p.y * s;
      ctx.save();
      const enemyArtKey = "enemy" + kind.charAt(0).toUpperCase() + kind.slice(1);
      if (images[enemyArtKey]) {
        const size = radius * (kind === "titan" ? 2.9 : 2.6);
        ctx.drawImage(images[enemyArtKey], x - size / 2, y - size * 0.58, size, size);
      } else {
        ctx.fillStyle = tone.lo; polygon(ctx, x, y, radius, kind === "titan" ? 6 : 4, Math.PI / 4); ctx.fill();
        ctx.fillStyle = tone.base;
        if (kind === "scout") polygon(ctx, x, y, radius * 0.82, 3, -Math.PI / 2);
        else if (kind === "guardian") {
          ctx.beginPath(); ctx.moveTo(x, y - radius * 0.8); ctx.lineTo(x + radius * 0.72, y - radius * 0.3);
          ctx.lineTo(x + radius * 0.55, y + radius * 0.7); ctx.lineTo(x, y + radius);
          ctx.lineTo(x - radius * 0.55, y + radius * 0.7); ctx.lineTo(x - radius * 0.72, y - radius * 0.3); ctx.closePath();
        } else polygon(ctx, x, y, radius * 0.8, kind === "titan" ? 6 : 4, Math.PI / 4);
        ctx.fill();
        ctx.strokeStyle = tone.edge || tone.hi; ctx.lineWidth = Math.max(1, 0.34 * s); ctx.stroke();
        ctx.fillStyle = tone.hi; ctx.beginPath(); ctx.arc(x, y, Math.max(1.2, radius * 0.22), 0, Math.PI * 2); ctx.fill();
      }

      const slowMs = Number(enemy.slowMs !== undefined ? enemy.slowMs : enemy.slowRemainingMs) || 0;
      if (slowMs > 0) {
        ctx.strokeStyle = pal.marble; ctx.globalAlpha = 0.7; ctx.lineWidth = Math.max(1, 0.3 * s);
        ctx.beginPath(); ctx.arc(x, y, radius * 1.28, 0, Math.PI * 2); ctx.stroke();
      }

      const hp = Math.max(0, Number(enemy.hp) || 0);
      const maxHp = Math.max(hp, Number(enemy.maxHp !== undefined ? enemy.maxHp : enemy.hpMax) || hp || 1);
      const bw = Math.max(5 * s, radius * 2.2), bh = Math.max(2, 0.65 * s), by = y - radius - 1.6 * s;
      ctx.globalAlpha = 1; ctx.fillStyle = "rgba(0,0,0,.78)"; ctx.fillRect(x - bw / 2, by, bw, bh);
      ctx.fillStyle = hp / maxHp > 0.45 ? pal.gold : "#B7432B"; ctx.fillRect(x - bw / 2, by, bw * (hp / maxHp), bh);
      ctx.restore();
    }

    function eventPoint(ev, state) {
      if (Number.isFinite(ev.x) && Number.isFinite(ev.y)) return { x: ev.x, y: ev.y };
      if (Number.isFinite(ev.targetX) && Number.isFinite(ev.targetY)) return { x: ev.targetX, y: ev.targetY };
      const enemyId = ev.enemyId !== undefined ? ev.enemyId : ev.targetId;
      const enemy = (state.enemies || []).find(function (item) { return item.id === enemyId; });
      if (enemy) return enemyPoint(enemy);
      const padIndex = ev.padIndex !== undefined ? ev.padIndex : ev.pad;
      if (Number.isFinite(Number(padIndex)) && pads[Number(padIndex)]) return pads[Number(padIndex)];
      return null;
    }

    function drawEffects(ctx, s) {
      if (!effects.length || reducedMotion()) { effects = []; return; }
      const now = nowMs();
      effects = effects.filter(function (effect) { return now - effect.born < effect.duration; });
      effects.forEach(function (effect) {
        const age = (now - effect.born) / effect.duration;
        ctx.save(); ctx.globalAlpha = Math.max(0, 1 - age);
        if (effect.to && effect.from) {
          ctx.strokeStyle = effect.kind === "chronos" ? pal.marble : pal.gold;
          ctx.lineWidth = Math.max(1, (0.55 - age * 0.3) * s);
          ctx.beginPath(); ctx.moveTo(effect.from.x * s, effect.from.y * s); ctx.lineTo(effect.to.x * s, effect.to.y * s); ctx.stroke();
        } else if (effect.at) {
          ctx.strokeStyle = effect.danger ? "#B7432B" : pal.gold;
          ctx.lineWidth = Math.max(1, 0.5 * s);
          ctx.beginPath(); ctx.arc(effect.at.x * s, effect.at.y * s, (1.5 + age * 6) * s, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.restore();
      });
    }

    function phaseLabel(state) {
      const active = state.phase === "combat" || state.phase === "wave" || state.waveActive;
      if (state.outcome === "victory") return skin.strings.victory || "VICTORY";
      if (state.outcome === "defeat") return skin.strings.defeat || "DEFEAT";
      if (active) return (skin.strings.combat || "WAVE") + " " + (Number(state.wave) || 1) + " / 12";
      const next = Math.min(12, (Number(state.wave) || 0) + 1);
      return (skin.strings.planning || "PLANNING") + "  ·  " + (skin.strings.nextWave || "NEXT WAVE") + " " + next;
    }

    function drawHud(ctx, s, state) {
      const phase = phaseLabel(state);
      ctx.save();
      ctx.fillStyle = "rgba(11,10,10,.76)"; ctx.fillRect(3 * s, 2.5 * s, 50 * s, 5.8 * s);
      ctx.strokeStyle = pal.goldDeep; ctx.lineWidth = Math.max(1, 0.2 * s); ctx.strokeRect(3 * s, 2.5 * s, 50 * s, 5.8 * s);
      ctx.fillStyle = pal.gold; ctx.font = "700 " + Math.max(11, 1.75 * s) + "px " + (skin.fonts.display || "serif");
      ctx.textBaseline = "middle"; ctx.textAlign = "left"; ctx.fillText(phase, 5 * s, 5.4 * s);

      const tower = selectedTower(state);
      const padNumber = (Number(state.selectedPad) || 0) + 1;
      let detail;
      if (tower) detail = towerType(tower).toUpperCase() + "  ·  LEVEL " + towerLevel(tower);
      else detail = "PAD " + padNumber + "  ·  " + String(state.selectedType || "sentinel").toUpperCase();
      ctx.fillStyle = "rgba(11,10,10,.74)"; ctx.fillRect(24 * s, 112.5 * s, 73 * s, 5 * s);
      ctx.fillStyle = pal.ink; ctx.font = "600 " + Math.max(10, 1.55 * s) + "px " + (skin.fonts.body || "serif");
      ctx.textAlign = "right"; ctx.fillText(detail, 95 * s, 115 * s);
      ctx.restore();
    }

    function updateUi(state) {
      const tower = selectedTower(state);
      const type = String(state.selectedType || "sentinel").toLowerCase();
      const phase = phaseLabel(state);
      const sig = [state.status, state.phase, state.wave, state.gold, state.integrity, state.selectedPad, type,
        tower ? towerType(tower) + towerLevel(tower) : "empty", state.outcome].join("|");
      if (sig === uiSignature) return;
      uiSignature = sig;

      ["sentinel", "chronos", "siege"].forEach(function (kind) {
        const button = document.querySelector('[data-btn="' + kind + '"]');
        if (!button) return;
        const selected = type === kind;
        const unavailable = state.status !== "playing" || !!tower || Number(state.gold) < BUILD_COST[kind];
        button.classList.toggle("is-selected", selected);
        button.classList.toggle("is-unavailable", unavailable);
        button.setAttribute("aria-pressed", String(selected));
        button.setAttribute("aria-disabled", String(unavailable));
        button.style.opacity = unavailable ? "0.42" : "";
        button.style.filter = unavailable ? "saturate(0.45)" : "";
        button.style.cursor = unavailable ? "not-allowed" : "";
      });
      const upgrade = document.querySelector('[data-btn="upgrade"]');
      if (upgrade) {
        const currentLevel = tower ? towerLevel(tower) : 0;
        const nextStats = tower && currentLevel < 3 ? statLevel(towerType(tower), currentLevel + 1) : null;
        const upgradeCost = nextStats ? Number(nextStats.upgradeCost !== undefined ? nextStats.upgradeCost : nextStats.cost) : 0;
        const unavailable = state.status !== "playing" || !tower || currentLevel >= 3 || Number(state.gold) < upgradeCost;
        upgrade.classList.toggle("is-unavailable", unavailable);
        upgrade.setAttribute("aria-disabled", String(unavailable));
        upgrade.style.opacity = unavailable ? "0.42" : "";
        upgrade.style.filter = unavailable ? "saturate(0.45)" : "";
        upgrade.style.cursor = unavailable ? "not-allowed" : "";
        upgrade.setAttribute("aria-label", tower && currentLevel < 3
          ? "Upgrade " + towerType(tower) + ", " + upgradeCost + " aether"
          : "Upgrade selected tower");
      }
      const wave = document.querySelector('[data-btn="wave"]');
      if (wave) {
        const unavailable = state.status !== "playing" || state.phase === "combat" || state.phase === "wave" || state.waveActive || Number(state.wave) >= 12;
        wave.classList.toggle("is-unavailable", !!unavailable);
        wave.setAttribute("aria-disabled", String(!!unavailable));
        wave.style.opacity = unavailable ? "0.42" : "";
        wave.style.filter = unavailable ? "saturate(0.45)" : "";
        wave.style.cursor = unavailable ? "not-allowed" : "";
        wave.setAttribute("aria-label", Number(state.wave) >= 12 ? "Campaign complete" : "Launch wave " + (Number(state.wave) + 1));
      }
      const status = document.getElementById("statusText");
      if (status) {
        const selection = tower
          ? towerType(tower).toUpperCase() + " level " + towerLevel(tower) + " selected on pad " + ((Number(state.selectedPad) || 0) + 1) + "."
          : "Empty pad " + ((Number(state.selectedPad) || 0) + 1) + "; " + type + " selected.";
        status.textContent = phase.replace("·", "—") + ". " + selection;
      }
    }

    r.resize = function () {
      const vp = K.wellViewport(o.wrapEl);
      dpr = vp.dpr;
      const scale = Math.max(2, Math.min(vp.availW / WORLD_W, vp.availH / WORLD_H));
      r.cell = scale;
      wellCtx = K.setupCanvas(o.wellCanvas, scale * WORLD_W, scale * WORLD_H, dpr);
      return { cell: scale };
    };

    r.hitTest = function (point) {
      const nx = Number(point && (point.x !== undefined ? point.x : point.nx));
      const ny = Number(point && (point.y !== undefined ? point.y : point.ny));
      if (!Number.isFinite(nx) || !Number.isFinite(ny)) return null;
      const x = Math.max(0, Math.min(1, nx)) * WORLD_W;
      const y = Math.max(0, Math.min(1, ny)) * WORLD_H;
      let best = -1, bestDistance = Infinity;
      for (let i = 0; i < pads.length; i++) {
        const distance = Math.hypot(x - pads[i].x, y - pads[i].y);
        if (distance <= PAD_HIT_RADIUS && distance < bestDistance) { best = i; bestDistance = distance; }
      }
      return best < 0 ? null : "selectPad:" + best;
    };

    r.handleEvent = function (ev, state) {
      if (!ev || reducedMotion()) return;
      state = state || lastState || { towers: [], enemies: [] };
      const type = String(ev.type || "").toLowerCase();
      if (type === "attack" || type === "fire") {
        const towerId = ev.towerId !== undefined ? ev.towerId : ev.sourceId;
        const tower = (state.towers || []).find(function (item) { return item.id === towerId; });
        const target = eventPoint(ev, state);
        if (tower && target) effects.push({ from: towerPoint(tower), to: target, kind: towerType(tower), born: nowMs(), duration: 150 });
      } else if (["build", "upgrade", "kill", "waveclear", "victory", "breach", "leak"].indexOf(type) !== -1) {
        const at = eventPoint(ev, state) || (type === "leak" || type === "breach" ? { x: 97, y: 101 } : null);
        if (at) effects.push({ at: at, danger: type === "leak" || type === "breach", born: nowMs(), duration: type === "victory" ? 650 : 360 });
      }
    };

    r.side = function (state) { updateUi(state); };

    r.draw = function (state) {
      lastState = state;
      updateUi(state);
      const ctx = wellCtx, s = r.cell, w = WORLD_W * s, h = WORLD_H * s;
      ctx.fillStyle = pal.well; ctx.fillRect(0, 0, w, h);
      if (images.battlefield) {
        ctx.save(); ctx.globalAlpha = 0.72; coverImage(ctx, images.battlefield, w, h); ctx.restore();
        ctx.fillStyle = "rgba(11,10,10,.38)"; ctx.fillRect(0, 0, w, h);
      } else {
        const gradient = ctx.createLinearGradient(0, 0, w, h);
        gradient.addColorStop(0, "#211A14"); gradient.addColorStop(0.48, pal.well); gradient.addColorStop(1, "#17120F");
        ctx.fillStyle = gradient; ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = K.hexToRgba(pal.marble, 0.045); ctx.lineWidth = Math.max(1, 0.2 * s);
        for (let y = 8; y < WORLD_H; y += 12) { ctx.beginPath(); ctx.moveTo(0, y * s); ctx.lineTo(w, y * s); ctx.stroke(); }
      }
      K.drawWatermark(ctx, skin, w, h, 0.34);
      drawRoute(ctx, s);
      drawBreach(ctx, s);
      drawGate(ctx, s);
      drawRange(ctx, s, state);
      drawPads(ctx, s, state);
      (state.towers || []).forEach(function (tower) { drawTower(ctx, s, tower); });
      (state.enemies || []).forEach(function (enemy) { drawEnemy(ctx, s, enemy); });
      drawEffects(ctx, s);
      drawHud(ctx, s, state);
    };

    r.resize();
    return r;
  }

  G.createRenderer = createRenderer;
})(typeof window !== "undefined" ? window : globalThis);
