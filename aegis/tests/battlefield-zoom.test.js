"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { zoomBattlefieldCamera: zoom } = require("../js/delivery/preview-controller.js");
const { DEFAULT_CAMERA: bounds } = require("../js/presentation/camera.js");

test("battlefield zoom preserves the world point under the pointer without changing its source camera", () => {
  const source = Object.freeze({ ...bounds });
  const anchor = { x: .3, y: .7 };
  const result = zoom(source, 2, anchor);
  assert.equal(result.width, bounds.width / 2);
  assert.equal(result.height, bounds.height / 2);
  assert.equal(result.x + anchor.x * result.width, source.x + anchor.x * source.width);
  assert.equal(result.y + anchor.y * result.height, source.y + anchor.y * source.height);
  assert.equal(source.width, bounds.width);
});

test("battlefield zoom clamps from whole-map fit to three times magnification", () => {
  const close = zoom(bounds, 100, { x: .5, y: .5 });
  assert.equal(close.width, bounds.width / 3);
  const far = zoom(close, .001, { x: .2, y: .8 });
  assert.deepEqual(far, { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height });
});

test("battlefield pan never exposes space outside the authored background", () => {
  const close = zoom(bounds, 2, { x: .5, y: .5 });
  for (const direction of [-1, 1]) {
    const result = zoom({ ...close, x: direction * 1e9, y: direction * 1e9 }, 1, { x: 0, y: 0 });
    assert.ok(result.x >= bounds.x && result.y >= bounds.y);
    assert.ok(result.x + result.width <= bounds.x + bounds.width);
    assert.ok(result.y + result.height <= bounds.y + bounds.height);
  }
});
