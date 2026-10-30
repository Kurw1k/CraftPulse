import type { LoaderType, VersionInfo } from '@shared/types'
import { readCache, writeCache } from './cache'
import { fetchJson, fetchText } from './http'
import { t } from './i18n'
import { getManifest } from './mojang'
import type { MojangManifest, MinecraftVersionJson } from './mojang'

export { getManifest, getVersionJson, requiredJavaMajor } from './mojang'

const PAPER_API = 'https://fill.papermc.io/v3'
const PURPUR_API = 'https://api.purpurmc.org/v2/purpur'
const FORGE_MAVEN = 'https://maven.minecraftforge.net/net/minecraftforge/forge'
const NEOFORGE_MAVEN = 'https://maven.neoforged.net/releases/net/neoforged/neoforge'
const FABRIC_META = 'https://meta.fabricmc.net/v2'
const ARCLIGHT_RELEASES = 'https://api.github.com/repos/IzzelAliz/Arclight/releases?per_page=40'
const MOHIST_API = 'https://mohistmc.com/api/v2'
const MOHIST_RAW = 'https://mohistmc.com/builds-raw'
const YOUER_API = 'https://api.mohistmc.com/project/youer'
const MAGMA_API = 'https://magmafoundation.org/api'
const SPONGE_API = 'https://dl-api.spongepowered.org/v2/groups/org.spongepowered/artifacts'
const GETBUKKIT_API = 'https://getbukkit.org/api/jars'
export const GETBUKKIT_DOWNLOAD = 'https://download.getbukkit.org'
const PUFFERFISH_CI = 'https://ci.pufferfish.host'
const CANVAS_CI = 'https://jenkins.canvasmc.io'
const PUFFERFISH_JOBS = ['1.17', '1.18', '1.19', '1.20', '1.21'].map(
  (version) => `Pufferfish-${version}`
)
const JENKINS_TREE =
  'builds[number,result,displayName,artifacts[fileName,relativePath]]{0,100}'
export const BUNGEECORD_JAR =
  'https://ci.md-5.net/job/BungeeCord/lastSuccessfulBuild/artifact/bootstrap/target/BungeeCord.jar'

const THIRTY_MINUTES = 30 * 60 * 1000
const ONE_HOUR = 60 * 60 * 1000

async function cachedJson<T>(name: string, url: string, ttl: number, refresh = false): Promise<T> {
  if (!refresh) {
    const cached = readCache<T>(name, ttl)
    if (cached) return cached
  }
  const data = await fetchJson<T>(url)
  writeCache(name, data)
  return data
}

async function cachedText(name: string, url: string, ttl: number, refresh = false): Promise<string> {
  if (!refresh) {
    const cached = readCache<string>(name, ttl)
    if (cached) return cached
  }
  const data = await fetchText(url)
  writeCache(name, data)
  return data
}

function xmlVersions(xml: string): string[] {
  const result: string[] = []
  const regex = /<version>([^<]+)<\/version>/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(xml)) !== null) result.push(match[1].trim())
  return result
}

function compareDesc(a: string, b: string): number {
  return b.localeCompare(a, 'en', { numeric: true })
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))]
}

function toVersionInfos(ids: string[], manifest: MojangManifest): VersionInfo[] {
  const meta = new Map(manifest.versions.map((version, index) => [version.id, { version, index }]))
  return unique(ids)
    .map((id) => {
      const entry = meta.get(id)
      return {
        id,
        type: (entry?.version.type ?? 'unknown') as VersionInfo['type'],
        releaseTime: entry?.version.releaseTime,
        label: entry?.version.id
      }
    })
    .sort((a, b) => {
      const ai = meta.get(a.id)?.index ?? Number.MAX_SAFE_INTEGER
      const bi = meta.get(b.id)?.index ?? Number.MAX_SAFE_INTEGER
      if (ai !== bi) return ai - bi
      return compareDesc(a.id, b.id)
    })
}

