import fs from 'node:fs'
import path from 'node:path'
import type {
  InstalledMod,
  InstalledModMetadata,
  LoaderType,
  ModInstallInput,
  ModKind,
  ModSearchParams,
  ModSearchResult,
  ModUpdateStatus,
  ModVersionInfo,
  ModVersionsInput
} from '@shared/types'
import { isProxyLoader, loaderSupportsMods, loaderSupportsPlugins } from '@shared/types'
import { downloadFile, fetchJson } from './http'
import { t } from './i18n'
import { getSettings } from './store'
import { ensureModsFolder, modsFolder, readInstance, readModMetadata, recordModMetadata, baseModFilename } from './server-manager'
import { broadcast } from './events'

const MODRINTH_API = 'https://api.modrinth.com/v2'
const CURSEFORGE_API = 'https://api.curseforge.com/v1'
const CURSEFORGE_GAME_ID = 432

interface ModrinthHit {
  project_id: string
  project_type: string
  slug: string
  title: string
  description: string
  author: string
  downloads: number
  icon_url?: string
  categories: string[]
  display_categories?: string[]
  client_only?: boolean
  environment?: { server?: string; client?: string }
}

interface ModrinthSearchResponse {
  hits: ModrinthHit[]
}

interface ModrinthVersion {
  id: string
  project_id?: string
  name: string
  version_number: string
  date_published: string
  game_versions?: string[]
  loaders?: string[]
  files: Array<{ url: string; filename: string; primary: boolean; size: number }>
  version_type?: 'release' | 'beta' | 'alpha'
}

interface CurseForgeMod {
  id: number
  name: string
  slug: string
  summary: string
  downloadCount: number
  logo?: { thumbnailUrl?: string }
  authors?: Array<{ name: string }>
  categories?: Array<{ name: string }>
}

interface CurseForgeSearchResponse {
  data: CurseForgeMod[]
}

interface CurseForgeFile {
  id: number
  fileName: string
  displayName?: string
  fileDate: string
  downloadUrl: string | null
  fileLength: number
  gameVersions: string[]
  releaseType?: number
}

interface CurseForgeFilesResponse {
  data: CurseForgeFile[]
}

interface CurseForgeFileResponse {
  data: CurseForgeFile
}

const CURSEFORGE_PAGE_SIZE = 50
const CURSEFORGE_MAX_PAGES = 20
const NON_LOADER_TAGS = new Set(['client', 'server', 'datapack'])

function modrinthLoaders(loader: LoaderType, kind: ModKind): string[] {
  if (kind === 'plugin') {
    switch (loader) {
      case 'paper':
        return ['paper', 'spigot', 'bukkit']
      case 'purpur':
        return ['purpur', 'paper', 'spigot', 'bukkit']
      case 'folia':
        return ['folia', 'paper', 'spigot', 'bukkit']
      case 'spigot':
      case 'craftbukkit':
        return ['spigot', 'bukkit']
      case 'pufferfish':
        return ['paper', 'spigot', 'bukkit']
      case 'canvas':
        return ['folia', 'paper', 'spigot', 'bukkit']
      case 'velocity':
        return ['velocity']
      case 'bungeecord':
        return ['bungeecord']
      case 'waterfall':
        return ['waterfall', 'bungeecord']
      case 'sponge-vanilla':
      case 'sponge-forge':
        return ['sponge']
      case 'arclight':
      case 'mohist':
      case 'banner':
      case 'youer':
      case 'magma':
        return ['paper', 'spigot', 'bukkit']
      default:
        throw new Error(t('Выбранное ядро не поддерживает плагины'))
    }
  }

  switch (loader) {
    case 'fabric':
    case 'banner':
      return ['fabric']
    case 'forge':
    case 'arclight':
    case 'mohist':
    case 'magma':
    case 'sponge-forge':
      return ['forge']
    case 'neoforge':
    case 'youer':
      return ['neoforge']
    case 'paper':
    case 'purpur':
    case 'folia':
      return ['paper', 'purpur', 'spigot', 'bukkit']
    default:
      throw new Error(
        t(
          'MODS_UNSUPPORTED:Это ядро не поддерживает моды. Выберите Fabric, Forge, NeoForge, Paper или гибридное ядро.'
        )
      )
  }
}

