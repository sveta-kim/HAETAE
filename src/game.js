import { createLevel, LEVELS, TALISMANS, ENDINGS } from './content.js';
import { sweep } from './collision.js';
import { TutorialDirector, TUTORIAL_IDS } from './tutorials.js';

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const centerX = a => a.x + a.w / 2;
const distance = (a, b) => Math.abs(centerX(a) - centerX(b));
const copy = data => structuredClone(data);
const finite = n => typeof n === 'number' && Number.isFinite(n);
const STATS = ['kills', 'memories', 'logs', 'damageTaken', 'time'];
const EMPTY_INPUT = {};

export class Game {
  constructor({ onEvent = () => {}, saveProgress = () => {}, tutorials = true } = {}) {
    this.onEvent = onEvent;
    this.saveProgress = saveProgress;
    this.saveVersion = 1;
    this.tutorialsEnabled = tutorials;
    this.startNew(false);
    this.mode = 'title';
  }

  startNew(persist = true) {
    this.tutorialDirector = new TutorialDirector(this, this.tutorialsEnabled);
    this.time = 0;
    this.conscience = 100;
    this.stats = { kills: 0, memories: 0, logs: 0, damageTaken: 0, time: 0 };
    this.route = null;
    this.ending = null;
    this.player = {
      x: 80, y: 416, w: 24, h: 44, vx: 0, vy: 0, facing: 1,
      hp: 150, maxHp: 150, energy: 100, maxEnergy: 100,
      grounded: true, invulnerable: 0, dashTime: 0, attackTime: 0,
      combo: 0, buff: null, enchantCooldown: 0, selected: 0,
      unlocked: [0, 1], tigerEvolved: false,
    };
    this.loadLevel(0);
    if (persist) this.saveCheckpoint();
    if (persist) { this.tutorialDirector.enqueue('red'); this.tutorialDirector.startNext(); }
    return true;
  }

  loadLevel(index) {
    const stage = createLevel(index);
    this.levelIndex = index;
    this.level = { name: stage.name, subtitle: stage.subtitle, objective: stage.objective, theme: stage.theme };
    if (index === 3 && this.route === 'restore') this.level.name = '백화 · 귀환의 나루터';
    this.worldWidth = stage.width;
    this.platforms = stage.platforms.map(p => ({ ...p, baseX: p.x }));
    this.enemies = stage.enemies.map(e => ({ ...e, originX: e.x, cooldown: 1.2, stun: 0, revealed: 0, hitFlash: 0 }));
    this.objects = stage.objects;
    this.projectiles = [];
    this.effects = [];
    this.camera = 0;
    this.aim = null;
    this.boss = null;
    this.escapeWall = index === 3 ? -460 : null;
    this.escapeGrace = 3;
    this.scanTime = 0;
    this.shieldTime = 0;
    this.castCooldown = 0;
    this.dashCooldown = 0;
    this.dashDirection = 1;
    this.attackCooldown = 0;
    this.comboTime = 0;
    this.jumps = 0;
    this.coyoteTime = 0;
    this.mode = 'playing';
    this.objective = this.level.objective;
    this.hint = '';
    this.message = '';
    this.messageTime = 0;
    this.pendingNpc = null;
    this.player.x = 80;
    this.player.y = 416;
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.hp = this.player.maxHp;
    this.player.energy = this.player.maxEnergy;
    this.player.buff = null;
    this.player.enchantCooldown = 0;
    this.player.invulnerable = 1.2;
    this.player.dashTime = 0;
    this.player.attackTime = 0;
    this.player.grounded = true;
    this.notice(index === 0 ? '潜入 / 소도에 접속했습니다. A·D 이동, Space 2단 점프, 좌클릭 공격.' : this.level.objective);
  }

  notice(text, duration = 4) {
    this.message = text;
    this.messageTime = duration;
    if (this.tutorial && !this.tutorial.feedbackTime && !this.tutorial.completed) this.tutorial.tip = text;
    this.onEvent({ type: 'notice', text });
  }

  sound(name) { this.onEvent({ type: 'sound', name }); }

  effect(type, x, y, color, radius = 38, life = 0.5) {
    this.effects.push({ type, x, y, color, radius, life, maxLife: life, facing: this.player.facing });
  }

  pause() { if (this.mode === 'playing') this.mode = 'paused'; }
  resume() { if (this.mode === 'paused') this.mode = 'playing'; }

  finishTutorial() { return this.tutorialDirector.finish(); }
  skipTutorial() { return this.tutorialDirector.finish(true); }
  replayTutorial() {
    if (this.tutorial || this.mode !== 'playing' || !this.player.unlocked.includes(this.player.selected)) return false;
    const id = this.player.selected === 2 && this.player.tigerEvolved ? 'white-evolved' : TALISMANS[this.player.selected].id;
    this.tutorialDirector.enqueue(id, true);
    return this.tutorialDirector.startNext();
  }

  selectTalisman(index) {
    if (Number.isInteger(index) && index >= 0 && index < 5) {
      this.player.selected = index;
      if (this.tutorial && this.tutorial.index === index) this.tutorialDirector.record('select', `${TALISMANS[index].name} 선택 완료. 코어의 잠금 조건을 확인해 봅시다.`);
      return true;
    }
    return false;
  }

