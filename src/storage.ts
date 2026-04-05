// ── 学习进度持久化 — localStorage ──────────────────

const KEY = 'word-breaker-progress'

export interface Progress {
  highScore: number
  bestCombo: number
  gamesPlayed: number
  wordsLearned: string[]   // 去重的英文单词列表
  bestLevel: number        // 到达的最高关卡 (0-indexed)
}

function defaultProgress(): Progress {
  return {
    highScore: 0,
    bestCombo: 0,
    gamesPlayed: 0,
    wordsLearned: [],
    bestLevel: 0,
  }
}

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return defaultProgress()
    const data = JSON.parse(raw) as Partial<Progress>
    return { ...defaultProgress(), ...data }
  } catch {
    return defaultProgress()
  }
}

export function saveProgress(update: {
  score: number
  combo: number
  level: number
  words: string[]
}): Progress {
  const p = loadProgress()
  p.gamesPlayed++
  if (update.score > p.highScore) p.highScore = update.score
  if (update.combo > p.bestCombo) p.bestCombo = update.combo
  if (update.level > p.bestLevel) p.bestLevel = update.level

  // 合并新学单词（去重）
  const set = new Set(p.wordsLearned)
  for (const w of update.words) set.add(w)
  p.wordsLearned = [...set]

  try {
    localStorage.setItem(KEY, JSON.stringify(p))
  } catch { /* quota exceeded — 静默失败 */ }

  return p
}
