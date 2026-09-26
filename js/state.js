import { CLASSES, statsAt, expToNext } from './data/classes.js';
import { QUESTS } from './data/npcs.js';

const KEY = 'idiom-rpg-save-v2';

export const state = {
  classId: null, level: 1, exp: 0, hp: 0,
  learned: [],            // 已學成語 id
  quests: {},             // id -> { status: 'active' | 'done', progress }
  kills: {},              // 怪物 id -> 數量
  quiz: { correct: 0, wrong: 0 },
  map: 'town',
};

export function newGame(classId) {
  Object.assign(state, { classId, level: 1, exp: 0, learned: [], quests: {}, kills: {}, quiz: { correct: 0, wrong: 0 }, map: 'town' });
  state.hp = maxHp();
  save();
}

export const cls = () => CLASSES[state.classId];
export const stats = () => statsAt(cls(), state.level);
export const maxHp = () => stats().hp;

export function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} }
export function hasSave() { try { return !!localStorage.getItem(KEY); } catch { return false; } }
export function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && CLASSES[s.classId]) { Object.assign(state, s); return true; }
  } catch {}
  return false;
}
export function clearSave() { try { localStorage.removeItem(KEY); } catch {} }

// 回傳升了幾級
export function gainExp(n) {
  state.exp += n;
  let ups = 0;
  while (state.exp >= expToNext(state.level)) {
    state.exp -= expToNext(state.level);
    state.level++; ups++;
  }
  if (ups) state.hp = maxHp();
  save();
  return ups;
}

export function learn(id) {
  if (!state.learned.includes(id)) state.learned.push(id);
  save();
}

export function questProgress(id) {
  const q = QUESTS[id];
  if (q.goal.type === 'learn') return Math.min(state.learned.length, q.goal.count);
  const st = state.quests[id];
  return Math.min(st?.progress ?? 0, q.goal.count);
}
export const questComplete = id => questProgress(id) >= QUESTS[id].goal.count;

export function recordKill(monsterId) {
  state.kills[monsterId] = (state.kills[monsterId] || 0) + 1;
  for (const [id, st] of Object.entries(state.quests)) {
    const q = QUESTS[id];
    if (st.status === 'active' && q.goal.type === 'defeat' && q.goal.target === monsterId) st.progress = (st.progress || 0) + 1;
  }
  save();
}