function curseForgeLoaderType(loader: LoaderType): number | undefined {
  switch (loader) {
    case 'forge':
    case 'arclight':
    case 'mohist':
    case 'magma':
    case 'sponge-forge':
      return 1
    case 'fabric':
    case 'banner':
      return 4
    case 'neoforge':
    case 'youer':
      return 6
    default:
      return undefined
  }
}

function isMinecraftVersion(value: string): boolean {
  return /^\d+(?:\.\d+)+$/.test(value)
}

/** CurseForge кладёт версии Minecraft и названия загрузчиков в один массив. */
function splitCurseForgeTags(values: string[]): { gameVersions: string[]; loaders: string[] } {
  const gameVersions: string[] = []
  const loaders: string[] = []
  for (const value of values) {
    if (isMinecraftVersion(value)) gameVersions.push(value)
    else if (!NON_LOADER_TAGS.has(value.toLowerCase())) loaders.push(value)
  }
  return { gameVersions, loaders }
}

function versionCompatible(
  loader: LoaderType,
  kind: ModKind,
  loaders: string[],
  gameVersions: string[],
  gameVersion: string
): boolean {
  const accepted = modrinthLoaders(loader, kind)
  const normalized = loaders.map((value) => value.toLowerCase())
  const loaderOk =
    normalized.length === 0 || accepted.some((tag) => normalized.includes(tag.toLowerCase()))
  if (!loaderOk) return false
  return isProxyLoader(loader) || gameVersions.includes(gameVersion)
}

function curseForgeKey(): string {
  const apiKey = getSettings().curseforgeApiKey.trim()
  if (!apiKey) {
    throw new Error(
      t('CURSEFORGE_KEY_REQUIRED:Для загрузки с CurseForge добавьте API-ключ в настройках приложения')
    )
  }
  return apiKey
}

