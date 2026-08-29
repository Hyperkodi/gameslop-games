"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const { AegisContentError } = require(path.join(REPO_ROOT, "tools", "lib", "aegis", "diagnostics.js"));
const PresentationV2 = require(path.join(REPO_ROOT, "tools", "lib", "aegis", "v3-presentation-v2.js"));

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function baseAsset(overrides) {
  return Object.assign({
    id: "asset.m01.environment",
    kind: "bitmap",
    relativeUrl: "art/v2/m01/environment.webp",
    sha256: "sha256:" + "1".repeat(64),
    widthPx: 2048,
    heightPx: 1280,
    alphaMode: "opaque",
    transferBytes: 900000,
    decodedBytes: 2048 * 1280 * 4,
    usage: "mission-environment",
    fallbackStyleId: "ancient-greece-ai-procedural",
    cropRect: null,
    provenanceId: "provenance.m01.environment",
  }, overrides || {});
}

function validCatalog() {
  return {
    schemaVersion: 2,
    id: "presentation.m01.v2",
    cameraRecords: [
      { id: "camera.overscan-16x10-v1", x: -18000, y: -12000, width: 198400, height: 124000 },
    ],
    provenanceRecords: [
      {
        id: "provenance.m01.environment",
        kind: "generated",
        sourceRef: "prompt.m01.environment.v1",
        parentIds: [],
        reviewState: "runtime-ready",
      },
    ],
    assetRecords: [baseAsset()],
    placementRecords: [
      {
        id: "placement.m01.environment",
        assetId: "asset.m01.environment",
        cameraId: "camera.overscan-16x10-v1",
        layer: "environment",
        worldRect: { x: -18000, y: -12000, width: 198400, height: 124000 },
        pivot: { x: 0, y: 0 },
        anchorId: null,
        foregroundAssetId: null,
      },
    ],
    packRecords: [
      {
        id: "pack.m01",
        kind: "asset-pack",
        missionIds: ["m01"],
        assetIds: ["asset.m01.environment"],
        dependencyPackIds: [],
        preloadAssetIds: ["asset.m01.environment"],
        criticalAssetIds: ["asset.m01.environment"],
        fallbackStyleId: "ancient-greece-ai-procedural",
        maxTransferBytes: 4000000,
        maxDecodedBytes: 64 * 1024 * 1024,
      },
    ],
    cueMappings: [
      {
        cueId: "cue.default",
        kind: "asset-or-fallback",
        assetId: null,
        frameId: null,
        fallbackStyleId: "ancient-greece-ai-procedural",
      },
    ],
  };
}

function addForegroundAsset(source) {
  source.provenanceRecords.push({
    id: "provenance.shared.foreground",
    kind: "generated",
    sourceRef: "prompt.shared.foreground.v1",
    parentIds: [],
    reviewState: "runtime-ready",
  });
  source.assetRecords.push(baseAsset({
    id: "asset.shared.foreground",
    relativeUrl: "art/v2/shared/foreground.webp",
    sha256: "sha256:" + "2".repeat(64),
    widthPx: 256,
    heightPx: 256,
    alphaMode: "alpha",
    transferBytes: 125000,
    decodedBytes: 256 * 256 * 4,
    usage: "landmark",
    provenanceId: "provenance.shared.foreground",
  }));
  source.placementRecords[0].foregroundAssetId = "asset.shared.foreground";
}

function addPack(source, overrides) {
  source.packRecords.push(Object.assign({
    id: "pack.shared",
    kind: "asset-pack",
    missionIds: [],
    assetIds: ["asset.shared.foreground"],
    dependencyPackIds: [],
    preloadAssetIds: [],
    criticalAssetIds: [],
    fallbackStyleId: "ancient-greece-ai-procedural",
    maxTransferBytes: 1000000,
    maxDecodedBytes: 1024 * 1024,
  }, overrides || {}));
  source.packRecords.sort(function (left, right) { return left.id.localeCompare(right.id); });
}

function packById(source, id) {
  return source.packRecords.find(function (record) { return record.id === id; });
}

function expectDiagnostic(fn, code, diagnosticPath) {
  assert.throws(fn, function (error) {
    assert.ok(error instanceof AegisContentError, String(error));
    assert.equal(error.diagnostics[0].code, code);
    if (diagnosticPath !== undefined) assert.equal(error.diagnostics[0].path, diagnosticPath);
    return true;
  });
}

test("presentation v2 accepts and deeply freezes one exact fixed-camera M01 pack", () => {
  const input = validCatalog();
  const output = PresentationV2.validatePresentationCatalogV2(input, { requireRuntimeReady: true });
  assert.notStrictEqual(output, input);
  assert.equal(Object.isFrozen(output), true);
  assert.equal(Object.isFrozen(output.assetRecords[0]), true);
  assert.equal(output.cameraRecords[0].width * 5, output.cameraRecords[0].height * 8);
  assert.equal(output.assetRecords[0].decodedBytes, output.assetRecords[0].widthPx * output.assetRecords[0].heightPx * 4);
});

