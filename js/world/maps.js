import * as THREE from 'three';
import { tex } from './textures.js';
import { mat, std, makeHouse, makeTree, makeBush } from './props.js';
import { makeLamp, makeFountain, makeCrate, makeRock, makeGate, makeMerlons, makeFence, makeSignpost, makeStump, makeMushrooms, makePondDecor } from './decor.js';
import { addSky, addClouds, addHills, addTufts, animateWater, hash } from './scenery.js';

// 地圖以格子描述。ground：地面種類；solid：是否阻擋。
// 座標：x 向右、z 向下（朝鏡頭）；格子 (x, z) 的中心在 (x+0.5, z+0.5)。

function grid(w, d, v) { return Array.from({ length: d }, () => Array(w).fill(v)); }
const inRect = (x, z, r) => x >= r.x && x < r.x + r.w && z >= r.z && z < r.z + r.d;

// ---------------- 墨香鎮 ----------------
export function townLayout() {
  const W = 28, D = 22;
  const ground = grid(W, D, 'grass');
  const solid = grid(W, D, false);
  const objects = [];
  const road = { x: 12, z: 0, w: 4, d: D };
  const plaza = { x: 7, z: 8, w: 14, d: 8 };
  for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
    if (inRect(x, z, road) || inRect(x, z, plaza)) ground[z][x] = 'cobble';
    else if ((x * 7 + z * 13) % 11 === 0) ground[z][x] = 'flowers';
  }
  // 城牆（北面中央為城門）
  for (let x = 0; x < W; x++) {
    if (x < 12 || x > 15) { objects.push({ type: 'wall', x, z: 0 }); solid[0][x] = true; }
    objects.push({ type: 'wall', x, z: D - 1, low: true }); solid[D - 1][x] = true;
  }
  for (let z = 1; z < D - 1; z++) {
    objects.push({ type: 'wall', x: 0, z }, { type: 'wall', x: W - 1, z });
    solid[z][0] = solid[z][W - 1] = true;
  }
  objects.push({ type: 'gate', x: 12, z: 0, w: 4 });
  const houses = [
    { x: 2, z: 2, w: 5, d: 4, h: 2.6, roof: 'red', ridge: 'x', tint: 'cream', chimney: true },
    { x: 21, z: 2, w: 5, d: 4, h: 2.6, roof: 'blue', ridge: 'x', tint: 'rose', chimney: true },
    { x: 7, z: 3, w: 4, d: 3, h: 2.4, roof: 'green', ridge: 'z', tint: 'sky', sign: 0x3a8a4a },
    { x: 17, z: 3, w: 4, d: 3, h: 2.4, roof: 'red', ridge: 'z', tint: 'cream', sign: 0xc0392b },
    { x: 2, z: 16, w: 5, d: 3, h: 2.4, roof: 'blue', ridge: 'x', tint: 'cream' },
    { x: 21, z: 16, w: 5, d: 3, h: 2.4, roof: 'green', ridge: 'x', tint: 'rose', chimney: true },
  ];
  for (const h of houses) {
    objects.push({ type: 'house', ...h });
    for (let z = h.z; z < h.z + h.d; z++) for (let x = h.x; x < h.x + h.w; x++) solid[z][x] = true;
  }
  objects.push({ type: 'fountain', x: 13, z: 11, w: 2, d: 2 });
  for (let z = 11; z < 13; z++) for (let x = 13; x < 15; x++) solid[z][x] = true;
  for (const [x, z] of [[7, 8], [20, 8], [7, 15], [20, 15], [11, 1], [16, 1]]) {
    objects.push({ type: 'lamp', x, z }); solid[z][x] = true;
  }
  for (const [x, z] of [[1, 8], [2, 11], [1, 14], [26, 8], [25, 11], [26, 13], [9, 19], [18, 19], [4, 7], [23, 7]]) {
    objects.push({ type: 'tree', x, z }); solid[z][x] = true;
  }
  for (const [x, z] of [[11, 6], [16, 6], [6, 19], [22, 19]]) {
    objects.push({ type: 'crate', x, z }); solid[z][x] = true;
  }
  return {
    id: 'town', name: '墨香鎮', W, D, ground, solid, objects,
    spawn: { x: 14, z: 18.5 },
    exits: [{ rect: { x: 12, z: 0, w: 4, d: 1 }, to: 'field', spawn: { x: 15, z: 21.5 } }],
    sky: 0x6fb2ec, fog: 0xdce9ef,
  };
}

