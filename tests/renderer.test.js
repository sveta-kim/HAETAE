import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';
import { TALISMANS } from '../src/content.js';
import { Renderer } from '../src/renderer.js';

// This deliberately small Canvas stand-in rejects non-finite drawing coordinates
// and unbalanced transforms, while letting the actual engine supply render state.
function canvasFixture() {
  let depth = 0;
  let operations = 0;
  const textCalls = [];
  const fills = [];
  const translations = [];
  const finite = (...values) => {
    for (const value of values) assert.ok(Number.isFinite(value), `Invalid Canvas coordinate: ${value}`);
    operations++;
  };
  const gradient = (...values) => {
    finite(...values);
    return { addColorStop(offset, color) {
      assert.ok(offset >= 0 && offset <= 1);
      assert.equal(typeof color, 'string');
    } };
  };
  const context = {
    setTransform: finite,
    translate(x, y) { finite(x, y); translations.push([x, y]); },
    scale: finite,
    fillRect(...values) { finite(...values); fills.push(this.fillStyle); },
    moveTo: finite,
    lineTo: finite,
    arc: finite,
    beginPath() {},
    closePath() {},
    stroke() { operations++; },
    fill() { operations++; fills.push(this.fillStyle); },
    fillText(value, x, y) {
      assert.equal(typeof value, 'string');
      finite(x, y);
      textCalls.push({ value, x, y, color: this.fillStyle });
    },
    createLinearGradient: gradient,
    createRadialGradient: gradient,
    save() { depth++; },
    restore() { assert.ok(depth > 0, 'Canvas restore without save'); depth--; },
    set globalAlpha(value) { assert.ok(value >= 0 && value <= 1, `Invalid Canvas opacity: ${value}`); },
  };
  const canvas = { width: 0, height: 0, getContext(type) { assert.equal(type, '2d'); return context; } };
  return { canvas, textCalls, fills, translations, verify() {
    assert.equal(depth, 0, 'Unbalanced Canvas transform stack');
    assert.ok(operations > 0, 'Renderer produced no drawing operations');
    assert.equal(canvas.width, 960);
    assert.equal(canvas.height, 540);
  } };
}

test('renderer accepts live engine state in every sector and presentation mode', () => {
  const fixture = canvasFixture();
  const renderer = new Renderer(fixture.canvas);
  const game = new Game();
  renderer.render(game); // The real constructor creates the title attract state.
  for (let level = 0; level < 4; level++) {
    game.loadLevel(level);
    game.time = 17.3;
    for (const camera of [0, 650, 1300, 2050, game.worldWidth - 960]) {
      game.camera = camera;
      game.player.x = camera + 200;
      renderer.render(game);
      game.scanTime = 3;
      renderer.render(game);
      game.scanTime = 0;
    }
    for (const mode of ['paused', 'dead', 'choice', 'npc', 'ending']) {
      game.mode = mode;
      renderer.render(game);
    }
  }
  game.camera = 500;
  game.escapeWall = 560;
  for (const route of ['restore', 'destroy']) {
    game.route = route;
    renderer.render(game);
  }
  fixture.verify();
});

test('renderer handles engine enchant identifiers and active combat effects', () => {
  const fixture = canvasFixture();
  const renderer = new Renderer(fixture.canvas);
  const game = new Game();
  game.startNew(false);
  game.player.unlocked = [0, 1, 2, 3, 4];
  game.player.vx = 230;
  game.player.attackTime = .2;
  game.player.dashTime = .15;
  game.shieldTime = 3;
  game.scanTime = 2;
  for (const [index, talisman] of TALISMANS.entries()) {
    game.player.selected = index;
    game.player.buff = { id: talisman.id, remaining: 7 };
    game.effects = [];
    game.effect('cast', 160, 380, talisman.color, 185, .65);
    game.effect('warning', 230, 459, '#ff8a64', 35, .8);
    game.effect('pillar', 330, 459, '#ff9368', 38, .5);
    game.effect('slash', 190, 410, talisman.color, 70, .22);
    game.effect('collect', 280, 340, '#78f3c3', 45);
    game.effect('unrecognized-future-effect', 240, 380, '#abcdef', 40);
    game.projectiles = [{ x: 450, y: 400, w: 13, h: 13, vx: -190, vy: 0, hostile: true }];
    for (const facing of [-1, 1]) {
      game.player.facing = facing;
      renderer.render(game);
      for (const effect of game.effects) effect.life *= .4;
      renderer.render(game);
    }
  }
  // Revealed, stunned, damaged and attacking bosses are public engine states.
  for (let level = 0; level < 3; level++) {
    game.loadLevel(level);
    for (const enemy of game.enemies) {
      game.camera = Math.max(0, enemy.x - 400);
      game.player.x = enemy.x - 100;
      enemy.hitFlash = .12;
      enemy.attackTime = .3;
      enemy.stun = 1;
      enemy.revealed = 2;
      enemy.hp *= .5;
      if (enemy.type === 'gumiho') enemy.tails = 3;
      renderer.render(game);
    }
  }
  fixture.verify();
});

