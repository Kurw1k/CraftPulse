import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import type {
  MetricsSnapshot,
  ServerInstance,
  ServerOutputEvent,
  ServerStatus,
  ServerStatusInfo
} from '@shared/types'
import { isProxyLoader } from '@shared/types'
import { broadcast } from './events'
import { t } from './i18n'
import { PATHS, serverDir } from './paths'
import { readInstance } from './server-manager'
import { resolveJava } from './java'
import { ProcessSampler } from './metrics'

interface ManagedServer {
  child: ChildProcessWithoutNullStreams
  instance: ServerInstance
  startedAt: number
  status: ServerStatus
  stopping: boolean
  finalized: boolean
  sampler: ProcessSampler
  metricsTimer?: NodeJS.Timeout
  stopTimer?: NodeJS.Timeout
  startAfterExit?: boolean
  restartWhenReady?: boolean
  readyTimer?: NodeJS.Timeout
  logStream?: fs.WriteStream
}

const running = new Map<string, ManagedServer>()
const states = new Map<string, ServerStatusInfo>()

function emitStatus(info: ServerStatusInfo): void {
  states.set(info.id, info)
  broadcast('server:status', info)
}

function emitOutput(serverId: string, data: string, stream: ServerOutputEvent['stream'] = 'system'): void {
  broadcast('server:output', { serverId, data, stream } satisfies ServerOutputEvent)
}

function systemLine(serverId: string, message: string): void {
  emitOutput(serverId, `\u001b[36m[CraftPulse]\u001b[0m ${message}\r\n`)
}

function runningIds(): string[] {
  return [...running.keys()]
}

export function getStatus(id: string): ServerStatusInfo | undefined {
  return states.get(id)
}

export function getStatuses(): ServerStatusInfo[] {
  return [...states.values()]
}

function buildLaunchArgs(instance: ServerInstance): string[] {
  const args = [
    `-Xms${instance.memoryMinMb}M`,
    `-Xmx${instance.memoryMaxMb}M`,
    '-XX:+UseG1GC',
    '-XX:+ParallelRefProcEnabled',
    '-XX:MaxGCPauseMillis=200',
    '-Dfile.encoding=UTF-8',
    '-Dterminal.jline=false',
    '-Dterminal.ansi=true'
  ]
  if (instance.launch.type === 'jar') {
    args.push('-jar', instance.launch.target)
  } else {
    args.push(`@${instance.launch.target}`)
  }
  if (!isProxyLoader(instance.loader)) args.push('nogui')
  return args
}

function terminateProcess(managed: ManagedServer): void {
  const { child } = managed
  if (!child.pid) return
  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { windowsHide: true })
    } else {
      child.kill('SIGTERM')
      setTimeout(() => {
        try {
          child.kill('SIGKILL')
        } catch {
          // already gone
        }
      }, 5000).unref()
    }
  } catch {
    // process already exited
  }
}

