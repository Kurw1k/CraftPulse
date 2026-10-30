import { useEffect, useState } from 'react'
import {
  Coffee,
  Cpu,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FolderOpen,
  Github,
  HardDrive,
  Info,
  KeyRound,
  RefreshCw,
  Save,
  UserRound
} from 'lucide-react'
import type { AppSettings } from '@shared/types'
import { LANGUAGES } from '@shared/i18n'
import { cleanError } from '../../lib/errors'
import { cn, formatMemory } from '../../lib/format'
import { useLauncher } from '../../state/LauncherContext'
import { Button, Field, Modal, ProgressBar, Section, Spinner, Toggle } from '../ui'

const JAVA_VERSIONS = [8, 17, 21, 25]
const MIN_MEMORY = 512
const MAX_MEMORY = 65536

export function AppSettingsModal({
  open,
  onClose
}: {
  open: boolean
  onClose: () => void
}): JSX.Element | null {
  const {
    settings,
    paths,
    info,
    runtimes,
    refreshRuntimes,
    saveSettings,
    notify,
    t
  } = useLauncher()
  const [form, setForm] = useState<AppSettings | null>(null)
  const [saving, setSaving] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [javaBusy, setJavaBusy] = useState<number | null>(null)
  const [javaProgress, setJavaProgress] = useState<{ message: string; percent?: number } | null>(
    null
  )

  useEffect(() => {
    if (open && settings) {
      setForm({ ...settings })
      setShowKey(false)
      setJavaProgress(null)
    }
  }, [open, settings])

  useEffect(() => {
    if (!open) return
    return window.api.events.onProgress((event) => {
      if (event.scope !== 'java' || event.serverId) return
      setJavaProgress({ message: event.message, percent: event.percent })
    })
  }, [open])

  if (!open) return null

  /** 7/8 ОЗУ: как минимум 1/8 всегда остаётся системе. */
  const memoryLimitMb = Math.max(
    MIN_MEMORY,
    Math.floor((info?.memoryLimitMb ?? MAX_MEMORY) / 512) * 512
  )

  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]): void => {
    setForm((previous) => (previous ? { ...previous, [key]: value } : previous))
  }

  const save = async (): Promise<void> => {
    if (!form) return
    setSaving(true)
    const next = await saveSettings({
      ...form,
      curseforgeApiKey: form.curseforgeApiKey.trim(),
      defaultMemoryMb: Math.min(
        memoryLimitMb,
        Math.max(MIN_MEMORY, Math.round(form.defaultMemoryMb))
      )
    })
    setSaving(false)
    if (next) onClose()
  }

  const openPath = async (target: string): Promise<void> => {
    try {
      await window.api.app.openPath(target)
    } catch (error) {
      notify(cleanError(error), 'error')
    }
  }

  const downloadJava = async (major: number): Promise<void> => {
    setJavaBusy(major)
    setJavaProgress({ message: t('Подготовка Java {major}…', { major }) })
    try {
      const runtime = await window.api.java.install(major)
      await refreshRuntimes()
      notify(t('Eclipse Temurin {major} установлена', { major: runtime.major }), 'success')
    } catch (error) {
      notify(cleanError(error), 'error')
    } finally {
      setJavaBusy(null)
      setJavaProgress(null)
    }
  }

  const dataPaths = paths
    ? [
        { label: t('Корень данных'), value: paths.root },
        { label: t('Серверы'), value: paths.servers },
        { label: 'Java runtimes', value: paths.runtimes },
        { label: t('Версии'), value: paths.versions },
        { label: t('Кэш'), value: paths.cache },
        { label: t('Логи'), value: paths.logs }
      ]
    : []

  return (
    <Modal
      open={open}
      onClose={onClose}
      closeDisabled={saving}
      width="max-w-3xl"
      title={t('Настройки приложения')}
      subtitle={t('Пути данных, Java, память по умолчанию и интеграции.')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            {t('Отмена')}
          </Button>
          <Button
            variant="primary"
            loading={saving}
            disabled={!form}
            onClick={() => void save()}
          >
            {!saving ? <Save className="h-4 w-4" /> : null}
            {t('Сохранить')}
          </Button>
        </>
      }
    >
      {!form ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
          <Spinner />
          {t('Загрузка настроек…')}
        </div>
      ) : (
        <div className="space-y-4">
          <Section
            title={t('Язык интерфейса')}
            description={t('Применяется после сохранения и сразу переключает весь интерфейс.')}
          >
            <Field label={t('Язык')}>
              <select
                value={form.language}
                onChange={(event) =>
                  update('language', event.target.value as AppSettings['language'])
                }
                className="input max-w-xs"
              >
                {LANGUAGES.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
          </Section>

          <Section
            title={t('Пути данных')}
            description={t(
              'Все файлы CraftPulse хранятся изолированно от других лаунчеров и Minecraft.'
            )}
          >
            <div className="space-y-1.5">
              {dataPaths.map((entry) => (
                <div
                  key={entry.label}
                  className="flex items-center gap-2 rounded-lg border border-white/[0.05] bg-ink-950/40 px-3 py-2"
                >
                  <FolderOpen className="h-3.5 w-3.5 shrink-0 text-slate-600" />
                  <span className="w-28 shrink-0 text-[11px] font-medium text-slate-400">
                    {entry.label}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-mono text-[10.5px] text-slate-600">
                    {entry.value}
                  </span>
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => void openPath(entry.value)}
                  >
                    {t('Открыть')}
                  </Button>
                </div>
              ))}
            </div>
          </Section>

          <Section
            title={t('Память по умолчанию')}
            description={t(
              'Значение -Xmx для новых серверов. Можно изменить для каждого сервера отдельно.'
            )}
          >
            <div className="flex flex-wrap items-center gap-4">
              <div className="min-w-[220px] flex-1">
                <input
                  type="range"
                  min={MIN_MEMORY}
                  max={memoryLimitMb}
                  step={512}
                  value={Math.min(memoryLimitMb, Math.max(MIN_MEMORY, form.defaultMemoryMb))}
                  onChange={(event) => update('defaultMemoryMb', Number(event.target.value))}
                  className="w-full"
                />
                <div className="mt-1 flex justify-between text-[10px] text-slate-600">
                  <span>{formatMemory(MIN_MEMORY)}</span>
                  <span>{formatMemory(memoryLimitMb)}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <HardDrive className="h-4 w-4 text-slate-600" />
                <span className="w-20 text-right font-mono text-sm text-slate-200">
                  {formatMemory(form.defaultMemoryMb)}
                </span>
                <input
                  type="number"
                  min={MIN_MEMORY}
                  max={memoryLimitMb}
                  step={512}
                  value={form.defaultMemoryMb}
                  onChange={(event) => update('defaultMemoryMb', Number(event.target.value))}
                  className="input w-28 py-1.5 font-mono text-xs"
                />
                <span className="text-[11px] text-slate-600">{t('МБ')}</span>
              </div>
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-slate-600">
              {info ? (
                <>
                  {t('Рекомендуется {memory} — 25% от {total} ОЗУ.', {
                    memory: formatMemory(info.memoryRecommendedMb),
                    total: formatMemory(info.memoryTotalMb)
                  })}{' '}
                  {t('Максимум {memory}: 1/8 ОЗУ всегда остаётся системе.', {
                    memory: formatMemory(memoryLimitMb)
                  })}
                </>
              ) : null}
            </p>
          </Section>

          <Section
            title={t('Modrinth и CurseForge')}
            description={t('Modrinth работает без ключа. Для CurseForge нужен личный API-ключ.')}
            actions={
              <button
                type="button"
                onClick={() => void window.api.app.openExternal('https://console.curseforge.com/')}
                className="inline-flex items-center gap-1 text-[11px] text-slate-500 transition hover:text-slate-300"
              >
                {t('Получить ключ')}
                <ExternalLink className="h-3 w-3" />
              </button>
            }
          >
            <Field
              label="CurseForge API key"
              hint={t(
                'Ключ хранится локально в settings.json и отправляется только на api.curseforge.com.'
              )}
            >
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-600" />
                <input
                  type={showKey ? 'text' : 'password'}
                  value={form.curseforgeApiKey}
                  onChange={(event) => update('curseforgeApiKey', event.target.value)}
                  placeholder="$2a$10$…"
                  spellCheck={false}
                  autoComplete="off"
                  className="input py-2 pl-8 pr-10 font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((previous) => !previous)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-600 transition hover:text-slate-300"
                  aria-label={showKey ? t('Скрыть ключ') : t('Показать ключ')}
                >
                  {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </Field>
          </Section>

          <Section
            title="Java"
            description={t(
              'CraftPulse определяет системные JVM и умеет скачивать Eclipse Temurin в папку runtimes.'
            )}
            actions={
              <Button variant="ghost" size="xs" onClick={() => void refreshRuntimes()}>
                <RefreshCw className="h-3 w-3" />
                {t('Обновить')}
              </Button>
            }
          >
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-3">
                <Field label={t('Java по умолчанию')}>
                  <select
                    value={form.defaultJavaPath}
                    onChange={(event) => update('defaultJavaPath', event.target.value)}
                    className="input text-xs"
                  >
                    <option value="">{t('Авто · по версии Minecraft')}</option>
                    {form.defaultJavaPath &&
                    !runtimes.some((runtime) => runtime.path === form.defaultJavaPath) ? (
                      <option value={form.defaultJavaPath}>
                        {t('Текущий · {path}', { path: form.defaultJavaPath })}
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

                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-white/[0.06] bg-ink-950/40 px-3 py-2.5">
                  <Toggle
                    checked={form.autoDownloadJava}
                    onChange={(value) => update('autoDownloadJava', value)}
                    label={t('Скачивать Java автоматически')}
                  />
                  <span className="min-w-0">
                    <span className="block text-xs font-medium text-slate-300">
                      {t('Скачивать Java автоматически')}
                    </span>
                    <span className="mt-0.5 block text-[10px] leading-relaxed text-slate-500">
                      {t(
                        'Если для версии Minecraft нет подходящей JVM, CraftPulse загрузит Temurin.'
                      )}
                    </span>
                  </span>
                </label>
              </div>

              <div className="space-y-2">
                <p className="label">{t('Установить Temurin JDK')}</p>
                <div className="flex flex-wrap gap-2">
                  {JAVA_VERSIONS.map((major) => {
                    const installed = runtimes.some((runtime) => runtime.major === major)
                    return (
                      <Button
                        key={major}
                        variant="secondary"
                        size="sm"
                        loading={javaBusy === major}
                        disabled={javaBusy !== null || installed}
                        onClick={() => void downloadJava(major)}
                      >
                        {javaBusy !== major ? <Download className="h-3.5 w-3.5" /> : null}
                        {installed ? `Java ${major} ✓` : `Temurin ${major}`}
                      </Button>
                    )
                  })}
                </div>

                {javaProgress ? (
                  <div className="rounded-lg border border-white/[0.06] bg-ink-950/60 px-3 py-2">
                    <div className="flex items-center justify-between gap-3 text-[10.5px] text-slate-400">
                      <span className="truncate">{javaProgress.message}</span>
                      {javaProgress.percent !== undefined ? (
                        <span className="shrink-0 font-mono text-slate-500">
                          {javaProgress.percent}%
                        </span>
                      ) : null}
                    </div>
                    <ProgressBar value={javaProgress.percent} className="mt-1.5" />
                  </div>
                ) : null}

                <div className="max-h-36 space-y-1 overflow-y-auto">
                  {runtimes.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-white/[0.08] px-3 py-4 text-center text-[10.5px] text-slate-500">
                      {t('Java не найдена.')}
                    </p>
                  ) : (
                    runtimes.map((runtime) => (
                      <div
                        key={runtime.path}
                        className="flex items-center gap-2 rounded-md border border-white/[0.05] bg-ink-950/40 px-2.5 py-1.5 text-[10.5px]"
                      >
                        <Coffee className="h-3 w-3 shrink-0 text-slate-600" />
                        <span className="shrink-0 font-semibold text-slate-300">
                          Java {runtime.major}
                        </span>
                        <span className="truncate font-mono text-slate-600">{runtime.version}</span>
                        <span className="ml-auto shrink-0 chip text-[9px]">
                          {runtime.source === 'downloaded' ? 'CraftPulse' : t('система')}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </Section>

          <Section
            title={t('Каналы обновлений модов и плагинов')}
            description={t(
              'Какие типы версий предлагать при поиске и обновлении модов/плагинов (Modrinth, CurseForge).'
            )}
          >
            <div className="flex flex-wrap gap-3">
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/[0.06] bg-ink-950/40 px-3 py-2">
                <input
                  type="checkbox"
                  checked={form.releaseChannels.includes('release')}
                  onChange={(event) => {
                    const next = [...form.releaseChannels]
                    if (event.target.checked) next.push('release')
                    else {
                      const idx = next.indexOf('release')
                      if (idx >= 0) next.splice(idx, 1)
                    }
                    update('releaseChannels', next)
                  }}
                  className="h-4 w-4 rounded border-white/[0.2] bg-ink-900 text-accent focus:ring-accent/20"
                />
                <span className="text-sm text-slate-200">{t('Релизы')}</span>
                <span className="ml-auto text-[10px] text-slate-500">{t('Стабильные версии')}</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/[0.06] bg-ink-950/40 px-3 py-2">
                <input
                  type="checkbox"
                  checked={form.releaseChannels.includes('beta')}
                  onChange={(event) => {
                    const next = [...form.releaseChannels]
                    if (event.target.checked) next.push('beta')
                    else {
                      const idx = next.indexOf('beta')
                      if (idx >= 0) next.splice(idx, 1)
                    }
                    update('releaseChannels', next)
                  }}
                  className="h-4 w-4 rounded border-white/[0.2] bg-ink-900 text-amber-400 focus:ring-amber-400/20"
                />
                <span className="text-sm text-slate-200">{t('Беты')}</span>
                <span className="ml-auto text-[10px] text-slate-500">{t('Бета-версии')}</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/[0.06] bg-ink-950/40 px-3 py-2">
                <input
                  type="checkbox"
                  checked={form.releaseChannels.includes('alpha')}
                  onChange={(event) => {
                    const next = [...form.releaseChannels]
                    if (event.target.checked) next.push('alpha')
                    else {
                      const idx = next.indexOf('alpha')
                      if (idx >= 0) next.splice(idx, 1)
                    }
                    update('releaseChannels', next)
                  }}
                  className="h-4 w-4 rounded border-white/[0.2] bg-ink-900 text-red-400 focus:ring-red-400/20"
                />
                <span className="text-sm text-slate-200">{t('Альфы')}</span>
                <span className="ml-auto text-[10px] text-slate-500">{t('Альфа-версии')}</span>
              </label>
            </div>
          </Section>

          <Section
            title={t('online-mode по умолчанию')}
            description={t(
              'Значение online-mode в server.properties для новых серверов. Можно изменить для каждого сервера отдельно в его настройках.'
            )}
          >
            <div className="grid gap-2 sm:grid-cols-2">
              <label className={cn('flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition',
                  form.defaultOnlineMode
                    ? 'border-emerald-400/40 bg-emerald-400/[0.06]'
                    : 'border-white/[0.06] bg-ink-950/40 hover:border-white/[0.14]'
                )}>
                <input
                  type="radio"
                  name="defaultOnlineMode"
                  checked={form.defaultOnlineMode}
                  onChange={() => update('defaultOnlineMode', true)}
                  className="h-4 w-4 text-emerald-400 border-white/[0.2] bg-ink-900 focus:ring-emerald-400/20"
                />
                <div>
                  <span className="block text-sm font-medium text-slate-100">{t('Лицензия (online-mode=true)')}</span>
                  <span className="mt-0.5 block text-[10px] leading-relaxed text-slate-500">
                    {t('Только лицензионные клиенты могут подключиться. Рекомендуется для публичных серверов.')}
                  </span>
                </div>
              </label>
              <label className={cn('flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition',
                  !form.defaultOnlineMode
                    ? 'border-amber-400/40 bg-amber-400/[0.06]'
                    : 'border-white/[0.06] bg-ink-950/40 hover:border-white/[0.14]'
                )}>
                <input
                  type="radio"
                  name="defaultOnlineMode"
                  checked={!form.defaultOnlineMode}
                  onChange={() => update('defaultOnlineMode', false)}
                  className="h-4 w-4 text-amber-400 border-white/[0.2] bg-ink-900 focus:ring-amber-400/20"
                />
                <div>
                  <span className="block text-sm font-medium text-slate-100">{t('Пиратский лаунчер (online-mode=false)')}</span>
                  <span className="mt-0.5 block text-[10px] leading-relaxed text-slate-500">
                    {t('Пиратские клиенты смогут подключиться. Не используйте на публичных серверах.')}
                  </span>
                </div>
              </label>
            </div>
          </Section>

          <Section
            title={t('О приложении')}
            description={t('CraftPulse — локальный менеджер Minecraft-серверов.')}
          >
            <div className="grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-3">
              {[
                { label: t('Версия'), value: info ? `v${info.version}` : '—', icon: <Info className="h-3 w-3" /> },
                { label: 'Electron', value: info?.electron ?? '—', icon: <Cpu className="h-3 w-3" /> },
                { label: 'Node.js', value: info?.node ?? '—', icon: <Cpu className="h-3 w-3" /> },
                {
                  label: t('Платформа'),
                  value: info ? `${info.platform} · ${info.arch}` : '—',
                  icon: <HardDrive className="h-3 w-3" />
                }
              ].map((entry) => (
                <div
                  key={entry.label}
                  className="rounded-lg border border-white/[0.05] bg-ink-950/40 px-2.5 py-2"
                >
                  <span className="flex items-center gap-1 text-[9px] uppercase tracking-wide text-slate-600">
                    {entry.icon}
                    {entry.label}
                  </span>
                  <span className="mt-0.5 block truncate font-mono text-[11px] text-slate-300">
                    {entry.value}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-3 grid gap-2 rounded-lg border border-white/[0.05] bg-ink-950/40 px-3 py-2.5 text-[11px] sm:grid-cols-2">
              <div className="min-w-0">
                <span className="flex items-center gap-1 text-[9px] uppercase tracking-wide text-slate-600">
                  <UserRound className="h-3 w-3" />
                  {t('Разработчик')}
                </span>
                <button
                  type="button"
                  onClick={() => void window.api.app.openExternal('https://github.com/Kurw1k')}
                  title="https://github.com/Kurw1k"
                  className="mt-1 inline-flex items-center gap-1 font-semibold text-slate-200 transition hover:text-accent focus:text-accent focus:outline-none"
                >
                  Kurw1k
                  <ExternalLink className="h-3 w-3" />
                </button>
              </div>
              <div className="min-w-0">
                <span className="flex items-center gap-1 text-[9px] uppercase tracking-wide text-slate-600">
                  <Github className="h-3 w-3" />
                  {t('Проект')}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    void window.api.app.openExternal('https://github.com/Kurw1k/CraftPulse')
                  }
                  title="https://github.com/Kurw1k/CraftPulse"
                  className="mt-1 inline-flex items-center gap-1 font-semibold text-slate-200 transition hover:text-accent focus:text-accent focus:outline-none"
                >
                  CraftPulse
                  <ExternalLink className="h-3 w-3" />
                </button>
              </div>
            </div>
            <p className={cn('mt-3 font-mono text-[10px] text-slate-700')}>
              {info?.root ?? ''}
            </p>
          </Section>
        </div>
      )}
    </Modal>
  )
}
