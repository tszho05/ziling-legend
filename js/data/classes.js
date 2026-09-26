// 三個職業。數值與技能名稱為暫定，待確認。
// 技能一律要先答對成語題才能施放。
export const CLASSES = {
  swordsman: {
    id: 'swordsman', name: '劍士', color: '#c0392b',
    desc: '生命高、攻擊穩，站在最前線保護同伴。',
    base: { hp: 60, atk: 12, def: 8, spd: 6 },
    grow: { hp: 10, atk: 3, def: 2, spd: 1 },
    skills: [
      { id: 'heavy', name: '重斬', kind: 'damage', power: 2.4, fx: 'slash', desc: '全力一擊，造成大量傷害。' },
      { id: 'guard', name: '鐵壁', kind: 'heal', power: 0.35, fx: 'heal', desc: '回復三成生命，並在本回合減傷。' },
    ],
  },
  mage: {
    id: 'mage', name: '法師', color: '#2e6fd8',
    desc: '生命較低，但魔法威力強大，可攻擊全體敵人。',
    base: { hp: 42, atk: 9, def: 5, spd: 7 },
    grow: { hp: 7, atk: 2, def: 1, spd: 1 },
    skills: [
      { id: 'fireball', name: '火球術', kind: 'damage_all', power: 2.2, fx: 'fire', desc: '火焰攻擊全體敵人。' },
      { id: 'heal', name: '治癒術', kind: 'heal', power: 0.5, fx: 'heal', desc: '回復五成生命。' },
    ],
  },
  archer: {
    id: 'archer', name: '弓手', color: '#2f9e57',
    desc: '速度快，擅長連續射擊與會心一擊。',
    base: { hp: 50, atk: 11, def: 6, spd: 10 },
    grow: { hp: 8, atk: 3, def: 1, spd: 2 },
    skills: [
      { id: 'multishot', name: '連射', kind: 'multi_hit', power: 1.0, hits: 3, fx: 'arrow', desc: '連射三箭，隨機命中敵人。' },
      { id: 'pierce', name: '穿雲箭', kind: 'damage', power: 2.6, fx: 'arrow', desc: '必定會心的強力一箭。' },
    ],
  },
};

export function statsAt(cls, level) {
  const s = {};
  for (const k of Object.keys(cls.base)) s[k] = cls.base[k] + cls.grow[k] * (level - 1);
  return s;
}

export const expToNext = level => 20 + (level - 1) * 15;
