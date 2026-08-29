"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const FIXTURE = path.join(__dirname, "fixtures", "compiler", "valid-minimal");
const V3_STRUCTURAL_FIXTURE = path.join(
  __dirname,
  "fixtures",
  "compiler",
  "v3-loader",
  "valid-v3-structural"
);
const SIMULATION = path.join(FIXTURE, "simulation.js");
const PRODUCTION_SOURCE = path.join(__dirname, "..", "content");
const M01_SOURCE = path.join(PRODUCTION_SOURCE, "maps", "m01.json");
const LIB = path.join(REPO_ROOT, "tools", "lib", "aegis");
const { AegisContentError } = require(path.join(LIB, "diagnostics.js"));
const { canonicalEncode } = require(path.join(LIB, "canonical.js"));
const { parseExactDecimal } = require(path.join(LIB, "exact-decimal.js"));
const { parseStrictJsonBytes } = require(path.join(LIB, "strict-json.js"));
const {
  compileSourceTree, writeArtifacts, checkArtifacts, executeBuild, releaseAliasEntries,
} = require(path.join(LIB, "compiler.js"));
const {
  buildArtifacts,
  frameRulesetBytes,
  renderContentArtifact,
  sha256Hex,
  simulationDescriptor,
} = require(path.join(LIB, "artifacts.js"));
const {
  MODULE_SPECS,
  readSimulationSources,
  assembleSimulationBundle,
  buildSimulationBundle,
} = require(path.join(LIB, "simulation-bundle.js"));
const MapValidation = require(path.join(LIB, "map-validation.js"));
const MapReport = require(path.join(LIB, "map-report.js"));
const CLI = require(path.join(REPO_ROOT, "tools", "build-aegis-content.js"));
const RUNTIME_ABI = require(path.join(__dirname, "..", "js", "sim", "abi.js"));
const SIMULATION_SOURCE_ROOT = path.join(__dirname, "..", "js", "sim");

function expectDiagnostic(fn, code, diagnosticPath) {
  assert.throws(fn, function (error) {
    assert.ok(error instanceof AegisContentError, String(error));
    assert.equal(error.diagnostics[0].code, code);
    if (diagnosticPath !== undefined) assert.equal(error.diagnostics[0].path, diagnosticPath);
    return true;
  });
}

function temporaryFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aegis-content-"));
  fs.cpSync(FIXTURE, root, { recursive: true });
  return root;
}

function temporaryProductionSource() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aegis-production-content-"));
  fs.cpSync(PRODUCTION_SOURCE, root, { recursive: true });
  return root;
}

function productionSimulationBytes() {
  return buildSimulationBundle({ sourceRoot: SIMULATION_SOURCE_ROOT });
}

function compileProduction(root, simulationBytes) {
  return compileSourceTree({
    sourceRoot: root || PRODUCTION_SOURCE,
    simulationBytes: simulationBytes || productionSimulationBytes(),
  });
}

function readManifest(root) {
  return JSON.parse(fs.readFileSync(path.join(root, "schema-version.json"), "utf8"));
}

function writeManifest(root, value) {
  fs.writeFileSync(path.join(root, "schema-version.json"), JSON.stringify(value, null, 2) + "\n");
}

function reverseJsonObjectKeys(value) {
  if (Array.isArray(value)) return value.map(reverseJsonObjectKeys);
  if (value && typeof value === "object") {
    const reversed = {};
    Object.keys(value).reverse().forEach(function (key) {
      reversed[key] = reverseJsonObjectKeys(value[key]);
    });
    return reversed;
  }
  return value;
}

function compile(root, simulationBytes) {
  return compileSourceTree({
    sourceRoot: root || FIXTURE,
    simulationPath: simulationBytes === undefined ? SIMULATION : undefined,
    simulationBytes: simulationBytes,
  });
}

function copySimulationSources(sources) {
  return sources.map(function (entry) {
    return { id: entry.id, relativePath: entry.relativePath, bytes: Buffer.from(entry.bytes) };
  });
}

function replaceModuleBytes(sources, id, before, after) {
  const copy = copySimulationSources(sources);
  const entry = copy.find(function (candidate) { return candidate.id === id; });
  const source = entry.bytes.toString("utf8");
  assert.equal(
    source.split(before).length - 1,
    1,
    id + " mutation sentinel must exist exactly once"
  );
  entry.bytes = Buffer.from(source.replace(before, after), "utf8");
  return copy;
}

function bundleParityExpression(apiExpression, abiExpression) {
  return [
    "(function () {",
    "  const APIs = " + apiExpression + ";",
    "  const ABI = " + abiExpression + ";",
    "  const commandSource = [{tick:0,seq:0,type:\"build\",padId:\"p01\",defenseId:\"sentinel\"}];",
    "  const commands = APIs.AegisCommands.normalizeCommandSequence(commandSource);",
    "  const managementConfig = {",
    "    missionId:\"m01\",resolvedStartAether:150,tutorialUpgradeGateMode:\"none\",",
    "    padIds:[\"p01\"],waveStartGrants:[0],",
    "    defenses:[{id:\"sentinel\",costsAether:[60,55,95],defaultTargetPolicy:\"FRONT\",allowedTargetPolicies:[\"FRONT\"]}]",
    "  };",
    "  const management = APIs.AegisManagement.applyCommandBucket(",
    "    APIs.AegisManagement.createManagementState(managementConfig),",
    "    managementConfig,0,commandSource",
    "  ).state;",
    "  const replaySource = {",
    "    formatVersion:1,rulesetHash:\"sha256:\"+\"a\".repeat(64),eventSchemaVersion:1,",
    "    missionId:\"m01\",difficultyId:\"strategos\",assist:false,seed:123,loadoutIds:[\"sentinel\"],loadoutSlotCap:1,",
    "    campaignModifierIds:[],accessGrantIds:[],tutorialUpgradeGateMode:\"none\",inputs:commandSource,",
    "    checkpoints:[],finalClaim:{outcome:\"victory\",score:1,laurels:1,durationTicks:1,finalStateHash:\"b\".repeat(64)}",
    "  };",
    "  const replayCanonical = APIs.AegisReplay.canonicalEnvelopeString(replaySource);",
    "  function identity(value) {",
    "    return {canonical:ABI.canonicalEncode(value),hash:ABI.sha256Hex(ABI.canonicalBytes(value))};",
    "  }",
    "  return JSON.stringify({",
    "    commands:identity(commands),",
    "    management:identity(management),",
    "    replay:{canonical:replayCanonical,hash:ABI.sha256Hex(ABI.utf8Bytes(replayCanonical))}",
    "  });",
    "})()",
  ].join("\n");
}

test("strict JSON rejects duplicate keys, BOMs, decimal number tokens, and unsafe integers", () => {
  expectDiagnostic(
    () => parseStrictJsonBytes(Buffer.from('{"id":1,"id":2}'), "duplicate.json"),
    "JSON_DUPLICATE_KEY",
    "/id"
  );
  expectDiagnostic(
    () => parseStrictJsonBytes(Buffer.from([0xef, 0xbb, 0xbf, 0x7b, 0x7d]), "bom.json"),
    "JSON_BOM",
    "/"
  );
  expectDiagnostic(
    () => parseStrictJsonBytes(Buffer.from('{"value":1.25}'), "decimal.json"),
    "JSON_NUMBER_FORMAT",
    "/value"
  );
  expectDiagnostic(
    () => parseStrictJsonBytes(Buffer.from('{"value":9007199254740992}'), "unsafe.json"),
    "JSON_NUMBER_UNSAFE",
    "/value"
  );
  expectDiagnostic(
    () => parseStrictJsonBytes(Buffer.from([0x7b, 0x22, 0x78, 0x22, 0x3a, 0xc3, 0x28, 0x7d]), "utf8.json"),
    "JSON_UTF8",
    "/"
  );
  expectDiagnostic(
    () => parseStrictJsonBytes(Buffer.from('{"value":"\\ud800"}'), "surrogate.json"),
    "JSON_STRING_UNICODE",
    "/value"
  );
  expectDiagnostic(
    () => parseStrictJsonBytes(Buffer.from("[".repeat(258) + "0" + "]".repeat(258)), "deep.json"),
    "JSON_DEPTH"
  );
  const inert = parseStrictJsonBytes(Buffer.from('{"__proto__":{"polluted":true},"safe":1}'), "prototype.json");
  assert.equal(Object.getPrototypeOf(inert), null);
  assert.equal(Object.prototype.polluted, undefined);
  assert.equal(Object.prototype.hasOwnProperty.call(inert, "__proto__"), true);
});

