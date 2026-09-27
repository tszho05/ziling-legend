import { IDIOMS, IDIOM_BY_ID } from './data/idioms.js';

const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };

// 題型：meaning（看解釋選成語）、example（例句填空）、example2（第二句例句填空，只在戰鬥出現）
export const QUIZ_TYPES = ['meaning', 'example'];
export const BATTLE_TYPES = ['meaning', 'example', 'example2'];

// 目標成語只從 learnedIds 抽（戰鬥只考已學過的）；干擾選項從全部十個抽
export function makeQuestion(learnedIds, { types = QUIZ_TYPES, targetId } = {}) {
  const pool = learnedIds.length ? learnedIds : IDIOMS.map(i => i.id);
  const target = IDIOM_BY_ID[targetId ?? pool[(Math.random() * pool.length) | 0]];
  const type = types[(Math.random() * types.length) | 0];
  const others = shuffle(IDIOMS.filter(i => i.id !== target.id)).slice(0, 3);
  const choices = shuffle([target, ...others]);
  const sentence = type === 'example2' ? target.example2 : target.example;
  const prompt = type === 'meaning'
    ? `哪一個成語的意思是：\n「${target.meaning}」`
    : `選出最適合填在橫線上的成語：\n${sentence}`;
  return { type, prompt, sentence, options: choices.map(c => c.word), answer: choices.indexOf(target), idiom: target };
}

// 戰鬥出題：把「已學成語 × 題型」洗成一疊牌逐張抽，
// 全部抽完才重洗，並盡量避免連續兩題考同一個成語，所以連續攻擊時題目會一直更換。
let deck = [], deckKey = '', lastCard = null;
export function nextQuestion(learnedIds) {
  const ids = learnedIds.length ? learnedIds : IDIOMS.map(i => i.id);
  const key = [...ids].sort().join(',');
  if (key !== deckKey || !deck.length) {
    deckKey = key;
    deck = shuffle(ids.flatMap(id => BATTLE_TYPES.map(type => ({ id, type }))));
  }
  // 盡量不要連續兩題考同一個成語
  let i = deck.length - 1;
  if (lastCard) { const j = deck.findLastIndex(c => c.id !== lastCard.id); if (j >= 0) i = j; }
  const [card] = deck.splice(i, 1);
  lastCard = card;
  return makeQuestion(ids, { targetId: card.id, types: [card.type] });
}
