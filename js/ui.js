import { IDIOMS } from './data/idioms.js';
import { QUESTS } from './data/npcs.js';
import { state, cls, stats, maxHp, questProgress } from './state.js';
import { expToNext } from './data/classes.js';
import { sfx } from './audio.js';

const $ = sel => document.querySelector(sel);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])).replace(/\n/g, '<br>');

let keyHandler = null;
window.addEventListener('keydown', e => { if (keyHandler) keyHandler(e); }, true);

// 模態層：同一時間只有一個；busy 期間大地圖不接受移動
let depth = 0;
const setDepth = d => { depth += d; document.body.classList.toggle('ui-open', depth > 0); };
export const ui = {
  get busy() { return depth > 0; },

  // 對話框：lines 可為字串陣列；逐句點擊前進
  say(name, lines) {
    lines = Array.isArray(lines) ? lines : [lines];
    const box = $('#dialog');
    setDepth(1);
    return new Promise(resolve => {
      let i = 0, typing = null, full = '';
      const text = box.querySelector('.dlg-text');
      box.querySelector('.dlg-name').textContent = name || '';
      box.querySelector('.dlg-name').hidden = !name;
      box.hidden = false;
      const show = () => {
        full = lines[i];
        let n = 0;
        text.textContent = '';
        clearInterval(typing);
        typing = setInterval(() => {
          n += 1;
          text.textContent = full.slice(0, n);
          if (n >= full.length) { clearInterval(typing); typing = null; }
        }, 28);
      };
      const next = () => {
        sfx('talk');
        if (typing) { clearInterval(typing); typing = null; text.textContent = full; return; }
        i++;
        if (i >= lines.length) { finish(); return; }
        show();
      };
      const finish = () => {
        box.hidden = true; box.onclick = null; keyHandler = null; setDepth(-1);
        resolve();
      };
      box.onclick = next;
      keyHandler = e => { if (['Space', 'Enter', 'KeyZ'].includes(e.code)) { e.preventDefault(); e.stopPropagation(); next(); } };
      show();
    });
  },

  // 選項（回傳 index；-1 表示取消）
  choose(title, options, { cancel = true } = {}) {
    const box = $('#choice');
    setDepth(1);
    return new Promise(resolve => {
      box.innerHTML = '';
      if (title) box.appendChild(el('div', 'choice-title', esc(title)));
      let sel = 0;
      const btns = options.map((o, i) => {
        const b = el('button', 'choice-btn', esc(o));
        b.onclick = () => done(i);
        b.onmouseenter = () => focus(i);
        box.appendChild(b);
        return b;
      });
      const focus = i => { sel = i; btns.forEach((b, j) => b.classList.toggle('sel', j === i)); };
      const done = i => { sfx('click'); box.hidden = true; keyHandler = null; setDepth(-1); resolve(i); };
      keyHandler = e => {
        const c = e.code;
        if (c === 'ArrowDown' || c === 'KeyS') focus((sel + 1) % btns.length);
        else if (c === 'ArrowUp' || c === 'KeyW') focus((sel + btns.length - 1) % btns.length);
        else if (['Space', 'Enter', 'KeyZ'].includes(c)) done(sel);
        else if (cancel && (c === 'Escape' || c === 'KeyX')) done(-1);
        else return;
        e.preventDefault(); e.stopPropagation();
      };
      focus(0);
      box.hidden = false;
    });
  },

  // 成語卡（學習時顯示）
  idiomCard(idiom, heading = '學會新成語！') {
    const box = $('#card');
    setDepth(1);
    return new Promise(resolve => {
      box.innerHTML = `
        <div class="card-head">${esc(heading)}</div>
        <div class="card-word">${[...idiom.word].map(c => `<span>${c}</span>`).join('')}</div>
        <div class="card-row"><b>解釋</b>${esc(idiom.meaning)}</div>
        <div class="card-row"><b>例句</b>${esc(idiom.example.replace('＿＿＿＿', `【${idiom.word}】`))}</div>
        <button class="btn primary">記住了！</button>`;
      box.hidden = false;
      const done = () => { box.hidden = true; keyHandler = null; setDepth(-1); resolve(); };
      box.querySelector('button').onclick = done;
      keyHandler = e => { if (['Space', 'Enter', 'KeyZ'].includes(e.code)) { e.preventDefault(); e.stopPropagation(); done(); } };
    });
  },

  // 成語題：回傳是否答對
  quiz(q, { title = '成語挑戰' } = {}) {
    const box = $('#quiz');
    setDepth(1);
    return new Promise(resolve => {
      box.innerHTML = `<div class="quiz-title">${esc(title)}</div><div class="quiz-prompt">${esc(q.prompt)}</div><div class="quiz-opts"></div><div class="quiz-feedback" hidden></div>`;
      const opts = box.querySelector('.quiz-opts');
      const fb = box.querySelector('.quiz-feedback');
      let answered = false;
      const btns = q.options.map((o, i) => {
        const b = el('button', 'quiz-opt' + (q.type === 'reverse' ? ' long' : ''), `<i>${i + 1}</i>${esc(o)}`);
        b.onclick = () => pick(i);
        opts.appendChild(b);
        return b;
      });
      const pick = i => {
        if (answered) return;
        answered = true;
        const ok = i === q.answer;
        sfx(ok ? 'correct' : 'wrong');
        btns[q.answer].classList.add('right');
        if (!ok) btns[i].classList.add('wrong');
        fb.hidden = false;
        fb.className = 'quiz-feedback ' + (ok ? 'ok' : 'ng');
        fb.innerHTML = `<div class="fb-head">${ok ? '答對了！' : '答錯了……'}</div>
          <div>正確答案：<b>${esc(q.idiom.word)}</b> —— ${esc(q.idiom.meaning)}</div>
          <button class="btn primary">繼續</button>`;
        const cont = () => { box.hidden = true; keyHandler = null; setDepth(-1); resolve(ok); };
        fb.querySelector('button').onclick = cont;
        keyHandler = e => { if (['Space', 'Enter', 'KeyZ'].includes(e.code)) { e.preventDefault(); e.stopPropagation(); cont(); } };
      };
      keyHandler = e => {
        const n = parseInt(e.key, 10);
        if (n >= 1 && n <= btns.length) { e.preventDefault(); e.stopPropagation(); pick(n - 1); }
      };
      box.hidden = false;
    });
  },

  toast(msg, ms = 2200) {
    const t = el('div', 'toast', esc(msg));
    $('#toasts').appendChild(t);
    setTimeout(() => t.classList.add('out'), ms);
    setTimeout(() => t.remove(), ms + 500);
  },

  async fade(fn) {
    const f = $('#fade');
    f.classList.add('on');
    await new Promise(r => setTimeout(r, 380));
    await fn();
    f.classList.remove('on');
    await new Promise(r => setTimeout(r, 380));
  },

  banner(text) {
    const b = $('#banner');
    b.textContent = text;
    b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
  },

  updateHud() {
    const c = cls();
    if (!c) return;
    const s = stats();
    $('#hud-class').textContent = `${c.name}  Lv.${state.level}`;
    $('#hud-hp-fill').style.width = `${(state.hp / maxHp()) * 100}%`;
    $('#hud-hp-text').textContent = `HP ${state.hp}/${s.hp}`;
    $('#hud-exp-fill').style.width = `${(state.exp / expToNext(state.level)) * 100}%`;
    $('#hud-idioms').textContent = `成語 ${state.learned.length}/${IDIOMS.length}`;
    const active = Object.entries(state.quests).filter(([, q]) => q.status === 'active');
    $('#hud-quest').innerHTML = active.length
      ? active.map(([id]) => `<div>◆ ${esc(QUESTS[id].title)}　${questProgress(id)}/${QUESTS[id].goal.count}</div>`).join('')
      : '';
  },

  setArea(name) { $('#hud-area').textContent = name; },

  openBook() {
    const box = $('#panel');
    setDepth(1);
    box.innerHTML = `<div class="panel-title">成語冊　${state.learned.length}/${IDIOMS.length}</div>
      <div class="book-grid">${IDIOMS.map(i => state.learned.includes(i.id)
        ? `<div class="book-item"><div class="bw">${esc(i.word)}</div><div class="bm">${esc(i.meaning)}</div></div>`
        : `<div class="book-item locked"><div class="bw">？？？？</div><div class="bm">向城裏的居民學習</div></div>`).join('')}</div>
      <div class="panel-foot">答對 ${state.quiz.correct} 題　答錯 ${state.quiz.wrong} 題</div>
      <button class="btn">關閉</button>`;
    return this._panel(box);
  },

  openQuests() {
    const box = $('#panel');
    setDepth(1);
    const rows = Object.entries(state.quests).map(([id, st]) => {
      const q = QUESTS[id];
      return `<div class="quest-item ${st.status}"><div class="qt">${st.status === 'done' ? '✔' : '◆'} ${esc(q.title)}</div>
        <div class="qd">${esc(q.desc)}</div><div class="qp">${st.status === 'done' ? '已完成' : `進度 ${questProgress(id)}/${q.goal.count}`}</div></div>`;
    }).join('') || '<div class="empty">還沒有任務。去找鎮長談談吧！</div>';
    box.innerHTML = `<div class="panel-title">任務</div>${rows}<button class="btn">關閉</button>`;
    return this._panel(box);
  },

  _panel(box) {
    return new Promise(resolve => {
      box.hidden = false;
      const done = () => { box.hidden = true; keyHandler = null; setDepth(-1); resolve(); };
      box.querySelector('button.btn:last-child').onclick = done;
      keyHandler = e => { if (['Escape', 'KeyX', 'KeyB', 'KeyQ', 'Enter', 'Space'].includes(e.code)) { e.preventDefault(); e.stopPropagation(); done(); } };
    });
  },
};
