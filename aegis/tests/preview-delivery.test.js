"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

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

function fixtureAlias(overrides) {
  return frozen(Object.assign({
    schemaVersion: 1,
    id: "slice-dev-v1",
    contentVersion: "slice-dev-v1",
    approvalState: "candidate-balance",
    releaseEligible: false,
    releaseArtifact: "aegis-release." + "a".repeat(64) + ".js",
    releaseHash: hash("a"),
  }, overrides));
}

function fixtureRelease(overrides) {
  return frozen(Object.assign({
    schemaVersion: 3,
    contentVersion: "slice-dev-v1",
    approvalState: "candidate-balance",
    releaseEligible: false,
    includedIds: {
      bosses: [],
      defenses: ["chronos", "hoplite", "oracle", "sentinel", "siege"],
      enemies: [],
      missions: ["m01", "m04", "m05"],
    },
    simulationArtifact: "aegis-sim." + "b".repeat(64) + ".js",
    simulationHash: hash("b"),
    contentArtifact: "aegis-content." + "c".repeat(64) + ".js",
    contentHash: hash("c"),
    presentationArtifact: "aegis-presentation." + "d".repeat(64) + ".js",
    presentationHash: hash("d"),
    rulesetHash: hash("e"),
    abiHash: hash("f"),
    eventSchemaVersion: 1,
  }, overrides));
}

test("stable preview alias has an exact non-production immutable-release contract", () => {
  const descriptor = selector.RELEASES["slice-dev-v1"];
  const alias = fixtureAlias();
  assert.strictEqual(PreviewLoader.validateReleaseAlias(alias, descriptor), alias);

  assert.throws(
    () => PreviewLoader.validateReleaseAlias(fixtureAlias({ releaseEligible: true }), descriptor),
    /release-ineligible/
  );
  assert.throws(
    () => PreviewLoader.validateReleaseAlias(fixtureAlias({ approvalState: "production-approved" }), descriptor),
    /non-production/
  );
  assert.throws(
    () => PreviewLoader.validateReleaseAlias(fixtureAlias({
      releaseArtifact: "aegis-release." + "0".repeat(64) + ".js",
    }), descriptor),
    /must match/
  );
  const extra = Object.assign({}, fixtureAlias(), { url: "https://evil.example/release.js" });
  assert.throws(() => PreviewLoader.validateReleaseAlias(extra, descriptor), /contain exactly/);
});

test("loader follows selector pin through SRI-authenticated immutable artifacts and binds the kernel", async () => {
  const descriptor = selector.RELEASES["slice-dev-v1"];
  const alias = fixtureAlias();
  const release = fixtureRelease();
  const content = frozen({ contentVersion: "slice-dev-v1" });
  const presentation = frozen({ contentVersion: "slice-dev-v1", strings: [] });
  const game = {};
  const requests = [];

  const loader = PreviewLoader.createLoader({
    game,
    scriptLoader(request) {
      requests.push(request);
      if (request.globalName === "AegisReleaseAlias") {
        game.AegisReleaseAlias = frozen({ RELEASE_ALIAS: alias });
        return Promise.resolve(game.AegisReleaseAlias);
      }
      if (request.globalName === "AegisRelease") {
        game.AegisRelease = frozen({ RELEASE: release });
        return Promise.resolve(game.AegisRelease);
      }
      if (request.globalName === "AegisKernel") {
        game.AegisSim = frozen({ TICKS_PER_SECOND: 60, DAMAGE_SCALE: 1000, DISTANCE_SCALE: 1000 });
        game.AegisEconomy = frozen({ sellRefund: (invested) => Math.floor(invested * 70 / 100) });
        game.AegisCommands = frozen({ normalizeCommand: (command) => frozen(Object.assign({}, command)) });
        game.AegisKernel = frozen({
          createRulesetBinding(input) {
            assert.strictEqual(input.release, release);
            assert.strictEqual(input.content, content);
            return frozen({
              rulesetHash: release.rulesetHash,
              simulationHash: release.simulationHash,
              contentVersion: release.contentVersion,
            });
          },
        });
        return Promise.resolve(game.AegisKernel);
      }
      if (request.globalName === "AegisContent") {
        game.AegisContent = frozen({ CONTENT: content });
        return Promise.resolve(game.AegisContent);
      }
      if (request.globalName === "AegisPresentation") {
        game.AegisPresentation = frozen({ PRESENTATION: presentation });
        return Promise.resolve(game.AegisPresentation);
      }
      return Promise.reject(new Error("Unexpected script request"));
    },
  });

  const runtime = await loader.load({
    release: descriptor,
    selector,
    baseHref: "https://example.test/games/aegis/preview.html?release=slice-dev-v1",
  });
  assert.strictEqual(runtime.release, release);
  assert.strictEqual(runtime.content, content);
  assert.strictEqual(runtime.presentation, presentation);
  assert.equal(runtime.binding.rulesetHash, release.rulesetHash);
  assert.equal(Object.isFrozen(runtime), true);
  assert.deepEqual(requests.map((request) => request.globalName), [
    "AegisReleaseAlias",
    "AegisRelease",
    "AegisKernel",
    "AegisContent",
    "AegisPresentation",
  ]);
  assert.equal(requests[0].integrity, null, "the selector-pinned stable alias is the bootstrap trust input");
  requests.slice(1).forEach((request) => assert.match(request.integrity, /^sha256-[A-Za-z0-9+/]+={0,2}$/));
  assert.match(requests[1].url, /\/content\/generated\/aegis-release\.[0-9a-f]{64}\.js$/);
  assert.match(requests[2].url, /\/content\/generated\/aegis-sim\.[0-9a-f]{64}\.js$/);
});

