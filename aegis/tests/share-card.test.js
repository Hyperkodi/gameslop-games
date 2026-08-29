"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const MODULE_PATH = path.join(__dirname, "../js/presentation/share-card.js");
const ShareCard = require(MODULE_PATH);

function victoryInput(overrides) {
  return Object.assign({
    widthPx: 1200,
    heightPx: 675,
    outcome: "victory",
    missionTitle: "Gate of Dawn",
    score: 123400,
    waves: { cleared: 12, total: 12 },
    gateHealth: { current: 73, max: 100 },
    challengeLine: "Hold every inner corner",
    replay: { code: "AEGIS-7K2M9Q", seed: 4276993775 },
  }, overrides || {});
}

function expectDiagnostic(fn, code, diagnosticPath) {
  assert.throws(fn, function (error) {
    assert.equal(error.name, "ShareCardDiagnosticError");
    assert.equal(error.code, code);
    assert.equal(error.path, diagnosticPath);
    assert.equal(Object.isFrozen(error), true);
    return true;
  });
}

function fakeCanvas() {
  const operations = [];
  const contextTarget = {
    save: function () { operations.push(["save"]); },
    restore: function () { operations.push(["restore"]); },
    fillRect: function () { operations.push(["fillRect"].concat(Array.from(arguments))); },
    strokeRect: function () { operations.push(["strokeRect"].concat(Array.from(arguments))); },
    drawImage: function (image) {
      operations.push(["drawImage", image.id].concat(Array.from(arguments).slice(1)));
    },
    fillText: function () { operations.push(["fillText"].concat(Array.from(arguments))); },
  };
  const context = new Proxy(contextTarget, {
    set: function (target, property, value) {
      operations.push(["set", String(property), value]);
      target[property] = value;
      return true;
    },
  });
  const attributes = [];
  const canvas = {
    width: 3,
    height: 4,
    getContext: function (kind) {
      operations.push(["getContext", kind]);
      return kind === "2d" ? context : null;
    },
    setAttribute: function (name, value) {
      attributes.push([name, value]);
    },
  };
  return { canvas: canvas, operations: operations, attributes: attributes };
}

test("exports one frozen UMD/CommonJS API with fixed local assets and dimensions", function () {
  assert.equal(ShareCard.VERSION, 1);
  assert.equal(ShareCard.CARD_WIDTH_PX, 1200);
  assert.equal(ShareCard.CARD_HEIGHT_PX, 675);
  assert.deepEqual(ShareCard.ASSETS, {
    background: "art/v2/ui/victory-share-v1.webp",
    logo: "skin/armara/logo.png",
  });
  assert.equal(Object.isFrozen(ShareCard), true);
  assert.equal(Object.isFrozen(ShareCard.ASSETS), true);

  const source = fs.readFileSync(MODULE_PATH, "utf8");
  const sandbox = { Game: {} };
  vm.runInNewContext(source, sandbox, { filename: "share-card.js" });
  assert.equal(typeof sandbox.Game.AegisShareCard.createModel, "function");
  assert.equal(typeof sandbox.Game.AegisShareCard.render, "function");
  assert.equal(Object.isFrozen(sandbox.Game.AegisShareCard), true);
});

test("creates a strict immutable 1200x675 model without retaining caller objects", function () {
  const source = victoryInput();
  const model = ShareCard.createModel(source);

  assert.deepEqual(model, {
    schemaVersion: 1,
    widthPx: 1200,
    heightPx: 675,
    outcome: "victory",
    missionTitle: "Gate of Dawn",
    score: 123400,
    waves: { cleared: 12, total: 12 },
    gateHealth: { current: 73, max: 100 },
    challengeLine: "Hold every inner corner",
    replay: { code: "AEGIS-7K2M9Q", seed: 4276993775 },
  });
  assert.notStrictEqual(model, source);
  assert.notStrictEqual(model.waves, source.waves);
  assert.notStrictEqual(model.gateHealth, source.gateHealth);
  assert.notStrictEqual(model.replay, source.replay);
  assert.equal(Object.isFrozen(model), true);
  assert.equal(Object.isFrozen(model.waves), true);
  assert.equal(Object.isFrozen(model.gateHealth), true);
  assert.equal(Object.isFrozen(model.replay), true);

  source.waves.cleared = 0;
  source.replay.code = "CHANGED";
  assert.equal(model.waves.cleared, 12);
  assert.equal(model.replay.code, "AEGIS-7K2M9Q");

  const minimal = ShareCard.createModel({
    widthPx: 1200,
    heightPx: 675,
    outcome: "defeat",
    missionTitle: "Broken Causeway",
    score: 900,
    waves: { cleared: 4, total: 8 },
    gateHealth: { current: 0, max: 100 },
  });
  assert.equal(minimal.challengeLine, null);
  assert.equal(minimal.replay, null);
  assert.equal(Object.isFrozen(minimal), true);
});

