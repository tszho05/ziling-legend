import * as THREE from 'three';
import { buildMap, townLayout, fieldLayout } from './world/maps.js';
import { Billboard, isPlaceholder, sheetEntry } from './world/sprites.js';
import { NPCS, QUESTS } from './data/npcs.js';
import { FIELD_ENCOUNTERS, BOSS_ENCOUNTER } from './data/monsters.js';
import { IDIOM_BY_ID } from './data/idioms.js';
import { input } from './input.js';
import { ui } from './ui.js';
import { makeQuestion } from './quiz.js';
import { sfx, music } from './audio.js';
import { computeObjective } from './objective.js';
import { GATES } from './data/zones.js';
import { playEnding } from './ending.js';

// 怪物步伐：speed 速度、rest 停留秒數範圍、range 遊走半徑；史萊姆用跳躍
const MOVE_STYLE = {
  slime: { speed: 0.9, rest: [1.2, 3], range: 2.2, hop: true, hopRate: 1.6, hopHeight: 0.35, walkFps: 6 },
  wolf: { speed: 2.3, rest: [0.8, 2.5], range: 3.2, stepRate: 4.5, bob: 0.07, sway: 0.02, walkFps: 10 },
  goblin: { speed: 0.9, rest: [1.5, 3.5], range: 2.2, stepRate: 2.2, bob: 0.05, sway: 0.07, walkFps: 6 },
};

// 出城前至少要學會的成語數量
export const IDIOMS_TO_LEAVE = 5;
import { state, cls, save, learn, gainExp, questComplete, maxHp } from './state.js';

const SPEED = 4.2;
const RADIUS = 0.3;
const DIR_ROW = { down: 0, left: 1, right: 2, up: 3 };

export class Overworld {
  constructor(engine, { onBattle }) {
    this.engine = engine;
    this.onBattle = onBattle;
    this.maps = {};
    this.defeated = new Set();
    this.cooldown = 0;
  }

  // 每次進入重新建構（郊區怪物會重生）
  enter(mapId, spawn) {
    if (this.world) this.world.scene.traverse(o => { if (o.isMesh && o.userData.billboard) o.userData.billboard.dispose(); });
    const layout = mapId === 'town' ? townLayout()
      : fieldLayout(Object.fromEntries(Object.entries(GATES).map(([id, g]) => [id, g.open()])));
    this.gateCooldown = 0;
    this.world = buildMap(layout);
    this.layout = layout;
    state.map = mapId;
    if (mapId === 'field') this.defeated.clear();

    this.player = new Billboard(`hero_${state.classId}_walk`, { fps: 8 });
    this.player.fps = this.player.def.cols >= 8 ? 14 : 8; // 8 格走路要播快一點
    // 四方向待機呼吸（有圖才用）
    this.playerIdle = null;
    if (sheetEntry(`hero_${state.classId}_idle`)) {
      this.playerIdle = new Billboard(`hero_${state.classId}_idle`, { fps: 5 });
      this.playerIdle.pivot.visible = false;
      this.player.pivot.add(this.playerIdle.pivot);
    }
    const sp = spawn || layout.spawn;
    this.player.pivot.position.set(sp.x, 0, sp.z);
    this.world.scene.add(this.player.pivot);
    this.facing = 'up';

    this.npcs = [];
    if (mapId === 'town') {
      for (const n of NPCS) {
        const b = new Billboard(n.sprite, { fps: 3 });
        b.pivot.position.set(n.x, 0, n.z);
        this.world.scene.add(b.pivot);
        const mark = makeMarker();
        mark.position.set(0, b.height + 0.45, 0);
        b.pivot.add(mark);
        this.npcs.push({ def: n, sprite: b, mark });
        layout.solid[Math.floor(n.z)][Math.floor(n.x)] = true;
      }
    }
    this.monsters = [];
    if (mapId === 'field') {
      const encs = [...FIELD_ENCOUNTERS];
      if (state.quests[BOSS_ENCOUNTER.requiresQuest]?.status === 'active' && !questComplete(BOSS_ENCOUNTER.requiresQuest)) encs.push({ ...BOSS_ENCOUNTER, boss: true });
      encs.forEach((enc, i) => {
        const kind = enc.party[0];
        const b = new Billboard(`monster_${kind}`, { fps: 4 });
        b.setFlip(true);
        b.pivot.position.set(enc.x + 0.5, 0, enc.z + 0.5);
        this.world.scene.add(b.pivot);
        // 有專用行走表就在移動時切換
        let walk = null;
        const wk = `monster_${kind}_walk`;
        if (!enc.boss && !isPlaceholder(wk)) {
          walk = new Billboard(wk, { fps: MOVE_STYLE[kind]?.walkFps ?? 6 });
          walk.pivot.visible = false;
          b.pivot.add(walk.pivot);
        }
        this.monsters.push({ id: i, enc, kind, sprite: b, walk, home: new THREE.Vector2(enc.x + 0.5, enc.z + 0.5), t: Math.random() * 10, mode: 'idle', timer: Math.random() * 2, face: -1 });
      });
    }
    this.guide = makeGuideArrow();
    this.world.scene.add(this.guide);
    this.objTimer = 0;
    this.engine.setScene(this.world.scene);
    music.play(mapId);
    this.engine.lookAt(this.cameraTarget(), true);
    ui.setArea(layout.name);
    ui.updateHud();
    this.refreshMarkers();
    save();
  }

