import './styles.css'
import { WordBreaker } from './game'

async function main() {
  await document.fonts.ready

  const app = document.getElementById('app')!
  const canvas = document.createElement('canvas')
  // 逻辑尺寸 1200x800，CSS 自适应缩放
  canvas.width = 1200
  canvas.height = 800
  app.appendChild(canvas)

  new WordBreaker(canvas)
}

main()
