import * as THREE from 'three';
import { IDIOMS } from './data/idioms.js';
import { QUESTS } from './data/npcs.js';
import { state, cls, save, gainExp, clearSave } from './state.js';
import { ui } from './ui.js';
import { sfx, music } from './audio.js';
import { input } from './input.js';
import { makeSpirit } from './spirits.js';

// 通關結局：自動回城 → 字靈飛回墨香鎮的過場 → 鎮長致謝 → 成績頁

const sleep = ms => new Promise(r => setTimeout(r, ms));
function tween(ms, fn) {
  return new Promise(resolve => {
    const t0 = performance.now();
    const step = now => {
      const t = Math.min(1, (now - t0) / ms);
      fn(t);
      t < 1 ? requestAnimationFrame(step) : resolve();
    };
    requestAnimationFrame(step);
  });
}
const ease = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

export function spiritTexture(word) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 96;
  const g = c.getContext('2d');
  // 金色光暈 + 深色描邊的金字，在明亮的廣場上也看得清楚
  const grad = g.createRadialGradient(128, 48, 4, 128, 48, 118);
  grad.addColorStop(0, 'rgba(255,214,110,0.75)');
  grad.addColorStop(0.6, 'rgba(255,190,70,0.3)');
  grad.addColorStop(1, 'rgba(255,190,70,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 256, 96);
  g.font = 'bold 56px "Noto Serif TC", "PMingLiU", serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 8; g.strokeStyle = '#5a2e00'; g.lineJoin = 'round';
  g.strokeText(word, 128, 50);
  g.shadowColor = '#ffcc40'; g.shadowBlur = 14;
  g.fillStyle = '#fff4c8';
  g.fillText(word, 128, 50);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export async function playEnding(world) {
  // 完成頭目任務、記錄通關
  const st = state.quests.q_boss;
  if (st && st.status !== 'done') { st.status = 'done'; gainExp(QUESTS.q_boss.reward.exp); }
  state.cleared = true;
  save();

  world.cutscene = true;
  world.transitioning = true;
  document.body.classList.add('cutscene');
  await ui.fade(() => {
    world.enter('town');
    world.player.pivot.position.set(14, 0, 16.6);
    world.facing = 'up';
    world.player.setRow(3);
    world.player.setFrame(3, 0);
    for (const n of world.npcs) n.mark.visible = false;
  });
  world.transitioning = true;
  const eng = world.engine;
  const fountain = new THREE.Vector3(14, 0, 12);

  // 鏡頭：由城門慢慢推向噴水池
  world.camOverride = new THREE.Vector3(14, 1.5, 4);
  const d0 = eng.distance;
  const camFrom = world.camOverride.clone(), camTo = new THREE.Vector3(14, 1.2, 12.8);
  const camMove = tween(4200, t => {
    world.camOverride.lerpVectors(camFrom, camTo, ease(t));
    eng.distance = d0 + (13 - d0) * ease(t);
  });

  // 鎮民走到噴水池四周
  const SPOTS = {
    scholar: [10.9, 11.8], merchant: [17.1, 11.8], guard: [11.3, 13.9],
    granny: [16.7, 13.9], child: [12.6, 15.0], chief: [15.4, 15.0],
  };
  const ring = world.npcs.map(n => {
    const [x, z] = SPOTS[n.def.id] || [n.def.x, n.def.z];
    return { n, from: n.sprite.pivot.position.clone(), to: new THREE.Vector3(x, 0, z) };
  });
  const gather = tween(3000, t => { for (const r of ring) r.n.sprite.pivot.position.lerpVectors(r.from, r.to, ease(t)); });

  // 十個字靈從天上旋轉飛回
  const scene = world.world.scene;
  const spirits = IDIOMS.map((idiom, i) => {
    const s = makeSpirit(idiom.word);
    s.userData = { a0: i / IDIOMS.length * Math.PI * 2, start: new THREE.Vector3(fountain.x + Math.cos(i * 1.3) * 12, 14 + i * 0.6, fountain.z - 10 + Math.sin(i) * 4) };
    s.position.copy(s.userData.start);
    scene.add(s);
    return s;
  });
  const glow = new THREE.PointLight(0xffd070, 0, 14, 1.5);
  glow.position.set(fountain.x, 3, fountain.z);
  scene.add(glow);

  await sleep(900);
  let chime = 0;
  await tween(4200, t => {
    spirits.forEach((s, i) => {
      const k = Math.min(1, Math.max(0, t * 1.6 - i * 0.06));
      const e = ease(k);
      const a = s.userData.a0 + e * Math.PI * 2;
      const target = new THREE.Vector3(fountain.x + Math.cos(a) * 3.6, 2.4 + (i % 2) * 0.9, fountain.z + Math.sin(a) * 2.2);
      s.position.lerpVectors(s.userData.start, target, e);
    });
    glow.intensity = t * 6;
    if (t * 10 > chime) { chime++; sfx('learn'); }
  });
  await Promise.all([camMove, gather]);

  // 字靈環繞噴水池，鎮民歡呼跳躍
  sfx('victory');
  await tween(3200, t => {
    spirits.forEach((s, i) => {
      const a = s.userData.a0 + Math.PI * 2 + t * Math.PI * 1.5;
      s.position.set(fountain.x + Math.cos(a) * 3.6, 2.4 + (i % 2) * 0.9 + Math.sin(a * 2 + t * 6) * 0.2, fountain.z + Math.sin(a) * 2.2);
    });
    for (const [i, r] of ring.entries()) r.n.sprite.pivot.position.y = Math.abs(Math.sin(t * Math.PI * 6 + i)) * 0.35;
  });
  // 字靈升空化成光點
  sfx('levelup');
  await tween(1600, t => {
    spirits.forEach(s => {
      s.position.y += 0.08;
      s.material.opacity = 1 - t;
      s.scale.setScalar(1 + t);
    });
    glow.intensity = 6 * (1 - t) + 2;
    for (const r of ring) r.n.sprite.pivot.position.y = 0;
  });
  spirits.forEach(s => { scene.remove(s); s.material.dispose(); });

  await ui.say('鎮長', [
    '你做到了！十個字靈全部回到墨香鎮了！',
    '書本上的成語又重新閃閃發光，大家都記得了。',
    `謝謝你，年輕的字靈守護者——${cls().name}！`,
  ]);
  input.clearPressed();
  const choice = await ui.showResults(resultData());
  if (choice === 'restart') {
    clearSave();
    location.reload();
    return;
  }
  // 繼續在鎮上溫習
  document.body.classList.remove('cutscene');
  world.camOverride = null;
  await ui.fade(() => { eng.distance = 19; world.enter('town'); world.player.pivot.position.set(14, 0, 16.6); });
  world.cutscene = false;
  world.transitioning = false;
  music.play('town');
  input.clearPressed();
}

function resultData() {
  const total = state.quiz.correct + state.quiz.wrong;
  return {
    className: cls().name,
    level: state.level,
    correct: state.quiz.correct,
    total,
    accuracy: total ? Math.round(state.quiz.correct / total * 100) : 100,
    kills: Object.values(state.kills).reduce((a, b) => a + b, 0),
    idioms: IDIOMS,
  };
}
