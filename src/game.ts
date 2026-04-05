import { PretextRenderer } from './renderer'
import { LEVELS, WALL_TEXT, type WordEntry } from './words'

// ── 常量 ──────────────────────────────────────────
const VIEW = { width: 1200, height: 800 }
const PLAY_AREA = { x: 30, y: 100, width: 1140, height: 670 }

// 字体族常量
const FM = '"JetBrains Mono", "SF Mono", "Fira Code", monospace'
const FS = '"Inter", "Helvetica Neue", sans-serif'
const FC = '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif'

const FONTS = {
  brick: `700 22px ${FM}`,
  brickZh: `400 13px ${FC}`,
  paddle: `700 24px ${FM}`,
  ball: `700 20px ${FS}`,
  hud: `700 18px ${FM}`,
  hudSmall: `400 15px ${FC}`,
  title: `700 56px ${FM}`,
  subtitle: `400 22px ${FC}`,
  wall: `400 14px ${FM}`,
  prompt: `700 26px ${FC}`,
  promptEn: `700 24px ${FM}`,
  particle: `700 16px ${FM}`,
  review: `700 18px ${FM}`,
  reviewZh: `400 16px ${FC}`,
  hint: `400 16px ${FC}`,
  border: `700 20px ${FM}`,
  combo: `700 36px ${FM}`,
  comboSmall: `700 22px ${FM}`,
}

const LINE_HEIGHTS = { wall: 20 }

const COLORS = {
  bg: '#080c16',
  // 柔和但区分度高的砖块色板 — 暖冷交替
  brick: ['#f59e6c', '#e8c95a', '#7dd96a', '#4fc4d6', '#7c9bff', '#b8a0f2', '#f28daa', '#6cd9c6'],
  brickTarget: '#ff5555',
  paddle: '#4be8a0',
  ball: '#fff4d6',
  // 文字墙用深蓝灰，不喧宾夺主
  wallText: ['#1a3050', '#172a45', '#14243b', '#1a3050', '#1f3452'],
  hud: '#8baac8',
  hudDim: '#506880',
  prompt: '#ffd93d',
  title: '#4be8a0',
  titleAlt: '#ffd93d',
  correct: '#4be8a0',
  wrong: '#ff5555',
  frame: '#162030',
  frameBright: '#5eb8cc',
  spark: '#b0f0ff',
  trail: '#fff4d6',
  lostLife: '#ff7b5c',
  score: '#ffe8a0',
  panel: '#f0edd8',   // 暖白
  dim: '#3a5068',
}

const BALL_SPEED = 420
const BALL_RADIUS = 14
const PADDLE_SPEED = 800
const BRICK_PADDING = 10
const BRICK_HEIGHT = 44
const WAKE_SPAWN_DISTANCE = 18

// ── 缓动函数 ─────────────────────────────────────
function easeOutCubic(t: number): number {
  return 1 - (1 - t) * (1 - t) * (1 - t)
}

function easeOutBack(t: number): number {
  return 1 + 1.70158 * (t - 1) * (t - 1) * (t - 1) + 2.70158 * (t - 1) * (t - 1)
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) * (-2 * t + 2) * (-2 * t + 2) / 2
}

// ── 类型 ──────────────────────────────────────────
interface Brick {
  x: number
  y: number
  width: number
  height: number
  word: WordEntry
  alive: boolean
  isTarget: boolean
  hitAlpha: number
  // 入场动画
  sourceX: number
  sourceY: number
  introDelay: number
}

interface Ball {
  x: number
  y: number
  vx: number
  vy: number
  wakePoint: { x: number; y: number } | null
}

interface Paddle {
  x: number
  width: number
  y: number
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  text: string
  color: string
  alpha: number
  life: number
  maxLife: number
  size: number
  rotation: number
  rotationSpeed: number
  gravity: number
  affectsWall: boolean
  wallRadius: number
}

interface FloatingText {
  x: number
  y: number
  text: string
  color: string
  alpha: number
  vy: number
  life: number
  scale: number
  font: string
}

interface WakeHole {
  x: number
  y: number
  radius: number
  life: number
  maxLife: number
}

type GameMode = 'title' | 'intro' | 'playing' | 'clearing' | 'review' | 'gameover' | 'win'

// ── 工具函数 ──────────────────────────────────────
function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function lerpColor(a: string, b: string, t: number): string {
  const ah = parseInt(a.slice(1), 16)
  const bh = parseInt(b.slice(1), 16)
  const ar = (ah >> 16) & 0xff, ag = (ah >> 8) & 0xff, ab = ah & 0xff
  const br = (bh >> 16) & 0xff, bg = (bh >> 8) & 0xff, bb = bh & 0xff
  const r = Math.round(lerp(ar, br, t))
  const g = Math.round(lerp(ag, bg, t))
  const bl = Math.round(lerp(ab, bb, t))
  return `#${((r << 16) | (g << 8) | bl).toString(16).padStart(6, '0')}`
}

// ── 游戏主类 ──────────────────────────────────────
export class WordBreaker {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private renderer: PretextRenderer
  private view = VIEW

  // 游戏状态
  private mode: GameMode = 'title'
  private level = 0
  private score = 0
  private lives = 3
  private combo = 0
  private maxCombo = 0

  // 游戏对象
  private bricks: Brick[] = []
  private ball: Ball = { x: 0, y: 0, vx: 0, vy: 0, wakePoint: null }
  private paddle: Paddle = { x: VIEW.width / 2, width: 100, y: PLAY_AREA.y + PLAY_AREA.height - 30 }
  private particles: Particle[] = []
  private floatingTexts: FloatingText[] = []
  private wakeHoles: WakeHole[] = []

  // 单词学习
  private targetWord: WordEntry | null = null
  private learnedWords: WordEntry[] = []
  private levelWords: WordEntry[] = []
  private correctHits = 0
  private wrongHits = 0

  // 输入状态
  private pointerX = VIEW.width / 2
  private pointerActive = false
  private ballLaunched = false
  private keys = new Set<string>()

  // 文字墙
  private wallPrepared: ReturnType<typeof this.renderer.prepareForWall> | null = null

  // 动画时间
  private lastTime = 0
  private gameTime = 0
  private introProgress = 0
  private clearProgress = 0
  private screenShake = 0
  private bgFlash = 0
  private bgFlashColor = '#ffffff'

  // 提示动画
  private promptFlash = 0
  private comboDisplay = 0 // combo 数字显示用

  // 拖尾帧计数
  private trailCounter = 0

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')!
    this.renderer = new PretextRenderer()

    this.resize()
    this.bindEvents()
    this.wallPrepared = this.renderer.prepareForWall(WALL_TEXT, FONTS.wall)
    this.lastTime = performance.now()