export async function startServer(id: string): Promise<void> {
  const existing = running.get(id)
  if (existing && (existing.status === 'running' || existing.status === 'starting')) return

  const instance = await readInstance(id)
  if (!isProxyLoader(instance.loader) && !instance.eulaAccepted) {
    throw new Error(
      t('EULA_REQUIRED:Для запуска сервера нужно принять Minecraft EULA. Подтвердите согласие в лаунчере.')
    )
  }

  emitStatus({ id, status: 'starting', startedAt: Date.now() })
  systemLine(id, t('Подготовка сервера «{name}»…', { name: instance.name }))

  const dir = serverDir(id)
  const target = path.join(dir, instance.launch.target)
  if (!fs.existsSync(target)) {
    const message = t('Файл запуска не найден: {file}. Переустановите ядро сервера.', {
      file: instance.launch.target
    })
    emitStatus({ id, status: 'crashed', error: message })
    throw new Error(message)
  }

  let javaRuntime
  try {
    javaRuntime = await resolveJava(
      instance.loader,
      instance.mcVersion,
      instance.javaPath,
      (message, percent) => {
        broadcast('progress', { scope: 'java', message, percent, serverId: id })
        if (/не найдена|Загружаем|Скачивание|not found|Downloading|Searching/i.test(message)) {
          systemLine(id, message)
        }
      }
    )
  } catch (error) {
    const message = (error as Error).message
    emitStatus({ id, status: 'crashed', error: message })
    systemLine(id, message)
    throw error
  }

  systemLine(id, `Java ${javaRuntime.major} (${javaRuntime.vendor}) — ${javaRuntime.path}`)
  systemLine(
    id,
    t('Запуск: {loader} {version}, память {min}–{max} МБ', {
      loader: instance.loader,
      version: instance.mcVersion,
      min: instance.memoryMinMb,
      max: instance.memoryMaxMb
    })
  )

  let child: ChildProcessWithoutNullStreams
  try {
    child = spawn(javaRuntime.path, buildLaunchArgs(instance), {
      cwd: dir,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        JAVA_HOME: path.dirname(path.dirname(javaRuntime.path))
      }
    })
  } catch (error) {
    const message = t('Не удалось запустить Java: {error}', { error: (error as Error).message })
    emitStatus({ id, status: 'crashed', error: message })
    systemLine(id, message)
    throw error
  }

  const logFile = path.join(PATHS.logs, `${id}.log`)
  let logStream: fs.WriteStream | undefined
  try {
    fs.mkdirSync(PATHS.logs, { recursive: true })
    logStream = fs.createWriteStream(logFile, { flags: 'a' })
    logStream.write(`\n===== ${new Date().toISOString()} ${instance.name} =====\n`)
  } catch {
    logStream = undefined
  }

  const managed: ManagedServer = {
    child,
    instance,
    startedAt: Date.now(),
    status: 'starting',
    stopping: false,
    finalized: false,
    sampler: new ProcessSampler(child.pid ?? 0),
    logStream
  }
  running.set(id, managed)

  const handleData = (chunk: Buffer | string, stream: 'stdout' | 'stderr'): void => {
    const text = chunk.toString()
    emitOutput(id, text, stream)
    logStream?.write(text)
    if (managed.status === 'starting' && /Done\s*\(|Done in|For help, type/i.test(text)) {
      managed.status = 'running'
      if (managed.readyTimer) clearTimeout(managed.readyTimer)
      emitStatus({ id, status: 'running', pid: child.pid, startedAt: managed.startedAt })
      if (managed.restartWhenReady) {
        managed.restartWhenReady = false
        void restartServer(id)
      }
    }
  }

  child.stdout.on('data', (chunk) => handleData(chunk, 'stdout'))
  child.stderr.on('data', (chunk) => handleData(chunk, 'stderr'))

  const finalize = (code: number | null, signal: NodeJS.Signals | null): void => {
    if (managed.finalized) return
    managed.finalized = true
    if (managed.metricsTimer) clearInterval(managed.metricsTimer)
    if (managed.stopTimer) clearTimeout(managed.stopTimer)
    if (managed.readyTimer) clearTimeout(managed.readyTimer)
    running.delete(id)

    const crashed = !managed.stopping && code !== 0
    const status: ServerStatus = crashed ? 'crashed' : 'stopped'
    const suffix = signal
      ? ` ${t('(сигнал {signal})', { signal })}`
      : code !== null
        ? ` ${t('(код {code})', { code })}`
        : ''
    systemLine(
      id,
      crashed
        ? t('Сервер аварийно завершился{suffix}', { suffix })
        : t('Сервер остановлен{suffix}', { suffix })
    )
    emitStatus({
      id,
      status,
      exitCode: code,
      startedAt: managed.startedAt,
      error: crashed ? t('Процесс завершился с кодом {code}', { code: code ?? '—' }) : undefined
    })
    logStream?.write(`\n===== stopped ${new Date().toISOString()}${suffix} =====\n`)
    logStream?.end()

    if (managed.startAfterExit) {
      managed.startAfterExit = false
      setTimeout(() => {
        systemLine(id, t('Перезапуск сервера…'))
        startServer(id).catch((error) => {
          const message = (error as Error).message
          systemLine(id, t('Не удалось перезапустить: {error}', { error: message }))
          emitStatus({ id, status: 'crashed', error: message })
        })
      }, 1200)
    }
  }

  child.on('error', (error) => {
    const message = t('Ошибка процесса: {error}', { error: error.message })
    systemLine(id, message)
    managed.stopping = true
    finalize(null, null)
    emitStatus({ id, status: 'crashed', error: message })
  })
  child.on('close', (code, signal) => finalize(code, signal))

  managed.readyTimer = setTimeout(() => {
    if (managed.status === 'starting' && !managed.finalized) {
      managed.status = 'running'
      emitStatus({ id, status: 'running', pid: child.pid, startedAt: managed.startedAt })
      if (managed.restartWhenReady) {
        managed.restartWhenReady = false
        void restartServer(id)
      }
    }
  }, 60_000)

  emitStatus({ id, status: 'starting', pid: child.pid, startedAt: managed.startedAt })

  let sampling = false
  managed.metricsTimer = setInterval(async () => {
    if (sampling || managed.finalized) return
    sampling = true
    try {
      const sample = await managed.sampler.sample()
      if (sample && !managed.finalized) {
        const snapshot: MetricsSnapshot = {
          serverId: id,
          pid: child.pid ?? 0,
          cpuPercent: Math.round(sample.cpuPercent * 10) / 10,
          rssMb: Math.round(sample.rssMb * 10) / 10,
          allocatedMb: instance.memoryMaxMb,
          uptimeMs: Date.now() - managed.startedAt,
          timestamp: Date.now()
        }
        broadcast('server:metrics', snapshot)
      }
    } finally {
      sampling = false
    }
  }, 2000)
}

