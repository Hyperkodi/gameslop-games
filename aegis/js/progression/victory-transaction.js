/* Armara Aegis pure verified-victory transaction builder (profile v2).
   Turns one authenticated replay-v2 envelope plus result facts into a frozen, self-verifying
   transaction record. It never touches storage, the wall clock, or any global. */
(function (root, factory) {
  "use strict";

  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(
      require("./profile-v2.js"),
      require("./progression.js"),
      require("../sim/replay-v2.js"),
      require("../sim/abi-v2.js")
    );
    return;
  }

  const game = root.Game;
  if (!game || !game.AegisProfileV2 || !game.AegisProgression || !game.AegisReplayV2 || !game.AegisSimV2) {
    throw new Error("Game.AegisProfileV2, AegisProgression, AegisReplayV2, and AegisSimV2 must be installed before victory-transaction.js");
  }
  const api = factory(game.AegisProfileV2, game.AegisProgression, game.AegisReplayV2, game.AegisSimV2);
  if (Object.prototype.hasOwnProperty.call(game, "AegisVictoryTransaction")) {
    if (game.AegisVictoryTransaction !== api) throw new Error("Game.AegisVictoryTransaction is already installed");
    return;
  }
  Object.defineProperty(game, "AegisVictoryTransaction", {
    value: api,
    writable: false,
    configurable: false,
    enumerable: true,
  });
})(typeof globalThis !== "undefined" ? globalThis : this, function (Profile, Progression, ReplayV2, ABI) {
  "use strict";

  if (!Profile || !Object.isFrozen(Profile) || Profile.PROFILE_SCHEMA_VERSION !== 2) {
    throw new TypeError("A frozen Aegis profile-v2 contract is required");
  }
  if (!Progression || !Object.isFrozen(Progression) || Progression.RUN_AUTHORIZATION_FORMAT_VERSION !== 2) {
    throw new TypeError("A frozen Aegis progression-v2 planner is required");
  }
  if (!ReplayV2 || !Object.isFrozen(ReplayV2) || ReplayV2.FORMAT_VERSION !== 2) {
    throw new TypeError("A frozen Aegis replay-v2 contract is required");
  }
  if (!ABI || !Object.isFrozen(ABI) || !ABI.DESCRIPTOR || ABI.DESCRIPTOR.version !== 2) {
    throw new TypeError("The frozen Aegis simulation ABI v2 is required");
  }

  const TRANSACTION_SCHEMA_VERSION = 2;
  const SHA256_ID = /^sha256:[0-9a-f]{64}$/;
  const STABLE_ID = /^[a-z0-9][a-z0-9._:-]*$/;
  const FORBIDDEN_KEYS = Object.freeze(["__proto__", "constructor", "prototype"]);
  const START_HEADER_FIELDS = Object.freeze([
    "formatVersion", "rulesetHash", "eventSchemaVersion", "missionId", "difficultyId",
    "assist", "seed", "loadoutIds", "loadoutSlotCap", "campaignModifierIds",
    "accessGrantIds", "tutorialUpgradeGateMode", "protocolLoadout", "protocolSlotCap",
    "protocolAuthority", "missionProtocolLoan", "relicIds", "relicSlotCap", "reinforcementId",
    "specializationAccessIds",
  ]);
  const INPUT_FIELDS = Object.freeze([
    "profile", "revision", "header", "replayEnvelope", "resultFacts", "contentIdentity", "journalTimestamp",
  ]);
  const RESULT_FACT_FIELDS = Object.freeze([
    "missionId", "difficultyId", "completedObjectiveIds", "defenseEvidence",
  ]);
  const RESULT_FIELDS = Object.freeze([
    "resultId", "missionId", "difficultyId", "outcome", "completedObjectiveIds", "defenseEvidence",
    "score", "durationTicks", "laurelIdsAdded", "grantIdsApplied", "masteryChanges", "replayId",
    "runAuthorization", "rulesetHash",
  ]);
  const REPLAY_FIELDS = Object.freeze(["replayId", "envelope"]);
  const PLAN_FIELDS = Object.freeze([
    "changed", "firstClear", "grantIdsApplied", "laurelIdsAdded", "masteryChanges", "repairs",
  ]);
  const JOURNAL_ENTRY_FIELDS = Object.freeze(["kind", "timestamp", "detail"]);
  const TRANSACTION_FIELDS = Object.freeze([
    "schemaVersion", "contentIdentity", "baseRevision", "profileBefore", "profileAfter",
    "plan", "result", "replay", "journalEntry",
  ]);
  const EVIDENCE_FIELDS = Object.freeze(["defenseId", "highestLevel", "specializationIds"]);
  const MASTERY_CHANGE_FIELDS = Object.freeze([
    "defenseId", "fieldedAdded", "temperedAdded", "masteredAdded", "strategosVictoryAdded",
    "specializationIdsAdded", "specializationAccessIdsAdded",
  ]);
  /* A transaction embeds one full replay envelope, so its bounds follow the replay limits. */
  const DATA_LIMITS = Object.freeze({
    maxDepth: 48,
    maxArrayLength: ReplayV2.DEFAULT_LIMITS.maxTotalCommands,
    maxObjectFields: 64,
    maxNodes: 256 + (ReplayV2.DEFAULT_LIMITS.maxTotalCommands * 4),
    maxStringLength: 256,
  });
  const JOURNAL_DETAIL_LIMITS = Object.freeze({
    maxDepth: 8,
    maxArrayLength: 64,
    maxObjectFields: 32,
    maxNodes: 256,
    maxStringLength: 256,
  });
  /* Pinned identities of the canonical test golden (fresh candidate-v4 profile, m01 story,
     seed 11, one build command). A change here is a contract change for every stored result. */
  const GOLDEN_IDS = Object.freeze({
    replayId: "sha256:d54566a1f09e32ca761b2d445d9c9ccf4c42e832e92dc21eeb822e213ecfce0f",
    resultId: "sha256:727c7215066b299091282cda4a8aa2773ba2034549575fabff8a15e55a8fcca7",
  });

  const MISSION_ID_SET = new Set(Profile.MISSION_IDS);
  const DIFFICULTY_ID_SET = new Set(Profile.DIFFICULTY_IDS);
  const OBJECTIVE_ID_SET = new Set(Profile.OBJECTIVE_IDS);
  const DEFENSE_ID_SET = new Set(Profile.DEFENSE_IDS);
  const SPECIALIZATION_ID_SET = new Set(Profile.SPECIALIZATION_IDS);
  const LAUREL_ID_SET = new Set(Profile.LAUREL_IDS);
  const GRANT_ID_SET = new Set(Profile.GRANT_IDS);

  function asciiCompare(left, right) {
    return left < right ? -1 : (left > right ? 1 : 0);
  }

  function deepFreeze(value, seen) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    const visited = seen || new Set();
    if (visited.has(value)) return value;
    visited.add(value);
    Object.getOwnPropertyNames(value).forEach(function (key) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor && Object.prototype.hasOwnProperty.call(descriptor, "value")) {
        deepFreeze(descriptor.value, visited);
      }
    });
    return Object.freeze(value);
  }

  /* Bounded strict copy: plain dense trees of safe integers, strings, booleans, and null.
     Accessors, symbols, cycles, shared references, foreign prototypes, unsafe integers, and
     prototype-polluting keys are rejected before any value is read. */
  function strictDataCopy(value, label, limits) {
    const seen = new Set();
    let nodeCount = 0;

    function copy(current, depth, path) {
      nodeCount += 1;
      if (nodeCount > limits.maxNodes) throw new RangeError(label + " exceeds the strict-data node limit");
      if (current === null || typeof current === "boolean") return current;
      if (typeof current === "number") {
        if (!Number.isSafeInteger(current) || Object.is(current, -0)) {
          throw new TypeError(path + " must contain only safe non-negative-zero integer data");
        }
        return current;
      }
      if (typeof current === "string") {
        if (current.length > limits.maxStringLength) {
          throw new RangeError(path + " exceeds the strict-data string limit");
        }
        return current;
      }
      if (!current || typeof current !== "object") {
        throw new TypeError(path + " contains an unsupported strict-data value");
      }
      if (depth > limits.maxDepth) throw new RangeError(label + " exceeds the strict-data depth limit");
      if (seen.has(current)) throw new TypeError(label + " cannot contain cycles or shared references");
      seen.add(current);
      if (Object.getOwnPropertySymbols(current).length !== 0) {
        throw new TypeError(path + " cannot contain symbol properties");
      }

      if (Array.isArray(current)) {
        if (Object.getPrototypeOf(current) !== Array.prototype) {
          throw new TypeError(path + " must be an ordinary array");
        }
        const lengthDescriptor = Object.getOwnPropertyDescriptor(current, "length");
        const length = lengthDescriptor && lengthDescriptor.value;
        if (!Number.isSafeInteger(length) || length < 0) {
          throw new TypeError(path + " must have an ordinary array length");
        }
        if (length > limits.maxArrayLength) {
          throw new RangeError(path + " exceeds the strict-data array length limit");
        }
        Object.getOwnPropertyNames(current).forEach(function (name) {
          if (name === "length") return;
          if (!/^(0|[1-9][0-9]*)$/.test(name) || Number(name) >= length) {
            throw new TypeError(path + " cannot contain extra array properties");
          }
        });
        const output = new Array(length);
        for (let index = 0; index < length; index += 1) {
          const descriptor = Object.getOwnPropertyDescriptor(current, String(index));
          if (!descriptor || !descriptor.enumerable || descriptor.get || descriptor.set ||
              !Object.prototype.hasOwnProperty.call(descriptor, "value")) {
            throw new TypeError(path + " must be a dense array of enumerable data elements");
          }
          output[index] = copy(descriptor.value, depth + 1, path + "[" + index + "]");
        }
        return output;
      }

      const prototype = Object.getPrototypeOf(current);
      if (prototype !== Object.prototype && prototype !== null) {
        throw new TypeError(path + " must be a plain object");
      }
      const names = Object.getOwnPropertyNames(current);
      if (names.length > limits.maxObjectFields) {
        throw new RangeError(path + " exceeds the strict-data object field limit");
      }
      const output = Object.create(null);
      names.forEach(function (name) {
        if (FORBIDDEN_KEYS.indexOf(name) !== -1) {
          throw new TypeError(path + " contains the forbidden key " + name);
        }
        const descriptor = Object.getOwnPropertyDescriptor(current, name);
        if (!descriptor || !descriptor.enumerable || descriptor.get || descriptor.set ||
            !Object.prototype.hasOwnProperty.call(descriptor, "value")) {
          throw new TypeError(path + " must contain only enumerable data properties");
        }
        Object.defineProperty(output, name, {
          value: copy(descriptor.value, depth + 1, path + "." + name),
          writable: true,
          configurable: true,
          enumerable: true,
        });
      });
      return output;
    }

    return copy(value, 0, label);
  }

  function exactFields(value, fields, label) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new TypeError(label + " must be a plain object");
    }
    const actual = Object.getOwnPropertyNames(value).sort(asciiCompare);
    const expected = fields.slice().sort(asciiCompare);
    if (actual.length !== expected.length || actual.some(function (field, index) {
      return field !== expected[index];
    })) {
      throw new TypeError(label + " must contain exactly: " + fields.join(", "));
    }
  }

  function safeInteger(value, label, minimum, maximum) {
    if (!Number.isSafeInteger(value) || Object.is(value, -0)) {
      throw new TypeError(label + " must be a safe integer");
    }
    if (value < minimum || value > maximum) {
      throw new RangeError(label + " must be between " + minimum + " and " + maximum);
    }
    return value;
  }

  function boolean(value, label) {
    if (typeof value !== "boolean") throw new TypeError(label + " must be boolean");
    return value;
  }

  function stableId(value, label) {
    if (typeof value !== "string" || value.length > 128 || !STABLE_ID.test(value)) {
      throw new TypeError(label + " must be a stable lowercase ID");
    }
    return value;
  }

  function sha256Id(value, label) {
    if (typeof value !== "string" || !SHA256_ID.test(value)) {
      throw new TypeError(label + " must be lowercase sha256:<64-hex>");
    }
    return value;
  }

  function knownId(value, set, label) {
    if (typeof value !== "string" || !set.has(value)) {
      throw new RangeError("Unknown " + label + " (received " + typeof value + ")");
    }
    return value;
  }

  function sortedUniqueKnownIds(value, set, label) {
    if (!Array.isArray(value)) throw new TypeError(label + " must be an array");
    const output = [];
    let prior = null;
    value.forEach(function (candidate, index) {
      const id = knownId(candidate, set, label + " entry " + index);
      if (prior !== null && prior >= id) {
        throw new RangeError(label + " must be unique and in strict ASCII order");
      }
      prior = id;
      output.push(id);
    });
    return output;
  }

  /* A detached plain-object graph: JSON data only, no shared references, no frozen inputs. */
  function detached(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function canonicalSha256(value) {
    return "sha256:" + ABI.sha256Hex(ABI.canonicalEncode(value));
  }

  function computeReplayId(envelope) {
    return "sha256:" + ABI.sha256Hex(ReplayV2.canonicalEnvelopeBytes(envelope));
  }

  function computeResultId(resultBody) {
    const body = strictDataCopy(resultBody, "Result record body", DATA_LIMITS);
    exactFields(body, RESULT_FIELDS.filter(function (field) { return field !== "resultId"; }), "Result record body");
    return canonicalSha256(body);
  }

  function normalizeJournalEntry(value) {
    exactFields(value, JOURNAL_ENTRY_FIELDS, "Journal entry");
    const kind = stableId(value.kind, "Journal entry kind");
    const timestamp = safeInteger(value.timestamp, "Journal entry timestamp", 0, Number.MAX_SAFE_INTEGER);
    let detail = null;
    if (value.detail !== null) {
      detail = strictDataCopy(value.detail, "Journal entry detail", JOURNAL_DETAIL_LIMITS);
      if (!detail || typeof detail !== "object" || Array.isArray(detail)) {
        throw new TypeError("Journal entry detail must be null or a plain object");
      }
    }
    return { kind: kind, timestamp: timestamp, detail: detail };
  }

  function validateJournalEntry(value) {
    return deepFreeze(detached(normalizeJournalEntry(
      strictDataCopy(value, "Journal entry", JOURNAL_DETAIL_LIMITS)
    )));
  }

  function normalizeResultFacts(value, label) {
    exactFields(value, RESULT_FACT_FIELDS, label);
    const missionId = knownId(value.missionId, MISSION_ID_SET, label + " mission ID");
    const difficultyId = knownId(value.difficultyId, DIFFICULTY_ID_SET, label + " difficulty ID");
    const completedObjectiveIds = sortedUniqueKnownIds(
      value.completedObjectiveIds, OBJECTIVE_ID_SET, label + " completed objective IDs"
    );
    if (!Array.isArray(value.defenseEvidence)) throw new TypeError(label + " defense evidence must be an array");
    const defenseEvidence = value.defenseEvidence.map(function (record, index) {
      exactFields(record, EVIDENCE_FIELDS, label + " defense evidence " + index);
      return {
        defenseId: knownId(record.defenseId, DEFENSE_ID_SET, label + " defense evidence ID"),
        highestLevel: safeInteger(record.highestLevel, label + " highest level", 1, 3),
        specializationIds: sortedUniqueKnownIds(
          record.specializationIds, SPECIALIZATION_ID_SET, label + " specialization IDs"
        ),
      };
    });
    return {
      missionId: missionId,
      difficultyId: difficultyId,
      completedObjectiveIds: completedObjectiveIds,
      defenseEvidence: defenseEvidence,
    };
  }

  function normalizeMasteryChanges(value, label) {
    if (!Array.isArray(value)) throw new TypeError(label + " must be an array");
    let prior = null;
    return value.map(function (record, index) {
      exactFields(record, MASTERY_CHANGE_FIELDS, label + " " + index);
      const defenseId = knownId(record.defenseId, DEFENSE_ID_SET, label + " defense ID");
      if (prior !== null && prior >= defenseId) {
        throw new RangeError(label + " must be unique and in strict ASCII order");
      }
      prior = defenseId;
      return {
        defenseId: defenseId,
        fieldedAdded: boolean(record.fieldedAdded, label + " fieldedAdded"),
        temperedAdded: boolean(record.temperedAdded, label + " temperedAdded"),
        masteredAdded: boolean(record.masteredAdded, label + " masteredAdded"),
        strategosVictoryAdded: boolean(record.strategosVictoryAdded, label + " strategosVictoryAdded"),
        specializationIdsAdded: sortedUniqueKnownIds(
          record.specializationIdsAdded, SPECIALIZATION_ID_SET, label + " specialization IDs added"
        ),
        specializationAccessIdsAdded: sortedUniqueKnownIds(
          record.specializationAccessIdsAdded, SPECIALIZATION_ID_SET, label + " specialization access IDs added"
        ),
      };
    });
  }

  function normalizeResultRecord(value) {
    exactFields(value, RESULT_FIELDS, "Result record");
    const facts = normalizeResultFacts({
      missionId: value.missionId,
      difficultyId: value.difficultyId,
      completedObjectiveIds: value.completedObjectiveIds,
      defenseEvidence: value.defenseEvidence,
    }, "Result record");
    if (value.outcome !== "victory") throw new RangeError("Result record outcome must be victory");
    if (facts.completedObjectiveIds.indexOf("victory") === -1) {
      throw new RangeError("Result record must include the victory objective");
    }
    const runAuthorization = Progression.validateRunAuthorization(value.runAuthorization);
    if (runAuthorization.missionId !== facts.missionId || runAuthorization.difficultyId !== facts.difficultyId) {
      throw new RangeError("Result record run authorization disagrees with its mission/difficulty");
    }
    const rulesetHash = sha256Id(value.rulesetHash, "Result record ruleset hash");
    if (rulesetHash !== runAuthorization.rulesetHash) {
      throw new RangeError("Result record ruleset hash disagrees with its run authorization");
    }
    const body = {
      missionId: facts.missionId,
      difficultyId: facts.difficultyId,
      outcome: "victory",
      completedObjectiveIds: facts.completedObjectiveIds,
      defenseEvidence: facts.defenseEvidence,
      score: safeInteger(value.score, "Result record score", 0, Number.MAX_SAFE_INTEGER),
      durationTicks: safeInteger(value.durationTicks, "Result record duration", 0, Number.MAX_SAFE_INTEGER),
      laurelIdsAdded: sortedUniqueKnownIds(value.laurelIdsAdded, LAUREL_ID_SET, "Result record Laurel IDs added"),
      grantIdsApplied: sortedUniqueKnownIds(value.grantIdsApplied, GRANT_ID_SET, "Result record grant IDs applied"),
      masteryChanges: normalizeMasteryChanges(value.masteryChanges, "Result record mastery change"),
      replayId: sha256Id(value.replayId, "Result record replay ID"),
      runAuthorization: detached(runAuthorization),
      rulesetHash: rulesetHash,
    };
    const resultId = sha256Id(value.resultId, "Result record result ID");
    const expectedId = canonicalSha256(body);
    if (resultId !== expectedId) throw new RangeError("Result record result ID does not match its canonical body");
    const output = { resultId: resultId };
    RESULT_FIELDS.forEach(function (field) {
      if (field !== "resultId") output[field] = body[field];
    });
    return output;
  }

  function validateResultRecord(value) {
    return deepFreeze(detached(normalizeResultRecord(
      strictDataCopy(value, "Result record", DATA_LIMITS)
    )));
  }

  function normalizeReplayRecord(value) {
    exactFields(value, REPLAY_FIELDS, "Replay record");
    const envelope = ReplayV2.normalizeReplayEnvelope(value.envelope);
    const replayId = sha256Id(value.replayId, "Replay record replay ID");
    const expectedId = computeReplayId(envelope);
    if (replayId !== expectedId) throw new RangeError("Replay record replay ID does not match its envelope");
    return { replayId: replayId, envelope: detached(envelope) };
  }

  function validateReplayRecord(value) {
    return deepFreeze(detached(normalizeReplayRecord(
      strictDataCopy(value, "Replay record", DATA_LIMITS)
    )));
  }

  /* The start header must be exactly the envelope minus inputs/checkpoints/finalClaim. Every
     header field is normalized through the replay-v2 validator and compared canonically. */
  function requireHeaderAgreement(header, envelope) {
    exactFields(header, START_HEADER_FIELDS, "Run header");
    const synthetic = {};
    START_HEADER_FIELDS.forEach(function (field) { synthetic[field] = header[field]; });
    synthetic.inputs = detached(envelope.inputs);
    synthetic.checkpoints = detached(envelope.checkpoints);
    synthetic.finalClaim = detached(envelope.finalClaim);
    const normalizedHeader = ReplayV2.normalizeReplayEnvelope(synthetic);
    START_HEADER_FIELDS.forEach(function (field) {
      if (ABI.canonicalEncode(normalizedHeader[field]) !== ABI.canonicalEncode(envelope[field])) {
        throw new RangeError("Replay envelope " + field + " disagrees with the run header");
      }
    });
  }

  function createVictoryTransaction(inputValue) {
    const input = strictDataCopy(inputValue, "Victory transaction input", DATA_LIMITS);
    exactFields(input, INPUT_FIELDS, "Victory transaction input");
    const contentIdentity = stableId(input.contentIdentity, "Victory transaction content identity");
    const baseRevision = safeInteger(input.revision, "Victory transaction base revision", 0, Number.MAX_SAFE_INTEGER);
    const journalTimestamp = safeInteger(
      input.journalTimestamp, "Victory transaction journal timestamp", 0, Number.MAX_SAFE_INTEGER
    );

    const envelope = ReplayV2.normalizeReplayEnvelope(input.replayEnvelope);
    requireHeaderAgreement(input.header, envelope);
    if (envelope.finalClaim.outcome !== "victory") {
      throw new RangeError("Replay envelope final claim is not a victory");
    }
    const facts = normalizeResultFacts(input.resultFacts, "Result facts");
    if (facts.missionId !== envelope.missionId) {
      throw new RangeError("Result facts mission ID disagrees with the replay envelope");
    }
    if (facts.difficultyId !== envelope.difficultyId) {
      throw new RangeError("Result facts difficulty ID disagrees with the replay envelope");
    }
    if (facts.completedObjectiveIds.length !== envelope.finalClaim.laurels) {
      throw new RangeError("Result facts Laurel count disagrees with the replay final claim");
    }

    const runAuthorization = Progression.deriveRunAuthorization(envelope, contentIdentity);
    const reconciliation = Profile.reconcileProfileV2(input.profile);
    const plan = Progression.planApplyVerifiedVictory(reconciliation.profile, {
      missionId: facts.missionId,
      difficultyId: facts.difficultyId,
      completedObjectiveIds: facts.completedObjectiveIds,
      defenseEvidence: facts.defenseEvidence,
      runAuthorization: runAuthorization,
    });

    const replayId = computeReplayId(envelope);
    const body = {
      missionId: facts.missionId,
      difficultyId: facts.difficultyId,
      outcome: "victory",
      completedObjectiveIds: facts.completedObjectiveIds,
      defenseEvidence: facts.defenseEvidence,
      score: envelope.finalClaim.score,
      durationTicks: envelope.finalClaim.durationTicks,
      laurelIdsAdded: detached(plan.laurelIdsAdded),
      grantIdsApplied: detached(plan.grantIdsApplied),
      masteryChanges: detached(plan.masteryChanges),
      replayId: replayId,
      runAuthorization: detached(runAuthorization),
      rulesetHash: envelope.rulesetHash,
    };
    const result = { resultId: canonicalSha256(body) };
    RESULT_FIELDS.forEach(function (field) {
      if (field !== "resultId") result[field] = body[field];
    });

    const transaction = {
      schemaVersion: TRANSACTION_SCHEMA_VERSION,
      contentIdentity: contentIdentity,
      baseRevision: baseRevision,
      profileBefore: reconciliation.profile,
      profileAfter: plan.profile,
      plan: {
        changed: plan.changed,
        firstClear: plan.firstClear,
        grantIdsApplied: plan.grantIdsApplied,
        laurelIdsAdded: plan.laurelIdsAdded,
        masteryChanges: plan.masteryChanges,
        repairs: plan.repairs,
      },
      result: result,
      replay: { replayId: replayId, envelope: envelope },
      journalEntry: {
        kind: "commit-victory",
        timestamp: journalTimestamp,
        detail: {
          missionId: facts.missionId,
          difficultyId: facts.difficultyId,
          resultId: result.resultId,
          replayId: replayId,
          firstClear: plan.firstClear,
        },
      },
    };
    return deepFreeze(detached(transaction));
  }

  /* Re-derives the whole transaction from its own inputs and requires canonical equality, so
     tampering with any derived field (ids, plan, profileAfter, journal) is rejected. */
  function validateVictoryTransaction(value) {
    const copy = strictDataCopy(value, "Victory transaction", DATA_LIMITS);
    exactFields(copy, TRANSACTION_FIELDS, "Victory transaction");
    if (copy.schemaVersion !== TRANSACTION_SCHEMA_VERSION) {
      throw new RangeError("Victory transaction schema version must be 2");
    }
    exactFields(copy.plan, PLAN_FIELDS, "Victory transaction plan");
    exactFields(copy.replay, REPLAY_FIELDS, "Victory transaction replay");
    exactFields(copy.result, RESULT_FIELDS, "Victory transaction result");
    const journalEntry = normalizeJournalEntry(copy.journalEntry);
    const baseRevision = safeInteger(copy.baseRevision, "Victory transaction base revision", 0, Number.MAX_SAFE_INTEGER);
    if (!copy.replay.envelope || typeof copy.replay.envelope !== "object" || Array.isArray(copy.replay.envelope)) {
      throw new TypeError("Victory transaction replay envelope must be a plain object");
    }
    /* The rebuilt header must be a structurally independent tree: the strict-data copy rejects
       shared references, so the header cannot alias nodes of the envelope it is derived from. */
    const envelopeSource = detached(copy.replay.envelope);
    const header = {};
    START_HEADER_FIELDS.forEach(function (field) {
      if (!Object.prototype.hasOwnProperty.call(copy.replay.envelope, field)) {
        throw new TypeError("Victory transaction replay envelope is missing " + field);
      }
      header[field] = envelopeSource[field];
    });
    const rebuilt = createVictoryTransaction({
      profile: copy.profileBefore,
      revision: baseRevision,
      header: header,
      replayEnvelope: copy.replay.envelope,
      resultFacts: {
        missionId: copy.result.missionId,
        difficultyId: copy.result.difficultyId,
        completedObjectiveIds: copy.result.completedObjectiveIds,
        defenseEvidence: copy.result.defenseEvidence,
      },
      contentIdentity: copy.contentIdentity,
      journalTimestamp: journalEntry.timestamp,
    });
    if (ABI.canonicalEncode(rebuilt) !== ABI.canonicalEncode(copy)) {
      throw new RangeError("Victory transaction does not match its re-derivation");
    }
    return rebuilt;
  }

  return deepFreeze({
    TRANSACTION_SCHEMA_VERSION: TRANSACTION_SCHEMA_VERSION,
    START_HEADER_FIELDS: START_HEADER_FIELDS,
    INPUT_FIELDS: INPUT_FIELDS,
    RESULT_FACT_FIELDS: RESULT_FACT_FIELDS,
    RESULT_FIELDS: RESULT_FIELDS,
    REPLAY_FIELDS: REPLAY_FIELDS,
    PLAN_FIELDS: PLAN_FIELDS,
    JOURNAL_ENTRY_FIELDS: JOURNAL_ENTRY_FIELDS,
    TRANSACTION_FIELDS: TRANSACTION_FIELDS,
    DATA_LIMITS: DATA_LIMITS,
    JOURNAL_DETAIL_LIMITS: JOURNAL_DETAIL_LIMITS,
    GOLDEN_IDS: GOLDEN_IDS,
    computeReplayId: computeReplayId,
    computeResultId: computeResultId,
    validateJournalEntry: validateJournalEntry,
    validateResultRecord: validateResultRecord,
    validateReplayRecord: validateReplayRecord,
    createVictoryTransaction: createVictoryTransaction,
    validateVictoryTransaction: validateVictoryTransaction,
  });
});
