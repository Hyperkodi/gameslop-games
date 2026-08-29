/* Armara Aegis replay-v2 start-header builder.
   Pure: it reads a resolved run snapshot plus immutable compiled records and
   returns the frozen start header the kernel and replay envelope share. It never
   reads storage, presentation state, wall-clock time, Recon, mastery, or the
   generic applied-grant ledger (spec ruling R12). */
(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
    return;
  }
  const game = root.Game = root.Game || {};
  if (!game || (typeof game !== "object" && typeof game !== "function")) {
    throw new Error("Cannot install Aegis run headers into a non-object Game namespace");
  }
  if (Object.prototype.hasOwnProperty.call(game, "AegisRunHeaderV2")) {
    if (game.AegisRunHeaderV2 !== api) throw new Error("Conflicting Game.AegisRunHeaderV2 is already installed");
    return;
  }
  Object.defineProperty(game, "AegisRunHeaderV2", {
    value: api,
    enumerable: true,
    configurable: false,
    writable: false,
  });
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const FORMAT_VERSION = 2;
  const EVENT_SCHEMA_VERSION = 2;
  const LOAN_TIER = 1;
  const MAX_UINT32 = 0xffffffff;
  const RULESET_HASH = /^sha256:[0-9a-f]{64}$/;
  const STABLE_ID = /^[a-z0-9][a-z0-9.-]*$/;
  const DIFFICULTY_IDS = Object.freeze(["story", "strategos", "titan"]);
  const GATE_MODES = Object.freeze(["m01-wave1", "none"]);
  const MAX_PROTOCOL_SLOT_CAP = 2;
  const MAX_RELIC_SLOT_CAP = 2;
  const MAX_TIER = 3;

  const INPUT_FIELDS = Object.freeze([
    "accessGrantMappings", "assist", "difficultyId", "loadoutIds", "mission",
    "protocolAuthority", "rulesetHash", "seed", "snapshot",
  ]);
  const HEADER_FIELDS = Object.freeze([
    "formatVersion", "rulesetHash", "eventSchemaVersion", "missionId", "difficultyId",
    "assist", "seed", "loadoutIds", "loadoutSlotCap", "campaignModifierIds",
    "accessGrantIds", "tutorialUpgradeGateMode", "protocolLoadout", "protocolSlotCap",
    "protocolAuthority", "missionProtocolLoan", "relicIds", "relicSlotCap",
    "reinforcementId", "specializationAccessIds",
  ]);
  const FORBIDDEN_HEADER_FIELDS = Object.freeze([
    "reconTier", "appliedGrantIds", "defenseMastery", "earnedLaurelIds",
    "completedMissionIds", "timestamp", "journalTimestamp", "profileId",
  ]);

  function deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.getOwnPropertyNames(value).forEach(function (key) { deepFreeze(value[key]); });
    return Object.freeze(value);
  }

  function isPlainObject(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  function exactFields(value, expected, label) {
    if (!isPlainObject(value)) throw new TypeError(label + " must be a plain object");
    if (Object.getOwnPropertySymbols(value).length !== 0) {
      throw new TypeError(label + " cannot contain symbol properties");
    }
    const actual = Object.keys(value).slice().sort();
    const wanted = expected.slice().sort();
    if (actual.length !== wanted.length || actual.some(function (key, index) { return key !== wanted[index]; })) {
      throw new TypeError(label + " must contain exactly: " + wanted.join(", "));
    }
    return value;
  }

  function stableId(value, label) {
    if (typeof value !== "string" || !STABLE_ID.test(value)) {
      throw new TypeError(label + " must be a stable lowercase ID");
    }
    return value;
  }

  function boundedInteger(value, minimum, maximum, label) {
    if (!Number.isSafeInteger(value) || Object.is(value, -0) || value < minimum || value > maximum) {
      throw new RangeError(label + " must be an integer between " + minimum + " and " + maximum);
    }
    return value;
  }

  function asciiCompare(left, right) {
    return left < right ? -1 : (left > right ? 1 : 0);
  }

  function sortedUniqueIds(value, label) {
    if (!Array.isArray(value)) throw new TypeError(label + " must be an array");
    const seen = new Set();
    value.forEach(function (entry, index) {
      const id = stableId(entry, label + " entry " + index);
      if (seen.has(id)) throw new RangeError(label + " must not repeat " + id);
      seen.add(id);
    });
    return Array.from(seen).sort(asciiCompare);
  }

  /* Permanent Protocol authority is the only Protocol ledger a header may carry:
     the tiers the player has actually paid Laurels to make available. */
  function deriveProtocolAuthority(profile) {
    if (!isPlainObject(profile) || !Array.isArray(profile.protocols)) {
      throw new TypeError("Protocol authority requires a validated profile with a Protocol catalog");
    }
    const records = [];
    profile.protocols.forEach(function (record, index) {
      if (!isPlainObject(record)) throw new TypeError("Protocol catalog entry " + index + " must be a plain object");
      if (record.granted !== true) return;
      records.push({
        protocolId: stableId(record.id, "Protocol catalog entry " + index + " id"),
        availableTier: boundedInteger(record.availableTier, 1, MAX_TIER, "Protocol available tier"),
      });
    });
    records.sort(function (left, right) { return asciiCompare(left.protocolId, right.protocolId); });
    const seen = new Set();
    records.forEach(function (record) {
      if (seen.has(record.protocolId)) throw new RangeError("Duplicate granted Protocol " + record.protocolId);
      seen.add(record.protocolId);
    });
    return deepFreeze(records);
  }

  function normalizeAuthority(value) {
    if (!Array.isArray(value)) throw new TypeError("Protocol authority must be an array");
    const records = value.map(function (entry, index) {
      exactFields(entry, ["protocolId", "availableTier"], "Protocol authority entry " + index);
      return {
        protocolId: stableId(entry.protocolId, "Protocol authority protocolId"),
        availableTier: boundedInteger(entry.availableTier, 1, MAX_TIER, "Protocol available tier"),
      };
    });
    records.sort(function (left, right) { return asciiCompare(left.protocolId, right.protocolId); });
    records.forEach(function (record, index) {
      if (index && records[index - 1].protocolId === record.protocolId) {
        throw new RangeError("Protocol authority must not repeat " + record.protocolId);
      }
    });
    return records;
  }

  function normalizeProtocolLoadout(value, slotCap, authorityByProtocol) {
    if (!Array.isArray(value)) throw new TypeError("Protocol loadout must be an array");
    if (value.length > slotCap) throw new RangeError("Protocol loadout exceeds its Protocol slot cap");
    const entries = value.map(function (entry, index) {
      exactFields(entry, ["slot", "protocolId", "tier"], "Protocol loadout entry " + index);
      return {
        slot: boundedInteger(entry.slot, 0, MAX_PROTOCOL_SLOT_CAP - 1, "Protocol slot"),
        protocolId: stableId(entry.protocolId, "Protocol loadout protocolId"),
        tier: boundedInteger(entry.tier, 1, MAX_TIER, "Protocol tier"),
      };
    });
    entries.sort(function (left, right) { return left.slot - right.slot; });
    const ids = new Set();
    entries.forEach(function (entry, index) {
      if (entry.slot >= slotCap) throw new RangeError("Protocol loadout entry exceeds its Protocol slot cap");
      if (index && entries[index - 1].slot === entry.slot) {
        throw new RangeError("Protocol slots must be unique");
      }
      if (ids.has(entry.protocolId)) throw new RangeError("Protocol loadout must not repeat " + entry.protocolId);
      ids.add(entry.protocolId);
      const available = authorityByProtocol.get(entry.protocolId);
      if (available === undefined) {
        throw new RangeError("Equipped Protocol requires permanent authority: " + entry.protocolId);
      }
      if (entry.tier > available) {
        throw new RangeError("Equipped Protocol tier exceeds its available tier: " + entry.protocolId);
      }
    });
    return entries;
  }

  /* Tutorial loans are exactly Tier 1 (ruling R6) and only appear on the mission
     that authors them. A loan for an already-equipped Protocol is dropped: the
     player owns it, and replay-v2 forbids a duplicate. */
  function normalizeMissionLoan(mission, equippedIds) {
    const loan = mission.protocolLoan;
    if (loan === undefined || loan === null) return null;
    exactFields(loan, ["protocolId", "tier"], "Mission Protocol loan");
    const protocolId = stableId(loan.protocolId, "Mission Protocol loan protocolId");
    if (loan.tier !== LOAN_TIER) throw new RangeError("A mission Protocol loan is always Tier 1");
    if (equippedIds.has(protocolId)) return null;
    return { protocolId: protocolId, tier: LOAN_TIER };
  }

  function accessGrantIdsFor(loadoutIds, mappings) {
    if (!Array.isArray(mappings)) throw new TypeError("Defense access-grant mappings must be an array");
    const byDefense = new Map();
    mappings.forEach(function (record, index) {
      if (!isPlainObject(record)) throw new TypeError("Access-grant mapping " + index + " must be a plain object");
      const defenseId = stableId(record.defenseId, "Access-grant mapping defenseId");
      const accessGrantId = stableId(record.accessGrantId, "Access-grant mapping accessGrantId");
      byDefense.set(defenseId, accessGrantId);
    });
    return sortedUniqueIds(loadoutIds.map(function (defenseId) {
      const grantId = byDefense.get(defenseId);
      if (!grantId) throw new RangeError("Defense lacks an access-grant mapping: " + defenseId);
      return grantId;
    }), "Access grant IDs");
  }

  function normalizeLoadoutIds(value, slotCap, snapshot, mission) {
    if (!Array.isArray(value) || value.length === 0) {
      throw new RangeError("A run loadout must contain at least one defense");
    }
    if (value.length > slotCap) throw new RangeError("Run loadout exceeds the profile defense slot cap");
    const granted = new Set(snapshot.defenseGrantIds);
    const available = Array.isArray(mission.availableDefenseIds) ? new Set(mission.availableDefenseIds) : null;
    const seen = new Set();
    return value.map(function (entry, index) {
      const id = stableId(entry, "Run loadout entry " + index);
      if (seen.has(id)) throw new RangeError("Run loadout must not repeat " + id);
      seen.add(id);
      if (!granted.has(id)) throw new RangeError("Run loadout contains a defense the profile has not unlocked: " + id);
      if (available && !available.has(id)) {
        throw new RangeError("Run loadout contains a defense this mission does not offer: " + id);
      }
      return id;
    });
  }

  function createRunHeaderV2(callerInput) {
    exactFields(callerInput, INPUT_FIELDS, "Run header input");
    const snapshot = callerInput.snapshot;
    if (!isPlainObject(snapshot)) throw new TypeError("Run header requires a resolved run snapshot");
    FORBIDDEN_HEADER_FIELDS.forEach(function (key) {
      if (Object.prototype.hasOwnProperty.call(snapshot, key)) {
        throw new TypeError("Run snapshot must not expose " + key + " to a run header");
      }
    });
    const mission = callerInput.mission;
    if (!isPlainObject(mission)) throw new TypeError("Run header requires a compiled mission record");

    const rulesetHash = callerInput.rulesetHash;
    if (typeof rulesetHash !== "string" || !RULESET_HASH.test(rulesetHash)) {
      throw new TypeError("Run header ruleset hash must be lowercase sha256:<64-hex>");
    }
    const missionId = stableId(mission.id, "Mission ID");
    const difficultyId = stableId(callerInput.difficultyId, "Difficulty ID");
    if (DIFFICULTY_IDS.indexOf(difficultyId) === -1) {
      throw new RangeError("Difficulty must be story, strategos, or titan");
    }
    if (typeof callerInput.assist !== "boolean") throw new TypeError("Assist must be a boolean");
    const seed = boundedInteger(callerInput.seed, 0, MAX_UINT32, "Run seed");

    const loadoutSlotCap = boundedInteger(snapshot.defenseSlotCap, 1, 6, "Defense slot cap");
    const loadoutIds = normalizeLoadoutIds(callerInput.loadoutIds, loadoutSlotCap, snapshot, mission);
    const accessGrantIds = accessGrantIdsFor(loadoutIds, callerInput.accessGrantMappings);

    const gateModeSource = isPlainObject(mission.tutorial) && mission.tutorial.upgradeGateMode !== undefined
      ? mission.tutorial.upgradeGateMode
      : "none";
    const tutorialUpgradeGateMode = stableId(gateModeSource, "Tutorial Upgrade gate mode");
    if (GATE_MODES.indexOf(tutorialUpgradeGateMode) === -1) {
      throw new RangeError("Unsupported Tutorial Upgrade gate mode " + tutorialUpgradeGateMode);
    }

    const protocolSlotCap = boundedInteger(
      snapshot.protocolSlotCap, 0, MAX_PROTOCOL_SLOT_CAP, "Protocol slot cap"
    );
    const protocolAuthority = normalizeAuthority(callerInput.protocolAuthority);
    const authorityByProtocol = new Map(protocolAuthority.map(function (record) {
      return [record.protocolId, record.availableTier];
    }));
    const protocolLoadout = normalizeProtocolLoadout(
      snapshot.protocolLoadout, protocolSlotCap, authorityByProtocol
    );
    const equippedIds = new Set(protocolLoadout.map(function (entry) { return entry.protocolId; }));
    const missionProtocolLoan = normalizeMissionLoan(mission, equippedIds);

    const relicSlotCap = boundedInteger(snapshot.relicSlotCap, 0, MAX_RELIC_SLOT_CAP, "Relic slot cap");
    const relicIds = sortedUniqueIds(snapshot.relicIds, "Relic IDs");
    if (relicIds.length > relicSlotCap) throw new RangeError("Relic IDs exceed the Relic slot cap");
    const reinforcementId = snapshot.reinforcementId === null || snapshot.reinforcementId === undefined
      ? null
      : stableId(snapshot.reinforcementId, "Reinforcement ID");

    return deepFreeze({
      formatVersion: FORMAT_VERSION,
      rulesetHash: rulesetHash,
      eventSchemaVersion: EVENT_SCHEMA_VERSION,
      missionId: missionId,
      difficultyId: difficultyId,
      assist: callerInput.assist,
      seed: seed,
      loadoutIds: loadoutIds,
      loadoutSlotCap: loadoutSlotCap,
      campaignModifierIds: sortedUniqueIds(snapshot.campaignModifierIds, "Campaign modifier IDs"),
      accessGrantIds: accessGrantIds,
      tutorialUpgradeGateMode: tutorialUpgradeGateMode,
      protocolLoadout: protocolLoadout,
      protocolSlotCap: protocolSlotCap,
      protocolAuthority: protocolAuthority,
      missionProtocolLoan: missionProtocolLoan,
      relicIds: relicIds,
      relicSlotCap: relicSlotCap,
      reinforcementId: reinforcementId,
      specializationAccessIds: sortedUniqueIds(
        snapshot.specializationAccessIds, "Specialization access IDs"
      ),
    });
  }

  return deepFreeze({
    FORMAT_VERSION: FORMAT_VERSION,
    EVENT_SCHEMA_VERSION: EVENT_SCHEMA_VERSION,
    LOAN_TIER: LOAN_TIER,
    HEADER_FIELDS: HEADER_FIELDS,
    INPUT_FIELDS: INPUT_FIELDS,
    FORBIDDEN_HEADER_FIELDS: FORBIDDEN_HEADER_FIELDS,
    DIFFICULTY_IDS: DIFFICULTY_IDS,
    createRunHeaderV2: createRunHeaderV2,
    deriveProtocolAuthority: deriveProtocolAuthority,
  });
});
