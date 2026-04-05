# Word Breaker — 打碎单词学英语

A Breakout-style English vocabulary game built with [@chenglou/pretext](https://github.com/chenglou/pretext).

Inspired by [Pretext Breaker](https://www.pretext.cool/demos/pretext-breaker).

## Gameplay

Control the paddle to bounce the ball and break word bricks. A target word (highlighted in red) is shown with its Chinese definition — hit it for bonus points. Every brick you break reveals the word's meaning.

- 5 levels: Nouns → Verbs → Adjectives → Intermediate → Advanced (75 words total)
- Target word mechanic with combo scoring
- Vocabulary review after each level

## Controls

| Input | Action |
|-------|--------|
| Mouse / Touch | Move paddle |
| `←` `→` / `A` `D` | Move paddle |
| Click / `Space` | Launch ball / Advance |

## Tech Stack

- **Text Rendering**: [@chenglou/pretext](https://github.com/chenglou/pretext) — DOM-free text measurement & layout
- **Build**: Vite + TypeScript
- **Fonts**: JetBrains Mono, Inter, Noto Sans SC

All visual elements (bricks, ball, paddle, borders, particles) are rendered as text characters on Canvas via Pretext's precision typography layout system. The background text wall reflows in real-time around all game objects.

## Visual Effects

- 6 particle types: letter burst, sparks, ball trail, wake holes, life-loss burst, generic burst
- Brick fly-in animation (easeOutBack from 6 directions)
- Level clear sweep with multi-color gradient
- Screen shake on impacts
- Box-drawing character border (`╔═╗║╚╝`)
- Ball glow with radial gradient
- Combo counter with scale animation

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
