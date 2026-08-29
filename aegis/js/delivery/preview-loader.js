/* Armara Aegis Candidate-BAL developer-preview artifact loader.
   It accepts only the independently allowlisted release descriptor selected by
   release-selector.js; request state never supplies an artifact URL or hash. */
(function (root, factory) {
  "use strict";

  const api = factory(root);
  if (typeof module === "object" && module.exports) {
    module.exports = api;
    return;
  }
  const game = root.Game = root.Game || {};
  if (!game || (typeof game !== "object" && typeof game !== "function")) {
    throw new Error("Cannot install the Aegis preview loader into a non-object Game namespace");
  }
  if (Object.prototype.hasOwnProperty.call(game, "AegisPreviewLoader")) {
    throw new Error("Conflicting Game.AegisPreviewLoader is already installed");
  }
  Object.defineProperty(game, "AegisPreviewLoader", {
    value: api,
    enumerable: true,
    configurable: false,
    writable: false,
  });
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";

  /* The release aliases this repository ships. A release id is never accepted
     from request state: the selector owns the allowlist and this loader owns
     the field contract every authenticated release record must satisfy. */
  const PREVIEW_RELEASE_IDS = Object.freeze(["slice-dev-v1", "candidate-v4"]);
  const RELEASE_ALIAS_PATH = /^content\/generated\/release\.([a-z0-9][a-z0-9-]*)\.js$/;
  const ABI_VERSIONS = Object.freeze([1, 2]);
  const ABI_VERSION_BY_SCHEMA = Object.freeze({ 3: 1, 4: 2 });
  const CONTENT_SCHEMA_VERSIONS = Object.freeze([3, 4]);
  const REQUIRED_GLOBALS_BY_ABI = Object.freeze({
    1: Object.freeze(["AegisKernel", "AegisSim", "AegisEconomy", "AegisCommands"]),
    2: Object.freeze([
      "AegisKernel", "AegisSim", "AegisEconomy", "AegisCommands",
      "AegisCommandsV2", "AegisProtocols", "AegisRelics",
    ]),
  });
  const STABLE_ID = /^[a-z0-9][a-z0-9.-]*$/;
  const HASH = /^sha256:([0-9a-f]{64})$/;
  const RELEASE_ARTIFACT = /^aegis-release\.([0-9a-f]{64})\.js$/;
  const IMMUTABLE_ARTIFACT = /^(aegis-sim|aegis-content|aegis-presentation)\.([0-9a-f]{64})\.js$/;
  const ALIAS_FIELDS = Object.freeze([
    "schemaVersion", "id", "contentVersion", "approvalState", "releaseEligible",
    "releaseArtifact", "releaseHash",
  ]);
  const APPROVAL_STATES = Object.freeze(["candidate-balance", "balance-approved"]);

  function own(value, key) {
    return Object.prototype.hasOwnProperty.call(value, key);
  }

  function deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.getOwnPropertyNames(value).forEach(function (key) { deepFreeze(value[key]); });
    return Object.freeze(value);
  }

  function isPlainDataObject(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return false;
    if (Object.getOwnPropertySymbols(value).length !== 0) return false;
    return Object.getOwnPropertyNames(value).every(function (key) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      return descriptor && descriptor.enumerable && !descriptor.get && !descriptor.set;
    });
  }

  function exactFields(value, expected, label) {
    if (!isPlainDataObject(value)) throw new TypeError(label + " must be a plain data object");
    const actual = Object.keys(value).sort();
    const wanted = expected.slice().sort();
    if (actual.length !== wanted.length || actual.some(function (key, index) {
      return key !== wanted[index];
    })) {
      throw new TypeError(label + " must contain exactly: " + expected.join(", "));
    }
    return value;
  }

  function allowedFields(value, required, optional, label) {
    if (!isPlainDataObject(value)) throw new TypeError(label + " must be a plain data object");
    const allowed = required.concat(optional);
    Object.keys(value).forEach(function (key) {
      if (allowed.indexOf(key) === -1) throw new TypeError(label + " contains unknown field " + key);
    });
    required.forEach(function (key) {
      if (!own(value, key)) throw new TypeError(label + " is missing " + key);
    });
    return value;
  }

  function requireHash(value, label) {
    if (typeof value !== "string" || !HASH.test(value)) {
      throw new TypeError(label + " must be a lowercase SHA-256 reference");
    }
    return value.slice("sha256:".length);
  }

  function requireImmutableName(name, hash, kind) {
    const match = typeof name === "string" ? IMMUTABLE_ARTIFACT.exec(name) : null;
    if (!match || match[1] !== kind || match[2] !== requireHash(hash, kind + " hash")) {
      throw new Error(kind + " artifact name must be immutable and match its declared hash");
    }
    return name;
  }

  function validateSelectedRelease(release) {
    if (!release || typeof release.id !== "string" || PREVIEW_RELEASE_IDS.indexOf(release.id) === -1) {
      throw new Error("Preview loader accepts only a release alias this repository ships");
    }
    if (release.channel !== "developer" || release.developerOnly !== true) {
      throw new Error("Preview releases must be explicit developer-only descriptors");
    }
    if (!release.artifactPaths || Object.keys(release.artifactPaths).length !== 1) {
      throw new Error(release.id + " must declare exactly one stable release-alias path");
    }
    const match = RELEASE_ALIAS_PATH.exec(release.artifactPaths.releaseRecord);
    if (!match || match[1] !== release.id) {
      throw new Error(release.id + " must use its pinned stable release-alias path");
    }
    if (release.contentIds !== undefined && !Array.isArray(release.contentIds)) {
      throw new Error(release.id + " content IDs must be an array when declared");
    }
    return release;
  }

  function validateReleaseAlias(alias, selectedRelease) {
    validateSelectedRelease(selectedRelease);
    exactFields(alias, ALIAS_FIELDS, "Stable preview release alias");
    if (alias.schemaVersion !== 1 || alias.id !== selectedRelease.id ||
        typeof alias.contentVersion !== "string" || !STABLE_ID.test(alias.contentVersion)) {
      throw new Error("Stable preview release alias identity does not match " + selectedRelease.id);
    }
    if (APPROVAL_STATES.indexOf(alias.approvalState) === -1 || alias.releaseEligible !== false) {
      throw new Error("Developer preview alias must remain non-production and release-ineligible");
    }
    const releaseDigest = requireHash(alias.releaseHash, "Immutable release hash");
    const match = typeof alias.releaseArtifact === "string"
      ? RELEASE_ARTIFACT.exec(alias.releaseArtifact)
      : null;
    if (!match || match[1] !== releaseDigest) {
      throw new Error("Immutable release artifact name must match the alias release hash");
    }
    return alias;
  }

  function stableIdArray(value, label) {
    if (!Array.isArray(value) || value.length === 0) {
      throw new Error(label + " must be a non-empty array of stable IDs");
    }
    let previous = null;
    return value.map(function (entry) {
      if (typeof entry !== "string" || !STABLE_ID.test(entry)) {
        throw new Error(label + " must contain stable lowercase IDs");
      }
      if (previous !== null && entry <= previous) {
        throw new Error(label + " must be sorted and unique");
      }
      previous = entry;
      return entry;
    });
  }

  /* The authenticated release record is the contract. It declares its content
     schema, its ABI version, the content IDs it ships, and the runtime globals
     its bundle must install. The descriptor may pin a content-ID allowlist; when
     it does, the record must match it exactly. */
  function releaseAbiVersion(release) {
    if (release.abiVersion !== undefined) {
      if (ABI_VERSIONS.indexOf(release.abiVersion) === -1) {
        throw new Error("Immutable release declares an unsupported ABI version");
      }
      if (ABI_VERSION_BY_SCHEMA[release.schemaVersion] !== release.abiVersion) {
        throw new Error("Immutable release ABI version disagrees with its content schema");
      }
      return release.abiVersion;
    }
    const derived = ABI_VERSION_BY_SCHEMA[release.schemaVersion];
    if (ABI_VERSIONS.indexOf(derived) === -1) {
      throw new Error("Immutable release declares an unsupported content schema");
    }
    return derived;
  }

  function releaseContentIds(release) {
    if (release.contentIds !== undefined) return stableIdArray(release.contentIds, "Release content IDs");
    if (!release.includedIds || !Array.isArray(release.includedIds.missions)) {
      throw new Error("Immutable release must declare the content IDs it ships");
    }
    return stableIdArray(release.includedIds.missions, "Release content IDs");
  }

  function releaseRequiredGlobals(release, abiVersion) {
    if (release.requiredGlobals === undefined) return REQUIRED_GLOBALS_BY_ABI[abiVersion].slice();
    if (!Array.isArray(release.requiredGlobals) || release.requiredGlobals.some(function (name) {
      return typeof name !== "string" || !/^Aegis[A-Za-z0-9]+$/.test(name);
    })) {
      throw new Error("Immutable release required globals must be Aegis runtime names");
    }
    const declared = release.requiredGlobals.slice();
    REQUIRED_GLOBALS_BY_ABI[abiVersion].forEach(function (name) {
      if (declared.indexOf(name) === -1) declared.push(name);
    });
    return declared;
  }

  function validateReleaseRecord(release, alias, descriptor, developer) {
    if (!isPlainDataObject(release) || !Object.isFrozen(release)) {
      throw new TypeError("Immutable release record must be frozen plain data");
    }
    if (CONTENT_SCHEMA_VERSIONS.indexOf(release.schemaVersion) === -1 ||
        release.contentVersion !== alias.contentVersion ||
        release.approvalState !== alias.approvalState || release.releaseEligible !== false) {
      throw new Error("Immutable release record disagrees with the trusted preview alias");
    }
    if (APPROVAL_STATES.indexOf(release.approvalState) === -1) {
      throw new Error("Immutable release approval state is not a developer preview state");
    }
    const developerOnly = release.developerOnly === undefined
      ? descriptor.developerOnly === true
      : release.developerOnly === true;
    if (developerOnly && developer !== true) {
      throw new Error("A developer-only release requires an explicit trusted developer option");
    }
    const abiVersion = releaseAbiVersion(release);
    const contentIds = releaseContentIds(release);
    if (Array.isArray(descriptor.contentIds) && descriptor.contentIds.length &&
        contentIds.join("\u0000") !== descriptor.contentIds.slice().sort().join("\u0000")) {
      throw new Error("Immutable release content IDs disagree with the selected preview release");
    }
    requireImmutableName(release.simulationArtifact, release.simulationHash, "aegis-sim");
    requireImmutableName(release.contentArtifact, release.contentHash, "aegis-content");
    requireImmutableName(release.presentationArtifact, release.presentationHash, "aegis-presentation");
    requireHash(release.rulesetHash, "Ruleset hash");
    requireHash(release.abiHash, "ABI hash");
    return deepFreeze({
      release: release,
      abiVersion: abiVersion,
      contentIds: contentIds,
      developerOnly: developerOnly,
      requiredGlobals: releaseRequiredGlobals(release, abiVersion),
    });
  }

  function digestIntegrity(hash) {
    const hex = requireHash(hash, "Script integrity hash");
    let binary = "";
    for (let index = 0; index < hex.length; index += 2) {
      binary += String.fromCharCode(parseInt(hex.slice(index, index + 2), 16));
    }
    if (!root || typeof root.btoa !== "function") {
      if (typeof Buffer !== "undefined") return "sha256-" + Buffer.from(hex, "hex").toString("base64");
      throw new Error("No base64 encoder is available for script integrity");
    }
    return "sha256-" + root.btoa(binary);
  }

  function artifactUrl(aliasUrl, artifactName) {
    if (typeof aliasUrl !== "string" || !aliasUrl) throw new TypeError("Release alias URL is required");
    if (typeof artifactName !== "string" || artifactName.indexOf("/") !== -1 ||
        artifactName.indexOf("\\") !== -1 || artifactName.indexOf(":") !== -1 ||
        artifactName.indexOf("?") !== -1 || artifactName.indexOf("#") !== -1 ||
        artifactName.indexOf("%") !== -1) {
      throw new Error("Immutable artifacts must be canonical filenames in the alias directory");
    }
    const base = new URL(aliasUrl);
    if (["file:", "http:", "https:"].indexOf(base.protocol) === -1) {
      throw new Error("Preview artifacts require file, HTTP, or HTTPS URLs");
    }
    const resolved = new URL(artifactName, base);
    const directory = new URL(".", base);
    if (resolved.protocol !== directory.protocol || resolved.origin !== directory.origin ||
        resolved.pathname.indexOf(directory.pathname) !== 0) {
      throw new Error("Immutable artifact escaped the generated-content directory");
    }
    return resolved.href;
  }

  function nativeScriptLoader(documentObject, game, request) {
    return new Promise(function (resolve, reject) {
      if (!documentObject || typeof documentObject.createElement !== "function") {
        reject(new TypeError("A document is required to load preview artifacts"));
        return;
      }
      if (own(game, request.globalName)) {
        reject(new Error("Game." + request.globalName + " was installed before its authenticated script"));
        return;
      }
      const script = documentObject.createElement("script");
      script.src = request.url;
      script.async = false;
      if (request.integrity) {
        script.integrity = request.integrity;
        const protocol = new URL(request.url).protocol;
        if (protocol === "http:" || protocol === "https:") script.crossOrigin = "anonymous";
      }
      script.referrerPolicy = "no-referrer";
      script.onload = function () {
        if (!own(game, request.globalName)) {
          reject(new Error(request.label + " loaded without installing Game." + request.globalName));
          return;
        }
        resolve(game[request.globalName]);
      };
      script.onerror = function () {
        reject(new Error("Failed to authenticate and load " + request.label));
      };
      const target = documentObject.head || documentObject.documentElement;
      if (!target || typeof target.appendChild !== "function") {
        reject(new TypeError("Document has no script installation target"));
        return;
      }
      target.appendChild(script);
    });
  }

  function validateInstalledApi(api, exportName, label) {
    if (!api || typeof api !== "object" || !own(api, exportName) ||
        !api[exportName] || typeof api[exportName] !== "object") {
      throw new Error(label + " lacks the required " + exportName + " export");
    }
    return api[exportName];
  }

  function createLoader(environment) {
    environment = environment || {};
    const game = environment.game || (root && root.Game);
    const documentObject = environment.document || (root && root.document);
    const scriptLoader = environment.scriptLoader || function (request) {
      return nativeScriptLoader(documentObject, game, request);
    };
    if (!game || (typeof game !== "object" && typeof game !== "function")) {
      throw new TypeError("Preview loader requires the shared Game namespace");
    }
    if (typeof scriptLoader !== "function") throw new TypeError("Preview script loader must be a function");

    async function load(options) {
      allowedFields(options, ["release", "selector", "baseHref"], ["developer"], "Preview load options");
      const descriptor = validateSelectedRelease(options.release);
      const developer = options.developer === undefined ? true : options.developer === true;
      if (!options.selector || typeof options.selector.resolveArtifactUrls !== "function") {
        throw new TypeError("Preview loader requires the release selector resolver");
      }
      if (!options.selector.RELEASES || options.selector.RELEASES[descriptor.id] !== descriptor) {
        throw new Error("Preview descriptor must be the selector's exact allowlisted release object");
      }
      if (typeof options.baseHref !== "string" || !options.baseHref) {
        throw new TypeError("Preview loader baseHref must be an absolute URL");
      }
      const selectedUrls = options.selector.resolveArtifactUrls(descriptor, options.baseHref);
      if (!selectedUrls || Object.keys(selectedUrls).length !== 1 ||
          typeof selectedUrls.releaseRecord !== "string") {
        throw new Error("Release selector did not resolve the pinned preview alias");
      }

      const aliasApi = await scriptLoader(Object.freeze({
        url: selectedUrls.releaseRecord,
        integrity: null,
        globalName: "AegisReleaseAlias",
        label: "stable " + descriptor.id + " release alias",
      }));
      const alias = validateInstalledApi(aliasApi, "RELEASE_ALIAS", "Stable preview alias");
      validateReleaseAlias(alias, descriptor);

      const immutableReleaseUrl = artifactUrl(selectedUrls.releaseRecord, alias.releaseArtifact);
      const releaseApi = await scriptLoader(Object.freeze({
        url: immutableReleaseUrl,
        integrity: digestIntegrity(alias.releaseHash),
        globalName: "AegisRelease",
        label: "immutable Aegis release record",
      }));
      const release = validateInstalledApi(releaseApi, "RELEASE", "Immutable release record");
      const validated = validateReleaseRecord(release, alias, descriptor, developer);

      const immutableRequests = [
        {
          artifact: release.simulationArtifact,
          hash: release.simulationHash,
          // The classic bundle installs its declared APIs individually. AegisKernel
          // is installed near the end and is the preview's authoritative seam.
          globalName: "AegisKernel",
          label: "immutable Aegis simulation bundle",
          resultKey: "simulationBundle",
        },
        {
          artifact: release.contentArtifact,
          hash: release.contentHash,
          globalName: "AegisContent",
          label: "immutable Aegis simulation content",
          resultKey: "contentApi",
        },
        {
          artifact: release.presentationArtifact,
          hash: release.presentationHash,
          globalName: "AegisPresentation",
          label: "immutable Aegis presentation companion",
          resultKey: "presentationApi",
        },
      ];
      const installed = {};
      for (let index = 0; index < immutableRequests.length; index += 1) {
        const request = immutableRequests[index];
        installed[request.resultKey] = await scriptLoader(Object.freeze({
          url: artifactUrl(selectedUrls.releaseRecord, request.artifact),
          integrity: digestIntegrity(request.hash),
          globalName: request.globalName,
          label: request.label,
        }));
      }

      const content = validateInstalledApi(installed.contentApi, "CONTENT", "Simulation content");
      const presentation = validateInstalledApi(
        installed.presentationApi,
        "PRESENTATION",
        "Presentation companion"
      );
      if (content.contentVersion !== release.contentVersion ||
          presentation.contentVersion !== release.contentVersion) {
        throw new Error("Loaded content companions disagree with the immutable release version");
      }
      if (installed.simulationBundle !== game.AegisKernel ||
          !game.AegisKernel || typeof game.AegisKernel.createRulesetBinding !== "function") {
        throw new Error("Authenticated simulation bundle did not install the required runtime APIs");
      }
      const missingGlobal = validated.requiredGlobals.find(function (name) {
        return !game[name] || (typeof game[name] !== "object" && typeof game[name] !== "function");
      });
      if (missingGlobal) {
        throw new Error("Authenticated simulation bundle did not install Game." + missingGlobal);
      }
      const binding = game.AegisKernel.createRulesetBinding({ release: release, content: content });
      if (!binding || binding.rulesetHash !== release.rulesetHash ||
          binding.simulationHash !== release.simulationHash ||
          binding.contentVersion !== release.contentVersion) {
        throw new Error("Kernel binding identities disagree with the immutable release");
      }

      return deepFreeze({
        abiVersion: validated.abiVersion,
        alias: alias,
        binding: binding,
        commands: game.AegisCommands,
        content: content,
        contentIds: validated.contentIds,
        descriptor: descriptor,
        economy: game.AegisEconomy,
        kernel: game.AegisKernel,
        presentation: presentation,
        release: release,
        simulation: game.AegisSim,
      });
    }

    return Object.freeze({ load: load });
  }

  return deepFreeze({
    ALIAS_FIELDS: ALIAS_FIELDS,
    PREVIEW_RELEASE_IDS: PREVIEW_RELEASE_IDS,
    ABI_VERSIONS: ABI_VERSIONS,
    REQUIRED_GLOBALS_BY_ABI: REQUIRED_GLOBALS_BY_ABI,
    APPROVAL_STATES: APPROVAL_STATES,
    artifactUrl: artifactUrl,
    createLoader: createLoader,
    digestIntegrity: digestIntegrity,
    validateReleaseAlias: validateReleaseAlias,
    validateReleaseRecord: validateReleaseRecord,
    validateSelectedRelease: validateSelectedRelease,
  });
});
