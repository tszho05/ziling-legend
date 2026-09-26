import * as THREE from 'three';
import { tex } from './textures.js';
import { mat, std, box, at, hash, M, TM, leafBlob } from './props.js';

// 其他佈景物件：路燈、噴水池、城門、柵欄、石頭、池塘等

// 木牌上的文字（例如「墨香鎮」）
function textBoard(text, w, h) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = Math.round(256 * h / w);
  const g = c.getContext('2d');
  g.drawImage(tex.wood().image, 0, 0, c.width, c.height);
  g.strokeStyle = '#3e2714'; g.lineWidth = 8; g.strokeRect(4, 4, c.width - 8, c.height - 8);
  g.fillStyle = '#fff3c4';
  g.font = `bold ${Math.round(c.height * 0.55)}px "Noto Serif TC", "PMingLiU", serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = '#3e2714'; g.shadowOffsetY = 3;
  g.fillText(text, c.width / 2, c.height / 2 + 2);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 }));
  m.castShadow = true;
  return m;
}

export function makeLamp(o) {
  const g = new THREE.Group();
  g.add(at(box(0.36, 0.3, 0.36, M.base()), 0, 0.15, 0));
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 2.1, 8), M.iron());
  post.castShadow = true;
  g.add(at(post, 0, 1.3, 0));
  g.add(at(box(0.5, 0.05, 0.05, M.iron()), 0.2, 2.3, 0));
  // 吊燈：玻璃、上蓋、底座
  g.add(at(box(0.24, 0.3, 0.24, M.lantern()), 0.4, 2.02, 0));
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.16, 4), M.iron());
  cap.rotation.y = Math.PI / 4;
  g.add(at(cap, 0.4, 2.25, 0));
  g.add(at(box(0.28, 0.04, 0.28, M.iron()), 0.4, 1.86, 0));
  const light = new THREE.PointLight(0xffb45a, 6, 6, 1.6);
  light.position.set(0.4, 2.0, 0);
  g.add(light);
  g.position.set(o.x + 0.5, 0, o.z + 0.5);
  g.userData.light = light;
  return g;
}

export function makeFountain(o) {
  const g = new THREE.Group();
  const stone = mat('f-stone', () => std(tex.stoneWall()));
  const waterM = mat('f-water', () => new THREE.MeshStandardMaterial({ map: tex.water(), emissive: 0x2f7fc4, emissiveIntensity: 0.55, roughness: 0.15 }));
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.15, 0.5, 8), stone);
  base.position.y = 0.25;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.09, 6, 8), M.base());
  rim.rotation.x = Math.PI / 2; rim.rotation.z = Math.PI / 8; rim.position.y = 0.52;
  const water = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 0.92, 0.05, 16), waterM);
  water.position.y = 0.46;
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.22, 1.1, 8), stone);
  col.position.y = 0.95;
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.25, 0.22, 8), stone);
  bowl.position.y = 1.5;
  const bowlWater = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.03, 12), waterM);
  bowlWater.position.y = 1.6;
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), stone);
  top.position.y = 1.75;
  // 從上層水盆邊流下的幾道細水柱
  const streamM = mat('f-stream', () => new THREE.MeshStandardMaterial({ color: 0xd8f0ff, emissive: 0x5aa8e0, emissiveIntensity: 0.6, transparent: true, opacity: 0.55, depthWrite: false }));
  const streams = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2;
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.04, 1.08, 5), streamM);
    st.position.set(Math.cos(a) * 0.49, 1.0, Math.sin(a) * 0.49);
    streams.add(st);
  }
  g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  g.add(base, rim, water, col, bowl, bowlWater, top, streams);
  [base, rim, col, bowl, top].forEach(m => { m.castShadow = true; m.receiveShadow = true; });
  g.position.set(o.x + o.w / 2, 0, o.z + o.d / 2);
  return g;
}

// 木箱與木桶一組
export function makeCrate(o) {
  const g = new THREE.Group();
  g.add(at(box(0.7, 0.7, 0.7, M.wood()), -0.1, 0.35, 0));
  for (const y of [0.04, 0.66]) g.add(at(box(0.74, 0.08, 0.74, M.beam()), -0.1, y, 0));
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.7, 12), M.wood());
  barrel.castShadow = barrel.receiveShadow = true;
  g.add(at(barrel, 0.38, 0.35, 0.3));
  for (const y of [0.15, 0.55]) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.025, 4, 12), M.iron());
    band.rotation.x = Math.PI / 2;
    g.add(at(band, 0.38, y, 0.3));
  }
  g.add(at(box(0.3, 0.3, 0.3, M.wood()), -0.12, 0.85, 0.05));
  g.position.set(o.x + 0.5, 0, o.z + 0.5);
  g.rotation.y = (o.x * 0.7 + o.z) % 1.2;
  return g;
}

// 帶青苔的圓潤石頭
export function makeRock(o) {
  const g = new THREE.Group();
  const seed = o.x * 3.1 + o.z * 1.7;
  const rockM = mat('p-rock', () => std(tex.rock()));
  const r = leafBlob(0.5, seed, rockM);
  r.scale.set(1.15, 0.7, 0.95);
  r.position.y = 0.25;
  g.add(r);
  const moss = leafBlob(0.32, seed + 3, TM.mid());
  moss.scale.set(1.1, 0.35, 0.9);
  moss.position.set(-0.08, 0.55, 0);
  g.add(moss);
  if (hash(seed) > 0.4) {
    const small = leafBlob(0.22, seed + 7, rockM);
    small.scale.y = 0.7;
    small.position.set(0.5, 0.12, 0.25);
    g.add(small);
  }
  g.position.set(o.x + 0.5, 0, o.z + 0.5);
  return g;
}

// 城門：兩座塔樓（尖頂）、拱樑、「墨香鎮」牌匾、旗幟、燈
export function makeGate(o) {
  const g = new THREE.Group();
  const stone = M.stone();
  for (const dx of [-0.6, o.w + 0.6]) {
    const x = o.x + dx;
    g.add(at(box(1.3, 3.6, 1.3, stone), x, 1.8, 0.5));
    g.add(at(box(1.5, 0.2, 1.5, M.base()), x, 3.7, 0.5));
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.05, 1.5, 4), M.roof('red'));
    roof.rotation.y = Math.PI / 4;
    g.add(at(roof, x, 4.55, 0.5));
    // 旗幟與燈
    g.add(at(box(0.6, 1.2, 0.04, mat('p-banner', () => new THREE.MeshStandardMaterial({ color: 0xb8322a, roughness: 0.8 }))), x, 2.4, 1.18));
    g.add(at(box(0.3, 0.3, 0.05, mat('p-emblem', () => new THREE.MeshStandardMaterial({ color: 0xf2c230, emissive: 0x6a4a00, roughness: 0.5 }))), x, 2.55, 1.21));
    g.add(at(box(0.7, 0.06, 0.06, M.iron()), x, 3.02, 1.18));
    g.add(at(box(0.22, 0.28, 0.22, M.lantern()), x + (dx < 0 ? 0.75 : -0.75), 2.0, 1.1));
  }
  g.add(at(box(o.w + 1.2, 0.7, 1.1, stone), o.x + o.w / 2, 3.25, 0.5));
  g.add(at(textBoard('墨香鎮', 2.2, 0.62), o.x + o.w / 2, 3.25, 1.07));
  g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  return g;
}

// 城牆頂的垛口（InstancedMesh）
export function makeMerlons(walls) {
  const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.4, 0.5), M.stone(), walls.length);
  const d = new THREE.Object3D();
  walls.forEach((w, i) => { d.position.set(w.x + 0.5, 2.4, w.z + 0.5); d.updateMatrix(); inst.setMatrixAt(i, d.matrix); });
  inst.castShadow = inst.receiveShadow = true;
  return inst;
}

// 木柵欄（沿 x 方向 len 格）
export function makeFence(o) {
  const g = new THREE.Group();
  for (let i = 0; i <= o.len; i++) g.add(at(box(0.14, 0.8, 0.14, M.beam()), i, 0.4, 0.5));
  for (const y of [0.3, 0.6]) g.add(at(box(o.len, 0.08, 0.06, M.wood()), o.len / 2, y, 0.5));
  g.position.set(o.x, 0, o.z);
  return g;
}

export function makeSignpost(o) {
  const g = new THREE.Group();
  g.add(at(box(0.14, 1.5, 0.14, M.beam()), 0, 0.75, 0));
  g.add(at(textBoard(o.text, 1.2, 0.36), 0.35, 1.25, 0.09));
  g.position.set(o.x + 0.5, 0, o.z + 0.5);
  return g;
}

export function makeStump(o) {
  const g = new THREE.Group();
  const stump = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.38, 0.4, 10), TM.bark());
  stump.castShadow = stump.receiveShadow = true;
  g.add(at(stump, 0, 0.2, 0));
  const top = new THREE.Mesh(new THREE.CircleGeometry(0.29, 10), mat('p-ring', () => new THREE.MeshStandardMaterial({ color: 0xd9b27a, roughness: 1 })));
  top.rotation.x = -Math.PI / 2;
  g.add(at(top, 0, 0.405, 0));
  g.position.set(o.x + 0.5, 0, o.z + 0.5);
  return g;
}

export function makeMushrooms(o) {
  const g = new THREE.Group();
  const stem = mat('p-stem', () => new THREE.MeshStandardMaterial({ color: 0xf2ead8, roughness: 1 }));
  const capM = mat('p-cap', () => new THREE.MeshStandardMaterial({ color: 0xd8443a, roughness: 0.8 }));
  for (let i = 0; i < 3; i++) {
    const s = 0.6 + hash(o.x + i, o.z) * 0.6;
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.04 * s, 0.05 * s, 0.16 * s, 6), stem);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.12 * s, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), capM);
    const x = (i - 1) * 0.18, z = hash(o.z + i, o.x) * 0.2 - 0.1;
    g.add(at(st, x, 0.08 * s, z), at(cap, x, 0.15 * s, z));
  }
  g.position.set(o.x + 0.5, 0, o.z + 0.5);
  return g;
}

// 池塘邊：石頭圍邊、荷葉、蘆葦
export function makePondDecor(p) {
  const g = new THREE.Group();
  const rockM = mat('p-rock', () => std(tex.rock()));
  let n = 0;
  const edge = (x, z) => {
    const r = leafBlob(0.22 + hash(x, z) * 0.12, n++, rockM);
    r.scale.y = 0.6;
    g.add(at(r, x, 0.05, z));
  };
  for (let x = p.x; x <= p.x + p.w; x += 0.55) { edge(x, p.z - 0.05); edge(x, p.z + p.d + 0.05); }
  for (let z = p.z + 0.5; z < p.z + p.d; z += 0.55) { edge(p.x - 0.05, z); edge(p.x + p.w + 0.05, z); }
  const padM = mat('p-pad', () => new THREE.MeshStandardMaterial({ color: 0x4f9a3f, roughness: 0.9, side: THREE.DoubleSide }));
  for (let i = 0; i < 5; i++) {
    const pad = new THREE.Mesh(new THREE.CircleGeometry(0.2 + hash(i, 2) * 0.1, 10, 0.3, Math.PI * 1.8), padM);
    pad.rotation.x = -Math.PI / 2;
    g.add(at(pad, p.x + 0.5 + hash(i, 3) * (p.w - 1), -0.1, p.z + 0.5 + hash(i, 4) * (p.d - 1)));
  }
  const reedM = mat('p-reed', () => new THREE.MeshStandardMaterial({ color: 0x6b8f3a, roughness: 1 }));
  const tipM = mat('p-reedtip', () => new THREE.MeshStandardMaterial({ color: 0x7a4a2a, roughness: 1 }));
  for (let i = 0; i < 9; i++) {
    const x = p.x + p.w - 0.2 + hash(i, 5) * 0.4, z = p.z + 0.3 + hash(i, 6) * (p.d - 0.6);
    const h = 0.7 + hash(i, 7) * 0.5;
    g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, h, 4), reedM), x, h / 2 - 0.1, z));
    g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.18, 6), tipM), x, h - 0.12, z));
  }
  g.traverse(m => { if (m.isMesh) m.castShadow = true; });
  return g;
}
