/* Armara Aegis local result-card presentation.
   Fixed local artwork is decorative; every result label and statistic is drawn live. */
(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
    return;
  }
  const game = root.Game || (root.Game = {});
  if (Object.prototype.hasOwnProperty.call(game, "AegisShareCard")) {
    throw new Error("Conflicting Game.AegisShareCard is already installed");
  }
  Object.defineProperty(game, "AegisShareCard", {
    value: api,
    writable: false,
    configurable: false,
    enumerable: true,
  });
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const CARD_WIDTH_PX = 1200;
  const CARD_HEIGHT_PX = 675;
  const UINT32_MAX = 4294967295;
  const ASSETS = Object.freeze({
    background: "art/v2/ui/victory-share-v1.webp",
    logo: "skin/armara/logo.png",
  });
  const INPUT_REQUIRED_FIELDS = Object.freeze([
    "widthPx", "heightPx", "outcome", "missionTitle", "score", "waves", "gateHealth",
  ]);
  const INPUT_OPTIONAL_FIELDS = Object.freeze(["challengeLine", "replay"]);
  const MODEL_FIELDS = Object.freeze([
    "schemaVersion", "widthPx", "heightPx", "outcome", "missionTitle", "score",
    "waves", "gateHealth", "challengeLine", "replay",
  ]);
  const CONTROL_TEXT = /[\u0000-\u001f\u007f-\u009f\u2028\u2029\u202a-\u202e\u2066-\u2069]/;
  const UNSAFE_TEXT = /[<>]/;
  const REPLAY_CODE = /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/;
  const MODELS = new WeakSet();

  function deepFreeze(value, seen) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    const visited = seen || new WeakSet();
    if (visited.has(value)) return value;
    visited.add(value);
    Object.keys(value).forEach(function (key) { deepFreeze(value[key], visited); });
    return Object.freeze(value);
  }

  function fail(code, path, message) {
    const error = new RangeError(message);
    Object.defineProperties(error, {
      name: { value: "ShareCardDiagnosticError", enumerable: false },
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

  function exactRecord(value, fields, code, path, label) {
    if (!isPlainRecord(value)) fail(code, path, label + " must be a plain object");
    const expected = fields.slice().sort();
    const actual = Object.keys(value).sort();
    const unexpected = actual.find(function (key) { return expected.indexOf(key) === -1; });
    if (unexpected) fail(code, path + "/" + unexpected, label + " contains unknown field " + unexpected);
    const missing = expected.find(function (key) { return actual.indexOf(key) === -1; });
    if (missing) fail(code, path + "/" + missing, label + " is missing required field " + missing);
  }

  function validateInputFields(value) {
    if (!isPlainRecord(value)) fail("SHARE_MODEL_FIELDS", "/", "Share-card input must be a plain object");
    const allowed = INPUT_REQUIRED_FIELDS.concat(INPUT_OPTIONAL_FIELDS);
    const actual = Object.keys(value).sort();
    const unexpected = actual.find(function (key) { return allowed.indexOf(key) === -1; });
    if (unexpected) {
      fail("SHARE_MODEL_FIELDS", "/" + unexpected, "Share-card input contains unknown field " + unexpected);
    }
    const missing = INPUT_REQUIRED_FIELDS.find(function (key) {
      return !Object.prototype.hasOwnProperty.call(value, key);
    });
    if (missing) fail("SHARE_MODEL_FIELDS", "/" + missing, "Share-card input is missing " + missing);
  }

  function exactDimension(value, expected, path) {
    if (!Number.isSafeInteger(value) || Object.is(value, -0) || value !== expected) {
      fail("SHARE_DIMENSIONS", path, "Share card dimensions must be exactly 1200 by 675 pixels");
    }
    return value;
  }

  function boundedInteger(value, minimum, maximum, path) {
    if (!Number.isSafeInteger(value) || Object.is(value, -0) || value < minimum || value > maximum) {
      fail(
        "SHARE_INTEGER_RANGE",
        path,
        path.slice(1) + " must be a safe integer from " + minimum + " through " + maximum
      );
    }
    return value;
  }

  function safeText(value, minimum, maximum, path, label) {
    if (typeof value !== "string" || value.length < minimum || value.length > maximum || value.trim() !== value) {
      fail("SHARE_TEXT", path, label + " must be trimmed text from " + minimum + " through " + maximum + " characters");
    }
    if (CONTROL_TEXT.test(value)) fail("SHARE_TEXT_CONTROL", path, label + " cannot contain control or direction characters");
    if (UNSAFE_TEXT.test(value)) fail("SHARE_TEXT_UNSAFE", path, label + " cannot contain angle brackets");
    return value;
  }

  function validateWaves(value) {
    exactRecord(value, ["cleared", "total"], "SHARE_WAVES_FIELDS", "/waves", "Waves");
    const total = boundedInteger(value.total, 1, 999, "/waves/total");
    const cleared = boundedInteger(value.cleared, 0, 999, "/waves/cleared");
    if (cleared > total) {
      fail("SHARE_WAVES_RANGE", "/waves/cleared", "Cleared waves cannot exceed total waves");
    }
    return { cleared: cleared, total: total };
  }

  function validateGateHealth(value) {
    exactRecord(value, ["current", "max"], "SHARE_GATE_FIELDS", "/gateHealth", "Gate health");
    const maximum = boundedInteger(value.max, 1, 1000000, "/gateHealth/max");
    const current = boundedInteger(value.current, 0, 1000000, "/gateHealth/current");
    if (current > maximum) {
      fail("SHARE_GATE_RANGE", "/gateHealth/current", "Current gate health cannot exceed maximum gate health");
    }
    return { current: current, max: maximum };
  }

  function validateReplay(value) {
    if (value === undefined || value === null) return null;
    exactRecord(value, ["code", "seed"], "SHARE_REPLAY_FIELDS", "/replay", "Replay marker");
    if (typeof value.code !== "string" || value.code.length < 6 || value.code.length > 40 ||
        !REPLAY_CODE.test(value.code)) {
      fail(
        "SHARE_REPLAY_CODE",
        "/replay/code",
        "Replay code must be 6 through 40 uppercase ASCII letters, digits, or separated hyphen groups"
      );
    }
    return {
      code: value.code,
      seed: boundedInteger(value.seed, 0, UINT32_MAX, "/replay/seed"),
    };
  }

  function createModel(value) {
    validateInputFields(value);
    exactDimension(value.widthPx, CARD_WIDTH_PX, "/widthPx");
    exactDimension(value.heightPx, CARD_HEIGHT_PX, "/heightPx");
    if (value.outcome !== "victory" && value.outcome !== "defeat") {
      fail("SHARE_OUTCOME", "/outcome", "Share-card outcome must be victory or defeat");
    }
    const challenge = value.challengeLine === undefined || value.challengeLine === null
      ? null
      : safeText(value.challengeLine, 1, 96, "/challengeLine", "Challenge line");
    const model = deepFreeze({
      schemaVersion: 1,
      widthPx: CARD_WIDTH_PX,
      heightPx: CARD_HEIGHT_PX,
      outcome: value.outcome,
      missionTitle: safeText(value.missionTitle, 1, 64, "/missionTitle", "Mission title"),
      score: boundedInteger(value.score, 0, 999999999999, "/score"),
      waves: validateWaves(value.waves),
      gateHealth: validateGateHealth(value.gateHealth),
      challengeLine: challenge,
      replay: validateReplay(value.replay),
    });
    MODELS.add(model);
    return model;
  }

  function requireModel(value) {
    if (!MODELS.has(value)) {
      if (isPlainRecord(value)) {
        const actual = Object.keys(value).sort();
        const expected = MODEL_FIELDS.slice().sort();
        const mismatch = actual.length !== expected.length || actual.some(function (key, index) {
          return key !== expected[index];
        });
        if (mismatch) fail("SHARE_MODEL", "/", "Use createModel before rendering or summarizing a share card");
      }
      fail("SHARE_MODEL", "/", "Use createModel before rendering or summarizing a share card");
    }
    return value;
  }

  function formatInteger(value) {
    return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  function summaryText(modelValue) {
    const model = requireModel(modelValue);
    const parts = [
      model.outcome === "victory" ? "Local victory." : "Defeat.",
      "Mission " + model.missionTitle + ".",
      "Score " + formatInteger(model.score) + ".",
      "Waves " + model.waves.cleared + " of " + model.waves.total + ".",
      "Gate health " + formatInteger(model.gateHealth.current) + " of " + formatInteger(model.gateHealth.max) + ".",
    ];
    if (model.challengeLine) parts.push("Challenge: " + model.challengeLine + ".");
    if (model.replay) {
      parts.push("Replay code " + model.replay.code + ".");
      parts.push("Seed " + formatInteger(model.replay.seed) + ".");
    }
    return parts.join(" ");
  }

  function textStyle(context, font, color, align) {
    context.font = font;
    context.fillStyle = color;
    context.textAlign = align || "left";
    context.textBaseline = "alphabetic";
  }

  function drawLiveText(context, model) {
    const victory = model.outcome === "victory";
    const accent = victory ? "#f7d36a" : "#ff8668";
    const status = victory ? "LOCAL VICTORY" : "DEFEAT";

    textStyle(context, "700 26px Cinzel, Georgia, serif", "#f8edcf");
    context.fillText("ARMARA AEGIS", 196, 82, 600);
    textStyle(context, "800 28px Cinzel, Georgia, serif", accent, "right");
    context.fillText(status, 1136, 82, 430);

    textStyle(context, "800 54px Cinzel, Georgia, serif", "#fff8e5");
    context.fillText(model.missionTitle, 64, 202, 1072);

    context.fillStyle = "rgba(7, 13, 22, 0.74)";
    context.fillRect(64, 250, 1072, 184);
    context.strokeStyle = victory ? "rgba(247, 211, 106, 0.7)" : "rgba(255, 134, 104, 0.7)";
    context.lineWidth = 2;
    context.strokeRect(64, 250, 1072, 184);

    const columns = [104, 456, 808];
    const labels = ["SCORE", "WAVES", "GATE HEALTH"];
    const values = [
      formatInteger(model.score),
      model.waves.cleared + " / " + model.waves.total,
      formatInteger(model.gateHealth.current) + " / " + formatInteger(model.gateHealth.max),
    ];
    labels.forEach(function (label, index) {
      textStyle(context, "700 20px Cinzel, Georgia, serif", "#8be6ef");
      context.fillText(label, columns[index], 305, 280);
      textStyle(context, "800 42px Cinzel, Georgia, serif", "#fff8e5");
      context.fillText(values[index], columns[index], 372, 280);
    });

    if (model.challengeLine) {
      textStyle(context, "700 18px Cinzel, Georgia, serif", accent);
      context.fillText("CHALLENGE", 64, 484, 220);
      textStyle(context, "600 27px Georgia, serif", "#f8edcf");
      context.fillText(model.challengeLine, 64, 524, 1072);
    }

    if (model.replay) {
      textStyle(context, "700 18px ui-monospace, Consolas, monospace", "#9feaf0");
      context.fillText("REPLAY " + model.replay.code, 64, 616, 720);
      textStyle(context, "600 16px ui-monospace, Consolas, monospace", "#cbbf9e", "right");
      context.fillText("SEED " + model.replay.seed, 1136, 616, 320);
    }
  }

  function validateCanvas(canvas) {
    if (!canvas || typeof canvas !== "object" || typeof canvas.getContext !== "function") {
      fail("SHARE_CANVAS", "/render/canvas", "Injected canvas must provide getContext");
    }
    canvas.width = CARD_WIDTH_PX;
    canvas.height = CARD_HEIGHT_PX;
    if (canvas.width !== CARD_WIDTH_PX || canvas.height !== CARD_HEIGHT_PX) {
      fail("SHARE_CANVAS_SIZE", "/render/canvas", "Injected canvas must preserve the exact 1200 by 675 output size");
    }
    const context = canvas.getContext("2d");
    const methods = ["save", "restore", "fillRect", "strokeRect", "drawImage", "fillText"];
    if (!context || methods.some(function (method) { return typeof context[method] !== "function"; })) {
      fail("SHARE_CANVAS_CONTEXT", "/render/canvas", "Injected canvas must provide a complete 2D drawing context");
    }
    return context;
  }

  async function loadAsset(imageLoader, href, path) {
    let image;
    try {
      image = await imageLoader(href);
    } catch (error) {
      fail("SHARE_ASSET_LOAD", path, "Unable to load required local share-card artwork");
    }
    if (!image || (typeof image !== "object" && typeof image !== "function")) {
      fail("SHARE_ASSET_LOAD", path, "Image loader must resolve required local share-card artwork");
    }
    return image;
  }

  async function render(modelValue, dependencies) {
    const model = requireModel(modelValue);
    if (!isPlainRecord(dependencies)) {
      fail("SHARE_RENDER_FIELDS", "/render", "Render dependencies must be a plain object");
    }
    exactRecord(
      dependencies,
      ["canvas", "imageLoader"],
      "SHARE_RENDER_FIELDS",
      "/render",
      "Render dependencies"
    );
    if (typeof dependencies.imageLoader !== "function") {
      fail("SHARE_IMAGE_LOADER", "/render/imageLoader", "Injected imageLoader must be a function");
    }
    const context = validateCanvas(dependencies.canvas);
    const background = await loadAsset(dependencies.imageLoader, ASSETS.background, "/assets/background");
    const logo = await loadAsset(dependencies.imageLoader, ASSETS.logo, "/assets/logo");

    context.save();
    context.drawImage(background, 0, 0, CARD_WIDTH_PX, CARD_HEIGHT_PX);
    context.fillStyle = "rgba(3, 8, 16, 0.26)";
    context.fillRect(0, 0, CARD_WIDTH_PX, CARD_HEIGHT_PX);
    context.drawImage(logo, 64, 44, 112, 112);
    drawLiveText(context, model);
    context.restore();

    const summary = summaryText(model);
    if (typeof dependencies.canvas.setAttribute === "function") {
      dependencies.canvas.setAttribute("role", "img");
      dependencies.canvas.setAttribute("aria-label", summary);
    }
    return Object.freeze({
      canvas: dependencies.canvas,
      model: model,
      widthPx: CARD_WIDTH_PX,
      heightPx: CARD_HEIGHT_PX,
      summary: summary,
    });
  }

  return deepFreeze({
    VERSION: 1,
    CARD_WIDTH_PX: CARD_WIDTH_PX,
    CARD_HEIGHT_PX: CARD_HEIGHT_PX,
    ASSETS: ASSETS,
    createModel: createModel,
    summaryText: summaryText,
    render: render,
  });
});
