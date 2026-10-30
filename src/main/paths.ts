import { app } from 'electron'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export const APP_ID = 'com.craftpulse.launcher'
export const APP_NAME = 'CraftPulse'

/**
 * Root layout (per platform, mirrors Prism/TLauncher style isolation):
 *  - Windows: %APPDATA%/CraftPulse
 *  - Linux:   ~/.config/CraftPulse
 */
export const PATHS = {
  root: path.join(app.getPath('appData'), APP_NAME),
  servers: '',
  runtimes: '',
  versions: '',
  cache: '',
  logs: ''
}

PATHS.servers = path.join(PATHS.root, 'servers')
PATHS.runtimes = path.join(PATHS.root, 'runtimes')
PATHS.versions = path.join(PATHS.root, 'versions')
PATHS.logs = path.join(PATHS.root, 'logs')

/**
 * Кэш приложения (манифесты, списки версий, иконки и временные загрузки)
 * хранится в системной папке кэша, а не внутри versions/.
 *  - Windows: %LOCALAPPDATA%/CraftPulse/cache;
 *  - Linux:   $XDG_CACHE_HOME/CraftPulse или ~/.cache/CraftPulse;
 *  - macOS:   ~/Library/Caches/CraftPulse.
 */
function resolveCacheDir(): string {
  const home = os.homedir()
  if (process.platform === 'win32') {
    const base = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local')
    return path.join(base, APP_NAME, 'cache')
  }
  if (process.platform === 'darwin') {
    return path.join(home, 'Library', 'Caches', APP_NAME)
  }
  const base = process.env.XDG_CACHE_HOME || path.join(home, '.cache')
  return path.join(base, APP_NAME)
}

PATHS.cache = resolveCacheDir()

const LEGACY_APP_NAMES = ['CraftDeck', 'craftdeck']

/**
 * Переносит данные из папки прежнего бренда CraftDeck в CraftPulse,
 * чтобы после переименования лаунчера серверы и настройки остались на месте.
 */
export function migrateLegacyData(): void {
  try {
    const hasAppData = (root: string): boolean =>
      fs.existsSync(path.join(root, 'servers')) || fs.existsSync(path.join(root, 'settings.json'))
    if (hasAppData(PATHS.root)) return

    const appData = app.getPath('appData')
    for (const legacyName of LEGACY_APP_NAMES) {
      const legacyRoot = path.join(appData, legacyName)
      if (
        path.resolve(legacyRoot).toLowerCase() === path.resolve(PATHS.root).toLowerCase()
      ) {
        continue
      }
      if (!hasAppData(legacyRoot)) continue
      try {
        fs.renameSync(legacyRoot, PATHS.root)
      } catch {
        // Если папка CraftPulse уже создана Electron, аккуратно дополняем её данными.
        fs.cpSync(legacyRoot, PATHS.root, {
          recursive: true,
          force: false,
          errorOnExist: false
        })
      }
      return
    }
  } catch (error) {
    console.warn('[paths] failed to migrate legacy CraftDeck data:', error)
  }
}

/**
 * Раньше кэш лежал в versions/cache. Переносим его в системную папку кэша,
 * чтобы старые данные не оставались внутри каталога версий.
 */
function migrateLegacyCache(): void {
  const legacy = path.join(PATHS.versions, 'cache')
  if (path.resolve(legacy) === path.resolve(PATHS.cache)) return
  if (!fs.existsSync(legacy)) return
  try {
    fs.mkdirSync(path.dirname(PATHS.cache), { recursive: true })
    fs.renameSync(legacy, PATHS.cache)
  } catch {
    try {
      fs.cpSync(legacy, PATHS.cache, { recursive: true, force: false, errorOnExist: false })
      fs.rmSync(legacy, { recursive: true, force: true })
    } catch {
      // Кэш можно потерять — он всё равно пересоздаётся.
    }
  }
}

export function ensurePaths(): void {
  migrateLegacyCache()
  for (const dir of Object.values(PATHS)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

const SAFE_ID = /^[a-z0-9][a-z0-9_-]{0,63}$/

export function isValidServerId(id: string): boolean {
  return SAFE_ID.test(id)
}

export function serverDir(id: string): string {
  if (!isValidServerId(id)) throw new Error(`Invalid server id: ${id}`)
  return path.join(PATHS.servers, id)
}

export function isPathInside(parent: string, child: string): boolean {
  const relative = path.relative(path.resolve(parent), path.resolve(child))
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

export function resolveInside(parent: string, ...parts: string[]): string {
  const target = path.resolve(parent, ...parts)
  if (!isPathInside(parent, target)) throw new Error('Path escapes the launcher directory')
  return target
}

export function javaExecutableName(): string {
  return process.platform === 'win32' ? 'java.exe' : 'java'
}
