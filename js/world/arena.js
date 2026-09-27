import * as THREE from 'three';
import { makeTree, makeBush, leafBlob, mat, std, at, box, TM } from './props.js';
import { makeRock, makeStump, makeMushrooms, makeFence, makeCrate } from './decor.js';
import { makeTent, makeCampfire, makeLog } from './fieldprops.js';
import { addSky, addClouds, addHills, addTufts, hash } from './scenery.js';
import { makeSunbeams } from './fx.js';
import { tex } from './textures.js';

// 戰鬥場景：按郊區分區各有一款
//   1 草原（晴天小路）  2 森林（密林、光柱、落葉）
//   3 哥布林營地（黃昏、帳篷、營火）  4 亂字魔祭壇（紫天、石柱、魔法陣、墨霧）
// 有 assets/backgrounds/battle_<區>.png（Codex 手繪遠景）時，會放在場景後面取代遠山。
// 主角站在右邊 x≈3，敵人在左邊 x≈-2.5；鏡頭看向 (0, 1.5, 0.6)。

export const ZONE_KEYS = { 1: 'meadow', 2: 'forest', 3: 'camp', 4: 'altar' };

const THEMES = {
  meadow: { sky: 0x6fb2ec, fog: 0xdcebdc, near: 22, far: 60, hemi: [0xfff1dc, 0x6a5234, 1.25], sun: [0xffdcaa, 2.5, [-6, 14, 8]], grade: { vignette: 0.7, warmth: 0.035 }, ground: 'grass' },
  forest: { sky: 0x6f9f78, fog: 0x8fb08a, near: 10, far: 36, hemi: [0xe8f5d8, 0x3a4a24, 1.0], sun: [0xfff0c0, 2.2, [-9, 12, 3]], grade: { vignette: 1.0, warmth: 0.02 }, ground: 'grass', tint: 0xb8d0a0 },
  camp: { sky: 0x7a88c0, fog: 0xd8c0a8, horizon: 0xf0c098, near: 16, far: 50, hemi: [0xffd8b0, 0x5a3a24, 0.9], sun: [0xffa860, 2.4, [-12, 7, 6]], grade: { vignette: 0.95, warmth: 0.05 }, ground: 'dirt' },
  altar: { sky: 0x1e1236, fog: 0x5a3a7a, horizon: 0x9a5ab8, near: 12, far: 42, hemi: [0xd8c4ff, 0x3a2850, 1.05], sun: [0xd0b0ff, 1.6, [-5, 12, 6]], grade: { vignette: 1.25, warmth: -0.02 }, ground: 'stone' },
};

// Codex 遠景圖：載入一次後快取；沒有圖時回傳 null
const bgCache = {};
export function loadBackdrop(key) {
  if (!(key in bgCache)) {
    bgCache[key] = new Promise(resolve => {
      new THREE.TextureLoader().load(`assets/backgrounds/battle_${key}.png`, t => {
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 4;
        resolve(t);
      }, undefined, () => resolve(null));
    });
  }
  return bgCache[key];
}

// 18° 俯角下，畫面最上方只比水平線低約 2°，所以遠景放在不太遠的 z=-13，
// 佔畫面上方約三分之一；地面在 z=-13 截止，免得擋住遠景。
export const BACKDROP_Z = -13;
function addBackdrop(scene, t, fogColor) {
  const w = 34, h = w * t.image.height / t.image.width;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, fog: false, depthWrite: false }));
  m.position.set(0, h / 2 - 0.4, BACKDROP_Z);
  m.renderOrder = -5;
  scene.add(m);
  // 接縫處的霧帶，令遠景和地面融合
  const c = document.createElement('canvas'); c.width = 4; c.height = 64;
  const g = c.getContext('2d');
  const col = new THREE.Color(fogColor);
  const rgba = a => `rgba(${Math.round(col.r * 255)},${Math.round(col.g * 255)},${Math.round(col.b * 255)},${a})`;
  const grad = g.createLinearGradient(0, 0, 0, 64);
  grad.addColorStop(0, rgba(0)); grad.addColorStop(0.6, rgba(0.85)); grad.addColorStop(1, rgba(0));
  g.fillStyle = grad; g.fillRect(0, 0, 4, 64);
  const band = new THREE.Mesh(new THREE.PlaneGeometry(w, 2.2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, fog: false, depthWrite: false }));
  band.position.set(0, 0.5, BACKDROP_Z + 0.3);
  band.renderOrder = -4;
  scene.add(band);
}

function soft(size, inner, outer) {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, inner); grad.addColorStop(1, outer);
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

