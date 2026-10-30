import { translate, type Language } from './i18n'

export type LoaderType =
  | 'vanilla'
  | 'paper'
  | 'purpur'
  | 'folia'
  | 'spigot'
  | 'craftbukkit'
  | 'pufferfish'
  | 'canvas'
  | 'fabric'
  | 'forge'
  | 'neoforge'
  | 'arclight'
  | 'mohist'
  | 'banner'
  | 'youer'
  | 'magma'
  | 'sponge-vanilla'
  | 'sponge-forge'
  | 'velocity'
  | 'bungeecord'
  | 'waterfall'

export type LoaderFamily = 'server' | 'proxy'
export type LoaderGroup = 'vanilla' | 'plugins' | 'mods' | 'hybrid' | 'proxy'

export type ServerStatus = 'stopped' | 'starting' | 'running' | 'stopping' | 'crashed'
export type ModSource = 'modrinth' | 'curseforge'
export type ModOrigin = ModSource | 'manual'
export type ModKind = 'mod' | 'plugin'
export type ProgressScope = 'install' | 'java' | 'mod' | 'download'

export interface LaunchSpec {
  type: 'jar' | 'argsfile'
  /** Path relative to the server directory. */
  target: string
}

export interface ServerInstance {
  id: string
  name: string
  loader: LoaderType
  mcVersion: string
  loaderVersion?: string
  createdAt: number
  updatedAt: number
  javaPath?: string
  javaMajor?: number
  memoryMinMb: number
  memoryMaxMb: number
  port: number
  launch: LaunchSpec
  notes?: string
  eulaAccepted: boolean
  /** Значение online-mode из server.properties (для прокси не используется). */
  onlineMode?: boolean
}

export interface CreateServerInput {
  name: string
  loader: LoaderType
  mcVersion: string
  loaderVersion?: string
  port?: number
  memoryMinMb?: number
  memoryMaxMb?: number
  javaPath?: string
  /** false — сервер для пиратских клиентов (online-mode=false). */
  onlineMode?: boolean
}

export type ServerUpdate = Partial<
  Pick<
    ServerInstance,
    'name' | 'javaPath' | 'memoryMinMb' | 'memoryMaxMb' | 'port' | 'notes' | 'onlineMode'
  >
>

export interface VersionInfo {
  id: string
  type: 'release' | 'snapshot' | 'old' | 'unknown'
  releaseTime?: string
  label?: string
}

export interface JavaRuntime {
  path: string
  major: number
  version: string
  vendor: string
  source: 'system' | 'downloaded'
  label: string
}

export type ReleaseChannel = 'release' | 'beta' | 'alpha'

export interface AppSettings {
  curseforgeApiKey: string
  defaultMemoryMb: number
  defaultJavaPath: string
  autoDownloadJava: boolean
  /** Язык интерфейса. Первый запуск определяется по локали системы. */
  language: Language
  /** Включённые каналы обновлений для модов/плагинов. По умолчанию только релизы. */
  releaseChannels: ReleaseChannel[]
  /** online-mode по умолчанию для новых серверов. true = лицензия, false = пиратский. */
  defaultOnlineMode: boolean
}

export interface LauncherPaths {
  root: string
  servers: string
  runtimes: string
  versions: string
  cache: string
  logs: string
}

export interface AppInfo {
  name: string
  version: string
  platform: string
  arch: string
  root: string
  electron: string
  node: string
  /** Общий объём оперативной памяти устройства, МБ. */
  memoryTotalMb: number
  /** Рекомендуемый объём памяти для новых серверов (25% ОЗУ), МБ. */
  memoryRecommendedMb: number
  /** Максимум для ползунка памяти: 7/8 ОЗУ (1/8 остаётся системе), МБ. */
  memoryLimitMb: number
}

export interface ServerStatusInfo {
  id: string
  status: ServerStatus
  pid?: number
  startedAt?: number
  exitCode?: number | null
  error?: string
}

export interface ServerOutputEvent {
  serverId: string
  data: string
  stream: 'stdout' | 'stderr' | 'system'
}

export interface MetricsSnapshot {
  serverId: string
  pid: number
  cpuPercent: number
  rssMb: number
  allocatedMb: number
  uptimeMs: number
  timestamp: number
}

export interface ProgressEvent {
  scope: ProgressScope
  message: string
  percent?: number
  serverId?: string
}

export interface PropertyEntry {
  key: string
  value: string
}

export interface ModSearchParams {
  source: ModSource
  query: string
  gameVersion: string
  loader: LoaderType
  kind: ModKind
  releaseChannels: ReleaseChannel[]
}

