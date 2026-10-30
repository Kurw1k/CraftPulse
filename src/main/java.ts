import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import fs from 'node:fs'
import path from 'node:path'
import type { JavaRuntime, LoaderType } from '@shared/types'
import { downloadFile, fetchJson } from './http'
import { getSettings } from './store'
import { t } from './i18n'
import { javaExecutableName, PATHS } from './paths'
import { requiredJavaMajorForLoader } from './mojang'

const execFileAsync = promisify(execFile)
const JAVA_INDEX = path.join(PATHS.runtimes, 'index.json')
const exeName = javaExecutableName()

interface RuntimeRecord {
  path: string
  major: number
  version: string
  vendor: string
  installedAt: number
}

interface AdoptiumAsset {
  binary: {
    package: { link: string; name: string; size?: number }
    version?: { semver?: string }
    os?: string
    architecture?: string
  }
  release_name: string
  version?: { semver?: string }
}

let detectCache: { at: number; runtimes: JavaRuntime[] } | null = null

export type JavaProgress = (message: string, percent?: number) => void

function normalizeKey(value: string): string {
  const resolved = path.resolve(value)
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved
}

function parseMajor(version: string): number {
  const match = /^(\d+)(?:\.(\d+))?/.exec(version)
  if (!match) return 0
  const first = Number(match[1])
  if (first === 1 && match[2]) return Number(match[2])
  return first
}

function detectVendor(text: string): string {
  if (/temurin|adoptium/i.test(text)) return 'Eclipse Temurin'
  if (/zulu|azul/i.test(text)) return 'Azul Zulu'
  if (/corretto/i.test(text)) return 'Amazon Corretto'
  if (/microsoft/i.test(text)) return 'Microsoft OpenJDK'
  if (/graalvm/i.test(text)) return 'GraalVM'
  if (/openjdk/i.test(text)) return 'OpenJDK'
  if (/java\(tm\)/i.test(text)) return 'Oracle JDK'
  return 'Java'
}

async function probeJava(javaPath: string, source: JavaRuntime['source'] = 'system'): Promise<JavaRuntime | null> {
  try {
    const stat = await fs.promises.stat(javaPath)
    if (!stat.isFile()) return null
  } catch {
    return null
  }

  try {
    const { stdout, stderr } = await execFileAsync(javaPath, ['-version'], {
      timeout: 12_000,
      windowsHide: true
    })
    const text = `${stdout}\n${stderr}`.trim()
    const versionMatch = /version\s+"([^"]+)"/i.exec(text)
    const version = versionMatch?.[1] ?? text.split(/\r?\n/)[0] ?? 'unknown'
    const major = parseMajor(version)
    if (!major) return null
    const vendor = detectVendor(text)
    return {
      path: javaPath,
      major,
      version,
      vendor,
      source,
      label: `${vendor} ${version}`
    }
  } catch {
    return null
  }
}

async function findJavaExecutable(root: string, maxDepth = 4): Promise<string | null> {
  const queue: Array<{ dir: string; depth: number }> = [{ dir: root, depth: 0 }]
  while (queue.length > 0) {
    const current = queue.shift()
    if (!current) break
    const candidate = path.join(current.dir, exeName)
    try {
      const stat = await fs.promises.stat(candidate)
      if (stat.isFile()) return candidate
    } catch {
      // keep looking
    }
    if (current.depth >= maxDepth) continue
    let entries: fs.Dirent[]
    try {
      entries = await fs.promises.readdir(current.dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        queue.push({ dir: path.join(current.dir, entry.name), depth: current.depth + 1 })
      }
    }
  }
  return null
}

