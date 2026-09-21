import { TALISMANS } from './content.js';

const step = (key, action, title, description, goal, extra = {}) => ({ key, action, title, description, goal, ...extra });
export const TUTORIALS = {
  red: { index: 0, title: '주작 · 기본 탄과 강화 탄', intro: '옥추선의 기억을 펼칩니다. 안전한 연습을 마치면 이 자리에서 모험을 이어갑니다.', summary: '좌클릭은 기본 탄, 우클릭은 강화 탄입니다. 마우스로 조준하세요. 우클릭은 강화도 자동 준비합니다. 주작 강화 15초, 종료 후 냉각 30초. Q 화염탄은 기력 20. 벽과 사물에 닿으면 탄이 소멸합니다.', steps: [
    step('좌클릭', 'attack', '먼저, 부채로 한 번', '표적에 마우스를 올리고 좌클릭하세요. 마우스 방향으로 부채 탄이 날아갑니다. 기력 소모는 없고 벽이나 사물에 닿으면 멈춥니다.', '연습 표적을 조준하고 좌클릭하세요.', { target: 'dummy' }),
    step('1 → Q', 'cast', 'Q 화염탄의 위력 비교', '휠 또는 1로 주작을 고르세요. 휠 위는 앞 번호, 아래는 뒷 번호입니다. 미획득 부적은 건너뛰고 순환합니다. 표적을 조준하고 Q로 더 강한 화염탄을 쏘세요. 한 발에 기력 20입니다.', '두 표적에 각각 Q 화염탄을 맞히세요.', { target: 'range' }),
    step('E', 'enchant', '이번에는 부채에 힘을 담기', '주작을 고르고 E. 공격 없이 15초 동안 부채에 불을 담습니다. 실전에서는 우클릭으로 강화와 발사를 함께 할 수도 있습니다. 손과 부채의 붉은 빛을 보세요.', '주작 E로 인챈트하세요.'),
    step('우클릭', 'enhancedAttack', '우클릭으로 달라진 위력', '표적을 조준하고 우클릭하세요. 기본 탄 22보다 강한 약 37 피해와 3초 화상을 줍니다. 좌클릭은 강화 중에도 기본 탄입니다.', '우클릭 강화 탄으로 표적을 맞히세요.', { target: 'dummy', buff: 'red' }),
  ] },
  blue: { index: 1, title: '청룡 · 찾고, 빠르게 움직이기', intro: '함께 가져온 청룡도 깨워 봅시다. 주작과 달리 Q는 주변을 탐지합니다.', summary: '청룡 Q: 8초 탐지. E: 12초 동안 이동이 약 35% 빨라지고 대시는 약 42% 멀리 나갑니다. 우클릭도 더 빠르게 연타합니다. 끝난 뒤 냉각 30초.', steps: [
    step('2 → Q', 'cast', '청룡으로 흔적 찾기', '청룡(2)을 선택하고 Q. 공격 파동 대신 주변의 숨은 길과 환영을 8초 동안 드러냅니다.', '청룡 Q로 숨은 표적을 드러내세요.', { target: 'hidden' }),
    step('E', 'enchant', '발걸음에 전류를 담기', '청룡 E는 이동 강화입니다. 12초 동안 이동과 대시가 빨라지고 우클릭을 더 빠르게 잇습니다.', '청룡 E로 이동을 강화하세요.'),
    step('Shift', 'dash', '길어진 대시 체험', '좌우로 움직여 속도를 느끼고 Shift로 대시하세요. 이동은 약 35% 빨라지고 대시는 약 42% 멀리 나갑니다.', '청룡 인챈트 중 Shift로 대시하세요.', { buff: 'blue' }),
  ] },
  white: { index: 2, title: '백호 · 드러내고, 모습을 감추기', intro: '새 부적이 기억을 전합니다. 백호의 Q와 E는 서로 다른 역할입니다.', summary: '백호 Q: 숨은 길과 환영을 12초 탐지. E: 최대 15초 은신, 다음 우클릭 피해 2배. 공격하면 은신이 끝나고 냉각 30초. 보스는 은신을 꿰뚫습니다.', steps: [
    step('3 → Q', 'cast', '진실을 드러내기', '백호(3)의 Q는 숨은 표적을 12초 드러냅니다. 환영 보스에게 공격이 닿지 않으면 먼저 스캔하세요.', '백호 Q로 숨은 표적을 찾으세요.', { target: 'hidden' }),
    step('E', 'enchant', '이번에는 내가 숨기', '백호 E로 모습이 흐려집니다. 일반 적은 나를 놓치지만 보스는 감지합니다. 다음 우클릭은 두 배의 피해를 줍니다.', '백호 E로 은신하세요.'),
    step('우클릭', 'enhancedAttack', '은신을 치명타로 바꾸기', '은신 중 표적을 조준하고 우클릭. 기본 22가 44로 오릅니다. 공격하는 순간 은신을 소비합니다.', '은신 중 우클릭으로 표적을 맞히세요.', { target: 'dummy', buff: 'white' }),
  ] },
  black: { index: 3, title: '현무 · 방패와 갑옷', intro: '현무가 안전한 연습탄을 띄웁니다. 실제 체력은 줄지 않습니다.', summary: '현무 Q: 5초 방패와 탄 반사. E: 12초 받는 피해 60% 감소, 탄 반사와 근접 반격. 끝난 뒤 냉각 30초.', steps: [
    step('4 → Q', 'cast', '다가오는 탄을 되돌리기', '현무(4)를 고르고 Q. 5초 방패를 펼칩니다. 연습탄이 방패에 닿으면 날아온 쪽으로 튕깁니다.', '현무 Q로 연습탄을 반사하세요.', { target: 'projectile' }),
    step('E', 'enchant', '방패 대신 몸에 두르기', '현무 E는 12초 갑옷입니다. 방패와 달리 근접 피해를 완전히 막지 않고 60% 줄입니다. 연습 근접 충격으로 10→4를 확인합니다.', '현무 E를 켜고 연습 근접 충격의 10→4를 확인하세요.'),
  ] },
  'white-evolved': { index: 2, title: '백호 각성 · 권한의 문', intro: '백호가 새로운 권한을 얻었습니다. 달라진 Q와 E를 확인합시다.', summary: '각성 백호 Q: 가까운 보안문을 양심 손실 없이 개방. E: 은신 30초, 치명타 우클릭 뒤에도 1초 유지. 종료 후 냉각 30초.', steps: [
    step('3 → Q', 'cast', '부수지 않고 문 열기', '각성한 백호(3)의 Q는 탐지와 함께 가까운 보안문을 엽니다. 주작 폭파와 달리 기록과 양심을 지킵니다.', '백호 Q로 연습 보안문을 여세요.', { target: 'gate' }),
    step('E', 'enchant', '30초로 길어진 은신', '각성한 백호 E는 30초 지속됩니다. 상태 표시에서 시간을 확인하세요. 냉각은 여전히 종료 후 30초입니다.', '각성 백호 E로 은신하세요.'),
    step('우클릭', 'enhancedAttack', '공격 뒤 한순간 더', '치명타 우클릭 뒤에도 1초 동안 은신이 남습니다. 일반 백호와의 차이입니다.', '은신 중 우클릭으로 연습 표적을 맞히세요.', { target: 'dummy', buff: 'white' }),
  ] },
  gold: { index: 4, title: '기린 · 마지막 선택의 열쇠', intro: '기린은 공격용 부적이 아닙니다. 국본을 쓰러뜨린 뒤 루트 코어에서 사용합니다.', summary: '기린은 Q 공격과 E 인챈트가 없는 코어 열쇠입니다. 국본 격파 → 코어 접근 → Q 또는 F → 삭제/정화 선택.', steps: [
    step('5', 'select', '열쇠를 손에 들기', '기린(5)을 선택하세요. 좌클릭 기본 공격은 그대로 사용할 수 있지만 기린에는 공격 기술이나 인챈트가 없습니다.', '5 또는 휠로 기린을 선택하세요.'),
    step('Q', 'inspect', '코어의 조건 확인하기', '연습 코어에 Q를 눌러 잠금 조건을 확인하세요. 실제 선택은 국본을 쓰러뜨리고 루트 코어에 도착했을 때 열립니다.', 'Q로 코어 잠금 조건을 확인하세요.', { target: 'gate' }),
  ] },
};
export const TUTORIAL_IDS = Object.keys(TUTORIALS);
const copy = value => structuredClone(value);
const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const RESOURCE_FIELDS = ['hp', 'energy', 'buff', 'enchantCooldown', 'invulnerable', 'dashTime', 'attackTime', 'combo', 'selected', 'x', 'y', 'vx', 'vy', 'grounded'];
const TIMER_FIELDS = ['scanTime', 'shieldTime', 'castCooldown', 'dashCooldown', 'dashDirection', 'attackCooldown', 'comboTime', 'jumps', 'coyoteTime'];

