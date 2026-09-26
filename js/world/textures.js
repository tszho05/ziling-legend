import * as THREE from 'three';

// 程式生成的像素貼圖（佔位用；之後可換成 generate2dmap / generate2dsprite 生成的地圖素材）
const cache = new Map();

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function make(name, size, draw) {
  if (cache.has(name)) return cache.get(name);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  draw(g, size, rng(name.length * 977 + size));
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestMipmapLinearFilter;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  cache.set(name, tex);
  return tex;
}

const noise = (g, s, r, colors, n = 1) => {
  for (let y = 0; y < s; y += n) for (let x = 0; x < s; x += n) {
    g.fillStyle = colors[(r() * colors.length) | 0];
    g.fillRect(x, y, n, n);
  }
};

export const tex = {
  grass: () => make('grass', 16, (g, s, r) => {
    noise(g, s, r, ['#4f8f3a', '#5a9c40', '#4a8636', '#62a848', '#57953d']);
    for (let i = 0; i < 6; i++) { g.fillStyle = '#76bd52'; g.fillRect((r() * s) | 0, (r() * s) | 0, 1, 2); }
  }),
  flowers: () => make('flowers', 16, (g, s, r) => {
    noise(g, s, r, ['#4f8f3a', '#5a9c40', '#4a8636', '#57953d']);
    for (let i = 0; i < 4; i++) { g.fillStyle = ['#f5e663', '#f28cb1', '#fff'][i % 3]; g.fillRect((r() * s) | 0, (r() * s) | 0, 2, 2); }
  }),
  cobble: () => make('cobble', 16, (g, s, r) => {
    g.fillStyle = '#6f6a63'; g.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 4) for (let x = (y / 4) % 2 ? 2 : 0; x < s + 4; x += 4) {
      g.fillStyle = ['#a39c90', '#958e83', '#aea79a', '#8c867c'][(r() * 4) | 0];
      g.fillRect(x, y, 3, 3);
    }
  }),
  dirt: () => make('dirt', 16, (g, s, r) => noise(g, s, r, ['#9a7a4f', '#8f7047', '#a58456', '#86683f'])),
  stoneWall: () => make('stoneWall', 16, (g, s, r) => {
    g.fillStyle = '#5c574f'; g.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 4) for (let x = (y / 4) % 2 ? -3 : 0; x < s; x += 6) {
      g.fillStyle = ['#8d867a', '#9a9386', '#827b70'][(r() * 3) | 0];
      g.fillRect(x, y, 5, 3);
    }
  }),
  plaster: () => make('plaster', 16, (g, s, r) => {
    noise(g, s, r, ['#e8dcc0', '#e2d5b8', '#ede2c8']);
    g.fillStyle = '#6b4a2b'; g.fillRect(0, 0, 2, s); g.fillRect(s - 2, 0, 2, s); g.fillRect(0, 7, s, 2);
  }),
  roof: (hue = 'red') => make('roof' + hue, 16, (g, s, r) => {
    const cols = { red: ['#9c3b2e', '#b04634', '#8a3226'], blue: ['#3b5c9c', '#466bb0', '#324f8a'], green: ['#3b7a4a', '#468c55', '#326640'] }[hue];
    for (let y = 0; y < s; y += 3) for (let x = (y / 3) % 2 ? -2 : 0; x < s; x += 4) {
      g.fillStyle = cols[(r() * 3) | 0]; g.fillRect(x, y, 4, 3);
      g.fillStyle = '#00000044'; g.fillRect(x, y + 2, 4, 1);
    }
  }),
  wood: () => make('wood', 16, (g, s, r) => {
    noise(g, s, r, ['#7a5230', '#6e4a2b', '#835a35']);
    g.fillStyle = '#4e3320'; for (let x = 0; x < s; x += 4) g.fillRect(x, 0, 1, s);
  }),
  leaves: () => make('leaves', 16, (g, s, r) => noise(g, s, r, ['#2f6b2f', '#3a7d35', '#285c28', '#4a8f3c'], 2)),
  water: () => make('water', 16, (g, s, r) => {
    noise(g, s, r, ['#3d7fc2', '#4a8fd4', '#3775b5'], 2);
    g.fillStyle = '#bfe3ff'; for (let i = 0; i < 3; i++) g.fillRect((r() * s) | 0, (r() * s) | 0, 3, 1);
  }),
  rock: () => make('rock', 16, (g, s, r) => noise(g, s, r, ['#8a8a86', '#7b7b77', '#999994', '#6f6f6b'], 2)),
};