interface PaperProject {
  versions: Record<string, string[]>
}

interface PaperBuild {
  id: number
  channel: string
  downloads: Record<string, { name: string; url: string; size?: number }>
}

interface PurpurProject {
  versions: string[]
}

interface PurpurVersion {
  builds: { latest: string | number; all: string[] }
}

interface FabricLoaderEntry {
  loader: { version: string; stable: boolean }
}

interface GhRelease {
  tag_name: string
  name: string
  prerelease: boolean
  published_at: string
  draft: boolean
  assets: Array<{ name: string; browser_download_url: string; size: number }>
}

export interface ArclightAsset {
  mcVersion: string
  flavor: 'forge' | 'fabric'
  version: string
  filename: string
  url: string
  publishedAt: string
}

export interface MohistRawJar {
  /** Номер сборки для Mohist или первые 7 символов SHA для Banner. */
  id: string
  filename: string
  url: string
  sha?: string
  size?: string
  date?: string
}

export interface YouerBuild {
  id: number
  file_sha256: string
  build_date: string
  commit?: {
    hash: string
    changelog?: string
    author?: string
    commit_date?: string
  }
  loader?: { neoforge_version?: string }
}

export interface MagmaVersion {
  version: string
  minecraftVersion: string
  installerUrl?: string
  launcherUrl?: string
  isStable?: boolean
}

interface SpongeArtifactVersion {
  tagValues?: { minecraft?: string; forge?: string; api?: string }
  recommended?: boolean
}

interface SpongeVersionsResponse {
  artifacts: Record<string, SpongeArtifactVersion>
}

export interface SpongeBuild {
  version: string
  minecraft: string
  forge?: string
  recommended: boolean
}

export interface SpongeAsset {
  classifier: string
  extension: string
  downloadUrl?: string
}

interface GetBukkitJar {
  version: string
  fileName: string
  size?: number
  builtAt?: string
  downloadUrl: string
}

interface JenkinsArtifact {
  fileName: string
  relativePath: string
}

interface JenkinsBuild {
  number: number
  result: string | null
  displayName?: string
  artifacts?: JenkinsArtifact[]
}

export interface PufferfishBuild {
  id: number
  mcVersion: string
  fileName: string
  relativePath: string
  job: string
}

export interface CanvasBuild {
  id: number
  mcVersion: string
  fileName: string
  relativePath: string
}

const PAPER_PROJECTS: Partial<Record<LoaderType, string>> = {
  paper: 'paper',
  folia: 'folia',
  velocity: 'velocity',
  waterfall: 'waterfall'
}

export function paperProjectFor(loader: LoaderType): string | undefined {
  return PAPER_PROJECTS[loader]
}

function paperVersionIds(project: PaperProject): string[] {
  const ids: string[] = []
  for (const list of Object.values(project.versions ?? {})) {
    for (const id of list) {
      if (!id.includes('-')) ids.push(id)
    }
  }
  return ids
}

function forgePairs(versions: string[]): Array<{ mc: string; loader: string; full: string }> {
  const result: Array<{ mc: string; loader: string; full: string }> = []
  for (const full of versions) {
    const match = /^(\d+\.\d+(?:\.\d+)?)-(.+)$/.exec(full)
    if (!match) continue
    result.push({ mc: match[1], loader: match[2], full })
  }
  return result
}

export function neoForgeMcVersion(version: string, known: Set<string>): string | null {
  const clean = version.split(/[-+]/)[0]
  const parts = clean.split('.').map((part) => Number(part))
  if (parts.length < 2 || parts.some((part) => !Number.isFinite(part))) return null
  const [major, minor, patch] = parts

  if (major >= 26) {
    const candidate = `${major}.${minor}.${patch || 0}`
    if (known.has(candidate)) return candidate
    const short = `${major}.${minor}`
    return known.has(short) ? short : candidate
  }
  if (major >= 20) {
    const candidate = minor > 0 ? `1.${major}.${minor}` : `1.${major}`
    if (known.has(candidate)) return candidate
    if (candidate.endsWith('.0')) {
      const short = candidate.slice(0, -2)
      if (known.has(short)) return short
    }
    return candidate
  }
  return null
}

