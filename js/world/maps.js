import * as THREE from 'three';
import { tex } from './textures.js';
import { kaykitHouse } from './models.js';
import { mat, std, makeHouse, makeTree, makeBush } from './props.js';
import { makeLamp, makeFountain, makeCrate, makeRock, makeGate, makeMerlons, makeFence, makeSignpost, makeStump, makeMushrooms, makePondDecor } from './decor.js';
import { makeBridge, makeLog, makeFallenTree, makeBarrier, makeCliffs, makeHill, makeTent, makeCampfire, makeAltar } from './fieldprops.js';
import { makeBlendedGround, pathEdgeSpots, makeWaterRect, tickWater, makeAmbience, makeSunbeams } from './fx.js';
import { makeRiverBanks, makeBridgeSplash } from './fieldprops.js';
import { makeBench, makeFlowerBed } from './decor.js';
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
  objects.push({ type: 'bench', x: 11, z: 11, rot: Math.PI / 2 }); solid[11][11] = true;
  objects.push({ type: 'bench', x: 16, z: 12, rot: -Math.PI / 2 }); solid[12][16] = true;
  objects.push({ type: 'flowerbed', x: 13, z: 10, w: 2 }); solid[10][13] = solid[10][14] = true;
  objects.push({ type: 'flowerbed', x: 13, z: 13, w: 2 }); solid[13][13] = solid[13][14] = true;
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
    exits: [{ rect: { x: 12, z: 0, w: 4, d: 1 }, to: 'field', spawn: { x: 21, z: 32.3 } }],
    sky: 0x6fb2ec, fog: 0xdce9ef,
  };
}

