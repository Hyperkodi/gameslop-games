"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const AEGIS_ROOT = path.join(REPO_ROOT, "games", "aegis");
const Inspector = require(path.join(REPO_ROOT, "tools", "lib", "aegis", "asset-inspector.js"));
const SpriteAtlas = require(path.join(AEGIS_ROOT, "js", "presentation", "sprite-atlas.js"));

const ACCEPTED_ATLASES = Object.freeze([
  Object.freeze({
    id: "enemy.echo", kind: "enemy", relativeUrl: "art/v2/shared/enemies/echo-anim-v1.webp",
    sha256: "sha256:509b44ec4738197a6899c5aae2e4ca57cd5dd3d5a334b58f839530560ec1900b",
    transferBytes: 134298, transparentPixelCount: 397476, clearPixelCount: 398016,
    translucentPixelCount: 30825, opaquePixelCount: 95987, clearPixelBasisPoints: 7591,
    minimumFrameClearPixelBasisPoints: 7254, visiblePerimeterPixelCount: 0,
    maximumFrameVisiblePerimeterBasisPoints: 0,
  }),
  Object.freeze({
    id: "enemy.guardian", kind: "enemy", relativeUrl: "art/v2/shared/enemies/guardian-anim-v1.webp",
    sha256: "sha256:61a35902ec0f4dece345145735c753b803d2147195c363f5cbf443cc53d02be0",
    transferBytes: 152328, transparentPixelCount: 333840, clearPixelCount: 334025,
    translucentPixelCount: 6123, opaquePixelCount: 184325, clearPixelBasisPoints: 6371,
    minimumFrameClearPixelBasisPoints: 5996, visiblePerimeterPixelCount: 230,
    maximumFrameVisiblePerimeterBasisPoints: 705,
  }),
  Object.freeze({
    id: "enemy.talos", kind: "enemy", relativeUrl: "art/v2/shared/enemies/talos-anim-v1.webp",
    sha256: "sha256:ddd0ac5acea63d564f089a3c4f78f3e3ffaf6b906cffc81f3c23643c0f1867ba",
    transferBytes: 158492, transparentPixelCount: 339953, clearPixelCount: 340185,
    translucentPixelCount: 9510, opaquePixelCount: 174825, clearPixelBasisPoints: 6488,
    minimumFrameClearPixelBasisPoints: 5890, visiblePerimeterPixelCount: 69,
    maximumFrameVisiblePerimeterBasisPoints: 343,
  }),
  Object.freeze({
    id: "enemy.titan", kind: "enemy", relativeUrl: "art/v2/shared/enemies/titan-anim-v1.webp",
    sha256: "sha256:79ff05802b8fcbdaaa98ee0c46cd2d7e3a8bb8e387bb3b219cfc6ea96b8ee37f",
    transferBytes: 144356, transparentPixelCount: 349356, clearPixelCount: 349581,
    translucentPixelCount: 7344, opaquePixelCount: 167588, clearPixelBasisPoints: 6667,
    minimumFrameClearPixelBasisPoints: 6186, visiblePerimeterPixelCount: 26,
    maximumFrameVisiblePerimeterBasisPoints: 88,
  }),
  Object.freeze({
    id: "tower.hoplite", kind: "tower", relativeUrl: "art/v2/shared/towers/hoplite-anim-v1.webp",
    sha256: "sha256:2b664ef267b2c4cb6a13b39edbd5ceee09c7617bac2c6e22a45db4348608e88f",
    transferBytes: 163186, transparentPixelCount: 580283, clearPixelCount: 580327,
    translucentPixelCount: 1372, opaquePixelCount: 204777, clearPixelBasisPoints: 7379,
    minimumFrameClearPixelBasisPoints: 7028, visiblePerimeterPixelCount: 0,
    maximumFrameVisiblePerimeterBasisPoints: 0,
  }),
  Object.freeze({
    id: "tower.oracle", kind: "tower", relativeUrl: "art/v2/shared/towers/oracle-anim-v1.webp",
    sha256: "sha256:5c3562f08d62657a4490deee5560458a6be8d0f343535ccb105c46b6b8eff4e9",
    transferBytes: 244404, transparentPixelCount: 464517, clearPixelCount: 464649,
    translucentPixelCount: 3491, opaquePixelCount: 318424, clearPixelBasisPoints: 5908,
    minimumFrameClearPixelBasisPoints: 4970, visiblePerimeterPixelCount: 7,
    maximumFrameVisiblePerimeterBasisPoints: 39,
  }),
]);

function atlasOptions(kind) {
  return {
    columns: 4,
    rows: kind === "tower" ? 3 : 2,
    frameWidthPx: 256,
    frameHeightPx: 256,
  };
}