  update(dt, input = EMPTY_INPUT) {
    if (!finite(dt) || dt <= 0) return;
    // Bound one update so tab switching cannot move through solid geometry.
    dt = Math.min(dt, 1 / 30);
    if (this.mode === 'title') { this.time += dt; return; }
    if (this.mode !== 'playing') return;
    if (!this.tutorial && this.player.x >= 220 && this.tutorialDirector.learned.includes('red')) this.tutorialDirector.enqueue('blue');
    this.tutorialDirector.startNext();
    if (!this.tutorial) { this.time += dt; this.stats.time += dt; }
    const p = this.player;
    if (input.select != null) this.selectTalisman(input.select);
    if (Number.isSafeInteger(input.cycle) && input.cycle && p.unlocked.length) {
      const direction = Math.sign(input.cycle);
      const steps = (Math.abs(input.cycle) - 1) % p.unlocked.length + 1;
      let index = p.selected;
      for (let step = 0; step < steps; step++) {
        do { index = (index + direction + 5) % 5; } while (!p.unlocked.includes(index));
      }
      this.selectTalisman(index);
    }
    if ('aim' in input) this.aim = input.aim && finite(input.aim.x) && finite(input.aim.y) ? { x: input.aim.x + this.camera, y: input.aim.y } : null;
    if (this.aim) p.facing = this.aim.x >= centerX(p) ? 1 : -1;
    for (const field of ['scanTime', 'shieldTime', 'castCooldown', 'dashCooldown', 'attackCooldown', 'comboTime', 'messageTime']) {
      this[field] = this[field] - dt < 1e-8 ? 0 : this[field] - dt;
    }
    for (const field of ['invulnerable', 'dashTime', 'attackTime', 'enchantCooldown']) p[field] = p[field] - dt < 1e-8 ? 0 : p[field] - dt;
    if (p.buff) {
      p.buff.remaining = Math.max(0, p.buff.remaining - dt);
      if (p.buff.remaining <= 1e-8) this.endEnchant();
    }
    p.energy = Math.min(p.maxEnergy, p.energy + dt * 14);
    if (!this.tutorial) for (const o of this.objects) o.cooldown = Math.max(0, (o.cooldown || 0) - dt);
    this.effects = this.effects.filter(e => (e.life -= dt) > 0);
    if (!this.comboTime) p.combo = 0;

    if (input.enchant) this.enchant();
    if (input.cast) this.cast();
    if (input.enhancedAttack) this.enhancedAttack();
    else if (input.attack) this.attack();
    if (input.interact) {
      const lesson = this.tutorial;
      this.interact();
      if (lesson && lesson !== this.tutorial) return;
    }
    if (this.mode !== 'playing') return;

    const direction = Number(!!input.right) - Number(!!input.left);
    if (direction && !this.aim) p.facing = direction;
    if (p.grounded) { this.jumps = 0; this.coyoteTime = 0.1; }
    else this.coyoteTime = Math.max(0, this.coyoteTime - dt);
    if (input.jump && (this.jumps < 2 || this.coyoteTime > 0)) {
      if (!p.grounded && !this.coyoteTime && this.jumps === 0) this.jumps = 1;
      p.vy = -505;
      p.grounded = false;
      this.jumps++;
      this.coyoteTime = 0;
      this.sound('jump');
      this.effect('jump', centerX(p), p.y + p.h, '#a9d5de', 22, 0.25);
    }
    if (input.dash && !this.dashCooldown) {
      this.dashDirection = direction || p.facing;
      p.dashTime = p.buff?.id === 'blue' ? 0.27 : 0.19;
      this.dashCooldown = 0.7;
      p.invulnerable = Math.max(p.invulnerable, p.dashTime);
      this.sound('dash');
      this.effect('dash', centerX(p), p.y + 23, '#55d7ef', 46, 0.25);
      if (this.tutorial && p.buff?.id === 'blue') this.tutorialDirector.record('dash', '청룡 대시! 약 42% 더 멀리 나갑니다. 걷는 속도도 약 35% 빨라졌습니다.');
    }
    let speed = p.buff?.id === 'blue' ? 310 : 230;
    // A visible archive spill slows the escape path; chmod ignores it.
    this.inDataSwamp = this.levelIndex === 3 && p.x > 930 && p.x < 1320;
    if (this.inDataSwamp && p.buff?.id !== 'black' && !this.shieldTime) speed *= 0.72;
    p.vx = p.dashTime > 0 ? this.dashDirection * 760 : direction * speed;
    if (p.dashTime > 0) p.vy *= 0.75;
    else p.vy = Math.min(850, p.vy + 1430 * dt);

    this.movePlayer(dt);
    if (this.tutorial) {
      this.updateProjectiles(dt);
      this.tutorialDirector.update(dt);
      this.updateHint();
      this.camera = clamp(p.x - 350, 0, Math.max(0, this.worldWidth - 960));
      return;
    }
    this.updateEnemies(dt);
    this.updateProjectiles(dt);
    if (this.mode !== 'playing') return;
    this.collectNearby();
    this.tutorialDirector.startNext();
    if (this.tutorial) { this.updateHint(); this.camera = clamp(p.x - 350, 0, Math.max(0, this.worldWidth - 960)); return; }
    this.updateEscape(dt);
    this.updateHint();
    this.camera = clamp(p.x - 350, 0, Math.max(0, this.worldWidth - 960));
  }

  solidPlatforms() {
    return this.platforms.filter(p => !p.hidden || this.scanTime > 0 || this.player.tigerEvolved);
  }

  solidGates() { return this.objects.filter(o => o.type === 'gate' && o.active && o.value !== 'illusion'); }

  movePlayer(dt) {
    const p = this.player;
    const oldX = p.x;
    p.x = clamp(p.x + p.vx * dt, 0, this.worldWidth - p.w);
    for (const gate of this.solidGates()) {
      if (!overlaps(p, gate)) continue;
      if (oldX + p.w <= gate.x + 2) p.x = gate.x - p.w;
      else if (oldX >= gate.x + gate.w - 2) p.x = gate.x + gate.w;
      else p.x = centerX(p) < centerX(gate) ? gate.x - p.w : gate.x + gate.w;
      p.vx = 0;
    }
    const oldBottom = p.y + p.h;
    p.y += p.vy * dt;
    p.grounded = false;
    for (const platform of this.solidPlatforms()) {
      if (platform.moving && !this.tutorial) platform.x = platform.baseX + Math.sin(this.time * 0.9) * 65;
      if (p.vy >= 0 && oldBottom <= platform.y + 2 && p.y + p.h >= platform.y && p.x + p.w > platform.x && p.x < platform.x + platform.w) {
        p.y = platform.y - p.h;
        p.vy = 0;
        p.grounded = true;
      }
    }
    if (p.y > 610) {
      this.hurt(22, true);
      if (this.mode === 'playing') {
        const x = clamp(p.x - 110, 40, this.worldWidth - 80);
        const support = this.platforms.filter(s => !s.hidden && s.x <= x && s.x + s.w >= x + p.w).sort((a, b) => b.y - a.y)[0];
        p.x = support ? x : 80;
        p.y = support ? support.y - p.h : 416;
        p.vy = 0;
        p.invulnerable = 1.8;
      }
    }
  }

