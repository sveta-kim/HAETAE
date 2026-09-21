import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';

const tick = (game, frames = 1, input = {}) => {
  for (let i = 0; i < frames; i++) game.update(1 / 60, typeof input === 'function' ? input(i) : input);
};
// Combat regressions run outside the practice sandbox; tutorials have their own integration suite.
const start = options => { const game = new Game({ ...options, tutorials: false }); game.startNew(); return game; };

test('title, pause and invalid timestep never advance combat', () => {
  const game = new Game();
  assert.equal(game.mode, 'title');
  game.update(1 / 60, { right: true });
  assert.equal(game.player.x, 80);
  game.startNew();
  game.pause();
  const before = game.player.x;
  tick(game, 120, { right: true });
  assert.equal(game.player.x, before);
  game.resume();
  game.update(Number.NaN, { right: true });
  game.update(-1, { right: true });
  assert.equal(game.player.x, before);
  tick(game, 10, { right: true });
  assert.ok(game.player.x > before);
});

test('double jump, dash and the tutorial trench are safely traversable', () => {
  const game = start();
  tick(game, 125, { right: true });
  assert.ok(game.player.x > 540 && game.player.x < 620);
  game.update(1 / 60, { right: true, jump: true });
  tick(game, 17, { right: true });
  const y = game.player.y;
  game.update(1 / 60, { right: true, jump: true, dash: true });
  assert.ok(game.player.vy < 0);
  assert.ok(game.player.y < y);
  tick(game, 75, { right: true });
  assert.ok(game.player.x > 900);
  assert.equal(game.mode, 'playing');
  assert.ok(game.player.y <= 416);
});

test('enchant lifetime starts a full 30 second cooldown only after expiration', () => {
  const game = start();
  assert.equal(game.enchant(), true);
  assert.equal(game.player.buff.id, 'red');
  tick(game, 899);
  assert.ok(game.player.buff);
  assert.equal(game.player.enchantCooldown, 0);
  tick(game);
  assert.equal(game.player.buff, null);
  assert.equal(game.player.enchantCooldown, 30);
  tick(game, 1799);
  assert.ok(game.player.enchantCooldown > 0);
  assert.equal(game.enchant(), false);
  tick(game);
  assert.equal(game.player.enchantCooldown, 0);
  assert.equal(game.enchant(), true);
});

test('white enchant breaks on attack and evolved white keeps one second of stealth', () => {
  const game = start();
  game.unlock(2);
  game.selectTalisman(2);
  game.enchant();
  assert.equal(game.player.buff.remaining, 15);
  game.attack();
  assert.equal(game.player.buff, null);
  assert.equal(game.player.enchantCooldown, 30);
  game.player.enchantCooldown = 0;
  game.player.tigerEvolved = true;
  game.enchant();
  assert.equal(game.player.buff.remaining, 30);
  tick(game, 18);
  game.attack();
  assert.equal(game.player.buff.remaining, 1);
  tick(game, 60);
  assert.equal(game.player.buff, null);
  assert.equal(game.player.enchantCooldown, 30);
});

test('bulgasari resists deletion but three cooler overloads defeat it', () => {
  const game = start();
  const enemy = game.enemies.find(e => e.type === 'bulgasari');
  const cooler = game.objects.find(o => o.type === 'cooler');
  game.hitEnemy(enemy, 100, 'red');
  assert.equal(enemy.hp, enemy.maxHp);
  assert.equal(enemy.phase, 2);
  for (let n = 0; n < 3; n++) {
    cooler.cooldown = 0;
    game.activateCooler(cooler);
  }
  assert.equal(enemy.dead, true);
  assert.equal(game.conscience, 100);
  assert.ok(game.getSave().defeated.includes('bulgasari'));
});

test('illusion bosses require scan and gumiho loses exactly three tails per critical', () => {
  const game = start();
  game.unlock(2);
  game.unlock(3);
  game.loadLevel(2);
  const fox = game.enemies.find(e => e.type === 'gumiho');
  assert.equal(game.hitEnemy(fox, 100, 'red'), false);
  assert.equal(fox.tails, 9);
  game.scanTime = 8;
  for (let n = 0; n < 3; n++) {
    fox.stun = 0;
    assert.equal(game.hitEnemy(fox, 22, 'melee'), true);
    assert.equal(fox.tails, 6 - n * 3);
  }
  assert.equal(fox.dead, true);
  assert.ok(game.player.unlocked.includes(4));
  assert.equal(game.player.tigerEvolved, true);
});