export class TutorialDirector {
  constructor(game, enabled = true) {
    this.game = game;
    this.enabled = enabled;
    this.learned = [];
    this.queue = [];
    game.tutorial = null;
    game.tutorialTargets = [];
  }

  enqueue(id, replay = false) {
    if (!this.enabled || !TUTORIALS[id] || (!replay && this.learned.includes(id)) || this.game.tutorial?.id === id || this.queue.includes(id)) return false;
    if (id === 'white-evolved') this.queue = this.queue.filter(queued => queued !== 'white');
    this.queue.push(id);
    return true;
  }

  owned() {
    const p = this.game.player;
    for (const id of TUTORIAL_IDS) if (p.unlocked.includes(TUTORIALS[id].index) && (id !== 'white-evolved' || p.tigerEvolved) && (id !== 'white' || !p.tigerEvolved)) this.enqueue(id);
  }

  startNext() {
    const g = this.game;
    if (g.tutorial || !this.queue.length || g.mode !== 'playing' || !g.player.grounded) return false;
    const id = this.queue.shift();
    const definition = TUTORIALS[id];
    this.snapshot = { player: Object.fromEntries(RESOURCE_FIELDS.map(key => [key, copy(g.player[key])])), timers: Object.fromEntries(TIMER_FIELDS.map(key => [key, g[key]])), effects: g.effects, projectiles: g.projectiles };
    g.effects = [];
    g.projectiles = [];
    g.player.buff = null;
    g.player.enchantCooldown = 0;
    g.player.energy = g.player.maxEnergy;
    g.player.invulnerable = 0;
    for (const field of TIMER_FIELDS) g[field] = 0;
    g.tutorial = { id, ...copy(definition), stepIndex: 0, step: null, feedback: '', feedbackTime: 0, completed: false, progress: 0 };
    this.enterStep();
    return true;
  }

