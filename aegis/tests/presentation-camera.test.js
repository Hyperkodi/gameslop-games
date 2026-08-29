"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const CAMERA_PATH = path.join(__dirname, "..", "js", "presentation", "camera.js");
const Camera = require(CAMERA_PATH);

function close(actual, expected, epsilon = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= epsilon,
    `${actual} must be within ${epsilon} of ${expected}`);
}

function assertPointClose(actual, expected, epsilon = 1e-9) {
  close(actual.x, expected.x, epsilon);
  close(actual.y, expected.y, epsilon);
}

test("exports the exact frozen default 16:10 camera and board bounds", () => {
  assert.deepEqual(Camera.DEFAULT_CAMERA, {
    id: "camera.overscan-16x10-v1",
    x: -18000,
    y: -12000,
    width: 198400,
    height: 124000,
  });
  assert.deepEqual(Camera.BOARD_BOUNDS, {
    x: 0,
    y: 0,
    width: 160000,
    height: 100000,
  });
  assert.equal(Camera.DEFAULT_CAMERA.width / Camera.DEFAULT_CAMERA.height, 8 / 5);
  assert.equal(Camera.cameraContainsBounds(Camera.DEFAULT_CAMERA, Camera.BOARD_BOUNDS), true);
  assert.equal(Object.isFrozen(Camera), true);
  assert.equal(Object.isFrozen(Camera.DEFAULT_CAMERA), true);
  assert.equal(Object.isFrozen(Camera.BOARD_BOUNDS), true);
});

test("camera validation makes a frozen defensive copy and fails closed", () => {
  const source = {
    id: "camera.test-16x10",
    x: -20000,
    y: -12500,
    width: 200000,
    height: 125000,
  };
  const required = { x: -6000, y: 22000, width: 172000, height: 52000 };
  const camera = Camera.validateCamera(source, required);
  assert.notStrictEqual(camera, source);
  assert.deepEqual(camera, source);
  assert.equal(Object.isFrozen(camera), true);
  source.x = 0;
  assert.equal(camera.x, -20000);

  const malformed = [
    Object.assign({}, Camera.DEFAULT_CAMERA, { extra: true }),
    Object.assign({}, Camera.DEFAULT_CAMERA, { id: "bad camera" }),
    Object.assign({}, Camera.DEFAULT_CAMERA, { x: 0.5 }),
    Object.assign({}, Camera.DEFAULT_CAMERA, { x: -16000, width: 195200, height: 122000 }),
    Object.assign({}, Camera.DEFAULT_CAMERA, { x: -0 }),
    Object.assign({}, Camera.DEFAULT_CAMERA, { width: 198401 }),
    Object.assign({}, Camera.DEFAULT_CAMERA, { width: 0 }),
    Object.assign({}, Camera.DEFAULT_CAMERA, { x: Number.MAX_SAFE_INTEGER }),
    { id: "camera.too-small", x: 0, y: 0, width: 80000, height: 50000 },
  ];
  malformed.forEach((candidate) => assert.throws(() => Camera.validateCamera(candidate), Error));
  assert.throws(
    () => Camera.validateCamera(Camera.DEFAULT_CAMERA,
      { x: -19000, y: 0, width: 1000, height: 1000 }),
    /contain required bounds/i
  );
  assert.equal(
    Camera.cameraContainsBounds(Camera.DEFAULT_CAMERA,
      { x: -19000, y: 0, width: 1000, height: 1000 }),
    false
  );
});