    requestAnimationFrame(this.tick)
  }

  private resize(): void {
    const dpr = window.devicePixelRatio || 1
    const rect = this.canvas.getBoundingClientRect()
    this.canvas.width = rect.width * dpr
    this.canvas.height = rect.height * dpr
    this.ctx.scale(dpr, dpr)
  }

  private bindEvents(): void {
    this.canvas.addEventListener('pointermove', (e) => {
      const rect = this.canvas.getBoundingClientRect()
      this.pointerX = ((e.clientX - rect.left) / rect.width) * this.view.width
      this.pointerActive = true
    })

    this.canvas.addEventListener('pointerdown', () => this.handleAction())

    window.addEventListener('keydown', (e) => {
      this.keys.add(e.key)
      if (e.key === ' ' || e.key === 'Enter') this.handleAction()
    })

    window.addEventListener('keyup', (e) => this.keys.delete(e.key))
    window.addEventListener('resize', () => this.resize())
  }

  private handleAction(): void {
    if (this.mode === 'title') {
      this.startLevel(0)
    } else if (this.mode === 'playing' && !this.ballLaunched) {
      this.launchBall()
    } else if (this.mode === 'review') {
      this.nextLevelOrWin()
    } else if (this.mode === 'gameover' || this.mode === 'win') {
      this.mode = 'title'
      this.score = 0
      this.lives = 3
      this.level = 0
      this.learnedWords = []
      this.maxCombo = 0
    }
  }

  // ── 关卡管理 ────────────────────────────────────
  private startLevel(levelIndex: number): void {
    this.level = levelIndex
    this.combo = 0
    this.correctHits = 0
    this.wrongHits = 0
    this.ballLaunched = false
    this.particles = []
    this.floatingTexts = []
    this.wakeHoles = []

    const words = LEVELS[levelIndex % LEVELS.length]!
    this.levelWords = [...words]
    this.buildBricks(words)

    // 进入 intro 动画
    this.mode = 'intro'
    this.introProgress = 0
  }

  private buildBricks(words: WordEntry[]): void {
    this.bricks = []
    const startY = PLAY_AREA.y + 30
    const maxWidth = PLAY_AREA.width - 60

    let rowX = PLAY_AREA.x + 30
    let rowY = startY

    for (let i = 0; i < words.length; i++) {
      const word = words[i]!
      const block = this.renderer.getBlock(word.en, FONTS.brick, 24)
      const brickW = block.width + 36

      if (rowX + brickW > PLAY_AREA.x + maxWidth) {
        rowX = PLAY_AREA.x + 30
        rowY += BRICK_HEIGHT + BRICK_PADDING
      }

      // 入场动画源位置（6种模式循环）
      const pattern = i % 6
      let sx: number, sy: number
      const finalX = rowX
      const finalY = rowY
      switch (pattern) {
        case 0: sx = -140 - Math.random() * 180; sy = finalY - 48 + Math.random() * 36; break
        case 1: sx = VIEW.width + 120 + Math.random() * 180; sy = finalY - 30 + Math.random() * 38; break
        case 2: sx = finalX + (Math.random() - 0.5) * 80; sy = -110 - Math.random() * 170; break
        case 3: sx = finalX + (Math.random() - 0.5) * 80; sy = VIEW.height + 120 + Math.random() * 160; break
        case 4: sx = -100 - Math.random() * 140; sy = -80 - Math.random() * 120; break
        default: sx = VIEW.width + 100 + Math.random() * 140; sy = VIEW.height + 80 + Math.random() * 120; break
      }

      this.bricks.push({
        x: finalX,
        y: finalY,
        width: brickW,
        height: BRICK_HEIGHT,
        word,
        alive: true,
        isTarget: false,
        hitAlpha: 0,
        sourceX: sx,
        sourceY: sy,
        introDelay: Math.min(0.46, i * 0.028),
      })

      rowX += brickW + BRICK_PADDING
    }
  }

  private pickTargetWord(): void {
    const alive = this.bricks.filter((b) => b.alive)
    if (alive.length === 0) return
    for (const b of this.bricks) b.isTarget = false
    const pick = alive[Math.floor(Math.random() * alive.length)]!
    pick.isTarget = true
    this.targetWord = pick.word
    this.promptFlash = 1
  }

  private resetBallAndPaddle(): void {
    this.paddle.x = this.view.width / 2
    this.ball.x = this.paddle.x
    this.ball.y = this.paddle.y - 16
    this.ball.vx = 0
    this.ball.vy = 0
    this.ball.wakePoint = null
    this.ballLaunched = false
  }

  private launchBall(): void {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.6
    this.ball.vx = Math.cos(angle) * BALL_SPEED
    this.ball.vy = Math.sin(angle) * BALL_SPEED
    this.ballLaunched = true
  }

  // ── 游戏循环 ────────────────────────────────────
  private tick = (now: number): void => {
    const dt = Math.min((now - this.lastTime) / 1000, 0.05)
    this.lastTime = now
    this.gameTime += dt

    this.update(dt)
    this.draw()

    requestAnimationFrame(this.tick)
  }

  private update(dt: number): void {
    this.promptFlash = Math.max(0, this.promptFlash - dt * 2)
    this.bgFlash = Math.max(0, this.bgFlash - dt * 4)
    this.comboDisplay = Math.max(0, this.comboDisplay - dt * 3)

    // 屏幕震动衰减
    this.screenShake = Math.max(0, this.screenShake - dt * 16)

    // 始终更新粒子（所有模式）
    this.updateParticles(dt)
    this.updateFloatingTexts(dt)
    this.updateWakeHoles(dt)

    if (this.mode === 'intro') {
      this.introProgress += dt / 2.0 // 2 秒 intro
      if (this.introProgress >= 1) {
        this.mode = 'playing'
        this.introProgress = 1
        this.pickTargetWord()
        this.resetBallAndPaddle()
      }
      return
    }

    if (this.mode === 'clearing') {
      this.clearProgress += dt / 1.5
      if (this.clearProgress >= 1) {
        this.mode = 'review'
      }
      return
    }

    if (this.mode !== 'playing') return

    // 挡板移动
    const usingKeyboard = this.keys.has('ArrowLeft') || this.keys.has('ArrowRight') || this.keys.has('a') || this.keys.has('d')
    if (usingKeyboard) {
      this.pointerActive = false
      if (this.keys.has('ArrowLeft') || this.keys.has('a')) this.paddle.x -= PADDLE_SPEED * dt
      if (this.keys.has('ArrowRight') || this.keys.has('d')) this.paddle.x += PADDLE_SPEED * dt
    } else if (this.pointerActive) {
      this.paddle.x = lerp(this.paddle.x, this.pointerX, 0.15)
    }
    this.paddle.x = clamp(this.paddle.x, PLAY_AREA.x + this.paddle.width / 2, PLAY_AREA.x + PLAY_AREA.width - this.paddle.width / 2)

    if (!this.ballLaunched) {
      this.ball.x = this.paddle.x
      this.ball.y = this.paddle.y - 16
      return
    }

    // 球移动
    this.ball.x += this.ball.vx * dt
    this.ball.y += this.ball.vy * dt

    // 球拖尾粒子
    this.spawnBallTrail()

    // 轨迹空洞
    this.trackWake()

    // 墙壁碰撞
    if (this.ball.x - BALL_RADIUS < PLAY_AREA.x) {
      this.ball.x = PLAY_AREA.x + BALL_RADIUS
      this.ball.vx = Math.abs(this.ball.vx)
    }
    if (this.ball.x + BALL_RADIUS > PLAY_AREA.x + PLAY_AREA.width) {
      this.ball.x = PLAY_AREA.x + PLAY_AREA.width - BALL_RADIUS
      this.ball.vx = -Math.abs(this.ball.vx)
    }
    if (this.ball.y - BALL_RADIUS < PLAY_AREA.y) {
      this.ball.y = PLAY_AREA.y + BALL_RADIUS
      this.ball.vy = Math.abs(this.ball.vy)
    }

    // 球掉出底部
    if (this.ball.y > PLAY_AREA.y + PLAY_AREA.height + 20) {
      this.lives--
      this.combo = 0
      this.spawnLostLifeBurst()
      this.screenShake = 3.2
      if (this.lives <= 0) {
        this.mode = 'gameover'
      } else {
        this.resetBallAndPaddle()
      }
      return
    }

    this.checkPaddleCollision()
    this.checkBrickCollisions()

    // 检查清除
    if (this.bricks.every((b) => !b.alive)) {
      this.mode = 'clearing'
      this.clearProgress = 0
    }
  }

  private checkPaddleCollision(): void {
    const padLeft = this.paddle.x - this.paddle.width / 2
    const padRight = this.paddle.x + this.paddle.width / 2
    const padTop = this.paddle.y

    if (
      this.ball.vy > 0 &&
      this.ball.y + BALL_RADIUS >= padTop &&
      this.ball.y + BALL_RADIUS <= padTop + 16 &&
      this.ball.x >= padLeft &&
      this.ball.x <= padRight
    ) {
      const hitPos = (this.ball.x - this.paddle.x) / (this.paddle.width / 2)
      const angle = -Math.PI / 2 + hitPos * 0.7
      const speed = Math.sqrt(this.ball.vx * this.ball.vx + this.ball.vy * this.ball.vy)
      this.ball.vx = Math.cos(angle) * speed
      this.ball.vy = Math.sin(angle) * speed
      this.ball.y = padTop - BALL_RADIUS
      this.screenShake = 1.2
      this.spawnPaddleSparks()
    }
  }

  private checkBrickCollisions(): void {
    for (const brick of this.bricks) {
      if (!brick.alive) continue

      if (
        this.ball.x + BALL_RADIUS > brick.x &&
        this.ball.x - BALL_RADIUS < brick.x + brick.width &&
        this.ball.y + BALL_RADIUS > brick.y &&
        this.ball.y - BALL_RADIUS < brick.y + brick.height
      ) {
        brick.alive = false
        brick.hitAlpha = 1

        const overlapLeft = this.ball.x + BALL_RADIUS - brick.x
        const overlapRight = brick.x + brick.width - (this.ball.x - BALL_RADIUS)
        const overlapTop = this.ball.y + BALL_RADIUS - brick.y
        const overlapBottom = brick.y + brick.height - (this.ball.y - BALL_RADIUS)
        const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom)

        if (minOverlap === overlapLeft || minOverlap === overlapRight) {
          this.ball.vx = -this.ball.vx
        } else {
          this.ball.vy = -this.ball.vy
        }

        const cx = brick.x + brick.width / 2
        const cy = brick.y + brick.height / 2

        if (brick.isTarget) {
          const points = 100 + this.combo * 20
          this.score += points
          this.combo++
          this.correctHits++
          this.learnedWords.push(brick.word)
          this.comboDisplay = 1

          // 目标命中：字母爆炸 + 大量粒子
          this.spawnLetterBurst(cx, cy, brick.word.en, COLORS.correct)
          this.spawnParticles(cx, cy, COLORS.correct, 10, true)
          this.addFloatingText(cx, brick.y - 8, `+${points}`, COLORS.correct, FONTS.combo, 1.2)
          this.addFloatingText(cx, brick.y + 16, brick.word.zh, COLORS.prompt, FONTS.particle, 1)
          this.screenShake = 2.8
          this.bgFlash = 0.6
          this.bgFlashColor = COLORS.correct
          this.pickTargetWord()
        } else {
          this.score += 10
          this.wrongHits++
          this.combo = 0

          this.spawnLetterBurst(cx, cy, brick.word.en, COLORS.wrong)
          this.addFloatingText(cx, brick.y - 4, '+10', '#666666', FONTS.particle, 0.8)
          this.addFloatingText(cx, brick.y + 16, brick.word.zh, '#888888', FONTS.hint, 0.8)
          this.screenShake = 1.5
        }

        if (this.combo > this.maxCombo) this.maxCombo = this.combo
        break
      }
    }
  }

  // ── 粒子系统（6 种） ───────────────────────────────

  // 1. 字母爆炸 — 砖块破碎时字母散射
  private spawnLetterBurst(x: number, y: number, word: string, color: string): void {
    const chars = word.split('')
    for (let i = 0; i < chars.length; i++) {
      const angle = (Math.PI * 2 * i) / chars.length + (Math.random() - 0.5) * 0.35
      const speed = 80 + Math.random() * 120
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 30,
        text: chars[i]!,
        color,
        alpha: 1,
        life: 0,
        maxLife: 0.7 + Math.random() * 0.35,
        size: 14 + Math.random() * 4,
        rotation: 0,
        rotationSpeed: (Math.random() - 0.5) * 5,
        gravity: 90,
        affectsWall: true,
        wallRadius: 18,
      })
    }
  }

  // 2. 通用粒子爆发
  private spawnParticles(x: number, y: number, color: string, count: number, affectsWall = false): void {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.3
      const speed = 60 + Math.random() * 100
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 20,
        text: ['*', '+', '·', '○'][Math.floor(Math.random() * 4)]!,
        color,
        alpha: 1,
        life: 0,
        maxLife: 0.5 + Math.random() * 0.3,
        size: 8 + Math.random() * 6,
        rotation: 0,
        rotationSpeed: (Math.random() - 0.5) * 3,
        gravity: 80,
        affectsWall,
        wallRadius: affectsWall ? 12 : 0,
      })
    }
  }

  // 3. 挡板火花 — 球碰挡板时
  private spawnPaddleSparks(): void {
    const chars = ['=', '=', ':', ':']
    for (let i = 0; i < chars.length; i++) {
      this.particles.push({
        x: this.ball.x,
        y: this.paddle.y,
        vx: (Math.random() - 0.5) * 90,
        vy: -30 - Math.random() * 70,
        text: chars[i]!,
        color: COLORS.spark,
        alpha: 1,
        life: 0,
        maxLife: 0.35 + Math.random() * 0.15,
        size: 12,
        rotation: 0,
        rotationSpeed: 0,
        gravity: 60,
        affectsWall: false,
        wallRadius: 0,
      })
    }
  }

  // 4. 球拖尾
  private spawnBallTrail(): void {
    this.trailCounter++
    if (this.trailCounter % 2 !== 0) return // 每 2 帧一个
    const dx = this.ball.vx
    const dy = this.ball.vy
    if (dx * dx + dy * dy < 1) return

    this.particles.push({
      x: this.ball.x + (Math.random() - 0.5) * 4,
      y: this.ball.y + (Math.random() - 0.5) * 4,
      vx: (Math.random() - 0.5) * 22,
      vy: 16 + Math.random() * 20,
      text: Math.random() > 0.5 ? '.' : '·',
      color: COLORS.trail,
      alpha: 0.7,
      life: 0,
      maxLife: 0.26,
      size: 8,
      rotation: 0,
      rotationSpeed: 0,
      gravity: 0,
      affectsWall: false,
      wallRadius: 0,
    })
  }

  // 5. 失去生命爆发
  private spawnLostLifeBurst(): void {
    const chars = ['/', '\\', '!', '?', '_']
    for (let i = 0; i < chars.length; i++) {
      const angle = -Math.PI / 2 + (i - 2) * 0.35
      const speed = 90 + Math.random() * 40
      this.particles.push({
        x: this.paddle.x,
        y: this.paddle.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        text: chars[i]!,
        color: COLORS.lostLife,
        alpha: 1,
        life: 0,
        maxLife: 0.8,
        size: 16,
        rotation: 0,
        rotationSpeed: (Math.random() - 0.5) * 4,
        gravity: 90,
        affectsWall: false,
        wallRadius: 0,
      })
    }
  }

  // 6. 轨迹空洞
  private trackWake(): void {
    if (this.ball.wakePoint === null) {
      this.ball.wakePoint = { x: this.ball.x, y: this.ball.y }
      return
    }
    const dx = this.ball.x - this.ball.wakePoint.x
    const dy = this.ball.y - this.ball.wakePoint.y
    if (dx * dx + dy * dy < WAKE_SPAWN_DISTANCE * WAKE_SPAWN_DISTANCE) return

    this.wakeHoles.push({
      x: this.ball.x,
      y: this.ball.y,
      radius: BALL_RADIUS + 22,
      life: 0,
      maxLife: 0.42,
    })
    this.ball.wakePoint = { x: this.ball.x, y: this.ball.y }
  }

  private addFloatingText(x: number, y: number, text: string, color: string, font = FONTS.particle, scale = 1): void {
    this.floatingTexts.push({ x, y, text, color, alpha: 1, vy: -50, life: 0, scale, font })
  }

  private updateParticles(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]!
      p.life += dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vy += p.gravity * dt
      p.rotation += p.rotationSpeed * dt
      p.alpha = clamp(1 - p.life / p.maxLife, 0, 1)
      if (p.affectsWall) {
        p.wallRadius = 18 * (1 - p.life / p.maxLife)
      }
      if (p.life >= p.maxLife) this.particles.splice(i, 1)
    }
  }

  private updateFloatingTexts(dt: number): void {
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i]!
      ft.life += dt
      ft.y += ft.vy * dt
      ft.vy *= 0.96 // 减速
      ft.alpha = clamp(1 - ft.life / 1.5, 0, 1)
      if (ft.life >= 1.5) this.floatingTexts.splice(i, 1)
    }
  }

  private updateWakeHoles(dt: number): void {
    for (let i = this.wakeHoles.length - 1; i >= 0; i--) {
      const w = this.wakeHoles[i]!
      w.life += dt
      if (w.life >= w.maxLife) this.wakeHoles.splice(i, 1)
    }
  }

  private nextLevelOrWin(): void {
    if (this.level + 1 >= LEVELS.length) {
      this.mode = 'win'
    } else {
      this.startLevel(this.level + 1)
    }
  }

  // ── 渲染 ────────────────────────────────────────
  private draw(): void {
    const ctx = this.ctx
    ctx.save()

    // 屏幕震动
    if (this.screenShake > 0.01) {
      ctx.translate(
        (Math.random() - 0.5) * this.screenShake * 2.8,
        (Math.random() - 0.5) * this.screenShake * 2.2,
      )
    }

    // 背景
    ctx.fillStyle = COLORS.bg
    ctx.fillRect(0, 0, this.view.width, this.view.height)

    // 背景闪光
    if (this.bgFlash > 0.01) {
      ctx.save()
      ctx.globalAlpha = this.bgFlash * 0.15
      ctx.fillStyle = this.bgFlashColor
      ctx.fillRect(0, 0, this.view.width, this.view.height)
      ctx.restore()
    }

    // 文字墙（背景层）
    this.drawTextWall()

    // 罫線边框
    this.drawBoxBorder()

    if (this.mode === 'title') {
      this.drawTitleScreen()
    } else if (this.mode === 'intro') {
      this.drawIntroSequence()
    } else if (this.mode === 'playing') {
      this.drawHUD()
      this.drawPrompt()
      this.drawBricks()
      this.drawBall()
      this.drawPaddle()
      this.drawParticles()
      this.drawFloatingTexts()
      this.drawComboDisplay()
      if (!this.ballLaunched) this.drawLaunchHint()
    } else if (this.mode === 'clearing') {
      this.drawClearSweep()
    } else if (this.mode === 'review') {
      this.drawReviewScreen()
    } else if (this.mode === 'gameover') {
      this.drawGameOverScreen()
    } else if (this.mode === 'win') {
      this.drawWinScreen()
    }

    ctx.restore()
  }

  // ── 罫線边框 ────────────────────────────────────
  private drawBoxBorder(): void {
    const ctx = this.ctx
    const { x, y, width, height } = PLAY_AREA
    const color = COLORS.frameBright
    const alpha = 0.6

    ctx.save()
    ctx.globalAlpha = alpha
    ctx.font = FONTS.border
    ctx.fillStyle = color
    ctx.textBaseline = 'top'

    // 四角
    ctx.fillText('╔', x - 2, y - 2)
    ctx.fillText('╗', x + width - 12, y - 2)
    ctx.fillText('╚', x - 2, y + height - 16)
    ctx.fillText('╝', x + width - 12, y + height - 16)

    // 上下横线
    const hStep = 14
    for (let px = x + 16; px < x + width - 16; px += hStep) {
      ctx.fillText('═', px, y - 2)
      ctx.fillText('═', px, y + height - 16)
    }

    // 左右竖线
    const vStep = 18
    for (let py = y + 18; py < y + height - 18; py += vStep) {
      ctx.fillText('║', x - 2, py)
      ctx.fillText('║', x + width - 12, py)
    }

    ctx.restore()
  }

  // ── 文字墙 ──────────────────────────────────────
  private drawTextWall(): void {
    if (!this.wallPrepared) return
    const ctx = this.ctx
    const region = {
      x: PLAY_AREA.x + 14,
      y: PLAY_AREA.y + 14,
      width: PLAY_AREA.width - 28,
      height: PLAY_AREA.height - 28,
    }

    // intro 阶段文字墙渐入
    let wallAlpha = 0.45
    if (this.mode === 'intro') {
      wallAlpha = 0.45 * easeOutCubic(clamp(this.introProgress / 0.3, 0, 1))
    }

    let cursor: { segmentIndex: number; graphemeIndex: number } = { segmentIndex: 0, graphemeIndex: 0 }
    const lh = LINE_HEIGHTS.wall

    for (let lineTop = region.y; lineTop + lh <= region.y + region.height; lineTop += lh) {
      const slots = this.getWallSlots(region, lineTop, lineTop + lh)

      for (let si = 0; si < slots.length; si++) {
        const slot = slots[si]!
        const width = slot.right - slot.left
        if (width < 20) continue

        let line = this.renderer.layoutNextWallLine(this.wallPrepared, cursor, width)
        if (line === null) {
          cursor = { segmentIndex: 0, graphemeIndex: 0 }
          line = this.renderer.layoutNextWallLine(this.wallPrepared, cursor, width)
        }
        if (line === null) return

        const block = this.renderer.getBlock(line.text, FONTS.wall, lh)
        const colorIndex = (Math.floor(lineTop / lh) + si) % COLORS.wallText.length
        this.renderer.drawBlock(ctx, block, slot.left, lineTop, {
          alpha: wallAlpha,
          color: COLORS.wallText[colorIndex],
        })
        cursor = line.end
      }
    }
  }

  private getWallSlots(
    region: { x: number; y: number; width: number; height: number },
    bandTop: number,
    bandBottom: number,
  ): { left: number; right: number }[] {
    const blocked: { left: number; right: number }[] = []

    if (this.mode === 'playing' || this.mode === 'intro') {
      // 砖块
      for (const brick of this.bricks) {
        if (!brick.alive) continue
        let bx = brick.x, by = brick.y
        if (this.mode === 'intro') {
          const state = this.getBrickIntroState(brick)
          if (state.alpha < 0.04) continue
          bx = state.x; by = state.y
        }
        if (bandBottom <= by - 4 || bandTop >= by + brick.height + 4) continue
        blocked.push({ left: bx - 8, right: bx + brick.width + 8 })
      }

      // 球
      if (this.ballLaunched) {
        this.pushCircleBlocked(blocked, this.ball.x, this.ball.y, BALL_RADIUS + 30, bandTop, bandBottom)
      }

      // 挡板
      const padTop = this.paddle.y - 4
      const padBottom = this.paddle.y + 24
      if (bandBottom > padTop && bandTop < padBottom) {
        blocked.push({
          left: this.paddle.x - this.paddle.width / 2 - 12,
          right: this.paddle.x + this.paddle.width / 2 + 12,
        })
      }

      // 轨迹空洞
      for (const w of this.wakeHoles) {
        const r = w.radius * (1 - w.life / w.maxLife)
        this.pushCircleBlocked(blocked, w.x, w.y, r, bandTop, bandBottom)
      }

      // 影响墙的粒子
      for (const p of this.particles) {
        if (!p.affectsWall || p.alpha < 0.08 || p.wallRadius <= 0) continue
        this.pushCircleBlocked(blocked, p.x, p.y, p.wallRadius, bandTop, bandBottom)
      }
    }

    return this.carveSlots({ left: region.x, right: region.x + region.width }, blocked)
  }

  private pushCircleBlocked(
    blocked: { left: number; right: number }[],
    cx: number, cy: number, r: number,
    bandTop: number, bandBottom: number,
  ): void {
    const sampleY = (bandTop + bandBottom) / 2
    const dy = sampleY - cy
    if (Math.abs(dy) >= r) return
    const hw = Math.sqrt(r * r - dy * dy)
    blocked.push({ left: cx - hw, right: cx + hw })
  }

  private carveSlots(
    base: { left: number; right: number },
    blocked: { left: number; right: number }[],
  ): { left: number; right: number }[] {
    if (blocked.length === 0) return [base]

    const merged = blocked
      .map((i) => ({ left: clamp(i.left, base.left, base.right), right: clamp(i.right, base.left, base.right) }))
      .filter((i) => i.right > i.left)
      .sort((a, b) => a.left - b.left)

    const normalized: { left: number; right: number }[] = []
    for (const interval of merged) {
      const prev = normalized[normalized.length - 1]
      if (!prev || interval.left > prev.right) normalized.push({ ...interval })
      else prev.right = Math.max(prev.right, interval.right)
    }

    const slots: { left: number; right: number }[] = []
    let cursor = base.left
    for (const interval of normalized) {
      if (interval.left - cursor >= 18) slots.push({ left: cursor, right: interval.left })
      cursor = Math.max(cursor, interval.right)
    }
    if (base.right - cursor >= 18) slots.push({ left: cursor, right: base.right })
    return slots
  }

  // ── Intro 动画 ─────────────────────────────────
  private getBrickIntroState(brick: Brick): { x: number; y: number; alpha: number } {
    const local = clamp((this.introProgress - brick.introDelay) / (1 - brick.introDelay), 0, 1)
    const eased = local < 1 ? easeOutBack(local) : 1
    return {
      x: lerp(brick.sourceX, brick.x, eased),
      y: lerp(brick.sourceY, brick.y, eased),
      alpha: 0.08 + local * 0.92,
    }
  }

  private drawIntroSequence(): void {
    const ctx = this.ctx

    // 横幅文字
    const bannerIn = easeOutBack(clamp((this.introProgress - 0.04) / 0.18, 0, 1))
    const bannerOut = 1 - easeOutCubic(clamp((this.introProgress - 0.6) / 0.14, 0, 1))
    const bannerAlpha = clamp(bannerIn * clamp(bannerOut, 0, 1), 0, 1)
    const bannerLift = (1 - easeOutCubic(clamp(this.introProgress / 0.38, 0, 1))) * 20

    if (bannerAlpha > 0.01) {
      const line1 = this.renderer.getBlock(`LEVEL ${this.level + 1}`, FONTS.title, 60)
      this.renderer.drawBlock(ctx, line1, this.view.width / 2, this.view.height / 2 - 40 - bannerLift, {
        color: COLORS.title,
        align: 'center',
        alpha: bannerAlpha,
        shadow: true,
        shadowColor: COLORS.title,
        shadowBlur: 20,
      })
      const line2 = this.renderer.getBlock(
        ['基础名词', '动词', '形容词', '进阶词汇', '高级词汇'][this.level % 5]!,
        FONTS.subtitle, 26,
      )
      this.renderer.drawBlock(ctx, line2, this.view.width / 2, this.view.height / 2 + 24 - bannerLift, {
        color: COLORS.hud,
        align: 'center',
        alpha: bannerAlpha * 0.8,
      })
    }

    // 砖块飞入
    this.drawBricksIntro()
  }

  private drawBricksIntro(): void {
    const ctx = this.ctx
    for (let i = 0; i < this.bricks.length; i++) {
      const brick = this.bricks[i]!
      const state = this.getBrickIntroState(brick)
      if (state.alpha < 0.02) continue

      const color = COLORS.brick[i % COLORS.brick.length]!

      ctx.save()
      ctx.globalAlpha = state.alpha * 0.15
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.roundRect(state.x, state.y, brick.width, brick.height, 4)
      ctx.fill()
      ctx.restore()

      ctx.save()
      ctx.globalAlpha = state.alpha * 0.5
      ctx.strokeStyle = color
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.roundRect(state.x, state.y, brick.width, brick.height, 4)
      ctx.stroke()
      ctx.restore()

      const wordBlock = this.renderer.getBlock(brick.word.en, FONTS.brick, 24)
      this.renderer.drawBlock(ctx, wordBlock, state.x + brick.width / 2, state.y + 10, {
        color,
        align: 'center',
        alpha: state.alpha,
      })
    }
  }

  // ── 清除扫光 ───────────────────────────────────
  private drawClearSweep(): void {
    const ctx = this.ctx
    const progress = easeInOutCubic(clamp(this.clearProgress / 0.7, 0, 1))
    const sweepY = PLAY_AREA.y + progress * PLAY_AREA.height
    const sweepHeight = 60

    // 扫光条
    const gradient = ctx.createLinearGradient(0, sweepY - sweepHeight, 0, sweepY + sweepHeight)
    gradient.addColorStop(0, 'rgba(62, 207, 142, 0)')
    gradient.addColorStop(0.3, 'rgba(62, 207, 142, 0.15)')
    gradient.addColorStop(0.5, 'rgba(250, 204, 21, 0.25)')
    gradient.addColorStop(0.7, 'rgba(56, 189, 248, 0.15)')
    gradient.addColorStop(1, 'rgba(56, 189, 248, 0)')

    ctx.save()
    ctx.fillStyle = gradient
    ctx.fillRect(PLAY_AREA.x, sweepY - sweepHeight, PLAY_AREA.width, sweepHeight * 2)
    ctx.restore()

    // 扫光线
    ctx.save()
    ctx.strokeStyle = COLORS.title
    ctx.lineWidth = 2
    ctx.globalAlpha = 0.8 * (1 - this.clearProgress)
    ctx.beginPath()
    ctx.moveTo(PLAY_AREA.x, sweepY)
    ctx.lineTo(PLAY_AREA.x + PLAY_AREA.width, sweepY)
    ctx.stroke()
    ctx.restore()

    // 横幅
    const bannerAlpha = easeOutCubic(clamp((this.clearProgress - 0.3) / 0.2, 0, 1)) *
                        (1 - easeOutCubic(clamp((this.clearProgress - 0.8) / 0.2, 0, 1)))
    if (bannerAlpha > 0.01) {
      const block = this.renderer.getBlock('CLEAR!', FONTS.title, 60)
      this.renderer.drawBlock(ctx, block, this.view.width / 2, this.view.height / 2 - 30, {
        color: COLORS.prompt,
        align: 'center',
        alpha: bannerAlpha,
        shadow: true,
        shadowColor: COLORS.prompt,
        shadowBlur: 24,
      })
    }

    this.drawParticles()
    this.drawFloatingTexts()
  }

  // ── 绘制游戏元素 ────────────────────────────────
  private drawBricks(): void {
    const ctx = this.ctx
    for (let i = 0; i < this.bricks.length; i++) {
      const brick = this.bricks[i]!
      if (!brick.alive) {
        if (brick.hitAlpha > 0.01) {
          brick.hitAlpha *= 0.88
          ctx.save()
          ctx.globalAlpha = brick.hitAlpha * 0.6
          ctx.fillStyle = brick.isTarget ? COLORS.correct : '#ffffff'
          ctx.beginPath()
          ctx.roundRect(brick.x - 2, brick.y - 2, brick.width + 4, brick.height + 4, 6)
          ctx.fill()
          ctx.restore()
        }
        continue
      }

      const color = brick.isTarget ? COLORS.brickTarget : COLORS.brick[i % COLORS.brick.length]!

      // 背景
      ctx.save()
      ctx.globalAlpha = 0.15
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.roundRect(brick.x, brick.y, brick.width, brick.height, 4)
      ctx.fill()
      ctx.restore()

      // 边框
      ctx.save()
      ctx.globalAlpha = brick.isTarget ? 0.9 : 0.5
      ctx.strokeStyle = color
      ctx.lineWidth = brick.isTarget ? 2 : 1
      ctx.beginPath()
      ctx.roundRect(brick.x, brick.y, brick.width, brick.height, 4)
      ctx.stroke()
      ctx.restore()

      // Target 脉冲光晕
      if (brick.isTarget) {
        const pulse = 0.2 + Math.sin(this.gameTime * 5) * 0.15
        ctx.save()
        ctx.globalAlpha = pulse
        ctx.shadowColor = COLORS.brickTarget
        ctx.shadowBlur = 16
        ctx.strokeStyle = COLORS.brickTarget
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.roundRect(brick.x - 3, brick.y - 3, brick.width + 6, brick.height + 6, 7)
        ctx.stroke()
        ctx.restore()
      }

      // 英文单词
      const wordBlock = this.renderer.getBlock(brick.word.en, FONTS.brick, 24)
      this.renderer.drawBlock(ctx, wordBlock, brick.x + brick.width / 2, brick.y + (brick.isTarget ? 6 : 12), {
        color,
        align: 'center',
        alpha: 1,
        shadow: brick.isTarget,
        shadowColor: color,
        shadowBlur: brick.isTarget ? 10 : 0,
      })

      // Target 砖块显示中文
      if (brick.isTarget) {
        const zhBlock = this.renderer.getBlock(brick.word.zh, FONTS.brickZh, 15)
        this.renderer.drawBlock(ctx, zhBlock, brick.x + brick.width / 2, brick.y + 28, {
          color: '#ffffff',
          align: 'center',
          alpha: 0.5,
        })
      }
    }
  }

  private drawBall(): void {
    const ctx = this.ctx

    // 球体光晕
    if (this.ballLaunched) {
      const gradient = ctx.createRadialGradient(this.ball.x, this.ball.y, 8, this.ball.x, this.ball.y, 60)
      gradient.addColorStop(0, 'rgba(255, 244, 214, 0.30)')
      gradient.addColorStop(0.4, 'rgba(94, 184, 204, 0.12)')
      gradient.addColorStop(1, 'rgba(94, 184, 204, 0)')
      ctx.save()
      ctx.fillStyle = gradient
      ctx.fillRect(this.ball.x - 60, this.ball.y - 60, 120, 120)
      ctx.restore()
    }

    // 球体
    const block = this.renderer.getBlock('●', FONTS.ball, 30)
    this.renderer.drawBlock(ctx, block, this.ball.x, this.ball.y - 14, {
      color: COLORS.ball,
      align: 'center',
      shadow: true,
      shadowColor: COLORS.ball,
      shadowBlur: 18,
    })
  }

  private drawPaddle(): void {
    const ctx = this.ctx
    const paddleText = '⟦==============⟧'
    const block = this.renderer.getBlock(paddleText, FONTS.paddle, 26)
    this.paddle.width = block.width

    // 挡板光晕
    ctx.save()
    ctx.shadowColor = COLORS.paddle
    ctx.shadowBlur = 12
    ctx.globalAlpha = 0.3
    ctx.fillStyle = COLORS.paddle
    ctx.fillRect(this.paddle.x - this.paddle.width / 2, this.paddle.y + 2, this.paddle.width, 4)
    ctx.restore()

    this.renderer.drawBlock(ctx, block, this.paddle.x, this.paddle.y, {
      color: COLORS.paddle,
      align: 'center',
      shadow: true,
      shadowColor: COLORS.paddle,
      shadowBlur: 8,
    })
  }

  private drawParticles(): void {
    const ctx = this.ctx
    for (const p of this.particles) {
      ctx.save()
      ctx.globalAlpha = p.alpha
      ctx.font = `${p.size}px ${FM}`
      ctx.fillStyle = p.color
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      if (p.rotation !== 0) {
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rotation)
        // 文字发光
        if (p.affectsWall) {
          ctx.shadowColor = p.color
          ctx.shadowBlur = 8
        }
        ctx.fillText(p.text, 0, 0)
      } else {
        ctx.fillText(p.text, p.x, p.y)
      }

      ctx.restore()
    }
  }

  private drawFloatingTexts(): void {
    const ctx = this.ctx
    for (const ft of this.floatingTexts) {
      ctx.save()
      ctx.globalAlpha = ft.alpha
      ctx.font = ft.font

      // 缩放效果
      const scaleProgress = clamp(ft.life / 0.15, 0, 1)
      const scale = ft.scale * (1 + (1 - scaleProgress) * 0.3)

      ctx.translate(ft.x, ft.y)
      ctx.scale(scale, scale)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      // 光晕
      if (ft.scale > 1) {
        ctx.shadowColor = ft.color
        ctx.shadowBlur = 10
      }

      ctx.fillStyle = ft.color
      ctx.fillText(ft.text, 0, 0)
      ctx.restore()
    }
  }

  // Combo 显示
  private drawComboDisplay(): void {
    if (this.combo < 2) return
    const ctx = this.ctx

    const alpha = this.comboDisplay > 0 ? clamp(this.comboDisplay, 0, 1) : 0.6
    const scale = 1 + (this.comboDisplay > 0 ? this.comboDisplay * 0.3 : 0)
    const cx = PLAY_AREA.x + 80
    const cy = PLAY_AREA.y + 60

    ctx.save()
    ctx.translate(cx, cy)
    ctx.scale(scale, scale)
    ctx.globalAlpha = alpha

    // combo 文字
    ctx.font = FONTS.combo
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.shadowColor = COLORS.prompt
    ctx.shadowBlur = 16
    ctx.fillStyle = COLORS.prompt
    ctx.fillText(`${this.combo}x`, 0, 0)

    ctx.font = FONTS.hudSmall
    ctx.shadowBlur = 0
    ctx.fillStyle = COLORS.hud
    ctx.fillText('COMBO', 0, 26)

    ctx.restore()
  }

  // ── HUD ─────────────────────────────────────────
  private drawHUD(): void {
    const ctx = this.ctx
    const y = 20

    // 分数
    const scoreStr = `SCORE ${this.score.toString().padStart(5, '0')}`
    const scoreBlock = this.renderer.getBlock(scoreStr, FONTS.hud, 22)
    this.renderer.drawBlock(ctx, scoreBlock, 40, y, { color: COLORS.score })

    // 生命
    const livesText = '♥'.repeat(this.lives) + '♡'.repeat(Math.max(0, 3 - this.lives))
    const livesBlock = this.renderer.getBlock(livesText, FONTS.hud, 22)
    this.renderer.drawBlock(ctx, livesBlock, this.view.width - 40, y, {
      color: '#ff5555',
      align: 'right',
    })

    // 关卡
    const levelBlock = this.renderer.getBlock(`LEVEL ${this.level + 1}`, FONTS.hud, 22)
    this.renderer.drawBlock(ctx, levelBlock, this.view.width / 2, y, {
      color: COLORS.title,
      align: 'center',
    })

    // 已学单词数
    if (this.learnedWords.length > 0) {
      const learnBlock = this.renderer.getBlock(`已学 ${this.learnedWords.length} 词`, FONTS.hudSmall, 18)
      this.renderer.drawBlock(ctx, learnBlock, this.view.width / 2, y + 26, {
        color: COLORS.correct,
        align: 'center',
        alpha: 0.7,
      })
    }
  }

  private drawPrompt(): void {
    if (!this.targetWord) return
    const ctx = this.ctx
    const y = 68

    // 提示闪光
    if (this.promptFlash > 0.01) {
      ctx.save()
      ctx.globalAlpha = this.promptFlash * 0.2
      ctx.fillStyle = COLORS.prompt
      ctx.fillRect(PLAY_AREA.x, y - 8, PLAY_AREA.width, 34)
      ctx.restore()
    }

    // 中文释义提示
    const promptBlock = this.renderer.getBlock(`▸ 寻找: "${this.targetWord.zh}"`, FONTS.prompt, 28)
    this.renderer.drawBlock(ctx, promptBlock, this.view.width / 2, y, {
      color: COLORS.prompt,
      align: 'center',
      alpha: 0.95,
      shadow: true,
      shadowColor: COLORS.prompt,
      shadowBlur: 8,
    })
  }

  private drawLaunchHint(): void {
    const alpha = 0.4 + Math.sin(this.gameTime * 3) * 0.2
    const block = this.renderer.getBlock('点击或按空格键发射', FONTS.hint, 18)
    this.renderer.drawBlock(this.ctx, block, this.view.width / 2, this.paddle.y + 36, {
      color: '#ffffff',
      align: 'center',
      alpha,
    })
  }

  // ── 各场景画面 ──────────────────────────────────
  private drawTitleScreen(): void {
    const ctx = this.ctx
    const cx = this.view.width / 2
    const cy = this.view.height / 2

    // 标题光晕
    const glowAlpha = 0.08 + Math.sin(this.gameTime * 1.5) * 0.04
    const gradient = ctx.createRadialGradient(cx, cy - 60, 30, cx, cy - 60, 300)
    gradient.addColorStop(0, `rgba(75, 232, 160, ${glowAlpha})`)
    gradient.addColorStop(1, 'rgba(75, 232, 160, 0)')
    ctx.save()
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, this.view.width, this.view.height)
    ctx.restore()

    // WORD — 左进
    const wordProgress = easeOutBack(clamp(this.gameTime / 0.6, 0, 1))
    const wordX = lerp(-300, cx - 110, wordProgress)
    const wordBlock = this.renderer.getBlock('WORD', FONTS.title, 60)
    this.renderer.drawBlock(ctx, wordBlock, wordX, cy - 80, {
      color: COLORS.title,
      align: 'center',
      alpha: wordProgress,
      shadow: true,
      shadowColor: COLORS.title,
      shadowBlur: 24,
    })

    // BREAKER — 右进
    const breakerProgress = easeOutBack(clamp((this.gameTime - 0.15) / 0.6, 0, 1))
    const breakerX = lerp(VIEW.width + 300, cx + 120, breakerProgress)
    const breakerBlock = this.renderer.getBlock('BREAKER', FONTS.title, 60)
    this.renderer.drawBlock(ctx, breakerBlock, breakerX, cy - 80, {
      color: COLORS.titleAlt,
      align: 'center',
      alpha: breakerProgress,
      shadow: true,
      shadowColor: COLORS.titleAlt,
      shadowBlur: 24,
    })

    // 副标题
    const subAlpha = easeOutCubic(clamp((this.gameTime - 0.5) / 0.4, 0, 1))
    const subBlock = this.renderer.getBlock('打碎单词，学习英语', FONTS.subtitle, 26)
    this.renderer.drawBlock(ctx, subBlock, cx, cy, {
      color: COLORS.hud,
      align: 'center',
      alpha: subAlpha * 0.85,
    })

    // 球演示弧线
    if (this.gameTime > 0.3) {
      const t = ((this.gameTime - 0.3) * 0.8) % 1
      const ballX = lerp(cx - 280, cx + 280, t)
      const ballArc = Math.abs(Math.sin(t * Math.PI * 2.1 + 0.2))
      const ballY = cy + 60 + (1 - ballArc) * 100
      const ballBlock = this.renderer.getBlock('●', FONTS.ball, 22)
      this.renderer.drawBlock(ctx, ballBlock, ballX, ballY - 10, {
        color: COLORS.ball,
        align: 'center',
        alpha: 0.6,
        shadow: true,
        shadowColor: COLORS.ball,
        shadowBlur: 14,
      })
    }

    // 开始提示
    const startAlpha = 0.3 + Math.sin(this.gameTime * 3) * 0.3
    const readyProgress = easeOutCubic(clamp((this.gameTime - 0.8) / 0.3, 0, 1))
    const startBlock = this.renderer.getBlock('[ 点击开始游戏 ]', FONTS.hint, 20)
    this.renderer.drawBlock(ctx, startBlock, cx, cy + 130, {
      color: COLORS.panel,
      align: 'center',
      alpha: startAlpha * readyProgress,
    })

    // 操作说明
    const helpTexts = ['← → / A D / 鼠标  移动挡板', '击碎高亮目标词获得高分', '学习单词，挑战五个关卡']
    for (let i = 0; i < helpTexts.length; i++) {
      const hAlpha = easeOutCubic(clamp((this.gameTime - 1 - i * 0.1) / 0.3, 0, 1))
      const hBlock = this.renderer.getBlock(helpTexts[i]!, FONTS.hint, 18)
      this.renderer.drawBlock(ctx, hBlock, cx, cy + 190 + i * 28, {
        color: COLORS.dim,
        align: 'center',
        alpha: hAlpha * 0.8,
      })
    }
  }

  private drawReviewScreen(): void {
    const ctx = this.ctx
    const cx = this.view.width / 2
    let y = 110

    const clearBlock = this.renderer.getBlock(`LEVEL ${this.level + 1} CLEAR!`, FONTS.title, 60)
    this.renderer.drawBlock(ctx, clearBlock, cx, y, {
      color: COLORS.title,
      align: 'center',
      shadow: true,
      shadowColor: COLORS.title,
      shadowBlur: 20,
    })
    y += 80

    const statsTexts = [
      `正确击中: ${this.correctHits}  |  其他: ${this.wrongHits}`,
      `最大连击: ${this.maxCombo}  |  得分: ${this.score}`,
    ]
    for (const text of statsTexts) {
      const block = this.renderer.getBlock(text, FONTS.hudSmall, 20)
      this.renderer.drawBlock(ctx, block, cx, y, { color: COLORS.hud, align: 'center' })
      y += 28
    }
    y += 24

    const reviewTitle = this.renderer.getBlock('— 本关词汇回顾 —', FONTS.hint, 20)
    this.renderer.drawBlock(ctx, reviewTitle, cx, y, { color: COLORS.prompt, align: 'center' })
    y += 36

    const words = this.levelWords
    const colWidth = 380
    const startX = cx - colWidth + 40

    for (let i = 0; i < words.length; i++) {
      const word = words[i]!
      const col = i < Math.ceil(words.length / 2) ? 0 : 1
      const row = col === 0 ? i : i - Math.ceil(words.length / 2)
      const wx = startX + col * colWidth
      const wy = y + row * 30
      const learned = this.learnedWords.includes(word)

      const enBlock = this.renderer.getBlock(word.en, FONTS.review, 22)
      this.renderer.drawBlock(ctx, enBlock, wx, wy, { color: learned ? COLORS.correct : COLORS.dim })

      const zhBlock = this.renderer.getBlock(word.zh, FONTS.reviewZh, 20)
      this.renderer.drawBlock(ctx, zhBlock, wx + 120, wy, { color: learned ? COLORS.correct : COLORS.dim, alpha: 0.8 })

      if (learned) {
        const checkBlock = this.renderer.getBlock('✓', FONTS.review, 22)
        this.renderer.drawBlock(ctx, checkBlock, wx - 20, wy, { color: COLORS.correct })
      }
    }

    const contAlpha = 0.3 + Math.sin(this.gameTime * 3) * 0.3
    const contText = this.level + 1 >= LEVELS.length ? '[ 点击查看最终成绩 ]' : '[ 点击进入下一关 ]'
    const contBlock = this.renderer.getBlock(contText, FONTS.hint, 20)
    this.renderer.drawBlock(ctx, contBlock, cx, this.view.height - 60, {
      color: COLORS.panel,
      align: 'center',
      alpha: contAlpha,
    })
  }

  private drawGameOverScreen(): void {
    const ctx = this.ctx
    const cx = this.view.width / 2
    const cy = this.view.height / 2

    // 暗色幕布
    ctx.save()
    ctx.globalAlpha = 0.55
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, this.view.width, this.view.height)
    ctx.restore()

    const goBlock = this.renderer.getBlock('GAME OVER', FONTS.title, 60)
    this.renderer.drawBlock(ctx, goBlock, cx, cy - 60, {
      color: COLORS.wrong,
      align: 'center',
      shadow: true,
      shadowColor: COLORS.wrong,
      shadowBlur: 24,
    })

    const scoreBlock = this.renderer.getBlock(`最终得分: ${this.score}`, FONTS.subtitle, 26)
    this.renderer.drawBlock(ctx, scoreBlock, cx, cy + 20, { color: COLORS.hud, align: 'center' })

    const wordsBlock = this.renderer.getBlock(`学习了 ${this.learnedWords.length} 个单词`, FONTS.hint, 20)
    this.renderer.drawBlock(ctx, wordsBlock, cx, cy + 60, { color: COLORS.prompt, align: 'center' })

    const retryAlpha = 0.3 + Math.sin(this.gameTime * 3) * 0.3
    const retryBlock = this.renderer.getBlock('[ 点击重新开始 ]', FONTS.hint, 20)
    this.renderer.drawBlock(ctx, retryBlock, cx, cy + 120, { color: COLORS.panel, align: 'center', alpha: retryAlpha })
  }

  private drawWinScreen(): void {
    const ctx = this.ctx
    const cx = this.view.width / 2
    let y = 100

    // 金色光晕
    const gradient = ctx.createRadialGradient(cx, y + 30, 15, cx, y + 30, 300)
    gradient.addColorStop(0, 'rgba(255, 217, 61, 0.12)')
    gradient.addColorStop(1, 'rgba(255, 217, 61, 0)')
    ctx.save()
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, this.view.width, this.view.height)
    ctx.restore()

    const winBlock = this.renderer.getBlock('CONGRATULATIONS!', FONTS.title, 60)
    this.renderer.drawBlock(ctx, winBlock, cx, y, {
      color: COLORS.titleAlt,
      align: 'center',
      shadow: true,
      shadowColor: COLORS.titleAlt,
      shadowBlur: 28,
    })
    y += 72

    const completeBlock = this.renderer.getBlock('你完成了所有关卡！', FONTS.subtitle, 26)
    this.renderer.drawBlock(ctx, completeBlock, cx, y, { color: COLORS.title, align: 'center' })
    y += 50

    const stats = [`最终得分: ${this.score}`, `学习单词: ${this.learnedWords.length} 个`, `最大连击: ${this.maxCombo}`]
    for (const text of stats) {
      const block = this.renderer.getBlock(text, FONTS.hudSmall, 22)
      this.renderer.drawBlock(ctx, block, cx, y, { color: COLORS.hud, align: 'center' })
      y += 34
    }

    y += 20
    const learnedTitle = this.renderer.getBlock('— 已掌握词汇 —', FONTS.hint, 20)
    this.renderer.drawBlock(ctx, learnedTitle, cx, y, { color: COLORS.correct, align: 'center' })
    y += 32

    const unique = [...new Map(this.learnedWords.map((w) => [w.en, w])).values()]
    const colWidth = 340
    const cols = 3
    const startX = cx - ((cols - 1) * colWidth) / 2

    for (let i = 0; i < unique.length; i++) {
      const word = unique[i]!
      const col = i % cols
      const row = Math.floor(i / cols)
      const wx = startX + col * colWidth - colWidth / 2 + 30
      const wy = y + row * 28

      const enBlock = this.renderer.getBlock(word.en, FONTS.review, 22)
      this.renderer.drawBlock(ctx, enBlock, wx, wy, { color: COLORS.correct })

      const zhBlock = this.renderer.getBlock(word.zh, FONTS.reviewZh, 20)
      this.renderer.drawBlock(ctx, zhBlock, wx + 100, wy, { color: COLORS.hud, alpha: 0.8 })
    }

    const restartAlpha = 0.3 + Math.sin(this.gameTime * 3) * 0.3
    const restartBlock = this.renderer.getBlock('[ 点击重新开始 ]', FONTS.hint, 20)
    this.renderer.drawBlock(ctx, restartBlock, cx, this.view.height - 60, {
      color: COLORS.panel,
      align: 'center',
      alpha: restartAlpha,
    })
  }
}
