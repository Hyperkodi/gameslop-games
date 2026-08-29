/* Armara Aegis fixed tactical camera and contain-projection contract.
   Pure presentation module: it never reads DOM bounds, routes, pads, art, or simulation state. */
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
      throw new Error("Cannot install Aegis camera into a non-object Game namespace");
    }
    const existing = game.AegisCamera;
    if (existing !== undefined && existing !== api) {
      throw new Error("Conflicting Game.AegisCamera is already installed");
    }
    if (existing === undefined) {
      Object.defineProperty(game, "AegisCamera", {
        value: api,
        enumerable: true,
        configurable: false,
        writable: false,
      });
    }
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const ASPECT_WIDTH = 8;
  const ASPECT_HEIGHT = 5;
  const DISTANCE_SCALE = 1000;
  const CAMERA_FIELDS = Object.freeze(["id", "x", "y", "width", "height"]);
  const BOUNDS_FIELDS = Object.freeze(["x", "y", "width", "height"]);
  const ASSET_FIELDS = Object.freeze(["width", "height"]);
  const VIEWPORT_FIELDS = Object.freeze(["width", "height", "devicePixelRatio"]);
  const POINT_FIELDS = Object.freeze(["x", "y"]);
  const STABLE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
  const CANONICAL_CAMERA_ID = "camera.overscan-16x10-v1";
  const CANONICAL_CAMERA_TUPLE = Object.freeze({
    x: -18000,
    y: -12000,
    width: 198400,
    height: 124000,
  });
  const assetProjections = new WeakSet();
  const screenProjections = new WeakSet();

  function deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.getOwnPropertyNames(value).forEach(function (key) { deepFreeze(value[key]); });
    return Object.freeze(value);
  }

  function isPlainObject(value) {
    if (!value || Object.prototype.toString.call(value) !== "[object Object]") return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  function exactFields(value, required, allowed, label) {
    if (!isPlainObject(value)) throw new TypeError(label + " must be a plain object");
    const keys = Object.keys(value);
    const missing = required.filter(function (key) { return !Object.prototype.hasOwnProperty.call(value, key); });
    const unknown = keys.filter(function (key) { return allowed.indexOf(key) === -1; });
    if (missing.length || unknown.length) {
      throw new TypeError(label + " fields are invalid" +
        (missing.length ? "; missing " + missing.join(", ") : "") +
        (unknown.length ? "; unknown " + unknown.join(", ") : ""));
    }
  }

  function assertSafeInteger(value, label) {
    if (!Number.isSafeInteger(value) || Object.is(value, -0)) {
      throw new TypeError(label + " must be a safe integer and not negative zero");
    }
    return value;
  }

  function assertPositiveSafeInteger(value, label) {
    assertSafeInteger(value, label);
    if (value <= 0) throw new RangeError(label + " must be positive");
    return value;
  }

  function assertFiniteSafeNumber(value, label) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new TypeError(label + " must be a finite number");
    }
    if (Math.abs(value) > Number.MAX_SAFE_INTEGER) {
      throw new RangeError(label + " must stay in the safe numeric range");
    }
    return value;
  }

  function assertPositiveFiniteSafeNumber(value, label) {
    assertFiniteSafeNumber(value, label);
    if (value <= 0) throw new RangeError(label + " must be positive");
    return value;
  }

  function checkedAdd(left, right, label) {
    const result = left + right;
    if (!Number.isSafeInteger(result)) throw new RangeError(label + " exceeds the safe integer range");
    return result;
  }

  function checkedDifference(left, right, label) {
    const result = left - right;
    if (!Number.isSafeInteger(result)) throw new RangeError(label + " exceeds the safe integer range");
    return result;
  }

  function checkedFiniteProduct(left, right, label) {
    const result = left * right;
    return assertFiniteSafeNumber(result, label);
  }

  function checkedFiniteAdd(left, right, label) {
    const result = left + right;
    return assertFiniteSafeNumber(result, label);
  }

  function assertEightByFive(width, height, label) {
    if (width % ASPECT_WIDTH !== 0 || height % ASPECT_HEIGHT !== 0 ||
        width / ASPECT_WIDTH !== height / ASPECT_HEIGHT) {
      throw new RangeError(label + " must have the exact 8:5 aspect ratio");
    }
  }

  function stableId(value, label) {
    if (typeof value !== "string" || !STABLE_ID.test(value)) {
      throw new TypeError(label + " must be a stable ASCII ID");
    }
    return value;
  }

  function normalizeBounds(source, label) {
    exactFields(source, BOUNDS_FIELDS, BOUNDS_FIELDS, label);
    const x = assertSafeInteger(source.x, label + " x");
    const y = assertSafeInteger(source.y, label + " y");
    const width = assertPositiveSafeInteger(source.width, label + " width");
    const height = assertPositiveSafeInteger(source.height, label + " height");
    checkedAdd(x, width, label + " right edge");
    checkedAdd(y, height, label + " bottom edge");
    return { x: x, y: y, width: width, height: height };
  }

  function normalizeCamera(source) {
    exactFields(source, CAMERA_FIELDS, CAMERA_FIELDS, "Camera");
    const id = stableId(source.id, "Camera id");
    const x = assertSafeInteger(source.x, "Camera x");
    const y = assertSafeInteger(source.y, "Camera y");
    const width = assertPositiveSafeInteger(source.width, "Camera width");
    const height = assertPositiveSafeInteger(source.height, "Camera height");
    assertEightByFive(width, height, "Camera");
    checkedAdd(x, width, "Camera right edge");
    checkedAdd(y, height, "Camera bottom edge");
    if (id === CANONICAL_CAMERA_ID &&
        (x !== CANONICAL_CAMERA_TUPLE.x || y !== CANONICAL_CAMERA_TUPLE.y ||
         width !== CANONICAL_CAMERA_TUPLE.width || height !== CANONICAL_CAMERA_TUPLE.height)) {
      throw new RangeError("Canonical camera id must use its exact reviewed coordinate tuple");
    }
    return { id: id, x: x, y: y, width: width, height: height };
  }

  function containsBoundsUnchecked(camera, bounds) {
    const cameraRight = camera.x + camera.width;
    const cameraBottom = camera.y + camera.height;
    const boundsRight = bounds.x + bounds.width;
    const boundsBottom = bounds.y + bounds.height;
    return bounds.x >= camera.x && bounds.y >= camera.y &&
      boundsRight <= cameraRight && boundsBottom <= cameraBottom;
  }

  const BOARD_BOUNDS = deepFreeze(normalizeBounds({
    x: 0,
    y: 0,
    width: 160 * DISTANCE_SCALE,
    height: 100 * DISTANCE_SCALE,
  }, "Board bounds"));

  function validateCamera(source, requiredBounds) {
    const camera = normalizeCamera(source);
    if (!containsBoundsUnchecked(camera, BOARD_BOUNDS)) {
      throw new RangeError("Camera must contain required bounds for the complete 160 x 100 board");
    }
    if (requiredBounds !== undefined) {
      const required = normalizeBounds(requiredBounds, "Required bounds");
      if (!containsBoundsUnchecked(camera, required)) {
        throw new RangeError("Camera must contain required bounds");
      }
    }
    return deepFreeze(camera);
  }

  function cameraContainsBounds(cameraSource, boundsSource) {
    const camera = normalizeCamera(cameraSource);
    const bounds = normalizeBounds(boundsSource, "Bounds");
    return containsBoundsUnchecked(camera, bounds);
  }

  const DEFAULT_CAMERA = validateCamera({
    id: CANONICAL_CAMERA_ID,
    x: CANONICAL_CAMERA_TUPLE.x,
    y: CANONICAL_CAMERA_TUPLE.y,
    width: CANONICAL_CAMERA_TUPLE.width,
    height: CANONICAL_CAMERA_TUPLE.height,
  });

  function normalizeAsset(source) {
    exactFields(source, ASSET_FIELDS, ASSET_FIELDS, "Asset dimensions");
    const width = assertPositiveSafeInteger(source.width, "Asset width");
    const height = assertPositiveSafeInteger(source.height, "Asset height");
    assertEightByFive(width, height, "Tactical asset");
    return deepFreeze({ width: width, height: height });
  }

  function normalizeViewport(source) {
    exactFields(source, ["width", "height"], VIEWPORT_FIELDS, "Viewport");
    const width = assertPositiveFiniteSafeNumber(source.width, "Viewport width");
    const height = assertPositiveFiniteSafeNumber(source.height, "Viewport height");
    const devicePixelRatio = source.devicePixelRatio === undefined
      ? 1
      : assertPositiveFiniteSafeNumber(source.devicePixelRatio, "Viewport devicePixelRatio");
    const backingWidthValue = checkedFiniteProduct(width, devicePixelRatio, "Viewport backing width");
    const backingHeightValue = checkedFiniteProduct(height, devicePixelRatio, "Viewport backing height");
    const backingWidth = Math.round(backingWidthValue);
    const backingHeight = Math.round(backingHeightValue);
    if (!Number.isSafeInteger(backingWidth) || backingWidth <= 0 ||
        !Number.isSafeInteger(backingHeight) || backingHeight <= 0) {
      throw new RangeError("Viewport backing dimensions must be positive safe integers");
    }
    return deepFreeze({
      width: width,
      height: height,
      devicePixelRatio: devicePixelRatio,
      backingWidth: backingWidth,
      backingHeight: backingHeight,
    });
  }

  function containTransform(camera, width, height, label) {
    const widthScale = width / camera.width;
    const heightScale = height / camera.height;
    const widthLimited = widthScale <= heightScale;
    const scale = widthLimited ? widthScale : heightScale;
    assertPositiveFiniteSafeNumber(scale, label + " scale");
    let contentWidth = widthLimited
      ? width
      : checkedFiniteProduct(height, ASPECT_WIDTH / ASPECT_HEIGHT, label + " width");
    let contentHeight = widthLimited
      ? checkedFiniteProduct(width, ASPECT_HEIGHT / ASPECT_WIDTH, label + " height")
      : height;
    let x = assertFiniteSafeNumber((width - contentWidth) / 2, label + " x");
    let y = assertFiniteSafeNumber((height - contentHeight) / 2, label + " y");
    if (Math.abs(x) < 1e-12) x = 0;
    if (Math.abs(y) < 1e-12) y = 0;
    if (Math.abs(contentWidth - width) < 1e-12) contentWidth = width;
    if (Math.abs(contentHeight - height) < 1e-12) contentHeight = height;
    return deepFreeze({ x: x, y: y, width: contentWidth, height: contentHeight, scale: scale });
  }

  function createAssetProjection(cameraSource, assetSource) {
    const camera = validateCamera(cameraSource);
    const asset = normalizeAsset(assetSource);
    const scale = asset.width / camera.width;
    assertPositiveFiniteSafeNumber(scale, "Asset projection scale");
    const projection = deepFreeze({
      kind: "asset",
      camera: camera,
      asset: asset,
      scale: scale,
    });
    assetProjections.add(projection);
    return projection;
  }

  function createContainProjection(cameraSource, viewportSource) {
    const camera = validateCamera(cameraSource);
    const viewport = normalizeViewport(viewportSource);
    const contentTransform = containTransform(camera, viewport.width, viewport.height, "CSS content");
    const deviceTransform = containTransform(
      camera,
      viewport.backingWidth,
      viewport.backingHeight,
      "Device content"
    );
    const content = deepFreeze({
      x: contentTransform.x,
      y: contentTransform.y,
      width: contentTransform.width,
      height: contentTransform.height,
    });
    const device = deepFreeze({
      x: deviceTransform.x,
      y: deviceTransform.y,
      width: deviceTransform.width,
      height: deviceTransform.height,
      scale: deviceTransform.scale,
    });
    const projection = deepFreeze({
      kind: "screen",
      mode: "contain",
      camera: camera,
      viewport: viewport,
      content: content,
      scale: contentTransform.scale,
      device: device,
    });
    screenProjections.add(projection);
    return projection;
  }

  function normalizeWorldPoint(source, label) {
    exactFields(source, POINT_FIELDS, POINT_FIELDS, label);
    return {
      x: assertSafeInteger(source.x, label + " x"),
      y: assertSafeInteger(source.y, label + " y"),
    };
  }

  function normalizeProjectedPoint(source, label) {
    exactFields(source, POINT_FIELDS, POINT_FIELDS, label);
    return {
      x: assertFiniteSafeNumber(source.x, label + " x"),
      y: assertFiniteSafeNumber(source.y, label + " y"),
    };
  }

  function assertAssetProjection(projection) {
    if (!projection || !assetProjections.has(projection)) {
      throw new TypeError("A projection created by createAssetProjection is required");
    }
    return projection;
  }

  function assertScreenProjection(projection) {
    if (!projection || !screenProjections.has(projection)) {
      throw new TypeError("A projection created by createContainProjection is required");
    }
    return projection;
  }

  function projectWorldPoint(camera, offsetX, offsetY, scale, source, label) {
    const point = normalizeWorldPoint(source, label);
    const dx = checkedDifference(point.x, camera.x, label + " camera delta x");
    const dy = checkedDifference(point.y, camera.y, label + " camera delta y");
    const x = checkedFiniteAdd(offsetX,
      checkedFiniteProduct(dx, scale, label + " projected x"), label + " final x");
    const y = checkedFiniteAdd(offsetY,
      checkedFiniteProduct(dy, scale, label + " projected y"), label + " final y");
    return deepFreeze({ x: x, y: y });
  }

  function unprojectPoint(camera, offsetX, offsetY, scale, source, label) {
    const point = normalizeProjectedPoint(source, label);
    const localX = assertFiniteSafeNumber((point.x - offsetX) / scale, label + " local x");
    const localY = assertFiniteSafeNumber((point.y - offsetY) / scale, label + " local y");
    const x = checkedFiniteAdd(camera.x, localX, label + " world x");
    const y = checkedFiniteAdd(camera.y, localY, label + " world y");
    return deepFreeze({ x: x, y: y });
  }

  function worldToAsset(projection, point) {
    const value = assertAssetProjection(projection);
    return projectWorldPoint(value.camera, 0, 0, value.scale, point, "World point");
  }

  function assetToWorld(projection, point) {
    const value = assertAssetProjection(projection);
    return unprojectPoint(value.camera, 0, 0, value.scale, point, "Asset point");
  }

  function worldToScreen(projection, point) {
    const value = assertScreenProjection(projection);
    return projectWorldPoint(
      value.camera,
      value.content.x,
      value.content.y,
      value.scale,
      point,
      "World point"
    );
  }

  function screenToWorld(projection, point) {
    const value = assertScreenProjection(projection);
    return unprojectPoint(
      value.camera,
      value.content.x,
      value.content.y,
      value.scale,
      point,
      "Screen point"
    );
  }

  function worldToDevicePixel(projection, point) {
    const value = assertScreenProjection(projection);
    return projectWorldPoint(
      value.camera,
      value.device.x,
      value.device.y,
      value.device.scale,
      point,
      "World point"
    );
  }

  function devicePixelToWorld(projection, point) {
    const value = assertScreenProjection(projection);
    return unprojectPoint(
      value.camera,
      value.device.x,
      value.device.y,
      value.device.scale,
      point,
      "Device point"
    );
  }

  function screenPointInside(projection, point) {
    const value = assertScreenProjection(projection);
    const candidate = normalizeProjectedPoint(point, "Screen point");
    return candidate.x >= value.content.x && candidate.y >= value.content.y &&
      candidate.x <= value.content.x + value.content.width &&
      candidate.y <= value.content.y + value.content.height;
  }

  return deepFreeze({
    ASPECT_WIDTH: ASPECT_WIDTH,
    ASPECT_HEIGHT: ASPECT_HEIGHT,
    DISTANCE_SCALE: DISTANCE_SCALE,
    BOARD_BOUNDS: BOARD_BOUNDS,
    DEFAULT_CAMERA: DEFAULT_CAMERA,
    validateCamera: validateCamera,
    cameraContainsBounds: cameraContainsBounds,
    createAssetProjection: createAssetProjection,
    createContainProjection: createContainProjection,
    worldToAsset: worldToAsset,
    assetToWorld: assetToWorld,
    worldToScreen: worldToScreen,
    screenToWorld: screenToWorld,
    worldToDevicePixel: worldToDevicePixel,
    devicePixelToWorld: devicePixelToWorld,
    screenPointInside: screenPointInside,
  });
});
