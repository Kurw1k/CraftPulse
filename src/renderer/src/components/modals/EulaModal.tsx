import { useState } from 'react'
import { AlertTriangle, CheckCircle2, ExternalLink } from 'lucide-react'
import type { ServerInstance } from '@shared/types'
import { cleanError } from '../../lib/errors'
import { useLauncher } from '../../state/LauncherContext'
import { Button, Modal } from '../ui'

export function EulaModal({
  server,
  startAfter,
  onClose,
  onAccepted
}: {
  server: ServerInstance
  startAfter: boolean
  onClose: () => void
  onAccepted: () => void
}): JSX.Element {
  const { notify, t } = useLauncher()
  const [checked, setChecked] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const accept = async (): Promise<void> => {
    if (!checked || busy) return
    setBusy(true)
    setError(null)
    try {
      await window.api.servers.acceptEula(server.id)
      notify(t('EULA принят — можно запускать сервер'), 'success')
      onAccepted()
    } catch (caught) {
      setError(cleanError(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      closeDisabled={busy}
      width="max-w-xl"
      title="Minecraft End User License Agreement"
      subtitle={t('Перед запуском «{name}» нужно принять EULA Mojang.', { name: server.name })}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {t('Отмена')}
          </Button>
          <Button variant="primary" loading={busy} disabled={!checked} onClick={() => void accept()}>
            <CheckCircle2 className="h-4 w-4" />
            {startAfter ? t('Принять и запустить') : t('Принять EULA')}
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-sm leading-relaxed text-slate-400">
        <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-4 py-3 text-xs text-amber-200/90">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              {t(
                'Сервер Minecraft распространяется по лицензии Mojang. Приняв соглашение, вы подтверждаете, что ознакомились с его условиями и согласны с ними.'
              )}
            </p>
          </div>
        </div>

        <ol className="list-decimal space-y-2 pl-5 text-xs text-slate-500">
          <li>{t('Прочитайте текст лицензии на официальном сайте Mojang.')}</li>
          <li>
            {t('Подтвердите согласие — CraftPulse запишет')}{' '}
            <span className="font-mono text-slate-300">eula=true</span>{' '}
            {t('в eula.txt.')}
          </li>
          <li>{t('После этого сервер можно запускать без дополнительных подтверждений.')}</li>
        </ol>

        <button
          type="button"
          onClick={() => void window.api.app.openExternal('https://aka.ms/MinecraftEULA')}
          className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-slate-300 transition hover:border-white/20 hover:bg-white/[0.07] hover:text-slate-100"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          {t('Открыть Minecraft EULA в браузере')}
        </button>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/[0.07] bg-ink-950/50 px-4 py-3">
          <input
            type="checkbox"
            checked={checked}
            onChange={(event) => setChecked(event.target.checked)}
            disabled={busy}
            className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-accent"
          />
          <span className="text-xs leading-relaxed text-slate-300">
            {t(
              'Я прочитал(а) и принимаю Minecraft End User License Agreement, а также подтверждаю, что несу ответственность за работу этого сервера.'
            )}
          </span>
        </label>

        {error ? (
          <div className="flex items-start gap-2.5 rounded-lg border border-red-400/20 bg-red-500/[0.07] px-3 py-2 text-xs text-red-200">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <p className="min-w-0 flex-1">{error}</p>
          </div>
        ) : null}
      </div>
    </Modal>
  )
}
