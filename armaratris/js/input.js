/* Input: keyboard (DAS/ARR), touch gestures on the well, on-screen buttons. Emits actions; never touches the engine directly. */
(function (global) {
  "use strict";
  const A = global.Armaratris = global.Armaratris || {};
  const DAS_MS = 170, ARR_MS = 40;
  const TAP_MS = 220, TAP_DIST = 12, HARD_DROP_MIN_PX = 60, HARD_DROP_MIN_VEL = 0.9; // px/ms
  const LONG_PRESS_MS = 250;

  const KEYS = {
    ArrowLeft: "left", ArrowRight: "right", ArrowUp: "rotateCW", KeyX: "rotateCW",
    KeyZ: "rotateCCW", ControlLeft: "rotateCCW", ControlRight: "rotateCCW",
    Space: "hardDrop", KeyC: "hold", ShiftLeft: "hold", ShiftRight: "hold",
  };

  function createInput(o) {
    const act = o.onAction, sys = o.onSystem || function () {};
    const held = { left: false, right: false };
    let dasDir = null, dasTimer = 0, arrTimer = 0;
    const listeners = [];
    function on(el, ev, fn, opts) { el.addEventListener(ev, fn, opts); listeners.push([el, ev, fn, opts]); }

    function pressDir(dir) {
      if (held[dir]) return;
      held[dir] = true;
      dasDir = dir; dasTimer = 0; arrTimer = 0;
      act(dir);
    }
    function releaseDir(dir) {
      held[dir] = false;
      if (dasDir === dir) {
        dasDir = held.left ? "left" : held.right ? "right" : null;
        dasTimer = 0; arrTimer = 0;
      }
    }

    // ---- keyboard ----
    on(global, "keydown", function (e) {
      if (e.repeat) { if (KEYS[e.code] || e.code === "ArrowDown") e.preventDefault(); return; }
      switch (e.code) {
        case "Enter": sys("start"); e.preventDefault(); return;
        case "KeyP": case "Escape": sys("pause"); e.preventDefault(); return;
        case "KeyM": sys("mute"); return;
        case "ArrowDown": act("softDropOn"); e.preventDefault(); return;
        case "ArrowLeft": pressDir("left"); e.preventDefault(); return;
        case "ArrowRight": pressDir("right"); e.preventDefault(); return;
      }
      const a = KEYS[e.code];
      if (a) { act(a); e.preventDefault(); }
    });
    on(global, "keyup", function (e) {
      if (e.code === "ArrowDown") act("softDropOff");
      if (e.code === "ArrowLeft") releaseDir("left");
      if (e.code === "ArrowRight") releaseDir("right");
    });
    on(global, "blur", function () { held.left = held.right = false; dasDir = null; act("softDropOff"); });

    // ---- touch / pointer gestures on the well ----
    let g = null; // gesture state
    on(o.wellEl, "pointerdown", function (e) {
      if (e.target && e.target.closest && e.target.closest("button, .overlay")) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      o.wellEl.setPointerCapture(e.pointerId);
      g = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, t0: performance.now(), tLast: performance.now(), movedCols: 0, soft: false, moved: false };
      e.preventDefault();
    }, { passive: false });
    on(o.wellEl, "pointermove", function (e) {
      if (!g || e.pointerId !== g.id) return;
      const cell = o.cellSize();
      const dx = e.clientX - g.x0, dy = e.clientY - g.y0;
      const cols = Math.trunc(dx / cell);
      while (g.movedCols < cols) { act("right"); g.movedCols++; g.moved = true; }
      while (g.movedCols > cols) { act("left"); g.movedCols--; g.moved = true; }
      const now = performance.now();
      const vel = (e.clientY - g.y) / Math.max(1, now - g.tLast);
      g.x = e.clientX; g.y = e.clientY; g.tLast = now;
      if (!g.soft && dy > cell && Math.abs(dx) < cell * 1.5 && vel < HARD_DROP_MIN_VEL && vel > 0) {
        g.soft = true; act("softDropOn"); g.moved = true;
      }
    });
    function endGesture(e) {
      if (!g || e.pointerId !== g.id) return;
      const dt = performance.now() - g.t0;
      const dx = e.clientX - g.x0, dy = e.clientY - g.y0;
      const vel = dy / Math.max(1, dt);
      if (g.soft) act("softDropOff");
      if (!g.moved && dt < TAP_MS && Math.abs(dx) < TAP_DIST && Math.abs(dy) < TAP_DIST) {
        act("rotateCW");
      } else if (!g.soft && dy > HARD_DROP_MIN_PX && vel > HARD_DROP_MIN_VEL && Math.abs(dx) < Math.abs(dy)) {
        act("hardDrop");
      } else if (dy < -HARD_DROP_MIN_PX && Math.abs(dx) < Math.abs(dy)) {
        act("hold");
      }
      g = null;
    }
    on(o.wellEl, "pointerup", endGesture);
    on(o.wellEl, "pointercancel", function (e) { if (g && e.pointerId === g.id) { if (g.soft) act("softDropOff"); g = null; } });

    // ---- on-screen buttons ----
    if (o.touchEl) {
      o.touchEl.querySelectorAll("[data-btn]").forEach(function (btn) {
        const kind = btn.getAttribute("data-btn");
        let pressTimer = null, softOn = false;
        on(btn, "pointerdown", function (e) {
          e.preventDefault();
          btn.setPointerCapture(e.pointerId);
          if (kind === "left" || kind === "right") pressDir(kind);
          else if (kind === "rotate") act("rotateCW");
          else if (kind === "drop") {
            pressTimer = setTimeout(function () { softOn = true; act("softDropOn"); }, LONG_PRESS_MS);
          }
        }, { passive: false });
        const release = function () {
          if (kind === "left" || kind === "right") releaseDir(kind);
          else if (kind === "drop") {
            if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
            if (softOn) { softOn = false; act("softDropOff"); } else act("hardDrop");
          }
        };
        on(btn, "pointerup", release);
        on(btn, "pointercancel", function () {
          if (kind === "left" || kind === "right") releaseDir(kind);
          if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
          if (softOn) { softOn = false; act("softDropOff"); }
        });
      });
    }

    return {
      update: function (dt) {
        if (!dasDir) return;
        dasTimer += dt;
        if (dasTimer < DAS_MS) return;
        arrTimer += dt;
        while (arrTimer >= ARR_MS) { arrTimer -= ARR_MS; act(dasDir); }
      },
      destroy: function () { listeners.forEach(function (l) { l[0].removeEventListener(l[1], l[2], l[3]); }); },
    };
  }

  A.createInput = createInput;
})(typeof window !== "undefined" ? window : globalThis);
