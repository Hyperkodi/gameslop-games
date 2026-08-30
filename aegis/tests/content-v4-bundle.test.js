"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const LIB = path.join(REPO_ROOT, "tools", "lib", "aegis");
const SIMULATION_ROOT = path.join(REPO_ROOT, "games", "aegis", "js", "sim");

const Bundle = require(path.join(LIB, "simulation-bundle.js"));

/* The exact deterministic module set the compiler declares, in CommonJS require order. Parameter
   names are the factory parameter identifiers written in each module file.

   Ruling R16: this one list serves every content schema, not schema 4 alone. `management.js` and
   `kernel.js` are single files with static ABI-v2 dependencies, so a schema-3 bundle that omitted
   `abi-v2`, `commands-v2`, `protocols`, and `relics` would emit a management seam referencing
   globals that were never installed. */
const DECLARED_V4_MODULES = [
  ["abi", "abi.js", "AegisSim", null],
  ["geometry", "geometry.js", "AegisGeometry", [["abi", "ABI"]]],
  ["timers", "timers.js", "AegisTimers", [["abi", "ABI"]]],
  ["economy", "economy.js", "AegisEconomy", [["abi", "ABI"]]],
  ["movement", "movement.js", "AegisMovement", [["abi", "ABI"]]],
  ["effects", "effects.js", "AegisEffects", [["abi", "ABI"]]],
  ["targeting", "targeting.js", "AegisTargeting", [["abi", "ABI"], ["geometry", "Geometry"]]],
  ["behaviors", "behaviors.js", "AegisBehaviors", [
    ["abi", "ABI"], ["geometry", "Geometry"], ["timers", "Timers"], ["movement", "Movement"],
    ["effects", "Effects"], ["targeting", "Targeting"],
  ]],
  ["commands", "commands.js", "AegisCommands", [["abi", "ABI"]]],
  ["abi-v2", "abi-v2.js", "AegisSimV2", [["abi", "ABI_V1"]]],
  ["commands-v2", "commands-v2.js", "AegisCommandsV2", [["abi-v2", "ABI"], ["commands", "CommandsV1"]]],
  ["protocols", "protocols.js", "AegisProtocols", [["abi-v2", "ABI"], ["commands-v2", "CommandsV2"]]],
  ["relics", "relics.js", "AegisRelics", [["abi-v2", "ABI"]]],
  ["management", "management.js", "AegisManagement", [
    ["abi", "ABI"], ["economy", "Economy"], ["movement", "Movement"], ["commands", "Commands"],
    ["commands-v2", "CommandsV2"], ["protocols", "Protocols"], ["relics", "Relics"],
  ]],
  ["objectives", "objectives.js", "AegisObjectives", [["abi", "ABI"]]],
  ["kernel", "kernel.js", "AegisKernel", [
    ["abi", "ABI"], ["geometry", "Geometry"], ["timers", "Timers"], ["economy", "Economy"],
    ["movement", "Movement"], ["effects", "Effects"], ["targeting", "Targeting"],
    ["behaviors", "Behaviors"], ["commands", "Commands"], ["management", "Management"],
    ["objectives", "Objectives"], ["abi-v2", "ABIV2"], ["commands-v2", "CommandsV2"],
    ["protocols", "Protocols"], ["relics", "Relics"],
  ]],
  ["replay-runner", "replay-runner.js", "AegisReplayRunner", [
    ["abi", "ABI"], ["commands", "Commands"], ["kernel", "Kernel"],
  ]],
  ["replay", "replay.js", "AegisReplay", [
    ["abi", "ABI"], ["commands", "Commands"], ["replay-runner", "ReplayRunner"],
  ]],
  ["replay-v2", "replay-v2.js", "AegisReplayV2", [
    ["abi-v2", "ABI"], ["commands-v2", "CommandsV2"], ["replay", "ReplayV1"],
  ]],
  ["replay-formats", "replay-formats.js", "AegisReplayFormats", [
    ["replay", "ReplayV1"], ["replay-v2", "ReplayV2"],
  ]],
];

function expectedClassicSeam(spec) {
  if (spec.dependencies === null) return null;
  const globals = spec.dependencies.map(function (dependency) {
    return Bundle.MODULE_SPECS.find(function (candidate) { return candidate.id === dependency.id; }).globalName;
  });
  const lines = ["  const game = root.Game;"];
  globals.forEach(function (globalName, index) {
    const prefix = index === 0 ? "!game || !game." : "!game.";
    lines.push(
      "  if (" + prefix + globalName + ') throw new Error("Game.' + globalName +
        ' must be installed before ' + spec.relativePath + '");'
    );
  });
  const args = globals.map(function (globalName) { return "game." + globalName; });
  if (args.length <= 2) {
    lines.push("  const api = factory(" + args.join(", ") + ");");
  } else {
    lines.push("  const api = factory(");
    args.forEach(function (argument, index) {
      lines.push("    " + argument + (index + 1 === args.length ? "" : ","));
    });
    lines.push("  );");
  }
  return lines.join("\n");
}

