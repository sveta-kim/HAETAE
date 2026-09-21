import { TALISMANS } from './content.js';

const GLYPHS = ['朱', '龍', '虎', '武', '麟'];
const BASE_DESCRIPTION = '마우스를 향해 기본 탄을 발사합니다. 누르고 있으면 연사합니다. 기력 소모 없이 22·22·32 피해를 주며, 벽·사물·첫 적에 닿으면 소멸합니다. 강화 중에도 좌클릭은 기본 탄입니다.';
const ENCHANT_RECOVERY = ' 기력 소모는 없고, 강화가 끝나면 30초 동안 다시 강화할 수 없습니다.';

const ABILITIES = [
  {
    castTitle: '부적 발동 · 조준 화염탄',
    castDescription: '마우스 방향으로 화염탄을 쏩니다. 한 발에 기력 20, 처음 맞은 대상에게 52 피해를 줍니다. 벽과 사물을 관통하지 않습니다. 보안문과 기록도 파괴하므로 양심이 줄 수 있습니다.',
    enchantTitle: '부채 강화 · 화염을 두른 공격',
    enchantDescription: '15초 동안 우클릭 피해가 1.7배가 되고, 명중한 적을 3초간 태웁니다.',
    activeDescription: '우클릭 피해 1.7배 · 명중 시 3초 화상',
  },
  {
    castTitle: '부적 발동 · 숨은 길 탐지',
    castDescription: '기력 20을 써서 숨은 발판과 환영의 본체를 8초 동안 드러냅니다. 직접 피해는 주지 않습니다.',
    enchantTitle: '부채 강화 · 가벼운 몸놀림',
    enchantDescription: '12초 동안 이동이 약 35% 빨라지고, 우클릭 연타 간격이 짧아지며 Shift 대시로 더 멀리 이동합니다.',
    activeDescription: '이동 약 35% 증가 · 우클릭 연타 가속 · 대시 거리 증가',
  },
  {
    castTitle: '부적 발동 · 진실 탐지',
    castDescription: '기력 20을 써서 숨은 발판과 환영의 본체를 12초 동안 드러냅니다. 탐지한 본체를 마우스로 조준해 공격하세요.',
    enchantTitle: '부채 강화 · 은신과 기습',
    enchantDescription: '최대 15초 동안 일반 적에게 들키지 않습니다. 첫 우클릭 공격은 피해 2배이며, 공격하거나 맞으면 은신이 끝납니다. 보스는 속이지 못합니다.',
    activeDescription: '일반 적에게 은신 · 첫 우클릭 피해 2배 · 공격·피격 시 종료',
  },
  {
    castTitle: '부적 발동 · 반사 방패',
    castDescription: '기력 20을 써서 5초 동안 적의 공격을 막고 탄환을 되돌립니다. 데이터 늪의 감속도 무시합니다.',
    enchantTitle: '부채 강화 · 오래가는 보호',
    enchantDescription: '12초 동안 적에게 받는 피해가 60% 줄고, 탄환을 반사하며 근접 공격자에게 반격합니다. 데이터 늪의 감속도 무시합니다.',
    activeDescription: '적의 피해 60% 감소 · 탄환 반사 · 근접 반격 · 늪 감속 무시',
  },
  {
    castTitle: '부적 발동 · 코어의 운명 선택',
    castDescription: '국본을 쓰러뜨린 뒤 루트 코어 앞에서 Q 또는 F로 소도의 운명을 선택합니다. 기력을 소모하지 않습니다.',
    enchantTitle: '부채 강화 불가 · 코어의 열쇠',
    enchantDescription: '기린은 루트 코어에 쓰는 부적입니다. 우클릭 강화 공격과 E를 사용할 수 없습니다. 좌클릭 기본 공격은 가능합니다.',
    activeDescription: '루트 코어에서 사용 · 부채 강화 없음',
  },
];

const AWAKENED_TIGER = {
  castTitle: '부적 발동 · 진실 탐지와 문 개방',
  castDescription: '기력 20을 써서 환영의 본체를 12초 동안 드러내고, 가까운 보안문을 양심 소모 없이 엽니다. 숨은 발판은 항상 보입니다.',
  enchantTitle: '부채 강화 · 각성한 은신',
  enchantDescription: '최대 30초 동안 일반 적에게 은신하고 우클릭 피해가 2배가 됩니다. 공격 후에는 최대 1초만 더 유지되며, 맞으면 바로 끝납니다. 보스는 속이지 못합니다.',
  activeDescription: '일반 적에게 은신 · 우클릭 피해 2배 · 공격 후 최대 1초 유지',
};

export function getAbilityInfo(player) {
  const index = Number.isInteger(player?.selected) && TALISMANS[player.selected] ? player.selected : 0;
  const talisman = TALISMANS[index];
  const evolved = index === 2 && player?.tigerEvolved;
  const ability = evolved ? AWAKENED_TIGER : ABILITIES[index];
  return {
    name: evolved ? '각성 백호' : talisman.name,
    color: talisman.color,
    glyph: GLYPHS[index],
    command: evolved ? 'sudo' : talisman.command,
    ...ability,
    enchantDescription: ability.enchantDescription + (index === 4 ? '' : ' 우클릭은 자동 강화 후 발사, E는 강화만 준비합니다.' + ENCHANT_RECOVERY),
    baseDescription: BASE_DESCRIPTION,
  };
}

export function getBuffInfo(player) {
  const buff = player?.buff;
  if (!buff || !Number.isFinite(buff.remaining) || buff.remaining <= 0) return null;
  const index = TALISMANS.findIndex(talisman => talisman.id === buff.id);
  if (index < 0 || index === 4) return null;
  // Choosing another talisman changes Q and the next E, never the current buff.
  const ability = getAbilityInfo({ ...player, selected: index });
  return {
    name: ability.name,
    color: ability.color,
    description: ability.activeDescription,
    duration: index === 2 && player.tigerEvolved ? 30 : TALISMANS[index].duration,
    remaining: buff.remaining,
  };
}
