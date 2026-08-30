/* Armara Aegis campaign shell view.
   Builds a frozen, inspectable node tree from a shell screen model, then mounts
   that tree into a real document. Keeping the tree pure lets the accessibility,
   keyboard-reachability, and no-developer-data tests run without a DOM. */
(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
    return;
  }
  const game = root.Game = root.Game || {};
  if (!game || (typeof game !== "object" && typeof game !== "function")) {
    throw new Error("Cannot install the Aegis shell view into a non-object Game namespace");
  }
  if (Object.prototype.hasOwnProperty.call(game, "AegisShellView")) {
    if (game.AegisShellView !== api) throw new Error("Conflicting Game.AegisShellView is already installed");
    return;
  }
  Object.defineProperty(game, "AegisShellView", {
    value: api,
    enumerable: true,
    configurable: false,
    writable: false,
  });
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const VERSION = 1;
  const FOCUSABLE_TAGS = Object.freeze(["button", "input", "select", "textarea"]);

  function deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.getOwnPropertyNames(value).forEach(function (key) { deepFreeze(value[key]); });
    return Object.freeze(value);
  }

  function node(tag, options) {
    const source = options || {};
    return {
      tag: tag,
      className: source.className || "",
      text: source.text === undefined || source.text === null ? "" : String(source.text),
      attrs: source.attrs || {},
      action: source.action || null,
      children: (source.children || []).filter(Boolean),
    };
  }

  function span(className, value) {
    return node("span", { className: className, text: value });
  }

  function paragraph(className, value) {
    return node("p", { className: className, text: value });
  }

  function heading(level, value, className) {
    return node("h" + level, { className: className || "", text: value });
  }

  function button(label, action, options) {
    const source = options || {};
    const attrs = Object.assign({ type: "button" }, source.attrs || {});
    if (source.disabled) attrs.disabled = "disabled";
    if (source.ariaLabel) attrs["aria-label"] = source.ariaLabel;
    if (source.pressed !== undefined) attrs["aria-pressed"] = String(source.pressed);
    return node("button", {
      className: ["aegis-shell-button", source.className || ""].filter(Boolean).join(" "),
      text: label,
      attrs: attrs,
      action: source.disabled ? null : action,
      children: source.children || [],
    });
  }

  function list(className, items) {
    return node("ul", { className: className, children: items });
  }

  function balancedColumns(itemCount, maximumColumns) {
    const upper = Math.min(itemCount, maximumColumns || 5);
    let columns = upper;
    while (columns > 1 && itemCount % columns !== 0) columns -= 1;
    return Math.max(columns, 1);
  }

  function balancedGridClass(baseClass, itemCount, maximumColumns) {
    return baseClass + " aegis-shell-balanced-grid aegis-shell-balanced-grid--columns-"
      + balancedColumns(itemCount, maximumColumns);
  }

  function balancedCardGrid(layout, items, maximumColumns) {
    return list([
      balancedGridClass("aegis-shell-card-grid", items.length, maximumColumns),
      "aegis-shell-card-grid--" + layout,
    ].join(" "), items);
  }

  function definition(label, value) {
    return node("div", {
      className: "aegis-shell-stat",
      children: [span("aegis-shell-stat-label", label), span("aegis-shell-stat-value", value)],
    });
  }

  function chip(text, tone) {
    return node("span", {
      className: "aegis-shell-chip",
      text: text,
      attrs: tone ? { "data-tone": tone } : {},
    });
  }

  function isFocusable(candidate) {
    if (FOCUSABLE_TAGS.indexOf(candidate.tag) !== -1) {
      return !Object.prototype.hasOwnProperty.call(candidate.attrs, "disabled");
    }
    if (candidate.tag === "a") return Boolean(candidate.attrs.href);
    return Object.prototype.hasOwnProperty.call(candidate.attrs, "tabindex") &&
      String(candidate.attrs.tabindex) !== "-1";
  }

  function walk(tree, visit) {
    visit(tree);
    tree.children.forEach(function (child) { walk(child, visit); });
  }

  function focusOrder(tree) {
    const order = [];
    walk(tree, function (candidate) {
      if (!isFocusable(candidate)) return;
      order.push(deepFreeze({
        tag: candidate.tag,
        label: candidate.attrs["aria-label"] || candidate.text ||
          candidate.attrs.value || candidate.attrs.name || candidate.attrs.id || "",
        action: candidate.action ? candidate.action.type : null,
        className: candidate.className,
      }));
    });
    return deepFreeze(order);
  }

  function renderToText(tree) {
    const parts = [];
    walk(tree, function (candidate) {
      if (candidate.text) parts.push(candidate.text);
      if (candidate.attrs["aria-label"]) parts.push(candidate.attrs["aria-label"]);
    });
    return parts.join(" \n");
  }

  /* ------------------------------------------------------------------ screens */

  function topBar(model, options) {
    const showBack = model.screen !== "title";
    /* Title and Result state their own heading in a hero block, so the top bar
       keeps that heading for assistive technology only. */
    const heroOwnsHeading = model.screen === "title" || model.screen === "result";
    const storage = options.storageKind === "durable"
      ? { text: "Saving to this browser", tone: "ready" }
      : { text: "SESSION ONLY - progress will not be saved", tone: "warning" };
    return node("header", {
      className: "aegis-shell-topbar",
      children: [
        node("div", {
          className: "aegis-shell-topbar-left",
          children: [
            showBack ? button("Back", { type: "back" }, { className: "aegis-shell-button--quiet" }) : null,
            /* The title screen states the name once, in its own hero. */
            heading(1, model.heading || "Armara Aegis",
              heroOwnsHeading ? "aegis-shell-title aegis-shell-sr-only" : "aegis-shell-title"),
          ],
        }),
        node("div", {
          className: "aegis-shell-topbar-right",
          children: [
            node("p", {
              className: "aegis-shell-storage",
              text: storage.text,
              attrs: { "data-tone": storage.tone, role: "status" },
            }),
          ],
        }),
      ],
    });
  }

  function noticeRegion(notice) {
    return node("p", {
      className: "aegis-shell-notice",
      text: notice ? notice.text : "",
      attrs: {
        id: "shellNotice",
        role: "status",
        "aria-live": "polite",
        "data-tone": notice && notice.tone ? notice.tone : "quiet",
      },
    });
  }

  function titleScreen(model) {
    const destinations = [
      button(model.continueLabel, { type: "continueCampaign" }, {
        className: "aegis-shell-button--primary",
        ariaLabel: model.continueLabel,
      }),
    ].concat(model.destinations.map(function (destination) {
      return button(destination.label, { type: "navigate", screen: destination.screen });
    }));
    return node("section", {
      className: "aegis-shell-screen aegis-shell-screen--title",
      attrs: { "aria-labelledby": "shellTitleHeading" },
      children: [
        node("div", {
          className: "aegis-shell-hero",
          children: [
            heading(2, model.heading, "aegis-shell-hero-title"),
            paragraph("aegis-shell-hero-subtitle", model.subheading),
            paragraph("aegis-shell-hero-progress", model.progressText),
            paragraph("aegis-shell-hero-progress", model.laurelText),
          ],
        }),
        model.nextUnlock && model.nextUnlock.missionId
          ? paragraph("aegis-shell-ribbon", model.nextUnlock.text) : null,
        node("nav", {
          className: balancedGridClass("aegis-shell-hub", destinations.length, 5),
          attrs: { "aria-label": "Main menu" },
          children: destinations,
        }),
      ].filter(Boolean),
    });
  }

  function missionCard(mission, mode) {
    const laurelText = mission.bestLaurels + " / " + mission.maximumLaurels + " Laurels";
    return node("li", {
      className: "aegis-shell-mission",
      attrs: { "data-status": mission.status },
      children: [
        button(mission.title, { type: "selectMission", missionId: mission.missionId }, {
          className: "aegis-shell-mission-button",
          disabled: !mission.selectable,
          ariaLabel: mission.ariaLabel,
          children: [
            span("aegis-shell-mission-number", "Mission " + mission.number),
            span("aegis-shell-mission-name", mission.title),
            span("aegis-shell-mission-summary", mission.summary),
            span("aegis-shell-mission-meta",
              mission.waveCount + " waves · " + laurelText),
            mission.lockReason ? span("aegis-shell-mission-lock", mission.lockReason) : null,
          ].filter(Boolean),
        }),
        node("div", {
          className: "aegis-shell-mission-laurels",
          children: mission.laurelsByDifficulty.map(function (entry) {
            return chip(entry.label + " " + entry.laurels + "/" + entry.maximum,
              entry.laurels === entry.maximum && entry.maximum > 0 ? "ready" : "quiet");
          }),
        }),
        mode === "campaign" && mission.rewards.length ? node("p", {
          className: "aegis-shell-mission-reward",
          text: "First victory: " + mission.rewards.map(function (r) { return r.text; }).join("; "),
        }) : null,
      ].filter(Boolean),
    });
  }

  function campaignScreen(model) {
    return node("section", {
      className: "aegis-shell-screen aegis-shell-screen--campaign",
      attrs: { "aria-label": model.heading },
      children: [
        paragraph("aegis-shell-lede", model.subheading),
        model.nextUnlock ? node("p", {
          className: "aegis-shell-ribbon",
          text: model.nextUnlock.text,
          attrs: { "data-tone": "gold" },
        }) : null,
      ].concat(model.acts.map(function (act) {
        return node("section", {
          className: "aegis-shell-act",
          attrs: { "aria-label": act.era ? act.title + ". " + act.era : act.title },
          children: [
            node("div", {
              className: "aegis-shell-act-header",
              children: [
                heading(3, act.title, "aegis-shell-act-title"),
                act.era ? span("aegis-shell-act-era aegis-shell-stat-label", act.era) : null,
                span("aegis-shell-act-state", act.cleared ? "Act cleared" : "In progress"),
              ].filter(Boolean),
            }),
            act.story ? paragraph("aegis-shell-act-story aegis-shell-hint", act.story) : null,
            list(balancedGridClass("aegis-shell-mission-grid", act.missions.length, 5), act.missions.map(function (mission) {
              return missionCard(mission, model.mode);
            })),
          ].filter(Boolean),
        });
      })),
    });
  }

  function difficultyControls(difficulties) {
    return node("fieldset", {
      className: "aegis-shell-difficulty",
      children: [
        node("legend", { text: "Difficulty" }),
        node("div", {
          className: balancedGridClass("aegis-shell-difficulty-row", difficulties.length, 3),
          children: difficulties.map(function (difficulty) {
            return button(difficulty.label, { type: "setDifficulty", difficultyId: difficulty.id }, {
              className: difficulty.selected ? "is-selected" : "",
              disabled: !difficulty.available,
              ariaLabel: difficulty.ariaLabel,
              pressed: difficulty.selected,
              children: [
                span("aegis-shell-difficulty-name", difficulty.label),
                span("aegis-shell-difficulty-detail",
                  "Aether " + difficulty.startAetherPercent + "% · Gate " + difficulty.gateHealth
                  + " · Enemy HP " + difficulty.enemyHealthPercent + "% · Score " + difficulty.scorePercent + "%"),
                difficulty.lockReason ? span("aegis-shell-difficulty-lock", difficulty.lockReason) : null,
              ].filter(Boolean),
            });
          }),
        }),
      ],
    });
  }

  function towerCard(tower) {
    return node("li", {
      className: "aegis-shell-card",
      attrs: { "data-status": tower.status },
      children: [
        node("div", {
          className: "aegis-shell-card-head",
          children: [
            heading(4, tower.name, "aegis-shell-card-title"),
            tower.costAether === null ? null : chip(tower.costAether + " Aether", "cost"),
          ].filter(Boolean),
        }),
        paragraph("aegis-shell-card-role", tower.roleText),
        tower.weaknessText ? paragraph("aegis-shell-card-weakness", "Weakness: " + tower.weaknessText) : null,
        node("p", {
          className: "aegis-shell-card-stats",
          text: (tower.rangeWorldUnits === null ? "" : "Range " + tower.rangeWorldUnits + " · ")
            + "Hits " + (tower.targetKinds.length ? tower.targetKinds.join(" and ") : "ground"),
        }),
        tower.lockReason ? paragraph("aegis-shell-card-lock", tower.lockReason) : null,
        button(
          tower.status === "equipped" ? "Remove from loadout" : "Equip",
          { type: "toggleTower", defenseId: tower.id },
          {
            disabled: tower.status === "locked",
            ariaLabel: tower.ariaLabel,
            pressed: tower.status === "equipped",
          }
        ),
      ].filter(Boolean),
    });
  }

  function protocolCard(entry) {
    return node("li", {
      className: "aegis-shell-card",
      attrs: { "data-status": entry.granted ? "available" : "locked" },
      children: [
        node("div", {
          className: "aegis-shell-card-head",
          children: [
            heading(4, entry.name, "aegis-shell-card-title"),
            chip("Tier " + entry.availableTier, entry.granted ? "ready" : "quiet"),
          ],
        }),
        entry.currentEffectText ? paragraph("aegis-shell-card-role", entry.currentEffectText) : null,
        entry.currentCostAether === null ? null
          : paragraph("aegis-shell-card-stats", entry.currentCostAether + " Aether per cast, plus 25% for each repeat this mission."),
        entry.lockReason ? paragraph("aegis-shell-card-lock", entry.lockReason) : null,
        entry.allocatePreview ? paragraph("aegis-shell-card-preview", "Next: " + entry.allocatePreview) : null,
        entry.refundWarning ? paragraph("aegis-shell-card-warning", entry.refundWarning) : null,
        node("div", {
          className: "aegis-shell-card-actions",
          children: [
            entry.allocateCostLaurels === null ? null : button(
              "Allocate " + entry.allocateCostLaurels + " Laurels",
              { type: "allocateProtocolTier", protocolId: entry.protocolId },
              { disabled: !entry.canAllocate }
            ),
            entry.refundLaurels === null ? null : button(
              "Refund " + entry.refundLaurels + " Laurels",
              { type: "refundProtocolTier", protocolId: entry.protocolId },
              { disabled: !entry.canRefund, className: "aegis-shell-button--quiet" }
            ),
            entry.granted ? button(
              entry.equippedSlot === null ? "Equip" : "Unequip",
              { type: "toggleProtocol", protocolId: entry.protocolId },
              { pressed: entry.equippedSlot !== null }
            ) : null,
          ].filter(Boolean),
        }),
      ].filter(Boolean),
    });
  }

  function relicCard(card) {
    return node("li", {
      className: "aegis-shell-card",
      attrs: { "data-status": card.status },
      children: [
        heading(4, card.name, "aegis-shell-card-title"),
        paragraph("aegis-shell-card-benefit", "Benefit: " + card.benefitText),
        paragraph("aegis-shell-card-drawback", "Drawback: " + card.drawbackText),
        paragraph("aegis-shell-card-lock", card.unlockSource),
        button(card.status === "equipped" ? "Unequip" : "Equip",
          { type: "toggleRelic", relicId: card.id },
          { disabled: card.status === "locked", ariaLabel: card.ariaLabel, pressed: card.status === "equipped" }),
      ],
    });
  }

  function reinforcementCard(card) {
    return node("li", {
      className: "aegis-shell-card",
      attrs: { "data-status": card.status },
      children: [
        heading(4, card.name, "aegis-shell-card-title"),
        paragraph("aegis-shell-card-role", card.roleText),
        paragraph("aegis-shell-card-stats", card.costAether + " Aether · "
          + card.cooldownSeconds + " s cooldown · lasts " + card.lifetimeSeconds + " s"),
        card.lockReason ? paragraph("aegis-shell-card-lock", card.lockReason) : null,
        button(card.status === "equipped" ? "Unequip" : "Equip",
          { type: "toggleReinforcement", reinforcementId: card.id },
          { disabled: card.status === "locked", pressed: card.status === "equipped" }),
      ].filter(Boolean),
    });
  }

  function loadoutSection(section, cards, clearAction, emptyText, layout) {
    return node("section", {
      className: "aegis-shell-loadout-section",
      attrs: { "aria-label": section.ariaLabel },
      children: [
        node("div", {
          className: "aegis-shell-section-head",
          children: [
            heading(3, section.title, "aegis-shell-section-title"),
            span("aegis-shell-section-slots", section.usedSlots + " of " + section.slotCap + " slots"),
            button(section.clearLabel, { type: clearAction }, {
              className: "aegis-shell-button--quiet",
              disabled: !section.canClear,
            }),
          ],
        }),
        paragraph("aegis-shell-section-source", section.unlockSource),
        cards.length ? balancedCardGrid(layout, cards,
          layout === "relics" ? 4 : layout === "reinforcements" ? 3 : 5)
          : paragraph("aegis-shell-empty", emptyText),
      ],
    });
  }

  function loadoutScreen(model) {
    const sections = model.sections;
    return node("section", {
      className: "aegis-shell-screen aegis-shell-screen--loadout",
      attrs: { "aria-label": model.heading },
      children: [
        model.trialNotice ? paragraph("aegis-shell-ribbon", model.trialNotice) : null,
        node("div", {
          className: balancedGridClass("aegis-shell-loadout-summary", 3, 3),
          children: [
            definition("Laurels available", String(model.laurels.available)),
            definition("Laurels earned", String(model.laurels.earned)),
            definition("Laurels allocated", String(model.laurels.allocated)),
          ],
        }),
        difficultyControls(model.difficulties),
        node("div", {
          className: "aegis-shell-toggle-row",
          children: [
            button(model.assist ? "Assist: on" : "Assist: off", { type: "toggleAssist" }, {
              pressed: model.assist,
              ariaLabel: "Assist. " + model.assistText,
            }),
            paragraph("aegis-shell-hint", model.assistText),
          ],
        }),
        loadoutSection(sections[0], model.towers.map(towerCard), "clearTowers",
          "No defenses are offered on this mission.", "towers"),
        loadoutSection(sections[1], model.protocols.map(protocolCard), "clearProtocols",
          "Divine Protocols unlock with the mission 5 victory.", "protocols"),
        loadoutSection(sections[2], model.relics.map(relicCard), "clearRelics",
          "Relics unlock with the mission 6 victory.", "relics"),
        loadoutSection(sections[3], model.reinforcements.map(reinforcementCard), "clearReinforcement",
          "Reinforcements unlock with the mission 9 victory.", "reinforcements"),
        node("div", {
          className: "aegis-shell-actions",
          children: [
            button(model.startLabel, { type: "openBriefing" }, {
              className: "aegis-shell-button--primary",
              disabled: !model.ready,
            }),
            model.ready ? null : paragraph("aegis-shell-hint", model.readyReason),
          ].filter(Boolean),
        }),
      ].filter(Boolean),
    });
  }

  function briefingScreen(model) {
    return node("section", {
      className: "aegis-shell-screen aegis-shell-screen--briefing",
      attrs: { "aria-label": model.heading },
      children: [
        node("div", {
          className: "aegis-shell-briefing-head",
          children: [
            span("aegis-shell-briefing-act", model.actTitle + " · " + model.actEra),
          ],
        }),
        node("section", {
          className: "aegis-shell-briefing-narrative",
          attrs: { "aria-label": "Briefing" },
          children: [paragraph("aegis-shell-briefing-synopsis aegis-shell-lede", model.synopsis)],
        }),
        node("div", {
          className: balancedGridClass("aegis-shell-briefing-stats", 5, 5),
          children: [
            definition("Waves", String(model.waveCount)),
            definition("Difficulty", model.difficulty ? model.difficulty.label : "-"),
            definition("Gate Health", model.difficulty ? String(model.difficulty.gateHealth) : "-"),
            definition("Assist", model.assist ? "On" : "Off"),
            definition("Defenses", model.loadoutNames.join(", ")),
          ],
        }),
        model.tutorialLoan ? node("div", {
          className: "aegis-shell-loan",
          attrs: { "data-tone": "gold" },
          children: [
            heading(3, "Loaned Divine Protocol: " + model.tutorialLoan.name, "aegis-shell-section-title"),
            paragraph("aegis-shell-hint", model.tutorialLoan.text),
          ],
        }) : null,
        node("section", {
          className: "aegis-shell-objectives",
          attrs: { "aria-label": "Laurel targets" },
          children: [
            heading(3, "Laurel targets", "aegis-shell-section-title"),
            list("aegis-shell-objective-list", model.laurelTargets.map(function (target) {
              return node("li", {
                className: "aegis-shell-objective",
                attrs: { "data-earned": String(target.earned) },
                text: target.title + (target.description ? " - " + target.description : "")
                  + (target.earned ? " (already earned on this difficulty)" : ""),
              });
            })),
          ],
        }),
        node("div", {
          className: "aegis-shell-actions",
          children: [
            button(model.startLabel, { type: "startRun" }, { className: "aegis-shell-button--primary" }),
            button("Change loadout", { type: "back" }, { className: "aegis-shell-button--quiet" }),
          ],
        }),
      ].filter(Boolean),
    });
  }

  function resultScreen(model) {
    const resultStats = [
      definition("Score", String(model.score)),
      model.gateHealth === null ? null : definition("Gate Health", String(model.gateHealth)),
      model.waves === null ? null
        : definition("Waves", model.waves.cleared + " of " + model.waves.total),
    ].filter(Boolean);
    return node("section", {
      className: "aegis-shell-screen aegis-shell-screen--result",
      attrs: { "aria-label": model.heading },
      children: [
        node("div", {
          className: "aegis-shell-result-head",
          attrs: { "data-outcome": model.outcome },
          children: [
            heading(2, model.heading, "aegis-shell-result-title"),
            paragraph("aegis-shell-lede", model.missionTitle + " · " + model.difficultyLabel
              + (model.assist ? " · Assist" : "")),
          ],
        }),
        node("div", {
          className: balancedGridClass("aegis-shell-result-stats", resultStats.length, 3),
          children: resultStats,
        }),
        node("section", {
          className: "aegis-shell-result-laurels",
          attrs: { "aria-label": "Laurels" },
          children: [
            heading(3, "Laurels", "aegis-shell-section-title"),
            model.laurels.length ? list("aegis-shell-laurel-list", model.laurels.map(function (laurel) {
              return node("li", {
                className: "aegis-shell-laurel",
                attrs: { "data-new": String(laurel.isNew) },
                text: laurel.title + " - " + laurel.statusText,
              });
            })) : paragraph("aegis-shell-empty", "No Laurels this run."),
          ],
        }),
        model.firstClearRewards.length ? node("section", {
          className: "aegis-shell-result-rewards",
          attrs: { "aria-label": "First-clear rewards" },
          children: [
            heading(3, "First-clear rewards", "aegis-shell-section-title"),
            list("aegis-shell-reward-list", model.firstClearRewards.map(function (reward) {
              return node("li", { text: reward.text });
            })),
          ],
        }) : null,
        model.masteryChanges.length ? node("section", {
          className: "aegis-shell-result-mastery",
          attrs: { "aria-label": "Mastery" },
          children: [
            heading(3, "Mastery", "aegis-shell-section-title"),
            list("aegis-shell-mastery-list", model.masteryChanges.map(function (change) {
              return node("li", { text: change.text });
            })),
          ],
        }) : null,
        model.badges.length ? node("section", {
          className: "aegis-shell-result-badges",
          attrs: { "aria-label": "What you used" },
          children: [
            heading(3, "What you used", "aegis-shell-section-title"),
            node("div", {
              className: "aegis-shell-badge-row",
              children: model.badges.map(function (badge) {
                return chip(badge.label + " · " + badge.detail, badge.category);
              }),
            }),
          ],
        }) : null,
        node("p", {
          className: "aegis-shell-persistence",
          attrs: { "data-durable": String(model.persistence.durable), role: "status" },
          text: model.persistence.message,
        }),
        node("div", {
          className: "aegis-shell-actions",
          children: [
            button(model.primaryAction, { type: "continue" }, { className: "aegis-shell-button--primary" }),
            button("Retry for Laurels", { type: "retry" }, { className: "aegis-shell-button--quiet" }),
            button("Record a 10-20 second highlight", { type: "highlightGuide" },
              { className: "aegis-shell-button--quiet" }),
          ],
        }),
      ].filter(Boolean),
    });
  }

  function settingsScreen(model) {
    return node("section", {
      className: "aegis-shell-screen aegis-shell-screen--settings",
      attrs: { "aria-label": "Settings" },
      children: [
        node("section", {
          className: "aegis-shell-settings-block",
          attrs: { "aria-label": "Storage" },
          children: [
            heading(3, "Storage", "aegis-shell-section-title"),
            node("p", {
              className: "aegis-shell-storage",
              attrs: { "data-tone": model.storage.durable ? "ready" : "warning" },
              text: model.storage.label,
            }),
            paragraph("aegis-shell-hint", model.storage.detail),
            node("div", {
              className: "aegis-shell-actions",
              children: [
                button(model.recovery.exportLabel, { type: "exportRecovery" }),
                button(model.recovery.importLabel, { type: "importRecovery" }),
              ],
            }),
            paragraph("aegis-shell-hint", model.recovery.detail),
          ],
        }),
        node("section", {
          className: "aegis-shell-settings-block",
          attrs: { "aria-label": "Display" },
          children: [
            heading(3, "Display", "aegis-shell-section-title"),
          ].concat(model.toggles.map(function (toggle) {
            return node("div", {
              className: "aegis-shell-toggle-row",
              children: [
                button(toggle.label + ": " + (toggle.value ? "on" : "off"),
                  { type: "setSetting", key: toggle.key, value: !toggle.value },
                  { pressed: toggle.value, ariaLabel: toggle.label + ". " + toggle.detail }),
                paragraph("aegis-shell-hint", toggle.detail),
              ],
            });
          })),
        }),
        node("section", {
          className: "aegis-shell-settings-block",
          attrs: { "aria-label": "Keyboard shortcuts" },
          children: [
            heading(3, "Keyboard shortcuts", "aegis-shell-section-title"),
            paragraph("aegis-shell-hint", model.bindingRule),
          ].concat(model.bindings.map(function (binding) {
            return node("div", {
              className: "aegis-shell-binding",
              children: [
                node("label", {
                  className: "aegis-shell-binding-label",
                  text: binding.label,
                  attrs: { for: "bind-" + binding.id },
                }),
                node("input", {
                  className: "aegis-shell-binding-input",
                  attrs: {
                    id: "bind-" + binding.id,
                    type: "text",
                    maxlength: "1",
                    value: binding.key,
                    "aria-label": binding.ariaLabel,
                    "data-binding-action": binding.id,
                  },
                  action: { type: "rebindKey", actionId: binding.id },
                }),
                binding.isDefault ? null : button("Reset", {
                  type: "rebindKey", actionId: binding.id, key: binding.defaultKey,
                }, { className: "aegis-shell-button--quiet" }),
              ].filter(Boolean),
            });
          })),
        }),
      ],
    });
  }

  function codexScreen(model) {
    return node("section", {
      className: "aegis-shell-screen aegis-shell-screen--codex",
      attrs: { "aria-label": "Codex" },
      children: [
        paragraph("aegis-shell-lede", model.subheading),
        node("section", {
          className: "aegis-shell-settings-block",
          attrs: { "aria-label": "Recon" },
          children: [
            heading(3, "Recon: " + model.recon.label, "aegis-shell-section-title"),
            paragraph("aegis-shell-hint", model.recon.detail),
          ],
        }),
        node("section", {
          className: "aegis-shell-settings-block",
          attrs: { "aria-label": "Defenses" },
          children: [
            heading(3, "Defenses", "aegis-shell-section-title"),
            balancedCardGrid("codex", model.defenses.map(function (defense) {
              return node("li", {
                className: "aegis-shell-card",
                attrs: { "data-status": defense.unlocked ? "available" : "locked" },
                children: [
                  heading(4, defense.name, "aegis-shell-card-title"),
                  paragraph("aegis-shell-card-role", defense.roleText),
                  defense.weaknessText
                    ? paragraph("aegis-shell-card-weakness", "Weakness: " + defense.weaknessText) : null,
                  paragraph("aegis-shell-card-stats",
                    (defense.costAether === null ? "" : defense.costAether + " Aether · ")
                    + "Range " + defense.rangeWorldUnits + " · Hits "
                    + (defense.targetKinds.length ? defense.targetKinds.join(" and ") : "ground")),
                  paragraph("aegis-shell-card-lock",
                    defense.unlocked ? "Unlocked" : "Unlocked by a later campaign victory."),
                ].filter(Boolean),
              });
            }), 5),
          ],
        }),
        model.unlocks.length ? node("section", {
          className: "aegis-shell-settings-block",
          attrs: { "aria-label": "Unlock path" },
          children: [
            heading(3, "Unlock path", "aegis-shell-section-title"),
            list("aegis-shell-unlock-list", model.unlocks.map(function (unlock) {
              return node("li", {
                className: "aegis-shell-unlock",
                attrs: { "data-status": unlock.status },
                text: unlock.name + " - " + unlock.description,
              });
            })),
          ],
        }) : null,
      ].filter(Boolean),
    });
  }

  function battleScreen(model) {
    return node("section", {
      className: "aegis-shell-screen aegis-shell-screen--battle",
      attrs: { "aria-label": "Battle" },
      children: [
        node("div", {
          className: "aegis-shell-battle-head",
          children: [
            span("aegis-shell-battle-meta",
              model.difficultyLabel + (model.assist ? " · Assist" : "")
              + (model.mode === "training" ? " · Training" : "")),
            button("Leave mission", { type: "abandonRun" }, { className: "aegis-shell-button--quiet" }),
          ],
        }),
      ],
    });
  }

  const SCREEN_BUILDERS = Object.freeze({
    title: titleScreen,
    campaign: campaignScreen,
    training: campaignScreen,
    loadout: loadoutScreen,
    briefing: briefingScreen,
    battle: battleScreen,
    result: resultScreen,
    settings: settingsScreen,
  });

  function buildScreenTree(model, callerOptions) {
    if (!model || typeof model !== "object" || typeof model.screen !== "string") {
      throw new TypeError("A shell view requires a screen model");
    }
    const builder = SCREEN_BUILDERS[model.screen];
    if (!builder) throw new RangeError("Unknown Aegis shell screen: " + model.screen);
    const options = callerOptions || {};
    return deepFreeze(node("div", {
      className: "aegis-shell",
      attrs: {
        "data-screen": model.screen,
        "data-mode": model.mode || "campaign",
        "data-reduced-motion": String(options.reducedMotion === true),
        "data-photosensitive-safe": String(options.photosensitiveSafe === true),
      },
      children: [
        topBar(model, options),
        noticeRegion(options.notice || null),
        builder(model),
      ],
    }));
  }

  /* --------------------------------------------------------------- DOM mount */

  function materialize(documentObject, spec, dispatch) {
    const element = documentObject.createElement(spec.tag);
    if (spec.className) element.className = spec.className;
    Object.keys(spec.attrs).forEach(function (key) {
      element.setAttribute(key, String(spec.attrs[key]));
    });
    if (spec.tag === "input" && spec.attrs.value !== undefined) element.value = String(spec.attrs.value);
    if (spec.text && !spec.children.length) {
      element.appendChild(documentObject.createTextNode(spec.text));
    } else if (spec.text && spec.children.length && !spec.attrs["aria-label"]) {
      /* A control that already carries an explicit accessible name must not
         repeat that name inside itself: the label would be announced twice. */
      const label = documentObject.createElement("span");
      label.className = "aegis-shell-sr-only";
      label.appendChild(documentObject.createTextNode(spec.text));
      element.appendChild(label);
    }
    if (spec.action && typeof dispatch === "function" && typeof element.addEventListener === "function") {
      if (spec.tag === "input") {
        element.addEventListener("keydown", function (event) {
          dispatch(Object.assign({}, spec.action, { key: event }), event);
        });
      } else {
        element.addEventListener("click", function (event) { dispatch(spec.action, event); });
      }
    }
    spec.children.forEach(function (child) {
      element.appendChild(materialize(documentObject, child, dispatch));
    });
    return element;
  }

  function mount(documentObject, container, tree, dispatch) {
    if (!documentObject || typeof documentObject.createElement !== "function") {
      throw new TypeError("Mounting the Aegis shell requires a document");
    }
    if (!container) throw new TypeError("Mounting the Aegis shell requires a container element");
    while (container.firstChild) container.removeChild(container.firstChild);
    container.appendChild(materialize(documentObject, tree, dispatch));
    return container;
  }

  return deepFreeze({
    VERSION: VERSION,
    buildScreenTree: buildScreenTree,
    focusOrder: focusOrder,
    renderToText: renderToText,
    mount: mount,
    walk: walk,
  });
});
