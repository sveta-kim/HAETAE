import test from 'node:test';
import assert from 'node:assert/strict';
import { getAbilityInfo, getBuffInfo } from '../src/ability-info.js';

test('changing selected talisman never relabels the currently active enchant', () => {
  const player = { selected: 1, buff: { id: 'red', remaining: 9 } };
  assert.equal(getAbilityInfo(player).name, '청룡');
  const buff = getBuffInfo(player);
  assert.equal(buff.name, '주작');
  assert.equal(buff.remaining, 9);
  assert.equal(buff.duration, 15);
  assert.match(buff.description, /1.7배/);
});

test('awakened stealth duration and expired effects are represented accurately', () => {
  const player = { selected: 0, tigerEvolved: true, buff: { id: 'white', remaining: 25 } };
  assert.equal(getBuffInfo(player).duration, 30);
  assert.match(getBuffInfo(player).description, /1초/);
  player.buff.remaining = 0;
  assert.equal(getBuffInfo(player), null);
  player.buff = null;
  player.enchantCooldown = 30;
  assert.equal(getBuffInfo(player), null);
});
