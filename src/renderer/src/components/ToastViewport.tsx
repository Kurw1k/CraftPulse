import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import type { Toast } from '../state/LauncherContext'
import { useLauncher } from '../state/LauncherContext'

const ICONS = {
  info: Info,
  success: CheckCircle2,
  error: AlertTriangle
}

const TONES = {
  info: 'border-sky-400/20 bg-sky-400/[0.07] text-sky-200',
  success: 'border-accent/25 bg-accent/[0.08] text-accent-bright',
  error: 'border-red-400/25 bg-red-500/[0.09] text-red-200'
}

export function ToastViewport({
  toasts,
  onDismiss
}: {
  toasts: Toast[]
  onDismiss: (id: string) => void
}): JSX.Element {
  const { t } = useLauncher()
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[100] flex w-[380px] max-w-[calc(100vw-40px)] flex-col gap-2">
      {toasts.map((toast) => {
        const Icon = ICONS[toast.tone]
        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 rounded-xl border px-3.5 py-3 text-sm shadow-2xl backdrop-blur-md animate-slide-up ${TONES[toast.tone]}`}
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="min-w-0 flex-1 leading-snug">{toast.message}</p>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              className="rounded p-0.5 text-current opacity-50 transition hover:opacity-100"
              aria-label={t('Закрыть уведомление')}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
