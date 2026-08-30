"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const LIB = path.join(REPO_ROOT, "tools", "lib", "aegis");
const CONTENT_V4 = path.join(REPO_ROOT, "games", "aegis", "content-v4");
const MANIFEST_PATH = path.join(CONTENT_V4, "manifests", "candidate-v4.json");
const SIMULATION_FIXTURE = path.join(
  __dirname, "fixtures", "compiler", "v4-abi-v2-identity", "simulation.js"
);

const Compiler = require(path.join(LIB, "compiler.js"));
const V4Artifacts = require(path.join(LIB, "v4-artifacts.js"));
const V4Compiler = require(path.join(LIB, "v4-compiler.js"));
const V4CrossReferences = require(path.join(LIB, "v4-cross-references.js"));
const V3MapAdapter = require(path.join(LIB, "v3-map-adapter.js"));
const RuleCatalog = require(path.join(LIB, "v4-rule-catalog.js"));
const Catalog = require(path.join(LIB, "v4-behavior-catalog.js"));
const ReleaseSelector = require(path.join(REPO_ROOT, "games", "aegis", "js", "delivery", "release-selector.js"));
const AbiV2 = require(path.join(REPO_ROOT, "games", "aegis", "js", "sim", "abi-v2.js"));

function sha256Hex(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function build() {
  return Compiler.compileSourceTree({
    sourceRoot: CONTENT_V4,
    repositoryRoot: REPO_ROOT,
    manifestPath: MANIFEST_PATH,
    simulationPath: SIMULATION_FIXTURE,
  });
}

function expectDiagnostic(run, code) {
  let thrown = null;
  try { run(); } catch (error) { thrown = error; }
  assert.ok(thrown, "expected " + code + " but nothing was thrown");
  assert.equal(thrown.name, "AegisContentError", String(thrown && thrown.stack));
  assert.ok(
    thrown.diagnostics.some(function (item) { return item.code === code; }),
    "expected " + code + " in " + JSON.stringify(thrown.diagnostics)
  );
}

test("the ABI-v2 identity fixture mirrors the authenticated runtime module", () => {
  const fixture = require(SIMULATION_FIXTURE);
  assert.equal(fixture.AegisSimV2.DESCRIPTOR_SHA256, AbiV2.DESCRIPTOR_SHA256);
  assert.equal(fixture.AegisSimV2.EVENT_SCHEMA_VERSION, 2);
  assert.equal(fixture.AegisSimV2.BEHAVIOR_REGISTRY_VERSION, 2);
  assert.equal(fixture.AegisSimV2.COMMAND_SCHEMA_VERSION, 2);
  assert.deepEqual(fixture.AegisSimV2.DESCRIPTOR, JSON.parse(AbiV2.DESCRIPTOR_CANONICAL));
});

test("candidate-v4 compiles twice to byte-identical immutable artifacts", () => {
  const first = build();
  const second = build();
  const firstEntries = Array.from(first.artifacts.outputs);
  const secondEntries = Array.from(second.artifacts.outputs);
  assert.equal(firstEntries.length, 5);
  assert.deepEqual(
    firstEntries.map(function (entry) { return entry[0]; }),
    secondEntries.map(function (entry) { return entry[0]; })
  );
  firstEntries.forEach(function (entry, index) {
    assert.ok(entry[1].equals(secondEntries[index][1]), entry[0] + " is byte-identical across clean builds");
    const match = /^(aegis-sim|aegis-content|aegis-presentation|aegis-release|manifest)\.([0-9a-f]{64})\.(js|json)$/
      .exec(entry[0]);
    assert.ok(match, entry[0] + " uses an immutable content-hashed filename");
    assert.equal(match[2], sha256Hex(entry[1]), entry[0] + " filename digest matches its bytes");
  });
  assert.equal(first.artifacts.rulesetHash, second.artifacts.rulesetHash);
  assert.match(first.artifacts.rulesetHash, /^sha256:[0-9a-f]{64}$/);
});

test("compiled content v4 keeps the v3 lock tree and adds the unlock collections", () => {
  const content = build().artifacts.content;
  assert.deepEqual(Object.keys(content).sort(), [
    "abiHash", "abiVersion", "acts", "behaviorContracts", "behaviorRegistryVersion", "bosses",
    "campaignRules", "commandSchemaVersion", "contentVersion", "defenseUnlockGrantMappings",
    "defenses", "enemies", "eventCatalog", "eventSchemaVersion", "grantRecords", "maps", "mechanisms",
    "missionProgression", "missions", "previewProofRecords", "profileSchemaVersion",
    "protocolRules", "protocols",
    "reinforcementRules", "reinforcements", "relicRules", "relics", "replayFormatVersion",
    "schemaVersion", "specializations", "summons",
  ]);
  assert.equal(content.schemaVersion, 4);
  assert.equal(content.abiVersion, 2);
  assert.equal(content.eventSchemaVersion, 2);
  assert.equal(content.behaviorRegistryVersion, 2);
  assert.equal(content.commandSchemaVersion, 2);
  assert.equal(content.replayFormatVersion, 2);
  assert.equal(content.contentVersion, "candidate-v4");

  assert.deepEqual(Object.keys(content.defenses), Catalog.DEFENSE_IDS.slice());
  assert.deepEqual(Object.keys(content.specializations), RuleCatalog.SPECIALIZATION_IDS.slice().sort());
  Object.keys(content.defenses).forEach(function (id) {
    const defense = content.defenses[id];
    assert.deepEqual(Object.keys(defense).sort(), [
      "allowedTargetPolicyIds", "defaultTargetPolicyId", "defenseTags", "id", "levels", "nameKey",
      "roleKey", "semanticEventIds", "specializationIds", "targetKinds", "unlockId", "weaknessKey",
    ]);
    assert.equal(defense.levels.length, 2);
    assert.deepEqual(defense.levels.map(function (level) { return level.level; }), [1, 2]);
    assert.equal(defense.specializationIds.length, 2);
    defense.specializationIds.forEach(function (specializationId) {
      const branch = content.specializations[specializationId];
      assert.ok(branch, specializationId + " resolves exactly once");
      assert.equal(branch.defenseId, id);
    });
    const defaults = defense.specializationIds.filter(function (specializationId) {
      return content.specializations[specializationId].isDefault;
    });
    assert.equal(defaults.length, 1, id + " has exactly one default branch");
  });
  Object.keys(content.specializations).forEach(function (id) {
    const branch = content.specializations[id];
    assert.deepEqual(Object.keys(branch).sort(), [
      "behaviors", "branchRoleId", "defenseId", "id", "isDefault", "level", "nameKey", "purchase",
      "rangeWorldUnits", "ui", "unlockGrantId",
    ]);
    assert.equal(branch.level, 3);
    assert.equal(branch.purchase.kind, "specialize");
    const binding = RuleCatalog.BINDING_SOURCES.specializations.records.find(function (record) {
      return record.id === id;
    });
    assert.equal(branch.purchase.costAether, binding.level3CostAether, id + " charges level3CostAether");
    assert.equal(branch.isDefault, binding.isDefault, id + " default parity");
    assert.equal(branch.branchRoleId, binding.branchRoleId);
    assert.equal(branch.unlockGrantId, binding.unlockGrantId);
  });

  assert.deepEqual(Object.keys(content.missions).sort(), ["m01", "m04", "m05"]);
  Object.keys(content.missions).forEach(function (id) {
    const mission = content.missions[id];
    assert.ok(Object.prototype.hasOwnProperty.call(mission, "protocolLoan"));
    assert.ok(Object.prototype.hasOwnProperty.call(mission, "mechanism"));
    assert.ok(Object.prototype.hasOwnProperty.call(mission, "reinforcementMarkers"));
    const progression = content.missionProgression.find(function (record) { return record.missionId === id; });
    const expected = progression.loanProtocolIds;
    const actual = mission.protocolLoan === null ? [] : [mission.protocolLoan.protocolId];
    assert.deepEqual(actual, expected, id + " loan matches the approved progression binding");
  });
  assert.deepEqual(content.missions.m05.protocolLoan, { protocolId: "temporal-edict", tier: 1 });

  assert.equal(content.protocols.length, 10);
  assert.equal(content.relics.length, 8);
  assert.equal(content.reinforcements.length, 3);
  assert.equal(content.mechanisms.length, 5);
  assert.equal(content.missionProgression.length, 20);
  assert.equal(content.protocolRules.maximumSlotCap, 2);
  assert.equal(content.relicRules.maximumSlotCap, 2);
  assert.equal(content.reinforcementRules.maximumActive, 1);
  assert.equal(content.abiHash, "sha256:" + AbiV2.DESCRIPTOR_SHA256);
});

test("compiled acts carry the four-act narrative and agree with every mission actIndex", () => {
  const result = build();
  const content = result.artifacts.content;
  const acts = content.acts;
  assert.deepEqual(Object.keys(acts).sort(), ["reconRecords", "records", "schemaVersion"]);
  assert.equal(acts.schemaVersion, 1);
  assert.equal(acts.records.length, 4);
  assert.deepEqual(acts.records.map(function (record) { return record.index; }), [1, 2, 3, 4]);
  acts.records.forEach(function (record) {
    assert.deepEqual(Object.keys(record).sort(), [
      "eraKey", "index", "missionIds", "premiseKey", "storyKey", "titleKey",
    ]);
  });
  assert.deepEqual(acts.records[0].missionIds, ["m01", "m04", "m05"]);
  assert.deepEqual(acts.records[1].missionIds, []);
  assert.deepEqual(acts.records[2].missionIds, []);
  assert.deepEqual(acts.records[3].missionIds, []);
  Object.keys(content.missions).forEach(function (missionId) {
    const actIndex = content.missions[missionId].actIndex;
    const act = acts.records.find(function (record) { return record.index === actIndex; });
    assert.ok(act, missionId + " resolves an act");
    assert.ok(act.missionIds.indexOf(missionId) !== -1, missionId + " is listed by its own act");
  });
  const claimed = acts.records.reduce(function (total, record) { return total + record.missionIds.length; }, 0);
  assert.equal(claimed, Object.keys(content.missions).length, "no mission is missing or duplicated");

  assert.deepEqual(acts.reconRecords.map(function (record) { return record.tier; }), [0, 1, 2, 3]);
  acts.reconRecords.forEach(function (record) {
    assert.deepEqual(Object.keys(record).sort(), ["detailKey", "tier"]);
  });

  /* Every narrative key resolves in the shipped presentation companion. */
  const strings = new Map(result.artifacts.presentation.strings.map(function (entry) {
    return [entry.key, entry.value];
  }));
  acts.records.forEach(function (record) {
    ["titleKey", "eraKey", "storyKey", "premiseKey"].forEach(function (field) {
      assert.ok(strings.has(record[field]), record[field] + " resolves");
      assert.ok(strings.get(record[field]).length > 0, record[field] + " is not empty");
    });
  });
  acts.reconRecords.forEach(function (record) {
    assert.ok(strings.has(record.detailKey), record.detailKey + " resolves");
  });
  Object.keys(content.missions).forEach(function (missionId) {
    const mission = content.missions[missionId];
    assert.ok(strings.has(mission.briefing.storyKey), missionId + " story resolves");
    mission.waves.forEach(function (wave) {
      assert.ok(strings.has(wave.noteKey), wave.id + " note resolves");
    });
  });

  /* Spec 18.4: no em dash reaches a player through compiled narrative copy. */
  Array.from(strings.values()).forEach(function (value) {
    assert.equal(value.indexOf(String.fromCharCode(8212)), -1, "em dash in " + value);
  });
});

test("act narrative stays out of the simulation lock tree and every ruleset input beyond content bytes", () => {
  const result = build();
  assert.deepEqual(
    Object.keys(result.resolved.lockTree).sort(),
    [
      "bosses", "campaignRules", "defenses", "enemies", "eventCatalog", "maps", "missions",
      "schemaVersion", "specializations", "summons",
    ],
    "the annex-covered lock tree gains no narrative collection"
  );
  assert.equal(Object.prototype.hasOwnProperty.call(result.resolved.lockTree, "acts"), false);
  const encodedTree = JSON.stringify(result.resolved.lockTree);
  ["act.1.era", "act.1.story", "act.1.premise", "recon.0.detail"].forEach(function (key) {
    assert.equal(encodedTree.indexOf(key), -1, key + " never enters the lock tree");
  });
});

test("the act catalog and its narrative keys fail closed on drift", () => {
  const preflight = build().source;
  function graph(mutate) {
    const draft = JSON.parse(JSON.stringify({
      manifest: preflight.manifest,
      normalizedSource: preflight.normalizedSource,
    }));
    mutate(draft.normalizedSource);
    return function () {
      V4CrossReferences.resolveV4Graph(draft, {
        normalizeAndValidateMap: V3MapAdapter.normalizeAndValidateMap,
      });
    };
  }

  /* The unmodified graph is the control: every assertion below is about the mutation. */
  assert.doesNotThrow(graph(function () {}));

  expectDiagnostic(graph(function (source) {
    source.acts.records[0].missionIds = ["m01", "m05"];
  }), "V4_ACT_BINDING");
  expectDiagnostic(graph(function (source) {
    source.acts.records[1].missionIds = source.acts.records[0].missionIds;
    source.acts.records[0].missionIds = [];
  }), "V4_ACT_BINDING");
  expectDiagnostic(graph(function (source) {
    source.acts.records[0].storyKey = "act.1.absent";
  }), "REFERENCE_UNKNOWN");
  expectDiagnostic(graph(function (source) {
    source.acts.reconRecords[2].detailKey = "recon.2.absent";
  }), "REFERENCE_UNKNOWN");
  /* Every authored narrative string must be reachable: an orphaned wave note is rejected. */
  expectDiagnostic(graph(function (source) {
    source.missions[0].definition.waves[0].noteKey = source.missions[0].definition.waves[1].noteKey;
  }), "STRING_UNUSED");
  expectDiagnostic(graph(function (source) {
    source.missions[0].definition.briefing.storyKey = "m01.absent";
  }), "REFERENCE_UNKNOWN");
});

test("the v4 release record is a developer-only descriptor with authenticated identities", () => {
  const result = build();
  const release = result.artifacts.manifest;
  assert.deepEqual(Object.keys(release).sort(), V4Artifacts.RELEASE_KEYS.slice());
  assert.equal(release.schemaVersion, 4);
  assert.equal(release.abiVersion, 2);
  assert.equal(release.approvalState, "candidate-balance");
  assert.equal(release.releaseEligible, false);
  assert.equal(release.developerOnly, true);
  assert.deepEqual(release.contentIds, ["m01", "m04", "m05"]);
  assert.deepEqual(release.requiredGlobals, V4Compiler.REQUIRED_GLOBALS.slice());
  assert.deepEqual(Object.keys(release.includedIds).sort(), V4Artifacts.INCLUDED_ID_PARTITIONS.slice());
  assert.equal(release.includedIds.defenses.length, 15);
  assert.equal(release.includedIds.specializations.length, 30);
  assert.equal(release.abiHash, "sha256:" + AbiV2.DESCRIPTOR_SHA256);
  assert.equal(release.annexHash, JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8")).annex.sha256);
  assert.equal(release.sourceManifestHash, result.source.manifestHash);
  assert.ok(release.sourceProvenance.length >= Object.keys(result.source.normalizedSource).length);

  const entries = new Map(Array.from(result.artifacts.outputs));
  const releaseName = result.artifacts.releaseName;
  const manifestName = result.artifacts.manifestName;
  const verified = V4Artifacts.verifyV4ReleaseSelection({
    pinnedReleaseName: releaseName,
    releaseName: releaseName,
    releaseBytes: entries.get(releaseName),
    manifestBytes: entries.get(manifestName),
    artifacts: entries,
  });
  assert.equal(verified.release.rulesetHash, result.artifacts.rulesetHash);
  assert.equal(verified.content.schemaVersion, 4);
  assert.equal(verified.presentation.schemaVersion, 2);
  assert.equal(verified.bindings.descriptorSha256, AbiV2.DESCRIPTOR_SHA256);

  expectDiagnostic(function () {
    V4Artifacts.verifyV4ReleaseSelection({
      pinnedReleaseName: releaseName,
      releaseName: releaseName,
      releaseBytes: entries.get(releaseName),
      manifestBytes: entries.get(manifestName),
      artifacts: entries,
      queryReleaseUrl: "https://example.invalid/release.js",
    });
  }, "V4_RELEASE_SELECTION");
  expectDiagnostic(function () {
    const corrupted = new Map(entries);
    corrupted.set(release.contentArtifact, Buffer.from("/* tampered */\n", "utf8"));
    V4Artifacts.verifyV4ReleaseSelection({
      pinnedReleaseName: releaseName,
      releaseName: releaseName,
      releaseBytes: entries.get(releaseName),
      artifacts: corrupted,
    });
  }, "V4_ARTIFACT_CORRUPT");
  expectDiagnostic(function () {
    const promoted = Object.assign({}, release, { approvalState: "production-approved" });
    V4Artifacts.validateV4ReleaseRecord(promoted);
  }, "V4_RELEASE_RECORD");
});

test("the presentation companion v2 uses semantic fallbacks and declares no raster art", () => {
  const presentation = build().artifacts.presentation;
  assert.equal(presentation.schemaVersion, 2);
  assert.equal(presentation.contentVersion, "candidate-v4");
  assert.deepEqual(presentation.assetRecords, []);
  assert.deepEqual(presentation.placementRecords, []);
  assert.deepEqual(
    presentation.packRecords.map(function (record) { return record.id; }),
    ["pack.m01", "pack.m04", "pack.m05"]
  );
  presentation.cueMappings.forEach(function (record) {
    assert.equal(record.kind, "asset-or-fallback");
    assert.equal(record.assetId, null);
    assert.equal(record.frameId, null);
    assert.equal(record.fallbackStyleId, "ancient-greece-ai-procedural");
  });
  assert.ok(presentation.strings.length > 200, "every referenced localization key is companion-owned");
});

test("the schema-4 alias is developer-only and the public slice-dev-v1 route is unchanged", () => {
  const result = build();
  const alias = Compiler.releaseAliasEntries(result);
  assert.deepEqual(alias.map(function (entry) { return entry[0]; }), [
    "release.candidate-v4.js",
    "release.candidate-v4.json",
  ]);
  const record = JSON.parse(alias[1][1].toString("utf8"));
  Compiler.validateReleaseAliasRecord(record, "candidate-v4");
  assert.equal(record.contentVersion, "candidate-v4");
  assert.equal(record.approvalState, "candidate-balance");
  assert.equal(record.releaseEligible, false);
  assert.equal(record.releaseArtifact, result.artifacts.releaseName);
  assert.equal(record.releaseHash, "sha256:" + sha256Hex(new Map(Array.from(result.artifacts.outputs)).get(result.artifacts.releaseName)));

  const candidate = ReleaseSelector.RELEASES["candidate-v4"];
  if (candidate !== undefined) {
    assert.equal(candidate.developerOnly, true, "candidate-v4 stays developer-only");
    assert.equal(candidate.channel, "developer");
    assert.equal(candidate.artifactPaths.releaseRecord, "content/generated/release.candidate-v4.js");
    assert.throws(function () { ReleaseSelector.selectRelease({ releaseId: "candidate-v4" }); });
  }
  assert.notEqual(ReleaseSelector.DEFAULT_RELEASE_ID, "candidate-v4");
  const sliceDev = ReleaseSelector.RELEASES["slice-dev-v1"];
  assert.equal(sliceDev.artifactPaths.releaseRecord, "content/generated/release.slice-dev-v1.js");
  assert.deepEqual(sliceDev.contentIds, ["m01", "m04", "m05"]);
  const sliceAlias = JSON.parse(fs.readFileSync(
    path.join(REPO_ROOT, "games", "aegis", "content", "generated", "release.slice-dev-v1.json"), "utf8"
  ));
  assert.equal(sliceAlias.contentVersion, "slice-dev-v1");
  assert.notEqual(sliceAlias.releaseArtifact, result.artifacts.releaseName);
  assert.equal(
    ReleaseSelector.selectRelease({ releaseId: "slice-dev-v1", developer: true }).id,
    "slice-dev-v1"
  );
  assert.equal(ReleaseSelector.selectRelease({}).id, "legacy-proving-ground");
});

test("schema-4 output round-trips deterministically and its real release is committed", () => {
  const result = build();
  const output = path.join(REPO_ROOT, "games", "aegis", "content", "generated");
  const names = Array.from(result.artifacts.outputs).map(function (entry) { return entry[0]; });

  /* This build deliberately uses the synthetic ABI-v2 identity fixture as its simulation seam.
     Content and presentation artifacts do not depend on that seam, so they are byte-identical to
     the committed production ones; the release artifact frames the simulation bytes, so its
     identity differs and the fixture-seam release must never be committed. The real candidate-v4
     release is built by tools/build-aegis-content.js against the complete twenty-module bundle. */
  const fixtureReleaseNames = names.filter(function (name) {
    return name.indexOf("aegis-release.") === 0;
  });
  assert.equal(fixtureReleaseNames.length, 1);
  assert.equal(
    fs.existsSync(path.join(output, fixtureReleaseNames[0])),
    false,
    fixtureReleaseNames[0] + " is a fixture-seam release and must never be committed"
  );

  const alias = JSON.parse(fs.readFileSync(path.join(output, "release.candidate-v4.json"), "utf8"));
  assert.equal(alias.id, "candidate-v4");
  assert.equal(alias.contentVersion, "candidate-v4");
  assert.equal(alias.approvalState, "candidate-balance");
  assert.equal(alias.releaseEligible, false);
  assert.match(alias.releaseHash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(alias.releaseArtifact, "aegis-release." + alias.releaseHash.slice("sha256:".length) + ".js");
  assert.equal(fs.existsSync(path.join(output, alias.releaseArtifact)), true,
    "the committed candidate-v4 alias must resolve to a committed immutable release artifact");
  assert.equal(fs.existsSync(path.join(output, "release.candidate-v4.js")), true);
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "aegis-v4-generated-"));
  try {
    const written = Compiler.writeArtifacts(result, temporary);
    assert.deepEqual(written.slice().sort(), names.concat([
      "release.candidate-v4.js", "release.candidate-v4.json",
    ]).sort());
    assert.deepEqual(Compiler.checkArtifacts(result, temporary).slice().sort(), written.slice().sort());
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});

test("reinforcement markers and mechanism activations obey the authored map grammar", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aegis-v4-markers-"));
  t.after(function () { fs.rmSync(root, { recursive: true, force: true }); });
  const contentRoot = path.join(root, "games", "aegis", "content-v4");
  fs.cpSync(CONTENT_V4, contentRoot, { recursive: true });
  ["docs/aegis/architecture-decisions.md"].forEach(function (relative) {
    fs.mkdirSync(path.dirname(path.join(root, relative)), { recursive: true });
    fs.copyFileSync(path.join(REPO_ROOT, relative), path.join(root, relative));
  });
  fs.cpSync(
    path.join(REPO_ROOT, "docs", "superpowers", "specs"),
    path.join(root, "docs", "superpowers", "specs"),
    { recursive: true }
  );

  const missionRelative = path.join("missions", "m04.candidate-v4.json");
  const manifestRelative = path.join("manifests", "candidate-v4.json");
  function compileWith(mutate) {
    const mission = JSON.parse(fs.readFileSync(path.join(CONTENT_V4, missionRelative), "utf8"));
    mutate(mission);
    const bytes = Buffer.from(JSON.stringify(mission, null, 2) + "\n", "utf8");
    fs.writeFileSync(path.join(contentRoot, missionRelative), bytes);
    const manifest = JSON.parse(fs.readFileSync(path.join(CONTENT_V4, manifestRelative), "utf8"));
    manifest.missions[1].definition.sha256 = "sha256:" + sha256Hex(bytes);
    fs.writeFileSync(
      path.join(contentRoot, manifestRelative),
      Buffer.from(JSON.stringify(manifest, null, 2) + "\n", "utf8")
    );
    return Compiler.compileSourceTree({
      sourceRoot: contentRoot,
      repositoryRoot: root,
      manifestPath: path.join(contentRoot, manifestRelative),
      simulationPath: SIMULATION_FIXTURE,
    });
  }

  const legal = compileWith(function (mission) {
    mission.reinforcementMarkers = [
      { id: "marker.m04.ridge", column: 7, row: 12, supportedReinforcementIds: ["artemis-scout", "spartan-phalanx"] },
    ];
  });
  assert.deepEqual(legal.artifacts.content.missions.m04.reinforcementMarkers, [
    { column: 7, id: "marker.m04.ridge", row: 12, supportedReinforcementIds: ["artemis-scout", "spartan-phalanx"] },
  ]);

  expectDiagnostic(function () {
    compileWith(function (mission) {
      mission.reinforcementMarkers = [
        { id: "marker.m04.onroad", column: 8, row: 6, supportedReinforcementIds: ["artemis-scout"] },
      ];
    });
  }, "V4_MARKER_GEOMETRY");
  expectDiagnostic(function () {
    compileWith(function (mission) {
      mission.reinforcementMarkers = [
        { id: "marker.m04.onpad", column: 12, row: 4, supportedReinforcementIds: ["artemis-scout"] },
      ];
    });
  }, "V4_MARKER_GEOMETRY");
  expectDiagnostic(function () {
    compileWith(function (mission) {
      mission.reinforcementMarkers = [
        { id: "marker.m04.ridge", column: 7, row: 12, supportedReinforcementIds: ["not-a-reinforcement"] },
      ];
    });
  }, "V4_MARKER_REINFORCEMENT");
  expectDiagnostic(function () {
    compileWith(function (mission) {
      mission.mechanism = {
        mechanismId: "harbor-chain",
        activations: [{ id: "chain.a", kind: "zone", geometryId: "geometry.absent" }],
      };
    });
  }, "V4_MECHANISM_GEOMETRY");
  expectDiagnostic(function () {
    compileWith(function (mission) {
      mission.protocolLoan = { protocolId: "temporal-edict", tier: 1 };
    });
  }, "V4_PROTOCOL_LOAN_BINDING");
});