// ---------------- 郊區（半開放式，分四區逐步開通） ----------------
// gates：{ bridge, camp, altar } 各關卡是否已開通
export function fieldLayout(gates = {}) {
  const W = 42, D = 34;
  const ground = grid(W, D, 'grass');
  const solid = grid(W, D, false);
  const objects = [];
  const cliffs = [];
  const closedGates = [];
  const put = (o, cells = [[o.x, o.z]]) => { objects.push(o); for (const [x, z] of cells) solid[z][x] = true; };

  // 小路：主路（入口 → 木橋 → 森林 → 營地），支路往祭壇
  const isPath = grid(W, D, false);
  const paint = pts => {
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
      const n = Math.ceil(Math.hypot(bx - ax, bz - az) * 4);
      for (let k = 0; k <= n; k++) {
        const x = ax + (bx - ax) * k / n, z = az + (bz - az) * k / n;
        for (let tz = Math.floor(z - 0.9); tz <= Math.floor(z + 0.9); tz++) for (let tx = Math.floor(x - 0.9); tx <= Math.floor(x + 0.9); tx++) {
          if (tx < 0 || tz < 0 || tx >= W || tz >= D) continue;
          if (Math.hypot(tx + 0.5 - x, tz + 0.5 - z) < 0.95) isPath[tz][tx] = true;
        }
      }
    }
  };
  paint([[21, 33.8], [21, 27], [20.6, 24], [21, 21], [21, 19], [18, 16], [15.5, 13.5], [15, 11], [15, 9], [12.5, 6.5], [10, 5]]);
  paint([[15, 9], [19.5, 7], [25, 6], [30, 5.2], [33, 4.8]]);
  for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) if (isPath[z][x]) ground[z][x] = 'dirt';
  for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
    if (ground[z][x] === 'grass' && (x * 5 + z * 3) % 13 === 0) ground[z][x] = 'flowers';
  }

  // 邊界：北、東、西用樹，南面（靠鏡頭）用矮樹叢，入口留空
  for (let x = 0; x < W; x++) {
    put({ type: 'tree', x, z: 0 });
    if (x !== 20 && x !== 21) put({ type: 'bush', x, z: D - 1 });
  }
  for (let z = 1; z < D - 1; z++) for (const x of [0, W - 1]) put({ type: 'tree', x, z });

  // 小河（z 21–22）與木橋（x 20–21）
  for (let z = 21; z <= 22; z++) for (let x = 1; x < W - 1; x++) {
    ground[z][x] = 'water';
    if (x !== 20 && x !== 21) solid[z][x] = true;
  }
  objects.push({ type: 'bridge', x: 20, z: 21, w: 2, d: 2 });
  objects.push({ type: 'riverbanks', x0: 1, x1: W - 1, zTop: 21, zBot: 23, skip: [19.4, 22.6] });
  if (!gates.bridge) { put({ type: 'log', x: 20, z: 23, w: 2 }, [[20, 23], [21, 23]]); closedGates.push({ id: 'bridge', x: 21, z: 23.5 }); }

  // 森林與營地之間的岩壁（z 11），缺口 x 14–15
  for (let x = 1; x < W - 1; x++) if (x !== 14 && x !== 15) { cliffs.push({ x, z: 11 }); solid[11][x] = true; }
  if (!gates.camp) { put({ type: 'fallen', x: 14, z: 11, w: 2 }, [[14, 11], [15, 11]]); closedGates.push({ id: 'camp', x: 15, z: 11.5 }); }
  // 營地與祭壇之間的岩壁（x 25），缺口 z 5–6
  for (let z = 1; z < 11; z++) if (z !== 5 && z !== 6) { cliffs.push({ x: 25, z }); solid[z][25] = true; }
  if (!gates.altar) { put({ type: 'barrier', x: 25, z: 5, d: 2 }, [[25, 5], [25, 6]]); closedGates.push({ id: 'altar', x: 25.5, z: 6 }); }

  // 小山坡（裝飾，不能走上去）
  for (const h of [{ x: 4, z: 26, r: 2.4 }, { x: 37.5, z: 25.5, r: 2.2 }, { x: 5, z: 31, r: 1.5 }, { x: 4.5, z: 14, r: 2 }, { x: 38, z: 14, r: 2.2 }, { x: 3.5, z: 3, r: 1.6 }, { x: 38, z: 8.5, r: 1.8 }]) {
    objects.push({ type: 'hill', ...h });
    for (let z = Math.floor(h.z - h.r); z <= Math.floor(h.z + h.r); z++) for (let x = Math.floor(h.x - h.r); x <= Math.floor(h.x + h.r); x++) {
      if (x > 0 && z > 0 && x < W - 1 && z < D - 1 && Math.hypot(x + 0.5 - h.x, z + 0.5 - h.z) < h.r - 0.35) solid[z][x] = true;
    }
  }

  // 哥布林營地：帳篷、營火、木箱；祭壇：石台與斷柱
  for (const [x, z] of [[5, 2], [10, 2], [19, 3]]) put({ type: 'tent', x, z });
  put({ type: 'campfire', x: 11, z: 4 });
  for (const [x, z] of [[7, 8], [21, 9]]) put({ type: 'crate', x, z });
  const pillars = [[30, 2], [36, 2], [30, 7], [36, 7]];
  objects.push({ type: 'altar', cx: 33.5, cz: 4.5, pillars: pillars.map(([x, z]) => [x + 0.5, z + 0.5]) });
  for (const [x, z] of pillars) solid[z][x] = true;

  // 池塘
  const pond = { x: 25, z: 29, w: 4, d: 2 };
  for (let z = pond.z; z < pond.z + pond.d; z++) for (let x = pond.x; x < pond.x + pond.w; x++) { ground[z][x] = 'water'; solid[z][x] = true; }
  objects.push({ type: 'pond', ...pond });

  // 入口的柵欄與路牌
  put({ type: 'fence', x: 15, z: 31, len: 4 }, [[15, 31], [16, 31], [17, 31], [18, 31]]);
  put({ type: 'fence', x: 23, z: 31, len: 4 }, [[23, 31], [24, 31], [25, 31], [26, 31]]);
  put({ type: 'signpost', x: 19, z: 32, text: '往墨香鎮' });
  put({ type: 'signpost', x: 17, z: 10, text: '營地　祭壇→' });

  // 樹木與小物：森林區較密，其餘稀疏；避開小路、怪物出沒點和已佔用的格子
  const homes = [[9, 28], [30, 27], [14, 25], [34, 30], [9, 16], [31, 15], [24, 18], [36, 19], [7, 5], [17, 7], [20, 3], [33, 4]];
  const nearHome = (x, z) => homes.some(([hx, hz]) => Math.hypot(hx - x, hz - z) < 2.6);
  const nearPath = (x, z) => { for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (isPath[z + dz]?.[x + dx]) return true; return false; };
  for (let z = 1; z < D - 1; z++) for (let x = 1; x < W - 1; x++) {
    if (solid[z][x] || (ground[z][x] !== 'grass' && ground[z][x] !== 'flowers')) continue;
    if (nearPath(x, z) || nearHome(x, z) || (x >= 26 && z <= 10)) continue;
    const k = Math.abs(((x * 73856093) ^ (z * 19349663)) % 1000) / 1000;
    const density = z >= 12 && z <= 20 ? 0.2 : 0.045;
    if (k < density) put({ type: 'tree', x, z });
    else if (k < density + 0.012) put({ type: 'rock', x, z });
    else if (k < density + 0.02) put({ type: 'stump', x, z });
    else if (k < density + 0.035) objects.push({ type: 'mushrooms', x, z });
  }

  return {
    id: 'field', name: '郊區', W, D, ground, solid, objects, cliffs, closedGates,
    spawn: { x: 21, z: 32.3 },
    exits: [{ rect: { x: 20, z: D - 1, w: 2, d: 1 }, to: 'town', spawn: { x: 14, z: 1.8 } }],
    sky: 0x6fb2ec, fog: 0xdcebdc,
    blendGround: true,
    waterRects: [{ x: 1, z: 21, w: W - 2, d: 2, flow: [0.35, 0] }, { x: pond.x, z: pond.z, w: pond.w, d: pond.d, flow: [0.04, 0.02] }],
    sunbeams: [[8, 15], [12, 18.5], [27, 14], [33, 17], [18.5, 13.2], [37, 16.5], [5, 19]],
    ambience: true,
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
  const tickers = []; // 有動畫的佈景（營火、結界等）
  if (layout.cliffs?.length) scene.add(makeCliffs(layout.cliffs));

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
  const outerY = layout.blendGround ? -0.01 : -0.32;
  outer.position.set(layout.W / 2, outerY, layout.D / 2);
  outer.receiveShadow = true;
  scene.add(outer);

  // 地磚（每種一個 InstancedMesh）
  const byType = {};
  for (let z = 0; z < layout.D; z++) for (let x = 0; x < layout.W; x++) (byType[layout.ground[z][x]] ||= []).push([x, z]);
  const tileGeo = new THREE.BoxGeometry(1, 0.3, 1);
  const dummy = new THREE.Object3D();
  if (layout.blendGround) {
    scene.add(makeBlendedGround(layout));
    for (const w of layout.waterRects || []) scene.add(makeWaterRect(w.x, w.z, w.w, w.d, { flow: w.flow }));
  }
  for (const [type, cells] of Object.entries(layout.blendGround ? {} : byType)) {
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
  let houseIdx = 0;
  for (const o of layout.objects) {
    let obj = null;
    if (o.type === 'house') obj = kaykitHouse(o, houseIdx++) || makeHouse(o);
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
    else if (o.type === 'bridge') obj = makeBridge(o);
    else if (o.type === 'log') obj = makeLog(o);
    else if (o.type === 'fallen') obj = makeFallenTree(o);
    else if (o.type === 'barrier') obj = makeBarrier(o);
    else if (o.type === 'hill') obj = makeHill(o);
    else if (o.type === 'tent') obj = makeTent(o);
    else if (o.type === 'campfire') obj = makeCampfire(o);
    else if (o.type === 'altar') obj = makeAltar(o);
    else if (o.type === 'riverbanks') obj = makeRiverBanks(o);
    else if (o.type === 'bench') obj = makeBench(o);
    else if (o.type === 'flowerbed') obj = makeFlowerBed(o);
    if (obj) {
      scene.add(obj);
      if (obj.userData.fadeable) fadeables.push(obj);
      if (obj.userData.sway) swayers.push(obj.userData.sway);
      if (obj.userData.tick) tickers.push(obj.userData.tick);
    }
  }
  // 地圖外的背景樹
  for (let i = 0; i < 60; i++) {
    const a = i / 60 * Math.PI * 2;
    const r = Math.max(layout.W, layout.D) * 0.75 + (i % 3) * 2;
    const t = makeTree({ x: layout.W / 2 + Math.cos(a) * r, z: layout.D / 2 + Math.sin(a) * r * 0.8 - 2 });
    t.position.y = outerY;
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
    if (x < -0.5 || x > layout.W + 0.5 || z < -0.5 || z > layout.D + 0.5) grassSpots.push([x, z, outerY]);
  }
  if (layout.blendGround) grassSpots.push(...pathEdgeSpots(layout));
  addTufts(scene, grassSpots, 'grass');
  if (layout.id === 'field') {
    const sp = makeBridgeSplash(20, 21, 2, 2);
    scene.add(sp.group); tickers.push(sp.tick);
  }
  if (layout.sunbeams) { const sb = makeSunbeams(layout.sunbeams); scene.add(sb.group); tickers.push(sb.tick); }
  if (layout.ambience) { const am = makeAmbience(); scene.add(am.group); tickers.push(am.tick); }
  addTufts(scene, flowerSpots, 'flower');

  const animate = (dt, t, focus) => { updateClouds(dt); animateWater(t); tickWater(t); for (const f of tickers) f(t, dt, focus); };
  return { scene, sun, fadeables, lights, swayers, animate, layout };
}

