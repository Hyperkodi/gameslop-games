/* Armara Aegis deterministic Candidate-slice objective engine v1.
   Binds reviewed objective content before Start and evaluates only canonical kernel facts. */
(function (root, factory) {
  "use strict";

  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(require("./abi.js"));
    return;
  }

  const game = root.Game;
  if (!game || !game.AegisSim) throw new Error("Game.AegisSim must be installed before objectives.js");
  const api = factory(game.AegisSim);
  if (Object.prototype.hasOwnProperty.call(game, "AegisObjectives")) {
    if (game.AegisObjectives !== api) throw new Error("Game.AegisObjectives is already installed");
    return;
  }
  Object.defineProperty(game, "AegisObjectives", {
    value: api,
    writable: false,
    configurable: false,
    enumerable: true,
  });
})(typeof globalThis !== "undefined" ? globalThis : this, function (ABI) {
  "use strict";

  if (!ABI || !Object.isFrozen(ABI) || !Object.isFrozen(ABI.DESCRIPTOR)) {
    throw new TypeError("A frozen Aegis simulation ABI is required");
  }
  ["assertSafeInteger", "canonicalEncode", "checkedAdd"].forEach(function (name) {
    if (typeof ABI[name] !== "function") throw new TypeError("Aegis simulation ABI is missing " + name);
  });
  if (!ABI.DESCRIPTOR.canonicalEncoding ||
      ABI.DESCRIPTOR.canonicalEncoding.version !== 1 ||
      ABI.DESCRIPTOR.canonicalEncoding.arrays !== "authored-order") {
    throw new Error("Aegis objectives require the frozen canonical ABI v1 ordering contract");
  }

  const OBJECTIVE_SCHEMA_VERSION = 1;
  const DIFFICULTY_IDS = Object.freeze(["story", "strategos", "titan"]);
  const OUTCOMES = Object.freeze(["active", "defeat", "victory"]);
  const OBJECTIVE_IDS = Object.freeze(["victory", "integrity", "mastery"]);
  const BASE_RECORD_FIELDS = Object.freeze([
    "id", "kind", "titleKey", "descriptionKey", "progressKey",
  ]);
  const FACT_FIELDS = Object.freeze([
    "integrity", "lineageTagLeakCounts", "outcome", "ownedTowerCount", "routeLeakCounts",
  ]);
  const STABLE_LOWERCASE_ID = /^[a-z][a-z0-9._:-]*$/;
  const bindings = new WeakSet();

  function exactFields(value, expected, label) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new TypeError(label + " must be a plain object");
    }
    const actual = Object.keys(value).sort();
    const wanted = expected.slice().sort();
    if (actual.length !== wanted.length || actual.some(function (key, index) {
      return key !== wanted[index];
    })) {
      throw new TypeError(label + " must contain exactly: " + expected.join(", "));
    }
  }

  function requireArray(value, label, exactLength) {
    if (!Array.isArray(value)) throw new TypeError(label + " must be an array");
    if (exactLength !== undefined && value.length !== exactLength) {
      throw new RangeError(label + " must contain exactly " + exactLength + " records");
    }
    return value;
  }

  function nonnegativeInteger(value, label) {
    ABI.assertSafeInteger(value, label);
    if (value < 0) throw new RangeError(label + " must be nonnegative");
    return Object.is(value, -0) ? 0 : value;
  }

  function stableLowercaseId(value, label) {
    if (typeof value !== "string" || !STABLE_LOWERCASE_ID.test(value)) {
      throw new TypeError(label + " must be a stable lowercase ID or string key");
    }
    return value;
  }

  function requireDifficultyId(value) {
    if (typeof value !== "string" || DIFFICULTY_IDS.indexOf(value) === -1) {
      throw new RangeError("Unknown objective difficulty ID: " + String(value));
    }
    return value;
  }

  function validatePresentationKeys(record, label) {
    stableLowercaseId(record.titleKey, label + " title key");
    stableLowercaseId(record.descriptionKey, label + " description key");
    stableLowercaseId(record.progressKey, label + " progress key");
  }

  function sortedUniqueIds(value, label, minimumLength) {
    requireArray(value, label);
    if (value.length < minimumLength) {
      throw new RangeError(label + " must contain at least " + minimumLength + " ID");
    }
    const output = [];
    let prior = null;
    value.forEach(function (id, index) {
      const normalized = stableLowercaseId(id, label + " " + index);
      if (prior !== null && prior >= normalized) {
        throw new RangeError(label + " must be unique and in strict ASCII order");
      }
      output.push(normalized);
      prior = normalized;
    });
    return Object.freeze(output);
  }

  function frozenPredicate(value) {
    return Object.freeze(value);
  }

  function frozenRecord(id, kind, predicate) {
    return Object.freeze({ id: id, kind: kind, predicate: predicate });
  }

  function bindObjectives(objectiveRecords, difficultyIdInput) {
    ABI.canonicalEncode(objectiveRecords);
    const difficultyId = requireDifficultyId(difficultyIdInput);
    requireArray(objectiveRecords, "Objective records", OBJECTIVE_IDS.length);

    const records = [];
    let routeIds = Object.freeze([]);
    let lineageTagIds = Object.freeze([]);
    objectiveRecords.forEach(function (record, index) {
      const expectedId = OBJECTIVE_IDS[index];
      const label = "Objective record " + index;
      if (!record || record.id !== expectedId || record.kind !== expectedId) {
        throw new RangeError("Objective records must remain in victory, integrity, mastery order");
      }
      stableLowercaseId(record.id, label + " ID");
      validatePresentationKeys(record, label);

      if (expectedId === "victory") {
        exactFields(record, BASE_RECORD_FIELDS.concat(["predicate"]), label);
        if (record.predicate !== "mission-victory") {
          throw new RangeError("Victory objective predicate must be mission-victory");
        }
        records.push(frozenRecord(
          "victory",
          "victory",
          frozenPredicate({ kind: "mission-victory" })
        ));
        return;
      }

      if (expectedId === "integrity") {
        exactFields(record, BASE_RECORD_FIELDS.concat(["thresholdRecords"]), label);
        requireArray(record.thresholdRecords, "Integrity threshold records", DIFFICULTY_IDS.length);
        let selectedMinimum = null;
        record.thresholdRecords.forEach(function (threshold, thresholdIndex) {
          const thresholdLabel = "Integrity threshold record " + thresholdIndex;
          exactFields(threshold, ["difficultyId", "minimumIntegrity"], thresholdLabel);
          if (threshold.difficultyId !== DIFFICULTY_IDS[thresholdIndex]) {
            throw new RangeError("Integrity threshold records must remain in difficulty order");
          }
          const minimumIntegrity = nonnegativeInteger(
            threshold.minimumIntegrity,
            thresholdLabel + " minimum integrity"
          );
          if (threshold.difficultyId === difficultyId) selectedMinimum = minimumIntegrity;
        });
        records.push(frozenRecord(
          "integrity",
          "integrity",
          frozenPredicate({ kind: "minimum-integrity", minimumIntegrity: selectedMinimum })
        ));
        return;
      }

      exactFields(record, BASE_RECORD_FIELDS.concat(["predicate"]), label);
      const predicate = record.predicate;
      if (!predicate || typeof predicate !== "object" || Array.isArray(predicate)) {
        throw new TypeError("Mastery predicate must be a plain object");
      }
      stableLowercaseId(predicate.kind, "Mastery predicate kind");
      if (predicate.kind === "maximum-owned-towers-at-victory") {
        exactFields(predicate, ["kind", "maximum"], "Maximum-tower mastery predicate");
        records.push(frozenRecord(
          "mastery",
          "mastery",
          frozenPredicate({
            kind: predicate.kind,
            maximum: nonnegativeInteger(predicate.maximum, "Maximum owned towers"),
          })
        ));
        return;
      }
      if (predicate.kind === "no-leaks-from-routes") {
        exactFields(predicate, ["kind", "routeIds"], "Route-leak mastery predicate");
        routeIds = sortedUniqueIds(predicate.routeIds, "Mastery route IDs", 1);
        records.push(frozenRecord(
          "mastery",
          "mastery",
          frozenPredicate({ kind: predicate.kind, routeIds: Object.freeze(routeIds.slice()) })
        ));
        return;
      }
      if (predicate.kind === "no-leaks-from-lineage-tag") {
        exactFields(predicate, ["kind", "lineageTag"], "Lineage-leak mastery predicate");
        const lineageTag = stableLowercaseId(predicate.lineageTag, "Mastery lineage tag");
        lineageTagIds = Object.freeze([lineageTag]);
        records.push(frozenRecord(
          "mastery",
          "mastery",
          frozenPredicate({ kind: predicate.kind, lineageTag: lineageTag })
        ));
        return;
      }
      throw new RangeError("Unsupported mastery predicate: " + String(predicate.kind));
    });

    const binding = Object.freeze({
      difficultyId: difficultyId,
      lineageTagIds: lineageTagIds,
      records: Object.freeze(records),
      routeIds: routeIds,
      schemaVersion: OBJECTIVE_SCHEMA_VERSION,
    });
    bindings.add(binding);
    return binding;
  }

  function requireBinding(binding) {
    if (!binding || typeof binding !== "object" || !bindings.has(binding) || !Object.isFrozen(binding)) {
      throw new TypeError("Objective binding must come from bindObjectives before Start");
    }
    return binding;
  }

  function validateLeakCounters(value, expectedIds, idField, label) {
    requireArray(value, label, expectedIds.length);
    const counters = value.map(function (record, index) {
      const recordLabel = label + " record " + index;
      exactFields(record, [idField, "leakCount"], recordLabel);
      const id = stableLowercaseId(record[idField], recordLabel + " ID");
      if (id !== expectedIds[index]) {
        throw new RangeError(label + " must match the binding exactly and remain in binding order");
      }
      const output = { leakCount: nonnegativeInteger(record.leakCount, recordLabel + " leak count") };
      output[idField] = id;
      if (idField === "routeId") {
        return Object.freeze({ routeId: output.routeId, leakCount: output.leakCount });
      }
      return Object.freeze({ lineageTag: output.lineageTag, leakCount: output.leakCount });
    });
    return Object.freeze(counters);
  }

  function createObjectiveFacts(bindingInput, input) {
    const binding = requireBinding(bindingInput);
    ABI.canonicalEncode(input);
    exactFields(input, FACT_FIELDS, "Objective facts");
    if (typeof input.outcome !== "string" || OUTCOMES.indexOf(input.outcome) === -1) {
      throw new RangeError("Unknown objective outcome: " + String(input.outcome));
    }
    return Object.freeze({
      integrity: nonnegativeInteger(input.integrity, "Objective integrity"),
      lineageTagLeakCounts: validateLeakCounters(
        input.lineageTagLeakCounts,
        binding.lineageTagIds,
        "lineageTag",
        "Lineage-tag leak counters"
      ),
      outcome: input.outcome,
      ownedTowerCount: nonnegativeInteger(input.ownedTowerCount, "Objective owned tower count"),
      routeLeakCounts: validateLeakCounters(
        input.routeLeakCounts,
        binding.routeIds,
        "routeId",
        "Route leak counters"
      ),
    });
  }

  function sumLeakCounters(counters) {
    let total = 0;
    counters.forEach(function (record) {
      total = ABI.checkedAdd(total, record.leakCount);
    });
    return total;
  }

  function objectiveProgress(bindingRecord, facts) {
    const predicate = bindingRecord.predicate;
    let current;
    let target;
    let relation;
    if (predicate.kind === "mission-victory") {
      current = facts.outcome === "victory" ? 1 : 0;
      target = 1;
      relation = "at-least";
    } else if (predicate.kind === "minimum-integrity") {
      current = facts.integrity;
      target = predicate.minimumIntegrity;
      relation = "at-least";
    } else if (predicate.kind === "maximum-owned-towers-at-victory") {
      current = facts.ownedTowerCount;
      target = predicate.maximum;
      relation = "at-most";
    } else if (predicate.kind === "no-leaks-from-routes") {
      current = sumLeakCounters(facts.routeLeakCounts);
      target = 0;
      relation = "at-most";
    } else if (predicate.kind === "no-leaks-from-lineage-tag") {
      current = sumLeakCounters(facts.lineageTagLeakCounts);
      target = 0;
      relation = "at-most";
    } else {
      throw new RangeError("Unsupported bound objective predicate: " + String(predicate.kind));
    }
    const eligible = relation === "at-least" ? current >= target : current <= target;
    return Object.freeze({
      complete: facts.outcome === "victory" && eligible,
      current: current,
      eligible: eligible,
      id: bindingRecord.id,
      kind: bindingRecord.kind,
      predicateKind: predicate.kind,
      relation: relation,
      target: target,
    });
  }

  function evaluateObjectives(bindingInput, factsInput) {
    const binding = requireBinding(bindingInput);
    const facts = createObjectiveFacts(binding, factsInput);
    const objectiveResults = binding.records.map(function (record) {
      return objectiveProgress(record, facts);
    });
    let completedCount = 0;
    objectiveResults.forEach(function (result) {
      if (result.complete) completedCount = ABI.checkedAdd(completedCount, 1);
    });
    return Object.freeze({
      completedCount: completedCount,
      objectiveResults: Object.freeze(objectiveResults),
    });
  }

  return Object.freeze({
    ABI_DESCRIPTOR_SHA256: ABI.DESCRIPTOR_SHA256,
    OBJECTIVE_SCHEMA_VERSION: OBJECTIVE_SCHEMA_VERSION,
    OUTCOMES: OUTCOMES,
    bindObjectives: bindObjectives,
    createObjectiveFacts: createObjectiveFacts,
    evaluateObjectives: evaluateObjectives,
  });
});
