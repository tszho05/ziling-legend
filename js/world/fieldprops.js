import * as THREE from 'three';
import { tex } from './textures.js';
import { mat, std, box, at, hash, M, TM, leafBlob } from './props.js';

// 半開放式郊區用的佈景：木橋、倒木、魔法結界、岩壁、山坡、帳篷、營火、祭壇

const bark = () => TM.bark();
const shadow = g => { g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return g; };

// 木橋（沿 z 方向跨過河，w 格寬、d 格長）
export function makeBridge(o) {
  const g = new THREE.Group();
  const len = o.d + 0.8;
  for (let i = 0; i < Math.round(len / 0.34); i++) {
    const plank = box(o.w + 0.3, 0.08, 0.3, M.wood());
    plank.rotation.z = (hash(i, o.x) - 0.5) * 0.04;
    g.add(at(plank, o.w / 2, 0.04, -0.4 + 0.17 + i * 0.34));
  }
  for (const x of [-0.1, o.w + 0.1]) {
    for (let i = 0; i <= 3; i++) g.add(at(box(0.12, 0.8, 0.12, M.beam()), x, 0.35, -0.4 + i * len / 3));
    g.add(at(box(0.08, 0.08, len, M.wood()), x, 0.72, len / 2 - 0.4));
  }
  g.position.set(o.x, 0, o.z);
  return shadow(g);
}

// 倒下的木頭（擋住木橋）
export function makeLog(o) {
  const g = new THREE.Group();
  const log = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.38, o.w + 0.4, 12), bark());
  log.rotation.z = Math.PI / 2;
  g.add(at(log, o.w / 2, 0.36, 0.5));
  const ringM = mat('fp-ring', () => new THREE.MeshStandardMaterial({ color: 0xd9b27a, roughness: 1 }));
  for (const s of [-1, 1]) {
    const ring = new THREE.Mesh(new THREE.CircleGeometry(0.34, 12), ringM);
    ring.rotation.y = s * Math.PI / 2;
    g.add(at(ring, o.w / 2 + s * (o.w / 2 + 0.21), 0.36, 0.5));
  }
  const br = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 0.8, 6), bark());
  br.rotation.z = 0.8;
  g.add(at(br, o.w * 0.3, 0.7, 0.45));
  g.position.set(o.x, 0, o.z);
  return shadow(g);
}

// 倒下的大樹（樹幹橫放，一端有葉團）
export function makeFallenTree(o) {
  const g = makeLog({ x: 0, z: 0, w: o.w + 0.6 });
  for (let i = 0; i < 3; i++) {
    const b = leafBlob(0.55 - i * 0.08, o.x + i * 5, i ? TM.light() : TM.mid());
    b.position.set(o.w + 0.9 + i * 0.25, 0.55 + i * 0.25, 0.3 + (i - 1) * 0.3);
    g.add(b);
  }
  g.position.set(o.x - 0.3, 0, o.z);
  return shadow(g);
}

// 紫色魔法結界（x 方向的一道牆，跨 d 格）
export function makeBarrier(o) {
  const g = new THREE.Group();
  const wallM = new THREE.MeshBasicMaterial({ color: 0xa060ff, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false });
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(o.d, 2.6), wallM);
  wall.rotation.y = Math.PI / 2;
  g.add(at(wall, 0.5, 1.3, o.d / 2));
  const glyphs = [];
  const chars = '亂字魔墨靈心目口';
  for (let i = 0; i < 7; i++) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const cg = c.getContext('2d');
    cg.fillStyle = '#e8d4ff'; cg.font = 'bold 48px serif'; cg.textAlign = 'center'; cg.textBaseline = 'middle';
    cg.fillText(chars[i % chars.length], 32, 34);
    const t = new THREE.CanvasTexture(c);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, color: 0xd8b8ff }));
    s.scale.set(0.45, 0.45, 1);
    s.userData.base = new THREE.Vector3(0.5 + (hash(i, 1) - 0.5) * 0.3, 0.4 + hash(i, 2) * 2, 0.2 + hash(i, 3) * (o.d - 0.4));
    s.position.copy(s.userData.base);
    g.add(s);
    glyphs.push(s);
  }
  g.position.set(o.x, 0, o.z);
  g.userData.tick = t => {
    wallM.opacity = 0.28 + Math.sin(t * 2.5) * 0.1;
    glyphs.forEach((s, i) => { s.position.y = s.userData.base.y + Math.sin(t * 1.3 + i) * 0.2; s.material.rotation = Math.sin(t + i) * 0.4; });
  };
  return g;
}

