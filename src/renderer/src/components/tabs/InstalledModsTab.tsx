import { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  FolderOpen,
  History,
  Package,
  Plug,
  RefreshCw,
  Trash2
} from 'lucide-react'
import type {
  InstalledMod,
  ModKind,
  ModSearchResult,
  ModUpdateStatus,
  ServerInstance
} from '@shared/types'
import {
  loaderSupportsMods,
  loaderSupportsPlugins,
  modVocabulary
} from '@shared/types'
import { cleanError } from '../../lib/errors'
import { cn, formatBytes, timeAgo } from '../../lib/format'
import { useLauncher } from '../../state/LauncherContext'
import { Button, ProgressBar, Spinner, Toggle } from '../ui'
import { ModVersionsModal } from '../modals/ModVersionsModal'

const SOURCE_BADGE_STYLES: Record<InstalledMod['source'], { key: string; className: string }> = {
  modrinth: {
    key: 'Скачано с Modrinth',
    className: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300'
  },
  curseforge: {
    key: 'Скачано с CurseForge',
    className: 'border-orange-400/25 bg-orange-400/10 text-orange-300'
  },
  manual: {
    key: 'Добавлено пользователем',
    className: 'border-white/10 bg-white/[0.04] text-slate-400'
  }
}

function entryKey(entry: { kind: ModKind; filename: string }): string {
  return `${entry.kind}:${entry.filename}`
}

function guessVersion(filename: string): string | undefined {
  return /\d+\.\d+(?:\.\d+)?(?:[-+][\w.]+)?/.exec(filename)?.[0]
}

