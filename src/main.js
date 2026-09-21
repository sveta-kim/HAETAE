import { Game } from './game.js';
import { Renderer } from './renderer.js';
import { Input } from './input.js';
import { AudioEngine } from './audio.js';
import { TALISMANS } from './content.js';
import { getAbilityInfo, getBuffInfo } from './ability-info.js';

const $ = id => document.getElementById(id);
const STORAGE_KEY = 'haetae.checkpoint.v1';
const canvas = $('game');
const audio = new AudioEngine();
let soundEnabled = true;
let save = null;
let toastTimer;
try { save = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); soundEnabled = localStorage.getItem('haetae.sound') !== 'off'; } catch { /* Private sessions still allow play. */ }
audio.setEnabled(soundEnabled);
const showToast = text => {
  $('toast').textContent = text;
  $('toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, 3500);
};
const game = new Game({
  onEvent(event) {
    if (event.type === 'sound') audio.play(event.name);
  },
  saveProgress(data) {
    save = data;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      $('save-status').textContent = 'CHECKPOINT SAVED · 기록 저장됨';
    } catch { $('save-status').textContent = '임시 세션 · 저장 공간을 사용할 수 없습니다'; }
  },
});
const renderer = new Renderer(canvas);
renderer.setReducedMotion?.(matchMedia('(prefers-reduced-motion: reduce)').matches);
const input = new Input(canvas);
input.isPlaying = () => game.mode === 'playing';
let renderedMode = '';
let helpWasPlaying = false;
let previousFrame = performance.now();
let accumulator = 0;
let hudElapsed = 0;

function focusGame() {
  input.clear(); canvas.focus({ preventScroll: true });
  if (game.mode === 'playing' && !document.fullscreenElement) $('game-stage').scrollIntoView({ block: 'nearest' });
}
function unlockAudio() { Promise.resolve(audio.unlock()).catch(() => {}); }
function startNew() { unlockAudio(); game.startNew(); focusGame(); updateUI(); }
function continueGame() {
  unlockAudio();
  try {
    if (!save || game.continueGame(save) === false) throw new Error('invalid save');
    focusGame(); updateUI();
  } catch { showToast('저장 기록을 읽을 수 없습니다. 새 접속을 시작해 주세요.'); save = null; $('continue-button').hidden = true; }
}
function pauseToggle() {
  if ($('help-dialog').open) return;
  if (game.mode === 'playing') { game.pause(); input.clear(); }
  else if (game.mode === 'paused') { game.resume(); focusGame(); }
  updateUI();
}
function showHelp() {
  if ($('help-dialog').open) return;
  helpWasPlaying = game.mode === 'playing';
  if (helpWasPlaying) game.pause();
  input.clear(); updateUI(); $('help-dialog').showModal();
}
function closeHelp() { $('help-dialog').close(); }
input.onPause = pauseToggle;
input.onHelp = showHelp;
input.onBlur = () => { if (game.mode === 'playing') { game.pause(); input.clear(); updateUI(); } };
$('help-dialog').addEventListener('close', () => {
  if (helpWasPlaying && game.mode === 'paused') game.resume();
  helpWasPlaying = false; focusGame(); updateUI();
});
$('start-button').addEventListener('click', startNew);
$('continue-button').addEventListener('click', continueGame);
$('pause-button').addEventListener('click', pauseToggle);
$('help-button').addEventListener('click', showHelp);
$('controls-help').addEventListener('click', showHelp);
$('close-help').addEventListener('click', closeHelp);
$('help-done').addEventListener('click', closeHelp);
$('tutorial-finish').addEventListener('click', () => { game.finishTutorial(); focusGame(); updateHUD(); });
$('tutorial-skip').addEventListener('click', () => { game.skipTutorial(); focusGame(); updateHUD(); });
function replayTutorial() {
  if (game.mode === 'paused') game.resume();
  game.replayTutorial(); focusGame(); updateUI(); updateHUD();
}
$('replay-tutorial').addEventListener('click', replayTutorial);