  cameraTarget() {
    const p = this.player.pivot.position;
    const t = new THREE.Vector3(p.x, 0.8, p.z);
    // 靠近邊界時稍微收住
    t.x = THREE.MathUtils.clamp(t.x, 6, this.layout.W - 6);
    t.z = THREE.MathUtils.clamp(t.z, 2, this.layout.D - 1);
    return t;
  }

  blocked(x, z) {
    const L = this.layout;
    const tx = Math.floor(x), tz = Math.floor(z);
    if (tx < 0 || tz < 0 || tx >= L.W || tz >= L.D) return true;
    return L.solid[tz][tx];
  }
  collides(x, z) {
    const r = RADIUS;
    return this.blocked(x - r, z - r) || this.blocked(x + r, z - r) || this.blocked(x - r, z + r) || this.blocked(x + r, z + r);
  }

  update(dt) {
    const p = this.player.pivot.position;
    if (!ui.busy && !this.transitioning) {
      const a = input.axis();
      const moving = a.x || a.z;
      if (moving) {
        this.facing = Math.abs(a.x) > Math.abs(a.z) ? (a.x < 0 ? 'left' : 'right') : (a.z < 0 ? 'up' : 'down');
        const nx = p.x + a.x * SPEED * dt, nz = p.z + a.z * SPEED * dt;
        if (!this.collides(nx, p.z)) p.x = nx;
        if (!this.collides(p.x, nz)) p.z = nz;
      }
      this.player.setRow(DIR_ROW[this.facing]);
      this.player.playing = !!moving;
      if (!moving) this.player.setFrame(DIR_ROW[this.facing], 0);
      // 行走時輕微上下彈動，補足影格較少時的動感
      this.walkT = moving ? (this.walkT || 0) + dt : 0;
      this.player.mesh.position.y = moving ? Math.abs(Math.sin(this.walkT * Math.PI * 4)) * 0.06 : 0;
      if (this.playerIdle) {
        this.player.mesh.visible = !!moving;
        this.playerIdle.pivot.visible = !moving;
        this.playerIdle.setRow(DIR_ROW[this.facing]);
      }

      if (input.take('ok')) this.tryInteract();
      if (input.take('book')) ui.openBook().then(() => input.clearPressed());
      if (input.take('quest')) ui.openQuests().then(() => input.clearPressed());
      this.checkExits();
      this.checkGates(dt, moving);
      this.checkEncounters(dt);
    } else {
      this.player.playing = false;
    }
    this.player.update(dt);
    this.playerIdle?.update(dt);
    for (const n of this.npcs) {
      n.sprite.update(dt);
      n.mark.position.y = n.sprite.height + 0.45 + Math.sin(performance.now() / 300) * 0.08;
    }
    this.updateMonsters(dt);
    this.updateOcclusion();
    this.updateGuide(dt);
    // 樹冠隨風輕輕擺動、雲飄動、水面流動
    const tt = performance.now() / 1000;
    this.world.animate(dt, tt, this.player.pivot.position);
    for (const sw of this.world.swayers) {
      sw.canopy.rotation.z = Math.sin(tt * 1.2 + sw.phase) * 0.03;
      sw.canopy.rotation.x = Math.cos(tt * 0.9 + sw.phase) * 0.02;
    }

    this.engine.lookAt(this.camOverride || this.cameraTarget());
    const sun = this.world.sun;
    sun.position.set(p.x - 8, 16, p.z + 7);
    sun.target.position.set(p.x, 0, p.z);
  }