test("MODULE_SPECS declares one twenty-module list for every content schema", () => {
  assert.equal(Object.isFrozen(Bundle.MODULE_SPECS), true);
  assert.equal(Bundle.MODULE_SPECS.length, 20);
  assert.deepEqual(
    Bundle.MODULE_SPECS.map(function (spec) { return spec.id; }),
    DECLARED_V4_MODULES.map(function (declared) { return declared[0]; })
  );
  assert.equal(
    Bundle.MODULE_SPECS.some(function (spec) { return spec.id === "abi-v2"; }),
    true,
    "management.js and kernel.js statically require the ABI-v2 modules, so every schema bundles them"
  );
  /* R16: the declared "v1" and "v4" set names resolve to the same list, so a rebuilt schema-3
     release and a schema-4 release ship byte-identical simulation bytes. */
  const v1Bytes = Bundle.buildSimulationBundle({ sourceRoot: SIMULATION_ROOT, moduleSet: "v1" });
  const v4Bytes = Bundle.buildSimulationBundle({ sourceRoot: SIMULATION_ROOT, moduleSet: "v4" });
  const defaultBytes = Bundle.buildSimulationBundle({ sourceRoot: SIMULATION_ROOT });
  assert.deepEqual(v1Bytes, v4Bytes);
  assert.deepEqual(v1Bytes, defaultBytes);
});

test("MODULE_SPECS declares the exact twenty-module ABI-v2 set in require order", () => {
  const specs = Bundle.MODULE_SPECS;
  assert.equal(Object.isFrozen(specs), true);
  assert.equal(specs.length, DECLARED_V4_MODULES.length);
  assert.deepEqual(
    specs.map(function (spec) {
      return [
        spec.id,
        spec.relativePath,
        spec.globalName,
        spec.dependencies === null ? null : spec.dependencies.map(function (dependency) {
          return [dependency.id, dependency.parameterName];
        }),
      ];
    }),
    DECLARED_V4_MODULES
  );
  specs.forEach(function (spec, index) {
    assert.equal(Object.isFrozen(spec), true, spec.id + " spec is frozen");
    if (spec.dependencies === null) return;
    spec.dependencies.forEach(function (dependency) {
      assert.equal(
        dependency.requirePath,
        "./" + specs.find(function (candidate) { return candidate.id === dependency.id; }).relativePath
      );
      const dependencyIndex = specs.findIndex(function (candidate) { return candidate.id === dependency.id; });
      assert.ok(dependencyIndex >= 0 && dependencyIndex < index, spec.id + " requires " + dependency.id + " first");
    });
  });
  specs.forEach(function (spec) {
    assert.equal(
      fs.existsSync(path.join(SIMULATION_ROOT, spec.relativePath)),
      true,
      spec.relativePath + " exists in the simulation source root"
    );
  });
});

/* Every js/sim seam this bundle needs has landed, so a seam diagnostic is now a real failure, not
   a cross-lane block. The expected seam text is reported to make the drift obvious. */
test("the declared schema-4 simulation bundle assembles and installs every declared global", () => {
  let bytes;
  try {
    bytes = Bundle.buildSimulationBundle({ sourceRoot: SIMULATION_ROOT, moduleSet: "v4" });
  } catch (error) {
    const diagnostics = (error && error.diagnostics) || [];
    const seam = diagnostics.find(function (item) { return item.code === "SIMULATION_BUNDLE_SEAM"; });
    if (!seam) throw error;
    const moduleId = seam.path.split("/").pop();
    const spec = Bundle.MODULE_SPECS.find(function (candidate) { return candidate.id === moduleId; });
    assert.fail(
      "Schema-4 simulation bundling failed on a js/sim seam: " + seam.message +
      "\nExpected classic dependency seam for " + spec.relativePath + ":\n" +
      expectedClassicSeam(spec) +
      "\nRerun: node tools/build-aegis-content.js --check --manifest games/aegis/content-v4/manifests/candidate-v4.json"
    );
  }
  const source = bytes.toString("utf8");
  assert.equal(source.includes("\r"), false);
  assert.equal(source.endsWith("\n"), true);
  assert.doesNotMatch(source, /\brequire\s*\(|\bimport\s*(?:\(|["'])/);
  assert.doesNotMatch(source, /\beval\s*\(|\b(?:new\s+)?Function\s*\(/);
  let previousMarker = -1;
  Bundle.MODULE_SPECS.forEach(function (spec) {
    const marker = source.indexOf("/* source " + spec.relativePath + " bytes=");
    assert.ok(marker > previousMarker, spec.id + " must retain its declared bundle order");
    previousMarker = marker;
  });
  const classic = vm.createContext({}, { codeGeneration: { strings: false, wasm: false } });
  vm.runInContext(source, classic, { filename: "aegis-sim-v4-bundle.js" });
  Bundle.MODULE_SPECS.forEach(function (spec) {
    assert.equal(Object.isFrozen(classic.Game[spec.globalName]), true, spec.globalName + " classic API");
  });
  assert.equal(classic.Game.AegisSimV2.EVENT_SCHEMA_VERSION, 2);
  assert.equal(classic.Game.AegisSimV2.BEHAVIOR_REGISTRY_VERSION, 2);
  assert.equal(classic.Game.AegisSimV2.COMMAND_SCHEMA_VERSION, 2);
  assert.equal(classic.Game.AegisReplayFormats.FORMAT_VERSIONS.length, 2);
});

test("declared module sets are compiler-owned and never caller supplied", () => {
  let thrown = null;
  try { Bundle.buildSimulationBundle({ sourceRoot: SIMULATION_ROOT, moduleSet: "v9" }); }
  catch (error) { thrown = error; }
  assert.ok(thrown);
  assert.equal(thrown.name, "AegisContentError");
  assert.equal(thrown.diagnostics[0].code, "SIMULATION_BUNDLE_SPEC_SET");
  let forged = null;
  try {
    Bundle.buildSimulationBundle({
      sourceRoot: SIMULATION_ROOT,
      moduleSet: [{ id: "abi", relativePath: "abi.js", globalName: "AegisSim", dependencies: null }],
    });
  } catch (error) { forged = error; }
  assert.ok(forged);
  assert.equal(forged.diagnostics[0].code, "SIMULATION_BUNDLE_SPEC_SET");
});
