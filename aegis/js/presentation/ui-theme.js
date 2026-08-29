/* Armara Aegis code-native interface theme contract.
   Pure presentation data and WCAG contrast math; no DOM, asset, storage, or simulation access. */
(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    let game = root.Game;
    if (game === undefined) {
      game = {};
      root.Game = game;
    }
    if (!game || (typeof game !== "object" && typeof game !== "function")) {
      throw new Error("Cannot install Aegis UI theme into a non-object Game namespace");
    }
    const existing = game.AegisUiTheme;
    if (existing !== undefined && existing !== api) {
      throw new Error("Conflicting Game.AegisUiTheme is already installed");
    }
    if (existing === undefined) {
      Object.defineProperty(game, "AegisUiTheme", {
        value: api,
        enumerable: true,
        configurable: false,
        writable: false,
      });
    }
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.getOwnPropertyNames(value).forEach(function (key) { deepFreeze(value[key]); });
    return Object.freeze(value);
  }

  const COLORS = deepFreeze({
    canvas: "#07111A",
    surface: "#10212C",
    surfaceElevated: "#16323D",
    surfaceQuiet: "#0C1922",
    marble: "#FFF3D1",
    text: "#FFF9EA",
    textMuted: "#D0D3CC",
    gold: "#F7C948",
    bronze: "#C98552",
    cyan: "#27D7FF",
    violet: "#C18CFF",
    danger: "#FF6B85",
    dangerSurface: "#321723",
    warning: "#FFD166",
    warningSurface: "#352914",
    success: "#70F0A8",
    disabledSurface: "#2A3942",
    disabledText: "#CED5D7",
    ink: "#07111A",
  });

  const CSS_VARIABLES = deepFreeze({
    "--aegis-color-canvas": COLORS.canvas,
    "--aegis-color-surface": COLORS.surface,
    "--aegis-color-surface-elevated": COLORS.surfaceElevated,
    "--aegis-color-surface-quiet": COLORS.surfaceQuiet,
    "--aegis-color-marble": COLORS.marble,
    "--aegis-color-text": COLORS.text,
    "--aegis-color-text-muted": COLORS.textMuted,
    "--aegis-color-gold": COLORS.gold,
    "--aegis-color-bronze": COLORS.bronze,
    "--aegis-color-cyan": COLORS.cyan,
    "--aegis-color-violet": COLORS.violet,
    "--aegis-color-danger": COLORS.danger,
    "--aegis-color-danger-surface": COLORS.dangerSurface,
    "--aegis-color-warning": COLORS.warning,
    "--aegis-color-warning-surface": COLORS.warningSurface,
    "--aegis-color-success": COLORS.success,
    "--aegis-color-disabled-surface": COLORS.disabledSurface,
    "--aegis-color-disabled-text": COLORS.disabledText,
    "--aegis-color-ink": COLORS.ink,
  });

  const COMPONENTS = deepFreeze({
    root: "aegis-art",
    panel: "aegis-art-panel",
    panelHeader: "aegis-art-panel-header",
    button: "aegis-art-button",
    compactButton: "aegis-art-button--compact",
    card: "aegis-art-card",
    interactiveCard: "aegis-art-card--interactive",
    chip: "aegis-art-chip",
    tabs: "aegis-art-tabs",
    tab: "aegis-art-tab",
    nav: "aegis-art-nav",
    navItem: "aegis-art-nav-item",
    modalBackdrop: "aegis-art-modal-backdrop",
    modal: "aegis-art-modal",
    sheet: "aegis-art-sheet",
    tooltip: "aegis-art-tooltip",
    divider: "aegis-art-divider",
    liveRegion: "aegis-art-live",
    visuallyHidden: "aegis-art-sr-only",
    safeArea: "aegis-art-safe-area",
    stack: "aegis-art-stack",
    cluster: "aegis-art-cluster",
    grid: "aegis-art-grid",
  });

  const STATES = deepFreeze({
    disabled: { attribute: "aria-disabled", value: "true", className: "is-disabled" },
    unaffordable: { attribute: "data-affordability", value: "unaffordable", className: "is-unaffordable" },
    warning: { attribute: "data-state", value: "warning", className: "is-warning" },
    danger: { attribute: "data-state", value: "danger", className: "is-danger" },
    selected: { attribute: "aria-selected", value: "true", className: "is-selected" },
    current: { attribute: "aria-current", value: "page", className: "is-current" },
  });

  const ACCESSIBILITY = deepFreeze({
    textContrastMinimum: 4.5,
    controlContrastMinimum: 3,
    primaryTargetPx: 48,
    secondaryTargetPx: 44,
    supportedZoomPercent: 200,
    liveTextOnly: true,
    reducedMotionPreservesState: true,
  });

  const LIVE_TEXT_POLICY = deepFreeze({
    bakedLabels: "forbidden",
    labels: "dom-text",
    prices: "dom-text",
    statistics: "dom-text",
    status: "aria-live-or-role-status",
    errors: "role-alert-or-associated-description",
  });

  const TEXT_CONTRAST_PAIRS = deepFreeze([
    { id: "primary-on-canvas", foreground: "text", background: "canvas", minimum: ACCESSIBILITY.textContrastMinimum },
    { id: "primary-on-surface", foreground: "text", background: "surface", minimum: ACCESSIBILITY.textContrastMinimum },
    { id: "muted-on-surface", foreground: "textMuted", background: "surface", minimum: ACCESSIBILITY.textContrastMinimum },
    { id: "ink-on-gold", foreground: "ink", background: "gold", minimum: ACCESSIBILITY.textContrastMinimum },
    { id: "ink-on-cyan", foreground: "ink", background: "cyan", minimum: ACCESSIBILITY.textContrastMinimum },
    { id: "disabled-text", foreground: "disabledText", background: "disabledSurface", minimum: ACCESSIBILITY.textContrastMinimum },
    { id: "warning-text", foreground: "warning", background: "warningSurface", minimum: ACCESSIBILITY.textContrastMinimum },
    { id: "danger-text", foreground: "danger", background: "dangerSurface", minimum: ACCESSIBILITY.textContrastMinimum },
  ]);

  const CONTROL_CONTRAST_PAIRS = deepFreeze([
    { id: "bronze-boundary", foreground: "bronze", background: "canvas", minimum: ACCESSIBILITY.controlContrastMinimum },
    { id: "gold-selected", foreground: "gold", background: "surface", minimum: ACCESSIBILITY.controlContrastMinimum },
    { id: "cyan-focus", foreground: "cyan", background: "surface", minimum: ACCESSIBILITY.controlContrastMinimum },
    { id: "violet-powered", foreground: "violet", background: "surface", minimum: ACCESSIBILITY.controlContrastMinimum },
    { id: "danger-boundary", foreground: "danger", background: "surface", minimum: ACCESSIBILITY.controlContrastMinimum },
    { id: "success-boundary", foreground: "success", background: "surface", minimum: ACCESSIBILITY.controlContrastMinimum },
  ]);

  const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

  function assertHex(value, label) {
    if (typeof value !== "string" || !HEX_COLOR.test(value)) {
      throw new TypeError(label + " must be a six-digit hexadecimal color");
    }
    return value;
  }

  function channelToLinear(value) {
    const normalized = value / 255;
    return normalized <= 0.04045
      ? normalized / 12.92
      : Math.pow((normalized + 0.055) / 1.055, 2.4);
  }

  function relativeLuminance(color) {
    const value = assertHex(color, "Color");
    const red = channelToLinear(parseInt(value.slice(1, 3), 16));
    const green = channelToLinear(parseInt(value.slice(3, 5), 16));
    const blue = channelToLinear(parseInt(value.slice(5, 7), 16));
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  }

  function contrastRatio(foreground, background) {
    const foregroundLuminance = relativeLuminance(foreground);
    const backgroundLuminance = relativeLuminance(background);
    const lighter = Math.max(foregroundLuminance, backgroundLuminance);
    const darker = Math.min(foregroundLuminance, backgroundLuminance);
    return (lighter + 0.05) / (darker + 0.05);
  }

  function normalizeColors(source) {
    if (!source || Object.prototype.toString.call(source) !== "[object Object]") {
      throw new TypeError("Theme colors must be a plain object");
    }
    const expected = Object.keys(COLORS);
    const actual = Object.keys(source);
    const missing = expected.filter(function (key) { return !Object.prototype.hasOwnProperty.call(source, key); });
    const unknown = actual.filter(function (key) { return !Object.prototype.hasOwnProperty.call(COLORS, key); });
    if (missing.length || unknown.length) {
      throw new TypeError("Theme color roles are invalid" +
        (missing.length ? "; missing " + missing.join(", ") : "") +
        (unknown.length ? "; unknown " + unknown.join(", ") : ""));
    }
    const result = {};
    expected.forEach(function (key) { result[key] = assertHex(source[key], "Theme color " + key).toUpperCase(); });
    return result;
  }

  function measurePairs(colors, pairs, label) {
    let minimumRatio = Infinity;
    const measurements = pairs.map(function (pair) {
      const ratio = contrastRatio(colors[pair.foreground], colors[pair.background]);
      if (ratio < pair.minimum) {
        throw new RangeError(label + " contrast pair " + pair.id + " is " + ratio.toFixed(2) +
          ":1; minimum is " + pair.minimum + ":1");
      }
      minimumRatio = Math.min(minimumRatio, ratio);
      return {
        id: pair.id,
        foreground: pair.foreground,
        background: pair.background,
        ratio: ratio,
        minimum: pair.minimum,
      };
    });
    return { minimumRatio: minimumRatio, measurements: measurements };
  }

  function validateTheme(source) {
    const colors = normalizeColors(source || COLORS);
    const text = measurePairs(colors, TEXT_CONTRAST_PAIRS, "Text");
    const controls = measurePairs(colors, CONTROL_CONTRAST_PAIRS, "Control");
    return deepFreeze({
      colors: colors,
      textMinimumRatio: text.minimumRatio,
      controlMinimumRatio: controls.minimumRatio,
      textPairs: text.measurements,
      controlPairs: controls.measurements,
    });
  }

  const VALIDATION = validateTheme(COLORS);

  return deepFreeze({
    ACCESSIBILITY: ACCESSIBILITY,
    COLORS: COLORS,
    COMPONENTS: COMPONENTS,
    CONTROL_CONTRAST_PAIRS: CONTROL_CONTRAST_PAIRS,
    CSS_VARIABLES: CSS_VARIABLES,
    LIVE_TEXT_POLICY: LIVE_TEXT_POLICY,
    STATES: STATES,
    TEXT_CONTRAST_PAIRS: TEXT_CONTRAST_PAIRS,
    VALIDATION: VALIDATION,
    contrastRatio: contrastRatio,
    relativeLuminance: relativeLuminance,
    validateTheme: validateTheme,
  });
});