  // 自然遊走：走一段 → 停下張望 → 換方向；不同怪物有不同步伐
  updateMonsters(dt) {
    for (const m of this.monsters) {
      if (this.defeated.has(m.id)) continue;
      m.t += dt;
      const pv = m.sprite.pivot;
      if (m.enc.boss) { m.sprite.setFlip(false); m.sprite.update(dt); continue; }
      const st = MOVE_STYLE[m.kind] || MOVE_STYLE.goblin;
      m.timer -= dt;
      if (m.mode === 'idle') {
        // 停下時偶爾轉頭張望
        if (m.timer < 0.6 && !m.looked && Math.random() < 0.02) { m.face *= -1; m.looked = true; }
        if (m.timer <= 0) this.pickWanderTarget(m, st);
      } else {
        const dx = m.target.x - pv.position.x, dz = m.target.y - pv.position.z;
        const dist = Math.hypot(dx, dz);
        // 史萊姆只在跳起時前進
        let move = st.speed * dt;
        if (st.hop) {
          const ph = (m.t * st.hopRate) % 1;
          move *= ph < 0.6 ? 1.7 : 0;
        }
        if (dist < 0.05 || m.timer <= 0) { m.mode = 'idle'; m.timer = st.rest[0] + Math.random() * (st.rest[1] - st.rest[0]); m.looked = false; }
        else {
          const nx = pv.position.x + dx / dist * Math.min(move, dist), nz = pv.position.z + dz / dist * Math.min(move, dist);
          if (this.collides(nx, nz)) { m.mode = 'idle'; m.timer = 0.5; }
          else { pv.position.x = nx; pv.position.z = nz; }
          if (Math.abs(dx) > 0.02) m.face = dx < 0 ? -1 : 1;
        }
      }
      const moving = m.mode === 'move';
      // 步伐動作
      let y = 0, sx = 1, sy = 1, rz = 0;
      if (st.hop) {
        const ph = (m.t * st.hopRate) % 1;
        if (moving && ph < 0.6) y = Math.sin(ph / 0.6 * Math.PI) * st.hopHeight;
        const land = moving ? Math.max(0, 1 - Math.abs(ph - 0.68) / 0.1) : 0;
        const breathe = Math.sin(m.t * 3) * 0.04;
        sx = 1 + land * 0.22 - breathe; sy = 1 - land * 0.25 + breathe;
      } else if (moving) {
        y = Math.abs(Math.sin(m.t * st.stepRate * Math.PI)) * st.bob;
        rz = Math.sin(m.t * st.stepRate * Math.PI) * st.sway;
      } else {
        sy = 1 + Math.sin(m.t * 2.2) * 0.015;
      }
      pv.position.y = y;
      pv.scale.set(sx, sy, 1);
      pv.rotation.z = rz;
      m.sprite.setFlip(m.face < 0);
      if (m.walk) {
        m.walk.setFlip(m.face < 0);
        m.walk.pivot.visible = moving;
        m.sprite.mesh.visible = !moving;
        m.walk.update(dt);
      }
      m.sprite.update(dt);
    }
  }

  pickWanderTarget(m, st) {
    for (let k = 0; k < 8; k++) {
      const a = Math.random() * Math.PI * 2, r = 0.8 + Math.random() * st.range;
      const x = m.home.x + Math.cos(a) * r, z = m.home.y + Math.sin(a) * r * 0.8;
      if (!this.collides(x, z)) {
        m.target = new THREE.Vector2(x, z);
        m.mode = 'move';
        m.timer = 6;
        return;
      }
    }
    m.timer = 1;
  }

