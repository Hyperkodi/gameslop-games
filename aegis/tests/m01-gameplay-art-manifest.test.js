"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const AEGIS_ROOT = path.join(REPO_ROOT, "games", "aegis");
const { AegisContentError } = require(path.join(REPO_ROOT, "tools", "lib", "aegis", "diagnostics.js"));
const Generator = require(path.join(REPO_ROOT, "tools", "generate-aegis-m01-gameplay-art-manifest.js"));

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function expectDiagnostic(fn, code, diagnosticPath) {
  assert.throws(fn, function (error) {
    assert.ok(error instanceof AegisContentError, String(error));
    assert.equal(error.diagnostics[0].code, code);
    if (diagnosticPath !== undefined) assert.equal(error.diagnostics[0].path, diagnosticPath);
    return true;
  });
}

function capture() {
  let stdout = Buffer.alloc(0);
  let stderr = "";
  return {
    io: {
      stdout: {
        write(value) {
          const bytes = Buffer.isBuffer(value) ? value : Buffer.from(String(value), "utf8");
          stdout = Buffer.concat([stdout, bytes]);
        },
      },
      stderr: { write(value) { stderr += String(value); } },
    },
    stdout() { return stdout; },
    stderr() { return stderr; },
  };
}

function temporaryAssetRoot(t) {
  const temporaryBase = path.resolve(os.tmpdir());
  const root = fs.mkdtempSync(path.join(temporaryBase, "aegis-m01-gameplay-art-"));
  const resolved = path.resolve(root);
  assert.equal(path.dirname(resolved), temporaryBase);
  t.after(function () {
    assert.equal(path.dirname(resolved), temporaryBase);
    fs.rmSync(resolved, { force: true, recursive: true });
  });
  return resolved;
}

function limit(overrides) {
  return Object.assign({}, Generator.PACK_LIMITS, overrides);
}

