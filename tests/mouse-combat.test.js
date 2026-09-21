import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';

const tick = (g, n = 1, input = {}) => { for (let i = 0; i < n; i++) g.update(1 / 60, input); };
function arena() {
  const g = new Game({ tutorials: false }); g.startNew();
  g.enemies = []; g.objects = []; g.platforms = [{ x: 0, y: 460, w: 3000, h: 80 }];
  return g;
}
const enemy = (x, y = 410) => ({ id: `dummy-${x}`, type: 'sunra', x, y, w: 30, h: 50, hp: 100, maxHp: 100, facing: -1, cooldown: 10, originX: x, stun: 10, hitFlash: 0 });
const shots = (g, n = 60) => { for (let i = 0; i < n; i++) g.updateProjectiles(1 / 60); };

test('wheel skips locked slots in both directions, wraps owned slots and handles multiple detents', () => {
  const g = arena();
  tick(g, 1, { select: 1, cycle: -1 }); assert.equal(g.player.selected, 0);
  tick(g, 1, { cycle: -1 }); assert.equal(g.player.selected, 1);
  tick(g, 1, { cycle: 1 }); assert.equal(g.player.selected, 0);
  tick(g, 1, { select: 4 });
  const energy = g.player.energy;
  assert.equal(g.cast(), false); assert.equal(g.enhancedAttack(), false); assert.equal(g.enchant(), false);
  assert.equal(g.player.energy, energy);
  g.saveCheckpoint(); assert.ok(g.validateSave(g.getSave()), 'locked selection must not corrupt a checkpoint');
  tick(g, 1, { cycle: 1 }); assert.equal(g.player.selected, 0);
  tick(g, 1, { cycle: 7 }); assert.equal(g.player.selected, 1);
  g.player.unlocked = [4, 0, 2];
  tick(g, 1, { select: 0, cycle: -1 }); assert.equal(g.player.selected, 4);
  tick(g, 1, { cycle: 1 }); assert.equal(g.player.selected, 0);
  tick(g, 1, { cycle: 7 }); assert.equal(g.player.selected, 2);
  tick(g, 1, { cycle: -7 }); assert.equal(g.player.selected, 0);
  tick(g, 1, { select: 3, cycle: -1 }); assert.equal(g.player.selected, 2);
  tick(g, 1, { select: 3, cycle: 1 }); assert.equal(g.player.selected, 4);
  g.player.unlocked = [0, 1, 2, 3, 4];
  tick(g, 1, { cycle: 1 }); assert.equal(g.player.selected, 0);
  tick(g, 1, { cycle: -1 }); assert.equal(g.player.selected, 4);
  for (let select = 0; select < 5; select++) { tick(g, 1, { select }); assert.equal(g.player.selected, select); }
});

test('screen aim maps through camera and diagonal shots follow the cursor rather than movement', () => {
  const g = arena(); g.player.x = 680; g.camera = 330;
  const target = enemy(840, 285); g.enemies.push(target);
  const aim = { x: target.x + 15 - g.camera, y: target.y + 25 };
  tick(g, 1, { aim, left: true, attack: true });
  assert.equal(g.player.facing, 1);
  assert.ok(g.player.vx < 0);
  assert.ok(g.projectiles[0].vx > 0 && g.projectiles[0].vy < 0);
  shots(g); assert.equal(target.hp, 78);
  g.camera = g.player.x - 350;
  tick(g, 1, { aim: { x: 700, y: 300 }, left: true, dash: true });
  assert.ok(g.player.vx < 0, 'dash follows movement while aiming the other way');
});

test('right click auto-enchants and snapshots damage; left click stays basic and cooldown blocks only enhancement', () => {
  const g = arena(), target = enemy(210); g.enemies.push(target);
  tick(g, 1, { aim: { x: 225, y: 435 }, enhancedAttack: true });
  assert.equal(g.player.buff.id, 'red');
  assert.equal(g.projectiles[0].damage, 37.4);
  shots(g); assert.ok(Math.abs(target.hp - 62.6) < .001); assert.equal(target.burnRemaining, 3);
  g.attackCooldown = 0; g.comboTime = 0;
  g.attack(); assert.equal(g.projectiles[0].damage, 22); assert.equal(g.projectiles[0].buff, null);
  g.endEnchant(); g.attackCooldown = 0;
  assert.equal(g.enhancedAttack(), false); assert.equal(g.attack(), true);
  g.player.selected = 1; g.castCooldown = 0; assert.equal(g.cast(), true);
});

for (const kind of ['wall', 'gate', 'cooler', 'memory', 'npc']) {
  test(`physical shots stop at ${kind} before an enemy, including thin obstacles at high speed`, () => {
    const g = arena(), target = enemy(220); g.enemies.push(target);
    const obstacle = { x: 150, y: 380, w: 2, h: 80, active: true, type: kind, id: 'obstacle' };
    if (kind === 'wall') g.platforms.push(obstacle); else g.objects.push(obstacle);
    g.attack(); g.projectiles[0].vx = 15000;
    g.updateProjectiles(1 / 60);
    assert.equal(g.projectiles.length, 0); assert.equal(target.hp, 100);
    assert.equal(g.conscience, 100);
  });
}

test('a nearer enemy intercepts a shot and a red shot destroys only the first blocking object', () => {
  const g = arena(), near = enemy(155), far = enemy(240); g.enemies.push(far, near);
  g.attack(); shots(g); assert.equal(near.hp, 78); assert.equal(far.hp, 100);
  g.enemies = [far];
  const gate = { id: 'gate', type: 'gate', x: 160, y: 350, w: 20, h: 110, active: true };
  g.objects = [gate]; g.cast(); shots(g);
  assert.equal(gate.active, false); assert.equal(g.conscience, 98); assert.equal(far.hp, 100);
  assert.equal(g.projectiles.length, 0);
});

test('walls block diagonal and hostile shots, while detection and permission casts pass through', () => {
  const g = arena(), target = enemy(230, 295); g.enemies.push(target);
  g.platforms.push({ x: 145, y: 240, w: 3, h: 220 });
  g.aim = { x: 245, y: 320 }; g.attack(); shots(g); assert.equal(target.hp, 100);
  g.projectiles.push({ x: 230, y: 430, w: 8, h: 8, vx: -1500, vy: 0, life: 1, hostile: true });
  g.player.invulnerable = 0; shots(g); assert.equal(g.player.hp, 150);
  g.selectTalisman(1); g.cast(); assert.equal(target.revealed, 8);
  g.player.unlocked.push(2); g.player.tigerEvolved = true; g.selectTalisman(2); g.castCooldown = 0;
  const gate = { id: 'gate', type: 'gate', x: 210, y: 350, w: 20, h: 110, active: true };
  g.objects = [gate]; g.cast(); assert.equal(gate.active, false); assert.equal(g.conscience, 100);
});

test('reflected projectiles obey the same geometry and hit their attacker', () => {
  const g = arena(), target = enemy(250); g.enemies.push(target); g.shieldTime = 5;
  g.projectiles.push({ x: 130, y: 430, w: 8, h: 8, vx: -400, vy: 0, life: 2, hostile: true });
  shots(g); assert.equal(target.hp, 65); assert.equal(g.player.hp, 150);
});

test('practice freezes preexisting shots and never leaks practice shots into the world', () => {
  const g = new Game(); g.startNew(); g.skipTutorial();
  g.attack(); const frozen = structuredClone(g.projectiles);
  g.replayTutorial(); assert.equal(g.projectiles.length, 0);
  g.attack(); tick(g, 8); g.skipTutorial();
  assert.deepEqual(g.projectiles, frozen);
});
