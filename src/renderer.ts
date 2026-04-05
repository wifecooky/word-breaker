import { prepareWithSegments, layoutNextLine } from '@chenglou/pretext'

export interface TextBlock {
  text: string
  font: string
  width: number
  height: number
  lineHeight: number
}

export class PretextRenderer {
  private blockCache = new Map<string, TextBlock>()

  private getCacheKey(text: string, font: string, lineHeight: number): string {
    return `${font}|${lineHeight}|${text}`
  }

  getBlock(text: string, font: string, lineHeight: number): TextBlock {
    const key = this.getCacheKey(text, font, lineHeight)
    const cached = this.blockCache.get(key)
    if (cached) return cached

    // 使用 prepareWithSegments + layoutNextLine 获取单行宽度
    const prepared = prepareWithSegments(text, font)
    const cursor = { segmentIndex: 0, graphemeIndex: 0 }
    const line = layoutNextLine(prepared, cursor, 99999)
    const width = line ? line.width : 0

    const block: TextBlock = {
      text,
      font,
      width,
      height: lineHeight,
      lineHeight,
    }
    this.blockCache.set(key, block)
    return block
  }

  drawBlock(
    ctx: CanvasRenderingContext2D,
    block: TextBlock,
    x: number,
    y: number,
    options: {
      color?: string
      alpha?: number
      align?: 'left' | 'center' | 'right'
      stroke?: boolean
      strokeColor?: string
      strokeWidth?: number
      shadow?: boolean
      shadowColor?: string
      shadowBlur?: number
    } = {},
  ): void {
    const {
      color = '#ffffff',
      alpha = 1,
      align = 'left',
      stroke = false,
      strokeColor = '#000000',
      strokeWidth = 2,
      shadow = false,
      shadowColor = 'rgba(0,0,0,0.5)',
      shadowBlur = 4,
    } = options

    ctx.save()
    ctx.globalAlpha = alpha
    ctx.font = block.font
    ctx.textBaseline = 'top'

    let drawX = x
    if (align === 'center') drawX = x - block.width / 2
    else if (align === 'right') drawX = x - block.width

    if (shadow) {
      ctx.shadowColor = shadowColor
      ctx.shadowBlur = shadowBlur
    }

    if (stroke) {
      ctx.strokeStyle = strokeColor
      ctx.lineWidth = strokeWidth
      ctx.lineJoin = 'round'
      ctx.strokeText(block.text, drawX, y)
    }

    ctx.fillStyle = color
    ctx.fillText(block.text, drawX, y)
    ctx.restore()
  }

  prepareForWall(text: string, font: string) {
    return prepareWithSegments(text, font)
  }

  layoutNextWallLine(
    prepared: ReturnType<typeof prepareWithSegments>,
    cursor: { segmentIndex: number; graphemeIndex: number },
    width: number,
  ) {
    return layoutNextLine(prepared, cursor, width)
  }
}