  // 「下一步」提示欄與腳下指引箭頭
  updateGuide(dt) {
    this.objTimer -= dt;
    if (this.objTimer <= 0) {
      this.objTimer = 0.25;
      this.objective = computeObjective(this, IDIOMS_TO_LEAVE);
      ui.setObjective(this.objective.text);
    }
    const p = this.player.pivot.position, t = this.objective?.target;
    const g = this.guide;
    const dist = t ? Math.hypot(t.x - p.x, t.z - p.z) : 0;
    g.visible = !!t && dist > 1.4 && !ui.busy && !this.transitioning;
    if (!g.visible) return;
    // 沿可走的路線指向（避開牆和岩壁），不是直線指向目標
    const way = this.nextWaypoint(p, t) || t;
    const ang = Math.atan2(way.x - p.x, way.z - p.z);
    const pulse = 1.15 + Math.sin(performance.now() / 180) * 0.15;
    g.position.set(p.x + Math.sin(ang) * pulse, 0.07, p.z + Math.cos(ang) * pulse);
    g.rotation.y = ang;
    g.children[0].material.opacity = 0.85 + Math.sin(performance.now() / 180) * 0.15;
  }

  // 用格子 BFS 找出到目標的路線，回傳前方幾格的路點（每 0.25 秒重算一次）
  nextWaypoint(p, t) {
    const now = performance.now();
    if (this.wayCache && now - this.wayCache.at < 250) return this.wayCache.pt;
    const L = this.layout, W = L.W, D = L.D;
    const sx = Math.floor(p.x), sz = Math.floor(p.z);
    const tx = Math.min(W - 1, Math.max(0, Math.floor(t.x))), tz = Math.min(D - 1, Math.max(0, Math.floor(t.z)));
    const idx = (x, z) => z * W + x;
    const prev = new Int32Array(W * D).fill(-2);
    const q = [idx(sx, sz)];
    prev[q[0]] = -1;
    let found = -1;
    for (let h = 0; h < q.length; h++) {
      const c = q[h], cx = c % W, cz = (c / W) | 0;
      // 目標格本身可能是阻擋物（例如 NPC、頭目），走到旁邊就算到達
      if (Math.abs(cx - tx) + Math.abs(cz - tz) <= 1) { found = c; break; }
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, nz = cz + dz;
        if (nx < 0 || nz < 0 || nx >= W || nz >= D) continue;
        const n = idx(nx, nz);
        if (prev[n] !== -2 || L.solid[nz][nx]) continue;
        prev[n] = c;
        q.push(n);
      }
    }
    let pt = null;
    if (found >= 0) {
      const path = [];
      for (let c = found; c !== -1; c = prev[c]) path.push(c);
      path.reverse();
      const c = path[Math.min(3, path.length - 1)];
      pt = path.length > 1 ? { x: (c % W) + 0.5, z: ((c / W) | 0) + 0.5 } : null;
    }
    this.wayCache = { at: now, pt };
    return pt;
  }

  // 玩家被房屋或樹擋住時，把遮擋物變半透明
  updateOcclusion() {
    const p = this.player.pivot.position;
    for (const f of this.world.fadeables) {
      const r = f.userData.rect;
      const inFront = r.z + r.d > p.z && r.z < p.z + 4 && p.x > r.x - 1.1 && p.x < r.x + r.w + 1.1 && r.z > p.z - 0.2;
      const target = inFront ? 0.35 : 1;
      f.traverse(o => {
        if (!o.isMesh) return;
        if (!o.userData.ownMat) { o.material = o.material.clone(); o.material.transparent = true; o.userData.ownMat = true; }
        o.material.opacity += (target - o.material.opacity) * 0.2;
        o.material.depthWrite = o.material.opacity > 0.95;
      });
    }
  }

  checkExits() {
    const p = this.player.pivot.position;
    for (const ex of this.layout.exits) {
      const r = ex.rect;
      if (p.x >= r.x && p.x < r.x + r.w && p.z >= r.z && p.z < r.z + r.d + 0.2) {
        if (ex.to === 'field' && state.learned.length < IDIOMS_TO_LEAVE) { this.blockGate(); return; }
        this.transitioning = true;
        sfx('door');
        ui.fade(() => { this.enter(ex.to, ex.spawn); }).then(() => { this.transitioning = false; ui.banner(this.layout.name); });
        return;
      }
    }
  }

  // 走近未開通的關卡時，說明要完成甚麼任務
  checkGates(dt, moving) {
    this.gateCooldown -= dt;
    if (!moving || this.gateCooldown > 0 || !this.layout.closedGates) return;
    const p = this.player.pivot.position;
    for (const g of this.layout.closedGates) {
      if (Math.hypot(g.x - p.x, g.z - p.z) < 1.5) {
        this.gateCooldown = 5;
        ui.say('', GATES[g.id].msg).then(() => input.clearPressed());
        return;
      }
    }
  }

  // 未學夠成語：衛兵攔住，把玩家推回城內
  async blockGate() {
    this.transitioning = true;
    this.player.pivot.position.z = 2.2;
    await ui.say('衛兵', [`郊區很危險！先喚醒至少 ${IDIOMS_TO_LEAVE} 個字靈（學會 ${IDIOMS_TO_LEAVE} 個成語）才可以出鎮。`, `你現在學會了 ${state.learned.length} 個，去找鎮上的居民吧。`]);
    input.clearPressed();
    this.transitioning = false;
  }

  checkEncounters(dt) {
    if (this.cooldown > 0) { this.cooldown -= dt; return; }
    const p = this.player.pivot.position;
    for (const m of this.monsters) {
      if (this.defeated.has(m.id)) continue;
      const q = m.sprite.pivot.position;
      if (Math.hypot(p.x - q.x, p.z - q.z) < 0.85) {
        this.startBattle(m);
        return;
      }
    }
  }

  async startBattle(m) {
    this.transitioning = true;
    const result = await this.onBattle(m.enc.party, m.enc.zone || 1);
    this.transitioning = false;
    input.clearPressed();
    if (result === 'win') {
      this.defeated.add(m.id);
      m.sprite.pivot.visible = false;
      music.play(this.layout.id);
      if (m.enc.boss) await this.bossDefeated();
    } else if (result === 'flee') {
      this.cooldown = 2.5;
      music.play(this.layout.id);
    } else if (result === 'lose') {
      state.hp = maxHp();
      await ui.fade(() => this.enter('town'));
      await ui.say('鎮長', ['你昏倒在郊區，被鎮民抬回來了。', '休息一下，溫習好成語再出發吧！']);
      input.clearPressed();
    }
    ui.updateHud();
    this.refreshMarkers();
  }

  async bossDefeated() {
    await ui.say('', ['亂字魔化成一團墨水，消失了！', '被困住的文字飛回天空，十個字靈一起發出光芒……']);
    input.clearPressed();
    await playEnding(this);
  }

  tryInteract() {
    const p = this.player.pivot.position;
    let best = null, bd = 1.6;
    for (const n of this.npcs) {
      const d = Math.hypot(n.def.x - p.x, n.def.z - p.z);
      if (d < bd) { bd = d; best = n; }
    }
    if (best) this.talk(best).then(() => { input.clearPressed(); this.refreshMarkers(); ui.updateHud(); });
  }

  // NPC 頭上的「！」「？」提示
  refreshMarkers() {
    for (const n of this.npcs) {
      const s = this.npcStatus(n.def);
      n.mark.visible = !!s;
      if (s) n.mark.material.map = markerTex(s);
    }
  }
  npcStatus(def) {
    // 開局只有鎮長有「！」；接了第一個任務後，教成語的居民才顯示「！」
    const started = Object.keys(state.quests).length > 0;
    if (def.teaches && started && def.teaches.some(id => !state.learned.includes(id))) return '!';
    if (def.quests) {
      for (const qid of def.quests) {
        const st = state.quests[qid];
        if (st?.status === 'active') return questComplete(qid) ? '?' : null;
        if (!st) return '!';
      }
    }
    return null;
  }

  async talk(n) {
    const def = n.def;
    // 轉身面向玩家
    const call = cls().gender === 'male' ? '哥哥' : '姐姐';
    await ui.say(def.name, def.greet.map(l => l.replace('{稱呼}', call)));
    if (def.teaches) {
      const next = def.teaches.find(id => !state.learned.includes(id));
      if (!next) {
        const i = await ui.choose(`${def.name}：要溫習一下嗎？`, ['好，考考我！', '下次吧']);
        if (i === 0) await this.review(def);
        return;
      }
      const idiom = IDIOM_BY_ID[next];
      await ui.say(def.name, [`我記得一個成語：「${idiom.word}」。仔細聽好了！`]);
      await ui.idiomCard(idiom, `${def.name}教你的成語`);
      // 即時小測驗，答對才算學會
      let ok = false;
      while (!ok) {
        ok = await ui.quiz(makeQuestion([next], { targetId: next, types: ['meaning', 'example'] }), { title: '小測驗' });
        ok ? state.quiz.correct++ : state.quiz.wrong++;
        if (!ok) {
          await ui.say(def.name, ['沒關係，我們再看一次。']);
          await ui.idiomCard(idiom, `再看一次`);
        }
      }
      learn(next);
      sfx('learn');
      ui.toast(`喚醒了字靈「${idiom.word}」！（${state.learned.length}/10）`);
      await ui.say(def.name, ['太好了！字靈「' + idiom.word + '」醒過來了。', ...(def.teaches.some(id => !state.learned.includes(id)) ? ['再來找我，我還有一個成語要教你。'] : [])]);
    }
    if (def.quests) await this.questFlow(def);
  }

  async review(def) {
    const q = makeQuestion(def.teaches);
    const ok = await ui.quiz(q, { title: '溫習' });
    ok ? state.quiz.correct++ : state.quiz.wrong++;
    save();
  }

  async questFlow(def) {
    for (const qid of def.quests) {
      const q = QUESTS[qid];
      const st = state.quests[qid];
      if (st?.status === 'done') continue;
      if (st?.status === 'active') {
        if (questComplete(qid)) {
          st.status = 'done';
          const ups = gainExp(q.reward.exp);
          sfx(ups ? 'levelup' : 'quest');
          const newSkill = cls().skills.find(s => s.unlock === qid);
          await ui.say(def.name, [`「${q.title}」完成了，辛苦你了！`, `獲得經驗值 ${q.reward.exp}。`, ...(ups ? [`等級提升到 Lv.${state.level}！`] : [])]);
          if (newSkill) {
            sfx('learn');
            await ui.skillCard(newSkill);
          }
          continue;
        }
        await ui.say(def.name, [`「${q.title}」：${q.desc}`, '加油！']);
        return;
      }
      const i = await ui.choose(`新任務：${q.title}\n${q.desc}`, ['接受', '稍後再說']);
      if (i === 0) {
        state.quests[qid] = { status: 'active', progress: 0 };
        save();
        sfx('quest');
        ui.toast(`接受任務「${q.title}」`);
        if (questComplete(qid)) continue;
      }
      return;
    }
    await ui.say(def.name, ['目前沒有新的任務了，謝謝你！']);
  }
}

