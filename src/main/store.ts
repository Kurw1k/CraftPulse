import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { app } from 'electron'
import type { AppSettings } from '@shared/types'
import { detectLanguage, isLanguage } from '@shared/i18n'
import { PATHS } from './paths'

const SETTINGS_FILE = path.join(PATHS.root, 'settings.json')

export const MIN_MEMORY_MB = 512
export const MAX_MEMORY_MB = 65536

/** Старое фиксированное значение по умолчанию — нужно для миграции. */
const LEGACY_DEFAULT_MEMORY_MB = 4096

interface StoredSettings extends AppSettings {
  /** Служебный флаг: значение памяти уже пересчитано от объёма ОЗУ. */
  memoryDefaultMigrated?: boolean
}

/** Общий объём оперативной памяти устройства, МБ. */
export function totalMemoryMb(): number {
  const bytes = os.totalmem()
  if (!Number.isFinite(bytes) || bytes <= 0) return LEGACY_DEFAULT_MEMORY_MB * 4
  return Math.round(bytes / (1024 * 1024))
}

/**
 * Память по умолчанию для новых серверов: четверть системной ОЗУ,
 * округлённая вверх до 512 МБ (32 ГБ → 8 ГБ, 16 ГБ → 4 ГБ, 64 ГБ → 16 ГБ).
 */
export function recommendedMemoryMb(): number {
  const quarter = totalMemoryMb() * 0.25
  const rounded = Math.ceil(quarter / 512) * 512
  return Math.min(MAX_MEMORY_MB, Math.max(MIN_MEMORY_MB, rounded))
}

/**
 * Абсолютный максимум памяти для сервера: 7/8 системной ОЗУ.
 * Как минимум 1/8 (12.5%) всегда остаётся операционной системе,
 * поэтому выделить 100% ОЗУ невозможно (32 ГБ → 28 ГБ, 16 ГБ → 14 ГБ).
 */
export function systemMemoryLimitMb(): number {
  const limit = Math.floor((totalMemoryMb() * 7) / 8)
  return Math.min(MAX_MEMORY_MB, Math.max(MIN_MEMORY_MB, limit))
}

/**
 * Первый запуск: язык интерфейса берётся из локали системы.
 * Русская локаль → ru, любая другая → en.
 */
function defaultLanguage(): ReturnType<typeof detectLanguage> {
  let locale: string | undefined
  try {
    locale = app.getLocale()
  } catch {
    locale = undefined
  }
  return detectLanguage(locale)
}

function defaults(): StoredSettings {
  return {
    curseforgeApiKey: '',
    defaultMemoryMb: recommendedMemoryMb(),
    defaultJavaPath: '',
    autoDownloadJava: true,
    language: defaultLanguage(),
    releaseChannels: ['release'],
    defaultOnlineMode: true
  }
}

function persist(settings: StoredSettings): void {
  try {
    fs.mkdirSync(PATHS.root, { recursive: true })
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8')
  } catch (error) {
    console.warn('[settings] failed to save:', error)
  }
}

let cache: StoredSettings | null = null

export function getSettings(): AppSettings {
  if (cache) return cache
  let migrated = false
  try {
    const raw = fs.readFileSync(SETTINGS_FILE, 'utf8')
    const parsed = JSON.parse(raw) as Partial<StoredSettings>
    cache = { ...defaults(), ...parsed }
  } catch {
    cache = defaults()
    cache.memoryDefaultMigrated = true
    migrated = true
  }
  if (!isLanguage(cache.language)) {
    cache.language = defaultLanguage()
    migrated = true
  }
  cache.defaultMemoryMb = clampMemory(cache.defaultMemoryMb)
  // Версии до автоматического подбора памяти всегда писали 4096 МБ.
  // Один раз заменяем это значение на четверть ОЗУ устройства.
  if (!cache.memoryDefaultMigrated) {
    if (cache.defaultMemoryMb === LEGACY_DEFAULT_MEMORY_MB) {
      cache.defaultMemoryMb = recommendedMemoryMb()
    }
    cache.memoryDefaultMigrated = true
    migrated = true
  }
  if (migrated) persist(cache)
  return cache
}

export function saveSettings(patch: Partial<AppSettings>): AppSettings {
  const next: StoredSettings = { ...getSettings(), ...patch }
  next.defaultMemoryMb = clampMemory(next.defaultMemoryMb)
  if (!isLanguage(next.language)) next.language = defaultLanguage()
  next.memoryDefaultMigrated = true
  cache = next
  persist(next)
  return next
}

export function clampMemory(value: number): number {
  if (!Number.isFinite(value)) return recommendedMemoryMb()
  const limit = Math.min(MAX_MEMORY_MB, systemMemoryLimitMb())
  return Math.min(limit, Math.max(MIN_MEMORY_MB, Math.round(value)))
}
