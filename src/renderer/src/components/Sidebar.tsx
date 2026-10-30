import { useMemo, useState } from 'react'
import { Boxes, FolderOpen, Plus, Search, Settings2, Sparkles } from 'lucide-react'
import type { ServerInstance, ServerStatusInfo } from '@shared/types'
import { cn } from '../lib/format'
import { useLauncher } from '../state/LauncherContext'
import { LoaderBadge } from './ui'

const DOT_STYLES: Record<string, string> = {
  running: 'bg-accent shadow-[0_0_8px_rgba(74,222,128,0.7)]',
  starting: 'bg-amber-400 animate-pulse',
  stopping: 'bg-orange-400 animate-pulse',
  crashed: 'bg-red-400',
  stopped: 'bg-slate-600'
}

export function Sidebar({
  servers,
  statuses,
  activeId,
  version,
  onSelect,
  onCreate,
  onSettings,
  onOpenFolder
}: {
  servers: ServerInstance[]
  statuses: Record<string, ServerStatusInfo>
  activeId: string | null
  version: string
  onSelect: (id: string) => void
  onCreate: () => void
  onSettings: () => void
  onOpenFolder: (id: string) => void
}): JSX.Element {
  const { t } = useLauncher()
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return servers
    return servers.filter(
      (server) =>
        server.name.toLowerCase().includes(needle) ||
        server.mcVersion.includes(needle) ||
        server.loader.includes(needle)
    )
  }, [servers, query])

  return (
    <aside className="flex w-[286px] shrink-0 flex-col border-r border-white/[0.06] bg-ink-900/70 backdrop-blur-sm">
      <div className="flex items-center gap-3 px-5 pb-4 pt-5">
        <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-accent/25 to-emerald-500/5 ring-1 ring-accent/30">
          <Boxes className="h-5 w-5 text-accent" />
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-accent shadow-[0_0_10px_rgba(74,222,128,0.9)]" />
        </div>
        <div className="min-w-0">
          <h1 className="text-[15px] font-bold tracking-tight text-slate-100">CraftPulse</h1>
          <p className="text-[11px] font-medium text-slate-500">Minecraft server launcher</p>
        </div>
      </div>

      <div className="px-4">
        <button
          type="button"
          onClick={onCreate}
          className="group flex w-full items-center justify-center gap-2 rounded-xl border border-accent/25 bg-accent/[0.09] px-3 py-2.5 text-sm font-semibold text-accent transition hover:border-accent/40 hover:bg-accent/[0.14]"
        >
          <Plus className="h-4 w-4 transition group-hover:rotate-90" />
          {t('Новый сервер')}
        </button>
      </div>

      <div className="px-4 pt-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-600" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('Поиск серверов…')}
            className="w-full rounded-lg border border-white/[0.06] bg-ink-950/60 py-1.5 pl-8 pr-3 text-xs text-slate-200 placeholder:text-slate-600 outline-none transition focus:border-accent/30"
          />
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between px-5">
        <span className="label">{t('Серверы · {count}', { count: servers.length })}</span>
      </div>

      <nav className="mt-1 flex-1 overflow-y-auto px-2.5 pb-3">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <Sparkles className="h-5 w-5 text-slate-700" />
            <p className="text-xs leading-relaxed text-slate-600">
              {servers.length === 0
                ? t('Пока нет серверов. Создайте первый — это займёт пару минут.')
                : t('Ничего не найдено.')}
            </p>
          </div>
        ) : (
          <ul className="space-y-1">
            {filtered.map((server) => {
              const status = statuses[server.id]?.status ?? 'stopped'
              const active = server.id === activeId
              return (
                <li key={server.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => onSelect(server.id)}
                    className={cn(
                      'w-full rounded-xl border px-3 py-2.5 text-left transition',
                      active
                        ? 'border-white/10 bg-white/[0.06] shadow-sm'
                        : 'border-transparent hover:border-white/[0.06] hover:bg-white/[0.03]'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', DOT_STYLES[status])} />
                      <span
                        className={cn(
                          'min-w-0 flex-1 truncate text-[13px] font-semibold',
                          active ? 'text-slate-100' : 'text-slate-300'
                        )}
                      >
                        {server.name}
                      </span>
                      <span className="shrink-0 font-mono text-[10px] text-slate-600">
                        :{server.port}
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-1.5 pl-3.5">
                      <LoaderBadge loader={server.loader} />
                      <span className="truncate font-mono text-[10px] text-slate-500">
                        {server.mcVersion}
                      </span>
                    </div>
                  </button>
                  <button
                    type="button"
                    title={t('Открыть папку сервера')}
                    onClick={(event) => {
                      event.stopPropagation()
                      onOpenFolder(server.id)
                    }}
                    className="absolute right-1.5 top-1/2 hidden h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg bg-ink-800 text-slate-400 ring-1 ring-white/10 transition hover:text-slate-100 group-hover:flex"
                  >
                    <FolderOpen className="h-3.5 w-3.5" />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </nav>

      <div className="border-t border-white/[0.06] p-3">
        <button
          type="button"
          onClick={onSettings}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-slate-400 transition hover:bg-white/[0.05] hover:text-slate-200"
        >
          <Settings2 className="h-4 w-4" />
          {t('Настройки приложения')}
          <span className="ml-auto font-mono text-[10px] text-slate-600">v{version}</span>
        </button>
      </div>
    </aside>
  )
}