/** Magma versions look like "21.1.70-beta" for MC 1.21.1 or "12.2.5-beta" for 1.12.2. */
export function magmaMinecraftVersion(version: string): string | null {
  const match = /^(\d+)\.(\d+)/.exec(version)
  if (!match) return null
  const major = Number(match[1])
  const minor = Number(match[2])
  if (major === 12) {
    if (minor === 2) return '1.12.2'
    return '1.12'
  }
  if (major === 21) {
    if (minor === 0) return '1.21'
    return `1.21.${minor}`
  }
  return null
}

async function getMohistProjects(refresh = false): Promise<Array<{ project: string; versions: string[] }>> {
  return cachedJson('mohist-projects.json', `${MOHIST_API}/projects`, THIRTY_MINUTES, refresh)
}

/**
 * API MohistMC отдаёт пустые jar, поэтому сборки читаем прямо из каталога builds-raw.
 * У Mohist имя файла содержит номер сборки, у Banner — git SHA.
 */
export async function listMohistJars(
  project: 'mohist' | 'banner',
  mcVersion: string,
  refresh = false
): Promise<MohistRawJar[]> {
  const dirName = project === 'mohist' ? 'Mohist' : 'Banner'
  const html = await cachedText(
    `mohist-raw-jars-${project}-${mcVersion}.html`,
    `${MOHIST_RAW}/${dirName}-${encodeURIComponent(mcVersion)}/`,
    THIRTY_MINUTES,
    refresh
  )
  const jars = new Map<string, MohistRawJar>()
  const rowRegex =
    /<a href="([^"]+\.jar)">([^<]+)<\/a><\/td><td class="s">([^<]*)<\/td><td class="d">([^<]*)<\/td>/gi
  let match: RegExpExecArray | null
  while ((match = rowRegex.exec(html)) !== null) {
    const [, href, rawName, rawSize, rawDate] = match
    const filename = rawName.trim()
    const sha = /-([0-9a-f]{40})\.jar$/i.exec(filename)?.[1]?.toLowerCase()
    const build = /-(\d+)\.jar$/.exec(filename)?.[1]
    const key = project === 'banner' ? sha : build
    if (!key || jars.has(key)) continue
    jars.set(key, {
      id: project === 'banner' ? key.slice(0, 7) : key,
      filename,
      url: href.startsWith('http') ? href : `https://mohistmc.com${href}`,
      sha,
      size: rawSize.trim() || undefined,
      date: rawDate.trim() || undefined
    })
  }
  const list = [...jars.values()]
  if (project === 'mohist') {
    return list.sort((a, b) => Number(b.id) - Number(a.id))
  }
  return list.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
}

/**
 * MohistMC API перечисляет версии, для которых ещё нет опубликованных jar.
 * Проверяем каталог builds-raw, чтобы не предлагать заведомо нерабочие версии.
 */
export async function listMohistVersions(
  project: 'mohist' | 'banner',
  refresh = false
): Promise<string[]> {
  const projects = await getMohistProjects(refresh)
  const versions = projects.find((entry) => entry.project === project)?.versions ?? []
  const dirName = project === 'mohist' ? 'Mohist' : 'Banner'
  const checks = await Promise.all(
    versions.map(async (version) => {
      try {
        const html = await cachedText(
          `mohist-raw-dir-${project}-${version}.json`,
          `${MOHIST_RAW}/${dirName}-${encodeURIComponent(version)}/`,
          THIRTY_MINUTES,
          refresh
        )
        return { version, available: /\.jar/i.test(html) }
      } catch {
        return { version, available: false }
      }
    })
  )
  return checks.filter((entry) => entry.available).map((entry) => entry.version)
}