function sanitizeFilename(name: string): string {
  return path.basename(name).replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

interface ResolvedModFile {
  url: string
  filename: string
  versionId: string
  version: string
}

interface ModMetaInput {
  source: 'modrinth' | 'curseforge'
  projectId?: string
  versionId?: string
  version?: string
  name?: string
}

async function resolveModrinthFile(
  loader: LoaderType,
  kind: ModKind,
  gameVersion: string,
  projectId: string,
  name: string
): Promise<ResolvedModFile> {
  const loaders = modrinthLoaders(loader, kind)
  const url = new URL(`${MODRINTH_API}/project/${encodeURIComponent(projectId)}/version`)
  if (!isProxyLoader(loader)) {
    url.searchParams.set('game_versions', JSON.stringify([gameVersion]))
  }
  url.searchParams.set('loaders', JSON.stringify(loaders))

  const versions = await fetchJson<ModrinthVersion[]>(url.toString())
  const channels = getSettings().releaseChannels ?? ['release']
  const includeRelease = channels.includes('release')
  const includeBeta = channels.includes('beta')
  const includeAlpha = channels.includes('alpha')
  const filteredVersions = versions.filter((v) => {
    const vt = v.version_type ?? 'release'
    if (includeRelease && vt === 'release') return true
    if (includeBeta && vt === 'beta') return true
    if (includeAlpha && vt === 'alpha') return true
    return false
  })
  if (!filteredVersions.length) {
    throw new Error(
      t('NO_COMPATIBLE_FILE:Нет сборки «{name}» для Minecraft {version} ({loader})', {
        name,
        version: gameVersion,
        loader
      })
    )
  }
  filteredVersions.sort((a, b) => b.date_published.localeCompare(a.date_published))
  const chosen = filteredVersions[0]
  const file = chosen.files.find((candidate) => candidate.primary) ?? chosen.files[0]
  if (!file?.url) throw new Error(t('У проекта нет доступного файла для скачивания'))
  return {
    url: file.url,
    filename: file.filename,
    versionId: chosen.id,
    version: chosen.version_number || chosen.name || file.filename
  }
}

async function resolveCurseForgeFile(
  loader: LoaderType,
  kind: ModKind,
  gameVersion: string,
  projectId: string
): Promise<ResolvedModFile> {
  const apiKey = getSettings().curseforgeApiKey.trim()
  if (!apiKey) {
    throw new Error(
      t('CURSEFORGE_KEY_REQUIRED:Для загрузки с CurseForge добавьте API-ключ в настройках приложения')
    )
  }

  const url = new URL(`${CURSEFORGE_API}/mods/${encodeURIComponent(projectId)}/files`)
  if (!isProxyLoader(loader)) url.searchParams.set('gameVersion', gameVersion)
  url.searchParams.set('pageSize', '50')
  const loaderType = curseForgeLoaderType(loader)
  if (kind === 'mod' && loaderType !== undefined) {
    url.searchParams.set('modLoaderType', String(loaderType))
  }

  const response = await fetchJson<CurseForgeFilesResponse>(url.toString(), {
    headers: { 'x-api-key': apiKey }
  })
  const channels = getSettings().releaseChannels ?? ['release']
  const includeRelease = channels.includes('release')
  const includeBeta = channels.includes('beta')
  const includeAlpha = channels.includes('alpha')
  const curseforgeReleaseTypeSet = new Set<number>()
  if (includeRelease) curseforgeReleaseTypeSet.add(1)
  if (includeBeta) curseforgeReleaseTypeSet.add(2)
  if (includeAlpha) curseforgeReleaseTypeSet.add(3)
  const files = (response.data ?? [])
    .filter((file) => file.fileName.toLowerCase().endsWith('.jar'))
    .filter((file) => curseforgeReleaseTypeSet.has(file.releaseType ?? 1))
    .sort((a, b) => b.fileDate.localeCompare(a.fileDate))
  const file = files.find((candidate) => Boolean(candidate.downloadUrl))
  if (!file) {
    throw new Error(
      t(
        'DOWNLOAD_UNAVAILABLE:Автор мода запретил стороннее скачивание на CurseForge — установите файл вручную'
      )
    )
  }
  return {
    url: file.downloadUrl as string,
    filename: file.fileName,
    versionId: String(file.id),
    version: file.displayName || file.fileName
  }
}

async function resolveModrinthVersionFile(
  projectId: string,
  versionId: string
): Promise<ResolvedModFile> {
  const version = await fetchJson<ModrinthVersion>(
    `${MODRINTH_API}/version/${encodeURIComponent(versionId)}`
  )
  if (version.project_id && version.project_id !== projectId) {
    throw new Error(t('Выбранная версия не принадлежит этому проекту'))
  }
  const file = version.files.find((candidate) => candidate.primary) ?? version.files[0]
  if (!file?.url) throw new Error(t('У выбранной версии нет доступного файла для скачивания'))
  return {
    url: file.url,
    filename: file.filename,
    versionId: version.id,
    version: version.version_number || version.name || file.filename
  }
}

async function resolveCurseForgeVersionFile(
  projectId: string,
  fileId: string
): Promise<ResolvedModFile> {
  const apiKey = curseForgeKey()
  const response = await fetchJson<CurseForgeFileResponse>(
    `${CURSEFORGE_API}/mods/${encodeURIComponent(projectId)}/files/${encodeURIComponent(fileId)}`,
    { headers: { 'x-api-key': apiKey } }
  )
  const file = response.data
  if (!file?.downloadUrl) {
    throw new Error(
      t(
        'DOWNLOAD_UNAVAILABLE:Автор мода запретил стороннее скачивание этой версии на CurseForge — установите файл вручную'
      )
    )
  }
  return {
    url: file.downloadUrl,
    filename: file.fileName,
    versionId: String(file.id),
    version: file.displayName || file.fileName
  }
}

/** Полный список файлов проекта: нужен для выбора и отката на старые версии. */
export async function listModVersions(input: ModVersionsInput): Promise<ModVersionInfo[]> {
  const channels = input.releaseChannels ?? ['release']
  const includeRelease = channels.includes('release')
  const includeBeta = channels.includes('beta')
  const includeAlpha = channels.includes('alpha')

  const modrinthReleaseTypeMap = new Set<string>()
  if (includeRelease) modrinthReleaseTypeMap.add('release')
  if (includeBeta) modrinthReleaseTypeMap.add('beta')
  if (includeAlpha) modrinthReleaseTypeMap.add('alpha')

  const curseforgeReleaseTypeSet = new Set<number>()
  if (includeRelease) curseforgeReleaseTypeSet.add(1)
  if (includeBeta) curseforgeReleaseTypeSet.add(2)
  if (includeAlpha) curseforgeReleaseTypeSet.add(3)

  if (input.source === 'modrinth') {
    const versions = await fetchJson<ModrinthVersion[]>(
      `${MODRINTH_API}/project/${encodeURIComponent(input.projectId)}/version`
    )
    return (versions ?? [])
      .map((version): ModVersionInfo & { version_type?: string } => {
        const file = version.files.find((candidate) => candidate.primary) ?? version.files[0]
        const loaders = version.loaders ?? []
        const gameVersions = version.game_versions ?? []
        return {
          id: version.id,
          name: version.version_number || version.name || file?.filename || version.id,
          fileName: file?.filename ?? '',
          fileSize: file?.size,
          publishedAt: version.date_published,
          gameVersions,
          loaders,
          compatible: versionCompatible(
            input.loader,
            input.kind,
            loaders,
            gameVersions,
            input.gameVersion
          ),
          downloadable: Boolean(file?.url)
        }
      })
      .filter(
        (version) =>
          version.compatible &&
          version.fileName.toLowerCase().endsWith('.jar') &&
          modrinthReleaseTypeMap.has(version.version_type ?? 'release')
      )
      .sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''))
  }

  const apiKey = curseForgeKey()
  const files: CurseForgeFile[] = []
  for (let page = 0; page < CURSEFORGE_MAX_PAGES; page += 1) {
    const url = new URL(
      `${CURSEFORGE_API}/mods/${encodeURIComponent(input.projectId)}/files`
    )
    url.searchParams.set('pageSize', String(CURSEFORGE_PAGE_SIZE))
    url.searchParams.set('index', String(page))
    const response = await fetchJson<CurseForgeFilesResponse>(url.toString(), {
      headers: { 'x-api-key': apiKey }
    })
    const batch = response.data ?? []
    files.push(...batch)
    if (batch.length < CURSEFORGE_PAGE_SIZE) break
  }

  const filteredFiles = files
    .filter((file) => file.fileName.toLowerCase().endsWith('.jar'))
    .filter((file) => curseforgeReleaseTypeSet.has(file.releaseType ?? 1))

  return filteredFiles
    .map((file): ModVersionInfo => {
      const { gameVersions, loaders } = splitCurseForgeTags(file.gameVersions ?? [])
      return {
        id: String(file.id),
        name: file.displayName || file.fileName,
        fileName: file.fileName,
        fileSize: file.fileLength,
        publishedAt: file.fileDate,
        gameVersions,
        loaders,
        compatible: versionCompatible(
          input.loader,
          input.kind,
          loaders,
          gameVersions,
          input.gameVersion
        ),
        downloadable: Boolean(file.downloadUrl)
      }
    })
    .filter((version) => version.compatible)
    .sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''))
}

