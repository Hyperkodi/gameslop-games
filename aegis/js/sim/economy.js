/* Armara Aegis deterministic runtime economy v1.
   Pure checked-integer helpers for investment, campaign start Aether, and mission bounty carry. */
(function (root, factory) {
  "use strict";

  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(require("./abi.js"));
    return;
  }

  const game = root.Game;
  if (!game || !game.AegisSim) throw new Error("Game.AegisSim must be installed before economy.js");
  const api = factory(game.AegisSim);
  if (Object.prototype.hasOwnProperty.call(game, "AegisEconomy")) {
    if (game.AegisEconomy !== api) throw new Error("Game.AegisEconomy is already installed");
    return;
  }
  Object.defineProperty(game, "AegisEconomy", {
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
  [
    "assertSafeInteger",
    "checkedAdd",
    "checkedMultiply",
    "checkedMulDivFloor",
    "floorDivNonnegative",
    "refundSeventyPercent",
    "canonicalEncode",
  ].forEach(function (name) {
    if (typeof ABI[name] !== "function") throw new TypeError("Aegis simulation ABI is missing " + name);
  });
  if (ABI.BASIS_POINTS !== 10000 || ABI.DESCRIPTOR.basisPoints !== ABI.BASIS_POINTS) {
    throw new RangeError("Aegis economy requires the frozen 10000-point basis");
  }

  const BASIS_POINTS = ABI.BASIS_POINTS;

  function nonnegativeInteger(value, label) {
    ABI.assertSafeInteger(value, label);
    if (value < 0) throw new RangeError(label + " must be nonnegative");
    return value;
  }

  function bountyRemainder(value) {
    nonnegativeInteger(value, "Bounty remainder");
    if (value >= BASIS_POINTS) {
      throw new RangeError("Bounty remainder must be less than " + BASIS_POINTS);
    }
    return value;
  }

  function addInvestment(currentInvestedAether, paidCostAether) {
    nonnegativeInteger(currentInvestedAether, "Current invested Aether");
    nonnegativeInteger(paidCostAether, "Paid Aether cost");
    return ABI.checkedAdd(currentInvestedAether, paidCostAether);
  }

  function cumulativeInvestment(paidCostsAether) {
    ABI.canonicalEncode(paidCostsAether);
    if (!Array.isArray(paidCostsAether)) throw new TypeError("Paid Aether costs must be an array");
    let investedAether = 0;
    for (let index = 0; index < paidCostsAether.length; index++) {
      investedAether = addInvestment(investedAether, paidCostsAether[index]);
    }
    return investedAether;
  }

  function sellRefund(investedAether) {
    nonnegativeInteger(investedAether, "Invested Aether");
    return ABI.refundSeventyPercent(investedAether);
  }

  function summarizeInvestment(paidCostsAether) {
    const investedAether = cumulativeInvestment(paidCostsAether);
    return Object.freeze({
      investedAether: investedAether,
      sellRefundAether: sellRefund(investedAether),
    });
  }

  function resolveStartAether(
    baseStartAether,
    difficultyAetherBp,
    campaignModifierAether,
    assistAether
  ) {
    nonnegativeInteger(baseStartAether, "Base starting Aether");
    nonnegativeInteger(difficultyAetherBp, "Difficulty Aether basis points");
    nonnegativeInteger(campaignModifierAether, "Campaign modifier Aether");
    nonnegativeInteger(assistAether, "Assist Aether");

    const difficultyStartAether = ABI.checkedMulDivFloor(
      baseStartAether,
      [difficultyAetherBp],
      [BASIS_POINTS]
    );
    const afterCampaignModifierAether = ABI.checkedAdd(
      difficultyStartAether,
      campaignModifierAether
    );
    const startAether = ABI.checkedAdd(afterCampaignModifierAether, assistAether);
    return Object.freeze({
      baseStartAether: baseStartAether,
      difficultyAetherBp: difficultyAetherBp,
      difficultyStartAether: difficultyStartAether,
      campaignModifierAether: campaignModifierAether,
      afterCampaignModifierAether: afterCampaignModifierAether,
      assistAether: assistAether,
      startAether: startAether,
    });
  }

  function initialBountyRemainder() {
    return 0;
  }

  function resolveBountyEvent(previousBountyRemainder, baseLineageBounty, difficultyBountyBp) {
    const previous = bountyRemainder(previousBountyRemainder);
    nonnegativeInteger(baseLineageBounty, "Base lineage bounty");
    nonnegativeInteger(difficultyBountyBp, "Difficulty bounty basis points");
    const bountyNumerator = ABI.checkedAdd(
      previous,
      ABI.checkedMultiply(baseLineageBounty, difficultyBountyBp)
    );
    const bountyAward = ABI.floorDivNonnegative(bountyNumerator, BASIS_POINTS);
    return Object.freeze({
      bountyNumerator: bountyNumerator,
      bountyAward: bountyAward,
      bountyRemainder: bountyNumerator % BASIS_POINTS,
    });
  }

  function creditFixedGrant(previousBountyRemainder, fixedGrantAether) {
    const previous = bountyRemainder(previousBountyRemainder);
    nonnegativeInteger(fixedGrantAether, "Fixed Aether grant");
    return Object.freeze({
      aetherAward: fixedGrantAether,
      bountyRemainder: previous,
    });
  }

  return Object.freeze({
    ABI_DESCRIPTOR_SHA256: ABI.DESCRIPTOR_SHA256,
    BASIS_POINTS: BASIS_POINTS,
    addInvestment: addInvestment,
    cumulativeInvestment: cumulativeInvestment,
    sellRefund: sellRefund,
    summarizeInvestment: summarizeInvestment,
    resolveStartAether: resolveStartAether,
    initialBountyRemainder: initialBountyRemainder,
    resolveBountyEvent: resolveBountyEvent,
    creditFixedGrant: creditFixedGrant,
  });
});
