const test = require("node:test");
const assert = require("node:assert/strict");

test("createAudio: mute persists under gameslop:muted and play() never throws without AudioContext", () => {
  const store = {};
  globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = v; } };
  delete require.cache[require.resolve("../audio.js")];
  require("../audio.js");
  const K = globalThis.GameSlopKit;
  const a = K.createAudio({ ping: [[440, 0.05, "square", 0.05]] });
  assert.equal(a.muted, false);
  assert.doesNotThrow(() => a.play("ping"));
  assert.doesNotThrow(() => a.play("nope"));
  assert.equal(a.toggle(), true);
  assert.equal(store["gameslop:muted"], "1");
  const b = K.createAudio({});
  assert.equal(b.muted, true);
});
