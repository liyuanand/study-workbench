export function toDateKey(value: Date = new Date()): string {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function fromDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(year, month - 1, day, 12, 0, 0, 0)
}

export function addDays(dateKey: string, days: number): string {
  const date = fromDateKey(dateKey)
  date.setDate(date.getDate() + days)
  return toDateKey(date)
}

export function dateKeysBack(count: number, from = toDateKey()): string[] {
  return Array.from({ length: count }, (_, index) => addDays(from, -(count - 1 - index)))
}

export function formatShortDate(dateKey: string): string {
  const date = fromDateKey(dateKey)
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

export function weekdayLabel(dateKey: string): string {
  return ['日', '一', '二', '三', '四', '五', '六'][fromDateKey(dateKey).getDay()]
}
