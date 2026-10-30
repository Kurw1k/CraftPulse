import { readCache, writeCache } from './cache'
import { fetchJson } from './http'
import type { LoaderType } from '@shared/types'

export interface MojangVersionEntry {
  id: string
  type: 'release' | 'snapshot' | 'old_beta' | 'old_alpha'
  url: string
  time: string
  releaseTime: string
}

export interface MojangManifest {
  latest: { release: string; snapshot: string }
  versions: MojangVersionEntry[]
}

export interface MinecraftVersionJson {
  id: string
  type: string
  javaVersion?: { majorVersion: number; component: string }
  downloads?: {
    server?: { url: string; sha1: string; size: number }
  }
}

const MANIFEST_URL = 'https://launchermeta.mojang.com/mc/game/version_manifest_v2.json'
const MANIFEST_TTL = 30 * 60 * 1000
const VERSION_TTL = 365 * 24 * 60 * 60 * 1000

export async function getManifest(force = false): Promise<MojangManifest> {
  if (!force) {
    const cached = readCache<MojangManifest>('mojang-manifest.json', MANIFEST_TTL)
    if (cached) return cached
  }
  const manifest = await fetchJson<MojangManifest>(MANIFEST_URL)
  writeCache('mojang-manifest.json', manifest)
  return manifest
}

export async function getVersionJson(versionId: string): Promise<MinecraftVersionJson> {
  const cacheName = `version-${versionId}.json`
  const cached = readCache<MinecraftVersionJson>(cacheName, VERSION_TTL)
  if (cached) return cached

  const manifest = await getManifest()
  const entry = manifest.versions.find((version) => version.id === versionId)
  if (!entry) throw new Error(`Minecraft version "${versionId}" was not found in the Mojang manifest`)
  const json = await fetchJson<MinecraftVersionJson>(entry.url)
  writeCache(cacheName, json)
  return json
}

function guessJavaMajor(mcVersion: string): number {
  if (mcVersion.startsWith('1.')) {
    const parts = mcVersion.split('.').map((part) => Number(part))
    const minor = parts[1] ?? 0
    const patch = parts[2] ?? 0
    if (minor <= 16) return 8
    if (minor <= 19) return 17
    if (minor === 20) return patch >= 5 ? 21 : 17
    return 21
  }
  // Minecraft moved to calendar versioning (26.x) and requires Java 25.
  return 25
}

export async function requiredJavaMajor(mcVersion: string): Promise<number> {
  try {
    const json = await getVersionJson(mcVersion)
    if (json.javaVersion?.majorVersion) return json.javaVersion.majorVersion
  } catch {
    // offline / unsupported version — use heuristic below
  }
  return guessJavaMajor(mcVersion)
}

/**
 * Прокси не привязаны к версии Minecraft: их Java-требования зависят от версии
 * самого прокси. Для серверных ядер используем требования Minecraft.
 */
export async function requiredJavaMajorForLoader(
  loader: LoaderType,
  mcVersion: string
): Promise<number> {
  switch (loader) {
    case 'canvas':
      return 25
    case 'velocity':
      return mcVersion.startsWith('4.') ? 21 : 17
    case 'waterfall':
    case 'bungeecord':
      return 17
    default:
      return requiredJavaMajor(mcVersion)
  }
}
