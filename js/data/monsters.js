// 郊區怪物：史萊姆、野狼、哥布林，另有頭目。
// 頭目：亂字魔（字靈傳說）。
export const MONSTERS = {
  slime: { id: 'slime', name: '史萊姆', hp: 22, atk: 7, def: 2, exp: 8 },
  wolf: { id: 'wolf', name: '野狼', hp: 34, atk: 10, def: 4, exp: 12 },
  goblin: { id: 'goblin', name: '哥布林', hp: 42, atk: 12, def: 5, exp: 16 },
  // 頭目：第一型態 200 血；血量歸零後復活成「暴走形態」（血量回滿），會墨水連擊和封印技能
  boss: { id: 'boss', name: '亂字魔', hp: 200, atk: 15, def: 7, exp: 80, boss: true, heavyEvery: 3, phase2: { name: '亂字魔・暴走', atk: 16, heavyEvery: 4 } },
};

// 郊區遊蕩的怪物群（碰到就開戰）。x, z 為格子座標；zone 為所在分區（見 zones.js）。
export const FIELD_ENCOUNTERS = [
  // 1 草原
  { x: 9, z: 28, zone: 1, party: ['slime'] },
  { x: 30, z: 27, zone: 1, party: ['slime', 'slime'] },
  { x: 14, z: 25, zone: 1, party: ['slime'] },
  { x: 34, z: 30, zone: 1, party: ['slime'] },
  // 2 森林
  { x: 9, z: 16, zone: 2, party: ['wolf'] },
  { x: 31, z: 15, zone: 2, party: ['wolf'] },
  { x: 24, z: 18, zone: 2, party: ['slime', 'wolf'] },
  { x: 36, z: 19, zone: 2, party: ['wolf', 'wolf'] },
  // 3 哥布林營地
  { x: 7, z: 5, zone: 3, party: ['goblin'] },
  { x: 17, z: 7, zone: 3, party: ['goblin', 'slime'] },
  { x: 20, z: 3, zone: 3, party: ['goblin'] },
];

// 頭目：在北東的祭壇，接了頭目任務後才出現，不會四處走動
export const BOSS_ENCOUNTER = { x: 33, z: 4, zone: 4, party: ['boss'], requiresQuest: 'q_boss' };
