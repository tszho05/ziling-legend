import * as THREE from 'three';
import { spiritTexture } from './ending.js';
import { sheetEntry } from './world/sprites.js';

// 字靈：有 fx_spirit.png（Codex 生成的發光小精靈）時，用精靈動畫＋下方的成語字；
// 未有圖時，只顯示發光的成語字。回傳的 Group 帶有 material.opacity 以便淡出。
export function makeSpirit(word) {
  const g = new THREE.Group();
  const mats = [];
  const add = (map, sx, sy, y, order = 20) => {
    const m = new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false, depthTest: false });
    const s = new THREE.Sprite(m);
    s.scale.set(sx, sy, 1);
    s.position.y = y;
    s.renderOrder = order;
    g.add(s);
    mats.push(m);
    return s;
  };
  const sheet = sheetEntry('fx_spirit');
  if (sheet) {
    const { tex: base, def } = sheet;
    const tex = base.clone();
    tex.repeat.set(1 / def.cols, 1 / def.rows);
    const body = add(tex, 1.5 * sheet.aspect, 1.5, 0.55);
    const total = def.cols * def.rows, offset = Math.random() * 10;
    body.onBeforeRender = () => {
      const f = Math.floor((performance.now() / 1000 + offset) * 8) % total;
      tex.offset.set((f % def.cols) / def.cols, 1 - (Math.floor(f / def.cols) + 1) / def.rows);
    };
    // 成語字畫在所有精靈之上，字靈重疊時也不會被遮住
    add(spiritTexture(word), 1.6, 0.6, -0.4, 21);
  } else {
    add(spiritTexture(word), 2.1, 0.79, 0);
  }
  g.material = {
    get opacity() { return mats[0].opacity; },
    set opacity(v) { for (const m of mats) m.opacity = v; },
    dispose() { for (const m of mats) { m.map.dispose(); m.dispose(); } },
    map: { dispose() {} },
  };
  return g;
}