  enterStep() {
    const g = this.game, t = g.tutorial;
    t.step = t.steps[t.stepIndex];
    t.lastFeedback = t.feedback || t.lastFeedback || '';
    t.feedback = '';
    t.tip = '';
    t.feedbackTime = 0;
    g.attackCooldown = 0;
    g.castCooldown = 0;
    g.dashCooldown = 0;
    g.comboTime = 0;
    g.player.combo = 0;
    if (t.id === 'black' && t.step.action === 'enchant') g.shieldTime = 0;
    g.projectiles = [];
    this.spawnTargets();
  }

  spawnTargets() {
    const g = this.game, t = g.tutorial, p = g.player;
    g.tutorialTargets = [];
    const type = t.step.target;
    if (!type) return;
    // Put practice props on the player's side of a real security gate.
    let facing = p.facing;
    const room = type === 'range' ? 220 : 110;
    const blocked = direction => g.solidGates().some(o => direction > 0 ? o.x > p.x && o.x < p.x + room + 40 : o.x + o.w < p.x + p.w && o.x + o.w > p.x - room - 40);
    if (blocked(facing) || p.x + facing * room < 20 || p.x + facing * room > g.worldWidth - 60) facing *= -1;
    p.facing = facing;
    const offsets = type === 'range' ? [145, 205] : [type === 'projectile' ? 95 : type === 'gate' ? 110 : 66];
    offsets.forEach((offset, index) => {
      const w = type === 'projectile' ? 16 : 32, h = type === 'gate' ? 100 : type === 'projectile' ? 16 : 44;
      g.tutorialTargets.push({ id: `${t.id}-${t.stepIndex}-${index}`, type, x: clamp(p.x + facing * offset, 10, g.worldWidth - w - 10), y: p.y + p.h - h, w, h, hp: 100, maxHp: 100, active: true, label: type === 'range' ? '먼 표적 · Q' : type === 'dummy' ? '조준 표적 · 클릭' : type === 'hidden' ? '숨은 흔적' : type === 'gate' ? (t.id === 'gold' ? '국본 격파 후 개방' : '연습 보안문') : '안전한 연습탄', color: TALISMANS[t.index].color, vx: -facing * 150, reflected: false });
    });
  }