function InstalledRow({
  entry,
  deleting,
  toggling,
  update,
  updating,
  onDelete,
  onToggle,
  onUpdate,
  onVersions,
  versionsAvailable
}: {
  entry: InstalledMod
  deleting: boolean
  toggling: boolean
  update?: ModUpdateStatus
  updating: boolean
  onDelete: () => void
  onToggle: (enabled: boolean) => void
  onUpdate: () => void
  onVersions: () => void
  versionsAvailable: boolean
}): JSX.Element {
  const { t } = useLauncher()
  const [armed, setArmed] = useState(false)
  const version = entry.version ?? guessVersion(entry.filename)
  const badge = SOURCE_BADGE_STYLES[entry.source]

  return (
    <li
      className={cn(
        'rounded-lg border bg-ink-950/40 px-3 py-2.5 transition',
        update?.updateAvailable
          ? 'border-accent/30 bg-accent/[0.035]'
          : 'border-white/[0.05]',
        !entry.enabled && 'opacity-60'
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md',
            entry.kind === 'plugin'
              ? 'bg-violet/10 text-violet'
              : 'bg-accent/10 text-accent'
          )}
        >
          {entry.kind === 'plugin' ? <Plug className="h-3 w-3" /> : <Package className="h-3 w-3" />}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <p className="truncate text-[12px] font-medium text-slate-200">
              {entry.name ?? entry.filename}
            </p>
            {!entry.enabled ? (
              <span className="shrink-0 rounded border border-amber-400/25 bg-amber-400/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-300">
                {t('Отключён')}
              </span>
            ) : null}
          </div>
          <p className="truncate font-mono text-[10px] text-slate-600">{entry.filename}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1">
            <span
              className={cn(
                'inline-flex items-center rounded border px-1.5 py-0.5 text-[9.5px] font-medium',
                badge.className
              )}
            >
              {t(badge.key)}
            </span>
            {version ? (
              <span className="chip text-[9.5px]" title={t('Текущая версия')}>
                v{version}
              </span>
            ) : null}
            {update?.updateAvailable && update.latestVersion ? (
              <span className="inline-flex items-center rounded border border-accent/25 bg-accent/10 px-1.5 py-0.5 text-[9.5px] font-medium text-accent">
                {t('доступна v{version}', { version: update.latestVersion })}
              </span>
            ) : null}
            {update && !update.updateAvailable && !update.error ? (
              <span className="inline-flex items-center gap-1 rounded border border-emerald-400/20 bg-emerald-400/[0.07] px-1.5 py-0.5 text-[9.5px] text-emerald-300/90">
                <CheckCircle2 className="h-2.5 w-2.5" />
                {t('Актуально')}
              </span>
            ) : null}
            {update?.error ? (
              <span
                className="inline-flex items-center gap-1 rounded border border-amber-400/25 bg-amber-400/10 px-1.5 py-0.5 text-[9.5px] text-amber-300"
                title={update.error}
              >
                <AlertTriangle className="h-2.5 w-2.5" />
                {t('Не удалось проверить')}
              </span>
            ) : null}
            <span className="text-[9.5px] text-slate-600">
              {formatBytes(entry.size)} · {timeAgo(entry.installedAt)}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            variant="ghost"
            size="xs"
            onClick={onVersions}
            disabled={!versionsAvailable || deleting || toggling || updating}
            title={
              versionsAvailable
                ? t('История версий: обновить или откатить файл')
                : t('Файл добавлен вручную — нет данных об источнике')
            }
          >
            <History className="h-3 w-3" />
            {t('Версии')}
          </Button>

          {update?.updateAvailable ? (
            <Button
              variant="primary"
              size="xs"
              loading={updating}
              disabled={deleting || toggling}
              title={
                update.latestVersion
                  ? t('Обновить до версии {version}', { version: update.latestVersion })
                  : t('Обновить файл')
              }
              onClick={onUpdate}
            >
              {!updating ? <RefreshCw className="h-3 w-3" /> : null}
              {t('Обновить')}
            </Button>
          ) : null}

          <Toggle
            checked={entry.enabled}
            onChange={onToggle}
            disabled={deleting || toggling || updating}
            label={entry.enabled ? t('Отключить файл') : t('Включить файл')}
          />

          {armed ? (
            <div className="flex items-center gap-1">
              <Button
                variant="danger"
                size="xs"
                loading={deleting}
                disabled={toggling || updating}
                onClick={() => {
                  onDelete()
                  setArmed(false)
                }}
              >
                {t('Удалить')}
              </Button>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => setArmed(false)}
                disabled={deleting}
              >
                {t('Отмена')}
              </Button>
            </div>
          ) : (
            <button
              type="button"
              title={t('Удалить файл')}
              onClick={() => setArmed(true)}
              disabled={deleting || toggling || updating}
              className="shrink-0 rounded-md p-1.5 text-slate-600 transition hover:bg-red-500/10 hover:text-red-300 disabled:opacity-40"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </li>
  )
}

export function InstalledModsTab({
  server,
  active
}: {
  server: ServerInstance
  active: boolean
}): JSX.Element {
  const { notify, language, t } = useLauncher()
  const supportsMods = loaderSupportsMods(server.loader)
  const supportsPlugins = loaderSupportsPlugins(server.loader)
  const available = supportsMods || supportsPlugins
  const vocab = modVocabulary(server.loader, language)

  const [installed, setInstalled] = useState<InstalledMod[]>([])
  const [loadingInstalled, setLoadingInstalled] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [toggling, setToggling] = useState<string | null>(null)
  const [updating, setUpdating] = useState<string | null>(null)
  const [bulkUpdating, setBulkUpdating] = useState(false)
  const [updates, setUpdates] = useState<Record<string, ModUpdateStatus>>({})
  const [checking, setChecking] = useState(false)
  const [progress, setProgress] = useState<{ message: string; percent?: number } | null>(null)
  const [versionsFor, setVersionsFor] = useState<InstalledMod | null>(null)

  const loadInstalled = useCallback(async (): Promise<void> => {
    setLoadingInstalled(true)
    try {
      setInstalled(await window.api.servers.installedMods(server.id))
      setUpdates({})
    } catch (error) {
      notify(
        t('Не удалось прочитать папку модов: {error}', { error: cleanError(error) }),
        'error'
      )
    } finally {
      setLoadingInstalled(false)
    }
  }, [notify, server.id, t])

  // Обновляем список при каждом открытии вкладки, чтобы видеть изменения из каталога.
  useEffect(() => {
    if (active) void loadInstalled()
  }, [active, loadInstalled])

  useEffect(() => {
    if (!active) {
      setProgress(null)
      setVersionsFor(null)
    }
  }, [active])

  useEffect(() => {
    return window.api.events.onProgress((event) => {
      if (event.scope !== 'mod' || event.serverId !== server.id) return
      setProgress({ message: event.message, percent: event.percent })
    })
  }, [server.id])

  const remove = async (entry: InstalledMod): Promise<void> => {
    const key = entryKey(entry)
    setDeleting(key)
    try {
      setInstalled(await window.api.servers.deleteMod(server.id, entry.filename, entry.kind))
      setUpdates((previous) => {
        const next = { ...previous }
        delete next[key]
        return next
      })
      notify(t('Файл {file} удалён', { file: entry.filename }), 'success')
    } catch (error) {
      notify(cleanError(error), 'error')
    } finally {
      setDeleting(null)
    }
  }

  const toggle = async (entry: InstalledMod, enabled: boolean): Promise<void> => {
    const key = entryKey(entry)
    setToggling(key)
    try {
      setInstalled(
        await window.api.servers.setModEnabled(server.id, entry.filename, entry.kind, enabled)
      )
      setUpdates({})
      notify(
        enabled
          ? t('Файл {file} включён', { file: entry.filename })
          : t('Файл {file} отключён — сервер не будет его загружать', { file: entry.filename }),
        'success'
      )
    } catch (error) {
      notify(cleanError(error), 'error')
    } finally {
      setToggling(null)
    }
  }

  const checkUpdates = async (): Promise<void> => {
    setChecking(true)
    try {
      const list = await window.api.mods.checkUpdates(server.id)
      const map: Record<string, ModUpdateStatus> = {}
      for (const status of list) map[entryKey(status)] = status
      setUpdates(map)
      const availableUpdates = list.filter((status) => status.updateAvailable).length
      const failed = list.filter((status) => status.error).length
      if (availableUpdates > 0) {
        notify(t('Доступны обновления: {count}', { count: availableUpdates }), 'info')
      } else if (failed > 0) {
        notify(t('Не удалось проверить файлов: {count}', { count: failed }), 'error')
      } else {
        notify(t('Все {noun} актуальны', { noun: vocab.nounPlural }), 'success')
      }
    } catch (error) {
      notify(cleanError(error), 'error')
    } finally {
      setChecking(false)
    }
  }

  const applyUpdate = async (entry: InstalledMod): Promise<void> => {
    const key = entryKey(entry)
    setUpdating(key)
    try {
      const result = await window.api.mods.update(server.id, entry.filename, entry.kind)
      await loadInstalled()
      notify(
        t('Обновлено: {name}{version}', {
          name: result.name ?? result.filename,
          version: result.version ? ` → ${result.version}` : ''
        }),
        'success'
      )
    } catch (error) {
      notify(cleanError(error), 'error')
    } finally {
      setUpdating(null)
      setProgress(null)
    }
  }

  const pendingUpdates = installed.filter(
    (entry) => updates[entryKey(entry)]?.updateAvailable
  )

  const updateAll = async (): Promise<void> => {
    if (pendingUpdates.length === 0 || bulkUpdating) return
    setBulkUpdating(true)
    let updated = 0
    const failures: string[] = []
    for (const entry of pendingUpdates) {
      setUpdating(entryKey(entry))
      try {
        await window.api.mods.update(server.id, entry.filename, entry.kind)
        updated += 1
      } catch (error) {
        failures.push(`${entry.name ?? entry.filename}: ${cleanError(error)}`)
      }
    }
    setUpdating(null)
    setBulkUpdating(false)
    setProgress(null)
    await loadInstalled()
    if (failures.length > 0) {
      notify(
        t('Обновлено: {updated}, ошибок: {failed} — {first}', {
          updated,
          failed: failures.length,
          first: failures[0]
        }),
        'error'
      )
    } else {
      notify(t('Обновлено файлов: {count}', { count: updated }), 'success')
    }
  }

  const projectFor = (entry: InstalledMod): ModSearchResult | null => {
    if (!entry.projectId || entry.source === 'manual') return null
    return {
      id: entry.projectId,
      source: entry.source,
      slug: '',
      name: entry.name ?? entry.filename,
      summary: '',
      author: '',
      downloads: 0,
      categories: [],
      kind: entry.kind
    }
  }

  const openFolder = async (kind: ModKind): Promise<void> => {
    try {
      await window.api.servers.openFolder(server.id, kind === 'plugin' ? 'plugins' : 'mods')
    } catch (error) {
      notify(cleanError(error), 'error')
    }
  }

  const enabledCount = installed.filter((entry) => entry.enabled).length
  const versionsProject = versionsFor ? projectFor(versionsFor) : null

  return (
    <div className="space-y-4 pb-2">
      <div className="card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">{vocab.installedTitle}</h3>
            <p className="mt-0.5 text-[11px] text-slate-500">
              {vocab.foldersLabel} · {t('{count} файл(ов)', { count: installed.length })}
              {installed.length > 0
                ? t(' · включено {on} · отключено {off}', {
                    on: enabledCount,
                    off: installed.length - enabledCount
                  })
                : ''}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {pendingUpdates.length > 0 ? (
              <Button
                variant="primary"
                size="xs"
                onClick={() => void updateAll()}
                loading={bulkUpdating}
                disabled={updating !== null || checking || deleting !== null}
                title={t('Обновить все файлы, для которых найдены новые версии')}
              >
                {!bulkUpdating ? <RefreshCw className="h-3 w-3" /> : null}
                {t('Обновить все ({count})', { count: pendingUpdates.length })}
              </Button>
            ) : null}
            <Button
              variant="secondary"
              size="xs"
              onClick={() => void checkUpdates()}
              loading={checking}
              disabled={installed.length === 0 || loadingInstalled || bulkUpdating}
            >
              {!checking ? <RefreshCw className="h-3 w-3" /> : null}
              {t('Проверить обновления')}
            </Button>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => void loadInstalled()}
              loading={loadingInstalled}
              disabled={!available || bulkUpdating}
            >
              {!loadingInstalled ? <RefreshCw className="h-3 w-3" /> : null}
              {t('Обновить')}
            </Button>
            {supportsMods ? (
              <Button variant="ghost" size="xs" onClick={() => void openFolder('mod')}>
                <FolderOpen className="h-3 w-3" />
                mods/
              </Button>
            ) : null}
            {supportsPlugins ? (
              <Button variant="ghost" size="xs" onClick={() => void openFolder('plugin')}>
                <FolderOpen className="h-3 w-3" />
                plugins/
              </Button>
            ) : null}
          </div>
        </div>

        {progress ? (
          <div className="mt-3 rounded-lg border border-white/[0.06] bg-ink-950/60 px-3 py-2">
            <div className="flex items-center justify-between gap-3 text-[11px] text-slate-400">
              <span className="truncate">{progress.message}</span>
              {progress.percent !== undefined ? (
                <span className="shrink-0 font-mono text-slate-500">{progress.percent}%</span>
              ) : null}
            </div>
            <ProgressBar value={progress.percent} className="mt-1.5" />
          </div>
        ) : null}
      </div>

      {!available ? (
        <div className="mx-auto mt-10 max-w-xl rounded-2xl border border-white/[0.07] bg-ink-850/70 p-8 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.04] text-slate-500">
            <Package className="h-6 w-6" />
          </span>
          <h3 className="mt-4 text-base font-semibold text-slate-100">
            {t('Это ядро не поддерживает моды и плагины')}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            {t(
              'Установленные файлы появятся здесь для Fabric, Forge, NeoForge, Paper, гибридных ядер и прокси. Для Vanilla сторонний контент не загружается.'
            )}
          </p>
          <Button
            variant="secondary"
            className="mt-5"
            onClick={() => void openFolder('mod')}
          >
            <FolderOpen className="h-4 w-4" />
            {t('Открыть папку сервера')}
          </Button>
        </div>
      ) : loadingInstalled && installed.length === 0 ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
          <Spinner />
          {t('Чтение {folders}…', { folders: vocab.foldersLabel })}
        </div>
      ) : installed.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/[0.08] px-6 py-10 text-center">
          <p className="text-sm text-slate-500">{t('Пока ничего не установлено.')}</p>
          <p className="mt-1 text-xs text-slate-600">
            {t(
              'Откройте «{tab}» и установите {noun} — CraftPulse запомнит источник и версию. Вручную добавленные .jar тоже появятся здесь.',
              { tab: vocab.catalogTab, noun: vocab.noun }
            )}
          </p>
        </div>
      ) : (
        <ul className="grid gap-2 lg:grid-cols-2">
          {installed.map((entry) => {
            const key = entryKey(entry)
            return (
              <InstalledRow
                key={key}
                entry={entry}
                deleting={deleting === key}
                toggling={toggling === key}
                updating={updating === key}
                update={updates[key]}
                onDelete={() => void remove(entry)}
                onToggle={(enabled) => void toggle(entry, enabled)}
                onUpdate={() => void applyUpdate(entry)}
                onVersions={() => setVersionsFor(entry)}
                versionsAvailable={Boolean(projectFor(entry))}
              />
            )
          })}
        </ul>
      )}

      {versionsFor && versionsProject ? (
        <ModVersionsModal
          server={server}
          project={versionsProject}
          installed={installed}
          onClose={() => setVersionsFor(null)}
          onInstalled={loadInstalled}
        />
      ) : null}
    </div>
  )
}
