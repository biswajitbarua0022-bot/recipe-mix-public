const datePattern = /^(\d{4})-(\d{2})-(\d{2})$/

function dateKey(year: number, month: number, day: number) {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function localDateKey(date = new Date()) {
  return dateKey(date.getFullYear(), date.getMonth() + 1, date.getDate())
}

// UTC here represents a calendar date, independent of daylight-saving transitions.
function calendarDate(key: string) {
  const match = datePattern.exec(key)
  if (!match) return null
  const [, year, month, day] = match.map(Number)
  const date = new Date(0)
  date.setUTCFullYear(year, month - 1, day)
  return year > 0 && utcKey(date) === key ? date : null
}

function utcKey(date: Date) {
  return dateKey(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate())
}

export function isDateKey(key: string) {
  return calendarDate(key) !== null
}

function requireDate(key: string) {
  const date = calendarDate(key)
  if (!date) throw new RangeError('Choose a valid calendar date.')
  return date
}

export function addDays(key: string, days: number) {
  const date = requireDate(key)
  date.setUTCDate(date.getUTCDate() + days)
  return utcKey(date)
}

export function weekStart(key: string) {
  const date = requireDate(key)
  return addDays(key, -((date.getUTCDay() + 6) % 7))
}

export function weekDates(key: string) {
  const monday = weekStart(key)
  return Array.from({ length: 7 }, (_, index) => addDays(monday, index))
}

export function isPlannerDate(key: string) {
  if (!isDateKey(key)) return false
  const monday = weekStart(key)
  return isDateKey(monday) && isDateKey(addDays(monday, 6))
}

const fullDate = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC' })
const datedYear = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
const weekday = new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'UTC' })
const weekRange = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

export function formatDay(key: string) { return fullDate.format(requireDate(key)) }
export function formatSlotDate(key: string) { return datedYear.format(requireDate(key)) }
export function formatWeekday(key: string) { return weekday.format(requireDate(key)) }
export function formatWeek(key: string) {
  const start = weekStart(key)
  return weekRange.formatRange(requireDate(start), requireDate(addDays(start, 6)))
}
