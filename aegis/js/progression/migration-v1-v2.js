/* Armara Aegis profile v1 → v2 migration (spec §13.6: monotonic, resumable, idempotent).

   No profile-v1 code exists in this repository, so the v1 record contract is defined here
   from campaign-expansion §12.2 and validated strictly. Anything that does not match exactly
   fails closed:

     {
       databaseVersion: 1,
       profileSchemaVersion: 1,
       profileId: "local:<uuid>",
       missionProgress: { m01: { completed: true, bestLaurelsOverall: 3, attempts: 2 } },
       records: {
         "m01|strategos|sha256:<ruleset>|sha256:<modifiers>|assist-0": {
           bestScore:  { value: 12000, replayId: "replay-score" },
           fastest:    { ticks: 18320, replayId: "replay-time" },
           bestLaurels:{ value: 3,     replayId: "replay-laurels" }
         }
       },
       campaignUnlockIds: ["tower.hoplite", "modifier.reserve-1"],
       loadoutIds: ["sentinel", "chronos", "siege", "hoplite"],
       cosmeticSelectionIds: [],
       cachedEntitlements: [],
       settings: {},
       migrationJournal: []
     }

   What migrates: mission completion and, through Progression.planApplyMissionFirstClear
   applied in campaign order, exactly the first-clear grants those completions prove. The
   planner enforces the linear prefix (R11), so a v1 record claiming m07 without m06 fails
   closed rather than inventing m06.

   What deliberately does not migrate (§13.6 "never invents", R15):
   - Laurel identities. Profile v1 stored Laurel *counts* (`bestLaurelsOverall`,
     `records[].bestLaurels.value`), never the objective/difficulty identity a v2 Laurel is.
     A count cannot prove which objective at which difficulty was earned, so no Laurel is
     granted and no allocation is restored; `getLaurelBudget` starts at 0 and Laurels are
     re-earned by verified v2 results.
   - Defense mastery and tempered branches. V1 kept no per-family branch evidence.
   - Recon tier, Protocol tiers, Relic/reinforcement loadouts, cosmetics. Each is derived
     from the applied-grant ledger by profile-v2 reconciliation or re-chosen by the player.
   - `loadoutIds`, `settings`, `cachedEntitlements`, `cosmeticSelectionIds`, and the v1
     `records` map, none of which have a v2 profile home.

   The module is pure: it reads no store, writes no store, and touches no clock, so a failed
   or interrupted migration leaves the store exactly as it was. The caller persists the
   returned journal and profile through storage-adapter.js. */
