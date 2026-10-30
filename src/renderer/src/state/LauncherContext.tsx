import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react'
import type {
  AppInfo,
  AppSettings,
  JavaRuntime,
  LauncherPaths,
  MetricsSnapshot,
  ServerInstance,
  ServerStatusInfo
} from '@shared/types'
import { translate, type Language } from '@shared/i18n'
import { cleanError } from '../lib/errors'
import { getLocale, setLocale } from '../lib/locale'
import { ToastViewport } from '../components/ToastViewport'

export type ToastTone = 'info' | 'success' | 'error'

export interface Toast {
  id: string
  message: string
  tone: ToastTone
}

interface LauncherContextValue {
  loading: boolean
  servers: ServerInstance[]
  statuses: Record<string, ServerStatusInfo>
  metrics: Record<string, MetricsSnapshot[]>
  settings: AppSettings | null
  /** Текущий язык интерфейса. */
  language: Language
  /** Перевод строки на текущий язык. */
  t: (message: string, params?: Record<string, string | number>) => string
  runtimes: JavaRuntime[]
  paths: LauncherPaths | null
  info: AppInfo | null
  refreshServers: () => Promise<void>
  refreshRuntimes: () => Promise<void>
  saveSettings: (patch: Partial<AppSettings>) => Promise<AppSettings | null>
  notify: (message: string, tone?: ToastTone) => void
  toasts: Toast[]
  dismissToast: (id: string) => void
}

const LauncherContext = createContext<LauncherContextValue | null>(null)

export function LauncherProvider({ children }: { children: ReactNode }): JSX.Element {
  const [loading, setLoading] = useState(true)
  const [servers, setServers] = useState<ServerInstance[]>([])
  const [statuses, setStatuses] = useState<Record<string, ServerStatusInfo>>({})
  const [metrics, setMetrics] = useState<Record<string, MetricsSnapshot[]>>({})
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [runtimes, setRuntimes] = useState<JavaRuntime[]>([])
  const [paths, setPaths] = useState<LauncherPaths | null>(null)
  const [info, setInfo] = useState<AppInfo | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])

  const language: Language = settings?.language ?? 'en'
  const t = useCallback(
    (message: string, params?: Record<string, string | number>) =>
      translate(language, message, params),
    [language]
  )

  // Синхронно обновляем язык модульных хелперов (format/errors) до рендера детей.
  setLocale(language)

  const dismissToast = useCallback((id: string) => {
    setToasts((previous) => previous.filter((toast) => toast.id !== id))
  }, [])

  const notify = useCallback(
    (message: string, tone: ToastTone = 'info') => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      setToasts((previous) => [...previous.slice(-4), { id, message, tone }])
      window.setTimeout(() => dismissToast(id), tone === 'error' ? 9000 : 5000)
    },
    [dismissToast]
  )

  const refreshServers = useCallback(async () => {
    try {
      setServers(await window.api.servers.list())
    } catch (error) {
      notify(
        translate(getLocale(), 'Не удалось загрузить список серверов: {error}', {
          error: cleanError(error)
        }),
        'error'
      )
    }
  }, [notify])

  const refreshRuntimes = useCallback(async () => {
    try {
      setRuntimes(await window.api.java.detect())
    } catch (error) {
      notify(
        translate(getLocale(), 'Не удалось определить Java: {error}', { error: cleanError(error) }),
        'error'
      )
    }
  }, [notify])

  const saveSettings = useCallback(
    async (patch: Partial<AppSettings>) => {
      try {
        const next = await window.api.app.saveSettings(patch)
        setSettings(next)
        notify(translate(next.language, 'Настройки сохранены'), 'success')
        return next
      } catch (error) {
        notify(cleanError(error), 'error')
        return null
      }
    },
    [notify]
  )

  useEffect(() => {
    let alive = true

    async function bootstrap(): Promise<void> {
      try {
        const [serverList, statusList, config, runtimeList, pathInfo, appInfo] =
          await Promise.all([
            window.api.servers.list(),
            window.api.process.statuses(),
            window.api.app.settings(),
            window.api.java.detect(),
            window.api.app.paths(),
            window.api.app.info()
          ])
        if (!alive) return
        setServers(serverList)
        setStatuses(
          Object.fromEntries(statusList.map((status) => [status.id, status])) as Record<
            string,
            ServerStatusInfo
          >
        )
        setSettings(config)
        setRuntimes(runtimeList)
        setPaths(pathInfo)
        setInfo(appInfo)
      } catch (error) {
        if (alive) {
          notify(
            translate(getLocale(), 'Ошибка инициализации: {error}', { error: cleanError(error) }),
            'error'
          )
        }
      } finally {
        if (alive) setLoading(false)
      }
    }

    void bootstrap()

    const offStatus = window.api.events.onServerStatus((status) => {
      setStatuses((previous) => ({ ...previous, [status.id]: status }))
      if (status.status === 'stopped' || status.status === 'crashed') {
        void refreshServers()
      }
    })

    const offMetrics = window.api.events.onMetrics((snapshot) => {
      setMetrics((previous) => {
        const list = previous[snapshot.serverId] ?? []
        return {
          ...previous,
          [snapshot.serverId]: [...list, snapshot].slice(-120)
        }
      })
    })

    const offServers = window.api.events.onServersChanged(() => {
      void refreshServers()
    })

    const offProgress = window.api.events.onProgress((event) => {
      if (event.scope === 'java' && event.percent === 100) {
        void refreshRuntimes()
      }
    })

    return () => {
      alive = false
      offStatus()
      offMetrics()
      offServers()
      offProgress()
    }
  }, [notify, refreshRuntimes, refreshServers])

  const value = useMemo<LauncherContextValue>(
    () => ({
      loading,
      servers,
      statuses,
      metrics,
      settings,
      language,
      t,
      runtimes,
      paths,
      info,
      refreshServers,
      refreshRuntimes,
      saveSettings,
      notify,
      toasts,
      dismissToast
    }),
    [
      loading,
      servers,
      statuses,
      metrics,
      settings,
      language,
      t,
      runtimes,
      paths,
      info,
      refreshServers,
      refreshRuntimes,
      saveSettings,
      notify,
      toasts,
      dismissToast
    ]
  )

  return (
    <LauncherContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </LauncherContext.Provider>
  )
}

export function useLauncher(): LauncherContextValue {
  const context = useContext(LauncherContext)
  if (!context) throw new Error('useLauncher must be used inside LauncherProvider')
  return context
}
