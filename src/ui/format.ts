/** 75 → "01:15" */
export function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

/** Fixed 3-letter months: Intl's "short" month varies by locale data ("Sep" vs "Sept"). */
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
const pad = (value: number) => String(value).padStart(2, '0')

/** ISO date → "08 SEP · 19:36" (local time). */
export function formatPlayedAt(iso: string): string {
  const date = new Date(iso)
  return `${pad(date.getDate())} ${MONTHS[date.getMonth()]} · ${pad(date.getHours())}:${pad(date.getMinutes())}`
}
