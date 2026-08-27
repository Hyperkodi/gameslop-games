"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const LIB = path.join(REPO_ROOT, "tools", "lib", "aegis");
const FIXTURE = path.join(
  __dirname,
  "fixtures",
  "compiler",
  "v3-loader",
  "valid-v3-structural"
);
const { AegisContentError } = require(path.join(LIB, "diagnostics.js"));
const {
  MAX_SOURCE_BYTES,
  parseV3JsonBytes,
  preflightV3SourceTree,
  sha256Reference,
  validateV3SourceManifest,
} = require(path.join(LIB, "v3-source-loader.js"));
const {
  canonicalValueHash,
  validateAnnex,
  validateCanonicalJsonPointer,
  validateLockCoverage,
  validateNormalizedLockTree,
} = require(path.join(LIB, "v3-annex.js"));

function expectDiagnostic(fn, code, diagnosticPath) {
  assert.throws(fn, function (error) {
    assert.ok(error instanceof AegisContentError, String(error));
    assert.equal(error.diagnostics[0].code, code);
    if (diagnosticPath !== undefined) assert.equal(error.diagnostics[0].path, diagnosticPath);
    return true;
  });
}

function temporaryFixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aegis-v3-loader-"));
  fs.cpSync(FIXTURE, root, { recursive: true });
  t.after(function () { fs.rmSync(root, { recursive: true, force: true }); });
  return root;
}

function readJson(root, relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, ...relativePath.split("/")), "utf8"));
}

function writeJson(root, relativePath, value) {
  fs.writeFileSync(
    path.join(root, ...relativePath.split("/")),
    JSON.stringify(value, null, 2) + "\n"
  );
}

function manifest(root) {
  return readJson(root, "schema-version.json");
}

function writeManifest(root, value) {
  writeJson(root, "schema-version.json", value);
}

function rehashReference(root, reference) {
  reference.sha256 = sha256Reference(
    fs.readFileSync(path.join(root, ...reference.source.split("/")))
  );
}

function annex(root) {
  return readJson(root, "annexes/slice-dev-v1.json");
}

function writeAnnexAndRehashManifest(root, value) {
  writeJson(root, "annexes/slice-dev-v1.json", value);
  const sourceManifest = manifest(root);
  rehashReference(root, sourceManifest.annex);
  writeManifest(root, sourceManifest);
}

function syntheticLockTree() {
  return {
    schemaVersion: 1,
    campaignRules: { id: "slice-rules-v1", refundBp: 7000 },
    defenses: {
      sentinel: {
        id: "sentinel",
        levels: [
          { level: 1, cost: 60 },
          { level: 2, cost: 55 },
        ],
      },
    },
    summons: {},
    enemies: { scout: { id: "scout", hp: 24 } },
    bosses: {},
    missions: {
      m01: { id: "m01", waves: [{ id: "w01", grant: 30 }] },
    },
    maps: { m01: { id: "m01", route: { length: 260000 } } },
    eventCatalog: {},
  };
}

function structuralAnnex() {
  return annex(FIXTURE);
}

const SEMANTIC_ARRAY_PATHS = new Set([
  "/defenses/sentinel/levels",
  "/missions/m01/waves",
]);

test("v3 preflight hash-checks every declared source including presentation and emits no artifacts", () => {
  const tree = syntheticLockTree();
  const result = preflightV3SourceTree({
    sourceRoot: FIXTURE,
    repositoryRoot: FIXTURE,
    normalizedLockTree: tree,
    semanticArrayPaths: SEMANTIC_ARRAY_PATHS,
  });
  assert.equal(result.preflightOnly, true);
  assert.equal(result.manifest.schemaVersion, 3);
  assert.equal(result.normalizedSource.presentationCatalog.id, "slice-presentation-v1");
  assert.equal(result.provenance.some(function (entry) {
    return entry.kind === "presentationCatalog" &&
      entry.source === "presentation/slice-v1.json";
  }), true);
  assert.equal(result.artifacts, undefined);
  assert.equal(result.rulesetHash, undefined);
  assert.equal(result.lockCoverageStatus, "validated");
  assert.equal(result.lockCoverage.coveredLeafCount > 0, true);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.normalizedSource.missions[0].mapProofSupplement), true);
  assert.deepEqual(
    Buffer.from(result.verifiedRawSources.abiDescriptorBase64, "base64"),
    fs.readFileSync(path.join(FIXTURE, "abi", "abi-v1.json"))
  );

  assert.equal(validateNormalizedLockTree(tree), tree);
  const coverage = validateLockCoverage(structuralAnnex(), tree, {
    semanticArrayPaths: SEMANTIC_ARRAY_PATHS,
  });
  assert.equal(coverage.coveredLeafCount > 0, true);
  assert.equal(Object.isFrozen(coverage), true);
});

