"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const { AegisContentError } = require(path.join(REPO_ROOT, "tools", "lib", "aegis", "diagnostics.js"));
const Generator = require(path.join(REPO_ROOT, "tools", "generate-aegis-m01-art-manifest.js"));

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

test("M01 art inventory locks accepted WebPs to measured hashes, dimensions, alpha, and bytes", () => {
  const inventory = Generator.buildM01ArtInventory();
  assert.equal(Object.isFrozen(inventory), true);
  assert.equal(Object.isFrozen(inventory.assetRecords), true);
  assert.deepEqual(inventory.assetRecords.map(function (record) {
    return {
      id: record.id,
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
      id: "asset.m01.environment.gate-of-dawn",
      relativeUrl: "art/v2/m01/environment-gate-of-dawn-v4.webp",
      sha256: "sha256:cb453de14a3e1e99e6e46a0f320f395b679d28aa5c4d29d9613a399d5c8e08ef",
      widthPx: 2048,
      heightPx: 1280,
      alphaMode: "opaque",
      transferBytes: 505022,
      decodedBytes: 10485760,
    },
    {
      id: "asset.m01.foundation.attican",
      relativeUrl: "art/v2/m01/foundation-attican-v1.webp",
      sha256: "sha256:b05c5c7238c8782a2738d27118009fb84754e36344aa1e3b89c3964eb4fe10cf",
      widthPx: 1024,
      heightPx: 1024,
      alphaMode: "alpha",
      transferBytes: 864526,
      decodedBytes: 4194304,
    },
    {
      id: "asset.m01.road.city-cobble",
      relativeUrl: "art/v2/m01/road-city-cobble-v2.webp",
      sha256: "sha256:ac08bb4590e001f0989cde50ab8a71e4a34d4ec4f2b9e8a9c4e4b9014b361cf5",
      widthPx: 1024,
      heightPx: 1024,
      alphaMode: "opaque",
      transferBytes: 332448,
      decodedBytes: 4194304,
    },
    {
      id: "asset.m01.road.earth",
      relativeUrl: "art/v2/m01/road-earth-v2.webp",
      sha256: "sha256:77c380c668fa46a9fec7fa591cd893136d827896376d9ab104f926629529afa4",
      widthPx: 1024,
      heightPx: 1024,
      alphaMode: "opaque",
      transferBytes: 270114,
      decodedBytes: 4194304,
    },
    {
      id: "asset.m01.road.limestone",
      relativeUrl: "art/v2/m01/road-limestone-v2.webp",
      sha256: "sha256:9ef46f2006b038c2f84e5af22946df9719a15e7c4070d13938b7c210138e2136",
      widthPx: 1024,
      heightPx: 1024,
      alphaMode: "opaque",
      transferBytes: 293456,
      decodedBytes: 4194304,
    },
  ]);
  assert.deepEqual(inventory.totals, {
    assetCount: 5,
    transferBytes: 2265566,
    decodedBytes: 27262976,
    maximumDimensionPx: 2048,
    largestAssetId: "asset.m01.foundation.attican",
    largestAssetTransferBytes: 864526,
  });
  assert.deepEqual(inventory.budgets, {
    maxTransferBytes: 3145728,
    remainingTransferBytes: 880162,
    maxDecodedBytes: 67108864,
    remainingDecodedBytes: 39845888,
    maxDimensionPx: 2048,
    maxIndividualBytes: 1048576,
  });
});

test("M01 art inventory bytes and CLI report are canonical and repeatable", () => {
  const first = Generator.buildM01ArtInventory();
  const second = Generator.buildM01ArtInventory();
  const firstBytes = Generator.renderM01ArtInventory(first);
  assert.deepEqual(first, second);
  assert.deepEqual(firstBytes, Generator.renderM01ArtInventory(second));
  assert.equal(firstBytes[firstBytes.length - 1], 0x0a);

  const output = capture();
  assert.equal(Generator.main([], output.io), 0);
  assert.deepEqual(output.stdout(), firstBytes);
  assert.equal(output.stderr(), "");
});

test("M01 art inventory rejects budget exhaustion before emitting a manifest", () => {
  const underBudget = Generator.buildM01ArtInventory();
  expectDiagnostic(
    () => Generator.buildM01ArtInventory({
      limits: Object.assign({}, Generator.PACK_LIMITS, {
        maxTransferBytes: underBudget.totals.transferBytes - 1,
      }),
    }),
    "M01_ART_INVENTORY_BUDGET",
    "/budgets/maxTransferBytes"
  );
  expectDiagnostic(
    () => Generator.buildM01ArtInventory({
      limits: Object.assign({}, Generator.PACK_LIMITS, {
        maxDecodedBytes: underBudget.totals.decodedBytes - 1,
      }),
    }),
    "M01_ART_INVENTORY_BUDGET",
    "/budgets/maxDecodedBytes"
  );
});

test("M01 art inventory rejects reviewed-contract drift and extra CLI arguments", () => {
  const drifted = Generator.ACCEPTED_ASSETS.map(function (record) { return Object.assign({}, record); });
  drifted[0].expectedWidthPx = 1280;
  expectDiagnostic(
    () => Generator.buildM01ArtInventory({ assetDefinitions: drifted }),
    "M01_ART_INVENTORY_MEASUREMENT",
    "/assetRecords/0/widthPx"
  );

  const output = capture();
  assert.equal(Generator.main(["--write"], output.io), 2);
  assert.equal(output.stdout().length, 0);
  assert.match(output.stderr(), /^Usage:/);
});