  fireShot({ damage, source, buff = null, range = 650, color = '#c2eeed', action = 'attack' }) {
    const p = this.player;
    const x = centerX(p), y = p.y + 20;
    let dx = this.aim ? this.aim.x - x : p.facing, dy = this.aim ? this.aim.y - y : 0;
    const length = Math.hypot(dx, dy);
    if (length < 0.001) { dx = p.facing; dy = 0; }
    else { dx /= length; dy /= length; }
    if (Math.abs(dx) > 0.001) p.facing = dx > 0 ? 1 : -1;
    this.projectiles.push({ x: x - 4, y: y - 4, w: 8, h: 8, vx: dx * 760, vy: dy * 760,
      hostile: false, playerShot: true, damage, source, buff, action, color, life: range / 760 });
  }

  enhancedAttack() {
    if (this.attackCooldown > 0) return false;
    const p = this.player;
    if (!p.unlocked.includes(p.selected)) { this.notice('아직 얻지 못한 부적입니다. 휠이나 1–5로 보유 부적을 선택하세요.'); return false; }
    if (p.selected === 4) { this.notice('기린은 코어의 열쇠입니다. 좌클릭으로 기본 공격하세요.'); return false; }
    // An explicit preparation lesson teaches E without spending a white critical.
    if (this.tutorial?.step.action === 'enchant') { this.notice('이번 단계에서는 E로 강화만 준비하세요. 다음 단계에서 우클릭합니다.'); return false; }
    if (!p.buff && !this.enchant()) return false;
    if (p.buff.id !== TALISMANS[p.selected].id) { this.notice('다른 부적의 강화가 유지 중입니다. 상태창의 부적을 선택하거나 강화 종료를 기다리세요.'); return false; }
    return this.attack(true);
  }

  attack(enhanced = false) {
    if (this.attackCooldown > 0) return false;
    const p = this.player;
    const buff = enhanced ? p.buff?.id : null;
    p.combo = this.tutorial ? 1 : this.comboTime > 0 ? (p.combo % 3) + 1 : 1;
    this.comboTime = 0.85;
    this.attackCooldown = buff === 'blue' ? 0.19 : 0.28;
    p.attackTime = 0.2;
    let damage = p.combo === 3 ? 32 : 22;
    if (buff === 'red') damage *= 1.7;
    if (buff === 'white') damage *= 2;
    const color = buff ? TALISMANS.find(t => t.id === buff).color : '#c2eeed';
    this.sound('attack');
    this.effect('slash', centerX(p), p.y + 20, color, 34, 0.15);
    this.fireShot({ damage, source: buff === 'white' ? 'critical' : 'melee', buff, color, action: enhanced ? 'enhancedAttack' : 'attack' });
    if (p.buff?.id === 'white') {
      if (p.tigerEvolved) p.buff.remaining = Math.min(1, p.buff.remaining);
      else this.endEnchant();
    }
    return true;
  }

  enchant() {
    const p = this.player;
    const talisman = TALISMANS[p.selected];
    if (!p.unlocked.includes(p.selected)) { this.notice('아직 얻지 못한 부적입니다.'); return false; }
    if (this.tutorial && p.selected !== this.tutorial.index) { this.notice(`이번 수련은 ${TALISMANS[this.tutorial.index].name}(${this.tutorial.index + 1})을 선택하세요.`); return false; }
    if (this.tutorial && this.tutorial.step.action !== 'enchant' && this.tutorial.step.buff !== talisman.id) { this.notice(this.tutorial.step.goal, 2); return false; }
    if (p.selected === 4) { this.notice('기린은 코어를 심판하는 열쇠입니다. 인챈트할 수 없습니다.'); return false; }
    if (p.buff) { this.notice('이미 부적이 깃들어 있습니다. 효과가 끝나면 냉각을 시작합니다.'); return false; }
    if (p.enchantCooldown > 0) { this.notice(`옥추선 냉각 중 · ${Math.ceil(p.enchantCooldown)}초`); return false; }
    p.buff = { id: talisman.id, remaining: p.selected === 2 && p.tigerEvolved ? 30 : talisman.duration };
    this.sound('enchant');
    this.effect('enchant', centerX(p), p.y + 20, talisman.color, 80, 0.7);
    this.notice(`${talisman.name}의 힘이 옥추선에 깃듭니다.`);
    if (this.tutorial) this.tutorialDirector.enchanted();
    return true;
  }

  endEnchant() {
    if (!this.player.buff) return;
    this.player.buff = null;
    this.player.enchantCooldown = 30;
    this.notice('시스템이 과열됐군… 옥추선 냉각 30초.', 2.5);
  }

