"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const LIB_ROOT = path.join(REPO_ROOT, "tools", "lib", "aegis");
const RECORD_ROOT = path.join(__dirname, "fixtures", "compiler", "v3-records", "valid");
const SYNTHETIC_ROOT = path.join(__dirname, "fixtures", "compiler", "valid-v3-synthetic");
const ABI_PATH = path.join(__dirname, "..", "content", "abi", "abi-v1.json");
const BEHAVIOR_PATH = path.join(__dirname, "..", "content", "behavior-contracts.json");
const GAME_ROOT = path.join(REPO_ROOT, "games", "aegis");

const { canonicalBytes, canonicalEncode } = require(path.join(LIB_ROOT, "canonical.js"));
const { AegisContentError } = require(path.join(LIB_ROOT, "diagnostics.js"));
const Annex = require(path.join(LIB_ROOT, "v3-annex.js"));
const AssetInspector = require(path.join(LIB_ROOT, "asset-inspector.js"));
const Compiler = require(path.join(LIB_ROOT, "v3-compiler.js"));
const SharedCompiler = require(path.join(LIB_ROOT, "compiler.js"));
const V3Artifacts = require(path.join(LIB_ROOT, "v3-artifacts.js"));

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function hashBytes(bytes) {
  return "sha256:" + crypto.createHash("sha256").update(bytes).digest("hex");
}

function hashFile(file) {
  return hashBytes(fs.readFileSync(file));
}

function repoSource(file) {
  return path.relative(REPO_ROOT, file).replace(/\\/g, "/");
}

function provenance(kind, id, file) {
  return { kind: kind, id: id, source: repoSource(file), sha256: hashFile(file) };
}

function syntheticPreflight() {
  const abiBytes = fs.readFileSync(ABI_PATH);
  const annexPath = path.join(SYNTHETIC_ROOT, "annex.json");
  const annex = readJson(annexPath);
  const missionFiles = [
    path.join(SYNTHETIC_ROOT, "m01-mission.json"),
    path.join(RECORD_ROOT, "missions", "m04.json"),
    path.join(RECORD_ROOT, "missions", "m05.json"),
  ];
  const mapFiles = ["m01-map.json", "m04-map.json", "m05-map.json"].map(function (file) {
    return path.join(SYNTHETIC_ROOT, file);
  });
  const missions = missionFiles.map(function (file, index) {
    const definition = readJson(file);
    return { id: definition.id, definition: definition, map: readJson(mapFiles[index]) };
  });
  const manifest = {
    schemaVersion: 3,
    contentVersion: "test-synthetic-v1",
    sourceKind: "campaign",
    approvalState: "candidate-balance",
    abiDescriptor: { source: repoSource(ABI_PATH), sha256: hashBytes(abiBytes) },
    annex: { id: annex.id, source: repoSource(annexPath), sha256: hashFile(annexPath) },
    missions: missions.map(function (mission) {
      return { id: mission.id, map: { schemaVersion: 2 } };
    }),
  };
  const sourceProvenance = [
    provenance("abiDescriptor", "abiDescriptor", ABI_PATH),
    provenance("behaviorContracts", "behaviorContracts", BEHAVIOR_PATH),
    provenance("annex", annex.id, annexPath),
    provenance("campaignRules", "campaignRules", path.join(RECORD_ROOT, "campaign-rules.json")),
    provenance("defenses", "defenses", path.join(RECORD_ROOT, "defenses.json")),
    provenance("enemies", "enemies", path.join(RECORD_ROOT, "enemies.json")),
    provenance("bosses", "bosses", path.join(RECORD_ROOT, "bosses.json")),
    provenance("eventCatalog", "eventCatalog", path.join(RECORD_ROOT, "events.json")),
    provenance("stringCatalog", "stringCatalog", path.join(RECORD_ROOT, "strings.json")),
    provenance("presentationCatalog", "presentationCatalog", path.join(RECORD_ROOT, "presentation", "slice-v1.json")),
    provenance("missionMap", "m01", mapFiles[0]),
    provenance("missionMap", "m04", mapFiles[1]),
    provenance("missionMap", "m05", mapFiles[2]),
    provenance("missionDefinition", "m01", missionFiles[0]),
    provenance("missionDefinition", "m04", missionFiles[1]),
    provenance("missionDefinition", "m05", missionFiles[2]),
  ];
  return {
    preflightOnly: true,
    manifest: manifest,
    manifestHash: hashBytes(Buffer.concat([canonicalBytes(manifest), Buffer.from("\n")])),
    annex: annex,
    normalizedSource: {
      abiDescriptor: JSON.parse(abiBytes.toString("utf8")),
      behaviorContracts: readJson(BEHAVIOR_PATH),
      campaignRules: readJson(path.join(RECORD_ROOT, "campaign-rules.json")),
      defenses: readJson(path.join(RECORD_ROOT, "defenses.json")),
      enemies: readJson(path.join(RECORD_ROOT, "enemies.json")),
      bosses: readJson(path.join(RECORD_ROOT, "bosses.json")),
      eventCatalog: readJson(path.join(RECORD_ROOT, "events.json")),
      stringCatalog: readJson(path.join(RECORD_ROOT, "strings.json")),
      presentationCatalog: readJson(path.join(RECORD_ROOT, "presentation", "slice-v1.json")),
      missions: missions,
    },
    provenance: sourceProvenance,
    repositoryProvenance: [],
    verifiedRawSources: { abiDescriptorBase64: abiBytes.toString("base64") },
  };
}

