export const TALISMANS = [
  { id: 'red', name: '주작', command: 'rm', color: '#ff5b70', duration: 15 },
  { id: 'blue', name: '청룡', command: 'cd', color: '#52d8ff', duration: 12 },
  { id: 'white', name: '백호', command: 'ls -a', color: '#f0efff', duration: 15 },
  { id: 'black', name: '현무', command: 'chmod', color: '#8e8bf8', duration: 12 },
  { id: 'gold', name: '기린', command: 'su -', color: '#f5d182', duration: 0 },
];

const platform = (x, y, w, h = 28, extra = {}) => ({ x, y, w, h, ...extra });
const object = (id, type, x, y = 416, extra = {}) => ({ id, type, x, y, w: 32, h: 44, active: true, ...extra });
const enemy = (id, type, name, x, hp, extra = {}) => ({
  id, type, name, x, y: 412, w: 34, h: 48, hp, maxHp: hp,
  facing: -1, attackTime: 0, alert: false, dead: false, timer: 0,
  ...extra,
});
const boss = (id, type, name, x, hp, extra = {}) => enemy(id, type, name, x, hp, {
  y: 366, w: 82, h: 94, boss: true, phase: 1, ...extra,
});

export const LEVELS = [
  {
    name: '방화벽 · 해자', subtitle: 'THE MOAT', theme: 'moat',
    objective: '냉각 장치로 불가사리를 무력화하고 성문을 돌파하세요.', width: 3240,
    platforms: [
      platform(0, 460, 620), platform(620, 505, 170), platform(790, 460, 2450),
      platform(260, 370, 150), platform(490, 315, 140),
      platform(730, 326, 150, 18, { hidden: true }), platform(930, 350, 155),
      platform(1710, 350, 170), platform(2210, 344, 160),
    ],
    enemies: [
      enemy('moat-p1', 'pabal', '파발', 535, 22),
      enemy('moat-s1', 'sunra', '순라', 930, 45),
      boss('bulgasari', 'bulgasari', '불가사리 · 코드 포식자', 1480, 180),
      enemy('moat-shield', 'shield', '방패수', 2240, 70),
      boss('jangseung', 'jangseung', '천하대장군 · 수문장', 2740, 200),
    ],
    objects: [
      object('white', 'talisman', 410, 405, { value: 2, label: '낡은 백호 부적' }),
      object('moat-memory-1', 'memory', 500, 270, { label: '어느 시민의 일기' }),
      object('moat-memory-2', 'memory', 972, 307, { label: '나루터의 가족사진' }),
      object('moat-check-1', 'checkpoint', 1160, 400, { label: '격리 구역 접속점' }),
      object('cooler', 'cooler', 1340, 404, { w: 48, h: 56, label: '냉각 장치 · 클릭 / F' }),
      object('moat-npc', 'npc', 1850, 410, { label: '길 잃은 기록지기' }),
      object('moat-gate', 'gate', 2430, 315, { w: 34, h: 145, label: '잠긴 보안문', value: 'key' }),
      object('moat-check-2', 'checkpoint', 2520, 400, { label: '성문 접속점' }),
      object('moat-exit', 'exit', 3100, 330, { w: 78, h: 130, label: '장서각으로 · F' }),
    ],
  },
  {
    name: '메모리 · 장서각', subtitle: 'THE ARCHIVE', theme: 'archive',
    objective: '백호로 진실을 밝히고 사관에게서 설계자의 기록을 되찾으세요.', width: 3260,
    platforms: [
      platform(0, 460, 3260), platform(280, 350, 190),
      platform(570, 300, 150, 24, { moving: true }), platform(850, 350, 140),
      platform(1210, 325, 150, 18, { hidden: true }), platform(1820, 355, 180),
      platform(2080, 290, 150), platform(2460, 345, 130),
    ],
    enemies: [
      enemy('archive-d1', 'dokkaebi', '도깨비', 550, 40),
      enemy('archive-s1', 'sunra', '순라', 850, 50),
      boss('jangsan', 'jangsan', '장산범 · 화이트 노이즈', 1430, 170),
      enemy('archive-d2', 'dokkaebi', '도깨비', 2080, 45),
      boss('sagwan', 'sagwan', '사관 · 기록하는 자', 2750, 220),
    ],
    objects: [
      object('black', 'talisman', 190, 405, { value: 3, label: '현무 부적' }),
      object('archive-memory-1', 'memory', 320, 307, { label: '지워진 상소문' }),
      object('shelf-switch', 'cooler', 750, 412, { label: '책장 스위치 · 클릭 / F', value: 'shelf' }),
      object('archive-check-1', 'checkpoint', 1120, 400, { label: '포인터 미로 접속점' }),
      object('false-exit', 'gate', 1260, 403, { w: 45, h: 57, label: '이쪽이야…', value: 'illusion' }),
      object('father-record', 'log', 1870, 307, { label: '설계자의 마지막 기록', value: 'story' }),
      object('archive-memory-2', 'memory', 2130, 247, { label: '숙청된 시민 명부' }),
      object('archive-npc', 'npc', 2310, 410, { label: '갇힌 사서' }),
      object('archive-check-2', 'checkpoint', 2540, 400, { label: '사관 집무실 접속점' }),
      object('archive-exit', 'exit', 3120, 330, { w: 78, h: 130, label: '근정전으로 · F' }),
    ],
  },
  {
    name: '커널 · 근정전', subtitle: 'THE KERNEL', theme: 'kernel',
    objective: '백호의 권한을 깨우고, 아홉 꼬리와 국본의 통제를 해제하세요.', width: 3330,
    platforms: [
      platform(0, 460, 3330), platform(390, 354, 155),
      platform(840, 323, 155, 18, { hidden: true }), platform(1600, 345, 170),
      platform(2140, 352, 150), platform(2700, 325, 160),
    ],
    enemies: [
      enemy('kernel-s1', 'sunra', '황금 순라', 550, 65),
      boss('gumiho', 'gumiho', '구미호 · 9중 암호화', 1140, 180, { tails: 9 }),
      enemy('kernel-shield', 'shield', '근위 방패수', 1910, 85),
      enemy('kernel-d1', 'dokkaebi', '근위 도깨비', 2230, 60),
      boss('root', 'root', '국본 · THE ROOT', 2730, 280),
    ],
    objects: [
      object('tiger-awakening', 'talisman', 220, 405, { value: 'evolve', label: '백호 각성 · sudo' }),
      object('kernel-memory-1', 'memory', 430, 311, { label: '소도의 첫 설계도' }),
      object('kernel-check-1', 'checkpoint', 860, 400, { label: '홍례문 접속점' }),
      object('permission-gate', 'gate', 1440, 292, { w: 36, h: 168, label: '권한 필요 · sudo', value: 'sudo' }),
      object('kernel-memory-2', 'memory', 1650, 302, { label: '매화에게 남긴 편지' }),
      object('kernel-npc', 'npc', 2070, 410, { label: '추방된 시민' }),
      object('kernel-check-2', 'checkpoint', 2450, 400, { label: '근정전 접속점' }),
      object('root-core', 'core', 3090, 335, { w: 70, h: 125, label: '루트 코어 · F' }),
    ],
  },
  {
    name: '소멸의 나루터', subtitle: 'THE LAST SESSION', theme: 'escape',
    objective: '접속 로그를 지워 추격을 늦추고, 마지막 나루터에 도달하세요.', width: 2870,
    platforms: [
      platform(0, 460, 650), platform(650, 505, 160), platform(810, 460, 720),
      platform(1530, 505, 170), platform(1700, 460, 1170),
      platform(470, 355, 145), platform(1120, 340, 155),
      platform(1530, 383, 170, 18, { hidden: true }), platform(2130, 353, 165),
    ],
    enemies: [],
    objects: [
      object('escape-log-1', 'log', 450, 417, { value: 'escape', label: '접속 로그 · 클릭 / rm' }),
      object('escape-log-2', 'log', 1080, 417, { value: 'escape', label: '접속 로그 · 클릭 / rm' }),
      object('escape-gate', 'gate', 1780, 314, { w: 34, h: 146, value: 'sudo', label: '임시 성문 · sudo' }),
      object('escape-log-3', 'log', 2200, 417, { value: 'escape', label: '접속 로그 · 클릭 / rm' }),
      object('escape-exit', 'exit', 2740, 330, { w: 78, h: 130, label: '로그아웃 · F' }),
    ],
  },
];