// 岩壁（InstancedMesh：石塊 + 草頂）
export function makeCliffs(cells) {
  const g = new THREE.Group();
  const rockI = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1.5, 1), mat('fp-cliff', () => std(tex.stoneBase())), cells.length);
  const capI = new THREE.InstancedMesh(new THREE.BoxGeometry(1.08, 0.18, 1.08), mat('fp-cap', () => std(tex.grass())), cells.length);
  const d = new THREE.Object3D();
  cells.forEach(({ x, z }, i) => {
    const h = 1.3 + hash(x, z) * 0.5;
    d.position.set(x + 0.5, h / 2, z + 0.5); d.scale.set(1, h / 1.5, 1); d.rotation.y = 0; d.updateMatrix();
    rockI.setMatrixAt(i, d.matrix);
    d.position.set(x + 0.5, h + 0.05, z + 0.5); d.scale.set(1, 1, 1); d.updateMatrix();
    capI.setMatrixAt(i, d.matrix);
  });
  rockI.castShadow = rockI.receiveShadow = capI.castShadow = capI.receiveShadow = true;
  g.add(rockI, capI);
  return g;
}

// 小山坡（圓潤草丘，上面有石頭或灌木）
export function makeHill(o) {
  const g = new THREE.Group();
  const geo = new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2);
  const hill = new THREE.Mesh(geo, mat('fp-hill', () => std(tex.grass())));
  hill.scale.set(o.r, o.r * 0.5, o.r);
  hill.receiveShadow = hill.castShadow = true;
  g.add(hill);
  const r = leafBlob(0.35, o.x * 3, mat('p-rock', () => std(tex.rock())));
  r.scale.y = 0.7;
  g.add(at(r, o.r * 0.2, o.r * 0.48, -o.r * 0.1));
  for (let i = 0; i < 2; i++) {
    const b = leafBlob(0.3, o.x + i * 9, TM.mid());
    b.scale.y = 0.8;
    g.add(at(b, -o.r * 0.35 + i * 0.4, o.r * 0.38, o.r * 0.25));
  }
  g.position.set(o.x, -0.02, o.z);
  return g;
}

// 哥布林帳篷
export function makeTent(o) {
  const g = new THREE.Group();
  const cloth = mat('fp-tent', () => new THREE.MeshStandardMaterial({ color: 0x9a6a3c, roughness: 1, flatShading: true }));
  const tent = new THREE.Mesh(new THREE.ConeGeometry(1.1, 1.6, 4), cloth);
  tent.rotation.y = Math.PI / 4;
  g.add(at(tent, 0, 0.8, 0));
  const door = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.8), mat('fp-door', () => new THREE.MeshBasicMaterial({ color: 0x241408 })));
  door.rotation.x = -0.35;
  g.add(at(door, 0, 0.4, 0.62));
  g.add(at(box(0.05, 0.6, 0.05, M.beam()), 0, 1.75, 0));
  g.add(at(box(0.35, 0.22, 0.02, mat('fp-flag', () => new THREE.MeshStandardMaterial({ color: 0x5a7a2a, side: THREE.DoubleSide }))), 0.19, 1.9, 0));
  g.position.set(o.x + 0.5, 0, o.z + 0.5);
  return shadow(g);
}

// 營火：石圈、木柴、會閃動的火焰與光
export function makeCampfire(o) {
  const g = new THREE.Group();
  const rockM = mat('p-rock', () => std(tex.rock()));
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2;
    const r = leafBlob(0.12, i + o.x, rockM);
    r.scale.y = 0.7;
    g.add(at(r, Math.cos(a) * 0.38, 0.06, Math.sin(a) * 0.38));
  }
  for (let i = 0; i < 3; i++) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.6, 6), bark());
    log.rotation.set(Math.PI / 2 - 0.3, i * 2.1, 0);
    g.add(at(log, 0, 0.12, 0));
  }
  const flameM = new THREE.MeshStandardMaterial({ color: 0xffb040, emissive: 0xff7a1a, emissiveIntensity: 2.5, transparent: true, opacity: 0.9 });
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.55, 8), flameM);
  g.add(at(flame, 0, 0.38, 0));
  const inner = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.35, 8), new THREE.MeshBasicMaterial({ color: 0xfff0a0 }));
  g.add(at(inner, 0, 0.3, 0));
  const light = new THREE.PointLight(0xff8a30, 5, 6, 1.6);
  light.position.y = 0.6;
  g.add(light);
  g.position.set(o.x + 0.5, 0, o.z + 0.5);
  g.userData.tick = t => {
    const f = 1 + Math.sin(t * 13) * 0.08 + Math.sin(t * 7.3) * 0.06;
    flame.scale.set(1, f, 1);
    inner.scale.set(1, 2 - f, 1);
    light.intensity = 4.5 + Math.sin(t * 11) * 0.8;
  };
  return g;
}

