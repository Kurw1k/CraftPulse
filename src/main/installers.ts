import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import type { LaunchSpec, LoaderType } from '@shared/types'
import { downloadFile, fetchJson } from './http'
import { t } from './i18n'
import { getVersionJson } from './mojang'
import {
  BUNGEECORD_JAR,
  canvasDownloadUrl,
  getBukkitDownloadUrl,
  getSpongeUniversal,
  listLoaderBuilds,
  listMohistJars,
  paperProjectFor,
  pickArclightAsset,
  pickCanvasBuild,
  pickGetBukkitJar,
  pickMagmaVersion,
  pickPaperBuild,
  pickPufferfishBuild,
  pickSpongeBuild,
  pickYouerBuild,
  pufferfishDownloadUrl,
  youerDownloadUrl
} from './versions'

export interface InstallOptions {
  loader: LoaderType
  mcVersion: string
  loaderVersion?: string
  dir: string
  javaPath: string
  progress: (message: string, percent?: number) => void
}

export interface InstallResult {
  launch: LaunchSpec
  loaderVersion: string
}

const FORGE_MAVEN = 'https://maven.minecraftforge.net/net/minecraftforge/forge'
const NEOFORGE_MAVEN = 'https://maven.neoforged.net/releases/net/neoforged/neoforge'
const FABRIC_META = 'https://meta.fabricmc.net/v2'

async function exists(target: string): Promise<boolean> {
  try {
    await fs.promises.access(target)
    return true
  } catch {
    return false
  }
}

async function downloadJar(
  url: string,
  destination: string,
  label: string,
  progress: InstallOptions['progress']
): Promise<void> {
  progress(t('{label}…', { label }), 0)
  await downloadFile(url, destination, (received, total) => {
    const percent = total > 0 ? Math.round((received / total) * 100) : undefined
    progress(
      t('{label} — {size} МБ', { label, size: (received / 1024 / 1024).toFixed(1) }),
      percent
    )
  })
}

async function runInstaller(
  javaPath: string,
  args: string[],
  cwd: string,
  progress: InstallOptions['progress']
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(javaPath, args, {
      cwd,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    })
    let tail = ''
    const onData = (chunk: Buffer): void => {
      const text = chunk.toString()
      tail = `${tail}${text}`.slice(-8000)
      for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim()
        if (trimmed) progress(trimmed)
      }
    }
    child.stdout?.on('data', onData)
    child.stderr?.on('data', onData)
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve()
      else {
        reject(
          new Error(
            t('Установщик завершился с кодом {code}.\n{tail}', {
              code: code ?? '—',
              tail: tail.split(/\r?\n/).slice(-12).join('\n')
            })
          )
        )
      }
    })
  })
}

function toArgPath(relative: string): string {
  return relative.split(path.sep).join('/')
}

