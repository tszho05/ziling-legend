import * as THREE from 'three';
import { Billboard } from './world/sprites.js';
import { makeTree } from './world/maps.js';
import { tex } from './world/textures.js';
import { MONSTERS } from './data/monsters.js';
import { state, cls, stats, maxHp, save, gainExp, recordKill } from './state.js';
import { makeQuestion, QUIZ_TYPES } from './quiz.js';
import { sfx, music } from './audio.js';
import { ui } from './ui.js';

const $ = s => document.querySelector(s);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rand = (a, b) => a + Math.random() * (b - a);

function tween(ms, fn) {
  return new Promise(resolve => {
    const t0 = performance.now();
    const step = now => {
      const t = Math.min(1, (now - t0) / ms);
      fn(t);
      t < 1 ? requestAnimationFrame(step) : resolve();
    };
    requestAnimationFrame(step);
  });
}

function buildArena() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xa8d4f0);
  scene.fog = new THREE.Fog(0xcfe6d8, 18, 40);
  scene.add(new THREE.HemisphereLight(0xfff1dc, 0x6a5234, 1.25));
  const sun = new THREE.DirectionalLight(0xffdcaa, 2.5);
  sun.position.set(-6, 14, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14 });
  sun.shadow.bias = -0.0008;
  scene.add(sun);
  const gt = tex.grass().clone();
  gt.repeat.set(60, 60);
  gt.needsUpdate = true;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ map: gt, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  const dt = tex.dirt().clone();
  dt.repeat.set(14, 3);
  dt.needsUpdate = true;
  const path = new THREE.Mesh(new THREE.PlaneGeometry(14, 3), new THREE.MeshStandardMaterial({ map: dt, roughness: 1 }));
  path.rotation.x = -Math.PI / 2;
  path.position.set(0, 0.01, 0.2);
  path.receiveShadow = true;
  scene.add(path);
  for (let i = 0; i < 14; i++) scene.add(makeTree({ x: -12 + i * 1.8 + (i % 3) * 0.4, z: -6 - (i % 4) }));
  for (let i = 0; i < 6; i++) scene.add(makeTree({ x: -13 + i * 5, z: -11 }));
  return scene;
}

export class Battle {
  constructor(engine) {
    this.engine = engine;
    this.sprites = [];
  }

  update(dt) {
    for (const s of this.sprites) s.update(dt);
    this.engine.lookAt(new THREE.Vector3(0, 1.5, 0.6));
  }

  // 回傳 'win' | 'lose' | 'flee'
  async run(party) {
    this.scene = buildArena();
    this.engine.setScene(this.scene);
    this.engine.distance = 15;
    this.engine.lookAt(new THREE.Vector3(0, 1.5, 0.6), true);
    this.sprites = [];

    this.isBoss = party.some(id => MONSTERS[id].boss);
    music.play(this.isBoss ? 'boss' : 'battle');

    const c = cls();
    // 英雄有待機與攻擊兩張精靈表，攻擊時切換
    this.hero = {
      name: c.name, guard: false,
      sprite: new Billboard(`hero_${state.classId}_battle_idle`, { fps: 4 }),
      attackSprite: new Billboard(`hero_${state.classId}_battle_attack`, { fps: 10, shadow: false, loop: false }),
    };
    this.hero.home = new THREE.Vector3(3.6, 0, 0.6);
    this.hero.sprite.pivot.position.copy(this.hero.home);
    this.hero.attackSprite.pivot.visible = false;
    this.hero.sprite.pivot.add(this.hero.attackSprite.pivot);
    this.scene.add(this.hero.sprite.pivot);
    this.sprites.push(this.hero.sprite, this.hero.attackSprite);

    const slots = this.isBoss ? [[-3.4, 0.2]] : [[-3, 0.6], [-2.2, -0.8], [-3.6, 1.8], [-4.2, -0.4]];
    this.enemies = party.map((id, i) => {
      const def = MONSTERS[id];
      const sp = new Billboard(`monster_${id}`, { fps: 4 });
      const [x, z] = slots[i];
      sp.pivot.position.set(x, 0, z);
      this.scene.add(sp.pivot);
      this.sprites.push(sp);
      const sameBefore = party.slice(0, i).filter(p => p === id).length;
      const label = party.filter(p => p === id).length > 1 ? `${def.name}${'ABCD'[sameBefore]}` : def.name;
      return { def, name: label, hp: def.hp, maxHp: def.hp, sprite: sp, home: sp.pivot.position.clone(), alive: true };
    });

    $('#battle-ui').hidden = false;
    $('#hud').hidden = true;
    document.body.classList.add('in-battle');
    this.renderStatus();
    this.log(`${this.enemies.map(e => e.name).join('、')}出現了！`);
    await sleep(700);

    let result = null;
    while (!result) {
      const act = await this.heroTurn();
      if (act === 'flee') { result = 'flee'; break; }
      if (this.enemies.every(e => !e.alive)) { result = 'win'; break; }
      for (const e of this.enemies) {
        if (!e.alive) continue;
        await this.enemyAttack(e);
        if (state.hp <= 0) { result = 'lose'; break; }
      }
      this.hero.guard = false;
    }
    if (result === 'win') await this.victory();
    if (result === 'lose') { music.stop(); sfx('lose'); this.log('你倒下了……'); await sleep(1400); }
    $('#battle-ui').hidden = true;
    $('#hud').hidden = false;
    document.body.classList.remove('in-battle');
    $('#battle-cmd').innerHTML = '';
    for (const s of this.sprites) s.dispose();
    this.engine.distance = 19;
    save();
    return result;
  }