// ---------------- 郊區 ----------------
export function fieldLayout() {
  const W = 30, D = 24;
  const ground = grid(W, D, 'grass');
  const solid = grid(W, D, false);
  const objects = [];
  // 蜿蜒小路
  const pathX = z => Math.round(14 + Math.sin(z * 0.35) * 5);
  for (let z = 0; z < D; z++) {
    const px = z > D - 4 ? 14 : pathX(z);
    for (let x = px; x < px + 2; x++) ground[z][x] = 'dirt';
  }
  for (let z = D - 4; z < D; z++) for (let x = 14; x < 16; x++) ground[z][x] = 'dirt';
  for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
    if (ground[z][x] === 'grass' && (x * 5 + z * 3) % 13 === 0) ground[z][x] = 'flowers';
  }
  // 池塘
  const pond = { x: 3, z: 3, w: 4, d: 3 };
  for (let z = pond.z; z < pond.z + pond.d; z++) for (let x = pond.x; x < pond.x + pond.w; x++) { ground[z][x] = 'water'; solid[z][x] = true; }
  // 邊界樹林
  for (let x = 0; x < W; x++) {
    for (const z of [0, D - 1]) {
      if (z === D - 1 && (x === 14 || x === 15)) continue;
      // 南面（靠鏡頭）用矮樹叢，避免擋住角色
      objects.push({ type: z === D - 1 ? 'bush' : 'tree', x, z }); solid[z][x] = true;
    }
  }
  for (let z = 1; z < D - 1; z++) for (const x of [0, W - 1]) { objects.push({ type: 'tree', x, z }); solid[z][x] = true; }
  const trees = [[4, 12], [5, 19], [9, 3], [11, 12], [18, 13], [21, 20], [24, 15], [26, 7], [19, 3], [8, 21], [26, 20], [3, 16]];
  for (const [x, z] of trees) { if (ground[z][x] === 'dirt') continue; objects.push({ type: 'tree', x, z }); solid[z][x] = true; }
  const rocks = [[7, 7], [22, 12], [17, 8], [12, 18], [27, 17], [10, 15]];
  for (const [x, z] of rocks) { if (ground[z][x] === 'dirt') continue; objects.push({ type: 'rock', x, z }); solid[z][x] = true; }
  const free = (x, z) => !solid[z][x] && ground[z][x] !== 'dirt' && ground[z][x] !== 'water';
  // 入口兩旁的木柵欄
  for (const fx of [9, 16]) {
    objects.push({ type: 'fence', x: fx, z: 21, len: 4 });
    for (let x = fx; x < fx + 4; x++) solid[21][x] = true;
  }
  objects.push({ type: 'signpost', x: 13, z: 20, text: '往墨香鎮' }); solid[20][13] = true;
  for (const [x, z] of [[6, 14], [20, 6], [25, 18]]) if (free(x, z)) { objects.push({ type: 'stump', x, z }); solid[z][x] = true; }
  for (const [x, z] of [[5, 13], [12, 10], [23, 16], [27, 9], [8, 5]]) if (free(x, z)) objects.push({ type: 'mushrooms', x, z });
  objects.push({ type: 'pond', ...pond });
  return {
    id: 'field', name: '郊區', W, D, ground, solid, objects,
    spawn: { x: 15, z: 21.5 },
    exits: [{ rect: { x: 14, z: D - 1, w: 2, d: 1 }, to: 'town', spawn: { x: 14, z: 1.8 } }],
    sky: 0x6fb2ec, fog: 0xdcebdc,
  };
}

// ---------------- 建構 3D 場景 ----------------