export async function sendCommand(id: string, command: string): Promise<void> {
  const managed = running.get(id)
  if (!managed) throw new Error(t('Сервер не запущен'))
  const cleaned = command.replace(/[\r\n]+/g, ' ').trim()
  if (!cleaned) return
  const normalized = cleaned.startsWith('/') ? cleaned.slice(1) : cleaned
  try {
    managed.child.stdin.write(`${normalized}\n`)
    emitOutput(id, `\u001b[90m> ${cleaned}\u001b[0m\r\n`, 'system')
  } catch {
    throw new Error(t('Не удалось отправить команду в stdin сервера'))
  }
}

export async function stopServer(id: string): Promise<void> {
  const managed = running.get(id)
  if (!managed) return
  if (managed.stopping) return
  managed.stopping = true
  managed.status = 'stopping'
  emitStatus({ id, status: 'stopping', pid: managed.child.pid, startedAt: managed.startedAt })
  systemLine(id, t('Отправка команды stop…'))
  try {
    managed.child.stdin.write('stop\n')
  } catch {
    terminateProcess(managed)
  }
  managed.stopTimer = setTimeout(() => {
    systemLine(id, t('Сервер не остановился за 20 секунд — принудительное завершение'))
    terminateProcess(managed)
  }, 20_000)
}

export async function killServer(id: string): Promise<void> {
  const managed = running.get(id)
  if (!managed) return
  managed.startAfterExit = false
  managed.restartWhenReady = false
  managed.stopping = true
  managed.status = 'stopping'
  emitStatus({ id, status: 'stopping', pid: managed.child.pid, startedAt: managed.startedAt })
  terminateProcess(managed)
}

export async function restartServer(id: string): Promise<void> {
  const managed = running.get(id)
  if (!managed || managed.finalized) {
    await startServer(id)
    return
  }
  if (managed.startAfterExit) return
  if (managed.status === 'starting') {
    managed.restartWhenReady = true
    systemLine(id, t('Сервер перезапустится сразу после запуска…'))
    return
  }
  if (managed.stopping) return
  managed.startAfterExit = true
  systemLine(id, t('Перезапуск сервера…'))
  await stopServer(id)
}

export async function stopAndWait(id: string, timeoutMs = 8000): Promise<void> {
  await killServer(id)
  const deadline = Date.now() + timeoutMs
  while (running.has(id) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 150))
  }
}

export function killAll(): void {
  for (const id of runningIds()) {
    const managed = running.get(id)
    if (managed) terminateProcess(managed)
  }
}

export function hasRunningServers(): boolean {
  return running.size > 0
}

export function forgetServer(id: string): void {
  states.delete(id)
}