export function createLevel(index) {
  return structuredClone(LEVELS[index]);
}

export const ENDINGS = {
  black: {
    id: 'black', title: '검은 심판', badge: '흑철 귀면 마패',
    text: '소도는 마지막 불꽃과 함께 사라졌다. 설매화는 자유를 얻었지만, 돌아갈 도시는 남지 않았다.',
    report: ['[REMOVE_COMPLETE]', '커널 상태: DOWN · Kernel Panic', '관리자 계정: [REDACTED]', '복구 데이터: 없음', 'Exit Code: 0 — Success'],
  },
  white: {
    id: 'white', title: '다시 피어난 소도', badge: '황금 오마패',
    text: '푸른 해치는 마패 앞에 고개를 숙였다. 하얀 해태가 아버지의 모습으로 빛났다. “매화야, 네가 소도를 다시 꽃피웠구나.”',
    report: ['[RESTORATION_COMPLETE]', '커널 상태: STABLE · Authenticated by Creator', '관리자 계정: 설매화', '설계자의 유산: 정당한 후계자에게 계승', '환영합니다, 관리자님.'],
  },
  gray: {
    id: 'gray', title: '이름 없는 바람', badge: '낡은 청동 마패',
    text: '세 마리의 말이 해치를 진정시켰다. 소도는 복구되었고 매화는 대가를 챙겨 떠났다. 그녀의 이름은 가장 깊은 주석으로 남았다.',
    report: ['[RESTORATION_COMPLETE]', '커널 상태: OPTIMIZED · New Era', '관리자 계정: UNDEFINED', '접속 세션: Ghost Session', '당신은 소도의 주석으로 남았습니다.'],
  },
};
