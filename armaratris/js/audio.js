/* Procedural SFX via Web Audio. No files. */
(function (global) {
  "use strict";
  const A = global.Armaratris = global.Armaratris || {};
  const KEY = "armaratris:muted";

  function createAudio() {
    let ctx = null;
    let muted = false;
    try { muted = global.localStorage && global.localStorage.getItem(KEY) === "1"; } catch (e) { /* storage blocked */ }

    function ensure() {
      if (!ctx) {
        const AC = global.AudioContext || global.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
      }
      if (ctx.state === "suspended") ctx.resume();
      return ctx;
    }

    function tone(freq, dur, type, gain, when, slideTo) {
      const c = ensure();
      if (!c || muted) return;
      const t = c.currentTime + (when || 0);
      const o = c.createOscillator(), g = c.createGain();
      o.type = type || "square";
      o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      g.gain.setValueAtTime(gain || 0.08, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(c.destination);
      o.start(t); o.stop(t + dur + 0.02);
    }

    const sounds = {
      move: function () { tone(220, 0.035, "square", 0.04); },
      rotate: function () { tone(330, 0.05, "square", 0.045); },
      hold: function () { tone(440, 0.06, "triangle", 0.06, 0, 660); },
      lock: function () { tone(130, 0.09, "triangle", 0.12, 0, 70); },
      clear: function () { tone(523, 0.1, "triangle", 0.1); tone(784, 0.16, "triangle", 0.1, 0.09); },
      tetris: function () { [523, 659, 784, 1047].forEach(function (f, i) { tone(f, 0.16, "triangle", 0.11, i * 0.09); }); },
      gameover: function () { [392, 330, 262, 196].forEach(function (f, i) { tone(f, 0.24, "sawtooth", 0.06, i * 0.18); }); },
    };

    return {
      play: function (name) { const f = sounds[name]; if (f) f(); },
      unlock: function () { ensure(); },
      get muted() { return muted; },
      toggle: function () {
        muted = !muted;
        try { global.localStorage.setItem(KEY, muted ? "1" : "0"); } catch (e) { /* ignore */ }
        return muted;
      },
    };
  }

  A.createAudio = createAudio;
})(typeof window !== "undefined" ? window : globalThis);
