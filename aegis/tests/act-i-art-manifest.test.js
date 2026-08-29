"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const REPO_ROOT = path.resolve(__dirname, "../../..");
const { AegisContentError } = require(path.join(REPO_ROOT, "tools/lib/aegis/diagnostics.js"));
const Generator = require(path.join(REPO_ROOT, "tools/generate-aegis-act-i-art-manifest.js"));

function expectDiagnostic(fn, code, diagnosticPath) {
  assert.throws(fn, function (error) {
    assert.ok(error instanceof AegisContentError, String(error));
    assert.equal(error.diagnostics[0].code, code);
    if (diagnosticPath !== undefined) assert.equal(error.diagnostics[0].path, diagnosticPath);
    return true;
  });
}

function capture() {
  let stdout = Buffer.alloc(0);
  let stderr = "";
  return {
    io: {
      stdout: {
        write(value) {
          const bytes = Buffer.isBuffer(value) ? value : Buffer.from(String(value), "utf8");
          stdout = Buffer.concat([stdout, bytes]);
        },
      },
      stderr: { write(value) { stderr += String(value); } },
    },
    stdout() { return stdout; },
    stderr() { return stderr; },
  };
}

test("Act I inventory locks the four accepted M04/M05 WebPs to exact measurements", function () {
  const inventory = Generator.buildActIArtInventory();
  const actualFiles = ["m04", "m05"].flatMap(function (missionId) {
    return fs.readdirSync(path.join(REPO_ROOT, "games/aegis/art/v2", missionId)).map(function (name) {
      return "art/v2/" + missionId + "/" + name;
    });
  }).sort();
  assert.deepEqual(actualFiles, Generator.ACCEPTED_ASSETS.map(function (record) {
    return record.relativeUrl;
  }).sort());
  assert.equal(Object.isFrozen(inventory), true);
  assert.equal(Object.isFrozen(inventory.assetRecords), true);
  assert.deepEqual(inventory.assetRecords.map(function (record) {
    return {
      id: record.id,
      missionId: record.missionId,
      usage: record.usage,
      relativeUrl: record.relativeUrl,
      format: record.format,
      sha256: record.sha256,
      widthPx: record.widthPx,
      heightPx: record.heightPx,
      alphaMode: record.alphaMode,
      transferBytes: record.transferBytes,
      decodedBytes: record.decodedBytes,
    };
  }), [
    {
      id: "asset.m04.environment.piraeus-switchyard",
      missionId: "m04",
      usage: "mission-environment",
      relativeUrl: "art/v2/m04/environment-piraeus-switchyard-v1.webp",
      format: "webp",
      sha256: "sha256:93df4c0b34fcbd134d21abb2ba399a2cdd95e9e5bbfe0645a31704b8cc008b1a",
      widthPx: 2048,
      heightPx: 1280,
      alphaMode: "opaque",
      transferBytes: 755926,
      decodedBytes: 10485760,
    },
    {
      id: "asset.m04.road.harbor-limestone",
      missionId: "m04",
      usage: "road-texture",
      relativeUrl: "art/v2/m04/road-harbor-limestone-v1.webp",
      format: "webp",
      sha256: "sha256:05006e356113cc83018a617ab40b3a5c7ee92054eb56c3a6922c941d120566dc",
      widthPx: 1024,
      heightPx: 1024,
      alphaMode: "opaque",
      transferBytes: 331178,
      decodedBytes: 4194304,
    },
    {
      id: "asset.m05.environment.bronze-warden",
      missionId: "m05",
      usage: "mission-environment",
      relativeUrl: "art/v2/m05/environment-bronze-warden-v1.webp",
      format: "webp",
      sha256: "sha256:c026123d3a56fd362ac7c9001d7f27b414966a6bd54b24141ec086b6b35bf29d",
      widthPx: 2048,
      heightPx: 1280,
      alphaMode: "opaque",
      transferBytes: 533106,
      decodedBytes: 10485760,
    },
    {
      id: "asset.m05.road.foundry-blackstone",
      missionId: "m05",
      usage: "road-texture",
      relativeUrl: "art/v2/m05/road-foundry-blackstone-v1.webp",
      format: "webp",
      sha256: "sha256:5c576956dfc90b02d1a96e63c9c6342c8fd18d362b4343fb499dbb4e86be77e4",
      widthPx: 1024,
      heightPx: 1024,
      alphaMode: "opaque",
      transferBytes: 378398,
      decodedBytes: 4194304,
    },
  ]);
});