test('red enchant burns over time and black enchant reflects close attacks', () => {
  const game = start();
  const enemy = game.enemies.find(e => e.type === 'sunra');
  game.player.x = enemy.x - 65;
  game.enchant();
  game.enhancedAttack();
  tick(game, 8);
  const afterAttack = enemy.hp;
  assert.ok(enemy.burnRemaining > 0);
  tick(game, 35);
  assert.ok(enemy.hp < afterAttack);
  const armorGame = start();
  armorGame.unlock(3);
  armorGame.selectTalisman(3);
  armorGame.enchant();
  const attacker = armorGame.enemies.find(e => e.type === 'sunra');
  armorGame.player.x = attacker.x - 40;
  armorGame.player.invulnerable = 0;
  attacker.cooldown = 0;
  tick(armorGame);
  assert.ok(attacker.hp < attacker.maxHp);
  assert.equal(armorGame.player.hp, 146);
});

test('only civilian destruction, gate demolition and extortion reduce conscience', () => {
  const game = start();
  const record = game.objects.find(o => o.type === 'memory');
  game.player.x = record.x - 60;
  game.player.y = record.y;
  game.cast();
  tick(game, 8);
  assert.equal(record.active, false);
  assert.equal(game.conscience, 95);
  game.hitEnemy(game.enemies.find(e => e.type === 'pabal'), 100, 'melee');
  assert.equal(game.conscience, 95);
  const gate = game.objects.find(o => o.type === 'gate');
  game.player.x = gate.x - 60;
  game.player.y = 416;
  game.castCooldown = 0;
  game.cast();
  tick(game, 8);
  assert.equal(game.conscience, 93);
  const npc = game.objects.find(o => o.type === 'npc');
  game.player.x = npc.x;
  game.interact();
  assert.equal(game.mode, 'npc');
  assert.equal(game.choose('invalid'), false);
  game.choose('extort');
  assert.equal(game.mode, 'playing');
  assert.equal(game.conscience, 73);
  assert.equal(game.choose('extort'), false);
});

test('exit requires both bosses and skipped essential pickups are recovered by guardians', () => {
  const game = start();
  const exit = game.objects.find(o => o.type === 'exit');
  game.player.x = exit.x;
  assert.equal(game.interact(), false);
  assert.equal(game.levelIndex, 0);
  game.defeat(game.enemies.find(e => e.type === 'jangseung'));
  assert.ok(game.player.unlocked.includes(2));
  assert.equal(game.interact(), false);
  game.defeat(game.enemies.find(e => e.type === 'bulgasari'));
  assert.equal(game.interact(), true);
  assert.equal(game.levelIndex, 1);
  assert.equal(game.validateSave(game.getSave()), true);
});

test('checkpoint reconstruction preserves completed mechanics and rejects corrupted saves', () => {
  const emitted = [];
  const game = start({ saveProgress: save => emitted.push(save) });
  game.player.x = 415;
  tick(game);
  const gate = game.objects.find(o => o.type === 'gate');
  game.player.x = gate.x + 5;
  game.player.y = gate.y - game.player.h - 20;
  game.saveCheckpoint();
  for (const save of emitted) assert.equal(game.validateSave(save), true, JSON.stringify(save));
  const valid = game.getSave();
  assert.ok(valid.player.x + 24 <= gate.x);
  assert.equal(game.continueGame(valid), true);
  assert.ok(game.player.unlocked.includes(2));
  assert.equal(game.objects.find(o => o.id === 'white').active, false);
  const corruptions = [
    save => { save.version = 99; },
    save => { save.levelIndex = 4; },
    save => { save.player.x = Number.NaN; },
    save => { save.player.y = -40; },
    save => { save.conscience = 101; },
    save => { save.stats.time = -1; },
    save => { save.player.unlocked = [0, 0]; },
    save => { save.player.selected = 4; },
    save => { save.defeated = ['not-an-enemy']; },
    save => { save.consumed = ['not-an-object']; },
    save => { save.route = 'destroy'; },
  ];
  for (const corrupt of corruptions) {
    const save = structuredClone(valid);
    corrupt(save);
    assert.equal(game.continueGame(save), false);
    assert.equal(game.mode, 'playing');
  }
  assert.equal(game.continueGame(null), false);
  const injected = structuredClone(valid);
  injected.player.w = -1000;
  injected.player.maxHp = 1e99;
  assert.equal(game.continueGame(injected), true);
  assert.equal(game.player.w, 24);
  assert.equal(game.player.maxHp, 150);
  game.player.hp = 0;
  game.mode = 'dead';
  assert.equal(game.retry(), true);
  assert.equal(game.player.hp, 150);
});