test("presentation v2 rejects unknown keys, unstable order, shared data, and v1 fallback", () => {
  let source = validCatalog();
  source.extra = true;
  expectDiagnostic(() => PresentationV2.validatePresentationCatalogV2(source), "PRESENTATION_V2_UNKNOWN_KEY", "/extra");

  source = validCatalog();
  source.schemaVersion = 1;
  expectDiagnostic(() => PresentationV2.validatePresentationCatalogV2(source), "PRESENTATION_V2_VERSION", "/schemaVersion");

  source = validCatalog();
  source.cameraRecords.push({ id: "camera.aaa", x: 0, y: 0, width: 160000, height: 100000 });
  expectDiagnostic(() => PresentationV2.validatePresentationCatalogV2(source), "PRESENTATION_V2_ORDER", "/cameraRecords/1/id");

  source = validCatalog();
  source.placementRecords[0].worldRect = source.cameraRecords[0];
  expectDiagnostic(() => PresentationV2.validatePresentationCatalogV2(source), "PRESENTATION_V2_SHARED", "/placementRecords/0/worldRect");
});

test("presentation v2 enforces exact camera and environment registration", () => {
  let source = validCatalog();
  source.cameraRecords[0].width = 198000;
  expectDiagnostic(() => PresentationV2.validatePresentationCatalogV2(source), "PRESENTATION_V2_CAMERA_ASPECT", "/cameraRecords/0");

  source = validCatalog();
  source.cameraRecords[0] = {
    id: "camera.overscan-16x10-v1",
    x: -16000,
    y: -12000,
    width: 195200,
    height: 122000,
  };
  expectDiagnostic(
    () => PresentationV2.validatePresentationCatalogV2(source),
    "PRESENTATION_V2_CAMERA_IDENTITY",
    "/cameraRecords/0"
  );

  source = validCatalog();
  source.placementRecords[0].worldRect.x = -17000;
  expectDiagnostic(() => PresentationV2.validatePresentationCatalogV2(source), "PRESENTATION_V2_ENVIRONMENT_CAMERA", "/placementRecords/0");

  source = validCatalog();
  source.assetRecords[0].heightPx = 1200;
  source.assetRecords[0].decodedBytes = 2048 * 1200 * 4;
  expectDiagnostic(() => PresentationV2.validatePresentationCatalogV2(source), "PRESENTATION_V2_ASSET_ASPECT", "/placementRecords/0/assetId");
});

test("presentation v2 rejects unsafe URLs, byte lies, bad alpha, ownership, and budgets", () => {
  [
    "../outside.png",
    "/absolute.png",
    "art//environment.webp",
    "art/./environment.webp",
    "art/../environment.webp",
    "art\\environment.webp",
    "art/environment.webp?variant=1",
    "art/environment.webp#fragment",
    "Art/environment.webp",
    "art/Environment.webp",
    "art/environment.WEBP",
    "art/trailing./environment.webp",
  ].forEach(function (relativeUrl) {
    const source = validCatalog();
    source.assetRecords[0].relativeUrl = relativeUrl;
    expectDiagnostic(() => PresentationV2.validatePresentationCatalogV2(source), "PRESENTATION_V2_URL", "/assetRecords/0/relativeUrl");
  });

  let source = validCatalog();
  source.assetRecords[0].decodedBytes -= 4;
  expectDiagnostic(() => PresentationV2.validatePresentationCatalogV2(source), "PRESENTATION_V2_DECODED_BYTES", "/assetRecords/0/decodedBytes");

  source = validCatalog();
  source.assetRecords[0].alphaMode = "alpha";
  expectDiagnostic(() => PresentationV2.validatePresentationCatalogV2(source), "PRESENTATION_V2_OPAQUE_REQUIRED", "/assetRecords/0/alphaMode");

  source = validCatalog();
  source.packRecords[0].assetIds = [];
  source.packRecords[0].preloadAssetIds = [];
  source.packRecords[0].criticalAssetIds = [];
  expectDiagnostic(() => PresentationV2.validatePresentationCatalogV2(source), "PRESENTATION_V2_ASSET_OWNER", "/assetRecords/0/id");

  source = validCatalog();
  source.packRecords[0].maxTransferBytes = 899999;
  expectDiagnostic(() => PresentationV2.validatePresentationCatalogV2(source), "PRESENTATION_V2_PACK_TRANSFER", "/packRecords/0");
});

test("presentation v2 assigns each canonical relative URL to exactly one asset", () => {
  const source = validCatalog();
  source.provenanceRecords.push({
    id: "provenance.shared.alias",
    kind: "generated",
    sourceRef: "prompt.shared.alias.v1",
    parentIds: [],
    reviewState: "runtime-ready",
  });
  source.assetRecords.push(baseAsset({
    id: "asset.shared.alias",
    provenanceId: "provenance.shared.alias",
  }));
  expectDiagnostic(
    () => PresentationV2.validatePresentationCatalogV2(source),
    "PRESENTATION_V2_ASSET_URL_OWNER",
    "/assetRecords/1/relativeUrl"
  );
});

