import { useEffect, useRef, useState } from 'react'
import { Eraser, Send, TerminalSquare } from 'lucide-react'
import { FitAddon } from '@xterm/addon-fit'
import { Terminal } from '@xterm/xterm'
import type { ServerInstance, ServerStatus } from '@shared/types'
import { translate } from '@shared/i18n'
import { cleanError } from '../../lib/errors'
import { getLocale } from '../../lib/locale'
import { useLauncher } from '../../state/LauncherContext'
import { Button } from '../ui'

// Standard Minecraft commands for autocomplete
const MC_COMMANDS = [
  'advancement', 'attribute', 'ban', 'ban-ip', 'banlist', 'bossbar', 'clear',
  'clone', 'data', 'datapack', 'debug', 'defaultgamemode', 'deop', 'difficulty',
  'effect', 'enchant', 'execute', 'experience', 'fill', 'fillbiome', 'forceload',
  'function', 'gamemode', 'gamerule', 'give', 'help', 'kick', 'kill', 'list',
  'locate', 'locatebiome', 'loot', 'me', 'msg', 'op', 'pardon', 'pardon-ip',
  'particle', 'perf', 'permission', 'playsound', 'publish', 'recipe', 'reload',
  'replaceitem', 'ride', 'save-all', 'save-off', 'save-on', 'say', 'schedule',
  'scoreboard', 'seed', 'setblock', 'setidletimeout', 'setworldspawn', 'spawnpoint',
  'spectate', 'spreadplayers', 'stop', 'stopsound', 'summon', 'tag', 'team',
  'teammsg', 'teleport', 'tell', 'tellraw', 'time', 'title', 'tm', 'trigger',
  'w', 'weather', 'worldborder', 'xp'
]

const COMMAND_ARGS: Record<string, string[]> = {
  'gamemode': ['survival', 'creative', 'adventure', 'spectator'],
  'difficulty': ['peaceful', 'easy', 'normal', 'hard'],
  'op': [],
  'deop': [],
  'ban': [],
  'kick': [],
  'pardon': [],
  'give': [],
  'tp': ['@a', '@p', '@r', '@e', '@s'],
  'teleport': ['@a', '@p', '@r', '@e', '@s'],
  'time': ['set', 'add', 'query'],
  'gamerule': [],
  'effect': ['give', 'clear'],
  'enchant': [],
  'weather': ['clear', 'rain', 'thunder'],
  'say': [],
  'msg': ['@a', '@p', '@r', '@e', '@s'],
  'tell': ['@a', '@p', '@r', '@e', '@s'],
  'w': ['@a', '@p', '@r', '@e', '@s'],
  'teammsg': ['@a', '@p', '@r', '@e', '@s'],
  'me': [],
  'stop': [],
  'save-all': [],
  'save-off': [],
  'save-on': [],
  'reload': [],
  'list': [],
  'help': [],
}

const THEME = {
  background: '#05080d',
  foreground: '#c7d2e0',
  cursor: '#4ade80',
  cursorAccent: '#05080d',
  selectionBackground: 'rgba(74, 222, 128, 0.22)',
  black: '#1b2330',
  red: '#f87171',
  green: '#4ade80',
  yellow: '#fbbf24',
  blue: '#60a5fa',
  magenta: '#c084fc',
  cyan: '#22d3ee',
  white: '#e2e8f0',
  brightBlack: '#64748b',
  brightRed: '#fca5a5',
  brightGreen: '#86efac',
  brightYellow: '#fde68a',
  brightBlue: '#93c5fd',
  brightMagenta: '#d8b4fe',
  brightCyan: '#67e8f9',
  brightWhite: '#f8fafc'
}