  log(msg) { $('#battle-log').textContent = msg; }

  renderStatus() {
    const s = stats();
    $('#battle-hero').innerHTML = `<div class="bh-name">${cls().name} Lv.${state.level}</div>
      <div class="bar"><div class="fill hp" style="width:${(state.hp / s.hp) * 100}%"></div></div>
      <div class="bh-hp">HP ${Math.max(0, state.hp)} / ${s.hp}</div>`;
    $('#battle-enemies').innerHTML = this.enemies.map(e => `<div class="be ${e.alive ? '' : 'dead'}">
      <span>${e.name}</span><div class="bar small"><div class="fill ehp" style="width:${(Math.max(0, e.hp) / e.maxHp) * 100}%"></div></div></div>`).join('');
  }

  // 指令選單（按鈕 + 鍵盤）
  // 沒有普通攻擊：所有攻擊都是技能，要先答對成語題
  command() {
    return new Promise(resolve => {
      const box = $('#battle-cmd');
      const items = [
        ...cls().skills.map(s => ({ id: 'skill:' + s.id, label: s.name, hint: `答題後施放・${s.desc}` })),
        { id: 'defend', label: '防禦', hint: '本回合受到的傷害減半' },
        ...(this.isBoss ? [] : [{ id: 'flee', label: '逃走', hint: '離開戰鬥' }]),
      ];
      box.innerHTML = '';
      let sel = 0;
      const btns = items.map((it, i) => {
        const b = document.createElement('button');
        b.className = 'cmd-btn';
        b.innerHTML = `${it.label}<small>${it.hint}</small>`;
        b.onclick = () => done(i);
        b.onmouseenter = () => focus(i);
        box.appendChild(b);
        return b;
      });
      const focus = i => { sel = i; btns.forEach((b, j) => b.classList.toggle('sel', j === i)); };
      const onKey = e => {
        if (ui.busy) return;
        const k = e.code;
        if (k === 'ArrowDown' || k === 'KeyS') focus((sel + 1) % btns.length);
        else if (k === 'ArrowUp' || k === 'KeyW') focus((sel + btns.length - 1) % btns.length);
        else if (['Space', 'Enter', 'KeyZ'].includes(k)) done(sel);
        else return;
        e.preventDefault();
      };
      const done = i => { sfx('click'); window.removeEventListener('keydown', onKey); box.innerHTML = ''; resolve(items[i].id); };
      window.addEventListener('keydown', onKey);
      focus(0);
    });
  }

