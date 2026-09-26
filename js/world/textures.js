import * as THREE from 'three';

// 程式生成的 32×32 像素貼圖（每格地磚 = 一張貼圖）。帶明暗層次，保持像素風。
const cache = new Map();

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
const hash = str => [...str].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

function make(name, draw, size = 32) {
  if (cache.has(name)) return cache.get(name);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  draw(g, size, rng(hash(name)));
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestMipmapLinearFilter;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  cache.set(name, tex);
  return tex;
}

const px = (g, c, x, y, w = 1, h = 1) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
const pick = (r, arr) => arr[(r() * arr.length) | 0];
function noise(g, s, r, colors, n = 1) {
  for (let y = 0; y < s; y += n) for (let x = 0; x < s; x += n) px(g, pick(r, colors), x, y, n, n);
}
// 可無縫平鋪的圓點
function blob(g, s, cx, cy, rad, color) {
  g.fillStyle = color;
  for (let y = -rad; y <= rad; y++) for (let x = -rad; x <= rad; x++) {
    if (x * x + y * y <= rad * rad + rad * 0.5) g.fillRect((cx + x + s) % s, (cy + y + s) % s, 1, 1);
  }
}

export const tex = {
  grass: () => make('grass', (g, s, r) => {
    noise(g, s, r, ['#5da443', '#62aa47', '#58a040', '#67b04b'], 2);
    for (let i = 0; i < 10; i++) blob(g, s, (r() * s) | 0, (r() * s) | 0, 2 + ((r() * 2) | 0), pick(r, ['#6fba50', '#529639']));
    for (let i = 0; i < 26; i++) {
      const x = (r() * s) | 0, y = (r() * s) | 0;
      px(g, '#86cc62', x, y, 1, 2); px(g, '#4a8a34', x, (y + 2) % s, 1, 1);
    }
  }),
  flowers: () => make('flowers', (g, s, r) => {
    g.drawImage(tex.grass().image, 0, 0);
    for (let i = 0; i < 6; i++) {
      const x = 2 + ((r() * (s - 4)) | 0), y = 2 + ((r() * (s - 4)) | 0);
      const c = pick(r, ['#ffe36b', '#ff9ec2', '#ffffff', '#c9a6ff']);
      px(g, c, x - 1, y, 3, 1); px(g, c, x, y - 1, 1, 3); px(g, '#f7a531', x, y);
    }
  }),
  cobble: () => make('cobble', (g, s, r) => {
    px(g, '#7c7468', 0, 0, s, s);
    // 圓潤石塊：左上亮、右下暗
    for (let row = 0; row < 4; row++) for (let col = 0; col < 4; col++) {
      const ox = col * 8 + (row % 2 ? 4 : 0), oy = row * 8;
      const base = pick(r, ['#b5ab9a', '#aaa190', '#bfb5a3', '#a39a8a']);
      for (let y = 1; y < 7; y++) for (let x = 1; x < 7; x++) {
        if ((x === 1 || x === 6) && (y === 1 || y === 6)) continue;
        let c = base;
        if (x + y <= 4) c = '#d0c7b5';
        else if (x + y >= 10) c = '#8f8677';
        px(g, c, (ox + x) % s, oy + y);
      }
    }
  }),
  dirt: () => make('dirt', (g, s, r) => {
    noise(g, s, r, ['#b08a58', '#a8824f', '#b99462', '#a07b4a'], 2);
    for (let i = 0; i < 14; i++) px(g, pick(r, ['#8c6a3e', '#c9a574']), (r() * s) | 0, (r() * s) | 0, 2, 1);
  }),
  stoneWall: () => make('stoneWall', (g, s, r) => {
    px(g, '#6a6258', 0, 0, s, s);
    for (let row = 0; row < 4; row++) for (let col = -1; col < 3; col++) {
      const ox = col * 12 + (row % 2 ? 6 : 0), oy = row * 8;
      const base = pick(r, ['#a59c8c', '#9b9282', '#aea594']);
      for (let y = 1; y < 7; y++) for (let x = 1; x < 11; x++) {
        const c = y === 1 ? '#c2b9a8' : y === 6 ? '#827a6c' : base;
        px(g, c, ((ox + x) % s + s) % s, oy + y);
      }
    }
  }),
  stoneBase: () => make('stoneBase', (g, s, r) => {
    px(g, '#5e574e', 0, 0, s, s);
    for (let i = 0; i < 9; i++) {
      const x = (r() * s) | 0, y = (r() * s) | 0, w = 6 + ((r() * 6) | 0), h = 5 + ((r() * 4) | 0);
      const base = pick(r, ['#948b7b', '#8a8172', '#9e9584']);
      for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
        const c = yy === 0 ? '#b3aa98' : yy === h - 1 ? '#6f675b' : base;
        px(g, c, (x + xx) % s, (y + yy) % s);
      }
    }
  }),
  plaster: (tint = 'cream') => make('plaster' + tint, (g, s, r) => {
    const cols = {
      cream: ['#f1e6cc', '#ece0c4', '#f5ebd4', '#e8dbbd'],
      rose: ['#f3dcd2', '#eed4c9', '#f6e3da', '#e9cdc1'],
      sky: ['#dfe7ea', '#d8e1e5', '#e6edef', '#d2dbdf'],
    }[tint];
    noise(g, s, r, cols, 2);
    for (let i = 0; i < 5; i++) px(g, '#d9caa8', (r() * s) | 0, (r() * s) | 0, 3, 1);
  }),
  roof: (hue = 'red') => make('roof' + hue, (g, s, r) => {
    const cols = {
      red: ['#b8503a', '#c45a42', '#a84632', '#d06a4e', '#8e3a2a'],
      blue: ['#4a6fae', '#557bbb', '#3f629e', '#6a8dc8', '#34507f'],
      green: ['#4f8a55', '#5a9660', '#447a4a', '#6aa66f', '#355f3a'],
    }[hue];
    // 魚鱗瓦：每排錯開，下緣有陰影、上緣有光
    for (let row = 0; row < 4; row++) for (let col = -1; col < 5; col++) {
      const ox = col * 8 + (row % 2 ? 4 : 0), oy = row * 8;
      const base = pick(r, cols.slice(0, 3));
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
        const edge = y >= 6 && (x === 0 || x === 7);
        let c = base;
        if (y === 0) c = cols[3];
        if (y >= 7 || edge) c = cols[4];
        px(g, c, ((ox + x) % s + s) % s, oy + y);
      }
    }
  }),
  wood: () => make('wood', (g, s, r) => {
    for (let x = 0; x < s; x += 8) {
      const base = pick(r, ['#8a5d36', '#7f5530', '#94653c']);
      px(g, base, x, 0, 8, s);
      px(g, '#5c3b21', x, 0, 1, s);
      px(g, '#a4764a', x + 1, 0, 1, s);
      for (let i = 0; i < 4; i++) px(g, '#6e4829', x + 2 + ((r() * 5) | 0), (r() * s) | 0, 1, 4);
    }
  }),
  beam: () => make('beam', (g, s, r) => {
    noise(g, s, r, ['#5a3a22', '#62402a', '#523420'], 2);
    for (let i = 0; i < 6; i++) px(g, '#452c19', 0, (r() * s) | 0, s, 1);
  }),
  bark: () => make('bark', (g, s, r) => {
    noise(g, s, r, ['#6e4a2e', '#654329', '#785134'], 2);
    for (let x = 0; x < s; x += 4) for (let i = 0; i < 3; i++) px(g, '#4a301c', x + ((r() * 2) | 0), (r() * s) | 0, 1, 6);
  }),
  leaves: (tone = 'mid') => make('leaves' + tone, (g, s, r) => {
    const pal = {
      light: ['#6fb54f', '#7cc25a', '#5fa343', '#8fd06a'],
      mid: ['#4f9a3f', '#5aa648', '#448836', '#6cb851'],
      pine: ['#2f6b45', '#377850', '#285c3b', '#44895c'],
    }[tone];
    px(g, pal[2], 0, 0, s, s);
    for (let i = 0; i < 26; i++) blob(g, s, (r() * s) | 0, (r() * s) | 0, 2 + ((r() * 2) | 0), pick(r, pal.slice(0, 2)));
    for (let i = 0; i < 14; i++) blob(g, s, (r() * s) | 0, (r() * s) | 0, 1, pal[3]);
  }),
  mud: () => make('mud', (g, s, r) => {
    noise(g, s, r, ['#7d6a4c', '#746246', '#86735a', '#6b5a40'], 2);
    for (let i = 0; i < 10; i++) px(g, pick(r, ['#9a8a70', '#5e4f38']), (r() * s) | 0, (r() * s) | 0, 2, 1);
  }),
  water: () => make('water', (g, s, r) => {
    noise(g, s, r, ['#4a93d6', '#529ddf', '#4389cb'], 2);
    for (let i = 0; i < 6; i++) px(g, '#cdeaff', (r() * s) | 0, (r() * s) | 0, 4, 1);
  }),
  rock: () => make('rock', (g, s, r) => {
    noise(g, s, r, ['#9a978f', '#8e8b83', '#a6a39b', '#84817a'], 2);
    for (let i = 0; i < 8; i++) px(g, '#6f6c66', (r() * s) | 0, (r() * s) | 0, 3, 1);
  }),
};