test("v3 manifest and all reference discriminators are exact and ordered", (t) => {
  let value = manifest(FIXTURE);
  delete value.presentationCatalog;
  expectDiagnostic(
    function () { validateV3SourceManifest(value); },
    "SCHEMA_MISSING_KEY",
    "/presentationCatalog"
  );

  value = manifest(FIXTURE);
  value.surprise = true;
  expectDiagnostic(
    function () { validateV3SourceManifest(value); },
    "SCHEMA_UNKNOWN_KEY",
    "/surprise"
  );

  value = manifest(FIXTURE);
  delete value.presentationCatalog.sha256;
  expectDiagnostic(
    function () { validateV3SourceManifest(value); },
    "SCHEMA_MISSING_KEY",
    "/presentationCatalog/sha256"
  );

  value = manifest(FIXTURE);
  value.presentationCatalog.extra = true;
  expectDiagnostic(
    function () { validateV3SourceManifest(value); },
    "SCHEMA_UNKNOWN_KEY",
    "/presentationCatalog/extra"
  );

  value = manifest(FIXTURE);
  delete value.missions[0].mapProofSupplement;
  expectDiagnostic(
    function () { validateV3SourceManifest(value); },
    "SCHEMA_MISSING_KEY",
    "/missions/0/mapProofSupplement"
  );

  value = manifest(FIXTURE);
  value.missions[0].map.schemaVersion = 2;
  expectDiagnostic(
    function () { validateV3SourceManifest(value); },
    "SCHEMA_UNKNOWN_KEY",
    "/missions/0/mapProofSupplement"
  );

  value = manifest(FIXTURE);
  value.missions.push(JSON.parse(JSON.stringify(value.missions[0])));
  value.missions[1].id = "m00";
  expectDiagnostic(
    function () { validateV3SourceManifest(value); },
    "SCHEMA_UNSTABLE_ORDER",
    "/missions/1/id"
  );

  const root = temporaryFixture(t);
  value = manifest(root);
  value.bosses.source = value.enemies.source;
  value.bosses.sha256 = value.enemies.sha256;
  writeManifest(root, value);
  expectDiagnostic(
    function () { preflightV3SourceTree({ sourceRoot: root, repositoryRoot: root }); },
    "SCHEMA_DUPLICATE_SOURCE",
    "/bosses/source"
  );
});

test("raw SHA-256 is checked before strict parsing and binds line endings and final newlines", (t) => {
  let root = temporaryFixture(t);
  const presentationPath = path.join(root, "presentation", "slice-v1.json");
  fs.appendFileSync(presentationPath, "not-json");
  expectDiagnostic(
    function () { preflightV3SourceTree({ sourceRoot: root, repositoryRoot: root }); },
    "SOURCE_HASH_MISMATCH",
    "/presentationCatalog/sha256"
  );
  let value = manifest(root);
  rehashReference(root, value.presentationCatalog);
  writeManifest(root, value);
  expectDiagnostic(
    function () { preflightV3SourceTree({ sourceRoot: root, repositoryRoot: root }); },
    "JSON_PARSE"
  );

  root = temporaryFixture(t);
  const stringsPath = path.join(root, "strings", "en.slice-v1.json");
  const original = fs.readFileSync(stringsPath, "utf8");
  fs.writeFileSync(stringsPath, original.replace(/\n/g, "\r\n"));
  expectDiagnostic(
    function () { preflightV3SourceTree({ sourceRoot: root, repositoryRoot: root }); },
    "SOURCE_HASH_MISMATCH",
    "/stringCatalog/sha256"
  );

  root = temporaryFixture(t);
  const bossesPath = path.join(root, "bosses", "slice-v1.json");
  const bossesBytes = fs.readFileSync(bossesPath);
  assert.equal(bossesBytes[bossesBytes.length - 1], 0x0a);
  fs.writeFileSync(bossesPath, bossesBytes.subarray(0, bossesBytes.length - 1));
  expectDiagnostic(
    function () { preflightV3SourceTree({ sourceRoot: root, repositoryRoot: root }); },
    "SOURCE_HASH_MISMATCH",
    "/bosses/sha256"
  );

  root = temporaryFixture(t);
  value = manifest(root);
  value.abiDescriptor.sha256 = value.abiDescriptor.sha256.toUpperCase();
  writeManifest(root, value);
  expectDiagnostic(
    function () { preflightV3SourceTree({ sourceRoot: root, repositoryRoot: root }); },
    "SOURCE_HASH_FORMAT",
    "/abiDescriptor/sha256"
  );
});

