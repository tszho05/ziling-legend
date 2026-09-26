import * as THREE from 'three';
import { tex } from './textures.js';

// 環境佈景：天空、雲、遠山、草叢

const hash = (a, b = 0) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };

// 天空半球：頂部藍、地平線偏暖
export function addSky(scene, { top = 0x6fb2ec, horizon = 0xf3e6c8 } = {}) {
  const geo = new THREE.SphereGeometry(160, 24, 12);
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(top) }, horizon: { value: new THREE.Color(horizon) } },
    vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform vec3 top; uniform vec3 horizon; varying vec3 vP;
      void main(){ float t = clamp(vP.y * 1.6 + 0.1, 0.0, 1.0); gl_FragColor = vec4(mix(horizon, top, pow(t, 0.8)), 1.0);
      #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(geo, m);
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  scene.add(sky);
  return sky;
}

let cloudTex = null;
function cloudTexture() {
  if (cloudTex) return cloudTex;
  const c = document.createElement('canvas');
  c.width = 128; c.height = 64;
  const g = c.getContext('2d');
  for (const [x, y, r] of [[40, 38, 22], [64, 30, 26], [88, 38, 20], [56, 44, 18], [76, 44, 18]]) {
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, 'rgba(255,255,255,0.95)');
    grad.addColorStop(0.7, 'rgba(255,250,240,0.7)');
    grad.addColorStop(1, 'rgba(255,250,240,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 64);
  }
  cloudTex = new THREE.CanvasTexture(c);
  cloudTex.colorSpace = THREE.SRGBColorSpace;
  return cloudTex;
}

// 慢慢飄動的雲；回傳 update(dt)
export function addClouds(scene, center, count = 8) {
  const clouds = [];
  for (let i = 0; i < count; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTexture(), transparent: true, depthWrite: false, fog: false, opacity: 0.9 }));
    const w = 14 + hash(i, 1) * 12;
    s.scale.set(w, w * 0.45, 1);
    s.position.set(center.x - 60 + hash(i, 2) * 120, 16 + hash(i, 3) * 10, center.z - 55 - hash(i, 4) * 25);
    scene.add(s);
    clouds.push(s);
  }
  return dt => {
    for (const s of clouds) {
      s.position.x += dt * 0.6;
      if (s.position.x > center.x + 70) s.position.x = center.x - 70;
    }
  };
}

// 遠山：一排帶霧的低多邊形山丘
export function addHills(scene, center, radius) {
  const m1 = new THREE.MeshStandardMaterial({ color: 0x7fae72, roughness: 1, flatShading: true });
  const m2 = new THREE.MeshStandardMaterial({ color: 0x96b9a0, roughness: 1, flatShading: true });
  for (let i = 0; i < 14; i++) {
    const far = i % 2;
    const hill = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), far ? m2 : m1);
    const r = 10 + hash(i, 5) * 10;
    hill.scale.set(r * 1.6, r * (0.22 + hash(i, 6) * 0.18), r);
    hill.position.set(center.x - radius * 1.8 + i * radius * 0.28, -1, center.z - radius - 12 - far * 16 - hash(i, 7) * 6);
    scene.add(hill);
  }
}

// 草叢貼圖：幾根葉片（透明背景）
let tuftTex = {};
function tuftTexture(kind) {
  if (tuftTex[kind]) return tuftTex[kind];
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d');
  const blades = kind === 'flower' ? 7 : 10;
  for (let i = 0; i < blades; i++) {
    const x = 4 + i * (24 / blades) + (i % 2), h = 12 + ((i * 7) % 12);
    g.fillStyle = i % 3 ? '#5fa846' : '#7cc45a';
    g.fillRect(x, 32 - h, 2, h);
    g.fillStyle = '#8fd66a';
    g.fillRect(x, 32 - h, 1, 3);
  }
  if (kind === 'flower') {
    for (const [x, y, col] of [[8, 10, '#ffe36b'], [18, 6, '#ff9ec2'], [25, 12, '#ffffff']]) {
      g.fillStyle = col; g.fillRect(x - 2, y, 5, 1); g.fillRect(x, y - 2, 1, 5);
      g.fillStyle = '#f7a531'; g.fillRect(x, y, 1, 1);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  return (tuftTex[kind] = t);
}

// 在指定位置撒草叢（兩片交叉的小平面，InstancedMesh）
export function addTufts(scene, spots, kind = 'grass') {
  if (!spots.length) return;
  const a = new THREE.PlaneGeometry(0.55, 0.45); a.translate(0, 0.225, 0);
  const b = a.clone(); b.rotateY(Math.PI / 2);
  const geo = mergeTwo(a, b);
  const m = new THREE.MeshStandardMaterial({ map: tuftTexture(kind), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 1 });
  const inst = new THREE.InstancedMesh(geo, m, spots.length);
  const d = new THREE.Object3D();
  spots.forEach(([x, z, y = 0], i) => {
    d.position.set(x, y, z);
    d.rotation.y = hash(x, z) * Math.PI;
    const s = 0.8 + hash(z, x) * 0.6;
    d.scale.set(s, s, s);
    d.updateMatrix();
    inst.setMatrixAt(i, d.matrix);
  });
  inst.receiveShadow = true;
  scene.add(inst);
}

function mergeTwo(a, b) {
  const geo = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'uv']) {
    const A = a.attributes[name], B = b.attributes[name];
    const arr = new Float32Array(A.array.length + B.array.length);
    arr.set(A.array); arr.set(B.array, A.array.length);
    geo.setAttribute(name, new THREE.BufferAttribute(arr, A.itemSize));
  }
  const ia = a.index.array, ib = b.index.array, off = a.attributes.position.count;
  geo.setIndex([...ia, ...Array.from(ib, i => i + off)]);
  return geo;
}

// 水面貼圖緩慢流動
export function animateWater(t) {
  const w = tex.water();
  w.offset.set(t * 0.03, t * 0.012);
}

export { hash };
