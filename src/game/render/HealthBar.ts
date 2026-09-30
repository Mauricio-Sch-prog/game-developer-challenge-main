import { Container, Rectangle, Sprite, Texture } from 'pixi.js'

/**
 * From ui_sheet.json (`enemy_health_*` → ui.layout): the fill is clipped
 * horizontally from the left, inside this rectangle of the 160x40 sprite.
 */
const FILL_RECT = { x: 24, width: 112 }
const BAR_SIZE = { width: 160, height: 40 }

export type HealthBarColor = 'green' | 'red'

/** Frame + fill sprites; the fill texture is cropped to the current HP ratio. */
export class HealthBar extends Container {
  private readonly fill: Sprite
  private readonly fillTexture: Texture
  private cropped: Texture | null = null
  private ratio = 1

  constructor(color: HealthBarColor) {
    super()
    this.fillTexture = Texture.from(`enemy_health_fill_${color}`)
    const frame = new Sprite(Texture.from('enemy_health_frame'))
    this.fill = new Sprite(this.fillTexture)
    // Children use top-left coordinates; center the whole bar on (0, 0).
    frame.position.set(-BAR_SIZE.width / 2, -BAR_SIZE.height / 2)
    this.fill.position.copyFrom(frame.position)
    this.addChild(frame, this.fill)
  }

  setRatio(value: number): void {
    const ratio = Math.max(0, Math.min(1, value))
    if (ratio === this.ratio) return // only rebuild when HP actually changed
    this.ratio = ratio

    this.cropped?.destroy()
    this.cropped = null
    this.fill.visible = ratio > 0

    if (ratio >= 1) {
      this.fill.texture = this.fillTexture
      return
    }
    // A new Texture that points at a sub-rectangle of the same image (no copy).
    const { frame, source } = this.fillTexture
    const width = FILL_RECT.x + FILL_RECT.width * ratio
    this.cropped = new Texture({ source, frame: new Rectangle(frame.x, frame.y, width, frame.height) })
    this.fill.texture = this.cropped
  }

  override destroy(): void {
    // Only the cropped view is ours; the shared image stays in the Assets cache.
    this.cropped?.destroy()
    this.cropped = null
    super.destroy({ children: true })
  }
}