async function downloadMod(
  url: string,
  filename: string,
  kind: ModKind,
  serverId: string,
  meta: ModMetaInput
): Promise<InstalledMod> {
  if (!isHttpUrl(url)) throw new Error(t('Источник вернул некорректную ссылку на файл'))
  const folder = await ensureModsFolder(serverId, kind)
  const safeName = sanitizeFilename(filename)
  if (!safeName) throw new Error(t('Не удалось определить имя файла мода'))
  const destination = path.join(folder, safeName)
  await fs.promises.rm(destination, { force: true })
  await downloadFile(url, destination, (received, total) => {
    const percent = total > 0 ? Math.round((received / total) * 100) : undefined
    const mb = (received / 1024 / 1024).toFixed(1)
    broadcast('progress', {
      scope: 'mod',
      message: t('Скачивание {file}: {size} МБ', { file: safeName, size: mb }),
      percent,
      serverId
    })
  })
  const stat = await fs.promises.stat(destination)
  const installedAt = stat.mtimeMs
  await recordModMetadata(serverId, {
    filename: safeName,
    kind,
    source: meta.source,
    projectId: meta.projectId,
    versionId: meta.versionId,
    version: meta.version,
    name: meta.name,
    installedAt
  })
  return {
    filename: safeName,
    size: stat.size,
    installedAt,
    kind,
    enabled: true,
    source: meta.source,
    projectId: meta.projectId,
    versionId: meta.versionId,
    version: meta.version,
    name: meta.name
  }
}