test("world and asset coordinates round trip across camera, board, route, pad, entry, and gate points", () => {
  const projection = Camera.createAssetProjection(Camera.DEFAULT_CAMERA, { width: 2048, height: 1280 });
  assert.equal(Object.isFrozen(projection), true);
  assert.equal(Object.isFrozen(projection.camera), true);
  assert.equal(Object.isFrozen(projection.asset), true);
  assert.equal(projection.kind, "asset");
  assertPointClose(Camera.worldToAsset(projection, { x: -18000, y: -12000 }), { x: 0, y: 0 });
  assertPointClose(Camera.worldToAsset(projection, { x: 180400, y: 112000 }), { x: 2048, y: 1280 });

  const points = [
    { x: 0, y: 0 },
    { x: 160000, y: 100000 },
    { x: -6000, y: 22000 },
    { x: 46000, y: 74000 },
    { x: 66000, y: 58000 },
    { x: 166000, y: 38000 },
  ];
  points.forEach((point) => {
    const assetPoint = Camera.worldToAsset(projection, point);
    const roundTrip = Camera.assetToWorld(projection, assetPoint);
    assertPointClose(roundTrip, point, 1e-8);
    assert.equal(Object.isFrozen(assetPoint), true);
    assert.equal(Object.isFrozen(roundTrip), true);
  });

  const derivative = Camera.createAssetProjection(Camera.DEFAULT_CAMERA, { width: 1280, height: 800 });
  points.forEach((point) => {
    assertPointClose(
      Camera.assetToWorld(derivative, Camera.worldToAsset(derivative, point)),
      point,
      1e-8
    );
  });
});

test("contain projection returns deterministic CSS and device-pixel letterboxes", () => {
  const exact = Camera.createContainProjection(Camera.DEFAULT_CAMERA, {
    width: 1280,
    height: 800,
    devicePixelRatio: 1.25,
  });
  assert.deepEqual(exact.content, { x: 0, y: 0, width: 1280, height: 800 });
  assert.deepEqual(exact.device, { x: 0, y: 0, width: 1600, height: 1000, scale: 1600 / 198400 });
  assert.equal(exact.viewport.backingWidth, 1600);
  assert.equal(exact.viewport.backingHeight, 1000);
  assert.equal(exact.mode, "contain");

  const portrait = Camera.createContainProjection(Camera.DEFAULT_CAMERA, {
    width: 390,
    height: 844,
    devicePixelRatio: 2,
  });
  assert.deepEqual(portrait.content, { x: 0, y: 300.125, width: 390, height: 243.75 });
  assert.deepEqual(portrait.device, { x: 0, y: 600.25, width: 780, height: 487.5, scale: 780 / 198400 });

  const landscape = Camera.createContainProjection(Camera.DEFAULT_CAMERA, {
    width: 844,
    height: 390,
  });
  assert.deepEqual(landscape.content, { x: 110, y: 0, width: 624, height: 390 });
  assert.equal(Object.isFrozen(landscape), true);
  assert.equal(Object.isFrozen(landscape.viewport), true);
  assert.equal(Object.isFrozen(landscape.content), true);
  assert.equal(Object.isFrozen(landscape.device), true);
});

test("world and screen coordinates share one inverse-safe transform", () => {
  const projection = Camera.createContainProjection(Camera.DEFAULT_CAMERA, {
    width: 390,
    height: 844,
    devicePixelRatio: 2,
  });
  const points = [
    { x: -18000, y: -12000 },
    { x: 180400, y: 112000 },
    { x: 0, y: 0 },
    { x: 160000, y: 100000 },
    { x: -6000, y: 22000 },
    { x: 66000, y: 58000 },
    { x: 166000, y: 38000 },
  ];
  points.forEach((point) => {
    const screenPoint = Camera.worldToScreen(projection, point);
    assert.equal(Camera.screenPointInside(projection, screenPoint), true);
    assertPointClose(Camera.screenToWorld(projection, screenPoint), point, 1e-8);
    const devicePoint = Camera.worldToDevicePixel(projection, point);
    assertPointClose(Camera.devicePixelToWorld(projection, devicePoint), point, 1e-8);
  });

  assert.equal(Camera.screenPointInside(projection, { x: 100, y: 100 }), false);
  assert.equal(Camera.screenPointInside(projection, { x: 0, y: 300.125 }), true);
  assert.equal(Camera.screenPointInside(projection, { x: 390, y: 543.875 }), true);
});

