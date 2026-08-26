(function (global) {
  "use strict";
  const K = global.GameSlopKit, G = global.Game = global.Game || {};
  G.config = {
    game: "2048",
    createEngine: (o) => G.createEngine(o),
    createRenderer: (o) => G.createRenderer(o),
    sounds: {
      slide: [[200, 0.05, "sine", 0.05]],
      merge: [[600, 0.09, "triangle", 0.08, 0, 900]],
      won: [[523, 0.12, "triangle", 0.09, 0], [659, 0.12, "triangle", 0.09, 0.09], [784, 0.12, "triangle", 0.09, 0.18], [1047, 0.16, "triangle", 0.09, 0.27]],
      gameover: [[392, 0.24, "sawtooth", 0.06, 0], [330, 0.24, "sawtooth", 0.06, 0.18], [262, 0.24, "sawtooth", 0.06, 0.36], [196, 0.24, "sawtooth", 0.06, 0.54]],
    },
    events: { slide: "slide", merge: "merge", won: "won", gameover: "gameover" },
    onEvent: function (ev, ctx) {
      if (ev.type === "slide" && ctx.renderer.slide) ctx.renderer.slide(ev.from);
    },
    stats: [{ id: "score", key: "score" }, { id: "besttile", get: (s) => s.bestTile }],
    input: {
      keys: { ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down", ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right" },
      gestures: { swipe4: { up: "up", down: "down", left: "left", right: "right" } },
      buttons: [{ btn: "left", tap: "left" }, { btn: "up", tap: "up" }, { btn: "down", tap: "down" }, { btn: "right", tap: "right" }],
    },
    startsOnAnyAction: true,
    ignoreWhileReady: [],
  };
  global.addEventListener("DOMContentLoaded", function () { K.createShell(G.config); });
})(typeof window !== "undefined" ? window : globalThis);
