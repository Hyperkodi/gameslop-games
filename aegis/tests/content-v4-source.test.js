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
const MANIFEST_SOURCE = "manifests/candidate-v4.json";

const Loader = require(path.join(LIB, "v4-source-loader.js"));
const Canonical = require(path.join(LIB, "canonical.js"));
const AbiV2 = require(path.join(REPO_ROOT, "games", "aegis", "js", "sim", "abi-v2.js"));

function sha256Hex(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
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

function temporaryTree() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aegis-v4-source-"));
  fs.cpSync(CONTENT_V4, path.join(root, "games", "aegis", "content-v4"), { recursive: true });
  fs.cpSync(
    path.join(REPO_ROOT, "docs", "aegis", "architecture-decisions.md"),
    path.join(root, "docs", "aegis", "architecture-decisions.md"),
    { recursive: true }
  );
  fs.cpSync(
    path.join(REPO_ROOT, "docs", "superpowers", "specs"),
    path.join(root, "docs", "superpowers", "specs"),
    { recursive: true }
  );
  return root;
}

function preflightTemporary(root) {
  return Loader.preflightV4SourceTree({
    sourceRoot: path.join(root, "games", "aegis", "content-v4"),
    repositoryRoot: root,
    manifestSource: MANIFEST_SOURCE,
  });
}

