"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const delivery = require("../js/delivery/release-selector.js");

test("default selection is exactly the legacy proving ground", () => {
  assert.equal(delivery.DEFAULT_RELEASE_ID, "legacy-proving-ground");
  assert.strictEqual(delivery.selectRelease(), delivery.RELEASES["legacy-proving-ground"]);
  assert.strictEqual(
    delivery.selectRelease({ search: "?skin=armara&seed=7&debug=1" }),
    delivery.RELEASES["legacy-proving-ground"]
  );
});

test("slice dev release requires a trusted explicit developer option", () => {
  assert.throws(
    () => delivery.selectRelease({ releaseId: "slice-dev-v1" }),
    /explicit trusted developer option/
  );
  assert.throws(
    () => delivery.selectRelease({ search: "?release=slice-dev-v1&developer=1" }),
    /explicit trusted developer option/
  );
  const direct = delivery.selectRelease({ releaseId: "slice-dev-v1", developer: true });
  const queried = delivery.selectRelease({ search: "?release=slice-dev-v1", developer: true });
  assert.strictEqual(direct, delivery.RELEASES["slice-dev-v1"]);
  assert.strictEqual(queried, direct);
  assert.equal(direct.channel, "developer");
  assert.equal(direct.developerOnly, true);
  assert.equal(direct.metadataPath, "content/generated/release.slice-dev-v1.json");
  assert.equal(direct.artifactPaths.releaseRecord, "content/generated/release.slice-dev-v1.js");
});

test("unknown, ambiguous, and URL-like release input is rejected", () => {
  [
    "?release=unknown",
    "?release=../evil",
    "?release=https%3A%2F%2Fevil.example%2Frelease.json",
    "?release=legacy-proving-ground&release=slice-dev-v1",
    "?release=",
    "?manifest=https%3A%2F%2Fevil.example%2Fmanifest.json",
    "?manifest-url=..%2Fevil.json",
    "?releaseUrl=https%3A%2F%2Fevil.example%2Fentry.js",
  ].forEach((search) => assert.throws(() => delivery.selectRelease({ search }), Error, search));
  assert.throws(() => delivery.selectRelease({ manifestUrl: "https://evil.example/a.json" }), /Unknown release option/);
  assert.throws(() => delivery.selectRelease({ releaseId: "" }), /non-empty string/);
  assert.throws(() => delivery.selectRelease({ releaseId: "slice-dev-v1", search: "?release=legacy-proving-ground", developer: true }), /Conflicting/);
});

test("developer storage and worker namespaces cannot collide with legacy production state", () => {
  const legacy = delivery.RELEASES["legacy-proving-ground"];
  const dev = delivery.RELEASES["slice-dev-v1"];
  assert.equal(legacy.namespaceRoot, "aegis");
  assert.equal(dev.namespaceRoot, "aegis-slice-dev");
  ["profile", "database", "cache", "replay", "serviceWorker"].forEach((key) => {
    assert.notEqual(dev.namespaces[key], legacy.namespaces[key], key);
    assert.match(dev.namespaces[key], /^aegis-slice-dev(?::|$)/, key);
    assert.match(legacy.namespaces[key], /^aegis(?::|$)/, key);
  });
});

test("namespace validation requires an exact root or colon-delimited child", () => {
  const dev = delivery.RELEASES["slice-dev-v1"];
  const namespaces = Object.assign({}, dev.namespaces, { cache: "aegis-slice-developer-cache" });
  assert.throws(
    () => delivery.validateDescriptor(Object.assign({}, dev, { namespaces })),
    /must derive from namespaceRoot/
  );
});

test("artifact paths remain relative and resolve below GitHub Pages and file URL bases", () => {
  const legacy = delivery.RELEASES["legacy-proving-ground"];
  const dev = delivery.RELEASES["slice-dev-v1"];
  const pages = delivery.resolveArtifactUrls(legacy, "https://hyperkodi.github.io/gameslop-games/aegis/?debug=1");
  assert.equal(pages.engine, "https://hyperkodi.github.io/gameslop-games/aegis/js/engine.js");
  assert.equal(pages.renderer, "https://hyperkodi.github.io/gameslop-games/aegis/js/renderer.js");
  const file = delivery.resolveArtifactUrls(dev, "file:///D:/ClaudeCode/GameSlop/games/aegis/index.html");
  assert.equal(file.releaseRecord, "file:///D:/ClaudeCode/GameSlop/games/aegis/content/generated/release.slice-dev-v1.js");
  assert.throws(() => delivery.resolveArtifactUrl("https://example.com/games/aegis/", "../engine.js"), /stay inside/);
  assert.throws(() => delivery.resolveArtifactUrl("https://example.com/games/aegis/", "https://evil.example/x.js"), /must not contain/);
  assert.throws(() => delivery.resolveArtifactUrls({ id: "slice-dev-v1", artifactPaths: dev.artifactPaths }, "https://example.com/aegis/"), /allowlisted/);
});

