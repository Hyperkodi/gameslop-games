/* Armara Aegis code-native sprite-atlas presentation contract.
   Pure geometry only: validates accepted 256px grids and returns deterministic CSS/SVG crops. */
(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
    return;
  }
  const game = root.Game || (root.Game = {});
  if (Object.prototype.hasOwnProperty.call(game, "AegisSpriteAtlas")) {
    if (game.AegisSpriteAtlas !== api) throw new Error("Game.AegisSpriteAtlas is already installed");
    return;
  }
  Object.defineProperty(game, "AegisSpriteAtlas", {
    value: api,
    writable: false,
    configurable: false,
    enumerable: true,
  });
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const FRAME_SIZE_PX = 256;
  const METADATA_FIELDS = Object.freeze([
    "id", "kind", "widthPx", "heightPx", "frameWidthPx", "frameHeightPx", "columns", "rows",
  ]);
  const STABLE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
  const ENEMY_FRAME_NAMES = Object.freeze([
    "idleA", "idleB", "runA", "runB",
    "runC", "hit", "stagger", "defeat",
  ]);
  const TOWER_FRAME_NAMES = Object.freeze(["idleA", "idleB", "active", "recover"]);
  const ENEMY_SEQUENCES = deepFreeze({
    movement: ["idleA", "idleB", "runA", "runB"],
    combat: ["runC", "hit", "stagger", "defeat"],
  });
  const TOWER_SEQUENCES = deepFreeze({
    idle: ["idleA", "idleB"],
    action: ["active", "recover"],
  });
  const REDUCED_MOTION_FRAMES = deepFreeze({
    enemy: { movement: "idleB", combat: "defeat" },
    tower: { idle: "idleA", action: "active" },
  });
  const CONTRACTS = deepFreeze({
    enemy: {
      widthPx: 1024,
      heightPx: 512,
      frameWidthPx: FRAME_SIZE_PX,
      frameHeightPx: FRAME_SIZE_PX,
      columns: 4,
      rows: 2,
    },
    tower: {
      widthPx: 1024,
      heightPx: 768,
      frameWidthPx: FRAME_SIZE_PX,
      frameHeightPx: FRAME_SIZE_PX,
      columns: 4,
      rows: 3,
    },
  });

  function deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.keys(value).forEach(function (key) { deepFreeze(value[key]); });
    return Object.freeze(value);
  }

  function fail(code, path, message) {
    const error = new RangeError(message);
    Object.defineProperties(error, {
      name: { value: "SpriteAtlasDiagnosticError", enumerable: false },
      code: { value: code, enumerable: true },
      path: { value: path, enumerable: true },
    });
    throw Object.freeze(error);
  }

  function isPlainRecord(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  function exactFields(value, fields, code, path, label) {
    if (!isPlainRecord(value)) fail(code, path, label + " must be a plain object");
    const actual = Object.keys(value).sort();
    const expected = fields.slice().sort();
    if (actual.length !== expected.length || actual.some(function (key, index) {
      return key !== expected[index];
    })) {
      fail(code, path, label + " must contain exactly: " + fields.join(", "));
    }
  }

  function validateAtlasMetadata(value) {
    exactFields(value, METADATA_FIELDS, "SPRITE_METADATA_FIELDS", "/", "Atlas metadata");
    if (typeof value.id !== "string" || value.id.length > 128 || !STABLE_ID.test(value.id)) {
      fail("SPRITE_METADATA_ID", "/id", "Atlas id must be a stable ASCII ID of at most 128 characters");
    }
    if (value.kind !== "enemy" && value.kind !== "tower") {
      fail("SPRITE_METADATA_KIND", "/kind", "Atlas kind must be enemy or tower");
    }
    const contract = CONTRACTS[value.kind];
    const label = value.kind === "enemy" ? "Enemy" : "Tower";
    ["widthPx", "heightPx", "frameWidthPx", "frameHeightPx", "columns", "rows"].forEach(function (field) {
      if (!Number.isSafeInteger(value[field]) || Object.is(value[field], -0) || value[field] <= 0) {
        fail("SPRITE_METADATA_INTEGER", "/" + field, "Atlas " + field + " must be a positive safe integer");
      }
      if (value[field] !== contract[field]) {
        fail(
          "SPRITE_METADATA_CONTRACT",
          "/" + field,
          label + " atlas " + field + " must equal " + contract[field]
        );
      }
    });
    if (value.columns * value.frameWidthPx !== value.widthPx ||
        value.rows * value.frameHeightPx !== value.heightPx) {
      fail("SPRITE_METADATA_GRID", "/", "Atlas dimensions must be exactly tiled by its frame grid");
    }
    return Object.freeze({
      id: value.id,
      kind: value.kind,
      widthPx: value.widthPx,
      heightPx: value.heightPx,
      frameWidthPx: value.frameWidthPx,
      frameHeightPx: value.frameHeightPx,
      columns: value.columns,
      rows: value.rows,
    });
  }

  function rangeInteger(value, minimum, maximum, code, path, label) {
    if (!Number.isSafeInteger(value) || Object.is(value, -0) || value < minimum || value > maximum) {
      fail(code, path, label + " must be an integer from " + minimum + " through " + maximum);
    }
    return value;
  }

  function percentage(index, count) {
    if (index === 0) return "0%";
    if (index === count - 1) return "100%";
    return (index * 100 / (count - 1)).toFixed(6).replace(/0+$/, "").replace(/\.$/, "") + "%";
  }

  function frameNameAt(metadata, column, row) {
    if (metadata.kind === "enemy") return ENEMY_FRAME_NAMES[row * metadata.columns + column];
    return TOWER_FRAME_NAMES[column];
  }

  function frameAt(metadataValue, columnValue, rowValue) {
    const metadata = validateAtlasMetadata(metadataValue);
    const column = rangeInteger(
      columnValue, 0, metadata.columns - 1,
      "SPRITE_COLUMN_RANGE", "/column", "Atlas column"
    );
    const row = rangeInteger(
      rowValue, 0, metadata.rows - 1,
      "SPRITE_ROW_RANGE", "/row", "Atlas row"
    );
    const x = column * metadata.frameWidthPx;
    const y = row * metadata.frameHeightPx;
    return deepFreeze({
      atlasId: metadata.id,
      atlasKind: metadata.kind,
      frameName: frameNameAt(metadata, column, row),
      level: metadata.kind === "tower" ? row + 1 : null,
      column: column,
      row: row,
      rectangle: {
        x: x,
        y: y,
        width: metadata.frameWidthPx,
        height: metadata.frameHeightPx,
      },
      css: {
        backgroundSize: (metadata.columns * 100) + "% " + (metadata.rows * 100) + "%",
        backgroundPosition: percentage(column, metadata.columns) + " " + percentage(row, metadata.rows),
        backgroundRepeat: "no-repeat",
      },
      svg: {
        viewBox: x + " " + y + " " + metadata.frameWidthPx + " " + metadata.frameHeightPx,
      },
    });
  }

  function requireKind(metadata, expected, functionName) {
    if (metadata.kind !== expected) {
      fail(
        "SPRITE_ATLAS_KIND",
        "/kind",
        functionName + " requires " + expected + " atlas metadata"
      );
    }
  }

  function enemyFrame(metadataValue, frameName) {
    const metadata = validateAtlasMetadata(metadataValue);
    requireKind(metadata, "enemy", "enemyFrame");
    const index = ENEMY_FRAME_NAMES.indexOf(frameName);
    if (index === -1) {
      fail(
        "SPRITE_FRAME_NAME",
        "/frameName",
        "Enemy frameName must be one of: " + ENEMY_FRAME_NAMES.join(", ")
      );
    }
    return frameAt(metadata, index % metadata.columns, Math.floor(index / metadata.columns));
  }

  function towerFrame(metadataValue, levelValue, frameName) {
    const metadata = validateAtlasMetadata(metadataValue);
    requireKind(metadata, "tower", "towerFrame");
    const level = rangeInteger(
      levelValue, 1, metadata.rows,
      "SPRITE_LEVEL_RANGE", "/level", "Tower level"
    );
    const column = TOWER_FRAME_NAMES.indexOf(frameName);
    if (column === -1) {
      fail(
        "SPRITE_FRAME_NAME",
        "/frameName",
        "Tower frameName must be one of: " + TOWER_FRAME_NAMES.join(", ")
      );
    }
    return frameAt(metadata, column, level - 1);
  }

  function animationRequest(value, metadata) {
    const fields = metadata.kind === "enemy"
      ? ["sequence", "index", "reducedMotion"]
      : ["sequence", "index", "reducedMotion", "level"];
    exactFields(value, fields, "SPRITE_ANIMATION_FIELDS", "/request", "Animation request");
    if (typeof value.reducedMotion !== "boolean") {
      fail("SPRITE_REDUCED_MOTION", "/reducedMotion", "reducedMotion must be boolean");
    }
    const sequences = metadata.kind === "enemy" ? ENEMY_SEQUENCES : TOWER_SEQUENCES;
    if (typeof value.sequence !== "string" || !Object.prototype.hasOwnProperty.call(sequences, value.sequence)) {
      fail(
        "SPRITE_SEQUENCE_NAME",
        "/sequence",
        (metadata.kind === "enemy" ? "Enemy" : "Tower") + " sequence must be one of: " +
          Object.keys(sequences).join(", ")
      );
    }
    const frames = sequences[value.sequence];
    const index = rangeInteger(
      value.index, 0, frames.length - 1,
      "SPRITE_SEQUENCE_INDEX_RANGE", "/index", "Animation index"
    );
    let level = null;
    if (metadata.kind === "tower") {
      level = rangeInteger(
        value.level, 1, metadata.rows,
        "SPRITE_LEVEL_RANGE", "/level", "Tower level"
      );
    }
    return {
      sequence: value.sequence,
      index: index,
      reducedMotion: value.reducedMotion,
      level: level,
      frames: frames,
    };
  }

  function selectAnimationFrame(metadataValue, requestValue) {
    const metadata = validateAtlasMetadata(metadataValue);
    const request = animationRequest(requestValue, metadata);
    const selectedName = request.reducedMotion
      ? REDUCED_MOTION_FRAMES[metadata.kind][request.sequence]
      : request.frames[request.index];
    const frame = metadata.kind === "enemy"
      ? enemyFrame(metadata, selectedName)
      : towerFrame(metadata, request.level, selectedName);
    return deepFreeze(Object.assign({}, frame, {
      animation: {
        sequence: request.sequence,
        requestedIndex: request.index,
        reducedMotion: request.reducedMotion,
        selectedFrameName: selectedName,
      },
    }));
  }

  function createEnemyAtlasMetadata(id) {
    return validateAtlasMetadata(Object.assign({ id: id, kind: "enemy" }, CONTRACTS.enemy));
  }

  function createTowerAtlasMetadata(id) {
    return validateAtlasMetadata(Object.assign({ id: id, kind: "tower" }, CONTRACTS.tower));
  }

  return deepFreeze({
    VERSION: 1,
    FRAME_SIZE_PX: FRAME_SIZE_PX,
    CONTRACTS: CONTRACTS,
    ENEMY_FRAME_NAMES: ENEMY_FRAME_NAMES,
    TOWER_FRAME_NAMES: TOWER_FRAME_NAMES,
    ENEMY_SEQUENCES: ENEMY_SEQUENCES,
    TOWER_SEQUENCES: TOWER_SEQUENCES,
    REDUCED_MOTION_FRAMES: REDUCED_MOTION_FRAMES,
    validateAtlasMetadata: validateAtlasMetadata,
    createEnemyAtlasMetadata: createEnemyAtlasMetadata,
    createTowerAtlasMetadata: createTowerAtlasMetadata,
    frameAt: frameAt,
    enemyFrame: enemyFrame,
    towerFrame: towerFrame,
    selectAnimationFrame: selectAnimationFrame,
  });
});
