import { IDIOMS, IDIOM_BY_ID } from './data/idioms.js';

const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };

// 題型：meaning（看解釋選成語）、example（例句填空）
export const QUIZ_TYPES = ['meaning', 'example'];

// 目標成語只從 learnedIds 抽（戰鬥只考已學過的）；干擾選項從全部十個抽
export function makeQuestion(learnedIds, { types = QUIZ_TYPES, targetId } = {}) {
  const pool = learnedIds.length ? learnedIds : IDIOMS.map(i => i.id);
  const target = IDIOM_BY_ID[targetId ?? pool[(Math.random() * pool.length) | 0]];
  const type = types[(Math.random() * types.length) | 0];
  const others = shuffle(IDIOMS.filter(i => i.id !== target.id)).slice(0, 3);
  const choices = shuffle([target, ...others]);
  const prompt = type === 'meaning'
    ? `哪一個成語的意思是：\n「${target.meaning}」`
    : `選出最適合填在橫線上的成語：\n${target.example}`;
  return { type, prompt, options: choices.map(c => c.word), answer: choices.indexOf(target), idiom: target };
}
