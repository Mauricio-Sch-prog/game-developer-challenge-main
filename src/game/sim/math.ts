export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** Moves `current` towards `target` by at most `maxDelta`, without overshooting. */
export function approach(current: number, target: number, maxDelta: number): number {
  if (current < target) return Math.min(current + maxDelta, target)
  return Math.max(current - maxDelta, target)
}

/** Normalizes an angle to the (-PI, PI] range. */
export function wrapAngle(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle))
}