test("v3 JSON applies the one-MiB, depth-32, field-64, and negative-zero limits", () => {
  assert.equal(parseV3JsonBytes(Buffer.from('{"ok":1}'), "ok.json").ok, 1);
  expectDiagnostic(
    function () { parseV3JsonBytes(Buffer.alloc(MAX_SOURCE_BYTES + 1, 0x20), "large.json"); },
    "SOURCE_SIZE",
    "/"
  );
  expectDiagnostic(
    function () {
      parseV3JsonBytes(
        Buffer.from("[".repeat(34) + "0" + "]".repeat(34)),
        "deep.json"
      );
    },
    "JSON_DEPTH"
  );
  const fields = [];
  for (let index = 0; index < 65; index++) fields.push('"k' + index + '":0');
  expectDiagnostic(
    function () { parseV3JsonBytes(Buffer.from("{" + fields.join(",") + "}"), "fields.json"); },
    "JSON_OBJECT_FIELDS",
    "/k64"
  );
  expectDiagnostic(
    function () { parseV3JsonBytes(Buffer.from('{"value":-0}'), "negative-zero.json"); },
    "JSON_NUMBER_NEGATIVE_ZERO",
    "/value"
  );
  expectDiagnostic(
    function () { parseV3JsonBytes(Buffer.from('{"value":1e3}'), "exponent.json"); },
    "JSON_NUMBER_FORMAT",
    "/value"
  );
  expectDiagnostic(
    function () {
      parseV3JsonBytes(Buffer.from([0xef, 0xbb, 0xbf, 0x7b, 0x7d]), "bom.json");
    },
    "JSON_BOM",
    "/"
  );
  expectDiagnostic(
    function () {
      parseV3JsonBytes(Buffer.from([0x7b, 0x22, 0x78, 0x22, 0x3a, 0xc0, 0xaf, 0x7d]), "utf8.json");
    },
    "JSON_UTF8",
    "/"
  );
  expectDiagnostic(
    function () { parseV3JsonBytes(Buffer.from('{"a":1,"\\u0061":2}'), "duplicate.json"); },
    "JSON_DUPLICATE_KEY",
    "/a"
  );
  expectDiagnostic(
    function () { parseV3JsonBytes(Buffer.from('{"value":9007199254740992}'), "unsafe.json"); },
    "JSON_NUMBER_UNSAFE",
    "/value"
  );
  expectDiagnostic(
    function () { parseV3JsonBytes(Buffer.from('{"value":1.0000}'), "decimal.json"); },
    "JSON_NUMBER_FORMAT",
    "/value"
  );
});

test("reference paths fail closed on aliases, escapes, extensions, missing files, and special targets", (t) => {
  const cases = [
    ["", "SOURCE_REFERENCE"],
    ["../outside.json", "SOURCE_REFERENCE"],
    ["presentation/./slice-v1.json", "SOURCE_REFERENCE"],
    ["presentation/%73lice-v1.json", "SOURCE_REFERENCE"],
    ["presentation/slice-v1.JSON", "SOURCE_REFERENCE"],
    ["presentation\\slice-v1.json", "SOURCE_REFERENCE"],
    ["C:relative.json", "SOURCE_REFERENCE"],
    ["presentation/missing.json", "SOURCE_READ"],
  ];
  cases.forEach(function (entry) {
    const root = temporaryFixture(t);
    const value = manifest(root);
    value.presentationCatalog.source = entry[0];
    writeManifest(root, value);
    expectDiagnostic(
      function () { preflightV3SourceTree({ sourceRoot: root, repositoryRoot: root }); },
      entry[1],
      "/presentationCatalog/source"
    );
  });

  const root = temporaryFixture(t);
  fs.mkdirSync(path.join(root, "presentation", "directory.json"));
  const value = manifest(root);
  value.presentationCatalog.source = "presentation/directory.json";
  writeManifest(root, value);
  expectDiagnostic(
    function () { preflightV3SourceTree({ sourceRoot: root, repositoryRoot: root }); },
    "SOURCE_SPECIAL_FILE",
    "/presentationCatalog/source"
  );
});