function candidateRoots(): string[] {
  const roots = new Set<string>()
  if (process.env.JAVA_HOME) roots.add(process.env.JAVA_HOME)
  const home = process.env.HOME ?? process.env.USERPROFILE ?? ''

  if (process.platform === 'win32') {
    const programFiles = [process.env.ProgramFiles, process.env['ProgramFiles(x86)']].filter(
      (value): value is string => Boolean(value)
    )
    for (const base of programFiles) {
      for (const vendor of ['Java', 'Eclipse Adoptium', 'Microsoft', 'Zulu', 'BellSoft', 'Amazon Corretto', 'Semeru']) {
        roots.add(path.join(base, vendor))
      }
    }
    if (process.env.LOCALAPPDATA) {
      roots.add(path.join(process.env.LOCALAPPDATA, 'Programs', 'Eclipse Adoptium'))
      roots.add(path.join(process.env.LOCALAPPDATA, 'Programs', 'Microsoft'))
    }
    if (process.env.USERPROFILE) {
      roots.add(path.join(process.env.USERPROFILE, '.jdks'))
      roots.add(path.join(process.env.USERPROFILE, 'scoop', 'apps', 'temurin'))
    }
  } else {
    for (const root of ['/usr/lib/jvm', '/usr/java', '/opt/java', '/opt/jdk', '/opt']) {
      roots.add(root)
    }
    if (home) {
      roots.add(path.join(home, '.jdks'))
      roots.add(path.join(home, '.sdkman', 'candidates', 'java'))
      roots.add(path.join(home, '.local', 'share', 'craftpulse', 'runtimes'))
      roots.add(path.join(home, '.local', 'share', 'craftdeck', 'runtimes'))
    }
  }

  roots.add(PATHS.runtimes)
  return [...roots].filter(Boolean)
}

async function whichJava(): Promise<string[]> {
  const command = process.platform === 'win32' ? 'where' : 'which'
  const args = process.platform === 'win32' ? ['java'] : ['-a', 'java']
  try {
    const { stdout } = await execFileAsync(command, args, { timeout: 5000, windowsHide: true })
    return stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
  } catch {
    return []
  }
}

function readIndex(): RuntimeRecord[] {
  try {
    return JSON.parse(fs.readFileSync(JAVA_INDEX, 'utf8')) as RuntimeRecord[]
  } catch {
    return []
  }
}

function writeIndex(records: RuntimeRecord[]): void {
  try {
    fs.mkdirSync(PATHS.runtimes, { recursive: true })
    fs.writeFileSync(JAVA_INDEX, JSON.stringify(records, null, 2), 'utf8')
  } catch (error) {
    console.warn('[java] failed to save runtime index:', error)
  }
}

export async function detectJava(force = false): Promise<JavaRuntime[]> {
  if (!force && detectCache && Date.now() - detectCache.at < 30_000) return detectCache.runtimes

  const found = new Map<string, JavaRuntime>()

  for (const record of readIndex()) {
    const runtime = await probeJava(record.path, 'downloaded')
    if (runtime) found.set(normalizeKey(runtime.path), runtime)
  }

  const directCandidates: string[] = []
  if (process.env.JAVA_HOME) directCandidates.push(path.join(process.env.JAVA_HOME, 'bin', exeName))
  directCandidates.push(...(await whichJava()))

  for (const candidate of directCandidates) {
    const runtime = await probeJava(candidate)
    if (runtime) found.set(normalizeKey(runtime.path), runtime)
  }

  for (const root of candidateRoots()) {
    try {
      const stat = await fs.promises.stat(root)
      if (!stat.isDirectory()) continue
    } catch {
      continue
    }
    const executable = await findJavaExecutable(root, root === PATHS.runtimes ? 5 : 3)
    if (!executable) continue
    const source: JavaRuntime['source'] = executable.startsWith(PATHS.runtimes) ? 'downloaded' : 'system'
    const runtime = await probeJava(executable, source)
    if (runtime) found.set(normalizeKey(runtime.path), runtime)
  }

  const runtimes = [...found.values()].sort((a, b) => b.major - a.major || b.version.localeCompare(a.version))
  detectCache = { at: Date.now(), runtimes }
  return runtimes
}

async function extractArchive(archive: string, destination: string): Promise<void> {
  await fs.promises.mkdir(destination, { recursive: true })
  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn('tar', ['-xf', archive, '-C', destination], {
        windowsHide: true
      })
      child.on('error', reject)
      child.on('close', (code) => {
        if (code === 0) resolve()
        else reject(new Error(`tar exited with code ${code}`))
      })
    })
    return
  } catch (error) {
    if (process.platform === 'win32' && archive.toLowerCase().endsWith('.zip')) {
      const command = `Expand-Archive -LiteralPath '${archive.replace(/'/g, "''")}' -DestinationPath '${destination.replace(/'/g, "''")}' -Force`
      await new Promise<void>((resolve, reject) => {
        const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], {
          windowsHide: true
        })
        child.on('error', reject)
        child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`Expand-Archive exited with code ${code}`))))
      })
      return
    }
    throw error
  }
}

