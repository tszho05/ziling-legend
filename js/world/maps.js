import * as THREE from 'three';
import { tex } from './textures.js';

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
    objects.push({ type: 'wall', x, z: D - 1 }); solid[D - 1][x] = true;
  }
  for (let z = 1; z < D - 1; z++) {
    objects.push({ type: 'wall', x: 0, z }, { type: 'wall', x: W - 1, z });
    solid[z][0] = solid[z][W - 1] = true;
  }
  objects.push({ type: 'gate', x: 12, z: 0, w: 4 });
  const houses = [
    { x: 2, z: 2, w: 5, d: 4, h: 2.6, roof: 'red' },
    { x: 21, z: 2, w: 5, d: 4, h: 2.6, roof: 'blue' },
    { x: 7, z: 3, w: 4, d: 3, h: 2.2, roof: 'green' },
    { x: 17, z: 3, w: 4, d: 3, h: 2.2, roof: 'red' },
    { x: 2, z: 16, w: 5, d: 3, h: 2.4, roof: 'blue' },
    { x: 21, z: 16, w: 5, d: 3, h: 2.4, roof: 'green' },
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
  for (const [x, z] of [[8, 6], [19, 6], [6, 19], [22, 19]]) {
    objects.push({ type: 'crate', x, z }); solid[z][x] = true;
  }
  return {
    id: 'town', name: '墨香鎮', W, D, ground, solid, objects,
    spawn: { x: 14, z: 18.5 },
    exits: [{ rect: { x: 12, z: 0, w: 4, d: 1 }, to: 'field', spawn: { x: 15, z: 21.5 } }],
    sky: 0x9fc9ee, fog: 0xc9dff0,
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
  return {
    id: 'field', name: '郊區', W, D, ground, solid, objects,
    spawn: { x: 15, z: 21.5 },
    exits: [{ rect: { x: 14, z: D - 1, w: 2, d: 1 }, to: 'town', spawn: { x: 14, z: 1.8 } }],
    sky: 0xa8d4f0, fog: 0xcfe6d8,
  };
}

// ---------------- 建構 3D 場景 ----------------
const matCache = new Map();
function mat(key, make) { if (!matCache.has(key)) matCache.set(key, make()); return matCache.get(key); }
const std = (map, extra = {}) => new THREE.MeshStandardMaterial({ map, roughness: 0.95, metalness: 0, ...extra });

export function buildMap(layout) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(layout.sky);
  scene.fog = new THREE.Fog(layout.fog, 28, 60);
  const fadeables = [];
  const lights = [];

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
    if (obj) {
      scene.add(obj);
      if (obj.userData.fadeable) fadeables.push(obj);
    }
  }
  // 地圖外的背景樹
  for (let i = 0; i < 60; i++) {
    const a = i / 60 * Math.PI * 2;
    const r = Math.max(layout.W, layout.D) * 0.75 + (i % 3) * 2;
    const t = makeTree({ x: layout.W / 2 + Math.cos(a) * r, z: layout.D / 2 + Math.sin(a) * r * 0.8 - 2 });
    if (t.position.z < layout.D + 1) scene.add(t);
  }

  return { scene, sun, fadeables, lights, layout };
}

function shadowAll(g) { g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return g; }

function makeHouse(o) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(o.w - 0.1, o.h, o.d - 0.1), mat('plaster', () => std(tex.plaster())));
  body.position.set(o.w / 2, o.h / 2, o.d / 2);
  g.add(body);
  const roofH = 1.6;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.7071, 1, 4, 1), mat('roof' + o.roof, () => std(tex.roof(o.roof), { flatShading: true })));
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(o.w + 0.5, roofH, o.d + 0.5);
  roof.position.set(o.w / 2, o.h + roofH / 2, o.d / 2);
  g.add(roof);
  const door = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.5), mat('door', () => std(tex.wood())));
  door.position.set(o.w / 2, 0.75, o.d - 0.04);
  g.add(door);
  const winMat = mat('window', () => new THREE.MeshStandardMaterial({ color: 0xffd98a, emissive: 0xffb84a, emissiveIntensity: 1.6 }));
  for (const wx of [0.9, o.w - 0.9]) {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.6), winMat);
    win.position.set(wx, o.h * 0.6, o.d - 0.04);
    g.add(win);
  }
  g.position.set(o.x, 0, o.z);
  shadowAll(g);
  g.userData.fadeable = true;
  g.userData.rect = { x: o.x, z: o.z, w: o.w, d: o.d, h: o.h + roofH };
  return g;
}

