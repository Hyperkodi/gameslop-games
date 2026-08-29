"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const LIB_ROOT = path.join(REPO_ROOT, "tools", "lib", "aegis");
const RECORD_ROOT = path.join(__dirname, "fixtures", "compiler", "v3-records", "valid");
const SYNTHETIC_ROOT = path.join(__dirname, "fixtures", "compiler", "valid-v3-synthetic");
const { canonicalBytes } = require(path.join(LIB_ROOT, "canonical.js"));
const { AegisContentError } = require(path.join(LIB_ROOT, "diagnostics.js"));
const Presentation = require(path.join(LIB_ROOT, "v3-presentation.js"));

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function strictParserShape(value) {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(strictParserShape);
  const output = Object.create(null);
  Object.keys(value).forEach(function (key) { output[key] = strictParserShape(value[key]); });
  return output;
}

function sourceInput(presentationCatalog) {
  return {
    approvalState: "candidate-balance",
    contentVersion: "test-synthetic-v1",
    missions: [
      readJson(path.join(SYNTHETIC_ROOT, "m01-mission.json")),
      readJson(path.join(RECORD_ROOT, "missions", "m04.json")),
      readJson(path.join(RECORD_ROOT, "missions", "m05.json")),
    ],
    eventCatalog: readJson(path.join(RECORD_ROOT, "events.json")),
    stringCatalog: readJson(path.join(RECORD_ROOT, "strings.json")),
    presentationCatalog: presentationCatalog,
  };
}

