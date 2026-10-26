// Time-zone aware week/month boundaries, shared with the hosted version's API behavior.
export function timeZone(candidate, fallback = 'UTC') {
  for (const zone of [candidate, fallback, 'UTC']) {
    if (!zone) continue
    try { new Intl.DateTimeFormat('en', { timeZone: zone }); return zone } catch { /* try the next candidate */ }
  }
  return 'UTC'
}
const formatters = new Map()
function localParts(date, zone) {
  if (!formatters.has(zone)) {
    if (formatters.size >= 32) formatters.delete(formatters.keys().next().value)
    formatters.set(zone, new Intl.DateTimeFormat('en-US', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }))
  }
  return Object.fromEntries(formatters.get(zone).formatToParts(date).filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]))
}
export function midnight(year, month, day, zone) {
  const target = new Date(Date.UTC(year, month - 1, day))
  const expected = target.getTime()
  let guess = expected
  for (let i = 0; i < 3; i++) {
    const parts = localParts(new Date(guess), zone)
    const actual = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
    guess += expected - actual
  }
  return new Date(guess).toISOString()
}
export function dateContext(zone, date = new Date()) {
  const parts = localParts(date, zone)
  const localDate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day))
  const dayIndex = (localDate.getUTCDay() + 6) % 7
  return {
    dayIndex,
    weekStart: midnight(parts.year, parts.month, parts.day - dayIndex, zone),
    previousWeekStart: midnight(parts.year, parts.month, parts.day - dayIndex - 7, zone),
    monthStart: midnight(parts.year, parts.month, 1, zone),
    weekKey: new Date(Date.UTC(parts.year, parts.month - 1, parts.day - dayIndex)).toISOString().slice(0, 10),
  }
}
export function weekKey(date, zone) {
  const parts = localParts(new Date(date), zone)
  const local = new Date(Date.UTC(parts.year, parts.month - 1, parts.day))
  local.setUTCDate(local.getUTCDate() - (local.getUTCDay() + 6) % 7)
  return local.toISOString().slice(0, 10)
}
export function monthBounds(month, zone) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return null
  const [year, number] = month.split('-').map(Number)
  if (year < 2000 || year > 2200) return null
  return [midnight(year, number, 1, zone), midnight(year, number + 1, 1, zone)]
}
