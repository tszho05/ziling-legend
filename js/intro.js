import * as THREE from 'three';
import { IDIOMS } from './data/idioms.js';
import { Billboard } from './world/sprites.js';
import { spiritTexture } from './ending.js';
import { cls } from './state.js';
import { sfx, music } from './audio.js';
import { input } from './input.js';

// 開場過場動畫（遊戲引擎即時演出，約 25 秒，可略過）
//   1 高空飛過墨香鎮，十個字靈在廣場上空發光
//   2 天色轉暗，亂字魔帶着墨水漩渦出現在鎮門
//   3 字靈被捲走、四散，畫面震動
//   4 光線回復，鏡頭落到主角身上，標題「喚醒字靈，打倒亂字魔」

const $ = s => document.querySelector(s);
const ease = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

export async function playIntro(world) {
  let skipped = false;
  const wait = ms => new Promise(r => { const t0 = performance.now(); const tick = () => (skipped || performance.now() - t0 >= ms) ? r() : setTimeout(tick, 30); tick(); });
  const tween = (ms, fn) => new Promise(resolve => {
    const t0 = performance.now();
    const step = () => {
      const t = skipped ? 1 : Math.min(1, (performance.now() - t0) / ms);
      fn(t);
      t < 1 ? requestAnimationFrame(step) : resolve();
    };
    requestAnimationFrame(step);
  });

  // 介面：黑邊、字幕、略過鍵
  document.body.classList.add('cutscene', 'intro');
  const cap = document.createElement('div');
  cap.id = 'intro-caption';
  document.body.appendChild(cap);
  const skipBtn = document.createElement('button');
  skipBtn.id = 'intro-skip';
  skipBtn.className = 'btn small';
  skipBtn.textContent = '略過 ▶▶';
  document.body.appendChild(skipBtn);
  const skip = () => { if (!skipped) { skipped = true; sfx('click'); } };
  skipBtn.onclick = skip;
  const onKey = e => { if (['Escape', 'Enter'].includes(e.code)) { e.preventDefault(); skip(); } };
  window.addEventListener('keydown', onKey, true);
  const say = async (html, ms) => {
    if (skipped) return;
    cap.innerHTML = html;
    cap.classList.remove('show'); void cap.offsetWidth; cap.classList.add('show');
    await wait(ms);
    cap.classList.remove('show');
    await wait(500);
  };

  world.cutscene = true;
  world.transitioning = true;
  const eng = world.engine;
  const scene = world.world.scene;
  const fountain = new THREE.Vector3(14, 0, 12);
  const gate = new THREE.Vector3(14, 0, 2.2);
  world.player.pivot.visible = false;
  for (const n of world.npcs) n.mark.visible = false;

  // 光線（天色轉暗用）
  const lights = [];
  scene.traverse(o => { if (o.isHemisphereLight || o.isDirectionalLight) lights.push({ o, base: o.intensity }); });
  const bg0 = scene.background.clone(), fog0 = scene.fog.color.clone();
  const dusk = new THREE.Color(0x3a2448);
  const setDark = k => {
    for (const l of lights) l.o.intensity = l.base * (1 - 0.65 * k);
    scene.background.copy(bg0).lerp(dusk, k);
    scene.fog.color.copy(fog0).lerp(dusk, k);
  };

  // 十個字靈
  const spirits = IDIOMS.map((idiom, i) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: spiritTexture(idiom.word), transparent: true, depthWrite: false, depthTest: false }));
    s.scale.set(2.1, 0.79, 1);
    s.renderOrder = 20;
    s.userData = { a: i / IDIOMS.length * Math.PI * 2, y: 3 + (i % 2) * 0.9 };
    scene.add(s);
    return s;
  });
  const glow = new THREE.PointLight(0xffd070, 6, 16, 1.5);
  glow.position.set(fountain.x, 3.5, fountain.z);
  scene.add(glow);
  let orbit = 0, orbitR = 3.6;
  const placeSpirits = (t, spread = 0) => spirits.forEach((s, i) => {
    const a = s.userData.a + t * 0.6;
    const r = orbitR + spread * (6 + (i % 3) * 2);
    s.position.set(fountain.x + Math.cos(a) * r, s.userData.y + Math.sin(t * 2 + i) * 0.2 + spread * (i % 2 ? 4 : -1.5), fountain.z + Math.sin(a) * r * 0.62);
  });

  music.play('town');
  try {
    // 1 高空飛過小鎮
    world.camOverride = new THREE.Vector3(14, 6, -6);
    eng.distance = 34;
    const cam1a = new THREE.Vector3(14, 6, -6), cam1b = new THREE.Vector3(14, 2, 10);
    const s1 = tween(7000, t => {
      orbit += 0.016;
      placeSpirits(orbit);
      world.camOverride.lerpVectors(cam1a, cam1b, ease(t));
      eng.distance = 34 - 16 * ease(t);
    });
    await wait(600);
    await say('很久以前，墨香鎮的每一個成語，<br>都住着一位守護小鎮的<b>字靈</b>。', 3200);
    await say('字靈的光芒，令鎮上每一本書都閃閃發亮。', 2400);
    await s1;

    // 2 天色轉暗，亂字魔出現在鎮門
    sfx('lose');
    const boss = new Billboard('monster_boss', { fps: 4 });
    boss.pivot.position.copy(gate);
    boss.pivot.scale.setScalar(0.01);
    boss.mesh.material.color.set(0xd8a0ff);
    scene.add(boss.pivot);
    const inkTex = (() => {
      const c = document.createElement('canvas'); c.width = c.height = 32;
      const g = c.getContext('2d');
      const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
      gr.addColorStop(0, 'rgba(24,8,36,0.95)'); gr.addColorStop(1, 'rgba(24,8,36,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
      return new THREE.CanvasTexture(c);
    })();
    const ink = [];
    for (let i = 0; i < 40; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: inkTex, transparent: true, depthWrite: false }));
      s.scale.setScalar(0.5 + (i % 5) * 0.15);
      s.userData = { a: i / 40 * Math.PI * 2, r: 1.2 + (i % 6) * 0.35, y: 0.3 + (i % 8) * 0.45, sp: 1 + (i % 4) * 0.35 };
      scene.add(s);
      ink.push(s);
    }
    const inkTick = (t, grow) => ink.forEach(s => {
      const u = s.userData, a = u.a + t * u.sp;
      s.position.set(gate.x + Math.cos(a) * u.r * grow, u.y * grow, gate.z + Math.sin(a) * u.r * 0.6 * grow);
    });
    const cam2 = new THREE.Vector3(14, 2.2, 6.5);
    const from2 = world.camOverride.clone();
    let tt = 0;
    const s2 = tween(4200, t => {
      tt += 0.016; orbit += 0.016;
      setDark(ease(t));
      world.camOverride.lerpVectors(from2, cam2, ease(t));
      eng.distance = 18 - 3 * ease(t);
      boss.pivot.scale.setScalar(0.01 + 2.2 * ease(t));
      inkTick(tt, ease(t));
      placeSpirits(orbit);
      boss.update(0.016);
    });
    await say('有一天，<b class="bad">亂字魔</b>帶着墨水漩渦來到小鎮……', 3400);
    await s2;

    // 3 字靈被捲走、四散
    sfx('fire');
    const shakeBase = world.camOverride.clone();
    const s3 = tween(3000, t => {
      tt += 0.016;
      inkTick(tt * 1.8, 1 + t * 0.5);
      const k = ease(t);
      spirits.forEach((s, i) => {
        const a = s.userData.a + tt * 3;
        const pull = Math.min(1, t * 2);
        const toGate = new THREE.Vector3(gate.x + Math.cos(a) * 1.5, 2 + (i % 3), gate.z + Math.sin(a));
        const out = new THREE.Vector3(fountain.x + Math.cos(s.userData.a) * 30, 12 + (i % 4) * 3, fountain.z + Math.sin(s.userData.a) * 20 - 10);
        s.position.copy(t < 0.5 ? s.position.clone().lerp(toGate, pull * 0.2) : toGate.lerp(out, (k - 0.5) * 2));
        s.material.opacity = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
      });
      const shake = (1 - t) * 0.35;
      world.camOverride.set(shakeBase.x + (Math.random() - 0.5) * shake, shakeBase.y + (Math.random() - 0.5) * shake, shakeBase.z);
      glow.intensity = 6 * (1 - k);
      boss.update(0.016);
    });
    await say('字靈被打散了，鎮上的人漸漸忘記了成語。', 2800);
    await s3;
    // 亂字魔消失在墨水裏
    await tween(1200, t => {
      boss.pivot.scale.setScalar(2.21 * (1 - ease(t)) + 0.01);
      ink.forEach(s => { s.material.opacity = 1 - t; });
    });
    scene.remove(boss.pivot);
    ink.forEach(s => scene.remove(s));

    // 4 光線回復，鏡頭落到主角身上
    world.player.pivot.visible = true;
    world.player.pivot.position.set(14, 0, 18.5);
    world.facing = 'up';
    const heroGlow = new THREE.PointLight(0xffe0a0, 0, 5, 1.5);
    heroGlow.position.set(14, 1.5, 19);
    scene.add(heroGlow);
    const from4 = world.camOverride.clone(), cam4 = new THREE.Vector3(14, 1.1, 18.5);
    const s4 = tween(3600, t => {
      const k = ease(t);
      setDark(1 - k);
      world.camOverride.lerpVectors(from4, cam4, k);
      eng.distance = 15 - 6 * k;
      heroGlow.intensity = 5 * Math.sin(t * Math.PI);
    });
    await say(`字靈守護者的後人——見習${cls().name}的你，今天要踏上旅程。`, 3200);
    await s4;
    if (!skipped) {
      sfx('levelup');
      cap.innerHTML = '<div class="intro-title">喚醒字靈，打倒亂字魔</div><div class="intro-sub">向鎮民學回成語，戰鬥時答對題目就能借用字靈之力！</div>';
      cap.classList.remove('show'); void cap.offsetWidth; cap.classList.add('show', 'big');
      await wait(3600);
      cap.classList.remove('show');
      await wait(500);
    }
    scene.remove(heroGlow);
  } finally {
    // 收尾（略過時也會執行）
    spirits.forEach(s => { scene.remove(s); s.material.map.dispose(); s.material.dispose(); });
    scene.remove(glow);
    setDark(0);
    window.removeEventListener('keydown', onKey, true);
    cap.remove();
    skipBtn.remove();
    world.camOverride = null;
    eng.distance = 19;
    world.player.pivot.visible = true;
    world.player.pivot.position.set(world.layout.spawn.x, 0, world.layout.spawn.z);
    document.body.classList.remove('cutscene', 'intro');
    world.cutscene = false;
    world.transitioning = false;
    world.refreshMarkers();
    eng.lookAt(world.cameraTarget(), true);
    input.clearPressed();
  }
}

// 畫面角落的操作提示（顯示幾秒後淡出）
export function showControlsHint() {
  const touch = document.body.classList.contains('touch');
  const el = document.createElement('div');
  el.id = 'controls-hint';
  el.innerHTML = touch
    ? '<b>操作</b>左下搖桿移動　A 鍵對話／確認<br>右上可開關音樂'
    : '<b>操作</b>方向鍵／WASD 移動　空白鍵 對話<br>B 成語冊　Q 任務　M 音樂';
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => el.classList.remove('show'), 8000);
  setTimeout(() => el.remove(), 9000);
}
