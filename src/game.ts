import { PretextRenderer } from './renderer'
import { LEVELS, WALL_TEXT, WORD_EMOJI, type WordEntry } from './words'
import * as sfx from './audio'
import { loadProgress, saveProgress, type Progress } from './storage'

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

// ── 道具系统 ─────────────────────────────────────
type PowerUpType = 'wide' | 'pierce' | 'slow' | 'life' | 'multi'

const POWERUP_DEFS: Record<PowerUpType, { glyph: string; color: string; label: string }> = {
  wide:   { glyph: 'W', color: '#4be8a0', label: '加宽' },
  pierce: { glyph: 'P', color: '#ffd93d', label: '穿透' },
  slow:   { glyph: 'S', color: '#7c9bff', label: '减速' },
  life:   { glyph: '+', color: '#ff5555', label: '+1' },
  multi:  { glyph: 'M', color: '#b8a0f2', label: '多球' },
}

const POWERUP_TYPES: PowerUpType[] = ['wide', 'pierce', 'slow', 'life', 'multi']
const POWERUP_DROP_CHANCE = 0.15
const POWERUP_FALL_SPEED = 160
const POWERUP_EFFECT_DURATION = 8 // 秒

interface PowerUp {
  x: number
  y: number
  type: PowerUpType
  time: number // 用于动画
}

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