function syntheticV2Presentation(assetHashCharacter) {
  return {
    schemaVersion: 2,
    id: "presentation.slice.v2",
    cameraRecords: [
      { id: "camera.overscan-16x10-v1", x: -18000, y: -12000, width: 198400, height: 124000 },
    ],
    provenanceRecords: [{
      id: "provenance.slice.environment",
      kind: "generated",
      sourceRef: "prompt.slice.environment.v1",
      parentIds: [],
      reviewState: "runtime-ready",
    }],
    assetRecords: [{
      id: "asset.slice.environment",
      kind: "bitmap",
      relativeUrl: "art/v2/m01/environment.webp",
      sha256: "sha256:" + assetHashCharacter.repeat(64),
      widthPx: 2048,
      heightPx: 1280,
      alphaMode: "opaque",
      transferBytes: 900000,
      decodedBytes: 2048 * 1280 * 4,
      usage: "mission-environment",
      fallbackStyleId: "ancient-greece-ai-procedural",
      cropRect: null,
      provenanceId: "provenance.slice.environment",
    }],
    placementRecords: [{
      id: "placement.slice.environment",
      assetId: "asset.slice.environment",
      cameraId: "camera.overscan-16x10-v1",
      layer: "environment",
      worldRect: { x: -18000, y: -12000, width: 198400, height: 124000 },
      pivot: { x: 0, y: 0 },
      anchorId: null,
      foregroundAssetId: null,
    }],
    packRecords: [{
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
    }],
    cueMappings: [{
      cueId: "cue.default",
      kind: "asset-or-fallback",
      assetId: null,
      frameId: null,
      fallbackStyleId: "ancient-greece-ai-procedural",
    }],
  };
}

function measuredV2Presentation() {
  const presentation = syntheticV2Presentation("0");
  presentation.assetRecords[0] = {
    id: "asset.slice.environment",
    kind: "bitmap",
    relativeUrl: "art/v2/ui/panel-4x3-v1.webp",
    sha256: "sha256:c836b8c4361c6b611dcf1ff73ef3de3b36fca2c3c345d6c36692777bf045e540",
    widthPx: 1024,
    heightPx: 768,
    alphaMode: "opaque",
    transferBytes: 42810,
    decodedBytes: 3145728,
    usage: "road-texture",
    fallbackStyleId: "ancient-greece-ai-procedural",
    cropRect: null,
    provenanceId: "provenance.slice.environment",
  };
  presentation.placementRecords = [];
  return presentation;
}

function fileBackedV2Presentation() {
  const presentation = measuredV2Presentation();
  presentation.packRecords = ["m01", "m04", "m05"].map(function (missionId, index) {
    const ownsAsset = index === 0;
    return {
      id: "pack." + missionId,
      kind: "asset-pack",
      missionIds: [missionId],
      assetIds: ownsAsset ? ["asset.slice.environment"] : [],
      dependencyPackIds: [],
      preloadAssetIds: ownsAsset ? ["asset.slice.environment"] : [],
      criticalAssetIds: ownsAsset ? ["asset.slice.environment"] : [],
      fallbackStyleId: "ancient-greece-ai-procedural",
      maxTransferBytes: 4000000,
      maxDecodedBytes: 64 * 1024 * 1024,
    };
  });
  return presentation;
}

function temporaryFileBackedV2Source(t) {
  const sourceRoot = fs.mkdtempSync(path.join(os.tmpdir(), "aegis-v3-asset-source-"));
  fs.cpSync(path.join(GAME_ROOT, "content"), sourceRoot, { recursive: true });
  t.after(function () { fs.rmSync(sourceRoot, { recursive: true, force: true }); });
  const presentationPath = path.join(sourceRoot, "presentation", "slice-v1.json");
  const manifestPath = path.join(sourceRoot, "manifests", "slice-dev-v1.json");
  const presentation = fileBackedV2Presentation();

  function writePresentation() {
    const bytes = Buffer.from(JSON.stringify(presentation, null, 2) + "\n", "utf8");
    fs.writeFileSync(presentationPath, bytes);
    const manifest = readJson(manifestPath);
    manifest.presentationCatalog.sha256 = hashBytes(bytes);
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  }
  writePresentation();
  return {
    manifestPath: manifestPath,
    presentation: presentation,
    sourceRoot: sourceRoot,
    writePresentation: writePresentation,
  };
}

function syntheticSimulation(versions) {
  versions = Object.assign({ event: 1, behavior: 1, includeEvent: true, includeBehavior: true }, versions);
  const descriptor = readJson(ABI_PATH);
  const fields = ["DESCRIPTOR: DESCRIPTOR"];
  if (versions.includeEvent) fields.push("EVENT_SCHEMA_VERSION: " + versions.event);
  if (versions.includeBehavior) fields.push("BEHAVIOR_REGISTRY_VERSION: " + versions.behavior);
  const source = [
    "/* Synthetic test-only v3 simulation binding fixture. */",
    "(function (root) {",
    "  \"use strict\";",
    "  function deepFreeze(value) {",
    "    if (!value || typeof value !== \"object\" || Object.isFrozen(value)) return value;",
    "    Object.keys(value).forEach(function (key) { deepFreeze(value[key]); });",
    "    return Object.freeze(value);",
    "  }",
    "  const DESCRIPTOR = deepFreeze(JSON.parse(" + JSON.stringify(canonicalEncode(descriptor)) + "));",
    "  const api = deepFreeze({ " + fields.join(", ") + " });",
    "  if (typeof module !== \"undefined\" && module.exports) { module.exports = api; return; }",
    "  const game = root.Game = root.Game || {};",
    "  Object.defineProperty(game, \"AegisSim\", { value: api, enumerable: true });",
    "})(typeof globalThis !== \"undefined\" ? globalThis : this);",
    "",
  ].join("\n");
  return Buffer.from(source, "utf8");
}

function syntheticMapSeam(input) {
  assert.equal(input.mapSource.id, input.mission.mapId);
  return clone(input.mapSource);
}

function compile(preflight, simulationBytes, mapSeam, previewValidator, assetOptions) {
  const options = Object.assign({
    simulationBytes: simulationBytes || syntheticSimulation(),
    simulationLabel: "synthetic-v3-sim.js",
    normalizeAndValidateMap: mapSeam || syntheticMapSeam,
    validatePendingPreviewProofs: previewValidator,
  }, assetOptions || {});
  return Compiler.compileVerifiedV3Source(preflight || syntheticPreflight(), options);
}

