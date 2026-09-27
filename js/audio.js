// 音樂：優先播放 assets/music 的音樂檔；音效和備用音樂用 Web Audio 即時合成
let ctx = null, master, musicBus, sfxBus;
let muted = false;
try { muted = localStorage.getItem('idiom-rpg-muted') === '1'; } catch {}

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 1;
  master.connect(ctx.destination);
  musicBus = ctx.createGain(); musicBus.gain.value = 0.16; musicBus.connect(master);
  sfxBus = ctx.createGain(); sfxBus.gain.value = 0.45; sfxBus.connect(master);
  return ctx;
}

// 瀏覽器要求用戶先互動才可發聲。iPad／iPhone 的 Safari 更嚴格：
// 音樂的 <audio> 必須在點擊當下播放過一次才算解鎖，之後換歌才可以自動播放。
const unlock = () => {
  if (!ensure()) return;
  // iOS 17+：當作「播放媒體」，靜音鍵開着也有聲（和影片一樣）
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch {}
  primePlayers();
  const go = () => { if (music.pending) music.play(music.pending, true); };
  ctx.state !== 'running' ? ctx.resume().then(go, () => {}) : go();
};
for (const ev of ['pointerdown', 'touchend', 'click', 'keydown']) window.addEventListener(ev, unlock, true);

const hz = m => 440 * Math.pow(2, (m - 69) / 12);

function tone(bus, { freq, type = 'triangle', t = ctx.currentTime, dur = 0.2, vol = 0.3, attack = 0.01, slideTo, filter }) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let node = o;
  if (filter) {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = filter;
    o.connect(f); node = f;
  }
  node.connect(g); g.connect(bus);
  o.start(t); o.stop(t + dur + 0.05);
}

let noiseBuf = null;
function noise(bus, { t = ctx.currentTime, dur = 0.15, vol = 0.3, from = 3000, to = 300, type = 'lowpass' }) {
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(from, t);
  f.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(bus);
  src.start(t); src.stop(t + dur + 0.05);
}

// ---------------- 音效 ----------------
const SFX = {
  click: t => tone(sfxBus, { freq: 880, t, dur: 0.06, vol: 0.15, type: 'square', filter: 3000 }),
  correct: t => { tone(sfxBus, { freq: hz(84), t, dur: 0.18, vol: 0.3 }); tone(sfxBus, { freq: hz(88), t: t + 0.1, dur: 0.35, vol: 0.3 }); },
  wrong: t => { tone(sfxBus, { freq: 220, t, dur: 0.18, vol: 0.2, type: 'square', filter: 900 }); tone(sfxBus, { freq: 165, t: t + 0.15, dur: 0.3, vol: 0.2, type: 'square', filter: 900 }); },
  fail: t => tone(sfxBus, { freq: 400, slideTo: 120, t, dur: 0.4, vol: 0.2, type: 'sawtooth', filter: 1200 }),
  learn: t => [72, 76, 79, 84].forEach((m, i) => tone(sfxBus, { freq: hz(m), t: t + i * 0.08, dur: 0.4, vol: 0.25 })),
  quest: t => { tone(sfxBus, { freq: hz(79), t, dur: 0.2, vol: 0.25 }); tone(sfxBus, { freq: hz(84), t: t + 0.12, dur: 0.4, vol: 0.25 }); },
  levelup: t => [72, 76, 79, 84, 88, 91].forEach((m, i) => tone(sfxBus, { freq: hz(m), t: t + i * 0.07, dur: 0.5, vol: 0.22 })),
  hit: t => { noise(sfxBus, { t, dur: 0.12, vol: 0.5, from: 4000, to: 500 }); tone(sfxBus, { freq: 180, slideTo: 60, t, dur: 0.15, vol: 0.4, type: 'sine' }); },
  fire: t => { noise(sfxBus, { t, dur: 0.5, vol: 0.45, from: 600, to: 3500 }); tone(sfxBus, { freq: 90, slideTo: 50, t, dur: 0.4, vol: 0.35, type: 'sine' }); },
  arrow: t => { noise(sfxBus, { t, dur: 0.12, vol: 0.3, from: 6000, to: 2000, type: 'bandpass' }); tone(sfxBus, { freq: 300, slideTo: 90, t: t + 0.08, dur: 0.1, vol: 0.3, type: 'sine' }); },
  heal: t => [79, 83, 86, 91].forEach((m, i) => tone(sfxBus, { freq: hz(m), t: t + i * 0.06, dur: 0.6, vol: 0.16, type: 'sine' })),
  hurt: t => { tone(sfxBus, { freq: 140, slideTo: 70, t, dur: 0.2, vol: 0.4, type: 'square', filter: 700 }); noise(sfxBus, { t, dur: 0.1, vol: 0.25, from: 1500, to: 300 }); },
  defeat: t => tone(sfxBus, { freq: 600, slideTo: 80, t, dur: 0.5, vol: 0.2, type: 'square', filter: 1500 }),
  victory: t => [[72, 0], [72, 0.12], [72, 0.24], [76, 0.36], [79, 0.6], [84, 0.84]].forEach(([m, d]) => tone(sfxBus, { freq: hz(m), t: t + d, dur: d > 0.7 ? 0.8 : 0.2, vol: 0.25, type: 'square', filter: 2500 })),
  lose: t => [67, 63, 60, 55].forEach((m, i) => tone(sfxBus, { freq: hz(m), t: t + i * 0.25, dur: 0.4, vol: 0.2 })),
  door: t => noise(sfxBus, { t, dur: 0.35, vol: 0.2, from: 800, to: 200 }),
  talk: t => tone(sfxBus, { freq: 660, t, dur: 0.04, vol: 0.08, type: 'square', filter: 2000 }),
};

