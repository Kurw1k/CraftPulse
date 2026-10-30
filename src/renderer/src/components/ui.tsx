import { useEffect, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Loader2, X } from 'lucide-react'
import type { LoaderType, ServerStatus } from '@shared/types'
import { LOADERS, serverStatusLabel } from '@shared/types'
import { cn } from '../lib/format'
import { useLauncher } from '../state/LauncherContext'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: 'md' | 'sm' | 'xs'
  loading?: boolean
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
  success: 'btn-success'
}

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  className,
  children,
  disabled,
  ...props
}: ButtonProps): JSX.Element {
  return (
    <button
      type="button"
      className={cn(
        VARIANTS[variant],
        size === 'sm' && 'px-3 py-1.5 text-xs',
        size === 'xs' && 'btn-xs',
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {children}
    </button>
  )
}

export function IconButton({
  label,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }): JSX.Element {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={cn(
        'inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.03] text-slate-400 transition hover:border-white/15 hover:bg-white/[0.07] hover:text-slate-100 disabled:pointer-events-none disabled:opacity-40',
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}

export function Modal({
  open = true,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = 'max-w-2xl',
  closeDisabled = false
}: {
  open?: boolean
  onClose: () => void
  title: ReactNode
  subtitle?: ReactNode
  children: ReactNode
  footer?: ReactNode
  width?: string
  closeDisabled?: boolean
}): JSX.Element | null {
  const { t } = useLauncher()
  useEffect(() => {
    if (!open) return
    const handler = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && !closeDisabled) onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose, closeDisabled])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-5">
      <div
        className="absolute inset-0 bg-black/65 backdrop-blur-[3px] animate-fade-in"
        onClick={() => {
          if (!closeDisabled) onClose()
        }}
      />
      <div
        className={cn(
          'relative flex max-h-[90vh] w-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-ink-850 shadow-[0_40px_120px_-30px_rgba(0,0,0,0.9)] animate-slide-up',
          width
        )}
        role="dialog"
        aria-modal="true"
      >
        <header className="flex items-start justify-between gap-6 border-b border-white/[0.06] px-6 py-5">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
            {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={closeDisabled}
            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-white/[0.06] hover:text-slate-200 disabled:opacity-30"
            aria-label={t('Закрыть')}
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer ? (
          <footer className="flex items-center justify-end gap-2 border-t border-white/[0.06] bg-ink-900/60 px-6 py-4">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  )
}

export function Field({
  label,
  hint,
  children,
  className
}: {
  label: ReactNode
  hint?: ReactNode
  children: ReactNode
  className?: string
}): JSX.Element {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <span className="label">{label}</span>
      {children}
      {hint ? <span className="text-[11px] leading-relaxed text-slate-500">{hint}</span> : null}
    </div>
  )
}

export function Toggle({
  checked,
  onChange,
  label,
  disabled = false
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label?: string
  disabled?: boolean
}): JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-5 w-9 shrink-0 rounded-full border border-white/10 transition disabled:opacity-40',
        checked ? 'bg-accent/90' : 'bg-ink-600'
      )}
    >
      <span
        className={cn(
          'absolute top-[2px] h-4 w-4 rounded-full transition-all',
          checked ? 'left-[18px] bg-ink-950' : 'left-[2px] bg-slate-300'
        )}
      />
    </button>
  )
}

const STATUS_STYLES: Record<ServerStatus, string> = {
  running: 'border-accent/25 bg-accent/10 text-accent',
  starting: 'border-amber-400/25 bg-amber-400/10 text-amber-300',
  stopping: 'border-orange-400/25 bg-orange-400/10 text-orange-300',
  crashed: 'border-red-400/25 bg-red-400/10 text-red-300',
  stopped: 'border-white/10 bg-white/[0.04] text-slate-400'
}

export function StatusBadge({ status }: { status: ServerStatus }): JSX.Element {
  const { language } = useLauncher()
  const animated = status === 'running' || status === 'starting' || status === 'stopping'
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold',
        STATUS_STYLES[status]
      )}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full bg-current',
          animated && 'animate-pulseglow'
        )}
      />
      {serverStatusLabel(status, language)}
    </span>
  )
}

export function LoaderBadge({ loader }: { loader: LoaderType }): JSX.Element {
  const meta = LOADERS.find((entry) => entry.id === loader)
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold"
      style={{
        color: meta?.accent ?? '#94a3b8',
        borderColor: `${meta?.accent ?? '#94a3b8'}33`,
        backgroundColor: `${meta?.accent ?? '#94a3b8'}12`
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-sm"
        style={{ backgroundColor: meta?.accent ?? '#94a3b8' }}
      />
      {meta?.name ?? loader}
    </span>
  )
}

export function Spinner({ className }: { className?: string }): JSX.Element {
  return <Loader2 className={cn('h-4 w-4 animate-spin text-slate-400', className)} />
}

export function ProgressBar({
  value,
  className
}: {
  value?: number
  className?: string
}): JSX.Element {
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-ink-700', className)}>
      <div
        className={cn(
          'h-full rounded-full bg-gradient-to-r from-emerald-500 to-accent transition-all duration-300',
          value === undefined && 'w-1/3 animate-pulse'
        )}
        style={value !== undefined ? { width: `${Math.max(2, Math.min(100, value))}%` } : undefined}
      />
    </div>
  )
}

export interface SegmentedOption<T extends string> {
  value: T
  label: ReactNode
  icon?: ReactNode
  disabled?: boolean
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className
}: {
  value: T
  onChange: (value: T) => void
  options: Array<SegmentedOption<T>>
  className?: string
}): JSX.Element {
  return (
    <div className={cn('inline-flex rounded-lg border border-white/[0.07] bg-ink-950/60 p-0.5', className)}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          disabled={option.disabled}
          onClick={() => onChange(option.value)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition disabled:opacity-30',
            value === option.value
              ? 'bg-white/[0.09] text-slate-100 shadow-sm'
              : 'text-slate-500 hover:text-slate-300'
          )}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function Section({
  title,
  description,
  children,
  actions,
  className
}: {
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  actions?: ReactNode
  className?: string
}): JSX.Element {
  return (
    <section className={cn('card p-5', className)}>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
          {description ? <p className="mt-1 text-xs leading-relaxed text-slate-500">{description}</p> : null}
        </div>
        {actions}
      </div>
      {children}
    </section>
  )
}