function trustSyntheticAssetClaim(claim) {
  return claim;
}

function verifyReleaseRecord(result, release, artifacts) {
  const releaseBytes = V3Artifacts.renderDataArtifact("AegisRelease", "RELEASE", release, "immutable release record");
  const releaseName = "aegis-release." + hashBytes(releaseBytes).slice(7) + ".js";
  return V3Artifacts.verifyV3ReleaseSelection({
    pinnedReleaseName: releaseName,
    releaseName: releaseName,
    releaseBytes: releaseBytes,
    artifacts: artifacts || result.artifacts.outputs,
  });
}

function rebuildArtifactsWithPresentation(result, presentation) {
  const manifest = result.artifacts.manifest;
  return V3Artifacts.buildV3Artifacts({
    schemaVersion: 3,
    abi: result.source.normalizedSource.abiDescriptor,
    abiBytes: result.artifacts.abiBytes,
    simulationBytes: result.artifacts.simulationBytes,
    simulationLabel: "synthetic-v3-sim.js",
    contentVersion: manifest.contentVersion,
    approvalState: manifest.approvalState,
    annexHash: manifest.annexHash,
    sourceManifestHash: manifest.sourceManifestHash,
    sourceProvenance: manifest.sourceProvenance,
    includedIds: manifest.includedIds,
    content: result.artifacts.content,
    presentation: presentation,
  });
}

function verifyReplacementPresentation(result, presentation) {
  const presentationBytes = V3Artifacts.renderDataArtifact(
    "AegisPresentation",
    "PRESENTATION",
    presentation,
    "presentation companion artifact"
  );
  const presentationHash = hashBytes(presentationBytes);
  const presentationName = "aegis-presentation." + presentationHash.slice(7) + ".js";
  const release = clone(result.artifacts.manifest);
  release.presentationArtifact = presentationName;
  release.presentationHash = presentationHash;
  const artifacts = new Map(result.artifacts.outputs);
  artifacts.set(presentationName, presentationBytes);
  return verifyReleaseRecord(result, release, artifacts);
}

function expectDiagnostic(fn, code, diagnosticPath) {
  assert.throws(fn, function (error) {
    assert.ok(error instanceof AegisContentError, error && error.stack);
    assert.equal(error.diagnostics[0].code, code);
    if (diagnosticPath !== undefined) assert.equal(error.diagnostics[0].path, diagnosticPath);
    return true;
  });
}

test("complete synthetic v3 compilation is byte-identical and emits five immutable partitions", () => {
  const first = compile();
  const second = compile();
  assert.equal(first.artifacts.outputs.size, 5);
  assert.deepEqual(Array.from(first.artifacts.outputs.keys()), Array.from(second.artifacts.outputs.keys()));
  for (const name of first.artifacts.outputs.keys()) {
    assert.deepEqual(first.artifacts.outputs.get(name), second.artifacts.outputs.get(name));
  }
  assert.equal(first.artifacts.manifest.schemaVersion, 3);
  assert.equal(first.artifacts.manifest.releaseEligible, false);
  assert.deepEqual(Object.keys(first.artifacts.manifest).sort(), [
    "abiHash", "annexHash", "approvalState", "behaviorRegistryVersion", "contentArtifact",
    "contentHash", "contentVersion", "eventSchemaVersion", "includedIds", "presentationArtifact",
    "presentationHash", "releaseEligible", "rulesetHash", "schemaVersion", "simulationArtifact",
    "simulationHash", "sourceManifestHash", "sourceProvenance",
  ]);
  assert.deepEqual(first.artifacts.manifest.includedIds, {
    missions: ["m01", "m04", "m05"],
    defenses: ["chronos", "hoplite", "oracle", "sentinel", "siege"],
    enemies: ["echo", "guardian", "raider", "scout", "titan"],
    bosses: ["talos-prototype"],
  });
  assert.equal(first.artifacts.content.defenses.chronos.levels[0].rangeWorldUnits, 1000);
  assert.equal(first.lockCoverage.coveredLeafCount > 0, true);
});

test("shared writer verifies the exact five-partition release set before disk I/O", (t) => {
  const result = compile();
  const entries = SharedCompiler.artifactEntries(result);
  assert.equal(entries.length, 5);
  assert.deepEqual(entries.map(function (entry) {
    return entry[0].split(".")[0];
  }).sort(), ["aegis-content", "aegis-presentation", "aegis-release", "aegis-sim", "manifest"]);

  const output = fs.mkdtempSync(path.join(os.tmpdir(), "aegis-v3-generated-"));
  t.after(function () { fs.rmSync(output, { recursive: true, force: true }); });
  const written = SharedCompiler.writeArtifacts(result, output);
  assert.deepEqual(SharedCompiler.checkArtifacts(result, output), written);

  const missingPresentation = new Map(result.artifacts.outputs);
  missingPresentation.delete(result.artifacts.manifest.presentationArtifact);
  const rejectedOutput = path.join(output, "rejected-invalid-set");
  const incompleteResult = Object.assign({}, result, {
    artifacts: Object.assign({}, result.artifacts, { outputs: missingPresentation }),
  });
  expectDiagnostic(function () {
    SharedCompiler.writeArtifacts(incompleteResult, rejectedOutput);
  }, "ARTIFACT_SET", "/generated");
  assert.equal(fs.existsSync(rejectedOutput), false);

  const changed = syntheticPreflight();
  changed.manifestHash = "sha256:" + "f".repeat(64);
  const otherRelease = compile(changed);
  const mixed = new Map(result.artifacts.outputs);
  mixed.delete(result.artifacts.releaseName);
  mixed.set(otherRelease.artifacts.releaseName, otherRelease.artifacts.releaseBytes);
  expectDiagnostic(function () {
    SharedCompiler.artifactEntries(Object.assign({}, result, {
      artifacts: Object.assign({}, result.artifacts, {
        outputs: mixed,
        releaseName: otherRelease.artifacts.releaseName,
      }),
    }));
  }, "V3_RELEASE_MANIFEST_MISMATCH", "/manifest");
});