test("symlinked path components and duplicate physical files are rejected", async (t) => {
  await t.test("symlink", function (subtest) {
    const root = temporaryFixture(subtest);
    const linked = path.join(root, "linked-presentation.json");
    try {
      fs.symlinkSync(path.join(root, "presentation", "slice-v1.json"), linked, "file");
    } catch (error) {
      if (["EPERM", "EACCES", "ENOSYS"].includes(error && error.code)) {
        subtest.skip("File symlinks are unavailable on this platform");
        return;
      }
      throw error;
    }
    const value = manifest(root);
    value.presentationCatalog.source = "linked-presentation.json";
    writeManifest(root, value);
    expectDiagnostic(
      function () { preflightV3SourceTree({ sourceRoot: root, repositoryRoot: root }); },
      "SOURCE_SYMLINK",
      "/presentationCatalog/source"
    );
  });

  await t.test("hard link identity", function (subtest) {
    const root = temporaryFixture(subtest);
    const alias = path.join(root, "presentation", "alias.json");
    try {
      fs.linkSync(path.join(root, "presentation", "slice-v1.json"), alias);
    } catch (error) {
      if (["EPERM", "EACCES", "ENOSYS"].includes(error && error.code)) {
        subtest.skip("Hard links are unavailable on this platform");
        return;
      }
      throw error;
    }
    const value = manifest(root);
    value.stringCatalog.source = "presentation/alias.json";
    value.stringCatalog.sha256 = value.presentationCatalog.sha256;
    writeManifest(root, value);
    expectDiagnostic(
      function () { preflightV3SourceTree({ sourceRoot: root, repositoryRoot: root }); },
      "SOURCE_DUPLICATE_REALPATH",
      "/presentationCatalog/source"
    );
  });
});

test("annex identity, approval, ordering, authority references, and evidence gates are exact", (t) => {
  let root = temporaryFixture(t);
  let value = annex(root);
  value.id = "different-annex";
  writeAnnexAndRehashManifest(root, value);
  expectDiagnostic(
    function () { preflightV3SourceTree({ sourceRoot: root, repositoryRoot: root }); },
    "ANNEX_ID_MISMATCH",
    "/id"
  );

  root = temporaryFixture(t);
  value = annex(root);
  value.bindingLocks[0].authorityId = "missing-authority";
  writeAnnexAndRehashManifest(root, value);
  expectDiagnostic(
    function () { preflightV3SourceTree({ sourceRoot: root, repositoryRoot: root }); },
    "ANNEX_AUTHORITY_MISSING",
    "/bindingLocks/0/authorityId"
  );

  root = temporaryFixture(t);
  value = annex(root);
  value.approvalState = "balance-approved";
  writeAnnexAndRehashManifest(root, value);
  expectDiagnostic(
    function () { preflightV3SourceTree({ sourceRoot: root, repositoryRoot: root }); },
    "ANNEX_APPROVAL_MISMATCH",
    "/approvalState"
  );

  root = temporaryFixture(t);
  value = annex(root);
  value.candidateScopes = value.candidateScopes.slice().reverse();
  writeAnnexAndRehashManifest(root, value);
  expectDiagnostic(
    function () { preflightV3SourceTree({ sourceRoot: root, repositoryRoot: root }); },
    "SCHEMA_UNSTABLE_ORDER",
    "/candidateScopes/1"
  );

  root = temporaryFixture(t);
  value = annex(root);
  value.approvalState = "balance-approved";
  writeAnnexAndRehashManifest(root, value);
  let sourceManifest = manifest(root);
  sourceManifest.approvalState = "balance-approved";
  writeManifest(root, sourceManifest);
  expectDiagnostic(
    function () { preflightV3SourceTree({ sourceRoot: root, repositoryRoot: root }); },
    "ANNEX_EVIDENCE_REQUIRED",
    "/evidenceRecords"
  );
});