export async function listYouerVersions(refresh = false): Promise<string[]> {
  const data = await cachedJson<Array<{ name: string }>>(
    'youer-versions.json',
    `${YOUER_API}/versions`,
    THIRTY_MINUTES,
    refresh
  )
  return (data ?? []).map((entry) => entry.name).filter(Boolean)
}

/**
 * Youer — гибрид NeoForge + Paper/Purpur от MohistMC. Официальный JSON API
 * (api.mohistmc.com) отдаёт сборки и прямые ссылки на jar.
 */
export async function listYouerBuilds(mcVersion: string, refresh = false): Promise<YouerBuild[]> {
  const data = await cachedJson<YouerBuild[]>(
    `youer-builds-${mcVersion}.json`,
    `${YOUER_API}/${encodeURIComponent(mcVersion)}/builds`,
    THIRTY_MINUTES,
    refresh
  )
  return [...(data ?? [])].sort((a, b) => Number(b.id) - Number(a.id))
}

export async function pickYouerBuild(mcVersion: string, buildId?: string): Promise<YouerBuild> {
  const builds = await listYouerBuilds(mcVersion)
  if (!builds.length) {
    throw new Error(t('Youer не публикует сборки для Minecraft {version}', { version: mcVersion }))
  }
  if (buildId) {
    const exact = builds.find((build) => String(build.id) === buildId)
    if (exact) return exact
  }
  return builds[0]
}

export function youerDownloadUrl(mcVersion: string, buildId: number | string): string {
  return `${YOUER_API}/${encodeURIComponent(mcVersion)}/builds/${encodeURIComponent(String(buildId))}/download`
}

export async function getMagmaVersions(refresh = false): Promise<MagmaVersion[]> {
  const data = await cachedJson<{ versions?: MagmaVersion[] }>(
    'magma-versions.json',
    `${MAGMA_API}/versions?limit=100`,
    THIRTY_MINUTES,
    refresh
  )
  return data.versions ?? []
}

export async function pickMagmaVersion(
  mcVersion: string,
  loaderVersion?: string
): Promise<MagmaVersion> {
  const versions = await getMagmaVersions()
  const matching = versions.filter(
    (entry) => magmaMinecraftVersion(entry.version) === mcVersion && entry.launcherUrl
  )
  if (loaderVersion) {
    const exact = matching.find((entry) => entry.version === loaderVersion)
    if (exact) return exact
  }
  const stable = matching.find((entry) => entry.isStable)
  if (stable) return stable
  if (matching.length) return matching[0]
  throw new Error(t('Magma не поддерживает Minecraft {version}', { version: mcVersion }))
}

async function getSpongeVersions(
  artifact: 'spongevanilla' | 'spongeforge',
  refresh = false
): Promise<SpongeVersionsResponse> {
  return cachedJson<SpongeVersionsResponse>(
    `sponge-${artifact}-versions.json`,
    `${SPONGE_API}/${artifact}/versions`,
    THIRTY_MINUTES,
    refresh
  )
}

function spongeBuilds(
  data: SpongeVersionsResponse,
  mcVersion?: string
): SpongeBuild[] {
  const builds: SpongeBuild[] = []
  for (const [version, entry] of Object.entries(data.artifacts ?? {})) {
    const minecraft = entry.tagValues?.minecraft ?? ''
    if (!minecraft) continue
    if (mcVersion && minecraft !== mcVersion) continue
    builds.push({
      version,
      minecraft,
      forge: entry.tagValues?.forge,
      recommended: Boolean(entry.recommended)
    })
  }
  return builds.sort((a, b) => {
    if (a.recommended !== b.recommended) return a.recommended ? -1 : 1
    return compareDesc(a.version, b.version)
  })
}

export async function listSpongeBuilds(
  artifact: 'spongevanilla' | 'spongeforge',
  mcVersion: string
): Promise<SpongeBuild[]> {
  return spongeBuilds(await getSpongeVersions(artifact), mcVersion)
}

