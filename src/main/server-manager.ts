import fs from 'node:fs'
import path from 'node:path'
import type {
  CreateServerInput,
  InstalledMod,
  InstalledModMetadata,
  ModKind,
  PropertyEntry,
  ServerInstance,
  ServerUpdate
} from '@shared/types'
import { isProxyLoader, loaderSupportsMods, loaderSupportsPlugins } from '@shared/types'
import { ensurePaths, isValidServerId, PATHS, serverDir } from './paths'
import { clampMemory, getSettings, recommendedMemoryMb } from './store'
import { t } from './i18n'
import { defaultProperties, mergeProperties, parseProperties, propertiesToRecord } from './properties'
import { detectJava, resolveJava } from './java'
import { installLoader } from './installers'

const INSTANCE_FILE = 'craftpulse.json'
const LEGACY_INSTANCE_FILES = ['craftdeck.json']
const PROPERTIES_FILE = 'server.properties'
const MODS_META_FILE = 'craftpulse.mods.json'
const LEGACY_MODS_META_FILES = ['craftdeck.mods.json']

export type CreateProgress = (message: string, percent?: number) => void

async function pathExists(target: string): Promise<boolean> {
  try {
    await fs.promises.access(target)
    return true
  } catch {
    return false
  }
}

function normalizeInstance(instance: ServerInstance): ServerInstance {
  const memoryMinMb = clampMemory(instance.memoryMinMb || 1024)
  const memoryMaxMb = clampMemory(
    instance.memoryMaxMb || Math.max(memoryMinMb, recommendedMemoryMb())
  )
  return {
    ...instance,
    memoryMinMb,
    memoryMaxMb: Math.max(memoryMinMb, memoryMaxMb),
    port: Number.isFinite(instance.port) ? instance.port : 25565,
    launch: instance.launch ?? { type: 'jar', target: 'server.jar' }
  }
}

export async function isEulaAccepted(id: string): Promise<boolean> {
  try {
    const text = await fs.promises.readFile(path.join(serverDir(id), 'eula.txt'), 'utf8')
    return /^\s*eula\s*=\s*true\s*$/im.test(text)
  } catch {
    return false
  }
}

async function readOnlineMode(id: string): Promise<boolean | undefined> {
  try {
    const text = await fs.promises.readFile(path.join(serverDir(id), PROPERTIES_FILE), 'utf8')
    const entry = parseProperties(text).find((property) => property.key === 'online-mode')
    if (!entry) return undefined
    return entry.value.trim().toLowerCase() === 'true'
  } catch {
    return undefined
  }
}

async function writeInstance(instance: ServerInstance): Promise<void> {
  const dir = serverDir(instance.id)
  await fs.promises.mkdir(dir, { recursive: true })
  await fs.promises.writeFile(
    path.join(dir, INSTANCE_FILE),
    JSON.stringify(instance, null, 2),
    'utf8'
  )
}

export async function readInstance(id: string): Promise<ServerInstance> {
  const dir = serverDir(id)
  let raw: string | null = null
  for (const candidate of [INSTANCE_FILE, ...LEGACY_INSTANCE_FILES]) {
    try {
      raw = await fs.promises.readFile(path.join(dir, candidate), 'utf8')
      break
    } catch {
      // пробуем следующее имя файла (совместимость с CraftDeck)
    }
  }
  if (!raw) throw new Error(t('Файл конфигурации сервера не найден: {id}', { id }))
  const parsed = JSON.parse(raw) as ServerInstance
  if (!parsed || parsed.id !== id) {
    throw new Error(t('Повреждённый файл конфигурации сервера: {id}', { id }))
  }
  const instance = normalizeInstance(parsed)
  if (isProxyLoader(instance.loader)) {
    instance.eulaAccepted = true
    instance.onlineMode = undefined
  } else {
    instance.eulaAccepted = await isEulaAccepted(id)
    const onlineMode = await readOnlineMode(id)
    if (onlineMode !== undefined) instance.onlineMode = onlineMode
  }
  return instance
}

export async function listServers(): Promise<ServerInstance[]> {
  await ensurePaths()
  const entries = await fs.promises.readdir(PATHS.servers, { withFileTypes: true })
  const instances: ServerInstance[] = []
  for (const entry of entries) {
    if (!entry.isDirectory() || !isValidServerId(entry.name)) continue
    try {
      instances.push(await readInstance(entry.name))
    } catch (error) {
      console.warn(`[servers] skipped ${entry.name}:`, (error as Error).message)
    }
  }
  return instances.sort((a, b) => b.createdAt - a.createdAt)
}

