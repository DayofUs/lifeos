import test from 'node:test';
import assert from 'node:assert/strict';
import { confirmCooking, dinnerServings, isRecipe, linkedLunchSource, shoppingNeeds, syncDecision } from '../kitchen.mjs';

const ingredient = { name: 'Rice', quantity: 300, unit: 'g' };
const recipe = { name: 'Rice bowl', servings: 4, ingredients: [ingredient], steps: ['Cook the rice.'] };

test('a linked weekday lunch reserves another set of dinner servings', () => {
  assert.equal(linkedLunchSource(1), 0);
  assert.equal(linkedLunchSource(4), 3);
  for (const day of [0, 5, 6]) assert.equal(linkedLunchSource(day), null);
  assert.equal(dinnerServings(2, true), 4);
  assert.equal(dinnerServings(2, false), 2);
  assert.ok(isRecipe(recipe, 4));
  assert.equal(isRecipe(recipe, 2), false);
  assert.equal(isRecipe({ ...recipe, ingredients: [{ ...ingredient, quantity: -1 }] }), false);
});

test('shopping combines matching units and subtracts only confirmed stock', () => {
  const pantry = [{ name: 'rice', unit: 'g', qty: 100 }, { name: 'Rice', unit: 'ml', qty: 900 }];
  const needs = shoppingNeeds([ingredient, { ...ingredient, name: ' rice ', quantity: 50 }], pantry);
  assert.equal(needs.length, 1);
  assert.equal(needs[0].missing, 250);
  assert.equal(pantry[0].qty, 100);
});

test('cooking deducts matching stock once and records shortages without creating inventory', () => {
  const pantry = [{ name: 'rice', unit: 'g', qty: 100 }, { name: 'Rice', unit: 'ml', qty: 900 }];
  const result = confirmCooking({ pantry, logs: {}, key: '0|dinner', recipe, at: '2026-11-20' });
  assert.equal(result.shortages[0].missing, 200);
  assert.deepEqual(result.pantry, [pantry[1]]);
  assert.equal(pantry[0].qty, 100);
  assert.equal(result.logs['0|dinner'].servings, 4);
  assert.equal(confirmCooking({ ...result, key: '0|dinner', recipe }), null);
});

test('snapshot reconciliation refuses to select a winner after concurrent edits', () => {
  assert.equal(syncDecision('a', 'a'), 'equal');
  assert.equal(syncDecision('b', 'a', 'a'), 'push');
  assert.equal(syncDecision('a', 'b', 'a'), 'pull');
  assert.equal(syncDecision('b', 'c', 'a'), 'conflict');
  assert.equal(syncDecision('b', 'c'), 'conflict');
});