export function sfx(name) {
  if (!ensure() || ctx.state !== 'running') return;
  SFX[name]?.(ctx.currentTime + 0.01);
}

// ---------------- 背景音樂 ----------------
// 每首 4 小節循環；每小節 8 個八分音符。mel 為 MIDI 音高（null = 休止）。
const TRACKS = {
  town: {
    bpm: 92, lead: 'triangle', drums: false,
    bars: [
      { chord: [48, 55, 64], mel: [76, null, 79, null, 84, null, 79, 76] },
      { chord: [45, 52, 60], mel: [81, null, 76, null, 72, null, 76, null] },
      { chord: [41, 48, 57], mel: [77, null, 81, null, 84, null, 81, 77] },
      { chord: [43, 50, 59], mel: [79, null, 83, null, 86, null, 83, null] },
    ],
  },
  field: {
    bpm: 112, lead: 'triangle', drums: false,
    bars: [
      { chord: [43, 50, 59], mel: [67, null, 71, 74, null, 71, 72, 74] },
      { chord: [40, 47, 55], mel: [76, null, 74, 71, null, 67, 69, 71] },
      { chord: [36, 43, 52], mel: [72, null, 76, 79, null, 76, 74, 72] },
      { chord: [38, 45, 54], mel: [74, null, null, 71, 69, null, 66, null] },
    ],
  },
  battle: {
    bpm: 150, lead: 'square', drums: true, pump: true,
    bars: [
      { chord: [45, 52, 60], mel: [69, 72, 76, 72, 69, 72, 76, 79] },
      { chord: [41, 48, 57], mel: [77, 76, 72, 69, 65, 69, 72, 77] },
      { chord: [43, 50, 59], mel: [79, 77, 74, 71, 67, 71, 74, 79] },
      { chord: [40, 47, 56], mel: [76, null, 75, null, 76, null, 71, null] },
    ],
  },
  boss: {
    bpm: 160, lead: 'sawtooth', drums: true, pump: true,
    bars: [
      { chord: [38, 45, 53], mel: [62, 65, 69, 74, 73, 74, 69, 65] },
      { chord: [34, 41, 50], mel: [70, 69, 65, 62, 58, 62, 65, 70] },
      { chord: [36, 43, 52], mel: [72, 70, 67, 64, 60, 64, 67, 72] },
      { chord: [33, 40, 49], mel: [69, null, 68, null, 69, null, 73, null] },
    ],
  },
};

// 正式音樂檔（CC0，來源見 assets/music/README.md）；進入該場景才載入。
// 檔案載入失敗時改用上面的合成音樂。
const FILES = {
  town: 'assets/music/town.mp3',
  field: 'assets/music/field.mp3',
  battle: 'assets/music/battle.mp3',
  boss: 'assets/music/boss.mp3',
  ending: 'assets/music/ending.mp3',
};
const FILE_VOL = 3; // 經 musicBus（0.16）後約 0.5
const failed = new Set(); // 載入失敗的曲目 → 改用合成音樂