test("presentation v2 limits foreground assets to the base pack dependency closure", () => {
  let source = validCatalog();
  addForegroundAsset(source);
  addPack(source);
  expectDiagnostic(
    () => PresentationV2.validatePresentationCatalogV2(source),
    "PRESENTATION_V2_PACK_ACCESS",
    "/placementRecords/0/foregroundAssetId"
  );

  source = validCatalog();
  addForegroundAsset(source);
  packById(source, "pack.m01").assetIds.push("asset.shared.foreground");
  assert.equal(
    PresentationV2.validatePresentationCatalogV2(source).placementRecords[0].foregroundAssetId,
    "asset.shared.foreground",
    "the base asset pack may own its own foreground"
  );

  source = validCatalog();
  addForegroundAsset(source);
  addPack(source);
  packById(source, "pack.m01").dependencyPackIds = ["pack.shared"];
  assert.equal(
    PresentationV2.validatePresentationCatalogV2(source).placementRecords[0].foregroundAssetId,
    "asset.shared.foreground"
  );

  source = validCatalog();
  addForegroundAsset(source);
  addPack(source);
  addPack(source, {
    id: "pack.bridge",
    assetIds: [],
    dependencyPackIds: ["pack.shared"],
    maxTransferBytes: 1,
    maxDecodedBytes: 4,
  });
  packById(source, "pack.m01").dependencyPackIds = ["pack.bridge"];
  assert.equal(
    PresentationV2.validatePresentationCatalogV2(source).placementRecords[0].foregroundAssetId,
    "asset.shared.foreground",
    "transitive pack dependencies grant foreground access"
  );
});

test("presentation v2 validates atlas frames, gutters, pivots, and cue references", () => {
  const source = validCatalog();
  source.assetRecords[0] = baseAsset({
    id: "asset.scout.atlas",
    kind: "atlas",
    relativeUrl: "art/v2/units/scout.png",
    widthPx: 512,
    heightPx: 256,
    alphaMode: "alpha",
    transferBytes: 200000,
    decodedBytes: 512 * 256 * 4,
    usage: "enemy-atlas",
    frameRecords: [
      {
        id: "scout.idle-a",
        xPx: 4,
        yPx: 4,
        widthPx: 120,
        heightPx: 120,
        pivotXPx: 60,
        pivotYPx: 100,
        groundXPx: 60,
        groundYPx: 112,
        projectileXPx: null,
        projectileYPx: null,
        gutterPx: 4,
        animationTags: ["idle"],
      },
      {
        id: "scout.step-left",
        xPx: 136,
        yPx: 4,
        widthPx: 120,
        heightPx: 120,
        pivotXPx: 60,
        pivotYPx: 100,
        groundXPx: 60,
        groundYPx: 112,
        projectileXPx: null,
        projectileYPx: null,
        gutterPx: 4,
        animationTags: ["locomotion"],
      },
    ],
  });
  source.packRecords[0].assetIds = ["asset.scout.atlas"];
  source.packRecords[0].preloadAssetIds = ["asset.scout.atlas"];
  source.packRecords[0].criticalAssetIds = ["asset.scout.atlas"];
  source.placementRecords = [];
  source.cueMappings[0].assetId = "asset.scout.atlas";
  source.cueMappings[0].frameId = "scout.idle-a";
  assert.equal(PresentationV2.validatePresentationCatalogV2(source).assetRecords[0].frameRecords.length, 2);

  let invalid = clone(source);
  invalid.assetRecords[0].frameRecords[1].xPx = 120;
  expectDiagnostic(() => PresentationV2.validatePresentationCatalogV2(invalid), "PRESENTATION_V2_FRAME_OVERLAP", "/assetRecords/0/frameRecords/1");

  invalid = clone(source);
  invalid.cueMappings[0].frameId = "scout.missing";
  expectDiagnostic(() => PresentationV2.validatePresentationCatalogV2(invalid), "PRESENTATION_V2_FRAME_REF", "/cueMappings/0/frameId");
});

test("presentation v2 requires resolved acyclic dependencies and runtime-ready provenance when selected", () => {
  let source = validCatalog();
  source.packRecords[0].dependencyPackIds = ["pack.missing"];
  expectDiagnostic(() => PresentationV2.validatePresentationCatalogV2(source), "PRESENTATION_V2_PACK_REF", "/packRecords/0/dependencyPackIds/0");

  source = validCatalog();
  source.packRecords.unshift({
    id: "pack.global",
    kind: "asset-pack",
    missionIds: [],
    assetIds: [],
    dependencyPackIds: ["pack.m01"],
    preloadAssetIds: [],
    criticalAssetIds: [],
    fallbackStyleId: "ancient-greece-ai-procedural",
    maxTransferBytes: 1,
    maxDecodedBytes: 4,
  });
  source.packRecords[1].dependencyPackIds = ["pack.global"];
  expectDiagnostic(() => PresentationV2.validatePresentationCatalogV2(source), "PRESENTATION_V2_PACK_CYCLE");

  source = validCatalog();
  source.provenanceRecords[0].reviewState = "concept";
  expectDiagnostic(
    () => PresentationV2.validatePresentationCatalogV2(source, { requireRuntimeReady: true }),
    "PRESENTATION_V2_REVIEW_STATE",
    "/assetRecords/0/provenanceId"
  );
});