(function (root, factory) {
  "use strict";

  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(require("./profile-v2.js"), require("./progression.js"));
    return;
  }

  const game = root.Game;
  if (!game || !game.AegisProfileV2 || !game.AegisProgression) {
    throw new Error("Game.AegisProfileV2 and AegisProgression must be installed before migration-v1-v2.js");
  }
  const api = factory(game.AegisProfileV2, game.AegisProgression);
  if (Object.prototype.hasOwnProperty.call(game, "AegisProfileMigrationV1V2")) {
    if (game.AegisProfileMigrationV1V2 !== api) {
      throw new Error("Game.AegisProfileMigrationV1V2 is already installed");
    }
    return;
  }
  Object.defineProperty(game, "AegisProfileMigrationV1V2", {
    value: api,
    writable: false,
    configurable: false,
    enumerable: true,
  });
})(typeof globalThis !== "undefined" ? globalThis : this, function (Profile, Progression) {
  "use strict";

  if (!Profile || !Object.isFrozen(Profile) || Profile.PROFILE_SCHEMA_VERSION !== 2) {
    throw new TypeError("A frozen Aegis profile-v2 contract is required");
  }
  if (!Progression || !Object.isFrozen(Progression) ||
      Progression.RUN_AUTHORIZATION_FORMAT_VERSION !== 2) {
    throw new TypeError("A frozen Aegis progression-v2 planner is required");
  }

  const FROM_SCHEMA = 1;
  const TO_SCHEMA = 2;
  const V1_DATABASE_VERSION = 1;
  const V1_RECORD_FIELDS = Object.freeze([
    "databaseVersion", "profileSchemaVersion", "profileId", "missionProgress", "records",
    "campaignUnlockIds", "loadoutIds", "cosmeticSelectionIds", "cachedEntitlements",
    "settings", "migrationJournal",
  ]);
  const V1_MISSION_PROGRESS_FIELDS = Object.freeze(["completed", "bestLaurelsOverall", "attempts"]);
  const V1_RECORD_ENTRY_FIELDS = Object.freeze(["bestScore", "fastest", "bestLaurels"]);
  const V1_BEST_SCORE_FIELDS = Object.freeze(["value", "replayId"]);
  const V1_FASTEST_FIELDS = Object.freeze(["ticks", "replayId"]);
  const V1_BEST_LAURELS_FIELDS = Object.freeze(["value", "replayId"]);
  const MIGRATION_JOURNAL_FIELDS = Object.freeze(["fromSchema", "toSchema", "steps", "completed"]);
  const MIGRATION_STEP_FIELDS = Object.freeze(["index", "kind", "missionId", "done"]);
  const MIGRATION_INPUT_FIELDS = Object.freeze(["record", "contentIdentity", "journal", "profile"]);
  const STEP_CREATE_PROFILE = "create-profile";
  const STEP_APPLY_MISSION = "apply-mission-first-clear";
  const STEP_KINDS = Object.freeze([STEP_APPLY_MISSION, STEP_CREATE_PROFILE]);
  const REASONS = Object.freeze([
    "invalid-input",
    "invalid-journal",
    "invalid-partial-profile",
    "invalid-v1-record",
    "journal-mismatch",
    "migration-failed",
    "missing-partial-profile",
    "non-linear-completion",
    "unexpected-partial-profile",
  ]);
  const FORBIDDEN_KEYS = Object.freeze(["__proto__", "constructor", "prototype"]);
  const STABLE_ID = /^[a-z0-9][a-z0-9._:-]*$/;
  const V1_PROFILE_ID = /^local:[0-9a-f][0-9a-f-]{0,63}$/;
  const V1_RECORD_KEY =
    /^m(0[1-9]|1[0-9]|20)\|(story|strategos|titan)\|sha256:[0-9a-f]{64}\|sha256:[0-9a-f]{64}\|assist-[01]$/;
  const V1_REPLAY_ID = /^[a-z0-9][a-z0-9._:-]{0,127}$/;
  const STRICT_DATA_LIMITS = Object.freeze({
    maxDepth: 16,
    maxArrayLength: 256,
    maxObjectFields: 128,
    maxNodes: 20000,
    maxStringLength: 256,
  });
  const MAX_ATTEMPTS = 1000000;
  const MISSION_ID_SET = new Set(Profile.MISSION_IDS);

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

  function asciiCompare(left, right) {
    return left < right ? -1 : (left > right ? 1 : 0);
  }

  /* Bounded strict copy: plain dense trees of safe integers, strings, booleans, and null.
     Accessors, symbols, cycles, shared references, foreign prototypes, unsafe integers, and
     prototype-polluting keys are rejected before any value is read. */
  function strictDataCopy(value, label) {
    const limits = STRICT_DATA_LIMITS;
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
        Object.getOwnPropertyNames(current).forEach(function (propertyName) {
          if (propertyName === "length") return;
          if (!/^(0|[1-9][0-9]*)$/.test(propertyName) || Number(propertyName) >= length) {
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
      const output = {};
      names.forEach(function (propertyName) {
        if (FORBIDDEN_KEYS.indexOf(propertyName) !== -1) {
          throw new TypeError(path + " contains the forbidden key " + propertyName);
        }
        const descriptor = Object.getOwnPropertyDescriptor(current, propertyName);
        if (!descriptor || !descriptor.enumerable || descriptor.get || descriptor.set ||
            !Object.prototype.hasOwnProperty.call(descriptor, "value")) {
          throw new TypeError(path + " must contain only enumerable data properties");
        }
        Object.defineProperty(output, propertyName, {
          value: copy(descriptor.value, depth + 1, path + "." + propertyName),
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

  function boundedInteger(value, label, minimum, maximum) {
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

  function requireArray(value, label) {
    if (!Array.isArray(value)) throw new TypeError(label + " must be an array");
    return value;
  }

  function uniqueStableIds(value, label) {
    requireArray(value, label);
    const seen = new Set();
    value.forEach(function (candidate, index) {
      if (typeof candidate !== "string" || candidate.length > 128 || !STABLE_ID.test(candidate)) {
        throw new TypeError(label + " entry " + index + " must be a stable lowercase ID");
      }
      if (seen.has(candidate)) throw new RangeError(label + " must be unique");
      seen.add(candidate);
    });
    return value.slice();
  }

  function plainObject(value, label) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new TypeError(label + " must be a plain object");
    }
    return value;
  }

  function ok(value) {
    return deepFreeze({ ok: true, value: value === undefined ? null : value });
  }

  function failure(reason, detail) {
    if (REASONS.indexOf(reason) === -1) throw new RangeError("Unknown migration reason " + reason);
    return deepFreeze({
      ok: false,
      reason: reason,
      detail: typeof detail === "string" ? detail : null,
      value: null,
    });
  }

  /* Strict validation of the §12.2 v1 record. Unknown fields, unknown mission keys, malformed
     record keys, and out-of-range counters all fail closed. */
  function validateProfileV1(value) {
    const record = strictDataCopy(value, "Profile v1 record");
    exactFields(record, V1_RECORD_FIELDS, "Profile v1 record");
    if (record.databaseVersion !== V1_DATABASE_VERSION) {
      throw new RangeError("Profile v1 database version must be 1");
    }
    if (record.profileSchemaVersion !== FROM_SCHEMA) {
      throw new RangeError("Profile v1 schema version must be 1");
    }
    if (typeof record.profileId !== "string" || !V1_PROFILE_ID.test(record.profileId)) {
      throw new TypeError("Profile v1 profile ID must be local:<uuid>");
    }

    plainObject(record.missionProgress, "Profile v1 mission progress");
    const missionProgress = {};
    Object.getOwnPropertyNames(record.missionProgress).sort(asciiCompare).forEach(function (missionId) {
      if (!MISSION_ID_SET.has(missionId)) {
        throw new RangeError("Unknown profile v1 mission progress key " + missionId);
      }
      const entry = record.missionProgress[missionId];
      exactFields(entry, V1_MISSION_PROGRESS_FIELDS, "Profile v1 mission progress " + missionId);
      missionProgress[missionId] = {
        completed: boolean(entry.completed, missionId + " completed"),
        bestLaurelsOverall: boundedInteger(entry.bestLaurelsOverall, missionId + " best Laurels", 0, 3),
        attempts: boundedInteger(entry.attempts, missionId + " attempts", 0, MAX_ATTEMPTS),
      };
    });

    plainObject(record.records, "Profile v1 records");
    const records = {};
    Object.getOwnPropertyNames(record.records).sort(asciiCompare).forEach(function (key) {
      if (!V1_RECORD_KEY.test(key)) throw new RangeError("Malformed profile v1 record key " + key);
      const entry = record.records[key];
      exactFields(entry, V1_RECORD_ENTRY_FIELDS, "Profile v1 record " + key);
      exactFields(entry.bestScore, V1_BEST_SCORE_FIELDS, "Profile v1 record " + key + " best score");
      exactFields(entry.fastest, V1_FASTEST_FIELDS, "Profile v1 record " + key + " fastest");
      exactFields(entry.bestLaurels, V1_BEST_LAURELS_FIELDS, "Profile v1 record " + key + " best Laurels");
      [entry.bestScore.replayId, entry.fastest.replayId, entry.bestLaurels.replayId]
        .forEach(function (replayId) {
          if (typeof replayId !== "string" || !V1_REPLAY_ID.test(replayId)) {
            throw new TypeError("Profile v1 record " + key + " replay ID must be a stable ID");
          }
        });
      records[key] = {
        bestScore: {
          value: boundedInteger(entry.bestScore.value, key + " best score", 0, Number.MAX_SAFE_INTEGER),
          replayId: entry.bestScore.replayId,
        },
        fastest: {
          ticks: boundedInteger(entry.fastest.ticks, key + " fastest ticks", 0, Number.MAX_SAFE_INTEGER),
          replayId: entry.fastest.replayId,
        },
        bestLaurels: {
          value: boundedInteger(entry.bestLaurels.value, key + " best Laurels", 0, 3),
          replayId: entry.bestLaurels.replayId,
        },
      };
    });

    return deepFreeze({
      databaseVersion: V1_DATABASE_VERSION,
      profileSchemaVersion: FROM_SCHEMA,
      profileId: record.profileId,
      missionProgress: missionProgress,
      records: records,
      campaignUnlockIds: uniqueStableIds(record.campaignUnlockIds, "Profile v1 campaign unlock IDs"),
      loadoutIds: uniqueStableIds(record.loadoutIds, "Profile v1 loadout IDs"),
      cosmeticSelectionIds: uniqueStableIds(record.cosmeticSelectionIds, "Profile v1 cosmetic selection IDs"),
      cachedEntitlements: requireArray(record.cachedEntitlements, "Profile v1 cached entitlements").slice(),
      settings: plainObject(record.settings, "Profile v1 settings"),
      migrationJournal: requireArray(record.migrationJournal, "Profile v1 migration journal").slice(),
    });
  }

  /* Completed missions in campaign order. They must already be a linear prefix; a claim of
     m07 without m06 is not repaired, it is refused (R11/R15). */
  function completedMissionIdsOf(v1) {
    const completed = Profile.MISSION_IDS.filter(function (missionId) {
      const entry = Object.prototype.hasOwnProperty.call(v1.missionProgress, missionId)
        ? v1.missionProgress[missionId]
        : null;
      return entry !== null && entry.completed === true;
    });
    completed.forEach(function (missionId, index) {
      if (missionId !== Profile.MISSION_IDS[index]) {
        throw new RangeError(
          "Profile v1 completion is not a linear campaign prefix at " + missionId
        );
      }
    });
    return completed;
  }

  function buildSteps(completedMissionIds) {
    const steps = [{ index: 0, kind: STEP_CREATE_PROFILE, missionId: null, done: false }];
    completedMissionIds.forEach(function (missionId, offset) {
      steps.push({ index: offset + 1, kind: STEP_APPLY_MISSION, missionId: missionId, done: false });
    });
    return steps;
  }

  function journalFor(steps, completed) {
    return {
      fromSchema: FROM_SCHEMA,
      toSchema: TO_SCHEMA,
      steps: steps.map(function (step) {
        return {
          index: step.index,
          kind: step.kind,
          missionId: step.missionId,
          done: step.done === true,
        };
      }),
      completed: completed === true,
    };
  }

  function validateMigrationJournal(value) {
    const journal = strictDataCopy(value, "Migration journal");
    exactFields(journal, MIGRATION_JOURNAL_FIELDS, "Migration journal");
    if (journal.fromSchema !== FROM_SCHEMA) throw new RangeError("Migration journal fromSchema must be 1");
    if (journal.toSchema !== TO_SCHEMA) throw new RangeError("Migration journal toSchema must be 2");
    boolean(journal.completed, "Migration journal completed");
    requireArray(journal.steps, "Migration journal steps");
    if (journal.steps.length === 0) throw new RangeError("Migration journal must contain at least one step");
    let sawPending = false;
    journal.steps.forEach(function (step, index) {
      exactFields(step, MIGRATION_STEP_FIELDS, "Migration journal step " + index);
      if (step.index !== index) throw new RangeError("Migration journal step " + index + " is out of order");
      if (STEP_KINDS.indexOf(step.kind) === -1) {
        throw new RangeError("Unknown migration journal step kind " + step.kind);
      }
      if (step.kind === STEP_CREATE_PROFILE) {
        if (index !== 0) throw new RangeError("Only the first migration step creates the profile");
        if (step.missionId !== null) throw new RangeError("The create-profile step has no mission ID");
      } else {
        if (typeof step.missionId !== "string" || !MISSION_ID_SET.has(step.missionId)) {
          throw new RangeError("Migration journal step " + index + " must name a known mission");
        }
      }
      boolean(step.done, "Migration journal step " + index + " done");
      /* Monotonic: every completed step precedes every pending step. */
      if (!step.done) sawPending = true;
      else if (sawPending) throw new RangeError("Migration journal steps must complete in order");
    });
    if (journal.completed && journal.steps.some(function (step) { return !step.done; })) {
      throw new RangeError("A completed migration journal cannot contain a pending step");
    }
    return journal;
  }

  /* The immutable plan for one v1 record: what the migration will do, before it does any of
     it. Persist this journal first so an interruption is resumable. */
  function planMigrationV1ToV2(recordValue) {
    let v1;
    try {
      v1 = validateProfileV1(recordValue);
    } catch (error) {
      return failure("invalid-v1-record", error.message);
    }
    let completedMissionIds;
    try {
      completedMissionIds = completedMissionIdsOf(v1);
    } catch (error) {
      return failure("non-linear-completion", error.message);
    }
    return ok(deepFreeze({
      journal: journalFor(buildSteps(completedMissionIds), false),
      completedMissionIds: completedMissionIds,
    }));
  }

  function sameSteps(left, right) {
    if (left.length !== right.length) return false;
    return left.every(function (step, index) {
      return step.index === right[index].index &&
        step.kind === right[index].kind &&
        step.missionId === right[index].missionId;
    });
  }

  /* Run (or resume, or re-run) the migration.

     input: { record, contentIdentity, journal, profile }
       journal: null to start; the persisted journal to resume or to confirm a no-op
       profile: null before the create-profile step has run; the persisted partial otherwise

     Applying the same input twice produces the same profile, and a journal marked completed
     short-circuits to `changed: false`. */
  function migrateProfileV1ToV2(inputValue) {
    let input;
    let contentIdentity;
    try {
      input = plainObject(inputValue, "Migration input");
      exactFields(input, MIGRATION_INPUT_FIELDS, "Migration input");
      if (typeof input.contentIdentity !== "string" || input.contentIdentity.length > 128 ||
          !STABLE_ID.test(input.contentIdentity)) {
        throw new TypeError("Migration content identity must be a stable lowercase ID");
      }
      contentIdentity = input.contentIdentity;
    } catch (error) {
      return failure("invalid-input", error.message);
    }

    const planned = planMigrationV1ToV2(input.record);
    if (planned.ok !== true) return planned;
    const plannedSteps = planned.value.journal.steps;
    const completedMissionIds = planned.value.completedMissionIds;

    let steps = plannedSteps.map(function (step) {
      return { index: step.index, kind: step.kind, missionId: step.missionId, done: false };
    });
    let doneCount = 0;
    let alreadyCompleted = false;

    if (input.journal !== null && input.journal !== undefined) {
      let journal;
      try {
        journal = validateMigrationJournal(input.journal);
      } catch (error) {
        return failure("invalid-journal", error.message);
      }
      if (!sameSteps(journal.steps, plannedSteps)) {
        return failure("journal-mismatch", "The journal does not describe this v1 record");
      }
      steps = journal.steps.map(function (step) {
        return { index: step.index, kind: step.kind, missionId: step.missionId, done: step.done };
      });
      doneCount = steps.filter(function (step) { return step.done; }).length;
      alreadyCompleted = journal.completed === true;
    }

    let profile = null;
    if (doneCount === 0) {
      if (input.profile !== null && input.profile !== undefined) {
        return failure("unexpected-partial-profile", "No step has run, so no partial profile may exist");
      }
    } else {
      if (input.profile === null || input.profile === undefined) {
        return failure("missing-partial-profile", "Resuming requires the partial profile");
      }
      try {
        profile = Profile.validateProfileV2(input.profile);
      } catch (error) {
        return failure("invalid-partial-profile", error.message);
      }
      if (profile.contentIdentity !== contentIdentity) {
        return failure("invalid-partial-profile", "The partial profile has a different content identity");
      }
    }

    if (alreadyCompleted) {
      /* Idempotent no-op: nothing is recomputed and nothing changes. */
      return ok(deepFreeze({
        changed: false,
        resumedFromStep: doneCount,
        appliedStepCount: 0,
        profile: profile,
        journal: journalFor(steps, true),
        completedMissionIds: completedMissionIds.slice(),
        grantIdsApplied: [],
        repairs: [],
      }));
    }

    const grantIdsApplied = [];
    const repairs = [];
    let appliedStepCount = 0;
    try {
      for (let index = doneCount; index < steps.length; index += 1) {
        const step = steps[index];
        if (step.kind === STEP_CREATE_PROFILE) {
          profile = Profile.createProfileV2(contentIdentity);
        } else {
          const plan = Progression.planApplyMissionFirstClear(profile, step.missionId);
          plan.grantIdsApplied.forEach(function (grantId) { grantIdsApplied.push(grantId); });
          plan.repairs.forEach(function (repair) { repairs.push(repair); });
          profile = plan.profile;
        }
        step.done = true;
        appliedStepCount += 1;
      }
    } catch (error) {
      /* Fail closed with the journal exactly as far as it got; the store is untouched. */
      return failure("migration-failed", error.message);
    }

    const finalProfile = Profile.validateProfileV2(profile);
    return ok(deepFreeze({
      changed: appliedStepCount > 0,
      resumedFromStep: doneCount,
      appliedStepCount: appliedStepCount,
      profile: finalProfile,
      journal: journalFor(steps, true),
      completedMissionIds: completedMissionIds.slice(),
      grantIdsApplied: Array.from(new Set(grantIdsApplied)).sort(asciiCompare),
      repairs: repairs,
    }));
  }

  return deepFreeze({
    FROM_SCHEMA: FROM_SCHEMA,
    TO_SCHEMA: TO_SCHEMA,
    V1_DATABASE_VERSION: V1_DATABASE_VERSION,
    V1_RECORD_FIELDS: V1_RECORD_FIELDS,
    MIGRATION_JOURNAL_FIELDS: MIGRATION_JOURNAL_FIELDS,
    MIGRATION_STEP_FIELDS: MIGRATION_STEP_FIELDS,
    MIGRATION_INPUT_FIELDS: MIGRATION_INPUT_FIELDS,
    STEP_KINDS: STEP_KINDS,
    STEP_CREATE_PROFILE: STEP_CREATE_PROFILE,
    STEP_APPLY_MISSION: STEP_APPLY_MISSION,
    REASONS: REASONS,
    validateProfileV1: validateProfileV1,
    validateMigrationJournal: validateMigrationJournal,
    planMigrationV1ToV2: planMigrationV1ToV2,
    migrateProfileV1ToV2: migrateProfileV1ToV2,
  });
});
