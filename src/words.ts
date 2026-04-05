export interface WordEntry {
  en: string
  zh: string
}

export const LEVELS: WordEntry[][] = [
  // Level 1 — 基础名词
  [
    { en: 'apple', zh: '苹果' },
    { en: 'water', zh: '水' },
    { en: 'bread', zh: '面包' },
    { en: 'house', zh: '房子' },
    { en: 'light', zh: '光' },
    { en: 'world', zh: '世界' },
    { en: 'dream', zh: '梦' },
    { en: 'heart', zh: '心' },
    { en: 'stone', zh: '石头' },
    { en: 'river', zh: '河流' },
    { en: 'cloud', zh: '云' },
    { en: 'music', zh: '音乐' },
    { en: 'smile', zh: '微笑' },
    { en: 'storm', zh: '暴风雨' },
    { en: 'flame', zh: '火焰' },
  ],
  // Level 2 — 动词
  [
    { en: 'chase', zh: '追逐' },
    { en: 'drift', zh: '漂流' },
    { en: 'grasp', zh: '抓住' },
    { en: 'bloom', zh: '绽放' },
    { en: 'shine', zh: '闪耀' },
    { en: 'climb', zh: '攀登' },
    { en: 'weave', zh: '编织' },
    { en: 'carve', zh: '雕刻' },
    { en: 'forge', zh: '锻造' },
    { en: 'sweep', zh: '扫' },
    { en: 'crash', zh: '碰撞' },
    { en: 'float', zh: '漂浮' },
    { en: 'spark', zh: '点燃' },
    { en: 'twist', zh: '扭转' },
    { en: 'merge', zh: '合并' },
  ],
  // Level 3 — 形容词
  [
    { en: 'brave', zh: '勇敢的' },
    { en: 'swift', zh: '迅速的' },
    { en: 'vivid', zh: '鲜明的' },
    { en: 'quiet', zh: '安静的' },
    { en: 'bliss', zh: '极乐' },
    { en: 'cruel', zh: '残酷的' },
    { en: 'witty', zh: '机智的' },
    { en: 'faint', zh: '微弱的' },
    { en: 'noble', zh: '高贵的' },
    { en: 'rapid', zh: '快速的' },
    { en: 'dense', zh: '密集的' },
    { en: 'steep', zh: '陡峭的' },
    { en: 'rigid', zh: '僵硬的' },
    { en: 'brisk', zh: '轻快的' },
    { en: 'crisp', zh: '清脆的' },
  ],
  // Level 4 — 进阶词汇
  [
    { en: 'epoch', zh: '纪元' },
    { en: 'vigor', zh: '活力' },
    { en: 'quest', zh: '探索' },
    { en: 'nexus', zh: '连结' },
    { en: 'chaos', zh: '混沌' },
    { en: 'realm', zh: '领域' },
    { en: 'ghost', zh: '幽灵' },
    { en: 'truce', zh: '休战' },
    { en: 'gauge', zh: '测量' },
    { en: 'poise', zh: '沉着' },
    { en: 'glyph', zh: '符号' },
    { en: 'crypt', zh: '地下室' },
    { en: 'abyss', zh: '深渊' },
    { en: 'prism', zh: '棱镜' },
    { en: 'aegis', zh: '庇护' },
  ],
  // Level 5 — 高级词汇
  [
    { en: 'lucid', zh: '清晰的' },
    { en: 'stoic', zh: '坚忍的' },
    { en: 'ethereal', zh: '空灵的' },
    { en: 'zenith', zh: '顶点' },
    { en: 'enigma', zh: '谜' },
    { en: 'aurora', zh: '极光' },
    { en: 'mirage', zh: '海市蜃楼' },
    { en: 'cipher', zh: '密码' },
    { en: 'quartz', zh: '石英' },
    { en: 'sphinx', zh: '狮身人面像' },
    { en: 'vortex', zh: '漩涡' },
    { en: 'nebula', zh: '星云' },
    { en: 'zephyr', zh: '西风' },
    { en: 'oracle', zh: '神谕' },
    { en: 'elixir', zh: '灵丹妙药' },
  ],
]

// 单词联想 emoji — 视觉锚点加深记忆
export const WORD_EMOJI: Record<string, string> = {
  // Level 1 — 名词
  apple: '🍎', water: '💧', bread: '🍞', house: '🏠', light: '💡',
  world: '🌍', dream: '💭', heart: '❤️', stone: '🪨', river: '🏞️',
  cloud: '☁️', music: '🎵', smile: '😊', storm: '⛈️', flame: '🔥',
  // Level 2 — 动词
  chase: '🏃', drift: '🌊', grasp: '✊', bloom: '🌸', shine: '✨',
  climb: '🧗', weave: '🧶', carve: '🗿', forge: '⚒️', sweep: '🧹',
  crash: '💥', float: '🎈', spark: '⚡', twist: '🌀', merge: '🤝',
  // Level 3 — 形容词
  brave: '🦁', swift: '🐆', vivid: '🌈', quiet: '🤫', bliss: '😇',
  cruel: '🐍', witty: '🧠', faint: '🌫️', noble: '👑', rapid: '🚀',
  dense: '🌳', steep: '⛰️', rigid: '🧊', brisk: '🍃', crisp: '❄️',
  // Level 4 — 进阶
  epoch: '⏳', vigor: '💪', quest: '🗺️', nexus: '🔗', chaos: '🌪️',
  realm: '🏰', ghost: '👻', truce: '🕊️', gauge: '📏', poise: '🧘',
  glyph: '𓀀', crypt: '⚰️', abyss: '🕳️', prism: '🔮', aegis: '🛡️',
  // Level 5 — 高级
  lucid: '💎', stoic: '🗻', ethereal: '🦋', zenith: '🏔️', enigma: '❓',
  aurora: '🌌', mirage: '🏜️', cipher: '🔐', quartz: '💠', sphinx: '🐈',
  vortex: '🌀', nebula: '🌟', zephyr: '🍃', oracle: '🔮', elixir: '🧪',
}

// 用于背景文字墙的长文本
export const WALL_TEXT =
  'The quick brown fox jumps over the lazy dog. ' +
  'A journey of a thousand miles begins with a single step. ' +
  'Knowledge is power. Practice makes perfect. ' +
  'Every word you learn opens a new door. ' +
  'The pen is mightier than the sword. ' +
  'Actions speak louder than words. ' +
  'Where there is a will there is a way. ' +
  'Time waits for no one. ' +
  'Fortune favors the bold. ' +
  'Still waters run deep. ' +
  'Break the wall of language. ' +
  'Words are the building blocks of thought. ' +
  'To learn a language is to have one more window from which to look at the world. '