export async function searchMods(params: ModSearchParams): Promise<ModSearchResult[]> {
  if (!params.query?.trim() && params.source === 'curseforge') {
    // CurseForge still allows empty queries (popular list), keep going.
  }
  if (params.kind === 'plugin' && !loaderSupportsPlugins(params.loader)) {
    throw new Error(t('Выбранное ядро не поддерживает плагины'))
  }
  if (params.kind === 'mod' && !loaderSupportsMods(params.loader)) {
    throw new Error(t('Выбранное ядро не поддерживает моды'))
  }
  const loaders = modrinthLoaders(params.loader, params.kind)
  const versioned = !isProxyLoader(params.loader) && Boolean(params.gameVersion)

  if (params.source === 'modrinth') {
    const facets: Array<Array<string>> = [
      [`project_type:${params.kind === 'plugin' ? 'plugin' : 'mod'}`]
    ]
    if (versioned) facets.push([`versions:${params.gameVersion}`])
    if (loaders.length) facets.push(loaders.map((loader) => `categories:${loader}`))

    const url = new URL(`${MODRINTH_API}/search`)
    url.searchParams.set('query', params.query.trim())
    url.searchParams.set('limit', '24')
    url.searchParams.set('index', 'relevance')
    url.searchParams.set('facets', JSON.stringify(facets))

    const response = await fetchJson<ModrinthSearchResponse>(url.toString())
    return (response.hits ?? []).map((hit) => ({
        id: hit.project_id,
        source: 'modrinth',
        slug: hit.slug,
        name: hit.title,
        summary: hit.description,
        author: hit.author,
        downloads: hit.downloads,
        iconUrl: hit.icon_url,
        categories: (hit.display_categories ?? hit.categories ?? []).slice(0, 6),
        kind: params.kind
      }))
  }

  const apiKey = getSettings().curseforgeApiKey.trim()
  if (!apiKey) {
    throw new Error(
      t('CURSEFORGE_KEY_REQUIRED:Для поиска на CurseForge добавьте API-ключ в настройках приложения')
    )
  }

  const url = new URL(`${CURSEFORGE_API}/mods/search`)
  url.searchParams.set('gameId', String(CURSEFORGE_GAME_ID))
  url.searchParams.set('classId', params.kind === 'plugin' ? '5' : '6')
  url.searchParams.set('searchFilter', params.query.trim())
  if (versioned) url.searchParams.set('gameVersion', params.gameVersion)
  url.searchParams.set('pageSize', '24')
  url.searchParams.set('sortField', '2')
  url.searchParams.set('sortOrder', 'desc')
  const loaderType = curseForgeLoaderType(params.loader)
  if (params.kind === 'mod' && loaderType !== undefined) {
    url.searchParams.set('modLoaderType', String(loaderType))
  }

  const response = await fetchJson<CurseForgeSearchResponse>(url.toString(), {
    headers: { 'x-api-key': apiKey }
  })
  return (response.data ?? []).map((mod) => ({
    id: String(mod.id),
    source: 'curseforge',
    slug: mod.slug,
    name: mod.name,
    summary: mod.summary,
    author: mod.authors?.map((author) => author.name).join(', ') ?? t('Неизвестно'),
    downloads: mod.downloadCount,
    iconUrl: mod.logo?.thumbnailUrl,
    categories: (mod.categories ?? []).map((category) => category.name).slice(0, 6),
    kind: params.kind
  }))
}

async function projectFileNames(
  serverId: string,
  kind: ModKind,
  source: 'modrinth' | 'curseforge',
  projectId: string
): Promise<string[]> {
  const metadata = await readModMetadata(serverId)
  return metadata
    .filter(
      (entry) =>
        entry.kind === kind && entry.source === source && entry.projectId === projectId
    )
    .map((entry) => entry.filename)
}

/** После смены версии старый .jar (включая .disabled) больше не нужен. */
async function removeReplacedProjectFiles(
  serverId: string,
  kind: ModKind,
  filenames: string[],
  keepFilename: string
): Promise<void> {
  const dir = modsFolder(serverId, kind)
  for (const filename of filenames) {
    if (filename.toLowerCase() === keepFilename.toLowerCase()) continue
    for (const candidate of [
      filename,
      `${filename}.disabled`,
      `${filename}.deactivated`
    ]) {
      await fs.promises.rm(path.join(dir, candidate), { force: true })
    }
  }
}