test("loader fails closed before simulation install when alias and release identities disagree", async () => {
  const descriptor = selector.RELEASES["slice-dev-v1"];
  const alias = fixtureAlias();
  const release = fixtureRelease({ approvalState: "balance-approved" });
  const game = {};
  const requests = [];
  const loader = PreviewLoader.createLoader({
    game,
    scriptLoader(request) {
      requests.push(request.globalName);
      if (request.globalName === "AegisReleaseAlias") {
        game.AegisReleaseAlias = frozen({ RELEASE_ALIAS: alias });
        return Promise.resolve(game.AegisReleaseAlias);
      }
      game.AegisRelease = frozen({ RELEASE: release });
      return Promise.resolve(game.AegisRelease);
    },
  });
  await assert.rejects(() => loader.load({
    release: descriptor,
    selector,
    baseHref: "file:///D:/ClaudeCode/GameSlop/games/aegis/preview.html",
  }), /disagrees/);
  assert.deepEqual(requests, ["AegisReleaseAlias", "AegisRelease"]);
});

test("loader rejects a descriptor clone even when its fields resemble the allowlisted developer release", async () => {
  const descriptorClone = frozen(Object.assign({}, selector.RELEASES["slice-dev-v1"], {
    namespaces: Object.assign({}, selector.RELEASES["slice-dev-v1"].namespaces),
    artifactPaths: Object.assign({}, selector.RELEASES["slice-dev-v1"].artifactPaths),
    contentIds: selector.RELEASES["slice-dev-v1"].contentIds.slice(),
  }));
  const loader = PreviewLoader.createLoader({ game: {} , scriptLoader() {
    throw new Error("script loading must not begin");
  } });
  await assert.rejects(() => loader.load({
    release: descriptorClone,
    selector,
    baseHref: "https://example.test/games/aegis/preview.html",
  }), /exact allowlisted release object/);
});

