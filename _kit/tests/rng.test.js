const test = require("node:test");
const assert = require("node:assert/strict");
const K = require("../rng.js");

test("mulberry32 is deterministic per seed and in [0,1)", () => {
  const a = K.mulberry32(9), b = K.mulberry32(9), c = K.mulberry32(10);
  const va = [a(), a(), a()], vb = [b(), b(), b()], vc = [c(), c(), c()];
  assert.deepEqual(va, vb); assert.notDeepEqual(va, vc);
  va.forEach((v) => assert.ok(v >= 0 && v < 1));
});
test("fnv1a matches reference vectors", () => {
  assert.equal(K.fnv1a(""), "811c9dc5");
  assert.equal(K.fnv1a("a"), "e40c292c");
});
test("createBag returns each item once per cycle", () => {
  const next = K.createBag(K.mulberry32(3), ["A", "B", "C"]);
  const seen = [next(), next(), next()].sort();
  assert.deepEqual(seen, ["A", "B", "C"]);
  const again = [next(), next(), next()].sort();
  assert.deepEqual(again, ["A", "B", "C"]);
});
test("parseSeed: empty → undefined, integer → uint32, string → fnv1a", () => {
  assert.equal(K.parseSeed(null), undefined);
  assert.equal(K.parseSeed(""), undefined);
  assert.equal(K.parseSeed("42"), 42);
  assert.equal(K.parseSeed("-1"), 4294967295);
  assert.equal(K.parseSeed("hello"), parseInt(K.fnv1a("hello"), 16) >>> 0);
  assert.notEqual(K.parseSeed("hello"), 0);
});
