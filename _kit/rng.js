/* Deterministic RNG kit: mulberry32 PRNG, fnv1a string hash, shuffle-bag, and seed parsing.
   Shared by every game's engine; Armaratris keeps its own internal copies (untouched). */
(function (global) {
  "use strict";
  const K = global.GameSlopKit = global.GameSlopKit || {};

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function fnv1a(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return ("0000000" + h.toString(16)).slice(-8);
  }

  // Fisher–Yates shuffle-bag over a copy of `items`: pops until empty, then reshuffles a fresh copy.
  function createBag(rng, items) {
    let bag = [];
    return function next() {
      if (bag.length === 0) {
        bag = items.slice();
        for (let i = bag.length - 1; i > 0; i--) {
          const j = Math.floor(rng() * (i + 1));
          const tmp = bag[i]; bag[i] = bag[j]; bag[j] = tmp;
        }
      }
      return bag.pop();
    };
  }

  function parseSeed(v) {
    if (v === null || v === "") return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? (n >>> 0) : (parseInt(fnv1a(String(v)), 16) >>> 0);
  }

  const api = { mulberry32: mulberry32, fnv1a: fnv1a, createBag: createBag, parseSeed: parseSeed };
  Object.assign(K, api);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
