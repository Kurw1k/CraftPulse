import { contextBridge, ipcRenderer } from 'electron'
import type { LauncherApi } from '../shared/api'

function subscribe<T>(channel: string, cb: (payload: T) => void): () => void {
  const listener = (_event: Electron.IpcRendererEvent, payload: T): void => cb(payload)
  ipcRenderer.on(channel, listener)
  return () => {
    ipcRenderer.removeListener(channel, listener)
  }
}

const api: LauncherApi = {
  app: {
    paths: () => ipcRenderer.invoke('app:paths'),
    info: () => ipcRenderer.invoke('app:info'),
    settings: () => ipcRenderer.invoke('app:settings'),
    saveSettings: (patch) => ipcRenderer.invoke('app:save-settings', patch),
    openPath: (target) => ipcRenderer.invoke('app:open-path', target),
    openExternal: (url) => ipcRenderer.invoke('app:open-external', url)
  },
  servers: {
    list: () => ipcRenderer.invoke('servers:list'),
    create: (input) => ipcRenderer.invoke('servers:create', input),
    update: (id, patch) => ipcRenderer.invoke('servers:update', id, patch),
    remove: (id) => ipcRenderer.invoke('servers:remove', id),
    acceptEula: (id) => ipcRenderer.invoke('servers:accept-eula', id),
    readProperties: (id) => ipcRenderer.invoke('servers:read-properties', id),
    writeProperties: (id, values) => ipcRenderer.invoke('servers:write-properties', id, values),
    installedMods: (id) => ipcRenderer.invoke('servers:installed-mods', id),
    deleteMod: (id, filename, kind) =>
      ipcRenderer.invoke('servers:delete-mod', id, filename, kind),
    setModEnabled: (id, filename, kind, enabled) =>
      ipcRenderer.invoke('servers:set-mod-enabled', id, filename, kind, enabled),
    openFolder: (id, subfolder) => ipcRenderer.invoke('servers:open-folder', id, subfolder)
  },
  versions: {
    minecraft: (loader, refresh) => ipcRenderer.invoke('versions:minecraft', loader, refresh),
    loaderBuilds: (loader, mcVersion) => ipcRenderer.invoke('versions:loader-builds', loader, mcVersion),
    javaRequirement: (loader, mcVersion) => ipcRenderer.invoke('versions:java', loader, mcVersion)
  },
  java: {
    detect: () => ipcRenderer.invoke('java:detect'),
    install: (major) => ipcRenderer.invoke('java:install', major)
  },
  process: {
    start: (id) => ipcRenderer.invoke('process:start', id),
    stop: (id) => ipcRenderer.invoke('process:stop', id),
    kill: (id) => ipcRenderer.invoke('process:kill', id),
    restart: (id) => ipcRenderer.invoke('process:restart', id),
    command: (id, command) => ipcRenderer.invoke('process:command', id, command),
    statuses: () => ipcRenderer.invoke('process:statuses')
  },
  mods: {
    search: (params) => ipcRenderer.invoke('mods:search', params),
    versions: (input) => ipcRenderer.invoke('mods:versions', input),
    install: (input) => ipcRenderer.invoke('mods:install', input),
    checkUpdates: (serverId) => ipcRenderer.invoke('mods:check-updates', serverId),
    update: (serverId, filename, kind) =>
      ipcRenderer.invoke('mods:update', serverId, filename, kind)
  },
  events: {
    onServerOutput: (cb) => subscribe('server:output', cb),
    onServerStatus: (cb) => subscribe('server:status', cb),
    onMetrics: (cb) => subscribe('server:metrics', cb),
    onProgress: (cb) => subscribe('progress', cb),
    onServersChanged: (cb) => subscribe('servers:changed', () => cb())
  }
}

contextBridge.exposeInMainWorld('api', api)
