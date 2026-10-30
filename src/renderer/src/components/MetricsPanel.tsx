import { Coffee, Cpu, MemoryStick, Timer } from 'lucide-react'
import type { MetricsSnapshot, ServerInstance, ServerStatus } from '@shared/types'
import { useLauncher } from '../state/LauncherContext'
import { cn, formatDuration, formatMemory } from '../lib/format'

function Sparkline({ values, color }: { values: number[]; color: string }): JSX.Element {
  const width = 100
  const height = 28
  const data = values.length ? values : [0, 0]
  const max = Math.max(20, ...data, 100)

  const points = data.map((value, index) => {
    const x = data.length === 1 ? width : (index / (data.length - 1)) * width
    const y = height - Math.min(1, Math.max(0, value / max)) * (height - 3) - 1.5
    return [x, y] as const
  })

  const line = points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ')
  const area = `${line} L${width},${height} L0,${height} Z`

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="h-8 w-full overflow-visible"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`spark-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#spark-${color.replace('#', '')})`} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="1.4"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

function MetricCard({
  label,
  icon,
  children,
  footer
}: {
  label: string
  icon: JSX.Element
  children: JSX.Element
  footer?: JSX.Element
}): JSX.Element {
  return (
    <div className="panel flex min-w-0 flex-col gap-2 p-3.5">
      <div className="flex items-center justify-between">
        <span className="label">{label}</span>
        <span className="text-slate-600">{icon}</span>
      </div>
      {children}
      {footer}
    </div>
  )
}

export function MetricsPanel({
  server,
  status,
  statusInfo
}: {
  server: ServerInstance
  status: ServerStatus
  statusInfo?: { startedAt?: number }
}): JSX.Element {
  const { metrics, t } = useLauncher()
  const series: MetricsSnapshot[] = (metrics[server.id] ?? []).slice(-60)
  const last = series[series.length - 1]
  const active = status === 'running' || status === 'starting'
  const cpu = active ? last?.cpuPercent ?? 0 : 0
  const used = active ? last?.rssMb ?? 0 : 0
  const allocated = last?.allocatedMb ?? server.memoryMaxMb
  const ramPercent = allocated > 0 ? Math.min(100, (used / allocated) * 100) : 0
  const uptime = active
    ? last?.uptimeMs ?? (statusInfo?.startedAt ? Date.now() - statusInfo.startedAt : 0)
    : 0

  const cpuColor = cpu >= 85 ? '#f87171' : cpu >= 60 ? '#fbbf24' : '#4ade80'
  const ramColor = ramPercent >= 85 ? '#f87171' : ramPercent >= 65 ? '#fbbf24' : '#8b8cf7'

  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <MetricCard
        label={t('CPU процесса')}
        icon={<Cpu className="h-3.5 w-3.5" />}
        footer={
          <div className="mt-0.5">
            <Sparkline values={series.map((snapshot) => snapshot.cpuPercent)} color={cpuColor} />
          </div>
        }
      >
        <div className="flex items-baseline gap-1">
          <span className="text-xl font-semibold tabular-nums text-slate-100">
            {cpu.toFixed(1)}
          </span>
          <span className="text-xs text-slate-500">%</span>
          {active ? (
            <span className="ml-auto text-[10px] text-slate-600">{t('100% = 1 ядро')}</span>
          ) : null}
        </div>
      </MetricCard>

      <MetricCard
        label={t('Оперативная память')}
        icon={<MemoryStick className="h-3.5 w-3.5" />}
        footer={
          <div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-700">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.max(1, ramPercent)}%`, backgroundColor: ramColor }}
              />
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-slate-600">
              <span>{t('{percent}% от Xmx', { percent: Math.round(ramPercent) })}</span>
              <span className="font-mono">-Xmx{server.memoryMaxMb}M</span>
            </div>
          </div>
        }
      >
        <div className="flex items-baseline gap-1">
          <span className="text-xl font-semibold tabular-nums text-slate-100">
            {formatMemory(used)}
          </span>
          <span className="text-xs text-slate-500">/ {formatMemory(allocated)}</span>
        </div>
      </MetricCard>

      <MetricCard
        label={t('Аптайм')}
        icon={<Timer className="h-3.5 w-3.5" />}
        footer={
          <div className="flex items-center justify-between text-[10px] text-slate-600">
            <span className="font-mono">PID {last?.pid ?? '—'}</span>
            <span className="font-mono">:{server.port}</span>
          </div>
        }
      >
        <span className="text-xl font-semibold tabular-nums text-slate-100">
          {formatDuration(uptime)}
        </span>
      </MetricCard>

      <MetricCard
        label={t('Java / ядро')}
        icon={<Coffee className="h-3.5 w-3.5" />}
        footer={
          <div className="flex items-center justify-between text-[10px] text-slate-600">
            <span className="font-mono">Xms {server.memoryMinMb}M</span>
            <span className="font-mono">Xmx {server.memoryMaxMb}M</span>
          </div>
        }
      >
        <div className="flex items-baseline gap-1.5">
          <span className="text-xl font-semibold tabular-nums text-slate-100">
            {server.javaMajor ? `Java ${server.javaMajor}` : t('Java авто')}
          </span>
          <span className="ml-auto truncate text-[10px] text-slate-600">
            {server.loaderVersion ?? server.mcVersion}
          </span>
        </div>
      </MetricCard>
    </div>
  )
}
