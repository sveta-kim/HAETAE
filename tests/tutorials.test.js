import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';

const tick = (g, frames = 1, input = {}) => { for (let i = 0; i < frames; i++) g.update(1 / 60, input); };
const until = (g, predicate) => { for (let i = 0; i < 240 && !predicate(); i++) tick(g); assert.ok(predicate(), `lesson ${g.tutorial?.id}, step ${g.tutorial?.stepIndex}: ${g.tutorial?.step?.goal}`); };
const settled = g => until(g, () => !g.tutorial || !g.tutorial.feedbackTime && !g.projectiles.length);
const start = () => { const g = new Game(); g.startNew(); return g; };
const skipInitial = g => {
  g.skipTutorial();
  g.player.x = 230;
  tick(g);
  assert.equal(g.tutorial.id, 'blue');
  g.skipTutorial();
};
const white = () => {
  const g = start(); skipInitial(g);
  g.player.x = 410;
  tick(g);
  assert.equal(g.tutorial.id, 'white');
  return g;
};
const black = () => {
  const g = white(); g.skipTutorial();
  g.loadLevel(1);
  g.player.x = 190;
  tick(g);
  assert.equal(g.tutorial.id, 'black');
  return g;
};
const evolved = () => {
  const g = black(); g.skipTutorial();
  g.loadLevel(2);
  g.player.x = 220;
  tick(g);
  assert.equal(g.tutorial.id, 'white-evolved');
  return g;
};

test('title has no lesson; new game teaches actual left-click shot, aimed Q and right-click shot in order', () => {
  const g = new Game();
  assert.equal(g.tutorial, null);
  g.startNew();
  assert.equal(g.mode, 'playing');
  assert.equal(g.tutorial.id, 'red');
  const energy = g.player.energy;
  g.player.facing = -1;
  assert.equal(g.attack(), true);
  assert.equal(g.tutorial.progress, 0, 'swinging away does not count');
  tick(g, 20);
  g.player.facing = 1;
  g.attack();
  assert.equal(g.player.energy, energy);
  assert.equal(g.tutorial.stepIndex, 0, 'one successful action cannot advance multiple steps');
  settled(g);
  assert.equal(g.tutorial.step.action, 'cast');
  assert.match(g.tutorial.lastFeedback, /피해 22/, 'last result remains readable on the next step');
  assert.equal(g.tutorialTargets.length, 2);
  g.attack();
  assert.equal(g.tutorial.progress, 0.25, 'J cannot finish the Q exercise');
  const beforeQ = g.player.energy;
  assert.equal(g.cast(), true);
  assert.equal(g.player.energy, beforeQ - 20);
  tick(g, 32);
  assert.equal(g.tutorialTargets[0].hp, 48);
  g.cast(); tick(g, 18);
  assert.ok(g.tutorialTargets.every(t => t.hp === 48));
  settled(g);
  assert.equal(g.enchant(), true);
  assert.equal(g.player.buff.id, 'red');
  settled(g);
  g.enhancedAttack(); tick(g, 8);
  assert.ok(Math.abs(g.tutorialTargets[0].hp - 62.6) < 0.01);
  settled(g);
  assert.equal(g.tutorial.completed, true);
  assert.match(g.tutorial.summary, /15초.*30초/);
  tick(g, 1, { interact: true });
  assert.equal(g.tutorial, null);
  assert.ok(g.getSave().tutorials.includes('red'));
  assert.equal(g.player.buff, null);
});

test('blue appears naturally after walking, then requires scan, enchant and actual dash', () => {
  const g = start(); g.skipTutorial();
  tick(g, 25, { right: true });
  assert.equal(g.tutorial, null);
  tick(g, 15, { right: true });
  assert.equal(g.tutorial.id, 'blue');
  assert.equal(g.cast(), false, 'wrong selected talisman does not progress');
  assert.match(g.tutorial.tip, /청룡/, 'wrong selection guidance is exposed to the tutorial panel');
  g.selectTalisman(1); g.cast();
  assert.equal(g.scanTime, 8);
  assert.equal(g.tutorialTargets[0].revealed, true);
  settled(g); g.enchant(); settled(g);
  tick(g, 1, { dash: true });
  assert.equal(g.player.dashTime, 0.27);
  settled(g);
  assert.equal(g.tutorial.completed, true);
  assert.match(g.tutorial.summary, /35%/);
});

