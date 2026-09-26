// 鍵盤與觸控輸入
const down = new Set();
const pressed = new Set();
const touchDir = { x: 0, z: 0 };

const MAP = {
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  Space: 'ok', Enter: 'ok', KeyZ: 'ok', Escape: 'back', KeyX: 'back',
  KeyB: 'book', KeyQ: 'quest',
};

window.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return; // 在輸入框打字時不當作遊戲操作
  const a = MAP[e.code];
  if (!a) return;
  if (!down.has(a)) pressed.add(a);
  down.add(a);
  if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
});
window.addEventListener('keyup', e => { const a = MAP[e.code]; if (a) down.delete(a); });
window.addEventListener('blur', () => down.clear());

export const input = {
  isDown: a => down.has(a),
  // 單次觸發（讀取後清除）
  take: a => { const had = pressed.has(a); pressed.delete(a); return had; },
  clearPressed: () => pressed.clear(),
  press: a => pressed.add(a),
  axis() {
    let x = touchDir.x, z = touchDir.z;
    if (down.has('left')) x -= 1;
    if (down.has('right')) x += 1;
    if (down.has('up')) z -= 1;
    if (down.has('down')) z += 1;
    const len = Math.hypot(x, z);
    return len > 1 ? { x: x / len, z: z / len } : { x, z };
  },
};

// 觸控搖桿
export function setupTouch(root) {
  const pad = root.querySelector('#touch-pad');
  const knob = root.querySelector('#touch-knob');
  const okBtn = root.querySelector('#touch-ok');
  if (!pad) return;
  let id = null;
  const move = e => {
    const r = pad.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let dx = e.clientX - cx, dy = e.clientY - cy;
    const max = r.width / 2;
    const len = Math.hypot(dx, dy);
    if (len > max) { dx = dx / len * max; dy = dy / len * max; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    touchDir.x = Math.abs(dx) > 8 ? dx / max : 0;
    touchDir.z = Math.abs(dy) > 8 ? dy / max : 0;
  };
  pad.addEventListener('pointerdown', e => { id = e.pointerId; pad.setPointerCapture(id); move(e); });
  pad.addEventListener('pointermove', e => { if (e.pointerId === id) move(e); });
  const end = () => { id = null; touchDir.x = touchDir.z = 0; knob.style.transform = ''; };
  pad.addEventListener('pointerup', end);
  pad.addEventListener('pointercancel', end);
  okBtn.addEventListener('pointerdown', e => { e.preventDefault(); pressed.add('ok'); });
  // 平板：偵測到觸控就顯示搖桿
  if (matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0) root.classList.add('touch');
  window.addEventListener('touchstart', () => root.classList.add('touch'), { once: true, passive: true });
}
