import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// 現成 3D 模型：墨香鎮的房屋用 KayKit Medieval Hexagon Pack（Kay Lousberg，CC0）
// 檔案與授權見 models/kaykit/。樹木、石頭等仍用程式生成的模型。
const HOUSES = [
  'building_home_A_red', 'building_home_B_blue', 'building_market_green',
  'building_tavern_red', 'building_home_A_blue', 'building_home_B_green',
];

const models = {};

export async function preloadModels() {
  const loader = new GLTFLoader();
  await Promise.all(HOUSES.map(async name => {
    try {
      const g = await loader.loadAsync(`models/kaykit/${name}.gltf`);
      g.scene.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
      models[name] = g.scene;
    } catch (e) {
      console.warn('模型載入失敗，改用程式房屋：', name, e);
    }
  }));
}

// 按房屋在地圖上的次序配對模型；縮放到佔地範圍，底部貼地、置中
export function kaykitHouse(o, idx) {
  const src = models[HOUSES[idx % HOUSES.length]];
  if (!src) return null;
  const holder = new THREE.Group();
  holder.add(src.clone(true));
  const b = new THREE.Box3().setFromObject(holder);
  const s = Math.min((o.w + 0.4) / (b.max.x - b.min.x), (o.d + 0.4) / (b.max.z - b.min.z));
  holder.scale.setScalar(s);
  const b2 = new THREE.Box3().setFromObject(holder);
  holder.position.set(o.w / 2 - (b2.min.x + b2.max.x) / 2, -b2.min.y, o.d / 2 - (b2.min.z + b2.max.z) / 2);
  const g = new THREE.Group();
  g.add(holder);
  g.position.set(o.x, 0, o.z);
  g.userData.fadeable = true;
  g.userData.rect = { x: o.x, z: o.z, w: o.w, d: o.d, h: b2.max.y - b2.min.y };
  return g;
}
