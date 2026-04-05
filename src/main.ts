import './styles.css'
import { WordBreaker } from './game'

async function main() {
  await document.fonts.ready

  const app = document.getElementById('app')!
  const canvas = document.createElement('canvas')
  app.appendChild(canvas)

  new WordBreaker(canvas)
}

main()