  cast() {
    if (!this.player.unlocked.includes(this.player.selected)) { this.notice('아직 얻지 못한 부적입니다.'); return false; }
    if (this.tutorial) return this.tutorialDirector.cast();
    if (this.castCooldown > 0) return false;
    const p = this.player;
    if (p.selected === 4) {
      const core = this.objects.find(o => o.type === 'core' && o.active && distance(o, p) < 190);
      if (core) return this.interact();
      this.notice('기린은 국본을 쓰러뜨린 뒤 루트 코어 앞에서 사용할 수 있습니다.');
      return false;
    }
    if (p.energy < 20) { this.notice('기력이 부족합니다. 잠시 후 다시 시도하세요.', 1.5); return false; }
    p.energy -= 20;
    this.castCooldown = 0.48;
    this.sound('cast');
    const talisman = TALISMANS[p.selected];
    this.effect('cast', centerX(p), p.y + 18, talisman.color, p.selected === 0 ? 34 : 250, 0.65);
    if (p.selected === 0) {
      this.fireShot({ damage: 52, source: 'red', color: talisman.color, range: 800, action: 'cast' });
    } else if (p.selected === 1 || p.selected === 2) {
      this.scanTime = p.selected === 2 ? 12 : 8;
      for (const e of this.enemies) if (!e.dead && distance(e, p) < 650) e.revealed = this.scanTime;
      if (p.selected === 2 && p.tigerEvolved) {
        let opened = false;
        for (const gate of this.objects.filter(o => o.type === 'gate' && o.active && distance(o, p) < 235 && o.value !== 'illusion')) {
          gate.active = false;
          opened = true;
          this.effect('unlock', centerX(gate), gate.y + 50, '#fcf2d8', 70);
        }
        if (opened) { this.notice('sudo · 권한을 승인했습니다.'); this.saveCheckpoint(); }
        else this.notice('백호가 숨은 길과 진실을 드러냅니다.');
      } else this.notice(p.selected === 2 ? 'ls -a · 숨겨진 진실을 탐지합니다.' : '청룡의 전류가 주변의 흔적을 드러냅니다.', 2.5);
    } else if (p.selected === 3) {
      this.shieldTime = 5;
      this.notice('chmod · 현무의 방패가 공격을 반사합니다.', 2);
    }
    return true;
  }

  hitEnemy(e, damage, source = 'melee') {
    if (e.dead) return false;
    if (e.type === 'bulgasari' && source !== 'cooler' && source !== 'reflect' && e.stun <= 0) {
      if (source === 'red') { e.phase = Math.min(3, e.phase + 1); this.notice('불가사리가 삭제 코드를 먹었습니다! 옆의 냉각 장치를 타격하세요.'); }
      else if (!this.messageTime) this.notice('장갑이 재생됩니다. 냉각 장치를 좌클릭 또는 F로 작동시키세요.');
      this.effect('block', centerX(e), e.y + 40, '#81cbfa', 45);
      return false;
    }
    if ((e.type === 'jangsan' || e.type === 'gumiho') && !this.scanTime && !e.revealed) {
      this.notice('환영에는 공격이 닿지 않습니다. 청룡 또는 백호로 스캔하세요.', 2);
      return false;
    }
    if (e.type === 'shield' && source === 'melee' && Math.sign(centerX(this.player) - centerX(e)) === e.facing) {
      this.notice('정면 방패! 뛰어넘어 등 뒤를 노리거나 주작을 사용하세요.', 2);
      return false;
    }
    if (e.type === 'gumiho') {
      if (e.stun > 0) return false;
      e.tails = Math.max(0, e.tails - 3);
      damage = e.maxHp / 3;
      e.stun = 0.65;
      this.notice(`치명타 · 암호 해제! 남은 꼬리 ${e.tails}개`, 2);
    }
    e.hp = Math.max(0, e.hp - damage);
    e.hitFlash = 0.13;
    this.effect('hit', centerX(e), e.y + e.h / 2, source === 'red' ? '#ff5871' : '#e8fff1', 28, 0.3);
    this.sound('hit');
    if (e.hp <= 0) this.defeat(e);
    return true;
  }

  defeat(e) {
    e.dead = true;
    e.hp = 0;
    this.stats.kills++;
    this.player.energy = Math.min(100, this.player.energy + (e.boss ? 50 : 12));
    this.player.hp = Math.min(this.player.maxHp, this.player.hp + (e.boss ? 35 : 5));
    this.effect('defeat', centerX(e), e.y + 35, '#fbce7d', e.boss ? 100 : 42, 1);
    this.sound(e.boss ? 'boss' : 'defeat');
    // Stage guardians also grant any essential pickup that was jumped over.
    const recoveredPickup = (e.type === 'jangseung' && !this.player.unlocked.includes(2)) || (e.type === 'sagwan' && !this.player.unlocked.includes(3));
    if (e.type === 'jangseung') this.unlock(2);
    if (e.type === 'sagwan') this.unlock(3);
    if (e.type === 'gumiho') {
      this.unlock(2);
      if (!this.player.tigerEvolved) this.tutorialDirector.enqueue('white-evolved');
      this.player.tigerEvolved = true;
      this.unlock(4);
      this.notice('구미호의 암호가 풀렸습니다. 미완성 기린 부적 획득!');
    } else if (e.type === 'root') {
      this.notice('국본의 통제가 끊겼습니다. 오른쪽 코어로 이동해 F를 누르세요.', 6);
      this.objective = '루트 코어에 기린 부적을 대고 소도의 운명을 선택하세요.';
    } else if (e.boss) this.notice(`${e.name.split(' · ')[0]} 격파 · ${recoveredPickup ? '보스의 기록에서 놓친 부적을 회수했습니다.' : '접속 기록이 저장되었습니다.'}`, 4);
    if (e.boss) this.saveCheckpoint();
  }

  activateCooler(o) {
    if (o.cooldown > 0) return;
    if (o.value === 'shelf') {
      const shelf = this.platforms.find(p => p.moving);
      if (shelf) { shelf.y = 350; shelf.moving = !shelf.moving; }
      o.cooldown = 1;
      this.notice('책장 서랍이 확장되었습니다. 위쪽 기록에 접근할 수 있습니다.');
      return;
    }
    const bulga = this.enemies.find(e => e.type === 'bulgasari' && !e.dead);
    if (!bulga) { this.notice('격리 구역 냉각 완료.'); return; }
    o.cooldown = 2.2;
    bulga.stun = 2.5;
    this.hitEnemy(bulga, 65, 'cooler');
    this.effect('cooler', centerX(o), o.y, '#6ce0ff', 170, 0.9);
    this.notice(bulga.dead ? '과부하 완료. 불가사리의 삭제 루프가 정지했습니다.' : '냉각 과부하! 불가사리가 멈췄습니다. 2초 뒤 재사용 가능.');
    this.sound('cast');
  }