function validV2Catalog() {
  return {
    schemaVersion: 2,
    id: "presentation.slice.v2",
    cameraRecords: [
      { id: "camera.overscan-16x10-v1", x: -18000, y: -12000, width: 198400, height: 124000 },
    ],
    provenanceRecords: [
      {
        id: "provenance.slice.environment",
        kind: "generated",
        sourceRef: "prompt.slice.environment.v1",
        parentIds: [],
        reviewState: "runtime-ready",
      },
    ],
    assetRecords: [
      {
        id: "asset.slice.environment",
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
        provenanceId: "provenance.slice.environment",
      },
    ],
    placementRecords: [
      {
        id: "placement.slice.environment",
        assetId: "asset.slice.environment",
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
        id: "pack.slice",
        kind: "asset-pack",
        missionIds: ["m01", "m04", "m05"],
        assetIds: ["asset.slice.environment"],
        dependencyPackIds: [],
        preloadAssetIds: ["asset.slice.environment"],
        criticalAssetIds: ["asset.slice.environment"],
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

function compiledBindings() {
  return {
    missionIds: ["m01", "m04", "m05"],
    cueIds: ["cue.default"],
  };
}

function expectDiagnostic(fn, code, diagnosticPath) {
  assert.throws(fn, function (error) {
    assert.ok(error instanceof AegisContentError, String(error));
    assert.equal(error.diagnostics[0].code, code);
    assert.equal(error.diagnostics[0].path, diagnosticPath);
    return true;
  });
}

test("schema v1 dispatch preserves the historical canonical companion bytes", () => {
  const input = sourceInput(readJson(path.join(RECORD_ROOT, "presentation", "slice-v1.json")));
  const companion = Presentation.buildPresentationCompanion(input);
  const hash = "sha256:" + crypto.createHash("sha256").update(canonicalBytes(companion)).digest("hex");
  assert.equal(hash, "sha256:50f34d95ce92eeada3b54a091f14acac1520f15f4ee5e79b0665bc517d8219dc");
  assert.equal(companion.schemaVersion, 1);
  assert.equal(Object.prototype.hasOwnProperty.call(companion, "assetRecords"), false);
  assert.deepEqual(Presentation.validatePresentationCompanion(companion), companion);
});

test("schema v2 dispatch emits only the strict asset companion and preserves immutability", () => {
  const companion = Presentation.buildPresentationCompanion(sourceInput(validV2Catalog()));
  assert.equal(companion.schemaVersion, 2);
  assert.equal(companion.id, "presentation.slice.v2");
  assert.equal(companion.assetRecords[0].decodedBytes, 2048 * 1280 * 4);
  assert.equal(companion.packRecords[0].kind, "asset-pack");
  assert.equal(Object.isFrozen(companion), true);
  assert.equal(Object.isFrozen(companion.assetRecords[0]), true);
  assert.deepEqual(Presentation.validatePresentationCompanion(companion, "/presentation", compiledBindings()), companion);

  const parsedCompanion = Presentation.buildPresentationCompanion(sourceInput(strictParserShape(validV2Catalog())));
  assert.equal(parsedCompanion.schemaVersion, 2, "strict-parser null-prototype records reach the v2 validator");

  const unknownKey = strictParserShape(validV2Catalog());
  unknownKey.__proto__ = 7;
  expectDiagnostic(
    function () { Presentation.buildPresentationCompanion(sourceInput(unknownKey)); },
    "PRESENTATION_V2_UNKNOWN_KEY",
    "/__proto__"
  );
});

test("dispatch rejects missing and unknown versions at one stable path without fallback", () => {
  let catalog = validV2Catalog();
  delete catalog.schemaVersion;
  expectDiagnostic(
    function () { Presentation.buildPresentationCompanion(sourceInput(catalog)); },
    "PRESENTATION_SCHEMA_VERSION",
    "/presentationCatalog/schemaVersion"
  );

  catalog = validV2Catalog();
  catalog.schemaVersion = 3;
  expectDiagnostic(
    function () { Presentation.buildPresentationCompanion(sourceInput(catalog)); },
    "PRESENTATION_SCHEMA_VERSION",
    "/presentationCatalog/schemaVersion"
  );

  catalog = readJson(path.join(RECORD_ROOT, "presentation", "slice-v1.json"));
  catalog.cameraRecords = [];
  expectDiagnostic(
    function () { Presentation.buildPresentationCompanion(sourceInput(catalog)); },
    "SCHEMA_UNKNOWN_KEY",
    "/cameraRecords"
  );

  catalog = clone(readJson(path.join(RECORD_ROOT, "presentation", "slice-v1.json")));
  catalog.schemaVersion = 2;
  expectDiagnostic(
    function () { Presentation.buildPresentationCompanion(sourceInput(catalog)); },
    "PRESENTATION_V2_REQUIRED",
    "/cameraRecords"
  );
});

test("schema v2 dispatch enforces mission ownership and exact cue coverage", () => {
  let catalog = validV2Catalog();
  catalog.packRecords[0].missionIds = ["m01", "m04"];
  expectDiagnostic(
    function () { Presentation.buildPresentationCompanion(sourceInput(catalog)); },
    "PRESENTATION_MISSION_ASSIGNMENT",
    "/packRecords"
  );

  catalog = validV2Catalog();
  catalog.cueMappings = [];
  expectDiagnostic(
    function () { Presentation.buildPresentationCompanion(sourceInput(catalog)); },
    "PRESENTATION_CUE_ASSIGNMENT",
    "/cueMappings"
  );
});

test("compiled companion dispatch also rejects missing, unknown, and relabeled versions", () => {
  expectDiagnostic(
    function () { Presentation.validatePresentationCompanion({}); },
    "PRESENTATION_SCHEMA_UNIMPLEMENTED",
    "/presentation/schemaVersion"
  );
  expectDiagnostic(
    function () { Presentation.validatePresentationCompanion({ schemaVersion: 3 }); },
    "PRESENTATION_SCHEMA_UNIMPLEMENTED",
    "/presentation/schemaVersion"
  );

  const relabeled = clone(Presentation.buildPresentationCompanion(
    sourceInput(readJson(path.join(RECORD_ROOT, "presentation", "slice-v1.json")))
  ));
  relabeled.schemaVersion = 2;
  expectDiagnostic(
    function () { Presentation.validatePresentationCompanion(relabeled); },
    "PRESENTATION_COMPANION_REQUIRED",
    "/presentation/id"
  );

  const relabeledV2 = clone(Presentation.buildPresentationCompanion(sourceInput(validV2Catalog())));
  relabeledV2.schemaVersion = 1;
  expectDiagnostic(
    function () { Presentation.validatePresentationCompanion(relabeledV2); },
    "PRESENTATION_COMPANION_UNKNOWN_KEY",
    "/presentation/id"
  );

  const assetBearingV1 = clone(Presentation.buildPresentationCompanion(
    sourceInput(readJson(path.join(RECORD_ROOT, "presentation", "slice-v1.json")))
  ));
  assetBearingV1.assetRecords = [];
  expectDiagnostic(
    function () { Presentation.validatePresentationCompanion(assetBearingV1); },
    "PRESENTATION_COMPANION_UNKNOWN_KEY",
    "/presentation/assetRecords"
  );

  const accessorV1 = clone(Presentation.buildPresentationCompanion(
    sourceInput(readJson(path.join(RECORD_ROOT, "presentation", "slice-v1.json")))
  ));
  Object.defineProperty(accessorV1, "contentVersion", {
    enumerable: true,
    get: function () { return "test-synthetic-v1"; },
  });
  expectDiagnostic(
    function () { Presentation.validatePresentationCompanion(accessorV1); },
    "PRESENTATION_COMPANION_DATA",
    "/presentation/contentVersion"
  );
});
