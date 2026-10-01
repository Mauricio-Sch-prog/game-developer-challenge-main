/**
 * localStorage can throw (private mode, quota, disabled storage) or hold
 * old/corrupt data. These helpers never throw; callers validate the shape.
 */

export function readJson(key: string): unknown {
  try {
    const raw = window.localStorage.getItem(key)
    return raw === null ? null : (JSON.parse(raw) as unknown)
  } catch {
    return null
  }
}

export function writeJson(key: string, value: unknown): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** Per-tab flag (sessionStorage): survives a refresh, not a new tab. */
export function readSessionFlag(key: string): boolean {
  try {
    return window.sessionStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

export function writeSessionFlag(key: string, value: boolean): void {
  try {
    if (value) window.sessionStorage.setItem(key, '1')
    else window.sessionStorage.removeItem(key)
  } catch {
    // Storage unavailable: the flag is just a convenience.
  }
}
