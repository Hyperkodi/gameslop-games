const test = require("node:test");
const assert = require("node:assert/strict");

function fakeDom() {
  const handlers = {};
  const el = { addEventListener: (ev, fn) => { handlers[ev] = fn; }, removeEventListener() {}, setPointerCapture() {}, querySelectorAll: () => [] };
  globalThis.addEventListener = el.addEventListener; globalThis.removeEventListener = () => {};
  let now = 0; globalThis.performance = { now: () => now };
  return { el, handlers, tick: (ms) => { now += ms; } };
}
function load() { delete require.cache[require.resolve("../input.js")]; require("../input.js"); return globalThis.GameSlopKit; }

test("repeatKeys: DAS 170 then ARR 40", () => {
  const d = fakeDom(); const K = load(); const out = [];
  const input = K.createInput({ wellEl: d.el, touchEl: null, cellSize: () => 24, repeatKeys: { ArrowLeft: "left" }, onAction: (a) => out.push(a) });
  d.handlers.keydown({ code: "ArrowLeft", preventDefault() {} });
  input.update(160); assert.deepEqual(out, ["left"]);
  input.update(10); input.update(40); input.update(40); assert.deepEqual(out, ["left", "left", "left"]);
  d.handlers.keyup({ code: "ArrowLeft" }); input.update(200); assert.equal(out.length, 3);
});

test("keys: string fires on down; {down,up} fires both; reserved keys go to onSystem", () => {
  const d = fakeDom(); const K = load(); const out = [], sys = [];
  K.createInput({ wellEl: d.el, touchEl: null, cellSize: () => 24, keys: { Space: "flap", ArrowRight: { down: "rightOn", up: "rightOff" } }, onAction: (a) => out.push(a), onSystem: (s) => sys.push(s) });
  d.handlers.keydown({ code: "Space", preventDefault() {} });
  d.handlers.keydown({ code: "ArrowRight", preventDefault() {} }); d.handlers.keyup({ code: "ArrowRight" });
  d.handlers.keydown({ code: "Enter", preventDefault() {} }); d.handlers.keydown({ code: "KeyP", preventDefault() {} }); d.handlers.keydown({ code: "KeyM", preventDefault() {} });
  assert.deepEqual(out, ["flap", "rightOn", "rightOff"]);
  assert.deepEqual(sys, ["start", "pause", "mute"]);
});

test("swipe4: first axis to cross 24px wins, once per gesture; tap fires tap action", () => {
  const d = fakeDom(); const K = load(); const out = [];
  K.createInput({ wellEl: d.el, touchEl: null, cellSize: () => 24, gestures: { swipe4: { up: "up", down: "down", left: "left", right: "right" }, tap: "flap" }, onAction: (a) => out.push(a) });
  const p = (type, x, y, id = 1) => d.handlers[type]({ pointerId: id, pointerType: "touch", button: 0, clientX: x, clientY: y, target: { closest: () => null }, preventDefault() {} });
  p("pointerdown", 100, 100); p("pointermove", 110, 100); p("pointermove", 130, 104); p("pointermove", 160, 140); d.tick(150); p("pointerup", 160, 140);
  assert.deepEqual(out, ["right"]);
  p("pointerdown", 100, 100); d.tick(100); p("pointerup", 102, 101);
  assert.deepEqual(out, ["right", "flap"]);
});

test("dragHold emits On when past deadzone and Off on return/lift", () => {
  const d = fakeDom(); const K = load(); const out = [];
  K.createInput({ wellEl: d.el, touchEl: null, cellSize: () => 24, gestures: { dragHold: { left: "leftOn", right: "rightOn", deadzone: 8 } }, onAction: (a) => out.push(a) });
  const p = (type, x, y) => d.handlers[type]({ pointerId: 1, pointerType: "touch", button: 0, clientX: x, clientY: y, target: { closest: () => null }, preventDefault() {} });
  p("pointerdown", 100, 100); p("pointermove", 104, 100); assert.deepEqual(out, []);
  p("pointermove", 120, 100); assert.deepEqual(out, ["rightOn"]);
  p("pointermove", 80, 100); assert.deepEqual(out, ["rightOn", "rightOff", "leftOn"]);
  p("pointerup", 80, 100); assert.deepEqual(out, ["rightOn", "rightOff", "leftOn", "leftOff"]);
});

test("buttons: press/release and tap/hold/release", () => {
  const d = fakeDom(); const K = load(); const out = [];
  const btns = {};
  const mk = (name) => ({ getAttribute: () => name, addEventListener: (ev, fn) => { (btns[name] = btns[name] || {})[ev] = fn; }, removeEventListener() {}, setPointerCapture() {} });
  const touchEl = { querySelectorAll: () => [mk("fire"), mk("drop")] };
  const realSetTimeout = globalThis.setTimeout, realClear = globalThis.clearTimeout; let timers = [];
  globalThis.setTimeout = (fn) => { timers.push(fn); return timers.length; }; globalThis.clearTimeout = (id) => { timers[id - 1] = null; };
  K.createInput({ wellEl: d.el, touchEl, cellSize: () => 24, buttons: [{ btn: "fire", press: "fireOn", release: "fireOff" }, { btn: "drop", tap: "hardDrop", hold: "softDropOn", release: "softDropOff" }], onAction: (a) => out.push(a) });
  const ev = { pointerId: 2, preventDefault() {} };
  btns.fire.pointerdown(ev); btns.fire.pointerup(ev); assert.deepEqual(out, ["fireOn", "fireOff"]);
  btns.drop.pointerdown(ev); btns.drop.pointerup(ev); assert.deepEqual(out, ["fireOn", "fireOff", "hardDrop"]);
  btns.drop.pointerdown(ev); timers.filter(Boolean).forEach((fn) => fn()); btns.drop.pointerup(ev);
  assert.deepEqual(out, ["fireOn", "fireOff", "hardDrop", "softDropOn", "softDropOff"]);
  globalThis.setTimeout = realSetTimeout; globalThis.clearTimeout = realClear;
});