test("strict JSON v3 options tighten depth, object fields, and negative zero without changing defaults", () => {
  const negativeZeroDefault = parseStrictJsonBytes(Buffer.from('{"value":-0}'), "legacy-negative-zero.json");
  assert.equal(negativeZeroDefault.value, 0);
  assert.equal(Object.is(negativeZeroDefault.value, -0), false);
  expectDiagnostic(
    () => parseStrictJsonBytes(
      Buffer.from('{"value":-0}'),
      "v3-negative-zero.json",
      { rejectNegativeZero: true }
    ),
    "JSON_NUMBER_NEGATIVE_ZERO",
    "/value"
  );
  expectDiagnostic(
    () => parseStrictJsonBytes(
      Buffer.from('{"a":1,"b":2}'),
      "v3-fields.json",
      { maxObjectFields: 1 }
    ),
    "JSON_OBJECT_FIELDS",
    "/b"
  );
  expectDiagnostic(
    () => parseStrictJsonBytes(
      Buffer.from('{"a":{"b":1}}'),
      "v3-depth.json",
      { maxDepth: 1 }
    ),
    "JSON_DEPTH",
    "/a/b"
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(parseStrictJsonBytes(
      Buffer.from('{"a":{"b":1}}'),
      "v3-bounds.json",
      { maxDepth: 2, maxObjectFields: 1, rejectNegativeZero: true }
    ))),
    { a: { b: 1 } }
  );
  assert.throws(
    () => parseStrictJsonBytes(Buffer.from("{}"), "options.json", { maxDepth: 257 }),
    /cannot relax|maximum|256/i
  );
  assert.throws(
    () => parseStrictJsonBytes(Buffer.from("{}"), "options.json", { surprise: true }),
    /Unknown strict JSON option/
  );
});

test("exact decimal compilation is string-only, signed, exact, and bounded", () => {
  assert.equal(parseExactDecimal("8", 1000, "/damage"), 8000);
  assert.equal(parseExactDecimal("12.34", 1000, "/range"), 12340);
  assert.equal(parseExactDecimal("-6.125", 1000, "/entry"), -6125);
  assert.equal(Object.is(parseExactDecimal("-0", 1000, "/entry"), -0), false);
  expectDiagnostic(() => parseExactDecimal("1e3", 1000, "/damage"), "DECIMAL_FORMAT", "/damage");
  expectDiagnostic(() => parseExactDecimal("0.001", 100, "/damage"), "DECIMAL_REPRESENTATION", "/damage");
  expectDiagnostic(() => parseExactDecimal(1.5, 1000, "/damage"), "DECIMAL_STRING", "/damage");
});

test("canonical encoding sorts ASCII keys and permits only integer canonical numbers", () => {
  assert.equal(canonicalEncode({ z: null, a: [3, true, "\u03a9"], nested: { b: 2, a: 1 } }), '{"a":[3,true,"\u03a9"],"nested":{"a":1,"b":2},"z":null}');
  assert.equal(canonicalEncode(-0), "0");
  expectDiagnostic(() => canonicalEncode({ "caf\u00e9": 1 }), "CANONICAL_KEY_ASCII", "/caf\u00e9");
  expectDiagnostic(() => canonicalEncode({ value: 1.5 }), "CANONICAL_INTEGER", "/value");
  const shared = { value: 1 };
  expectDiagnostic(() => canonicalEncode({ a: shared, b: shared }), "CANONICAL_SHARED", "/b");
  const extra = [1]; extra.note = true;
  expectDiagnostic(() => canonicalEncode(extra), "CANONICAL_ARRAY_PROPERTY", "/note");
  const outOfRange = []; outOfRange["4294967295"] = "smuggled";
  expectDiagnostic(() => canonicalEncode(outOfRange), "CANONICAL_ARRAY_PROPERTY", "/4294967295");
  const accessor = [];
  Object.defineProperty(accessor, "0", { enumerable: true, get: () => 1 });
  Object.defineProperty(accessor, "length", { value: 1 });
  expectDiagnostic(() => canonicalEncode(accessor), "CANONICAL_ARRAY_PROPERTY", "/0");
  const hidden = {};
  Object.defineProperty(hidden, "value", { value: 1, enumerable: false });
  expectDiagnostic(() => canonicalEncode(hidden), "CANONICAL_OBJECT_PROPERTY", "/value");
});

