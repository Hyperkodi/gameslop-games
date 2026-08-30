/* Input: keyboard (DAS/ARR), touch gestures on the well, on-screen buttons. Emits actions; never touches
   the engine directly. Generalized from armaratris/js/input.js, configurable per game via createInput(cfg). */
(function (global) {
  "use strict";
  const K = global.GameSlopKit = global.GameSlopKit || {};
  const DAS_MS = 170, ARR_MS = 40;
  const TAP_MS = 220, TAP_DIST = 12, HARD_DROP_MIN_PX = 60, HARD_DROP_MIN_VEL = 0.9; // px/ms
  const LONG_PRESS_MS = 250, SWIPE4_PX = 24;

  const RESERVED = { Enter: "start", KeyP: "pause", Escape: "pause", KeyM: "mute" };

  // Derive a dragHold OFF action from its ON action: trailing "On" -> "Off", else append "Off".
  function offAction(a) {
    return /On$/.test(a) ? a.slice(0, -2) + "Off" : a + "Off";
  }

  function createInput(o) {
    const act = o.onAction || function () {};
    const sys = o.onSystem || function () {};
    const G = o.gestures || {};
    const listeners = [];
    function on(el, ev, fn, opts) { el.addEventListener(ev, fn, opts); listeners.push([el, ev, fn, opts]); }

    // ---- shared DAS/ARR repeat engine: keyboard repeatKeys + button {press, repeat:true} ----
    const repeatSources = {}; // token -> action
    if (o.repeatKeys) { for (const code in o.repeatKeys) repeatSources[code] = o.repeatKeys[code]; }
    const repeatHeld = {}; // token -> bool
    let dasToken = null, dasTimer = 0, arrTimer = 0;

    function repeatPress(token) {
      if (repeatHeld[token]) return;
      repeatHeld[token] = true;
      dasToken = token; dasTimer = 0; arrTimer = 0;
      act(repeatSources[token]);
    }
    function repeatRelease(token) {
      if (!repeatHeld[token]) return;
      repeatHeld[token] = false;
      if (dasToken === token) {
        dasToken = null;
        for (const t in repeatHeld) { if (repeatHeld[t]) { dasToken = t; break; } }
        dasTimer = 0; arrTimer = 0;
      }
    }

    // ---- keyboard ----
    const keysDown = {}; // code -> bool, for {down,up} keys currently held (blur release)
    on(global, "keydown", function (e) {
      const code = e.code;
      if (e.repeat) {
        if (RESERVED[code] || (o.repeatKeys && o.repeatKeys[code]) || (o.keys && o.keys[code])) e.preventDefault();
        return;
      }
      if (RESERVED[code]) {
        sys(RESERVED[code]);
        if (code !== "KeyM") e.preventDefault();
        return;
      }
      if (o.repeatKeys && o.repeatKeys[code]) { repeatPress(code); e.preventDefault(); return; }
      const k = o.keys && o.keys[code];
      if (k) {
        if (typeof k === "string") { act(k); }
        else { keysDown[code] = true; if (k.down) act(k.down); }
        e.preventDefault();
      }
    });
    on(global, "keyup", function (e) {
      const code = e.code;
      if (o.repeatKeys && o.repeatKeys[code]) { repeatRelease(code); return; }
      const k = o.keys && o.keys[code];
      if (k && typeof k === "object") {
        const was = keysDown[code]; keysDown[code] = false;
        if (was && k.up) act(k.up);
      }
    });

    // ---- touch / pointer gestures on the well ----
    let g = null; // gesture state

    function releaseWellGesture() {
      if (!g) return;
      if (G.holdFire) act(G.holdFire.off);
      if (G.swipeDownSlow && g.slowOn) act(G.swipeDownSlow.off);
      if (G.dragHold && g.dragDir) act(offAction(G.dragHold[g.dragDir]));
    }

    if (o.wellEl) {
      on(o.wellEl, "pointerdown", function (e) {
        if (e.target && e.target.closest && e.target.closest("button, .overlay")) return;
        if (e.pointerType === "mouse" && e.button !== 0) return;
        if (o.wellEl.setPointerCapture) o.wellEl.setPointerCapture(e.pointerId);
        const now = performance.now();
        g = {
          id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY,
          t0: now, tLast: now, movedCols: 0, dragDir: null, slowOn: false, swiped4: false, moved: false,
        };
        if (G.holdFire) act(G.holdFire.on);
        e.preventDefault();
      }, { passive: false });

      on(o.wellEl, "pointermove", function (e) {
        if (!g || e.pointerId !== g.id) return;
        const dx = e.clientX - g.x0, dy = e.clientY - g.y0;
        const now = performance.now();

        if (G.dragCols) {
          const cell = o.cellSize();
          const cols = Math.trunc(dx / cell);
          while (g.movedCols < cols) { act(G.dragCols.right); g.movedCols++; g.moved = true; }
          while (g.movedCols > cols) { act(G.dragCols.left); g.movedCols--; g.moved = true; }
        }

        if (G.dragHold) {
          const dz = G.dragHold.deadzone == null ? 8 : G.dragHold.deadzone;
          let desired = null;
          if (dx > dz) desired = "right"; else if (dx < -dz) desired = "left";
          if (desired !== g.dragDir) {
            if (g.dragDir) { act(offAction(G.dragHold[g.dragDir])); g.moved = true; }
            if (desired) { act(G.dragHold[desired]); g.moved = true; }
            g.dragDir = desired;
          }
        }

        if (G.swipe4 && !g.swiped4) {
          const adx = Math.abs(dx), ady = Math.abs(dy);
          if (adx >= SWIPE4_PX || ady >= SWIPE4_PX) {
            let dir;
            if (adx >= SWIPE4_PX && ady >= SWIPE4_PX) dir = adx >= ady ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up");
            else if (adx >= SWIPE4_PX) dir = dx > 0 ? "right" : "left";
            else dir = dy > 0 ? "down" : "up";
            const a = G.swipe4[dir];
            if (a) { act(a); g.swiped4 = true; g.moved = true; }
          }
        }

        if (G.swipeDownSlow && !g.slowOn) {
          const cell = o.cellSize();
          const vel = (e.clientY - g.y) / Math.max(1, now - g.tLast);
          if (dy > cell && Math.abs(dx) < cell * 1.5 && vel < HARD_DROP_MIN_VEL && vel > 0) {
            g.slowOn = true; act(G.swipeDownSlow.on); g.moved = true;
          }
        }

        g.x = e.clientX; g.y = e.clientY; g.tLast = now;
      });

      function endGesture(e, cancelled) {
        if (!g || e.pointerId !== g.id) return;
        releaseWellGesture();
        if (!cancelled) {
          const dt = performance.now() - g.t0;
          const dx = e.clientX - g.x0, dy = e.clientY - g.y0;
          const vel = dy / Math.max(1, dt);
          if (!g.moved && dt < TAP_MS && Math.abs(dx) < TAP_DIST && Math.abs(dy) < TAP_DIST) {
            if (typeof G.tapAt === "function") {
              const pointerEl = o.pointerEl || o.wellEl;
              const rect = pointerEl && pointerEl.getBoundingClientRect ? pointerEl.getBoundingClientRect() : null;
              if (rect) {
                const width = rect.width || 1, height = rect.height || 1;
                const point = {
                  x: Math.max(0, Math.min(1, (e.clientX - rect.left) / width)),
                  y: Math.max(0, Math.min(1, (e.clientY - rect.top) / height)),
                };
                const action = G.tapAt(point);
                if (action !== null && action !== undefined) act(action);
              }
            } else if (G.tap) act(G.tap);
          } else if (G.swipeDownFast && !g.slowOn && dy > HARD_DROP_MIN_PX && vel > HARD_DROP_MIN_VEL && Math.abs(dx) < Math.abs(dy)) {
            act(G.swipeDownFast);
          } else if (G.swipeUp && dy < -HARD_DROP_MIN_PX && Math.abs(dx) < Math.abs(dy)) {
            act(G.swipeUp);
          }
        }
        g = null;
      }
      on(o.wellEl, "pointerup", function (e) { endGesture(e, false); });
      on(o.wellEl, "pointercancel", function (e) { endGesture(e, true); });
    }

    // ---- on-screen buttons ----
    const buttonReleasers = [];
    if (o.touchEl && o.buttons) {
      o.touchEl.querySelectorAll("[data-btn]").forEach(function (el) {
        const kind = el.getAttribute("data-btn");
        const cfg = o.buttons.filter(function (b) { return b.btn === kind; })[0];
        if (!cfg) return;

        const repeatToken = cfg.repeat ? ("btn:" + cfg.btn) : null;
        if (repeatToken) repeatSources[repeatToken] = cfg.press;
        let holdTimer = null, holdActive = false, pressActive = false;

        on(el, "pointerdown", function (e) {
          e.preventDefault();
          if (el.setPointerCapture) el.setPointerCapture(e.pointerId);
          if (repeatToken) { repeatPress(repeatToken); return; }
          if (cfg.press) { pressActive = true; act(cfg.press); return; }
          if (cfg.hold) {
            holdTimer = setTimeout(function () { holdTimer = null; holdActive = true; act(cfg.hold); }, LONG_PRESS_MS);
          }
        }, { passive: false });

        function doRelease() {
          if (repeatToken) { repeatRelease(repeatToken); return; }
          if (cfg.press) { if (pressActive) { pressActive = false; if (cfg.release) act(cfg.release); } return; }
          if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; if (cfg.tap) act(cfg.tap); return; }
          if (holdActive) { holdActive = false; if (cfg.release) act(cfg.release); return; }
          if (cfg.tap) act(cfg.tap);
        }
        function doCancel() {
          if (repeatToken) { repeatRelease(repeatToken); return; }
          if (cfg.press) { if (pressActive) { pressActive = false; if (cfg.release) act(cfg.release); } return; }
          if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; return; }
          if (holdActive) { holdActive = false; if (cfg.release) act(cfg.release); }
        }

        on(el, "pointerup", doRelease);
        on(el, "pointercancel", doCancel);
        buttonReleasers.push(doCancel);
      });
    }

    // ---- window blur: release everything ----
    on(global, "blur", function () {
      for (const code in keysDown) {
        if (keysDown[code]) {
          keysDown[code] = false;
          const k = o.keys && o.keys[code];
          if (k && k.up) act(k.up);
        }
      }
      for (const token in repeatHeld) { repeatRelease(token); }
      releaseWellGesture();
      g = null;
      buttonReleasers.forEach(function (fn) { fn(); });
    });

    return {
      update: function (dt) {
        if (!dasToken) return;
        dasTimer += dt;
        if (dasTimer < DAS_MS) return;
        arrTimer += dt;
        while (arrTimer >= ARR_MS) { arrTimer -= ARR_MS; act(repeatSources[dasToken]); }
      },
      destroy: function () {
        listeners.forEach(function (l) { l[0].removeEventListener(l[1], l[2], l[3]); });
      },
    };
  }

  const api = { createInput: createInput };
  Object.assign(K, api);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
