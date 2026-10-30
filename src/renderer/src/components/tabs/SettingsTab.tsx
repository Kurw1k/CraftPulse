import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Coffee,
  Download,
  FolderOpen,
  HardDrive,
  RefreshCw,
  Save,
  Trash2
} from 'lucide-react'
import type { ServerInstance } from '@shared/types'
import { isProxyLoader } from '@shared/types'
import { LANGUAGES, type Language } from '@shared/i18n'
import { cleanError } from '../../lib/errors'
import { cn, formatDate, formatMemory } from '../../lib/format'
import { useLauncher } from '../../state/LauncherContext'
import { Button, Field, ProgressBar, Section, Spinner, Toggle } from '../ui'

const MIN_MEMORY = 512
const MAX_MEMORY = 65536
const JAVA_VERSIONS = [8, 17, 21, 25]

interface FormState {
  name: string
  notes: string
  memoryMin: number
  memoryMax: number
  port: string
  javaPath: string
}

function toForm(server: ServerInstance): FormState {
  return {
    name: server.name,
    notes: server.notes ?? '',
    memoryMin: server.memoryMinMb,
    memoryMax: server.memoryMaxMb,
    port: String(server.port),
    javaPath: server.javaPath ?? ''
  }
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, Math.round(value)))
}

export function SettingsTab({
  server,
  onDeleted
}: {
  server: ServerInstance
  onDeleted: (id: string) => void
}): JSX.Element {
  const {
    runtimes,
    refreshRuntimes,
    refreshServers,
    notify,
    settings,
    info,
    saveSettings,
    language,
    t
  } = useLauncher()
  const [form, setForm] = useState<FormState>(() => toForm(server))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [javaRequired, setJavaRequired] = useState<number | null>(null)
  const [javaBusy, setJavaBusy] = useState<number | null>(null)
  const [javaProgress, setJavaProgress] = useState<{ message: string; percent?: number } | null>(
    null
  )
  const [eulaBusy, setEulaBusy] = useState(false)
  const [onlineBusy, setOnlineBusy] = useState(false)
  const [deleteArmed, setDeleteArmed] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const proxy = isProxyLoader(server.loader)
  const onlineMode = server.onlineMode ?? true

  /** 7/8 ОЗУ: как минимум 1/8 всегда остаётся системе, 100% выделить нельзя. */
  const memoryLimitMb = Math.max(
    MIN_MEMORY,
    Math.floor((info?.memoryLimitMb ?? MAX_MEMORY) / 512) * 512
  )

  useEffect(() => {
    setForm((previous) => {
      const memoryMax = Math.min(previous.memoryMax, memoryLimitMb)
      const memoryMin = Math.min(previous.memoryMin, memoryMax)
      return memoryMax === previous.memoryMax && memoryMin === previous.memoryMin
        ? previous
        : { ...previous, memoryMax, memoryMin }
    })
  }, [memoryLimitMb])

  useEffect(() => {
    setForm(toForm(server))
    setError(null)
    setDeleteArmed(false)
  }, [server.id, server.updatedAt])

  useEffect(() => {
    let alive = true
    window.api.versions
      .javaRequirement(server.loader, server.mcVersion)
      .then((major) => {
        if (alive) setJavaRequired(major)
      })
      .catch(() => {
        if (alive) setJavaRequired(null)
      })
    return () => {
      alive = false
    }
  }, [server.loader, server.mcVersion])

  useEffect(() => {
    return window.api.events.onProgress((event) => {
      if (event.scope !== 'java') return
      if (event.serverId && event.serverId !== server.id) return
      setJavaProgress({ message: event.message, percent: event.percent })
    })
  }, [server.id])

  const update = <K extends keyof FormState>(key: K, value: FormState[K]): void => {
    setForm((previous) => ({ ...previous, [key]: value }))
    setError(null)
  }

  const dirty =
    form.name !== server.name ||
    form.notes !== (server.notes ?? '') ||
    form.memoryMin !== server.memoryMinMb ||
    form.memoryMax !== server.memoryMaxMb ||
    form.port !== String(server.port) ||
    form.javaPath !== (server.javaPath ?? '')

  const save = async (): Promise<void> => {
    const name = form.name.trim()
    if (!name) {
      setError(t('Название сервера не может быть пустым'))
      return
    }
    const port = Number(form.port)
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      setError(t('Порт должен быть целым числом от 1 до 65535'))
      return
    }
    const memoryMin = clamp(form.memoryMin, MIN_MEMORY, memoryLimitMb)
    const memoryMax = clamp(form.memoryMax, MIN_MEMORY, memoryLimitMb)
    if (memoryMin > memoryMax) {
      setError(t('Минимальный объём памяти не может превышать максимальный'))
      return
    }

    setSaving(true)
    setError(null)
    try {
      await window.api.servers.update(server.id, {
        name,
        notes: form.notes,
        memoryMinMb: memoryMin,
        memoryMaxMb: memoryMax,
        port,
        javaPath: form.javaPath
      })
      await refreshServers()
      notify(t('Настройки сервера сохранены'), 'success')
    } catch (caught) {
      setError(cleanError(caught))
    } finally {
      setSaving(false)
    }
  }

  const downloadJava = async (major: number): Promise<void> => {
    setJavaBusy(major)
    setJavaProgress({ message: t('Подготовка Java {major}…', { major }) })
    try {
      const runtime = await window.api.java.install(major)
      await refreshRuntimes()
      update('javaPath', runtime.path)
      notify(
        t('Eclipse Temurin {major} установлена. Сохраните настройки сервера.', {
          major: runtime.major
        }),
        'success'
      )
    } catch (caught) {
      notify(cleanError(caught), 'error')
    } finally {
      setJavaBusy(null)
      setJavaProgress(null)
    }
  }

  const acceptEula = async (): Promise<void> => {
    setEulaBusy(true)
    try {
      await window.api.servers.acceptEula(server.id)
      await refreshServers()
      notify(t('Minecraft EULA принят'), 'success')
    } catch (caught) {
      notify(cleanError(caught), 'error')
    } finally {
      setEulaBusy(false)
    }
  }

  const setOnlineMode = async (next: boolean): Promise<void> => {
    setOnlineBusy(true)
    try {
      await window.api.servers.update(server.id, { onlineMode: next })
      await refreshServers()
      notify(
        next
          ? t('Online mode включён — только лицензионные клиенты')
          : t('Online mode отключён — пиратские клиенты смогут подключиться'),
        'success'
      )
    } catch (caught) {
      notify(cleanError(caught), 'error')
    } finally {
      setOnlineBusy(false)
    }
  }

  const remove = async (): Promise<void> => {
    setDeleting(true)
    try {
      await window.api.servers.remove(server.id)
      notify(t('Сервер «{name}» удалён', { name: server.name }), 'success')
      onDeleted(server.id)
    } catch (caught) {
      notify(cleanError(caught), 'error')
      setDeleting(false)
    }
  }

  const openFolder = async (): Promise<void> => {
    try {
      await window.api.servers.openFolder(server.id)
    } catch (caught) {
      notify(cleanError(caught), 'error')
    }
  }

  const compatibleRuntime = javaRequired
    ? runtimes.find((runtime) => runtime.major === javaRequired) ??
      runtimes.find((runtime) => runtime.major >= javaRequired)
    : null
  const selectedRuntime = runtimes.find((runtime) => runtime.path === form.javaPath)
  const storedPathMissing = form.javaPath && !selectedRuntime

  return (
    <div className="space-y-4 pb-2">
      {error ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-400/20 bg-red-500/[0.07] px-4 py-3 text-xs text-red-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="min-w-0 flex-1 leading-relaxed">{error}</p>
        </div>
      ) : null}

      <Section
        title={t('Основные параметры')}
        description={t(
          'Название, заметки и сетевой порт. Изменения применяются при следующем запуске.'
        )}
        actions={
          <Button variant="secondary" size="sm" onClick={() => void openFolder()}>
            <FolderOpen className="h-3.5 w-3.5" />
            {t('Папка')}
          </Button>
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={t('Название сервера')}>
            <input
              value={form.name}
              onChange={(event) => update('name', event.target.value)}
              maxLength={64}
              className="input"
            />
          </Field>
          <Field label={t('Порт сервера')} hint={t('Записывается в server-port при сохранении.')}>
            <input
              value={form.port}
              onChange={(event) => update('port', event.target.value.replace(/[^\d]/g, ''))}
              inputMode="numeric"
              className="input font-mono"
            />
          </Field>
          <Field
            label={t('Заметки')}
            className="md:col-span-2"
            hint={t('До 2000 символов, хранится только в CraftPulse.')}
          >
            <textarea
              value={form.notes}
              onChange={(event) => update('notes', event.target.value)}
              rows={3}
              maxLength={2000}
              placeholder={t('Плагины, пароли, договорённости с игроками…')}
              className="input resize-none"
            />
          </Field>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
          <span className="chip font-mono">id: {server.id}</span>
          <span className="chip">{t('создан {date}', { date: formatDate(server.createdAt) })}</span>
          <span className="chip">
            {server.loader} {server.mcVersion}
          </span>
          {server.loaderVersion ? <span className="chip font-mono">build {server.loaderVersion}</span> : null}
        </div>
      </Section>

      <Section
        title={t('Оперативная память')}
        description={t(
          'Флаги -Xms и -Xmx для JVM. Не выделяйте больше, чем позволяет свободная RAM.'
        )}
      >
        <div className="space-y-5">
          <div>
            <div className="mb-2 flex items-baseline justify-between">
              <span className="label">{t('Минимум · -Xms')}</span>
              <span className="font-mono text-xs text-slate-300">
                {formatMemory(form.memoryMin)}
              </span>
            </div>
            <input
              type="range"
              min={MIN_MEMORY}
              max={Math.max(MIN_MEMORY, form.memoryMax)}
              step={256}
              value={clamp(form.memoryMin, MIN_MEMORY, form.memoryMax)}
              onChange={(event) => update('memoryMin', Number(event.target.value))}
              className="w-full"
            />
          </div>
          <div>
            <div className="mb-2 flex items-baseline justify-between">
              <span className="label">{t('Максимум · -Xmx')}</span>
              <span className="font-mono text-xs text-slate-300">
                {formatMemory(form.memoryMax)}
              </span>
            </div>
            <input
              type="range"
              min={MIN_MEMORY}
              max={memoryLimitMb}
              step={512}
              value={clamp(form.memoryMax, form.memoryMin, memoryLimitMb)}
              onChange={(event) => {
                const next = Number(event.target.value)
                update('memoryMax', next)
                if (form.memoryMin > next) update('memoryMin', next)
              }}
              className="w-full"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('Минимум, МБ')}>
              <input
                type="number"
                min={MIN_MEMORY}
                max={Math.max(MIN_MEMORY, form.memoryMax)}
                step={256}
                value={form.memoryMin}
                onChange={(event) => update('memoryMin', Number(event.target.value))}
                className="input font-mono"
              />
            </Field>
            <Field label={t('Максимум, МБ')}>
              <input
                type="number"
                min={MIN_MEMORY}
                max={memoryLimitMb}
                step={256}
                value={form.memoryMax}
                onChange={(event) => update('memoryMax', Number(event.target.value))}
                className="input font-mono"
              />
            </Field>
          </div>
          <p className="text-[11px] leading-relaxed text-slate-600">
            {t(
              'Максимум {memory}: 1/8 ОЗУ всегда остаётся системе.',
              { memory: formatMemory(memoryLimitMb) }
            )}
          </p>
          <div className="flex items-center gap-2 rounded-lg border border-white/[0.05] bg-ink-950/50 px-3 py-2 text-[11px] text-slate-500">
            <HardDrive className="h-3.5 w-3.5 text-slate-600" />
            {t('Итоговые флаги:')}{' '}
            <span className="font-mono text-slate-400">-Xms{form.memoryMin}M -Xmx{form.memoryMax}M</span>
          </div>
        </div>
      </Section>

      <Section
        title="Java"
        description={
          javaRequired
            ? t('Для Minecraft {version} нужна Java {major} или новее.', {
                version: server.mcVersion,
                major: javaRequired
              })
            : t('Среда выполнения для серверного ядра.')
        }
        actions={
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold',
              compatibleRuntime
                ? 'border-accent/25 bg-accent/10 text-accent'
                : 'border-amber-400/25 bg-amber-400/10 text-amber-300'
            )}
          >
            <Coffee className="h-3 w-3" />
            {javaRequired ? t('нужна Java {major}', { major: javaRequired }) : t('версия неизвестна')}
          </span>
        }
      >
        <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
          <Field
            label={t('Среда выполнения')}
            hint={
              compatibleRuntime
                ? undefined
                : settings?.autoDownloadJava
                  ? t('Подходящая Java не найдена — CraftPulse скачает её автоматически при запуске.')
                  : t('Подходящая Java не найдена, а автозагрузка отключена. Установите её ниже.')
            }
          >
            <select
              value={form.javaPath}
              onChange={(event) => update('javaPath', event.target.value)}
              className="input"
            >
              <option value="">{t('Авто · подобрать по версии ядра')}</option>
              {storedPathMissing ? (
                <option value={form.javaPath}>
                  {t('Текущий путь · {path}', { path: form.javaPath })}
                </option>
              ) : null}
              {runtimes.map((runtime) => (
                <option key={runtime.path} value={runtime.path}>
                  Java {runtime.major} · {runtime.vendor} ·{' '}
                  {runtime.source === 'downloaded' ? 'CraftPulse' : t('система')}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex flex-wrap items-end gap-2 lg:justify-end">
            {JAVA_VERSIONS.map((major) => (
              <Button
                key={major}
                variant="secondary"
                size="sm"
                loading={javaBusy === major}
                disabled={javaBusy !== null || runtimes.some((runtime) => runtime.major === major)}
                onClick={() => void downloadJava(major)}
              >
                {javaBusy !== major ? <Download className="h-3.5 w-3.5" /> : null}
                {runtimes.some((runtime) => runtime.major === major)
                  ? `Java ${major} ✓`
                  : `Temurin ${major}`}
              </Button>
            ))}
          </div>
        </div>

        {javaProgress ? (
          <div className="mt-3 rounded-lg border border-white/[0.06] bg-ink-950/60 px-3 py-2">
            <div className="flex items-center justify-between gap-3 text-[11px] text-slate-400">
              <span className="truncate">{javaProgress.message}</span>
              {javaProgress.percent !== undefined ? (
                <span className="shrink-0 font-mono text-slate-500">{javaProgress.percent}%</span>
              ) : null}
            </div>
            <ProgressBar value={javaProgress.percent} className="mt-1.5" />
          </div>
        ) : null}

        <div className="mt-4 space-y-1.5">
          {runtimes.length === 0 ? (
            <p className="text-[11px] text-slate-600">
              {t('Java не найдена. Установите Temurin кнопкой выше.')}
            </p>
          ) : (
            runtimes.map((runtime) => (
              <div
                key={runtime.path}
                className="flex items-center gap-2 rounded-lg border border-white/[0.05] bg-ink-950/40 px-3 py-2 text-[11px]"
              >
                <Coffee className="h-3.5 w-3.5 shrink-0 text-slate-600" />
                <span className="shrink-0 font-semibold text-slate-300">Java {runtime.major}</span>
                <span className="truncate font-mono text-slate-600">{runtime.path}</span>
                <span className="ml-auto shrink-0 chip text-[10px]">
                  {runtime.source === 'downloaded' ? 'CraftPulse' : t('система')}
                </span>
              </div>
            ))
          )}
          <button
            type="button"
            onClick={() => void refreshRuntimes()}
            className="mt-1 inline-flex items-center gap-1 text-[11px] text-slate-500 transition hover:text-slate-300"
          >
            <RefreshCw className="h-3 w-3" />
            {t('Переопределить установленные Java')}
          </button>
        </div>
      </Section>

      {proxy ? (
        <Section
          title={t('Лицензия и online mode')}
          description={t(
            'Прокси не проверяет лицензию игроков — этот параметр задаётся на backend-серверах сети.'
          )}
        >
          <div className="flex items-start gap-2.5 rounded-xl border border-white/[0.05] bg-ink-950/40 px-4 py-3 text-[11px] leading-relaxed text-slate-500">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-600" />
            <p>
              {t('Настройте')} <span className="font-mono text-slate-400">online-mode</span>{' '}
              {t('в server.properties каждого сервера, к которому подключается прокси.')}
            </p>
          </div>
        </Section>
      ) : (
        <Section
          title={t('Лицензия и online mode')}
          description={t('Проверка лицензии Mojang. Отключайте только для пиратских клиентов.')}
          actions={
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold',
                onlineMode
                  ? 'border-accent/25 bg-accent/10 text-accent'
                  : 'border-amber-400/25 bg-amber-400/10 text-amber-300'
              )}
            >
              {onlineMode ? 'online-mode=true' : 'online-mode=false'}
            </span>
          }
        >
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.05] bg-ink-950/40 px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-200">{t('Проверять лицензию игроков')}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                {onlineMode
                  ? t('Пиратские клиенты не смогут подключиться к серверу.')
                  : t(
                      'Сервер принимает клиенты без лицензии. Любой игрок может выдать себя за другого.'
                    )}
              </p>
            </div>
            <Toggle
              checked={onlineMode}
              onChange={(next) => void setOnlineMode(next)}
              disabled={onlineBusy}
              label="Online mode"
            />
          </div>
          {onlineMode ? (
            <p className="mt-3 flex items-start gap-2 rounded-lg border border-amber-400/20 bg-amber-400/[0.06] px-3 py-2 text-[11px] leading-relaxed text-amber-200/80">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {t(
                'Если вы играете через пиратский лаунчер, отключите online mode — иначе подключение будет отклонено.'
              )}
            </p>
          ) : null}
        </Section>
      )}

      {!proxy ? (
        <Section
          title="Minecraft EULA"
          description={t(
            'Официальное лицензионное соглашение Mojang, обязательное для запуска сервера.'
          )}
        actions={
          server.eulaAccepted ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/25 bg-accent/10 px-2.5 py-1 text-[11px] font-semibold text-accent">
              <CheckCircle2 className="h-3 w-3" />
              {t('принят')}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/25 bg-amber-400/10 px-2.5 py-1 text-[11px] font-semibold text-amber-300">
              <AlertTriangle className="h-3 w-3" />
              {t('не принят')}
            </span>
          )
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          {!server.eulaAccepted ? (
            <Button variant="primary" size="sm" loading={eulaBusy} onClick={() => void acceptEula()}>
              <CheckCircle2 className="h-3.5 w-3.5" />
              {t('Принять EULA')}
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void window.api.app.openExternal('https://aka.ms/MinecraftEULA')}
          >
            {t('Открыть текст EULA')}
          </Button>
          <span className="font-mono text-[10px] text-slate-600">eula.txt</span>
        </div>
      </Section>
      ) : null}

      <Section
        title={t('Интерфейс')}
        description={t('Общие параметры CraftPulse, одинаковые для всех серверов.')}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.05] bg-ink-950/40 px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-200">{t('Язык интерфейса')}</p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              {t('Применяется сразу и сохраняется в настройках приложения.')}
            </p>
          </div>
          <select
            value={language}
            onChange={(event) =>
              void saveSettings({ language: event.target.value as Language })
            }
            className="input max-w-[180px]"
          >
            {LANGUAGES.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </Section>

      <Section
        title={t('Опасная зона')}
        description={t(
          'Удаление стирает папку сервера: мир, конфигурации, моды и логи CraftPulse для этого сервера.'
        )}
      >
        {!deleteArmed ? (
          <Button variant="danger" onClick={() => setDeleteArmed(true)}>
            <Trash2 className="h-4 w-4" />
            {t('Удалить сервер')}
          </Button>
        ) : (
          <div className="rounded-xl border border-red-500/25 bg-red-500/[0.06] p-4">
            <p className="text-sm font-semibold text-red-200">
              {t('Удалить «{name}» навсегда?', { name: server.name })}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-red-200/70">
              {t(
                'Действие необратимо. Если сервер запущен, он будет принудительно остановлен.'
              )}
            </p>
            <div className="mt-3 flex items-center gap-2">
              <Button variant="danger" loading={deleting} onClick={() => void remove()}>
                <Trash2 className="h-4 w-4" />
                {t('Да, удалить сервер')}
              </Button>
              <Button
                variant="ghost"
                disabled={deleting}
                onClick={() => setDeleteArmed(false)}
              >
                {t('Отмена')}
              </Button>
            </div>
          </div>
        )}
      </Section>

      <div className="sticky bottom-0 z-10 -mx-1 flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-ink-900/95 px-4 py-3 backdrop-blur">
        <div className="flex min-w-0 items-center gap-2 text-[11px] text-slate-500">
          {saving ? (
            <>
              <Spinner className="h-3.5 w-3.5" />
              {t('Сохранение…')}
            </>
          ) : dirty ? (
            <>
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              {t('Есть несохранённые изменения')}
            </>
          ) : (
            <>
              <CheckCircle2 className="h-3.5 w-3.5 text-accent/70" />
              {t('Все изменения сохранены')}
            </>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={!dirty || saving}
            onClick={() => {
              setForm(toForm(server))
              setError(null)
            }}
          >
            {t('Сбросить')}
          </Button>
          <Button
            variant="primary"
            size="sm"
            loading={saving}
            disabled={!dirty}
            onClick={() => void save()}
          >
            {!saving ? <Save className="h-3.5 w-3.5" /> : null}
            {t('Сохранить настройки')}
          </Button>
        </div>
      </div>
    </div>
  )
}
