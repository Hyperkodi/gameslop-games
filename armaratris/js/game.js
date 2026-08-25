(function (global) {
  "use strict";
  const K = global.GameSlopKit, G = global.Game = global.Game || {};
  G.config = {
    game: "armaratris",
    createEngine: (o) => global.Armaratris.createEngine(o),
    createRenderer: (o) => G.createRenderer(o),
    sounds: { move: [[220, 0.035, "square", 0.04]], rotate: [[330, 0.05, "square", 0.045]], hold: [[440, 0.06, "triangle", 0.06, 0, 660]], lock: [[130, 0.09, "triangle", 0.12, 0, 70]], clear: [[523, 0.1, "triangle", 0.1], [784, 0.16, "triangle", 0.1, 0.09]], tetris: [[523, 0.16, "triangle", 0.11, 0], [659, 0.16, "triangle", 0.11, 0.09], [784, 0.16, "triangle", 0.11, 0.18], [1047, 0.16, "triangle", 0.11, 0.27]], gameover: [[392, 0.24, "sawtooth", 0.06, 0], [330, 0.24, "sawtooth", 0.06, 0.18], [262, 0.24, "sawtooth", 0.06, 0.36], [196, 0.24, "sawtooth", 0.06, 0.54]] },
    events: { move: "move", rotate: "rotate", hold: "hold", lock: "lock", gameover: "gameover" },
    onEvent: (ev, c) => { if (ev.type === "clear") { c.audio.play(ev.lines === 4 ? "tetris" : "clear"); c.renderer.flash(ev.rows, ev.board); } },
    drawExtras: (engine) => (engine.state.active && engine.state.status === "playing" ? engine.ghostY() : undefined),
    stats: [{ id: "score", key: "score" }, { id: "level", key: "level" }, { id: "lines", key: "lines" }],
    input: {
      keys: { ArrowUp: "rotateCW", KeyX: "rotateCW", KeyZ: "rotateCCW", ControlLeft: "rotateCCW", ControlRight: "rotateCCW", Space: "hardDrop", KeyC: "hold", ShiftLeft: "hold", ShiftRight: "hold", ArrowDown: { down: "softDropOn", up: "softDropOff" } },
      repeatKeys: { ArrowLeft: "left", ArrowRight: "right" },
      gestures: { dragCols: { left: "left", right: "right" }, tap: "rotateCW", swipeDownFast: "hardDrop", swipeDownSlow: { on: "softDropOn", off: "softDropOff" }, swipeUp: "hold" },
      buttons: [{ btn: "left", press: "left", repeat: true }, { btn: "rotate", tap: "rotateCW" }, { btn: "drop", tap: "hardDrop", hold: "softDropOn", release: "softDropOff" }, { btn: "right", press: "right", repeat: true }],
    },
    startsOnAnyAction: true,
  };
  global.addEventListener("DOMContentLoaded", function () { K.createShell(G.config); });
})(typeof window !== "undefined" ? window : globalThis);