test("shared Act I tower and enemy atlases lock accepted alpha, gutters, hashes, and budgets", () => {
  let transferBytes = 0;
  let decodedBytes = 0;
  let frameCount = 0;

  ACCEPTED_ATLASES.forEach(function (accepted) {
    const measured = Inspector.inspectAtlasAsset(
      AEGIS_ROOT,
      accepted.relativeUrl,
      atlasOptions(accepted.kind)
    );
    const expectedHeight = accepted.kind === "tower" ? 768 : 512;
    const expectedDecodedBytes = 1024 * expectedHeight * 4;

    assert.deepEqual(measured.inspection, {
      relativeUrl: accepted.relativeUrl,
      format: "webp",
      sha256: accepted.sha256,
      widthPx: 1024,
      heightPx: expectedHeight,
      alphaMode: "alpha",
      transferBytes: accepted.transferBytes,
      decodedBytes: expectedDecodedBytes,
    });
    assert.deepEqual({
      transparentPixelCount: measured.transparency.transparentPixelCount,
      clearPixelCount: measured.transparency.clearPixelCount,
      translucentPixelCount: measured.transparency.translucentPixelCount,
      opaquePixelCount: measured.transparency.opaquePixelCount,
      clearPixelBasisPoints: measured.transparency.clearPixelBasisPoints,
      minimumFrameClearPixelBasisPoints: measured.transparency.minimumFrameClearPixelBasisPoints,
      visiblePerimeterPixelCount: measured.transparency.visiblePerimeterPixelCount,
      maximumFrameVisiblePerimeterBasisPoints:
        measured.transparency.maximumFrameVisiblePerimeterBasisPoints,
    }, {
      transparentPixelCount: accepted.transparentPixelCount,
      clearPixelCount: accepted.clearPixelCount,
      translucentPixelCount: accepted.translucentPixelCount,
      opaquePixelCount: accepted.opaquePixelCount,
      clearPixelBasisPoints: accepted.clearPixelBasisPoints,
      minimumFrameClearPixelBasisPoints: accepted.minimumFrameClearPixelBasisPoints,
      visiblePerimeterPixelCount: accepted.visiblePerimeterPixelCount,
      maximumFrameVisiblePerimeterBasisPoints: accepted.maximumFrameVisiblePerimeterBasisPoints,
    });
    assert.equal(
      measured.transparency.transparentPixelCount + measured.transparency.translucentPixelCount +
        measured.transparency.opaquePixelCount,
      measured.transparency.totalPixelCount
    );
    assert.equal(measured.transparency.visibleMagentaPerimeterPixelCount, 0);
    assert.equal(measured.transparency.visibleMagentaCornerPixelCount, 0);
    assert.equal(measured.transparency.maximumFrameVisibleMagentaCornerBasisPoints, 0);

    transferBytes += measured.inspection.transferBytes;
    decodedBytes += measured.inspection.decodedBytes;
    frameCount += accepted.kind === "tower" ? 12 : 8;
  });

  assert.equal(transferBytes, 997064);
  assert.ok(transferBytes <= 3 * 1024 * 1024);
  assert.equal(decodedBytes, 14680064);
  assert.ok(decodedBytes <= 16 * 1024 * 1024);
  assert.equal(frameCount, 56);
});

test("shared animation contracts retain their exact upgrade and combat frame meanings", () => {
  const tower = SpriteAtlas.createTowerAtlasMetadata("shared.tower.contract.v1");
  assert.deepEqual(SpriteAtlas.TOWER_FRAME_NAMES, ["idleA", "idleB", "active", "recover"]);
  [1, 2, 3].forEach(function (level) {
    SpriteAtlas.TOWER_FRAME_NAMES.forEach(function (frameName, column) {
      const frame = SpriteAtlas.towerFrame(tower, level, frameName);
      assert.equal(frame.row, level - 1);
      assert.equal(frame.column, column);
      assert.deepEqual(frame.rectangle, {
        x: column * 256,
        y: (level - 1) * 256,
        width: 256,
        height: 256,
      });
    });
  });

  const enemy = SpriteAtlas.createEnemyAtlasMetadata("shared.enemy.contract.v1");
  assert.deepEqual(
    SpriteAtlas.ENEMY_FRAME_NAMES,
    ["idleA", "idleB", "runA", "runB", "runC", "hit", "stagger", "defeat"]
  );
  SpriteAtlas.ENEMY_FRAME_NAMES.forEach(function (frameName, index) {
    const frame = SpriteAtlas.enemyFrame(enemy, frameName);
    assert.equal(frame.row, Math.floor(index / 4));
    assert.equal(frame.column, index % 4);
  });
});
