import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowRight, Boxes, Plus, Server as ServerIcon, Sparkles } from 'lucide-react'
import type { ServerInstance } from '@shared/types'
import { useLauncher } from './state/LauncherContext'
import { Sidebar } from './components/Sidebar'
import { TabBar } from './components/TabBar'
import { ServerView } from './components/ServerView'
import { CreateServerModal } from './components/modals/CreateServerModal'
import { EulaModal } from './components/modals/EulaModal'
import { AppSettingsModal } from './components/modals/AppSettingsModal'
import { Button, Spinner } from './components/ui'
import { cleanError } from './lib/errors'
import { cn } from './lib/format'

export default function App(): JSX.Element {
  const {
    loading,
    servers,
    statuses,
    settings,
    paths,
    info,
    refreshServers,
    notify,
    t
  } = useLauncher()

  const [openIds, setOpenIds] = useState<string[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [eula, setEula] = useState<{ server: ServerInstance; startAfter: boolean } | null>(null)
  const initialized = useRef(false)

  useEffect(() => {
    if (loading) return
    const valid = openIds.filter((id) => servers.some((server) => server.id === id))
    let nextOpen = valid
    if (!initialized.current && servers.length > 0) {
      initialized.current = true
      const first = servers[0].id
      nextOpen = [first, ...valid.filter((id) => id !== first)]
      setActiveId(first)
    }
    if (nextOpen.length !== openIds.length || nextOpen.some((id, index) => id !== openIds[index])) {
      setOpenIds(nextOpen)
    }
    if (nextOpen.length > 0 && (!activeId || !nextOpen.includes(activeId))) {
      setActiveId(nextOpen[0])
    }
    if (nextOpen.length === 0 && activeId) setActiveId(null)
  }, [servers, loading, openIds, activeId])

  useEffect(() => {
    const handler = (event: KeyboardEvent): void => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'n') {
        event.preventDefault()
        setCreateOpen(true)
      }
      if ((event.ctrlKey || event.metaKey) && event.key === ',') {
        event.preventDefault()
        setSettingsOpen(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const openServer = useCallback((id: string) => {
    initialized.current = true
    setOpenIds((previous) => (previous.includes(id) ? previous : [...previous, id]))
    setActiveId(id)
  }, [])

  const closeTab = (id: string): void => {
    setOpenIds((previous) => previous.filter((openId) => openId !== id))
    if (activeId === id) {
      const index = openIds.indexOf(id)
      const remaining = openIds.filter((openId) => openId !== id)
      setActiveId(remaining[Math.min(index, remaining.length - 1)] ?? null)
    }
  }

  const handleCreated = async (instance: ServerInstance): Promise<void> => {
    initialized.current = true
    await refreshServers()
    setCreateOpen(false)
    setOpenIds((previous) => [instance.id, ...previous.filter((id) => id !== instance.id)])
    setActiveId(instance.id)
    if (!instance.eulaAccepted) {
      setEula({ server: instance, startAfter: false })
    } else {
      notify(t('Сервер «{name}» готов', { name: instance.name }), 'success')
    }
  }

  const handleDeleted = (id: string): void => {
    setOpenIds((previous) => previous.filter((openId) => openId !== id))
    setActiveId((previous) => (previous === id ? null : previous))
    void refreshServers()
    notify(t('Сервер удалён'), 'success')
  }

  const openFolder = async (id: string): Promise<void> => {
    try {
      await window.api.servers.openFolder(id)
    } catch (error) {
      notify(cleanError(error), 'error')
    }
  }

  const handleEulaAccepted = async (): Promise<void> => {
    const pending = eula
    if (!pending) return
    setEula(null)
    await refreshServers()
    if (pending.startAfter) {
      try {
        await window.api.process.start(pending.server.id)
      } catch (error) {
        notify(cleanError(error), 'error')
      }
    }
  }

  if (loading || !settings || !paths || !info) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 ring-1 ring-accent/30">
            <Boxes className="h-7 w-7 text-accent" />
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Spinner />
            {t('Загрузка CraftPulse…')}
          </div>
        </div>
      </div>
    )
  }

  const activeServer = servers.find((server) => server.id === activeId) ?? null

  return (
    <div className="flex h-full w-full">
      <Sidebar
        servers={servers}
        statuses={statuses}
        activeId={activeId}
        version={info.version}
        onSelect={openServer}
        onCreate={() => setCreateOpen(true)}
        onSettings={() => setSettingsOpen(true)}
        onOpenFolder={(id) => void openFolder(id)}
      />

      <main className="flex min-w-0 flex-1 flex-col">
        <TabBar
          servers={servers}
          statuses={statuses}
          activeId={activeId}
          openIds={openIds}
          onSelect={setActiveId}
          onClose={closeTab}
          onCreate={() => setCreateOpen(true)}
          onSettings={() => setSettingsOpen(true)}
        />

        <div className="relative min-h-0 flex-1">
          {openIds.map((id) => {
            const server = servers.find((candidate) => candidate.id === id)
            if (!server) return null
            return (
              <div
                key={id}
                className={cn('absolute inset-0', activeId === id ? 'flex' : 'hidden')}
              >
                <ServerView
                  server={server}
                  active={activeId === id}
                  onDeleted={handleDeleted}
                  onEulaRequired={(target, startAfter) => setEula({ server: target, startAfter })}
                  onOpenFolder={() => void openFolder(server.id)}
                />
              </div>
            )
          })}

          {!activeServer ? (
            <div className="flex h-full items-center justify-center overflow-y-auto p-8">
              <div className="flex max-w-lg flex-col items-center text-center animate-fade-in">
                <div className="relative mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-accent/20 via-emerald-500/5 to-transparent ring-1 ring-accent/20">
                  <ServerIcon className="h-9 w-9 text-accent" />
                  <Sparkles className="absolute -right-1 -top-1 h-5 w-5 text-accent/60" />
                </div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-100">
                  {servers.length === 0 ? t('Соберите свой Minecraft-сервер') : t('Сервер не выбран')}
                </h2>
                <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-500">
                  {servers.length === 0
                    ? t(
                        'Paper, Purpur, Folia, Fabric, Forge, NeoForge, Mohist, Banner, Magma, Sponge или прокси Velocity / BungeeCord / Waterfall — выберите ядро, версию и CraftPulse установит всё сам.'
                      )
                    : t('Выберите сервер в списке слева или создайте новый.')}
                </p>
                <div className="mt-6 flex items-center gap-2">
                  {servers.length > 0 ? (
                    <Button variant="secondary" onClick={() => openServer(servers[0].id)}>
                      {t('Открыть «{name}»', { name: servers[0].name })}
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  ) : null}
                  <Button variant="primary" onClick={() => setCreateOpen(true)}>
                    <Plus className="h-4 w-4" />
                    {t('Создать сервер')}
                  </Button>
                </div>
                <div className="mt-8 flex flex-wrap justify-center gap-2">
                  {[
                    t('Автоскачивание ядра'),
                    t('xterm-консоль'),
                    t('Modrinth и CurseForge'),
                    t('Java в один клик')
                  ].map(
                    (feature) => (
                      <span key={feature} className="chip">
                        {feature}
                      </span>
                    )
                  )}
                </div>
                <p className="mt-6 font-mono text-[10px] text-slate-700">
                  {t('Данные: {path}', { path: paths.root })}
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </main>

      <CreateServerModal
        open={createOpen}
        servers={servers}
        defaultMemoryMb={settings.defaultMemoryMb}
        onClose={() => setCreateOpen(false)}
        onCreated={(instance) => void handleCreated(instance)}
      />

      {eula ? (
        <EulaModal
          server={eula.server}
          startAfter={eula.startAfter}
          onClose={() => setEula(null)}
          onAccepted={() => void handleEulaAccepted()}
        />
      ) : null}

      <AppSettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  )
}
