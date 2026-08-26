(function (global) {
  "use strict";
  const K = global.GameSlopKit, G = global.Game = global.Game || {};
  G.config = {
    game: "flight",
    createEngine: (o) => G.createEngine(o),
    createRenderer: (o) => G.createRenderer(o),
    sounds: {
      flap: [[500, 0.08, "sine", 0.08, 0, 700]],
      score: [[880, 0.09, "triangle", 0.09]],
      gameover: [[392, 0.24, "sawtooth", 0.06, 0], [330, 0.24, "sawtooth", 0.06, 0.18], [262, 0.24, "sawtooth", 0.06, 0.36], [196, 0.24, "sawtooth", 0.06, 0.54]],
    },
    events: { flap: "flap", score: "score", gameover: "gameover" },
    stats: [{ id: "score", key: "score" }],
    input: {
      keys: { Space: "flap", ArrowUp: "flap", KeyW: "flap" },
      gestures: { tap: "flap" },
      buttons: [{ btn: "flap", tap: "flap" }],
    },
    startsOnAnyAction: true,
    ignoreWhileReady: [],
  };
  global.addEventListener("DOMContentLoaded", function () { K.createShell(G.config); });
})(typeof window !== "undefined" ? window : globalThis);