test('white pickup teaches hidden reveal and a real consumed stealth critical', () => {
  const g = white();
  assert.equal(g.objects.find(o => o.id === 'white').active, false);
  g.selectTalisman(2); g.cast();
  assert.equal(g.scanTime, 12);
  settled(g); g.enchant();
  assert.equal(g.player.buff.remaining, 15);
  settled(g); g.enhancedAttack();
  tick(g, 8);
  assert.equal(g.tutorialTargets[0].hp, 56);
  assert.equal(g.player.buff, null);
  assert.ok(g.player.enchantCooldown > 29);
  settled(g);
  assert.equal(g.tutorial.completed, true);
  g.finishTutorial();
  assert.ok(g.validateSave(g.getSave()));
  assert.ok(g.getSave().tutorials.includes('white'));
  assert.equal(g.player.selected, 2);
  assert.equal(g.getSave().player.selected, 2);
});

test('missed white critical resets the enchant exercise without waiting for cooldown', () => {
  const g = white();
  g.selectTalisman(2); g.cast(); settled(g); g.enchant(); settled(g);
  g.player.facing *= -1; g.enhancedAttack();
  tick(g, 60);
  assert.equal(g.tutorial.step.action, 'enchant');
  assert.equal(g.player.enchantCooldown, 0);
  assert.equal(g.enchant(), true);
});

test('black pickup requires a reflected practice projectile and shows armor damage reduction', () => {
  const g = black();
  const hp = g.player.hp;
  g.selectTalisman(3); g.cast();
  assert.equal(g.tutorial.progress, 0, 'cast alone is not enough before contact');
  until(g, () => g.tutorial.step.action === 'enchant');
  assert.equal(g.player.hp, hp);
  assert.equal(g.shieldTime, 0, 'armor demonstration isolates E from the Q shield');
  g.enchant();
  assert.equal(g.player.buff.id, 'black');
  assert.ok(g.effects.some(e => e.type === 'trainingDamage' && e.value === 4));
  settled(g);
  assert.equal(g.tutorial.completed, true);
  assert.equal(g.player.hp, hp);
});

test('evolved white opens only the practice gate and keeps one second after critical', () => {
  const g = evolved();
  const gates = structuredClone(g.objects.filter(o => o.type === 'gate'));
  g.selectTalisman(2); g.cast();
  assert.equal(g.tutorialTargets[0].active, false);
  assert.deepEqual(g.objects.filter(o => o.type === 'gate'), gates);
  settled(g); g.enchant();
  assert.equal(g.player.buff.remaining, 30);
  settled(g); g.enhancedAttack();
  assert.equal(g.player.buff.remaining, 1);
  settled(g);
  assert.equal(g.tutorial.completed, true);
});

test('gumiho grants a queued gold lesson whose practice Q cannot trigger the real choice', () => {
  const g = evolved(); g.skipTutorial();
  const fox = g.enemies.find(e => e.type === 'gumiho');
  g.scanTime = 8;
  for (let i = 0; i < 3; i++) { fox.stun = 0; g.hitEnemy(fox, 22, 'melee'); }
  tick(g);
  assert.equal(g.tutorial.id, 'gold');
  g.selectTalisman(4); settled(g);
  g.player.energy = 0;
  assert.equal(g.cast(), true);
  assert.equal(g.mode, 'playing');
  assert.equal(g.player.energy, 0);
  settled(g);
  assert.equal(g.tutorial.completed, true);
  g.finishTutorial();
  const core = g.objects.find(o => o.type === 'core');
  g.player.x = core.x;
  g.player.selected = 4;
  g.player.energy = 0;
  g.castCooldown = 0;
  assert.equal(g.cast(), false, 'living root still prevents real core choice');
  g.defeat(g.enemies.find(e => e.type === 'root'));
  assert.equal(g.cast(), true, 'core key does not require spell energy');
  assert.equal(g.mode, 'choice');
});

