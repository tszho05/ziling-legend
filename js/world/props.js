import * as THREE from 'three';
import { tex } from './textures.js';

// 房屋、樹木等 3D 模型（程式生成，像素貼圖）

const matCache = new Map();
export function mat(key, make) { if (!matCache.has(key)) matCache.set(key, make()); return matCache.get(key); }
export const std = (map, extra = {}) => new THREE.MeshStandardMaterial({ map, roughness: 0.95, metalness: 0, ...extra });

// 方塊各面的 UV 按實際尺寸縮放，讓貼圖密度一致（1 格 = 1 張貼圖）
export function box(w, h, d, material) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const uv = geo.attributes.uv;
  const faces = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]]; // px nx py ny pz nz
  for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) {
    const k = f * 4 + i;
    uv.setXY(k, uv.getX(k) * faces[f][0], uv.getY(k) * faces[f][1]);
  }
  const m = new THREE.Mesh(geo, material);
  m.castShadow = m.receiveShadow = true;
  return m;
}
export const at = (m, x, y, z) => { m.position.set(x, y, z); return m; };
export const hash = (a, b = 0) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };

export const M = {
  base: () => mat('h-base', () => std(tex.stoneBase())),
  plaster: t => mat('h-plaster-' + t, () => std(tex.plaster(t))),
  beam: () => mat('h-beam', () => std(tex.beam())),
  wood: () => mat('h-wood', () => std(tex.wood())),
  roof: c => mat('h-roof-' + c, () => std(tex.roof(c))),
  ridge: () => mat('h-ridge', () => std(null, { color: 0x6b3a2a })),
  glass: () => mat('h-glass', () => new THREE.MeshStandardMaterial({ color: 0xffe2a0, emissive: 0xffb24a, emissiveIntensity: 1.5, roughness: 0.3 })),
  lantern: () => mat('h-lantern', () => new THREE.MeshStandardMaterial({ color: 0xffe6b0, emissive: 0xffb040, emissiveIntensity: 2.4 })),
  iron: () => mat('h-iron', () => new THREE.MeshStandardMaterial({ color: 0x2c2c33, roughness: 0.6 })),
  shutter: c => mat('h-shutter-' + c, () => std(tex.wood(), { color: c })),
  flower: c => mat('h-flower-' + c, () => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 })),
  stone: () => mat('h-stone', () => std(tex.stoneWall())),
};

const SHUTTER = { red: 0x7fae6a, blue: 0xd98a5a, green: 0x6f8fc7 };
const FLOWERS = [0xff7aa8, 0xffd84a, 0xffffff, 0xff5a4a, 0xc49bff];

