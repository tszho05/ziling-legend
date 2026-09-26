import * as THREE from 'three';
import { ASSETS } from '../data/assets.js';

// 載入素材：有 PNG 就用 PNG，沒有就畫佔位圖（明顯標示為佔位用途）。
const cache = new Map();
export const SPRITE_PITCH = THREE.MathUtils.degToRad(18);

function loadImage(src) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export async function preloadAssets(keys = Object.keys(ASSETS)) {
  await Promise.all(keys.map(async key => {
    if (cache.has(key)) return;
    const def = ASSETS[key];
    let img = await loadImage(def.path);
    const placeholder = !img;
    if (!img) img = drawPlaceholder(key, def);
    const tex = new THREE.Texture(img);
    tex.colorSpace = THREE.SRGBColorSpace;
    if (placeholder) {
      // 佔位圖是像素畫，用最近取樣
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestFilter;
      tex.generateMipmaps = false;
    } else {
      // 正式素材為手繪高清風格，用平滑取樣
      tex.magFilter = THREE.LinearFilter;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.anisotropy = 4;
    }
    tex.needsUpdate = true;
    const aspect = (img.width / def.cols) / (img.height / def.rows);
    cache.set(key, { tex, def, aspect, placeholder, alphaTest: placeholder ? 0.5 : 0.35 });
  }));
}

export function isPlaceholder(key) { return cache.get(key)?.placeholder ?? true; }

export class Billboard {
  constructor(key, opts = {}) {
    const entry = cache.get(key);
    if (!entry) throw new Error('asset not loaded: ' + key);
    const { def, aspect, alphaTest } = entry;
    this.def = def;
    this.height = opts.height ?? def.height;
    this.width = this.height * aspect;
    this.tex = entry.tex.clone();
    this.tex.repeat.set(1 / def.cols, 1 / def.rows);

    const geo = new THREE.PlaneGeometry(this.width, this.height);
    // feet：腳底在格子內離底邊的比例（正式素材預設 0.04），讓角色站在地面上
    const feet = entry.placeholder ? 0 : (def.feet ?? 0.04);
    geo.translate(0, this.height / 2 - feet * this.height, 0);
    const mat = new THREE.MeshStandardMaterial({
      map: this.tex, alphaTest, side: THREE.DoubleSide, roughness: 1, metalness: 0,
      emissive: new THREE.Color(0xffffff), emissiveMap: this.tex, emissiveIntensity: opts.glow ?? 0.28,
      transparent: !!opts.transparent,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    // 角色只用太陽照出的剪影影子（即時陰影），預設不加腳下圓影，避免出現兩個影
    this.mesh.castShadow = opts.castShadow ?? true;
    this.mesh.customDepthMaterial = new THREE.MeshDepthMaterial({
      depthPacking: THREE.RGBADepthPacking, map: this.tex, alphaTest,
    });
    // 與鏡頭同樣傾斜 18°，讓精靈正對鏡頭（HD-2D 做法）
    this.pivot = new THREE.Group();
    this.pivot.add(this.mesh);
    this.mesh.rotation.x = -SPRITE_PITCH;

    if (opts.blobShadow) {
      const blob = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, opacity: 0.8, depthWrite: false }),
      );
      blob.rotation.x = -Math.PI / 2;
      blob.position.y = 0.06; // 高於石板地面（頂面約 0.02）
      const r = Math.max(0.9, this.width * 0.62);
      blob.scale.set(r, r * 0.5, 1);
      this.pivot.add(blob);
      this.blob = blob;
    }

    this.row = 0; this.frames = def.cols; this.fps = opts.fps ?? 6; this.t = 0; this.frame = 0;
    this.loop = opts.loop ?? true; // false：播一次後停在最後一格（攻擊動作用）
    this.playing = true;
    this.setFrame(0, 0);
  }

  setRow(row, frames = this.def.cols) {
    if (this.row === row && this.frames === frames) return;
    this.row = row; this.frames = frames; this.t = 0; this.frame = 0;
    this.setFrame(row, 0);
  }

  // 對 2x2 等網格動畫：把整張表當成順序影格
  setFrame(row, col) {
    const { cols, rows } = this.def;
    this.tex.offset.set(col / cols, 1 - (row + 1) / rows);
  }

  setFlip(flip) { this.mesh.scale.x = flip ? -1 : 1; }

  update(dt) {
    if (!this.playing) return;
    this.t += dt;
    const { cols, rows, kind } = this.def;
    if (kind === 'walk') {
      const f = Math.floor(this.t * this.fps) % this.frames;
      if (f !== this.frame) { this.frame = f; this.setFrame(this.row, f); }
    } else {
      const total = cols * rows;
      const n = Math.floor(this.t * this.fps);
      const f = this.loop ? n % total : Math.min(n, total - 1);
      if (f !== this.frame) { this.frame = f; this.setFrame(Math.floor(f / cols), f % cols); }
    }
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.tex.dispose();
  }
}