function updateSoundButton() {
  $('sound-button').setAttribute('aria-pressed', String(soundEnabled));
  $('sound-button').setAttribute('aria-label', soundEnabled ? '소리 끄기' : '소리 켜기');
  $('sound-button').title = soundEnabled ? '소리 끄기' : '소리 켜기';
}
$('sound-button').addEventListener('click', () => {
  soundEnabled = !soundEnabled; audio.setEnabled(soundEnabled); if (soundEnabled) unlockAudio();
  try { localStorage.setItem('haetae.sound', soundEnabled ? 'on' : 'off'); } catch { /* Optional preference. */ }
  updateSoundButton();
  if (game.mode === 'playing') canvas.focus({ preventScroll: true });
});
$('fullscreen-button').addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if ($('game-stage').requestFullscreen) await $('game-stage').requestFullscreen();
    else showToast('이 브라우저에서는 전체 화면을 지원하지 않습니다.');
  } catch { showToast('전체 화면으로 전환할 수 없습니다.'); }
  focusGame();
});
document.addEventListener('fullscreenchange', () => {
  const full = Boolean(document.fullscreenElement);
  $('fullscreen-button').setAttribute('aria-label', full ? '전체 화면 종료' : '전체 화면');
  $('fullscreen-toolbar').hidden = !full;
  if (full) $('game-stage').append($('touch-controls'));
  else $('game-stage').after($('touch-controls'));
});
$('exit-fullscreen').addEventListener('click', async () => {
  if (document.fullscreenElement) await document.exitFullscreen();
  focusGame();
});
for (const button of document.querySelectorAll('[data-quick-talisman]')) {
  button.addEventListener('click', () => {
    game.selectTalisman(Number(button.dataset.quickTalisman));
    focusGame(); updateHUD();
  });
}
for (const button of document.querySelectorAll('[data-talisman]')) {
  button.addEventListener('click', () => {
    const index = Number(button.dataset.talisman);

    game.selectTalisman(index); focusGame(); updateHUD();
  });
}

function addAction(label, handler, secondary = false) {
  const button = document.createElement('button');
  button.className = secondary ? 'secondary-button' : 'primary-button';
  button.textContent = label;
  button.addEventListener('click', () => { unlockAudio(); handler(); updateUI(); });
  $('state-actions').append(button);
}
function choice(value) { game.choose(value); focusGame(); }
function updateUI() {
  if (game.mode === renderedMode) return;
  renderedMode = game.mode;
  const mode = game.mode;
  $('title-overlay').hidden = mode !== 'title';
  $('hud').hidden = mode === 'title' || mode === 'ending';
  $('state-overlay').hidden = ['playing', 'title'].includes(mode);
  $('state-actions').replaceChildren();
  $('ending-report').hidden = true;
  $('continue-button').hidden = !save;
  const data = {
    paused: ['SESSION PAUSED', '잠시, 숨을 고르세요.', '소도의 시간은 멈춰 있습니다. 준비가 되면 다시 접속하세요.'],
    dead: ['CONNECTION LOST', '접속이 끊어졌습니다.', '아직 끝나지 않았습니다. 마지막으로 남긴 기록에서 다시 시작하세요.'],
    npc: ['CITIZEN DATA / 시민의 기억', '“제 기록을 지켜 주세요.”', '길을 잃은 시민 데이터가 도움을 청합니다. 당신의 선택은 소도에 기록됩니다.'],
    choice: ['ROOT ACCESS GRANTED', '어떤 세계를 남기겠습니까?', '국본은 쓰러졌습니다. 이제 코어의 운명은 당신에게 달려 있습니다.\n선택한 뒤에는 자신의 로그를 지우며 소도에서 탈출해야 합니다.'],
    ending: ['EXIT CODE: 0', game.ending?.title || '로그 소거 완료', game.ending?.text || '소도에 당신의 선택이 기록되었습니다.'],
  }[mode];
  if (data) {
    $('state-eyebrow').textContent = data[0]; $('state-title').textContent = data[1]; $('state-description').textContent = data[2];
  }
  if (mode === 'paused') {
    addAction('접속 재개 →', () => { game.resume(); focusGame(); });
    addAction('작전 안내', showHelp, true);
    if (!game.tutorial) addAction('선택한 부적 연습', replayTutorial, true);
    addAction('처음부터 시작', startNew, true);
  } else if (mode === 'dead') {
    addAction('체크포인트에서 재접속 →', () => { game.retry(); focusGame(); });
    addAction('작전 안내', showHelp, true);
  } else if (mode === 'npc') {
    addAction('기억을 보호한다', () => choice('protect'));
    addAction('대가를 요구한다 · 양심 −20', () => choice('extort'), true);
  } else if (mode === 'choice') {
    addAction('기린 · 시스템을 정화한다', () => choice('restore'));
    addAction('주작 · 코어를 파괴한다', () => choice('destroy'), true);
  } else if (mode === 'ending') {
    addAction('새로운 운명 시작 →', startNew);
    const lines = game.ending?.report || [];
    $('ending-report').textContent = [game.ending?.badge || '', '', ...lines].join('\n');
    $('ending-report').hidden = false;
  }
  updateHUD();
  if (data && !$('help-dialog').open) $('state-actions').querySelector('button')?.focus({ preventScroll: true });
}