// o: { x, z, w, d, h, roof: 'red'|'blue'|'green', ridge: 'x'|'z', tint, chimney, sign }
export function makeHouse(o) {
  const g = new THREE.Group();
  const { w, d, h } = o;
  const baseH = 0.4;
  const tint = o.tint || 'cream';

  // 石牆腳 + 灰泥牆
  g.add(at(box(w, baseH, d, M.base()), w / 2, baseH / 2, d / 2));
  g.add(at(box(w - 0.1, h - baseH, d - 0.1, M.plaster(tint)), w / 2, baseH + (h - baseH) / 2, d / 2));

  // 木樑框架（正面與兩側）
  const bm = M.beam(), t = 0.12;
  const fz = d - 0.03;
  for (const x of [0.06, w - 0.06]) {
    g.add(at(box(t, h - baseH, t, bm), x, baseH + (h - baseH) / 2, fz));
    g.add(at(box(t, h - baseH, t, bm), x, baseH + (h - baseH) / 2, 0.03));
  }
  g.add(at(box(w, t, t, bm), w / 2, h - t / 2, fz));
  g.add(at(box(w, t, t, bm), w / 2, baseH + t / 2, fz));
  const midY = baseH + (h - baseH) * 0.62;
  g.add(at(box(w, t * 0.8, t, bm), w / 2, midY, fz));
  for (const x of [0.03, w - 0.03]) {
    g.add(at(box(t, t, d, bm), x, h - t / 2, d / 2));
    g.add(at(box(t, t * 0.8, d, bm), x, midY, d / 2));
  }
  // 兩角斜撐
  for (const [x, dir] of [[0.55, 1], [w - 0.55, -1]]) {
    const brace = box(0.1, 0.9, t, bm);
    brace.rotation.z = dir * 0.7;
    g.add(at(brace, x, (baseH + midY) / 2 + 0.05, fz));
  }

  // 門：門框、木門、門前石階、門邊燈
  const doorX = w / 2;
  g.add(at(box(1.0, 1.55, 0.08, bm), doorX, baseH + 0.75, d + 0.01));
  g.add(at(box(0.8, 1.4, 0.06, M.wood()), doorX, baseH + 0.7, d + 0.04));
  g.add(at(box(0.08, 0.08, 0.04, M.iron()), doorX + 0.25, baseH + 0.7, d + 0.08));
  g.add(at(box(1.2, 0.12, 0.45, M.base()), doorX, 0.06, d + 0.22));
  g.add(at(box(0.18, 0.24, 0.18, M.lantern()), doorX + 0.75, baseH + 1.4, d + 0.12));
  g.add(at(box(0.05, 0.05, 0.15, M.iron()), doorX + 0.75, baseH + 1.55, d + 0.05));

  // 窗：窗框、發光玻璃、百葉窗、花箱
  const winY = baseH + (midY - baseH) * 0.55 + 0.2;
  const shutterMat = M.shutter(SHUTTER[o.roof] || 0x7fae6a);
  for (let k = 1; k < 4; k++) for (const sgn of [-1, 1]) {
    const x = doorX + sgn * k * 1.25;
    if (x < 0.55 || x > w - 0.55) continue;
    g.add(at(box(0.62, 0.62, 0.06, bm), x, winY, d + 0.01));
    g.add(at(box(0.48, 0.48, 0.04, M.glass()), x, winY, d + 0.03));
    g.add(at(box(0.04, 0.48, 0.05, bm), x, winY, d + 0.05));
    g.add(at(box(0.48, 0.04, 0.05, bm), x, winY, d + 0.05));
    for (const sx of [-0.42, 0.42]) g.add(at(box(0.2, 0.62, 0.04, shutterMat), x + sx, winY, d + 0.03));
    g.add(at(box(0.66, 0.14, 0.2, M.wood()), x, winY - 0.4, d + 0.1));
    for (let f = 0; f < 4; f++) {
      const fl = new THREE.Mesh(new THREE.IcosahedronGeometry(0.075, 0), M.flower(FLOWERS[(f + k + (sgn > 0 ? 2 : 0)) % FLOWERS.length]));
      g.add(at(fl, x - 0.24 + f * 0.16, winY - 0.28, d + 0.12));
    }
  }
  // 二樓小窗（在木樑上方）
  for (const x of [w * 0.28, w * 0.72]) {
    g.add(at(box(0.4, 0.4, 0.05, bm), x, midY + 0.35, d + 0.01));
    g.add(at(box(0.3, 0.3, 0.04, M.glass()), x, midY + 0.35, d + 0.03));
  }

  // 屋頂
  const oh = 0.35, rh = o.ridge === 'z' ? 1.5 : 1.3;
  const roofM = M.roof(o.roof);
  if (o.ridge === 'z') {
    // 山牆朝鏡頭：屋脊沿 z
    const half = w / 2, tanA = rh / half;
    const run = half + oh, rise = run * tanA, L = Math.hypot(run, rise), ang = Math.atan2(rise, run);
    for (const s of [-1, 1]) {
      const slope = box(L, 0.12, d + oh * 2, roofM);
      slope.rotation.z = -s * ang;
      g.add(at(slope, w / 2 + s * run / 2, h + rh - rise / 2 + 0.06, d / 2));
    }
    g.add(at(box(0.18, 0.16, d + oh * 2 + 0.02, M.ridge()), w / 2, h + rh + 0.1, d / 2));
    // 山牆三角形（前後）
    const shape = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(w - 0.1, 0), new THREE.Vector2((w - 0.1) / 2, rh - 0.05)]);
    const gable = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: d - 0.1, bevelEnabled: false }), M.plaster(tint));
    gable.castShadow = gable.receiveShadow = true;
    g.add(at(gable, 0.05, h, 0.05));
    // 山牆上的木樑與圓窗
    g.add(at(box(t, rh - 0.1, t, bm), w / 2, h + (rh - 0.1) / 2, d - 0.03));
    g.add(at(box(w * 0.6, t, t, bm), w / 2, h + rh * 0.35, d - 0.03));
    const round = new THREE.Mesh(new THREE.CircleGeometry(0.22, 16), M.glass());
    g.add(at(round, w / 2 - 0.45, h + rh * 0.35 + 0.02, d - 0.02));
  } else {
    // 屋脊沿 x：從鏡頭看到大片斜屋頂
    const half = d / 2, tanA = rh / half;
    const run = half + oh, rise = run * tanA, L = Math.hypot(run, rise), ang = Math.atan2(rise, run);
    for (const s of [-1, 1]) {
      const slope = box(w + oh * 2, 0.12, L, roofM);
      slope.rotation.x = s * ang;
      g.add(at(slope, w / 2, h + rh - rise / 2 + 0.06, d / 2 + s * run / 2));
    }
    g.add(at(box(w + oh * 2 + 0.02, 0.16, 0.18, M.ridge()), w / 2, h + rh + 0.1, d / 2));
    const shape = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(d - 0.1, 0), new THREE.Vector2((d - 0.1) / 2, rh - 0.05)]);
    const gable = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: w - 0.1, bevelEnabled: false }), M.plaster(tint));
    gable.rotation.y = -Math.PI / 2;
    gable.castShadow = gable.receiveShadow = true;
    g.add(at(gable, w - 0.05, h, 0.05));
  }

  // 煙囪
  if (o.chimney) {
    const cx = o.ridge === 'z' ? w * 0.72 : w * 0.78, cz = o.ridge === 'z' ? d * 0.35 : d * 0.38;
    g.add(at(box(0.45, 1.3, 0.45, M.stone()), cx, h + rh * 0.55 + 0.35, cz));
    g.add(at(box(0.56, 0.12, 0.56, M.base()), cx, h + rh * 0.55 + 1.02, cz));
  }

  // 店舖招牌
  if (o.sign) {
    g.add(at(box(0.7, 0.05, 0.05, M.iron()), doorX - 0.95, baseH + 1.75, d + 0.35));
    g.add(at(box(0.05, 0.05, 0.4, M.iron()), doorX - 0.62, baseH + 1.75, d + 0.18));
    const board = box(0.62, 0.44, 0.06, M.wood());
    g.add(at(board, doorX - 0.95, baseH + 1.48, d + 0.35));
    g.add(at(box(0.3, 0.2, 0.07, M.flower(o.sign)), doorX - 0.95, baseH + 1.48, d + 0.35));
  }

  g.position.set(o.x, 0, o.z);
  g.userData.fadeable = true;
  g.userData.rect = { x: o.x, z: o.z, w, d, h: h + rh };
  return g;
}