  async pickTarget() {
    const alive = this.enemies.filter(e => e.alive);
    if (alive.length === 1) return alive[0];
    const i = await ui.choose('選擇目標', alive.map(e => `${e.name}　HP ${e.hp}/${e.maxHp}`));
    return i < 0 ? null : alive[i];
  }

  async heroTurn() {
    for (;;) {
      this.log(`${cls().name}要怎樣做？`);
      const cmd = await this.command();
      if (cmd === 'defend') {
        this.hero.guard = true;
        this.log('你擺好了防禦架勢。');
        await sleep(600);
        return 'defend';
      }
      if (cmd === 'flee') {
        if (Math.random() < 0.75) { this.log('成功逃走了！'); await sleep(700); return 'flee'; }
        this.log('逃不掉！');
        await sleep(700);
        return 'fail';
      }
      if (cmd.startsWith('skill:')) {
        const skill = cls().skills.find(s => 'skill:' + s.id === cmd);
        let target = null;
        if (skill.kind === 'damage') { target = await this.pickTarget(); if (!target) continue; }
        const ok = await ui.quiz(makeQuestion(state.learned, { types: QUIZ_TYPES }), { title: `施放「${skill.name}」── 答對才能借用字靈之力` });
        ok ? state.quiz.correct++ : state.quiz.wrong++;
        if (!ok) {
          sfx('fail');
          this.log(`答錯了，字靈沒有回應……「${skill.name}」施放失敗！`);
          await sleep(900);
          return 'skill-fail';
        }
        await this.castSkill(skill, target);
        return 'skill';
      }
    }
  }

  damageTo(enemy, power, crit = false) {
    const s = stats();
    let d = Math.round((s.atk * power) * rand(0.9, 1.1) - enemy.def.def * 0.5);
    if (crit) d = Math.round(d * 1.5);
    return Math.max(1, d);
  }

  // 切換英雄的攻擊姿勢
  pose(attacking) {
    this.hero.sprite.mesh.visible = !attacking;
    this.hero.attackSprite.pivot.visible = attacking;
    if (attacking) this.hero.attackSprite.t = 0;
  }

  async heroStrike(target, power, fx, { crit = false } = {}) {
    const hs = this.hero.sprite;
    const from = this.hero.home.clone();
    // 劍士衝上前；法師、弓手原地施放
    const melee = state.classId === 'swordsman';
    const to = melee ? target.sprite.pivot.position.clone().add(new THREE.Vector3(1.4, 0, 0)) : from.clone().add(new THREE.Vector3(-0.4, 0, 0));
    this.pose(true);
    await tween(220, t => hs.pivot.position.lerpVectors(from, to, t));
    await this.hit(target, this.damageTo(target, power, crit), fx, crit);
    await tween(220, t => hs.pivot.position.lerpVectors(to, from, t));
    this.pose(false);
  }

  async hit(target, dmg, fx, crit = false) {
    this.spawnFx(fx, target.sprite.pivot.position);
    sfx(fx === 'fire' ? 'fire' : fx === 'arrow' ? 'arrow' : 'hit');
    target.hp -= dmg;
    this.popNumber(target.sprite.pivot.position, target.sprite.height, dmg, crit ? 'crit' : '');
    await this.flash(target.sprite);
    if (target.hp <= 0) {
      target.alive = false;
      sfx('defeat');
      await tween(400, t => { target.sprite.mesh.material.opacity = 1 - t; target.sprite.mesh.material.transparent = true; target.sprite.mesh.scale.y = 1 - t * 0.3; });
      target.sprite.pivot.visible = false;
      this.log(`打倒了${target.name}！`);
    }
    this.renderStatus();
  }