test("simulation content excludes approval, source paths, raw hashes, UI, localized values, and presentation packs", () => {
  const result = compile();
  const encoded = canonicalEncode(result.artifacts.content);
  ["approvalState", "sourceProvenance", "presentationPackId", "\"ui\"", "procedural-placeholder"].forEach(function (forbidden) {
    assert.equal(encoded.includes(forbidden), false, forbidden);
  });
  assert.equal((encoded.match(/sha256:/g) || []).length, 1, "only the required exact ABI identity is present");
  assert.equal(Object.prototype.hasOwnProperty.call(result.artifacts.content.enemies.echo, "ui"), false);
  assert.equal(result.artifacts.presentation.packRecords[0].kind, "procedural-placeholder");
  assert.equal(result.artifacts.presentation.cueMappings[0].kind, "semantic-fallback");
  assert.equal(Object.isFrozen(result.artifacts.presentation.strings[0]), true);
});

test("provenance-only identity changes preserve ruleset identity but change manifest and release identity", () => {
  const baseline = syntheticPreflight();
  const changed = clone(baseline);
  changed.manifestHash = "sha256:" + "f".repeat(64);
  const first = compile(baseline);
  const second = compile(changed);
  assert.equal(first.artifacts.rulesetHash, second.artifacts.rulesetHash);
  assert.notEqual(first.artifacts.manifestName, second.artifacts.manifestName);
  assert.notEqual(first.artifacts.releaseName, second.artifacts.releaseName);
  assert.equal(first.artifacts.manifest.contentHash, second.artifacts.manifest.contentHash);
});

test("localized copy changes only presentation and release identities", () => {
  const changed = syntheticPreflight();
  changed.normalizedSource.stringCatalog.entries[0].value += "!";
  const first = compile();
  const second = compile(changed);
  assert.equal(first.artifacts.manifest.contentHash, second.artifacts.manifest.contentHash);
  assert.equal(first.artifacts.rulesetHash, second.artifacts.rulesetHash);
  assert.notEqual(first.artifacts.manifest.presentationHash, second.artifacts.manifest.presentationHash);
  assert.notEqual(first.artifacts.manifestName, second.artifacts.manifestName);
  assert.notEqual(first.artifacts.releaseName, second.artifacts.releaseName);
});

test("schema v2 art identity changes only presentation and release identities", () => {
  const baseline = syntheticPreflight();
  baseline.normalizedSource.presentationCatalog = syntheticV2Presentation("1");
  const changed = syntheticPreflight();
  changed.normalizedSource.presentationCatalog = syntheticV2Presentation("2");
  const first = compile(baseline, null, null, null, { verifyAssetClaim: trustSyntheticAssetClaim });
  const second = compile(changed, null, null, null, { verifyAssetClaim: trustSyntheticAssetClaim });

  assert.equal(first.artifacts.presentation.schemaVersion, 2);
  assert.equal(second.artifacts.presentation.schemaVersion, 2);
  assert.equal(first.artifacts.manifest.simulationHash, second.artifacts.manifest.simulationHash);
  assert.equal(first.artifacts.manifest.contentHash, second.artifacts.manifest.contentHash);
  assert.equal(first.artifacts.rulesetHash, second.artifacts.rulesetHash);
  assert.notEqual(first.artifacts.manifest.presentationHash, second.artifacts.manifest.presentationHash);
  assert.notEqual(first.artifacts.manifestName, second.artifacts.manifestName);
  assert.notEqual(first.artifacts.releaseName, second.artifacts.releaseName);

  const verified = V3Artifacts.verifyV3ReleaseSelection({
    pinnedReleaseName: second.artifacts.releaseName,
    releaseName: second.artifacts.releaseName,
    releaseBytes: second.artifacts.releaseBytes,
    artifacts: second.artifacts.outputs,
  });
  assert.equal(verified.presentation.schemaVersion, 2);
});

test("schema v2 build and boot bind exact mission ownership and cue coverage to compiled content", () => {
  const preflight = syntheticPreflight();
  preflight.normalizedSource.presentationCatalog = syntheticV2Presentation("1");
  const result = compile(preflight, null, null, null, { verifyAssetClaim: trustSyntheticAssetClaim });

  let changed = clone(result.artifacts.presentation);
  changed.packRecords[0].missionIds = [];
  expectDiagnostic(
    function () { rebuildArtifactsWithPresentation(result, changed); },
    "PRESENTATION_MISSION_ASSIGNMENT",
    "/presentation/packRecords"
  );
  expectDiagnostic(
    function () { verifyReplacementPresentation(result, changed); },
    "PRESENTATION_MISSION_ASSIGNMENT",
    "/presentation/packRecords"
  );

  changed = clone(result.artifacts.presentation);
  changed.cueMappings = [];
  expectDiagnostic(
    function () { rebuildArtifactsWithPresentation(result, changed); },
    "PRESENTATION_CUE_ASSIGNMENT",
    "/presentation/cueMappings"
  );
  expectDiagnostic(
    function () { verifyReplacementPresentation(result, changed); },
    "PRESENTATION_CUE_ASSIGNMENT",
    "/presentation/cueMappings"
  );
});