// 兩個輪流使用的播放器（換歌時一個淡出、一個淡入）
const players = [];
function initPlayers() {
  if (players.length) return;
  for (let i = 0; i < 2; i++) {
    const el = new Audio();
    el.loop = true;
    el.preload = 'auto';
    el.setAttribute('playsinline', '');
    const gain = ctx.createGain();
    gain.gain.value = 0;
    ctx.createMediaElementSource(el).connect(gain);
    gain.connect(musicBus);
    const p = { el, gain, name: null, primed: false };
    el.addEventListener('error', () => {
      if (!p.name) return;
      failed.add(p.name);
      if (music.file === p && !music.timer) music.startSynth(p.name);
    });
    players.push(p);
  }
}
// 在點擊當下各播放一下（音量為 0），令 iOS 解鎖這兩個播放器
function primePlayers() {
  initPlayers();
  for (const p of players) {
    if (p.primed) continue;
    p.primed = true;
    if (!p.el.src) { p.name = 'town'; p.el.src = FILES.town; }
    p.el.play().then(() => { if (music.file !== p) p.el.pause(); }, () => { p.primed = false; });
  }
}

function fade(gain, to, sec) {
  const t = ctx.currentTime;
  gain.gain.cancelScheduledValues(t);
  gain.gain.setValueAtTime(gain.gain.value, t);
  gain.gain.linearRampToValueAtTime(to, t + sec);
}

export const music = {
  current: null, pending: null, timer: null, step: 0, nextTime: 0, file: null, last: null,
  play(name, force = false) {
    if (!force && this.current === name) return;
    this.stop();
    this.pending = name;
    if (!ensure() || ctx.state !== 'running') return;
    this.pending = null;
    this.current = name;
    if (FILES[name] && !failed.has(name)) {
      initPlayers();
      const p = players.find(q => q !== this.last) || players[0];
      this.file = p;
      if (p.name !== name) { p.name = name; p.el.src = FILES[name]; }
      p.el.currentTime = 0;
      fade(p.gain, FILE_VOL, 1.2);
      p.el.play().catch(() => {});
    } else this.startSynth(name);
  },
  startSynth(name) {
    if (!TRACKS[name]) return;
    this.step = 0;
    this.nextTime = ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 25);
  },
  stop() {
    clearInterval(this.timer);
    this.timer = null;
    if (this.file) {
      const p = this.file;
      fade(p.gain, 0, 0.6);
      setTimeout(() => { if (this.file !== p) p.el.pause(); }, 700);
      this.last = p;
      this.file = null;
    }
    this.current = null;
    this.pending = null;
  },
  schedule() {
    const tr = TRACKS[this.current];
    if (!tr) return;
    const stepDur = 60 / tr.bpm / 2;
    while (this.nextTime < ctx.currentTime + 0.12) {
      const bar = tr.bars[Math.floor(this.step / 8) % tr.bars.length];
      const i = this.step % 8;
      const t = this.nextTime;
      const m = bar.mel[i];
      if (m != null) tone(musicBus, { freq: hz(m), t, dur: stepDur * 1.8, vol: tr.lead === 'triangle' ? 0.35 : 0.14, type: tr.lead, filter: tr.lead === 'triangle' ? null : 2200 });
      // 低音
      if (tr.pump || i % 4 === 0) tone(musicBus, { freq: hz(bar.chord[0]), t, dur: stepDur * (tr.pump ? 0.9 : 3.5), vol: 0.35, type: tr.pump ? 'square' : 'sine', filter: 500 });
      // 和弦墊底
      if (i === 0) for (const n of bar.chord.slice(1)) tone(musicBus, { freq: hz(n + 12), t, dur: stepDur * 8, vol: 0.06, type: 'sawtooth', attack: 0.3, filter: 900 });
      // 輕快的琶音（主城、郊區）
      if (!tr.drums && i % 2 === 1) tone(musicBus, { freq: hz(bar.chord[1 + ((i >> 1) % 2)] + 24), t, dur: stepDur, vol: 0.07, type: 'sine' });
      if (tr.drums) {
        if (i % 4 === 0) tone(musicBus, { freq: 120, slideTo: 45, t, dur: 0.12, vol: 0.6, type: 'sine' });
        if (i % 4 === 2) noise(musicBus, { t, dur: 0.1, vol: 0.25, from: 5000, to: 1500 });
        noise(musicBus, { t, dur: 0.03, vol: 0.06, from: 9000, to: 7000, type: 'highpass' });
      }
      this.nextTime += stepDur;
      this.step++;
    }
  },
};

export function isMuted() { return muted; }
export function toggleMute() {
  muted = !muted;
  try { localStorage.setItem('idiom-rpg-muted', muted ? '1' : '0'); } catch {}
  if (ensure()) master.gain.value = muted ? 0 : 1;
  return muted;
}
