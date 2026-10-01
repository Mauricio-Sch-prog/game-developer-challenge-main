import { clamp } from './math'

/**
 * Minimal collision toolkit (no physics library):
 * ships and projectiles are circles, islands are axis-aligned rectangles.
 */

export interface Circle {
  x: number
  y: number
  radius: number
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export function circlesOverlap(a: Circle, b: Circle): boolean {
  const dx = a.x - b.x
  const dy = a.y - b.y
  const r = a.radius + b.radius
  // Compare squared distances to avoid a Math.sqrt per check.
  return dx * dx + dy * dy < r * r
}

export function circleIntersectsRect(c: Circle, r: Rect): boolean {
  // Closest point of the rectangle to the circle center.
  const px = clamp(c.x, r.x, r.x + r.width)
  const py = clamp(c.y, r.y, r.y + r.height)
  const dx = c.x - px
  const dy = c.y - py
  return dx * dx + dy * dy < c.radius * c.radius
}

/**
 * Pushes the circle out of the rectangle along the shortest path.
 * Keeping the tangential movement makes ships slide along island edges.
 * Returns true when a correction happened.
 */
export function pushCircleOutOfRect(c: Circle, r: Rect): boolean {
  const px = clamp(c.x, r.x, r.x + r.width)
  const py = clamp(c.y, r.y, r.y + r.height)
  const dx = c.x - px
  const dy = c.y - py
  const distSq = dx * dx + dy * dy
  if (distSq >= c.radius * c.radius) return false

  if (distSq > 0) {
    const dist = Math.sqrt(distSq)
    const push = c.radius - dist
    c.x += (dx / dist) * push
    c.y += (dy / dist) * push
    return true
  }

  // Center is inside the rectangle: leave through the nearest side.
  const left = c.x - r.x
  const right = r.x + r.width - c.x
  const top = c.y - r.y
  const bottom = r.y + r.height - c.y
  const min = Math.min(left, right, top, bottom)
  if (min === left) c.x = r.x - c.radius
  else if (min === right) c.x = r.x + r.width + c.radius
  else if (min === top) c.y = r.y - c.radius
  else c.y = r.y + r.height + c.radius
  return true
}

/**
 * Pushes two overlapping circles apart. `shareA` is how much of the
 * correction `a` takes (0.5 = both move the same amount).
 */
export function separateCircles(a: Circle, b: Circle, shareA = 0.5): void {
  let dx = b.x - a.x
  let dy = b.y - a.y
  let dist = Math.sqrt(dx * dx + dy * dy)
  const overlap = a.radius + b.radius - dist
  if (overlap <= 0) return
  if (dist === 0) {
    // Perfectly stacked: pick any direction.
    dx = 1
    dy = 0
    dist = 1
  }
  const nx = dx / dist
  const ny = dy / dist
  a.x -= nx * overlap * shareA
  a.y -= ny * overlap * shareA
  b.x += nx * overlap * (1 - shareA)
  b.y += ny * overlap * (1 - shareA)
}

/** Keeps the whole circle inside [0, width] x [0, height]. Returns true when clamped. */
export function clampCircleToBounds(c: Circle, width: number, height: number): boolean {
  const x = clamp(c.x, c.radius, width - c.radius)
  const y = clamp(c.y, c.radius, height - c.radius)
  const clamped = x !== c.x || y !== c.y
  c.x = x
  c.y = y
  return clamped
}

export function isOutsideBounds(c: Circle, width: number, height: number): boolean {
  return c.x < -c.radius || c.y < -c.radius || c.x > width + c.radius || c.y > height + c.radius
}
