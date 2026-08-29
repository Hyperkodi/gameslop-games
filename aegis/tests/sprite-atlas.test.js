"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const MODULE_PATH = path.join(__dirname, "../js/presentation/sprite-atlas.js");
const SpriteAtlas = require(MODULE_PATH);

function enemyMetadata() {
  return {
    id: "atlas.enemy.scout",
    kind: "enemy",
    widthPx: 1024,
    heightPx: 512,
    frameWidthPx: 256,
    frameHeightPx: 256,
    columns: 4,
    rows: 2,
  };
}

function towerMetadata() {
  return {
    id: "atlas.tower.sentinel",
    kind: "tower",
    widthPx: 1024,
    heightPx: 768,
    frameWidthPx: 256,
    frameHeightPx: 256,
    columns: 4,
    rows: 3,
  };
}

function expectDiagnostic(fn, code, diagnosticPath, message) {
  assert.throws(fn, function (error) {
    assert.equal(error.name, "SpriteAtlasDiagnosticError");
    assert.equal(error.code, code);
    assert.equal(error.path, diagnosticPath);
    assert.equal(error.message, message);
    assert.equal(Object.isFrozen(error), true);
    return true;
  });
}

test("strict metadata validation returns frozen defensive copies and installs as UMD", function () {
  const source = enemyMetadata();
  const metadata = SpriteAtlas.validateAtlasMetadata(source);
  assert.deepEqual(metadata, source);
  assert.notStrictEqual(metadata, source);
  assert.equal(Object.isFrozen(metadata), true);
  source.widthPx = 1;
  assert.equal(metadata.widthPx, 1024);
  assert.equal(Object.isFrozen(SpriteAtlas), true);
  assert.equal(Object.isFrozen(SpriteAtlas.ENEMY_FRAME_NAMES), true);
  assert.equal(Object.isFrozen(SpriteAtlas.TOWER_FRAME_NAMES), true);

  const code = fs.readFileSync(MODULE_PATH, "utf8");
  const context = vm.createContext({ Game: {} });
  vm.runInContext(code, context, { filename: "sprite-atlas.js" });
  assert.equal(typeof context.Game.AegisSpriteAtlas.enemyFrame, "function");
  assert.equal(Object.isFrozen(context.Game.AegisSpriteAtlas), true);
});

test("enemy 4x2 contract maps all accepted 256px frames to exact rectangles and positions", function () {
  const metadata = SpriteAtlas.validateAtlasMetadata(enemyMetadata());
  const names = ["idleA", "idleB", "runA", "runB", "runC", "hit", "stagger", "defeat"];
  assert.deepEqual(SpriteAtlas.ENEMY_FRAME_NAMES, names);
  names.forEach(function (name, index) {
    const column = index % 4;
    const row = Math.floor(index / 4);
    const frame = SpriteAtlas.enemyFrame(metadata, name);
    assert.deepEqual(frame.rectangle, {
      x: column * 256,
      y: row * 256,
      width: 256,
      height: 256,
    });
    assert.equal(frame.frameName, name);
    assert.equal(frame.column, column);
    assert.equal(frame.row, row);
    assert.equal(frame.level, null);
    assert.equal(frame.css.backgroundSize, "400% 200%");
    assert.equal(frame.css.backgroundPosition, ["0%", "33.333333%", "66.666667%", "100%"][column] +
      " " + ["0%", "100%"][row]);
    assert.equal(frame.css.backgroundRepeat, "no-repeat");
    assert.equal(frame.svg.viewBox, (column * 256) + " " + (row * 256) + " 256 256");
    assert.equal(Object.isFrozen(frame), true);
    assert.equal(Object.isFrozen(frame.rectangle), true);
    assert.equal(Object.isFrozen(frame.css), true);
  });
});

test("tower 4x3 contract maps level rows and animation columns exactly", function () {
  const metadata = SpriteAtlas.validateAtlasMetadata(towerMetadata());
  const names = ["idleA", "idleB", "active", "recover"];
  assert.deepEqual(SpriteAtlas.TOWER_FRAME_NAMES, names);
  for (let level = 1; level <= 3; level += 1) {
    names.forEach(function (name, column) {
      const frame = SpriteAtlas.towerFrame(metadata, level, name);
      assert.deepEqual(frame.rectangle, {
        x: column * 256,
        y: (level - 1) * 256,
        width: 256,
        height: 256,
      });
      assert.equal(frame.frameName, name);
      assert.equal(frame.level, level);
      assert.equal(frame.column, column);
      assert.equal(frame.row, level - 1);
      assert.equal(frame.css.backgroundSize, "400% 300%");
      assert.equal(frame.css.backgroundPosition, ["0%", "33.333333%", "66.666667%", "100%"][column] +
        " " + ["0%", "50%", "100%"][level - 1]);
      assert.equal(frame.svg.viewBox, (column * 256) + " " + ((level - 1) * 256) + " 256 256");
    });
  }
});

