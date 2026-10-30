import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import fs from 'node:fs'

const execFileAsync = promisify(execFile)

export interface SampleResult {
  cpuPercent: number
  rssMb: number
}

/**
 * Cross-platform process sampler. CPU is normalised the same way Task Manager
 * does it: 100% = one fully loaded core (can exceed 100 on multi-core).
 */
export class ProcessSampler {
  private lastCpuSeconds = 0
  private lastAt = 0

  constructor(private readonly pid: number) {}

  async sample(): Promise<SampleResult | null> {
    try {
      if (process.platform === 'win32') return await this.sampleWindows()
      if (process.platform === 'linux') return await this.sampleLinux()
      return await this.sampleUnix()
    } catch {
      return null
    }
  }

  private cpuFromSeconds(cpuSeconds: number): number {
    const now = Date.now()
    if (!this.lastAt) {
      this.lastAt = now
      this.lastCpuSeconds = cpuSeconds
      return 0
    }
    const elapsed = (now - this.lastAt) / 1000
    const delta = Math.max(0, cpuSeconds - this.lastCpuSeconds)
    this.lastAt = now
    this.lastCpuSeconds = cpuSeconds
    if (elapsed <= 0) return 0
    return Math.min(100 * 64, (delta / elapsed) * 100)
  }

  private async sampleWindows(): Promise<SampleResult | null> {
    const command = `$p=Get-Process -Id ${this.pid} -ErrorAction Stop; "$($p.CPU);$($p.WorkingSet64)"`
    const { stdout } = await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', command],
      { timeout: 8000, windowsHide: true }
    )
    const [cpuRaw, rssRaw] = stdout.trim().split(';')
    const cpuSeconds = Number(cpuRaw)
    const rssBytes = Number(rssRaw)
    if (!Number.isFinite(rssBytes)) return null
    return {
      cpuPercent: this.cpuFromSeconds(Number.isFinite(cpuSeconds) ? cpuSeconds : this.lastCpuSeconds),
      rssMb: rssBytes / 1024 / 1024
    }
  }

  private async sampleLinux(): Promise<SampleResult | null> {
    const stat = await fs.promises.readFile(`/proc/${this.pid}/stat`, 'utf8')
    const closing = stat.lastIndexOf(')')
    if (closing < 0) return null
    const fields = stat.slice(closing + 2).trim().split(/\s+/)
    const utime = Number(fields[11])
    const stime = Number(fields[12])
    if (!Number.isFinite(utime) || !Number.isFinite(stime)) return null

    const statm = await fs.promises.readFile(`/proc/${this.pid}/statm`, 'utf8')
    const residentPages = Number(statm.trim().split(/\s+/)[1])
    const rssBytes = Number.isFinite(residentPages) ? residentPages * 4096 : 0

    return {
      cpuPercent: this.cpuFromSeconds((utime + stime) / 100),
      rssMb: rssBytes / 1024 / 1024
    }
  }

  private async sampleUnix(): Promise<SampleResult | null> {
    const { stdout } = await execFileAsync(
      'ps',
      ['-o', '%cpu=,rss=', '-p', String(this.pid)],
      { timeout: 8000 }
    )
    const [cpuRaw, rssRaw] = stdout.trim().split(/\s+/)
    const cpu = Number(cpuRaw)
    const rssKb = Number(rssRaw)
    if (!Number.isFinite(cpu) || !Number.isFinite(rssKb)) return null
    return { cpuPercent: Math.max(0, cpu), rssMb: rssKb / 1024 }
  }
}
