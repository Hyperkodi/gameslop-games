/* Procedural SFX via Web Audio. No files. Recipes are injected per game. */
(function (global) {
  "use strict";
  const K = global.GameSlopKit = global.GameSlopKit || {};
  const KEY = "gameslop:muted";

  function createAudio(recipes) {
    recipes = recipes || {};
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

    function play(name) {
      const rows = recipes[name];
      if (!rows) return;
      rows.forEach(function (row) { tone(row[0], row[1], row[2], row[3], row[4], row[5]); });
    }

    return {
      play: play,
      unlock: function () { ensure(); },
      get muted() { return muted; },
      toggle: function () {
        muted = !muted;
        try { global.localStorage.setItem(KEY, muted ? "1" : "0"); } catch (e) { /* ignore */ }
        return muted;
      },
    };
  }

  const api = { createAudio: createAudio };
  Object.assign(K, api);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