test("rejects unknown fields, non-exact dimensions, unsafe text, and invalid stats", function () {
  expectDiagnostic(
    function () { ShareCard.createModel(Object.assign(victoryInput(), { playerName: "Athena" })); },
    "SHARE_MODEL_FIELDS",
    "/playerName"
  );
  expectDiagnostic(
    function () { ShareCard.createModel(Object.assign(victoryInput(), { widthPx: 1200, heightPx: 630 })); },
    "SHARE_DIMENSIONS",
    "/heightPx"
  );
  expectDiagnostic(
    function () { ShareCard.createModel(Object.assign(victoryInput(), { missionTitle: "Gate\nOverride" })); },
    "SHARE_TEXT_CONTROL",
    "/missionTitle"
  );
  expectDiagnostic(
    function () { ShareCard.createModel(Object.assign(victoryInput(), { challengeLine: "<script>alert(1)</script>" })); },
    "SHARE_TEXT_UNSAFE",
    "/challengeLine"
  );
  expectDiagnostic(
    function () { ShareCard.createModel(Object.assign(victoryInput(), { score: -1 })); },
    "SHARE_INTEGER_RANGE",
    "/score"
  );
  expectDiagnostic(
    function () { ShareCard.createModel(Object.assign(victoryInput(), { waves: { cleared: 13, total: 12 } })); },
    "SHARE_WAVES_RANGE",
    "/waves/cleared"
  );
  expectDiagnostic(
    function () { ShareCard.createModel(Object.assign(victoryInput(), { gateHealth: { current: 101, max: 100 } })); },
    "SHARE_GATE_RANGE",
    "/gateHealth/current"
  );
  expectDiagnostic(
    function () { ShareCard.createModel(Object.assign(victoryInput(), { replay: { code: "bad code", seed: 1 } })); },
    "SHARE_REPLAY_CODE",
    "/replay/code"
  );
  expectDiagnostic(
    function () { ShareCard.createModel(Object.assign(victoryInput(), { replay: { code: "AEGIS-VALID", seed: 4294967296 } })); },
    "SHARE_INTEGER_RANGE",
    "/replay/seed"
  );
});

test("accessible summaries are deterministic, complete, and omit absent optional data", function () {
  const victory = ShareCard.createModel(victoryInput());
  assert.equal(
    ShareCard.summaryText(victory),
    "Local victory. Mission Gate of Dawn. Score 123,400. Waves 12 of 12. Gate health 73 of 100. " +
      "Challenge: Hold every inner corner. Replay code AEGIS-7K2M9Q. Seed 4,276,993,775."
  );

  const defeat = ShareCard.createModel({
    widthPx: 1200,
    heightPx: 675,
    outcome: "defeat",
    missionTitle: "Broken Causeway",
    score: 900,
    waves: { cleared: 4, total: 8 },
    gateHealth: { current: 0, max: 100 },
  });
  assert.equal(
    ShareCard.summaryText(defeat),
    "Defeat. Mission Broken Causeway. Score 900. Waves 4 of 8. Gate health 0 of 100."
  );
});

test("renders through injected dependencies at exact size with separate blank art and canonical logo draws", async function () {
  const model = ShareCard.createModel(victoryInput());
  const first = fakeCanvas();
  const loaded = [];
  const result = await ShareCard.render(model, {
    canvas: first.canvas,
    imageLoader: async function (href) {
      loaded.push(href);
      return { id: href };
    },
  });

  assert.deepEqual(loaded, [ShareCard.ASSETS.background, ShareCard.ASSETS.logo]);
  assert.equal(first.canvas.width, 1200);
  assert.equal(first.canvas.height, 675);
  assert.strictEqual(result.canvas, first.canvas);
  assert.strictEqual(result.model, model);
  assert.equal(result.widthPx, 1200);
  assert.equal(result.heightPx, 675);
  assert.equal(result.summary, ShareCard.summaryText(model));
  assert.equal(Object.isFrozen(result), true);
  assert.deepEqual(first.attributes, [
    ["role", "img"],
    ["aria-label", ShareCard.summaryText(model)],
  ]);

  const draws = first.operations.filter(function (operation) { return operation[0] === "drawImage"; });
  assert.deepEqual(draws, [
    ["drawImage", ShareCard.ASSETS.background, 0, 0, 1200, 675],
    ["drawImage", ShareCard.ASSETS.logo, 64, 44, 112, 112],
  ]);
  const text = first.operations
    .filter(function (operation) { return operation[0] === "fillText"; })
    .map(function (operation) { return operation[1]; });
  [
    "ARMARA AEGIS", "LOCAL VICTORY", "Gate of Dawn", "SCORE", "123,400",
    "WAVES", "12 / 12", "GATE HEALTH", "73 / 100", "CHALLENGE",
    "Hold every inner corner", "REPLAY AEGIS-7K2M9Q", "SEED 4276993775",
  ].forEach(function (label) { assert.ok(text.includes(label), "missing live canvas text: " + label); });

  const second = fakeCanvas();
  await ShareCard.render(model, {
    canvas: second.canvas,
    imageLoader: function (href) { return Promise.resolve({ id: href }); },
  });
  assert.deepEqual(second.operations, first.operations, "identical models must produce identical draw operations");
  assert.equal(Object.isFrozen(model), true);
});

test("renderer rejects malformed models and dependencies without browser or file side effects", async function () {
  const model = ShareCard.createModel(victoryInput());
  await assert.rejects(
    ShareCard.render(model, { canvas: {}, imageLoader: async function () { return {}; } }),
    function (error) {
      return error.name === "ShareCardDiagnosticError" && error.code === "SHARE_CANVAS";
    }
  );
  await assert.rejects(
    ShareCard.render(model, { canvas: fakeCanvas().canvas, imageLoader: null }),
    function (error) {
      return error.name === "ShareCardDiagnosticError" && error.code === "SHARE_IMAGE_LOADER";
    }
  );

  const source = fs.readFileSync(MODULE_PATH, "utf8");
  assert.doesNotMatch(source, /\bfetch\s*\(|XMLHttpRequest|navigator\.share|window\.open|postMessage|toDataURL|toBlob|createElement/i);
  assert.doesNotMatch(source, /\.\.\/sim\/|\.\.\/delivery\//i);
});