export function makeTree(o) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 1.1, 6), mat('trunk', () => std(tex.wood())));
  trunk.position.y = 0.55;
  g.add(trunk);
  const lm = mat('leaves', () => std(tex.leaves(), { flatShading: true }));
  const s = 0.9 + (((o.x * 13 + o.z * 7) | 0) % 5) * 0.08;
  const f1 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.8 * s, 0), lm);
  f1.position.y = 1.5 * s;
  const f2 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55 * s, 0), lm);
  f2.position.set(0.1, 2.1 * s, 0.05);
  g.add(f1, f2);
  g.position.set(o.x + 0.5, 0, o.z + 0.5);
  g.rotation.y = (o.x * 1.7 + o.z) % 6;
  shadowAll(g);
  g.userData.fadeable = true;
  g.userData.rect = { x: o.x, z: o.z, w: 1, d: 1, h: 2.6 };
  return g;
}

function makeLamp(o) {
  const g = new THREE.Group();
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2, 6), mat('iron', () => new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.6 })));
  post.position.y = 1;
  const lantern = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.34, 0.28), mat('lantern', () => new THREE.MeshStandardMaterial({ color: 0xffe0a0, emissive: 0xffb040, emissiveIntensity: 2.2 })));
  lantern.position.y = 2.1;
  const light = new THREE.PointLight(0xffb45a, 6, 6, 1.6);
  light.position.y = 2.1;
  g.add(post, lantern, light);
  g.position.set(o.x + 0.5, 0, o.z + 0.5);
  post.castShadow = true;
  g.userData.light = light;
  return g;
}

function makeFountain(o) {
  const g = new THREE.Group();
  const stone = mat('rockm', () => std(tex.rock()));
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.1, 0.5, 16), stone);
  base.position.y = 0.25;
  const water = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.05, 16), new THREE.MeshStandardMaterial({ map: tex.water(), emissive: 0x3a8ad0, emissiveIntensity: 0.6, roughness: 0.2 }));
  water.position.y = 0.45;
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 1.2, 8), stone);
  col.position.y = 0.9;
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.3, 0.15, 12), stone);
  top.position.y = 1.5;
  g.add(base, water, col, top);
  g.position.set(o.x + o.w / 2, 0, o.z + o.d / 2);
  shadowAll(g);
  return g;
}

function makeCrate(o) {
  const c = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), mat('crate', () => std(tex.wood())));
  c.position.set(o.x + 0.5, 0.4, o.z + 0.5);
  c.rotation.y = 0.2;
  c.castShadow = c.receiveShadow = true;
  return c;
}

function makeBush(o) {
  const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 0), mat('leaves', () => std(tex.leaves(), { flatShading: true })));
  b.position.set(o.x + 0.5, 0.3, o.z + 0.5);
  b.scale.set(1.1, 0.7, 1);
  b.rotation.y = o.x;
  b.castShadow = b.receiveShadow = true;
  return b;
}

function makeRock(o) {
  const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.5, 0), mat('rockm', () => std(tex.rock())));
  r.material.flatShading = true;
  r.position.set(o.x + 0.5, 0.3, o.z + 0.5);
  r.scale.set(1.1, 0.75, 1);
  r.castShadow = r.receiveShadow = true;
  return r;
}

function makeGate(o) {
  const g = new THREE.Group();
  const stone = mat('wall', () => std(tex.stoneWall()));
  for (const dx of [-0.5, o.w + 0.5]) {
    const tower = new THREE.Mesh(new THREE.BoxGeometry(1, 3.4, 1), stone);
    tower.position.set(o.x + dx, 1.7, 0.5);
    g.add(tower);
  }
  const arch = new THREE.Mesh(new THREE.BoxGeometry(o.w + 2, 0.6, 1), stone);
  arch.position.set(o.x + o.w / 2, 3.1, 0.5);
  g.add(arch);
  return shadowAll(g);
}
