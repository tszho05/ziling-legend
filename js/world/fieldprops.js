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
    const h = 0.9 + hash(x, z) * 0.35; // 不要太高，免得擋住岩壁後面的角色
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

// 亂字魔的祭壇：石台與符文、雕花斷柱（鎖鏈、藤蔓、紫火）、中央魔書祭台、飄浮文字與紫霧
function glyphTexture(ch) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.shadowColor = '#b070ff'; g.shadowBlur = 12;
  g.fillStyle = '#efe0ff'; g.font = 'bold 44px "Noto Serif TC", serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(ch, 32, 34);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function mistTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(190,140,255,0.7)');
  grad.addColorStop(1, 'rgba(120,60,200,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

// 下垂的鎖鏈（兩點之間）
function chain(ax, ay, az, bx, by, bz, sag, linkM) {
  const g = new THREE.Group();
  const len = Math.hypot(bx - ax, bz - az);
  const n = Math.round(len / 0.14);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const link = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.018, 4, 8), linkM);
    link.position.set(ax + (bx - ax) * t, ay + (by - ay) * t - Math.sin(t * Math.PI) * sag, az + (bz - az) * t);
    link.rotation.y = Math.atan2(bx - ax, bz - az);
    if (i % 2) link.rotation.z = Math.PI / 2;
    g.add(link);
  }
  return g;
}