export async function installJava(major: number, progress?: JavaProgress): Promise<JavaRuntime> {
  const existing = (await detectJava(true)).find((runtime) => runtime.major === major)
  if (existing) {
    progress?.(t('Java {major} уже установлена: {path}', { major, path: existing.path }), 100)
    return existing
  }

  const os = process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'mac' : 'linux'
  const arch = process.arch === 'arm64' ? 'aarch64' : 'x64'
  progress?.(t('Поиск Eclipse Temurin JDK {major}…', { major }), 0)
  const url = `https://api.adoptium.net/v3/assets/latest/${major}/hotspot?os=${os}&architecture=${arch}&image_type=jdk&vendor=eclipse`
  const assets = await fetchJson<AdoptiumAsset[]>(url)
  const asset = assets[0]
  if (!asset?.binary?.package?.link) {
    throw new Error(
      t('Не удалось найти Eclipse Temurin JDK {major} для {os}/{arch}', { major, os, arch })
    )
  }

  const packageName = asset.binary.package.name
  const archive = path.join(PATHS.runtimes, '.cache', packageName)
  const destination = path.join(PATHS.runtimes, `temurin-${major}`)

  progress?.(t('Скачивание {file}…', { file: packageName }), 0)
  await downloadFile(asset.binary.package.link, archive, (received, total) => {
    const percent = total > 0 ? Math.round((received / total) * 90) : undefined
    const mb = (received / 1024 / 1024).toFixed(1)
    progress?.(t('Скачивание {file}: {size} МБ', { file: packageName, size: mb }), percent)
  })

  progress?.(t('Распаковка архива…'), 92)
  await fs.promises.rm(destination, { recursive: true, force: true })
  await extractArchive(archive, destination)

  const executable = await findJavaExecutable(destination, 5)
  if (!executable) {
    throw new Error(t('Архив Java распакован, но исполняемый файл java не найден'))
  }

  const runtime = await probeJava(executable, 'downloaded')
  if (!runtime) {
    throw new Error(t('Скачанная Java не запускается — проверьте архив или права доступа'))
  }

  const records = readIndex().filter((record) => record.major !== major)
  records.push({
    path: runtime.path,
    major: runtime.major,
    version: runtime.version,
    vendor: runtime.vendor,
    installedAt: Date.now()
  })
  writeIndex(records)
  detectCache = null

  await fs.promises.rm(archive, { force: true }).catch(() => undefined)
  progress?.(t('Java {major} установлена', { major: runtime.major }), 100)
  return runtime
}

export async function resolveJava(
  loader: LoaderType,
  mcVersion: string,
  preferredPath?: string,
  progress?: JavaProgress
): Promise<JavaRuntime> {
  const required = await requiredJavaMajorForLoader(loader, mcVersion)
  const settings = getSettings()
  const requestedPath = preferredPath || settings.defaultJavaPath

  if (requestedPath) {
    const runtime = await probeJava(requestedPath)
    if (runtime && runtime.major >= required) return runtime
  }

  const runtimes = await detectJava()
  const exact = runtimes.find((runtime) => runtime.major === required)
  if (exact) return exact

  // Java 17+ is backwards compatible enough for modern servers; Java 8 is not.
  if (required >= 17) {
    const higher = runtimes
      .filter((runtime) => runtime.major > required)
      .sort((a, b) => a.major - b.major)[0]
    if (higher) return higher
  }

  if (settings.autoDownloadJava) {
    progress?.(
      t('Java {major} не найдена. Загружаем Eclipse Temurin JDK {major}…', { major: required }),
      0
    )
    return installJava(required, progress)
  }

  throw new Error(
    t(
      'JAVA_REQUIRED:{major}:Для Minecraft {version} нужна Java {major}. Установите её во вкладке настроек сервера.',
      { major: required, version: mcVersion }
    )
  )
}
