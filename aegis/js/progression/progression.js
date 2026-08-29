/* Armara Aegis pure campaign progression planner v2.
   Every exported operation validates first and returns a detached immutable result. */
(function (root, factory) {
  "use strict";

  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(require("./profile-v2.js"));
    return;
  }

  const game = root.Game;
  if (!game || !game.AegisProfileV2) {
    throw new Error("Game.AegisProfileV2 must be installed before progression.js");
  }
  const api = factory(game.AegisProfileV2);
  if (Object.prototype.hasOwnProperty.call(game, "AegisProgression")) {
    if (game.AegisProgression !== api) throw new Error("Game.AegisProgression is already installed");
    return;
  }
  Object.defineProperty(game, "AegisProgression", {
    value: api,
    writable: false,
    configurable: false,
    enumerable: true,
  });
})(typeof globalThis !== "undefined" ? globalThis : this, function (Profile) {
  "use strict";

  if (!Profile || !Object.isFrozen(Profile) || Profile.PROFILE_SCHEMA_VERSION !== 2) {
    throw new TypeError("A frozen Aegis profile-v2 contract is required");
  }

  const GRANT_BUNDLE_FIELDS = Object.freeze([
    "missionId", "loanProtocolIds", "firstVictoryGrantIds",
  ]);
  const GRANT_RECORD_FIELDS = Object.freeze(["id", "kind", "targetId", "integerValue"]);
  const VICTORY_FIELDS = Object.freeze([
    "missionId", "difficultyId", "completedObjectiveIds", "defenseEvidence", "runAuthorization",
  ]);
  const EVIDENCE_FIELDS = Object.freeze([
    "defenseId", "highestLevel", "specializationIds",
  ]);
  /* The immutable run header facts that authorize a victory's evidence. They are derived
     from the authenticated replay-v2 start header, never from the mutable profile. */
  const RUN_AUTHORIZATION_FIELDS = Object.freeze([
    "formatVersion", "rulesetHash", "profileContentIdentity", "missionId", "difficultyId",
    "loadoutIds", "specializationAccessIds",
  ]);
  const RUN_AUTHORIZATION_FORMAT_VERSION = 2;
  const RULESET_HASH = /^sha256:[0-9a-f]{64}$/;
  const STABLE_ID = /^[a-z0-9][a-z0-9._:-]*$/;
  const MAXIMUM_DEFENSE_SLOT_CAP = 6;
  const PROTOCOL_LOADOUT_FIELDS = Object.freeze(["slot", "protocolId", "tier"]);
  const PROTOCOL_TIER_COSTS = deepFreeze([
    { tier: 1, incrementalLaurels: 0, cumulativeLaurels: 0 },
    { tier: 2, incrementalLaurels: 6, cumulativeLaurels: 6 },
    { tier: 3, incrementalLaurels: 12, cumulativeLaurels: 18 },
  ]);
  const PROTOCOL_TIER_INCREMENT_COSTS = Object.freeze({ 2: 6, 3: 12 });
  const STRICT_DATA_LIMITS = Object.freeze({
    maxDepth: 32,
    maxArrayLength: 512,
    maxObjectFields: 64,
    maxNodes: 4096,
    maxStringLength: 256,
  });
  const MISSION_ID_SET = new Set(Profile.MISSION_IDS);
  const DIFFICULTY_ID_SET = new Set(Profile.DIFFICULTY_IDS);
  const OBJECTIVE_ID_SET = new Set(Profile.OBJECTIVE_IDS);
  const DEFENSE_ID_SET = new Set(Profile.DEFENSE_IDS);
  const PROTOCOL_ID_SET = new Set(Profile.PROTOCOL_IDS);
  const RELIC_ID_SET = new Set(Profile.RELIC_IDS);
  const REINFORCEMENT_ID_SET = new Set(Profile.REINFORCEMENT_IDS);
  const SPECIALIZATION_ID_SET = new Set(Profile.SPECIALIZATION_IDS);

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

  function strictDataCopy(value, label) {
    const seen = new Set();
    let nodeCount = 0;

    function copy(current, depth, path) {
      nodeCount += 1;
      if (nodeCount > STRICT_DATA_LIMITS.maxNodes) {
        throw new RangeError(label + " exceeds the strict-data node limit");
      }
      if (current === null || typeof current === "boolean") return current;
      if (typeof current === "number") {
        if (!Number.isSafeInteger(current) || Object.is(current, -0)) {
          throw new TypeError(path + " must contain only safe non-negative-zero integer data");
        }
        return current;
      }
      if (typeof current === "string") {
        if (current.length > STRICT_DATA_LIMITS.maxStringLength) {
          throw new RangeError(path + " exceeds the strict-data string limit");
        }
        return current;
      }
      if (!current || typeof current !== "object") {
        throw new TypeError(path + " contains an unsupported strict-data value");
      }
      if (depth > STRICT_DATA_LIMITS.maxDepth) {
        throw new RangeError(label + " exceeds the strict-data depth limit");
      }
      if (seen.has(current)) {
        throw new TypeError(label + " cannot contain cycles or shared references");
      }
      seen.add(current);

      if (Array.isArray(current)) {
        if (Object.getPrototypeOf(current) !== Array.prototype) {
          throw new TypeError(path + " must be an ordinary array");
        }
        if (Object.getOwnPropertySymbols(current).length !== 0) {
          throw new TypeError(path + " cannot contain symbol properties");
        }
        const lengthDescriptor = Object.getOwnPropertyDescriptor(current, "length");
        const length = lengthDescriptor && lengthDescriptor.value;
        if (!Number.isSafeInteger(length) || length < 0) {
          throw new TypeError(path + " must have an ordinary array length");
        }
        if (length > STRICT_DATA_LIMITS.maxArrayLength) {
          throw new RangeError(path + " exceeds the strict-data array length limit");
        }
        const names = Object.getOwnPropertyNames(current);
        names.forEach(function (name) {
          if (name === "length") return;
          if (!/^(0|[1-9][0-9]*)$/.test(name) || Number(name) >= length) {
            throw new TypeError(path + " cannot contain extra array properties");
          }
        });
        const output = new Array(length);
        for (let index = 0; index < length; index += 1) {
          const descriptor = Object.getOwnPropertyDescriptor(current, String(index));
          if (!descriptor) throw new TypeError(path + " must be a dense array");
          if (!descriptor.enumerable || descriptor.get || descriptor.set ||
              !Object.prototype.hasOwnProperty.call(descriptor, "value")) {
            throw new TypeError(path + " must contain only enumerable data elements");
          }
          output[index] = copy(descriptor.value, depth + 1, path + "[" + index + "]");
        }
        return output;
      }

      const prototype = Object.getPrototypeOf(current);
      if (prototype !== Object.prototype && prototype !== null) {
        throw new TypeError(path + " must be a plain object");
      }
      if (Object.getOwnPropertySymbols(current).length !== 0) {
        throw new TypeError(path + " cannot contain symbol properties");
      }
      const names = Object.getOwnPropertyNames(current);
      if (names.length > STRICT_DATA_LIMITS.maxObjectFields) {
        throw new RangeError(path + " exceeds the strict-data object field limit");
      }
      const descriptors = names.map(function (name) {
        const descriptor = Object.getOwnPropertyDescriptor(current, name);
        if (!descriptor || !descriptor.enumerable || descriptor.get || descriptor.set ||
            !Object.prototype.hasOwnProperty.call(descriptor, "value")) {
          throw new TypeError(path + " must contain only enumerable data properties");
        }
        return { name: name, value: descriptor.value };
      });
      const output = Object.create(null);
      descriptors.forEach(function (descriptor) {
        Object.defineProperty(output, descriptor.name, {
          value: copy(descriptor.value, depth + 1, path + "." + descriptor.name),
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

  function requireArray(value, label) {
    if (!Array.isArray(value)) throw new TypeError(label + " must be an array");
    return value;
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

  function knownId(value, set, label) {
    if (typeof value !== "string" || !set.has(value)) {
      throw new RangeError("Unknown " + label + " (received " + typeof value + ")");
    }
    return value;
  }

  function sortedUniqueKnownIds(value, set, label) {
    requireArray(value, label);
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

  function grant(id, kind, targetId, integerValue) {
    const record = { id: id, kind: kind, targetId: targetId, integerValue: integerValue };
    exactFields(record, GRANT_RECORD_FIELDS, id + " grant record");
    return record;
  }

  const GRANT_RECORDS = deepFreeze(([
    grant("grant.blueprint-reset", "unlock-campaign-action", "blueprint-reset", 0),
    grant("grant.campaign.reserve-1", "unlock-campaign-modifier", "reserve-1", 10),
    grant("grant.campaign.reserve-2", "unlock-campaign-modifier", "reserve-2", 10),
    grant("grant.defense-slots.5", "set-defense-slot-cap", null, 5),
    grant("grant.defense-slots.6", "set-defense-slot-cap", null, 6),
    grant("grant.mode.endless-ascension", "unlock-mode", "endless-ascension", 0),
    grant("grant.protocol-slots.1", "set-protocol-slot-cap", null, 1),
    grant("grant.protocol-slots.2", "set-protocol-slot-cap", null, 2),
    grant("grant.recon.1", "set-recon-tier", null, 1),
    grant("grant.recon.2", "set-recon-tier", null, 2),
    grant("grant.recon.3", "set-recon-tier", null, 3),
    grant("grant.reinforcement-slots.1", "set-reinforcement-slot-cap", null, 1),
    grant("grant.relic-slots.1", "set-relic-slot-cap", null, 1),
    grant("grant.relic-slots.2", "set-relic-slot-cap", null, 2),
  ]).concat(Profile.DEFENSE_IDS.filter(function (id) {
    return Profile.STARTER_DEFENSE_IDS.indexOf(id) === -1;
  }).map(function (id) {
    return grant("grant.defense." + id, "unlock-defense", id, 0);
  })).concat(Profile.PROTOCOL_IDS.map(function (id) {
    return grant("grant.protocol." + id, "unlock-protocol", id, 1);
  })).concat(Profile.RELIC_IDS.map(function (id) {
    return grant("grant.relic." + id, "unlock-relic", id, 0);
  })).concat(Profile.REINFORCEMENT_IDS.map(function (id) {
    return grant("grant.reinforcement." + id, "unlock-reinforcement", id, 0);
  })).concat(Profile.SPECIALIZATION_IDS.map(function (id) {
    return grant("grant.specialization." + id, "unlock-specialization", id, 0);
  })).sort(function (left, right) {
    return asciiCompare(left.id, right.id);
  }));
  const GRANT_BY_ID = new Map(GRANT_RECORDS.map(function (record) { return [record.id, record]; }));
  const GRANT_ID_SET = new Set(GRANT_RECORDS.map(function (record) { return record.id; }));

  const LOAN_PROTOCOL_IDS_BY_MISSION = Object.freeze({
    m05: Object.freeze(["temporal-edict"]),
    m08: Object.freeze(["zeus-skyfire"]),
    m10: Object.freeze(["aegis-ward"]),
    m11: Object.freeze(["poseidon-surge"]),
    m13: Object.freeze(["athena-command"]),
    m15: Object.freeze(["hephaestus-overclock"]),
    m16: Object.freeze(["hermes-rewind"]),
    m17: Object.freeze(["medusa-lock"]),
    m18: Object.freeze(["hades-bargain"]),
    m20: Object.freeze(["armara-ascension"]),
  });
  const MISSION_GRANT_BUNDLES = deepFreeze(Profile.MISSION_IDS.map(function (missionId) {
    const record = {
      missionId: missionId,
      loanProtocolIds: (LOAN_PROTOCOL_IDS_BY_MISSION[missionId] || []).slice(),
      firstVictoryGrantIds: Profile.FIRST_VICTORY_GRANTS_BY_MISSION[missionId].slice(),
    };
    exactFields(record, GRANT_BUNDLE_FIELDS, missionId + " first-clear grant bundle");
    return record;
  }));
  const BUNDLE_BY_MISSION = new Map(MISSION_GRANT_BUNDLES.map(function (record) {
    return [record.missionId, record];
  }));

  function getMissionFirstClearGrantBundle(missionId) {
    knownId(missionId, MISSION_ID_SET, "mission ID");
    return BUNDLE_BY_MISSION.get(missionId);
  }

  function setCatalogGrant(records, id) {
    const record = records.find(function (candidate) { return candidate.id === id; });
    if (!record) throw new RangeError("Grant catalog is missing ID: " + id);
    const changed = !record.granted;
    record.granted = true;
    return changed;
  }

  function grantProtocol(records, id) {
    const record = records.find(function (candidate) { return candidate.id === id; });
    if (!record) throw new RangeError("Protocol catalog is missing ID: " + id);
    const changed = !record.granted;
    if (!record.granted) {
      record.granted = true;
      record.availableTier = 1;
      record.allocatedLaurels = 0;
    }
    return changed;
  }

  function addSortedUnique(records, id) {
    if (records.indexOf(id) !== -1) return false;
    records.push(id);
    records.sort(asciiCompare);
    return true;
  }

  function applyGrantMutable(profile, grantId) {
    knownId(grantId, GRANT_ID_SET, "grant ID");
    const record = GRANT_BY_ID.get(grantId);
    const newlyApplied = addSortedUnique(profile.appliedGrantIds, grantId);
    switch (record.kind) {
      case "unlock-campaign-action":
        addSortedUnique(profile.campaignActionIds, record.targetId);
        break;
      case "unlock-campaign-modifier":
        addSortedUnique(profile.campaignModifierIds, record.targetId);
        break;
      case "set-defense-slot-cap":
        profile.defenseSlotCap = Math.max(profile.defenseSlotCap, record.integerValue);
        break;
      case "unlock-defense":
        addSortedUnique(profile.defenseGrantIds, record.targetId);
        break;
      case "unlock-mode":
        addSortedUnique(profile.modeIds, record.targetId);
        break;
      case "set-protocol-slot-cap":
        profile.protocolSlotCap = Math.max(profile.protocolSlotCap, record.integerValue);
        break;
      case "unlock-protocol":
        grantProtocol(profile.protocols, record.targetId);
        break;
      case "set-recon-tier":
        profile.reconTier = Math.max(profile.reconTier, record.integerValue);
        break;
      case "set-reinforcement-slot-cap":
        profile.reinforcementSlotCap = Math.max(profile.reinforcementSlotCap, record.integerValue);
        break;
      case "unlock-reinforcement":
        setCatalogGrant(profile.reinforcements, record.targetId);
        break;
      case "set-relic-slot-cap":
        profile.relicSlotCap = Math.max(profile.relicSlotCap, record.integerValue);
        break;
      case "unlock-relic":
        setCatalogGrant(profile.relics, record.targetId);
        break;
      case "unlock-specialization":
        addSortedUnique(profile.specializationAccessIds, record.targetId);
        break;
      default:
        throw new RangeError("Unsupported progression grant kind: " + record.kind);
    }
    return newlyApplied;
  }

  function applyBundleMutable(profile, bundleRecord) {
    const firstClear = profile.completedMissionIds.indexOf(bundleRecord.missionId) === -1;
    addSortedUnique(profile.completedMissionIds, bundleRecord.missionId);
    const grantIdsApplied = [];
    bundleRecord.firstVictoryGrantIds.forEach(function (grantId) {
      if (applyGrantMutable(profile, grantId)) grantIdsApplied.push(grantId);
    });
    return { firstClear: firstClear, grantIdsApplied: grantIdsApplied };
  }

  /* Linear campaign: m01 has no prerequisite; mNN requires m(N-1) completed before it can
     be claimed for the first time. Reapplying an already completed mission is idempotent. */
  function requireMissionPrerequisite(profile, missionId) {
    if (profile.completedMissionIds.indexOf(missionId) !== -1) return;
    const prerequisiteId = Profile.getMissionPrerequisiteId(missionId);
    if (prerequisiteId !== null && profile.completedMissionIds.indexOf(prerequisiteId) === -1) {
      throw new RangeError(missionId + " requires the prerequisite mission " + prerequisiteId + " to be completed");
    }
  }

  function planApplyMissionFirstClear(value, missionId) {
    const reconciliation = Profile.reconcileProfileV2(value);
    const before = reconciliation.profile;
    const grantBundle = getMissionFirstClearGrantBundle(missionId);
    requireMissionPrerequisite(before, missionId);
    const profile = strictDataCopy(before, "Reconciled profile v2");
    const applied = applyBundleMutable(profile, grantBundle);
    const nextProfile = Profile.validateProfileV2(profile);
    return deepFreeze({
      changed: reconciliation.changed || JSON.stringify(before) !== JSON.stringify(nextProfile),
      firstClear: applied.firstClear,
      grantBundle: grantBundle,
      grantIdsApplied: applied.grantIdsApplied,
      repairs: reconciliation.repairs,
      profile: nextProfile,
    });
  }

  function stableId(value, label) {
    if (typeof value !== "string" || !STABLE_ID.test(value)) {
      throw new TypeError(label + " must be a stable lowercase ID");
    }
    return value;
  }

  function normalizeRunAuthorization(value) {
    exactFields(value, RUN_AUTHORIZATION_FIELDS, "Run authorization");
    if (value.formatVersion !== RUN_AUTHORIZATION_FORMAT_VERSION) {
      throw new RangeError("Run authorization format version must be 2");
    }
    if (typeof value.rulesetHash !== "string" || !RULESET_HASH.test(value.rulesetHash)) {
      throw new TypeError("Run authorization ruleset hash must be lowercase sha256:<64-hex>");
    }
    const profileContentIdentity = stableId(
      value.profileContentIdentity,
      "run authorization profile content identity"
    );
    const missionId = knownId(value.missionId, MISSION_ID_SET, "run authorization mission ID");
    const difficultyId = knownId(value.difficultyId, DIFFICULTY_ID_SET, "run authorization difficulty ID");
    const loadoutIds = sortedUniqueKnownIds(value.loadoutIds, DEFENSE_ID_SET, "run authorization loadout IDs");
    if (loadoutIds.length === 0) throw new RangeError("Run authorization loadout IDs must not be empty");
    if (loadoutIds.length > MAXIMUM_DEFENSE_SLOT_CAP) {
      throw new RangeError("Run authorization loadout IDs exceed the maximum defense slot cap");
    }
    const specializationAccessIds = sortedUniqueKnownIds(
      value.specializationAccessIds,
      SPECIALIZATION_ID_SET,
      "run authorization specialization access IDs"
    );
    return {
      formatVersion: RUN_AUTHORIZATION_FORMAT_VERSION,
      rulesetHash: value.rulesetHash,
      profileContentIdentity: profileContentIdentity,
      missionId: missionId,
      difficultyId: difficultyId,
      loadoutIds: loadoutIds,
      specializationAccessIds: specializationAccessIds,
    };
  }

  function validateRunAuthorization(value) {
    return deepFreeze(normalizeRunAuthorization(strictDataCopy(value, "Run authorization")));
  }

  /* Derive the run authorization from a normalized replay-v2 start header plus the content
     identity of the profile snapshot that constructed that header. Only the named header
     fields are read; every other header field is ignored so presentation data cannot leak in.
     Header loadout IDs are kept in player slot order by the kernel; the authorization stores
     them ASCII-sorted. Trust boundary: the caller must supply a header that the replay
     validator authenticated (ruleset hash re-simulated to its terminal claim); this planner
     only proves consistency with the profile, it does not re-authenticate the header. */
  function deriveRunAuthorization(headerValue, profileContentIdentity) {
    if (!headerValue || typeof headerValue !== "object" || Array.isArray(headerValue)) {
      throw new TypeError("Replay-v2 start header must be a plain object");
    }
    const header = {};
    ["rulesetHash", "missionId", "difficultyId", "loadoutIds", "specializationAccessIds"].forEach(function (key) {
      const descriptor = Object.getOwnPropertyDescriptor(headerValue, key);
      if (!descriptor || !descriptor.enumerable || descriptor.get || descriptor.set ||
          !Object.prototype.hasOwnProperty.call(descriptor, "value")) {
        throw new TypeError("Replay-v2 start header." + key + " must be an enumerable data property");
      }
      header[key] = strictDataCopy(descriptor.value, "Replay-v2 start header." + key);
    });
    requireArray(header.loadoutIds, "Replay-v2 start header loadout IDs");
    header.loadoutIds.forEach(function (candidate, index) {
      knownId(candidate, DEFENSE_ID_SET, "Replay-v2 start header loadout ID entry " + index);
    });
    return validateRunAuthorization({
      formatVersion: RUN_AUTHORIZATION_FORMAT_VERSION,
      rulesetHash: header.rulesetHash,
      profileContentIdentity: profileContentIdentity,
      missionId: header.missionId,
      difficultyId: header.difficultyId,
      loadoutIds: header.loadoutIds.slice().sort(asciiCompare),
      specializationAccessIds: header.specializationAccessIds,
    });
  }

  function validateVictory(value) {
    value = strictDataCopy(value, "Verified victory result");
    exactFields(value, VICTORY_FIELDS, "Verified victory result");
    const missionId = knownId(value.missionId, MISSION_ID_SET, "victory mission ID");
    const difficultyId = knownId(value.difficultyId, DIFFICULTY_ID_SET, "victory difficulty ID");
    const runAuthorization = normalizeRunAuthorization(value.runAuthorization);
    if (runAuthorization.missionId !== missionId) {
      throw new RangeError("Run authorization mission ID does not match the victory mission ID");
    }
    if (runAuthorization.difficultyId !== difficultyId) {
      throw new RangeError("Run authorization difficulty ID does not match the victory difficulty ID");
    }
    const authorizedDefenseIds = new Set(runAuthorization.loadoutIds);
    const authorizedSpecializationIds = new Set(runAuthorization.specializationAccessIds);
    const completedObjectiveIds = sortedUniqueKnownIds(
      value.completedObjectiveIds,
      OBJECTIVE_ID_SET,
      "completed objective IDs"
    );
    if (completedObjectiveIds.indexOf("victory") === -1) {
      throw new RangeError("Verified victory result must include the victory objective");
    }
    requireArray(value.defenseEvidence, "defense mastery evidence");
    const defenseEvidence = [];
    let priorDefenseId = null;
    value.defenseEvidence.forEach(function (record, index) {
      exactFields(record, EVIDENCE_FIELDS, "Defense mastery evidence " + index);
      const defenseId = knownId(record.defenseId, DEFENSE_ID_SET, "defense evidence ID");
      if (priorDefenseId !== null && priorDefenseId >= defenseId) {
        throw new RangeError("Defense mastery evidence must be unique and in strict ASCII order");
      }
      if (!authorizedDefenseIds.has(defenseId)) {
        throw new RangeError(defenseId + " was not in the run authorization loadout");
      }
      const highestLevel = safeInteger(record.highestLevel, defenseId + " highest level", 1, 3);
      const specializationIds = sortedUniqueKnownIds(
        record.specializationIds,
        SPECIALIZATION_ID_SET,
        defenseId + " specialization IDs"
      );
      if (highestLevel < 3 && specializationIds.length !== 0) {
        throw new RangeError(defenseId + " specialization evidence requires Level 3");
      }
      if (highestLevel === 3 && specializationIds.length === 0) {
        throw new RangeError(defenseId + " Level-3 evidence must name a specialization");
      }
      specializationIds.forEach(function (id) {
        if (Profile.SPECIALIZATIONS_BY_DEFENSE[defenseId].indexOf(id) === -1) {
          throw new RangeError(id + " does not belong to " + defenseId);
        }
        if (!authorizedSpecializationIds.has(id)) {
          throw new RangeError(id + " was not available in the run authorization");
        }
      });
      priorDefenseId = defenseId;
      defenseEvidence.push({
        defenseId: defenseId,
        highestLevel: highestLevel,
        specializationIds: specializationIds,
      });
    });
    return deepFreeze({
      missionId: missionId,
      difficultyId: difficultyId,
      completedObjectiveIds: completedObjectiveIds,
      defenseEvidence: defenseEvidence,
      runAuthorization: runAuthorization,
    });
  }

  /* The run authorization must have been constructible from the pre-application profile:
     every granted defense/specialization the run used is monotonic, so a profile that never
     held them cannot have started that run. Grants applied by this very result are excluded. */
  function requireRunAuthorizationConsistency(before, runAuthorization) {
    if (runAuthorization.profileContentIdentity !== before.contentIdentity) {
      throw new RangeError("Run authorization profile content identity does not match the profile");
    }
    const grantedDefenseIds = new Set(before.defenseGrantIds);
    runAuthorization.loadoutIds.forEach(function (defenseId) {
      if (!grantedDefenseIds.has(defenseId)) {
        throw new RangeError(defenseId + " was not granted before the authorized run");
      }
    });
    if (runAuthorization.loadoutIds.length > before.defenseSlotCap) {
      throw new RangeError("Run authorization loadout exceeds the profile defense slot cap");
    }
    const accessIds = new Set(before.specializationAccessIds);
    runAuthorization.specializationAccessIds.forEach(function (specializationId) {
      if (!accessIds.has(specializationId)) {
        throw new RangeError(specializationId + " access was not granted before the authorized run");
      }
    });
  }

  function unionSorted(left, right) {
    return Array.from(new Set(left.concat(right))).sort(asciiCompare);
  }

  function planApplyVerifiedVictory(value, resultValue) {
    const reconciliation = Profile.reconcileProfileV2(value);
    const before = reconciliation.profile;
    const result = validateVictory(resultValue);
    requireRunAuthorizationConsistency(before, result.runAuthorization);
    requireMissionPrerequisite(before, result.missionId);
    const profile = strictDataCopy(before, "Validated profile v2");
    const grantBundle = getMissionFirstClearGrantBundle(result.missionId);
    const applied = applyBundleMutable(profile, grantBundle);
    const grantIdsApplied = applied.grantIdsApplied.slice();
    const laurelIdsAdded = [];
    result.completedObjectiveIds.forEach(function (objectiveId) {
      const laurelId = Profile.makeLaurelId(result.missionId, result.difficultyId, objectiveId);
      if (profile.earnedLaurelIds.indexOf(laurelId) === -1) {
        profile.earnedLaurelIds.push(laurelId);
        laurelIdsAdded.push(laurelId);
      }
    });
    profile.earnedLaurelIds.sort(asciiCompare);
    laurelIdsAdded.sort(asciiCompare);

    const masteryChanges = [];
    result.defenseEvidence.forEach(function (evidence) {
      const record = profile.defenseMastery.find(function (candidate) {
        return candidate.defenseId === evidence.defenseId;
      });
      const beforeRecord = strictDataCopy(record, "Validated defense mastery record");
      record.fielded = true;
      if (evidence.highestLevel >= 2) record.tempered = true;
      if (evidence.highestLevel === 3) {
        record.specializationVictoryIds = unionSorted(
          record.specializationVictoryIds,
          evidence.specializationIds
        );
      }
      const strategosOrHigher = result.difficultyId === "strategos" || result.difficultyId === "titan";
      if (strategosOrHigher) record.strategosVictory = true;
      /* Ruling R15: mastery is earned at a Strategos-or-higher victory that leaves both
         branches represented; it is monotonic and never revoked. */
      if (strategosOrHigher && record.specializationVictoryIds.length === 2) record.mastered = true;
      if (record.tempered) {
        const alternateId = Profile.SPECIALIZATIONS_BY_DEFENSE[record.defenseId][1];
        const alternateGrantId = "grant.specialization." + alternateId;
        if (applyGrantMutable(profile, alternateGrantId)) grantIdsApplied.push(alternateGrantId);
      }
      const specializationIdsAdded = record.specializationVictoryIds.filter(function (id) {
        return beforeRecord.specializationVictoryIds.indexOf(id) === -1;
      });
      const specializationAccessIdsAdded = profile.specializationAccessIds.filter(function (id) {
        return before.specializationAccessIds.indexOf(id) === -1 &&
          Profile.SPECIALIZATIONS_BY_DEFENSE[record.defenseId].indexOf(id) !== -1;
      });
      const change = {
        defenseId: record.defenseId,
        fieldedAdded: !beforeRecord.fielded && record.fielded,
        temperedAdded: !beforeRecord.tempered && record.tempered,
        masteredAdded: !beforeRecord.mastered && record.mastered,
        strategosVictoryAdded: !beforeRecord.strategosVictory && record.strategosVictory,
        specializationIdsAdded: specializationIdsAdded,
        specializationAccessIdsAdded: specializationAccessIdsAdded,
      };
      if (change.fieldedAdded || change.temperedAdded || change.masteredAdded ||
          change.strategosVictoryAdded || change.specializationIdsAdded.length > 0 ||
          change.specializationAccessIdsAdded.length > 0) {
        masteryChanges.push({
          defenseId: change.defenseId,
          fieldedAdded: change.fieldedAdded,
          temperedAdded: change.temperedAdded,
          masteredAdded: change.masteredAdded,
          strategosVictoryAdded: change.strategosVictoryAdded,
          specializationIdsAdded: change.specializationIdsAdded,
          specializationAccessIdsAdded: change.specializationAccessIdsAdded,
        });
      }
    });

    const nextProfile = Profile.validateProfileV2(profile);
    grantIdsApplied.sort(asciiCompare);
    const changed = reconciliation.changed || JSON.stringify(before) !== JSON.stringify(nextProfile);
    return deepFreeze({
      changed: changed,
      firstClear: applied.firstClear,
      grantBundle: grantBundle,
      grantIdsApplied: grantIdsApplied,
      laurelIdsAdded: laurelIdsAdded,
      masteryChanges: masteryChanges,
      repairs: reconciliation.repairs,
      profile: nextProfile,
    });
  }

  function protocolRecord(profile, protocolId) {
    knownId(protocolId, PROTOCOL_ID_SET, "Protocol ID");
    return profile.protocols.find(function (record) { return record.id === protocolId; });
  }

  function planAllocateProtocolTier(value, protocolId) {
    const before = Profile.validateProfileV2(value);
    const profile = strictDataCopy(before, "Validated profile v2");
    const record = protocolRecord(profile, protocolId);
    if (!record.granted) throw new RangeError(protocolId + " Protocol is not granted");
    if (record.availableTier >= 3) throw new RangeError(protocolId + " is already at maximum tier");
    const toTier = record.availableTier + 1;
    const allocated = PROTOCOL_TIER_INCREMENT_COSTS[toTier];
    const budget = Profile.getLaurelBudget(before);
    if (budget.available < allocated) {
      throw new RangeError("Insufficient available Laurels for " + protocolId + " Tier " + toTier);
    }
    const fromTier = record.availableTier;
    record.availableTier = toTier;
    record.allocatedLaurels += allocated;
    return deepFreeze({
      changed: true,
      protocolId: protocolId,
      fromTier: fromTier,
      toTier: toTier,
      allocated: allocated,
      profile: Profile.validateProfileV2(profile),
    });
  }

  function planRefundProtocolTier(value, protocolId) {
    const before = Profile.validateProfileV2(value);
    const profile = strictDataCopy(before, "Validated profile v2");
    const record = protocolRecord(profile, protocolId);
    if (!record.granted) throw new RangeError(protocolId + " Protocol is not granted");
    if (record.availableTier <= 1) throw new RangeError("Tier 1 is free and cannot be refunded");
    const fromTier = record.availableTier;
    const refunded = PROTOCOL_TIER_INCREMENT_COSTS[fromTier];
    const toTier = fromTier - 1;
    record.availableTier = toTier;
    record.allocatedLaurels -= refunded;
    const loadoutRepairs = [];
    profile.protocolLoadout.forEach(function (entry) {
      if (entry.protocolId === protocolId && entry.tier > toTier) {
        loadoutRepairs.push({
          kind: "lowered-protocol-tier",
          protocolId: protocolId,
          slot: entry.slot,
          fromTier: entry.tier,
          toTier: toTier,
        });
        entry.tier = toTier;
      }
    });
    return deepFreeze({
      changed: true,
      protocolId: protocolId,
      fromTier: fromTier,
      toTier: toTier,
      refunded: refunded,
      loadoutRepairs: loadoutRepairs,
      profile: Profile.validateProfileV2(profile),
    });
  }

  function planSetProtocolLoadout(value, loadoutValue) {
    const before = Profile.validateProfileV2(value);
    loadoutValue = strictDataCopy(loadoutValue, "Protocol loadout");
    requireArray(loadoutValue, "Protocol loadout");
    const loadout = loadoutValue.map(function (record, index) {
      exactFields(record, PROTOCOL_LOADOUT_FIELDS, "Protocol loadout record " + index);
      return { slot: record.slot, protocolId: record.protocolId, tier: record.tier };
    });
    const profile = strictDataCopy(before, "Validated profile v2");
    profile.protocolLoadout = loadout;
    const nextProfile = Profile.validateProfileV2(profile);
    return deepFreeze({
      changed: JSON.stringify(before.protocolLoadout) !== JSON.stringify(nextProfile.protocolLoadout),
      profile: nextProfile,
    });
  }

  function planSetRelicLoadout(value, relicIdsValue) {
    const before = Profile.validateProfileV2(value);
    relicIdsValue = strictDataCopy(relicIdsValue, "Relic loadout");
    requireArray(relicIdsValue, "Relic loadout");
    const seen = new Set();
    const relicIds = relicIdsValue.map(function (candidate) {
      const id = knownId(candidate, RELIC_ID_SET, "Relic ID");
      if (seen.has(id)) throw new RangeError("Relic loadout contains duplicate ID: " + id);
      seen.add(id);
      return id;
    }).sort(asciiCompare);
    const profile = strictDataCopy(before, "Validated profile v2");
    profile.relicLoadoutIds = relicIds;
    const nextProfile = Profile.validateProfileV2(profile);
    return deepFreeze({
      changed: JSON.stringify(before.relicLoadoutIds) !== JSON.stringify(nextProfile.relicLoadoutIds),
      profile: nextProfile,
    });
  }

  function planSetReinforcementLoadout(value, reinforcementIdValue) {
    const before = Profile.validateProfileV2(value);
    if (reinforcementIdValue !== null) {
      knownId(reinforcementIdValue, REINFORCEMENT_ID_SET, "reinforcement ID");
    }
    const profile = strictDataCopy(before, "Validated profile v2");
    profile.reinforcementId = reinforcementIdValue;
    const nextProfile = Profile.validateProfileV2(profile);
    return deepFreeze({
      changed: before.reinforcementId !== nextProfile.reinforcementId,
      profile: nextProfile,
    });
  }

  return deepFreeze({
    PROTOCOL_TIER_COSTS: PROTOCOL_TIER_COSTS,
    PROTOCOL_TIER_INCREMENT_COSTS: PROTOCOL_TIER_INCREMENT_COSTS,
    GRANT_RECORDS: GRANT_RECORDS,
    MISSION_GRANT_BUNDLES: MISSION_GRANT_BUNDLES,
    RUN_AUTHORIZATION_FORMAT_VERSION: RUN_AUTHORIZATION_FORMAT_VERSION,
    getMissionFirstClearGrantBundle: getMissionFirstClearGrantBundle,
    validateRunAuthorization: validateRunAuthorization,
    deriveRunAuthorization: deriveRunAuthorization,
    planApplyMissionFirstClear: planApplyMissionFirstClear,
    planApplyVerifiedVictory: planApplyVerifiedVictory,
    planAllocateProtocolTier: planAllocateProtocolTier,
    planRefundProtocolTier: planRefundProtocolTier,
    planSetProtocolLoadout: planSetProtocolLoadout,
    planSetRelicLoadout: planSetRelicLoadout,
    planSetReinforcementLoadout: planSetReinforcementLoadout,
  });
});
