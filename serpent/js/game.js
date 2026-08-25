(function (global) {
  "use strict";
  const K = global.GameSlopKit, G = global.Game = global.Game || {};
  G.config = {
    game: "serpent",
    createEngine: (o) => G.createEngine(o),
    createRenderer: (o) => G.createRenderer(o),
    sounds: {
      turn: [[260, 0.04, "square", 0.05]],
      eat: [[660, 0.08, "triangle", 0.09], [990, 0.1, "triangle", 0.09, 0.08]],
      gameover: [[392, 0.24, "sawtooth", 0.06, 0], [330, 0.24, "sawtooth", 0.06, 0.18], [262, 0.24, "sawtooth", 0.06, 0.36], [196, 0.24, "sawtooth", 0.06, 0.54]],
    },
    events: { turn: "turn", eat: "eat", gameover: "gameover" },
    stats: [{ id: "score", key: "score" }, { id: "length", key: "length" }],
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
