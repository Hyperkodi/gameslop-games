"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const selector = require("../js/delivery/release-selector.js");
const PreviewLoader = require("../js/delivery/preview-loader.js");

function frozen(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.keys(value).forEach((key) => frozen(value[key]));
  return Object.freeze(value);
}

function hash(character) {
  return "sha256:" + character.repeat(64);
}

function alias(id, overrides) {
  return frozen(Object.assign({
    schemaVersion: 1,
    id,
    contentVersion: id,
    approvalState: "candidate-balance",
    releaseEligible: false,
    releaseArtifact: "aegis-release." + "a".repeat(64) + ".js",
    releaseHash: hash("a"),
  }, overrides || {}));
}

function releaseRecord(overrides) {
  return frozen(Object.assign({
    schemaVersion: 3,
    contentVersion: "slice-dev-v1",
    approvalState: "candidate-balance",
    releaseEligible: false,
    includedIds: { bosses: [], defenses: ["sentinel"], enemies: [], missions: ["m01", "m04", "m05"] },
    simulationArtifact: "aegis-sim." + "b".repeat(64) + ".js",
    simulationHash: hash("b"),
    contentArtifact: "aegis-content." + "c".repeat(64) + ".js",
    contentHash: hash("c"),
    presentationArtifact: "aegis-presentation." + "d".repeat(64) + ".js",
    presentationHash: hash("d"),
    rulesetHash: hash("e"),
    abiHash: hash("f"),
    eventSchemaVersion: 1,
  }, overrides || {}));
}

function v4Record(overrides) {
  return releaseRecord(Object.assign({
    schemaVersion: 4,
    contentVersion: "candidate-v4",
    abiVersion: 2,
    contentIds: ["m01", "m02", "m03"],
    eventSchemaVersion: 2,
    developerOnly: true,
    requiredGlobals: ["AegisProtocols", "AegisRelics"],
    includedIds: undefined,
  }, overrides || {}));
}

/* A scripted runtime that installs whatever globals the release declares. */
function loaderFor(options) {
  const config = options || {};
  const game = {};
  const requests = [];
  const loader = PreviewLoader.createLoader({
    game,
    scriptLoader(request) {
      requests.push(request);
      if (request.globalName === "AegisReleaseAlias") {
        game.AegisReleaseAlias = frozen({ RELEASE_ALIAS: config.alias });
        return Promise.resolve(game.AegisReleaseAlias);
      }
      if (request.globalName === "AegisRelease") {
        game.AegisRelease = frozen({ RELEASE: config.release });
        return Promise.resolve(game.AegisRelease);
      }
      if (request.globalName === "AegisKernel") {
        (config.installGlobals || [
          "AegisSim", "AegisEconomy", "AegisCommands",
        ]).forEach((name) => { game[name] = frozen({ name }); });
        game.AegisKernel = frozen({
          createRulesetBinding() {
            return frozen({
              rulesetHash: config.release.rulesetHash,
              simulationHash: config.release.simulationHash,
              contentVersion: config.release.contentVersion,
            });
          },
        });
        return Promise.resolve(game.AegisKernel);
      }
      if (request.globalName === "AegisContent") {
        game.AegisContent = frozen({ CONTENT: { contentVersion: config.release.contentVersion } });
        return Promise.resolve(game.AegisContent);
      }
      if (request.globalName === "AegisPresentation") {
        game.AegisPresentation = frozen({
          PRESENTATION: { contentVersion: config.release.contentVersion, strings: [] },
        });
        return Promise.resolve(game.AegisPresentation);
      }
      return Promise.reject(new Error("Unexpected script request"));
    },
  });
  return { loader, requests, game };
}

/* ------------------------------------------------------------------- tests */

test("the release allowlist is exactly the aliases this repository ships", () => {
  assert.deepEqual(selector.PREVIEW_RELEASE_IDS, ["slice-dev-v1", "candidate-v4"]);
  assert.deepEqual(PreviewLoader.PREVIEW_RELEASE_IDS, selector.PREVIEW_RELEASE_IDS);
  selector.PREVIEW_RELEASE_IDS.forEach((id) => {
    const descriptor = selector.RELEASES[id];
    assert.equal(descriptor.channel, "developer", id);
    assert.equal(descriptor.developerOnly, true, id);
    assert.equal(descriptor.artifactPaths.releaseRecord, "content/generated/release." + id + ".js", id);
  });
  assert.equal(Object.prototype.hasOwnProperty.call(PreviewLoader, "EXPECTED_RELEASE_ID"), false,
    "the loader no longer hard-codes a single release id");
});

