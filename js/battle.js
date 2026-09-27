import * as THREE from 'three';
import { Billboard, sheetEntry } from './world/sprites.js';
import { ASSETS } from './data/assets.js';
import { buildArena } from './world/arena.js';
import { MONSTERS } from './data/monsters.js';
import { state, cls, stats, maxHp, save, gainExp, recordKill, unlockedSkills } from './state.js';
import { nextQuestion } from './quiz.js';
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

export class Battle {
  constructor(engine) {
    this.engine = engine;
    this.sprites = [];
  }

  update(dt) {
    for (const s of this.sprites) s.update(dt);
    this.scene?.userData.animate?.(dt, performance.now() / 1000);
    this.vortex?.(performance.now() / 1000);
    const cam = this.camFocus ? this.camFocus.clone() : new THREE.Vector3(0, 1.5, 0.6);
    if (this.shake > 0) {
      cam.x += (Math.random() - 0.5) * this.shake;
      cam.y += (Math.random() - 0.5) * this.shake;
      this.shake = Math.max(0, this.shake - dt * 1.6);
    }
    this.engine.lookAt(cam, this.shake > 0);
  }

  // 回傳 'win' | 'lose' | 'flee'
  // zone：郊區分區（1 草原、2 森林、3 營地、4 祭壇），決定戰鬥場景
  async run(party, zone = 1) {
    this.scene = await buildArena(zone);
    this.engine.setScene(this.scene);
    const gu = this.engine.grade.uniforms;
    const gradeBefore = { vignette: gu.vignette.value, warmth: gu.warmth.value };
    gu.vignette.value = this.scene.userData.grade.vignette;
    gu.warmth.value = this.scene.userData.grade.warmth;
    this.engine.distance = 15;
    this.engine.lookAt(new THREE.Vector3(0, 1.5, 0.6), true);
    this.sprites = [];

    this.isBoss = party.some(id => MONSTERS[id].boss);
    this.sealed = null;
    this.vortex = null;
    this.cd = {};
    music.play(this.isBoss ? 'boss' : 'battle');

    const c = cls();
    // 英雄有待機與攻擊兩張精靈表，攻擊時切換
    this.hero = {
      name: c.name,
      sprite: new Billboard(`hero_${state.classId}_battle_idle`, { fps: 4 }),
      attackSprite: new Billboard(`hero_${state.classId}_battle_attack`, { fps: 10, shadow: false, loop: false }),
    };
    this.hero.guardTurns = 0;
    this.hero.home = new THREE.Vector3(3.2, 0, 0.6);
    this.hero.sprite.pivot.position.copy(this.hero.home);
    this.hero.attackSprite.pivot.visible = false;
    this.hero.sprite.pivot.add(this.hero.attackSprite.pivot);
    this.scene.add(this.hero.sprite.pivot);
    this.sprites.push(this.hero.sprite, this.hero.attackSprite);

    const slots = this.isBoss ? [[-2.8, 0.2]] : [[-2.6, 0.6], [-1.9, -0.8], [-3.2, 1.8], [-3.7, -0.4]];
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
    $('#battle-ui').classList.toggle('boss', this.isBoss);
    $('#hud').hidden = true;
    document.body.classList.add('in-battle');
    this.renderStatus();
    this.log(`${this.enemies.map(e => e.name).join('、')}出現了！`);
    await sleep(700);

    let result = null;
    while (!result) {
      const act = await this.heroTurn();
      // 冷卻在英雄行動後倒數：冷卻 2 = 下一回合不能用，第 2 回合可以再用
      for (const id in this.cd) if (this.cd[id] > 0) this.cd[id]--;
      // 封印在英雄行動後才倒數，所以會完整封住 2 個回合
      if (this.sealed && this.enemies.some(e => e.alive) && --this.sealed.turns <= 0) { this.log(`「${cls().skills.find(s => s.id === this.sealed.id).name}」的封印解除了！`); this.sealed = null; await sleep(700); }
      if (act === 'flee') { result = 'flee'; break; }
      if (this.enemies.every(e => !e.alive)) { result = 'win'; break; }
      for (const e of this.enemies) {
        if (!e.alive) continue;
        await this.enemyAttack(e);
        if (state.hp <= 0) { result = 'lose'; break; }
      }
      if (this.hero.guardTurns > 0 && --this.hero.guardTurns === 0) { this.setShield(false); this.log('護盾消失了。'); await sleep(500); }
    }
    if (result === 'win') await this.victory();
    if (result === 'lose') { music.stop(); sfx('lose'); this.log('你倒下了……'); await sleep(1400); }
    $('#battle-ui').hidden = true;
    $('#hud').hidden = false;
    document.body.classList.remove('in-battle');
    $('#battle-cmd').innerHTML = '';
    this.setShield(false);
    this.camFocus = null;
    this.shake = 0;
    document.querySelector('#battle-dim')?.classList.remove('on');
    for (const s of this.sprites) s.dispose();
    this.engine.distance = 19;
    gu.vignette.value = gradeBefore.vignette;
    gu.warmth.value = gradeBefore.warmth;
    save();
    return result;
  }

