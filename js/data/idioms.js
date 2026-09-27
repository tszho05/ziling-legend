// 十個成語。解釋與例句為初稿，需老師審閱。
// example 內用「＿＿＿＿」標示成語位置，供填充題使用。
export const IDIOMS = [
  {
    id: 'xinjingdanzhan', word: '心驚膽戰',
    meaning: '形容非常害怕、驚慌。',
    example: '夜裏走過漆黑的樹林，小明聽到怪聲，嚇得＿＿＿＿。',
  },
  {
    id: 'zhanzhanzixi', word: '沾沾自喜',
    meaning: '自以為很好而得意洋洋的樣子。',
    example: '他只是考了一次第一名，就＿＿＿＿，不再用功溫習。',
  },
  {
    id: 'nufachongguan', word: '怒髮衝冠',
    meaning: '憤怒到了極點，好像頭髮都豎起來把帽子頂起。',
    example: '看見有人欺負弱小，衛兵隊長氣得＿＿＿＿。',
  },
  {
    id: 'xishangmeishao', word: '喜上眉梢',
    meaning: '高興的心情從眉眼間流露出來，形容非常高興。',
    example: '聽到明天去旅行的消息，妹妹＿＿＿＿，笑個不停。',
  },
  {
    id: 'xinbuzaiyan', word: '心不在焉',
    meaning: '心思不在這裏，形容注意力不集中。',
    example: '上課時他＿＿＿＿，老師叫他的名字也沒聽見。',
  },
  {
    id: 'yichoumozhan', word: '一籌莫展',
    meaning: '一點辦法也想不出來。',
    example: '鑰匙掉進了深井裏，大家＿＿＿＿，不知道怎麼辦。',
  },
  {
    id: 'mudengkoudai', word: '目瞪口呆',
    meaning: '瞪着眼睛說不出話，形容吃驚得發愣的樣子。',
    example: '魔術師把帽子變成了一隻白鴿，觀眾看得＿＿＿＿。',
  },
  {
    id: 'xinhuiyileng', word: '心灰意冷',
    meaning: '形容非常失望，失去了信心。',
    example: '小明練習了很久還是輸了比賽，他感到＿＿＿＿。',
  },
  {
    id: 'youkounanyan', word: '有口難言',
    meaning: '有話卻難以說出來，或有苦說不出。',
    example: '花瓶不是他打破的，可是沒有人相信，他真是＿＿＿＿。',
  },
  {
    id: 'baiganjiaoji', word: '百感交集',
    meaning: '各種感受交織在一起，心情十分複雜。',
    example: '畢業典禮上，同學們想起六年的校園生活，都感到＿＿＿＿。',
  },
];

export const IDIOM_BY_ID = Object.fromEntries(IDIOMS.map(i => [i.id, i]));