test("the checked-in candidate-v4 source tree preflights with pinned exact bytes", () => {
  const preflight = Loader.preflightV4SourceTree({
    sourceRoot: CONTENT_V4,
    repositoryRoot: REPO_ROOT,
    manifestSource: MANIFEST_SOURCE,
  });
  assert.equal(preflight.manifest.schemaVersion, 4);
  assert.equal(preflight.manifest.contentVersion, "candidate-v4");
  assert.equal(preflight.manifest.approvalState, "candidate-balance");
  assert.equal(preflight.manifest.sourceKind, "campaign");
  assert.match(preflight.manifestHash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(Object.isFrozen(preflight), true);
  assert.deepEqual(
    preflight.manifest.missions.map(function (mission) { return mission.id; }),
    ["m01", "m04", "m05"]
  );
  assert.deepEqual(
    Object.keys(preflight.normalizedSource.unlocks).sort(),
    ["mechanisms", "progression", "protocols", "reinforcements", "relics", "specializations"]
  );
  Loader.STANDARD_REFERENCE_KEYS.forEach(function (key) {
    const reference = preflight.manifest[key];
    const bytes = fs.readFileSync(path.join(CONTENT_V4, reference.source));
    assert.equal(reference.sha256, "sha256:" + sha256Hex(bytes), key + " pins its exact bytes");
  });
  const declaredSources = preflight.provenance.map(function (record) { return record.source; });
  assert.ok(declaredSources.indexOf("abi/abi-v2.json") >= 0);
  assert.ok(declaredSources.indexOf("progression/binding-v1.json") >= 0);
  assert.equal(
    preflight.repositoryProvenance.length,
    preflight.annex.authorityRecords.length + preflight.annex.evidenceRecords.length
  );
});

test("abi/abi-v2.json is exactly the authenticated ABI v2 descriptor identity", () => {
  const bytes = fs.readFileSync(path.join(CONTENT_V4, "abi", "abi-v2.json"));
  assert.equal(sha256Hex(bytes), AbiV2.DESCRIPTOR_SHA256);
  assert.equal(bytes.toString("utf8"), AbiV2.DESCRIPTOR_CANONICAL);
  const parsed = JSON.parse(bytes.toString("utf8"));
  assert.equal(parsed.version, 2);
  assert.equal(parsed.commands.schemaVersion, 2);
  assert.equal(parsed.semanticEvents.schemaVersion, 2);
  assert.equal(parsed.behaviorRegistry.version, 2);
  assert.equal(parsed.replay.formatVersion, 2);
  assert.equal(parsed.phaseOrder.length, 10);
  assert.equal(sha256Hex(Buffer.from(Canonical.canonicalEncode(parsed), "utf8")), AbiV2.DESCRIPTOR_SHA256);
  const manifest = JSON.parse(fs.readFileSync(path.join(CONTENT_V4, MANIFEST_SOURCE), "utf8"));
  assert.equal(manifest.abiDescriptor.sha256, "sha256:" + AbiV2.DESCRIPTOR_SHA256);
});

test("v4 preflight fails closed on drifted bytes, unknown manifest keys, and missing sources", (t) => {
  const root = temporaryTree();
  t.after(function () { fs.rmSync(root, { recursive: true, force: true }); });
  const contentRoot = path.join(root, "games", "aegis", "content-v4");
  assert.equal(preflightTemporary(root).manifest.contentVersion, "candidate-v4");

  const defensesPath = path.join(contentRoot, "defenses", "candidate-v4.json");
  const originalDefenses = fs.readFileSync(defensesPath);
  const drifted = JSON.parse(originalDefenses.toString("utf8"));
  drifted.records[0].levels[0].purchase.costAether += 1;
  fs.writeFileSync(defensesPath, JSON.stringify(drifted, null, 2) + "\n");
  expectDiagnostic(function () { preflightTemporary(root); }, "SOURCE_HASH_MISMATCH");
  fs.writeFileSync(defensesPath, originalDefenses);

  const manifestPath = path.join(contentRoot, MANIFEST_SOURCE);
  const originalManifest = fs.readFileSync(manifestPath);
  const unknown = JSON.parse(originalManifest.toString("utf8"));
  unknown.unexpectedReference = { source: "defenses/candidate-v4.json", sha256: unknown.defenses.sha256 };
  fs.writeFileSync(manifestPath, JSON.stringify(unknown, null, 2) + "\n");
  expectDiagnostic(function () { preflightTemporary(root); }, "SCHEMA_UNKNOWN_KEY");

  const missing = JSON.parse(originalManifest.toString("utf8"));
  delete missing.protocols;
  fs.writeFileSync(manifestPath, JSON.stringify(missing, null, 2) + "\n");
  expectDiagnostic(function () { preflightTemporary(root); }, "SCHEMA_MISSING_KEY");

  const escaped = JSON.parse(originalManifest.toString("utf8"));
  escaped.defenses.source = "../content/defenses/slice-v1.json";
  fs.writeFileSync(manifestPath, JSON.stringify(escaped, null, 2) + "\n");
  expectDiagnostic(function () { preflightTemporary(root); }, "SOURCE_REFERENCE");

  const absent = JSON.parse(originalManifest.toString("utf8"));
  absent.defenses.source = "defenses/absent.json";
  fs.writeFileSync(manifestPath, JSON.stringify(absent, null, 2) + "\n");
  expectDiagnostic(function () { preflightTemporary(root); }, "SOURCE_READ");
  fs.writeFileSync(manifestPath, originalManifest);

  const annexPath = path.join(contentRoot, "annexes", "candidate-v4.json");
  const originalAnnex = fs.readFileSync(annexPath);
  const promoted = JSON.parse(originalAnnex.toString("utf8"));
  promoted.approvalState = "balance-approved";
  fs.writeFileSync(annexPath, JSON.stringify(promoted, null, 2) + "\n");
  expectDiagnostic(function () { preflightTemporary(root); }, "SOURCE_HASH_MISMATCH");
  fs.writeFileSync(annexPath, originalAnnex);
  assert.equal(preflightTemporary(root).manifest.contentVersion, "candidate-v4");
});

test("the candidate-v4 annex pins the 2026-08-29 specification and stays Candidate-BAL", () => {
  const annex = JSON.parse(fs.readFileSync(path.join(CONTENT_V4, "annexes", "candidate-v4.json"), "utf8"));
  assert.equal(annex.approvalState, "candidate-balance");
  assert.equal(annex.evidenceRecords.length, 0);
  const authorityPaths = annex.authorityRecords.map(function (record) { return record.repositoryPath; });
  assert.ok(
    authorityPaths.indexOf(
      "docs/superpowers/specs/2026-08-29-armara-aegis-divine-protocols-and-unlocks.md"
    ) >= 0,
    "the unlock specification is a pinned authority"
  );
  annex.authorityRecords.forEach(function (record) {
    const bytes = fs.readFileSync(path.join(REPO_ROOT, record.repositoryPath));
    assert.equal(record.sha256, "sha256:" + sha256Hex(bytes), record.id + " pins its exact bytes");
  });
  assert.ok(annex.bindingLocks.length > 0, "cost and rule identities are binding, not candidate");
  annex.bindingLocks.forEach(function (record) {
    assert.ok(
      annex.authorityRecords.some(function (authority) { return authority.id === record.authorityId; }),
      record.id + " resolves its authority"
    );
  });
  assert.ok(annex.candidateScopes.length > 0, "reviewed numeric scopes are declared Candidate-BAL");
});