// ---------------- 樹木 ----------------

// 帶凹凸的圓潤葉團（法線取球面方向，看起來柔和）
export function leafBlob(radius, seed, material) {
  const geo = new THREE.IcosahedronGeometry(radius, 1);
  const pos = geo.attributes.position, nor = geo.attributes.normal;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    const k = hash(Math.round(v.x * 50) + seed, Math.round(v.y * 50) * 3 + Math.round(v.z * 50));
    nor.setXYZ(i, v.x, v.y, v.z);
    v.multiplyScalar(radius * (0.86 + k * 0.28));
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  const m = new THREE.Mesh(geo, material);
  m.castShadow = m.receiveShadow = true;
  return m;
}

export const TM = {
  bark: () => mat('t-bark', () => std(tex.bark())),
  light: () => mat('t-light', () => std(tex.leaves('light'))),
  mid: () => mat('t-mid', () => std(tex.leaves('mid'))),
  pine: () => mat('t-pine', () => std(tex.leaves('pine'))),
};

// kind: 'round'（闊葉樹）| 'pine'（松樹）；不指定時按位置決定
export function makeTree(o) {
  const seed = o.x * 13.7 + o.z * 7.3;
  const kind = o.kind || (hash(seed) < 0.3 ? 'pine' : 'round');
  const s = 0.85 + hash(seed, 1) * 0.35;
  const g = new THREE.Group();
  const canopy = new THREE.Group();

  if (kind === 'pine') {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1 * s, 0.16 * s, 1.0 * s, 8), TM.bark());
    trunk.position.y = 0.5 * s;
    trunk.castShadow = true;
    g.add(trunk);
    for (let i = 0; i < 4; i++) {
      const r = (0.95 - i * 0.2) * s, hgt = (0.9 - i * 0.08) * s;
      const cone = new THREE.Mesh(new THREE.ConeGeometry(r, hgt, 9), TM.pine());
      cone.position.y = (0.75 + i * 0.5) * s;
      cone.rotation.y = i * 0.7;
      cone.castShadow = cone.receiveShadow = true;
      canopy.add(cone);
    }
  } else {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * s, 0.22 * s, 1.3 * s, 8), TM.bark());
    trunk.position.y = 0.65 * s;
    trunk.castShadow = true;
    g.add(trunk);
    for (const dir of [-1, 1]) {
      const br = new THREE.Mesh(new THREE.CylinderGeometry(0.04 * s, 0.07 * s, 0.6 * s, 6), TM.bark());
      br.position.set(dir * 0.18 * s, 1.1 * s, 0);
      br.rotation.z = -dir * 0.8;
      g.add(br);
    }
    // 葉團：底層較暗、頂層較亮
    const blobs = [
      [0, 1.75, 0, 0.72, 'mid'], [-0.5, 1.5, 0.1, 0.5, 'mid'], [0.5, 1.55, -0.05, 0.52, 'mid'],
      [0.05, 1.6, 0.45, 0.5, 'mid'], [-0.2, 2.2, -0.1, 0.5, 'light'], [0.3, 2.1, 0.2, 0.45, 'light'],
    ];
    blobs.forEach(([x, y, z, r, tone], i) => {
      const b = leafBlob(r * s, seed + i * 17, tone === 'light' ? TM.light() : TM.mid());
      b.position.set(x * s, y * s, z * s);
      canopy.add(b);
    });
  }
  g.add(canopy);
  g.position.set(o.x + 0.5, 0, o.z + 0.5);
  g.rotation.y = hash(seed, 2) * Math.PI * 2;
  g.userData.fadeable = true;
  g.userData.rect = { x: Math.floor(o.x), z: Math.floor(o.z), w: 1, d: 1, h: 2.6 * s };
  g.userData.sway = { canopy, phase: hash(seed, 3) * 6.28 };
  return g;
}

export function makeBush(o) {
  const g = new THREE.Group();
  const seed = o.x * 5.1 + o.z * 3.3;
  for (let i = 0; i < 3; i++) {
    const b = leafBlob(0.32 + hash(seed, i) * 0.12, seed + i, i === 1 ? TM.light() : TM.mid());
    b.position.set((i - 1) * 0.28, 0.25 + (i === 1 ? 0.08 : 0), hash(seed, i + 5) * 0.2 - 0.1);
    b.scale.y = 0.8;
    g.add(b);
  }
  if (hash(seed, 9) < 0.5) {
    for (let f = 0; f < 3; f++) {
      const fl = new THREE.Mesh(new THREE.IcosahedronGeometry(0.06, 0), M.flower(FLOWERS[(f + (seed | 0)) % FLOWERS.length]));
      fl.position.set((f - 1) * 0.25, 0.5, 0.22);
      g.add(fl);
    }
  }
  g.position.set(o.x + 0.5, 0, o.z + 0.5);
  return g;
}
