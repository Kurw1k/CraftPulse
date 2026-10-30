import { translate, type Language } from '@shared/i18n'
import { getSettings } from './store'

/** Текущий язык главного процесса (из сохранённых настроек). */
export function currentLanguage(): Language {
  return getSettings().language
}

/** Перевод пользовательских сообщений главного процесса. */
export function t(message: string, params?: Record<string, string | number>): string {
  return translate(currentLanguage(), message, params)
}
