import { Engine } from './world/engine.js';
import { preloadAssets, isPlaceholder } from './world/sprites.js';
import { preloadModels } from './world/models.js';
import { ASSETS } from './data/assets.js';
import { CLASSES } from './data/classes.js';
import { Overworld } from './overworld.js';
import { Battle } from './battle.js';
import { state, newGame, load, hasSave, save } from './state.js';
import { input, setupTouch } from './input.js';
import { ui } from './ui.js';
import { toggleMute, isMuted, music } from './audio.js';
import { playIntro, showControlsHint } from './intro.js';

const $ = s => document.querySelector(s);

const engine = new Engine($('#game'));
let mode = null; // 'overworld' | 'battle'
const battle = new Battle(engine);
const world = new Overworld(engine, {
  async onBattle(party) {
    let result;
    await ui.fade(async () => { mode = 'battle'; });
    result = await battle.run(party);
    await ui.fade(async () => { engine.setScene(world.world.scene); engine.lookAt(world.cameraTarget(), true); mode = 'overworld'; });
    return result;
  },
});

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (mode === 'overworld') world.update(dt);
  else if (mode === 'battle') battle.update(dt);
  engine.render();
  requestAnimationFrame(loop);
}

async function boot() {
  setupTouch(document.body);
  const bar = $('#loading-bar');
  await Promise.all([
    preloadAssets(undefined, (n, total) => { if (bar) bar.style.width = (n / total * 100) + '%'; }),
    preloadModels(),
  ]);
  const missing = Object.keys(ASSETS).filter(isPlaceholder).length;
  $('#placeholder-note').textContent = missing
    ? `美術：${missing}/${Object.keys(ASSETS).length} 個素材仍為佔位圖（紅點標記）`
    : '';
  $('#loading').hidden = true;
  $('#title').hidden = false;
  music.play('town');
  $('#btn-continue').hidden = !hasSave();
  $('#btn-new').onclick = showClassSelect;
  $('#btn-continue').onclick = () => { if (load()) startGame(false); };
  requestAnimationFrame(loop);
}

function showClassSelect() {
  $('#title').hidden = true;
  const box = $('#class-select');
  box.hidden = false;
  const list = box.querySelector('.class-list');
  list.innerHTML = '';
  for (const c of Object.values(CLASSES)) {
    const card = document.createElement('button');
    card.className = 'class-card';
    card.style.setProperty('--c', c.color);
    card.innerHTML = `<div class="cc-name">${c.name}</div><div class="cc-desc">${c.desc}</div>
      <div class="cc-stats">HP ${c.base.hp}　攻擊 ${c.base.atk}　防禦 ${c.base.def}　速度 ${c.base.spd}</div>
      <div class="cc-skills">${c.skills.map(s => `<span title="${s.desc}">${s.name}${s.unlock === 'q_slime3' ? '（清除史萊姆後）' : s.unlock === 'q_goblin' ? '（哥布林的威脅後）' : '（起始）'}</span>`).join('')}</div>`;
    card.onclick = () => { box.hidden = true; newGame(c.id); startGame(true); };
    list.appendChild(card);
  }
}

async function startGame(fresh) {
  $('#title').hidden = true;
  $('#hud').hidden = false;
  await ui.fade(() => { world.enter(state.map === 'field' ? 'field' : 'town'); mode = 'overworld'; });
  if (fresh) await playIntro(world);
  ui.banner(world.layout.name);
  showControlsHint();
  input.clearPressed();
  save();
}

const muteBtn = $('#btn-mute');
const syncMute = () => { muteBtn.textContent = isMuted() ? '♪ 關' : '♪ 開'; };
muteBtn.onclick = () => { toggleMute(); syncMute(); };
window.addEventListener('keydown', e => { if (e.code === 'KeyM' && e.target.tagName !== 'INPUT') { toggleMute(); syncMute(); } });
syncMute();

$('#hud-book').onclick = () => { if (!ui.busy) ui.openBook(); };
$('#hud-quests').onclick = () => { if (!ui.busy) ui.openQuests(); };

// 除錯用：在主控台可用 __game 查看狀態
window.__game = { world, battle, state, ui, input };

boot();