export async function pickSpongeBuild(
  artifact: 'spongevanilla' | 'spongeforge',
  mcVersion: string,
  loaderVersion?: string
): Promise<SpongeBuild> {
  const builds = await listSpongeBuilds(artifact, mcVersion)
  if (loaderVersion) {
    const exact = builds.find((entry) => entry.version === loaderVersion)
    if (exact) return exact
  }
  if (builds.length) return builds[0]
  throw new Error(
    t('{loader} не поддерживает Minecraft {version}', {
      loader: artifact === 'spongevanilla' ? 'SpongeVanilla' : 'SpongeForge',
      version: mcVersion
    })
  )
}

export async function getSpongeUniversal(
  artifact: 'spongevanilla' | 'spongeforge',
  version: string
): Promise<{ url: string; filename: string }> {
  const data = await fetchJson<{ assets?: SpongeAsset[] }>(
    `${SPONGE_API}/${artifact}/versions/${encodeURIComponent(version)}`
  )
  const asset = (data.assets ?? []).find(
    (entry) => entry.classifier === 'universal' && entry.extension === 'jar' && entry.downloadUrl
  )
  if (!asset?.downloadUrl) {
    throw new Error(t('Не найден universal-jar Sponge {version}', { version }))
  }
  const filename = asset.downloadUrl.split('/').pop() ?? `${artifact}-${version}-universal.jar`
  return { url: asset.downloadUrl, filename }
}

async function getBukkitJars(
  type: 'spigot' | 'craftbukkit',
  refresh = false
): Promise<GetBukkitJar[]> {
  const data = await cachedJson<GetBukkitJar[]>(
    `getbukkit-${type}.json`,
    `${GETBUKKIT_API}/${type}`,
    THIRTY_MINUTES,
    refresh
  )
  return Array.isArray(data) ? data : []
}

export async function pickGetBukkitJar(
  type: 'spigot' | 'craftbukkit',
  mcVersion: string
): Promise<GetBukkitJar> {
  const jars = await getBukkitJars(type)
  const jar = jars.find((entry) => entry.version === mcVersion)
  if (!jar) {
    const label = type === 'spigot' ? 'Spigot' : 'CraftBukkit'
    throw new Error(t('{loader} не публикует jar для Minecraft {version}', { loader: label, version: mcVersion }))
  }
  return jar
}

export function getBukkitDownloadUrl(jar: { downloadUrl: string }): string {
  return `${GETBUKKIT_DOWNLOAD}${jar.downloadUrl}`
}

async function getJenkinsBuilds(
  base: string,
  job: string,
  cacheName: string,
  refresh = false
): Promise<JenkinsBuild[]> {
  const url = `${base}/job/${encodeURIComponent(job)}/api/json?tree=${encodeURIComponent(
    JENKINS_TREE
  )}`
  const data = await cachedJson<{ builds?: JenkinsBuild[] }>(
    cacheName,
    url,
    THIRTY_MINUTES,
    refresh
  )
  return (data.builds ?? []).filter(
    (build) => build.result === 'SUCCESS' && (build.artifacts?.length ?? 0) > 0
  )
}

/** Pufferfish собирается отдельной Jenkins-задачей под каждую ветку 1.x. */
export async function getPufferfishBuilds(refresh = false): Promise<PufferfishBuild[]> {
  const lists = await Promise.all(
    PUFFERFISH_JOBS.map(async (job) => {
      try {
        return await getJenkinsBuilds(PUFFERFISH_CI, job, `pufferfish-${job}.json`, refresh)
      } catch {
        return []
      }
    })
  )
  const result: PufferfishBuild[] = []
  lists.forEach((builds, index) => {
    const job = PUFFERFISH_JOBS[index]
    for (const build of builds) {
      const artifact = build.artifacts?.[0]
      const mcVersion = artifact
        ? /^pufferfish(?:-paperclip)?-(\d+\.\d+(?:\.\d+)?)/i.exec(artifact.fileName)?.[1]
        : null
      if (!artifact || !mcVersion) continue
      result.push({
        id: build.number,
        mcVersion,
        fileName: artifact.fileName,
        relativePath: artifact.relativePath,
        job
      })
    }
  })
  return result.sort((a, b) => b.id - a.id)
}