  async castSkill(skill, target) {
    this.log(`「${skill.name}」！`);
    const alive = () => this.enemies.filter(e => e.alive);
    if (skill.kind === 'damage') {
      await this.heroStrike(target, skill.power, skill.fx, { crit: skill.id === 'pierce' });
    } else if (skill.kind === 'damage_all') {
      this.pose(true);
      await tween(250, t => { this.hero.sprite.pivot.position.y = Math.sin(t * Math.PI) * 0.4; });
      await Promise.all(alive().map(e => this.hit(e, this.damageTo(e, skill.power), skill.fx)));
      this.pose(false);
    } else if (skill.kind === 'multi_hit') {
      this.pose(true);
      for (let k = 0; k < skill.hits; k++) {
        const a = alive();
        if (!a.length) break;
        const t = a[(Math.random() * a.length) | 0];
        await this.hit(t, this.damageTo(t, skill.power), skill.fx);
      }
      this.pose(false);
    } else if (skill.kind === 'heal') {
      const amt = Math.round(maxHp() * skill.power);
      state.hp = Math.min(maxHp(), state.hp + amt);
      if (skill.id === 'guard') this.hero.guard = true;
      sfx('heal');
      this.spawnFx('heal', this.hero.sprite.pivot.position);
      this.popNumber(this.hero.sprite.pivot.position, this.hero.sprite.height, `+${amt}`, 'heal');
      this.renderStatus();
      await sleep(700);
    }
    await sleep(300);
  }

  async enemyAttack(e) {
    const sp = e.sprite;
    const from = e.home.clone();
    const to = this.hero.home.clone().add(new THREE.Vector3(-1.3, 0, 0));
    // 頭目每隔幾回合使出重擊
    e.turns = (e.turns || 0) + 1;
    const heavy = e.def.heavyEvery && e.turns % e.def.heavyEvery === 0;
    if (e.def.heavyEvery && (e.turns + 1) % e.def.heavyEvery === 0) this.log(`${e.name}正在蓄力……`);
    else this.log(heavy ? `${e.name}的重擊！` : `${e.name}的攻擊！`);
    if (!heavy && e.def.heavyEvery && (e.turns + 1) % e.def.heavyEvery === 0) { await sleep(900); return; }
    await tween(220, t => sp.pivot.position.lerpVectors(from, to, t));
    const s = stats();
    let d = Math.max(1, Math.round(e.def.atk * (heavy ? 1.8 : 1) * rand(0.85, 1.15) - s.def * 0.5));
    if (this.hero.guard) d = Math.max(1, Math.round(d / 2));
    state.hp -= d;
    sfx('hurt');
    this.popNumber(this.hero.sprite.pivot.position, this.hero.sprite.height, d, 'hurt');
    this.flash(this.hero.sprite);
    this.renderStatus();
    await tween(220, t => sp.pivot.position.lerpVectors(to, from, t));
    await sleep(250);
  }

  async victory() {
    const exp = this.enemies.reduce((a, e) => a + e.def.exp, 0);
    for (const e of this.enemies) recordKill(e.def.id);
    const ups = gainExp(exp);
    music.stop();
    sfx('victory');
    this.log(`勝利！獲得經驗值 ${exp}。`);
    await sleep(900);
    if (ups) { sfx('levelup'); ui.toast(`升級了！現在是 Lv.${state.level}`); await sleep(700); }
  }

  spawnFx(kind, pos) {
    const fx = new Billboard(`fx_${kind}`, { fps: 10, shadow: false, castShadow: false, glow: 1.2 });
    fx.pivot.position.copy(pos).add(new THREE.Vector3(0, 0, 0.3));
    this.scene.add(fx.pivot);
    this.sprites.push(fx);
    setTimeout(() => { this.scene.remove(fx.pivot); this.sprites = this.sprites.filter(s => s !== fx); fx.dispose(); }, 420);
  }

  async flash(sprite) {
    const m = sprite.mesh.material;
    for (let i = 0; i < 3; i++) {
      m.emissiveIntensity = 2.5; await sleep(60);
      m.emissiveIntensity = 0.28; await sleep(60);
    }
  }

  popNumber(pos, height, text, kind) {
    const v = pos.clone().add(new THREE.Vector3(0, height * 0.9, 0)).project(this.engine.camera);
    const d = document.createElement('div');
    d.className = 'dmg ' + kind;
    d.textContent = text;
    d.style.left = `${(v.x * 0.5 + 0.5) * window.innerWidth}px`;
    d.style.top = `${(-v.y * 0.5 + 0.5) * window.innerHeight}px`;
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 1000);
  }
}