test("authority and evidence records are repository-contained and exact-byte hash pinned", (t) => {
  let root = temporaryFixture(t);
  fs.appendFileSync(path.join(root, "authority", "slice-spec.md"), "changed\n");
  expectDiagnostic(
    function () { preflightV3SourceTree({ sourceRoot: root, repositoryRoot: root }); },
    "SOURCE_HASH_MISMATCH",
    "/authorityRecords/0/sha256"
  );

  root = temporaryFixture(t);
  let value = annex(root);
  value.authorityRecords[0].repositoryPath = "../outside.md";
  writeAnnexAndRehashManifest(root, value);
  expectDiagnostic(
    function () { preflightV3SourceTree({ sourceRoot: root, repositoryRoot: root }); },
    "SOURCE_REFERENCE",
    "/authorityRecords/0/repositoryPath"
  );

  root = temporaryFixture(t);
  fs.mkdirSync(path.join(root, "evidence"));
  fs.writeFileSync(path.join(root, "evidence", "balance.json"), "{}\n");
  fs.writeFileSync(path.join(root, "evidence", "witness.json"), "{}\n");
  value = annex(root);
  value.approvalState = "balance-approved";
  value.evidenceRecords = [
    {
      id: "balance.slice",
      kind: "balance-report",
      repositoryPath: "evidence/balance.json",
      sha256: sha256Reference(Buffer.from("{}\n")),
    },
    {
      id: "witness.slice",
      kind: "witness-replay",
      repositoryPath: "evidence/witness.json",
      sha256: sha256Reference(Buffer.from("{}\n")),
    },
  ];
  writeAnnexAndRehashManifest(root, value);
  const sourceManifest = manifest(root);
  sourceManifest.approvalState = "balance-approved";
  writeManifest(root, sourceManifest);
  assert.equal(
    preflightV3SourceTree({ sourceRoot: root, repositoryRoot: root }).annex.approvalState,
    "balance-approved"
  );
  fs.appendFileSync(path.join(root, "evidence", "witness.json"), "stale\n");
  expectDiagnostic(
    function () { preflightV3SourceTree({ sourceRoot: root, repositoryRoot: root }); },
    "SOURCE_HASH_MISMATCH",
    "/evidenceRecords/1/sha256"
  );
});

test("canonical RFC 6901 pointers and ABI canonical value hashes have stable goldens", () => {
  assert.deepEqual(
    validateCanonicalJsonPointer("/maps/m01/a~1b/~0marker", "/pointer"),
    ["maps", "m01", "a/b", "~marker"]
  );
  expectDiagnostic(
    function () { validateCanonicalJsonPointer("", "/pointer"); },
    "ANNEX_POINTER_ROOT",
    "/pointer"
  );
  expectDiagnostic(
    function () { validateCanonicalJsonPointer("/bad~2escape", "/pointer"); },
    "ANNEX_POINTER_FORMAT",
    "/pointer"
  );
  expectDiagnostic(
    function () { validateCanonicalJsonPointer("/café", "/pointer"); },
    "ANNEX_POINTER_FORMAT",
    "/pointer"
  );
  assert.equal(
    canonicalValueHash(1),
    "sha256:6b86b273ff34fce19d6b804eff5a3f5747ada4eaa22f1d49c01e52ddb7875b4b"
  );
  assert.equal(
    canonicalValueHash({ b: 2, a: 1 }),
    "sha256:43258cff783fe7036d8a43033f830adfc60ec037382473548ac742b888292777"
  );
});

test("normalized lock tree is exact, ID-keyed, integer-only, and presentation-free", () => {
  let tree = syntheticLockTree();
  assert.equal(validateNormalizedLockTree(tree), tree);

  tree = syntheticLockTree();
  delete tree.summons;
  expectDiagnostic(
    function () { validateNormalizedLockTree(tree); },
    "SCHEMA_MISSING_KEY",
    "/summons"
  );

  tree = syntheticLockTree();
  tree.presentationCatalog = {};
  expectDiagnostic(
    function () { validateNormalizedLockTree(tree); },
    "SCHEMA_UNKNOWN_KEY",
    "/presentationCatalog"
  );

  tree = syntheticLockTree();
  tree.defenses.sentinel.id = "other";
  expectDiagnostic(
    function () { validateNormalizedLockTree(tree); },
    "LOCK_TREE_ID_MISMATCH",
    "/defenses/sentinel/id"
  );

  tree = syntheticLockTree();
  tree.enemies = [];
  expectDiagnostic(
    function () { validateNormalizedLockTree(tree); },
    "LOCK_TREE_COLLECTION",
    "/enemies"
  );

  tree = syntheticLockTree();
  tree.enemies.scout.hp = 1.5;
  expectDiagnostic(
    function () { validateNormalizedLockTree(tree); },
    "CANONICAL_INTEGER",
    "/enemies/scout/hp"
  );

  tree = syntheticLockTree();
  tree.campaignRules.ui = { summaryKey: "forbidden" };
  expectDiagnostic(
    function () { validateNormalizedLockTree(tree); },
    "LOCK_TREE_PRESENTATION",
    "/campaignRules/ui"
  );

  tree = syntheticLockTree();
  tree.missions.m01.presentationPackId = "pack.slice";
  expectDiagnostic(
    function () { validateNormalizedLockTree(tree); },
    "LOCK_TREE_PRESENTATION",
    "/missions/m01/presentationPackId"
  );
});