test("schema v2 compilation attests real asset bytes and rejects nonexistent or mismatched claims", () => {
  const source = syntheticPreflight();
  source.normalizedSource.presentationCatalog = measuredV2Presentation();
  const result = compile(source, null, null, null, { assetRoot: GAME_ROOT });
  const measured = AssetInspector.inspectAsset(GAME_ROOT, "art/v2/ui/panel-4x3-v1.webp");
  assert.equal(result.artifacts.presentation.assetRecords[0].sha256, measured.sha256);
  assert.equal(result.artifacts.presentation.assetRecords[0].transferBytes, measured.transferBytes);

  const missing = syntheticPreflight();
  missing.normalizedSource.presentationCatalog = measuredV2Presentation();
  missing.normalizedSource.presentationCatalog.assetRecords[0].relativeUrl =
    "art/v2/ui/does-not-exist.webp";
  expectDiagnostic(
    function () { compile(missing, null, null, null, { assetRoot: GAME_ROOT }); },
    "ASSET_READ",
    "/presentationCatalog/assetRecords/0/relativeUrl"
  );

});

test("file-backed v3 asset attestation cannot be replaced or redirected", () => {
  const presentation = measuredV2Presentation();
  const fileBacked = { sourceRoot: path.join(GAME_ROOT, "content"), repositoryRoot: REPO_ROOT };
  expectDiagnostic(
    function () { Compiler.verifyPresentationAssetClaims({}, presentation, {}); },
    "V3_ASSET_VERIFIER",
    "/presentationCatalog/assetRecords"
  );
  [
    ["relativeUrl", "art/v2/ui/other.webp"],
    ["sha256", "sha256:" + "f".repeat(64)],
    ["widthPx", 1025],
    ["heightPx", 769],
    ["alphaMode", "alpha"],
    ["transferBytes", 42811],
    ["decodedBytes", 3145732],
  ].forEach(function (mutation) {
    expectDiagnostic(
      function () {
        Compiler.verifyPresentationAssetClaims({}, presentation, {
          verifyAssetClaim: function (claim) {
            return Object.assign({}, claim, { [mutation[0]]: mutation[1] });
          },
        });
      },
      "ASSET_CLAIM_MISMATCH",
      "/presentationCatalog/assetRecords/0/" + mutation[0]
    );
  });
  expectDiagnostic(
    function () {
      Compiler.verifyPresentationAssetClaims(fileBacked, presentation, {
        verifyAssetClaim: trustSyntheticAssetClaim,
      });
    },
    "V3_ASSET_VERIFIER",
    "/presentationCatalog/assetRecords"
  );
  expectDiagnostic(
    function () {
      Compiler.verifyPresentationAssetClaims(fileBacked, presentation, { assetRoot: GAME_ROOT + "-alias" });
    },
    "V3_ASSET_ROOT",
    "/presentationCatalog/assetRecords"
  );
  assert.equal(
    Compiler.verifyPresentationAssetClaims(fileBacked, presentation, { assetRoot: GAME_ROOT }).length,
    1
  );
});

test("shared file-backed compiler derives the repository asset root and fails closed on missing bytes", (t) => {
  const fixture = temporaryFileBackedV2Source(t);
  const compileFixture = function () {
    return SharedCompiler.compileSourceTree({
      sourceRoot: fixture.sourceRoot,
      manifestPath: fixture.manifestPath,
      repositoryRoot: REPO_ROOT,
      simulationBytes: syntheticSimulation(),
    });
  };
  fixture.presentation.assetRecords[0].relativeUrl = "art/v2/ui/does-not-exist.webp";
  fixture.writePresentation();
  expectDiagnostic(
    compileFixture,
    "ASSET_READ",
    "/presentationCatalog/assetRecords/0/relativeUrl"
  );
});

test("compiler presentation dispatch rejects missing and unknown schema versions without fallback", () => {
  let changed = syntheticPreflight();
  delete changed.normalizedSource.presentationCatalog.schemaVersion;
  expectDiagnostic(
    function () { compile(changed); },
    "PRESENTATION_SCHEMA_VERSION",
    "/presentationCatalog/schemaVersion"
  );

  changed = syntheticPreflight();
  changed.normalizedSource.presentationCatalog.schemaVersion = 3;
  expectDiagnostic(
    function () { compile(changed); },
    "PRESENTATION_SCHEMA_VERSION",
    "/presentationCatalog/schemaVersion"
  );
});

test("provenance sources remain canonical contained portable paths", () => {
  ["/absolute.json", "../escape.json", "records//enemy.json", "records/./enemy.json", "records/enemy.json:stream"].forEach(function (sourcePath) {
    const changed = syntheticPreflight();
    changed.provenance[0].source = sourcePath;
    expectDiagnostic(function () { compile(changed); }, "SOURCE_REFERENCE", "/sourceProvenance/0/source");
  });
});

test("one normalized simulation value changes content, ruleset, manifest, and release identities", () => {
  const changed = syntheticPreflight();
  changed.normalizedSource.enemies.records.find(function (record) { return record.id === "scout"; }).hp = "2";
  const first = compile();
  const second = compile(changed);
  assert.notEqual(first.artifacts.manifest.contentHash, second.artifacts.manifest.contentHash);
  assert.notEqual(first.artifacts.rulesetHash, second.artifacts.rulesetHash);
  assert.notEqual(first.artifacts.manifestName, second.artifacts.manifestName);
  assert.notEqual(first.artifacts.releaseName, second.artifacts.releaseName);
});

test("event schema and behavior registry bind independently and cannot be inferred from commands", () => {
  expectDiagnostic(function () { compile(null, syntheticSimulation({ event: 2 })); }, "EVENT_SCHEMA_BINDING_MISMATCH", "/eventSchemaVersion");
  expectDiagnostic(function () { compile(null, syntheticSimulation({ behavior: 2 })); }, "BEHAVIOR_REGISTRY_BINDING_MISMATCH", "/behaviorRegistryVersion");
  expectDiagnostic(function () { compile(null, syntheticSimulation({ includeEvent: false })); }, "SIMULATION_BINDING_MISSING", "/simulation/EVENT_SCHEMA_VERSION");
  expectDiagnostic(function () { compile(null, syntheticSimulation({ includeBehavior: false })); }, "SIMULATION_BINDING_MISSING", "/simulation/BEHAVIOR_REGISTRY_VERSION");
});

