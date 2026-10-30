import { getLocale } from './locale'

const KNOWN_CODES = [
  'EULA_REQUIRED',
  'JAVA_REQUIRED',
  'PORT_IN_USE',
  'CURSEFORGE_KEY_REQUIRED',
  'NO_COMPATIBLE_FILE',
  'DOWNLOAD_UNAVAILABLE',
  'MODS_UNSUPPORTED'
] as const

export type ErrorCode = (typeof KNOWN_CODES)[number] | null

export function cleanError(error: unknown): string {
  let message = error instanceof Error ? error.message : String(error)
  // Electron wraps ipcRenderer.invoke rejections with extra prefixes.
  message = message.replace(/^Error invoking remote method '[^']+':\s*/i, '')
  message = message.replace(/^Error:\s*/i, '')
  for (const code of KNOWN_CODES) {
    if (message.startsWith(`${code}:`)) {
      return message.slice(code.length + 1).trim()
    }
  }
  return message.trim() || (getLocale() === 'ru' ? 'Неизвестная ошибка' : 'Unknown error')
}

export function errorCode(error: unknown): ErrorCode {
  const message = error instanceof Error ? error.message : String(error)
  for (const code of KNOWN_CODES) {
    if (message.includes(`${code}:`)) return code
  }
  return null
}

export function isEulaError(error: unknown): boolean {
  return errorCode(error) === 'EULA_REQUIRED'
}