export async function pickPufferfishBuild(
  mcVersion: string,
  buildId?: string
): Promise<PufferfishBuild> {
  const builds = (await getPufferfishBuilds()).filter((build) => build.mcVersion === mcVersion)
  if (!builds.length) {
    throw new Error(t('Pufferfish не публикует сборки для Minecraft {version}', { version: mcVersion }))
  }
  if (buildId) {
    const exact = builds.find((build) => String(build.id) === String(buildId))
    if (exact) return exact
  }
  return builds[0]
}

export function pufferfishDownloadUrl(build: PufferfishBuild): string {
  return `${PUFFERFISH_CI}/job/${encodeURIComponent(build.job)}/${build.id}/artifact/${
    build.relativePath
  }`
}

/** Canvas Jenkins подписывает сборки как "#993 - 26.3". */
export async function getCanvasBuilds(refresh = false): Promise<CanvasBuild[]> {
  const builds = await getJenkinsBuilds(CANVAS_CI, 'Canvas', 'canvas-builds.json', refresh)
  const result: CanvasBuild[] = []
  for (const build of builds) {
    const artifact =
      build.artifacts?.find((entry) => /^canvas-build\.\d+\.jar$/i.test(entry.fileName)) ??
      build.artifacts?.[0]
    const mcVersion = /#\d+\s*-\s*(\S+)/.exec(build.displayName ?? '')?.[1]
    if (!artifact || !mcVersion) continue
    result.push({
      id: build.number,
      mcVersion,
      fileName: artifact.fileName,
      relativePath: artifact.relativePath
    })
  }
  return result.sort((a, b) => b.id - a.id)
}

export async function pickCanvasBuild(
  mcVersion: string,
  buildId?: string
): Promise<CanvasBuild> {
  const builds = (await getCanvasBuilds()).filter((build) => build.mcVersion === mcVersion)
  if (!builds.length) {
    throw new Error(t('Canvas не публикует сборки для Minecraft {version}', { version: mcVersion }))
  }
  if (buildId) {
    const exact = builds.find((build) => String(build.id) === String(buildId))
    if (exact) return exact
  }
  return builds[0]
}

export function canvasDownloadUrl(build: CanvasBuild): string {
  return `${CANVAS_CI}/job/Canvas/${build.id}/artifact/${build.relativePath}`
}