test("production descriptors cannot reference legacy ids or paths", () => {
  const base = {
    id: "campaign-1",
    channel: "production",
    developerOnly: false,
    namespaceRoot: "aegis",
    namespaces: {
      profile: "aegis:profile",
      database: "aegis",
      cache: "aegis:cache",
      replay: "aegis:replay",
      serviceWorker: "aegis:sw",
    },
    metadataPath: "content/generated/release.campaign-1.json",
    artifactPaths: { releaseRecord: "content/generated/release.campaign-1.js" },
    contentIds: ["m01"],
  };
  assert.equal(delivery.validateDescriptor(base), true);
  assert.throws(
    () => delivery.validateDescriptor(Object.assign({}, base, { contentIds: ["legacy-proving-ground"] })),
    /cannot reference legacy/
  );
  assert.throws(
    () => delivery.validateDescriptor(Object.assign({}, base, {
      artifactPaths: { releaseRecord: "content/generated/legacy-campaign.js" },
    })),
    /cannot reference legacy/
  );
});

test("release descriptors, namespaces, paths, and resolved maps are immutable", () => {
  const dev = delivery.RELEASES["slice-dev-v1"];
  assert.equal(Object.isFrozen(delivery), true);
  assert.equal(Object.isFrozen(delivery.RELEASES), true);
  assert.equal(Object.isFrozen(dev), true);
  assert.equal(Object.isFrozen(dev.namespaces), true);
  assert.equal(Object.isFrozen(dev.artifactPaths), true);
  assert.equal(Object.isFrozen(dev.contentIds), true);
  assert.throws(() => { dev.id = "evil"; }, TypeError);
  assert.throws(() => { dev.namespaces.database = "aegis"; }, TypeError);
  assert.throws(() => { dev.artifactPaths.releaseRecord = "https://evil.example/x"; }, TypeError);
  const resolved = delivery.resolveArtifactUrls(dev, "https://example.com/subpath/aegis/");
  assert.equal(Object.isFrozen(resolved), true);
  assert.throws(() => { resolved.releaseRecord = "https://evil.example/x"; }, TypeError);
});

test("classic-script install is capability-independent and fails closed on collision", () => {
  const filename = path.join(__dirname, "../js/delivery/release-selector.js");
  const source = fs.readFileSync(filename, "utf8");
  function forbiddenCapability(name) {
    return new Proxy(function () {}, {
      apply() { throw new Error(name + " was called"); },
      construct() { throw new Error(name + " was constructed"); },
      get() { throw new Error(name + " was read"); },
      set() { throw new Error(name + " was mutated"); },
    });
  }
  const capabilities = {
    document: forbiddenCapability("document"),
    fetch: forbiddenCapability("fetch"),
    localStorage: forbiddenCapability("localStorage"),
    indexedDB: forbiddenCapability("indexedDB"),
    caches: forbiddenCapability("caches"),
    Worker: forbiddenCapability("Worker"),
    ServiceWorker: forbiddenCapability("ServiceWorker"),
    navigator: forbiddenCapability("navigator"),
    location: forbiddenCapability("location"),
  };
  const context = vm.createContext(Object.assign({}, capabilities));
  vm.runInContext(source, context, { filename: "release-selector.js" });
  assert.ok(context.Game);
  assert.equal(context.Game.AegisReleaseSelector.DEFAULT_RELEASE_ID, "legacy-proving-ground");
  assert.equal(Object.isFrozen(context.Game.AegisReleaseSelector), true);
  Object.keys(capabilities).forEach((key) => assert.strictEqual(context[key], capabilities[key], key));

  const collision = Object.freeze({ owner: "other-loader" });
  const collisionContext = vm.createContext(Object.assign({
    Game: { AegisReleaseSelector: collision },
  }, capabilities));
  assert.throws(
    () => vm.runInContext(source, collisionContext, { filename: "release-selector.js" }),
    /Conflicting Game\.AegisReleaseSelector/
  );
  assert.strictEqual(collisionContext.Game.AegisReleaseSelector, collision);
  Object.keys(capabilities).forEach((key) => assert.strictEqual(collisionContext[key], capabilities[key], key));
});
