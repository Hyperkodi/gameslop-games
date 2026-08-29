"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const THEME_PATH = path.join(__dirname, "..", "js", "presentation", "ui-theme.js");
const CSS_PATH = path.join(__dirname, "..", "css", "aegis-art-system.css");
const Theme = require(THEME_PATH);

function cssText() {
  return fs.readFileSync(CSS_PATH, "utf8");
}

test("UI theme exports a deeply frozen semantic Ancient Greece-meets-AI contract", () => {
  assert.equal(Object.isFrozen(Theme), true);
  ["ACCESSIBILITY", "COLORS", "COMPONENTS", "CSS_VARIABLES", "LIVE_TEXT_POLICY", "STATES", "VALIDATION"].forEach(function (key) {
    assert.equal(Object.isFrozen(Theme[key]), true, key);
  });
  assert.equal(Theme.COLORS.canvas, "#07111A");
  assert.equal(Theme.COLORS.marble, "#FFF3D1");
  assert.equal(Theme.COLORS.bronze, "#C98552");
  assert.equal(Theme.COLORS.gold, "#F7C948");
  assert.equal(Theme.COLORS.cyan, "#27D7FF");
  assert.equal(Theme.COLORS.violet, "#C18CFF");
  assert.deepEqual(Theme.ACCESSIBILITY, {
    textContrastMinimum: 4.5,
    controlContrastMinimum: 3,
    primaryTargetPx: 48,
    secondaryTargetPx: 44,
    supportedZoomPercent: 200,
    liveTextOnly: true,
    reducedMotionPreservesState: true,
  });
  assert.equal(Theme.LIVE_TEXT_POLICY.bakedLabels, "forbidden");
  assert.equal(Theme.LIVE_TEXT_POLICY.prices, "dom-text");
});

test("every declared text and control pairing clears its WCAG threshold", () => {
  const validation = Theme.validateTheme();
  assert.ok(validation.textMinimumRatio >= Theme.ACCESSIBILITY.textContrastMinimum);
  assert.ok(validation.controlMinimumRatio >= Theme.ACCESSIBILITY.controlContrastMinimum);
  validation.textPairs.forEach(function (pair) {
    assert.ok(pair.ratio >= pair.minimum, pair.id + " " + pair.ratio);
  });
  validation.controlPairs.forEach(function (pair) {
    assert.ok(pair.ratio >= pair.minimum, pair.id + " " + pair.ratio);
  });
  assert.equal(Theme.contrastRatio("#000000", "#FFFFFF"), 21);
  assert.equal(Theme.relativeLuminance("#000000"), 0);
  assert.equal(Theme.relativeLuminance("#FFFFFF"), 1);
});

test("theme validation fails closed for missing, malformed, unknown, or low-contrast roles", () => {
  assert.throws(() => Theme.validateTheme({}), /missing/i);
  assert.throws(() => Theme.relativeLuminance("navy"), /hexadecimal/i);
  const malformed = Object.assign({}, Theme.COLORS, { text: "#FFFF" });
  assert.throws(() => Theme.validateTheme(malformed), /hexadecimal/i);
  const unknown = Object.assign({}, Theme.COLORS, { extra: "#FFFFFF" });
  assert.throws(() => Theme.validateTheme(unknown), /unknown/i);
  const deficient = Object.assign({}, Theme.COLORS, { text: Theme.COLORS.canvas });
  assert.throws(() => Theme.validateTheme(deficient), /Text contrast pair primary-on-canvas.*minimum/i);
});

test("CSS color tokens exactly mirror the JavaScript contract", () => {
  const css = cssText();
  Object.keys(Theme.CSS_VARIABLES).forEach(function (variable) {
    const declaration = variable + ": " + Theme.CSS_VARIABLES[variable] + ";";
    assert.ok(css.includes(declaration), declaration);
  });
  assert.doesNotMatch(css, /url\s*\(/i, "the code-native kit must not integrate raster assets");
});

test("CSS exposes every component and semantic non-color state", () => {
  const css = cssText();
  Object.keys(Theme.COMPONENTS).forEach(function (key) {
    assert.match(css, new RegExp("\\." + Theme.COMPONENTS[key].replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?:[\\s,.:{[]|$)"), key);
  });
  assert.match(css, /:focus-visible/);
  assert.match(css, /\[aria-disabled="true"\]/);
  assert.match(css, /\[data-affordability="unaffordable"\]/);
  assert.match(css, /\[data-state="warning"\]/);
  assert.match(css, /\[aria-selected="true"\]/);
  assert.match(css, /\[aria-current="page"\]/);
  assert.match(css, /--aegis-target-primary:\s*3rem/);
  assert.match(css, /--aegis-target-secondary:\s*2\.75rem/);
});

test("CSS preserves safe areas, reflow, live text, reduced motion, and forced-color operation", () => {
  const css = cssText();
  [
    "env(safe-area-inset-top)",
    "env(safe-area-inset-right)",
    "env(safe-area-inset-bottom)",
    "env(safe-area-inset-left)",
    "@media (max-width: 48rem)",
    "@media (max-width: 30rem)",
    "@media (prefers-reduced-motion: reduce)",
    "@media (prefers-contrast: more)",
    "@media (forced-colors: active)",
    "overflow-wrap: anywhere",
    "min-inline-size: 0",
    "max-inline-size: 100%",
  ].forEach(function (required) { assert.ok(css.includes(required), required); });
  assert.doesNotMatch(css, /font-size:\s*\d+(?:\.\d+)?px/i, "font sizes must reflow at 200% zoom");
  assert.doesNotMatch(css, /content:\s*["'][^"']+[^"']["']/i, "pseudo-elements cannot supply user-facing text");
});

test("classic-script install is pure, frozen, and collision-safe", () => {
  const source = fs.readFileSync(THEME_PATH, "utf8");
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
    location: forbiddenCapability("location"),
    navigator: forbiddenCapability("navigator"),
  };
  const context = vm.createContext(Object.assign({}, capabilities));
  vm.runInContext(source, context, { filename: "ui-theme.js" });
  assert.ok(context.Game);
  assert.equal(context.Game.AegisUiTheme.COLORS.gold, "#F7C948");
  assert.equal(Object.isFrozen(context.Game.AegisUiTheme), true);
  Object.keys(capabilities).forEach(function (key) { assert.strictEqual(context[key], capabilities[key], key); });

  const collision = Object.freeze({ owner: "other-theme" });
  const collisionContext = vm.createContext({ Game: { AegisUiTheme: collision } });
  assert.throws(
    () => vm.runInContext(source, collisionContext, { filename: "ui-theme.js" }),
    /Conflicting Game\.AegisUiTheme/
  );
  assert.strictEqual(collisionContext.Game.AegisUiTheme, collision);
});
