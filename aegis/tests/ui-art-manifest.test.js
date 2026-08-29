"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const REPO_ROOT = path.resolve(__dirname, "../../..");
const { AegisContentError } = require(path.join(REPO_ROOT, "tools/lib/aegis/diagnostics.js"));
const Generator = require(path.join(REPO_ROOT, "tools/generate-aegis-ui-art-manifest.js"));

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

test("global UI inventory locks exactly the eight accepted opaque WebPs", function () {
  const inventory = Generator.buildUiArtInventory();
  const actualFiles = fs.readdirSync(path.join(REPO_ROOT, "games/aegis/art/v2/ui")).sort();
  assert.deepEqual(actualFiles, Generator.ACCEPTED_ASSETS.map(function (record) {
    return path.basename(record.relativeUrl);
  }).sort());
  assert.equal(Object.isFrozen(inventory), true);
  assert.equal(Object.isFrozen(inventory.assetRecords), true);
  assert.deepEqual(inventory.assetRecords.map(function (record) {
    return {
      id: record.id,
      usage: record.usage,
      relativeUrl: record.relativeUrl,
      sha256: record.sha256,
      widthPx: record.widthPx,
      heightPx: record.heightPx,
      alphaMode: record.alphaMode,
      transferBytes: record.transferBytes,
      decodedBytes: record.decodedBytes,
    };
  }), [
    {
      id: "asset.ui.act-1.attican",
      usage: "act-banner",
      relativeUrl: "art/v2/ui/act-1-attican-v1.webp",
      sha256: "sha256:74436d1282be0c0f75f4b54cf4f55a8f49050f4a4d5e5fafdcdc4bcd970bc318",
      widthPx: 1536,
      heightPx: 512,
      alphaMode: "opaque",
      transferBytes: 96646,
      decodedBytes: 3145728,
    },
    {
      id: "asset.ui.act-2.aegean",
      usage: "act-banner",
      relativeUrl: "art/v2/ui/act-2-aegean-v1.webp",
      sha256: "sha256:a003a2845d01941db5cc9c33c8d39f1b82f182a445681634fbf7cdd30a76dd00",
      widthPx: 1536,
      heightPx: 512,
      alphaMode: "opaque",
      transferBytes: 114116,
      decodedBytes: 3145728,
    },
    {
      id: "asset.ui.act-3.oracle",
      usage: "act-banner",
      relativeUrl: "art/v2/ui/act-3-oracle-v1.webp",
      sha256: "sha256:166d07726db6f5feb2f19eaf084c82b818a90936328b3e1cd37db01f783d7083",
      widthPx: 1536,
      heightPx: 512,
      alphaMode: "opaque",
      transferBytes: 99210,
      decodedBytes: 3145728,
    },
    {
      id: "asset.ui.act-4.titan",
      usage: "act-banner",
      relativeUrl: "art/v2/ui/act-4-titan-v1.webp",
      sha256: "sha256:f79cfa5fbfa9054e112526c71bb44cb35fe706cc1271dc73c54016348efdbe61",
      widthPx: 1536,
      heightPx: 512,
      alphaMode: "opaque",
      transferBytes: 126656,
      decodedBytes: 3145728,
    },
    {
      id: "asset.ui.panel.4x3",
      usage: "ui-panel",
      relativeUrl: "art/v2/ui/panel-4x3-v1.webp",
      sha256: "sha256:c836b8c4361c6b611dcf1ff73ef3de3b36fca2c3c345d6c36692777bf045e540",
      widthPx: 1024,
      heightPx: 768,
      alphaMode: "opaque",
      transferBytes: 42810,
      decodedBytes: 3145728,
    },
    {
      id: "asset.ui.shell.landscape",
      usage: "shell-background",
      relativeUrl: "art/v2/ui/shell-landscape-v1.webp",
      sha256: "sha256:d69c8a853491631e10a02b983d90a188d260818200ea527e0f4ddaf214e114f9",
      widthPx: 2048,
      heightPx: 1280,
      alphaMode: "opaque",
      transferBytes: 323520,
      decodedBytes: 10485760,
    },
    {
      id: "asset.ui.shell.portrait",
      usage: "shell-background",
      relativeUrl: "art/v2/ui/shell-portrait-v1.webp",
      sha256: "sha256:9e9842ef92e64b412fb810eb3185073d6eac055d636ded63e4ab4bd9b2706bc8",
      widthPx: 1000,
      heightPx: 1600,
      alphaMode: "opaque",
      transferBytes: 228712,
      decodedBytes: 6400000,
    },
    {
      id: "asset.ui.victory-share",
      usage: "victory-share-background",
      relativeUrl: "art/v2/ui/victory-share-v1.webp",
      sha256: "sha256:c815e08a1fa9243bc64d91649feca498c353f1976635c2edd0da92abda9e1b39",
      widthPx: 1200,
      heightPx: 630,
      alphaMode: "opaque",
      transferBytes: 102808,
      decodedBytes: 3024000,
    },
  ]);
});

