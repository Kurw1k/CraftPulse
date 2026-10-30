import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  History,
  RefreshCw
} from 'lucide-react'
import type {
  InstalledMod,
  ModSearchResult,
  ModVersionInfo,
  ServerInstance
} from '@shared/types'
import { LOADER_LABELS } from '@shared/types'
import { cleanError } from '../../lib/errors'
import { cn, formatBytes, formatDate } from '../../lib/format'
import { useLauncher } from '../../state/LauncherContext'
import { Button, Modal, ProgressBar, Spinner } from '../ui'

function versionDate(version: ModVersionInfo, t: (m: string) => string): string {
  if (!version.publishedAt) return t('дата неизвестна')
  const timestamp = Date.parse(version.publishedAt)
  return Number.isFinite(timestamp) ? formatDate(timestamp) : t('дата неизвестна')
}

function Chip({
  children,
  tone = 'neutral',
  title
}: {
  children: ReactNode
  tone?: 'neutral' | 'green' | 'amber' | 'muted'
  title?: string
}): JSX.Element {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center rounded border px-1.5 py-0.5 text-[9.5px] font-medium',
        tone === 'neutral' && 'border-white/[0.07] bg-white/[0.04] text-slate-400',
        tone === 'green' && 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300',
        tone === 'amber' && 'border-amber-400/25 bg-amber-400/10 text-amber-300',
        tone === 'muted' && 'border-white/[0.05] bg-transparent text-slate-600'
      )}
    >
      {children}
    </span>
  )
}

