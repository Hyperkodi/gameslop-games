/* Armara Aegis campaign delivery shell.
   A pure, deterministic screen state machine plus screen projections. It owns
   navigation, mission locks, loadout planning, the Recon-tiered briefing, and
   the result summary. It never touches the DOM, storage, wall-clock time, or
   the simulation, and every refusal carries a stable reason a player can read. */
(function (root, factory) {
  "use strict";

  const commonJs = typeof module === "object" && module.exports;
  const installed = root && root.Game;
  const api = factory(
    commonJs ? require("../progression/profile-v2.js") : installed && installed.AegisProfileV2,
    commonJs ? require("../progression/progression.js") : installed && installed.AegisProgression,
    commonJs ? require("../presentation/player-ui.js") : installed && installed.AegisPlayerUi,
    commonJs ? require("./keybindings.js") : installed && installed.AegisKeyBindings
  );
  if (commonJs) {
    module.exports = api;
    return;
  }
  const game = root.Game = root.Game || {};
  if (!game || (typeof game !== "object" && typeof game !== "function")) {
    throw new Error("Cannot install the Aegis shell into a non-object Game namespace");
  }
  if (Object.prototype.hasOwnProperty.call(game, "AegisShell")) {
    if (game.AegisShell !== api) throw new Error("Conflicting Game.AegisShell is already installed");
    return;
  }
  Object.defineProperty(game, "AegisShell", {
    value: api,
    enumerable: true,
    configurable: false,
    writable: false,
  });
})(typeof globalThis !== "undefined" ? globalThis : this, function (Profile, Progression, PlayerUi, KeyBindings) {
  "use strict";

  if (!Profile || !Progression || !PlayerUi || !KeyBindings) {
    throw new Error("The Aegis shell requires profile-v2, progression, player-ui, and key bindings");
  }

  const VERSION = 1;
  const MAX_UINT32 = 0xffffffff;
  const ROMAN = Object.freeze(["", "I", "II", "III", "IV", "V"]);
  const SCREENS = Object.freeze([
    "title", "campaign", "training", "codex", "settings",
    "loadout", "briefing", "battle", "result",
  ]);
  const MODES = Object.freeze(["campaign", "training"]);
  const HUB_SCREENS = Object.freeze(["campaign", "training", "codex", "settings"]);
  const DIFFICULTY_LABELS = Object.freeze({
    story: "Story", strategos: "Strategos", titan: "Titan",
  });
  const DIFFICULTY_SUMMARIES = Object.freeze({
    story: "More starting Aether, more Gate Health, weaker enemies. Full campaign rewards and Laurels.",
    strategos: "The balanced campaign preset. This is the reference difficulty for scores.",
    titan: "Less Aether, less Gate Health, tougher and faster enemies, 150% score.",
  });
  const RECON_LABELS = Object.freeze([
    "Baseline scouting", "Recon I", "Recon II", "Recon III",
  ]);
  const STATE_FIELDS = Object.freeze([
    "screen", "mode", "missionId", "difficultyId", "assist", "seed", "loadoutIds",
    "runHeader", "result", "notice", "previousScreen", "settings", "storageKind", "debug",
  ]);
  const SETTINGS_FIELDS = Object.freeze([
    "reducedMotion", "photosensitiveSafe", "bindings",
  ]);
  const REASONS = Object.freeze({
    "screen-unknown": "That screen does not exist.",
    "screen-transition-not-allowed": "You cannot go there from this screen.",
    "mission-unknown": "That mission is not part of this build.",
    "mission-locked": "Finish the mission before it first.",
    "difficulty-unknown": "That difficulty does not exist.",
    "difficulty-locked": "Clear every mission in this act to unlock Titan.",
    "seed-invalid": "A replay seed must be a whole number from 0 to 4294967295.",
    "loadout-empty": "Equip at least one defense before you start.",
    "loadout-over-cap": "That is more defenses than your slots allow.",
    "loadout-duplicate": "Each defense can only fill one slot.",
    "loadout-unavailable": "That defense is not available on this mission yet.",
    "mission-required": "Choose a mission first.",
    "run-header-required": "The mission start state has not been built yet.",
    "run-already-started": "This run already started; its start state is final.",
    "result-required": "A finished run needs its result before the result screen.",
    "run-not-started": "There is no run in progress.",
    "action-unknown": "That action is not available.",
    "binding-refused": "That shortcut key cannot be used.",
    "setting-unknown": "That setting does not exist.",
  });

  const TRANSITIONS = Object.freeze({
    title: Object.freeze(["campaign", "training", "codex", "settings"]),
    campaign: Object.freeze(["title", "loadout", "settings", "codex"]),
    training: Object.freeze(["title", "loadout", "settings", "codex"]),
    codex: Object.freeze(["title", "campaign", "training"]),
    settings: Object.freeze(["title", "campaign", "training"]),
    loadout: Object.freeze(["campaign", "training", "briefing", "codex"]),
    briefing: Object.freeze(["loadout", "battle"]),
    battle: Object.freeze(["result", "campaign", "training"]),
    result: Object.freeze(["campaign", "training", "loadout"]),
  });

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

  function hasOwn(value, key) {
    return Object.prototype.hasOwnProperty.call(value, key);
  }

  function asciiCompare(left, right) {
    return left < right ? -1 : (left > right ? 1 : 0);
  }

  function titleCase(value) {
    return String(value).split(/[-_.]/).filter(Boolean).map(function (word) {
      return word.charAt(0).toUpperCase() + word.slice(1);
    }).join(" ");
  }

  function missionNumber(missionId) {
    return Number(String(missionId).slice(1));
  }

  function presentationStrings(presentation) {
    const table = Object.create(null);
    if (presentation && Array.isArray(presentation.strings)) {
      presentation.strings.forEach(function (record) {
        if (record && typeof record.key === "string" && typeof record.value === "string") {
          table[record.key] = record.value;
        }
      });
    }
    return table;
  }

  function text(strings, key, fallback) {
    if (typeof key === "string" && hasOwn(strings, key)) return strings[key];
    return fallback;
  }

  /* Compiled strings carry declared `{placeholder}` tokens whose values live in
     the mission, objective, and difficulty records. A token is never shown to a
     player: an unsupplied one is dropped rather than printed as a brace. */
  function format(strings, key, fallback, values) {
    const raw = text(strings, key, fallback);
    if (typeof raw !== "string" || raw.indexOf("{") === -1) return raw;
    return raw.replace(/\{([A-Za-z][A-Za-z0-9]*)\}/g, function (match, name) {
      const value = values && hasOwn(values, name) ? values[name] : null;
      return value === null || value === undefined ? "" : String(value);
    }).replace(/\s{2,}/g, " ").replace(/\s+([.,;:])/g, "$1").trim();
  }

  /* ------------------------------------------------------------------ catalog */

  function describeGrant(grantId) {
    const record = Progression.GRANT_RECORDS.find(function (candidate) { return candidate.id === grantId; });
    if (!record) return { id: grantId, kind: "unknown", targetId: null, category: "reward", text: titleCase(grantId) };
    const name = record.targetId ? titleCase(record.targetId) : null;
    switch (record.kind) {
      case "unlock-defense":
        return { id: grantId, kind: record.kind, targetId: record.targetId, category: "defense",
          text: "New defense: " + name };
      case "unlock-protocol":
        return { id: grantId, kind: record.kind, targetId: record.targetId, category: "protocol",
          text: "New Divine Protocol: " + name };
      case "unlock-relic":
        return { id: grantId, kind: record.kind, targetId: record.targetId, category: "relic",
          text: "New Relic: " + name };
      case "unlock-reinforcement":
        return { id: grantId, kind: record.kind, targetId: record.targetId, category: "reinforcement",
          text: "New reinforcement: " + name };
      case "unlock-specialization":
        return { id: grantId, kind: record.kind, targetId: record.targetId, category: "specialization",
          text: "New Level 3 branch: " + name };
      case "set-defense-slot-cap":
        return { id: grantId, kind: record.kind, targetId: null, category: "slot",
          text: "Defense slots increase to " + record.integerValue };
      case "set-protocol-slot-cap":
        return { id: grantId, kind: record.kind, targetId: null, category: "slot",
          text: "Divine Protocol slots increase to " + record.integerValue };
      case "set-relic-slot-cap":
        return { id: grantId, kind: record.kind, targetId: null, category: "slot",
          text: "Relic slots increase to " + record.integerValue };
      case "set-reinforcement-slot-cap":
        return { id: grantId, kind: record.kind, targetId: null, category: "slot",
          text: "Reinforcement slot unlocked" };
      case "set-recon-tier":
        return { id: grantId, kind: record.kind, targetId: null, category: "recon",
          text: "Recon " + ROMAN[record.integerValue] + ": a longer, exact wave preview" };
      case "unlock-campaign-modifier":
        return { id: grantId, kind: record.kind, targetId: record.targetId, category: "modifier",
          text: "Campaign upgrade: " + name + " (+" + record.integerValue + " starting Aether)" };
      case "unlock-campaign-action":
        return { id: grantId, kind: record.kind, targetId: record.targetId, category: "action",
          text: "New campaign action: " + name };
      case "unlock-mode":
        return { id: grantId, kind: record.kind, targetId: record.targetId, category: "mode",
          text: "New mode: " + name };
      default:
        return { id: grantId, kind: record.kind, targetId: record.targetId, category: "reward",
          text: titleCase(grantId) };
    }
  }

  /* Authored trait and resistance entries are records, not words. Only their stable IDs reach
     a player-facing projection, so a briefing can never print a raw authored object. */
  function traitIds(record) {
    return (record.traits || []).map(function (entry) {
      if (typeof entry === "string") return entry;
      return entry && typeof entry.kind === "string" ? entry.kind : null;
    }).filter(Boolean).sort(asciiCompare);
  }

  function resistanceIds(record) {
    return (record.resistances || []).map(function (entry) {
      if (typeof entry === "string") return entry;
      return entry && typeof entry.damageTypeId === "string" ? entry.damageTypeId : null;
    }).filter(Boolean).sort(asciiCompare);
  }

  function normalizeCollection(source, mapper) {
    const output = Object.create(null);
    if (!isPlainObject(source)) return output;
    Object.keys(source).sort().forEach(function (key) {
      const record = mapper(source[key], key);
      if (record) output[key] = record;
    });
    return output;
  }

  function defenseCatalog(content, strings, scales) {
    return normalizeCollection(content.defenses, function (record, id) {
      const levels = Array.isArray(record.levels) ? record.levels : [];
      const first = levels[0] || {};
      const purchase = first.purchase || {};
      return {
        id: id,
        name: text(strings, record.nameKey, titleCase(id)),
        roleText: format(strings, record.roleKey, "Defense", {}),
        weaknessText: format(strings, record.weaknessKey, "", {}),
        costAether: Number.isSafeInteger(purchase.costAether) ? purchase.costAether : null,
        rangeWorldUnits: Number.isSafeInteger(first.rangeWorldUnits)
          ? Math.round(first.rangeWorldUnits / scales.distance) : null,
        targetKinds: Array.isArray(record.targetKinds) ? record.targetKinds.slice().sort(asciiCompare) : [],
        levelCount: levels.length,
      };
    });
  }

  function protocolCatalog(content, strings) {
    return normalizeCollection(content.protocols, function (record, id) {
      const tiers = Array.isArray(record.tiers) ? record.tiers : [];
      return {
        id: id,
        protocolId: id,
        name: text(strings, record.nameKey, titleCase(id)),
        castPolicyId: record.castPolicyId || "repeat-surcharge",
        targetKind: record.targetKind || "none",
        tiers: tiers.map(function (tier) {
          return {
            tier: tier.tier,
            baseCostAether: tier.baseCostAether,
            cooldownMs: tier.cooldownMs,
            durationMs: tier.effect && Number.isSafeInteger(tier.effect.durationMs) ? tier.effect.durationMs : 0,
            maximumAcceptedCasts: tier.maximumAcceptedCasts === undefined ? null : tier.maximumAcceptedCasts,
            incrementalLaurels: tier.incrementalLaurels,
            cumulativeLaurels: tier.cumulativeLaurels,
            effectText: text(strings, record.nameKey + ".tier" + tier.tier + ".effect",
              tierEffectText(record, tier)),
          };
        }),
      };
    });
  }

  function tierEffectText(record, tier) {
    const effect = tier.effect || {};
    const parts = [];
    if (effect.kind) parts.push(titleCase(effect.kind));
    if (Number.isSafeInteger(effect.durationMs) && effect.durationMs > 0) {
      parts.push("for " + Math.round(effect.durationMs / 1000) + " seconds");
    }
    if (Number.isSafeInteger(effect.charges)) parts.push(effect.charges + " charges");
    return parts.length ? parts.join(", ") + "." : "Tier " + tier.tier + " effect.";
  }

  function relicCatalog(content, strings) {
    return normalizeCollection(content.relics, function (record, id) {
      return {
        id: id,
        name: text(strings, record.nameKey, titleCase(id)),
        benefitText: format(strings, record.benefitKey, "Grants an advantage.", {}),
        drawbackText: format(strings, record.drawbackKey, "Costs you something else.", {}),
        unlockSource: "Win the campaign mission that awards it.",
      };
    });
  }

  function reinforcementCatalog(content, strings) {
    return normalizeCollection(content.reinforcements, function (record, id) {
      return {
        id: id,
        name: text(strings, record.nameKey, titleCase(id)),
        roleText: format(strings, record.nameKey + ".role", titleCase(record.markerKind || "reinforcement"), {}),
        costAether: record.costAether,
        cooldownMs: record.cooldownMs,
        lifetimeMs: record.lifetimeMs,
      };
    });
  }

  function missionCatalog(content, strings, missionIds) {
    const output = Object.create(null);
    missionIds.forEach(function (missionId) {
      const record = content.missions[missionId];
      const briefing = record.briefing || {};
      const waves = Array.isArray(record.waves) ? record.waves : [];
      const objectives = Array.isArray(record.objectives) ? record.objectives : [];
      const missionValues = {
        waveCount: waves.length,
        missionNumber: missionNumber(missionId),
        actIndex: record.actIndex,
      };
      output[missionId] = {
        id: missionId,
        number: missionNumber(missionId),
        actIndex: Number.isSafeInteger(record.actIndex) ? record.actIndex : 1,
        title: format(strings, record.titleKey, "Mission " + missionNumber(missionId), missionValues),
        summary: format(strings, briefing.summaryKey, "Hold the gate against every authored wave.", missionValues),
        objectiveText: format(strings, briefing.objectiveKey,
          "Survive every wave and protect the gate.", missionValues),
        story: format(strings, briefing.storyKey, "", missionValues),
        routeNotices: (briefing.routeNoticeKeys || [])
          .map(function (key) { return format(strings, key, "", missionValues); }).filter(Boolean),
        mechanicNotices: (briefing.mechanicNoticeKeys || [])
          .map(function (key) { return format(strings, key, "", missionValues); }).filter(Boolean),
        environmentLabel: text(
          strings,
          "map." + String(record.mapId || missionId) + ".name",
          text(strings, record.titleKey, "Mission " + missionNumber(missionId)) + " battlefield"
        ),
        headlineMechanicId: record.headlineMechanicId || null,
        waveCount: waves.length,
        availableDefenseIds: (record.availableDefenseIds || []).slice(),
        protocolLoan: record.protocolLoan === undefined ? null : record.protocolLoan,
        mechanismId: record.mechanism && record.mechanism.mechanismId ? record.mechanism.mechanismId : null,
        objectives: objectives.map(function (objective) {
          const thresholds = Object.create(null);
          (objective.thresholdRecords || []).forEach(function (threshold) {
            thresholds[threshold.difficultyId] = threshold.minimumIntegrity;
          });
          const values = Object.assign({}, missionValues, {
            maximumTowers: objective.predicate && Number.isSafeInteger(objective.predicate.maximum)
              ? objective.predicate.maximum : null,
          });
          return {
            id: objective.id,
            title: format(strings, objective.titleKey, titleCase(objective.id), values),
            description: format(strings, objective.descriptionKey, "", values),
            descriptionKey: objective.descriptionKey,
            descriptionValues: values,
            integrityThresholds: thresholds,
          };
        }),
        firstClearRewards: Progression.getMissionFirstClearGrantBundle(missionId)
          .firstVictoryGrantIds.map(describeGrant),
      };
    });
    return output;
  }

  /* Compiled content v4 authors the act narrative (spec 18.2). The shell carries the authored
     title, era, story, and premise through verbatim and never writes narrative of its own; a
     build whose content predates the acts collection keeps the old derived heading. Acts with
     no mission in this build are omitted rather than rendered as empty shelves. */
  function actCatalog(missionIds, missions, strings, content) {
    const byAct = new Map();
    missionIds.forEach(function (missionId) {
      const actIndex = missions[missionId].actIndex;
      if (!byAct.has(actIndex)) byAct.set(actIndex, []);
      byAct.get(actIndex).push(missionId);
    });
    const authored = new Map();
    const records = content && content.acts && Array.isArray(content.acts.records)
      ? content.acts.records : [];
    records.forEach(function (record) {
      if (record && Number.isSafeInteger(record.index)) authored.set(record.index, record);
    });
    return Array.from(byAct.keys()).sort(function (a, b) { return a - b; }).map(function (actIndex) {
      const record = authored.get(actIndex) || null;
      return {
        index: actIndex,
        title: text(
          strings,
          record ? record.titleKey : "act." + actIndex + ".title",
          "Act " + (ROMAN[actIndex] || actIndex)
        ),
        era: record ? format(strings, record.eraKey, "", {}) : "",
        story: record ? format(strings, record.storyKey, "", {}) : "",
        premise: record ? format(strings, record.premiseKey, "", {}) : "",
        missionIds: byAct.get(actIndex).slice(),
      };
    });
  }

  /* Spec 18.3: every Recon tier explains in plain language what it does and does not reveal.
     The authored copy lives in compiled content; these fallbacks only cover a build compiled
     before the collection existed. */
  const RECON_FALLBACK_DETAIL = Object.freeze([
    "You can see every route, enemy type, and boss rule for this mission, but not how many are"
      + " coming. Recon reveals exact numbers.",
    "Recon I shows exact numbers and routes for the next wave.",
    "Recon II shows exact numbers for the next two waves, and roughly when each group arrives.",
    "Recon III shows exact numbers, routes, and arrival times for every wave left in the mission.",
  ]);

  function reconCatalog(content, strings) {
    const records = content && content.acts && Array.isArray(content.acts.reconRecords)
      ? content.acts.reconRecords : [];
    const byTier = new Map();
    records.forEach(function (record) {
      if (record && Number.isSafeInteger(record.tier)) byTier.set(record.tier, record);
    });
    return RECON_FALLBACK_DETAIL.map(function (fallback, tier) {
      const record = byTier.get(tier) || null;
      return {
        tier: tier,
        label: RECON_LABELS[tier],
        detail: record ? format(strings, record.detailKey, fallback, {}) : fallback,
      };
    });
  }

  function unlockCatalog(missionIds) {
    const unlocks = Object.create(null);
    missionIds.forEach(function (missionId) {
      Progression.getMissionFirstClearGrantBundle(missionId).firstVictoryGrantIds.forEach(function (grantId) {
        const described = describeGrant(grantId);
        unlocks[grantId] = {
          id: grantId,
          order: missionNumber(missionId),
          category: described.category,
          name: described.text.length > 96 ? described.text.slice(0, 96) : described.text,
          description: "Awarded for your first victory on mission " + missionNumber(missionId) + ".",
          sourceMissionId: missionId,
        };
      });
    });
    return unlocks;
  }

  function createCatalog(callerInput) {
    const input = callerInput || {};
    const content = input.content;
    if (!content || typeof content !== "object") throw new TypeError("The shell catalog requires compiled content");
    if (!isPlainObject(content.missions)) throw new TypeError("Compiled content requires a mission collection");
    const strings = presentationStrings(input.presentation);
    const scales = {
      distance: Number.isSafeInteger(input.distanceScale) && input.distanceScale > 0 ? input.distanceScale : 1000,
      damage: Number.isSafeInteger(input.damageScale) && input.damageScale > 0 ? input.damageScale : 1000,
    };
    const knownOrder = Profile.MISSION_IDS;
    const missionIds = Object.keys(content.missions).filter(function (missionId) {
      return knownOrder.indexOf(missionId) !== -1;
    }).sort(function (left, right) {
      return knownOrder.indexOf(left) - knownOrder.indexOf(right);
    });
    if (!missionIds.length) throw new RangeError("The shell catalog requires at least one campaign mission");
    const missions = missionCatalog(content, strings, missionIds);
    const difficulties = (content.campaignRules && content.campaignRules.difficultyPresets
      ? content.campaignRules.difficultyPresets : []).map(function (preset) {
      return {
        id: preset.id,
        label: DIFFICULTY_LABELS[preset.id] || titleCase(preset.id),
        summary: DIFFICULTY_SUMMARIES[preset.id] || "",
        startAetherBp: preset.startAetherBp,
        integrity: preset.integrity,
        enemyHpBp: preset.enemyHpBp,
        enemySpeedBp: preset.enemySpeedBp,
        bountyBp: preset.bountyBp,
        scoreBp: preset.scoreBp,
      };
    });
    return deepFreeze({
      schemaVersion: VERSION,
      contentSchemaVersion: content.schemaVersion,
      contentVersion: content.contentVersion,
      abiVersion: content.schemaVersion === 4 ? 2 : 1,
      missionIds: missionIds,
      missions: missions,
      acts: actCatalog(missionIds, missions, strings, content),
      reconTiers: reconCatalog(content, strings),
      difficulties: difficulties,
      defenses: defenseCatalog(content, strings, scales),
      protocols: protocolCatalog(content, strings),
      relics: relicCatalog(content, strings),
      reinforcements: reinforcementCatalog(content, strings),
      unlocks: unlockCatalog(missionIds),
      enemies: normalizeCollection(content.enemies, function (record, id) {
        return {
          id: id,
          name: text(strings, record.nameKey, titleCase(id)),
          routeKinds: (record.routeKinds || []).slice().sort(asciiCompare),
          traits: traitIds(record),
          tags: (record.tags || []).slice().sort(asciiCompare),
          resistances: resistanceIds(record),
        };
      }),
      bosses: normalizeCollection(content.bosses, function (record, id) {
        return {
          id: id,
          name: text(strings, record.nameKey, titleCase(id)),
          description: text(strings, record.descriptionKey, ""),
          routeKinds: (record.routeKinds || ["ground"]).slice().sort(asciiCompare),
          traits: traitIds(record),
          tags: (record.tags || []).slice().sort(asciiCompare),
          resistances: resistanceIds(record),
          phases: (record.phaseRecords || []).slice().sort(function (a, b) { return a.order - b.order; })
            .map(function (phase) {
              return {
                id: phase.id,
                name: titleCase(phase.id),
                fromPercent: Math.round(phase.hpLowerInclusiveBp / 100),
                toPercent: Math.round(phase.hpUpperInclusiveBp / 100),
              };
            }),
        };
      }),
      strings: strings,
    });
  }

  /* ------------------------------------------------------------------- state */

  function normalizeSettings(value) {
    const source = isPlainObject(value) ? value : {};
    return deepFreeze({
      reducedMotion: source.reducedMotion === true,
      photosensitiveSafe: source.photosensitiveSafe === true,
      bindings: KeyBindings.normalizeBindings(source.bindings),
    });
  }

  function defaultDifficulty(catalog) {
    const preferred = catalog.difficulties.find(function (record) { return record.id === "strategos"; });
    return preferred ? preferred.id : (catalog.difficulties[0] && catalog.difficulties[0].id) || "strategos";
  }

  function createInitialState(callerInput) {
    const input = callerInput || {};
    const catalog = input.catalog;
    if (!catalog || !catalog.missionIds) throw new TypeError("The shell requires a catalog");
    return deepFreeze({
      screen: "title",
      mode: "campaign",
      missionId: null,
      difficultyId: defaultDifficulty(catalog),
      assist: false,
      seed: Number.isSafeInteger(input.seed) ? input.seed : 1,
      loadoutIds: [],
      runHeader: null,
      result: null,
      notice: null,
      previousScreen: null,
      settings: normalizeSettings(input.settings),
      storageKind: input.storageKind === "durable" ? "durable" : "session",
      debug: input.debug === true,
    });
  }

  function withState(state, patch) {
    const next = {};
    STATE_FIELDS.forEach(function (key) {
      next[key] = hasOwn(patch, key) ? patch[key] : state[key];
    });
    return deepFreeze(next);
  }

  function accepted(state) {
    return deepFreeze({ ok: true, state: state, reasonCode: null, reason: null });
  }

  function refused(state, reasonCode, detail) {
    return deepFreeze({
      ok: false,
      state: state,
      reasonCode: reasonCode,
      reason: detail || REASONS[reasonCode] || "That action is not available.",
    });
  }

  /* -------------------------------------------------------------- unlock rules */

  function laurelCount(profile, missionId, difficultyId) {
    const prefix = missionId + ":" + difficultyId + ":";
    return profile.earnedLaurelIds.filter(function (id) { return id.indexOf(prefix) === 0; }).length;
  }

  function bestLaurels(profile, missionId, catalog) {
    return catalog.difficulties.reduce(function (best, difficulty) {
      return Math.max(best, laurelCount(profile, missionId, difficulty.id));
    }, 0);
  }

  /* Linear campaign unlock. The canonical rule is the profile's own linear
     prerequisite; when a build ships only part of the campaign, the nearest
     earlier shipped mission stands in so a partial release is still honest
     rather than permanently locked. */
  function prerequisiteMissionId(catalog, missionId) {
    const canonical = Profile.getMissionPrerequisiteId(missionId);
    if (canonical === null) return null;
    if (catalog.missionIds.indexOf(canonical) !== -1) return canonical;
    const index = catalog.missionIds.indexOf(missionId);
    return index > 0 ? catalog.missionIds[index - 1] : null;
  }

  function missionStatus(catalog, profile, missionId) {
    const completed = profile.completedMissionIds.indexOf(missionId) !== -1;
    const prerequisite = prerequisiteMissionId(catalog, missionId);
    const unlocked = prerequisite === null || profile.completedMissionIds.indexOf(prerequisite) !== -1;
    if (completed) return { status: "completed", unlocked: true, prerequisiteMissionId: prerequisite, lockReason: null };
    if (!unlocked) {
      return {
        status: "locked",
        unlocked: false,
        prerequisiteMissionId: prerequisite,
        lockReason: "Win " + catalog.missions[prerequisite].title + " first.",
      };
    }
    return { status: "current", unlocked: true, prerequisiteMissionId: prerequisite, lockReason: null };
  }

  function actCleared(catalog, profile, actIndex) {
    const act = catalog.acts.find(function (record) { return record.index === actIndex; });
    if (!act) return false;
    return act.missionIds.every(function (missionId) {
      return profile.completedMissionIds.indexOf(missionId) !== -1;
    });
  }

  /* Campaign spec 7.2: Titan becomes available after clearing an act. */
  function difficultyAvailability(catalog, profile, missionId, difficultyId, mode) {
    if (difficultyId !== "titan") return { available: true, reason: null };
    if (mode === "training") return { available: true, reason: null };
    if (missionId === null) return { available: false, reason: REASONS["mission-required"] };
    const actIndex = catalog.missions[missionId].actIndex;
    if (actCleared(catalog, profile, actIndex)) return { available: true, reason: null };
    const act = catalog.acts.find(function (record) { return record.index === actIndex; });
    return {
      available: false,
      reason: "Clear every mission in " + (act ? act.title : "this act") + " to unlock Titan.",
    };
  }

  function nextUnlockRibbon(catalog, profile) {
    const pending = catalog.missionIds.find(function (missionId) {
      return profile.completedMissionIds.indexOf(missionId) === -1;
    });
    if (!pending) {
      return { missionId: null, missionTitle: null, rewards: [], text: "Every mission in this build is complete." };
    }
    const mission = catalog.missions[pending];
    const rewards = mission.firstClearRewards.slice();
    return {
      missionId: pending,
      missionTitle: mission.title,
      rewards: rewards,
      text: rewards.length
        ? "Next unlock, after " + mission.title + ": " + rewards.map(function (r) { return r.text; }).join("; ")
        : "Next mission: " + mission.title,
    };
  }

  function validateLoadout(catalog, profile, missionId, loadoutIds, mode) {
    if (!Array.isArray(loadoutIds)) return { ok: false, reasonCode: "loadout-empty" };
    if (loadoutIds.length === 0) return { ok: false, reasonCode: "loadout-empty" };
    const slotCap = mode === "training" ? 6 : profile.defenseSlotCap;
    if (loadoutIds.length > slotCap) return { ok: false, reasonCode: "loadout-over-cap" };
    if (new Set(loadoutIds).size !== loadoutIds.length) return { ok: false, reasonCode: "loadout-duplicate" };
    const mission = missionId === null ? null : catalog.missions[missionId];
    const granted = new Set(mode === "training" ? Object.keys(catalog.defenses) : profile.defenseGrantIds);
    const offered = mission ? new Set(mission.availableDefenseIds) : null;
    const bad = loadoutIds.find(function (id) {
      if (!hasOwn(catalog.defenses, id)) return true;
      if (!granted.has(id)) return true;
      return Boolean(offered && !offered.has(id));
    });
    if (bad) return { ok: false, reasonCode: "loadout-unavailable", detail: "That defense is not available on this mission yet." };
    return { ok: true, reasonCode: null };
  }

  /* -------------------------------------------------------------- transitions */

  function canReach(fromScreen, toScreen) {
    const allowed = TRANSITIONS[fromScreen];
    return Boolean(allowed && allowed.indexOf(toScreen) !== -1);
  }

  function transition(context, action) {
    const catalog = context && context.catalog;
    const profile = context && context.profile;
    const state = context && context.state;
    if (!catalog || !profile || !state) throw new TypeError("A shell transition requires catalog, profile, and state");
    if (!isPlainObject(action) || typeof action.type !== "string") {
      throw new TypeError("A shell action must be a plain object with a type");
    }
    switch (action.type) {
      case "navigate": {
        if (SCREENS.indexOf(action.screen) === -1) return refused(state, "screen-unknown");
        if (!canReach(state.screen, action.screen)) return refused(state, "screen-transition-not-allowed");
        if (action.screen === "loadout") return refused(state, "screen-transition-not-allowed");
        if (action.screen === "battle" || action.screen === "result") {
          return refused(state, "screen-transition-not-allowed");
        }
        const mode = action.screen === "training" ? "training"
          : (action.screen === "campaign" ? "campaign" : state.mode);
        return accepted(withState(state, {
          screen: action.screen,
          mode: mode,
          previousScreen: state.screen,
          notice: null,
        }));
      }
      case "back": {
        if (state.screen === "title") return refused(state, "screen-transition-not-allowed");
        const target = HUB_SCREENS.indexOf(state.screen) !== -1 ? "title"
          : (state.screen === "briefing" ? "loadout" : state.mode);
        if (!canReach(state.screen, target)) return refused(state, "screen-transition-not-allowed");
        const leavingRun = target !== "briefing" && target !== "battle";
        /* Going back never records a new forward step, so Back cannot ping-pong. */
        return accepted(withState(state, {
          screen: target,
          previousScreen: null,
          notice: null,
          runHeader: leavingRun ? null : state.runHeader,
          result: HUB_SCREENS.indexOf(target) !== -1 ? null : state.result,
        }));
      }
      case "selectMission": {
        if (state.screen !== "campaign" && state.screen !== "training") {
          return refused(state, "screen-transition-not-allowed");
        }
        if (!hasOwn(catalog.missions, action.missionId)) return refused(state, "mission-unknown");
        const status = missionStatus(catalog, profile, action.missionId);
        if (state.mode === "campaign" && !status.unlocked) {
          return refused(state, "mission-locked", status.lockReason);
        }
        const mission = catalog.missions[action.missionId];
        const preserved = state.loadoutIds.filter(function (id) {
          return mission.availableDefenseIds.indexOf(id) !== -1 &&
            (state.mode === "training" || profile.defenseGrantIds.indexOf(id) !== -1);
        });
        const slotCap = state.mode === "training" ? 6 : profile.defenseSlotCap;
        const fallbackIds = mission.availableDefenseIds.filter(function (id) {
          return state.mode === "training" || profile.defenseGrantIds.indexOf(id) !== -1;
        }).slice(0, slotCap);
        const availability = difficultyAvailability(
          catalog, profile, action.missionId, state.difficultyId, state.mode
        );
        return accepted(withState(state, {
          screen: "loadout",
          missionId: action.missionId,
          difficultyId: availability.available ? state.difficultyId : defaultDifficulty(catalog),
          loadoutIds: (preserved.length ? preserved : fallbackIds).slice(0, slotCap),
          runHeader: null,
          result: null,
          previousScreen: state.screen,
          notice: null,
        }));
      }
      case "setDifficulty": {
        if (catalog.difficulties.every(function (record) { return record.id !== action.difficultyId; })) {
          return refused(state, "difficulty-unknown");
        }
        const availability = difficultyAvailability(
          catalog, profile, state.missionId, action.difficultyId, state.mode
        );
        if (!availability.available) return refused(state, "difficulty-locked", availability.reason);
        if (state.runHeader) return refused(state, "run-already-started");
        return accepted(withState(state, { difficultyId: action.difficultyId, notice: null }));
      }
      case "setAssist": {
        if (typeof action.assist !== "boolean") return refused(state, "action-unknown");
        if (state.runHeader) return refused(state, "run-already-started");
        return accepted(withState(state, { assist: action.assist, notice: null }));
      }
      case "setSeed": {
        if (!Number.isSafeInteger(action.seed) || action.seed < 0 || action.seed > MAX_UINT32) {
          return refused(state, "seed-invalid");
        }
        if (state.runHeader) return refused(state, "run-already-started");
        return accepted(withState(state, { seed: action.seed, notice: null }));
      }
      case "setLoadout": {
        if (state.screen !== "loadout") return refused(state, "screen-transition-not-allowed");
        if (state.runHeader) return refused(state, "run-already-started");
        const check = validateLoadout(catalog, profile, state.missionId, action.loadoutIds, state.mode);
        if (!check.ok) return refused(state, check.reasonCode, check.detail);
        return accepted(withState(state, { loadoutIds: action.loadoutIds.slice(), notice: null }));
      }
      case "openBriefing": {
        if (state.screen !== "loadout") return refused(state, "screen-transition-not-allowed");
        if (state.missionId === null) return refused(state, "mission-required");
        const check = validateLoadout(catalog, profile, state.missionId, state.loadoutIds, state.mode);
        if (!check.ok) return refused(state, check.reasonCode, check.detail);
        return accepted(withState(state, {
          screen: "briefing", previousScreen: "loadout", runHeader: null, notice: null,
        }));
      }
      case "startRun": {
        if (state.screen !== "briefing") return refused(state, "screen-transition-not-allowed");
        if (state.runHeader) return refused(state, "run-already-started");
        if (!isPlainObject(action.header) ||
            (action.header.formatVersion !== 1 && action.header.formatVersion !== 2)) {
          return refused(state, "run-header-required");
        }
        if (action.header.missionId !== state.missionId ||
            action.header.difficultyId !== state.difficultyId ||
            action.header.assist !== state.assist ||
            action.header.seed !== state.seed) {
          return refused(state, "run-header-required",
            "The mission start state does not match the choices on this screen.");
        }
        return accepted(withState(state, {
          screen: "battle",
          previousScreen: "briefing",
          runHeader: deepFreeze(action.header),
          result: null,
          notice: null,
        }));
      }
      case "finishRun": {
        if (state.screen !== "battle") return refused(state, "screen-transition-not-allowed");
        if (!state.runHeader) return refused(state, "run-not-started");
        if (!isPlainObject(action.result)) return refused(state, "result-required");
        return accepted(withState(state, {
          screen: "result",
          previousScreen: "battle",
          result: deepFreeze(action.result),
          notice: null,
        }));
      }
      case "abandonRun": {
        if (state.screen !== "battle") return refused(state, "screen-transition-not-allowed");
        return accepted(withState(state, {
          screen: state.mode, previousScreen: "battle", runHeader: null, result: null, notice: null,
        }));
      }
      case "continue": {
        if (state.screen !== "result") return refused(state, "screen-transition-not-allowed");
        return accepted(withState(state, {
          screen: state.mode, previousScreen: "result", runHeader: null, result: null, notice: null,
        }));
      }
      case "retry": {
        if (state.screen !== "result") return refused(state, "screen-transition-not-allowed");
        return accepted(withState(state, {
          screen: "loadout", previousScreen: "result", runHeader: null, result: null, notice: null,
        }));
      }
      case "setNotice": {
        return accepted(withState(state, {
          notice: action.notice === null || action.notice === undefined ? null : deepFreeze(action.notice),
        }));
      }
      case "dismissNotice":
        return accepted(withState(state, { notice: null }));
      case "setStorageKind": {
        if (action.storageKind !== "durable" && action.storageKind !== "session") {
          return refused(state, "action-unknown");
        }
        return accepted(withState(state, { storageKind: action.storageKind }));
      }
      case "setSetting": {
        if (action.key !== "reducedMotion" && action.key !== "photosensitiveSafe") {
          return refused(state, "setting-unknown");
        }
        if (typeof action.value !== "boolean") return refused(state, "setting-unknown");
        const settings = {};
        SETTINGS_FIELDS.forEach(function (key) { settings[key] = state.settings[key]; });
        settings[action.key] = action.value;
        return accepted(withState(state, { settings: deepFreeze(settings) }));
      }
      case "rebindKey": {
        const plan = KeyBindings.planRebind(state.settings.bindings, action.actionId, action.key);
        if (!plan.ok) return refused(state, "binding-refused", plan.reason);
        const settings = {};
        SETTINGS_FIELDS.forEach(function (key) { settings[key] = state.settings[key]; });
        settings.bindings = plan.bindings;
        return accepted(withState(state, { settings: deepFreeze(settings) }));
      }
      default:
        return refused(state, "action-unknown");
    }
  }

  /* ---------------------------------------------------------- loadout planning */

  /* Every persistent loadout edit goes through a Progression planner so the
     profile is replaced, never mutated, and every repair is reported. */
  function planLoadoutEdit(profile, edit) {
    if (!isPlainObject(edit) || typeof edit.kind !== "string") {
      throw new TypeError("A loadout edit must be a plain object with a kind");
    }
    try {
      switch (edit.kind) {
        case "setProtocolLoadout": {
          const plan = Progression.planSetProtocolLoadout(profile, edit.loadout);
          return deepFreeze({ ok: true, kind: edit.kind, profile: plan.profile, changed: plan.changed, notes: [] });
        }
        case "clearProtocols": {
          const plan = Progression.planSetProtocolLoadout(profile, []);
          return deepFreeze({ ok: true, kind: edit.kind, profile: plan.profile, changed: plan.changed, notes: [] });
        }
        case "setRelicLoadout": {
          const plan = Progression.planSetRelicLoadout(profile, edit.relicIds);
          return deepFreeze({ ok: true, kind: edit.kind, profile: plan.profile, changed: plan.changed, notes: [] });
        }
        case "clearRelics": {
          const plan = Progression.planSetRelicLoadout(profile, []);
          return deepFreeze({ ok: true, kind: edit.kind, profile: plan.profile, changed: plan.changed, notes: [] });
        }
        case "setReinforcement": {
          const plan = Progression.planSetReinforcementLoadout(profile, edit.reinforcementId);
          return deepFreeze({ ok: true, kind: edit.kind, profile: plan.profile, changed: plan.changed, notes: [] });
        }
        case "clearReinforcement": {
          const plan = Progression.planSetReinforcementLoadout(profile, null);
          return deepFreeze({ ok: true, kind: edit.kind, profile: plan.profile, changed: plan.changed, notes: [] });
        }
        case "allocateProtocolTier": {
          const plan = Progression.planAllocateProtocolTier(profile, edit.protocolId);
          return deepFreeze({
            ok: true, kind: edit.kind, profile: plan.profile, changed: plan.changed,
            notes: [titleCase(plan.protocolId) + " Tier " + plan.toTier + " unlocked for "
              + plan.allocated + " Laurels."],
          });
        }
        case "refundProtocolTier": {
          const plan = Progression.planRefundProtocolTier(profile, edit.protocolId);
          const notes = [titleCase(plan.protocolId) + " returned to Tier " + plan.toTier + ". "
            + plan.refunded + " Laurels are available again."];
          plan.loadoutRepairs.forEach(function (repair) {
            notes.push("Equipped " + titleCase(repair.protocolId) + " in slot " + (repair.slot + 1)
              + " dropped from Tier " + repair.fromTier + " to Tier " + repair.toTier + ".");
          });
          return deepFreeze({
            ok: true, kind: edit.kind, profile: plan.profile, changed: plan.changed, notes: notes,
          });
        }
        default:
          return deepFreeze({
            ok: false, kind: edit.kind, profile: profile, changed: false,
            reason: REASONS["action-unknown"], notes: [],
          });
      }
    } catch (error) {
      return deepFreeze({
        ok: false,
        kind: edit.kind,
        profile: profile,
        changed: false,
        reason: String(error && error.message ? error.message : error),
        notes: [],
      });
    }
  }

  /* ---------------------------------------------------------------- selectors */

  function selectTitleScreen(context) {
    const catalog = context.catalog;
    const profile = context.profile;
    const state = context.state;
    const completed = profile.completedMissionIds.length;
    const nextMission = catalog.missionIds.find(function (missionId) {
      return profile.completedMissionIds.indexOf(missionId) === -1;
    }) || catalog.missionIds[catalog.missionIds.length - 1];
    const laurels = Profile.getLaurelBudget(profile);
    return deepFreeze({
      screen: "title",
      heading: "ARMARA AEGIS",
      subheading: "Hold the gate. Spend Aether. Earn Laurels.",
      continueMissionId: nextMission,
      continueLabel: "Continue: " + catalog.missions[nextMission].title,
      progressText: completed + " of " + catalog.missionIds.length + " missions complete",
      laurels: laurels,
      laurelText: laurels.earned === 0
        ? "No Laurels earned yet. Each mission objective is worth one."
        : laurels.available + " of " + laurels.earned + " Laurels unspent",
      nextUnlock: nextUnlockRibbon(catalog, profile),
      storageKind: state.storageKind,
      destinations: HUB_SCREENS.map(function (screen) {
        return {
          screen: screen,
          label: screen === "campaign" ? "Campaign"
            : (screen === "training" ? "Training Courtyard"
              : (screen === "codex" ? "Codex" : "Settings")),
          minimumTargetSizePx: PlayerUi.PRIMARY_TARGET_SIZE_PX,
        };
      }),
    });
  }

  function selectCampaignScreen(context) {
    const catalog = context.catalog;
    const profile = context.profile;
    const state = context.state;
    const training = state.mode === "training";
    return deepFreeze({
      screen: training ? "training" : "campaign",
      mode: state.mode,
      heading: training ? "Training Courtyard" : "Campaign",
      subheading: training
        ? "Trial every defense. Nothing here changes your campaign progress, rewards, or records."
        : catalog.missionIds.length + (catalog.missionIds.length === 1 ? " mission in " : " missions in ")
          + catalog.acts.length + (catalog.acts.length === 1 ? " act." : " acts.")
          + " Each first victory unlocks something permanent.",
      acts: catalog.acts.map(function (act) {
        return {
          index: act.index,
          title: act.title,
          era: act.era,
          story: act.story,
          premise: act.premise,
          cleared: actCleared(catalog, profile, act.index),
          missions: act.missionIds.map(function (missionId) {
            const mission = catalog.missions[missionId];
            const status = missionStatus(catalog, profile, missionId);
            const laurels = catalog.difficulties.map(function (difficulty) {
              return {
                difficultyId: difficulty.id,
                label: difficulty.label,
                laurels: laurelCount(profile, missionId, difficulty.id),
                maximum: mission.objectives.length,
              };
            });
            return {
              missionId: missionId,
              number: mission.number,
              title: mission.title,
              summary: mission.summary,
              environmentLabel: mission.environmentLabel,
              waveCount: mission.waveCount,
              status: training ? "current" : status.status,
              selectable: training || status.unlocked,
              lockReason: training ? null : status.lockReason,
              bestLaurels: bestLaurels(profile, missionId, catalog),
              maximumLaurels: mission.objectives.length,
              laurelsByDifficulty: laurels,
              rewards: mission.firstClearRewards,
              minimumTargetSizePx: PlayerUi.PRIMARY_TARGET_SIZE_PX,
              ariaLabel: "Mission " + mission.number + ", " + mission.title + ". "
                + (training ? "Trial run." : (status.status === "locked" ? status.lockReason
                  : (status.status === "completed" ? "Completed." : "Ready to play.")))
                + " Best Laurels " + bestLaurels(profile, missionId, catalog)
                + " of " + mission.objectives.length + ".",
            };
          }),
        };
      }),
      nextUnlock: nextUnlockRibbon(catalog, profile),
      laurels: Profile.getLaurelBudget(profile),
    });
  }

  function selectDifficultyOptions(context) {
    const catalog = context.catalog;
    const profile = context.profile;
    const state = context.state;
    return deepFreeze(catalog.difficulties.map(function (difficulty) {
      const availability = difficultyAvailability(
        catalog, profile, state.missionId, difficulty.id, state.mode
      );
      return {
        id: difficulty.id,
        label: difficulty.label,
        summary: difficulty.summary,
        selected: state.difficultyId === difficulty.id,
        available: availability.available,
        lockReason: availability.reason,
        startAetherPercent: Math.round(difficulty.startAetherBp / 100),
        gateHealth: difficulty.integrity,
        enemyHealthPercent: Math.round(difficulty.enemyHpBp / 100),
        enemySpeedPercent: Math.round(difficulty.enemySpeedBp / 100),
        scorePercent: Math.round(difficulty.scoreBp / 100),
        minimumTargetSizePx: PlayerUi.SECONDARY_TARGET_SIZE_PX,
        ariaLabel: difficulty.label + ". Starting Aether " + Math.round(difficulty.startAetherBp / 100)
          + " percent, Gate Health " + difficulty.integrity + ", enemy health "
          + Math.round(difficulty.enemyHpBp / 100) + " percent, score "
          + Math.round(difficulty.scoreBp / 100) + " percent."
          + (availability.available ? "" : " Locked. " + availability.reason),
      };
    }));
  }

  function protocolTierPanel(catalog, profile) {
    const budget = Profile.getLaurelBudget(profile);
    return profile.protocols.map(function (record) {
      const entry = catalog.protocols[record.id] || null;
      const tiers = entry ? entry.tiers : [];
      const nextTier = record.availableTier + 1;
      const nextCost = Progression.PROTOCOL_TIER_INCREMENT_COSTS[nextTier];
      const equipped = profile.protocolLoadout.find(function (slot) { return slot.protocolId === record.id; }) || null;
      const nextRecord = tiers.find(function (tier) { return tier.tier === nextTier; }) || null;
      const currentRecord = tiers.find(function (tier) { return tier.tier === record.availableTier; }) || null;
      return {
        protocolId: record.id,
        name: entry ? entry.name : titleCase(record.id),
        granted: record.granted,
        availableTier: record.availableTier,
        allocatedLaurels: record.allocatedLaurels,
        equippedSlot: equipped ? equipped.slot : null,
        equippedTier: equipped ? equipped.tier : null,
        currentCostAether: currentRecord ? currentRecord.baseCostAether : null,
        currentEffectText: currentRecord ? currentRecord.effectText : null,
        canAllocate: record.granted && record.availableTier < 3 &&
          Number.isSafeInteger(nextCost) && budget.available >= nextCost,
        allocateCostLaurels: record.availableTier < 3 && Number.isSafeInteger(nextCost) ? nextCost : null,
        allocatePreview: nextRecord
          ? "Tier " + nextTier + ": " + nextRecord.baseCostAether + " Aether per cast. " + nextRecord.effectText
          : null,
        canRefund: record.granted && record.availableTier > 1,
        refundLaurels: record.availableTier > 1
          ? Progression.PROTOCOL_TIER_INCREMENT_COSTS[record.availableTier] : null,
        refundWarning: equipped && record.availableTier > 1 && equipped.tier === record.availableTier
          ? "Refunding lowers your equipped " + (entry ? entry.name : titleCase(record.id))
            + " to Tier " + (record.availableTier - 1) + "."
          : null,
        lockReason: record.granted ? null : "Win the mission that grants this Divine Protocol.",
        minimumTargetSizePx: PlayerUi.SECONDARY_TARGET_SIZE_PX,
      };
    });
  }

  function selectLoadoutScreen(context) {
    const catalog = context.catalog;
    const profile = context.profile;
    const state = context.state;
    const training = state.mode === "training";
    const mission = state.missionId === null ? null : catalog.missions[state.missionId];
    const slotCap = training ? 6 : profile.defenseSlotCap;
    const grantedDefenses = new Set(training ? Object.keys(catalog.defenses) : profile.defenseGrantIds);
    const offered = mission ? mission.availableDefenseIds : Object.keys(catalog.defenses);
    const equipped = state.loadoutIds.slice();
    const towerCards = offered.map(function (defenseId) {
      const defense = catalog.defenses[defenseId];
      const unlocked = grantedDefenses.has(defenseId);
      const index = equipped.indexOf(defenseId);
      return {
        id: defenseId,
        name: defense ? defense.name : titleCase(defenseId),
        roleText: defense ? defense.roleText : "",
        weaknessText: defense ? defense.weaknessText : "",
        costAether: defense ? defense.costAether : null,
        rangeWorldUnits: defense ? defense.rangeWorldUnits : null,
        targetKinds: defense ? defense.targetKinds : [],
        status: index !== -1 ? "equipped" : (unlocked ? "available" : "locked"),
        equippedSlot: index === -1 ? null : index + 1,
        inspectable: true,
        lockReason: unlocked ? null : "Unlocked by a later campaign victory.",
        minimumTargetSizePx: PlayerUi.SECONDARY_TARGET_SIZE_PX,
        ariaLabel: (defense ? defense.name : titleCase(defenseId)) + ", "
          + (defense && defense.costAether !== null ? defense.costAether + " Aether to build. " : "")
          + (index !== -1 ? "Equipped in slot " + (index + 1) + "."
            : (unlocked ? "Available to equip." : "Locked. Unlocked by a later campaign victory.")),
      };
    });

    const relicState = {
      slotCap: training ? Math.min(2, Math.max(profile.relicSlotCap, 0)) : profile.relicSlotCap,
      unlockedIds: profile.relics.filter(function (r) { return r.granted; }).map(function (r) { return r.id; })
        .filter(function (id) { return hasOwn(catalog.relics, id); }),
      equippedIds: profile.relicLoadoutIds.filter(function (id) { return hasOwn(catalog.relics, id); }),
      slotUnlockSource: "First Relic slot after mission 6; second after mission 15.",
    };
    let relicCards = [];
    try {
      relicCards = PlayerUi.createRelicCards({
        content: { relics: catalog.relics },
        state: relicState,
      });
    } catch (error) {
      relicCards = [];
    }

    const loadoutModel = PlayerUi.createLoadoutModel({
      towers: {
        slotCap: slotCap,
        equippedIds: equipped,
        unlockSource: "Campaign victories add slots after mission 5 and mission 10.",
      },
      protocols: {
        slotCap: profile.protocolSlotCap,
        equippedIds: profile.protocolLoadout.map(function (entry) { return entry.protocolId; }),
        unlockSource: "First slot after mission 5; second after mission 10.",
      },
      relics: {
        slotCap: relicState.slotCap,
        equippedIds: relicState.equippedIds,
        unlockSource: relicState.slotUnlockSource,
      },
      reinforcement: {
        slotCap: profile.reinforcementSlotCap,
        equippedIds: profile.reinforcementId === null ? [] : [profile.reinforcementId],
        unlockSource: "Unlocked by the mission 9 victory.",
      },
    });

    const check = validateLoadout(catalog, profile, state.missionId, equipped, state.mode);
    return deepFreeze({
      screen: "loadout",
      mode: state.mode,
      missionId: state.missionId,
      missionTitle: mission ? mission.title : null,
      heading: mission ? "Loadout - " + mission.title : "Loadout",
      trial: training,
      trialNotice: training
        ? "Trial loadout. Training never changes campaign progress, rewards, or records."
        : null,
      sections: loadoutModel.sections,
      towers: towerCards,
      protocols: protocolTierPanel(catalog, profile),
      relics: relicCards,
      reinforcements: Object.keys(catalog.reinforcements).map(function (id) {
        const record = catalog.reinforcements[id];
        const granted = profile.reinforcements.some(function (entry) {
          return entry.id === id && entry.granted;
        });
        return {
          id: id,
          name: record.name,
          roleText: record.roleText,
          costAether: record.costAether,
          cooldownSeconds: Math.round(record.cooldownMs / 1000),
          lifetimeSeconds: Math.round(record.lifetimeMs / 1000),
          status: profile.reinforcementId === id ? "equipped" : (granted ? "available" : "locked"),
          inspectable: true,
          lockReason: granted ? null : "Unlocked by a later campaign victory.",
          minimumTargetSizePx: PlayerUi.SECONDARY_TARGET_SIZE_PX,
        };
      }),
      laurels: Profile.getLaurelBudget(profile),
      difficulties: selectDifficultyOptions(context),
      assist: state.assist,
      assistText: "Assist adds 20 starting Aether and slows enemies by 8%. "
        + "It keeps campaign unlocks and Laurels and is recorded on the result.",
      seed: state.seed,
      ready: check.ok,
      readyReason: check.ok ? null : (REASONS[check.reasonCode] || "Fix the loadout to continue."),
      startLabel: "Read the briefing",
    });
  }

  /* ------------------------------------------------------------ wave previews */

  function relativeSize(count, maximum) {
    if (maximum <= 0) return "small group";
    const share = count / maximum;
    if (share <= 1 / 3) return "small group";
    if (share <= 2 / 3) return "medium group";
    return "large group";
  }

  /* Authored route names win. The fallback stays lowercase so it reads inside a sentence
     ("on the north route") instead of shouting a runtime identifier at the player. */
  function routeLabel(catalog, missionId, routeId) {
    const key = "route." + missionId + "." + String(routeId);
    const derived = String(routeId).replace(/^route\./, "").replace(/[-_.]+/g, " ").trim();
    return text(catalog.strings, key, derived ? "the " + derived + " route" : "the route");
  }

  /* Spec 18.3: a wave preview describes each group as one readable sentence, never a field
     dump. Redundant qualifiers are omitted, so ground movement is silent, a route is named
     only when the mission has more than one, and timing appears only where Recon reveals it. */
  const QUANTITY_WORDS = Object.freeze({
    "small group": "A few",
    "medium group": "A group of",
    "large group": "A large group of",
  });
  const TRAIT_WORDS = Object.freeze({
    armor: "armored",
    cloak: "cloaked",
    flight: "airborne",
    shield: "shielded",
  });
  const AIRBORNE_TRAITS = Object.freeze(["airborne", "flight", "flying"]);

  function pluralName(name, count) {
    const value = String(name);
    if (count === 1) return value;
    if (/(?:s|x|z|ch|sh)$/i.test(value)) return value + "es";
    if (/[^aeiouAEIOU]y$/.test(value)) return value.slice(0, -1) + "ies";
    /* Echo becomes Echoes, matching the authored wave copy. */
    if (/[^aeiouAEIOU]o$/.test(value)) return value + "es";
    return value + "s";
  }

  function traitWord(trait) {
    const id = String(trait);
    return hasOwn(TRAIT_WORDS, id) ? TRAIT_WORDS[id] : id.replace(/[-_.]/g, " ");
  }

  /* Arriving with the wave is the default, so only a later group says when it comes. Whole
     seconds only: a tick count never reaches a player (spec 18.3). */
  function arrivalText(second) {
    if (second === null || second <= 0) return "";
    return "arriving about " + second + (second === 1 ? " second in" : " seconds in");
  }

  function groupSentence(group, namedRoutes) {
    let sentence;
    if (group.isBoss) {
      sentence = group.unitName;
    } else if (group.exactCount !== null) {
      sentence = group.exactCount + " " + pluralName(group.unitName, group.exactCount);
    } else {
      sentence = (QUANTITY_WORDS[group.relativeSize] || "A group of")
        + " " + pluralName(group.unitName, 2);
    }
    const airborne = group.movement === "air";
    if (airborne) sentence += ", airborne";
    if (namedRoutes) sentence += " on " + group.routeLabel;
    const qualifiers = group.traits.filter(function (trait) {
      return !airborne || AIRBORNE_TRAITS.indexOf(String(trait)) === -1;
    }).map(traitWord);
    if (group.resistances.length) {
      qualifiers.push("resists " + group.resistances.join(" and "));
    }
    if (qualifiers.length) sentence += " (" + qualifiers.join(", ") + ")";
    if (group.arrival) sentence += ", " + group.arrival;
    return sentence + ".";
  }

  /* Recon reads immutable compiled waves and never enters simulation state.
     Baseline always shows route labels, enemy types and traits, air/ground,
     hazards, boss phase rules, and relative group size (spec 11.1). */
  function selectWavePreview(callerInput) {
    const catalog = callerInput.catalog;
    const missionId = callerInput.missionId;
    const waves = callerInput.waves;
    const reconTier = Math.max(0, Math.min(3, Number.isSafeInteger(callerInput.reconTier) ? callerInput.reconTier : 0));
    const ticksPerSecond = Number.isSafeInteger(callerInput.ticksPerSecond) && callerInput.ticksPerSecond > 0
      ? callerInput.ticksPerSecond : 60;
    if (!Array.isArray(waves)) throw new TypeError("A wave preview requires the compiled wave list");
    let maximumCount = 0;
    waves.forEach(function (wave) {
      (wave.groups || []).forEach(function (group) {
        if (Number.isSafeInteger(group.count) && group.count > maximumCount) maximumCount = group.count;
      });
    });
    const horizon = reconTier === 0 ? 0 : (reconTier === 1 ? 1 : (reconTier === 2 ? 2 : waves.length));
    const missionRouteIds = new Set();
    waves.forEach(function (wave) {
      (wave.groups || []).forEach(function (group) { missionRouteIds.add(String(group.routeId)); });
    });
    const namedRoutes = missionRouteIds.size > 1;
    const reconRecord = Array.isArray(catalog.reconTiers)
      ? catalog.reconTiers.find(function (record) { return record.tier === reconTier; })
      : null;
    return deepFreeze({
      reconTier: reconTier,
      reconLabel: RECON_LABELS[reconTier],
      reconDetail: reconRecord ? reconRecord.detail : RECON_FALLBACK_DETAIL[reconTier],
      namedRoutes: namedRoutes,
      waves: waves.map(function (wave, index) {
        const exact = index < horizon;
        const timed = exact && reconTier >= 2;
        const groups = (wave.groups || []).map(function (group) {
          const boss = group.spawnKind === "boss";
          const unitId = boss ? (group.bossId || group.enemyId) : group.enemyId;
          const unit = boss ? catalog.bosses[unitId] : catalog.enemies[unitId];
          const routeKinds = unit ? unit.routeKinds : ["ground"];
          const firstSpawnSecond = timed && Number.isSafeInteger(group.firstTick)
            ? Math.floor(group.firstTick / ticksPerSecond)
            : null;
          const record = {
            id: group.id,
            unitId: unitId,
            unitName: unit ? unit.name : titleCase(String(unitId)),
            isBoss: boss,
            traits: unit && unit.traits ? unit.traits : [],
            tags: unit && unit.tags ? unit.tags : [],
            resistances: unit && unit.resistances ? unit.resistances : [],
            movement: routeKinds.indexOf("air") !== -1 ? "air" : "ground",
            relativeSize: boss ? "boss" : relativeSize(group.count || 0, maximumCount),
            exactCount: exact && Number.isSafeInteger(group.count) ? group.count : null,
            routeLabel: routeLabel(catalog, missionId, group.routeId),
            firstSpawnSecondBand: firstSpawnSecond === null
              ? null
              : firstSpawnSecond + "-" + (firstSpawnSecond + 1) + " s",
            arrival: arrivalText(firstSpawnSecond),
          };
          record.sentence = groupSentence(record, namedRoutes);
          return record;
        });
        const bossGroup = groups.find(function (group) { return group.isBoss; }) || null;
        const bossRecord = bossGroup ? catalog.bosses[bossGroup.unitId] : null;
        return {
          index: index + 1,
          title: text(catalog.strings, wave.titleKey, "Wave " + (index + 1)),
          note: format(catalog.strings, wave.noteKey, "", {}),
          detailLevel: timed ? "timed" : (exact ? "counts" : "baseline"),
          routes: Array.from(new Set(groups.map(function (group) { return group.routeLabel; }))).sort(asciiCompare),
          movementKinds: Array.from(new Set(groups.map(function (group) { return group.movement; }))).sort(asciiCompare),
          groups: groups,
          boss: bossRecord ? {
            id: bossRecord.id,
            name: bossRecord.name,
            description: bossRecord.description,
            phases: bossRecord.phases,
            phaseText: bossRecord.phases.map(function (phase) {
              return phase.name + " from " + phase.toPercent + "% down to " + phase.fromPercent + "% health";
            }),
          } : null,
        };
      }),
    });
  }

  /* Spec 18.3: a briefing states, in this order and without repeating itself, the act era,
     the act premise, what this battlefield is, what the player must do, and what is new here.
     The order and the deduplication are decided here so the view only renders what it is
     given. Nothing here may expose pad quality, exposure, grid coordinates, ticks, hashes,
     or runtime IDs. */
  function briefingNarrative(act, mission) {
    const lines = [];
    const seen = new Set();
    function add(id, label, value) {
      const body = typeof value === "string" ? value.trim() : "";
      if (!body || seen.has(body)) return;
      seen.add(body);
      lines.push({ id: id, label: label, text: body });
    }
    /* Labels are short scanning tags, never a second copy of a fact the screen already
       states: the act title and the battlefield name are in the briefing header. */
    add("act-era", "Era", act ? act.era : "");
    add("act-premise", "This act", act ? act.premise : "");
    add("battlefield-story", "This battlefield", mission.story);
    add("battlefield-summary", "The situation", mission.summary);
    mission.routeNotices.forEach(function (notice, index) {
      add("battlefield-route-" + index, "The road", notice);
    });
    add("objective", "Your task", mission.objectiveText);
    return lines;
  }

  function selectBriefingScreen(context) {
    const catalog = context.catalog;
    const profile = context.profile;
    const state = context.state;
    const mission = state.missionId === null ? null : catalog.missions[state.missionId];
    if (!mission) throw new RangeError("A briefing requires a selected mission");
    const difficulty = catalog.difficulties.find(function (record) { return record.id === state.difficultyId; });
    const loan = mission.protocolLoan;
    const loanProtocol = loan && catalog.protocols[loan.protocolId] ? catalog.protocols[loan.protocolId] : null;
    const act = catalog.acts.find(function (record) { return record.index === mission.actIndex; }) || null;
    const narrative = briefingNarrative(act, mission);
    const narrativeTexts = new Set(narrative.map(function (line) { return line.text; }));
    const newHere = mission.mechanicNotices.filter(function (notice, index, all) {
      return notice && !narrativeTexts.has(notice) && all.indexOf(notice) === index;
    });
    return deepFreeze({
      screen: "briefing",
      mode: state.mode,
      missionId: mission.id,
      heading: "Mission " + mission.number + " - " + mission.title,
      actTitle: act ? act.title : "",
      actEra: act ? act.era : "",
      actPremise: act ? act.premise : "",
      missionStory: mission.story,
      narrative: narrative,
      newHere: newHere,
      environmentLabel: mission.environmentLabel,
      summary: mission.summary,
      objectiveText: mission.objectiveText,
      routeNotices: mission.routeNotices,
      mechanicNotices: mission.mechanicNotices,
      waveCount: mission.waveCount,
      difficulty: difficulty ? {
        id: difficulty.id,
        label: difficulty.label,
        summary: difficulty.summary,
        gateHealth: difficulty.integrity,
        startAetherPercent: Math.round(difficulty.startAetherBp / 100),
        scorePercent: Math.round(difficulty.scoreBp / 100),
      } : null,
      assist: state.assist,
      laurelTargets: mission.objectives.map(function (objective) {
        /* The integrity threshold is difficulty specific, so its description
           resolves here rather than in the difficulty-free catalog. */
        const values = Object.assign({}, objective.descriptionValues, {
          minimumIntegrity: hasOwn(objective.integrityThresholds, state.difficultyId)
            ? objective.integrityThresholds[state.difficultyId] : null,
        });
        const resolved = format(catalog.strings, objective.descriptionKey, objective.description, values);
        /* Spec 15.2: a Laurel target must state its exact number, so a
           difficulty threshold the copy left implicit is appended here. */
        const threshold = values.minimumIntegrity;
        const description = threshold !== null && threshold !== undefined
          && resolved.indexOf(String(threshold)) === -1
          ? (resolved ? resolved + " " : "") + "Finish with at least " + threshold
            + " Gate Health on " + (DIFFICULTY_LABELS[state.difficultyId] || state.difficultyId) + "."
          : resolved;
        return {
          id: objective.id,
          title: objective.title,
          description: description,
          minimumIntegrity: values.minimumIntegrity,
          earned: profile.earnedLaurelIds.indexOf(
            mission.id + ":" + state.difficultyId + ":" + objective.id
          ) !== -1,
        };
      }),
      loadoutIds: state.loadoutIds.slice(),
      loadoutNames: state.loadoutIds.map(function (id) {
        return catalog.defenses[id] ? catalog.defenses[id].name : titleCase(id);
      }),
      tutorialLoan: loan ? {
        protocolId: loan.protocolId,
        name: loanProtocol ? loanProtocol.name : titleCase(loan.protocolId),
        tier: loan.tier,
        text: "This mission loans " + (loanProtocol ? loanProtocol.name : titleCase(loan.protocolId))
          + " at Tier 1 in an extra slot. You cannot upgrade it during the run, and winning grants it for good.",
      } : null,
      wavePreview: selectWavePreview({
        catalog: catalog,
        missionId: mission.id,
        waves: context.waves || [],
        reconTier: profile.reconTier,
        ticksPerSecond: context.ticksPerSecond,
      }),
      startLabel: "Start mission",
    });
  }

  /* ------------------------------------------------------------------- result */

  function usageBadges(catalog, facts) {
    const badges = [];
    (facts.protocolCasts || []).forEach(function (entry) {
      const record = catalog.protocols[entry.protocolId];
      badges.push({
        category: "protocol",
        id: entry.protocolId,
        label: (record ? record.name : titleCase(entry.protocolId)) + " T" + entry.tier,
        detail: entry.casts + " cast" + (entry.casts === 1 ? "" : "s"),
      });
    });
    (facts.relicIds || []).forEach(function (relicId) {
      const record = catalog.relics[relicId];
      badges.push({
        category: "relic", id: relicId,
        label: record ? record.name : titleCase(relicId), detail: "Equipped",
      });
    });
    (facts.specializationIds || []).forEach(function (specializationId) {
      badges.push({
        category: "specialization", id: specializationId,
        label: titleCase(specializationId), detail: "Level 3 branch",
      });
    });
    if (facts.reinforcementId) {
      const record = catalog.reinforcements[facts.reinforcementId];
      badges.push({
        category: "reinforcement", id: facts.reinforcementId,
        label: record ? record.name : titleCase(facts.reinforcementId),
        detail: (facts.reinforcementDeployments || 0) + " deployment"
          + ((facts.reinforcementDeployments || 0) === 1 ? "" : "s"),
      });
    }
    if (facts.mechanismId) {
      badges.push({
        category: "mechanism", id: facts.mechanismId,
        label: titleCase(facts.mechanismId),
        detail: (facts.mechanismActivations || 0) + " activation"
          + ((facts.mechanismActivations || 0) === 1 ? "" : "s"),
      });
    }
    return badges;
  }

  function badgeLine(badges) {
    if (!badges.length) return null;
    const line = "Used: " + badges.map(function (badge) { return badge.label; }).join(" · ");
    return line.length > 96 ? line.slice(0, 93) + "..." : line;
  }

  function selectResultScreen(context) {
    const catalog = context.catalog;
    const state = context.state;
    const result = state.result;
    if (!result) throw new RangeError("A result screen requires a finished run");
    const mission = catalog.missions[result.missionId] || null;
    const facts = result.facts || {};
    const badges = usageBadges(catalog, facts);
    const laurelIds = (result.completedObjectiveIds || []).map(function (objectiveId) {
      return { objectiveId: objectiveId, laurelId: result.missionId + ":" + result.difficultyId + ":" + objectiveId };
    });
    const newLaurelIds = Array.isArray(result.newLaurelIds) ? result.newLaurelIds : [];
    return deepFreeze({
      screen: "result",
      mode: state.mode,
      outcome: result.outcome,
      heading: result.outcome === "victory" ? "LOCAL VICTORY" : "DEFEAT",
      missionId: result.missionId,
      missionTitle: mission ? mission.title : result.missionId,
      difficultyId: result.difficultyId,
      difficultyLabel: DIFFICULTY_LABELS[result.difficultyId] || titleCase(result.difficultyId),
      assist: result.assist === true,
      score: result.score,
      gateHealth: result.gateHealth === undefined ? null : result.gateHealth,
      waves: result.waves || null,
      laurels: laurelIds.map(function (entry) {
        const objective = mission
          ? mission.objectives.find(function (candidate) { return candidate.id === entry.objectiveId; })
          : null;
        return {
          objectiveId: entry.objectiveId,
          title: objective ? objective.title : titleCase(entry.objectiveId),
          isNew: newLaurelIds.indexOf(entry.laurelId) !== -1,
          statusText: newLaurelIds.indexOf(entry.laurelId) !== -1 ? "New Laurel" : "Already earned",
        };
      }),
      firstClearRewards: (result.grantIdsApplied || []).map(describeGrant),
      masteryChanges: (result.masteryChanges || []).map(function (change) {
        return {
          defenseId: change.defenseId,
          name: catalog.defenses[change.defenseId]
            ? catalog.defenses[change.defenseId].name : titleCase(change.defenseId),
          milestone: change.milestone,
          text: (catalog.defenses[change.defenseId]
            ? catalog.defenses[change.defenseId].name : titleCase(change.defenseId))
            + " reached " + change.milestone + ".",
        };
      }),
      badges: badges,
      badgeLine: badgeLine(badges),
      persistence: deepFreeze({
        kind: result.persistence && result.persistence.kind ? result.persistence.kind : "session",
        durable: Boolean(result.persistence && result.persistence.durable),
        message: result.persistence && result.persistence.message
          ? result.persistence.message
          : (state.mode === "training"
            ? "Training runs are never saved."
            : "This result is only in this browser tab. Progress was not saved."),
      }),
      primaryAction: state.mode === "training" ? "Back to Training" : "Next mission",
      secondaryActions: ["Retry for Laurels", "Download result card", "Record a 10-20 second highlight"],
    });
  }

  function selectSettingsScreen(context) {
    const state = context.state;
    return deepFreeze({
      screen: "settings",
      heading: "Settings",
      storage: {
        kind: state.storageKind,
        durable: state.storageKind === "durable",
        label: state.storageKind === "durable" ? "Saving to this browser" : "SESSION ONLY",
        detail: state.storageKind === "durable"
          ? "Victories, Laurels, and unlocks are stored in this browser."
          : "This browser did not offer durable storage. Export a recovery file to keep your progress.",
      },
      toggles: [
        {
          key: "reducedMotion",
          label: "Reduced Motion",
          value: state.settings.reducedMotion,
          detail: "Replaces travel, shake, flashes, and long effects with a short fade. Telegraph boundaries stay exact.",
          minimumTargetSizePx: PlayerUi.SECONDARY_TARGET_SIZE_PX,
        },
        {
          key: "photosensitiveSafe",
          label: "Photosensitivity-safe mode",
          value: state.settings.photosensitiveSafe,
          detail: "Caps full-screen brightness changes and renders lightning as one sustained bolt per strike.",
          minimumTargetSizePx: PlayerUi.SECONDARY_TARGET_SIZE_PX,
        },
      ],
      bindings: KeyBindings.describeBindings(state.settings.bindings),
      cancelKey: KeyBindings.CANCEL_KEY,
      bindingRule: "Shortcuts are one letter or number. Escape always cancels and cannot be rebound.",
      recovery: {
        exportLabel: "Export recovery file",
        importLabel: "Import recovery file",
        detail: "A recovery file contains only local campaign progress. It never contains a name or account.",
      },
    });
  }

  function selectCodexScreen(context) {
    const catalog = context.catalog;
    const profile = context.profile;
    let unlockCards = [];
    try {
      unlockCards = PlayerUi.createUnlockCards({
        content: { unlocks: catalog.unlocks },
        state: {
          unlockedIds: profile.appliedGrantIds.filter(function (id) { return hasOwn(catalog.unlocks, id); }),
        },
      });
    } catch (error) {
      unlockCards = [];
    }
    return deepFreeze({
      screen: "codex",
      heading: "Codex",
      subheading: "Every defense, reward, and unlock path in this build.",
      defenses: Object.keys(catalog.defenses).map(function (id) {
        const defense = catalog.defenses[id];
        return {
          id: id,
          name: defense.name,
          roleText: defense.roleText,
          weaknessText: defense.weaknessText,
          costAether: defense.costAether,
          rangeWorldUnits: defense.rangeWorldUnits,
          targetKinds: defense.targetKinds,
          unlocked: profile.defenseGrantIds.indexOf(id) !== -1,
          inspectable: true,
        };
      }),
      unlocks: unlockCards,
      recon: {
        tier: profile.reconTier,
        label: RECON_LABELS[profile.reconTier] || RECON_LABELS[0],
        detail: "Recon only reveals compiled wave data earlier. It never changes combat.",
      },
    });
  }

  function selectScreen(context) {
    switch (context.state.screen) {
      case "title": return selectTitleScreen(context);
      case "campaign":
      case "training": return selectCampaignScreen(context);
      case "loadout": return selectLoadoutScreen(context);
      case "briefing": return selectBriefingScreen(context);
      case "result": return selectResultScreen(context);
      case "settings": return selectSettingsScreen(context);
      case "codex": return selectCodexScreen(context);
      case "battle": return deepFreeze({
        screen: "battle",
        mode: context.state.mode,
        missionId: context.state.missionId,
        heading: context.state.missionId && context.catalog.missions[context.state.missionId]
          ? context.catalog.missions[context.state.missionId].title : "Battle",
        missionTitle: context.state.missionId && context.catalog.missions[context.state.missionId]
          ? context.catalog.missions[context.state.missionId].title : null,
        difficultyLabel: DIFFICULTY_LABELS[context.state.difficultyId] || context.state.difficultyId,
        assist: context.state.assist,
      });
      default:
        throw new RangeError("Unknown Aegis shell screen: " + context.state.screen);
    }
  }

  return deepFreeze({
    VERSION: VERSION,
    SCREENS: SCREENS,
    MODES: MODES,
    HUB_SCREENS: HUB_SCREENS,
    TRANSITIONS: TRANSITIONS,
    REASONS: REASONS,
    RECON_LABELS: RECON_LABELS,
    createCatalog: createCatalog,
    createInitialState: createInitialState,
    transition: transition,
    planLoadoutEdit: planLoadoutEdit,
    describeGrant: describeGrant,
    missionStatus: missionStatus,
    prerequisiteMissionId: prerequisiteMissionId,
    difficultyAvailability: difficultyAvailability,
    nextUnlockRibbon: nextUnlockRibbon,
    validateLoadout: validateLoadout,
    laurelCount: laurelCount,
    selectScreen: selectScreen,
    selectTitleScreen: selectTitleScreen,
    selectCampaignScreen: selectCampaignScreen,
    selectLoadoutScreen: selectLoadoutScreen,
    selectBriefingScreen: selectBriefingScreen,
    selectResultScreen: selectResultScreen,
    selectSettingsScreen: selectSettingsScreen,
    selectCodexScreen: selectCodexScreen,
    selectWavePreview: selectWavePreview,
    selectDifficultyOptions: selectDifficultyOptions,
    usageBadges: usageBadges,
    badgeLine: badgeLine,
  });
});
