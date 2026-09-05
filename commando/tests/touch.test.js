'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {stickDirections}=require('../js/touch.js');
test('thumbstick accepts center drags, ignores neutral jitter, and deliberately releases',()=>{
  assert.deepEqual(stickDirections(0,0),[]);assert.deepEqual(stickDirections(.12,.08),[]);
  const right=stickDirections(.85,0);assert.deepEqual(right,['right']);
  assert.deepEqual(stickDirections(.85,.3,right),['right']);
  assert.deepEqual(stickDirections(0,0,right),[]);
});
test('sideways thumb drift does not crouch, but deliberate down and upward diagonal aim remain available',()=>{
  assert.deepEqual(stickDirections(.8,.45),['right']);
  assert.deepEqual(stickDirections(-.8,.45),['left']);
  assert.deepEqual(stickDirections(.1,.9),['down']);
  assert.deepEqual(stickDirections(.55,.8),['right','down']);
  assert.deepEqual(stickDirections(.65,-.65),['right','up']);
});
test('stick direction hysteresis prevents chatter at the neutral and diagonal boundaries',()=>{
  assert.deepEqual(stickDirections(.2,0),[]);
  assert.deepEqual(stickDirections(.2,0,['right']),['right']);
  assert.deepEqual(stickDirections(.14,0,['right']),[]);
  assert.deepEqual(stickDirections(.7,-.4),['right']);
  assert.deepEqual(stickDirections(.7,-.4,['right','up']),['right','up']);
});
test('overhead bunker movement keeps all eight directions',()=>{
  assert.deepEqual(stickDirections(.7,.7,[],true),['right','down']);
  assert.deepEqual(stickDirections(-.7,.7,[],true),['left','down']);
  assert.deepEqual(stickDirections(-.7,-.7,[],true),['left','up']);
  assert.deepEqual(stickDirections(0,-.9,[],true),['up']);
});
