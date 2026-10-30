import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  FileCode2,
  Plus,
  RefreshCw,
  Save,
  X
} from 'lucide-react'
import type { PropertyEntry, ServerInstance } from '@shared/types'
import { cleanError } from '../../lib/errors'
import { cn } from '../../lib/format'
import {
  KNOWN_PROPERTY_KEYS,
  propertySections,
  type PropertyField
} from '../../lib/propertiesSchema'
import { useLauncher } from '../../state/LauncherContext'
import { Button, Field, Section, Spinner, Toggle } from '../ui'

function entriesToRecord(entries: PropertyEntry[]): Record<string, string> {
  const record: Record<string, string> = {}
  for (const entry of entries) record[entry.key] = entry.value
  return record
}

function PropertyInput({
  field,
  value,
  onChange
}: {
  field: PropertyField
  value: string
  onChange: (value: string) => void
}): JSX.Element {
  const { t } = useLauncher()
  if (field.type === 'boolean') {
    return (
      <div className="flex h-[38px] items-center justify-between rounded-lg border border-white/10 bg-ink-950/70 px-3">
        <span className="font-mono text-[11px] text-slate-500">{value || 'false'}</span>
        <Toggle checked={value === 'true'} onChange={(next) => onChange(next ? 'true' : 'false')} />
      </div>
    )
  }

  if (field.type === 'select') {
    const options = field.options ?? []
    const known = options.some((option) => option.value === value)
    return (
      <select value={value} onChange={(event) => onChange(event.target.value)} className="input">
        {!known && value ? (
          <option value={value}>{t('{value} (текущее)', { value })}</option>
        ) : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    )
  }

  return (
    <input
      type={field.type === 'number' ? 'number' : 'text'}
      value={value}
      min={field.min}
      max={field.max}
      step={field.step}
      placeholder={field.placeholder}
      onChange={(event) => onChange(event.target.value)}
      className={cn('input', field.type === 'number' && 'font-mono')}
      spellCheck={false}
    />
  )
}

export function PropertiesTab({ server }: { server: ServerInstance }): JSX.Element {
  const { statuses, refreshServers, notify, language, t } = useLauncher()
  const sections = useMemo(() => propertySections(language), [language])
  const status = statuses[server.id]?.status ?? 'stopped'
  const [values, setValues] = useState<Record<string, string>>({})
  const [original, setOriginal] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)
  const [newKey, setNewKey] = useState('')
  const [newValue, setNewValue] = useState('')

  const load = useCallback(
    async (silent = false): Promise<void> => {
      if (!silent) setLoading(true)
      setError(null)
      try {
        const entries = await window.api.servers.readProperties(server.id)
        const record = entriesToRecord(entries)
        setValues(record)
        setOriginal(record)
      } catch (caught) {
        setError(cleanError(caught))
      } finally {
        setLoading(false)
      }
    },
    [server.id]
  )

  useEffect(() => {
    void load()
  }, [load])

  const unknownKeys = useMemo(
    () => Object.keys(values).filter((key) => !KNOWN_PROPERTY_KEYS.has(key)).sort(),
    [values]
  )

  const dirty = useMemo(() => {
    const keys = new Set([...Object.keys(values), ...Object.keys(original)])
    for (const key of keys) {
      if ((values[key] ?? '') !== (original[key] ?? '')) return true
    }
    return false
  }, [values, original])

  const setValue = (key: string, value: string): void => {
    setValues((previous) => ({ ...previous, [key]: value }))
    setError(null)
  }

  const addKey = (): void => {
    const key = newKey.trim()
    if (!/^[A-Za-z0-9._-]+$/.test(key)) {
      setError(t('Ключ может содержать только латиницу, цифры, точку, дефис и подчёркивание'))
      return
    }
    if (key in values) {
      setError(t('Параметр «{key}» уже существует', { key }))
      return
    }
    setValues((previous) => ({ ...previous, [key]: newValue }))
    setNewKey('')
    setNewValue('')
    setError(null)
  }

  const save = async (): Promise<void> => {
    setSaving(true)
    setError(null)
    try {
      const portValue = values['server-port']
      if (portValue !== undefined && portValue !== '') {
        const port = Number(portValue)
        if (!Number.isInteger(port) || port < 1 || port > 65535) {
          throw new Error(t('server-port должен быть целым числом от 1 до 65535'))
        }
        if (port !== server.port) {
          await window.api.servers.update(server.id, { port })
        }
      }
      const entries = await window.api.servers.writeProperties(server.id, values)
      const record = entriesToRecord(entries)
      setValues(record)
      setOriginal(record)
      await refreshServers()
      notify(t('server.properties сохранён'), 'success')
    } catch (caught) {
      setError(cleanError(caught))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-sm text-slate-500">
        <Spinner />
        {t('Чтение server.properties…')}
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-2">
      <div className="card sticky top-0 z-10 flex flex-wrap items-center gap-3 p-4 backdrop-blur">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <FileCode2 className="h-4 w-4 text-accent/80" />
            <h3 className="text-sm font-semibold text-slate-100">server.properties</h3>
            <span className="chip font-mono text-[10px]">
              {t('{count} ключей', { count: Object.keys(values).length })}
            </span>
            {dirty ? (
              <span className="inline-flex items-center gap-1 text-[11px] text-amber-300">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                {t('не сохранено')}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] text-accent/80">
                <CheckCircle2 className="h-3 w-3" />
                {t('синхронизировано')}
              </span>
            )}
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
            {t(
              'Официальный файл конфигурации Minecraft. Перезапустите сервер, чтобы применить изменения.'
            )}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => void load()} disabled={saving}>
            <RefreshCw className="h-3.5 w-3.5" />
            {t('Перечитать')}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={!dirty || saving}
            onClick={() => {
              setValues(original)
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
            {t('Сохранить')}
          </Button>
        </div>
      </div>

      {status === 'running' || status === 'starting' ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-sky-400/20 bg-sky-400/[0.06] px-4 py-3 text-xs text-sky-200/90">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="min-w-0 flex-1 leading-relaxed">
            {t(
              'Сервер запущен. Большинство параметров server.properties применяются только после перезапуска.'
            )}
          </p>
        </div>
      ) : null}

      {error ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-400/20 bg-red-500/[0.07] px-4 py-3 text-xs text-red-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="min-w-0 flex-1 leading-relaxed">{error}</p>
        </div>
      ) : null}

      {sections.map((section) => (
        <Section key={section.title} title={section.title} description={section.description}>
          <div className="grid gap-3 md:grid-cols-2">
            {section.fields.map((field) => (
              <Field key={field.key} label={field.label} hint={field.hint}>
                <PropertyInput
                  field={field}
                  value={values[field.key] ?? ''}
                  onChange={(value) => setValue(field.key, value)}
                />
                <span className="font-mono text-[10px] text-slate-600">{field.key}</span>
              </Field>
            ))}
          </div>
        </Section>
      ))}

      <Section
        title={t('Дополнительные параметры')}
        description={t(
          'Ключи, которых нет в визуальном редакторе: параметры плагинов, модов и новых версий Minecraft.'
        )}
        actions={
          <Button variant="ghost" size="xs" onClick={() => setShowAll((previous) => !previous)}>
            <ChevronDown
              className={cn('h-3.5 w-3.5 transition', showAll && 'rotate-180')}
            />
            {showAll
              ? t('Свернуть')
              : t('Показать ({count})', { count: unknownKeys.length })}
          </Button>
        }
      >
        {showAll ? (
          <>
            {unknownKeys.length === 0 ? (
              <p className="rounded-lg border border-dashed border-white/[0.08] px-4 py-5 text-center text-xs text-slate-500">
                {t('Неизвестных ключей нет.')}
              </p>
            ) : (
              <div className="space-y-2">
                {unknownKeys.map((key) => (
                  <div key={key} className="flex items-center gap-2">
                    <span className="w-[46%] shrink-0 truncate rounded-lg border border-white/[0.06] bg-ink-950/50 px-3 py-2 font-mono text-[11px] text-slate-400">
                      {key}
                    </span>
                    <input
                      value={values[key] ?? ''}
                      onChange={(event) => setValue(key, event.target.value)}
                      className="input flex-1 py-1.5 font-mono text-xs"
                      spellCheck={false}
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 rounded-lg border border-white/[0.06] bg-ink-950/40 p-3">
              <p className="label mb-2">{t('Добавить параметр')}</p>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={newKey}
                  onChange={(event) => setNewKey(event.target.value)}
                  placeholder={t('ключ')}
                  spellCheck={false}
                  className="input w-48 font-mono text-xs"
                />
                <input
                  value={newValue}
                  onChange={(event) => setNewValue(event.target.value)}
                  placeholder={t('значение')}
                  spellCheck={false}
                  className="input min-w-[160px] flex-1 font-mono text-xs"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!newKey.trim()}
                  onClick={addKey}
                >
                  <Plus className="h-3.5 w-3.5" />
                  {t('Добавить')}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <p className="text-xs text-slate-500">
            {unknownKeys.length === 0
              ? t('Все ключи файла покрыты редактором выше.')
              : t(
                  'Скрыто ключей: {count}. Разверните, чтобы редактировать любые параметры вручную.',
                  { count: unknownKeys.length }
                )}
          </p>
        )}
      </Section>

      <div className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-ink-900/70 px-4 py-3">
        <div className="flex items-center gap-2 text-[11px] text-slate-500">
          <X className="h-3.5 w-3.5" />
          {t('Пустые значения записываются как есть — проверяйте синтаксис.')}
        </div>
        <Button
          variant="primary"
          size="sm"
          loading={saving}
          disabled={!dirty}
          onClick={() => void save()}
        >
          {!saving ? <Save className="h-3.5 w-3.5" /> : null}
          {t('Сохранить файл')}
        </Button>
      </div>
    </div>
  )
}