export function ConsoleTab({
  server,
  active,
  status
}: {
  server: ServerInstance
  active: boolean
  status: ServerStatus
}): JSX.Element {
  const { t } = useLauncher()
  const containerRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const [command, setCommand] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const canSend = status === 'running' || status === 'starting'

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const terminal = new Terminal({
      theme: THEME,
      fontFamily: '"JetBrains Mono", "Cascadia Code", Consolas, "Courier New", monospace',
      fontSize: 12.5,
      lineHeight: 1.3,
      cursorBlink: true,
      cursorStyle: 'bar',
      scrollback: 8000,
      convertEol: false,
      allowTransparency: true,
      allowProposedApi: true
    })
    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)
    terminal.open(container)
    terminalRef.current = terminal
    fitRef.current = fitAddon

    terminal.write(
      `\u001b[38;5;114mCraftPulse\u001b[0m \u001b[90m·\u001b[0m \u001b[1m${server.name}\u001b[0m \u001b[90m·\u001b[0m ${server.loader} ${server.mcVersion}\r\n`
    )
    terminal.write(
      `\u001b[90m${translate(
        getLocale(),
        'Консоль сервера (stdout/stderr). Вводите команды без слэша: stop, say hello, op Nick.'
      )}\u001b[0m\r\n\r\n`
    )

    const unsubscribe = window.api.events.onServerOutput((event) => {
      if (event.serverId !== server.id) return
      terminal.write(event.data)
    })

    const fit = (): void => {
      const element = containerRef.current
      if (!element || element.clientWidth === 0 || element.clientHeight === 0) return
      try {
        fitAddon.fit()
      } catch {
        // terminal may be disposed
      }
    }

    const observer = new ResizeObserver(() => fit())
    observer.observe(container)
    const frame = requestAnimationFrame(fit)

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      unsubscribe()
      terminal.dispose()
      terminalRef.current = null
      fitRef.current = null
    }
  }, [server.id, server.loader, server.mcVersion, server.name])

  useEffect(() => {
    if (!active) return
    const timer = window.setTimeout(() => {
      const terminal = terminalRef.current
      const container = containerRef.current
      if (!terminal || !container) return
      if (container.clientWidth > 0) {
        try {
          fitRef.current?.fit()
        } catch {
          // ignore
        }
        terminal.scrollToBottom()
      }
    }, 40)
    return () => window.clearTimeout(timer)
  }, [active])

  const submit = async (): Promise<void> => {
    const value = command.trim()
    if (!value || !canSend) return
    setCommand('')
    setHistory((previous) => [value, ...previous.filter((entry) => entry !== value)].slice(0, 60))
    setHistoryIndex(-1)
    try {
      await window.api.process.command(server.id, value)
    } catch (error) {
      terminalRef.current?.write(`\r\n\u001b[31m${cleanError(error)}\u001b[0m\r\n`)
    }
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Tab') {
      event.preventDefault()
      const inputValue = command
      const trimmed = inputValue.trim()
      const parts = trimmed.split(/\s+/)
      const first = parts[0] ?? ''
      const rest = parts.slice(1)
      const lastPart = rest[rest.length - 1] ?? ''

      // Command autocomplete (first token)
      if (parts.length === 1) {
        const match = MC_COMMANDS.find((cmd) => cmd.startsWith(first.toLowerCase()))
        if (match) {
          setCommand(match + (first.length > 0 && first !== match ? '' : ''))
          return
        }
      }

      // Argument autocomplete: if command expects args like op/deop/kick/ban, try to complete nickname
      // Use a simple known nickname list (could be extended with server players in real life)
      const knownNames = ['Kurw1k', 'Notch', 'Herobrine', 'Steve', 'Alex', 'Dream', 'Technoblade']
      const cmdLower = first.toLowerCase()
      if (['op', 'deop', 'kick', 'ban', 'pardon', 'ban-ip', 'pardon-ip', 'msg', 'tell', 'w'].includes(cmdLower)) {
        // If last token is partial nickname, complete it
        const partial = lastPart.toLowerCase()
        if (partial.length > 0) {
          const matchName = knownNames.find((n) => n.toLowerCase().startsWith(partial))
          if (matchName) {
            const newRest = [...rest.slice(0, -1), matchName]
            setCommand([first, ...newRest].join(' '))
            return
          }
        }
      }

      // Known command argument autocomplete (gamemode/difficulty/weather)
      const args = COMMAND_ARGS[first.toLowerCase()]
      if (args && args.length && rest.length === 0) {
        setCommand([first, args[0]].join(' '))
        return
      }

      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (!history.length) return
      const next = Math.min(history.length - 1, historyIndex + 1)
      setHistoryIndex(next)
      setCommand(history[next] ?? '')
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      const next = historyIndex - 1
      if (next < 0) {
        setHistoryIndex(-1)
        setCommand('')
      } else {
        setHistoryIndex(next)
        setCommand(history[next] ?? '')
      }
    } else if (event.key.toLowerCase() === 'l' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      terminalRef.current?.clear()
    }
  }

  const placeholder = !canSend
    ? status === 'stopping'
      ? t('Сервер останавливается…')
      : t('Сервер остановлен — запустите его')
    : t('Введите команду и нажмите Enter…')

  return (
    <div className="console-shell flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-white/[0.07] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-white/[0.06] px-3">
        <div className="flex items-center gap-2 text-[11px] font-medium text-slate-500">
          <TerminalSquare className="h-3.5 w-3.5 text-accent/70" />
          stdout / stderr
          <span
            className={`ml-1 h-1.5 w-1.5 rounded-full ${
              canSend ? 'bg-accent animate-pulseglow' : 'bg-slate-600'
            }`}
          />
        </div>
        <button
          type="button"
          onClick={() => {
            terminalRef.current?.clear()
            terminalRef.current?.scrollToBottom()
          }}
          className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-[11px] text-slate-500 transition hover:bg-white/[0.06] hover:text-slate-200"
        >
          <Eraser className="h-3 w-3" />
          {t('Очистить')}
        </button>
      </div>

      <div ref={containerRef} className="min-h-0 flex-1 overflow-hidden" />

      <form
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
        className="flex shrink-0 items-center gap-2 border-t border-white/[0.06] bg-ink-900/60 px-3 py-2.5"
      >
        <span className="select-none font-mono text-sm text-accent">&gt;</span>
        <input
          value={command}
          onChange={(event) => setCommand(event.target.value)}
          onKeyDown={handleKeyDown}
          disabled={!canSend}
          placeholder={placeholder}
          spellCheck={false}
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent font-mono text-[13px] text-slate-100 placeholder:text-slate-600 outline-none disabled:cursor-not-allowed"
        />
        <Button
          type="submit"
          variant="secondary"
          size="sm"
          disabled={!canSend || !command.trim()}
          className="shrink-0"
        >
          <Send className="h-3.5 w-3.5" />
          {t('Отправить')}
        </Button>
      </form>
    </div>
  )
}
