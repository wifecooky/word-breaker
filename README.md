# Word Breaker — 打碎单词学英语

A Breakout-style English vocabulary game built with [@chenglou/pretext](https://github.com/chenglou/pretext).

Inspired by [Pretext Breaker](https://www.pretext.cool/demos/pretext-breaker).

## Gameplay

Control the paddle to bounce the ball and break word bricks. A target word (highlighted in red) is shown with its Chinese definition — hit it for bonus points. Every brick you break reveals the word's meaning and speaks the pronunciation.

- 5 levels: Nouns → Verbs → Adjectives → Intermediate → Advanced (75 words total)
- Words shuffle each playthrough for replayability
- Target word mechanic with combo scoring
- Difficulty increases per level (ball speed +8%)
- Interactive vocabulary review after each level (click to hear pronunciation)
- Learning progress saved locally (high score, words mastered, games played)

## Controls

| Input | Action |
|-------|--------|
| Mouse / Touch | Move paddle |
| `←` `→` / `A` `D` | Move paddle |
| Click / `Space` | Launch ball / Advance |
| `P` / `Esc` | Pause |
| `M` | Toggle sound |

## Power-Ups

Bricks drop power-ups at 15% chance. Catch them with the paddle:

| Icon | Effect | Duration |
|------|--------|----------|
| **W** | Wider paddle | 8s |
| **P** | Pierce through bricks | 8s |
| **S** | Slow ball speed | 8s |
| **M** | Multi-ball (2 extra) | Until lost |
| **+** | Extra life | Instant |

## Audio

- 11 synthesized sound effects via Web Audio API (zero assets)
- English word pronunciation via Speech Synthesis API
- Press `M` to mute/unmute

## Tech Stack

- **Text Rendering**: [@chenglou/pretext](https://github.com/chenglou/pretext) — DOM-free text measurement & layout
- **Audio**: Web Audio API (synthesized) + Speech Synthesis API (pronunciation)
- **Persistence**: localStorage for learning progress
- **Build**: Vite + TypeScript
- **Fonts**: JetBrains Mono, Inter, Noto Sans SC

All visual elements (bricks, ball, paddle, borders, particles, power-ups) are rendered as text characters on Canvas via Pretext's precision typography layout system. The background text wall reflows in real-time around all game objects.

## Visual Effects

- 6 particle types: letter burst, sparks, ball trail, wake holes, life-loss burst, generic burst
- Brick fly-in animation (easeOutBack from 6 directions)
- Level clear sweep with multi-color gradient
- Screen shake on impacts
- Box-drawing character border
- Ball glow with radial gradient (color changes in pierce mode)
- Combo counter with scale animation
- Power-up pulse glow + timer bars
- Pause overlay

## Mobile

- Responsive canvas with `aspect-ratio: 3/2` scaling
- Touch direct-follow (no lerp delay)
- Portrait orientation hint
- Pinch-zoom prevention

## Run

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## License

MIT