test('renderer supports partial attract state and reduced motion without a DOM', () => {
  const fixture = canvasFixture();
  const renderer = new Renderer(fixture.canvas);
  renderer.render();
  renderer.setReducedMotion(true);
  renderer.render({ time: 20, player: null });
  renderer.render({ player: { x: 80, y: 416 } });
  renderer.resize();
  fixture.verify();
});

test('practice props distinguish melee, cast, reveal, unlocked gate and safe projectiles', () => {
  const fixture = canvasFixture();
  const renderer = new Renderer(fixture.canvas);
  const game = {
    camera: 600,
    tutorial: { active: true },
    tutorialTargets: [
      { id: 'melee', type: 'dummy', x: 720, y: 400, w: 34, h: 60, hp: 50, maxHp: 100 },
      { id: 'cast', type: 'range', x: 840, y: 400, w: 34, h: 60, hp: 100, maxHp: 100 },
      { id: 'reveal', type: 'hidden', x: 960, y: 405, w: 34, h: 55 },
      { id: 'permission', type: 'gate', x: 1100, y: 350, w: 52, h: 110 },
      { id: 'reflection', type: 'projectile', x: 1220, y: 424, w: 16, h: 16 },
      { id: 'gone', type: 'dummy', x: 1250, y: 400, active: false, label: '보이면 안 됨' },
      { id: 'offscreen', type: 'range', x: 2300, y: 400, label: '화면 밖' },
    ],
  };
  renderer.render(game);
  const texts = fixture.textCalls.map(call => call.value);
  for (const expected of ['＋', 'Q', '?', '수련 · 좌클릭 · 조준', '수련 · Q · 발동', '수련 · Q · 탐색', '수련 · 안전한 연습탄']) {
    assert.ok(texts.includes(expected), `Missing practice cue: ${expected}`);
  }
  assert.ok(!texts.includes('드러난 기록'));
  assert.ok(!texts.some(value => /보이면 안 됨|화면 밖/.test(value)));
  assert.ok(fixture.translations.some(([x, y]) => x === -600 && y === 0), 'Practice props must use the world camera');
  assert.ok(fixture.textCalls.filter(call => call.value.startsWith('수련')).every(call => call.y >= 210));
  fixture.textCalls.length = 0;
  game.scanTime = 3;
  game.tutorialTargets[3].active = false;
  renderer.render(game);
  for (const expected of ['드러난 기록', '수련 · 탐색 성공', '통과 가능', '수련 · 해제 완료']) {
    assert.ok(fixture.textCalls.some(call => call.value === expected), `Missing completed practice cue: ${expected}`);
  }
  fixture.verify();
});

test('practice damage labels compare attack results and enchant state is visible on the fan', () => {
  const fixture = canvasFixture();
  const renderer = new Renderer(fixture.canvas);
  const game = {
    player: { x: 250, y: 416, w: 24, h: 44, facing: 1, selected: 0, enchantCooldown: 0 },
    effects: [
      { type: 'trainingDamage', x: 350, y: 370, value: 18, label: '기본 J', color: '#c5b990', life: 1, maxLife: 1.4 },
      { type: 'trainingDamage', x: 480, y: 370, value: 30.6, label: '주작 J', color: '#ff6b70', life: .8, maxLife: 1.4 },
      { type: 'trainingDamage', x: 610, y: 370, label: '반사 성공', life: .4, maxLife: 1.4 },
    ],
  };
  renderer.render(game);
  for (const expected of ['기본 J 18', '주작 J 31', '반사 성공']) assert.ok(fixture.textCalls.some(call => call.value === expected));
  assert.ok(fixture.fills.includes('#c5b990'), 'The base fan is neutral before enchantment');
  fixture.fills.length = 0;
  game.player.enchantCooldown = 20;
  renderer.render(game);
  assert.ok(fixture.fills.includes('#727e88'), 'The fan is gray during cooldown');
  for (const [id, expected] of [['red', '주작 · 공격 강화'], ['blue', '청룡 · 이동·공속 강화'], ['white', '백호 · 은신·치명타'], ['black', '현무 · 방어·반사']]) {
    fixture.textCalls.length = 0;
    game.player.buff = { id, remaining: 8 };
    renderer.render(game);
    assert.ok(fixture.textCalls.some(call => call.value === expected), `Missing enchant cue for ${id}`);
  }
  renderer.setReducedMotion(true);
  renderer.render(game);
  fixture.verify();
});
