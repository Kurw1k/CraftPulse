import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Coffee,
  Cpu,
  HardDrive,
  RefreshCw,
  Search,
  Sparkles
} from 'lucide-react'
import type {
  CreateServerInput,
  LoaderGroup,
  LoaderType,
  ServerInstance,
  VersionInfo
} from '@shared/types'
import {
  LOADERS,
  isProxyLoader,
  loaderMeta,
  loaderDescription,
  loaderGroupLabel
} from '@shared/types'
import { translate, type Language } from '@shared/i18n'
import { cleanError } from '../../lib/errors'
import { cn, formatDate, formatMemory } from '../../lib/format'
import { useLauncher } from '../../state/LauncherContext'
import { Button, Field, ProgressBar, Spinner, Toggle } from '../ui'
import { Modal } from '../ui'

const MIN_MEMORY = 512
const MAX_MEMORY = 65536
const JAVA_VERSIONS = [8, 17, 21, 25]
const LOADER_GROUPS: LoaderGroup[] = ['vanilla', 'plugins', 'mods', 'hybrid', 'proxy']

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, Math.round(value)))
}

function loaderHint(loader: LoaderType, language: Language): string {
  const meta = loaderMeta(loader)
  if (!meta) return ''
  if (meta.supportsMods && meta.supportsPlugins) return translate(language, 'моды + плагины')
  if (meta.supportsMods) return translate(language, 'моды')
  if (meta.supportsPlugins) return translate(language, 'плагины')
  return translate(language, 'без модов')
}

function autoServerName(loader: LoaderType, mcVersion: string, servers: ServerInstance[]): string {
  const label = loaderMeta(loader)?.name ?? loader
  const base = `${label}${mcVersion ? ` ${mcVersion}` : ''}`.trim()
  const taken = new Set(servers.map((server) => server.name))
  let candidate = base
  let counter = 2
  while (taken.has(candidate)) {
    candidate = `${base} (${counter})`
    counter += 1
  }
  return candidate
}