test("classic release record has exact manifest parity and verifies every immutable boot dependency", () => {
  const result = compile();
  const verified = V3Artifacts.verifyV3ReleaseSelection({
    pinnedReleaseName: result.artifacts.releaseName,
    releaseName: result.artifacts.releaseName,
    releaseBytes: result.artifacts.releaseBytes,
    manifestBytes: result.artifacts.manifestBytes,
    artifacts: result.artifacts.outputs,
  });
  assert.deepEqual(verified.release, result.artifacts.manifest);
  assert.equal(Object.isFrozen(verified.release.sourceProvenance), true);
  assert.equal(verified.bindings.eventSchemaVersion, 1);
  assert.equal(verified.bindings.behaviorRegistryVersion, 1);

  const commonContext = { module: { exports: {} }, exports: {} };
  commonContext.globalThis = commonContext;
  vm.runInNewContext(result.artifacts.releaseBytes.toString("utf8"), commonContext);
  assert.equal(Object.isFrozen(commonContext.module.exports), true);
  assert.equal(Object.isFrozen(commonContext.module.exports.RELEASE.sourceProvenance), true);
  const classicContext = {};
  classicContext.globalThis = classicContext;
  vm.runInNewContext(result.artifacts.releaseBytes.toString("utf8"), classicContext);
  assert.equal(Object.isFrozen(classicContext.Game.AegisRelease), true);
  assert.equal(Object.isFrozen(classicContext.Game.AegisRelease.RELEASE.includedIds.missions), true);
});

test("release selection rejects mutable/corrupt release and dependency identities before boot", () => {
  const result = compile();
  expectDiagnostic(function () {
    V3Artifacts.verifyV3ReleaseSelection({});
  }, "V3_RELEASE_SELECTION", "/release");

  expectDiagnostic(function () {
    V3Artifacts.verifyV3ReleaseSelection({
      pinnedReleaseName: result.artifacts.releaseName,
      releaseName: result.artifacts.releaseName,
    });
  }, "V3_RELEASE_BYTES", "/release");

  expectDiagnostic(function () {
    V3Artifacts.verifyV3ReleaseSelection({
      pinnedReleaseName: "aegis-release." + "0".repeat(64) + ".js",
      releaseName: result.artifacts.releaseName,
      releaseBytes: result.artifacts.releaseBytes,
      artifacts: result.artifacts.outputs,
    });
  }, "V3_RELEASE_SELECTION", "/release");

  expectDiagnostic(function () {
    V3Artifacts.verifyV3ReleaseSelection({
      pinnedReleaseName: result.artifacts.releaseName,
      releaseName: result.artifacts.releaseName,
      releaseBytes: result.artifacts.releaseBytes,
      artifacts: result.artifacts.outputs,
      queryReleaseUrl: result.artifacts.releaseName,
    });
  }, "V3_RELEASE_SELECTION", "/release");

  expectDiagnostic(function () {
    V3Artifacts.verifyV3ReleaseSelection({
      pinnedReleaseName: "aegis-release.js",
      releaseName: "aegis-release.js",
      releaseBytes: result.artifacts.releaseBytes,
      artifacts: result.artifacts.outputs,
    });
  }, "V3_RELEASE_IDENTITY", "/release");

  const corrupt = new Map(result.artifacts.outputs);
  corrupt.set(result.artifacts.manifest.contentArtifact, Buffer.from("corrupt\n"));
  expectDiagnostic(function () {
    V3Artifacts.verifyV3ReleaseSelection({
      pinnedReleaseName: result.artifacts.releaseName,
      releaseName: result.artifacts.releaseName,
      releaseBytes: result.artifacts.releaseBytes,
      artifacts: corrupt,
    });
  }, "V3_ARTIFACT_CORRUPT");

  const malformed = new Map(result.artifacts.outputs);
  malformed.set(result.artifacts.manifest.contentArtifact, {});
  expectDiagnostic(function () {
    V3Artifacts.verifyV3ReleaseSelection({
      pinnedReleaseName: result.artifacts.releaseName,
      releaseName: result.artifacts.releaseName,
      releaseBytes: result.artifacts.releaseBytes,
      artifacts: malformed,
    });
  }, "V3_ARTIFACT_BYTES", "/artifacts/" + result.artifacts.manifest.contentArtifact);

  const mutable = clone(result.artifacts.manifest);
  mutable.contentArtifact = "aegis-content.js";
  const mutableBytes = V3Artifacts.renderDataArtifact("AegisRelease", "RELEASE", mutable, "immutable release record");
  const mutableName = "aegis-release." + hashBytes(mutableBytes).slice(7) + ".js";
  expectDiagnostic(function () {
    V3Artifacts.verifyV3ReleaseSelection({
      pinnedReleaseName: mutableName,
      releaseName: mutableName,
      releaseBytes: mutableBytes,
      artifacts: result.artifacts.outputs,
    });
  }, "V3_ARTIFACT_NAME");

  const noncanonicalManifest = Buffer.concat([Buffer.from(" "), result.artifacts.manifestBytes]);
  expectDiagnostic(function () {
    V3Artifacts.verifyV3ReleaseSelection({
      pinnedReleaseName: result.artifacts.releaseName,
      releaseName: result.artifacts.releaseName,
      releaseBytes: result.artifacts.releaseBytes,
      manifestBytes: noncanonicalManifest,
      artifacts: result.artifacts.outputs,
    });
  }, "V3_MANIFEST_CANONICAL", "/manifest");

  expectDiagnostic(function () {
    V3Artifacts.verifyV3ReleaseSelection({
      pinnedReleaseName: result.artifacts.releaseName,
      releaseName: result.artifacts.releaseName,
      releaseBytes: result.artifacts.releaseBytes,
      manifestBytes: {},
      artifacts: result.artifacts.outputs,
    });
  }, "V3_MANIFEST_PARSE", "/manifest");
});