async function findArgsFile(dir: string, segments: string[], version: string): Promise<string | null> {
  const baseRelative = path.join('libraries', ...segments, version)
  const names = process.platform === 'win32' ? ['win_args.txt', 'unix_args.txt'] : ['unix_args.txt', 'win_args.txt']
  for (const name of names) {
    const relative = path.join(baseRelative, name)
    if (await exists(path.join(dir, relative))) return toArgPath(relative)
  }

  // Some installer versions put the args file under a slightly different path.
  const root = path.join(dir, 'libraries', ...segments)
  const stack: Array<{ folder: string; depth: number }> = [{ folder: root, depth: 0 }]
  while (stack.length) {
    const current = stack.pop()
    if (!current) break
    let entries: fs.Dirent[] = []
    try {
      entries = await fs.promises.readdir(current.folder, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      const full = path.join(current.folder, entry.name)
      if (entry.isFile() && (entry.name === 'win_args.txt' || entry.name === 'unix_args.txt')) {
        return toArgPath(path.relative(dir, full))
      }
      if (entry.isDirectory() && current.depth < 4) {
        stack.push({ folder: full, depth: current.depth + 1 })
      }
    }
  }
  return null
}

async function installVanilla(
  options: InstallOptions
): Promise<InstallResult> {
  const version = await getVersionJson(options.mcVersion)
  const server = version.downloads?.server
  if (!server?.url) {
    throw new Error(t('Mojang не публикует server.jar для версии {version}', { version: options.mcVersion }))
  }
  const destination = path.join(options.dir, 'server.jar')
  await downloadJar(
    server.url,
    destination,
    t('Скачивание Vanilla server.jar'),
    options.progress
  )
  return { launch: { type: 'jar', target: 'server.jar' }, loaderVersion: options.mcVersion }
}

async function installPaperFamily(options: InstallOptions): Promise<InstallResult> {
  const project = paperProjectFor(options.loader)
  if (!project) throw new Error(t('Неизвестный проект PaperMC: {loader}', { loader: options.loader }))
  const label = project.charAt(0).toUpperCase() + project.slice(1)
  const build = await pickPaperBuild(options.mcVersion, options.loaderVersion, project)
  const download = build.downloads['server:default'] ?? Object.values(build.downloads ?? {})[0]
  if (!download?.url) throw new Error(t('{label} не вернул ссылку на сборку', { label }))
  await downloadJar(
    download.url,
    path.join(options.dir, 'server.jar'),
    t('Скачивание {label} #{build}', { label, build: build.id }),
    options.progress
  )
  return { launch: { type: 'jar', target: 'server.jar' }, loaderVersion: String(build.id) }
}

async function installPurpur(options: InstallOptions): Promise<InstallResult> {
  const build = options.loaderVersion || 'latest'
  const url = `https://api.purpurmc.org/v2/purpur/${encodeURIComponent(options.mcVersion)}/${encodeURIComponent(build)}/download`
  await downloadJar(
    url,
    path.join(options.dir, 'server.jar'),
    t('Скачивание Purpur {build}', { build }),
    options.progress
  )
  return { launch: { type: 'jar', target: 'server.jar' }, loaderVersion: build }
}

async function installGetBukkit(
  options: InstallOptions,
  type: 'spigot' | 'craftbukkit'
): Promise<InstallResult> {
  const jar = await pickGetBukkitJar(type, options.mcVersion)
  const label = type === 'spigot' ? 'Spigot' : 'CraftBukkit'
  await downloadJar(
    getBukkitDownloadUrl(jar),
    path.join(options.dir, 'server.jar'),
    t('Скачивание {label} {version}', { label, version: jar.version }),
    options.progress
  )
  return { launch: { type: 'jar', target: 'server.jar' }, loaderVersion: jar.version }
}

async function installPufferfish(options: InstallOptions): Promise<InstallResult> {
  const build = await pickPufferfishBuild(options.mcVersion, options.loaderVersion)
  await downloadJar(
    pufferfishDownloadUrl(build),
    path.join(options.dir, 'server.jar'),
    t('Скачивание Pufferfish #{build} ({version})', { build: build.id, version: build.mcVersion }),
    options.progress
  )
  return { launch: { type: 'jar', target: 'server.jar' }, loaderVersion: String(build.id) }
}

async function installCanvas(options: InstallOptions): Promise<InstallResult> {
  const build = await pickCanvasBuild(options.mcVersion, options.loaderVersion)
  await downloadJar(
    canvasDownloadUrl(build),
    path.join(options.dir, 'server.jar'),
    t('Скачивание Canvas #{build} ({version})', { build: build.id, version: build.mcVersion }),
    options.progress
  )
  return { launch: { type: 'jar', target: 'server.jar' }, loaderVersion: String(build.id) }
}

async function installFabric(options: InstallOptions): Promise<InstallResult> {
  interface FabricLoader {
    loader: { version: string; stable: boolean }
  }
  const loaders = await fetchJson<FabricLoader[]>(
    `${FABRIC_META}/versions/loader/${encodeURIComponent(options.mcVersion)}`
  )
  if (!Array.isArray(loaders) || loaders.length === 0) {
    throw new Error(t('Fabric не поддерживает Minecraft {version}', { version: options.mcVersion }))
  }
  const chosen = options.loaderVersion
    ? loaders.find((entry) => entry.loader.version === options.loaderVersion) ?? loaders[0]
    : loaders.find((entry) => entry.loader.stable) ?? loaders[0]

  const installers = await fetchJson<Array<{ version: string; stable: boolean }>>(
    `${FABRIC_META}/versions/installer`
  )
  const installer = installers.find((entry) => entry.stable) ?? installers[0]
  if (!installer) throw new Error(t('Не удалось определить версию установщика Fabric'))

  const url = `${FABRIC_META}/versions/loader/${encodeURIComponent(options.mcVersion)}/${encodeURIComponent(chosen.loader.version)}/${encodeURIComponent(installer.version)}/server/jar`
  await downloadJar(
    url,
    path.join(options.dir, 'server.jar'),
    t('Скачивание Fabric {version}', { version: chosen.loader.version }),
    options.progress
  )
  return { launch: { type: 'jar', target: 'server.jar' }, loaderVersion: chosen.loader.version }
}

async function installForgeInternal(options: InstallOptions): Promise<InstallResult> {
  const builds = await listLoaderBuilds('forge', options.mcVersion)
  const loaderVersion = (options.loaderVersion || builds[0] || '').replace(`${options.mcVersion}-`, '')
  if (!loaderVersion) {
    throw new Error(t('Forge не поддерживает Minecraft {version}', { version: options.mcVersion }))
  }
  const full = `${options.mcVersion}-${loaderVersion}`
  const installerUrl = `${FORGE_MAVEN}/${full}/forge-${full}-installer.jar`
  const installerPath = path.join(options.dir, `forge-${full}-installer.jar`)

  options.progress(t('Скачивание Forge {version}…', { version: full }), 0)
  await downloadJar(
    installerUrl,
    installerPath,
    t('Скачивание Forge {version}', { version: full }),
    options.progress
  )

  options.progress(t('Установка Forge (может занять несколько минут)…'), 0)
  await runInstaller(options.javaPath, ['-jar', installerPath, '--installServer'], options.dir, options.progress)
  await fs.promises.rm(installerPath, { force: true }).catch(() => undefined)

  const argsFile = await findArgsFile(options.dir, ['net', 'minecraftforge', 'forge'], full)
  if (argsFile) {
    return { launch: { type: 'argsfile', target: argsFile }, loaderVersion }
  }

  for (const candidate of [`forge-${full}.jar`, `forge-${full}-universal.jar`]) {
    if (await exists(path.join(options.dir, candidate))) {
      return { launch: { type: 'jar', target: candidate }, loaderVersion }
    }
  }

  throw new Error(
    t('Forge установлен, но не найден файл запуска (args.txt / forge jar). Проверьте вывод установщика.')
  )
}

async function installNeoForge(options: InstallOptions): Promise<InstallResult> {
  const builds = await listLoaderBuilds('neoforge', options.mcVersion)
  const version = options.loaderVersion || builds[0]
  if (!version) {
    throw new Error(t('NeoForge не поддерживает Minecraft {version}', { version: options.mcVersion }))
  }

  const installerUrl = `${NEOFORGE_MAVEN}/${version}/neoforge-${version}-installer.jar`
  const installerPath = path.join(options.dir, `neoforge-${version}-installer.jar`)

  await downloadJar(
    installerUrl,
    installerPath,
    t('Скачивание NeoForge {version}', { version }),
    options.progress
  )
  options.progress(t('Установка NeoForge (может занять несколько минут)…'), 0)
  await runInstaller(options.javaPath, ['-jar', installerPath, '--installServer'], options.dir, options.progress)
  await fs.promises.rm(installerPath, { force: true }).catch(() => undefined)

  const argsFile = await findArgsFile(options.dir, ['net', 'neoforged', 'neoforge'], version)
  if (argsFile) {
    return { launch: { type: 'argsfile', target: argsFile }, loaderVersion: version }
  }

  throw new Error(
    t('NeoForge установлен, но файл запуска не найден. Проверьте вывод установщика.')
  )
}

async function installArcLight(options: InstallOptions): Promise<InstallResult> {
  const forge = await installForgeInternal(options)
  options.progress(t('Поиск сборки ArcLight…'), 0)
  const asset = await pickArclightAsset(options.mcVersion, 'forge')
  const modsDir = path.join(options.dir, 'mods')
  await fs.promises.mkdir(modsDir, { recursive: true })
  await downloadJar(
    asset.url,
    path.join(modsDir, asset.filename),
    t('Скачивание ArcLight {version}', { version: asset.version }),
    options.progress
  )
  return { ...forge, loaderVersion: `${forge.loaderVersion}+arclight` }
}

async function installMohist(
  options: InstallOptions,
  project: 'mohist' | 'banner'
): Promise<InstallResult> {
  const jars = await listMohistJars(project, options.mcVersion)
  const label = project === 'mohist' ? 'Mohist' : 'Banner'
  if (!jars.length) {
    throw new Error(
      t('{label} не публикует сборки для Minecraft {version}', {
        label,
        version: options.mcVersion
      })
    )
  }
  const requested = options.loaderVersion?.toLowerCase()
  const chosen = requested
    ? jars.find((jar) => jar.id === requested) ??
      jars.find((jar) => jar.sha?.startsWith(requested))
    : jars[0]
  if (!chosen) {
    throw new Error(
      t('Сборка {label} {version} не найдена', {
        label,
        version: options.loaderVersion ?? ''
      })
    )
  }
  await downloadJar(
    chosen.url,
    path.join(options.dir, 'server.jar'),
    t('Скачивание {label} {version}', { label, version: chosen.id }),
    options.progress
  )
  return { launch: { type: 'jar', target: 'server.jar' }, loaderVersion: chosen.id }
}

async function installYouer(options: InstallOptions): Promise<InstallResult> {
  const build = await pickYouerBuild(options.mcVersion, options.loaderVersion)
  const neoforge = build.loader?.neoforge_version
  await fs.promises.mkdir(path.join(options.dir, 'mods'), { recursive: true })
  await fs.promises.mkdir(path.join(options.dir, 'plugins'), { recursive: true })
  await downloadJar(
    youerDownloadUrl(options.mcVersion, build.id),
    path.join(options.dir, 'server.jar'),
    t('Скачивание Youer #{build}{neoforge}', {
      build: build.id,
      neoforge: neoforge ? ` (NeoForge ${neoforge})` : ''
    }),
    options.progress
  )
  return { launch: { type: 'jar', target: 'server.jar' }, loaderVersion: String(build.id) }
}

async function installMagma(options: InstallOptions): Promise<InstallResult> {
  const chosen = await pickMagmaVersion(options.mcVersion, options.loaderVersion)
  if (!chosen.launcherUrl) {
    throw new Error(t('Magma {version} не предоставила launcher.jar', { version: chosen.version }))
  }
  await downloadJar(
    chosen.launcherUrl,
    path.join(options.dir, 'server.jar'),
    t('Скачивание Magma {version}', { version: chosen.version }),
    options.progress
  )
  return { launch: { type: 'jar', target: 'server.jar' }, loaderVersion: chosen.version }
}

async function installSpongeVanilla(options: InstallOptions): Promise<InstallResult> {
  const build = await pickSpongeBuild('spongevanilla', options.mcVersion, options.loaderVersion)
  const asset = await getSpongeUniversal('spongevanilla', build.version)
  await downloadJar(
    asset.url,
    path.join(options.dir, 'server.jar'),
    t('Скачивание SpongeVanilla {version}', { version: build.version }),
    options.progress
  )
  return { launch: { type: 'jar', target: 'server.jar' }, loaderVersion: build.version }
}

async function installSpongeForge(options: InstallOptions): Promise<InstallResult> {
  const build = await pickSpongeBuild('spongeforge', options.mcVersion, options.loaderVersion)
  if (!build.forge) {
    throw new Error(t('SpongeForge {version} не содержит версию Forge', { version: build.version }))
  }

  const forge = await installForgeInternal({
    ...options,
    loader: 'forge',
    loaderVersion: build.forge
  })
  const asset = await getSpongeUniversal('spongeforge', build.version)
  const modsDir = path.join(options.dir, 'mods')
  await fs.promises.mkdir(modsDir, { recursive: true })
  await downloadJar(
    asset.url,
    path.join(modsDir, asset.filename),
    t('Скачивание SpongeForge {version}', { version: build.version }),
    options.progress
  )
  return { ...forge, loaderVersion: build.version }
}

async function installBungeeCord(options: InstallOptions): Promise<InstallResult> {
  await downloadJar(
    BUNGEECORD_JAR,
    path.join(options.dir, 'server.jar'),
    t('Скачивание последней сборки BungeeCord'),
    options.progress
  )
  return { launch: { type: 'jar', target: 'server.jar' }, loaderVersion: 'latest' }
}

export async function installLoader(options: InstallOptions): Promise<InstallResult> {
  await fs.promises.mkdir(options.dir, { recursive: true })

  switch (options.loader) {
    case 'vanilla':
      return installVanilla(options)
    case 'paper':
    case 'folia':
    case 'velocity':
    case 'waterfall':
      return installPaperFamily(options)
    case 'purpur':
      return installPurpur(options)
    case 'spigot':
      return installGetBukkit(options, 'spigot')
    case 'craftbukkit':
      return installGetBukkit(options, 'craftbukkit')
    case 'pufferfish':
      return installPufferfish(options)
    case 'canvas':
      return installCanvas(options)
    case 'fabric':
      return installFabric(options)
    case 'forge':
      return installForgeInternal(options)
    case 'neoforge':
      return installNeoForge(options)
    case 'arclight':
      return installArcLight(options)
    case 'mohist':
      return installMohist(options, 'mohist')
    case 'banner':
      return installMohist(options, 'banner')
    case 'youer':
      return installYouer(options)
    case 'magma':
      return installMagma(options)
    case 'sponge-vanilla':
      return installSpongeVanilla(options)
    case 'sponge-forge':
      return installSpongeForge(options)
    case 'bungeecord':
      return installBungeeCord(options)
    default: {
      const exhaustive: never = options.loader
      throw new Error(`Unknown loader: ${String(exhaustive)}`)
    }
  }
}
