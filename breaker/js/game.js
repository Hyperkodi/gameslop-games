(function (global) {
  "use strict";
  const K = global.GameSlopKit, G = global.Game = global.Game || {};
  G.config = {
    game: "breaker",
    createEngine: (o) => G.createEngine(o),
    createRenderer: (o) => G.createRenderer(o),
    sounds: {
      bounce: [[180, 0.03, "square", 0.05]],
      brick: [[520, 0.09, "triangle", 0.08, 0, 780]],
      launch: [[440, 0.16, "sawtooth", 0.06, 0, 880]],
      life: [[392, 0.12, "triangle", 0.08, 0], [262, 0.18, "triangle", 0.08, 0.1]],
      level: [[523, 0.12, "triangle", 0.09, 0], [659, 0.12, "triangle", 0.09, 0.09], [784, 0.12, "triangle", 0.09, 0.18], [1047, 0.14, "triangle", 0.09, 0.27]],
      gameover: [[392, 0.24, "sawtooth", 0.06, 0], [330, 0.24, "sawtooth", 0.06, 0.18], [262, 0.24, "sawtooth", 0.06, 0.36], [196, 0.24, "sawtooth", 0.06, 0.54]],
    },
    events: { bounce: "bounce", brick: "brick", launch: "launch", life: "life", level: "level", gameover: "gameover" },
    stats: [{ id: "score", key: "score" }, { id: "level", key: "level" }, { id: "lives", key: "lives" }],
    input: {
      keys: {
        ArrowLeft: { down: "leftOn", up: "leftOff" }, KeyA: { down: "leftOn", up: "leftOff" },
        ArrowRight: { down: "rightOn", up: "rightOff" }, KeyD: { down: "rightOn", up: "rightOff" },
        Space: "launch",
      },
      gestures: { dragHold: { left: "leftOn", right: "rightOn", deadzone: 8 }, tap: "launch" },
      buttons: [
        { btn: "left", press: "leftOn", release: "leftOff" },
        { btn: "launch", tap: "launch" },
        { btn: "right", press: "rightOn", release: "rightOff" },
      ],
    },
    startsOnAnyAction: true,
    forwardStartAction: true,
    ignoreWhileReady: ["leftOff", "rightOff"],
  };
  global.addEventListener("DOMContentLoaded", function () { K.createShell(G.config); });
})(typeof window !== "undefined" ? window : globalThis);
