"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const FIXTURE = path.join(__dirname, "fixtures", "compiler", "valid-minimal");
const SIMULATION = path.join(FIXTURE, "simulation.js");
const LIB = path.join(REPO_ROOT, "tools", "lib", "aegis");
const { AegisContentError } = require(path.join(LIB, "diagnostics.js"));
const { canonicalEncode } = require(path.join(LIB, "canonical.js"));
const { parseExactDecimal } = require(path.join(LIB, "exact-decimal.js"));
const { parseStrictJsonBytes } = require(path.join(LIB, "strict-json.js"));
const { compileSourceTree, writeArtifacts, checkArtifacts } = require(path.join(LIB, "compiler.js"));
const {
  frameRulesetBytes,
  renderContentArtifact,
  sha256Hex,
  simulationDescriptor,
} = require(path.join(LIB, "artifacts.js"));
const CLI = require(path.join(REPO_ROOT, "tools", "build-aegis-content.js"));
const RUNTIME_ABI = require(path.join(__dirname, "..", "js", "sim", "abi.js"));

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

function compile(root, simulationBytes) {
  return compileSourceTree({
    sourceRoot: root || FIXTURE,
    simulationPath: simulationBytes === undefined ? SIMULATION : undefined,
    simulationBytes: simulationBytes,
  });
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

test("valid-minimal source compiles twice to byte-identical immutable artifacts and a framed ruleset hash", () => {
  const first = compile();
  const second = compile();
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

test("write/check enforce immutable names, bytes, and verified historical artifacts", () => {
  const result = compile();
  const output = fs.mkdtempSync(path.join(os.tmpdir(), "aegis-generated-"));
  const written = writeArtifacts(result, output);
  assert.deepEqual(checkArtifacts(result, output), written);

  assert.equal(result.artifacts.outputs.set, undefined);
  const firstName = written[0];
  const exposed = result.artifacts.outputs.get(firstName);
  exposed[0] ^= 0xff;
  assert.notDeepEqual(exposed, result.artifacts.outputs.get(firstName));

  const historicalBytes = Buffer.from("historical immutable bytes\n");
  const historicalName = "aegis-content." + sha256Hex(historicalBytes) + ".js";
  fs.writeFileSync(path.join(output, historicalName), historicalBytes);
  assert.deepEqual(checkArtifacts(result, output), written);
  fs.appendFileSync(path.join(output, historicalName), "corrupt");
  expectDiagnostic(() => checkArtifacts(result, output), "ARTIFACT_IDENTITY");
  fs.writeFileSync(path.join(output, historicalName), historicalBytes);

  fs.writeFileSync(path.join(output, "mutable-pointer.js"), "forbidden");
  expectDiagnostic(() => checkArtifacts(result, output), "ARTIFACT_UNEXPECTED");
  fs.unlinkSync(path.join(output, "mutable-pointer.js"));

  fs.writeFileSync(path.join(output, firstName), "collision");
  expectDiagnostic(() => writeArtifacts(result, output), "ARTIFACT_COLLISION");
  fs.unlinkSync(path.join(output, firstName));
  expectDiagnostic(() => checkArtifacts(result, output), "ARTIFACT_MISSING");

  const forged = {
    artifacts: { outputs: new Map([["../escape.js", Buffer.from("escape")]]) },
  };
  expectDiagnostic(() => writeArtifacts(forged, output), "ARTIFACT_NAME");
});

test("CLI accepts exactly one mode, explicit named fixtures, and a repo-relative simulation override", () => {
  assert.equal(CLI.parseArgs(["--check"]).mode, "check");
  const fixture = CLI.parseArgs(["--write", "--fixture", "valid-minimal"]);
  assert.equal(fixture.mode, "write");
  assert.equal(path.basename(fixture.sourceRoot), "valid-minimal");
  const override = CLI.parseArgs(["--check", "--simulation", "games/aegis/js/sim/abi.js"]);
  assert.equal(override.simulationPath, path.join(REPO_ROOT, "games", "aegis", "js", "sim", "abi.js"));
  assert.throws(() => CLI.parseArgs([]), /exactly one/);
  assert.throws(() => CLI.parseArgs(["--check", "--write"]), /exactly one/);
  assert.throws(() => CLI.parseArgs(["--check", "--fixture", ".."]), /fixture/i);
  assert.throws(() => CLI.parseArgs(["--check", "--simulation", "../outside.js"]), /portable|inside the repository/i);
  assert.throws(() => CLI.parseArgs(["--check", "--simulation", "games/aegis/js/sim/abi.js:untracked"]), /portable/i);
  assert.throws(() => CLI.parseArgs(["--check", "--simulation", "D:relative.js"]), /portable/i);
  assert.throws(() => CLI.parseArgs(["--check", "--bogus"]), /Unknown argument/);
  assert.match(CLI.USAGE, /1 source\/build\/I\/O failure, 2 invalid CLI usage/);
});