test("release validation rejects malformed versions, provenance, and included ID sets", () => {
  const result = compile();

  let changed = clone(result.artifacts.manifest);
  changed.eventSchemaVersion = 0;
  expectDiagnostic(function () { verifyReleaseRecord(result, changed); }, "V3_RELEASE_RECORD", "/release/eventSchemaVersion");

  changed = clone(result.artifacts.manifest);
  changed.behaviorRegistryVersion = -1;
  expectDiagnostic(function () { verifyReleaseRecord(result, changed); }, "V3_RELEASE_RECORD", "/release/behaviorRegistryVersion");

  changed = clone(result.artifacts.manifest);
  changed.contentVersion = "Mutable Version";
  expectDiagnostic(function () { verifyReleaseRecord(result, changed); }, "V3_RELEASE_RECORD", "/release/contentVersion");

  changed = clone(result.artifacts.manifest);
  changed.sourceProvenance[0].source = "../escape.json";
  expectDiagnostic(function () { verifyReleaseRecord(result, changed); }, "SOURCE_REFERENCE", "/release/sourceProvenance/0/source");

  changed = clone(result.artifacts.manifest);
  changed.sourceProvenance[1] = clone(changed.sourceProvenance[0]);
  expectDiagnostic(function () { verifyReleaseRecord(result, changed); }, "V3_RELEASE_RECORD", "/release/sourceProvenance/1");

  changed = clone(result.artifacts.manifest);
  changed.sourceProvenance[0].unexpected = true;
  expectDiagnostic(function () { verifyReleaseRecord(result, changed); }, "V3_RELEASE_RECORD", "/release/sourceProvenance/0");

  changed = clone(result.artifacts.manifest);
  changed.sourceProvenance.reverse();
  expectDiagnostic(function () { verifyReleaseRecord(result, changed); }, "V3_RELEASE_RECORD");

  changed = clone(result.artifacts.manifest);
  changed.includedIds.defenses.reverse();
  expectDiagnostic(function () { verifyReleaseRecord(result, changed); }, "V3_RELEASE_RECORD");

  changed = clone(result.artifacts.manifest);
  changed.includedIds.missions.push(changed.includedIds.missions[changed.includedIds.missions.length - 1]);
  expectDiagnostic(function () { verifyReleaseRecord(result, changed); }, "V3_RELEASE_RECORD");
});

test("release selection binds included IDs to content and forbids production with presentation schema v1", () => {
  const result = compile();
  let changed = clone(result.artifacts.manifest);
  changed.includedIds.defenses = changed.includedIds.defenses.slice(1);
  expectDiagnostic(function () {
    verifyReleaseRecord(result, changed);
  }, "V3_INCLUDED_IDS_MISMATCH", "/release/includedIds/defenses");

  changed = clone(result.artifacts.manifest);
  changed.approvalState = "production-approved";
  changed.releaseEligible = true;
  expectDiagnostic(function () {
    verifyReleaseRecord(result, changed);
  }, "PRESENTATION_PRODUCTION_FORBIDDEN", "/release/approvalState");

  const unsupportedPresentation = clone(result.artifacts.presentation);
  unsupportedPresentation.schemaVersion = 3;
  const presentationBytes = V3Artifacts.renderDataArtifact(
    "AegisPresentation",
    "PRESENTATION",
    unsupportedPresentation,
    "presentation companion artifact"
  );
  const presentationHash = hashBytes(presentationBytes);
  const presentationName = "aegis-presentation." + presentationHash.slice(7) + ".js";
  changed = clone(result.artifacts.manifest);
  changed.presentationArtifact = presentationName;
  changed.presentationHash = presentationHash;
  const artifacts = new Map(result.artifacts.outputs);
  artifacts.set(presentationName, presentationBytes);
  expectDiagnostic(function () {
    verifyReleaseRecord(result, changed, artifacts);
  }, "PRESENTATION_SCHEMA_UNIMPLEMENTED", "/presentation/schemaVersion");
});

test("map seam is mandatory and map-owned route references remain fail closed", () => {
  expectDiagnostic(function () {
    Compiler.compileVerifiedV3Source(syntheticPreflight(), { simulationBytes: syntheticSimulation() });
  }, "V3_MAP_COMPILER_REQUIRED", "/maps");

  expectDiagnostic(function () {
    compile(null, null, function (input) {
      const map = clone(input.mapSource);
      if (map.id === "m04") map.routes = map.routes.filter(function (route) { return route.id !== "route.south"; });
      return map;
    });
  }, "MISSION_ROUTE_REFERENCE", "/missions/1/objectives/2/predicate/routeIds/1");
});

