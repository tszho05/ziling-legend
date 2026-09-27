// 三個職業：劍士為男角，法師、弓手為女角。
// 技能一律要先答對成語題才能施放。一開始只有起始技能：
//   完成「清除史萊姆」→ 解鎖攻擊＋加防技能（冷卻 2）
//   完成「哥布林的威脅」→ 解鎖攻擊＋回血技能（冷卻 3）
// cd：施放後（答對或答錯都算）要等的回合數；cd 2 = 下一回合不能用，第 2 回合可以再用。
// guard：之後幾個回合受到的傷害減半；heal：回復最大生命的比例。
// 數值已用 Lv.5 對亂字魔（兩個型態）模擬平衡。
export const CLASSES = {
  swordsman: {
    id: 'swordsman', name: '劍士', gender: 'male', color: '#c0392b',
    desc: '生命高、攻擊穩，站在最前線保護同伴。',
    base: { hp: 58, atk: 12, def: 7, spd: 6 },
    grow: { hp: 9, atk: 2.5, def: 1.5, spd: 1 },
    skills: [
      { id: 'heavy', name: '重斬', kind: 'damage', power: 2.2, fx: 'slash', desc: '全力一擊，造成大量傷害。' },
      { id: 'shield', name: '盾擊', kind: 'damage', power: 1.6, guard: 2, cd: 2, fx: 'slash', unlock: 'q_slime3', desc: '用盾撞擊敵人，之後 2 回合受傷減半。' },
      { id: 'justice', name: '正義制裁', kind: 'damage', power: 1.8, heal: 0.25, cd: 3, fx: 'slash', unlock: 'q_goblin', desc: '正義的一擊，並回復 25% 生命。' },
    ],
  },
  mage: {
    id: 'mage', name: '法師', gender: 'female', color: '#2e6fd8',
    desc: '魔法可攻擊全體敵人，回復力最強。',
    base: { hp: 50, atk: 10, def: 5, spd: 7 },
    grow: { hp: 9, atk: 2.5, def: 1.5, spd: 1 },
    skills: [
      { id: 'fireball', name: '火球術', kind: 'damage_all', power: 2.2, fx: 'fire', desc: '火焰攻擊全體敵人。' },
      { id: 'iceshield', name: '冰晶護盾', kind: 'damage_all', power: 1.5, guard: 2, cd: 2, fx: 'fire', unlock: 'q_slime3', desc: '冰晶攻擊全體敵人，之後 2 回合受傷減半。' },
      { id: 'spark', name: '生命火花', kind: 'damage_all', power: 1.6, heal: 0.45, cd: 3, fx: 'fire', unlock: 'q_goblin', desc: '攻擊全體敵人，並回復 45% 生命。' },
    ],
  },
  archer: {
    id: 'archer', name: '弓手', gender: 'female', color: '#2f9e57',
    desc: '攻擊力高，擅長連續射擊。',
    base: { hp: 52, atk: 11, def: 6, spd: 10 },
    grow: { hp: 9, atk: 3, def: 1.5, spd: 2 },
    skills: [
      { id: 'pierce', name: '穿雲箭', kind: 'damage', power: 2.1, fx: 'arrow', desc: '強力的一箭。' },
      { id: 'roll', name: '翻滾射擊', kind: 'damage', power: 1.6, guard: 2, cd: 2, fx: 'arrow', unlock: 'q_slime3', desc: '翻滾閃避並射擊，之後 2 回合受傷減半。' },
      { id: 'forest', name: '森林之箭', kind: 'multi_hit', power: 0.8, hits: 3, heal: 0.3, cd: 3, fx: 'arrow', unlock: 'q_goblin', desc: '連射三箭，並回復 30% 生命。' },
    ],
  },
};

export function statsAt(cls, level) {
  const s = {};
  for (const k of Object.keys(cls.base)) s[k] = Math.round(cls.base[k] + cls.grow[k] * (level - 1));
  return s;
}

export const expToNext = level => 20 + (level - 1) * 15;
