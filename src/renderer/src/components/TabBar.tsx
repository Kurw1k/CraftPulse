import { Plus, Settings2, X } from 'lucide-react'
import type { ServerInstance, ServerStatusInfo } from '@shared/types'
import { cn } from '../lib/format'
import { useLauncher } from '../state/LauncherContext'

const DOT_STYLES: Record<string, string> = {
  running: 'bg-accent',
  starting: 'bg-amber-400 animate-pulse',
  stopping: 'bg-orange-400 animate-pulse',
  crashed: 'bg-red-400',
  stopped: 'bg-slate-600'
}

export function TabBar({
  servers,
  statuses,
  activeId,
  openIds,
  onSelect,
  onClose,
  onCreate,
  onSettings
}: {
  servers: ServerInstance[]
  statuses: Record<string, ServerStatusInfo>
  activeId: string | null
  openIds: string[]
  onSelect: (id: string) => void
  onClose: (id: string) => void
  onCreate: () => void
  onSettings: () => void
}): JSX.Element {
  const { t } = useLauncher()
  const tabs = openIds
    .map((id) => servers.find((server) => server.id === id))
    .filter((server): server is ServerInstance => Boolean(server))

  return (
    <div className="flex h-12 shrink-0 items-center gap-1 border-b border-white/[0.06] bg-ink-900/40 px-2">
      <div className="no-scrollbar flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
        {tabs.map((server) => {
          const status = statuses[server.id]?.status ?? 'stopped'
          const active = server.id === activeId
          return (
            <div
              key={server.id}
              className={cn(
                'group flex h-8 max-w-[220px] shrink-0 items-center gap-2 rounded-lg border px-2.5 transition',
                active
                  ? 'border-white/10 bg-white/[0.07] text-slate-100'
                  : 'border-transparent text-slate-500 hover:bg-white/[0.04] hover:text-slate-300'
              )}
            >
              <button
                type="button"
                onClick={() => onSelect(server.id)}
                className="flex min-w-0 flex-1 items-center gap-2"
              >
                <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', DOT_STYLES[status])} />
                <span className="truncate text-xs font-medium">{server.name}</span>
              </button>
              <button
                type="button"
                title={t('Закрыть вкладку')}
                onClick={() => onClose(server.id)}
                className="rounded p-0.5 text-slate-600 opacity-0 transition hover:bg-white/10 hover:text-slate-300 group-hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )
        })}
        <button
          type="button"
          onClick={onCreate}
          title={t('Новый сервер')}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-600 transition hover:bg-white/[0.05] hover:text-slate-300"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <button
        type="button"
        onClick={onSettings}
        title={t('Настройки приложения')}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white/[0.06] hover:text-slate-200"
      >
        <Settings2 className="h-4 w-4" />
      </button>
    </div>
  )
}
