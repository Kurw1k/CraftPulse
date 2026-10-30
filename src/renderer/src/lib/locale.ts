import { detectLanguage, type Language } from '@shared/i18n'

/**
 * Текущий язык для модульных хелперов (форматирование чисел, дат, ошибок).
 * Обновляется из LauncherContext при смене языка, чтобы не тянуть
 * контекст в каждую функцию.
 */
let current: Language = detectLanguage(
  typeof navigator === 'undefined' ? null : navigator.language
)

export function setLocale(language: Language): void {
  current = language
}

export function getLocale(): Language {
  return current
}

export function isRussian(): boolean {
  return current === 'ru'
}