test("M01 gameplay inventory locks five decoded alpha atlases and their frame semantics", () => {
  const inventory = Generator.buildM01GameplayArtInventory();

  assert.equal(Object.isFrozen(inventory), true);
  assert.equal(Object.isFrozen(inventory.atlasRecords), true);
  assert.equal(Object.isFrozen(inventory.atlasRecords[0].rowRecords[0].columnStates), true);
  assert.equal(Object.isFrozen(inventory.atlasRecords[0].frameRecords[0]), true);
  assert.deepEqual(inventory.atlasRecords.map(function (record) {
    return {
      id: record.id,
      relativeUrl: record.relativeUrl,
      sha256: record.sha256,
      widthPx: record.widthPx,
      heightPx: record.heightPx,
      alphaMode: record.alphaMode,
      transferBytes: record.transferBytes,
      decodedBytes: record.decodedBytes,
      frameCount: record.frameRecords.length,
    };
  }), [
    {
      id: "asset.m01.enemy.raider.atlas",
      relativeUrl: "art/v2/m01/enemies/raider-anim-v1.webp",
      sha256: "sha256:088c2322c806f0d70de40118a5d0d6ed243e82664738e20562c860972f905c68",
      widthPx: 1024,
      heightPx: 512,
      alphaMode: "alpha",
      transferBytes: 167406,
      decodedBytes: 2097152,
      frameCount: 8,
    },
    {
      id: "asset.m01.enemy.scout.atlas",
      relativeUrl: "art/v2/m01/enemies/scout-anim-v1.webp",
      sha256: "sha256:a392c25ed9330c534a007523a84c057c9c650eb718fc74dfb22d637e5f165181",
      widthPx: 1024,
      heightPx: 512,
      alphaMode: "alpha",
      transferBytes: 143098,
      decodedBytes: 2097152,
      frameCount: 8,
    },
    {
      id: "asset.m01.tower.chronos.atlas",
      relativeUrl: "art/v2/m01/towers/chronos-anim-v1.webp",
      sha256: "sha256:946000313a4ba23538aa8a586ff8f3bb3ba737f452684f27c47f2d1b1fcf7109",
      widthPx: 1024,
      heightPx: 768,
      alphaMode: "alpha",
      transferBytes: 330862,
      decodedBytes: 3145728,
      frameCount: 12,
    },
    {
      id: "asset.m01.tower.sentinel.atlas",
      relativeUrl: "art/v2/m01/towers/sentinel-anim-v1.webp",
      sha256: "sha256:c5365ec8f13398eeeed446f543a1c98b2178844ff9355e21ca6a00d06f676d6e",
      widthPx: 1024,
      heightPx: 768,
      alphaMode: "alpha",
      transferBytes: 305796,
      decodedBytes: 3145728,
      frameCount: 12,
    },
    {
      id: "asset.m01.tower.siege.atlas",
      relativeUrl: "art/v2/m01/towers/siege-anim-v1.webp",
      sha256: "sha256:bd034cb8b9f0820a79c4f7753e75b307c8771a54dd83b3acf26128e7f5301834",
      widthPx: 1024,
      heightPx: 768,
      alphaMode: "alpha",
      transferBytes: 326838,
      decodedBytes: 3145728,
      frameCount: 12,
    },
  ]);

  assert.deepEqual(inventory.atlasRecords.map(function (record) {
    const proof = record.transparency;
    assert.equal(Object.isFrozen(proof), true);
    assert.equal(Object.values(proof).every(Number.isSafeInteger), true);
    assert.equal(
      proof.transparentPixelCount + proof.translucentPixelCount + proof.opaquePixelCount,
      proof.totalPixelCount
    );
    return {
      id: record.id,
      total: proof.totalPixelCount,
      transparent: proof.transparentPixelCount,
      clear: proof.clearPixelCount,
      clearBp: proof.clearPixelBasisPoints,
      minimumFrameClearBp: proof.minimumFrameClearPixelBasisPoints,
      perimeter: proof.perimeterPixelCount,
      visiblePerimeter: proof.visiblePerimeterPixelCount,
      maximumFrameVisiblePerimeterBp: proof.maximumFrameVisiblePerimeterBasisPoints,
      corners: proof.cornerPixelCount,
      visibleCorners: proof.visibleCornerPixelCount,
      maximumFrameVisibleCornerBp: proof.maximumFrameVisibleCornerBasisPoints,
      visibleMagentaPerimeter: proof.visibleMagentaPerimeterPixelCount,
      maximumFrameVisibleMagentaPerimeterBp: proof.maximumFrameVisibleMagentaPerimeterBasisPoints,
      visibleMagentaCorners: proof.visibleMagentaCornerPixelCount,
    };
  }), [
    {
      id: "asset.m01.enemy.raider.atlas", total: 524288, transparent: 345887,
      clear: 353816, clearBp: 6748, minimumFrameClearBp: 6437, perimeter: 8160,
      visiblePerimeter: 305, maximumFrameVisiblePerimeterBp: 774, corners: 2048,
      visibleCorners: 0, maximumFrameVisibleCornerBp: 0, visibleMagentaPerimeter: 2,
      maximumFrameVisibleMagentaPerimeterBp: 19, visibleMagentaCorners: 0,
    },
    {
      id: "asset.m01.enemy.scout.atlas", total: 524288, transparent: 376813,
      clear: 384941, clearBp: 7342, minimumFrameClearBp: 6917, perimeter: 8160,
      visiblePerimeter: 64, maximumFrameVisiblePerimeterBp: 215, corners: 2048,
      visibleCorners: 0, maximumFrameVisibleCornerBp: 0, visibleMagentaPerimeter: 0,
      maximumFrameVisibleMagentaPerimeterBp: 0, visibleMagentaCorners: 0,
    },
    {
      id: "asset.m01.tower.chronos.atlas", total: 786432, transparent: 222683,
      clear: 452069, clearBp: 5748, minimumFrameClearBp: 5270, perimeter: 12240,
      visiblePerimeter: 1302, maximumFrameVisiblePerimeterBp: 1656, corners: 3072,
      visibleCorners: 0, maximumFrameVisibleCornerBp: 0, visibleMagentaPerimeter: 16,
      maximumFrameVisibleMagentaPerimeterBp: 29, visibleMagentaCorners: 0,
    },
    {
      id: "asset.m01.tower.sentinel.atlas", total: 786432, transparent: 219319,
      clear: 438122, clearBp: 5571, minimumFrameClearBp: 5054, perimeter: 12240,
      visiblePerimeter: 190, maximumFrameVisiblePerimeterBp: 254, corners: 3072,
      visibleCorners: 0, maximumFrameVisibleCornerBp: 0, visibleMagentaPerimeter: 0,
      maximumFrameVisibleMagentaPerimeterBp: 0, visibleMagentaCorners: 0,
    },
    {
      id: "asset.m01.tower.siege.atlas", total: 786432, transparent: 20371,
      clear: 348471, clearBp: 4431, minimumFrameClearBp: 3678, perimeter: 12240,
      visiblePerimeter: 2334, maximumFrameVisiblePerimeterBp: 3176, corners: 3072,
      visibleCorners: 337, maximumFrameVisibleCornerBp: 4375, visibleMagentaPerimeter: 0,
      maximumFrameVisibleMagentaPerimeterBp: 0, visibleMagentaCorners: 0,
    },
  ]);
  inventory.atlasRecords.forEach(function (record) {
    assert.equal(record.transparency.alphaClearMaximum, 8);
    assert.equal(record.transparency.cornerSampleSizePx, 8);
    assert.equal(record.transparency.minimumRequiredFrameClearPixelBasisPoints, 3000);
    assert.equal(record.transparency.maximumAllowedFramePerimeterVisibleBasisPoints, 5000);
    assert.equal(record.transparency.maximumAllowedFrameCornerVisibleBasisPoints, 5000);
    assert.equal(record.transparency.maximumAllowedFrameMagentaPerimeterBasisPoints, 40);
    assert.equal(record.transparency.maximumAllowedFrameMagentaCornerBasisPoints, 0);
    assert.equal(record.transparency.maximumFrameVisibleMagentaCornerBasisPoints, 0);
  });

  const enemy = inventory.atlasRecords[0];
  assert.deepEqual(enemy.grid, {
    columns: 4,
    rows: 2,
    frameWidthPx: 256,
    frameHeightPx: 256,
  });
  assert.deepEqual(enemy.rowRecords.map(function (record) {
    return {
      rowIndex: record.rowIndex,
      rowId: record.rowId,
      states: record.columnStates.map(function (state) { return state.stateId; }),
    };
  }), [
    { rowIndex: 0, rowId: "movement", states: ["idle-a", "idle-b", "run-a", "run-b"] },
    { rowIndex: 1, rowId: "combat", states: ["run-c", "hit", "stagger", "defeat"] },
  ]);
  assert.deepEqual(enemy.frameRecords[0], {
    id: "raider.movement.idle-a",
    rowIndex: 0,
    columnIndex: 0,
    xPx: 0,
    yPx: 0,
    widthPx: 256,
    heightPx: 256,
    semanticRowId: "movement",
    semanticStateId: "idle-a",
  });
  assert.deepEqual(enemy.frameRecords[7], {
    id: "raider.combat.defeat",
    rowIndex: 1,
    columnIndex: 3,
    xPx: 768,
    yPx: 256,
    widthPx: 256,
    heightPx: 256,
    semanticRowId: "combat",
    semanticStateId: "defeat",
  });

  const tower = inventory.atlasRecords[2];
  assert.deepEqual(tower.grid, {
    columns: 4,
    rows: 3,
    frameWidthPx: 256,
    frameHeightPx: 256,
  });
  assert.deepEqual(tower.rowRecords.map(function (record) { return record.rowId; }), [
    "level-1", "level-2", "level-3",
  ]);
  tower.rowRecords.forEach(function (record) {
    assert.deepEqual(record.columnStates.map(function (state) { return state.stateId; }), [
      "idle-a", "idle-b", "active-fire", "recovery-hit",
    ]);
  });
  assert.deepEqual(tower.frameRecords[11], {
    id: "chronos.level-3.recovery-hit",
    rowIndex: 2,
    columnIndex: 3,
    xPx: 768,
    yPx: 512,
    widthPx: 256,
    heightPx: 256,
    semanticRowId: "level-3",
    semanticStateId: "recovery-hit",
  });

  assert.deepEqual(inventory.totals, {
    atlasCount: 5,
    enemyAtlasCount: 2,
    towerAtlasCount: 3,
    frameCount: 52,
    transferBytes: 1274000,
    decodedBytes: 13631488,
    largestAtlasId: "asset.m01.tower.chronos.atlas",
    largestAtlasTransferBytes: 330862,
  });
  assert.deepEqual(inventory.budgets, {
    maxAggregateTransferBytes: 2097152,
    remainingAggregateTransferBytes: 823152,
    maxAggregateDecodedBytes: 16777216,
    remainingAggregateDecodedBytes: 3145728,
    maxIndividualTransferBytes: 1048576,
    maxIndividualDecodedBytes: 4194304,
    maxDimensionPx: 1024,
  });
  inventory.atlasRecords.forEach(function (record) {
    assert.equal(record.budgets.remainingTransferBytes,
      inventory.budgets.maxIndividualTransferBytes - record.transferBytes);
    assert.equal(record.budgets.remainingDecodedBytes,
      inventory.budgets.maxIndividualDecodedBytes - record.decodedBytes);
  });
});