export function instancePath(id: string): string {
  return serverDir(id)
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

async function uniqueServerId(name: string): Promise<string> {
  const base = slugify(name) || `server-${Date.now().toString(36)}`
  let candidate = base
  let counter = 2
  while (await pathExists(serverDir(candidate))) {
    candidate = `${base}-${counter}`
    counter += 1
    if (counter > 999) throw new Error(t('Не удалось создать уникальный идентификатор сервера'))
  }
  return candidate
}

async function pickPort(instances: ServerInstance[]): Promise<number> {
  const used = new Set(instances.map((instance) => instance.port))
  for (let port = 25565; port < 25665; port += 1) {
    if (!used.has(port)) return port
  }
  return 25565
}

export async function createServer(
  input: CreateServerInput,
  progress: CreateProgress = () => undefined
): Promise<ServerInstance> {
  const name = input.name?.trim()
  if (!name) throw new Error(t('Укажите название сервера'))
  if (name.length > 64) throw new Error(t('Название сервера не должно превышать 64 символа'))
  if (!input.mcVersion) throw new Error(t('Выберите версию Minecraft'))
  if (
    input.loader === 'bungeecord'
      ? input.mcVersion !== 'latest'
      : !/^(?:\d+\.\d+(?:\.\d+)?(?:[-+][\w.-]+)?|\d{2}w\d{2}[a-z])$/.test(input.mcVersion)
  ) {
    throw new Error(t('Некорректная версия Minecraft'))
  }
  const proxy = isProxyLoader(input.loader)

  const settings = getSettings()
  const existing = await listServers()
  const port = input.port ?? (await pickPort(existing))
  if (existing.some((instance) => instance.port === port)) {
    throw new Error(
      t('PORT_IN_USE:Порт {port} уже занят другим сервером CraftPulse', { port })
    )
  }
  if (!Number.isFinite(port) || port < 1 || port > 65535) {
    throw new Error(t('Порт должен быть в диапазоне 1–65535'))
  }

  progress(t('Определение подходящей версии Java…'), 0)
  const javaRuntime = await resolveJava(input.loader, input.mcVersion, input.javaPath, progress)

  const id = await uniqueServerId(name)
  const dir = serverDir(id)
  await fs.promises.mkdir(dir, { recursive: true })
  const contentFolders: string[] = []
  if (loaderSupportsMods(input.loader)) contentFolders.push('mods')
  if (loaderSupportsPlugins(input.loader)) contentFolders.push('plugins')
  if (!contentFolders.length) contentFolders.push('mods')
  for (const folder of contentFolders) {
    await fs.promises.mkdir(path.join(dir, folder), { recursive: true })
  }

  const onlineMode = input.onlineMode !== false

  const memoryMinMb = clampMemory(input.memoryMinMb ?? 1024)
  const memoryMaxMb = Math.max(
    memoryMinMb,
    clampMemory(input.memoryMaxMb ?? settings.defaultMemoryMb)
  )

  const now = Date.now()
  const instance: ServerInstance = {
    id,
    name,
    loader: input.loader,
    mcVersion: input.mcVersion,
    loaderVersion: input.loaderVersion,
    createdAt: now,
    updatedAt: now,
    javaPath: javaRuntime.path,
    javaMajor: javaRuntime.major,
    memoryMinMb,
    memoryMaxMb,
    port,
    launch: { type: 'jar', target: 'server.jar' },
    eulaAccepted: false,
    onlineMode: proxy ? undefined : onlineMode
  }

  await writeInstance(instance)
  if (!proxy) {
    const propertiesFile = path.join(dir, PROPERTIES_FILE)
    if (!(await pathExists(propertiesFile))) {
      await fs.promises.writeFile(propertiesFile, defaultProperties(port, onlineMode), 'utf8')
    }
  }

  try {
    const result = await installLoader({
      loader: input.loader,
      mcVersion: input.mcVersion,
      loaderVersion: input.loaderVersion,
      dir,
      javaPath: javaRuntime.path,
      progress
    })
    instance.launch = result.launch
    instance.loaderVersion = result.loaderVersion
    instance.updatedAt = Date.now()
    await writeInstance(instance)
  } catch (error) {
    await fs.promises.rm(dir, { recursive: true, force: true }).catch(() => undefined)
    throw error
  }

  progress(t('Сервер готов к запуску'), 100)
  return readInstance(id)
}

export async function updateServer(id: string, patch: ServerUpdate): Promise<ServerInstance> {
  const instance = await readInstance(id)
  const next: ServerInstance = { ...instance }

  if (patch.name !== undefined) {
    const name = patch.name.trim()
    if (!name) throw new Error(t('Название сервера не может быть пустым'))
    if (name.length > 64) throw new Error(t('Название сервера не должно превышать 64 символа'))
    next.name = name
  }
  if (patch.memoryMinMb !== undefined) next.memoryMinMb = clampMemory(patch.memoryMinMb)
  if (patch.memoryMaxMb !== undefined) next.memoryMaxMb = clampMemory(patch.memoryMaxMb)
  if (next.memoryMinMb > next.memoryMaxMb) {
    throw new Error(t('Минимальный объём памяти не может превышать максимальный'))
  }
  if (patch.port !== undefined) {
    if (!Number.isFinite(patch.port) || patch.port < 1 || patch.port > 65535) {
      throw new Error(t('Порт должен быть в диапазоне 1–65535'))
    }
    const others = (await listServers()).filter((server) => server.id !== id)
    if (others.some((server) => server.port === patch.port)) {
      throw new Error(t('PORT_IN_USE:Порт {port} уже занят другим сервером', { port: patch.port }))
    }
    if (patch.port !== instance.port) {
      next.port = patch.port
      if (!isProxyLoader(instance.loader)) {
        const props = await readProperties(id)
        await writeProperties(id, { ...propertiesToRecord(props), 'server-port': String(patch.port) })
      }
    }
  }
  if (patch.notes !== undefined) next.notes = patch.notes.slice(0, 2000)
  if (patch.onlineMode !== undefined) {
    if (!isProxyLoader(instance.loader)) {
      await writeProperties(id, { 'online-mode': patch.onlineMode ? 'true' : 'false' })
      next.onlineMode = patch.onlineMode
    }
  }
  if (patch.javaPath !== undefined) {
    next.javaPath = patch.javaPath || undefined
    next.javaMajor = undefined
    if (next.javaPath) {
      const runtime = (await detectJava(true)).find(
        (candidate) => path.resolve(candidate.path) === path.resolve(next.javaPath as string)
      )
      if (runtime) next.javaMajor = runtime.major
    }
  }

  next.updatedAt = Date.now()
  await writeInstance(next)
  return readInstance(id)
}

export async function deleteServerFiles(id: string): Promise<void> {
  await fs.promises.rm(serverDir(id), { recursive: true, force: true })
}

export async function acceptEula(id: string): Promise<void> {
  const dir = serverDir(id)
  await fs.promises.mkdir(dir, { recursive: true })
  await fs.promises.writeFile(
    path.join(dir, 'eula.txt'),
    `#By changing the setting below to TRUE you are indicating your agreement to our EULA (https://aka.ms/MinecraftEULA).\neula=true\n`,
    'utf8'
  )
}

export async function readProperties(id: string): Promise<PropertyEntry[]> {
  const instance = await readInstance(id)
  if (isProxyLoader(instance.loader)) return []
  const file = path.join(serverDir(id), PROPERTIES_FILE)
  try {
    const text = await fs.promises.readFile(file, 'utf8')
    return parseProperties(text)
  } catch {
    return parseProperties(defaultProperties(instance.port, instance.onlineMode ?? true))
  }
}

export async function writeProperties(
  id: string,
  values: Record<string, string>
): Promise<PropertyEntry[]> {
  const instance = await readInstance(id)
  if (isProxyLoader(instance.loader)) {
    throw new Error(t('Прокси не использует server.properties'))
  }
  const file = path.join(serverDir(id), PROPERTIES_FILE)
  let current = ''
  try {
    current = await fs.promises.readFile(file, 'utf8')
  } catch {
    current = defaultProperties(instance.port, instance.onlineMode ?? true)
  }
  const merged = mergeProperties(current, values)
  await fs.promises.writeFile(file, merged, 'utf8')
  return parseProperties(merged)
}

export function modsFolder(id: string, kind: ModKind): string {
  return path.join(serverDir(id), kind === 'plugin' ? 'plugins' : 'mods')
}

export async function ensureModsFolder(id: string, kind: ModKind): Promise<string> {
  const dir = modsFolder(id, kind)
  await fs.promises.mkdir(dir, { recursive: true })
  return dir
}

/** Отключённые файлы получают суффикс .disabled или .deactivated. */
export function baseModFilename(filename: string): string {
  return filename.replace(/\.(disabled|deactivated)$/i, '')
}

function metaPath(id: string): string {
  return path.join(serverDir(id), MODS_META_FILE)
}

export async function readModMetadata(id: string): Promise<InstalledModMetadata[]> {
  for (const candidate of [MODS_META_FILE, ...LEGACY_MODS_META_FILES]) {
    try {
      const raw = await fs.promises.readFile(path.join(serverDir(id), candidate), 'utf8')
      const parsed = JSON.parse(raw) as
        | InstalledModMetadata[]
        | { entries?: InstalledModMetadata[] }
      const entries = Array.isArray(parsed) ? parsed : parsed?.entries
      if (!Array.isArray(entries)) return []
      const filtered = entries.filter(
        (entry) =>
          entry &&
          typeof entry.filename === 'string' &&
          (entry.kind === 'mod' || entry.kind === 'plugin')
      )
      if (candidate !== MODS_META_FILE) {
        // Переносим метаданные из старого craftdeck.mods.json в новый файл.
        await writeModMetadata(id, filtered).catch(() => undefined)
      }
      return filtered
    } catch {
      // пробуем следующее имя файла (совместимость с CraftDeck)
    }
  }
  return []
}

async function writeModMetadata(id: string, entries: InstalledModMetadata[]): Promise<void> {
  await fs.promises.mkdir(serverDir(id), { recursive: true })
  await fs.promises.writeFile(
    metaPath(id),
    JSON.stringify({ entries }, null, 2),
    'utf8'
  )
}

export async function recordModMetadata(
  id: string,
  metadata: InstalledModMetadata
): Promise<void> {
  const entries = await readModMetadata(id)
  const filtered = entries.filter(
    (entry) =>
      !(
        entry.kind === metadata.kind &&
        (entry.filename.toLowerCase() === metadata.filename.toLowerCase() ||
          (metadata.projectId &&
            entry.projectId === metadata.projectId &&
            entry.source === metadata.source))
      )
  )
  filtered.push(metadata)
  await writeModMetadata(id, filtered)
}

export async function forgetModMetadata(
  id: string,
  filename: string,
  kind: ModKind
): Promise<void> {
  const base = baseModFilename(filename).toLowerCase()
  const entries = (await readModMetadata(id)).filter(
    (entry) => !(entry.kind === kind && entry.filename.toLowerCase() === base)
  )
  await writeModMetadata(id, entries)
}

export async function installedMods(id: string): Promise<InstalledMod[]> {
  const result: InstalledMod[] = []
  const metadata = await readModMetadata(id)
  const byFile = new Map<string, InstalledModMetadata>()
  for (const entry of metadata) {
    byFile.set(`${entry.kind}:${entry.filename.toLowerCase()}`, entry)
  }

  const kinds: ModKind[] = ['mod', 'plugin']
  for (const kind of kinds) {
    const dir = modsFolder(id, kind)
    let entries: fs.Dirent[] = []
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      if (!entry.isFile() || entry.name.endsWith('.part')) continue
      const full = path.join(dir, entry.name)
      try {
        const stat = await fs.promises.stat(full)
        const disabled = /\.(disabled|deactivated)$/i.test(entry.name)
        const base = baseModFilename(entry.name)
        const meta = byFile.get(`${kind}:${base.toLowerCase()}`)
        result.push({
          filename: entry.name,
          size: stat.size,
          installedAt: stat.mtimeMs,
          kind,
          enabled: !disabled,
          source: meta?.source ?? 'manual',
          projectId: meta?.projectId,
          versionId: meta?.versionId,
          version: meta?.version,
          name: meta?.name
        })
      } catch {
        // ignore
      }
    }
  }
  return result.sort((a, b) => b.installedAt - a.installedAt)
}