export function makeAltar(o) {
  const g = new THREE.Group();
  const stone = mat('fp-altar', () => std(tex.stoneWall(), { color: 0xb8aec8 }));
  const dark = mat('fp-altar-dark', () => std(tex.stoneBase(), { color: 0x8a7fa0 }));
  const plat = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.5, 0.12, 8), stone);
  g.add(at(plat, 0, 0.06, 0));
  const step = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.75, 0.06, 8), dark);
  g.add(at(step, 0, 0.03, 0));
  const runeM = mat('fp-rune', () => new THREE.MeshBasicMaterial({ color: 0xb080ff, transparent: true, opacity: 0.55 }));
  const rune = new THREE.Mesh(new THREE.RingGeometry(1.5, 1.65, 32), runeM);
  rune.rotation.x = -Math.PI / 2;
  g.add(at(rune, 0, 0.13, 0));
  const rune2 = new THREE.Mesh(new THREE.RingGeometry(0.9, 0.97, 6), runeM);
  rune2.rotation.x = -Math.PI / 2;
  g.add(at(rune2, 0, 0.13, 0));

  // 石柱：底座、柱身、雕花環、斷裂柱頂、紫火
  const bandM = mat('fp-band', () => std(tex.stoneBase(), { color: 0xd8cfe6 }));
  const linkM = mat('fp-chain', () => new THREE.MeshStandardMaterial({ color: 0x55525e, metalness: 0.6, roughness: 0.45 }));
  const flameM = new THREE.MeshStandardMaterial({ color: 0xc890ff, emissive: 0x9a4dff, emissiveIntensity: 2.6, transparent: true, opacity: 0.9 });
  const flames = [];
  const tops = [];
  o.pillars.forEach(([x, z], i) => {
    const px = x - o.cx, pz = z - o.cz;
    const h = 2.1 + hash(x, z) * 0.9;
    g.add(at(box(0.9, 0.3, 0.9, dark), px, 0.15, pz));
    g.add(at(box(0.72, 0.18, 0.72, stone), px, 0.39, pz));
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, h, 10), stone);
    g.add(at(col, px, 0.48 + h / 2, pz));
    for (const k of [0.25, 0.6]) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.05, 6, 16), bandM);
      band.rotation.x = Math.PI / 2;
      g.add(at(band, px, 0.48 + h * k, pz));
    }
    // 斷裂的柱頂：傾斜碎塊
    const top = leafBlob(0.3, x * 3 + z, stone);
    top.scale.set(1, 0.55, 1);
    top.rotation.set(0.3, i, 0.25);
    g.add(at(top, px, 0.48 + h + 0.05, pz));
    tops.push([px, 0.48 + h, pz]);
    // 柱頂紫火與光
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.5, 8), flameM);
    g.add(at(f, px, 0.48 + h + 0.4, pz));
    const light = new THREE.PointLight(0xa060ff, 3, 5, 1.8);
    light.position.set(px, 0.48 + h + 0.5, pz);
    g.add(light);
    flames.push({ f, light, ph: i * 1.7 });
    // 藤蔓：沿柱身螺旋的小葉團（前面兩根）
    if (pz > 0) {
      for (let k = 0; k < 7; k++) {
        const a = k * 1.1 + i;
        const leaf = leafBlob(0.11, k + i * 10, TM.mid());
        g.add(at(leaf, px + Math.cos(a) * 0.3, 0.6 + k * (h / 8), pz + Math.sin(a) * 0.3));
      }
    }
  });
  // 鎖鏈：連接相鄰石柱
  const order = [0, 1, 3, 2];
  for (let k = 0; k < 4; k++) {
    const [ax, ay, az] = tops[order[k]], [bx, by, bz] = tops[order[(k + 1) % 4]];
    g.add(chain(ax, ay - 0.35, az, bx, by - 0.35, bz, 0.9, linkM));
  }

  // 中央魔書祭台（在頭目身後）
  const stand = new THREE.Group();
  stand.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.18, 8), dark), 0, 0.09, 0));
  stand.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.26, 0.9, 8), stone), 0, 0.63, 0));
  for (const y of [0.35, 0.95]) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.04, 6, 12), bandM);
    band.rotation.x = Math.PI / 2;
    stand.add(at(band, 0, y, 0));
  }
  const tray = box(0.8, 0.08, 0.6, stone);
  tray.rotation.x = -0.25;
  stand.add(at(tray, 0, 1.12, 0));
  // 飄浮的魔書：封面、書頁、會翻動的一頁
  const book = new THREE.Group();
  const coverM = mat('fp-cover', () => new THREE.MeshStandardMaterial({ color: 0x2a1838, roughness: 0.6, emissive: 0x3a1060, emissiveIntensity: 0.4 }));
  const pageM = mat('fp-page', () => new THREE.MeshStandardMaterial({ color: 0xf0e4c8, emissive: 0x8050c0, emissiveIntensity: 0.35, side: THREE.DoubleSide }));
  for (const s of [-1, 1]) {
    const cover = box(0.36, 0.03, 0.48, coverM);
    cover.rotation.z = s * 0.18;
    book.add(at(cover, s * 0.18, 0, 0));
    const pages = box(0.33, 0.05, 0.44, pageM);
    pages.rotation.z = s * 0.18;
    book.add(at(pages, s * 0.17, 0.035, 0));
  }
  const flip = new THREE.Group();
  const leafPage = new THREE.Mesh(new THREE.PlaneGeometry(0.33, 0.44), pageM);
  leafPage.rotation.x = -Math.PI / 2;
  leafPage.position.x = 0.165;
  flip.add(leafPage);
  flip.position.y = 0.07;
  book.add(flip);
  book.position.y = 1.55;
  stand.add(book);
  const bookLight = new THREE.PointLight(0xb070ff, 4, 4, 1.6);
  bookLight.position.y = 1.8;
  stand.add(bookLight);
  stand.position.set(0, 0.12, -1.35);
  g.add(stand);

  // 繞着祭壇飄浮的文字碎片
  const chars = '心驚膽戰沾自喜怒髮衝冠上眉梢不在焉一籌莫展目瞪口呆灰意冷有難言百感交集';
  const glyphs = [];
  for (let i = 0; i < 16; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glyphTexture(chars[(i * 7) % chars.length]), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.scale.setScalar(0.42);
    s.userData = { r: 1.9 + hash(i, 1) * 1.1, a: hash(i, 2) * Math.PI * 2, y: 0.6 + hash(i, 3) * 2.2, sp: 0.25 + hash(i, 4) * 0.25 };
    g.add(s);
    glyphs.push(s);
  }
  // 地面紫霧
  const N = 70;
  const mistGeo = new THREE.BufferGeometry();
  const mp = new Float32Array(N * 3), seeds = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const a = hash(i, 5) * Math.PI * 2, r = 0.5 + hash(i, 6) * 3;
    mp[i * 3] = Math.cos(a) * r; mp[i * 3 + 1] = 0.15 + hash(i, 7) * 0.35; mp[i * 3 + 2] = Math.sin(a) * r;
    seeds[i] = hash(i, 8) * 10;
  }
  mistGeo.setAttribute('position', new THREE.BufferAttribute(mp, 3));
  const mist = new THREE.Points(mistGeo, new THREE.PointsMaterial({ map: mistTexture(), size: 1.3, transparent: true, depthWrite: false, opacity: 0.35, blending: THREE.AdditiveBlending }));
  mist.frustumCulled = false;
  g.add(mist);

  g.position.set(o.cx, 0, o.cz);
  g.traverse(m => { if (m.isMesh && m.material !== runeM && m.material !== flameM) { m.castShadow = true; m.receiveShadow = true; } });
  g.userData.tick = t => {
    runeM.opacity = 0.4 + Math.sin(t * 2) * 0.2;
    rune.rotation.z = t * 0.2;
    rune2.rotation.z = -t * 0.35;
    for (const { f, light, ph } of flames) {
      const k = 1 + Math.sin(t * 11 + ph) * 0.1 + Math.sin(t * 6.3 + ph) * 0.07;
      f.scale.set(1, k, 1);
      light.intensity = 2.6 + Math.sin(t * 9 + ph) * 0.6;
    }
    book.position.y = 1.55 + Math.sin(t * 1.6) * 0.08;
    book.rotation.y = Math.sin(t * 0.5) * 0.25;
    const fp = (t * 0.45) % 1; // 一頁慢慢翻過去
    flip.rotation.z = fp < 0.8 ? (fp / 0.8) * Math.PI : Math.PI;
    leafPage.visible = fp < 0.8;
    for (const s of glyphs) {
      const u = s.userData;
      const a = u.a + t * u.sp;
      s.position.set(Math.cos(a) * u.r, u.y + Math.sin(t * 1.3 + u.a) * 0.25, Math.sin(a) * u.r * 0.8);
      s.material.opacity = 0.55 + Math.sin(t * 2 + u.a * 3) * 0.35;
    }
    for (let i = 0; i < N; i++) {
      const a = t * 0.08 + seeds[i];
      mp[i * 3] += Math.cos(a) * 0.004;
      mp[i * 3 + 2] += Math.sin(a) * 0.004;
    }
    mistGeo.attributes.position.needsUpdate = true;
    mist.material.opacity = 0.3 + Math.sin(t * 0.8) * 0.08;
  };
  return g;
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