  interact() {
    if (this.tutorial) return this.finishTutorial();
    const p = this.player;
    const nearby = this.objects.filter(o => o.active && distance(o, p) < (o.type === 'core' ? 160 : 100) && Math.abs(o.y - p.y) < 170);
    const priority = { core: 0, npc: 1, exit: 2, cooler: 3, gate: 4, log: 5, memory: 6 };
    nearby.sort((a, b) => (priority[a.type] ?? 8) - (priority[b.type] ?? 8));
    for (const o of nearby) {
      if (o.type === 'npc') { this.pendingNpc = o.id; this.mode = 'npc'; return true; }
      if (o.type === 'cooler') { this.activateCooler(o); return true; }
      if (o.type === 'core') {
        if (this.enemies.some(e => e.boss && !e.dead)) { this.notice('아직 보안 보스가 코어를 통제하고 있습니다.'); return false; }
        if (!p.unlocked.includes(4)) { this.notice('기린 부적이 필요합니다.'); return false; }
        this.mode = 'choice';
        return true;
      }
      if (o.type === 'exit') {
        if (this.enemies.some(e => e.boss && !e.dead)) { this.notice('보안 보스가 통로를 봉쇄했습니다. 남은 보스를 먼저 해제하세요.'); return false; }
        if (this.levelIndex === 3) this.finish();
        else { this.loadLevel(this.levelIndex + 1); this.saveCheckpoint(); }
        return true;
      }
      if (o.type === 'gate') {
        if (o.value === 'illusion') {
          if (this.scanTime > 0) { o.active = false; this.notice('가짜 출구를 식별했습니다. 진짜 길은 오른쪽입니다.'); }
          else { this.hurt(12); this.notice('가짜 출구입니다! 백호 또는 청룡으로 진실을 스캔하세요.'); }
        } else if (o.value === 'key' && !this.enemies.some(e => e.id === 'bulgasari' && !e.dead)) {
          o.active = false;
          this.notice('격리 구역의 보안 키로 성문을 열었습니다.');
          this.saveCheckpoint();
        } else if (p.tigerEvolved) {
          this.notice('백호를 선택(3)하고 Q로 sudo를 사용하세요.');
        } else this.notice('권한이 부족해… 이 문은 보안 키 또는 주작으로 열 수 있습니다.');
        return true;
      }
      if (o.type === 'log' && o.value === 'story') { this.collectRecord(o); return true; }
      if (o.type === 'memory') { this.collectRecord(o); return true; }
    }
    return false;
  }

