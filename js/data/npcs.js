// 墨香鎮 NPC（故事：字靈傳說）。5 人各教 2 個成語，鎮長發佈任務。
// teaches：此 NPC 教授的成語 id；quests：此 NPC 發佈的任務 id（依次序）。
export const NPCS = [
  {
    id: 'scholar', name: '學者', sprite: 'npc_scholar', x: 9.5, z: 10.5,
    greet: ['年輕的守護者，歡迎來到墨香鎮的學堂廣場。', '亂字魔來了以後，書本上的成語都變得模模糊糊……', '幸好我還記得兩個，讓我教你吧。'],
    teaches: ['xinbuzaiyan', 'yichoumozhan'],
  },
  {
    id: 'merchant', name: '商人', sprite: 'npc_merchant', x: 18.5, z: 10.5,
    greet: ['來來來，看一看！', '自從字靈散了，我連招牌上的成語都寫不出來。', '不過有兩個我還記得，教你吧！'],
    teaches: ['zhanzhanzixi', 'xishangmeishao'],
  },
  {
    id: 'guard', name: '衛兵', sprite: 'npc_guard', x: 11.5, z: 2.5,
    greet: ['前面就是郊區。亂字魔的手下在外面亂跑，很危險。', '出鎮之前，至少要喚醒五個字靈。我先教你兩個成語。'],
    teaches: ['xinjingdanzhan', 'nufachongguan'],
  },
  {
    id: 'granny', name: '老婆婆', sprite: 'npc_granny', x: 5.5, z: 13.5,
    greet: ['孩子，坐下來聽婆婆說。', '婆婆小時候，字靈常常在鎮上飛來飛去，好熱鬧。', '婆婆記得的成語，都教給你。'],
    teaches: ['xinhuiyileng', 'baiganjiaoji'],
  },
  {
    id: 'child', name: '小孩', sprite: 'npc_child', x: 22.5, z: 12.5,
    greet: ['哥哥姐姐，你就是字靈守護者嗎？好厲害！', '我也記得兩個成語喔，教你！'],
    teaches: ['mudengkoudai', 'youkounanyan'],
  },
  {
    id: 'chief', name: '鎮長', sprite: 'npc_chief', x: 15.5, z: 13.5,
    greet: ['守護者，你終於來了。我是墨香鎮的鎮長。', '只有喚醒全部字靈，才能打敗亂字魔。鎮上需要你的幫忙。'],
    quests: ['q_learn5', 'q_slime3', 'q_goblin', 'q_learnall', 'q_boss'],
  },
];

// 任務
export const QUESTS = {
  q_learn5: {
    title: '喚醒字靈', giver: 'chief',
    desc: '向鎮民學習 5 個成語，喚醒五個字靈，衛兵才會讓你出鎮。',
    goal: { type: 'learn', count: 5 }, reward: { exp: 15 },
  },
  q_slime3: {
    title: '清除史萊姆', giver: 'chief',
    desc: '亂字魔的墨水變成了史萊姆。到郊區打倒 3 隻。',
    goal: { type: 'defeat', target: 'slime', count: 3 }, reward: { exp: 25 },
  },
  q_goblin: {
    title: '哥布林的威脅', giver: 'chief',
    desc: '哥布林搶走了鎮上的書本，打倒郊區的哥布林。',
    goal: { type: 'defeat', target: 'goblin', count: 1 }, reward: { exp: 40 },
  },
  q_learnall: {
    title: '字靈齊聚', giver: 'chief',
    desc: '學會全部 10 個成語，喚醒所有字靈。',
    goal: { type: 'learn', count: 10 }, reward: { exp: 40 },
  },
  q_boss: {
    title: '討伐亂字魔', giver: 'chief',
    desc: '字靈已經齊聚！到郊區北端打倒亂字魔。',
    goal: { type: 'defeat', target: 'boss', count: 1 }, reward: { exp: 100 },
  },
};