test("?release=candidate-v4 selects the campaign candidate with its own namespace", () => {
  const descriptor = selector.selectRelease({ search: "?release=candidate-v4", developer: true });
  assert.strictEqual(descriptor, selector.RELEASES["candidate-v4"]);
  assert.equal(descriptor.namespaceRoot, "aegis-candidate-v4");
  Object.keys(descriptor.namespaces).forEach((key) => {
    assert.notEqual(descriptor.namespaces[key], selector.RELEASES["slice-dev-v1"].namespaces[key], key);
  });
  assert.deepEqual(descriptor.contentIds, [],
    "the candidate mission set lives in the authenticated release record");
  assert.throws(() => selector.selectRelease({ search: "?release=candidate-v4" }),
    /explicit trusted developer option/);
});

test("the loader accepts any shipped alias descriptor and refuses everything else", () => {
  selector.PREVIEW_RELEASE_IDS.forEach((id) => {
    assert.strictEqual(PreviewLoader.validateSelectedRelease(selector.RELEASES[id]), selector.RELEASES[id]);
  });
  assert.throws(() => PreviewLoader.validateSelectedRelease(selector.RELEASES["legacy-proving-ground"]),
    /a release alias this repository ships/);
  assert.throws(() => PreviewLoader.validateSelectedRelease(Object.assign({},
    selector.RELEASES["slice-dev-v1"], { channel: "production", developerOnly: false })),
  /explicit developer-only descriptors/);
  assert.throws(() => PreviewLoader.validateSelectedRelease(Object.assign({},
    selector.RELEASES["slice-dev-v1"], {
      artifactPaths: { releaseRecord: "content/generated/release.candidate-v4.js" },
    })), /pinned stable release-alias path/);
  assert.throws(() => PreviewLoader.validateSelectedRelease(Object.assign({},
    selector.RELEASES["slice-dev-v1"], {
      artifactPaths: { releaseRecord: "content/generated/release.slice-dev-v1.js", extra: "js/x.js" },
    })), /exactly one stable release-alias path/);
});

test("the alias must stay non-production, release-ineligible, and hash matched", () => {
  const descriptor = selector.RELEASES["slice-dev-v1"];
  const shipped = alias("slice-dev-v1");
  assert.strictEqual(PreviewLoader.validateReleaseAlias(shipped, descriptor), shipped);
  assert.throws(() => PreviewLoader.validateReleaseAlias(
    alias("slice-dev-v1", { releaseEligible: true }), descriptor), /release-ineligible/);
  assert.throws(() => PreviewLoader.validateReleaseAlias(
    alias("slice-dev-v1", { approvalState: "production-approved" }), descriptor), /non-production/);
  assert.throws(() => PreviewLoader.validateReleaseAlias(
    alias("candidate-v4"), descriptor), /does not match slice-dev-v1/);
  assert.throws(() => PreviewLoader.validateReleaseAlias(
    alias("slice-dev-v1", { contentVersion: "Slice Dev" }), descriptor), /does not match slice-dev-v1/);
});

test("a release record declares its content schema, ABI version, content IDs, and globals", () => {
  const descriptor = selector.RELEASES["slice-dev-v1"];
  const validated = PreviewLoader.validateReleaseRecord(
    releaseRecord(), alias("slice-dev-v1"), descriptor, true
  );
  assert.equal(validated.abiVersion, 1, "content schema 3 binds ABI v1");
  assert.deepEqual(validated.contentIds, ["m01", "m04", "m05"]);
  assert.equal(validated.developerOnly, true);
  assert.deepEqual(validated.requiredGlobals, PreviewLoader.REQUIRED_GLOBALS_BY_ABI[1]);

  const candidate = PreviewLoader.validateReleaseRecord(
    v4Record(), alias("candidate-v4"), selector.RELEASES["candidate-v4"], true
  );
  assert.equal(candidate.abiVersion, 2, "content schema 4 binds ABI v2");
  assert.deepEqual(candidate.contentIds, ["m01", "m02", "m03"]);
  assert.equal(candidate.requiredGlobals.includes("AegisProtocols"), true);
  assert.equal(candidate.requiredGlobals.includes("AegisCommandsV2"), true);
});

test("the loader refuses an unsupported schema, a mismatched ABI, or unsorted content IDs", () => {
  const descriptor = selector.RELEASES["candidate-v4"];
  const candidateAlias = alias("candidate-v4");
  assert.throws(() => PreviewLoader.validateReleaseRecord(
    v4Record({ schemaVersion: 5 }), candidateAlias, descriptor, true), /disagrees with the trusted preview alias/);
  assert.throws(() => PreviewLoader.validateReleaseRecord(
    v4Record({ abiVersion: 1 }), candidateAlias, descriptor, true), /disagrees with its content schema/);
  assert.throws(() => PreviewLoader.validateReleaseRecord(
    v4Record({ abiVersion: 3 }), candidateAlias, descriptor, true), /unsupported ABI version/);
  assert.throws(() => PreviewLoader.validateReleaseRecord(
    v4Record({ contentIds: ["m03", "m01"] }), candidateAlias, descriptor, true), /sorted and unique/);
  assert.throws(() => PreviewLoader.validateReleaseRecord(
    v4Record({ contentIds: [] }), candidateAlias, descriptor, true), /non-empty array/);
  assert.throws(() => PreviewLoader.validateReleaseRecord(
    v4Record({ requiredGlobals: ["window"] }), candidateAlias, descriptor, true),
  /required globals must be Aegis runtime names/);
});

