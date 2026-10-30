import fs from 'node:fs'
import path from 'node:path'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'

export const USER_AGENT =
  'CraftPulse/0.1.0 (+https://github.com/Kurw1k/CraftPulse)'

export interface FetchOptions {
  headers?: Record<string, string>
  timeoutMs?: number
}

export async function fetchJson<T>(url: string, options: FetchOptions = {}): Promise<T> {
  const text = await fetchText(url, options)
  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error(`Invalid JSON response from ${url}`)
  }
}

export async function fetchText(url: string, options: FetchOptions = {}): Promise<string> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 30_000)
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: '*/*',
        ...options.headers
      }
    })
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText} — ${url}`)
    }
    return await response.text()
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timed out: ${url}`)
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

export type ProgressCallback = (receivedBytes: number, totalBytes: number) => void

export async function downloadFile(
  url: string,
  destination: string,
  onProgress?: ProgressCallback,
  headers: Record<string, string> = {}
): Promise<void> {
  const controller = new AbortController()
  let response: Response
  try {
    response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: '*/*',
        ...headers
      },
      redirect: 'follow'
    })
  } catch (error) {
    controller.abort()
    throw new Error(`Download failed: ${(error as Error).message}`)
  }

  if (!response.ok || !response.body) {
    throw new Error(`HTTP ${response.status} ${response.statusText} — ${url}`)
  }

  const total = Number(response.headers.get('content-length') ?? 0)
  const received = { bytes: 0 }
  const counter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      received.bytes += chunk.length
      onProgress?.(received.bytes, total)
      callback(null, chunk)
    }
  })

  await fs.promises.mkdir(path.dirname(destination), { recursive: true })
  const partial = `${destination}.part`
  try {
    await pipeline(Readable.fromWeb(response.body as never), counter, fs.createWriteStream(partial))
    await fs.promises.rename(partial, destination)
  } catch (error) {
    await fs.promises.rm(partial, { force: true }).catch(() => undefined)
    throw error
  }
}

export async function pathExists(target: string): Promise<boolean> {
  try {
    await fs.promises.access(target)
    return true
  } catch {
    return false
  }
}