export async function listMinecraftVersions(
  loader: LoaderType,
  refresh = false
): Promise<VersionInfo[]> {
  const manifest = await getManifest(refresh)
  const known = new Set(manifest.versions.map((version) => version.id))

  switch (loader) {
    case 'vanilla':
    case 'fabric':
      return toVersionInfos(
        manifest.versions.map((version) => version.id),
        manifest
      )

    case 'paper':
    case 'folia':
    case 'velocity':
    case 'waterfall': {
      const projectId = PAPER_PROJECTS[loader] as string
      const project = await cachedJson<PaperProject>(
        `${projectId}-project.json`,
        `${PAPER_API}/projects/${projectId}`,
        THIRTY_MINUTES,
        refresh
      )
      return toVersionInfos(paperVersionIds(project), manifest)
    }

    case 'bungeecord':
      return [{ id: 'latest', type: 'release', label: t('Последняя сборка') }]

    case 'purpur': {
      const project = await cachedJson<PurpurProject>(
        'purpur-project.json',
        PURPUR_API,
        THIRTY_MINUTES,
        refresh
      )
      return toVersionInfos(project.versions ?? [], manifest)
    }

    case 'spigot':
    case 'craftbukkit': {
      const jars = await getBukkitJars(loader, refresh)
      const ids = jars.map((jar) => jar.version).filter((version) => known.has(version))
      return toVersionInfos(ids, manifest)
    }

    case 'pufferfish': {
      const builds = await getPufferfishBuilds(refresh)
      const ids = builds.map((build) => build.mcVersion).filter((version) => known.has(version))
      return toVersionInfos(ids, manifest)
    }

    case 'canvas': {
      const builds = await getCanvasBuilds(refresh)
      const ids = builds.map((build) => build.mcVersion).filter((version) => known.has(version))
      return toVersionInfos(ids, manifest)
    }

    case 'forge': {
      const xml = await cachedText(
        'forge-metadata.xml',
        `${FORGE_MAVEN}/maven-metadata.xml`,
        ONE_HOUR,
        refresh
      )
      const ids = forgePairs(xmlVersions(xml))
        .map((pair) => pair.mc)
        .filter((mc) => known.has(mc))
      return toVersionInfos(ids, manifest)
    }

    case 'neoforge': {
      const xml = await cachedText(
        'neoforge-metadata.xml',
        `${NEOFORGE_MAVEN}/maven-metadata.xml`,
        ONE_HOUR,
        refresh
      )
      const ids = xmlVersions(xml)
        .filter((version) => !version.includes('alpha') && !version.includes('snapshot') && !version.includes('pre-'))
        .map((version) => neoForgeMcVersion(version, known))
        .filter((mc): mc is string => Boolean(mc))
      return toVersionInfos(ids, manifest)
    }

    case 'arclight': {
      const assets = await getArclightAssets(refresh)
      const ids = assets.filter((asset) => asset.flavor === 'forge').map((asset) => asset.mcVersion)
      return toVersionInfos(ids, manifest)
    }

    case 'mohist':
    case 'banner': {
      return toVersionInfos(await listMohistVersions(loader, refresh), manifest)
    }

    case 'youer': {
      return toVersionInfos(await listYouerVersions(refresh), manifest)
    }

    case 'magma': {
      const versions = await getMagmaVersions(refresh)
      const ids = versions
        .map((entry) => magmaMinecraftVersion(entry.version))
        .filter((mc): mc is string => Boolean(mc) && known.has(mc as string))
      return toVersionInfos(ids, manifest)
    }

    case 'sponge-vanilla':
    case 'sponge-forge': {
      const artifact = loader === 'sponge-vanilla' ? 'spongevanilla' : 'spongeforge'
      const data = await getSpongeVersions(artifact, refresh)
      const ids = spongeBuilds(data)
        .map((build) => build.minecraft)
        .filter((mc) => known.has(mc))
      return toVersionInfos(ids, manifest)
    }

    default:
      return []
  }
}