const percent = (current, max) => `${Math.max(0, Math.min(100, (current / (max || 1)) * 100))}%`;
function setText(id, value = '') { const element = $(id); if (element.textContent !== value) element.textContent = value; }
function updateTutorial() {
  const t = game.tutorial;
  const visible = Boolean(t && game.mode === 'playing');
  $('tutorial-panel').hidden = !visible;
  $('game-stage').classList.toggle('has-tutorial', Boolean(t && game.mode !== 'title'));
  const action = visible && !t.completed ? t.step?.action : null;
  for (const button of document.querySelectorAll('[data-input]')) button.classList.toggle('recommended', button.dataset.input === action);
  for (const card of document.querySelectorAll('[data-ability-action]')) card.classList.toggle('recommended', card.dataset.abilityAction === (action === 'enchant' ? 'enhancedAttack' : action));
  const required = t ? ({ red: 0, blue: 1, white: 2, 'white-evolved': 2, black: 3, gold: 4 }[t.id]) : -1;
  for (const button of document.querySelectorAll('[data-talisman]')) button.classList.toggle('tutorial-selected', visible && !t.completed && Number(button.dataset.talisman) === required && game.player.selected !== required);
  if (!visible) return;
  const color = TALISMANS[required]?.color || '#8bd6bc';
  $('tutorial-panel').style.setProperty('--lesson-color', color);
  $('tutorial-panel').classList.toggle('complete', t.completed);
  setText('tutorial-category', t.completed ? '수련 완료 · 실전에서 활용해 보세요' : '옥추선의 수련 기록 · 안전한 실습');
  setText('tutorial-title', t.title);
  setText('tutorial-intro', t.intro);
  $('tutorial-intro').hidden = t.stepIndex > 0 && !t.completed;
  setText('tutorial-progress', `${Math.min(t.stepIndex + 1, t.steps.length)} / ${t.steps.length}`);
  setText('tutorial-key', t.completed ? '✓' : t.step?.key || '');
  setText('tutorial-step-title', t.completed ? '이제 차이를 직접 확인했습니다.' : t.step?.title || '');
  setText('tutorial-description', t.completed ? '수련을 마치면 시작한 자리로 돌아갑니다. 아래 부적 설명에서 언제든 다시 연습할 수 있습니다.' : t.step?.description || '');
  setText('tutorial-goal', t.completed ? 'F를 누르거나 아래 버튼으로 수련을 마치세요.' : t.step?.goal || '');
  setText('tutorial-feedback', t.feedback || t.tip || t.lastFeedback || '');
  $('tutorial-feedback').hidden = !(t.feedback || t.tip || t.lastFeedback);
  $('tutorial-finish').hidden = !t.completed;
  $('tutorial-skip').hidden = t.completed;
  setText('tutorial-safety', t.completed ? '실전 체력과 기력은 수련 전 상태로 돌아갑니다.' : '적과 추격이 멈춥니다. 기억은 파괴되지 않습니다.');
}