export function ModVersionsModal({
  server,
  project,
  installed,
  onClose,
  onInstalled
}: {
  server: ServerInstance
  project: ModSearchResult
  installed: InstalledMod[]
  onClose: () => void
  onInstalled: () => Promise<void> | void
}): JSX.Element {
  const { notify, t, settings } = useLauncher()
  const [versions, setVersions] = useState<ModVersionInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [installing, setInstalling] = useState(false)
  const [progress, setProgress] = useState<{ message: string; percent?: number } | null>(null)

  const installedVersionIds = useMemo(
    () =>
      new Set(
        installed
          .filter((entry) => entry.projectId === project.id && entry.kind === project.kind)
          .map((entry) => entry.versionId)
          .filter((value): value is string => Boolean(value))
      ),
    [installed, project.id, project.kind]
  )

  // Запасной вариант только для старых записей без versionId, иначе две разные
  // сборки с одинаковым номером (bukkit и mod) подсветились бы обе.
  const installedVersionNames = useMemo(
    () =>
      new Set(
        installed
          .filter(
            (entry) =>
              entry.projectId === project.id &&
              entry.kind === project.kind &&
              !entry.versionId
          )
          .map((entry) => entry.version?.toLowerCase())
          .filter((value): value is string => Boolean(value))
      ),
    [installed, project.id, project.kind]
  )

  const isVersionInstalled = useCallback(
    (version: ModVersionInfo): boolean =>
      installedVersionIds.has(version.id) ||
      installedVersionNames.has(version.name.toLowerCase()),
    [installedVersionIds, installedVersionNames]
  )

  const load = useCallback(
    async (refresh = false): Promise<void> => {
      setLoading(true)
      setError(null)
      if (refresh) setSelectedId(null)
      try {
        const list = await window.api.mods.versions({
          source: project.source,
          projectId: project.id,
          gameVersion: server.mcVersion,
          loader: server.loader,
          kind: project.kind,
          releaseChannels: settings?.releaseChannels ?? ['release']
        })
        setVersions(list)
        const installedVersion = list.find((version) => isVersionInstalled(version))
        const preferred =
          installedVersion ??
          list.find((version) => version.compatible && version.downloadable) ??
          list.find((version) => version.downloadable) ??
          list[0]
        setSelectedId((previous) =>
          previous && list.some((version) => version.id === previous)
            ? previous
            : (preferred?.id ?? null)
        )
      } catch (caught) {
        setVersions([])
        setError(cleanError(caught))
      } finally {
        setLoading(false)
      }
    },
    [isVersionInstalled, project.id, project.kind, project.source, server.loader, server.mcVersion]
  )

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    return window.api.events.onProgress((event) => {
      if (event.scope !== 'mod' || event.serverId !== server.id) return
      setProgress({ message: event.message, percent: event.percent })
    })
  }, [server.id])

  const selected = versions.find((version) => version.id === selectedId) ?? null
  const selectedInstalled = selected ? isVersionInstalled(selected) : false
  const loaderLabel = LOADER_LABELS[server.loader] ?? server.loader

  const install = async (): Promise<void> => {
    if (!selected || installing) return
    setInstalling(true)
    setProgress({
      message: t('Подготовка «{name}» {version}…', {
        name: project.name,
        version: selected.name
      })
    })
    try {
      const entry = await window.api.mods.install({
        serverId: server.id,
        source: project.source,
        projectId: project.id,
        name: project.name,
        gameVersion: server.mcVersion,
        loader: server.loader,
        kind: project.kind,
        versionId: selected.id
      })
      notify(
        t('Установлено: «{name}» {version} ({file})', {
          name: project.name,
          version: selected.name,
          file: entry.filename
        }),
        'success'
      )
      await onInstalled()
      onClose()
    } catch (caught) {
      notify(cleanError(caught), 'error')
    } finally {
      setInstalling(false)
      setProgress(null)
    }
  }

  return (
    <Modal
      onClose={onClose}
      closeDisabled={installing}
      width="max-w-3xl"
      title={
        <span className="flex min-w-0 items-center gap-2">
          <History className="h-4 w-4 shrink-0 text-slate-500" />
          <span className="truncate">{project.name}</span>
        </span>
      }
      subtitle={t('Версии и файлы: {kind} · {source} · {loader} {version}', {
        kind: project.kind === 'plugin' ? t('плагин') : t('мод'),
        source: project.source === 'modrinth' ? 'Modrinth' : 'CurseForge',
        loader: loaderLabel,
        version: server.mcVersion
      })}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 text-[11px] text-slate-500">
            {selected ? (
              <span className="truncate">
                {t('Выбрано:')}{' '}
                <span className="text-slate-300">{selected.name}</span>
                <span className="ml-1 font-mono text-[10px] text-slate-600">
                  {selected.fileName}
                </span>
                {selectedInstalled ? (
                  <span className="ml-1.5 text-emerald-300">
                    · {t('уже установлено')}
                  </span>
                ) : null}
                {!selected.compatible ? (
                  <span className="ml-1.5 text-amber-300">
                    · {t('не для текущего сервера')}
                  </span>
                ) : null}
              </span>
            ) : (
              t('Выберите версию из списка')
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose} disabled={installing}>
              {t('Закрыть')}
            </Button>
            <Button
              variant="primary"
              onClick={() => void install()}
              loading={installing}
              disabled={!selected || !selected.downloadable || installing}
              title={
                selected && !selected.downloadable
                  ? t('Автор запретил стороннее скачивание этой версии')
                  : undefined
              }
            >
              {!installing ? <Download className="h-4 w-4" /> : null}
              {installing
                ? t('Установка…')
                : selectedInstalled
                  ? t('Установить заново')
                  : t('Установить выбранную')}
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] px-6 py-3">
        <p className="text-[11px] text-slate-500">
          {loading
            ? t('Загрузка списка версий…')
            : versions.length
              ? t('Совместимых версий: {count} · показаны только файлы для {loader} {version}', {
                  count: versions.length,
                  loader: loaderLabel,
                  version: server.mcVersion
                })
              : t('Совместимых файлов нет')}
        </p>
        <Button
          variant="ghost"
          size="xs"
          onClick={() => void load(true)}
          loading={loading}
          disabled={installing}
        >
          {!loading ? <RefreshCw className="h-3 w-3" /> : null}
          {t('Обновить список')}
        </Button>
      </div>

      {progress ? (
        <div className="border-b border-white/[0.06] px-6 py-2.5">
          <div className="flex items-center justify-between gap-3 text-[11px] text-slate-400">
            <span className="truncate">{progress.message}</span>
            {progress.percent !== undefined ? (
              <span className="shrink-0 font-mono text-slate-500">{progress.percent}%</span>
            ) : null}
          </div>
          <ProgressBar value={progress.percent} className="mt-1.5" />
        </div>
      ) : null}

      <div className="min-h-[220px] overflow-y-auto px-4 py-3">
        {loading && versions.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-14 text-sm text-slate-500">
            <Spinner />
            {t('Загрузка версий из {source}…', {
              source: project.source === 'modrinth' ? 'Modrinth' : 'CurseForge'
            })}
          </div>
        ) : null}

        {error ? (
          <div className="m-2 flex items-start gap-2.5 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-4 py-3 text-xs text-amber-200/90">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="min-w-0 flex-1 leading-relaxed">{error}</p>
          </div>
        ) : null}

        {!loading && !error && versions.length === 0 ? (
          <div className="m-2 flex items-start gap-2.5 rounded-xl border border-amber-400/25 bg-amber-400/[0.07] px-4 py-4 text-xs text-amber-200/90">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0 flex-1 leading-relaxed">
              <p className="font-semibold text-amber-200">
                {t('Совместимых версий для {loader} {version} не найдено', {
                  loader: loaderLabel,
                  version: server.mcVersion
                })}
              </p>
              <p className="mt-1 text-amber-200/70">
                {t(
                  'Показаны только файлы, у которых совпадают версия Minecraft и загрузчик. Попробуйте другой источник, ядро или версию сервера.'
                )}
              </p>
            </div>
          </div>
        ) : null}

        <ul className="space-y-1.5">
          {versions.map((version) => {
            const active = version.id === selectedId
            const installedNow = isVersionInstalled(version)
            const mcVersions = version.gameVersions.slice(0, 4)
            const extraMc = version.gameVersions.length - mcVersions.length
            const loaders = version.loaders.slice(0, 4)
            const extraLoaders = version.loaders.length - loaders.length
            return (
              <li key={version.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(version.id)}
                  className={cn(
                    'flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition',
                    active
                      ? 'border-accent/35 bg-accent/[0.06]'
                      : 'border-white/[0.05] bg-ink-950/40 hover:border-white/[0.12] hover:bg-white/[0.03]'
                  )}
                >
                  <span
                    className={cn(
                      'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                      active ? 'border-accent bg-accent/15' : 'border-white/20'
                    )}
                  >
                    {active ? <span className="h-2 w-2 rounded-full bg-accent" /> : null}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[12.5px] font-semibold text-slate-200">
                        {version.name}
                      </span>
                      {installedNow ? (
                        <Chip tone="green">
                          <CheckCircle2 className="mr-1 h-2.5 w-2.5" />
                          {t('Установлено')}
                        </Chip>
                      ) : null}
                      {!version.compatible ? (
                        <Chip
                          tone="amber"
                          title={t('Версия не совпадает с текущими Minecraft и ядром сервера')}
                        >
                          {t('другая версия')}
                        </Chip>
                      ) : null}
                      {!version.downloadable ? (
                        <Chip tone="muted" title={t('Автор запретил стороннее скачивание')}>
                          {t('недоступно')}
                        </Chip>
                      ) : null}
                    </div>

                    <p className="mt-0.5 truncate font-mono text-[10px] text-slate-600">
                      {version.fileName || t('файл не указан')}
                    </p>

                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      {mcVersions.map((mc) => (
                        <Chip key={`mc-${mc}`}>MC {mc}</Chip>
                      ))}
                      {extraMc > 0 ? <Chip tone="muted">+{extraMc}</Chip> : null}
                      {loaders.map((loader) => (
                        <Chip key={`loader-${loader}`}>{loader}</Chip>
                      ))}
                      {extraLoaders > 0 ? <Chip tone="muted">+{extraLoaders}</Chip> : null}
                      {version.gameVersions.length === 0 && version.loaders.length === 0 ? (
                        <Chip tone="muted">{t('без ограничений')}</Chip>
                      ) : null}
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="text-[10.5px] text-slate-500">{versionDate(version, t)}</p>
                    {version.fileSize ? (
                      <p className="mt-0.5 text-[9.5px] text-slate-600">
                        {formatBytes(version.fileSize)}
                      </p>
                    ) : null}
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </Modal>
  )
}
