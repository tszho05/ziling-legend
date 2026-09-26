import { NPCS, QUESTS } from './data/npcs.js';
import { MONSTERS } from './data/monsters.js';
import { state, questComplete, questProgress } from './state.js';
import { zoneOpen } from './data/zones.js';

// 「下一步」提示：回傳 { text, target }，target 為 { x, z }（目前地圖上的位置）或 null
const CHIEF = NPCS.find(n => n.quests);

function nextQuestId() {
  for (const id of CHIEF.quests) if (state.quests[id]?.status !== 'done') return id;
  return null;
}

function nearestTeacher(from) {
  let best = null, bd = Infinity;
  for (const n of NPCS) {
    if (!n.teaches || n.teaches.every(id => state.learned.includes(id))) continue;
    const d = Math.hypot(n.x - from.x, n.z - from.z);
    if (d < bd) { bd = d; best = n; }
  }
  return best;
}

export function computeObjective(world, leaveCount) {
  const map = world.layout.id;
  const p = world.player.pivot.position;
  const exit = world.layout.exits[0];
  const exitPos = { x: exit.rect.x + exit.rect.w / 2, z: exit.rect.z + exit.rect.d / 2 };
  const chiefPos = { x: CHIEF.x, z: CHIEF.z };
  const qid = nextQuestId();

  if (!qid) return { text: '全部任務完成！可以繼續溫習成語。', target: null };
  const q = QUESTS[qid];
  const st = state.quests[qid];

  // 還未接任務
  if (!st) {
    if (map === 'field') return { text: '回墨香鎮找鎮長接新任務', target: exitPos };
    return { text: `去噴水池旁找鎮長，接新任務「${q.title}」`, target: chiefPos };
  }
  // 任務完成，回去報告
  if (questComplete(qid)) {
    if (map === 'field') return { text: `「${q.title}」完成！回墨香鎮找鎮長`, target: exitPos };
    return { text: `「${q.title}」完成！回去找鎮長領獎`, target: chiefPos };
  }
  const prog = `（${questProgress(qid)}/${q.goal.count}）`;
  // 學成語任務
  if (q.goal.type === 'learn') {
    if (map === 'field') return { text: `回墨香鎮學成語${prog}`, target: exitPos };
    const t = nearestTeacher(p);
    return t
      ? { text: `去找${t.name}學成語${prog}`, target: { x: t.x, z: t.z } }
      : { text: `學成語${prog}`, target: null };
  }
  // 打怪任務
  const name = MONSTERS[q.goal.target].name;
  if (map === 'town') {
    if (state.learned.length < leaveCount) {
      const t = nearestTeacher(p);
      return { text: `先學會 ${leaveCount} 個成語才可出鎮：去找${t?.name ?? '鎮民'}`, target: t ? { x: t.x, z: t.z } : null };
    }
    return { text: `從北面鎮門出去，到郊區打倒${name}${prog}`, target: exitPos };
  }
  // 郊區：指向最近的目標怪物
  let best = null, bd = Infinity;
  for (const m of world.monsters) {
    if (world.defeated.has(m.id) || !m.enc.party.includes(q.goal.target) || !zoneOpen(m.enc.zone ?? 1)) continue;
    const pos = m.sprite.pivot.position;
    const d = Math.hypot(pos.x - p.x, pos.z - p.z);
    if (d < bd) { bd = d; best = pos; }
  }
  if (best) return { text: `打倒${name}${prog}`, target: { x: best.x, z: best.z } };
  return { text: `這裏的${name}都打倒了，回墨香鎮再出來會重新出現${prog}`, target: exitPos };
}
