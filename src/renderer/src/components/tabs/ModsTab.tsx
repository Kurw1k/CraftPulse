import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  Download,
  FolderOpen,
  History,
  Package,
  Plug,
  RefreshCw,
  Search,
  Trash2
} from 'lucide-react'
import type {
  InstalledMod,
  ModKind,
  ModSearchResult,
  ModSource,
  ServerInstance
} from '@shared/types'
import { loaderSupportsMods, loaderSupportsPlugins } from '@shared/types'
import { cleanError } from '../../lib/errors'
import { formatNumber } from '../../lib/format'
import { useLauncher } from '../../state/LauncherContext'
import { Button, ProgressBar, Segmented, Spinner } from '../ui'
import { ModVersionsModal } from '../modals/ModVersionsModal'

export function ModsTab({
  server,
  active
}: {
  server: ServerInstance
  active: boolean
}): JSX.Element {
  const { notify, t, settings } = useLauncher()
  const supportsPlugins = loaderSupportsPlugins(server.loader)
  const supportsMods = loaderSupportsMods(server.loader)
  const available = supportsMods || supportsPlugins

  const [source, setSource] = useState<ModSource>('modrinth')
  const [kind, setKind] = useState<ModKind>(
    supportsMods ? 'mod' : supportsPlugins ? 'plugin' : 'mod'
  )
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ModSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [installing, setInstalling] = useState<string | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)
  const [installed, setInstalled] = useState<InstalledMod[]>([])
  const [progress, setProgress] = useState<{ message: string; percent?: number } | null>(null)
  const [versionsFor, setVersionsFor] = useState<ModSearchResult | null>(null)
  const requestRef = useRef(0)

  const loadInstalled = useCallback(async (): Promise<void> => {
    try {
      setInstalled(await window.api.servers.installedMods(server.id))
    } catch (error) {
      notify(
        t('Не удалось прочитать папку модов: {error}', { error: cleanError(error) }),
        'error'
      )
    }
  }, [notify, server.id, t])

  // Список установленного мог измениться во вкладке «Установленные моды».
  useEffect(() => {
    if (active) void loadInstalled()
  }, [active, loadInstalled])

  useEffect(() => {
    if (!active) setProgress(null)
  }, [active])

  useEffect(() => {
    if (!active) setVersionsFor(null)
  }, [active])

  useEffect(() => {
    return window.api.events.onProgress((event) => {
      if (event.scope !== 'mod' || event.serverId !== server.id) return
      setProgress({ message: event.message, percent: event.percent })
    })
  }, [server.id])

  useEffect(() => {
    if (!available) return
    const request = ++requestRef.current
    const timer = window.setTimeout(() => {
      setSearching(true)
      setSearchError(null)
      window.api.mods
        .search({
          source,
          query: query.trim(),
          gameVersion: server.mcVersion,
          loader: server.loader,
          kind,
          releaseChannels: settings?.releaseChannels ?? ['release']
        })
        .then((list) => {
          if (requestRef.current === request) setResults(list)
        })
        .catch((error) => {
          if (requestRef.current !== request) return
          setResults([])
          setSearchError(cleanError(error))
        })
        .finally(() => {
          if (requestRef.current === request) setSearching(false)
        })
    }, 350)
    return () => window.clearTimeout(timer)
  }, [query, source, kind, server.id, server.loader, server.mcVersion, available])

  useEffect(() => {
    if (kind === 'plugin' && !supportsPlugins) setKind(supportsMods ? 'mod' : 'plugin')
    if (kind === 'mod' && !supportsMods && supportsPlugins) setKind('plugin')
  }, [kind, supportsMods, supportsPlugins])

  const installedProjects = useMemo(() => {
    const map = new Map<string, InstalledMod[]>()
    for (const entry of installed) {
      if (!entry.projectId || entry.source === 'manual') continue
      const key = `${entry.kind}:${entry.source}:${entry.projectId}`
      const list = map.get(key)
      if (list) list.push(entry)
      else map.set(key, [entry])
    }
    return map
  }, [installed])

  const installedFor = (result: ModSearchResult): InstalledMod[] =>
    installedProjects.get(`${result.kind}:${result.source}:${result.id}`) ?? []

  const install = async (result: ModSearchResult): Promise<void> => {
    setInstalling(result.id)
    setProgress({ message: t('Подготовка «{name}»…', { name: result.name }) })
    try {
      const entry = await window.api.mods.install({
        serverId: server.id,
        source: result.source,
        projectId: result.id,
        name: result.name,
        gameVersion: server.mcVersion,
        loader: server.loader,
        kind
      })
      notify(t('«{name}» установлен: {file}', { name: result.name, file: entry.filename }), 'success')
      await loadInstalled()
    } catch (error) {
      notify(cleanError(error), 'error')
    } finally {
      setInstalling(null)
      setProgress(null)
    }
  }

  const removeProject = async (
    result: ModSearchResult,
    entries: InstalledMod[]
  ): Promise<void> => {
    setRemoving(result.id)
    try {
      let latest = installed
      for (const entry of entries) {
        latest = await window.api.servers.deleteMod(server.id, entry.filename, entry.kind)
      }
      setInstalled(latest)
      notify(
        entries.length > 1
          ? t('«{name}» удалён ({count} файла)', { name: result.name, count: entries.length })
          : t('«{name}» удалён', { name: result.name }),
        'success'
      )
    } catch (error) {
      notify(cleanError(error), 'error')
    } finally {
      setRemoving(null)
    }
  }

  const openFolder = async (): Promise<void> => {
    try {
      await window.api.servers.openFolder(server.id, kind === 'plugin' ? 'plugins' : 'mods')
    } catch (error) {
      notify(cleanError(error), 'error')
    }
  }

  if (!available) {
    return (
      <div className="mx-auto mt-10 max-w-xl rounded-2xl border border-white/[0.07] bg-ink-850/70 p-8 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.04] text-slate-500">
          <Package className="h-6 w-6" />
        </span>
        <h3 className="mt-4 text-base font-semibold text-slate-100">
          {t('Это ядро не поддерживает моды и плагины')}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          {t(
            'Официальное ядро Mojang не загружает сторонний контент. Создайте сервер на Fabric, Forge, NeoForge, Paper или гибридном ядре — и менеджер модов станет доступен.'
          )}
        </p>
        <Button variant="secondary" className="mt-5" onClick={() => void openFolder()}>
          <FolderOpen className="h-4 w-4" />
          {t('Открыть папку сервера')}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-2">
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            value={source}
            onChange={setSource}
            options={[
              { value: 'modrinth', label: 'Modrinth' },
              { value: 'curseforge', label: 'CurseForge' }
            ]}
          />
          <Segmented
            value={kind}
            onChange={setKind}
            options={[
              {
                value: 'mod',
                label: t('Моды'),
                icon: <Package className="h-3.5 w-3.5" />,
                disabled: !supportsMods
              },
              {
                value: 'plugin',
                label: t('Плагины'),
                icon: <Plug className="h-3.5 w-3.5" />,
                disabled: !supportsPlugins
              }
            ]}
          />
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-600" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={kind === 'plugin' ? t('Поиск плагинов…') : t('Поиск модов…')}
              spellCheck={false}
              className="input py-1.5 pl-8 text-xs"
            />
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setSearching(true)
              setSearchError(null)
              const request = ++requestRef.current
              window.api.mods
                .search({
                  source,
                  query: query.trim(),
                  gameVersion: server.mcVersion,
                  loader: server.loader,
                  kind,
                  releaseChannels: settings?.releaseChannels ?? ['release']
                })
                .then((list) => {
                  if (requestRef.current === request) setResults(list)
                })
                .catch((error) => {
                  if (requestRef.current === request) {
                    setResults([])
                    setSearchError(cleanError(error))
                  }
                })
                .finally(() => {
                  if (requestRef.current === request) setSearching(false)
                })
            }}
            loading={searching}
          >
            {!searching ? <RefreshCw className="h-3.5 w-3.5" /> : null}
            {t('Обновить')}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => void openFolder()}>
            <FolderOpen className="h-3.5 w-3.5" />
            {t('Папка')}
          </Button>
        </div>
        <p className="mt-2 text-[11px] text-slate-600">
          {source === 'curseforge'
            ? t('CurseForge требует API-ключ — добавьте его в настройках приложения.')
            : t('Файлы скачиваются с Modrinth и сразу попадают в папку сервера.')}
        </p>

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

      {searchError ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-4 py-3 text-xs text-amber-200/90">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="min-w-0 flex-1 leading-relaxed">{searchError}</p>
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {searching && results.length === 0 ? (
          <div className="col-span-full flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
            <Spinner />
            {t('Загрузка каталога {source}…', {
              source: source === 'modrinth' ? 'Modrinth' : 'CurseForge'
            })}
          </div>
        ) : null}

        {!searching && results.length === 0 && !searchError ? (
          <div className="col-span-full rounded-xl border border-dashed border-white/[0.08] px-6 py-10 text-center text-sm text-slate-500">
            {t('Ничего не найдено. Попробуйте изменить запрос или источник.')}
          </div>
        ) : null}

        {results.map((result) => {
          const projectEntries = installedFor(result)
          const isInstalled = projectEntries.length > 0
          return (
            <article
              key={`${result.source}-${result.id}`}
              className="flex flex-col gap-3 rounded-xl border border-white/[0.06] bg-ink-850/70 p-3.5 transition hover:border-white/[0.12]"
            >
              <div className="flex items-start gap-3">
                {result.iconUrl ? (
                  <img
                    src={result.iconUrl}
                    alt=""
                    loading="lazy"
                    className="h-10 w-10 shrink-0 rounded-lg border border-white/10 object-cover"
                  />
                ) : (
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/[0.05] text-slate-500">
                    <Package className="h-5 w-5" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <h4 className="truncate text-sm font-semibold text-slate-100">{result.name}</h4>
                    {isInstalled ? (
                      <span
                        className="max-w-[150px] shrink-0 truncate rounded border border-emerald-400/25 bg-emerald-400/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-emerald-300"
                        title={projectEntries[0]?.version}
                      >
                        {t('В папке')}
                        {projectEntries[0]?.version ? ` · ${projectEntries[0].version}` : ''}
                      </span>
                    ) : null}
                  </div>
                  <p className="truncate text-[11px] text-slate-500">
                    {result.author} · <Download className="mb-0.5 inline h-3 w-3" />{' '}
                    {formatNumber(result.downloads)}
                  </p>
                </div>
              </div>

              <p className="line-clamp-2 min-h-[32px] text-xs leading-relaxed text-slate-500">
                {result.summary || t('Без описания')}
              </p>

              <div className="flex flex-wrap gap-1">
                {result.categories.slice(0, 4).map((category) => (
                  <span key={category} className="chip text-[10px]">
                    {category}
                  </span>
                ))}
              </div>

              <div className="mt-auto flex items-stretch gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  className="flex-1"
                  disabled={installing !== null || removing !== null}
                  onClick={() => setVersionsFor(result)}
                  title={t('Выбрать другую версию файла')}
                >
                  <History className="h-3.5 w-3.5" />
                  {t('Версии')}
                </Button>

                {isInstalled ? (
                  <Button
                    variant="danger"
                    size="sm"
                    className="flex-1"
                    loading={removing === result.id}
                    disabled={
                      installing !== null || (removing !== null && removing !== result.id)
                    }
                    onClick={() => void removeProject(result, projectEntries)}
                  >
                    {removing !== result.id ? <Trash2 className="h-3.5 w-3.5" /> : null}
                    {t('Удалить')}
                  </Button>
                ) : (
                  <Button
                    variant={installing === result.id ? 'secondary' : 'primary'}
                    size="sm"
                    className="flex-1"
                    loading={installing === result.id}
                    disabled={installing !== null || removing !== null}
                    onClick={() => void install(result)}
                  >
                    {installing !== result.id ? <Download className="h-3.5 w-3.5" /> : null}
                    {installing === result.id ? t('Установка…') : t('Установить')}
                  </Button>
                )}
              </div>
            </article>
          )
        })}
      </div>

      {versionsFor ? (
        <ModVersionsModal
          server={server}
          project={versionsFor}
          installed={installedFor(versionsFor)}
          onClose={() => setVersionsFor(null)}
          onInstalled={loadInstalled}
        />
      ) : null}

    </div>
  )
}
