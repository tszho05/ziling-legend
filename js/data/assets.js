// 美術素材清單（手繪高清風格、3 頭身、暖色調）。把 Codex generate2dsprite 生成的透明 PNG 放到 path，重新整理即可取代佔位圖。
// cols/rows：精靈表格數。walk 表的列序為 下、左、右、上（generate2dsprite player_sheet 的輸出順序）。
// height：整格在遊戲世界中的高度（1 = 一格地磚）；feet：腳底離格子底邊的比例（預設 0.04）。
const hero = (cls) => ({
  [`hero_${cls}_walk`]: { path: `assets/sprites/hero_${cls}_walk.png`, cols: 4, rows: 4, height: 1.9, kind: 'walk' },
  [`hero_${cls}_battle_idle`]: { path: `assets/sprites/hero_${cls}_battle_idle.png`, cols: 2, rows: 2, height: 2.1, kind: 'idle' },
  [`hero_${cls}_battle_attack`]: { path: `assets/sprites/hero_${cls}_battle_attack.png`, cols: 2, rows: 2, height: 2.1, kind: 'idle' },
});

export const ASSETS = {
  ...hero('swordsman'),
  ...hero('mage'),
  ...hero('archer'),
  npc_scholar: { path: 'assets/sprites/npc_scholar.png', cols: 2, rows: 2, height: 1.9, kind: 'idle' },
  npc_merchant: { path: 'assets/sprites/npc_merchant.png', cols: 2, rows: 2, height: 1.9, kind: 'idle' },
  npc_guard: { path: 'assets/sprites/npc_guard.png', cols: 2, rows: 2, height: 2.0, kind: 'idle' },
  npc_granny: { path: 'assets/sprites/npc_granny.png', cols: 2, rows: 2, height: 1.6, kind: 'idle' },
  npc_child: { path: 'assets/sprites/npc_child.png', cols: 2, rows: 2, height: 1.3, kind: 'idle' },
  npc_chief: { path: 'assets/sprites/npc_chief.png', cols: 2, rows: 2, height: 1.9, kind: 'idle' },
  monster_slime: { path: 'assets/sprites/monster_slime.png', cols: 2, rows: 2, height: 1.1, kind: 'idle' },
  monster_wolf: { path: 'assets/sprites/monster_wolf.png', cols: 2, rows: 2, height: 1.4, kind: 'idle' },
  monster_goblin: { path: 'assets/sprites/monster_goblin.png', cols: 2, rows: 2, height: 1.6, kind: 'idle' },
  monster_boss: { path: 'assets/sprites/monster_boss.png', cols: 2, rows: 2, height: 2.8, kind: 'idle' },
  fx_slash: { path: 'assets/sprites/fx_slash.png', cols: 2, rows: 2, height: 2.2, kind: 'fx' },
  fx_fire: { path: 'assets/sprites/fx_fire.png', cols: 2, rows: 2, height: 2.2, kind: 'fx' },
  fx_arrow: { path: 'assets/sprites/fx_arrow.png', cols: 2, rows: 2, height: 1.6, kind: 'fx' },
  fx_heal: { path: 'assets/sprites/fx_heal.png', cols: 2, rows: 2, height: 2.4, kind: 'fx' },
};