test("a developer-only release record requires the explicit developer option", () => {
  assert.throws(() => PreviewLoader.validateReleaseRecord(
    releaseRecord(), alias("slice-dev-v1"), selector.RELEASES["slice-dev-v1"], false),
  /requires an explicit trusted developer option/);
  assert.throws(() => PreviewLoader.validateReleaseRecord(
    v4Record(), alias("candidate-v4"), selector.RELEASES["candidate-v4"], false),
  /requires an explicit trusted developer option/);
});

test("a descriptor content-ID pin must match the authenticated release record", () => {
  assert.throws(() => PreviewLoader.validateReleaseRecord(
    releaseRecord({ includedIds: { missions: ["m01", "m02"] } }),
    alias("slice-dev-v1"), selector.RELEASES["slice-dev-v1"], true
  ), /content IDs disagree with the selected preview release/);
  const unpinned = PreviewLoader.validateReleaseRecord(
    v4Record({ contentIds: ["m07", "m08"] }),
    alias("candidate-v4"), selector.RELEASES["candidate-v4"], true
  );
  assert.deepEqual(unpinned.contentIds, ["m07", "m08"],
    "an unpinned descriptor takes the mission set from the release record");
});

test("slice-dev-v1 still loads exactly as before and reports ABI v1", async () => {
  const descriptor = selector.RELEASES["slice-dev-v1"];
  const harness = loaderFor({ alias: alias("slice-dev-v1"), release: releaseRecord() });
  const runtime = await harness.loader.load({
    release: descriptor,
    selector,
    baseHref: "https://example.test/games/aegis/preview.html",
    developer: true,
  });
  assert.equal(runtime.abiVersion, 1);
  assert.deepEqual(runtime.contentIds, ["m01", "m04", "m05"]);
  assert.equal(Object.isFrozen(runtime), true);
  assert.deepEqual(harness.requests.map((request) => request.globalName), [
    "AegisReleaseAlias", "AegisRelease", "AegisKernel", "AegisContent", "AegisPresentation",
  ]);
  assert.equal(harness.requests[0].integrity, null);
  harness.requests.slice(1).forEach((request) => {
    assert.match(request.integrity, /^sha256-[A-Za-z0-9+/]+={0,2}$/);
  });
});

test("a v4 release loads through the same path and reports ABI v2", async () => {
  const descriptor = selector.RELEASES["candidate-v4"];
  const harness = loaderFor({
    alias: alias("candidate-v4"),
    release: v4Record(),
    installGlobals: [
      "AegisSim", "AegisEconomy", "AegisCommands",
      "AegisCommandsV2", "AegisProtocols", "AegisRelics",
    ],
  });
  const runtime = await harness.loader.load({
    release: descriptor,
    selector,
    baseHref: "file:///D:/ClaudeCode/GameSlop/games/aegis/preview.html",
    developer: true,
  });
  assert.equal(runtime.abiVersion, 2);
  assert.deepEqual(runtime.contentIds, ["m01", "m02", "m03"]);
  assert.match(harness.requests[0].url, /release\.candidate-v4\.js$/);
});

test("a bundle that does not install every required global fails closed", async () => {
  const descriptor = selector.RELEASES["candidate-v4"];
  const harness = loaderFor({
    alias: alias("candidate-v4"),
    release: v4Record(),
    installGlobals: ["AegisSim", "AegisEconomy", "AegisCommands"],
  });
  await assert.rejects(() => harness.loader.load({
    release: descriptor,
    selector,
    baseHref: "https://example.test/games/aegis/preview.html",
    developer: true,
  }), /did not install Game\.AegisProtocols/);
});

test("load options stay an exact record with one optional developer flag", async () => {
  const descriptor = selector.RELEASES["slice-dev-v1"];
  const harness = loaderFor({ alias: alias("slice-dev-v1"), release: releaseRecord() });
  await assert.rejects(() => harness.loader.load({
    release: descriptor, selector, baseHref: "https://example.test/games/aegis/", releaseUrl: "x",
  }), /unknown field releaseUrl/);
  await assert.rejects(() => harness.loader.load({ release: descriptor, selector }),
    /is missing baseHref/);
});
