import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  Boxes,
  FileCog,
  FolderOpen,
  Play,
  Plug,
  Puzzle,
  RefreshCw,
  Settings2,
  ShieldAlert,
  Skull,
  Square,
  TerminalSquare
} from 'lucide-react'
import type { ServerInstance } from '@shared/types'
import { isProxyLoader, modTabMode, modVocabulary } from '@shared/types'
import { useLauncher } from '../state/LauncherContext'
import { cleanError, isEulaError } from '../lib/errors'
import { cn } from '../lib/format'
import { Button, LoaderBadge, StatusBadge } from './ui'
import { MetricsPanel } from './MetricsPanel'
import { ConsoleTab } from './tabs/ConsoleTab'
import { InstalledModsTab } from './tabs/InstalledModsTab'
import { ModsTab } from './tabs/ModsTab'
import { SettingsTab } from './tabs/SettingsTab'
import { PropertiesTab } from './tabs/PropertiesTab'

type ServerTab = 'console' | 'mods' | 'installed' | 'settings' | 'properties'

interface ServerTabEntry {
  id: ServerTab
  label: string
  icon: JSX.Element
}

export function ServerView({
  server,
  active,
  onDeleted,
  onEulaRequired,
  onOpenFolder
}: {
  server: ServerInstance
  active: boolean
  onDeleted: (id: string) => void
  onEulaRequired: (server: ServerInstance, startAfter: boolean) => void
  onOpenFolder: () => void
}): JSX.Element {
  const { statuses, notify, language, t } = useLauncher()
  const statusInfo = statuses[server.id]
  const status = statusInfo?.status ?? 'stopped'
  const [tab, setTab] = useState<ServerTab>('console')
  const [busy, setBusy] = useState(false)
  const [onlineBusy, setOnlineBusy] = useState(false)

  const proxy = isProxyLoader(server.loader)
  const onlineMode = server.onlineMode ?? true
  const running = status === 'running' || status === 'starting'
  const stoppable = running || status === 'stopping'
  const tabMode = modTabMode(server.loader)
  const contentTabsVisible = tabMode !== 'hidden'
  const vocab = modVocabulary(server.loader, language)

  // Порядок строго фиксирован: консоль → контент → настройки → server.properties.
  const tabs: ServerTabEntry[] = [
    { id: 'console', label: t('Консоль'), icon: <TerminalSquare className="h-4 w-4" /> },
    ...(contentTabsVisible
      ? [
          {
            id: 'mods' as const,
            label: vocab.catalogTab,
            icon:
              tabMode === 'plugins' ? (
                <Plug className="h-4 w-4" />
              ) : (
                <Puzzle className="h-4 w-4" />
              )
          },
          {
            id: 'installed' as const,
            label: vocab.installedTab,
            icon: <Boxes className="h-4 w-4" />
          }
        ]
      : []),
    { id: 'settings', label: t('Настройки'), icon: <Settings2 className="h-4 w-4" /> },
    ...(proxy
      ? []
      : [
          {
            id: 'properties' as const,
            label: 'server.properties',
            icon: <FileCog className="h-4 w-4" />
          }
        ])
  ]

  // Если ядро сменилось на ванильное/прокси, скрытая вкладка не должна оставаться активной.
  useEffect(() => {
    if (!contentTabsVisible && (tab === 'mods' || tab === 'installed')) setTab('console')
    if (proxy && tab === 'properties') setTab('console')
  }, [contentTabsVisible, proxy, tab])

  const start = async (): Promise<void> => {
    setBusy(true)
    try {
      await window.api.process.start(server.id)
    } catch (error) {
      if (isEulaError(error)) {
        onEulaRequired(server, true)
      } else {
        notify(cleanError(error), 'error')
      }
    } finally {
      setBusy(false)
    }
  }

  const stop = async (): Promise<void> => {
    setBusy(true)
    try {
      await window.api.process.stop(server.id)
    } catch (error) {
      notify(cleanError(error), 'error')
    } finally {
      setBusy(false)
    }
  }

  const kill = async (): Promise<void> => {
    setBusy(true)
    try {
      await window.api.process.kill(server.id)
    } catch (error) {
      notify(cleanError(error), 'error')
    } finally {
      setBusy(false)
    }
  }

  const restart = async (): Promise<void> => {
    setBusy(true)
    try {
      await window.api.process.restart(server.id)
    } catch (error) {
      notify(cleanError(error), 'error')
    } finally {
      setBusy(false)
    }
  }

  const disableOnlineMode = async (): Promise<void> => {
    setOnlineBusy(true)
    try {
      await window.api.servers.update(server.id, { onlineMode: false })
      notify(t('Online mode отключён — пиратские клиенты смогут подключиться'), 'success')
      if (running) {
        notify(t('Перезапустите сервер, чтобы применить настройку'), 'info')
      }
    } catch (error) {
      notify(cleanError(error), 'error')
    } finally {
      setOnlineBusy(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="shrink-0 border-b border-white/[0.06] bg-ink-900/30 px-6 pb-4 pt-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-3">
              <h2 className="truncate text-xl font-bold tracking-tight text-slate-100">
                {server.name}
              </h2>
              <StatusBadge status={status} />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <LoaderBadge loader={server.loader} />
              <span className="font-mono text-[11px] text-slate-400">{server.mcVersion}</span>
              {server.loaderVersion ? (
                <span className="font-mono text-[11px] text-slate-600">
                  build {server.loaderVersion}
                </span>
              ) : null}
              <span className="text-slate-700">·</span>
              <span className="font-mono text-[11px]">{t('порт :{port}', { port: server.port })}</span>
              <button
                type="button"
                onClick={onOpenFolder}
                className="ml-1 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-slate-400 transition hover:bg-white/[0.06] hover:text-slate-200"
              >
                <FolderOpen className="h-3 w-3" />
                {t('Папка сервера')}
              </button>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {!running && status !== 'stopping' ? (
              <Button variant="primary" onClick={() => void start()} loading={busy}>
                <Play className="h-4 w-4" />
                {t('Запустить')}
              </Button>
            ) : null}
            {stoppable ? (
              <Button
                variant="danger"
                onClick={() => void stop()}
                disabled={status === 'stopping' || busy}
              >
                <Square className="h-3.5 w-3.5" />
                {status === 'stopping' ? t('Останавливается…') : t('Остановить')}
              </Button>
            ) : null}
            {running ? (
              <Button
                variant="success"
                onClick={() => void restart()}
                disabled={busy}
                title={t('Отправить stop и запустить сервер снова')}
              >
                <RefreshCw className="h-4 w-4" />
                {t('Перезапустить')}
              </Button>
            ) : null}
            {stoppable ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void kill()}
                disabled={busy}
                title={t('Аварийно снять процесс сервера (Force Kill)')}
                className="!bg-transparent !text-neutral-500 opacity-50 hover:!bg-red-500/[0.08] hover:!text-red-400 hover:opacity-100"
              >
                <Skull className="h-3.5 w-3.5" />
                {t('Снять процесс')}
              </Button>
            ) : null}
          </div>
        </div>

        {!proxy && onlineMode ? (
          <div className="mt-4 flex flex-wrap items-start gap-2.5 rounded-lg border border-red-400/25 bg-red-500/[0.08] px-3 py-2 text-xs text-red-200/90">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="min-w-0 flex-1 leading-relaxed">
              <span className="font-semibold text-red-200">{t('Online mode включён.')}</span>{' '}
              {t(
                'Игроки с пиратских клиентов не смогут подключиться к серверу. Отключите проверку лицензии, если используете неофициальный лаунчер.'
              )}
            </p>
            <button
              type="button"
              onClick={() => void disableOnlineMode()}
              disabled={onlineBusy}
              className="shrink-0 rounded-md border border-red-300/25 px-2 py-1 text-[11px] font-medium text-red-200 transition hover:bg-red-400/10 disabled:opacity-50"
            >
              {onlineBusy ? t('Отключаем…') : t('Отключить online mode')}
            </button>
          </div>
        ) : null}

        {!proxy && !server.eulaAccepted ? (
          <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-amber-400/20 bg-amber-400/[0.07] px-3 py-2 text-xs text-amber-200/90">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <p className="min-w-0 flex-1 leading-relaxed">
              {t(
                'Minecraft EULA ещё не принят. Сервер не запустится, пока вы не подтвердите согласие.'
              )}
            </p>
            <button
              type="button"
              onClick={() => onEulaRequired(server, false)}
              className="shrink-0 rounded-md border border-amber-300/25 px-2 py-1 text-[11px] font-medium text-amber-200 transition hover:bg-amber-300/10"
            >
              {t('Принять EULA')}
            </button>
          </div>
        ) : null}
      </header>

      <div className="shrink-0 px-6 pt-4">
        <MetricsPanel server={server} status={status} statusInfo={statusInfo} />
      </div>

      <nav className="mt-4 flex shrink-0 items-center gap-1 overflow-x-auto border-b border-white/[0.06] px-6">
        {tabs.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => setTab(entry.id)}
            className={cn(
              'tab-btn relative -mb-px shrink-0 whitespace-nowrap rounded-t-lg rounded-b-none border-b-2',
              tab === entry.id
                ? 'border-accent bg-white/[0.05] text-slate-100'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            )}
          >
            {entry.icon}
            {entry.label}
          </button>
        ))}
      </nav>

      <div className="relative min-h-0 flex-1 px-6 pb-5 pt-3">
        <div
          className={cn(
            'h-full min-h-0 flex-col',
            tab === 'console' ? 'flex' : 'hidden'
          )}
        >
          <ConsoleTab server={server} active={active && tab === 'console'} status={status} />
        </div>

        {contentTabsVisible ? (
          <>
            <div className={cn('h-full overflow-y-auto pr-1', tab === 'mods' ? 'block' : 'hidden')}>
              <ModsTab server={server} active={active && tab === 'mods'} />
            </div>

            <div
              className={cn(
                'h-full overflow-y-auto pr-1',
                tab === 'installed' ? 'block' : 'hidden'
              )}
            >
              <InstalledModsTab server={server} active={active && tab === 'installed'} />
            </div>
          </>
        ) : null}

        <div className={cn('h-full overflow-y-auto pr-1', tab === 'settings' ? 'block' : 'hidden')}>
          <SettingsTab server={server} onDeleted={onDeleted} />
        </div>

        <div
          className={cn('h-full overflow-y-auto pr-1', tab === 'properties' ? 'block' : 'hidden')}
        >
          <PropertiesTab server={server} />
        </div>
      </div>
    </div>
  )
}