  record(action, feedback) {
    const t = this.game.tutorial;
    if (!t || t.completed || t.feedbackTime || t.step.action !== action) return false;
    t.feedback = feedback;
    t.tip = '';
    t.feedbackTime = 0.7;
    t.progress = (t.stepIndex + 1) / t.steps.length;
    return true;
  }

  damageLabel(target, value, label) {
    this.game.effects.push({ type: 'trainingDamage', x: target.x + target.w / 2, y: target.y, value, label, color: target.color, life: 1.2, maxLife: 1.2 });
  }

  hitShot(target, shot) {
    const g = this.game, t = g.tutorial;
    if (!t || t.completed || t.feedbackTime) return;
    if (t.step.action !== shot.action || (t.step.buff && t.step.buff !== shot.buff)) {
      t.tip = t.step.goal; return;
    }
    target.hp = Math.max(0, target.hp - shot.damage);
    this.damageLabel(target, Math.round(shot.damage), shot.buff === 'red' ? '화상 3초 · 22→37' : shot.buff === 'white' ? '치명타 · 22→44' : shot.action === 'cast' ? 'Q 화염탄 · 기력 20' : '좌클릭 · 기력 소모 없음');
    if (shot.action === 'cast') {
      target.active = false;
      if (g.tutorialTargets.every(t => !t.active)) this.record('cast', '두 표적 명중! Q 화염탄은 각 52 피해, 탄마다 기력 20. 장애물은 관통하지 않습니다.');
      else t.tip = '다음 표적에 마우스를 올리고 Q를 누르세요.';
    } else this.record(shot.action, shot.buff === 'red' ? '우클릭 22→37! 화상도 더해집니다.' : shot.buff === 'white' ? (g.player.tigerEvolved ? '치명타 44! 공격 뒤 은신 1초가 남습니다.' : '치명타 44! 은신을 소비했고 냉각이 시작됩니다.') : '좌클릭 명중 · 기본 피해 22, 기력 소모 0.');
  }

  cast() {
    const g = this.game, t = g.tutorial, p = g.player;
    if (!['cast', 'inspect'].includes(t.step.action) || t.completed) { t.tip = t.step.goal; return false; }
    if (p.selected !== t.index) { g.notice(`이번에는 ${TALISMANS[t.index].name}(${t.index + 1})을 선택하세요.`, 2); return false; }
    if (t.id === 'gold') { this.record('inspect', '국본 격파 → 실제 루트 코어 접근 → Q / F. 여기서는 운명을 선택하지 않습니다.'); return true; }
    if (g.castCooldown > 0 || p.energy < 20) return false;
    p.energy -= 20;
    g.castCooldown = 0.48;
    g.sound('cast');
    g.effect('cast', p.x + p.w / 2, p.y + 18, TALISMANS[p.selected].color, p.selected === 0 ? 34 : 250, 0.65);
    if (p.selected === 0) {
      g.fireShot({ damage: 52, source: 'red', color: TALISMANS[0].color, range: 800, action: 'cast' });
    } else if (p.selected === 1 || p.selected === 2) {
      g.scanTime = p.selected === 2 ? 12 : 8;
      const target = g.tutorialTargets.find(o => Math.abs(o.x - p.x) < (o.type === 'gate' ? 235 : 650));
      if (target?.type === 'hidden') { target.revealed = true; target.label = '발견한 흔적'; this.record('cast', `${g.scanTime}초 탐지! 숨은 표적이 드러났습니다.`); }
      if (target?.type === 'gate' && p.tigerEvolved) { target.active = false; this.record('cast', '권한 승인 · 문이 열렸습니다. 양심 손실 0.'); g.effect('unlock', target.x, target.y + 50, target.color, 70); }
    } else if (p.selected === 3) {
      g.shieldTime = 5;
      const target = g.tutorialTargets.find(o => o.type === 'projectile');
      if (target) { target.x = p.x + p.facing * 45; target.y = p.y + 20; target.vx = -p.facing * 150; }
    }
    return true;
  }

