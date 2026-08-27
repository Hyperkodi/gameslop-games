"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const LIB_ROOT = path.join(REPO_ROOT, "tools", "lib", "aegis");
const RECORD_ROOT = path.join(__dirname, "fixtures", "compiler", "v3-records", "valid");
const STRUCTURAL_ROOT = path.join(
  __dirname,
  "fixtures",
  "compiler",
  "v3-loader",
  "valid-v3-structural"
);
const ROLE_MAP_PATH = path.join(__dirname, "fixtures", "map-proofs", "valid-role-map.json");
const Cli = require(path.join(REPO_ROOT, "tools", "analyze-aegis-map.js"));
const { AegisContentError } = require(path.join(LIB_ROOT, "diagnostics.js"));
const { sha256Reference } = require(path.join(LIB_ROOT, "v3-source-loader.js"));

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeBytes(file, bytes) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, bytes);
}

function writeJson(file, value, compact) {
  const bytes = Buffer.from((compact ? JSON.stringify(value) : JSON.stringify(value, null, 2)) + "\n", "utf8");
  writeBytes(file, bytes);
  return bytes;
}

function expectUsage(fn, pattern) {
  assert.throws(fn, function (error) {
    assert.equal(error && error.name, "AegisMapUsageError");
    assert.match(error.message, pattern);
    return true;
  });
}

function expectDiagnostic(fn, code) {
  assert.throws(fn, function (error) {
    assert.ok(error instanceof AegisContentError, error && error.stack);
    assert.equal(error.diagnostics[0].code, code);
    return true;
  });
}

function candidateRepository(t) {
  const repositoryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "aegis-map-analyzer-v3-"));
  const contentRoot = path.join(repositoryRoot, "games", "aegis", "content");
  const candidateRoot = path.join(contentRoot, "candidate-fixture");
  const mapReportDir = path.join(repositoryRoot, "docs", "aegis-balance", "maps");
  const manifestReference = "games/aegis/content/candidate-fixture/manifest.json";
  const alternateManifestReference = "games/aegis/content/candidate-fixture/manifest-alt.json";
  t.after(function () { fs.rmSync(repositoryRoot, { recursive: true, force: true }); });

  const authoritySource = path.join(STRUCTURAL_ROOT, "authority", "slice-spec.md");
  const authorityTarget = path.join(repositoryRoot, "authority", "slice-spec.md");
  writeBytes(authorityTarget, fs.readFileSync(authoritySource));

  function source(relative, value) {
    const bytes = Buffer.isBuffer(value) ? value : Buffer.from(JSON.stringify(value, null, 2) + "\n", "utf8");
    writeBytes(path.join(contentRoot, ...relative.split("/")), bytes);
    return { source: relative, sha256: sha256Reference(bytes) };
  }

  const annex = readJson(path.join(STRUCTURAL_ROOT, "annexes", "slice-dev-v1.json"));
  const defenses = readJson(path.join(RECORD_ROOT, "defenses.json"));
  const hoplite = defenses.records.find(function (record) { return record.id === "hoplite"; });
  ["20", "25", "30"].forEach(function (range, index) {
    hoplite.levels[index].rangeWorldUnits = range;
  });

  const missionIds = ["m01", "m04", "m05"];
  const missionReferences = missionIds.map(function (id) {
    const definition = readJson(path.join(RECORD_ROOT, "missions", id + ".json"));
    definition.mapId = "fixture." + id;
    const map = readJson(ROLE_MAP_PATH);
    map.id = definition.mapId;
    map.title = "Candidate " + id;
    return {
      id: id,
      definition: source("candidate-fixture/missions/" + id + ".json", definition),
      map: Object.assign(
        { schemaVersion: 2 },
        source("candidate-fixture/maps/" + id + ".json", map)
      ),
    };
  });

  const manifest = {
    schemaVersion: 3,
    contentVersion: "candidate-map-test-v1",
    sourceKind: "campaign",
    approvalState: "candidate-balance",
    abiDescriptor: source(
      "candidate-fixture/abi.json",
      fs.readFileSync(path.join(STRUCTURAL_ROOT, "abi", "abi-v1.json"))
    ),
    behaviorContracts: source(
      "candidate-fixture/behaviors.json",
      fs.readFileSync(path.join(STRUCTURAL_ROOT, "behavior-contracts.json"))
    ),
    annex: Object.assign(
      { id: annex.id },
      source("candidate-fixture/annex.json", annex)
    ),
    campaignRules: source("candidate-fixture/campaign-rules.json", readJson(path.join(RECORD_ROOT, "campaign-rules.json"))),
    defenses: source("candidate-fixture/defenses.json", defenses),
    enemies: source("candidate-fixture/enemies.json", readJson(path.join(RECORD_ROOT, "enemies.json"))),
    bosses: source("candidate-fixture/bosses.json", readJson(path.join(RECORD_ROOT, "bosses.json"))),
    eventCatalog: source("candidate-fixture/events.json", readJson(path.join(RECORD_ROOT, "events.json"))),
    stringCatalog: source("candidate-fixture/strings.json", readJson(path.join(RECORD_ROOT, "strings.json"))),
    presentationCatalog: source(
      "candidate-fixture/presentation.json",
      readJson(path.join(RECORD_ROOT, "presentation", "slice-v1.json"))
    ),
    missions: missionReferences,
  };
  writeJson(path.join(candidateRoot, "manifest.json"), manifest, false);
  writeJson(path.join(candidateRoot, "manifest-alt.json"), manifest, true);

  return Object.freeze({
    repositoryRoot: repositoryRoot,
    contentSourceRoot: contentRoot,
    mapReportDir: mapReportDir,
    manifestReference: manifestReference,
    alternateManifestReference: alternateManifestReference,
    context: Object.freeze({
      repositoryRoot: repositoryRoot,
      contentSourceRoot: contentRoot,
      mapReportDir: mapReportDir,
    }),
  });
}