test("production simulation bundle is deterministic, source-byte-bound, and leaves modules untouched", () => {
  const before = new Map(MODULE_SPECS.map(function (spec) {
    return [spec.id, fs.readFileSync(path.join(SIMULATION_SOURCE_ROOT, spec.relativePath))];
  }));
  const first = buildSimulationBundle({ sourceRoot: SIMULATION_SOURCE_ROOT });
  const second = buildSimulationBundle({ sourceRoot: SIMULATION_SOURCE_ROOT });
  assert.deepEqual(first, second);
  const source = first.toString("utf8");
  assert.equal(source.includes("\r"), false);
  assert.equal(source.endsWith("\n"), true);
  assert.equal(source.endsWith("\n\n"), false);
  assert.doesNotMatch(source, /\brequire\s*\(|\bimport\s*(?:\(|["'])/);
  assert.doesNotMatch(source, /\beval\s*\(|\b(?:new\s+)?Function\s*\(/);
  assert.doesNotMatch(
    source,
    /\b(?:document|localStorage|sessionStorage|indexedDB|fetch|XMLHttpRequest|WebSocket|navigator)\b/
  );
  let priorSourceMarker = -1;
  for (const spec of MODULE_SPECS) {
    const bytes = before.get(spec.id);
    const sourceMarker = source.indexOf("/* source " + spec.relativePath + " bytes=");
    assert.ok(sourceMarker > priorSourceMarker, spec.id + " must retain its declared bundle order");
    priorSourceMarker = sourceMarker;
    assert.match(
      source,
      new RegExp(
        "source " + spec.relativePath.replace(".", "\\.") +
        " bytes=" + bytes.length + " sha256=" + sha256Hex(bytes)
      )
    );
    assert.deepEqual(
      fs.readFileSync(path.join(SIMULATION_SOURCE_ROOT, spec.relativePath)),
      bytes,
      spec.id + " source bytes must not be mutated"
    );
  }
  assert.equal(
    canonicalEncode(simulationDescriptor(first, "production-bundle.js")),
    RUNTIME_ABI.DESCRIPTOR_CANONICAL
  );
  assert.deepEqual(
    MODULE_SPECS.map(function (spec) {
      return [spec.id, spec.dependencies && spec.dependencies.map(function (dependency) {
        return [dependency.id, dependency.parameterName, dependency.requirePath];
      })];
    }),
    [
      ["abi", null],
      ["geometry", [["abi", "ABI", "./abi.js"]]],
      ["timers", [["abi", "ABI", "./abi.js"]]],
      ["economy", [["abi", "ABI", "./abi.js"]]],
      ["movement", [["abi", "ABI", "./abi.js"]]],
      ["effects", [["abi", "ABI", "./abi.js"]]],
      ["targeting", [
        ["abi", "ABI", "./abi.js"],
        ["geometry", "Geometry", "./geometry.js"],
      ]],
      ["behaviors", [
        ["abi", "ABI", "./abi.js"],
        ["geometry", "Geometry", "./geometry.js"],
        ["timers", "Timers", "./timers.js"],
        ["movement", "Movement", "./movement.js"],
        ["effects", "Effects", "./effects.js"],
        ["targeting", "Targeting", "./targeting.js"],
      ]],
      ["commands", [["abi", "ABI", "./abi.js"]]],
      ["management", [
        ["abi", "ABI", "./abi.js"],
        ["economy", "Economy", "./economy.js"],
        ["movement", "Movement", "./movement.js"],
        ["commands", "Commands", "./commands.js"],
      ]],
      ["objectives", [["abi", "ABI", "./abi.js"]]],
      ["kernel", [
        ["abi", "ABI", "./abi.js"],
        ["geometry", "Geometry", "./geometry.js"],
        ["timers", "Timers", "./timers.js"],
        ["economy", "Economy", "./economy.js"],
        ["movement", "Movement", "./movement.js"],
        ["effects", "Effects", "./effects.js"],
        ["targeting", "Targeting", "./targeting.js"],
        ["behaviors", "Behaviors", "./behaviors.js"],
        ["commands", "Commands", "./commands.js"],
        ["management", "Management", "./management.js"],
        ["objectives", "Objectives", "./objectives.js"],
      ]],
      ["replay-runner", [
        ["abi", "ABI", "./abi.js"],
        ["commands", "Commands", "./commands.js"],
        ["kernel", "Kernel", "./kernel.js"],
      ]],
      ["replay", [
        ["abi", "ABI", "./abi.js"],
        ["commands", "Commands", "./commands.js"],
        ["replay-runner", "ReplayRunner", "./replay-runner.js"],
      ]],
    ]
  );
  assert.equal(Object.isFrozen(MODULE_SPECS), true);
  MODULE_SPECS.forEach(function (spec) {
    assert.equal(Object.isFrozen(spec), true);
    if (spec.dependencies !== null) {
      assert.equal(Object.isFrozen(spec.dependencies), true);
      assert.equal(spec.dependencies.every(Object.isFrozen), true);
    }
  });
});

test("production simulation bundle exposes all frozen APIs with canonical parity and no platform I/O", () => {
  const bytes = buildSimulationBundle({ sourceRoot: SIMULATION_SOURCE_ROOT });

  const commonJsContext = vm.createContext(
    { module: { exports: {} }, exports: {} },
    { codeGeneration: { strings: false, wasm: false } }
  );
  vm.runInContext(bytes.toString("utf8"), commonJsContext, { filename: "aegis-sim-bundle.js" });
  const commonJs = commonJsContext.module.exports;
  assert.equal(Object.isFrozen(commonJs), true);
  MODULE_SPECS.forEach(function (spec) {
    assert.equal(Object.isFrozen(commonJs[spec.globalName]), true, spec.globalName + " CommonJS API");
  });
  assert.equal(commonJs.DESCRIPTOR_SHA256, RUNTIME_ABI.DESCRIPTOR_SHA256);
  assert.equal(commonJs.EVENT_SCHEMA_VERSION, 1);
  assert.equal(commonJs.BEHAVIOR_REGISTRY_VERSION, 1);
  assert.equal(commonJs.AegisGeometry.isWithinSquaredRange(0, 0, 3, 4, 5), true);
  assert.equal(commonJs.AegisTimers.authoredMillisecondsToTimeUnits(410), 24600);
  assert.equal(commonJs.AegisEconomy.sellRefund(90), 63);
  assert.deepEqual(
    JSON.parse(JSON.stringify(commonJs.AegisMovement.advanceMovementTick(
      commonJs.AegisMovement.createMovementState(), 600, 10000
    ))),
    { advance: 10, numerator: 6000000, state: { remainder: 0 } }
  );
  assert.equal(vm.runInContext(
    'module.exports.AegisEffects.selectStrongestStatus([{appliedTick:0,expiryTimeUnits:1000,magnitude:5,sourceId:1,statusId:"slow"}]).magnitude',
    commonJsContext
  ), 5);
  assert.equal(vm.runInContext([
    'module.exports.AegisTargeting.selectTarget("FRONT",',
    '{originX:0,originY:0,range:5,targetLayerIds:["ground"]},',
    '[{baseSpeedDistanceUnitsPerSecond:10,currentHpMilli:1000,id:7,layerId:"ground",remainingDistance:100,revealEligible:true,shieldPoolsMilli:[],threatPriority:0,x:3,y:4}]).id',
  ].join(""), commonJsContext), 7);
  assert.equal(typeof commonJs.AegisCommands.normalizeCommandSequence, "function");
  assert.equal(typeof commonJs.AegisManagement.applyCommandBucket, "function");
  assert.equal(typeof commonJs.AegisBehaviors.dispatchBehavior, "function");
  assert.equal(typeof commonJs.AegisObjectives.evaluateObjectives, "function");
  assert.equal(typeof commonJs.AegisKernel.advanceTick, "function");
  assert.equal(typeof commonJs.AegisReplayRunner.createBoundSimulator, "function");
  assert.equal(typeof commonJs.AegisReplay.canonicalEnvelopeString, "function");
  assert.equal(commonJsContext.Game, undefined, "CommonJS assembly uses a private bundle root");
  assert.equal(commonJsContext.require, undefined);

  const classic = vm.createContext({}, { codeGeneration: { strings: false, wasm: false } });
  vm.runInContext(bytes.toString("utf8"), classic, { filename: "aegis-sim-bundle.js" });
  MODULE_SPECS.forEach(function (spec) {
    assert.equal(Object.isFrozen(classic.Game[spec.globalName]), true, spec.globalName + " classic API");
  });
  assert.equal(classic.Game.AegisSim.DESCRIPTOR_SHA256, RUNTIME_ABI.DESCRIPTOR_SHA256);
  assert.equal(classic.Game.AegisSim.EVENT_SCHEMA_VERSION, 1);
  assert.equal(classic.Game.AegisSim.BEHAVIOR_REGISTRY_VERSION, 1);
  assert.equal(classic.Game.AegisGeometry.isWithinSquaredRange(0, 0, 3, 4, 5), true);
  assert.equal(classic.Game.AegisTimers.authoredMillisecondsToTimeUnits(1350), 81000);
  assert.equal(classic.Game.AegisEconomy.sellRefund(340), 238);
  assert.equal(
    classic.Game.AegisMovement.advanceMovementTick(
      classic.Game.AegisMovement.createMovementState(), 600, 10000
    ).advance,
    10
  );
  assert.equal(vm.runInContext(
    'Game.AegisEffects.selectStrongestStatus([{appliedTick:0,expiryTimeUnits:1000,magnitude:8,sourceId:1,statusId:"slow"}]).magnitude',
    classic
  ), 8);
  assert.equal(vm.runInContext([
    'Game.AegisTargeting.selectTarget("FRONT",',
    '{originX:0,originY:0,range:5,targetLayerIds:["ground"]},',
    '[{baseSpeedDistanceUnitsPerSecond:10,currentHpMilli:1000,id:9,layerId:"ground",remainingDistance:100,revealEligible:true,shieldPoolsMilli:[],threatPriority:0,x:3,y:4}]).id',
  ].join(""), classic), 9);
  const commonJsParity = vm.runInContext(
    bundleParityExpression("module.exports", "module.exports.AegisSim"),
    commonJsContext
  );
  const classicParity = vm.runInContext(
    bundleParityExpression("Game", "Game.AegisSim"),
    classic
  );
  assert.equal(commonJsParity, classicParity);
  const parity = JSON.parse(commonJsParity);
  assert.deepEqual(JSON.parse(parity.commands.canonical), [
    { defenseId: "sentinel", padId: "p01", seq: 0, tick: 0, type: "build" },
  ]);
  assert.equal(JSON.parse(parity.management.canonical).aether, 90);
  assert.equal(JSON.parse(parity.management.canonical).towers[0].defenseId, "sentinel");
  assert.equal(JSON.parse(parity.replay.canonical).inputs[0].type, "build");
  [parity.commands.hash, parity.management.hash, parity.replay.hash].forEach(function (hash) {
    assert.match(hash, /^[0-9a-f]{64}$/);
  });
  assert.equal(classic.GameSlopKit, undefined);
  assert.equal(classic.require, undefined);
  assert.equal(classic.document, undefined);
  assert.equal(classic.fetch, undefined);
  assert.equal(classic.localStorage, undefined);
  assert.equal(classic.sessionStorage, undefined);
  assert.equal(classic.indexedDB, undefined);
});

test("every declared deterministic module source changes simulation and ruleset identity", () => {
  const sources = readSimulationSources(SIMULATION_SOURCE_ROOT);
  const baselineBytes = assembleSimulationBundle(sources);
  const baseline = compile(FIXTURE, baselineBytes);
  for (const spec of MODULE_SPECS) {
    const changedBytes = assembleSimulationBundle(
      replaceModuleBytes(sources, spec.id, "/* Armara Aegis", "/* Armara  Aegis")
    );
    assert.notEqual(sha256Hex(changedBytes), sha256Hex(baselineBytes), spec.id);
    const changed = compile(FIXTURE, changedBytes);
    assert.notEqual(changed.artifacts.rulesetHash, baseline.artifacts.rulesetHash, spec.id);
  }
  for (const spec of MODULE_SPECS) {
    const original = sources.find(function (entry) { return entry.id === spec.id; }).bytes;
    assert.deepEqual(fs.readFileSync(path.join(SIMULATION_SOURCE_ROOT, spec.relativePath)), original);
  }
});

test("simulation bundle fails closed on missing, duplicate, unsafe, CRLF, and drifted module seams", () => {
  const sources = readSimulationSources(SIMULATION_SOURCE_ROOT);
  expectDiagnostic(
    () => assembleSimulationBundle(copySimulationSources(sources).slice(0, -1)),
    "SIMULATION_BUNDLE_MISSING",
    "/simulationBundle"
  );

  const duplicate = copySimulationSources(sources);
  duplicate[3] = {
    id: duplicate[1].id,
    relativePath: duplicate[1].relativePath,
    bytes: Buffer.from(duplicate[1].bytes),
  };
  expectDiagnostic(
    () => assembleSimulationBundle(duplicate),
    "SIMULATION_BUNDLE_DUPLICATE",
    "/simulationBundle/geometry"
  );

  const unsafe = copySimulationSources(sources);
  unsafe[0].relativePath = "../abi.js";
  expectDiagnostic(() => assembleSimulationBundle(unsafe), "SIMULATION_BUNDLE_PATH", "/simulationBundle");

  const reordered = copySimulationSources(sources);
  [reordered[1], reordered[2]] = [reordered[2], reordered[1]];
  expectDiagnostic(() => assembleSimulationBundle(reordered), "SIMULATION_BUNDLE_ORDER", "/simulationBundle/1");

  const crlf = copySimulationSources(sources);
  crlf[3].bytes = Buffer.from(crlf[3].bytes.toString("utf8").replace(/\n/g, "\r\n"), "utf8");
  expectDiagnostic(
    () => assembleSimulationBundle(crlf),
    "SIMULATION_BUNDLE_LINE_ENDINGS",
    "/simulationBundle/economy"
  );

  const drifted = replaceModuleBytes(sources, "geometry", 'require("./abi.js")', 'require("./wrong.js")');
  expectDiagnostic(
    () => assembleSimulationBundle(drifted),
    "SIMULATION_BUNDLE_SEAM",
    "/simulationBundle/geometry"
  );

  const targetingDependencyDrift = replaceModuleBytes(
    sources,
    "targeting",
    'factory(require("./abi.js"), require("./geometry.js"))',
    'factory(require("./geometry.js"), require("./abi.js"))'
  );
  expectDiagnostic(
    () => assembleSimulationBundle(targetingDependencyDrift),
    "SIMULATION_BUNDLE_SEAM",
    "/simulationBundle/targeting"
  );

  const targetingParameterDrift = replaceModuleBytes(
    sources,
    "targeting",
    "function (ABI, Geometry) {",
    "function (Geometry, ABI) {"
  );
  expectDiagnostic(
    () => assembleSimulationBundle(targetingParameterDrift),
    "SIMULATION_BUNDLE_SEAM",
    "/simulationBundle/targeting"
  );

  const targetingClassicCallDrift = replaceModuleBytes(
    sources,
    "targeting",
    "factory(game.AegisSim, game.AegisGeometry)",
    "factory(game.AegisGeometry, game.AegisSim)"
  );
  expectDiagnostic(
    () => assembleSimulationBundle(targetingClassicCallDrift),
    "SIMULATION_BUNDLE_SEAM",
    "/simulationBundle/targeting"
  );

  const targetingClassicGuardDrift = replaceModuleBytes(
    sources,
    "targeting",
    'if (!game.AegisGeometry) throw new Error("Game.AegisGeometry must be installed before targeting.js");',
    'if (!game.Geometry) throw new Error("Game.AegisGeometry must be installed before targeting.js");'
  );
  expectDiagnostic(
    () => assembleSimulationBundle(targetingClassicGuardDrift),
    "SIMULATION_BUNDLE_SEAM",
    "/simulationBundle/targeting"
  );

  const commandsDependencyDrift = replaceModuleBytes(
    sources,
    "commands",
    'factory(require("./abi.js"))',
    'factory(require("./economy.js"))'
  );
  expectDiagnostic(
    () => assembleSimulationBundle(commandsDependencyDrift),
    "SIMULATION_BUNDLE_SEAM",
    "/simulationBundle/commands"
  );

  const managementDependencyDrift = replaceModuleBytes(
    sources,
    "management",
    'require("./economy.js"),\n      require("./movement.js")',
    'require("./movement.js"),\n      require("./economy.js")'
  );
  expectDiagnostic(
    () => assembleSimulationBundle(managementDependencyDrift),
    "SIMULATION_BUNDLE_SEAM",
    "/simulationBundle/management"
  );

  const managementParameterDrift = replaceModuleBytes(
    sources,
    "management",
    "function (\n  ABI,\n  Economy,\n  Movement,\n  Commands\n) {",
    "function (\n  ABI,\n  Movement,\n  Economy,\n  Commands\n) {"
  );
  expectDiagnostic(
    () => assembleSimulationBundle(managementParameterDrift),
    "SIMULATION_BUNDLE_SEAM",
    "/simulationBundle/management"
  );

  const managementClassicGuardDrift = replaceModuleBytes(
    sources,
    "management",
    'if (!game.AegisCommands) throw new Error("Game.AegisCommands must be installed before management.js");',
    'if (!game.Commands) throw new Error("Game.AegisCommands must be installed before management.js");'
  );
  expectDiagnostic(
    () => assembleSimulationBundle(managementClassicGuardDrift),
    "SIMULATION_BUNDLE_SEAM",
    "/simulationBundle/management"
  );

  const replayDependencyDrift = replaceModuleBytes(
    sources,
    "replay",
    'require("./abi.js"),\n      require("./commands.js"),\n      require("./replay-runner.js")',
    'require("./commands.js"),\n      require("./abi.js"),\n      require("./replay-runner.js")'
  );
  expectDiagnostic(
    () => assembleSimulationBundle(replayDependencyDrift),
    "SIMULATION_BUNDLE_SEAM",
    "/simulationBundle/replay"
  );

  const replayClassicCallDrift = replaceModuleBytes(
    sources,
    "replay",
    "game.AegisSim,\n    game.AegisCommands,\n    game.AegisReplayRunner",
    "game.AegisCommands,\n    game.AegisSim,\n    game.AegisReplayRunner"
  );
  expectDiagnostic(
    () => assembleSimulationBundle(replayClassicCallDrift),
    "SIMULATION_BUNDLE_SEAM",
    "/simulationBundle/replay"
  );

  const rogueImport = copySimulationSources(sources);
  const geometry = rogueImport.find(function (entry) { return entry.id === "geometry"; });
  geometry.bytes = Buffer.from(
    geometry.bytes.toString("utf8").replace(/\n$/, '\nrequire("./rogue.js");\n'),
    "utf8"
  );
  expectDiagnostic(
    () => assembleSimulationBundle(rogueImport),
    "SIMULATION_BUNDLE_IMPORT",
    "/simulationBundle/geometry"
  );
});

test("valid-minimal source compiles twice to byte-identical immutable artifacts and a framed ruleset hash", () => {
  const first = compile();
  const second = compile();
  assert.equal(first.artifacts.outputs.size, 3);
  assert.equal(first.artifacts.rulesetHash, second.artifacts.rulesetHash);
  assert.deepEqual(Array.from(first.artifacts.outputs.keys()), Array.from(second.artifacts.outputs.keys()));
  for (const [name, bytes] of first.artifacts.outputs) {
    assert.deepEqual(bytes, second.artifacts.outputs.get(name), name);
  }
  const expected = "sha256:" + sha256Hex(frameRulesetBytes(
    first.artifacts.abiBytes,
    fs.readFileSync(SIMULATION),
    first.artifacts.contentBytes
  ));
  assert.equal(first.artifacts.rulesetHash, expected);
  assert.match(first.artifacts.rulesetHash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(first.artifacts.abiBytes.toString("utf8"), RUNTIME_ABI.DESCRIPTOR_CANONICAL);
  assert.equal(sha256Hex(first.artifacts.abiBytes), RUNTIME_ABI.DESCRIPTOR_SHA256);
  assert.deepEqual(
    first.artifacts.content.behaviorContracts,
    RUNTIME_ABI.DESCRIPTOR.behaviorRegistry.contracts
  );
  assert.equal(first.artifacts.rulesetHash, "sha256:d7645d030d44a971bae2db846a7db03845b9073d756b81185b7a592543b6d291");
  assert.equal(first.artifacts.manifestName, "manifest.8e837e6b4ed8195b12b0f4c8b287134012234c77471064dfca4c81ecabd710a0.json");
  assert.deepEqual(first.artifacts.content.missionIds, []);
  assert.equal(Object.prototype.hasOwnProperty.call(first.artifacts.content, "missionMaps"), false);
});

test("production v2 embeds the analyzer-exact frozen M1 record and derived manifest references", () => {
  const result = compileProduction();
  const direct = MapValidation.validateMissionMap(MapValidation.readMapFile(M01_SOURCE));
  const embedded = result.artifacts.content.missionMaps[0];
  assert.deepEqual(result.artifacts.content.missionIds, ["m01"]);
  assert.deepEqual(
    result.artifacts.manifest.missionMaps,
    [{ id: "m01", source: "maps/m01.json" }]
  );
  assert.equal(embedded.id, "m01");
  assert.equal(Object.prototype.hasOwnProperty.call(embedded, "source"), false);
  assert.equal(canonicalEncode(embedded.compiled), canonicalEncode(direct));
  assert.equal(embedded.compiled.routes[0].route.length, 260000);
  assert.deepEqual(
    embedded.compiled.pads.map(function (pad) { return [pad.id, pad.x, pad.y]; }),
    direct.pads.map(function (pad) { return [pad.id, pad.x, pad.y]; })
  );
  const embeddedP04 = embedded.compiled.analysis.pads.find(function (pad) { return pad.id === "p04"; });
  const embeddedR22 = embeddedP04.probes.find(function (probe) { return probe.probeId === "r22"; });
  const directP04 = direct.analysis.pads.find(function (pad) { return pad.id === "p04"; });
  const directR22 = directP04.probes.find(function (probe) { return probe.probeId === "r22"; });
  assert.deepEqual(embeddedR22.routes[0].windows, directR22.routes[0].windows);
  assert.equal(Object.isFrozen(result.source.missionMaps), true);
  assert.equal(Object.isFrozen(result.source.missionMaps[0]), true);
  assert.equal(Object.isFrozen(result.source.missionMaps[0].compiled.analysis), true);
  assert.equal(Object.isFrozen(result.artifacts.content.missionMaps[0].compiled.analysis), true);
});

test("production map identity is semantic while unreferenced report and SVG bytes are excluded", (t) => {
  const root = temporaryProductionSource();
  t.after(function () { fs.rmSync(root, { recursive: true, force: true }); });
  const mapPath = path.join(root, "maps", "m01.json");
  const baseline = compileProduction(root);

  const renamedRoot = temporaryProductionSource();
  t.after(function () { fs.rmSync(renamedRoot, { recursive: true, force: true }); });
  const renamedDirectory = path.join(renamedRoot, "authored");
  fs.mkdirSync(renamedDirectory);
  fs.renameSync(
    path.join(renamedRoot, "maps", "m01.json"),
    path.join(renamedDirectory, "dawn.json")
  );
  const renamedManifest = readManifest(renamedRoot);
  renamedManifest.missionMaps[0].source = "authored/dawn.json";
  writeManifest(renamedRoot, renamedManifest);
  const renamed = compileProduction(renamedRoot);
  assert.deepEqual(renamed.artifacts.contentBytes, baseline.artifacts.contentBytes);
  assert.equal(renamed.artifacts.rulesetHash, baseline.artifacts.rulesetHash);
  assert.notDeepEqual(renamed.artifacts.manifestBytes, baseline.artifacts.manifestBytes);
  assert.deepEqual(renamed.artifacts.manifest.missionMaps, [
    { id: "m01", source: "authored/dawn.json" },
  ]);

  const source = JSON.parse(fs.readFileSync(mapPath, "utf8"));
  const reversed = reverseJsonObjectKeys(source);
  fs.writeFileSync(
    mapPath,
    ("\n  " + JSON.stringify(reversed, null, 4) + "\n\n").replace(/\n/g, "\r\n")
  );
  const reordered = compileProduction(root);
  assert.deepEqual(reordered.artifacts.contentBytes, baseline.artifacts.contentBytes);
  assert.deepEqual(reordered.artifacts.manifestBytes, baseline.artifacts.manifestBytes);
  assert.equal(reordered.artifacts.rulesetHash, baseline.artifacts.rulesetHash);

  const reports = path.join(root, "unreferenced-review-output");
  fs.mkdirSync(reports);
  const report = MapReport.createMissionArtifacts(baseline.source.missionMaps[0].compiled);
  fs.writeFileSync(path.join(reports, "m01.json"), report.reportBytes);
  fs.writeFileSync(path.join(reports, "m01.svg"), report.svgBytes);
  fs.appendFileSync(path.join(reports, "m01.json"), "ignored report edit\n");
  fs.appendFileSync(path.join(reports, "m01.svg"), "<!-- ignored SVG edit -->\n");
  const reportEdited = compileProduction(root);
  assert.deepEqual(reportEdited.artifacts.contentBytes, baseline.artifacts.contentBytes);
  assert.equal(reportEdited.artifacts.rulesetHash, baseline.artifacts.rulesetHash);

  reversed.title = "Gate of Dawn — identity mutation";
  fs.writeFileSync(mapPath, JSON.stringify(reversed, null, 2) + "\n");
  const changed = compileProduction(root);
  assert.notDeepEqual(changed.artifacts.contentBytes, baseline.artifacts.contentBytes);
  assert.notEqual(changed.artifacts.rulesetHash, baseline.artifacts.rulesetHash);
});

test("source schema v2 rejects malformed mission manifests and unsafe map references before artifacts", (t) => {
  const roots = [];
  t.after(function () {
    roots.forEach(function (root) { fs.rmSync(root, { recursive: true, force: true }); });
  });
  function mutation(change) {
    const root = temporaryProductionSource();
    roots.push(root);
    const manifest = readManifest(root);
    change(manifest, root);
    writeManifest(root, manifest);
    return root;
  }

  let root = mutation(function (manifest) { manifest.missionMaps[0].extra = true; });
  expectDiagnostic(() => compileProduction(root), "SCHEMA_UNKNOWN_KEY", "/missionMaps/0/extra");

  root = mutation(function (manifest) { manifest.missionIds = ["m01"]; });
  expectDiagnostic(() => compileProduction(root), "SCHEMA_UNKNOWN_KEY", "/missionIds");

  root = mutation(function (manifest) { manifest.missionMaps = []; });
  expectDiagnostic(() => compileProduction(root), "SCHEMA_ARRAY", "/missionMaps");

  root = mutation(function (manifest) {
    manifest.missionMaps = [
      { id: "m01", source: "maps/m01.json" },
      { id: "m01", source: "maps/other.json" },
    ];
  });
  expectDiagnostic(() => compileProduction(root), "SCHEMA_DUPLICATE_ID", "/missionMaps/1/id");

  root = mutation(function (manifest) {
    manifest.missionMaps = [
      { id: "m01", source: "maps/m01.json" },
      { id: "m02", source: "maps/m01.json" },
    ];
  });
  expectDiagnostic(() => compileProduction(root), "SCHEMA_DUPLICATE_SOURCE", "/missionMaps/1/source");

  root = mutation(function (manifest) {
    manifest.missionMaps = [
      { id: "m02", source: "maps/m02.json" },
      { id: "m01", source: "maps/m01.json" },
    ];
  });
  expectDiagnostic(() => compileProduction(root), "SCHEMA_UNSTABLE_ORDER", "/missionMaps/1/id");

  root = mutation(function (manifest) { manifest.missionMaps[0].id = "M01"; });
  expectDiagnostic(() => compileProduction(root), "SCHEMA_STRING", "/missionMaps/0/id");

  root = mutation(function (manifest) { manifest.missionMaps[0].id = "legacy-proving-ground"; });
  expectDiagnostic(() => compileProduction(root), "MISSION_LEGACY_FORBIDDEN", "/missionMaps/0/id");

  root = mutation(function (manifest) { manifest.missionMaps[0].source = "../outside.json"; });
  expectDiagnostic(() => compileProduction(root), "SOURCE_REFERENCE", "/missionMaps/0/source");

  root = mutation(function (manifest) { manifest.missionMaps[0].source = "maps/m01.JSON"; });
  expectDiagnostic(() => compileProduction(root), "SOURCE_REFERENCE", "/missionMaps/0/source");

  root = mutation(function (manifest) { manifest.missionMaps[0].source = "maps/missing.json"; });
  expectDiagnostic(() => compileProduction(root), "SOURCE_READ", "/missionMaps/0/source");

  root = mutation(function (manifest, sourceRoot) {
    manifest.missionMaps[0].source = "maps/not-a-file.json";
    fs.mkdirSync(path.join(sourceRoot, "maps", "not-a-file.json"));
  });
  expectDiagnostic(() => compileProduction(root), "SOURCE_READ", "/missionMaps/0/source");

  root = mutation(function (manifest) { manifest.missionMaps[0].id = "m02"; });
  expectDiagnostic(() => compileProduction(root), "MAP_MANIFEST_ID", "/missionMaps/0/id");

  const duplicateRoot = temporaryProductionSource();
  roots.push(duplicateRoot);
  const alias = path.join(duplicateRoot, "map-alias");
  try {
    fs.symlinkSync(
      path.join(duplicateRoot, "maps"),
      alias,
      process.platform === "win32" ? "junction" : "dir"
    );
  } catch (error) {
    if (["EPERM", "EACCES", "ENOSYS"].includes(error && error.code)) {
      t.skip("Temporary directory links are unavailable for the duplicate-realpath fixture");
      return;
    }
    throw error;
  }
  const duplicateManifest = readManifest(duplicateRoot);
  duplicateManifest.missionMaps = [
    { id: "m01", source: "maps/m01.json" },
    { id: "m02", source: "map-alias/m01.json" },
  ];
  writeManifest(duplicateRoot, duplicateManifest);
  expectDiagnostic(
    () => compileProduction(duplicateRoot),
    "SOURCE_DUPLICATE_REALPATH",
    "/missionMaps/1/source"
  );
});

test("generated production content deeply freezes compiled maps in CommonJS and classic modes", () => {
  const result = compileProduction();
  const contentEntry = Array.from(result.artifacts.outputs).find(function (entry) {
    return entry[0].startsWith("aegis-content.");
  });
  const commonJsContext = vm.createContext({ module: { exports: {} }, exports: {} });
  vm.runInContext(contentEntry[1].toString("utf8"), commonJsContext, { filename: contentEntry[0] });
  const commonJs = commonJsContext.module.exports.CONTENT;
  assert.equal(Object.isFrozen(commonJs), true);
  assert.equal(Object.isFrozen(commonJs.missionMaps), true);
  assert.equal(Object.isFrozen(commonJs.missionMaps[0].compiled.routes[0].route.segments), true);
  assert.equal(Object.isFrozen(commonJs.missionMaps[0].compiled.analysis.pads[0].probes), true);

  const classicContext = vm.createContext({});
  vm.runInContext(contentEntry[1].toString("utf8"), classicContext, { filename: contentEntry[0] });
  const classic = classicContext.Game.AegisContent.CONTENT;
  assert.equal(Object.isFrozen(classic), true);
  assert.equal(Object.isFrozen(classic.missionMaps[0].compiled), true);
  assert.equal(Object.isFrozen(classic.missionMaps[0].compiled.padChecks[0].intent), true);
});

test("ruleset framing prefixes every ordered input with an unsigned 64-bit big-endian length", () => {
  const framed = frameRulesetBytes(Buffer.from("a"), Buffer.from("bc"), Buffer.alloc(0));
  let offset = 0;
  assert.equal(framed.readBigUInt64BE(offset), 1n); offset += 8;
  assert.equal(framed.subarray(offset, offset + 1).toString(), "a"); offset += 1;
  assert.equal(framed.readBigUInt64BE(offset), 2n); offset += 8;
  assert.equal(framed.subarray(offset, offset + 2).toString(), "bc"); offset += 2;
  assert.equal(framed.readBigUInt64BE(offset), 0n); offset += 8;
  assert.equal(offset, framed.length);
  assert.notDeepEqual(
    frameRulesetBytes(Buffer.from("ab"), Buffer.from("c"), Buffer.alloc(0)),
    framed
  );
});

test("artifact emission fails closed for incomplete or unknown source schemas", () => {
  expectDiagnostic(
    () => buildArtifacts({ schemaVersion: 3 }),
    "ARTIFACT_SCHEMA_UNIMPLEMENTED",
    "/schemaVersion"
  );
  expectDiagnostic(
    () => buildArtifacts({ schemaVersion: 0 }),
    "ARTIFACT_SCHEMA_UNIMPLEMENTED",
    "/schemaVersion"
  );
});

test("v3 compiler dispatch completes strict preflight then requires explicit simulation before emission", (t) => {
  const output = fs.mkdtempSync(path.join(os.tmpdir(), "aegis-v3-output-"));
  fs.rmSync(output, { recursive: true, force: true });
  t.after(function () { fs.rmSync(output, { recursive: true, force: true }); });
  expectDiagnostic(
    function () {
      executeBuild({
        mode: "write",
        sourceRoot: V3_STRUCTURAL_FIXTURE,
        repositoryRoot: V3_STRUCTURAL_FIXTURE,
        outputRoot: output,
      });
    },
    "SIMULATION_REQUIRED",
    "/simulation"
  );
  expectDiagnostic(
    function () {
      executeBuild({
        mode: "write",
        sourceRoot: V3_STRUCTURAL_FIXTURE,
        repositoryRoot: V3_STRUCTURAL_FIXTURE,
        simulationBytes: fs.readFileSync(SIMULATION),
        outputRoot: output,
      });
    },
    "SCHEMA_UNKNOWN_KEY",
    "/schemaVersion"
  );
  assert.equal(fs.existsSync(output), false);
  const structural = require(path.join(LIB, "source-loader.js")).loadSourceTree(
    V3_STRUCTURAL_FIXTURE,
    { repositoryRoot: V3_STRUCTURAL_FIXTURE }
  );
  assert.equal(structural.preflightOnly, true);
  assert.equal(structural.lockCoverageStatus, "deferred-until-normalization");
  assert.equal(structural.lockCoverage, undefined);
});

test("generated content loads as classic script and CommonJS while generated simulation needs no shared kit", () => {
  const result = compile();
  const contentEntry = Array.from(result.artifacts.outputs).find(([name]) => name.startsWith("aegis-content."));
  const simulationEntry = Array.from(result.artifacts.outputs).find(([name]) => name.startsWith("aegis-sim."));
  const classic = vm.createContext({});
  vm.runInContext(contentEntry[1].toString("utf8"), classic, { filename: contentEntry[0] });
  assert.ok(classic.Game.AegisContent.CONTENT);
  assert.equal(classic.GameSlopKit, undefined);
  assert.equal(classic.require, undefined);
  const simulationClassic = vm.createContext({});
  vm.runInContext(simulationEntry[1].toString("utf8"), simulationClassic, { filename: simulationEntry[0] });
  assert.ok(simulationClassic.Game.AegisSim.DESCRIPTOR);
  assert.equal(simulationClassic.GameSlopKit, undefined);
  assert.equal(simulationClassic.document, undefined);
  assert.equal(simulationClassic.fetch, undefined);

  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "aegis-artifact-"));
  const cjsPath = path.join(temp, contentEntry[0]);
  const simulationCjsPath = path.join(temp, simulationEntry[0]);
  fs.writeFileSync(cjsPath, contentEntry[1]);
  fs.writeFileSync(simulationCjsPath, simulationEntry[1]);
  const cjs = require(cjsPath);
  assert.equal(cjs.CONTENT.contentVersion, "fixture-foundation-1");
  assert.equal(Object.isFrozen(cjs.CONTENT), true);
  const simulationCjs = require(simulationCjsPath);
  assert.deepEqual(simulationCjs.DESCRIPTOR, RUNTIME_ABI.DESCRIPTOR);
  delete require.cache[require.resolve(cjsPath)];
  delete require.cache[require.resolve(simulationCjsPath)];
});

test("content emission preserves inert __proto__ data instead of reactivating object-literal semantics", () => {
  const nested = Object.create(null);
  nested.__proto__ = { polluted: true };
  nested.safe = 1;
  const context = vm.createContext({});
  vm.runInContext(renderContentArtifact({ nested: nested }).toString("utf8"), context);
  const loaded = context.Game.AegisContent.CONTENT.nested;
  assert.equal(Object.prototype.hasOwnProperty.call(loaded, "__proto__"), true);
  assert.equal(loaded.__proto__.polluted, true);
  assert.equal(loaded.polluted, undefined);
  assert.equal(Object.prototype.polluted, undefined);
});

test("simulation validation proves matching classic and CommonJS exports without laundering descriptor graphs", () => {
  const valid = fs.readFileSync(SIMULATION);
  expectDiagnostic(
    () => simulationDescriptor(Buffer.concat([
      valid,
      Buffer.from("\nif (typeof module === \"undefined\") throw new Error(\"classic-only failure\");\n"),
    ]), "classic-failure.js"),
    "SIMULATION_LOAD",
    "/simulation"
  );
  const divergent = Buffer.from(
    "(function(root){var api={DESCRIPTOR:{value:typeof module===\"undefined\"?2:1}};" +
    "if(typeof module!==\"undefined\"&&module.exports){module.exports=api;return;}" +
    "(root.Game=root.Game||{}).AegisSim=api;})(globalThis);\n"
  );
  expectDiagnostic(
    () => simulationDescriptor(divergent, "divergent.js"),
    "SIMULATION_MODE_MISMATCH",
    "/simulation/DESCRIPTOR"
  );
  const sparse = Buffer.from(
    "(function(root){var values=[];values.length=1;var api={DESCRIPTOR:{values:values}};" +
    "if(typeof module!==\"undefined\"&&module.exports){module.exports=api;return;}" +
    "(root.Game=root.Game||{}).AegisSim=api;})(globalThis);\n"
  );
  expectDiagnostic(
    () => simulationDescriptor(sparse, "sparse.js"),
    "SIMULATION_DESCRIPTOR_DATA",
    "/simulation/DESCRIPTOR/values/0"
  );
  const escapeAttempt = Buffer.from(
    "(function(root){var leaked=root.constructor.constructor(\"return process\")();" +
    "var api={DESCRIPTOR:{pid:leaked.pid}};" +
    "if(typeof module!==\"undefined\"&&module.exports){module.exports=api;return;}" +
    "(root.Game=root.Game||{}).AegisSim=api;})(globalThis);\n"
  );
  expectDiagnostic(
    () => simulationDescriptor(escapeAttempt, "escape.js"),
    "SIMULATION_LOAD",
    "/simulation"
  );
});

test("source contracts reject unknown keys, unknown behaviors, and runtime ABI drift with stable diagnostics", () => {
  const unknownRoot = temporaryFixture();
  const rootPath = path.join(unknownRoot, "schema-version.json");
  const root = JSON.parse(fs.readFileSync(rootPath, "utf8"));
  root.surprise = true;
  fs.writeFileSync(rootPath, JSON.stringify(root));
  expectDiagnostic(() => compile(unknownRoot), "SCHEMA_UNKNOWN_KEY", "/surprise");

  const prototypeRoot = temporaryFixture();
  const prototypeManifest = fs.readFileSync(path.join(prototypeRoot, "schema-version.json"), "utf8").replace(
    /\{/, '{"__proto__":{"polluted":true},'
  );
  fs.writeFileSync(path.join(prototypeRoot, "schema-version.json"), prototypeManifest);
  expectDiagnostic(() => compile(prototypeRoot), "SCHEMA_UNKNOWN_KEY", "/__proto__");
  assert.equal(Object.prototype.polluted, undefined);

  const alternateStream = temporaryFixture();
  const alternateManifestPath = path.join(alternateStream, "schema-version.json");
  const alternateManifest = JSON.parse(fs.readFileSync(alternateManifestPath, "utf8"));
  alternateManifest.abiDescriptor = "abi/abi-v1.json:untracked";
  fs.writeFileSync(alternateManifestPath, JSON.stringify(alternateManifest));
  expectDiagnostic(() => compile(alternateStream), "SOURCE_REFERENCE", "/abiDescriptor");

  const unknownBehavior = temporaryFixture();
  const behaviorPath = path.join(unknownBehavior, "behavior-contracts.json");
  const behaviors = JSON.parse(fs.readFileSync(behaviorPath, "utf8"));
  behaviors.contracts[0].id = "mystery";
  fs.writeFileSync(behaviorPath, JSON.stringify(behaviors));
  expectDiagnostic(() => compile(unknownBehavior), "BEHAVIOR_UNKNOWN", "/contracts");

  const drift = temporaryFixture();
  const abiPath = path.join(drift, "abi", "abi-v1.json");
  const abi = JSON.parse(fs.readFileSync(abiPath, "utf8"));
  abi.ticksPerSecond = 61;
  fs.writeFileSync(abiPath, JSON.stringify(abi));
  expectDiagnostic(() => compile(drift), "ABI_DESCRIPTOR_IDENTITY", "/");
  const pairedSimulation = fs.readFileSync(SIMULATION, "utf8").replace(
    '"ticksPerSecond":60',
    '"ticksPerSecond":61'
  );
  assert.notEqual(pairedSimulation, fs.readFileSync(SIMULATION, "utf8"));
  expectDiagnostic(
    () => compile(drift, Buffer.from(pairedSimulation)),
    "ABI_DESCRIPTOR_IDENTITY",
    "/"
  );
});

test("an explicit simulation byte seam is required and any simulation-byte change changes ruleset identity", () => {
  expectDiagnostic(
    () => compileSourceTree({ sourceRoot: FIXTURE }),
    "SIMULATION_REQUIRED",
    "/simulation"
  );
  const bytes = fs.readFileSync(SIMULATION);
  const first = compile(FIXTURE, bytes);
  const changed = Buffer.from(bytes.toString("utf8").replace(
    "/* Minimal self-contained",
    "/* Byte-mutated self-contained"
  ));
  const second = compile(FIXTURE, changed);
  assert.notEqual(first.artifacts.rulesetHash, second.artifacts.rulesetHash);
  expectDiagnostic(
    () => compile(FIXTURE, Buffer.concat([bytes, Buffer.from("\n")])),
    "SIMULATION_LINE_ENDINGS",
    "/simulation"
  );
});

test("write/check enforce immutable names, regular files, bytes, and verified historical artifacts", (t) => {
  const result = compile();
  const output = fs.mkdtempSync(path.join(os.tmpdir(), "aegis-generated-"));
  t.after(function () { fs.rmSync(output, { recursive: true, force: true }); });
  const written = writeArtifacts(result, output);
  assert.deepEqual(checkArtifacts(result, output), written);

  assert.equal(result.artifacts.outputs.set, undefined);
  const firstName = written[0];
  const exposed = result.artifacts.outputs.get(firstName);
  exposed[0] ^= 0xff;
  assert.notDeepEqual(exposed, result.artifacts.outputs.get(firstName));

  const historicalBytes = Buffer.from("historical immutable bytes\n");
  const historicalNames = ["aegis-content", "aegis-presentation", "aegis-release"].map(function (kind) {
    const name = kind + "." + sha256Hex(historicalBytes) + ".js";
    fs.writeFileSync(path.join(output, name), historicalBytes);
    return name;
  });
  const historicalName = historicalNames[0];
  assert.deepEqual(checkArtifacts(result, output), written);
  fs.appendFileSync(path.join(output, historicalName), "corrupt");
  expectDiagnostic(() => checkArtifacts(result, output), "ARTIFACT_IDENTITY");
  fs.writeFileSync(path.join(output, historicalName), historicalBytes);

  fs.writeFileSync(path.join(output, "mutable-pointer.js"), "forbidden");
  expectDiagnostic(() => checkArtifacts(result, output), "ARTIFACT_UNEXPECTED");
  fs.unlinkSync(path.join(output, "mutable-pointer.js"));

  const linkedBytesPath = path.join(output, "linked-identical-bytes.js");
  fs.writeFileSync(linkedBytesPath, result.artifacts.outputs.get(firstName));
  fs.unlinkSync(path.join(output, firstName));
  let linked = false;
  try {
    fs.symlinkSync(linkedBytesPath, path.join(output, firstName), "file");
    linked = true;
  } catch (error) {
    if (!["EPERM", "EACCES", "ENOSYS"].includes(error && error.code)) throw error;
  }
  if (linked) {
    expectDiagnostic(() => checkArtifacts(result, output), "ARTIFACT_TYPE", "/generated/" + firstName);
    expectDiagnostic(() => writeArtifacts(result, output), "ARTIFACT_COLLISION", "/generated/" + firstName);
    fs.unlinkSync(path.join(output, firstName));
  }
  fs.unlinkSync(linkedBytesPath);
  writeArtifacts(result, output);

  fs.writeFileSync(path.join(output, firstName), "collision");
  expectDiagnostic(() => writeArtifacts(result, output), "ARTIFACT_COLLISION");
  fs.unlinkSync(path.join(output, firstName));
  expectDiagnostic(() => checkArtifacts(result, output), "ARTIFACT_MISSING");

  const forged = {
    artifacts: { outputs: new Map([["../escape.js", Buffer.from("escape")]]) },
  };
  expectDiagnostic(() => writeArtifacts(forged, output), "ARTIFACT_NAME");
});

test("checked-in production artifacts pin the deterministic default simulation bundle", () => {
  const parsed = CLI.parseArgs(["--check"]);
  assert.equal(parsed.useDefaultSimulationBundle, true);
  assert.equal(parsed.simulationBytes, undefined);
  const first = CLI.materializeBuildOptions(parsed);
  const second = CLI.materializeBuildOptions(CLI.parseArgs(["--check"]));
  assert.deepEqual(first.simulationBytes, second.simulationBytes);
  assert.equal(
    sha256Hex(first.simulationBytes),
    sha256Hex(buildSimulationBundle({ sourceRoot: SIMULATION_SOURCE_ROOT }))
  );
  const checked = executeBuild(first);
  assert.match(checked.rulesetHash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(
    checked.files.some(function (name) {
      return name === "aegis-sim." + sha256Hex(first.simulationBytes) + ".js";
    }),
    true
  );
});

test("checked-in Candidate-BAL slice loads, adapts all maps, compiles, and remains release-ineligible", () => {
  const options = CLI.materializeBuildOptions(CLI.parseArgs([
    "--check",
    "--manifest",
    "games/aegis/content/manifests/slice-dev-v1.json",
  ]));
  const checked = executeBuild(options);
  const manifest = checked.result.artifacts.manifest;
  assert.equal(manifest.schemaVersion, 3);
  assert.equal(manifest.contentVersion, "slice-dev-v1");
  assert.equal(manifest.approvalState, "candidate-balance");
  assert.equal(manifest.releaseEligible, false);
  assert.equal(manifest.eventSchemaVersion, 1);
  assert.equal(manifest.behaviorRegistryVersion, 1);
  assert.deepEqual(manifest.includedIds.missions, ["m01", "m04", "m05"]);
  assert.deepEqual(manifest.includedIds.defenses, ["chronos", "hoplite", "oracle", "sentinel", "siege"]);
  assert.equal(checked.files.includes(manifest.contentArtifact), true);
  assert.equal(checked.files.includes(manifest.presentationArtifact), true);
  assert.equal(checked.files.includes(manifest.simulationArtifact), true);
  assert.equal(checked.files.includes("release.slice-dev-v1.js"), true);
  assert.equal(checked.files.includes("release.slice-dev-v1.json"), true);
  const aliases = new Map(releaseAliasEntries(checked.result));
  const alias = parseStrictJsonBytes(aliases.get("release.slice-dev-v1.json"), "release alias");
  assert.equal(Object.getPrototypeOf(alias), null, "strict JSON keeps the alias data-only");
  assert.deepEqual({ ...alias }, {
    approvalState: "candidate-balance",
    contentVersion: "slice-dev-v1",
    id: "slice-dev-v1",
    releaseArtifact: checked.result.artifacts.releaseName,
    releaseEligible: false,
    releaseHash: "sha256:" + checked.result.artifacts.releaseName.slice(14, -3),
    schemaVersion: 1,
  });
  const context = vm.createContext({ module: { exports: {} }, exports: {} });
  vm.runInContext(aliases.get("release.slice-dev-v1.js").toString("utf8"), context, {
    filename: "release.slice-dev-v1.js",
  });
  assert.equal(vm.runInContext("Object.isFrozen(module.exports.RELEASE_ALIAS)", context), true);
  assert.equal(vm.runInContext("module.exports.RELEASE_ALIAS.releaseHash", context), alias.releaseHash);
});

test("stable Candidate-BAL release aliases atomically track the current immutable release", (t) => {
  const result = compileSourceTree(CLI.materializeBuildOptions(CLI.parseArgs([
    "--write", "--manifest", "games/aegis/content/manifests/slice-dev-v1.json",
  ])));
  const output = fs.mkdtempSync(path.join(os.tmpdir(), "aegis-release-alias-"));
  t.after(function () { fs.rmSync(output, { recursive: true, force: true }); });
  const first = writeArtifacts(result, output);
  assert.equal(first.includes("release.slice-dev-v1.js"), true);
  assert.equal(first.includes("release.slice-dev-v1.json"), true);
  assert.deepEqual(writeArtifacts(result, output), first, "an identical rebuild must replace aliases safely");
  assert.deepEqual(checkArtifacts(result, output), first);
  const foundation = compileProduction();
  const foundationNames = writeArtifacts(foundation, output);
  assert.deepEqual(
    checkArtifacts(foundation, output), foundationNames,
    "the public foundation check must authenticate and tolerate the unlinked developer alias"
  );
  assert.deepEqual(checkArtifacts(result, output), first);
  fs.writeFileSync(path.join(output, "release.slice-dev-v1.json"), "stale\n");
  expectDiagnostic(
    function () { checkArtifacts(result, output); },
    "ARTIFACT_STALE",
    "/generated/release.slice-dev-v1.json"
  );
  writeArtifacts(result, output);
  assert.deepEqual(checkArtifacts(result, output), first);
});

test("CLI accepts exactly one mode, explicit named fixtures, and contained manifest/simulation overrides", () => {
  const defaultBuild = CLI.parseArgs(["--check"]);
  assert.equal(defaultBuild.mode, "check");
  assert.equal(defaultBuild.useDefaultSimulationBundle, true);
  const fixture = CLI.parseArgs(["--write", "--fixture", "valid-minimal"]);
  assert.equal(fixture.mode, "write");
  assert.equal(path.basename(fixture.sourceRoot), "valid-minimal");
  assert.equal(fixture.useDefaultSimulationBundle, false);
  assert.equal(CLI.materializeBuildOptions(fixture), fixture);
  const manifest = CLI.parseArgs([
    "--check",
    "--manifest",
    "games/aegis/content/manifests/slice-dev-v1.json",
  ]);
  assert.equal(
    manifest.manifestPath,
    path.join(REPO_ROOT, "games", "aegis", "content", "manifests", "slice-dev-v1.json")
  );
  assert.equal(manifest.repositoryRoot, REPO_ROOT);
  assert.equal(manifest.useDefaultSimulationBundle, true);
  const override = CLI.parseArgs(["--check", "--simulation", "games/aegis/js/sim/abi.js"]);
  assert.equal(override.simulationPath, path.join(REPO_ROOT, "games", "aegis", "js", "sim", "abi.js"));
  assert.equal(override.useDefaultSimulationBundle, false);
  assert.equal(CLI.materializeBuildOptions(override), override);
  assert.throws(() => CLI.parseArgs([]), /exactly one/);
  assert.throws(() => CLI.parseArgs(["--check", "--write"]), /exactly one/);
  assert.throws(() => CLI.parseArgs(["--check", "--fixture", ".."]), /fixture/i);
  assert.throws(
    () => CLI.parseArgs(["--check", "--fixture", "valid-minimal", "--manifest", "games/aegis/content/schema-version.json"]),
    /cannot be combined/i
  );
  assert.throws(() => CLI.parseArgs(["--check", "--manifest", "../outside.json"]), /portable|inside the repository/i);
  assert.throws(() => CLI.parseArgs(["--check", "--manifest", "D:relative.json"]), /portable/i);
  assert.throws(() => CLI.parseArgs(["--check", "--simulation", "../outside.js"]), /portable|inside the repository/i);
  assert.throws(() => CLI.parseArgs(["--check", "--simulation", "games/aegis/js/sim/abi.js:untracked"]), /portable/i);
  assert.throws(() => CLI.parseArgs(["--check", "--simulation", "D:relative.js"]), /portable/i);
  assert.throws(() => CLI.parseArgs(["--check", "--bogus"]), /Unknown argument/);
  assert.match(CLI.USAGE, /1 source\/build\/I\/O failure, 2 invalid CLI usage/);
  assert.match(CLI.USAGE, /complete declared deterministic simulation module bundle/);
  assert.match(CLI.USAGE, /--write --manifest <repo-relative-file>/);
  assert.doesNotMatch(CLI.USAGE, /preflight an alternate/);
  assert.doesNotMatch(CLI.USAGE, /abi\/geometry\/timers\/economy/);
});