export async function listLoaderBuilds(loader: LoaderType, mcVersion: string): Promise<string[]> {
  switch (loader) {
    case 'paper':
    case 'folia':
    case 'velocity':
    case 'waterfall': {
      const projectId = PAPER_PROJECTS[loader] as string
      const builds = await fetchJson<PaperBuild[]>(
        `${PAPER_API}/projects/${projectId}/versions/${encodeURIComponent(mcVersion)}/builds`
      )
      const stable = builds.filter((build) => build.channel === 'STABLE')
      return (stable.length ? stable : builds).map((build) => String(build.id))
    }

    case 'purpur': {
      const meta = await fetchJson<PurpurVersion>(
        `${PURPUR_API}/${encodeURIComponent(mcVersion)}`
      )
      return [...(meta.builds?.all ?? [])].reverse().map(String)
    }

    case 'pufferfish': {
      return (await getPufferfishBuilds())
        .filter((build) => build.mcVersion === mcVersion)
        .map((build) => String(build.id))
    }

    case 'canvas': {
      return (await getCanvasBuilds())
        .filter((build) => build.mcVersion === mcVersion)
        .map((build) => String(build.id))
    }

    case 'fabric': {
      const loaders = await fetchJson<FabricLoaderEntry[]>(
        `${FABRIC_META}/versions/loader/${encodeURIComponent(mcVersion)}`
      )
      return loaders.map((entry) => entry.loader.version)
    }

    case 'forge': {
      const xml = await cachedText(
        'forge-metadata.xml',
        `${FORGE_MAVEN}/maven-metadata.xml`,
        ONE_HOUR
      )
      return forgePairs(xmlVersions(xml))
        .filter((pair) => pair.mc === mcVersion)
        .map((pair) => pair.loader)
        .filter((loader) => !/mapped|sources|javadoc|userdev|installer/i.test(loader))
        .sort(compareDesc)
    }

    case 'neoforge': {
      const xml = await cachedText(
        'neoforge-metadata.xml',
        `${NEOFORGE_MAVEN}/maven-metadata.xml`,
        ONE_HOUR
      )
      const manifest = await getManifest()
      const known = new Set(manifest.versions.map((version) => version.id))
      return xmlVersions(xml)
        .filter((version) => !version.includes('alpha') && !version.includes('snapshot') && !version.includes('pre-'))
        .filter((version) => neoForgeMcVersion(version, known) === mcVersion)
        .sort(compareDesc)
    }

    case 'mohist':
    case 'banner': {
      return (await listMohistJars(loader, mcVersion)).map((jar) => jar.id)
    }

    case 'youer': {
      return (await listYouerBuilds(mcVersion)).map((build) => String(build.id))
    }

    case 'magma': {
      const versions = await getMagmaVersions()
      return versions
        .filter((entry) => magmaMinecraftVersion(entry.version) === mcVersion && entry.launcherUrl)
        .map((entry) => entry.version)
    }

    case 'sponge-vanilla': {
      return (await listSpongeBuilds('spongevanilla', mcVersion)).map((build) => build.version)
    }

    case 'sponge-forge': {
      return (await listSpongeBuilds('spongeforge', mcVersion)).map((build) => build.version)
    }

    case 'bungeecord':
    default:
      return []
  }
}

export async function getArclightAssets(refresh = false): Promise<ArclightAsset[]> {
  const releases = await cachedJson<GhRelease[]>(
    'arclight-releases.json',
    ARCLIGHT_RELEASES,
    THIRTY_MINUTES,
    refresh
  )
  const assets: ArclightAsset[] = []
  for (const release of releases) {
    if (release.draft) continue
    for (const asset of release.assets ?? []) {
      const match = /^arclight-(forge|fabric)-(\d+\.\d+(?:\.\d+)?)-(.+)\.jar$/.exec(asset.name)
      if (!match) continue
      assets.push({
        mcVersion: match[2],
        flavor: match[1] as 'forge' | 'fabric',
        version: match[3],
        filename: asset.name,
        url: asset.browser_download_url,
        publishedAt: release.published_at
      })
    }
  }
  return assets.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
}

export async function pickArclightAsset(
  mcVersion: string,
  flavor: 'forge' | 'fabric' = 'forge'
): Promise<ArclightAsset> {
  const assets = await getArclightAssets()
  const matching = assets.filter(
    (asset) => asset.mcVersion === mcVersion && asset.flavor === flavor
  )
  if (!matching.length) {
    throw new Error(
      t('ArcLight не поддерживает Minecraft {version} ({flavor})', { version: mcVersion, flavor })
    )
  }
  return matching[0]
}

export async function pickPaperBuild(
  mcVersion: string,
  buildId?: string,
  project = 'paper'
): Promise<PaperBuild> {
  const base = `${PAPER_API}/projects/${project}/versions/${encodeURIComponent(mcVersion)}/builds`
  if (buildId) {
    try {
      return await fetchJson<PaperBuild>(`${base}/${encodeURIComponent(buildId)}`)
    } catch {
      // fall back to latest below
    }
  }
  return fetchJson<PaperBuild>(`${base}/latest`)
}

export type { MojangManifest, MinecraftVersionJson }
