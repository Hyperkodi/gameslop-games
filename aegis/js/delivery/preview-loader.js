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

  const EXPECTED_RELEASE_ID = "slice-dev-v1";
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
    if (!release || release.id !== EXPECTED_RELEASE_ID || release.channel !== "developer" ||
        release.developerOnly !== true) {
      throw new Error("Preview loader accepts only the trusted slice-dev-v1 developer release");
    }
    if (!release.artifactPaths || Object.keys(release.artifactPaths).length !== 1 ||
        release.artifactPaths.releaseRecord !== "content/generated/release.slice-dev-v1.js") {
      throw new Error("slice-dev-v1 must use its pinned stable release-alias path");
    }
    if (!Array.isArray(release.contentIds) ||
        release.contentIds.join("\u0000") !== ["m01", "m04", "m05"].join("\u0000")) {
      throw new Error("slice-dev-v1 mission allowlist does not match the preview contract");
    }
    return release;
  }

  function validateReleaseAlias(alias, selectedRelease) {
    validateSelectedRelease(selectedRelease);
    exactFields(alias, ALIAS_FIELDS, "Stable preview release alias");
    if (alias.schemaVersion !== 1 || alias.id !== selectedRelease.id ||
        alias.contentVersion !== EXPECTED_RELEASE_ID) {
      throw new Error("Stable preview release alias identity does not match slice-dev-v1");
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

  function validateReleaseRecord(release, alias, descriptor) {
    if (!isPlainDataObject(release) || !Object.isFrozen(release)) {
      throw new TypeError("Immutable release record must be frozen plain data");
    }
    if (release.schemaVersion !== 3 || release.contentVersion !== alias.contentVersion ||
        release.approvalState !== alias.approvalState || release.releaseEligible !== false) {
      throw new Error("Immutable release record disagrees with the trusted preview alias");
    }
    if (!release.includedIds || !Array.isArray(release.includedIds.missions) ||
        release.includedIds.missions.join("\u0000") !== descriptor.contentIds.join("\u0000")) {
      throw new Error("Immutable release missions disagree with the selected preview release");
    }
    requireImmutableName(release.simulationArtifact, release.simulationHash, "aegis-sim");
    requireImmutableName(release.contentArtifact, release.contentHash, "aegis-content");
    requireImmutableName(release.presentationArtifact, release.presentationHash, "aegis-presentation");
    requireHash(release.rulesetHash, "Ruleset hash");
    requireHash(release.abiHash, "ABI hash");
    return release;
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
      exactFields(options, ["release", "selector", "baseHref"], "Preview load options");
      const descriptor = validateSelectedRelease(options.release);
      if (!options.selector || typeof options.selector.resolveArtifactUrls !== "function") {
        throw new TypeError("Preview loader requires the release selector resolver");
      }
      if (!options.selector.RELEASES || options.selector.RELEASES[EXPECTED_RELEASE_ID] !== descriptor) {
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
        label: "stable slice-dev-v1 release alias",
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
      validateReleaseRecord(release, alias, descriptor);

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
          !game.AegisKernel || typeof game.AegisKernel.createRulesetBinding !== "function" ||
          !game.AegisSim || !game.AegisEconomy || !game.AegisCommands) {
        throw new Error("Authenticated simulation bundle did not install the required runtime APIs");
      }
      const binding = game.AegisKernel.createRulesetBinding({ release: release, content: content });
      if (!binding || binding.rulesetHash !== release.rulesetHash ||
          binding.simulationHash !== release.simulationHash ||
          binding.contentVersion !== release.contentVersion) {
        throw new Error("Kernel binding identities disagree with the immutable release");
      }

      return deepFreeze({
        alias: alias,
        binding: binding,
        commands: game.AegisCommands,
        content: content,
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
    EXPECTED_RELEASE_ID: EXPECTED_RELEASE_ID,
    APPROVAL_STATES: APPROVAL_STATES,
    artifactUrl: artifactUrl,
    createLoader: createLoader,
    digestIntegrity: digestIntegrity,
    validateReleaseAlias: validateReleaseAlias,
    validateReleaseRecord: validateReleaseRecord,
    validateSelectedRelease: validateSelectedRelease,
  });
});
