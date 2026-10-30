import fs from 'node:fs'
import path from 'node:path'
import { PATHS } from './paths'

interface CacheEnvelope<T> {
  savedAt: number
  data: T
}

export function readCache<T>(name: string, ttlMs: number): T | null {
  try {
    const file = path.join(PATHS.cache, name)
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as CacheEnvelope<T>
    if (!parsed || typeof parsed.savedAt !== 'number') return null
    if (ttlMs > 0 && Date.now() - parsed.savedAt > ttlMs) return null
    return parsed.data
  } catch {
    return null
  }
}

export function writeCache<T>(name: string, data: T): void {
  try {
    fs.mkdirSync(PATHS.cache, { recursive: true })
    const file = path.join(PATHS.cache, name)
    const envelope: CacheEnvelope<T> = { savedAt: Date.now(), data }
    fs.writeFileSync(file, JSON.stringify(envelope), 'utf8')
  } catch (error) {
    console.warn(`[cache] failed to write ${name}:`, error)
  }
}

export function clearCache(name?: string): void {
  try {
    if (name) {
      fs.rmSync(path.join(PATHS.cache, name), { force: true })
      return
    }
    fs.rmSync(PATHS.cache, { recursive: true, force: true })
    fs.mkdirSync(PATHS.cache, { recursive: true })
  } catch {
    // best effort
  }
}
