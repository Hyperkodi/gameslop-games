"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const LIB_ROOT = path.join(REPO_ROOT, "tools", "lib", "aegis");
const { AegisContentError } = require(path.join(LIB_ROOT, "diagnostics.js"));
const Loader = require(path.join(LIB_ROOT, "v4-source-loader.js"));

function ref(source, fill) {
  return Object.assign({ source: source, sha256: "sha256:" + fill.repeat(64) }, fill === "a" ? {} : {});
}

function validManifest() {
  const names = [
    "abiDescriptor", "behaviorContracts", "campaignRules", "defenses", "enemies", "bosses",
    "eventCatalog", "stringCatalog", "presentationCatalog", "protocols", "relics",
    "specializations", "reinforcements", "mechanisms", "progression",
  ];
  const manifest = {
    schemaVersion: 4,
    contentVersion: "unlock-dev-v1",
    sourceKind: "campaign",
    approvalState: "candidate-balance",
    abiDescriptor: null,
    behaviorContracts: null,
    annex: { id: "unlock-dev-v1", source: "annexes/unlock-dev-v1.json", sha256: "sha256:" + "f".repeat(64) },
    campaignRules: null,
    defenses: null,
    enemies: null,
    bosses: null,
    eventCatalog: null,
    stringCatalog: null,
    presentationCatalog: null,
    protocols: null,
    relics: null,
    specializations: null,
    reinforcements: null,
    mechanisms: null,
    progression: null,
    missions: [
      {
        id: "m01",
        definition: { source: "missions/m01.json", sha256: "sha256:" + "1".repeat(64) },
        map: { schemaVersion: 1, source: "maps/m01.json", sha256: "sha256:" + "2".repeat(64) },
        mapProofSupplement: { schemaVersion: 1, source: "map-proofs/m01.json", sha256: "sha256:" + "3".repeat(64) },
      },
      {
        id: "m05",
        definition: { source: "missions/m05.json", sha256: "sha256:" + "4".repeat(64) },
        map: { schemaVersion: 3, source: "maps/m05.json", sha256: "sha256:" + "5".repeat(64) },
      },
    ],
  };
  names.forEach(function (name, index) {
    manifest[name] = ref("v4/" + name + ".json", (index % 9 + 1).toString());
  });
  return manifest;
}

function expectDiagnostic(fn, code, diagnosticPath) {
  assert.throws(fn, function (error) {
    assert.ok(error instanceof AegisContentError, String(error));
    assert.equal(error.diagnostics[0].code, code);
    if (diagnosticPath !== undefined) assert.equal(error.diagnostics[0].path, diagnosticPath);
    return true;
  });
}

test("v4 manifest accepts the parallel unlock domains and map schemas 1 through 3", () => {
  const manifest = validManifest();
  const normalized = Loader.validateV4SourceManifest(manifest);
  assert.strictEqual(normalized, manifest);
  assert.equal(normalized.schemaVersion, 4);
  assert.equal(normalized.missions[1].map.schemaVersion, 3);
  assert.equal(Loader.V4_JSON_OPTIONS.maxDepth, 32);
  assert.equal(Loader.MAX_SOURCE_BYTES, 1048576);
});

test("v4 manifest is exact and cannot omit or smuggle unlock domain references", () => {
  let manifest = validManifest();
  delete manifest.protocols;
  expectDiagnostic(function () { Loader.validateV4SourceManifest(manifest); }, "SCHEMA_MISSING_KEY", "/protocols");

  manifest = validManifest();
  manifest.units = manifest.reinforcements;
  expectDiagnostic(function () { Loader.validateV4SourceManifest(manifest); }, "SCHEMA_UNKNOWN_KEY", "/units");

  manifest = validManifest();
  manifest.protocols.extra = true;
  expectDiagnostic(function () { Loader.validateV4SourceManifest(manifest); }, "SCHEMA_UNKNOWN_KEY", "/protocols/extra");
});

test("v4 manifest freezes version, source kind, approval, IDs, order, and hashes", () => {
  let manifest = validManifest();
  manifest.schemaVersion = 3;
  expectDiagnostic(function () { Loader.validateV4SourceManifest(manifest); }, "SCHEMA_LITERAL", "/schemaVersion");

  manifest = validManifest();
  manifest.contentVersion = "Bad Version";
  expectDiagnostic(function () { Loader.validateV4SourceManifest(manifest); }, "SCHEMA_STRING", "/contentVersion");

  manifest = validManifest();
  manifest.approvalState = "released";
  expectDiagnostic(function () { Loader.validateV4SourceManifest(manifest); }, "SCHEMA_LITERAL", "/approvalState");

  manifest = validManifest();
  manifest.protocols.sha256 = "sha256:ABC";
  expectDiagnostic(function () { Loader.validateV4SourceManifest(manifest); }, "SOURCE_HASH_FORMAT", "/protocols/sha256");

  manifest = validManifest();
  manifest.missions.reverse();
  expectDiagnostic(function () { Loader.validateV4SourceManifest(manifest); }, "SCHEMA_UNSTABLE_ORDER", "/missions/1/id");
});

test("map-v1 requires one proof supplement while map-v2/v3 forbid it", () => {
  let manifest = validManifest();
  delete manifest.missions[0].mapProofSupplement;
  expectDiagnostic(function () { Loader.validateV4SourceManifest(manifest); }, "SCHEMA_MISSING_KEY", "/missions/0/mapProofSupplement");

  manifest = validManifest();
  manifest.missions[1].mapProofSupplement = {
    schemaVersion: 1,
    source: "map-proofs/m05.json",
    sha256: "sha256:" + "6".repeat(64),
  };
  expectDiagnostic(function () { Loader.validateV4SourceManifest(manifest); }, "SCHEMA_UNKNOWN_KEY", "/missions/1/mapProofSupplement");

  manifest = validManifest();
  manifest.missions[1].map.schemaVersion = 4;
  expectDiagnostic(function () { Loader.validateV4SourceManifest(manifest); }, "SCHEMA_LITERAL", "/missions/1/map/schemaVersion");
});

test("all v4 source paths are canonical JSON and physically unique at manifest level", () => {
  let manifest = validManifest();
  manifest.relics.source = manifest.protocols.source;
  expectDiagnostic(function () { Loader.validateV4SourceManifest(manifest); }, "SCHEMA_DUPLICATE_SOURCE", "/relics/source");

  manifest = validManifest();
  manifest.mechanisms.source = "../escape.json";
  expectDiagnostic(function () { Loader.validateV4SourceManifest(manifest); }, "SOURCE_REFERENCE", "/mechanisms/source");

  manifest = validManifest();
  manifest.progression.source = "v4/progression.JSON";
  expectDiagnostic(function () { Loader.validateV4SourceManifest(manifest); }, "SOURCE_REFERENCE", "/progression/source");
});

test("strict v4 JSON parsing keeps byte, depth, field, duplicate-key, and negative-zero limits", () => {
  const parsed = Loader.parseV4JsonBytes(Buffer.from('{"schemaVersion":4}', "utf8"), "fixture");
  assert.equal(Object.getPrototypeOf(parsed), null);
  assert.equal(parsed.schemaVersion, 4);
  expectDiagnostic(
    function () { Loader.parseV4JsonBytes(Buffer.from('{"a":1,"a":2}', "utf8"), "fixture"); },
    "JSON_DUPLICATE_KEY"
  );
  expectDiagnostic(
    function () { Loader.parseV4JsonBytes(Buffer.from('{"a":-0}', "utf8"), "fixture"); },
    "JSON_NUMBER_NEGATIVE_ZERO"
  );
});