  choose(value) {
    if (this.mode === 'npc') {
      if (!['protect', 'extort'].includes(value)) return false;
      const npc = this.objects.find(o => o.id === this.pendingNpc && o.active);
      if (!npc) return false;
      npc.active = false;
      this.pendingNpc = null;
      this.mode = 'playing';
      if (value === 'extort') {
        this.conscience = Math.max(0, this.conscience - 20);
        this.player.hp = this.player.maxHp;
        this.player.energy = this.player.maxEnergy;
        this.notice('시민의 데이터를 대가로 회복했습니다. 양심 −20');
      } else {
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + 25);
        this.notice('“고마워요, 도사님.” 시민의 기록을 안전한 영역으로 옮겼습니다.');
      }
      this.saveCheckpoint();
      return true;
    }
    if (this.mode !== 'choice' || !['destroy', 'restore'].includes(value)) return false;
    this.route = value;
    this.loadLevel(3);
    this.notice(value === 'destroy' ? '코어 삭제. 아귀가 깨어납니다. 로그를 지우며 오른쪽 나루터로 달리세요!' : '코어 정화. 무결성 검사 해치가 다가옵니다. 오른쪽 나루터로 귀환하세요!', 7);
    this.saveCheckpoint();
    return true;
  }

  unlock(index) {
    if (!this.player.unlocked.includes(index)) {
      this.player.unlocked.push(index);
      this.player.unlocked.sort();
      this.tutorialDirector.enqueue(TALISMANS[index].id);
    }
  }

  collectRecord(o) {
    o.active = false;
    if (o.type === 'memory') this.stats.memories++;
    else this.stats.logs++;
    this.player.energy = Math.min(this.player.maxEnergy, this.player.energy + 15);
    this.notice(o.value === 'story' ? '설계자의 기록: “소도는 누구도 버리지 않는 곳이어야 한다. 매화야, 이 약속을 지켜다오.”' : `기록 보존 · ${o.label}`, o.value === 'story' ? 7 : 3);
    this.effect('collect', centerX(o), o.y + 15, '#78f3c3', 45);
    this.sound('collect');
    this.saveCheckpoint();
  }

  collectNearby() {
    const p = this.player;
    for (const o of this.objects) {
      if (!o.active || !overlaps(p, { ...o, x: o.x - 8, w: o.w + 16 })) continue;
      if (o.type === 'talisman') {
        o.active = false;
        if (o.value === 'evolve') {
          this.unlock(2);
          p.tigerEvolved = true;
          this.tutorialDirector.enqueue('white-evolved');
          this.notice('백호 각성 · sudo! 권한의 벽을 열고, 은형을 30초 유지합니다.', 6);
        } else { this.unlock(o.value); this.notice(`${o.label} 획득 · 숫자 ${o.value + 1}로 선택하세요.`, 5); }
        this.sound('collect');
        this.effect('collect', centerX(o), o.y + 12, '#f8d28b', 90, 0.9);
        this.saveCheckpoint();
      } else if (o.type === 'memory' || (o.type === 'log' && o.value === 'story')) this.collectRecord(o);
      else if (o.type === 'checkpoint') {
        o.active = false;
        p.hp = p.maxHp;
        p.energy = p.maxEnergy;
        this.notice('접속점 저장 · 체력과 기력을 회복했습니다.', 2.8);
        this.sound('checkpoint');
        this.saveCheckpoint();
      }
    }
  }

  eraseLog(o) {
    if (!o.active) return;
    o.active = false;
    this.stats.logs++;
    if (this.escapeWall != null) this.escapeWall -= 170;
    this.player.energy = Math.min(100, this.player.energy + 24);
    this.effect('collect', centerX(o), o.y, this.route === 'restore' ? '#fff2c9' : '#ff647b', 70, 0.8);
    this.notice('접속 로그 소거 · 추격 프로세스를 늦췄습니다.', 2);
    this.sound('collect');
  }

  updateEnemies(dt) {
    const p = this.player;
    let nearestBoss = null;
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (e.burnRemaining > 0) {
        e.burnRemaining = Math.max(0, e.burnRemaining - dt);
        e.burnTick -= dt;
        if (e.burnTick <= 0) { e.burnTick = 0.5; this.hitEnemy(e, 5, 'burn'); }
        if (e.dead) continue;
      }
      e.hitFlash = Math.max(0, e.hitFlash - dt);
      e.revealed = Math.max(0, e.revealed - dt);
      e.stun = Math.max(0, e.stun - dt);
      e.attackTime = Math.max(0, e.attackTime - dt);
      const range = distance(e, p);
      if (e.boss && range < 650 && (!nearestBoss || range < distance(nearestBoss, p))) nearestBoss = e;
      if (range > 720) continue;
      e.timer += dt;
      if (e.stun > 0) continue;
      const stealth = p.buff?.id === 'white' && !e.boss;
      if (stealth) { e.alert = false; continue; }
      e.alert = range < (e.boss ? 580 : 390);
      if (!e.alert) continue;
      e.facing = centerX(p) >= centerX(e) ? 1 : -1;
      e.cooldown -= dt;
      if (!e.boss && range > 48 && range < 380) {
        const speed = e.type === 'pabal' ? 66 : e.type === 'shield' ? 24 : 40;
        e.x = clamp(e.x + e.facing * speed * dt, e.originX - 170, e.originX + 170);
      }
      if (e.boss && range < 320 && range > 106 && !['sagwan', 'root'].includes(e.type)) {
        e.x = clamp(e.x + e.facing * 19 * dt, e.originX - 100, e.originX + 100);
      }
      if (e.cooldown > 0) continue;
      if (range < (e.boss ? 130 : 75)) {
        e.attackTime = 0.38;
        e.cooldown = e.boss ? 1.55 : 1.6;
        if (Math.abs(p.y + p.h - (e.y + e.h)) < 70) {
          if (this.shieldTime > 0) this.hitEnemy(e, 22, 'reflect');
          else {
            this.hurt(e.boss ? 16 : 9);
            if (p.buff?.id === 'black') this.hitEnemy(e, 16, 'reflect');
          }
        }
        this.effect('enemySlash', centerX(e) + e.facing * 45, e.y + e.h / 2, '#ff647b', 65, 0.38);
      } else if (e.boss || e.type === 'sunra' || e.type === 'dokkaebi') {
        e.cooldown = e.type === 'root' ? 1.8 : e.boss ? 2.2 : 2.8;
        e.attackTime = 0.5;
        const y = e.y + e.h * 0.55;
        const aim = Math.atan2(p.y + 22 - y, centerX(p) - centerX(e));
        const count = e.type === 'root' && e.hp < e.maxHp * 0.55 ? 3 : 1;
        e.phase = count === 3 ? 2 : e.phase;
        for (let n = 0; n < count; n++) {
          const angle = aim + (n - (count - 1) / 2) * 0.23;
          this.projectiles.push({ x: centerX(e), y, w: 13, h: 13, vx: Math.cos(angle) * 190, vy: Math.sin(angle) * 190, hostile: true, color: e.type === 'root' ? '#f6ca75' : '#f77d99', life: 5, owner: e.id });
        }
        if (e.type === 'sagwan' || (e.type === 'root' && e.phase === 2)) {
          this.effects.push({ type: 'warning', x: centerX(p), y: 459, life: 0.8, maxLife: 0.8, color: '#ff8a64', radius: 35, danger: true });
        }
      }
    }
    // Ground marks give players a full visible warning before activation.
    for (const effect of this.effects) {
      if (effect.danger && effect.life < 0.08) {
        effect.danger = false;
        this.effect('pillar', effect.x, effect.y, '#ff9368', 38, 0.5);
        if (Math.abs(centerX(p) - effect.x) < 35 && p.y + p.h > 365) this.hurt(15);
      }
    }
    this.boss = nearestBoss && !nearestBoss.dead ? nearestBoss : null;
  }

  projectileObjects() {
    return this.objects.filter(o => o.active && ['gate', 'cooler', 'log', 'memory', 'npc', 'core'].includes(o.type) && o.value !== 'illusion');
  }

  hitObject(object, shot) {
    if (object.type === 'cooler') this.activateCooler(object);
    else if (object.type === 'log' && object.value === 'escape') this.eraseLog(object);
    else if (shot.source === 'red' && ['memory', 'log', 'gate'].includes(object.type)) {
      object.active = false;
      const penalty = object.type === 'gate' ? 2 : 5;
      this.conscience = Math.max(0, this.conscience - penalty);
      this.effect('destroy', centerX(object), object.y + object.h / 2, '#ff647b', 30);
      this.notice(object.type === 'gate' ? '보안문을 폭파했습니다. 양심 −2' : '민간 기록이 삭제되었습니다. 양심 −5');
      this.saveCheckpoint();
    }
  }

  updateProjectiles(dt) {
    const p = this.player;
    // Process a stable snapshot: a kill can load a lesson and replace the live array.
    const shots = this.projectiles;
    for (const shot of shots) {
      if (shot.life <= 0) continue;
      const travel = Math.min(dt, shot.life), dx = shot.vx * travel, dy = shot.vy * travel;
      const candidates = this.solidPlatforms().map(target => ({ target, kind: 'wall' }));
      candidates.push(...this.projectileObjects().map(target => ({ target, kind: 'object' })));
      if (this.tutorial) candidates.push(...this.tutorialTargets.filter(t => t.active && ['dummy', 'range'].includes(t.type)).map(target => ({ target, kind: 'practice' })));
      else if (shot.hostile) candidates.push({ target: p, kind: 'player' });
      else candidates.push(...this.enemies.filter(e => !e.dead).map(target => ({ target, kind: 'enemy' })));
      let hit = null;
      for (const candidate of candidates) {
        const t = sweep(shot, dx, dy, candidate.target);
        if (t !== null && (!hit || t < hit.t)) hit = { ...candidate, t };
      }
      shot.x += dx * (hit?.t ?? 1); shot.y += dy * (hit?.t ?? 1);
      shot.life -= travel;
      if (!hit) continue;
      if (hit.kind === 'player' && (this.shieldTime > 0 || p.buff?.id === 'black')) {
        shot.hostile = false; shot.vx *= -1.7; shot.vy *= -1.7; shot.color = '#c2bcff';
        this.sound('reflect');
        continue;
      }
      shot.life = 0;
      this.effect('block', shot.x + shot.w / 2, shot.y + shot.h / 2, shot.color, 16, 0.18);
      if (hit.kind === 'practice') this.tutorialDirector.hitShot(hit.target, shot);
      else if (hit.kind === 'player') this.hurt(10);
      else if (hit.kind === 'object' && shot.playerShot && !this.tutorial) this.hitObject(hit.target, shot);
      else if (hit.kind === 'enemy') {
        const connected = this.hitEnemy(hit.target, shot.damage ?? 35, shot.source ?? 'reflect');
        if (connected && !hit.target.dead && shot.buff === 'red' && hit.target.type !== 'gumiho') {
          hit.target.burnRemaining = 3; hit.target.burnTick = hit.target.burnTick || 0.5;
        }
      }
    }
    if (shots === this.projectiles) this.projectiles = shots.filter(s => s.life > 0 && s.x > -100 && s.x < this.worldWidth + 100 && s.y > -120 && s.y < 650);
  }

  hurt(amount, ignoreShield = false) {
    if (this.tutorial) return false;
    const p = this.player;
    if (this.mode !== 'playing' || p.invulnerable > 0) return false;
    if (this.shieldTime > 0 && !ignoreShield) { this.effect('shield', centerX(p), p.y + 20, '#aba1ff', 60); return false; }
    if (p.buff?.id === 'black' && !ignoreShield) amount *= 0.4;
    const damage = Math.min(p.hp, Math.ceil(amount));
    p.hp = Math.max(0, p.hp - damage);
    this.stats.damageTaken += damage;
    p.invulnerable = 0.85;
    if (p.buff?.id === 'white') this.endEnchant();
    this.effect('hurt', centerX(p), p.y + 20, '#ff5a70', 50, 0.45);
    this.sound('hurt');
    if (p.hp <= 0) {
      this.mode = 'dead';
      this.message = '연결이 끊겼습니다. 마지막 접속점에서 다시 시도할 수 있습니다.';
      this.sound('dead');
    }
    return true;
  }

  updateEscape(dt) {
    if (this.levelIndex !== 3) return;
    if (this.escapeGrace > 0) this.escapeGrace -= dt;
    else this.escapeWall += dt * (this.route === 'destroy' ? 118 : 108);
    if (this.player.x < this.escapeWall + 30) {
      this.player.invulnerable = 0;
      this.hurt(30, true);
      this.escapeWall -= 100;
    }
  }

  updateHint() {
    if (this.tutorial) { this.hint = this.tutorial.completed ? 'F · 수련 마치기' : this.tutorial.step.goal; return; }
    const p = this.player;
    if (this.levelIndex === 3) {
      this.hint = this.inDataSwamp ? '데이터 늪 · 현무 Q / 인챈트 E로 저항을 무시합니다.' : 'D + Shift로 탈출 · 좌클릭 또는 주작 Q로 로그 소거 · 성문은 백호 Q';
    } else if (this.boss?.type === 'bulgasari') this.hint = '불가사리: 왼쪽 냉각 장치를 좌클릭 또는 F로 타격하세요.';
    else if (this.boss?.type === 'jangsan') this.hint = '장산범: 청룡(2) 또는 백호(3)를 Q로 시전한 뒤 진짜 몸을 공격하세요.';
    else if (this.boss?.type === 'gumiho') this.hint = '구미호: 스캔 후 세 번의 공격으로 꼬리 아홉 개를 해제하세요.';
    else if (this.boss?.type === 'root') this.hint = '국본: 빛나는 바닥 문양을 피하고, 현무로 탄막을 반사하세요.';
    else if (this.boss) this.hint = '보스의 탄막은 점프 / Shift로 회피 · 현무(4) Q로 반사';
    else if (this.levelIndex === 0 && p.x < 900) this.hint = 'A·D 이동 / Space 2단 점프 / Shift 대시 / 좌클릭 공격 / Q 부적 / E 인챈트';
    else this.hint = '숫자 1~5 부적 선택 · Q 시전 · E 인챈트 · F 상호작용';
    const object = this.objects.find(o => o.active && ['npc', 'exit', 'gate', 'core', 'cooler'].includes(o.type) && distance(o, p) < 100);
    if (object) {
      if (object.type === 'npc') this.hint = 'F · 시민과 대화';
      else if (object.type === 'gate' && object.value !== 'illusion') this.hint = object.value === 'key' ? 'F · 보안 키로 열기 / 주작 Q · 폭파 (양심 −2)' : '백호(3) Q · sudo로 개방 / 주작 Q · 폭파 (양심 −2)';
      else this.hint = object.label || this.hint;
    }
  }

  finish() {
    if (this.levelIndex !== 3 || !this.route) return false;
    const id = this.route === 'destroy' ? 'black' : this.conscience >= 75 ? 'white' : 'gray';
    this.ending = copy(ENDINGS[id]);
    this.ending.report.push(`양심: ${this.conscience}% · 보존 기록: ${this.stats.memories} · 소거 로그: ${this.stats.logs}`);
    this.mode = 'ending';
    this.sound('ending');
    return true;
  }

  saveCheckpoint() {
    if (this.tutorial) {
      if (this.checkpoint) { this.checkpoint.tutorials = [...this.tutorialDirector.learned]; this.saveProgress(copy(this.checkpoint)); }
      return this.getSave();
    }
    const p = this.player;
    // A safe grounded coordinate is stored even when a pickup was collected in the air.
    let safeX = clamp(p.x, 0, this.worldWidth - p.w);
    let support = this.platforms.filter(s => !s.hidden && s.x <= safeX && s.x + s.w >= safeX + p.w).sort((a, b) => b.y - a.y)[0];
    if (!support) safeX = 80;
    for (const gate of this.solidGates()) {
      if (safeX + p.w > gate.x && safeX < gate.x + gate.w) safeX = Math.max(0, gate.x - p.w - 4);
    }
    support = this.platforms.filter(s => !s.hidden && s.x <= safeX && s.x + s.w >= safeX + p.w).sort((a, b) => b.y - a.y)[0];
    this.checkpoint = {
      version: this.saveVersion, levelIndex: this.levelIndex, conscience: this.conscience,
      stats: copy(this.stats), route: this.route,
      tutorials: [...this.tutorialDirector.learned],
      player: { x: safeX, y: support ? support.y - p.h : 416, selected: p.unlocked.includes(p.selected) ? p.selected : 0, unlocked: [...p.unlocked], tigerEvolved: p.tigerEvolved },
      defeated: this.enemies.filter(e => e.dead).map(e => e.id),
      consumed: this.objects.filter(o => !o.active).map(o => o.id),
      escapeWall: this.levelIndex === 3 ? Math.min(this.escapeWall, safeX - 420) : null,
    };
    this.saveProgress(copy(this.checkpoint));
    return this.getSave();
  }

  getSave() { return this.checkpoint ? copy(this.checkpoint) : null; }

  validateSave(save) {
    if (!save || typeof save !== 'object' || save.version !== this.saveVersion) return false;
    if (save.tutorials !== undefined && (!Array.isArray(save.tutorials) || save.tutorials.length > TUTORIAL_IDS.length || new Set(save.tutorials).size !== save.tutorials.length || save.tutorials.some(id => !TUTORIAL_IDS.includes(id)))) return false;
    if (!Number.isInteger(save.levelIndex) || save.levelIndex < 0 || save.levelIndex > 3) return false;
    if (!finite(save.conscience) || save.conscience < 0 || save.conscience > 100) return false;
    if (![null, 'destroy', 'restore'].includes(save.route) || (save.levelIndex === 3) !== (save.route !== null)) return false;
    if (!save.stats || STATS.some(key => !finite(save.stats[key]) || save.stats[key] < 0 || save.stats[key] > 1e9)) return false;
    const p = save.player;
    const level = LEVELS[save.levelIndex];
    if (!p || !finite(p.x) || p.x < 0 || p.x > level.width - 24 || !finite(p.y) || p.y < 0 || p.y > 505) return false;
    if (!Array.isArray(p.unlocked) || p.unlocked.length < 2 || p.unlocked.length > 5 || new Set(p.unlocked).size !== p.unlocked.length || p.unlocked.some(n => !Number.isInteger(n) || n < 0 || n > 4)) return false;
    if (!p.unlocked.includes(0) || !p.unlocked.includes(1) || !p.unlocked.includes(p.selected) || typeof p.tigerEvolved !== 'boolean') return false;
    if (p.tigerEvolved && (!p.unlocked.includes(2) || save.levelIndex < 2)) return false;
    if (save.levelIndex < 1 && p.unlocked.includes(3)) return false;
    if (save.levelIndex < 2 && p.unlocked.includes(4)) return false;
    if (save.levelIndex >= 1 && !p.unlocked.includes(2)) return false;
    if (save.levelIndex >= 2 && !p.unlocked.includes(3)) return false;
    if (save.levelIndex === 3 && (!p.tigerEvolved || !p.unlocked.includes(4))) return false;
    const validIds = (list, options) => Array.isArray(list) && list.length <= options.length && new Set(list).size === list.length && list.every(id => typeof id === 'string' && options.some(o => o.id === id));
    if (!validIds(save.defeated, level.enemies) || !validIds(save.consumed, level.objects)) return false;
    if (save.levelIndex === 3 && (!finite(save.escapeWall) || save.escapeWall < -100000 || save.escapeWall > p.x - 30)) return false;
    if (save.levelIndex !== 3 && save.escapeWall !== null) return false;
    if (save.levelIndex === 2 && p.unlocked.includes(4) && !save.defeated.includes('gumiho')) return false;
    // Checkpoints are always on visible ground and never inside an unopened gate.
    const support = level.platforms.some(s => !s.hidden && s.x <= p.x && s.x + s.w >= p.x + 24 && Math.abs(s.y - (p.y + 44)) < 1);
    if (!support) return false;
    if (level.objects.some(o => o.type === 'gate' && o.value !== 'illusion' && !save.consumed.includes(o.id) && overlaps({ x: p.x, y: p.y, w: 24, h: 44 }, o))) return false;
    return true;
  }

  continueGame(save) {
    if (!this.validateSave(save)) { this.notice('저장 기록을 읽을 수 없습니다. 새 게임을 시작해 주세요.'); return false; }
    const state = copy(save);
    this.startNew(false);
    this.route = state.route;
    this.loadLevel(state.levelIndex);
    this.conscience = state.conscience;
    this.stats = copy(state.stats);
    Object.assign(this.player, {
      x: state.player.x, y: state.player.y, selected: state.player.selected,
      unlocked: [...state.player.unlocked], tigerEvolved: state.player.tigerEvolved,
      hp: this.player.maxHp, energy: this.player.maxEnergy, invulnerable: 1.5,
    });
    for (const enemy of this.enemies) if (state.defeated.includes(enemy.id)) { enemy.dead = true; enemy.hp = 0; }
    for (const object of this.objects) if (state.consumed.includes(object.id)) object.active = false;
    this.escapeWall = state.escapeWall;
    this.checkpoint = state;
    this.tutorialDirector.learned = [...(state.tutorials || [])];
    this.tutorialDirector.owned();
    this.notice('저장된 접속점에서 연결을 복원했습니다.', 3);
    this.tutorialDirector.startNext();
    this.camera = clamp(this.player.x - 350, 0, this.worldWidth - 960);
    if (this.levelIndex === 2 && state.defeated.includes('root')) this.objective = '루트 코어에 기린 부적을 대고 소도의 운명을 선택하세요.';
    this.updateHint();
    return true;
  }

  retry() {
    if (!this.checkpoint) return this.startNew();
    return this.continueGame(this.getSave());
  }
}
