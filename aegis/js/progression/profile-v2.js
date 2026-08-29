/* Armara Aegis pure local profile contract v2.
   Storage, presentation, simulation, and wall-clock state are deliberately absent. */
(function (root, factory) {
  "use strict";

  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory();
    return;
  }

  const game = root.Game;
  if (!game) throw new Error("Game must exist before profile-v2.js");
  const api = factory();
  if (Object.prototype.hasOwnProperty.call(game, "AegisProfileV2")) {
    if (game.AegisProfileV2 !== api) throw new Error("Game.AegisProfileV2 is already installed");
    return;
  }
  Object.defineProperty(game, "AegisProfileV2", {
    value: api,
    writable: false,
    configurable: false,
    enumerable: true,
  });
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const PROFILE_SCHEMA_VERSION = 2;
  const PROFILE_FIELDS = Object.freeze([
    "schemaVersion",
    "contentIdentity",
    "completedMissionIds",
    "earnedLaurelIds",
    "appliedGrantIds",
    "defenseGrantIds",
    "defenseSlotCap",
    "campaignModifierIds",
    "campaignActionIds",
    "modeIds",
    "protocols",
    "protocolLoadout",
    "protocolSlotCap",
    "relics",
    "relicLoadoutIds",
    "relicSlotCap",
    "reinforcements",
    "reinforcementId",
    "reinforcementSlotCap",
    "specializationAccessIds",
    "defenseMastery",
    "reconTier",
  ]);
  const PROTOCOL_FIELDS = Object.freeze([
    "id", "granted", "availableTier", "allocatedLaurels",
  ]);
  const PROTOCOL_LOADOUT_FIELDS = Object.freeze(["slot", "protocolId", "tier"]);
  const GRANT_FIELDS = Object.freeze(["id", "granted"]);
  const MASTERY_FIELDS = Object.freeze([
    "defenseId",
    "fielded",
    "tempered",
    "mastered",
    "strategosVictory",
    "specializationVictoryIds",
  ]);
  const STABLE_ID = /^[a-z0-9][a-z0-9._:-]*$/;
  const STRICT_DATA_LIMITS = Object.freeze({
    maxDepth: 32,
    maxArrayLength: 512,
    maxObjectFields: 64,
    maxNodes: 4096,
    maxStringLength: 256,
  });

  const MISSION_IDS = Object.freeze(Array.from({ length: 20 }, function (_, index) {
    return "m" + String(index + 1).padStart(2, "0");
  }));
  const DIFFICULTY_IDS = Object.freeze(["story", "strategos", "titan"]);
  const OBJECTIVE_IDS = Object.freeze(["integrity", "mastery", "victory"]);
  const PROTOCOL_IDS = Object.freeze([
    "aegis-ward",
    "armara-ascension",
    "athena-command",
    "hades-bargain",
    "hephaestus-overclock",
    "hermes-rewind",
    "medusa-lock",
    "poseidon-surge",
    "temporal-edict",
    "zeus-skyfire",
  ]);
  const RELIC_IDS = Object.freeze([
    "broken-aegis",
    "bronze-obol",
    "forge-ember",
    "hermes-greaves",
    "laurel-of-ares",
    "owl-lens",
    "tideglass",
    "titan-gear",
  ]);
  const REINFORCEMENT_IDS = Object.freeze([
    "artemis-scout", "spartan-phalanx", "talos-automaton",
  ]);
  const DEFENSE_IDS = Object.freeze([
    "apollo",
    "artemis",
    "athena",
    "chronos",
    "hades",
    "hephaestus",
    "hermes",
    "hoplite",
    "medusa",
    "oracle",
    "poseidon",
    "sentinel",
    "siege",
    "talos",
    "zeus",
  ]);
  const SPECIALIZATIONS_BY_DEFENSE = Object.freeze({
    apollo: Object.freeze(["apollo-forked-ray", "apollo-solar-lance"]),
    artemis: Object.freeze(["artemis-execution-line", "artemis-threader"]),
    athena: Object.freeze(["athena-coordinated-fire", "athena-command-mesh"]),
    chronos: Object.freeze(["chronos-echo-field", "chronos-time-debt"]),
    hades: Object.freeze(["hades-twin-banish", "hades-soul-tithe"]),
    hephaestus: Object.freeze(["hephaestus-molten-field", "hephaestus-triple-foundry"]),
    hermes: Object.freeze(["hermes-wing-command", "hermes-sky-swarm"]),
    hoplite: Object.freeze(["hoplite-phalanx", "hoplite-spearwall"]),
    medusa: Object.freeze(["medusa-gorgon-bloom", "medusa-basilisk-focus"]),
    oracle: Object.freeze(["oracle-chorus", "oracle-judgment"]),
    poseidon: Object.freeze(["poseidon-maelstrom", "poseidon-undertow"]),
    sentinel: Object.freeze(["sentinel-lock-on", "sentinel-twin-lance"]),
    siege: Object.freeze(["siege-breach-core", "siege-sun-shrapnel"]),
    talos: Object.freeze(["talos-titan-hunter", "talos-earthbreaker"]),
    zeus: Object.freeze(["zeus-storm-crown", "zeus-thunderhead"]),
  });
  const DEFAULT_SPECIALIZATION_IDS = Object.freeze(DEFENSE_IDS.map(function (defenseId) {
    return SPECIALIZATIONS_BY_DEFENSE[defenseId][0];
  }).sort(asciiCompare));
  const ALTERNATE_SPECIALIZATION_IDS = Object.freeze(DEFENSE_IDS.map(function (defenseId) {
    return SPECIALIZATIONS_BY_DEFENSE[defenseId][1];
  }).sort(asciiCompare));
  const SPECIALIZATION_IDS = Object.freeze(DEFAULT_SPECIALIZATION_IDS
    .concat(ALTERNATE_SPECIALIZATION_IDS).sort(asciiCompare));
  const STARTER_DEFENSE_IDS = Object.freeze(["chronos", "sentinel", "siege"]);
  const CAMPAIGN_MODIFIER_IDS = Object.freeze(["reserve-1", "reserve-2"]);
  const CAMPAIGN_ACTION_IDS = Object.freeze(["blueprint-reset"]);
  const MODE_IDS = Object.freeze(["endless-ascension"]);
  const FIRST_VICTORY_GRANTS_BY_MISSION = deepFreeze({
    m01: ["grant.defense.hoplite"],
    m02: ["grant.defense.oracle"],
    m03: ["grant.defense.artemis"],
    m04: ["grant.campaign.reserve-1"],
    m05: ["grant.defense-slots.5", "grant.protocol-slots.1", "grant.protocol.temporal-edict"],
    m06: ["grant.defense.hermes", "grant.recon.1", "grant.relic-slots.1", "grant.relic.bronze-obol"],
    m07: ["grant.defense.poseidon", "grant.relic.owl-lens"],
    m08: ["grant.defense.medusa", "grant.protocol.zeus-skyfire"],
    m09: ["grant.blueprint-reset", "grant.reinforcement-slots.1", "grant.reinforcement.spartan-phalanx", "grant.relic.broken-aegis"],
    m10: ["grant.defense-slots.6", "grant.protocol-slots.2", "grant.protocol.aegis-ward"],
    m11: ["grant.defense.hephaestus", "grant.protocol.poseidon-surge", "grant.relic.forge-ember"],
    m12: ["grant.defense.athena"],
    m13: ["grant.defense.apollo", "grant.protocol.athena-command", "grant.relic.tideglass"],
    m14: ["grant.recon.2", "grant.reinforcement.artemis-scout"],
    m15: ["grant.campaign.reserve-2", "grant.protocol.hephaestus-overclock", "grant.relic-slots.2", "grant.relic.laurel-of-ares"],
    m16: ["grant.defense.hades", "grant.protocol.hermes-rewind"],
    m17: ["grant.defense.talos", "grant.protocol.medusa-lock", "grant.relic.hermes-greaves"],
    m18: ["grant.defense.zeus", "grant.protocol.hades-bargain", "grant.recon.3", "grant.reinforcement.talos-automaton"],
    m19: ["grant.relic.titan-gear"],
    m20: ["grant.mode.endless-ascension", "grant.protocol.armara-ascension"],
  });
  const GRANT_IDS = Object.freeze(([
    "grant.blueprint-reset",
    "grant.campaign.reserve-1",
    "grant.campaign.reserve-2",
    "grant.defense-slots.5",
    "grant.defense-slots.6",
    "grant.mode.endless-ascension",
    "grant.protocol-slots.1",
    "grant.protocol-slots.2",
    "grant.recon.1",
    "grant.recon.2",
    "grant.recon.3",
    "grant.reinforcement-slots.1",
    "grant.relic-slots.1",
    "grant.relic-slots.2",
  ]).concat(DEFENSE_IDS.filter(function (id) {
    return STARTER_DEFENSE_IDS.indexOf(id) === -1;
  }).map(function (id) { return "grant.defense." + id; }))
    .concat(PROTOCOL_IDS.map(function (id) { return "grant.protocol." + id; }))
    .concat(RELIC_IDS.map(function (id) { return "grant.relic." + id; }))
    .concat(REINFORCEMENT_IDS.map(function (id) { return "grant.reinforcement." + id; }))
    .concat(SPECIALIZATION_IDS.map(function (id) { return "grant.specialization." + id; }))
    .sort(asciiCompare));
  const INITIAL_APPLIED_GRANT_IDS = Object.freeze(DEFAULT_SPECIALIZATION_IDS.map(function (id) {
    return "grant.specialization." + id;
  }).sort(asciiCompare));
  const LAUREL_IDS = Object.freeze((function () {
    const output = [];
    MISSION_IDS.forEach(function (missionId) {
      DIFFICULTY_IDS.forEach(function (difficultyId) {
        OBJECTIVE_IDS.forEach(function (objectiveId) {
          output.push(missionId + ":" + difficultyId + ":" + objectiveId);
        });
      });
    });
    return output.sort(asciiCompare);
  })());

  const MISSION_ID_SET = new Set(MISSION_IDS);
  const DIFFICULTY_ID_SET = new Set(DIFFICULTY_IDS);
  const OBJECTIVE_ID_SET = new Set(OBJECTIVE_IDS);
  const PROTOCOL_ID_SET = new Set(PROTOCOL_IDS);
  const RELIC_ID_SET = new Set(RELIC_IDS);
  const REINFORCEMENT_ID_SET = new Set(REINFORCEMENT_IDS);
  const DEFENSE_ID_SET = new Set(DEFENSE_IDS);
  const CAMPAIGN_MODIFIER_ID_SET = new Set(CAMPAIGN_MODIFIER_IDS);
  const CAMPAIGN_ACTION_ID_SET = new Set(CAMPAIGN_ACTION_IDS);
  const MODE_ID_SET = new Set(MODE_IDS);
  const SPECIALIZATION_ID_SET = new Set(SPECIALIZATION_IDS);
  const LAUREL_ID_SET = new Set(LAUREL_IDS);
  const GRANT_ID_SET = new Set(GRANT_IDS);

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
    if (typeof value !== "string" || !STABLE_ID.test(value)) {
      throw new TypeError(label + " must be a stable lowercase ID");
    }
    return value;
  }

  function catalogId(value, catalogSet, label) {
    const id = stableId(value, label);
    if (!catalogSet.has(id)) throw new RangeError("Unknown " + label + ": " + id);
    return id;
  }

  function unknownId(label, value) {
    throw new RangeError("Unknown " + label + " (received " + typeof value + ")");
  }

  function requireArray(value, label) {
    if (!Array.isArray(value)) throw new TypeError(label + " must be an array");
    return value;
  }

  function normalizeSortedCatalogIds(value, catalogSet, label) {
    requireArray(value, label);
    const output = [];
    let prior = null;
    value.forEach(function (candidate, index) {
      const id = catalogId(candidate, catalogSet, label + " entry " + index);
      if (prior !== null && prior >= id) {
        throw new RangeError(label + " must be unique and in strict ASCII order");
      }
      prior = id;
      output.push(id);
    });
    return output;
  }

  /* The campaign is linear, so completed missions are always a prefix of the mission catalog.
     A stored record that skips a mission is corrupt and fails closed; reconciliation never
     invents the missing intermediate completions. */
  function requireLinearPrefix(completedMissionIds) {
    completedMissionIds.forEach(function (missionId, index) {
      if (missionId !== MISSION_IDS[index]) {
        throw new RangeError("Completed missions must form the linear campaign prefix; found " +
          missionId + " without " + MISSION_IDS[index]);
      }
    });
    return completedMissionIds;
  }

  function normalizeCompletedMissionIds(value) {
    return requireLinearPrefix(normalizeSortedCatalogIds(value, MISSION_ID_SET, "completed mission ID"));
  }

  function normalizeLaurelIds(value) {
    requireArray(value, "earned Laurel identities");
    const output = [];
    let prior = null;
    value.forEach(function (candidate, index) {
      if (typeof candidate !== "string" || !LAUREL_ID_SET.has(candidate)) {
        unknownId("earned Laurel identity at index " + index, candidate);
      }
      if (prior !== null && prior >= candidate) {
        throw new RangeError("Earned Laurel identities must be unique and in strict ASCII order");
      }
      prior = candidate;
      output.push(candidate);
    });
    return output;
  }

  function expectedAllocation(tier) {
    if (tier <= 1) return 0;
    if (tier === 2) return 6;
    return 18;
  }

  function normalizeProtocols(value) {
    requireArray(value, "Protocol records");
    if (value.length !== PROTOCOL_IDS.length) {
      throw new RangeError("Protocol records must contain exactly 10 records");
    }
    return value.map(function (record, index) {
      exactFields(record, PROTOCOL_FIELDS, "Protocol record " + index);
      const expectedId = PROTOCOL_IDS[index];
      const id = catalogId(record.id, PROTOCOL_ID_SET, "Protocol ID");
      if (id !== expectedId) {
        throw new RangeError("Protocol records must use exact catalog order; expected " + expectedId);
      }
      const granted = boolean(record.granted, id + " grant");
      const availableTier = safeInteger(record.availableTier, id + " available tier", 0, 3);
      const allocatedLaurels = safeInteger(record.allocatedLaurels, id + " Laurel allocation", 0, 18);
      if ((!granted && availableTier !== 0) || (granted && availableTier === 0)) {
        throw new RangeError(id + " grant and available tier are inconsistent");
      }
      if (allocatedLaurels !== expectedAllocation(availableTier)) {
        throw new RangeError(id + " Laurel allocation does not match its available tier");
      }
      return {
        id: id,
        granted: granted,
        availableTier: availableTier,
        allocatedLaurels: allocatedLaurels,
      };
    });
  }

  function normalizeProtocolLoadout(value, cap, protocols, repairCollector) {
    requireArray(value, "Protocol loadout");
    if (value.length > cap) throw new RangeError("Protocol loadout exceeds its slot cap");
    const protocolById = new Map(protocols.map(function (record) { return [record.id, record]; }));
    const seenIds = new Set();
    let priorSlot = -1;
    return value.map(function (record, index) {
      exactFields(record, PROTOCOL_LOADOUT_FIELDS, "Protocol loadout record " + index);
      const protocolId = catalogId(record.protocolId, PROTOCOL_ID_SET, "Protocol loadout ID");
      const slot = safeInteger(record.slot, protocolId + " Protocol slot", 0, 1);
      let tier = safeInteger(record.tier, protocolId + " equipped tier", 1, 3);
      if (slot <= priorSlot) {
        throw new RangeError("Protocol loadout slots must be unique and in ascending order");
      }
      if (slot >= cap) throw new RangeError(protocolId + " Protocol slot exceeds the slot cap");
      if (seenIds.has(protocolId)) {
        throw new RangeError("Protocol loadout contains duplicate ID: " + protocolId);
      }
      const protocol = protocolById.get(protocolId);
      if (!protocol.granted) throw new RangeError(protocolId + " Protocol is not granted");
      if (tier > protocol.availableTier) {
        if (!repairCollector) {
          throw new RangeError(protocolId + " equipped tier exceeds its available tier");
        }
        repairCollector.push({
          kind: "lowered-protocol-tier",
          protocolId: protocolId,
          slot: slot,
          fromTier: tier,
          toTier: protocol.availableTier,
        });
        tier = protocol.availableTier;
      }
      priorSlot = slot;
      seenIds.add(protocolId);
      return { slot: slot, protocolId: protocolId, tier: tier };
    });
  }

  function normalizeGrantCatalog(value, ids, idSet, label) {
    requireArray(value, label);
    if (value.length !== ids.length) {
      throw new RangeError(label + " must contain exactly " + ids.length + " records");
    }
    return value.map(function (record, index) {
      exactFields(record, GRANT_FIELDS, label + " record " + index);
      const expectedId = ids[index];
      const id = catalogId(record.id, idSet, label + " ID");
      if (id !== expectedId) {
        throw new RangeError(label + " must use exact catalog order; expected " + expectedId);
      }
      return { id: id, granted: boolean(record.granted, id + " grant") };
    });
  }

  function normalizeRelicLoadout(value, cap, relics) {
    const output = normalizeSortedCatalogIds(value, RELIC_ID_SET, "Relic loadout ID");
    if (output.length > cap) throw new RangeError("Relic loadout exceeds its slot cap");
    const granted = new Set(relics.filter(function (record) { return record.granted; }).map(function (record) {
      return record.id;
    }));
    output.forEach(function (id) {
      if (!granted.has(id)) throw new RangeError(id + " Relic is not granted");
    });
    return output;
  }

  function normalizeReinforcementId(value, cap, reinforcements) {
    if (value === null) return null;
    const id = catalogId(value, REINFORCEMENT_ID_SET, "reinforcement ID");
    if (cap === 0) throw new RangeError("A reinforcement cannot be equipped before its slot unlocks");
    const granted = reinforcements.some(function (record) { return record.id === id && record.granted; });
    if (!granted) throw new RangeError(id + " reinforcement is not granted");
    return id;
  }

  function normalizeMastery(value) {
    requireArray(value, "defense mastery records");
    if (value.length !== DEFENSE_IDS.length) {
      throw new RangeError("Defense mastery must contain exactly 15 records");
    }
    return value.map(function (record, index) {
      exactFields(record, MASTERY_FIELDS, "Defense mastery record " + index);
      const expectedDefenseId = DEFENSE_IDS[index];
      const defenseId = catalogId(record.defenseId, new Set(DEFENSE_IDS), "defense mastery ID");
      if (defenseId !== expectedDefenseId) {
        throw new RangeError("Defense mastery records must use exact catalog order; expected " + expectedDefenseId);
      }
      const fielded = boolean(record.fielded, defenseId + " fielded mastery");
      const tempered = boolean(record.tempered, defenseId + " tempered mastery");
      const mastered = boolean(record.mastered, defenseId + " mastered mastery");
      const strategosVictory = boolean(record.strategosVictory, defenseId + " Strategos victory proof");
      const allowedIds = new Set(SPECIALIZATIONS_BY_DEFENSE[defenseId]);
      const specializationVictoryIds = normalizeSortedCatalogIds(
        record.specializationVictoryIds,
        allowedIds,
        defenseId + " specialization victory ID"
      );
      if (tempered && !fielded) throw new RangeError(defenseId + " tempered mastery requires fielded mastery");
      if (strategosVictory && !fielded) {
        throw new RangeError(defenseId + " Strategos victory proof requires fielded mastery");
      }
      if (specializationVictoryIds.length > 0 && !tempered) {
        throw new RangeError(defenseId + " specialization evidence requires tempered mastery");
      }
      /* Mastery is granted only at a Strategos-or-higher victory that leaves both branches
         represented (ruling R15), so the stored evidence bounds it from above without
         forcing it: the flag may lag the evidence, never lead it. */
      if (mastered && !(strategosVictory && specializationVictoryIds.length === 2)) {
        throw new RangeError(defenseId + " mastered state is not supported by its verified evidence");
      }
      if (mastered && !tempered) throw new RangeError(defenseId + " mastered state requires tempered mastery");
      return {
        defenseId: defenseId,
        fielded: fielded,
        tempered: tempered,
        mastered: mastered,
        strategosVictory: strategosVictory,
        specializationVictoryIds: specializationVictoryIds,
      };
    });
  }

  function validateSpecializationAccess(value, mastery) {
    const output = normalizeSortedCatalogIds(value, SPECIALIZATION_ID_SET, "specialization access ID");
    const outputSet = new Set(output);
    DEFAULT_SPECIALIZATION_IDS.forEach(function (id) {
      if (!outputSet.has(id)) throw new RangeError("Default specialization access is missing: " + id);
    });
    mastery.forEach(function (record) {
      const alternateId = SPECIALIZATIONS_BY_DEFENSE[record.defenseId][1];
      if (outputSet.has(alternateId) !== record.tempered) {
        throw new RangeError(alternateId + " access must match " + record.defenseId + " tempered mastery");
      }
    });
    return output;
  }

  function sameIds(actual, expected, label) {
    if (actual.length !== expected.length || actual.some(function (id, index) {
      return id !== expected[index];
    })) {
      throw new RangeError(label + " does not match the canonical applied-grant ledger");
    }
  }

  function normalizeAppliedGrantIds(value) {
    return normalizeSortedCatalogIds(value, GRANT_ID_SET, "applied grant ID");
  }

  function deriveGrantState(appliedGrantIds) {
    const defenseGrantIds = STARTER_DEFENSE_IDS.slice();
    const campaignModifierIds = [];
    const campaignActionIds = [];
    const modeIds = [];
    const protocolGrantIds = [];
    const relicGrantIds = [];
    const reinforcementGrantIds = [];
    const specializationAccessIds = [];
    let defenseSlotCap = 4;
    let protocolSlotCap = 0;
    let relicSlotCap = 0;
    let reinforcementSlotCap = 0;
    let reconTier = 0;

    appliedGrantIds.forEach(function (grantId) {
      if (grantId === "grant.blueprint-reset") {
        campaignActionIds.push("blueprint-reset");
      } else if (grantId === "grant.campaign.reserve-1") {
        campaignModifierIds.push("reserve-1");
      } else if (grantId === "grant.campaign.reserve-2") {
        campaignModifierIds.push("reserve-2");
      } else if (grantId === "grant.defense-slots.5") {
        defenseSlotCap = Math.max(defenseSlotCap, 5);
      } else if (grantId === "grant.defense-slots.6") {
        defenseSlotCap = Math.max(defenseSlotCap, 6);
      } else if (grantId.indexOf("grant.defense.") === 0) {
        defenseGrantIds.push(grantId.slice("grant.defense.".length));
      } else if (grantId === "grant.mode.endless-ascension") {
        modeIds.push("endless-ascension");
      } else if (grantId === "grant.protocol-slots.1") {
        protocolSlotCap = Math.max(protocolSlotCap, 1);
      } else if (grantId === "grant.protocol-slots.2") {
        protocolSlotCap = Math.max(protocolSlotCap, 2);
      } else if (grantId.indexOf("grant.protocol.") === 0) {
        protocolGrantIds.push(grantId.slice("grant.protocol.".length));
      } else if (grantId === "grant.recon.1") {
        reconTier = Math.max(reconTier, 1);
      } else if (grantId === "grant.recon.2") {
        reconTier = Math.max(reconTier, 2);
      } else if (grantId === "grant.recon.3") {
        reconTier = Math.max(reconTier, 3);
      } else if (grantId === "grant.reinforcement-slots.1") {
        reinforcementSlotCap = 1;
      } else if (grantId.indexOf("grant.reinforcement.") === 0) {
        reinforcementGrantIds.push(grantId.slice("grant.reinforcement.".length));
      } else if (grantId === "grant.relic-slots.1") {
        relicSlotCap = Math.max(relicSlotCap, 1);
      } else if (grantId === "grant.relic-slots.2") {
        relicSlotCap = Math.max(relicSlotCap, 2);
      } else if (grantId.indexOf("grant.relic.") === 0) {
        relicGrantIds.push(grantId.slice("grant.relic.".length));
      } else if (grantId.indexOf("grant.specialization.") === 0) {
        specializationAccessIds.push(grantId.slice("grant.specialization.".length));
      } else {
        throw new RangeError("Applied grant kind is not exhaustively handled: " + grantId);
      }
    });

    return {
      defenseGrantIds: Array.from(new Set(defenseGrantIds)).sort(asciiCompare),
      defenseSlotCap: defenseSlotCap,
      campaignModifierIds: campaignModifierIds.sort(asciiCompare),
      campaignActionIds: campaignActionIds.sort(asciiCompare),
      modeIds: modeIds.sort(asciiCompare),
      protocolGrantIds: protocolGrantIds.sort(asciiCompare),
      protocolSlotCap: protocolSlotCap,
      relicGrantIds: relicGrantIds.sort(asciiCompare),
      relicSlotCap: relicSlotCap,
      reinforcementGrantIds: reinforcementGrantIds.sort(asciiCompare),
      reinforcementSlotCap: reinforcementSlotCap,
      specializationAccessIds: specializationAccessIds.sort(asciiCompare),
      reconTier: reconTier,
    };
  }

  function validateLaurelProofs(earnedLaurelIds, completedMissionIds) {
    const completed = new Set(completedMissionIds);
    const earned = new Set(earnedLaurelIds);
    earnedLaurelIds.forEach(function (laurelId) {
      const fields = laurelId.split(":");
      const missionId = fields[0];
      const difficultyId = fields[1];
      const objectiveId = fields[2];
      if (!completed.has(missionId)) {
        throw new RangeError("Earned Laurel requires its mission to be completed: " + laurelId);
      }
      if (objectiveId !== "victory" && !earned.has(missionId + ":" + difficultyId + ":victory")) {
        throw new RangeError("Objective Laurel requires the same mission/difficulty victory Laurel: " + laurelId);
      }
    });
  }

  function validateGrantProofs(appliedGrantIds, completedMissionIds, defenseMastery) {
    const applied = new Set(appliedGrantIds);
    const completed = new Set(completedMissionIds);
    INITIAL_APPLIED_GRANT_IDS.forEach(function (grantId) {
      if (!applied.has(grantId)) throw new RangeError("Initial grant is missing: " + grantId);
    });
    MISSION_IDS.forEach(function (missionId) {
      FIRST_VICTORY_GRANTS_BY_MISSION[missionId].forEach(function (grantId) {
        if (applied.has(grantId) !== completed.has(missionId)) {
          throw new RangeError(grantId + " must match completed mission " + missionId);
        }
      });
    });
    defenseMastery.forEach(function (record) {
      const alternateId = SPECIALIZATIONS_BY_DEFENSE[record.defenseId][1];
      const alternateGrantId = "grant.specialization." + alternateId;
      if (applied.has(alternateGrantId) !== record.tempered) {
        throw new RangeError(alternateGrantId + " must match tempered mastery");
      }
    });
  }

  function normalizeProfile(value, repairCollector) {
    value = strictDataCopy(value, "Profile v2");
    exactFields(value, PROFILE_FIELDS, "Profile v2");
    if (value.schemaVersion !== PROFILE_SCHEMA_VERSION) {
      throw new RangeError("Profile schema version must be 2");
    }
    const contentIdentity = stableId(value.contentIdentity, "profile content identity");
    const completedMissionIds = normalizeCompletedMissionIds(value.completedMissionIds);
    const earnedLaurelIds = normalizeLaurelIds(value.earnedLaurelIds);
    validateLaurelProofs(earnedLaurelIds, completedMissionIds);
    const appliedGrantIds = normalizeAppliedGrantIds(value.appliedGrantIds);
    const defenseGrantIds = normalizeSortedCatalogIds(
      value.defenseGrantIds,
      DEFENSE_ID_SET,
      "defense grant ID"
    );
    const defenseSlotCap = safeInteger(value.defenseSlotCap, "defense slot cap", 4, 6);
    const campaignModifierIds = normalizeSortedCatalogIds(
      value.campaignModifierIds,
      CAMPAIGN_MODIFIER_ID_SET,
      "campaign modifier ID"
    );
    const campaignActionIds = normalizeSortedCatalogIds(
      value.campaignActionIds,
      CAMPAIGN_ACTION_ID_SET,
      "campaign action ID"
    );
    const modeIds = normalizeSortedCatalogIds(value.modeIds, MODE_ID_SET, "mode ID");
    const defenseMastery = normalizeMastery(value.defenseMastery);
    validateGrantProofs(appliedGrantIds, completedMissionIds, defenseMastery);
    const derived = deriveGrantState(appliedGrantIds);
    sameIds(defenseGrantIds, derived.defenseGrantIds, "Defense grants");
    if (defenseSlotCap !== derived.defenseSlotCap) {
      throw new RangeError("Defense slot cap does not match the canonical applied-grant ledger");
    }
    sameIds(campaignModifierIds, derived.campaignModifierIds, "Campaign modifiers");
    sameIds(campaignActionIds, derived.campaignActionIds, "Campaign actions");
    sameIds(modeIds, derived.modeIds, "Mode grants");
    const protocols = normalizeProtocols(value.protocols);
    protocols.forEach(function (record) {
      if (record.granted !== (derived.protocolGrantIds.indexOf(record.id) !== -1)) {
        throw new RangeError(record.id + " Protocol grant does not match the applied-grant ledger");
      }
    });
    const totalAllocated = protocols.reduce(function (sum, record) {
      return sum + record.allocatedLaurels;
    }, 0);
    if (totalAllocated > earnedLaurelIds.length) {
      throw new RangeError("Protocol allocations exceed the earned Laurel budget");
    }
    const protocolSlotCap = safeInteger(value.protocolSlotCap, "Protocol slot cap", 0, 2);
    if (protocolSlotCap !== derived.protocolSlotCap) {
      throw new RangeError("Protocol slot cap does not match the canonical applied-grant ledger");
    }
    const protocolLoadout = normalizeProtocolLoadout(
      value.protocolLoadout,
      protocolSlotCap,
      protocols,
      repairCollector
    );
    const relics = normalizeGrantCatalog(value.relics, RELIC_IDS, RELIC_ID_SET, "Relic grants");
    relics.forEach(function (record) {
      if (record.granted !== (derived.relicGrantIds.indexOf(record.id) !== -1)) {
        throw new RangeError(record.id + " Relic grant does not match the applied-grant ledger");
      }
    });
    const relicSlotCap = safeInteger(value.relicSlotCap, "Relic slot cap", 0, 2);
    if (relicSlotCap !== derived.relicSlotCap) {
      throw new RangeError("Relic slot cap does not match the canonical applied-grant ledger");
    }
    const relicLoadoutIds = normalizeRelicLoadout(value.relicLoadoutIds, relicSlotCap, relics);
    const reinforcements = normalizeGrantCatalog(
      value.reinforcements,
      REINFORCEMENT_IDS,
      REINFORCEMENT_ID_SET,
      "reinforcement grants"
    );
    const reinforcementSlotCap = safeInteger(value.reinforcementSlotCap, "reinforcement slot cap", 0, 1);
    reinforcements.forEach(function (record) {
      if (record.granted !== (derived.reinforcementGrantIds.indexOf(record.id) !== -1)) {
        throw new RangeError(record.id + " reinforcement grant does not match the applied-grant ledger");
      }
    });
    if (reinforcementSlotCap !== derived.reinforcementSlotCap) {
      throw new RangeError("Reinforcement slot cap does not match the canonical applied-grant ledger");
    }
    const reinforcementId = normalizeReinforcementId(
      value.reinforcementId,
      reinforcementSlotCap,
      reinforcements
    );
    const specializationAccessIds = validateSpecializationAccess(
      value.specializationAccessIds,
      defenseMastery
    );
    sameIds(
      specializationAccessIds,
      derived.specializationAccessIds,
      "Specialization access"
    );
    const reconTier = safeInteger(value.reconTier, "Recon tier", 0, 3);
    if (reconTier !== derived.reconTier) {
      throw new RangeError("Recon tier does not match the canonical applied-grant ledger");
    }

    return deepFreeze({
      schemaVersion: PROFILE_SCHEMA_VERSION,
      contentIdentity: contentIdentity,
      completedMissionIds: completedMissionIds,
      earnedLaurelIds: earnedLaurelIds,
      appliedGrantIds: appliedGrantIds,
      defenseGrantIds: defenseGrantIds,
      defenseSlotCap: defenseSlotCap,
      campaignModifierIds: campaignModifierIds,
      campaignActionIds: campaignActionIds,
      modeIds: modeIds,
      protocols: protocols,
      protocolLoadout: protocolLoadout,
      protocolSlotCap: protocolSlotCap,
      relics: relics,
      relicLoadoutIds: relicLoadoutIds,
      relicSlotCap: relicSlotCap,
      reinforcements: reinforcements,
      reinforcementId: reinforcementId,
      reinforcementSlotCap: reinforcementSlotCap,
      specializationAccessIds: specializationAccessIds,
      defenseMastery: defenseMastery,
      reconTier: reconTier,
    });
  }

  function createProfileV2(contentIdentity) {
    if (contentIdentity === undefined) {
      throw new TypeError("Profile v2 requires an explicit stable content identity");
    }
    const identity = stableId(contentIdentity, "profile content identity");
    const derived = deriveGrantState(INITIAL_APPLIED_GRANT_IDS);
    const profile = {
      schemaVersion: PROFILE_SCHEMA_VERSION,
      contentIdentity: identity,
      completedMissionIds: [],
      earnedLaurelIds: [],
      appliedGrantIds: INITIAL_APPLIED_GRANT_IDS.slice(),
      defenseGrantIds: derived.defenseGrantIds,
      defenseSlotCap: derived.defenseSlotCap,
      campaignModifierIds: derived.campaignModifierIds,
      campaignActionIds: derived.campaignActionIds,
      modeIds: derived.modeIds,
      protocols: PROTOCOL_IDS.map(function (id) {
        return { id: id, granted: false, availableTier: 0, allocatedLaurels: 0 };
      }),
      protocolLoadout: [],
      protocolSlotCap: 0,
      relics: RELIC_IDS.map(function (id) { return { id: id, granted: false }; }),
      relicLoadoutIds: [],
      relicSlotCap: 0,
      reinforcements: REINFORCEMENT_IDS.map(function (id) { return { id: id, granted: false }; }),
      reinforcementId: null,
      reinforcementSlotCap: 0,
      specializationAccessIds: DEFAULT_SPECIALIZATION_IDS.slice(),
      defenseMastery: DEFENSE_IDS.map(function (defenseId) {
        return {
          defenseId: defenseId,
          fielded: false,
          tempered: false,
          mastered: false,
          strategosVictory: false,
          specializationVictoryIds: [],
        };
      }),
      reconTier: 0,
    };
    return normalizeProfile(profile, null);
  }

  function validateProfileV2(value) {
    return normalizeProfile(value, null);
  }

  function expectedAppliedGrants(completedMissionIds, defenseMastery) {
    let grantIds = INITIAL_APPLIED_GRANT_IDS.slice();
    completedMissionIds.forEach(function (missionId) {
      grantIds = grantIds.concat(FIRST_VICTORY_GRANTS_BY_MISSION[missionId]);
    });
    defenseMastery.forEach(function (record) {
      if (record.tempered) {
        grantIds.push("grant.specialization." + SPECIALIZATIONS_BY_DEFENSE[record.defenseId][1]);
      }
    });
    return Array.from(new Set(grantIds)).sort(asciiCompare);
  }

  function reconcileProfileV2(value) {
    const source = strictDataCopy(value, "Profile v2 reconciliation input");
    const originalText = JSON.stringify(source);
    const repairs = [];
    exactFields(source, PROFILE_FIELDS, "Profile v2 reconciliation input");
    if (source.schemaVersion !== PROFILE_SCHEMA_VERSION) {
      throw new RangeError("Profile schema version must be 2");
    }
    source.contentIdentity = stableId(source.contentIdentity, "profile content identity");
    source.completedMissionIds = normalizeCompletedMissionIds(source.completedMissionIds);
    source.earnedLaurelIds = normalizeLaurelIds(source.earnedLaurelIds);
    const earnedSet = new Set(source.earnedLaurelIds);
    source.earnedLaurelIds = source.earnedLaurelIds.filter(function (laurelId) {
      const fields = laurelId.split(":");
      if (fields[2] !== "victory" && !earnedSet.has(fields[0] + ":" + fields[1] + ":victory")) {
        repairs.push({ kind: "removed-orphan-objective-laurel", laurelId: laurelId });
        return false;
      }
      return true;
    });
    const completedSet = new Set(source.completedMissionIds);
    source.earnedLaurelIds.forEach(function (laurelId) {
      const fields = laurelId.split(":");
      if (fields[2] === "victory" && !completedSet.has(fields[0])) {
        completedSet.add(fields[0]);
        repairs.push({ kind: "restored-completion-from-victory-laurel", missionId: fields[0] });
      }
    });
    source.completedMissionIds = requireLinearPrefix(Array.from(completedSet).sort(asciiCompare));
    source.defenseMastery = normalizeMastery(source.defenseMastery);

    requireArray(source.appliedGrantIds, "applied grant IDs");
    const seenGrantIds = new Set();
    source.appliedGrantIds.forEach(function (grantId, index) {
      const id = catalogId(grantId, GRANT_ID_SET, "applied grant ID entry " + index);
      if (seenGrantIds.has(id)) throw new RangeError("Applied grant IDs must be unique");
      seenGrantIds.add(id);
    });
    const expectedGrantIds = expectedAppliedGrants(source.completedMissionIds, source.defenseMastery);
    if (Array.from(seenGrantIds).sort(asciiCompare).join("\n") !== expectedGrantIds.join("\n")) {
      repairs.push({ kind: "rebuilt-applied-grant-ledger" });
    }
    source.appliedGrantIds = expectedGrantIds;
    const derived = deriveGrantState(expectedGrantIds);

    source.defenseGrantIds = derived.defenseGrantIds;
    source.defenseSlotCap = derived.defenseSlotCap;
    source.campaignModifierIds = derived.campaignModifierIds;
    source.campaignActionIds = derived.campaignActionIds;
    source.modeIds = derived.modeIds;
    source.protocolSlotCap = derived.protocolSlotCap;
    source.relicSlotCap = derived.relicSlotCap;
    source.reinforcementSlotCap = derived.reinforcementSlotCap;
    source.specializationAccessIds = derived.specializationAccessIds;
    source.reconTier = derived.reconTier;

    const originalProtocols = normalizeProtocols(source.protocols);
    source.protocols = originalProtocols.map(function (record) {
      const shouldBeGranted = derived.protocolGrantIds.indexOf(record.id) !== -1;
      if (!shouldBeGranted) {
        return { id: record.id, granted: false, availableTier: 0, allocatedLaurels: 0 };
      }
      if (!record.granted) {
        return { id: record.id, granted: true, availableTier: 1, allocatedLaurels: 0 };
      }
      return record;
    });
    let allocated = source.protocols.reduce(function (sum, record) {
      return sum + record.allocatedLaurels;
    }, 0);
    for (let index = source.protocols.length - 1;
         allocated > source.earnedLaurelIds.length && index >= 0;
         index -= 1) {
      const record = source.protocols[index];
      while (allocated > source.earnedLaurelIds.length && record.availableTier > 1) {
        const prior = record.allocatedLaurels;
        record.availableTier -= 1;
        record.allocatedLaurels = expectedAllocation(record.availableTier);
        allocated -= prior - record.allocatedLaurels;
        repairs.push({ kind: "refunded-over-budget-protocol-tier", protocolId: record.id });
      }
    }

    const permissiveProtocols = PROTOCOL_IDS.map(function (id) {
      return { id: id, granted: true, availableTier: 3, allocatedLaurels: 18 };
    });
    const parsedProtocolLoadout = normalizeProtocolLoadout(
      source.protocolLoadout,
      2,
      permissiveProtocols,
      null
    );
    const grantedProtocolIds = new Set(derived.protocolGrantIds);
    const protocolById = new Map(source.protocols.map(function (record) { return [record.id, record]; }));
    source.protocolLoadout = parsedProtocolLoadout.filter(function (record) {
      const keep = grantedProtocolIds.has(record.protocolId) && record.slot < derived.protocolSlotCap;
      if (!keep) repairs.push({ kind: "removed-invalid-protocol-loadout", protocolId: record.protocolId });
      return keep;
    }).map(function (record) {
      const maximumTier = protocolById.get(record.protocolId).availableTier;
      if (record.tier > maximumTier) {
        repairs.push({ kind: "lowered-protocol-tier", protocolId: record.protocolId });
      }
      return {
        slot: record.slot,
        protocolId: record.protocolId,
        tier: Math.min(record.tier, maximumTier),
      };
    });

    normalizeGrantCatalog(source.relics, RELIC_IDS, RELIC_ID_SET, "Relic grants");
    source.relics = RELIC_IDS.map(function (id) {
      return { id: id, granted: derived.relicGrantIds.indexOf(id) !== -1 };
    });
    const allRelics = RELIC_IDS.map(function (id) { return { id: id, granted: true }; });
    source.relicLoadoutIds = normalizeRelicLoadout(source.relicLoadoutIds, 2, allRelics)
      .filter(function (id, index) {
        const keep = derived.relicGrantIds.indexOf(id) !== -1 && index < derived.relicSlotCap;
        if (!keep) repairs.push({ kind: "removed-invalid-relic-loadout", relicId: id });
        return keep;
      });

    normalizeGrantCatalog(
      source.reinforcements,
      REINFORCEMENT_IDS,
      REINFORCEMENT_ID_SET,
      "reinforcement grants"
    );
    source.reinforcements = REINFORCEMENT_IDS.map(function (id) {
      return { id: id, granted: derived.reinforcementGrantIds.indexOf(id) !== -1 };
    });
    if (source.reinforcementId !== null) {
      const reinforcementId = catalogId(
        source.reinforcementId,
        REINFORCEMENT_ID_SET,
        "reinforcement ID"
      );
      if (derived.reinforcementSlotCap === 0 ||
          derived.reinforcementGrantIds.indexOf(reinforcementId) === -1) {
        repairs.push({ kind: "removed-invalid-reinforcement-loadout", reinforcementId: reinforcementId });
        source.reinforcementId = null;
      }
    }

    const profile = normalizeProfile(source, null);
    return deepFreeze({
      changed: originalText !== JSON.stringify(profile),
      profile: profile,
      repairs: repairs,
    });
  }

  function repairSavedProtocolTiers(value) {
    const repairs = [];
    const profile = normalizeProfile(value, repairs);
    return deepFreeze({
      changed: repairs.length > 0,
      profile: profile,
      repairs: repairs,
    });
  }

  function makeLaurelId(missionId, difficultyId, objectiveId) {
    if (!MISSION_ID_SET.has(missionId)) unknownId("Laurel mission ID", missionId);
    if (!DIFFICULTY_ID_SET.has(difficultyId)) {
      unknownId("Laurel difficulty ID", difficultyId);
    }
    if (!OBJECTIVE_ID_SET.has(objectiveId)) {
      unknownId("Laurel objective ID", objectiveId);
    }
    return missionId + ":" + difficultyId + ":" + objectiveId;
  }

  function getLaurelBudget(value) {
    const profile = validateProfileV2(value);
    const allocated = profile.protocols.reduce(function (sum, record) {
      return sum + record.allocatedLaurels;
    }, 0);
    return deepFreeze({
      earned: profile.earnedLaurelIds.length,
      allocated: allocated,
      available: profile.earnedLaurelIds.length - allocated,
    });
  }

  function getMissionPrerequisiteId(missionId) {
    if (!MISSION_ID_SET.has(missionId)) unknownId("mission ID", missionId);
    const index = MISSION_IDS.indexOf(missionId);
    return index === 0 ? null : MISSION_IDS[index - 1];
  }

  /* Combat-affecting run inputs only. Recon, the generic applied-grant ledger, mastery,
     and Laurel allocations never enter a run header, ruleset hash, or record key. */
  function resolveRunSnapshot(value) {
    const profile = validateProfileV2(value);
    return deepFreeze({
      profileSchemaVersion: PROFILE_SCHEMA_VERSION,
      contentIdentity: profile.contentIdentity,
      defenseGrantIds: profile.defenseGrantIds.slice(),
      defenseSlotCap: profile.defenseSlotCap,
      campaignModifierIds: profile.campaignModifierIds.slice(),
      campaignActionIds: profile.campaignActionIds.slice(),
      modeIds: profile.modeIds.slice(),
      protocolLoadout: profile.protocolLoadout.map(function (record) {
        return { slot: record.slot, protocolId: record.protocolId, tier: record.tier };
      }),
      protocolSlotCap: profile.protocolSlotCap,
      relicIds: profile.relicLoadoutIds.slice(),
      relicSlotCap: profile.relicSlotCap,
      reinforcementId: profile.reinforcementId,
      specializationAccessIds: profile.specializationAccessIds.slice(),
    });
  }

  return deepFreeze({
    PROFILE_SCHEMA_VERSION: PROFILE_SCHEMA_VERSION,
    MISSION_IDS: MISSION_IDS,
    DIFFICULTY_IDS: DIFFICULTY_IDS,
    OBJECTIVE_IDS: OBJECTIVE_IDS,
    PROTOCOL_IDS: PROTOCOL_IDS,
    RELIC_IDS: RELIC_IDS,
    REINFORCEMENT_IDS: REINFORCEMENT_IDS,
    DEFENSE_IDS: DEFENSE_IDS,
    SPECIALIZATIONS_BY_DEFENSE: SPECIALIZATIONS_BY_DEFENSE,
    DEFAULT_SPECIALIZATION_IDS: DEFAULT_SPECIALIZATION_IDS,
    ALTERNATE_SPECIALIZATION_IDS: ALTERNATE_SPECIALIZATION_IDS,
    SPECIALIZATION_IDS: SPECIALIZATION_IDS,
    STARTER_DEFENSE_IDS: STARTER_DEFENSE_IDS,
    CAMPAIGN_MODIFIER_IDS: CAMPAIGN_MODIFIER_IDS,
    CAMPAIGN_ACTION_IDS: CAMPAIGN_ACTION_IDS,
    MODE_IDS: MODE_IDS,
    GRANT_IDS: GRANT_IDS,
    INITIAL_APPLIED_GRANT_IDS: INITIAL_APPLIED_GRANT_IDS,
    FIRST_VICTORY_GRANTS_BY_MISSION: FIRST_VICTORY_GRANTS_BY_MISSION,
    LAUREL_IDS: LAUREL_IDS,
    createProfileV2: createProfileV2,
    validateProfileV2: validateProfileV2,
    reconcileProfileV2: reconcileProfileV2,
    repairSavedProtocolTiers: repairSavedProtocolTiers,
    makeLaurelId: makeLaurelId,
    getMissionPrerequisiteId: getMissionPrerequisiteId,
    getLaurelBudget: getLaurelBudget,
    resolveRunSnapshot: resolveRunSnapshot,
  });
});