test("unlinked preview requests only slice-dev-v1 and leaves the public page unwired", () => {
  const preview = fs.readFileSync(path.join(__dirname, "..", "preview.html"), "utf8");
  const controller = fs.readFileSync(path.join(__dirname, "..", "js", "delivery", "preview-controller.js"), "utf8");
  const m01Art = fs.readFileSync(path.join(__dirname, "..", "js", "presentation", "m01-art.js"), "utf8");
  const actIArt = fs.readFileSync(path.join(__dirname, "..", "js", "presentation", "act-i-art.js"), "utf8");
  const publicPage = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  assert.match(preview, /releaseId:\s*"slice-dev-v1"/);
  assert.match(preview, /developer:\s*true/);
  assert.match(preview, /\.\.\/_kit\/shell\.js/);
  assert.match(preview, /id="previewBattlefield"/);
  assert.match(preview, /id="previewBattlefieldStatus"/);
  assert.match(preview, /id="previewSiteList"/);
  assert.match(preview, /id="previewStorePanel"/);
  assert.match(preview, /id="previewStoreClose"/);
  assert.match(preview, /id="previewShareCard"[^>]+width="1200" height="675"/);
  assert.match(preview, /id="previewShareDownload"/);
  assert.match(preview, /role="dialog" aria-modal="false"/);
  assert.match(m01Art, /art\/v2\/m01\/environment-gate-of-dawn-v4\.webp/);
  assert.match(m01Art, /road-earth-v2\.webp/);
  assert.match(m01Art, /road-limestone-v2\.webp/);
  assert.match(m01Art, /road-city-cobble-v2\.webp/);
  assert.match(preview, /js\/presentation\/camera\.js/);
  assert.match(preview, /js\/presentation\/road-geometry\.js/);
  assert.match(preview, /js\/presentation\/m01-art\.js/);
  assert.match(preview, /js\/presentation\/act-i-art\.js/);
  assert.match(preview, /js\/presentation\/sprite-atlas\.js/);
  assert.match(preview, /js\/presentation\/share-card\.js/);
  assert.match(preview, /aspect-ratio:\s*8\s*\/\s*5/);
  assert.doesNotMatch(preview, /skin\/armara\/battlefield-v2\.png/);
  assert.match(preview, /Developer test options/);
  assert.match(preview, /Not part of the player interface/);
  assert.match(preview, /Gate Health/);
  assert.match(preview, /Simulation step/);
  assert.match(controller, /Empty build site\. Open tower menu\./);
  assert.doesNotMatch(preview, /data-cost=/);
  assert.doesNotMatch(preview, /Strategic pads|route intent|id="previewPads"|<span>Tick<\/span>|is-strong/);
  assert.doesNotMatch(controller, /pad\.(?:intent|quality|declaredQuality|claimedRouteIds)|data-pad-list-id|is-strong/);
  assert.match(controller, /art\/v2\/m01\/towers\/sentinel-anim-v1\.webp/);
  assert.match(controller, /art\/v2\/m01\/enemies\/raider-anim-v1\.webp/);
  assert.match(controller, /art\/v2\/shared\/towers\/hoplite-anim-v1\.webp/);
  assert.match(controller, /art\/v2\/shared\/towers\/oracle-anim-v1\.webp/);
  assert.match(controller, /art\/v2\/shared\/enemies\/echo-anim-v1\.webp/);
  assert.match(controller, /art\/v2\/shared\/enemies\/guardian-anim-v1\.webp/);
  assert.match(controller, /art\/v2\/shared\/enemies\/titan-anim-v1\.webp/);
  assert.match(controller, /"talos-prototype"[\s\S]+art\/v2\/shared\/enemies\/talos-anim-v1\.webp/);
  assert.match(m01Art, /art\/v2\/m01\/foundation-attican-v1\.webp/);
  assert.match(actIArt, /art\/v2\/m04\/environment-piraeus-switchyard-v1\.webp/);
  assert.match(actIArt, /art\/v2\/m04\/road-harbor-limestone-v1\.webp/);
  assert.match(actIArt, /art\/v2\/m05\/environment-bronze-warden-v1\.webp/);
  assert.match(actIArt, /art\/v2\/m05\/road-foundry-blackstone-v1\.webp/);
  assert.match(controller, /preview-road-layer-act-i/);
  assert.match(controller, /preview-road-solid-underlay/);
  assert.match(controller, /data-physical-lane-count/);
  assert.match(controller, /ShareCard\.render/);
  assert.match(controller, /Nothing was posted or uploaded/);
  assert.match(controller, /SpriteAtlas\.towerFrame\(atlas\.metadata, level, "idleA"\)/,
    "store thumbnails must use the exact level row and idleA column");
  assert.match(controller, /class:\s*"preview-map-pad-foundation"/);
  assert.match(controller, /class:\s*"preview-tower-thumbnail-svg"/);
  assert.match(controller, /class:\s*"preview-sprite-fallback"/);
  assert.match(controller, /data-asset-state/);
  assert.match(preview, /\.preview-map-pad-foundation\s*\{/);
  assert.match(preview, /\.preview-tower-thumbnail-svg\s*\{/);
  assert.match(preview, /\.preview-site-button\s*\{[^}]*min-height:\s*3rem/s);
  assert.match(controller, /data-site-pad-id/);
  assert.match(controller, /role:\s*"group"/,
    "the battlefield graphic must expose its descendant build-site buttons");
  assert.doesNotMatch(controller, /class:\s*"preview-battlefield-svg"[\s\S]{0,220}role:\s*"img"/);
  assert.match(controller, /if \(!result\.advanced\) return;/,
    "planning, pause, and terminal no-op ticks must not reconstruct controls");
  assert.match(controller, /cadenceRenderWouldReplaceFocus/);
  assert.match(controller, /try\s*\{\s*ui\.shareCard\.toBlob/);
  assert.match(controller, /clipPathUnits:\s*"userSpaceOnUse"/);
  assert.match(controller, /width:\s*width \* asset\.metadata\.columns/);
  assert.doesNotMatch(controller, /stroke-dasharray.*preview-road/i);
  assert.doesNotMatch(publicPage, /preview-(?:loader|controller)\.js/);
  assert.doesNotMatch(publicPage, /preview\.html/);
});