export async function deleteModFile(id: string, filename: string, kind: ModKind): Promise<InstalledMod[]> {
  if (path.basename(filename) !== filename) throw new Error(t('Некорректное имя файла'))
  const dir = modsFolder(id, kind)
  const target = path.join(dir, filename)
  if (!target.startsWith(dir)) throw new Error(t('Некорректный путь к файлу мода'))
  await fs.promises.rm(target, { force: true })
  await forgetModMetadata(id, filename, kind)
  return installedMods(id)
}

export async function setModEnabled(
  id: string,
  filename: string,
  kind: ModKind,
  enabled: boolean
): Promise<InstalledMod[]> {
  if (path.basename(filename) !== filename) throw new Error(t('Некорректное имя файла'))
  const dir = modsFolder(id, kind)
  const base = baseModFilename(filename)
  const targetName = enabled ? base : `${base}.disabled`
  if (targetName === filename) return installedMods(id)

  const source = path.join(dir, filename)
  const target = path.join(dir, targetName)
  if (!source.startsWith(dir) || !target.startsWith(dir)) {
    throw new Error(t('Некорректный путь к файлу мода'))
  }
  if (!(await pathExists(source))) throw new Error(t('Файл {file} не найден', { file: filename }))
  if (await pathExists(target)) {
    throw new Error(
      enabled
        ? t('Файл {file} уже существует — удалите дубликат', { file: targetName })
        : t('Файл {file} уже существует', { file: targetName })
    )
  }
  await fs.promises.rename(source, target)
  return installedMods(id)
}

export async function ensureServerFolder(id: string, subfolder?: string): Promise<string> {
  const base = serverDir(id)
  if (!subfolder) return base
  const safeSub = subfolder.replace(/[^a-zA-Z0-9_-]/g, '')
  const dir = path.join(base, safeSub)
  await fs.promises.mkdir(dir, { recursive: true })
  return dir
}