function updateHUD() {
  const p = game.player;
  $('health-fill').style.width = percent(p.hp, p.maxHp);
  $('energy-fill').style.width = percent(p.energy, p.maxEnergy);
  setText('hp-text', `체력 ${Math.ceil(p.hp)}`);
  setText('energy-text', `기력 ${Math.floor(p.energy)} / 100`);
  $('level-counter').textContent = `0${game.levelIndex + 1} / 04`;
  $('level-name').textContent = game.level.name;
  $('objective').textContent = game.mode === 'title' ? '소도의 경계를 넘어 잠입을 시작하세요.' : game.objective || game.level.objective;
  $('conscience-value').textContent = `${Math.round(game.conscience)}%`;
  $('conscience-fill').style.width = `${game.conscience}%`;
  $('memories-value').textContent = String(game.stats.memories).padStart(2, '0');
  $('game-hint').textContent = game.hint || '';
  $('game-hint').hidden = game.mode !== 'playing' || !game.hint || Boolean(game.tutorial);
  $('game-message').textContent = game.message || '';
  $('game-message').hidden = game.mode !== 'playing' || !(game.messageTime > 0 && game.message) || Boolean(game.tutorial);
  $('boss-hud').hidden = game.mode !== 'playing' || !game.boss || game.boss.dead || Boolean(game.tutorial);
  if (game.boss) { $('boss-name').textContent = game.boss.name; $('boss-fill').style.width = percent(game.boss.hp, game.boss.maxHp); }
  $('buff-status').hidden = game.mode !== 'playing' || (!p.buff && p.enchantCooldown <= 0);
  const buff = getBuffInfo(p);
  setText('buff-name', buff ? `${buff.name} 강화 중` : '부채 냉각 중');
  setText('buff-time', `${Math.ceil(buff?.remaining ?? p.enchantCooldown)}초`);
  setText('buff-effect', buff ? buff.description : '우클릭 강화 대기 · 좌클릭과 Q 사용 가능');
  $('buff-status').style.setProperty('--buff-color', buff?.color || '#9aa8ab');
  $('buff-fill').style.width = percent(buff?.remaining ?? p.enchantCooldown, buff?.duration || 30);
  $('buff-status').classList.toggle('cooling', !buff);
  const ability = getAbilityInfo(p);
  $('ability-details').style.setProperty('--ability-color', ability.color);
  setText('ability-title', `${ability.name} · ${ability.command}`);
  setText('ability-basic', ability.baseDescription);
  setText('ability-cast-title', ability.castTitle);
  setText('ability-cast-description', ability.castDescription);
  setText('ability-enchant-title', ability.enchantTitle);
  setText('ability-enchant-description', ability.enchantDescription);
  setText('ability-cast-state', !p.unlocked.includes(p.selected) ? '미획득 · 휠 또는 1–5로 보유 부적 선택' : p.selected === 4 ? '코어 앞에서 사용 · 기력 소모 없음' : game.castCooldown > 0 ? '시전 준비 중' : p.energy < 20 ? '기력 부족 · 자동 회복 중' : `사용 가능 · 현재 기력 ${Math.floor(p.energy)} / 100`);
  setText('ability-enchant-state', !p.unlocked.includes(p.selected) ? '미획득 · 강화할 수 없습니다.' : p.selected === 4 ? '기린은 부채를 강화하지 않습니다.' : buff ? `현재 부채에는 ${buff.name}의 힘 · ${Math.ceil(buff.remaining)}초` : p.enchantCooldown > 0 ? `다시 강화하기까지 ${Math.ceil(p.enchantCooldown)}초` : '우클릭 강화 공격 · E 강화만 준비 · 기력 소모 없음');
  $('replay-tutorial').disabled = !['playing', 'paused'].includes(game.mode) || Boolean(game.tutorial) || !p.unlocked.includes(p.selected);
  $('replay-tutorial').textContent = game.tutorial ? '수련 진행 중' : '선택한 부적 연습 ↗';
  for (const button of document.querySelectorAll('[data-talisman]')) {
    const index = Number(button.dataset.talisman);
    const unlocked = p.unlocked.includes(index);
    const selected = p.selected === index;
    button.classList.toggle('locked', !unlocked); button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected)); button.removeAttribute('aria-disabled');
    button.setAttribute('aria-label', `${index + 1} ${TALISMANS[index].name} ${unlocked ? '선택' : '미획득'}`);
    button.querySelector('.talisman-state').textContent = !unlocked ? (selected ? '선택 · 미획득' : '미획득') : selected ? '장착' : '사용 가능';
    if (index === 2) button.querySelector('small').textContent = p.tigerEvolved ? 'sudo' : 'ls -a';
  }
  $('selected-command').textContent = `${p.selected === 2 && p.tigerEvolved ? 'sudo' : TALISMANS[p.selected]?.command || 'rm'} _`;
  for (const button of document.querySelectorAll('[data-quick-talisman]')) {
    const index = Number(button.dataset.quickTalisman);
    button.disabled = false;
    button.setAttribute('aria-pressed', String(index === p.selected));
  }
  updateTutorial();
}

function frame(now) {
  const elapsed = Math.min((now - previousFrame) / 1000, .1);
  previousFrame = now; accumulator += elapsed; hudElapsed += elapsed;
  while (accumulator >= 1 / 60) { game.update(1 / 60, input.sample()); accumulator -= 1 / 60; }
  renderer.render(game);
  updateUI();
  if (hudElapsed >= .1) { updateHUD(); hudElapsed = 0; }
  requestAnimationFrame(frame);
}
window.addEventListener('resize', () => renderer.resize?.());
window.addEventListener('pagehide', () => { input.clear(); });
updateSoundButton(); updateUI(); requestAnimationFrame(frame);