test("animation selection is deterministic and reduced motion chooses meaningful static poses", function () {
  const enemy = SpriteAtlas.validateAtlasMetadata(enemyMetadata());
  assert.deepEqual([0, 1, 2, 3].map(function (index) {
    return SpriteAtlas.selectAnimationFrame(enemy, {
      sequence: "movement", index: index, reducedMotion: false,
    }).frameName;
  }), ["idleA", "idleB", "runA", "runB"]);
  assert.deepEqual([0, 1, 2, 3].map(function (index) {
    return SpriteAtlas.selectAnimationFrame(enemy, {
      sequence: "combat", index: index, reducedMotion: false,
    }).frameName;
  }), ["runC", "hit", "stagger", "defeat"]);
  assert.equal(SpriteAtlas.selectAnimationFrame(enemy, {
    sequence: "movement", index: 3, reducedMotion: true,
  }).frameName, "idleB");
  assert.equal(SpriteAtlas.selectAnimationFrame(enemy, {
    sequence: "combat", index: 0, reducedMotion: true,
  }).frameName, "defeat");

  const tower = SpriteAtlas.validateAtlasMetadata(towerMetadata());
  assert.deepEqual([0, 1].map(function (index) {
    return SpriteAtlas.selectAnimationFrame(tower, {
      sequence: "idle", index: index, reducedMotion: false, level: 2,
    }).frameName;
  }), ["idleA", "idleB"]);
  assert.deepEqual([0, 1].map(function (index) {
    return SpriteAtlas.selectAnimationFrame(tower, {
      sequence: "action", index: index, reducedMotion: false, level: 3,
    }).frameName;
  }), ["active", "recover"]);
  assert.equal(SpriteAtlas.selectAnimationFrame(tower, {
    sequence: "idle", index: 1, reducedMotion: true, level: 1,
  }).frameName, "idleA");
  assert.equal(SpriteAtlas.selectAnimationFrame(tower, {
    sequence: "action", index: 1, reducedMotion: true, level: 3,
  }).frameName, "active");
});

test("metadata, coordinates, levels, names, and animation indexes fail with exact diagnostics", function () {
  const extra = Object.assign({}, enemyMetadata(), { gutterPx: 0 });
  expectDiagnostic(
    function () { SpriteAtlas.validateAtlasMetadata(extra); },
    "SPRITE_METADATA_FIELDS",
    "/",
    "Atlas metadata must contain exactly: id, kind, widthPx, heightPx, frameWidthPx, frameHeightPx, columns, rows"
  );
  expectDiagnostic(
    function () { SpriteAtlas.validateAtlasMetadata(Object.assign({}, enemyMetadata(), { widthPx: 768 })); },
    "SPRITE_METADATA_CONTRACT",
    "/widthPx",
    "Enemy atlas widthPx must equal 1024"
  );

  const enemy = SpriteAtlas.validateAtlasMetadata(enemyMetadata());
  expectDiagnostic(
    function () { SpriteAtlas.frameAt(enemy, 4, 0); },
    "SPRITE_COLUMN_RANGE",
    "/column",
    "Atlas column must be an integer from 0 through 3"
  );
  expectDiagnostic(
    function () { SpriteAtlas.frameAt(enemy, 0, 2); },
    "SPRITE_ROW_RANGE",
    "/row",
    "Atlas row must be an integer from 0 through 1"
  );
  expectDiagnostic(
    function () { SpriteAtlas.enemyFrame(enemy, "breach"); },
    "SPRITE_FRAME_NAME",
    "/frameName",
    "Enemy frameName must be one of: idleA, idleB, runA, runB, runC, hit, stagger, defeat"
  );
  expectDiagnostic(
    function () {
      SpriteAtlas.selectAnimationFrame(enemy, {
        sequence: "movement", index: 4, reducedMotion: false,
      });
    },
    "SPRITE_SEQUENCE_INDEX_RANGE",
    "/index",
    "Animation index must be an integer from 0 through 3"
  );

  const tower = SpriteAtlas.validateAtlasMetadata(towerMetadata());
  expectDiagnostic(
    function () { SpriteAtlas.towerFrame(tower, 0, "idleA"); },
    "SPRITE_LEVEL_RANGE",
    "/level",
    "Tower level must be an integer from 1 through 3"
  );
  expectDiagnostic(
    function () { SpriteAtlas.towerFrame(tower, 4, "idleA"); },
    "SPRITE_LEVEL_RANGE",
    "/level",
    "Tower level must be an integer from 1 through 3"
  );
  expectDiagnostic(
    function () {
      SpriteAtlas.selectAnimationFrame(tower, {
        sequence: "action", index: 2, reducedMotion: false, level: 1,
      });
    },
    "SPRITE_SEQUENCE_INDEX_RANGE",
    "/index",
    "Animation index must be an integer from 0 through 1"
  );
});