export function buildMap(layout) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(layout.fog);
  scene.fog = new THREE.Fog(layout.fog, 30, 75);
  const center = new THREE.Vector3(layout.W / 2, 0, layout.D / 2);
  addSky(scene, { top: layout.sky, horizon: layout.fog });
  const updateClouds = addClouds(scene, center);
  addHills(scene, center, Math.max(layout.W, layout.D) * 0.75);
  const fadeables = [];
  const lights = [];
  const swayers = []; // 會隨風擺動的樹冠

  // 光源
  scene.add(new THREE.HemisphereLight(0xfff1dc, 0x6a5234, 1.25));
  const sun = new THREE.DirectionalLight(0xffdcaa, 2.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20, near: 1, far: 60 });
  sun.shadow.bias = -0.0008;
  sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);

  // 外圍地面
  const outer = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), std(tex.grass().clone()));
  outer.material.map.repeat.set(200, 200);
  outer.material.map.needsUpdate = true;
  outer.rotation.x = -Math.PI / 2;
  outer.position.set(layout.W / 2, -0.32, layout.D / 2);
  outer.receiveShadow = true;
  scene.add(outer);

  // 地磚（每種一個 InstancedMesh）
  const byType = {};
  for (let z = 0; z < layout.D; z++) for (let x = 0; x < layout.W; x++) (byType[layout.ground[z][x]] ||= []).push([x, z]);
  const tileGeo = new THREE.BoxGeometry(1, 0.3, 1);
  const dummy = new THREE.Object3D();
  for (const [type, cells] of Object.entries(byType)) {
    const m = type === 'water'
      ? std(tex.water(), { emissive: 0x1a4a80, emissiveIntensity: 0.25, roughness: 0.3 })
      : std(tex[type]());
    const inst = new THREE.InstancedMesh(tileGeo, m, cells.length);
    cells.forEach(([x, z], i) => {
      const y = type === 'water' ? -0.28 : type === 'cobble' ? -0.13 : -0.15 + ((x * 31 + z * 17) % 5) * 0.006;
      dummy.position.set(x + 0.5, y, z + 0.5);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    });
    inst.receiveShadow = true;
    scene.add(inst);
  }

  // 物件
  const walls = layout.objects.filter(o => o.type === 'wall');
  if (walls.length) {
    const wm = mat('wall', () => std(tex.stoneWall()));
    const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), wm, walls.length);
    walls.forEach((o, i) => {
      // 南面（靠鏡頭）的牆矮一點，避免擋住角色
      const h = o.z === layout.D - 1 ? 0.7 : 2.2;
      dummy.position.set(o.x + 0.5, h / 2, o.z + 0.5);
      dummy.scale.set(1, h, 1);
      dummy.updateMatrix(); inst.setMatrixAt(i, dummy.matrix);
    });
    dummy.scale.set(1, 1, 1);
    inst.castShadow = inst.receiveShadow = true;
    scene.add(inst);
    scene.add(makeMerlons(walls.filter(w => !w.low)));
  }
  for (const o of layout.objects) {
    let obj = null;
    if (o.type === 'house') obj = makeHouse(o);
    else if (o.type === 'tree') obj = makeTree(o);
    else if (o.type === 'lamp') { obj = makeLamp(o); lights.push(obj.userData.light); }
    else if (o.type === 'fountain') obj = makeFountain(o);
    else if (o.type === 'crate') obj = makeCrate(o);
    else if (o.type === 'rock') obj = makeRock(o);
    else if (o.type === 'bush') obj = makeBush(o);
    else if (o.type === 'gate') obj = makeGate(o);
    else if (o.type === 'fence') obj = makeFence(o);
    else if (o.type === 'signpost') obj = makeSignpost(o);
    else if (o.type === 'stump') obj = makeStump(o);
    else if (o.type === 'mushrooms') obj = makeMushrooms(o);
    else if (o.type === 'pond') obj = makePondDecor(o);
    if (obj) {
      scene.add(obj);
      if (obj.userData.fadeable) fadeables.push(obj);
      if (obj.userData.sway) swayers.push(obj.userData.sway);
    }
  }
  // 地圖外的背景樹
  for (let i = 0; i < 60; i++) {
    const a = i / 60 * Math.PI * 2;
    const r = Math.max(layout.W, layout.D) * 0.75 + (i % 3) * 2;
    const t = makeTree({ x: layout.W / 2 + Math.cos(a) * r, z: layout.D / 2 + Math.sin(a) * r * 0.8 - 2 });
    t.position.y = -0.32;
    if (t.position.z < layout.D + 1) { scene.add(t); swayers.push(t.userData.sway); }
  }

  // 草叢與小花：撒在空的草地上
  const grassSpots = [], flowerSpots = [];
  for (let z = 0; z < layout.D; z++) for (let x = 0; x < layout.W; x++) {
    const gnd = layout.ground[z][x];
    if (layout.solid[z][x] || (gnd !== 'grass' && gnd !== 'flowers')) continue;
    const k = hash(x, z);
    if (k < 0.3) grassSpots.push([x + 0.2 + hash(z, x) * 0.6, z + 0.2 + hash(x + 3, z) * 0.6]);
    else if (k < 0.38 || gnd === 'flowers') flowerSpots.push([x + 0.3 + hash(z, x + 1) * 0.4, z + 0.3 + hash(x, z + 2) * 0.4]);
  }
  // 地圖外的草地也撒一些
  for (let i = 0; i < 260; i++) {
    const x = -8 + hash(i, 11) * (layout.W + 16), z = -6 + hash(i, 12) * (layout.D + 14);
    if (x < -0.5 || x > layout.W + 0.5 || z < -0.5 || z > layout.D + 0.5) grassSpots.push([x, z, -0.32]);
  }
  addTufts(scene, grassSpots, 'grass');
  addTufts(scene, flowerSpots, 'flower');

  const animate = (dt, t) => { updateClouds(dt); animateWater(t); };
  return { scene, sun, fadeables, lights, swayers, animate, layout };
}