test('practice freezes combat and world mutations, then restores resources and origin without saving practice movement', () => {
  const g = start(); g.skipTutorial();
  g.player.energy = 37;
  g.player.hp = 83;
  g.player.buff = { id: 'blue', remaining: 4 };
  g.player.enchantCooldown = 9;
  g.castCooldown = 0.3;
  const snapshot = structuredClone(g.player);
  const saved = g.getSave();
  const enemies = structuredClone(g.enemies), objects = structuredClone(g.objects);
  assert.equal(g.replayTutorial(), true);
  g.hurt(100, true);
  tick(g, 110, { right: true, cast: true, attack: true, interact: true });
  assert.equal(g.player.hp, 83);
  assert.deepEqual(g.enemies, enemies);
  assert.deepEqual(g.objects, objects);
  assert.equal(g.conscience, 100);
  g.saveCheckpoint();
  assert.deepEqual(g.getSave().player, saved.player);
  g.skipTutorial();
  assert.deepEqual(g.player, snapshot);
  assert.equal(g.castCooldown, 0.3);
});

test('tutorial progress survives resume; old v1 saves teach owned skills and reject bad optional metadata', () => {
  const g = white(); g.skipTutorial();
  const save = g.getSave();
  const resumed = new Game();
  assert.equal(resumed.continueGame(save), true);
  assert.equal(resumed.tutorial, null);
  const old = structuredClone(save); delete old.tutorials;
  assert.equal(resumed.continueGame(old), true);
  assert.equal(resumed.tutorial.id, 'red');
  resumed.skipTutorial();
  assert.equal(resumed.tutorial.id, 'blue');
  resumed.skipTutorial();
  assert.equal(resumed.tutorial.id, 'white');
  for (const value of [null, 'red', ['no-such-lesson'], ['red', 'red'], [1]]) {
    const invalid = structuredClone(save); invalid.tutorials = value;
    assert.equal(resumed.validateSave(invalid), false);
  }
});

test('practice waits for landing and relocates targets without opening real gates', () => {
  const g = start(); skipInitial(g);
  g.player.x = 410; g.player.y = 290; g.player.grounded = false;
  g.unlock(2);
  tick(g);
  assert.equal(g.tutorial, null);
  until(g, () => !!g.tutorial);
  assert.equal(g.tutorial.id, 'white');
  assert.equal(g.player.grounded, true);
  g.player.x += 500;
  tick(g);
  assert.ok(Math.abs(g.tutorialTargets[0].x - g.player.x) < 200);
});

test('evolved saves teach the evolved behavior and omit the obsolete ordinary-white lesson', () => {
  const g = evolved();
  const save = g.getSave(); delete save.tutorials;
  assert.equal(g.continueGame(save), true);
  const lessons = [];
  while (g.tutorial) { lessons.push(g.tutorial.id); g.skipTutorial(); }
  assert.ok(lessons.includes('white-evolved'));
  assert.ok(!lessons.includes('white'));
});

test('practice freezes the platform clock and missed swings cannot inflate demonstration damage', () => {
  const g = start();
  const time = g.time;
  g.player.facing = -1;
  g.attack(); tick(g, 18); g.attack(); tick(g, 18);
  g.player.facing = 1;
  g.attack();
  tick(g, 8);
  assert.equal(g.tutorialTargets[0].hp, 78);
  assert.equal(g.time, time);
  assert.equal(g.stats.time, 0);
  assert.match(g.tutorial.feedback, /22/);
});