export async function installMod(input: ModInstallInput): Promise<InstalledMod> {
  const previousFiles = input.versionId
    ? await projectFileNames(input.serverId, input.kind, input.source, input.projectId)
    : []

  const resolved =
    input.source === 'modrinth'
      ? input.versionId
        ? await resolveModrinthVersionFile(input.projectId, input.versionId)
        : await resolveModrinthFile(
            input.loader,
            input.kind,
            input.gameVersion,
            input.projectId,
            input.name
          )
      : input.versionId
        ? await resolveCurseForgeVersionFile(input.projectId, input.versionId)
        : await resolveCurseForgeFile(
            input.loader,
            input.kind,
            input.gameVersion,
            input.projectId
          )

  const installed = await downloadMod(
    resolved.url,
    resolved.filename,
    input.kind,
    input.serverId,
    {
      source: input.source,
      projectId: input.projectId,
      versionId: resolved.versionId,
      version: resolved.version,
      name: input.name
    }
  )

  if (previousFiles.length) {
    await removeReplacedProjectFiles(
      input.serverId,
      input.kind,
      previousFiles,
      installed.filename
    )
  }

  return installed
}

export async function checkModUpdates(serverId: string): Promise<ModUpdateStatus[]> {
  const instance = await readInstance(serverId)
  const metadata = await readModMetadata(serverId)

  const checks = metadata
    .filter((entry) => entry.source !== 'manual' && Boolean(entry.projectId))
    .map(async (entry): Promise<ModUpdateStatus | null> => {
      const dir = modsFolder(serverId, entry.kind)
      const candidates = [
        entry.filename,
        `${entry.filename}.disabled`,
        `${entry.filename}.deactivated`
      ]
      let actual: string | undefined
      for (const candidate of candidates) {
        try {
          await fs.promises.access(path.join(dir, candidate))
          actual = candidate
          break
        } catch {
          // try next variant
        }
      }
      if (!actual) return null

      const base = {
        filename: actual,
        kind: entry.kind,
        name: entry.name,
        currentVersion: entry.version
      }

      try {
        const resolved =
          entry.source === 'curseforge'
            ? await resolveCurseForgeFile(
                instance.loader,
                entry.kind,
                instance.mcVersion,
                entry.projectId as string
              )
            : await resolveModrinthFile(
                instance.loader,
                entry.kind,
                instance.mcVersion,
                entry.projectId as string,
                entry.name || entry.filename
              )
        const updateAvailable = entry.versionId
          ? resolved.versionId !== entry.versionId
          : resolved.version !== entry.version
        return {
          ...base,
          latestVersion: resolved.version,
          updateAvailable
        }
      } catch (error) {
        return {
          ...base,
          updateAvailable: false,
          error: (error as Error).message
        }
      }
    })

  const results = await Promise.all(checks)
  return results.filter((entry): entry is ModUpdateStatus => entry !== null)
}

export async function updateMod(
  serverId: string,
  filename: string,
  kind: ModKind
): Promise<InstalledMod> {
  const instance = await readInstance(serverId)
  const base = baseModFilename(filename)
  const metadata = await readModMetadata(serverId)
  const entry = metadata.find(
    (candidate) =>
      candidate.kind === kind && candidate.filename.toLowerCase() === base.toLowerCase()
  )
  if (!entry?.projectId || entry.source === 'manual') {
    throw new Error(
      t('NO_SOURCE:Для этого файла нет данных об источнике — обновите его вручную')
    )
  }

  const resolved =
    entry.source === 'curseforge'
      ? await resolveCurseForgeFile(
          instance.loader,
          kind,
          instance.mcVersion,
          entry.projectId
        )
      : await resolveModrinthFile(
          instance.loader,
          kind,
          instance.mcVersion,
          entry.projectId,
          entry.name || entry.filename
        )

  const updated = await downloadMod(resolved.url, resolved.filename, kind, serverId, {
    source: entry.source,
    projectId: entry.projectId,
    versionId: resolved.versionId,
    version: resolved.version,
    name: entry.name
  })

  if (filename.toLowerCase() !== updated.filename.toLowerCase()) {
    await fs.promises
      .rm(path.join(modsFolder(serverId, kind), filename), { force: true })
      .catch(() => undefined)
  }

  return updated
}

export { MODRINTH_API, CURSEFORGE_API }