test('three endings resolve after escape, including the 75% boundary', () => {
  for (const [route, conscience, ending] of [['destroy', 100, 'black'], ['restore', 75, 'white'], ['restore', 74, 'gray']]) {
    const game = start();
    game.player.unlocked = [0, 1, 2, 3, 4];
    game.player.tigerEvolved = true;
    game.conscience = conscience;
    game.mode = 'choice';
    assert.equal(game.choose(route), true);
    assert.equal(game.mode, 'playing');
    assert.equal(game.ending, null);
    assert.equal(game.levelIndex, 3);
    assert.equal(game.validateSave(game.getSave()), true);
    game.player.x = game.objects.find(o => o.type === 'exit').x;
    game.interact();
    assert.equal(game.mode, 'ending');
    assert.equal(game.ending.id, ending);
  }
});

// This bot uses only public observations and the documented input/choice API.
// It never changes coordinates, health, boss state, damage or resources.
function campaignInput(game, frame) {
  const p = game.player;
  const input = { aim: null, right: true, attack: frame % 18 === 0, interact: frame % 12 === 0 };
  if (game.levelIndex === 3) {
    input.dash = frame % 48 === 0;
    input.jump = frame % 55 === 0;
    input.select = 2;
    const gate = game.objects.find(o => o.type === 'gate' && o.active && o.x - p.x < 220 && o.x > p.x - 40);
    if (gate) input.cast = frame % 32 === 0;
    return input;
  }
  const targetBoss = game.enemies.find(e => e.boss && !e.dead && e.x > p.x - 120);
  if (targetBoss && targetBoss.x - p.x < 480) {
    const target = targetBoss.type === 'bulgasari' ? game.objects.find(o => o.id === 'cooler').x - 40 : targetBoss.x - 55;
    input.right = p.x < target - 8;
    input.left = p.x > target + 8;
    if (targetBoss.type === 'bulgasari') return input;
    const illusion = ['jangsan', 'gumiho'].includes(targetBoss.type);
    input.select = illusion ? 1 : 0;
    input.cast = illusion ? game.scanTime < 0.8 : frame % 48 === 0;
    input.enchant = !illusion && !p.buff && p.enchantCooldown === 0;
  } else {
    input.jump = frame % 70 === 0;
    input.select = 0;
  }
  const gate = game.objects.find(o => o.type === 'gate' && o.value !== 'illusion' && o.active && o.x - p.x < 205 && o.x > p.x - 40);
  if (gate && gate.value === 'sudo') { input.select = 2; input.cast = frame % 32 === 0; }
  return input;
}

for (const [route, citizenChoice, expectedEnding, withTutorials = false] of [
  ['restore', 'protect', 'white'],
  ['restore', 'extort', 'gray'],
  ['destroy', 'protect', 'black'],
  ['restore', 'protect', 'white', true],
]) test(`full four-stage ${expectedEnding} campaign${withTutorials ? ' with all acquisition lessons' : ''} completes using only real movement and combat inputs`, () => {
  const saves = [];
  const game = new Game({ tutorials: withTutorials, saveProgress: save => saves.push(save) });
  game.startNew();
  const visited = new Set([0]);
  for (let frame = 0; frame < 60 * 240 && game.mode !== 'ending'; frame++) {
    assert.notEqual(game.mode, 'dead', `died in stage ${game.levelIndex}, x=${game.player.x}, frame=${frame}`);
    if (game.mode === 'npc') game.choose(citizenChoice);
    if (game.mode === 'choice') game.choose(route);
    const lesson = game.tutorial;
    if (lesson) {
      const action = lesson.step.action;
      game.update(1 / 60, {
        select: lesson.index,
        interact: lesson.completed,
        attack: action === 'attack' && frame % 18 === 0,
        enhancedAttack: action === 'enhancedAttack' && frame % 18 === 0,
        aim: game.tutorialTargets.find(t => t.active) ? { x: game.tutorialTargets.find(t => t.active).x + 16 - game.camera, y: game.tutorialTargets.find(t => t.active).y + 22 } : null,
        cast: ['cast', 'inspect'].includes(action) && frame % 32 === 0,
        enchant: action === 'enchant' && frame % 18 === 0,
        dash: action === 'dash' && frame % 18 === 0,
      });
    } else game.update(1 / 60, campaignInput(game, frame));
    visited.add(game.levelIndex);
  }
  assert.equal(game.mode, 'ending', `stalled stage ${game.levelIndex}, x=${game.player.x}, hint=${game.hint}, live=${game.enemies.filter(e => !e.dead).map(e => `${e.type}:${e.hp}`).join(',')}`);
  assert.deepEqual([...visited], [0, 1, 2, 3]);
  assert.equal(game.ending.id, expectedEnding);
  assert.deepEqual(game.player.unlocked, [0, 1, 2, 3, 4]);
  assert.ok(game.stats.kills >= 6);
  assert.ok(saves.length >= 12);
  if (withTutorials) assert.equal(game.tutorialDirector.learned.length, 6);
  for (const save of saves) assert.equal(game.validateSave(save), true, `emitted invalid save: ${JSON.stringify(save)}`);
});
