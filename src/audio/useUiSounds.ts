import { useEffect } from 'react'
import { playSound, type SoundName } from './sounds'

/** `data-sound` on a button picks its sound; `none` for buttons that already have a game sound. */
const BUTTON_SOUNDS: Readonly<Record<string, SoundName | null>> = {
  back: 'ui_back',
  open: 'ui_open',
  close: 'ui_close',
  none: null,
}

/**
 * Menu sounds for every button through two delegated listeners, instead of
 * wiring each button: click (mouse, touch or keyboard) and mouse hover.
 */
export function useUiSounds(): void {
  useEffect(() => {
    let hovered: Element | null = null

    const onClick = (event: MouseEvent) => {
      const button = event.target instanceof Element ? event.target.closest('button') : null
      if (!button || button.disabled) return
      const kind = button.dataset.sound
      const name = kind !== undefined && kind in BUTTON_SOUNDS ? BUTTON_SOUNDS[kind] : 'ui_click'
      if (name) playSound(name, { volume: 0.5 })
    }

    const onPointerOver = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return
      const button = event.target instanceof Element ? event.target.closest('button.btn') : null
      if (button === hovered) return
      hovered = button
      if (button && !(button as HTMLButtonElement).disabled) playSound('ui_hover', { volume: 0.25 })
    }

    document.addEventListener('click', onClick)
    document.addEventListener('pointerover', onPointerOver)
    return () => {
      document.removeEventListener('click', onClick)
      document.removeEventListener('pointerover', onPointerOver)
    }
  }, [])
}
