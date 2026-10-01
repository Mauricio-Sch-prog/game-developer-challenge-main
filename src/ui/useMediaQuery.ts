import { useCallback, useSyncExternalStore } from 'react'

/** Devices whose main input is a finger (phones, tablets). */
export const TOUCH_QUERY = '(hover: none) and (pointer: coarse)'
/** Mobile is played in landscape; portrait pauses the match and asks to rotate. */
export const TOUCH_PORTRAIT_QUERY = `${TOUCH_QUERY} and (orientation: portrait)`

export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    [query],
  )
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches)
}