export interface ModSearchResult {
  id: string
  source: ModSource
  slug: string
  name: string
  summary: string
  author: string
  downloads: number
  iconUrl?: string
  categories: string[]
  kind: ModKind
}

export interface ModInstallInput {
  serverId: string
  source: ModSource
  projectId: string
  name: string
  gameVersion: string
  loader: LoaderType
  kind: ModKind
  /** Конкретная версия файла; без него ставится самый свежий совместимый. */
  versionId?: string
}

export interface ModVersionsInput {
  source: ModSource
  projectId: string
  gameVersion: string
  loader: LoaderType
  kind: ModKind
  releaseChannels: ReleaseChannel[]
}

/** Версия файла мода или плагина в каталоге Modrinth/CurseForge. */
export interface ModVersionInfo {
  id: string
  /** Человекочитаемый номер версии, например `1.20.1-v4.1`. */
  name: string
  fileName: string
  fileSize?: number
  /** ISO-дата публикации. */
  publishedAt?: string
  gameVersions: string[]
  loaders: string[]
  /** Совместима ли с текущими Minecraft и ядром сервера. */
  compatible: boolean
  /** Автор разрешил стороннее скачивание. */
  downloadable: boolean
}

export interface InstalledMod {
  /** Имя файла на диске (у отключённых заканчивается на .disabled). */
  filename: string
  size: number
  installedAt: number
  kind: ModKind
  enabled: boolean
  source: ModOrigin
  projectId?: string
  versionId?: string
  version?: string
  name?: string
}

/** Метаданные установленного файла, сохраняются в craftpulse.mods.json. */
export interface InstalledModMetadata {
  filename: string
  kind: ModKind
  source: ModOrigin
  projectId?: string
  versionId?: string
  version?: string
  name?: string
  installedAt: number
}

export interface ModUpdateStatus {
  /** Фактическое имя файла на диске. */
  filename: string
  kind: ModKind
  name?: string
  currentVersion?: string
  latestVersion?: string
  updateAvailable: boolean
  error?: string
}

export interface LoaderMeta {
  id: LoaderType
  name: string
  description: string
  accent: string
  supportsMods: boolean
  supportsPlugins: boolean
  /** Number of loader builds selectable in the wizard. */
  hasBuilds: boolean
  family: LoaderFamily
  group: LoaderGroup
}

