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

  // 技能卡（完成任務解鎖新技能時彈出）
  skillCard(skill) {
    const box = $('#card');
    setDepth(1);
    return new Promise(resolve => {
      box.innerHTML = `
        <div class="card-head">學會新技能！</div>
        <svg class="skill-book" viewBox="0 0 64 52" aria-hidden="true">
          <path d="M32 10 C24 4 12 4 4 7 V47 C12 44 24 44 32 50 C40 44 52 44 60 47 V7 C52 4 40 4 32 10Z" fill="#7a3b1e" stroke="#3b1a0a" stroke-width="2"/>
          <path d="M32 12 C25 7 14 7 8 9 V43 C15 41 25 41 32 46Z" fill="#fff4d6"/>
          <path d="M32 12 C39 7 50 7 56 9 V43 C49 41 39 41 32 46Z" fill="#fbe9bf"/>
          <path d="M32 12 V46" stroke="#c9a45c" stroke-width="1.5"/>
          <path d="M44 16 l2.5 5.5 6 .6 -4.5 4 1.3 5.9 -5.3 -3.1 -5.3 3.1 1.3 -5.9 -4.5 -4 6 -.6Z" fill="#f2b632"/>
        </svg>
        <div class="skill-name">${esc(skill.name)}</div>
        <div class="card-row skill-desc">${esc(skill.desc)}</div>
        <div class="skill-meta">字方塊題施放・用後冷卻 ${skill.cd - 1} 回合</div>
        <button class="btn primary">知道了！</button>`;
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

  // 字方塊題：8 個字（成語的 4 個字＋從其他成語抽的 4 個字），依次點選拼出成語
  tileQuiz(q, { title = '成語挑戰' } = {}) {
    const box = $('#quiz');
    setDepth(1);
    const word = [...q.idiom.word];
    const pool = [...new Set(IDIOMS.filter(i => i.id !== q.idiom.id).flatMap(i => [...i.word]))].filter(ch => !word.includes(ch));
    for (let i = pool.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [pool[i], pool[j]] = [pool[j], pool[i]]; }
    const tiles = [...word, ...pool.slice(0, 4)].map((ch, i) => ({ ch, i }));
    for (let i = tiles.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [tiles[i], tiles[j]] = [tiles[j], tiles[i]]; }
    const prompt = q.type === 'meaning'
      ? `用字方塊拼出意思是這樣的成語：\n「${q.idiom.meaning}」`
      : `用字方塊拼出最適合填在橫線上的成語：\n${q.sentence}`;
    return new Promise(resolve => {
      box.innerHTML = `<div class="quiz-title">${esc(title)}</div><div class="quiz-prompt">${esc(prompt)}</div>
        <div class="tile-slots">${word.map((_, i) => `<button class="tile-slot" data-i="${i}"></button>`).join('')}</div>
        <div class="tile-pool">${tiles.map((t, k) => `<button class="tile" data-k="${k}">${esc(t.ch)}</button>`).join('')}</div>
        <div class="tile-btns"><button class="btn" data-act="clear">清除</button><button class="btn primary" data-act="ok" disabled>確定</button></div>
        <div class="quiz-feedback" hidden></div>`;
      const slots = [...box.querySelectorAll('.tile-slot')];
      const tileEls = [...box.querySelectorAll('.tile')];
      const okBtn = box.querySelector('[data-act="ok"]');
      const filled = Array(word.length).fill(null); // 每格放了哪個方塊（k）
      let answered = false;
      const render = () => {
        slots.forEach((s, i) => { s.textContent = filled[i] == null ? '' : tiles[filled[i]].ch; s.classList.toggle('on', filled[i] != null); });
        tileEls.forEach((t, k) => t.classList.toggle('used', filled.includes(k)));
        okBtn.disabled = filled.includes(null);
      };
      const place = k => {
        if (answered || filled.includes(k)) return;
        const i = filled.indexOf(null);
        if (i < 0) return;
        filled[i] = k; sfx('click'); render();
      };
      const unplace = i => { if (answered || filled[i] == null) return; filled[i] = null; render(); };
      tileEls.forEach((t, k) => t.onclick = () => place(k));
      slots.forEach((s, i) => s.onclick = () => unplace(i));
      box.querySelector('[data-act="clear"]').onclick = () => { if (!answered) { filled.fill(null); render(); } };
      const submit = () => {
        if (answered || filled.includes(null)) return;
        answered = true;
        const ok = filled.map(k => tiles[k].ch).join('') === q.idiom.word;
        sfx(ok ? 'correct' : 'wrong');
        slots.forEach((s, i) => s.classList.add(tiles[filled[i]].ch === word[i] ? 'right' : 'wrong'));
        box.querySelector('.tile-btns').hidden = true;
        const fb = box.querySelector('.quiz-feedback');
        fb.hidden = false;
        fb.className = 'quiz-feedback ' + (ok ? 'ok' : 'ng');
        fb.innerHTML = `<div class="fb-head">${ok ? '答對了！' : '答錯了……'}</div>
          <div>正確答案：<b>${esc(q.idiom.word)}</b> —— ${esc(q.idiom.meaning)}</div>
          <button class="btn primary">繼續</button>`;
        const cont = () => { box.hidden = true; keyHandler = null; setDepth(-1); resolve(ok); };
        fb.querySelector('button').onclick = cont;
        keyHandler = e => { if (['Space', 'Enter', 'KeyZ'].includes(e.code)) { e.preventDefault(); e.stopPropagation(); cont(); } };
      };
      okBtn.onclick = submit;
      // 鍵盤：1–8 選方塊，Backspace 退回最後一格，Enter 確定
      keyHandler = e => {
        const n = parseInt(e.key, 10);
        if (n >= 1 && n <= tiles.length) place(n - 1);
        else if (e.code === 'Backspace') { const i = filled.map(v => v != null).lastIndexOf(true); if (i >= 0) unplace(i); }
        else if (e.code === 'Enter') submit();
        else return;
        e.preventDefault(); e.stopPropagation();
      };
      render();
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

  setObjective(text) {
    const el = $('#hud-next');
    if (el.dataset.text === text) return;
    el.dataset.text = text;
    el.innerHTML = `<span>下一步</span>${esc(text)}`;
    el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
  },

  setArea(name) { $('#hud-area').textContent = name; },

  // 通關成績頁：回傳 'continue' 或 'restart'
  showResults(r) {
    const box = $('#results');
    setDepth(1);
    return new Promise(resolve => {
      box.innerHTML = `
        <div class="res-inner">
          <div class="res-title">恭喜通關！</div>
          <div class="res-sub">你喚醒了全部十個字靈，墨香鎮恢復了平靜。</div>
          <div class="res-stats">
            <div><b>${esc(r.className)}</b><span>職業</span></div>
            <div><b>Lv.${r.level}</b><span>等級</span></div>
            <div><b>${r.correct}/${r.total}</b><span>答對題數</span></div>
            <div><b>${r.accuracy}%</b><span>正確率</span></div>
            <div><b>${r.kills}</b><span>打倒怪物</span></div>
          </div>
          <div class="res-head">學會的十個成語</div>
          <div class="res-idioms">${r.idioms.map(i => `<div class="res-idiom"><b>${esc(i.word)}</b><span>${esc(i.meaning)}</span></div>`).join('')}</div>
          <div class="res-btns">
            <button class="btn" data-act="cert">列印證書</button>
            <button class="btn primary" data-act="continue">繼續在鎮上溫習</button>
            <button class="btn" data-act="restart">重新開始</button>
          </div>
        </div>`;
      box.hidden = false;
      const done = act => { box.hidden = true; keyHandler = null; setDepth(-1); resolve(act); };
      box.querySelector('[data-act="continue"]').onclick = () => done('continue');
      box.querySelector('[data-act="restart"]').onclick = async () => {
        const i = await this.choose('確定要重新開始嗎？現有進度會清除。', ['確定重新開始', '取消']);
        if (i === 0) done('restart');
      };
      box.querySelector('[data-act="cert"]').onclick = () => this.certificate(r);
      keyHandler = null;
    });
  },

  // 可列印的「成語小達人」證書
  certificate(r) {
    const box = $('#certificate');
    const today = new Date();
    const date = `${today.getFullYear()} 年 ${today.getMonth() + 1} 月 ${today.getDate()} 日`;
    box.innerHTML = `
      <div class="cert-paper">
        <div class="cert-title">成語小達人證書</div>
        <div class="cert-body">
          茲證明　<input class="cert-name" placeholder="請輸入名字" maxlength="12">　同學<br>
          在《字靈傳說》中喚醒全部十個字靈，學會十個成語，<br>
          答題正確率 ${r.accuracy}%，特頒此證，以資鼓勵。
        </div>
        <div class="cert-idioms">${r.idioms.map(i => `<span>${esc(i.word)}</span>`).join('')}</div>
        <div class="cert-foot">墨香鎮鎮長　${date}</div>
      </div>
      <div class="cert-btns"><button class="btn primary" data-act="print">列印</button><button class="btn" data-act="close">關閉</button></div>`;
    box.hidden = false;
    box.querySelector('.cert-name').focus();
    box.querySelector('[data-act="print"]').onclick = () => {
      const inp = box.querySelector('.cert-name');
      inp.setAttribute('value', inp.value);
      window.print();
    };
    box.querySelector('[data-act="close"]').onclick = () => { box.hidden = true; };
  },

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