test("lock pointers resolve only inside semantic arrays and binding hashes must match", () => {
  const tree = syntheticLockTree();
  const value = structuralAnnex();
  value.bindingLocks[0].expectedCanonicalValueHash = "sha256:" + "0".repeat(64);
  expectDiagnostic(
    function () { validateLockCoverage(value, tree, { semanticArrayPaths: SEMANTIC_ARRAY_PATHS }); },
    "ANNEX_LOCK_HASH_MISMATCH",
    "/bindingLocks/0/expectedCanonicalValueHash"
  );

  value.bindingLocks[0].expectedCanonicalValueHash = canonicalValueHash(1);
  value.bindingLocks[0].jsonPointer = "/missing";
  expectDiagnostic(
    function () { validateLockCoverage(value, tree, { semanticArrayPaths: SEMANTIC_ARRAY_PATHS }); },
    "ANNEX_POINTER_MISSING",
    "/bindingLocks/0/jsonPointer"
  );

  value.bindingLocks[0].jsonPointer = "/presentationCatalog";
  expectDiagnostic(
    function () { validateLockCoverage(value, tree, { semanticArrayPaths: SEMANTIC_ARRAY_PATHS }); },
    "ANNEX_POINTER_PRESENTATION",
    "/bindingLocks/0/jsonPointer"
  );

  value.bindingLocks[0].jsonPointer = "/defenses/sentinel/levels/0";
  value.bindingLocks[0].expectedCanonicalValueHash = canonicalValueHash(tree.defenses.sentinel.levels[0]);
  value.candidateScopes = value.candidateScopes.flatMap(function (pointer) {
    return pointer === "/defenses"
      ? ["/defenses/sentinel/id", "/defenses/sentinel/levels/1"]
      : [pointer];
  });
  value.candidateScopes.push("/schemaVersion");
  value.candidateScopes.sort();
  expectDiagnostic(
    function () { validateLockCoverage(value, tree); },
    "ANNEX_POINTER_ARRAY",
    "/bindingLocks/0/jsonPointer"
  );
  assert.equal(
    validateLockCoverage(value, tree, { semanticArrayPaths: SEMANTIC_ARRAY_PATHS }).bindingValues[0].level,
    1
  );
});

test("lock coverage rejects overlaps, candidate intersections, and uncovered leaves", () => {
  const tree = syntheticLockTree();
  let value = structuralAnnex();
  value.candidateScopes.splice(3, 0, "/defenses/sentinel");
  expectDiagnostic(
    function () { validateLockCoverage(value, tree, { semanticArrayPaths: SEMANTIC_ARRAY_PATHS }); },
    "ANNEX_SCOPE_OVERLAP",
    "/candidateScopes/3"
  );

  value = structuralAnnex();
  value.bindingLocks.push({
    id: "lock.summons",
    authorityId: "slice-spec",
    jsonPointer: "/summons",
    expectedCanonicalValueHash: canonicalValueHash(tree.summons),
  });
  value.bindingLocks.sort(function (a, b) { return a.id < b.id ? -1 : (a.id > b.id ? 1 : 0); });
  expectDiagnostic(
    function () { validateLockCoverage(value, tree, { semanticArrayPaths: SEMANTIC_ARRAY_PATHS }); },
    "ANNEX_SCOPE_INTERSECTION"
  );

  value = structuralAnnex();
  value.candidateScopes = value.candidateScopes.filter(function (pointer) {
    return pointer !== "/summons";
  });
  expectDiagnostic(
    function () { validateLockCoverage(value, tree, { semanticArrayPaths: SEMANTIC_ARRAY_PATHS }); },
    "ANNEX_COVERAGE_UNCOVERED",
    "/summons"
  );
});