// 亂字魔的祭壇：石台與四根斷柱
export function makeAltar(o) {
  const g = new THREE.Group();
  const stone = mat('fp-altar', () => std(tex.stoneWall(), { color: 0xb8aec8 }));
  const plat = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.4, 0.1, 8), stone);
  plat.receiveShadow = true;
  g.add(at(plat, 0, 0.05, 0));
  const runeM = mat('fp-rune', () => new THREE.MeshBasicMaterial({ color: 0xb080ff, transparent: true, opacity: 0.55 }));
  const rune = new THREE.Mesh(new THREE.RingGeometry(1.5, 1.65, 32), runeM);
  rune.rotation.x = -Math.PI / 2;
  g.add(at(rune, 0, 0.11, 0));
  for (const [x, z] of o.pillars) {
    const h = 2 + hash(x, z) * 1.2;
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.36, h, 8), stone);
    g.add(at(p, x - o.cx, h / 2, z - o.cz));
    g.add(at(box(0.8, 0.2, 0.8, stone), x - o.cx, 0.1, z - o.cz));
  }
  g.position.set(o.cx, 0, o.cz);
  g.userData.tick = t => { runeM.opacity = 0.4 + Math.sin(t * 2) * 0.2; rune.rotation.z = t * 0.2; };
  return shadow(g);
}

// 河岸：沿兩岸散佈石頭和蘆葦（避開木橋）
export function makeRiverBanks(o) {
  const g = new THREE.Group();
  const rockM = mat('p-rock', () => std(tex.rock()));
  const reedM = mat('p-reed', () => new THREE.MeshStandardMaterial({ color: 0x6b8f3a, roughness: 1 }));
  const tipM = mat('p-reedtip', () => new THREE.MeshStandardMaterial({ color: 0x7a4a2a, roughness: 1 }));
  let n = 0;
  for (const [z, side] of [[o.zTop, -1], [o.zBot, 1]]) {
    for (let x = o.x0; x < o.x1; x += 0.45 + hash(x, z) * 0.5) {
      if (x > o.skip[0] && x < o.skip[1]) continue;
      const k = hash(x * 3, z);
      if (k < 0.45) {
        const r = leafBlob(0.12 + hash(x, z + 1) * 0.14, n++, rockM);
        r.scale.y = 0.55;
        g.add(at(r, x, 0.04, z + side * (0.05 + hash(z, x) * 0.15)));
      } else if (k < 0.7) {
        for (let i = 0; i < 3; i++) {
          const h = 0.5 + hash(x + i, z) * 0.45, rx = x + (i - 1) * 0.08, rz = z - side * 0.08 + hash(i, x) * 0.1;
          g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.018, h, 4), reedM), rx, h / 2, rz));
          if (i === 1) g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.14, 6), tipM), rx, h - 0.05, rz));
        }
      }
    }
  }
  g.traverse(m => { if (m.isMesh) m.castShadow = true; });
  return g;
}

// 橋墩旁的水花與漣漪
export function makeBridgeSplash(x, z, w, d) {
  const group = new THREE.Group();
  const posts = [];
  for (const px of [x - 0.1, x + w + 0.1]) for (let i = 0; i <= 3; i++) posts.push([px, z - 0.4 + i * (d + 0.8) / 3]);
  const wet = posts.filter(([, pz]) => pz > z && pz < z + d);
  const ringM = () => new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false });
  const rings = wet.map(([px, pz], i) => {
    const r = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.15, 16), ringM());
    r.rotation.x = -Math.PI / 2;
    r.position.set(px, 0.045, pz);
    r.userData.phase = i * 0.7;
    group.add(r);
    return r;
  });
  const foamM = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, depthWrite: false });
  const bits = [];
  for (const [px, pz] of wet) for (let k = 0; k < 4; k++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.035, 5, 4), foamM);
    b.userData = { px: px + 0.12, pz: pz + (k - 1.5) * 0.08, ph: k * 1.3 + px };
    group.add(b);
    bits.push(b);
  }
  const tick = t => {
    for (const r of rings) {
      const a = ((t * 0.8 + r.userData.phase) % 1);
      r.scale.setScalar(1 + a * 2.2);
      r.material.opacity = 0.5 * (1 - a);
    }
    for (const b of bits) {
      const a = (t * 1.6 + b.userData.ph) % 1;
      b.position.set(b.userData.px + a * 0.4, 0.05 + Math.sin(a * Math.PI) * 0.15, b.userData.pz);
    }
  };
  return { group, tick };
}