// ---- 指引箭頭（平放在地上，指向目標） ----
function makeGuideArrow() {
  const s = new THREE.Shape();
  s.moveTo(0, 0.45); s.lineTo(0.32, 0.05); s.lineTo(0.12, 0.05); s.lineTo(0.12, -0.3);
  s.lineTo(-0.12, -0.3); s.lineTo(-0.12, 0.05); s.lineTo(-0.32, 0.05); s.closePath();
  const geo = new THREE.ShapeGeometry(s);
  geo.rotateX(-Math.PI / 2); // 箭頭尖端指向 -z，再由 rotation.y 轉向
  geo.rotateY(Math.PI);
  geo.scale(1.8, 1, 1.8);
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffc21a, transparent: true, opacity: 0.9, depthWrite: false, depthTest: false }));
  m.renderOrder = 5;
  const g = new THREE.Group();
  g.add(m);
  return g;
}

// ---- 提示符號 ----
const markerCache = {};
function markerTex(ch) {
  if (markerCache[ch]) return markerCache[ch];
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d');
  g.fillStyle = ch === '?' ? '#3fd06a' : '#ffcc33';
  g.beginPath(); g.arc(16, 16, 14, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#3a2a10'; g.lineWidth = 2; g.stroke();
  g.fillStyle = '#3a2a10'; g.font = 'bold 22px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(ch, 16, 17);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return (markerCache[ch] = t);
}
function makeMarker() {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: markerTex('!'), depthTest: false }));
  s.scale.set(0.5, 0.5, 1);
  s.renderOrder = 10;
  return s;
}