  enchanted() {
    const g = this.game, t = g.tutorial;
    if (g.player.buff?.id !== TALISMANS[t.index].id) return;
    if (t.id === 'black' && t.step.action === 'enchant') {
      this.damageLabel({ ...g.player, color: TALISMANS[3].color }, Math.ceil(10 * 0.4), '연습 근접 충격 10→4 · 60% 감소');
      g.effect('shield', g.player.x + 12, g.player.y + 20, '#aba1ff', 60);
      this.record('enchant', '연습 충격 10→4. 갑옷은 피해를 60% 줄이고, 탄은 반사합니다.');
    } else this.record('enchant', `${TALISMANS[t.index].name}의 힘이 ${g.player.buff.remaining}초 동안 부채에 깃듭니다. 다음 동작을 해보세요.`);
  }

  update(dt) {
    const g = this.game, t = g.tutorial, p = g.player;
    if (!t) return;
    if (t.feedbackTime > 0) {
      t.feedbackTime = Math.max(0, t.feedbackTime - dt);
      if (!t.feedbackTime) {
        if (t.stepIndex + 1 < t.steps.length) { t.stepIndex++; this.enterStep(); }
        else { t.completed = true; t.feedback = t.summary; }
      }
      return;
    }
    if (t.completed) return;
    if (t.step.buff && p.buff?.id !== t.step.buff && !g.projectiles.some(shot => shot.action === t.step.action && shot.buff === t.step.buff)) {
      // A missed white attack or a long pause must never trap a lesson behind 30 seconds of cooldown.
      p.buff = null; p.enchantCooldown = 0;
      t.stepIndex = Math.max(0, t.stepIndex - 1);
      this.enterStep();
      g.notice('인챈트를 다시 걸고 표적을 맞혀 보세요. 연습 냉각을 초기화했습니다.', 3);
      return;
    }
    if (g.tutorialTargets.length && g.tutorialTargets.every(o => Math.abs(o.x - p.x) > 380 || Math.abs(o.y - p.y) > 180)) this.spawnTargets();
    if (t.id === 'black' && t.step.action === 'cast') {
      for (const target of g.tutorialTargets) {
        if (target.type !== 'projectile') continue;
        target.x += target.vx * dt;
        if (!target.reflected && overlaps(target, p)) {
          if (g.shieldTime) { target.reflected = true; target.vx *= -1.7; target.label = '반사!'; this.damageLabel(target, null, 'Q 방패 · 피해 0'); g.sound('reflect'); this.record('cast', '방패에 닿자 연습탄이 되돌아갔습니다! Q 방패는 5초 지속됩니다.'); }
          else { target.x = p.x + p.facing * 110; target.y = p.y + 20; target.vx = -p.facing * 150; }
        }
        if (!target.reflected && Math.abs(target.x - p.x) > 200) { target.x = p.x + p.facing * 110; target.y = p.y + 20; target.vx = -p.facing * 150; }
      }
    }
    if (t.step.action === 'enchant' && !p.buff) p.enchantCooldown = 0;
  }

  finish(skipped = false) {
    const g = this.game, t = g.tutorial;
    if (!t || (!skipped && !t.completed)) return false;
    if (!this.learned.includes(t.id)) this.learned.push(t.id);
    Object.assign(g.player, this.snapshot.player);
    g.player.selected = t.index;
    Object.assign(g, this.snapshot.timers);
    g.effects = this.snapshot.effects;
    g.projectiles = this.snapshot.projectiles;
    g.tutorial = null;
    g.tutorialTargets = [];
    this.snapshot = null;
    // Only lesson progress is written: practice movement never advances the checkpoint.
    if (g.checkpoint) {
      g.checkpoint.tutorials = [...this.learned];
      if (g.checkpoint.player.unlocked.includes(t.index)) g.checkpoint.player.selected = t.index;
      g.saveProgress(copy(g.checkpoint));
    }
    this.startNext();
    g.updateHint();
    return true;
  }
}