  log(msg) { $('#battle-log').textContent = msg; }

  renderStatus() {
    const s = stats();
    $('#battle-hero').innerHTML = `<div class="bh-name">${cls().name} Lv.${state.level}</div>
      <div class="bar"><div class="fill hp" style="width:${(state.hp / s.hp) * 100}%"></div></div>
      <div class="bh-hp">HP ${Math.max(0, state.hp)} / ${s.hp}</div>`;
    // 頭目戰：畫面頂部的大血條
    if (this.isBoss) {
      const e = this.enemies[0];
      $('#battle-enemies').innerHTML = `<div class="boss-name">${e.name}</div>
        <div class="boss-hp">${Math.max(0, e.hp)} / ${e.maxHp}</div>
        <div class="bar boss"><div class="fill ehp" style="width:${(Math.max(0, e.hp) / e.maxHp) * 100}%"></div></div>`;
      return;
    }
    $('#battle-enemies').innerHTML = this.enemies.map(e => `<div class="be ${e.alive ? '' : 'dead'}">
      <span>${e.name}</span><div class="bar small"><div class="fill ehp" style="width:${(Math.max(0, e.hp) / e.maxHp) * 100}%"></div></div></div>`).join('');
  }

  // 指令選單（按鈕 + 鍵盤）
  // 沒有普通攻擊：所有攻擊都是技能，要先答對成語題
  command() {
    return new Promise(resolve => {
      const box = $('#battle-cmd');
      const items = [
        ...unlockedSkills().map(s => this.sealed?.id === s.id
          ? { id: 'sealed', label: `🔒 ${s.name}`, hint: `被亂字魔封印（還有 ${this.sealed.turns} 回合）`, disabled: true }
          : this.cd[s.id] > 0
            ? { id: 'cooldown', label: `⏳ ${s.name}`, hint: `冷卻中（還有 ${this.cd[s.id]} 回合）`, disabled: true }
            : { id: 'skill:' + s.id, label: s.name, hint: `${s.cd ? '字方塊題' : '答題'}後施放・${s.desc}` }),
        ...(this.isBoss ? [] : [{ id: 'flee', label: '逃走', hint: '離開戰鬥' }]),
      ];
      box.innerHTML = '';
      let sel = 0;
      const btns = items.map((it, i) => {
        const b = document.createElement('button');
        b.className = 'cmd-btn';
        b.innerHTML = `${it.label}<small>${it.hint}</small>`;
        if (it.disabled) b.classList.add('disabled');
        b.onclick = () => { if (!it.disabled) done(i); };
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
        else if (['Space', 'Enter', 'KeyZ'].includes(k)) { if (!items[sel].disabled) done(sel); }
        else return;
        e.preventDefault();
      };
      const done = i => { sfx('click'); window.removeEventListener('keydown', onKey); box.innerHTML = ''; resolve(items[i].id); };
      window.addEventListener('keydown', onKey);
      focus(items.findIndex(it => !it.disabled));
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
      // 所有技能都在冷卻或被封印時（頭目戰不能逃走），只能等待這一回合
      const usable = unlockedSkills().some(s => this.sealed?.id !== s.id && !(this.cd[s.id] > 0));
      if (!usable && this.isBoss) {
        this.log('沒有可以使用的技能，只好等待時機……');
        await sleep(1200);
        return 'wait';
      }
      const cmd = await this.command();
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
        const title = `施放「${skill.name}」── 答對才能借用字靈之力`;
        const q = nextQuestion(state.learned);
        const ok = skill.cd ? await ui.tileQuiz(q, { title }) : await ui.quiz(q, { title });
        if (skill.cd) this.cd[skill.id] = skill.cd;
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

  // 箭矢或火球由英雄飛向目標
  async projectile(fx, target) {
    const kind = fx === 'fire' || fx === 'ice' || fx === 'spark' ? 'fire' : 'arrow';
    const p = new Billboard(`fx_${kind}`, { fps: 12, shadow: false, castShadow: false, glow: 1.2, height: kind === 'fire' ? 0.9 : 0.8 });
    const from = this.hero.home.clone().add(new THREE.Vector3(-0.6, 0.9, 0));
    const to = target.sprite.pivot.position.clone().add(new THREE.Vector3(0.3, target.sprite.height * 0.35, 0.1));
    p.pivot.position.copy(from);
    if (kind === 'arrow') p.setFlip(true);
    this.scene.add(p.pivot);
    this.sprites.push(p);
    await tween(260, t => { p.pivot.position.lerpVectors(from, to, t); p.pivot.position.y += Math.sin(t * Math.PI) * 0.5; });
    this.scene.remove(p.pivot);
    this.sprites = this.sprites.filter(s => s !== p);
    p.dispose();
  }

  async heroStrike(target, power, fx, { crit = false } = {}) {
    const hs = this.hero.sprite;
    const from = this.hero.home.clone();
    // 劍士衝上前；法師、弓手原地施放
    const melee = state.classId === 'swordsman';
    const to = melee ? target.sprite.pivot.position.clone().add(new THREE.Vector3(1.4, 0, 0)) : from.clone().add(new THREE.Vector3(-0.4, 0, 0));
    this.pose(true);
    await tween(220, t => hs.pivot.position.lerpVectors(from, to, t));
    if (!melee) await this.projectile(fx, target);
    await this.hit(target, this.damageTo(target, power, crit), fx, crit);
    await tween(220, t => hs.pivot.position.lerpVectors(to, from, t));
    this.pose(false);
  }

  async hit(target, dmg, fx, crit = false) {
    this.spawnFx(fx, target.sprite.pivot.position);
    this.shake = Math.max(this.shake || 0, crit ? 0.45 : 0.28);
    await sleep(70); // 命中停格
    const home = target.home.clone();
    tween(260, t => { target.sprite.pivot.position.x = home.x - Math.sin(t * Math.PI) * 0.45; });
    sfx(['fire', 'ice', 'spark'].includes(fx) ? 'fire' : ['arrow', 'roll', 'forest'].includes(fx) ? 'arrow' : 'hit');
    target.hp -= dmg;
    this.popNumber(target.sprite.pivot.position, target.sprite.height, dmg, crit ? 'crit' : '');
    await this.flash(target.sprite);
    if (target.hp <= 0 && target.def.phase2 && !target.phase2) {
      await this.transform(target);
    } else if (target.hp <= 0) {
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
    const big = skill.cd >= 3;
    if (big) await this.cinematic(true);
    const alive = () => this.enemies.filter(e => e.alive);
    if (skill.kind === 'damage') {
      await this.heroStrike(target, skill.power, skill.fx);
    } else if (skill.kind === 'damage_all') {
      this.pose(true);
      await tween(250, t => { this.hero.sprite.pivot.position.y = Math.sin(t * Math.PI) * 0.4; });
      await Promise.all(alive().map(e => this.projectile(skill.fx, e)));
      await Promise.all(alive().map(e => this.hit(e, this.damageTo(e, skill.power), skill.fx)));
      this.pose(false);
    } else if (skill.kind === 'multi_hit') {
      this.pose(true);
      for (let k = 0; k < skill.hits; k++) {
        const a = alive();
        if (!a.length) break;
        const t = a[(Math.random() * a.length) | 0];
        await this.projectile(skill.fx, t);
        await this.hit(t, this.damageTo(t, skill.power), skill.fx);
      }
      this.pose(false);
    }
    if (skill.heal) {
      const amt = Math.round(maxHp() * skill.heal);
      state.hp = Math.min(maxHp(), state.hp + amt);
      sfx('heal');
      this.spawnFx('heal', this.hero.sprite.pivot.position);
      this.popNumber(this.hero.sprite.pivot.position, this.hero.sprite.height, `+${amt}`, 'heal');
      this.renderStatus();
      await sleep(600);
    }
    if (skill.guard) {
      this.hero.guardTurns = skill.guard;
      this.setShield(true);
      this.log(`護盾展開！之後 ${skill.guard} 回合受到的傷害減半。`);
      await sleep(700);
    }
    if (big) await this.cinematic(false);
    if (skill.kind === 'heal') {
      const amt = Math.round(maxHp() * skill.power);
      state.hp = Math.min(maxHp(), state.hp + amt);
      sfx('heal');
      this.spawnFx('heal', this.hero.sprite.pivot.position);
      this.popNumber(this.hero.sprite.pivot.position, this.hero.sprite.height, `+${amt}`, 'heal');
      this.renderStatus();
      await sleep(700);
    }
    await sleep(300);
  }

  async enemyAttack(e) {
    // 頭目每隔幾回合使出重擊（前一回合先蓄力）
    e.turns = (e.turns || 0) + 1;
    // 暴走形態的節奏：封印＋攻擊 → 墨水連擊 → 蓄力 → 重擊
    const every = e.phase2 ? e.def.phase2.heavyEvery : e.def.heavyEvery;
    const heavy = every && e.turns % every === 0;
    const charging = !heavy && every && (e.turns + 1) % every === 0;
    if (charging) { this.log(`${e.name}正在蓄力……`); await sleep(900); return; }
    if (heavy) { this.log(`${e.name}的重擊！`); await this.strike(e, 1.8); return; }
    if (e.phase2) {
      // 暴走形態：沒有封印時先封印一招，否則墨水連擊（攻擊兩次）
      if (!this.sealed && e.turns % every === 1) {
        const skills = unlockedSkills();
        const s = skills[(Math.random() * skills.length) | 0];
        this.sealed = { id: s.id, turns: 2 };
        this.log(`${e.name}用亂碼封印了「${s.name}」！（2 回合）`);
        sfx('fail');
        await this.flash(this.hero.sprite);
        await sleep(700);
        await this.strike(e, 1);
        return;
      }
      this.log(`${e.name}的墨水連擊！`);
      await this.strike(e, 0.8);
      if (state.hp > 0) await this.strike(e, 0.8);
      return;
    }
    this.log(`${e.name}的攻擊！`);
    await this.strike(e, 1);
  }

  async strike(e, mult) {
    const sp = e.sprite;
    const from = e.home.clone();
    const to = this.hero.home.clone().add(new THREE.Vector3(-1.3, 0, 0));
    await tween(220, t => sp.pivot.position.lerpVectors(from, to, t));
    const s = stats();
    const atk = e.phase2 ? e.def.phase2.atk : e.def.atk;
    let d = Math.max(1, Math.round(atk * mult * rand(0.85, 1.15) - s.def * 0.5));
    if (this.hero.guardTurns > 0) d = Math.max(1, Math.round(d / 2));
    state.hp -= d;
    sfx('hurt');
    this.popNumber(this.hero.sprite.pivot.position, this.hero.sprite.height, d, 'hurt');
    this.flash(this.hero.sprite);
    this.renderStatus();
    await tween(220, t => sp.pivot.position.lerpVectors(to, from, t));
    await sleep(250);
  }

  // 亂字魔復活成暴走形態：變紅紫、變大、捲起墨水漩渦與亂碼，血量回滿
  async transform(e) {
    e.hp = 0;
    this.renderStatus();
    this.log(`${e.name}倒下了……？`);
    await sleep(1000);
    sfx('lose');
    this.log('墨水重新聚合起來——亂字魔進入暴走形態！');
    const sp = e.sprite;
    const m = sp.mesh.material;
    // 墨水漩渦：黑色墨點與紫色亂碼繞着頭目旋轉
    const group = new THREE.Group();
    const blobTex = (() => {
      const c = document.createElement('canvas'); c.width = c.height = 32;
      const g = c.getContext('2d');
      const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
      gr.addColorStop(0, 'rgba(20,6,30,0.95)'); gr.addColorStop(1, 'rgba(20,6,30,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
      return new THREE.CanvasTexture(c);
    })();
    const parts = [];
    const chars = '亂字魔墨心目口冷言感';
    for (let i = 0; i < 26; i++) {
      let mat;
      if (i % 3 === 0) {
        const c = document.createElement('canvas'); c.width = c.height = 64;
        const g = c.getContext('2d');
        g.fillStyle = '#e0b0ff'; g.font = 'bold 44px serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(chars[i % chars.length], 32, 34);
        mat = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false });
      } else mat = new THREE.SpriteMaterial({ map: blobTex, transparent: true, depthWrite: false });
      const s = new THREE.Sprite(mat);
      s.scale.setScalar(i % 3 === 0 ? 0.5 : 0.35 + (i % 4) * 0.08);
      s.userData = { a: i / 26 * Math.PI * 2, r: 1.2 + (i % 5) * 0.18, y: 0.3 + (i % 7) * 0.4, sp: 1.2 + (i % 3) * 0.4 };
      group.add(s);
      parts.push(s);
    }
    group.position.copy(e.home);
    this.scene.add(group);
    this.vortex = t => parts.forEach(s => {
      const u = s.userData, a = u.a + t * u.sp;
      s.position.set(Math.cos(a) * u.r, u.y + Math.sin(t * 2 + u.a) * 0.2, Math.sin(a) * u.r * 0.6);
    });
    // 閃爍、變色、放大、血量回滿
    await tween(1200, t => {
      const k = Math.sin(t * Math.PI * 8) > 0;
      m.emissiveIntensity = k ? 2 : 0.3;
      sp.pivot.scale.setScalar(1 + 0.3 * t);
      e.hp = Math.round(e.maxHp * t);
      this.renderStatus();
    });
    m.color.set(0xff7a9a);
    m.emissive.set(0x7a1040);
    m.emissiveIntensity = 0.55;
    e.hp = e.maxHp;
    e.phase2 = true;
    e.turns = 0;
    e.name = e.def.phase2.name;
    this.renderStatus();
    sfx('levelup');
    this.log(`${e.name}出現了！牠會連續攻擊，還會封印你的技能！`);
    await sleep(1400);
  }

  // 第三招的演出：鏡頭推向英雄、背景變暗
  async cinematic(on) {
    const dim = document.querySelector('#battle-dim') || Object.assign(document.body.appendChild(document.createElement('div')), { id: 'battle-dim' });
    dim.classList.toggle('on', on);
    const d0 = this.engine.distance, d1 = on ? 11 : 15;
    const f0 = this.camFocus ? this.camFocus.clone() : new THREE.Vector3(0, 1.5, 0.6);
    const f1 = on ? new THREE.Vector3(1.6, 1.4, 0.6) : new THREE.Vector3(0, 1.5, 0.6);
    this.camFocus = f0;
    await tween(on ? 380 : 320, t => { this.engine.distance = d0 + (d1 - d0) * t; this.camFocus.lerpVectors(f0, f1, t); });
    if (!on) this.camFocus = null;
    if (on) { sfx('levelup'); await sleep(250); }
  }

  // 英雄四周的藍色護盾光效
  setShield(on) {
    if (on && !this.shield) {
      const m = new THREE.MeshBasicMaterial({ color: 0x6ab8ff, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide });
      this.shield = new THREE.Mesh(new THREE.SphereGeometry(1.1, 24, 16), m);
      this.shield.scale.set(0.9, 1.25, 0.6);
      this.shield.position.y = 1.2;
      this.hero.sprite.pivot.add(this.shield);
      const base = performance.now();
      const pulse = () => { if (!this.shield) return; m.opacity = 0.22 + Math.sin((performance.now() - base) / 250) * 0.08; requestAnimationFrame(pulse); };
      pulse();
    } else if (!on && this.shield) {
      this.shield.parent?.remove(this.shield);
      this.shield = null;
    }
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
    let key = `fx_${kind}`;
    if (!sheetEntry(key) && ASSETS[key]?.fallback) key = ASSETS[key].fallback;
    const fx = new Billboard(key, { fps: 12, shadow: false, castShadow: false, glow: 1.2 });
    const life = (fx.def.cols * fx.def.rows) / 12 * 1000 + 40;
    fx.pivot.position.copy(pos).add(new THREE.Vector3(0, 0, 0.3));
    this.scene.add(fx.pivot);
    this.sprites.push(fx);
    setTimeout(() => { this.scene.remove(fx.pivot); this.sprites = this.sprites.filter(s => s !== fx); fx.dispose(); }, life);
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
