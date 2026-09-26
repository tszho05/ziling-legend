import * as THREE from 'three';
import { tex } from './textures.js';
import { hash } from './props.js';

// 精細效果：柔和過渡的地面、流動水面、噴水粒子、花瓣光點、陽光光柱

// ---------------- 柔和過渡的地面 ----------------
// 以一整張畫布畫出整個地圖的地面：各種地面之間用帶噪點的柔和邊界混合，
// 保留 32 像素貼圖的像素感；水面下畫成濕泥河岸。
const S = 32; // 每格像素

function pixelNoise(x, y) {
  // 以 4×4 像素為單位的噪點，邊界呈像素狀起伏
  const bx = x >> 2, by = y >> 2;
  const s = Math.sin(bx * 127.1 + by * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function maskFor(layout, test, soft, bias) {
  const { W, D } = layout;
  const small = document.createElement('canvas');
  small.width = W + 2; small.height = D + 2;
  const sg = small.getContext('2d');
  sg.fillStyle = '#000'; sg.fillRect(0, 0, W + 2, D + 2);
  sg.fillStyle = '#fff';
  for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) if (test(layout.ground[z][x], x, z)) sg.fillRect(x + 1, z + 1, 1, 1);
  const big = document.createElement('canvas');
  big.width = W * S; big.height = D * S;
  const bg = big.getContext('2d');
  bg.imageSmoothingEnabled = true;
  bg.imageSmoothingQuality = 'high';
  // 放大時自然產生約一格寬的漸變
  bg.drawImage(small, 1, 1, W, D, 0, 0, W * S, D * S);
  const img = bg.getImageData(0, 0, big.width, big.height);
  const d = img.data;
  for (let y = 0, i = 0; y < big.height; y++) for (let x = 0; x < big.width; x++, i += 4) {
    const v = d[i] / 255 + (pixelNoise(x, y) - 0.5) * soft + bias;
    const a = Math.min(1, Math.max(0, (v - 0.42) / 0.16));
    d[i] = d[i + 1] = d[i + 2] = 255;
    d[i + 3] = a * 255;
  }
  bg.putImageData(img, 0, 0);
  return big;
}

function layer(ctx, texImage, mask) {
  const c = document.createElement('canvas');
  c.width = mask.width; c.height = mask.height;
  const g = c.getContext('2d');
  g.fillStyle = g.createPattern(texImage, 'repeat');
  g.fillRect(0, 0, c.width, c.height);
  g.globalCompositeOperation = 'destination-in';
  g.drawImage(mask, 0, 0);
  ctx.drawImage(c, 0, 0);
}

export function makeBlendedGround(layout) {
  const { W, D } = layout;
  const c = document.createElement('canvas');
  c.width = W * S; c.height = D * S;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  // 草地底色 + 花草格
  g.fillStyle = g.createPattern(tex.grass().image, 'repeat');
  g.fillRect(0, 0, c.width, c.height);
  for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
    if (layout.ground[z][x] === 'flowers') g.drawImage(tex.flowers().image, x * S, z * S);
  }
  // 濕泥河岸（比水面範圍稍大）→ 泥路 → 石板
  layer(g, tex.mud().image, maskFor(layout, t => t === 'water', 0.5, 0.18));
  const dirtMask = maskFor(layout, t => t === 'dirt', 0.55, 0);
  layer(g, tex.dirt().image, dirtMask);
  if (layout.ground.some(r => r.includes('cobble'))) layer(g, tex.cobble().image, maskFor(layout, t => t === 'cobble', 0.3, 0));
  // 路邊碎石：在泥路邊緣帶撒小石子
  const md = dirtMask.getContext('2d').getImageData(0, 0, dirtMask.width, dirtMask.height).data;
  for (let y = 0; y < c.height; y += 3) for (let x = 0; x < c.width; x += 3) {
    const a = md[(y * c.width + x) * 4 + 3];
    if (a > 20 && a < 200 && pixelNoise(x * 7, y * 5) > 0.93) {
      const col = pixelNoise(x, y * 3) > 0.5 ? '#bdb3a2' : '#8e8576';
      g.fillStyle = col; g.fillRect(x, y, 2, 2);
      g.fillStyle = '#e3dccd'; g.fillRect(x, y, 1, 1);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.anisotropy = 8;
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ map: t, roughness: 1 }));
  plane.rotation.x = -Math.PI / 2;
  plane.position.set(W / 2, 0, D / 2);
  plane.receiveShadow = true;
  return plane;
}