test("M01 gameplay inventory bytes and CLI output are canonical and repeatable", () => {
  const first = Generator.buildM01GameplayArtInventory();
  const second = Generator.buildM01GameplayArtInventory();
  const firstBytes = Generator.renderM01GameplayArtInventory(first);

  assert.deepEqual(first, second);
  assert.deepEqual(firstBytes, Generator.renderM01GameplayArtInventory(second));
  assert.equal(firstBytes[firstBytes.length - 1], 0x0a);
  assert.equal(firstBytes.subarray(0, firstBytes.length - 1).includes(0x0a), false);

  const output = capture();
  assert.equal(Generator.main([], output.io), 0);
  assert.deepEqual(output.stdout(), firstBytes);
  assert.equal(output.stderr(), "");

  const rejected = capture();
  assert.equal(Generator.main(["--write"], rejected.io), 2);
  assert.equal(rejected.stdout().length, 0);
  assert.equal(rejected.stderr(), Generator.USAGE + "\n");
});

test("M01 gameplay inventory rejects missing, unsorted, and semantically drifted definitions", () => {
  const missing = clone(Generator.ACCEPTED_ATLASES);
  missing.pop();
  expectDiagnostic(
    () => Generator.buildM01GameplayArtInventory({ assetDefinitions: missing }),
    "M01_GAMEPLAY_ART_DEFINITION",
    "/atlasRecords"
  );

  const unsorted = clone(Generator.ACCEPTED_ATLASES);
  const first = unsorted[0];
  unsorted[0] = unsorted[1];
  unsorted[1] = first;
  expectDiagnostic(
    () => Generator.buildM01GameplayArtInventory({ assetDefinitions: unsorted }),
    "M01_GAMEPLAY_ART_ORDER",
    "/atlasRecords/1/id"
  );

  const semanticDrift = clone(Generator.ACCEPTED_ATLASES);
  semanticDrift[0].rows[0].stateIds[1] = "teleport";
  expectDiagnostic(
    () => Generator.buildM01GameplayArtInventory({ assetDefinitions: semanticDrift }),
    "M01_GAMEPLAY_ART_SEMANTICS",
    "/atlasRecords/0/rows/0"
  );
});

