(function (global) {
  "use strict";
  const K = global.GameSlopKit, G = global.Game = global.Game || {};
  G.config = {
    game: "starfall",
    createEngine: (o) => G.createEngine(o),
    createRenderer: (o) => G.createRenderer(o),
    sounds: {
      fire: [[900, 0.07, "sawtooth", 0.05, 0, 300]],
      hit: [[240, 0.05, "square", 0.07]],
      explode: [[120, 0.12, "sawtooth", 0.1]],
      damage: [[392, 0.12, "triangle", 0.08, 0], [262, 0.18, "triangle", 0.08, 0.1]],
      wave: [[440, 0.1, "triangle", 0.08, 0], [660, 0.1, "triangle", 0.08, 0.09], [880, 0.12, "triangle", 0.09, 0.18]],
      gameover: [[392, 0.24, "sawtooth", 0.06, 0], [330, 0.24, "sawtooth", 0.06, 0.18], [262, 0.24, "sawtooth", 0.06, 0.36], [196, 0.24, "sawtooth", 0.06, 0.54]],
    },
    events: { fire: "fire", hit: "hit", explode: "explode", damage: "damage", wave: "wave", gameover: "gameover" },
    onEvent: (ev, ctx) => { if (ev.type === "explode") ctx.renderer.explode(ev.kind, ev.x, ev.y); },
    stats: [{ id: "score", key: "score" }, { id: "wave", key: "wave" }, { id: "lives", key: "lives" }],
    input: {
      keys: {
        ArrowLeft: { down: "leftOn", up: "leftOff" }, KeyA: { down: "leftOn", up: "leftOff" },
        ArrowRight: { down: "rightOn", up: "rightOff" }, KeyD: { down: "rightOn", up: "rightOff" },
        Space: { down: "fireOn", up: "fireOff" },
      },
      gestures: { dragHold: { left: "leftOn", right: "rightOn", deadzone: 8 }, holdFire: { on: "fireOn", off: "fireOff" } },
      buttons: [
        { btn: "left", press: "leftOn", release: "leftOff" },
        { btn: "fire", press: "fireOn", release: "fireOff" },
        { btn: "right", press: "rightOn", release: "rightOff" },
      ],
    },
    startsOnAnyAction: true,
    forwardStartAction: true,
    ignoreWhileReady: ["leftOff", "rightOff", "fireOff"],
  };
  global.addEventListener("DOMContentLoaded", function () { K.createShell(G.config); });
})(typeof window !== "undefined" ? window : globalThis);