test("manifest selection is one strict repository-contained CLI argument", function () {
  const valid = "games/aegis/content/candidates/candidate-bal-v1.json";
  assert.deepEqual(
    Cli.parseArgs(["--manifest", valid, "--mission", "m01", "--check"]),
    { mission: "m01", all: false, action: "check", manifest: valid }
  );
  assert.deepEqual(
    Cli.parseArgs(["--mission", "m01", "--check"]),
    { mission: "m01", all: false, action: "check" }
  );

  const invalid = [
    "C:/games/aegis/content/candidate.json",
    "/games/aegis/content/candidate.json",
    "games\\aegis\\content\\candidate.json",
    "https://example.test/candidate.json",
    "games/aegis/content/candidate.json?download=1",
    "games/aegis/content/../candidate.json",
    "games/aegis/other/candidate.json",
    "games/aegis/content/candidate.JSON",
    "games/aegis/content//candidate.json",
  ];
  invalid.forEach(function (value) {
    expectUsage(
      function () { Cli.parseArgs(["--manifest", value, "--mission", "m01", "--check"]); },
      /--manifest/
    );
  });
  expectUsage(function () {
    Cli.parseArgs(["--manifest", "--mission", "m01", "--check"]);
  }, /requires one/);
  expectUsage(function () {
    Cli.parseArgs(["--manifest", valid, "--manifest", valid, "--mission", "m01", "--check"]);
  }, /at most one/);
  expectUsage(function () {
    Cli.parseArgs(["--manifest", valid, "--mission", "legacy-proving-ground", "--report-known-issues"]);
  }, /legacy/);
  expectUsage(function () {
    Cli.parseArgs(["--manifest", valid, "--all", "--write"]);
  }, /--all is valid only with --check/);
});