// 泥路邊緣的格子（用來多撒小草）
export function pathEdgeSpots(layout) {
  const spots = [];
  const { W, D, ground, solid } = layout;
  for (let z = 1; z < D - 1; z++) for (let x = 1; x < W - 1; x++) {
    if (ground[z][x] === 'dirt' || ground[z][x] === 'water' || solid[z][x]) continue;
    const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].find(([dx, dz]) => ground[z + dz][x + dx] === 'dirt');
    if (!near) continue;
    spots.push([x + 0.5 + near[0] * 0.3 + (hash(x, z) - 0.5) * 0.4, z + 0.5 + near[1] * 0.3 + (hash(z, x) - 0.5) * 0.4]);
  }
  return spots;
}

// ---------------- 流動水面 ----------------
const waterMats = [];
export function waterMaterial({ flow = [0.3, 0], shallow = 0x3a8bc8, deep = 0x174a8a, size = [1, 1], alpha = 0.9 } = {}) {
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: {
      time: { value: 0 }, flow: { value: new THREE.Vector2(...flow) }, size: { value: new THREE.Vector2(...size) },
      shallow: { value: new THREE.Color(shallow) }, deep: { value: new THREE.Color(deep) }, alpha: { value: alpha },
      sky: { value: new THREE.Color(0xdff2ff) },
    },
    vertexShader: `
      varying vec2 vUv; varying vec3 vWorld; varying vec3 vView;
      void main(){
        vUv = uv;
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        vView = normalize(cameraPosition - w.xyz);
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: `
      uniform float time; uniform vec2 flow; uniform vec2 size; uniform vec3 shallow; uniform vec3 deep; uniform vec3 sky; uniform float alpha;
      varying vec2 vUv; varying vec3 vWorld; varying vec3 vView;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
      void main(){
        vec2 p = vWorld.xz - flow * time;
        float w = n(p * 2.2) * 0.6 + n(p * 5.0 + time * 0.3) * 0.4;
        // 像素化的波紋（配合像素風）
        vec2 pp = floor(vWorld.xz * 16.0) / 16.0 - flow * time;
        float ripple = sin(pp.x * 6.0 + n(pp * 1.5) * 6.0 + time * 1.5) * sin(pp.y * 5.0 - time * 1.1);
        vec3 col = mix(deep, shallow, 0.35 + w * 0.5);
        // 天空反光（斜看時較亮）
        float fres = pow(1.0 - clamp(vView.y, 0.0, 1.0), 2.0);
        col = mix(col, sky, fres * 0.22 + 0.03);
        // 閃光
        col += vec3(1.0) * smoothstep(0.88, 0.98, ripple * 0.5 + 0.5 + (w - 0.5) * 0.4) * 0.35;
        // 岸邊白色水沫
        vec2 e = min(vUv, 1.0 - vUv) * size;
        float edge = min(e.x, e.y);
        float foam = smoothstep(0.12, 0.0, edge + (n(vWorld.xz * 6.0 + time) - 0.5) * 0.08);
        col = mix(col, vec3(0.95, 0.98, 1.0), foam * 0.6);
        gl_FragColor = vec4(col, mix(alpha, 1.0, foam * 0.5));
        #include <colorspace_fragment>
      }`,
  });
  waterMats.push(m);
  return m;
}

export function tickWater(t) { for (const m of waterMats) m.uniforms.time.value = t; }

// 矩形水面（河流、池塘）
export function makeWaterRect(x, z, w, d, opts = {}) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), waterMaterial({ ...opts, size: [w, d] }));
  m.rotation.x = -Math.PI / 2;
  m.position.set(x + w / 2, opts.y ?? 0.03, z + d / 2);
  m.renderOrder = 1;
  return m;
}

// 圓形水面（噴水池）
export function makeWaterDisc(r, opts = {}) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(r, 32), waterMaterial({ flow: [0.05, 0.03], alpha: 0.78, ...opts, size: [r * 2, r * 2] }));
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = 1;
  return m;
}

// ---------------- 粒子共用 ----------------
function dotTexture(inner, outer) {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, inner); grad.addColorStop(0.5, outer); grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 32, 32);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function petalTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  const g = c.getContext('2d');
  g.fillStyle = '#ffc6d9'; g.fillRect(5, 3, 6, 10); g.fillRect(3, 5, 10, 6);
  g.fillStyle = '#fff0f5'; g.fillRect(6, 5, 3, 3);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  return t;
}

function points(count, material) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  const p = new THREE.Points(geo, material);
  p.frustumCulled = false;
  return p;
}

// ---------------- 噴水池：噴水、水花、漣漪 ----------------
// 回傳 { group, tick(t, dt) }；group 以噴水池中心為原點
export function makeFountainSpray({ topY = 1.85, bowlR = 0.45, bowlY = 1.62, basinY = 0.46, basinR = 0.9 }) {
  const group = new THREE.Group();
  const N = 220;
  const drops = points(N, new THREE.PointsMaterial({ map: dotTexture('rgba(255,255,255,1)', 'rgba(190,230,255,0.7)'), size: 0.09, transparent: true, depthWrite: false, color: 0xe8f6ff }));
  group.add(drops);
  const pos = drops.geometry.attributes.position.array;
  const vel = new Float32Array(N * 3), life = new Float32Array(N);
  const spawn = i => {
    const a = Math.random() * Math.PI * 2;
    if (i % 3 === 0) {
      // 頂部噴泉：向上噴再落到上層水盆
      pos[i * 3] = 0; pos[i * 3 + 1] = topY; pos[i * 3 + 2] = 0;
      const sp = 0.25 + Math.random() * 0.25;
      vel[i * 3] = Math.cos(a) * sp; vel[i * 3 + 1] = 1.6 + Math.random() * 0.6; vel[i * 3 + 2] = Math.sin(a) * sp;
    } else {
      // 上層水盆邊溢出，落到下層水池
      pos[i * 3] = Math.cos(a) * bowlR; pos[i * 3 + 1] = bowlY; pos[i * 3 + 2] = Math.sin(a) * bowlR;
      vel[i * 3] = Math.cos(a) * 0.35; vel[i * 3 + 1] = 0.1; vel[i * 3 + 2] = Math.sin(a) * 0.35;
    }
    life[i] = 0;
  };
  for (let i = 0; i < N; i++) { spawn(i); life[i] = -Math.random() * 1.5; }

  // 水花：落水處濺起的小點
  const M = 90;
  const splash = points(M, new THREE.PointsMaterial({ map: dotTexture('rgba(255,255,255,1)', 'rgba(220,240,255,0.6)'), size: 0.06, transparent: true, depthWrite: false }));
  group.add(splash);
  const sp = splash.geometry.attributes.position.array;
  const sv = new Float32Array(M * 3);
  let sNext = 0;
  const emitSplash = (x, y, z) => {
    for (let k = 0; k < 2; k++) {
      const j = sNext = (sNext + 1) % M;
      sp[j * 3] = x; sp[j * 3 + 1] = y; sp[j * 3 + 2] = z;
      const a = Math.random() * Math.PI * 2, s = 0.3 + Math.random() * 0.4;
      sv[j * 3] = Math.cos(a) * s; sv[j * 3 + 1] = 0.6 + Math.random() * 0.6; sv[j * 3 + 2] = Math.sin(a) * s;
    }
  };

  // 漣漪圈
  const rings = [];
  const ringMat = () => new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false });
  for (let i = 0; i < 10; i++) {
    const r = new THREE.Mesh(new THREE.RingGeometry(0.06, 0.09, 20), ringMat());
    r.rotation.x = -Math.PI / 2;
    r.userData.age = 99;
    group.add(r);
    rings.push(r);
  }
  let rNext = 0;
  const emitRing = (x, y, z) => {
    const r = rings[rNext = (rNext + 1) % rings.length];
    r.position.set(x, y + 0.012, z);
    r.userData.age = 0;
  };

  const tick = (t, dt) => {
    dt = Math.min(dt, 0.05);
    for (let i = 0; i < N; i++) {
      life[i] += dt;
      if (life[i] < 0) { pos[i * 3 + 1] = -10; continue; }
      vel[i * 3 + 1] -= 4.2 * dt;
      pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
      const r = Math.hypot(x, z);
      const landBowl = vel[i * 3 + 1] < 0 && y <= bowlY && r < bowlR && i % 3 === 0;
      const landBasin = y <= basinY && r < basinR;
      if (landBowl || landBasin) {
        const ly = landBowl ? bowlY : basinY;
        if (Math.random() < 0.35) emitSplash(x, ly, z);
        if (Math.random() < 0.05) emitRing(x, ly, z);
        spawn(i);
      } else if (y < 0) spawn(i);
    }
    drops.geometry.attributes.position.needsUpdate = true;
    for (let j = 0; j < M; j++) {
      if (sp[j * 3 + 1] < -5) continue;
      sv[j * 3 + 1] -= 5 * dt;
      sp[j * 3] += sv[j * 3] * dt; sp[j * 3 + 1] += sv[j * 3 + 1] * dt; sp[j * 3 + 2] += sv[j * 3 + 2] * dt;
      if (sv[j * 3 + 1] < 0 && sp[j * 3 + 1] < basinY - 0.02) sp[j * 3 + 1] = -10;
    }
    splash.geometry.attributes.position.needsUpdate = true;
    for (const r of rings) {
      r.userData.age += dt;
      const a = r.userData.age;
      r.visible = a < 1.2;
      if (!r.visible) continue;
      const s = 1 + a * 4;
      r.scale.set(s, s, 1);
      r.material.opacity = 0.55 * (1 - a / 1.2);
    }
  };
  return { group, tick };
}

// 池底錢幣
export function makeCoins(n, radius, y) {
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color: 0xf2c230, metalness: 0.6, roughness: 0.35, emissive: 0x5a4000, emissiveIntensity: 0.3 });
  for (let i = 0; i < n; i++) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.012, 12), m);
    const a = hash(i, 3) * Math.PI * 2, r = 0.3 + hash(i, 4) * (radius - 0.35);
    c.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
    c.rotation.set((hash(i, 5) - 0.5) * 0.4, 0, (hash(i, 6) - 0.5) * 0.4);
    g.add(c);
  }
  return g;
}

// ---------------- 環境氣氛：花瓣、光點、陽光光柱 ----------------
// 跟着玩家附近飄動；回傳 { group, tick(t, dt, focus) }
export function makeAmbience({ petals = 110, motes = 50 } = {}) {
  const group = new THREE.Group();
  const P = points(petals, new THREE.PointsMaterial({ map: petalTexture(), size: 0.13, transparent: true, alphaTest: 0.3, depthWrite: false }));
  const L = points(motes, new THREE.PointsMaterial({ map: dotTexture('rgba(255,250,200,1)', 'rgba(255,220,120,0.5)'), size: 0.16, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  group.add(P, L);
  const pp = P.geometry.attributes.position.array, lp = L.geometry.attributes.position.array;
  const seed = new Float32Array(Math.max(petals, motes));
  for (let i = 0; i < seed.length; i++) seed[i] = Math.random() * 100;
  const box = { x: 22, y: 5, z: 16 };
  const wrap = (v, c, s) => c - s / 2 + ((((v - (c - s / 2)) % s) + s) % s);
  for (let i = 0; i < petals; i++) { pp[i * 3] = (Math.random() - 0.5) * box.x; pp[i * 3 + 1] = Math.random() * box.y; pp[i * 3 + 2] = (Math.random() - 0.5) * box.z; }
  for (let i = 0; i < motes; i++) { lp[i * 3] = (Math.random() - 0.5) * box.x; lp[i * 3 + 1] = 0.3 + Math.random() * 2.5; lp[i * 3 + 2] = (Math.random() - 0.5) * box.z; }
  const tick = (t, dt, focus) => {
    if (!focus) return;
    dt = Math.min(dt, 0.05);
    for (let i = 0; i < petals; i++) {
      const s = seed[i];
      pp[i * 3] += (0.55 + Math.sin(t * 0.7 + s) * 0.35) * dt;
      pp[i * 3 + 1] -= (0.25 + (s % 1) * 0.2) * dt;
      pp[i * 3 + 2] += Math.sin(t * 1.3 + s * 2) * 0.25 * dt;
      if (pp[i * 3 + 1] < 0.02) pp[i * 3 + 1] = box.y;
      pp[i * 3] = wrap(pp[i * 3], focus.x, box.x);
      pp[i * 3 + 2] = wrap(pp[i * 3 + 2], focus.z, box.z);
    }
    for (let i = 0; i < motes; i++) {
      const s = seed[i];
      lp[i * 3] = wrap(lp[i * 3] + Math.sin(t * 0.5 + s) * 0.15 * dt, focus.x, box.x);
      lp[i * 3 + 1] += Math.sin(t * 0.9 + s * 3) * 0.12 * dt;
      lp[i * 3 + 2] = wrap(lp[i * 3 + 2] + Math.cos(t * 0.4 + s) * 0.15 * dt, focus.z, box.z);
    }
    P.geometry.attributes.position.needsUpdate = true;
    L.geometry.attributes.position.needsUpdate = true;
    L.material.opacity = 0.7 + Math.sin(t * 1.7) * 0.25;
  };
  return { group, tick };
}

// 森林裏斜照的陽光光柱
export function makeSunbeams(spots) {
  const c = document.createElement('canvas');
  c.width = 32; c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, 'rgba(255,240,200,0.0)');
  grad.addColorStop(0.35, 'rgba(255,236,180,0.55)');
  grad.addColorStop(1, 'rgba(255,236,180,0.0)');
  g.fillStyle = grad; g.fillRect(0, 0, 32, 128);
  const side = g.createLinearGradient(0, 0, 32, 0);
  side.addColorStop(0, 'rgba(0,0,0,1)'); side.addColorStop(0.5, 'rgba(0,0,0,0)'); side.addColorStop(1, 'rgba(0,0,0,1)');
  g.globalCompositeOperation = 'destination-out';
  g.fillStyle = side; g.fillRect(0, 0, 32, 128);
  const t = new THREE.CanvasTexture(c);
  const group = new THREE.Group();
  const beams = spots.map(([x, z], i) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 5.5), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, opacity: 0.35, fog: false }));
    m.position.set(x, 2.4, z);
    m.rotation.set(-0.18, 0.2, -0.45); // 順着太陽方向斜照
    group.add(m);
    return m;
  });
  const tick = t2 => beams.forEach((b, i) => { b.material.opacity = 0.22 + Math.sin(t2 * 0.6 + i * 1.7) * 0.1; });
  return { group, tick };
}
