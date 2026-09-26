import { state } from '../state.js';

// 郊區分區與關卡：完成／接受鎮長的任務後逐區開通
// zone 1 草原 → (木橋) zone 2 森林 → (營地入口) zone 3 哥布林營地 → (魔法結界) zone 4 亂字魔祭壇
export const GATES = {
  bridge: {
    zone: 2, open: () => state.quests.q_slime3?.status === 'done',
    msg: ['一根倒下的大木頭擋住了木橋。', '先完成鎮長的任務「清除史萊姆」，鎮民就會來幫你搬開。'],
  },
  camp: {
    zone: 3, open: () => !!state.quests.q_goblin,
    msg: ['一棵倒下的大樹擋住了往北的路，後面好像傳來哥布林的聲音。', '先向鎮長接下任務「哥布林的威脅」吧。'],
  },
  altar: {
    zone: 4, open: () => !!state.quests.q_boss,
    msg: ['一道紫色的魔法結界擋住了去路，裏面飄着亂七八糟的文字。', '要喚醒全部字靈，向鎮長接下「討伐亂字魔」才能打破結界。'],
  },
};

const ORDER = ['bridge', 'camp', 'altar'];
export function zoneOpen(zone) {
  for (let z = 2; z <= zone; z++) if (!GATES[ORDER[z - 2]].open()) return false;
  return true;
}