test("Mission 1 binding locks cannot be relabeled as Candidate-BAL tuning scope", () => {
  function mutation(mutator, code, diagnosticPath) {
    const source = syntheticPreflight();
    assert.equal(source.annex.candidateScopes.includes("/missions"), true);
    mutator(source.normalizedSource.missions[0].definition);
    expectDiagnostic(function () { compile(source); }, code, diagnosticPath);
  }

  mutation(function (mission) {
    mission.baseStartAether = 151;
  }, "M01_BINDING_LOCK", "/missions/0/baseStartAether");

  mutation(function (mission) {
    mission.waves[2].baseAetherEnvelope = 46;
    mission.waves[2].deploymentGrantAether = 46;
  }, "M01_BINDING_LOCK", "/missions/0/waves/2/baseAetherEnvelope");

  mutation(function (mission) {
    mission.waves.pop();
  }, "M01_BINDING_LOCK", "/missions/0/waves");

  mutation(function (mission) {
    mission.headlineMechanicId = "alternate-foundation";
    mission.previewDeclarations[0].mechanicId = "alternate-foundation";
  }, "M01_BINDING_LOCK", "/missions/0/headlineMechanicId");

  mutation(function (mission) {
    mission.tutorial = { kind: "none" };
  }, "M01_BINDING_LOCK", "/missions/0/tutorial");

  mutation(function (mission) {
    mission.waves[0].groups[0].routeId = "route.candidate";
  }, "M01_BINDING_LOCK", "/missions/0/waves/0/groups/0/routeId");

  const relabeledGrant = syntheticPreflight();
  const deploymentEvent = clone(relabeledGrant.normalizedSource.eventCatalog.records.find(function (record) {
    return record.id === "wave.deploy";
  }));
  deploymentEvent.id = "wave.deploy.alt";
  relabeledGrant.normalizedSource.eventCatalog.records.push(deploymentEvent);
  relabeledGrant.normalizedSource.missions[0].definition.semanticEventIds.push(deploymentEvent.id);
  relabeledGrant.normalizedSource.missions[0].definition.waves[5].deploymentGrantEventId = deploymentEvent.id;
  expectDiagnostic(function () { compile(relabeledGrant); }, "M01_BINDING_LOCK", "/missions/0/waves/5");

  const airborneRoad = syntheticPreflight();
  airborneRoad.normalizedSource.missions[0].map.routes[0].kind = "air";
  airborneRoad.normalizedSource.enemies.records.find(function (record) {
    return record.id === "scout";
  }).routeKinds = ["air", "ground"];
  expectDiagnostic(function () { compile(airborneRoad); }, "M01_BINDING_LOCK", "/maps/m01/routes/0/kind");

  mutation(function (mission) {
    mission.firstClearRewards[0].defenseId = "sentinel";
  }, "REWARD_UNLOCK_MAPPING", "/missions/0/firstClearRewards");
});

test("inherited boss-threshold children must support the concrete parent route kind", () => {
  const source = syntheticPreflight();
  source.normalizedSource.bosses.records[0].routeKinds = ["air", "ground"];
  expectDiagnostic(function () {
    compile(source, null, function (input) {
      const map = clone(input.mapSource);
      if (map.id === "m05") map.routes[0].kind = "air";
      return map;
    });
  }, "MISSION_ROUTE_KIND", "/bosses/talos-prototype/thresholdScript/parameters/thresholds/0/childSpawnRecords/0/routeOwnership");
});

test("fixed boss-threshold children must support their selected route kind", () => {
  const source = syntheticPreflight();
  const child = source.normalizedSource.bosses.records[0]
    .thresholdScript.parameters.thresholds[0].childSpawnRecords[0];
  child.routeOwnership = "fixed";
  child.fixedRouteId = "route.air";
  expectDiagnostic(function () {
    compile(source, null, function (input) {
      const map = clone(input.mapSource);
      if (map.id === "m05") map.routes.push({ id: "route.air", kind: "air" });
      return map;
    });
  }, "MISSION_ROUTE_KIND", "/bosses/talos-prototype/thresholdScript/parameters/thresholds/0/childSpawnRecords/0/fixedRouteId");
});

test("non-briefing previews remain fail closed until exact lethality provenance is injected", () => {
  const source = syntheticPreflight();
  const declaration = source.normalizedSource.missions[1].definition.previewDeclarations[0];
  source.normalizedSource.missions[1].definition.previewDeclarations[0] = {
    id: declaration.id,
    mechanicId: declaration.mechanicId,
    briefingKey: declaration.briefingKey,
    previewKind: "nonlethal-semantic-event",
    previewEventId: "wave.deploy",
    firstLethalWaveIndex: declaration.firstLethalWaveIndex,
    semanticCueIds: declaration.semanticCueIds,
  };
  expectDiagnostic(function () { compile(source); }, "V3_PREVIEW_VALIDATOR_REQUIRED", "/previewDeclarations");
  const result = compile(source, null, null, function (input) {
    assert.equal(input.pendingPreviewProofRecords.length, 1);
    return [{
      missionId: "m04",
      previewDeclarationId: "preview.m04",
      previewKind: "nonlethal-semantic-event",
      firstLethalWaveIndex: 1,
      precedesFirstLethal: true,
      provenanceId: "compiler.wave-deploy-before-spawn-v1",
    }];
  });
  assert.deepEqual(result.artifacts.content.previewProofRecords, [{
    missionId: "m04",
    previewDeclarationId: "preview.m04",
    previewKind: "nonlethal-semantic-event",
    firstLethalWaveIndex: 1,
    precedesFirstLethal: true,
    provenanceId: "compiler.wave-deploy-before-spawn-v1",
  }]);
});

test("annex coverage is exact and unordered ID sets are never numeric lock-addressable", () => {
  const result = compile();
  assert.equal(result.resolved.semanticArrayPaths.includes("/campaignRules/ruleCatalog/comparatorIds"), false);
  assert.equal(result.resolved.semanticArrayPaths.includes("/campaignRules/targetPolicyRecords/0/comparatorIds"), true);

  const changed = syntheticPreflight();
  changed.annex.bindingLocks = [{
    id: "lock.schema",
    authorityId: "test.authority",
    jsonPointer: "/schemaVersion",
    expectedCanonicalValueHash: Annex.canonicalValueHash(2),
  }];
  changed.annex.authorityRecords = [{
    id: "test.authority",
    repositoryPath: "docs/superpowers/specs/2026-08-27-armara-aegis-slice-content-schema.md",
    sha256: hashFile(path.join(REPO_ROOT, "docs", "superpowers", "specs", "2026-08-27-armara-aegis-slice-content-schema.md")),
  }];
  changed.annex.candidateScopes = changed.annex.candidateScopes.filter(function (pointer) { return pointer !== "/schemaVersion"; });
  expectDiagnostic(function () { compile(changed); }, "ANNEX_LOCK_HASH_MISMATCH", "/bindingLocks/0/expectedCanonicalValueHash");
});