test("Act I inventory proves independent three-megabyte/64-megabyte mission budgets", function () {
  const inventory = Generator.buildActIArtInventory();
  assert.deepEqual(inventory.missionTotals, [
    {
      missionId: "m04",
      assetCount: 2,
      transferBytes: 1087104,
      decodedBytes: 14680064,
      largestAssetId: "asset.m04.environment.piraeus-switchyard",
      largestAssetTransferBytes: 755926,
      remainingTransferBytes: 2058624,
      remainingDecodedBytes: 52428800,
    },
    {
      missionId: "m05",
      assetCount: 2,
      transferBytes: 911504,
      decodedBytes: 14680064,
      largestAssetId: "asset.m05.environment.bronze-warden",
      largestAssetTransferBytes: 533106,
      remainingTransferBytes: 2234224,
      remainingDecodedBytes: 52428800,
    },
  ]);
  assert.deepEqual(inventory.totals, {
    missionCount: 2,
    assetCount: 4,
    transferBytes: 1998608,
    decodedBytes: 29360128,
    maximumDimensionPx: 2048,
    largestAssetId: "asset.m04.environment.piraeus-switchyard",
    largestAssetTransferBytes: 755926,
  });
  assert.deepEqual(inventory.budgets, {
    maxMissionTransferBytes: 3145728,
    maxMissionDecodedBytes: 67108864,
    maxDimensionPx: 2048,
    maxIndividualBytes: 1048576,
  });
  assert.ok(inventory.assetRecords.every(function (record) {
    return record.transferBytes <= 1048576 && record.widthPx <= 2048 && record.heightPx <= 2048;
  }));
});

test("Act I inventory output and CLI bytes are canonical and repeatable", function () {
  const first = Generator.buildActIArtInventory();
  const second = Generator.buildActIArtInventory();
  const bytes = Generator.renderActIArtInventory(first);
  assert.deepEqual(first, second);
  assert.deepEqual(bytes, Generator.renderActIArtInventory(second));
  assert.equal(bytes[bytes.length - 1], 0x0a);

  const output = capture();
  assert.equal(Generator.main([], output.io), 0);
  assert.deepEqual(output.stdout(), bytes);
  assert.equal(output.stderr(), "");
});

test("Act I inventory rejects order, measurement drift, per-mission exhaustion, and CLI arguments", function () {
  const reversed = Generator.ACCEPTED_ASSETS.slice().reverse();
  expectDiagnostic(
    function () { Generator.buildActIArtInventory({ assetDefinitions: reversed }); },
    "ACT_I_ART_INVENTORY_ORDER",
    "/assetRecords/1/id"
  );

  const drifted = Generator.ACCEPTED_ASSETS.map(function (record) { return Object.assign({}, record); });
  drifted[0].expectedSha256 = "sha256:" + "0".repeat(64);
  expectDiagnostic(
    function () { Generator.buildActIArtInventory({ assetDefinitions: drifted }); },
    "ACT_I_ART_INVENTORY_MEASUREMENT",
    "/assetRecords/0/sha256"
  );

  expectDiagnostic(
    function () {
      Generator.buildActIArtInventory({
        limits: Object.assign({}, Generator.PACK_LIMITS, { maxMissionTransferBytes: 1087103 }),
      });
    },
    "ACT_I_ART_INVENTORY_BUDGET",
    "/missionTotals/0/transferBytes"
  );
  expectDiagnostic(
    function () {
      Generator.buildActIArtInventory({
        limits: Object.assign({}, Generator.PACK_LIMITS, { maxMissionDecodedBytes: 14680063 }),
      });
    },
    "ACT_I_ART_INVENTORY_BUDGET",
    "/missionTotals/0/decodedBytes"
  );
  expectDiagnostic(
    function () {
      Generator.buildActIArtInventory({
        limits: Object.assign({}, Generator.PACK_LIMITS, { maxIndividualBytes: 755925 }),
      });
    },
    "ASSET_SIZE",
    "/assetRecords/0/relativeUrl"
  );

  const output = capture();
  assert.equal(Generator.main(["--write"], output.io), 2);
  assert.equal(output.stdout().length, 0);
  assert.match(output.stderr(), /^Usage:/);
});
