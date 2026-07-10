import { EN, ID, type TKey } from '../shared/locales'

let _locale: 'en' | 'id' = 'en'

export function setLocale(locale: 'en' | 'id'): void {
  _locale = locale
}

export function t(key: TKey): string | readonly string[] {
  const map = _locale === 'id' ? ID : EN
  const value = map[key]
  if (Array.isArray(value)) return value
  return (value as string) ?? key
}
