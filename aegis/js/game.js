(function (global) {
  "use strict";

  const K = global.GameSlopKit;
  const G = global.Game = global.Game || {};
  let engineRef = null, rendererRef = null;

  function tapAction(point) {
    if (!rendererRef || !engineRef) return null;
    return rendererRef.hitTest(point, engineRef.state);
  }

  function wireAegisChrome() {
    const commandRoot = document.getElementById("touch");
    if (commandRoot) {
      // The command deck floats over the canvas. Let its mapped button listeners run, then stop
      // their pointer events from also becoming battlefield taps on #wellwrap.
      commandRoot.addEventListener("pointerdown", function (event) {
        event.stopPropagation();
      });
    }

    const pauseButton = document.getElementById("pauseButton");
    if (pauseButton) {
      pauseButton.addEventListener("click", function () {
        // Keyboard pause is the shared shell's public system-input path; using it here preserves
        // the standard pause overlay and the contextual-panel close-before-pause hook.
        global.dispatchEvent(new KeyboardEvent("keydown", {
          key: "p", code: "KeyP", bubbles: true, cancelable: true,
        }));
      });
    }
  }

  function endOverlay(state, skin) {
    if (state.outcome === "victory") {
      return {
        title: skin.strings.victory,
        body: (skin.strings.victoryBody || "TWELVE WAVES BROKEN") +
          "\n" + skin.strings.score + " " + state.score +
          "\n" + skin.strings.integrity + " " + state.integrity,
        button: skin.strings.restart,
      };
    }
    return {
      title: skin.strings.defeat,
      body: (skin.strings.defeatBody || "THE LEGIONS BROKE THROUGH") +
        "\n" + skin.strings.score + " " + state.score +
        "\n" + skin.strings.wave + " " + state.wave,
      button: skin.strings.restart,
    };
  }

  G.config = {
    game: "aegis",
    createEngine: function (options) {
      engineRef = G.createEngine(options);
      return engineRef;
    },
    createRenderer: function (options) {
      rendererRef = G.createRenderer(options);
      return rendererRef;
    },
    sounds: {
      build: [[330, 0.06, "triangle", 0.055, 0], [494, 0.09, "triangle", 0.06, 0.05]],
      upgrade: [[392, 0.07, "triangle", 0.055, 0], [523, 0.07, "triangle", 0.06, 0.06], [659, 0.1, "triangle", 0.065, 0.12]],
      sell: [[523, 0.06, "triangle", 0.05, 0], [330, 0.1, "triangle", 0.055, 0.05]],
      attack: [[760, 0.035, "square", 0.025, 0, -180]],
      kill: [[220, 0.06, "sawtooth", 0.04, 0, -80]],
      leak: [[196, 0.13, "sawtooth", 0.07, 0], [147, 0.16, "sawtooth", 0.06, 0.08]],
      wave: [[392, 0.08, "triangle", 0.06, 0], [523, 0.1, "triangle", 0.065, 0.08]],
      waveclear: [[440, 0.09, "triangle", 0.055, 0], [659, 0.11, "triangle", 0.065, 0.08], [880, 0.14, "triangle", 0.07, 0.16]],
      denied: [[130, 0.08, "square", 0.045, 0, -25]],
      victory: [[392, 0.13, "triangle", 0.06, 0], [523, 0.13, "triangle", 0.065, 0.1], [659, 0.15, "triangle", 0.07, 0.2], [988, 0.22, "triangle", 0.08, 0.31]],
      breach: [[110, 0.12, "sawtooth", 0.07, 0, -30]],
    },
    events: {
      build: "build", upgrade: "upgrade", sell: "sell", attack: "attack", fire: "attack", kill: "kill",
      leak: "leak", wave: "wave", waveclear: "waveclear", denied: "denied",
      victory: "victory", breach: "breach",
    },
    onEvent: function (event, context) {
      if (context.renderer.handleEvent) context.renderer.handleEvent(event, context.engine.state);
    },
    stats: [
      { id: "score", key: "score" },
      { id: "wave", key: "wave" },
      { id: "integrity", key: "integrity" },
      { id: "aether", key: "gold" },
      { id: "outcome", key: "outcome", get: function (state) { return state.outcome || ""; } },
    ],
    input: {
      keys: {
        ArrowLeft: "prevPad", KeyA: "prevPad",
        ArrowRight: "nextPad", KeyD: "nextPad",
        Digit1: "build:sentinel", Numpad1: "build:sentinel",
        Digit2: "build:chronos", Numpad2: "build:chronos",
        Digit3: "build:siege", Numpad3: "build:siege",
        KeyU: "upgrade", KeyS: "sell", Space: "wave",
      },
      gestures: { tapAt: tapAction },
      buttons: [
        { btn: "sentinel", tap: "build:sentinel" },
        { btn: "chronos", tap: "build:chronos" },
        { btn: "siege", tap: "build:siege" },
        { btn: "upgrade", tap: "upgrade" },
        { btn: "sell", tap: "sell" },
        { btn: "wave", tap: "wave" },
      ],
    },
    endOverlay: endOverlay,
    startsOnAnyAction: false,
    forwardStartAction: false,
  };

  global.addEventListener("DOMContentLoaded", function () {
    wireAegisChrome();
    K.createShell(G.config);
  });
})(typeof window !== "undefined" ? window : globalThis);