// 飄動的粒子（落葉、火星、墨霧、光點）；回傳 tick
function particles(scene, { n, color, size, area, speed, rise = 0, additive = false, map }) {
  const geo = new THREE.BufferGeometry();
  const p = new Float32Array(n * 3), seed = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    p[i * 3] = (Math.random() - 0.5) * area[0];
    p[i * 3 + 1] = Math.random() * area[1];
    p[i * 3 + 2] = (Math.random() - 0.5) * area[2] - 1;
    seed[i] = Math.random() * 100;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
  const m = new THREE.PointsMaterial({ color, size, map, transparent: true, depthWrite: false, opacity: 0.85, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
  scene.add(new THREE.Points(geo, m));
  return (dt, t) => {
    for (let i = 0; i < n; i++) {
      const s = seed[i];
      p[i * 3] += (speed[0] + Math.sin(t * 0.8 + s) * 0.3) * dt;
      p[i * 3 + 1] += (rise - speed[1] * (0.6 + (s % 1) * 0.6)) * dt;
      p[i * 3 + 2] += Math.cos(t * 0.6 + s) * 0.15 * dt;
      if (p[i * 3 + 1] < 0) p[i * 3 + 1] = area[1];
      if (p[i * 3 + 1] > area[1]) p[i * 3 + 1] = 0;
      if (p[i * 3] > area[0] / 2) p[i * 3] -= area[0];
      if (p[i * 3] < -area[0] / 2) p[i * 3] += area[0];
    }
    geo.attributes.position.needsUpdate = true;
  };
}

export async function buildArena(zone = 1) {
  const key = ZONE_KEYS[zone] || 'meadow';
  const th = THEMES[key];
  const backdrop = await Promise.race([loadBackdrop(key), new Promise(r => setTimeout(() => r(null), 2500))]);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(th.fog);
  scene.fog = new THREE.Fog(th.fog, th.near, th.far);
  const center = new THREE.Vector3(0, 0, 0);
  addSky(scene, { top: th.sky, horizon: th.horizon || th.fog });
  const ticks = [];
  if (key === 'meadow' || key === 'camp') { const u = addClouds(scene, center, key === 'camp' ? 5 : 7); ticks.push(dt => u(dt)); }
  if (backdrop) addBackdrop(scene, backdrop, th.fog);
  else if (key !== 'altar') addHills(scene, center, 24);

  scene.add(new THREE.HemisphereLight(...th.hemi));
  const sun = new THREE.DirectionalLight(th.sun[0], th.sun[1]);
  sun.position.set(...th.sun[2]);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14 });
  sun.shadow.bias = -0.0008;
  scene.add(sun);

  // 地面
  const groundTex = key === 'altar' ? tex.stoneBase() : key === 'camp' ? tex.dirt() : tex.grass();
  const gt = groundTex.clone();
  gt.repeat.set(key === 'altar' ? 22 : 80, key === 'altar' ? 22 : 80);
  gt.needsUpdate = true;
  const groundColor = key === 'altar' ? 0x9888b0 : key === 'camp' ? 0xc8b090 : (th.tint || 0xffffff);
  // 有遠景圖時地面只鋪到遠景前面
  const depth = backdrop ? -BACKDROP_Z : 40;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 40 + depth), new THREE.MeshStandardMaterial({ map: gt, color: groundColor, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.z = (40 - depth) / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  if (key !== 'altar') {
    const dt = tex.dirt().clone();
    dt.repeat.set(16, 3);
    dt.needsUpdate = true;
    const path = new THREE.Mesh(new THREE.PlaneGeometry(16, 3), new THREE.MeshStandardMaterial({ map: dt, color: key === 'forest' ? 0xb0a080 : 0xffffff, roughness: 1 }));
    path.rotation.x = -Math.PI / 2;
    path.position.set(0, 0.01, 0.4);
    path.receiveShadow = true;
    scene.add(path);
  }

  const swayers = [];
  const tree = o => { const t = makeTree(o); scene.add(t); swayers.push(t.userData.sway); return t; };
  const spots = [];
  const tuftSpots = (count, seed) => {
    for (let i = 0; i < count; i++) {
      const x = -16 + hash(i, seed) * 32, z = -8 + hash(i, seed + 1) * 16;
      if (Math.abs(z - 0.4) > 1.8) spots.push([x, z]);
    }
  };

  if (key === 'meadow') {
    for (let i = 0; i < 16; i++) tree({ x: -14 + i * 1.8 + (i % 3) * 0.4, z: -5.5 - (i % 4) * 0.9 });
    if (!backdrop) for (let i = 0; i < 9; i++) tree({ x: -16 + i * 4, z: -11 - (i % 2) * 2 });
    for (const [x, z] of [[-7, -3.2], [-1.5, -3.6], [5.5, -3.1], [9, -2.6]]) scene.add(makeBush({ x, z }));
    for (const [x, z] of [[-9, -1.6], [8, -1.2]]) scene.add(makeRock({ x, z }));
    scene.add(makeStump({ x: 2.2, z: -3 }));
    scene.add(makeMushrooms({ x: -4.4, z: -2.6 }));
    scene.add(makeFence({ x: -12, z: -2.5, len: 4 }));
    tuftSpots(220, 21);
    addTufts(scene, spots, 'grass');
    addTufts(scene, spots.filter((_, i) => i % 5 === 0).map(([x, z]) => [x + 0.4, z + 0.3]), 'flower');
    ticks.push(particles(scene, { n: 40, color: 0xffe8f0, size: 0.1, area: [26, 5, 12], speed: [0.5, 0.25] }));
  }

  if (key === 'forest') {
    // 三排密林，越遠越暗；兩邊加近景大樹框住畫面
    for (let row = 0; row < (backdrop ? 2 : 3); row++) {
      for (let i = 0; i < 18; i++) tree({ x: -17 + i * 2 + hash(i, row) * 1.2, z: -4.2 - row * 2.2 - hash(i, row + 5) * 1.2, kind: hash(i, row + 9) < 0.5 ? 'pine' : 'round' });
    }
    for (const [x, z] of [[-8.5, -1.5], [8.8, -1.2], [-10.5, 2.5], [10.5, 2.8]]) tree({ x, z, kind: 'round' });
    for (const [x, z] of [[-6, -2.8], [-2.5, -3.2], [4.5, -2.9], [7, -2.2], [0.8, -3.6]]) scene.add(makeBush({ x, z }));
    const log = makeLog({ x: 4.2, z: -3.6, w: 2 }); scene.add(log);
    scene.add(makeMushrooms({ x: -3.8, z: -2.4 }));
    scene.add(makeMushrooms({ x: 6.2, z: -1.9 }));
    scene.add(makeStump({ x: -5.2, z: -2 }));
    scene.add(makeRock({ x: -7.5, z: -0.8 }));
    tuftSpots(260, 31);
    addTufts(scene, spots, 'grass');
    const beams = makeSunbeams([[-4.5, -2.5], [-1, -3.5], [2.5, -2.2], [6, -3]]);
    scene.add(beams.group);
    ticks.push((dt, t) => beams.tick(t));
    ticks.push(particles(scene, { n: 45, color: 0x9ac850, size: 0.14, area: [26, 6, 12], speed: [0.35, 0.3], map: soft(64, 'rgba(255,255,255,1)', 'rgba(255,255,255,0)') }));
    ticks.push(particles(scene, { n: 30, color: 0xfff0a0, size: 0.12, area: [22, 3, 10], speed: [0.05, 0], rise: 0.05, additive: true, map: soft(64, 'rgba(255,255,255,1)', 'rgba(255,255,255,0)') }));
  }

  if (key === 'camp') {
    for (const [x, z] of [[-7.5, -4.2], [-2.6, -5.2], [3, -4.6], [7.8, -3.8]]) scene.add(makeTent({ x: x - 0.5, z: z - 0.5 }));
    const fires = [makeCampfire({ x: -0.5 - 0.5, z: -2.8 - 0.5 }), makeCampfire({ x: 9.5, z: -1.5 })];
    for (const f of fires) { scene.add(f); ticks.push((dt, t) => f.userData.tick(t)); }
    // 木柵欄圍住營地後方
    for (let i = 0; i < 7; i++) scene.add(makeFence({ x: -15 + i * 4.3, z: -7.2, len: 4 }));
    for (const [x, z] of [[-5, -2.6], [5.2, -2.4], [5.8, -3.1]]) scene.add(makeCrate({ x, z }));
    for (const [x, z] of [[-9, -1.4], [8.2, -1.8], [-11, -3.5]]) scene.add(makeRock({ x, z }));
    // 插在地上的長矛和旗幟
    const pole = mat('ar-pole', () => new THREE.MeshStandardMaterial({ color: 0x5a3a20, roughness: 1 }));
    const flag = mat('ar-flag', () => new THREE.MeshStandardMaterial({ color: 0x7a2a1a, side: THREE.DoubleSide, roughness: 1 }));
    for (const [x, z] of [[-4.2, -4], [1.2, -4.4], [6.4, -4.8]]) {
      scene.add(at(box(0.08, 2.6, 0.08, pole), x, 1.3, z));
      scene.add(at(box(0.6, 0.4, 0.02, flag), x + 0.32, 2.3, z));
    }
    for (let i = 0; i < 6; i++) tree({ x: -16 + i * 6.2, z: -10 - (i % 2) * 1.5, kind: 'pine' });
    tuftSpots(90, 41);
    addTufts(scene, spots, 'grass');
    ticks.push(particles(scene, { n: 40, color: 0xffa040, size: 0.09, area: [8, 4, 3], speed: [0.1, 0], rise: 0.7, additive: true, map: soft(64, 'rgba(255,255,255,1)', 'rgba(255,255,255,0)') }));
  }

  if (key === 'altar') {
    const stone = mat('ar-stone', () => std(tex.stoneWall(), { color: 0xa89cc0 }));
    const dark = mat('ar-dark', () => std(tex.stoneBase(), { color: 0x6a5f80 }));
    const flameM = new THREE.MeshStandardMaterial({ color: 0xc890ff, emissive: 0x9a4dff, emissiveIntensity: 2.6, transparent: true, opacity: 0.9 });
    const flames = [];
    // 後方一排斷柱，頂上燃着紫火
    [[-9, -4.5, 3.4], [-4.8, -5.4, 2.6], [-0.6, -6, 3.8], [3.8, -5.3, 2.9], [8.4, -4.4, 3.2], [-12, -2, 2.2], [11.5, -1.8, 2.4]].forEach(([x, z, h], i) => {
      scene.add(at(box(1, 0.35, 1, dark), x, 0.18, z));
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, h, 10), stone);
      col.castShadow = true;
      scene.add(at(col, x, 0.35 + h / 2, z));
      const top = leafBlob(0.36, i * 5 + 1, stone);
      top.scale.y = 0.5; top.rotation.set(0.3, i, 0.2);
      scene.add(at(top, x, 0.4 + h, z));
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.6, 8), flameM);
      scene.add(at(f, x, 0.9 + h, z));
      const light = new THREE.PointLight(0xa060ff, 4, 7, 1.6);
      light.position.set(x, 1 + h, z);
      scene.add(light);
      flames.push({ f, light, ph: i * 1.3 });
    });
    ticks.push((dt, t) => flames.forEach(({ f, light, ph }) => {
      const k = 1 + Math.sin(t * 9 + ph) * 0.12;
      f.scale.set(1, k, 1);
      light.intensity = 3.6 + Math.sin(t * 7 + ph) * 0.8;
    }));
    // 頭目腳下的發光魔法陣
    const runeM = new THREE.MeshBasicMaterial({ color: 0xb080ff, transparent: true, opacity: 0.6, depthWrite: false });
    const circle = new THREE.Group();
    for (const [r1, r2, seg] of [[2.2, 2.35, 48], [1.6, 1.68, 6], [1.0, 1.06, 48]]) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(r1, r2, seg), runeM);
      ring.rotation.x = -Math.PI / 2;
      circle.add(ring);
    }
    circle.position.set(-2.8, 0.03, 0.2);
    scene.add(circle);
    ticks.push((dt, t) => { circle.rotation.y = t * 0.25; runeM.opacity = 0.45 + Math.sin(t * 2) * 0.15; });
    // 碎石和地上的裂縫石板
    for (const [x, z] of [[-6.5, -2.2], [5.6, -2.6], [7.5, 1.8], [-8.5, 1.5]]) scene.add(makeRock({ x, z }));
    // 墨霧和飄浮的紫色光點
    ticks.push(particles(scene, { n: 26, color: 0x3a1858, size: 2.6, area: [30, 1.4, 14], speed: [0.25, 0], map: soft(64, 'rgba(255,255,255,0.8)', 'rgba(255,255,255,0)') }));
    ticks.push(particles(scene, { n: 50, color: 0xd0a0ff, size: 0.12, area: [24, 5, 12], speed: [0.05, 0], rise: 0.25, additive: true, map: soft(64, 'rgba(255,255,255,1)', 'rgba(255,255,255,0)') }));
  }

  // 前景：畫面下方的草叢和石頭（會被景深模糊，增加層次）
  if (key !== 'altar') {
    for (const [x, z] of [[-8.2, 4.4], [-5.4, 4.9], [-1.2, 5.1], [6.2, 4.6], [9, 4.2]]) {
      const b = makeBush({ x, z });
      b.scale.multiplyScalar(1.3);
      scene.add(b);
    }
  } else {
    for (const [x, z] of [[-6.5, 4.6], [0.2, 5.1], [7, 4.4]]) { const r = makeRock({ x, z }); r.scale.multiplyScalar(1.4); scene.add(r); }
  }

  scene.userData.animate = (dt, t) => {
    for (const f of ticks) f(dt, t);
    for (const sw of swayers) {
      sw.canopy.rotation.z = Math.sin(t * 1.2 + sw.phase) * 0.03;
      sw.canopy.rotation.x = Math.cos(t * 0.9 + sw.phase) * 0.02;
    }
  };
  scene.userData.grade = th.grade;
  return scene;
}
