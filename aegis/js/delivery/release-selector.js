/* Armara Aegis release selection and namespace isolation.
   Pure module: it does not read location, load artifacts, register workers, or touch storage. */
(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    let G = root.Game;
    if (G === undefined) {
      G = {};
      root.Game = G;
    }
    if (!G || (typeof G !== "object" && typeof G !== "function")) {
      throw new Error("Cannot install Aegis release selector into a non-object Game namespace");
    }
    const existing = G.AegisReleaseSelector;
    if (existing !== undefined && existing !== api) {
      throw new Error("Conflicting Game.AegisReleaseSelector is already installed");
    }
    if (existing === undefined) {
      Object.defineProperty(G, "AegisReleaseSelector", {
        value: api,
        enumerable: true,
        configurable: false,
        writable: false,
      });
    }
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const DEFAULT_RELEASE_ID = "legacy-proving-ground";
  const CHANNELS = Object.freeze(["legacy", "developer", "production"]);
  const ARTIFACT_ROOTS = Object.freeze(["assets/", "content/generated/", "css/", "js/", "skin/"]);
  const OPTION_KEYS = Object.freeze(["developer", "releaseId", "search"]);
  const NAMESPACE_KEYS = Object.freeze(["profile", "database", "cache", "replay", "serviceWorker"]);

  function own(object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
  }

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

  function assertSafeArtifactPath(path, field) {
    const label = field || "artifact path";
    if (typeof path !== "string" || !path || path !== path.trim()) {
      throw new TypeError(label + " must be a non-empty canonical relative path");
    }
    if (path.indexOf("\\") !== -1 || path.indexOf(":") !== -1 || path.indexOf("?") !== -1 ||
        path.indexOf("#") !== -1 || path.indexOf("%") !== -1 || path.charAt(0) === "/") {
      throw new Error(label + " must not contain a URL, absolute path, query, fragment, or escape");
    }
    const parts = path.split("/");
    if (parts.some(function (part) { return !part || part === "." || part === ".."; })) {
      throw new Error(label + " must stay inside the Aegis release directory");
    }
    const inAllowedRoot = ARTIFACT_ROOTS.some(function (prefix) { return path.indexOf(prefix) === 0; });
    if (!inAllowedRoot && path !== "sw.js") {
      throw new Error(label + " is outside the allowlisted Aegis artifact roots");
    }
    return path;
  }

  function isLegacyIdentifier(value) {
    return typeof value === "string" && /(^|[./:_-])legacy(?:[./:_-]|$)|legacy-proving-ground/i.test(value);
  }

  function descriptorStrings(descriptor) {
    const values = [descriptor.id, descriptor.metadataPath];
    Object.keys(descriptor.artifactPaths || {}).forEach(function (key) {
      values.push(descriptor.artifactPaths[key]);
    });
    (descriptor.contentIds || []).forEach(function (value) { values.push(value); });
    return values;
  }

  function validateDescriptor(descriptor) {
    if (!isPlainObject(descriptor)) throw new TypeError("Release descriptor must be a plain object");
    if (typeof descriptor.id !== "string" || !/^[a-z0-9][a-z0-9-]*$/.test(descriptor.id)) {
      throw new Error("Release descriptor id must be a stable lowercase identifier");
    }
    if (CHANNELS.indexOf(descriptor.channel) === -1) throw new Error("Unknown release channel: " + descriptor.channel);
    if ((descriptor.channel === "developer") !== (descriptor.developerOnly === true)) {
      throw new Error("Developer releases must be explicitly developer-only");
    }
    if (typeof descriptor.namespaceRoot !== "string" || !/^aegis(?:-[a-z0-9-]+)?$/.test(descriptor.namespaceRoot)) {
      throw new Error("Release namespaceRoot must be an Aegis-owned namespace");
    }
    if (!isPlainObject(descriptor.namespaces)) throw new Error("Release descriptor requires namespaces");
    NAMESPACE_KEYS.forEach(function (key) {
      const value = descriptor.namespaces[key];
      if (typeof value !== "string" ||
          (value !== descriptor.namespaceRoot && value.indexOf(descriptor.namespaceRoot + ":") !== 0)) {
        throw new Error("Namespace " + key + " must derive from namespaceRoot");
      }
    });
    if (!isPlainObject(descriptor.artifactPaths) || !Object.keys(descriptor.artifactPaths).length) {
      throw new Error("Release descriptor requires at least one artifact path");
    }
    Object.keys(descriptor.artifactPaths).forEach(function (key) {
      if (!/^[a-z][A-Za-z0-9]*$/.test(key)) throw new Error("Invalid artifact key: " + key);
      assertSafeArtifactPath(descriptor.artifactPaths[key], "artifactPaths." + key);
    });
    if (descriptor.metadataPath !== null && descriptor.metadataPath !== undefined) {
      assertSafeArtifactPath(descriptor.metadataPath, "metadataPath");
    }
    if (descriptor.contentIds !== undefined) {
      if (!Array.isArray(descriptor.contentIds) || descriptor.contentIds.some(function (id) {
        return typeof id !== "string" || !/^[a-z0-9][a-z0-9-]*$/.test(id);
      })) throw new Error("contentIds must contain stable lowercase identifiers");
    }
    if (descriptor.channel === "production" && descriptorStrings(descriptor).some(isLegacyIdentifier)) {
      throw new Error("Production release descriptors cannot reference legacy IDs or artifacts");
    }
    return true;
  }

  function namespaceSet(rootName) {
    return {
      profile: rootName + ":profile",
      database: rootName,
      cache: rootName + ":cache",
      replay: rootName + ":replay",
      serviceWorker: rootName + ":sw",
    };
  }

  function makeDescriptor(source) {
    validateDescriptor(source);
    return deepFreeze({
      id: source.id,
      channel: source.channel,
      developerOnly: source.developerOnly === true,
      namespaceRoot: source.namespaceRoot,
      namespaces: Object.assign({}, source.namespaces),
      // JSON metadata is for canonical tooling/review. Runtime boot uses only the atomic
      // classic-script releaseRecord in artifactPaths, including under file://.
      metadataPath: source.metadataPath === undefined ? null : source.metadataPath,
      artifactPaths: Object.assign({}, source.artifactPaths),
      contentIds: (source.contentIds || []).slice(),
    });
  }

  const RELEASES = deepFreeze({
    "legacy-proving-ground": makeDescriptor({
      id: "legacy-proving-ground",
      channel: "legacy",
      developerOnly: false,
      namespaceRoot: "aegis",
      namespaces: namespaceSet("aegis"),
      metadataPath: null,
      artifactPaths: {
        engine: "js/engine.js",
        renderer: "js/renderer.js",
        game: "js/game.js",
      },
      contentIds: ["legacy-proving-ground"],
    }),
    "slice-dev-v1": makeDescriptor({
      id: "slice-dev-v1",
      channel: "developer",
      developerOnly: true,
      namespaceRoot: "aegis-slice-dev",
      namespaces: namespaceSet("aegis-slice-dev"),
      metadataPath: "content/generated/release.slice-dev-v1.json",
      artifactPaths: {
        releaseRecord: "content/generated/release.slice-dev-v1.js",
      },
      contentIds: ["m01", "m04", "m05"],
    }),
  });

  function releaseFromSearch(search) {
    if (search === undefined || search === null || search === "") return null;
    if (typeof search !== "string") throw new TypeError("search must be a query string");
    const query = search.charAt(0) === "?" ? search.slice(1) : search;
    const params = new URLSearchParams(query);
    const releaseValues = params.getAll("release");
    if (releaseValues.length > 1) throw new Error("Release query must contain at most one release id");
    params.forEach(function (_value, key) {
      const normalized = key.toLowerCase().replace(/[-_]/g, "");
      if (normalized.indexOf("manifest") !== -1 || normalized === "releaseurl") {
        throw new Error("Manifest and release URLs are not accepted from query input");
      }
    });
    if (!releaseValues.length) return null;
    if (!releaseValues[0]) throw new Error("Release id cannot be empty");
    return releaseValues[0];
  }

  function selectRelease(options) {
    if (options === undefined || options === null) options = {};
    if (!isPlainObject(options)) throw new TypeError("Release options must be a plain object");
    Object.keys(options).forEach(function (key) {
      if (OPTION_KEYS.indexOf(key) === -1) throw new Error("Unknown release option: " + key);
    });
    if (own(options, "developer") && typeof options.developer !== "boolean") {
      throw new TypeError("developer must be a boolean");
    }
    if (own(options, "releaseId") && (typeof options.releaseId !== "string" || !options.releaseId)) {
      throw new TypeError("releaseId must be a non-empty string");
    }
    const queryRelease = releaseFromSearch(options.search);
    if (options.releaseId && queryRelease && options.releaseId !== queryRelease) {
      throw new Error("Conflicting release ids");
    }
    const id = options.releaseId || queryRelease || DEFAULT_RELEASE_ID;
    const descriptor = RELEASES[id];
    if (!descriptor) throw new Error("Unknown Aegis release id: " + id);
    if (descriptor.developerOnly && options.developer !== true) {
      throw new Error("Developer release requires an explicit trusted developer option");
    }
    return descriptor;
  }

  function releaseDirectory(baseHref) {
    if (typeof baseHref !== "string" || !baseHref) throw new TypeError("baseHref must be an absolute URL");
    let base;
    try { base = new URL(baseHref); } catch (error) { throw new Error("baseHref must be an absolute URL"); }
    if (["file:", "http:", "https:"].indexOf(base.protocol) === -1) {
      throw new Error("Unsupported release base protocol: " + base.protocol);
    }
    base.search = "";
    base.hash = "";
    return base.pathname.charAt(base.pathname.length - 1) === "/" ? base : new URL(".", base);
  }

  function resolveArtifactUrl(baseHref, artifactPath) {
    const safePath = assertSafeArtifactPath(artifactPath);
    const directory = releaseDirectory(baseHref);
    const resolved = new URL(safePath, directory);
    if (resolved.protocol !== directory.protocol || resolved.origin !== directory.origin ||
        resolved.pathname.indexOf(directory.pathname) !== 0) {
      throw new Error("Resolved artifact escaped the Aegis release directory");
    }
    return resolved.href;
  }

  function resolveArtifactUrls(release, baseHref) {
    let descriptor = release;
    if (typeof release === "string") descriptor = RELEASES[release];
    if (!descriptor || RELEASES[descriptor.id] !== descriptor) {
      throw new Error("Artifacts can be resolved only for an allowlisted release descriptor");
    }
    const result = {};
    Object.keys(descriptor.artifactPaths).forEach(function (key) {
      result[key] = resolveArtifactUrl(baseHref, descriptor.artifactPaths[key]);
    });
    return deepFreeze(result);
  }

  return deepFreeze({
    DEFAULT_RELEASE_ID: DEFAULT_RELEASE_ID,
    RELEASES: RELEASES,
    selectRelease: selectRelease,
    resolveArtifactUrl: resolveArtifactUrl,
    resolveArtifactUrls: resolveArtifactUrls,
    validateDescriptor: validateDescriptor,
  });
});
