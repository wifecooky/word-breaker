// ── 音效系统 — Web Audio API 合成，零资源依赖 ──────

let ctx: AudioContext | null = null
let muted = false

function getCtx(): AudioContext | null {
  if (!ctx) {
    try { ctx = new AudioContext() } catch { return null }
  }
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

function osc(
  freq: number,
  duration: number,
  type: OscillatorType = 'sine',
  volume = 0.12,
  detune = 0,
): void {
  if (muted) return
  const ac = getCtx()
  if (!ac) return
  const o = ac.createOscillator()
  const g = ac.createGain()
  o.type = type
  o.frequency.value = freq
  o.detune.value = detune
  g.gain.setValueAtTime(volume, ac.currentTime)
  g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration)
  o.connect(g).connect(ac.destination)
  o.start()
  o.stop(ac.currentTime + duration)
}

function noise(duration: number, volume = 0.06): void {
  if (muted) return
  const ac = getCtx()
  if (!ac) return
  const buf = ac.createBuffer(1, ac.sampleRate * duration, ac.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1)
  const src = ac.createBufferSource()
  src.buffer = buf
  const g = ac.createGain()
  g.gain.setValueAtTime(volume, ac.currentTime)
  g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration)
  src.connect(g).connect(ac.destination)
  src.start()
}

// ── 公开音效 ──────────────────────────────────────

export function paddleHit(): void {
  osc(660, 0.08, 'triangle', 0.10)
  osc(990, 0.06, 'sine', 0.05)
}

export function brickHit(): void {
  osc(440, 0.10, 'square', 0.06)
  osc(880, 0.06, 'sine', 0.04)
}

export function targetHit(): void {
  osc(523, 0.12, 'sine', 0.12)
  osc(659, 0.10, 'sine', 0.10)
  osc(784, 0.15, 'triangle', 0.08)
}

export function wallBounce(): void {
  osc(320, 0.04, 'sine', 0.04)
}

export function ballLost(): void {
  osc(180, 0.3, 'sawtooth', 0.10)
  osc(120, 0.4, 'sine', 0.08)
}

export function powerUpCollect(): void {
  osc(523, 0.08, 'sine', 0.10)
  setTimeout(() => osc(659, 0.08, 'sine', 0.10), 60)
  setTimeout(() => osc(784, 0.08, 'sine', 0.10), 120)
  setTimeout(() => osc(1047, 0.12, 'sine', 0.08), 180)
}

export function levelClear(): void {
  const notes = [523, 587, 659, 784, 1047]
  notes.forEach((f, i) => {
    setTimeout(() => osc(f, 0.2, 'triangle', 0.10), i * 100)
  })
}

export function comboTick(combo: number): void {
  const freq = 440 + combo * 60
  osc(Math.min(freq, 1200), 0.06, 'sine', 0.08)
}

export function launch(): void {
  osc(330, 0.06, 'triangle', 0.06)
  osc(440, 0.08, 'sine', 0.04, 5)
}

export function gameOver(): void {
  const notes = [392, 330, 262, 196]
  notes.forEach((f, i) => {
    setTimeout(() => osc(f, 0.3, 'sawtooth', 0.08), i * 150)
  })
}

export function win(): void {
  const notes = [523, 659, 784, 1047, 784, 1047]
  notes.forEach((f, i) => {
    setTimeout(() => osc(f, 0.2, 'triangle', 0.12), i * 120)
  })
}

export function click(): void {
  osc(800, 0.03, 'sine', 0.06)
  noise(0.02, 0.03)
}

// ── 静音控制 ──────────────────────────────────────

export function toggleMute(): boolean {
  muted = !muted
  return muted
}

export function isMuted(): boolean {
  return muted
}

// ── 单词发音 — Speech Synthesis API ─────────────��──

let speechSupported: boolean | null = null

export function speakWord(word: string): void {
  if (muted) return
  if (speechSupported === null) {
    speechSupported = 'speechSynthesis' in window
  }
  if (!speechSupported) return

  // 取消队列中的发音，避免叠加
  speechSynthesis.cancel()

  const u = new SpeechSynthesisUtterance(word)
  u.lang = 'en-US'
  u.rate = 0.9
  u.volume = 0.7
  speechSynthesis.speak(u)
}