export function CreateServerModal({
  open,
  servers,
  defaultMemoryMb,
  onClose,
  onCreated
}: {
  open: boolean
  servers: ServerInstance[]
  defaultMemoryMb: number
  onClose: () => void
  onCreated: (instance: ServerInstance) => void
}): JSX.Element {
  const { runtimes, settings, info, language, t } = useLauncher()
  const [name, setName] = useState('')
  const [nameTouched, setNameTouched] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)
  const [loader, setLoader] = useState<LoaderType>('paper')
  const [mcVersion, setMcVersion] = useState('')
  const [loaderVersion, setLoaderVersion] = useState('')
  const [versions, setVersions] = useState<VersionInfo[]>([])
  const [loadingVersions, setLoadingVersions] = useState(false)
  const [versionsError, setVersionsError] = useState<string | null>(null)
  const [versionQuery, setVersionQuery] = useState('')
  const [releasesOnly, setReleasesOnly] = useState(true)
  const [builds, setBuilds] = useState<string[]>([])
  const [loadingBuilds, setLoadingBuilds] = useState(false)
  const [buildsError, setBuildsError] = useState<string | null>(null)
  const [javaRequired, setJavaRequired] = useState<number | null>(null)
  const [javaPath, setJavaPath] = useState('')
  const [memoryMin, setMemoryMin] = useState(1024)
  const [memoryMax, setMemoryMax] = useState(4096)
  const [port, setPort] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [log, setLog] = useState<string[]>([])
  const [percent, setPercent] = useState<number | undefined>(undefined)
  const creatingRef = useRef(false)

  const meta = LOADERS.find((entry) => entry.id === loader)
  const hasBuilds = meta?.hasBuilds ?? false
  const proxy = isProxyLoader(loader)

  /**
   * Максимум для ползунков памяти: 7/8 системной ОЗУ (1/8 всегда остаётся
   * операционной системе), выровненный вниз до шага 512 МБ.
   */
  const memoryLimitMb = useMemo(() => {
    const limit = info?.memoryLimitMb ?? MAX_MEMORY
    return Math.max(MIN_MEMORY, Math.floor(limit / 512) * 512)
  }, [info?.memoryLimitMb])

  useEffect(() => {
    if (!open) return
    const initialMax = clamp(
      Math.min(defaultMemoryMb, memoryLimitMb),
      MIN_MEMORY,
      memoryLimitMb
    )
    setName('')
    setNameTouched(false)
    setNameError(null)
    setLoader('paper')
    setMcVersion('')
    setLoaderVersion('')
    setVersionQuery('')
    setReleasesOnly(true)
    setJavaPath('')
    setMemoryMin(Math.min(1024, initialMax))
    setMemoryMax(initialMax)
    setPort('')
    setError(null)
    setLog([])
    setPercent(undefined)
    setCreating(false)
    creatingRef.current = false
  }, [open, defaultMemoryMb, memoryLimitMb])

  useEffect(() => {
    if (!open || nameTouched || !mcVersion) return
    setName(autoServerName(loader, mcVersion, servers))
  }, [open, nameTouched, loader, mcVersion, servers])

  useEffect(() => {
    if (!open) return
    let alive = true
    setLoadingVersions(true)
    setVersionsError(null)
    window.api.versions
      .minecraft(loader)
      .then((list) => {
        if (!alive) return
        setVersions(list)
        setMcVersion((previous) =>
          list.some((entry) => entry.id === previous)
            ? previous
            : (list.find((entry) => entry.type === 'release')?.id ?? list[0]?.id ?? '')
        )
      })
      .catch((caught) => {
        if (!alive) return
        setVersions([])
        setVersionsError(cleanError(caught))
      })
      .finally(() => {
        if (alive) setLoadingVersions(false)
      })
    return () => {
      alive = false
    }
  }, [open, loader])

  useEffect(() => {
    setLoaderVersion('')
    if (!open || !mcVersion) {
      setBuilds([])
      setBuildsError(null)
      return
    }
    if (!hasBuilds) {
      setBuilds([])
      setBuildsError(null)
      return
    }
    let alive = true
    setLoadingBuilds(true)
    setBuildsError(null)
    window.api.versions
      .loaderBuilds(loader, mcVersion)
      .then((list) => {
        if (!alive) return
        setBuilds(list)
      })
      .catch((caught) => {
        if (!alive) return
        setBuilds([])
        setBuildsError(cleanError(caught))
      })
      .finally(() => {
        if (alive) setLoadingBuilds(false)
      })
    return () => {
      alive = false
    }
  }, [open, loader, mcVersion, hasBuilds])

  useEffect(() => {
    if (!open || !mcVersion) {
      setJavaRequired(null)
      return
    }
    let alive = true
    window.api.versions
      .javaRequirement(loader, mcVersion)
      .then((major) => {
        if (alive) setJavaRequired(major)
      })
      .catch(() => {
        if (alive) setJavaRequired(null)
      })
    return () => {
      alive = false
    }
  }, [open, loader, mcVersion])

  useEffect(() => {
    if (!open) return
    return window.api.events.onProgress((event) => {
      if (!creatingRef.current) return
      if (event.scope !== 'install' && event.scope !== 'java') return
      if (event.scope === 'java' && event.serverId) return
      setPercent(event.percent)
      const line = event.message
      setLog((previous) =>
        previous[previous.length - 1] === line ? previous : [...previous.slice(-249), line]
      )
    })
  }, [open])

  const filteredVersions = useMemo(() => {
    const needle = versionQuery.trim().toLowerCase()
    return versions.filter((entry) => {
      const releaseOk =
        !releasesOnly || entry.type === 'release' || entry.type === 'unknown'
      if (!releaseOk) return false
      if (!needle) return true
      return entry.id.toLowerCase().includes(needle)
    })
  }, [versions, releasesOnly, versionQuery])

  const compatibleRuntime = javaRequired
    ? runtimes.find((runtime) => runtime.major === javaRequired) ??
      runtimes.find((runtime) => runtime.major >= javaRequired)
    : null
  const selectedRuntime = runtimes.find((runtime) => runtime.path === javaPath)

  const refreshVersions = async (): Promise<void> => {
    setLoadingVersions(true)
    setVersionsError(null)
    try {
      const list = await window.api.versions.minecraft(loader, true)
      setVersions(list)
      setMcVersion((previous) =>
        list.some((entry) => entry.id === previous)
          ? previous
          : (list.find((entry) => entry.type === 'release')?.id ?? list[0]?.id ?? '')
      )
    } catch (caught) {
      setVersionsError(cleanError(caught))
    } finally {
      setLoadingVersions(false)
    }
  }

  const create = async (): Promise<void> => {
    if (creatingRef.current) return
    const trimmed = name.trim()
    if (!trimmed) {
      setNameError(t('Введите название сервера'))
      return
    }
    setNameError(null)
    if (!mcVersion) {
      setError(t('Выберите версию Minecraft'))
      return
    }

    let portNumber: number | undefined
    if (port.trim()) {
      const parsed = Number(port)
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
        setError(t('Порт должен быть целым числом от 1 до 65535'))
        return
      }
      if (servers.some((server) => server.port === parsed)) {
        setError(t('Порт {port} уже занят другим сервером CraftPulse', { port: parsed }))
        return
      }
      portNumber = parsed
    }

    const memoryMaxMb = clamp(memoryMax, MIN_MEMORY, memoryLimitMb)
    const memoryMinMb = Math.min(
      clamp(memoryMin, MIN_MEMORY, memoryLimitMb),
      memoryMaxMb
    )
    const input: CreateServerInput = {
      name: trimmed,
      loader,
      mcVersion,
      loaderVersion: hasBuilds && loaderVersion ? loaderVersion : undefined,
      port: portNumber,
      memoryMinMb,
      memoryMaxMb,
      javaPath: javaPath || undefined,
      onlineMode: settings?.defaultOnlineMode ?? true
    }

    creatingRef.current = true
    setCreating(true)
    setError(null)
    setPercent(0)
    setLog([
      t('Создание «{name}» · {loader} {version}…', { name: trimmed, loader, version: mcVersion })
    ])

    try {
      const instance = await window.api.servers.create(input)
      setPercent(100)
      setLog((previous) => [...previous, t('Готово — сервер установлен')])
      onCreated(instance)
    } catch (caught) {
      const message = cleanError(caught)
      setError(message)
      setLog((previous) => [...previous, t('Ошибка: {message}', { message })])
    } finally {
      creatingRef.current = false
      setCreating(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      closeDisabled={creating}
      width="max-w-4xl"
      title={
        <span className="inline-flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent" />
          {t('Новый сервер')}
        </span>
      }
      subtitle={t('Выберите ядро, версию и параметры — CraftPulse скачает и настроит всё сам.')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={creating}>
            {t('Отмена')}
          </Button>
          <Button variant="primary" loading={creating} onClick={() => void create()}>
            {!creating ? <Sparkles className="h-4 w-4" /> : null}
            {creating ? t('Устанавливаем…') : t('Создать сервер')}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <Field
          label={t('Название сервера')}
          hint={t(
            'Подставляется автоматически по ядру и версии. Можно изменить — кириллица поддерживается.'
          )}
        >
          <input
            autoFocus
            value={name}
            onChange={(event) => {
              setName(event.target.value)
              setNameTouched(true)
              setNameError(null)
              setError(null)
            }}
            placeholder={t('Например, Дружеский ванильный')}
            maxLength={64}
            className={cn(
              'input',
              nameError &&
                'border-red-400/60 focus:border-red-400/70 focus:ring-red-400/20'
            )}
            disabled={creating}
          />
          {nameError ? (
            <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-red-300">
              <AlertTriangle className="h-3 w-3" />
              {nameError}
            </p>
          ) : null}
        </Field>

        <div>
          <p className="label mb-2">{t('Ядро сервера')}</p>
          <div className="space-y-3">
            {LOADER_GROUPS.map((group) => {
              const entries = LOADERS.filter((entry) => entry.group === group)
              if (!entries.length) return null
              return (
                <div key={group}>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                    {loaderGroupLabel(group, language)}
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                    {entries.map((entry) => {
                      const selected = entry.id === loader
                      return (
                        <button
                          key={entry.id}
                          type="button"
                          disabled={creating}
                          onClick={() => setLoader(entry.id)}
                          className={cn(
                            'rounded-xl border p-3 text-left transition disabled:opacity-50',
                            selected
                              ? 'bg-white/[0.05] shadow-sm'
                              : 'border-white/[0.06] bg-ink-950/40 hover:border-white/[0.14] hover:bg-white/[0.03]'
                          )}
                          style={
                            selected
                              ? {
                                  borderColor: `${entry.accent}77`,
                                  boxShadow: `inset 0 0 0 1px ${entry.accent}22`
                                }
                              : undefined
                          }
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span
                              className="text-[13px] font-semibold"
                              style={{ color: entry.accent }}
                            >
                              {entry.name}
                            </span>
                            {selected ? (
                              <CheckCircle2
                                className="h-3.5 w-3.5"
                                style={{ color: entry.accent }}
                              />
                            ) : null}
                          </div>
                          <p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-slate-500">
                            {loaderDescription(entry.id, language)}
                          </p>
                          <span className="mt-1.5 inline-flex rounded border border-white/[0.06] px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-slate-500">
                            {loaderHint(entry.id, language)}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-ink-950/30 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="label">{proxy ? t('Версия прокси') : t('Версия Minecraft')}</p>
              <p className="mt-0.5 text-[11px] text-slate-500">
                {t('Список загружен из официальных API · {count} версий', {
                  count: versions.length
                })}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 text-[11px] text-slate-400">
                <Toggle
                  checked={releasesOnly}
                  onChange={setReleasesOnly}
                  label={t('Только релизы')}
                />
                {t('Только релизы')}
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-600" />
                <input
                  value={versionQuery}
                  onChange={(event) => setVersionQuery(event.target.value)}
                  placeholder="1.21…"
                  spellCheck={false}
                  className="input w-32 py-1 pl-8 font-mono text-xs"
                />
              </div>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => void refreshVersions()}
                loading={loadingVersions}
              >
                {!loadingVersions ? <RefreshCw className="h-3 w-3" /> : null}
                {t('Обновить')}
              </Button>
            </div>
          </div>

          <div className="mt-3 rounded-lg border border-white/[0.05] bg-ink-950/60 p-1.5">
            {loadingVersions && versions.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-8 text-xs text-slate-500">
                <Spinner />
                {t('Загрузка версий {loader}…', { loader: meta?.name ?? loader })}
              </div>
            ) : versionsError ? (
              <div className="flex flex-col items-center gap-2 px-4 py-6 text-center">
                <AlertTriangle className="h-4 w-4 text-amber-400" />
                <p className="text-xs text-amber-200/80">{versionsError}</p>
                <Button variant="secondary" size="xs" onClick={() => void refreshVersions()}>
                  {t('Повторить')}
                </Button>
              </div>
            ) : filteredVersions.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-500">{t('Версии не найдены.')}</p>
            ) : (
              <div className="grid grid-cols-3 gap-1 sm:grid-cols-4 lg:grid-cols-6">
                {filteredVersions.map((entry) => {
                  const selected = entry.id === mcVersion
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      disabled={creating}
                      title={
                        entry.releaseTime
                          ? t('Релиз: {date}', { date: formatDate(Date.parse(entry.releaseTime)) })
                          : entry.id
                      }
                      onClick={() => setMcVersion(entry.id)}
                      className={cn(
                        'rounded-md border px-2 py-1.5 text-left font-mono text-[11px] transition',
                        selected
                          ? 'border-accent/50 bg-accent/10 text-accent'
                          : 'border-transparent text-slate-400 hover:bg-white/[0.05] hover:text-slate-200'
                      )}
                    >
                      <span className="block truncate">{entry.id}</span>
                      {entry.type !== 'release' ? (
                        <span className="block text-[9px] uppercase tracking-wide text-slate-600">
                          {entry.type}
                        </span>
                      ) : null}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-4 rounded-xl border border-white/[0.06] bg-ink-950/30 p-4">
            <div className="flex items-center gap-2">
              <Coffee className="h-4 w-4 text-accent/80" />
              <p className="label">{t('Java и сборка')}</p>
            </div>

            {hasBuilds ? (
              <Field
                label={t('Сборка ядра')}
                hint={
                  buildsError
                    ? buildsError
                    : builds.length
                      ? t('По умолчанию выбирается последняя стабильная сборка.')
                      : t('Список сборок загрузится после выбора версии.')
                }
              >
                <select
                  value={loaderVersion}
                  onChange={(event) => setLoaderVersion(event.target.value)}
                  className="input font-mono text-xs"
                  disabled={creating || loadingBuilds || builds.length === 0}
                >
                  <option value="">{t('Авто · последняя сборка')}</option>
                  {builds.slice(0, 120).map((build) => (
                    <option key={build} value={build}>
                      {build}
                    </option>
                  ))}
                </select>
              </Field>
            ) : (
              <p className="text-[11px] leading-relaxed text-slate-500">
                {t('Для этого ядра сборка определяется автоматически.')}
              </p>
            )}

            <Field
              label={t('Среда выполнения Java')}
              hint={
                compatibleRuntime
                  ? undefined
                  : settings?.autoDownloadJava
                    ? t('Подходящая Java не найдена — она будет скачана автоматически.')
                    : t('Подходящая Java не найдена. Включите автозагрузку в настройках приложения.')
              }
            >
              <select
                value={javaPath}
                onChange={(event) => setJavaPath(event.target.value)}
                className="input text-xs"
                disabled={creating}
              >
                <option value="">{t('Авто · подобрать по версии ядра')}</option>
                {runtimes.map((runtime) => (
                  <option key={runtime.path} value={runtime.path}>
                    Java {runtime.major} · {runtime.vendor} ·{' '}
                    {runtime.source === 'downloaded' ? 'CraftPulse' : t('система')}
                  </option>
                ))}
              </select>
            </Field>

            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-semibold',
                  compatibleRuntime
                    ? 'border-accent/25 bg-accent/10 text-accent'
                    : 'border-amber-400/25 bg-amber-400/10 text-amber-300'
                )}
              >
                <Coffee className="h-3 w-3" />
                {javaRequired
                  ? t('нужна Java {major}', { major: javaRequired })
                  : t('Java не определена')}
              </span>
              {selectedRuntime ? (
                <span className="text-slate-500">
                  {t('выбрана Java {major}', { major: selectedRuntime.major })}
                </span>
              ) : null}
            </div>

            {!compatibleRuntime && javaRequired && !settings?.autoDownloadJava ? (
              <p className="rounded-lg border border-amber-400/20 bg-amber-400/[0.06] px-2.5 py-2 text-[10px] leading-relaxed text-amber-200/80">
                {t(
                  'Установите Java {major} через настройки приложения или разрешите автозагрузку. Иначе создание сервера завершится ошибкой JAVA_REQUIRED.',
                  { major: javaRequired }
                )}
              </p>
            ) : null}

            {runtimes.length > 0 ? (
              <p className="text-[10px] text-slate-600">
                {t('Доступно {count} Java: {versions}', {
                  count: runtimes.length,
                  versions:
                    JAVA_VERSIONS.filter((major) =>
                      runtimes.some((runtime) => runtime.major === major)
                    ).join(', ') || t('другие версии')
                })}
              </p>
            ) : null}
          </div>

          <div className="space-y-4 rounded-xl border border-white/[0.06] bg-ink-950/30 p-4">
            <div className="flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-accent/80" />
              <p className="label">{t('Память и сеть')}</p>
            </div>

            <div>
              <div className="mb-1.5 flex items-baseline justify-between">
                <span className="text-[11px] font-medium text-slate-400">
                  {t('Максимум · -Xmx')}
                </span>
                <span className="font-mono text-xs text-slate-200">{formatMemory(memoryMax)}</span>
              </div>
              <input
                type="range"
                min={MIN_MEMORY}
                max={memoryLimitMb}
                step={512}
                value={clamp(memoryMax, memoryMin, memoryLimitMb)}
                onChange={(event) => {
                  const next = Number(event.target.value)
                  setMemoryMax(next)
                  setMemoryMin((previous) => Math.min(previous, next))
                }}
                disabled={creating}
                className="w-full"
              />
            </div>

            <div>
              <div className="mb-1.5 flex items-baseline justify-between">
                <span className="text-[11px] font-medium text-slate-400">
                  {t('Минимум · -Xms')}
                </span>
                <span className="font-mono text-xs text-slate-200">{formatMemory(memoryMin)}</span>
              </div>
              <input
                type="range"
                min={MIN_MEMORY}
                max={Math.max(MIN_MEMORY, memoryMax)}
                step={256}
                value={clamp(memoryMin, MIN_MEMORY, memoryMax)}
                onChange={(event) => setMemoryMin(Number(event.target.value))}
                disabled={creating}
                className="w-full"
              />
            </div>

            <p className="text-[10px] leading-relaxed text-slate-600">
              {info
                ? t(
                    'Ползунок ограничен {memory}: минимум 1/8 ОЗУ ({total}) всегда остаётся системе.',
                    {
                      memory: formatMemory(memoryLimitMb),
                      total: formatMemory(info.memoryTotalMb)
                    }
                  )
                : null}
            </p>

            <div className="flex items-center gap-2 rounded-lg border border-white/[0.05] bg-ink-950/50 px-3 py-2 font-mono text-[10px] text-slate-500">
              <Cpu className="h-3.5 w-3.5 shrink-0 text-slate-600" />
              -Xms{memoryMin}M -Xmx{memoryMax}M
            </div>

            <Field
              label={t('Порт')}
              hint={t('Оставьте пустым, чтобы CraftPulse выбрал свободный порт начиная с 25565.')}
            >
              <input
                value={port}
                onChange={(event) => setPort(event.target.value.replace(/[^\d]/g, ''))}
                placeholder={t('авто')}
                inputMode="numeric"
                className="input font-mono text-xs"
                disabled={creating}
              />
            </Field>
          </div>
        </div>

        {error ? (
          <div className="flex items-start gap-2.5 rounded-xl border border-red-400/20 bg-red-500/[0.07] px-4 py-3 text-xs text-red-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="min-w-0 flex-1 leading-relaxed">{error}</p>
          </div>
        ) : null}

        {creating || log.length > 0 ? (
          <div className="rounded-xl border border-white/[0.06] bg-ink-950/50 p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="label">{t('Журнал установки')}</span>
              {percent !== undefined ? (
                <span className="font-mono text-[11px] text-slate-500">{percent}%</span>
              ) : null}
            </div>
            <ProgressBar value={percent} />
            <div className="mt-2 font-mono text-[10.5px] leading-relaxed text-slate-500">
              {log.length === 0 ? (
                <p className="text-slate-600">{t('Ожидание…')}</p>
              ) : (
                log.map((line, index) => (
                  <p
                    key={`${index}-${line}`}
                    className={cn(
                      'truncate',
                      line.startsWith(t('Ошибка')) && 'text-red-300/90',
                      line === t('Готово — сервер установлен') && 'text-accent'
                    )}
                  >
                    {line}
                  </p>
                ))
              )}
            </div>
          </div>
        ) : null}
      </div>
    </Modal>
  )
}