// 柔和圓形影子貼圖（中心深、邊緣漸淡）
let blobTex = null;
function blobTexture() {
  if (blobTex) return blobTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(0,0,0,1)');
  grad.addColorStop(0.5, 'rgba(0,0,0,0.7)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  blobTex = new THREE.CanvasTexture(c);
  return blobTex;
}

// ---------- 佔位圖（generate2dsprite 素材未放入前使用） ----------
const PAL = {
  swordsman: '#b8322a', mage: '#2e5fc2', archer: '#2f8a4c',
  npc_scholar: '#6b4fa0', npc_merchant: '#c98a2b', npc_guard: '#5b6776',
  npc_granny: '#8c5a7a', npc_child: '#e0703a', npc_chief: '#7a4b2a',
};

function drawPlaceholder(key, def) {
  const cw = def.kind === 'fx' ? 32 : (key.startsWith('monster_wolf') ? 40 : 32);
  const ch = def.kind === 'fx' ? 32 : (key.startsWith('monster') ? 32 : 48);
  const c = document.createElement('canvas');
  c.width = cw * def.cols; c.height = ch * def.rows;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  for (let r = 0; r < def.rows; r++) {
    for (let col = 0; col < def.cols; col++) {
      g.save();
      g.translate(col * cw, r * ch);
      const i = r * def.cols + col;
      if (key.startsWith('hero_') && def.kind === 'walk') drawHuman(g, cw, ch, heroClass(key), ['down', 'left', 'right', 'up'][r], col);
      else if (key.startsWith('hero_')) drawHuman(g, cw, ch, heroClass(key), 'left', i, key.includes('attack'));
      else if (key.startsWith('npc_')) drawHuman(g, cw, ch, key, 'down', i);
      else if (key.startsWith('monster_')) drawMonster(g, cw, ch, key.slice(8), i);
      else drawFx(g, cw, ch, key.slice(3), i);
      g.restore();
    }
  }
  return c;
}

const heroClass = key => key.split('_')[1];
const px = (g, color, x, y, w, h) => { g.fillStyle = color; g.fillRect(x | 0, y | 0, w | 0, h | 0); };

function drawHuman(g, w, h, who, dir, frame, attacking = false) {
  const body = PAL[who] || '#888';
  const bob = frame % 2 ? 1 : 0;
  const cx = w / 2;
  const small = who === 'npc_child';
  const top = small ? 14 : 6;
  const skin = '#f2c9a0';
  const hair = who === 'npc_granny' ? '#ddd' : who === 'npc_chief' ? '#999' : '#5a3a22';
  // 腿
  const step = dir !== 'up' && dir !== 'down' ? (frame % 2 ? 3 : -1) : (frame % 2 ? 2 : 0);
  px(g, '#3a2f2a', cx - 5, h - 12, 4, 10 - (frame % 2 ? 0 : step));
  px(g, '#3a2f2a', cx + 1, h - 12, 4, 10 - (frame % 2 ? step : 0));
  // 身體
  px(g, body, cx - 7, top + 16 + bob, 14, h - top - 26);
  px(g, '#00000033', cx - 7, h - 14 + bob, 14, 3);
  // 頭
  px(g, skin, cx - 6, top + 4 + bob, 12, 12);
  px(g, hair, cx - 7, top + 2 + bob, 14, 5);
  if (dir === 'up') px(g, hair, cx - 7, top + 2 + bob, 14, 12);
  if (dir === 'left') px(g, hair, cx + 3, top + 2 + bob, 4, 10);
  if (dir === 'right') px(g, hair, cx - 7, top + 2 + bob, 4, 10);
  // 眼
  g.fillStyle = '#222';
  if (dir === 'down') { g.fillRect(cx - 4, top + 10 + bob, 2, 3); g.fillRect(cx + 2, top + 10 + bob, 2, 3); }
  if (dir === 'left') g.fillRect(cx - 4, top + 10 + bob, 2, 3);
  if (dir === 'right') g.fillRect(cx + 2, top + 10 + bob, 2, 3);
  // 職業標記
  if (who === 'mage') { px(g, '#1d2f6b', cx - 8, top - 2 + bob, 16, 5); px(g, '#1d2f6b', cx - 4, top - 8 + bob, 8, 7); }
  const wx = dir === 'left' ? cx - 11 : cx + 8;
  const reach = attacking ? (frame % 2 ? -6 : -2) : 0;
  if (who === 'swordsman') px(g, '#d9dde3', wx + (dir === 'left' ? reach : 0), top + 12 + bob, 3, 16);
  if (who === 'mage') { px(g, '#8b5a2b', wx, top + 8 + bob, 2, 26); px(g, '#7fd4ff', wx - 1, top + 5 + bob, 4, 4); }
  if (who === 'archer') { px(g, '#8b5a2b', wx, top + 10 + bob, 2, 20); px(g, '#ddd', wx + (dir === 'left' ? 2 : -1), top + 11 + bob, 1, 18); }
  if (who === 'npc_guard') { px(g, '#aab', cx + 9, top - 2 + bob, 2, 34); px(g, '#ccd', cx + 8, top - 5 + bob, 4, 4); }
  if (who === 'npc_scholar') px(g, '#f3ead2', cx - 11, top + 18 + bob, 6, 8);
  // 「佔位」標籤
  g.fillStyle = '#ffffffcc'; g.fillRect(1, 1, 5, 5); g.fillStyle = '#e33'; g.fillRect(2, 2, 3, 3);
}

function drawMonster(g, w, h, id, frame) {
  const bob = frame % 2;
  if (id === 'slime') {
    const sq = frame % 2 ? 2 : 0;
    px(g, '#3fa64a', 5 - sq, 14 + sq + 2, 22 + sq * 2, 14 - sq);
    px(g, '#5fd35f', 7 - sq, 12 + sq + 2, 18 + sq * 2, 14 - sq);
    px(g, '#a8f5a0', 10, 15 + sq, 4, 3);
    px(g, '#123', 18, 19 + sq, 2, 3); px(g, '#123', 23, 19 + sq, 2, 3);
  } else if (id === 'wolf') {
    px(g, '#6c717b', 6, 12 + bob, 24, 10);
    px(g, '#8a8f99', 26, 8 + bob, 10, 9);
    px(g, '#6c717b', 28, 5 + bob, 3, 4); px(g, '#6c717b', 33, 5 + bob, 3, 4);
    px(g, '#e33', 33, 11 + bob, 2, 2);
    px(g, '#555a63', 2, 12 + bob, 5, 3);
    for (const lx of [8, 13, 22, 27]) px(g, '#555a63', lx, 22, 3, 8 - (lx % 2 ? bob : 0));
  } else if (id === 'boss') {
    // 亂字魔：一本張開的黑色魔書，周圍飄着亂碼
    px(g, '#2a1838', 4, 10 + bob, 24, 16);
    px(g, '#e9dcc0', 6, 12 + bob, 9, 12); px(g, '#e9dcc0', 17, 12 + bob, 9, 12);
    px(g, '#3a2050', 15, 10 + bob, 2, 16);
    for (let i = 0; i < 4; i++) { px(g, '#222', 8, 14 + i * 3 + bob, 5, 1); px(g, '#222', 19, 14 + i * 3 + bob, 5, 1); }
    px(g, '#ff3a5a', 10, 6 + bob, 3, 3); px(g, '#ff3a5a', 19, 6 + bob, 3, 3);
    const glyph = [[2, 4], [27, 3], [1, 26], [28, 24], [14, 2]];
    glyph.forEach(([x, y], i) => px(g, i % 2 ? '#b06cff' : '#6a3cff', x, y + ((frame + i) % 2), 3, 3));
    px(g, '#2a1838', 10, 26, 4, 5); px(g, '#2a1838', 18, 26, 4, 5);
  } else {
    px(g, '#6b8f3a', 10, 8 + bob, 12, 10);
    px(g, '#6b8f3a', 6, 9 + bob, 4, 3); px(g, '#6b8f3a', 22, 9 + bob, 4, 3);
    px(g, '#ff0', 17, 11 + bob, 2, 2); px(g, '#ff0', 21, 11 + bob, 2, 2);
    px(g, '#7a5a2a', 9, 18 + bob, 14, 8);
    px(g, '#3a2f2a', 11, 26, 4, 6); px(g, '#3a2f2a', 18, 26, 4, 6);
    px(g, '#8b5a2b', 24, 10 + bob, 3, 16);
  }
  g.fillStyle = '#ffffffcc'; g.fillRect(1, 1, 5, 5); g.fillStyle = '#e33'; g.fillRect(2, 2, 3, 3);
}

function drawFx(g, w, h, id, frame) {
  const t = (frame + 1) / 4;
  const cx = w / 2, cy = h / 2;
  if (id === 'slash') {
    g.strokeStyle = '#fff'; g.lineWidth = 3;
    g.beginPath(); g.arc(cx, cy, 6 + t * 9, -1.2 + t, 1.2 + t); g.stroke();
  } else if (id === 'fire') {
    for (let i = 0; i < 6; i++) {
      const a = i + frame; const r = 4 + t * 8;
      px(g, i % 2 ? '#ffb020' : '#ff5a1a', cx + Math.cos(a) * r - 3, cy + Math.sin(a) * r - 3, 6, 6);
    }
    px(g, '#fff3b0', cx - 3, cy - 3, 6, 6);
  } else if (id === 'arrow') {
    px(g, '#8b5a2b', 4 + frame * 3, cy, 18, 2); px(g, '#ddd', 22 + frame * 3, cy - 2, 4, 6);
  } else {
    for (let i = 0; i < 5; i++) px(g, i % 2 ? '#9dffb0' : '#fff', 4 + i * 6, h - 4 - t * 24 - (i % 3) * 3, 3, 3);
  }
}