function hitTest(mx: number, my: number, r: { x: number; y: number; w: number; h: number }): boolean {
  return mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h
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
  private extraBalls: Ball[] = []
  private paddle: Paddle = { x: VIEW.width / 2, width: 100, y: PLAY_AREA.y + PLAY_AREA.height - 30 }
  private particles: Particle[] = []
  private floatingTexts: FloatingText[] = []
  private wakeHoles: WakeHole[] = []

  // 道具
  private powerUps: PowerUp[] = []
  private wideTimer = 0
  private pierceTimer = 0
  private slowTimer = 0
  private normalBallSpeed = BALL_SPEED

  // 持久化进度
  private progress: Progress = loadProgress()

  // 复习界面点击区域
  private reviewWordRects: { x: number; y: number; w: number; h: number; word: WordEntry }[] = []
  // 标题画面关卡按钮区域
  private levelBtnRects: { x: number; y: number; w: number; h: number; level: number }[] = []

  // 单词学习
  private targetWord: WordEntry | null = null
  private learnedWords: WordEntry[] = []
  private levelWords: WordEntry[] = []
  private correctHits = 0
  private wrongHits = 0

  // 输入状态
  private pointerX = VIEW.width / 2
  private pointerY = VIEW.height / 2
  private pointerActive = false
  private isTouchInput = false
  private ballLaunched = false
  private keys = new Set<string>()

  // 文字墙
  private wallPrepared: ReturnType<typeof this.renderer.prepareForWall> | null = null

  // 暂停
  private paused = false

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

  // emoji 联想闪现
  private emojiFlash = { text: '', x: 0, y: 0, life: 0 }

  // 拖尾帧计数
  private trailCounter = 0
  // 彗星尾迹位置缓冲
  private ballTrail: { x: number; y: number }[] = []

  // 目标提示计时
  private targetTimer = 0

  // 难度
  private difficulty: 'easy' | 'normal' | 'hard' = 'normal'
  private difficultyBtnRects: { x: number; y: number; w: number; h: number; diff: 'easy' | 'normal' | 'hard' }[] = []

  // 设置面板
  private settingsOpen = false
  private selectedLevel = 0
  private startBtnRect = { x: 0, y: 0, w: 0, h: 0 }
  private settingsBtnRect = { x: 0, y: 0, w: 0, h: 0 }
  private closeBtnRect = { x: 0, y: 0, w: 0, h: 0 }
  private settingsStartBtnRect = { x: 0, y: 0, w: 0, h: 0 }

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
    // 将 VIEW 逻辑坐标 (1200x800) 映射到实际画布像素
    const sx = (rect.width * dpr) / this.view.width
    const sy = (rect.height * dpr) / this.view.height
    this.ctx.setTransform(sx, 0, 0, sy, 0, 0)
  }

  private bindEvents(): void {
    this.canvas.addEventListener('pointermove', (e) => {
      const rect = this.canvas.getBoundingClientRect()
      this.pointerX = ((e.clientX - rect.left) / rect.width) * this.view.width
      this.pointerY = ((e.clientY - rect.top) / rect.height) * this.view.height
      this.pointerActive = true
      this.isTouchInput = e.pointerType === 'touch'
    })

    this.canvas.addEventListener('pointerdown', (e) => {
      const rect = this.canvas.getBoundingClientRect()
      const mx = ((e.clientX - rect.left) / rect.width) * this.view.width
      const my = ((e.clientY - rect.top) / rect.height) * this.view.height

      if (this.mode === 'review') {
        for (const r of this.reviewWordRects) {
          if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) {
            sfx.speakWord(r.word.en)
            sfx.click()
            return
          }
        }
      }

      // 标题画面按钮
      if (this.mode === 'title') {
        if (this.settingsOpen) {
          // 设置面板内按钮
          for (const btn of this.difficultyBtnRects) {
            if (hitTest(mx, my, btn)) { sfx.click(); this.difficulty = btn.diff; return }
          }
          for (const btn of this.levelBtnRects) {
            if (hitTest(mx, my, btn)) { sfx.click(); this.selectedLevel = btn.level; return }
          }
          if (hitTest(mx, my, this.settingsStartBtnRect)) {
            sfx.click()
            this.lives = this.difficulty === 'easy' ? 5 : this.difficulty === 'hard' ? 2 : 3
            this.settingsOpen = false
            this.startLevel(this.selectedLevel)
            return
          }
          if (hitTest(mx, my, this.closeBtnRect)) { sfx.click(); this.settingsOpen = false; return }
          // 面板外点击关闭
          const pw = 720, ph = 480
          const panelX = this.view.width / 2 - pw / 2, panelY = this.view.height / 2 - ph / 2
          if (mx < panelX || mx > panelX + pw || my < panelY || my > panelY + ph) {
            this.settingsOpen = false
          }
          return // 阻止穿透
        }
        // 主画面按钮
        if (hitTest(mx, my, this.startBtnRect)) {
          sfx.click()
          this.lives = this.difficulty === 'easy' ? 5 : this.difficulty === 'hard' ? 2 : 3
          this.startLevel(this.selectedLevel)
          return
        }
        if (hitTest(mx, my, this.settingsBtnRect)) {
          sfx.click()
          this.settingsOpen = true
          return
        }
      }

      this.handleAction()
    })

    window.addEventListener('keydown', (e) => {
      this.keys.add(e.key)
      // 设置面板快捷键
      if (this.mode === 'title' && this.settingsOpen) {
        if (e.key === 'Escape' || e.key === 's' || e.key === 'S') { this.settingsOpen = false; return }
        if (e.key === ' ' || e.key === 'Enter') { this.settingsOpen = false; return }
        return
      }
      if (e.key === ' ' || e.key === 'Enter') {
        if (this.paused) { this.paused = false; return }
        this.handleAction()
      }
      if (e.key === 'Escape') {
        if (this.mode === 'playing') this.paused = !this.paused
      }
      if (e.key === 'p' || e.key === 'P') {
        if (this.mode === 'playing') this.paused = !this.paused
      }
      if (e.key === 's' || e.key === 'S') {
        if (this.mode === 'title') this.settingsOpen = !this.settingsOpen
      }
      if (e.key === 'm' || e.key === 'M') sfx.toggleMute()
      if (e.key === 'f' || e.key === 'F') this.toggleFullscreen()
    })

    window.addEventListener('keyup', (e) => this.keys.delete(e.key))
    window.addEventListener('resize', () => this.resize())
    document.addEventListener('fullscreenchange', () => this.resize())
  }

  private toggleFullscreen(): void {
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      this.canvas.parentElement?.requestFullscreen()
    }
  }

  private handleAction(): void {
    sfx.click()
    if (this.mode === 'title') {
      if (this.settingsOpen) return
      this.lives = this.difficulty === 'easy' ? 5 : this.difficulty === 'hard' ? 2 : 3
      this.startLevel(this.selectedLevel)
    } else if (this.mode === 'playing' && !this.ballLaunched) {
      this.launchBall()
    } else if (this.mode === 'review') {
      this.nextLevelOrWin()
    } else if (this.mode === 'gameover' || this.mode === 'win') {
      this.progress = saveProgress({
        score: this.score,
        combo: this.maxCombo,
        level: this.level,
        words: this.learnedWords.map((w) => w.en),
      })
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
    this.powerUps = []
    this.extraBalls = []
    this.wideTimer = 0
    this.pierceTimer = 0
    this.slowTimer = 0

    // 难度递增：每关球速 +8%，叠加难度倍率
    const diffMul = this.difficulty === 'easy' ? 0.8 : this.difficulty === 'hard' ? 1.25 : 1
    this.normalBallSpeed = BALL_SPEED * (1 + levelIndex * 0.08) * diffMul

    const words = [...LEVELS[levelIndex % LEVELS.length]!]
    // Fisher-Yates 洗牌，每次游戏词序不同
    for (let i = words.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [words[i], words[j]] = [words[j]!, words[i]!]
    }
    this.levelWords = words
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
    this.targetTimer = 0
    // 延迟朗读新目标词，避免和被击碎词的发音重叠
    setTimeout(() => sfx.speakWord(pick.word.en), 1200)
  }

  private resetBallAndPaddle(): void {
    this.paddle.x = this.view.width / 2
    this.ball.x = this.paddle.x
    this.ball.y = this.paddle.y - 16
    this.ball.vx = 0
    this.ball.vy = 0
    this.ball.wakePoint = null
    this.ballLaunched = false
    this.ballTrail = []
  }

  private launchBall(): void {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.6
    this.ball.vx = Math.cos(angle) * this.normalBallSpeed
    this.ball.vy = Math.sin(angle) * this.normalBallSpeed
    this.ballLaunched = true
    sfx.launch()
  }

  // ── 游戏循环 ────────────────────────────────────
  private tick = (now: number): void => {
    const dt = Math.min((now - this.lastTime) / 1000, 0.05)
    this.lastTime = now

    if (!this.paused) {
      this.gameTime += dt
      this.update(dt)
    }
    this.draw()

    requestAnimationFrame(this.tick)
  }

  private update(dt: number): void {
    this.promptFlash = Math.max(0, this.promptFlash - dt * 2)
    this.bgFlash = Math.max(0, this.bgFlash - dt * 4)
    this.comboDisplay = Math.max(0, this.comboDisplay - dt * 3)
    if (this.emojiFlash.life < 1.2) this.emojiFlash.life += dt

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
      // 触屏直接跟手，鼠标保留平滑插值
      this.paddle.x = this.isTouchInput
        ? this.pointerX
        : lerp(this.paddle.x, this.pointerX, 0.15)
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

    // 彗星尾迹缓冲
    this.ballTrail.push({ x: this.ball.x, y: this.ball.y })
    if (this.ballTrail.length > 12) this.ballTrail.shift()

    // 目标提示计时
    this.targetTimer += dt

    // 轨迹空洞
    this.trackWake()

    // 墙壁碰撞
    if (this.ball.x - BALL_RADIUS < PLAY_AREA.x) {
      this.ball.x = PLAY_AREA.x + BALL_RADIUS
      this.ball.vx = Math.abs(this.ball.vx)
      sfx.wallBounce()
    }
    if (this.ball.x + BALL_RADIUS > PLAY_AREA.x + PLAY_AREA.width) {
      this.ball.x = PLAY_AREA.x + PLAY_AREA.width - BALL_RADIUS
      this.ball.vx = -Math.abs(this.ball.vx)
      sfx.wallBounce()
    }
    if (this.ball.y - BALL_RADIUS < PLAY_AREA.y) {
      this.ball.y = PLAY_AREA.y + BALL_RADIUS
      this.ball.vy = Math.abs(this.ball.vy)
      sfx.wallBounce()
    }

    // 球掉出底部
    if (this.ball.y > PLAY_AREA.y + PLAY_AREA.height + 20) {
      this.lives--
      this.combo = 0
      this.spawnLostLifeBurst()
      this.screenShake = 3.2
      sfx.ballLost()
      if (this.lives <= 0) {
        this.mode = 'gameover'
        sfx.gameOver()
      } else {
        this.resetBallAndPaddle()
      }
      return
    }

    this.checkPaddleCollision()
    this.checkBrickCollisions()
    this.updateExtraBalls(dt)
    this.updatePowerUps(dt)

    // 检查清除
    if (this.bricks.every((b) => !b.alive)) {
      this.mode = 'clearing'
      sfx.levelClear()
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
      sfx.paddleHit()
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

        // 穿透模式不反弹、不 break
        const piercing = this.pierceTimer > 0
        if (!piercing) {
          if (minOverlap === overlapLeft || minOverlap === overlapRight) {
            this.ball.vx = -this.ball.vx
          } else {
            this.ball.vy = -this.ball.vy
          }
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

          // 连击里程碑爆发
          if (this.combo === 5 || this.combo === 10 || this.combo === 15) {
            this.spawnComboBurst(this.combo)
          }

          this.pickTargetWord()
          sfx.targetHit()
          sfx.comboTick(this.combo)
        } else {
          this.score += 10
          this.wrongHits++
          this.combo = 0

          this.spawnLetterBurst(cx, cy, brick.word.en, COLORS.wrong)
          this.addFloatingText(cx, brick.y - 4, '+10', '#666666', FONTS.particle, 0.8)
          this.addFloatingText(cx, brick.y + 16, brick.word.zh, '#888888', FONTS.hint, 0.8)
          this.screenShake = 1.5
          sfx.brickHit()
          sfx.speakWord(brick.word.en)
        }

        // emoji 联想闪现
        const emoji = WORD_EMOJI[brick.word.en]
        if (emoji) {
          this.emojiFlash = { text: emoji, x: cx, y: cy, life: 0 }
        }

        if (this.combo > this.maxCombo) this.maxCombo = this.combo

        // 随机掉落道具
        if (Math.random() < POWERUP_DROP_CHANCE) {
          this.spawnPowerUp(cx, cy)
        }

        if (!piercing) break
      }
    }
  }

  // ── 多球更新 ─────────────────────────────────────
  private updateExtraBalls(dt: number): void {
    for (let i = this.extraBalls.length - 1; i >= 0; i--) {
      const eb = this.extraBalls[i]!
      eb.x += eb.vx * dt
      eb.y += eb.vy * dt

      // 墙壁碰撞
      if (eb.x - BALL_RADIUS < PLAY_AREA.x) {
        eb.x = PLAY_AREA.x + BALL_RADIUS
        eb.vx = Math.abs(eb.vx)
      }
      if (eb.x + BALL_RADIUS > PLAY_AREA.x + PLAY_AREA.width) {
        eb.x = PLAY_AREA.x + PLAY_AREA.width - BALL_RADIUS
        eb.vx = -Math.abs(eb.vx)
      }
      if (eb.y - BALL_RADIUS < PLAY_AREA.y) {
        eb.y = PLAY_AREA.y + BALL_RADIUS
        eb.vy = Math.abs(eb.vy)
      }

      // 掉出底部 → 仅移除，不扣命
      if (eb.y > PLAY_AREA.y + PLAY_AREA.height + 20) {
        this.extraBalls.splice(i, 1)
        continue
      }

      // 挡板碰撞
      const padLeft = this.paddle.x - this.paddle.width / 2
      const padRight = this.paddle.x + this.paddle.width / 2
      if (
        eb.vy > 0 &&
        eb.y + BALL_RADIUS >= this.paddle.y &&
        eb.y + BALL_RADIUS <= this.paddle.y + 16 &&
        eb.x >= padLeft &&
        eb.x <= padRight
      ) {
        const hitPos = (eb.x - this.paddle.x) / (this.paddle.width / 2)
        const angle = -Math.PI / 2 + hitPos * 0.7
        const speed = Math.sqrt(eb.vx * eb.vx + eb.vy * eb.vy)
        eb.vx = Math.cos(angle) * speed
        eb.vy = Math.sin(angle) * speed
        eb.y = this.paddle.y - BALL_RADIUS
      }

      // 砖块碰撞
      for (const brick of this.bricks) {
        if (!brick.alive) continue
        if (
          eb.x + BALL_RADIUS > brick.x &&
          eb.x - BALL_RADIUS < brick.x + brick.width &&
          eb.y + BALL_RADIUS > brick.y &&
          eb.y - BALL_RADIUS < brick.y + brick.height
        ) {
          brick.alive = false
          brick.hitAlpha = 1

          const overlapLeft = eb.x + BALL_RADIUS - brick.x
          const overlapRight = brick.x + brick.width - (eb.x - BALL_RADIUS)
          const overlapTop = eb.y + BALL_RADIUS - brick.y
          const overlapBottom = brick.y + brick.height - (eb.y - BALL_RADIUS)
          const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom)

          if (minOverlap === overlapLeft || minOverlap === overlapRight) {
            eb.vx = -eb.vx
          } else {
            eb.vy = -eb.vy
          }

          const cx = brick.x + brick.width / 2
          const cy = brick.y + brick.height / 2

          this.score += 10
          this.spawnLetterBurst(cx, cy, brick.word.en, COLORS.spark)
          this.addFloatingText(cx, brick.y - 4, '+10', '#666666', FONTS.particle, 0.8)
          sfx.brickHit()
          break
        }
      }
    }
  }

  // ── 道具系统 ─────────────────────────────────────
  private spawnPowerUp(x: number, y: number): void {
    const type = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)]!
    this.powerUps.push({ x, y, type, time: 0 })
  }

  private updatePowerUps(dt: number): void {
    // 效果计时器衰减
    this.wideTimer = Math.max(0, this.wideTimer - dt)
    this.pierceTimer = Math.max(0, this.pierceTimer - dt)
    this.slowTimer = Math.max(0, this.slowTimer - dt)

    // 恢复球速
    if (this.slowTimer <= 0 && this.ballLaunched) {
      const speed = Math.sqrt(this.ball.vx * this.ball.vx + this.ball.vy * this.ball.vy)
      if (speed > 0 && Math.abs(speed - this.normalBallSpeed * 0.5) < 1) {
        const scale = this.normalBallSpeed / speed
        this.ball.vx *= scale
        this.ball.vy *= scale
      }
    }

    // 更新掉落中的道具
    for (const p of this.powerUps) {
      p.y += POWERUP_FALL_SPEED * dt
      p.time += dt

      // 挡板接住
      const padLeft = this.paddle.x - this.paddle.width / 2
      const padRight = this.paddle.x + this.paddle.width / 2
      if (
        p.y >= this.paddle.y - 8 &&
        p.y <= this.paddle.y + 12 &&
        p.x >= padLeft &&
        p.x <= padRight
      ) {
        this.activatePowerUp(p.type)
        p.y = 9999 // 标记移除
      }
    }

    // 移除出界或已收集的道具
    this.powerUps = this.powerUps.filter(
      (p) => p.y < PLAY_AREA.y + PLAY_AREA.height + 30
    )
  }

  private activatePowerUp(type: PowerUpType): void {
    const def = POWERUP_DEFS[type]
    this.addFloatingText(
      this.paddle.x, this.paddle.y - 30,
      def.label, def.color, FONTS.combo, 1.2,
    )
    this.spawnParticles(this.paddle.x, this.paddle.y, def.color, 8)
    this.screenShake = 1.5
    this.bgFlash = 0.4
    this.bgFlashColor = def.color
    sfx.powerUpCollect()

    switch (type) {
      case 'wide':
        this.wideTimer = POWERUP_EFFECT_DURATION
        break
      case 'pierce':
        this.pierceTimer = POWERUP_EFFECT_DURATION
        break
      case 'slow':
        this.slowTimer = POWERUP_EFFECT_DURATION
        if (this.ballLaunched) {
          const speed = Math.sqrt(this.ball.vx * this.ball.vx + this.ball.vy * this.ball.vy)
          if (speed > 0) {
            const scale = (this.normalBallSpeed * 0.5) / speed
            this.ball.vx *= scale
            this.ball.vy *= scale
          }
        }
        break
      case 'life':
        this.lives = Math.min(this.lives + 1, 5)
        break
      case 'multi':
        if (this.ballLaunched) {
          for (let i = 0; i < 2; i++) {
            const spread = (i === 0 ? -1 : 1) * 0.5
            const speed = Math.sqrt(this.ball.vx * this.ball.vx + this.ball.vy * this.ball.vy)
            const angle = Math.atan2(this.ball.vy, this.ball.vx) + spread
            this.extraBalls.push({
              x: this.ball.x,
              y: this.ball.y,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
              wakePoint: null,
            })
          }
        }
        break
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

  // 连击里程碑爆发 — 全屏粒子雨
  private spawnComboBurst(combo: number): void {
    const intensity = combo >= 15 ? 40 : combo >= 10 ? 28 : 16
    const colors = ['#ffd93d', '#4be8a0', '#7c9bff', '#f28daa', '#b8a0f2']
    this.screenShake = Math.min(6, combo * 0.5)
    this.bgFlash = 1
    this.bgFlashColor = COLORS.prompt

    const label = combo >= 15 ? 'UNSTOPPABLE!' : combo >= 10 ? 'AMAZING!' : 'GREAT!'
    this.addFloatingText(this.view.width / 2, this.view.height / 2 - 40, label, COLORS.prompt, FONTS.combo, 1.6)
    this.addFloatingText(this.view.width / 2, this.view.height / 2 + 10, `${combo}x COMBO`, COLORS.title, FONTS.comboSmall, 1.2)

    for (let i = 0; i < intensity; i++) {
      const x = Math.random() * this.view.width
      const y = Math.random() * this.view.height * 0.4
      const color = colors[Math.floor(Math.random() * colors.length)]!
      this.particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 200,
        vy: 60 + Math.random() * 120,
        text: ['★', '✦', '◆', '♦', '●'][Math.floor(Math.random() * 5)]!,
        color,
        alpha: 1,
        life: 0,
        maxLife: 0.8 + Math.random() * 0.6,
        size: 10 + Math.random() * 12,
        rotation: 0,
        rotationSpeed: (Math.random() - 0.5) * 5,
        gravity: 50,
        affectsWall: true,
        wallRadius: 15,
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
      sfx.win()
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
      this.drawPowerUps()
      this.drawParticles()
      this.drawFloatingTexts()
      this.drawEmojiFlash()
      this.drawComboDisplay()
      this.drawActiveEffects()
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

    // 暂停遮罩
    if (this.paused) this.drawPauseOverlay()

    // 竖屏提示
    this.drawPortraitHint()

    // 光标：游戏中隐藏，菜单悬浮按钮时手型，其余默认
    if (this.mode === 'playing') {
      this.canvas.style.cursor = 'none'
    } else if (this.mode === 'title' || this.mode === 'review') {
      const hovering = this.isHoveringButton()
      this.canvas.style.cursor = hovering ? 'pointer' : 'default'
    } else {
      this.canvas.style.cursor = 'default'
    }

    ctx.restore()
  }

  // ── 暂停遮罩 ────────────────────────────────────
  private drawPauseOverlay(): void {
    const ctx = this.ctx
    const cx = this.view.width / 2
    const cy = this.view.height / 2

    ctx.save()
    ctx.fillStyle = 'rgba(4, 7, 13, 0.7)'
    ctx.fillRect(0, 0, this.view.width, this.view.height)

    // 暂停图标 ❚❚
    ctx.font = `700 72px ${FM}`
    ctx.fillStyle = COLORS.title
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.shadowColor = COLORS.title
    ctx.shadowBlur = 20
    ctx.fillText('❚❚', cx, cy - 30)

    ctx.shadowBlur = 0
    ctx.font = `700 28px ${FC}`
    ctx.fillStyle = COLORS.panel
    ctx.fillText('暂停', cx, cy + 30)

    ctx.font = `400 18px ${FC}`
    ctx.fillStyle = COLORS.hud
    ctx.fillText('按 P / Esc / Space 继续', cx, cy + 68)

    ctx.restore()
  }

  // 鼠标是否悬浮在可点击按钮上
  private isHoveringButton(): boolean {
    const mx = this.pointerX
    const my = this.pointerY
    if (this.settingsOpen) {
      const panelRects = [
        ...this.difficultyBtnRects, ...this.levelBtnRects,
        this.closeBtnRect, this.settingsStartBtnRect,
      ]
      return panelRects.some(r => hitTest(mx, my, r))
    }
    const allRects = [
      this.startBtnRect, this.settingsBtnRect,
      ...this.reviewWordRects.map(r => ({ x: r.x, y: r.y, w: r.w, h: r.h })),
    ]
    return allRects.some(r => hitTest(mx, my, r))
  }

  // ── 竖屏横置提示 ─────────────────────────────────
  private drawPortraitHint(): void {
    const rect = this.canvas.getBoundingClientRect()
    // 仅在窄屏竖屏时显示（宽度 < 高度 且 CSS 宽 < 600）
    if (rect.width >= rect.height || rect.width >= 600) return

    const ctx = this.ctx
    const cx = this.view.width / 2
    const cy = this.view.height / 2

    ctx.save()
    ctx.fillStyle = 'rgba(4, 7, 13, 0.85)'
    ctx.fillRect(0, 0, this.view.width, this.view.height)

    // 旋转图标 ↻
    ctx.font = `80px ${FM}`
    ctx.fillStyle = COLORS.title
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('↻', cx, cy - 40)

    // 提示文字
    ctx.font = `700 26px ${FC}`
    ctx.fillStyle = COLORS.panel
    ctx.fillText('横屏体验更佳', cx, cy + 40)

    ctx.font = `400 18px ${FC}`
    ctx.fillStyle = COLORS.hud
    ctx.fillText('Rotate for best experience', cx, cy + 76)

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
        for (const eb of this.extraBalls) {
          this.pushCircleBlocked(blocked, eb.x, eb.y, BALL_RADIUS + 20, bandTop, bandBottom)
        }
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

        // 8 秒未击中目标：箭头脉冲引导
        if (this.targetTimer > 8) {
          const hintAlpha = 0.4 + Math.sin(this.gameTime * 6) * 0.3
          const arrowY = brick.y - 18 + Math.sin(this.gameTime * 4) * 4
          ctx.save()
          ctx.globalAlpha = hintAlpha
          ctx.font = `700 20px ${FS}`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillStyle = COLORS.prompt
          ctx.shadowColor = COLORS.prompt
          ctx.shadowBlur = 10
          ctx.fillText('▼', brick.x + brick.width / 2, arrowY)
          ctx.restore()
        }
      }
    }
  }

  private drawBall(): void {
    const ctx = this.ctx

    // 彗星尾迹
    if (this.ballLaunched && this.ballTrail.length > 1) {
      const isPiercing = this.pierceTimer > 0
      const trailColor = isPiercing ? POWERUP_DEFS.pierce.color : COLORS.trail
      for (let i = 0; i < this.ballTrail.length - 1; i++) {
        const t = i / this.ballTrail.length
        const p = this.ballTrail[i]!
        ctx.save()
        ctx.globalAlpha = t * 0.35
        ctx.fillStyle = trailColor
        ctx.beginPath()
        ctx.arc(p.x, p.y, 3 + t * 6, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }
    }

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
    const isPiercing = this.pierceTimer > 0
    const ballColor = isPiercing ? POWERUP_DEFS.pierce.color : COLORS.ball
    const block = this.renderer.getBlock('●', FONTS.ball, 30)
    this.renderer.drawBlock(ctx, block, this.ball.x, this.ball.y - 14, {
      color: ballColor,
      align: 'center',
      shadow: true,
      shadowColor: ballColor,
      shadowBlur: isPiercing ? 28 : 18,
    })

    // 多球
    const multiColor = POWERUP_DEFS.multi.color
    for (const eb of this.extraBalls) {
      const ebBlock = this.renderer.getBlock('●', FONTS.ball, 24)
      this.renderer.drawBlock(ctx, ebBlock, eb.x, eb.y - 12, {
        color: multiColor,
        align: 'center',
        shadow: true,
        shadowColor: multiColor,
        shadowBlur: 14,
      })
    }
  }

  private drawPaddle(): void {
    const ctx = this.ctx
    const isWide = this.wideTimer > 0
    const paddleText = isWide ? '⟦======================⟧' : '⟦==============⟧'
    const paddleColor = isWide ? POWERUP_DEFS.wide.color : COLORS.paddle
    const block = this.renderer.getBlock(paddleText, FONTS.paddle, 26)
    this.paddle.width = block.width

    // 挡板光晕
    ctx.save()
    ctx.shadowColor = paddleColor
    ctx.shadowBlur = isWide ? 18 : 12
    ctx.globalAlpha = 0.3
    ctx.fillStyle = paddleColor
    ctx.fillRect(this.paddle.x - this.paddle.width / 2, this.paddle.y + 2, this.paddle.width, 4)
    ctx.restore()

    this.renderer.drawBlock(ctx, block, this.paddle.x, this.paddle.y, {
      color: paddleColor,
      align: 'center',
      shadow: true,
      shadowColor: paddleColor,
      shadowBlur: isWide ? 14 : 8,
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

  // emoji 联想闪现
  private drawEmojiFlash(): void {
    const ef = this.emojiFlash
    if (!ef.text || ef.life >= 1.2) return

    const ctx = this.ctx
    const t = ef.life
    // 0–0.3s 弹入, 0.3–0.7s 停留, 0.7–1.2s 淡出上漂
    let scale: number
    let alpha: number
    let yOff = 0
    if (t < 0.3) {
      scale = 1.5 + (1 - easeOutBack(t / 0.3)) * 1.5
      alpha = 1
    } else if (t < 0.7) {
      scale = 1.5
      alpha = 1
    } else {
      const fadeT = (t - 0.7) / 0.5
      scale = 1.5 - fadeT * 0.4
      alpha = 1 - fadeT
      yOff = -fadeT * 40
    }

    ctx.save()
    ctx.globalAlpha = alpha
    ctx.translate(ef.x, ef.y + yOff)
    ctx.scale(scale, scale)
    ctx.font = '48px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(ef.text, 0, 0)
    ctx.restore()
  }

  // 掉落道具
  private drawPowerUps(): void {
    const ctx = this.ctx
    for (const p of this.powerUps) {
      const def = POWERUP_DEFS[p.type]
      const pulse = 1 + Math.sin(p.time * 6) * 0.15

      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.scale(pulse, pulse)

      // 外发光
      ctx.shadowColor = def.color
      ctx.shadowBlur = 16

      // 胶囊背景
      ctx.fillStyle = def.color
      ctx.globalAlpha = 0.2
      ctx.beginPath()
      ctx.arc(0, 0, 16, 0, Math.PI * 2)
      ctx.fill()

      // 字符
      ctx.globalAlpha = 1
      ctx.font = `700 20px ${FM}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = def.color
      ctx.fillText(def.glyph, 0, 0)

      ctx.restore()
    }
  }

  // 激活中的效果指示器
  private drawActiveEffects(): void {
    const effects: { label: string; color: string; timer: number }[] = []
    if (this.wideTimer > 0) effects.push({ label: '⬌ 加宽', color: POWERUP_DEFS.wide.color, timer: this.wideTimer })
    if (this.pierceTimer > 0) effects.push({ label: '◎ 穿透', color: POWERUP_DEFS.pierce.color, timer: this.pierceTimer })
    if (this.slowTimer > 0) effects.push({ label: '⚡ 减速', color: POWERUP_DEFS.slow.color, timer: this.slowTimer })
    if (effects.length === 0) return

    const ctx = this.ctx
    const baseX = PLAY_AREA.x + PLAY_AREA.width - 20
    let y = PLAY_AREA.y + 40

    for (const eff of effects) {
      const timerText = `${eff.label} ${Math.ceil(eff.timer)}s`
      const alpha = eff.timer < 2 ? 0.4 + Math.sin(this.gameTime * 8) * 0.4 : 0.9

      ctx.save()
      ctx.globalAlpha = alpha
      ctx.font = `700 16px ${FC}`
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = eff.color
      ctx.shadowColor = eff.color
      ctx.shadowBlur = 8
      ctx.fillText(timerText, baseX, y)
      ctx.restore()

      // 计时条
      const barWidth = 60
      const barHeight = 3
      const barX = baseX - barWidth
      const barY = y + 12
      const progress = eff.timer / POWERUP_EFFECT_DURATION

      ctx.save()
      ctx.globalAlpha = 0.3
      ctx.fillStyle = '#1a3050'
      ctx.fillRect(barX, barY, barWidth, barHeight)
      ctx.globalAlpha = alpha
      ctx.fillStyle = eff.color
      ctx.fillRect(barX, barY, barWidth * progress, barHeight)
      ctx.restore()

      y += 34
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

    // 关卡 + 速度倍率
    const speedPct = Math.round((1 + this.level * 0.08) * 100)
    const levelStr = speedPct > 100 ? `LEVEL ${this.level + 1}  ×${speedPct}%` : `LEVEL ${this.level + 1}`
    const levelBlock = this.renderer.getBlock(levelStr, FONTS.hud, 22)
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

    // 静音指示
    if (sfx.isMuted()) {
      const muteBlock = this.renderer.getBlock('[M] 静音', FONTS.hudSmall, 16)
      this.renderer.drawBlock(ctx, muteBlock, this.view.width - 40, y + 26, {
        color: COLORS.hudDim,
        align: 'right',
        alpha: 0.6,
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

    // WORD + BREAKER 居中计算
    const wordBlock = this.renderer.getBlock('WORD', FONTS.title, 60)
    const breakerBlock = this.renderer.getBlock('BREAKER', FONTS.title, 60)
    const titleGap = 24
    const totalTitleW = wordBlock.width + titleGap + breakerBlock.width
    const wordFinalX = cx - totalTitleW / 2 + wordBlock.width / 2
    const breakerFinalX = cx + totalTitleW / 2 - breakerBlock.width / 2

    // WORD — 左进
    const wordProgress = easeOutBack(clamp(this.gameTime / 0.6, 0, 1))
    const wordX = lerp(-300, wordFinalX, wordProgress)
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
    const breakerX = lerp(VIEW.width + 300, breakerFinalX, breakerProgress)
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

    // 球演示弧线 + 拖尾 + 弧顶火花
    if (this.gameTime > 0.3) {
      const t = ((this.gameTime - 0.3) * 0.5) % 1
      const ballX = lerp(cx - 280, cx + 280, t)
      const ballArc = Math.abs(Math.sin(t * Math.PI * 2.1 + 0.2))
      const ballY = cy + 60 + (1 - ballArc) * 100

      // 拖尾（6个渐隐残影）
      for (let i = 5; i >= 0; i--) {
        const lt = ((this.gameTime - 0.3 - i * 0.04) * 0.5) % 1
        if (lt < 0) continue
        const lx = lerp(cx - 280, cx + 280, lt)
        const la = Math.abs(Math.sin(lt * Math.PI * 2.1 + 0.2))
        const ly = cy + 60 + (1 - la) * 100
        const trailAlpha = (1 - i / 6) * 0.2
        const trailSize = 16 - i * 2

        ctx.save()
        ctx.globalAlpha = trailAlpha
        ctx.fillStyle = COLORS.trail
        ctx.shadowColor = COLORS.trail
        ctx.shadowBlur = 6
        ctx.beginPath()
        ctx.arc(lx, ly, trailSize / 2, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }

      // 球本体
      const ballBlock = this.renderer.getBlock('●', FONTS.ball, 22)
      this.renderer.drawBlock(ctx, ballBlock, ballX, ballY - 10, {
        color: COLORS.ball,
        align: 'center',
        alpha: 0.7,
        shadow: true,
        shadowColor: COLORS.ball,
        shadowBlur: 18,
      })

      // 弧顶火花 — 球在弧线高点时闪几颗星
      if (ballArc > 0.85) {
        const gt = this.gameTime
        for (let i = 0; i < 3; i++) {
          const angle = (gt * 8 + i * 2.1) % (Math.PI * 2)
          const dist = 10 + Math.sin(gt * 10 + i * 3) * 5
          const sx = ballX + Math.cos(angle) * dist
          const sy = ballY - 10 + Math.sin(angle) * dist
          ctx.save()
          ctx.globalAlpha = 0.4 + Math.sin(gt * 12 + i) * 0.3
          ctx.fillStyle = COLORS.spark
          ctx.shadowColor = COLORS.spark
          ctx.shadowBlur = 8
          ctx.beginPath()
          ctx.arc(sx, sy, 2, 0, Math.PI * 2)
          ctx.fill()
          ctx.restore()
        }
      }
    }

    // ▶ 开始游戏 主按钮
    const btnAlpha = easeOutCubic(clamp((this.gameTime - 0.8) / 0.3, 0, 1))
    if (btnAlpha > 0.01) {
      const sbW = 260, sbH = 50
      const sbX = cx - sbW / 2, sbY = cy + 200
      this.startBtnRect = { x: sbX, y: sbY, w: sbW, h: sbH }

      const pulse = 0.8 + Math.sin(this.gameTime * 3) * 0.2

      ctx.save()
      ctx.globalAlpha = btnAlpha * 0.2 * pulse
      ctx.fillStyle = COLORS.title
      ctx.shadowColor = COLORS.title
      ctx.shadowBlur = 20
      ctx.beginPath()
      ctx.roundRect(sbX, sbY, sbW, sbH, 8)
      ctx.fill()

      ctx.shadowBlur = 0
      ctx.globalAlpha = btnAlpha * 0.9
      ctx.strokeStyle = COLORS.title
      ctx.lineWidth = 2.5
      ctx.stroke()
      ctx.restore()

      const startLabel = this.renderer.getBlock('▶  开始游戏', FONTS.prompt, 26)
      this.renderer.drawBlock(ctx, startLabel, cx, sbY + 12, {
        color: COLORS.title,
        align: 'center',
        alpha: btnAlpha,
        shadow: true,
        shadowColor: COLORS.title,
        shadowBlur: 14,
      })
    }

    // ⚙ 设置 次级按钮
    const stAlpha = easeOutCubic(clamp((this.gameTime - 1.0) / 0.3, 0, 1))
    if (stAlpha > 0.01) {
      const stW = 160, stH = 40
      const stX = cx - stW / 2, stY = cy + 270
      this.settingsBtnRect = { x: stX, y: stY, w: stW, h: stH }

      ctx.save()
      ctx.globalAlpha = stAlpha * 0.1
      ctx.fillStyle = COLORS.hud
      ctx.beginPath()
      ctx.roundRect(stX, stY, stW, stH, 6)
      ctx.fill()

      ctx.globalAlpha = stAlpha * 0.5
      ctx.strokeStyle = COLORS.hud
      ctx.lineWidth = 1.5
      ctx.stroke()
      ctx.restore()

      const settingsLabel = this.renderer.getBlock('⚙  设置', FONTS.hint, 20)
      this.renderer.drawBlock(ctx, settingsLabel, cx, stY + 10, {
        color: COLORS.hud,
        align: 'center',
        alpha: stAlpha * 0.8,
      })
    }

    // 设置面板叠加层
    if (this.settingsOpen) this.drawSettingsPanel()
  }

  // ── 设置面板 ──────────────────────────────────────
  private drawPanelBorder(x: number, y: number, w: number, h: number): void {
    const ctx = this.ctx
    const color = COLORS.frameBright
    ctx.save()
    ctx.globalAlpha = 0.8
    ctx.font = FONTS.border
    ctx.fillStyle = color
    ctx.textBaseline = 'top'

    const charW = 14, charH = 18

    ctx.fillText('╔', x, y)
    ctx.fillText('╗', x + w - charW, y)
    ctx.fillText('╚', x, y + h - charH)
    ctx.fillText('╝', x + w - charW, y + h - charH)

    for (let px = x + charW; px < x + w - charW; px += charW) {
      ctx.fillText('═', px, y)
      ctx.fillText('═', px, y + h - charH)
    }
    for (let py = y + charH; py < y + h - charH; py += charH) {
      ctx.fillText('║', x, py)
      ctx.fillText('║', x + w - charW, py)
    }
    ctx.restore()
  }

  private drawSettingsSection(x: number, y: number, w: number, label: string): void {
    const ctx = this.ctx
    const labelBlock = this.renderer.getBlock(label, FONTS.hudSmall, 16)
    this.renderer.drawBlock(ctx, labelBlock, x + 20, y, { color: COLORS.frameBright, align: 'left', alpha: 0.9 })

    // 用 box-drawing '─' 字符拼分割线，与主边框风格统一
    ctx.save()
    ctx.globalAlpha = 0.3
    ctx.font = FONTS.border
    ctx.fillStyle = COLORS.frameBright
    ctx.textBaseline = 'top'
    const lineStart = x + 20 + labelBlock.width + 12
    const lineEnd = x + w - 20
    for (let lx = lineStart; lx < lineEnd; lx += 14) {
      ctx.fillText('─', lx, y)
    }
    ctx.restore()
  }

  private drawSettingsPanel(): void {
    const ctx = this.ctx
    const cx = this.view.width / 2
    const cy = this.view.height / 2
    const pw = 720, ph = 480
    const px = cx - pw / 2, py = cy - ph / 2

    // 暗色遮罩
    ctx.save()
    ctx.fillStyle = 'rgba(4, 7, 13, 0.75)'
    ctx.fillRect(0, 0, this.view.width, this.view.height)
    ctx.restore()

    // 面板背景
    ctx.save()
    ctx.fillStyle = 'rgba(8, 14, 28, 0.95)'
    ctx.beginPath()
    ctx.roundRect(px, py, pw, ph, 0)
    ctx.fill()
    ctx.restore()

    // box-drawing 边框
    this.drawPanelBorder(px, py, pw, ph)

    // 标题
    const titleBlock = this.renderer.getBlock('⚙  游戏设置', FONTS.prompt, 26)
    this.renderer.drawBlock(ctx, titleBlock, cx, py + 30, {
      color: COLORS.frameBright,
      align: 'center',
      shadow: true,
      shadowColor: COLORS.frameBright,
      shadowBlur: 12,
    })

    const innerX = px + 14
    const innerW = pw - 28
    let secY = py + 75

    // ── 难度选择 ──
    this.drawSettingsSection(innerX, secY, innerW, '难度选择')
    secY += 30
    this.difficultyBtnRects = []
    const diffs: { key: 'easy' | 'normal' | 'hard'; label: string; color: string }[] = [
      { key: 'easy', label: '简单·5命慢速', color: '#4be8a0' },
      { key: 'normal', label: '普通·3命标准', color: '#7c9bff' },
      { key: 'hard', label: '困难·2命快速', color: '#ff5555' },
    ]
    const dbW = 160, dbH = 36, dbGap = 20
    const dbTotalW = diffs.length * dbW + (diffs.length - 1) * dbGap
    const dbStartX = cx - dbTotalW / 2

    for (let i = 0; i < diffs.length; i++) {
      const d = diffs[i]!
      const bx = dbStartX + i * (dbW + dbGap)
      const selected = this.difficulty === d.key
      const btnColor = selected ? d.color : COLORS.hud

      ctx.save()
      if (selected) {
        ctx.globalAlpha = 0.25
        ctx.fillStyle = d.color
        ctx.shadowColor = d.color
        ctx.shadowBlur = 12
      } else {
        ctx.globalAlpha = 0.08
        ctx.fillStyle = COLORS.hud
        ctx.shadowBlur = 0
      }
      ctx.beginPath()
      ctx.roundRect(bx, secY, dbW, dbH, 6)
      ctx.fill()

      ctx.shadowBlur = 0
      ctx.globalAlpha = selected ? 0.9 : 0.4
      ctx.strokeStyle = btnColor
      ctx.lineWidth = selected ? 2.5 : 1
      ctx.stroke()
      ctx.restore()

      const lblBlock = this.renderer.getBlock(d.label, FONTS.hudSmall, 16)
      this.renderer.drawBlock(ctx, lblBlock, bx + dbW / 2, secY + 9, {
        color: btnColor,
        align: 'center',
        alpha: selected ? 1 : 0.6,
      })
      this.difficultyBtnRects.push({ x: bx, y: secY, w: dbW, h: dbH, diff: d.key })
    }

    // ── 关卡选择 ──
    secY += dbH + 24
    this.drawSettingsSection(innerX, secY, innerW, '关卡选择')
    secY += 30
    this.levelBtnRects = []
    const lvW = 110, lvH = 36, lvGap = 14
    const levelLabels = ['基础', '动词', '形容词', '进阶', '高级']
    const lvTotalW = LEVELS.length * lvW + (LEVELS.length - 1) * lvGap
    const lvStartX = cx - lvTotalW / 2

    for (let i = 0; i < LEVELS.length; i++) {
      const bx = lvStartX + i * (lvW + lvGap)
      const unlocked = i === 0 || this.progress.bestLevel >= i
      const selected = this.selectedLevel === i

      ctx.save()
      if (selected && unlocked) {
        ctx.globalAlpha = 0.25
        ctx.fillStyle = COLORS.title
        ctx.shadowColor = COLORS.title
        ctx.shadowBlur = 10
      } else {
        ctx.globalAlpha = unlocked ? 0.1 : 0.04
        ctx.fillStyle = unlocked ? COLORS.title : COLORS.dim
        ctx.shadowBlur = 0
      }
      ctx.beginPath()
      ctx.roundRect(bx, secY, lvW, lvH, 6)
      ctx.fill()

      ctx.shadowBlur = 0
      ctx.globalAlpha = selected && unlocked ? 0.9 : unlocked ? 0.5 : 0.2
      ctx.strokeStyle = unlocked ? COLORS.title : COLORS.dim
      ctx.lineWidth = selected && unlocked ? 2.5 : 1
      ctx.stroke()
      ctx.restore()

      const label = `L${i + 1} ${levelLabels[i]}`
      const btnBlock = this.renderer.getBlock(label, FONTS.hudSmall, 16)
      this.renderer.drawBlock(ctx, btnBlock, bx + lvW / 2, secY + 9, {
        color: unlocked ? (selected ? COLORS.title : COLORS.hud) : COLORS.dim,
        align: 'center',
        alpha: unlocked ? (selected ? 1 : 0.7) : 0.3,
      })

      if (unlocked) {
        this.levelBtnRects.push({ x: bx, y: secY, w: lvW, h: lvH, level: i })
      }
    }

    // ── 操作说明 ──
    secY += lvH + 24
    this.drawSettingsSection(innerX, secY, innerW, '操作说明')
    secY += 28
    const helpStr = '← → / A D  移动挡板 · M 音效 · P 暂停 · F 全屏'
    const helpBlock = this.renderer.getBlock(helpStr, FONTS.hudSmall, 15)
    this.renderer.drawBlock(ctx, helpBlock, cx, secY, { color: COLORS.hud, align: 'center', alpha: 0.7 })

    // ── 游戏记录 ──
    secY += 34
    this.drawSettingsSection(innerX, secY, innerW, '游戏记录')
    secY += 28
    const p = this.progress
    const statsStr = p.gamesPlayed > 0
      ? `最高分 ${p.highScore}  ·  已掌握 ${p.wordsLearned.length} 词  ·  最佳连击 ${p.bestCombo}`
      : '暂无记录'
    const statsBlock = this.renderer.getBlock(statsStr, FONTS.hudSmall, 15)
    this.renderer.drawBlock(ctx, statsBlock, cx, secY, { color: COLORS.hudDim, align: 'center', alpha: 0.7 })

    // ── 底部按钮 ──
    const btnY = py + ph - 62

    // ✕ 关闭
    const clW = 120, clH = 40
    const clX = cx - 100 - clW / 2
    this.closeBtnRect = { x: clX, y: btnY, w: clW, h: clH }

    ctx.save()
    ctx.globalAlpha = 0.1
    ctx.fillStyle = COLORS.hud
    ctx.beginPath()
    ctx.roundRect(clX, btnY, clW, clH, 6)
    ctx.fill()
    ctx.globalAlpha = 0.5
    ctx.strokeStyle = COLORS.hud
    ctx.lineWidth = 1.5
    ctx.stroke()
    ctx.restore()

    const closeLabel = this.renderer.getBlock('✕  关闭', FONTS.hint, 18)
    this.renderer.drawBlock(ctx, closeLabel, clX + clW / 2, btnY + 10, {
      color: COLORS.hud,
      align: 'center',
      alpha: 0.8,
    })

    // ▶ 开始游戏
    const goW = 180, goH = 40
    const goX = cx + 100 - goW / 2
    this.settingsStartBtnRect = { x: goX, y: btnY, w: goW, h: goH }

    const goPulse = 0.8 + Math.sin(this.gameTime * 3) * 0.2
    ctx.save()
    ctx.globalAlpha = 0.2 * goPulse
    ctx.fillStyle = COLORS.title
    ctx.shadowColor = COLORS.title
    ctx.shadowBlur = 14
    ctx.beginPath()
    ctx.roundRect(goX, btnY, goW, goH, 6)
    ctx.fill()
    ctx.shadowBlur = 0
    ctx.globalAlpha = 0.9
    ctx.strokeStyle = COLORS.title
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.restore()

    const goLabel = this.renderer.getBlock('▶  开始游戏', FONTS.prompt, 22)
    this.renderer.drawBlock(ctx, goLabel, goX + goW / 2, btnY + 8, {
      color: COLORS.title,
      align: 'center',
      shadow: true,
      shadowColor: COLORS.title,
      shadowBlur: 10,
    })
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
    this.reviewWordRects = []

    for (let i = 0; i < words.length; i++) {
      const word = words[i]!
      const col = i < Math.ceil(words.length / 2) ? 0 : 1
      const row = col === 0 ? i : i - Math.ceil(words.length / 2)
      const wx = startX + col * colWidth
      const wy = y + row * 30
      const learned = this.learnedWords.includes(word)

      // 记录点击区域
      this.reviewWordRects.push({ x: wx - 24, y: wy - 6, w: colWidth - 20, h: 28, word })

      const enBlock = this.renderer.getBlock(word.en, FONTS.review, 22)
      this.renderer.drawBlock(ctx, enBlock, wx, wy, { color: learned ? COLORS.correct : COLORS.dim })

      const zhBlock = this.renderer.getBlock(word.zh, FONTS.reviewZh, 20)
      this.renderer.drawBlock(ctx, zhBlock, wx + 120, wy, { color: learned ? COLORS.correct : COLORS.dim, alpha: 0.8 })

      // 小喇叭图标
      ctx.save()
      ctx.globalAlpha = 0.4
      ctx.font = `14px ${FS}`
      ctx.fillStyle = learned ? COLORS.correct : COLORS.dim
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.fillText('🔊', wx - 22, wy + 8)
      ctx.restore()

      if (learned) {
        const checkBlock = this.renderer.getBlock('✓', FONTS.review, 22)
        this.renderer.drawBlock(ctx, checkBlock, wx + colWidth - 60, wy, { color: COLORS.correct })
      }
    }

    // 发音提示
    const tipBlock = this.renderer.getBlock('点击单词可听发音', FONTS.hudSmall, 15)
    this.renderer.drawBlock(ctx, tipBlock, cx, this.view.height - 90, {
      color: COLORS.hudDim,
      align: 'center',
      alpha: 0.6,
    })

    const contAlpha = 0.3 + Math.sin(this.gameTime * 3) * 0.3
    const contText = this.level + 1 >= LEVELS.length ? '[ 点击空白区域查看最终成绩 ]' : '[ 点击空白区域进入下一关 ]'
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

    // 新纪录提示
    if (this.score > this.progress.highScore) {
      const newBlock = this.renderer.getBlock('NEW HIGH SCORE!', FONTS.hud, 20)
      const nAlpha = 0.6 + Math.sin(this.gameTime * 4) * 0.3
      this.renderer.drawBlock(ctx, newBlock, cx, cy + 52, {
        color: COLORS.titleAlt,
        align: 'center',
        alpha: nAlpha,
        shadow: true,
        shadowColor: COLORS.titleAlt,
        shadowBlur: 12,
      })
    }

    const wordsBlock = this.renderer.getBlock(`学习了 ${this.learnedWords.length} 个单词`, FONTS.hint, 20)
    this.renderer.drawBlock(ctx, wordsBlock, cx, cy + 80, { color: COLORS.prompt, align: 'center' })

    const retryAlpha = 0.3 + Math.sin(this.gameTime * 3) * 0.3
    const retryBlock = this.renderer.getBlock('[ 点击重新开始 ]', FONTS.hint, 20)
    this.renderer.drawBlock(ctx, retryBlock, cx, cy + 140, { color: COLORS.panel, align: 'center', alpha: retryAlpha })
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
