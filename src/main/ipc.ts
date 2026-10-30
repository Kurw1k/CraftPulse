import { app, ipcMain, shell } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import type {
  AppSettings,
  CreateServerInput,
  ModInstallInput,
  ModKind,
  ModSearchParams,
  ModVersionsInput,
  ServerUpdate
} from '@shared/types'
import { isPathInside, PATHS } from './paths'
import { t } from './i18n'
import {
  getSettings,
  recommendedMemoryMb,
  saveSettings,
  systemMemoryLimitMb,
  totalMemoryMb
} from './store'
import {
  acceptEula,
  createServer,
  deleteModFile,
  deleteServerFiles,
  ensureServerFolder,
  installedMods,
  listServers,
  readProperties,
  setModEnabled,
  updateServer,
  writeProperties
} from './server-manager'
import { requiredJavaMajorForLoader } from './mojang'
import { listLoaderBuilds, listMinecraftVersions } from './versions'
import { detectJava, installJava } from './java'
import {
  forgetServer,
  getStatuses,
  killServer,
  restartServer,
  sendCommand,
  startServer,
  stopAndWait,
  stopServer
} from './process-manager'
import { checkModUpdates, installMod, listModVersions, searchMods, updateMod } from './mods'
import { broadcast } from './events'

function notifyServersChanged(): void {
  broadcast('servers:changed', null)
}

export function registerIpcHandlers(): void {
  ipcMain.handle('app:paths', () => PATHS)

  ipcMain.handle('app:info', () => ({
    name: 'CraftPulse',
    version: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
    root: PATHS.root,
    electron: process.versions.electron,
    node: process.versions.node,
    memoryTotalMb: totalMemoryMb(),
    memoryRecommendedMb: recommendedMemoryMb(),
    memoryLimitMb: systemMemoryLimitMb()
  }))

  ipcMain.handle('app:settings', () => getSettings())
  ipcMain.handle('app:save-settings', (_event, patch: Partial<AppSettings>) => saveSettings(patch))

  ipcMain.handle('app:open-path', async (_event, target: string) => {
    if (!isPathInside(PATHS.root, target) && !isPathInside(PATHS.cache, target)) {
      throw new Error(t('Недопустимый путь'))
    }
    if (!fs.existsSync(target)) throw new Error(t('Путь не существует'))
    const error = await shell.openPath(target)
    if (error) throw new Error(error)
  })

  ipcMain.handle('app:open-external', async (_event, url: string) => {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error(t('Разрешены только http(s)-ссылки'))
    }
    await shell.openExternal(url)
  })

  ipcMain.handle('servers:list', () => listServers())

  ipcMain.handle('servers:create', async (_event, input: CreateServerInput) => {
    const instance = await createServer(input, (message, percent) => {
      broadcast('progress', { scope: 'install', message, percent })
    })
    notifyServersChanged()
    return instance
  })

  ipcMain.handle('servers:update', async (_event, id: string, patch: ServerUpdate) => {
    const instance = await updateServer(id, patch)
    notifyServersChanged()
    return instance
  })

  ipcMain.handle('servers:remove', async (_event, id: string) => {
    await stopAndWait(id)
    await deleteServerFiles(id)
    forgetServer(id)
    notifyServersChanged()
  })

  ipcMain.handle('servers:accept-eula', async (_event, id: string) => {
    await acceptEula(id)
    notifyServersChanged()
  })

  ipcMain.handle('servers:read-properties', (_event, id: string) => readProperties(id))
  ipcMain.handle(
    'servers:write-properties',
    async (_event, id: string, values: Record<string, string>) => {
      const entries = await writeProperties(id, values)
      if (Object.prototype.hasOwnProperty.call(values, 'online-mode')) notifyServersChanged()
      return entries
    }
  )
  ipcMain.handle('servers:installed-mods', (_event, id: string) => installedMods(id))
  ipcMain.handle('servers:delete-mod', (_event, id: string, filename: string, kind: ModKind) =>
    deleteModFile(id, filename, kind)
  )
  ipcMain.handle(
    'servers:set-mod-enabled',
    (_event, id: string, filename: string, kind: ModKind, enabled: boolean) =>
      setModEnabled(id, filename, kind, enabled)
  )
  ipcMain.handle('servers:open-folder', async (_event, id: string, subfolder?: string) => {
    const folder = await ensureServerFolder(id, subfolder)
    const error = await shell.openPath(folder)
    if (error) throw new Error(error)
  })

  ipcMain.handle('versions:minecraft', (_event, loader, refresh?: boolean) =>
    listMinecraftVersions(loader, Boolean(refresh))
  )
  ipcMain.handle('versions:loader-builds', (_event, loader, mcVersion: string) =>
    listLoaderBuilds(loader, mcVersion)
  )
  ipcMain.handle('versions:java', (_event, loader, mcVersion: string) =>
    requiredJavaMajorForLoader(loader, mcVersion)
  )

  ipcMain.handle('java:detect', () => detectJava(true))
  ipcMain.handle('java:install', async (_event, major: number) => {
    const runtime = await installJava(major, (message, percent) => {
      broadcast('progress', { scope: 'java', message, percent })
    })
    broadcast('java:changed', null)
    return runtime
  })

  ipcMain.handle('process:start', (_event, id: string) => startServer(id))
  ipcMain.handle('process:stop', (_event, id: string) => stopServer(id))
  ipcMain.handle('process:kill', (_event, id: string) => killServer(id))
  ipcMain.handle('process:restart', (_event, id: string) => restartServer(id))
  ipcMain.handle('process:command', (_event, id: string, command: string) => sendCommand(id, command))
  ipcMain.handle('process:statuses', () => getStatuses())

  ipcMain.handle('mods:search', (_event, params: ModSearchParams) => {
    const settings = getSettings()
    return searchMods({ ...params, releaseChannels: settings.releaseChannels })
  })
  ipcMain.handle('mods:versions', (_event, input: ModVersionsInput) => {
    const settings = getSettings()
    return listModVersions({ ...input, releaseChannels: settings.releaseChannels })
  })
  ipcMain.handle('mods:install', (_event, input: ModInstallInput) => installMod(input))
  ipcMain.handle('mods:check-updates', (_event, serverId: string) => checkModUpdates(serverId))
  ipcMain.handle('mods:update', (_event, serverId: string, filename: string, kind: ModKind) =>
    updateMod(serverId, filename, kind)
  )
}

export function projectRoot(): string {
  return path.resolve(PATHS.root)
}