export const LOADERS: LoaderMeta[] = [
  {
    id: 'vanilla',
    name: 'Vanilla',
    description: 'Официальное серверное ядро Mojang. Максимальная совместимость.',
    accent: '#a3a3a3',
    supportsMods: false,
    supportsPlugins: false,
    hasBuilds: false,
    family: 'server',
    group: 'vanilla'
  },
  {
    id: 'paper',
    name: 'Paper',
    description: 'Высокопроизводительный форк Spigot с поддержкой плагинов.',
    accent: '#4ade80',
    supportsMods: false,
    supportsPlugins: true,
    hasBuilds: true,
    family: 'server',
    group: 'plugins'
  },
  {
    id: 'purpur',
    name: 'Purpur',
    description: 'Форк Paper с расширенными настройками и оптимизациями.',
    accent: '#c084fc',
    supportsMods: false,
    supportsPlugins: true,
    hasBuilds: true,
    family: 'server',
    group: 'plugins'
  },
  {
    id: 'folia',
    name: 'Folia',
    description: 'Многопоточный форк Paper для больших серверов с плагинами.',
    accent: '#22d3ee',
    supportsMods: false,
    supportsPlugins: true,
    hasBuilds: true,
    family: 'server',
    group: 'plugins'
  },
  {
    id: 'spigot',
    name: 'Spigot',
    description: 'Классический форк Bukkit с плагинами и стабильными сборками.',
    accent: '#f5b21a',
    supportsMods: false,
    supportsPlugins: true,
    hasBuilds: false,
    family: 'server',
    group: 'plugins'
  },
  {
    id: 'craftbukkit',
    name: 'CraftBukkit',
    description: 'Оригинальное Bukkit-ядро для классических плагинов.',
    accent: '#a16207',
    supportsMods: false,
    supportsPlugins: true,
    hasBuilds: false,
    family: 'server',
    group: 'plugins'
  },
  {
    id: 'pufferfish',
    name: 'Pufferfish',
    description: 'Высокопроизводительный форк Paper с оптимизациями для крупных серверов.',
    accent: '#2dd4bf',
    supportsMods: false,
    supportsPlugins: true,
    hasBuilds: true,
    family: 'server',
    group: 'plugins'
  },
  {
    id: 'canvas',
    name: 'Canvas',
    description: 'Форк Folia с исправлениями region-потоков и оптимизациями (Java 25).',
    accent: '#a3e635',
    supportsMods: false,
    supportsPlugins: true,
    hasBuilds: true,
    family: 'server',
    group: 'plugins'
  },
  {
    id: 'fabric',
    name: 'Fabric',
    description: 'Лёгкий загрузчик модов с быстрым обновлением под новые версии.',
    accent: '#38bdf8',
    supportsMods: true,
    supportsPlugins: false,
    hasBuilds: true,
    family: 'server',
    group: 'mods'
  },
  {
    id: 'forge',
    name: 'Forge',
    description: 'Классический загрузчик модов с крупнейшей экосистемой.',
    accent: '#c2531a',
    supportsMods: true,
    supportsPlugins: false,
    hasBuilds: true,
    family: 'server',
    group: 'mods'
  },
  {
    id: 'neoforge',
    name: 'NeoForge',
    description: 'Современный форк Forge для Minecraft 1.20.2 и новее.',
    accent: '#f97316',
    supportsMods: true,
    supportsPlugins: false,
    hasBuilds: true,
    family: 'server',
    group: 'mods'
  },
  {
    id: 'arclight',
    name: 'ArcLight',
    description: 'Forge + Bukkit API: моды и плагины на одном сервере.',
    accent: '#facc15',
    supportsMods: true,
    supportsPlugins: true,
    hasBuilds: false,
    family: 'server',
    group: 'hybrid'
  },
  {
    id: 'mohist',
    name: 'Mohist',
    description: 'Forge + Bukkit: популярный гибрид для модов и плагинов.',
    accent: '#f87171',
    supportsMods: true,
    supportsPlugins: true,
    hasBuilds: true,
    family: 'server',
    group: 'hybrid'
  },
  {
    id: 'banner',
    name: 'Banner',
    description: 'Fabric + Bukkit от MohistMC: моды Fabric и плагины.',
    accent: '#fbbf24',
    supportsMods: true,
    supportsPlugins: true,
    hasBuilds: true,
    family: 'server',
    group: 'hybrid'
  },
  {
    id: 'youer',
    name: 'Youer',
    description: 'NeoForge + Paper/Purpur API от MohistMC: моды и плагины вместе.',
    accent: '#34d399',
    supportsMods: true,
    supportsPlugins: true,
    hasBuilds: true,
    family: 'server',
    group: 'hybrid'
  },
  {
    id: 'magma',
    name: 'Magma',
    description: 'Forge + Bukkit для 1.12.2 и 1.21.1. Гибридный сервер.',
    accent: '#ef4444',
    supportsMods: true,
    supportsPlugins: true,
    hasBuilds: false,
    family: 'server',
    group: 'hybrid'
  },
  {
    id: 'sponge-vanilla',
    name: 'SpongeVanilla',
    description: 'Sponge API поверх Vanilla: плагины без модов.',
    accent: '#ffd60a',
    supportsMods: false,
    supportsPlugins: true,
    hasBuilds: true,
    family: 'server',
    group: 'plugins'
  },
  {
    id: 'sponge-forge',
    name: 'SpongeForge',
    description: 'Sponge API поверх Forge: плагины вместе с модами.',
    accent: '#eab308',
    supportsMods: true,
    supportsPlugins: true,
    hasBuilds: true,
    family: 'server',
    group: 'hybrid'
  },
  {
    id: 'velocity',
    name: 'Velocity',
    description: 'Современный высокопроизводительный прокси для сети серверов.',
    accent: '#3b82f6',
    supportsMods: false,
    supportsPlugins: true,
    hasBuilds: true,
    family: 'proxy',
    group: 'proxy'
  },
  {
    id: 'bungeecord',
    name: 'BungeeCord',
    description: 'Классический прокси SpigotMC. Последняя сборка с CI.',
    accent: '#f59e0b',
    supportsMods: false,
    supportsPlugins: true,
    hasBuilds: false,
    family: 'proxy',
    group: 'proxy'
  },
  {
    id: 'waterfall',
    name: 'Waterfall',
    description: 'Форк BungeeCord от PaperMC. Поддержка завершена (EOL).',
    accent: '#93c5fd',
    supportsMods: false,
    supportsPlugins: true,
    hasBuilds: true,
    family: 'proxy',
    group: 'proxy'
  }
]