test("M01 gameplay inventory measures decoded dimensions and enforces exact filesystem case", (t) => {
  const wrongCaseRoot = temporaryAssetRoot(t);
  const wrongCaseDirectory = path.join(wrongCaseRoot, "art", "v2", "m01", "Enemies");
  fs.mkdirSync(wrongCaseDirectory, { recursive: true });
  fs.copyFileSync(
    path.join(AEGIS_ROOT, "art", "v2", "m01", "enemies", "raider-anim-v1.webp"),
    path.join(wrongCaseDirectory, "raider-anim-v1.webp")
  );
  expectDiagnostic(
    () => Generator.buildM01GameplayArtInventory({ assetRoot: wrongCaseRoot }),
    "ASSET_CASE",
    "/atlasRecords/0/relativeUrl"
  );

  const wrongDimensionsRoot = temporaryAssetRoot(t);
  const enemyDirectory = path.join(wrongDimensionsRoot, "art", "v2", "m01", "enemies");
  fs.mkdirSync(enemyDirectory, { recursive: true });
  fs.copyFileSync(
    path.join(AEGIS_ROOT, "art", "v2", "m01", "towers", "chronos-anim-v1.webp"),
    path.join(enemyDirectory, "raider-anim-v1.webp")
  );
  expectDiagnostic(
    () => Generator.buildM01GameplayArtInventory({ assetRoot: wrongDimensionsRoot }),
    "ASSET_ATLAS_DIMENSION",
    "/atlasRecords/0/relativeUrl"
  );
});

test("M01 gameplay inventory fails closed at per-file and aggregate transfer/decoded budgets", () => {
  expectDiagnostic(
    () => Generator.buildM01GameplayArtInventory({
      limits: limit({ maxIndividualTransferBytes: 167405 }),
    }),
    "M01_GAMEPLAY_ART_BUDGET",
    "/atlasRecords/0/transferBytes"
  );
  expectDiagnostic(
    () => Generator.buildM01GameplayArtInventory({
      limits: limit({ maxIndividualDecodedBytes: 2097151 }),
    }),
    "M01_GAMEPLAY_ART_BUDGET",
    "/atlasRecords/0/decodedBytes"
  );
  expectDiagnostic(
    () => Generator.buildM01GameplayArtInventory({
      limits: limit({ maxAggregateTransferBytes: 1273999 }),
    }),
    "M01_GAMEPLAY_ART_BUDGET",
    "/budgets/maxAggregateTransferBytes"
  );
  expectDiagnostic(
    () => Generator.buildM01GameplayArtInventory({
      limits: limit({ maxAggregateDecodedBytes: 13631487 }),
    }),
    "M01_GAMEPLAY_ART_BUDGET",
    "/budgets/maxAggregateDecodedBytes"
  );
});
