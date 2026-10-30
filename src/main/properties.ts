import type { PropertyEntry } from '@shared/types'

/**
 * Minimal Java .properties reader/writer tuned for server.properties.
 * Comments and unknown keys are preserved when updating values.
 */
export function parseProperties(text: string): PropertyEntry[] {
  const entries: PropertyEntry[] = []
  const seen = new Set<string>()
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#') || line.startsWith('!')) continue
    const index = line.indexOf('=')
    if (index < 0) continue
    const key = line.slice(0, index).trim()
    if (!key || seen.has(key)) continue
    seen.add(key)
    entries.push({ key, value: line.slice(index + 1).trim() })
  }
  return entries
}

export function propertiesToRecord(entries: PropertyEntry[]): Record<string, string> {
  const record: Record<string, string> = {}
  for (const entry of entries) record[entry.key] = entry.value
  return record
}

export function mergeProperties(text: string, updates: Record<string, string>): string {
  const handled = new Set<string>()
  const lines = text.split(/\r?\n/)
  const output: string[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('!')) {
      output.push(line)
      continue
    }
    const index = trimmed.indexOf('=')
    if (index < 0) {
      output.push(line)
      continue
    }
    const key = trimmed.slice(0, index).trim()
    if (key in updates) {
      output.push(`${key}=${sanitizeValue(updates[key])}`)
      handled.add(key)
    } else {
      output.push(line)
    }
  }

  for (const [key, value] of Object.entries(updates)) {
    if (!handled.has(key)) output.push(`${key}=${sanitizeValue(value)}`)
  }

  while (output.length > 0 && output[output.length - 1] === '') output.pop()
  return `${output.join('\n')}\n`
}

function sanitizeValue(value: string): string {
  return String(value).replace(/[\r\n]/g, '')
}

export const DEFAULT_SERVER_PROPERTIES: Record<string, string> = {
  'server-port': '25565',
  'server-ip': '',
  'max-players': '20',
  'gamemode': 'survival',
  'difficulty': 'normal',
  'hardcore': 'false',
  'pvp': 'true',
  'online-mode': 'true',
  'allow-flight': 'false',
  'allow-nether': 'true',
  'spawn-monsters': 'true',
  'spawn-animals': 'true',
  'spawn-npcs': 'true',
  'enable-command-block': 'false',
  'force-gamemode': 'false',
  'player-idle-timeout': '0',
  'view-distance': '10',
  'simulation-distance': '10',
  'spawn-protection': '16',
  'motd': 'A CraftPulse Minecraft Server',
  'level-name': 'world',
  'level-seed': '',
  'level-type': 'minecraft:normal',
  'generate-structures': 'true',
  'max-world-size': '29999984',
  'white-list': 'false',
  'enforce-whitelist': 'false',
  'enable-rcon': 'false',
  'rcon.port': '25575',
  'rcon.password': '',
  'broadcast-rcon-to-ops': 'true',
  'network-compression-threshold': '256'
}

export function defaultProperties(port: number, onlineMode = true): string {
  const values = {
    ...DEFAULT_SERVER_PROPERTIES,
    'server-port': String(port),
    'online-mode': onlineMode ? 'true' : 'false'
  }
  const header = [
    '#Minecraft server properties',
    `#Created by CraftPulse on ${new Date().toISOString()}`,
    ''
  ]
  return `${header.join('\n')}${Object.entries(values)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')}\n`
}