export const LOADER_GROUP_LABELS: Record<LoaderGroup, string> = {
  vanilla: 'Базовые',
  plugins: 'Плагины',
  mods: 'Моды',
  hybrid: 'Гибриды · моды + плагины',
  proxy: 'Прокси'
}

export function loaderMeta(loader: LoaderType): LoaderMeta | undefined {
  return LOADERS.find((entry) => entry.id === loader)
}

export function loaderDescription(loader: LoaderType, language: Language): string {
  const meta = loaderMeta(loader)
  return meta ? translate(language, meta.description) : ''
}

export function loaderGroupLabel(group: LoaderGroup, language: Language): string {
  return translate(language, LOADER_GROUP_LABELS[group])
}

export function serverStatusLabel(status: ServerStatus, language: Language): string {
  return translate(language, SERVER_STATUS_LABELS[status])
}

export function isProxyLoader(loader: LoaderType): boolean {
  return loaderMeta(loader)?.family === 'proxy'
}

export function loaderSupportsMods(loader: LoaderType): boolean {
  return loaderMeta(loader)?.supportsMods ?? false
}

export function loaderSupportsPlugins(loader: LoaderType): boolean {
  return loaderMeta(loader)?.supportsPlugins ?? false
}

/** Как называть контент и вкладки для конкретного ядра. */
export type ModTabMode = 'plugins' | 'mods' | 'hybrid' | 'hidden'

export interface ModVocabulary {
  mode: ModTabMode
  /** Вкладка каталога поиска. */
  catalogTab: string
  /** Вкладка уже скачанных файлов. */
  installedTab: string
  /** Заголовок каталога. */
  catalogTitle: string
  /** Заголовок списка установленного. */
  installedTitle: string
  /** Одна единица контента: «плагин», «мод», «дополнение». */
  noun: string
  /** Множественное число: «плагины», «моды», «дополнения». */
  nounPlural: string
  /** Папки, в которых лежит контент. */
  foldersLabel: string
}

export function modTabMode(loader: LoaderType): ModTabMode {
  const meta = loaderMeta(loader)
  if (!meta || meta.group === 'vanilla' || meta.group === 'proxy') return 'hidden'
  // Sponge считается гибридным семейством: API плагинов поверх Vanilla/Forge.
  if (loader === 'sponge-vanilla') return 'hybrid'
  if (meta.group === 'plugins') return 'plugins'
  if (meta.group === 'mods') return 'mods'
  return 'hybrid'
}

export function modVocabulary(loader: LoaderType, language: Language = 'ru'): ModVocabulary {
  const mode = modTabMode(loader)
  const tr = (text: string): string => translate(language, text)
  if (mode === 'plugins') {
    return {
      mode,
      catalogTab: tr('Плагины'),
      installedTab: tr('Установленные плагины'),
      catalogTitle: tr('Каталог плагинов'),
      installedTitle: tr('Установленные плагины'),
      noun: tr('плагин'),
      nounPlural: tr('плагины'),
      foldersLabel: 'plugins/'
    }
  }
  if (mode === 'mods') {
    return {
      mode,
      catalogTab: tr('Моды'),
      installedTab: tr('Установленные моды'),
      catalogTitle: tr('Каталог модов'),
      installedTitle: tr('Установленные моды'),
      noun: tr('мод'),
      nounPlural: tr('моды'),
      foldersLabel: 'mods/'
    }
  }
  if (mode === 'hybrid') {
    return {
      mode,
      catalogTab: tr('Дополнения'),
      installedTab: tr('Установленное'),
      catalogTitle: tr('Каталог дополнений'),
      installedTitle: tr('Установленное'),
      noun: tr('дополнение'),
      nounPlural: tr('дополнения'),
      foldersLabel: tr('mods/ и plugins/')
    }
  }
  return {
    mode,
    catalogTab: tr('Моды и плагины'),
    installedTab: tr('Установленное'),
    catalogTitle: tr('Каталог модов и плагинов'),
    installedTitle: tr('Установленное'),
    noun: tr('файл'),
    nounPlural: tr('файлы'),
    foldersLabel: tr('mods/ и plugins/')
  }
}


export const LOADER_LABELS: Record<LoaderType, string> = LOADERS.reduce(
  (acc, loader) => {
    acc[loader.id] = loader.name
    return acc
  },
  {} as Record<LoaderType, string>
)

export const SERVER_STATUS_LABELS: Record<ServerStatus, string> = {
  stopped: 'Остановлен',
  starting: 'Запускается',
  running: 'Работает',
  stopping: 'Останавливается',
  crashed: 'Упал'
}