test("global UI inventory proves dimension, individual, and two-megabyte transfer budgets", function () {
  const inventory = Generator.buildUiArtInventory();
  assert.deepEqual(inventory.totals, {
    assetCount: 8,
    transferBytes: 1134478,
    decodedBytes: 35638400,
    maximumDimensionPx: 2048,
    largestAssetId: "asset.ui.shell.landscape",
    largestAssetTransferBytes: 323520,
  });
  assert.deepEqual(inventory.budgets, {
    maxTransferBytes: 2097152,
    remainingTransferBytes: 962674,
    maxDecodedBytes: 67108864,
    remainingDecodedBytes: 31470464,
    maxDimensionPx: 2048,
    maxIndividualBytes: 1048576,
  });
  assert.ok(inventory.assetRecords.every(function (record) {
    return record.widthPx <= 2048 && record.heightPx <= 2048 &&
      record.transferBytes <= 1048576 && record.alphaMode === "opaque";
  }));
  assert.ok(inventory.totals.transferBytes <= 2 * 1024 * 1024);
});

test("global UI inventory output and CLI bytes are canonical and repeatable", function () {
  const first = Generator.buildUiArtInventory();
  const second = Generator.buildUiArtInventory();
  const bytes = Generator.renderUiArtInventory(first);
  assert.deepEqual(first, second);
  assert.deepEqual(bytes, Generator.renderUiArtInventory(second));
  assert.equal(bytes[bytes.length - 1], 0x0a);

  const output = capture();
  assert.equal(Generator.main([], output.io), 0);
  assert.deepEqual(output.stdout(), bytes);
  assert.equal(output.stderr(), "");
});

test("global UI inventory rejects budget exhaustion, measurement drift, and CLI arguments", function () {
  const inventory = Generator.buildUiArtInventory();
  expectDiagnostic(
    function () {
      Generator.buildUiArtInventory({
        limits: Object.assign({}, Generator.PACK_LIMITS, {
          maxTransferBytes: inventory.totals.transferBytes - 1,
        }),
      });
    },
    "UI_ART_INVENTORY_BUDGET",
    "/budgets/maxTransferBytes"
  );
  expectDiagnostic(
    function () {
      Generator.buildUiArtInventory({
        limits: Object.assign({}, Generator.PACK_LIMITS, { maxDimensionPx: 2047 }),
      });
    },
    "ASSET_DIMENSION",
    "/assetRecords/5/relativeUrl"
  );
  expectDiagnostic(
    function () {
      Generator.buildUiArtInventory({
        limits: Object.assign({}, Generator.PACK_LIMITS, { maxIndividualBytes: 323519 }),
      });
    },
    "ASSET_SIZE",
    "/assetRecords/5/relativeUrl"
  );

  const drifted = Generator.ACCEPTED_ASSETS.map(function (record) { return Object.assign({}, record); });
  drifted[0].expectedSha256 = "sha256:" + "0".repeat(64);
  expectDiagnostic(
    function () { Generator.buildUiArtInventory({ assetDefinitions: drifted }); },
    "UI_ART_INVENTORY_MEASUREMENT",
    "/assetRecords/0/sha256"
  );

  const output = capture();
  assert.equal(Generator.main(["--write"], output.io), 2);
  assert.equal(output.stdout().length, 0);
  assert.match(output.stderr(), /^Usage:/);
});