test("new projections respond to resize without mutating camera or prior projections", () => {
  const source = Object.assign({}, Camera.DEFAULT_CAMERA);
  const first = Camera.createContainProjection(source, { width: 1280, height: 800 });
  const second = Camera.createContainProjection(source, { width: 800, height: 1280 });
  assert.deepEqual(source, Camera.DEFAULT_CAMERA);
  assert.deepEqual(first.content, { x: 0, y: 0, width: 1280, height: 800 });
  assert.deepEqual(second.content, { x: 0, y: 390, width: 800, height: 500 });
  assert.notEqual(first.scale, second.scale);
  assert.deepEqual(first.content, { x: 0, y: 0, width: 1280, height: 800 });
});

test("asset, viewport, DPR, point, and arithmetic validation rejects unsafe values", () => {
  const badAssets = [
    { width: 2048, height: 1279 },
    { width: 0, height: 0 },
    { width: 2048.5, height: 1280 },
    { width: Number.MAX_SAFE_INTEGER, height: 5 },
    { width: 2048, height: 1280, fit: "cover" },
  ];
  badAssets.forEach((asset) => assert.throws(
    () => Camera.createAssetProjection(Camera.DEFAULT_CAMERA, asset),
    Error
  ));

  const badViewports = [
    { width: 0, height: 800 },
    { width: 1280, height: Infinity },
    { width: 1280, height: 800, devicePixelRatio: 0 },
    { width: 1280, height: 800, devicePixelRatio: Number.MAX_VALUE },
    { width: 1280, height: 800, fit: "cover" },
  ];
  badViewports.forEach((viewport) => assert.throws(
    () => Camera.createContainProjection(Camera.DEFAULT_CAMERA, viewport),
    Error
  ));

  const assetProjection = Camera.createAssetProjection(Camera.DEFAULT_CAMERA, { width: 2048, height: 1280 });
  const screenProjection = Camera.createContainProjection(Camera.DEFAULT_CAMERA, { width: 1280, height: 800 });
  assert.throws(() => Camera.worldToAsset(assetProjection, { x: NaN, y: 0 }), /safe integer/i);
  assert.throws(() => Camera.worldToScreen(screenProjection,
    { x: Number.MAX_SAFE_INTEGER, y: Number.MIN_SAFE_INTEGER }), /safe/i);
  assert.throws(() => Camera.assetToWorld(assetProjection, { x: Infinity, y: 0 }), /finite/i);
  assert.throws(() => Camera.screenToWorld(screenProjection, { x: 0, y: Number.MAX_VALUE }), /safe/i);
});

test("classic-script UMD install is pure, frozen, and collision-safe", () => {
  const source = fs.readFileSync(CAMERA_PATH, "utf8");
  function forbiddenCapability(name) {
    return new Proxy(function () {}, {
      apply() { throw new Error(`${name} was called`); },
      construct() { throw new Error(`${name} was constructed`); },
      get() { throw new Error(`${name} was read`); },
      set() { throw new Error(`${name} was mutated`); },
    });
  }
  const capabilities = {
    document: forbiddenCapability("document"),
    fetch: forbiddenCapability("fetch"),
    location: forbiddenCapability("location"),
    navigator: forbiddenCapability("navigator"),
  };
  const context = vm.createContext(Object.assign({}, capabilities));
  vm.runInContext(source, context, { filename: "camera.js" });
  assert.ok(context.Game);
  assert.equal(context.Game.AegisCamera.DEFAULT_CAMERA.id, "camera.overscan-16x10-v1");
  assert.equal(Object.isFrozen(context.Game.AegisCamera), true);
  Object.keys(capabilities).forEach((key) => assert.strictEqual(context[key], capabilities[key], key));

  const collision = Object.freeze({ owner: "other-camera" });
  const collisionContext = vm.createContext({ Game: { AegisCamera: collision } });
  assert.throws(
    () => vm.runInContext(source, collisionContext, { filename: "camera.js" }),
    /Conflicting Game\.AegisCamera/
  );
  assert.strictEqual(collisionContext.Game.AegisCamera, collision);
});
