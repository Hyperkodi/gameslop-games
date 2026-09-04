"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Preview = require("../js/delivery/preview-controller.js");
const Atlas = require("../js/presentation/sprite-atlas.js");

function enemy(overrides) {
  return Object.assign({ id: 1, ownerId: "raider", kind: "regular", distance: 0,
    displayX: 0, displayY: 0, symbol: "R",
    asset: { kind: "atlas", metadata: Atlas.createEnemyAtlasMetadata("test.enemy") } }, overrides);
}

test("eight run poses are driven by distance, not elapsed time", () => {
  const frames = new Set();
  for (let distance = 0; distance < 4400; distance += 100) {
    const unit = enemy({ distance });
    const pose = Preview.enemyMotionPose(unit, null, 1, false);
    frames.add(pose.frameIndex);
    assert.equal(pose.frameIndex, Preview.enemyMotionPose(unit, null, 200, false).frameIndex);
  }
  assert.equal(frames.size, 8);
});

test("stopped units stop striding and resumed movement faces its actual direction", () => {
  const first = Preview.enemyMotionPose(enemy(), null, 1, false);
  const stopped = Preview.enemyMotionPose(enemy(), first, 2, false);
  assert.equal(stopped.moving, false);
  assert.equal(stopped.bob, 0);
  assert.equal(stopped.footfall, 0);
  const left = Preview.enemyMotionPose(enemy({ distance: 100, displayX: -100 }), stopped, 3, false);
  assert.equal(left.facing, -1);
  const vertical = Preview.enemyMotionPose(enemy({ distance: 200, displayX: -100, displayY: 100 }), left, 4, false);
  assert.equal(vertical.facing, -1);
});

test("reduced motion disables bounce, lean, squash, hover and dust", () => {
  for (const ownerId of ["scout", "raider", "guardian", "echo", "titan"]) {
    const pose = Preview.enemyMotionPose(enemy({ ownerId, distance: 1350 }), null, 53, true);
    assert.deepEqual([pose.frameIndex, pose.bob, pose.lean, pose.squash, pose.hover, pose.footfall], [0, 0, 0, 1, 0, 0]);
  }
});

test("heavy units carry less bounce and hovering units never kick up dust", () => {
  assert.ok(Preview.enemyMotionPose(enemy({ ownerId: "guardian", distance: 950 }), null, 2, false).bob <= 230);
  assert.equal(Preview.enemyMotionPose(enemy({ ownerId: "echo" }), null, 2, false).footfall, 0);
});

test("new run crops stay within transparent sheets and share a stable foot baseline", () => {
  for (const ownerId of ["raider", "scout"]) {
    const seen = new Set();
    for (let frameIndex = 0; frameIndex < 8; frameIndex++) {
      const sprite = Preview.enemyLocomotionSprite(enemy({ ownerId }), { frameIndex }, false, 10000);
      seen.add(sprite.frame.frameName);
      const [x, y, width, height] = sprite.frame.source;
      assert.ok(x >= 0 && y >= 0 && x + width <= 1774 && y + height <= 887);
      assert.ok(Math.abs(sprite.y + sprite.height - 4400) < .001);
      assert.ok(Math.abs(sprite.x + sprite.width / 2) < .001);
      const bytes = fs.readFileSync(path.join(__dirname, "..", sprite.asset.href));
      assert.equal(bytes.toString("ascii", 0, 4), "RIFF");
      assert.equal(bytes.toString("ascii", 8, 12), "WEBP");
      assert.ok(bytes.includes(Buffer.from("ALPH")), "A real alpha channel must survive production encoding");
      assert.ok(bytes.length < 450000);
    }
    assert.equal(seen.size, 8);
  }
});

test("existing enemy families retain valid movement poses, never their hit or defeat frames", () => {
  for (let frameIndex = 0; frameIndex < 8; frameIndex++) {
    const sprite = Preview.enemyLocomotionSprite(enemy({ ownerId: "guardian" }), { frameIndex }, false, 10000);
    assert.ok(["runA", "runB", "runC"].includes(sprite.frame.frameName));
  }
});

test("hit and defeat cues require actual damage, not leaks or zero-damage contacts", () => {
  const damage = { kind: "damage", targetRuntimeId: 1, appliedHpDamageMilli: 500, targetHpAfterMilli: 100 };
  assert.deepEqual(Preview.enemyReactionsForStep({ state: { tick: 12 }, telemetry: [damage] }), [{ id: 1, kind: "hit", tick: 12 }]);
  assert.deepEqual(Preview.enemyReactionsForStep({ state: { tick: 12 }, telemetry: { records: [damage, { ...damage, targetHpAfterMilli: 0 }, damage] } }), [{ id: 1, kind: "defeat", tick: 12 }]);
  assert.deepEqual(Preview.enemyReactionsForStep({ state: { tick: 12 }, telemetry: [
    { ...damage, appliedHpDamageMilli: 0 }, { kind: "leak", enemyRuntimeId: 1 }
  ] }), []);
  assert.deepEqual(Preview.enemyReactionsForStep(null), []);
});
