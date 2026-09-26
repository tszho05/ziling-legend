// 郊區怪物：史萊姆、野狼、哥布林，另有頭目。
// 頭目：亂字魔（字靈傳說）。
export const MONSTERS = {
  slime: { id: 'slime', name: '史萊姆', hp: 22, atk: 7, def: 2, exp: 8 },
  wolf: { id: 'wolf', name: '野狼', hp: 34, atk: 10, def: 4, exp: 12 },
  goblin: { id: 'goblin', name: '哥布林', hp: 42, atk: 12, def: 5, exp: 16 },
  boss: { id: 'boss', name: '亂字魔', hp: 160, atk: 15, def: 7, exp: 80, boss: true, heavyEvery: 3 },
};

// 郊區遊蕩的怪物群（碰到就開戰）。x, z 為格子座標。
export const FIELD_ENCOUNTERS = [
  { x: 9, z: 16, party: ['slime'] },
  { x: 20, z: 17, party: ['slime', 'slime'] },
  { x: 6, z: 9, party: ['wolf'] },
  { x: 23, z: 10, party: ['slime', 'wolf'] },
  { x: 11, z: 6, party: ['goblin'] },
  { x: 24, z: 5, party: ['goblin', 'slime'] },
];

// 頭目：接了頭目任務後才會在郊區北端出現，不會四處走動
export const BOSS_ENCOUNTER = { x: 16, z: 2, party: ['boss'], requiresQuest: 'q_boss' };
