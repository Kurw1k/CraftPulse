import type {
  AppInfo,
  AppSettings,
  CreateServerInput,
  InstalledMod,
  JavaRuntime,
  LauncherPaths,
  LoaderType,
  MetricsSnapshot,
  ModInstallInput,
  ModKind,
  ModSearchParams,
  ModSearchResult,
  ModUpdateStatus,
  ModVersionInfo,
  ModVersionsInput,
  ProgressEvent,
  PropertyEntry,
  ServerInstance,
  ServerOutputEvent,
  ServerStatusInfo,
  ServerUpdate,
  VersionInfo
} from './types'

export interface LauncherApi {
  app: {
    paths(): Promise<LauncherPaths>
    info(): Promise<AppInfo>
    settings(): Promise<AppSettings>
    saveSettings(patch: Partial<AppSettings>): Promise<AppSettings>
    openPath(target: string): Promise<void>
    openExternal(url: string): Promise<void>
  }
  servers: {
    list(): Promise<ServerInstance[]>
    create(input: CreateServerInput): Promise<ServerInstance>
    update(id: string, patch: ServerUpdate): Promise<ServerInstance>
    remove(id: string): Promise<void>
    acceptEula(id: string): Promise<void>
    readProperties(id: string): Promise<PropertyEntry[]>
    writeProperties(id: string, values: Record<string, string>): Promise<PropertyEntry[]>
    installedMods(id: string): Promise<InstalledMod[]>
    deleteMod(id: string, filename: string, kind: ModKind): Promise<InstalledMod[]>
    setModEnabled(
      id: string,
      filename: string,
      kind: ModKind,
      enabled: boolean
    ): Promise<InstalledMod[]>
    openFolder(id: string, subfolder?: string): Promise<void>
  }
  versions: {
    minecraft(loader: LoaderType, refresh?: boolean): Promise<VersionInfo[]>
    loaderBuilds(loader: LoaderType, mcVersion: string): Promise<string[]>
    javaRequirement(loader: LoaderType, mcVersion: string): Promise<number>
  }
  java: {
    detect(): Promise<JavaRuntime[]>
    install(major: number): Promise<JavaRuntime>
  }
  process: {
    start(id: string): Promise<void>
    stop(id: string): Promise<void>
    kill(id: string): Promise<void>
    restart(id: string): Promise<void>
    command(id: string, command: string): Promise<void>
    statuses(): Promise<ServerStatusInfo[]>
  }
  mods: {
    search(params: ModSearchParams): Promise<ModSearchResult[]>
    versions(input: ModVersionsInput): Promise<ModVersionInfo[]>
    install(input: ModInstallInput): Promise<InstalledMod>
    checkUpdates(serverId: string): Promise<ModUpdateStatus[]>
    update(serverId: string, filename: string, kind: ModKind): Promise<InstalledMod>
  }
  events: {
    onServerOutput(cb: (event: ServerOutputEvent) => void): () => void
    onServerStatus(cb: (event: ServerStatusInfo) => void): () => void
    onMetrics(cb: (event: MetricsSnapshot) => void): () => void
    onProgress(cb: (event: ProgressEvent) => void): () => void
    onServersChanged(cb: () => void): () => void
  }
}

export type Unsubscribe = () => void