test("v3 source loading validates records and adapts selected maps in manifest order", function (t) {
  const fixture = candidateRepository(t);
  const campaign = Cli.loadCandidateCampaign(fixture.manifestReference, fixture.context);
  assert.equal(campaign.preflight.manifest.schemaVersion, 3);
  assert.equal(campaign.preflight.manifestHash, sha256Reference(
    fs.readFileSync(path.join(fixture.contentSourceRoot, "candidate-fixture", "manifest.json"))
  ));
  assert.deepEqual(Cli.listCandidateMissionIds(campaign), ["m01", "m04", "m05"]);
  assert.equal(Object.isFrozen(campaign.recordSet), true);
  assert.equal(campaign.recordSet.missions[0].id, "m01");

  const analyzed = Cli.analyzeCandidateCampaign("m01", campaign);
  assert.equal(analyzed.validated.schemaVersion, 2);
  assert.equal(analyzed.validated.id, "fixture.m01");
  assert.equal(analyzed.validated.roleProofs.filter(function (proof) {
    return proof.kind === "guard";
  }).length, 3);
  assert.equal(analyzed.artifacts.reportBytes[analyzed.artifacts.reportBytes.length - 1], 0x0a);
  assert.equal(analyzed.artifacts.svgBytes[analyzed.artifacts.svgBytes.length - 1], 0x0a);
  expectDiagnostic(function () { Cli.analyzeCandidateCampaign("m02", campaign); }, "MAP_MISSION_MISSING");
});

test("candidate namespaces bind the content version to the full manifest hash", function (t) {
  const fixture = candidateRepository(t);
  const first = Cli.loadCandidateCampaign(fixture.manifestReference, fixture.context);
  const second = Cli.loadCandidateCampaign(fixture.alternateManifestReference, fixture.context);
  const firstPaths = Cli.candidateArtifactPaths("m01", first);
  const secondPaths = Cli.candidateArtifactPaths("m01", second);
  const namespacePattern = /candidate-map-test-v1\.[0-9a-f]{64}$/;
  assert.match(path.basename(firstPaths.directory), namespacePattern);
  assert.match(path.basename(secondPaths.directory), namespacePattern);
  assert.notEqual(firstPaths.directory, secondPaths.directory);
  assert.equal(firstPaths.directory.startsWith(path.join(fixture.mapReportDir, "candidates") + path.sep), true);
  assert.notEqual(firstPaths.report, Cli.artifactPaths("m01").report);
});

test("candidate write/check isolates both artifacts and --all checks in manifest order", function (t) {
  const fixture = candidateRepository(t);
  const writes = [];
  function io() {
    return {
      stdout: { write: function (value) { writes.push(String(value)); } },
      stderr: { write: function () {} },
    };
  }
  for (const id of ["m01", "m04", "m05"]) {
    const status = Cli.execute(
      Cli.parseArgs(["--manifest", fixture.manifestReference, "--mission", id, "--write"]),
      io(),
      fixture.context
    );
    assert.equal(status, 0);
  }
  const campaign = Cli.loadCandidateCampaign(fixture.manifestReference, fixture.context);
  const paths = Cli.candidateArtifactPaths("m01", campaign);
  assert.equal(fs.existsSync(paths.report), true);
  assert.equal(fs.existsSync(paths.svg), true);
  assert.equal(fs.existsSync(path.join(fixture.mapReportDir, "m01-pad-report.json")), false);

  writes.length = 0;
  assert.equal(Cli.execute(
    Cli.parseArgs(["--manifest", fixture.manifestReference, "--all", "--check"]),
    io(),
    fixture.context
  ), 0);
  assert.deepEqual(writes, [
    "m01: deterministic candidate map report and heatmap are current\n",
    "m04: deterministic candidate map report and heatmap are current\n",
    "m05: deterministic candidate map report and heatmap are current\n",
  ]);

  const artifacts = Cli.analyzeCandidateCampaign("m01", campaign).artifacts;
  fs.appendFileSync(paths.report, " ");
  expectDiagnostic(function () {
    Cli.checkMissionArtifacts("m01", artifacts, paths);
  }, "MAP_ARTIFACT_STALE");
  fs.writeFileSync(paths.report, artifacts.reportBytes);
  fs.appendFileSync(paths.svg, "<!-- stale -->\n");
  expectDiagnostic(function () {
    Cli.checkMissionArtifacts("m01", artifacts, paths);
  }, "MAP_ARTIFACT_STALE");
});
